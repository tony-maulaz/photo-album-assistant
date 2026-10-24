// Types d'images manipulés par les calculs locaux (netteté, ressemblance).
// Aucune dépendance au navigateur : ces fonctions tournent aussi sous Node (tests).

/** Image en niveaux de gris : une valeur 0-255 par pixel, ligne par ligne. */
export interface ImageGrise {
  largeur: number;
  hauteur: number;
  donnees: Uint8Array;
}

/** Pixels RGBA (4 octets par pixel), comme `getImageData` ou un décodeur JPEG. */
export interface ImageRVBA {
  largeur: number;
  hauteur: number;
  donnees: Uint8Array | Uint8ClampedArray;
}

/**
 * Luminance comme Pillow (`Image.convert("L")`, utilisé par imagehash) :
 * ITU-R 601-2 en virgule fixe 16 bits.
 */
export function grisPillow(img: ImageRVBA): ImageGrise {
  const n = img.largeur * img.hauteur;
  const src = img.donnees;
  const sortie = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    sortie[i] = (src[j] * 19595 + src[j + 1] * 38470 + src[j + 2] * 7471 + 0x8000) >>> 16;
  }
  return { largeur: img.largeur, hauteur: img.hauteur, donnees: sortie };
}

/**
 * Luminance comme OpenCV (`cvtColor(..., COLOR_RGB2GRAY)`) : virgule fixe 15 bits.
 * Les scripts lisaient directement le canal Y du JPEG (`IMREAD_GRAYSCALE`) ;
 * repasser par le RVB décodé donne la même valeur à ±1 près.
 */
export function grisOpenCV(img: ImageRVBA): ImageGrise {
  const n = img.largeur * img.hauteur;
  const src = img.donnees;
  const sortie = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    sortie[i] = (src[j] * 9798 + src[j + 1] * 19235 + src[j + 2] * 3735 + 16384) >> 15;
  }
  return { largeur: img.largeur, hauteur: img.hauteur, donnees: sortie };
}
