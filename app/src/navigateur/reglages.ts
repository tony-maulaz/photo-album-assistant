// Réglages propres à cet ordinateur (SPEC § 9), gardés dans le navigateur.

import { cranTaille, PAS_TAILLE } from '../lib/grille';
import type { Langue } from '../lib/langue';
import { ecrireLocal, lireLocal } from './stockage';

export interface Reglages {
  modeles: { rapide: string; standard: string; avance: string };
  tauxUsdChf: number;
  seuilConfirmationChf: number;
  budgetDefautChf: number;
  emailNominatim: string;
  tailleMiniatures: number;
  theme: 'auto' | 'clair' | 'sombre';
  /** Langue de l'interface ; « auto » : celle du navigateur. */
  langue: 'auto' | Langue;
  /** Largeur du panneau des dossiers (px), réglée en tirant son bord droit. */
  largeurPanneau: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  modeles: { rapide: 'claude-haiku-5-5', standard: 'claude-sonnet-5-5', avance: 'claude-opus-5-5' },
  tauxUsdChf: 0.8,
  seuilConfirmationChf: 2,
  budgetDefautChf: 50,
  emailNominatim: '',
  tailleMiniatures: 160,
  theme: 'auto',
  langue: 'auto',
  largeurPanneau: 340,
};

const CLE = 'album:reglages';

export function lireReglages(): Reglages {
  try {
    const lus = JSON.parse(lireLocal(CLE) ?? '{}') as Partial<Reglages>;
    const r = { ...REGLAGES_DEFAUT, ...lus, modeles: { ...REGLAGES_DEFAUT.modeles, ...lus.modeles } };
    // Une taille de l'ancien curseur (de 20 en 20 : 220, 260…) est ramenée au cran le plus proche : la grille
    // montre alors ce que le curseur et le lecteur d'écran annoncent (retours du 29.10, question 11).
    const t = r.tailleMiniatures;
    return { ...r, tailleMiniatures: typeof t === 'number' && Number.isFinite(t) ? PAS_TAILLE[cranTaille(t)] : REGLAGES_DEFAUT.tailleMiniatures };
  } catch {
    return REGLAGES_DEFAUT;
  }
}

export function enregistrerReglages(r: Reglages) {
  ecrireLocal(CLE, JSON.stringify(r));
}
