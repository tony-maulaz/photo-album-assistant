// Tri par lieux et sorties (étape « Tri automatique », SPEC § 6.4) : portage du script 01.
// Lieux connus, regroupement GPS (DBSCAN haversine), découpage en
// événements, noms tirés des fichiers nommés à la main, passe voyages.
// Le géocodage des groupes est fait ailleurs (Nominatim) : les noms arrivent
// ici déjà trouvés, ce qui rend tout testable sans réseau.

import type { LieuConnu } from './config';
import { cleNom, nomAscii, nomLibre } from './noms';
import { combiner, deplacerFichiers, RACINE, Transaction, type DossierPlan, type InfoTri, type Modification, type Plan } from './plan';

/** Options du script 01 (SPEC § 10). */
export interface OptionsTri {
  /** Rayon de regroupement géographique (`--rayon-km`). */
  rayonKm: number;
  /** Coupe aussi les événements à chaque changement de journée (`--par-jour`). */
  parJour: boolean;
  /** Dossiers `Lieu_AAAA-MM` selon le mois de chaque photo (`--par-mois`). */
  parMois: boolean;
  /** Un seul dossier par lieu, sans date (`--sans-evenement`). */
  sansEvenement: boolean;
  /** Écart au-delà duquel une photo ouvre un nouvel événement (`--gap-jours`). */
  gapJours: number;
  /** Durée maximale d'un événement (`--duree-max-jours`). */
  dureeMaxJours: number;
  /** Regroupe les étapes lointaines qui s'enchaînent en voyages (`--sans-voyages` inverse). */
  voyages: boolean;
  /** Distance au domicile au-delà de laquelle un événement est « lointain » (`--distance-voyage`). */
  distanceVoyageKm: number;
  /** Écart maximal entre deux étapes d'un voyage (`--gap-voyage`). */
  gapVoyage: number;
  /** Écart toléré si aucune photo n'a été prise près du domicile entre-temps (`--gap-voyage-max`). */
  gapVoyageMax: number;
  /** Nomme les dossiers d'après les fichiers nommés à la main (`--sans-noms-fichiers` inverse). */
  nomsFichiers: boolean;
  /** Utilise les lieux connus de la configuration (`--lieux-connus aucun` inverse). */
  lieuxConnus: boolean;
}

export const OPTIONS_TRI_DEFAUT: OptionsTri = {
  rayonKm: 2,
  parJour: false,
  parMois: false,
  sansEvenement: false,
  gapJours: 30,
  dureeMaxJours: 21,
  voyages: true,
  distanceVoyageKm: 30,
  gapVoyage: 1,
  gapVoyageMax: 7,
  nomsFichiers: true,
  lieuxConnus: true,
};

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Options d'un préréglage de `config.json` (champs inconnus ou invalides ignorés). */
export function optionsDepuisPrereglage(p: unknown): Partial<OptionsTri> {
  if (!estObjet(p)) return {};
  const o: Partial<OptionsTri> = {};
  const nombre = (cle: string, champ: keyof OptionsTri, min: number) => {
    const v = p[cle];
    if (typeof v === 'number' && Number.isFinite(v) && v >= min) (o as Record<string, unknown>)[champ] = v;
  };
  const booleen = (cle: string, champ: keyof OptionsTri) => {
    if (typeof p[cle] === 'boolean') (o as Record<string, unknown>)[champ] = p[cle];
  };
  nombre('rayon_km', 'rayonKm', 0.01);
  booleen('par_jour', 'parJour');
  booleen('par_mois', 'parMois');
  booleen('sans_evenement', 'sansEvenement');
  nombre('gap_jours', 'gapJours', 0);
  nombre('duree_max_jours', 'dureeMaxJours', 0);
  booleen('voyages', 'voyages');
  nombre('distance_voyage', 'distanceVoyageKm', 0);
  nombre('gap_voyage', 'gapVoyage', 0);
  nombre('gap_voyage_max', 'gapVoyageMax', 0);
  booleen('noms_fichiers', 'nomsFichiers');
  booleen('lieux_connus', 'lieuxConnus');
  return o;
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
  return nomAscii(nom) || 'Lieu_inconnu';
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

const MOIS = new Set(['janvier', 'fevrier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'août', 'septembre', 'octobre', 'novembre', 'decembre', 'décembre']);

/** Dossier de mois (« 01_janvier », « 2025-01 janvier ») ou nom listé dans `extra`. */
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
  /** Photo dans le rayon d'un lieu connu → ce lieu. */
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
 * (DBSCAN haversine) ; une photo sans GPS rejoint le groupe le plus fréquent
 * de sa journée.
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

  // Photos sans GPS : le groupe le plus fréquent de la journée (le premier vu à égalité).
  const parJour = new Map<string, Map<number, number>>();
  for (const p of avecGps) {
    const j = jourDe(p.date);
    if (!j) continue;
    const c = parJour.get(j) ?? new Map<number, number>();
    c.set(groupeDe.get(p.id)!, (c.get(groupeDe.get(p.id)!) ?? 0) + 1);
    parJour.set(j, c);
  }
  for (const p of photos) {
    if (p.gps) continue;
    const c = parJour.get(jourDe(p.date) ?? '');
    if (!c) continue;
    let meilleur: [number, number] | null = null;
    for (const [g, n] of c) if (!meilleur || n > meilleur[1]) meilleur = [g, n];
    groupeDe.set(p.id, meilleur![0]);
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
}

const deux = (n: number) => String(n).padStart(2, '0');
const JOUR_MS = 86_400_000;

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

/** Sortie sur une seule journée : date complète ; sinon le mois. */
function suffixeDate(ev: PhotoTri[]): string {
  const d1 = jourDe(ev[0].date)!;
  const d2 = jourDe(ev.at(-1)!.date)!;
  return d1 === d2 ? d1 : d1.slice(0, 7);
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
 * groupe GPS (`Lieu_AAAA-MM-JJ` ou `Lieu_AAAA-MM`), regroupés en
 * `Voyage_<Lieu>_<date>/` quand des étapes lointaines s'enchaînent, et
 * `Sans_lieu/` pour le reste. `noms` : nom géocodé de chaque groupe (ou `null`).
 */
export function arborescence(g: Groupes, noms: Map<number, string | null | undefined>, o: OptionsTri = OPTIONS_TRI_DEFAUT): DossierPropose[] {
  const parEvenement = !(o.sansEvenement || o.parMois);
  const destination = new Map<string, { chemin: string[]; info: InfoTri; infoParent?: InfoTri }>();
  const nomGroupe = (index: number) => {
    const n = noms.get(index);
    return n ? sanitize(n) : `Lieu_${deux(index)}`;
  };
  const infoGroupe = (index: number, origine: InfoTri['origine'] = 'gps'): InfoTri => ({ origine, lieu: nomGroupe(index), lat: g.groupes[index].lat, lon: g.groupes[index].lon });

  // Lieux connus : un dossier parent par lieu, un sous-dossier par événement.
  const parLieu = new Map<LieuConnu, PhotoTri[]>();
  for (const p of g.photos) {
    const l = g.lieuDe.get(p.id);
    if (l) parLieu.set(l, [...(parLieu.get(l) ?? []), p]);
  }
  for (const [lieu, membres] of parLieu) {
    const nomLieu = sanitize(lieu.nom);
    const info: InfoTri = { origine: 'lieu_connu', lieu: lieu.nom, lat: lieu.lat, lon: lieu.lon };
    if (lieu.un_seul_dossier || !parEvenement) {
      for (const p of membres) destination.set(p.id, { chemin: [nomLieu], info });
      continue;
    }
    const { datees, sansDate: nonDatees } = triParDate(membres);
    for (const p of nonDatees) destination.set(p.id, { chemin: [nomLieu], info });
    const utilises = new Set<string>();
    for (const ev of evenements(datees, o)) {
      const suffixe = suffixeDate(ev);
      const brut = o.nomsFichiers ? nomDominant(ev.map((p) => p.nom)) : null;
      const desc = brut ? sansDate(brut) : null;
      let base: string;
      if (desc && !desc.toLowerCase().includes(nomLieu.toLowerCase())) base = `${desc}_${suffixe}`;
      else if (desc) base = `${sanitize(desc)}_${suffixe}`;
      else base = suffixe;
      const nom = nomUnique(base, utilises);
      for (const p of ev) destination.set(p.id, { chemin: [nomLieu, nom], info, infoParent: info });
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
  const utilises = new Set<string>(); // global : deux groupes homonymes ne fusionnent pas
  for (const [index, membres] of parGroupe) {
    const lieuNom = nomGroupe(index);
    if (!parEvenement) {
      for (const p of membres) {
        const mois = jourDe(p.date)?.slice(0, 7);
        destination.set(p.id, { chemin: [o.parMois && mois ? `${lieuNom}_${mois}` : lieuNom], info: infoGroupe(index) });
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
    for (const p of nonDatees) destination.set(p.id, { chemin: [lieuNom], info: infoGroupe(index) });
  }

  // Passe voyages : des événements lointains qui s'enchaînent forment un voyage.
  if (parEvenement && o.voyages && g.domicile && tous.length) {
    const chrono = [...tous].sort((a, b) => a.t1 - b.t1);
    // Présence près du domicile : photos des lieux connus et événements proches.
    const proches = [
      ...g.photos.filter((p) => g.lieuDe.has(p.id)).map((p) => instant(p.date)).filter((t): t is number => t !== null),
      ...chrono.filter((e) => e.distKm <= o.distanceVoyageKm).flatMap((e) => [e.t1, e.t2]),
    ];
    const rentresEntre = (t1: number, t2: number) => proches.some((d) => t1 < d && d < t2);
    const voyages: Evenement[][] = [];
    let courant = [chrono[0]];
    for (const ev of chrono.slice(1)) {
      const prec = courant.at(-1)!;
      const ecart = ev.t1 - prec.t2;
      const loin = ev.distKm > o.distanceVoyageKm && prec.distKm > o.distanceVoyageKm;
      const pont = ecart <= o.gapVoyage * JOUR_MS || (ecart <= o.gapVoyageMax * JOUR_MS && !rentresEntre(prec.t2, ev.t1));
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
      const parent = nomUnique(`Voyage_${principal}_${suffixe}`, parents);
      const infoParent: InfoTri = { origine: 'voyage', lieu: principal };
      for (const ev of voyage) {
        for (const p of ev.photos) destination.set(p.id, { chemin: [parent, ev.nom], info: infoGroupe(ev.index, 'etape'), infoParent });
      }
    }
  }

  // Regroupe par chemin, dans l'ordre des photos ; le reste va dans Sans_lieu.
  const dossiers = new Map<string, DossierPropose>();
  for (const p of g.photos) {
    const d = destination.get(p.id) ?? { chemin: ['Sans_lieu'], info: { origine: 'sans_lieu' as const } };
    const cle = d.chemin.join('/');
    const x = dossiers.get(cle) ?? { chemin: d.chemin, photos: [], info: d.info, ...(d.infoParent ? { infoParent: d.infoParent } : {}) };
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
export function appliquerTri(plan: Plan, dossiers: DossierPropose[], idsATrier: Set<string>): Modification | null {
  const creation = new Transaction(plan);
  // Dossier enfant de `parent` pour un nom : un dossier du tri est repris ;
  // un dossier homonyme d'une autre origine n'est jamais mélangé (nom libre).
  const assurer = (parent: string, nom: string, info: InfoTri): string => {
    const freres = [...plan.dossiers.values()].filter((d) => d.parent === parent);
    const autres = new Set(freres.filter((d) => d.origine !== 'tri').map((d) => cleNom(d.nom)));
    const libre = nomLibre(nom, autres);
    const repris = freres.find((d) => d.origine === 'tri' && cleNom(d.nom) === cleNom(libre));
    if (repris) {
      if (!memeInfo(repris.tri, info)) creation.dossier({ ...repris, tri: info });
      return repris.id;
    }
    const id = `n${plan.prochainId++}`;
    creation.dossier({ id, nom: libre, parent, origine: 'tri', tri: info } satisfies DossierPlan);
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
  const nettoyage = new Transaction(plan);
  const utilises = () => new Set([...plan.fichiers.values()].map((f) => f.dossier));
  for (let encore = true; encore; ) {
    encore = false;
    const pleins = utilises();
    const parents = new Set([...plan.dossiers.values()].map((d) => d.parent));
    for (const d of [...plan.dossiers.values()]) {
      const jetable = d.origine === 'tri' || (d.origine === 'source' && d.traitement === 'trier');
      if (d.parent === null || !jetable || pleins.has(d.id) || parents.has(d.id)) continue;
      nettoyage.supprimerDossier(d.id);
      encore = true;
    }
  }
  modifications.push(nettoyage.terminer('Supprimer les dossiers vides'));
  return combiner('Trier par lieux et sorties', ...modifications);
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
  for (const [mois, ids] of [...nonClassees].sort()) resultat.push({ chemin: ['_videos_non_classees', mois], photos: ids, info: { origine: 'sans_lieu' } });
  return resultat;
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
