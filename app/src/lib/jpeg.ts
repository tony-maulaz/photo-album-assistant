// Dimensions réelles d'un JPEG, lues dans son en-tête (segment SOF) : les
// dimensions de l'EXIF ne sont pas mises à jour par certains logiciels de
// retouche ou de recadrage.

import type { LecteurOctets } from './video';

/** Marqueurs SOF (début de trame) : C0 à CF, sauf C4 (DHT), C8 (JPG) et CC (DAC). */
function estSOF(m: number): boolean {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
}

/** Largeur et hauteur stockées (avant orientation EXIF), ou `null` si ce n'est pas un JPEG lisible. */
export async function dimensionsJpeg(lire: LecteurOctets, taille: number): Promise<{ largeur: number; hauteur: number } | null> {
  const debut = await lire(0, 2);
  if (debut[0] !== 0xff || debut[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= taille) {
    const entete = await lire(i, 9);
    if (entete[0] !== 0xff) return null;
    const marqueur = entete[1];
    if (marqueur === 0xff) {
      i++; // octet de remplissage
      continue;
    }
    if (marqueur === 0xd9 || marqueur === 0xda) return null; // fin d'image ou début des données
    const longueur = (entete[2] << 8) + entete[3];
    if (estSOF(marqueur)) {
      if (entete.length < 9) return null;
      return { hauteur: (entete[5] << 8) + entete[6], largeur: (entete[7] << 8) + entete[8] };
    }
    i += 2 + longueur;
  }
  return null;
}

/** Dimensions à l'affichage, une fois l'orientation EXIF appliquée (5 à 8 : quart de tour). */
export function dimensionsAffichees(d: { largeur: number; hauteur: number }, orientation = 1) {
  return orientation >= 5 && orientation <= 8 ? { largeur: d.hauteur, hauteur: d.largeur } : d;
}

// ---------------------------------------------------------------------------
// Balise Orientation (EXIF 0x0112) : lecture, et rotation sans recompression (P13)
// ---------------------------------------------------------------------------

/** Position de la valeur de la balise Orientation dans le fichier, et ordre des octets. */
function positionOrientation(o: Uint8Array): { pos: number; petitBoutiste: boolean } | null {
  if (o[0] !== 0xff || o[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= o.length && o[i] === 0xff) {
    const marqueur = o[i + 1];
    const longueur = (o[i + 2] << 8) + o[i + 3];
    if (marqueur === 0xda || marqueur === 0xd9) return null;
    // APP1 « Exif\0\0 » suivi d'un en-tête TIFF.
    if (marqueur === 0xe1 && o[i + 4] === 0x45 && o[i + 5] === 0x78 && o[i + 6] === 0x69 && o[i + 7] === 0x66) {
      const tiff = i + 10;
      const petitBoutiste = o[tiff] === 0x49;
      const u16 = (p: number) => (petitBoutiste ? o[p] + (o[p + 1] << 8) : (o[p] << 8) + o[p + 1]);
      const u32 = (p: number) => (petitBoutiste ? u16(p) + u16(p + 2) * 65536 : u16(p) * 65536 + u16(p + 2));
      const ifd0 = tiff + u32(tiff + 4);
      if (ifd0 + 2 > o.length) return null;
      const n = u16(ifd0);
      for (let k = 0; k < n; k++) {
        const e = ifd0 + 2 + k * 12;
        if (e + 12 > o.length) return null;
        if (u16(e) === 0x0112) return { pos: e + 8, petitBoutiste };
      }
      return null;
    }
    i += 2 + longueur;
  }
  return null;
}

/** Orientation EXIF d'un JPEG (1 à 8), ou `null` si la balise est absente. */
export function orientationJpeg(o: Uint8Array): number | null {
  const p = positionOrientation(o);
  if (!p) return null;
  return p.petitBoutiste ? o[p.pos] + (o[p.pos + 1] << 8) : (o[p.pos] << 8) + o[p.pos + 1];
}

/** Copie du JPEG avec une autre valeur d'Orientation (même taille), ou `null` sans balise à modifier. */
export function changerOrientation(o: Uint8Array, valeur: number): Uint8Array | null {
  const p = positionOrientation(o);
  if (!p) return null;
  const copie = o.slice();
  copie[p.pos] = p.petitBoutiste ? valeur & 0xff : valeur >> 8;
  copie[p.pos + 1] = p.petitBoutiste ? valeur >> 8 : valeur & 0xff;
  return copie;
}

/** Orientation après une rotation supplémentaire (sens horaire), miroirs compris. */
export function orientationApresRotation(orientation: number, degres: number): number {
  const cycles = [
    [1, 6, 3, 8],
    [2, 7, 4, 5],
  ];
  const quarts = (((degres / 90) % 4) + 4) % 4;
  for (const c of cycles) {
    const i = c.indexOf(orientation);
    if (i >= 0) return c[(i + quarts) % 4];
  }
  return orientation;
}

// ---------------------------------------------------------------------------
// Données EXIF reportées sur une copie réencodée (recadrage, D62)
// ---------------------------------------------------------------------------

/**
 * Segment APP1 EXIF complet (marqueur compris), prêt pour une copie
 * réencodée : orientation remise à 1 (la copie est déjà à l'endroit),
 * vignette retirée (IFD1 : elle montrerait la photo entière dans les
 * explorateurs de fichiers et à l'import du livre photo) et, avec
 * `dimensions`, la taille en pixels de la copie. `null` sans EXIF.
 */
export function segmentExif(o: Uint8Array, dimensions?: { largeur: number; hauteur: number }): Uint8Array | null {
  if (o[0] !== 0xff || o[1] !== 0xd8) return null;
  const source = changerOrientation(o, 1) ?? o;
  let i = 2;
  while (i + 4 <= source.length && source[i] === 0xff) {
    const marqueur = source[i + 1];
    const longueur = (source[i + 2] << 8) + source[i + 3];
    if (marqueur === 0xda || marqueur === 0xd9) return null;
    if (marqueur === 0xe1 && source[i + 4] === 0x45 && source[i + 5] === 0x78 && source[i + 6] === 0x69 && source[i + 7] === 0x66) {
      const segment = source.slice(i, i + 2 + longueur);
      ajusterExif(segment, dimensions);
      return segment;
    }
    i += 2 + longueur;
  }
  return null;
}

/** Balises de taille en pixels : ImageWidth et ImageLength (IFD0), PixelXDimension et PixelYDimension (sous-IFD Exif). */
const LARGEUR = [0x0100, 0xa002];
const HAUTEUR = [0x0101, 0xa003];
/** Pointeur vers le sous-IFD Exif. */
const IFD_EXIF = 0x8769;

/**
 * Dans un segment APP1 EXIF (modifié sur place) : plus de vignette (IFD0 ne
 * renvoie plus vers IFD1) et la taille en pixels de la copie. Un EXIF mal formé
 * est laissé tel quel là où il le serait : jamais de lecture hors du segment.
 */
function ajusterExif(s: Uint8Array, dimensions?: { largeur: number; hauteur: number }): void {
  const tiff = 10;
  if (s.length < tiff + 8) return;
  const petitBoutiste = s[tiff] === 0x49;
  const u16 = (p: number) => (petitBoutiste ? s[p] + (s[p + 1] << 8) : (s[p] << 8) + s[p + 1]);
  const u32 = (p: number) => (petitBoutiste ? u16(p) + u16(p + 2) * 65536 : u16(p) * 65536 + u16(p + 2));
  const e16 = (p: number, v: number) => {
    s[p] = petitBoutiste ? v & 0xff : (v >> 8) & 0xff;
    s[p + 1] = petitBoutiste ? (v >> 8) & 0xff : v & 0xff;
  };
  const e32 = (p: number, v: number) => {
    e16(petitBoutiste ? p : p + 2, v & 0xffff);
    e16(petitBoutiste ? p + 2 : p, Math.floor(v / 65536) & 0xffff);
  };
  /** Parcourt un IFD : la taille en pixels y est remplacée ; rend la position du lien vers l'IFD suivant, et celle du sous-IFD Exif. */
  const ajusterIfd = (ifd: number): { suivant: number | null; exif: number | null } => {
    if (ifd < tiff || ifd + 2 > s.length) return { suivant: null, exif: null };
    const n = u16(ifd);
    let exif: number | null = null;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > s.length) return { suivant: null, exif };
      const balise = u16(e);
      const type = u16(e + 2);
      if (balise === IFD_EXIF) exif = tiff + u32(e + 8);
      const valeur = LARGEUR.includes(balise) ? dimensions?.largeur : HAUTEUR.includes(balise) ? dimensions?.hauteur : undefined;
      if (valeur === undefined || u32(e + 4) !== 1) continue;
      // SHORT (3) : la valeur occupe les deux premiers octets du champ ; LONG (4) : les quatre.
      if (type === 3) {
        e16(e + 8, Math.min(valeur, 0xffff));
        e16(e + 10, 0);
      } else if (type === 4) e32(e + 8, valeur);
    }
    const suivant = ifd + 2 + n * 12;
    return { suivant: suivant + 4 <= s.length ? suivant : null, exif };
  };
  const ifd0 = ajusterIfd(tiff + u32(tiff + 4));
  if (ifd0.suivant !== null) e32(ifd0.suivant, 0);
  if (ifd0.exif !== null) ajusterIfd(ifd0.exif);
}

/** Le JPEG `nouveau` avec le segment EXIF `exif` juste après le début de l'image, à la place de l'en-tête JFIF du navigateur. */
export function avecExif(nouveau: Uint8Array, exif: Uint8Array): Uint8Array {
  const suite = nouveau[2] === 0xff && nouveau[3] === 0xe0 ? 4 + (nouveau[4] << 8) + nouveau[5] : 2;
  const r = new Uint8Array(2 + exif.length + nouveau.length - suite);
  r.set(nouveau.subarray(0, 2), 0);
  r.set(exif, 2);
  r.set(nouveau.subarray(suite), 2 + exif.length);
  return r;
}
