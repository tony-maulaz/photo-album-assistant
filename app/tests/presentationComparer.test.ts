import { describe, expect, it } from 'vitest';
import { bandeVignettes, choisirPresentation, contenir, dispositionCote, hauteurCote, largeurRangee, MESURES, photoOuverture, placeUne, proportion, repartir } from '../src/lib/presentationComparer';

// Scène de « Comparer en grand » : l'écran moins les barres de 48, 32 et 56 px (C-7.5).
const GRAND = { largeur: 1440, hauteur: 900 - 136 };
const PETIT = { largeur: 1280, hauteur: 580 - 136 };
const P = 3 / 4;
const L = 4 / 3;

describe('présentation de « Comparer en grand » (C-7.5)', () => {
  it('la proportion vient de la photo affichée ; un quart de tour l’inverse', () => {
    expect(proportion(300, 400)).toBeCloseTo(0.75);
    expect(proportion(300, 400, 90)).toBeCloseTo(4 / 3);
    expect(proportion(300, 400, 270)).toBeCloseTo(4 / 3);
    expect(proportion(300, 400, 180)).toBeCloseTo(0.75);
    expect(proportion(0, 400)).toBeCloseTo(4 / 3);
  });

  it('une paire est toujours côte à côte, même en paysage sur un petit écran', () => {
    for (const scene of [GRAND, PETIT]) {
      expect(choisirPresentation([P, P], scene)).toBe('cote');
      expect(choisirPresentation([16 / 9, 16 / 9], scene)).toBe('cote');
    }
    expect(choisirPresentation([L], GRAND)).toBe('une');
  });

  it('3 portraits côte à côte aux deux tailles ; 3 paysages une à la fois', () => {
    expect(choisirPresentation([P, P, P], GRAND)).toBe('cote');
    expect(choisirPresentation([P, P, P], PETIT)).toBe('cote');
    expect(choisirPresentation([L, L, L], GRAND)).toBe('une');
    expect(choisirPresentation([L, L, L], PETIT)).toBe('une');
  });

  it('6 photos mêlées, et 4 paysages, une à la fois', () => {
    expect(choisirPresentation([P, L, 9 / 16, L, P, P], GRAND)).toBe('une');
    expect(choisirPresentation([L, L, L, L], GRAND)).toBe('une');
    expect(choisirPresentation([L, L, L, L], PETIT)).toBe('une');
    // 4 portraits tiennent côte à côte (304 px de haut au petit écran, plus de la moitié de leur surface seule).
    expect(choisirPresentation([P, P, P, P], PETIT)).toBe('cote');
  });

  it('côte à côte : chaque photo garde la moitié de sa surface seule et au moins 220 px de haut', () => {
    for (const ratios of [[P, P, P], [P, P, P, P], [L, L, L], [P, L, P]]) {
      for (const scene of [GRAND, PETIT]) {
        if (choisirPresentation(ratios, scene) !== 'cote') continue;
        const h = hauteurCote(ratios, scene);
        expect(h).toBeGreaterThanOrEqual(MESURES.hauteurMin);
        const place = placeUne(ratios.length, scene);
        for (const r of ratios) {
          const seule = contenir(r, place);
          expect(h * h * r).toBeGreaterThanOrEqual((seule.largeur * seule.hauteur) / 2);
        }
      }
    }
  });

  it('la rangée côte à côte tient dans la largeur et la hauteur de la scène, cartes au minimum comprises', () => {
    for (const ratios of [[P, P, P], [9 / 16, 9 / 16, 9 / 16, 9 / 16], [L, L, L], [P, L, 9 / 16]]) {
      const h = hauteurCote(ratios, PETIT);
      expect(largeurRangee(ratios, h) + 2 * MESURES.margeX).toBeLessThanOrEqual(PETIT.largeur + 0.5);
      expect(h + MESURES.legendeCote + 2 * MESURES.margeCarte + 2 * MESURES.margeY).toBeLessThanOrEqual(PETIT.hauteur + 0.5);
    }
  });

  // La règle de l'utilisateur seule : la largeur minimale d'une carte (240 px) compte dans la rangée, elle ne
  // refuse pas une photo étroite (portraits de téléphone, 9:16 ou 9:20).
  it('3 et 4 portraits étroits (9:16, 9:20) côte à côte au petit écran : 304 px de haut, plus de la moitié de leur surface', () => {
    for (const r of [9 / 16, 9 / 20])
      for (const n of [3, 4]) {
        const ratios = Array(n).fill(r);
        expect(choisirPresentation(ratios, PETIT)).toBe('cote');
        expect(hauteurCote(ratios, PETIT)).toBeCloseTo(304, 0);
      }
  });

  it('une rangée qui ne tient pas, même en cartes au minimum, n’est jamais côte à côte', () => {
    // Sélection (cartes de 340 px) à 1024 px de large : 4 cartes font 1408 px.
    const etroit = { largeur: 1024, hauteur: 464 - 136 };
    const selection = { ...MESURES, carteMin: 340, legendeCote: 88 };
    expect(hauteurCote([P, P, P, P], etroit, selection)).toBe(0);
    expect(choisirPresentation([P, P, P, P], etroit, selection)).toBe('une');
    // Les cartes au minimum décident de la hauteur : la rangée de 4 paysages tient en réduisant les photos.
    const h = hauteurCote([L, L, L, L], PETIT);
    expect(largeurRangee([L, L, L, L], h)).toBeLessThanOrEqual(PETIT.largeur - 2 * MESURES.margeX + 0.5);
  });

  it('côte à côte choisi à la main avec 6 photos : sur plusieurs rangées, rien hors de la scène', () => {
    const ratios = [L, L, L, L, L, L];
    const d = dispositionCote(ratios, PETIT);
    expect(d.rangees).toBeGreaterThan(1);
    expect(d.hauteur).toBeGreaterThan(0);
    for (const rangee of repartir(ratios, d.rangees)) expect(largeurRangee(rangee, d.hauteur) + 2 * MESURES.margeX).toBeLessThanOrEqual(PETIT.largeur + 0.5);
    const hauteurTotale = d.rangees * (d.hauteur + 2 * MESURES.margeCarte + MESURES.legendeCote) + (d.rangees - 1) * MESURES.ecart + 2 * MESURES.margeY;
    expect(hauteurTotale).toBeLessThanOrEqual(PETIT.hauteur + 0.5);
    // Une paire, ou une rangée qui tient, reste sur une rangée.
    expect(dispositionCote([P, P], PETIT).rangees).toBe(1);
    expect(dispositionCote([P, P, P], GRAND).rangees).toBe(1);
    expect(repartir([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('bande des vignettes : une colonne au grand écran, deux au petit, les 6 photos visibles', () => {
    const grand = bandeVignettes(6, GRAND.hauteur);
    expect(grand.colonnes).toBe(1);
    const petit = bandeVignettes(6, PETIT.hauteur);
    expect(petit.colonnes).toBe(2);
    for (const [b, scene] of [
      [grand, GRAND],
      [petit, PETIT],
    ] as const) {
      const rangees = Math.ceil(6 / b.colonnes);
      const hauteur = rangees * (b.hauteurVignette + MESURES.bandeEtat + 2 * MESURES.margeVignette) + (rangees - 1) * MESURES.ecartVignettes;
      expect(hauteur).toBeLessThanOrEqual(scene.hauteur - 2 * MESURES.margeY);
    }
  });

  it('ouverture sur la photo conseillée, sinon la première', () => {
    expect(photoOuverture(['a', 'b', 'c'], 'c')).toBe(2);
    expect(photoOuverture(['a', 'b', 'c'], 'x')).toBe(0);
    expect(photoOuverture(['a', 'b', 'c'])).toBe(0);
  });
});
