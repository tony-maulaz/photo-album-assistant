// Étape 3 — Photos floues (SPEC § 6.3, script 01 `--seuil-flou`) : une photo
// est écartée si sa netteté (variance du Laplacien à 1024 px, D29) est sous le
// seuil, sauf si l'utilisateur l'a sauvée ; il peut aussi en écarter une nette
// mais ratée. Les décisions s'appliquent au plan en une opération annulable.

import { pluriel } from '../ui/format';
import { t } from './langue';
import { combiner, mettreDeCote, remettre, traitementDe, Transaction, type FichierPlan, type Modification, type Plan } from './plan';

/** Seuil calibré du script 01 (variance du Laplacien à 1024 px). */
export const SEUIL_FLOU = 60;

/** Le dossier (ou un parent) est-il gardé tel quel (étape 2) ? Son contenu n'est alors ni trié ni écarté. */
export function dansDossierGarde(plan: Plan, dossier: string): boolean {
  const t = traitementDe(plan, dossier);
  return t === 'garder' || t === 'ignorer';
}

/** Photos concernées par l'étape : dans l'archive ou déjà écartées pour flou, hors captures d'écran et dossiers gardés tels quels. */
export function photosConcernees(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter(
    (f) => f.categorie === 'photo' && !f.capture && (f.statut === 'archive' || f.raison === 'floues') && !dansDossierGarde(plan, f.dossier),
  );
}

/** Doit-elle être écartée, au seuil donné ? (`undefined` : netteté inconnue, on ne décide pas.) */
export function estFloue(f: FichierPlan, nettete: number | undefined, seuil: number): boolean {
  if (f.flou === 'sauvee') return false;
  if (f.flou === 'ecartee') return true;
  return nettete !== undefined && nettete < seuil;
}

/**
 * Applique le seuil : les photos floues vont dans `_mis_de_cote/floues/`, celles
 * qu'un seuil précédent avait écartées et qui ne le sont plus reviennent. Les
 * photos écartées par un ancien script (`_a_supprimer`) ne reviennent que si
 * l'utilisateur les sauve.
 */
export function appliquerFloues(plan: Plan, nettete: (f: FichierPlan) => number | undefined, seuil: number): Modification | null {
  const aEcarter: string[] = [];
  const aRemettre: string[] = [];
  const marques = new Transaction(plan);
  for (const f of photosConcernees(plan)) {
    const floue = estFloue(f, nettete(f), seuil);
    if (floue && f.statut === 'archive') {
      aEcarter.push(f.id);
      if (!f.flou) marques.fichier({ ...f, flou: 'auto' });
    } else if (!floue && f.statut === 'mis_de_cote' && (f.flou === 'auto' || f.flou === 'sauvee')) {
      aRemettre.push(f.id);
      if (f.flou === 'auto') {
        const { flou: _f, ...reste } = f;
        marques.fichier(reste);
      }
    }
  }
  return combiner(
    t`Photos floues : ${pluriel(aEcarter.length, 'écartée')}, ${pluriel(aRemettre.length, 'remise')}`,
    marques.terminer(''),
    aEcarter.length ? mettreDeCote(plan, aEcarter, 'floues') : null,
    aRemettre.length ? remettre(plan, aRemettre) : null,
  );
}

/**
 * « Sauver » (reste dans le tri), « Écarter » (nette mais ratée) ou revenir au
 * seuil (`undefined`). Revenir au seuil une photo déjà écartée pour flou la
 * marque « auto » : le seuil pourra la remettre (sinon elle ressemblerait à une
 * photo écartée par un ancien script, qui ne revient que si on la sauve).
 */
export function deciderFlou(plan: Plan, ids: string[], decision: 'sauvee' | 'ecartee' | undefined): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.categorie !== 'photo') continue;
    const voulu = decision ?? (f.statut === 'mis_de_cote' && f.raison === 'floues' ? 'auto' : undefined);
    if (f.flou === voulu) continue;
    const { flou: _f, ...reste } = f;
    tx.fichier(voulu ? { ...reste, flou: voulu } : reste);
  }
  return tx.terminer(decision === 'sauvee' ? t`Sauver` : decision === 'ecartee' ? t`Écarter` : t`Revenir au seuil`);
}

/** Nombre de photos écartées au seuil donné (compteur en direct du curseur). */
export function compterFloues(photos: FichierPlan[], nettete: (f: FichierPlan) => number | undefined, seuil: number): number {
  return photos.filter((f) => estFloue(f, nettete(f), seuil)).length;
}

