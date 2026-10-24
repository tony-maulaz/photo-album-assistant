// Worker d'analyse : décodage à l'endroit, phash, netteté, empreinte, miniatures.
// Tourne hors du fil principal pour garder l'interface fluide.

import { grisOpenCV, grisPillow, type ImageRVBA } from '../lib/image';
import { COTE_SCRIPT_01, COTE_SCRIPT_06, nettete, varianceLaplacien } from '../lib/nettete';
import { phash, phashDepuisGris32 } from '../lib/phash';
import { exposition } from '../lib/indicateurs';
import { dimensionsAffichees, dimensionsJpeg, orientationJpeg } from '../lib/jpeg';
import { ecrireMiniature } from '../navigateur/cacheMiniatures';
import type { Message, Reponse, ResultatAnalyse, ResultatIndicateurs, ResultatMiniature, Tache } from './protocole';

const portee = self as unknown as {
  onmessage: ((e: MessageEvent<Message>) => void) | null;
  postMessage(r: Reponse): void;
};

/** Pixels d'un bitmap, sans conversion de couleur (comme Pillow et OpenCV). */
function pixels(bmp: ImageBitmap): ImageRVBA {
  const canevas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canevas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Contexte 2D indisponible');
  ctx.drawImage(bmp, 0, 0);
  const donnees = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  return { largeur: bmp.width, hauteur: bmp.height, donnees };
}

const OPTIONS_DECODAGE: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'none',
  premultiplyAlpha: 'none',
};

async function analyser(t: Extract<Tache, { type: 'analyser' }>): Promise<ResultatAnalyse> {
  const r: ResultatAnalyse = { largeur: 0, hauteur: 0, durees: {} };
  let t0 = performance.now();
  if (t.fidele || t.rapide) {
    const bmp = await createImageBitmap(t.fichier, OPTIONS_DECODAGE);
    r.largeur = bmp.width;
    r.hauteur = bmp.height;
    if (t.fidele) {
      const img = pixels(bmp);
      r.durees.decodage = performance.now() - t0;
      t0 = performance.now();
      r.phash = phash(img);
      r.durees.phash = performance.now() - t0;
      t0 = performance.now();
      const gris = grisOpenCV(img);
      r.nettete1024 = nettete(gris, COTE_SCRIPT_01);
      r.nettete800 = nettete(gris, COTE_SCRIPT_06);
      r.durees.nettete = performance.now() - t0;
    }
    bmp.close();
  }
  if (t.rapide) {
    // Variantes où le navigateur décode directement à taille réduite (bien plus
    // rapide sur 12 Mpx), pour mesurer l'écart avec les scripts.
    t0 = performance.now();
    const echelle = Math.min(1, COTE_SCRIPT_01 / Math.max(r.largeur, r.hauteur));
    const b1024 = await createImageBitmap(t.fichier, {
      ...OPTIONS_DECODAGE,
      resizeWidth: Math.trunc(r.largeur * echelle),
      resizeHeight: Math.trunc(r.hauteur * echelle),
      resizeQuality: 'low',
    });
    const img1024 = pixels(b1024);
    b1024.close();
    r.netteteRapide1024 = varianceLaplacien(grisOpenCV(img1024));
    r.durees.netteteRapide = performance.now() - t0;
    t0 = performance.now();
    r.phashDepuis1024 = phash(img1024);
    r.durees.phashDepuis1024 = performance.now() - t0;
    t0 = performance.now();
    const e512 = Math.min(1, 512 / Math.max(r.largeur, r.hauteur));
    const b512 = await createImageBitmap(t.fichier, {
      ...OPTIONS_DECODAGE,
      resizeWidth: Math.round(r.largeur * e512),
      resizeHeight: Math.round(r.hauteur * e512),
      resizeQuality: 'high',
    });
    r.phashDepuis512 = phash(pixels(b512));
    b512.close();
    r.durees.phashDepuis512 = performance.now() - t0;
    t0 = performance.now();
    const b32 = await createImageBitmap(t.fichier, { ...OPTIONS_DECODAGE, resizeWidth: 32, resizeHeight: 32, resizeQuality: 'high' });
    r.phashRapide = phashDepuisGris32(grisPillow(pixels(b32)).donnees);
    b32.close();
    r.durees.phashRapide = performance.now() - t0;
  }
  if (t.empreinte) {
    t0 = performance.now();
    const condensat = await crypto.subtle.digest('SHA-256', await t.fichier.arrayBuffer());
    r.sha256 = Array.from(new Uint8Array(condensat), (o) => o.toString(16).padStart(2, '0')).join('');
    r.durees.empreinte = performance.now() - t0;
  }
  return r;
}

async function miniature(t: Extract<Tache, { type: 'miniature' }>): Promise<ResultatMiniature> {
  let t0 = performance.now();
  const bmp = await createImageBitmap(t.fichier, { imageOrientation: 'from-image', resizeHeight: t.hauteur, resizeQuality: 'medium' });
  const canevas = new OffscreenCanvas(bmp.width, bmp.height);
  canevas.getContext('2d')!.drawImage(bmp, 0, 0);
  const decodage = performance.now() - t0;
  t0 = performance.now();
  const jpeg = await canevas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const encodage = performance.now() - t0;
  t0 = performance.now();
  await ecrireMiniature(t.stockage, t.cle, jpeg);
  const ecriture = performance.now() - t0;
  const r = { largeur: bmp.width, hauteur: bmp.height, octets: jpeg.size, jpeg, durees: { decodage, encodage, ecriture } };
  bmp.close();
  return r;
}

/** Dimensions à l'endroit : en-tête JPEG et balise Orientation, sans décoder l'image. */
async function dimensions(fichier: Blob): Promise<{ largeur: number; hauteur: number }> {
  const tete = new Uint8Array(await fichier.slice(0, 256 * 1024).arrayBuffer());
  const lire = async (debut: number, longueur: number) => tete.subarray(debut, debut + longueur);
  const d = await dimensionsJpeg(lire, tete.length);
  if (d) return dimensionsAffichees(d, orientationJpeg(tete) ?? 1);
  const bmp = await createImageBitmap(fichier, OPTIONS_DECODAGE);
  const r = { largeur: bmp.width, hauteur: bmp.height };
  bmp.close();
  return r;
}

/** Voie rapide (D29) : décodage direct à 1024 px, netteté et ressemblance sur cette image. */
async function indicateurs(t: Extract<Tache, { type: 'indicateurs' }>): Promise<ResultatIndicateurs> {
  const d = await dimensions(t.fichier);
  const echelle = Math.min(1, COTE_SCRIPT_01 / Math.max(d.largeur, d.hauteur));
  const bmp = await createImageBitmap(t.fichier, {
    ...OPTIONS_DECODAGE,
    resizeWidth: Math.max(1, Math.trunc(d.largeur * echelle)),
    resizeHeight: Math.max(1, Math.trunc(d.hauteur * echelle)),
    resizeQuality: 'low',
  });
  const img = pixels(bmp);
  bmp.close();
  const gris = grisOpenCV(img);
  return { phash: phash(img), nettete: varianceLaplacien(gris), ...exposition(gris) };
}

portee.onmessage = async (e) => {
  const { id, tache } = e.data;
  try {
    const resultat = tache.type === 'analyser' ? await analyser(tache) : tache.type === 'indicateurs' ? await indicateurs(tache) : await miniature(tache);
    portee.postMessage({ id, ok: true, resultat });
  } catch (err) {
    portee.postMessage({ id, ok: false, erreur: err instanceof Error ? `${err.name} : ${err.message}` : String(err) });
  }
};
