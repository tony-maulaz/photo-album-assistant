// Point b : choisir ou créer le dossier config/, lire et écrire config.json
// (écriture sûre, sauvegardes, détection d'une modification faite ailleurs).

import { nomSauvegarde, sauvegardesEnTrop, validerConfig } from '../lib/config';
import { choisirDossier, demanderAutorisation, dossierMemorise, etatAutorisation, memoriserDossier } from '../navigateur/dossiers';
import exemple from '../../../config.exemple/config.json';
import { noter } from './resultats';
import { bouton, duree, el, section, type Journal } from './ui';

interface Lecture {
  texte: string;
  modifie: number;
  taille: number;
}

let dossier: FileSystemDirectoryHandle | undefined;
let lecture: Lecture | undefined;

export async function monterConfig() {
  const { corps, journal } = section(
    'b',
    'b. Dossier config/ et config.json',
    'Choisissez (ou créez) un dossier config/ de test, par exemple à côté de album-photos.html. Pour tester la détection : après une lecture, modifiez config.json dans le Bloc-notes, enregistrez, puis cliquez « Enregistrer une modification de test » : la page doit refuser d’écraser.',
  );
  const etat = el('p', { classe: 'etat' }, 'Aucun dossier config/ choisi.');
  const contenu = el('pre', { classe: 'apercu' });

  const memorise = await dossierMemorise('config');
  if (memorise) {
    dossier = memorise;
    const a = await etatAutorisation(memorise, 'readwrite');
    etat.textContent = `config/ mémorisé : « ${memorise.name} » — autorisation au chargement : ${a}`;
    noter('b', 'autorisation_au_chargement', a === 'granted' ? 'ok' : 'info', `config/ retrouvé au chargement, autorisation : ${a}`, a);
  }

  const apres = async (d: FileSystemDirectoryHandle, origine: string) => {
    dossier = d;
    etat.textContent = `config/ : « ${d.name} » (${origine})`;
    await lire(journal, contenu);
  };

  corps.append(
    etat,
    el(
      'div',
      { classe: 'actions' },
      bouton('Choisir le dossier config/…', journal, async () => {
        const d = await choisirDossier('config', 'readwrite');
        noter('b', 'choix', 'ok', `Dossier config choisi : ${d.name}`);
        await apres(d, 'choisi');
      }),
      bouton('Créer config/ dans un dossier…', journal, async () => {
        const parent = await choisirDossier('config-parent', 'readwrite');
        const d = await parent.getDirectoryHandle('config', { create: true });
        await memoriserDossier('config', d);
        noter('b', 'creation', 'ok', `Dossier config/ créé dans « ${parent.name} »`);
        await apres(d, 'créé');
      }),
      bouton('Reprendre config/ mémorisé', journal, async () => {
        const d = await dossierMemorise('config');
        if (!d) throw new Error('Aucun dossier config/ mémorisé.');
        const ok = await demanderAutorisation(d, 'readwrite');
        noter('b', 'reprise', ok ? 'ok' : 'echec', `Reprise de config/ : ${ok ? 'accès accordé' : 'accès refusé'}`);
        if (ok) await apres(d, 'repris');
      }),
    ),
    el(
      'div',
      { classe: 'actions' },
      bouton('Relire config.json', journal, () => lire(journal, contenu)),
      bouton('Créer config.json depuis le modèle', journal, () => ecrire(journal, contenu, structuredClone(exemple), true)),
      bouton('Enregistrer une modification de test', journal, async () => {
        if (!lecture) throw new Error('Lisez d’abord config.json.');
        const config = JSON.parse(lecture.texte) as Record<string, unknown>;
        await ecrire(journal, contenu, config, false);
      }),
    ),
    contenu,
  );
}

async function fichierConfig(creer: boolean): Promise<FileSystemFileHandle> {
  if (!dossier) throw new Error('Choisissez d’abord le dossier config/.');
  if (!(await demanderAutorisation(dossier, 'readwrite'))) throw new Error('Accès en écriture refusé.');
  return dossier.getFileHandle('config.json', { create: creer });
}

async function lire(journal: Journal, contenu: HTMLElement) {
  let poignee: FileSystemFileHandle;
  try {
    poignee = await fichierConfig(false);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      journal.avert('Pas de config.json dans ce dossier : cliquez « Créer config.json depuis le modèle ».');
      lecture = undefined;
      return;
    }
    throw err;
  }
  const debut = performance.now();
  const f = await poignee.getFile();
  const texte = await f.text();
  lecture = { texte, modifie: f.lastModified, taille: f.size };
  let erreurs: string[];
  try {
    erreurs = validerConfig(JSON.parse(texte));
  } catch (err) {
    erreurs = [`JSON illisible : ${(err as Error).message}`];
  }
  contenu.textContent = texte;
  const ms = performance.now() - debut;
  if (erreurs.length) journal.avert(`config.json lu (${duree(ms)}) mais invalide : ${erreurs.join(' ')}`);
  else journal.ok(`config.json lu et valide (${duree(ms)}).`);
  noter('b', 'lecture', erreurs.length ? 'avert' : 'ok', erreurs.length ? `Lu, invalide : ${erreurs.join(' ')}` : `Lu et valide en ${duree(ms)}`);
}

async function ecrire(journal: Journal, contenu: HTMLElement, config: Record<string, unknown>, creation: boolean) {
  const poignee = await fichierConfig(true);
  const actuel = await poignee.getFile();

  // Modification faite ailleurs depuis notre lecture ? On ne l'écrase pas. La date
  // ne suffit pas toujours (le stockage privé de Chrome ne la met pas à jour) :
  // le fichier est petit, on compare aussi son contenu.
  const modifie =
    !!lecture && (actuel.lastModified !== lecture.modifie || actuel.size !== lecture.taille || (await actuel.text()) !== lecture.texte);
  if (!creation && modifie) {
    journal.avert('config.json a été modifié ailleurs depuis la lecture : écriture refusée. Relisez-le avant de modifier.');
    noter('b', 'detection_modification', 'ok', 'Modification extérieure détectée : écriture refusée');
    return;
  }
  const debut = performance.now();

  // Sauvegarde horodatée de la version actuelle, puis élagage (10 dernières).
  if (actuel.size > 0) {
    const sauvegardes = await dossier!.getDirectoryHandle('sauvegardes', { create: true });
    const s = await sauvegardes.getFileHandle(nomSauvegarde(new Date()), { create: true });
    const w = await s.createWritable();
    await w.write(await actuel.text());
    await w.close();
    const noms: string[] = [];
    for await (const nom of sauvegardes.keys()) noms.push(nom);
    for (const nom of sauvegardesEnTrop(noms, 10)) await sauvegardes.removeEntry(nom);
  }

  // Écriture : Chrome écrit dans un fichier temporaire et ne remplace l'original qu'à close().
  config.modifie_le = new Date().toISOString().slice(0, 19);
  const texte = `${JSON.stringify(config, null, 2)}\n`;
  const w = await poignee.createWritable();
  await w.write(texte);
  await w.close();
  const relu = await (await poignee.getFile()).text();
  const restes: string[] = [];
  for await (const nom of dossier!.keys()) if (nom.endsWith('.crswap')) restes.push(nom);
  const ms = performance.now() - debut;
  const f = await poignee.getFile();
  lecture = { texte: relu, modifie: f.lastModified, taille: f.size };
  contenu.textContent = relu;
  const ok = relu === texte && restes.length === 0;
  journal.ecrire(ok ? 'ok' : 'echec', `config.json écrit et relu identique (${duree(ms)}, sauvegarde comprise)${restes.length ? ` — fichiers temporaires restants : ${restes.join(', ')}` : ''}.`);
  noter('b', creation ? 'creation_fichier' : 'ecriture', ok ? 'ok' : 'echec', `Écriture sûre en ${duree(ms)}, relu ${relu === texte ? 'identique' : 'différent'}, ${restes.length} fichier(s) .crswap restant(s)`);
}
