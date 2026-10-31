// Panneau des dossiers (SPEC § 5.3) : arborescence avec nombres et dates,
// dépôt des photos glissées, fusion, renommage, création. Ligne de dossier
// commune (C-7.7, D112 point 10) : le nom, puis la période et les icônes
// (calendrier, petit dossier) ; à Lieux et sorties, le menu « … » (C-4.14).

import { estNomDeSortie, nomsSortie } from '../../lib/sortie';
import { signal } from '@preact/signals';
import { Fragment, type ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { lireReglages, rayonDuProjet, rencontres, rencontreSuffisante, reglagesParDefaut, type DossierInfo, type ReglagesConsolidation } from '../../lib/consolidation';
import { SEUIL_PETIT_DOSSIER } from '../../lib/fragments';
import { evenementsDesPhotos, type EvenementCalendrier } from '../../lib/ics';
import { aTraduire, t } from '../../lib/langue';
import { cleNom } from '../../lib/noms';
import { dossiersNouveaux } from '../../lib/rangement';
import { cheminDossier, deplacerDossier, estDescendant, fusionnerDossiers, gardeSaPlace, nePasToucher, renommerDossier, resumes, RACINE, supprimerDossierVide, type DossierPlan, type FichierPlan, type Plan, type ResumeDossier } from '../../lib/plan';
import { minutes } from '../../lib/selection';
import { annuler, appliquer, changerReglages, evenements, notifier, reglages, session, texteErreur, versionIA, versionPlan } from '../etat';
import { REGLAGES_DEFAUT } from '../../navigateur/reglages';
import { nombre, periode, pluriel } from '../format';
import {
  choisirVue,
  deplacerOuvert,
  deplacerVers,
  deplies,
  dossierPourNouveauVide,
  elementsVue,
  glisse,
  mettreSelectionDeCote,
  nouveauDossierAvec,
  ordrePanneau,
  type OrdrePanneau,
  petitsDe,
  parentPourNouveau,
  renommage,
  selection,
  simplifier,
  vue,
  VUE_AUTRES,
  VUE_MIS_DE_COTE,
} from '../organiser';
import { BulleCalendrier, BulleIcone } from './Bulle';
import { confirmer } from './Dialogues';
import { Icone } from './Icones';
import { MenuActions, type ActionMenu } from './MenuActions';

/** En dessous de ce nombre de photos, un dossier est signalé « petit » (§ 6.4) : le seuil de l'étape « Petits dossiers ». */
export const SEUIL_PETIT = SEUIL_PETIT_DOSSIER;

/** Au-delà, un dossier est signalé « très grand » (§ 6.4). */
export const SEUIL_GRAND = 200;

const LARGEUR_MIN = 240;
const LARGEUR_MAX = 720;
/** Largeur pendant qu'on tire le bord du panneau (enregistrée au lâcher). */
const largeurEnCours = signal<number | null>(null);

/** Largeur du panneau, à donner à la page (`--largeur-panneau`). */
export function styleLargeurPanneau(): Record<string, string> {
  return { '--largeur-panneau': `${largeurEnCours.value ?? reglages.value.largeurPanneau}px` };
}

/** Tirer le bord droit du panneau l'élargit ; un double-clic revient à la largeur d'origine (aussi la liste de gauche des Doublons, D97). */
export function redimensionner(e: PointerEvent) {
  const poignee = e.currentTarget as HTMLElement;
  const depart = e.clientX;
  const largeur = reglages.value.largeurPanneau;
  poignee.setPointerCapture(e.pointerId);
  const bouger = (m: PointerEvent) => (largeurEnCours.value = Math.round(Math.max(LARGEUR_MIN, Math.min(LARGEUR_MAX, largeur + m.clientX - depart))));
  const finir = () => {
    poignee.removeEventListener('pointermove', bouger);
    poignee.removeEventListener('pointerup', finir);
    poignee.removeEventListener('pointercancel', finir);
    if (largeurEnCours.value !== null) changerReglages({ ...reglages.value, largeurPanneau: largeurEnCours.value });
    largeurEnCours.value = null;
  };
  poignee.addEventListener('pointermove', bouger);
  poignee.addEventListener('pointerup', finir);
  poignee.addEventListener('pointercancel', finir);
  e.preventDefault();
}

/**
 * Titre de la vue : le nom du dossier en grand, ses dossiers parents au-dessus, en petit et cliquables ;
 * `sousTitre` (période et nombre de photos) en petit dessous, pour laisser la ligne au nom et aux boutons ;
 * `actions` (le crayon et « … » de Lieux et sorties) juste après le nom.
 */
export function TitreVue({ titre, id, sousTitre, actions }: { titre: string; id?: string; sousTitre?: ComponentChildren; actions?: ComponentChildren }) {
  const s = session.value!;
  const parents: DossierPlan[] = [];
  for (let d = id ? s.plan.dossiers.get(id) : undefined; d && d.parent !== null; ) {
    const p = s.plan.dossiers.get(d.parent);
    if (!p || p.parent === null) break;
    parents.unshift(p);
    d = p;
  }
  return (
    <div class="titre-vue">
      {parents.length > 0 && (
        <div class="chemin-vue">
          {parents.map((p) => (
            <Fragment key={p.id}>
              <button type="button" class="lien" onClick={() => choisirVue(p.id)} title={t`Ouvrir « ${p.nom} »`}>
                {p.nom}
              </button>
              <Icone nom="chevronDroite" taille={16} />
            </Fragment>
          ))}
        </div>
      )}
      {actions ? (
        <div class="ligne-titre-vue">
          <h2 title={id ? cheminDossier(s.plan, id) : titre}>{titre}</h2>
          {actions}
        </div>
      ) : (
        <h2 title={id ? cheminDossier(s.plan, id) : titre}>{titre}</h2>
      )}
      {sousTitre && <div class="sous-titre-vue">{sousTitre}</div>}
    </div>
  );
}

interface Arbre {
  enfants: Map<string, DossierPlan[]>;
  resumes: Map<string, ResumeDossier>;
  visibles: Set<string> | null;
  /** Alertes de chaque dossier (§ 6.4) : libellé court (en français, traduit à l'affichage) et explication. */
  alertes: Map<string, [string, string][]>;
  /** Photos et vidéos arrivées avec une mise à jour de l'inventaire, pas encore dans la sortie (D63), par dossier. */
  nouveaux: Map<string, number>;
  /** Calendrier de chaque dossier (D94), s'il n'est pas déjà celui de son parent : l'icône et sa bulle. */
  evenements: Map<string, CalendrierDossier>;
  /**
   * Petits dossiers et leur nombre de photos : l'icône grise (D112 point 10, même en vrac, réponse 18). En vrac,
   * ceux que l'étape suivante examine ; dans un dossier déjà trié, ceux de moins de 5 photos.
   */
  petits: Map<string, number>;
  /** Dossiers trouvés par la recherche grâce à leur événement, pas à leur nom : l'événement s'écrit sous la ligne. */
  parEvenement: Map<string, string>;
  /** Liste de la Sélection : sans menu « … », sans icône « petit dossier », sans dépôt de dossier. */
  simple: boolean;
}

/** L'événement d'un dossier et ceux pendant lesquels ses photos ont été prises (la bulle de l'icône calendrier). */
export interface CalendrierDossier {
  retenu: EvenementCalendrier;
  liste: EvenementCalendrier[];
}

/**
 * L'événement du calendrier de chaque dossier, sous-dossiers compris (D94) :
 * celui pendant lequel la moitié au moins de ses photos ont été prises, avec
 * les autres pendant lesquels des photos ont été prises. Un sous-dossier ne
 * répète pas celui de son parent (les étapes d'un voyage).
 */
export function evenementsDesDossiers(plan: Plan, evts: EvenementCalendrier[]): Map<string, CalendrierDossier> {
  const res = new Map<string, CalendrierDossier>();
  if (!evts.length) return res;
  const dates = new Map<string, string[]>();
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre' || !f.date) continue;
    for (let d = plan.dossiers.get(f.dossier); d && d.parent !== null; d = plan.dossiers.get(d.parent)) {
      const liste = dates.get(d.id);
      if (liste) liste.push(f.date);
      else dates.set(d.id, [f.date]);
    }
  }
  for (const [id, liste] of dates) {
    // Comme `evenementPrincipal` : le premier, s'il couvre au moins la moitié des photos.
    const pendant = evenementsDesPhotos(evts, liste);
    if (pendant.length && pendant[0].n * 2 >= liste.length) res.set(id, { retenu: pendant[0].evenement, liste: pendant.map((x) => x.evenement) });
  }
  for (const [id, e] of [...res]) {
    const parent = plan.dossiers.get(id)?.parent;
    if (parent && res.get(parent)?.retenu.titre === e.retenu.titre) res.delete(id);
  }
  return res;
}

/**
 * Badges d'alerte de l'arborescence prévue (§ 6.4) : le libellé court sert
 * aussi de code (« gardé », « hors album »), traduit à l'affichage. `suite` :
 * quand deux photos de deux dossiers voisins font « la même sortie » (les
 * réglages de la Consolidation, D91).
 */
export function alertesDossiers(plan: Plan, r: Map<string, ResumeDossier>, suite: Pick<ReglagesConsolidation, 'heures' | 'km'> = reglagesParDefaut()): Map<string, [string, string][]> {
  const alertes = new Map<string, [string, string][]>();
  const ajouter = (id: string, a: [string, string]) => alertes.set(id, [...(alertes.get(id) ?? []), a]);
  const sansDate = new Map<string, number>();
  for (const f of plan.fichiers.values()) if (f.statut === 'archive' && f.categorie !== 'autre' && f.origineDate === 'fichier') sansDate.set(f.dossier, (sansDate.get(f.dossier) ?? 0) + 1);
  const parNom = new Map<string, string[]>();
  for (const d of plan.dossiers.values()) if (d.parent !== null) parNom.set(cleNom(d.nom), [...(parNom.get(cleNom(d.nom)) ?? []), d.id]);
  const freres = new Map<string, DossierPlan[]>();
  for (const d of plan.dossiers.values()) if (d.parent !== null) freres.set(d.parent, [...(freres.get(d.parent) ?? []), d]);
  for (const d of plan.dossiers.values()) {
    if (d.parent === null) continue;
    const x = r.get(d.id)!;
    const direct = x.photos + x.videos;
    if (direct > SEUIL_GRAND) ajouter(d.id, [aTraduire('grand'), t`Très grand dossier : plus de ${SEUIL_GRAND} photos, peut-être plusieurs sorties`]);
    if (estNomDeSortie('sansLieu', d.nom) || /^(Lieu|Place)_\d+/.test(d.nom)) ajouter(d.id, [aTraduire('lieu ?'), t`Lieu inconnu : photos sans GPS ou lieu sans nom`]);
    if (sansDate.get(d.id)) ajouter(d.id, [aTraduire('sans date'), t`${sansDate.get(d.id)} photo(s) sans autre date que celle du fichier`]);
    if ((parNom.get(cleNom(d.nom))?.length ?? 0) > 1) ajouter(d.id, [aTraduire('nom en double'), t`Un autre dossier porte le même nom`]);
    if (d.traitement === 'nettoyer') ajouter(d.id, [aTraduire('gardé'), t`Sous-dossier de la source gardé à sa place ; ses floues et ses doublons sont proposés`]);
    if (d.traitement === 'garder' || d.traitement === 'ignorer') ajouter(d.id, [aTraduire('ne pas toucher'), t`Sous-dossier de la source recopié tel quel`]);
  }
  // Même sortie coupée en deux : deux dossiers voisins dont deux photos ont été prises à la suite, au même
  // endroit (à moins de 3 h et de 4 km par défaut, comme la Consolidation, D91). Des photos simplement
  // entremêlées dans le temps ne suffisent plus : une excursion faite pendant un séjour était signalée (D93).
  const photosDe = new Map<string, FichierPlan[]>();
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre' || !f.date || f.date.length < 19) continue;
    photosDe.set(f.dossier, [...(photosDe.get(f.dossier) ?? []), f]);
  }
  const infos = new Map<string, DossierInfo & { t1: number; t2: number }>();
  const info = (d: DossierPlan) => {
    let x = infos.get(d.id);
    if (!x) {
      const photos = [...(photosDe.get(d.id) ?? [])].sort((a, b) => a.date!.localeCompare(b.date!));
      x = { id: d.id, nom: d.nom, photos, du: photos[0].date, au: photos.at(-1)!.date, t1: minutes(photos[0].date)!, t2: minutes(photos.at(-1)!.date)! };
      infos.set(d.id, x);
    }
    return x;
  };
  for (const liste of freres.values()) {
    // Les dossiers de la source gardés à leur place, sous-dossiers compris (Voyage/Etape…), sont rangés par la famille.
    const sorties = liste.filter((d) => d.tri?.origine !== 'lieu_connu' && !gardeSaPlace(plan, d.id) && !d.nom.startsWith('_') && (photosDe.get(d.id)?.length ?? 0) > 0);
    for (const a of sorties) {
      const ia = info(a);
      const autre = sorties.find((b) => {
        if (b === a) return false;
        const ib = info(b);
        // Périodes trop éloignées : rien à comparer photo à photo.
        if (ib.t1 > ia.t2 + suite.heures * 60 || ia.t1 > ib.t2 + suite.heures * 60) return false;
        return !!rencontreSuffisante(rencontres(ia, ib), suite);
      });
      if (autre) ajouter(a.id, [aTraduire('même sortie ?'), t`Photos prises juste avant ou après celles de « ${autre.nom} », au même endroit : la même sortie ?`]);
    }
  }
  return alertes;
}

/** Comportement commun des cibles de dépôt : surbrillance et action. */
function useCible(accepter: () => boolean, deposer: () => void) {
  const [survol, setSurvol] = useState(false);
  return {
    survol,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!accepter()) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        setSurvol(true);
      },
      onDragLeave: () => setSurvol(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setSurvol(false);
        deposer();
        glisse.finir();
      },
    },
  };
}

/** Champ de renommage : le nom choisi d'entrée ; Entrée ou un clic ailleurs renomment, Échap renonce. */
export function ChampRenommer({ nom, terminer, classe = 'renommage', libelle }: { nom: string; terminer: (nom: string | null) => void; classe?: string; libelle?: string }) {
  const fini = useRef(false);
  const fin = (v: string | null) => {
    if (fini.current) return;
    fini.current = true;
    terminer(v);
  };
  return (
    <input
      class={classe}
      value={nom}
      aria-label={libelle ?? t`Nouveau nom de « ${nom} »`}
      ref={(el) => {
        if (el)
          setTimeout(() => {
            el.select();
            el.scrollIntoView({ block: 'nearest' });
          }, 0);
      }}
      onClick={(e) => e.stopPropagation()}
      onDblClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') fin(e.currentTarget.value);
        if (e.key === 'Escape') fin(null);
      }}
      onBlur={(e) => fin(e.currentTarget.value)}
    />
  );
}

/** Renommer un dossier dans le panneau (F2, crayon, menu « … ») : ses parents se déplient pour qu'on le voie. */
export function commencerRenommage(id: string) {
  const plan = session.value!.plan;
  const n = new Set(deplies.value);
  for (let d = plan.dossiers.get(id); d && d.parent !== null; d = plan.dossiers.get(d.parent)) n.add(d.parent);
  deplies.value = n;
  renommage.value = id;
}

/** Renomme (Ctrl+Z annule) ; une erreur (nom pris, caractère interdit) s'écrit dans le message. */
export function renommerVers(id: string, nom: string | null) {
  const s = session.value!;
  const d = s.plan.dossiers.get(id);
  if (!d || nom === null || nom.trim() === d.nom) return;
  try {
    appliquer(renommerDossier(s.plan, id, nom));
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

function Ligne({ d, profondeur, arbre, plat = false }: { d: DossierPlan; profondeur: number; arbre: Arbre; plat?: boolean }) {
  const s = session.value!;
  const r = arbre.resumes.get(d.id)!;
  // À plat (ordre par taille) : pas de sous-dossiers ; le dossier parent est rappelé sous le nom.
  const enfants = plat ? [] : (arbre.enfants.get(d.id) ?? []);
  // Créé par le tri ou à la main, et pas dans un dossier lui-même nouveau : les sous-dossiers d'un voyage n'en répètent pas la mention (D89).
  const cree = (x?: DossierPlan) => !!x && (x.origine === 'tri' || x.origine === 'cree');
  const parent = d.parent === null ? undefined : s.plan.dossiers.get(d.parent);
  const nouveau = cree(d) && (plat || !cree(parent));
  const deplie = deplies.value.has(d.id) || arbre.visibles !== null;
  const actif = vue.value === d.id;
  const enRenommage = renommage.value === d.id;
  const total = r.photosTotal + r.videosTotal;
  const direct = r.photos + r.videos;
  const calendrier = arbre.evenements.get(d.id);
  const petit = arbre.petits.get(d.id);
  const trouve = arbre.parEvenement.get(d.id);
  const avecMenu = !arbre.simple && d.parent !== null;
  const menuIci = menuDossier.value?.id === d.id && menuDossier.value.depuis === 'liste';

  const cible = useCible(
    () => {
      const g = glisse.get();
      if (!g) return false;
      if (g.type === 'fichiers') return true;
      return g.id !== d.id && !estDescendant(s.plan, d.id, g.id);
    },
    () => {
      const g = glisse.get();
      if (g?.type === 'fichiers') deplacerVers(d.id, g.ids);
      if (g?.type === 'dossier') void fusionner(g.id, d.id);
    },
  );

  const basculer = (e: Event) => {
    e.stopPropagation();
    const n = new Set(deplies.value);
    if (n.has(d.id)) n.delete(d.id);
    else n.add(d.id);
    deplies.value = n;
  };

  if (arbre.visibles && !arbre.visibles.has(d.id)) return null;

  // Le badge « nouveau » passe dans l'infobulle de la ligne (D112 point 10).
  const titre =
    t`${d.parent === null ? t`Photos (racine)` : cheminDossier(s.plan, d.id)} — ${nombre(r.photosTotal)} photos, ${nombre(r.videosTotal)} vidéos` +
    (enfants.length ? t` (dont ${nombre(direct)} directement)` : '') +
    (nouveau ? `\n${d.origine === 'tri' ? t`Nouveau : créé par le tri automatique, il n’existe pas dans votre dossier d’origine` : t`Nouveau : créé à la main, il n’existe pas dans votre dossier d’origine`}` : '');

  return (
    <li>
      <div
        class={`ligne-dossier${actif ? ' actif' : ''}${cible.survol ? ' cible' : ''}${menuIci ? ' menu-ouvert' : ''}`}
        style={{ paddingLeft: `${8 + profondeur * 16}px` }}
        draggable={d.parent !== null && !enRenommage}
        data-nouveau={nouveau ? (d.origine === 'tri' ? 'tri' : 'main') : undefined}
        onDragStart={(e) => glisse.commencer({ type: 'dossier', id: d.id }, e)}
        onDragEnd={glisse.finir}
        onClick={() => choisirVue(d.id)}
        onDblClick={() => d.parent !== null && (renommage.value = d.id)}
        onContextMenu={(e) => {
          if (!avecMenu) return;
          e.preventDefault();
          ouvrirMenuDossier(d.id, e.clientX, e.clientY, e.currentTarget.querySelector<HTMLElement>('.plus-dossier'), 'liste');
        }}
        {...cible.props}
        title={titre}
      >
        {/* Sans sous-dossier, une place vide (pas un bouton désactivé) : les noms restent alignés. */}
        {enfants.length ? (
          <button type="button" class="deplier" onClick={basculer} aria-label={deplie ? t`Replier` : t`Déplier`}>
            <Icone nom={deplie ? 'chevronBas' : 'chevronDroite'} taille={16} />
          </button>
        ) : (
          <span class="deplier" aria-hidden="true" />
        )}
        <div class="texte-dossier">
          {enRenommage ? (
            <ChampRenommer
              nom={d.nom}
              terminer={(nom) => {
                renommage.value = null;
                renommerVers(d.id, nom);
              }}
            />
          ) : (
            <span class="nom-dossier">{d.parent === null ? t`Photos (racine)` : d.nom}</span>
          )}
          {/* Deuxième ligne : où il se trouve (à plat), la période, les icônes et les alertes ; le nom garde toute la largeur. */}
          <span class="infos-dossier">
            {plat && d.parent !== null && d.parent !== RACINE && <span class="chemin-dossier">
                {cheminDossier(s.plan, d.parent)}
                <Icone nom="chevronDroite" taille={14} />
              </span>}
            <span class="dates-dossier">{periode(r.duTotal, r.auTotal)}</span>
            {calendrier && <BulleCalendrier liste={calendrier.liste} retenu={calendrier.retenu} enTete={t`Votre calendrier pendant ce dossier`} taille={14} />}
            {petit !== undefined && !arbre.simple && <IconePetit n={petit} />}
            {total === 0 && d.parent !== null && <span class="badge vide">{t`vide`}</span>}
            {(arbre.nouveaux.get(d.id) ?? 0) > 0 && (
              <span class="badge nouveau" title={t`${pluriel(arbre.nouveaux.get(d.id)!, 'photo ou vidéo arrivée', 'photos ou vidéos arrivées')} avec la mise à jour de l’inventaire, pas encore dans la sortie`}>
                +{nombre(arbre.nouveaux.get(d.id)!)}
              </span>
            )}
            {(arbre.alertes.get(d.id) ?? []).map(([texte, aide]) => (
              <span key={texte} class={`badge alerte-dossier ${texte === 'gardé' || texte === 'ne pas toucher' ? 'info' : ''}`} title={aide}>
                {t(texte)}
              </span>
            ))}
          </span>
          {/* Trouvé par la recherche grâce à son événement : on le dit, sinon la ligne semblerait sans rapport. */}
          {trouve && (
            <span class="evenement-trouve">
              <Icone nom="calendrier" taille={14} />
              <span>{trouve}</span>
            </span>
          )}
        </div>
        <span class="nombre-dossier">{nombre(total)}</span>
        {avecMenu && (
          <button
            type="button"
            class="plus-dossier"
            aria-label={t`Actions sur « ${d.nom} »`}
            aria-haspopup="menu"
            aria-expanded={menuIci}
            title={t`Renommer, réunir, mettre dans un autre dossier… (aussi au clic droit)`}
            onClick={(e) => {
              e.stopPropagation();
              if (menuIci) menuDossier.value = null;
              else {
                const b = e.currentTarget.getBoundingClientRect();
                ouvrirMenuDossier(d.id, b.left, b.bottom + 4, e.currentTarget, 'liste');
              }
            }}
            onDblClick={(e) => e.stopPropagation()}
          >
            <Icone nom="points" taille={16} />
          </button>
        )}
      </div>
      {deplie && enfants.length > 0 && (
        <ul>
          {enfants.map((e) => (
            <Ligne key={e.id} d={e} profondeur={profondeur + 1} arbre={arbre} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * L'icône « petit dossier » (D112 point 10), grise : rien à faire ici (jamais en brun). En vrac, l'étape suivante
 * s'en occupe ; dans un dossier déjà trié, le menu « … » permet de le réunir avec un autre.
 */
function IconePetit({ n }: { n: number }) {
  const vrac = session.value!.projet.mode === 'vrac';
  return (
    <BulleIcone icone="dossier" classe="petit" nom={t`Petit dossier : ${pluriel(n, 'photo')}`} enTete={t`Petit dossier : ${pluriel(n, 'photo')}`} taille={14}>
      <p>{vrac ? t`Il sera traité à l’étape suivante, « Petits dossiers », qui vous proposera un dossier voisin. Rien à faire ici.` : t`Moins de ${SEUIL_PETIT} photos : vous pouvez le réunir avec un autre dossier (menu « … »).`}</p>
    </BulleIcone>
  );
}

async function fusionner(source: string, cible: string) {
  const s = session.value!;
  const a = s.plan.dossiers.get(source);
  const b = s.plan.dossiers.get(cible);
  if (!a || !b) return;
  const r = resumes(s.plan).get(source)!;
  const ok = await confirmer(
    t`Réunir les dossiers ?`,
    t`Les ${nombre(r.photosTotal + r.videosTotal)} photos et vidéos de « ${a.nom} », avec ses sous-dossiers, passent dans « ${b.nom === 'Photos' && b.parent === null ? t`Photos, le dossier principal` : b.nom} », puis « ${a.nom} » disparaît. Ctrl+Z annule.`,
    t`Réunir`,
  );
  if (!ok) return;
  try {
    appliquer(fusionnerDossiers(s.plan, source, cible));
    if (vue.value === source) choisirVue(cible);
    notifier('ok', t`« ${a.nom} » réuni dans « ${b.nom} ».`, { libelle: t`Annuler`, faire: annuler });
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

/** Panneau des dossiers ; `simple` (Sélection) : la recherche et la liste seulement, sans outils d'organisation. */
export function PanneauDossiers({ simple = false }: { simple?: boolean }) {
  const s = session.value!;
  const version = versionPlan.value;
  const [filtre, setFiltre] = useState('');
  const [seulementAlertes, setSeulementAlertes] = useState(false);
  const [seulementNouveaux, setSeulementNouveaux] = useState(false);
  // En quittant la page, le menu « … » et la fenêtre de choix se ferment : ils ne réapparaissent pas au retour.
  useEffect(
    () => () => {
      menuDossier.value = null;
      choixDossier.value = null;
    },
    [],
  );

  const arbre = useMemo<Arbre>(() => {
    const enfants = new Map<string, DossierPlan[]>();
    const comparer = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare;
    for (const d of s.plan.dossiers.values()) {
      if (d.parent === null) continue;
      enfants.set(d.parent, [...(enfants.get(d.parent) ?? []), d]);
    }
    const r = resumes(s.plan);
    // Par période : la même arborescence, chaque niveau dans l'ordre du temps (D89).
    const debut = (d: DossierPlan) => r.get(d.id)?.duTotal ?? '9999';
    for (const l of enfants.values()) l.sort((a, b) => (ordrePanneau.value === 'periode' && debut(a).localeCompare(debut(b))) || comparer(a.nom, b.nom));
    let visibles: Set<string> | null = null;
    const evts = evenementsDesDossiers(s.plan, evenements.value);
    const q = simplifier(filtre.trim());
    const parEvenement = new Map<string, string>();
    if (q) {
      visibles = new Set([RACINE]);
      for (const d of s.plan.dossiers.values()) {
        // Le titre de l'événement aussi : « Lea » trouve le dossier de son anniversaire ; il s'écrit alors sous la ligne.
        if (!simplifier(d.nom).includes(q)) {
          const e = evts.get(d.id)?.liste.find((x) => simplifier(x.titre).includes(q));
          if (!e) continue;
          parEvenement.set(d.id, e.titre);
        }
        let x: DossierPlan | undefined = d;
        while (x) {
          visibles.add(x.id);
          x = x.parent === null ? undefined : s.plan.dossiers.get(x.parent);
        }
      }
    }
    // L'icône « petit dossier », même en vrac (D112 point 10, réponse 18 ; D94 levée sur ce point).
    const petits = new Map<string, number>();
    if (s.projet.mode === 'vrac') for (const d of petitsDe(s)) petits.set(d.id, d.photos.length);
    else
      for (const d of s.plan.dossiers.values()) {
        const x = r.get(d.id)!;
        if (d.parent !== null && x.photos + x.videos > 0 && x.photos + x.videos < SEUIL_PETIT) petits.set(d.id, x.photos + x.videos);
      }
    const alertes = alertesDossiers(s.plan, r, lireReglages(s.aides.get('consolidation_reglages'), rayonDuProjet(s.projet.tri)));
    if (seulementAlertes) {
      const avec = new Set([RACINE]);
      for (const d of s.plan.dossiers.values()) {
        const a = alertes.get(d.id)?.filter(([code]) => code !== 'gardé' && code !== 'ne pas toucher') ?? [];
        if (!a.length && !petits.has(d.id)) continue;
        for (let y: DossierPlan | undefined = d; y; y = y.parent === null ? undefined : s.plan.dossiers.get(y.parent)) avec.add(y.id);
      }
      visibles = visibles ? new Set([...visibles].filter((id) => avec.has(id))) : avec;
    }
    const nouveaux = dossiersNouveaux(s.plan, (id) => id in s.etatSortie.fichiers);
    // « Nouveautés seulement » : les dossiers où sont arrivées des photos, et leurs parents pour les atteindre.
    if (seulementNouveaux && nouveaux.size) {
      const avec = new Set([RACINE]);
      for (const id of nouveaux.keys()) for (let y = s.plan.dossiers.get(id); y; y = y.parent === null ? undefined : s.plan.dossiers.get(y.parent)) avec.add(y.id);
      visibles = visibles ? new Set([...visibles].filter((id) => avec.has(id))) : avec;
    }
    return { enfants, resumes: r, visibles, alertes, nouveaux, evenements: evts, petits, parEvenement, simple };
  }, [version, versionIA.value, filtre, seulementAlertes, seulementNouveaux, ordrePanneau.value, evenements.value, simple]);

  const nbMisDeCote = elementsVue(s.plan, VUE_MIS_DE_COTE).length;
  const nbAutres = elementsVue(s.plan, VUE_AUTRES).length;
  const racine = s.plan.dossiers.get(RACINE)!;

  const nouveau = useCible(
    () => glisse.get()?.type === 'fichiers',
    () => {
      const g = glisse.get();
      if (g?.type === 'fichiers') void nouveauDossierAvec(g.ids, parentPourNouveau());
    },
  );
  const deCote = useCible(
    () => glisse.get()?.type === 'fichiers',
    () => {
      const g = glisse.get();
      if (g?.type === 'fichiers') mettreSelectionDeCote(g.ids);
    },
  );

  // « Mis de côté » et « Autres fichiers » terminent la liste et défilent avec elle ; la Sélection ne les montre pas.
  const speciales = simple ? null : (
    <>
      <li class="separateur-liste" aria-hidden="true" />
      <li>
        <div
          class={`ligne-dossier speciale${vue.value === VUE_MIS_DE_COTE ? ' actif' : ''}${deCote.survol ? ' cible' : ''}`}
          {...deCote.props}
          onClick={() => choisirVue(VUE_MIS_DE_COTE)}
          title={t`Ce qui est écarté va ici, puis dans le dossier « ${nomsSortie().misDeCote} » de la sortie : rien n’est supprimé`}
        >
          <span class="nom-dossier">{t`Mis de côté`}</span>
          <span class="nombre-dossier">{nombre(nbMisDeCote)}</span>
        </div>
      </li>
      <li>
        <div class={`ligne-dossier speciale${vue.value === VUE_AUTRES ? ' actif' : ''}`} onClick={() => choisirVue(VUE_AUTRES)} title={t`Ni photo ni vidéo : copiés dans « ${nomsSortie().autres} » avec leur chemin d’origine`}>
          <span class="nom-dossier">{t`Autres fichiers`}</span>
          <span class="nombre-dossier">{nombre(nbAutres)}</span>
        </div>
      </li>
    </>
  );

  return (
    <aside class={`panneau-dossiers${simple ? ' liste-simple' : ''}`} aria-label={t`Dossiers`}>
      <div
        class="poignee-panneau"
        role="separator"
        aria-orientation="vertical"
        title={t`Tirer pour élargir le panneau (double-clic : largeur d’origine)`}
        onPointerDown={redimensionner}
        onDblClick={() => changerReglages({ ...reglages.value, largeurPanneau: REGLAGES_DEFAUT.largeurPanneau })}
      />
      <div class="recherche-dossiers">
        <input type="search" placeholder={t`Chercher…`} aria-label={t`Chercher un dossier`} value={filtre} onInput={(e) => setFiltre(e.currentTarget.value)} />
        <div class="options-panneau">
          <select value={ordrePanneau.value} onChange={(e) => (ordrePanneau.value = e.currentTarget.value as OrdrePanneau)} aria-label={t`Présentation des dossiers`}>
            <option value="arbre">{t`Par nom`}</option>
            <option value="periode">{t`Par période`}</option>
            <option value="taille">{t`Par taille (les plus petits d’abord)`}</option>
          </select>
          <button
            type="button"
            class={`bouton-icone${seulementAlertes ? ' actif' : ''}`}
            aria-pressed={seulementAlertes}
            onClick={() => setSeulementAlertes(!seulementAlertes)}
            title={t`Seulement les dossiers avec une alerte : sans date, nom en double, même sortie ?`}
          >
            <Icone nom="alerte" taille={16} />
            {t`Alertes`}
          </button>
          {!simple && (
            <button
              type="button"
              class={`bouton-icone bouton-nouveau${nouveau.survol ? ' cible' : ''}`}
              {...nouveau.props}
              onClick={() => void nouveauDossierAvec([], dossierPourNouveauVide())}
              title={t`Nouveau dossier, dans le dossier affiché ; des photos déposées ici partent dans un dossier voisin`}
            >
              <Icone nom="plus" taille={16} />
              {t`Nouveau`}
            </button>
          )}
        </div>
        {arbre.nouveaux.size > 0 && (
          <label class="case case-nouveautes" title={t`Photos ajoutées à la source après le premier tri (mise à jour de l’inventaire), pas encore écrites dans la sortie`}>
            <input type="checkbox" checked={seulementNouveaux} onChange={(e) => setSeulementNouveaux(e.currentTarget.checked)} />{' '}
            {t`Seulement les nouveautés (${pluriel(arbre.nouveaux.size, 'dossier')})`}
          </label>
        )}
      </div>
      {ordrePanneau.value === 'taille' ? (
        <ul class="arbre plat">
          {[...s.plan.dossiers.values()]
            .filter((d) => {
              const x = arbre.resumes.get(d.id)!;
              return d.parent !== null && x.photos + x.videos > 0 && (!arbre.visibles || arbre.visibles.has(d.id));
            })
            .sort((a, b) => {
              const x = arbre.resumes.get(a.id)!;
              const y = arbre.resumes.get(b.id)!;
              return x.photos + x.videos - (y.photos + y.videos) || (x.du ?? '9').localeCompare(y.du ?? '9') || a.nom.localeCompare(b.nom);
            })
            .map((d) => (
              <Ligne key={d.id} d={d} profondeur={0} arbre={arbre} plat />
            ))}
          {speciales}
        </ul>
      ) : (
        <ul class="arbre">
          <Ligne d={racine} profondeur={0} arbre={arbre} />
          {speciales}
        </ul>
      )}
      {!simple && <MenuDossier />}
      {!simple && choixDossier.value && <DialogueChoixDossier {...choixDossier.value} />}
    </aside>
  );
}

/** Fenêtre de choix d'un dossier ouverte : réunir celui-ci avec un autre, ou le mettre dans un autre (menu « … »). */
const choixDossier = signal<{ id: string; mode: 'reunir' | 'mettre' } | null>(null);

/** Ouvre la fenêtre « Réunir avec… » ou « Mettre dans… » pour ce dossier. */
export function choisirDossierPour(id: string, mode: 'reunir' | 'mettre') {
  choixDossier.value = { id, mode };
}

/** Écart en jours entre deux périodes (0 si elles se touchent ou se chevauchent). */
function ecartJours(a: ResumeDossier, b: ResumeDossier): number {
  if (!a.duTotal || !a.auTotal || !b.duTotal || !b.auTotal) return Infinity;
  const jour = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;
  return Math.max(0, jour(b.duTotal) - jour(a.auTotal), jour(a.duTotal) - jour(b.auTotal));
}

/** Met un dossier dans un autre, avec son contenu (Ctrl+Z annule) ; il devient un sous-dossier, ses photos restent. */
function mettreDans(id: string, cible: string) {
  const s = session.value!;
  const d = s.plan.dossiers.get(id);
  const c = s.plan.dossiers.get(cible);
  if (!d || !c) return;
  try {
    appliquer(deplacerDossier(s.plan, id, cible));
    // Le dossier d'arrivée s'ouvre dans le panneau : on y voit celui qu'on vient de mettre.
    deplies.value = new Set([...deplies.value, cible]);
    const ou = c.parent === null ? t`Photos, le dossier principal` : c.nom;
    notifier('ok', t`« ${d.nom} » est maintenant dans « ${ou} ».`, { libelle: t`Annuler`, faire: annuler });
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

/**
 * Choix d'un dossier (D94 ; D112 point 10) : les plus proches dans le temps d'abord (la même sortie coupée en
 * deux, le « _b » du même jour), ou une partie du nom tapée ; les dossiers techniques (captures, sans date,
 * « _… ») et « Ne pas toucher » en dernier. « Réunir » demande ensuite confirmation, comme en glissant un
 * dossier sur un autre ; « Mettre dans » se fait tout de suite (Ctrl+Z annule) et propose aussi « Photos »,
 * le dossier principal, mais ni le dossier où il est déjà ni ses propres sous-dossiers.
 */
function DialogueChoixDossier({ id, mode }: { id: string; mode: 'reunir' | 'mettre' }) {
  const s = session.value!;
  const [requete, setRequete] = useState('');
  const [index, setIndex] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => champ.current?.focus(), []);
  const r = resumes(s.plan);
  const source = s.plan.dossiers.get(id);
  const candidats = useMemo(
    () =>
      [...s.plan.dossiers.values()]
        .filter((d) => d.id !== id && !estDescendant(s.plan, d.id, id))
        .filter((d) => (mode === 'reunir' ? r.get(d.id)!.photosTotal + r.get(d.id)!.videosTotal > 0 : d.id !== source?.parent))
        .map((d) => ({
          id: d.id,
          chemin: d.parent === null ? (mode === 'mettre' ? t`Photos, le dossier principal` : t`Photos (racine)`) : cheminDossier(s.plan, d.id),
          apart: d.parent === null || d.nom.startsWith('_') || estNomDeSortie('captures', d.nom) || estNomDeSortie('sansDate', d.nom) || nePasToucher(s.plan, d.id) ? 1 : 0,
          ecart: ecartJours(r.get(id)!, r.get(d.id)!),
          periode: periode(r.get(d.id)!.duTotal, r.get(d.id)!.auTotal),
        }))
        .sort((a, b) => a.apart - b.apart || a.ecart - b.ecart || a.chemin.localeCompare(b.chemin, 'fr', { numeric: true })),
    [versionPlan.value, id, mode],
  );
  if (!source) return null;
  const q = simplifier(requete.trim());
  const options = q ? candidats.filter((c) => simplifier(c.chemin).includes(q)) : candidats;
  const choix = Math.min(index, options.length - 1);
  const fermer = () => (choixDossier.value = null);
  const valider = (o = options[choix]) => {
    if (!o) return;
    fermer();
    if (mode === 'reunir') void fusionner(id, o.id);
    else mettreDans(id, o.id);
  };
  // Par un portail : rendue depuis la liste collée des dossiers, elle serait recouverte par les photos.
  return createPortal(
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue deplacer" role="dialog" aria-modal="true" aria-label={mode === 'reunir' ? t`Réunir avec un autre dossier` : t`Mettre dans un autre dossier`}>
        <h2>{mode === 'reunir' ? t`Réunir « ${source.nom} » avec…` : t`Mettre « ${source.nom} » dans…`}</h2>
        <p class="discret">
          {mode === 'reunir'
            ? t`Ses photos passent dans le dossier choisi. Les plus proches dans le temps sont en tête.`
            : t`Il devient un sous-dossier du dossier choisi, avec ses photos. Les plus proches dans le temps sont en tête.`}
        </p>
        <input
          ref={champ}
          class="large"
          placeholder={t`Tapez une partie du nom du dossier`}
          aria-label={t`Chercher un dossier`}
          value={requete}
          onInput={(e) => {
            setRequete(e.currentTarget.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') fermer();
            else if (e.key === 'ArrowDown') setIndex(Math.min(options.length - 1, choix + 1));
            else if (e.key === 'ArrowUp') setIndex(Math.max(0, choix - 1));
            else if (e.key === 'Enter') valider();
            else return;
            e.preventDefault();
          }}
        />
        <ul class="choix-dossiers">
          {options.slice(0, 200).map((o, i) => (
            <li key={o.id} class={i === choix ? 'actif' : ''} onMouseEnter={() => setIndex(i)} onClick={() => valider(o)}>
              {o.chemin} <span class="discret">{o.periode}</span>
            </li>
          ))}
          {!options.length && <li class="discret">{t`Aucun dossier ne correspond.`}</li>}
        </ul>
        <p class="discret">{mode === 'reunir' ? t`↑ ↓ pour choisir, Entrée pour réunir, Échap pour fermer.` : t`↑ ↓ pour choisir, Entrée pour l’y mettre, Échap pour fermer.`}</p>
      </div>
    </div>,
    document.body,
  );
}

/** Menu « … » ouvert : le dossier, où le poser, le bouton à qui rendre le focus, et d'où il vient (liste ou tête). */
export const menuDossier = signal<{ id: string; x: number; y: number; retour: HTMLElement | null; depuis: 'liste' | 'tete' } | null>(null);

/** Ouvre le menu « … » d'un dossier (bouton « … », clic droit, Maj+F10). */
export function ouvrirMenuDossier(id: string, x: number, y: number, retour: HTMLElement | null, depuis: 'liste' | 'tete') {
  menuDossier.value = { id, x, y, retour, depuis };
}

/**
 * Les actions du menu « … » d'un dossier (C-4.14 : des actions, jamais un filtre) : Renommer, Réunir avec un
 * autre dossier, Mettre dans un autre dossier, Déplacer les photos choisies (celles du dossier affiché),
 * Retirer ce dossier s'il est vide. Une action impossible reste à sa place, grisée, sa raison écrite dessous.
 */
function actionsDossier(id: string): ActionMenu[] {
  const s = session.value!;
  const d = s.plan.dossiers.get(id)!;
  const r = resumes(s.plan).get(id);
  const vide = (r?.photosTotal ?? 0) + (r?.videosTotal ?? 0) === 0;
  const sousDossiers = [...s.plan.dossiers.values()].some((x) => x.parent === id);
  const choisies = vue.value === id ? selection.value.size : 0;
  return [
    { libelle: t`Renommer`, icone: 'crayon', touche: 'F2', faire: () => commencerRenommage(id) },
    {
      libelle: t`Réunir avec un autre dossier…`,
      icone: 'reunir',
      detail: vide ? t`Il est vide : rien à réunir.` : t`Ses photos y vont ; ce dossier disparaît.`,
      desactivee: vide,
      faire: () => (choixDossier.value = { id, mode: 'reunir' }),
    },
    { libelle: t`Mettre dans un autre dossier…`, icone: 'dossierFleche', detail: t`Il devient un sous-dossier, ses photos restent.`, faire: () => (choixDossier.value = { id, mode: 'mettre' }) },
    {
      libelle: t`Déplacer les photos choisies…`,
      icone: 'photo',
      touche: 'M',
      detail: choisies ? t`${pluriel(choisies, 'photo choisie', 'photos choisies')}, vers un autre dossier.` : vue.value === id ? t`Choisissez d’abord des photos.` : t`Ouvrez ce dossier et choisissez des photos.`,
      desactivee: !choisies,
      faire: () => (deplacerOuvert.value = true),
    },
    {
      libelle: t`Retirer ce dossier`,
      icone: 'dossierMoins',
      detail: vide && !sousDossiers ? t`Il est vide : il ne sera pas créé.` : t`Seulement s’il est vide.`,
      desactivee: !vide || sousDossiers,
      apart: true,
      faire: () => {
        try {
          appliquer(supprimerDossierVide(s.plan, id));
          if (vue.value === id) choisirVue(d.parent!);
          notifier('ok', t`Dossier vide « ${d.nom} » retiré.`, { libelle: t`Annuler`, faire: annuler });
        } catch (err) {
          notifier('erreur', texteErreur(err));
        }
      },
    },
  ];
}

/** Le menu « … » ouvert, un seul à la fois. */
function MenuDossier() {
  const m = menuDossier.value;
  const s = session.value!;
  versionPlan.value;
  const d = m ? s.plan.dossiers.get(m.id) : undefined;
  if (!m || !d || d.parent === null) return null;
  return <MenuActions titre={d.nom} actions={actionsDossier(d.id)} x={m.x} y={m.y} retour={m.retour} fermer={() => (menuDossier.value = null)} />;
}

/**
 * Petit dossier au sens de l'icône de la liste (D112 point 10) : son nombre de photos, ou `undefined`. En vrac,
 * ceux que l'étape « Petits dossiers » examinera ; dans un dossier déjà trié, ceux de moins de 5 photos.
 */
export function petitDossier(id: string): number | undefined {
  const s = session.value!;
  if (s.projet.mode === 'vrac') return petitsDe(s).find((d) => d.id === id)?.photos.length;
  const r = resumes(s.plan).get(id);
  const n = (r?.photos ?? 0) + (r?.videos ?? 0);
  return s.plan.dossiers.get(id)?.parent !== null && n > 0 && n < SEUIL_PETIT ? n : undefined;
}

/** Ouvre le menu « … » du dossier affiché sous son bouton de la tête (Maj+F10, touche Menu du clavier). */
export function ouvrirMenuDossierAffiche() {
  const d = session.value!.plan.dossiers.get(vue.value);
  if (!d || d.parent === null) return;
  const b = document.querySelector<HTMLElement>('.tete-vue .plus-dossier');
  const r = b?.getBoundingClientRect();
  ouvrirMenuDossier(d.id, r?.left ?? 320, (r?.bottom ?? 120) + 4, b, 'tete');
}

/** Le crayon et « … » du dossier affiché, juste après son nom (étape « Lieux et sorties », D112 point 10). */
export function ActionsDossier() {
  const s = session.value!;
  versionPlan.value;
  const d = s.plan.dossiers.get(vue.value);
  if (!d || d.parent === null) return null;
  const ouvert = menuDossier.value?.id === d.id && menuDossier.value.depuis === 'tete';
  return (
    <span class="actions-dossier">
      <button type="button" class="bouton-icone" aria-label={t`Renommer « ${d.nom} » (F2)`} title={t`Renommer (F2, ou double-clic sur le dossier à gauche)`} onClick={() => commencerRenommage(d.id)}>
        <Icone nom="crayon" taille={16} />
      </button>
      <button
        type="button"
        class="bouton-icone plus-dossier"
        aria-label={t`Actions sur « ${d.nom} »`}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title={t`Renommer, réunir, mettre dans un autre dossier… (Maj+F10)`}
        onClick={(e) => {
          if (ouvert) menuDossier.value = null;
          else {
            const b = e.currentTarget.getBoundingClientRect();
            ouvrirMenuDossier(d.id, b.left, b.bottom + 4, e.currentTarget, 'tete');
          }
        }}
      >
        <Icone nom="points" taille={16} />
      </button>
    </span>
  );
}
