import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import criteres from '../src/ia/consignes/selection_criteres.txt?raw';
import appreciation from '../src/ia/consignes/selection_appreciation.txt?raw';
import meilleurePile from '../src/ia/consignes/selection_meilleure_pile.txt?raw';
import textesConsigne from '../src/ia/consignes/textes_titres_commentaires.txt?raw';
import {
  demandeControleSelection,
  demandeMeilleure,
  demandesAppreciation,
  demandesEtiquettes,
  estimerDemandes,
  lireAppreciation,
  lireControleSelection,
  lireEtiquettes,
  lireMeilleure,
  lots,
  lotsPile,
  repartis,
  SYSTEME_CRITERES,
  texteEtiquettes,
  type PhotoIA,
} from '../src/lib/aidesSelection';
import { extraireJson } from '../src/lib/doublons';
import { modele } from '../src/lib/tarifs';

const photos = (n: number, prefixe = 'p'): PhotoIA[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefixe}${i + 1}`, identite: `id-${prefixe}${i + 1}`, date: `2026-07-${String(10 + (i % 18)).padStart(2, '0')}T10:${String(i % 60).padStart(2, '0')}:00` }));

// Les scripts d'origine ne sont pas publiés : ce contrôle ne tourne que là où ils sont présents.
const SCRIPT_03 = new URL('../../reference/python/03_selection_album_ia.py', import.meta.url);

describe.skipIf(!existsSync(SCRIPT_03))('consignes reprises mot pour mot du script 03', () => {
  const script = readFileSync(SCRIPT_03, 'utf-8');
  // Dans le source Python, « \\" » vaut « \" » une fois la chaîne évaluée.
  const evalue = script.replaceAll('\\\\"', '\\"');

  it('critères, notation, meilleure d’une série, textes', () => {
    for (const c of [criteres, appreciation, meilleurePile, textesConsigne]) {
      expect(c.length).toBeGreaterThan(100);
      expect(evalue).toContain(c);
    }
    expect(SYSTEME_CRITERES).toBe(`${criteres}\nRéponds UNIQUEMENT en JSON valide, sans texte autour.`);
  });
});

describe('répartition des photos en appels', () => {
  it('lots équilibrés et photos réparties', () => {
    expect(lots(photos(13), 6).map((l) => l.length)).toEqual([5, 4, 4]);
    expect(lots(photos(13), 7).map((l) => l.length)).toEqual([7, 6]);
    expect(lots([], 6)).toEqual([]);
    expect(repartis(photos(10), 3).map((p) => p.id)).toEqual(['p2', 'p6', 'p9']);
    expect(lotsPile(photos(9)).map((l) => l.length)).toEqual([5, 4]);
  });

  it('IA8 : 10 photos individuelles par appel, numérotées dans le texte', () => {
    const d = demandesEtiquettes(photos(23));
    expect(d.map((x) => x.ids.length)).toEqual([8, 8, 7]);
    expect(d[0]).toMatchObject({ fonction: 'IA8', niveau: 'rapide', effort: 'low', rechercheWeb: 0 });
    expect(d[0].images[0]).toEqual({ type: 'photo', libelle: 'Photo 1 :', id: 'p1', cote: 768 });
    expect(d[0].consigne).toContain('numérotées de 1 à 8');
    // La clé dépend des photos et de la consigne (contexte compris), jamais du chemin.
    expect(demandesEtiquettes(photos(23))[0].cle).toBe(d[0].cle);
    expect(demandesEtiquettes(photos(23), { contexte: 'Voyage en Thaïlande' })[0].cle).not.toBe(d[0].cle);
    expect(demandesEtiquettes(photos(23), { contexte: 'Voyage en Thaïlande' })[0].consigne).toContain('Contexte donné par la famille (il prime sur tes suppositions) : Voyage en Thaïlande');
  });

  it('IA9 et IA10 : lots de 6 à 1024 px, critères du script en consigne système', () => {
    const d = demandesAppreciation(photos(14));
    expect(d.map((x) => x.ids.length)).toEqual([5, 5, 4]);
    expect(d[0].systeme).toBe(SYSTEME_CRITERES);
    expect(d[0].schema).toBeUndefined();
    expect(d[0].images[2]).toMatchObject({ type: 'photo', cote: 1024, libelle: 'Photo 3 :' });
    const m = demandeMeilleure(photos(8));
    expect(m.ids).toHaveLength(6);
    expect(m.consigne.startsWith(meilleurePile)).toBe(true);
  });

  it('IA11 : planches « Sélection » puis « Autres », numéros continus', () => {
    const d = demandeControleSelection(photos(30), photos(40, 'a'), { sortie: 'Plage_Chaweng' })!;
    expect(d.images.map((i) => i.libelle)).toEqual(['Sélection 1 :', 'Sélection 2 :', 'Autres :']);
    const autres = d.images[2];
    expect(autres.type === 'planche' && autres.numeros[0]).toBe(31);
    expect(autres.type === 'planche' && autres.numeros.at(-1)).toBe(54);
    expect(d.ids).toHaveLength(54);
    expect(d.consigne).toContain('numérotées de 1 à 30.');
    expect(d.consigne).toContain('numérotées de 31 à 54.');
    expect(d.consigne).toContain(': Plage_Chaweng.');
    expect(demandeControleSelection([], photos(3), { sortie: 'x' })).toBeNull();
    const sansAutres = demandeControleSelection(photos(4), [], { sortie: 'x' })!;
    expect(sansAutres.consigne).not.toContain('Autres');
  });

  it('estimation du coût : quelques centimes pour étiqueter 1600 photos', () => {
    const e = estimerDemandes(demandesEtiquettes(photos(1600)), modele('claude-haiku-5-5')!);
    expect(e.appels).toBe(160);
    expect(e.images).toBe(1600);
    expect(e.usd).toBeGreaterThan(0.05);
    expect(e.usd).toBeLessThan(0.5);
  });
});

describe('lecture des réponses abîmées (I9, I12)', () => {
  const ids = ['a', 'b', 'c'];

  it('IA8 : liste au lieu d’objet, numéros en texte, doublon, hors plage, valeurs approximatives', () => {
    const r = lireEtiquettes(
      [
        { photo: '2', personnes: 3, type: 'Activité', defauts: 'yeux fermés, contre-jour', description: '  enfants sur un éléphant  ' },
        { photo: 2, personnes: 'aucune', type: 'paysage', defauts: [], description: 'autre' },
        { photo: 9, type: 'paysage', description: 'hors plage' },
        null,
        { photo: 1, personnes: 'groupe', type: 'inconnu', defauts: ['flou', 'bizarre'], description: '' },
      ],
      ids,
    );
    expect(r.get('b')).toEqual({ personnes: '2-4', type: 'activite', defauts: ['yeux_fermes', 'contre_jour'], description: 'enfants sur un éléphant' });
    expect(r.get('a')).toEqual({ personnes: 'groupe', type: undefined, defauts: ['flou_de_bouge'], description: '' });
    expect(r.has('c')).toBe(false);
    expect(texteEtiquettes(r.get('b')!)).toBe('enfants sur un éléphant ; activité ; 2 à 4 personnes ; yeux fermés ; contre-jour');
  });

  it('IA8 : JSON abîmé réparé, réponse non numérotée prise dans l’ordre', () => {
    const r = lireEtiquettes(extraireJson('{"photos": [{"photo": 1, "type": "repas", "description": "repas au restaurant"},]}'), ids);
    expect(r.get('a')?.type).toBe('repas');
    const ordre = lireEtiquettes({ photos: [{ description: 'un' }, { description: 'deux' }, { description: 'trois' }] }, ids);
    expect(ordre.get('c')?.description).toBe('trois');
    expect(lireEtiquettes(null, ids).size).toBe(0);
    expect(lireEtiquettes({ photos: 'rien' }, ids).size).toBe(0);
  });

  it('IA9 : notes « 8/10 », booléens en texte, note illisible ignorée', () => {
    const r = lireAppreciation(
      [
        { photo: 1, note: '8/10', pleine_page: 'oui', justification: 'Belle lumière.' },
        { photo: '2', note: 12, pleine_page: false },
        { photo: 3, note: 'bien' },
        { photo: 1, note: 2 },
      ],
      ids,
    );
    expect(r.get('a')).toEqual({ note: 8, pleinePage: true, justification: 'Belle lumière.' });
    expect(r.get('b')).toEqual({ note: 10, pleinePage: false, justification: '' });
    expect(r.has('c')).toBe(false);
  });

  it('IA10 : meilleure valide, sinon rien', () => {
    expect(lireMeilleure({ meilleure: '3', notes: ['6', 7.5, 'x'], pleine_page: true, justification: 'nette' }, ids)).toEqual({
      id: 'c',
      notes: new Map([
        ['a', 6],
        ['b', 7.5],
      ]),
      pleinePage: true,
      justification: 'nette',
    });
    expect(lireMeilleure([{ meilleure: 1 }], ids)?.id).toBe('a');
    expect(lireMeilleure({ meilleure: 7 }, ids)).toBeNull();
    expect(lireMeilleure('la deuxième', ids)).toBeNull();
  });

  it('IA11 : remarques validées, une redondance ne cite que des photos retenues', () => {
    const tous = ['r1', 'r2', 'r3', 'x1', 'x2'];
    const r = lireControleSelection(
      {
        remarques: [
          { type: 'Redondances', photos: [1, 2, 4], texte: 'Même plage trois fois.' },
          { type: 'manque', photos: ['5', 9], texte: 'Aucune photo de groupe.' },
          { type: 'faible', photos: [3] },
          'texte libre',
        ],
      },
      tous,
      3,
    );
    expect(r).toEqual([
      { type: 'redondance', photos: ['r1', 'r2'], texte: 'Même plage trois fois.' },
      { type: 'manque', photos: ['x2'], texte: 'Aucune photo de groupe.' },
    ]);
  });
});
