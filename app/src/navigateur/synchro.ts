// Création et mise à jour du dossier de sortie (SPEC § 4.2, § 6.11) :
// exécute les actions de `planifierSynchro`, puis fait le bilan.

import type { Plan } from '../lib/plan';
import { bilan, cleChemin, DOSSIER_ETAT, planifierSynchro, type ActionSynchro, type Bilan, type EtatSortie, type ListingSortie } from '../lib/sortie';
import { AccesDossier } from './dossiers';
import { enParallele } from './workers';

/** Fichier du rapport, écrit à la racine de la sortie (hors bilan). */
export const NOM_RAPPORT = 'Rapport.html';

/** Tous les fichiers de la sortie, hors `.album/` et rapport. */
export async function listerSortie(sortie: FileSystemDirectoryHandle): Promise<ListingSortie> {
  const fichiers: { chemin: string; poignee: FileSystemFileHandle }[] = [];
  const parcourir = async (d: FileSystemDirectoryHandle, prefixe: string) => {
    for await (const [nom, h] of d.entries()) {
      const chemin = prefixe ? `${prefixe}/${nom}` : nom;
      if (h.kind === 'directory') {
        if (!prefixe && nom === DOSSIER_ETAT) continue;
        await parcourir(h as FileSystemDirectoryHandle, chemin);
      } else if (prefixe || nom !== NOM_RAPPORT) {
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

export interface ResultatSynchro {
  copies: number;
  deplaces: number;
  gardes: number;
  conflits: ActionSynchro[];
  erreurs: { id: string; message: string }[];
  bilan: Bilan;
  listing: ListingSortie;
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
  const aFaire = actions.filter((a) => a.type === 'copier' || a.type === 'deplacer');
  const octetsTotal = aFaire.reduce((s, a) => s + (a.type === 'copier' ? (o.plan.fichiers.get(a.id)?.taille ?? 0) : 0), 0);
  const r: ResultatSynchro = { copies: 0, deplaces: 0, gardes: 0, conflits: [], erreurs: [], bilan: bilan(o.plan, listing), listing };
  for (const a of actions) {
    if (a.type === 'garder') {
      r.gardes++;
      o.etat.fichiers[a.id] = { chemin: a.cible, taille: o.plan.fichiers.get(a.id)!.taille };
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
  const copier = async (id: string, cible: string) => {
    const f = o.plan.fichiers.get(id)!;
    const original = await o.source.fichier(id);
    const flux = await (await o.sortie.poignee(cible, true)).createWritable();
    await original.stream().pipeTo(flux);
    o.etat.fichiers[id] = { chemin: cible, taille: f.taille };
    octets += f.taille;
    r.copies++;
  };

  // Les déplacements d'abord : ils libèrent des places et sont instantanés.
  const deplacements = aFaire.filter((a): a is Extract<ActionSynchro, { type: 'deplacer' }> => a.type === 'deplacer');
  for (const a of deplacements) {
    if (o.arreter()) break;
    o.progres({ faits, total: aFaire.length, octets, octetsTotal, enCours: a.cible });
    const [dossierCible, nomCible] = separer(a.cible);
    try {
      const poignee = await o.sortie.poignee(a.depuis);
      if (typeof poignee.move !== 'function') throw new Error('move() indisponible');
      await poignee.move(await o.sortie.dossier(dossierCible, true), nomCible);
      o.etat.fichiers[a.id] = { chemin: a.cible, taille: o.plan.fichiers.get(a.id)!.taille };
      r.deplaces++;
    } catch {
      // Déplacement impossible : on recopie depuis la source (l'ancienne copie reste, signalée au bilan).
      try {
        await copier(a.id, a.cible);
      } catch (err) {
        r.erreurs.push({ id: a.id, message: String(err) });
      }
    }
    faits++;
    await sauvegarder();
  }

  const copies = aFaire.filter((a) => a.type === 'copier');
  await enParallele(copies, 4, async (a) => {
    if (o.arreter()) return;
    o.progres({ faits, total: aFaire.length, octets, octetsTotal, enCours: a.cible });
    let derniereErreur: unknown;
    for (let essai = 0; essai < 3; essai++) {
      try {
        await copier(a.id, a.cible);
        derniereErreur = undefined;
        break;
      } catch (err) {
        derniereErreur = err;
      }
    }
    if (derniereErreur) r.erreurs.push({ id: a.id, message: String(derniereErreur) });
    faits++;
    await sauvegarder();
  });
  await sauvegarder(true);
  o.progres({ faits, total: aFaire.length, octets, octetsTotal });

  if (r.deplaces) {
    o.sortie.oublier();
    for await (const [nom, h] of o.sortie.racine.entries()) {
      if (h.kind === 'directory' && nom !== DOSSIER_ETAT && (await supprimerDossiersVides(h as FileSystemDirectoryHandle))) {
        await o.sortie.racine.removeEntry(nom);
      }
    }
  }
  r.listing = await listerSortie(o.sortie.racine);
  r.bilan = bilan(o.plan, r.listing);
  return r;
}
