import { describe, expect, it } from 'vitest';
import { appareilsDetectes, appliquerDecalage, decalageAppareil, mesurerDecalage, minutesDecalage, texteDecalage, type PhotoHorloge } from '../src/lib/appareils';
import { estCapture } from '../src/lib/fichiers';

describe('appareils détectés', () => {
  it('modèles, marque la plus fréquente et période, du plus utilisé au moins utilisé', () => {
    const a = appareilsDetectes([
      { id: '1', appareil: 'Galaxy S25', marque: 'samsung', date: '2026-07-12T10:00:00' },
      { id: '2', appareil: 'Galaxy S25 ', marque: 'samsung', date: '2026-07-10T09:00:00' },
      { id: '3', appareil: 'Galaxy A54 5G', marque: 'samsung', date: '2026-07-11T08:00:00' },
      { id: '4' },
      { id: '5', appareil: 'Galaxy S25', marque: 'Samsung' },
    ]);
    expect(a).toEqual([
      { modele: 'Galaxy S25', marque: 'samsung', n: 3, du: '2026-07-10T09:00:00', au: '2026-07-12T10:00:00' },
      { modele: 'Galaxy A54 5G', marque: 'samsung', n: 1, du: '2026-07-11T08:00:00', au: '2026-07-11T08:00:00' },
    ]);
  });
});

describe('décalage d’horloge (script 03, --decalage-appareil)', () => {
  it('lit et écrit « ±HH:MM », heures au-delà de 24 comprises', () => {
    expect(minutesDecalage('+16:01')).toBe(961);
    expect(minutesDecalage('-00:30')).toBe(-30);
    expect(minutesDecalage('16:01')).toBeNull();
    expect(texteDecalage(961)).toBe('+16:01');
    expect(texteDecalage(-30)).toBe('-00:30');
    expect(texteDecalage(-1500)).toBe('-25:00');
  });

  it('on ajoute le décalage, comme read_dt_model du script 03', () => {
    expect(appliquerDecalage('2026-07-14T23:30:00', '+16:01')).toBe('2026-07-15T15:31:00');
    expect(appliquerDecalage('2026-03-01T00:10:00', '-00:20')).toBe('2026-02-28T23:50:00');
    expect(appliquerDecalage('2026-07-14', '+16:01')).toBe('2026-07-14');
    expect(appliquerDecalage('2026-07-14T10:00:00', 'n’importe quoi')).toBe('2026-07-14T10:00:00');
  });

  it('retrouve le décalage enregistré d’un modèle (exact, puis contenu)', () => {
    const config = [
      { modele: 'Galaxy S25', decalage: '+00:00' },
      { modele: 'Galaxy A54', decalage: '+16:01' },
    ];
    expect(decalageAppareil('galaxy s25', config)).toBe('+00:00');
    expect(decalageAppareil('Galaxy A54 5G', config)).toBe('+16:01');
    expect(decalageAppareil('iPhone 15', config)).toBeNull();
    expect(decalageAppareil(undefined, config)).toBeNull();
  });

  it('mesure le décalage sur une scène photographiée par deux appareils, malgré les ressemblances de hasard', () => {
    const h = (n: number) => n.toString(16).padStart(16, '0');
    // L'appareil B retarde de 1 h 02 : ses photos de la même scène portent une heure plus petite.
    const a: PhotoHorloge[] = [
      { id: 'a1', date: '2026-07-16T09:43:10', phash: h(0x0f) },
      { id: 'a2', date: '2026-07-16T10:20:00', phash: h(0xf000) },
      { id: 'a3', date: '2026-07-16T11:05:30', phash: h(0xff0000) },
      { id: 'a4', date: '2026-07-16T07:00:00', phash: h(0xabcdef12345) },
    ];
    const b: PhotoHorloge[] = [
      { id: 'b1', date: '2026-07-16T08:41:00', phash: h(0x0e) },
      { id: 'b2', date: '2026-07-16T09:18:20', phash: h(0xf001) },
      { id: 'b3', date: '2026-07-16T10:03:40', phash: h(0xff0001) },
      // Ressemblance de hasard, 2 h 20 plus tard.
      { id: 'b4', date: '2026-07-16T04:40:00', phash: h(0xabcdef12345) },
      { id: 'b5', date: '2026-07-16T10:00:00' },
    ];
    expect(mesurerDecalage(a, b)).toEqual({ decalage: '+01:02', minutes: 62, paires: 3, candidates: 4 });
    expect(mesurerDecalage(a, [])).toBeNull();
    // Une horloge en retard de 16 h n'est trouvée qu'avec une fenêtre élargie.
    const tard = b.slice(0, 3).map((p) => ({ ...p, date: appliquerDecalage(p.date!, '-15:00') }));
    expect(mesurerDecalage(a, tard)).toBeNull();
    expect(mesurerDecalage(a, tard, { fenetreHeures: 24 })?.decalage).toBe('+16:02');
  });
});

describe('captures d’écran', () => {
  it('reconnues par leur nom', () => {
    for (const nom of ['Screenshot_20250704-123456.jpg', 'Screenshot_20250704-123456_WhatsApp.jpg', 'Capture d’écran 2025-07-04 à 12.34.56.png', 'Capture_d_ecran_2025.png', 'Screen Shot 2025-07-04 at 12.34.56.png', 'Bildschirmfoto 2025.png']) {
      expect(estCapture({ nom })).toBe(true);
    }
  });

  it('PNG ou JPEG aux dimensions d’un écran, sans marque d’appareil', () => {
    expect(estCapture({ nom: 'image.png', dims: { l: 1080, h: 2340 } })).toBe(true);
    expect(estCapture({ nom: 'image.png', dims: { l: 1920, h: 1080 } })).toBe(true);
    expect(estCapture({ nom: 'IMG-20250704-WA0001.jpg', dims: { l: 1170, h: 2532 } })).toBe(true);
  });

  it('prudente : dans le doute, ce n’est pas une capture', () => {
    // Une vraie photo (marque d'appareil), un JPEG au format d'un écran d'ordinateur, un PNG quelconque, sans dimensions.
    expect(estCapture({ nom: '20250704_123456.jpg', marque: 'samsung', appareil: 'Galaxy S25', dims: { l: 1080, h: 2340 } })).toBe(false);
    expect(estCapture({ nom: 'fond.jpg', dims: { l: 1920, h: 1080 } })).toBe(false);
    expect(estCapture({ nom: 'logo.png', dims: { l: 800, h: 600 } })).toBe(false);
    expect(estCapture({ nom: 'image.png' })).toBe(false);
    expect(estCapture({ nom: 'Capture du poisson.jpg', marque: 'samsung' })).toBe(false);
  });
});
