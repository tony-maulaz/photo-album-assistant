// Essai de la charte « Table lumineuse » (docs/ux/CHARTE.md) sur les vraies
// pages de l'application, dans Chromium sans affichage, avec le FICHIER CONSTRUIT
// (vite build, servi tel quel) : le build peut récrire le CSS, le serveur de
// développement ne le montre pas. Un dossier en vrac (photos de
// tests/photos_reelles, une copie exacte), parcouru de l'accueil à la Sortie,
// OpenStreetMap et l'API Claude simulés (aucun appel réseau).
//
// Sur le build : light-dark() reste natif (aucun « --lightningcss- », C-3.9).
// Sur chaque page, à 1440×900 et à 1280×580, en clair et en sombre :
//   - aucun texte affiché sous 14 px (C-2.2) ;
//   - contraste des textes ≥ 4,5:1 sur leur fond (C-3.7), commandes
//     désactivées exceptées (WCAG 1.4.3) ;
//   - aucune police autre qu'Inter (C-1.1), et Inter bien chargée ;
//   - tout bouton désactivé a un bord en pointillé (C-4.7) ;
//   - le vert plein (fond --accent) n'est que sur un bouton d'action (C-3.2 ;
//     les barres de données sont comptées à part) ;
//   - un seul bouton plein visible (C-4.1), et sur une page d'étape exactement
//     un dans toute la page ou la vue ouverte (aucun seulement sur les pages de
//     SANS_PLEIN) ; « Valider et continuer » n'est plein qu'une fois l'étape
//     finie (data-fini) ;
//   - tout bouton désactivé dit pourquoi (C-4.7) : son libellé le dit
//     (data-raison="libelle"), ou aria-describedby mène à un texte visible ;
//   - le texte des boutons fait 16 px (C-2.2), les liens exceptés ;
//   - aucun caractère-icône (✕ ✦ ▾ ▸ ◀ ↻ ✂ ≤ ≈ …) ni émoji dans les textes (C-1.4) ;
//   - la barre du bas des étapes où l'on écarte dit « Rien n'est supprimé » (C-8.4) ;
//   - les parties repliables montrent le chevron SVG, pas le triangle du navigateur (C-5.1) ;
//   - « Annuler » et « Rétablir » tiennent sur une ligne de 40 px, même avec le plus
//     long geste court (sonde), sans déborder ni faire bouger la grille (C-8.2) ;
//   - toute aide IA porte l'étincelle et son prix, ou « … » (C-4.6) ;
//   - aucune commande coupée par le bord de l'écran (C-6.2), rien qui défile en largeur (C-7.1).
// Sur les pages ordinaires, au clavier (Tab) : chaque arrêt montre le contour
// noir 2 / jaune 3 / noir 2 (C-9.5).
//
// Usage (depuis app/) : node outils/essai_charte.mjs   (CAPTURES=dossier pour des captures d'écran)

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = fileURLToPath(new URL('..', import.meta.url));
const PHOTOS = join(APP, '..', 'tests', 'photos_reelles');
const BIBLIOTHEQUES = join(homedir(), '.cache/ms-playwright/bibliotheques/racine/usr/lib/x86_64-linux-gnu');
const env = existsSync(BIBLIOTHEQUES) ? { ...process.env, LD_LIBRARY_PATH: [BIBLIOTHEQUES, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : process.env;
const CAPTURES = process.env.CAPTURES;
const TAILLES = [
  [1440, 900],
  [1280, 580],
];
const THEMES = ['light', 'dark'];
/** Étapes où l'on écarte des photos : la barre du bas dit « Rien n'est supprimé » (C-8.4). */
const ECARTE = new Set(['floues', 'doublons', 'tri', 'lieux', 'sortie']);
/** Pages contrôlées au moins : sinon le parcours s'est arrêté trop tôt. */
const MINIMUM_PAGES = 20;
/**
 * Pages d'étape sans bouton plein permis (C-4.1), à faire trancher par l'utilisateur
 * (« au plus un plein ; aucun quand la prochaine action est un geste ou un choix sans préférence ») :
 * - Sélection, sa barre d'action, Décider une par une, la visionneuse : choisir ★ / ★★ / ✕ sur les photos ;
 * - Petits dossiers sans proposition de l'IA : deux dossiers voisins au choix, aucun n'est mis en avant.
 */
const SANS_PLEIN = new Set(['selection', 'selection-barre-action', 'tri-rapide', 'visionneuse', 'petits-dossiers']);

const photos = readdirSync(PHOTOS).filter((f) => f.endsWith('.jpg') && !f.startsWith('Vacances'));

// Build figé, servi tel quel (comme captures_ux.mjs) : c'est ce fichier que reçoit la famille.
const BUILD = mkdtempSync(join(tmpdir(), 'album-charte-'));
await new Promise((ok, echec) => {
  const vite = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'warn'], { cwd: APP, stdio: ['ignore', 'inherit', 'inherit'] });
  vite.on('error', echec);
  vite.on('exit', (code) => (code === 0 ? ok() : echec(new Error(`vite build a échoué (code ${code})`))));
});
const html = readFileSync(join(BUILD, 'album-photos.html'), 'utf8');
rmSync(BUILD, { recursive: true, force: true });
const fautesBuild = [];
// C-3.9 : light-dark() récrit par Lightning CSS = jetons calculés une seule fois sur :root,
// et les vues sombres (Comparer, tri rapide, recadrage) gardent le texte du thème clair.
if (html.includes('--lightningcss-')) fautesBuild.push('le build récrit light-dark() (« --lightningcss- ») : régler build.cssTarget sur Chrome/Edge 123');
if (!html.includes('light-dark(')) fautesBuild.push('le build ne contient plus light-dark()');
if (/url\(['"]?https?:/.test(html) || /fonts\.(googleapis|gstatic)/.test(html)) fautesBuild.push('le build charge une police en ligne');
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

/** Mesures faites dans la page : textes, polices, contrastes, vert plein, désactivés. */
function mesurer() {
  const H = innerHeight;
  const W = innerWidth;
  const rgba = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const sur = (haut, bas) => {
    const a = haut[3];
    return [0, 1, 2].map((i) => haut[i] * a + bas[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  /** Fond réel derrière un élément : les fonds des ancêtres composés ; null si une image est dessous. */
  const fond = (e) => {
    const couches = [];
    for (let x = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c && c[3] > 0) {
        couches.push(c);
        if (c[3] >= 1) break;
      }
      // Posé sur une photo (badge, étoiles) : le fond dessous est une image.
      if (x !== e && /^(absolute|fixed)$/.test(s.position) && x.parentElement?.querySelector(':scope > img, :scope img')) return null;
    }
    let resultat = [255, 255, 255, 1];
    if (!couches.length || couches.at(-1)[3] < 1) resultat = rgba(getComputedStyle(document.body).backgroundColor) ?? resultat;
    for (const c of couches.reverse()) resultat = sur(c, resultat);
    return resultat;
  };
  const opacite = (e) => {
    let o = 1;
    for (let x = e; x; x = x.parentElement) o *= Number(getComputedStyle(x).opacity);
    return o;
  };
  const nom = (e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  /** Visible au premier plan : pas sous une vue plein écran ou une fenêtre (centre de la boîte). */
  const dessus = (e, b) => {
    const x = Math.min(Math.max(b.left + b.width / 2, 0), W - 1);
    const y = Math.min(Math.max(b.top + b.height / 2, 0), H - 1);
    const touche = document.elementFromPoint(x, y);
    return !!touche && (e.contains(touche) || touche.contains(e));
  };
  const petits = [];
  const polices = new Set();
  const faibles = [];
  let min = 99;
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg, script, style, [aria-hidden="true"]')) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height || b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    // Texte masqué pour les lecteurs d'écran seulement (dans une boîte de 1 px, coupée).
    let masque = false;
    for (let x = e; x && !masque; x = x.parentElement) {
      const r = x.getBoundingClientRect();
      masque = r.width <= 2 && r.height <= 2 && getComputedStyle(x).overflow !== 'visible';
    }
    if (masque) continue;
    const o = opacite(e);
    if (o === 0 || !dessus(e, b)) continue;
    const taille = parseFloat(s.fontSize);
    min = Math.min(min, taille);
    if (taille < 14) petits.push(`${taille}px « ${nom(e)} »`);
    polices.add(s.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    // WCAG 1.4.3 : les commandes désactivées sont exemptées.
    if (e.closest(':disabled, [aria-disabled="true"]')) continue;
    const f = fond(e);
    const t = rgba(s.color);
    if (!f || !t) continue;
    const texte = sur([t[0], t[1], t[2], t[3] * o], f);
    const r = contraste(texte, f);
    if (r < 4.5 - 0.01) faibles.push(`${r.toFixed(2)} « ${nom(e)} » (${s.color} sur rgb(${f.slice(0, 3).map(Math.round).join(',')}))`);
  }
  const visible = (x) => {
    const b = x.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < H && b.right > 0 && b.left < W && getComputedStyle(x).visibility !== 'hidden' && dessus(x, b);
  };
  // Vert plein (C-3.2), repéré par le fond calculé et non par la classe : la valeur de
  // --accent dans les deux thèmes (une vue sombre prend la valeur sombre).
  // Le survol (--accent-survol) compte aussi : la souris reste souvent sur le dernier bouton cliqué.
  const sonde = (theme, jeton = '--accent') => {
    const d = document.createElement('div');
    d.style.cssText = `color-scheme:${theme};background:var(${jeton});position:fixed;width:1px;height:1px`;
    document.body.appendChild(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  };
  const verts = new Set([sonde('light'), sonde('dark'), sonde('light', '--accent-survol'), sonde('dark', '--accent-survol')]);
  // Barres de données (jauges, barres de mois, ligne de temps, frise) : à trancher (C-3.2), comptées à part.
  const DONNEES = '.jauge, .barre-mois, .ldt-barre, .avancement, .pastille.retenues, .bandeau, .barre-jour, .poignee-panneau, .budget';
  const pleins = [];
  const vertsAilleurs = [];
  let validerPleinPasFini = '';
  for (const x of document.querySelectorAll('body *')) {
    if (!verts.has(getComputedStyle(x).backgroundColor) || !visible(x)) continue;
    if (x.closest(DONNEES)) continue;
    if (x.matches('button, .faux-bouton, [role="button"]')) {
      if (!x.disabled) pleins.push(nom(x) || x.className);
      if (x.dataset.action === 'valider' && x.dataset.fini === 'non') validerPleinPasFini = nom(x);
    } else vertsAilleurs.push(`${x.tagName.toLowerCase()}.${[...x.classList].join('.')} « ${nom(x)} »`);
  }
  // C-4.7 : un bouton désactivé dit pourquoi, dans son libellé ou dans un texte visible relié.
  const sansRaison = [...document.querySelectorAll('button:disabled')]
    .filter((x) => visible(x) && !x.closest('.bandeau'))
    .filter((x) => {
      if (x.dataset.raison === 'libelle') return false;
      const ids = (x.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      return !ids.some((id) => {
        const r = document.getElementById(id);
        return r && (r.textContent || '').trim() && r.getBoundingClientRect().width > 0;
      });
    })
    .map((x) => `« ${nom(x) || x.title || x.className} »`);
  // C-2.2 : texte des boutons à 16 px (les liens suivent le texte qui les entoure ; une photo n'a pas de libellé).
  const boutonsPetits = [...document.querySelectorAll('button')]
    .filter((x) => visible(x) && !x.matches('.lien') && !x.closest('.bandeau, .ldt-barre') && !x.matches('.ldt-barre') && !x.querySelector('img, canvas, .cadre-tuile, .sans-miniature') && (x.textContent || '').trim())
    .filter((x) => parseFloat(getComputedStyle(x).fontSize) < 16)
    .map((x) => `${getComputedStyle(x).fontSize} « ${nom(x)} »`);
  // C-1.4 : aucun caractère-icône ni émoji dans les textes affichés.
  const ICONES = /[✕✖✗✘✦✧✨▣◀▶►◄▾▸▴▹▿◂◆◇○●☰⌫✂✎✏↻↺⟳≤≥≈Ø⇄⧉↔⚠ℹ‹›]|(?![★✓™©®])\p{Extended_Pictographic}/u;
  const caracteres = [];
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    // « × » seul (une croix de fermeture) ; « 1 920 × 1 080 pixels » reste permis.
    const m = n.textContent.match(ICONES) ?? (n.textContent.trim() === '×' ? ['×'] : null);
    if (m && n.parentElement && !n.parentElement.closest('script, style')) caracteres.push(`« ${m[0]} » dans « ${n.textContent.trim().slice(0, 40)} »`);
  }
  for (const x of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
    for (const a of ['title', 'aria-label', 'placeholder']) {
      const m = (x.getAttribute(a) || '').match(ICONES);
      if (m) caracteres.push(`« ${m[0]} » dans ${a}=« ${x.getAttribute(a).slice(0, 40)} »`);
    }
  }
  // C-8.4 : la ligne « Rien n'est supprimé » dans la barre du bas, là où l'on écarte.
  const etape = document.querySelector('main[data-etape]')?.dataset.etape ?? (document.querySelector('.page-organiser:not(.page-selection)') ? 'lieux' : '');
  const bouclier = !!document.querySelector('.barre-validation .rien-supprime .icone');
  // C-4.7 : un bouton désactivé a un bord en pointillé (un lien désactivé, aucun bord).
  const desactives = [...document.querySelectorAll('button:disabled:not(.lien)')]
    .filter((x) => visible(x) && !x.closest('.bandeau'))
    .filter((x) => getComputedStyle(x).borderTopStyle !== 'dashed')
    .map((x) => `« ${nom(x) || x.title || x.className} »`);
  const inter = [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Inter' && f.status === 'loaded');
  // C-4.1 vérifié sur toute la page (et non seulement à l'écran) : les boutons pleins hors barres de données.
  // Une vue plein écran ou une fenêtre ouverte est « l'écran » : seuls ses boutons comptent.
  const vueDessus = [...document.querySelectorAll('.comparateur, .recadreur, .tri-rapide, .visionneuse, [role="dialog"]')].at(-1) ?? document;
  const tousPleins = [...vueDessus.querySelectorAll('button:not(:disabled), .faux-bouton')]
    .filter((x) => verts.has(getComputedStyle(x).backgroundColor) && !x.closest(DONNEES))
    .filter((x) => {
      const b = x.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(x).visibility !== 'hidden';
    })
    .map((x) => nom(x) || x.className);
  // C-5.1 : le triangle d'une partie repliable est le chevron SVG, pas le marqueur du navigateur.
  const marqueurs = [...document.querySelectorAll('summary')]
    .filter((x) => visible(x))
    .filter((x) => {
      const s = getComputedStyle(x);
      const avant = getComputedStyle(x, '::before');
      return (s.display === 'list-item' && s.listStyleType !== 'none') || !avant.maskImage?.includes('svg');
    })
    .map((x) => `« ${nom(x)} »`);
  // C-8.2, C-10.4 : « Annuler : … » sur une ligne de 40 px, entier (rien ne déborde du bouton).
  const annulers = [...document.querySelectorAll('button.bouton-annuler, button.bouton-retablir')]
    .filter((x) => visible(x))
    .filter((x) => Math.abs(x.getBoundingClientRect().height - 40) > 1 || x.scrollWidth > x.clientWidth + 1)
    .map((x) => `${Math.round(x.getBoundingClientRect().width)}×${Math.round(x.getBoundingClientRect().height)} « ${nom(x)} »`);
  // C-4.6 : une aide IA porte l'étincelle et son prix, ou « … » quand le prix est dans la fenêtre.
  const aidesIA = [...document.querySelectorAll('button')]
    .filter((x) => visible(x) && !x.matches('.lien'))
    .filter((x) => !x.matches('[role="tab"], .onglet-doublons'))
    .filter((x) => x.matches('.bouton-ia') || /\bIA\b|\bl’IA\b/.test(x.textContent || ''))
    .filter((x) => !x.querySelector('[data-icone="etincelle"]') || !/CHF|…|gratuit|rien à faire|en cours|déjà fait/.test(x.textContent || ''))
    .map((x) => `« ${nom(x)} »`);
  // C-6.2, C-7.1 : aucune commande coupée par le bord de l'écran, aucune colonne qui défile en largeur.
  const horsEcran = [...document.querySelectorAll('button, [role="tab"], a')]
    .filter((x) => {
      const b = x.getBoundingClientRect();
      if (!b.width || !b.height || b.bottom <= 0 || b.top >= H || getComputedStyle(x).visibility === 'hidden') return false;
      if (x.closest('.bande-miniatures, .vignettes-lieu, .bandeau, .liste-couvertures, .bande-comparateur, .vignettes-comparateur')) return false;
      return b.right > W + 0.5 || b.left < -0.5;
    })
    .map((x) => `« ${nom(x) || x.className} »`);
  // Une commande d'une barre (en-tête de vue, barre du bas, en-tête de Comparer) ne déborde pas de sa barre
  // sur la colonne voisine (barre d'outils qui ne passe pas à la ligne).
  for (const barre of document.querySelectorAll('.tete-vue, .tete-etape, .barre-validation, .comparateur-tete, .barre-action')) {
    const bb = barre.getBoundingClientRect();
    if (!bb.width || !bb.height) continue;
    for (const x of barre.querySelectorAll('button, label, input, select')) {
      const b = x.getBoundingClientRect();
      if (b.width && b.height && (b.right > bb.right + 1 || b.left < bb.left - 1)) horsEcran.push(`« ${nom(x) || x.className} » déborde de .${[...barre.classList].join('.')}`);
    }
  }
  const enLargeur = [...document.querySelectorAll('body *')]
    .filter((x) => {
      const s = getComputedStyle(x);
      if (!/(auto|scroll)/.test(s.overflowX) || x.closest('.bande-miniatures, .bandeau, .ligne-de-temps, .barres-jours, .vignettes-lieu')) return false;
      const b = x.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && x.scrollWidth > x.clientWidth + 1;
    })
    .map((x) => `${x.tagName.toLowerCase()}.${[...x.classList].join('.')} (${x.scrollWidth} pour ${x.clientWidth})`);
  const pageEnLargeur = document.scrollingElement.scrollWidth > W + 1;
  return {
    min,
    petits: [...new Set(petits)],
    polices: [...polices],
    faibles: [...new Set(faibles)],
    pleins,
    validerPleinPasFini,
    vertsAilleurs: [...new Set(vertsAilleurs)],
    desactives: [...new Set(desactives)],
    sansRaison: [...new Set(sansRaison)],
    boutonsPetits: [...new Set(boutonsPetits)],
    caracteres: [...new Set(caracteres)],
    etape,
    barre: !!document.querySelector('.barre-validation'),
    bouclier,
    inter,
    tousPleins,
    marqueurs,
    annulers,
    aidesIA,
    horsEcran: [...new Set(horsEcran)],
    enLargeur: [...new Set(enLargeur)],
    pageEnLargeur,
  };
}

/** L'élément qui a le focus montre-t-il noir 2 / jaune 3 / noir 2 (C-9.5) ? */
function focusVisible() {
  const e = document.activeElement;
  if (!e || e === document.body) return null;
  // Les transitions (ombre des boutons) sont menées à leur fin : on mesure l'état stable.
  for (const a of e.getAnimations()) a.finish();
  const s = getComputedStyle(e);
  const nom = (e.textContent || e.title || e.getAttribute('aria-label') || e.className || e.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);
  const detail = `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} / ${s.boxShadow}`;
  const ok = s.outlineStyle === 'solid' && s.outlineWidth === '3px' && s.outlineColor === 'rgb(255, 214, 10)' && s.boxShadow.includes('rgb(11, 12, 12)') && e.matches(':focus-visible');
  return { nom: `${e.tagName.toLowerCase()} « ${nom} »`, ok, detail };
}

const navigateur = await chromium.launch({ env });
const erreurs = [];
const fautes = [];
const signalements = [];
const controlees = [];
let arrets = 0;
try {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  await contexte.route('https://nominatim.openstreetmap.org/**', async (route) => {
    const lat = Number(new URL(route.request().url()).searchParams.get('lat'));
    const nom = lat > 40 ? 'Annecy' : lat > 13 ? 'Kanchanaburi' : lat > 9.55 ? 'Mu Ko Ang Thong' : 'Ko Samui';
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { town: nom, country: 'Pays' }, display_name: nom }) });
  });
  // L'API Claude n'est jamais appelée par ce parcours : toute requête est refusée.
  await contexte.route('https://api.anthropic.com/**', (route) => route.abort());
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
  });
  await page.goto(ADRESSE);

  /** Contrôle la page affichée aux deux tailles et dans les deux thèmes. */
  const controler = async (nomPage) => {
    controlees.push(nomPage);
    for (const [w, h] of TAILLES) {
      await page.setViewportSize({ width: w, height: h });
      for (const theme of THEMES) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const m = await page.evaluate(mesurer);
        const ici = `${nomPage} ${w}×${h} ${theme === 'light' ? 'clair' : 'sombre'}`;
        if (m.petits.length) fautes.push(`${ici} : texte sous 14 px : ${m.petits.slice(0, 5).join(' ; ')}`);
        if (m.faibles.length) fautes.push(`${ici} : contraste < 4,5 : ${m.faibles.slice(0, 6).join(' ; ')}${m.faibles.length > 6 ? ` (+${m.faibles.length - 6})` : ''}`);
        const autres = m.polices.filter((p) => p !== 'Inter');
        if (autres.length) fautes.push(`${ici} : police autre qu’Inter : ${autres.join(', ')}`);
        if (!m.inter) fautes.push(`${ici} : Inter n’est pas chargée`);
        if (m.desactives.length) fautes.push(`${ici} : bouton désactivé sans pointillé (C-4.7) : ${m.desactives.slice(0, 5).join(' ; ')}`);
        if (m.vertsAilleurs.length) fautes.push(`${ici} : vert plein hors d’un bouton d’action (C-3.2) : ${m.vertsAilleurs.slice(0, 5).join(' ; ')}`);
        const avant = fautes.length;
        if (m.pleins.length > 1) fautes.push(`${ici} : ${m.pleins.length} boutons pleins, un seul permis (C-4.1) : ${m.pleins.join(' | ')}`);
        if (m.validerPleinPasFini) fautes.push(`${ici} : « ${m.validerPleinPasFini} » plein alors que l’étape n’est pas finie (C-4.1)`);
        // C-4.1 vérifié : sur une page d'étape, exactement un bouton plein dans toute la page ;
        // aucun seulement là où la prochaine action est un geste sur les photos (liste écrite, à faire trancher).
        if (m.barre && m.tousPleins.length > 1) fautes.push(`${ici} : ${m.tousPleins.length} boutons pleins dans la page, un seul permis (C-4.1) : ${m.tousPleins.join(' | ')}`);
        if (m.barre && !m.tousPleins.length && !SANS_PLEIN.has(nomPage)) fautes.push(`${ici} : aucun bouton plein sur une page d’étape (C-4.1)`);
        if (!m.pleins.length) signalements.push(`${ici} : aucun bouton plein à l’écran${m.tousPleins.length ? ` (« ${m.tousPleins[0]} » plus bas)` : ''}`);
        if (m.marqueurs.length) fautes.push(`${ici} : triangle du navigateur au lieu du chevron SVG (C-5.1) : ${m.marqueurs.slice(0, 5).join(' ; ')}`);
        if (m.annulers.length) fautes.push(`${ici} : « Annuler » ou « Rétablir » hors de sa ligne de 40 px, ou coupé (C-8.2) : ${m.annulers.join(' ; ')}`);
        if (m.aidesIA.length) fautes.push(`${ici} : aide IA sans étincelle ou sans prix (C-4.6) : ${m.aidesIA.slice(0, 5).join(' ; ')}`);
        if (m.horsEcran.length) fautes.push(`${ici} : commande coupée par le bord de l’écran (C-6.2) : ${m.horsEcran.slice(0, 5).join(' ; ')}`);
        if (m.enLargeur.length || m.pageEnLargeur) fautes.push(`${ici} : défilement en largeur (C-7.1) : ${[...(m.pageEnLargeur ? ['la page'] : []), ...m.enLargeur].slice(0, 5).join(' ; ')}`);
        if (m.sansRaison.length) fautes.push(`${ici} : bouton désactivé sans sa raison écrite (C-4.7) : ${m.sansRaison.slice(0, 5).join(' ; ')}`);
        if (m.boutonsPetits.length) fautes.push(`${ici} : bouton sous 16 px (C-2.2) : ${m.boutonsPetits.slice(0, 5).join(' ; ')}`);
        if (m.caracteres.length) fautes.push(`${ici} : caractère-icône au lieu d’une icône SVG (C-1.4) : ${m.caracteres.slice(0, 5).join(' ; ')}`);
        if (m.barre && ECARTE.has(m.etape) && !m.bouclier) fautes.push(`${ici} : barre du bas sans « Rien n’est supprimé » et son bouclier (C-8.4)`);
        console.log(`${m.petits.length || m.faibles.length || autres.length || m.desactives.length || m.vertsAilleurs.length || fautes.length > avant ? '✗' : '✓'} ${ici} : plus petit texte ${m.min} px, ${m.faibles.length} contraste(s) faible(s), ${m.pleins.length} plein(s)`);
        // C-8.2 : avec le plus long geste court possible, « Annuler » garde sa ligne de 40 px et la barre ne bouge pas.
        const sonde = await page.evaluate((libelle) => {
          const texte = document.querySelector('.bouton-annuler .texte-annuler');
          if (!texte) return null;
          const bouton = texte.closest('button');
          const avant = [texte.textContent, bouton.getBoundingClientRect(), document.querySelector('.grille-photos, .grille-floues')?.getBoundingClientRect().top];
          texte.textContent = libelle;
          const b = bouton.getBoundingClientRect();
          const grille = document.querySelector('.grille-photos, .grille-floues')?.getBoundingClientRect().top;
          const r = { h: Math.round(b.height), deborde: bouton.scrollWidth > bouton.clientWidth + 1, dehors: b.right > innerWidth, bouge: grille !== undefined && Math.abs(grille - avant[2]) > 0.5 };
          texte.textContent = avant[0];
          return r;
        }, 'Annuler : remettre 1 234 photos à décider');
        if (sonde && (sonde.h !== 40 || sonde.deborde || sonde.dehors || sonde.bouge))
          fautes.push(`${ici} : « Annuler » avec un long geste : ${sonde.h} px de haut${sonde.deborde ? ', texte qui déborde' : ''}${sonde.dehors ? ', hors de l’écran' : ''}${sonde.bouge ? ', la grille bouge' : ''} (C-8.2)`);
        if (CAPTURES) await page.screenshot({ path: join(CAPTURES, `${nomPage}_${w}_${theme}.png`) });
      }
    }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await page.setViewportSize({ width: 1440, height: 900 });
  };

  /** Parcours au clavier (Tab) d'une page ordinaire : chaque arrêt montre le contour de C-9.5. */
  const clavier = async (nomPage, n = 25) => {
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 0);
    });
    const vus = new Set();
    for (let i = 0; i < n; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(focusVisible);
      if (!f) continue;
      arrets++;
      if (!f.ok && !vus.has(f.nom)) {
        vus.add(f.nom);
        fautes.push(`${nomPage} : focus clavier sans noir / jaune / noir sur ${f.nom} (${f.detail})`);
      }
    }
    await page.evaluate(() => document.activeElement?.blur?.());
  };

  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).waitFor();
  await controler('accueil');
  await clavier('accueil', 10);

  // Faux dossier en vrac dans le stockage privé : les photos et une copie exacte.
  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.multiple = true;
    c.id = 'remplissage';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#remplissage', photos.map((p) => join(PHOTOS, p)));
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
    const ecrire = async (nom, contenu) => {
      const w = await (await source.getFileHandle(nom, { create: true })).createWritable();
      await w.write(contenu);
      await w.close();
    };
    const fichiers = [...document.getElementById('remplissage').files];
    for (const f of fichiers) await ecrire(f.name, f);
    await ecrire('copie de 0140.jpg', fichiers.find((f) => f.name.startsWith('0140')));
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
  });

  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).click();
  const choisir = page.getByRole('button', { name: 'Choisir…' });
  await choisir.nth(0).click();
  await page.getByText('« selecteur_source »').waitFor();
  await choisir.nth(1).click();
  await page.getByText('« selecteur_sortie »').first().waitFor();
  await page.fill('#nom-projet', 'Essai charte');
  await controler('nouveau-projet');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  const valider = async (etape) => {
    await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
    await page.locator('[data-action=valider]').click();
    await page.locator(`main[data-etape=${etape}]`).waitFor({ timeout: 60_000 });
  };

  await page.locator('main[data-etape=inventaire]').waitFor({ timeout: 60_000 });
  await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await controler('inventaire');
  await valider('floues').catch(async () => {
    // Avec des sous-dossiers, l'étape « Dossiers » vient avant les floues.
    await page.locator('main[data-etape=dossiers]').waitFor({ timeout: 1000 });
    await controler('dossiers');
    await valider('floues');
  });
  await controler('floues');
  await valider('doublons');
  await page.locator('.carte-doublons').first().waitFor({ timeout: 60_000 });
  await controler('doublons');
  await clavier('doublons', 30);
  await page.locator('.carte-doublons').first().getByRole('button', { name: 'Comparer en grand' }).click();
  await page.locator('.comparateur .numero-volet').first().waitFor();
  await controler('doublons-comparer');
  await page.keyboard.press('Escape');
  await page.locator('.comparateur').waitFor({ state: 'detached' });
  await valider('tri');
  await controler('tri-apercu');
  const copies = page.locator('.copies-avant-tri');
  if (await copies.count()) await copies.getByRole('button', { name: 'Mettre de côté' }).click();
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger les photos', exact: true }).click();
  await page.locator('.ligne-ranger.fait').waitFor({ timeout: 60_000 });
  await controler('tri-range');
  await page.locator('[data-action=valider]').click();
  await page.locator('.panneau-dossiers').waitFor({ timeout: 60_000 });
  await controler('lieux');
  await clavier('lieux', 30);
  const ldt = page.getByRole('button', { name: 'Ligne de temps' });
  if (await ldt.count()) {
    await ldt.click();
    await page.locator('.ligne-de-temps').waitFor();
    await controler('lieux-ligne-de-temps');
    // Un clic sur une barre ouvre son dossier ; revenue à la ligne de temps, sa barre est choisie.
    await page.locator('.ldt-barre').nth(1).click();
    await ldt.click();
    await page.locator('.ldt-barre.actif').waitFor();
    await controler('lieux-ligne-de-temps-choisie');
    await page.getByRole('button', { name: 'Photos', exact: true }).click();
  }
  await page.locator('.tuile').first().dblclick();
  await page.locator('.visionneuse img').waitFor();
  await controler('visionneuse');
  await page.keyboard.press('Escape');
  await page.locator('.visionneuse').waitFor({ state: 'detached' });
  await valider('petits');
  await controler('petits-dossiers');
  await valider('nommage');
  await controler('nommage');
  await page.locator('[data-action=valider]').click();
  const recap = page.getByRole('dialog', { name: 'Des noms ne sont pas encore appliqués' });
  await Promise.race([recap.waitFor(), page.locator('main[data-etape=consolidation]').waitFor()]);
  if (await recap.count()) {
    await controler('nommage-recapitulatif');
    await recap.getByRole('button', { name: 'Renommer et continuer' }).click();
  }
  await page.locator('main[data-etape=consolidation]').waitFor({ timeout: 60_000 });
  await controler('consolidation');
  await clavier('consolidation', 30);
  await page.locator('[data-action=valider]').click();
  await page.locator('.page-selection').waitFor({ timeout: 60_000 });
  await page.locator('.tuile').first().waitFor({ timeout: 60_000 });
  await controler('selection');
  await clavier('selection', 30);
  // Une photo choisie : la barre d'action (bulle sombre).
  await page.locator('.page-selection .tuile').nth(1).click();
  await page.locator('.barre-action').waitFor();
  await controler('selection-barre-action');
  // Recadrage (salle sombre, tiers dessinés).
  const recadrer = page.getByRole('button', { name: 'Recadrer…' });
  if (await recadrer.count()) {
    await recadrer.click();
    await page.locator('.recadreur').waitFor();
    await page.waitForTimeout(800);
    await controler('recadreur');
    const tiers = await page.evaluate(() => getComputedStyle(document.querySelector('.cadre-recadrage')).backgroundImage);
    if (!tiers.includes('gradient')) fautes.push('recadreur : les lignes des tiers ne sont plus dessinées');
    await page.keyboard.press('Escape');
    await page.locator('.recadreur').waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
      await page.locator('.recadreur').getByRole('button', { name: /^(Annuler|Fermer|Fermer sans recadrer)$/ }).last().click();
    });
  }
  await page.keyboard.press('Escape');
  // Tri rapide (salle sombre), puis quelques choix et sa fin.
  await page.getByRole('button', { name: 'Tri rapide' }).click();
  await page.locator('.tri-rapide').waitFor();
  await page.waitForTimeout(800);
  await controler('tri-rapide');
  await page.keyboard.press('Escape');
  await page.locator('.tri-rapide').waitFor({ state: 'detached' });
  await valider('album');
  await page.locator('.page-album').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await controler('album');
  await page.locator('.bandeau .etape', { hasText: /Sortie$/ }).first().click();
  await page.locator('main[data-etape=sortie]').waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: /Créer \/ mettre à jour la sortie/ }).waitFor({ timeout: 120_000 });
  await controler('sortie');
  await clavier('sortie', 15);
} catch (e) {
  fautes.push(`parcours interrompu après « ${controlees.at(-1) ?? 'rien'} » : ${e.message.split('\n')[0]}`);
} finally {
  await navigateur.close();
  serveur.close();
}

console.log(`\nPages contrôlées (${controlees.length}) : ${controlees.join(', ')} ; ${arrets} arrêts au clavier`);
fautes.unshift(...fautesBuild);
if (signalements.length) {
  console.log(`\nÀ revoir (n'échoue pas) :`);
  for (const s of signalements) console.log(`  • ${s}`);
}
if (erreurs.length) fautes.push(`erreurs de la console : ${[...new Set(erreurs)].slice(0, 5).join(' ; ')}`);
if (controlees.length < MINIMUM_PAGES) fautes.push(`seulement ${controlees.length} pages contrôlées (minimum ${MINIMUM_PAGES})`);
if (fautes.length) {
  console.log(`\n✗ ${fautes.length} écart(s) à la charte :`);
  for (const f of fautes) console.log(`  • ${f}`);
  process.exit(1);
}
console.log('\n✓ Charte respectée sur toutes les pages contrôlées');
