// Tri automatique d'un dossier en vrac (étape « Tri automatique », D103) : une
// liste « À faire » où chaque ligne dit son état — ● à faire, ✓ fait,
// ○ facultatif — la maison, les copies et les captures à mettre de côté, les
// lieux qui reviennent souvent, puis « Ranger les photos » avec une seule
// question (un voyage par étapes ou en un seul dossier). Le rangement suit
// l'ordre du temps (lib/tri.ts), demande les noms des lieux à OpenStreetMap,
// puis l'arborescence remplace le vrac dans le plan (annulable). Sans
// connexion, les lieux gardent des noms provisoires : le tri n'est jamais
// bloqué. Le résultat se voit dessous, en cartes (ResultatTri).

import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import type { LieuConnu } from '../../lib/config';
import { acceptablesSansVider, accepter, aEcarter, copiesEnAttente, groupesCopies } from '../../lib/groupesDoublons';
import { rangerCaptures } from '../../lib/inventaire';
import { t } from '../../lib/langue';
import { gardeSaPlace, RACINE, resumes, traitementDe, type DossierPlan, type FichierPlan, type Plan } from '../../lib/plan';
import { dossierMisDeCote, nomsSortie } from '../../lib/sortie';
import { appliquerTri, arborescenceComplete, decouper, elementsATrier, optionsDuProjet, pointsANommer, type DossierPropose, type OptionsTri } from '../../lib/tri';
import { ETAPE } from '../../navigateur/projet';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annuler, appliquer, changerEtape, configuration, evenements, journal, notifier, page, planifierEnregistrement, reglages, session, texteErreur, versionPlan, versionProjet } from '../etat';
import { duree, pluriel } from '../format';
import { nombreSansGps } from './AidesTri';
import { BarreProgression } from './Cadre';
import { Captures, capturesProposees } from './Captures';
import { confirmer } from './Dialogues';
import { LieuxFrequents, useLieuxProposes } from './LieuxFrequents';
import { montrerOnglet } from './ResultatTri';

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

/** Ce que la page sait avant de dessiner la liste « À faire » et la barre du bas. */
export interface EtatTri {
  lieux: LieuConnu[];
  domicile?: LieuConnu;
  /** Groupes de copies exactes acceptables d'un clic (D85, D101) et le nombre de copies qu'ils mettent de côté. */
  copies: ReturnType<typeof acceptablesSansVider>;
  nCopies: number;
  /** Captures d'écran proposées parmi les photos à trier, et celles déjà mises à part. */
  captures: FichierPlan[];
  capturesRangees: number;
  aTrier: FichierPlan[];
  /** Après un premier tri, les photos arrivées depuis (D63) ; sinon toutes les photos à trier. */
  aRanger: FichierPlan[];
  /** Les photos ont déjà été rangées une fois. */
  range: boolean;
  lieuxProposes: boolean;
}

export function useEtatTri(): EtatTri {
  const s = session.value!;
  versionPlan.value;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? [];
  const exactes = useCopiesExactes();
  const lieuxProposes = useLieuxProposes();
  const aTrier = fichiersATrier(s.plan);
  const range = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  const fichier = (id: string) => s.plan.fichiers.get(id);
  // Jamais un groupe dont aucun exemplaire n'est choisi : ce choix-là attend d'être vu à l'étape Doublons (D101).
  const copies = exactes ? acceptablesSansVider(copiesEnAttente(groupesCopies(exactes, fichier), new Set(aTrier.map((f) => f.id)), fichier), fichier) : [];
  return {
    lieux,
    domicile: lieux.find((l) => l.domicile),
    copies,
    nCopies: copies.reduce((a, g) => a + aEcarter(g, fichier).length, 0),
    captures: capturesProposees(s),
    capturesRangees: [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && f.capture).length,
    aTrier,
    aRanger: range ? fichiersARanger(s.plan) : aTrier,
    range,
    lieuxProposes,
  };
}

/** Ce qui reste à faire sur la page, pour la barre du bas (« Encore 2 choses à faire : … »). */
export function restantsTri(e: EtatTri): string[] {
  const r: string[] = [];
  if (!e.domicile) r.push(t`indiquer votre maison`);
  if (e.nCopies) r.push(t`mettre ${pluriel(e.nCopies, 'copie')} de côté`);
  if (e.captures.length) r.push(t`les captures d’écran`);
  if (!e.range) r.push(t`ranger les photos`);
  else if (e.aRanger.length) r.push(t`ranger ${pluriel(e.aRanger.length, 'nouvelle photo', 'nouvelles photos')}`);
  return r;
}

type EtatLigne = 'afaire' | 'fait' | 'facultatif';

/** Une ligne de la liste « À faire » : sa puce, ce qu'elle dit, ses boutons, et ce qui s'ouvre dessous. */
function Ligne({ etat, titre, detail, note, boutons, panneau, classe = '' }: { etat: EtatLigne; titre: ComponentChildren; detail?: ComponentChildren; note?: string; boutons?: ComponentChildren; panneau?: ComponentChildren; classe?: string }) {
  const puce = { afaire: '●', fait: '✓', facultatif: '○' }[etat];
  const etiquette = { afaire: t`À faire`, fait: t`Fait`, facultatif: t`Facultatif` }[etat];
  return (
    <li class={`ligne-afaire ${etat} ${classe}`}>
      <span class="puce-afaire" title={etiquette} aria-label={etiquette}>
        {puce}
      </span>
      <div class="texte-afaire">
        <strong>{titre}</strong>
        {detail && <div class="detail-afaire">{detail}</div>}
        {note && <span class="note-afaire">{note}</span>}
      </div>
      {boutons && <div class="boutons-afaire">{boutons}</div>}
      {panneau && <div class="panneau-afaire">{panneau}</div>}
    </li>
  );
}

/** Voyages, sorties et dossiers de la maison d'une arborescence proposée. */
function compter(dossiers: DossierPropose[]) {
  return {
    voyages: new Set(dossiers.filter((d) => d.sorte === 'voyage').map((d) => d.chemin[0])).size,
    sorties: dossiers.filter((d) => d.sorte === 'sortie').length,
    maison: dossiers.filter((d) => d.sorte === 'maison').length,
    dossiers: dossiers.length,
  };
}

export function TriAuto({ e }: { e: EtatTri }) {
  const s = session.value!;
  versionPlan.value;
  const [o, setO] = useState<OptionsTri>(() => optionsDuProjet(s.projet.tri));
  const [panneau, setPanneau] = useState<'maison' | 'captures' | 'lieux' | null>(null);
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const changer = (m: Partial<OptionsTri>) => setO({ ...o, ...m });
  const basculer = (p: typeof panneau) => setPanneau(panneau === p ? null : p);
  const evts = evenements.value;

  // Ce que donnerait le rangement, recalculé à chaque réglage (bien moins d'une seconde pour une année),
  // avec les noms de lieux déjà connus ; les autres sont demandés à OpenStreetMap au moment de ranger.
  const elements = useMemo(() => elementsATrier(e.aTrier), [versionPlan.value]);
  const decoupage = useMemo(() => decouper(elements.photos, e.lieux, o), [elements, e.lieux, o]);
  const apercu = useMemo(() => arborescenceComplete(elements, decoupage, (lat, lon) => s.geocodage.connu(lat, lon)?.nom ?? null, o, evts), [decoupage, o, evts]);
  const n = compter(apercu);
  // Même compte que la barre du bas : les photos des dossiers du tri qui en contiennent encore.
  const proposes = dossiersProposes(s.plan);
  const resume = resumes(s.plan);
  const photosRangees = proposes.reduce((a, d) => a + resume.get(d.id)!.photos, 0);
  const nSansGps = e.range ? nombreSansGps(s) : 0;

  /** `nouvelles` : seulement les photos pas encore rangées, sans toucher aux dossiers déjà faits. */
  const calculer = async (nouvelles = false) => {
    if (
      e.range &&
      !nouvelles &&
      !(await confirmer(t`Ranger à nouveau ?`, t`Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier rangement seront remplacés (Ctrl+Z annule).`, t`Ranger à nouveau`))
    )
      return;
    const liste = nouvelles ? e.aRanger : e.aTrier;
    const el = elementsATrier(liste);
    const d = decouper(el.photos, e.lieux, o);
    const points = pointsANommer(d, o);
    arreter.current = false;
    try {
      const manquants = s.geocodage.manquants(points);
      if (manquants) setProgres({ faits: 0, total: manquants });
      let sansNoms = false;
      try {
        await s.geocodage.nommer(points, reglages.value.emailNominatim, (faits, total) => setProgres({ faits, total }), () => arreter.current);
      } catch (err) {
        if (!erreurReseau(err)) throw err;
        // Hors ligne : les noms déjà connus (cache) sont gardés, les autres lieux s'appellent « Lieu_01 »…
        sansNoms = true;
        journal('tri', t`Noms des lieux indisponibles (OpenStreetMap) : ${texteErreur(err)}`);
      }
      const proposes = arborescenceComplete(el, d, (lat, lon) => s.geocodage.connu(lat, lon)?.nom ?? null, o, evenements.value);
      // Le géocodage a pu durer : seules les photos encore à trier maintenant sont rangées.
      if (session.value?.plan !== s.plan) return;
      appliquer(appliquerTri(s.plan, proposes, new Set((nouvelles ? fichiersARanger(s.plan) : fichiersATrier(s.plan)).map((f) => f.id)), { garderAnciens: nouvelles }));
      s.projet.tri = { ...o };
      planifierEnregistrement();
      versionProjet.value++;
      changerEtape(ETAPE.tri, 'en_cours');
      // Même compte que le résumé de l'étape : un dossier vidé (photos écartées) ne compte pas.
      const nb = nouvelles ? new Set(liste.map((f) => s.plan.fichiers.get(f.id)).filter((f) => f?.statut === 'archive').map((f) => f!.dossier)).size : dossiersProposes(s.plan).length;
      journal(
        'tri',
        nouvelles
          ? t`Tri des nouvelles photos : ${pluriel(liste.length, 'fichier rangé', 'fichiers rangés')} dans ${pluriel(nb, 'dossier')}`
          : t`Tri dans l’ordre du temps : ${pluriel(nb, 'dossier proposé', 'dossiers proposés')} pour ${pluriel(e.aTrier.length, 'fichier')}`,
        { options: o, endroits: points.length },
      );
      notifier('ok', t`${pluriel(liste.length, 'fichier rangé', 'fichiers rangés')} dans ${pluriel(nb, 'dossier')} : voyez-les ci-dessous.`);
      document.getElementById('resultat-tri')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const ecarterCopies = () => {
    const nb = e.nCopies;
    appliquer(accepter(s.plan, e.copies));
    notifier(
      'ok',
      e.range
        ? t`${pluriel(nb, 'copie mise', 'copies mises')} de côté dans « ${dossierMisDeCote('doublons_exacts')} ». Rangez à nouveau : des dossiers ont pu se vider.`
        : t`${pluriel(nb, 'copie mise', 'copies mises')} de côté dans « ${dossierMisDeCote('doublons_exacts')} ».`,
      { libelle: t`Annuler`, faire: annuler },
    );
  };

  const question = (
    <fieldset class="question-tri">
      <legend>{t`Un voyage de plusieurs jours se range…`}</legend>
      <label class="case">
        <input type="radio" name="etapes-voyage" checked={o.etapes} onChange={() => changer({ etapes: true })} /> {t`dans un dossier, avec un sous-dossier par étape`}{' '}
        <span class="conseille">{t`conseillé`}</span>
      </label>
      <label class="case">
        <input type="radio" name="etapes-voyage" checked={!o.etapes} onChange={() => changer({ etapes: false })} /> {t`tout dans un seul dossier`}
      </label>
      <details class="avances">
        <summary>{t`Réglages avancés`}</summary>
        <label>
          {t`Un voyage commence à`}{' '}
          <input
            type="number"
            class="tres-court"
            min={1}
            step={1}
            value={o.distanceVoyageKm}
            onChange={(ev) => changer({ distanceVoyageKm: Math.max(1, Number(ev.currentTarget.value) || 1) })}
          />{' '}
          {t`km de la maison`}
        </label>
        <p class="aide-option">{t`Plusieurs jours de suite plus loin que cette distance, sans photo prise à la maison entre-temps, forment un voyage.`}</p>
      </details>
    </fieldset>
  );

  const boutonRanger = progres ? (
    <div class="progression-tri">
      <BarreProgression faits={progres.faits} total={progres.total} texte={t`Noms des lieux (OpenStreetMap) : ${progres.faits} / ${progres.total} — encore ${duree((progres.total - progres.faits) * 1200)}`} />
      <button type="button" onClick={() => (arreter.current = true)}>
        {t`Arrêter (les noms déjà reçus sont gardés)`}
      </button>
    </div>
  ) : null;
  const apercuTexte = t`Avec vos photos : ${[...(n.voyages ? [pluriel(n.voyages, 'voyage')] : []), pluriel(n.sorties, 'sortie'), ...(n.maison ? [t`la maison en ${pluriel(n.maison, 'dossier')}`] : [])].join(', ')} (${pluriel(n.dossiers, 'dossier')} en tout).`;

  return (
    <section class="encart a-faire-tri">
      <h2>{t`À faire sur cette page`}</h2>
      <ul class="liste-afaire">
        {e.domicile ? (
          <Ligne
            etat="fait"
            titre={t`Votre maison : ${e.domicile.nom}`}
            detail={t`Elle sert à reconnaître les voyages et les sorties.`}
            boutons={
              <button type="button" onClick={() => (page.value = { nom: 'configuration' })}>
                {t`Changer`}
              </button>
            }
          />
        ) : (
          <Ligne
            etat="afaire"
            titre={t`Votre maison n’est pas encore indiquée`}
            detail={t`Elle sert à reconnaître les voyages et les sorties : sans elle, aucun voyage n’est reconnu et chaque moment devient une sortie.`}
            boutons={
              <>
                {e.lieuxProposes && (
                  <button type="button" class="principal" aria-expanded={panneau === 'maison'} onClick={() => basculer('maison')}>
                    {t`La choisir parmi les lieux fréquents`}
                  </button>
                )}
                <button type="button" onClick={() => (page.value = { nom: 'configuration' })}>
                  {t`L’indiquer dans la Configuration`}
                </button>
              </>
            }
            panneau={panneau === 'maison' && <LieuxFrequents ouvert />}
          />
        )}

        {e.nCopies > 0 && (
          <Ligne
            etat="afaire"
            classe="copies-avant-tri"
            titre={pluriel(e.nCopies, 'photo en double', 'photos en double')}
            detail={
              e.range
                ? t`Copies exactes d’une photo déjà gardée ailleurs : le tri les a rangées une seconde fois. Mettez-les de côté, puis rangez à nouveau.`
                : t`Copies exactes d’une photo déjà gardée ailleurs. Sinon, elles seront rangées deux fois.`
            }
            note={t`Rien n’est supprimé : elles vont dans « ${nomsSortie().misDeCote} ».`}
            boutons={
              <>
                <button type="button" onClick={() => allerEtape('doublons')}>
                  {t`Les voir`}
                </button>
                <button type="button" class="principal" onClick={ecarterCopies}>
                  {t`Mettre ${pluriel(e.nCopies, 'copie')} de côté`}
                </button>
              </>
            }
          />
        )}

        {e.captures.length > 0 ? (
          <Ligne
            etat="afaire"
            classe="captures-avant-tri"
            titre={t`${pluriel(e.captures.length, 'photo ressemble', 'photos ressemblent')} à des captures d’écran`}
            detail={t`Elles iront dans « ${nomsSortie().captures} », hors de l’album. Sinon, elles seront rangées avec vos photos.`}
            note={t`Rien n’est supprimé : le dossier « ${nomsSortie().captures} » est dans la sortie.`}
            boutons={
              <>
                <button type="button" aria-expanded={panneau === 'captures'} onClick={() => basculer('captures')}>
                  {panneau === 'captures' ? t`Masquer` : t`Les voir`}
                </button>
                <button type="button" class="principal" onClick={() => appliquer(rangerCaptures(s.plan, e.captures.map((f) => f.id)))}>
                  {t`Les mettre à part`}
                </button>
              </>
            }
            panneau={panneau === 'captures' && <Captures />}
          />
        ) : (
          e.capturesRangees > 0 && (
            <Ligne
              etat="fait"
              titre={t`${pluriel(e.capturesRangees, 'capture d’écran mise', 'captures d’écran mises')} à part`}
              detail={t`Dans « ${nomsSortie().captures} », hors de l’album.`}
              boutons={
                e.range && (
                  <button type="button" onClick={() => montrerOnglet('apart')}>
                    {t`Les voir`}
                  </button>
                )
              }
            />
          )
        )}

        {e.domicile && e.lieuxProposes && (
          <Ligne
            etat="facultatif"
            titre={t`Facultatif : des endroits reviennent souvent`}
            detail={t`Chez des proches, le club… Les enregistrer comme lieux connus donne de meilleurs noms de dossiers.`}
            boutons={
              <button type="button" aria-expanded={panneau === 'lieux'} onClick={() => basculer('lieux')}>
                {panneau === 'lieux' ? t`Masquer` : t`Les voir`}
              </button>
            }
            panneau={panneau === 'lieux' && <LieuxFrequents ouvert />}
          />
        )}

        {!e.range ? (
          <Ligne
            etat="afaire"
            classe="ligne-ranger"
            titre={t`Ranger les photos`}
            detail={
              <>
                {question}
                <span class="apercu-tri-chiffres">{apercuTexte}</span>
                {!e.domicile && <span class="alerte-texte">{t`Sans maison, aucun voyage n’est reconnu.`}</span>}
              </>
            }
            boutons={
              boutonRanger ?? (
                <button type="button" class="principal" disabled={!e.aTrier.length} onClick={() => void calculer()}>
                  {t`Ranger les photos`}
                </button>
              )
            }
            note={t`Ensuite, les noms des endroits sont demandés à OpenStreetMap (Nominatim) : seules les coordonnées moyennes de chaque endroit sont envoyées, une par seconde.`}
          />
        ) : e.aRanger.length > 0 ? (
          <Ligne
            etat="afaire"
            classe="ligne-ranger"
            titre={pluriel(e.aRanger.length, 'nouvelle photo à ranger', 'nouvelles photos à ranger')}
            detail={t`Arrivées depuis le dernier rangement : les dossiers déjà faits ne bougent pas.`}
            boutons={
              boutonRanger ?? (
                <>
                  <button type="button" onClick={() => void calculer()}>
                    {t`Tout ranger à nouveau`}
                  </button>
                  <button type="button" class="principal" onClick={() => void calculer(true)}>
                    {t`Ranger ${pluriel(e.aRanger.length, 'nouvelle photo', 'nouvelles photos')}`}
                  </button>
                </>
              )
            }
          />
        ) : (
          <Ligne
            etat="fait"
            classe="ligne-ranger"
            titre={t`${pluriel(photosRangees, 'photo rangée', 'photos rangées')} dans ${pluriel(proposes.length, 'dossier')}`}
            detail={
              <details class="autrement">
                <summary>{t`Ranger autrement…`}</summary>
                {question}
                <span class="apercu-tri-chiffres">{apercuTexte}</span>
              </details>
            }
            boutons={
              boutonRanger ?? (
                <>
                  <button type="button" onClick={() => void calculer()}>
                    {t`Ranger à nouveau`}
                  </button>
                  <button type="button" class="principal" onClick={() => allerEtape('lieux')}>
                    {t`Afficher les dossiers →`}
                  </button>
                </>
              )
            }
          />
        )}

        {nSansGps > 0 && (
          <Ligne
            etat="facultatif"
            titre={t`Facultatif : ${pluriel(nSansGps, 'photo sans GPS', 'photos sans GPS')}`}
            detail={t`Rangées avec les photos prises juste avant ou après. L’IA peut proposer un meilleur dossier ; son coût est affiché avant de la lancer.`}
            boutons={
              <button type="button" onClick={() => montrerOnglet('verifier')}>
                {t`Voir dans « À vérifier »`}
              </button>
            }
          />
        )}
      </ul>
    </section>
  );
}
