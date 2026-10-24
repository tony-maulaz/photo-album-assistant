// Dossier de sortie : chemin de chaque fichier, synchronisation relançable
// avec le plan (SPEC § 4.2, § 12) et bilan fichier par fichier (§ 6.11).

import type { EtatAlbum } from './album';
import { cleNom } from './noms';
import { cheminDossier, type FichierPlan, type Plan } from './plan';

export const DOSSIER_PHOTOS = 'Photos';
export const DOSSIER_MIS_DE_COTE = '_mis_de_cote';
export const DOSSIER_AUTRES = '_autres_fichiers';
export const DOSSIER_ETAT = '.album';
/** La sélection prête pour ifolor : copies dérivées, entièrement gérées par l'application. */
export const DOSSIER_ALBUM = 'Album';

/** Chemin du fichier dans la sortie, relatif à sa racine. */
export function cheminSortie(plan: Plan, f: FichierPlan): string {
  if (f.categorie === 'autre') return `${DOSSIER_AUTRES}/${f.id}`;
  // Chemin d'origine conservé (unique, et facile à remettre à la main).
  if (f.statut === 'mis_de_cote') return `${DOSSIER_MIS_DE_COTE}/${f.raison ?? 'autres'}/${f.id}`;
  const dossier = cheminDossier(plan, f.dossier);
  return `${DOSSIER_PHOTOS}/${dossier ? `${dossier}/` : ''}${f.nom}`;
}

/** Ce que la synchronisation a écrit, pour retrouver un fichier qui a changé de dossier (`.album/etat_sortie.json`). */
export interface EtatSortie {
  version: 1;
  fichiers: Record<string, { chemin: string; taille: number }>;
  /** Copies écrites dans `Album/` (chemin relatif à `Album/`). */
  album?: EtatAlbum;
}

export function etatVide(): EtatSortie {
  return { version: 1, fichiers: {} };
}

/** Fichiers présents dans la sortie (hors `.album/` et `Rapport.html`), par clé de chemin (voir `cleChemin`). */
export type ListingSortie = Map<string, { chemin: string; taille: number }>;

/** Clé de comparaison d'un chemin : insensible à la casse et aux formes d'accents. */
export function cleChemin(chemin: string): string {
  return cleNom(chemin);
}

export type ActionSynchro =
  | { type: 'garder'; id: string; cible: string }
  | { type: 'copier'; id: string; cible: string }
  | { type: 'deplacer'; id: string; cible: string; depuis: string }
  /** La place est prise par un autre fichier, que l'on ne touche pas. */
  | { type: 'conflit'; id: string; cible: string };

/**
 * Actions qui amènent la sortie à l'état du plan : un fichier identique (même
 * taille) n'est jamais recopié (A13) ; un fichier déjà écrit ailleurs est
 * déplacé ; rien n'est jamais écrasé ni supprimé.
 */
export function planifierSynchro(plan: Plan, listing: ListingSortie, etat: EtatSortie): ActionSynchro[] {
  const actions: ActionSynchro[] = [];
  const cibles = new Set<string>();
  for (const f of plan.fichiers.values()) {
    const cible = cheminSortie(plan, f);
    const cle = cleChemin(cible);
    cibles.add(cle);
    const present = listing.get(cle)?.taille;
    if (present === f.taille) {
      actions.push({ type: 'garder', id: f.id, cible });
      continue;
    }
    const avant = etat.fichiers[f.id];
    if (present === undefined && avant && cleChemin(avant.chemin) !== cle && listing.get(cleChemin(avant.chemin))?.taille === f.taille) {
      actions.push({ type: 'deplacer', id: f.id, cible, depuis: avant.chemin });
      continue;
    }
    actions.push({ type: present === undefined ? 'copier' : 'conflit', id: f.id, cible });
  }
  // Un fichier déplacé ne doit pas l'être vers une place qu'un autre fichier du plan occupe encore.
  return actions.map((a) =>
    a.type === 'deplacer' && cibles.has(cleChemin(a.depuis)) ? { type: 'copier', id: a.id, cible: a.cible } : a,
  );
}

export interface Bilan {
  total: number;
  presents: number;
  manquants: { id: string; cible: string }[];
  categories: { photos: number; videos: number; autres: number; misDeCote: Record<string, number> };
  octets: number;
  /** Fichiers dont la seule date est celle du fichier, perdue à la copie (D30). */
  datesFichierSeulement: FichierPlan[];
  /** Fichiers de la sortie qui ne correspondent à aucun fichier du plan (jamais supprimés). */
  enTrop: string[];
}

/** Chaque fichier de la source se retrouve-t-il dans la sortie, avec la même taille ? (A2) */
export function bilan(plan: Plan, listing: ListingSortie): Bilan {
  const b: Bilan = {
    total: 0,
    presents: 0,
    manquants: [],
    categories: { photos: 0, videos: 0, autres: 0, misDeCote: {} },
    octets: 0,
    datesFichierSeulement: [],
    enTrop: [],
  };
  const attendus = new Set<string>();
  for (const f of plan.fichiers.values()) {
    b.total++;
    b.octets += f.taille;
    const cible = cheminSortie(plan, f);
    attendus.add(cleChemin(cible));
    if (listing.get(cleChemin(cible))?.taille === f.taille) b.presents++;
    else b.manquants.push({ id: f.id, cible });
    if (f.categorie === 'autre') b.categories.autres++;
    else if (f.statut === 'mis_de_cote') b.categories.misDeCote[f.raison ?? 'autres'] = (b.categories.misDeCote[f.raison ?? 'autres'] ?? 0) + 1;
    else if (f.categorie === 'photo') b.categories.photos++;
    else b.categories.videos++;
    if (f.origineDate === 'fichier' && f.categorie !== 'autre') b.datesFichierSeulement.push(f);
  }
  // `Album/` contient des copies : il n'entre pas dans le bilan de la source.
  const album = cleChemin(`${DOSSIER_ALBUM}/`);
  for (const [cle, e] of listing) if (!attendus.has(cle) && !cle.startsWith(album)) b.enTrop.push(e.chemin);
  b.enTrop.sort();
  return b;
}

/** Espace nécessaire pour ce qui reste à copier. */
export function octetsACopier(plan: Plan, actions: ActionSynchro[]): number {
  let total = 0;
  for (const a of actions) if (a.type === 'copier') total += plan.fichiers.get(a.id)?.taille ?? 0;
  return total;
}
