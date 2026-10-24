// Création et mise à jour du dossier de sortie (SPEC § 4.2, § 6.11) :
// exécute les actions de `planifierSynchro`, puis fait le bilan.

import type { Plan } from '../lib/plan';
import { bilan, cleChemin, copieDuPlan, DOSSIER_ETAT, nomsSortie, octetsACopier, planifierSynchro, type ActionSynchro, type Bilan, type EtatSortie, type ListingSortie } from '../lib/sortie';
import { AccesDossier } from './dossiers';
import { enParallele } from './workers';

/** Tous les fichiers de la sortie, hors `.album/` et rapport. */
export async function listerSortie(sortie: FileSystemDirectoryHandle): Promise<ListingSortie> {
  const fichiers: { chemin: string; poignee: FileSystemFileHandle }[] = [];
  const parcourir = async (d: FileSystemDirectoryHandle, prefixe: string) => {
    for await (const [nom, h] of d.entries()) {
      const chemin = prefixe ? `${prefixe}/${nom}` : nom;
      if (h.kind === 'directory') {
        if (!prefixe && nom === DOSSIER_ETAT) continue;
        await parcourir(h as FileSystemDirectoryHandle, chemin);
      } else if (prefixe || nom !== nomsSortie().rapport) {
        fichiers.push({ chemin, poignee: h as FileSystemFileHandle });
      }
    }
  };
  await parcourir(sortie, '');
  const tailles = await enParallele(fichiers, 16, async (f) => (await f.poignee.getFile()).size);
  return new Map(fichiers.map((f, i) => [cleChemin(f.chemin), { chemin: f.chemin, taille: tailles[i] }]));
}

export interface ProgressionSynchro {
  faits: number;
  total: number;
  octets: number;
  octetsTotal: number;
  enCours?: string;
}

export interface ErreurSynchro {
  id: string;
  message: string;
  /** L'original n'est plus dans le dossier à trier (supprimé, renommé ou déplacé depuis l'inventaire). */
  disparu?: boolean;
}

export interface ResultatSynchro {
  /** Copies écrites, nouvelles versions comprises. */
  copies: number;
  deplaces: number;
  gardes: number;
  conflits: ActionSynchro[];
  erreurs: ErreurSynchro[];
  bilan: Bilan;
  listing: ListingSortie;
}

/** L'original n'est plus dans le dossier à trier : réessayer ne sert à rien, il faut mettre à jour l'inventaire. */
class OriginalDisparu extends Error {}

function erreurSynchro(id: string, err: unknown): ErreurSynchro {
  return err instanceof OriginalDisparu ? { id, message: err.message, disparu: true } : { id, message: String(err) };
}

export interface OptionsSynchro {
  plan: Plan;
  source: AccesDossier;
  sortie: AccesDossier;
  etat: EtatSortie;
  /** Appelé régulièrement pour enregistrer l'état (règle d'or 7). */
  enregistrerEtat: (etat: EtatSortie) => Promise<void>;
  progres: (p: ProgressionSynchro) => void;
  arreter: () => boolean;
}

function separer(chemin: string): [string, string] {
  const i = chemin.lastIndexOf('/');
  return [i < 0 ? '' : chemin.slice(0, i), chemin.slice(i + 1)];
}

/** Supprime les dossiers devenus vides sous `racine` (jamais un fichier). */
async function supprimerDossiersVides(racine: FileSystemDirectoryHandle): Promise<boolean> {
  let vide = true;
  for await (const [nom, h] of racine.entries()) {
    if (h.kind === 'directory' && (await supprimerDossiersVides(h as FileSystemDirectoryHandle))) await racine.removeEntry(nom);
    else vide = false;
  }
  return vide;
}

export async function synchroniser(o: OptionsSynchro): Promise<ResultatSynchro> {
  const listing = await listerSortie(o.sortie.racine);
  const actions = planifierSynchro(o.plan, listing, o.etat);
  const aFaire = actions.filter((a) => a.type === 'copier' || a.type === 'deplacer' || a.type === 'remplacer');
  const octetsTotal = octetsACopier(o.plan, aFaire);
  const r: ResultatSynchro = { copies: 0, deplaces: 0, gardes: 0, conflits: [], erreurs: [], bilan: bilan(o.plan, listing, o.etat), listing };
  for (const a of actions) {
    if (a.type === 'garder') {
      r.gardes++;
      o.etat.fichiers[a.id] = copieDuPlan(o.plan.fichiers.get(a.id)!, a.cible);
    } else if (a.type === 'conflit') r.conflits.push(a);
  }

  let faits = 0;
  let octets = 0;
  let derniereSauvegarde = performance.now();
  const sauvegarder = async (forcer = false) => {
    if (forcer || performance.now() - derniereSauvegarde > 2000) {
      derniereSauvegarde = performance.now();
      await o.enregistrerEtat(o.etat);
    }
  };
  // Une copie (ou nouvelle version, qui remplace la copie précédente de l'application) : l'état
  // note la taille et la date de l'original lu, pour reconnaître plus tard une nouvelle version.
  const copier = async (id: string, cible: string) => {
    const f = o.plan.fichiers.get(id)!;
    let original: File;
    try {
      original = await o.source.fichier(id);
    } catch (err) {
      throw err instanceof DOMException && err.name === 'NotFoundError' ? new OriginalDisparu(String(err)) : err;
    }
    const flux = await (await o.sortie.poignee(cible, true)).createWritable();
    await original.stream().pipeTo(flux);
    o.etat.fichiers[id] = { chemin: cible, taille: original.size, modifie: original.lastModified };
    octets += f.taille;
    r.copies++;
  };
  let deplacementFait = false;
  const deplacer = async (id: string, depuis: string, cible: string) => {
    const [dossierCible, nomCible] = separer(cible);
    const poignee = await o.sortie.poignee(depuis);
    if (typeof poignee.move !== 'function') throw new Error('move() indisponible');
    await poignee.move(await o.sortie.dossier(dossierCible, true), nomCible);
    o.etat.fichiers[id] = { ...o.etat.fichiers[id], chemin: cible };
    deplacementFait = true;
  };

  // Les déplacements d'abord : ils libèrent des places et sont instantanés. Une copie
  // d'une version plus ancienne est déplacée, puis remplacée.
  const deplacements = aFaire.filter((a): a is Extract<ActionSynchro, { type: 'deplacer' | 'remplacer' }> => (a.type === 'deplacer' || a.type === 'remplacer') && !!a.depuis);
  for (const a of deplacements) {
    if (o.arreter()) break;
    o.progres({ faits, total: aFaire.length, octets, octetsTotal, enCours: a.cible });
    let deplace = false;
    try {
      await deplacer(a.id, a.depuis!, a.cible);
      deplace = true;
      if (a.type === 'deplacer') {
        o.etat.fichiers[a.id] = copieDuPlan(o.plan.fichiers.get(a.id)!, a.cible);
        r.deplaces++;
      }
    } catch {
      // Déplacement impossible : on recopie depuis la source (l'ancienne copie reste, signalée au bilan).
    }
    if (!deplace || a.type === 'remplacer') {
      try {
        await copier(a.id, a.cible);
      } catch (err) {
        r.erreurs.push(erreurSynchro(a.id, err));
      }
    }
    faits++;
    await sauvegarder();
  }

  const copies = aFaire.filter((a) => a.type === 'copier' || (a.type === 'remplacer' && !a.depuis));
  await enParallele(copies, 4, async (a) => {
    if (o.arreter()) return;
    // La place de la copie d'un autre fichier : prise seulement si cette copie est bien partie ailleurs.
    if (a.type === 'copier' && a.libere && cleChemin(o.etat.fichiers[a.libere]?.chemin ?? '') === cleChemin(a.cible)) {
      r.conflits.push({ type: 'conflit', id: a.id, cible: a.cible });
      faits++;
      return;
    }
    o.progres({ faits, total: aFaire.length, octets, octetsTotal, enCours: a.cible });
    let derniereErreur: unknown;
    for (let essai = 0; essai < 3; essai++) {
      try {
        await copier(a.id, a.cible);
        derniereErreur = undefined;
        break;
      } catch (err) {
        derniereErreur = err;
        if (err instanceof OriginalDisparu) break;
      }
    }
    if (derniereErreur) r.erreurs.push(erreurSynchro(a.id, derniereErreur));
    faits++;
    await sauvegarder();
  });
  await sauvegarder(true);
  o.progres({ faits, total: aFaire.length, octets, octetsTotal });

  if (deplacementFait) {
    o.sortie.oublier();
    for await (const [nom, h] of o.sortie.racine.entries()) {
      if (h.kind === 'directory' && nom !== DOSSIER_ETAT && (await supprimerDossiersVides(h as FileSystemDirectoryHandle))) {
        await o.sortie.racine.removeEntry(nom);
      }
    }
  }
  r.listing = await listerSortie(o.sortie.racine);
  r.bilan = bilan(o.plan, r.listing, o.etat);
  return r;
}
