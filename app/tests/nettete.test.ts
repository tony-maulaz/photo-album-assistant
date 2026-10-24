import { describe, expect, it } from 'vitest';
import { grisOpenCV, type ImageGrise } from '../src/lib/image';
import { COTE_SCRIPT_01, COTE_SCRIPT_06, nettete, varianceLaplacien } from '../src/lib/nettete';
import { redimensionnerBilineaireOpenCV } from '../src/lib/redimension';
import { imageSynthetique } from './aides/synthetiques';
import { lirePhoto, vecteursPhotos } from './aides/photos';
import synthetiques from './vecteurs/synthetiques.json';

const ecartRelatif = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);

describe('varianceLaplacien', () => {
  it('vaut 0 sur une image uniforme', () => {
    expect(varianceLaplacien({ largeur: 5, hauteur: 4, donnees: new Uint8Array(20).fill(77) })).toBe(0);
  });

  it('calcule le Laplacien avec des bords en miroir (BORDER_REFLECT_101)', () => {
    // Un seul pixel à 1 au centre d'une image 3×3 : Laplacien -4 au centre,
    // +2 sur les 4 voisins directs (le miroir compte le centre deux fois), 0 aux coins.
    const img: ImageGrise = { largeur: 3, hauteur: 3, donnees: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]) };
    const valeurs = [0, 2, 0, 2, -4, 2, 0, 2, 0];
    const moyenne = valeurs.reduce((s, v) => s + v, 0) / 9;
    const variance = valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / 9;
    expect(varianceLaplacien(img)).toBeCloseTo(variance, 12);
  });
});

describe('netteté sur images de synthèse (vecteurs OpenCV)', () => {
  for (const cas of synthetiques.cas) {
    const nom = `${cas.motif} ${cas.largeur}×${cas.hauteur}`;
    const gris = grisOpenCV(imageSynthetique(cas.motif, cas.largeur, cas.hauteur));

    it(`${nom} : réduction à 1024 px comme cv2.resize`, () => {
      const r = cas.reduction_1024;
      const echelle = 1024 / Math.max(cas.largeur, cas.hauteur);
      const reduite =
        echelle < 1
          ? redimensionnerBilineaireOpenCV(gris, Math.trunc(cas.largeur * echelle), Math.trunc(cas.hauteur * echelle))
          : gris;
      expect([reduite.largeur, reduite.hauteur]).toEqual([r.largeur, r.hauteur]);
      expect(Array.from(reduite.donnees.subarray(0, 64))).toEqual(r.debut);
      let somme = 0;
      let sommeCarres = 0;
      for (const v of reduite.donnees) {
        somme += v;
        sommeCarres += v * v;
      }
      expect([somme, sommeCarres]).toEqual([r.somme, r.somme_carres]);
    });

    it(`${nom} : netteté à 1024 et 800 px identique à OpenCV`, () => {
      expect(ecartRelatif(nettete(gris, COTE_SCRIPT_01), cas.nettete_1024)).toBeLessThan(1e-9);
      expect(ecartRelatif(nettete(gris, COTE_SCRIPT_06), cas.nettete_800)).toBeLessThan(1e-9);
    });
  }
});

const vecteurs = vecteursPhotos();

describe.skipIf(!vecteurs)('netteté sur les photos de référence (tests/photos_reelles)', () => {
  for (const v of vecteurs?.photos ?? []) {
    it(`${v.fichier.slice(0, 40)} : à 2 % près du script 01 (1024 px) et du script 06 (800 px)`, async () => {
      const gris = grisOpenCV(await lirePhoto(v.fichier));
      expect(ecartRelatif(nettete(gris, COTE_SCRIPT_01), v.nettete_1024)).toBeLessThan(0.02);
      expect(ecartRelatif(nettete(gris, COTE_SCRIPT_06), v.nettete_800)).toBeLessThan(0.02);
    });
  }
});
