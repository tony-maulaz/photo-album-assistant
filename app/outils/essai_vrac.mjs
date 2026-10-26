// Essai de bout en bout du parcours « Trier un nouveau dossier » (phase 3)
// dans Chromium sans affichage : un dossier en vrac (photos de
// tests/photos_reelles, une copie exacte, une capture d'écran, un dossier
// BESTOF et un dossier de mois gardés tels quels), inventaire, captures,
// doublons exacts, floues, tri par lieux (OpenStreetMap simulé : aucun appel
// réseau), puis création de la sortie et bilan.
//
// Usage (depuis app/) : node outils/essai_vrac.mjs   (CAPTURES=dossier pour des captures d'écran)

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  const appelsIA = { rafales: 0, nommage: 0, fragments: 0, consolidation: 0, monumentsDemandes: 0, enAnglais: 0, total: 0 };
  const entetes = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await contexte.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: entetes });
    const corps = req.postDataJSON();
    const texte = corps.messages[0].content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    appelsIA.total++;
    if (String(corps.system ?? '').includes('écris en anglais')) appelsIA.enAnglais++;
    let reponse = {};
    if (texte.includes('rafale/série') && texte.includes('"personnes"')) {
      appelsIA.rafales++;
      const n = corps.messages[0].content.filter((b) => b.type === 'image').length;
      reponse = {
        meilleure: 2,
        notes: Array(n).fill(7),
        pleine_page: false,
        justification: 'tout le monde est là',
        equivalentes: false,
        personnes: 2,
        photos: Array.from({ length: n }, (_, i) => ({ photo: i + 1, yeux_fermes: i === 0, flou_de_bouge: false, tete_coupee: false, vers_appareil: 2, raison: i === 0 ? 'yeux fermés' : 'regard vers l’appareil' })),
      };
    } else if (texte.includes('"fusions"')) {
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
    // Copie exacte dans le vrac (proposée à l'écart) ; 0141 aussi dans BESTOF (« Ne pas toucher » : copie voulue, gardée)
    // et dans janvier (« Garder, nettoyer » : la photo y a sa place, son exemplaire à trier est proposé à l'écart).
    await ecrire('copie de 0140.jpg', f0140);
    await ecrire('BESTOF/0141_best.jpg', f0141);
    await ecrire('janvier/0141_janvier.jpg', f0141);
    // Une photo seulement dans deux dossiers gardés (D86) : gardée dans les deux, à écarter d'un dossier si l'on veut.
    const fete = new Blob([await f0140.arrayBuffer(), new Uint8Array([9])]);
    await ecrire('janvier/fete.jpg', fete);
    await ecrire('janvier/fete/fete.jpg', fete);
    // Capture d'écran (reconnue à son nom) : une petite image PNG.
    const canevas = new OffscreenCanvas(108, 234);
    canevas.getContext('2d').fillRect(0, 0, 10, 10);
    await ecrire('Screenshot_20260718-101010.png', await canevas.convertToBlob({ type: 'image/png' }));
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
  }, chemins);

  // Calendrier familial (D83) : un dossier « config » avec un .ics, choisi plus loin depuis la page Configuration.
  const config = JSON.parse(readFileSync(join(APP, '..', 'config.exemple', 'config.json'), 'utf8'));
  Object.assign(config, { lieux_connus: [], appareils: [], calendriers: [{ fichier: 'calendriers/famille.ics', nom: 'famille', actif: true, inclure_recurrents: false }] });
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:voyage',
    'DTSTART;VALUE=DATE:20260714',
    'DTEND;VALUE=DATE:20260726',
    'SUMMARY:Voyage Thaïlande',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:lea',
    'DTSTART;VALUE=DATE:20260718',
    'DTEND;VALUE=DATE:20260719',
    'SUMMARY:18 ans de Lea',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  await page.evaluate(
    async ({ config, ics }) => {
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_config', { create: true });
      const ecrire = async (dossier, nom, texte) => {
        const w = await (await dossier.getFileHandle(nom, { create: true })).createWritable();
        await w.write(texte);
        await w.close();
      };
      await ecrire(d, 'config.json', JSON.stringify(config, null, 2));
      await ecrire(await d.getDirectoryHandle('calendriers', { create: true }), 'famille.ics', ics);
    },
    { config, ics },
  );

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
  verifier(aVerifier.includes('2 sous-dossiers') && aVerifier.includes('2 copies exactes'), `inventaire : ce qui attend aux étapes suivantes (${aVerifier.split('\n').slice(1, 3).join(' / ')})`);
  verifier((await page.locator('.outils-etape').innerText()).includes('Mettre à jour l’inventaire'), '« Mettre à jour l’inventaire » en haut de la page');
  verifier((await page.locator('#copies, #captures, .sous-dossiers').count()) === 0, 'ni copies, ni captures, ni sous-dossiers à l’inventaire (D61)');
  await capturer(page, 'v1_inventaire');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 3 : que faire des sous-dossiers (D61).
  await page.getByRole('heading', { name: /Dossiers/ }).waitFor();
  const LIGNES = '.sous-dossiers tr.ligne-sous-dossier';
  const lignes = await page.locator(LIGNES).allInnerTexts();
  verifier(lignes.length === 2 && lignes[0].includes('BESTOF') && lignes[1].includes('janvier'), 'étape « Dossiers » : BESTOF et janvier listés, par nom');
  const gauches = await page.locator(`${LIGNES} .nom-sous-dossier`).evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().left)));
  verifier(gauches.length === 2 && gauches[0] === gauches[1] && (await page.locator('.sous-dossiers img').count()) === 0, `noms alignés, aucune miniature avant un clic (D95 : ${gauches.join(', ')})`);
  await page.locator('.outils-sous-dossiers input[type=search]').fill('janv');
  const trouvees = await page.locator(LIGNES).allInnerTexts();
  verifier(trouvees.length === 1 && trouvees[0].includes('janvier') && (await page.locator('.outils-sous-dossiers').innerText()).includes('Pour 1 dossier trouvé'), 'étape « Dossiers » : la recherche filtre les sous-dossiers');
  await page.locator('.outils-sous-dossiers input[type=search]').fill('fete');
  const parSous = await page.locator(LIGNES).allInnerTexts();
  verifier(parSous.length === 1 && parSous[0].includes('janvier'), 'la recherche trouve un dossier par le nom de son sous-dossier (« fete » → janvier)');
  await page.locator('.outils-sous-dossiers input[type=search]').fill('');
  // Un dossier qui a des sous-dossiers le dit sous son nom (D92) et dans sa colonne (D95).
  const janvier = page.locator(LIGNES, { hasText: 'janvier' });
  const ligneJanvier = await janvier.locator('.sous-dossiers-ligne').innerText();
  verifier(ligneJanvier.includes('1 sous-dossier : fete') && ligneJanvier.includes('directement dans le dossier'), `étape « Dossiers » : sous-dossiers montrés sous le nom (${ligneJanvier})`);
  verifier((await janvier.locator('td.n').nth(2).innerText()).trim() === '1', 'colonne « Sous-dossiers » : 1 pour janvier');
  // Un dossier gardé de moins de 5 photos ne sera proposé ni aux Petits dossiers ni à la Consolidation : il le dit (D95).
  verifier((await janvier.locator('.signal-dossier').innerText()).includes('3 photos seules'), 'signal « 3 photos seules » sur janvier');
  const actifs = await page.locator('.sous-dossiers [role=radio][aria-checked=true]').allInnerTexts();
  verifier(actifs.length === 2 && actifs.every((x) => x === 'Garder, nettoyer'), `« Garder, nettoyer » par défaut, en boutons (${actifs.join(', ')})`);
  const bestof = page.locator(LIGNES, { hasText: 'BESTOF' });
  await bestof.getByRole('radio', { name: 'Ne pas toucher' }).click();
  verifier((await bestof.getByRole('radio', { name: 'Ne pas toucher' }).getAttribute('aria-checked')) === 'true', 'un clic suffit pour changer de choix (BESTOF : ne pas toucher)');
  verifier((await page.locator('.photos-ligne').count()) === 0, 'un clic sur un choix n’ouvre pas les photos');
  await janvier.getByRole('radio', { name: 'Trier' }).click();
  verifier((await janvier.locator('.signal-dossier').count()) === 0, 'à trier, le signal disparaît');
  await janvier.getByRole('radio', { name: 'Garder, nettoyer' }).click();
  // Les photos au clic sur la ligne, une seule ligne ouverte à la fois (D95).
  await bestof.locator('.nom-sous-dossier').click();
  verifier((await page.locator('.photos-ligne .bande-dossier figure').count()) === 1, 'clic sur BESTOF : sa photo s’affiche sous la ligne');
  await janvier.locator('.nom-sous-dossier').click();
  verifier((await page.locator('.photos-ligne').count()) === 1 && (await page.locator('.photos-ligne .bande-dossier figure').count()) === 3, 'clic sur janvier : ses 3 photos, BESTOF refermé');
  const pastilles = await page.locator('.pastilles-dossier button').allInnerTexts();
  verifier(pastilles.length === 3 && pastilles[0].startsWith('Tout') && pastilles[2].startsWith('fete'), `pastilles des sous-dossiers (${pastilles.join(' / ')})`);
  await page.waitForFunction(() => document.querySelectorAll('.photos-ligne .bande-dossier img').length === 3);
  await capturer(page, 'v1c_dossiers_photos');
  await page.locator('.pastilles-dossier button', { hasText: 'fete' }).click();
  verifier((await page.locator('.photos-ligne .bande-dossier figure').count()) === 1, 'pastille « fete » : la photo du sous-dossier seulement');
  await page.locator('.photos-ligne .photo-petit').first().click();
  // L'image affichée, la visionneuse écoute le clavier.
  await page.locator('.visionneuse img').waitFor();
  const aide = await page.locator('.visionneuse .aide-touches').innerText();
  verifier(!aide.includes('M pour déplacer'), `visionneuse sans « M pour déplacer » à cette étape (${aide})`);
  await page.keyboard.press('Escape');
  await page.locator('.visionneuse').waitFor({ state: 'detached', timeout: 5000 });
  await janvier.locator('.fleche-dossier').click();
  verifier((await page.locator('.photos-ligne').count()) === 0, 'la flèche referme la ligne');
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
  // Onglets (D71) : on arrive sur les copies exactes ; un exemplaire gardé par emplacement, l'utilisateur peut changer (D61).
  await page.locator('.onglet-doublons.actif', { hasText: 'Copies exactes' }).waitFor({ timeout: 60_000 });
  await page.locator('.carte-doublons').first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.onglet-doublons.actif').innerText()).includes('2 à valider'), 'onglets : on arrive sur « Copies exactes », 2 groupes à valider');
  const copie0140 = page.locator('.tuile-doublon[aria-label^="copie de 0140.jpg"]');
  verifier((await copie0140.getAttribute('class')).includes('a_ecarter'), 'copies exactes : la copie du vrac est proposée à l’écart (« à écarter »)');
  const carte0141 = page.locator('.carte-doublons', { hasText: '0141' });
  verifier(
    (await carte0141.locator('.tuile-doublon.choisie').count()) === 1 &&
      (await carte0141.locator('.tuile-doublon.a_ecarter').count()) === 1 &&
      (await page.locator('.carte-doublons', { hasText: 'BESTOF' }).count()) === 0,
    'copie déjà rangée dans janvier (« Garder, nettoyer ») : l’exemplaire à trier est proposé à l’écart ; BESTOF (« Ne pas toucher ») n’est pas examiné',
  );
  await capturer(page, 'v2b_copies');
  // Un clic garde la copie proposée à l'écart ; Ctrl+Z annule (la page ne perd rien).
  await copie0140.click();
  // Un clic choisit (« à garder »), sans rien valider : le groupe reste à valider (D101).
  await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label^="copie de 0140.jpg"]')?.classList.contains('choisie'));
  verifier((await page.locator('.onglet-doublons.actif').innerText()).includes('2 à valider') && (await page.locator('.pastille-attente').count()) === 1, 'un clic choisit sans valider : « Votre choix · pas encore validé », toujours 2 à valider');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label^="copie de 0140.jpg"]')?.classList.contains('a_ecarter'));
  verifier(true, 'un clic garde une copie proposée à l’écart ; Ctrl+Z annule');
  // Chaque bouton au-dessus de ce qu'il touche (D98) : l'explication sans bouton, puis la rangée de l'onglet, puis les filtres.
  const ordreBlocs = await page.evaluate(() => [...document.querySelectorAll('.encart-onglet, .rangee-onglet, .outils-doublons')].map((x) => x.className.split(' ').at(-1)));
  verifier(
    (await page.locator('.encart-onglet button').count()) === 0 &&
      ordreBlocs.join(',') === 'encart-onglet,rangee-onglet,outils-doublons' &&
      (await page.locator('.outils-doublons button', { hasText: 'Accepter' }).count()) === 0 &&
      (await page.locator('.rangee-onglet').innerText()).includes('Validés : 0 sur 2'),
    `boutons de tout l’onglet dans leur rangée, entre l’explication et les filtres : ${ordreBlocs.join(', ')}`,
  );
  const cartes = await page.locator('.carte-doublons').count();
  await page.locator('.rangee-onglet').getByRole('button', { name: 'Accepter les 2 propositions', exact: true }).click();
  await page.locator('.onglet-doublons.actif', { hasText: '✓ 2' }).waitFor();
  verifier(
    (await page.locator('.carte-doublons').count()) === cartes - 2,
    'copies exactes écartées : avec « À valider », les groupes acceptés s’en vont (D100)',
  );
  await page.locator('.onglet-doublons', { hasText: 'Mis de côté' }).click();
  await page.locator('.tuile-doublon.ecartee').first().waitFor();
  verifier((await page.locator('.tuile-doublon.ecartee').count()) === 2, 'onglet « Mis de côté » : les 2 copies écartées, prêtes à être remises');
  // Grouper par dossier : une copie se range sous chacun des dossiers de la source où elle a un exemplaire.
  await page.locator('.onglet-doublons', { hasText: 'Copies exactes' }).click();
  await page.getByRole('radio', { name: 'Tous' }).click();
  await page.locator('.outils-doublons select').first().selectOption('dossier');
  // Le chemin complet est dans l'infobulle ; la liste n'affiche que le dernier nom, en retrait sous son parent (D97).
  const cheminsSections = () => page.locator('.section-doublons').evaluateAll((l) => l.map((b) => b.getAttribute('title')));
  const sectionsDossiers = await cheminsSections();
  verifier(sectionsDossiers.length === 3 && ['Photos à trier', 'janvier', 'janvier/fete'].every((n) => sectionsDossiers.includes(n)), `copies groupées par dossier : ${sectionsDossiers.join(', ')}`);
  const fete = page.locator('.section-doublons[title="janvier/fete"]');
  verifier(
    (await fete.innerText()).split('\n')[0] === 'fete' && (await fete.evaluate((b) => parseFloat(getComputedStyle(b).paddingLeft))) > 20,
    'dossiers imbriqués : « fete » en retrait sous « janvier », sous son seul nom',
  );
  verifier((await page.locator('.sections-doublons .poignee-panneau').count()) === 1, 'liste des dossiers élargissable : poignée présente');
  const parNom = sectionsDossiers.slice(1).toSorted(new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare);
  verifier(sectionsDossiers[0] === 'Photos à trier' && parNom.every((n, i) => n === sectionsDossiers[i + 1]), 'dossiers des copies par ordre alphabétique, les photos à trier en tête');
  await page.locator('.recherche-sections').fill('fet');
  const trouves = await cheminsSections();
  verifier(trouves.length === 1 && trouves[0] === 'janvier/fete', `recherche d’un dossier : ${trouves.join(', ')}`);
  // Photo dans deux dossiers gardés : sous les groupes à relire, toute gardée ; celle du dossier choisi à gauche (D100).
  await fete.click();
  const premiersChemins = () => page.locator('.carte-doublons:not(.repliee) .photo-doublon:first-child .chemin-doublon').evaluateAll((l) => l.map((x) => x.textContent));
  verifier(
    (await page.locator('.titre-partout').innerText()).includes('tout est gardé') && (await page.locator('.carte-doublons .tuile-doublon.gardee').count()) === 2,
    'photo dans deux dossiers gardés : « Aussi dans d’autres dossiers gardés », les deux exemplaires gardés',
  );
  verifier((await premiersChemins()).every((c) => c === 'janvier/fete'), `groupé par dossier : la photo du dossier choisi à gauche (${(await premiersChemins()).join(', ')})`);
  verifier((await page.locator('.tete-section-doublons button').count()) === 0, 'en-tête de section sans boutons vers les sections voisines (N et P au clavier)');
  await capturer(page, 'v2b_copies_recherche');
  await page.locator('.recherche-sections').fill('best');
  verifier((await page.locator('.section-doublons').count()) === 0 && (await page.locator('.sections-doublons').innerText()).includes('Aucun dossier ne correspond.'), 'recherche sans résultat : « Aucun dossier ne correspond »');
  await page.locator('.recherche-sections').fill('');
  // Les photos à trier : leurs copies écartées sont relues (repliées) ; « Revoir » rouvre une carte, « Replier » la referme.
  await page.locator('.section-doublons', { hasText: 'Photos à trier' }).click();
  verifier((await premiersChemins()).every((c) => c === 'Photos à trier'), 'photos à trier : dans chaque groupe, leur exemplaire à gauche');
  const repliees = await page.locator('.carte-doublons.repliee').count();
  await page.locator('.carte-doublons.repliee').first().getByRole('button', { name: 'Revoir' }).click();
  await page.locator('.carte-doublons:not(.repliee)').getByRole('button', { name: 'Replier' }).first().click();
  verifier(repliees > 0 && (await page.locator('.carte-doublons.repliee').count()) === repliees, '« Revoir » rouvre une carte relue, « Replier » la referme');
  // Copies remises « à écarter » (Ctrl+Z) : le tri automatique proposera de les écarter d'abord (D85).
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.locator('.onglet-doublons.actif', { hasText: '2 à valider' }).waitFor();
  // Comparer en grand : le dossier de chaque photo, 1, 2… gardent ou écartent, ← → d'un groupe à l'autre (D100).
  await page.getByRole('radio', { name: 'À valider' }).click();
  await page.locator('.carte-doublons').first().getByRole('button', { name: 'Comparer en grand' }).click();
  const comparateur = page.locator('.comparateur');
  await comparateur.locator('.numero-volet').first().waitFor();
  verifier(
    (await comparateur.locator('.numero-volet').count()) >= 2 && (await comparateur.locator('.chemin-doublon').first().innerText()).length > 0,
    'comparer en grand : un numéro et le dossier sur chaque photo',
  );
  // La touche du numéro garde la photo proposée à l'écart ; Ctrl+Z annule.
  const n = 1 + (await comparateur.locator('.volet .etat-photo').evaluateAll((l) => l.findIndex((x) => x.classList.contains('a_ecarter'))));
  // Le clavier du comparateur s'installe juste après son premier affichage.
  await page.waitForTimeout(300);
  await page.keyboard.press(String(n));
  await comparateur.locator('.volet').nth(n - 1).locator('.etat-photo.choisie').waitFor();
  verifier(n > 0, `comparer en grand : la touche ${n} garde la photo ${n}`);
  const texteGroupe = await comparateur.locator('.navigation-groupes .discret').innerText();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((avant) => document.querySelector('.comparateur .navigation-groupes .discret')?.textContent !== avant, texteGroupe);
  verifier(true, `comparer en grand : → passe au groupe suivant (${texteGroupe})`);
  await page.keyboard.press('Escape');
  await comparateur.waitFor({ state: 'detached' });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.locator('.onglet-doublons.actif', { hasText: '2 à valider' }).waitFor();
  // « À valider » : un groupe accepté s'en va ; « Annuler » le fait revenir.
  const aRelire = await page.locator('.carte-doublons').count();
  await page.locator('.carte-doublons').first().locator('[data-action="accepter"]').click();
  await page.waitForFunction((n) => document.querySelectorAll('.carte-doublons').length === n - 1, aRelire);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.waitForFunction((n) => document.querySelectorAll('.carte-doublons').length === n, aRelire);
  verifier(true, '« À valider » : un groupe accepté s’en va, Ctrl+Z le fait revenir');
  // Les rafales sont cherchées avec l'analyse (D81) : elles sont déjà là.
  await page.locator('.onglet-doublons', { hasText: 'Rafales' }).click();
  await page.locator('.carte-doublons, .encart:has-text("Aucune rafale")').first().waitFor({ timeout: 60_000 });
  verifier(true, 'dossier en vrac : rafales repérées toutes seules, journée par journée');
  // Rafale : un clic choisit cette photo seule, l'autre passe « à écarter », rien n'est validé ; la case garde les deux (D101).
  const rafale = page.locator('.carte-doublons').first();
  await rafale.locator('.tuile-doublon.a_ecarter').first().click();
  await rafale.locator('.pastille-attente').waitFor();
  verifier(
    (await rafale.locator('.tuile-doublon.choisie').count()) === 1 && (await rafale.locator('.tuile-doublon.a_ecarter').count()) === 1 && (await rafale.locator('.tuile-doublon.ecartee').count()) === 0,
    'rafale : un clic choisit cette photo seule, l’autre « à écarter », rien n’est mis de côté',
  );
  await rafale.getByRole('checkbox', { name: 'Garder plusieurs photos' }).check();
  await rafale.locator('.tuile-doublon.a_ecarter').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.carte-doublons')[0].querySelectorAll('.tuile-doublon.choisie').length === 2);
  verifier(true, 'rafale : « Garder plusieurs photos » cochée, un clic ajoute la seconde');
  await capturer(page, 'v2c_rafales');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
  // IA des rafales (D102) : sa photo porte la ★, avec sa raison sous chaque photo ; un seul Ctrl+Z annule son choix.
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  await page.locator('.rangee-onglet').getByRole('button', { name: /^Choisir avec l’IA dans 1 rafale/ }).click();
  await rafale.locator('.avis-ia').waitFor();
  await capturer(page, 'v2d_rafales_ia');
  const tuilesIA = rafale.locator('.photo-doublon');
  verifier(
    appelsIA.rafales === 1 && (await tuilesIA.nth(1).locator('.etoile-doublon').count()) === 1 && (await tuilesIA.nth(0).locator('.raison-ia').innerText()).includes('yeux fermés'),
    'IA des rafales : la photo choisie par l’IA porte la ★, sa raison sous chaque photo',
  );
  if (await rafale.locator('.pastille-attente').count()) {
    verifier((await rafale.locator('.pastille-attente').innerText()).includes('Choix de l’IA') && (await rafale.locator('.tuile-doublon.choisie').count()) === 1, 'IA des rafales : son choix est posé, à valider');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
    verifier((await rafale.locator('.pastille-proposition').innerText()).includes('L’IA préfère la photo ★'), 'IA des rafales : choix annulé, la carte dit que l’IA préfère une autre photo');
  }
  await page.locator('.rangee-onglet').getByRole('button', { name: /^Choisir avec l’IA/ }).waitFor({ state: 'detached' });
  verifier(true, 'IA des rafales : déjà examinée, la rafale n’est plus proposée (relancer ne repaie pas)');
  await page.evaluate(() => sessionStorage.removeItem('album:cle_api'));
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 6 : tri automatique (D103) ; la liste « À faire » : captures d'écran, copies, maison, puis ranger.
  await page.getByRole('heading', { name: /Tri automatique/ }).waitFor();
  const captures = page.locator('.captures-avant-tri');
  verifier((await captures.innerText()).includes('1 photo ressemble à des captures d’écran') && (await captures.locator('.puce-afaire').innerText()) === '●', 'à faire : 1 capture d’écran trouvée, marquée ●');
  await captures.getByRole('button', { name: 'Les mettre à part' }).click();
  await page.getByText('1 capture d’écran mise à part').waitFor();
  verifier(true, `capture d’écran rangée dans ${N.captures}, la ligne passe à ✓`);
  const copies = page.locator('.copies-avant-tri');
  verifier((await copies.innerText()).includes('2 photos en double'), 'à faire : les 2 copies pas encore écartées sont signalées');
  await copies.getByRole('button', { name: 'Mettre 2 copies de côté' }).click();
  await copies.waitFor({ state: 'detached' });
  verifier(true, 'un clic met les copies de côté avant le tri');
  verifier((await page.locator('.ligne-afaire.afaire', { hasText: 'Votre maison n’est pas encore indiquée' }).count()) === 1, 'sans domicile : la maison est à indiquer (●)');
  verifier((await page.locator('.barre-validation .alerte').innerText()).includes('indiquer votre maison'), `barre du bas : ${await page.locator('.barre-validation .alerte').innerText()}`);
  // Avant de ranger : l'aperçu en direct, ligne par ligne, sans miniatures (D104).
  verifier((await page.locator('.resultat-tri .tete-resultat').innerText()).includes('Aperçu : rien n’est encore rangé') && (await page.locator('.resultat-tri .ligne-tri').count()) > 0, `aperçu avant de ranger : ${await page.locator('.resultat-tri .ligne-tri').count()} lignes`);
  verifier((await page.locator('.resultat-tri img').count()) === 0 && (await page.getByRole('button', { name: /^Couper|^Réunir/ }).count()) === 0, 'ni miniatures, ni « Couper… », ni « Réunir »');
  // Une seule question, et les chiffres calculés avec les photos avant de ranger.
  const chiffres = await page.locator('.ligne-ranger .apercu-tri-chiffres').innerText();
  const prevus = Number(chiffres.match(/(\d+) dossiers? en tout/)[1]);
  verifier(prevus > 0 && (await page.getByRole('radio', { name: /avec un sous-dossier par étape/ }).isChecked()), `avant de ranger : ${chiffres}`);
  await capturer(page, 'v3a_reglages_tri');
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger les photos', exact: true }).click();
  await page.locator('.ligne-ranger.fait').waitFor({ timeout: 60_000 });
  const resume = await page.locator('.ligne-ranger .texte-afaire > strong').innerText();
  verifier(/photos? rangées? dans \d+ dossiers?/.test(resume), `rangé : ${resume}`);
  verifier(requetesNominatim.length > 0, `${requetesNominatim.length} requête(s) à OpenStreetMap (simulé)`);
  const lignesTri = await page.locator('.resultat-tri .ligne-tri').count();
  verifier(lignesTri > 0 && (await page.locator('.resultat-tri .onglet-doublons.actif').innerText()).startsWith('Tout') && (await page.locator('.resultat-tri .tete-resultat').innerText()).includes('étape suivante'), `résultat : ${lignesTri} lignes dans l’onglet « Tout »`);
  verifier((await page.locator('.colonnes-tri > .resultat-tri').count()) === 1 && (await page.getByRole('button', { name: 'Afficher les dossiers →' }).count()) === 0, 'les dossiers à droite de la page, sans changer d’étape (D105)');
  await capturer(page, 'v3_tri');
  await page.locator('.resultat-tri .onglet-doublons', { hasText: 'Mis à part' }).click();
  verifier((await page.locator('.mis-a-part').innerText()).includes('Captures d’écran'), 'onglet « Mis à part » : la capture d’écran');
  await page.locator('.resultat-tri .onglet-doublons', { hasText: 'Tout' }).click();
  const avant = requetesNominatim.length;
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger à nouveau' }).click();
  await page.locator('.dialogue').getByRole('button', { name: 'Ranger à nouveau' }).click();
  await page.waitForTimeout(500);
  verifier(requetesNominatim.length === avant, 'recalculer ne redemande pas les noms (cache)');
  verifier((await page.locator('.ligne-ranger .texte-afaire > strong').innerText()) === resume, 'recalculer avec les mêmes réglages donne la même arborescence');
  // Configuration avec le calendrier familial, choisie depuis le menu (Fonctions IA, Configuration, …).
  await page.locator('.bouton-menu').click();
  await page.locator('.menu-deroulant [role=menuitem]').nth(1).click();
  await page.getByRole('button', { name: 'Choisir le dossier config…' }).click();
  await page.getByText(/Calendriers \(1\)/).waitFor();
  verifier(true, 'configuration avec un calendrier .ics choisie');
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Tri automatique$/ }).click();
  await page.getByRole('button', { name: 'Valider et continuer' }).click();

  // Étape 7 : lieux et sorties.
  await page.locator('.panneau-dossiers').waitFor();
  const noms = await page.locator('.ligne-dossier .nom-dossier').allInnerTexts();
  await capturer(page, 'v3a_lieux');
  verifier(noms.some((n) => n.startsWith('Ko_Samui')) && noms.some((n) => n.startsWith('Annecy')), `dossiers nommés d’après les lieux : ${noms.filter((n) => !['Photos (racine)', 'Mis de côté', 'Autres fichiers'].includes(n)).join(', ')}`);
  verifier(noms.includes('BESTOF') && noms.includes('janvier') && noms.includes(N.captures), 'dossiers gardés tels quels et captures conservés');
  // Les dossiers créés par le tri portent « nouveau » ; ceux de la source, non (D89).
  const ligneDe = (nom) => page.locator('.ligne-dossier', { has: page.locator('.nom-dossier', { hasText: new RegExp(`^${nom}`) }) }).first();
  verifier((await ligneDe('Ko_Samui').locator('.badge.cree').count()) === 1 && (await ligneDe('BESTOF').locator('.badge.cree').count()) === 0, 'étape 7 : « nouveau » sur les dossiers du tri, pas sur ceux de la source');
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
  // Plus d'encart des regroupements du calendrier à cette étape : ils passent à la Consolidation (D106).
  await capturer(page, 'v3c_calendrier');
  verifier((await page.locator('.regroupements-calendrier').count()) === 0, 'étape 7 : plus d’encart des regroupements du calendrier (D106)');
  // Le calendrier avec les photos (D94) : sous le nom du dossier et sur sa journée ; un clic sur l'événement de la
  // journée sélectionne les photos prises pendant.
  await ligneDe('Ko_Samui').click();
  const titreJour = (await page.locator('.titre-groupe').first().innerText()).replace(/\s+/g, ' ');
  await capturer(page, 'v3d_journee');
  verifier(
    (await ligneDe('Ko_Samui').locator('.evenement-dossier').innerText()).includes('18 ans de Lea') &&
      titreJour.includes('18 ans de Lea') &&
      titreJour.includes('Voyage Thaïlande'),
    `calendrier sous le nom du dossier et sur la journée : ${titreJour}`,
  );
  await page.locator('.titre-groupe .evenement-jour').first().click();
  verifier((await page.locator('.tuile.choisie').count()) === (await page.locator('.tuile').count()), 'un clic sur l’événement sélectionne ses photos');
  verifier((await page.getByRole('button', { name: 'Scinder par jour' }).count()) === 0, '« Scinder par jour » n’existe plus (D94)');
  // Fusionner avec… : les dossiers les plus proches dans le temps d'abord, les dossiers techniques en dernier.
  await page.getByRole('button', { name: 'Fusionner avec…' }).click();
  const choixFusion = await page.locator('.choix-dossiers li').allInnerTexts();
  await capturer(page, 'v3e_fusionner');
  await page.keyboard.press('Escape');
  verifier(
    choixFusion.length > 3 && /^Mu_Ko_Ang_Thong|^Kanchanaburi/.test(choixFusion[0]) && !choixFusion.slice(0, 3).some((c) => c.startsWith(N.captures)) && (await page.locator('.dialogue.deplacer').count()) === 0,
    `fusionner avec… : ${choixFusion.slice(0, 3).join(' | ')}`,
  );

  // Étapes 8 à 10 (IA simulée).
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Petits dossiers/ }).waitFor();
  verifier(true, 'après les lieux et sorties, on passe aux petits dossiers (étape 8)');
  await capturer(page, 'v4_petits_dossiers');
  // Un petit dossier à la fois, entre le dossier juste avant et juste après (D90).
  const nomCourant = () => page.locator('.tete-petit h2').innerText();
  const premierPetit = await nomCourant();
  verifier(
    (await page.locator('.liste-petits .ligne-liste-petit').count()) >= 2 && (await page.locator('.trio-petit .cote-petit:not(.vide)').count()) >= 1 && (await page.locator('.centre-petit .photo-petit').count()) >= 1,
    `petits dossiers : la liste à gauche, « ${premierPetit} » entre ses voisins, ses photos en grand`,
  );
  await page.locator('.cote-petit:not(.vide) button', { hasText: 'Mettre avec ce dossier' }).first().click();
  await page.getByText(/^Rangé avec « /).first().waitFor();
  await page.waitForFunction((avant) => document.querySelector('.tete-petit h2')?.textContent !== avant, premierPetit);
  verifier((await page.locator('.ligne-liste-petit.fait', { hasText: premierPetit }).count()) === 1, `« Mettre avec ce dossier » : rangé, coché dans la liste, et l’écran passe au suivant (${await nomCourant()})`);
  await page.keyboard.press('Control+z');
  await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
  verifier(true, 'Ctrl+Z : le petit dossier revient, à décider');
  await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
  await page.keyboard.press('g');
  await page.getByText('Gardé seul.').first().waitFor();
  await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
  await page.getByRole('button', { name: 'Annuler ce choix' }).click();
  await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
  verifier(true, 'touche G : gardé seul ; « Annuler ce choix » le remet à décider');
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
  await page.getByRole('heading', { name: /Nommage/ }).waitFor();
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  const boutonNommage = page.getByRole('button', { name: /Nommer les sorties avec l’IA/ });
  verifier(/environ .* CHF/.test(await boutonNommage.innerText()), `nommage : coût estimé affiché (${await boutonNommage.innerText()})`);
  await boutonNommage.click();
  await page.getByText(/noms? proposés?/).first().waitFor({ timeout: 60_000 });
  verifier(appelsIA.nommage > 0, `nommage IA4 : ${appelsIA.nommage} dossier(s)`);
  await capturer(page, 'v5_nommage');
  // Le titre d'un événement du calendrier, suivi du lieu, est proposé comme nom (D83, D88) ; le lieu et l'IA restent à un clic.
  const champs = await page.locator('input.nom-propose').evaluateAll((l) => l.map((x) => x.value));
  verifier(
    champs.includes('18 ans de Lea Ko Samui 18.07.26') && champs.includes('Voyage Thaïlande Kanchanaburi 15.07.26') && champs.includes('Voyage Thaïlande Kanchanaburi 16.07.26') && champs.includes('Voyage Thaïlande Mu Ko Ang Thong 21.07.26'),
    `noms tirés du calendrier (titre puis lieu) : ${champs.filter((v) => /Lea|Voyage/.test(v)).join(', ')}`,
  );
  verifier(appelsIA.monumentsDemandes === appelsIA.nommage && (await page.locator('.monuments').first().innerText()).includes('Plage de Chaweng'), 'monuments demandés dans le même appel que le nom et affichés');
  verifier((await page.getByRole('button', { name: /Reconnaître lieux et monuments/ }).count()) === 0, 'un seul bouton d’IA au nommage');
  await capturer(page, 'v5b_nommage_puces');
  verifier((await page.locator('.noms-possibles .nom-possible').count()) > 0, 'nommage : les noms possibles en un clic sous chaque champ');
  // Un seul événement candidat : renommé d'un coup ; Ko Samui (deux événements) attend le choix de l'utilisateur.
  await page.getByRole('button', { name: /^Prendre le nom du calendrier pour les \d+ dossiers/ }).click();
  await page.getByText(/dossiers? renommés?/).first().waitFor();
  verifier(true, 'noms du calendrier pris en un clic, seulement là où un seul événement convient');
  const accepter = page.getByRole('button', { name: /Accepter les? (\d+ noms|nom) de confiance 8 ou plus/ });
  if (await accepter.count()) {
    await accepter.click();
    verifier(true, 'noms de l’IA de confiance 8 ou plus acceptés en un clic');
  }
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
  verifier((await page.locator('.barre-validation .alerte').innerText()).includes('ranger 1 nouvelle photo'), 'à faire : la nouvelle photo à ranger (barre du bas)');
  await page.getByRole('button', { name: 'Ranger 1 nouvelle photo' }).click();
  // Rangée quand la ligne « Ranger » passe à ✓ (le nom du nouveau lieu est demandé à OpenStreetMap).
  await page.locator('.ligne-ranger.fait').waitFor({ timeout: 60_000 });
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
