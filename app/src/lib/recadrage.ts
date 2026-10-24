// Recadrage d'une photo pour l'album (étape « Sélection », D62) : un rectangle
// en fractions de l'image tournée, et un redressement de quelques degrés. La
// même géométrie sert à l'aperçu à l'écran et à la copie écrite dans Album/ :
// ce qu'on voit est ce qui est imprimé. L'archive et la source ne changent pas.

export interface Recadrage {
  /** Rectangle gardé, en fractions de l'image tournée (0 à 1). */
  x: number;
  y: number;
  l: number;
  h: number;
  /** Redressement en degrés (sens horaire), de -ANGLE_MAX à ANGLE_MAX. */
  angle: number;
}

export const ANGLE_MAX = 15;

/** Formats proposés, largeur / hauteur de l'image recadrée (0 : libre). */
export const FORMATS: { cle: string; ratio: number }[] = [
  { cle: 'libre', ratio: 0 },
  { cle: '3:2', ratio: 3 / 2 },
  { cle: '4:3', ratio: 4 / 3 },
  { cle: '1:1', ratio: 1 },
];

export const RECADRAGE_COMPLET: Recadrage = { x: 0, y: 0, l: 1, h: 1, angle: 0 };

/**
 * Dimensions de l'image après le quart de tour, et agrandissement qui évite
 * les coins vides quand on la redresse (l'image tournée de `angle` doit
 * couvrir tout le cadre).
 */
export function cadre(largeur: number, hauteur: number, rotation: number, angle: number): { l: number; h: number; echelle: number } {
  const quart = rotation === 90 || rotation === 270;
  const l = quart ? hauteur : largeur;
  const h = quart ? largeur : hauteur;
  const a = (Math.abs(angle) * Math.PI) / 180;
  return { l, h, echelle: Math.cos(a) + Math.max(l / h, h / l) * Math.sin(a) };
}

const borne = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Le plus grand rectangle au format `ratio` (largeur / hauteur en pixels) dans
 * une image de `l` × `h`, centré au plus près du centre du rectangle `r`.
 */
export function auFormat(r: Recadrage, ratio: number, l: number, h: number): Recadrage {
  if (!ratio) return r;
  // En fractions de l'image, largeur / hauteur = ratio × h / l.
  const k = (ratio * h) / l;
  const lf = k >= 1 ? 1 : k;
  const hf = k >= 1 ? 1 / k : 1;
  return { ...r, x: borne(r.x + r.l / 2 - lf / 2, 0, 1 - lf), y: borne(r.y + r.h / 2 - hf / 2, 0, 1 - hf), l: lf, h: hf };
}

/** Le recadrage change-t-il quelque chose (un bord coupé, ou un redressement) ? */
export function recadrageUtile(r: Recadrage | undefined): r is Recadrage {
  if (!r) return false;
  const e = 0.002;
  return Math.abs(r.angle) > 0.05 || r.x > e || r.y > e || r.l < 1 - e || r.h < 1 - e;
}

/** Recadrage arrondi (identique d'une session à l'autre) et ramené dans l'image. */
export function normaliser(r: Recadrage): Recadrage {
  const arrondi = (v: number) => Math.round(v * 10000) / 10000;
  const l = borne(r.l, 0.02, 1);
  const h = borne(r.h, 0.02, 1);
  return { x: arrondi(borne(r.x, 0, 1 - l)), y: arrondi(borne(r.y, 0, 1 - h)), l: arrondi(l), h: arrondi(h), angle: Math.round(borne(r.angle, -ANGLE_MAX, ANGLE_MAX) * 10) / 10 };
}

/**
 * Recadrage après un quart de tour de plus (sens horaire si `sens` = 90) : le
 * rectangle est en fractions de l'image tournée, il tourne donc avec elle pour
 * garder la même partie de la photo. Le redressement est inchangé : il tourne
 * l'image autour du centre du cadre, comme le quart de tour, et l'agrandissement
 * qui évite les coins vides ne dépend pas du sens du cadre.
 */
export function tournerRecadrage(r: Recadrage, sens: 90 | -90): Recadrage {
  const tourne = sens === 90 ? { x: 1 - r.y - r.h, y: r.x } : { x: r.y, y: 1 - r.x - r.l };
  return normaliser({ ...tourne, l: r.h, h: r.l, angle: r.angle });
}

/** Signature d'un recadrage, pour savoir si une copie de l'album est encore la bonne. */
export function signatureRecadrage(r: Recadrage | undefined): string {
  return recadrageUtile(r) ? [r.x, r.y, r.l, r.h, r.angle].join(',') : '';
}

/** Taille en pixels de l'image recadrée. */
export function tailleRecadree(largeur: number, hauteur: number, rotation: number, r: Recadrage): { l: number; h: number } {
  const c = cadre(largeur, hauteur, rotation, r.angle);
  return { l: Math.max(1, Math.round(c.l * r.l)), h: Math.max(1, Math.round(c.h * r.h)) };
}

type Contexte2D = Pick<CanvasRenderingContext2D, 'save' | 'restore' | 'scale' | 'translate' | 'rotate' | 'drawImage'>;

/**
 * Dessine la photo tournée, redressée et recadrée. `source` est à l'endroit
 * (orientation EXIF déjà appliquée), de `largeur` × `hauteur` ; le contexte
 * fait `tailleRecadree` × `facteur`.
 */
export function dessinerRecadrage(ctx: Contexte2D, source: CanvasImageSource, largeur: number, hauteur: number, rotation: number, r: Recadrage, facteur = 1): void {
  const c = cadre(largeur, hauteur, rotation, r.angle);
  ctx.save();
  ctx.scale(facteur, facteur);
  ctx.translate(-r.x * c.l, -r.y * c.h);
  ctx.translate(c.l / 2, c.h / 2);
  ctx.rotate((r.angle * Math.PI) / 180);
  ctx.scale(c.echelle, c.echelle);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(source, -largeur / 2, -hauteur / 2);
  ctx.restore();
}
