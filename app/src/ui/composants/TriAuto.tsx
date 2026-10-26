// Tri automatique par lieux et sorties (étape « Tri automatique », script 01) pour un dossier
// en vrac : trois questions (comment ranger, taille d'un même endroit, voyages)
// et deux réglages avancés, avec le résultat sous les yeux, calculé sur les
// photos à chaque changement (D87). « Ranger » demande ensuite les noms des
// lieux à OpenStreetMap, puis l'arborescence remplace le vrac dans le plan
// (annulable). Sans connexion, les lieux gardent des noms provisoires : le tri
// n'est jamais bloqué.

import { dossierMisDeCote, nomsSortie } from '../../lib/sortie';
import { useMemo, useRef, useState } from 'preact/hooks';
import { acceptablesSansVider, accepter, aEcarter, copiesEnAttente, groupesCopies } from '../../lib/groupesDoublons';
import { gardeSaPlace, RACINE, resumes, traitementDe, type DossierPlan, type FichierPlan, type Plan } from '../../lib/plan';
import { appliquerTri, arborescenceComplete, elementsATrier, grouper, modeTri, optionsDuMode, optionsDuProjet, separerSansDate, type ModeTri, type OptionsTri } from '../../lib/tri';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annuler, appliquer, changerEtape, configuration, evenements, journal, notifier, page, planifierEnregistrement, reglages, session, texteErreur, versionPlan, versionProjet } from '../etat';
import { aTraduire, t } from '../../lib/langue';
import { duree, nombre, pluriel } from '../format';
import { BarreProgression } from './Cadre';
import { confirmer } from './Dialogues';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { ApercuTri } from './ApercuTri';
import { useLieuxProposes } from './LieuxFrequents';

/** Les trois façons de ranger, et ce qu'elles donnent. */
const MODES: [ModeTri, string, string][] = [
  [
    'sortie',
    aTraduire('Par sortie (conseillé)'),
    aTraduire('Les jours passés au même endroit forment une sortie ; chaque nouvel endroit a la sienne. Une semaine au même hôtel donne un dossier. Pour en sortir une journée : « Nouveau dossier avec cette journée », à l’étape suivante.'),
  ],
  ['jour', aTraduire('Par jour'), aTraduire('Un dossier par endroit et par journée : des dossiers courts, utile pour un projet d’un seul voyage.')],
  ['mois', aTraduire('Par mois'), aTraduire('Un dossier par endroit et par mois, sans chercher les sorties : le plus rapide à parcourir.')],
];

/** Taille d'un « même endroit » : cinq crans plutôt que des kilomètres (D87). */
const CRANS: [number, string][] = [
  [0.5, aTraduire('une rue')],
  [1, aTraduire('un quartier')],
  [2, aTraduire('un village')],
  [5, aTraduire('une ville')],
  [10, aTraduire('une région')],
];

/** Cran le plus proche d'une distance (un ancien projet a pu en choisir une autre). */
const cranDe = (km: number) => CRANS.reduce((m, [v], i) => (Math.abs(Math.log(v / km)) < Math.abs(Math.log(CRANS[m][0] / km)) ? i : m), 0);

/** Dossiers proposés par le tri qui contiennent des photos ou des vidéos (un dossier vidé, par exemple de ses floues, ne compte pas). */
export function dossiersProposes(plan: Plan): DossierPlan[] {
  const r = resumes(plan);
  return [...plan.dossiers.values()].filter((d) => d.origine === 'tri' && r.get(d.id)!.photos + r.get(d.id)!.videos > 0);
}

/** Échec d'une requête à OpenStreetMap (pas de connexion, serveur indisponible) : le tri continue sans les noms. */
function erreurReseau(err: unknown): boolean {
  return !(err instanceof DOMException && err.name === 'AbortError');
}

/** Fichiers que le tri range : tout, sauf le contenu des dossiers qui gardent leur place et les captures d'écran. */
export function fichiersATrier(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter((f) => f.categorie !== 'autre' && !f.capture && !gardeSaPlace(plan, f.dossier));
}

/**
 * Fichiers pas encore rangés : à la racine ou dans un dossier « à trier » de la
 * source. Après un premier tri, ce sont les photos arrivées depuis (D63).
 */
export function fichiersARanger(plan: Plan): FichierPlan[] {
  return fichiersATrier(plan).filter((f) => f.dossier === RACINE || traitementDe(plan, f.dossier) === 'trier');
}

/**
 * Copies exactes pas encore écartées parmi les photos que le tri range (D85) :
 * sans cela, le tri range une seconde fois une photo déjà gardée ailleurs. Un
 * clic accepte la proposition de l'étape « Doublons » (annulable).
 */
export function CopiesAvantTri() {
  const s = session.value!;
  versionPlan.value;
  const copies = useCopiesExactes();
  if (!copies) return null;
  const fichier = (id: string) => s.plan.fichiers.get(id);
  // Jamais un groupe dont aucun exemplaire n'est choisi : ce choix-là attend d'être vu à l'étape Doublons (D101).
  const groupes = acceptablesSansVider(copiesEnAttente(groupesCopies(copies, fichier), new Set(fichiersATrier(s.plan).map((f) => f.id)), fichier), fichier);
  const n = groupes.reduce((a, g) => a + aEcarter(g, fichier).length, 0);
  if (!n) return null;
  const dejaTrie = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  const ecarter = () => {
    appliquer(accepter(s.plan, groupes));
    notifier(
      'ok',
      dejaTrie
        ? t`${pluriel(n, 'photo écartée', 'photos écartées')} → « ${dossierMisDeCote('doublons_exacts')} ». Rangez à nouveau : des dossiers ont pu se vider.`
        : t`${pluriel(n, 'photo écartée', 'photos écartées')} → « ${dossierMisDeCote('doublons_exacts')} »`,
      { libelle: t`Annuler`, faire: annuler },
    );
  };
  return (
    <div class="encart attention copies-avant-tri">
      <p>
        <strong>{t`Copies exactes pas encore écartées : ${nombre(n)}.`}</strong>{' '}
        {dejaTrie
          ? t`Ces photos existent déjà ailleurs dans votre dossier (proposition de l’étape « ${nomEtape(ETAPE.doublons)} », pas encore acceptée) : le tri les a rangées une seconde fois. Écartez-les, puis rangez à nouveau.`
          : t`Ces photos existent déjà ailleurs dans votre dossier (proposition de l’étape « ${nomEtape(ETAPE.doublons)} », pas encore acceptée). Écartez-les d’abord : sinon, le tri les rangera une seconde fois.`}
      </p>
      <p class="actions">
        <button type="button" class="principal" onClick={ecarter}>
          {t`Écarter ${pluriel(n, 'copie')}`}
        </button>
        <button type="button" onClick={() => allerEtape('doublons')}>
          {t`Les voir d’abord`}
        </button>
      </p>
    </div>
  );
}

export function TriAuto() {
  const s = session.value!;
  versionPlan.value;
  const config = configuration.value?.lecture?.config;
  const [o, setO] = useState<OptionsTri>(() => optionsDuProjet(s.projet.tri));
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const changer = (m: Partial<OptionsTri>) => setO({ ...o, ...m });
  const aTrier = fichiersATrier(s.plan);
  const dejaTrie = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  // Trier en plusieurs fois (D63) : après un premier tri, seules les photos arrivées depuis restent à ranger.
  const aRanger = dejaTrie ? fichiersARanger(s.plan) : aTrier;
  const lieux = config?.lieux_connus ?? [];
  const lieuxProposes = useLieuxProposes();
  const domicile = lieux.find((l) => l.domicile);
  const mode = modeTri(o);
  const cran = cranDe(o.rayonKm);
  // Calendrier : il ne sépare que dans les lieux connus, par sortie (D88).
  const evts = evenements.value;

  // Aperçu (D87) : le calcul du rangement, refait à chaque réglage (moins de 0,1 s pour une année),
  // avec les noms de lieux déjà connus ; les autres sont demandés à OpenStreetMap au moment de ranger.
  const elements = useMemo(() => elementsATrier(aTrier), [versionPlan.value]);
  const groupes = useMemo(() => grouper(elements.photos, lieux, o), [elements, lieux, o.rayonKm, o.lieuxConnus]);
  const apercu = useMemo(
    () =>
      arborescenceComplete(
        elements,
        groupes,
        new Map(groupes.groupes.map((gr) => [gr.index, s.geocodage.connu(gr.lat, gr.lon)?.nom ?? null])),
        o,
        evts,
      ),
    [groupes, o, evts],
  );
  const separes = apercu.filter((d) => d.evenement).length;
  // Les photos sans vraie date (`_sans_date`) n'ont pas de place sur la frise.
  const dates = useMemo(() => new Map(separerSansDate(aTrier).datees.map((f) => [f.id, f.date])), [versionPlan.value]);

  /** `nouvelles` : seulement les photos pas encore rangées, sans toucher aux dossiers déjà faits. */
  const calculer = async (nouvelles = false) => {
    if (
      dejaTrie &&
      !nouvelles &&
      !(await confirmer(t`Ranger à nouveau ?`, t`Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier rangement seront remplacés (Ctrl+Z annule).`, t`Ranger à nouveau`))
    )
      return;
    const liste = nouvelles ? aRanger : aTrier;
    const e = elementsATrier(liste);
    const g = grouper(e.photos, lieux, o);
    arreter.current = false;
    try {
      const manquants = s.geocodage.manquants(g.groupes);
      if (manquants) setProgres({ faits: 0, total: manquants });
      let noms: (string | null)[];
      let sansNoms = false;
      try {
        noms = await s.geocodage.nommer(g.groupes, reglages.value.emailNominatim, (faits, total) => setProgres({ faits, total }), () => arreter.current);
      } catch (err) {
        if (!erreurReseau(err)) throw err;
        // Hors ligne : les noms déjà connus (cache) sont gardés, les autres lieux s'appellent « Lieu_01 »…
        noms = g.groupes.map((gr) => s.geocodage.connu(gr.lat, gr.lon)?.nom ?? null);
        sansNoms = true;
        journal('tri', t`Noms des lieux indisponibles (OpenStreetMap) : ${texteErreur(err)}`);
      }
      const proposes = arborescenceComplete(e, g, new Map(g.groupes.map((gr, i) => [gr.index, noms[i]])), o, evenements.value);
      // Le géocodage a pu durer : seules les photos encore à trier maintenant sont rangées.
      const plan = session.value?.plan;
      if (plan !== s.plan) return;
      appliquer(appliquerTri(s.plan, proposes, new Set((nouvelles ? fichiersARanger(s.plan) : fichiersATrier(s.plan)).map((f) => f.id)), { garderAnciens: nouvelles }));
      s.projet.tri = { ...o };
      planifierEnregistrement();
      versionProjet.value++;
      changerEtape(ETAPE.tri, 'en_cours');
      // Même compte que le résumé de l'étape : un dossier vidé (photos écartées) ne compte pas.
      const n = nouvelles ? new Set(liste.map((f) => s.plan.fichiers.get(f.id)).filter((f) => f?.statut === 'archive').map((f) => f!.dossier)).size : dossiersProposes(s.plan).length;
      journal(
        'tri',
        nouvelles
          ? t`Tri des nouvelles photos : ${pluriel(liste.length, 'fichier rangé', 'fichiers rangés')} dans ${pluriel(n, 'dossier')}`
          : t`Tri par lieux : ${pluriel(n, 'dossier proposé', 'dossiers proposés')} pour ${pluriel(aTrier.length, 'fichier')}`,
        { options: o, groupes: g.groupes.length },
      );
      notifier(
        'ok',
        nouvelles
          ? t`${pluriel(liste.length, 'fichier rangé', 'fichiers rangés')} dans ${pluriel(n, 'dossier')} : vérifiez-les à l’étape suivante, « Lieux et sorties ».`
          : t`${pluriel(n, 'dossier proposé', 'dossiers proposés')} : vérifiez-les à l’étape suivante, « Lieux et sorties ».`,
      );
      if (sansNoms)
        notifier(
          'info',
          t`Noms des lieux indisponibles (OpenStreetMap injoignable) : les dossiers ont des noms provisoires (« ${nomsSortie().lieu}_01 »…). Renommez-les plus tard, ou rangez à nouveau une fois connecté.`,
        );
    } catch (err) {
      notifier('erreur', t`Tri interrompu : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
    }
  };

  const nombreCase = (cle: keyof OptionsTri, libelle: string, min: number, aide: string) => (
    <div class="option-tri" key={cle}>
      <label>
        {libelle}{' '}
        <input type="number" class="tres-court" min={min} step={1} value={o[cle] as number} onChange={(e) => changer({ [cle]: Math.max(min, Number(e.currentTarget.value) || min) })} />
      </label>
      <p class="aide-option">{aide}</p>
    </div>
  );
  const avances = [
    mode === 'sortie' &&
      nombreCase(
        'dureeMaxJours',
        t`Une sortie dure au plus (jours)`,
        1,
        t`Au même endroit, une nouvelle sortie commence au-delà de cette durée, ou après une semaine sans photo. Coupe en plusieurs sorties un lieu photographié très souvent, comme la maison.`,
      ),
    mode !== 'mois' && o.voyages && domicile && nombreCase('distanceVoyageKm', t`Un voyage commence à (km de la maison)`, 1, t`Une sortie plus loin que cette distance de la maison peut faire partie d’un voyage.`),
  ].filter(Boolean);
  // Pendant un rangement en plusieurs fois, l'aperçu montrerait tout rangé à nouveau : il attend « Tout ranger à nouveau ».
  const avecApercu = !(dejaTrie && aRanger.length > 0);

  return (
    <details class="tri-auto" open={!dejaTrie || aRanger.length > 0}>
      <summary>
        <strong>{t`Réglages du tri`}</strong> —{' '}
        {dejaTrie && aRanger.length
          ? pluriel(aRanger.length, 'nouveau fichier à ranger', 'nouveaux fichiers à ranger')
          : pluriel(aTrier.length, 'fichier à trier', 'fichiers à trier')}
        {dejaTrie && !aRanger.length ? t` (déjà rangés : vous pouvez ranger à nouveau avec d’autres réglages)` : ''}
      </summary>
      <div class="options-tri">
        <div class="option-tri">
          <strong>{t`Comment ranger ?`}</strong>
          <div class="choix-segmente choix-tri" role="radiogroup" aria-label={t`Comment ranger ?`}>
            {MODES.map(([v, libelle]) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => changer(optionsDuMode(v))}>
                {t(libelle)}
              </button>
            ))}
          </div>
          <p class="aide-option">{t(MODES.find(([v]) => v === mode)![2])}</p>
        </div>
        <div class="option-tri">
          <strong>{t`Deux photos sont au même endroit si elles sont dans…`}</strong>
          <div class="choix-segmente choix-tri" role="radiogroup" aria-label={t`Taille d’un même endroit`}>
            {CRANS.map(([km, nom], i) => (
              <button key={km} type="button" role="radio" aria-checked={cran === i} title={t`À moins de ${nombre(km, 1)} km l’une de l’autre`} onClick={() => changer({ rayonKm: km })}>
                {t(nom)}
              </button>
            ))}
          </div>
          <p class="aide-option">
            {t`Avec vos photos : ${pluriel(groupes.groupes.length, 'endroit', 'endroits')}, hors des lieux connus. Deux photos à moins de ${nombre(o.rayonKm, 1)} km l’une de l’autre vont au même endroit, de proche en proche.`}
          </p>
        </div>
        {mode !== 'mois' && (
          <div class="option-tri">
            <label class="case">
              <input type="checkbox" checked={o.voyages} onChange={(e) => changer({ voyages: e.currentTarget.checked })} /> <strong>{t`Réunir les étapes d’un voyage`}</strong>
            </label>
            <p class="aide-option">
              {t`Les sorties à plus de ${nombre(o.distanceVoyageKm)} km de la maison qui s’enchaînent, sans retour entre-temps, vont dans un dossier « ${nomsSortie().voyage}_… », avec une étape par lieu.`}
              {!domicile &&
                (lieuxProposes ? (
                  <strong> {t`Sans effet pour l’instant : cochez « C’est notre domicile » sur un lieu ci-dessus, ou indiquez-le dans la Configuration.`}</strong>
                ) : (
                  <>
                    <strong> {t`Sans effet pour l’instant : aucun domicile n’est enregistré.`}</strong>{' '}
                    <button type="button" class="lien" onClick={() => (page.value = { nom: 'configuration' })}>
                      {t`Indiquer le domicile dans la Configuration`}
                    </button>
                  </>
                ))}
            </p>
          </div>
        )}
        {mode === 'sortie' && lieux.length > 0 && (
          <div class="option-tri">
            <label class="case">
              <input type="checkbox" checked={o.calendrierLieuxConnus && evts.length > 0} disabled={!evts.length} onChange={(e) => changer({ calendrierLieuxConnus: e.currentTarget.checked })} />{' '}
              <strong>{t`À la maison et dans vos lieux connus, séparer les événements du calendrier (Noël, anniversaires…)`}</strong>
            </label>
            <p class="aide-option">
              {t`Plus de 3 jours au même endroit sont coupés autour des événements de votre calendrier pendant lesquels au moins 5 photos ont été prises. Les dossiers gardent un nom fait de dates : vous choisirez leur nom au Nommage.`}{' '}
              {evts.length ? (
                <strong>{o.calendrierLieuxConnus ? t`Avec vos photos : ${pluriel(separes, 'sous-dossier séparé', 'sous-dossiers séparés')}.` : ''}</strong>
              ) : (
                <>
                  <strong>{t`Aucun calendrier pour l’instant.`}</strong>{' '}
                  <button type="button" class="lien" onClick={() => (page.value = { nom: 'configuration' })}>
                    {t`Ajouter un calendrier dans la Configuration`}
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </div>
      {avances.length > 0 && (
        <details class="avances">
          <summary>{t`Réglages avancés`}</summary>
          <div class="options-tri">{avances}</div>
        </details>
      )}
      {avecApercu && aTrier.length > 0 && <ApercuTri dossiers={apercu} dates={dates} domicile={domicile?.nom} />}
      {progres ? (
        <div class="encart">
          <BarreProgression faits={progres.faits} total={progres.total} texte={t`Noms des lieux (OpenStreetMap) : ${progres.faits} / ${progres.total} — encore ${duree((progres.total - progres.faits) * 1200)}`} />
          <button type="button" onClick={() => (arreter.current = true)}>
            {t`Arrêter (les noms déjà reçus sont gardés)`}
          </button>
        </div>
      ) : (
        <p class="actions">
          {dejaTrie && aRanger.length > 0 ? (
            <>
              <button type="button" class="principal" onClick={() => void calculer(true)} title={t`Range seulement les photos arrivées depuis le dernier tri : les dossiers déjà faits ne bougent pas.`}>
                {t`Ranger les ${pluriel(aRanger.length, 'nouvelle photo', 'nouvelles photos')}`}
              </button>
              <button type="button" onClick={() => void calculer()}>
                {t`Tout ranger à nouveau`}
              </button>
            </>
          ) : (
            <button type="button" class="principal" disabled={!aTrier.length} onClick={() => void calculer()}>
              {dejaTrie ? t`Ranger à nouveau dans ces ${pluriel(apercu.length, 'dossier')}` : t`Ranger les photos dans ces ${pluriel(apercu.length, 'dossier')}`}
            </button>
          )}
          <span class="discret">{t`Ensuite, les noms des endroits sont demandés à OpenStreetMap (Nominatim) : seules les coordonnées moyennes de chaque endroit sont envoyées, une par seconde.`}</span>
        </p>
      )}
    </details>
  );
}
