import { describe, expect, it } from 'vitest';
import { dimensionsAffichees, dimensionsJpeg } from '../src/lib/jpeg';
import { lirePhoto, vecteursPhotos, DOSSIER_PHOTOS } from './aides/photos';
import { readFileSync } from 'node:fs';

const lecteur = (o: Uint8Array) => async (debut: number, longueur: number) => o.subarray(debut, debut + longueur);

/** JPEG minimal : SOI, APP1 de `tailleApp1` octets, SOF0 (hauteur × largeur). */
function jpegFactice(largeur: number, hauteur: number, tailleApp1 = 40): Uint8Array {
  const app1 = [0xff, 0xe1, (tailleApp1 + 2) >> 8, (tailleApp1 + 2) & 0xff, ...new Array(tailleApp1).fill(0)];
  const sof = [0xff, 0xc0, 0, 17, 8, hauteur >> 8, hauteur & 0xff, largeur >> 8, largeur & 0xff, 3, ...new Array(9).fill(0)];
  return Uint8Array.from([0xff, 0xd8, ...app1, 0xff, 0xff, ...sof, 0xff, 0xd9]);
}

describe('dimensionsJpeg', () => {
  it('lit le segment SOF après les segments d’application', async () => {
    const o = jpegFactice(4000, 1848, 3000);
    expect(await dimensionsJpeg(lecteur(o), o.length)).toEqual({ largeur: 4000, hauteur: 1848 });
  });

  it('refuse ce qui n’est pas un JPEG', async () => {
    const o = new TextEncoder().encode('PNG ou texte');
    expect(await dimensionsJpeg(lecteur(o), o.length)).toBeNull();
  });

  it('échange largeur et hauteur pour les orientations 5 à 8', () => {
    expect(dimensionsAffichees({ largeur: 4000, hauteur: 1848 }, 6)).toEqual({ largeur: 1848, hauteur: 4000 });
    expect(dimensionsAffichees({ largeur: 4000, hauteur: 1848 }, 3)).toEqual({ largeur: 4000, hauteur: 1848 });
  });
});

const vecteurs = vecteursPhotos();

describe.skipIf(!vecteurs)('dimensionsJpeg sur les photos de référence', () => {
  it('donne, après orientation, les dimensions de l’image décodée à l’endroit', async () => {
    for (const v of vecteurs!.photos.slice(0, 4)) {
      const o = new Uint8Array(readFileSync(DOSSIER_PHOTOS + v.fichier));
      const d = dimensionsAffichees((await dimensionsJpeg(lecteur(o), o.length))!, v.orientation);
      const img = await lirePhoto(v.fichier);
      expect(d).toEqual({ largeur: img.largeur, hauteur: img.hauteur });
    }
  });
});

describe('balise Orientation (rotation sans recompression, P13)', () => {
  it('lit l’orientation des photos de référence', async () => {
    const { orientationJpeg } = await import('../src/lib/jpeg');
    if (!vecteurs) return;
    for (const v of vecteurs.photos) {
      const o = new Uint8Array(readFileSync(DOSSIER_PHOTOS + v.fichier));
      expect(orientationJpeg(o) ?? 1).toBe(v.orientation);
    }
  });

  it('change la balise en gardant la taille du fichier', async () => {
    const { changerOrientation, orientationJpeg } = await import('../src/lib/jpeg');
    if (!vecteurs) return;
    const v = vecteurs.photos.find((p) => p.orientation === 6)!;
    const o = new Uint8Array(readFileSync(DOSSIER_PHOTOS + v.fichier));
    const tournee = changerOrientation(o, 3)!;
    expect(tournee.length).toBe(o.length);
    expect(orientationJpeg(tournee)).toBe(3);
    let differences = 0;
    for (let i = 0; i < o.length; i++) if (o[i] !== tournee[i]) differences++;
    expect(differences).toBeLessThanOrEqual(2);
  });

  it('compose les quarts de tour, miroirs compris', async () => {
    const { orientationApresRotation } = await import('../src/lib/jpeg');
    expect(orientationApresRotation(1, 90)).toBe(6);
    expect(orientationApresRotation(6, 90)).toBe(3);
    expect(orientationApresRotation(8, 90)).toBe(1);
    expect(orientationApresRotation(1, -90)).toBe(8);
    expect(orientationApresRotation(6, 180)).toBe(8);
    expect(orientationApresRotation(2, 90)).toBe(7);
    expect(orientationApresRotation(5, 90)).toBe(2);
  });

  it('refuse un fichier sans balise Orientation', async () => {
    const { changerOrientation } = await import('../src/lib/jpeg');
    expect(changerOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 6)).toBeNull();
  });
});

describe('EXIF reporté sur une copie recadrée (D62)', () => {
  // JPEG minimal : EXIF (en-tête TIFF « MM », une balise Orientation = 6), puis des données.
  const exif = [0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
  const original = Uint8Array.from([0xff, 0xd8, ...exif, 0xff, 0xda, 1, 2, 3, 0xff, 0xd9]);
  // JPEG produit par le navigateur : en-tête JFIF, puis l'image.
  const jfif = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const nouveau = Uint8Array.from([0xff, 0xd8, ...jfif, 0xff, 0xdb, 9, 9, 0xff, 0xd9]);

  it('reprend l’EXIF de l’original, orientation remise à 1', async () => {
    const { avecExif, orientationJpeg, segmentExif } = await import('../src/lib/jpeg');
    const segment = segmentExif(original)!;
    expect([...segment.slice(0, 2)]).toEqual([0xff, 0xe1]);
    const copie = avecExif(nouveau, segment);
    expect(orientationJpeg(copie)).toBe(1);
    expect([...copie.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1]);
    // L'image du navigateur suit, sans son en-tête JFIF.
    expect([...copie.slice(2 + segment.length)]).toEqual([0xff, 0xdb, 9, 9, 0xff, 0xd9]);
    expect(segmentExif(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0xff, 0xd9]))).toBeNull();
  });
});

