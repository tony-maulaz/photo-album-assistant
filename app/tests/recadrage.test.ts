import { describe, expect, it } from 'vitest';
import { auFormat, cadre, normaliser, recadrageUtile, RECADRAGE_COMPLET, signatureRecadrage, tailleRecadree } from '../src/lib/recadrage';

describe('recadrage pour l’album (D62)', () => {
  it('le quart de tour échange largeur et hauteur ; le redressement agrandit juste assez', () => {
    expect(cadre(4000, 3000, 0, 0)).toEqual({ l: 4000, h: 3000, echelle: 1 });
    expect(cadre(4000, 3000, 90, 0)).toMatchObject({ l: 3000, h: 4000 });
    // 5° sur une photo 4:3 : cos 5° + 4/3 × sin 5°, sans coin vide.
    expect(cadre(4000, 3000, 0, 5).echelle).toBeCloseTo(Math.cos(Math.PI / 36) + (4 / 3) * Math.sin(Math.PI / 36), 10);
    expect(cadre(4000, 3000, 0, -5).echelle).toBeCloseTo(cadre(4000, 3000, 0, 5).echelle, 10);
  });

  it('au format demandé : le plus grand rectangle, centré au plus près', () => {
    // Carré dans une photo 4:3 : toute la hauteur, 3/4 de la largeur, centré.
    expect(auFormat(RECADRAGE_COMPLET, 1, 4000, 3000)).toMatchObject({ x: 0.125, y: 0, l: 0.75, h: 1 });
    // 3:2 dans une photo 4:3 : toute la largeur.
    const r = auFormat(RECADRAGE_COMPLET, 3 / 2, 4000, 3000);
    expect(r.l).toBe(1);
    expect((r.l * 4000) / (r.h * 3000)).toBeCloseTo(1.5, 10);
    // Centré sur un rectangle déjà au bord : ramené dans l'image.
    expect(auFormat({ x: 0.9, y: 0, l: 0.1, h: 1, angle: 0 }, 1, 4000, 3000).x).toBeCloseTo(0.25, 10);
  });

  it('un recadrage qui ne coupe rien ni ne redresse ne compte pas', () => {
    expect(recadrageUtile(undefined)).toBe(false);
    expect(recadrageUtile(RECADRAGE_COMPLET)).toBe(false);
    expect(recadrageUtile({ ...RECADRAGE_COMPLET, angle: 2 })).toBe(true);
    expect(recadrageUtile({ x: 0.1, y: 0, l: 0.9, h: 1, angle: 0 })).toBe(true);
    expect(signatureRecadrage(RECADRAGE_COMPLET)).toBe('');
    expect(signatureRecadrage({ x: 0.1, y: 0, l: 0.9, h: 1, angle: 0 })).toBe('0.1,0,0.9,1,0');
  });

  it('normalise : dans l’image, arrondi, angle borné', () => {
    expect(normaliser({ x: 0.95, y: -0.1, l: 0.2, h: 1.3, angle: 40 })).toEqual({ x: 0.8, y: 0, l: 0.2, h: 1, angle: 15 });
    expect(tailleRecadree(4000, 3000, 90, { x: 0, y: 0, l: 0.5, h: 0.5, angle: 0 })).toEqual({ l: 1500, h: 2000 });
  });
});
