// Tri automatique d'un dossier en vrac (étape « Tri automatique », D103, D104) :
// une liste « À faire » où chaque ligne dit son état — ● à faire, ✓ fait,
// ○ facultatif — la maison, les copies et les captures à mettre de côté, les
// lieux qui reviennent souvent, puis « Ranger les photos » avec trois choix
// (les étapes d'un voyage, sa distance en crans, la maison par mois ou par
// semaine), chacun avec ce qu'il donne. Le rangement suit
// l'ordre du temps (lib/tri.ts), demande les noms des lieux à OpenStreetMap,
// puis l'arborescence remplace le vrac dans le plan (annulable). Sans
// connexion, les lieux gardent des noms provisoires : le tri n'est jamais
// bloqué. Le résultat se voit à droite (ResultatTri), en direct avant de ranger.

import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState, type StateUpdater, type Dispatch } from 'preact/hooks';
import type { LieuConnu } from '../../lib/config';
import { acceptablesSansVider, accepter, aEcarter, copiesEnAttente, groupesCopies } from '../../lib/groupesDoublons';
import { rangerCaptures } from '../../lib/inventaire';
import { t } from '../../lib/langue';
import { gardeSaPlace, RACINE, resumes, traitementDe, type DossierPlan, type FichierPlan, type Plan } from '../../lib/plan';
import { nomsSortie } from '../../lib/sortie';
import { compteSortes, type ResultatTri as Resultat } from '../../lib/resultatTri';
import { appliquerTri, arborescenceComplete, decouper, elementsATrier, optionsDuProjet, pointsANommer, type DossierPropose, type OptionsTri } from '../../lib/tri';
import { ETAPE } from '../../navigateur/projet';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annuler, appliquer, changerEtape, configuration, evenements, journal, notifier, page, planifierEnregistrement, reglages, session, texteErreur, versionPlan, versionProjet } from '../etat';
import { duree, nombre, pluriel } from '../format';
import { nombreSansGps, SansGps } from './AidesTri';
import { BarreProgression } from './Cadre';
import { Captures, capturesProposees } from './Captures';
import { confirmer, Fenetre } from './Dialogues';
import { Icone } from './Icones';
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
  /** Lieux fréquents à nommer (ni enregistrés, ni écartés pour la séance). */
  lieuxProposes: number;
}

/** Sans configuration : toujours la même liste vide, pour que les calculs gardés en mémoire ne se refassent pas. */
const AUCUN_LIEU: LieuConnu[] = [];

export function useEtatTri(): EtatTri {
  const s = session.value!;
  versionPlan.value;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? AUCUN_LIEU;
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

/**
 * Une ligne de la liste « À faire » (D107) : un anneau d'état — orange à
 * faire, vert coché fait, pointillé facultatif —, ce qu'elle dit, ses
 * boutons à droite, et ce qui se règle dessous (les choix du rangement).
 */
function Ligne({ etat, titre, detail, boutons, dessous, classe = '' }: { etat: EtatLigne; titre: ComponentChildren; detail?: ComponentChildren; boutons?: ComponentChildren; dessous?: ComponentChildren; classe?: string }) {
  const etiquette = { afaire: t`À faire`, fait: t`Fait`, facultatif: t`Facultatif` }[etat];
  return (
    <li class={`ligne-afaire ${etat} ${classe}`}>
      <span class="puce-afaire" role="img" title={etiquette} aria-label={etiquette}>
        {etat === 'fait' && <Icone nom="coche" taille={14} />}
      </span>
      <div class="texte-afaire">
        <strong>
          {titre}
          {etat === 'facultatif' && <span class="etiquette-facultatif">{t`facultatif`}</span>}
        </strong>
        {detail && <div class="detail-afaire">{detail}</div>}
      </div>
      {boutons && <div class="boutons-afaire">{boutons}</div>}
      {dessous && <div class="dessous-afaire">{dessous}</div>}
    </li>
  );
}

/** Une liste de choix (D107) : une ligne par choix, son effet chiffré à droite, « conseillé » en simple texte. */
function Choix<T>({ legende, valeur, choisir, options }: { legende: string; valeur: T; choisir: (v: T) => void; options: { v: T; nom: string; aide?: string; compte: string; sous?: string; conseille?: boolean }[] }) {
  const [nomGroupe] = useState(() => `choix-${Math.random().toString(36).slice(2)}`);
  return (
    <fieldset class="question-tri">
      <legend>{legende}</legend>
      <div class="liste-choix">
        {options.map((x) => (
          <label key={String(x.v)} class={x.v === valeur ? 'choisi' : ''}>
            <input type="radio" name={nomGroupe} checked={x.v === valeur} onChange={() => choisir(x.v)} />
            <span class="nom-choix">
              {x.nom}
              {x.conseille && <em>{t`conseillé`}</em>}
            </span>
            <span class="compte-choix">
              {x.compte}
              {x.sous && <small>{x.sous}</small>}
            </span>
            {x.aide && <span class="aide-choix">{x.aide}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Distances d'un voyage proposées à l'écran (D104) : le résultat change vraiment entre elles. */
export const CRANS_VOYAGE = [30, 50, 100];

/** Ce que donneraient les réglages, recalculé à chaque changement (quelques dizaines de ms pour une année). */
export interface ApercuTri {
  apercu: DossierPropose[];
  /** Nombre de voyages pour chaque distance des crans, et de dossiers à la maison par mois et par semaine. */
  voyagesParCran: Map<number, number>;
  maisonPar: { mois: number; semaine: number };
  /** Lieux visités des voyages (leurs sous-dossiers avec « un sous-dossier par lieu »). */
  lieuxVisites: number;
}

/**
 * Aperçu du tri : l'arborescence des photos à trier avec les réglages
 * choisis, nommée sans réseau (le nom déjà connu le plus proche, à 1 km au
 * plus ; sinon le lieu reste à nommer au rangement, D104).
 */
export function useApercuTri(e: EtatTri, o: OptionsTri): ApercuTri {
  const s = session.value!;
  const evts = evenements.value;
  const elements = useMemo(() => elementsATrier(e.aTrier), [versionPlan.value]);
  const decoupage = useMemo(() => decouper(elements.photos, e.lieux, o), [elements, e.lieux, o.distanceVoyageKm, o.maison, o.lieuxConnus]);
  const apercu = useMemo(() => arborescenceComplete(elements, decoupage, (lat, lon) => s.geocodage.procheConnu(lat, lon), o, evts), [decoupage, o.etapes, o.nomsFichiers, evts]);
  const voyagesParCran = useMemo(
    () => new Map(CRANS_VOYAGE.map((km) => [km, decouper(elements.photos, e.lieux, { ...o, distanceVoyageKm: km }).morceaux.filter((m) => m.sorte === 'voyage').length])),
    [elements, e.lieux],
  );
  const maisonPar = useMemo(() => {
    const n = (maison: OptionsTri['maison']) => decouper(elements.photos, e.lieux, { ...o, maison }).morceaux.filter((m) => m.sorte === 'maison').length;
    return { mois: n('mois'), semaine: n('semaine') };
  }, [elements, e.lieux, o.distanceVoyageKm]);
  const lieuxVisites = decoupage.morceaux.reduce((n, m) => n + (m.sorte === 'voyage' && (m.etapes?.length ?? 0) > 1 ? m.etapes!.length : 0), 0);
  return { apercu, voyagesParCran, maisonPar, lieuxVisites };
}

/** Réglages du tri choisis à l'écran, différents de ceux du dernier rangement ? */
export const memesReglages = (a: OptionsTri, b: OptionsTri) => a.etapes === b.etapes && a.distanceVoyageKm === b.distanceVoyageKm && a.maison === b.maison;

export function TriAuto({ e, o, setO, ap, apercu, actuel }: { e: EtatTri; o: OptionsTri; setO: Dispatch<StateUpdater<OptionsTri>>; ap: ApercuTri; apercu: Resultat; actuel: Resultat | null }) {
  const s = session.value!;
  versionPlan.value;
  const [fenetre, setFenetre] = useState<'lieux' | 'captures' | 'gps' | null>(null);
  const [autrement, setAutrement] = useState(false);
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const changer = (m: Partial<OptionsTri>) => setO({ ...o, ...m });
  const n = compteSortes(apercu);
  const enregistres = optionsDuProjet(s.projet.tri);
  const change = e.range && !memesReglages(o, enregistres);
  const nSansGps = e.range ? nombreSansGps(s) : 0;
  // Un seul bouton plein (D107) : celui de la première chose à faire ; les autres en contour.
  const premier = !e.domicile ? 'maison' : e.nCopies ? 'copies' : e.captures.length ? 'captures' : !e.range || e.aRanger.length ? 'ranger' : null;
  const style = (quoi: typeof premier) => (premier === quoi ? 'principal' : 'contour');

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
      // Même compte que la barre du bas : les photos rangées dans les dossiers du tri.
      const resume = resumes(s.plan);
      const photos = nouvelles ? liste.filter((f) => f.categorie === 'photo').length : dossiersProposes(s.plan).reduce((a, x) => a + resume.get(x.id)!.photos, 0);
      notifier('ok', t`${pluriel(photos, 'photo rangée', 'photos rangées')} dans ${pluriel(nb, 'dossier')} : voyez-les à droite.`);
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
        ? t`${pluriel(nb, 'copie mise', 'copies mises')} dans « Mis de côté ». Rangez à nouveau : des dossiers ont pu se vider.`
        : t`${pluriel(nb, 'copie mise', 'copies mises')} dans « Mis de côté ».`,
      { libelle: t`Annuler`, faire: annuler },
    );
  };

  const barreProgres = progres && (
    <div class="progression-tri">
      <BarreProgression faits={progres.faits} total={progres.total} texte={t`Noms des lieux (OpenStreetMap) : ${progres.faits} / ${progres.total} — encore ${duree((progres.total - progres.faits) * 1200)}`} />
      <button type="button" onClick={() => (arreter.current = true)}>
        {t`Arrêter (les noms déjà reçus sont gardés)`}
      </button>
    </div>
  );
  // Après un rangement, un autre réglage ne range rien en silence : l'écart se montre, on range ou on revient (D104).
  const avant = actuel ? compteSortes(actuel) : null;
  const ecart = (x: number, y?: number) => (y === undefined || x === y ? '' : ` (${x > y ? '+' : '−'}${nombre(Math.abs(x - y))})`);
  const pareil = !!avant && avant.voyage === n.voyage && avant.sortie === n.sortie && avant.maison === n.maison;
  const ecartTexte = pareil
    ? t`Ce réglage donne autant de voyages, de sorties et de dossiers à la maison.`
    : avant
      ? t`Avec ce réglage : ${[pluriel(n.voyage, 'voyage') + ecart(n.voyage, avant.voyage), pluriel(n.sortie, 'sortie') + ecart(n.sortie, avant.sortie), t`la maison en ${pluriel(n.maison, 'dossier')}` + ecart(n.maison, avant.maison)].join(', ')}.`
      : '';
  const resumeRange = [...(n.voyage ? [pluriel(n.voyage, 'voyage')] : []), pluriel(n.sortie, 'sortie'), ...(n.maison ? [t`la maison en ${pluriel(n.maison, 'dossier')}`] : [])].join(', ');
  const apercuTexte = t`Avec vos photos : ${resumeRange} (${pluriel(ap.apercu.length, 'dossier')} en tout).`;

  const choix = (
    <div class="reglages-tri">
      {e.domicile ? (
        <>
          <Choix
            legende={t`Les voyages de plusieurs jours`}
            valeur={o.etapes}
            choisir={(v) => changer({ etapes: v })}
            options={[
              { v: true, nom: t`Un sous-dossier par lieu visité`, conseille: true, aide: t`« Rome », « Florence »… dans le dossier du voyage.`, compte: pluriel(n.voyage, 'voyage'), ...(ap.lieuxVisites ? { sous: pluriel(ap.lieuxVisites, 'lieu visité', 'lieux visités') } : {}) },
              { v: false, nom: t`Tout le voyage dans un seul dossier`, aide: t`Toutes ses photos ensemble.`, compte: pluriel(n.voyage, 'voyage'), sous: t`un dossier chacun` },
            ]}
          />
          <Choix
            legende={t`C’est un voyage quand on part à plus de…`}
            valeur={o.distanceVoyageKm}
            choisir={(v) => changer({ distanceVoyageKm: v })}
            options={[...new Set([...CRANS_VOYAGE, o.distanceVoyageKm])]
              .sort((a, b) => a - b)
              .map((km) => ({
                v: km,
                nom: t`${nombre(km)} km de la maison`,
                conseille: km === 50,
                aide: km === 30 ? t`Les séjours proches deviennent aussi des voyages.` : km === 50 ? t`Le bon équilibre pour la plupart des familles.` : km === 100 ? t`Seulement les départs lointains ; le reste devient des sorties.` : undefined,
                compte: ap.voyagesParCran.has(km) ? pluriel(ap.voyagesParCran.get(km)!, 'voyage') : '',
              }))}
          />
          <Choix
            legende={t`À la maison, un dossier…`}
            valeur={o.maison}
            choisir={(v) => changer({ maison: v })}
            options={[
              { v: 'mois' as const, nom: t`par mois`, conseille: true, aide: t`Une journée chargée (Noël, un anniversaire…) a toujours le sien.`, compte: pluriel(ap.maisonPar.mois, 'dossier') },
              { v: 'semaine' as const, nom: t`par semaine`, aide: t`Des dossiers plus courts.`, compte: pluriel(ap.maisonPar.semaine, 'dossier') },
            ]}
          />
        </>
      ) : (
        <p class="encart-info">{t`Indiquez d’abord votre maison : sans elle, l’application ne reconnaît ni les voyages ni les journées à la maison, et ne pose pas les questions qui les concernent.`}</p>
      )}
      {change && avant && (
        <div class="ecart-reglage">
          <span>{ecartTexte}</span>
          <button type="button" class={premier === null || premier === 'ranger' ? 'principal' : 'contour'} onClick={() => void calculer()}>
            {t`Ranger avec ce réglage`}
          </button>
          <button type="button" class="contour" onClick={() => setO(enregistres)}>
            {t`Revenir au réglage actuel`}
          </button>
        </div>
      )}
      {!e.range && (
        <div class="ranger-tri">
          {progres ? (
            barreProgres
          ) : (
            <>
              <button type="button" class={style('ranger')} disabled={!e.aTrier.length} onClick={() => void calculer()}>
                {t`Ranger les photos`}
              </button>
              <span class="discret">{t`Vos photos d’origine ne bougent pas.`}</span>
            </>
          )}
        </div>
      )}
      <p class="note-afaire">{t`Pour nommer les lieux, seule leur position est envoyée à OpenStreetMap (un service de cartes gratuit), jamais vos photos.`}</p>
    </div>
  );

  return (
    <section class="encart a-faire-tri">
      <h2>{t`À faire sur cette page`}</h2>
      <ul class="liste-afaire">
        {e.domicile ? (
          <Ligne
            etat="fait"
            titre={t`Votre maison : ${e.domicile.nom}`}
            boutons={
              <button type="button" class="petit" onClick={() => (page.value = { nom: 'configuration' })}>
                {t`Changer`}
              </button>
            }
          />
        ) : (
          <Ligne
            etat="afaire"
            titre={t`Votre maison n’est pas encore indiquée`}
            detail={e.lieuxProposes ? t`Choisissez-la parmi les endroits qui reviennent souvent.` : t`Indiquez-la dans la Configuration : sans elle, aucun voyage n’est reconnu.`}
            boutons={
              <button type="button" class={style('maison')} onClick={() => (e.lieuxProposes ? setFenetre('lieux') : (page.value = { nom: 'configuration' }))}>
                {t`L’indiquer…`}
              </button>
            }
          />
        )}

        {e.nCopies > 0 && (
          <Ligne
            etat="afaire"
            classe="copies-avant-tri"
            titre={pluriel(e.nCopies, 'photo en double', 'photos en double')}
            detail={
              e.range
                ? t`Copies exactes d’une photo déjà gardée : le tri les a rangées une seconde fois. Rien n’est supprimé : elles vont dans « Mis de côté ». Rangez à nouveau ensuite.`
                : t`Copies exactes d’une photo déjà gardée. Rien n’est supprimé : elles vont dans « Mis de côté ».`
            }
            boutons={
              <>
                <button type="button" class="petit" onClick={() => allerEtape('doublons')}>
                  {t`Voir`}
                </button>
                <button type="button" class={style('copies')} onClick={ecarterCopies}>
                  {t`Mettre de côté`}
                </button>
              </>
            }
          />
        )}

        {e.captures.length > 0 ? (
          <Ligne
            etat="afaire"
            classe="captures-avant-tri"
            titre={pluriel(e.captures.length, 'capture d’écran', 'captures d’écran')}
            detail={t`Elles iront dans leur propre dossier, « ${nomsSortie().captures} », hors de l’album. Rien n’est supprimé.`}
            boutons={
              <>
                <button type="button" class="petit" onClick={() => setFenetre('captures')}>
                  {t`Voir`}
                </button>
                <button type="button" class={style('captures')} onClick={() => appliquer(rangerCaptures(s.plan, e.captures.map((f) => f.id)))}>
                  {t`Ranger dans leur dossier`}
                </button>
              </>
            }
          />
        ) : (
          e.capturesRangees > 0 && (
            <Ligne
              etat="fait"
              titre={t`${pluriel(e.capturesRangees, 'capture d’écran rangée', 'captures d’écran rangées')} dans leur dossier`}
              detail={t`Dans « ${nomsSortie().captures} », hors de l’album.`}
              boutons={
                e.range && (
                  <button type="button" class="petit" onClick={() => montrerOnglet('apart')}>
                    {t`Voir`}
                  </button>
                )
              }
            />
          )
        )}

        {e.domicile && e.lieuxProposes > 0 && (
          <Ligne
            etat="facultatif"
            titre={pluriel(e.lieuxProposes, 'endroit revient souvent', 'endroits reviennent souvent')}
            detail={t`Donnez-leur un nom : vos dossiers seront mieux nommés.`}
            boutons={
              <button type="button" class="petit" onClick={() => setFenetre('lieux')}>
                {t`Les nommer…`}
              </button>
            }
          />
        )}

        {!e.range ? (
          <Ligne etat="afaire" classe="ligne-ranger" titre={t`Ranger les photos`} detail={t`Choisissez comment ; le résultat change à droite à chaque choix.`} dessous={<>{choix}<span class="apercu-tri-chiffres">{apercuTexte}</span></>} />
        ) : e.aRanger.length > 0 ? (
          <Ligne
            etat="afaire"
            classe="ligne-ranger"
            titre={pluriel(e.aRanger.length, 'nouvelle photo à ranger', 'nouvelles photos à ranger')}
            detail={t`Arrivées depuis le dernier rangement : les dossiers déjà faits ne bougent pas.`}
            boutons={
              barreProgres || (
                <>
                  <button type="button" class="contour" onClick={() => void calculer()}>
                    {t`Tout ranger à nouveau`}
                  </button>
                  <button type="button" class={style('ranger')} onClick={() => void calculer(true)}>
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
            titre={t`Photos rangées : ${resumeRange}`}
            detail={t`Vos photos d’origine n’ont pas bougé.`}
            boutons={
              barreProgres || (
                <button type="button" class="petit" aria-expanded={autrement || change} onClick={() => setAutrement(!autrement)}>
                  {t`Ranger autrement…`}
                </button>
              )
            }
            dessous={
              (autrement || change) && (
                <>
                  {choix}
                  {!change && (
                    <div class="ranger-tri">
                      <button type="button" class="contour" onClick={() => void calculer()}>
                        {t`Ranger à nouveau`}
                      </button>
                      <span class="discret">{t`Les déplacements faits à la main dans ces dossiers seraient remplacés (Ctrl+Z annule).`}</span>
                    </div>
                  )}
                </>
              )
            }
          />
        )}

        {nSansGps > 0 && (
          <Ligne
            etat="facultatif"
            titre={pluriel(nSansGps, 'photo sans position', 'photos sans position')}
            detail={t`Sans GPS, elles sont rangées avec les photos prises juste avant ou après. Une aide IA peut proposer mieux ; son coût est affiché avant de la lancer.`}
            boutons={
              // Aide IA dont le prix dépend de ce qu'on choisit : « … », le prix est dans la fenêtre avant de lancer (C-4.6).
              <button type="button" class="petit bouton-ia" onClick={() => setFenetre('gps')}>
                <Icone nom="etincelle" taille={20} />
                {t`Demander à l’IA…`}
              </button>
            }
          />
        )}
      </ul>
      {fenetre === 'lieux' && <LieuxFrequents fermer={() => setFenetre(null)} />}
      {fenetre === 'captures' && (
        <Fenetre titre={t`Captures d’écran trouvées`} intro={t`Reconnues à leur nom de fichier, à leurs dimensions d’écran et à l’absence de marque d’appareil.`} fermer={() => setFenetre(null)}>
          <Captures />
        </Fenetre>
      )}
      {fenetre === 'gps' && (
        <Fenetre titre={t`Photos sans position`} fermer={() => setFenetre(null)}>
          <SansGps />
        </Fenetre>
      )}
    </section>
  );
}
