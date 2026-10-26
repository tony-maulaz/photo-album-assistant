import { describe, expect, it } from 'vitest';
import {
  cheminDossier,
  contenu,
  creerDossier,
  dateSure,
  deplacerFichiers,
  depuisJson,
  ErreurPlan,
  fusionnerDossiers,
  Historique,
  mettreDeCote,
  periodeDe,
  RACINE,
  recadrer,
  remettre,
  renommerDossier,
  resumes,
  supprimerDossierVide,
  tourner,
  versJson,
  type Plan,
} from '../src/lib/plan';
import { nomLibre, verifierNomDossier } from '../src/lib/noms';
import { dateRetenue, heureLocale, planInitial, type ElementSource } from '../src/lib/source';

const MS = Date.UTC(2025, 6, 4, 10, 0, 0);

function element(chemin: string, extra: Partial<ElementSource> = {}): ElementSource {
  const ext = chemin.slice(chemin.lastIndexOf('.')).toLowerCase();
  const categorie = ['.jpg', '.jpeg'].includes(ext) ? 'photo' : ext === '.mp4' ? 'video' : 'autre';
  return { chemin, taille: 1000 + chemin.length, modifie: MS, categorie, ...extra };
}

/** Un dossier « déjà trié » typique. */
function exemple(): Plan {
  return planInitial([
    element('Annecy_27-29.06.25/20250627_101010.jpg', { exif: { date: '2025:06:27 10:10:10', decalage: '+02:00' } }),
    element('Annecy_27-29.06.25/20250628_111111.jpg', { exif: { date: '2025:06:28 11:11:11', decalage: '+02:00' } }),
    element('Annecy_27-29.06.25/20250628_120000.mp4', { video: { dateUTC: new Date(Date.UTC(2025, 5, 28, 10, 0, 30)), dureeSecondes: 30 } }),
    element('Paleo_24.07.25/IMG_1.jpg', { exif: { date: '2025:07:24 20:00:00' } }),
    element('Paleo_24.07.25/IMG_2.jpg', { exif: { date: '2025:07:24 21:00:00' } }),
    element('BESTOF_2025/Lea/IMG_1.jpg', { exif: { date: '2025:07:24 20:00:00' } }),
    element('vrac.jpg'),
    element('_a_supprimer/20250101_000001.jpg'),
    element('Paleo_24.07.25/IMG_3_doublon.jpg', { exif: { date: '2025:07:24 21:01:00' } }),
    element('dossiers.csv'),
    element('.album/plan.json'),
  ]).plan;
}

/** Plan sérialisé indépendamment de l'ordre des éléments (une annulation peut le changer). */
const normaliser = (plan: Plan) => {
  const j = versJson(plan);
  return { ...j, dossiers: [...j.dossiers].sort((a, b) => a.id.localeCompare(b.id)), fichiers: [...j.fichiers].sort((a, b) => a.id.localeCompare(b.id)) };
};

const id = (plan: Plan, nom: string) => [...plan.dossiers.values()].find((d) => d.nom === nom)!.id;

describe('noms', () => {
  it('refuse les noms interdits par Windows', () => {
    expect(verifierNomDossier('Paléo 2025')).toBeNull();
    expect(verifierNomDossier('a/b')).toContain('/');
    expect(verifierNomDossier('Plage?')).toContain('?');
    expect(verifierNomDossier('CON')).toContain('réservé');
    expect(verifierNomDossier('fin.')).toContain('point');
    expect(verifierNomDossier('  ')).toBe('Le nom est vide.');
  });

  it('trouve un nom libre sans tenir compte de la casse', () => {
    expect(nomLibre('IMG_1.jpg', new Set(['img_1.jpg']))).toBe('IMG_1_2.jpg');
    expect(nomLibre('IMG_1.jpg', new Set(['img_1.jpg', 'img_1_2.jpg']))).toBe('IMG_1_3.jpg');
    expect(nomLibre('note', new Set())).toBe('note');
  });
});

describe('plan initial d’un dossier déjà trié', () => {
  it('reprend l’arborescence de la source', () => {
    const plan = exemple();
    expect([...plan.dossiers.values()].map((d) => cheminDossier(plan, d.id)).sort()).toEqual([
      '',
      'Annecy_27-29.06.25',
      'BESTOF_2025',
      'BESTOF_2025/Lea',
      'Paleo_24.07.25',
    ]);
    expect(plan.fichiers.get('vrac.jpg')!.dossier).toBe(RACINE);
  });

  it('ignore l’état d’une autre sortie et garde les autres fichiers', () => {
    const r = planInitial([element('.album/plan.json'), element('dossiers.csv')]);
    expect(r.ignores).toEqual(['.album/plan.json']);
    expect(r.plan.fichiers.get('dossiers.csv')!.categorie).toBe('autre');
  });

  it('reconnaît ce que les anciens scripts avaient mis de côté', () => {
    const plan = exemple();
    const floue = plan.fichiers.get('_a_supprimer/20250101_000001.jpg')!;
    expect([floue.statut, floue.raison, floue.dossier]).toEqual(['mis_de_cote', 'floues', RACINE]);
    const doublon = plan.fichiers.get('Paleo_24.07.25/IMG_3_doublon.jpg')!;
    expect([doublon.statut, doublon.raison, doublon.nom, doublon.dossier]).toEqual(['mis_de_cote', 'doublons', 'IMG_3.jpg', id(plan, 'Paleo_24.07.25')]);
  });

  it('date les vidéos Samsung par leur nom, sinon par la date interne moins la durée', () => {
    const plan = exemple();
    expect(plan.fichiers.get('Annecy_27-29.06.25/20250628_120000.mp4')!.date).toBe('2025-06-28T12:00:00');
    const sansNom = dateRetenue(
      element('Annecy/Plongeon (3).mp4', { video: { dateUTC: new Date(Date.UTC(2025, 5, 28, 10, 0, 30)), dureeSecondes: 30 } }),
      '+02:00',
    );
    expect(sansNom).toEqual({ date: '2025-06-28T12:00:00', origine: 'video' });
  });

  it('retombe sur la date du fichier et le signale', () => {
    const d = dateRetenue(element('Famille (3).jpg', { modifie: Date.UTC(2025, 0, 2, 3, 4, 5) }));
    expect(d.origine).toBe('fichier');
    expect(heureLocale(Date.UTC(2025, 0, 2, 3, 4, 5), '+01:00')).toBe('2025-01-02T04:04:05');
    expect(heureLocale(Date.UTC(2025, 0, 2, 3, 4, 5), '-05:30')).toBe('2025-01-01T21:34:05');
  });
});

describe('opérations sur le plan', () => {
  it('déplace des photos, met à jour nombres et dates, et annule (A4)', () => {
    const plan = exemple();
    const h = new Historique();
    const annecy = id(plan, 'Annecy_27-29.06.25');
    const paleo = id(plan, 'Paleo_24.07.25');
    h.enregistrer(deplacerFichiers(plan, ['Paleo_24.07.25/IMG_1.jpg', 'Paleo_24.07.25/IMG_2.jpg'], annecy));
    let r = resumes(plan);
    expect([r.get(annecy)!.photos, r.get(annecy)!.au, r.get(paleo)!.photos]).toEqual([4, '2025-07-24', 0]);
    expect(h.prochaineAnnulation).toContain('Déplacer 2 éléments');
    h.annuler(plan);
    r = resumes(plan);
    expect([r.get(annecy)!.photos, r.get(annecy)!.au, r.get(paleo)!.photos]).toEqual([2, '2025-06-28', 2]);
    h.retablir(plan);
    expect(resumes(plan).get(annecy)!.photos).toBe(4);
  });

  it('la date du fichier d’une photo sans date n’étire pas la période d’un dossier', () => {
    const plan = exemple();
    const annecy = id(plan, 'Annecy_27-29.06.25');
    // « vrac.jpg » n'a que la date de son fichier (04.07.2025), souvent celle d'une copie.
    expect(plan.fichiers.get('vrac.jpg')).toMatchObject({ origineDate: 'fichier', date: expect.stringMatching(/^2025-07-04/) });
    const racine = resumes(plan).get(RACINE)!;
    expect([racine.photos, racine.du, racine.au, racine.duTotal, racine.auTotal]).toEqual([1, undefined, undefined, '2025-06-27', '2025-07-24']);
    deplacerFichiers(plan, ['vrac.jpg'], annecy);
    const r = resumes(plan).get(annecy)!;
    expect([r.photos, r.du, r.au, r.duTotal, r.auTotal]).toEqual([3, '2025-06-27', '2025-06-28', '2025-06-27', '2025-06-28']);
    expect(dateSure(plan.fichiers.get('vrac.jpg')!)).toBeUndefined();
    expect(periodeDe(contenu(plan, annecy))).toEqual({ du: '2025-06-27', au: '2025-06-28' });
    expect(periodeDe([{ date: '2025-07-04', origineDate: 'fichier' }])).toEqual({ du: undefined, au: undefined });
  });

  it('renomme un fichier dont le nom est déjà pris dans le dossier cible', () => {
    const plan = exemple();
    deplacerFichiers(plan, ['BESTOF_2025/Lea/IMG_1.jpg'], id(plan, 'Paleo_24.07.25'));
    expect(plan.fichiers.get('BESTOF_2025/Lea/IMG_1.jpg')!.nom).toBe('IMG_1_2.jpg');
    expect(contenu(plan, id(plan, 'Paleo_24.07.25')).map((f) => f.nom).sort()).toEqual(['IMG_1.jpg', 'IMG_1_2.jpg', 'IMG_2.jpg']);
  });

  it('crée, renomme et refuse les doublons de noms entre dossiers voisins', () => {
    const plan = exemple();
    const h = new Historique();
    const { id: nouveau, modification } = creerDossier(plan, 'Vacances 2025');
    h.enregistrer(modification);
    expect(() => creerDossier(plan, 'vacances 2025')).toThrow(ErreurPlan);
    h.enregistrer(renommerDossier(plan, nouveau, 'Été 2025'));
    expect(plan.dossiers.get(nouveau)!.nom).toBe('Été 2025');
    expect(() => renommerDossier(plan, nouveau, 'paleo_24.07.25')).toThrow(/existe déjà/);
    expect(() => renommerDossier(plan, RACINE, 'X')).toThrow(ErreurPlan);
    h.annuler(plan);
    h.annuler(plan);
    expect(plan.dossiers.has(nouveau)).toBe(false);
  });

  it('garde le nom tapé (accents, espaces) quand le dossier reçoit sa version sans accents', () => {
    const plan = exemple();
    const { id } = creerDossier(plan, 'Ko_Samui_2026-07-18');
    renommerDossier(plan, id, 'Plage_a_Ko_Samui_18.07.26', 'Plage à Ko Samui 18.07.26');
    expect(plan.dossiers.get(id)).toMatchObject({ nom: 'Plage_a_Ko_Samui_18.07.26', nomSaisi: 'Plage à Ko Samui 18.07.26' });
    // Même nom, tapé déjà dans la convention : rien à garder.
    expect(renommerDossier(plan, id, 'Plage_a_Ko_Samui_18.07.26', 'Plage_a_Ko_Samui_18.07.26')).not.toBeNull();
    expect(plan.dossiers.get(id)!.nomSaisi).toBeUndefined();
    renommerDossier(plan, id, 'Plage_a_Ko_Samui_18.07.26', 'Plage à Ko Samui 18.07.26');
    // Un autre nom tapé directement (panneau des dossiers) oublie l'ancien texte.
    renommerDossier(plan, id, 'Plage Chaweng');
    expect(plan.dossiers.get(id)!.nomSaisi).toBeUndefined();
  });

  it('tourne une photo recadrée avec son recadrage (même partie de la photo)', () => {
    const plan = exemple();
    const id = 'Paleo_24.07.25/IMG_1.jpg';
    recadrer(plan, id, { x: 0.1, y: 0.05, l: 0.6, h: 0.8, angle: 2 });
    tourner(plan, [id], 90);
    expect(plan.fichiers.get(id)).toMatchObject({ rotation: 90, recadrage: { x: 0.15, y: 0.1, l: 0.8, h: 0.6, angle: 2 } });
    tourner(plan, [id], -90);
    expect(plan.fichiers.get(id)!.rotation).toBeUndefined();
    expect(plan.fichiers.get(id)!.recadrage).toEqual({ x: 0.1, y: 0.05, l: 0.6, h: 0.8, angle: 2 });
  });

  it('fusionne un dossier et ses sous-dossiers, puis annule', () => {
    const plan = exemple();
    const h = new Historique();
    const avant = normaliser(plan);
    const { id: cible, modification } = creerDossier(plan, 'Sélection');
    h.enregistrer(modification);
    h.enregistrer(fusionnerDossiers(plan, id(plan, 'BESTOF_2025'), cible));
    expect(plan.dossiers.has('s:BESTOF_2025')).toBe(false);
    expect(cheminDossier(plan, plan.fichiers.get('BESTOF_2025/Lea/IMG_1.jpg')!.dossier)).toBe('Sélection/Lea');
    expect(() => fusionnerDossiers(plan, cible, id(plan, 'Lea'))).toThrow(/sous-dossiers/);
    h.annuler(plan);
    h.annuler(plan);
    expect(normaliser(plan)).toEqual(avant);
  });

  it('met de côté et remet dans le dossier d’origine', () => {
    const plan = exemple();
    const paleo = id(plan, 'Paleo_24.07.25');
    mettreDeCote(plan, ['Paleo_24.07.25/IMG_2.jpg']);
    expect(resumes(plan).get(paleo)!.photos).toBe(1);
    remettre(plan, ['Paleo_24.07.25/IMG_2.jpg', 'Paleo_24.07.25/IMG_3_doublon.jpg']);
    expect(contenu(plan, paleo).map((f) => f.nom)).toEqual(['IMG_1.jpg', 'IMG_2.jpg', 'IMG_3.jpg']);
  });

  it('ne supprime qu’un dossier vide', () => {
    const plan = exemple();
    expect(() => supprimerDossierVide(plan, id(plan, 'Paleo_24.07.25'))).toThrow(/pas vide/);
    const { id: vide } = creerDossier(plan, 'Vide');
    supprimerDossierVide(plan, vide);
    expect(plan.dossiers.has(vide)).toBe(false);
  });

  it('déplace 500 photos instantanément', () => {
    const elements = Array.from({ length: 5000 }, (_, i) => element(`D${i % 50}/IMG_${i}.jpg`, { exif: { date: '2025:01:01 10:00:00' } }));
    const plan = planInitial(elements).plan;
    const ids = elements.slice(0, 500).map((e) => e.chemin);
    const t0 = performance.now();
    deplacerFichiers(plan, ids, id(plan, 'D7'));
    resumes(plan);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('s’enregistre et se relit à l’identique', () => {
    const plan = exemple();
    creerDossier(plan, 'Nouveau');
    const relu = depuisJson(JSON.parse(JSON.stringify(versJson(plan))));
    expect(versJson(relu)).toEqual(versJson(plan));
    expect(() => depuisJson({ version: 2 } as never)).toThrow(ErreurPlan);
  });
});

describe('modifications combinées', () => {
  it('annule « créer un dossier et y ranger la sélection » en une fois', async () => {
    const { combiner } = await import('../src/lib/plan');
    const plan = exemple();
    const avant = normaliser(plan);
    const h = new Historique();
    const { id: nouveau, modification } = creerDossier(plan, 'Concert');
    h.enregistrer(combiner('Nouveau dossier « Concert »', modification, deplacerFichiers(plan, ['Paleo_24.07.25/IMG_1.jpg'], nouveau)));
    expect(contenu(plan, nouveau).map((f) => f.id)).toEqual(['Paleo_24.07.25/IMG_1.jpg']);
    h.annuler(plan);
    expect(normaliser(plan)).toEqual(avant);
    h.retablir(plan);
    expect(contenu(plan, nouveau)).toHaveLength(1);
  });
});

describe('enchaîner des opérations', () => {
  it('une erreur au milieu défait les opérations déjà faites', async () => {
    const { enchainer, planVide, renommerDossier, creerDossier } = await import('../src/lib/plan');
    const p = planVide();
    const { id } = creerDossier(p, 'A');
    creerDossier(p, 'B');
    expect(() =>
      enchainer(p, 'essai', [
        () => renommerDossier(p, id, 'C'),
        () => renommerDossier(p, id, 'B'),
      ]),
    ).toThrow();
    expect(p.dossiers.get(id)!.nom).toBe('A');
  });
});
