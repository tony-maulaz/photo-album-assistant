import { describe, expect, it } from 'vitest';
import { auFormat, cadre, dessinerRecadrage, normaliser, recadrageUtile, RECADRAGE_COMPLET, signatureRecadrage, tailleRecadree, tournerRecadrage, type Recadrage } from '../src/lib/recadrage';

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

/**
 * Ce que montre la copie : la transformation de `dessinerRecadrage` (la même
 * pour la miniature et la copie de l'album), relevée par un contexte factice.
 * `source(x, y)` : le point de la photo (pixels) montré en (x, y) de la copie.
 */
function vue(largeur: number, hauteur: number, rotation: number, r: Recadrage) {
  type Matrice = [number, number, number, number, number, number];
  let m: Matrice = [1, 0, 0, 1, 0, 0];
  const pile: Matrice[] = [];
  let dessin: { m: Matrice; dx: number; dy: number } | null = null;
  const fois = ([A, B, C, D, E, F]: Matrice) => {
    const [a, b, c, d, e, f] = m;
    m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  };
  const ctx = {
    save: () => pile.push(m),
    restore: () => (m = pile.pop()!),
    scale: (x: number, y: number) => fois([x, 0, 0, y, 0, 0]),
    translate: (x: number, y: number) => fois([1, 0, 0, 1, x, y]),
    rotate: (a: number) => fois([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]),
    drawImage: (_s: unknown, dx: number, dy: number) => (dessin = { m, dx, dy }),
  };
  dessinerRecadrage(ctx as never, {} as never, largeur, hauteur, rotation, r);
  const {
    m: [a, b, c, d, e, f],
    dx,
    dy,
  } = dessin!;
  const det = a * d - b * c;
  return {
    taille: tailleRecadree(largeur, hauteur, rotation, r),
    source: (x: number, y: number) => [(d * (x - e) - c * (y - f)) / det - dx, (-b * (x - e) + a * (y - f)) / det - dy],
  };
}

describe('recadrer puis tourner (campagne de tests : copie en bande verticale)', () => {
  // La photo de l'incident : 4000 × 1848, recadrée en 3:2 un peu à gauche, puis tournée (R).
  const L = 4000;
  const H = 1848;
  const recadrage: Recadrage = { ...auFormat(RECADRAGE_COMPLET, 3 / 2, L, H), x: 0.1 };

  for (const angle of [0, 4]) {
    for (const sens of [90, -90] as const) {
      it(`la copie montre la même partie de la photo, tournée (${sens}°, redressement ${angle}°)`, () => {
        const avant = vue(L, H, 0, { ...recadrage, angle });
        const apres = vue(L, H, (sens + 360) % 360, tournerRecadrage({ ...recadrage, angle }, sens));
        // Largeur et hauteur échangées (et non 1281 × 4000).
        expect(Math.abs(apres.taille.l - avant.taille.h)).toBeLessThanOrEqual(1);
        expect(Math.abs(apres.taille.h - avant.taille.l)).toBeLessThanOrEqual(1);
        const { l, h } = avant.taille;
        // Le point (x, y) d'avant se retrouve en (h − y, x) après un quart de tour horaire, en (y, l − x) dans l'autre sens.
        for (const [x, y] of [
          [0, 0],
          [l, 0],
          [0, h],
          [l, h],
          [l / 2, h / 2],
          [l / 5, (2 * h) / 3],
        ]) {
          const [u, v] = avant.source(x, y);
          const [u2, v2] = sens === 90 ? apres.source(h - y, x) : apres.source(y, l - x);
          expect(Math.abs(u2 - u)).toBeLessThan(2);
          expect(Math.abs(v2 - v)).toBeLessThan(2);
        }
      });
    }
  }

  it('quatre quarts de tour, ou un aller-retour, rendent le recadrage d’origine', () => {
    const r = { x: 0.1, y: 0.05, l: 0.6, h: 0.8, angle: -2.5 };
    expect(tournerRecadrage(tournerRecadrage(r, 90), -90)).toEqual(r);
    let t = r;
    for (let i = 0; i < 4; i++) t = tournerRecadrage(t, 90);
    expect(t).toEqual(r);
    expect(tournerRecadrage(r, 90)).toEqual({ x: 0.15, y: 0.1, l: 0.8, h: 0.6, angle: -2.5 });
  });
});
