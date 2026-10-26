// Étape « Dossiers » (D61) : pour un dossier en vrac, que devient chaque
// sous-dossier déjà présent ? Trier ses photos, le garder en le nettoyant
// (floues et doublons proposés), ou ne pas y toucher. Rien n'est modifié dans
// la source : ces choix guident les étapes suivantes.

import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import { changerTraitement, comparerNoms, enfants, estDescendant, RACINE, resumes, traitementDe, type FichierPlan, type Plan, type ResumeDossier, type TraitementDossier } from '../../lib/plan';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { lancerAnalyseDossier } from '../analyseDossier';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { appliquer, revenirDe, session, validerEtape, versionPlan } from '../etat';
import { nombre, periode, pluriel } from '../format';
import { simplifier } from '../organiser';

/**
 * Sous-dossiers d'un dossier, sous son nom : le nombre de photos les compte
 * tous, et « 180 photos » faisait croire à un dossier trop grand (D92).
 * « 10 sous-dossiers : Ville_A, Ville_B, Ville_C… (+7) », et les photos
 * propres au dossier s'il en a ; la bulle donne la liste complète.
 */
function SousDossiers({ plan, id, r }: { plan: Plan; id: string; r: Map<string, ResumeDossier> }) {
  const liste = enfants(plan, id);
  if (!liste.length) return null;
  const direct = r.get(id)?.photos ?? 0;
  const noms = liste.slice(0, 3).map((d) => d.nom).join(', ') + (liste.length > 3 ? `… (+${liste.length - 3})` : '');
  return (
    <div class="discret sous-dossiers-ligne" title={liste.map((d) => `${d.nom} (${pluriel(r.get(d.id)?.photosTotal ?? 0, 'photo')})`).join('\n')}>
      {t`${pluriel(liste.length, 'sous-dossier')} : ${noms}`}
      {direct > 0 && t` · ${pluriel(direct, 'photo')} directement dans le dossier`}
    </div>
  );
}

/** Ordre des sous-dossiers, gardé le temps de la session : par nom, ou par période pour des dossiers « janvier, février… ». */
const ordreDossiers = signal<'nom' | 'periode'>('nom');

/** Les trois choix, avec leur nom court (boutons) et leur explication (légende). */
const CHOIX: [TraitementDossier, string, string][] = [
  [
    'trier',
    aTraduire('Trier'),
    aTraduire('Le dossier disparaît : ses photos sont réparties, avec celles en vrac, dans des dossiers par lieu et par sortie. Pour un dossier fourre-tout : « Divers », « Téléphone ».'),
  ],
  [
    'nettoyer',
    aTraduire('Garder, nettoyer'),
    aTraduire('Le dossier garde son nom et ses photos ; on vous proposera seulement d’en écarter les photos floues et les doublons. Pour un dossier déjà rangé (« Anniversaire Lea ») ou un mois de petites sorties.'),
  ],
  ['garder', aTraduire('Ne pas toucher'), aTraduire('Recopié tel quel : on n’y cherche ni photos floues, ni rafales, ni copies. Pour une sélection faite avec soin (« Best of »), des scans ou des documents.')],
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
  const [cherche, setCherche] = useState('');
  const r = resumes(s.plan);
  // Par nom, comme dans l'explorateur ; ou dans l'ordre du temps (début de la période), pour que « janvier, février… »
  // ne deviennent pas « août, avril… ». Sans date : à la fin.
  const debut = (id: string) => r.get(id)?.duTotal ?? '9999';
  const dossiers = [...s.plan.dossiers.values()]
    .filter((d) => d.parent === RACINE && d.origine === 'source')
    .sort((a, b) => (ordreDossiers.value === 'periode' && debut(a.id).localeCompare(debut(b.id))) || comparerNoms(a.nom, b.nom));
  const q = simplifier(cherche.trim());
  const montres = dossiers.filter((d) => simplifier(d.nom).includes(q));
  const racine = r.get(RACINE)!;
  const choix = (id: string) => traitementDe(s.plan, id) ?? 'trier';
  const compte = (v: TraitementDossier) => dossiers.filter((d) => choix(d.id) === v).length;
  // « Pour tous » : les dossiers affichés, ceux trouvés par la recherche le cas échéant.
  const tous = (v: TraitementDossier) => appliquer(changerTraitement(s.plan, montres.map((d) => d.id), v));

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
          <div class="actions outils-sous-dossiers">
            <input type="search" placeholder={t`Chercher…`} aria-label={t`Chercher un dossier`} value={cherche} onInput={(e) => setCherche(e.currentTarget.value)} />
            <select value={ordreDossiers.value} onChange={(e) => (ordreDossiers.value = e.currentTarget.value as 'nom' | 'periode')} aria-label={t`Ordre des dossiers`}>
              <option value="nom">{t`Par nom`}</option>
              <option value="periode">{t`Par période`}</option>
            </select>
            <span class="espace" />
            {montres.length > 0 && (
              <>
                <span class="discret">{q ? t`Pour ${pluriel(montres.length, 'dossier trouvé', 'dossiers trouvés')} :` : t`Pour tous :`}</span>
                {CHOIX.map(([v, libelle]) => (
                  <button key={v} type="button" onClick={() => tous(v)}>
                    {t(libelle)}
                  </button>
                ))}
              </>
            )}
          </div>
          {!montres.length && <p class="encart">{t`Aucun dossier ne correspond.`}</p>}
          <table class="tableau sous-dossiers" hidden={!montres.length}>
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
              {montres.map((d) => {
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
                        <span>
                          {d.nom}
                          <SousDossiers plan={s.plan} id={d.id} r={r} />
                        </span>
                      </div>
                    </td>
                    <td>{periode(x.duTotal, x.auTotal)}</td>
                    <td class="n">{nombre(x.photosTotal)}</td>
                    <td class="n">{nombre(x.videosTotal)}</td>
                    <td>
                      {/* Trois boutons plutôt qu'une liste : tous les choix sont visibles, on change en un clic. */}
                      <div class="choix-segmente" role="radiogroup" aria-label={t`Que faire de ${d.nom}`}>
                        {CHOIX.map(([v, libelle]) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={actuel === v}
                            title={v === 'trier' && enfants(s.plan, d.id).length ? t`Ses ${pluriel(enfants(s.plan, d.id).length, 'sous-dossier')} disparaissent aussi : leurs photos sont réparties par le tri.` : undefined}
                            onClick={() => actuel !== v && appliquer(changerTraitement(s.plan, [d.id], v))}
                          >
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
        valider={() => {
          validerEtape('dossiers');
          // Un dossier qui change de choix change de lot : les rafales y sont cherchées de nouveau, en arrière-plan.
          void lancerAnalyseDossier();
        }}
      />
    </div>
  );
}
