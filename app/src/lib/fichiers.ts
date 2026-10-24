// Catégorie d'un fichier d'après son extension.

export type Categorie = 'photo' | 'video' | 'autre';

/** Extensions photo des scripts (REFERENCE_SCRIPTS § 2). */
export const EXTENSIONS_PHOTO = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tif', '.tiff', '.bmp', '.gif'];
export const EXTENSIONS_VIDEO = ['.mp4', '.mov', '.m4v', '.3gp', '.avi', '.mkv', '.mts', '.m2ts', '.wmv', '.webm'];

export function extension(nom: string): string {
  const i = nom.lastIndexOf('.');
  return i > 0 ? nom.slice(i).toLowerCase() : '';
}

export function categorie(nom: string): Categorie {
  const ext = extension(nom);
  if (EXTENSIONS_PHOTO.includes(ext)) return 'photo';
  if (EXTENSIONS_VIDEO.includes(ext)) return 'video';
  return 'autre';
}

// ---------------------------------------------------------------------------
// Captures d'écran (étape 2)
// ---------------------------------------------------------------------------

/** Noms donnés par les téléphones et ordinateurs aux captures d'écran. */
const NOMS_CAPTURE = [
  /^screenshot/,
  /^screen[ _-]?shot/,
  /^capture[ _-]?d[’'_ -]?(e|é)cran/,
  /^capture[ _-]?(e|é)cran/,
  /^scr_\d/,
  /^bildschirmfoto/,
  /^schermata/,
  /^captura[ _-]de[ _-]pantalla/,
];

/** Écrans de téléphone courants (portrait) : une photo n'a jamais ces dimensions. */
const ECRANS_TELEPHONE = [
  [720, 1280],
  [720, 1600],
  [750, 1334],
  [828, 1792],
  [1080, 1920],
  [1080, 2160],
  [1080, 2220],
  [1080, 2280],
  [1080, 2340],
  [1080, 2400],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2208],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
  [1440, 2560],
  [1440, 2960],
  [1440, 3040],
  [1440, 3088],
  [1440, 3120],
  [1440, 3200],
];

/** Écrans d'ordinateur courants (paysage). */
const ECRANS_ORDINATEUR = [
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1600, 900],
  [1680, 1050],
  [1920, 1080],
  [1920, 1200],
  [2560, 1440],
  [2560, 1600],
  [2880, 1800],
  [3024, 1964],
  [3456, 2234],
];

function dimensionsDans(dims: { l: number; h: number }, liste: number[][]): boolean {
  return liste.some(([a, b]) => (dims.l === a && dims.h === b) || (dims.l === b && dims.h === a));
}

/**
 * Capture d'écran (SPEC § 6.2) : nom explicite ; sinon, sans marque
 * d'appareil, aux dimensions d'un écran (PNG : téléphone ou ordinateur ;
 * JPEG : téléphone en portrait seulement, un JPEG aux dimensions d'un écran
 * d'ordinateur pouvant être une image de vidéo ou un fond d'écran). En cas de doute, ce
 * n'est pas une capture : la photo reste dans le tri.
 */
export function estCapture(f: { nom: string; marque?: string; appareil?: string; dims?: { l: number; h: number }; extension?: string }): boolean {
  const nom = f.nom.split('/').pop()!.toLowerCase();
  if (NOMS_CAPTURE.some((m) => m.test(nom))) return true;
  if (f.marque?.trim() || f.appareil?.trim() || !f.dims) return false;
  const ext = (f.extension ?? extension(nom)).toLowerCase();
  if (ext === '.png') return dimensionsDans(f.dims, ECRANS_TELEPHONE) || dimensionsDans(f.dims, ECRANS_ORDINATEUR);
  // En paysage, 1920 × 1080 en JPEG est aussi une image de vidéo : seul le portrait compte.
  if (ext === '.jpg' || ext === '.jpeg') return f.dims.h > f.dims.l && dimensionsDans(f.dims, ECRANS_TELEPHONE);
  return false;
}
