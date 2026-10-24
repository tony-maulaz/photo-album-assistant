// Point h : 2000 miniatures (générées dans les workers, gardées dans le stockage
// privé du navigateur) et grille virtualisée : fluidité et mémoire.

import { listerMiniatures, lireMiniature, modeCache, viderMiniatures } from '../navigateur/cacheMiniatures';
import { enParallele } from '../navigateur/workers';
import { contexte } from './contexte';
import { bienOrientee } from './photos';
import { noter } from './resultats';
import { bouton, duree, el, memoire, nombre, section, taille, texteMemoire, type Journal } from './ui';

const HAUTEUR = 256;
const CASE = 168; // côté d'une case de la grille, en pixels
let cles: string[] = [];

export function monterGrille() {
  const { corps, journal } = section(
    'h',
    'h. Mesures : 2000 miniatures et grille',
    'Après l’inventaire (a) : générez les miniatures, affichez la grille, puis lancez le défilement automatique. Notez aussi la mémoire de l’onglet dans le gestionnaire de tâches du navigateur (Maj+Échap).',
  );
  const nombreMiniatures = el('input', { type: 'number', value: '2000', min: '10', classe: 'court' });
  const zone = el('div', { classe: 'grille', tabindex: '0' });
  const memoireOnglet = el('input', { type: 'number', min: '0', placeholder: 'Mo', classe: 'court' });
  memoireOnglet.addEventListener('change', () => {
    if (memoireOnglet.value) noter('h', 'memoire_onglet', 'info', `Mémoire de l’onglet relevée dans le gestionnaire de tâches : ${memoireOnglet.value} Mo`, Number(memoireOnglet.value));
  });

  corps.append(
    el(
      'div',
      { classe: 'actions' },
      el('label', {}, nombreMiniatures, ' miniatures'),
      bouton('Générer les miniatures', journal, () => generer(journal, Number(nombreMiniatures.value) || 2000), 'principal'),
      bouton('Afficher la grille', journal, () => afficher(journal, zone)),
      bouton('Défilement automatique (10 s)', journal, () => defiler(journal, zone)),
      bouton('Vider le cache des miniatures', journal, async () => {
        await viderMiniatures(await modeCache());
        cles = [];
        zone.replaceChildren();
        journal.ok('Cache des miniatures vidé.');
      }),
    ),
    el('div', { classe: 'actions' }, el('label', {}, 'Mémoire de l’onglet après le défilement (gestionnaire de tâches, Maj+Échap) : ', memoireOnglet)),
    zone,
  );
}

async function generer(journal: Journal, n: number) {
  // Photos du dossier inventorié (a), sinon photos choisies au point c.
  const photos: { obtenir: () => Promise<File>; orientation?: number }[] = (contexte.inventaire ?? [])
    .filter((e) => e.categorie === 'photo' && /\.(jpe?g|png|webp)$/i.test(e.nom))
    .map((e) => ({ obtenir: () => e.poignee.getFile(), orientation: e.exif?.orientation }));
  if (!photos.length) photos.push(...contexte.photosTest.map((p) => ({ obtenir: async () => p.fichier, orientation: p.exif?.orientation })));
  if (!photos.length) throw new Error('Lancez d’abord l’inventaire (a), ou choisissez des photos au point c.');
  const choix = photos.slice(0, n);
  const groupe = contexte.groupe();
  const stockage = await modeCache();
  const progression = journal.info(
    `Génération de ${choix.length} miniatures (${groupe.taille} workers, cache : ${stockage === 'opfs' ? 'stockage privé OPFS' : 'IndexedDB'})…`,
  );
  const memoireDebut = memoire();
  const cumul = { decodage: 0, encodage: 0, ecriture: 0, octets: 0 };
  let couchees = 0;
  let faites = 0;
  const t0 = performance.now();
  cles = await enParallele(choix, groupe.taille * 2, async (p, i) => {
    const cle = `${String(i).padStart(5, '0')}.jpg`;
    const fichier = await p.obtenir();
    const r = await groupe.miniature(fichier, HAUTEUR, cle, stockage);
    cumul.decodage += r.durees.decodage;
    cumul.encodage += r.durees.encodage;
    cumul.ecriture += r.durees.ecriture;
    cumul.octets += r.octets;
    // Une photo tournée par l'EXIF doit sortir dans le bon format (I14).
    if ((await bienOrientee(fichier, p.orientation, r.largeur, r.hauteur)) === false) couchees++;
    if (++faites % 50 === 0) progression.lastChild!.textContent = `${faites} / ${choix.length} miniatures…`;
    return cle;
  });
  const ms = performance.now() - t0;
  const estimation = await navigator.storage.estimate();
  const texte = `${choix.length} miniatures en ${duree(ms)} (${nombre(ms / choix.length, 1)} ms par photo ; par worker : décodage ${nombre(cumul.decodage / choix.length)} ms, encodage ${nombre(cumul.encodage / choix.length)} ms, écriture ${nombre(cumul.ecriture / choix.length)} ms) ; ${taille(cumul.octets)} dans ${stockage === 'opfs' ? 'le stockage privé (OPFS)' : 'IndexedDB'} (${taille(cumul.octets / choix.length)} par miniature).`;
  journal.ok(texte);
  if (couchees) journal.echec(`${couchees} miniature(s) couchée(s) malgré l’EXIF (I14).`);
  noter('h', 'miniatures', couchees ? 'echec' : 'ok', texte, {
    n: choix.length,
    stockage,
    ms,
    octets: cumul.octets,
    couchees,
    stockageUtilise: estimation.usage,
    memoire: { debut: memoireDebut, fin: memoire() },
  });
}

async function afficher(journal: Journal, zone: HTMLElement) {
  const stockage = await modeCache();
  // Miniatures déjà présentes d'une session précédente ?
  if (!cles.length) cles = await listerMiniatures(stockage);
  if (!cles.length) throw new Error('Générez d’abord les miniatures.');
  const t0 = performance.now();
  const colonnes = Math.max(1, Math.floor(zone.clientWidth / CASE));
  const lignes = Math.ceil(cles.length / colonnes);
  const plateau = el('div', { classe: 'plateau', style: `height:${lignes * CASE}px` });
  zone.replaceChildren(plateau);
  const visibles = new Map<number, HTMLImageElement>();

  // Grille virtualisée : seules les cases visibles (plus une marge) existent.
  const rafraichir = () => {
    const debut = Math.max(0, Math.floor(zone.scrollTop / CASE) - 2) * colonnes;
    const fin = Math.min(cles.length, Math.ceil((zone.scrollTop + zone.clientHeight) / CASE + 2) * colonnes);
    for (const [i, img] of visibles) {
      if (i < debut || i >= fin) {
        URL.revokeObjectURL(img.src);
        img.remove();
        visibles.delete(i);
      }
    }
    for (let i = debut; i < fin; i++) {
      if (visibles.has(i)) continue;
      const img = el('img', {
        classe: 'case',
        alt: '',
        style: `top:${Math.floor(i / colonnes) * CASE}px;left:${(i % colonnes) * CASE}px`,
      });
      visibles.set(i, img);
      plateau.appendChild(img);
      void lireMiniature(stockage, cles[i]).then((f) => {
        if (f && visibles.get(i) === img) img.src = URL.createObjectURL(f);
      });
    }
  };
  zone.onscroll = () => requestAnimationFrame(rafraichir);
  rafraichir();
  journal.ok(`Grille de ${nombre(cles.length)} miniatures (${colonnes} colonnes) affichée en ${duree(performance.now() - t0)}. Mémoire : ${texteMemoire()}.`);
}

async function defiler(journal: Journal, zone: HTMLElement) {
  if (!zone.firstChild) throw new Error('Affichez d’abord la grille.');
  const memoireDebut = memoire();
  const total = zone.scrollHeight - zone.clientHeight;
  const dureeMs = 10_000;
  const images: number[] = [];
  await new Promise<void>((fini) => {
    const debut = performance.now();
    let precedent = debut;
    const pas = (t: number) => {
      images.push(t - precedent);
      precedent = t;
      const avance = Math.min(1, (t - debut) / dureeMs);
      zone.scrollTop = avance * total;
      if (avance < 1) requestAnimationFrame(pas);
      else fini();
    };
    requestAnimationFrame(pas);
  });
  images.shift();
  const moyenne = images.reduce((s, v) => s + v, 0) / images.length;
  const lentes = images.filter((v) => v > 50).length;
  const pire = Math.max(...images);
  const ips = 1000 / moyenne;
  const texte = `Défilement de toute la grille en 10 s : ${nombre(ips)} images/s en moyenne, ${lentes} image(s) de plus de 50 ms, pire ${nombre(pire)} ms. Mémoire : ${texteMemoire()}.`;
  journal.ecrire(ips >= 30 && lentes < 10 ? 'ok' : 'avert', texte);
  noter('h', 'grille_defilement', ips >= 30 && lentes < 10 ? 'ok' : 'avert', texte, { ips, lentes, pire, memoire: { debut: memoireDebut, fin: memoire() } });
}
