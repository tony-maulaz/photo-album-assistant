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
import { dureeEvenement, evenementsAutour, evenementsUtiles, partPendant, type EvenementCalendrier } from './ics';
import { verifierNomDossier } from './noms';
import { dateSure, RACINE, type FichierPlan, type Plan } from './plan';
import { coutUSD, jetonsImage, modele as infoModele, PRIX_RECHERCHE_WEB } from './tarifs';
import { dateDeNom } from './tri';

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

/** Date à l'ancienne des noms du tri (script 01) : AAAA-MM-JJ ou AAAA-MM. */
const DATE_ISO = String.raw`\d{4}-\d{2}(?:-\d{2})?`;
/**
 * Date à la manière de la famille, donnée par le tri depuis le 24.10.2026 :
 * JJ.MM.AA, JJ-JJ.MM.AA, JJ.MM-JJ.MM.AA, JJ.MM.AA-JJ.MM.AA ou MM.AA (par mois).
 */
const DATE_JJMMAA = String.raw`\d{2}(?:-\d{2})?\.\d{2}\.\d{2}|\d{2}\.\d{2}(?:\.\d{2})?-\d{2}\.\d{2}\.\d{2}|\d{2}\.\d{2}`;
/** Suffixe d'un nom déjà pris : _b, _c… (tri) ou _2, _3… */
const SUFFIXE = String.raw`(?:_[b-z]|_\d+)?`;
/** Anciens noms du tri : Lieu_AAAA-MM-JJ, Lieu_AAAA-MM, suffixes _b/_c, ou Lieu_00 (Place_00 en anglais). Toujours automatiques. */
const MOTIF_AUTO_ISO = new RegExp(String.raw`_(?:${DATE_ISO})(?:_[b-z])?$|^(?:Lieu|Place)_\d+$`);
const MOTIF_DATE_SEULE_ISO = new RegExp(String.raw`^(?:${DATE_ISO})(?:_[b-z])?$`);
/** Noms produits par le tri, à l'ancienne (Lieu_AAAA-MM-JJ) ou au format de la famille (Lieu_JJ.MM.AA), ou Lieu_00. */
export const MOTIF_AUTO = new RegExp(String.raw`_(?:${DATE_ISO}|${DATE_JJMMAA})${SUFFIXE}$|^(?:Lieu|Place)_\d+$`);
/** Sous-dossiers nommés uniquement par une date (dans Maison/, Voyage_.../...), dans l'un ou l'autre format. */
export const MOTIF_DATE_SEULE = new RegExp(String.raw`^(?:${DATE_ISO}|${DATE_JJMMAA})${SUFFIXE}$`);
/** Dossiers jamais nommés (script 04). */
export const IGNORES_NOMMAGE = new Set(['_a_supprimer', '_autres', 'Sans_lieu', 'No_place']);

/**
 * Nom donné automatiquement par le tri, à remplacer par un nom parlant.
 * Une date à l'ancienne (AAAA-MM-JJ) ne vient que du tri. Une date au format
 * de la famille (JJ.MM.AA) est aussi celle des dossiers nommés à la main : le
 * nom n'est automatique que si c'est encore celui que le tri a donné
 * (`nomDuTri`, noté dans `DossierPlan.tri.nom`).
 */
export function estNomAutomatique(nom: string, nomDuTri?: string): boolean {
  if (MOTIF_AUTO_ISO.test(nom) || MOTIF_DATE_SEULE_ISO.test(nom)) return true;
  return nom === nomDuTri && (MOTIF_AUTO.test(nom) || MOTIF_DATE_SEULE.test(nom));
}

/** Nom sans sa date finale (l'un ou l'autre format) ni son suffixe : « Ko_Samui_18-24.07.26 » → « Ko_Samui ». */
export function sansDateFinale(nom: string): string {
  return nom.replace(new RegExp(String.raw`_(?:${DATE_ISO}|${DATE_JJMMAA})${SUFFIXE}$`), '');
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
    if (!tous && !estNomAutomatique(d.nom, d.tri?.nom)) continue;
    const photos = photosDuDossier(plan, d.id);
    if (!photos.length) continue;
    cibles.push({ dossier: d.id, nom: d.nom, parent: d.parent === RACINE ? null : (parent?.nom ?? null), photos });
  }
  // Ordre du script : les parents d'abord, chacun suivi de ses sous-dossiers.
  return cibles.sort((a, b) => cheminTri(plan, a.dossier).localeCompare(cheminTri(plan, b.dossier)));
}

/**
 * Dossiers déjà nommés (onglet « Déjà nommés » du Nommage, D112 point 11) : ceux qui ont des photos et dont le nom
 * n'est pas automatique (choisis par l'utilisateur, ou venus tels quels du dossier d'origine), dans le même ordre.
 */
export function dossiersDejaNommes(plan: Plan): CibleNommage[] {
  return dossiersANommer(plan, true).filter((c) => !estNomAutomatique(c.nom, plan.dossiers.get(c.dossier)?.tri?.nom));
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
 * nom du parent pour un sous-dossier daté (Maison/05.01.25 → « Maison »).
 */
export function lieuDuDossier(nom: string, parent: string | null): string {
  if (MOTIF_DATE_SEULE.test(nom) && parent) return parent.replace(/_/g, ' ');
  return sansDateFinale(nom).replace(/_/g, ' ');
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

/**
 * Une proposition de nom de l'IA est-elle un nom de dossier (règle d'or 6) ? Refusées : une coordonnée
 * (« 45.7640 », « 45° 46′ » : l'IA recopie parfois la position reçue), un texte sans mot (des chiffres seuls),
 * un reste de JSON ou de balise, un texte trop long pour un nom. Les dates de la convention (« 09.06.25 »,
 * « 27-29.06.25 ») restent permises.
 */
export function nomIAValable(brut: unknown): brut is string {
  if (typeof brut !== 'string') return false;
  const s = brut.trim();
  if (!s || [...s].length > 120) return false;
  // Une coordonnée : un nombre à 3 décimales ou plus qui ne suit pas un jour ou un mois (« 09.06.2025 » est une date).
  if (/(?<![\d.,])\d{1,3}[.,]\d{3,}/.test(s) || /\d\s*[°º]/.test(s)) return false;
  if (/[{}[\]<>\n\r]/.test(s)) return false;
  return /\p{L}{2,}/u.test(s);
}

/** Réponse du nommage validée champ par champ ; `null` si aucun nom exploitable. */
export function lireNommage(v: unknown): NomPropose | null {
  const r = premierObjet(v);
  if (!r) return null;
  const brut = texteCourt(r.nom, 200);
  if (!nomIAValable(brut)) return null;
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

/**
 * Nom tiré d'un événement du calendrier (D83) : son titre, souvent parlant
 * (« 18 ans de Lea »), et les jours du dossier. Les accents et les espaces sont
 * gardés : c'est le texte du champ, qui sert aussi de titre dans l'album ; le
 * nom du dossier en est tiré par `normaliserNom` (« 18_ans_de_Lea_26.01.25 »).
 */
export function nomDepuisEvenement(titre: string, du: string, au: string): string {
  return `${titre.trim()} ${dateDeNom(du.slice(0, 10), au.slice(0, 10))}`;
}

/** Le nom suit-il la convention (Theme_Lieu_JJ.MM.AA ou Theme_Lieu_JJ-JJ.MM.AA) ? */
export function respecteConvention(nom: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]*(_[A-Za-z0-9-]+)*_\d{2}(-\d{2})?\.\d{2}\.\d{2}$/.test(nom);
}

// ---------------------------------------------------------------------------
// Noms possibles d'un dossier : calendrier, lieu, IA
// ---------------------------------------------------------------------------

/** Part des photos datées d'un dossier qu'un événement doit couvrir pour pouvoir le nommer. */
export const PART_MIN_EVENEMENT = 0.8;
/** Un titre plus long reste proposé, mais n'est jamais pris d'office : il ferait un nom de dossier trop long. */
export const TITRE_MAX_PRIS_D_OFFICE = 40;

export interface EvenementCandidat {
  evenement: EvenementCalendrier;
  /** Part des photos datées prises pendant l'événement (0,8 à 1). */
  part: number;
}

/** Mots d'un texte, sans accents ni majuscules : « Fête à Lieu-A » → « fete a lieu a ». */
function mots(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `texte` contient-il `partie`, mot pour mot ? « Course des quais Lieu A » contient « Lieu_A » ; « Lieu_AB » ne le contient pas. */
function contientMots(texte: string, partie: string): boolean {
  const p = mots(partie);
  return !!p && ` ${mots(texte)} `.includes(` ${p} `);
}

/**
 * Événements qui peuvent nommer des photos : utiles (ni récurrents ni de plus
 * de 21 jours, `evenementsUtiles`) et pendant lesquels 80 % au moins des
 * photos datées ont été prises. La plus grande part d'abord, puis le plus
 * court, plus précis ; un même titre (deux calendriers) ne compte qu'une fois.
 */
export function evenementsCandidats(evts: EvenementCalendrier[], dates: string[]): EvenementCandidat[] {
  if (!dates.length) return [];
  const triees = [...dates].sort();
  // Une journée de marge : un événement à l'heure, la veille au soir, peut couvrir les photos d'après minuit.
  const autour = evenementsAutour(evenementsUtiles(evts), triees[0].slice(0, 10), triees.at(-1)!.slice(0, 10), 1);
  const candidats = autour
    .map((evenement) => ({ evenement, part: partPendant(evenement, dates) }))
    .filter((c) => c.part >= PART_MIN_EVENEMENT - 1e-9)
    .sort(
      (a, b) =>
        b.part - a.part ||
        dureeEvenement(a.evenement) - dureeEvenement(b.evenement) ||
        a.evenement.debut.localeCompare(b.evenement.debut) ||
        a.evenement.titre.localeCompare(b.evenement.titre),
    );
  const vus = new Set<string>();
  return candidats.filter((c) => {
    const cle = mots(c.evenement.titre);
    if (!cle || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/**
 * Nom proposé pour une journée sortie d'un dossier (« Nouveau dossier avec
 * cette journée », D94) : le titre de l'événement du calendrier qui couvre ses
 * photos (`evenementsCandidats`), sinon le lieu du dossier (celui du parent pour
 * un dossier daté : Domicile/01-21.07.25 → « Domicile ») et le jour.
 */
export function nomPourJournee(nom: string, parent: string | null, jour: string, dates: string[], evts: EvenementCalendrier[]): string {
  const candidat = evenementsCandidats(evts, dates)[0];
  if (candidat) return normaliserNom(nomDepuisEvenement(candidat.evenement.titre, jour, jour));
  return normaliserNom(`${lieuDuDossier(nom, parent)} ${dateDeNom(jour)}`);
}

/**
 * Lieu d'un dossier pour son nom : celui du tri (lieu connu, géocodage), sinon
 * celui d'un nom automatique (« Lieu_A_2025-07-04 » → « Lieu A »). `null` s'il
 * est inconnu : dossier nommé à la main, ou lieu sans nom du tri (« Lieu_03 »).
 */
export function lieuPourNom(plan: Plan, c: CibleNommage): string | null {
  const d = plan.dossiers.get(c.dossier);
  const brut = d?.tri?.lieu ?? (estNomAutomatique(c.nom, d?.tri?.nom) ? lieuDuDossier(c.nom, c.parent) : '');
  const lieu = brut.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return lieu && !/^(?:Lieu|Place) \d+$/.test(lieu) ? lieu : null;
}

/**
 * Le dossier parent dit-il déjà le lieu ? Étape d'un voyage, sous-dossier
 * d'un lieu connu (« Domicile/24-26.12.25 »), ou parent dont le nom ou le
 * lieu est celui-là.
 */
function parentDitLeLieu(plan: Plan, id: string, lieu: string): boolean {
  const d = plan.dossiers.get(id);
  const p = d?.parent && d.parent !== RACINE ? plan.dossiers.get(d.parent) : undefined;
  if (!p) return false;
  if (p.tri?.origine === 'voyage' || p.tri?.origine === 'lieu_connu') return true;
  return contientMots(p.nom, lieu) || (!!p.tri?.lieu && mots(p.tri.lieu) === mots(lieu));
}

/** Nom tiré du calendrier pour un dossier. */
export interface NomCalendrier {
  /** Texte du champ : titre, lieu, dates (« Course des quais Lieu A 04.07.25 ») ; le nom du dossier en est tiré par `normaliserNom`. */
  nom: string;
  titre: string;
  /** Part des photos datées prises pendant l'événement. */
  part: number;
  /** Titre de plus de 40 caractères : proposé, jamais pris d'office. */
  long: boolean;
}

/** Ce qui peut nommer un dossier ; l'utilisateur choisit, ou écrit le sien. */
export interface NomsPossibles {
  /** Un nom par événement candidat, dans l'ordre de `evenementsCandidats`. */
  calendrier: NomCalendrier[];
  /** Lieu et dates (« Lieu A 04.07.25 »), ou `null` si le lieu est inconnu. */
  lieu: string | null;
  /** Nom proposé par l'IA, s'il existe. */
  ia: string | null;
  /**
   * Nom pris d'office pour le champ : le meilleur événement candidat (titre de
   * 40 caractères au plus, sans égalité avec le suivant), sinon la proposition
   * de l'IA, sinon rien. `seul` : c'est le seul candidat (« Prendre le nom du
   * calendrier » ne renomme que ceux-là ; avec plusieurs, l'utilisateur vérifie).
   */
  propose: { nom: string; source: 'calendrier' | 'ia'; seul?: boolean } | null;
}

/**
 * Noms possibles de chaque dossier à nommer (D83). Un événement du calendrier
 * candidat donne son titre suivi du lieu et des dates du dossier, selon la
 * convention Theme_Lieu_JJ.MM.AA (« Course des quais Lieu A 04.07.25 ») ; le
 * lieu n'est pas ajouté s'il figure déjà dans le titre, ni pour un
 * sous-dossier dont le parent le dit déjà (« Domicile/24-26.12.25 » → « Noel
 * 24-26.12.25 »). Un sous-dossier ne reçoit pas un événement que son parent
 * porte déjà dans son nom, ni un événement qui nomme aussi son parent, à
 * nommer ici (le titre d'un voyage ne se répète pas dans chaque étape). Deux
 * dossiers voisins qui recevraient le même nom sont numérotés (« … Lieu A 2
 * 04.07.25 »). `ia` : propositions de l'IA par dossier (lues d'un fichier :
 * vérifiées ici).
 */
export function nomsPossibles(plan: Plan, cibles: CibleNommage[], evts: EvenementCalendrier[], ia: Record<string, unknown> = {}): Map<string, NomsPossibles> {
  const datesDe = (photos: FichierPlan[]) =>
    photos
      .map((f) => dateSure(f))
      .filter((d): d is string => !!d)
      .sort();
  const aNommer = new Set(cibles.map((c) => c.dossier));
  // Candidats des parents à nommer ici, calculés une fois par parent.
  const candidatsParent = new Map<string, Set<string>>();
  const titresDuParent = (id: string): Set<string> => {
    let s = candidatsParent.get(id);
    if (!s) {
      s = new Set(evenementsCandidats(evts, datesDe(photosDuDossier(plan, id))).map((c) => mots(c.evenement.titre)));
      candidatsParent.set(id, s);
    }
    return s;
  };

  const pris = new Map<string, number>();
  const resultat = new Map<string, NomsPossibles>();
  for (const c of cibles) {
    const d = plan.dossiers.get(c.dossier);
    const parent = d?.parent && d.parent !== RACINE ? plan.dossiers.get(d.parent) : undefined;
    const dates = datesDe(c.photos);
    const lieu = lieuPourNom(plan, c);
    const avecDates = (texte: string) => (dates.length ? nomDepuisEvenement(texte, dates[0], dates.at(-1)!) : texte.trim());
    const ajouterLieu = !!lieu && !parentDitLeLieu(plan, c.dossier, lieu);

    const calendrier: NomCalendrier[] = [];
    const durees: number[] = [];
    for (const { evenement, part } of evenementsCandidats(evts, dates)) {
      const titre = evenement.titre.trim();
      if (parent && (contientMots(parent.nom, titre) || (aNommer.has(parent.id) && titresDuParent(parent.id).has(mots(titre))))) continue;
      const base = ajouterLieu && !contientMots(titre, lieu!) ? `${titre} ${lieu}` : titre;
      const cle = `${d?.parent ?? ''}|${mots(avecDates(base))}`;
      const n = (pris.get(cle) ?? 0) + 1;
      pris.set(cle, n);
      calendrier.push({ nom: avecDates(n > 1 ? `${base} ${n}` : base), titre, part, long: [...titre].length > TITRE_MAX_PRIS_D_OFFICE });
      durees.push(dureeEvenement(evenement));
    }

    // Lue d'un fichier (une réponse gardée d'avant cette vérification) : un nom refusé n'est pas proposé.
    const brutIA = estObjet(ia[c.dossier]) ? (ia[c.dossier] as Record<string, unknown>).nom : undefined;
    const nomIA = nomIAValable(brutIA) ? brutIA.trim() : null;
    // Le plus précis des candidats (« 18 ans de Lea » plutôt que le voyage qui l'entoure), sauf égalité parfaite.
    const exAequo = calendrier.length > 1 && Math.abs(calendrier[0].part - calendrier[1].part) < 1e-9 && durees[0] === durees[1];
    const meilleur = calendrier[0] && !calendrier[0].long && !exAequo ? calendrier[0] : null;
    resultat.set(c.dossier, {
      calendrier,
      lieu: lieu ? avecDates(lieu) : null,
      ia: nomIA,
      propose: meilleur ? { nom: meilleur.nom, source: 'calendrier', seul: calendrier.length === 1 } : nomIA ? { nom: nomIA, source: 'ia' } : null,
    });
  }
  return resultat;
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
