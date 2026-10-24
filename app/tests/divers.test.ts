import { describe, expect, it } from 'vitest';
import { nomAscii, nomDepuisAdresse, nomUtilisable } from '../src/lib/noms';
import { nomSauvegarde, sauvegardesEnTrop, validerConfig } from '../src/lib/config';
import { coutUSD, jetonsImage } from '../src/lib/tarifs';
import { categorie } from '../src/lib/fichiers';
import exemple from '../../config.exemple/config.json';

describe('noms de lieux (incident I3)', () => {
  it('passe un nom en ASCII sans espaces', () => {
    expect(nomAscii('Château-d’Œx')).toBe('Chateau-dx');
    expect(nomAscii('Saint Gall')).toBe('Saint_Gall');
  });

  it('refuse un nom thaï, vidé par la translittération', () => {
    expect(nomUtilisable('บ้านเฉวงน้อย')).toBe(false);
    expect(nomUtilisable('Baan Chaweng Noi')).toBe(true);
    expect(nomUtilisable(undefined)).toBe(false);
  });

  it('préfère un nom précis utilisable à la province', () => {
    expect(nomDepuisAdresse({ village: 'บ้านเฉวงน้อย', province: 'Surat Thani Province' })).toEqual({
      nom: 'Surat Thani Province',
      precis: false,
    });
    expect(nomDepuisAdresse({ village: 'Baan Chaweng Noi', province: 'Surat Thani' })).toEqual({
      nom: 'Baan Chaweng Noi',
      precis: true,
    });
    expect(nomDepuisAdresse({})).toBeNull();
  });
});

describe('config.json', () => {
  it('accepte le modèle config.exemple', () => {
    expect(validerConfig(exemple)).toEqual([]);
  });

  it('signale les erreurs de structure et de valeurs', () => {
    const mauvais = structuredClone(exemple) as Record<string, unknown> & { lieux_connus: Record<string, unknown>[] };
    mauvais.lieux_connus[0].lat = 123;
    mauvais.lieux_connus[1].domicile = true;
    mauvais.version = 7;
    const erreurs = validerConfig(mauvais);
    expect(erreurs).toContain('Lieu 1 : latitude invalide.');
    expect(erreurs).toContain('Un seul lieu peut être le domicile.');
    expect(erreurs.some((e) => e.startsWith('Version 7'))).toBe(true);
    expect(validerConfig([])).toEqual(['Le fichier ne contient pas un objet JSON.']);
  });

  it('nomme et élague les sauvegardes', () => {
    expect(nomSauvegarde(new Date(2026, 9, 21, 9, 5, 7))).toBe('config_20261021-090507.json');
    const noms = Array.from({ length: 12 }, (_, i) => `config_202610${String(i + 10)}-120000.json`);
    expect(sauvegardesEnTrop([...noms, 'autre.txt'], 10)).toEqual(noms.slice(0, 2));
  });
});

describe('tarifs', () => {
  it('calcule le coût d’une réponse avec recherches web', () => {
    const usage = { input_tokens: 10_000, output_tokens: 1_000, server_tool_use: { web_search_requests: 2 } };
    expect(coutUSD('claude-sonnet-5-5', usage)).toBeCloseTo(0.02 + 0.01 + 0.02, 10);
    expect(coutUSD('claude-sonnet-5-5', usage, true)).toBeCloseTo(0.015 + 0.02, 10);
    expect(coutUSD('modele-inconnu', usage)).toBeNull();
  });

  it('compte les jetons d’une image', () => {
    expect(jetonsImage(1568, 724, 2576)).toBe(56 * 26);
    expect(jetonsImage(4000, 1848, 1568)).toBe(56 * 26);
  });
});

describe('catégories de fichiers', () => {
  it('classe photos, vidéos et autres fichiers', () => {
    expect(categorie('IMG_1.JPG')).toBe('photo');
    expect(categorie('x.heic')).toBe('photo');
    expect(categorie('20250704_123456.mp4')).toBe('video');
    expect(categorie('Thumbs.db')).toBe('autre');
    expect(categorie('sans_extension')).toBe('autre');
  });
});

describe('indicateurs techniques', () => {
  it('mesure l’exposition et repère sombre, cramée et contre-jour', async () => {
    const { exposition, signaux, seuilFlou } = await import('../src/lib/indicateurs');
    const image = (f: (x: number, y: number) => number) => {
      const donnees = new Uint8Array(90 * 60);
      for (let y = 0; y < 60; y++) for (let x = 0; x < 90; x++) donnees[y * 90 + x] = f(x, y);
      return { largeur: 90, hauteur: 60, donnees };
    };
    const sombre = exposition(image(() => 12));
    expect(sombre.sombres).toBe(1);
    expect(signaux({ ...sombre, phash: '', nettete: 100 }, 50)).toEqual(['sombre']);
    const cramee = exposition(image(() => 250));
    expect(signaux({ ...cramee, phash: '', nettete: 100 }, 50)).toEqual(['cramee']);
    // Ciel clair tout autour, sujet sombre au centre.
    const contre = exposition(image((x, y) => (x >= 30 && x < 60 && y >= 20 && y < 40 ? 60 : 225)));
    expect(signaux({ ...contre, phash: '', nettete: 10 }, 50)).toEqual(['flou', 'contre_jour']);
    expect(seuilFlou([100, 100, 100, 100, 100])).toBe(50);
    expect(seuilFlou([10, 200, 210, 220, 230, 240])).toBe(10);
  });
});

describe('enParallele : arrêt propre à la première erreur', () => {
  it('plus rien n’est lancé après une erreur, ce qui est en cours se termine, puis l’erreur est levée', async () => {
    const { enParallele } = await import('../src/navigateur/workers');
    let lances = 0;
    let finis = 0;
    const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await expect(
      enParallele(Array.from({ length: 12 }, (_, i) => i), 3, async (i) => {
        lances++;
        if (i === 0) throw new Error('réseau');
        await attendre(20);
        finis++;
      }),
    ).rejects.toThrow('réseau');
    expect(lances).toBe(3);
    expect(finis).toBe(2);
  });
});

describe('coordonnées collées (Configuration, lieux connus)', () => {
  it('reconnaît les formats courants, refuse le lien court', async () => {
    const { lireCoordonnees, lienCourt } = await import('../src/lib/coordonnees');
    expect(lireCoordonnees('48.8584, 2.2945')).toEqual({ lat: 48.8584, lon: 2.2945 });
    expect(lireCoordonnees('https://www.google.com/maps/place/Lyon/@48.8606,2.3376,15z/data=x')).toEqual({ lat: 48.8606, lon: 2.3376 });
    expect(lireCoordonnees('https://www.google.com/maps/place/X/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d48.8611!4d2.3364')).toEqual({ lat: 48.8611, lon: 2.3364 });
    expect(lireCoordonnees('https://maps.google.com/?q=46.5,6.6')).toEqual({ lat: 46.5, lon: 6.6 });
    expect(lireCoordonnees('https://maps.app.goo.gl/Ab12Cd34Ef56Gh78X')).toBeNull();
    expect(lienCourt('https://maps.app.goo.gl/Ab12Cd34Ef56Gh78X')).toBe(true);
  });
});
