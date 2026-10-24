// État du projet dans le dossier de sortie (`.album/`, SPEC § 12) et liste des
// projets récents de cet ordinateur (IndexedDB).

import { aTraduire, t } from '../lib/langue';
import { DOSSIER_ETAT } from '../lib/sortie';
import { ecrireCle, lireCle } from './stockage';

/**
 * Les étapes, dans l'ordre (D54). Le code reste le même si l'ordre change :
 * le reste de l'application ne parle que de codes (`ETAPE.selection`).
 */
const DEFINITIONS = [
  { code: 'projet', nom: aTraduire('Projet'), court: aTraduire('Projet') },
  { code: 'inventaire', nom: aTraduire('Inventaire'), court: aTraduire('Inventaire') },
  { code: 'dossiers', nom: aTraduire('Dossiers'), court: aTraduire('Dossiers') },
  { code: 'floues', nom: aTraduire('Photos floues'), court: aTraduire('Floues') },
  { code: 'doublons', nom: aTraduire('Doublons'), court: aTraduire('Doublons') },
  { code: 'tri', nom: aTraduire('Tri automatique'), court: aTraduire('Tri automatique') },
  { code: 'lieux', nom: aTraduire('Lieux et sorties'), court: aTraduire('Lieux et sorties') },
  { code: 'petits', nom: aTraduire('Petits dossiers'), court: aTraduire('Petits dossiers') },
  { code: 'nommage', nom: aTraduire('Nommage'), court: aTraduire('Nommage') },
  { code: 'consolidation', nom: aTraduire('Consolidation'), court: aTraduire('Consolidation') },
  { code: 'selection', nom: aTraduire('Sélection'), court: aTraduire('Sélection') },
  { code: 'album', nom: aTraduire('Album'), court: aTraduire('Album') },
  { code: 'sortie', nom: aTraduire('Création de la sortie'), court: aTraduire('Sortie') },
] as const;

export type CodeEtape = (typeof DEFINITIONS)[number]['code'];

export const CODES_ETAPES: readonly CodeEtape[] = DEFINITIONS.map((d) => d.code);
export const ETAPES: readonly string[] = DEFINITIONS.map((d) => d.nom);
/** Noms courts pour la frise des étapes. */
export const ETAPES_COURTES: readonly string[] = DEFINITIONS.map((d) => d.court);
/** Nom de l'étape `n` (1 à 13) dans la langue de l'interface. */
export const nomEtape = (n: number): string => t(ETAPES[n - 1] ?? '');
/** Nom court de l'étape `n` (1 à 13) dans la langue de l'interface. */
export const nomCourtEtape = (n: number): string => t(ETAPES_COURTES[n - 1] ?? '');
/** Numéro (1 à 13) de chaque étape. */
export const ETAPE = Object.fromEntries(DEFINITIONS.map((d, i) => [d.code, i + 1])) as Record<CodeEtape, number>;

/** Étapes sautées pour un dossier déjà trié (on peut toujours y aller par la frise). */
const SAUTEES_SI_DEJA_TRIE: readonly CodeEtape[] = ['dossiers', 'floues', 'tri', 'petits', 'nommage', 'consolidation'];

/**
 * Étapes dans l'ordre où « Valider et continuer » les enchaîne. `sansSousDossiers` :
 * le dossier en vrac n'a aucun sous-dossier, l'étape « Dossiers » n'a rien à demander.
 */
export function parcours(mode: Projet['mode'], sansSousDossiers = false): CodeEtape[] {
  return CODES_ETAPES.filter((c) => (mode === 'vrac' || !SAUTEES_SI_DEJA_TRIE.includes(c)) && !(c === 'dossiers' && sansSousDossiers));
}

/** Étape suivante du parcours (depuis n'importe quelle étape, même hors parcours), ou `null` après la dernière. */
export function etapeSuivante(mode: Projet['mode'], code: CodeEtape, sansSousDossiers = false): CodeEtape | null {
  return parcours(mode, sansSousDossiers).find((c) => ETAPE[c] > ETAPE[code]) ?? null;
}

export function etapePrecedente(mode: Projet['mode'], code: CodeEtape, sansSousDossiers = false): CodeEtape | null {
  return parcours(mode, sansSousDossiers).filter((c) => ETAPE[c] < ETAPE[code]).at(-1) ?? null;
}

/**
 * L'arborescence a-t-elle été validée au moins une fois (§ 4.2) ? La sortie
 * peut alors être créée, même si « Lieux et sorties » est repassée « à revoir »
 * (un doublon écarté ensuite, par exemple : les doublons viennent avant).
 */
export function arborescenceValidee(p: Pick<Projet, 'etapes'>): boolean {
  const e = p.etapes[ETAPE.lieux - 1];
  return e === 'validee' || e === 'a_revoir';
}

/** Le tri automatique et les choix par dossier n'ont pas lieu d'être pour un dossier déjà trié, ni « Dossiers » sans sous-dossier. */
export function etapeInutile(mode: Projet['mode'], code: CodeEtape, sansSousDossiers = false): boolean {
  return (mode === 'deja_trie' && (code === 'tri' || code === 'dossiers')) || (code === 'dossiers' && sansSousDossiers);
}

/** Ordre des 11 étapes d'avant le 23.10.2026 : Doublons y venait après Consolidation, sans Tri automatique. */
const ORDRE_11: readonly CodeEtape[] = ['projet', 'inventaire', 'floues', 'lieux', 'petits', 'nommage', 'consolidation', 'doublons', 'selection', 'album', 'sortie'];
/** Ordre des 12 étapes d'avant le 24.10.2026 : les choix par sous-dossier se faisaient à l'Inventaire. */
const ORDRE_12: readonly CodeEtape[] = ['projet', 'inventaire', 'floues', 'doublons', 'tri', 'lieux', 'petits', 'nommage', 'consolidation', 'selection', 'album', 'sortie'];

/** Met l'état des étapes d'un projet commencé avec 11 ou 12 étapes dans l'ordre actuel ; `true` si le projet a changé. */
export function migrerEtapes(p: Projet): boolean {
  const ordre = p.etapes.length === ORDRE_11.length ? ORDRE_11 : p.etapes.length === ORDRE_12.length ? ORDRE_12 : null;
  if (!ordre) return false;
  const ancien = new Map(ordre.map((c, i) => [c, p.etapes[i]]));
  // Le tri automatique était fait dans l'ancienne étape « Lieux et sorties » : réglages enregistrés = tri calculé.
  if (ordre === ORDRE_11) ancien.set('tri', p.mode === 'vrac' && p.tri ? 'validee' : 'a_faire');
  // Les choix par sous-dossier faisaient partie de l'inventaire : validés avec lui.
  ancien.set('dossiers', ancien.get('inventaire') === 'validee' ? 'validee' : 'a_faire');
  p.etapes = CODES_ETAPES.map((c) => ancien.get(c) ?? 'a_faire');
  return true;
}

export type EtatEtape = 'a_faire' | 'en_cours' | 'validee' | 'a_revoir';

export interface Projet {
  version: 1;
  id: string;
  nom: string;
  cree_le: string;
  modifie_le: string;
  /** « Ouvrir un dossier déjà trié » ou « Trier un nouveau dossier ». */
  mode: 'deja_trie' | 'vrac';
  /** Pour reconnaître la source quand on reprend le projet. */
  source: { nom: string; fichiers: number; octets: number };
  contexte: string;
  prereglage: string;
  budget_chf: number;
  /** État des étapes 1 à 13, dans l'ordre de `CODES_ETAPES` (indice 0 = étape 1). */
  etapes: EtatEtape[];
  /** Seuil de netteté retenu à l'étape « Photos floues » (défaut 60). */
  seuil_flou?: number;
  /** Réglages du tri par lieux retenus à l'étape « Tri automatique ». */
  tri?: Record<string, unknown>;
  /** Dépenses IA réelles par fonction du catalogue (« IA7 »), en USD. */
  couts_usd?: Record<string, number>;
  /** Pages dont l'explication a déjà été vue (« lieux », « selection ») : elle s'ouvre repliée ensuite. */
  entetes_vus?: string[];
  /** Résumé du dernier inventaire de la source. */
  inventaire?: { quand: string; fichiers: number; dossiers: number; octets: number; dureeMs: number; ignores: string[] };
}

/** Lecture et écriture des fichiers de `.album/`. Chaque écriture remplace le fichier d'un coup (fichier temporaire de Chrome). */
export class EtatProjet {
  private dossier: FileSystemDirectoryHandle | null = null;
  constructor(readonly sortie: FileSystemDirectoryHandle) {}

  private async etat(): Promise<FileSystemDirectoryHandle> {
    this.dossier ??= await this.sortie.getDirectoryHandle(DOSSIER_ETAT, { create: true });
    return this.dossier;
  }

  async lire<T>(nom: string): Promise<T | undefined> {
    try {
      const f = await (await (await this.etat()).getFileHandle(nom)).getFile();
      return JSON.parse(await f.text()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') return undefined;
      throw err;
    }
  }

  /** Contenu brut d'un fichier de `.album/`, ou `undefined` s'il n'existe pas. */
  async lireBrut(nom: string): Promise<string | undefined> {
    try {
      return await (await (await (await this.etat()).getFileHandle(nom)).getFile()).text();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') return undefined;
      throw err;
    }
  }

  async ecrire(nom: string, valeur: unknown): Promise<void> {
    const w = await (await (await this.etat()).getFileHandle(nom, { create: true })).createWritable();
    await w.write(JSON.stringify(valeur));
    await w.close();
  }

  async ecrireTexte(dossier: FileSystemDirectoryHandle, nom: string, texte: string): Promise<void> {
    const w = await (await dossier.getFileHandle(nom, { create: true })).createWritable();
    await w.write(texte);
    await w.close();
  }

  /** Ajoute une ligne à `journal.jsonl` (activité, coûts, alertes). */
  async journal(type: string, message: string, donnees?: unknown): Promise<void> {
    const poignee = await (await this.etat()).getFileHandle('journal.jsonl', { create: true });
    const taille = (await poignee.getFile()).size;
    const w = await poignee.createWritable({ keepExistingData: true });
    await w.seek(taille);
    await w.write(`${JSON.stringify({ quand: new Date().toISOString(), type, message, donnees })}\n`);
    await w.close();
  }

  async lireJournal(): Promise<{ quand: string; type: string; message: string }[]> {
    try {
      const f = await (await (await this.etat()).getFileHandle('journal.jsonl')).getFile();
      return (await f.text())
        .split('\n')
        .filter(Boolean)
        .flatMap((l) => {
          try {
            return [JSON.parse(l)];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  /** Le dossier de sortie contient-il déjà un projet ? */
  async existe(): Promise<boolean> {
    try {
      const d = await this.sortie.getDirectoryHandle(DOSSIER_ETAT);
      await d.getFileHandle('projet.json');
      return true;
    } catch {
      return false;
    }
  }
}

export function nouveauProjet(nom: string, mode: Projet['mode'], source: Projet['source'], budget: number): Projet {
  const maintenant = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    nom,
    cree_le: maintenant,
    modifie_le: maintenant,
    mode,
    source,
    contexte: '',
    prereglage: mode === 'vrac' ? 'annee' : '',
    budget_chf: budget,
    etapes: ETAPES.map((_, i) => (i === 0 ? 'en_cours' : 'a_faire')),
  };
}

// ---------------------------------------------------------------------------
// Projets récents (avec les poignées de leurs dossiers)
// ---------------------------------------------------------------------------

export interface ProjetRecent {
  id: string;
  nom: string;
  source: FileSystemDirectoryHandle;
  sortie: FileSystemDirectoryHandle;
  ouvert_le: string;
  /** Avancement à la dernière utilisation, pour la carte de l'accueil. */
  etapes?: EtatEtape[];
  fichiers?: number;
}

const CLE_RECENTS = 'projets_recents';

export async function projetsRecents(): Promise<ProjetRecent[]> {
  return ((await lireCle<ProjetRecent[]>(CLE_RECENTS)) ?? []).sort((a, b) => b.ouvert_le.localeCompare(a.ouvert_le));
}

export async function noterProjetRecent(p: Omit<ProjetRecent, 'ouvert_le'>): Promise<void> {
  const liste = (await projetsRecents()).filter((r) => r.id !== p.id);
  liste.unshift({ ...p, ouvert_le: new Date().toISOString() });
  await ecrireCle(CLE_RECENTS, liste.slice(0, 12));
}

export async function oublierProjetRecent(id: string): Promise<void> {
  await ecrireCle(CLE_RECENTS, (await projetsRecents()).filter((r) => r.id !== id));
}
