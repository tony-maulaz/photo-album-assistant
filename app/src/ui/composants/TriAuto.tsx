// Tri automatique par lieux et sorties (étape « Tri automatique », script 01) pour un dossier
// en vrac : réglages simples et avancés, noms des lieux par OpenStreetMap,
// puis l'arborescence proposée remplace le vrac dans le plan (annulable).

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

const PREREGLAGES: Record<string, string> = { annee: 'Année', voyage: 'Voyage' };

export function TriAuto() {
  const s = session.value!;
  const config = configuration.value?.lecture?.config;
  const prereglages = config?.prereglages ?? { annee: { rayon_km: 2, par_jour: false, voyages: true, lieux_connus: true }, voyage: { rayon_km: 2, par_jour: true, voyages: false, lieux_connus: false } };
  const depuis = (nom: string): OptionsTri => ({ ...OPTIONS_TRI_DEFAUT, ...optionsDepuisPrereglage(prereglages[nom]) });
  const [prereglage, setPrereglage] = useState(s.projet.prereglage || 'annee');
  const [o, setO] = useState<OptionsTri>(() => ({ ...depuis(s.projet.prereglage || 'annee'), ...(s.projet.tri as Partial<OptionsTri> | undefined) }));
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

  const nombreCase = (cle: keyof OptionsTri, libelle: string, min: number, pas: number, aide: string) => (
    <label title={aide}>
      {libelle}{' '}
      <input type="number" class="tres-court" min={min} step={pas} value={o[cle] as number} onChange={(e) => changer({ [cle]: Math.max(min, Number(e.currentTarget.value) || min) })} />
    </label>
  );
  const caseACocher = (cle: keyof OptionsTri, libelle: string, aide: string) => (
    <label class="case" title={aide}>
      <input type="checkbox" checked={o[cle] as boolean} onChange={(e) => changer({ [cle]: e.currentTarget.checked })} /> {libelle}
    </label>
  );

  return (
    <details class="tri-auto" open={!dejaTrie}>
      <summary>
        <strong>Tri automatique par lieux et sorties</strong> — {pluriel(aTrier.length, 'fichier à trier', 'fichiers à trier')}
        {dejaTrie ? ' (déjà calculé : vous pouvez recalculer avec d’autres réglages)' : ''}
      </summary>
      <div class="reglages-etape ligne">
        <label>
          Préréglage{' '}
          <select
            value={prereglage}
            onChange={(e) => {
              setPrereglage(e.currentTarget.value);
              setO(depuis(e.currentTarget.value));
            }}
          >
            {Object.keys(prereglages).map((p) => (
              <option key={p} value={p}>
                {PREREGLAGES[p] ?? p}
              </option>
            ))}
          </select>
        </label>
        <label title="Deux photos à moins de cette distance appartiennent au même lieu">
          Précision des lieux : {nombre(o.rayonKm, 1)} km
          <input type="range" min="0.2" max="20" step="0.2" value={o.rayonKm} onInput={(e) => changer({ rayonKm: Number(e.currentTarget.value) })} />
        </label>
        {caseACocher('parJour', 'Un dossier par jour', 'Un séjour de 4 jours au même endroit donne 4 dossiers datés (conseillé pour un voyage)')}
        {caseACocher('voyages', 'Détecter les voyages', 'Les sorties loin du domicile qui s’enchaînent sont regroupées dans un dossier « Voyage_… »')}
        {caseACocher('lieuxConnus', `Utiliser les lieux connus (${lieux.length})`, 'Maison, grands-parents, école… (page Configuration)')}
      </div>
      <details class="avances">
        <summary>Réglages avancés</summary>
        <div class="reglages-etape ligne">
          {nombreCase('gapJours', 'Nouvelle sortie après (jours sans photo)', 1, 1, 'Au même lieu, un écart plus long ouvre une nouvelle sortie (script 01 : 30)')}
          {nombreCase('dureeMaxJours', 'Durée maximale d’une sortie (jours)', 1, 1, 'Évite qu’un lieu photographié souvent forme une seule sortie (script 01 : 21)')}
          {caseACocher('parMois', 'Un dossier par mois', 'Lieu_AAAA-MM, découpage strictement calendaire')}
          {caseACocher('sansEvenement', 'Un seul dossier par lieu', 'Sans découpage en sorties ni date')}
          {nombreCase('distanceVoyageKm', 'Voyage au-delà de (km du domicile)', 1, 1, 'Script 01 : 30 km')}
          {nombreCase('gapVoyage', 'Étapes d’un voyage : écart maximal (jours)', 0, 1, 'Script 01 : 1')}
          {nombreCase('gapVoyageMax', 'Écart toléré sans retour au domicile (jours)', 0, 1, 'Script 01 : 7')}
          {caseACocher('nomsFichiers', 'Utiliser les noms de fichiers parlants', '« Anniversaire Lea.jpg » nomme la sortie')}
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
