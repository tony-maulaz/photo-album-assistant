// Plan du projet : toutes les décisions (dossiers, destination de chaque
// fichier, éléments mis de côté), sans jamais toucher aux fichiers (SPEC § 4.2).
// Les objets du plan ne sont jamais modifiés sur place : chaque opération les
// remplace, ce qui rend l'annulation (Ctrl+Z) simple et sûre.

import { normaliser, recadrageUtile, tournerRecadrage, type Recadrage } from './recadrage';
import { pluriel } from '../ui/format';
import type { Categorie } from './fichiers';
import { aTraduire, t } from './langue';
import { cleNom, nomLibre, verifierNomDossier } from './noms';

/** Dossier racine : `Photos/` dans la sortie. */
export const RACINE = 'racine';

export type RaisonMiseDeCote = 'floues' | 'doublons' | 'doublons_exacts' | 'autres';
export type OrigineDate = 'exif' | 'nom' | 'video' | 'fichier';

export interface DossierPlan {
  id: string;
  nom: string;
  /** `null` pour la racine seulement. */
  parent: string | null;
  /** Sous-dossier de la source, créé à la main, ou proposé par le tri par lieux (étape « Tri automatique »). */
  origine: 'source' | 'cree' | 'tri';
  /** Sous-dossier de la source (étape « Dossiers ») : à trier, gardé et nettoyé, ou laissé tel quel. */
  traitement?: TraitementDossier;
  /** Comment le tri par lieux a formé ce dossier (étape « Tri automatique »). */
  tri?: InfoTri;
  /**
   * Nom tel que l'utilisateur l'a tapé, quand le nom du dossier en a été tiré
   * sans accents ni espaces (étape « Nommage ») : « Plage à Ko Samui 18.07.26 »
   * pour « Plage_a_Ko_Samui_18.07.26 ». Sert au titre de section de l'album.
   */
  nomSaisi?: string;
}

/**
 * Que faire d'un sous-dossier de la source (étape « Dossiers », D61) :
 * - `trier` : ses photos rejoignent le tri par lieux et sorties ;
 * - `nettoyer` : le dossier garde sa place, mais ses floues et ses doublons sont proposés ;
 * - `garder` : « Ne pas toucher », recopié tel quel : ni floues, ni doublons, ni copies proposés (D85) ;
 * - `ignorer` : ancienne valeur (« hors de l'album »), traitée comme `garder`.
 */
export type TraitementDossier = 'trier' | 'nettoyer' | 'garder' | 'ignorer';

export interface InfoTri {
  origine: 'lieu_connu' | 'gps' | 'voyage' | 'etape' | 'sans_lieu';
  /** Nom du lieu (lieu connu, ou géocodage du groupe GPS). */
  lieu?: string;
  lat?: number;
  lon?: number;
  /** Nom donné par le tri : tant que le dossier le porte, son nom est automatique (étape « Nommage »). */
  nom?: string;
}

export interface FichierPlan {
  /** Chemin relatif dans la source (avec « / ») : identité stable du fichier. */
  id: string;
  /** Nom dans la sortie (peut différer de l'original en cas de collision). */
  nom: string;
  taille: number;
  /** Date de modification d'origine en ms : la copie ne la conserve pas (D30). */
  modifie: number;
  categorie: Categorie;
  /** Prise de vue retenue, heure locale : « AAAA-MM-JJTHH:MM:SS » ou « AAAA-MM-JJ ». */
  date?: string;
  origineDate?: OrigineDate;
  /** Dossier de destination des photos et vidéos (aussi pour les remettre). */
  dossier: string;
  statut: 'archive' | 'mis_de_cote';
  raison?: RaisonMiseDeCote;
  /** Appareil (modèle EXIF). */
  appareil?: string;
  /** Marque de l'appareil (EXIF) : son absence aide à reconnaître une capture d'écran. */
  marque?: string;
  /** Position (EXIF des photos, ©xyz des vidéos). */
  gps?: { lat: number; lon: number };
  /** Dimensions stockées dans le fichier (avant orientation EXIF). */
  dims?: { l: number; h: number };
  /** Capture d'écran (étape 2) : rangée dans `Captures_ecran/`, exclue de l'album. */
  capture?: boolean;
  /** Empreinte SHA-256 du contenu, calculée seulement pour les candidats aux doublons exacts. */
  empreinte?: string;
  /** Décalage d'horloge de l'appareil déjà appliqué à `date` (« +HH:MM », étape 2). */
  decalage?: string;
  /** Étape 3 : écartée par le seuil de netteté (« auto »), sauvée ou écartée à la main. */
  flou?: 'auto' | 'sauvee' | 'ecartee';
  /** Choix pour l'album (étape « Sélection ») : 0 = pas dans l'album, 1 = ★, 2 = ★★ grande photo ; absent = à décider. */
  album?: 0 | 1 | 2;
  /** Rotation à appliquer à la copie dans Album/ (degrés, sens horaire). */
  rotation?: Rotation;
  /** Recadrage de la copie dans Album/ (étape « Sélection », D62), après la rotation. */
  recadrage?: Recadrage;
  /** Ajouté par une mise à jour de l'inventaire (date ISO, D63) : arrivé dans la source après le premier tri. */
  ajout?: string;
  /** Légende de la photo dans l'album (étape « Album »). */
  legende?: string;
  /** Doublon écarté à l'étape « Doublons » : la photo gardée à sa place, et pourquoi. */
  doublon?: InfoDoublon;
  /** Gardée volontairement à l'étape « Doublons » : jamais reproposée comme doublon (I10). */
  protegee?: boolean;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface InfoDoublon {
  /** Identifiant de la photo gardée à la place. */
  garde: string;
  source: 'rafale' | 'ia';
  raison?: string;
  description?: string;
  descriptionGardee?: string;
}

export interface Plan {
  dossiers: Map<string, DossierPlan>;
  fichiers: Map<string, FichierPlan>;
  prochainId: number;
}

export class ErreurPlan extends Error {}

export function planVide(): Plan {
  const racine: DossierPlan = { id: RACINE, nom: 'Photos', parent: null, origine: 'source' };
  return { dossiers: new Map([[RACINE, racine]]), fichiers: new Map(), prochainId: 1 };
}

// ---------------------------------------------------------------------------
// Enregistrement JSON (.album/plan.json)
// ---------------------------------------------------------------------------

export interface PlanJson {
  version: 1;
  prochainId: number;
  dossiers: DossierPlan[];
  fichiers: FichierPlan[];
}

export function versJson(plan: Plan): PlanJson {
  return { version: 1, prochainId: plan.prochainId, dossiers: [...plan.dossiers.values()], fichiers: [...plan.fichiers.values()] };
}

export function depuisJson(j: PlanJson): Plan {
  if (j?.version !== 1 || !Array.isArray(j.dossiers) || !Array.isArray(j.fichiers)) throw new ErreurPlan(t`plan.json illisible ou d’une version inconnue.`);
  const plan: Plan = { dossiers: new Map(j.dossiers.map((d) => [d.id, d])), fichiers: new Map(j.fichiers.map((f) => [f.id, f])), prochainId: j.prochainId };
  if (!plan.dossiers.has(RACINE)) throw new ErreurPlan(t`plan.json sans dossier racine.`);
  return plan;
}

// ---------------------------------------------------------------------------
// Lecture du plan
// ---------------------------------------------------------------------------

/** Chemin d'un dossier depuis `Photos/` (« » pour la racine). */
export function cheminDossier(plan: Plan, id: string): string {
  const noms: string[] = [];
  let d = plan.dossiers.get(id);
  while (d && d.parent !== null) {
    noms.unshift(d.nom);
    d = plan.dossiers.get(d.parent);
  }
  return noms.join('/');
}

/** Dossier de la source où est le fichier (« » pour la racine), quel que soit celui où le plan le range. */
export function dossierSource(f: FichierPlan): string {
  const i = f.id.lastIndexOf('/');
  return i < 0 ? '' : f.id.slice(0, i);
}

/** Ordre des noms de dossiers, comme l'explorateur : sans accents ni majuscules, « 2 » avant « 10 ». */
export const comparerNoms = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare;

export function enfants(plan: Plan, id: string): DossierPlan[] {
  return [...plan.dossiers.values()].filter((d) => d.parent === id).sort((a, b) => comparerNoms(a.nom, b.nom));
}

export function estDescendant(plan: Plan, id: string, ancetre: string): boolean {
  let d = plan.dossiers.get(id);
  while (d && d.parent !== null) {
    if (d.parent === ancetre) return true;
    d = plan.dossiers.get(d.parent);
  }
  return false;
}

/** Photos et vidéos rangées dans un dossier, par date puis par nom. */
export function contenu(plan: Plan, id: string): FichierPlan[] {
  return [...plan.fichiers.values()]
    .filter((f) => f.statut === 'archive' && f.categorie !== 'autre' && f.dossier === id)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || comparerNoms(a.nom, b.nom));
}

export interface ResumeDossier {
  photos: number;
  videos: number;
  octets: number;
  du?: string;
  au?: string;
  /** Totaux en comptant les sous-dossiers. */
  photosTotal: number;
  videosTotal: number;
  duTotal?: string;
  auTotal?: string;
}

/**
 * Date de prise de vue sur laquelle compter pour une période : pas celle du
 * fichier (photo sans date), souvent celle d'une copie, qui étirerait par
 * exemple « Belgique » du 24.07.25 au jour de la copie.
 */
export function dateSure(f: { date?: string; origineDate?: OrigineDate }): string | undefined {
  return f.origineDate === 'fichier' ? undefined : f.date;
}

/** Premier et dernier jour (« AAAA-MM-JJ ») des dates sûres d'une liste de photos et vidéos. */
export function periodeDe(fichiers: Iterable<{ date?: string; origineDate?: OrigineDate }>): { du?: string; au?: string } {
  let du: string | undefined;
  let au: string | undefined;
  for (const f of fichiers) {
    const jour = dateSure(f)?.slice(0, 10);
    if (!jour) continue;
    if (!du || jour < du) du = jour;
    if (!au || jour > au) au = jour;
  }
  return { du, au };
}

/** Nombres et dates (du–au, dates sûres seulement) de chaque dossier, mis à jour en direct dans le panneau. */
export function resumes(plan: Plan): Map<string, ResumeDossier> {
  const r = new Map<string, ResumeDossier>();
  for (const id of plan.dossiers.keys()) r.set(id, { photos: 0, videos: 0, octets: 0, photosTotal: 0, videosTotal: 0 });
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre') continue;
    const s = r.get(f.dossier);
    if (!s) continue;
    if (f.categorie === 'photo') s.photos++;
    else s.videos++;
    s.octets += f.taille;
    const jour = dateSure(f)?.slice(0, 10);
    if (jour) {
      if (!s.du || jour < s.du) s.du = jour;
      if (!s.au || jour > s.au) s.au = jour;
    }
  }
  // Totaux : chaque dossier ajoute ses nombres à tous ses ancêtres.
  for (const [id, s] of r) {
    let d = plan.dossiers.get(id);
    while (d) {
      const t = r.get(d.id)!;
      t.photosTotal += s.photos;
      t.videosTotal += s.videos;
      if (s.du && (!t.duTotal || s.du < t.duTotal)) t.duTotal = s.du;
      if (s.au && (!t.auTotal || s.au > t.auTotal)) t.auTotal = s.au;
      d = d.parent === null ? undefined : plan.dossiers.get(d.parent);
    }
  }
  return r;
}

function nomsPris(plan: Plan, dossier: string, sauf: Set<string>): Set<string> {
  const pris = new Set<string>();
  for (const f of plan.fichiers.values()) {
    if (f.statut === 'archive' && f.categorie !== 'autre' && f.dossier === dossier && !sauf.has(f.id)) pris.add(cleNom(f.nom));
  }
  return pris;
}

// ---------------------------------------------------------------------------
// Modifications annulables
// ---------------------------------------------------------------------------

type Etat<T> = [string, T | null][];

export interface Modification {
  libelle: string;
  avant: { dossiers: Etat<DossierPlan>; fichiers: Etat<FichierPlan>; prochainId: number };
  apres: { dossiers: Etat<DossierPlan>; fichiers: Etat<FichierPlan>; prochainId: number };
}

/** Note la valeur précédente de chaque élément touché, pour pouvoir l'annuler. */
/** Groupe de changements annulable d'un coup (les opérations du plan s'en servent). */
export class Transaction {
  private avantD = new Map<string, DossierPlan | null>();
  private avantF = new Map<string, FichierPlan | null>();
  private prochainIdAvant: number;

  constructor(private plan: Plan) {
    this.prochainIdAvant = plan.prochainId;
  }

  fichier(f: FichierPlan) {
    if (!this.avantF.has(f.id)) this.avantF.set(f.id, this.plan.fichiers.get(f.id) ?? null);
    this.plan.fichiers.set(f.id, f);
  }

  dossier(d: DossierPlan) {
    if (!this.avantD.has(d.id)) this.avantD.set(d.id, this.plan.dossiers.get(d.id) ?? null);
    this.plan.dossiers.set(d.id, d);
  }

  supprimerDossier(id: string) {
    if (!this.avantD.has(id)) this.avantD.set(id, this.plan.dossiers.get(id) ?? null);
    this.plan.dossiers.delete(id);
  }

  /** Retire un fichier du plan (disparu de la source avant d'avoir été copié). */
  supprimerFichier(id: string) {
    if (!this.avantF.has(id)) this.avantF.set(id, this.plan.fichiers.get(id) ?? null);
    this.plan.fichiers.delete(id);
  }

  terminer(libelle: string): Modification | null {
    if (!this.avantD.size && !this.avantF.size) return null;
    return {
      libelle,
      avant: { dossiers: [...this.avantD], fichiers: [...this.avantF], prochainId: this.prochainIdAvant },
      apres: {
        dossiers: [...this.avantD.keys()].map((id) => [id, this.plan.dossiers.get(id) ?? null]),
        fichiers: [...this.avantF.keys()].map((id) => [id, this.plan.fichiers.get(id) ?? null]),
        prochainId: this.plan.prochainId,
      },
    };
  }
}

function appliquer(plan: Plan, etat: Modification['avant']) {
  for (const [id, d] of etat.dossiers) {
    if (d) plan.dossiers.set(id, d);
    else plan.dossiers.delete(id);
  }
  for (const [id, f] of etat.fichiers) {
    if (f) plan.fichiers.set(id, f);
    else plan.fichiers.delete(id);
  }
  plan.prochainId = etat.prochainId;
}

/** Pile d'annulation (Ctrl+Z) et de rétablissement (Ctrl+Y). */
export class Historique {
  private passe: Modification[] = [];
  private futur: Modification[] = [];
  constructor(private limite = 200) {}

  enregistrer(m: Modification | null) {
    if (!m) return;
    this.passe.push(m);
    if (this.passe.length > this.limite) this.passe.shift();
    this.futur = [];
  }

  annuler(plan: Plan): Modification | null {
    const m = this.passe.pop();
    if (!m) return null;
    appliquer(plan, m.avant);
    this.futur.push(m);
    return m;
  }

  retablir(plan: Plan): Modification | null {
    const m = this.futur.pop();
    if (!m) return null;
    appliquer(plan, m.apres);
    this.passe.push(m);
    return m;
  }

  get peutAnnuler() {
    return this.passe.length > 0;
  }
  get peutRetablir() {
    return this.futur.length > 0;
  }
  get prochaineAnnulation(): string | undefined {
    return this.passe.at(-1)?.libelle;
  }
}

function dossierExistant(plan: Plan, id: string): DossierPlan {
  const d = plan.dossiers.get(id);
  if (!d) throw new ErreurPlan(t`Ce dossier n’existe plus.`);
  return d;
}

/** Range des fichiers dans `tx`, avec un nom libre dans le dossier cible. */
function ranger(plan: Plan, tx: Transaction, ids: string[], cible: string) {
  const deplaces = new Set(ids);
  const pris = nomsPris(plan, cible, deplaces);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.categorie === 'autre') continue;
    if (f.statut === 'archive' && f.dossier === cible) {
      pris.add(cleNom(f.nom));
      continue;
    }
    const nom = nomLibre(f.nom, pris);
    pris.add(cleNom(nom));
    tx.fichier({ ...f, dossier: cible, statut: 'archive', raison: undefined, nom });
  }
}

/** Déplace des photos ou vidéos vers un dossier (et les remet si elles étaient mises de côté). */
export function deplacerFichiers(plan: Plan, ids: string[], cible: string): Modification | null {
  const d = dossierExistant(plan, cible);
  const tx = new Transaction(plan);
  ranger(plan, tx, ids, cible);
  return tx.terminer(t`Déplacer ${pluriel(ids.length, 'élément')} vers « ${d.nom} »`);
}

export function mettreDeCote(plan: Plan, ids: string[], raison: RaisonMiseDeCote = 'autres'): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (f && f.categorie !== 'autre' && f.statut !== 'mis_de_cote') tx.fichier({ ...f, statut: 'mis_de_cote', raison });
  }
  return tx.terminer(t`Mettre de côté ${pluriel(ids.length, 'élément')}`);
}

/** Remet des éléments mis de côté dans leur dossier d'origine (ou la racine s'il a disparu). */
export function remettre(plan: Plan, ids: string[]): Modification | null {
  const tx = new Transaction(plan);
  const parDossier = new Map<string, string[]>();
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.statut !== 'mis_de_cote') continue;
    const d = plan.dossiers.has(f.dossier) ? f.dossier : RACINE;
    parDossier.set(d, [...(parDossier.get(d) ?? []), id]);
  }
  for (const [d, liste] of parDossier) ranger(plan, tx, liste, d);
  return tx.terminer(t`Remettre ${pluriel(ids.length, 'élément')}`);
}

function verifierFrere(plan: Plan, parent: string, nom: string, sauf?: string) {
  const cle = cleNom(nom);
  const existant = [...plan.dossiers.values()].find((d) => d.parent === parent && d.id !== sauf && cleNom(d.nom) === cle);
  if (existant) throw new ErreurPlan(t`Un dossier « ${existant.nom} » existe déjà à cet endroit.`);
}

export function creerDossier(plan: Plan, nom: string, parent = RACINE): { id: string; modification: Modification } {
  const propre = nom.trim();
  const erreur = verifierNomDossier(propre);
  if (erreur) throw new ErreurPlan(erreur);
  dossierExistant(plan, parent);
  verifierFrere(plan, parent, propre);
  const tx = new Transaction(plan);
  const id = `n${plan.prochainId++}`;
  tx.dossier({ id, nom: propre, parent, origine: 'cree' });
  return { id, modification: tx.terminer(t`Créer le dossier « ${propre} »`)! };
}

/**
 * Renomme un dossier. `saisi` : le texte tapé, quand `nom` en a été tiré sans
 * accents ni espaces ; il est gardé (`nomSaisi`) pour le titre de section de
 * l'album. Un autre nom, tapé directement, l'oublie.
 */
export function renommerDossier(plan: Plan, id: string, nom: string, saisi?: string): Modification | null {
  const d = dossierExistant(plan, id);
  if (d.parent === null) throw new ErreurPlan(t`Le dossier Photos ne peut pas être renommé.`);
  const propre = nom.trim();
  const texte = saisi?.trim() && saisi.trim() !== propre ? saisi.trim() : undefined;
  if (propre === d.nom && texte === d.nomSaisi) return null;
  const erreur = verifierNomDossier(propre);
  if (erreur) throw new ErreurPlan(erreur);
  verifierFrere(plan, d.parent, propre, id);
  const tx = new Transaction(plan);
  const { nomSaisi: _ancien, ...reste } = d;
  tx.dossier({ ...reste, nom: propre, ...(texte ? { nomSaisi: texte } : {}) });
  return tx.terminer(t`Renommer « ${d.nom} » en « ${propre} »`);
}

/**
 * Fusionne `source` dans `cible` : ses photos, vidéos et sous-dossiers
 * passent dans `cible` (les sous-dossiers de même nom fusionnent à leur
 * tour), puis `source` disparaît.
 */
export function fusionnerDossiers(plan: Plan, source: string, cible: string): Modification | null {
  const s = dossierExistant(plan, source);
  const c = dossierExistant(plan, cible);
  if (s.parent === null) throw new ErreurPlan(t`Le dossier Photos ne peut pas être fusionné dans un autre.`);
  if (source === cible) return null;
  if (estDescendant(plan, cible, source)) throw new ErreurPlan(t`Impossible de fusionner un dossier dans un de ses sous-dossiers.`);
  const tx = new Transaction(plan);
  const fusionner = (de: string, vers: string) => {
    const archives: string[] = [];
    for (const f of plan.fichiers.values()) {
      if (f.dossier !== de) continue;
      if (f.statut === 'archive') archives.push(f.id);
      else tx.fichier({ ...f, dossier: vers });
    }
    ranger(plan, tx, archives, vers);
    for (const e of enfants(plan, de)) {
      const homonyme = enfants(plan, vers).find((x) => cleNom(x.nom) === cleNom(e.nom));
      if (homonyme) fusionner(e.id, homonyme.id);
      else tx.dossier({ ...e, parent: vers });
    }
    tx.supprimerDossier(de);
  };
  fusionner(source, cible);
  return tx.terminer(t`Fusionner « ${s.nom} » dans « ${c.nom} »`);
}

/** Déplace un dossier (avec son contenu) dans `parent` ; refusé si un frère porte déjà son nom. */
export function deplacerDossier(plan: Plan, id: string, parent: string): Modification | null {
  const d = dossierExistant(plan, id);
  const p = dossierExistant(plan, parent);
  if (d.parent === null) throw new ErreurPlan(t`Le dossier Photos ne peut pas être déplacé.`);
  if (d.parent === parent) return null;
  if (id === parent || estDescendant(plan, parent, id)) throw new ErreurPlan(t`Impossible de mettre un dossier dans un de ses sous-dossiers.`);
  verifierFrere(plan, parent, d.nom, id);
  const tx = new Transaction(plan);
  tx.dossier({ ...d, parent });
  return tx.terminer(t`Mettre « ${d.nom} » dans « ${p.nom} »`);
}

/** Supprime un dossier vide (sans fichier, même mis de côté, ni sous-dossier). */
export function supprimerDossierVide(plan: Plan, id: string): Modification | null {
  const d = dossierExistant(plan, id);
  if (d.parent === null) throw new ErreurPlan(t`Le dossier Photos ne peut pas être supprimé.`);
  if (enfants(plan, id).length) throw new ErreurPlan(t`Ce dossier contient des sous-dossiers.`);
  if ([...plan.fichiers.values()].some((f) => f.dossier === id && f.categorie !== 'autre')) throw new ErreurPlan(t`Ce dossier n’est pas vide.`);
  const tx = new Transaction(plan);
  tx.supprimerDossier(id);
  return tx.terminer(t`Supprimer le dossier vide « ${d.nom} »`);
}

/**
 * Enchaîne des opérations en une seule modification annulable ; si l'une
 * échoue, celles déjà faites sont défaites avant de rendre l'erreur (le plan
 * n'est jamais laissé à moitié modifié).
 */
export function enchainer(plan: Plan, libelle: string, etapes: (() => Modification | null)[]): Modification | null {
  const faites: Modification[] = [];
  try {
    for (const e of etapes) {
      const m = e();
      if (m) faites.push(m);
    }
  } catch (err) {
    const h = new Historique();
    for (const m of faites) h.enregistrer(m);
    while (h.annuler(plan));
    throw err;
  }
  return combiner(libelle, ...faites);
}

/** Réunit des modifications successives en une seule (un seul Ctrl+Z). */
export function combiner(libelle: string, ...modifications: (Modification | null)[]): Modification | null {
  const liste = modifications.filter((m): m is Modification => !!m);
  if (!liste.length) return null;
  const avantD = new Map<string, DossierPlan | null>();
  const avantF = new Map<string, FichierPlan | null>();
  const apresD = new Map<string, DossierPlan | null>();
  const apresF = new Map<string, FichierPlan | null>();
  for (const m of liste) {
    for (const [id, d] of m.avant.dossiers) if (!avantD.has(id)) avantD.set(id, d);
    for (const [id, f] of m.avant.fichiers) if (!avantF.has(id)) avantF.set(id, f);
    for (const [id, d] of m.apres.dossiers) apresD.set(id, d);
    for (const [id, f] of m.apres.fichiers) apresF.set(id, f);
  }
  return {
    libelle,
    avant: { dossiers: [...avantD], fichiers: [...avantF], prochainId: liste[0].avant.prochainId },
    apres: { dossiers: [...apresD], fichiers: [...apresF], prochainId: liste.at(-1)!.apres.prochainId },
  };
}

/** Traitement effectif d'un dossier : le sien, ou celui du parent le plus proche qui en a un (`ignorer` vaut `garder`). */
export function traitementDe(plan: Plan, dossier: string): TraitementDossier | undefined {
  for (let d = plan.dossiers.get(dossier); d; d = d.parent ? plan.dossiers.get(d.parent) : undefined) if (d.traitement) return d.traitement === 'ignorer' ? 'garder' : d.traitement;
  return undefined;
}

/** Dossier qui garde sa place (« Garder, nettoyer » ou « Ne pas toucher ») : le tri automatique ne le défait pas. */
export function gardeSaPlace(plan: Plan, dossier: string): boolean {
  const tr = traitementDe(plan, dossier);
  return tr === 'nettoyer' || tr === 'garder';
}

/** Dossier « Ne pas toucher » : ni floues, ni doublons, ni copies exactes proposés (D85). */
export function nePasToucher(plan: Plan, dossier: string): boolean {
  return traitementDe(plan, dossier) === 'garder';
}

/** Traitement d'un sous-dossier de la source (étape « Dossiers ») : à trier, gardé et nettoyé, ou laissé tel quel. */
export function changerTraitement(plan: Plan, ids: string[], traitement: TraitementDossier): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const d = plan.dossiers.get(id);
    if (d && d.parent !== null && d.traitement !== traitement) tx.dossier({ ...d, traitement });
  }
  const libelles = { trier: aTraduire('À trier'), nettoyer: aTraduire('Garder et nettoyer'), garder: aTraduire('Ne pas toucher'), ignorer: aTraduire('Ne pas toucher') } as const;
  return tx.terminer(`${t(libelles[traitement])} (${pluriel(ids.length, 'dossier')})`);
}

// ---------------------------------------------------------------------------
// Sélection, album et doublons (phase 2)
// ---------------------------------------------------------------------------

/** Choix pour l'album : 1 = ★, 2 = ★★, 0 = non, `undefined` = à décider (étape « Sélection »). */
export function noterAlbum(plan: Plan, ids: string[], valeur: 0 | 1 | 2 | undefined): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.categorie === 'autre' || f.album === valeur) continue;
    const { album: _ancien, ...reste } = f;
    tx.fichier(valeur === undefined ? reste : { ...reste, album: valeur });
  }
  const libelle = valeur === undefined ? t`Remettre à décider` : valeur === 0 ? t`Pas dans l’album` : valeur === 1 ? t`Dans l’album ★` : t`Grande photo ★★`;
  return tx.terminer(`${libelle} (${ids.length})`);
}

/**
 * Tourne d'un quart de tour (sens horaire si `sens` = 90) ; appliqué à la copie
 * dans Album/. Un recadrage déjà fait tourne avec la photo : il garde la même
 * partie de l'image (il est en fractions de l'image tournée).
 */
export function tourner(plan: Plan, ids: string[], sens: 90 | -90): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.categorie !== 'photo') continue;
    const r = (((f.rotation ?? 0) + sens + 360) % 360) as Rotation;
    const { rotation: _ancienne, recadrage, ...reste } = f;
    tx.fichier({ ...reste, ...(r ? { rotation: r } : {}), ...(recadrage ? { recadrage: tournerRecadrage(recadrage, sens) } : {}) });
  }
  return tx.terminer(t`Tourner ${pluriel(ids.length, 'photo')}`);
}

/** Recadre la copie de la photo dans Album/ (D62) ; `undefined` ou un recadrage qui ne coupe rien l'enlève. */
export function recadrer(plan: Plan, id: string, recadrage: Recadrage | undefined): Modification | null {
  const f = plan.fichiers.get(id);
  if (!f || f.categorie !== 'photo') return null;
  const { recadrage: _ancien, ...reste } = f;
  const tx = new Transaction(plan);
  tx.fichier(recadrageUtile(recadrage) ? { ...reste, recadrage: normaliser(recadrage) } : reste);
  return tx.terminer(recadrageUtile(recadrage) ? t`Recadrer ${f.nom}` : t`Enlever le recadrage de ${f.nom}`);
}

export function changerLegende(plan: Plan, id: string, legende: string): Modification | null {
  const f = plan.fichiers.get(id);
  const propre = legende.trim();
  if (!f || (f.legende ?? '') === propre) return null;
  const tx = new Transaction(plan);
  const { legende: _ancienne, ...reste } = f;
  tx.fichier(propre ? { ...reste, legende: propre } : reste);
  return tx.terminer(t`Changer la légende`);
}

/**
 * Écarte des photos à l'étape « Doublons » (D71) : mises de côté avec leur
 * raison et, pour un doublon, la photo gardée à sa place. Une photo gardée
 * volontairement peut l'être aussi : c'est l'utilisateur qui change d'avis.
 */
export function ecarterDoublons(plan: Plan, decisions: { id: string; raison: 'doublons' | 'doublons_exacts'; doublon?: InfoDoublon }[]): Modification | null {
  const tx = new Transaction(plan);
  let n = 0;
  for (const d of decisions) {
    const f = plan.fichiers.get(d.id);
    if (!f || f.categorie !== 'photo' || f.statut !== 'archive') continue;
    const { protegee: _p, doublon: _d, ...reste } = f;
    tx.fichier(d.doublon ? { ...reste, statut: 'mis_de_cote', raison: d.raison, doublon: d.doublon } : { ...reste, statut: 'mis_de_cote', raison: d.raison });
    n++;
  }
  return tx.terminer(t`Écarter ${pluriel(n, 'photo')}`);
}

/** « Garder aussi » : le doublon revient dans son dossier et ne sera plus jamais proposé (I10). */
export function garderAussi(plan: Plan, ids: string[]): Modification | null {
  const tx = new Transaction(plan);
  const aRanger: string[] = [];
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f) continue;
    const { doublon: _d, ...reste } = f;
    tx.fichier({ ...reste, protegee: true });
    if (f.statut === 'mis_de_cote') aRanger.push(id);
  }
  const parDossier = new Map<string, string[]>();
  for (const id of aRanger) {
    const f = plan.fichiers.get(id)!;
    const d = plan.dossiers.has(f.dossier) ? f.dossier : RACINE;
    parDossier.set(d, [...(parDossier.get(d) ?? []), id]);
  }
  for (const [d, liste] of parDossier) ranger(plan, tx, liste, d);
  return tx.terminer(t`Garder ${pluriel(ids.length, 'photo')}`);
}
