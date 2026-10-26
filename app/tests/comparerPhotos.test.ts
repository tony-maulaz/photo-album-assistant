import { describe, expect, it } from 'vitest';
import { comparerPhotos } from '../src/lib/comparerPhotos';
import type { Indicateurs } from '../src/lib/indicateurs';

const mesure = (extra: Partial<Indicateurs> = {}): Indicateurs => ({
  phash: '0',
  nettete: 400,
  moyenne: 120,
  sombres: 0.02,
  claires: 0.01,
  centre: 120,
  bords: 120,
  ...extra,
});

describe('comparerPhotos (D99)', () => {
  it('ne dit rien quand les photos se valent (cas le plus courant d’une rafale)', () => {
    const c = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ nettete: 410 }) },
        { id: 'b', indicateurs: mesure({ nettete: 400, moyenne: 118 }) },
      ],
      'rafales',
    );
    expect(c.plusNette).toBeUndefined();
    expect(c.remarques.size).toBe(0);
  });

  it('signale la plus nette seulement au-delà de 1,5× (2× pour une même scène)', () => {
    const photos = [
      { id: 'a', indicateurs: mesure({ nettete: 700 }) },
      { id: 'b', indicateurs: mesure({ nettete: 400 }) },
    ];
    expect(comparerPhotos(photos, 'rafales')).toMatchObject({ plusNette: 'a' });
    expect(comparerPhotos(photos, 'rafales').remarques.get('a')).toBe('plus_nette');
    expect(comparerPhotos(photos, 'ia').plusNette).toBeUndefined();
  });

  it('corrige la netteté de l’exposition : une photo plus claire n’est pas « plus nette » pour autant', () => {
    // 1,6× la netteté, mais 25 % plus claire : le contraste explique l'écart.
    const c = comparerPhotos(
      [
        { id: 'claire', indicateurs: mesure({ nettete: 640, moyenne: 150 }) },
        { id: 'b', indicateurs: mesure({ nettete: 400, moyenne: 120 }) },
      ],
      'rafales',
    );
    expect(c.plusNette).toBeUndefined();
  });

  it('signale une photo nettement plus sombre, pas un écart invisible ni une rafale toute sombre', () => {
    const sombre = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ moyenne: 110 }) },
        { id: 'b', indicateurs: mesure({ moyenne: 80 }) },
      ],
      'rafales',
    );
    expect(sombre.remarques.get('b')).toBe('plus_sombre');
    expect(sombre.remarques.has('a')).toBe(false);
    const proches = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ moyenne: 90 }) },
        { id: 'b', indicateurs: mesure({ moyenne: 84 }) },
      ],
      'rafales',
    );
    expect(proches.remarques.size).toBe(0);
  });

  it('signale une photo trop claire (zones blanches) seulement si elle l’est plus que les autres', () => {
    const c = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ claires: 0.02 }) },
        { id: 'b', indicateurs: mesure({ claires: 0.18 }) },
      ],
      'ia',
    );
    expect(c.remarques.get('b')).toBe('trop_claire');
    const toutes = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ claires: 0.3 }) },
        { id: 'b', indicateurs: mesure({ claires: 0.31 }) },
      ],
      'ia',
    );
    expect(toutes.remarques.size).toBe(0);
  });

  it('contre-jour : dans une rafale, seulement quand une photo l’a et pas l’autre', () => {
    const photos = [
      { id: 'a', indicateurs: mesure({ bords: 200, centre: 110, moyenne: 160 }) },
      { id: 'b', indicateurs: mesure({ bords: 190, centre: 150, moyenne: 165 }) },
    ];
    expect(comparerPhotos(photos, 'rafales').remarques.get('a')).toBe('contre_jour');
    expect(comparerPhotos(photos, 'ia').remarques.get('a')).toBeUndefined();
  });

  it('une remarque au plus par photo, le défaut avant la qualité', () => {
    const c = comparerPhotos(
      [
        { id: 'a', indicateurs: mesure({ nettete: 2000, claires: 0.2 }) },
        { id: 'b', indicateurs: mesure({ nettete: 400 }) },
      ],
      'rafales',
    );
    expect(c.plusNette).toBe('a');
    expect(c.remarques.get('a')).toBe('trop_claire');
  });

  it('ne dit rien si une photo n’est pas encore analysée', () => {
    const c = comparerPhotos([{ id: 'a', indicateurs: mesure({ nettete: 2000 }) }, { id: 'b' }], 'rafales');
    expect(c.remarques.size).toBe(0);
    expect(c.plusNette).toBeUndefined();
  });
});
