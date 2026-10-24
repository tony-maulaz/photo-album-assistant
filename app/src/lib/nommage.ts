// Nommage des dossiers (étape « Nommage », IA4) : portage du script 04, plus les
// requêtes IA communes aux aides d'organisation (des floues à la consolidation). L'IA voit
// quelques photos réparties dans le temps, le lieu, la période, le calendrier
// et le contexte du projet, cherche au besoin sur le web, et propose un nom
// dans la convention de la famille ; l'utilisateur relit tout (règle d'or 3).

import monumentsNommage from '../ia/consignes/monuments_nommage.txt?raw';
import consigneContexte from '../ia/consignes/nommage_contexte.txt?raw';
import consigneNommage from '../ia/consignes/nommage_consigne.txt?raw';
import consigneSousDossier from '../ia/consignes/nommage_sous_dossier.txt?raw';
import consigneSysteme from '../ia/consignes/nommage_systeme.txt?raw';
import { verifierNomDossier } from './noms';
import { RACINE, type FichierPlan, type Plan } from './plan';
import { coutUSD, jetonsImage, modele as infoModele, PRIX_RECHERCHE_WEB } from './tarifs';

// ---------------------------------------------------------------------------
// Requêtes IA communes aux aides d'organisation
// ---------------------------------------------------------------------------

/** Ce qu'un appel envoie, dans l'ordre : textes, photos seules ou planches (fabriquées par le navigateur). */
export type BlocContenu =
  | { type: 'texte'; texte: string }
  /** Une photo à l'endroit, réduite pour que son grand côté fasse `cote` px. */
  | { type: 'photo'; id: string; cote: number }
  /**
   * Planche-contact. `numeros` absent : pas de pastille (planches du script
   * 05) ; sinon une pastille par vignette, avec `etiquettes` après le numéro.
   */
  | {
      type: 'planche';
      ids: string[];
      cellule: number;
      colonnes: number;
      marge: number;
      qualite: number;
      numeros?: (number | string)[];
      etiquettes?: Record<string, string>;
    };

export type FonctionOrganisation = 'IA1' | 'IA2' | 'IA3' | 'IA4' | 'IA5' | 'IA6';

/** Tout ce qu'il faut au service d'appel : il fabrique les images, appelle, répare le JSON et le met en cache. */
export interface RequeteIA {
  fonction: FonctionOrganisation;
  systeme: string;
  contenu: BlocContenu[];
  /** Format de réponse (sorties structurées) ; la réparation et la validation restent faites. */
  schema: Record<string, unknown>;
  /** Clé de cache : fonction, modèle, empreinte de la consigne et identité des photos (jamais leur chemin). */
  cle: string;
  effort: 'low' | 'medium' | 'high';
  maxTokens: number;
  /** Outil de recherche web côté API, ou `null`. */
  outils: OutilRechercheWeb[] | null;
  /** Majorant du coût de l'appel, pour la pause avant dépassement du budget. */
  estimationUSD: number;
}

export interface OutilRechercheWeb {
  type: 'web_search_20260209' | 'web_search_20250305';
  name: 'web_search';
  max_uses: number;
}

/** Modèles qui acceptent la recherche web à filtrage dynamique ; les autres gardent la version de base. */
const RECHERCHE_DYNAMIQUE = /^claude-(opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/;

export function outilRechercheWeb(idModele: string, maxUses: number): OutilRechercheWeb {
  return { type: RECHERCHE_DYNAMIQUE.test(idModele) ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: maxUses };
}

/** Empreinte FNV-1a (32 bits) d'un texte, pour les clés de cache. */
export function empreinteTexte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Clé de cache d'une requête : la consigne entière compte (lieu, dates, calendrier, contexte…). */
export function cleRequete(fonction: FonctionOrganisation, idModele: string, consigne: string, identites: string[]): string {
  return `${fonction}|${idModele}|${empreinteTexte(consigne)}|${identites.join('|')}`;
}

export const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le modèle renvoie parfois une LISTE au lieu de l'objet attendu : on prend le premier objet utilisable (script 04). */
export function premierObjet(v: unknown): Record<string, unknown> | null {
  if (Array.isArray(v)) return v.find(estObjet) ?? null;
  return estObjet(v) ? v : null;
}

/** Entier tiré d'une valeur du modèle : 8, 8.0, « 8 », « 8/10 » ; `null` sinon. */
export function entier(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === 'string') {
    const m = v.trim().match(/^-?\d+(?:[.,]\d+)?/);
    return m ? Math.trunc(Number(m[0].replace(',', '.'))) : null;
  }
  return null;
}

/** Confiance ramenée entre 0 et 10, ou `null` si absente. */
export function confiance(v: unknown): number | null {
  const n = entier(v);
  return n === null ? null : Math.max(0, Math.min(10, n));
}

/** Texte court tiré d'une valeur du modèle (chaîne vide si ce n'en est pas une). */
export function texteCourt(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Booléen tiré d'une valeur du modèle : true, « true », « oui » ; sinon false. */
export function booleen(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return typeof v === 'string' && /^(true|oui|yes|vrai)$/i.test(v.trim());
}

/** Jetons d'une photo envoyée seule, réduite à `cote` px (format 4:3, majorant courant). */
export function jetonsPhoto(cote: number, coteMax: number): number {
  return jetonsImage(cote, Math.round((cote * 3) / 4), coteMax);
}

/** Jetons d'une planche de `n` vignettes. */
export function jetonsPlanche(n: number, cellule: number, colonnes: number, marge: number, coteMax: number): number {
  const c = Math.min(n, colonnes);
  const lignes = Math.ceil(n / colonnes);
  return jetonsImage(c * cellule + (c + 1) * marge, lignes * cellule + (lignes + 1) * marge, coteMax);
}

export interface Estimation {
  appels: number;
  images: number;
  /** Recherches web au plus (majorant). */
  recherches: number;
  usd: number;
}

/** Sortie comptée par appel, réflexion comprise (comme pour les doublons, D37). */
export const SORTIE_PAR_APPEL = 1500;
/** Contexte ajouté par les résultats d'une recherche web (le script 04 multipliait le coût par 2,5). */
export const JETONS_PAR_RECHERCHE = 2500;

/** Coût majorant d'un ensemble d'appels, d'après les jetons d'entrée et le nombre de recherches. */
export function coutEstime(idModele: string, entree: number, appels: number, recherches: number): number {
  const usd = coutUSD(idModele, { input_tokens: entree + recherches * JETONS_PAR_RECHERCHE, output_tokens: appels * SORTIE_PAR_APPEL }) ?? 0;
  return usd + recherches * PRIX_RECHERCHE_WEB;
}

const nombreJours = (d: string) => d.slice(0, 10);

/** « 09.06.2025 » ou « du 09.06.2025 au 11.06.2025 » (script 04). */
export function periodeLongue(du?: string, au?: string): string {
  const jour = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  if (!du || !au) return 'date inconnue';
  return nombreJours(du) === nombreJours(au) ? jour(du) : `du ${jour(du)} au ${jour(au)}`;
}

/** « 24.07 12:10 - 12:18 » : période courte d'un dossier, comme le script 05. */
export function periodeHeures(du?: string, au?: string): string {
  if (!du || !au) return 'date inconnue';
  const h = (d: string) => (d.length > 10 ? d.slice(11, 16) : '00:00');
  return `${du.slice(8, 10)}.${du.slice(5, 7)} ${h(du)} - ${h(au)}`;
}

// ---------------------------------------------------------------------------
// Dossiers à nommer
// ---------------------------------------------------------------------------

/** Dossiers produits automatiquement (script 01) : Lieu_AAAA-MM-JJ, Lieu_AAAA-MM, suffixes _b/_c, ou Lieu_00 (Place_00 en anglais). */
export const MOTIF_AUTO = /_(\d{4}-\d{2}(-\d{2})?)(_[b-z])?$|^(Lieu|Place)_\d+$/;
/** Sous-dossiers nommés uniquement par une date (dans Maison/, Voyage_.../...). */
export const MOTIF_DATE_SEULE = /^\d{4}-\d{2}(-\d{2})?(_[b-z])?$/;
/** Dossiers jamais nommés (script 04). */
export const IGNORES_NOMMAGE = new Set(['_a_supprimer', '_autres', 'Sans_lieu', 'No_place']);

export function estNomAutomatique(nom: string): boolean {
  return MOTIF_AUTO.test(nom) || MOTIF_DATE_SEULE.test(nom);
}

export interface CibleNommage {
  /** Identifiant du dossier dans le plan. */
  dossier: string;
  nom: string;
  /** Nom du dossier parent pour un sous-dossier (la consigne demande de ne pas le répéter), sinon `null`. */
  parent: string | null;
  /** Photos du dossier et de ses sous-dossiers, de l'archive, par date. */
  photos: FichierPlan[];
}

/** Photos de l'archive d'un dossier et de ses sous-dossiers, triées par date (`rglob` du script). */
export function photosDuDossier(plan: Plan, id: string): FichierPlan[] {
  const sous = new Set([id]);
  let ajout = true;
  while (ajout) {
    ajout = false;
    for (const d of plan.dossiers.values()) {
      if (d.parent !== null && sous.has(d.parent) && !sous.has(d.id)) {
        sous.add(d.id);
        ajout = true;
      }
    }
  }
  return [...plan.fichiers.values()]
    .filter((f) => f.categorie === 'photo' && f.statut === 'archive' && sous.has(f.dossier))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id));
}

/**
 * Dossiers à nommer (script 04) : ceux au nom automatique (tous avec
 * `tous`) qui contiennent des photos. Un sous-dossier reçoit le nom de son
 * parent, que la consigne demande de ne pas répéter.
 */
export function dossiersANommer(plan: Plan, tous = false): CibleNommage[] {
  const cibles: CibleNommage[] = [];
  const ignore = (n: string) => IGNORES_NOMMAGE.has(n);
  for (const d of plan.dossiers.values()) {
    if (d.parent === null || ignore(d.nom)) continue;
    const parent = plan.dossiers.get(d.parent);
    if (parent && parent.parent !== null && ignore(parent.nom)) continue;
    if (!tous && !estNomAutomatique(d.nom)) continue;
    const photos = photosDuDossier(plan, d.id);
    if (!photos.length) continue;
    cibles.push({ dossier: d.id, nom: d.nom, parent: d.parent === RACINE ? null : (parent?.nom ?? null), photos });
  }
  // Ordre du script : les parents d'abord, chacun suivi de ses sous-dossiers.
  return cibles.sort((a, b) => cheminTri(plan, a.dossier).localeCompare(cheminTri(plan, b.dossier)));
}

function cheminTri(plan: Plan, id: string): string {
  const parties: string[] = [];
  for (let d = plan.dossiers.get(id); d && d.parent !== null; d = plan.dossiers.get(d.parent)) parties.unshift(d.nom);
  return parties.join('/');
}

/** `n` photos réparties sur toute la durée de la sortie (script 04). */
export function echantillon<T>(photos: T[], n = 5): T[] {
  if (photos.length <= n) return [...photos];
  const pas = photos.length / n;
  return Array.from({ length: n }, (_, i) => photos[Math.floor(i * pas)]);
}

/**
 * Lieu donné au modèle (script 04) : le nom du dossier sans sa date, ou le
 * nom du parent pour un sous-dossier daté (Maison/2025-01-05 → « Maison »).
 */
export function lieuDuDossier(nom: string, parent: string | null): string {
  if (MOTIF_DATE_SEULE.test(nom) && parent) return parent.replace(/_/g, ' ');
  return nom.replace(/_\d{4}-\d{2}(-\d{2})?(_[b-z])?$/, '').replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Consigne, requête et réponse
// ---------------------------------------------------------------------------

export const PHOTOS_PAR_DOSSIER = 5;
/** Côté des photos envoyées (le script 04 les réduisait à 768 px). */
export const COTE_PHOTO_NOMMAGE = 768;
export const RECHERCHES_PAR_DOSSIER = 3;

export interface OptionsNommage {
  photosParDossier?: number;
  /** Recherche web côté API (3 au plus par dossier) ; `false` = photos seules (`--sans-recherche-web`). */
  recherche?: boolean;
  /** Bloc d'événements du calendrier, déjà mis en forme (`blocCalendrier` de `lib/ics.ts`), ou vide. */
  calendrier?: string;
  /** Contexte du projet (étape 1), transmis tel quel. */
  contexte?: string;
  /** Demande aussi les monuments reconnus (toujours, dans l'application : D51). */
  monuments?: boolean;
  /** Position moyenne du dossier, ajoutée au lieu. */
  gps?: { lat: number; lon: number };
  /** Lieu à donner à la place de celui tiré du nom (lieu connu, géocodage du tri). */
  lieu?: string;
}

/** Consigne du script 04, avec les ajouts documentés : contexte du projet et monuments. */
export function consigneNommageDossier(c: CibleNommage, o: OptionsNommage = {}): string {
  const dates = c.photos.map((p) => p.date).filter((d): d is string => !!d);
  let lieu = o.lieu?.trim() || lieuDuDossier(c.nom, c.parent);
  if (o.gps) lieu += ` (${o.gps.lat.toFixed(4)}, ${o.gps.lon.toFixed(4)})`;
  let consigne = consigneNommage.replace('{lieu}', lieu).replace('{dates}', periodeLongue(dates[0], dates.at(-1))).replace('{n}', String(c.photos.length));
  if (c.parent) consigne += consigneSousDossier.replace('{parent}', c.parent);
  if (o.calendrier) consigne += o.calendrier;
  if (o.contexte?.trim()) consigne += consigneContexte.replace('{contexte}', o.contexte.trim());
  if (o.monuments) consigne += monumentsNommage;
  return consigne;
}

export function schemaNommage(monuments = false): Record<string, unknown> {
  // Les monuments en premier : l'IA les repère avant d'écrire le nom, qui peut s'en servir (D51).
  const proprietes: Record<string, unknown> = {
    ...(monuments ? { monuments: { type: 'array', items: { type: 'string' } } } : {}),
    nom: { type: 'string' },
    activite: { type: 'string' },
    confiance: { type: 'integer' },
    justification: { type: 'string' },
  };
  return { type: 'object', properties: proprietes, required: Object.keys(proprietes), additionalProperties: false };
}

/** Requête de nommage d'un dossier : « Photo i : » puis chaque photo, puis la consigne (script 04). */
export function requeteNommage(c: CibleNommage, idModele: string, identite: (f: FichierPlan) => string, o: OptionsNommage = {}): RequeteIA {
  const photos = echantillon(c.photos, o.photosParDossier ?? PHOTOS_PAR_DOSSIER);
  const consigne = consigneNommageDossier(c, o);
  const contenu: BlocContenu[] = [];
  photos.forEach((p, i) => {
    contenu.push({ type: 'texte', texte: `Photo ${i + 1} :` });
    contenu.push({ type: 'photo', id: p.id, cote: COTE_PHOTO_NOMMAGE });
  });
  contenu.push({ type: 'texte', texte: consigne });
  const recherche = o.recherche !== false;
  return {
    fonction: 'IA4',
    systeme: consigneSysteme,
    contenu,
    schema: schemaNommage(!!o.monuments),
    cle: cleRequete('IA4', idModele, consigne + (recherche ? '|web' : ''), photos.map(identite)),
    effort: 'medium',
    maxTokens: 16000,
    outils: recherche ? [outilRechercheWeb(idModele, RECHERCHES_PAR_DOSSIER)] : null,
    estimationUSD: estimationNommage([photos.length], idModele, { recherche }).usd,
  };
}

export interface NomPropose {
  /** Nom proposé, ramené à la convention (`normaliserNom`). */
  nom: string;
  /** Nom tel que le modèle l'a écrit, s'il a fallu le corriger. */
  nomBrut: string;
  activite: string;
  /** 0 à 10, `null` si absente. */
  confiance: number | null;
  justification: string;
  monuments: string[];
}

/** Réponse du nommage validée champ par champ ; `null` si aucun nom exploitable. */
export function lireNommage(v: unknown): NomPropose | null {
  const r = premierObjet(v);
  if (!r) return null;
  const brut = texteCourt(r.nom, 200);
  const nom = normaliserNom(brut);
  if (!nom) return null;
  return {
    nom,
    nomBrut: brut,
    activite: texteCourt(r.activite, 200),
    confiance: confiance(r.confiance),
    justification: texteCourt(r.justification),
    monuments: Array.isArray(r.monuments) ? r.monuments.map((m) => texteCourt(m, 120)).filter(Boolean).slice(0, 10) : [],
  };
}

// ---------------------------------------------------------------------------
// Convention de nom
// ---------------------------------------------------------------------------

/**
 * Nom ramené à la convention Theme_Lieu_JJ.MM.AA : sans accents ni espaces
 * ni caractères spéciaux (`nom_valide` du script, plus la suppression des
 * accents demandée par la consigne), dates finales réécrites au format
 * JJ.MM.AA. Chaîne vide si rien d'utilisable.
 */
export function normaliserNom(nom: string): string {
  let n = nom
    .replace(/[’']/g, ' ')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .trim()
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
  n = n
    // _2025-06-09 → _09.06.25 ; _2025-06 → _06.25
    .replace(/_(\d{4})-(\d{2})-(\d{2})$/, (_, a: string, m: string, j: string) => `_${j}.${m}.${a.slice(2)}`)
    .replace(/_(\d{4})-(\d{2})$/, (_, a: string, m: string) => `_${m}.${a.slice(2)}`)
    // _09.06.2025 → _09.06.25 ; _27-29.06.2025 → _27-29.06.25
    .replace(/_(\d{2}(?:-\d{2})?)\.(\d{2})\.(\d{2})(\d{2})$/, (_, j: string, m: string, _s: string, a: string) => `_${j}.${m}.${a}`)
    // _9.6.25 → _09.06.25
    .replace(/_(\d{1,2})\.(\d{1,2})\.(\d{2})$/, (_, j: string, m: string, a: string) => `_${j.padStart(2, '0')}.${m.padStart(2, '0')}.${a}`);
  n = n.slice(0, 120).replace(/[_.-]+$/, '');
  return verifierNomDossier(n) ? '' : n;
}

/** Le nom suit-il la convention (Theme_Lieu_JJ.MM.AA ou Theme_Lieu_JJ-JJ.MM.AA) ? */
export function respecteConvention(nom: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]*(_[A-Za-z0-9-]+)*_\d{2}(-\d{2})?\.\d{2}\.\d{2}$/.test(nom);
}

// ---------------------------------------------------------------------------
// Coût
// ---------------------------------------------------------------------------

/**
 * Coût estimé (majorant) du nommage : par dossier, ses photos (768 px),
 * 900 jetons de texte (système, consigne, calendrier), 1500 de sortie, et
 * 3 recherches web avec leurs résultats si la recherche est permise.
 */
export function estimationNommage(photosParDossier: number[], idModele: string, o: { recherche?: boolean; photosParDossier?: number } = {}): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  const parDossier = o.photosParDossier ?? PHOTOS_PAR_DOSSIER;
  let images = 0;
  let entree = 0;
  for (const n of photosParDossier) {
    const k = Math.min(n, parDossier);
    images += k;
    entree += k * jetonsPhoto(COTE_PHOTO_NOMMAGE, m.coteImageMax) + 900;
  }
  const appels = photosParDossier.filter((n) => n > 0).length;
  const recherches = o.recherche === false ? 0 : appels * RECHERCHES_PAR_DOSSIER;
  return { appels, images, recherches, usd: coutEstime(idModele, entree, appels, recherches) };
}
