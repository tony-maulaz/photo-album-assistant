// Captures d'écran (étape « Tri automatique », D61) : parmi les photos à trier
// seulement, montrées sous leur ligne de la liste « À faire » (D103). Une
// capture rangée dans un dossier qui garde sa place y a été mise exprès :
// c'est une photo comme une autre. Celles qui restent à trier sont
// proposées au rangement dans « Captures_ecran », hors du tri et de l'album ;
// chacune peut être décochée (agrandie d'un clic pour en juger), elle reste
// alors dans le tri et n'est plus proposée.

import { useState } from 'preact/hooks';
import { nomsSortie } from '../../lib/sortie';
import { t } from '../../lib/langue';
import { rangerCaptures, ressembleACapture } from '../../lib/inventaire';
import { gardeSaPlace, type FichierPlan } from '../../lib/plan';
import { appliquer, reglages, session, versionPlan, type Session } from '../etat';
import { pluriel } from '../format';
import { visionneuse } from '../organiser';
import { Miniature } from './GrillePhotos';
import { Visionneuse } from './Visionneuse';

/** Au-delà, les autres propositions se montrent sur demande. */
const VISIBLES = 24;

/** Captures d'écran proposées au rangement : pas encore rangées ni refusées, parmi les photos à trier d'un dossier en vrac. */
export function capturesProposees(s: Session): FichierPlan[] {
  if (s.projet.mode !== 'vrac') return [];
  return [...s.plan.fichiers.values()].filter((f) => f.statut === 'archive' && f.capture === undefined && !gardeSaPlace(s.plan, f.dossier) && ressembleACapture(f));
}

export function Captures() {
  const s = session.value!;
  versionPlan.value;
  // Photos décochées : gardées dans le tri au moment de valider la proposition.
  const [decochees, setDecochees] = useState<ReadonlySet<string>>(new Set());
  const [toutes, setToutes] = useState(false);
  const rangees = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && f.capture).length;
  const candidates = capturesProposees(s);
  if (!candidates.length && !rangees) return null;
  const cochees = candidates.filter((f) => !decochees.has(f.id));
  const gardees = candidates.filter((f) => decochees.has(f.id));
  const montrees = toutes ? candidates : candidates.slice(0, VISIBLES);
  const basculer = (id: string) => setDecochees(new Set(decochees.has(id) ? [...decochees].filter((x) => x !== id) : [...decochees, id]));
  const valider = () => {
    appliquer(
      rangerCaptures(
        s.plan,
        cochees.map((f) => f.id),
        gardees.map((f) => f.id),
      ),
    );
    setDecochees(new Set());
  };
  // À l'échelle du curseur de taille : 112 px au réglage par défaut (160).
  const cote = Math.round(reglages.value.tailleMiniatures * 0.7);
  return (
    <div id="captures" class="captures-a-choisir">
      {candidates.length > 0 ? (
        <>
          <p class="discret">{t`Décochez une vraie photo pour la garder dans le tri ; cliquez sur une image pour l’agrandir.`}</p>
          <ul class="captures-proposees">
            {montrees.map((f) => {
              const cochee = !decochees.has(f.id);
              return (
                <li key={f.id} class={cochee ? '' : 'decochee'} style={{ width: `${cote + 12}px` }}>
                  <button
                    type="button"
                    class="image-capture"
                    style={{ width: `${cote + 6}px`, height: `${cote + 6}px` }}
                    title={t`Agrandir « ${f.nom} »`}
                    onClick={() => (visionneuse.value = candidates.indexOf(f))}
                  >
                    <Miniature f={f} taille={cote} />
                  </button>
                  <label class="case" title={f.id}>
                    <input type="checkbox" checked={cochee} onChange={() => basculer(f.id)} />
                    <span class="nom-capture">{f.nom}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {candidates.length > VISIBLES && (
            <button type="button" class="lien" onClick={() => setToutes(!toutes)}>
              {toutes ? t`Moins de photos` : t`Voir les ${candidates.length} propositions`}
            </button>
          )}
          <p class="actions">
            <button type="button" class={cochees.length ? 'principal' : ''} onClick={valider}>
              {cochees.length ? t`Ranger ${pluriel(cochees.length, 'capture', 'captures')} dans « ${nomsSortie().captures} »` : t`Garder ces photos dans le tri`}
            </button>
            {cochees.length > 0 && gardees.length > 0 && <span class="discret">{t`${pluriel(gardees.length, 'photo décochée gardée', 'photos décochées gardées')} dans le tri`}</span>}
          </p>
          {visionneuse.value !== null && <Visionneuse elements={candidates} />}
        </>
      ) : (
        <p class="discret">{t`${pluriel(rangees, 'capture rangée', 'captures rangées')} dans « ${nomsSortie().captures} ».`}</p>
      )}
    </div>
  );
}
