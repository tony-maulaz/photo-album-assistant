// Accès à l'API Claude depuis le navigateur, avec la clé de l'utilisateur.

import Anthropic from '@anthropic-ai/sdk';
import { t } from '../lib/langue';
import { cleApi } from './cle';

/**
 * Client du SDK officiel. `dangerouslyAllowBrowser` est la façon documentée
 * d'appeler l'API depuis une page : la clé est celle de l'utilisateur, saisie
 * par lui et gardée dans son navigateur.
 */
export function client(): Anthropic {
  const apiKey = cleApi();
  if (!apiKey) throw new Error(t`Saisissez d’abord la clé API (Réglages).`);
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Message de l'API sans son enveloppe JSON (« Overloaded » plutôt que `529 {"type":"error",…}`). */
function detailApi(err: InstanceType<typeof Anthropic.APIError>): string {
  const corps = err.error as { error?: { message?: unknown }; message?: unknown } | undefined;
  const m = corps?.error?.message ?? corps?.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  return err.message.replace(/^\d{3}\s+/, '').replace(/\s*\{.*\}\s*$/s, '').trim();
}

/**
 * Message compréhensible pour une erreur du SDK : ce qui s'est passé et quoi
 * faire, jamais la réponse JSON brute de l'API.
 */
export function expliquerErreur(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return t`Action annulée.`;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return t`Le service Claude ne répond pas à temps : vérifiez la connexion à internet, puis réessayez.`;
  if (err instanceof Anthropic.APIConnectionError) return t`Impossible de joindre le service Claude (connexion coupée ou bloquée) : vérifiez la connexion à internet, puis réessayez.`;
  if (err instanceof Anthropic.APIError) {
    const detail = detailApi(err);
    const statut = err.status;
    if (statut === 401) return t`Clé API refusée (401) : vérifiez-la dans Réglages.`;
    if (statut === 403) return t`Accès refusé (403) : ${detail}`;
    if (statut === 404) return t`Introuvable (404) : vérifiez les modèles dans Réglages. ${detail}`;
    if (statut === 413) return t`Demande trop volumineuse (413) : relancez avec moins de photos à la fois.`;
    if (statut === 429) return t`Trop de demandes en peu de temps (429) : patientez une minute, puis réessayez.`;
    if (statut === 529 || err.type === 'overloaded_error') return t`Le service Claude est surchargé pour le moment (529) : réessayez dans quelques minutes.`;
    if (statut !== undefined && statut >= 500) return t`Le service Claude a un problème passager (${statut}) : réessayez plus tard.`;
    if (statut === 400 && /credit balance/i.test(detail)) return t`Crédit API épuisé : rechargez le compte sur console.anthropic.com, puis réessayez.`;
    if (statut === 400) return t`Requête refusée (400) : ${detail}`;
    return statut ? t`Erreur de l’API (${statut}) : ${detail}` : detail;
  }
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
