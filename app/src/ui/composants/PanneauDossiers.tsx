// Panneau des dossiers (SPEC § 5.3) : arborescence avec nombres et dates,
// dépôt des photos glissées, fusion, renommage, création.

import { estNomDeSortie, nomsSortie } from '../../lib/sortie';
import { signal } from '@preact/signals';
import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import { cleNom } from '../../lib/noms';
import { cheminDossier, estDescendant, fusionnerDossiers, renommerDossier, resumes, RACINE, scinderParJour, supprimerDossierVide, type DossierPlan, type Modification, type Plan, type ResumeDossier } from '../../lib/plan';
import { appliquer, changerReglages, notifier, reglages, session, texteErreur, versionPlan } from '../etat';
import { REGLAGES_DEFAUT } from '../../navigateur/reglages';
import { nombre, periode } from '../format';
import {
  choisirVue,
  deplacerVers,
  deplies,
  dossierPourNouveauVide,
  elementsVue,
  glisse,
  mettreSelectionDeCote,
  nouveauDossierAvec,
  ordrePanneau,
  parentPourNouveau,
  renommage,
  simplifier,
  vue,
  VUE_AUTRES,
  VUE_MIS_DE_COTE,
} from '../organiser';
import { confirmer } from './Dialogues';
import { Icone } from './Icones';

/** En dessous de ce nombre de photos, un dossier est signalé « petit » (§ 6.4). */
export const SEUIL_PETIT = 3;

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

/** Tirer le bord droit du panneau l'élargit ; un double-clic revient à la largeur d'origine. */
function redimensionner(e: PointerEvent) {
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

/** Titre de la vue : le nom du dossier en grand, ses dossiers parents au-dessus, en petit et cliquables. */
export function TitreVue({ titre, id }: { titre: string; id?: string }) {
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
              <span aria-hidden="true">›</span>
            </Fragment>
          ))}
        </div>
      )}
      <h2 title={id ? cheminDossier(s.plan, id) : titre}>{titre}</h2>
    </div>
  );
}

interface Arbre {
  enfants: Map<string, DossierPlan[]>;
  resumes: Map<string, ResumeDossier>;
  visibles: Set<string> | null;
  /** Alertes de chaque dossier (§ 6.4) : libellé court (en français, traduit à l'affichage) et explication. */
  alertes: Map<string, [string, string][]>;
}

/** Badges d'alerte de l'arborescence prévue (§ 6.4) : le libellé court sert aussi de code (« gardé », « hors album »), traduit à l'affichage. */
export function alertesDossiers(plan: Plan, r: Map<string, ResumeDossier>): Map<string, [string, string][]> {
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
  // Chevauchement : deux dossiers voisins dont les photos s'entremêlent dans le temps (A, puis B, puis
  // de nouveau A) : sans doute la même sortie coupée en deux. Deux sorties le même jour, l'une après
  // l'autre, sont normales et ne sont pas signalées.
  const instants = new Map<string, string[]>();
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre' || !f.date || f.date.length < 19) continue;
    instants.set(f.dossier, [...(instants.get(f.dossier) ?? []), f.date]);
  }
  for (const l of instants.values()) l.sort();
  // Une photo de b prise strictement entre la première et la dernière de a (recherche dichotomique dans b, trié).
  const entremeles = (a: string[], b: string[]) => {
    let bas = 0;
    let haut = b.length;
    while (bas < haut) {
      const m = (bas + haut) >> 1;
      if (b[m] <= a[0]) bas = m + 1;
      else haut = m;
    }
    return bas < b.length && b[bas] < a.at(-1)!;
  };
  for (const liste of freres.values()) {
    const sorties = liste.filter((d) => d.tri?.origine !== 'lieu_connu' && !d.traitement && !d.nom.startsWith('_') && (instants.get(d.id)?.length ?? 0) > 0);
    for (const a of sorties) {
      const autre = sorties.find((b) => b !== a && entremeles(instants.get(a.id)!, instants.get(b.id)!));
      if (autre) ajouter(a.id, [aTraduire('chevauche'), t`Photos entremêlées avec « ${autre.nom} » : la même sortie ?`]);
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

function Ligne({ d, profondeur, arbre, plat = false }: { d: DossierPlan; profondeur: number; arbre: Arbre; plat?: boolean }) {
  const s = session.value!;
  const r = arbre.resumes.get(d.id)!;
  // À plat (tri par période) : pas de sous-dossiers ; le dossier parent est rappelé sous le nom.
  const enfants = plat ? [] : (arbre.enfants.get(d.id) ?? []);
  const deplie = deplies.value.has(d.id) || arbre.visibles !== null;
  const actif = vue.value === d.id;
  const enRenommage = renommage.value === d.id;
  const total = r.photosTotal + r.videosTotal;
  const direct = r.photos + r.videos;

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

  const terminerRenommage = (nom: string | null) => {
    renommage.value = null;
    if (nom === null || nom.trim() === d.nom) return;
    try {
      appliquer(renommerDossier(s.plan, d.id, nom));
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  if (arbre.visibles && !arbre.visibles.has(d.id)) return null;

  return (
    <li>
      <div
        class={`ligne-dossier${actif ? ' actif' : ''}${cible.survol ? ' cible' : ''}`}
        style={{ paddingLeft: `${8 + profondeur * 16}px` }}
        draggable={d.parent !== null && !enRenommage}
        onDragStart={(e) => glisse.commencer({ type: 'dossier', id: d.id }, e)}
        onDragEnd={glisse.finir}
        onClick={() => choisirVue(d.id)}
        onDblClick={() => d.parent !== null && (renommage.value = d.id)}
        {...cible.props}
        title={
          t`${d.parent === null ? t`Photos (racine)` : cheminDossier(s.plan, d.id)} — ${nombre(r.photosTotal)} photos, ${nombre(r.videosTotal)} vidéos` +
          (enfants.length ? t` (dont ${nombre(direct)} directement)` : '')
        }
      >
        <button type="button" class="deplier" onClick={basculer} aria-label={deplie ? t`Replier` : t`Déplier`} disabled={!enfants.length}>
          {enfants.length ? (deplie ? '▾' : '▸') : ''}
        </button>
        <div class="texte-dossier">
          {enRenommage ? (
            <input
              class="renommage"
              value={d.nom}
              ref={(el) => {
                if (el) setTimeout(() => el.select(), 0);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') terminerRenommage(e.currentTarget.value);
                if (e.key === 'Escape') terminerRenommage(null);
              }}
              onBlur={(e) => terminerRenommage(e.currentTarget.value)}
            />
          ) : (
            <span class="nom-dossier">{d.parent === null ? t`Photos (racine)` : d.nom}</span>
          )}
          {/* Deuxième ligne : où il se trouve (à plat), dates et alertes ; le nom garde toute la largeur. */}
          <span class="infos-dossier">
            {plat && d.parent !== null && d.parent !== RACINE && <span class="chemin-dossier">{cheminDossier(s.plan, d.parent)} ›</span>}
            <span class="dates-dossier">{periode(r.duTotal, r.auTotal)}</span>
            {direct > 0 && direct < SEUIL_PETIT && (
              <span class="badge petit" title={t`Petit dossier : moins de ${SEUIL_PETIT} photos`}>
                {t`petit`}
              </span>
            )}
            {total === 0 && d.parent !== null && <span class="badge vide">{t`vide`}</span>}
            {(arbre.alertes.get(d.id) ?? []).map(([texte, aide]) => (
              <span key={texte} class={`badge alerte-dossier ${texte === 'gardé' || texte === 'ne pas toucher' ? 'info' : ''}`} title={aide}>
                {t(texte)}
              </span>
            ))}
          </span>
        </div>
        <span class="nombre-dossier">{nombre(total)}</span>
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

async function fusionner(source: string, cible: string) {
  const s = session.value!;
  const a = s.plan.dossiers.get(source);
  const b = s.plan.dossiers.get(cible);
  if (!a || !b) return;
  const r = resumes(s.plan).get(source)!;
  const ok = await confirmer(
    t`Fusionner les dossiers ?`,
    t`Les ${nombre(r.photosTotal + r.videosTotal)} photos et vidéos de « ${a.nom} » (avec ses sous-dossiers) passent dans « ${b.nom === 'Photos' && b.parent === null ? t`Photos (racine)` : b.nom} », puis « ${a.nom} » disparaît. Ctrl+Z annule.`,
    t`Fusionner`,
  );
  if (!ok) return;
  try {
    appliquer(fusionnerDossiers(s.plan, source, cible));
    if (vue.value === source) choisirVue(cible);
    notifier('ok', t`« ${a.nom} » fusionné dans « ${b.nom} ».`);
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

  const arbre = useMemo<Arbre>(() => {
    const enfants = new Map<string, DossierPlan[]>();
    const comparer = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare;
    for (const d of s.plan.dossiers.values()) {
      if (d.parent === null) continue;
      enfants.set(d.parent, [...(enfants.get(d.parent) ?? []), d]);
    }
    for (const l of enfants.values()) l.sort((a, b) => comparer(a.nom, b.nom));
    let visibles: Set<string> | null = null;
    const q = simplifier(filtre.trim());
    if (q) {
      visibles = new Set([RACINE]);
      for (const d of s.plan.dossiers.values()) {
        if (!simplifier(d.nom).includes(q)) continue;
        let x: DossierPlan | undefined = d;
        while (x) {
          visibles.add(x.id);
          x = x.parent === null ? undefined : s.plan.dossiers.get(x.parent);
        }
      }
    }
    const r = resumes(s.plan);
    const alertes = alertesDossiers(s.plan, r);
    if (seulementAlertes) {
      const avec = new Set([RACINE]);
      for (const d of s.plan.dossiers.values()) {
        const a = alertes.get(d.id)?.filter(([code]) => code !== 'gardé' && code !== 'ne pas toucher') ?? [];
        const x = r.get(d.id)!;
        const petit = d.parent !== null && x.photos + x.videos > 0 && x.photos + x.videos < SEUIL_PETIT;
        if (!a.length && !petit) continue;
        for (let y: DossierPlan | undefined = d; y; y = y.parent === null ? undefined : s.plan.dossiers.get(y.parent)) avec.add(y.id);
      }
      visibles = visibles ? new Set([...visibles].filter((id) => avec.has(id))) : avec;
    }
    return { enfants, resumes: r, visibles, alertes };
  }, [version, filtre, seulementAlertes]);

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
          title={t`Ce qui est écarté va dans « ${nomsSortie().misDeCote} » : rien n’est supprimé`}
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
    <aside class="panneau-dossiers" aria-label={t`Dossiers`}>
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
          <select value={ordrePanneau.value} onChange={(e) => (ordrePanneau.value = e.currentTarget.value as 'arbre' | 'periode')} aria-label={t`Présentation des dossiers`}>
            <option value="arbre">{t`Par dossier`}</option>
            <option value="periode">{t`Par période`}</option>
          </select>
          <button
            type="button"
            class={`bouton-icone${seulementAlertes ? ' actif' : ''}`}
            aria-pressed={seulementAlertes}
            onClick={() => setSeulementAlertes(!seulementAlertes)}
            title={t`Seulement les dossiers avec une alerte (petit, sans date, nom en double…)`}
            aria-label={t`Seulement les alertes`}
          >
            <Icone nom="alerte" taille={16} />
          </button>
          {!simple && (
            <button
              type="button"
              class={`bouton-icone bouton-nouveau${nouveau.survol ? ' cible' : ''}`}
              {...nouveau.props}
              onClick={() => void nouveauDossierAvec([], dossierPourNouveauVide())}
              title={t`Nouveau dossier, dans le dossier affiché (des photos déposées ici partent dans un dossier voisin)`}
              aria-label={t`Nouveau dossier`}
            >
              <Icone nom="plus" taille={18} />
            </button>
          )}
        </div>
      </div>
      {ordrePanneau.value === 'periode' ? (
        <ul class="arbre plat">
          {[...s.plan.dossiers.values()]
            .filter((d) => {
              const x = arbre.resumes.get(d.id)!;
              return (d.parent === null || x.photos + x.videos > 0) && (!arbre.visibles || arbre.visibles.has(d.id));
            })
            .sort((a, b) => (a.parent === null ? -1 : b.parent === null ? 1 : (arbre.resumes.get(a.id)!.du ?? '9').localeCompare(arbre.resumes.get(b.id)!.du ?? '9') || a.nom.localeCompare(b.nom)))
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
    </aside>
  );
}

/** Actions sur le dossier affiché (étape « Lieux et sorties ») : à côté de son titre. */
export function ActionsDossier() {
  const s = session.value!;
  versionPlan.value;
  const d = s.plan.dossiers.get(vue.value);
  if (!d || d.parent === null) return null;
  const r = resumes(s.plan).get(d.id);
  const vide = (r?.photosTotal ?? 0) + (r?.videosTotal ?? 0) === 0;
  const plusieursJours = !!(r?.du && r.au && r.du.slice(0, 10) !== r.au.slice(0, 10));
  const faire = (m: () => Modification | null) => {
    try {
      appliquer(m());
      choisirVue(d.parent!);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };
  return (
    <span class="actions-dossier">
      <button type="button" class="bouton-icone" onClick={() => (renommage.value = d.id)} title={t`Renommer (F2 ou double-clic sur le dossier)`} aria-label={t`Renommer`}>
        <Icone nom="crayon" taille={16} />
      </button>
      {plusieursJours && (
        <button type="button" class="doux" title={t`Un dossier voisin par journée`} onClick={() => faire(() => scinderParJour(s.plan, d.id))}>
          {t`Scinder par jour`}
        </button>
      )}
      {vide && (
        <button type="button" class="doux" onClick={() => faire(() => supprimerDossierVide(s.plan, d.id))}>
          {t`Supprimer (vide)`}
        </button>
      )}
    </span>
  );
}
