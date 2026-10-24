// Essai automatique de la page de la phase 0 dans Chromium sans affichage.
//
// Page d'essais de la phase 0 (essais-phase0.html).
// Usage (depuis app/, après `npm run build`) :
//   node outils/essai_navigateur.mjs [dossier_de_sortie_des_resultats]
//
// Le sélecteur de dossier (qui exige un vrai clic) est remplacé par des
// dossiers du stockage privé du navigateur : on vérifie la logique de la page,
// pas les performances du disque. Aucune clé API n'est utilisée : l'essai de
// l'API se fait avec une fausse clé, pour vérifier seulement que la réponse
// (401) traverse le CORS.

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = fileURLToPath(new URL('..', import.meta.url));
const PHOTOS = join(APP, '..', 'tests', 'photos_reelles');
const SORTIE = process.argv[2] ?? APP;
const fichiers = readdirSync(PHOTOS)
  .filter((f) => f.endsWith('.jpg'))
  .map((f) => join(PHOTOS, f));
const vecteurs = join(PHOTOS, 'vecteurs_reference.json');

// Sous WSL sans droits d'administration, les bibliothèques manquantes de Chromium
// (libnspr4, libnss3, libasound2t64) peuvent être extraites ici avec `apt-get download`.
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES)
  ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  : process.env;

function resultats(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('proto0:resultats') || '{}'));
}

async function attendre(page, point, cle, timeout = 180_000) {
  console.log(`  … attente de ${point}.${cle}`);
  await page.waitForFunction(
    ([p, c]) => {
      const r = JSON.parse(localStorage.getItem('proto0:resultats') || '{}');
      return !!(r[p] && r[p][c]);
    },
    [point, cle],
    { timeout },
  );
}

const cliquer = (page, section, texte) => page.locator(`#${section} button`, { hasText: texte }).first().click();

async function essai(url, nom, complet) {
  console.log(`Essai ${nom} : ${url}`);
  const navigateur = await chromium.launch({ env });
  const page = await navigateur.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  // Sélecteur de dossier simulé : un dossier par identifiant dans le stockage privé.
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => {
      const racine = await navigator.storage.getDirectory();
      return racine.getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
    };
  });
  await page.goto(url);
  await attendre(page, 'g', 'capacites');

  // c : EXIF, miniatures, worker, comparaison aux vecteurs Python.
  await page.setInputFiles('#c input[accept^=".json"]', vecteurs);
  await page.setInputFiles('#c input[accept^="image"]', fichiers);
  await attendre(page, 'c', 'comparaison_python');

  // e : fausse clé → la réponse 401 doit traverser le CORS.
  await page.fill('#e input[type=password]', 'sk-ant-cle-invalide-pour-essai');
  await cliquer(page, 'e', 'Enregistrer la clé');
  await page.selectOption('#e select', 'claude-haiku-5-5');
  await cliquer(page, 'e', '1. Texte');
  await page.locator('#e .journal .ligne').last().waitFor();
  await page.waitForTimeout(500);
  const messageApi = await page.locator('#e .journal .ligne').last().innerText();
  await cliquer(page, 'e', 'Oublier la clé');

  // f : Nominatim (un seul lieu en file://, tous les lieux des photos sinon).
  if (complet) {
    await cliquer(page, 'f', 'Nommer les lieux des photos');
    await attendre(page, 'f', 'cadence', 120_000);
  } else {
    await cliquer(page, 'f', 'Nommer ce lieu');
    await attendre(page, 'f', 'cors', 60_000);
  }

  // En file://, le stockage privé (OPFS) qui simule les dossiers est refusé :
  // les points a, b et d ne sont essayés que via le serveur. Les miniatures (h)
  // partent des photos du point c, avec le cache IndexedDB.
  if (!complet) {
    await page.fill('#h input[type=number]', '18');
    await cliquer(page, 'h', 'Générer les miniatures');
    try {
      await attendre(page, 'h', 'miniatures', 60_000);
      await cliquer(page, 'h', 'Afficher la grille');
      await page.waitForTimeout(500);
      await cliquer(page, 'h', 'Défilement automatique');
      await attendre(page, 'h', 'grille_defilement', 30_000);
    } catch {
      erreurs.push(`h : ${await page.locator('#h .journal .ligne').last().innerText()}`);
    }
    const r = await resultats(page);
    await navigateur.close();
    return { url, nom, messageApi, erreurs, resultats: r };
  }

  // a : un « dossier source » rempli avec les photos de test, dans des sous-dossiers.
  await page.evaluate(() => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.multiple = true;
    champ.id = 'remplissage';
    document.body.appendChild(champ);
  });
  await page.setInputFiles('#remplissage', fichiers);
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
    for (const f of document.getElementById('remplissage').files) {
      const sous = f.name.startsWith('01') ? 'Thailande/Kanchanaburi' : f.name.startsWith('0') ? 'Divers' : '';
      let d = source;
      for (const p of sous.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: true });
      const w = await (await d.getFileHandle(f.name, { create: true })).createWritable();
      await w.write(f);
      await w.close();
    }
    const w = await (await source.getFileHandle('notes.txt', { create: true })).createWritable();
    await w.write('un fichier qui n’est ni une photo ni une vidéo');
    await w.close();
  });
  await cliquer(page, 'a', 'Choisir le dossier');
  await attendre(page, 'a', 'choix');
  await page.fill('#a input[type=number]', '18');
  await cliquer(page, 'a', 'Lancer l’inventaire');
  await attendre(page, 'h', 'inventaire_5000');

  // b : config/ créé, modèle écrit, modification, détection d'une modification extérieure.
  await cliquer(page, 'b', 'Créer config/ dans un dossier');
  await page.locator('#b .journal .ligne', { hasText: 'Pas de config.json' }).waitFor();
  await cliquer(page, 'b', 'Créer config.json depuis le modèle');
  await attendre(page, 'b', 'creation_fichier');
  await cliquer(page, 'b', 'Enregistrer une modification de test');
  await attendre(page, 'b', 'ecriture');
  await page.waitForTimeout(1100);
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const config = await (await racine.getDirectoryHandle('selecteur_config-parent')).getDirectoryHandle('config');
    const w = await (await config.getFileHandle('config.json')).createWritable({ keepExistingData: true });
    await w.write({ type: 'write', position: 0, data: ' ' });
    await w.close();
  });
  await cliquer(page, 'b', 'Enregistrer une modification de test');
  await attendre(page, 'b', 'detection_modification', 20_000).catch(() => undefined);

  // d : copie, resynchronisation, déplacement.
  await cliquer(page, 'd', 'Choisir le dossier de sortie');
  await attendre(page, 'd', 'controle_inclusion');
  await page.fill('#d input[type=number]', '18');
  await cliquer(page, 'd', 'Copier');
  await attendre(page, 'd', 'copie');
  await cliquer(page, 'd', 'Resynchroniser');
  await attendre(page, 'd', 'resynchronisation');
  await cliquer(page, 'd', 'Tester le déplacement');
  await attendre(page, 'd', 'deplacement');

  // h : miniatures et grille.
  await page.fill('#h input[type=number]', '18');
  await cliquer(page, 'h', 'Générer les miniatures');
  await attendre(page, 'h', 'miniatures');
  await cliquer(page, 'h', 'Afficher la grille');
  await page.waitForTimeout(500);
  await cliquer(page, 'h', 'Défilement automatique');
  await attendre(page, 'h', 'grille_defilement', 30_000);

  // Rechargement : le dossier mémorisé est-il retrouvé ?
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('proto0:resultats') || '{}');
    delete r.a?.autorisation_au_chargement;
    localStorage.setItem('proto0:resultats', JSON.stringify(r));
  });
  await page.reload();
  await attendre(page, 'a', 'autorisation_au_chargement');
  const apres = await resultats(page);

  await navigateur.close();
  return { url, nom, messageApi, erreurs, resultats: apres };
}

// Vite lancé directement par Node (et non via npx) pour pouvoir l'arrêter à coup sûr.
const serveur = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5179', '--strictPort'], {
  cwd: APP,
  stdio: 'ignore',
});
for (let essais = 0; ; essais++) {
  try {
    await fetch('http://localhost:5179/essais-phase0.html');
    break;
  } catch {
    if (essais > 60) throw new Error('Le serveur de développement ne répond pas.');
    await new Promise((r) => setTimeout(r, 500));
  }
}
try {
  const rapport = [];
  rapport.push(await essai(`file://${join(APP, 'dist', 'essais-phase0.html')}`, 'fichier', false));
  rapport.push(await essai('http://localhost:5179/essais-phase0.html', 'serveur', true));
  const chemin = join(SORTIE, 'essai_navigateur.json');
  writeFileSync(chemin, JSON.stringify(rapport, null, 1));
  for (const r of rapport) {
    console.log(`\n=== ${r.nom} (${r.url})`);
    console.log(`API avec fausse clé : ${r.messageApi}`);
    if (r.erreurs.length) console.log(`Erreurs de la page : ${r.erreurs.join(' | ')}`);
    for (const [point, mesures] of Object.entries(r.resultats).sort()) {
      for (const [cle, m] of Object.entries(mesures)) console.log(`${point}.${cle} [${m.statut}] ${m.texte}`);
    }
  }
  console.log(`\nDétail : ${chemin}`);
} finally {
  serveur.kill();
}
process.exit(0);
