// Choix, mémorisation et parcours des dossiers locaux (File System Access).

import { effacerCle, ecrireCle, lireCle } from './stockage';

export type Mode = 'read' | 'readwrite';

export function accesDossiersDisponible(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

/** Identifiant des sélecteurs de fichiers (les dossiers gardent un identifiant par usage). */
const ID_SELECTEUR = 'album-photos';

/** Dossier de départ fixe, choisi dans les réglages : toutes les fenêtres de choix s'y ouvrent. */
export function dossierDepart(): Promise<FileSystemDirectoryHandle | undefined> {
  return lireCle<FileSystemDirectoryHandle>('dossier:depart').catch(() => undefined);
}

/** Choisit le dossier de départ fixe (lecture seule : il sert seulement de point de départ). */
export async function choisirDossierDepart(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('Ce navigateur ne permet pas de choisir un dossier : utilisez Chrome ou Edge.');
  const dossier = await window.showDirectoryPicker({ id: 'depart', mode: 'read', startIn: await depart() });
  await ecrireCle('dossier:depart', dossier);
  return dossier;
}

export function oublierDossierDepart(): Promise<void> {
  return effacerCle('dossier:depart');
}

/** Dossier où s'ouvrent les sélecteurs : le dossier de départ fixe, sinon le dernier choisi, sinon « Images ». */
async function depart(): Promise<FileSystemHandle | 'pictures'> {
  return (await dossierDepart()) ?? (await lireCle<FileSystemDirectoryHandle>('dossier:dernier').catch(() => undefined)) ?? 'pictures';
}

/** Ouvre le sélecteur de dossier et mémorise le choix sous `cle`. */
export async function choisirDossier(cle: string, mode: Mode): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('Ce navigateur ne permet pas de choisir un dossier : utilisez Chrome ou Edge.');
  let dossier: FileSystemDirectoryHandle;
  // Le dossier de départ (fixe, ou le dernier choisi quel que soit l'usage) prime sur la mémoire du navigateur par identifiant.
  try {
    dossier = await window.showDirectoryPicker({ id: cle, mode, startIn: await depart() });
  } catch (err) {
    // Dossier de départ disparu entre-temps : on repart du dossier « Images ».
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    dossier = await window.showDirectoryPicker({ id: cle, mode, startIn: 'pictures' });
  }
  await ecrireCle(`dossier:${cle}`, dossier);
  await ecrireCle('dossier:dernier', dossier);
  return dossier;
}

/**
 * Choisit un fichier (photo, calendrier, CSV) en partant du dossier de départ
 * (fixe, ou le dernier dossier choisi) ; `null` si l'utilisateur renonce. Sans sélecteur moderne, un champ
 * de fichier classique (le navigateur se souvient alors lui-même du dossier).
 */
export async function choisirFichier(accept: Record<string, string[]>, description: string): Promise<File | null> {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const options = { id: ID_SELECTEUR, types: [{ description, accept }], excludeAcceptAllOption: false };
      let poignees: FileSystemFileHandle[];
      try {
        poignees = await window.showOpenFilePicker({ ...options, startIn: await depart() });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        poignees = await window.showOpenFilePicker({ ...options, startIn: 'pictures' });
      }
      return (await poignees[0]?.getFile()) ?? null;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    }
  }
  return new Promise((r) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = Object.values(accept).flat().join(',');
    i.onchange = () => r(i.files?.[0] ?? null);
    i.click();
  });
}

export async function memoriserDossier(cle: string, dossier: FileSystemDirectoryHandle): Promise<void> {
  await ecrireCle(`dossier:${cle}`, dossier);
}

export function dossierMemorise(cle: string): Promise<FileSystemDirectoryHandle | undefined> {
  return lireCle<FileSystemDirectoryHandle>(`dossier:${cle}`);
}

/** État de l'autorisation sans rien demander : 'granted', 'prompt' ou 'denied'. */
export function etatAutorisation(dossier: FileSystemHandle, mode: Mode): Promise<PermissionState> {
  return dossier.queryPermission({ mode });
}

/** Demande l'autorisation (doit suivre un clic de l'utilisateur). */
export async function demanderAutorisation(dossier: FileSystemHandle, mode: Mode): Promise<boolean> {
  if ((await dossier.queryPermission({ mode })) === 'granted') return true;
  return (await dossier.requestPermission({ mode })) === 'granted';
}

export interface Entree {
  chemin: string; // chemin relatif avec « / »
  nom: string;
  fichier: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
}

/** Parcours récursif ; `surDossier` est appelé pour chaque dossier traversé. */
export async function* parcourir(
  dossier: FileSystemDirectoryHandle,
  surDossier?: (chemin: string) => void,
  prefixe = '',
): AsyncGenerator<Entree> {
  surDossier?.(prefixe);
  for await (const entree of dossier.values()) {
    const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.kind === 'file') {
      yield { chemin, nom: entree.name, fichier: entree as FileSystemFileHandle, parent: dossier };
    } else {
      yield* parcourir(entree as FileSystemDirectoryHandle, surDossier, chemin);
    }
  }
}

/** Sous-dossier (créé au besoin) correspondant à un chemin relatif « a/b/c ». */
export async function sousDossier(racine: FileSystemDirectoryHandle, chemin: string, creer = true): Promise<FileSystemDirectoryHandle> {
  let d = racine;
  for (const partie of chemin.split('/').filter(Boolean)) d = await d.getDirectoryHandle(partie, { create: creer });
  return d;
}

/**
 * Relation entre deux dossiers : le second est-il dans le premier, ou
 * inversement ? (refus si l'un contient l'autre, SPEC § 6.1)
 */
export async function relation(a: FileSystemDirectoryHandle, b: FileSystemDirectoryHandle): Promise<'identiques' | 'b-dans-a' | 'a-dans-b' | 'independants'> {
  if (await a.isSameEntry(b)) return 'identiques';
  if ((await a.resolve(b)) !== null) return 'b-dans-a';
  if ((await b.resolve(a)) !== null) return 'a-dans-b';
  return 'independants';
}

/** Lecteur d'octets sur un Blob, pour lire les métadonnées des vidéos sans charger le fichier. */
export function lecteurBlob(blob: Blob) {
  return async (debut: number, longueur: number) => new Uint8Array(await blob.slice(debut, debut + longueur).arrayBuffer());
}

/** Accès aux fichiers d'un dossier par chemin relatif, en gardant les sous-dossiers déjà ouverts. */
export class AccesDossier {
  private dossiers = new Map<string, Promise<FileSystemDirectoryHandle>>();
  constructor(readonly racine: FileSystemDirectoryHandle) {
    this.dossiers.set('', Promise.resolve(racine));
  }

  /** Sous-dossier « a/b » (créé si `creer`). */
  dossier(chemin: string, creer = false): Promise<FileSystemDirectoryHandle> {
    const cle = `${creer ? '+' : ''}${chemin}`;
    let d = this.dossiers.get(chemin) ?? this.dossiers.get(cle);
    if (!d) {
      const i = chemin.lastIndexOf('/');
      const parent = i < 0 ? '' : chemin.slice(0, i);
      d = this.dossier(parent, creer).then((p) => p.getDirectoryHandle(chemin.slice(i + 1), { create: creer }));
      d.catch(() => this.dossiers.delete(cle));
      this.dossiers.set(cle, d);
    }
    return d;
  }

  async poignee(chemin: string, creer = false): Promise<FileSystemFileHandle> {
    const i = chemin.lastIndexOf('/');
    const d = await this.dossier(i < 0 ? '' : chemin.slice(0, i), creer);
    return d.getFileHandle(chemin.slice(i + 1), { create: creer });
  }

  async fichier(chemin: string): Promise<File> {
    return (await this.poignee(chemin)).getFile();
  }

  /** Oublie les dossiers mémorisés (après des suppressions). */
  oublier() {
    this.dossiers = new Map([['', Promise.resolve(this.racine)]]);
  }
}
