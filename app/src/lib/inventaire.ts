// Propositions de l'inventaire (étape 2, SPEC § 6.2) appliquées au plan :
// captures d'écran rangées à part, doublons exacts mis de côté, décalages
// d'horloge des appareils. Chaque proposition est une opération annulable.

import { pluriel } from '../ui/format';
import { appliquerDecalage, decalageAppareil, minutesDecalage, texteDecalage } from './appareils';
import type { GroupeExact } from './doublonsExacts';
import { t } from './langue';
import { combiner, deplacerFichiers, mettreDeCote, RACINE, Transaction, type Modification, type Plan } from './plan';
import { cleNom } from './noms';

/** Dossier des captures d'écran dans l'archive (§ 12). */
export const DOSSIER_CAPTURES = 'Captures_ecran';

/** Range les captures dans `Photos/Captures_ecran/` (créé au besoin) ; elles sont exclues de l'album. */
export function rangerCaptures(plan: Plan, ids: string[]): Modification | null {
  if (!ids.length) return null;
  const tx = new Transaction(plan);
  let dossier = [...plan.dossiers.values()].find((d) => d.parent === RACINE && cleNom(d.nom) === cleNom(DOSSIER_CAPTURES));
  if (!dossier) {
    dossier = { id: `c${plan.prochainId++}`, nom: DOSSIER_CAPTURES, parent: RACINE, origine: 'cree' };
    tx.dossier(dossier);
  }
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (f && !f.capture) tx.fichier({ ...f, capture: true });
  }
  return combiner(t`Ranger ${pluriel(ids.length, 'capture d’écran', 'captures d’écran')}`, tx.terminer(''), deplacerFichiers(plan, ids, dossier.id));
}

/** Met de côté les copies des groupes de doublons exacts (`_mis_de_cote/doublons_exacts/`). */
export function ecarterDoublonsExacts(plan: Plan, groupes: GroupeExact[]): Modification | null {
  const ids = groupes.flatMap((g) => g.copies.map((c) => c.id)).filter((id) => plan.fichiers.get(id)?.statut === 'archive');
  return ids.length ? mettreDeCote(plan, ids, 'doublons_exacts') : null;
}

/**
 * Corrige l'heure des photos de chaque appareil selon son décalage
 * (config.json, `appareils[].decalage`). Le décalage déjà appliqué est
 * retiré d'abord : changer de valeur ne s'additionne pas.
 */
export function appliquerDecalages(plan: Plan, appareils: { modele: string; decalage: string }[]): Modification | null {
  const tx = new Transaction(plan);
  let n = 0;
  for (const f of plan.fichiers.values()) {
    if (f.categorie !== 'photo' || !f.date || f.date.length < 19 || (f.origineDate !== 'exif' && f.origineDate !== 'nom')) continue;
    const voulu = decalageAppareil(f.appareil, appareils) ?? '+00:00';
    const actuel = f.decalage ?? '+00:00';
    if ((minutesDecalage(voulu) ?? 0) === (minutesDecalage(actuel) ?? 0)) continue;
    const brute = appliquerDecalage(f.date, texteDecalage(-(minutesDecalage(actuel) ?? 0)));
    const { decalage: _d, ...reste } = f;
    const corrige = appliquerDecalage(brute, voulu);
    tx.fichier((minutesDecalage(voulu) ?? 0) === 0 ? { ...reste, date: corrige } : { ...reste, date: corrige, decalage: voulu });
    n++;
  }
  return tx.terminer(t`Corriger l’heure de ${pluriel(n, 'photo')}`);
}
