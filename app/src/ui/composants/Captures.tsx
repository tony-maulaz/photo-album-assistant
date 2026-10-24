// Captures d'écran (étape « Tri automatique », D61) : parmi les photos à trier
// seulement. Une capture rangée dans un dossier qui garde sa place y a été mise
// exprès : c'est une photo comme une autre. Celles qui restent à trier sont
// proposées au rangement dans « Captures_ecran », hors du tri et de l'album.

import { nomsSortie } from '../../lib/sortie';
import { t } from '../../lib/langue';
import { rangerCaptures, ressembleACapture } from '../../lib/inventaire';
import { gardeSaPlace, type FichierPlan } from '../../lib/plan';
import { appliquer, session, versionPlan, type Session } from '../etat';
import { nombre, pluriel } from '../format';
import { Miniature } from './GrillePhotos';

/** Captures d'écran proposées au rangement : pas encore rangées, parmi les photos à trier d'un dossier en vrac. */
export function capturesProposees(s: Session): FichierPlan[] {
  if (s.projet.mode !== 'vrac') return [];
  return [...s.plan.fichiers.values()].filter((f) => f.statut === 'archive' && !f.capture && !gardeSaPlace(s.plan, f.dossier) && ressembleACapture(f));
}

export function Captures() {
  const s = session.value!;
  versionPlan.value;
  const rangees = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && f.capture).length;
  const candidates = capturesProposees(s);
  if (!candidates.length && !rangees) return null;
  return (
    <section id="captures" class="encart">
      <h2>{t`Captures d’écran`}</h2>
      {candidates.length > 0 ? (
        <>
          <p>
            {t`${pluriel(candidates.length, 'capture d’écran trouvée', 'captures d’écran trouvées')} parmi les photos à trier (nom de fichier, dimensions d’écran, pas de marque d’appareil). Proposition : les ranger dans « ${nomsSortie().captures} », hors du tri et de l’album. Celles qui sont dans un dossier gardé restent à leur place.`}
          </p>
          <div class="bande-miniatures">
            {candidates.slice(0, 12).map((f) => (
              <Miniature key={f.id} f={f} taille={90} />
            ))}
          </div>
          <button type="button" onClick={() => appliquer(rangerCaptures(s.plan, candidates.map((f) => f.id)))}>
            {t`Ranger les ${nombre(candidates.length)} captures dans « ${nomsSortie().captures} »`}
          </button>
        </>
      ) : (
        <p class="discret">{t`${pluriel(rangees, 'capture rangée', 'captures rangées')} dans « ${nomsSortie().captures} ».`}</p>
      )}
    </section>
  );
}
