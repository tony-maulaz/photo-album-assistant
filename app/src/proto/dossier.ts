// Point a (dossier local : choix, parcours, mémorisation) et mesures du point h
// (inventaire d'un grand dossier, extrapolé à 5000 photos ; dates des vidéos).

import { dateDepuisNom, type DateNom } from '../lib/dates';
import { distanceHamming } from '../lib/phash';
import { categorie } from '../lib/fichiers';
import { lireInfosVideo } from '../lib/video';
import {
  choisirDossier,
  demanderAutorisation,
  dossierMemorise,
  etatAutorisation,
  lecteurBlob,
  parcourir,
} from '../navigateur/dossiers';
import { lireExif } from '../navigateur/exif';
import { enParallele } from '../navigateur/workers';
import { contexte, type ElementInventaire } from './contexte';
import { noter } from './resultats';
import { bouton, duree, el, memoire, nombre, respirer, section, tableau, taille, texteMemoire, type Journal } from './ui';

const CIBLE = 5000;

export async function monterDossier() {
  const { corps, journal } = section(
    'a',
    'a. Dossier à trier : choix, parcours, mémorisation — et mesures d’inventaire (h)',
    'Choisissez le grand dossier de test (D:\\Photos\\2025), lancez l’inventaire, puis rechargez la page (F5) et fermez/rouvrez le navigateur : la page doit retrouver le dossier.',
  );

  const etat = el('p', { classe: 'etat' }, 'Aucun dossier choisi.');
  const choixInvite = el(
    'select',
    {
      onchange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v) noter('a', 'invite_reprise', 'info', `Lors de la reprise, Chrome a affiché : ${v}`, v);
      },
    },
    el('option', { value: '' }, '— Qu’a affiché Chrome lors de la reprise ? —'),
    el('option', {}, 'Rien : accès immédiat'),
    el('option', {}, 'Une demande avec « Autoriser à chaque visite »'),
    el('option', {}, 'Une demande simple (Autoriser / Ne pas autoriser)'),
    el('option', {}, 'Autre chose (préciser dans le rapport)'),
  );

  const afficherDossier = async (d: FileSystemDirectoryHandle, origine: string) => {
    contexte.source = d;
    const lecture = await etatAutorisation(d, 'read');
    etat.textContent = `Dossier : « ${d.name} » (${origine}) — autorisation de lecture : ${lecture}`;
  };

  // Au chargement : le dossier mémorisé est-il retrouvé, et avec quelle autorisation ?
  const memorise = await dossierMemorise('source');
  if (memorise) {
    const autorisation = await etatAutorisation(memorise, 'read');
    contexte.source = memorise;
    etat.textContent = `Dossier mémorisé : « ${memorise.name} » — autorisation au chargement : ${autorisation}`;
    noter(
      'a',
      'autorisation_au_chargement',
      autorisation === 'granted' ? 'ok' : 'info',
      `Dossier « ${memorise.name} » retrouvé au chargement, autorisation : ${autorisation}`,
      autorisation,
    );
  }

  const optionExif = el('input', { type: 'checkbox', checked: true });
  const optionVideos = el('input', { type: 'checkbox', checked: true });
  const optionEchantillon = el('input', { type: 'number', value: '200', min: '0', max: '5000', classe: 'court' });
  let arreter = false;

  corps.append(
    etat,
    el(
      'div',
      { classe: 'actions' },
      bouton('Choisir le dossier…', journal, async () => {
        const d = await choisirDossier('source', 'read');
        await afficherDossier(d, 'choisi');
        journal.ok(`Dossier « ${d.name} » choisi et mémorisé.`);
        noter('a', 'choix', 'ok', `Dossier choisi : ${d.name}`);
      }),
      bouton('Reprendre le dossier mémorisé', journal, async () => {
        const d = await dossierMemorise('source');
        if (!d) {
          journal.avert('Aucun dossier mémorisé.');
          return;
        }
        const debut = performance.now();
        const accorde = await demanderAutorisation(d, 'read');
        await afficherDossier(d, 'repris');
        noter('a', 'reprise', accorde ? 'ok' : 'echec', `Reprise du dossier « ${d.name} » : ${accorde ? 'accès accordé' : 'accès refusé'} (${duree(performance.now() - debut)})`);
        journal.ecrire(accorde ? 'ok' : 'echec', accorde ? 'Accès accordé.' : 'Accès refusé.');
      }),
      choixInvite,
    ),
    el(
      'div',
      { classe: 'actions' },
      el('label', {}, optionExif, ' lire l’EXIF de toutes les photos'),
      el('label', {}, optionVideos, ' lire la date interne des vidéos'),
      el('label', {}, 'analyser un échantillon de ', optionEchantillon, ' photos (netteté, ressemblance, empreinte)'),
    ),
    el(
      'div',
      { classe: 'actions' },
      bouton(
        'Lancer l’inventaire',
        journal,
        async () => {
          arreter = false;
          await inventaire(corps, journal, {
            exif: optionExif.checked,
            videos: optionVideos.checked,
            echantillon: Number(optionEchantillon.value) || 0,
            arreter: () => arreter,
          });
        },
        'principal',
      ),
      bouton('Arrêter', journal, () => {
        arreter = true;
      }),
    ),
  );
}

interface Options {
  exif: boolean;
  videos: boolean;
  echantillon: number;
  arreter: () => boolean;
}

async function inventaire(corps: HTMLElement, journal: Journal, o: Options) {
  const source = contexte.source;
  if (!source) throw new Error('Choisissez d’abord un dossier.');
  if (!(await demanderAutorisation(source, 'read'))) throw new Error('Accès au dossier refusé.');
  const progression = journal.info('Parcours du dossier…');
  const memoireDebut = memoire();
  const temps: Record<string, number> = {};

  // 1. Parcours : liste des fichiers.
  let t0 = performance.now();
  let dossiers = 0;
  const entrees: { chemin: string; nom: string; poignee: FileSystemFileHandle }[] = [];
  for await (const e of parcourir(source, () => dossiers++)) {
    entrees.push({ chemin: e.chemin, nom: e.nom, poignee: e.fichier });
    if (entrees.length % 500 === 0) {
      progression.lastChild!.textContent = `Parcours : ${nombre(entrees.length)} fichiers…`;
      await respirer();
    }
    if (o.arreter()) throw new DOMException('Arrêté', 'AbortError');
  }
  temps.parcours = performance.now() - t0;
  journal.ok(`Parcours : ${nombre(entrees.length)} fichiers dans ${nombre(dossiers)} dossiers en ${duree(temps.parcours)}.`);

  // 2. Taille et date de chaque fichier.
  t0 = performance.now();
  const elements: ElementInventaire[] = await enParallele(entrees, 16, async (e, i) => {
    const f = await e.poignee.getFile();
    if (i % 500 === 0) progression.lastChild!.textContent = `Tailles : ${nombre(i)} / ${nombre(entrees.length)}…`;
    return { chemin: e.chemin, nom: e.nom, categorie: categorie(e.nom), poignee: e.poignee, taille: f.size, modifie: f.lastModified };
  });
  temps.tailles = performance.now() - t0;
  contexte.inventaire = elements;
  const photos = elements.filter((e) => e.categorie === 'photo');
  const videos = elements.filter((e) => e.categorie === 'video');
  const autres = elements.filter((e) => e.categorie === 'autre');
  const somme = (l: ElementInventaire[]) => l.reduce((s, e) => s + e.taille, 0);
  const extensions = new Map<string, number>();
  for (const e of elements) {
    const ext = e.nom.includes('.') ? e.nom.slice(e.nom.lastIndexOf('.')).toLowerCase() : '(aucune)';
    extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
  }
  journal.ok(
    `Tailles lues en ${duree(temps.tailles)} : ${nombre(photos.length)} photos (${taille(somme(photos))}), ${nombre(videos.length)} vidéos (${taille(somme(videos))}), ${nombre(autres.length)} autres fichiers.`,
  );
  const heic = (extensions.get('.heic') ?? 0) + (extensions.get('.heif') ?? 0);
  noter('h', 'heic', heic ? 'avert' : 'ok', `${heic} fichier(s) HEIC/HEIF sur ${nombre(photos.length)} photos`, heic);
  noter('a', 'contenu', 'info', `${elements.length} fichiers, ${dossiers} dossiers`, {
    fichiers: elements.length,
    dossiers,
    photos: photos.length,
    videos: videos.length,
    autres: autres.length,
    octets: { photos: somme(photos), videos: somme(videos), autres: somme(autres) },
    extensions: Object.fromEntries([...extensions].sort((a, b) => b[1] - a[1])),
  });

  // 3. EXIF des photos.
  const stats = { dateExif: 0, dateNom: 0, sansDate: 0, gps: 0, decalage: 0, erreurs: 0, orientations: {} as Record<string, number> };
  const appareils = new Map<string, { n: number; min: string; max: string }>();
  if (o.exif) {
    t0 = performance.now();
    await enParallele(photos, 8, async (p, i) => {
      if (o.arreter()) return;
      try {
        p.exif = await lireExif(await p.poignee.getFile());
      } catch {
        p.exif = null;
        stats.erreurs++;
      }
      if (!p.exif?.date) p.dateNom = dateDepuisNom(p.nom);
      if (p.exif?.date) stats.dateExif++;
      else if (p.dateNom) stats.dateNom++;
      else stats.sansDate++;
      if (p.exif?.lat !== undefined) stats.gps++;
      if (p.exif?.decalage) stats.decalage++;
      const or = String(p.exif?.orientation ?? '—');
      stats.orientations[or] = (stats.orientations[or] ?? 0) + 1;
      if (p.exif?.modele && p.exif.date) {
        const a = appareils.get(p.exif.modele) ?? { n: 0, min: p.exif.date, max: p.exif.date };
        a.n++;
        if (p.exif.date < a.min) a.min = p.exif.date;
        if (p.exif.date > a.max) a.max = p.exif.date;
        appareils.set(p.exif.modele, a);
      }
      if (i % 200 === 0) progression.lastChild!.textContent = `EXIF : ${nombre(i)} / ${nombre(photos.length)}…`;
    });
    temps.exif = performance.now() - t0;
    journal.ok(
      `EXIF lu en ${duree(temps.exif)} (${nombre(temps.exif / Math.max(1, photos.length), 1)} ms par photo) : ${nombre(stats.dateExif)} avec date, ${nombre(stats.dateNom)} datées par leur nom, ${nombre(stats.sansDate)} sans date, ${nombre(stats.gps)} avec GPS.`,
    );
    noter('a', 'exif', 'ok', `EXIF de ${photos.length} photos en ${duree(temps.exif)}`, { ...stats, appareils: Object.fromEntries(appareils), dureeMs: temps.exif });
  }

  // 4. Date interne des vidéos, comparée à celle du nom de fichier.
  if (o.videos && videos.length) {
    t0 = performance.now();
    const ecarts = new Map<string, number>();
    let sansDate = 0;
    let avecGps = 0;
    await enParallele(videos, 4, async (v) => {
      if (o.arreter()) return;
      const f = await v.poignee.getFile();
      try {
        v.video = await lireInfosVideo(lecteurBlob(f), f.size);
      } catch {
        v.video = null;
      }
      v.dateNom = dateDepuisNom(v.nom);
      if (!v.video?.dateUTC) sansDate++;
      if (v.video?.gps) avecGps++;
      const cle = ecartVideo(v.dateNom, v.video?.dateUTC ?? null);
      ecarts.set(cle, (ecarts.get(cle) ?? 0) + 1);
    });
    temps.videos = performance.now() - t0;
    const repartition = Object.fromEntries([...ecarts].sort((a, b) => b[1] - a[1]));
    journal.ok(`Vidéos lues en ${duree(temps.videos)} : ${nombre(videos.length - sansDate)} avec date interne, ${nombre(avecGps)} avec GPS.`);
    corps.appendChild(tableau(['Nom de fichier comparé à la date interne (UTC)', 'Vidéos'], Object.entries(repartition).map(([k, n]) => [k, nombre(n)])));
    noter('h', 'videos', 'info', `${videos.length} vidéos : écart nom ↔ date interne`, { repartition, sansDate, avecGps, dureeMs: temps.videos });
  }

  // 5. Doublons exacts (photos) : taille, puis début et fin, puis contenu complet.
  t0 = performance.now();
  const doublons = await doublonsExacts(photos, o.arreter);
  temps.doublons = performance.now() - t0;
  journal.ok(
    `Doublons exacts : ${nombre(doublons.memeTaille)} photos de même taille, ${nombre(doublons.candidats)} candidates après début/fin, ${nombre(doublons.confirmes)} doublons confirmés (${duree(temps.doublons)}, ${taille(doublons.octetsLus)} lus).`,
  );
  noter('a', 'doublons_exacts', 'info', `${doublons.confirmes} doublons exacts parmi ${photos.length} photos`, { ...doublons, dureeMs: temps.doublons });

  // 6. Analyse d'un échantillon dans les workers, extrapolée.
  let parPhotoMs = 0;
  let voies: { fidele: number; rapide: number } | null = null;
  if (o.echantillon > 0 && photos.length) {
    const n = Math.min(o.echantillon, photos.length);
    const pas = photos.length / n;
    const choix = Array.from({ length: n }, (_, i) => photos[Math.floor(i * pas)]);
    const groupe = contexte.groupe();
    t0 = performance.now();
    const durees = new Map<string, number>();
    const ecartsPhash: number[] = [];
    const ecartsNettete: number[] = [];
    let erreurs = 0;
    let faits = 0;
    await enParallele(choix, groupe.taille * 2, async (p) => {
      if (o.arreter()) return;
      try {
        // Les deux voies sur chaque photo : fidèle (12 Mpx décodés) et rapide (décodage à 1024 px).
        const r = await groupe.analyser(await p.poignee.getFile(), { fidele: true, rapide: true });
        for (const [cle, d] of Object.entries(r.durees)) durees.set(cle, (durees.get(cle) ?? 0) + d);
        if (r.phash && r.phashDepuis1024) ecartsPhash.push(distanceHamming(r.phash, r.phashDepuis1024));
        if (r.nettete1024 && r.netteteRapide1024) ecartsNettete.push(Math.abs(r.netteteRapide1024 / r.nettete1024 - 1) * 100);
      } catch {
        erreurs++;
      }
      if (++faits % 10 === 0) progression.lastChild!.textContent = `Analyse : ${faits} / ${n}…`;
    });
    temps.echantillon = performance.now() - t0;
    const reussies = Math.max(1, n - erreurs);
    const moy = (cle: string) => (durees.get(cle) ?? 0) / reussies;
    // Coût par photo de chaque voie, réparti sur les workers.
    const fidele = (moy('decodage') + moy('phash') + moy('nettete')) / groupe.taille;
    const rapide = (moy('netteteRapide') + moy('phashDepuis1024')) / groupe.taille;
    parPhotoMs = rapide;
    const maxPhash = ecartsPhash.length ? Math.max(...ecartsPhash) : NaN;
    const centile = (l: number[], f: number) => [...l].sort((a, b) => a - b)[Math.floor(f * (l.length - 1))] ?? NaN;
    const texteVoies = `Échantillon de ${n} photos, ${groupe.taille} workers : voie fidèle ${nombre(fidele)} ms par photo, voie rapide ${nombre(rapide)} ms par photo. Écart rapide / fidèle : ressemblance ≤ ${maxPhash} bit(s), netteté médiane ${nombre(centile(ecartsNettete, 0.5), 2)} %, 99e centile ${nombre(centile(ecartsNettete, 0.99), 2)} %.`;
    journal.ok(texteVoies);
    if (erreurs) journal.avert(`${erreurs} photo(s) non décodées (format non pris en charge ?).`);
    noter('h', 'analyse_echantillon', maxPhash <= 2 ? 'ok' : 'avert', texteVoies, {
      n,
      erreurs,
      workers: groupe.taille,
      dureeMs: temps.echantillon,
      parPhotoMs: { fidele, rapide },
      moyennesParWorkerMs: Object.fromEntries([...durees].map(([k, v]) => [k, v / reussies])),
      ecartsPhash,
      ecartsNettete,
    });
    voies = { fidele, rapide };
  }

  // Extrapolation à 5000 photos (les étapes par fichier sont proportionnelles).
  const facteur = CIBLE / Math.max(1, photos.length);
  // Analyse comptée avec la voie rapide (les deux voies sont détaillées dans le tableau).
  const estimation =
    (temps.parcours + temps.tailles + (temps.exif ?? 0) + (temps.videos ?? 0) + temps.doublons) * facteur + parPhotoMs * CIBLE;
  const memoireFin = memoire();
  const texte = `Inventaire complet estimé pour ${nombre(CIBLE)} photos : ${duree(estimation)} (objectif : moins de 30 min). Mémoire JavaScript : ${texteMemoire()}${memoireDebut !== null && memoireFin !== null ? ` (+${taille(memoireFin - memoireDebut)})` : ''}.`;
  journal.ecrire(estimation < 30 * 60_000 ? 'ok' : 'echec', texte);
  progression.lastChild!.textContent = 'Inventaire terminé.';
  noter('h', 'inventaire_5000', estimation < 30 * 60_000 ? 'ok' : 'echec', texte, {
    tempsMs: temps,
    photos: photos.length,
    fichiers: elements.length,
    estimation5000Ms: estimation,
    memoire: { debut: memoireDebut, fin: memoireFin },
  });
  corps.appendChild(
    tableau(
      ['Étape', 'Durée mesurée', `Extrapolée à ${nombre(CIBLE)} photos`],
      [
        ...Object.entries(temps)
          .filter(([k]) => k !== 'echantillon')
          .map(([k, v]) => [k, duree(v), duree(v * facteur)]),
        ...(voies
          ? [
              ['analyse, voie rapide (1024 px)', `échantillon : ${duree(temps.echantillon)}`, duree(voies.rapide * CIBLE)],
              ['analyse, voie fidèle (12 Mpx)', '', duree(voies.fidele * CIBLE)],
            ]
          : []),
      ],
    ),
  );
}

/** Écart en heures entre la date du nom (heure locale) et la date interne (UTC). */
function ecartVideo(dateNom: DateNom | null, dateUTC: Date | null): string {
  if (!dateUTC) return 'pas de date interne';
  if (!dateNom) return 'pas de date dans le nom';
  if (dateNom.precision !== 'seconde') return 'nom daté au jour seulement';
  const local = Date.UTC(dateNom.annee, dateNom.mois - 1, dateNom.jour, dateNom.heure, dateNom.minute, dateNom.seconde);
  const heures = (local - dateUTC.getTime()) / 3_600_000;
  const arrondi = Math.round(heures);
  if (Math.abs(heures - arrondi) * 60 > 2) return `écart non entier (${heures.toFixed(2)} h)`;
  return `nom = UTC ${arrondi >= 0 ? '+' : ''}${arrondi} h`;
}

async function hacher(octets: ArrayBuffer): Promise<string> {
  const c = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(c), (o) => o.toString(16).padStart(2, '0')).join('');
}

/** Doublons exacts en trois temps : même taille, même début et fin (64 Ko), même contenu. */
async function doublonsExacts(photos: ElementInventaire[], arreter: () => boolean) {
  const BLOC = 64 * 1024;
  let octetsLus = 0;
  const parTaille = new Map<number, ElementInventaire[]>();
  for (const p of photos) parTaille.set(p.taille, [...(parTaille.get(p.taille) ?? []), p]);
  const memeTaille = [...parTaille.values()].filter((g) => g.length > 1).flat();
  const parBouts = new Map<string, ElementInventaire[]>();
  await enParallele(memeTaille, 8, async (p) => {
    if (arreter()) return;
    const f = await p.poignee.getFile();
    const bouts = await new Blob([f.slice(0, BLOC), f.slice(Math.max(0, f.size - BLOC))]).arrayBuffer();
    octetsLus += bouts.byteLength;
    const cle = `${p.taille}:${await hacher(bouts)}`;
    parBouts.set(cle, [...(parBouts.get(cle) ?? []), p]);
  });
  const candidats = [...parBouts.values()].filter((g) => g.length > 1).flat();
  const parContenu = new Map<string, number>();
  await enParallele(candidats, 4, async (p) => {
    if (arreter()) return;
    const contenu = await (await p.poignee.getFile()).arrayBuffer();
    octetsLus += contenu.byteLength;
    const cle = await hacher(contenu);
    parContenu.set(cle, (parContenu.get(cle) ?? 0) + 1);
  });
  const confirmes = [...parContenu.values()].reduce((s, n) => s + (n > 1 ? n - 1 : 0), 0);
  return { memeTaille: memeTaille.length, candidats: candidats.length, confirmes, octetsLus };
}
