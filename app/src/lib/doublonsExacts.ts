// Doublons exacts de photos (SPEC § 6.2, D31, D61) : même contenu (empreinte
// SHA-256), ou même photo en version réduite (WhatsApp : sans EXIF, plus
// petite, très semblable). L'utilisateur choisit les exemplaires à garder ;
// la proposition n'écarte que ce qui ferait double emploi au même endroit :
// elle garde le meilleur exemplaire de chaque emplacement (un dossier qui
// garde sa place, ou les photos à trier), version réduite comprise quand elle
// y est seule (D86). Une photo à trier qui a déjà sa place dans un dossier
// « Garder, nettoyer » n'est pas triée une seconde fois ; si ce dossier n'en
// a qu'une version réduite, l'original y prend sa place (D71). Les autres
// exemplaires sont proposés pour `_mis_de_cote/doublons_exacts/`.

export interface PhotoExacte {
  id: string;
  nom: string;
  /** Dossier (du plan ou de la source) : sert à départager deux copies d'un même dossier. */
  dossier: string;
  taille: number;
  /** SHA-256 du contenu, calculé seulement pour les candidats (`candidatsEmpreinte`). */
  empreinte?: string;
  /** Phash de l'image à l'endroit (16 chiffres hexadécimaux). */
  phash?: string;
  /** Dimensions stockées dans le fichier. */
  dims?: { l: number; h: number };
  /** La photo porte une date EXIF (une copie WhatsApp n'en a plus). */
  exif: boolean;
  /** Où est la photo : l'identifiant d'un dossier qui garde sa place, ou une même valeur pour toutes les photos à trier. */
  emplacement: string;
  /**
   * Genre de l'emplacement : `a_trier` (racine, dossiers « Trier » : le tri les
   * répartira), `nettoyer` (dossier « Garder, nettoyer » : la photo y a déjà sa
   * place), `tel_quel` (dossier d'une archive déjà triée).
   */
  genre: GenreEmplacement;
}

export type GenreEmplacement = 'a_trier' | 'nettoyer' | 'tel_quel';

export interface GroupeExact {
  /** Le meilleur exemplaire (EXIF, le plus grand…) ; celui d'un dossier « Garder, nettoyer » plutôt qu'un exemplaire à trier. */
  garde: string;
  copies: { id: string; type: 'identique' | 'reduite' }[];
  /**
   * Proposition : les exemplaires à garder, le meilleur de chaque emplacement
   * (une version réduite seulement dans un dossier gardé où elle est seule) ;
   * aucun exemplaire à trier quand la photo est déjà dans un dossier « Garder,
   * nettoyer ».
   */
  aGarder: string[];
  /**
   * Version réduite rangée dans un dossier « Garder, nettoyer », original à
   * trier : l'original (`garde`) est proposé dans ce dossier, à la place de la
   * copie, qui est écartée (D71).
   */
  remplacement?: { original: string; copie: string; dossier: string };
}

/**
 * Distance maximale (bits du phash) entre une photo et sa version réduite.
 * Réduire et recompresser une photo change son phash de 0 à 2 bits (voie
 * rapide à 1024 px contre décodage complet, D29) ; deux photos différentes
 * d'une même rafale sont souvent à moins de 12. Avec 4, la marge couvre la
 * recompression WhatsApp sans rapprocher deux prises de vue différentes, d'autant
 * que la copie doit aussi être sans EXIF, plus petite et de même format.
 */
export const DISTANCE_REDUITE = 4;
/** Écart toléré entre les rapports largeur / hauteur d'une photo et de sa copie réduite. */
const TOLERANCE_FORMAT = 0.02;

/** Groupes de photos de même taille en octets : les seules dont l'empreinte vaut la peine d'être calculée. */
export function candidatsEmpreinte(photos: { id: string; taille: number }[]): string[][] {
  const parTaille = new Map<number, string[]>();
  for (const p of photos) {
    if (p.taille <= 0) continue;
    parTaille.set(p.taille, [...(parTaille.get(p.taille) ?? []), p.id]);
  }
  return [...parTaille.values()].filter((g) => g.length > 1);
}

/** Noms générés par les appareils et applications (idée de `nom_descriptif` du script 01). */
const GENERIQUES = [
  /^img[-_ ]?\d+/,
  /^dsc[nf]?[-_ ]?\d+/,
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
  /^(signal|telegram|messenger|snapchat|facebook|instagram|fb_img)/,
  /^(copie|copy|edited|modifi)/,
  /^(vlc|snapshot|videocapture|untitled|resized|recadr)/,
];

/** Le nom a-t-il été donné à la main (« Anniversaire Lea.jpg ») plutôt que par l'appareil ? */
export function nomParlant(nom: string): boolean {
  let base = nom.replace(/\.[^.]+$/, '').trim();
  base = base.replace(/[\s_-]*\(\d+\)$/, '');
  const n = base.toLowerCase();
  if (GENERIQUES.some((m) => m.test(n))) return false;
  return (base.match(/\p{L}/gu) ?? []).length >= 4 && base.length <= 60;
}

/** Nom marqué comme copie par le système : « IMG_1 (1).jpg », « photo - Copie.jpg », « Copie de … ». */
function marqueDeCopie(nom: string): boolean {
  const base = nom.replace(/\.[^.]+$/, '').trim();
  return /\(\d+\)$/.test(base) || /(^|[\s_-])(copie|copy)([\s_-]|$)/i.test(base);
}

/** Phash en deux moitiés de 32 bits, pour comparer vite. */
function moities(phash?: string): [number, number] | null {
  return phash && /^[0-9a-f]{16}$/i.test(phash) ? [parseInt(phash.slice(0, 8), 16), parseInt(phash.slice(8), 16)] : null;
}

function bits(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function aire(p: PhotoExacte): number {
  return p.dims ? p.dims.l * p.dims.h : 0;
}

/** Rapport côté long / côté court : indépendant de l'orientation (une copie WhatsApp est déjà à l'endroit). */
function format(p: PhotoExacte): number {
  return p.dims ? Math.max(p.dims.l, p.dims.h) / Math.min(p.dims.l, p.dims.h) : 0;
}

/** Ordre de préférence : EXIF, plus grande, plus lourde, nom parlant, nom sans marque de copie, puis identifiant (résultat stable). */
function meilleure(a: PhotoExacte, b: PhotoExacte): number {
  return (
    Number(b.exif) - Number(a.exif) ||
    aire(b) - aire(a) ||
    b.taille - a.taille ||
    Number(nomParlant(b.nom)) - Number(nomParlant(a.nom)) ||
    Number(marqueDeCopie(a.nom)) - Number(marqueDeCopie(b.nom)) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Groupes de doublons exacts : chaque groupe a une photo gardée et des copies
 * à mettre de côté. Une photo avec EXIF n'est jamais une « copie réduite » :
 * deux originaux très semblables (une rafale) relèvent de l'étape « Doublons ».
 */
export function groupesDoublonsExacts(photos: PhotoExacte[]): GroupeExact[] {
  // 1. Contenus identiques (même empreinte).
  const contenus = new Map<string, PhotoExacte[]>();
  for (const p of photos) {
    const cle = p.empreinte ? `e:${p.empreinte}` : `i:${p.id}`;
    contenus.set(cle, [...(contenus.get(cle) ?? []), p]);
  }
  const groupes = [...contenus.values()].map((membres) => [...membres].sort(meilleure));

  // 2. Versions réduites : chaque contenu sans EXIF est rattaché au plus grand original qui lui correspond.
  const tete = (g: PhotoExacte[]) => g[0];
  const references = groupes
    .map((g) => ({ g, p: tete(g), h: moities(tete(g).phash) }))
    .filter((x) => x.h && x.p.dims)
    .sort((x, y) => meilleure(x.p, y.p));
  const rattaches = new Map<PhotoExacte[], PhotoExacte[][]>();
  const absorbes = new Set<PhotoExacte[]>();
  for (const g of groupes) {
    const p = tete(g);
    const h = moities(p.phash);
    if (p.exif || !h || !p.dims) continue;
    const cible = references.find(
      (r) =>
        r.g !== g &&
        aire(r.p) > aire(p) &&
        Math.max(r.p.dims!.l, r.p.dims!.h) > Math.max(p.dims!.l, p.dims!.h) &&
        Math.abs(format(r.p) - format(p)) <= TOLERANCE_FORMAT * format(r.p) &&
        bits(r.h![0] ^ h[0]) + bits(r.h![1] ^ h[1]) <= DISTANCE_REDUITE,
    );
    if (!cible) continue;
    rattaches.set(cible.g, [...(rattaches.get(cible.g) ?? []), g]);
    absorbes.add(g);
  }

  // 3. Un groupe par original : ses copies identiques, puis ses versions réduites
  // (y compris celles rattachées à une autre version réduite, plus grande).
  const reduitesDe = (g: PhotoExacte[]): PhotoExacte[] => (rattaches.get(g) ?? []).flatMap((r) => [...r, ...reduitesDe(r)]);
  const resultat: GroupeExact[] = [];
  for (const g of groupes) {
    if (absorbes.has(g)) continue;
    const reduites = reduitesDe(g);
    if (g.length + reduites.length < 2) continue;
    // Déjà dans un dossier « Garder, nettoyer » : la photo a sa place, ses
    // exemplaires à trier passent en dernier et sont proposés à l'écart (sinon
    // le tri la rangerait une seconde fois dans un nouveau dossier).
    const dejaRangee = g.some((p) => p.genre === 'nettoyer');
    const ordre = dejaRangee ? [...g.filter((p) => p.genre !== 'a_trier'), ...g.filter((p) => p.genre === 'a_trier')] : g;
    // Seule une version réduite est déjà rangée : le meilleur original à trier la remplacera.
    const reduiteRangee = !dejaRangee && ordre[0].genre === 'a_trier' ? reduites.find((p) => p.genre === 'nettoyer') : undefined;
    // Le meilleur exemplaire de chaque emplacement (g est trié du meilleur au moins bon).
    const aGarder: string[] = [];
    const emplacements = new Set<string>();
    for (const p of ordre) {
      if (emplacements.has(p.emplacement) || (dejaRangee && p.genre === 'a_trier')) continue;
      emplacements.add(p.emplacement);
      aGarder.push(p.id);
    }
    // Une version réduite seule dans un dossier gardé y reste, comme tout exemplaire rangé dans un autre
    // dossier (D86) ; sauf celle que l'original à trier vient remplacer.
    for (const p of [...reduites].sort(meilleure)) {
      if (p.genre === 'a_trier' || p === reduiteRangee || emplacements.has(p.emplacement)) continue;
      emplacements.add(p.emplacement);
      aGarder.push(p.id);
    }
    resultat.push({
      garde: ordre[0].id,
      copies: [...ordre.slice(1).map((p) => ({ id: p.id, type: 'identique' as const })), ...reduites.map((p) => ({ id: p.id, type: 'reduite' as const }))],
      aGarder,
      ...(reduiteRangee && { remplacement: { original: ordre[0].id, copie: reduiteRangee.id, dossier: reduiteRangee.dossier } }),
    });
  }
  return resultat.sort((a, b) => a.garde.localeCompare(b.garde));
}
