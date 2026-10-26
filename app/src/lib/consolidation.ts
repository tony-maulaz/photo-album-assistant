// Consolidation des dossiers (étape « Consolidation », IA6) : portage du script 05 (mode
// par défaut). Pour chaque répertoire d'au moins deux dossiers de photos, le
// modèle voit la liste (nom, nombre, période) et les planches des petits
// dossiers et des `Lieu_*`, et propose des fusions et des renommages.
// Sans IA (D91) : les dossiers dont des photos se suivent (une sortie coupée
// en deux) et les étapes d'un week-end ou d'un petit voyage sont proposés,
// avec des réglages dont on voit l'effet ; l'utilisateur décide.

import consigneConsolidation from '../ia/consignes/consolidation_consigne.txt?raw';
import sectionPlanches from '../ia/consignes/consolidation_section_planches.txt?raw';
import consigneSysteme from '../ia/consignes/consolidation_systeme.txt?raw';
import { cleNom } from './noms';
import { photosDuDossier, IGNORES_NOMMAGE, cleRequete, coutEstime, jetonsPlanche, MOTIF_DATE_SEULE, normaliserNom, premierObjet, sansDateFinale, texteCourt, type BlocContenu, type Estimation, type RequeteIA } from './nommage';
import type { FichierPlan, Plan } from './plan';
import { minutes } from './selection';
import { nomsSortie } from './sortie';
import { modele as infoModele } from './tarifs';
import { dateDeNom, distanceM } from './tri';

/** Un dossier et ses photos (sous-dossiers compris), triées par date. */
export interface DossierInfo {
  id: string;
  nom: string;
  photos: FichierPlan[];
  /** Première et dernière date (heure locale), si connues. */
  du?: string;
  au?: string;
}

/** Répertoire à consolider : ses dossiers de photos (au moins deux). */
export interface GroupeFreres {
  /** Identifiant du répertoire parent (la racine comprise). */
  parent: string;
  dossiers: DossierInfo[];
}

function info(plan: Plan, id: string): DossierInfo {
  const photos = photosDuDossier(plan, id);
  const dates = photos.map((p) => p.date).filter((d): d is string => !!d);
  return { id, nom: plan.dossiers.get(id)!.nom, photos, du: dates[0], au: dates.at(-1) };
}

/**
 * Répertoires traités par le script 05 : la racine et tout dossier qui
 * contient au moins deux dossiers de photos (hors `_a_supprimer`, `_autres`,
 * `Sans_lieu`), chacun consolidé indépendamment.
 */
export function groupesDeFreres(plan: Plan): GroupeFreres[] {
  const enfants = new Map<string, string[]>();
  for (const d of plan.dossiers.values()) {
    if (d.parent === null || IGNORES_NOMMAGE.has(d.nom)) continue;
    enfants.set(d.parent, [...(enfants.get(d.parent) ?? []), d.id]);
  }
  const groupes: GroupeFreres[] = [];
  for (const [parent, ids] of enfants) {
    const p = plan.dossiers.get(parent);
    if (!p || (p.parent !== null && IGNORES_NOMMAGE.has(p.nom))) continue;
    const dossiers = ids
      .map((id) => info(plan, id))
      .filter((d) => d.photos.length > 0)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    if (dossiers.length >= 2) groupes.push({ parent, dossiers });
  }
  return groupes;
}

/** « 09.06 » ou « 09.06-11.06 » (script 05). */
function periodeCourte(d: DossierInfo): string {
  if (!d.du || !d.au) return 'date inconnue';
  const j = (x: string) => `${x.slice(8, 10)}.${x.slice(5, 7)}`;
  return d.du.slice(0, 10) === d.au.slice(0, 10) ? j(d.du) : `${j(d.du)}-${j(d.au)}`;
}

/** Liste donnée au modèle : « - Nom  (12 photos, 09.06-11.06) », comme le script. */
export function listeDossiers(dossiers: DossierInfo[]): string {
  return dossiers.map((d) => `- ${d.nom}  (${d.photos.length} photos, ${periodeCourte(d)})`).join('\n');
}

export const SEUIL_PLANCHE = 8;

/** Dossiers qui reçoivent une planche : moins de `seuil` photos, ou nom `Lieu_*` (non identifié). */
export function dossiersAPlanche(dossiers: DossierInfo[], seuil = SEUIL_PLANCHE): DossierInfo[] {
  return dossiers.filter((d) => d.photos.length < seuil || d.nom.toLowerCase().startsWith('lieu_'));
}

/** Planche des scripts 05 : 6 premières photos, 260 px, 3 colonnes, marge 5, JPEG 0,75, sans numéros. */
export const PLANCHE_05 = { cellule: 260, colonnes: 3, marge: 5, qualite: 0.75, max: 6 } as const;

export function plancheDossier(ids: string[]): Extract<BlocContenu, { type: 'planche' }> {
  return { type: 'planche', ids: ids.slice(0, PLANCHE_05.max), cellule: PLANCHE_05.cellule, colonnes: PLANCHE_05.colonnes, marge: PLANCHE_05.marge, qualite: PLANCHE_05.qualite };
}

export function consigneConsolidationGroupe(g: GroupeFreres, seuilPlanche = SEUIL_PLANCHE): string {
  const avecPlanches = dossiersAPlanche(g.dossiers, seuilPlanche).length > 0;
  return consigneConsolidation.replace('{liste}', listeDossiers(g.dossiers)).replace('{section_planches}', avecPlanches ? sectionPlanches : '');
}

export const SCHEMA_CONSOLIDATION = {
  type: 'object',
  properties: {
    fusions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { cible: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, raison: { type: 'string' } },
        required: ['cible', 'sources', 'raison'],
        additionalProperties: false,
      },
    },
    renommages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { dossier: { type: 'string' }, nom: { type: 'string' }, raison: { type: 'string' } },
        required: ['dossier', 'nom', 'raison'],
        additionalProperties: false,
      },
    },
  },
  required: ['fusions', 'renommages'],
  additionalProperties: false,
};

/** Requête d'un répertoire : planches des petits dossiers (« Planche du dossier « X » : »), puis la consigne. */
export function requeteConsolidation(g: GroupeFreres, idModele: string, identite: (f: FichierPlan) => string, seuilPlanche = SEUIL_PLANCHE): RequeteIA {
  const contenu: BlocContenu[] = [];
  const identites: string[] = [];
  for (const d of dossiersAPlanche(g.dossiers, seuilPlanche)) {
    const photos = d.photos.slice(0, PLANCHE_05.max);
    contenu.push({ type: 'texte', texte: `Planche du dossier « ${d.nom} » :` });
    contenu.push(plancheDossier(photos.map((p) => p.id)));
    identites.push(...photos.map(identite));
  }
  const consigne = consigneConsolidationGroupe(g, seuilPlanche);
  contenu.push({ type: 'texte', texte: consigne });
  return {
    fonction: 'IA6',
    systeme: consigneSysteme,
    contenu,
    schema: SCHEMA_CONSOLIDATION,
    cle: cleRequete('IA6', idModele, consigne, identites),
    effort: 'medium',
    maxTokens: 16000,
    outils: null,
    estimationUSD: estimationConsolidation([g], idModele, seuilPlanche).usd,
  };
}

export interface FusionProposee {
  /** Nom final (dossier existant, ou nouveau nom qui étend la période). */
  cible: string;
  /** Dossier existant qui porte déjà ce nom, s'il y en a un (il reçoit les autres). */
  cibleId: string | null;
  /** Dossiers à fusionner dans la cible (connus, différents de la cible). */
  sources: string[];
  raison: string;
}

export interface RenommageConsolidation {
  dossier: string;
  nom: string;
  raison: string;
}

export interface Consolidation {
  fusions: FusionProposee[];
  renommages: RenommageConsolidation[];
  /** Noms cités par le modèle mais inconnus (ignorés, I9). */
  inconnus: string[];
}

/** Dossier désigné par son nom : exact, sinon sans tenir compte de la casse ni des accents composés. */
function trouver(dossiers: DossierInfo[], nom: string): DossierInfo | undefined {
  return dossiers.find((d) => d.nom === nom) ?? dossiers.find((d) => cleNom(d.nom) === cleNom(nom));
}

/**
 * Réponse validée (règles du script 05) : une source doit être un dossier
 * du répertoire, différent de la cible ; un dossier n'est fusionné qu'une
 * fois ; un dossier fusionné n'est pas aussi renommé (écart : le script
 * gardait la dernière ligne écrite) ; un nom vide ou inchangé est ignoré.
 */
export function lireConsolidation(v: unknown, g: GroupeFreres): Consolidation {
  const r = premierObjet(v);
  const resultat: Consolidation = { fusions: [], renommages: [], inconnus: [] };
  if (!r) return resultat;
  const pris = new Set<string>();
  for (const f of Array.isArray(r.fusions) ? r.fusions : []) {
    const o = premierObjet(f);
    if (!o) continue;
    const cible = normaliserNom(texteCourt(o.cible, 200));
    if (!cible) continue;
    const cibleDossier = trouver(g.dossiers, cible) ?? trouver(g.dossiers, texteCourt(o.cible, 200));
    const sources: string[] = [];
    for (const s of Array.isArray(o.sources) ? o.sources : []) {
      const nom = texteCourt(s, 200);
      const d = nom ? trouver(g.dossiers, nom) : undefined;
      if (!d) {
        if (nom) resultat.inconnus.push(nom);
        continue;
      }
      if (d.id === cibleDossier?.id || pris.has(d.id)) continue;
      pris.add(d.id);
      sources.push(d.id);
    }
    // Cible sans dossier existant (nom étendu à la nouvelle période) : le script créait ce
    // dossier et y versait les sources ; `cibleId` vaut alors `null`.
    if (!sources.length) continue;
    resultat.fusions.push({ cible: cibleDossier?.nom ?? cible, cibleId: cibleDossier?.id ?? null, sources, raison: texteCourt(o.raison) });
    if (cibleDossier) pris.add(cibleDossier.id);
  }
  for (const x of Array.isArray(r.renommages) ? r.renommages : []) {
    const o = premierObjet(x);
    if (!o) continue;
    const nomActuel = texteCourt(o.dossier, 200);
    const d = nomActuel ? trouver(g.dossiers, nomActuel) : undefined;
    if (!d) {
      if (nomActuel) resultat.inconnus.push(nomActuel);
      continue;
    }
    const nom = normaliserNom(texteCourt(o.nom, 200));
    if (!nom || nom === d.nom || pris.has(d.id)) continue;
    pris.add(d.id);
    resultat.renommages.push({ dossier: d.id, nom, raison: texteCourt(o.raison) });
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Sans IA : propositions de réunion (D91)
// ---------------------------------------------------------------------------

/** Nom sans date ni suffixe, en minuscules, sans séparateurs : « Vol_Koh_Samui_18.07.26 » → « volkohsamui ». */
export function racineNom(nom: string): string {
  return nom
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    // suffixe d'un nom déjà pris après la date : _b, _2
    .replace(/(\d)_([b-z]|\d)$/, '$1')
    // 28.06-02.07.25, 28.12.25-02.01.26 (noms du tri sur deux mois ou deux années)
    .replace(/[_\-. ]\d{1,2}\.\d{1,2}(\.\d{2,4})?[-–]\d{1,2}\.\d{1,2}\.\d{2,4}$/, '')
    .replace(/[_\-. ]\d{1,2}([-–]\d{1,2})?[.\-]\d{1,2}[.\-]\d{2,4}$/, '')
    .replace(/[_\-. ]\d{4}[-_]\d{2}([-_]\d{2})?(_[b-z])?$/, '')
    // 11.25 : un dossier par mois
    .replace(/_\d{2}\.\d{2}$/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Distance d'édition (Levenshtein), bornée : au-delà de `max`, renvoie `max + 1`. */
function distanceEdition(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minLigne = Math.min(minLigne, cour[j]);
    }
    if (minLigne > max) return max + 1;
    prec = cour;
  }
  return prec[b.length];
}

/** Noms proches : même racine, l'une contient l'autre, ou une ou deux lettres d'écart. */
export function nomsProches(a: string, b: string): boolean {
  const ra = racineNom(a);
  const rb = racineNom(b);
  if (ra.length < 3 || rb.length < 3) return false;
  if (ra === rb || ra.includes(rb) || rb.includes(ra)) return true;
  return distanceEdition(ra, rb, 2) <= Math.max(1, Math.min(2, Math.floor(Math.min(ra.length, rb.length) / 6)));
}

/**
 * Deux noms proches ne désignent la même sortie que si elle se suit dans le
 * temps : au plus ce nombre de jours entre la fin de l'une et le début de
 * l'autre (Vallon le 22.11 et le 13.12 sont deux sorties).
 */
export const JOURS_MAX_NOMS_PROCHES = 2;

/** Numéro du jour d'une date « AAAA-MM-JJ… ». */
const jour = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** Jours entre deux dossiers (0 s'ils se touchent ou se recouvrent), ou `null` si l'un n'a pas de date. */
export function joursEntre(a: DossierInfo, b: DossierInfo): number | null {
  if (!a.du || !a.au || !b.du || !b.au) return null;
  return Math.max(0, jour(b.du) - jour(a.au), jour(a.du) - jour(b.au));
}

/** Clé d'une paire de dossiers, dans un ordre fixe (paires refusées, `.album/aides.json`). */
export function clePaire(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Toutes les paires d'une liste de dossiers. */
export function paires(ids: string[]): string[] {
  return ids.flatMap((a, i) => ids.slice(i + 1).map((b) => clePaire(a, b)));
}

/**
 * Réglages de l'étape (D91), choisis en tête de page et gardés dans
 * `.album/aides.json` ; les propositions changent sous les yeux.
 */
export interface ReglagesConsolidation {
  /** Sortie coupée en deux : deux photos prises à moins de tant d'heures… */
  heures: number;
  /** … et de tant de kilomètres l'une de l'autre. */
  km: number;
  /** Proposer aussi les week-ends et petits voyages. */
  voyages: boolean;
  /** Un petit voyage dure au plus tant de jours, du premier au dernier. */
  joursVoyage: number;
  /** Proposer aussi les dossiers aux noms proches, à 2 jours près (noms donnés à la main ou par l'IA). */
  noms: boolean;
}

export const CRANS_HEURES = [1, 3, 6, 12] as const;
export const CRANS_KM = [1, 2, 4, 10, 20] as const;
export const CRANS_JOURS_VOYAGE = [3, 4, 7, 14] as const;

/** Cran le plus proche d'une valeur (un ancien réglage, ou 2 × la taille d'un endroit du tri). */
export function cranProche(valeur: number, crans: readonly number[]): number {
  return crans.reduce((m, c) => (Math.abs(Math.log(c / valeur)) < Math.abs(Math.log(m / valeur)) ? c : m), crans[0]);
}

/**
 * Réglages par défaut, mesurés sur une année (D91) : deux photos à moins de
 * 3 h et de 2 × la taille d'un endroit du tri (4 km pour « un village ») :
 * deux dossiers de deux endroits du tri ont toutes leurs photos à plus de
 * cette taille, il n'y a rien à trouver en deçà.
 */
export function reglagesParDefaut(rayonKm = 2): ReglagesConsolidation {
  return { heures: 3, km: cranProche(2 * rayonKm, CRANS_KM), voyages: true, joursVoyage: 4, noms: true };
}

/**
 * Taille d'un endroit choisie au tri avant D103 (2 km par défaut) : le tri
 * suit désormais l'ordre du temps et n'en a plus, mais la Consolidation et le
 * badge « même sortie ? » de l'étape 7 gardent leur distance (2 × cette taille).
 */
export function rayonDuProjet(tri: unknown): number {
  const r = typeof tri === 'object' && tri !== null ? (tri as { rayonKm?: unknown }).rayonKm : undefined;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 2;
}

/** Réglages enregistrés, complétés par défaut et ramenés aux crans. */
export function lireReglages(v: unknown, rayonKm = 2): ReglagesConsolidation {
  const d = reglagesParDefaut(rayonKm);
  const o = premierObjet(v);
  if (!o) return d;
  const cran = (x: unknown, crans: readonly number[], defaut: number) => (typeof x === 'number' && x > 0 ? cranProche(x, crans) : defaut);
  return {
    heures: cran(o.heures, CRANS_HEURES, d.heures),
    km: cran(o.km, CRANS_KM, d.km),
    voyages: typeof o.voyages === 'boolean' ? o.voyages : d.voyages,
    joursVoyage: cran(o.joursVoyage, CRANS_JOURS_VOYAGE, d.joursVoyage),
    noms: typeof o.noms === 'boolean' ? o.noms : d.noms,
  };
}

/** Deux photos de deux dossiers : leur écart (minutes) et leur distance (km, `null` si l'un des dossiers n'a aucune position). */
export interface Rencontre {
  minutes: number;
  km: number | null;
}

/** Le plus grand écart regardé : la journée. */
const MINUTES_MAX = 12 * 60;

type Point = { t: number; gps?: { lat: number; lon: number } };

function points(d: DossierInfo): Point[] {
  const liste: Point[] = [];
  for (const p of d.photos) {
    const t = minutes(p.date);
    if (t !== null) liste.push({ t, gps: p.gps });
  }
  return liste.sort((a, b) => a.t - b.t);
}

const kmEntre = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceM(a.lat, a.lon, b.lat, b.lon) / 1000;

/**
 * Rencontres de deux dossiers (D91) : pour chaque écart de temps, la plus
 * petite distance entre deux de leurs photos (les couples qu'aucun autre ne
 * bat à la fois sur l'écart et la distance), parmi les photos à moins d'une
 * journée. Calculées une fois, elles suffisent pour tous les réglages. Si
 * l'un des dossiers n'a aucune position, seul l'écart compte.
 */
export function rencontres(a: DossierInfo, b: DossierInfo): Rencontre[] {
  const pa = points(a);
  const pb = points(b);
  if (!pa.length || !pb.length) return [];
  const sansGps = !pa.some((p) => p.gps) || !pb.some((p) => p.gps);
  const couples: Rencontre[] = [];
  let debut = 0;
  for (const x of pa) {
    while (debut < pb.length && pb[debut].t < x.t - MINUTES_MAX) debut++;
    for (let j = debut; j < pb.length && pb[j].t <= x.t + MINUTES_MAX; j++) {
      const y = pb[j];
      if (sansGps) couples.push({ minutes: Math.abs(y.t - x.t), km: null });
      else if (x.gps && y.gps) couples.push({ minutes: Math.abs(y.t - x.t), km: kmEntre(x.gps, y.gps) });
    }
  }
  couples.sort((u, v) => u.minutes - v.minutes || (u.km ?? 0) - (v.km ?? 0));
  const front: Rencontre[] = [];
  for (const c of couples) {
    const der = front.at(-1);
    if (!der || (c.km !== null && der.km !== null && c.km < der.km)) front.push(c);
  }
  return front;
}

/** La rencontre qui suffit avec ces réglages (la plus rapprochée dans le temps), ou `null`. */
export function rencontreSuffisante(front: Rencontre[], r: Pick<ReglagesConsolidation, 'heures' | 'km'>): Rencontre | null {
  return front.find((c) => c.minutes <= r.heures * 60 && (c.km === null || c.km <= r.km)) ?? null;
}

/** Ce qui ne dépend pas des réglages, calculé une fois par version du plan. */
export interface Voisinage {
  groupes: GroupeFreres[];
  /** Rencontres des frères à moins d'une journée l'un de l'autre (clé `clePaire`). */
  rencontres: Map<string, Rencontre[]>;
  /** Centre des positions de chaque dossier (`null` sans position). */
  centres: Map<string, { lat: number; lon: number } | null>;
}

function centre(d: DossierInfo): { lat: number; lon: number } | null {
  const g = d.photos.filter((p) => p.gps);
  if (!g.length) return null;
  return { lat: g.reduce((s, p) => s + p.gps!.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.gps!.lon, 0) / g.length };
}

export function voisinage(groupes: GroupeFreres[]): Voisinage {
  const r = new Map<string, Rencontre[]>();
  const centres = new Map<string, { lat: number; lon: number } | null>();
  for (const g of groupes) {
    for (const d of g.dossiers) centres.set(d.id, centre(d));
    g.dossiers.forEach((a, i) => {
      for (const b of g.dossiers.slice(i + 1)) {
        const j = joursEntre(a, b);
        if (j === null || j > 1) continue;
        const front = rencontres(a, b);
        if (front.length) r.set(clePaire(a.id, b.id), front);
      }
    });
  }
  return { groupes, rencontres: r, centres };
}

/** Une proposition de l'étape : des dossiers d'un même répertoire à réunir. */
export interface Proposition {
  /** La sorte et les dossiers : stable tant que les dossiers ne changent pas. */
  cle: string;
  /** Une sortie coupée en plusieurs dossiers, ou les étapes d'un week-end ou d'un petit voyage. */
  sorte: 'sortie' | 'voyage';
  parent: string;
  /** Dans l'ordre du temps. */
  dossiers: DossierInfo[];
  du?: string;
  au?: string;
  /** Sortie : les photos les plus rapprochées de deux de ses dossiers (`null` : noms proches seulement). */
  rencontre: Rencontre | null;
  /** Sortie : des noms proches. */
  noms: boolean;
  /** Voyage : toutes les étapes d'un dossier de voyage (le parent) ; on peut les réunir en un seul dossier. */
  voyageEntier: boolean;
  /** Proposée ou confirmée par l'IA (IA6) : nom proposé et raison. */
  ia?: { cible: string; raison: string };
}

export interface ContexteReunions {
  /** Paires refusées comme sortie (`clePaire`). */
  ignorees: ReadonlySet<string>;
  /** Paires refusées comme étapes d'un même voyage. */
  voyagesIgnores: ReadonlySet<string>;
  /** Le domicile, et la distance en deçà de laquelle on est à la maison (km) ; `null` : pas de voyages. */
  maison: { lat: number; lon: number; km: number } | null;
  /** Instants (minutes, triés) des photos prises à la maison : un retour coupe un voyage. */
  aLaMaison: number[];
  /** Le nom a été donné à la main ou par l'IA (deux noms du tri proches ne disent que la même commune). */
  nomDonne: (d: DossierInfo) => boolean;
  /** Dossiers de voyage : faits par le tri (ses étapes peuvent être réunies), ou choisis à cette étape (rien à proposer). */
  voyages: ReadonlyMap<string, 'tri' | 'choisi'>;
}

/**
 * À moins de cette distance du domicile, on est « à la maison » pour les
 * petits voyages (D91) : la ville voisine n'est pas un week-end, et une photo
 * qui y est prise coupe un voyage (sur 2025, une ville à 4 km s'accrochait aux
 * week-ends). Au-delà, la distance d'un voyage du tri (50 km) prend le relais.
 */
export const DISTANCE_MAISON_KM = 10;

/** Instants des photos prises à moins de `km` du domicile, triés. */
export function instantsALaMaison(photos: Iterable<FichierPlan>, maison: { lat: number; lon: number; km: number }): number[] {
  const t: number[] = [];
  for (const p of photos) {
    const m = minutes(p.date);
    if (m !== null && p.gps && kmEntre(p.gps, maison) <= maison.km) t.push(m);
  }
  return t.sort((a, b) => a - b);
}

/** Une photo prise à la maison strictement entre deux instants ? */
function rentreEntre(aLaMaison: number[], t1: number, t2: number): boolean {
  let bas = 0;
  let haut = aLaMaison.length;
  while (bas < haut) {
    const m = (bas + haut) >> 1;
    if (aLaMaison[m] <= t1) bas = m + 1;
    else haut = m;
  }
  return bas < aLaMaison.length && aLaMaison[bas] < t2;
}

/** Un groupe de dossiers trop étendu n'est plus une sortie : chacun à moins de 3 × la distance choisie de tous les autres. */
const ETENDUE_MAX = 3;

function proposition(sorte: Proposition['sorte'], parent: string, dossiers: DossierInfo[], reste: Partial<Proposition> = {}): Proposition {
  const liste = [...dossiers].sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const dates = liste.flatMap((d) => [d.du, d.au]).filter((x): x is string => !!x).sort();
  return {
    cle: `${sorte}:${liste.map((d) => d.id).sort().join('|')}`,
    sorte,
    parent,
    dossiers: liste,
    du: dates[0],
    au: dates.at(-1),
    rencontre: null,
    noms: false,
    voyageEntier: false,
    ...reste,
  };
}

/**
 * Sorties coupées d'un répertoire : deux dossiers sont reliés si deux de
 * leurs photos se suivent (moins de `heures` et de `km`), ou par des noms
 * proches à 2 jours près. Les liens les plus serrés d'abord, un dossier ne
 * rejoint un groupe que s'il est à moins de 3 × `km` de chacun (pas de
 * chaîne de proche en proche à travers toute une région).
 */
function sortiesCoupees(g: GroupeFreres, v: Voisinage, r: ReglagesConsolidation, c: ContexteReunions): Proposition[] {
  const liens: { a: string; b: string; rencontre: Rencontre | null; noms: boolean }[] = [];
  g.dossiers.forEach((a, i) => {
    for (const b of g.dossiers.slice(i + 1)) {
      const cle = clePaire(a.id, b.id);
      if (c.ignorees.has(cle)) continue;
      const rencontre = rencontreSuffisante(v.rencontres.get(cle) ?? [], r);
      const jours = joursEntre(a, b);
      const noms = r.noms && (c.nomDonne(a) || c.nomDonne(b)) && jours !== null && jours <= JOURS_MAX_NOMS_PROCHES && nomsProches(a.nom, b.nom);
      if (rencontre || noms) liens.push({ a: a.id, b: b.id, rencontre, noms });
    }
  });
  liens.sort((x, y) => (x.rencontre?.km ?? r.km) - (y.rencontre?.km ?? r.km) || (x.rencontre?.minutes ?? MINUTES_MAX) - (y.rencontre?.minutes ?? MINUTES_MAX));
  const assezPres = (x: string, y: string) => {
    const [p, q] = [v.centres.get(x), v.centres.get(y)];
    return !p || !q || kmEntre(p, q) <= ETENDUE_MAX * r.km;
  };
  const groupeDe = new Map<string, Set<string>>();
  for (const l of liens) {
    const ga = groupeDe.get(l.a) ?? new Set([l.a]);
    const gb = groupeDe.get(l.b) ?? new Set([l.b]);
    if (ga === gb || ![...ga].every((x) => [...gb].every((y) => assezPres(x, y)))) continue;
    const u = new Set([...ga, ...gb]);
    for (const x of u) groupeDe.set(x, u);
  }
  const parId = new Map(g.dossiers.map((d) => [d.id, d]));
  return [...new Set(groupeDe.values())].map((ids) => {
    const dedans = liens.filter((l) => ids.has(l.a) && ids.has(l.b) && groupeDe.get(l.a) === ids);
    const rencontre = dedans.map((l) => l.rencontre).filter((x): x is Rencontre => !!x).sort((x, y) => x.minutes - y.minutes)[0] ?? null;
    return proposition('sortie', g.parent, [...ids].map((id) => parId.get(id)!), { rencontre, noms: dedans.some((l) => l.noms) });
  });
}

/**
 * Week-ends et petits voyages d'un répertoire : des dossiers loin de la
 * maison, sur des jours qui se suivent (au plus un jour d'écart), sans photo
 * prise à la maison entre deux, sur 2 à `joursVoyage` jours. Dans un dossier
 * de voyage du tri, seulement s'ils en sont toutes les étapes ; rien dans un
 * dossier de voyage choisi ici.
 */
function petitsVoyages(g: GroupeFreres, r: ReglagesConsolidation, c: ContexteReunions): Proposition[] {
  const maison = c.maison;
  const genre = c.voyages.get(g.parent);
  if (!r.voyages || !maison || genre === 'choisi') return [];
  const loin = (d: DossierInfo) => {
    const p = centre(d);
    return !!p && kmEntre(p, maison) > maison.km;
  };
  const candidats = g.dossiers.filter((d) => d.du && d.au && loin(d)).sort((a, b) => a.du!.localeCompare(b.du!));
  const resultat: Proposition[] = [];
  let chaine: DossierInfo[] = [];
  let fin = '';
  const fermer = () => {
    if (chaine.length < 2) return;
    const jours = jour(fin) - jour(chaine[0].du!) + 1;
    if (jours < 2 || jours > r.joursVoyage) return;
    const entier = genre === 'tri';
    if (entier && chaine.length !== g.dossiers.length) return;
    resultat.push(proposition('voyage', g.parent, chaine, { voyageEntier: entier }));
  };
  for (const d of candidats) {
    if (chaine.length) {
      const prec = chaine.at(-1)!;
      const ecart = jour(d.du!) - jour(fin);
      const rentre = d.du! > fin && rentreEntre(c.aLaMaison, minutes(fin)!, minutes(d.du)!);
      if (ecart <= 1 && !rentre && !c.voyagesIgnores.has(clePaire(prec.id, d.id))) {
        chaine.push(d);
        if (d.au! > fin) fin = d.au!;
        continue;
      }
      fermer();
    }
    chaine = [d];
    fin = d.au!;
  }
  fermer();
  return resultat;
}

/**
 * Propositions de l'étape avec ces réglages (D91), dans l'ordre du temps :
 * sorties coupées et petits voyages. Un groupe qui est à la fois l'un et
 * l'autre est montré comme voyage (on choisit alors un ou plusieurs dossiers).
 */
export function propositions(v: Voisinage, r: ReglagesConsolidation, c: ContexteReunions): Proposition[] {
  const resultat: Proposition[] = [];
  for (const g of v.groupes) {
    const voyages = petitsVoyages(g, r, c);
    const memes = new Set(voyages.map((p) => p.cle.slice(p.cle.indexOf(':'))));
    resultat.push(...sortiesCoupees(g, v, r, c).filter((p) => !memes.has(p.cle.slice(p.cle.indexOf(':')))), ...voyages);
  }
  return resultat.sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || (a.sorte === b.sorte ? 0 : a.sorte === 'sortie' ? -1 : 1));
}

/**
 * Ajoute les fusions de l'IA (IA6) : une fusion qui recoupe une sortie
 * proposée s'y joint (elle la confirme, avec son nom et sa raison) ; les
 * autres deviennent des propositions. Une fusion dont toutes les paires ont
 * été refusées n'est plus montrée.
 */
export function avecIA(liste: Proposition[], v: Voisinage, fusions: { parent: string; f: FusionProposee }[], ignorees: ReadonlySet<string>): Proposition[] {
  const resultat = [...liste];
  for (const { parent, f } of fusions) {
    const g = v.groupes.find((x) => x.parent === parent);
    if (!g) continue;
    const ids = [...new Set([...(f.cibleId ? [f.cibleId] : []), ...f.sources])];
    const dossiers = ids.map((id) => g.dossiers.find((d) => d.id === id)).filter((d): d is DossierInfo => !!d);
    if (dossiers.length < 2 || paires(dossiers.map((d) => d.id)).every((p) => ignorees.has(p))) continue;
    const ia = { cible: f.cible, raison: f.raison };
    const recoupees = resultat.filter((p) => p.sorte === 'sortie' && p.parent === parent && p.dossiers.some((d) => ids.includes(d.id)));
    if (!recoupees.length) {
      resultat.push(proposition('sortie', parent, dossiers, { ia }));
      continue;
    }
    const union = new Map([...recoupees.flatMap((p) => p.dossiers), ...dossiers].map((d) => [d.id, d]));
    const rencontre = recoupees.map((p) => p.rencontre).filter((x): x is Rencontre => !!x).sort((x, y) => x.minutes - y.minutes)[0] ?? null;
    const p = proposition('sortie', parent, [...union.values()], { rencontre, noms: recoupees.some((x) => x.noms), ia });
    resultat.splice(resultat.indexOf(recoupees[0]), 1, p);
    for (const x of recoupees.slice(1)) resultat.splice(resultat.indexOf(x), 1);
  }
  return resultat.sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || (a.sorte === b.sorte ? 0 : a.sorte === 'sortie' ? -1 : 1));
}

/** Le dossier qui reçoit les autres : celui qui a le plus de photos (le plus ancien à égalité). */
export function principal(dossiers: DossierInfo[]): DossierInfo {
  return dossiers.reduce((m, d) => (d.photos.length > m.photos.length ? d : m), dossiers[0]);
}

/** Nom d'un dossier réuni : sa date finale étendue à toute la période (« Plage_18.07.26 » → « Plage_18-19.07.26 »). */
export function nomReuni(nom: string, du?: string, au?: string): string {
  if (!du || !au) return nom;
  const dates = dateDeNom(du.slice(0, 10), au.slice(0, 10));
  if (MOTIF_DATE_SEULE.test(nom)) return dates;
  const base = sansDateFinale(nom);
  return base === nom ? nom : `${base}_${dates}`;
}

/**
 * Nom proposé pour une proposition : réunie en un dossier (`un`), celui de
 * l'IA, ou celui du plus grand dossier aux dates étendues ; rangée en un
 * dossier de voyage avec ses étapes (`etapes`), « Voyage_<lieu>_<dates> ».
 */
export function nomPropose(p: Proposition, choix: 'un' | 'etapes', nomParent = ''): string {
  if (choix === 'un' && p.ia) return p.ia.cible;
  if (choix === 'un' && p.voyageEntier && nomParent) return nomParent;
  const pr = principal(p.dossiers);
  if (choix === 'un') return nomReuni(pr.nom, p.du, p.au);
  const lieu = MOTIF_DATE_SEULE.test(pr.nom) ? '' : sansDateFinale(pr.nom);
  return [nomsSortie().voyage, lieu, p.du && p.au ? dateDeNom(p.du.slice(0, 10), p.au.slice(0, 10)) : ''].filter(Boolean).join('_');
}

// ---------------------------------------------------------------------------
// Coût
// ---------------------------------------------------------------------------

/**
 * Coût estimé (majorant) : un appel par répertoire, la liste (20 jetons par
 * dossier) et la consigne (900), une planche par petit dossier, 1500 jetons
 * de sortie.
 */
export function estimationConsolidation(groupes: GroupeFreres[], idModele: string, seuilPlanche = SEUIL_PLANCHE): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  let images = 0;
  let entree = 0;
  for (const g of groupes) {
    entree += 900 + 20 * g.dossiers.length;
    for (const d of dossiersAPlanche(g.dossiers, seuilPlanche)) {
      images++;
      entree += jetonsPlanche(Math.min(PLANCHE_05.max, d.photos.length), PLANCHE_05.cellule, PLANCHE_05.colonnes, PLANCHE_05.marge, m.coteImageMax);
    }
  }
  return { appels: groupes.length, images, recherches: 0, usd: coutEstime(idModele, entree, groupes.length, 0) };
}
