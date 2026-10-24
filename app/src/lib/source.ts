// Plan initial d'un dossier déjà trié (SPEC § 4.3) : ses sous-dossiers
// deviennent les dossiers du plan, et chaque fichier reçoit sa date retenue.
// Mise à jour de l'inventaire (D63) : ce qui a changé dans la source depuis
// est intégré au plan sans toucher à ce qui est déjà décidé.

import { dateDepuisNom, type DateNom } from './dates';
import type { Categorie } from './fichiers';
import { cleNom } from './noms';
import { t } from './langue';
import { planVide, RACINE, Transaction, type DossierPlan, type FichierPlan, type Modification, type OrigineDate, type Plan, type RaisonMiseDeCote, type TraitementDossier } from './plan';

export interface ElementSource {
  /** Chemin relatif dans la source, avec « / ». */
  chemin: string;
  taille: number;
  /** Date de modification en ms. */
  modifie: number;
  categorie: Categorie;
  exif?: { date?: string; decalage?: string; modele?: string; marque?: string; lat?: number; lon?: number; largeur?: number; hauteur?: number } | null;
  video?: { dateUTC: Date | null; dureeSecondes: number | null; gps?: { lat: number; lon: number } | null } | null;
  /** Dimensions lues dans le fichier quand l'EXIF ne les donne pas. */
  dims?: { l: number; h: number } | null;
}

/** Dossiers produits par les anciens scripts : leur contenu est déjà « mis de côté ». */
const DOSSIERS_SPECIAUX: Record<string, RaisonMiseDeCote> = {
  _a_supprimer: 'floues',
  _doublons: 'doublons',
  _planches: 'autres',
};

/** État de projet d'une autre sortie : jamais repris. */
const IGNORES = new Set(['.album']);

const deux = (n: number) => String(n).padStart(2, '0');

function texte(d: DateNom): string {
  const jour = `${d.annee}-${deux(d.mois)}-${deux(d.jour)}`;
  return d.precision === 'jour' ? jour : `${jour}T${deux(d.heure)}:${deux(d.minute)}:${deux(d.seconde)}`;
}

/** Heure locale d'un instant UTC : avec le fuseau « +HH:MM » s'il est connu, sinon celui de l'ordinateur. */
export function heureLocale(utc: number, decalage?: string | null): string {
  const m = decalage?.match(/^([+-])(\d{2}):(\d{2})$/);
  if (m) {
    const d = new Date(utc + (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000);
    return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}T${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}:${deux(d.getUTCSeconds())}`;
  }
  const d = new Date(utc);
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
}

/**
 * Date de prise de vue retenue (SPEC § 6.2) :
 * photos : EXIF, sinon nom de fichier, sinon date du fichier ;
 * vidéos : nom à la seconde (Samsung, heure locale de début), sinon date
 * interne (UTC de fin) moins la durée, sinon nom au jour, sinon date du fichier.
 */
export function dateRetenue(e: ElementSource, decalageVoisin?: string | null): { date: string; origine: OrigineDate } {
  const exif = e.exif?.date?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (exif && exif[1] !== '0000') return { date: `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}:${exif[5]}:${exif[6]}`, origine: 'exif' };
  const nom = dateDepuisNom(e.chemin);
  if (nom && !nom.utc && nom.precision === 'seconde') return { date: texte(nom), origine: 'nom' };
  if (nom?.utc) return { date: heureLocale(Date.UTC(nom.annee, nom.mois - 1, nom.jour, nom.heure, nom.minute, nom.seconde), decalageVoisin), origine: 'nom' };
  if (e.categorie === 'video' && e.video?.dateUTC) {
    const debut = e.video.dateUTC.getTime() - (e.video.dureeSecondes ?? 0) * 1000;
    return { date: heureLocale(debut, decalageVoisin), origine: 'video' };
  }
  if (nom) return { date: texte(nom), origine: 'nom' };
  return { date: heureLocale(e.modifie), origine: 'fichier' };
}

function parent(chemin: string): string {
  const i = chemin.lastIndexOf('/');
  return i < 0 ? '' : chemin.slice(0, i);
}

function nomDe(chemin: string): string {
  return chemin.slice(chemin.lastIndexOf('/') + 1);
}

/** Fuseau le plus fréquent des photos de chaque dossier, pour dater leurs vidéos. */
function decalagesParDossier(elements: ElementSource[]): Map<string, string> {
  const comptes = new Map<string, Map<string, number>>();
  for (const e of elements) {
    const d = e.exif?.decalage;
    if (!d) continue;
    const p = parent(e.chemin);
    const c = comptes.get(p) ?? new Map<string, number>();
    c.set(d, (c.get(d) ?? 0) + 1);
    comptes.set(p, c);
  }
  return new Map([...comptes].map(([p, c]) => [p, [...c].sort((a, b) => b[1] - a[1])[0][0]]));
}

function gpsDe(e: ElementSource): { gps?: { lat: number; lon: number } } {
  const lat = e.exif?.lat ?? e.video?.gps?.lat;
  const lon = e.exif?.lon ?? e.video?.gps?.lon;
  // (0, 0) : position absente écrite par certains appareils.
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return {};
  return { gps: { lat, lon } };
}

function dimsDe(e: ElementSource): { dims?: { l: number; h: number } } {
  if (e.dims) return { dims: e.dims };
  const l = e.exif?.largeur;
  const h = e.exif?.hauteur;
  return typeof l === 'number' && typeof h === 'number' && l > 0 && h > 0 ? { dims: { l, h } } : {};
}

export interface PlanInitial {
  plan: Plan;
  /** Chemins ignorés (état d'une autre sortie). */
  ignores: string[];
}

/** Plan initial : un dossier du plan par dossier de la source contenant des photos ou des vidéos. */
export function planInitial(elements: ElementSource[]): PlanInitial {
  const plan = planVide();
  const ignores: string[] = [];
  const decalages = decalagesParDossier(elements);
  const idDossier = new Map<string, string>([['', RACINE]]);

  // Crée au besoin le dossier du plan correspondant à un dossier de la source.
  const assurerDossier = (chemin: string): string => {
    const connu = idDossier.get(cleNom(chemin));
    if (connu) return connu;
    const p = assurerDossier(parent(chemin));
    const id = `s:${chemin}`;
    plan.dossiers.set(id, { id, nom: nomDe(chemin), parent: p, origine: 'source' });
    idDossier.set(cleNom(chemin), id);
    return id;
  };

  const misDeCote: { e: ElementSource; raison: RaisonMiseDeCote; dossierSource: string }[] = [];
  for (const e of elements) {
    const segments = e.chemin.split('/');
    if (segments.some((s) => IGNORES.has(s))) {
      ignores.push(e.chemin);
      continue;
    }
    const { date, origine } = dateRetenue(e, decalages.get(parent(e.chemin)));
    const f: FichierPlan = {
      id: e.chemin,
      nom: nomDe(e.chemin),
      taille: e.taille,
      modifie: e.modifie,
      categorie: e.categorie,
      date,
      origineDate: origine,
      dossier: RACINE,
      statut: 'archive',
      ...(e.exif?.modele ? { appareil: e.exif.modele.trim() } : {}),
      ...(e.exif?.marque ? { marque: e.exif.marque.trim() } : {}),
      ...gpsDe(e),
      ...dimsDe(e),
    };
    if (e.categorie === 'autre') {
      plan.fichiers.set(f.id, f);
      continue;
    }
    const special = segments.slice(0, -1).findIndex((s) => s in DOSSIERS_SPECIAUX);
    const marque = /_doublon(\.[^.]+)$/i.exec(f.nom);
    if (special >= 0 || marque) {
      const raison = special >= 0 ? DOSSIERS_SPECIAUX[segments[special]] : 'doublons';
      const sans = segments.filter((_, i) => i !== special);
      if (marque) f.nom = f.nom.slice(0, marque.index) + marque[1];
      plan.fichiers.set(f.id, { ...f, statut: 'mis_de_cote', raison });
      misDeCote.push({ e, raison, dossierSource: sans.slice(0, -1).join('/') });
      continue;
    }
    plan.fichiers.set(f.id, { ...f, dossier: assurerDossier(parent(e.chemin)) });
  }
  // Un élément mis de côté retournera dans son dossier d'origine s'il existe.
  for (const m of misDeCote) {
    const f = plan.fichiers.get(m.e.chemin)!;
    plan.fichiers.set(f.id, { ...f, dossier: idDossier.get(cleNom(m.dossierSource)) ?? RACINE });
  }
  return { plan, ignores };
}

// ---------------------------------------------------------------------------
// Mise à jour de l'inventaire (D63) : trier un dossier en plusieurs fois
// ---------------------------------------------------------------------------

/** Un fichier de la source relue : chemin, taille et date de modification seulement (lecture rapide). */
export interface FichierListe {
  chemin: string;
  taille: number;
  modifie: number;
}

export interface ChangementsSource {
  /** Fichiers apparus depuis l'inventaire. */
  nouveaux: string[];
  /** Fichiers dont la taille ou la date de modification a changé. */
  modifies: string[];
  /** Fichiers du projet qui ne sont plus dans la source. */
  disparus: string[];
}

export const aucunChangement = (c: ChangementsSource | null | undefined): boolean => !c || c.nouveaux.length + c.modifies.length + c.disparus.length === 0;

/** Ce qui a changé dans la source depuis l'inventaire, par rapport au plan. */
export function comparerSource(plan: Plan, liste: FichierListe[]): ChangementsSource {
  const vus = new Set<string>();
  const nouveaux: string[] = [];
  const modifies: string[] = [];
  for (const e of liste) {
    if (e.chemin.split('/').some((s) => IGNORES.has(s))) continue;
    vus.add(e.chemin);
    const f = plan.fichiers.get(e.chemin);
    if (!f) nouveaux.push(e.chemin);
    else if (f.taille !== e.taille || f.modifie !== e.modifie) modifies.push(e.chemin);
  }
  const disparus = [...plan.fichiers.keys()].filter((id) => !vus.has(id));
  return { nouveaux: nouveaux.sort(), modifies: modifies.sort(), disparus: disparus.sort() };
}

/** Le dossier (ou un de ses parents) a-t-il été créé par le tri automatique ? */
function dansDossierDuTri(plan: Plan, dossier: string): boolean {
  for (let d = plan.dossiers.get(dossier); d; d = d.parent ? plan.dossiers.get(d.parent) : undefined) if (d.origine === 'tri') return true;
  return false;
}

export interface ResultatIntegration {
  modification: Modification | null;
  ajoutes: number;
  modifies: number;
  /** Disparus de la source avant d'avoir été copiés : retirés du projet. */
  retires: string[];
  /** Disparus de la source mais déjà dans la sortie : gardés, rien n'est perdu. */
  gardesSansSource: string[];
}

/**
 * Intègre au plan les changements de la source, sans toucher à ce qui est
 * décidé (une seule opération annulable) :
 * - les fichiers nouveaux sont placés comme à l'inventaire (dans leur dossier
 *   de la source, ou à trier à la racine) et marqués `ajout` ; un dossier de
 *   la source absent du plan est recréé. Dans un dossier en vrac, un nouveau
 *   sous-dossier garde sa place et sera nettoyé, sauf si ses anciennes photos
 *   avaient été triées : il était « à trier », il le reste ;
 * - les fichiers modifiés sont relus (taille, date, appareil, GPS), leurs
 *   décisions gardées ;
 * - les fichiers disparus sont retirés s'ils n'ont pas encore été copiés,
 *   gardés s'ils sont déjà dans la sortie.
 */
export function integrerSource(
  plan: Plan,
  elements: ElementSource[],
  disparus: string[],
  o: { quand: string; vrac: boolean; dansLaSortie: (id: string) => boolean },
): ResultatIntegration {
  const tx = new Transaction(plan);
  const nouveaux = elements.filter((e) => !plan.fichiers.has(e.chemin));
  const modifies = elements.filter((e) => plan.fichiers.has(e.chemin));
  const { plan: neuf } = planInitial(nouveaux);

  // Dossiers de la source déjà dans le plan (même s'ils ont été renommés ou déplacés depuis), par chemin.
  const existants = new Map([...plan.dossiers.values()].filter((d) => d.id.startsWith('s:')).map((d) => [cleNom(d.id), d.id]));
  const assurer = (id: string): string => {
    if (id === RACINE) return id;
    const existant = existants.get(cleNom(id));
    if (existant) return existant;
    const d = neuf.dossiers.get(id)!;
    const parent = assurer(d.parent ?? RACINE);
    const chemin = id.slice(2);
    let traitement: TraitementDossier | undefined;
    if (o.vrac && parent === RACINE) {
      const triees = [...plan.fichiers.values()].some((f) => f.id.startsWith(`${chemin}/`) && dansDossierDuTri(plan, f.dossier));
      traitement = triees ? 'trier' : 'nettoyer';
    }
    tx.dossier({ ...d, parent, ...(traitement ? { traitement } : {}) } satisfies DossierPlan);
    existants.set(cleNom(id), id);
    return id;
  };
  for (const f of neuf.fichiers.values()) tx.fichier({ ...f, dossier: assurer(f.dossier), ajout: o.quand });

  for (const e of modifies) {
    const relu = planInitial([e]).plan.fichiers.get(e.chemin)!;
    const { empreinte: _e, appareil: _a, marque: _m, gps: _g, dims: _d, decalage: _c, ...garde } = plan.fichiers.get(e.chemin)!;
    tx.fichier({
      ...garde,
      taille: relu.taille,
      modifie: relu.modifie,
      date: relu.date,
      origineDate: relu.origineDate,
      ...(relu.appareil ? { appareil: relu.appareil } : {}),
      ...(relu.marque ? { marque: relu.marque } : {}),
      ...(relu.gps ? { gps: relu.gps } : {}),
      ...(relu.dims ? { dims: relu.dims } : {}),
    });
  }

  const retires: string[] = [];
  const gardesSansSource: string[] = [];
  for (const id of disparus) {
    if (!plan.fichiers.has(id)) continue;
    if (o.dansLaSortie(id)) gardesSansSource.push(id);
    else {
      tx.supprimerFichier(id);
      retires.push(id);
    }
  }
  return { modification: tx.terminer(t`Mettre à jour l’inventaire`), ajoutes: neuf.fichiers.size, modifies: modifies.length, retires, gardesSansSource };
}

