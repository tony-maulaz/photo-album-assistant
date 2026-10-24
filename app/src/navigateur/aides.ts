// Résultats des aides IA (`.album/aides.json`) : propositions et remarques
// gardées entre deux sessions ; les décisions, elles, vont dans le plan.

import type { EtatProjet } from './projet';

const FICHIER = 'aides.json';

export class ResultatsAides {
  private donnees: Record<string, unknown> = {};
  private ecriture: Promise<void> = Promise.resolve();
  constructor(private etat: EtatProjet) {}

  async charger(): Promise<void> {
    const lu = await this.etat.lire<Record<string, unknown>>(FICHIER).catch(() => undefined);
    this.donnees = lu && typeof lu === 'object' ? lu : {};
  }

  get<T>(cle: string): T | undefined {
    return this.donnees[cle] as T | undefined;
  }

  /** Remplace une entrée et l'enregistre (au fil de l'eau, règle d'or 7). */
  set(cle: string, valeur: unknown): Promise<void> {
    this.donnees[cle] = valeur;
    this.ecriture = this.ecriture.then(() => this.etat.ecrire(FICHIER, this.donnees)).catch(() => undefined);
    return this.ecriture;
  }

  /** Modifie une table (objet indexé) entrée par entrée. */
  async fusionner<T>(cle: string, ajouts: Record<string, T>): Promise<void> {
    await this.set(cle, { ...(this.get<Record<string, T>>(cle) ?? {}), ...ajouts });
  }
}
