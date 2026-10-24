import { describe, expect, it } from 'vitest';
import { candidatsEmpreinte, groupesDoublonsExacts, nomParlant, type PhotoExacte } from '../src/lib/doublonsExacts';

const photo = (id: string, extra: Partial<PhotoExacte> = {}): PhotoExacte => ({
  id,
  nom: id.split('/').pop()!,
  dossier: id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '',
  taille: 3_000_000,
  exif: true,
  gardeTelQuel: false,
  dims: { l: 4000, h: 3000 },
  phash: 'c3a5e1f00f1e5a3c',
  ...extra,
});

describe('candidats aux empreintes', () => {
  it('seules les photos de même taille méritent une empreinte', () => {
    expect(candidatsEmpreinte([photo('a'), photo('b'), photo('c', { taille: 12 }), photo('d', { taille: 0 }), photo('e', { taille: 0 })])).toEqual([['a', 'b']]);
  });
});

describe('noms parlants', () => {
  it('reconnaît un nom donné à la main', () => {
    expect(nomParlant('Anniversaire Lea.jpg')).toBe(true);
    expect(nomParlant('Fête des voisins (2).jpg')).toBe(true);
    for (const n of ['IMG_2043.jpg', '20250927_103937.jpg', 'IMG-20250704-WA0012.jpg', 'PXL_20250704_123456789.jpg', 'Copie de IMG_1.jpg', 'DSC01234.JPG', 'abc.jpg']) {
      expect(nomParlant(n)).toBe(false);
    }
  });
});

describe('doublons exacts (D31)', () => {
  it('même contenu dans un même dossier : la copie au nom parlant est gardée', () => {
    const g = groupesDoublonsExacts([
      photo('Vrac/20250704_123456.jpg', { empreinte: 'aa' }),
      photo('Vrac/Anniversaire Lea.jpg', { empreinte: 'aa' }),
      photo('Vrac/autre.jpg', { empreinte: 'bb' }),
    ]);
    expect(g).toEqual([{ garde: 'Vrac/Anniversaire Lea.jpg', copies: [{ id: 'Vrac/20250704_123456.jpg', type: 'identique' }] }]);
  });

  it('BESTOF fait de copies voulues : jamais touché, ni comme copie ni comme référence', () => {
    const photos = [
      photo('Vrac/IMG_1.jpg', { empreinte: 'aa' }),
      photo('BESTOF_2025/IMG_1.jpg', { empreinte: 'aa', gardeTelQuel: true }),
      photo('BESTOF_2025/IMG_2.jpg', { empreinte: 'bb', gardeTelQuel: true }),
      photo('BESTOF_2025/IMG_2 (1).jpg', { empreinte: 'bb', gardeTelQuel: true }),
    ];
    expect(groupesDoublonsExacts(photos)).toEqual([]);
    // Deux copies hors BESTOF : l'une est proposée, celle du BESTOF reste.
    expect(groupesDoublonsExacts([...photos, photo('Vrac/IMG_1 (1).jpg', { empreinte: 'aa' })])).toEqual([
      { garde: 'Vrac/IMG_1.jpg', copies: [{ id: 'Vrac/IMG_1 (1).jpg', type: 'identique' }] },
    ]);
  });

  it('version réduite (WhatsApp) : sans EXIF, plus petite, même format, phash à 4 bits au plus', () => {
    const original = photo('Vrac/20260718_113536.jpg', { empreinte: 'o', dims: { l: 4000, h: 3000 }, phash: 'c3a5e1f00f1e5a3c' });
    // Copie déjà à l'endroit : largeur et hauteur échangées, 3 bits d'écart.
    const whatsapp = photo('Vrac/IMG-20260718-WA0003.jpg', { empreinte: 'w', exif: false, taille: 200_000, dims: { l: 1200, h: 1600 }, phash: 'c3a5e1f00f1e5a3f' });
    const encorePlusPetite = photo('Vrac/IMG-20260718-WA0004.jpg', { empreinte: 'p', exif: false, taille: 80_000, dims: { l: 600, h: 800 }, phash: 'c3a5e1f00f1e5a3e' });
    expect(groupesDoublonsExacts([whatsapp, original, encorePlusPetite])).toEqual([
      {
        garde: 'Vrac/20260718_113536.jpg',
        copies: [
          { id: 'Vrac/IMG-20260718-WA0003.jpg', type: 'reduite' },
          { id: 'Vrac/IMG-20260718-WA0004.jpg', type: 'reduite' },
        ],
      },
    ]);
  });

  it('refuse une ressemblance qui n’est pas une copie réduite', () => {
    const original = photo('a.jpg', { empreinte: 'o' });
    const cas: Partial<PhotoExacte>[] = [
      // Phash à 5 bits : une autre prise de vue.
      { phash: 'c3a5e1f00f1e5a03', exif: false, dims: { l: 1600, h: 1200 } },
      // Avec EXIF : un original (une rafale relève de l'étape 8).
      { phash: 'c3a5e1f00f1e5a3c', exif: true, dims: { l: 1600, h: 1200 } },
      // Recadrée : autre format.
      { phash: 'c3a5e1f00f1e5a3c', exif: false, dims: { l: 1600, h: 900 } },
      // Pas plus petite.
      { phash: 'c3a5e1f00f1e5a3c', exif: false, dims: { l: 4000, h: 3000 } },
      // Dimensions inconnues.
      { phash: 'c3a5e1f00f1e5a3c', exif: false, dims: undefined },
    ];
    for (const c of cas) expect(groupesDoublonsExacts([original, photo('b.jpg', { empreinte: 'x', taille: 100, ...c })])).toEqual([]);
  });

  it('une copie réduite dont l’original est gardé tel quel reste en place', () => {
    expect(
      groupesDoublonsExacts([
        photo('BESTOF/a.jpg', { empreinte: 'o', gardeTelQuel: true }),
        photo('Vrac/IMG-WA1.jpg', { empreinte: 'w', exif: false, taille: 100, dims: { l: 1600, h: 1200 } }),
      ]),
    ).toEqual([]);
  });

  it('copies identiques d’une version réduite : rattachées au même original', () => {
    const g = groupesDoublonsExacts([
      photo('Vrac/IMG_5.jpg', { empreinte: 'o' }),
      photo('Vrac/IMG_5 (1).jpg', { empreinte: 'o' }),
      photo('Vrac/IMG-WA1.jpg', { empreinte: 'w', exif: false, taille: 100, dims: { l: 1600, h: 1200 } }),
      photo('Vrac/IMG-WA1 (1).jpg', { empreinte: 'w', exif: false, taille: 100, dims: { l: 1600, h: 1200 } }),
    ]);
    expect(g).toEqual([
      {
        garde: 'Vrac/IMG_5.jpg',
        copies: [
          { id: 'Vrac/IMG_5 (1).jpg', type: 'identique' },
          { id: 'Vrac/IMG-WA1.jpg', type: 'reduite' },
          { id: 'Vrac/IMG-WA1 (1).jpg', type: 'reduite' },
        ],
      },
    ]);
  });
});
