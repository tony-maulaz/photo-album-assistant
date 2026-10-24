// Point c : EXIF (date, GPS, appareil), miniatures à l'endroit (I14), netteté et
// ressemblance calculées dans un Web Worker et comparées aux scripts Python.

import { distanceHamming } from '../lib/phash';
import { dimensionsAffichees, dimensionsJpeg } from '../lib/jpeg';
import { lecteurBlob } from '../navigateur/dossiers';
import { lireExif, type ExifPhoto } from '../navigateur/exif';
import { enParallele } from '../navigateur/workers';
import type { ResultatAnalyse } from '../workers/protocole';
import { contexte } from './contexte';
import { noter } from './resultats';
import { el, nombre, section, type Journal } from './ui';

interface Vecteur {
  fichier: string;
  phash_oriente: string;
  phash_brut: string;
  nettete_1024: number;
  nettete_800: number;
}

let vecteurs = new Map<string, Vecteur>();

export function monterPhotos() {
  const { corps, journal } = section(
    'c',
    'c. EXIF, miniatures à l’endroit et calculs dans un Web Worker',
    'Choisissez d’abord vecteurs_reference.json, puis toutes les photos du même dossier tests/photos_reelles/ (Ctrl+A dans le sélecteur) : la page les compare aux scripts Python.',
  );
  const choixPhotos = el('input', { type: 'file', multiple: true, accept: 'image/*,.heic,.heif' });
  const choixVecteurs = el('input', { type: 'file', accept: '.json,application/json' });
  const resultat = el('div', {});

  choixVecteurs.addEventListener('change', async () => {
    const f = choixVecteurs.files?.[0];
    if (!f) return;
    const donnees = JSON.parse(await f.text()) as { photos: Vecteur[] };
    vecteurs = new Map(donnees.photos.map((v) => [v.fichier, v]));
    journal.ok(`${vecteurs.size} vecteurs de référence chargés.`);
  });

  choixPhotos.addEventListener('change', async () => {
    const fichiers = Array.from(choixPhotos.files ?? []).filter((f) => !f.name.endsWith('.json'));
    if (!fichiers.length) return;
    resultat.replaceChildren();
    journal.info(`${fichiers.length} photos : lecture EXIF, miniatures et analyse…`);
    try {
      await analyserPhotos(fichiers, resultat, journal);
    } catch (err) {
      journal.echec(String(err));
    }
  });

  corps.append(
    el('div', { classe: 'actions' }, el('label', {}, '1. Vecteurs Python : ', choixVecteurs), el('label', {}, '2. Photos : ', choixPhotos)),
    resultat,
  );
}

/**
 * L'image affichée est-elle à l'endroit ? On compare son format (portrait ou
 * paysage) à celui attendu d'après les dimensions réelles du JPEG et
 * l'orientation EXIF. `null` si on ne peut pas conclure (photo carrée, pas un JPEG).
 */
export async function bienOrientee(fichier: Blob, orientation: number | undefined, largeur: number, hauteur: number): Promise<boolean | null> {
  const stockees = await dimensionsJpeg(lecteurBlob(fichier), fichier.size);
  if (!stockees) return null;
  const attendue = dimensionsAffichees(stockees, orientation);
  const format = (l: number, h: number) => (Math.abs(l - h) <= 0.05 * Math.max(l, h) ? 0 : Math.sign(l - h));
  if (format(attendue.largeur, attendue.hauteur) === 0) return null;
  return format(largeur, hauteur) === format(attendue.largeur, attendue.hauteur);
}

async function analyserPhotos(fichiers: File[], resultat: HTMLElement, journal: Journal) {
  const groupe = contexte.groupe();
  const corpsTableau = el('tbody', {});
  resultat.appendChild(
    el(
      'table',
      { classe: 'photos' },
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          ...['Miniature', 'Fichier', 'Date EXIF', 'Appareil', 'GPS', 'Orient.', 'À l’endroit', 'Netteté 1024 (Python)', 'Netteté 800 (Python)', 'Ressemblance : écart (bits)', 'Rapide : netteté / écart', 'Durée'].map((t) =>
            el('th', {}, t),
          ),
        ),
      ),
      corpsTableau,
    ),
  );

  contexte.photosTest = [];
  const orientations = { ok: 0, ko: 0, indetermine: 0, tournees: 0 };
  const ecarts = {
    phash: [] as number[],
    phashDepuis1024: [] as number[],
    phashDepuis512: [] as number[],
    phashRapide: [] as number[],
    n1024: [] as number[],
    n800: [] as number[],
    nRapide: [] as number[],
  };
  const durees = new Map<string, number[]>();
  const debutTotal = performance.now();

  await enParallele(fichiers, groupe.taille, async (fichier, i) => {
    const ligne = el('tr', {});
    corpsTableau.appendChild(ligne);
    let exif: ExifPhoto | null = null;
    try {
      exif = await lireExif(fichier);
    } catch {
      exif = null;
    }
    contexte.photosTest[i] = { fichier, exif };

    // Miniature sur le fil principal, comme dans la future grille.
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image', resizeHeight: 120, resizeQuality: 'medium' });
    const canevas = el('canvas', { width: bmp.width, height: bmp.height, classe: 'miniature' });
    canevas.getContext('2d')!.drawImage(bmp, 0, 0);
    const orientee = await bienOrientee(fichier, exif?.orientation, bmp.width, bmp.height);
    bmp.close();
    if ((exif?.orientation ?? 1) >= 5) orientations.tournees++;
    if (orientee === true) orientations.ok++;
    if (orientee === false) orientations.ko++;
    if (orientee === null) orientations.indetermine++;

    let r: ResultatAnalyse | null = null;
    let erreur = '';
    const debut = performance.now();
    try {
      r = await groupe.analyser(fichier, { fidele: true, rapide: true });
    } catch (err) {
      erreur = String(err);
    }
    const ms = performance.now() - debut;
    const v = vecteurs.get(fichier.name);
    const pct = (a?: number, b?: number) => (a !== undefined && b ? ((a / b - 1) * 100) : undefined);
    const ecartPhash = r?.phash && v ? distanceHamming(r.phash, v.phash_oriente) : undefined;
    const ecartRapide = r?.phashRapide && v ? distanceHamming(r.phashRapide, v.phash_oriente) : undefined;
    if (r && v) {
      if (r.phashDepuis1024) ecarts.phashDepuis1024.push(distanceHamming(r.phashDepuis1024, v.phash_oriente));
      if (r.phashDepuis512) ecarts.phashDepuis512.push(distanceHamming(r.phashDepuis512, v.phash_oriente));
    }
    for (const [cle, d] of Object.entries(r?.durees ?? {})) durees.set(cle, [...(durees.get(cle) ?? []), d]);
    const e1024 = pct(r?.nettete1024, v?.nettete_1024);
    const e800 = pct(r?.nettete800, v?.nettete_800);
    const eRapide = pct(r?.netteteRapide1024, v?.nettete_1024);
    if (ecartPhash !== undefined) ecarts.phash.push(ecartPhash);
    if (ecartRapide !== undefined) ecarts.phashRapide.push(ecartRapide);
    if (e1024 !== undefined) ecarts.n1024.push(Math.abs(e1024));
    if (e800 !== undefined) ecarts.n800.push(Math.abs(e800));
    if (eRapide !== undefined) ecarts.nRapide.push(Math.abs(eRapide));
    const fmtPct = (p?: number) => (p === undefined ? '' : ` (${p >= 0 ? '+' : ''}${nombre(p, 2)} %)`);

    ligne.append(
      ...[
        canevas,
        fichier.name,
        exif?.date ? `${exif.date}${exif.decalage ? ` ${exif.decalage}` : ''}` : '—',
        exif?.modele ?? '—',
        exif?.lat !== undefined ? `${exif.lat.toFixed(4)}, ${exif.lon?.toFixed(4)}` : '—',
        String(exif?.orientation ?? '—'),
        el('span', { classe: orientee === false ? 'echec' : 'ok' }, orientee === null ? '?' : orientee ? '✓' : '✗ couchée'),
        r?.nettete1024 !== undefined ? `${nombre(r.nettete1024, 1)}${fmtPct(e1024)}` : erreur,
        r?.nettete800 !== undefined ? `${nombre(r.nettete800, 1)}${fmtPct(e800)}` : '',
        ecartPhash !== undefined ? String(ecartPhash) : (r?.phash ?? ''),
        r?.netteteRapide1024 !== undefined ? `${nombre(r.netteteRapide1024, 1)}${fmtPct(eRapide)} / ${ecartRapide ?? r.phashRapide}` : '',
        `${nombre(ms)} ms`,
      ].map((c) => el('td', {}, c)),
    );
  });

  const totalMs = performance.now() - debutTotal;
  const max = (l: number[]) => (l.length ? Math.max(...l) : NaN);
  journal.ecrire(
    orientations.ko === 0 ? 'ok' : 'echec',
    `Orientation (I14) : ${orientations.ok} photos à l’endroit, ${orientations.ko} couchées, ${orientations.indetermine} indéterminées (carrées ou non JPEG) ; ${orientations.tournees} avaient une Orientation ≥ 5.`,
  );
  noter('c', 'orientation', orientations.ko === 0 ? 'ok' : 'echec', `Miniatures : ${orientations.ok} à l’endroit, ${orientations.ko} couchées, ${orientations.tournees} photos tournées par l’EXIF`, orientations);
  const avecExif = contexte.photosTest.filter((p) => p.exif?.date).length;
  const avecGps = contexte.photosTest.filter((p) => p.exif?.lat !== undefined).length;
  noter('c', 'exif', avecExif === fichiers.length ? 'ok' : 'avert', `EXIF : ${avecExif}/${fichiers.length} avec date, ${avecGps} avec GPS`);
  const moyennes = Object.fromEntries([...durees].map(([cle, l]) => [cle, Math.round(l.reduce((a, b) => a + b, 0) / l.length)]));
  if (ecarts.phash.length) {
    const texte = `Comparaison à Python sur ${ecarts.phash.length} photos : ressemblance fidèle ≤ ${max(ecarts.phash)} bit(s) (depuis 1024 px ≤ ${max(ecarts.phashDepuis1024)}, depuis 512 px ≤ ${max(ecarts.phashDepuis512)}, réduction directe ≤ ${max(ecarts.phashRapide)}), netteté fidèle ≤ ${nombre(max(ecarts.n1024), 2)} % à 1024 px et ${nombre(max(ecarts.n800), 2)} % à 800 px (rapide ≤ ${nombre(max(ecarts.nRapide), 1)} %).`;
    journal.ecrire(max(ecarts.phash) <= 2 ? 'ok' : 'echec', texte);
    noter('c', 'comparaison_python', max(ecarts.phash) <= 2 ? 'ok' : 'echec', texte, ecarts);
  }
  journal.info(`Durées moyennes par photo dans un worker (ms) : ${Object.entries(moyennes).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  noter('c', 'durees_par_variante', 'info', `Durées moyennes (ms) : ${JSON.stringify(moyennes)}`, moyennes);
  journal.ok(`${fichiers.length} photos traitées en ${nombre(totalMs)} ms avec ${groupe.taille} workers.`);
  noter('c', 'duree', 'info', `${fichiers.length} photos (EXIF, miniature, analyse fidèle + rapide) en ${nombre(totalMs)} ms`, { totalMs, workers: groupe.taille });
}
