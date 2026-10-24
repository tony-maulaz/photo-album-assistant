// Réglages propres à cet ordinateur (SPEC § 9), gardés dans le navigateur.

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
    return { ...REGLAGES_DEFAUT, ...lus, modeles: { ...REGLAGES_DEFAUT.modeles, ...lus.modeles } };
  } catch {
    return REGLAGES_DEFAUT;
  }
}

export function enregistrerReglages(r: Reglages) {
  ecrireLocal(CLE, JSON.stringify(r));
}
