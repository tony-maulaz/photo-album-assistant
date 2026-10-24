import { describe, expect, it } from 'vitest';
import { distanceHamming, gris32, phash, phashDepuisGris32 } from '../src/lib/phash';
import { grisOpenCV, grisPillow } from '../src/lib/image';
import { imageSynthetique } from './aides/synthetiques';
import { lirePhoto, vecteursPhotos } from './aides/photos';
import synthetiques from './vecteurs/synthetiques.json';

/** Masque de 64 bits (BigInt) avec des zéros aux positions données (bit 0 = premier bit). */
function masqueSans(positions: number[]): bigint {
  let m = (1n << 64n) - 1n;
  for (const p of positions) m &= ~(1n << BigInt(63 - p));
  return m;
}

function sansBits(hex: string, masque: bigint): string {
  return (BigInt(`0x${hex}`) & masque).toString(16).padStart(16, '0');
}

describe('distanceHamming', () => {
  it('compte les bits différents', () => {
    expect(distanceHamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(distanceHamming('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(distanceHamming('8000000000000001', '0000000000000000')).toBe(2);
    expect(distanceHamming('d482fe3b6f2c9181', '98e7136c33c8a57a')).toBe(36);
  });
});

describe('phash sur images de synthèse (vecteurs Pillow / imagehash)', () => {
  for (const cas of synthetiques.cas) {
    const nom = `${cas.motif} ${cas.largeur}×${cas.hauteur}`;
    const img = imageSynthetique(cas.motif, cas.largeur, cas.hauteur);

    it(`${nom} : niveaux de gris identiques à Pillow et OpenCV`, () => {
      const somme = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);
      expect(somme(grisPillow(img).donnees)).toBe(cas.somme_gris_pillow);
      expect(somme(grisOpenCV(img).donnees)).toBe(cas.somme_gris_opencv);
    });

    it(`${nom} : réduction Lanczos 32×32 identique à Pillow`, () => {
      expect(Array.from(gris32(img))).toEqual(cas.gris32);
    });

    it(`${nom} : DCT et médiane identiques à imagehash`, () => {
      // Les coefficients égaux à la médiane (motifs symétriques) sont tranchés
      // par le bruit flottant, différent entre scipy et JavaScript : on les ignore.
      const masque = masqueSans(cas.bits_ambigus);
      expect(sansBits(phashDepuisGris32(Uint8Array.from(cas.gris32)), masque)).toBe(sansBits(cas.phash, masque));
      expect(sansBits(phash(img), masque)).toBe(sansBits(cas.phash, masque));
    });
  }

  it('aucun écart sur les images de bruit (pas de coefficient égal à la médiane)', () => {
    for (const cas of synthetiques.cas.filter((c) => c.motif === 'bruit')) {
      expect(phash(imageSynthetique(cas.motif, cas.largeur, cas.hauteur))).toBe(cas.phash);
    }
  });
});

const vecteurs = vecteursPhotos();

describe.skipIf(!vecteurs)('phash sur les photos de référence (tests/photos_reelles)', () => {
  for (const v of vecteurs?.photos ?? []) {
    it(`${v.fichier.slice(0, 40)} : écart ≤ 2 bits avec imagehash sur la photo à l'endroit`, async () => {
      const img = await lirePhoto(v.fichier);
      expect([img.largeur, img.hauteur]).toEqual([v.largeur, v.hauteur]);
      expect(distanceHamming(phash(img), v.phash_oriente)).toBeLessThanOrEqual(2);
    });
  }
});
