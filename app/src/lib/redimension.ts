// Réductions d'image identiques à celles des scripts Python, pour garder les
// seuils calibrés (netteté 60, distances de ressemblance 12 et 20).

import type { ImageGrise } from './image';

// ---------------------------------------------------------------------------
// Lanczos de Pillow (Image.resize(..., LANCZOS)), utilisé par imagehash.phash
// ---------------------------------------------------------------------------

/** Bits de précision des coefficients de Pillow pour les images 8 bits. */
const PRECISION = 22;

function sinc(x: number): number {
  if (x === 0) return 1;
  const px = x * Math.PI;
  return Math.sin(px) / px;
}

function lanczos(x: number): number {
  return x >= -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0;
}

interface Coefficients {
  bornes: Int32Array; // [début, nombre] pour chaque pixel de sortie
  poids: Int32Array; // coefficients en virgule fixe, `taille` par pixel de sortie
  taille: number;
}

/** Copie de `precompute_coeffs` puis `normalize_coeffs_8bpc` (Pillow, Resample.c). */
function coefficientsLanczos(entree: number, sortie: number): Coefficients {
  const echelle = entree / sortie;
  const echelleFiltre = Math.max(echelle, 1);
  const support = 3 * echelleFiltre;
  const taille = Math.ceil(support) * 2 + 1;
  const bornes = new Int32Array(sortie * 2);
  const poids = new Int32Array(sortie * taille);
  const brut = new Float64Array(taille);
  const ss = 1 / echelleFiltre;
  for (let xx = 0; xx < sortie; xx++) {
    const centre = (xx + 0.5) * echelle;
    const xmin = Math.max(Math.trunc(centre - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(centre + support + 0.5), entree) - xmin;
    let somme = 0;
    for (let x = 0; x < xmax; x++) {
      const w = lanczos((x + xmin - centre + 0.5) * ss);
      brut[x] = w;
      somme += w;
    }
    for (let x = 0; x < xmax; x++) {
      const v = (somme !== 0 ? brut[x] / somme : brut[x]) * (1 << PRECISION);
      poids[xx * taille + x] = v < 0 ? Math.trunc(-0.5 + v) : Math.trunc(0.5 + v);
    }
    bornes[xx * 2] = xmin;
    bornes[xx * 2 + 1] = xmax;
  }
  return { bornes, poids, taille };
}

function clip8(v: number): number {
  const r = v >> PRECISION;
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

/**
 * Réduction Lanczos identique à Pillow pour une image en niveaux de gris :
 * passe horizontale puis verticale, arrondi 8 bits entre les deux.
 */
export function redimensionnerLanczosPillow(img: ImageGrise, largeur: number, hauteur: number): ImageGrise {
  let courante = img;
  if (largeur !== img.largeur) {
    const { bornes, poids, taille } = coefficientsLanczos(img.largeur, largeur);
    const src = img.donnees;
    const dst = new Uint8Array(largeur * img.hauteur);
    for (let y = 0; y < img.hauteur; y++) {
      const ligne = y * img.largeur;
      for (let xx = 0; xx < largeur; xx++) {
        const debut = bornes[xx * 2];
        const n = bornes[xx * 2 + 1];
        const k = xx * taille;
        let s = 1 << (PRECISION - 1);
        for (let x = 0; x < n; x++) s += src[ligne + debut + x] * poids[k + x];
        dst[y * largeur + xx] = clip8(s);
      }
    }
    courante = { largeur, hauteur: img.hauteur, donnees: dst };
  }
  if (hauteur !== courante.hauteur) {
    const { bornes, poids, taille } = coefficientsLanczos(courante.hauteur, hauteur);
    const src = courante.donnees;
    const w = courante.largeur;
    const dst = new Uint8Array(w * hauteur);
    for (let yy = 0; yy < hauteur; yy++) {
      const debut = bornes[yy * 2];
      const n = bornes[yy * 2 + 1];
      const k = yy * taille;
      for (let x = 0; x < w; x++) {
        let s = 1 << (PRECISION - 1);
        for (let y = 0; y < n; y++) s += src[(debut + y) * w + x] * poids[k + y];
        dst[yy * w + x] = clip8(s);
      }
    }
    courante = { largeur: w, hauteur, donnees: dst };
  }
  return courante;
}

// ---------------------------------------------------------------------------
// Bilinéaire d'OpenCV (cv2.resize, INTER_LINEAR), utilisé pour la netteté
// ---------------------------------------------------------------------------

/** Échelle des coefficients d'OpenCV (INTER_RESIZE_COEF_SCALE). */
const UN = 2048;

/** Arrondi au pair le plus proche, comme cvRound. */
function arrondiPair(v: number): number {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Positions et coefficients d'un axe, calculés en flottants 32 bits comme OpenCV. */
function axeBilineaire(entree: number, sortie: number, echelle: number, borderX: boolean) {
  const positions = new Int32Array(sortie);
  const coefs = new Int32Array(sortie * 2);
  for (let d = 0; d < sortie; d++) {
    let f = Math.fround((d + 0.5) * echelle - 0.5);
    let s = Math.floor(f);
    f = Math.fround(f - s);
    if (borderX) {
      if (s < 0) {
        f = 0;
        s = 0;
      }
      if (s >= entree - 1) {
        f = 0;
        s = entree - 1;
      }
    }
    positions[d] = s;
    coefs[d * 2] = arrondiPair(Math.fround(Math.fround(1 - f) * UN));
    coefs[d * 2 + 1] = arrondiPair(Math.fround(f * UN));
  }
  return { positions, coefs };
}

/** Moyenne 2×2 (INTER_AREA rapide), qu'OpenCV substitue pour une réduction exacte de moitié. */
function moitieAire(img: ImageGrise, largeur: number, hauteur: number): ImageGrise {
  const src = img.donnees;
  const w = img.largeur;
  const dst = new Uint8Array(largeur * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const l0 = 2 * y * w;
    const l1 = l0 + w;
    for (let x = 0; x < largeur; x++) {
      const i = 2 * x;
      dst[y * largeur + x] = (src[l0 + i] + src[l0 + i + 1] + src[l1 + i] + src[l1 + i + 1] + 2) >> 2;
    }
  }
  return { largeur, hauteur, donnees: dst };
}

/**
 * Réduction bilinéaire identique à `cv2.resize(img, (largeur, hauteur))`
 * (virgule fixe 11 bits ; combinaison verticale selon la voie vectorielle
 * d'OpenCV, qui traite presque tous les pixels).
 */
export function redimensionnerBilineaireOpenCV(img: ImageGrise, largeur: number, hauteur: number): ImageGrise {
  const echelleX = 1 / (largeur / img.largeur);
  const echelleY = 1 / (hauteur / img.hauteur);
  if (echelleX === 2 && echelleY === 2) return moitieAire(img, largeur, hauteur);

  const w = img.largeur;
  const h = img.hauteur;
  const src = img.donnees;
  const hx = axeBilineaire(w, largeur, echelleX, true);
  const vy = axeBilineaire(h, hauteur, echelleY, false);

  // Passe horizontale sur les seules lignes utiles, mise en cache par numéro de ligne.
  const cache = new Map<number, Int32Array>();
  const ligneHorizontale = (y: number): Int32Array => {
    const yc = y < 0 ? 0 : y >= h ? h - 1 : y;
    let l = cache.get(yc);
    if (l) return l;
    l = new Int32Array(largeur);
    const base = yc * w;
    for (let dx = 0; dx < largeur; dx++) {
      const sx = hx.positions[dx];
      const a1 = hx.coefs[dx * 2 + 1];
      l[dx] = a1 === 0 ? src[base + sx] * hx.coefs[dx * 2] : src[base + sx] * hx.coefs[dx * 2] + src[base + sx + 1] * a1;
    }
    cache.set(yc, l);
    return l;
  };

  const dst = new Uint8Array(largeur * hauteur);
  for (let dy = 0; dy < hauteur; dy++) {
    const sy = vy.positions[dy];
    const b0 = vy.coefs[dy * 2];
    const b1 = vy.coefs[dy * 2 + 1];
    const s0 = ligneHorizontale(sy);
    const s1 = ligneHorizontale(sy + 1);
    for (let x = 0; x < largeur; x++) {
      const v = ((((s0[x] >> 4) * b0) >> 16) + (((s1[x] >> 4) * b1) >> 16) + 2) >> 2;
      dst[dy * largeur + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    // Les lignes déjà dépassées ne resserviront plus.
    if (cache.size > 4) for (const cle of cache.keys()) if (cle < sy) cache.delete(cle);
  }
  return { largeur, hauteur, donnees: dst };
}
