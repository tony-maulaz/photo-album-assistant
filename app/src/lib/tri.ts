// Tri par voyages, sorties et maison (étape « Tri automatique », SPEC § 6.4).
// D103 : la chronologie d'abord. Les photos dans l'ordre du temps forment des
// moments (pas de trou de plus de 3 h, pas de passage maison ↔ dehors) ; les
// moments loin de la maison qui s'enchaînent sans retour font un voyage, avec
// une étape par lieu ; les autres moments dehors sont des sorties ; à la
// maison, un dossier par mois et un par journée chargée. Le calendrier ne
// découpe rien : il donne seulement un titre à montrer. Noms tirés des
// fichiers nommés à la main, des lieux connus et du géocodage, fait ailleurs
// (Nominatim) : les noms arrivent ici déjà trouvés, tout se teste sans réseau.

import type { LieuConnu } from './config';
import { evenementDesPhotos, evenementsUtiles, joursEvenement, type EvenementCalendrier } from './ics';
import { t } from './langue';
import { cleNom, nomAscii } from './noms';
import { avecDetail, combiner, deplacerFichiers, RACINE, Transaction, type DossierPlan, type InfoTri, type Modification, type Plan } from './plan';
import { nomsSortie } from './sortie';

/**
 * Réglages du tri (D103, D104) : les étapes d'un voyage, la distance d'un
 * voyage (en crans à l'écran) et la maison par mois ou par semaine. Le reste
 * est fixe (constantes ci-dessous), mesuré sur une année réelle : le résultat
 * bouge à peine entre 2 et 4 h de trou ou entre 8 et 15 photos par journée.
 */
export interface OptionsTri {
  /** Un voyage de plusieurs jours : un sous-dossier par étape (true, conseillé) ou tout dans un seul dossier. */
  etapes: boolean;
  /** Distance au domicile (km) au-delà de laquelle une absence de plusieurs jours est un voyage. */
  distanceVoyageKm: number;
  /** À la maison, un dossier par mois (conseillé) ou par semaine (D104). */
  maison: 'mois' | 'semaine';
  /** Nomme les dossiers d'après les fichiers nommés à la main. */
  nomsFichiers: boolean;
  /** Utilise les lieux connus de la configuration. */
  lieuxConnus: boolean;
}

export const OPTIONS_TRI_DEFAUT: OptionsTri = { etapes: true, distanceVoyageKm: 50, maison: 'mois', nomsFichiers: true, lieuxConnus: true };

/** 30 km : l'ancienne distance par défaut d'un voyage, enregistrée dans les projets sans avoir été choisie (D87). */
const ANCIENNE_DISTANCE_VOYAGE = 30;

/**
 * Réglages enregistrés d'un projet : les étapes (cochées par défaut) et la
 * distance d'un voyage ; l'ancienne distance par défaut laisse place à la
 * nouvelle. Les réglages du tri d'avant D103 (rayon, durée d'une sortie, par
 * jour ou par mois, calendrier) n'ont plus d'effet et sont ignorés.
 */
export function optionsDuProjet(enregistrees: unknown): OptionsTri {
  const x = (typeof enregistrees === 'object' && enregistrees !== null ? enregistrees : {}) as Partial<Record<keyof OptionsTri, unknown>>;
  const d = OPTIONS_TRI_DEFAUT;
  const distance = typeof x.distanceVoyageKm === 'number' && Number.isFinite(x.distanceVoyageKm) && x.distanceVoyageKm > 0 ? x.distanceVoyageKm : d.distanceVoyageKm;
  return {
    ...d,
    etapes: typeof x.etapes === 'boolean' ? x.etapes : d.etapes,
    distanceVoyageKm: distance === ANCIENNE_DISTANCE_VOYAGE ? d.distanceVoyageKm : distance,
    maison: x.maison === 'semaine' ? 'semaine' : 'mois',
  };
}

// ---------------------------------------------------------------------------
// Briques du script 01
// ---------------------------------------------------------------------------

/** Rayon terrestre moyen du script 01 (`EARTH_RADIUS_KM`). */
export const RAYON_TERRE_KM = 6371.0088;

/** Distance haversine en mètres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dlat = (lat2 - lat1) * rad;
  const dlon = (lon2 - lon1) * rad;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dlon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * 1000 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** `sanitize` du script 01 : `nomAscii`, ou « Lieu_inconnu » s'il ne reste rien. */
export function sanitize(nom: string): string {
  return nomAscii(nom) || nomsSortie().lieuInconnu;
}

/** Noms générés par les appareils et applications : ils ne décrivent rien (script 01). */
const GENERIQUES = [
  /^img[-_ ]?\d+/,
  /^dsc[nf]?[-_ ]?\d+/,
  /^dscf?\d+/,
  /^pxl[-_ ]?\d+/,
  /^p\d{7,}/,
  /^gopr\d+/,
  /^mvimg/,
  /^pano/,
  /^burst\d*/,
  /^\d{4}[-_]?\d{2}[-_]?\d{2}/,
  /^\d{6,}$/,
  /^(photo|image|img|foto|picture|pic)[-_ ]?\d*$/,
  /^(screenshot|capture|capture[-_ ]d.ecran)/,
  /^whatsapp/,
  /^(signal|telegram|messenger|snapchat|facebook|instagram)/,
  /^(copie|copy|edited|modifi)/,
  /^(vlc|snapshot)/,
  /^videocapture/,
  /^untitled/,
  /^recadr/,
  /^scan\d*$/,
  /^lrm?_?\d+/,
  /^resized/,
];

/** Nom sans sa dernière extension (`Path.stem`). */
function radical(nomFichier: string): string {
  const nom = nomFichier.slice(nomFichier.lastIndexOf('/') + 1);
  const i = nom.lastIndexOf('.');
  return i > 0 ? nom.slice(0, i) : nom;
}

/**
 * Nom exploitable si le fichier a été nommé à la main, sinon `null`, sans sa
 * date : « Anniversaire Lea.jpg » → « Anniversaire_Lea » ;
 * « Plage_27-29.06.25_3.jpg » → « Plage » ; « IMG_2043.jpg » → `null`.
 */
export function nomDescriptif(nomFichier: string): string | null {
  let base = radical(nomFichier).trim();
  // Retire un suffixe de duplication : (1), -2, _copie.
  base = base.replace(/[\s_-]*\(\d+\)$/, '');
  if (base.length > 6) base = base.replace(/[\s_-]+\d{1,2}$/, '');
  const n = base.toLowerCase();
  if (GENERIQUES.some((motif) => motif.test(n))) return null;
  // Trop peu de lettres pour décrire quoi que ce soit, ou nom à rallonge.
  if ((base.match(/\p{L}/gu) ?? []).length < 4) return null;
  if (base.length > 60) return null;
  // La date se retire avant `sanitize`, qui en ôte les points : sinon
  // « Ville_25-26.07.25 » donnait « Ville_25 », et les fichiers d'un même
  // lieu pris des jours différents comptaient chacun pour un nom.
  return sanitize(sansDate(base));
}

const MOTIFS_DATE = [
  /[_\-. ]\d{1,2}[-–]\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/, // 27-29.06.25
  /[_\-. ]\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/, // 09.06.25 / 9-6-2025
  /[_\-. ]\d{1,2}[.-]\d{4}$/, // 05.2025
  /[_\-. ]\d{4}[-_]\d{2}([-_]\d{2})?$/, // 2025-06-09
  /[_\-. ]\d{6,8}$/, // 090625 / 20250609
];

/** Retire une date en fin de description, pour ne pas la dupliquer (« Jardin_11.07.25 » → « Jardin »). */
export function sansDate(desc: string): string {
  let d = desc;
  // Deux passes : « …_09.06.25_2 », etc.
  for (let passe = 0; passe < 2; passe++) for (const m of MOTIFS_DATE) d = d.replace(m, '');
  return d.replace(/^[_\-. ]+|[_\-. ]+$/g, '') || d;
}

/** Nom descriptif le plus fréquent parmi des noms de fichiers ; à égalité, le plus long. */
export function nomDominant(nomsFichiers: string[]): string | null {
  const compte = new Map<string, number>();
  for (const nom of nomsFichiers) {
    const d = nomDescriptif(nom);
    if (d) compte.set(d, (compte.get(d) ?? 0) + 1);
  }
  let meilleur: [string, number] | null = null;
  for (const [d, n] of compte) {
    if (!meilleur || n > meilleur[1] || (n === meilleur[1] && d.length > meilleur[0].length)) meilleur = [d, n];
  }
  return meilleur?.[0] ?? null;
}

/** Noms de mois, en français et en anglais (dossiers d'un utilisateur anglophone, D60). */
const MOIS = new Set([
  ...['janvier', 'fevrier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'août', 'septembre', 'octobre', 'novembre', 'decembre', 'décembre'],
  ...['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
]);

/** Dossier de mois (« 01_janvier », « 2025-01 janvier », « 03 March ») ou nom listé dans `extra`. */
export function estDossierMois(nom: string, extra: string[] = []): boolean {
  const n = nom.trim().toLowerCase();
  if (extra.some((x) => x.trim().toLowerCase() === n)) return true;
  return MOIS.has(n.replace(/^[\d\-_. ]+/, ''));
}

// ---------------------------------------------------------------------------
// Regroupement GPS (DBSCAN haversine) : il formait les dossiers avant D103 ;
// il sert encore à repérer les lieux fréquents à enregistrer.
// ---------------------------------------------------------------------------

export interface PhotoTri {
  id: string;
  /** Nom de fichier, pour les noms descriptifs. */
  nom: string;
  /** Prise de vue, heure locale : « AAAA-MM-JJTHH:MM:SS » ou « AAAA-MM-JJ ». */
  date?: string;
  gps?: { lat: number; lon: number };
}

export interface GroupeGps {
  /** Numéro du groupe (étiquette DBSCAN : ordre de la première photo). */
  index: number;
  /** Centroïde, à géocoder. */
  lat: number;
  lon: number;
  /** Photos avec GPS du groupe. */
  n: number;
}

export interface Groupes {
  /** Toutes les photos, dans l'ordre reçu. */
  photos: PhotoTri[];
  /** Photo dans le rayon d'un lieu connu → ce lieu (ou sans GPS, prise un jour passé surtout là). */
  lieuDe: Map<string, LieuConnu>;
  /** Photo → groupe GPS (avec GPS, ou rattachée au groupe du même jour). */
  groupeDe: Map<string, number>;
  groupes: GroupeGps[];
  /** Domicile explicite (D19), ou `null` : pas de passe voyages. */
  domicile: LieuConnu | null;
}

/** Composantes connexes à distance ≤ `rayonM` (DBSCAN, `min_samples=1`), avec une grille pour aller vite. */
function composantesGps(points: { lat: number; lon: number }[], rayonM: number): number[] {
  const parent = points.map((_, i) => i);
  const trouver = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const unir = (a: number, b: number) => {
    const ra = trouver(a);
    const rb = trouver(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  // Cellules d'au moins le rayon de côté : deux points proches sont dans des cellules voisines.
  const pasLat = (rayonM / (RAYON_TERRE_KM * 1000)) * (180 / Math.PI);
  const latMax = Math.max(0, ...points.map((p) => Math.abs(p.lat)));
  const pasLon = pasLat / Math.max(0.01, Math.cos(Math.min(89.9, latMax + pasLat) * (Math.PI / 180)));
  const cellules = new Map<string, number[]>();
  const cle = (i: number, j: number) => `${i}|${j}`;
  points.forEach((p, k) => {
    const c = cle(Math.floor(p.lat / pasLat), Math.floor(p.lon / pasLon));
    cellules.set(c, [...(cellules.get(c) ?? []), k]);
  });
  points.forEach((p, k) => {
    const ci = Math.floor(p.lat / pasLat);
    const cj = Math.floor(p.lon / pasLon);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const m of cellules.get(cle(ci + di, cj + dj)) ?? []) {
          if (m > k && distanceM(p.lat, p.lon, points[m].lat, points[m].lon) <= rayonM) unir(k, m);
        }
      }
    }
  });
  // Étiquettes dans l'ordre de la première photo de chaque groupe, comme scikit-learn.
  const etiquette = new Map<number, number>();
  return points.map((_, k) => {
    const r = trouver(k);
    if (!etiquette.has(r)) etiquette.set(r, etiquette.size);
    return etiquette.get(r)!;
  });
}

const jourDe = (date?: string) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null);

/**
 * Instant d'une date locale (sans fuseau, pour éviter les changements
 * d'heure), en ms. Une date sans heure compte pour midi : à minuit, des
 * photos datées du jour seulement prolongeaient le voyage de l'avant-veille
 * (D103).
 */
function instant(date?: string): number | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0), +(m[6] ?? 0));
}

/**
 * Regroupement du script 01 : chaque photo avec GPS dans le rayon du lieu
 * connu le plus proche lui est rattachée ; les autres forment des groupes
 * (DBSCAN haversine) ; une photo sans GPS rejoint le lieu le plus fréquent
 * de sa journée, lieu connu compris (D87 : une journée à la maison n'envoie
 * plus ses photos sans GPS dans `Sans_lieu`).
 */
export function grouper(photos: PhotoTri[], lieux: LieuConnu[], o: { rayonKm: number; lieuxConnus: boolean } = { rayonKm: 2, lieuxConnus: true }): Groupes {
  const actifs = o.lieuxConnus ? lieux : [];
  const lieuDe = new Map<string, LieuConnu>();
  const avecGps: PhotoTri[] = [];
  for (const p of photos) {
    if (!p.gps) continue;
    if (actifs.length) {
      // Le lieu le plus proche seulement (à égalité, le premier par nom), comme le script.
      let proche: { d: number; l: LieuConnu } | null = null;
      for (const l of actifs) {
        const d = distanceM(p.gps.lat, p.gps.lon, l.lat, l.lon);
        if (!proche || d < proche.d || (d === proche.d && sanitize(l.nom) < sanitize(proche.l.nom))) proche = { d, l };
      }
      if (proche && proche.d <= proche.l.rayon_m) {
        lieuDe.set(p.id, proche.l);
        continue;
      }
    }
    avecGps.push(p);
  }

  const etiquettes = composantesGps(
    avecGps.map((p) => p.gps!),
    o.rayonKm * 1000,
  );
  const groupeDe = new Map<string, number>();
  const sommes: { lat: number; lon: number; n: number }[] = [];
  avecGps.forEach((p, k) => {
    const e = etiquettes[k];
    groupeDe.set(p.id, e);
    sommes[e] ??= { lat: 0, lon: 0, n: 0 };
    sommes[e].lat += p.gps!.lat;
    sommes[e].lon += p.gps!.lon;
    sommes[e].n++;
  });
  const groupes = sommes.map((s, index) => ({ index, lat: s.lat / s.n, lon: s.lon / s.n, n: s.n }));

  // Photos sans GPS : le lieu le plus fréquent de la journée, groupe GPS ou lieu connu (le premier vu à égalité).
  const parJour = new Map<string, Map<number | LieuConnu, number>>();
  for (const p of photos) {
    const ou = lieuDe.get(p.id) ?? groupeDe.get(p.id);
    const j = jourDe(p.date);
    if (ou === undefined || !j) continue;
    const c = parJour.get(j) ?? new Map<number | LieuConnu, number>();
    c.set(ou, (c.get(ou) ?? 0) + 1);
    parJour.set(j, c);
  }
  for (const p of photos) {
    if (p.gps) continue;
    const c = parJour.get(jourDe(p.date) ?? '');
    if (!c) continue;
    let meilleur: [number | LieuConnu, number] | null = null;
    for (const [ou, n] of c) if (!meilleur || n > meilleur[1]) meilleur = [ou, n];
    const ou = meilleur![0];
    if (typeof ou === 'number') groupeDe.set(p.id, ou);
    else lieuDe.set(p.id, ou);
  }

  return { photos, lieuDe, groupeDe, groupes, domicile: actifs.find((l) => l.domicile) ?? null };
}

// ---------------------------------------------------------------------------
// Découpage chronologique (D103)
// ---------------------------------------------------------------------------

/** Trou (heures) entre deux photos qui sépare deux moments. */
export const TROU_MOMENT_H = 3;
/** Écart maximal (heures) entre deux moments loin d'un même voyage : une nuit dehors. */
const NUIT_VOYAGE_H = 36;
/** Le même endroit (à 5 km près) le lendemain, sans retour à la maison entre-temps : la même sortie. */
const MEME_LIEU_KM = 5;
/** Une journée d'au moins 10 photos à la maison forme son propre dossier (Noël, un anniversaire). */
export const PHOTOS_JOURNEE_CHARGEE = 10;
/** Étapes d'un voyage : les endroits à moins de 10 km sont réunis ; un moment de moins de 3 photos suit l'étape voisine. */
const RAYON_ETAPE_KM = 10;
const PHOTOS_MIN_ETAPE = 3;

const H_MS = 3_600_000;
const JOUR_MS = 86_400_000;
const deux = (n: number) => String(n).padStart(2, '0');

/** Ce que le découpage forme, avant les noms : un voyage (avec ses étapes), une sortie, ou une période à la maison. */
export interface Morceau {
  sorte: 'voyage' | 'sortie' | 'maison';
  /** Triées par date. */
  photos: PhotoTri[];
  /** Premier et dernier jour (AAAA-MM-JJ). */
  du: string;
  au: string;
  /** Centre des photos situées (absent si aucune). */
  lat?: number;
  lon?: number;
  /** Sortie (ou étape) dans un lieu connu autre que le domicile. */
  lieuConnu?: LieuConnu;
  /** Voyage : ses étapes (sorte « sortie »), dans l'ordre du temps, toujours calculées. */
  etapes?: Morceau[];
  /** Maison : journée(s) chargée(s) plutôt qu'un mois ou une semaine. */
  journee?: boolean;
}

export interface Decoupage {
  morceaux: Morceau[];
  domicile: LieuConnu | null;
}

interface Moment {
  photos: PhotoTri[];
  t1: number;
  t2: number;
  /** Au domicile (la majorité de ses photos situées), ou sans aucune position avant rattachement. */
  maison: boolean;
  situe: boolean;
  lat: number;
  lon: number;
  /** Distance maximale au domicile (km), 0 sans domicile. */
  distMax: number;
  lieuConnu?: LieuConnu;
}

const kmEntre = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceM(a.lat, a.lon, b.lat, b.lon) / 1000;

/** Centre des photos situées, ou `null`. */
function centre(photos: PhotoTri[]): { lat: number; lon: number } | null {
  const g = photos.filter((p) => p.gps);
  if (!g.length) return null;
  return { lat: g.reduce((s, p) => s + p.gps!.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.gps!.lon, 0) / g.length };
}

/** Le lieu connu le plus fréquent parmi des photos, s'il en réunit plus de la moitié des situées. */
function lieuMajoritaire(photos: PhotoTri[], lieuDe: Map<PhotoTri, LieuConnu>, sauf: LieuConnu | null): LieuConnu | undefined {
  const situees = photos.filter((p) => p.gps).length;
  const compte = new Map<LieuConnu, number>();
  for (const p of photos) {
    const l = lieuDe.get(p);
    if (l && l !== sauf) compte.set(l, (compte.get(l) ?? 0) + 1);
  }
  let meilleur: [LieuConnu, number] | undefined;
  for (const x of compte) if (!meilleur || x[1] > meilleur[1]) meilleur = x;
  return meilleur && meilleur[1] * 2 > situees ? meilleur[0] : undefined;
}

/** Morceau fait de photos (triées par date). */
function morceau(sorte: Morceau['sorte'], photos: PhotoTri[], lieuDe: Map<PhotoTri, LieuConnu>, domicile: LieuConnu | null, extra: Partial<Morceau> = {}): Morceau {
  const c = centre(photos);
  const lc = sorte === 'maison' ? undefined : lieuMajoritaire(photos, lieuDe, domicile);
  return { sorte, photos, du: jourDe(photos[0].date)!, au: jourDe(photos.at(-1)!.date)!, ...(c ?? {}), ...(lc ? { lieuConnu: lc } : {}), ...extra };
}

/**
 * Découpage du tri (D103), sans noms ni réseau, pour des photos datées :
 * 1. dans l'ordre du temps, un moment s'arrête après 3 h sans photo ou au
 *    passage de la maison (le domicile) au dehors ; une photo sans GPS suit
 *    son heure. Un moment sans aucune photo située rejoint le moment voisin
 *    du même jour, sinon il devient une sortie sans lieu ;
 * 2. des moments à plus de `distanceVoyageKm` de la maison qui s'enchaînent
 *    (36 h au plus entre deux, aucune photo prise à la maison entre eux), sur
 *    au moins deux jours, font un voyage : tout ce qui est pris entre le
 *    premier et le dernier en fait partie, photos sur la route comprises ;
 * 3. les autres moments dehors sont des sorties ; le même endroit le
 *    lendemain, sans retour à la maison, reste la même sortie. Un lieu connu
 *    autre que le domicile (des proches, le club) est « dehors » : il nomme
 *    la sortie ;
 * 4. à la maison, un dossier par mois (ou par semaine, du lundi au
 *    dimanche, D104) ; une journée d'au moins 10 photos
 *    forme le sien, réuni avec les journées chargées qui la suivent (Noël,
 *    les 24 et 25).
 * Sans domicile, ni maison ni voyage : tout devient sortie.
 */
export function decouper(photos: PhotoTri[], lieux: LieuConnu[], o: OptionsTri = OPTIONS_TRI_DEFAUT): Decoupage {
  const actifs = o.lieuxConnus ? lieux : [];
  const domicile = actifs.find((l) => l.domicile) ?? null;
  const lieuDe = new Map<PhotoTri, LieuConnu>();
  for (const p of photos) {
    if (!p.gps || !actifs.length) continue;
    // Le lieu le plus proche seulement (à égalité, le premier par nom), comme `grouper`.
    let proche: { d: number; l: LieuConnu } | null = null;
    for (const l of actifs) {
      const d = distanceM(p.gps.lat, p.gps.lon, l.lat, l.lon);
      if (!proche || d < proche.d || (d === proche.d && sanitize(l.nom) < sanitize(proche.l.nom))) proche = { d, l };
    }
    if (proche && proche.d <= proche.l.rayon_m) lieuDe.set(p, proche.l);
  }
  const chezSoi = (p: PhotoTri) => !!domicile && lieuDe.get(p) === domicile;
  const datees = photos.filter((p) => instant(p.date) !== null).sort((a, b) => instant(a.date)! - instant(b.date)! || a.id.localeCompare(b.id));

  // 1. Moments. Une photo sans GPS garde l'état (maison ou dehors) de la dernière photo située.
  const suites: PhotoTri[][] = [];
  let etat: boolean | null = null;
  for (const p of datees) {
    const m = suites.at(-1);
    const e: boolean | null = p.gps ? chezSoi(p) : etat;
    let coupe = !m || instant(p.date)! - instant(m.at(-1)!.date)! > TROU_MOMENT_H * H_MS;
    if (!coupe && p.gps && etat !== null && e !== etat) coupe = true;
    if (coupe) suites.push([p]);
    else m!.push(p);
    if (p.gps) etat = e;
  }
  const momentDe = (ps: PhotoTri[]): Moment => {
    const g = ps.filter((p) => p.gps);
    const c = centre(g);
    return {
      photos: ps,
      t1: instant(ps[0].date)!,
      t2: instant(ps.at(-1)!.date)!,
      maison: g.length ? g.filter(chezSoi).length * 2 > g.length : true,
      situe: g.length > 0,
      lat: c?.lat ?? 0,
      lon: c?.lon ?? 0,
      distMax: domicile && g.length ? Math.max(...g.map((p) => kmEntre(p.gps!, domicile))) : 0,
      lieuConnu: lieuMajoritaire(g, lieuDe, domicile),
    };
  };
  const ms = suites.map(momentDe);

  // 1b. Un moment sans aucune photo située rejoint le moment situé voisin du même jour, le plus proche dans le temps.
  for (let k = 0; k < ms.length; k++) {
    const m = ms[k];
    if (m.situe) continue;
    const jour = jourDe(m.photos[0].date);
    const ecart = (x: Moment) => Math.min(Math.abs(x.t1 - m.t2), Math.abs(m.t1 - x.t2));
    const voisins = [ms[k - 1], ms[k + 1]].filter((x) => x && x.situe && x.photos.some((p) => jourDe(p.date) === jour)).sort((a, b) => ecart(a) - ecart(b));
    if (!voisins.length) {
      m.maison = false; // une sortie sans lieu
      continue;
    }
    const v = voisins[0];
    v.photos = [...v.photos, ...m.photos].sort((a, b) => instant(a.date)! - instant(b.date)!);
    v.t1 = Math.min(v.t1, m.t1);
    v.t2 = Math.max(v.t2, m.t2);
    ms.splice(k, 1);
    k--;
  }

  // 2. Voyages : moments loin qui s'enchaînent, sans moment situé à la maison entre eux, sur au moins deux jours.
  const loin = (m: Moment) => m.situe && !m.maison && m.distMax > o.distanceVoyageKm;
  const jourNo = (t: number) => Math.floor(t / JOUR_MS);
  const voyageDe = new Set<Moment>();
  const voyages: Moment[][] = [];
  for (let i = 0; i < ms.length; ) {
    if (!loin(ms[i])) {
      i++;
      continue;
    }
    let fin = i;
    for (let k = i + 1; k < ms.length; k++) {
      if ((ms[k].maison && ms[k].situe) || ms[k].t1 - ms[fin].t2 > NUIT_VOYAGE_H * H_MS) break;
      if (loin(ms[k])) fin = k;
    }
    if (jourNo(ms[fin].t2) > jourNo(ms[i].t1)) {
      const v = ms.slice(i, fin + 1);
      voyages.push(v);
      for (const m of v) voyageDe.add(m);
      i = fin + 1;
    } else i++;
  }

  // 3. Sorties, et moments à la maison.
  const sorties: { moments: Moment[]; dernier: number }[] = [];
  const maisons: Moment[] = [];
  ms.forEach((m, k) => {
    if (voyageDe.has(m)) return;
    if (m.maison) {
      maisons.push(m);
      return;
    }
    const s = sorties.at(-1);
    const der = s ? ms[s.dernier] : null;
    const rentre = () => ms.slice(s!.dernier + 1, k).some((x) => x.maison && x.situe);
    if (s && der && m.situe && der.situe && kmEntre(m, der) <= MEME_LIEU_KM && m.t1 - der.t2 <= JOUR_MS && !rentre()) {
      s.moments.push(m);
      s.dernier = k;
    } else sorties.push({ moments: [m], dernier: k });
  });

  const morceaux: Morceau[] = [];
  for (const v of voyages) {
    const ps = v.flatMap((m) => m.photos);
    const etapes = etapesDuVoyage(v).map((e) => ({ ...morceau('sortie', e.photos, lieuDe, domicile), ...(centre(e.coeur) ?? {}) }));
    morceaux.push(morceau('voyage', ps, lieuDe, domicile, { etapes }));
  }
  for (const s of sorties) morceaux.push(morceau('sortie', s.moments.flatMap((m) => m.photos), lieuDe, domicile));

  // 4. Maison : par mois (ou par semaine), et les journées chargées à part (celles qui se suivent ensemble).
  const parJour = new Map<string, number>();
  for (const m of maisons) for (const p of m.photos) parJour.set(jourDe(p.date)!, (parJour.get(jourDe(p.date)!) ?? 0) + 1);
  const chargee = (j: string) => (parJour.get(j) ?? 0) >= PHOTOS_JOURNEE_CHARGEE;
  const veille = (j: string) => new Date(Date.parse(`${j}T12:00:00Z`) - JOUR_MS).toISOString().slice(0, 10);
  const lundi = (j: string) => {
    const t = Date.parse(`${j}T12:00:00Z`);
    return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * JOUR_MS).toISOString().slice(0, 10);
  };
  const periodes = new Map<string, { photos: PhotoTri[]; journee: boolean }>();
  for (const m of maisons) {
    const j = jourDe(m.photos[0].date)!;
    let cle = o.maison === 'semaine' ? `S${lundi(j)}` : j.slice(0, 7);
    if (chargee(j)) {
      let debut = j;
      while (chargee(veille(debut))) debut = veille(debut);
      cle = `J${debut}`;
    }
    const x = periodes.get(cle) ?? { photos: [], journee: cle.startsWith('J') };
    x.photos.push(...m.photos);
    periodes.set(cle, x);
  }
  for (const x of periodes.values()) morceaux.push(morceau('maison', x.photos, lieuDe, domicile, x.journee ? { journee: true } : {}));

  morceaux.sort((a, b) => instant(a.photos[0].date)! - instant(b.photos[0].date)!);
  return { morceaux, domicile };
}

/**
 * Étapes d'un voyage, par lieu : les moments situés d'au moins 3 photos à
 * moins de 10 km l'un de l'autre (de proche en proche) font une étape ; un
 * moment plus petit ou sans position rejoint l'étape du moment situé le plus
 * proche dans le temps. Dans l'ordre de leur première photo. `coeur` : les
 * photos de ses moments d'au moins 3 photos, qui la situent (un arrêt sur la
 * route ne déplace pas son centre, donc son nom).
 */
function etapesDuVoyage(v: Moment[]): { photos: PhotoTri[]; coeur: PhotoTri[] }[] {
  const situes = v.filter((m) => m.situe && m.photos.length >= PHOTOS_MIN_ETAPE);
  const parent = situes.map((_, a) => a);
  const racine = (a: number): number => (parent[a] === a ? a : (parent[a] = racine(parent[a])));
  for (let a = 0; a < situes.length; a++) for (let b = a + 1; b < situes.length; b++) if (kmEntre(situes[a], situes[b]) <= RAYON_ETAPE_KM) parent[racine(b)] = racine(a);
  const groupe = new Map<Moment, number>();
  situes.forEach((m, a) => groupe.set(m, racine(a)));
  const parLieu = new Map<number, { photos: PhotoTri[]; coeur: PhotoTri[] }>();
  for (const m of v) {
    let g = groupe.get(m);
    const coeur = g !== undefined;
    if (g === undefined) {
      let proche: { d: number; m: Moment } | null = null;
      for (const x of situes) {
        const d = Math.min(Math.abs(x.t1 - m.t2), Math.abs(m.t1 - x.t2));
        if (!proche || d < proche.d) proche = { d, m: x };
      }
      g = proche ? groupe.get(proche.m)! : -1;
    }
    const e = parLieu.get(g) ?? { photos: [], coeur: [] };
    e.photos.push(...m.photos);
    if (coeur || g === -1) e.coeur.push(...m.photos);
    parLieu.set(g, e);
  }
  const parDate = (a: PhotoTri, b: PhotoTri) => instant(a.date)! - instant(b.date)!;
  return [...parLieu.values()].map((e) => ({ photos: e.photos.sort(parDate), coeur: e.coeur })).sort((a, b) => parDate(a.photos[0], b.photos[0]));
}

/** L'étape d'un voyage qui a le plus de photos (la première à égalité) : elle nomme le voyage. */
function etapePrincipale(m: Morceau): Morceau {
  return (m.etapes ?? [m]).reduce((a, b) => (b.photos.length > a.photos.length ? b : a));
}

/**
 * Points à nommer par OpenStreetMap : le centre de chaque sortie située hors
 * d'un lieu connu, et pour un voyage celui de chaque étape (avec `o.etapes`)
 * ou de sa plus grande étape seulement, qui le nomme (le centre d'un voyage
 * entier tombe entre ses étapes). Sans doublon.
 */
export function pointsANommer(d: Decoupage, o: OptionsTri = OPTIONS_TRI_DEFAUT): { lat: number; lon: number }[] {
  const points = new Map<string, { lat: number; lon: number }>();
  const ajouter = (m: Morceau) => {
    if (m.lat === undefined || m.lon === undefined || m.lieuConnu) return;
    points.set(`${m.lat},${m.lon}`, { lat: m.lat, lon: m.lon });
  };
  for (const m of d.morceaux) {
    if (m.sorte === 'sortie') ajouter(m);
    else if (m.sorte === 'voyage') (o.etapes ? (m.etapes ?? []) : [etapePrincipale(m)]).forEach(ajouter);
  }
  return [...points.values()];
}

// ---------------------------------------------------------------------------
// Arborescence : noms et chemins (D103)
// ---------------------------------------------------------------------------

export interface DossierPropose {
  /** Parties du chemin sous `Photos/` : [dossier] ou [parent, sous-dossier]. */
  chemin: string[];
  photos: string[];
  info: InfoTri;
  /** Ce qu'est le dossier parent quand le chemin a deux parties (voyage, domicile). */
  infoParent?: InfoTri;
  /** Ce que le dossier est pour l'écran du tri (D103). */
  sorte: 'voyage' | 'sortie' | 'maison' | 'sans_lieu';
  /** Premier et dernier jour (AAAA-MM-JJ). */
  du?: string;
  au?: string;
  /** Distance de la maison (km, arrondie) : du centre d'une sortie ou d'une étape, de la plus lointaine étape d'un voyage. */
  km?: number;
  /** Le nom contient un lieu pas encore nommé par OpenStreetMap (« Lieu_01 ») : l'écran ne le montre pas tel quel (D104). */
  nomProvisoire?: boolean;
  /**
   * Titre de l'événement du calendrier (pas récurrent, 21 jours au plus)
   * pendant lequel au moins la moitié des photos ont été prises : il se montre,
   * il ne découpe rien (D103) ; le nom se choisit au Nommage.
   */
  evenement?: string;
}

/**
 * Arborescence proposée (D103), dans l'ordre du temps :
 * - une sortie : `[desc_]Lieu_JJ.MM.AA` (le lieu connu, sinon le nom
 *   géocodé, sinon « Lieu_01 »…) ; dans un lieu connu « un seul dossier »,
 *   le dossier du lieu ; sans aucune photo située, `Sans_lieu_JJ.MM.AA` ;
 * - la maison : `Domicile/MM.AA` (par semaine : `Domicile/JJ-JJ.MM.AA`, les
 *   jours de ses photos), une journée chargée `Domicile/JJ.MM.AA`
 *   (précédée d'un nom de fichier parlant) ;
 * - un voyage : `Voyage_<lieu de sa plus grande étape>_<dates>/`, avec un
 *   sous-dossier par étape (`o.etapes`, dès deux étapes) ou tout dedans.
 * `nom(lat, lon)` : nom géocodé d'un point de `pointsANommer`.
 */
export function arborescence(d: Decoupage, nom: (lat: number, lon: number) => string | null | undefined, o: OptionsTri = OPTIONS_TRI_DEFAUT, evts: EvenementCalendrier[] = []): DossierPropose[] {
  const s = nomsSortie();
  const nomsPoints = new Map<string, string>();
  const provisoires = new Set<string>();
  let anonymes = 0;
  const lieuNom = (m: Morceau): string => {
    if (m.lieuConnu) return sanitize(m.lieuConnu.nom);
    if (m.lat === undefined || m.lon === undefined) return s.sansLieu;
    const cle = `${m.lat},${m.lon}`;
    if (!nomsPoints.has(cle)) {
      const n = nom(m.lat, m.lon);
      if (!n) provisoires.add(`${s.lieu}_${deux(anonymes + 1)}`);
      nomsPoints.set(cle, n ? sanitize(n) : `${s.lieu}_${deux(++anonymes)}`);
    }
    return nomsPoints.get(cle)!;
  };
  // Si des photos ont un nom donné à la main, il décrit la sortie (sans répéter le lieu ni la date).
  const desc = (m: Morceau) => (o.nomsFichiers ? nomDominant(m.photos.map((p) => p.nom)) : null);
  const nomDe = (m: Morceau, lieu: string) => {
    const x = desc(m);
    const date = dateDeNom(m.du, m.au);
    return x ? (x.toLowerCase().includes(lieu.toLowerCase()) ? `${x}_${date}` : `${x}_${lieu}_${date}`) : `${lieu}_${date}`;
  };

  // Les dossiers d'un lieu (domicile, lieu connu « un seul dossier ») gardent leur nom ; les autres noms du premier niveau sont uniques.
  const haut = new Set<string>(d.domicile ? [sanitize(d.domicile.nom)] : []);
  for (const m of d.morceaux) if (m.lieuConnu?.un_seul_dossier) haut.add(sanitize(m.lieuConnu.nom));
  const sousDossiers = new Map<string, Set<string>>();
  const unique = (parent: string, base: string) => {
    if (!sousDossiers.has(parent)) sousDossiers.set(parent, new Set());
    return nomUnique(base, sousDossiers.get(parent)!);
  };

  /** Distance de la maison et nom provisoire d'un morceau, d'après les lieux de son nom. */
  const enPlus = (m: Morceau, ...lieux: string[]): Pick<DossierPropose, 'km' | 'nomProvisoire'> => ({
    ...(d.domicile && m.lat !== undefined && m.lon !== undefined ? { km: Math.round(kmEntre({ lat: m.lat, lon: m.lon }, d.domicile)) } : {}),
    ...(lieux.some((l) => provisoires.has(l)) ? { nomProvisoire: true } : {}),
  });
  const proposes: DossierPropose[] = [];
  const ajouter = (m: Morceau, x: Omit<DossierPropose, 'photos' | 'du' | 'au'>) => proposes.push({ ...x, photos: m.photos.map((p) => p.id), du: m.du, au: m.au });
  for (const m of d.morceaux) {
    if (m.sorte === 'maison' && d.domicile) {
      const dom = d.domicile;
      const nomDom = sanitize(dom.nom);
      const info: InfoTri = { origine: 'lieu_connu', lieu: dom.nom, lat: dom.lat, lon: dom.lon };
      if (dom.un_seul_dossier) ajouter(m, { chemin: [nomDom], info, sorte: 'maison' });
      else {
        const x = m.journee ? desc(m) : null;
        const sous = m.journee ? (x ? `${x}_${dateDeNom(m.du, m.au)}` : dateDeNom(m.du, m.au)) : o.maison === 'semaine' ? dateDeNom(m.du, m.au) : moisDeNom(m.du.slice(0, 7));
        ajouter(m, { chemin: [nomDom, unique(nomDom, sous)], info, infoParent: info, sorte: 'maison' });
      }
    } else if (m.sorte === 'voyage') {
      const etapes = m.etapes?.length ? m.etapes : [m];
      const principal = lieuNom(etapePrincipale(m));
      const parent = nomUnique(`${s.voyage}_${principal}_${dateDeNom(m.du, m.au)}`, haut);
      const infoParent: InfoTri = { origine: 'voyage', lieu: principal };
      if (o.etapes && etapes.length > 1) {
        for (const e of etapes) {
          const lieu = lieuNom(e);
          ajouter(e, { chemin: [parent, unique(parent, nomDe(e, lieu))], info: { origine: 'etape', lieu, lat: e.lat, lon: e.lon }, infoParent, sorte: 'voyage', ...enPlus(e, principal, lieu) });
        }
      } else {
        const loin = Math.max(...etapes.map((e) => enPlus(e).km ?? 0));
        ajouter(m, { chemin: [parent], info: { ...infoParent }, sorte: 'voyage', ...enPlus(m, principal), ...(d.domicile ? { km: loin } : {}) });
      }
    } else if (m.lieuConnu?.un_seul_dossier) {
      const l = m.lieuConnu;
      ajouter(m, { chemin: [sanitize(l.nom)], info: { origine: 'lieu_connu', lieu: l.nom, lat: l.lat, lon: l.lon }, sorte: 'sortie' });
    } else if (m.lat === undefined) {
      const x = desc(m);
      ajouter(m, { chemin: [nomUnique(`${x ?? s.sansLieu}_${dateDeNom(m.du, m.au)}`, haut)], info: { origine: 'sans_lieu' }, sorte: 'sans_lieu' });
    } else {
      // Sortie (ou photos à la maison sans domicile enregistré : il n'y en a pas, tout est dehors).
      const lieu = lieuNom(m);
      ajouter(m, { chemin: [nomUnique(nomDe(m, lieu), haut)], info: { origine: 'gps', lieu, lat: m.lat, lon: m.lon }, sorte: 'sortie', ...enPlus(m, lieu) });
    }
  }

  // Un même chemin (lieu « un seul dossier ») ne fait qu'un dossier ; l'événement se lit sur le dossier entier.
  const dates = new Map(d.morceaux.flatMap((m) => m.photos.map((p) => [p.id, p.date!] as const)));
  const utiles = evenementsUtiles(evts);
  const parChemin = new Map<string, DossierPropose>();
  for (const x of proposes) {
    const cle = x.chemin.join('/');
    const y = parChemin.get(cle);
    if (!y) parChemin.set(cle, x);
    else {
      y.photos.push(...x.photos);
      if (x.du! < y.du!) y.du = x.du;
      if (x.au! > y.au!) y.au = x.au;
    }
  }
  const resultat = [...parChemin.values()];
  for (const x of resultat) {
    // Seuls les événements qui chevauchent le dossier : un calendrier familial en compte des milliers.
    const pendant = utiles.filter((e) => {
      const [d1, d2] = joursEvenement(e);
      return d1 <= x.au! && d2 >= x.du!;
    });
    const e = pendant.length ? evenementDesPhotos(pendant, x.photos.map((id) => dates.get(id)!)) : null;
    if (e) x.evenement = e.evenement.titre;
  }
  return resultat;
}

/**
 * Date d'un nom de dossier, comme les dossiers nommés par la famille
 * (Theme_Lieu_JJ.MM.AA) : « 22.11.25 » pour une journée, « 27-29.06.25 »
 * dans un même mois, « 28.06-02.07.25 », ou « 28.12.25-02.01.26 » d'une année
 * à l'autre. `du` et `au` : « AAAA-MM-JJ ».
 */
export function dateDeNom(du: string, au = du): string {
  const j = (d: string) => d.slice(8, 10);
  const m = (d: string) => d.slice(5, 7);
  const a = (d: string) => d.slice(2, 4);
  if (du === au) return `${j(du)}.${m(du)}.${a(du)}`;
  if (du.slice(0, 7) === au.slice(0, 7)) return `${j(du)}-${j(au)}.${m(du)}.${a(du)}`;
  if (du.slice(0, 4) === au.slice(0, 4)) return `${j(du)}.${m(du)}-${j(au)}.${m(au)}.${a(au)}`;
  return `${j(du)}.${m(du)}.${a(du)}-${j(au)}.${m(au)}.${a(au)}`;
}

/** Mois d'un nom de dossier (option « un dossier par mois ») : « 2025-11 » → « 11.25 ». */
export function moisDeNom(mois: string): string {
  return `${mois.slice(5, 7)}.${mois.slice(2, 4)}`;
}

/**
 * Nom de dossier libre parmi `pris` (clés `cleNom`) : `nom`, sinon `nom_2`,
 * `nom_3`… Contrairement à `nomLibre` (noms de fichiers), le point d'une date
 * (« Lausanne_12.01.26 ») n'y est pas pris pour une extension.
 */
export function nomDossierLibre(nom: string, pris: Set<string>): string {
  let candidat = nom;
  for (let n = 2; pris.has(cleNom(candidat)); n++) candidat = `${nom}_${n}`;
  return candidat;
}

/** `base`, sinon `base_b`, `base_c`… (registre `utilises`). */
function nomUnique(base: string, utilises: Set<string>): string {
  let nom = base;
  // _b … _z comme le script, puis _27, _28… (jamais de caractère interdit par Windows).
  for (let n = 2; utilises.has(nom); n++) nom = `${base}_${n <= 26 ? String.fromCharCode(96 + n) : n}`;
  utilises.add(nom);
  return nom;
}

// ---------------------------------------------------------------------------
// Application au plan
// ---------------------------------------------------------------------------

const memeInfo = (a?: InfoTri, b?: InfoTri) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Applique l'arborescence proposée au plan, en une seule opération annulable :
 * dossiers créés sous `Photos/` (origine « tri », ou repris d'un calcul
 * précédent), fichiers de `idsATrier` déplacés, puis suppression des dossiers
 * d'un tri précédent et des sous-dossiers « à trier » de la source devenus
 * vides. Relancer avec la même proposition ne change rien.
 */
export function appliquerTri(plan: Plan, dossiers: DossierPropose[], idsATrier: Set<string>, o: { garderAnciens?: boolean } = {}): Modification | null {
  const creation = new Transaction(plan);
  // Dossier enfant de `parent` pour un nom : un dossier du tri est repris ;
  // un dossier homonyme d'une autre origine n'est jamais mélangé (nom libre).
  // Le nom donné est noté (`tri.nom`) : tant que le dossier le porte, il est « automatique » (Nommage).
  const assurer = (parent: string, nom: string, info: InfoTri): string => {
    const freres = [...plan.dossiers.values()].filter((d) => d.parent === parent);
    const autres = new Set(freres.filter((d) => d.origine !== 'tri').map((d) => cleNom(d.nom)));
    const libre = nomDossierLibre(nom, autres);
    const voulu: InfoTri = { ...info, nom: libre };
    const repris = freres.find((d) => d.origine === 'tri' && cleNom(d.nom) === cleNom(libre));
    if (repris) {
      if (!memeInfo(repris.tri, voulu)) creation.dossier({ ...repris, tri: voulu });
      return repris.id;
    }
    const id = `n${plan.prochainId++}`;
    creation.dossier({ id, nom: libre, parent, origine: 'tri', tri: voulu } satisfies DossierPlan);
    return id;
  };

  const cibles: { id: string; photos: string[] }[] = [];
  for (const d of dossiers) {
    const photos = d.photos.filter((id) => idsATrier.has(id) && plan.fichiers.has(id));
    if (!photos.length) continue;
    let parent = RACINE;
    d.chemin.forEach((nom, i) => {
      const dernier = i === d.chemin.length - 1;
      parent = assurer(parent, nom, dernier ? d.info : (d.infoParent ?? d.info));
    });
    cibles.push({ id: parent, photos });
  }
  const modifications: (Modification | null)[] = [creation.terminer('Créer les dossiers du tri')];

  // Les photos écartées (floues…) changent seulement de dossier d'origine, pour y revenir si on les remet.
  const deCote = new Transaction(plan);
  for (const c of cibles) {
    const archive: string[] = [];
    for (const id of c.photos) {
      const f = plan.fichiers.get(id)!;
      if (f.categorie === 'autre') continue;
      if (f.statut === 'archive') archive.push(id);
      else if (f.dossier !== c.id) deCote.fichier({ ...f, dossier: c.id });
    }
    if (archive.length) modifications.push(deplacerFichiers(plan, archive, c.id));
  }
  modifications.push(deCote.terminer('Ranger les photos écartées'));

  // Nettoyage : dossiers du tri précédent et dossiers « à trier » devenus vides, des feuilles vers la racine.
  // `garderAnciens` (nouvelles photos seulement, D63) : les dossiers déjà faits ne sont jamais touchés.
  const nettoyage = new Transaction(plan);
  const utilises = () => new Set([...plan.fichiers.values()].map((f) => f.dossier));
  for (let encore = true; encore; ) {
    encore = false;
    const pleins = utilises();
    const parents = new Set([...plan.dossiers.values()].map((d) => d.parent));
    for (const d of [...plan.dossiers.values()]) {
      const jetable = (d.origine === 'tri' && !o.garderAnciens) || (d.origine === 'source' && d.traitement === 'trier');
      if (d.parent === null || !jetable || pleins.has(d.id) || parents.has(d.id)) continue;
      nettoyage.supprimerDossier(d.id);
      encore = true;
    }
  }
  modifications.push(nettoyage.terminer('Supprimer les dossiers vides'));
  return avecDetail(combiner(t`Ranger les photos`, ...modifications), t`Trier par lieux et sorties`);
}

/**
 * Vidéos (SPEC § 12) : rangées dans le dossier proposé dont une photo a été
 * prise à quelques heures près (la plus proche dans le temps), sinon dans
 * `_videos_non_classees/AAAA-MM`. Les dossiers proposés reçoivent leurs ids.
 */
export function rangerVideos(dossiers: DossierPropose[], datesPhotos: Map<string, string | undefined>, videos: { id: string; date?: string }[], margeHeures = 3): DossierPropose[] {
  const instant = (d?: string) => (d ? Date.parse(`${d.length === 10 ? `${d}T12:00:00` : d}Z`) : NaN);
  const reperes = dossiers.flatMap((d, k) => d.photos.map((id) => ({ k, t: instant(datesPhotos.get(id)) })).filter((x) => Number.isFinite(x.t)));
  reperes.sort((a, b) => a.t - b.t);
  const resultat = dossiers.map((d) => ({ ...d, photos: [...d.photos] }));
  const nonClassees = new Map<string, string[]>();
  for (const v of videos) {
    const t = instant(v.date);
    let meilleur: { k: number; ecart: number } | null = null;
    if (Number.isFinite(t)) {
      for (const r of reperes) {
        const ecart = Math.abs(r.t - t);
        if (ecart <= margeHeures * 3_600_000 && (!meilleur || ecart < meilleur.ecart)) meilleur = { k: r.k, ecart };
      }
    }
    if (meilleur) resultat[meilleur.k].photos.push(v.id);
    else {
      const mois = v.date?.slice(0, 7) ?? 'sans_date';
      nonClassees.set(mois, [...(nonClassees.get(mois) ?? []), v.id]);
    }
  }
  for (const [mois, ids] of [...nonClassees].sort()) resultat.push({ chemin: [nomsSortie().videosNonClassees, mois], photos: ids, info: { origine: 'sans_lieu' }, sorte: 'sans_lieu' });
  return resultat;
}

/**
 * Photos et vidéos sans date ni dans les données de l'appareil ni dans le nom
 * de fichier : la date du fichier est souvent celle d'une copie, et les
 * ranger d'après elle crée de fausses sorties. Elles vont dans `_sans_date`.
 */
/** Ce que le tri range, prêt pour `decouper` : photos datées (dans l'ordre des chemins), vidéos datées, éléments sans vraie date. */
export interface ElementsATrier {
  photos: PhotoTri[];
  videos: { id: string; date?: string }[];
  sansDate: string[];
}

export function elementsATrier(fichiers: { id: string; categorie: string; date?: string; origineDate?: string; gps?: { lat: number; lon: number } }[]): ElementsATrier {
  // Sans vraie date, une photo ne peut pas être rangée dans une sortie : elle va dans « _sans_date ».
  const { datees, sansDate } = separerSansDate(fichiers);
  const photos: PhotoTri[] = datees.filter((f) => f.categorie === 'photo').map((f) => ({ id: f.id, nom: f.id.split('/').pop()!, date: f.date, gps: f.gps }));
  photos.sort((a, b) => a.id.localeCompare(b.id));
  return { photos, videos: datees.filter((f) => f.categorie === 'video').map((f) => ({ id: f.id, date: f.date })), sansDate: sansDate.map((f) => f.id) };
}

/**
 * Arborescence de tout ce que le tri range : celle des photos, les vidéos avec
 * les photos du même moment, les éléments sans date à part. L'aperçu de
 * l'écran et le rangement font le même calcul ; seuls les noms diffèrent.
 */
export function arborescenceComplete(e: ElementsATrier, d: Decoupage, nom: (lat: number, lon: number) => string | null | undefined, o: OptionsTri, evts: EvenementCalendrier[] = []): DossierPropose[] {
  const dates = new Map(e.photos.map((p) => [p.id, p.date]));
  return avecSansDate(rangerVideos(arborescence(d, nom, o, evts), dates, e.videos), e.sansDate);
}

export function separerSansDate<T extends { id: string; origineDate?: string }>(fichiers: T[]): { datees: T[]; sansDate: T[] } {
  const sansDate = fichiers.filter((f) => f.origineDate === 'fichier');
  return { datees: fichiers.filter((f) => f.origineDate !== 'fichier'), sansDate };
}

/** Ajoute le dossier `_sans_date` aux dossiers proposés, s'il y a lieu. */
export function avecSansDate(dossiers: DossierPropose[], sansDate: string[]): DossierPropose[] {
  return sansDate.length ? [...dossiers, { chemin: [nomsSortie().sansDate], photos: [...sansDate], info: { origine: 'sans_lieu' }, sorte: 'sans_lieu' }] : dossiers;
}

export interface LieuFrequent {
  lat: number;
  lon: number;
  /** Jours différents où des photos y ont été prises. */
  jours: number;
  photos: string[];
}

/**
 * Suggestion de lieux connus (§ 6.4) : les endroits photographiés sur de
 * nombreux jours (maison, grands-parents, école, club), qui ne sont pas déjà
 * dans le rayon d'un lieu connu. Regroupement à `rayonM` près.
 */
export function lieuxFrequents(photos: PhotoTri[], lieux: LieuConnu[], joursMin = 5, rayonM = 150): LieuFrequent[] {
  const avec = photos.filter((p) => p.gps && p.date && !lieux.some((l) => distanceM(p.gps!.lat, p.gps!.lon, l.lat, l.lon) <= l.rayon_m));
  // Les photos prises au même endroit (à 10 m près) sont réunies d'abord : des milliers de photos de la
  // maison ne font que quelques points, et le regroupement reste rapide.
  const points = new Map<string, { p: PhotoTri; ids: string[]; jours: Set<string> }>();
  for (const p of avec) {
    const cle = `${p.gps!.lat.toFixed(4)},${p.gps!.lon.toFixed(4)}`;
    const x = points.get(cle) ?? { p: { id: cle, nom: '', date: p.date, gps: p.gps }, ids: [], jours: new Set<string>() };
    x.ids.push(p.id);
    x.jours.add(p.date!.slice(0, 10));
    points.set(cle, x);
  }
  const g = grouper([...points.values()].map((x) => x.p), [], { rayonKm: rayonM / 1000, lieuxConnus: false });
  const parGroupe = new Map<number, { ids: string[]; jours: Set<string> }>();
  for (const [cle, x] of points) {
    const k = g.groupeDe.get(cle);
    if (k === undefined) continue;
    const y = parGroupe.get(k) ?? { ids: [], jours: new Set<string>() };
    y.ids.push(...x.ids);
    for (const j of x.jours) y.jours.add(j);
    parGroupe.set(k, y);
  }
  const resultat: LieuFrequent[] = [];
  for (const [k, y] of parGroupe) {
    if (y.jours.size < joursMin) continue;
    const gr = g.groupes.find((x) => x.index === k)!;
    resultat.push({ lat: gr.lat, lon: gr.lon, jours: y.jours.size, photos: y.ids });
  }
  return resultat.sort((a, b) => b.jours - a.jours);
}
