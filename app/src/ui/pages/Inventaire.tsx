// Étape 2 — Inventaire (SPEC § 6.2, version de la phase 1).

import { nomsSortie } from '../../lib/sortie';
import { useEffect, useRef, useState } from 'preact/hooks';
import { aRelire, groupesScenes, groupeVisible } from '../../lib/groupesDoublons';
import { resumeSource } from '../../lib/inventaire';
import { RACINE } from '../../lib/plan';
import { heureLocale } from '../../lib/source';
import type { Progression } from '../../navigateur/inventaire';
import { ETAPE, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { ProgressionAnalyse } from '../composants/Analyse';
import { copiesProposees, useCopiesExactes } from '../copiesExactes';
import { miseAJourDemandee } from '../composants/BandeauSource';
import { ExtrasInventaire } from '../composants/ExtrasInventaire';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, changementsSource, changerEtape, notifier, session, texteErreur, validerEtape, versionIA, versionPlan, versionProjet } from '../etat';
import { dateHeure, duree, jourCourt, nombre, pluriel, taille } from '../format';
import { construirePlan, mettreAJourInventaire } from '../projets';
import { analyseAFaire, analyseEnCours, lancerAnalyseDossier } from '../analyseDossier';

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
  versionIA.value;
  const copies = useCopiesExactes();
  const enCours = !!analyseEnCours.value || analyseAFaire(s);
  const sousDossiers = s.projet.mode === 'vrac' ? [...s.plan.dossiers.values()].filter((d) => d.parent === RACINE && d.origine === 'source').length : 0;
  const nbCopies = copies ? copiesProposees(copies, s.plan) : 0;
  // Rafales cherchées avec l'analyse (D81) : celles qui restent à relire.
  const fichier = (id: string) => s.plan.fichiers.get(id);
  const nbRafales = s.doublons ? groupesScenes(s.doublons.dossiers, fichier).filter((g) => g.sorte === 'rafales' && groupeVisible(g, fichier) && aRelire(g, fichier)).length : 0;
  const sansDate = [...s.plan.fichiers.values()].filter((f) => f.categorie !== 'autre' && f.statut === 'archive' && f.origineDate === 'fichier').length;
  const derniere = s.projet.mises_a_jour?.at(-1);
  const points = [
    sousDossiers > 0 && t`${pluriel(sousDossiers, 'sous-dossier', 'sous-dossiers')} : vous choisirez à l’étape suivante s’il faut les trier, les garder en les nettoyant ou n’y pas toucher.`,
    nbCopies > 0 && t`${pluriel(nbCopies, 'copie exacte', 'copies exactes')} (même photo en plusieurs exemplaires) : vous choisirez à l’étape « ${nomEtape(ETAPE.doublons)} » les exemplaires à garder.`,
    nbRafales > 0 && t`${pluriel(nbRafales, 'rafale', 'rafales')} (photos quasi identiques prises à quelques secondes) : vous choisirez à l’étape « ${nomEtape(ETAPE.doublons)} » celles à garder.`,
    sansDate > 0 && s.projet.mode === 'vrac' && t`${pluriel(sansDate, 'photo sans date', 'photos sans date')} : elles iront dans « ${nomsSortie().sansDate} », à placer à la main.`,
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
      {derniere && (
        <p class="discret">
          {t`Dernière mise à jour de l’inventaire : ${dateHeure(heureLocale(Date.parse(derniere.quand)))}, ${pluriel(derniere.ajoutes, 'fichier ajouté', 'fichiers ajoutés')}.`}
        </p>
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
        t`Le dossier à trier sera relu entièrement et les photos analysées de nouveau (les résultats des photos inchangées sont réutilisés, sans frais). Tout ce qui a été décidé depuis l’inventaire sera perdu : l’arborescence, les noms des dossiers, la sélection et l’album ; les étapes suivantes seront à refaire. Pour ajouter des photos arrivées depuis, utilisez plutôt « Mettre à jour l’inventaire ».`,
        t`Refaire l’inventaire`,
        true,
      ))
    )
      return;
    s.projet.inventaire = undefined;
    s.doublons = undefined;
    await s.etat.ecrire('doublons.json', null).catch(() => undefined);
    for (let n = ETAPE.inventaire + 1; n <= s.projet.etapes.length; n++) changerEtape(n, 'a_faire');
    s.projet.mises_a_jour = undefined;
    changementsSource.value = null;
    versionProjet.value++;
    void lancer();
  };

  // Trier en plusieurs fois (D63) : seuls les fichiers nouveaux ou modifiés sont lus, tout ce qui est décidé reste.
  const mettreAJour = async () => {
    arreter.current = false;
    setDebut(performance.now());
    setProgression({ etape: 'parcours', faits: 0, total: 0 });
    try {
      const r = await mettreAJourInventaire(setProgression, () => arreter.current);
      if (!r.ajoutes && !r.modifies && !r.retires.length) notifier('info', t`Le dossier à trier n’a pas changé depuis l’inventaire.`);
      else {
        const quoi = [pluriel(r.ajoutes, 'fichier ajouté', 'fichiers ajoutés'), ...(r.modifies ? [pluriel(r.modifies, 'fichier modifié relu', 'fichiers modifiés relus')] : [])].join(', ');
        notifier('ok', t`Inventaire mis à jour : ${quoi}. Les étapes suivantes ne traiteront que le nouveau ; tout ce qui était décidé est gardé.`);
        if (r.retires.length)
          notifier('info', t`${pluriel(r.retires.length, 'fichier disparu', 'fichiers disparus')} du dossier à trier avant d’avoir été copiés : retirés du projet (liste dans le journal).`);
      }
    } catch (err) {
      notifier('erreur', texteErreur(err));
    } finally {
      setProgression(null);
      miseAJourDemandee.value = false;
      // Les nouvelles photos sont analysées à leur tour (les autres gardent leurs résultats).
      if (analyseAFaire(s)) void lancerAnalyseDossier();
    }
  };
  // Demandée depuis le bandeau « le dossier à trier a changé » : lancée en arrivant.
  useEffect(() => {
    if (miseAJourDemandee.value && s.projet.inventaire && !progression) void mettreAJour();
  }, [miseAJourDemandee.value]);

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
  // Ce que contient la source, mis de côté compris : les chiffres ne bougent pas quand les étapes suivantes
  // rangent ou écartent des photos (seule une mise à jour de l'inventaire les change).
  const source = resumeSource(plan);
  const medias = fichiers.filter((f) => f.categorie !== 'autre');
  const photos = medias.filter((f) => f.categorie === 'photo');
  const misDeCote = fichiers.filter((f) => f.statut === 'mis_de_cote');
  // La date du fichier (photo sans date) est souvent celle d'une copie : ni dans la période, ni dans l'histogramme.
  const datees = medias.filter((f) => f.origineDate !== 'fichier');
  const dates = datees.map((f) => f.date).filter((d): d is string => !!d).sort();
  const origines = { exif: 0, nom: 0, video: 0, fichier: 0 };
  for (const f of medias) origines[f.origineDate ?? 'fichier']++;
  const parMois = new Map<string, number>();
  for (const f of datees) if (f.categorie === 'photo' && f.date) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + 1);
  const mois = [...parMois].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMois = Math.max(1, ...mois.map(([, n]) => n));
  const inv = s.projet.inventaire;

  return (
    <div class="page avec-barre">
      <TeteEtape
        numero={ETAPE.inventaire}
        titre={nomEtape(ETAPE.inventaire)}
        outils={
          <button type="button" class="lien" onClick={() => void mettreAJour()} title={t`Ajoute les photos arrivées dans le dossier depuis l’inventaire, sans rien changer à ce qui est décidé`}>
            {t`Mettre à jour l’inventaire`}
          </button>
        }
      >
        {t`Voici ce que contient « ${s.source.racine.name} ». L’application analyse maintenant les photos (netteté, ressemblance, copies, rafales) : c’est gratuit, cela se fait sur cet ordinateur et ne modifie rien.`}
      </TeteEtape>
      <AVerifier />

      <div class="tableau-bord">
        <div class="tuile-chiffre">
          <strong>{nombre(source.photos)}</strong> {t`photos`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(source.videos)}</strong> {t`vidéos`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(source.autres)}</strong> {t`autres fichiers`}
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(source.dossiers)}</strong> {t`dossiers`}
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
        <li>{t`${pluriel(origines.nom, 'datée', 'datées')} par le nom du fichier ;`}</li>
        <li>{t`${pluriel(origines.video, 'vidéo datée', 'vidéos datées')} par les données internes ;`}</li>
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
                    ? t`Le tri automatique les mettra dans « ${nomsSortie().sansDate} », pour que vous les placiez à la main.`
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
        {source.aLaRacine > 0 && <li>{t`${pluriel(source.aLaRacine, 'élément')} directement à la racine du dossier (pas dans un sous-dossier).`}</li>}
        {source.petitsDossiers > 0 && <li>{t`${pluriel(source.petitsDossiers, 'petit dossier', 'petits dossiers')} (1 ou 2 photos) : à rattacher ailleurs à l’étape suivante si besoin.`}</li>}
        {misDeCote.length > 0 && (
          <li>{t`${pluriel(misDeCote.length, 'élément mis de côté', 'éléments mis de côté')} (floues, doublons…) : comptés ci-dessus, ils iront dans « ${nomsSortie().misDeCote} ».`}</li>
        )}
        {inv.ignores.length > 0 && <li>{t`${pluriel(inv.ignores.length, 'fichier ignoré', 'fichiers ignorés')} : l’état d’un ancien projet (dossier « .album »).`}</li>}
        <li>{t`Les fichiers système masqués par le navigateur (comme « Thumbs.db ») ne sont pas vus : Windows les recrée.`}</li>
      </ul>

      <details class="avances">
        <summary>{t`Repartir de zéro`}</summary>
        <p class="discret">
          {t`Relit tout le dossier à trier comme au premier jour : l’arborescence, les noms, la sélection et l’album sont perdus. Pour ajouter des photos arrivées depuis, utilisez plutôt « Mettre à jour l’inventaire ».`}
        </p>
        <button type="button" class="danger" onClick={() => void refaire()}>
          {t`Refaire l’inventaire`}
        </button>
      </details>

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
