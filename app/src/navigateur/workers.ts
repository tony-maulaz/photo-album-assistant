// Groupe de workers d'analyse : répartit les tâches, une à la fois par worker.

import WorkerAnalyse from '../workers/analyse.worker?worker&inline';
import type { ModeCache } from './cacheMiniatures';
import type { Message, Reponse, ResultatAnalyse, ResultatIndicateurs, ResultatMiniature, Tache } from '../workers/protocole';

interface EnAttente {
  message: Message;
  resoudre: (v: unknown) => void;
  rejeter: (e: Error) => void;
}

export class GroupeWorkers {
  readonly taille: number;
  private libres: Worker[] = [];
  private enCours = new Map<number, EnAttente>();
  /** Tâche confiée à chaque worker occupé, pour l'échouer si le worker plante. */
  private tacheDe = new Map<Worker, number>();
  private file: EnAttente[] = [];
  private prochainId = 1;
  private tous: Worker[] = [];

  constructor(taille = Math.min(Math.max(1, (navigator.hardwareConcurrency || 4) - 1), 8)) {
    this.taille = taille;
    for (let i = 0; i < taille; i++) {
      const w = new WorkerAnalyse();
      w.onmessage = (e: MessageEvent<Reponse>) => this.recevoir(w, e.data);
      w.onerror = (e) => {
        e.preventDefault();
        const id = this.tacheDe.get(w);
        const texte = e.message || 'le worker n’a pas pu démarrer';
        if (id !== undefined) this.recevoir(w, { id, ok: false, erreur: `Worker : ${texte}` });
      };
      this.tous.push(w);
      this.libres.push(w);
    }
  }

  private recevoir(w: Worker, r: Reponse) {
    const attente = this.enCours.get(r.id);
    this.enCours.delete(r.id);
    this.tacheDe.delete(w);
    this.libres.push(w);
    if (attente) {
      if (r.ok) attente.resoudre(r.resultat);
      else attente.rejeter(new Error(r.erreur));
    }
    this.distribuer();
  }

  private distribuer() {
    while (this.libres.length && this.file.length) {
      const w = this.libres.pop()!;
      const a = this.file.shift()!;
      this.enCours.set(a.message.id, a);
      this.tacheDe.set(w, a.message.id);
      w.postMessage(a.message);
    }
  }

  private executer<T>(tache: Tache): Promise<T> {
    return new Promise<T>((resoudre, rejeter) => {
      this.file.push({ message: { id: this.prochainId++, tache }, resoudre: resoudre as (v: unknown) => void, rejeter });
      this.distribuer();
    });
  }

  analyser(fichier: Blob, options: { fidele?: boolean; rapide?: boolean; empreinte?: boolean }): Promise<ResultatAnalyse> {
    return this.executer({ type: 'analyser', fichier, fidele: !!options.fidele, rapide: !!options.rapide, empreinte: !!options.empreinte });
  }

  indicateurs(fichier: Blob): Promise<ResultatIndicateurs> {
    return this.executer({ type: 'indicateurs', fichier });
  }

  miniature(fichier: Blob, hauteur: number, cle: string, stockage: ModeCache): Promise<ResultatMiniature> {
    return this.executer({ type: 'miniature', fichier, hauteur, cle, stockage });
  }

  terminer() {
    for (const w of this.tous) w.terminate();
    for (const a of [...this.file, ...this.enCours.values()]) a.rejeter(new Error('Analyse interrompue'));
    this.file = [];
    this.enCours.clear();
  }
}

/**
 * Exécute `action` sur chaque élément avec au plus `simultanes` promesses en
 * cours. À la première erreur, plus rien n'est lancé ; on attend la fin de ce
 * qui est en cours (une aide IA ne doit pas continuer à dépenser), puis
 * l'erreur est levée.
 */
export async function enParallele<T, R>(elements: T[], simultanes: number, action: (e: T, i: number) => Promise<R>): Promise<R[]> {
  const resultats = new Array<R>(elements.length);
  let suivant = 0;
  let erreur: { e: unknown } | null = null;
  const ouvrier = async () => {
    while (suivant < elements.length && !erreur) {
      const i = suivant++;
      try {
        resultats[i] = await action(elements[i], i);
      } catch (e) {
        erreur ??= { e };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(simultanes, elements.length) }, ouvrier));
  if (erreur) throw (erreur as { e: unknown }).e;
  return resultats;
}
