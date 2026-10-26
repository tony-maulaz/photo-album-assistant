import { describe, expect, it } from 'vitest';
import {
  acceptablesSansVider,
  accepter,
  aRelire,
  avancementGroupes,
  basculer,
  copiesEnAttente,
  ecarterTout,
  etatPhoto,
  exemplairesAEcarterDans,
  exemplairesEcartesDans,
  garderTout,
  groupesCopies,
  groupesScenes,
  groupeVisible,
  photosDuGroupe,
  type GroupeDoublons,
} from '../src/lib/groupesDoublons';
import { dossierSource, ecarterDoublons, garderAussi, Historique, mettreDeCote, planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';

function plan(): Plan {
  const p = planVide();
  p.dossiers.set('best', { id: 'best', nom: 'Best of', parent: RACINE, origine: 'source', traitement: 'nettoyer' });
  const f = (id: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({
    id,
    nom: id.split('/').pop()!,
    taille: 1000,
    modifie: 0,
    categorie: 'photo',
    date: '2025-12-13T14:29:00',
    origineDate: 'exif',
    dossier: RACINE,
    statut: 'archive',
    ...extra,
  });
  for (const x of [
    f('a.jpg', { date: '2025-12-13T14:29:03' }),
    f('b.jpg', { date: '2025-12-13T14:29:04' }),
    f('c.jpg', { date: '2025-12-13T14:29:06' }),
    f('IMG_1.jpg'),
    f('Best of/IMG-WA1.jpg', { dossier: 'best', origineDate: 'fichier' }),
  ])
    p.fichiers.set(x.id, x);
  return p;
}

const rafale: GroupeDoublons = {
  cle: 'rafale:a',
  sorte: 'rafales',
  etoile: 'a',
  section: 'jour:2025-12-13',
  membres: [
    { id: 'a.jpg', garder: true },
    { id: 'b.jpg', garder: false, raison: 'quasi identique' },
    { id: 'c.jpg', garder: false, raison: 'quasi identique' },
  ],
};
rafale.etoile = 'a.jpg';

const etats = (p: Plan, g: GroupeDoublons) => photosDuGroupe(g, (id) => p.fichiers.get(id)).map((x) => x.etat);
const fichiers = (p: Plan) => (id: string) => p.fichiers.get(id);

describe('état des photos d’un groupe (D71)', () => {
  it('lit l’état dans le plan : gardée, à écarter (proposition), écartée', () => {
    const p = plan();
    expect(etats(p, rafale)).toEqual(['gardee', 'a_ecarter', 'a_ecarter']);
    expect(aRelire(rafale, fichiers(p))).toBe(true);
  });

  it('une photo écartée pour une autre raison (floue, copie exacte) quitte le groupe, sans badge faux', () => {
    const p = plan();
    mettreDeCote(p, ['c.jpg'], 'doublons_exacts');
    expect(photosDuGroupe(rafale, fichiers(p)).map((x) => x.m.id)).toEqual(['a.jpg', 'b.jpg']);
    mettreDeCote(p, ['b.jpg'], 'floues');
    expect(groupeVisible(rafale, fichiers(p))).toBe(false);
  });
});

describe('décisions (un clic, Accepter, Tout garder, Tout écarter)', () => {
  it('un clic inverse ce que l’on voit : « à écarter » devient gardée, même la ★ peut être écartée', () => {
    const p = plan();
    basculer(p, rafale, 'b.jpg');
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'a_ecarter']);
    expect(p.fichiers.get('b.jpg')!.protegee).toBe(true);
    basculer(p, rafale, 'a.jpg');
    expect(etats(p, rafale)).toEqual(['ecartee', 'gardee', 'a_ecarter']);
    // La photo gardée à la place de la ★ : la première qui reste.
    expect(p.fichiers.get('a.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons', doublon: { garde: 'b.jpg', source: 'rafale' } });
    basculer(p, rafale, 'a.jpg');
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'a_ecarter']);
    expect(p.fichiers.get('a.jpg')).toMatchObject({ statut: 'archive', dossier: RACINE, protegee: true });
  });

  it('« Accepter » écarte ce qui est encore proposé, sans toucher aux choix faits ; Ctrl+Z annule', () => {
    const p = plan();
    const h = new Historique();
    h.enregistrer(basculer(p, rafale, 'b.jpg'));
    h.enregistrer(accepter(p, [rafale]));
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'ecartee']);
    expect(aRelire(rafale, fichiers(p))).toBe(false);
    expect(p.fichiers.get('c.jpg')!.doublon).toMatchObject({ garde: 'a.jpg', raison: 'quasi identique' });
    h.annuler(p);
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'a_ecarter']);
  });

  it('un « Accepter » groupé laisse à relire le groupe qu’il viderait : la ★ a été écartée (D99)', () => {
    const p = plan();
    basculer(p, rafale, 'a.jpg');
    expect(etats(p, rafale)).toEqual(['ecartee', 'a_ecarter', 'a_ecarter']);
    const autre: GroupeDoublons = { ...rafale, cle: 'rafale:IMG_1', etoile: 'IMG_1.jpg', membres: [{ id: 'IMG_1.jpg', garder: true }, { id: 'c.jpg', garder: false }] };
    expect(acceptablesSansVider([rafale, autre], fichiers(p))).toEqual([autre]);
  });

  it('« Tout écarter » écarte aussi la ★ ; « Tout garder » remet tout', () => {
    const p = plan();
    ecarterTout(p, [rafale]);
    expect(etats(p, rafale)).toEqual(['ecartee', 'ecartee', 'ecartee']);
    garderTout(p, [rafale]);
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'gardee']);
    expect(avancementGroupes([rafale], fichiers(p))).toEqual({ relus: 1, total: 1 });
  });

  it('copie réduite rangée dans un dossier « Garder, nettoyer » : l’original prend sa place (D71)', () => {
    const p = plan();
    const [g] = groupesCopies(
      [{ garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'reduite' }], aGarder: ['IMG_1.jpg'], remplacement: { original: 'IMG_1.jpg', copie: 'Best of/IMG-WA1.jpg', dossier: 'best' } }],
      fichiers(p),
    );
    expect(g.sorte).toBe('copies');
    expect(etatPhoto(g, g.membres[1], p.fichiers.get('Best of/IMG-WA1.jpg'))).toBe('a_ecarter');
    accepter(p, [g]);
    expect(p.fichiers.get('IMG_1.jpg')).toMatchObject({ statut: 'archive', dossier: 'best' });
    expect(p.fichiers.get('Best of/IMG-WA1.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons_exacts' });
    // L'exemplaire écarté reste dans le groupe : on peut changer d'avis.
    expect(etats(p, g)).toEqual(['gardee', 'ecartee']);
  });

  it('toutes les copies d’une photo peuvent être écartées (rien n’est supprimé)', () => {
    const p = plan();
    const [g] = groupesCopies([{ garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg'] }], fichiers(p));
    ecarterTout(p, [g]);
    expect(etats(p, g)).toEqual(['ecartee', 'ecartee']);
    expect(p.fichiers.get('a.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons_exacts' });
  });
});

describe('construction des groupes', () => {
  it('copies : « Dans plusieurs dossiers » quand tous les exemplaires sont gardés ; section = la journée', () => {
    const p = plan();
    const groupes = groupesCopies(
      [
        { garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg'] },
        { garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'identique' }], aGarder: ['IMG_1.jpg', 'Best of/IMG-WA1.jpg'] },
      ],
      fichiers(p),
    );
    expect(groupes.map((g) => [g.sorte, g.section])).toEqual([
      ['copies', 'jour:2025-12-13'],
      ['dossiers', 'jour:2025-12-13'],
    ]);
  });

  it('rafales et IA : ordre chronologique, refus du garde-fou visibles et gardés, clés stables', () => {
    const p = plan();
    const lots = {
      'jour:2025-12-13': {
        propositions: [
          { garde: 'b.jpg', doublons: [{ id: 'c.jpg', raison: 'r' }, { id: 'a.jpg', raison: 'r' }], source: 'rafale' as const },
          { garde: 'a.jpg', doublons: [{ id: 'b.jpg', raison: 'r' }], source: 'ia' as const, scene: 'pont', refus: [{ id: 'c.jpg', motif: 'garde-fou' }] },
        ],
      },
      'jour:sans': { propositions: [{ garde: 'IMG_1.jpg', doublons: [{ id: 'a.jpg', raison: 'r' }], source: 'rafale' as const }] },
      best: { propositions: [{ garde: 'IMG_1.jpg', doublons: [{ id: 'b.jpg', raison: 'r' }], source: 'rafale' as const }] },
    };
    const groupes = groupesScenes(lots, fichiers(p));
    expect(groupes[0].membres.map((m) => m.id)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(groupes[1]).toMatchObject({ sorte: 'ia', scene: 'pont' });
    expect(groupes[1].membres.find((m) => m.id === 'c.jpg')).toMatchObject({ garder: true, refus: true });
    expect(groupes.map((g) => g.section)).toEqual(['jour:2025-12-13', 'jour:2025-12-13', 'sans', 'dossier:best']);
    expect(groupesScenes(lots, fichiers(p)).map((g) => g.cle)).toEqual(groupes.map((g) => g.cle));
  });
});

describe('avant le tri (D85)', () => {
  it('signale les copies encore « à écarter » parmi les photos que le tri range, et seulement celles-là', () => {
    const p = plan();
    const groupes = groupesCopies(
      [
        { garde: 'Best of/IMG-WA1.jpg', copies: [{ id: 'IMG_1.jpg', type: 'identique' }], aGarder: ['Best of/IMG-WA1.jpg'] },
        { garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg', 'b.jpg'] },
      ],
      fichiers(p),
    );
    const aTrier = new Set(['IMG_1.jpg', 'a.jpg', 'b.jpg', 'c.jpg']);
    expect(copiesEnAttente(groupes, aTrier, fichiers(p)).map((g) => g.cle)).toEqual(['copie:Best of/IMG-WA1.jpg']);
    // Une fois acceptée, la copie n'attend plus.
    new Historique().enregistrer(accepter(p, groupes));
    expect(copiesEnAttente(groupes, aTrier, fichiers(p))).toEqual([]);
    expect(p.fichiers.get('IMG_1.jpg')?.statut).toBe('mis_de_cote');
  });
});

describe('copies dans plusieurs dossiers gardés : tout un dossier d’un coup (D86)', () => {
  it('écarte les exemplaires du dossier gardés aussi ailleurs, jamais le dernier ; puis les remet', () => {
    const p = plan();
    const groupes = groupesCopies([{ garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'identique' }], aGarder: ['IMG_1.jpg', 'Best of/IMG-WA1.jpg'] }], fichiers(p));
    const dansBest = (f: FichierPlan) => dossierSource(f) === 'Best of';
    const aLaRacine = (f: FichierPlan) => dossierSource(f) === '';
    expect(exemplairesAEcarterDans(groupes, dansBest, fichiers(p))).toEqual(['Best of/IMG-WA1.jpg']);
    new Historique().enregistrer(ecarterDoublons(p, [{ id: 'Best of/IMG-WA1.jpg', raison: 'doublons_exacts' }]));
    // Le seul exemplaire encore gardé, à la racine, n'est jamais proposé.
    expect(exemplairesAEcarterDans(groupes, aLaRacine, fichiers(p))).toEqual([]);
    expect(exemplairesEcartesDans(groupes, dansBest, fichiers(p))).toEqual(['Best of/IMG-WA1.jpg']);
    new Historique().enregistrer(garderAussi(p, ['Best of/IMG-WA1.jpg']));
    expect(exemplairesEcartesDans(groupes, dansBest, fichiers(p))).toEqual([]);
    expect(p.fichiers.get('Best of/IMG-WA1.jpg')?.statut).toBe('archive');
  });
});
