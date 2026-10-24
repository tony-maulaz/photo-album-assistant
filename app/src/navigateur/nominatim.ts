// Géocodage inverse et recherche d'adresse avec Nominatim (OpenStreetMap),
// en respectant la règle d'usage : au plus une requête par seconde.

import { t } from '../lib/langue';
import { nomDepuisAdresse } from '../lib/noms';

const SERVEUR = 'https://nominatim.openstreetmap.org';
/** Écart minimal entre deux requêtes (le script 01 utilisait 1,1 s). */
export const INTERVALLE_MS = 1100;

let derniere = 0;
let file: Promise<unknown> = Promise.resolve();

export interface ReponseNominatim<T> {
  donnees: T;
  statut: number;
  dureeMs: number;
  /** Instant d'envoi (ms depuis le chargement de la page), pour vérifier l'espacement. */
  envoi: number;
}

/** Envoie les requêtes l'une après l'autre, espacées d'au moins INTERVALLE_MS. */
function requete<T>(chemin: string, parametres: Record<string, string>, email?: string): Promise<ReponseNominatim<T>> {
  const suite = file.then(async () => {
    const attente = derniere + INTERVALLE_MS - performance.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    const p = new URLSearchParams({ format: 'jsonv2', ...parametres });
    if (email) p.set('email', email);
    const envoi = performance.now();
    derniere = envoi;
    const reponse = await fetch(`${SERVEUR}/${chemin}?${p}`, { headers: { Accept: 'application/json' } });
    const dureeMs = performance.now() - envoi;
    if (!reponse.ok) throw new Error(t`Nominatim a répondu ${reponse.status} ${reponse.statusText}`);
    return { donnees: (await reponse.json()) as T, statut: reponse.status, dureeMs, envoi };
  });
  file = suite.catch(() => undefined);
  return suite;
}

export interface Adresse {
  /** Nom de l'endroit trouvé (école, stade, magasin…), s'il en a un. */
  name?: string;
  address?: Record<string, string>;
  display_name?: string;
  error?: string;
}

/** Géocodage inverse : zoom 14 pour le nom d'une localité, 18 pour l'adresse précise. */
export function inverse(lat: number, lon: number, langue: string, email?: string, zoom = 14) {
  return requete<Adresse>('reverse', { lat: String(lat), lon: String(lon), zoom: String(zoom), addressdetails: '1', 'accept-language': langue }, email);
}

export function rechercher(texte: string, langue: string, email?: string) {
  return requete<{ display_name: string; lat: string; lon: string }[]>('search', { q: texte, limit: '5', 'accept-language': langue }, email);
}

export interface NomLieu {
  nom: string | null;
  precis: boolean;
  langue: string | null;
  requetes: ReponseNominatim<Adresse>[];
}

/**
 * Nom de lieu comme le script 01 : dans la langue du projet d'abord, puis en
 * anglais si le nom n'est pas en écriture latine (I3).
 */
export async function nomDeLieu(lat: number, lon: number, email?: string, langueProjet: string = 'fr'): Promise<NomLieu> {
  const requetes: ReponseNominatim<Adresse>[] = [];
  let large: { nom: string; langue: string } | null = null;
  for (const langue of [...new Set([langueProjet, 'en'])]) {
    const r = await inverse(lat, lon, langue, email);
    requetes.push(r);
    const trouve = r.donnees.address ? nomDepuisAdresse(r.donnees.address) : null;
    if (trouve?.precis) return { nom: trouve.nom, precis: true, langue, requetes };
    if (trouve && !large) large = { nom: trouve.nom, langue };
  }
  return { nom: large?.nom ?? null, precis: false, langue: large?.langue ?? null, requetes };
}
