// Tri automatique par lieux et sorties (étape « Tri automatique », script 01) pour un dossier
// en vrac : réglages simples et avancés, noms des lieux par OpenStreetMap,
// puis l'arborescence proposée remplace le vrac dans le plan (annulable).

import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { traitementDe, type FichierPlan, type Plan } from '../../lib/plan';
import { arborescence, avecSansDate, grouper, OPTIONS_TRI_DEFAUT, optionsDepuisPrereglage, rangerVideos, appliquerTri, separerSansDate, type OptionsTri, type PhotoTri } from '../../lib/tri';
import { appliquer, changerEtape, configuration, journal, notifier, planifierEnregistrement, reglages, session, texteErreur, versionProjet } from '../etat';
import { duree, nombre, pluriel } from '../format';
import { BarreProgression } from './Cadre';
import { confirmer } from './Dialogues';
import { ETAPE } from '../../navigateur/projet';

/** Fichiers que le tri range : tout, sauf le contenu des dossiers gardés tels quels et les captures d'écran. */
export function fichiersATrier(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter((f) => f.categorie !== 'autre' && !f.capture && !['garder', 'ignorer'].includes(traitementDe(plan, f.dossier) ?? ''));
}

export function TriAuto() {
  const s = session.value!;
  const config = configuration.value?.lecture?.config;
  const prereglages = config?.prereglages ?? { annee: { rayon_km: 2, par_jour: false, voyages: true, lieux_connus: true }, voyage: { rayon_km: 2, par_jour: true, voyages: false, lieux_connus: false } };
  const depuis = (nom: string): OptionsTri => ({ ...OPTIONS_TRI_DEFAUT, ...optionsDepuisPrereglage(prereglages[nom]) });
  // Plus de choix de préréglage à l'écran (D58) : les réglages « Année » servent de départ, chaque option est expliquée.
  const prereglage = s.projet.prereglage || 'annee';
  const [o, setO] = useState<OptionsTri>(() => ({ ...depuis(prereglage), ...(s.projet.tri as Partial<OptionsTri> | undefined) }));
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const changer = (m: Partial<OptionsTri>) => setO({ ...o, ...m });
  const aTrier = fichiersATrier(s.plan);
  const dejaTrie = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  const lieux = config?.lieux_connus ?? [];

  const calculer = async () => {
    if (dejaTrie && !(await confirmer('Recalculer l’arborescence ?', 'Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier calcul seront remplacés (Ctrl+Z annule).', 'Recalculer')))
      return;
    // Sans vraie date, une photo ne peut pas être rangée dans une sortie : elle va dans « _sans_date ».
    const { datees, sansDate } = separerSansDate(aTrier);
    const photos: PhotoTri[] = datees.filter((f) => f.categorie === 'photo').map((f) => ({ id: f.id, nom: f.id.split('/').pop()!, date: f.date, gps: f.gps }));
    photos.sort((a, b) => a.id.localeCompare(b.id));
    const g = grouper(photos, lieux, o);
    arreter.current = false;
    try {
      const manquants = s.geocodage.manquants(g.groupes);
      if (manquants) setProgres({ faits: 0, total: manquants });
      const noms = await s.geocodage.nommer(g.groupes, reglages.value.emailNominatim, (faits, total) => setProgres({ faits, total }), () => arreter.current);
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
      appliquer(appliquerTri(s.plan, avecVideos, new Set(fichiersATrier(s.plan).map((f) => f.id))));
      s.projet.prereglage = prereglage;
      s.projet.tri = { ...o };
      planifierEnregistrement();
      versionProjet.value++;
      changerEtape(ETAPE.tri, 'en_cours');
      const n = avecVideos.length;
      journal('tri', `Tri par lieux : ${n} dossiers proposés pour ${aTrier.length} fichiers`, { options: o, groupes: g.groupes.length });
      notifier('ok', `${pluriel(n, 'dossier proposé', 'dossiers proposés')} : vérifiez-les à l’étape suivante, « Lieux et sorties ».`);
    } catch (err) {
      notifier('erreur', `Tri interrompu : ${texteErreur(err)}`);
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
    <details class="tri-auto" open={!dejaTrie}>
      <summary>
        <strong>Réglages du tri</strong> — {pluriel(aTrier.length, 'fichier à trier', 'fichiers à trier')}
        {dejaTrie ? ' (déjà calculé : vous pouvez recalculer avec d’autres réglages)' : ''}
      </summary>
      <div class="options-tri">
        <div class="option-tri">
          <label>
            <strong>Précision des lieux : {nombre(o.rayonKm, 1)} km</strong>
            <input type="range" min="0.2" max="20" step="0.2" value={o.rayonKm} onInput={(e) => changer({ rayonKm: Number(e.currentTarget.value) })} />
          </label>
          <p class="aide-option">
            Deux photos prises à moins de {nombre(o.rayonKm, 1)} km l’une de l’autre vont dans le même lieu. Plus petit : un dossier par quartier ; plus grand : un
            dossier par ville ou par région.
          </p>
        </div>
        {caseACocher(
          'parJour',
          'Un dossier par jour',
          'Coché : un séjour de 4 jours au même endroit donne 4 dossiers, un par jour (pratique pour un voyage). Décoché : les jours qui se suivent au même endroit forment une seule sortie (pratique pour une année).',
        )}
        {caseACocher(
          'voyages',
          'Regrouper les voyages',
          <>
            Les sorties loin de chez vous qui s’enchaînent sans retour à la maison sont réunies dans un dossier « Voyage_… », avec une sortie par étape.
            {!domicile && <strong> Sans effet pour l’instant : cochez « C’est notre domicile » sur un lieu ci-dessus, ou indiquez-le dans la Configuration.</strong>}
          </>,
        )}
        {caseACocher(
          'lieuxConnus',
          `Utiliser les lieux connus (${lieux.length})`,
          'Les photos prises dans un lieu enregistré (maison, grands-parents, école, club…) vont dans le dossier de ce lieu, rangées par sortie. Les lieux se définissent dans la Configuration, ou ci-dessus parmi les lieux fréquents.',
        )}
      </div>
      <details class="avances">
        <summary>Réglages avancés</summary>
        <div class="options-tri">
          {nombreCase('gapJours', 'Nouvelle sortie après (jours sans photo)', 1, 1, 'Au même lieu, si plus de jours passent sans photo, une nouvelle sortie commence.')}
          {nombreCase('dureeMaxJours', 'Durée maximale d’une sortie (jours)', 1, 1, 'Coupe en plusieurs sorties un lieu photographié très souvent, comme la maison.')}
          {caseACocher('parMois', 'Un dossier par mois', 'Un dossier par lieu et par mois (Lieu_AAAA-MM), sans chercher les sorties.')}
          {caseACocher('sansEvenement', 'Un seul dossier par lieu', 'Toutes les photos d’un lieu ensemble, sans découpage en sorties ni date.')}
          {nombreCase('distanceVoyageKm', 'Voyage au-delà de (km du domicile)', 1, 1, 'Une sortie plus loin que cette distance de la maison compte comme un voyage.')}
          {nombreCase('gapVoyage', 'Étapes d’un voyage : écart maximal (jours)', 0, 1, 'Deux sorties lointaines séparées de plus de jours que cela forment deux voyages.')}
          {nombreCase('gapVoyageMax', 'Écart toléré sans retour au domicile (jours)', 0, 1, 'Jours sans photo acceptés au milieu d’un voyage, tant qu’aucune photo n’est prise à la maison.')}
          {caseACocher('nomsFichiers', 'Utiliser les noms de fichiers parlants', '« Anniversaire Lea.jpg » donne son nom à la sortie.')}
        </div>
      </details>
      {progres ? (
        <div class="encart">
          <BarreProgression faits={progres.faits} total={progres.total} texte={`Noms des lieux (OpenStreetMap) : ${progres.faits} / ${progres.total} — encore ${duree((progres.total - progres.faits) * 1200)}`} />
          <button type="button" onClick={() => (arreter.current = true)}>
            Arrêter (les noms déjà reçus sont gardés)
          </button>
        </div>
      ) : (
        <p class="actions">
          <button type="button" class="principal" disabled={!aTrier.length} onClick={() => void calculer()}>
            {dejaTrie ? 'Recalculer l’arborescence' : 'Calculer l’arborescence'}
          </button>
          <span class="discret">Les coordonnées moyennes de chaque lieu sont envoyées à OpenStreetMap (Nominatim) pour le nommer, une par seconde ; rien d’autre.</span>
        </p>
      )}
    </details>
  );
}
