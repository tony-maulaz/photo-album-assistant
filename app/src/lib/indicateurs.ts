// Indicateurs techniques d'une photo (SPEC § 6.9) : netteté, exposition,
// contre-jour. Ils servent à trier et filtrer, jamais à décider à la place
// de l'utilisateur.

import type { ImageGrise } from './image';

export interface Exposition {
  /** Luminosité moyenne (0-255). */
  moyenne: number;
  /** Part des pixels très sombres (< 20) et très clairs (> 245), de 0 à 1. */
  sombres: number;
  claires: number;
  /** Luminosité moyenne du tiers central et de la bordure (20 % de chaque côté). */
  centre: number;
  bords: number;
}

export function exposition(img: ImageGrise): Exposition {
  const { largeur: w, hauteur: h, donnees: p } = img;
  let somme = 0;
  let sombres = 0;
  let claires = 0;
  let sommeCentre = 0;
  let nCentre = 0;
  let sommeBords = 0;
  let nBords = 0;
  const x0 = w / 3;
  const x1 = (2 * w) / 3;
  const y0 = h / 3;
  const y1 = (2 * h) / 3;
  const bx = w * 0.2;
  const by = h * 0.2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = p[y * w + x];
      somme += v;
      if (v < 20) sombres++;
      else if (v > 245) claires++;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        sommeCentre += v;
        nCentre++;
      } else if (x < bx || x >= w - bx || y < by || y >= h - by) {
        sommeBords += v;
        nBords++;
      }
    }
  }
  const n = w * h || 1;
  return { moyenne: somme / n, sombres: sombres / n, claires: claires / n, centre: sommeCentre / (nCentre || 1), bords: sommeBords / (nBords || 1) };
}

export interface Indicateurs extends Exposition {
  phash: string;
  /** Netteté mesurée à 1024 px (même échelle que le seuil 60 du script 01). */
  nettete: number;
}

export type Signal = 'flou' | 'sombre' | 'cramee' | 'contre_jour';

export const LIBELLES_SIGNAUX: Record<Signal, string> = {
  flou: 'peu nette',
  sombre: 'sombre',
  cramee: 'cramée',
  contre_jour: 'contre-jour',
};

/**
 * Seuil de flou d'un dossier (I8) : relatif ET absolu, min(15e centile,
 * 0,5 × médiane), pour ne jamais accuser une photo d'un dossier entièrement net.
 */
export function seuilFlou(nettetes: number[]): number {
  if (nettetes.length < 2) return 0;
  const t = [...nettetes].sort((a, b) => a - b);
  return Math.min(t[Math.max(0, Math.floor(0.15 * t.length))], 0.5 * t[Math.floor(t.length / 2)]);
}

/** Signaux d'une photo, d'après ses indicateurs et le seuil de flou de son dossier. */
export function signaux(i: Indicateurs, seuil: number): Signal[] {
  const s: Signal[] = [];
  if (i.nettete < seuil) s.push('flou');
  if (i.moyenne < 55 || i.sombres > 0.5) s.push('sombre');
  if (i.claires > 0.25) s.push('cramee');
  if (i.bords > 170 && i.bords - i.centre > 60) s.push('contre_jour');
  return s;
}
