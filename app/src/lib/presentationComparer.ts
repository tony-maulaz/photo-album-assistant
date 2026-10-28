// Présentation de « Comparer en grand » (CHARTE C-7.5, choix de l'utilisateur du
// 27.10.2026) : côte à côte si chaque photo y garde au moins la moitié de la
// surface qu'elle aurait seule (« Une à la fois ») et jamais moins de 220 px de
// haut ; sinon une photo à la fois, sa légende à droite et la bande des autres
// photos. Deux photos (une paire) sont toujours côte à côte. Fonctions pures :
// les proportions sont celles des photos affichées (orientation EXIF et quart
// de tour appliqués, lues sur les miniatures), jamais les dimensions brutes du
// fichier.

export type Presentation = 'cote' | 'une';

/** Place disponible pour la scène (entre la ligne d'information et la barre du bas), en pixels. */
export interface Scene {
  largeur: number;
  hauteur: number;
}

/** Mesures de la vue, en pixels (CHARTE C-6, C-7.5). */
export interface MesuresComparer {
  /** Marges de la scène : 24 sur les côtés, 16 en haut et en bas. */
  margeX: number;
  margeY: number;
  /** Écart entre deux cartes, entre la photo, la légende et la bande. */
  ecart: number;
  /** Côte à côte : marge intérieure de la carte, hauteur de la légende sous la photo. */
  margeCarte: number;
  legendeCote: number;
  /** Largeur minimale d'une carte : l'état et ses deux choix y tiennent. */
  carteMin: number;
  /** Une à la fois : largeur de la légende à droite (180 sous 1180 px de large, C-7.6). */
  legendeUne: number;
  legendeUneEtroite: number;
  /** Hauteur minimale d'une photo côte à côte (présentation calculée). */
  hauteurMin: number;
  /** Côte à côte choisi à la main : en dessous, les photos ne servent plus à comparer ; le bouton est désactivé. */
  hauteurMinChoisie: number;
  /** Bande des vignettes : hauteur de l'état sous chaque vignette, marge autour, écart entre deux. */
  bandeEtat: number;
  margeVignette: number;
  ecartVignettes: number;
  vignetteMin: number;
  vignetteMax: number;
  /** Largeur minimale d'une vignette : son état (« 6 · À écarter ») y tient en entier (C-10.4). */
  largeurVignetteMin: number;
}

export const MESURES: MesuresComparer = {
  margeX: 24,
  margeY: 16,
  ecart: 16,
  margeCarte: 8,
  legendeCote: 92,
  carteMin: 240,
  legendeUne: 220,
  legendeUneEtroite: 180,
  hauteurMin: 220,
  hauteurMinChoisie: 80,
  bandeEtat: 28,
  margeVignette: 4,
  ecartVignettes: 4,
  vignetteMin: 48,
  vignetteMax: 96,
  largeurVignetteMin: 124,
};

/** Proportion (largeur / hauteur) d'une photo affichée : celle de sa miniature, inversée après un quart de tour. */
export function proportion(largeur: number, hauteur: number, rotation = 0): number {
  if (!(largeur > 0) || !(hauteur > 0)) return 4 / 3;
  const r = largeur / hauteur;
  return Math.abs(rotation) % 180 === 90 ? 1 / r : r;
}

/** Bande des vignettes : 1 colonne, 2 quand la hauteur manque, 3 au palier « texte agrandi » ; vignettes de 48 à 96 px de haut, cadre 4:3 d'au moins 124 px de large. Toutes visibles jusqu'à 6 (C-7.5). */
export function bandeVignettes(n: number, hauteur: number, m: MesuresComparer = MESURES): { colonnes: number; hauteurVignette: number; largeurVignette: number; largeur: number } {
  const place = hauteur - 2 * m.margeY;
  const brute = (colonnes: number) => {
    const rangees = Math.max(1, Math.ceil(n / colonnes));
    return Math.floor((place - (rangees - 1) * m.ecartVignettes) / rangees - m.bandeEtat - 2 * m.margeVignette);
  };
  const hauteurPour = (colonnes: number) => Math.max(m.vignetteMin, Math.min(m.vignetteMax, brute(colonnes)));
  const colonnes = brute(1) >= 64 || n <= 1 ? 1 : brute(2) >= m.vignetteMin || n <= 2 ? 2 : 3;
  const hauteurVignette = hauteurPour(colonnes);
  const largeurVignette = Math.max(m.largeurVignetteMin, Math.round((hauteurVignette * 4) / 3));
  const largeurCase = largeurVignette + 2 * m.margeVignette;
  return { colonnes, hauteurVignette, largeurVignette, largeur: colonnes * largeurCase + (colonnes - 1) * m.ecartVignettes };
}

/** Une à la fois : la place de la photo (la scène moins la légende à droite et la bande des vignettes). */
export function placeUne(n: number, scene: Scene, m: MesuresComparer = MESURES): Scene {
  const legende = scene.largeur < 1180 ? m.legendeUneEtroite : m.legendeUne;
  const bande = n > 1 ? bandeVignettes(n, scene.hauteur, m).largeur + m.ecart : 0;
  return {
    largeur: Math.max(0, scene.largeur - 2 * m.margeX - legende - m.ecart - bande),
    hauteur: Math.max(0, scene.hauteur - 2 * m.margeY),
  };
}

/** Taille d'une photo de proportion `r` contenue dans `place`. */
export function contenir(r: number, place: Scene): Scene {
  const hauteur = Math.min(place.hauteur, place.largeur / r);
  return { largeur: hauteur * r, hauteur };
}

/** Largeur d'une rangée de cartes à la hauteur `h` : chaque carte a la largeur de sa photo, au moins `carteMin` (son état et ses choix y tiennent). */
export function largeurRangee(ratios: number[], h: number, m: MesuresComparer = MESURES): number {
  return ratios.reduce((a, r) => a + Math.max(h * r + 2 * m.margeCarte, m.carteMin), 0) + Math.max(0, ratios.length - 1) * m.ecart;
}

/** Les photos réparties en `rangees` rangées consécutives (les premières un peu plus pleines). */
export function repartir<T>(liste: T[], rangees: number): T[][] {
  const k = Math.max(1, Math.min(rangees, liste.length));
  const parRangee = Math.ceil(liste.length / k);
  const r: T[][] = [];
  for (let i = 0; i < liste.length; i += parRangee) r.push(liste.slice(i, i + parRangee));
  return r;
}

/**
 * Côte à côte : hauteur commune des photos sur `rangees` rangées de cartes (une par défaut). La carte a
 * la largeur de sa photo, au moins `carteMin` ; chaque rangée tient dans la largeur de la scène. 0 si une
 * rangée ne tient pas même avec des cartes au minimum.
 */
export function hauteurCote(ratios: number[], scene: Scene, m: MesuresComparer = MESURES, rangees = 1): number {
  const n = ratios.length;
  if (!n) return 0;
  const lignes = repartir(ratios, rangees);
  const largeur = scene.largeur - 2 * m.margeX;
  const k = lignes.length;
  let haut = Math.max(0, (scene.hauteur - 2 * m.margeY - k * (2 * m.margeCarte + m.legendeCote) - (k - 1) * m.ecart) / k);
  if (lignes.some((l) => largeurRangee(l, 0, m) > largeur)) return 0;
  if (lignes.every((l) => largeurRangee(l, haut, m) <= largeur)) return haut;
  // La largeur d'une rangée croît avec la hauteur : la plus grande hauteur qui tient, par dichotomie.
  let bas = 0;
  for (let i = 0; i < 40; i++) {
    const h = (bas + haut) / 2;
    if (lignes.every((l) => largeurRangee(l, h, m) <= largeur)) bas = h;
    else haut = h;
  }
  return bas;
}

/**
 * Côte à côte choisi à la main : une rangée si elle tient, sinon le nombre de rangées qui donne les plus
 * grandes photos ; rien ne sort de la scène ni ne défile en largeur (C-7.1). `hauteur` 0 : impossible
 * (photos de moins de `hauteurMinChoisie` px de haut), une paire exceptée.
 */
export function dispositionCote(ratios: number[], scene: Scene, m: MesuresComparer = MESURES): { rangees: number; hauteur: number } {
  let meilleure = { rangees: 1, hauteur: hauteurCote(ratios, scene, m, 1) };
  if (ratios.length <= 2) return meilleure;
  for (let k = 2; k <= Math.min(3, ratios.length); k++) {
    const h = hauteurCote(ratios, scene, m, k);
    if (h > meilleure.hauteur + 0.5) meilleure = { rangees: k, hauteur: h };
  }
  return meilleure.hauteur < m.hauteurMinChoisie ? { rangees: meilleure.rangees, hauteur: 0 } : meilleure;
}

/**
 * La présentation calculée : une paire toujours côte à côte ; à partir de 3 photos, côte à côte (sur une
 * rangée) si chacune y garde au moins la moitié de sa surface en « Une à la fois » et jamais moins de
 * 220 px de haut ; sinon une à la fois. Les cartes ont au moins la largeur de leur état : c'est la
 * rangée entière qui doit tenir, pas chaque photo.
 */
export function choisirPresentation(ratios: number[], scene: Scene, m: MesuresComparer = MESURES): Presentation {
  const n = ratios.length;
  if (n <= 1) return 'une';
  if (n === 2) return 'cote';
  const h = hauteurCote(ratios, scene, m);
  if (h < m.hauteurMin) return 'une';
  const place = placeUne(n, scene, m);
  return ratios.every((r) => {
    const seule = contenir(r, place);
    return h * h * r >= (seule.largeur * seule.hauteur) / 2;
  })
    ? 'cote'
    : 'une';
}

/** Photo affichée à l'ouverture : la photo conseillée (IA, ou la plus nette), sinon la première. */
export function photoOuverture(ids: string[], conseillee?: string): number {
  const i = conseillee ? ids.indexOf(conseillee) : -1;
  return i >= 0 ? i : 0;
}
