// Réunions de l'étape « Consolidation » (D91) : réunir des dossiers en un
// seul, ou les ranger ensemble dans un dossier de voyage (une étape par
// dossier). Chaque réunion est notée dans `.album/aides.json` pour rester
// affichée avec sa décision et pouvoir être défaite plus tard, même après
// d'autres changements (Ctrl+Z ne remonte que l'historique de la session).

import { principal, type DossierInfo } from './consolidation';
import { noterRattachement, ressortirFragment, type FragmentRattache } from './fragments';
import { t } from './langue';
import { creerDossier, deplacerDossier, enchainer, enfants, fusionnerDossiers, RACINE, renommerDossier, supprimerDossierVide, type Modification, type Plan } from './plan';
import { pluriel } from '../ui/format';

export interface Reunion {
  /** Clé de la proposition réunie. */
  cle: string;
  /** Réunis en un seul dossier, ou rangés ensemble dans un dossier de voyage. */
  choix: 'un' | 'etapes';
  /** Le dossier réuni, ou le dossier de voyage créé. */
  cible: string;
  /** Son nom après la réunion. */
  nom: string;
  /** Son nom d'avant, quand il a été renommé (réunion en un dossier). */
  nomAvant?: string;
  /** Dossiers versés dans la cible, pour les ressortir. */
  verses: FragmentRattache[];
  /** Dossiers rangés dans le dossier de voyage, avec leur parent d'avant. */
  ranges: { id: string; parent: string }[];
  /** Noms des dossiers réunis, pour l'affichage. */
  noms: string[];
  /** Paires refusées en même temps (dossiers décochés laissés à part), rendues si la réunion est défaite. */
  separes?: string[];
  du?: string;
  au?: string;
}

/**
 * Réunit des dossiers en un seul (une seule opération, Ctrl+Z annule) : le
 * plus grand reçoit les autres, ou `cible` (le dossier de voyage dont ils
 * sont les étapes), puis prend le nom choisi.
 */
export function reunirEnUn(plan: Plan, cle: string, dossiers: DossierInfo[], nom: string, cible = principal(dossiers).id): { modification: Modification | null; reunion: Reunion } {
  const sources = dossiers.filter((d) => d.id !== cible);
  const verses = sources.map((d) => noterRattachement(plan, d, cible, false)).filter((r): r is FragmentRattache => !!r);
  const nomAvant = plan.dossiers.get(cible)?.nom;
  const modification = enchainer(plan, t`Réunir ${pluriel(dossiers.length, 'dossier')} dans « ${nom} »`, [
    ...sources.map((d) => () => fusionnerDossiers(plan, d.id, cible)),
    () => renommerDossier(plan, cible, nom),
  ]);
  const dates = dossiers.flatMap((d) => [d.du, d.au]).filter((x): x is string => !!x).sort();
  return {
    modification,
    reunion: { cle, choix: 'un', cible, nom, ...(nomAvant !== nom ? { nomAvant } : {}), verses, ranges: [], noms: dossiers.map((d) => d.nom), du: dates[0], au: dates.at(-1) },
  };
}

/** Range des dossiers ensemble dans un nouveau dossier de voyage (dans `parent`), chacun y devenant une étape. */
export function rangerEnVoyage(plan: Plan, cle: string, dossiers: DossierInfo[], parent: string, nom: string): { modification: Modification | null; reunion: Reunion } {
  let cree = '';
  const modification = enchainer(plan, t`Ranger ${pluriel(dossiers.length, 'dossier')} dans « ${nom} »`, [
    () => {
      const r = creerDossier(plan, nom, parent);
      cree = r.id;
      return r.modification;
    },
    ...dossiers.map((d) => () => deplacerDossier(plan, d.id, cree)),
  ]);
  const dates = dossiers.flatMap((d) => [d.du, d.au]).filter((x): x is string => !!x).sort();
  return {
    modification,
    reunion: { cle, choix: 'etapes', cible: cree, nom, verses: [], ranges: dossiers.map((d) => ({ id: d.id, parent })), noms: dossiers.map((d) => d.nom), du: dates[0], au: dates.at(-1) },
  };
}

/** La réunion est-elle toujours en place (sinon elle a été annulée, ou défaite autrement) ? */
export function reunionEnPlace(plan: Plan, r: Reunion): boolean {
  if (!plan.dossiers.has(r.cible)) return false;
  if (r.choix === 'etapes') return r.ranges.some((x) => plan.dossiers.get(x.id)?.parent === r.cible);
  return r.verses.some((v) => !plan.dossiers.has(v.dossier.id) && v.fichiers.some((x) => plan.fichiers.get(x.id)?.dossier === r.cible));
}

/**
 * Défait une réunion, même après d'autres changements : la cible reprend son
 * nom, les dossiers versés ressortent avec leurs photos restées dans la
 * cible, les étapes retournent à leur place et le dossier de voyage vide
 * disparaît. `null` s'il n'y a plus rien à défaire.
 */
export function defaireReunion(plan: Plan, r: Reunion): Modification | null {
  return enchainer(plan, t`Défaire « ${r.nom} »`, [
    ...r.ranges.filter((x) => plan.dossiers.get(x.id)?.parent === r.cible).map((x) => () => deplacerDossier(plan, x.id, plan.dossiers.has(x.parent) ? x.parent : RACINE)),
    () => {
      if (r.choix !== 'etapes' || !plan.dossiers.has(r.cible) || enfants(plan, r.cible).length || [...plan.fichiers.values()].some((f) => f.dossier === r.cible)) return null;
      return supprimerDossierVide(plan, r.cible);
    },
    () => (r.nomAvant && plan.dossiers.get(r.cible)?.nom === r.nom ? renommerDossier(plan, r.cible, r.nomAvant) : null),
    ...r.verses.map((v) => () => ressortirFragment(plan, v)),
  ]);
}
