// Dossier de sortie : chemin de chaque fichier, synchronisation relançable
// avec le plan (SPEC § 4.2, § 12) et bilan fichier par fichier (§ 6.11).

import type { EtatAlbum } from './album';
import { cleNom } from './noms';
import type { Langue } from './langue';
import { cheminDossier, type FichierPlan, type Plan, type RaisonMiseDeCote } from './plan';
import { aucunChangement, type ChangementsSource } from './source';

export const DOSSIER_PHOTOS = 'Photos';
export const DOSSIER_ETAT = '.album';
/** La sélection prête pour ifolor : copies dérivées, entièrement gérées par l'application. */
export const DOSSIER_ALBUM = 'Album';

/** Noms que l'application écrit dans la sortie (dossiers, fichiers) ; `Photos`, `Album` et `.album` sont les mêmes partout. */
export interface NomsSortie {
  misDeCote: string;
  autres: string;
  /** Sous-dossiers de `misDeCote`, par raison (`floues`, `doublons`…). */
  raisons: Record<RaisonMiseDeCote, string>;
  captures: string;
  sansDate: string;
  sansLieu: string;
  videosNonClassees: string;
  /** Préfixe des dossiers de voyage (`Voyage_<lieu>_<date>`). */
  voyage: string;
  /** Préfixe des lieux sans nom (`Lieu_03`). */
  lieu: string;
  lieuInconnu: string;
  rapport: string;
  textesAlbum: string;
  couverture: string;
  /** Nom proposé pour le domicile. */
  maison: string;
}

/** Dans la langue du projet, choisie à sa création (D60) : changer la langue de l'interface ne renomme rien. */
export const NOMS_SORTIE: Record<Langue, NomsSortie> = {
  fr: {
    misDeCote: '_mis_de_cote',
    autres: '_autres_fichiers',
    raisons: { floues: 'floues', doublons: 'doublons', doublons_exacts: 'doublons_exacts', autres: 'autres' },
    captures: 'Captures_ecran',
    sansDate: '_sans_date',
    sansLieu: 'Sans_lieu',
    videosNonClassees: '_videos_non_classees',
    voyage: 'Voyage',
    lieu: 'Lieu',
    lieuInconnu: 'Lieu_inconnu',
    rapport: 'Rapport.html',
    textesAlbum: 'textes_album.md',
    couverture: '0000_Couverture',
    maison: 'Maison',
  },
  en: {
    misDeCote: '_set_aside',
    autres: '_other_files',
    raisons: { floues: 'blurry', doublons: 'duplicates', doublons_exacts: 'exact_duplicates', autres: 'other' },
    captures: 'Screenshots',
    sansDate: '_no_date',
    sansLieu: 'No_place',
    videosNonClassees: '_unsorted_videos',
    voyage: 'Trip',
    lieu: 'Place',
    lieuInconnu: 'Unknown_place',
    rapport: 'Report.html',
    textesAlbum: 'album_texts.md',
    couverture: '0000_Cover',
    maison: 'Home',
  },
};

let langueSortie: Langue = 'fr';

/** Langue du projet ouvert (`fr` pour un projet d'avant D60). */
export function definirLangueSortie(l: Langue): void {
  langueSortie = l;
}

export function langueDeLaSortie(): Langue {
  return langueSortie;
}

export function nomsSortie(): NomsSortie {
  return NOMS_SORTIE[langueSortie];
}

/** Le nom est-il celui d'un dossier créé par l'application, dans l'une ou l'autre langue ? */
export function estNomDeSortie(cle: 'captures' | 'sansLieu' | 'sansDate', nom: string): boolean {
  return Object.values(NOMS_SORTIE).some((n) => n[cle] === nom);
}

/** Chemin d'un dossier de photos mises de côté pour cette raison (`_mis_de_cote/floues`). */
export function dossierMisDeCote(raison: string): string {
  const n = nomsSortie();
  return `${n.misDeCote}/${n.raisons[raison as RaisonMiseDeCote] ?? raison}`;
}

/** Chemin du fichier dans la sortie, relatif à sa racine. */
export function cheminSortie(plan: Plan, f: FichierPlan): string {
  if (f.categorie === 'autre') return `${nomsSortie().autres}/${f.id}`;
  // Chemin d'origine conservé (unique, et facile à remettre à la main).
  if (f.statut === 'mis_de_cote') return `${dossierMisDeCote(f.raison ?? 'autres')}/${f.id}`;
  const dossier = cheminDossier(plan, f.dossier);
  return `${DOSSIER_PHOTOS}/${dossier ? `${dossier}/` : ''}${f.nom}`;
}

/**
 * Ce que la synchronisation a écrit (`.album/etat_sortie.json`) : pour
 * retrouver un fichier qui a changé de dossier, et reconnaître les copies de
 * l'application, qu'elle remplace quand l'original a changé.
 */
export interface EtatSortie {
  version: 1;
  fichiers: Record<string, CopieSortie>;
  /** Copies écrites dans `Album/` (chemin relatif à `Album/`). */
  album?: EtatAlbum;
}

/** Une copie écrite par l'application : où, et la taille et la date de modification de l'original copié. */
export interface CopieSortie {
  chemin: string;
  taille: number;
  /** Absente dans un état écrit avant qu'elle soit notée : la taille seule compte alors. */
  modifie?: number;
}

export function etatVide(): EtatSortie {
  return { version: 1, fichiers: {} };
}

/** Fichiers présents dans la sortie (hors `.album/` et `Rapport.html`), par clé de chemin (voir `cleChemin`). */
export type ListingSortie = Map<string, { chemin: string; taille: number }>;

/** Clé de comparaison d'un chemin : insensible à la casse et aux formes d'accents. */
export function cleChemin(chemin: string): string {
  return cleNom(chemin);
}

/**
 * Copies de l'application encore en place, par clé de chemin : l'identifiant
 * du fichier copié. Une copie dont la taille a changé depuis (retouchée à la
 * main) n'est plus la sienne : elle ne sera jamais écrasée.
 */
function copiesEnPlace(listing: ListingSortie, etat: EtatSortie): Map<string, string> {
  const copies = new Map<string, string>();
  for (const [id, e] of Object.entries(etat.fichiers)) {
    const cle = cleChemin(e.chemin);
    if (listing.get(cle)?.taille === e.taille) copies.set(cle, id);
  }
  return copies;
}

/** La copie est-elle celle de la version du plan : même taille et, si elle est notée, même date de modification ? */
function copieAJour(e: CopieSortie, f: FichierPlan): boolean {
  return e.taille === f.taille && (e.modifie === undefined || e.modifie === f.modifie);
}

/** Ce que l'état note d'une copie gardée ou déplacée : la version du plan, qui est la sienne. */
export function copieDuPlan(f: FichierPlan, chemin: string): CopieSortie {
  return { chemin, taille: f.taille, modifie: f.modifie };
}

export type ActionSynchro =
  | { type: 'garder'; id: string; cible: string }
  /** `libere` : la place est prise par la copie d'un autre fichier, déplacée ailleurs juste avant. */
  | { type: 'copier'; id: string; cible: string; libere?: string }
  /**
   * L'original a changé depuis sa copie (nouvelle version) : la copie de
   * l'application est remplacée, après avoir été déplacée depuis `depuis` si
   * le fichier a aussi changé de dossier.
   */
  | { type: 'remplacer'; id: string; cible: string; depuis?: string }
  | { type: 'deplacer'; id: string; cible: string; depuis: string }
  /** La place est prise par un autre fichier, que l'on ne touche pas. */
  | { type: 'conflit'; id: string; cible: string };

/**
 * Actions qui amènent la sortie à l'état du plan : un fichier identique (même
 * taille, même date de modification) n'est jamais recopié (A13) ; un fichier
 * déjà écrit ailleurs est déplacé ; la copie d'une version plus ancienne est
 * remplacée. Un fichier que l'application n'a pas écrit n'est jamais écrasé,
 * et rien n'est supprimé.
 */
export function planifierSynchro(plan: Plan, listing: ListingSortie, etat: EtatSortie): ActionSynchro[] {
  const copies = copiesEnPlace(listing, etat);
  const actions: ActionSynchro[] = [];
  for (const f of plan.fichiers.values()) {
    const cible = cheminSortie(plan, f);
    const cle = cleChemin(cible);
    const present = listing.get(cle);
    const avant = etat.fichiers[f.id];
    const occupant = copies.get(cle);
    if (!present) {
      // Sa copie est restée à son ancienne place (le fichier a changé de dossier) : déplacée.
      const depuis = avant && copies.get(cleChemin(avant.chemin)) === f.id ? avant.chemin : undefined;
      if (!depuis) actions.push({ type: 'copier', id: f.id, cible });
      else actions.push({ type: copieAJour(avant, f) ? 'deplacer' : 'remplacer', id: f.id, cible, depuis });
    } else if (occupant === f.id) actions.push({ type: copieAJour(avant, f) ? 'garder' : 'remplacer', id: f.id, cible });
    else if (occupant !== undefined) actions.push({ type: 'copier', id: f.id, cible, libere: occupant });
    // Un fichier que l'application n'a pas noté (sortie écrite sans état) : gardé s'il a la même taille.
    else actions.push({ type: present.taille === f.taille ? 'garder' : 'conflit', id: f.id, cible });
  }
  // La place prise par la copie d'un autre fichier n'est libérée que si cette copie part ailleurs.
  const departs = new Set(actions.flatMap((a) => ((a.type === 'deplacer' || a.type === 'remplacer') && a.depuis ? [`${a.id}|${cleChemin(a.depuis)}`] : [])));
  return actions.map((a) => (a.type === 'copier' && a.libere && !departs.has(`${a.libere}|${cleChemin(a.cible)}`) ? { type: 'conflit', id: a.id, cible: a.cible } : a));
}

export interface Bilan {
  total: number;
  presents: number;
  manquants: { id: string; cible: string }[];
  categories: { photos: number; videos: number; autres: number; misDeCote: Record<string, number> };
  octets: number;
  /** Fichiers dont la seule date est celle du fichier, perdue à la copie (D30). */
  datesFichierSeulement: FichierPlan[];
  /** Fichiers de la sortie qui ne correspondent à aucun fichier du plan (jamais supprimés). */
  enTrop: string[];
}

/**
 * Chaque fichier du projet se retrouve-t-il dans la sortie, dans sa version ?
 * (A2) Même taille et, pour une copie notée par l'application, même date de
 * modification de l'original : la copie d'une version plus ancienne, ou celle
 * d'un autre fichier, ne compte pas.
 */
export function bilan(plan: Plan, listing: ListingSortie, etat: EtatSortie): Bilan {
  const b: Bilan = {
    total: 0,
    presents: 0,
    manquants: [],
    categories: { photos: 0, videos: 0, autres: 0, misDeCote: {} },
    octets: 0,
    datesFichierSeulement: [],
    enTrop: [],
  };
  const copies = copiesEnPlace(listing, etat);
  const attendus = new Set<string>();
  for (const f of plan.fichiers.values()) {
    b.total++;
    b.octets += f.taille;
    const cible = cheminSortie(plan, f);
    const cle = cleChemin(cible);
    attendus.add(cle);
    const occupant = copies.get(cle);
    const aJour = occupant === undefined || (occupant === f.id && copieAJour(etat.fichiers[f.id], f));
    if (listing.get(cle)?.taille === f.taille && aJour) b.presents++;
    else b.manquants.push({ id: f.id, cible });
    if (f.categorie === 'autre') b.categories.autres++;
    else if (f.statut === 'mis_de_cote') b.categories.misDeCote[f.raison ?? 'autres'] = (b.categories.misDeCote[f.raison ?? 'autres'] ?? 0) + 1;
    else if (f.categorie === 'photo') b.categories.photos++;
    else b.categories.videos++;
    if (f.origineDate === 'fichier' && f.categorie !== 'autre') b.datesFichierSeulement.push(f);
  }
  // `Album/` contient des copies : il n'entre pas dans le bilan de la source.
  const album = cleChemin(`${DOSSIER_ALBUM}/`);
  for (const [cle, e] of listing) if (!attendus.has(cle) && !cle.startsWith(album)) b.enTrop.push(e.chemin);
  b.enTrop.sort();
  return b;
}

/** Le dossier à trier relu après l'écriture (D63) : son nombre de fichiers, et s'il contient exactement ceux du projet. */
export interface SourceRelue {
  fichiers: number;
  commeLeProjet: boolean;
}

export function sourceRelue(plan: Plan, c: ChangementsSource): SourceRelue {
  return { fichiers: plan.fichiers.size - c.disparus.length + c.nouveaux.length, commeLeProjet: aucunChangement(c) };
}

/** Espace nécessaire pour ce qui reste à copier (une nouvelle version remplace l'ancienne copie). */
export function octetsACopier(plan: Plan, actions: ActionSynchro[]): number {
  let total = 0;
  for (const a of actions) if (a.type === 'copier' || a.type === 'remplacer') total += plan.fichiers.get(a.id)?.taille ?? 0;
  return total;
}
