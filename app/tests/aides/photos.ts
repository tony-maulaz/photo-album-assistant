// Accès aux photos de référence (tests/photos_reelles/, non versionné) sous Node.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import jpeg from 'jpeg-js';
import type { ImageRVBA } from '../../src/lib/image';

export const DOSSIER_PHOTOS = fileURLToPath(new URL('../../../tests/photos_reelles/', import.meta.url));
const FICHIER_VECTEURS = `${DOSSIER_PHOTOS}vecteurs_reference.json`;

export interface VecteurPhoto {
  fichier: string;
  orientation: number;
  largeur: number;
  hauteur: number;
  phash_brut: string;
  phash_oriente: string;
  gris32_oriente: number[];
  nettete_1024: number;
  nettete_800: number;
  nettete_1024_rvb: number;
}

/** Vecteurs calculés en Python, ou `null` si les photos de référence sont absentes. */
export function vecteursPhotos(): { photos: VecteurPhoto[] } | null {
  if (!existsSync(FICHIER_VECTEURS)) return null;
  return JSON.parse(readFileSync(FICHIER_VECTEURS, 'utf-8'));
}

/** Applique l'orientation EXIF (1 à 8) comme `ImageOps.exif_transpose`. */
export function orienter(img: ImageRVBA, orientation: number): ImageRVBA {
  if (orientation <= 1 || orientation > 8) return img;
  const { largeur: w, hauteur: h, donnees: src } = img;
  const tourne = orientation >= 5;
  const lo = tourne ? h : w;
  const ho = tourne ? w : h;
  const dst = new Uint8Array(lo * ho * 4);
  for (let y = 0; y < ho; y++) {
    for (let x = 0; x < lo; x++) {
      let sx: number;
      let sy: number;
      switch (orientation) {
        case 2: sx = w - 1 - x; sy = y; break;
        case 3: sx = w - 1 - x; sy = h - 1 - y; break;
        case 4: sx = x; sy = h - 1 - y; break;
        case 5: sx = y; sy = x; break;
        case 6: sx = y; sy = h - 1 - x; break;
        case 7: sx = w - 1 - y; sy = h - 1 - x; break;
        default: sx = w - 1 - y; sy = x; break; // 8
      }
      const i = (y * lo + x) * 4;
      const j = (sy * w + sx) * 4;
      dst[i] = src[j];
      dst[i + 1] = src[j + 1];
      dst[i + 2] = src[j + 2];
      dst[i + 3] = 255;
    }
  }
  return { largeur: lo, hauteur: ho, donnees: dst };
}

/** Décode un JPEG (décodeur JavaScript jpeg-js) et le met à l'endroit. */
export async function lirePhoto(fichier: string): Promise<ImageRVBA> {
  const octets = readFileSync(DOSSIER_PHOTOS + fichier);
  const brute = jpeg.decode(octets, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048 });
  const exif = await exifr.parse(octets, { pick: ['Orientation'], translateValues: false });
  return orienter({ largeur: brute.width, hauteur: brute.height, donnees: brute.data }, exif?.Orientation ?? 1);
}
