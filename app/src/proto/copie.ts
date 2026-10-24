// Point d : copier des fichiers vers un dossier de sortie, vérifier les tailles,
// resynchroniser sans recopier (A13), déplacer dans la sortie (§ 4.2).

import { choisirDossier, demanderAutorisation, dossierMemorise, relation, sousDossier } from '../navigateur/dossiers';
import { enParallele } from '../navigateur/workers';
import { contexte, type ElementInventaire } from './contexte';
import { noter } from './resultats';
import { bouton, duree, el, nombre, section, taille, type Journal } from './ui';

const ESSAI = '_essai_phase0';

export async function monterCopie() {
  const { corps, journal } = section(
    'd',
    'd. Copie vers un dossier de sortie',
    'Après l’inventaire (a), choisissez un dossier de sortie vide sur le même disque (ex. D:\\Sortie). Les copies vont dans un sous-dossier _essai_phase0, supprimé par « Nettoyer ».',
  );
  const etat = el('p', { classe: 'etat' }, 'Aucun dossier de sortie.');
  const nombrePhotos = el('input', { type: 'number', value: '100', min: '1', classe: 'court' });
  const avecVideo = el('input', { type: 'checkbox', checked: true });

  const memorise = await dossierMemorise('sortie');
  if (memorise) {
    contexte.sortie = memorise;
    etat.textContent = `Sortie mémorisée : « ${memorise.name} »`;
  }

  corps.append(
    etat,
    el(
      'div',
      { classe: 'actions' },
      bouton('Choisir le dossier de sortie…', journal, async () => {
        const d = await choisirDossier('sortie', 'readwrite');
        contexte.sortie = d;
        etat.textContent = `Sortie : « ${d.name} »`;
        if (contexte.source) {
          const rel = await relation(contexte.source, d);
          const refus = rel !== 'independants';
          const texte = {
            identiques: 'la sortie est le dossier à trier',
            'b-dans-a': 'la sortie est à l’intérieur du dossier à trier',
            'a-dans-b': 'le dossier à trier est à l’intérieur de la sortie',
            independants: 'dossiers indépendants',
          }[rel];
          journal.ecrire(refus ? 'avert' : 'ok', `Contrôle source / sortie : ${texte}${refus ? ' — l’application refusera ce choix' : ''}.`);
          noter('d', 'controle_inclusion', 'ok', `Détection de l’inclusion source/sortie : ${texte}`, rel);
        }
      }),
    ),
    el(
      'div',
      { classe: 'actions' },
      el('label', {}, 'Copier ', nombrePhotos, ' photos'),
      el('label', {}, avecVideo, ' et la plus grosse vidéo'),
      bouton('Copier', journal, () => copier(journal, Number(nombrePhotos.value) || 1, avecVideo.checked, false), 'principal'),
      bouton('Resynchroniser (rien ne doit être recopié)', journal, () => copier(journal, Number(nombrePhotos.value) || 1, avecVideo.checked, true)),
      bouton('Tester le déplacement', journal, () => deplacer(journal)),
      bouton('Nettoyer', journal, async () => {
        const sortie = await sortieAutorisee();
        await sortie.removeEntry(ESSAI, { recursive: true });
        journal.ok(`Dossier ${ESSAI} supprimé de la sortie.`);
      }),
    ),
  );
}

async function sortieAutorisee(): Promise<FileSystemDirectoryHandle> {
  const sortie = contexte.sortie;
  if (!sortie) throw new Error('Choisissez d’abord le dossier de sortie.');
  if (!(await demanderAutorisation(sortie, 'readwrite'))) throw new Error('Accès en écriture refusé.');
  return sortie;
}

function selection(nPhotos: number, avecVideo: boolean): ElementInventaire[] {
  const inv = contexte.inventaire;
  if (!inv) throw new Error('Lancez d’abord l’inventaire (a).');
  const photos = inv.filter((e) => e.categorie === 'photo');
  const pas = Math.max(1, photos.length / nPhotos);
  const choix = Array.from({ length: Math.min(nPhotos, photos.length) }, (_, i) => photos[Math.floor(i * pas)]);
  if (avecVideo) {
    const video = inv.filter((e) => e.categorie === 'video').sort((a, b) => b.taille - a.taille)[0];
    if (video) choix.push(video);
  }
  return choix;
}

async function copier(journal: Journal, nPhotos: number, avecVideo: boolean, resynchroniser: boolean) {
  const sortie = await sortieAutorisee();
  const racine = await sortie.getDirectoryHandle(ESSAI, { create: true });
  const elements = selection(nPhotos, avecVideo);
  let copies = 0;
  let sautes = 0;
  let octets = 0;
  let erreursTaille = 0;
  let datesConservees = 0;
  let plusGrosse: { nom: string; octets: number; ms: number } | null = null;
  const progression = journal.info(`${resynchroniser ? 'Resynchronisation' : 'Copie'} de ${elements.length} fichiers…`);
  const debut = performance.now();

  await enParallele(elements, 4, async (e) => {
    const i = e.chemin.lastIndexOf('/');
    const dossier = await sousDossier(racine, i > 0 ? e.chemin.slice(0, i) : '');
    const original = await e.poignee.getFile();
    // Un fichier de même taille déjà présent n'est jamais recopié.
    try {
      const existant = await (await dossier.getFileHandle(e.nom)).getFile();
      if (existant.size === original.size) {
        sautes++;
        return;
      }
    } catch {
      // Absent : on copie.
    }
    const t0 = performance.now();
    const cible = await dossier.getFileHandle(e.nom, { create: true });
    const flux = await cible.createWritable();
    await original.stream().pipeTo(flux);
    const ms = performance.now() - t0;
    const copie = await cible.getFile();
    if (copie.size !== original.size) erreursTaille++;
    if (Math.abs(copie.lastModified - original.lastModified) < 2000) datesConservees++;
    copies++;
    octets += original.size;
    if (!plusGrosse || original.size > plusGrosse.octets) plusGrosse = { nom: e.nom, octets: original.size, ms };
    progression.lastChild!.textContent = `${copies + sautes} / ${elements.length} fichiers…`;
  });

  const ms = performance.now() - debut;
  const restes: string[] = [];
  const chercherRestes = async (d: FileSystemDirectoryHandle, chemin: string) => {
    for await (const [nom, h] of d.entries()) {
      if (h.kind === 'directory') await chercherRestes(h as FileSystemDirectoryHandle, `${chemin}${nom}/`);
      else if (nom.endsWith('.crswap')) restes.push(chemin + nom);
    }
  };
  await chercherRestes(racine, '');

  if (resynchroniser) {
    const ok = copies === 0;
    journal.ecrire(ok ? 'ok' : 'echec', `Resynchronisation : ${sautes} fichiers identiques sautés, ${copies} recopiés (${duree(ms)}).`);
    noter('d', 'resynchronisation', ok ? 'ok' : 'echec', `Deuxième passage : ${copies} fichier(s) recopié(s), ${sautes} sauté(s) en ${duree(ms)}`);
    return;
  }
  const debit = octets / (ms / 1000);
  const gros = plusGrosse as { nom: string; octets: number; ms: number } | null;
  journal.ecrire(
    erreursTaille ? 'echec' : 'ok',
    `${copies} fichiers copiés (${taille(octets)}) en ${duree(ms)}, soit ${taille(debit)}/s ; tailles vérifiées : ${copies - erreursTaille}/${copies}.`,
  );
  if (gros) journal.info(`Plus gros fichier : ${gros.nom} (${taille(gros.octets)}) en ${duree(gros.ms)}, soit ${taille(gros.octets / (gros.ms / 1000))}/s.`);
  journal.ecrire(
    datesConservees === copies ? 'ok' : 'avert',
    `Date de modification d’origine conservée pour ${datesConservees}/${copies} copies${datesConservees < copies ? ' : les copies portent la date du jour' : ''}.`,
  );
  if (restes.length) journal.avert(`Fichiers temporaires restants : ${restes.join(', ')}`);
  noter('d', 'copie', erreursTaille ? 'echec' : 'ok', `${copies} fichiers, ${taille(octets)} en ${duree(ms)} (${taille(debit)}/s), ${erreursTaille} erreur(s) de taille`, {
    copies,
    sautes,
    octets,
    ms,
    debitOctetsParSeconde: debit,
    plusGrosFichier: gros,
    restesCrswap: restes,
  });
  noter('d', 'date_modification', datesConservees === copies ? 'ok' : 'avert', `Date de modification conservée : ${datesConservees}/${copies}`);
  noter('h', 'copie_debit', 'info', `Débit de copie : ${taille(debit)}/s (estimation pour 34 Go : ${duree((34 * 1024 ** 3) / debit * 1000)})`);
}

async function deplacer(journal: Journal) {
  const sortie = await sortieAutorisee();
  const racine = await sortie.getDirectoryHandle(ESSAI, { create: true });
  const original = await racine.getFileHandle('essai_deplacement.txt', { create: true });
  const w = await original.createWritable();
  await w.write('fichier de test pour move()');
  await w.close();
  if (typeof original.move !== 'function') {
    journal.echec('FileSystemFileHandle.move() n’existe pas dans ce navigateur : il faudra copier puis supprimer.');
    noter('d', 'deplacement', 'echec', 'move() indisponible');
    return;
  }
  const destination = await racine.getDirectoryHandle('deplace', { create: true });
  const t0 = performance.now();
  try {
    await original.move(destination, 'essai_renomme.txt');
  } catch (err) {
    journal.echec(`move() a échoué : ${String(err)}`);
    noter('d', 'deplacement', 'echec', `move() a échoué : ${String(err)}`);
    return;
  }
  const ms = performance.now() - t0;
  let ancienPresent = true;
  try {
    await racine.getFileHandle('essai_deplacement.txt');
  } catch {
    ancienPresent = false;
  }
  const texte = await (await (await destination.getFileHandle('essai_renomme.txt')).getFile()).text();
  const ok = !ancienPresent && texte.startsWith('fichier de test');
  journal.ecrire(ok ? 'ok' : 'echec', `Déplacement + renommage dans la sortie : ${ok ? 'fonctionne' : 'incomplet'} (${nombre(ms)} ms).`);
  noter('d', 'deplacement', ok ? 'ok' : 'echec', `move() sur disque local : ${ok ? 'fonctionne' : 'incomplet'} en ${nombre(ms)} ms`);

  // Un gros fichier est-il renommé sur place (instantané) ou recopié ?
  const video = contexte.inventaire?.filter((e) => e.categorie === 'video').sort((a, b) => b.taille - a.taille)[0];
  if (!video) return;
  const i = video.chemin.lastIndexOf('/');
  let poignee: FileSystemFileHandle;
  let dossier: FileSystemDirectoryHandle;
  try {
    dossier = await sousDossier(racine, i > 0 ? video.chemin.slice(0, i) : '', false);
    poignee = await dossier.getFileHandle(video.nom);
  } catch {
    journal.info('Copiez d’abord la plus grosse vidéo pour mesurer son déplacement.');
    return;
  }
  const t1 = performance.now();
  await poignee.move!(destination);
  const aller = performance.now() - t1;
  await poignee.move!(dossier);
  journal.ok(`Déplacement de ${video.nom} (${taille(video.taille)}) : ${nombre(aller)} ms.`);
  noter('d', 'deplacement_gros_fichier', 'info', `Déplacement d’un fichier de ${taille(video.taille)} en ${nombre(aller)} ms`, { octets: video.taille, ms: aller });
}
