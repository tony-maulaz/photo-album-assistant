// Étape 2 — Inventaire (SPEC § 6.2, version de la phase 1).

import { useEffect, useRef, useState } from 'preact/hooks';
import { RACINE, resumes } from '../../lib/plan';
import type { Progression } from '../../navigateur/inventaire';
import { ETAPE, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { ProgressionAnalyse } from '../composants/Analyse';
import { copiesProposees, useCopiesExactes } from '../composants/CopiesExactes';
import { ExtrasInventaire } from '../composants/ExtrasInventaire';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, changerEtape, notifier, session, texteErreur, validerEtape, versionPlan, versionProjet } from '../etat';
import { duree, jourCourt, nombre, pluriel, taille } from '../format';
import { construirePlan } from '../projets';
import { analyseAFaire, analyseEnCours, lancerAnalyseDossier } from '../analyseDossier';
import { DOSSIER_SANS_DATE } from '../../lib/tri';

const ETAPES_INVENTAIRE: Record<Progression['etape'], string> = {
  parcours: aTraduire('Parcours des dossiers'),
  tailles: aTraduire('Taille et date des fichiers'),
  exif: aTraduire('Date, appareil et GPS des photos'),
  videos: aTraduire('Date des vidéos'),
};

/** En haut de l'inventaire : l'analyse en cours, et ce qui attend aux étapes suivantes. */
function AVerifier() {
  const s = session.value!;
  versionPlan.value;
  const copies = useCopiesExactes();
  const enCours = !!analyseEnCours.value || analyseAFaire(s);
  const sousDossiers = s.projet.mode === 'vrac' ? [...s.plan.dossiers.values()].filter((d) => d.parent === RACINE && d.origine === 'source').length : 0;
  const nbCopies = copies ? copiesProposees(copies) : 0;
  const sansDate = [...s.plan.fichiers.values()].filter((f) => f.categorie !== 'autre' && f.statut === 'archive' && f.origineDate === 'fichier').length;
  const points = [
    sousDossiers > 0 && t`${pluriel(sousDossiers, 'sous-dossier', 'sous-dossiers')} : vous choisirez à l’étape suivante s’il faut les trier, les garder en les nettoyant ou n’y pas toucher.`,
    nbCopies > 0 && t`${pluriel(nbCopies, 'copie exacte', 'copies exactes')} (même photo en plusieurs exemplaires) : vous choisirez à l’étape « ${nomEtape(ETAPE.doublons)} » les exemplaires à garder.`,
    sansDate > 0 && s.projet.mode === 'vrac' && t`${pluriel(sansDate, 'photo sans date', 'photos sans date')} : elles iront dans « ${DOSSIER_SANS_DATE} », à placer à la main.`,
  ].filter((x): x is string => !!x);
  return (
    <div class="encart a-verifier">
      {enCours ? <ProgressionAnalyse /> : <p class="ok">{t`✓ Analyse des photos terminée.`}</p>}
      {points.length > 0 && (
        <ul>
          {points.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <p class="discret">{enCours ? t`« Valider et continuer » dès la fin de l’analyse.` : t`Rien à décider ici : « Valider et continuer ».`}</p>
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

  // Tout repart de la source : inventaire, analyse des photos (les résultats des photos inchangées sont
  // réutilisés), rafales recalculées à l'étape « Doublons », étapes suivantes à refaire.
  const refaire = async () => {
    if (
      !(await confirmer(
        t`Refaire l’inventaire ?`,
        t`Le dossier à trier sera relu entièrement et les photos analysées de nouveau (les résultats des photos inchangées sont réutilisés, sans frais). Les changements faits dans l’arborescence seront perdus et les étapes suivantes seront à refaire.`,
        t`Refaire l’inventaire`,
        true,
      ))
    )
      return;
    s.projet.inventaire = undefined;
    s.doublons = undefined;
    await s.etat.ecrire('doublons.json', null).catch(() => undefined);
    for (let n = ETAPE.inventaire + 1; n <= s.projet.etapes.length; n++) changerEtape(n, 'a_faire');
    versionProjet.value++;
    void lancer();
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
  // La date du fichier (photo sans date) est souvent celle d'une copie : ni dans la période, ni dans l'histogramme.
  const datees = archive.filter((f) => f.origineDate !== 'fichier');
  const dates = datees.map((f) => f.date).filter((d): d is string => !!d).sort();
  const origines = { exif: 0, nom: 0, video: 0, fichier: 0 };
  for (const f of archive) origines[f.origineDate ?? 'fichier']++;
  const parMois = new Map<string, number>();
  for (const f of datees) if (f.categorie === 'photo' && f.date) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + 1);
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
      <TeteEtape
        numero={ETAPE.inventaire}
        titre={nomEtape(ETAPE.inventaire)}
        outils={
          <button type="button" class="lien" onClick={() => void refaire()}>
            {t`Refaire l’inventaire`}
          </button>
        }
      >
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
    </div>
  );
}
