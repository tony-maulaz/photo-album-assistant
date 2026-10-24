// Accès à l'API Claude depuis le navigateur, avec la clé de l'utilisateur.

import Anthropic from '@anthropic-ai/sdk';
import { cleApi } from './cle';

/**
 * Client du SDK officiel. `dangerouslyAllowBrowser` est la façon documentée
 * d'appeler l'API depuis une page : la clé est celle de l'utilisateur, saisie
 * par lui et gardée dans son navigateur.
 */
export function client(): Anthropic {
  const apiKey = cleApi();
  if (!apiKey) throw new Error('Saisissez d’abord la clé API (Réglages).');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Message d'erreur compréhensible pour une erreur du SDK. */
export function expliquerErreur(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Clé API refusée (401) : vérifiez-la.';
  if (err instanceof Anthropic.PermissionDeniedError) return `Accès refusé (403) : ${err.message}`;
  if (err instanceof Anthropic.NotFoundError) return `Introuvable (404) : ${err.message}`;
  if (err instanceof Anthropic.RateLimitError) return 'Trop de requêtes (429) : patientez puis réessayez.';
  if (err instanceof Anthropic.BadRequestError) return `Requête refusée (400) : ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return `Échec réseau (connexion, CORS ou blocage) : ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Erreur de l’API (${err.status}) : ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/** Réduit une image (à l'endroit) à `coteMax` px et la renvoie en JPEG base64. */
export async function imageBase64(fichier: Blob, coteMax: number): Promise<{ donnees: string; largeur: number; hauteur: number; octets: number }> {
  const brute = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const e = Math.min(1, coteMax / Math.max(brute.width, brute.height));
  const largeur = Math.round(brute.width * e);
  const hauteur = Math.round(brute.height * e);
  brute.close();
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image', resizeWidth: largeur, resizeHeight: hauteur, resizeQuality: 'high' });
  const canevas = new OffscreenCanvas(largeur, hauteur);
  canevas.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const jpeg = await canevas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const octets = new Uint8Array(await jpeg.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return { donnees: btoa(binaire), largeur, hauteur, octets: jpeg.size };
}
