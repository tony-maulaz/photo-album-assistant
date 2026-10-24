// Essai de bout en bout de l'application (phases 1 et 2) dans Chromium sans affichage.
//
// Usage (depuis app/) : node outils/essai_application.mjs
//
// Le sélecteur de dossier est simulé par le stockage privé du navigateur :
// un dossier « source » rempli avec les photos de tests/photos_reelles, et un
// dossier « sortie » vide. On parcourt : ouvrir un dossier déjà trié,
// inventaire, déplacements (clavier, glisser), annuler, nouveau dossier,
// renommer, mettre de côté, création de la sortie, bilan, resynchronisation,
// puis doublons (API Claude simulée : aucun appel réseau), sélection, album,
// écriture de Album/, rechargement.

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { controlerAnglais } from './anglais.mjs';

const APP = fileURLToPath(new URL('..', import.meta.url));
const PHOTOS = join(APP, '..', 'tests', 'photos_reelles');
const PORT = 5181;
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES) ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : process.env;

/** Où ranger chaque photo de test dans le faux « dossier déjà trié ». */
function destination(nom) {
  if (/^01(07|09|10|17)/.test(nom)) return 'Thailande/Kanchanaburi';
  if (/^01(8|9)/.test(nom)) return 'Thailande/Angthong';
  if (/^014/.test(nom)) return 'VS_Max';
  if (nom.startsWith('20260721')) return '_a_supprimer';
  if (nom.startsWith('Vacances')) return 'Planches';
  return '';
}

const photos = readdirSync(PHOTOS).filter((f) => f.endsWith('.jpg'));
/** CAPTURES=dossier : enregistre des captures d'écran des pages principales. */
const CAPTURES = process.env.CAPTURES;
const capturer = async (page, nom) => CAPTURES && page.screenshot({ path: join(CAPTURES, `${nom}.png`) });
let etape = 0;
const verifier = (condition, texte) => {
  etape++;
  if (!condition) throw new Error(`Échec (${etape}) : ${texte}`);
  console.log(`✓ ${texte}`);
};

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

const navigateur = await chromium.launch({ env });
const erreurs = [];
try {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
  });
  await page.goto(`http://localhost:${PORT}/album-photos.html`);

  // Faux dossier source dans le stockage privé.
  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.multiple = true;
    c.id = 'remplissage';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#remplissage', photos.map((p) => join(PHOTOS, p)));
  const plan = Object.fromEntries(photos.map((p) => [p, destination(p)]));
  await page.evaluate(async (plan) => {
    const racine = await navigator.storage.getDirectory();
    const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
    const ecrire = async (chemin, contenu) => {
      const parties = chemin.split('/');
      let d = source;
      for (const p of parties.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const w = await (await d.getFileHandle(parties.at(-1), { create: true })).createWritable();
      await w.write(contenu);
      await w.close();
    };
    for (const f of document.getElementById('remplissage').files) await ecrire(plan[f.name] ? `${plan[f.name]}/${f.name}` : f.name, f);
    await ecrire('notes/liste.txt', 'pas une photo');
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
  }, plan);

  // Ouvrir un dossier déjà trié.
  await capturer(page, '01_accueil');
  await page.getByRole('button', { name: /Ouvrir un dossier déjà trié/ }).click();
  const choisir = page.getByRole('button', { name: 'Choisir…' });
  await choisir.nth(0).click();
  await page.getByText('« selecteur_source »').waitFor();
  await choisir.nth(1).click();
  await page.getByText('« selecteur_sortie »').first().waitFor();
  await page.fill('#nom-projet', 'Essai phase 1');
  await capturer(page, '02_nouveau_projet');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  // Inventaire.
  await page.getByRole('button', { name: 'Valider et continuer' }).waitFor({ timeout: 60_000 });
  await capturer(page, '03_inventaire');
  const tableau = (await page.locator('.tableau-bord').innerText()).replace(/\s+/g, ' ');
  verifier(tableau.startsWith('17 photos 0 vidéos 1 autres fichiers 5 dossiers'), `inventaire : ${tableau} (la 18e photo est dans « _a_supprimer »)`);
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Doublons/ }).waitFor();
  verifier(true, 'dossier déjà trié : après l’inventaire, les doublons (le tri automatique est sauté)');
  verifier((await page.locator('.bandeau .etape.inutile', { hasText: 'Tri automatique' }).count()) === 1, 'frise : le tri automatique est marqué inutile pour un dossier déjà trié');
  verifier((await page.locator('.bandeau .etape.inutile', { hasText: 'Dossiers' }).count()) === 1, 'frise : l’étape « Dossiers » aussi');
  verifier((await page.locator('.etape-courante').innerText()).includes('Étape 5 sur 13'), `en-tête : ${await page.locator('.etape-courante').innerText()}`);
  await page.locator('.etape-courante').click();
  verifier((await page.locator('.liste-etapes [role=menuitem]').count()) === 13, 'un clic sur l’étape en cours déroule la liste des treize étapes');
  await page.keyboard.press('Escape');
  await page.locator('.bouton-menu').click();
  const menu = await page.locator('.menu-deroulant [role=menuitem]').allInnerTexts();
  verifier(['Fonctions IA', 'Configuration', 'Réglages', 'Journal', 'Aide', 'Fermer le projet'].every((m) => menu.includes(m)), `menu ☰ : ${menu.join(', ')}`);
  await page.keyboard.press('Escape');
  verifier((await page.locator('.menu-deroulant').count()) === 0, 'Échap referme le menu');

  // Arborescence (étape « Lieux et sorties », ouverte par la frise).
  await page.locator('.bandeau .etape', { hasText: 'Lieux et sorties' }).click();
  await page.locator('.panneau-dossiers').waitFor();
  const ligne = (nom) => page.locator('.ligne-dossier', { has: page.locator('.nom-dossier', { hasText: new RegExp(`^${nom}$`) }) });
  const nombre = async (nom) => Number((await ligne(nom).locator('.nombre-dossier').innerText()).replace(/\s/g, ''));
  verifier((await page.locator('.ligne-dossier .nom-dossier', { hasText: /^Kanchanaburi$/ }).count()) === 0, 'les sous-dossiers sont repliés au départ');
  await ligne('Thailande').locator('.deplier').click();
  verifier((await nombre('Kanchanaburi')) === 4 && (await nombre('Angthong')) === 5, 'arborescence de la source reprise (Kanchanaburi 4, Angthong 5)');
  verifier((await page.locator('.ligne-dossier.speciale', { hasText: 'Mis de côté' }).locator('.nombre-dossier').innerText()) === '1', 'le contenu de « _a_supprimer » est mis de côté');

  await ligne('Kanchanaburi').click();
  await page.locator('.tuile').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.tuile img').length >= 4, null, { timeout: 30_000 });
  verifier(true, 'miniatures affichées');
  await page.locator('.tuile').nth(0).click();
  await page.locator('.tuile').nth(1).click({ modifiers: ['Shift'] });
  await capturer(page, '04_arborescence_selection');
  await page.keyboard.press('m');
  await page.keyboard.type('angth');
  await capturer(page, '05_deplacer_vers');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  if (process.env.DEBUG) {
    console.log('dialogue ouvert :', await page.locator('.dialogue.deplacer').count(), '| sélection :', await page.locator('.compte-selection').innerText());
    console.log('valeur saisie :', await page.locator('.dialogue.deplacer input').inputValue().catch(() => '—'));
    console.log('options :', await page.locator('.choix-dossiers li').allInnerTexts().catch(() => []));
    console.log('Kanchanaburi', await nombre('Kanchanaburi'), 'Angthong', await nombre('Angthong'));
    await page.screenshot({ path: '/tmp/claude-1000/-home-tony-private-photos-application/f10133c2-fa9f-4aae-bfab-c75f491a7fff/scratchpad/m.png' });
  }
  verifier((await nombre('Kanchanaburi')) === 2 && (await nombre('Angthong')) === 7, 'touche M : 2 photos déplacées vers Angthong');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  verifier((await nombre('Kanchanaburi')) === 4 && (await nombre('Angthong')) === 5, 'Ctrl+Z annule');
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(200);
  verifier((await nombre('Angthong')) === 7, 'Ctrl+Y rétablit');

  // Glisser une photo sur un dossier du panneau.
  await page.locator('.tuile').nth(0).dragTo(ligne('VS_Max'));
  await page.waitForTimeout(300);
  verifier((await nombre('VS_Max')) === 5 && (await nombre('Kanchanaburi')) === 1, 'glisser-déposer sur un dossier du panneau');

  // Nouveau dossier avec la sélection.
  await ligne('Angthong').click();
  await page.locator('.tuile').first().waitFor();
  await page.keyboard.press('Control+a');
  await page.locator('.barre-action').getByRole('button', { name: 'Nouveau dossier', exact: true }).click();
  await page.locator('.dialogue input').fill('Excursion Iles');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  if (process.env.DEBUG) {
    console.log('dialogue :', await page.locator('.dialogue').count(), await page.locator('.dialogue').allInnerTexts());
    console.log('messages :', await page.locator('.message').allInnerTexts());
    console.log('dossiers :', await page.locator('.ligne-dossier .nom-dossier').allInnerTexts());
    await page.screenshot({ path: '/tmp/claude-1000/-home-tony-private-photos-application/f10133c2-fa9f-4aae-bfab-c75f491a7fff/scratchpad/nouveau.png' });
  }
  verifier((await nombre('Excursion Iles')) === 7, 'nouveau dossier créé avec les 7 photos');
  verifier((await ligne('Excursion Iles').getAttribute('title')).startsWith('Thailande/Excursion Iles'), 'avec des photos sélectionnées : dossier créé au même niveau (dans Thailande)');

  // « + Nouveau dossier » sans photos : créé dans le dossier affiché, comme dans l'Explorateur.
  await ligne('VS_Max').click();
  await page.locator('.bouton-nouveau').click();
  await page.locator('.dialogue input').fill('Dedans');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  verifier((await ligne('Dedans').getAttribute('title')).startsWith('VS_Max/Dedans'), 'sans photos : dossier créé dans le dossier affiché');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  verifier((await ligne('Dedans').count()) === 0, 'Ctrl+Z retire le dossier créé');
  await ligne('VS_Max').click();
  verifier((await page.locator('.tete-vue .chemin-vue').count()) === 0 && (await page.locator('.tete-vue h2').innerText()) === 'VS_Max', 'titre de la vue : le nom seul pour un dossier du premier niveau');
  await ligne('Kanchanaburi').click();
  verifier((await page.locator('.tete-vue .chemin-vue').innerText()).includes('Thailande') && (await page.locator('.tete-vue h2').innerText()) === 'Kanchanaburi', 'titre de la vue : le dossier parent au-dessus du nom');

  // Renommer par double-clic.
  await ligne('Excursion Iles').locator('.nom-dossier').dblclick();
  await page.locator('.renommage').fill('Angthong_21.07.26');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  verifier((await nombre('Angthong_21.07.26')) === 7, 'dossier renommé');

  // Mettre de côté une photo (Suppr).
  await ligne('VS_Max').click();
  await page.locator('.tuile').first().click();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  verifier((await page.locator('.ligne-dossier.speciale', { hasText: 'Mis de côté' }).locator('.nombre-dossier').innerText()) === '2', 'Suppr met de côté');

  // Valider (dossier déjà trié : on arrive à la sélection), puis créer la sortie.
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.locator('.page-selection').waitFor();
  verifier(true, 'dossier déjà trié : après les lieux et sorties, la sélection');
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Sortie$/ }).click();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
  await page.getByRole('button', { name: 'Écrire' }).click();
  await page.getByText('Tout est dans le dossier de sortie.').first().waitFor({ timeout: 60_000 });
  const bilan = await page.locator('.encart.bilan').innerText();
  await capturer(page, '06_sortie_bilan');
  const phrase = bilan.split('\n').find((l) => l.includes('fichiers dans la source')) ?? bilan;
  verifier(phrase.includes('19 fichiers dans la source → 19 dans la sortie'), `bilan complet : ${phrase}`);
  verifier(phrase.includes('16 photos triées, 0 vidéo, 1 photo floue, 1 écartée à la main, 1 autre fichier'), 'pluriels du bilan');

  const sortie = await page.evaluate(async () => {
    const lister = async (d, p) => {
      const l = [];
      for await (const [nom, h] of d.entries()) {
        if (h.kind === 'directory') l.push(...(await lister(h, `${p}${nom}/`)));
        else l.push(`${p}${nom}`);
      }
      return l;
    };
    return (await lister(await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie'), '')).sort();
  });
  verifier(sortie.includes('Rapport.html') && sortie.includes('.album/plan.json') && sortie.includes('.album/etat_sortie.json'), 'Rapport.html et état du projet écrits');
  verifier(sortie.filter((p) => p.startsWith('Photos/Thailande/Angthong_21.07.26/')).length === 7, 'Photos/Thailande/Angthong_21.07.26 contient 7 photos');
  verifier(sortie.includes('_autres_fichiers/notes/liste.txt'), 'autres fichiers copiés avec leur chemin');
  verifier(sortie.filter((p) => p.startsWith('_mis_de_cote/')).length === 2, 'deux éléments dans _mis_de_cote');
  verifier(!sortie.some((p) => p.startsWith('Photos/Thailande/Angthong/')), 'le dossier vide « Angthong » n’est pas créé');

  // Deuxième passage : rien à recopier (A13), puis un déplacement après coup.
  await page.getByRole('button', { name: 'Vérifier à nouveau' }).waitFor();
  verifier((await page.locator('.encart').first().innerText()).includes('La sortie est à jour'), 'deuxième passage : la sortie est à jour (A13)');
  await page.locator('.bandeau .etape', { hasText: 'Lieux et sorties' }).click();
  await ligne('Kanchanaburi').click();
  await page.locator('.tuile').first().click();
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Sortie$/ }).click();
  await page.getByText(/1 fichier à déplacer/).waitFor({ timeout: 20_000 });
  verifier(true, 'un déplacement dans le plan devient un déplacement dans la sortie, sans recopie');
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
  await page.getByRole('button', { name: 'Écrire' }).click();
  await page.getByText('Tout est dans le dossier de sortie.').first().waitFor({ timeout: 60_000 });
  verifier(true, 'sortie mise à jour, bilan complet');

  // ---------------------------------------------------------------------
  // Phase 2 : doublons avec une API Claude simulée.
  // ---------------------------------------------------------------------
  const appels = { vue: 0, verif: 0, refus: 0 };
  const entetes = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await contexte.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: entetes });
    const corps = req.postDataJSON();
    const textes = corps.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text);
    const consigne = textes.at(-1);
    let reponse;
    const images = corps.messages[0].content.filter((b) => b.type === 'image').length;
    const numeros = Array.from({ length: Math.max(1, images) }, (_, i) => i + 1);
    if (consigne.includes('"meilleure"')) {
      appels.meilleure = (appels.meilleure ?? 0) + 1;
      reponse = { meilleure: 2, notes: numeros.map(() => 7), pleine_page: false, justification: 'la plus nette, regards vers l’objectif' };
    } else if (consigne.includes('Note chacune')) {
      appels.appreciation = (appels.appreciation ?? 0) + 1;
      reponse = numeros.map((n) => ({ photo: n, note: 5 + (n % 5), pleine_page: n === 1, justification: 'belle lumière' }));
    } else if (consigne.includes('"candidates"')) {
      reponse = { candidates: [1, 2] };
    } else if (consigne.includes('"couverture"')) {
      appels.couverture = (appels.couverture ?? 0) + 1;
      reponse = { couverture: [{ photo: 1, raison: 'image forte, place pour le titre' }, { photo: 2, raison: 'résume le voyage' }] };
    } else if (consigne.includes('"remarques"') && consigne.includes('rythme')) {
      appels.controleAlbum = (appels.controleAlbum ?? 0) + 1;
      reponse = { remarques: [{ type: 'rythme', pages: [2, 3], photos: [1], texte: 'Deux pages voisines très semblables.' }] };
    } else if (consigne.includes('"remarques"')) {
      appels.controleSelection = (appels.controleSelection ?? 0) + 1;
      reponse = { remarques: [{ type: 'redondance', photos: [1, 2], texte: 'Deux photos presque identiques.' }] };
    } else if (consigne.includes('"personnes"') && consigne.includes('"description"')) {
      appels.etiquettes = (appels.etiquettes ?? 0) + 1;
      reponse = { photos: Array.from({ length: images }, (_, i) => ({ photo: i + 1, personnes: 'aucune', type: 'paysage', defauts: [], description: i % 2 ? 'enfants sur un éléphant' : 'plage et mer turquoise' })) };
    } else if (consigne.includes('"titre"') && consigne.includes('"commentaires"')) {
      appels.textes = (appels.textes ?? 0) + 1;
      reponse = { titre: 'Titre IA', sous_titre: 'Une belle journée au bord de l’eau', commentaires: [{ photo: 1, texte: 'Légende IA' }] };
    } else if (consigne.includes('REPÉRER LES SCÈNES')) {
      appels.vue++;
      // Le numéro 3 n'existe pas dans un dossier de 2 photos : la validation doit l'ignorer.
      reponse = { scenes: [{ numeros: [1, 2, 3], scene: 'même panorama des îles' }] };
    } else if (consigne.includes('GRAND format')) {
      appels.verif++;
      const n = Number(/Voici (\d+) photos/.exec(consigne)[1]);
      const doublons = [{ numero: 2, description: 'panorama des iles recadre' }];
      // Une description sans mot commun : le garde-fou (I7) doit la refuser.
      if (n >= 3) {
        doublons.push({ numero: 3, description: 'assise sur le rocher' });
        appels.refus++;
      }
      reponse = { groupes: [{ garder: 1, garder_description: 'panorama des iles', doublons, raison: 'même panorama' }] };
    } else reponse = {};
    await route.fulfill({
      status: 200,
      headers: { ...entetes, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'msg_essai',
        type: 'message',
        role: 'assistant',
        model: corps.model,
        content: [{ type: 'text', text: JSON.stringify(reponse) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 3000, output_tokens: 400 },
      }),
    });
  });

  await page.locator('.bandeau .etape', { hasText: /^.?\d+Doublons$/ }).click();
  verifier((await page.getByRole('button', { name: 'Analyser les photos' }).count()) === 0, 'analyse locale déjà faite à l’inventaire : plus de bouton « Analyser les photos »');
  await page.locator('.encart-ia > summary').click();
  await page.getByRole('button', { name: /Analyser avec l’IA/ }).and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  const boutonIA = page.getByRole('button', { name: /Analyser avec l’IA/ });
  verifier(/environ .* CHF/.test(await boutonIA.innerText()), `coût estimé affiché avant lancement (A10) : ${await boutonIA.innerText()}`);
  await boutonIA.click();
  await page.getByText(/doublons? proposés?/).first().waitFor({ timeout: 60_000 });
  await capturer(page, '11_doublons');
  verifier(appels.vue > 0 && appels.verif > 0, `l’IA est appelée : ${appels.vue} vue(s) d’ensemble, ${appels.verif} vérification(s)`);
  const groupes = await page.locator('.carte-groupe').count();
  verifier(groupes > 0, `${groupes} groupe(s) de doublons à relire`);
  verifier(appels.refus > 0 && (await page.locator('.garde-fou').count()) > 0, `garde-fou des descriptions (I7) : ${appels.refus} description(s) d’une autre scène refusée(s) et signalée(s)`);
  const depense = await page.locator('.entete .budget').innerText();
  verifier(/^IA \d/.test(depense) && !depense.startsWith('IA 0,00'), `dépense IA comptée dans l’en-tête : ${depense}`);
  const avant = { ...appels };
  await page.waitForTimeout(300);
  verifier((await boutonIA.innerText()).includes('gratuit'), 'relancer est gratuit : les réponses sont en cache');
  await boutonIA.click();
  await page.getByText(/doublons? proposés?/).first().waitFor({ timeout: 60_000 });
  verifier(appels.vue === avant.vue && appels.verif === avant.verif, 'deuxième analyse sans aucun appel (A11)');
  await page.locator('.carte-groupe').first().locator('footer button.principal').click();
  await page.waitForTimeout(300);
  verifier((await page.locator('.barre-validation .resume').innerText()).includes('1 doublon écarté'), 'un doublon écarté après relecture');

  // Étape 9 : sélection au clavier, tri rapide, rotation.
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Sélection$/ }).click();
  await page.locator('.page-selection .tuile').first().waitFor();
  await page.locator('.page-selection .tuile').first().click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  const retenuesTexte = await page.locator('.barre-validation .resume').innerText();
  verifier(/photos retenues/.test(retenuesTexte) && retenuesTexte.includes('0 à décider'), `Espace : toutes retenues (${retenuesTexte})`);
  await page.locator('.page-selection .tuile').nth(0).click();
  await page.keyboard.press('2');
  await page.locator('.page-selection .tuile').nth(4).click();
  await page.keyboard.press('2');
  await page.locator('.page-selection .tuile').nth(1).click();
  await page.keyboard.press('x');
  await page.locator('.page-selection .tuile').nth(2).click();
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  verifier((await page.locator('.page-selection .tuile').nth(0).locator('.etoiles').innerText()) === '★★', 'touche 2 : grande photo ★★');
  verifier((await page.locator('.page-selection .tuile').nth(2).locator('.badge.rotation').count()) === 1, 'touche R : photo tournée');
  // Recadrage (D62) : touche K, format carré, la miniature montre la photo recadrée.
  await page.locator('.page-selection .tuile').nth(3).click();
  await page.keyboard.press('k');
  await page.locator('.recadreur .cadre-recadrage').waitFor({ timeout: 20_000 });
  await page.locator('.recadreur').getByRole('radio', { name: 'Carré' }).click();
  await page.locator('.recadreur input[type=range]').fill('3');
  await capturer(page, '12b_recadrage');
  await page.getByRole('button', { name: 'Valider le recadrage' }).click();
  await page.locator('.page-selection .tuile').nth(3).locator('.miniature-recadree').waitFor({ timeout: 20_000 });
  verifier((await page.locator('.page-selection .tuile').nth(3).getByText('✂').count()) === 1, 'touche K : photo recadrée en carré et redressée, miniature recadrée');
  await page.keyboard.press('t');
  await page.locator('.tri-rapide').waitFor();
  await page.locator('.tri-rapide img').waitFor({ timeout: 20_000 });
  await capturer(page, '12_tri_rapide');
  verifier((await page.locator('.tri-infos').innerText()).includes('Reste à décider : 0'), 'tri rapide plein écran avec compteur');
  await page.keyboard.press('Escape');

  // Aides IA de la sélection : étiquettes (API simulée), puis recherche locale.
  await page.getByRole('button', { name: /Étiqueter les photos avec l’IA/ }).click();
  await page.getByText(/photos? étiquetées?/).first().waitFor({ timeout: 60_000 });
  verifier(appels.etiquettes > 0, `étiquetage IA8 : ${appels.etiquettes} appel(s)`);
  const avantRecherche = await page.locator('.page-selection .tuile').count();
  await page.locator('.recherche-photos').fill('éléphants');
  await page.waitForTimeout(300);
  const apresRecherche = await page.locator('.page-selection .tuile').count();
  verifier(apresRecherche > 0 && apresRecherche < avantRecherche, `recherche en langage naturel « éléphants » : ${apresRecherche} photo(s) sur ${avantRecherche}`);
  await page.locator('.recherche-photos').fill('');
  await page.waitForTimeout(800);
  await capturer(page, '13_selection');

  // Flèches du clavier, panneau par période, zoom des miniatures, infobulle IA.
  await page.locator('.page-selection .tuile').nth(0).click();
  await page.keyboard.press('t');
  await page.locator('.tri-rapide img').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await capturer(page, '15_tri_rapide_ia');
  await page.keyboard.press('Escape');
  await page.locator('.page-selection .tuile').nth(0).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  verifier((await page.locator('.page-selection .tuile.choisie').count()) === 1 && (await page.locator('.page-selection .tuile').nth(2).getAttribute('class')).includes('choisie'), 'flèches du clavier : la sélection avance d’une photo à l’autre');
  await page.locator('.options-panneau select').selectOption('periode');
  const plats = await page.locator('.arbre.plat .nom-dossier').allInnerTexts();
  const parents = await page.locator('.arbre.plat .chemin-dossier').allInnerTexts();
  verifier(plats.length > 3 && parents.some((n) => n.includes('Thailande')), `panneau « Par période » : ${plats.length} dossiers à plat, le dossier parent sous le nom`);
  await page.locator('.options-panneau select').selectOption('arbre');
  await page.locator('.page-selection .barre-outils .curseur input').fill('500');
  await page.waitForTimeout(300);
  const largeur = await page.locator('.page-selection .tuile').first().evaluate((e) => e.getBoundingClientRect().width);
  verifier(largeur >= 480, `zoom des miniatures jusqu’à 600 px (case de ${Math.round(largeur)} px)`);
  await page.locator('.page-selection .barre-outils .curseur input').fill('160');
  const infobulle = await page.locator('.page-selection .tuile').first().getAttribute('title');
  verifier(infobulle.includes('« '), `infobulle avec la description de l’IA : ${infobulle.split('\n').slice(2).join(' / ')}`);

  await page.getByRole('button', { name: /Apprécier les photos avec l’IA/ }).click();
  await page.getByText(/photos? appréciées?/).first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.badge.note-ia').count()) > 0, `appréciation IA9 (${appels.appreciation} appel(s)) : notes sur les miniatures`);
  await page.locator('.page-selection .tuile').nth(0).click();
  await page.locator('.page-selection .tuile').nth(2).click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: /Meilleure de la sélection/ }).click();
  await page.getByText(/L’IA préfère/).first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.badge.choix-ia').count()) === 1, 'meilleure de la pile IA10 : badge « choix IA »');
  await page.locator('.page-selection .ligne-dossier', { has: page.locator('.nom-dossier', { hasText: /^VS_Max$/ }) }).click();
  await page.getByRole('button', { name: /Contrôler la sélection de cette sortie/ }).click();
  await page.getByText(/remarques? sur la sélection/).first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.remarques li').count()) > 0, 'contrôle de la sélection IA11 : remarques affichées');

  // Étape 10 : aperçu paginé et légende.
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Album$/ }).click();
  await page.locator('.section-album').first().waitFor();
  const sections = await page.locator('.section-album').count();
  const pages = await page.locator('.page-album-apercu').count();
  verifier(sections > 0 && pages > 0, `aperçu paginé : ${sections} section(s), ${pages} page(s)`);
  if (CAPTURES) {
    await page.locator('.planche').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await capturer(page, '14a_album_pages');
  }
  await page.locator('.aides-album > summary').click();
  await page.getByRole('button', { name: /Proposer titres et introductions/ }).click();
  await page.getByText(/propositions à relire/).first().waitFor({ timeout: 60_000 });
  await page.locator('.proposition-texte', { hasText: 'Titre IA' }).first().getByRole('button', { name: 'utiliser' }).first().click();
  await page.waitForTimeout(200);
  verifier((await page.locator('.titre-section').first().inputValue()) === 'Titre IA', `titre de section proposé par l’IA (IA12, ${appels.textes} appel(s)) et repris d’un clic`);
  await page.getByRole('button', { name: /Proposer des légendes/ }).click();
  // Même message que pour les titres : on attend que le bouton des légendes indique « déjà fait ».
  await page.getByRole('button', { name: /Proposer des légendes.*déjà fait/ }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: /Suggérer une couverture/ }).click();
  await page.getByText(/couvertures? proposées?/).first().waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'choisir comme couverture' }).first().click();
  await page.getByText(/copiée en tête de « Album »/).first().waitFor({ timeout: 5000 }).catch(async () => console.log('DEBUG couverture :', await page.locator('.aides-album').innerText()));
  verifier((await page.getByText(/copiée en tête de « Album »/).count()) >= 1, `couverture IA14 proposée (${appels.couverture} appel(s)) et choisie`);
  await page.getByRole('button', { name: /Relire l’album/ }).click();
  await page.getByText(/remarques? sur l’album/).first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.aides-album .remarques li').count()) > 0, 'relecture de l’album IA15 : remarques avec les pages');
  await page.locator('.photo-page').first().click();
  await page.locator('.panneau-photo textarea').fill('Le grand panorama');
  await page.getByRole('button', { name: 'Enregistrer la légende' }).click();
  await capturer(page, '14_album');
  await page.getByRole('button', { name: 'Tous les textes' }).click();
  verifier((await page.locator('.textes-album input').first().inputValue()) === 'Le grand panorama', 'légende enregistrée et visible dans le tableau des textes');
  verifier((await page.getByRole('button', { name: /Reprendre les \d+ légendes proposées/ }).count()) === 1, 'légendes IA13 proposées dans « Tous les textes »');

  // Étape 11 : Album/ écrit, numéroté, avec les textes.
  const listerSortie = () =>
    page.evaluate(async () => {
      const lister = async (d, p) => {
        const l = [];
        for await (const [nom, h] of d.entries()) {
          if (h.kind === 'directory') l.push(...(await lister(h, `${p}${nom}/`)));
          else l.push(`${p}${nom}`);
        }
        return l;
      };
      return (await lister(await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie'), '')).sort();
    });
  const ecrireSortie = async () => {
    await page.locator('.bandeau .etape', { hasText: /^.?\d+Sortie$/ }).click();
    await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
    await page.getByRole('button', { name: 'Écrire' }).click();
    await page.getByText('Tout est dans le dossier de sortie.').first().waitFor({ timeout: 60_000 });
  };
  await ecrireSortie();
  let fichiers = await listerSortie();
  verifier(fichiers.includes('Album/0000_Couverture.jpg'), 'couverture copiée en tête de Album/');
  let album = fichiers.filter((p) => p.startsWith('Album/') && p.endsWith('.jpg') && !p.startsWith('Album/0000_'));
  const attendues = Number(/(\d+) photos? retenues?/.exec(retenuesTexte)[1]) - 1;
  verifier(album.length === attendues, `Album/ contient les ${attendues} photos retenues`);
  verifier(album.every((p, i) => p.startsWith(`Album/${String(i + 1).padStart(4, '0')}_`)), 'numérotation continue 0001, 0002…');
  // La copie recadrée est carrée, et garde la date et l'appareil de l'original (EXIF).
  const carrees = await page.evaluate(async (chemins) => {
    let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie');
    d = await d.getDirectoryHandle('Album');
    const resultat = [];
    for (const c of chemins) {
      const fichier = await (await d.getFileHandle(c.slice('Album/'.length))).getFile();
      const image = await createImageBitmap(fichier);
      if (image.width === image.height) resultat.push({ c, exif: [...new Uint8Array(await fichier.slice(0, 4).arrayBuffer())].join(',') === '255,216,255,225' });
      image.close();
    }
    return resultat;
  }, album.filter((p) => !p.slice('Album/'.length).includes('/')));
  verifier(carrees.length === 1 && carrees[0].exif, `Album/ : une copie recadrée en carré, avec son EXIF (${carrees.map((x) => x.c).join(', ')})`);
  const jours = album.map((p) => p.split('_')[1]);
  verifier(jours.every((j, i) => i === 0 || j >= jours[i - 1]), 'ordre de l’album par journée');
  const textes = await page.evaluate(async () => {
    const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('Album');
    return (await (await d.getFileHandle('textes_album.md')).getFile()).text();
  });
  verifier(textes.includes('Le grand panorama'), 'textes_album.md contient la légende');
  verifier(!(await page.locator('.encart.bilan').innerText()).includes('hors du plan'), 'Album/ n’est pas compté « hors du plan » dans le bilan');
  verifier(fichiers.includes('.album/doublons.json') && fichiers.includes('.album/cache_ia.json') && fichiers.includes('.album/analyse.json'), 'analyses, propositions et cache IA enregistrés dans .album/');
  verifier(fichiers.some((p) => p.startsWith('_mis_de_cote/doublons/')), 'le doublon écarté est dans _mis_de_cote/doublons');

  // Retirer une photo de l'album : les suivantes sont renumérotées, l'ancienne copie retirée (I1).
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Sélection$/ }).click();
  await page.locator('.page-selection .tuile').nth(3).click();
  await page.keyboard.press('x');
  await ecrireSortie();
  fichiers = await listerSortie();
  album = fichiers.filter((p) => p.startsWith('Album/') && p.endsWith('.jpg') && !p.startsWith('Album/0000_'));
  verifier(album.length === attendues - 1 && album.every((p, i) => p.startsWith(`Album/${String(i + 1).padStart(4, '0')}_`)), 'photo retirée : Album/ renuméroté sans trou ni ancienne copie');
  await page.getByRole('button', { name: 'Vérifier à nouveau' }).waitFor();
  verifier(true, 'troisième passage : sortie et album à jour');

  if (CAPTURES) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.locator('.bandeau .etape', { hasText: 'Lieux et sorties' }).click();
    await ligne('VS_Max').click();
    await page.locator('.tuile img').first().waitFor();
    await page.locator('.tuile').first().dblclick();
    await page.locator('.visionneuse img').waitFor();
    await capturer(page, '08_visionneuse');
    await page.keyboard.press('Escape');
    await capturer(page, '07_arborescence_sombre');
    await page.locator('.bouton-menu').click();
    await page.getByRole('menuitem', { name: 'Réglages' }).click();
    await capturer(page, '09_reglages_sombre');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.locator('.bouton-menu').click();
    await page.getByRole('menuitem', { name: 'Configuration' }).click();
    await capturer(page, '10_configuration');
  }

  await page.waitForTimeout(5500);
  verifier((await page.locator('.message').count()) === 0, 'les messages disparaissent d’eux-mêmes');

  // Rechargement : le projet est retrouvé (accès déjà accordés dans cette session).
  await page.reload();
  await page.locator('.entete .projet', { hasText: 'Essai phase 1' }).waitFor({ timeout: 20_000 });
  verifier(true, 'après rechargement, le projet est rouvert');

  // Même page en file:// : elle démarre sans erreur.
  const fichier = await contexte.newPage();
  fichier.on('pageerror', (e) => erreurs.push(`file:// : ${e.message}`));
  await fichier.goto(`file://${join(APP, 'dist', 'album-photos.html')}`);
  await fichier.getByText(/Ouvrir un dossier déjà trié|Bonjour/).first().waitFor({ timeout: 20_000 });
  verifier(true, 'la page construite démarre en file://');

  // Interface en anglais : chaque page ouverte, aucune traduction manquante (D60).
  const anglais = await controlerAnglais(page, CAPTURES);
  verifier(anglais.manquantes.length === 0, `anglais : ${anglais.manquantes.length ? `traductions manquantes :\n    ${anglais.manquantes.join('\n    ')}` : 'aucune traduction manquante'}`);
  if (anglais.suspectes.length) console.log(`  Lignes à relire (peut-être restées en français) :\n    ${anglais.suspectes.join('\n    ')}`);
} catch (err) {
  if (erreurs.length) console.log(`Erreurs de la page :\n  ${erreurs.join('\n  ')}`);
  throw err;
} finally {
  await navigateur.close();
  serveur.kill();
}
if (erreurs.length) {
  console.log(`Erreurs de la page :\n  ${erreurs.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nEssai réussi : ${etape} vérifications.`);
process.exit(0);
