// Étape « Dossiers » (D61) : pour un dossier en vrac, que devient chaque
// sous-dossier déjà présent ? Trier ses photos, le garder en le nettoyant
// (floues et doublons proposés), ou ne pas y toucher. Rien n'est modifié dans
// la source : ces choix guident les étapes suivantes.

import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SEUIL_PETIT_DOSSIER } from '../../lib/fragments';
import { aTraduire, t } from '../../lib/langue';
import { changerTraitement, comparerNoms, enfants, estDescendant, RACINE, resumes, traitementDe, type FichierPlan, type Plan, type ResumeDossier, type TraitementDossier } from '../../lib/plan';
import { estDossierMois } from '../../lib/tri';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { lancerAnalyseDossier } from '../analyseDossier';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { CurseurTaille } from '../composants/CadreCommun';
import { Miniature } from '../composants/GrillePhotos';
import { Visionneuse } from '../composants/Visionneuse';
import { appliquer, reglages, revenirDe, session, validerEtape, versionPlan } from '../etat';
import { jourCourt, nombre, periode, pluriel } from '../format';
import { simplifier, visionneuse } from '../organiser';
import { DUREE_MAX_SORTIE_JOURS } from './Organisation';

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

/** Photos d'un dossier et de ses sous-dossiers, dans l'ordre du temps ; ses vidéos s'il n'a pas de photo. */
function photosDe(plan: Plan, dossier: string): FichierPlan[] {
  const dedans = [...plan.fichiers.values()].filter((f) => f.statut === 'archive' && (f.dossier === dossier || estDescendant(plan, f.dossier, dossier)));
  const photos = dedans.filter((f) => f.categorie === 'photo');
  return (photos.length ? photos : dedans.filter((f) => f.categorie === 'video')).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || comparerNoms(a.nom, b.nom));
}

/** Au plus `n` photos réparties sur tout le dossier, la première et la dernière comprises. */
function echantillon(photos: FichierPlan[], n: number): FichierPlan[] {
  if (photos.length <= n) return photos;
  if (n < 2) return photos.slice(0, n);
  return Array.from({ length: n }, (_, i) => photos[Math.round((i * (photos.length - 1)) / (n - 1))]);
}

/**
 * Ce qui mérite un second regard, sans rien choisir à la place de l'utilisateur
 * (D95) : un dossier qui n'est pas un mois mais s'étale sur plus d'un mois
 * (un fourre-tout ?), et un dossier si petit qu'une fois gardé il restera seul :
 * les étapes Petits dossiers et Consolidation ne proposent jamais un dossier gardé.
 */
function Signaux({ nom, x }: { nom: string; x: ResumeDossier }) {
  const jours = x.duTotal && x.auTotal ? (Date.parse(x.auTotal.slice(0, 10)) - Date.parse(x.duTotal.slice(0, 10))) / 86_400_000 : 0;
  const etale = jours > DUREE_MAX_SORTIE_JOURS && !estDossierMois(nom);
  const n = x.photosTotal + x.videosTotal;
  const petit = n > 0 && n < SEUIL_PETIT_DOSSIER;
  if (!etale && !petit) return null;
  return (
    <>
      {etale && (
        <span class="badge signal-dossier" title={t`Ses photos s’étalent sur plusieurs mois : un dossier fourre-tout ? « Trier » les répartirait par sortie.`}>
          {t`sur ${nombre(Math.max(2, Math.round(jours / 30.4)))} mois`}
        </span>
      )}
      {petit && (
        <span class="badge signal-dossier" title={t`Gardé, ce petit dossier restera tel quel : il ne sera proposé ni aux Petits dossiers, ni à la Consolidation. « Trier » range ses photos avec les autres, par sortie.`}>
          {pluriel(n, 'photo seule', 'photos seules')}
        </span>
      )}
    </>
  );
}

/**
 * Les photos d'un dossier, sous sa ligne : une bande réparties dans le temps,
 * à la taille du curseur, autant qu'en tient la largeur. Pour un dossier à
 * sous-dossiers, des pastilles montrent ceux d'un seul ; le choix reste celui
 * du dossier entier. Un clic sur une photo l'ouvre en grand.
 */
function PhotosDuDossier({ plan, id, r }: { plan: Plan; id: string; r: Map<string, ResumeDossier> }) {
  const [filtre, setFiltre] = useState<string | null>(null);
  const [largeur, setLargeur] = useState(900);
  const bande = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bande.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setLargeur(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sous = enfants(plan, id);
  const direct = (r.get(id)?.photos ?? 0) + (r.get(id)?.videos ?? 0);
  const toutes = photosDe(plan, id);
  const vues = filtre === null ? toutes : filtre === RACINE ? toutes.filter((f) => f.dossier === id) : photosDe(plan, filtre);
  const cote = Math.round(reglages.value.tailleMiniatures * 0.6);
  const ESPACE = 10;
  const montrees = echantillon(vues, Math.max(3, Math.floor((largeur + ESPACE) / (cote + ESPACE))));
  const plusieursJours = new Set(vues.map((f) => f.date?.slice(0, 10))).size > 1;
  const pastilles: [string | null, string, number][] = [
    [null, t`Tout`, toutes.length],
    ...(sous.length && direct ? [[RACINE, t`Directement dans le dossier`, toutes.filter((f) => f.dossier === id).length] as [string, string, number]] : []),
    ...sous.map((d) => [d.id, d.nom, photosDe(plan, d.id).length] as [string, string, number]),
  ];

  return (
    <div class="photos-dossier">
      {sous.length > 0 && (
        <div class="pastilles-dossier" role="group" aria-label={t`Sous-dossiers`}>
          {pastilles.map(([cle, libelle, n]) => (
            <button key={cle ?? ''} type="button" aria-pressed={filtre === cle} onClick={() => setFiltre(cle)}>
              {libelle} <span class="discret">{nombre(n)}</span>
            </button>
          ))}
        </div>
      )}
      <div class="bande-dossier" ref={bande}>
        {montrees.map((f) => (
          <figure key={f.id}>
            <span class="cadre-bande" style={{ width: `${cote}px`, height: `${cote}px` }}>
              <button type="button" class="photo-petit" onClick={() => (visionneuse.value = vues.indexOf(f))} title={t`Voir en grand`}>
                <Miniature f={f} taille={cote} />
              </button>
            </span>
            <figcaption>{plusieursJours ? jourCourt(f.date) : (f.date?.slice(11, 16) ?? '')}</figcaption>
          </figure>
        ))}
        {!vues.length && <p class="discret">{t`Aucune photo.`}</p>}
      </div>
      {vues.length > 0 && (
        <button type="button" class="lien" onClick={() => (visionneuse.value = 0)}>
          {vues.length === 1 ? t`Voir la photo en grand` : t`Voir les ${nombre(vues.length)} photos en grand`}
        </button>
      )}
      {visionneuse.value !== null && <Visionneuse elements={vues} rangement={false} />}
    </div>
  );
}

export function PageDossiers() {
  const s = session.value!;
  versionPlan.value;
  const [cherche, setCherche] = useState('');
  // Une seule ligne ouverte à la fois : on compare d'un dossier à l'autre sans que la page s'allonge.
  const [ouvert, setOuvert] = useState<string | null>(null);
  const r = resumes(s.plan);
  // Par nom, comme dans l'explorateur ; ou dans l'ordre du temps (début de la période), pour que « janvier, février… »
  // ne deviennent pas « août, avril… ». Sans date : à la fin.
  const debut = (id: string) => r.get(id)?.duTotal ?? '9999';
  const dossiers = [...s.plan.dossiers.values()]
    .filter((d) => d.parent === RACINE && d.origine === 'source')
    .sort((a, b) => (ordreDossiers.value === 'periode' && debut(a.id).localeCompare(debut(b.id))) || comparerNoms(a.nom, b.nom));
  const q = simplifier(cherche.trim());
  // La recherche trouve aussi un dossier par le nom d'un de ses sous-dossiers (« Ville_B » trouve « Voyage »).
  const nomsDessous = (id: string) => [...s.plan.dossiers.values()].filter((x) => estDescendant(s.plan, x.id, id)).map((x) => x.nom);
  const montres = dossiers.filter((d) => !q || simplifier(d.nom).includes(q) || nomsDessous(d.id).some((n) => simplifier(n).includes(q)));
  const racine = r.get(RACINE)!;
  const choix = (id: string) => traitementDe(s.plan, id) ?? 'trier';
  const compte = (v: TraitementDossier) => dossiers.filter((d) => choix(d.id) === v).length;
  // « Pour tous » : les dossiers affichés, ceux trouvés par la recherche le cas échéant.
  const tous = (v: TraitementDossier) => appliquer(changerTraitement(s.plan, montres.map((d) => d.id), v));
  const basculer = (id: string) => {
    visionneuse.value = null;
    setOuvert(ouvert === id ? null : id);
  };

  return (
    <div class="page avec-barre">
      <TeteEtape numero={ETAPE.dossiers} titre={nomEtape(ETAPE.dossiers)} cle="dossiers" outils={<CurseurTaille vraie={(v) => Math.round(v * 0.6)} />}>
        {t`Votre dossier contient déjà des sous-dossiers. Les ${pluriel(racine.photos + racine.videos, 'élément')} en vrac à la racine seront triés par lieux et sorties ; pour chaque sous-dossier, choisissez ce qu’il devient. Rien n’est modifié dans le dossier d’origine.`}{' '}
        {t`Cliquez sur un dossier pour voir ses photos.`}
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
            <colgroup>
              <col class="col-fleche" />
              <col />
              <col class="col-periode" />
              <col class="col-nombre" />
              <col class="col-nombre" />
              <col class="col-sous" />
              <col class="col-choix" />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th>{t`Dossier`}</th>
                <th>{t`Période`}</th>
                <th class="n">{t`Photos`}</th>
                <th class="n">{t`Vidéos`}</th>
                <th class="n">{t`Sous-dossiers`}</th>
                <th>{t`Que faire ?`}</th>
              </tr>
            </thead>
            <tbody>
              {montres.flatMap((d) => {
                const x = r.get(d.id)!;
                const actuel = choix(d.id);
                const nbSous = enfants(s.plan, d.id).length;
                const estOuvert = ouvert === d.id;
                const ligne = (
                  <tr
                    key={d.id}
                    class={`ligne-sous-dossier${estOuvert ? ' ouverte' : ''}`}
                    // Toute la ligne ouvre les photos, sauf les boutons du choix.
                    onClick={(e) => !(e.target as HTMLElement).closest('.choix-segmente') && basculer(d.id)}
                  >
                    <td>
                      <button type="button" class="fleche-dossier" aria-expanded={estOuvert} aria-label={estOuvert ? t`Masquer les photos de ${d.nom}` : t`Voir les photos de ${d.nom}`}>
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    </td>
                    <td>
                      <span class="nom-sous-dossier">{d.nom}</span>
                      {actuel !== 'trier' && <Signaux nom={d.nom} x={x} />}
                      <SousDossiers plan={s.plan} id={d.id} r={r} />
                    </td>
                    <td>{periode(x.duTotal, x.auTotal)}</td>
                    <td class="n">{nombre(x.photosTotal)}</td>
                    <td class="n">{nombre(x.videosTotal)}</td>
                    <td class="n">{nbSous > 0 && nombre(nbSous)}</td>
                    <td>
                      {/* Trois boutons plutôt qu'une liste : tous les choix sont visibles, on change en un clic. */}
                      <div class="choix-segmente" role="radiogroup" aria-label={t`Que faire de ${d.nom}`}>
                        {CHOIX.map(([v, libelle]) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={actuel === v}
                            title={v === 'trier' && nbSous ? t`Ses ${pluriel(nbSous, 'sous-dossier')} disparaissent aussi : leurs photos sont réparties par le tri.` : undefined}
                            onClick={() => actuel !== v && appliquer(changerTraitement(s.plan, [d.id], v))}
                          >
                            {t(libelle)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
                return estOuvert
                  ? [
                      ligne,
                      <tr key={`${d.id}-photos`} class="photos-ligne">
                        <td />
                        <td colSpan={6}>
                          <PhotosDuDossier plan={s.plan} id={d.id} r={r} />
                        </td>
                      </tr>,
                    ]
                  : [ligne];
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
