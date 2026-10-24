// Essai de bout en bout du parcours « Trier un nouveau dossier » (phase 3)
// dans Chromium sans affichage : un dossier en vrac (photos de
// tests/photos_reelles, une copie exacte, une capture d'écran, un dossier
// BESTOF et un dossier de mois gardés tels quels), inventaire, captures,
// doublons exacts, floues, tri par lieux (OpenStreetMap simulé : aucun appel
// réseau), puis création de la sortie et bilan.
//
// Usage (depuis app/) : node outils/essai_vrac.mjs   (CAPTURES=dossier pour des captures d'écran)

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { controlerAnglais } from './anglais.mjs';

const APP = fileURLToPath(new URL('..', import.meta.url));
const PHOTOS = join(APP, '..', 'tests', 'photos_reelles');
const PORT = 5183;
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES) ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : process.env;
const CAPTURES = process.env.CAPTURES;
// PROJET_EN=1 : le projet est créé en anglais (D60) ; interface en français, noms de la sortie et réponses IA en anglais.
const PROJET_EN = process.env.PROJET_EN === '1';
const N = PROJET_EN
  ? { captures: 'Screenshots', copies: '_set_aside/exact_duplicates', rapport: 'Report.html' }
  : { captures: 'Captures_ecran', copies: '_mis_de_cote/doublons_exacts', rapport: 'Rapport.html' };
const capturer = async (page, nom) => CAPTURES && page.screenshot({ path: join(CAPTURES, `${nom}.png`) });

let etape = 0;
const verifier = (condition, texte) => {
  etape++;
  if (!condition) throw new Error(`Échec (${etape}) : ${texte}`);
  console.log(`✓ ${texte}`);
};

const photos = readdirSync(PHOTOS).filter((f) => f.endsWith('.jpg') && !f.startsWith('Vacances'));
/** Le vrac : tout à la racine, sauf une photo dans BESTOF (copie voulue) et une dans « janvier ». */
const chemins = Object.fromEntries(photos.map((p) => [p, p]));

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
const requetesNominatim = [];
try {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  // OpenStreetMap simulé : un nom selon la latitude.
  await contexte.route('https://nominatim.openstreetmap.org/**', async (route) => {
    const url = new URL(route.request().url());
    requetesNominatim.push(url.searchParams.get('lat'));
    const lat = Number(url.searchParams.get('lat'));
    const nom = lat > 40 ? 'Annecy' : lat > 13 ? 'Kanchanaburi' : lat > 9.55 ? 'Mu Ko Ang Thong' : 'Ko Samui';
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { town: nom, country: 'Pays' }, display_name: nom }) });
  });
  // API Claude simulée (aucun appel réseau) : une réponse plausible selon la consigne.
  const appelsIA = { nommage: 0, fragments: 0, consolidation: 0, monumentsDemandes: 0, enAnglais: 0, total: 0 };
  const entetes = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await contexte.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: entetes });
    const corps = req.postDataJSON();
    const texte = corps.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    appelsIA.total++;
    if (String(corps.system ?? '').includes('écris en anglais')) appelsIA.enAnglais++;
    let reponse = {};
    if (texte.includes('"fusions"')) {
      appelsIA.consolidation++;
      reponse = { fusions: [], renommages: [] };
    } else if (texte.includes('"absorber"')) {
      appelsIA.fragments++;
      reponse = { absorber: false, cible: '', nom_propose: 'Arret_Route_15.07.26', confiance: 7, raison: 'scène différente' };
    } else if (texte.includes('Theme_Lieu')) {
      appelsIA.nommage++;
      if (texte.includes('"monuments"')) appelsIA.monumentsDemandes++;
      reponse = { monuments: ['Plage de Chaweng'], nom: `Sortie_Essai_${appelsIA.nommage}_18.07.26`, activite: 'visite', confiance: 9, justification: 'photos de plage' };
    } else if (texte.includes('"absorber"')) {
      appelsIA.fragments++;
      reponse = { absorber: false, cible: '', nom_propose: 'Arret_Route_15.07.26', confiance: 7, raison: 'scène différente' };
    } else if (texte.includes('"fusions"')) {
      appelsIA.consolidation++;
      reponse = { fusions: [], renommages: [] };
    }
    await route.fulfill({
      status: 200,
      headers: { ...entetes, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'msg_essai', type: 'message', role: 'assistant', model: corps.model, content: [{ type: 'text', text: JSON.stringify(reponse) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 300 } }),
    });
  });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
  });
  await page.goto(`http://localhost:${PORT}/album-photos.html`);

  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.multiple = true;
    c.id = 'remplissage';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#remplissage', photos.map((p) => join(PHOTOS, p)));
  await page.evaluate(async (chemins) => {
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
    const fichiers = [...document.getElementById('remplissage').files];
    for (const f of fichiers) await ecrire(chemins[f.name], f);
    const f0140 = fichiers.find((f) => f.name.startsWith('0140'));
    const f0141 = fichiers.find((f) => f.name.startsWith('0141'));
    // Copie exacte dans le vrac (proposée à l'écart), copies voulues dans BESTOF et janvier (gardées, D61).
    await ecrire('copie de 0140.jpg', f0140);
    await ecrire('BESTOF/0141_best.jpg', f0141);
    await ecrire('janvier/0141_janvier.jpg', f0141);
    // Capture d'écran (reconnue à son nom) : une petite image PNG.
    const canevas = new OffscreenCanvas(108, 234);
    canevas.getContext('2d').fillRect(0, 0, 10, 10);
    await ecrire('Screenshot_20260718-101010.png', await canevas.convertToBlob({ type: 'image/png' }));
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
  }, chemins);

  // Nouveau projet « Trier un nouveau dossier ».
  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).click();
  const choisir = page.getByRole('button', { name: 'Choisir…' });
  await choisir.nth(0).click();
  await page.getByText('« selecteur_source »').waitFor();
  await choisir.nth(1).click();
  await page.getByText('« selecteur_sortie »').first().waitFor();
  await page.fill('#nom-projet', 'Essai vrac');
  if (PROJET_EN) {
    await page.locator('details.avances > summary', { hasText: 'Réglages avancés' }).first().click();
    await page.selectOption('#langue-projet', 'en');
  }
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  // Étape 2 : inventaire, des informations seulement ; l'analyse des photos se fait toute seule (D56).
  await page.getByRole('button', { name: 'Valider et continuer' }).and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  const aVerifier = await page.locator('.a-verifier').innerText();
  verifier(aVerifier.includes('2 sous-dossiers') && aVerifier.includes('1 copie exacte'), `inventaire : ce qui attend aux étapes suivantes (${aVerifier.split('\n').slice(1, 3).join(' / ')})`);
  verifier((await page.locator('.outils-etape').innerText()).includes('Mettre à jour l’inventaire'), '« Mettre à jour l’inventaire » en haut de la page');
  verifier((await page.locator('#copies, #captures, .sous-dossiers').count()) === 0, 'ni copies, ni captures, ni sous-dossiers à l’inventaire (D61)');
  await capturer(page, 'v1_inventaire');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 3 : que faire des sous-dossiers (D61).
  await page.getByRole('heading', { name: /Dossiers/ }).waitFor();
  const lignes = await page.locator('.sous-dossiers tbody tr').allInnerTexts();
  verifier(lignes.length === 2 && lignes.some((l) => l.includes('BESTOF')) && lignes.some((l) => l.includes('janvier')), 'étape « Dossiers » : BESTOF et janvier listés');
  const actifs = await page.locator('.sous-dossiers [role=radio][aria-checked=true]').allInnerTexts();
  verifier(actifs.length === 2 && actifs.every((x) => x === 'Garder, nettoyer'), `« Garder, nettoyer » par défaut, en boutons (${actifs.join(', ')})`);
  const bestof = page.locator('.sous-dossiers tbody tr', { hasText: 'BESTOF' });
  await bestof.getByRole('radio', { name: 'Ne pas toucher' }).click();
  verifier((await bestof.getByRole('radio', { name: 'Ne pas toucher' }).getAttribute('aria-checked')) === 'true', 'un clic suffit pour changer de choix (BESTOF : ne pas toucher)');
  await capturer(page, 'v1b_dossiers');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 4 : floues.
  await page.getByRole('heading', { name: /Photos floues/ }).waitFor();
  const compteur = await page.locator('.compteur-floues').innerText();
  verifier(/photos? écartées?/.test(compteur), `curseur de netteté et compteur en direct : ${compteur}`);
  await page.locator('.curseur-flou input').fill(String(Math.round(Math.log(900) * 100)));
  const compteurHaut = await page.locator('.compteur-floues').innerText();
  verifier(compteurHaut !== compteur, `le compteur suit le curseur : ${compteurHaut}`);
  await page.getByRole('button', { name: /Revenir au réglage conseillé/ }).click();
  await capturer(page, 'v2_floues');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 5 : doublons, comparés journée par journée tant que le dossier est en vrac.
  await page.getByRole('heading', { name: /Doublons/ }).waitFor();
  verifier(true, 'après les floues, les doublons (nettoyer avant de ranger)');
  // Copies exactes en tête : un exemplaire gardé par emplacement, l'utilisateur peut changer (D61).
  await page.locator('#copies .groupe-exact').first().waitFor({ timeout: 60_000 });
  const aDecider = page.locator('#copies > .groupes-exacts > .groupe-exact');
  verifier((await aDecider.count()) === 1 && (await aDecider.first().locator('.exemplaire.ecarte').innerText()).includes('copie de 0140.jpg'), 'copies exactes : la copie du vrac est proposée à l’écart');
  verifier((await page.locator('#copies details summary').innerText()).includes('1 photo présente dans plusieurs dossiers'), 'copies voulues (BESTOF, janvier) : toutes gardées');
  await page.locator('#copies details summary').click();
  await capturer(page, 'v2b_copies');
  await page.getByRole('button', { name: 'Écarter 1 copie' }).click();
  await page.locator('#copies > .groupes-exacts').waitFor({ state: 'detached' });
  verifier(true, 'copie exacte écartée');
  // Les rafales se repèrent toutes seules à l'ouverture de la page.
  await page.locator('.apercu-lots > summary', { hasText: 'Aperçu par journée' }).waitFor({ timeout: 60_000 });
  verifier(true, 'dossier en vrac : rafales repérées toutes seules, journée par journée');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 6 : tri automatique ; les captures d'écran parmi les photos à trier se rangent d'abord.
  await page.getByRole('heading', { name: /Tri automatique/ }).waitFor();
  await page.getByRole('button', { name: /Ranger les 1 captures/ }).click();
  await page.getByText('1 capture rangée').waitFor();
  verifier(true, `capture d’écran rangée dans ${N.captures}, depuis le tri automatique`);
  await page.getByRole('button', { name: 'Calculer l’arborescence' }).click();
  await page.getByText(/dossiers? proposés?/).first().waitFor({ timeout: 60_000 });
  const resume = await page.locator('.resume-tri').innerText();
  verifier(/dossiers? proposés?/.test(resume), `résumé du tri : ${resume.split('.')[0]}`);
  verifier(requetesNominatim.length > 0, `${requetesNominatim.length} requête(s) à OpenStreetMap (simulé)`);
  await capturer(page, 'v3_tri');
  const avant = requetesNominatim.length;
  await page.locator('.tri-auto > summary').first().click();
  await page.getByRole('button', { name: 'Recalculer l’arborescence' }).click();
  await page.getByRole('button', { name: 'Recalculer', exact: true }).click();
  await page.waitForTimeout(500);
  verifier(requetesNominatim.length === avant, 'recalculer ne redemande pas les noms (cache)');
  verifier((await page.locator('.resume-tri').innerText()) === resume, 'recalculer avec les mêmes réglages donne la même arborescence');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 7 : lieux et sorties.
  await page.locator('.panneau-dossiers').waitFor();
  const noms = await page.locator('.ligne-dossier .nom-dossier').allInnerTexts();
  await capturer(page, 'v3a_lieux');
  verifier(noms.some((n) => n.startsWith('Ko_Samui')) && noms.some((n) => n.startsWith('Annecy')), `dossiers nommés d’après les lieux : ${noms.filter((n) => !['Photos (racine)', 'Mis de côté', 'Autres fichiers'].includes(n)).join(', ')}`);
  verifier(noms.includes('BESTOF') && noms.includes('janvier') && noms.includes(N.captures), 'dossiers gardés tels quels et captures conservés');
  verifier((await page.locator('.tete-organiser').count()) === 1, 'première visite : l’explication de l’étape est ouverte');
  await page.locator('.replier-entete').click();
  verifier((await page.locator('.tete-organiser').count()) === 0 && (await page.locator('.tete-vue').getByRole('button', { name: /^Aide/ }).count()) === 1, 'repliée, l’explication laisse un bouton « Aide » au bout de la ligne du titre');
  await page.getByRole('button', { name: 'Ligne de temps' }).click();
  const barres = await page.locator('.ldt-barre').count();
  await capturer(page, 'v3b_ligne_de_temps');
  verifier(barres >= 8, `ligne de temps : ${barres} dossiers en barres`);
  await page.locator('.ldt-barre').first().click();
  verifier((await page.locator('.ldt-barre').count()) === 0, 'un clic sur une barre ouvre le dossier');
  await page.getByRole('button', { name: 'Ligne de temps' }).click();
  verifier((await page.locator('.ldt-barre.actif').count()) >= 1, 'ligne de temps : le dossier choisi est mis en évidence');
  await page.getByRole('button', { name: 'Photos', exact: true }).click();

  // Étapes 8 à 10 (IA simulée).
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Petits dossiers/ }).waitFor();
  verifier(true, 'après les lieux et sorties, on passe aux petits dossiers (étape 8)');
  await capturer(page, 'v4_petits_dossiers');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Nommage/ }).waitFor();
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  const boutonNommage = page.getByRole('button', { name: /Nommer les sorties avec l’IA/ });
  verifier(/environ .* CHF/.test(await boutonNommage.innerText()), `nommage : coût estimé affiché (${await boutonNommage.innerText()})`);
  await boutonNommage.click();
  await page.getByText(/noms? proposés?/).first().waitFor({ timeout: 60_000 });
  verifier(appelsIA.nommage > 0, `nommage IA4 : ${appelsIA.nommage} dossier(s)`);
  await capturer(page, 'v5_nommage');
  verifier(appelsIA.monumentsDemandes === appelsIA.nommage && (await page.locator('.monuments').first().innerText()).includes('Plage de Chaweng'), 'monuments demandés dans le même appel que le nom et affichés');
  verifier((await page.getByRole('button', { name: /Reconnaître lieux et monuments/ }).count()) === 0, 'un seul bouton d’IA au nommage');
  await page.getByRole('button', { name: /Accepter les \d+ noms de confiance 8 ou plus/ }).click();
  await page.getByText(/dossiers? renommés?/).first().waitFor();
  verifier(true, 'noms de confiance 8 ou plus acceptés en un clic');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Consolidation/ }).waitFor();
  await page.getByRole('button', { name: /Proposer des fusions avec l’IA/ }).click();
  await page.getByText(/propositions? dans/).first().waitFor({ timeout: 60_000 });
  verifier(appelsIA.consolidation > 0, `consolidation IA6 : ${appelsIA.consolidation} répertoire(s) relus`);
  await capturer(page, 'v6_consolidation');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.locator('.page-selection').waitFor();
  verifier(true, 'étapes 8, 9 et 10 parcourues jusqu’à la sélection');

  // Sortie.
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Sortie$/ }).click();
  await page.getByRole('button', { name: 'Créer / mettre à jour la sortie' }).click();
  await page.getByRole('button', { name: 'Écrire' }).click();
  await page.getByText('Tout est dans le dossier de sortie.').first().waitFor({ timeout: 60_000 });
  const bilan = (await page.locator('.encart.bilan').innerText()).split('\n').find((l) => l.includes(' → '));
  verifier(!!bilan, `bilan complet : ${bilan}`);
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
  verifier(sortie.includes(`Photos/${N.captures}/Screenshot_20260718-101010.png`), `capture dans Photos/${N.captures} (${sortie.filter((p) => p.includes('Screenshot')).join(', ')})`);
  verifier(sortie.includes(`${N.copies}/copie de 0140.jpg`), `copie exacte dans ${N.copies}`);
  const racineSortie = await page.evaluate(async () => {
    const noms = [];
    for await (const nom of (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).keys()) noms.push(nom);
    return noms;
  });
  verifier(racineSortie.includes(N.rapport), `rapport écrit : ${N.rapport}`);
  verifier(PROJET_EN ? appelsIA.enAnglais === appelsIA.total && appelsIA.total > 0 : appelsIA.enAnglais === 0, `réponses de l’IA demandées en anglais : ${appelsIA.enAnglais} appel(s) sur ${appelsIA.total}`);
  verifier(sortie.includes('Photos/BESTOF/0141_best.jpg') && sortie.includes('Photos/janvier/0141_janvier.jpg'), 'dossiers gardés tels quels recopiés à l’identique');
  verifier(sortie.some((p) => /^Photos\/Sortie_Essai_\d+_18\.07\.26\/[^/]+\.jpg$/.test(p)), 'dossiers renommés d’après les noms proposés par l’IA');

  // Trier en plusieurs fois (D63) : des photos arrivent dans la source après un premier tri complet.
  const ecrireSortie = async () => {
    await page.locator('.bandeau .etape', { hasText: /^.?\d+Sortie$/ }).click();
    // « Vérifier à nouveau » quand il n'y a rien à écrire.
    await page.getByRole('button', { name: /Créer \/ mettre à jour la sortie|Vérifier à nouveau/ }).click();
    const ecrire = page.getByRole('button', { name: 'Écrire', exact: true });
    if (await ecrire.isVisible({ timeout: 2000 }).catch(() => false)) await ecrire.click();
    await page.locator('.encart.bilan').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    return page.locator('.encart.bilan').innerText();
  };
  await page.evaluate(async () => {
    const source = await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_source');
    const copier = async (depuis, dossier, nom) => {
      const octets = await (await (await source.getFileHandle(depuis)).getFile()).arrayBuffer();
      const d = dossier ? await source.getDirectoryHandle(dossier, { create: true }) : source;
      const w = await (await d.getFileHandle(nom, { create: true })).createWritable();
      // Quelques octets après la fin de l'image : un autre fichier, la même photo pour le décodeur.
      await w.write(new Blob([octets, new Uint8Array([1, 2, 3])]));
      await w.close();
    };
    const noms = [];
    for await (const nom of source.keys()) noms.push(nom);
    await copier(noms.find((n) => n.startsWith('0181')), '', 'nouvelle_1.jpg');
    await copier(noms.find((n) => n.startsWith('0107')), 'BESTOF', 'nouvelle_2.jpg');
  });
  const bilanAvant = await ecrireSortie();
  verifier(bilanAvant.includes('ne sont pas dans le projet') && !bilanAvant.includes('Tout est dans le dossier de sortie.'), 'sécurité : la sortie signale les 2 fichiers de la source absents du projet, et ne dit pas « tout est dans la sortie »');
  await page.reload();
  await page.locator('.bandeau-source').waitFor({ timeout: 20_000 });
  verifier((await page.locator('.bandeau-source').innerText()).includes('2 nouveaux fichiers'), 'à la réouverture, un bandeau annonce les 2 nouveaux fichiers');
  await page.locator('.bandeau-source').getByRole('button', { name: 'Mettre à jour l’inventaire' }).click();
  await page.getByText(/Inventaire mis à jour : 2 fichiers ajoutés/).first().waitFor({ timeout: 60_000 });
  verifier(true, 'inventaire mis à jour : 2 fichiers ajoutés, le reste gardé');
  await page.getByRole('button', { name: 'Valider et continuer' }).and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Tri automatique$/ }).click();
  await page.getByRole('button', { name: 'Ranger les 1 nouvelle photo' }).click();
  // Rangée quand l'alerte « pas encore rangée » disparaît (le nom du nouveau lieu est demandé à OpenStreetMap).
  await page.getByText('1 nouvelle photo pas encore rangée').waitFor({ state: 'detached', timeout: 60_000 });
  await capturer(page, 'v9_rangement');
  verifier(true, 'tri automatique : seule la nouvelle photo à trier est rangée');
  const bilanApres = await ecrireSortie();
  verifier(bilanApres.includes('Tout est dans le dossier de sortie.'), `après la mise à jour, bilan complet : ${bilanApres.split('\n').find((l) => l.includes(' → '))}`);
  const sortieApres = await page.evaluate(async () => {
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
  const anciens = sortie.filter((p) => p.startsWith('Photos/') || p.startsWith(`${N.copies.split('/')[0]}/`));
  verifier(anciens.every((p) => sortieApres.includes(p)), 'les fichiers déjà triés n’ont pas bougé dans la sortie');
  verifier(sortieApres.includes('Photos/BESTOF/nouvelle_2.jpg') && sortieApres.some((p) => /^Photos\/[^/]+\/nouvelle_1\.jpg$/.test(p) && !p.startsWith('Photos/BESTOF')), `nouvelles photos : l’une dans BESTOF (dossier gardé), l’autre rangée par le tri (${sortieApres.filter((p) => p.includes('nouvelle_')).join(', ')})`);

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
