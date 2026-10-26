// Aides IA de la sélection (étape « Sélection », SPEC § 6.9) : étiquettes et description
// (IA8), appréciation (IA9), meilleure de la pile (IA10), contrôle de la
// sélection (IA11). L'IA note, décrit et remarque ; elle ne coche jamais rien
// (principe P5). Ce module prépare les demandes et lit les réponses ; l'appel
// lui-même (images, cache, budget) est fait par le service du navigateur.

import consigneAppreciation from '../ia/consignes/selection_appreciation.txt?raw';
import consigneControle from '../ia/consignes/selection_controle.txt?raw';
import consigneControleAutres from '../ia/consignes/selection_controle_autres.txt?raw';
import criteres from '../ia/consignes/selection_criteres.txt?raw';
import consigneEtiquettes from '../ia/consignes/selection_etiquettes.txt?raw';
import consigneMeilleure from '../ia/consignes/selection_meilleure_pile.txt?raw';
import suffixeJson from '../ia/consignes/selection_suffixe_json.txt?raw';
import systemeDescription from '../ia/consignes/selection_systeme_description.txt?raw';
import consigneContexte from '../ia/consignes/textes_contexte.txt?raw';
import { aTraduire } from './langue';
import { jetonsImage, PRIX_RECHERCHE_WEB, type Modele } from './tarifs';

// ---------------------------------------------------------------------------
// Demandes communes aux aides de la sélection et de l'album
// ---------------------------------------------------------------------------

export type FonctionIA = 'IA8' | 'IA9' | 'IA10' | 'IA11' | 'IA12' | 'IA13' | 'IA14' | 'IA15' | 'IA16';

/** Photo transmise à une aide : son identité stable sert aux clés de cache (jamais le chemin). */
export interface PhotoIA {
  id: string;
  /** Identité du fichier (chemin d'origine, taille, date), comme `cleAnalyse`. */
  identite: string;
  date?: string;
  album?: 0 | 1 | 2;
  /** Netteté douteuse (seuil du dossier, I8) : marque [flou?] sur les planches. */
  flou?: boolean;
}

/**
 * Image envoyée, précédée de son libellé (« Photo 1 : », « Planche 2 : »).
 * Une planche est une grille de vignettes numérotées (comme le script 06) ;
 * une photo est l'original réduit à `cote` px, à l'endroit.
 */
export type ImageDemandee =
  | { type: 'planche'; libelle: string; ids: string[]; numeros: number[]; flous: number[]; cellule: number; colonnes: number; etiquettes?: Record<number, string> }
  | { type: 'photo'; libelle: string; id: string; cote: number };

export interface DemandeIA {
  fonction: FonctionIA;
  /** Modèle des Réglages : rapide (gros volumes), standard, avancé (textes). */
  niveau: 'rapide' | 'standard' | 'avance';
  systeme: string;
  images: ImageDemandee[];
  consigne: string;
  /** Format demandé (sorties structurées) ; absent quand la consigne reprise du script attend une liste. */
  schema?: Record<string, unknown>;
  effort: 'low' | 'medium' | 'high';
  /** Recherches web autorisées (outil côté API) ; 0 = aucune. */
  rechercheWeb: number;
  maxTokens: number;
  /** Le numéro n cité dans la réponse désigne `ids[n - 1]`. */
  ids: string[];
  /** Clé de cache, sans le modèle : fonction, identité des photos, empreinte de la consigne. */
  cle: string;
  /** Jetons de sortie attendus (réflexion comprise), pour l'estimation du coût. */
  sortieEstimee: number;
}

/** Empreinte FNV-1a (32 bits) d'un texte, en hexadécimal. */
export function empreinteTexte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Clé de cache : relancer avec les mêmes photos et la même consigne ne repaie jamais. */
export function cleDemande(fonction: FonctionIA, photos: { identite: string }[], d: Pick<DemandeIA, 'systeme' | 'consigne' | 'images' | 'rechercheWeb'>): string {
  const forme = d.images.map((i) => (i.type === 'planche' ? `p${i.cellule}x${i.colonnes}:${JSON.stringify(i.etiquettes ?? {})}:${i.flous.join(',')}` : `f${i.cote}`)).join(';');
  return `${fonction}:${photos.map((p) => p.identite).join('|')}#${empreinteTexte(`${d.systeme}\n${d.consigne}\n${forme}\n${d.rechercheWeb}`)}`;
}

/** Remplit les marqueurs {nom} d'une consigne. */
export function remplir(modele: string, valeurs: Record<string, string | number>): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

/** Ligne de contexte du projet (§ 6.1), ou rien. */
export function ligneContexte(contexte?: string): string {
  const c = contexte?.trim();
  return c ? `\n\n${remplir(consigneContexte, { contexte: c })}` : '';
}

/** Découpe en lots de `taille` au plus, de tailles équilibrées (13 en 7 + 6, pas 12 + 1). */
export function lots<T>(elements: T[], taille: number): T[][] {
  if (!elements.length) return [];
  const n = Math.ceil(elements.length / taille);
  const base = Math.floor(elements.length / n);
  const reste = elements.length % n;
  const resultat: T[][] = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = base + (k < reste ? 1 : 0);
    resultat.push(elements.slice(i, i + t));
    i += t;
  }
  return resultat;
}

/** `n` éléments répartis régulièrement dans la liste (dans l'ordre). */
export function repartis<T>(elements: T[], n: number): T[] {
  if (elements.length <= n) return [...elements];
  return Array.from({ length: n }, (_, k) => elements[Math.floor(((k + 0.5) * elements.length) / n)]);
}

/** Planches numérotées de `debut` à `debut + photos.length - 1`, `parPlanche` vignettes chacune. */
export function planches(photos: PhotoIA[], debut: number, o: { libelle: string; parPlanche: number; cellule: number; colonnes: number; etiquettes?: (p: PhotoIA, numero: number) => string }): ImageDemandee[] {
  return lots(photos, o.parPlanche).map((bloc, k, tous) => {
    const premier = debut + tous.slice(0, k).reduce((t, b) => t + b.length, 0);
    const numeros = bloc.map((_, i) => premier + i);
    const etiquettes = o.etiquettes ? Object.fromEntries(bloc.map((p, i) => [numeros[i], o.etiquettes!(p, numeros[i])])) : undefined;
    return {
      type: 'planche' as const,
      libelle: tous.length > 1 ? `${o.libelle} ${k + 1} :` : `${o.libelle} :`,
      ids: bloc.map((p) => p.id),
      numeros,
      flous: bloc.flatMap((p, i) => (p.flou ? [numeros[i]] : [])),
      cellule: o.cellule,
      colonnes: o.colonnes,
      ...(etiquettes ? { etiquettes } : {}),
    };
  });
}

/** Photos individuelles, « Photo 1 : », « Photo 2 : »… (comme le script 03). */
export function photosNumerotees(photos: PhotoIA[], cote: number): ImageDemandee[] {
  return photos.map((p, i) => ({ type: 'photo' as const, libelle: `Photo ${i + 1} :`, id: p.id, cote }));
}

/** Coût estimé d'un ensemble de demandes (majorant) avec le modèle choisi. */
export function estimerDemandes(demandes: DemandeIA[], m: Modele): { appels: number; images: number; recherches: number; usd: number } {
  let entree = 0;
  let sortie = 0;
  let images = 0;
  let recherches = 0;
  for (const d of demandes) {
    for (const i of d.images) {
      images++;
      if (i.type === 'photo') entree += jetonsImage(i.cote, Math.round(i.cote * 0.75), m.coteImageMax);
      else {
        const c = Math.min(i.ids.length, i.colonnes);
        const l = Math.ceil(i.ids.length / i.colonnes);
        entree += jetonsImage(c * i.cellule + (c + 1) * 6, l * i.cellule + (l + 1) * 6, m.coteImageMax);
      }
      entree += 10;
    }
    entree += Math.ceil((d.systeme.length + d.consigne.length) / 3);
    sortie += d.sortieEstimee;
    // Une recherche web ajoute ses résultats aux jetons d'entrée (environ 3000 chacune).
    recherches += d.rechercheWeb;
    entree += d.rechercheWeb * 3000;
  }
  return { appels: demandes.length, images, recherches, usd: (entree * m.entree + sortie * m.sortie) / 1e6 + recherches * PRIX_RECHERCHE_WEB };
}

// ---------------------------------------------------------------------------
// Lecture prudente des réponses (règle d'or 6)
// ---------------------------------------------------------------------------

export const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Nombre lu dans « 7 », 7.5, « 7,5 », « 7/10 » ; `NaN` sinon. */
export function nombre(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const m = v.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/** Entier lu prudemment ; 0 si illisible. */
export function entier(v: unknown): number {
  const n = Math.trunc(nombre(v));
  return Number.isFinite(n) ? n : 0;
}

/** Texte d'un champ, nettoyé et borné ; « » si ce n'en est pas un. */
export function texte(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** La liste attendue : la réponse elle-même, ou le premier champ-liste connu d'un objet. */
export function liste(v: unknown, ...cles: string[]): unknown[] {
  if (Array.isArray(v)) return v;
  if (!estObjet(v)) return [];
  for (const c of cles) if (Array.isArray(v[c])) return v[c] as unknown[];
  return [];
}

/** Numéros cités, valides (1 à n), sans doublon, dans l'ordre. */
export function numeros(v: unknown, n: number): number[] {
  const brut = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
  return [...new Set(brut.map(entier).filter((x) => x >= 1 && x <= n))];
}

/** Sans accents ni majuscules, mots séparés par « _ ». */
export function simplifier(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Éléments numérotés d'une liste (« photo »), chacun rattaché à `ids` ; une
 * photo citée deux fois ne compte qu'une fois. Si aucun élément n'est
 * numéroté et qu'il y en a exactement autant que de photos, l'ordre fait foi.
 */
export function parPhoto(elements: unknown[], ids: string[], cle = 'photo'): Map<string, Record<string, unknown>> {
  const objets = elements.filter(estObjet);
  const resultat = new Map<string, Record<string, unknown>>();
  const numerotes = objets.filter((o) => entier(o[cle]) >= 1 && entier(o[cle]) <= ids.length);
  if (!numerotes.length && objets.length === ids.length && objets.every((o) => o[cle] === undefined)) {
    objets.forEach((o, i) => resultat.set(ids[i], o));
    return resultat;
  }
  for (const o of numerotes) {
    const id = ids[entier(o[cle]) - 1];
    if (!resultat.has(id)) resultat.set(id, o);
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// IA8 — étiquettes et description
// ---------------------------------------------------------------------------

export type Personnes = 'aucune' | '1' | '2-4' | 'groupe';
export type TypePhoto = 'portrait' | 'groupe' | 'paysage' | 'monument' | 'repas' | 'animal' | 'activite' | 'selfie' | 'document';
export type Defaut = 'yeux_fermes' | 'flou_de_bouge' | 'tete_coupee' | 'contre_jour' | 'horizon_penche';

export interface Etiquettes {
  personnes?: Personnes;
  type?: TypePhoto;
  defauts: Defaut[];
  description: string;
}

/** Libellés en français (texte de la recherche locale) ; à passer à `t` là où ils sont affichés. */
export const LIBELLES_PERSONNES: Record<Personnes, string> = {
  aucune: aTraduire('sans personne'),
  '1': aTraduire('une personne'),
  '2-4': aTraduire('2 à 4 personnes'),
  groupe: aTraduire('groupe'),
};
export const LIBELLES_TYPES: Record<TypePhoto, string> = {
  portrait: aTraduire('portrait'),
  groupe: aTraduire('photo de groupe'),
  paysage: aTraduire('paysage'),
  monument: aTraduire('monument'),
  repas: aTraduire('repas'),
  animal: aTraduire('animal'),
  activite: aTraduire('activité'),
  selfie: aTraduire('selfie'),
  document: aTraduire('document'),
};
export const LIBELLES_DEFAUTS: Record<Defaut, string> = {
  yeux_fermes: aTraduire('yeux fermés'),
  flou_de_bouge: aTraduire('flou de bougé'),
  tete_coupee: aTraduire('tête coupée'),
  contre_jour: aTraduire('contre-jour'),
  horizon_penche: aTraduire('horizon penché'),
};

const TYPES = Object.keys(LIBELLES_TYPES) as TypePhoto[];
const DEFAUTS = Object.keys(LIBELLES_DEFAUTS) as Defaut[];

/** Réglages de l'IA8 : photos individuelles (numéros dans le texte, pas sur l'image), modèle rapide. */
export const PARAMETRES_ETIQUETTES = { parAppel: 10, cote: 768 };

export const SCHEMA_ETIQUETTES = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          photo: { type: 'integer' },
          personnes: { type: 'string', enum: ['aucune', '1', '2-4', 'groupe'] },
          type: { type: 'string', enum: TYPES },
          defauts: { type: 'array', items: { type: 'string', enum: DEFAUTS } },
          description: { type: 'string' },
        },
        required: ['photo', 'personnes', 'type', 'defauts', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['photos'],
  additionalProperties: false,
};

/** Demandes d'étiquetage : 10 photos par appel, à 768 px. */
export function demandesEtiquettes(photos: PhotoIA[], o: { contexte?: string } = {}, p = PARAMETRES_ETIQUETTES): DemandeIA[] {
  return lots(photos, p.parAppel).map((lot) => {
    const d = {
      systeme: systemeDescription,
      consigne: remplir(consigneEtiquettes, { n: lot.length }) + ligneContexte(o.contexte),
      images: photosNumerotees(lot, p.cote),
      rechercheWeb: 0,
    };
    return {
      fonction: 'IA8' as const,
      niveau: 'rapide' as const,
      ...d,
      schema: SCHEMA_ETIQUETTES,
      effort: 'low' as const,
      maxTokens: 6000,
      ids: lot.map((x) => x.id),
      cle: cleDemande('IA8', lot, d),
      sortieEstimee: 400 + 70 * lot.length,
    };
  });
}

function lirePersonnes(v: unknown): Personnes | undefined {
  const s = simplifier(String(v ?? ''));
  if (!s) return undefined;
  if (['aucune', 'aucun', '0', 'personne', 'sans', 'sans_personne', 'non'].includes(s)) return 'aucune';
  if (['groupe', 'foule', 'plusieurs', 'beaucoup', '5+', '5_ou_plus'].includes(s)) return 'groupe';
  if (['2_4', '2a4', '2_a_4', 'petit_groupe', 'quelques'].includes(s)) return '2-4';
  if (['1', 'une', 'un', 'seule', 'seul', 'une_personne'].includes(s)) return '1';
  const n = entier(v);
  if (n === 1) return '1';
  if (n >= 2 && n <= 4) return '2-4';
  if (n >= 5) return 'groupe';
  return undefined;
}

const SYNONYMES_TYPES: Record<string, TypePhoto> = { photo_de_groupe: 'groupe', paysages: 'paysage', monuments: 'monument', animaux: 'animal', sport: 'activite', activites: 'activite', autoportrait: 'selfie', plat: 'repas', nourriture: 'repas' };

function lireType(v: unknown): TypePhoto | undefined {
  const s = simplifier(String(v ?? ''));
  return (TYPES as string[]).includes(s) ? (s as TypePhoto) : SYNONYMES_TYPES[s];
}

function lireDefaut(v: unknown): Defaut | undefined {
  const s = simplifier(String(v ?? ''));
  if ((DEFAUTS as string[]).includes(s)) return s as Defaut;
  if (s.includes('yeux')) return 'yeux_fermes';
  if (s.includes('bouge') || s === 'flou' || s.includes('flou_de')) return 'flou_de_bouge';
  if (s.includes('coupe')) return 'tete_coupee';
  if (s.includes('contre')) return 'contre_jour';
  if (s.includes('horizon') || s.includes('penche')) return 'horizon_penche';
  return undefined;
}

/** Étiquettes lues, par photo ; une photo sans description ni étiquette utilisable est absente. */
export function lireEtiquettes(reponse: unknown, ids: string[]): Map<string, Etiquettes> {
  const resultat = new Map<string, Etiquettes>();
  for (const [id, o] of parPhoto(liste(reponse, 'photos', 'etiquettes'), ids)) {
    const brutDefauts = Array.isArray(o.defauts) ? o.defauts : typeof o.defauts === 'string' ? o.defauts.split(/[,;]/) : [];
    const e: Etiquettes = {
      personnes: lirePersonnes(o.personnes),
      type: lireType(o.type),
      defauts: [...new Set(brutDefauts.map(lireDefaut).filter((d): d is Defaut => !!d))],
      description: texte(o.description, 200),
    };
    if (e.description || e.type || e.personnes) resultat.set(id, e);
  }
  return resultat;
}

/** Texte cherchable d'une photo étiquetée (recherche en langage naturel, sans appel) : toujours en français, comme la recherche. */
export function texteEtiquettes(e: Etiquettes): string {
  return [e.description, e.type ? LIBELLES_TYPES[e.type] : '', e.personnes ? LIBELLES_PERSONNES[e.personnes] : '', ...e.defauts.map((d) => LIBELLES_DEFAUTS[d])].filter(Boolean).join(' ; ');
}

// ---------------------------------------------------------------------------
// IA9 — appréciation (consigne de notation du script 03)
// ---------------------------------------------------------------------------

/** Consigne système du script 03 : critères de la famille, puis « JSON seulement ». */
export const SYSTEME_CRITERES = `${criteres}\n${suffixeJson}`;

/** Réglages du script 03 : lots de 6, photos à 1024 px. */
export const PARAMETRES_APPRECIATION = { parAppel: 6, cote: 1024 };

export interface Appreciation {
  /** Note indicative de 1 à 10 : sert à trier, jamais à cocher. */
  note: number;
  /** Le modèle la verrait en grande photo (★★). */
  pleinePage: boolean;
  justification: string;
}

/** Demandes d'appréciation : la consigne du script attend une liste, donc pas de format imposé. */
export function demandesAppreciation(photos: PhotoIA[], o: { contexte?: string } = {}, p = PARAMETRES_APPRECIATION): DemandeIA[] {
  return lots(photos, p.parAppel).map((lot) => {
    const d = { systeme: SYSTEME_CRITERES, consigne: consigneAppreciation + ligneContexte(o.contexte), images: photosNumerotees(lot, p.cote), rechercheWeb: 0 };
    return {
      fonction: 'IA9' as const,
      niveau: 'standard' as const,
      ...d,
      effort: 'medium' as const,
      maxTokens: 6000,
      ids: lot.map((x) => x.id),
      cle: cleDemande('IA9', lot, d),
      sortieEstimee: 900 + 60 * lot.length,
    };
  });
}

const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function lireBooleen(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return ['true', 'oui', 'yes', '1', 'vrai'].includes(simplifier(String(v ?? '')));
}

/** Appréciations lues ; une note illisible est ignorée (le script mettait 5 : ici, on n'invente rien). */
export function lireAppreciation(reponse: unknown, ids: string[]): Map<string, Appreciation> {
  const resultat = new Map<string, Appreciation>();
  for (const [id, o] of parPhoto(liste(reponse, 'photos', 'notes', 'appreciations'), ids)) {
    const note = nombre(o.note);
    if (!Number.isFinite(note)) continue;
    resultat.set(id, { note: Math.round(borner(note, 1, 10) * 10) / 10, pleinePage: lireBooleen(o.pleine_page), justification: texte(o.justification, 300) });
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// IA10 — meilleure de la pile (consigne « rafale/série » du script 03)
// ---------------------------------------------------------------------------

/** I5 : on ne départage jamais plus de 6 photos à la fois. */
export const MAX_PILE = 6;

export const SCHEMA_MEILLEURE = {
  type: 'object',
  properties: {
    meilleure: { type: 'integer' },
    notes: { type: 'array', items: { type: 'number' } },
    pleine_page: { type: 'boolean' },
    justification: { type: 'string' },
  },
  required: ['meilleure', 'notes', 'pleine_page', 'justification'],
  additionalProperties: false,
};

/**
 * Lots d'une pile : un seul si elle a 6 photos au plus ; sinon des lots
 * équilibrés, dont les gagnantes se départagent ensuite (`demandeMeilleure`
 * sur les gagnantes).
 */
export function lotsPile(photos: PhotoIA[], max = MAX_PILE): PhotoIA[][] {
  return lots(photos, max);
}

export function demandeMeilleure(photos: PhotoIA[], o: { contexte?: string } = {}, cote = PARAMETRES_APPRECIATION.cote): DemandeIA {
  const lot = photos.slice(0, MAX_PILE);
  const d = { systeme: SYSTEME_CRITERES, consigne: consigneMeilleure + ligneContexte(o.contexte), images: photosNumerotees(lot, cote), rechercheWeb: 0 };
  return {
    fonction: 'IA10',
    niveau: 'standard',
    ...d,
    schema: SCHEMA_MEILLEURE,
    effort: 'medium',
    maxTokens: 6000,
    ids: lot.map((x) => x.id),
    cle: cleDemande('IA10', lot, d),
    sortieEstimee: 1000,
  };
}

export interface Meilleure {
  id: string;
  /** Notes indicatives de chaque photo (celles qui sont lisibles). */
  notes: Map<string, number>;
  pleinePage: boolean;
  justification: string;
}

export function lireMeilleure(reponse: unknown, ids: string[]): Meilleure | null {
  const o = Array.isArray(reponse) ? reponse.find(estObjet) : reponse;
  if (!estObjet(o)) return null;
  const n = entier(o.meilleure);
  if (n < 1 || n > ids.length) return null;
  const notes = new Map<string, number>();
  if (Array.isArray(o.notes)) {
    o.notes.slice(0, ids.length).forEach((v, i) => {
      const x = nombre(v);
      if (Number.isFinite(x)) notes.set(ids[i], borner(x, 1, 10));
    });
  }
  return { id: ids[n - 1], notes, pleinePage: lireBooleen(o.pleine_page), justification: texte(o.justification, 300) };
}

// ---------------------------------------------------------------------------
// IA11 — contrôle de la sélection d'une sortie
// ---------------------------------------------------------------------------

export const PARAMETRES_CONTROLE = { parPlanche: 24, cellule: 240, colonnes: 6, maxRetenues: 48, maxAutres: 24 };

export type TypeRemarque = 'redondance' | 'manque' | 'faible' | 'autre';

export interface Remarque {
  type: TypeRemarque;
  /** Photos citées (retenues, ou non retenues pour un manque). */
  photos: string[];
  texte: string;
}

export const SCHEMA_CONTROLE = {
  type: 'object',
  properties: {
    remarques: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['redondance', 'manque', 'faible', 'autre'] },
          photos: { type: 'array', items: { type: 'integer' } },
          texte: { type: 'string' },
        },
        required: ['type', 'photos', 'texte'],
        additionalProperties: false,
      },
    },
  },
  required: ['remarques'],
  additionalProperties: false,
};

/**
 * Contrôle d'une sortie : planches « Sélection » (les retenues, 1 à k), puis
 * planches « Autres » (non retenues réparties dans le temps, k+1 à n) pour
 * repérer les moments manquants. `null` sans photo retenue.
 */
export function demandeControleSelection(retenues: PhotoIA[], autres: PhotoIA[], o: { sortie: string; contexte?: string }, p = PARAMETRES_CONTROLE): DemandeIA | null {
  if (!retenues.length) return null;
  const sel = repartis(retenues, p.maxRetenues);
  const aut = repartis(autres, p.maxAutres);
  const opt = { parPlanche: p.parPlanche, cellule: p.cellule, colonnes: p.colonnes };
  const images = [...planches(sel, 1, { ...opt, libelle: 'Sélection' }), ...planches(aut, sel.length + 1, { ...opt, libelle: 'Autres' })];
  const phraseAutres = aut.length ? remplir(consigneControleAutres, { debut: sel.length + 1, fin: sel.length + aut.length }) : '';
  const d = {
    systeme: SYSTEME_CRITERES,
    consigne: remplir(consigneControle, { sortie: o.sortie, k: sel.length, autres: phraseAutres }) + ligneContexte(o.contexte),
    images,
    rechercheWeb: 0,
  };
  const toutes = [...sel, ...aut];
  return {
    fonction: 'IA11',
    niveau: 'standard',
    ...d,
    schema: SCHEMA_CONTROLE,
    effort: 'medium',
    maxTokens: 8000,
    ids: toutes.map((x) => x.id),
    cle: cleDemande('IA11', toutes, d),
    sortieEstimee: 1500,
  };
}

const TYPES_REMARQUE: TypeRemarque[] = ['redondance', 'manque', 'faible', 'autre'];

/**
 * Remarques validées : texte obligatoire, numéros dans la plage ; une
 * redondance ou une photo faible ne cite que des photos retenues (les
 * `retenues` premiers numéros).
 */
export function lireControleSelection(reponse: unknown, ids: string[], retenues: number): Remarque[] {
  const resultat: Remarque[] = [];
  for (const o of liste(reponse, 'remarques').filter(estObjet)) {
    const t = simplifier(String(o.type ?? ''));
    const type = (TYPES_REMARQUE as string[]).includes(t) ? (t as TypeRemarque) : t.startsWith('redond') ? 'redondance' : t.startsWith('manq') ? 'manque' : 'autre';
    const nums = numeros(o.photos ?? o.numeros, ids.length).filter((n) => type === 'manque' || type === 'autre' || n <= retenues);
    const phrase = texte(o.texte ?? o.remarque, 300);
    if (!phrase) continue;
    resultat.push({ type, photos: nums.map((n) => ids[n - 1]), texte: phrase });
  }
  return resultat.slice(0, 10);
}
