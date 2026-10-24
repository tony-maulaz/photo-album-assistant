// Étape 2 — Inventaire (SPEC § 6.2, version de la phase 1).

import { useEffect, useRef, useState } from 'preact/hooks';
import { changerTraitement, estDescendant, RACINE, resumes, type FichierPlan, type Plan, type TraitementDossier } from '../../lib/plan';
import type { Progression } from '../../navigateur/inventaire';
import { ETAPE, type CodeEtape } from '../../navigateur/projet';
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
  parcours: 'Parcours des dossiers',
  tailles: 'Taille et date des fichiers',
  exif: 'Date, appareil et GPS des photos',
  videos: 'Date des vidéos',
};

const TRAITEMENTS: [TraitementDossier, string, string][] = [
  ['trier', 'Trier ses photos', 'elles rejoignent le tri par lieux et sorties. Pour un dossier fourre-tout : « Divers », « Téléphone ».'],
  [
    'garder',
    'Garder tel quel',
    'recopié à l’identique ; ses photos peuvent aller dans l’album. Pour un dossier déjà bien rangé (« Anniversaire Lea »), ou un mois de petites sorties.',
  ],
  ['ignorer', 'Garder tel quel, pas pour l’album', 'recopié à l’identique ; ses photos ne sont pas proposées pour l’album. Pour des documents, scans, fonds d’écran.'],
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
      <h2>Que faire des sous-dossiers déjà rangés ?</h2>
      <p class="discret">
        Les {pluriel(racine.photos + racine.videos, 'élément')} en vrac à la racine seront triés par lieux et sorties. Pour chaque sous-dossier, choisissez :
      </p>
      <dl class="choix-traitement">
        {TRAITEMENTS.map(([v, libelle, explication]) => (
          <div key={v}>
            <dt>{libelle}</dt>
            <dd>{explication}</dd>
          </div>
        ))}
      </dl>
      <table class="tableau sous-dossiers">
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Période</th>
            <th class="n">Photos</th>
            <th class="n">Vidéos</th>
            <th>Que faire ?</th>
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
                  <select value={d.traitement ?? 'garder'} onChange={(e) => appliquer(changerTraitement(s.plan, [d.id], e.currentTarget.value as TraitementDossier))} aria-label={`Que faire de ${d.nom}`}>
                    {TRAITEMENTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
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
          Tout trier
        </button>
        <button type="button" onClick={() => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), 'garder'))}>
          Tout garder tel quel
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
    sousDossiers > 0 && <>que faire des <strong>{pluriel(sousDossiers, 'sous-dossier déjà rangé', 'sous-dossiers déjà rangés')}</strong> ;</>,
    captures > 0 && <>les <strong>{pluriel(captures, 'capture d’écran trouvée', 'captures d’écran trouvées')}</strong> ;</>,
    copies && copies.nbCopies > 0 && <>les <strong>{pluriel(copies.nbCopies, 'copie en double', 'copies en double')}</strong> ;</>,
    sansDate > 0 && s.projet.mode === 'vrac' && (
      <>
        les <strong>{pluriel(sansDate, 'photo sans date', 'photos sans date')}</strong> : elles iront dans « {DOSSIER_SANS_DATE} », à placer à la main ;
      </>
    ),
  ].filter(Boolean);
  return (
    <div class="encart a-verifier">
      {enCours ? <ProgressionAnalyse /> : <p class="ok">✓ Analyse des photos terminée.</p>}
      {points.length > 0 ? (
        <>
          <p>
            <strong>{enCours ? 'Pendant ce temps, vérifiez :' : 'Vérifiez :'}</strong>
          </p>
          <ol>
            {points.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <p class="discret">Puis « Valider et continuer »{enCours ? ', dès la fin de l’analyse' : ''}.</p>
        </>
      ) : (
        <p class="discret">Rien d’autre à vérifier : « Valider et continuer »{enCours ? ' dès la fin de l’analyse' : ''}.</p>
      )}
    </div>
  );
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

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
        <TeteEtape numero={ETAPE.inventaire} titre="Inventaire">
          L’application lit chaque fichier du dossier à trier : taille, date de prise de vue, appareil. Rien n’est modifié.
        </TeteEtape>
        {p && (
          <>
            <BarreProgression
              faits={p.faits}
              total={p.total}
              texte={`${ETAPES_INVENTAIRE[p.etape]} : ${nombre(p.faits)}${p.total ? ` / ${nombre(p.total)}` : ''} — ${duree(performance.now() - debut)}`}
            />
            <button type="button" onClick={() => (arreter.current = true)}>
              Arrêter
            </button>
          </>
        )}
        {!p && (
          <button type="button" class="principal" onClick={() => void lancer()}>
            Lancer l’inventaire
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
      <TeteEtape numero={ETAPE.inventaire} titre="Inventaire">
        Voici ce que contient « {s.source.racine.name} ». L’application analyse maintenant les photos (netteté, ressemblance, copies) : c’est gratuit, cela se fait
        sur cet ordinateur et ne modifie rien.
      </TeteEtape>
      <AVerifier />

      <div class="tableau-bord">
        <div class="tuile-chiffre">
          <strong>{nombre(photos.length)}</strong> photos
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(videos.length)}</strong> vidéos
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(autres.length)}</strong> autres fichiers
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(dossiers.length)}</strong> dossiers
        </div>
        <div class="tuile-chiffre">
          <strong>{taille(inv.octets)}</strong> au total
        </div>
      </div>

      <p>
        Période : {dates.length ? `du ${jourCourt(dates[0])} au ${jourCourt(dates.at(-1))}` : 'inconnue'}. Inventaire fait en {duree(inv.dureeMs)}.
      </p>

      {mois.length > 0 && (
        <div class="histogramme" aria-label="Photos par mois">
          {mois.map(([m, n]) => (
            <div key={m} class="barre-mois" title={`${MOIS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)} : ${pluriel(n, 'photo')}`}>
              <div class="valeur" style={{ height: `${Math.max(2, (n / maxMois) * 100)}%` }} />
              <span>{MOIS[Number(m.slice(5)) - 1]}</span>
            </div>
          ))}
        </div>
      )}

      <h2>Dates de prise de vue</h2>
      <ul>
        <li>{pluriel(origines.exif, 'photo datée', 'photos datées')} par l’appareil (EXIF) ;</li>
        <li>{nombre(origines.nom)} datées par leur nom de fichier ;</li>
        <li>{nombre(origines.video)} vidéos datées par leurs données internes ;</li>
        <li class={origines.fichier ? 'attention' : ''}>{nombre(origines.fichier)} sans date (ni l’appareil, ni le nom du fichier ne la donnent).</li>
      </ul>

      {s.projet.mode === 'vrac' && <SousDossiers />}
      {s.projet.mode === 'deja_trie' && (
        <div class="encart">
          <p>
            Ce dossier est déjà trié : vous pouvez chercher les doublons puis réorganiser les dossiers, ou commencer directement là où vous en avez besoin.
          </p>
          <div class="actions">
            {(
              [
                ['doublons', 'Chercher les doublons'],
                ['lieux', 'Réorganiser les dossiers'],
                ['nommage', 'Nommer les dossiers'],
                ['selection', 'Choisir les photos de l’album'],
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
            <h2>Dates et positions</h2>
            <p>
              {pluriel(photos.length - sansGps, 'photo avec position GPS', 'photos avec position GPS')}, {pluriel(sansGps, 'sans', 'sans')} (rangées avec les photos
              du même jour par le tri automatique ; l’IA peut aider à les situer).
            </p>
            {incertaines.length > 0 && (
              <>
                <p class="attention" id="sans-date">
                  {pluriel(incertaines.length, 'photo sans date', 'photos sans date')} : la date du fichier est souvent celle d’une copie, elle n’est donc pas utilisée.{' '}
                  {s.projet.mode === 'vrac'
                    ? `Le tri automatique les mettra dans « ${DOSSIER_SANS_DATE} », pour que vous les placiez à la main.`
                    : 'Elles restent dans leurs dossiers ; dans l’album, elles se placent à la fin de leur sortie.'}
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

      <h2>À savoir</h2>
      <ul>
        {racine.photos + racine.videos > 0 && <li>{pluriel(racine.photos + racine.videos, 'élément')} directement à la racine du dossier (pas dans un sous-dossier).</li>}
        {petits.length > 0 && <li>{pluriel(petits.length, 'petit dossier', 'petits dossiers')} (1 ou 2 photos) : à rattacher ailleurs à l’étape suivante si besoin.</li>}
        {misDeCote.length > 0 && <li>{nombre(misDeCote.length)} élément(s) déjà mis de côté par les anciens scripts (floues, doublons) : ils iront dans « _mis_de_cote ».</li>}
        {inv.ignores.length > 0 && <li>{pluriel(inv.ignores.length, 'fichier ignoré', 'fichiers ignorés')} : l’état d’un ancien projet (dossier « .album »).</li>}
        <li>Les fichiers système masqués par le navigateur (comme « Thumbs.db ») ne sont pas vus : Windows les recrée.</li>
      </ul>

      <BarreValidation
        resume={analyseEnCours.value || analyseAFaire(s) ? 'Analyse des photos en cours…' : `${pluriel(inv.fichiers, 'fichier')} dans « ${s.source.racine.name} »`}
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
            if (await confirmer('Refaire l’inventaire ?', 'Le dossier à trier sera relu entièrement. Les changements faits dans l’arborescence seront perdus.', 'Refaire l’inventaire', true)) {
              s.projet.inventaire = undefined;
              versionProjet.value++;
              void lancer();
            }
          }}
        >
          Refaire l’inventaire
        </button>
      </p>
    </div>
  );
}
