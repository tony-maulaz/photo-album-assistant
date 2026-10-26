// IA16 — choisir dans une rafale (D102). La consigne de la meilleure de la
// pile (IA10), plus une raison par photo : yeux fermés, flou de bougé, tête
// coupée, regards vers l'appareil. Essai sur 26 rafales réelles annotées :
// Haiku en 1568 px choisit une photo acceptable dans 21 cas sur 22, contre 16
// pour « la plus nette » ; Sonnet ne fait pas mieux pour dix fois le prix.
// L'avis est une proposition : il s'applique comme un choix de l'utilisateur,
// annulable, seulement sur une rafale qu'il n'a pas touchée (règle d'or 3).

import consigneRaisons from '../ia/consignes/doublons_rafale.txt?raw';
import consigneMeilleure from '../ia/consignes/selection_meilleure_pile.txt?raw';
import { cleDemande, entier, estObjet, ligneContexte, MAX_PILE, photosNumerotees, SYSTEME_CRITERES, texte, type DemandeIA, type PhotoIA } from './aidesSelection';

export const PARAMETRES_RAFALES = {
  /** Côté envoyé : à 1024 px, un visage d'une photo de groupe ne fait que 30 px (essai D102). */
  cote: 1568,
  /** Au-delà, ni l'utilisateur ni l'IA ne savent départager : l'avis ne choisit rien. */
  personnesMax: 5,
};

export const SCHEMA_RAFALE = {
  type: 'object',
  properties: {
    meilleure: { type: 'integer' },
    notes: { type: 'array', items: { type: 'number' } },
    pleine_page: { type: 'boolean' },
    justification: { type: 'string' },
    equivalentes: { type: 'boolean' },
    personnes: { type: 'integer' },
    photos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          photo: { type: 'integer' },
          yeux_fermes: { type: 'boolean' },
          flou_de_bouge: { type: 'boolean' },
          tete_coupee: { type: 'boolean' },
          vers_appareil: { type: 'integer' },
          raison: { type: 'string' },
        },
        required: ['photo', 'yeux_fermes', 'flou_de_bouge', 'tete_coupee', 'vers_appareil', 'raison'],
        additionalProperties: false,
      },
    },
  },
  required: ['meilleure', 'notes', 'pleine_page', 'justification', 'equivalentes', 'personnes', 'photos'],
  additionalProperties: false,
};

/** Une rafale de 2 à 6 photos (I5) ; au-delà, on ne demande rien. */
export function rafaleDemandable(n: number): boolean {
  return n >= 2 && n <= MAX_PILE;
}

export function demandeRafale(photos: PhotoIA[], o: { contexte?: string } = {}, cote = PARAMETRES_RAFALES.cote): DemandeIA {
  const d = { systeme: SYSTEME_CRITERES, consigne: `${consigneMeilleure}\n\n${consigneRaisons}${ligneContexte(o.contexte)}`, images: photosNumerotees(photos, cote), rechercheWeb: 0 };
  return {
    fonction: 'IA16',
    niveau: 'rapide',
    ...d,
    schema: SCHEMA_RAFALE,
    effort: 'medium',
    maxTokens: 6000,
    ids: photos.map((x) => x.id),
    cle: cleDemande('IA16', photos, d),
    // Mesuré dans l'essai : 300 à 1 600 jetons (réflexion comprise).
    sortieEstimee: 1500,
  };
}

/** Ce que l'IA dit d'une photo, en défauts reconnus et en une phrase. */
export interface AvisPhoto {
  yeuxFermes: boolean;
  flouDeBouge: boolean;
  teteCoupee: boolean;
  raison: string;
}

/** Avis de l'IA sur une rafale, gardé dans `aides.json` sous la signature de ses photos. */
export interface AvisRafale {
  /** Photos envoyées, dans l'ordre : l'avis ne vaut que pour exactement celles-là. */
  ids: string[];
  /** La photo que l'IA garderait ; absente quand il y a trop de monde pour choisir. */
  meilleure?: string;
  equivalentes: boolean;
  personnes: number;
  justification: string;
  photos: Record<string, AvisPhoto>;
}

/** Signature d'une rafale : ses photos, quel que soit leur ordre ou la ★. */
export function signatureRafale(ids: string[]): string {
  return [...ids].sort().join('|');
}

/**
 * Lit la réponse (déjà réparée en JSON) et la valide champ par champ (règle
 * d'or 6) ; `null` si le choix est illisible. Trop de monde : l'avis est gardé
 * (raisons, défauts) mais ne choisit rien.
 */
export function lireRafale(reponse: unknown, ids: string[], p = PARAMETRES_RAFALES): AvisRafale | null {
  const o = Array.isArray(reponse) ? reponse.find(estObjet) : reponse;
  if (!estObjet(o)) return null;
  const n = entier(o.meilleure);
  if (n < 1 || n > ids.length) return null;
  const photos: Record<string, AvisPhoto> = {};
  if (Array.isArray(o.photos))
    for (const x of o.photos) {
      if (!estObjet(x)) continue;
      const k = entier(x.photo);
      if (k < 1 || k > ids.length || photos[ids[k - 1]]) continue;
      photos[ids[k - 1]] = { yeuxFermes: x.yeux_fermes === true, flouDeBouge: x.flou_de_bouge === true, teteCoupee: x.tete_coupee === true, raison: texte(x.raison, 200) };
    }
  const personnes = Math.max(0, entier(o.personnes));
  return {
    ids: [...ids],
    ...(personnes <= p.personnesMax && { meilleure: ids[n - 1] }),
    equivalentes: o.equivalentes === true,
    personnes,
    justification: texte(o.justification, 300),
    photos,
  };
}

/** L'avis s'applique-t-il encore à ces photos ? Une photo partie (floue, copie écartée) l'annule en entier. */
export function avisValable(a: AvisRafale | undefined, ids: string[]): a is AvisRafale {
  return !!a && signatureRafale(a.ids) === signatureRafale(ids);
}
