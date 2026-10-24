// Choix de la langue de l'interface (page Réglages et page d'accueil).

import { LANGUES, t, type Langue } from '../../lib/langue';
import type { Reglages } from '../../navigateur/reglages';
import { changerReglages, reglages } from '../etat';

export function ChoixLangue({ id = 'langue' }: { id?: string }) {
  const r = reglages.value;
  return (
    <select id={id} value={r.langue} onChange={(e) => changerReglages({ ...r, langue: e.currentTarget.value as Reglages['langue'] })}>
      <option value="auto">{t`Langue du navigateur`}</option>
      {(Object.entries(LANGUES) as [Langue, string][]).map(([code, nom]) => (
        <option key={code} value={code}>
          {nom}
        </option>
      ))}
    </select>
  );
}
