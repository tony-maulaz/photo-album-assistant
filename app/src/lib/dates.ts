// Date de prise de vue tirée du nom de fichier, quand l'EXIF manque
// (photos WhatsApp, captures d'écran, vidéos, fichiers renommés à la main).

/** Finesse de la date trouvée. */
export type Precision = 'seconde' | 'jour';

export interface DateNom {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
  precision: Precision;
  /** Vrai si le format est en temps universel (Pixel, Facebook), faux pour l'heure locale. */
  utc: boolean;
  /** Motif reconnu, pour l'affichage et le débogage. */
  motif: string;
}

const ANNEE_MIN = 1990;
const ANNEE_MAX = 2099;

function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

function construire(
  motif: string,
  precision: Precision,
  annee: number,
  mois: number,
  jour: number,
  heure = 0,
  minute = 0,
  seconde = 0,
  utc = false,
): DateNom | null {
  if (annee < 100) annee += 2000;
  if (annee < ANNEE_MIN || annee > ANNEE_MAX) return null;
  if (mois < 1 || mois > 12 || jour < 1 || jour > joursDansMois(annee, mois)) return null;
  if (heure > 23 || minute > 59 || seconde > 59) return null;
  return { annee, mois, jour, heure, minute, seconde, precision, utc, motif };
}

function depuisEpoque(motif: string, millisecondes: number): DateNom | null {
  const d = new Date(millisecondes);
  if (Number.isNaN(d.getTime())) return null;
  return construire(
    motif,
    'seconde',
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    true,
  );
}

type Lecteur = (m: RegExpMatchArray) => DateNom | null;

/** Du plus précis au plus général : le premier motif valide l'emporte. */
const MOTIFS: [RegExp, Lecteur][] = [
  // Google Pixel : PXL_20250704_123456789 (temps universel)
  [/^PXL_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i, (m) => construire('pixel', 'seconde', +m[1], +m[2], +m[3], +m[4], +m[5], +m[6], true)],
  // Facebook : FB_IMG_1756281978565 (millisecondes depuis 1970)
  [/^FB_IMG_(\d{13})(?!\d)/i, (m) => depuisEpoque('facebook', +m[1])],
  // WhatsApp : IMG-20250704-WA0012, VID-20250704-WA0003 (jour seulement)
  [/(?:^|[^A-Za-z])(?:IMG|VID|AUD|PTT|DOC|STK)-(\d{4})(\d{2})(\d{2})-WA\d+/i, (m) => construire('whatsapp', 'jour', +m[1], +m[2], +m[3])],
  // Samsung et Android : 20250704_123456, IMG_20250704_123456, Screenshot_20250704-123456_Chrome,
  // VideoCapture_20251012-194609, 20250816_233319(0)
  [
    /(?<!\d)(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?:\d{3})?(?!\d)/,
    (m) => construire('aaaammjj_hhmmss', 'seconde', +m[1], +m[2], +m[3], +m[4], +m[5], +m[6]),
  ],
  // Avec tirets : 2025-01-01-141027990, signal-2025-07-04-123456, 2025-07-04 12.34.56,
  // Capture d’écran 2025-07-04 à 12.34.56
  [
    /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?:[ _-]|\s(?:à|at)\s)(\d{2})[.:h-]?(\d{2})[.:m-]?(\d{2})(?:\d{3})?(?!\d)/,
    (m) => construire('aaaa-mm-jj-hhmmss', 'seconde', +m[1], +m[2], +m[3], +m[4], +m[5], +m[6]),
  ],
  // Date seule avec tirets : 2025-07-04
  [/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/, (m) => construire('aaaa-mm-jj', 'jour', +m[1], +m[2], +m[3])],
  // Date seule compacte : IMG_20250704, Photo 20250704
  [/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/, (m) => construire('aaaammjj', 'jour', +m[1], +m[2], +m[3])],
  // Renommage à la main (convention Theme_Lieu_JJ.MM.AA) : jardin_21.04.25 (2),
  // Annecy_27-28.06.25 (65), 400eme_tir_29.05-01.06.25 (11) → premier jour
  [
    /(?<![\d.])(\d{1,2})(?:-\d{1,2})?\.(\d{1,2})(?:-\d{1,2}\.\d{1,2})?\.(\d{4}|\d{2})(?![\d.])/,
    (m) => construire('jj.mm.aa', 'jour', +m[3], +m[2], +m[1]),
  ],
];

/** Date tirée du nom (avec ou sans extension), ou `null` si aucun motif ne convient. */
export function dateDepuisNom(nom: string): DateNom | null {
  const base = nom.replace(/^.*[\\/]/, '').replace(/\.(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{2,5}$/, '');
  for (const [motif, lire] of MOTIFS) {
    const m = base.match(motif);
    if (m) {
      const d = lire(m);
      if (d) return d;
    }
  }
  return null;
}

/** Écriture « AAAA-MM-JJ HH:MM:SS » (ou « AAAA-MM-JJ » à la précision du jour). */
export function texteDate(d: DateNom): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  const jour = `${p(d.annee, 4)}-${p(d.mois)}-${p(d.jour)}`;
  return d.precision === 'jour' ? jour : `${jour} ${p(d.heure)}:${p(d.minute)}:${p(d.seconde)}`;
}
