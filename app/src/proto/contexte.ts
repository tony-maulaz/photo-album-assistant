// État partagé entre les sections de la page de test.

import type { DateNom } from '../lib/dates';
import type { ExifPhoto } from '../navigateur/exif';
import type { Categorie } from '../lib/fichiers';
import type { InfosVideo } from '../lib/video';
import { GroupeWorkers } from '../navigateur/workers';

export interface ElementInventaire {
  chemin: string;
  nom: string;
  categorie: Categorie;
  poignee: FileSystemFileHandle;
  taille: number;
  modifie: number;
  exif?: ExifPhoto | null;
  dateNom?: DateNom | null;
  video?: InfosVideo | null;
}

export interface Contexte {
  source?: FileSystemDirectoryHandle;
  sortie?: FileSystemDirectoryHandle;
  inventaire?: ElementInventaire[];
  /** Photos choisies au point c, avec leurs métadonnées. */
  photosTest: { fichier: File; exif: ExifPhoto | null }[];
  groupe(): GroupeWorkers;
}

let groupe: GroupeWorkers | null = null;

export const contexte: Contexte = {
  photosTest: [],
  groupe() {
    groupe ??= new GroupeWorkers();
    return groupe;
  },
};
