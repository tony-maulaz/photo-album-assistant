// État et actions de la page « Arborescence » : vue affichée, sélection,
// dossiers récents (touches 1 à 9), glisser-déposer (SPEC § 5.3).

import { nomsSortie } from '../lib/sortie';
import { signal } from '@preact/signals';
import {
  combiner,
  contenu,
  creerDossier,
  deplacerFichiers,
  mettreDeCote,
  RACINE,
  remettre,
  type FichierPlan,
  type Plan,
} from '../lib/plan';
import { t } from '../lib/langue';
import { verifierNomDossier } from '../lib/noms';
import { fichiersSousDossiers } from '../lib/rangement';
import { demander } from './composants/Dialogues';
import { annuler, appliquer, notifier, session, texteErreur } from './etat';
import { pluriel } from './format';

/** Vues spéciales du panneau, à côté des dossiers. */
export const VUE_MIS_DE_COTE = '§mis_de_cote';
export const VUE_AUTRES = '§autres';

export const vue = signal<string>(RACINE);
export const selection = signal<ReadonlySet<string>>(new Set());
/** Dernière photo cliquée : point de départ de Maj+clic, « toute la journée »… */
export const ancre = signal<string | null>(null);
/** Derniers dossiers utilisés, le plus récent d'abord (touches 1 à 9). */
export const recents = signal<string[]>([]);

/** Derniers dossiers utilisés qui existent encore (une annulation peut en avoir retiré) : touches 1 à 9. */
export function recentsValides(): string[] {
  const plan = session.value?.plan;
  return plan ? recents.value.filter((id) => plan.dossiers.has(id)) : [];
}
export const deplacerOuvert = signal(false);
export const visionneuse = signal<number | null>(null);
export const deplies = signal<ReadonlySet<string>>(new Set([RACINE]));
/**
 * Ordre du panneau des dossiers : l'arborescence par nom, l'arborescence dans
 * l'ordre du temps, ou tous les dossiers à plat, les plus petits d'abord (D89).
 */
export type OrdrePanneau = 'arbre' | 'periode' | 'taille';
export const ordrePanneau = signal<OrdrePanneau>('arbre');
/** Dossier en cours de renommage dans le panneau (double-clic ou F2). */
export const renommage = signal<string | null>(null);

/** Ce qui est en train d'être glissé (le transfert HTML ne porte qu'un marqueur). */
export type Glisse = { type: 'fichiers'; ids: string[] } | { type: 'dossier'; id: string };
let glisseCourant: Glisse | null = null;
export const glisse = {
  get: () => glisseCourant,
  commencer: (g: Glisse, e: DragEvent) => {
    glisseCourant = g;
    e.dataTransfer?.setData('application/x-album', g.type);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  },
  finir: () => (glisseCourant = null),
};

const comparer = new Intl.Collator('fr', { numeric: true }).compare;

/**
 * Éléments affichés dans la grille pour une vue : ceux du dossier ; s'il n'a
 * que des sous-dossiers (« Maison », la racine après le tri), ceux de ses
 * sous-dossiers, plutôt qu'une grille vide (voir `sousDossiersSeulement`).
 */
export function elementsVue(plan: Plan, v: string): FichierPlan[] {
  if (v === VUE_MIS_DE_COTE) {
    return [...plan.fichiers.values()].filter((f) => f.statut === 'mis_de_cote').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || comparer(a.id, b.id));
  }
  if (v === VUE_AUTRES) return [...plan.fichiers.values()].filter((f) => f.categorie === 'autre').sort((a, b) => comparer(a.id, b.id));
  const directs = contenu(plan, v);
  return directs.length || !plan.dossiers.has(v) ? directs : fichiersSousDossiers(plan, v);
}

/** Le dossier affiché n'a rien en propre : la grille montre les photos de ses sous-dossiers. */
export function sousDossiersSeulement(plan: Plan, v: string): boolean {
  return plan.dossiers.has(v) && contenu(plan, v).length === 0 && fichiersSousDossiers(plan, v).length > 0;
}

export function choisirVue(v: string) {
  vue.value = v;
  selection.value = new Set();
  ancre.value = null;
}

/** Ouvre un dossier et déplie ses parents dans le panneau, pour qu'on l'y voie. */
export function ouvrirDossier(id: string) {
  const plan = session.value?.plan;
  if (!plan) return;
  const ouverts = new Set(deplies.value);
  for (let d = plan.dossiers.get(id); d && d.parent !== null; d = plan.dossiers.get(d.parent)) ouverts.add(d.parent);
  deplies.value = ouverts;
  choisirVue(id);
}

function noterRecent(id: string) {
  recents.value = [id, ...recents.value.filter((r) => r !== id)].slice(0, 9);
}

function texteNombre(n: number) {
  return pluriel(n, 'élément');
}

function retourAnnuler() {
  return { libelle: t`Annuler`, faire: annuler };
}

/** Déplace la sélection (ou `ids`) vers un dossier. */
export function deplacerVers(cible: string, ids: string[] = [...selection.value]) {
  const s = session.value;
  if (!s || !ids.length) return;
  try {
    appliquer(deplacerFichiers(s.plan, ids, cible));
    noterRecent(cible);
    selection.value = new Set([...selection.value].filter((id) => !ids.includes(id)));
    notifier('ok', t`${pluriel(ids.length, 'élément déplacé', 'éléments déplacés')} vers « ${s.plan.dossiers.get(cible)?.nom} ».`, retourAnnuler());
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

export function mettreSelectionDeCote(ids: string[] = [...selection.value]) {
  const s = session.value;
  if (!s || !ids.length) return;
  appliquer(mettreDeCote(s.plan, ids, 'autres'));
  selection.value = new Set();
  notifier('ok', t`${texteNombre(ids.length)} mis de côté (rien n’est supprimé : ils iront dans « ${nomsSortie().misDeCote} »).`, retourAnnuler());
}

export function remettreSelection(ids: string[] = [...selection.value]) {
  const s = session.value;
  if (!s || !ids.length) return;
  appliquer(remettre(s.plan, ids));
  selection.value = new Set();
  notifier('ok', t`${texteNombre(ids.length)} remis dans leur dossier.`, retourAnnuler());
}

/** Demande un nom, crée le dossier et y range `ids` : un seul Ctrl+Z annule le tout. */
export async function nouveauDossierAvec(ids: string[], parent = RACINE, nomPropose = '') {
  const s = session.value;
  if (!s) return;
  const nom = await demander(
    t`Nouveau dossier`,
    ids.length ? t`Le dossier sera créé dans « ${s.plan.dossiers.get(parent)?.nom} » et recevra ${texteNombre(ids.length)}.` : t`Le dossier sera créé dans « ${s.plan.dossiers.get(parent)?.nom} ».`,
    nomPropose,
    verifierNomDossier,
    t`Créer`,
  );
  if (!nom) return;
  try {
    const { id, modification } = creerDossier(s.plan, nom, parent);
    appliquer(combiner(t`Nouveau dossier « ${nom} »`, modification, ids.length ? deplacerFichiers(s.plan, ids, id) : null));
    noterRecent(id);
    selection.value = new Set();
    deplies.value = new Set([...deplies.value, parent]);
    notifier('ok', ids.length ? t`Dossier « ${nom} » créé avec ${texteNombre(ids.length)}.` : t`Dossier « ${nom} » créé.`, retourAnnuler());
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

/**
 * Où créer un dossier avec des photos sélectionnées : au même niveau que
 * leur dossier (on sort ces photos pour en faire une sortie voisine) ; à la
 * racine depuis la racine ou une vue spéciale. Quand la grille montre les
 * photos des sous-dossiers, leur dossier est un sous-dossier de la vue : le
 * nouveau dossier se crée donc dans la vue.
 */
export function parentPourNouveau(): string {
  const plan = session.value?.plan;
  if (!plan) return RACINE;
  if (sousDossiersSeulement(plan, vue.value)) return vue.value;
  return plan.dossiers.get(vue.value)?.parent ?? RACINE;
}

/** Où créer un dossier vide (« + Nouveau dossier ») : dans le dossier affiché, comme dans l'Explorateur. */
export function dossierPourNouveauVide(): string {
  return session.value?.plan.dossiers.has(vue.value) ? vue.value : RACINE;
}

/** Sans accents ni majuscules, pour les recherches. */
export function simplifier(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
