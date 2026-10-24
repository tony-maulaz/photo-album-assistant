// Hachage perceptuel identique à `imagehash.phash` (scripts 02, 03, 05, 06) :
// niveaux de gris, réduction Lanczos 32×32, DCT 2D, bloc 8×8, médiane.

import { grisPillow, type ImageRVBA } from './image';
import { redimensionnerLanczosPillow } from './redimension';

const N = 32;
const K = 8;

/** cos(π k (2n+1) / 2N) pour k < 8 et n < 32. */
const COSINUS = (() => {
  const t = new Float64Array(K * N);
  for (let k = 0; k < K; k++) for (let n = 0; n < N; n++) t[k * N + n] = Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
  return t;
})();

/**
 * Empreinte (16 caractères hexadécimaux, même écriture qu'imagehash) d'une
 * image 32×32 en niveaux de gris. DCT-II non normalisée comme
 * `scipy.fftpack.dct` : seule la comparaison à la médiane compte.
 */
export function phashDepuisGris32(gris: Uint8Array): string {
  if (gris.length !== N * N) throw new Error(`phash : image 32×32 attendue, reçu ${gris.length} pixels`);
  // DCT sur l'axe 0 (colonnes), seulement les 8 premières fréquences.
  const a = new Float64Array(K * N);
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let i = 0; i < N; i++) s += gris[i * N + j] * COSINUS[k * N + i];
      a[k * N + j] = 2 * s;
    }
  }
  // DCT sur l'axe 1 (lignes), bloc 8×8 des basses fréquences.
  const b = new Float64Array(K * K);
  for (let k = 0; k < K; k++) {
    for (let l = 0; l < K; l++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += a[k * N + j] * COSINUS[l * N + j];
      b[k * K + l] = 2 * s;
    }
  }
  const tries = Array.from(b).sort((x, y) => x - y);
  const mediane = (tries[31] + tries[32]) / 2;
  let hex = '';
  for (let q = 0; q < 16; q++) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) nibble = (nibble << 1) | (b[q * 4 + bit] > mediane ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Image réduite à 32×32 en niveaux de gris, comme imagehash avant la DCT. */
export function gris32(img: ImageRVBA): Uint8Array {
  return redimensionnerLanczosPillow(grisPillow(img), N, N).donnees;
}

/** Hachage perceptuel d'une image RGBA (déjà à l'endroit). */
export function phash(img: ImageRVBA): string {
  return phashDepuisGris32(gris32(img));
}

const BITS_PAR_CHIFFRE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Distance de Hamming entre deux empreintes : nombre de bits différents (0 à 64). */
export function distanceHamming(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('distanceHamming : empreintes de longueurs différentes');
  let d = 0;
  for (let i = 0; i < a.length; i++) d += BITS_PAR_CHIFFRE[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}
