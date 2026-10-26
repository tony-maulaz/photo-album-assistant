// Copies exactes (étape « Doublons », D61) : la même photo en plusieurs
// exemplaires (même contenu, ou copie réduite envoyée par WhatsApp), quel que
// soit le dossier. La proposition garde le meilleur de chaque emplacement (un
// dossier qui garde sa place, ou les photos à trier, sauf si la photo est déjà
// dans un dossier « Garder, nettoyer ») et met de côté les autres ; la page
// « Doublons » les présente comme les autres groupes (D71). Un dossier « Ne pas
// toucher » n'est pas examiné : ses copies sont voulues (un « Best of », D85).

import { useMemo } from 'preact/hooks';
import { groupesDoublonsExacts, type GenreEmplacement, type GroupeExact } from '../lib/doublonsExacts';
import { aEcarter, groupesCopies } from '../lib/groupesDoublons';
import { nePasToucher, traitementDe, type FichierPlan, type Plan } from '../lib/plan';
import { analyseAFaire, analyseEnCours } from './analyseDossier';
import { session, versionIA, versionPlan } from './etat';

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
 * Groupes de copies exactes, ou `null` tant que l'analyse du dossier n'est pas
 * finie (empreintes et ressemblance en viennent, D56). Les exemplaires déjà
 * écartés comme copies en font partie : un groupe ne change pas quand on décide.
 */
export function useCopiesExactes(): GroupeExact[] | null {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const pret = !analyseEnCours.value && !analyseAFaire(s);
  return useMemo<GroupeExact[] | null>(() => {
    if (!pret) return null;
    const photos = [...s.plan.fichiers.values()].filter(
      (f) => f.categorie === 'photo' && (f.statut === 'archive' || f.raison === 'doublons_exacts') && !nePasToucher(s.plan, f.dossier),
    );
    return groupesDoublonsExacts(
      photos.map((f) => ({
        id: f.id,
        nom: f.nom,
        dossier: f.dossier,
        taille: f.taille,
        empreinte: f.empreinte,
        phash: s.analyses.get(f)?.phash,
        dims: f.dims,
        exif: f.origineDate === 'exif',
        ...lieu(s.plan, s.projet.mode === 'deja_trie', f),
      })),
    );
  }, [pret, versionPlan.value, versionIA.value]);
}

/** Nombre d'exemplaires que la proposition écarterait encore (pas encore acceptée). */
export function copiesProposees(groupes: GroupeExact[], plan: Plan): number {
  const fichier = (id: string) => plan.fichiers.get(id);
  return groupesCopies(groupes, fichier).reduce((n, g) => n + aEcarter(g, fichier).length, 0);
}
