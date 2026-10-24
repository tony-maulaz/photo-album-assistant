// Bandeau « la source a changé » (D63) : des photos ont été ajoutées au
// dossier à trier depuis l'inventaire (on trie en plusieurs fois). Il propose
// la mise à jour, qui garde tout ce qui est déjà décidé.

import { signal } from '@preact/signals';
import { t } from '../../lib/langue';
import { allerEtape, changementsSource, session } from '../etat';
import { pluriel } from '../format';

/** La mise à jour est demandée : la page Inventaire la lance en arrivant. */
export const miseAJourDemandee = signal(false);
/** « Plus tard » : le bandeau ne revient qu'à la prochaine ouverture du projet. */
const masque = signal(false);

export function BandeauSource() {
  const s = session.value;
  const c = changementsSource.value;
  if (!s || !c || masque.value || miseAJourDemandee.value) return null;
  // Un fichier disparu mais déjà copié dans la sortie n'est pas perdu : rien à signaler.
  const perdus = c.disparus.filter((id) => !(id in s.etatSortie.fichiers)).length;
  if (!c.nouveaux.length && !c.modifies.length && !perdus) return null;
  const parties = [
    c.nouveaux.length > 0 && pluriel(c.nouveaux.length, 'nouveau fichier', 'nouveaux fichiers'),
    c.modifies.length > 0 && pluriel(c.modifies.length, 'fichier modifié', 'fichiers modifiés'),
    perdus > 0 && pluriel(perdus, 'fichier disparu', 'fichiers disparus'),
  ].filter(Boolean);
  return (
    <div class="bandeau-source" role="status">
      <span>
        {t`Le dossier à trier a changé depuis l’inventaire : ${parties.join(', ')}.`} <span class="discret">{t`Tout ce qui est déjà décidé sera gardé.`}</span>
      </span>
      <button
        type="button"
        class="principal"
        onClick={() => {
          miseAJourDemandee.value = true;
          allerEtape('inventaire');
        }}
      >
        {t`Mettre à jour l’inventaire`}
      </button>
      <button type="button" class="lien" onClick={() => (masque.value = true)}>
        {t`Plus tard`}
      </button>
    </div>
  );
}
