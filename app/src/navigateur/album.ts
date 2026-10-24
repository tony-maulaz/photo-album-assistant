// Écriture de `Album/` (SPEC § 6.11, § 12) : copies numérotées des photos
// retenues, dans l'ordre de l'album, et `textes_album.md`. Les copies déjà
// faites sont gardées ou renommées ; les anciennes, retirées (incident I1).
// Une photo tournée n'est pas recompressée : seule sa balise Orientation change.

import { fichiersAlbum, ordreAlbum, photosAlbum, planifierAlbum, sections, textesAlbum, type ActionAlbum, type ConfigAlbum, type EtatAlbum, type FichierAlbum } from '../lib/album';
import { changerOrientation, orientationApresRotation, orientationJpeg } from '../lib/jpeg';
import type { Plan } from '../lib/plan';
import { DOSSIER_ALBUM, type EtatSortie } from '../lib/sortie';
import type { AccesDossier } from './dossiers';

export const NOM_TEXTES = 'textes_album.md';

/** Titre de section par défaut : le nom du dossier, sans soulignés (script 03). */
export function titreDossier(plan: Plan, id: string): string {
  return (plan.dossiers.get(id)?.nom ?? id).replace(/_/g, ' ').trim();
}

/** Fichiers voulus dans `Album/`, dans l'ordre, et les textes pour ifolor. */
export function contenuAlbum(plan: Plan, config: ConfigAlbum, nomProjet: string): { voulus: FichierAlbum[]; textes: string } {
  const ordre = ordreAlbum(photosAlbum(plan), config.ordre);
  const secs = sections(ordre, (d) => titreDossier(plan, d), config);
  const voulus = fichiersAlbum(ordre, secs, config);
  // Couverture choisie : une copie de plus, en tête de l'album.
  const couverture = config.couverture ? plan.fichiers.get(config.couverture) : undefined;
  if (couverture && couverture.statut === 'archive') {
    const ext = couverture.nom.includes('.') ? couverture.nom.slice(couverture.nom.lastIndexOf('.')).toLowerCase() : '.jpg';
    voulus.unshift({ id: couverture.id, chemin: `0000_Couverture${ext}`, rotation: couverture.rotation ?? 0, taille: couverture.taille });
  }
  const legendes = new Map(ordre.filter((f) => f.legende).map((f) => [f.id, f.legende!]));
  return { voulus, textes: textesAlbum(nomProjet, secs, voulus.filter((v) => !v.chemin.startsWith('0000_')), legendes, config) };
}

/** Fichiers présents dans `Album/` (chemin relatif → taille). */
export async function listerAlbum(sortie: FileSystemDirectoryHandle): Promise<Map<string, number>> {
  const presents = new Map<string, number>();
  let racine: FileSystemDirectoryHandle;
  try {
    racine = await sortie.getDirectoryHandle(DOSSIER_ALBUM);
  } catch {
    return presents;
  }
  const parcourir = async (d: FileSystemDirectoryHandle, prefixe: string) => {
    for await (const [nom, h] of d.entries()) {
      const chemin = prefixe ? `${prefixe}/${nom}` : nom;
      if (h.kind === 'directory') await parcourir(h as FileSystemDirectoryHandle, chemin);
      else if (chemin !== NOM_TEXTES) presents.set(chemin, (await (h as FileSystemFileHandle).getFile()).size);
    }
  };
  await parcourir(racine, '');
  return presents;
}

export interface ResultatAlbum {
  copies: number;
  renommes: number;
  retires: number;
  gardes: number;
  conflits: string[];
  /** Photos tournées copiées sans rotation (pas de balise Orientation à modifier). */
  sansRotation: string[];
  erreurs: { id: string; message: string }[];
}

export interface OptionsAlbum {
  plan: Plan;
  config: ConfigAlbum;
  nomProjet: string;
  source: AccesDossier;
  sortie: AccesDossier;
  etat: EtatSortie;
  enregistrerEtat: (etat: EtatSortie) => Promise<void>;
  progres: (faits: number, total: number, enCours?: string) => void;
  arreter: () => boolean;
}

function separer(chemin: string): [string, string] {
  const i = chemin.lastIndexOf('/');
  return [i < 0 ? '' : chemin.slice(0, i), chemin.slice(i + 1)];
}

export async function actionsAlbum(o: Pick<OptionsAlbum, 'plan' | 'config' | 'nomProjet' | 'sortie' | 'etat'>): Promise<{ actions: ActionAlbum[]; voulus: FichierAlbum[]; textes: string }> {
  const { voulus, textes } = contenuAlbum(o.plan, o.config, o.nomProjet);
  const presents = await listerAlbum(o.sortie.racine);
  return { actions: planifierAlbum(voulus, presents, o.etat.album ?? {}), voulus, textes };
}

/**
 * Exécute le plan de `Album/` : renommages en deux temps (des noms temporaires
 * d'abord, pour que deux copies puissent échanger leur place), retraits de nos
 * anciennes copies, copies nouvelles, puis `textes_album.md`.
 */
export async function synchroniserAlbum(o: OptionsAlbum): Promise<ResultatAlbum> {
  const { actions, voulus, textes } = await actionsAlbum(o);
  const etat: EtatAlbum = (o.etat.album ??= {});
  const r: ResultatAlbum = { copies: 0, renommes: 0, retires: 0, gardes: 0, conflits: [], sansRotation: [], erreurs: [] };
  const album = (chemin: string) => (chemin ? `${DOSSIER_ALBUM}/${chemin}` : DOSSIER_ALBUM);
  const travail = actions.filter((a) => a.type !== 'garder' && a.type !== 'conflit').length;
  let faits = 0;
  const avancer = async (enCours?: string) => {
    faits++;
    o.progres(faits, travail, enCours);
  };
  for (const a of actions) {
    if (a.type === 'garder') r.gardes++;
    if (a.type === 'conflit') r.conflits.push(a.chemin);
  }

  const deplacer = async (depuis: string, vers: string) => {
    const [dossier, nom] = separer(vers);
    const poignee = await o.sortie.poignee(album(depuis));
    if (typeof poignee.move !== 'function') throw new Error('Ce navigateur ne sait pas renommer un fichier (move).');
    await poignee.move(await o.sortie.dossier(album(dossier), true), nom);
    etat[vers] = etat[depuis];
    delete etat[depuis];
  };

  // 1. Renommages vers des noms temporaires.
  const renommages = actions.filter((a): a is Extract<ActionAlbum, { type: 'renommer' }> => a.type === 'renommer');
  const temporaires = new Map<string, string>();
  for (const [i, a] of renommages.entries()) {
    if (o.arreter()) break;
    const [dossier, nom] = separer(a.depuis);
    const tmp = `${dossier ? `${dossier}/` : ''}~${i}_${nom}`;
    try {
      await deplacer(a.depuis, tmp);
      temporaires.set(a.chemin, tmp);
    } catch (err) {
      r.erreurs.push({ id: a.id, message: String(err) });
    }
  }
  await o.enregistrerEtat(o.etat);

  // 2. Retraits de nos anciennes copies (jamais un fichier de l'utilisateur : planifierAlbum le garantit).
  for (const a of actions) {
    if (a.type !== 'retirer' || o.arreter()) continue;
    const [dossier, nom] = separer(a.chemin);
    try {
      await (await o.sortie.dossier(album(dossier))).removeEntry(nom);
      delete etat[a.chemin];
      r.retires++;
    } catch (err) {
      r.erreurs.push({ id: a.chemin, message: String(err) });
    }
    await avancer(a.chemin);
  }

  // 3. Noms définitifs.
  for (const a of renommages) {
    const tmp = temporaires.get(a.chemin);
    if (!tmp || o.arreter()) continue;
    try {
      await deplacer(tmp, a.chemin);
      r.renommes++;
    } catch (err) {
      r.erreurs.push({ id: a.id, message: String(err) });
    }
    await avancer(a.chemin);
  }
  await o.enregistrerEtat(o.etat);

  // 4. Copies, avec la rotation demandée appliquée à la balise Orientation.
  let derniere = performance.now();
  for (const a of actions) {
    if (a.type !== 'copier' || o.arreter()) continue;
    try {
      const original = await o.source.fichier(a.id);
      let contenu: Blob = original;
      if (a.rotation) {
        const octets = new Uint8Array(await original.arrayBuffer());
        const tournee = changerOrientation(octets, orientationApresRotation(orientationJpeg(octets) ?? 1, a.rotation));
        if (tournee) contenu = new Blob([tournee as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
        else r.sansRotation.push(a.chemin);
      }
      const flux = await (await o.sortie.poignee(album(a.chemin), true)).createWritable();
      await contenu.stream().pipeTo(flux);
      etat[a.chemin] = { id: a.id, taille: contenu.size, rotation: a.rotation };
      r.copies++;
    } catch (err) {
      r.erreurs.push({ id: a.id, message: String(err) });
    }
    await avancer(a.chemin);
    if (performance.now() - derniere > 2000) {
      derniere = performance.now();
      await o.enregistrerEtat(o.etat);
    }
  }
  // 5. Textes pour ifolor (toujours réécrits : ils ne coûtent rien), retirés si l'album est vide.
  if (voulus.length) {
    const w = await (await o.sortie.poignee(album(NOM_TEXTES), true)).createWritable();
    await w.write(textes);
    await w.close();
  } else {
    await o.sortie
      .dossier(DOSSIER_ALBUM)
      .then((d) => d.removeEntry(NOM_TEXTES))
      .catch(() => undefined);
  }
  await o.enregistrerEtat(o.etat);
  return r;
}
