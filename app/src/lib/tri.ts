// Tri par lieux et sorties (étape « Tri automatique », SPEC § 6.4) : portage du script 01.
// Lieux connus, regroupement GPS (DBSCAN haversine), découpage en
// événements, noms tirés des fichiers nommés à la main, passe voyages.
// Le géocodage des groupes est fait ailleurs (Nominatim) : les noms arrivent
// ici déjà trouvés, ce qui rend tout testable sans réseau.

import type { LieuConnu } from './config';
import { dureeEvenement, evenementsUtiles, joursEvenement, prisePendant, type EvenementCalendrier } from './ics';
import { t } from './langue';
import { cleNom, nomAscii } from './noms';
import { combiner, deplacerFichiers, RACINE, Transaction, type DossierPlan, type InfoTri, type Modification, type Plan } from './plan';
import { nomsSortie } from './sortie';

/**
 * Options du script 01 (SPEC § 10). L'écran n'en montre que quelques-unes
 * (D87) : la façon de ranger (sortie, jour ou mois), la taille d'un lieu, les
 * voyages, et en réglages avancés la durée d'une sortie et la distance d'un
 * voyage ; les autres gardent leur valeur par défaut.
 */
export interface OptionsTri {
  /** Rayon de regroupement géographique (`--rayon-km`). */
  rayonKm: number;
  /** Coupe aussi les événements à chaque changement de journée (`--par-jour`). */
  parJour: boolean;
  /** Dossiers `Lieu_MM.AA` selon le mois de chaque photo (`--par-mois`). */
  parMois: boolean;
  /** Un seul dossier par lieu, sans date (`--sans-evenement`). */
  sansEvenement: boolean;
  /**
   * Écart au-delà duquel une photo ouvre un nouvel événement (`--gap-jours`).
   * 7 jours (30 dans le script) : à 30, la durée maximale coupait toujours
   * avant, et deux visites au même endroit à deux semaines d'écart formaient
   * une seule sortie (mesuré sur 2025, D87).
   */
  gapJours: number;
  /** Durée maximale d'un événement (`--duree-max-jours`). */
  dureeMaxJours: number;
  /** Regroupe les étapes lointaines qui s'enchaînent en voyages (`--sans-voyages` inverse). */
  voyages: boolean;
  /**
   * Distance au domicile au-delà de laquelle un événement est « lointain »
   * (`--distance-voyage`) : 50 km (30 dans le script, qui faisait un voyage de
   * deux excursions d'un jour, D87).
   */
  distanceVoyageKm: number;
  /**
   * Écart toléré entre deux étapes d'un voyage, si l'on n'est pas rentré entre-temps
   * (`--gap-voyage-max`). Un retour près du domicile coupe toujours le voyage (D87).
   */
  gapVoyageMax: number;
  /** Nomme les dossiers d'après les fichiers nommés à la main (`--sans-noms-fichiers` inverse). */
  nomsFichiers: boolean;
  /** Utilise les lieux connus de la configuration (`--lieux-connus aucun` inverse). */
  lieuxConnus: boolean;
  /**
   * Dans un lieu connu (le domicile…), sépare les événements du calendrier
   * (Noël, un anniversaire) d'un sous-dossier qui couvre plus de 3 jours : le
   * GPS ne peut rien y séparer (D88). Sans calendrier, sans effet.
   */
  calendrierLieuxConnus: boolean;
}

/** Façon de ranger montrée à l'écran (D87) : par sortie (conseillé), par jour, ou par mois. */
export type ModeTri = 'sortie' | 'jour' | 'mois';

export const modeTri = (o: Pick<OptionsTri, 'parJour' | 'parMois'>): ModeTri => (o.parMois ? 'mois' : o.parJour ? 'jour' : 'sortie');

/** Options d'une façon de ranger (« un seul dossier par lieu » n'est plus proposé, D87). */
export const optionsDuMode = (m: ModeTri): Pick<OptionsTri, 'parJour' | 'parMois' | 'sansEvenement'> => ({ parJour: m === 'jour', parMois: m === 'mois', sansEvenement: false });

export const OPTIONS_TRI_DEFAUT: OptionsTri = {
  rayonKm: 2,
  parJour: false,
  parMois: false,
  sansEvenement: false,
  gapJours: 7,
  dureeMaxJours: 21,
  voyages: true,
  distanceVoyageKm: 50,
  gapVoyageMax: 7,
  nomsFichiers: true,
  lieuxConnus: true,
  calendrierLieuxConnus: true,
};

/** 30 km : l'ancienne distance par défaut d'un voyage, enregistrée dans les projets sans avoir été choisie. */
const ANCIENNE_DISTANCE_VOYAGE = 30;

/**
 * Réglages enregistrés d'un projet, ramenés à ceux de l'écran (D87) : la façon
 * de ranger, la taille d'un lieu, les voyages, la durée d'une sortie et la
 * distance d'un voyage. Les autres reprennent leur valeur par défaut, lieux
 * connus et noms de fichiers compris (l'ancien préréglage « Voyage » les
 * coupait) ; l'ancienne distance par défaut laisse place à la nouvelle.
 */
export function optionsDuProjet(enregistrees: unknown): OptionsTri {
  const x = (typeof enregistrees === 'object' && enregistrees !== null ? enregistrees : {}) as Partial<Record<keyof OptionsTri, unknown>>;
  const nombre = (v: unknown, defaut: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : defaut);
  const d = OPTIONS_TRI_DEFAUT;
  return {
    ...d,
    ...optionsDuMode(x.parMois === true ? 'mois' : x.parJour === true ? 'jour' : 'sortie'),
    rayonKm: nombre(x.rayonKm, d.rayonKm),
    voyages: typeof x.voyages === 'boolean' ? x.voyages : d.voyages,
    dureeMaxJours: nombre(x.dureeMaxJours, d.dureeMaxJours),
    calendrierLieuxConnus: typeof x.calendrierLieuxConnus === 'boolean' ? x.calendrierLieuxConnus : d.calendrierLieuxConnus,
    distanceVoyageKm: x.distanceVoyageKm === ANCIENNE_DISTANCE_VOYAGE ? d.distanceVoyageKm : nombre(x.distanceVoyageKm, d.distanceVoyageKm),
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
 * Nom exploitable si le fichier a été nommé à la main, sinon `null`.
 * « Anniversaire Lea.jpg » → « Anniversaire_Lea » ; « IMG_2043.jpg » → `null`.
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
  return sanitize(base);
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
// Regroupement : lieux connus, puis DBSCAN haversine
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

/** Instant d'une date locale (sans fuseau, pour éviter les changements d'heure), en ms. */
function instant(date?: string): number | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/**
 * Regroupement du script 01 : chaque photo avec GPS dans le rayon du lieu
 * connu le plus proche lui est rattachée ; les autres forment des groupes
 * (DBSCAN haversine) ; une photo sans GPS rejoint le lieu le plus fréquent
 * de sa journée, lieu connu compris (D87 : une journée à la maison n'envoie
 * plus ses photos sans GPS dans `Sans_lieu`).
 */
export function grouper(photos: PhotoTri[], lieux: LieuConnu[], o: Pick<OptionsTri, 'rayonKm' | 'lieuxConnus'> = OPTIONS_TRI_DEFAUT): Groupes {
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
// Arborescence : événements, noms, voyages
// ---------------------------------------------------------------------------

export interface DossierPropose {
  /** Parties du chemin sous `Photos/` : [dossier] ou [parent, sous-dossier]. */
  chemin: string[];
  photos: string[];
  info: InfoTri;
  /** Ce qu'est le dossier parent quand le chemin a deux parties (voyage, lieu connu). */
  infoParent?: InfoTri;
  /** Premier et dernier jour (AAAA-MM-JJ). */
  du?: string;
  au?: string;
  /** Sous-dossier d'un lieu connu séparé par un événement du calendrier (D88) : son titre. */
  evenement?: string;
}

const deux = (n: number) => String(n).padStart(2, '0');
const JOUR_MS = 86_400_000;

/** Un sous-dossier d'un lieu connu qui couvre plus de 3 jours réunit sans doute plusieurs moments (D88). */
export const JOURS_MAX_SANS_CALENDRIER = 3;
/** Photos prises sur place pendant un événement pour qu'il forme son propre sous-dossier (D88). */
export const PHOTOS_MIN_EVENEMENT = 5;

/**
 * Découpage d'un sous-dossier d'un lieu connu par le calendrier (D88). Au-delà
 * de 3 jours, chaque événement utile (pas récurrent, 21 jours au plus) pendant
 * lequel au moins 5 de ses photos, qui se suivent, ont été prises forme un
 * morceau, ceux qui en réunissent le plus d'abord ; les autres photos forment
 * les morceaux d'avant, d'entre et d'après. Un morceau de moins de 5 photos
 * rejoint son voisin le plus proche dans le temps. `ev` est trié par date.
 */
export function decouperParCalendrier(ev: PhotoTri[], evts: EvenementCalendrier[]): { photos: PhotoTri[]; evenement?: string }[] {
  const d1 = jourDe(ev[0].date)!;
  const d2 = jourDe(ev.at(-1)!.date)!;
  if ((instant(d2)! - instant(d1)!) / JOUR_MS + 1 <= JOURS_MAX_SANS_CALENDRIER) return [{ photos: ev }];
  // Les événements qui réunissent le plus de photos d'abord (à égalité, le plus court) : Noël plutôt qu'un
  // rappel du même jour ; un morceau trop fin ne sert à rien (mesuré sur 2025, D88).
  const candidats = evts
    .filter((e) => {
      const [a, b] = joursEvenement(e);
      return a <= d2 && b >= d1;
    })
    .map((e) => ({ e, n: ev.filter((p) => prisePendant(e, p.date!)).length }))
    .sort((a, b) => b.n - a.n || dureeEvenement(a.e) - dureeEvenement(b.e));
  const pris = new Set<string>();
  const groupes: { photos: PhotoTri[]; evenement?: string }[] = [];
  for (const { e } of candidats) {
    const pendant = ev.filter((p) => !pris.has(p.id) && prisePendant(e, p.date!));
    if (pendant.length < PHOTOS_MIN_EVENEMENT) continue;
    // Des photos qui se suivent : un événement ne fait pas un dossier troué par un autre.
    const t1 = instant(pendant[0].date)!;
    const t2 = instant(pendant.at(-1)!.date)!;
    if (ev.some((p) => pris.has(p.id) && instant(p.date)! > t1 && instant(p.date)! < t2)) continue;
    groupes.push({ photos: pendant, evenement: e.titre });
    for (const p of pendant) pris.add(p.id);
  }
  if (!groupes.length) return [{ photos: ev }];
  // Les autres photos : un morceau avant le premier événement, un entre deux, un après le dernier.
  const debuts = groupes.map((x) => instant(x.photos[0].date)!).sort((a, b) => a - b);
  const reste = new Map<number, PhotoTri[]>();
  for (const p of ev) {
    if (pris.has(p.id)) continue;
    const i = debuts.filter((d) => d <= instant(p.date)!).length;
    reste.set(i, [...(reste.get(i) ?? []), p]);
  }
  const morceaux: { photos: PhotoTri[]; evenement?: string }[] = [...groupes, ...[...reste.values()].map((photos) => ({ photos }))].sort((a, b) => instant(a.photos[0].date)! - instant(b.photos[0].date)!);
  // Quelques photos isolées entre deux événements ne font pas un dossier : elles rejoignent le morceau le plus proche.
  for (let i = 0; i < morceaux.length && morceaux.length > 1; ) {
    const m = morceaux[i];
    if (m.evenement || m.photos.length >= PHOTOS_MIN_EVENEMENT) {
      i++;
      continue;
    }
    const ecart = (x?: { photos: PhotoTri[] }) =>
      !x ? Infinity : Math.min(Math.abs(instant(x.photos.at(-1)!.date)! - instant(m.photos[0].date)!), Math.abs(instant(x.photos[0].date)! - instant(m.photos.at(-1)!.date)!));
    const cible = ecart(morceaux[i - 1]) <= ecart(morceaux[i + 1]) ? morceaux[i - 1] : morceaux[i + 1];
    cible.photos = [...cible.photos, ...m.photos].sort((a, b) => instant(a.date)! - instant(b.date)!);
    morceaux.splice(i, 1);
  }
  return morceaux;
}

/** Découpage en événements d'une liste triée par date (écart glissant, durée maximale, journée). */
function evenements(datees: PhotoTri[], o: OptionsTri): PhotoTri[][] {
  const evs: PhotoTri[][] = [];
  for (const p of datees) {
    const ev = evs.at(-1);
    const t = instant(p.date)!;
    if (
      ev &&
      t - instant(ev.at(-1)!.date)! <= o.gapJours * JOUR_MS &&
      t - instant(ev[0].date)! <= o.dureeMaxJours * JOUR_MS &&
      (!o.parJour || jourDe(p.date) === jourDe(ev.at(-1)!.date))
    ) {
      ev.push(p);
    } else evs.push([p]);
  }
  return evs;
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

/** Date d'un événement pour son nom : sa journée, ou du premier au dernier jour. */
function suffixeDate(ev: PhotoTri[]): string {
  return dateDeNom(jourDe(ev[0].date)!, jourDe(ev.at(-1)!.date)!);
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

function triParDate(liste: PhotoTri[]): { datees: PhotoTri[]; sansDate: PhotoTri[] } {
  const datees = liste.filter((p) => instant(p.date) !== null);
  // Tri stable, comme `sorted` en Python.
  datees.sort((a, b) => instant(a.date)! - instant(b.date)!);
  return { datees, sansDate: liste.filter((p) => instant(p.date) === null) };
}

/**
 * Arborescence proposée (script 01) : un dossier par lieu connu (avec un
 * sous-dossier par événement, ou à plat), un dossier par événement de chaque
 * groupe GPS (`Lieu_JJ.MM.AA`, ou `Lieu_JJ-JJ.MM.AA` sur plusieurs jours), regroupés en
 * `Voyage_<Lieu>_<date>/` quand des étapes lointaines s'enchaînent, et
 * `Sans_lieu/` pour le reste. `noms` : nom géocodé de chaque groupe (ou `null`).
 */
export function arborescence(g: Groupes, noms: Map<number, string | null | undefined>, o: OptionsTri = OPTIONS_TRI_DEFAUT, evts: EvenementCalendrier[] = []): DossierPropose[] {
  const parEvenement = !(o.sansEvenement || o.parMois);
  // Calendrier : seulement par sortie, dans les lieux connus (D88).
  const utiles = o.calendrierLieuxConnus && parEvenement && !o.parJour ? evenementsUtiles(evts) : [];
  const destination = new Map<string, { chemin: string[]; info: InfoTri; infoParent?: InfoTri; evenement?: string }>();
  const nomGroupe = (index: number) => {
    const n = noms.get(index);
    return n ? sanitize(n) : `${nomsSortie().lieu}_${deux(index)}`;
  };
  const infoGroupe = (index: number, origine: InfoTri['origine'] = 'gps'): InfoTri => ({ origine, lieu: nomGroupe(index), lat: g.groupes[index].lat, lon: g.groupes[index].lon });

  // Lieux connus : un dossier parent par lieu, un sous-dossier par événement (ou par mois).
  const parLieu = new Map<LieuConnu, PhotoTri[]>();
  for (const p of g.photos) {
    const l = g.lieuDe.get(p.id);
    if (l) parLieu.set(l, [...(parLieu.get(l) ?? []), p]);
  }
  for (const [lieu, membres] of parLieu) {
    const nomLieu = sanitize(lieu.nom);
    const info: InfoTri = { origine: 'lieu_connu', lieu: lieu.nom, lat: lieu.lat, lon: lieu.lon };
    if (lieu.un_seul_dossier || o.sansEvenement) {
      for (const p of membres) destination.set(p.id, { chemin: [nomLieu], info });
      continue;
    }
    if (o.parMois) {
      // Un sous-dossier par mois, comme les autres lieux (D87) : le domicile n'est plus d'un seul tenant.
      for (const p of membres) {
        const mois = jourDe(p.date)?.slice(0, 7);
        destination.set(p.id, mois ? { chemin: [nomLieu, moisDeNom(mois)], info, infoParent: info } : { chemin: [nomLieu], info });
      }
      continue;
    }
    const { datees, sansDate: nonDatees } = triParDate(membres);
    for (const p of nonDatees) destination.set(p.id, { chemin: [nomLieu], info });
    const utilises = new Set<string>();
    const morceaux = evenements(datees, o).flatMap((ev) => (utiles.length ? decouperParCalendrier(ev, utiles) : [{ photos: ev }]));
    for (const { photos: ev, evenement } of morceaux) {
      const suffixe = suffixeDate(ev);
      const brut = o.nomsFichiers ? nomDominant(ev.map((p) => p.nom)) : null;
      const desc = brut ? sansDate(brut) : null;
      let base: string;
      if (desc && !desc.toLowerCase().includes(nomLieu.toLowerCase())) base = `${desc}_${suffixe}`;
      else if (desc) base = `${sanitize(desc)}_${suffixe}`;
      else base = suffixe;
      // Le nom reste fait de dates : celui de l'événement se choisit au Nommage (D88).
      const nom = nomUnique(base, utilises);
      for (const p of ev) destination.set(p.id, { chemin: [nomLieu, nom], info, infoParent: info, ...(evenement ? { evenement } : {}) });
    }
  }

  // Groupes GPS : événements (par défaut), mois, ou un dossier par lieu.
  const parGroupe = new Map<number, PhotoTri[]>();
  for (const p of g.photos) {
    const e = g.groupeDe.get(p.id);
    if (e !== undefined && !g.lieuDe.has(p.id)) parGroupe.set(e, [...(parGroupe.get(e) ?? []), p]);
  }
  interface Evenement {
    photos: PhotoTri[];
    index: number;
    nom: string;
    t1: number;
    t2: number;
    distKm: number;
  }
  const tous: Evenement[] = [];
  // Global : deux groupes homonymes ne fusionnent pas, ni un groupe avec un lieu connu du même nom (incident I4).
  const utilises = new Set<string>([...parLieu.keys()].map((l) => sanitize(l.nom)));
  /** Dossier sans événement d'un groupe (un par mois, un pour tout le lieu, ou ses photos sans date) : nom unique. */
  const dossiersGroupe = new Map<string, string>();
  const dossierGroupe = (index: number, base: string) => {
    const cle = `${index}|${base}`;
    if (!dossiersGroupe.has(cle)) dossiersGroupe.set(cle, nomUnique(base, utilises));
    return dossiersGroupe.get(cle)!;
  };
  for (const [index, membres] of parGroupe) {
    const lieuNom = nomGroupe(index);
    if (!parEvenement) {
      for (const p of membres) {
        const mois = jourDe(p.date)?.slice(0, 7);
        destination.set(p.id, { chemin: [dossierGroupe(index, o.parMois && mois ? `${lieuNom}_${moisDeNom(mois)}` : lieuNom)], info: infoGroupe(index) });
      }
      continue;
    }
    const { datees, sansDate: nonDatees } = triParDate(membres);
    for (const ev of evenements(datees, o)) {
      const suffixe = suffixeDate(ev);
      // Si des photos ont un nom donné à la main, il décrit la sortie (sans répéter le lieu).
      const brut = o.nomsFichiers ? nomDominant(ev.map((p) => p.nom)) : null;
      const desc = brut ? sansDate(brut) : null;
      const base = desc ? (desc.toLowerCase().includes(lieuNom.toLowerCase()) ? `${desc}_${suffixe}` : `${desc}_${lieuNom}_${suffixe}`) : `${lieuNom}_${suffixe}`;
      const nom = nomUnique(base, utilises);
      for (const p of ev) destination.set(p.id, { chemin: [nom], info: infoGroupe(index) });
      const avecGps = ev.filter((p) => p.gps);
      let distKm = 0;
      if (avecGps.length && g.domicile) {
        const lat = avecGps.reduce((s, p) => s + p.gps!.lat, 0) / avecGps.length;
        const lon = avecGps.reduce((s, p) => s + p.gps!.lon, 0) / avecGps.length;
        distKm = distanceM(lat, lon, g.domicile.lat, g.domicile.lon) / 1000;
      }
      tous.push({ photos: ev, index, nom, t1: instant(ev[0].date)!, t2: instant(ev.at(-1)!.date)!, distKm });
    }
    // Sans date : dossier du lieu, sans suffixe.
    for (const p of nonDatees) destination.set(p.id, { chemin: [dossierGroupe(index, lieuNom)], info: infoGroupe(index) });
  }

  // Passe voyages : des événements lointains qui s'enchaînent forment un voyage.
  if (parEvenement && o.voyages && g.domicile && tous.length) {
    const chrono = [...tous].sort((a, b) => a.t1 - b.t1);
    // Présence près du domicile : photos des lieux connus proches (pas ceux d'un voyage, des grands-parents
    // au loin par exemple, D87) et événements proches.
    const domicile = g.domicile;
    const pres = (l: LieuConnu) => distanceM(l.lat, l.lon, domicile.lat, domicile.lon) / 1000 <= o.distanceVoyageKm;
    const proches = [
      ...g.photos.filter((p) => { const l = g.lieuDe.get(p.id); return l && pres(l); }).map((p) => instant(p.date)).filter((t): t is number => t !== null),
      ...chrono.filter((e) => e.distKm <= o.distanceVoyageKm).flatMap((e) => [e.t1, e.t2]),
    ];
    const rentresEntre = (t1: number, t2: number) => proches.some((d) => t1 < d && d < t2);
    const voyages: Evenement[][] = [];
    let courant = [chrono[0]];
    for (const ev of chrono.slice(1)) {
      const prec = courant.at(-1)!;
      const ecart = ev.t1 - prec.t2;
      const loin = ev.distKm > o.distanceVoyageKm && prec.distKm > o.distanceVoyageKm;
      // Rentré entre-temps : deux sorties, même le lendemain (le script les réunissait à moins d'un jour, D87).
      const pont = ecart <= o.gapVoyageMax * JOUR_MS && !rentresEntre(prec.t2, ev.t1);
      if (loin && pont) courant.push(ev);
      else {
        voyages.push(courant);
        courant = [ev];
      }
    }
    voyages.push(courant);

    const parents = new Set<string>();
    for (const voyage of voyages) {
      if (voyage.length < 2) continue;
      // Lieu principal : celui qui totalise le plus de photos.
      const parLieuNom = new Map<string, number>();
      for (const ev of voyage) parLieuNom.set(nomGroupe(ev.index), (parLieuNom.get(nomGroupe(ev.index)) ?? 0) + ev.photos.length);
      let principal = '';
      let max = -1;
      for (const [nom, n] of parLieuNom) {
        if (n > max) [principal, max] = [nom, n];
      }
      const suffixe = suffixeDate([voyage[0].photos[0], voyage.at(-1)!.photos.at(-1)!]);
      const parent = nomUnique(`${nomsSortie().voyage}_${principal}_${suffixe}`, parents);
      const infoParent: InfoTri = { origine: 'voyage', lieu: principal };
      for (const ev of voyage) {
        for (const p of ev.photos) destination.set(p.id, { chemin: [parent, ev.nom], info: infoGroupe(ev.index, 'etape'), infoParent });
      }
    }
  }

  // Regroupe par chemin, dans l'ordre des photos ; le reste va dans Sans_lieu.
  const dossiers = new Map<string, DossierPropose>();
  for (const p of g.photos) {
    const d = destination.get(p.id) ?? { chemin: [nomsSortie().sansLieu], info: { origine: 'sans_lieu' as const } };
    const cle = d.chemin.join('/');
    const x = dossiers.get(cle) ?? { chemin: d.chemin, photos: [], info: d.info, ...(d.infoParent ? { infoParent: d.infoParent } : {}), ...(d.evenement ? { evenement: d.evenement } : {}) };
    x.photos.push(p.id);
    const jour = jourDe(p.date);
    if (jour) {
      if (!x.du || jour < x.du) x.du = jour;
      if (!x.au || jour > x.au) x.au = jour;
    }
    dossiers.set(cle, x);
  }
  return [...dossiers.values()];
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
  return combiner(t`Trier par lieux et sorties`, ...modifications);
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
  for (const [mois, ids] of [...nonClassees].sort()) resultat.push({ chemin: [nomsSortie().videosNonClassees, mois], photos: ids, info: { origine: 'sans_lieu' } });
  return resultat;
}

/**
 * Photos et vidéos sans date ni dans les données de l'appareil ni dans le nom
 * de fichier : la date du fichier est souvent celle d'une copie, et les
 * ranger d'après elle crée de fausses sorties. Elles vont dans `_sans_date`.
 */
/** Ce que le tri range, prêt pour `grouper` : photos datées (dans l'ordre des chemins), vidéos datées, éléments sans vraie date. */
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
export function arborescenceComplete(e: ElementsATrier, g: Groupes, noms: Map<number, string | null | undefined>, o: OptionsTri, evts: EvenementCalendrier[] = []): DossierPropose[] {
  const dates = new Map(e.photos.map((p) => [p.id, p.date]));
  return avecSansDate(rangerVideos(arborescence(g, noms, o, evts), dates, e.videos), e.sansDate);
}

export function separerSansDate<T extends { id: string; origineDate?: string }>(fichiers: T[]): { datees: T[]; sansDate: T[] } {
  const sansDate = fichiers.filter((f) => f.origineDate === 'fichier');
  return { datees: fichiers.filter((f) => f.origineDate !== 'fichier'), sansDate };
}

/** Ajoute le dossier `_sans_date` aux dossiers proposés, s'il y a lieu. */
export function avecSansDate(dossiers: DossierPropose[], sansDate: string[]): DossierPropose[] {
  return sansDate.length ? [...dossiers, { chemin: [nomsSortie().sansDate], photos: [...sansDate], info: { origine: 'sans_lieu' } }] : dossiers;
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
