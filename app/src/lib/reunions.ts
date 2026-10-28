// Réunions de l'étape « Consolidation » (D91) : réunir des dossiers en un
// seul, ou les ranger ensemble dans un dossier de voyage (une étape par
// dossier). Chaque réunion est notée dans `.album/aides.json` pour rester
// affichée avec sa décision et pouvoir être défaite plus tard, même après
// d'autres changements (Ctrl+Z ne remonte que l'historique de la session).

import { principal, type DossierInfo } from './consolidation';
import { noterRattachement, ressortirFragment, type FragmentRattache } from './fragments';
import { t } from './langue';
import { cleNom } from './noms';
import { avecDetail, creerDossier, deplacerDossier, enchainer, enfants, fusionnerDossiers, RACINE, renommerDossier, supprimerDossierVide, Transaction, type Modification, type Plan } from './plan';
import { nomDossierLibre } from './tri';
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
  /** Sous-dossiers vidés dans la cible (« un seul dossier » aplatit tout, D106), de haut en bas, pour les remettre. */
  aplatis?: FragmentRattache[];
  du?: string;
  au?: string;
}

/** Sous-dossiers d'un dossier, à toute profondeur, de haut en bas. */
function descendants(plan: Plan, id: string): string[] {
  return enfants(plan, id).flatMap((e) => [e.id, ...descendants(plan, e.id)]);
}

/**
 * Réunit des dossiers en un seul (une seule opération, Ctrl+Z annule) : le
 * plus grand reçoit les autres, ou `cible` (le dossier de voyage dont ils
 * sont les étapes), puis prend le nom choisi. Un seul dossier, vraiment : les
 * sous-dossiers des dossiers réunis et de la cible y sont vidés (D106), et
 * notés pour être remis à leur place si la réunion est défaite.
 */
export function reunirEnUn(plan: Plan, cle: string, dossiers: DossierInfo[], nom: string, cible = principal(dossiers).id): { modification: Modification | null; reunion: Reunion } {
  const sources = dossiers.filter((d) => d.id !== cible);
  const verses = sources.map((d) => noterRattachement(plan, d, cible, false)).filter((r): r is FragmentRattache => !!r);
  // Les dossiers réunis eux-mêmes (les étapes d'un voyage réuni dans son dossier) sont versés à part.
  const reunis = new Set(sources.map((d) => d.id));
  const sous = [...new Set([...sources.map((d) => d.id), cible].flatMap((id) => descendants(plan, id)))].filter((id) => !reunis.has(id));
  const cibleNom = plan.dossiers.get(cible)?.nom ?? '';
  const aplatis: FragmentRattache[] = sous.map((id) => ({
    dossier: plan.dossiers.get(id)!,
    fichiers: [...plan.fichiers.values()].filter((f) => f.dossier === id).map((f) => ({ id: f.id, nom: f.nom })),
    sousDossiers: [],
    cible,
    cibleNom,
    avecVoisins: false,
  }));
  const nomAvant = plan.dossiers.get(cible)?.nom;
  const modification = avecDetail(enchainer(plan, t`Réunir ${pluriel(dossiers.length, 'dossier')}`, [
    // Les plus profonds d'abord : chacun est vide de sous-dossiers quand il est versé.
    ...[...sous].reverse().map((id) => () => fusionnerDossiers(plan, id, cible)),
    ...sources.map((d) => () => fusionnerDossiers(plan, d.id, cible)),
    () => renommerDossier(plan, cible, nom),
  ]), t`Réunir ${pluriel(dossiers.length, 'dossier')} dans « ${nom} »`);
  const dates = dossiers.flatMap((d) => [d.du, d.au]).filter((x): x is string => !!x).sort();
  return {
    modification,
    reunion: { cle, choix: 'un', cible, nom, ...(nomAvant !== nom ? { nomAvant } : {}), verses, ranges: [], noms: dossiers.map((d) => d.nom), du: dates[0], au: dates.at(-1), ...(aplatis.length ? { aplatis } : {}) },
  };
}

/** Range des dossiers ensemble dans un nouveau dossier de voyage (dans `parent`), chacun y devenant une étape. */
export function rangerEnVoyage(plan: Plan, cle: string, dossiers: DossierInfo[], parent: string, nom: string): { modification: Modification | null; reunion: Reunion } {
  let cree = '';
  const modification = avecDetail(enchainer(plan, t`Ranger ${pluriel(dossiers.length, 'dossier')} en voyage`, [
    () => {
      const r = creerDossier(plan, nom, parent);
      cree = r.id;
      return r.modification;
    },
    ...dossiers.map((d) => () => deplacerDossier(plan, d.id, cree)),
  ]), t`Ranger ${pluriel(dossiers.length, 'dossier')} dans « ${nom} »`);
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
  return avecDetail(enchainer(plan, t`Défaire 1 réunion`, [
    ...r.ranges.filter((x) => plan.dossiers.get(x.id)?.parent === r.cible).map((x) => () => deplacerDossier(plan, x.id, plan.dossiers.has(x.parent) ? x.parent : RACINE)),
    () => {
      if (r.choix !== 'etapes' || !plan.dossiers.has(r.cible) || enfants(plan, r.cible).length || [...plan.fichiers.values()].some((f) => f.dossier === r.cible)) return null;
      return supprimerDossierVide(plan, r.cible);
    },
    () => (r.nomAvant && plan.dossiers.get(r.cible)?.nom === r.nom ? renommerDossier(plan, r.cible, r.nomAvant) : null),
    ...r.verses.map((v) => () => ressortirFragment(plan, v)),
    // Un dossier réuni qui n'avait que des sous-dossiers (aplatis) revient aussi, vide, pour les recevoir.
    ...(r.aplatis?.length ? r.verses.map((v) => () => remettreSousDossier(plan, v)) : []),
    // Puis les sous-dossiers vidés, de haut en bas (leur parent est revenu), même vides.
    ...(r.aplatis ?? []).map((a) => () => remettreSousDossier(plan, a)),
  ]), t`Défaire « ${r.nom} »`);
}

/** Remet un sous-dossier vidé par « un seul dossier » à sa place, avec ses photos encore dans la cible ; `null` s'il est déjà là. */
function remettreSousDossier(plan: Plan, a: FragmentRattache): Modification | null {
  if (plan.dossiers.has(a.dossier.id)) return null;
  const parent = a.dossier.parent !== null && plan.dossiers.has(a.dossier.parent) ? a.dossier.parent : plan.dossiers.has(a.cible) ? a.cible : RACINE;
  const pris = new Set([...plan.dossiers.values()].filter((d) => d.parent === parent).map((d) => cleNom(d.nom)));
  const tx = new Transaction(plan);
  tx.dossier({ ...a.dossier, parent, nom: nomDossierLibre(a.dossier.nom, pris) });
  for (const { id, nom } of a.fichiers) {
    const f = plan.fichiers.get(id);
    if (f?.dossier === a.cible) tx.fichier({ ...f, dossier: a.dossier.id, nom });
  }
  return tx.terminer(t`Ressortir 1 dossier`, t`Remettre « ${a.dossier.nom} »`);
}
