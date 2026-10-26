// Dossiers d'un même événement du calendrier (D83) : à l'étape « Lieux et
// sorties », quand plusieurs dossiers ont été photographiés pendant un même
// événement (des vacances, un anniversaire en deux endroits), l'application
// propose de les réunir sous son titre, souvent parlant (« 18 ans de Lea »).
// L'utilisateur décide ; Ctrl+Z annule.

import { dureeEvenement, evenementsUtiles, joursEvenement, partPendant, type EvenementCalendrier } from './ics';
import { t } from './langue';
import { IGNORES_NOMMAGE, nomDepuisEvenement, normaliserNom, photosDuDossier } from './nommage';
import { cleNom } from './noms';
import { combiner, dateSure, fusionnerDossiers, gardeSaPlace, RACINE, Transaction, type Modification, type Plan } from './plan';
import { nomsSortie } from './sortie';
import { nomDossierLibre } from './tri';
import { pluriel } from '../ui/format';

/** Part minimale des photos d'un dossier prises pendant l'événement pour qu'il en fasse partie. */
export const PART_MIN_REGROUPEMENT = 0.8;

export interface RegroupementPropose {
  /** Identifiant stable de la proposition (pour l'ignorer). */
  cle: string;
  titre: string;
  /** Dossiers du premier niveau concernés, dans l'ordre du temps. */
  dossiers: string[];
  /** Nom tapé (accents gardés, titre de l'album) ; le dossier s'appelle `normaliserNom(nom)`. */
  nom: string;
  /**
   * Plusieurs jours : les dossiers deviennent ses sous-dossiers (on garde les
   * étapes, comme un voyage du tri) ; un seul jour : ils sont fusionnés.
   */
  sousDossiers: boolean;
}

/**
 * Événements pendant lesquels au moins deux dossiers du premier niveau ont
 * été photographiés (80 % de leurs photos au moins). Les dossiers techniques
 * (captures, sans lieu, sans date) et ceux qui gardent leur place (étape
 * « Dossiers ») ne sont jamais proposés, ni les événements récurrents ou de
 * plus de 21 jours (« Vacances d'été » réunissait onze dossiers, D88). Deux
 * événements qui réuniraient les mêmes dossiers : seul le plus court est
 * proposé, son titre est plus parlant.
 */
export function regroupementsProposes(plan: Plan, evts: EvenementCalendrier[], ignores: ReadonlySet<string> = new Set()): RegroupementPropose[] {
  const techniques = new Set([...IGNORES_NOMMAGE, nomsSortie().captures, nomsSortie().sansDate].map(cleNom));
  const dossiers = [...plan.dossiers.values()]
    .filter((d) => d.parent === RACINE && !techniques.has(cleNom(d.nom)) && !gardeSaPlace(plan, d.id))
    .map((d) => ({
      id: d.id,
      dates: photosDuDossier(plan, d.id)
        .map((f) => dateSure(f))
        .filter((x): x is string => !!x)
        .sort(),
    }))
    .filter((x) => x.dates.length);
  const resultat: RegroupementPropose[] = [];
  const vus = new Set<string>();
  for (const e of evenementsUtiles(evts).sort((a, b) => dureeEvenement(a) - dureeEvenement(b))) {
    const cle = `${e.titre}|${e.debut}|${e.fin}`;
    if (ignores.has(cle)) continue;
    const [d1, d2] = joursEvenement(e);
    const dedans = dossiers
      .filter((x) => x.dates[0].slice(0, 10) <= d2 && x.dates.at(-1)!.slice(0, 10) >= d1 && partPendant(e, x.dates) >= PART_MIN_REGROUPEMENT)
      .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
    if (dedans.length < 2) continue;
    const ensemble = dedans.map((x) => x.id).join('|');
    if (vus.has(ensemble)) continue;
    vus.add(ensemble);
    const du = dedans[0].dates[0];
    const au = dedans.map((x) => x.dates.at(-1)!).sort().at(-1)!;
    resultat.push({ cle, titre: e.titre, dossiers: dedans.map((x) => x.id), nom: nomDepuisEvenement(e.titre, du, au), sousDossiers: du.slice(0, 10) !== au.slice(0, 10) });
  }
  return resultat.sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Réunit les dossiers d'une proposition dans un dossier au nom de l'événement (annulable). */
export function regrouperDossiers(plan: Plan, r: RegroupementPropose): Modification | null {
  const presents = r.dossiers.filter((id) => plan.dossiers.get(id)?.parent === RACINE);
  if (presents.length < 2) return null;
  const pris = new Set([...plan.dossiers.values()].filter((d) => d.parent === RACINE).map((d) => cleNom(d.nom)));
  const nom = nomDossierLibre(normaliserNom(r.nom) || normaliserNom(r.titre) || 'Evenement', pris);
  const tx = new Transaction(plan);
  const id = `n${plan.prochainId++}`;
  tx.dossier({ id, nom, parent: RACINE, origine: 'cree', nomSaisi: r.nom });
  if (r.sousDossiers) for (const d of presents) tx.dossier({ ...plan.dossiers.get(d)!, parent: id });
  const creation = tx.terminer('');
  const fusions = r.sousDossiers ? [] : presents.map((d) => fusionnerDossiers(plan, d, id));
  return combiner(t`Réunir ${pluriel(presents.length, 'dossier')} dans « ${nom} »`, creation, ...fusions);
}
