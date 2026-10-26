import { describe, expect, it } from 'vitest';
import type { LieuConnu } from '../src/lib/config';
import type { EvenementCalendrier } from '../src/lib/ics';
import { Historique, planVide, RACINE, versJson, type FichierPlan, type Plan } from '../src/lib/plan';
import {
  appliquerTri,
  arborescence,
  dateDeNom,
  decouper,
  distanceM,
  estDossierMois,
  grouper,
  moisDeNom,
  nomDescriptif,
  nomDossierLibre,
  nomDominant,
  OPTIONS_TRI_DEFAUT,
  optionsDuProjet,
  pointsANommer,
  sansDate,
  type OptionsTri,
  type PhotoTri,
} from '../src/lib/tri';

/** Degrés de latitude pour une distance en km (rayon terrestre du script). */
const km = (d: number) => d / ((6371.0088 * Math.PI) / 180);
const O = (o: Partial<OptionsTri> = {}): OptionsTri => ({ ...OPTIONS_TRI_DEFAUT, ...o });
/** Réglages du regroupement GPS (lieux fréquents). */
const G = (rayonKm = 2, lieuxConnus = true) => ({ rayonKm, lieuxConnus });

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

describe('regroupement GPS (lieux fréquents)', () => {
  it('DBSCAN en chaîne : A–B–C à 1,5 km forment un seul groupe à 2 km, trois à 1 km', () => {
    const ps = [photo('2026-01-01T10:00:00', 46.5, 6.6), photo('2026-01-01T11:00:00', 46.5 + km(1.5), 6.6), photo('2026-01-01T12:00:00', 46.5 + km(3), 6.6)];
    const g = grouper(ps, [], G());
    expect(g.groupes).toHaveLength(1);
    expect(g.groupes[0].lat).toBeCloseTo(46.5 + km(1.5), 6);
    expect(grouper(ps, [], G(1)).groupes).toHaveLength(3);
  });

  it('5000 photos regroupées en moins d’une seconde (grille, pas de comparaison de toutes les paires)', () => {
    let graine = 1;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const ps = Array.from({ length: 5000 }, (_, i) => photo(`2026-01-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00`, 46 + hasard() * 0.5, 6.5 + hasard() * 0.7));
    const debut = performance.now();
    const g = grouper(ps, [], G());
    expect(performance.now() - debut).toBeLessThan(1000);
    expect(g.groupeDe.size).toBe(5000);
  });

  it('lieu connu le plus proche, et domicile explicite (D19)', () => {
    const gp = lieu('Grands_Parents', 46.5, 6.6, 500);
    const maison = lieu('Maison', 46.5 + km(0.3), 6.6, 500, { domicile: true });
    const ps = [photo('2026-01-01', 46.5 + km(0.25), 6.6), photo('2026-01-01', 46.5 + km(0.05), 6.6), photo('2026-01-01', 47, 7)];
    const g = grouper(ps, [gp, maison], G());
    expect(ps.map((p) => g.lieuDe.get(p.id)?.id ?? null)).toEqual(['Maison', 'Grands_Parents', null]);
    expect(g.domicile?.id).toBe('Maison');
    expect(grouper(ps, [gp, maison], G(2, false)).lieuDe.size).toBe(0);
  });
});

// Géographie inventée : la maison, un parc à 10 km au nord, un lac à 20 km au sud, une route à 30 km ; au loin, Paris, Reims, Lille, Annecy.
const MAISON = lieu('Maison', 45, 5, 300, { domicile: true });
const PARC = { lat: 45 + km(10), lon: 5 };
const LAC = { lat: 45 - km(20), lon: 5 };
const ROUTE = { lat: 45 + km(30), lon: 5 };
const PARIS = { lat: 48.8584, lon: 2.2945 };
const REIMS = { lat: 49.25, lon: 4.03 };
const LILLE = { lat: 50.63, lon: 3.06 };
const ANNECY = { lat: 45.9, lon: 6.13 };
const VILLES: [string, { lat: number; lon: number }][] = [
  ['Parc', PARC],
  ['Lac', LAC],
  ['Route', ROUTE],
  ['Paris', PARIS],
  ['Reims', REIMS],
  ['Lille', LILLE],
  ['Annecy', ANNECY],
];
/** Géocodage simulé : la ville à moins de 15 km. */
const nomDe = (lat: number, lon: number) => VILLES.find(([, v]) => distanceM(lat, lon, v.lat, v.lon) < 15_000)?.[0] ?? null;
const a = (date: string, p?: { lat: number; lon: number }, nom?: string) => photo(date, p?.lat, p?.lon, nom);
const chez = (date: string, nom?: string) => photo(date, MAISON.lat, MAISON.lon, nom);
const sortes = (ps: PhotoTri[], lieux: LieuConnu[] = [MAISON], o: OptionsTri = O()) => decouper(ps, lieux, o).morceaux.map((m) => `${m.sorte}:${m.photos.length}`);
const arbre = (ps: PhotoTri[], lieux: LieuConnu[] = [MAISON], o: OptionsTri = O(), evts: EvenementCalendrier[] = []) => arborescence(decouper(ps, lieux, o), nomDe, o, evts);

describe('découpage chronologique (D103)', () => {
  it('un moment s’arrête après 3 h sans photo : deux endroits à 3 h 30 d’écart font deux sorties', () => {
    expect(sortes([a('2026-03-14T10:00:00', PARC), a('2026-03-14T12:30:00', LAC)])).toEqual(['sortie:2']);
    expect(sortes([a('2026-03-14T10:00:00', PARC), a('2026-03-14T13:30:00', LAC)])).toEqual(['sortie:1', 'sortie:1']);
  });

  it('un moment s’arrête au passage de la maison au dehors, même sans trou', () => {
    const ps = [chez('2026-03-14T10:00:00'), a('2026-03-14T10:30:00', PARC), chez('2026-03-14T11:00:00')];
    expect(sortes(ps)).toEqual(['maison:2', 'sortie:1']);
  });

  it('voyage : loin de la maison sur deux jours sans y revenir ; les photos sur la route en font partie', () => {
    const ps = [
      chez('2026-03-14T08:00:00'),
      a('2026-03-14T14:00:00', PARIS),
      a('2026-03-14T15:00:00', PARIS),
      a('2026-03-14T16:00:00', PARIS),
      a('2026-03-14T20:00:00', ROUTE),
      a('2026-03-15T10:00:00', PARIS),
      a('2026-03-15T11:00:00', PARIS),
      chez('2026-03-16T09:00:00'),
    ];
    const d = decouper(ps, [MAISON]);
    expect(d.morceaux.map((m) => `${m.sorte}:${m.photos.length}`)).toEqual(['maison:2', 'voyage:6']);
    expect(d.morceaux[1]).toMatchObject({ du: '2026-03-14', au: '2026-03-15' });
    // Plus loin que la distance réglée seulement : à 1000 km, ce ne sont que des sorties.
    expect(sortes(ps, [MAISON], O({ distanceVoyageKm: 1000 }))).not.toContain('voyage:6');
  });

  it('pas de voyage avec une photo à la maison entre deux journées au loin, ni sur une seule journée', () => {
    const rentre = [a('2026-03-14T14:00:00', PARIS), chez('2026-03-14T23:00:00'), a('2026-03-15T10:00:00', PARIS)];
    expect(sortes(rentre)).toEqual(['sortie:1', 'maison:1', 'sortie:1']);
    const journee = [a('2026-03-14T10:00:00', PARIS), a('2026-03-14T18:00:00', PARIS)];
    expect(sortes(journee)).toEqual(['sortie:2']);
  });

  it('étapes par lieu : un petit arrêt rejoint l’étape la plus proche dans le temps', () => {
    const ps = [
      ...[14, 15, 16].map((h) => a(`2026-03-14T${h}:00:00`, PARIS)),
      a('2026-03-15T09:00:00', REIMS),
      ...[14, 15, 16].map((h) => a(`2026-03-15T${h}:00:00`, LILLE)),
    ];
    const [voyage] = decouper(ps, [MAISON]).morceaux;
    expect(voyage.sorte).toBe('voyage');
    expect(voyage.etapes!.map((e) => e.photos.length)).toEqual([3, 4]);
    // Nommé d'après sa plus grande étape ; un sous-dossier par étape.
    expect(chemins(arbre(ps))).toEqual({ 'Voyage_Lille_14-15.03.26/Paris_14.03.26': 3, 'Voyage_Lille_14-15.03.26/Lille_15.03.26': 4 });
    const etape = arbre(ps)[0];
    expect(etape).toMatchObject({ sorte: 'voyage', info: { origine: 'etape', lieu: 'Paris' }, infoParent: { origine: 'voyage', lieu: 'Lille' } });
    // Sans étapes : tout dans un seul dossier.
    const seul = arbre(ps, [MAISON], O({ etapes: false }));
    expect(chemins(seul)).toEqual({ 'Voyage_Lille_14-15.03.26': 7 });
    expect(seul[0].info).toEqual({ origine: 'voyage', lieu: 'Lille' });
  });

  it('une seule étape : pas de sous-dossier', () => {
    const ps = [a('2026-03-14T14:00:00', PARIS), a('2026-03-15T10:00:00', PARIS)];
    expect(chemins(arbre(ps))).toEqual({ 'Voyage_Paris_14-15.03.26': 2 });
  });

  it('le même endroit le lendemain, sans retour à la maison, reste la même sortie', () => {
    const ps = [a('2026-03-14T10:00:00', LAC), a('2026-03-15T10:00:00', LAC)];
    expect(chemins(arbre(ps))).toEqual({ 'Lac_14-15.03.26': 2 });
    const rentre = [a('2026-03-14T10:00:00', LAC), chez('2026-03-14T20:00:00'), a('2026-03-15T10:00:00', LAC)];
    expect(Object.keys(chemins(arbre(rentre)))).toEqual(['Lac_14.03.26', 'Maison/03.26', 'Lac_15.03.26']);
  });

  it('la maison par mois ; une journée d’au moins 10 photos à part, réunie avec la suivante (Noël)', () => {
    const ps = [
      chez('2025-12-01T10:00:00'),
      chez('2025-12-10T10:00:00'),
      ...Array.from({ length: 10 }, (_, i) => chez(`2025-12-24T${String(8 + i).padStart(2, '0')}:00:00`)),
      ...Array.from({ length: 12 }, (_, i) => chez(`2025-12-25T${String(8 + i).padStart(2, '0')}:00:00`)),
      chez('2025-12-28T10:00:00'),
      chez('2026-01-03T10:00:00'),
    ];
    const d = arbre(ps);
    expect(chemins(d)).toEqual({ 'Maison/12.25': 3, 'Maison/24-25.12.25': 22, 'Maison/01.26': 1 });
    expect(d[0]).toMatchObject({ sorte: 'maison', info: { origine: 'lieu_connu', lieu: 'Maison' }, infoParent: { origine: 'lieu_connu', lieu: 'Maison' } });
    // Une journée chargée nommée à la main garde son nom devant la date.
    const anniv = Array.from({ length: 10 }, (_, i) => chez(`2025-11-08T${String(8 + i).padStart(2, '0')}:00:00`, `Anniversaire Lea (${i}).jpg`));
    expect(Object.keys(chemins(arbre(anniv)))).toEqual(['Maison/Anniversaire_Lea_08.11.25']);
    // Le domicile « un seul dossier » : tout à plat.
    expect(chemins(arbre(ps, [{ ...MAISON, un_seul_dossier: true }]))).toEqual({ Maison: 26 });
  });

  it('la maison par semaine (D104) : du lundi au dimanche, nommée par les jours de ses photos', () => {
    // Mardi 2, jeudi 4 et lundi 8 décembre 2025.
    const ps = [chez('2025-12-02T10:00:00'), chez('2025-12-04T10:00:00'), chez('2025-12-08T10:00:00')];
    expect(chemins(arbre(ps, [MAISON], O({ maison: 'semaine' })))).toEqual({ 'Maison/02-04.12.25': 2, 'Maison/08.12.25': 1 });
    expect(chemins(arbre(ps))).toEqual({ 'Maison/12.25': 3 });
  });

  it('distance de la maison et nom provisoire, pour l’écran (D104)', () => {
    const ps = [
      a('2026-03-10T10:00:00', PARC),
      ...[14, 15, 16].map((h) => a(`2026-03-14T${h}:00:00`, PARIS)),
      ...[14, 15, 16, 17].map((h) => a(`2026-03-15T${h}:00:00`, LILLE)),
    ];
    const kmDe = (l: { lat: number; lon: number }) => Math.round(distanceM(l.lat, l.lon, MAISON.lat, MAISON.lon) / 1000);
    const [parc, paris, lille] = arbre(ps);
    expect([parc.km, paris.km, lille.km]).toEqual([kmDe(PARC), kmDe(PARIS), kmDe(LILLE)]);
    // Un voyage d'un seul dossier : la distance de sa plus lointaine étape.
    expect(arbre(ps, [MAISON], O({ etapes: false }))[1].km).toBe(Math.max(kmDe(PARIS), kmDe(LILLE)));
    expect(arbre(ps).some((x) => x.nomProvisoire)).toBe(false);
    // Hors ligne : « Lieu_01 »… est signalé provisoire.
    const sans = arborescence(decouper(ps, [MAISON]), () => null);
    expect(sans.map((x) => !!x.nomProvisoire)).toEqual([true, true, true]);
  });

  it('une photo sans GPS rejoint le moment voisin du même jour ; seule ce jour-là, elle fait une sortie sans lieu', () => {
    const ps = [a('2026-03-14T10:00:00', PARC), a('2026-03-14T14:30:00'), a('2026-03-20T10:00:00')];
    expect(chemins(arbre(ps))).toEqual({ 'Parc_14.03.26': 2, 'Sans_lieu_20.03.26': 1 });
    expect(arbre(ps)[1]).toMatchObject({ sorte: 'sans_lieu', info: { origine: 'sans_lieu' } });
    // À la maison, une photo sans GPS reste à la maison.
    expect(chemins(arbre([chez('2026-03-14T10:00:00'), a('2026-03-14T15:00:00')]))).toEqual({ 'Maison/03.26': 2 });
  });

  it('sans domicile : ni maison ni voyage, tout en sorties', () => {
    const ps = [chez('2026-03-14T10:00:00'), a('2026-03-15T14:00:00', PARIS), a('2026-03-16T10:00:00', PARIS)];
    expect(sortes(ps, [])).toEqual(['sortie:1', 'sortie:2']);
    expect(sortes(ps, [MAISON], O({ lieuxConnus: false }))).toEqual(['sortie:1', 'sortie:2']);
  });

  it('un lieu connu autre que le domicile nomme la sortie ; « un seul dossier » réunit toutes les visites', () => {
    const club = lieu('Club', LAC.lat, LAC.lon, 500);
    const ps = [a('2026-03-14T10:00:00', LAC), a('2026-04-18T10:00:00', LAC)];
    expect(Object.keys(chemins(arbre(ps, [MAISON, club])))).toEqual(['Club_14.03.26', 'Club_18.04.26']);
    // Un lieu connu n'est pas demandé à OpenStreetMap.
    expect(pointsANommer(decouper(ps, [MAISON, club]))).toEqual([]);
    const d = arbre(ps, [MAISON, { ...club, un_seul_dossier: true }]);
    expect(chemins(d)).toEqual({ Club: 2 });
    expect(d[0]).toMatchObject({ du: '2026-03-14', au: '2026-04-18', info: { origine: 'lieu_connu', lieu: 'Club' } });
  });

  it('noms : nom donné à la main, sans répéter le lieu ; lieu sans nom ; noms uniques', () => {
    const fete = [a('2026-03-14T10:00:00', PARC, 'Fete de Lea.jpg'), a('2026-03-14T11:00:00', PARC, 'Fete de Lea (2).jpg')];
    expect(Object.keys(chemins(arbre(fete)))).toEqual(['Fete_de_Lea_Parc_14.03.26']);
    expect(Object.keys(chemins(arbre(fete, [MAISON], O({ nomsFichiers: false }))))).toEqual(['Parc_14.03.26']);
    const parc = [a('2026-03-14T10:00:00', PARC, 'Parc du chateau.jpg')];
    expect(Object.keys(chemins(arbre(parc)))).toEqual(['Parc_du_chateau_14.03.26']);
    // Le même nom le même jour (deux endroits que le géocodage nomme pareil) : _b.
    const memes = arborescence(decouper([a('2026-03-14T08:00:00', PARC), a('2026-03-14T18:00:00', LAC)], [MAISON]), () => 'Lyon');
    expect(memes.map((x) => x.chemin.join('/'))).toEqual(['Lyon_14.03.26', 'Lyon_14.03.26_b']);
    // Pas de nom (hors ligne) : Lieu_01, Lieu_02, un par endroit.
    const sans = arborescence(decouper([a('2026-03-14T08:00:00', PARC), a('2026-03-14T18:00:00', LAC), a('2026-03-20T08:00:00', PARC)], [MAISON]), () => null);
    expect(sans.map((x) => x.chemin.join('/'))).toEqual(['Lieu_01_14.03.26', 'Lieu_02_14.03.26', 'Lieu_01_20.03.26']);
  });

  it('l’événement du calendrier pendant lequel la moitié des photos ont été prises se montre, sans rien découper', () => {
    const evt = (titre: string, debut: string, fin: string, extra: Partial<EvenementCalendrier> = {}): EvenementCalendrier => ({ titre, debut, fin, journee: true, recurrent: false, ...extra });
    const ps = [a('2026-03-14T10:00:00', LAC), a('2026-03-15T10:00:00', LAC)];
    expect(arbre(ps, [MAISON], O(), [evt('Week-end au lac', '2026-03-14', '2026-03-15')])[0].evenement).toBe('Week-end au lac');
    expect(arbre(ps, [MAISON], O(), [evt('Sortie', '2026-03-15', '2026-03-15')])[0].evenement).toBe('Sortie');
    expect(arbre(ps, [MAISON], O(), [evt('Cours', '2026-03-14', '2026-03-15', { recurrent: true })])[0].evenement).toBeUndefined();
    expect(chemins(arbre(ps, [MAISON], O(), [evt('Week-end au lac', '2026-03-14', '2026-03-15')]))).toEqual(chemins(arbre(ps)));
  });

  it('points à nommer : sorties, étapes (ou la plus grande seulement), sans doublon', () => {
    const ps = [
      a('2026-03-10T10:00:00', PARC),
      a('2026-03-10T11:00:00', PARC),
      ...[14, 15, 16].map((h) => a(`2026-03-14T${h}:00:00`, PARIS)),
      ...[14, 15, 16, 17].map((h) => a(`2026-03-15T${h}:00:00`, LILLE)),
    ];
    const d = decouper(ps, [MAISON]);
    const noms = (o: OptionsTri) => pointsANommer(d, o).map((p) => nomDe(p.lat, p.lon));
    expect(noms(O())).toEqual(['Parc', 'Paris', 'Lille']);
    expect(noms(O({ etapes: false }))).toEqual(['Parc', 'Lille']);
  });

  it('une année de photos découpée et nommée en moins d’une demi-seconde', () => {
    let graine = 7;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const ps: PhotoTri[] = [];
    for (let j = 0; j < 365; j++) {
      const jour = new Date(Date.UTC(2025, 0, 1) + j * 86_400_000).toISOString().slice(0, 10);
      const ou = hasard() < 0.7 ? MAISON : hasard() < 0.5 ? PARC : PARIS;
      for (let k = 0; k < 10; k++) ps.push(a(`${jour}T${String(8 + k).padStart(2, '0')}:00:00`, { lat: ou.lat + hasard() * 0.001, lon: ou.lon }));
    }
    const debut = performance.now();
    const d = decouper(ps, [MAISON]);
    arborescence(d, nomDe);
    expect(performance.now() - debut).toBeLessThan(500);
    expect(d.morceaux.reduce((s, m) => s + m.photos.length, 0)).toBe(ps.length);
  });
});

describe('réglages enregistrés (optionsDuProjet)', () => {
  it('étapes cochées par défaut ; l’ancienne distance de 30 km devient 50 ; les anciens réglages sont ignorés', () => {
    expect(optionsDuProjet(undefined)).toEqual(OPTIONS_TRI_DEFAUT);
    expect(optionsDuProjet({ distanceVoyageKm: 30 }).distanceVoyageKm).toBe(50);
    expect(optionsDuProjet({ distanceVoyageKm: 80, etapes: false, rayonKm: 5, parMois: true, dureeMaxJours: 3 })).toEqual({ ...OPTIONS_TRI_DEFAUT, etapes: false, distanceVoyageKm: 80 });
    expect(optionsDuProjet({ maison: 'semaine' }).maison).toBe('semaine');
    expect(optionsDuProjet({ maison: 'jour' }).maison).toBe('mois');
    expect(optionsDuProjet({ distanceVoyageKm: -1, etapes: 'oui' })).toEqual(OPTIONS_TRI_DEFAUT);
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
  // Sans domicile : deux jours de suite au même endroit font une sortie, la photo floue sans GPS suit son heure.
  const ps: PhotoTri[] = [
    { id: 'a.jpg', nom: 'a.jpg', date: '2026-07-11T10:00:00', gps: { lat: 13.75, lon: 100.5 } },
    { id: 'Juillet/b.jpg', nom: 'b.jpg', date: '2026-07-12T10:00:00', gps: { lat: 13.75, lon: 100.5 } },
    { id: 'Juillet/c.jpg', nom: 'c.jpg', date: '2026-07-13T10:00:00', gps: { lat: 14.02, lon: 99.53 } },
    { id: 'Juillet/flou.jpg', nom: 'IMG_0004.jpg', date: '2026-07-13T11:00:00' },
  ];
  const tri = (bangkok = 'Bangkok') => arborescence(decouper(ps, []), (lat) => (lat < 13.9 ? bangkok : 'Kanchanaburi'));
  const aTrier = new Set(['a.jpg', 'Juillet/b.jpg', 'Juillet/c.jpg', 'Juillet/flou.jpg']);
  const ou = (plan: Plan, id: string) => {
    const f = plan.fichiers.get(id)!;
    const d = plan.dossiers.get(f.dossier)!;
    return d.parent === null ? '' : d.nom;
  };

  it('crée les dossiers, range les photos, supprime les dossiers à trier vidés', () => {
    const plan = planVrac();
    const m = appliquerTri(plan, tri(), aTrier);
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
    appliquerTri(plan, tri(), aTrier);
    const avant = JSON.stringify(versJson(plan));
    expect(appliquerTri(plan, tri(), aTrier)).toBeNull();
    expect(JSON.stringify(versJson(plan))).toBe(avant);
    appliquerTri(plan, tri('Krung_Thep'), aTrier);
    const noms = [...plan.dossiers.values()].filter((d) => d.origine === 'tri').map((d) => d.nom).sort();
    expect(noms).toEqual(['Kanchanaburi_13.07.26', 'Krung_Thep_11-12.07.26']);
  });

  it('un dossier homonyme d’une autre origine n’est jamais mélangé', () => {
    const plan = planVrac();
    plan.dossiers.set('n99', { id: 'n99', nom: 'Bangkok_11-12.07.26', parent: RACINE, origine: 'cree' });
    appliquerTri(plan, tri(), aTrier);
    expect(ou(plan, 'a.jpg')).toBe('Bangkok_11-12.07.26_2');
    expect(appliquerTri(plan, tri(), aTrier)).toBeNull();
  });

  it('voyage avec ses étapes : un dossier parent et un sous-dossier par étape', () => {
    const plan = planVrac();
    const etapes = [
      ...[14, 15, 16].map((h) => a(`2026-03-14T${h}:00:00`, PARIS)),
      ...[14, 15, 16].map((h) => a(`2026-03-15T${h}:00:00`, LILLE)),
    ];
    for (const p of etapes) plan.fichiers.set(p.id, { id: p.id, nom: p.nom, taille: 1, modifie: 0, categorie: 'photo', date: p.date, origineDate: 'exif', dossier: RACINE, statut: 'archive' });
    appliquerTri(plan, arbre(etapes), new Set(etapes.map((p) => p.id)));
    const parent = [...plan.dossiers.values()].find((d) => d.nom === 'Voyage_Paris_14-15.03.26')!;
    expect(parent).toMatchObject({ parent: RACINE, origine: 'tri', tri: { origine: 'voyage', lieu: 'Paris' } });
    expect([...plan.dossiers.values()].filter((d) => d.parent === parent.id).map((d) => d.nom)).toEqual(['Paris_14.03.26', 'Lille_15.03.26']);
  });

  it('une seule opération annulable', () => {
    const plan = planVrac();
    // Contenu du plan indépendamment de l'ordre d'insertion des Map.
    const etat = (p: Plan) => {
      const j = versJson(p);
      return JSON.stringify([j.prochainId, [...j.dossiers].sort((x, y) => x.id.localeCompare(y.id)), [...j.fichiers].sort((x, y) => x.id.localeCompare(y.id))]);
    };
    const avant = etat(plan);
    const h = new Historique();
    h.enregistrer(appliquerTri(plan, tri(), aTrier));
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
      { chemin: ['Plage_2026-07-18'], photos: ['p1', 'p2'], info: { origine: 'gps' as const }, sorte: 'sortie' as const },
      { chemin: ['Temple_2026-07-19'], photos: ['p3'], info: { origine: 'gps' as const }, sorte: 'sortie' as const },
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
    expect(r.slice(2).map((d) => [d.chemin.join('/'), d.photos, d.sorte])).toEqual([
      ['_videos_non_classees/2026-07', ['v3'], 'sans_lieu'],
      ['_videos_non_classees/sans_date', ['v4'], 'sans_lieu'],
    ]);
    expect(dossiers[0].photos).toEqual(['p1', 'p2']);
  });

  it('arborescence complète : photos, vidéos du même moment, éléments sans date à part', async () => {
    const { arborescenceComplete, elementsATrier } = await import('../src/lib/tri');
    const e = elementsATrier([
      { id: 'x/p1.jpg', categorie: 'photo', date: '2026-03-14T10:00:00', origineDate: 'exif', gps: PARC },
      { id: 'x/v1.mp4', categorie: 'video', date: '2026-03-14T11:00:00', origineDate: 'exif' },
      { id: 'x/p2.jpg', categorie: 'photo', date: '2026-02-01T10:00:00', origineDate: 'fichier' },
    ]);
    expect(chemins(arborescenceComplete(e, decouper(e.photos, [MAISON]), nomDe, O()))).toEqual({ 'Parc_14.03.26': 2, _sans_date: 1 });
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
    expect(avecSansDate([], ['b'])).toEqual([{ chemin: [nomsSortie().sansDate], photos: ['b'], info: { origine: 'sans_lieu' }, sorte: 'sans_lieu' }]);
    expect(avecSansDate([], [])).toEqual([]);
  });
});
