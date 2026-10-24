// Propositions de l'inventaire (étape 2, SPEC § 6.2) appliquées au plan :
// captures d'écran rangées à part, doublons exacts mis de côté, décalages
// d'horloge des appareils. Chaque proposition est une opération annulable.

import { pluriel } from '../ui/format';
import { appliquerDecalage, decalageAppareil, minutesDecalage, texteDecalage } from './appareils';
import type { GroupeExact } from './doublonsExacts';
import { t } from './langue';
import { estCapture, extension } from './fichiers';
import { combiner, deplacerFichiers, mettreDeCote, RACINE, Transaction, type FichierPlan, type Modification, type Plan } from './plan';
import { cleNom } from './noms';
import { nomsSortie } from './sortie';


/** La photo ressemble-t-elle à une capture d'écran (nom, dimensions d'écran, pas de marque d'appareil) ? */
export function ressembleACapture(f: FichierPlan): boolean {
  return f.categorie === 'photo' && estCapture({ nom: f.nom, marque: f.marque, appareil: f.appareil, dims: f.dims, extension: extension(f.nom) });
}

/** Range les captures dans `Photos/Captures_ecran/` (créé au besoin) ; elles sont exclues de l'album. */
export function rangerCaptures(plan: Plan, ids: string[]): Modification | null {
  if (!ids.length) return null;
  const tx = new Transaction(plan);
  // Dossier des captures d'écran dans l'archive (§ 12), au nom de la langue du projet.
  const nom = nomsSortie().captures;
  let dossier = [...plan.dossiers.values()].find((d) => d.parent === RACINE && cleNom(d.nom) === cleNom(nom));
  if (!dossier) {
    dossier = { id: `c${plan.prochainId++}`, nom, parent: RACINE, origine: 'cree' };
    tx.dossier(dossier);
  }
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (f && !f.capture) tx.fichier({ ...f, capture: true });
  }
  return combiner(t`Ranger ${pluriel(ids.length, 'capture d’écran', 'captures d’écran')}`, tx.terminer(''), deplacerFichiers(plan, ids, dossier.id));
}

/**
 * Met de côté les exemplaires des groupes de doublons exacts qui ne sont pas dans
 * `aGarder` (`_mis_de_cote/doublons_exacts/`) ; un groupe garde toujours au moins
 * un exemplaire (son meilleur, si on n'en a gardé aucun).
 */
export function ecarterDoublonsExacts(plan: Plan, groupes: GroupeExact[], aGarder: ReadonlySet<string>): Modification | null {
  const ids = groupes.flatMap((g) => {
    const membres = [g.garde, ...g.copies.map((c) => c.id)];
    const gardes = membres.some((id) => aGarder.has(id)) ? aGarder : new Set([g.garde]);
    return membres.filter((id) => !gardes.has(id));
  });
  const aEcarter = ids.filter((id) => plan.fichiers.get(id)?.statut === 'archive');
  return aEcarter.length ? mettreDeCote(plan, aEcarter, 'doublons_exacts') : null;
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
