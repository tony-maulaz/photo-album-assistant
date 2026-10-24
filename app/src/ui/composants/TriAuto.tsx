// Tri automatique par lieux et sorties (étape « Tri automatique », script 01) pour un dossier
// en vrac : réglages simples et avancés, noms des lieux par OpenStreetMap,
// puis l'arborescence proposée remplace le vrac dans le plan (annulable). Sans
// connexion, les lieux gardent des noms provisoires : le tri n'est jamais bloqué.

import { nomsSortie } from '../../lib/sortie';
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { gardeSaPlace, RACINE, resumes, traitementDe, type DossierPlan, type FichierPlan, type Plan } from '../../lib/plan';
import { arborescence, avecSansDate, grouper, OPTIONS_TRI_DEFAUT, optionsDepuisPrereglage, rangerVideos, appliquerTri, separerSansDate, type OptionsTri, type PhotoTri } from '../../lib/tri';
import { appliquer, changerEtape, configuration, journal, notifier, page, planifierEnregistrement, reglages, session, texteErreur, versionProjet } from '../etat';
import { t } from '../../lib/langue';
import { duree, nombre, pluriel } from '../format';
import { BarreProgression } from './Cadre';
import { confirmer } from './Dialogues';
import { ETAPE } from '../../navigateur/projet';
import { useLieuxProposes } from './LieuxFrequents';

/**
 * Réglages de départ (D58 : plus de menu de préréglage). Ceux de config.json
 * ne se modifient plus et ne sont plus lus ; « voyage » reste pour les projets
 * créés quand on pouvait le choisir.
 */
const PREREGLAGES: Record<string, unknown> = {
  annee: { rayon_km: 2, par_jour: false, voyages: true, lieux_connus: true },
  voyage: { rayon_km: 2, par_jour: true, voyages: false, lieux_connus: false },
};

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

export function TriAuto() {
  const s = session.value!;
  const config = configuration.value?.lecture?.config;
  const depuis = (nom: string): OptionsTri => ({ ...OPTIONS_TRI_DEFAUT, ...optionsDepuisPrereglage(PREREGLAGES[nom] ?? PREREGLAGES.annee) });
  // Plus de choix de préréglage à l'écran (D58) : les réglages « Année » servent de départ, chaque option est expliquée.
  const prereglage = s.projet.prereglage || 'annee';
  const [o, setO] = useState<OptionsTri>(() => ({ ...depuis(prereglage), ...(s.projet.tri as Partial<OptionsTri> | undefined) }));
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const changer = (m: Partial<OptionsTri>) => setO({ ...o, ...m });
  const aTrier = fichiersATrier(s.plan);
  const dejaTrie = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  // Trier en plusieurs fois (D63) : après un premier tri, seules les photos arrivées depuis restent à ranger.
  const aRanger = dejaTrie ? fichiersARanger(s.plan) : aTrier;
  const lieux = config?.lieux_connus ?? [];
  const lieuxProposes = useLieuxProposes();

  /** `nouvelles` : seulement les photos pas encore rangées, sans toucher aux dossiers déjà faits. */
  const calculer = async (nouvelles = false) => {
    if (
      dejaTrie &&
      !nouvelles &&
      !(await confirmer(t`Recalculer l’arborescence ?`, t`Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier calcul seront remplacés (Ctrl+Z annule).`, t`Recalculer`))
    )
      return;
    const liste = nouvelles ? aRanger : aTrier;
    // Sans vraie date, une photo ne peut pas être rangée dans une sortie : elle va dans « _sans_date ».
    const { datees, sansDate } = separerSansDate(liste);
    const photos: PhotoTri[] = datees.filter((f) => f.categorie === 'photo').map((f) => ({ id: f.id, nom: f.id.split('/').pop()!, date: f.date, gps: f.gps }));
    photos.sort((a, b) => a.id.localeCompare(b.id));
    const g = grouper(photos, lieux, o);
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
      const proposes = arborescence(g, new Map(g.groupes.map((gr, i) => [gr.index, noms[i]])), o);
      const dates = new Map(photos.map((p) => [p.id, p.date]));
      const avecVideos = avecSansDate(
        rangerVideos(
          proposes,
          dates,
          datees.filter((f) => f.categorie === 'video').map((f) => ({ id: f.id, date: f.date })),
        ),
        sansDate.map((f) => f.id),
      );
      // Le géocodage a pu durer : seules les photos encore à trier maintenant sont rangées.
      const plan = session.value?.plan;
      if (plan !== s.plan) return;
      appliquer(appliquerTri(s.plan, avecVideos, new Set((nouvelles ? fichiersARanger(s.plan) : fichiersATrier(s.plan)).map((f) => f.id)), { garderAnciens: nouvelles }));
      s.projet.prereglage = prereglage;
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
          t`Noms des lieux indisponibles (OpenStreetMap injoignable) : les dossiers ont des noms provisoires (« ${nomsSortie().lieu}_01 »…). Renommez-les plus tard, ou recalculez une fois connecté.`,
        );
    } catch (err) {
      notifier('erreur', t`Tri interrompu : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
    }
  };

  const domicile = lieux.some((l) => l.domicile);
  const nombreCase = (cle: keyof OptionsTri, libelle: string, min: number, pas: number, aide: string) => (
    <div class="option-tri">
      <label>
        {libelle}{' '}
        <input type="number" class="tres-court" min={min} step={pas} value={o[cle] as number} onChange={(e) => changer({ [cle]: Math.max(min, Number(e.currentTarget.value) || min) })} />
      </label>
      <p class="aide-option">{aide}</p>
    </div>
  );
  const caseACocher = (cle: keyof OptionsTri, libelle: string, aide: ComponentChildren) => (
    <div class="option-tri">
      <label class="case">
        <input type="checkbox" checked={o[cle] as boolean} onChange={(e) => changer({ [cle]: e.currentTarget.checked })} /> <strong>{libelle}</strong>
      </label>
      <p class="aide-option">{aide}</p>
    </div>
  );

  return (
    <details class="tri-auto" open={!dejaTrie || aRanger.length > 0}>
      <summary>
        <strong>{t`Réglages du tri`}</strong> —{' '}
        {dejaTrie && aRanger.length
          ? pluriel(aRanger.length, 'nouveau fichier à ranger', 'nouveaux fichiers à ranger')
          : pluriel(aTrier.length, 'fichier à trier', 'fichiers à trier')}
        {dejaTrie && !aRanger.length ? t` (déjà calculé : vous pouvez recalculer avec d’autres réglages)` : ''}
      </summary>
      <div class="options-tri">
        <div class="option-tri">
          <label>
            <strong>{t`Précision des lieux : ${nombre(o.rayonKm, 1)} km`}</strong>
            <input type="range" min="0.2" max="20" step="0.2" value={o.rayonKm} onInput={(e) => changer({ rayonKm: Number(e.currentTarget.value) })} />
          </label>
          <p class="aide-option">
            {t`Deux photos prises à moins de ${nombre(o.rayonKm, 1)} km l’une de l’autre vont dans le même lieu. Plus petit : un dossier par quartier ; plus grand : un dossier par ville ou par région.`}
          </p>
        </div>
        {caseACocher(
          'parJour',
          t`Un dossier par jour`,
          t`Décoché (conseillé, même pour des vacances) : les jours passés au même endroit forment une seule sortie, et chaque nouvel endroit a la sienne ; une semaine au même hôtel donne un dossier. Coché : un dossier pour chaque jour, même sans changer d’endroit.`,
        )}
        {caseACocher(
          'voyages',
          t`Regrouper les voyages`,
          <>
            {t`Les sorties loin de chez vous qui s’enchaînent sans retour à la maison sont réunies dans un dossier « ${nomsSortie().voyage}_… », avec une sortie par étape.`}
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
          </>,
        )}
        {caseACocher(
          'lieuxConnus',
          t`Utiliser les lieux connus (${lieux.length})`,
          t`Les photos prises dans un lieu enregistré (maison, grands-parents, école, club…) vont dans le dossier de ce lieu, rangées par sortie. Les lieux se définissent dans la Configuration, ou ci-dessus parmi les lieux fréquents.`,
        )}
      </div>
      <details class="avances">
        <summary>{t`Réglages avancés`}</summary>
        <div class="options-tri">
          {nombreCase('gapJours', t`Nouvelle sortie après (jours sans photo)`, 1, 1, t`Au même lieu, si plus de jours passent sans photo, une nouvelle sortie commence.`)}
          {nombreCase('dureeMaxJours', t`Durée maximale d’une sortie (jours)`, 1, 1, t`Coupe en plusieurs sorties un lieu photographié très souvent, comme la maison.`)}
          {caseACocher('parMois', t`Un dossier par mois`, t`Un dossier par lieu et par mois (${nomsSortie().lieu}_MM.AA), sans chercher les sorties.`)}
          {caseACocher('sansEvenement', t`Un seul dossier par lieu`, t`Toutes les photos d’un lieu ensemble, sans découpage en sorties ni date.`)}
          {nombreCase('distanceVoyageKm', t`Voyage au-delà de (km du domicile)`, 1, 1, t`Une sortie plus loin que cette distance de la maison compte comme un voyage.`)}
          {nombreCase('gapVoyage', t`Étapes d’un voyage : écart maximal (jours)`, 0, 1, t`Deux sorties lointaines séparées de plus de jours que cela forment deux voyages.`)}
          {nombreCase('gapVoyageMax', t`Écart toléré sans retour au domicile (jours)`, 0, 1, t`Jours sans photo acceptés au milieu d’un voyage, tant qu’aucune photo n’est prise à la maison.`)}
          {caseACocher('nomsFichiers', t`Utiliser les noms de fichiers parlants`, t`« Anniversaire Lea.jpg » donne son nom à la sortie.`)}
        </div>
      </details>
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
                {t`Tout recalculer`}
              </button>
            </>
          ) : (
            <button type="button" class="principal" disabled={!aTrier.length} onClick={() => void calculer()}>
              {dejaTrie ? t`Recalculer l’arborescence` : t`Calculer l’arborescence`}
            </button>
          )}
          <span class="discret">{t`Les coordonnées moyennes de chaque lieu sont envoyées à OpenStreetMap (Nominatim) pour le nommer, une par seconde ; rien d’autre.`}</span>
        </p>
      )}
    </details>
  );
}
