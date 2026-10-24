import { describe, expect, it } from 'vitest';
import { lireInfosVideo, lireIso6709 } from '../src/lib/video';

/** Boîte MP4 : taille sur 4 octets, type, contenu. */
function boite(type: string, ...contenus: Uint8Array[]): Uint8Array {
  const taille = 8 + contenus.reduce((s, c) => s + c.length, 0);
  const o = new Uint8Array(taille);
  new DataView(o.buffer).setUint32(0, taille);
  for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  let p = 8;
  for (const c of contenus) {
    o.set(c, p);
    p += c.length;
  }
  return o;
}

function mvhd(secondesDepuis1904: number, echelle: number, duree: number): Uint8Array {
  const c = new Uint8Array(100);
  const v = new DataView(c.buffer);
  v.setUint32(4, secondesDepuis1904); // création (version 0)
  v.setUint32(8, secondesDepuis1904); // modification
  v.setUint32(12, echelle);
  v.setUint32(16, duree);
  return boite('mvhd', c);
}

function xyz(texte: string): Uint8Array {
  const octets = new TextEncoder().encode(texte);
  const c = new Uint8Array(4 + octets.length);
  new DataView(c.buffer).setUint16(0, octets.length);
  c.set(octets, 4);
  return boite('©xyz', c);
}

const lecteur = (o: Uint8Array) => async (debut: number, longueur: number) => o.subarray(debut, debut + longueur);

/** 2025-07-04 10:34:56 UTC exprimé en secondes depuis 1904. */
const CREATION = Date.UTC(2025, 6, 4, 10, 34, 56) / 1000 + 2_082_844_800;

describe('lireInfosVideo', () => {
  it('lit la date et le GPS dans une boîte moov placée après les données (Samsung)', async () => {
    const fichier = Uint8Array.from([
      ...boite('ftyp', new TextEncoder().encode('mp42isom')),
      ...boite('mdat', new Uint8Array(5000)),
      ...boite('moov', mvhd(CREATION, 1000, 12_500), boite('udta', xyz('+48.8584+002.2945/'))),
    ]);
    const infos = await lireInfosVideo(lecteur(fichier), fichier.length);
    expect(infos?.dateUTC?.toISOString()).toBe('2025-07-04T10:34:56.000Z');
    expect(infos?.dureeSecondes).toBe(12.5);
    expect(infos?.gps).toEqual({ lat: 48.8584, lon: 2.2945 });
  });

  it('renvoie une date nulle quand la vidéo n’en contient pas', async () => {
    const fichier = boite('moov', mvhd(0, 600, 600));
    const infos = await lireInfosVideo(lecteur(fichier), fichier.length);
    expect(infos?.dateUTC).toBeNull();
  });

  it('renvoie null pour un fichier qui n’est pas une vidéo', async () => {
    const fichier = new TextEncoder().encode('ceci n’est pas une vidéo, seulement du texte.');
    expect(await lireInfosVideo(lecteur(fichier), fichier.length)).toBeNull();
  });
});

describe('lireIso6709', () => {
  it('lit les coordonnées avec ou sans altitude', () => {
    expect(lireIso6709('+09.5057+100.0562/')).toEqual({ lat: 9.5057, lon: 100.0562 });
    expect(lireIso6709('-33.8688+151.2093+012.000/')).toEqual({ lat: -33.8688, lon: 151.2093 });
    expect(lireIso6709('+00.0000+000.0000/')).toBeNull();
    expect(lireIso6709('rien')).toBeNull();
  });
});
