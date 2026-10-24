// Événements des calendriers actifs de `config/` (SPEC § 8.4), lus une fois
// par session et gardés en mémoire.

import type { Config } from '../lib/config';
import { lireIcs, type EvenementCalendrier } from '../lib/ics';
import type { DossierConfig } from './configuration';

let cache: { cle: string; evenements: EvenementCalendrier[] } | null = null;

/** Tous les événements des calendriers actifs (vide sans configuration). */
export async function evenementsCalendriers(dossier: DossierConfig | undefined, config: Config | null | undefined): Promise<EvenementCalendrier[]> {
  if (!dossier || !config) return [];
  const actifs = config.calendriers.filter((k) => k.actif);
  const cle = JSON.stringify(actifs);
  if (cache?.cle === cle) return cache.evenements;
  const evenements: EvenementCalendrier[] = [];
  for (const k of actifs) {
    try {
      const parties = k.fichier.split('/');
      let d = dossier.dossier;
      for (const p of parties.slice(0, -1)) d = await d.getDirectoryHandle(p);
      const texte = await (await (await d.getFileHandle(parties.at(-1)!)).getFile()).text();
      evenements.push(...lireIcs(texte, { inclureRecurrents: k.inclure_recurrents }));
    } catch {
      // Calendrier introuvable : signalé dans la page Configuration.
    }
  }
  evenements.sort((a, b) => a.debut.localeCompare(b.debut));
  cache = { cle, evenements };
  return evenements;
}
