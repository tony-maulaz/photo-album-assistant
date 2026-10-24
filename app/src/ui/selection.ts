// État et calculs de l'étape « Sélection » (sélection) : photos de la vue, indicateurs,
// filtres, piles et choix ★ / ★★ / non.

import { signal } from '@preact/signals';
import { texteEtiquettes, type Etiquettes } from '../lib/aidesSelection';
import { aTraduire, t } from '../lib/langue';
import { seuilFlou, signaux, type Indicateurs, type Signal } from '../lib/indicateurs';
import { rechercher } from '../lib/recherche';
import { estDescendant, noterAlbum, RACINE, tourner, type FichierPlan, type Plan } from '../lib/plan';
import { jourArrivee, piles } from '../lib/selection';
import type { Analyses } from '../navigateur/analyses';
import { photoAMontrer } from './composants/GrillePhotos';
import { annuler, appliquer, notifier, session } from './etat';
import { ancre, selection } from './organiser';

export interface Filtres {
  /** Un jour « AAAA-MM-JJ » ou un mois « AAAA-MM » (barres de l'équilibre). */
  jour: string;
  /** Photos arrivées par une mise à jour de l'inventaire (D63) : « nouvelles » (toutes), ou un jour d'arrivée « AAAA-MM-JJ ». */
  arrivee: string;
  appareil: string;
  etoiles: 'toutes' | 'retenues' | 'grandes' | 'non' | 'a_decider';
  signal: Signal | 'aucun' | 'tous';
  tri: 'date' | 'nettete' | 'appreciation';
  /** Étiquettes de l'IA (IA8) : personnes, type, défaut. */
  personnes: string;
  typePhoto: string;
  defaut: string;
  /** Recherche en langage naturel dans les descriptions (IA8, locale). */
  recherche: string;
}

export const FILTRES_DEFAUT: Filtres = { jour: '', arrivee: '', appareil: '', etoiles: 'toutes', signal: 'tous', tri: 'date', personnes: '', typePhoto: '', defaut: '', recherche: '' };

/** Résultats des aides IA utiles aux filtres : étiquettes (IA8) et appréciations (IA9). */
export interface ResultatsIA {
  etiquettes: Record<string, Etiquettes>;
  appreciations: Record<string, { note: number }>;
}

export const filtres = signal<Filtres>(FILTRES_DEFAUT);
/** Photo en cours de recadrage (D62), ou `null`. */
export const recadrageOuvert = signal<string | null>(null);
/** Les photos semblables sont empilées (une seule visible par pile). */
export const empiler = signal(false);
/** Piles dépliées (par identifiant de leur première photo). */
export const pilesOuvertes = signal<ReadonlySet<string>>(new Set());
/** Tri rapide plein écran : liste figée à l'ouverture et position. */
export const triRapide = signal<{ ids: string[]; index: number } | null>(null);
export const comparaison = signal<string[] | null>(null);
/** Photo préférée par l'IA au dernier lancement de « Meilleure de la sélection » (IA10), montrée dans le panneau. */
export const derniereMeilleure = signal<string | null>(null);

/** Sélectionne des photos et amène la première à l'écran dans la grille (résultats des aides IA). */
export function montrerPhotos(ids: string[]) {
  if (!ids.length) return;
  selection.value = new Set(ids);
  ancre.value = ids[0];
  photoAMontrer.value = ids[0];
}

/** Photos de l'archive dans un dossier et ses sous-dossiers (toutes depuis la racine). */
export function photosVue(plan: Plan, vue: string): FichierPlan[] {
  return [...plan.fichiers.values()]
    .filter((f) => f.categorie === 'photo' && f.statut === 'archive' && !f.capture && (vue === RACINE || f.dossier === vue || estDescendant(plan, f.dossier, vue)))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id));
}

export interface InfoPhoto {
  indicateurs?: Indicateurs;
  signaux: Signal[];
}

/** Indicateurs et signaux de chaque photo, le seuil de flou étant celui de son dossier (I8). */
export function infosPhotos(plan: Plan, analyses: Analyses): Map<string, InfoPhoto> {
  const parDossier = new Map<string, FichierPlan[]>();
  for (const f of plan.fichiers.values()) {
    if (f.categorie !== 'photo' || f.statut !== 'archive') continue;
    parDossier.set(f.dossier, [...(parDossier.get(f.dossier) ?? []), f]);
  }
  const infos = new Map<string, InfoPhoto>();
  for (const liste of parDossier.values()) {
    const indic = liste.map((f) => analyses.get(f));
    const seuil = seuilFlou(indic.filter((i): i is Indicateurs => !!i).map((i) => i.nettete));
    liste.forEach((f, k) => infos.set(f.id, { indicateurs: indic[k], signaux: indic[k] ? signaux(indic[k]!, seuil) : [] }));
  }
  return infos;
}

export function filtrer(photos: FichierPlan[], infos: Map<string, InfoPhoto>, f: Filtres, ia: ResultatsIA = { etiquettes: {}, appreciations: {} }): FichierPlan[] {
  let liste = photos.filter((p) => {
    const e = ia.etiquettes[p.id];
    if (f.personnes && e?.personnes !== f.personnes) return false;
    if (f.typePhoto && e?.type !== f.typePhoto) return false;
    if (f.defaut === 'aucun' && e && e.defauts.length) return false;
    if (f.defaut && f.defaut !== 'aucun' && !e?.defauts.includes(f.defaut as Etiquettes['defauts'][number])) return false;
    if (f.jour && !p.date?.startsWith(f.jour)) return false;
    if (f.arrivee && (!p.ajout || (f.arrivee !== 'nouvelles' && jourArrivee(p.ajout) !== f.arrivee))) return false;
    if (f.appareil && (p.appareil ?? '') !== f.appareil) return false;
    if (f.etoiles === 'retenues' && !(p.album && p.album > 0)) return false;
    if (f.etoiles === 'grandes' && p.album !== 2) return false;
    if (f.etoiles === 'non' && p.album !== 0) return false;
    if (f.etoiles === 'a_decider' && p.album !== undefined) return false;
    const s = infos.get(p.id)?.signaux ?? [];
    if (f.signal === 'aucun' && s.length) return false;
    if (f.signal !== 'tous' && f.signal !== 'aucun' && !s.includes(f.signal)) return false;
    return true;
  });
  if (f.tri === 'nettete') liste.sort((a, b) => (infos.get(b.id)?.indicateurs?.nettete ?? -1) - (infos.get(a.id)?.indicateurs?.nettete ?? -1));
  if (f.tri === 'appreciation') liste.sort((a, b) => (ia.appreciations[b.id]?.note ?? -1) - (ia.appreciations[a.id]?.note ?? -1));
  if (f.recherche.trim()) {
    const resultats = rechercher(
      f.recherche,
      liste.filter((p) => ia.etiquettes[p.id]).map((p) => ({ id: p.id, texte: texteEtiquettes(ia.etiquettes[p.id]) })),
    );
    const parId = new Map(liste.map((p) => [p.id, p]));
    liste = resultats.map((r) => parId.get(r.id)!);
  }
  return liste;
}

/**
 * Piles de photos semblables (scènes de l'étape « Doublons » et ressemblance locale) :
 * pour chaque photo, sa pile (liste d'identifiants, la première étant la tête).
 */
export function pilesParPhoto(photos: FichierPlan[], infos: Map<string, InfoPhoto>, scenes: string[][]): Map<string, string[]> {
  const choix = photos.map((p) => ({ id: p.id, dossier: p.dossier, date: p.date, phash: infos.get(p.id)?.indicateurs?.phash, album: p.album }));
  const presentes = new Set(photos.map((p) => p.id));
  const groupes = piles(
    choix,
    scenes.map((s) => s.filter((id) => presentes.has(id))),
  );
  const ordre = new Map(photos.map((p, i) => [p.id, i]));
  const resultat = new Map<string, string[]>();
  for (const g of groupes) {
    // La tête de pile : une photo retenue si possible, sinon la première.
    const triee = [...g].sort((a, b) => ordre.get(a)! - ordre.get(b)!);
    const tete = triee.find((id) => (photos[ordre.get(id)!].album ?? 0) > 0) ?? triee[0];
    const pile = [tete, ...triee.filter((id) => id !== tete)];
    for (const id of g) resultat.set(id, pile);
  }
  return resultat;
}

/** Liste affichée : avec les piles fermées, seule la tête de chaque pile apparaît. */
export function avecPiles(photos: FichierPlan[], pilesDe: Map<string, string[]>, ouvertes: ReadonlySet<string>): FichierPlan[] {
  return photos.filter((p) => {
    const pile = pilesDe.get(p.id);
    return !pile || pile[0] === p.id || ouvertes.has(pile[0]);
  });
}

const LIBELLES = { 0: aTraduire('pas dans l’album'), 1: aTraduire('dans l’album ★'), 2: aTraduire('grande photo ★★') } as const;

export function choisir(ids: string[], valeur: 0 | 1 | 2 | undefined) {
  const s = session.value;
  if (!s || !ids.length) return;
  appliquer(noterAlbum(s.plan, ids, valeur));
  if (ids.length > 1) notifier('ok', t`${ids.length} photos : ${valeur === undefined ? t`à décider` : t(LIBELLES[valeur])}.`, { libelle: t`Annuler`, faire: annuler });
}

export function tournerPhotos(ids: string[], sens: 90 | -90 = 90) {
  const s = session.value;
  if (!s || !ids.length) return;
  appliquer(tourner(s.plan, ids, sens));
}
