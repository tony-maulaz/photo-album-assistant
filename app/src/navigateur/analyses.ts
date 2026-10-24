// Analyse des photos du projet (netteté, ressemblance, exposition), calculée
// une fois dans les workers et gardée dans `.album/analyse.json`.

import type { Indicateurs } from '../lib/indicateurs';
import type { FichierPlan } from '../lib/plan';
import { cleMiniature } from './miniatures';
import type { EtatProjet } from './projet';
import { enParallele, type GroupeWorkers } from './workers';

const FICHIER = 'analyse.json';

/** Clé d'analyse : identité du fichier (chemin, taille, date), comme le cache des miniatures. */
export function cleAnalyse(f: FichierPlan): string {
  return cleMiniature(f.id, f.taille, f.modifie);
}

export class Analyses {
  private donnees = new Map<string, Indicateurs>();
  constructor(private etat: EtatProjet) {}

  async charger(): Promise<void> {
    const lu = await this.etat.lire<Record<string, Indicateurs>>(FICHIER).catch(() => undefined);
    this.donnees = new Map(Object.entries(lu ?? {}));
  }

  get(f: FichierPlan): Indicateurs | undefined {
    return this.donnees.get(cleAnalyse(f));
  }

  manquantes(fichiers: FichierPlan[]): FichierPlan[] {
    return fichiers.filter((f) => f.categorie === 'photo' && !this.donnees.has(cleAnalyse(f)));
  }

  private async enregistrer() {
    await this.etat.ecrire(FICHIER, Object.fromEntries(this.donnees));
  }

  /** Analyse les photos qui ne le sont pas encore ; enregistre au fil de l'eau (règle d'or 7). */
  async analyser(
    fichiers: FichierPlan[],
    groupe: GroupeWorkers,
    obtenir: (f: FichierPlan) => Promise<File>,
    progres: (faits: number, total: number) => void,
    arreter: () => boolean,
  ): Promise<{ analysees: number; erreurs: number }> {
    const aFaire = this.manquantes(fichiers);
    let faits = 0;
    let erreurs = 0;
    let derniere = performance.now();
    progres(0, aFaire.length);
    await enParallele(aFaire, groupe.taille * 2, async (f) => {
      if (arreter()) return;
      try {
        const r = await groupe.indicateurs(await obtenir(f));
        this.donnees.set(cleAnalyse(f), r);
      } catch {
        erreurs++;
      }
      progres(++faits, aFaire.length);
      if (performance.now() - derniere > 5000) {
        derniere = performance.now();
        await this.enregistrer();
      }
    });
    await this.enregistrer();
    return { analysees: faits - erreurs, erreurs };
  }
}
