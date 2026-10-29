// Captures d'écran de toute l'application, pour une revue de l'interface
// (convivialité, cohérence des pages) : parcours « Trier un nouveau dossier »
// des 13 étapes dans Chromium sans affichage, chaque page en 1440×900 (écran
// visible et pleine page) et en 1280×720, plus les états intéressants
// (dialogues, visionneuse, Tri rapide, recadrage, propositions de l'IA…).
//
// Le script construit lui-même un build figé de l'application (vite build,
// aucun serveur de développement), le sert en statique sur un port libre et
// copie le dossier de photos dans le stockage privé du navigateur :
// DOSSIER_PHOTOS n'est jamais modifié. OpenStreetMap et l'API Claude sont
// simulés (aucun appel réseau, aucune clé).
//
// Usage (depuis app/) :
//   node outils/captures_ux.mjs DOSSIER_PHOTOS DOSSIER_CAPTURES [--etapes 7,11]
//
//   --etapes 7,11  ne capture que ces étapes (0 = accueil et configuration) ;
//                  le parcours passe quand même par les étapes précédentes
//                  (chacune dépend de la précédente) et s'arrête après la
//                  dernière demandée, sauf si 0 ou 1 est demandé (l'accueil
//                  et la page du projet existant sont repris à la fin).
//
// Résultat dans DOSSIER_CAPTURES : les captures (PNG), INDEX.md (liste
// commentée), mesures.json (position du bouton d'aide, du curseur de taille,
// des boutons « Annuler » et du bouton principal sur chaque page, plus
// quelques mesures propres au Nommage et à la Sélection), erreurs_console.json,
// et le build capturé dans .build/.
//
// Contenu ajouté pour que toutes les étapes aient quelque chose à montrer,
// seulement dans la copie du stockage privé : les 8 premières photos (ordre
// des chemins) sont dupliquées dans « Copies/ » (copies exactes de l'étape
// Doublons) et les 10 suivantes déplacées dans « Sous_dossier/ » (étape
// Dossiers). Configuration : modèle config.exemple/ du dépôt, avec un
// calendrier simulé « Vacances » couvrant les dates des photos (lues dans
// leurs données EXIF ; pas de calendrier si aucune date).
//
// Variables d'environnement facultatives :
//   POLICES_EMOJI=dossier  dossier de polices (par exemple une police d'emoji
//                          en couleur) rendu visible à Chromium par fontconfig :
//                          sans police d'emoji, 📅 📍 ✨ s'affichent en carrés.
//   APP_DIR=dossier        dossier app/ à utiliser, si le script est lancé
//                          depuis ailleurs que app/outils/.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(process.env.APP_DIR ?? fileURLToPath(new URL('..', import.meta.url)));

// ---------- Arguments ----------

const USAGE = `Usage (depuis app/) : node outils/captures_ux.mjs DOSSIER_PHOTOS DOSSIER_CAPTURES [--etapes 7,11]
  DOSSIER_PHOTOS    dossier de photos à parcourir (lu seulement, jamais modifié)
  DOSSIER_CAPTURES  dossier où écrire les captures, INDEX.md et mesures.json
  --etapes 7,11     ne capturer que ces étapes (0 = accueil et configuration)`;
const positionnels = [];
let ETAPES = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--etapes' || a.startsWith('--etapes=')) {
    const liste = a === '--etapes' ? process.argv[++i] : a.slice('--etapes='.length);
    ETAPES = new Set(String(liste ?? '').split(',').filter(Boolean).map(Number));
    if (!ETAPES.size || [...ETAPES].some((n) => !Number.isInteger(n) || n < 0 || n > 13)) {
      console.error(`Étapes invalides : « ${liste} » (nombres de 0 à 13 séparés par des virgules).\n\n${USAGE}`);
      process.exit(1);
    }
  } else if (a === '-h' || a === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else positionnels.push(a);
}
const [argPhotos, argCaptures] = positionnels;
if (!argPhotos || !argCaptures || positionnels.length > 2) {
  console.error(USAGE);
  process.exit(1);
}
const PHOTOS = resolve(argPhotos);
const SP = resolve(argCaptures);
if (!existsSync(PHOTOS) || !statSync(PHOTOS).isDirectory()) {
  console.error(`Dossier de photos introuvable : ${PHOTOS}\n\n${USAGE}`);
  process.exit(1);
}
const dedans = relative(PHOTOS, SP);
if (!dedans || (!dedans.startsWith('..') && !isAbsolute(dedans))) {
  console.error('Le dossier des captures doit être hors du dossier de photos (celui-ci n’est jamais modifié).');
  process.exit(1);
}
// Bibliothèques de app/ (Playwright, exifr), chargées après la vérification des arguments.
const require = createRequire(join(APP, 'package.json'));
const { chromium } = require('playwright');
const exifr = require('exifr');
// Sans liste : tout capturer. Avec une liste : arrêt après la dernière étape demandée, sauf si 0 ou 1 en fait partie.
const DERNIERE = !ETAPES || ETAPES.has(0) || ETAPES.has(1) ? 99 : Math.max(...ETAPES);

// Chromium : bibliothèques système installées à part sous WSL (sans droits d'administrateur).
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES) ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : { ...process.env };

const t0 = performance.now();
const duree = (debut) => `${((performance.now() - debut) / 1000).toFixed(0)} s`;
const noter = (texte) => console.log(`[${duree(t0)}] ${texte}`);

// Dossier temporaire : profil Chromium (persistant : un contexte éphémère a un quota de stockage trop petit) et polices.
const TEMP = mkdtempSync(join(tmpdir(), 'album-captures-'));
const PROFIL = join(TEMP, 'profil');
if (process.env.POLICES_EMOJI) {
  const polices = resolve(process.env.POLICES_EMOJI);
  if (existsSync(polices)) {
    const conf = join(TEMP, 'fonts.conf');
    writeFileSync(
      conf,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n  <dir>${polices}</dir>\n  <cachedir>${join(TEMP, 'cache-polices')}</cachedir>\n</fontconfig>\n`,
    );
    env.FONTCONFIG_FILE = conf;
  } else console.warn(`POLICES_EMOJI : dossier introuvable (${polices}), polices du système seulement.`);
}

// ---------- Build figé ----------

const BUILD = join(SP, '.build');
mkdirSync(SP, { recursive: true });
noter('construction de l’application (vite build)…');
await new Promise((ok, echec) => {
  const vite = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'warn'], { cwd: APP, stdio: ['ignore', 'inherit', 'inherit'] });
  vite.on('error', echec);
  vite.on('exit', (code) => (code === 0 ? ok() : echec(new Error(`vite build a échoué (code ${code})`))));
});
const html = readFileSync(join(BUILD, 'album-photos.html'));
const serveur = createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/album-photos.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const ADRESSE = `http://localhost:${serveur.address().port}/album-photos.html`;
noter(`build servi sur ${ADRESSE}`);

// ---------- Inventaire du dossier de photos (lecture seule) ----------

const EST_PHOTO = /\.(jpe?g|heic|heif|png|webp|tiff?)$/i;
const fichiersSource = [];
const parcourir = (dossier) => {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) parcourir(chemin);
    else if (e.isFile()) fichiersSource.push(relative(PHOTOS, chemin).split(sep).join('/'));
  }
};
parcourir(PHOTOS);
const photosSource = fichiersSource.filter((f) => EST_PHOTO.test(f)).sort();
const COPIES = photosSource.slice(0, 8);
const DEPLACEES = photosSource.slice(8, 18);

// Plage de dates des photos (EXIF), pour le calendrier simulé.
let premiere = null;
let derniere = null;
for (const f of photosSource) {
  const d = await exifr.parse(join(PHOTOS, f), { pick: ['DateTimeOriginal', 'CreateDate'] }).catch(() => null);
  const date = d?.DateTimeOriginal ?? d?.CreateDate;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) continue;
  if (!premiere || date < premiere) premiere = date;
  if (!derniere || date > derniere) derniere = date;
}
const jour = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const ICS = premiere
  ? [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Album photos//Captures//FR',
      'BEGIN:VEVENT',
      'UID:vacances@captures',
      `DTSTART;VALUE=DATE:${jour(premiere)}`,
      `DTEND;VALUE=DATE:${jour(new Date(derniere.getFullYear(), derniere.getMonth(), derniere.getDate() + 1))}`,
      'SUMMARY:Vacances',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
  : null;
noter(`${fichiersSource.length} fichiers dont ${photosSource.length} photos ; ${premiere ? `dates du ${premiere.toLocaleDateString('fr-CH')} au ${derniere.toLocaleDateString('fr-CH')}` : 'aucune date EXIF : pas de calendrier'}`);

// Configuration : modèle anonyme du dépôt ; le calendrier simulé remplace ceux du modèle.
const MODELE = join(APP, '..', 'config.exemple', 'config.json');
const config = existsSync(MODELE) ? JSON.parse(readFileSync(MODELE, 'utf8')) : null;
const FICHIER_ICS = 'calendriers/vacances.ics';
if (config) config.calendriers = ICS ? [{ fichier: FICHIER_ICS, nom: 'Vacances', actif: true, inclure_recurrents: false }] : [];

// Noms des dossiers simulés, tirés du dossier de photos (au lieu de « selecteur_source »).
const NOMS = { source: basename(PHOTOS), sortie: `${basename(PHOTOS)}_trie`, config: 'config' };

// ---------- OpenStreetMap simulé ----------

// Grandes villes du monde : nom de la plus proche à moins de 25 km, sinon un nom tiré des coordonnées arrondies.
const VILLES = [
  ['Paris', 'France', 48.86, 2.35],
  ['Lyon', 'France', 45.76, 4.84],
  ['Marseille', 'France', 43.3, 5.37],
  ['Londres', 'Royaume-Uni', 51.51, -0.13],
  ['Bruxelles', 'Belgique', 50.85, 4.35],
  ['Amsterdam', 'Pays-Bas', 52.37, 4.9],
  ['Berlin', 'Allemagne', 52.52, 13.4],
  ['Zurich', 'Suisse', 47.37, 8.54],
  ['Milan', 'Italie', 45.46, 9.19],
  ['Rome', 'Italie', 41.9, 12.5],
  ['Vienne', 'Autriche', 48.21, 16.37],
  ['Madrid', 'Espagne', 40.42, -3.7],
  ['Barcelone', 'Espagne', 41.39, 2.17],
  ['Lisbonne', 'Portugal', 38.72, -9.14],
  ['Istanbul', 'Turquie', 41.01, 28.98],
  ['Le Caire', 'Égypte', 30.04, 31.24],
  ['Nairobi', 'Kenya', -1.29, 36.82],
  ['Le Cap', 'Afrique du Sud', -33.92, 18.42],
  ['Dubaï', 'Émirats arabes unis', 25.2, 55.27],
  ['Mumbai', 'Inde', 19.08, 72.88],
  ['Singapour', 'Singapour', 1.35, 103.82],
  ['Hong Kong', 'Chine', 22.32, 114.17],
  ['Tokyo', 'Japon', 35.68, 139.69],
  ['Sydney', 'Australie', -33.87, 151.21],
  ['New York', 'États-Unis', 40.71, -74.01],
  ['Los Angeles', 'États-Unis', 34.05, -118.24],
  ['Montréal', 'Canada', 45.5, -73.57],
  ['Mexico', 'Mexique', 19.43, -99.13],
  ['Rio de Janeiro', 'Brésil', -22.91, -43.17],
  ['Buenos Aires', 'Argentine', -34.6, -58.38],
];
const km = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};
function lieuSimule(lat, lon) {
  const [ville, pays, la, lo] = VILLES.reduce((m, v) => (km(lat, lon, v[2], v[3]) < km(lat, lon, m[2], m[3]) ? v : m));
  const distance = km(lat, lon, la, lo);
  if (distance < 25) return { nom: ville, pays };
  return { nom: `Lieu ${lat.toFixed(1)} ${lon.toFixed(1)}`, pays: distance < 500 ? pays : null };
}

// ---------- Captures et mesures ----------

const index = [];
const mesures = { genere_le: new Date().toISOString(), viewports: ['1440x900', '1280x720'], etapes: ETAPES ? [...ETAPES].sort((a, b) => a - b) : 'toutes', pages: {} };
const erreurs = [];
const manques = [];
let pageCourante = 'démarrage';
let etape = 0;
const actif = () => !ETAPES || ETAPES.has(etape);
const FIN = 'FIN_PARCOURS';
/** Entre dans une étape du parcours ; au-delà de la dernière étape demandée, le parcours s'arrête. */
const entrer = (n) => {
  if (n > DERNIERE) throw new Error(FIN);
  etape = n;
};

const navigateur = await chromium.launchPersistentContext(PROFIL, { env, viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
const page = navigateur.pages()[0] ?? (await navigateur.newPage());
page.setDefaultTimeout(30_000);
page.on('pageerror', (e) => erreurs.push({ page: pageCourante, type: 'pageerror', texte: e.message }));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && erreurs.push({ page: pageCourante, type: m.type(), texte: m.text() }));

async function mesurer() {
  return page.evaluate(() => {
    const boite = (e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), largeur: Math.round(r.width), hauteur: Math.round(r.height) };
    };
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const classeParent = (e) => e.parentElement?.className || e.parentElement?.tagName || null;
    const aides = [...document.querySelectorAll('.bouton-aide')]
      .filter(visible)
      .map((e) => ({ texte: e.innerText.trim(), title: e.title || null, aria_expanded: e.getAttribute('aria-expanded'), parent: classeParent(e), ...boite(e) }));
    const curseurs = [...document.querySelectorAll('input[type=range]')].filter(visible).map((e) => {
      const l = e.closest('label');
      return {
        libelle: e.getAttribute('aria-label') || l?.title || l?.innerText.trim() || '',
        avec_loupe: !!l?.querySelector('svg'),
        parent: l?.parentElement?.className || null,
        ...boite(e),
        boite_libelle: l ? boite(l) : null,
      };
    });
    const loupes = curseurs.filter((c) => c.avec_loupe || /Taille/.test(c.libelle));
    const bouton = (b) => ({ texte: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 80), title: b.title || null, desactive: b.disabled, parent: classeParent(b), ...boite(b) });
    const annuler = [...document.querySelectorAll('button')].filter(visible).filter((b) => /^\W*Annuler\b/.test(b.innerText.trim()));
    const principaux = [...document.querySelectorAll('button.principal')].filter(visible);
    const titres = [...document.querySelectorAll('h1')].filter(visible).map((h) => ({ texte: h.innerText.replace(/\s+/g, ' ').trim(), ...boite(h) }));
    const teteVue = document.querySelector('.tete-vue');
    // Plus grand conteneur qui défile à l'intérieur de la page.
    let interne = null;
    for (const e of document.querySelectorAll('body *')) {
      const d = e.scrollHeight - e.clientHeight;
      const st = getComputedStyle(e).overflowY;
      if (d > 20 && (st === 'auto' || st === 'scroll') && (!interne || d > interne.depasse)) interne = { classe: e.className, depasse: d, hauteur_contenu: e.scrollHeight, hauteur_visible: e.clientHeight };
    }
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      hauteur_document: document.scrollingElement.scrollHeight,
      defilement_interne: interne,
      titres_h1: titres,
      tete_vue: teteVue ? { texte: teteVue.innerText.replace(/\s+/g, ' ').trim().slice(0, 200), ...boite(teteVue) } : null,
      bouton_aide: aides.length ? aides : null,
      curseur_miniatures: loupes.length ? loupes : null,
      autres_curseurs: curseurs.filter((c) => !loupes.includes(c)),
      bouton_annuler: annuler.length ? annuler.map(bouton) : null,
      bouton_principal: principaux.length ? principaux.map(bouton) : null,
    };
  });
}

const attendre = (ms) => page.waitForTimeout(ms);

async function retailler(l, h) {
  await page.setViewportSize({ width: l, height: h });
  await attendre(500);
}

/**
 * Pleine page : la page elle-même ne défile pas (le contenu défile dans <main> ou dans la grille) ;
 * on agrandit donc la fenêtre à la hauteur du contenu (au plus 5000 px), le temps de la capture.
 */
async function pleinePage(fichier, m) {
  const d = m.defilement_interne;
  if (m.hauteur_document > 902 || !d) {
    await page.screenshot({ path: join(SP, fichier), fullPage: true });
    return m.hauteur_document > 902 ? 'pleine page' : 'pleine page (tout tient dans l’écran)';
  }
  const h = Math.min(900 + d.depasse + 20, 5000);
  await retailler(1440, h);
  await attendre(1200);
  await page.screenshot({ path: join(SP, fichier) });
  await retailler(1440, 900);
  return `fenêtre agrandie à 1440×${h} : contenu qui défile à l’intérieur de la page${900 + d.depasse + 20 > 5000 ? ', coupé à 5000 px' : ''}`;
}

/** Capture d'un élément entier, fenêtre agrandie au besoin. */
async function capturerElement(selecteur, fichier) {
  const m = await mesurer();
  const d = m.defilement_interne;
  const h = d ? Math.min(900 + d.depasse + 20, 5000) : 900;
  if (h > 900) await retailler(1440, h);
  await attendre(800);
  await page.locator(selecteur).first().screenshot({ path: join(SP, fichier) });
  if (h > 900) await retailler(1440, 900);
}

/** Écran visible 1440 + pleine page 1440 + écran visible 1280, avec mesures. */
async function capturer(nom, description, { pleine = true, petit = true } = {}) {
  if (!actif()) return;
  pageCourante = nom;
  await attendre(600);
  const m = {};
  await page.screenshot({ path: join(SP, `${nom}_1440.png`) });
  index.push([`${nom}_1440.png`, `${description} (écran visible 1440×900)`]);
  m['1440x900'] = await mesurer();
  if (pleine) {
    const remarque = await pleinePage(`${nom}_1440_pleine.png`, m['1440x900']);
    index.push([`${nom}_1440_pleine.png`, `${description} (${remarque})`]);
  }
  if (petit) {
    await retailler(1280, 720);
    await page.screenshot({ path: join(SP, `${nom}_1280.png`) });
    index.push([`${nom}_1280.png`, `${description} (écran visible 1280×720)`]);
    m['1280x720'] = await mesurer();
    await retailler(1440, 900);
  }
  mesures.pages[nom] = { description, ...m };
  noter(`capturé : ${nom}`);
}

/** État supplémentaire : écran 1440 seulement (et pleine page si demandé), ou un seul élément. */
async function etat(nom, description, { pleine = false, element = null } = {}) {
  if (!actif()) return;
  pageCourante = nom;
  await attendre(500);
  const m = await mesurer();
  if (element) {
    try {
      await capturerElement(element, `${nom}.png`);
      index.push([`${nom}.png`, `${description} (capture de l’élément ${element})`]);
    } catch (e) {
      manques.push({ nom, raison: `élément ${element} : ${e.message.split('\n')[0]}` });
      await retailler(1440, 900);
    }
  } else {
    await page.screenshot({ path: join(SP, `${nom}_1440.png`) });
    index.push([`${nom}_1440.png`, `${description} (écran visible 1440×900)`]);
    if (pleine) {
      const remarque = await pleinePage(`${nom}_1440_pleine.png`, m);
      index.push([`${nom}_1440_pleine.png`, `${description} (${remarque})`]);
    }
  }
  mesures.pages[nom] = { description, '1440x900': m };
  noter(`capturé : ${nom}`);
}

/** Capture brute (sans mesures), seulement si l'étape courante est demandée. */
async function cliche(fichier, description, cible = page) {
  if (!actif()) return;
  await cible.screenshot({ path: join(SP, fichier) });
  index.push([fichier, description]);
}

/** Exécute le bloc d'une étape ; en cas d'échec, note le manque et continue. */
async function essayer(n, nom, bloc) {
  entrer(n);
  try {
    await bloc();
  } catch (e) {
    manques.push({ nom, raison: e.message.split('\n')[0] });
    noter(`ÉCHEC ${nom} : ${e.message.split('\n')[0]}`);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.screenshot({ path: join(SP, `zz_echec_${nom}.png`) }).catch(() => undefined);
    // Passer à l'étape suivante pour que la suite du parcours reste capturée.
    await page.locator('[data-action=valider]').click({ timeout: 3000 }).catch(() => undefined);
  }
}

const valider = () => page.locator('[data-action=valider]').click();
const allerEtape = async (re) => {
  await page.locator('.bandeau .etape', { hasText: re }).first().click();
  await attendre(800);
};
const CLE_FACTICE = 'sk-ant-captures-factice';

try {
  // ---------- Réseau simulé ----------
  await navigateur.route('https://nominatim.openstreetmap.org/**', async (route) => {
    const u = new URL(route.request().url());
    const { nom, pays } = lieuSimule(Number(u.searchParams.get('lat')), Number(u.searchParams.get('lon')));
    const address = pays ? { town: nom, country: pays } : { town: nom };
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ address, display_name: [nom, pays].filter(Boolean).join(', ') }) });
  });
  // API Claude simulée : une réponse plausible selon la consigne (Nommage, Consolidation, petits dossiers).
  const THEMES = ['Balade', 'Visite', 'Plage', 'Repas', 'Excursion', 'Musee', 'Marche', 'Spectacle'];
  let appelsIA = 0;
  const entetes = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await navigateur.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: entetes });
    const corps = req.postDataJSON();
    const texte = corps.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    appelsIA++;
    let reponse = {};
    if (texte.includes('"fusions"')) {
      // Une fusion par répertoire : les deux premiers dossiers de la liste.
      const noms = [...texte.matchAll(/^- (\S+) {2}\(/gm)].map((m) => m[1]);
      reponse = { fusions: noms.length >= 2 ? [{ cible: noms[0], sources: [noms[1]], raison: 'Même sortie, le même jour, à deux endroits voisins (réponse simulée).' }] : [], renommages: [] };
    } else if (texte.includes('"absorber"')) reponse = { absorber: false, cible: '', nom_propose: '', confiance: 6, raison: 'scène différente' };
    else if (texte.includes('Theme_Lieu')) {
      const md = (texte.match(/Date : ([^\n]+)/)?.[1] ?? '').match(/(\d\d)\.(\d\d)\.\d\d(\d\d)/);
      const lieu = (texte.match(/Lieu détecté par GPS : ([^\n]+)/)?.[1] ?? '').split(',')[0].trim().replace(/\s+/g, '_') || 'Sortie';
      const nom = [THEMES[appelsIA % THEMES.length], lieu, md && `${md[1]}.${md[2]}.${md[3]}`].filter(Boolean).join('_');
      reponse = { monuments: [], nom, activite: 'visite', confiance: 5 + (appelsIA % 5), justification: 'photos de visite et de paysages, cohérentes avec le lieu' };
    }
    await route.fulfill({
      status: 200,
      headers: { ...entetes, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'msg_captures', type: 'message', role: 'assistant', model: corps.model, content: [{ type: 'text', text: JSON.stringify(reponse) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 300 } }),
    });
  });

  // Sélecteur de dossier simulé : un dossier du stockage privé, au nom réaliste.
  await page.addInitScript((noms) => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(noms[o?.id] ?? `selecteur_${o?.id ?? 'x'}`, { create: true });
  }, NOMS);
  await page.goto(ADRESSE);
  await attendre(1500);

  // ---------- Copie du dossier de photos dans le stockage privé ----------
  let debut = performance.now();
  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.webkitdirectory = true;
    c.id = 'dossier-captures';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#dossier-captures', PHOTOS);
  const copie = await page.evaluate(
    async ({ NOMS, COPIES, DEPLACEES }) => {
      const racine = await navigator.storage.getDirectory();
      const source = await racine.getDirectoryHandle(NOMS.source, { create: true });
      await racine.getDirectoryHandle(NOMS.sortie, { create: true });
      const ecrire = async (chemin, contenu) => {
        const parties = chemin.split('/');
        let d = source;
        for (const p of parties.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
        const w = await (await d.getFileHandle(parties.at(-1), { create: true })).createWritable();
        await w.write(contenu);
        await w.close();
      };
      const copies = new Set(COPIES);
      const deplacees = new Set(DEPLACEES);
      const fichiers = [...document.getElementById('dossier-captures').files];
      for (const f of fichiers) {
        const chemin = f.webkitRelativePath.split('/').slice(1).join('/');
        // « Sous_dossier/ » : un sous-dossier pour l'étape Dossiers ; « Copies/ » : des copies exactes pour l'étape Doublons.
        await ecrire(deplacees.has(chemin) ? `Sous_dossier/${chemin}` : chemin, f);
        if (copies.has(chemin)) await ecrire(`Copies/${chemin}`, f);
      }
      return fichiers.length;
    },
    { NOMS, COPIES, DEPLACEES },
  );
  if (config) {
    await page.evaluate(
      async ({ NOMS, texte, ics, fichierIcs }) => {
        const ecrire = async (dossier, chemin, contenu) => {
          const parties = chemin.split('/');
          let d = dossier;
          for (const p of parties.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
          const w = await (await d.getFileHandle(parties.at(-1), { create: true })).createWritable();
          await w.write(contenu);
          await w.close();
        };
        const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(NOMS.config, { create: true });
        await ecrire(d, 'config.json', texte);
        if (ics) await ecrire(d, fichierIcs, ics);
      },
      { NOMS, texte: JSON.stringify(config, null, 2), ics: ICS, fichierIcs: FICHIER_ICS },
    );
  }
  noter(`dossier copié dans le stockage privé : ${copie} fichiers, + ${COPIES.length} dans Copies/, ${DEPLACEES.length} déplacés dans Sous_dossier/ (${duree(debut)})`);
  await page.reload();
  await attendre(1500);

  // ---------- Accueil ----------
  entrer(0);
  await capturer('00_accueil', 'Accueil, aucun projet');

  // ---------- Configuration (menu) ----------
  if (config) {
    await essayer(0, '01_configuration', async () => {
      await page.locator('.bouton-menu').click();
      await page.getByRole('menuitem', { name: 'Configuration' }).click();
      await page.getByRole('button', { name: 'Choisir le dossier config…' }).click();
      await page.getByText(/Calendriers/).first().waitFor();
      await capturer('01_configuration', `Configuration (modèle config.exemple choisi${ICS ? ', calendrier « Vacances » simulé' : ''})`);
    });
  } else manques.push({ nom: '01_configuration', raison: 'config.exemple/config.json introuvable' });

  // ---------- Étape 1 : Projet ----------
  entrer(1);
  await page.goto(ADRESSE);
  await attendre(1000);
  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).click();
  await capturer('02_etape01_projet_vide', 'Étape 1 Projet : nouveau projet, juste après « Trier un nouveau dossier » de l’accueil');
  const choisir = page.getByRole('button', { name: 'Choisir…' });
  await choisir.nth(0).click();
  await page.getByText(`« ${NOMS.source} »`).first().waitFor();
  await choisir.nth(1).click();
  await page.getByText(`« ${NOMS.sortie} »`).first().waitFor();
  await page.fill('#nom-projet', 'Album de démonstration');
  await capturer('03_etape01_projet_rempli', 'Étape 1 Projet : dossiers choisis, nom saisi, avant « Créer le projet »');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  // ---------- Étape 2 : Inventaire ----------
  entrer(2);
  debut = performance.now();
  await page.locator('[data-action=valider]').waitFor({ timeout: 120_000 });
  await attendre(1500);
  await etat('04_etape02_inventaire_analyse_en_cours', 'Étape 2 Inventaire : analyse locale en cours');
  await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 1_800_000 });
  noter(`analyse terminée (${duree(debut)})`);
  await capturer('05_etape02_inventaire', 'Étape 2 Inventaire : analyse terminée');
  await valider();

  // ---------- Étape 3 : Dossiers ----------
  await essayer(3, '06_etape03_dossiers', async () => {
    await page.locator('main[data-etape=dossiers]').first().waitFor();
    await capturer('06_etape03_dossiers', 'Étape 3 Dossiers : que faire des sous-dossiers');
    await page.locator('.sous-dossiers tr.ligne-sous-dossier', { hasText: 'Sous_dossier' }).getByRole('radio', { name: 'Trier' }).click();
    await page.locator('.sous-dossiers tr.ligne-sous-dossier', { hasText: 'Copies' }).locator('.nom-sous-dossier').click();
    await page.waitForFunction(() => document.querySelectorAll('.photos-ligne img').length > 0, null, { timeout: 20_000 }).catch(() => undefined);
    await etat('07_etape03_dossiers_ligne_ouverte', 'Étape 3 Dossiers : « Sous_dossier » mis à trier, ligne « Copies » ouverte (ses photos)', { pleine: true });
    await valider();
  });

  // ---------- Étape 4 : Floues ----------
  await essayer(4, '08_etape04_floues', async () => {
    await page.locator('main[data-etape=floues]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('img').length > 3, null, { timeout: 20_000 }).catch(() => undefined);
    await capturer('08_etape04_floues', 'Étape 4 Photos floues');
    await valider();
  });

  // ---------- Étape 5 : Doublons ----------
  await essayer(5, '09_etape05_doublons', async () => {
    await page.locator('main[data-etape=doublons]').waitFor();
    await page.locator('.carte-doublons, .encart').first().waitFor({ timeout: 120_000 });
    await attendre(1500);
    await capturer('09_etape05_doublons', 'Étape 5 Doublons : onglet d’arrivée (copies exactes)');
    await page.locator('.onglet-doublons', { hasText: 'Rafales' }).click();
    await page.locator('.carte-doublons, .encart:has-text("Aucune rafale")').first().waitFor({ timeout: 300_000 });
    await attendre(1500);
    await etat('10_etape05_doublons_rafales', 'Étape 5 Doublons : onglet Rafales', { pleine: true });
    await page.locator('.onglet-doublons', { hasText: 'Copies exactes' }).click();
    // Lot 4 : ce qui touche tout l'onglet est dans le menu « Toutes les copies ▾ » de la barre d'outils.
    const menuCopies = page.locator('.rangee-onglet .bouton-portee');
    if (await menuCopies.count()) {
      await menuCopies.click();
      const accepter = page.locator('.rangee-onglet').getByRole('menuitem', { name: /^Accepter (les \d+ propositions|la proposition)/ });
      if (await accepter.count()) await accepter.click();
    }
    await valider();
  });

  // ---------- Étape 6 : Tri automatique ----------
  await essayer(6, '11_etape06_tri', async () => {
    await page.locator('main[data-etape=tri]').waitFor();
    await page.getByText('Recherche de l’adresse…').first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined);
    await attendre(2000);
    await capturer('11_etape06_tri_avant', 'Étape 6 Tri automatique : avant de ranger (aperçu, réglages)');
    const copies = page.locator('.copies-avant-tri').getByRole('button', { name: /^Mettre \d+ copies? de côté/ });
    if (await copies.count()) await copies.click();
    await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger les photos', exact: true }).click();
    await page.locator('.ligne-ranger.fait').waitFor({ timeout: 600_000 });
    await attendre(2000);
    await capturer('12_etape06_tri_range', 'Étape 6 Tri automatique : photos rangées, résultat à droite');
    const onglet = page.locator('.resultat-tri .onglet-doublons').nth(1);
    if (await onglet.count()) {
      await onglet.click();
      await etat('13_etape06_tri_onglet2', `Étape 6 Tri automatique : second onglet du résultat (« ${(await onglet.innerText()).replace(/\s+/g, ' ')} »)`);
      await page.locator('.resultat-tri .onglet-doublons').first().click();
    }
    const ligne = page.locator('.resultat-tri .ligne-tri').first();
    if (await ligne.count()) {
      await ligne.click();
      await attendre(1500);
      await etat('14_etape06_tri_ligne_cliquee', 'Étape 6 Tri automatique : clic sur la première ligne du résultat', { pleine: true });
    }
    await valider();
  });

  // ---------- Étape 7 : Lieux et sorties ----------
  await essayer(7, '15_etape07_lieux', async () => {
    await page.locator('.panneau-dossiers').waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll('.tuile img').length >= 5, null, { timeout: 30_000 }).catch(() => undefined);
    await attendre(1500);
    await capturer('15_etape07_lieux_premiere_visite', 'Étape 7 Lieux et sorties : première visite (explication ouverte)');
    if (await page.locator('.replier-entete').count()) await page.locator('.replier-entete').click();
    await capturer('16_etape07_lieux_aide_repliee', 'Étape 7 Lieux et sorties : explication repliée');
    // Le plus gros dossier.
    const lignes = await page.locator('.arbre .ligne-dossier').all();
    let max = { n: -1, l: null };
    for (const l of lignes.slice(1)) {
      const n = Number(((await l.locator('.nombre-dossier').innerText().catch(() => '0')) || '0').replace(/\D/g, ''));
      if (n > max.n) max = { n, l };
    }
    if (max.l) await max.l.click();
    await page.waitForFunction(() => document.querySelectorAll('.tuile img').length >= 5, null, { timeout: 30_000 }).catch(() => undefined);
    await attendre(1500);
    await etat('17_etape07_lieux_dossier_choisi', 'Étape 7 Lieux et sorties : le plus gros dossier sélectionné', { pleine: true });
    await page.locator('.tuile').first().click();
    await etat('18_etape07_lieux_photo_choisie', 'Étape 7 Lieux et sorties : une photo sélectionnée (barre d’actions)');
    await page.keyboard.press('m');
    await page.locator('.dialogue.deplacer').waitFor({ timeout: 5000 });
    await etat('19_etape07_lieux_deplacer', 'Étape 7 Lieux et sorties : dialogue « Déplacer… » (touche M)');
    await page.keyboard.press('Escape');
    await page.locator('.tuile').nth(1).dblclick();
    await page.locator('.visionneuse img').waitFor({ timeout: 10_000 });
    await attendre(1000);
    await etat('20_etape07_lieux_visionneuse', 'Étape 7 Lieux et sorties : visionneuse (double-clic sur une photo)');
    await page.keyboard.press('Escape');
    const ldt = page.getByRole('button', { name: 'Ligne de temps' });
    if (await ldt.count()) {
      await ldt.click();
      await attendre(1000);
      await etat('21_etape07_lieux_ligne_de_temps', 'Étape 7 Lieux et sorties : vue « Ligne de temps »');
      await page.getByRole('button', { name: 'Photos', exact: true }).click();
    }
    await valider();
  });

  // ---------- Étape 8 : Petits dossiers ----------
  await essayer(8, '22_etape08_petits', async () => {
    await page.locator('main[data-etape=petits]').first().waitFor({ timeout: 60_000 });
    await attendre(2000);
    await capturer('22_etape08_petits', 'Étape 8 Petits dossiers : arrivée');
    const item = page.locator('.liste-petits .ligne-liste-petit').nth(1);
    if (await item.count()) {
      await item.click();
      await attendre(1500);
      await etat('23_etape08_petits_second', 'Étape 8 Petits dossiers : second petit dossier choisi dans la liste', { pleine: true });
    }
    const evidents = page.getByRole('button', { name: /^Mettre \d+ petits? dossiers? avec leur dossier/ });
    if (await evidents.count()) {
      await evidents.first().click();
      await attendre(800);
      if (await page.locator('.dialogue.evidents').count()) {
        await etat('24_etape08_petits_evidents', 'Étape 8 Petits dossiers : dialogue « Petits dossiers au dossier évident »');
        await page.keyboard.press('Escape');
      }
    }
    await valider();
  });

  // ---------- Étape 9 : Nommage ----------
  await essayer(9, '25_etape09_nommage', async () => {
    await page.locator('main[data-etape=nommage]').first().waitFor({ timeout: 60_000 });
    await attendre(2500);
    await capturer('25_etape09_nommage', 'Étape 9 Nommage : arrivée, sans IA');
    if (await page.locator('.tableau.nommage').count()) await etat('26_etape09_nommage_liste_zoom', 'Étape 9 Nommage : zoom sur la liste (tableau), sans IA', { element: '.tableau.nommage' });
    if (actif()) {
      mesures.nommage = await page.evaluate(() => {
        const t = document.querySelector('.tableau.nommage');
        if (!t) return null;
        const lignes = [...t.querySelectorAll('tbody tr')];
        const gauches = (sel) => lignes.map((l) => l.querySelector(sel)).filter(Boolean).map((e) => Math.round(e.getBoundingClientRect().left));
        const cellules = lignes.slice(0, 12).map((l) => [...l.children].map((c) => ({ x: Math.round(c.getBoundingClientRect().left), largeur: Math.round(c.getBoundingClientRect().width), colspan: c.colSpan, texte: c.innerText.replace(/\s+/g, ' ').slice(0, 50) })));
        return {
          lignes: lignes.length,
          entetes: [...t.querySelectorAll('thead th')].map((th) => ({ texte: th.innerText.trim(), x: Math.round(th.getBoundingClientRect().left), largeur: Math.round(th.getBoundingClientRect().width) })),
          miniatures_img: t.querySelectorAll('.miniatures-nommage img').length,
          blocs_miniatures: t.querySelectorAll('.miniatures-nommage').length,
          img_dans_tableau: t.querySelectorAll('img').length,
          gauche_champs_nom: [...new Set(gauches('input.nom-propose'))],
          cellules_12_premieres_lignes: cellules,
        };
      });
    }
    // Clé factice, le temps du bouton IA (API simulée).
    await page.evaluate((cle) => sessionStorage.setItem('album:cle_api', cle), CLE_FACTICE);
    await page.reload();
    await page.locator('main[data-etape=nommage]').first().waitFor({ timeout: 60_000 });
    const ia = page.getByRole('button', { name: /Nommer les sorties avec l’IA/ });
    if ((await ia.count()) && (await ia.isEnabled())) {
      await ia.click();
      await page.getByText(/noms? proposés?/).first().waitFor({ timeout: 120_000 });
      await attendre(2500);
      await capturer('27_etape09_nommage_avec_ia', 'Étape 9 Nommage : après les propositions de l’IA (API simulée)');
      await etat('28_etape09_nommage_liste_zoom_ia', 'Étape 9 Nommage : zoom sur la liste avec propositions IA', { element: '.tableau.nommage' });
      if (actif()) {
        mesures.nommage_avec_ia = await page.evaluate(() => {
          const t = document.querySelector('.tableau.nommage');
          if (!t) return null;
          const lignes = [...t.querySelectorAll('tbody tr')];
          return {
            lignes: lignes.length,
            miniatures_img: t.querySelectorAll('.miniatures-nommage img').length,
            gauche_champs_nom: [...new Set(lignes.map((l) => l.querySelector('input.nom-propose')).filter(Boolean).map((e) => Math.round(e.getBoundingClientRect().left)))],
            cellules_8_premieres_lignes: lignes.slice(0, 8).map((l) => [...l.children].map((c) => ({ x: Math.round(c.getBoundingClientRect().left), largeur: Math.round(c.getBoundingClientRect().width), hauteur: Math.round(c.getBoundingClientRect().height), texte: c.innerText.replace(/\s+/g, ' ').slice(0, 60) }))),
          };
        });
      }
    }
    await page.evaluate(() => sessionStorage.removeItem('album:cle_api'));
    const sur = page.getByRole('button', { name: /^Accepter les? (\d+ noms|nom) de confiance 8 ou plus/ });
    if (await sur.count()) await sur.click();
    await attendre(800);
    await valider();
    // Noms encore dans les champs : récapitulatif à cocher (D108), capturé puis quitté sans rien renommer.
    const recap = page.getByRole('dialog', { name: 'Des noms ne sont pas encore appliqués' });
    if (await recap.isVisible({ timeout: 1500 }).catch(() => false)) {
      await capturer('28b_etape09_nommage_recapitulatif', 'Étape 9 Nommage : récapitulatif des noms à appliquer en quittant');
      for (const c of await recap.getByRole('checkbox').all()) await c.uncheck();
      await recap.getByRole('button', { name: 'Continuer sans renommer' }).click();
    }
  });

  // ---------- Étape 10 : Consolidation ----------
  await essayer(10, '29_etape10_consolidation', async () => {
    await page.locator('main[data-etape=consolidation]').first().waitFor({ timeout: 60_000 });
    await attendre(2500);
    await capturer('29_etape10_consolidation', 'Étape 10 Consolidation : arrivée (réglages et propositions)');
    if (await page.locator('.reglages-reunion').count()) await etat('30_etape10_consolidation_reglages', 'Étape 10 Consolidation : bloc des réglages « Que proposer ? »', { element: '.reglages-reunion' });
    if (await page.locator('.colonnes-reunion').count()) await etat('31_etape10_consolidation_proposition', 'Étape 10 Consolidation : carte de la proposition affichée', { element: '.contenu-petits' });
    else {
      // Rien à proposer avec les réglages conseillés : on élargit les crans pour montrer des cartes de propositions.
      const r = page.locator('.reglages-reunion');
      for (const cran of ['la journée', '20 km', '2 semaines']) await r.getByText(cran, { exact: true }).first().click().catch(() => undefined);
      await attendre(1500);
      await capturer('31a_etape10_consolidation_crans_larges', 'Étape 10 Consolidation : crans élargis (la journée, 20 km, 2 semaines) pour faire apparaître des propositions');
      if (await page.locator('.colonnes-reunion').count()) await etat('31_etape10_consolidation_proposition', 'Étape 10 Consolidation : carte de la proposition affichée (crans élargis)', { element: '.page-consolidation .corps-petits' });
    }
    // Propositions de l'IA (API simulée).
    await page.evaluate((cle) => sessionStorage.setItem('album:cle_api', cle), CLE_FACTICE);
    const iaConso = page.getByRole('button', { name: /Proposer des fusions avec l’IA/ });
    // Bouton grisé (« rien à faire ») quand aucun dossier ne s'y prête : on ne le clique pas.
    if ((await iaConso.count()) && (await iaConso.isEnabled())) {
      await iaConso.click();
      await page.getByText(/propositions? dans|Rien à réunir/).first().waitFor({ timeout: 120_000 });
      await attendre(2500);
      await capturer('31b_etape10_consolidation_propositions_ia', 'Étape 10 Consolidation : après « Proposer des fusions avec l’IA » (API simulée : une fusion proposée par répertoire)');
      if (await page.locator('.colonnes-reunion').count()) await etat('31c_etape10_consolidation_carte', 'Étape 10 Consolidation : zoom sur la carte de la proposition', { element: '.page-consolidation .corps-petits' });
    }
    await page.evaluate(() => sessionStorage.removeItem('album:cle_api'));
    const av = page.locator('.page-consolidation details.avances > summary');
    if (await av.count()) {
      await av.first().click();
      await etat('32_etape10_consolidation_avances', 'Étape 10 Consolidation : réglages avancés dépliés', { pleine: true });
    }
    const item = page.locator('.page-consolidation .liste-petits li, .page-consolidation .liste-petits button').nth(1);
    if (await item.count()) {
      await item.click();
      await attendre(1200);
      await etat('33_etape10_consolidation_seconde', 'Étape 10 Consolidation : seconde proposition choisie dans la liste', { pleine: true });
    }
    await valider();
  });

  // ---------- Étape 11 : Sélection ----------
  await essayer(11, '34_etape11_selection', async () => {
    await page.locator('.page-selection').waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll('.page-selection .tuile img').length >= 8, null, { timeout: 60_000 }).catch(() => undefined);
    await attendre(2000);
    await capturer('34_etape11_selection_premiere_visite', 'Étape 11 Sélection : état initial, première visite (explication ouverte)');
    if (await page.locator('.replier-entete').count()) await page.locator('.replier-entete').click();
    await capturer('35_etape11_selection_aide_repliee', 'Étape 11 Sélection : explication repliée');
    // Tri rapide.
    await page.getByRole('button', { name: 'Tri rapide' }).click();
    await page.locator('.tri-rapide').waitFor();
    await attendre(1500);
    await etat('36_etape11_selection_tri_rapide', 'Étape 11 Sélection : « Tri rapide » ouvert (première photo)');
    // Quelques choix pour remplir l'album : ★, ★★, ✗, au fil des photos.
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press(i % 9 === 4 ? '2' : i % 4 === 3 ? 'x' : ' ');
      await attendre(60);
    }
    await attendre(1000);
    await etat('37_etape11_selection_tri_rapide_apres', 'Étape 11 Sélection : Tri rapide après 90 choix (★, ★★, ✗)');
    await page.keyboard.press('Escape');
    await page.locator('.tri-rapide').waitFor({ state: 'detached' });
    await attendre(800);
    await capturer('38_etape11_selection_apres_choix', 'Étape 11 Sélection : grille après les choix (bouton Annuler actif)', { pleine: false });
    // Une photo sélectionnée.
    await page.locator('.page-selection .tuile').nth(2).click();
    // Lot 4 : plus de barre noire ; les choix sont dans la colonne de droite « N photos choisies ».
    await page.locator('.panneau-choix').waitFor();
    await attendre(800);
    await etat('39_etape11_selection_une_photo', 'Étape 11 Sélection : UNE photo sélectionnée (où sont ses options)', { pleine: true });
    if (actif()) {
      mesures.selection_une_photo = await page.evaluate(() => {
        const b = (s) => {
          const e = document.querySelector(s);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), largeur: Math.round(r.width), hauteur: Math.round(r.height), texte: e.innerText.replace(/\s+/g, ' ').slice(0, 300) };
        };
        const tuile = document.querySelector('.page-selection .tuile.choisie');
        return {
          panneau_choix: b('.page-selection .panneau-choix'),
          tuile_choisie: tuile ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), largeur: Math.round(width), hauteur: Math.round(height) }))(tuile.getBoundingClientRect()) : null,
          outils_droite: b('.page-selection .outils-selection'),
          // Les marques ↻ ✂ ▣ ont quitté la photo pour le bout de la bande d'état (lot 3 de la charte, C-9.6).
          fin_bande: b('.page-selection .tuile.choisie .bande-etat'),
          barre_validation: b('.barre-validation'),
          viewport: `${innerWidth}x${innerHeight}`,
        };
      });
      await retailler(1280, 720);
      await cliche('41_etape11_selection_une_photo_1280.png', 'Étape 11 Sélection : UNE photo sélectionnée (écran visible 1280×720)');
      mesures.selection_une_photo_1280 = await page.evaluate(() => {
        const r = document.querySelector('.page-selection .panneau-choix')?.getBoundingClientRect();
        return r ? { x: Math.round(r.x), y: Math.round(r.y), largeur: Math.round(r.width), hauteur: Math.round(r.height), visible_dans_ecran: r.top >= 0 && r.bottom <= innerHeight } : null;
      });
      await retailler(1440, 900);
    }
    await etat('42_etape11_selection_panneau_choix_zoom', 'Étape 11 Sélection : zoom sur la colonne « N photos choisies »', { element: '.page-selection .panneau-choix' });
    // Recadrage.
    const recadrer = page.locator('.panneau-choix').getByRole('button', { name: /^Recadrer et tourner/ });
    if (await recadrer.count()) {
      await recadrer.first().click();
      await attendre(2000);
      await etat('43_etape11_selection_recadreur', 'Étape 11 Sélection : recadrage ouvert (« Recadrer et tourner… » de la colonne de droite, touche K)');
      await page.keyboard.press('Escape');
      await attendre(500);
      const fermer = page.getByRole('button', { name: /^(Annuler|Fermer|Fermer sans recadrer)$/ }).last();
      if (await page.locator('canvas').count()) await fermer.click().catch(() => undefined);
    }
    // Vue en grand : double-clic sur une photo (ouvre le Tri rapide sur cette photo).
    await page.keyboard.press('Escape');
    await page.locator('.page-selection .tuile').nth(5).dblclick();
    await page.locator('.tri-rapide').waitFor({ timeout: 10_000 });
    await attendre(1500);
    await etat('44_etape11_selection_vue_en_grand', 'Étape 11 Sélection : vue en grand (double-clic sur une photo = Tri rapide), boutons dont « R tourner »');
    await cliche('45_etape11_selection_vue_en_grand_boutons.png', 'Étape 11 Sélection : zoom sur les boutons de la vue en grand', page.locator('.tri-rapide .tri-touches')).catch(() => undefined);
    if (actif()) {
      mesures.vue_en_grand = await page.evaluate(() => ({
        boutons: [...document.querySelectorAll('.tri-rapide button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
        recadrer_present: [...document.querySelectorAll('.tri-rapide button')].some((b) => /recadr/i.test(b.innerText + b.title)),
      }));
    }
    await page.keyboard.press('r');
    await attendre(1200);
    await etat('46_etape11_selection_vue_en_grand_tournee', 'Étape 11 Sélection : vue en grand après « R » (photo tournée d’un quart de tour)');
    await page.keyboard.press('Escape');
    await page.locator('.tri-rapide').waitFor({ state: 'detached' });
    // Bouton Annuler de l'étape.
    if (actif()) {
      const annuler = page.locator('.page-selection .tete-vue .barre-outils button', { hasText: 'Annuler' });
      mesures.selection_annuler = await annuler.evaluate((b) => ({ texte: b.innerText.trim(), title: b.title, desactive: b.disabled, ...(({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), largeur: Math.round(width), hauteur: Math.round(height) }))(b.getBoundingClientRect()) }));
      await cliche('47_etape11_selection_annuler_zoom.png', `Étape 11 Sélection : barre du haut avec « Annuler » (title = « ${mesures.selection_annuler.title} »)`, page.locator('.page-selection .tete-vue'));
      await annuler.hover();
      await attendre(1500);
      await etat('48_etape11_selection_annuler_survol', 'Étape 11 Sélection : souris sur « Annuler » (l’infobulle native n’apparaît pas dans une capture sans affichage)');
    }
    await valider();
  });

  // ---------- Étape 12 : Album ----------
  await essayer(12, '49_etape12_album', async () => {
    if (!(await page.locator('.page-album').count())) await allerEtape(/Album$/);
    await page.locator('.page-album').waitFor({ timeout: 60_000 });
    await attendre(2500);
    await capturer('49_etape12_album', 'Étape 12 Album : aperçu');
    const photo = page.locator('.page-album .photos-page img, .page-album .planche img').first();
    if (await photo.count()) {
      await photo.click();
      await attendre(1000);
      await etat('50_etape12_album_photo_cliquee', 'Étape 12 Album : une photo cliquée (panneau de la photo)', { pleine: true });
      await page.keyboard.press('Escape');
    }
    const onglets = page.locator('.page-album .onglets button');
    if ((await onglets.count()) > 1) {
      await onglets.nth(1).click();
      await attendre(1200);
      await etat('51_etape12_album_onglet2', `Étape 12 Album : second onglet (« ${(await onglets.nth(1).innerText()).trim()} »)`, { pleine: true });
      await onglets.first().click();
    }
  });

  // ---------- Étape 13 : Sortie ----------
  await essayer(13, '52_etape13_sortie', async () => {
    await allerEtape(/Sortie$/);
    await page.getByRole('button', { name: /Créer \/ mettre à jour la sortie/ }).waitFor({ timeout: 120_000 });
    await attendre(1500);
    await capturer('52_etape13_sortie_avant', 'Étape 13 Sortie : avant écriture');
    await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
    await attendre(800);
    await etat('53_etape13_sortie_confirmation', 'Étape 13 Sortie : confirmation avant écriture');
    await page.getByRole('button', { name: 'Écrire', exact: true }).click();
    await page.locator('.encart.bilan').waitFor({ timeout: 1_800_000 });
    await attendre(1500);
    await capturer('54_etape13_sortie_bilan', 'Étape 13 Sortie : bilan après écriture');
  });

  // ---------- Retour sur l'étape 1 et l'accueil avec un projet ----------
  await essayer(1, '55_etape01_projet_existant', async () => {
    await allerEtape(/Projet$/);
    await capturer('55_etape01_projet_existant', 'Étape 1 Projet : page du projet existant');
  });
  await essayer(0, '56_accueil_avec_projet', async () => {
    await page.locator('.bouton-menu').click();
    await page.getByRole('menuitem', { name: /Accueil|Fermer le projet|Projets/ }).first().click();
    await attendre(1500);
    await capturer('56_accueil_avec_projet', 'Accueil avec le projet en cours');
  });
} catch (e) {
  if (e.message !== FIN) {
    manques.push({ nom: pageCourante, raison: `ARRÊT : ${e.message.split('\n')[0]}` });
    noter(`ARRÊT : ${e.stack}`);
    await page.screenshot({ path: join(SP, 'zz_arret.png') }).catch(() => undefined);
  }
} finally {
  writeFileSync(join(SP, 'mesures.json'), JSON.stringify(mesures, null, 2));
  writeFileSync(join(SP, 'erreurs_console.json'), JSON.stringify(erreurs, null, 2));
  writeFileSync(join(SP, 'INDEX.md'), indexMd());
  await navigateur.close();
  serveur.close();
  rmSync(TEMP, { recursive: true, force: true });
}
noter(`fin : ${index.length} captures, ${manques.length} manques, ${erreurs.length} messages de console`);
process.exit(manques.length ? 1 : 0);

/** INDEX.md : conditions de l'essai, liste commentée des captures, manques. */
function indexMd() {
  const l = [
    '# Captures d’écran de l’application « Album photos »',
    '',
    `Générées le ${new Date().toLocaleString('fr-CH')} par \`outils/captures_ux.mjs\`, en ${duree(t0)}.`,
    `Étapes capturées : ${ETAPES ? [...ETAPES].sort((a, b) => a - b).join(', ') + ' (0 = accueil et configuration)' : 'toutes'}.`,
    '',
    '- **Application** : build figé (`vite build`, dans `.build/`), servi en statique ; aucun serveur de développement.',
    `- **Données** : le dossier « ${NOMS.source} » (${fichiersSource.length} fichiers dont ${photosSource.length} photos), copié dans le stockage privé du navigateur ; le dossier lui-même n’a pas été touché.`,
    `- **Contenu ajouté dans la copie** : ${COPIES.length} copies exactes dans \`Copies/\` (étape Doublons), ${DEPLACEES.length} photos déplacées dans \`Sous_dossier/\` (étape Dossiers).`,
    `- **Configuration** : ${config ? `modèle \`config.exemple/config.json\`${ICS ? `, calendrier simulé « Vacances » du ${premiere.toLocaleDateString('fr-CH')} au ${derniere.toLocaleDateString('fr-CH')}` : ', sans calendrier (aucune date EXIF)'}` : 'aucune (modèle introuvable)'}.`,
    '- **Simulés (aucun appel réseau)** : OpenStreetMap (grande ville à moins de 25 km, sinon « Lieu lat lon » arrondi au dixième de degré) et l’API Claude (Nommage : noms plausibles, confiance 5 à 9 ; Consolidation : une fusion par répertoire). Clé factice le temps des boutons IA.',
    `- **Polices** : ${env.FONTCONFIG_FILE ? 'dossier POLICES_EMOJI ajouté aux polices du système' : 'polices du système seulement (emoji peut-être en carrés : voir POLICES_EMOJI)'}.`,
    '',
    '**Pleine page** : la page elle-même ne défile pas (c’est `<main>` ou la grille qui défile) ; les fichiers `_pleine` sont pris en agrandissant la fenêtre à la hauteur du contenu (au plus 5000 px ; mention exacte sur chaque ligne).',
    '',
    `Annexes : \`mesures.json\` (titres, défilement, bouton d’aide, curseur de taille, boutons « Annuler », bouton principal, par page et par taille), \`erreurs_console.json\` (${erreurs.length} messages).`,
    '',
    '## Captures',
    '',
    ...index.map(([f, d]) => `- \`${f}\` → ${d}`),
  ];
  if (manques.length) l.push('', '## Manques', '', ...manques.map((m) => `- ${m.nom} : ${m.raison}`));
  return `${l.join('\n')}\n`;
}
