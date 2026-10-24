// Messages échangés avec le worker d'analyse.

import type { ModeCache } from '../navigateur/cacheMiniatures';

export type Tache =
  | {
      type: 'analyser';
      fichier: Blob;
      /** Phash et netteté fidèles aux scripts (décodage complet, réductions en JavaScript). */
      fidele: boolean;
      /** Variantes rapides (réduction par le navigateur), pour comparaison. */
      rapide: boolean;
      /** Empreinte SHA-256 du fichier entier. */
      empreinte: boolean;
    }
  | {
      /** Netteté, ressemblance et exposition, par la voie rapide (décodage à 1024 px). */
      type: 'indicateurs';
      fichier: Blob;
    }
  | {
      type: 'miniature';
      fichier: Blob;
      /** Hauteur de la miniature en pixels. */
      hauteur: number;
      /** Nom de la miniature dans le cache. */
      cle: string;
      stockage: ModeCache;
    };

export interface ResultatAnalyse {
  largeur: number;
  hauteur: number;
  phash?: string;
  nettete1024?: number;
  nettete800?: number;
  /** Phash depuis l'image décodée à 1024 px par le navigateur (bilinéaire). */
  phashDepuis1024?: string;
  /** Phash depuis l'image décodée à 512 px par le navigateur (haute qualité). */
  phashDepuis512?: string;
  /** Phash depuis l'image réduite directement à 32×32 par le navigateur. */
  phashRapide?: string;
  netteteRapide1024?: number;
  sha256?: string;
  durees: Partial<Record<'decodage' | 'phash' | 'nettete' | 'netteteRapide' | 'phashDepuis1024' | 'phashDepuis512' | 'phashRapide' | 'empreinte', number>>;
}

export interface ResultatMiniature {
  largeur: number;
  hauteur: number;
  octets: number;
  /** La miniature produite (JPEG), déjà écrite dans le cache. */
  jpeg: Blob;
  durees: { decodage: number; encodage: number; ecriture: number };
}

export interface ResultatIndicateurs {
  phash: string;
  nettete: number;
  moyenne: number;
  sombres: number;
  claires: number;
  centre: number;
  bords: number;
}

export type Message = { id: number; tache: Tache };
export type Reponse = { id: number; ok: true; resultat: unknown } | { id: number; ok: false; erreur: string };
