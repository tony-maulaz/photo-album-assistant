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

/** La photo `id` telle qu'elle est écrite dans `.album/plan.json` (règle d'or 7), quand `condition` est vraie (3 s au plus). */
async function planEcrit(page, id, condition) {
  let f;
  for (let k = 0; k < 15; k++) {
    f = await page.evaluate(async (id) => {
      const album = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
      const plan = JSON.parse(await (await (await album.getFileHandle('plan.json')).getFile()).text());
      return plan.fichiers.find((x) => x.id === id) ?? null;
    }, id);
    if (f && condition(f)) return { ok: true, f };
    await page.waitForTimeout(200);
  }
  return { ok: false, f };
}

/**
 * Badges de Floues (D112, réponse 20) : un clic sur la bande donne l'autre sort, décidé par vous (punaise), sans
 * choisir la photo ; un second clic, dans les 0,5 s, est ignoré ; après, il rend la proposition ; un double-clic
 * n'ouvre pas la vue en grand ; la bande d'une autre photo, cliquée aussitôt, agit ; G, X et Suppr sur la photo choisie ; Ctrl+Z défait chaque geste. Tout est défait à la
 * fin : l'étape se valide comme avant.
 */
async function gestesBadge(page) {
  const etat = (i) =>
    page
      .locator('.page-floues .tuile')
      .nth(i)
      .evaluate((t) => {
        const b = t.querySelector('.badge-photo');
        return { id: t.dataset.id, sort: b?.dataset.sort, origine: b?.dataset.origine, decide: !!b?.hasAttribute('data-decide'), choisie: t.classList.contains('choisie') };
      });
  const bande = (i) => page.locator('.page-floues .tuile').nth(i).locator('.badge-photo button');
  const message = () => page.locator('.ligne-etape .message-entete').innerText();
  // Une photo proposée (ni « Écartée avant » ni décidée).
  const n = await page.locator('.page-floues .tuile').count();
  let i = 0;
  while (i < n && (await etat(i)).decide) i++;
  const e0 = await etat(i);
  verifier(!!e0.sort && !e0.decide, `badge de Floues : une photo proposée (${JSON.stringify(e0)})`);
  await bande(i).click();
  const e1 = await etat(i);
  verifier(e1.decide && e1.origine === 'vous' && e1.sort !== e0.sort, `clic sur la bande : l’autre sort, par vous (${JSON.stringify(e1)})`);
  verifier(!e1.choisie, 'clic sur la bande : la photo n’est pas choisie');
  verifier(/par vous/.test(await message()), `message après le clic : « ${await message()} »`);
  const ecrit1 = await planEcrit(page, e1.id, (f) => f.flou === (e1.sort === 'garder' ? 'sauvee' : 'ecartee') && f.origine?.flou === 'vous');
  verifier(ecrit1.ok, `clic sur la bande : la décision et son origine écrites dans .album/plan.json (${JSON.stringify(ecrit1.f?.origine)})`);
  // Second clic tout de suite : ignoré (garde de 0,5 s).
  await bande(i).click();
  verifier((await etat(i)).decide, 'second clic dans les 0,5 s : ignoré');
  await page.waitForTimeout(600);
  await bande(i).click();
  const e2 = await etat(i);
  verifier(!e2.decide && e2.sort === e0.sort, `second clic : retour à la proposition (${JSON.stringify(e2)})`);
  const ecrit2 = await planEcrit(page, e1.id, (f) => (f.flou === undefined || f.flou === 'auto') && !f.origine?.flou);
  verifier(ecrit2.ok, `second clic : décision et origine retirées de .album/plan.json (${JSON.stringify(ecrit2.f?.flou)})`);
  // Ctrl+Z défait le second clic, puis le premier.
  await page.keyboard.press('Control+z');
  verifier((await etat(i)).decide, 'Ctrl+Z défait le second clic');
  await page.keyboard.press('Control+z');
  verifier(!(await etat(i)).decide, 'Ctrl+Z défait le premier clic');
  // Double-clic sur la bande : pas de vue en grand (le premier clic seul compte).
  await page.waitForTimeout(600);
  await bande(i).dblclick();
  verifier((await page.locator('.visionneuse').count()) === 0, 'double-clic sur la bande : pas de vue en grand');
  verifier((await etat(i)).decide, 'double-clic sur la bande : un seul geste');
  await page.keyboard.press('Control+z');
  // La garde de 0,5 s est propre à chaque bande : la bande d'une autre photo, cliquée aussitôt après, agit.
  let j = i + 1;
  while (j < n && (await etat(j)).decide) j++;
  if (j < n) {
    await page.waitForTimeout(600);
    await bande(i).click();
    await bande(j).click();
    verifier((await etat(i)).decide && (await etat(j)).decide, 'deux bandes cliquées l’une après l’autre : chacune prend son geste');
    for (let k = 0; k < 2; k++) await page.keyboard.press('Control+z');
    verifier(!(await etat(i)).decide && !(await etat(j)).decide, 'Ctrl+Z défait les clics des deux bandes');
  }
  // Les touches, sur la photo choisie : G garde, X écarte (par vous), Suppr retire le choix.
  await page.locator('.page-floues .tuile').nth(i).locator('.cadre-miniature').click();
  await page.keyboard.press('g');
  const g = await etat(i);
  verifier(g.decide && g.origine === 'vous' && g.sort === 'garder', `G : gardée par vous (${JSON.stringify(g)})`);
  verifier((await planEcrit(page, g.id, (f) => f.flou === 'sauvee' && f.origine?.flou === 'vous')).ok, 'G : écrit dans .album/plan.json');
  await page.keyboard.press('x');
  const x = await etat(i);
  verifier(x.decide && x.origine === 'vous' && x.sort === 'ecarter', `X : écartée par vous (${JSON.stringify(x)})`);
  verifier((await planEcrit(page, x.id, (f) => f.flou === 'ecartee' && f.origine?.flou === 'vous')).ok, 'X : écrit dans .album/plan.json');
  const parVous = await page.locator('[data-filtre=vous] .compte-filtre').first().innerText();
  verifier(parVous.trim() === '1', `filtre « Par vous » : ${parVous}`);
  await page.keyboard.press('Delete');
  verifier(!(await etat(i)).decide, 'Suppr : retour à la proposition');
  verifier((await planEcrit(page, x.id, (f) => f.flou !== 'ecartee' && f.flou !== 'sauvee' && !f.origine?.flou)).ok, 'Suppr : retiré de .album/plan.json');
  await page.keyboard.press('Control+z');
  verifier((await etat(i)).sort === 'ecarter' && (await planEcrit(page, x.id, (f) => f.flou === 'ecartee' && f.origine?.flou === 'vous')).ok, 'Ctrl+Z défait Suppr, écrit dans .album/plan.json');
  for (let k = 0; k < 2; k++) await page.keyboard.press('Control+z');
  verifier(!(await etat(i)).decide && (await etat(i)).sort === e0.sort, 'Ctrl+Z défait G, X et Suppr');
  verifier((await planEcrit(page, x.id, (f) => f.flou !== 'ecartee' && f.flou !== 'sauvee' && !f.origine)).ok, 'Ctrl+Z : plus aucune décision ni origine dans .album/plan.json');
  // Un clic sur la bande ne lui donne pas le focus : Entrée reste à la photo choisie (vue en grand).
  await page.waitForTimeout(600);
  await bande(i).click();
  verifier(await page.evaluate(() => !document.activeElement?.closest('.badge-photo')), 'clic sur la bande : elle ne prend pas le focus');
  await page.keyboard.press('Control+z');
  // Dans un filtre, la photo cliquée en sort et la suivante prend sa place sous la souris : le second clic d'un
  // double-clic tombe sur sa bande, et doit être ignoré (garde de 0,5 s).
  if (n >= 2) {
    const k = i + 1 < n ? i + 1 : i - 1;
    await page.keyboard.press('Escape');
    await page.locator('.page-floues .tuile').nth(i).locator('.cadre-miniature').click();
    await page.locator('.page-floues .tuile').nth(k).locator('.cadre-miniature').click({ modifiers: ['Control'] });
    await page.keyboard.press('g');
    await page.keyboard.press('Escape');
    await page.locator('.ligne-etape [data-filtre=vous], .page-floues [data-filtre=vous]').first().click();
    verifier((await page.locator('.page-floues .tuile').count()) === 2, 'filtre « Par vous » : les deux photos gardées par vous');
    verifier((await page.locator('.page-floues .vide-grille').count()) === 0, 'filtre « Par vous » non vide : pas de message de grille vide');
    await page.waitForTimeout(600);
    await bande(0).dblclick();
    const restantes = await page.locator('.page-floues .tuile').count();
    verifier(restantes === 1 && (await etat(0)).decide, `double-clic dans le filtre « Par vous » : une seule photo revient à la proposition (${restantes} restante)`);
    verifier((await page.locator('.visionneuse').count()) === 0, 'double-clic dans le filtre : pas de vue en grand');
    for (let z = 0; z < 2; z++) await page.keyboard.press('Control+z');
    verifier((await page.locator('.page-floues .tuile').count()) === 0, 'Ctrl+Z défait le clic et G : filtre « Par vous » vide');
    const vides = await page.locator('.page-floues .vide-grille').allInnerTexts();
    verifier(vides.length === 1 && /filtre/.test(vides[0]), `filtre vide : un seul message, celui du filtre (${JSON.stringify(vides)})`);
    await page.locator('.ligne-etape [data-filtre=toutes], .page-floues [data-filtre=toutes]').first().click();
  }
  await page.keyboard.press('Escape');
}

/** Ce que dit la configuration choisie (`selecteur_config/config.json`), quand `condition` est vraie (3 s au plus). */
async function configEcrite(page, condition) {
  let c;
  for (let k = 0; k < 15; k++) {
    c = await page.evaluate(async () => {
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_config');
      return JSON.parse(await (await (await d.getFileHandle('config.json')).getFile()).text());
    });
    if (condition(c)) return { ok: true, c };
    await page.waitForTimeout(200);
  }
  return { ok: false, c };
}

/** Noms des dossiers écrits dans `.album/plan.json`, quand `condition` est vraie (3 s au plus). */
async function dossiersEcrits(page, condition) {
  let noms = [];
  let erreur = null;
  for (let k = 0; k < 15; k++) {
    try {
      noms = await page.evaluate(async () => {
        const album = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
        return JSON.parse(await (await (await album.getFileHandle('plan.json')).getFile()).text()).dossiers.map((d) => d.nom);
      });
      erreur = null;
    } catch (e) {
      // `plan.json` en cours d'écriture (NotFoundError, JSON coupé) : on relit un peu plus tard, quelques fois.
      erreur = e;
      noms = [];
    }
    if (!erreur && condition(noms)) return { ok: true, noms };
    await page.waitForTimeout(200);
  }
  if (erreur) throw erreur;
  return { ok: false, noms };
}

/**
 * L'icône calendrier d'une ligne du tri (D112 point 9) : sa bulle s'ouvre au survol (après 300 ms) et se ferme
 * quand la souris s'en va ; un clic l'épingle (elle reste), un clic ailleurs la ferme ; au clavier, le focus
 * l'ouvre, Entrée l'épingle, Échap la ferme et laisse le focus sur l'icône.
 */
async function essaiCalendrier(page) {
  const icone = page.locator('.resultat-tri .bouton-calendrier').first();
  await icone.waitFor();
  const bulle = page.locator('.bulle-calendrier');
  const nom = await icone.getAttribute('aria-label');
  verifier(/^Votre calendrier/.test(nom) && (await page.locator('.resultat-tri .lignes-tri').innerText()).includes('Votre calendrier') === false, `icône calendrier sur une ligne, sans phrase (nom lu : « ${nom} »)`);
  await icone.hover();
  await bulle.waitFor();
  await capturer(page, 'v3c_tri_calendrier');
  const texte = (await bulle.innerText()).replace(/\s+/g, ' ');
  verifier(/Votre calendrier pendant/.test(texte) && /Voyage Thaïlande|18 ans de Lea/.test(texte) && (await icone.getAttribute('aria-expanded')) === 'true', `survol : la bulle s’ouvre (« ${texte.slice(0, 120)} »)`);
  const place = await bulle.evaluate((b) => {
    const r = b.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
  });
  verifier(place, 'la bulle tient dans la fenêtre');
  await page.mouse.move(2, 450);
  await bulle.waitFor({ state: 'detached' });
  verifier(true, 'la souris s’en va : la bulle se ferme');
  await icone.click();
  await page.mouse.move(2, 450);
  await page.waitForTimeout(500);
  verifier((await bulle.count()) === 1 && (await bulle.innerText()).includes('Échap ou un clic ailleurs pour fermer'), 'clic : la bulle est épinglée, elle reste quand la souris s’en va');
  await page.locator('.resultat-tri .tete-resultat h2').click();
  await bulle.waitFor({ state: 'detached' });
  verifier(true, 'un clic ailleurs ferme la bulle épinglée');
  // Clavier : le focus venu du clavier l'ouvre ; Entrée l'épingle ; Échap la ferme, le focus reste sur l'icône.
  // Une touche d'abord : le focus donné ensuite est celui du clavier (:focus-visible), pas celui d'un clic.
  await page.keyboard.press('Tab');
  await icone.focus();
  await bulle.waitFor();
  verifier(true, 'au clavier, le focus sur l’icône ouvre la bulle');
  await page.keyboard.press('Enter');
  verifier((await bulle.innerText()).includes('Échap ou un clic ailleurs pour fermer'), 'Entrée épingle la bulle');
  await page.keyboard.press('Escape');
  await bulle.waitFor({ state: 'detached' });
  verifier(await icone.evaluate((b) => document.activeElement === b), 'Échap ferme la bulle, le focus reste sur l’icône');
  await icone.evaluate((b) => b.blur());
}

/**
 * La fenêtre « Vos lieux » (D112 point 9) : un lieu nommé de la configuration (« Plage ») ; on range à nouveau pour
 * que des dossiers portent son nom, puis on le corrige dans l'onglet « Nommés » : la carte annonce combien de dossiers
 * le prendront, la configuration et le plan changent ensemble, la fenêtre reste ouverte ; Ctrl+Z remet les deux.
 */
async function essaiLieux(page) {
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger autrement…' }).click();
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger à nouveau' }).click();
  await page.locator('.dialogue').getByRole('button', { name: 'Ranger à nouveau' }).click();
  const range = await dossiersEcrits(page, (n) => n.some((x) => /^Plage_\d/.test(x)));
  verifier(range.ok, `rangé de nouveau avec le lieu nommé : ${range.noms.filter((x) => x.startsWith('Plage')).join(', ')}`);
  const ligne = page.locator('.ligne-lieux');
  verifier(/Vos lieux : 1 lieu nommé/.test(await ligne.innerText()), `liste « À faire » : ${(await ligne.innerText()).replace(/\s+/g, ' ')}`);
  await ligne.getByRole('button', { name: 'Les voir…' }).click();
  const fenetre = page.locator('.fenetre[role=dialog]');
  await fenetre.waitFor();
  const onglets = await fenetre.locator('[role=tab]').evaluateAll((l) => l.map((b) => `${b.dataset.onglet}:${b.getAttribute('aria-selected')}:${b.textContent.trim()}`));
  verifier(
    (await fenetre.locator('h2').innerText()) === 'Vos lieux' && onglets.length === 2 && onglets[1].startsWith('nommes:true') && /tout est nommé/.test(onglets[0]),
    `fenêtre « Vos lieux », deux onglets, « Nommés » ouvert (${onglets.join(' | ')})`,
  );
  const carte = fenetre.locator('.carte-lieu').first();
  const champ = carte.getByRole('textbox', { name: 'Nom' });
  verifier((await champ.inputValue()) === 'Plage' && (await carte.getByRole('button', { name: 'Enregistrer' }).isDisabled()) && (await carte.innerText()).includes('nom inchangé'), 'carte du lieu nommé : le nom dans le champ, « Enregistrer » attend un changement');
  await fenetre.getByRole('tab', { name: /À nommer/ }).click();
  verifier((await fenetre.locator('.vide-lieux').innerText()).includes('Tout est nommé'), 'onglet « À nommer » : tout est nommé');
  await fenetre.getByRole('tab', { name: /Nommés/ }).click();
  await champ.fill('Plage Est');
  await capturer(page, 'v3d_lieux_nommes');
  const effet = (await carte.locator('.effet-renommage').innerText()).replace(/\s+/g, ' ');
  const prevus = Number(effet.match(/^(\d+) dossiers? de ce projet prendr/)?.[1] ?? 0);
  verifier(prevus > 0 && (await carte.getAttribute('class')).includes('modifiee'), `nom changé : la carte prend le filet vert et dit « ${effet} »`);
  await carte.getByRole('button', { name: 'Enregistrer' }).click();
  const config = await configEcrite(page, (c) => c.lieux_connus[0]?.nom === 'Plage_Est');
  verifier(config.ok, 'corriger un nom : la configuration dit « Plage_Est »');
  const renommes = await dossiersEcrits(page, (n) => !n.some((x) => /^Plage_\d/.test(x)) && n.some((x) => /^Plage_Est_\d/.test(x)));
  verifier(renommes.ok && renommes.noms.filter((x) => x.startsWith('Plage_Est')).length === prevus, `les dossiers qui portaient le nom automatique le prennent, écrit dans .album/plan.json : ${renommes.noms.filter((x) => x.startsWith('Plage')).join(', ')}`);
  verifier((await fenetre.count()) === 1 && (await champ.inputValue()) === 'Plage Est', 'la fenêtre ne se ferme pas toute seule après un nom');
  await page.keyboard.press('Escape');
  await fenetre.waitFor({ state: 'detached' });
  await page.keyboard.press('Control+z');
  const remis = await configEcrite(page, (c) => c.lieux_connus[0]?.nom === 'Plage');
  const remisPlan = await dossiersEcrits(page, (n) => n.some((x) => /^Plage_\d/.test(x)) && !n.some((x) => x.startsWith('Plage_Est')));
  verifier(remis.ok && remisPlan.ok, 'Ctrl+Z remet l’ancien nom, dans la configuration et dans les dossiers');
  // Le rangement avec le lieu nommé se défait aussi : la suite de l'essai retrouve les dossiers d'avant.
  await page.keyboard.press('Control+z');
  const avant = await dossiersEcrits(page, (n) => !n.some((x) => x.startsWith('Plage')));
  verifier(avant.ok, 'Ctrl+Z défait le second rangement : plus aucun dossier « Plage »');
}

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
  await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  const aVerifier = await page.locator('.a-verifier').innerText();
  verifier(aVerifier.includes('2 sous-dossiers') && aVerifier.includes('2 copies exactes'), `inventaire : ce qui attend aux étapes suivantes (${aVerifier.split('\n').slice(1, 3).join(' / ')})`);
  verifier((await page.locator('main[data-etape=inventaire] .outils-page').innerText()).includes('Mettre à jour l’inventaire'), '« Mettre à jour l’inventaire » en haut de la page, sous la ligne de l’étape');
  verifier((await page.locator('#copies, #captures, .sous-dossiers').count()) === 0, 'ni copies, ni captures, ni sous-dossiers à l’inventaire (D61)');
  await capturer(page, 'v1_inventaire');
  await page.locator('[data-action=valider]').click();

  // Étape 3 : que faire des sous-dossiers (D61).
  await page.locator('main[data-etape=dossiers]').waitFor();
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
  await page.locator('[data-action=valider]').click();

  // Étape 4 : floues.
  await page.locator('main[data-etape=floues]').waitFor();
  const compteur = await page.locator('.compteur-floues').innerText();
  verifier(/photos? (?:sera|seront) écartées?/.test(compteur), `curseur de netteté et compteur en direct : ${compteur}`);
  await page.locator('.curseur-flou input').fill(String(Math.round(Math.log(900) * 100)));
  const compteurHaut = await page.locator('.compteur-floues').innerText();
  verifier(compteurHaut !== compteur, `le compteur suit le curseur : ${compteurHaut}`);
  await page.getByRole('button', { name: /Revenir au réglage conseillé/ }).click();
  await capturer(page, 'v2_floues');
  await gestesBadge(page);
  await page.locator('[data-action=valider]').click();

  // Étape 5 : doublons, comparés journée par journée tant que le dossier est en vrac.
  await page.locator('main[data-etape=doublons]').waitFor();
  verifier(true, 'après les floues, les doublons (nettoyer avant de ranger)');
  // Onglets (D71) : on arrive sur les copies exactes ; un exemplaire gardé par emplacement, l'utilisateur peut changer (D61).
  await page.locator('.onglet-doublons.actif', { hasText: 'Copies exactes' }).waitFor({ timeout: 60_000 });
  await page.locator('.carte-doublons').first().waitFor({ timeout: 60_000 });
  verifier((await page.locator('.onglet-doublons.actif').innerText()).includes('2 à accepter'), 'onglets : on arrive sur « Copies exactes », 2 groupes à valider');
  const copie0140 = page.locator('.tuile-doublon[aria-label$=" · copie de 0140.jpg"]');
  verifier((await copie0140.getAttribute('class')).includes('a_ecarter'), 'copies exactes : la copie du vrac est proposée à l’écart (« à écarter »)');
  const carte0141 = page.locator('.carte-doublons', { hasText: '0141' });
  verifier(
    (await carte0141.locator('.tuile-doublon[aria-pressed=true]').count()) === 1 &&
      (await carte0141.locator('.tuile-doublon.a_ecarter').count()) === 1 &&
      (await page.locator('.carte-doublons', { hasText: 'BESTOF' }).count()) === 0,
    'copie déjà rangée dans janvier (« Garder, nettoyer ») : l’exemplaire à trier est proposé à l’écart ; BESTOF (« Ne pas toucher ») n’est pas examiné',
  );
  await capturer(page, 'v2b_copies');
  // Un clic garde la copie proposée à l'écart ; Ctrl+Z annule (la page ne perd rien).
  await copie0140.click();
  // Un clic choisit (« à garder »), sans rien valider : le groupe reste à valider (D101).
  await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label$=" · copie de 0140.jpg"]')?.classList.contains('choisie'));
  verifier((await page.locator('.onglet-doublons.actif').innerText()).includes('2 à accepter') && (await page.locator('.pastille-attente').count()) === 1, 'un clic choisit sans valider : « Votre choix · pas encore validé », toujours 2 à valider');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label$=" · copie de 0140.jpg"]')?.classList.contains('a_ecarter'));
  verifier(true, 'un clic garde une copie proposée à l’écart ; Ctrl+Z annule');
  // Badges (D112, É14 h) : la ligne d'un exemplaire porte sa bande, en bordure tant que le groupe n'est pas accepté ;
  // un clic sur la ligne en fait un choix « par vous », en plein.
  {
    const bande = () => page.locator('.tuile-doublon[aria-label$=" · copie de 0140.jpg"] .badge-photo').evaluate((b) => ({ sort: b.dataset.sort, origine: b.dataset.origine, decide: b.hasAttribute('data-decide'), mot: b.textContent }));
    const avant = await bande();
    await copie0140.click();
    await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label$=" · copie de 0140.jpg"] .badge-photo')?.hasAttribute('data-decide'));
    const apres = await bande();
    verifier(
      avant.sort === 'ecarter' && !avant.decide && avant.origine === 'application' && apres.sort === 'garder' && apres.decide && apres.origine === 'vous',
      `badge d’un exemplaire : « ${avant.mot} » en bordure, puis « ${apres.mot} » en plein après un clic`,
    );
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('.tuile-doublon[aria-label$=" · copie de 0140.jpg"]')?.classList.contains('a_ecarter'));
  }
  // Lot 4 (cadre commun) : l'explication de l'onglet est dans l'Aide (ouverte d'elle-même à 1440 px à la première
  // visite), ce qui touche tout l'onglet dans le menu « Toutes les copies » de la barre d'outils, les filtres en haut
  // de la liste de gauche, sans « Accepter ».
  const aideDoublons = await page.evaluate(() => ({ ouverte: !!document.querySelector('#panneau-aide .encart-onglet'), boutons: document.querySelectorAll('#panneau-aide .encart-onglet button').length }));
  if (aideDoublons.ouverte) await page.locator('[data-place=aide]').click();
  verifier(
    aideDoublons.ouverte &&
      aideDoublons.boutons === 0 &&
      (await page.locator('.outils-cadre .rangee-onglet [data-action=accepter-onglet]', { hasText: 'Accepter les 2 propositions' }).count()) === 1 &&
      (await page.locator('.outils-cadre .rangee-onglet button', { hasText: 'Garder tous les exemplaires' }).count()) === 1 &&
      (await page.locator('.page-doublons [aria-haspopup=true]:not(.menu-vue):not([data-action=menu-liste])').count()) === 0 &&
      (await page.locator('.sections-doublons .outils-doublons').count()) === 1 &&
      (await page.locator('.outils-doublons button', { hasText: /^Accepter/ }).count()) === 0 &&
      ((await page.locator('.rangee-onglet').getAttribute('title')) ?? '').includes('Acceptés : 0 sur 2'),
    'explication de l’onglet dans l’Aide, boutons de tout l’onglet en clair (plus de menu), filtres en haut de la liste de gauche',
  );
  // « Tous » allumé par défaut (C-4.8) ; un groupe accepté reste à sa place, replié (D100 levée le 27.10).
  verifier((await page.getByRole('radio', { name: 'Tous' }).getAttribute('aria-checked')) === 'true', 'Doublons : le filtre « Tous » est allumé par défaut (C-4.8)');
  const cartes = await page.locator('.carte-doublons').count();
  const ouvertes = await page.locator('.carte-doublons:not(.repliee)').count();
  // Accepter tout l'onglet ouvre d'abord une fenêtre qui chiffre (É14 d), titrée du mot du bouton ; rien n'est écarté
  // avant son plein ; Échap ne fait rien.
  await page.locator('[data-action=accepter-onglet]').click();
  const fenetreAccepter = page.locator('.dialogue[role=dialog]');
  await fenetreAccepter.waitFor();
  const texteFenetre = (await fenetreAccepter.innerText()).replace(/\s+/g, ' ');
  verifier(
    /Accepter les 2 propositions \?/.test(texteFenetre) && /2 photos seront écartées, toutes dans des groupes où vous n’avez rien choisi/.test(texteFenetre) && (await page.locator('.onglet-doublons.actif').innerText()).includes('2 à accepter'),
    `accepter tout l’onglet : une fenêtre chiffre d’abord, rien n’est écarté (« ${texteFenetre.slice(0, 120)} »)`,
  );
  await page.keyboard.press('Escape');
  await fenetreAccepter.waitFor({ state: 'detached' });
  verifier((await page.locator('.onglet-doublons.actif').innerText()).includes('2 à accepter'), 'la fenêtre fermée par Échap : rien n’est accepté');
  await page.locator('[data-action=accepter-onglet]').click();
  await fenetreAccepter.getByRole('button', { name: 'Accepter les 2 propositions', exact: true }).click();
  await page.locator('.onglet-doublons.actif .compte.fini', { hasText: '2' }).waitFor();
  verifier(
    (await page.locator('.carte-doublons').count()) === cartes && (await page.locator('.carte-doublons:not(.repliee)').count()) === ouvertes - 2,
    'copies exactes écartées : les groupes acceptés restent à leur place, repliés (D100 levée)',
  );
  // L'onglet fini : le plein mène au prochain onglet qui reste à accepter (É1), pas à une impasse.
  {
    const suite = page.locator('[data-action=onglet-suivant]');
    const rafalesRestent = /à accepter/.test(await page.locator('.onglet-doublons', { hasText: 'Rafales' }).innerText());
    verifier(!rafalesRestent || ((await suite.count()) === 1 && (await suite.innerText()).includes('Rafales')), 'Copies toutes acceptées : un plein « Rafales : N à accepter › »');
  }
  await page.locator('.onglet-doublons', { hasText: 'Écartées' }).click();
  await page.locator('.tuile-doublon.ecartee').first().waitFor();
  verifier((await page.locator('.tuile-doublon.ecartee').count()) === 2, 'onglet « Écartées » : les 2 copies écartées, prêtes à être remises');
  // Écartées (É14 j) : la bande en plein, l'icône du groupe accepté ; un clic la garde « par vous », un second l'écarte
  // de nouveau ; Ctrl+Z défait ; « Garder les 2 photos » remplace « Tout remettre ».
  {
    const bandes = () => page.locator('.grille-mis-de-cote .badge-photo').evaluateAll((l) => l.map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`));
    const avant = await bandes();
    await page.locator('.grille-mis-de-cote .badge-photo .clic-badge').first().click();
    await page.waitForFunction(() => document.querySelector('.grille-mis-de-cote .badge-photo')?.dataset.sort === 'garder');
    const apres = await bandes();
    // Le geste est écrit dans .album/plan.json (règle d'or 7) : la photo n'y est plus « mis_de_cote ».
    const nomEcartee = ((await page.locator('.grille-mis-de-cote .tuile-doublon').first().getAttribute('aria-label')) ?? '').split(' : ')[0];
    const statutEcrit = async (attendu) => {
      for (let k = 0; k < 15; k++) {
        const statut = await page.evaluate(async (nom) => {
          const album = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
          const plan = JSON.parse(await (await (await album.getFileHandle('plan.json')).getFile()).text());
          return plan.fichiers.find((x) => x.nom === nom)?.statut ?? null;
        }, nomEcartee);
        if ((statut === 'mis_de_cote') === attendu) return true;
        await page.waitForTimeout(200);
      }
      return false;
    };
    verifier(await statutEcrit(false), `« Écartées » : la photo remise (« ${nomEcartee} ») est écrite dans .album/plan.json`);
    await page.waitForTimeout(600);
    await page.locator('.grille-mis-de-cote .badge-photo .clic-badge').first().click();
    await page.waitForFunction(() => document.querySelector('.grille-mis-de-cote .badge-photo')?.dataset.sort === 'ecarter');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('.grille-mis-de-cote .badge-photo')?.dataset.sort === 'garder');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('.grille-mis-de-cote .badge-photo')?.dataset.sort === 'ecarter');
    verifier(await statutEcrit(true), '« Écartées » : après Ctrl+Z, la photo est de nouveau écartée dans .album/plan.json');
    verifier(
      avant.every((b) => b === 'ecarter:application:plein') && apres[0] === 'garder:vous:plein' && (await page.getByRole('button', { name: 'Garder les 2 photos' }).count()) === 1,
      `« Écartées » : bandes ${avant.join(', ')} ; un clic : ${apres[0]} ; second clic et Ctrl+Z ; « Garder les 2 photos »`,
    );
  }
  // Grouper par dossier : une copie se range sous chacun des dossiers de la source où elle a un exemplaire.
  await page.locator('.onglet-doublons', { hasText: 'Copies exactes' }).click();
  await page.getByRole('radio', { name: 'Tous' }).click();
  // « Grouper » et « Classer » : deux segmentés visibles dans la liste de gauche (É14 c), plus de liste déroulante.
  verifier((await page.locator('.outils-doublons select, .outils-doublons details').count()) === 0, 'Doublons : ni liste déroulante ni réglage replié dans la liste de gauche');
  await page.locator('.outils-doublons').getByRole('radio', { name: 'Dossier', exact: true }).click();
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
  // Lot 4 : aux Copies, la photo montrée une fois et une ligne par exemplaire ; celle du dossier choisi d'abord.
  const premiersChemins = () => page.locator('.carte-doublons:not(.repliee) .exemplaire:first-child strong.chemin-doublon').evaluateAll((l) => l.map((x) => x.textContent));
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
  await page.locator('.onglet-doublons.actif', { hasText: '2 à accepter' }).waitFor();
  // Comparer en grand : le dossier de chaque photo, 1, 2… gardent ou écartent, ← → d'un groupe à l'autre (D100).
  await page.getByRole('radio', { name: 'À accepter' }).click();
  await page.locator('.carte-doublons').first().getByRole('button', { name: 'Comparer en grand' }).click();
  const comparateur = page.locator('.comparateur');
  await comparateur.locator('.numero-volet').first().waitFor();
  await capturer(page, 'v2c_comparer');
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await capturer(page, 'v2d_comparer_sombre');
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  verifier(
    (await comparateur.locator('.numero-volet').count()) >= 2 && (await comparateur.locator('.chemin-doublon').first().innerText()).length > 0,
    'comparer en grand : un numéro et le dossier sur chaque photo',
  );
  // La touche du numéro garde la photo proposée à l'écart ; Ctrl+Z annule.
  const n = 1 + (await comparateur.locator('.volet .choix-photo').evaluateAll((l) => l.findIndex((x) => x.classList.contains('a_ecarter'))));
  // Le clavier du comparateur s'installe juste après son premier affichage.
  await page.waitForTimeout(300);
  await page.keyboard.press(String(n));
  await comparateur.locator('.volet').nth(n - 1).locator('.choix-photo.choisie').waitFor();
  verifier(n > 0, `comparer en grand : la touche ${n} garde la photo ${n}`);
  verifier(
    (await comparateur.locator('.volet').nth(n - 1).locator('.badge-photo').evaluate((b) => b.dataset.origine === 'vous' && b.hasAttribute('data-decide'))) &&
      (await comparateur.locator('.volet .badge-photo').count()) === (await comparateur.locator('.volet').count()),
    'comparer en grand : la même bande sous chaque photo, « par vous » en plein après la touche',
  );
  // Le fond vraiment peint (tour 0 de l'étape 2d) : le bouton de la bande reste transparent dans la vue (la règle des
  // boutons de Comparer le peignait en gris) ; plein et bordure s'y distinguent comme sur la page.
  const peint = await comparateur.locator('.volet .badge-photo').evaluateAll((l) =>
    l.map((b) => {
      const c = b.querySelector('.clic-badge') ?? b;
      const sb = getComputedStyle(b);
      return { decide: b.hasAttribute('data-decide'), bouton: c === b ? 'rgba(0, 0, 0, 0)' : getComputedStyle(c).backgroundColor, couleur: getComputedStyle(c).color === sb.color, fond: sb.backgroundColor, ombre: sb.boxShadow };
    }),
  );
  const pleins = peint.filter((p) => p.decide);
  const bords = peint.filter((p) => !p.decide);
  verifier(
    peint.every((p) => p.bouton === 'rgba(0, 0, 0, 0)' && p.couleur) && pleins.length > 0 && bords.length > 0 && bords.every((p) => p.ombre !== 'none' && !pleins.some((q) => q.fond === p.fond)),
    `comparer en grand : le fond peint de la bande, plein et bordure distincts (${peint.map((p) => `${p.decide ? 'plein' : 'bord'} ${p.fond} / bouton ${p.bouton}`).join(' ; ')})`,
  );
  // Ctrl+Z annule aussi dans la vue en grand, sans la fermer ; « Accepter » y porte le même libellé chiffré que la carte.
  await page.keyboard.press('Control+z');
  await comparateur.locator('.volet').nth(n - 1).locator('.choix-photo.a_ecarter').waitFor();
  verifier(
    (await comparateur.count()) === 1 &&
      ((await comparateur.locator('.navigation-groupes button.principal').textContent()) ?? '').trim() === 'Accepter' &&
      /^(garde|n’en garde)/.test((await comparateur.locator('.cmp-bas .dit-accepter').textContent()) ?? ''),
    'comparer en grand : Ctrl+Z annule sans fermer la vue ; « Accepter → », ce qu’il fera en gris à sa gauche, comme sur la carte',
  );
  await page.keyboard.press(String(n));
  await comparateur.locator('.volet').nth(n - 1).locator('.choix-photo.choisie').waitFor();
  const texteGroupe = await comparateur.locator('.position-groupe').innerText();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((avant) => document.querySelector('.comparateur .position-groupe')?.textContent !== avant, texteGroupe);
  verifier(true, `comparer en grand : → passe au groupe suivant (${texteGroupe})`);
  await page.keyboard.press('Escape');
  await comparateur.waitFor({ state: 'detached' });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.locator('.onglet-doublons.actif', { hasText: '2 à accepter' }).waitFor();
  // « À accepter » : un groupe accepté se replie à sa place (D100 levée) ; « Annuler » le rouvre.
  const aRelire = await page.locator('.carte-doublons:not(.repliee)').count();
  const toutes = await page.locator('.carte-doublons').count();
  await page.locator('.carte-doublons:not(.repliee)').first().locator('[data-action="accepter"]').click();
  await page.waitForFunction((n) => document.querySelectorAll('.carte-doublons:not(.repliee)').length === n - 1, aRelire);
  const resteLa = (await page.locator('.carte-doublons').count()) === toutes;
  // L'en-tête dit le geste à défaire (« Annuler : accepter 1 copie »), actif (tour 1 du lot 4, B1).
  const annulerEntete = await page.locator('.ligne-etape .bouton-annuler').evaluate((b) => ({ texte: b.textContent.replace(/\s+/g, ' ').trim(), actif: !b.disabled }));
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.waitForFunction((n) => document.querySelectorAll('.carte-doublons:not(.repliee)').length === n, aRelire);
  const retablirEntete = await page.locator('.ligne-etape .bouton-retablir').evaluate((b) => !b.disabled);
  verifier(resteLa, '« À accepter » : un groupe accepté se replie à sa place, Ctrl+Z le rouvre');
  verifier(annulerEntete.actif && /^Annuler : accepter 1 /.test(annulerEntete.texte) && retablirEntete, `en-tête : « ${annulerEntete.texte} » actif après « Accepter », « Rétablir » actif après Ctrl+Z`);
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
  await page.waitForFunction(() => document.querySelectorAll('.carte-doublons')[0].querySelectorAll('.tuile-doublon[aria-pressed=true]').length === 2);
  verifier(true, 'rafale : « Garder plusieurs photos » cochée, un clic ajoute la seconde');
  await capturer(page, 'v2c_rafales');
  // « choisir : toutes · aucune » après la case (É14 e) : « aucune » ne garde rien (l'alerte le dit), « toutes »
  // garde tout ; des choix en attente, chacun défait par Ctrl+Z ; ni « Tout garder », ni « Tout écarter », ni menu.
  {
    const nAttente = () => rafale.locator('.tuile-doublon.a_ecarter').count();
    const nGarde = () => rafale.locator('.tuile-doublon[aria-pressed=true]').count();
    await rafale.locator('[data-action=aucune]').click();
    await rafale.locator('.alerte-doublons').waitFor();
    const aucune = { attente: await nAttente(), garde: await nGarde() };
    await page.waitForTimeout(600);
    await rafale.locator('[data-action=toutes]').click();
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .alerte-doublons'));
    const toutes = { attente: await nAttente(), garde: await nGarde() };
    verifier(
      aucune.attente === 2 && aucune.garde === 0 && toutes.attente === 0 && toutes.garde === 2 && (await rafale.getByRole('button', { name: /^Tout (garder|écarter)|^Autres choix/ }).count()) === 0,
      `rafale : « aucune » (${aucune.garde} gardée, alerte), puis « toutes » (${toutes.garde} gardées), sans « Tout garder » ni « Autres choix »`,
    );
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('.carte-doublons')[0].querySelectorAll('.tuile-doublon[aria-pressed=true]').length === 2);
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
  // Ctrl+A (É14 e) : toutes les photos du groupe en cours, la case cochée ; Ctrl+Z défait.
  await page.keyboard.press('Control+a');
  await page.waitForFunction(() => document.querySelectorAll('.carte-doublons')[0].querySelectorAll('.tuile-doublon.a_ecarter').length === 0);
  verifier(await rafale.getByRole('checkbox', { name: 'Garder plusieurs photos' }).isChecked(), 'rafale : Ctrl+A choisit toutes les photos du groupe et coche « Garder plusieurs photos »');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
  await rafale.getByRole('checkbox', { name: 'Garder plusieurs photos' }).uncheck();
  // Badge d'une photo de rafale (É14 h) : « ✓ 1 · À garder » en bordure ; un clic sur la bande d'une photo « À écarter »
  // la garde par vous, à la place de l'autre ; un second clic revient à la proposition ; Ctrl+Z défait chaque clic.
  {
    const bandes = () => rafale.locator('.photo-doublon > .badge-photo').evaluateAll((l) => l.map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`).join('|'));
    const depart = await bandes();
    const iEcarter = await rafale.locator('.photo-doublon > .badge-photo').evaluateAll((l) => l.findIndex((b) => b.dataset.sort === 'ecarter'));
    const clic = () => rafale.locator('.photo-doublon > .badge-photo .clic-badge').nth(iEcarter).click();
    await clic();
    await rafale.locator('.pastille-attente').waitFor();
    const un = await bandes();
    await page.waitForTimeout(600);
    await clic();
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
    const deux = await bandes();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await rafale.locator('.pastille-attente').waitFor();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
    verifier(
      /^garder:(application|ia):bord\|ecarter:(application|ia):bord$|^ecarter:(application|ia):bord\|garder:(application|ia):bord$/.test(depart) && un.split('|').every((b) => b.endsWith(':vous:plein')) && deux === depart,
      `badges d’une rafale : ${depart} → clic ${un} → second clic ${deux} ; Ctrl+Z défait chaque clic`,
    );
    verifier((await rafale.locator('.photo-doublon > .badge-photo').first().textContent()).includes('1 ·'), 'la place de la photo dans sa bande, après l’icône (« ✓ 1 · À garder »)');
  }
  // G et X sur la photo qui a le focus (É14, testeur) : G la garde par vous (l'autre passe « à écarter » dans une
  // rafale sans la case), X fixe « à écarter » par vous ; chaque geste écrit dans .album/plan.json (règle d'or 7) ;
  // Ctrl+Z défait l'un puis l'autre, et le plan revient sans choix.
  {
    const tuile = rafale.locator('.tuile-doublon.a_ecarter').first();
    const id = await tuile.getAttribute('data-id');
    const cible = rafale.locator(`.tuile-doublon[data-id="${id}"]`);
    const bandeCible = () => rafale.locator(`.photo-doublon:has(.tuile-doublon[data-id="${id}"]) > .badge-photo`).evaluate((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`);
    await cible.focus();
    await page.keyboard.press('g');
    await page.waitForFunction((id) => document.querySelector(`.carte-doublons .tuile-doublon[data-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
    const apresG = { bande: await bandeCible(), autres: await rafale.locator('.tuile-doublon.a_ecarter').count(), ecrit: (await planEcrit(page, id, (f) => f.choixDoublons?.doublons === true)).ok };
    await cible.focus();
    await page.keyboard.press('x');
    await page.waitForFunction((id) => document.querySelector(`.carte-doublons .tuile-doublon[data-id="${id}"]`)?.classList.contains('a_ecarter'), id);
    const apresX = { bande: await bandeCible(), ecrit: (await planEcrit(page, id, (f) => f.choixDoublons?.doublons === false)).ok };
    verifier(
      apresG.bande === 'garder:vous:plein' && apresG.autres === 1 && apresG.ecrit && apresX.bande === 'ecarter:vous:plein' && apresX.ecrit,
      `Doublons : G → ${apresG.bande} (l’autre à écarter), X → ${apresX.bande} ; chacun écrit dans .album/plan.json`,
    );
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction((id) => document.querySelector(`.carte-doublons .tuile-doublon[data-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
    const defait = await planEcrit(page, id, (f) => f.choixDoublons?.doublons === undefined);
    verifier(defait.ok && (await bandeCible()).endsWith(':bord'), 'Doublons : Ctrl+Z défait X puis G ; plus aucun choix dans .album/plan.json, la bande revient en bordure');
  }
  // Bande d'un groupe accepté (C-9.12, testeur, tour 1) : « Revoir » rouvre la rafale acceptée ; un clic sur la bande
  // de la photo écartée la garde par vous, en plein, sans rouvrir le groupe (aucun « pas encore accepté ») ; le geste
  // est écrit dans .album/plan.json ; Ctrl+Z le défait, puis l'acceptation (la suite de l'essai part du groupe proposé).
  {
    const cle = await rafale.getAttribute('data-cle');
    const carte = page.locator(`.carte-doublons[data-cle="${cle}"]`);
    await carte.locator('[data-action=accepter]').click();
    await page.locator(`.carte-doublons.repliee[data-cle="${cle}"]`).waitFor();
    // « Revoir » ignore un clic dans les 0,5 s après « Accepter » (double-clic) : on attend comme un humain.
    await page.waitForTimeout(600);
    await carte.getByRole('button', { name: 'Revoir' }).click();
    await carte.locator('.photo-doublon > .badge-photo').first().waitFor();
    const bandes = () => carte.locator('.photo-doublon > .badge-photo').evaluateAll((l) => l.map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`));
    const avant = await bandes();
    const i = avant.findIndex((b) => b.startsWith('ecarter'));
    const id = await carte.locator('.photo-doublon').nth(i).locator('.tuile-doublon').getAttribute('data-id');
    const ecarteeAvant = (await planEcrit(page, id, (f) => f.statut === 'mis_de_cote')).ok;
    await carte.locator('.photo-doublon > .badge-photo .clic-badge').nth(i).click();
    await page.waitForFunction(([cle, i]) => document.querySelectorAll(`.carte-doublons[data-cle="${cle}"] .photo-doublon > .badge-photo`)[i]?.dataset.sort === 'garder', [cle, i]);
    const apres = await bandes();
    const gardeeEcrite = (await planEcrit(page, id, (f) => f.statut !== 'mis_de_cote')).ok;
    const attente = await carte.locator('.pastille-attente').count();
    verifier(
      i >= 0 && avant[i].endsWith(':plein') && apres[i] === 'garder:vous:plein' && apres.every((b) => b.endsWith(':plein')) && attente === 0 && ecarteeAvant && gardeeEcrite,
      `bande d’une rafale acceptée : ${avant.join(' | ')} → clic ${apres.join(' | ')}, le groupe reste accepté ; écrit dans .album/plan.json`,
    );
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(([cle, i]) => document.querySelectorAll(`.carte-doublons[data-cle="${cle}"] .photo-doublon > .badge-photo`)[i]?.dataset.sort === 'ecarter', [cle, i]);
    const defaitEcrit = (await planEcrit(page, id, (f) => f.statut === 'mis_de_cote')).ok;
    // Ctrl+A (« toutes ») dans le groupe accepté : la photo écartée revient tout de suite, sans rouvrir le groupe ;
    // Ctrl+Z la rend écartée.
    await carte.locator('.tuile-doublon').first().focus();
    await page.keyboard.press('Control+a');
    await page.waitForFunction((cle) => [...document.querySelectorAll(`.carte-doublons[data-cle="${cle}"] .photo-doublon > .badge-photo`)].every((b) => b.dataset.sort === 'garder'), cle);
    const toutes = { attente: await carte.locator('.pastille-attente').count(), ecrit: (await planEcrit(page, id, (f) => f.statut !== 'mis_de_cote' && f.choixDoublons === undefined)).ok };
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(([cle, i]) => document.querySelectorAll(`.carte-doublons[data-cle="${cle}"] .photo-doublon > .badge-photo`)[i]?.dataset.sort === 'ecarter', [cle, i]);
    verifier(toutes.attente === 0 && toutes.ecrit, 'Ctrl+A dans une rafale acceptée : toutes gardées tout de suite, le groupe reste accepté (C-9.12) ; Ctrl+Z la rend écartée');
    await page.keyboard.press('Control+z');
    await page.locator(`.carte-doublons.en-attente[data-cle="${cle}"]`).waitFor();
    verifier(defaitEcrit && (await planEcrit(page, id, (f) => f.statut !== 'mis_de_cote')).ok, 'bande d’une rafale acceptée : Ctrl+Z rend la photo écartée (écrit), un second Ctrl+Z défait l’acceptation');
  }
  // IA des rafales (D102) : sa photo porte la ★, avec sa raison sous chaque photo ; un seul Ctrl+Z annule son choix.
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  // É14 : ce qui touche tout l'onglet est écrit en clair dans la barre d'outils, son prix sur le bouton.
  await page.locator('.rangee-onglet').getByRole('button', { name: /^Choisir avec l’IA dans 1 rafale/ }).click();
  await rafale.locator('.avis-ia').waitFor();
  await capturer(page, 'v2d_rafales_ia');
  const tuilesIA = rafale.locator('.photo-doublon');
  verifier(
    appelsIA.rafales === 1 && (await tuilesIA.nth(1).locator('.etoile-doublon').count()) === 1 && (await tuilesIA.nth(0).locator('.raison-ia').innerText()).includes('yeux fermés'),
    'IA des rafales : la photo choisie par l’IA est « Conseillée par l’IA », sa raison sous chaque photo',
  );
  if (await rafale.locator('.pastille-attente').count()) {
    verifier((await rafale.locator('.pastille-attente').innerText()).includes('Choix de l’IA') && (await rafale.locator('.tuile-doublon.choisie').count()) === 1, 'IA des rafales : son choix est posé, à valider');
    // Règle d'or 3 : le choix de l'IA reste une proposition (✦ en bordure, jamais la punaise), marqué « IA » dans le plan.
    const bandesIA = await rafale.locator('.photo-doublon > .badge-photo').evaluateAll((l) => l.map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`));
    const idIA = await rafale.locator('.tuile-doublon.choisie').getAttribute('data-id');
    const marqueIA = (await planEcrit(page, idIA, (f) => f.choixIA?.doublons === true && f.choixDoublons?.doublons === true)).ok;
    verifier(
      bandesIA.includes('garder:ia:bord') && bandesIA.every((b) => b.endsWith(':bord') && !b.includes(':vous:')) && marqueIA,
      `IA des rafales : son choix reste une proposition (${bandesIA.join(' | ')}), marqué « IA » dans .album/plan.json`,
    );
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('.carte-doublons .pastille-attente'));
    verifier((await rafale.locator('.pastille-proposition').innerText()).includes('L’IA conseille une autre photo'), 'IA des rafales : choix annulé, la carte dit que l’IA conseille une autre photo');
  }
  await page.locator('.rangee-onglet').getByRole('button', { name: /^Choisir avec l’IA/ }).waitFor({ state: 'detached' });
  verifier(true, 'IA des rafales : déjà examinée, la rafale n’est plus proposée (relancer ne repaie pas)');
  await page.evaluate(() => sessionStorage.removeItem('album:cle_api'));
  // Des copies exactes restent (É14 g) : la barre du bas le dit en brun ; « Valider et continuer » ouvre une fenêtre
  // à trois choix ; Échap = « Les voir d'abord » (l'onglet Copies s'ouvre) ; « Continuer sans elles » laisse le tri
  // les signaler (D85).
  {
    const brun = await page.locator('.barre-validation .reste-copies').evaluate((e) => ({ texte: e.textContent, couleur: getComputedStyle(e).color }));
    await page.locator('[data-action=valider]').click();
    const fenetre = page.locator('.dialogue[role=dialog]');
    await fenetre.waitFor();
    const choix = await fenetre.locator('[data-choix]').evaluateAll((l) => l.map((b) => `${b.dataset.choix}:${b.className}`));
    const titre = await fenetre.locator('h2').innerText();
    await page.keyboard.press('Escape');
    await fenetre.waitFor({ state: 'detached' });
    await page.locator('.onglet-doublons.actif', { hasText: 'Copies exactes' }).waitFor();
    verifier(
      /2 copies exactes pas encore acceptées/.test(brun.texte) && /2 copies exactes ne sont pas encore acceptées/.test(titre) && choix.join(',') === 'sans:,voir:,accepter:principal',
      `copies restantes : « ${brun.texte} » (${brun.couleur}) ; fenêtre « ${titre} » (${choix.join(', ')}) ; Échap : l’onglet Copies`,
    );
    // Un groupe où l'utilisateur a écarté tous les exemplaires (testeur, tour 1) : « Accepter … » n'accepte que les
    // autres et la fenêtre dit qu'il reste à voir ; sans aucun groupe acceptable, ni « Accepter les N propositions »
    // (désactivé, sa raison dans son libellé) ni le choix « Accepter … » ; Ctrl+Z défait les deux X.
    {
      const xSurGardee = async (k) => {
        const carte = page.locator('.carte-doublons.en-attente').nth(k);
        const gardee = carte.locator('.tuile-doublon[aria-pressed=true]').first();
        const id = await gardee.getAttribute('data-id');
        await gardee.focus();
        await page.keyboard.press('x');
        await page.waitForFunction((id) => document.querySelector(`.tuile-doublon[data-id="${id}"]`)?.getAttribute('aria-pressed') === 'false', id);
        return id;
      };
      const ouvrirFenetre = async () => {
        await page.locator('[data-action=valider]').click();
        await fenetre.waitFor();
        const r = {
          texte: (await fenetre.innerText()).replace(/\s+/g, ' '),
          choix: (await fenetre.locator('[data-choix]').evaluateAll((l) => l.map((b) => `${b.dataset.choix}:${b.className}:${b.textContent.trim()}`))).join(','),
        };
        await page.keyboard.press('Escape');
        await fenetre.waitFor({ state: 'detached' });
        await page.locator('.onglet-doublons.actif', { hasText: 'Copies exactes' }).waitFor();
        return r;
      };
      const id1 = await xSurGardee(0);
      const ecrit1 = (await planEcrit(page, id1, (f) => f.choixDoublons?.copies === false || Object.values(f.choixDoublons ?? {}).includes(false))).ok;
      const bouton1 = (await page.locator('[data-action=accepter-onglet]').innerText()).trim();
      const un = await ouvrirFenetre();
      const id2 = await xSurGardee(1);
      const accepterOnglet = await page.locator('[data-action=accepter-onglet]').evaluate((b) => ({ texte: b.textContent.trim(), inactif: b.disabled }));
      const deux = await ouvrirFenetre();
      verifier(
        ecrit1 &&
          bouton1 === 'Accepter la proposition' &&
          /Dans 1 groupe, vous n’avez gardé aucun exemplaire : il reste à voir\./.test(un.texte) &&
          /^sans:[^,]*,voir:[^,]*,accepter:principal:Accepter la copie et continuer$/.test(un.choix),
        `un groupe sans exemplaire gardé : « ${bouton1} » ; fenêtre « ${un.texte.slice(0, 160)} » (${un.choix})`,
      );
      verifier(
        accepterOnglet.inactif &&
          accepterOnglet.texte === 'Accepter : aucun exemplaire gardé dans ces groupes' &&
          /Dans 2 groupes, vous n’avez gardé aucun exemplaire : ils restent à voir\./.test(deux.texte) &&
          /^sans:[^,]*,voir:principal:[^,]*$/.test(deux.choix),
        `aucun groupe acceptable : « ${accepterOnglet.texte} » désactivé ; la fenêtre sans « Accepter … » (${deux.choix})`,
      );
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+z');
      await page.waitForFunction(() => document.querySelectorAll('.carte-doublons.en-attente .tuile-doublon[aria-pressed=true]').length >= 2);
      const rendu1 = await planEcrit(page, id1, (f) => !f.choixDoublons || Object.keys(f.choixDoublons).length === 0);
      const rendu2 = await planEcrit(page, id2, (f) => !f.choixDoublons || Object.keys(f.choixDoublons).length === 0);
      verifier(rendu1.ok && rendu2.ok, 'copies : Ctrl+Z défait les deux X, plus aucun choix dans .album/plan.json');
      // Ctrl+A sur les copies (tour 1) : pas de case « Garder plusieurs photos » ; un message dit quoi faire, rien ne change.
      const gardeesAvant = await page.locator('.carte-doublons.en-attente .tuile-doublon[aria-pressed=true]').count();
      await page.locator('.carte-doublons.en-attente .tuile-doublon').first().focus();
      await page.keyboard.press('Control+a');
      await page.getByText('Pour les copies, cliquez sur chaque exemplaire à garder.', { exact: false }).first().waitFor();
      verifier(
        (await page.locator('.carte-doublons.en-attente .tuile-doublon[aria-pressed=true]').count()) === gardeesAvant && (await page.locator('.carte-doublons .pastille-attente').count()) === 0,
        'copies : Ctrl+A ne choisit rien et dit pourquoi (message court)',
      );
      await page.evaluate(() => document.activeElement?.blur());
    }
    // « Accepter les 2 copies et continuer » (testeur) : les copies sont écartées, le tri s'ouvre sans les signaler ;
    // l'annulation est par étape : on revient à Doublons, Ctrl+Z les rend, puis « Continuer sans elles ».
    await page.locator('[data-action=valider]').click();
    await fenetre.locator('[data-choix=accepter]').click();
    await page.locator('main[data-etape=tri]').waitFor();
    await page.waitForTimeout(300);
    const sansCopies = (await page.locator('.copies-avant-tri').count()) === 0;
    await page.locator('.bandeau .etape', { hasText: /^.?\d+Doublons$/ }).click();
    await page.locator('main[data-etape=doublons]').waitFor();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.locator('.barre-validation .reste-copies').waitFor();
    verifier(sansCopies, 'fenêtre des copies : « Accepter les 2 copies et continuer » les écarte et ouvre le tri ; à Doublons, Ctrl+Z les rend');
    await page.locator('[data-action=valider]').click();
    await fenetre.locator('[data-choix=sans]').click();
  }

  // Étape 6 : tri automatique (D103) ; la liste « À faire » : captures d'écran, copies, maison, puis ranger.
  await page.locator('main[data-etape=tri]').waitFor();
  const captures = page.locator('.captures-avant-tri');
  verifier((await captures.innerText()).includes('1 capture d’écran') && (await captures.locator('.puce-afaire').getAttribute('aria-label')) === 'À faire', 'à faire : 1 capture d’écran trouvée, anneau « à faire »');
  // Les captures se voient dans une fenêtre (D107), qui se ferme par Échap.
  await captures.getByRole('button', { name: 'Voir', exact: true }).click();
  verifier((await page.locator('.fenetre[role=dialog]').innerText()).includes('Captures d’écran trouvées'), 'les captures s’ouvrent dans une fenêtre');
  await page.keyboard.press('Escape');
  await page.locator('.fenetre').waitFor({ state: 'detached' });
  await captures.getByRole('button', { name: 'Ranger dans leur dossier' }).click();
  await page.getByText('1 capture d’écran rangée dans leur dossier').waitFor();
  verifier(true, `capture d’écran rangée dans ${N.captures}, la ligne passe à ✓`);
  // Copies exactes restées à Doublons (D112 point 9) : un bandeau brun au-dessus des colonnes, hors de la liste « À
  // faire », une phrase avec le nombre et deux commandes en contour (jamais le plein de la page).
  const copies = page.locator('.copies-avant-tri');
  {
    const b = await copies.evaluate((el) => ({
      texte: el.textContent.replace(/\s+/g, ' '),
      dansListe: !!el.closest('.liste-afaire'),
      avantColonnes: !!(el.compareDocumentPosition(document.querySelector('.colonnes-tri')) & Node.DOCUMENT_POSITION_FOLLOWING),
      boutons: [...el.querySelectorAll('button')].map((x) => `${x.className}:${x.textContent.trim()}`),
      fond: getComputedStyle(el).backgroundColor,
    }));
    verifier(
      /Il reste 2 copies exactes à accepter à l’étape Doublons\. Sans cela, le tri les rangerait une seconde fois\./.test(b.texte) && !b.dansListe && b.avantColonnes,
      `bandeau des copies au-dessus des colonnes, hors de la liste « À faire » (« ${b.texte.trim()} »)`,
    );
    verifier(b.boutons.length === 2 && b.boutons.every((x) => x.startsWith('contour:')) && /Aller à Doublons/.test(b.boutons[0]) && /Les écarter ici/.test(b.boutons[1]), `bandeau : deux commandes en contour (${b.boutons.join(', ')})`);
    verifier(/Encore 3 choses à faire : .*|Encore 3 choses à faire/.test(await page.locator('.barre-validation .alerte').innerText()), `barre du bas, copies comprises : ${await page.locator('.barre-validation .alerte').innerText()}`);
  }
  // « Aller à Doublons » ouvre l'étape ; on revient au tri par la frise, le bandeau est toujours là.
  await copies.getByRole('button', { name: 'Aller à Doublons' }).click();
  await page.locator('main[data-etape=doublons]').waitFor();
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Tri automatique$/ }).click();
  await page.locator('main[data-etape=tri]').waitFor();
  verifier((await copies.count()) === 1, '« Aller à Doublons » ouvre l’étape Doublons ; de retour au tri, le bandeau est toujours là');
  verifier((await page.locator('.a-faire-tri button.principal').count()) === 1 && (await copies.locator('button.principal').count()) === 0, 'un seul bouton plein : la maison d’abord, le bandeau en contour (D107)');
  // Doublons validée avec des copies restantes : sa case de la frise en brun doux, son reste dans l'infobulle (É14 g).
  {
    const caseDoublons = await page.locator('.bandeau .etape').nth(4).evaluate((b) => ({ classe: b.className, titre: b.title }));
    verifier(caseDoublons.classe.includes('copies-restantes') && /2 copies exactes à accepter/.test(caseDoublons.titre) && (await page.locator('.etape-courante .point-reste').count()) === 1, `frise : Doublons en brun doux (« ${caseDoublons.titre} »), point brun sur « Étape n sur 13 »`);
  }
  await copies.getByRole('button', { name: 'Les écarter ici' }).click();
  await copies.waitFor({ state: 'detached' });
  verifier(true, '« Les écarter ici » écarte les copies avant le tri ; le bandeau disparaît');
  verifier((await page.locator('.ligne-afaire.afaire', { hasText: 'Votre maison n’est pas encore indiquée' }).count()) === 1, 'sans domicile : la maison est à indiquer (●)');
  verifier(/Encore 2 choses à faire/.test(await page.locator('.barre-validation .alerte').innerText()), `barre du bas : ${await page.locator('.barre-validation .alerte').innerText()}`);
  // Avant de ranger : l'aperçu en direct, ligne par ligne, sans miniatures (D104).
  verifier((await page.locator('.resultat-tri .tete-resultat').innerText()).includes('Aperçu : rien n’est encore rangé') && (await page.locator('.resultat-tri .ligne-tri').count()) > 0, `aperçu avant de ranger : ${await page.locator('.resultat-tri .ligne-tri').count()} lignes`);
  verifier((await page.locator('.resultat-tri img').count()) === 0 && (await page.getByRole('button', { name: /^Couper|^Réunir/ }).count()) === 0, 'ni miniatures, ni « Couper… », ni « Réunir »');
  // Une seule phrase sur les noms, en tête de la liste ; OpenStreetMap n'est plus écrit sur la page (il est dans l'Aide).
  verifier(
    (await page.locator('.resultat-tri .tete-resultat .phrase-noms').innerText()).includes('Les noms des dossiers se choisissent plus tard, à l’étape Nommage.') &&
      !/OpenStreetMap|Nommage/.test(await page.locator('.resultat-tri .lignes-tri').innerText()) &&
      !/OpenStreetMap/.test(await page.locator('.a-faire-tri').innerText()),
    'une seule phrase sur les noms en tête de la liste ; rien sur OpenStreetMap ni le Nommage dans les lignes et la liste « À faire »',
  );
  // Une seule question, et les chiffres calculés avec les photos avant de ranger.
  const chiffres = await page.locator('.ligne-ranger .apercu-tri-chiffres').innerText();
  const prevus = Number(chiffres.match(/(\d+) dossiers? en tout/)[1]);
  verifier(prevus > 0 && (await page.locator('.ligne-ranger .encart-info').count()) === 1, `avant de ranger, sans maison : pas de questions sur les voyages ; ${chiffres}`);
  await capturer(page, 'v3a_reglages_tri');
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger les photos', exact: true }).click();
  await page.locator('.ligne-ranger.fait').waitFor({ timeout: 60_000 });
  const resume = await page.locator('.ligne-ranger .texte-afaire > strong').innerText();
  verifier(/^Photos rangées : /.test(resume), `rangé : ${resume}`);
  verifier(requetesNominatim.length > 0, `${requetesNominatim.length} requête(s) à OpenStreetMap (simulé)`);
  const lignesTri = await page.locator('.resultat-tri .ligne-tri').count();
  verifier(lignesTri > 0 && (await page.locator('.resultat-tri .onglet-doublons.actif').innerText()).startsWith('Tout') && (await page.locator('.resultat-tri .tete-resultat').innerText()).includes('Les noms des dossiers se choisissent plus tard'), `résultat : ${lignesTri} lignes dans l’onglet « Tout »`);
  // Le bouton « N photos » (D112 point 9) : il déplie quelques photos sous la ligne ; « Voir les N en grand » ouvre la
  // visionneuse ; Entrée le replie ; une seule ligne dépliée à la fois.
  {
    const lignes = page.locator('.resultat-tri .ligne-tri').filter({ has: page.locator('.bouton-photos') });
    const ligne = lignes.first();
    const bouton = ligne.locator('.bouton-photos');
    const mot = (await bouton.innerText()).trim();
    const nom = await bouton.getAttribute('aria-label');
    verifier(/^\d+ photos?$/.test(mot) && (await bouton.getAttribute('aria-expanded')) === 'false' && nom.includes(mot), `bouton des photos : « ${mot} » (nom lu : « ${nom} »), fermé`);
    await bouton.click();
    await ligne.locator('.depliant-tri img').first().waitFor();
    const vignettes = await ligne.locator('.depliant-tri img').count();
    verifier((await bouton.getAttribute('aria-expanded')) === 'true' && vignettes > 0 && vignettes <= 8 && (await page.locator('.depliant-tri').count()) === 1, `bouton des photos : ${vignettes} vignette(s) sous la ligne, un seul dépliant`);
    await capturer(page, 'v3b_tri_depliant');
    await ligne.locator('.depliant-tri').getByRole('button', { name: /^Voir (les \d+ en grand|la photo en grand)$/ }).click();
    await page.locator('.visionneuse').waitFor();
    verifier(true, '« Voir les N en grand » ouvre la visionneuse');
    await page.keyboard.press('Escape');
    await page.locator('.visionneuse').waitFor({ state: 'detached' });
    if ((await lignes.count()) > 1) {
      await lignes.nth(1).locator('.bouton-photos').click();
      verifier((await page.locator('.depliant-tri').count()) === 1 && (await bouton.getAttribute('aria-expanded')) === 'false', 'une autre ligne dépliée : la première se replie');
      await lignes.nth(1).locator('.bouton-photos').click();
    } else {
      await bouton.focus();
      await page.keyboard.press('Enter');
    }
    verifier((await page.locator('.depliant-tri').count()) === 0, 'bouton des photos : se replie au second geste (clic ou Entrée)');
  }
  verifier((await page.locator('.colonnes-tri > .resultat-tri').count()) === 1 && (await page.getByRole('button', { name: 'Afficher les dossiers →' }).count()) === 0, 'les dossiers à droite de la page, sans changer d’étape (D105)');
  await capturer(page, 'v3_tri');
  await page.locator('.resultat-tri .onglet-doublons', { hasText: 'Autres' }).click();
  verifier((await page.locator('.mis-a-part').innerText()).includes('Captures d’écran'), 'onglet « Autres » : la capture d’écran');
  await page.locator('.resultat-tri .onglet-doublons', { hasText: 'Tout' }).click();
  const avant = requetesNominatim.length;
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger autrement…' }).click();
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger à nouveau' }).click();
  await page.locator('.dialogue').getByRole('button', { name: 'Ranger à nouveau' }).click();
  await page.waitForTimeout(500);
  verifier(requetesNominatim.length === avant, 'recalculer ne redemande pas les noms (cache)');
  verifier((await page.locator('.ligne-ranger .texte-afaire > strong').innerText()) === resume, 'recalculer avec les mêmes réglages donne la même arborescence');
  // Configuration avec le calendrier familial, choisie depuis le menu (Fonctions IA, Configuration, …). On y ajoute un
  // lieu nommé (« Plage ») autour d'une photo rangée, ses coordonnées lues dans le plan (aucune n'est écrite ici).
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const album = await (await racine.getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
    const plan = JSON.parse(await (await (await album.getFileHandle('plan.json')).getFile()).text());
    const f = plan.fichiers.find((x) => x.gps && x.statut === 'archive' && x.categorie === 'photo');
    const d = await racine.getDirectoryHandle('selecteur_config');
    const config = JSON.parse(await (await (await d.getFileHandle('config.json')).getFile()).text());
    config.lieux_connus = [{ id: 'plage', nom: 'Plage', lat: f.gps.lat, lon: f.gps.lon, rayon_m: 300, domicile: false, un_seul_dossier: false, notes: 'essai' }];
    const w = await (await d.getFileHandle('config.json')).createWritable();
    await w.write(JSON.stringify(config, null, 2));
    await w.close();
  });
  await page.locator('.bouton-menu').click();
  await page.locator('.menu-deroulant [role=menuitem]').nth(1).click();
  await page.getByRole('button', { name: 'Choisir le dossier config…' }).click();
  await page.getByText(/Calendriers \(1\)/).waitFor();
  verifier(true, 'configuration avec un calendrier .ics et un lieu nommé (« Plage ») choisie');
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Tri automatique$/ }).click();
  await page.locator('main[data-etape=tri]').waitFor();
  await essaiCalendrier(page);
  await essaiLieux(page);
  await page.locator('[data-action=valider]').click();

  // Étape 7 : lieux et sorties.
  await page.locator('.panneau-dossiers').waitFor();
  const noms = await page.locator('.ligne-dossier .nom-dossier').allInnerTexts();
  await capturer(page, 'v3a_lieux');
  verifier(noms.some((n) => n.startsWith('Ko_Samui')) && noms.some((n) => n.startsWith('Annecy')), `dossiers nommés d’après les lieux : ${noms.filter((n) => !['Photos (racine)', 'Mis de côté', 'Autres fichiers'].includes(n)).join(', ')}`);
  verifier(noms.includes('BESTOF') && noms.includes('janvier') && noms.includes(N.captures), 'dossiers gardés tels quels et captures conservés');
  // Les dossiers créés par le tri sont « nouveaux » ; ceux de la source, non (D89). La mention passe dans l'infobulle
  // de la ligne (D112 point 10) : plus de badge.
  const ligneDe = (nom) => page.locator('.ligne-dossier', { has: page.locator('.nom-dossier', { hasText: new RegExp(`^${nom}`) }) }).first();
  verifier(
    (await ligneDe('Ko_Samui').getAttribute('data-nouveau')) === 'tri' &&
      (await ligneDe('Ko_Samui').getAttribute('title')).includes('créé par le tri automatique') &&
      (await ligneDe('BESTOF').getAttribute('data-nouveau')) === null &&
      (await page.locator('.ligne-dossier .badge.cree').count()) === 0,
    'étape 7 : « nouveau » dans l’infobulle des dossiers du tri, pas sur ceux de la source ; plus de badge (D112 point 10)',
  );
  // Ligne de dossier commune (C-7.7) : le nom en 600 sur la première ligne, la période dessous.
  {
    const l = await ligneDe('Ko_Samui').evaluate((x) => {
      const nom = x.querySelector('.nom-dossier').getBoundingClientRect();
      const dates = x.querySelector('.dates-dossier').getBoundingClientRect();
      return { poids: getComputedStyle(x.querySelector('.nom-dossier')).fontWeight, dessous: dates.top >= nom.bottom - 1, ligneEvenement: !!x.querySelector('.evenement-dossier') };
    });
    verifier(l.poids === '600' && l.dessous && !l.ligneEvenement, `ligne de dossier commune : le nom en 600, la période dessous, plus de ligne verte pour l’événement (${JSON.stringify(l)})`);
  }
  // Forme E (D112) : l'explication est l'Aide de l'étape, sous la ligne ; « Aide » reste dans la ligne de l'étape.
  verifier((await page.locator('main[data-etape=lieux] .aide-etape').count()) === 1, 'première visite : l’explication de l’étape est ouverte');
  await page.locator('.aide-etape .fermer-aide').click();
  verifier((await page.locator('.aide-etape').count()) === 0 && (await page.locator('.ligne-etape [data-place=aide][aria-expanded=false]').count()) === 1, 'repliée, l’explication laisse « Aide » dans la ligne de l’étape');
  // « Photos · Chronologie » (D112 point 10) : un choix segmenté au bout de la tête, l'ancien « Ligne de temps ».
  verifier((await page.getByRole('button', { name: 'Ligne de temps' }).count()) === 0, '« Ligne de temps » devient « Chronologie »');
  {
    const tete = await page.locator('.tete-vue').evaluate((t) => {
      const s = t.querySelector('.choix-segmente').getBoundingClientRect();
      const h = t.querySelector('h2').getBoundingClientRect();
      return { auBout: s.left > h.right, radios: t.querySelectorAll('.choix-segmente [role=radio]').length };
    });
    verifier(tete.auBout && tete.radios === 2, `« Photos · Chronologie » : choix segmenté au bout de la tête (${JSON.stringify(tete)})`);
  }
  await page.getByRole('radio', { name: 'Chronologie' }).click();
  const barres = await page.locator('.ldt-barre').count();
  await capturer(page, 'v3b_ligne_de_temps');
  verifier(barres >= 8 && (await page.getByRole('radio', { name: 'Chronologie' }).getAttribute('aria-checked')) === 'true', `Chronologie : ${barres} dossiers en barres, la case allumée`);
  await page.locator('.ldt-barre').first().click();
  verifier((await page.locator('.ldt-barre').count()) === 0, 'un clic sur une barre ouvre le dossier');
  await page.getByRole('radio', { name: 'Chronologie' }).click();
  verifier((await page.locator('.ldt-barre.actif').count()) >= 1, 'Chronologie : le dossier choisi est mis en évidence');
  await page.getByRole('radio', { name: 'Photos', exact: true }).click();
  // Plus d'encart des regroupements du calendrier à cette étape : ils passent à la Consolidation (D106).
  await capturer(page, 'v3c_calendrier');
  verifier((await page.locator('.regroupements-calendrier').count()) === 0, 'étape 7 : plus d’encart des regroupements du calendrier (D106)');
  // Le calendrier avec les photos (D94 ; D112 point 10) : l'icône de la ligne (sa bulle), l'événement en entier dans
  // la tête du dossier ouvert et sur sa journée, en texte gris ; un clic sur l'événement de la journée choisit les
  // photos prises pendant.
  await ligneDe('Ko_Samui').locator('.nom-dossier').click();
  const titreJour = (await page.locator('.titre-groupe').first().innerText()).replace(/\s+/g, ' ');
  await capturer(page, 'v3d_journee');
  const iconeCal = ligneDe('Ko_Samui').locator('.bouton-calendrier');
  verifier(
    (await iconeCal.getAttribute('aria-label')).startsWith('Votre calendrier') &&
      (await page.locator('.tete-vue .sous-titre-vue').innerText()).includes('18 ans de Lea') &&
      titreJour.includes('18 ans de Lea') &&
      titreJour.includes('Voyage Thaïlande'),
    `calendrier : icône de la ligne, tête du dossier ouvert et journée : ${titreJour}`,
  );
  await iconeCal.click();
  await page.locator('.bulle-calendrier').waitFor();
  verifier((await page.locator('.bulle-calendrier').innerText()).includes('18 ans de Lea') && (await page.locator('.tete-vue h2').innerText()).startsWith('Ko_Samui'), 'un clic sur l’icône calendrier épingle sa bulle, sans changer de dossier');
  await page.keyboard.press('Escape');
  await page.locator('.bulle-calendrier').waitFor({ state: 'detached' });
  {
    const style = await page.locator('.titre-groupe .evenement-jour').first().evaluate((b) => {
      const c = getComputedStyle(b);
      return { taille: c.fontSize, fond: c.backgroundColor, souligne: c.textDecorationLine };
    });
    verifier(style.taille === '14px' && /rgba\(0, 0, 0, 0\)|transparent/.test(style.fond) && style.souligne.includes('underline'), `événement de la journée : texte gris de 14 px, souligné, sans pastille (${JSON.stringify(style)})`);
  }
  await page.locator('.titre-groupe .evenement-jour').first().click();
  verifier((await page.locator('.tuile.choisie').count()) === (await page.locator('.tuile').count()), 'un clic sur l’événement sélectionne ses photos');
  verifier((await page.getByRole('button', { name: 'Scinder par jour' }).count()) === 0, '« Scinder par jour » n’existe plus (D94)');
  await page.keyboard.press('Escape');
  // La recherche trouve un dossier par son événement : celui-ci s'écrit sous la ligne.
  await page.locator('.recherche-dossiers input[type=search]').fill('18 ans');
  await ligneDe('Ko_Samui').locator('.evenement-trouve').waitFor();
  verifier((await ligneDe('Ko_Samui').locator('.evenement-trouve').innerText()).includes('18 ans de Lea'), 'recherche par événement : l’événement s’écrit sous la ligne trouvée');
  await page.locator('.recherche-dossiers input[type=search]').fill('');
  // L'icône « petit dossier », même en vrac (réponse 18), grise, avec sa bulle ; la phrase dans la tête du dossier ouvert.
  {
    const petits = page.locator('.ligne-dossier .bouton-petit');
    const n = await petits.count();
    const couleur = n ? await petits.first().evaluate((b) => getComputedStyle(b).color === getComputedStyle(document.querySelector('.dates-dossier')).color) : false;
    const ligne = page.locator('.ligne-dossier:has(.bouton-petit)').first();
    const nom = await ligne.locator('.nom-dossier').innerText();
    await ligne.locator('.bouton-petit').hover();
    await page.locator('.bulle-petit').waitFor();
    const bulle = await page.locator('.bulle-petit').innerText();
    await page.mouse.move(900, 600);
    await ligne.locator('.nom-dossier').click();
    await page.locator('.note-petit').waitFor();
    const note = await page.locator('.note-petit').innerText();
    await capturer(page, 'v3e_petit_dossier');
    verifier(n >= 1 && couleur && /Petit dossier : \d photos?/.test(bulle) && bulle.includes('étape suivante') && note.includes('Petits dossiers') && note.includes('Le réunir maintenant'), `icône « petit dossier » en vrac (${n}), grise, sa bulle et la phrase dans la tête de « ${nom} »`);
  }
  // Le menu « … » (C-4.14) : crayon puis « … » dans la tête ; les mêmes actions au bout de la ligne, au clic droit et avec Maj+F10.
  await ligneDe('Ko_Samui').locator('.nom-dossier').click();
  await page.locator('.tete-vue .plus-dossier').click();
  const menu = page.locator('.menu-actions');
  await menu.waitFor();
  const actions = await menu.locator('[role=menuitem]').evaluateAll((l) => l.map((b) => `${b.querySelector('.libelle-action').textContent}${b.disabled ? ' (grisée)' : ''}`));
  const focusMenu = await page
    .waitForFunction(() => document.activeElement?.getAttribute('role') === 'menuitem', null, { timeout: 2000 })
    .then(() => 'menuitem')
    .catch(() => page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await capturer(page, 'v3f_menu');
  verifier(
    actions.join(' | ') === 'Renommer | Réunir avec un autre dossier… | Mettre dans un autre dossier… | Déplacer les photos choisies… (grisée) | Retirer ce dossier (grisée)' && focusMenu === 'menuitem',
    `menu « … » : ${actions.join(' | ')} ; le focus dans le menu (${focusMenu})`,
  );
  // Grisées, leur raison est écrite dessous (C-4.7).
  verifier(
    (await menu.locator('[role=menuitem]:disabled').evaluateAll((l) => l.every((b) => b.getAttribute('aria-describedby') && document.getElementById(b.getAttribute('aria-describedby'))?.textContent))) === true,
    'menu « … » : chaque action grisée dit pourquoi',
  );
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  verifier((await page.evaluate(() => document.activeElement?.classList.contains('plus-dossier'))) === true, 'Échap ferme le menu, le focus revient sur « … »');
  // Renommer depuis le menu, au clavier (Maj+F10, ↓…), puis Ctrl+Z.
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Shift+F10');
  await menu.waitFor();
  await page.keyboard.press('Enter');
  await page.locator('.ligne-dossier .renommage').fill('Essai_menu');
  await page.keyboard.press('Enter');
  await ligneDe('Essai_menu').waitFor();
  await page.keyboard.press('Control+z');
  await ligneDe('Ko_Samui').waitFor();
  verifier((await ligneDe('Essai_menu').count()) === 0, 'Maj+F10 puis Renommer : renommé ; Ctrl+Z rend son nom');
  // Réunir avec… : les dossiers les plus proches dans le temps d'abord, les dossiers techniques en dernier.
  await page.locator('.tete-vue .plus-dossier').click();
  await menu.getByRole('menuitem', { name: /Réunir avec un autre dossier/ }).click();
  const choixFusion = await page.locator('.choix-dossiers li').allInnerTexts();
  await capturer(page, 'v3g_fusionner');
  await page.keyboard.press('Escape');
  verifier(
    choixFusion.length > 3 && /^Mu_Ko_Ang_Thong|^Kanchanaburi/.test(choixFusion[0]) && !choixFusion.slice(0, 3).some((c) => c.startsWith(N.captures)) && (await page.locator('.dialogue.deplacer').count()) === 0,
    `réunir avec… (menu « … ») : ${choixFusion.slice(0, 3).join(' | ')}`,
  );
  // « Mettre dans un autre dossier… » (fonction nouvelle, deplacerDossier) : au clic droit sur la ligne ; il devient
  // un sous-dossier, ses photos restent ; Ctrl+Z le remet.
  {
    const kanchanaburi = await page.locator('.ligne-dossier .nom-dossier', { hasText: /^Kanchanaburi/ }).allInnerTexts();
    const [cible, source] = kanchanaburi;
    const photosAvant = await ligneDe(source).locator('.nombre-dossier').innerText();
    await ligneDe(source).locator('.nom-dossier').click({ button: 'right' });
    await menu.waitFor();
    await menu.getByRole('menuitem', { name: /Mettre dans un autre dossier/ }).click();
    await page.locator('.dialogue.deplacer input').fill(cible);
    const premier = await page.locator('.choix-dossiers li').first().innerText();
    await page.keyboard.press('Enter');
    await page.getByText(`« ${source} » est maintenant dans « ${cible} ».`).first().waitFor();
    const titre = await ligneDe(source).getAttribute('title');
    const photosApres = await ligneDe(source).locator('.nombre-dossier').innerText();
    await capturer(page, 'v3h_mettre_dans');
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+z');
    await page.waitForFunction((s) => [...document.querySelectorAll('.ligne-dossier')].some((l) => l.querySelector('.nom-dossier')?.textContent === s && l.title.startsWith(s)), source);
    verifier(premier.startsWith(cible) && titre.startsWith(`${cible}/${source}`) && photosApres === photosAvant, `« Mettre dans un autre dossier… » (clic droit) : « ${source} » dans « ${cible} », ses ${photosAvant} photos avec lui ; Ctrl+Z le remet`);
  }
  // « Déplacer les photos choisies… » : grisée sans photo choisie, ouvre « Déplacer » avec ; « Retirer ce dossier » reste grisée (pas vide).
  await ligneDe('Ko_Samui').locator('.nom-dossier').click();
  await page.locator('.tuile').first().click();
  await page.locator('.tete-vue .plus-dossier').click();
  await menu.getByRole('menuitem', { name: /Déplacer les photos choisies/ }).click();
  await page.locator('[role=dialog]').first().waitFor();
  verifier((await page.locator('[role=dialog]').count()) >= 1, 'menu « … » : « Déplacer les photos choisies… » ouvre la fenêtre de déplacement');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Étapes 8 à 10 (IA simulée).
  await page.locator('[data-action=valider]').click();
  await page.locator('main[data-etape=petits]').waitFor();
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
  // « Garder seul » entre dans l'historique (retours du 29.10) : Ctrl+Z le défait, Ctrl+Y le refait, et le lien
  // « Annuler » de son message est l'annulation de l'historique.
  await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
  await page.getByRole('button', { name: 'Garder seul', exact: true }).click();
  await page.locator('.ligne-liste-petit.fait', { hasText: premierPetit }).waitFor();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Control+z');
  await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
  await page.keyboard.press('Control+y');
  await page.locator('.ligne-liste-petit.fait', { hasText: premierPetit }).waitFor();
  await page.keyboard.press('Control+z');
  await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
  await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
  await page.getByRole('button', { name: 'Garder seul', exact: true }).click();
  await page.locator('.ligne-liste-petit.fait', { hasText: premierPetit }).waitFor();
  // Forme E (D112) : le message est dans la ligne de l'étape et finit par « ↶ ou Ctrl+Z pour l'annuler » ; ↶ le défait.
  const messageGarde = page.locator('.ligne-etape .message-entete', { hasText: 'Gardé seul.' });
  await messageGarde.locator('.rappel-annuler').waitFor();
  const rappel = (await messageGarde.innerText()).replace(/\s+/g, ' ');
  await page.locator('.ligne-etape .bouton-annuler').click();
  await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
  verifier(/Ctrl\+Z pour l’annuler/.test(rappel), `« Garder seul » : Ctrl+Z le défait, Ctrl+Y le refait ; son message (« ${rappel} ») renvoie à ↶, qui le défait aussi`);
  // Le rappel du message ne vaut que tant que son geste est le dernier : après un autre geste (renommer, qui n'a pas
  // de message), « Gardé seul. » ne propose plus de l'annuler (↶ déferait le renommage, pas « Garder seul »).
  {
    await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
    await page.getByRole('button', { name: 'Garder seul', exact: true }).click();
    await page.locator('.ligne-liste-petit.fait', { hasText: premierPetit }).waitFor();
    await messageGarde.locator('.rappel-annuler').waitFor();
    // « Garder seul » passe au petit dossier suivant : on attend qu'il soit affiché (sinon F2 renommerait l'ancien).
    await page.waitForFunction((avant) => !!document.querySelector('.tete-petit h2') && document.querySelector('.tete-petit h2').textContent !== avant, premierPetit);
    await page.waitForTimeout(200);
    const autre = await nomCourant();
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('F2');
    await page.locator('.tete-petit .renommage-tete').fill('Petit_essai_rappel');
    await page.locator('.tete-petit .renommage-tete').press('Enter');
    await page.locator('.ligne-liste-petit', { hasText: 'Petit_essai_rappel' }).waitFor();
    const sansRappel = (await messageGarde.count()) === 0 || (await messageGarde.locator('.rappel-annuler').count()) === 0;
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+z');
    await page.locator('.ligne-liste-petit', { hasText: autre }).waitFor();
    await page.keyboard.press('Control+z');
    await page.locator('.ligne-liste-petit:not(.fait)', { hasText: premierPetit }).waitFor();
    verifier(sansRappel, '« Gardé seul. » ne propose plus de l’annuler après un autre geste (renommer) ; Ctrl+Z défait le renommage, puis « Garder seul »');
  }
  // Les lignes de la liste sont atteignables au clavier : Tab passe de l'une à l'autre, Entrée ouvre le petit dossier.
  {
    const lignes = page.locator('.liste-petits .ligne-liste-petit');
    await lignes.nth(0).focus();
    await page.keyboard.press('Tab');
    const deuxieme = await lignes.nth(1).evaluate((x) => x === document.activeElement);
    const nom2 = (await lignes.nth(1).locator('.nom-dossier').innerText()).trim();
    await page.keyboard.press('Enter');
    await page.waitForFunction((n) => document.querySelector('.tete-petit h2')?.textContent === n || !!document.querySelector('.contenu-petits .decide-petit'), nom2);
    verifier(deuxieme && (await lignes.nth(1).getAttribute('aria-current')) === 'true', `liste des petits dossiers : Tab passe d’une ligne à l’autre, Entrée ouvre « ${nom2} »`);
    await page.locator('.ligne-liste-petit', { hasText: premierPetit }).click();
    await page.waitForFunction((n) => document.querySelector('.tete-petit h2')?.textContent === n, premierPetit);
    await page.evaluate(() => document.activeElement?.blur?.());
  }
  // Petits dossiers (D112 point 10) : la ligne commune (le nom, puis la date et l'état écrit, le nombre de photos),
  // les rôles en titre de 16 px / 600 ; renommer (F2, crayon, menu « … ») ; Ctrl+Z rend le nom.
  {
    const l = await page.locator('.ligne-liste-petit').first().evaluate((x) => ({
      nom: !!x.querySelector('.nom-dossier'),
      etat: x.querySelector('.etat-liste-petit')?.textContent,
      nombre: x.querySelector('.nombre-dossier')?.textContent,
      ronds: !!x.querySelector('[data-icone=cercle]'),
    }));
    const roles = await page.locator('.trio-petit .role-petit').evaluateAll((l) => l.map((h) => `${h.textContent}:${getComputedStyle(h).fontSize}/${getComputedStyle(h).fontWeight}`));
    verifier(
      l.nom && !!l.etat && /^\d+$/.test(l.nombre) && !l.ronds && roles.length === 3 && roles.every((r) => r.endsWith(':16px/600')) && roles[1].startsWith('Ce petit dossier'),
      `petits dossiers : ligne commune (${JSON.stringify(l)}) ; rôles ${roles.join(' · ')}`,
    );
  }
  {
    const avant = await nomCourant();
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('F2');
    await page.locator('.tete-petit .renommage-tete').fill('Petit_renomme');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.tete-petit h2')?.textContent === 'Petit_renomme');
    verifier((await page.locator('.ligne-liste-petit', { hasText: 'Petit_renomme' }).count()) === 1, 'petits dossiers : F2 renomme le petit dossier ouvert, la liste suit');
    await page.keyboard.press('Control+z');
    await page.waitForFunction((a) => document.querySelector('.tete-petit h2')?.textContent === a, avant);
    await page.locator('.tete-petit .plus-dossier').click();
    await page.locator('.menu-actions').waitFor();
    const actions = await page.locator('.menu-actions [role=menuitem] .libelle-action').allInnerTexts();
    await capturer(page, 'v4b_petits_menu');
    await page.locator('.menu-actions [role=menuitem]', { hasText: 'Renommer' }).click();
    await page.locator('.tete-petit .renommage-tete').press('Escape');
    await page.locator('.tete-petit .actions-dossier .bouton-icone').first().click();
    await page.locator('.tete-petit .renommage-tete').press('Escape');
    verifier(
      actions[0] === 'Renommer' && actions[1] === 'Réunir avec un autre dossier…' && (await nomCourant()) === avant,
      `petits dossiers : Ctrl+Z rend le nom ; menu « … » : ${actions.join(' | ')} ; crayon et menu ouvrent la saisie, Échap y renonce`,
    );
  }
  // À 1280×580, « Mettre avec ce dossier » et « Garder seul » se voient sans défiler : l'aide IA et les cas évidents
  // sont dans la barre d'outils, sur une ligne.
  {
    await page.setViewportSize({ width: 1280, height: 580 });
    // L'Aide repliée, comme à la première visite à 1280 (elle ne s'ouvre d'elle-même qu'à 1440 et plus).
    if (await page.locator('.aide-etape .fermer-aide').count()) await page.locator('.aide-etape .fermer-aide').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const bas = document.querySelector('.barre-validation')?.getBoundingClientRect().top ?? innerHeight;
      return [...document.querySelectorAll('.trio-petit button')].filter((b) => /Mettre avec ce dossier|Garder seul/.test(b.textContent)).map((b) => Math.round(b.getBoundingClientRect().bottom) <= bas);
    });
    await capturer(page, 'v4c_petits_1280x580');
    await page.setViewportSize({ width: 1440, height: 900 });
    verifier(m.length >= 2 && m.every(Boolean), `à 1280×580, « Mettre avec ce dossier » et « Garder seul » se voient sans défiler (${m.join(', ')})`);
  }
  await page.locator('[data-action=valider]').click();
  await page.locator('main[data-etape=nommage]').waitFor();
  await page.evaluate(() => sessionStorage.setItem('album:cle_api', 'sk-ant-essai-factice'));
  // Nommage (D112 point 11) : deux onglets qui disent leur compte ; le bouton de l'IA dit sa portée et son prix
  // avant d'être lancé (règle d'or 5), « chercher aussi sur internet » collé à lui change ce prix.
  const onglets = await page.locator('.onglets-nommage .onglet-doublons').evaluateAll((l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  verifier(
    onglets.length === 2 && /^À nommer \d+$/.test(onglets[0]) && /^Déjà nommés \d+$/.test(onglets[1]) && (await page.locator('.onglets-nommage [aria-current=page]').getAttribute('data-onglet')) === 'a_nommer',
    `Nommage : deux onglets avec leur compte, ouvert sur « À nommer » (${onglets.join(' | ')})`,
  );
  verifier((await page.getByText('Tous les dossiers').count()) === 0 && (await page.locator('table.nommage').count()) === 0, 'Nommage : plus de case « Tous les dossiers » ni de tableau');
  const aNommer = Number(onglets[0].match(/\d+$/)[0]);
  const boutonNommage = page.locator('.outils-nommage button.bouton-ia');
  const texteIA = async () => (await boutonNommage.innerText()).replace(/\s+/g, ' ').trim();
  const avecWeb = await texteIA();
  verifier(new RegExp(`^Nommer les ${aNommer} avec l’IA · environ [\\d,.]+ CHF$`).test(avecWeb), `Nommage : le bouton IA dit sa portée et son prix avant le lancement (« ${avecWeb} »)`);
  const caseWeb = page.locator('.outils-nommage .aide-ia').getByLabel('chercher aussi sur internet');
  verifier(await caseWeb.isChecked(), '« chercher aussi sur internet » collé au bouton IA, coché d’office');
  await caseWeb.uncheck();
  const sansWeb = await texteIA();
  verifier(sansWeb !== avecWeb && /environ [\d,.]+ CHF$/.test(sansWeb), `sans recherche sur internet, le prix affiché change (${avecWeb.split('· ')[1]} → ${sansWeb.split('· ')[1]})`);
  await caseWeb.check();
  await boutonNommage.click();
  // Le message de fin de l'aide (« 6 noms proposés sur 6 dossiers. ») ; « Noms proposés » est aussi le libellé des cartes.
  await page.locator('.ligne-etape .message-entete', { hasText: /proposés? sur \d+ dossiers?/ }).waitFor({ timeout: 60_000 });
  verifier(appelsIA.nommage > 0, `nommage IA4 : ${appelsIA.nommage} dossier(s)`);
  await capturer(page, 'v5_nommage');
  // Le titre d'un événement du calendrier, suivi du lieu, est proposé comme nom (D83, D88) ; le lieu et l'IA restent à un clic.
  const champs = await page.locator('input.nom-propose').evaluateAll((l) => l.map((x) => x.value));
  verifier(
    champs.includes('18 ans de Lea Ko Samui 18.07.26') && champs.includes('Voyage Thaïlande Kanchanaburi 15.07.26') && champs.includes('Voyage Thaïlande Kanchanaburi 16.07.26') && champs.includes('Voyage Thaïlande Mu Ko Ang Thong 21.07.26'),
    `noms tirés du calendrier (titre puis lieu) : ${champs.filter((v) => /Lea|Voyage/.test(v)).join(', ')}`,
  );
  // L'avis de l'IA sur sa puce (« · sûr »), sa raison et les monuments dans l'infobulle (plus de colonnes « Conf. » et « Justification »).
  const puceIA = page.locator('.nom-possible[data-source=etincelle]').first();
  const titreIA = (await puceIA.getAttribute('title')) ?? '';
  verifier(
    appelsIA.monumentsDemandes === appelsIA.nommage && titreIA.includes('Plage de Chaweng') && titreIA.includes('photos de plage') && (await puceIA.innerText()).replace(/\s+/g, ' ').trim().endsWith('· sûr'),
    `l’avis de l’IA sur sa puce (« · sûr »), sa raison et les monuments dans l’infobulle (« ${titreIA.replace(/\n/g, ' / ')} »)`,
  );
  verifier((await page.getByRole('button', { name: /Reconnaître lieux et monuments/ }).count()) === 0, 'un seul bouton d’IA au nommage');
  await capturer(page, 'v5b_nommage_puces');
  verifier((await page.locator('.noms-possibles .nom-possible').count()) > 0, 'nommage : les noms proposés en un clic');
  // L'ordre de l'utilisateur, sur chaque carte : « Nom actuel », « Noms proposés », « Nouveau nom ».
  const ordres = await page.locator('.carte-nommage').evaluateAll((l) => l.map((c) => [...c.querySelectorAll('.libelle-nommage')].map((x) => x.textContent.trim()).join(' > ')));
  verifier(ordres.length > 0 && ordres.every((o) => o === 'Nom actuel > Noms proposés > Nouveau nom' || o === 'Nom actuel > Nouveau nom'), `chaque carte : Nom actuel, puis Noms proposés, puis Nouveau nom (${[...new Set(ordres)].join(' ; ')})`);
  const ordreDOM = await page.locator('.carte-nommage').first().evaluate((c) => {
    const y = (sel) => c.querySelector(sel).getBoundingClientRect().top;
    return [y('.nom-actuel'), y('.noms-possibles'), y('input.nom-propose')];
  });
  verifier(ordreDOM[0] < ordreDOM[1] && ordreDOM[1] < ordreDOM[2], `les trois parties de haut en bas à l’écran (${ordreDOM.map(Math.round).join(' < ')})`);
  // Une puce cliquée remplit le champ et se coche, en bordure (proposé) ; « Renommer » la rend pleine ; Ctrl+Z rend le nom.
  {
    const avant = await page
      .locator('.carte-nommage', { has: page.locator('.nom-possible[data-source=etincelle]') })
      .filter({ hasNot: page.locator('[data-dossier^="Ko_Samui"]') })
      .filter({ has: page.locator('.nom-possible[aria-checked=false][data-source=etincelle]') })
      .first()
      .getAttribute('data-dossier');
    // Des repères fixes : la carte par son nom, la puce par sa place (une fois cochée, elle ne serait plus « la première non cochée »).
    const carte = page.locator(`.carte-nommage[data-dossier="${avant}"]`);
    // Une puce qui change vraiment le nom (le lieu redonne souvent le nom du tri : « C'est déjà son nom »).
    const place = await carte
      .locator('.nom-possible')
      .evaluateAll((l, a) => l.findIndex((x) => x.getAttribute('aria-checked') === 'false' && x.querySelector('.texte-nom').textContent.trim().replace(/\s+/g, '_') !== a), avant);
    const autre = carte.locator('.nom-possible').nth(place);
    const texte = (await autre.locator('.texte-nom').innerText()).trim();
    await autre.click();
    const valeur = await carte.locator('input.nom-propose').inputValue();
    verifier(
      valeur === texte && (await autre.getAttribute('aria-checked')) === 'true' && (await autre.getAttribute('data-decide')) === null && (await carte.locator('.nom-possible[aria-checked=true]').count()) === 1,
      `une puce cliquée remplit le champ (« ${valeur} ») et se coche, encore en bordure`,
    );
    const effet = (await carte.locator('.effet-nom').innerText()).trim();
    verifier(/^deviendra « .+ »$/.test(effet), `« ${effet} » à droite de « Renommer »`);
    const nouveau = effet.slice('deviendra « '.length, -2);
    await carte.locator('[data-action=renommer]').click();
    const apres = page.locator(`.carte-nommage[data-dossier="${nouveau}"]`);
    await apres.waitFor();
    verifier(
      (await apres.locator('.nom-renomme').innerText()).includes(`renommé par vous (avant : ${avant})`) &&
        (await apres.locator('.nom-possible[data-decide]').count()) === 1 &&
        (await apres.locator('input.nom-propose').inputValue()) === '' &&
        (await page.locator('.message-entete').innerText()).includes(`Renommé « ${nouveau} »`),
      `« Renommer » : « ${avant} » devient « ${nouveau} », la puce passe en plein, le champ se vide, un message le dit`,
    );
    await page.keyboard.press('Control+z');
    await page.locator(`.carte-nommage[data-dossier="${avant}"]`).waitFor();
    verifier((await page.locator(`.carte-nommage[data-dossier="${nouveau}"]`).count()) === 0 && (await page.locator(`.carte-nommage[data-dossier="${avant}"] .nom-possible[data-decide]`).count()) === 0, `Ctrl+Z : « ${avant} » retrouve son nom, plus de puce pleine`);
    // Au clavier : les puces sont un seul arrêt de Tab ; → passe à la suivante et la met dans le champ.
    const carte2 = page.locator(`.carte-nommage[data-dossier="${avant}"]`);
    const premiere = carte2.locator('.nom-possible[tabindex="0"]');
    const prisDOffice = await carte2.locator('input.nom-propose').inputValue();
    verifier((await carte2.locator('.nom-possible[tabindex="0"]').count()) === 1, 'les noms proposés : un seul arrêt de Tab par carte');
    await premiere.focus();
    await page.keyboard.press('ArrowRight');
    const cochee = carte2.locator('.nom-possible[aria-checked=true]');
    verifier(
      (await cochee.count()) === 1 && (await cochee.evaluate((x) => x === document.activeElement)) && (await carte2.locator('input.nom-propose').inputValue()) === (await cochee.locator('.texte-nom').innerText()).trim(),
      '→ sur les noms proposés : la suivante se coche, prend le focus et remplit le champ',
    );
    await page.keyboard.press('Tab');
    verifier(await carte2.locator('input.nom-propose').evaluate((x) => x === document.activeElement), 'Tab : des noms proposés au champ « Nouveau nom »');
    // Maj+Tab revient aux noms proposés ; ← remet la puce d'avant (le nom pris d'office) dans le champ.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowLeft');
    verifier((await carte2.locator('input.nom-propose').inputValue()) === prisDOffice, `Maj+Tab puis ← : le nom pris d’office revient dans le champ (« ${prisDOffice} »)`);
    await page.evaluate(() => document.activeElement?.blur?.());
  }
  // « Déjà nommés » : le champ est vide avec un exemple ; le dossier garde son nom tant qu'il le reste.
  await page.locator('.onglets-nommage [data-onglet=deja_nommes]').click();
  {
    const carte = page.locator('.carte-nommage').first();
    const champ = carte.locator('input.nom-propose');
    verifier(
      (await champ.inputValue()) === '' && /^Par exemple : /.test((await champ.getAttribute('placeholder')) ?? '') && (await carte.locator('[data-action=renommer]').isDisabled()) && (await carte.locator('.raison-desactivee').innerText()).includes('garde son nom tant que le champ est vide'),
      `« Déjà nommés » : champ vide avec un exemple (« ${await champ.getAttribute('placeholder')} »), « Renommer » grisé avec sa raison`,
    );
    verifier(/^Nommer (ces \d+|ce dossier) avec l’IA · /.test(await texteIA()), `« Déjà nommés » : le bouton IA dit sa portée (« ${await texteIA()} »)`);
    await capturer(page, 'v5d_nommage_deja_nommes');
  }
  await page.locator('.onglets-nommage [data-onglet=a_nommer]').click();
  // Un seul événement candidat : renommé d'un coup ; Ko Samui (deux événements) attend le choix de l'utilisateur.
  await page.getByRole('button', { name: /^Prendre le nom du calendrier \(\d+ dossiers?\)/ }).click();
  await page.getByText(/dossiers? renommés?/).first().waitFor();
  verifier(true, 'noms du calendrier pris en un clic, seulement là où un seul événement convient ; le bouton dit sa portée');
  const accepter = page.getByRole('button', { name: /^Accepter les noms sûrs de l’IA \(\d+ dossiers?\)/ });
  if (await accepter.count()) {
    await accepter.click();
    verifier(true, 'noms sûrs de l’IA acceptés en un clic');
  }
  await page.locator('[data-action=valider]').click();
  // Noms encore dans les champs (Ko Samui : deux événements) : récapitulatif à cocher avant de quitter, les peu sûrs décochés (D108).
  const recap = page.getByRole('dialog', { name: 'Des noms ne sont pas encore appliqués' });
  await recap.waitFor();
  const cases = recap.getByRole('checkbox');
  const cochees = await cases.evaluateAll((l) => l.filter((x) => x.checked).length);
  verifier((await cases.count()) > 0 && cochees === 0 && (await recap.getByText('(à vérifier)').count()) === (await cases.count()), `Nommage : noms proposés restants dans un récapitulatif, décochés d’office (${await cases.count()})`);
  await capturer(page, 'v5c_nommage_recapitulatif');
  // Cocher applique le nom en quittant l'étape.
  await cases.first().check();
  await recap.getByRole('button', { name: 'Renommer et continuer' }).click();
  await page.locator('main[data-etape=consolidation]').waitFor();
  verifier((await page.getByText('1 dossier renommé.').count()) > 0, 'Nommage : le nom coché dans le récapitulatif est appliqué, avec un message');
  await page.getByRole('button', { name: /Proposer des fusions avec l’IA/ }).click();
  await page.getByText(/propositions? dans/).first().waitFor({ timeout: 60_000 });
  verifier(appelsIA.consolidation > 0, `consolidation IA6 : ${appelsIA.consolidation} répertoire(s) relus`);
  await capturer(page, 'v6_consolidation');
  await page.locator('[data-action=valider]').click();
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
  verifier(sortie.some((p) => p.startsWith('Photos/18_ans_de_Lea_Ko_Samui_18.07.26/')), 'nom coché dans le récapitulatif du Nommage écrit dans la sortie');

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
  // Projet d'avant les badges (D112) : le plan.json écrit sans aucune origine ; une photo gardée à la main, comme
  // le faisaient les anciennes versions. À la réouverture, chaque décision retrouve son origine, écrite aussitôt.
  await page.waitForTimeout(1000);
  const ancien = await page.evaluate(async () => {
    const album = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
    const h = await album.getFileHandle('plan.json');
    const plan = JSON.parse(await (await h.getFile()).text());
    const gardee = plan.fichiers.find((f) => f.categorie === 'photo' && f.statut === 'archive' && !f.flou && !f.id.includes('/'));
    gardee.flou = 'sauvee';
    for (const f of plan.fichiers) {
      delete f.origine;
      delete f.avant;
    }
    const w = await h.createWritable();
    await w.write(JSON.stringify(plan));
    await w.close();
    return { gardee: gardee.id, ecartees: plan.fichiers.filter((f) => f.statut === 'mis_de_cote' && (f.raison === 'doublons' || f.raison === 'doublons_exacts')).map((f) => f.id) };
  });
  await page.reload();
  await page.locator('.bandeau-source').waitFor({ timeout: 20_000 });
  const repris = await planEcrit(page, ancien.gardee, (f) => f.origine?.flou === 'vous');
  verifier(repris.ok, `réouverture d’un projet d’avant les badges : la photo gardée à la main devient « par vous », écrit dans .album/plan.json (${JSON.stringify(repris.f?.origine)})`);
  const reprisDoublons = await Promise.all(ancien.ecartees.map((id) => planEcrit(page, id, (f) => !!f.origine?.[f.raison])));
  verifier(
    ancien.ecartees.length > 0 && reprisDoublons.every((r) => r.ok && r.f.origine[r.f.raison] === (r.f.doublon?.source === 'ia' ? 'ia' : 'application')),
    `réouverture : les ${ancien.ecartees.length} doublons écartés par un groupe accepté viennent de l’application, ou de l’IA pour une même scène (${reprisDoublons.map((r) => JSON.stringify(r.f?.origine)).join(', ')})`,
  );
  verifier((await page.locator('.bandeau-source').innerText()).includes('2 nouveaux fichiers'), 'à la réouverture, un bandeau annonce les 2 nouveaux fichiers');
  await page.locator('.bandeau-source').getByRole('button', { name: 'Mettre à jour l’inventaire' }).click();
  await page.getByText(/Inventaire mis à jour : 2 fichiers ajoutés/).first().waitFor({ timeout: 60_000 });
  verifier(true, 'inventaire mis à jour : 2 fichiers ajoutés, le reste gardé');
  await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await page.locator('.bandeau .etape', { hasText: /^.?\d+Tri automatique$/ }).click();
  verifier((await page.locator('.ligne-ranger.afaire').innerText()).includes('1 nouvelle photo à ranger') && /Encore/.test(await page.locator('.barre-validation .alerte').innerText()), 'à faire : la nouvelle photo à ranger (ligne marquée « à faire », rappel dans la barre du bas)');
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
