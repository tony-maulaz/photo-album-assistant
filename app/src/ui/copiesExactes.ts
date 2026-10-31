// Copies exactes (étape « Doublons », D61) : la même photo en plusieurs
// exemplaires (même contenu, ou copie réduite envoyée par WhatsApp), quel que
// soit le dossier. La proposition garde le meilleur de chaque emplacement (un
// dossier qui garde sa place, ou les photos à trier, sauf si la photo est déjà
// dans un dossier « Garder, nettoyer ») et met de côté les autres ; la page
// « Doublons » les présente comme les autres groupes (D71). Un dossier « Ne pas
// toucher » n'est pas examiné : ses copies sont voulues (un « Best of », D85).

import { groupesDoublonsExacts, type GenreEmplacement, type GroupeExact } from '../lib/doublonsExacts';
import { acceptablesSansVider, aEcarter, groupesCopies, type GroupeDoublons } from '../lib/groupesDoublons';
import { nePasToucher, traitementDe, type FichierPlan, type Plan } from '../lib/plan';
import { analyseAFaire, analyseEnCours } from './analyseDossier';
import { session, versionIA, versionPlan, type Session } from './etat';

/** Emplacement des photos à trier (racine, dossiers « Trier ») : un seul, le tri les répartira. */
const A_TRIER = '§a_trier';

/**
 * Où est une photo, pour la proposition. Dossier déjà trié : chaque dossier est
 * un emplacement, laissé tel quel. En vrac : les dossiers « Garder, nettoyer »
 * gardent leur place ; toutes les autres photos sont à trier.
 */
function lieu(plan: Plan, dejaTrie: boolean, f: FichierPlan): { emplacement: string; genre: GenreEmplacement } {
  if (dejaTrie) return { emplacement: f.dossier, genre: 'tel_quel' };
  if (traitementDe(plan, f.dossier) === 'nettoyer') return { emplacement: f.dossier, genre: 'nettoyer' };
  return { emplacement: A_TRIER, genre: 'a_trier' };
}

/**
 * Le dernier calcul, partagé par les pages et la frise. `signature` : ce dont dépendent les groupes (les photos
 * examinées, leur emplacement, leur ressemblance) ; un changement du plan qui n'y touche pas (★ de la Sélection,
 * légende, rotation…) ne relance pas la recherche, qui compare chaque photo sans EXIF à toutes les autres.
 */
let dernier: { plan: Plan; versionPlan: number; versionIA: number; signature: string; groupes: GroupeExact[] } | null = null;

/**
 * Groupes de copies exactes, ou `null` tant que l'analyse du dossier n'est pas finie (empreintes et ressemblance
 * en viennent, D56). Les exemplaires déjà écartés comme copies en font partie : un groupe ne change pas quand on
 * décide. Un seul calcul par version du plan, quel que soit le nombre de lecteurs (page, frise), et seulement si
 * ses données ont changé.
 */
export function copiesExactesDuProjet(s: Session): GroupeExact[] | null {
  if (analyseEnCours.value) return null;
  const vp = versionPlan.value;
  const vi = versionIA.value;
  if (dernier && dernier.plan === s.plan && dernier.versionPlan === vp && dernier.versionIA === vi) return dernier.groupes;
  const dejaTrie = s.projet.mode === 'deja_trie';
  const photos = [...s.plan.fichiers.values()]
    .filter((f) => f.categorie === 'photo' && (f.statut === 'archive' || f.raison === 'doublons_exacts') && !nePasToucher(s.plan, f.dossier))
    .map((f) => ({
      id: f.id,
      nom: f.nom,
      dossier: f.dossier,
      taille: f.taille,
      empreinte: f.empreinte,
      phash: s.analyses.get(f)?.phash,
      dims: f.dims,
      exif: f.origineDate === 'exif',
      ...lieu(s.plan, dejaTrie, f),
    }));
  const signature = photos.map((p) => `${p.id}\u0001${p.dossier}\u0001${p.emplacement}\u0001${p.genre}\u0001${p.empreinte ?? ''}\u0001${p.phash ?? ''}`).join('\u0002');
  // Mêmes données qu'au dernier calcul : l'analyse était finie pour ces photos, les groupes sont les mêmes.
  if (dernier && dernier.plan === s.plan && dernier.signature === signature) {
    dernier = { ...dernier, versionPlan: vp, versionIA: vi };
    return dernier.groupes;
  }
  if (analyseAFaire(s)) return null;
  const groupes = groupesDoublonsExacts(photos);
  dernier = { plan: s.plan, versionPlan: vp, versionIA: vi, signature, groupes };
  return groupes;
}

/** Les copies exactes du projet, pour une page (relues à chaque changement du plan). */
export function useCopiesExactes(): GroupeExact[] | null {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  analyseEnCours.value;
  return copiesExactesDuProjet(s);
}

/**
 * Les copies exactes encore à accepter (D112) : les groupes où un exemplaire est encore « à écarter » faute
 * d'« Accepter », et leur nombre d'exemplaires. Un seul compte pour la frise, la barre de Doublons et le bandeau du
 * Tri. `acceptables` : ceux qu'un « Accepter » groupé peut valider (un exemplaire au moins reste gardé) ; un groupe
 * où vous les avez tous écartés reste à voir à Doublons (D101), mais il compte dans `n`.
 */
export interface CopiesAAccepter {
  groupes: GroupeDoublons[];
  n: number;
  acceptables: GroupeDoublons[];
  nAcceptables: number;
}

type Fichiers = (id: string) => FichierPlan | undefined;

export function copiesAAccepter(groupes: GroupeDoublons[], fichier: Fichiers): CopiesAAccepter {
  const enAttente = groupes.filter((g) => aEcarter(g, fichier).length > 0);
  const acceptables = acceptablesSansVider(enAttente, fichier);
  const somme = (l: GroupeDoublons[]) => l.reduce((n, g) => n + aEcarter(g, fichier).length, 0);
  return { groupes: enAttente, n: somme(enAttente), acceptables, nAcceptables: somme(acceptables) };
}

/**
 * Exemplaires de copies exactes que la proposition écarterait encore, faute d'« Accepter » (D112) : sans eux, le
 * tri rangerait une seconde fois une photo déjà gardée. `null` tant que les copies ne sont pas cherchées.
 */
export function copiesRestantes(s: Session): number | null {
  const groupes = copiesExactesDuProjet(s);
  return groupes ? copiesProposees(groupes, s.plan) : null;
}

/** Nombre d'exemplaires que la proposition écarterait encore (pas encore acceptée). */
export function copiesProposees(groupes: GroupeExact[], plan: Plan): number {
  const fichier = (id: string) => plan.fichiers.get(id);
  return copiesAAccepter(groupesCopies(groupes, fichier), fichier).n;
}
