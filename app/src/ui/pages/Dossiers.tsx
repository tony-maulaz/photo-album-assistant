// Étape « Dossiers » (D61) : pour un dossier en vrac, que devient chaque
// sous-dossier déjà présent ? Trier ses photos, le garder en le nettoyant
// (floues et doublons proposés), ou ne pas y toucher. Rien n'est modifié dans
// la source : ces choix guident les étapes suivantes.

import { aTraduire, t } from '../../lib/langue';
import { changerTraitement, estDescendant, RACINE, resumes, traitementDe, type FichierPlan, type Plan, type TraitementDossier } from '../../lib/plan';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { appliquer, revenirDe, session, validerEtape, versionPlan } from '../etat';
import { nombre, periode, pluriel } from '../format';

/** Les trois choix, avec leur nom court (boutons) et leur explication (légende). */
const CHOIX: [TraitementDossier, string, string][] = [
  ['trier', aTraduire('Trier'), aTraduire('Ses photos rejoignent le tri par lieux et sorties, comme celles de la racine. Pour un dossier fourre-tout : « Divers », « Téléphone ».')],
  [
    'nettoyer',
    aTraduire('Garder, nettoyer'),
    aTraduire('Le dossier garde son nom et sa place ; ses photos floues et ses doublons vous seront proposés. Pour un dossier déjà rangé (« Anniversaire Lea ») ou un mois de petites sorties.'),
  ],
  ['garder', aTraduire('Ne pas toucher'), aTraduire('Recopié tel quel : on n’y cherche ni photos floues ni rafales. Pour une sélection faite avec soin (« Best of »), des scans ou des documents.')],
];

/** Trois photos réparties dans un dossier (et ses sous-dossiers), pour le reconnaître d'un coup d'œil. */
function apercuDossier(plan: Plan, dossier: string): FichierPlan[] {
  const photos = [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && (f.dossier === dossier || estDescendant(plan, f.dossier, dossier)));
  if (photos.length <= 3) return photos;
  return [photos[0], photos[Math.floor(photos.length / 2)], photos.at(-1)!];
}

export function PageDossiers() {
  const s = session.value!;
  versionPlan.value;
  const r = resumes(s.plan);
  // Dans l'ordre du temps (début de la période), pas des noms : « janvier, février… » et non « août, avril… ». Sans date : à la fin.
  const debut = (id: string) => r.get(id)?.duTotal ?? '9999';
  const dossiers = [...s.plan.dossiers.values()]
    .filter((d) => d.parent === RACINE && d.origine === 'source')
    .sort((a, b) => debut(a.id).localeCompare(debut(b.id)) || a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const racine = r.get(RACINE)!;
  const choix = (id: string) => traitementDe(s.plan, id) ?? 'trier';
  const compte = (v: TraitementDossier) => dossiers.filter((d) => choix(d.id) === v).length;
  const tous = (v: TraitementDossier) => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), v));

  return (
    <div class="page avec-barre">
      <TeteEtape numero={ETAPE.dossiers} titre={nomEtape(ETAPE.dossiers)} cle="dossiers">
        {t`Votre dossier contient déjà des sous-dossiers. Les ${pluriel(racine.photos + racine.videos, 'élément')} en vrac à la racine seront triés par lieux et sorties ; pour chaque sous-dossier, choisissez ce qu’il devient. Rien n’est modifié dans le dossier d’origine.`}
      </TeteEtape>

      {dossiers.length === 0 ? (
        <p class="encart">{t`Aucun sous-dossier : rien à décider ici.`}</p>
      ) : (
        <>
          <dl class="choix-traitement">
            {CHOIX.map(([v, libelle, explication]) => (
              <div key={v}>
                <dt>{t(libelle)}</dt>
                <dd>{t(explication)}</dd>
              </div>
            ))}
          </dl>
          <p class="actions">
            <span class="discret">{t`Pour tous :`}</span>
            {CHOIX.map(([v, libelle]) => (
              <button key={v} type="button" onClick={() => tous(v)}>
                {t(libelle)}
              </button>
            ))}
          </p>
          <table class="tableau sous-dossiers">
            <thead>
              <tr>
                <th>{t`Dossier`}</th>
                <th>{t`Période`}</th>
                <th class="n">{t`Photos`}</th>
                <th class="n">{t`Vidéos`}</th>
                <th>{t`Que faire ?`}</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => {
                const x = r.get(d.id)!;
                const actuel = choix(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <div class="dossier-apercu">
                        <span class="miniatures-dossier">
                          {apercuDossier(s.plan, d.id).map((f) => (
                            <Miniature key={f.id} f={f} taille={44} />
                          ))}
                        </span>
                        {d.nom}
                      </div>
                    </td>
                    <td>{periode(x.duTotal, x.auTotal)}</td>
                    <td class="n">{nombre(x.photosTotal)}</td>
                    <td class="n">{nombre(x.videosTotal)}</td>
                    <td>
                      {/* Trois boutons plutôt qu'une liste : tous les choix sont visibles, on change en un clic. */}
                      <div class="choix-segmente" role="radiogroup" aria-label={t`Que faire de ${d.nom}`}>
                        {CHOIX.map(([v, libelle]) => (
                          <button key={v} type="button" role="radio" aria-checked={actuel === v} onClick={() => actuel !== v && appliquer(changerTraitement(s.plan, [d.id], v))}>
                            {t(libelle)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <BarreValidation
        resume={
          dossiers.length
            ? t`${nombre(compte('trier'))} à trier · ${pluriel(compte('nettoyer'), 'gardé et nettoyé', 'gardés et nettoyés')} · ${nombre(compte('garder'))} à ne pas toucher`
            : t`Aucun sous-dossier`
        }
        revenir={() => revenirDe('dossiers')}
        valider={() => validerEtape('dossiers')}
      />
    </div>
  );
}
