import { describe, expect, it } from 'vitest';
import type { LieuConnu } from '../src/lib/config';
import type { EvenementCalendrier } from '../src/lib/ics';
import { Historique, planVide, RACINE, versJson, type FichierPlan, type Plan } from '../src/lib/plan';
import {
  appliquerTri,
  arborescence,
  dateDeNom,
  distanceM,
  estDossierMois,
  grouper,
  moisDeNom,
  nomDescriptif,
  nomDossierLibre,
  nomDominant,
  OPTIONS_TRI_DEFAUT,
  sansDate,
  type OptionsTri,
  type PhotoTri,
} from '../src/lib/tri';

/** Degrés de latitude pour une distance en km (rayon terrestre du script). */
const km = (d: number) => d / ((6371.0088 * Math.PI) / 180);
const O = (o: Partial<OptionsTri> = {}): OptionsTri => ({ ...OPTIONS_TRI_DEFAUT, ...o });

function lieu(id: string, lat: number, lon: number, rayon_m: number, extra: Partial<LieuConnu> = {}): LieuConnu {
  return { id, nom: id, lat, lon, rayon_m, domicile: false, un_seul_dossier: false, notes: '', ...extra };
}

let n = 0;
function photo(date: string | undefined, lat?: number, lon?: number, nom = `IMG_${String(++n).padStart(4, '0')}.jpg`): PhotoTri {
  return { id: `p${n}_${nom}`, nom, date, ...(lat !== undefined && lon !== undefined ? { gps: { lat, lon } } : {}) };
}

const chemins = (d: ReturnType<typeof arborescence>) => Object.fromEntries(d.map((x) => [x.chemin.join('/'), x.photos.length]));

describe('briques du script 01', () => {
  it('distance haversine', () => {
    expect(distanceM(46.5, 6.6, 46.5 + km(1.5), 6.6)).toBeCloseTo(1500, 3);
  });

  it('nom descriptif d’un fichier nommé à la main', () => {
    expect(nomDescriptif('Anniversaire Lea.jpg')).toBe('Anniversaire_Lea');
    expect(nomDescriptif('Anniversaire Lea (2).jpg')).toBe('Anniversaire_Lea');
    expect(nomDescriptif('Fête des vendanges-3.jpg')).toBe('Fete_des_vendanges');
    expect(nomDescriptif('IMG_2043.jpg')).toBeNull();
    expect(nomDescriptif('20250927_103937.jpg')).toBeNull();
    expect(nomDescriptif('PXL_20250704_123456.jpg')).toBeNull();
    expect(nomDescriptif('Screenshot_20250704-123456.png')).toBeNull();
    expect(nomDescriptif('abc.jpg')).toBeNull();
  });

  it('nom dominant : le plus fréquent, puis le plus long', () => {
    expect(nomDominant(['Anniversaire Lea.jpg', 'Anniversaire Lea (1).jpg', 'IMG_2043.jpg', 'Gateau.jpg'])).toBe('Anniversaire_Lea');
    expect(nomDominant(['Plage.jpg', 'Plage de Nice.jpg'])).toBe('Plage_de_Nice');
    expect(nomDominant(['IMG_1.jpg'])).toBeNull();
    // La date d'un fichier déjà nommé ne compte pas : deux jours au même lieu
    // font un seul nom, qui l'emporte sur un nom isolé plus long.
    expect(nomDominant(['Ville_A_27.07.25.jpg', 'Ville_A_02.08.25.jpg', 'Arrivee_Ville_A.jpg'])).toBe('Ville_A');
    // La date se retire avant les points : plus de « Ville_B_25 ».
    expect(nomDescriptif('Ville_B_25-26.07.25_3.jpg')).toBe('Ville_B');
    expect(nomDescriptif('Jardin_11.07.25.jpg')).toBe('Jardin');
  });

  it('retire une date en fin de description', () => {
    expect(sansDate('Fete_Village_A_09.06.25')).toBe('Fete_Village_A');
    expect(sansDate('Q_permisL_05.2025')).toBe('Q_permisL');
    expect(sansDate('Jardin_11.07.25')).toBe('Jardin');
    expect(sansDate('Annecy_27-29.06.25')).toBe('Annecy');
    expect(sansDate('Sortie_2025-06-09')).toBe('Sortie');
  });

  it('date des noms de dossiers comme ceux de la famille (JJ.MM.AA)', () => {
    expect(dateDeNom('2025-11-22')).toBe('22.11.25');
    expect(dateDeNom('2025-06-27', '2025-06-29')).toBe('27-29.06.25');
    expect(dateDeNom('2025-06-28', '2025-07-02')).toBe('28.06-02.07.25');
    expect(dateDeNom('2025-12-28', '2026-01-02')).toBe('28.12.25-02.01.26');
    expect(moisDeNom('2025-11')).toBe('11.25');
    // Le point d'une date n'est pas une extension : « Lausanne_12.01.26_2 », pas « Lausanne_12.01_2.26 ».
    expect(nomDossierLibre('Lausanne_12.01.26', new Set(['lausanne_12.01.26']))).toBe('Lausanne_12.01.26_2');
    expect(nomDossierLibre('Lausanne_12.01.26', new Set())).toBe('Lausanne_12.01.26');
  });

  it('dossiers de mois', () => {
    expect(estDossierMois('01_janvier')).toBe(true);
    expect(estDossierMois('2025-08 Août')).toBe(true);
    expect(estDossierMois('03 March')).toBe(true);
    expect(estDossierMois('Vacances')).toBe(false);
    expect(estDossierMois('Vacances', ['vacances'])).toBe(true);
  });

  it('images tirées d’une vidéo par le téléphone : nom d’appareil, pas un nom parlant (D87)', () => {
    expect(nomDescriptif('VideoCapture_20250712-181512.jpg')).toBeNull();
  });
});

describe('regroupement', () => {
  it('DBSCAN en chaîne : A–B–C à 1,5 km forment un seul groupe à 2 km, trois à 1 km', () => {
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-01T11:00:00', 46.5 + km(1.5), 6.6), photo('2026-01-01T12:00:00', 46.5 + km(3), 6.6)];
    const g = grouper(ps, [], O());
    expect(g.groupes).toHaveLength(1);
    expect(g.groupes[0].lat).toBeCloseTo(46.5 + km(1.5), 6);
    expect(grouper(ps, [], O({ rayonKm: 1 })).groupes).toHaveLength(3);
  });

  it('5000 photos regroupées en moins d’une seconde (grille, pas de comparaison de toutes les paires)', () => {
    let graine = 1;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const ps = Array.from({ length: 5000 }, (_, i) => photo(`2026-01-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00`, 46 + hasard() * 0.5, 6.5 + hasard() * 0.7));
    const debut = performance.now();
    const g = grouper(ps, [], O());
    expect(performance.now() - debut).toBeLessThan(1000);
    expect(g.groupeDe.size).toBe(5000);
  });

  it('étiquettes dans l’ordre de la première photo', () => {
    const ps = [photo('2026-01-01', 10, 10), photo('2026-01-01', 46.5, 6.6), photo('2026-01-01', 10, 10.001)];
    const g = grouper(ps, [], O());
    expect(ps.map((p) => g.groupeDe.get(p.id))).toEqual([0, 1, 0]);
  });

  it('lieu connu le plus proche, et domicile explicite (D19)', () => {
    const gp = lieu('Grands_Parents', 46.5, 6.6, 500);
    const maison = lieu('Maison', 46.5 + km(0.3), 6.6, 500, { domicile: true });
    const ps = [photo('2026-01-01', 46.5 + km(0.25), 6.6), photo('2026-01-01', 46.5 + km(0.05), 6.6), photo('2026-01-01', 47, 7)];
    const g = grouper(ps, [gp, maison], O());
    expect(ps.map((p) => g.lieuDe.get(p.id)?.id ?? null)).toEqual(['Maison', 'Grands_Parents', null]);
    expect(g.domicile?.id).toBe('Maison');
    expect(grouper(ps, [gp, maison], O({ lieuxConnus: false })).lieuDe.size).toBe(0);
    expect(grouper(ps, [gp], O()).domicile).toBeNull();
  });

  it('une photo sans GPS rejoint le groupe le plus fréquent de sa journée', () => {
    const ps = [photo('2026-07-11T10:00:00', 13.75, 100.5), photo('2026-07-11T11:00:00', 13.75, 100.5), photo('2026-07-11T12:00:00', 14, 99.5), photo('2026-07-11T15:00:00'), photo('2026-07-12T15:00:00')];
    const g = grouper(ps, [], O());
    expect(g.groupeDe.get(ps[3].id)).toBe(0);
    expect(g.groupeDe.has(ps[4].id)).toBe(false);
  });
});

describe('arborescence', () => {
  it('découpe par écart (7 j) et par durée maximale (21 j)', () => {
    const ps = ['2026-01-01', '2026-01-06', '2026-01-20', '2026-05-01', '2026-05-06', '2026-05-11', '2026-05-16', '2026-05-21', '2026-05-26'].map((d) => photo(`${d}T10:00:00`, 46.5, 6.6));
    const d = arborescence(grouper(ps, [], O()), new Map([[0, 'Lausanne']]), O());
    expect(chemins(d)).toEqual({ 'Lausanne_01-06.01.26': 2, 'Lausanne_20.01.26': 1, 'Lausanne_01-21.05.26': 5, 'Lausanne_26.05.26': 1 });
    // Avec l'écart du script (30 jours), deux visites à deux semaines d'écart ne faisaient qu'une sortie.
    expect(Object.keys(chemins(arborescence(grouper(ps, [], O()), new Map([[0, 'Lausanne']]), O({ gapJours: 30 }))))).toContain('Lausanne_01-20.01.26');
  });

  it('un dossier par jour, nom géocodé manquant, Sans_lieu', () => {
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-02T09:00:00', 46.5, 6.6), photo('2026-01-05T09:00:00')];
    const g = grouper(ps, [], O());
    expect(chemins(arborescence(g, new Map(), O()))).toEqual({ 'Lieu_00_01-02.01.26': 2, Sans_lieu: 1 });
    expect(chemins(arborescence(g, new Map([[0, 'Lausanne']]), O({ parJour: true })))).toEqual({ 'Lausanne_01.01.26': 1, 'Lausanne_02.01.26': 1, Sans_lieu: 1 });
    expect(chemins(arborescence(g, new Map([[0, 'Lausanne']]), O({ parMois: true })))).toEqual({ 'Lausanne_01.26': 2, Sans_lieu: 1 });
    expect(chemins(arborescence(g, new Map([[0, 'Lausanne']]), O({ sansEvenement: true })))).toEqual({ Lausanne: 2, Sans_lieu: 1 });
  });

  it('collisions entre groupes homonymes : suffixe _b', () => {
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-01T15:00:00', 46.6, 6.6)];
    const d = arborescence(grouper(ps, [], O()), new Map([[0, 'Lausanne'], [1, 'Lausanne']]), O());
    expect(chemins(d)).toEqual({ 'Lausanne_01.01.26': 1, 'Lausanne_01.01.26_b': 1 });
  });

  it('par mois ou par lieu : deux lieux du même nom, ou un lieu du nom d’un lieu connu, ne fusionnent pas (I4, D87)', () => {
    const connu = lieu('Lausanne', 46.9, 6.6, 200);
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-02T10:00:00', 46.6, 6.6), photo('2026-01-03T10:00:00', 46.9, 6.6)];
    const g = grouper(ps, [connu], O());
    const noms = new Map([[0, 'Lausanne'], [1, 'Lausanne']]);
    expect(chemins(arborescence(g, noms, O({ parMois: true })))).toEqual({ 'Lausanne/01.26': 1, 'Lausanne_01.26': 1, 'Lausanne_01.26_b': 1 });
    expect(chemins(arborescence(g, noms, O({ sansEvenement: true })))).toEqual({ Lausanne: 1, Lausanne_b: 1, Lausanne_c: 1 });
  });

  it('nom descriptif des fichiers, sans répéter le lieu ni la date', () => {
    const ps = [photo('2026-06-09T10:00:00', 46.5, 6.6, 'Fete Village_A 09.06.25.jpg'), photo('2026-06-09T11:00:00', 46.5, 6.6, 'Fete Village_A 09.06.25 (1).jpg'), photo('2026-06-09T12:00:00', 46.5, 6.6)];
    expect(chemins(arborescence(grouper(ps, [], O()), new Map([[0, 'Village_A']]), O()))).toEqual({ 'Fete_Village_A_09.06.26': 3 });
    expect(chemins(arborescence(grouper(ps, [], O()), new Map([[0, 'Village_B']]), O()))).toEqual({ 'Fete_Village_A_Village_B_09.06.26': 3 });
    expect(chemins(arborescence(grouper(ps, [], O()), new Map([[0, 'Village_B']]), O({ nomsFichiers: false })))).toEqual({ 'Village_B_09.06.26': 3 });
  });

  it('lieux connus : un dossier parent, un sous-dossier par événement, ou à plat', () => {
    const maison = lieu('Maison', 46.5, 6.6, 200, { domicile: true });
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-01T11:00:00', 46.5, 6.6, 'Anniversaire Lea.jpg'), photo('2026-03-01T10:00:00', 46.5, 6.6), photo(undefined, 46.5, 6.6)];
    const d = arborescence(grouper(ps, [maison], O()), new Map(), O());
    expect(chemins(d)).toEqual({ 'Maison/Anniversaire_Lea_01.01.26': 2, 'Maison/01.03.26': 1, Maison: 1 });
    expect(d.find((x) => x.chemin.length === 2)!.info).toEqual({ origine: 'lieu_connu', lieu: 'Maison', lat: 46.5, lon: 6.6 });
    const plat = arborescence(grouper(ps, [{ ...maison, un_seul_dossier: true }], O()), new Map(), O());
    expect(chemins(plat)).toEqual({ Maison: 4 });
    // Par mois : un sous-dossier par mois, comme les autres lieux (le domicile n'est plus d'un seul tenant, D87).
    expect(chemins(arborescence(grouper(ps, [maison], O()), new Map(), O({ parMois: true })))).toEqual({ 'Maison/01.26': 2, 'Maison/03.26': 1, Maison: 1 });
  });

  it('une photo sans GPS d’une journée passée à la maison y est rangée, pas dans Sans_lieu (D87)', () => {
    const maison = lieu('Maison', 46.5, 6.6, 200, { domicile: true });
    const ps = [photo('2026-02-01T10:00:00', 46.5, 6.6), photo('2026-02-01T11:00:00', 46.5, 6.6), photo('2026-02-01T12:00:00', 47, 7), photo('2026-02-01T15:00:00')];
    const g = grouper(ps, [maison], O());
    expect(g.lieuDe.get(ps[3].id)?.id).toBe('Maison');
    expect(chemins(arborescence(g, new Map([[0, 'Berne']]), O()))).toEqual({ 'Maison/01.02.26': 3, 'Berne_01.02.26': 1 });
  });

  // Domicile en Suisse ; Bangkok et Kanchanaburi en Thaïlande.
  const maison = lieu('Maison', 46.5, 6.6, 200, { domicile: true });
  const noms = new Map([
    [0, 'Bangkok'],
    [1, 'Kanchanaburi'],
  ]);

  it('passe voyages : deux étapes lointaines qui s’enchaînent', () => {
    const ps = [
      photo('2026-07-11T10:00:00', 13.75, 100.5),
      photo('2026-07-12T18:00:00', 13.75, 100.5),
      photo('2026-07-12T19:00:00', 13.75, 100.5),
      photo('2026-07-13T09:00:00', 14.02, 99.53),
      photo('2026-07-14T09:00:00', 14.02, 99.53),
    ];
    const d = arborescence(grouper(ps, [maison], O()), noms, O());
    expect(chemins(d)).toEqual({ 'Voyage_Bangkok_11-14.07.26/Bangkok_11-12.07.26': 3, 'Voyage_Bangkok_11-14.07.26/Kanchanaburi_13-14.07.26': 2 });
    expect(d[0].infoParent).toEqual({ origine: 'voyage', lieu: 'Bangkok' });
    expect(d[1].info).toMatchObject({ origine: 'etape', lieu: 'Kanchanaburi' });
    // Sans domicile, ou passe désactivée : pas de voyage.
    expect(Object.keys(chemins(arborescence(grouper(ps, [], O()), noms, O())))).toEqual(['Bangkok_11-12.07.26', 'Kanchanaburi_13-14.07.26']);
    expect(Object.keys(chemins(arborescence(grouper(ps, [maison], O()), noms, O({ voyages: false }))))).toEqual(['Bangkok_11-12.07.26', 'Kanchanaburi_13-14.07.26']);
  });

  it('passe voyages : deux excursions lointaines deux jours de suite, rentré le soir entre les deux, ne font pas un voyage (D87)', () => {
    const loin = [photo('2026-07-11T10:00:00', 46.0, 7.75), photo('2026-07-12T10:00:00', 46.95, 7.45)];
    const nomsEx = new Map([[0, 'Zermatt'], [1, 'Berne']]);
    // Sans photo à la maison entre les deux : un voyage.
    expect(Object.keys(chemins(arborescence(grouper(loin, [maison], O()), nomsEx, O())))).toEqual(['Voyage_Zermatt_11-12.07.26/Zermatt_11.07.26', 'Voyage_Zermatt_11-12.07.26/Berne_12.07.26']);
    const ps = [loin[0], photo('2026-07-11T20:00:00', 46.5, 6.6), loin[1]];
    const d = arborescence(grouper(ps, [maison], O()), nomsEx, O());
    expect(Object.keys(chemins(d))).toEqual(['Zermatt_11.07.26', 'Maison/11.07.26', 'Berne_12.07.26']);
  });

  it('passe voyages : un lieu connu au loin (chez des proches) ne coupe pas le voyage (D87)', () => {
    const famille = lieu('Famille', 13.9, 100.0, 300);
    const ps = [photo('2026-07-11T10:00:00', 13.75, 100.5), photo('2026-07-12T10:00:00', 13.9, 100.0), photo('2026-07-13T10:00:00', 14.02, 99.53)];
    const d = arborescence(grouper(ps, [maison, famille], O()), noms, O());
    expect(Object.keys(chemins(d))).toEqual(['Voyage_Bangkok_11-13.07.26/Bangkok_11.07.26', 'Famille/12.07.26', 'Voyage_Bangkok_11-13.07.26/Kanchanaburi_13.07.26']);
  });

  it('passe voyages : un retour au domicile entre deux étapes les sépare', () => {
    const etapes = [photo('2026-07-11T10:00:00', 13.75, 100.5), photo('2026-07-15T10:00:00', 14.02, 99.53)];
    // Trois jours d'écart, sans photo à la maison : même voyage (gap-voyage-max 7).
    expect(Object.keys(chemins(arborescence(grouper(etapes, [maison], O()), noms, O())))).toEqual(['Voyage_Bangkok_11-15.07.26/Bangkok_11.07.26', 'Voyage_Bangkok_11-15.07.26/Kanchanaburi_15.07.26']);
    // Une photo à la maison entre les deux : deux sorties distinctes.
    const avecRetour = [etapes[0], photo('2026-07-13T10:00:00', 46.5, 6.6), etapes[1]];
    expect(Object.keys(chemins(arborescence(grouper(avecRetour, [maison], O()), noms, O())))).toEqual(['Bangkok_11.07.26', 'Maison/13.07.26', 'Kanchanaburi_15.07.26']);
  });
});

describe('application au plan', () => {
  function planVrac(): Plan {
    const plan = planVide();
    plan.dossiers.set('s:Juillet', { id: 's:Juillet', nom: 'Juillet', parent: RACINE, origine: 'source', traitement: 'trier' });
    plan.dossiers.set('s:BESTOF', { id: 's:BESTOF', nom: 'BESTOF', parent: RACINE, origine: 'source', traitement: 'garder' });
    const f = (id: string, dossier: string, date: string, statut: FichierPlan['statut'] = 'archive'): FichierPlan => ({
      id,
      nom: id.split('/').pop()!,
      taille: 1,
      modifie: 0,
      categorie: 'photo',
      date,
      origineDate: 'exif',
      dossier,
      statut,
      ...(statut === 'mis_de_cote' ? { raison: 'floues' as const } : {}),
    });
    for (const x of [
      f('a.jpg', RACINE, '2026-07-11T10:00:00'),
      f('Juillet/b.jpg', 's:Juillet', '2026-07-12T10:00:00'),
      f('Juillet/c.jpg', 's:Juillet', '2026-07-13T10:00:00'),
      f('Juillet/flou.jpg', 's:Juillet', '2026-07-13T11:00:00', 'mis_de_cote'),
      f('BESTOF/d.jpg', 's:BESTOF', '2026-07-12T10:00:00'),
    ])
      plan.fichiers.set(x.id, x);
    return plan;
  }
  const tri = (parJour: boolean) => {
    const ps: PhotoTri[] = [
      { id: 'a.jpg', nom: 'a.jpg', date: '2026-07-11T10:00:00', gps: { lat: 13.75, lon: 100.5 } },
      { id: 'Juillet/b.jpg', nom: 'b.jpg', date: '2026-07-12T10:00:00', gps: { lat: 13.75, lon: 100.5 } },
      { id: 'Juillet/c.jpg', nom: 'c.jpg', date: '2026-07-13T10:00:00', gps: { lat: 14.02, lon: 99.53 } },
      { id: 'Juillet/flou.jpg', nom: 'IMG_0004.jpg', date: '2026-07-13T11:00:00' },
    ];
    return arborescence(grouper(ps, [], O()), noms, O({ parJour }));
  };
  const noms = new Map([
    [0, 'Bangkok'],
    [1, 'Kanchanaburi'],
  ]);
  const aTrier = new Set(['a.jpg', 'Juillet/b.jpg', 'Juillet/c.jpg', 'Juillet/flou.jpg']);
  const ou = (plan: Plan, id: string) => {
    const f = plan.fichiers.get(id)!;
    const d = plan.dossiers.get(f.dossier)!;
    return d.parent === null ? '' : d.nom;
  };

  it('crée les dossiers, range les photos, supprime les dossiers à trier vidés', () => {
    const plan = planVrac();
    const m = appliquerTri(plan, tri(false), aTrier);
    expect(m).not.toBeNull();
    expect(['a.jpg', 'Juillet/b.jpg', 'Juillet/c.jpg', 'BESTOF/d.jpg'].map((id) => ou(plan, id))).toEqual(['Bangkok_11-12.07.26', 'Bangkok_11-12.07.26', 'Kanchanaburi_13.07.26', 'BESTOF']);
    // La photo floue reste de côté, mais reviendra dans le bon dossier.
    expect(plan.fichiers.get('Juillet/flou.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'floues' });
    expect(ou(plan, 'Juillet/flou.jpg')).toBe('Kanchanaburi_13.07.26');
    expect(plan.dossiers.has('s:Juillet')).toBe(false);
    expect(plan.dossiers.has('s:BESTOF')).toBe(true);
    const bangkok = [...plan.dossiers.values()].find((d) => d.nom === 'Bangkok_11-12.07.26')!;
    // Le nom donné par le tri est noté : tant que le dossier le porte, il est « automatique » (Nommage).
    expect(bangkok).toMatchObject({ parent: RACINE, origine: 'tri', tri: { origine: 'gps', lieu: 'Bangkok', nom: 'Bangkok_11-12.07.26' } });
  });

  it('relancer avec la même proposition ne change rien ; une autre remplace la précédente', () => {
    const plan = planVrac();
    appliquerTri(plan, tri(false), aTrier);
    const avant = JSON.stringify(versJson(plan));
    expect(appliquerTri(plan, tri(false), aTrier)).toBeNull();
    expect(JSON.stringify(versJson(plan))).toBe(avant);
    appliquerTri(plan, tri(true), aTrier);
    const noms = [...plan.dossiers.values()].filter((d) => d.origine === 'tri').map((d) => d.nom).sort();
    expect(noms).toEqual(['Bangkok_11.07.26', 'Bangkok_12.07.26', 'Kanchanaburi_13.07.26']);
  });

  it('un dossier homonyme d’une autre origine n’est jamais mélangé', () => {
    const plan = planVrac();
    plan.dossiers.set('n99', { id: 'n99', nom: 'Bangkok_11-12.07.26', parent: RACINE, origine: 'cree' });
    appliquerTri(plan, tri(false), aTrier);
    expect(ou(plan, 'a.jpg')).toBe('Bangkok_11-12.07.26_2');
    expect(appliquerTri(plan, tri(false), aTrier)).toBeNull();
  });

  it('une seule opération annulable', () => {
    const plan = planVrac();
    // Contenu du plan indépendamment de l'ordre d'insertion des Map.
    const etat = (p: Plan) => {
      const j = versJson(p);
      return JSON.stringify([j.prochainId, [...j.dossiers].sort((a, b) => a.id.localeCompare(b.id)), [...j.fichiers].sort((a, b) => a.id.localeCompare(b.id))]);
    };
    const avant = etat(plan);
    const h = new Historique();
    h.enregistrer(appliquerTri(plan, tri(false), aTrier));
    h.annuler(plan);
    expect(etat(plan)).toBe(avant);
    h.retablir(plan);
    expect(ou(plan, 'a.jpg')).toBe('Bangkok_11-12.07.26');
  });
});

describe('vidéos rangées avec les photos du même moment (§ 12)', () => {
  it('à quelques heures près, sinon dans _videos_non_classees', async () => {
    const { rangerVideos } = await import('../src/lib/tri');
    const dossiers = [
      { chemin: ['Plage_2026-07-18'], photos: ['p1', 'p2'], info: { origine: 'gps' as const } },
      { chemin: ['Temple_2026-07-19'], photos: ['p3'], info: { origine: 'gps' as const } },
    ];
    const dates = new Map([
      ['p1', '2026-07-18T10:00:00'],
      ['p2', '2026-07-18T16:00:00'],
      ['p3', '2026-07-19T09:00:00'],
    ]);
    const r = rangerVideos(dossiers, dates, [
      { id: 'v1', date: '2026-07-18T17:30:00' },
      { id: 'v2', date: '2026-07-19T07:00:00' },
      { id: 'v3', date: '2026-07-25T12:00:00' },
      { id: 'v4' },
    ]);
    expect(r[0].photos).toEqual(['p1', 'p2', 'v1']);
    expect(r[1].photos).toEqual(['p3', 'v2']);
    expect(r.slice(2).map((d) => [d.chemin.join('/'), d.photos])).toEqual([
      ['_videos_non_classees/2026-07', ['v3']],
      ['_videos_non_classees/sans_date', ['v4']],
    ]);
    expect(dossiers[0].photos).toEqual(['p1', 'p2']);
  });
});

describe('suggestion de lieux connus (§ 6.4)', () => {
  it('un endroit photographié sur de nombreux jours, hors des lieux déjà connus', async () => {
    const { lieuxFrequents } = await import('../src/lib/tri');
    const photos = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, nom: `m${i}.jpg`, date: `2025-0${i + 1}-10T10:00:00`, gps: { lat: 46.8, lon: 6.6 + i * 0.00001 } })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, nom: `v${i}.jpg`, date: `2025-07-1${i}T10:00:00`, gps: { lat: 47.5, lon: 7.5 } })),
      { id: 'x', nom: 'x.jpg', date: '2025-08-01T10:00:00', gps: { lat: 45, lon: 6 } },
    ];
    const r = lieuxFrequents(photos, []);
    expect(r.map((l) => l.jours)).toEqual([6, 6]);
    const connus = [{ id: 'ecole', nom: 'Ecole', lat: 47.5, lon: 7.5, rayon_m: 100, domicile: false, un_seul_dossier: false, notes: '' }];
    const restants = lieuxFrequents(photos, connus);
    expect(restants).toHaveLength(1);
    expect(restants[0].lat).toBeCloseTo(46.8, 3);
  });
});

describe('photos sans date (date du fichier seulement)', () => {
  it('ne sont pas rangées d’après la date du fichier : elles vont dans « _sans_date »', async () => {
    const { separerSansDate, avecSansDate } = await import('../src/lib/tri');
    const { nomsSortie } = await import('../src/lib/sortie');
    const f = [
      { id: 'a', origineDate: 'exif' },
      { id: 'b', origineDate: 'fichier' },
      { id: 'c', origineDate: 'nom' },
    ];
    const { datees, sansDate } = separerSansDate(f);
    expect(datees.map((x) => x.id)).toEqual(['a', 'c']);
    expect(sansDate.map((x) => x.id)).toEqual(['b']);
    expect(avecSansDate([], ['b'])).toEqual([{ chemin: [nomsSortie().sansDate], photos: ['b'], info: { origine: 'sans_lieu' } }]);
    expect(avecSansDate([], [])).toEqual([]);
  });
});

describe('le calendrier sépare les événements dans un lieu connu (D88)', () => {
  const maison = lieu('Maison', 46.5, 6.6, 200, { domicile: true });
  const evt = (titre: string, debut: string, fin: string, extra: Partial<EvenementCalendrier> = {}): EvenementCalendrier => ({ titre, debut, fin, journee: true, recurrent: false, ...extra });
  // Une photo chaque jour du 9 au 26 décembre, trois les 24, 25 et 26.
  const decembre = () => {
    const ps: PhotoTri[] = [];
    for (let j = 9; j <= 26; j++) for (let k = 0; k < (j >= 24 ? 3 : 1); k++) ps.push(photo(`2025-12-${String(j).padStart(2, '0')}T1${k}:00:00`, 46.5, 6.6));
    return ps;
  };
  const noel = evt('Noel', '2025-12-24', '2025-12-26');

  it('un sous-dossier de plus de 3 jours : l’événement forme son propre sous-dossier, nommé par ses dates', () => {
    const ps = decembre();
    const d = arborescence(grouper(ps, [maison], O()), new Map(), O(), [noel]);
    expect(chemins(d)).toEqual({ 'Maison/09-23.12.25': 15, 'Maison/24-26.12.25': 9 });
    expect(d.find((x) => x.chemin[1] === '24-26.12.25')?.evenement).toBe('Noel');
    // Sans calendrier, l'option décochée, par jour ou par mois : rien ne change.
    const sans = chemins(arborescence(grouper(ps, [maison], O()), new Map(), O()));
    expect(sans).toEqual({ 'Maison/09-26.12.25': 24 });
    expect(chemins(arborescence(grouper(ps, [maison], O()), new Map(), O({ calendrierLieuxConnus: false }), [noel]))).toEqual(sans);
    expect(Object.keys(chemins(arborescence(grouper(ps, [maison], O()), new Map(), O({ parMois: true }), [noel])))).toEqual(['Maison/12.25']);
  });

  it('ni sous-dossier de 3 jours ou moins, ni événement récurrent, de plus de 21 jours ou de moins de 5 photos', () => {
    const ps = decembre();
    const g = grouper(ps, [maison], O());
    const intact = { 'Maison/09-26.12.25': 24 };
    expect(chemins(arborescence(g, new Map(), O(), [{ ...noel, recurrent: true }]))).toEqual(intact);
    expect(chemins(arborescence(g, new Map(), O(), [evt('Vacances', '2025-12-01', '2026-01-04')]))).toEqual(intact);
    expect(chemins(arborescence(g, new Map(), O(), [evt('Rendez-vous', '2025-12-12', '2025-12-13')]))).toEqual(intact);
    const court = ps.filter((p) => p.date!.startsWith('2025-12-2'));
    expect(chemins(arborescence(grouper(court, [maison], O()), new Map(), O(), [noel]))).toEqual({ 'Maison/20-26.12.25': 13 });
    const troisJours = ps.filter((p) => p.date! >= '2025-12-24');
    expect(chemins(arborescence(grouper(troisJours, [maison], O()), new Map(), O(), [evt('Fete', '2025-12-25', '2025-12-25')]))).toEqual({ 'Maison/24-26.12.25': 9 });
  });

  it('quelques photos isolées entre deux événements rejoignent le morceau le plus proche', () => {
    // Trois photos les 20 et 21 (le sapin), une les 22 et 23, trois du 24 au 26 (Noël).
    const ps: PhotoTri[] = [];
    for (const [j, n] of [[20, 3], [21, 3], [22, 1], [23, 1], [24, 3], [25, 3], [26, 3]]) for (let k = 0; k < n; k++) ps.push(photo(`2025-12-${j}T1${k}:00:00`, 46.5, 6.6));
    const d = arborescence(grouper(ps, [maison], O()), new Map(), O(), [noel, evt('Sapin', '2025-12-20', '2025-12-21')]);
    // Les 22 et 23 (deux photos) rejoignent le sapin, plus proche que Noël ; aucune photo ne se perd.
    expect(chemins(d)).toEqual({ 'Maison/20-23.12.25': 8, 'Maison/24-26.12.25': 9 });
    // Moins de 5 photos pendant le sapin : il ne forme rien, ces photos rejoignent Noël.
    expect(chemins(arborescence(grouper(ps.slice(4), [maison], O()), new Map(), O(), [noel, evt('Sapin', '2025-12-20', '2025-12-21')]))).toEqual({ 'Maison/21-26.12.25': 13 });
  });
});

