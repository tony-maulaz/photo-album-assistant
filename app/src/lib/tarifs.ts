// Table unique des modèles et tarifs IA (CLAUDE.md, SPEC § 7.2 et § 9).
// Valeurs relevées sur https://platform.claude.com/docs/en/about-claude/pricing
// le 21.10.2026 : à revérifier avant chaque phase IA.

import { aTraduire } from './langue';

export interface Modele {
  id: string;
  /** Nom affiché (à passer à `t` là où il est montré). */
  nom: string;
  /** USD par million de jetons d'entrée et de sortie (prompt ≤ 100 000 jetons pour Haiku 5.5). */
  entree: number;
  sortie: number;
  /** Côté long maximal des images avant réduction par l'API. */
  coteImageMax: number;
  /** Accepte `output_config.effort`. */
  effort: boolean;
}

export const MODELES: Modele[] = [
  { id: 'claude-haiku-5-5', nom: aTraduire('Claude Haiku 5.5 (rapide)'), entree: 0.1, sortie: 0.5, coteImageMax: 2576, effort: true },
  { id: 'claude-sonnet-5-5', nom: aTraduire('Claude Sonnet 5.5 (standard)'), entree: 2, sortie: 10, coteImageMax: 2576, effort: true },
  { id: 'claude-opus-5-5', nom: aTraduire('Claude Opus 5.5 (avancé)'), entree: 4, sortie: 20, coteImageMax: 2576, effort: true },
  { id: 'claude-haiku-4-5', nom: aTraduire('Claude Haiku 4.5 (ancien, scripts)'), entree: 1, sortie: 5, coteImageMax: 1568, effort: false },
  { id: 'claude-sonnet-4-6', nom: aTraduire('Claude Sonnet 4.6 (ancien, scripts)'), entree: 3, sortie: 15, coteImageMax: 1568, effort: true },
];

/** USD par recherche web (10 USD les 1000). */
export const PRIX_RECHERCHE_WEB = 0.01;
/** Réduction de l'API de traitement par lots. */
export const FACTEUR_LOTS = 0.5;

export interface Consommation {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function modele(id: string): Modele | undefined {
  return MODELES.find((m) => m.id === id);
}

/** Coût en USD d'une réponse, d'après son champ `usage`. Écritures et lectures de cache comptées au tarif d'entrée (majorant). */
export function coutUSD(idModele: string, usage: Consommation, enLot = false): number | null {
  const m = modele(idModele);
  if (!m) return null;
  const entree = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const jetons = (entree * m.entree + usage.output_tokens * m.sortie) / 1e6;
  const recherches = (usage.server_tool_use?.web_search_requests ?? 0) * PRIX_RECHERCHE_WEB;
  return jetons * (enLot ? FACTEUR_LOTS : 1) + recherches;
}

/** Jetons d'une image envoyée à l'API : ⌈largeur/28⌉ × ⌈hauteur/28⌉ (après réduction au côté maximal). */
export function jetonsImage(largeur: number, hauteur: number, coteMax: number): number {
  const e = Math.min(1, coteMax / Math.max(largeur, hauteur));
  return Math.ceil((largeur * e) / 28) * Math.ceil((hauteur * e) / 28);
}
