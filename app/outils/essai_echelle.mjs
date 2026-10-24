// Essai à grande échelle de l'application dans Chromium sans affichage :
// un vrai dossier trié (par exemple le voyage en Thaïlande, 1600 photos)
// copié dans le stockage privé du navigateur, puis inventaire, arborescence,
// création de la sortie, bilan et resynchronisation, puis (phase 2) analyse
// des photos, rafales, sélection d'un dossier, album et écriture de Album/,
// avec les durées.
//
// Usage (depuis app/) : node outils/essai_echelle.mjs DOSSIER_SOURCE [DOSSIER_CAPTURES]
// Avec VRAC=1 : parcours « Trier un nouveau dossier » (tout est retrié par
// lieux, OpenStreetMap simulé), étapes 3 à 7, puis la sortie.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = process.argv[2];
const VRAC = process.env.VRAC === '1';
const CAPTURES = process.argv[3];
if (!SOURCE) throw new Error('Usage : node outils/essai_echelle.mjs DOSSIER_SOURCE [DOSSIER_CAPTURES]');
const PORT = 5182;
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES) ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : process.env;

const t0 = performance.now();
const duree = (debut) => `${((performance.now() - debut) / 1000).toFixed(1)} s`;
const noter = (texte) => console.log(`[${duree(t0)}] ${texte}`);

const serveur = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: APP, stdio: 'ignore' });
for (let i = 0; ; i++) {
  try {
    await fetch(`http://localhost:${PORT}/album-photos.html`);
    break;
  } catch {
    if (i > 60) throw new Error('Serveur de développement absent');
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Profil persistant : un contexte éphémère a un quota de stockage trop petit pour quelques Go.
const profil = mkdtempSync(join(tmpdir(), 'album-echelle-'));
const navigateur = await chromium.launchPersistentContext(profil, { env, viewport: { width: 1440, height: 900 } });
const erreurs = [];
try {
  const page = navigateur.pages()[0] ?? (await navigateur.newPage());
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
  });
  await page.goto(`http://localhost:${PORT}/album-photos.html`);

  // Copie du dossier réel dans le stockage privé, en gardant l'arborescence.
  let debut = performance.now();
  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.webkitdirectory = true;
    c.id = 'dossier';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#dossier', SOURCE);
  const copie = await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
    const dossiers = new Map();
    const dossier = async (chemin) => {
      if (!chemin) return source;
      if (!dossiers.has(chemin)) {
        const i = chemin.lastIndexOf('/');
        dossiers.set(chemin, dossier(i < 0 ? '' : chemin.slice(0, i)).then((p) => p.getDirectoryHandle(chemin.slice(i + 1), { create: true })));
      }
      return dossiers.get(chemin);
    };
    let octets = 0;
    const fichiers = [...document.getElementById('dossier').files];
    for (const f of fichiers) {
      const rel = f.webkitRelativePath.split('/').slice(1).join('/');
      const i = rel.lastIndexOf('/');
      const d = await dossier(i < 0 ? '' : rel.slice(0, i));
      const w = await (await d.getFileHandle(rel.slice(i + 1), { create: true })).createWritable();
      await w.write(f);
      await w.close();
      octets += f.size;
    }
    return { fichiers: fichiers.length, octets };
  });
  noter(`source copiée dans le stockage privé : ${copie.fichiers} fichiers, ${(copie.octets / 2 ** 30).toFixed(2)} Go (${duree(debut)})`);

  if (VRAC) {
    // OpenStreetMap simulé : un nom par case de 0,1° (aucun appel réseau).
    await navigateur.route('https://nominatim.openstreetmap.org/**', async (route) => {
      const u = new URL(route.request().url());
      const nom = `Lieu ${Number(u.searchParams.get('lat')).toFixed(1)} ${Number(u.searchParams.get('lon')).toFixed(1)}`;
      await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { town: nom }, display_name: nom }) });
    });
  }

  // Projet et inventaire.
  await page.getByRole('button', { name: VRAC ? /Trier un nouveau dossier/ : /Ouvrir un dossier déjà trié/ }).click();
  const choisir = page.getByRole('button', { name: 'Choisir…' });
  await choisir.nth(0).click();
  await page.getByText('« selecteur_source »').waitFor();
  await choisir.nth(1).click();
  await page.getByText('« selecteur_sortie »').first().waitFor();
  await page.fill('#nom-projet', 'Essai à l’échelle');
  debut = performance.now();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await page.getByRole('button', { name: 'Valider et continuer' }).waitFor({ timeout: 600_000 });
  noter(`inventaire : ${(await page.locator('.tableau-bord').innerText()).replace(/\s+/g, ' ')} (${duree(debut)})`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_inventaire.png'), fullPage: true });

  if (VRAC) {
    await page.getByRole('button', { name: 'Tout trier' }).click();
    debut = performance.now();
    // Analyse des photos et des copies exactes : toute seule après l'inventaire (D56).
    await page.getByRole('button', { name: 'Valider et continuer' }).and(page.locator(':enabled')).waitFor({ timeout: 3_600_000 });
    noter(`analyse locale et copies exactes en ${duree(debut)} : ${(await page.locator('#copies').innerText()).split('\n').slice(1, 3).join(' ')}`);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();
    await page.getByRole('heading', { name: /Photos floues/ }).waitFor();
    noter(`floues : ${await page.locator('.compteur-floues').innerText()}`);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();
    // Doublons (journée par journée) : passés ici, on mesure le tri.
    await page.getByRole('heading', { name: /Doublons/ }).waitFor();
    await page.getByRole('button', { name: 'Valider et continuer' }).click();
    await page.getByRole('heading', { name: /Tri automatique/ }).waitFor();
    if (CAPTURES) {
      // Lieux fréquents : on laisse arriver les miniatures et les noms proches (OpenStreetMap simulé).
      await page.getByText('Recherche de l’adresse…').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(CAPTURES, 'echelle_lieux_frequents.png') });
      await page.locator('.tri-auto').last().screenshot({ path: join(CAPTURES, 'echelle_tri_reglages.png') });
    }
    debut = performance.now();
    await page.getByRole('button', { name: 'Calculer l’arborescence' }).click();
    await page.getByText(/dossiers? proposés?/).first().waitFor({ timeout: 1_800_000 });
    noter(`tri par lieux en ${duree(debut)} : ${await page.locator('.barre-validation .resume').innerText()}`);
    if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_tri.png') });
    for (const [numero, titre] of [[6, /Lieux et sorties/], [7, /Petits dossiers/], [8, /Nommage/], [9, /Consolidation/]]) {
      debut = performance.now();
      await page.getByRole('button', { name: 'Valider et continuer' }).click();
      await page.getByRole('heading', { name: titre }).waitFor({ timeout: 120_000 });
      noter(`étape ${numero} affichée en ${duree(debut)} : ${await page.locator('.barre-validation .resume').innerText()}`);
      if (CAPTURES) await page.screenshot({ path: join(CAPTURES, `echelle_etape${numero}.png`) });
    }
    await page.locator('.bandeau .etape', { hasText: /^.?12Sortie$/ }).click();
    await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).waitFor({ timeout: 120_000 });
    debut = performance.now();
    await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
    await page.getByRole('button', { name: 'Écrire' }).click();
    await page.locator('.encart.bilan').waitFor({ timeout: 1_800_000 });
    noter(`sortie écrite en ${duree(debut)} : ${(await page.locator('.encart.bilan').innerText()).split('\n').find((l) => l.includes('fichiers dans la source'))}`);
    noter(`bilan complet : ${(await page.getByText('Tout est dans le dossier de sortie.').count()) > 0 ? 'oui' : 'NON'}`);
    noter(`mémoire JavaScript : ${((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 2 ** 20).toFixed(0)} Mo`);
    throw new Error('FIN_VRAC');
  }
  debut = performance.now();
  await page.getByRole('button', { name: 'Valider et continuer' }).and(page.locator(':enabled')).waitFor({ timeout: 3_600_000 });
  noter(`analyse locale (netteté, ressemblance, copies) de toutes les photos en ${duree(debut)}`);
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Doublons/ }).waitFor();

  // Arborescence : le plus gros dossier, ses miniatures, un déplacement de toute la sélection.
  await page.locator('.bandeau .etape', { hasText: 'Lieux et sorties' }).click();
  await page.locator('.panneau-dossiers').waitFor();
  for (const bouton of await page.locator('.ligne-dossier .deplier:not([disabled])').all()) {
    if ((await bouton.innerText()) === '▸') await bouton.click();
  }
  const lignes = await page.locator('.arbre .ligne-dossier').all();
  let max = { n: -1, ligne: null, nom: '' };
  for (const l of lignes.slice(1)) {
    const n = Number((await l.locator('.nombre-dossier').innerText()).replace(/\s/g, ''));
    const enfants = await l.locator('xpath=following-sibling::ul').count();
    if (!enfants && n > max.n) max = { n, ligne: l, nom: await l.locator('.nom-dossier').innerText() };
  }
  debut = performance.now();
  await max.ligne.click();
  await page.waitForFunction(() => document.querySelectorAll('.tuile img').length >= 20, null, { timeout: 120_000 });
  noter(`dossier « ${max.nom} » (${max.n} photos) : 20 premières miniatures en ${duree(debut)}`);
  await page.waitForTimeout(3000);
  noter(`… ${await page.locator('.tuile img').count()} miniatures visibles après 3 s`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_arborescence.png') });
  debut = performance.now();
  await page.locator('.grille-photos').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+a');
  await page.locator('.barre-action').getByRole('button', { name: 'Nouveau dossier', exact: true }).click();
  await page.locator('.dialogue input').fill('Tout ensemble');
  await page.keyboard.press('Enter');
  await page.locator('.ligne-dossier .nom-dossier', { hasText: /^Tout ensemble$/ }).waitFor();
  noter(`${max.n} photos rangées dans un nouveau dossier en ${duree(debut)}`);
  debut = performance.now();
  await page.keyboard.press('Control+z');
  await page.locator('.ligne-dossier .nom-dossier', { hasText: /^Tout ensemble$/ }).waitFor({ state: 'detached' });
  noter(`annulé en ${duree(debut)}`);

  // Sortie (dossier déjà trié : « Lieux et sorties » validée mène à la sélection ; on passe à la création de la sortie).
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.locator('.page-selection').waitFor();
  await page.locator('.bandeau .etape', { hasText: /^.?12Sortie$/ }).click();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).waitFor({ timeout: 120_000 });
  debut = performance.now();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
  await page.getByRole('button', { name: 'Écrire' }).click();
  await page.locator('.encart.bilan').waitFor({ timeout: 1_800_000 });
  const bilan = (await page.locator('.encart.bilan').innerText()).split('\n').find((l) => l.includes('fichiers dans la source'));
  noter(`sortie écrite en ${duree(debut)} : ${bilan}`);
  noter(`bilan complet : ${(await page.getByText('Tout est dans le dossier de sortie.').count()) > 0 ? 'oui' : 'NON'}`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_sortie.png'), fullPage: true });
  await page.getByRole('button', { name: 'Vérifier à nouveau' }).waitFor({ timeout: 120_000 });
  noter(`deuxième passage : ${(await page.locator('.encart').first().innerText()).split('\n')[0]}`);
  let memoire = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  noter(`mémoire JavaScript : ${(memoire / 2 ** 20).toFixed(0)} Mo`);

  // Phase 2 : analyse locale, rafales, sélection, album.
  await page.locator('.bandeau .etape', { hasText: /^.?4Doublons$/ }).click();
  debut = performance.now();
  // Rafales repérées toutes seules à l'ouverture (l'analyse locale a été faite à l'inventaire).
  await page.locator('.apercu-lots > summary').waitFor({ timeout: 3_600_000 });
  noter(`estimation affichée : ${await page.locator('.encart-ia > summary').innerText()}`);
  noter(`rafales repérées en ${duree(debut)} : ${await page.locator('.barre-validation .resume').innerText()}`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_doublons.png') });
  if (await page.getByRole('button', { name: 'Écarter tous les doublons affichés' }).isEnabled()) {
    debut = performance.now();
    await page.getByRole('button', { name: 'Écarter tous les doublons affichés' }).click();
    await page.getByRole('button', { name: 'Écarter', exact: true }).click();
    await page.getByText(/doublons? écartés?\./).first().waitFor();
    noter(`doublons écartés en ${duree(debut)} : ${await page.locator('.barre-validation .resume').innerText()}`);
  }

  await page.locator('.bandeau .etape', { hasText: /^.?9Sélection$/ }).click();
  debut = performance.now();
  await page.waitForFunction(() => document.querySelectorAll('.page-selection .tuile img').length >= 20, null, { timeout: 120_000 });
  noter(`sélection : toutes les photos affichées, 20 miniatures en ${duree(debut)}`);
  const echappe = max.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('.ligne-dossier', { has: page.locator('.nom-dossier', { hasText: new RegExp(`^${echappe}$`) }) }).first().click();
  await page.locator('.page-selection .tuile').first().waitFor();
  await page.locator('.page-selection .tuile').first().click();
  debut = performance.now();
  await page.keyboard.press('Control+a');
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  noter(`${max.n} photos marquées ★ en ${duree(debut)} : ${await page.locator('.barre-validation .resume').innerText()}`);
  debut = performance.now();
  await page.getByText('Empiler les semblables').click();
  await page.waitForTimeout(100);
  noter(`piles calculées en ${duree(debut)} : ${await page.locator('.badge-pile:not(.dans-pile)').count()} piles visibles`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_selection.png') });

  await page.locator('.bandeau .etape', { hasText: /^.?10Album$/ }).click();
  debut = performance.now();
  await page.locator('.section-album').first().waitFor({ timeout: 120_000 });
  noter(`aperçu de l’album en ${duree(debut)} : ${await page.locator('.onglets .discret').innerText()}`);
  if (CAPTURES) await page.screenshot({ path: join(CAPTURES, 'echelle_album.png') });

  await page.locator('.bandeau .etape', { hasText: /^.?11Sortie$/ }).click();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).waitFor({ timeout: 120_000 });
  noter(`aperçu de la sortie : ${(await page.locator('.encart').first().innerText()).replace(/\s+/g, ' ')}`);
  debut = performance.now();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
  await page.getByRole('button', { name: 'Écrire' }).click();
  await page.locator('.encart.bilan').waitFor({ timeout: 1_800_000 });
  noter(`sortie et album écrits en ${duree(debut)} : ${(await page.locator('.encart.bilan').innerText()).replace(/\s+/g, ' ').slice(0, 400)}`);
  await page.getByRole('button', { name: 'Vérifier à nouveau' }).waitFor({ timeout: 120_000 });
  noter('passage suivant : tout est à jour');
  memoire = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  noter(`mémoire JavaScript : ${(memoire / 2 ** 20).toFixed(0)} Mo`);
} catch (err) {
  if (err.message !== 'FIN_VRAC') throw err;
} finally {
  await navigateur.close();
  serveur.kill();
  rmSync(profil, { recursive: true, force: true });
}
if (erreurs.length) console.log(`Erreurs de la page :\n  ${[...new Set(erreurs)].slice(0, 20).join('\n  ')}`);
process.exit(erreurs.length ? 1 : 0);
