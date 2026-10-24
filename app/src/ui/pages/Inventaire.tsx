// Étape 2 — Inventaire (SPEC § 6.2, version de la phase 1).

import { useEffect, useRef, useState } from 'preact/hooks';
import { changerTraitement, estDescendant, RACINE, resumes, type FichierPlan, type Plan, type TraitementDossier } from '../../lib/plan';
import type { Progression } from '../../navigateur/inventaire';
import { ETAPE, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { ProgressionAnalyse } from '../composants/Analyse';
import { capturesProposees, ExtrasInventaire, useCopiesExactes } from '../composants/ExtrasInventaire';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, appliquer, changerEtape, notifier, session, texteErreur, validerEtape, versionPlan, versionProjet } from '../etat';
import { duree, jourCourt, nombre, periode, pluriel, taille } from '../format';
import { construirePlan } from '../projets';
import { analyseAFaire, analyseEnCours, lancerAnalyseDossier } from '../analyseDossier';
import { DOSSIER_SANS_DATE } from '../../lib/tri';

const ETAPES_INVENTAIRE: Record<Progression['etape'], string> = {
  parcours: aTraduire('Parcours des dossiers'),
  tailles: aTraduire('Taille et date des fichiers'),
  exif: aTraduire('Date, appareil et GPS des photos'),
  videos: aTraduire('Date des vidéos'),
};

const TRAITEMENTS: [TraitementDossier, string, string][] = [
  ['trier', aTraduire('Trier ses photos'), aTraduire('elles rejoignent le tri par lieux et sorties. Pour un dossier fourre-tout : « Divers », « Téléphone ».')],
  [
    'garder',
    aTraduire('Garder tel quel'),
    aTraduire('recopié à l’identique ; ses photos peuvent aller dans l’album. Pour un dossier déjà bien rangé (« Anniversaire Lea »), ou un mois de petites sorties.'),
  ],
  ['ignorer', aTraduire('Garder tel quel, pas pour l’album'), aTraduire('recopié à l’identique ; ses photos ne sont pas proposées pour l’album. Pour des documents, scans, fonds d’écran.')],
];

/** Trois photos réparties dans un dossier (et ses sous-dossiers), pour le reconnaître d'un coup d'œil. */
function apercuDossier(plan: Plan, dossier: string): FichierPlan[] {
  const photos = [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && (f.dossier === dossier || estDescendant(plan, f.dossier, dossier)));
  if (photos.length <= 3) return photos;
  return [photos[0], photos[Math.floor(photos.length / 2)], photos.at(-1)!];
}

/** Sous-dossiers déjà présents dans un dossier en vrac (§ 6.2) : trier, garder tel quel, ou hors album. */
function SousDossiers() {
  const s = session.value!;
  const r = resumes(s.plan);
  const dossiers = [...s.plan.dossiers.values()].filter((d) => d.parent === RACINE && d.origine === 'source').sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const racine = r.get(RACINE)!;
  if (!dossiers.length) return null;
  return (
    <section id="sous-dossiers">
      <h2>{t`Que faire des sous-dossiers déjà rangés ?`}</h2>
      <p class="discret">
        {t`Les ${pluriel(racine.photos + racine.videos, 'élément')} en vrac à la racine seront triés par lieux et sorties. Pour chaque sous-dossier, choisissez :`}
      </p>
      <dl class="choix-traitement">
        {TRAITEMENTS.map(([v, libelle, explication]) => (
          <div key={v}>
            <dt>{t(libelle)}</dt>
            <dd>{t(explication)}</dd>
          </div>
        ))}
      </dl>
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
                  <select value={d.traitement ?? 'garder'} onChange={(e) => appliquer(changerTraitement(s.plan, [d.id], e.currentTarget.value as TraitementDossier))} aria-label={t`Que faire de ${d.nom}`}>
                    {TRAITEMENTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {t(l)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="actions">
        <button type="button" onClick={() => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), 'trier'))}>
          {t`Tout trier`}
        </button>
        <button type="button" onClick={() => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), 'garder'))}>
          {t`Tout garder tel quel`}
        </button>
      </p>
    </section>
  );
}

/** En haut de l'inventaire : l'analyse en cours, et ce qu'il faut vérifier pendant ce temps. */
function AVerifier() {
  const s = session.value!;
  versionPlan.value;
  const copies = useCopiesExactes();
  const enCours = !!analyseEnCours.value || analyseAFaire(s);
  const sousDossiers = s.projet.mode === 'vrac' ? [...s.plan.dossiers.values()].filter((d) => d.parent === RACINE && d.origine === 'source').length : 0;
  const captures = capturesProposees(s).length;
  const sansDate = [...s.plan.fichiers.values()].filter((f) => f.categorie !== 'autre' && f.statut === 'archive' && f.origineDate === 'fichier').length;
  const points = [
    sousDossiers > 0 && (
      <>
        {t`que faire des`} <strong>{pluriel(sousDossiers, 'sous-dossier déjà rangé', 'sous-dossiers déjà rangés')}</strong>
        {t` ;`}
      </>
    ),
    captures > 0 && (
      <>
        {t`les`} <strong>{pluriel(captures, 'capture d’écran trouvée', 'captures d’écran trouvées')}</strong>
        {t` ;`}
      </>
    ),
    copies && copies.nbCopies > 0 && (
      <>
        {t`les`} <strong>{pluriel(copies.nbCopies, 'copie en double', 'copies en double')}</strong>
        {t` ;`}
      </>
    ),
    sansDate > 0 && s.projet.mode === 'vrac' && (
      <>
        {t`les`} <strong>{pluriel(sansDate, 'photo sans date', 'photos sans date')}</strong>
        {t` : elles iront dans « ${DOSSIER_SANS_DATE} », à placer à la main ;`}
      </>
    ),
  ].filter(Boolean);
  return (
    <div class="encart a-verifier">
      {enCours ? <ProgressionAnalyse /> : <p class="ok">{t`✓ Analyse des photos terminée.`}</p>}
      {points.length > 0 ? (
        <>
          <p>
            <strong>{enCours ? t`Pendant ce temps, vérifiez :` : t`Vérifiez :`}</strong>
          </p>
          <ol>
            {points.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <p class="discret">{enCours ? t`Puis « Valider et continuer », dès la fin de l’analyse.` : t`Puis « Valider et continuer ».`}</p>
        </>
      ) : (
        <p class="discret">{enCours ? t`Rien d’autre à vérifier : « Valider et continuer » dès la fin de l’analyse.` : t`Rien d’autre à vérifier : « Valider et continuer ».`}</p>
      )}
    </div>
  );
}

const MOIS = [
  aTraduire('janv.'),
  aTraduire('févr.'),
  aTraduire('mars'),
  aTraduire('avr.'),
  aTraduire('mai'),
  aTraduire('juin'),
  aTraduire('juil.'),
  aTraduire('août'),
  aTraduire('sept.'),
  aTraduire('oct.'),
  aTraduire('nov.'),
  aTraduire('déc.'),
];

export function PageInventaire() {
  const s = session.value!;
  versionPlan.value;
  versionProjet.value;
  const [progression, setProgression] = useState<Progression | null>(null);
  const [debut, setDebut] = useState(0);
  const arreter = useRef(false);

  const lancer = async () => {
    arreter.current = false;
    setDebut(performance.now());
    setProgression({ etape: 'parcours', faits: 0, total: 0 });
    try {
      await construirePlan(setProgression, () => arreter.current);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    } finally {
      setProgression(null);
    }
  };

  // Projet tout neuf : l'inventaire part tout seul, puis l'analyse des photos (D56).
  useEffect(() => {
    if (!s.projet.inventaire && !progression) void lancer();
  }, [s.projet.id]);
  const inventaireFait = !!s.projet.inventaire;
  useEffect(() => {
    if (inventaireFait && analyseAFaire(s)) void lancerAnalyseDossier();
  }, [inventaireFait]);

  if (progression || !s.projet.inventaire) {
    const p = progression;
    return (
      <div class="page etroite">
        <TeteEtape numero={ETAPE.inventaire} titre={nomEtape(ETAPE.inventaire)}>
          {t`L’application lit chaque fichier du dossier à trier : taille, date de prise de vue, appareil. Rien n’est modifié.`}
        </TeteEtape>
        {p && (
          <>
            <BarreProgression
              faits={p.faits}
              total={p.total}
              texte={t`${t(ETAPES_INVENTAIRE[p.etape])} : ${nombre(p.faits)}${p.total ? ` / ${nombre(p.total)}` : ''} — ${duree(performance.now() - debut)}`}
            />
            <button type="button" onClick={() => (arreter.current = true)}>
              {t`Arrêter`}
            </button>
          </>
        )}
        {!p && (
          <button type="button" class="principal" onClick={() => void lancer()}>
            {t`Lancer l’inventaire`}
          </button>
        )}
      </div>
    );
  }

  const plan = s.plan;
  const fichiers = [...plan.fichiers.values()];
  const archive = fichiers.filter((f) => f.statut === 'archive' && f.categorie !== 'autre');
  const photos = archive.filter((f) => f.categorie === 'photo');
  const videos = archive.filter((f) => f.categorie === 'video');
  const autres = fichiers.filter((f) => f.categorie === 'autre');
  const misDeCote = fichiers.filter((f) => f.statut === 'mis_de_cote');
  const dates = archive.map((f) => f.date).filter((d): d is string => !!d).sort();
  const origines = { exif: 0, nom: 0, video: 0, fichier: 0 };
  for (const f of archive) origines[f.origineDate ?? 'fichier']++;
  const parMois = new Map<string, number>();
  for (const f of photos) if (f.date) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + 1);
  const mois = [...parMois].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMois = Math.max(1, ...mois.map(([, n]) => n));
  const r = resumes(plan);
  const dossiers = [...plan.dossiers.values()].filter((d) => d.parent !== null);
  const petits = dossiers.filter((d) => {
    const x = r.get(d.id)!;
    return x.photos + x.videos > 0 && x.photos + x.videos < 3;
  });
  const racine = r.get(RACINE)!;
  const inv = s.projet.inventaire;

  return (
    <div class="page avec-barre">
      <TeteEtape numero={ETAPE.inventaire} titre={nomEtape(ETAPE.inventaire)}>
        {t`Voici ce que contient « ${s.source.racine.name} ». L’application analyse maintenant les photos (netteté, ressemblance, copies) : c’est gratuit, cela se fait sur cet ordinateur et ne modifie rien.`}
      </TeteEtape>
      <AVerifier />

      <div class="tableau-bord">
        <div class="tuile-chiffre">
          <strong>{nombre(photos.length)}</strong> {t`photos`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(videos.length)}</strong> {t`vidéos`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(autres.length)}</strong> {t`autres fichiers`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(dossiers.length)}</strong> {t`dossiers`}
        </div>
        <div class="tuile-chiffre">
          <strong>{taille(inv.octets)}</strong> {t`au total`}
        </div>
      </div>

      <p>
        {t`Période : ${dates.length ? t`du ${jourCourt(dates[0])} au ${jourCourt(dates.at(-1))}` : t`inconnue`}. Inventaire fait en ${duree(inv.dureeMs)}.`}
      </p>

      {mois.length > 0 && (
        <div class="histogramme" aria-label={t`Photos par mois`}>
          {mois.map(([m, n]) => (
            <div key={m} class="barre-mois" title={t`${t(MOIS[Number(m.slice(5)) - 1])} ${m.slice(0, 4)} : ${pluriel(n, 'photo')}`}>
              <div class="valeur" style={{ height: `${Math.max(2, (n / maxMois) * 100)}%` }} />
              <span>{t(MOIS[Number(m.slice(5)) - 1])}</span>
            </div>
          ))}
        </div>
      )}

      <h2>{t`Dates de prise de vue`}</h2>
      <ul>
        <li>{t`${pluriel(origines.exif, 'photo datée', 'photos datées')} par l’appareil (EXIF) ;`}</li>
        <li>{t`${nombre(origines.nom)} datées par leur nom de fichier ;`}</li>
        <li>{t`${nombre(origines.video)} vidéos datées par leurs données internes ;`}</li>
        <li class={origines.fichier ? 'attention' : ''}>{t`${nombre(origines.fichier)} sans date (ni l’appareil, ni le nom du fichier ne la donnent).`}</li>
      </ul>

      {s.projet.mode === 'vrac' && <SousDossiers />}
      {s.projet.mode === 'deja_trie' && (
        <div class="encart">
          <p>{t`Ce dossier est déjà trié : vous pouvez chercher les doublons puis réorganiser les dossiers, ou commencer directement là où vous en avez besoin.`}</p>
          <div class="actions">
            {(
              [
                ['doublons', t`Chercher les doublons`],
                ['lieux', t`Réorganiser les dossiers`],
                ['nommage', t`Nommer les dossiers`],
                ['selection', t`Choisir les photos de l’album`],
              ] as [CodeEtape, string][]
            ).map(([code, libelle]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  changerEtape(ETAPE.inventaire, 'validee');
                  // Commencer ailleurs qu'aux lieux, c'est garder l'arborescence telle quelle : la sortie peut alors être créée.
                  if (code !== 'lieux' && code !== 'doublons') changerEtape(ETAPE.lieux, 'validee');
                  if (s.projet.etapes[ETAPE[code] - 1] !== 'validee') changerEtape(ETAPE[code], 'en_cours');
                  allerEtape(code);
                }}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>
      )}
      <ExtrasInventaire />

      {(() => {
        const incertaines = photos.filter((f) => f.origineDate === 'fichier');
        const sansGps = photos.filter((f) => !f.gps).length;
        return (
          <>
            <h2>{t`Dates et positions`}</h2>
            <p>
              {t`${pluriel(photos.length - sansGps, 'photo avec position GPS', 'photos avec position GPS')}, ${pluriel(sansGps, 'sans', 'sans')} (rangées avec les photos du même jour par le tri automatique ; l’IA peut aider à les situer).`}
            </p>
            {incertaines.length > 0 && (
              <>
                <p class="attention" id="sans-date">
                  {t`${pluriel(incertaines.length, 'photo sans date', 'photos sans date')} : la date du fichier est souvent celle d’une copie, elle n’est donc pas utilisée.`}{' '}
                  {s.projet.mode === 'vrac'
                    ? t`Le tri automatique les mettra dans « ${DOSSIER_SANS_DATE} », pour que vous les placiez à la main.`
                    : t`Elles restent dans leurs dossiers ; dans l’album, elles se placent à la fin de leur sortie.`}
                </p>
                <div class="bande-miniatures">
                  {incertaines.slice(0, 12).map((f) => (
                    <span key={f.id} title={f.id}>
                      <Miniature f={f} taille={72} />
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      <h2>{t`À savoir`}</h2>
      <ul>
        {racine.photos + racine.videos > 0 && <li>{t`${pluriel(racine.photos + racine.videos, 'élément')} directement à la racine du dossier (pas dans un sous-dossier).`}</li>}
        {petits.length > 0 && <li>{t`${pluriel(petits.length, 'petit dossier', 'petits dossiers')} (1 ou 2 photos) : à rattacher ailleurs à l’étape suivante si besoin.`}</li>}
        {misDeCote.length > 0 && <li>{t`${nombre(misDeCote.length)} élément(s) déjà mis de côté par les anciens scripts (floues, doublons) : ils iront dans « _mis_de_cote ».`}</li>}
        {inv.ignores.length > 0 && <li>{t`${pluriel(inv.ignores.length, 'fichier ignoré', 'fichiers ignorés')} : l’état d’un ancien projet (dossier « .album »).`}</li>}
        <li>{t`Les fichiers système masqués par le navigateur (comme « Thumbs.db ») ne sont pas vus : Windows les recrée.`}</li>
      </ul>

      <BarreValidation
        resume={analyseEnCours.value || analyseAFaire(s) ? t`Analyse des photos en cours…` : t`${pluriel(inv.fichiers, 'fichier')} dans « ${s.source.racine.name} »`}
        revenir={() => allerEtape('projet')}
        // Dossier en vrac : on enchaîne avec les floues ; dossier déjà trié : avec les doublons.
        valider={() => validerEtape('inventaire')}
        // Les étapes suivantes ont besoin de l'analyse : on attend qu'elle soit finie.
        validerActif={!analyseEnCours.value && !analyseAFaire(s)}
      />
      <p class="discret pied">
        <button
          type="button"
          class="lien"
          onClick={async () => {
            if (await confirmer(t`Refaire l’inventaire ?`, t`Le dossier à trier sera relu entièrement. Les changements faits dans l’arborescence seront perdus.`, t`Refaire l’inventaire`, true)) {
              s.projet.inventaire = undefined;
              versionProjet.value++;
              void lancer();
            }
          }}
        >
          {t`Refaire l’inventaire`}
        </button>
      </p>
    </div>
  );
}
