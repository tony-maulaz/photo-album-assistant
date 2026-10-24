// Netteté = variance du Laplacien sur l'image grise réduite (scripts 01, 03, 06).

import type { ImageGrise } from './image';
import { redimensionnerBilineaireOpenCV } from './redimension';

/** Côté maximal utilisé par le script 01, dont vient le seuil calibré de 60. */
export const COTE_SCRIPT_01 = 1024;
/** Côté maximal utilisé par le script 06 (seuil relatif `[flou?]`). */
export const COTE_SCRIPT_06 = 800;

/**
 * Variance de `cv2.Laplacian(img, cv2.CV_64F)` : noyau 4-voisins, bords en
 * miroir sans répétition du pixel de bord (BORDER_REFLECT_101).
 */
export function varianceLaplacien(img: ImageGrise): number {
  const { largeur: w, hauteur: h, donnees: p } = img;
  const voisin = (i: number, n: number) => (i < 0 ? (n > 1 ? 1 : 0) : i >= n ? (n > 1 ? n - 2 : 0) : i);
  let somme = 0;
  let sommeCarres = 0;
  for (let y = 0; y < h; y++) {
    const haut = voisin(y - 1, h) * w;
    const bas = voisin(y + 1, h) * w;
    const ligne = y * w;
    for (let x = 0; x < w; x++) {
      const v = p[haut + x] + p[bas + x] + p[ligne + voisin(x - 1, w)] + p[ligne + voisin(x + 1, w)] - 4 * p[ligne + x];
      somme += v;
      sommeCarres += v * v;
    }
  }
  const n = w * h;
  const moyenne = somme / n;
  return sommeCarres / n - moyenne * moyenne;
}

/** Netteté d'une image grise réduite à `coteMax` px de côté, comme `tech_score`. */
export function nettete(gris: ImageGrise, coteMax: number = COTE_SCRIPT_01): number {
  const echelle = coteMax / Math.max(gris.largeur, gris.hauteur);
  const reduite =
    echelle < 1
      ? redimensionnerBilineaireOpenCV(gris, Math.trunc(gris.largeur * echelle), Math.trunc(gris.hauteur * echelle))
      : gris;
  return varianceLaplacien(reduite);
}
