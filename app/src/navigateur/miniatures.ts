// Miniatures des photos : cache hors de la sortie (OPFS ou IndexedDB, § 13),
// production dans les workers, priorité à ce qui est visible.

import { lireMiniature, modeCache, type ModeCache } from './cacheMiniatures';
import type { GroupeWorkers } from './workers';

/** Hauteur des miniatures produites, en pixels. */
export const HAUTEUR_MINIATURE = 256;
/** Hauteur des miniatures « grand format », pour les grilles agrandies au-delà de 256 px. */
export const HAUTEUR_GRANDE = 600;

/** Clé de cache de la version grand format d'une miniature. */
export function cleGrande(cle: string): string {
  return cle.replace(/\.jpg$/, '-g.jpg');
}

/** Empreinte FNV-1a (32 bits) d'un texte, en hexadécimal. */
function fnv(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Clé de cache : identité du fichier (chemin, taille, date), commune à tous les projets. */
export function cleMiniature(chemin: string, taille: number, modifie: number): string {
  return `${fnv(chemin)}-${taille.toString(36)}-${modifie.toString(36)}.jpg`;
}

interface Demande {
  obtenir: () => Promise<File>;
  hauteur: number;
  interet: number;
  promesse: Promise<string | null>;
  resoudre: (url: string | null) => void;
}

/** Fournit des adresses `blob:` de miniatures ; garde les plus récentes en mémoire. */
export class Miniatures {
  private urls = new Map<string, string>();
  private demandes = new Map<string, Demande>();
  private file: string[] = [];
  private enCours = 0;
  private mode: Promise<ModeCache> = modeCache();

  constructor(
    private groupe: GroupeWorkers,
    private max = 800,
  ) {}

  /** URL de la miniature, ou `null` si le fichier ne peut pas être décodé (vidéo, format inconnu). */
  url(cle: string, obtenir: () => Promise<File>, hauteur = HAUTEUR_MINIATURE): Promise<string | null> {
    const connue = this.urls.get(cle);
    if (connue) {
      // Remet l'entrée en fin de liste (la plus récemment utilisée).
      this.urls.delete(cle);
      this.urls.set(cle, connue);
      return Promise.resolve(connue);
    }
    const existante = this.demandes.get(cle);
    if (existante) {
      existante.interet++;
      return existante.promesse;
    }
    let resoudre!: (url: string | null) => void;
    const promesse = new Promise<string | null>((r) => (resoudre = r));
    this.demandes.set(cle, { obtenir, hauteur, interet: 1, promesse, resoudre });
    this.file.push(cle);
    this.suivante();
    return promesse;
  }

  /** La case n'est plus visible : sa miniature n'est plus prioritaire. */
  abandonner(cle: string) {
    const d = this.demandes.get(cle);
    if (d) d.interet--;
  }

  private memoriser(cle: string, blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.set(cle, url);
    while (this.urls.size > this.max) {
      const [ancienne, u] = this.urls.entries().next().value!;
      this.urls.delete(ancienne);
      URL.revokeObjectURL(u);
    }
    return url;
  }

  private suivante() {
    while (this.enCours < this.groupe.taille * 2 && this.file.length) {
      // Les dernières demandées sont celles qui viennent d'apparaître à l'écran.
      const cle = this.file.pop()!;
      const d = this.demandes.get(cle)!;
      if (d.interet <= 0) {
        this.demandes.delete(cle);
        d.resoudre(null);
        continue;
      }
      this.enCours++;
      void this.produire(cle, d).finally(() => {
        this.enCours--;
        this.demandes.delete(cle);
        this.suivante();
      });
    }
  }

  private async produire(cle: string, d: Demande) {
    try {
      const mode = await this.mode;
      const enCache = await lireMiniature(mode, cle);
      if (enCache) {
        d.resoudre(this.memoriser(cle, enCache));
        return;
      }
      const r = await this.groupe.miniature(await d.obtenir(), d.hauteur, cle, mode);
      d.resoudre(this.memoriser(cle, r.jpeg));
    } catch {
      d.resoudre(null);
    }
  }
}
