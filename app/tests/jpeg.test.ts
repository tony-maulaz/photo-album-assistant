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

  /**
   * EXIF d'un téléphone, réduit à l'essentiel : IFD0 (taille, orientation 6,
   * lien vers le sous-IFD Exif), sous-IFD Exif (PixelXDimension en LONG,
   * PixelYDimension en SHORT), puis IFD1 (la vignette de la photo entière).
   */
  function jpegAvecVignette(petitBoutiste: boolean): Uint8Array {
    const u16 = (v: number) => (petitBoutiste ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
    const u32 = (v: number) => (petitBoutiste ? [...u16(v & 0xffff), ...u16(v >>> 16)] : [...u16(v >>> 16), ...u16(v & 0xffff)]);
    const entree = (balise: number, type: 3 | 4, valeur: number) => [...u16(balise), ...u16(type), ...u32(1), ...(type === 3 ? [...u16(valeur), 0, 0] : u32(valeur))];
    // En-tête (8 octets), IFD0 à 8 (4 entrées : 54 octets), IFD Exif à 62 (2 entrées : 30), IFD1 à 92 (1 entrée : 18), vignette à 110.
    const tiff = [
      ...(petitBoutiste ? [0x49, 0x49] : [0x4d, 0x4d]),
      ...u16(42),
      ...u32(8),
      ...u16(4),
      ...entree(0x0100, 3, 4000),
      ...entree(0x0101, 3, 1848),
      ...entree(0x0112, 3, 6),
      ...entree(0x8769, 4, 62),
      ...u32(92),
      ...u16(2),
      ...entree(0xa002, 4, 4000),
      ...entree(0xa003, 3, 1848),
      ...u32(0),
      ...u16(1),
      ...entree(0x0201, 4, 110),
      ...u32(0),
      0xff,
      0xd8,
      0xff,
      0xd9,
    ];
    const longueur = tiff.length + 8;
    return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, longueur >> 8, longueur & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0xff, 0xda, 1, 2, 0xff, 0xd9]);
  }

  /** Balises d'un IFD du segment (valeur d'un SHORT ou d'un LONG), et le lien vers l'IFD suivant. */
  function lireIfd(s: Uint8Array, petitBoutiste: boolean, position: number) {
    const u16 = (p: number) => (petitBoutiste ? s[p] + (s[p + 1] << 8) : (s[p] << 8) + s[p + 1]);
    const u32 = (p: number) => (petitBoutiste ? u16(p) + u16(p + 2) * 65536 : u16(p) * 65536 + u16(p + 2));
    const ifd = 10 + position;
    const balises = new Map<number, number>();
    for (let k = 0; k < u16(ifd); k++) {
      const e = ifd + 2 + k * 12;
      balises.set(u16(e), u16(e + 2) === 3 ? u16(e + 8) : u32(e + 8));
    }
    return { balises, suivant: u32(ifd + 2 + u16(ifd) * 12) };
  }

  for (const petitBoutiste of [false, true]) {
    it(`retire la vignette et donne la taille de la copie recadrée (${petitBoutiste ? 'II' : 'MM'})`, async () => {
      const { orientationJpeg, segmentExif } = await import('../src/lib/jpeg');
      const original = jpegAvecVignette(petitBoutiste);
      expect(lireIfd(segmentExif(original)!, petitBoutiste, 8).suivant).toBe(0);
      const segment = segmentExif(original, { largeur: 2772, hauteur: 70000 })!;
      expect(segment.length).toBe(original.length - 8);
      const ifd0 = lireIfd(segment, petitBoutiste, 8);
      // Plus de lien vers IFD1 : les explorateurs de fichiers ne montrent plus la photo entière.
      expect(ifd0.suivant).toBe(0);
      expect([ifd0.balises.get(0x0100), ifd0.balises.get(0x0101), ifd0.balises.get(0x0112)]).toEqual([2772, 0xffff, 1]);
      const exif = lireIfd(segment, petitBoutiste, ifd0.balises.get(0x8769)!);
      // PixelXDimension en LONG, PixelYDimension en SHORT (borné à 65535).
      expect([exif.balises.get(0xa002), exif.balises.get(0xa003)]).toEqual([2772, 0xffff]);
      expect(orientationJpeg(Uint8Array.from([0xff, 0xd8, ...segment, 0xff, 0xd9]))).toBe(1);
      // L'original n'est pas touché.
      expect(lireIfd(original.subarray(2), petitBoutiste, 8).suivant).toBe(92);
    });
  }

  it('laisse tel quel un EXIF tronqué, sans lire hors du segment', async () => {
    const { segmentExif } = await import('../src/lib/jpeg');
    const tronque = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0x7f, 0xff, 0xff, 0xda]);
    expect(segmentExif(tronque, { largeur: 10, hauteur: 10 })).toEqual(tronque.slice(2, 20));
  });
});

