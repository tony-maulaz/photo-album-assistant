import { describe, expect, it } from 'vitest';
import { dateDepuisNom, texteDate } from '../src/lib/dates';

/** [nom de fichier, date attendue ou null, motif attendu] */
const CAS: [string, string | null, string?][] = [
  // Samsung et Android
  ['20250910_151406.jpg', '2025-09-10 15:14:06', 'aaaammjj_hhmmss'],
  ['20250816_233319(0).jpg', '2025-08-16 23:33:19', 'aaaammjj_hhmmss'],
  ['20250704_123456_001.jpg', '2025-07-04 12:34:56', 'aaaammjj_hhmmss'],
  ['IMG_20250704_123456.jpg', '2025-07-04 12:34:56', 'aaaammjj_hhmmss'],
  ['VID_20250704_123456.mp4', '2025-07-04 12:34:56', 'aaaammjj_hhmmss'],
  ['Screenshot_20250704-123456.jpg', '2025-07-04 12:34:56', 'aaaammjj_hhmmss'],
  ['Screenshot_20250704-123456_Chrome.jpg', '2025-07-04 12:34:56', 'aaaammjj_hhmmss'],
  ['VideoCapture_20251012-194609.jpg', '2025-10-12 19:46:09', 'aaaammjj_hhmmss'],
  // WhatsApp (jour seulement)
  ['IMG-20250704-WA0012.jpg', '2025-07-04', 'whatsapp'],
  ['VID-20250704-WA0003.mp4', '2025-07-04', 'whatsapp'],
  // Avec tirets
  ['2025-01-01-141027990.mp4', '2025-01-01 14:10:27', 'aaaa-mm-jj-hhmmss'],
  ['signal-2025-07-04-123456.jpg', '2025-07-04 12:34:56', 'aaaa-mm-jj-hhmmss'],
  ['2025-07-04 12.34.56.jpg', '2025-07-04 12:34:56', 'aaaa-mm-jj-hhmmss'],
  ['Capture d’écran 2025-03-01 à 10.20.30.png', '2025-03-01 10:20:30', 'aaaa-mm-jj-hhmmss'],
  ['Screenshot 2025-03-01 at 10.20.30.png', '2025-03-01 10:20:30', 'aaaa-mm-jj-hhmmss'],
  ['WhatsApp Image 2025-06-14 at 14.33.39.jpeg', '2025-06-14 14:33:39', 'aaaa-mm-jj-hhmmss'],
  ['Photo 2025-07-04.jpg', '2025-07-04', 'aaaa-mm-jj'],
  ['IMG_20250704.jpg', '2025-07-04', 'aaaammjj'],
  // Formats en temps universel
  ['PXL_20250704_103456789.jpg', '2025-07-04 10:34:56', 'pixel'],
  ['FB_IMG_1756281978565.jpg', '2025-08-27 08:06:18', 'facebook'],
  // Renommés à la main (convention Theme_Lieu_JJ.MM.AA)
  ['jardin_21.04.25 (2).jpg', '2025-04-21', 'jj.mm.aa'],
  ['Annecy_27-28.06.25 (65).jpg', '2025-06-27', 'jj.mm.aa'],
  ['400eme_tir_Champagne_29.05-01.06.25 (11).jpg', '2025-05-29', 'jj.mm.aa'],
  ['Vicheres_18.01.25_Meister (3).jpg', '2025-01-18', 'jj.mm.aa'],
  ['25.04.25 (2).jpg', '2025-04-25', 'jj.mm.aa'],
  ['Baignade_concise_11.03.2025 (1).mp4', '2025-03-11', 'jj.mm.aa'],
  // Sans date exploitable
  ['DSCF6533.JPG', null],
  ['IMG_2043.jpg', null],
  ['Verdeil_Explorit_24.06 (3).mp4', null], // jour et mois sans année
  ['GTG_Paris_23-26.10 (50).jpg', null],
  ['14Juillet_BourbonL\'Archambault (10).jpg', null],
  ['20251399_123456.jpg', null], // mois 13
  ['20250230.jpg', null], // 30 février
  ['20250704_256199.jpg', '2025-07-04', 'aaaammjj'], // heure invalide : date seule
];

describe('dateDepuisNom', () => {
  for (const [nom, attendu, motif] of CAS) {
    it(`${nom} → ${attendu ?? 'aucune date'}`, () => {
      const d = dateDepuisNom(nom);
      if (attendu === null) {
        expect(d).toBeNull();
      } else {
        expect(d).not.toBeNull();
        expect(texteDate(d!)).toBe(attendu);
        expect(d!.motif).toBe(motif);
      }
    });
  }

  it('signale les formats en temps universel', () => {
    expect(dateDepuisNom('PXL_20250704_103456789.jpg')!.utc).toBe(true);
    expect(dateDepuisNom('FB_IMG_1756281978565.jpg')!.utc).toBe(true);
    expect(dateDepuisNom('20250910_151406.jpg')!.utc).toBe(false);
  });

  it('ignore le chemin du dossier', () => {
    expect(texteDate(dateDepuisNom('Vacances_2024/20250910_151406.jpg')!)).toBe('2025-09-10 15:14:06');
  });
});
