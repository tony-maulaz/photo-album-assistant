// Images de synthèse : même formule que outils/vecteurs_reference.py.

import type { ImageRVBA } from '../../src/lib/image';

export function imageSynthetique(motif: string, largeur: number, hauteur: number): ImageRVBA {
  const donnees = new Uint8Array(largeur * hauteur * 4);
  const ecrire = (i: number, r: number, g: number, b: number) => {
    donnees[i * 4] = r;
    donnees[i * 4 + 1] = g;
    donnees[i * 4 + 2] = b;
    donnees[i * 4 + 3] = 255;
  };
  if (motif === 'bruit') {
    let etat = 12345;
    const tirage = () => {
      etat = (Math.imul(etat, 1103515245) + 12345) & 0x7fffffff;
      return (etat >>> 16) & 0xff;
    };
    for (let i = 0; i < largeur * hauteur; i++) ecrire(i, tirage(), tirage(), tirage());
    return { largeur, hauteur, donnees };
  }
  const cx = Math.floor(largeur / 3);
  const cy = Math.floor(hauteur / 2);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const i = y * largeur + x;
      if (motif === 'degrade') ecrire(i, (x * 5) & 255, (y * 3) & 255, ((x + y) * 2) & 255);
      else if (motif === 'damier') {
        const v = ((x >> 3) + (y >> 3)) & 1 ? 230 : 25;
        ecrire(i, v, v, v);
      } else if (motif === 'anneaux') {
        const v = (((x - cx) ** 2 + (y - cy) ** 2) >> 4) & 255;
        ecrire(i, v, (v * 3) & 255, 255 - v);
      } else throw new Error(`motif inconnu : ${motif}`);
    }
  }
  return { largeur, hauteur, donnees };
}
