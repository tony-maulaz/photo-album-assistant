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
//   - échelle sobre (retours du 29.10) : le texte des boutons fait 14 px au moins, celui de Revenir et Valider
//     et continuer 16 px, à 36 px de haut (C-2.2) ; les liens exceptés ;
//   - aucun caractère-icône (✕ ✦ ▾ ▸ ◀ ↻ ✂ ≤ ≈ …) ni émoji dans les textes (C-1.4) ;
//   - la barre du bas des étapes où l'on écarte dit « Rien n'est supprimé » (C-8.4) ;
//   - les parties repliables montrent le chevron SVG, pas le triangle du navigateur (C-5.1) ;
//   - « Annuler » et « Rétablir » tiennent sur une ligne de 32 px, même avec le plus
//     long geste court (sonde), sans déborder ni faire bouger la grille (C-8.2) ;
//   - toute aide IA porte l'étincelle et son prix, ou « … » (C-4.6) ;
//   - aucune commande coupée par le bord de l'écran (C-6.2), rien qui défile en largeur (C-7.1) ;
//   - rien n'est posé sur une photo : ni pastille, ni étoile, ni marque, ni pseudo-élément écrit (C-9.1) ;
//   - toute photo qui a un état (Doublons, Floues, Sélection, vignettes de Comparer) a sa bande de 28 px
//     juste dessous, qui n'a ni l'aplat vert plein ni le bord d'une commande (C-9.1, C-9.2).
//   - le mot d'une bande d'état n'est jamais coupé, même au plus petit curseur avec ↻ au bout (C-10.4).
// « Comparer en grand » à 2, 3, 4 et 6 photos (copies exactes ajoutées au dossier), aux deux tailles et au
// palier « texte agrandi » (1024×464, soit 1280 à 125 %, C-7.6) : présentation calculée (une paire côte à
// côte), toutes les photos à l'écran, côte à côte jamais sous 220 px de haut (sauf une paire), « Accepter »
// plein visible, rappel « ↑ ↓ photo · ← → groupe » à toutes les tailles, « Rien n'est supprimé », aucun
// texte coupé (titre, ligne d'information, bandes, légende ; C-10.4), le clavier dans la vue à l'ouverture,
// Entrée bascule (aussi après ↓ en côte à côte, sans changer l'état d'aucune photo), « Côte à côte » choisi
// à la main garde toutes les photos à l'écran (6 photos), ↓ change de photo en « Une à la fois ».
// Comparer de la Sélection à 3 photos, aux trois tailles : mêmes contrôles, et ↓ puis Entrée ne met
// aucune photo dans l'album.
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
/** « Comparer en grand » : en plus, le palier « texte agrandi » (C-7.6). */
const TAILLES_COMPARER = [...TAILLES, [1024, 464]];
const THEMES = ['light', 'dark'];
/** Étapes où l'on écarte des photos : la barre du bas dit « Rien n'est supprimé » (C-8.4). */
const ECARTE = new Set(['floues', 'doublons', 'tri', 'lieux', 'sortie']);
/** Pages contrôlées au moins : sinon le parcours s'est arrêté trop tôt. */
const MINIMUM_PAGES = 20;
/**
 * Pages d'étape sans bouton plein permis (C-4.1), à faire trancher par l'utilisateur
 * (« au plus un plein ; aucun quand la prochaine action est un geste ou un choix sans préférence ») :
 * - Décider une par une, la visionneuse : choisir ★ / ★★ / ✕ sur les photos (la Sélection a son plein
 *   depuis le lot 4 : « Tri rapide », ou « Dans l'album » pour les photos choisies) ;
 * - Petits dossiers sans proposition de l'IA : deux dossiers voisins au choix, aucun n'est mis en avant.
 */
const SANS_PLEIN = new Set(['tri-rapide', 'visionneuse', 'petits-dossiers', 'selection-comparer-3']);
/** Pages dont les photos ont un état : au moins une bande d'état à l'écran (C-9.1). */
const BANDES = new Set(['floues', 'doublons', 'selection', 'selection-choisies']);

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
  // C-2.2, échelle sobre (retours du 29.10) : texte des boutons à 14 px au moins ; Revenir et Valider et continuer
  // à 16 px et 36 px de haut (les liens suivent le texte qui les entoure ; une photo n'a pas de libellé).
  const boutonsPetits = [...document.querySelectorAll('button')]
    .filter((x) => visible(x) && !x.matches('.lien') && !x.closest('.bandeau, .ldt-barre') && !x.matches('.ldt-barre') && !x.querySelector('img, canvas, .cadre-tuile, .sans-miniature') && (x.textContent || '').trim())
    .filter((x) => {
      const bas = !!x.closest('.barre-validation .actions');
      return parseFloat(getComputedStyle(x).fontSize) < (bas ? 16 : 14) || (bas && Math.abs(x.getBoundingClientRect().height - 36) > 1);
    })
    .map((x) => `${getComputedStyle(x).fontSize} ${Math.round(x.getBoundingClientRect().height)} px de haut « ${nom(x)} »`);
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
  // C-8.2, C-10.4 : « Annuler : … » sur une ligne de 32 px (échelle sobre), entier (rien ne déborde du bouton).
  const annulers = [...document.querySelectorAll('button.bouton-annuler, button.bouton-retablir')]
    .filter((x) => visible(x))
    .filter((x) => Math.abs(x.getBoundingClientRect().height - 32) > 1 || x.scrollWidth > x.clientWidth + 1)
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
  for (const barre of document.querySelectorAll('.tete-vue, .tete-etape, .barre-validation, .comparateur-tete, .barre-action, .entete-cadre, .outils-cadre, .tete-col, .barre-haut-recadreur, .barre-bas-recadreur')) {
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
  // C-9.1 : rien de posé sur une photo visible (élément en position absolue ou fixe avec du texte ou une
  // icône, ou pseudo-élément écrit, dans le cadre de la photo).
  const CADRES = '.cadre-miniature, .cadre-tuile, .volet-image, .cadre-vignette, .tri-image, .image-visionneuse';
  const marques = [];
  for (const img of document.querySelectorAll(`:is(${CADRES}) :is(img, canvas)`)) {
    const ri = img.getBoundingClientRect();
    if (ri.width < 40 || ri.height < 40 || !visible(img)) continue;
    const cadre = img.closest(CADRES);
    // Vue plein écran : la photo elle-même (ses commandes sont autour) ; miniature : tout son cadre.
    const rc = cadre.matches('.tri-image, .image-visionneuse') ? ri : cadre.getBoundingClientRect();
    const porteur = cadre.closest('.tuile, .photo-doublon, .volet, .vignette-comparer, .tri-rapide, .visionneuse') ?? cadre.parentElement;
    for (const e of porteur.querySelectorAll('*')) {
      if (e === img || e === cadre || e.contains(cadre) || cadre === e || img.contains(e)) continue;
      if (!/^(absolute|fixed)$/.test(getComputedStyle(e).position)) continue;
      if (!((e.textContent || '').trim() || e.querySelector('svg') || e.tagName.toLowerCase() === 'svg')) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
      if (r.left >= rc.left - 2 && r.right <= rc.right + 2 && r.top >= rc.top - 2 && r.bottom <= rc.bottom + 2) marques.push(`.${[...e.classList].join('.')} « ${nom(e)} »`);
    }
    for (const avant of ['::before', '::after']) {
      const c = getComputedStyle(cadre, avant).content;
      if (c && !['none', 'normal', '""', "''"].includes(c)) marques.push(`${avant} « ${c} » sur .${[...cadre.classList].join('.')}`);
    }
  }
  // C-9.1, C-9.2 : la bande d'état sous chaque photo qui a un état ; jamais la forme d'un bouton.
  const verts2 = verts;
  const bandes = [];
  const photosEtat = [...document.querySelectorAll('.tuile-doublon .cadre-tuile, .page-selection .tuile .cadre-miniature, .page-floues .tuile .cadre-miniature, .vignette-comparer .cadre-vignette')].filter((c) => {
    const b = c.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < H;
  });
  for (const cadre of photosEtat) {
    const bande = cadre.nextElementSibling;
    const ici = `${cadre.closest('[aria-label]')?.getAttribute('aria-label')?.slice(0, 30) ?? cadre.className}`;
    if (!bande?.matches('.bande-etat')) {
      bandes.push(`pas de bande sous ${ici}`);
      continue;
    }
    const rb = bande.getBoundingClientRect();
    const rc = cadre.getBoundingClientRect();
    const st = getComputedStyle(bande);
    if (Math.abs(rb.height - 28) > 1) bandes.push(`bande de ${Math.round(rb.height)} px sous ${ici}`);
    if (rb.top < rc.bottom - 1) bandes.push(`bande posée sur la photo ${ici}`);
    if (verts2.has(st.backgroundColor)) bandes.push(`bande au vert plein « ${nom(bande)} »`);
    if (parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none') bandes.push(`bande bordée comme une commande « ${nom(bande)} »`);
    if (!(bande.textContent || '').trim()) bandes.push(`bande sans mot sous ${ici}`);
  }
  // Copies exactes (lot 4) : la photo montrée une fois, une ligne par exemplaire avec sa bande d'état.
  const exemplaires = [...document.querySelectorAll('.tuile-doublon.exemplaire > .bande-etat')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && (b.textContent || '').trim();
  }).length;
  // C-10.4 : le mot d'une bande n'est jamais coupé (ni « … » ni coupé net), sur toute bande visible.
  for (const bande of document.querySelectorAll('.bande-etat')) {
    const b = bande.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > H) continue;
    const mot = bande.querySelector('.mot-bande') ?? bande;
    const rm = mot.getBoundingClientRect();
    if (bande.scrollWidth > bande.clientWidth + 1 || mot.scrollWidth > mot.clientWidth + 1 || rm.right > b.right + 1) bandes.push(`mot d’état coupé « ${nom(bande)} » (${bande.scrollWidth} pour ${bande.clientWidth} px)`);
  }
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
    marques: [...new Set(marques)],
    bandes: [...new Set(bandes)],
    photosEtat: photosEtat.length,
    exemplaires,
  };
}

/** « Comparer en grand » ouvert : présentation, photos à l'écran, barres (C-7.5). */
function mesurerComparer() {
  const vue = document.querySelector('.comparateur');
  if (!vue) return null;
  const H = innerHeight;
  const W = innerWidth;
  const dedans = (e) => {
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.top >= -1 && b.bottom <= H + 1 && b.left >= -1 && b.right <= W + 1;
  };
  const scene = vue.querySelector('.volets');
  const presentation = vue.dataset.presentation ?? '';
  const images = [...vue.querySelectorAll('.volet-image')].map((x) => x.getBoundingClientRect());
  const vignettes = [...vue.querySelectorAll('.vignette-comparer')];
  const ol = vue.querySelector('.vignettes-comparateur ol')?.getBoundingClientRect();
  const plein = vue.querySelector('button.principal');
  return {
    presentation,
    titre: vue.querySelector('.titre-legende')?.textContent ?? '',
    // L'état de la photo affichée (côte à côte : la carte courante), et s'il y a une photo « À garder ».
    etatCourante: ((presentation === 'une' ? vue.querySelector('.vignette-comparer.affichee .bande-etat') : vue.querySelector('.cmp-carte.courante .choix-photo button.on'))?.textContent ?? '').trim().replace(/^\d+ · /, ''),
    unAGarder: [...vue.querySelectorAll('.vignette-comparer .bande-etat, .cmp-carte .choix-photo button.on')].some((x) => /À garder/.test(x.textContent ?? '')),
    volets: vue.querySelectorAll('.volet').length,
    hauteurs: images.map((b) => Math.round(b.height)),
    imagesDedans: [...vue.querySelectorAll('.volet-image')].every(dedans),
    vignettes: vignettes.length,
    vignettesVisibles: vignettes.filter((v) => {
      const b = v.getBoundingClientRect();
      return ol && b.top >= ol.top - 1 && b.bottom <= ol.bottom + 1 && dedans(v);
    }).length,
    sceneDebordeLargeur: !!scene && scene.scrollWidth > scene.clientWidth + 1,
    pleinVisible: !!plein && dedans(plein),
    rappel: (vue.querySelector('.touches-comparer')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    rappelVisible: (() => {
      const r = vue.querySelector('.touches-comparer');
      return !!r && getComputedStyle(r).display !== 'none' && dedans(r);
    })(),
    rienSupprime: !!vue.querySelector('.rien-supprime-vue .icone'),
    // État de chaque photo (bandes des cartes ou des vignettes) : ↓ puis Entrée ne doit rien y changer.
    etats: (presentation === 'une' ? [...vue.querySelectorAll('.vignette-comparer .bande-etat')].map((x) => (x.textContent || '').trim().replace(/^\d+ · /, '')) : [...vue.querySelectorAll('.cmp-carte .choix-photo button.on')].map((x) => (x.textContent || '').trim())).join(' | '),
    // « Côte à côte » impossible à cette taille (photos trop petites) : le bouton est désactivé, sa raison écrite.
    coteImpossible: !!vue.querySelector('.choix-presentation button:first-child:disabled'),
    focusDansLaVue: !!document.activeElement?.closest('.comparateur'),
    // C-10.4 : aucun texte coupé (« … » ou coupé net) ; la remarque des cartes a droit à 2 lignes.
    // Le plein (« Accepter : garder la 4 [v], écarter 5 autres ») n'est jamais rogné (C-10.5, tour 1 du lot 4).
    coupes: [...vue.querySelectorAll('.comparateur-tete h2, .cmp-ligne-texte > span, .rien-supprime-vue, .alerte-doublons, .titre-legende, .infos-une > *, .choix-photo button, .touches-comparer, .position-groupe, .plusieurs-photos, .bande-etat, .cmp-bas [data-action=accepter]')]
      .filter((x) => {
        const b = x.getBoundingClientRect();
        if (!b.width || !b.height || getComputedStyle(x).display === 'none') return false;
        const parent = x.closest('.legende-une');
        // La légende de « Une à la fois » défile si elle est plus haute que la scène : rien n'y est perdu.
        const horsVue = parent ? false : b.bottom > H + 1 || b.right > W + 1;
        // … mais rien n'y est rogné : ni par le bord de la légende (« Garder plusieurs photo▌ »), ni par la boîte des
        // choix tassée (« ★★ Grande », « À écarter » à 1024×464 ; tour 2 du lot 4).
        if (parent) {
          const l = parent.getBoundingClientRect();
          const boite = x.parentElement?.closest('.choix-photo')?.getBoundingClientRect();
          if (b.right > l.right + 1 || b.left < l.left - 1) return true;
          // Le texte lui-même, ligne par ligne, et pas seulement la boîte : un label étiré à la largeur de la légende
          // reste dedans alors que son texte déborde (« Garder plusieurs photo▌ », tour 3 du lot 4).
          const r = document.createRange();
          r.selectNodeContents(x);
          const droite = l.left + parent.clientLeft + parent.clientWidth;
          if ([...r.getClientRects()].some((c) => c.width > 0 && (c.right > droite + 0.5 || c.left < l.left - 0.5))) return true;
          if (boite && (b.bottom > boite.bottom + 1 || b.top < boite.top - 1)) return true;
        }
        return horsVue || x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 2;
      })
      .map((x) => `${x.className || x.tagName.toLowerCase()} « ${(x.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)} »`),
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
        if (m.annulers.length) fautes.push(`${ici} : « Annuler » ou « Rétablir » hors de sa ligne de 32 px, ou coupé (C-8.2) : ${m.annulers.join(' ; ')}`);
        if (m.aidesIA.length) fautes.push(`${ici} : aide IA sans étincelle ou sans prix (C-4.6) : ${m.aidesIA.slice(0, 5).join(' ; ')}`);
        if (m.horsEcran.length) fautes.push(`${ici} : commande coupée par le bord de l’écran (C-6.2) : ${m.horsEcran.slice(0, 5).join(' ; ')}`);
        if (m.enLargeur.length || m.pageEnLargeur) fautes.push(`${ici} : défilement en largeur (C-7.1) : ${[...(m.pageEnLargeur ? ['la page'] : []), ...m.enLargeur].slice(0, 5).join(' ; ')}`);
        if (m.sansRaison.length) fautes.push(`${ici} : bouton désactivé sans sa raison écrite (C-4.7) : ${m.sansRaison.slice(0, 5).join(' ; ')}`);
        if (m.marques.length) fautes.push(`${ici} : marque posée sur une photo (C-9.1) : ${m.marques.slice(0, 5).join(' ; ')}`);
        if (m.bandes.length) fautes.push(`${ici} : bande d’état (C-9.1, C-9.2) : ${m.bandes.slice(0, 5).join(' ; ')}`);
        if (BANDES.has(nomPage) && h >= 900 && !m.photosEtat && !m.exemplaires) fautes.push(`${ici} : aucune photo avec sa bande d’état à l’écran (C-9.1)`);
        if (m.boutonsPetits.length) fautes.push(`${ici} : bouton sous l’échelle sobre (14 px ; 16 px et 36 px dans la barre du bas, C-2.2) : ${m.boutonsPetits.slice(0, 5).join(' ; ')}`);
        if (m.caracteres.length) fautes.push(`${ici} : caractère-icône au lieu d’une icône SVG (C-1.4) : ${m.caracteres.slice(0, 5).join(' ; ')}`);
        if (m.barre && ECARTE.has(m.etape) && !m.bouclier) fautes.push(`${ici} : barre du bas sans « Rien n’est supprimé » et son bouclier (C-8.4)`);
        console.log(`${m.petits.length || m.faibles.length || autres.length || m.desactives.length || m.vertsAilleurs.length || fautes.length > avant ? '✗' : '✓'} ${ici} : plus petit texte ${m.min} px, ${m.faibles.length} contraste(s) faible(s), ${m.pleins.length} plein(s)`);
        // C-8.2 : avec le plus long geste court possible, « Annuler » garde sa ligne de 32 px et la barre ne bouge pas.
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
        if (sonde && (sonde.h !== 32 || sonde.deborde || sonde.dehors || sonde.bouge))
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
    // Groupes de copies de 3, 4 et 6 photos (portrait, paysage) : « Comparer en grand » à 3, 4 et 6 photos.
    for (const [debut, n] of [['0107', 2], ['0109', 3], ['0181', 5]])
      for (let i = 1; i <= n; i++) await ecrire(`copie ${i} de ${debut}.jpg`, fichiers.find((f) => f.name.startsWith(debut)));
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
  // Lot 4 : l'Aide s'ouvre d'elle-même à 1440 px à la première visite et la liste de gauche passe en menu ; on la ferme.
  if ((await page.locator('[data-place=aide]').getAttribute('aria-expanded')) === 'true') await page.locator('[data-place=aide]').click();
  // « Comparer en grand » à 2, 3, 4 et 6 photos (C-7.5), aux deux tailles : toutes les copies dans une
  // section (« Grouper par dossier » : elles sont toutes dans le dossier à trier).
  // « Grouper et classer » est replié dans la liste de gauche (lot 4) : on l'ouvre.
  if (!(await page.locator('.outils-doublons details.grouper-classer').evaluate((d) => d.open))) await page.locator('.outils-doublons details.grouper-classer > summary').click();
  await page.locator('.outils-doublons select').first().selectOption('dossier');
  await page.waitForTimeout(500);
  /** Contrôles de « Comparer en grand » à une taille ; `n` photos, `doublons` : la vue où l'on écarte. */
  const controlerComparer = async (nomVue, n, [w, h], { doublons }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const c = await page.evaluate(mesurerComparer);
    const ici = `${nomVue} ${w}×${h}`;
    if (CAPTURES) await page.screenshot({ path: join(CAPTURES, `${nomVue}_${w}x${h}.png`) });
    if (n === 2 && c.presentation !== 'cote') fautes.push(`${ici} : une paire doit être côte à côte (${c.presentation})`);
    if (c.presentation === 'cote' && (c.volets !== n || !c.imagesDedans || c.sceneDebordeLargeur)) fautes.push(`${ici} : côte à côte, les ${n} photos ne sont pas toutes à l’écran (${c.volets} volets)`);
    if (c.presentation === 'cote' && n >= 3 && c.hauteurs.some((x) => x < 219)) fautes.push(`${ici} : côte à côte calculé sous 220 px de haut (${c.hauteurs.join(', ')})`);
    if (c.presentation === 'une' && (c.vignettes !== n || c.vignettesVisibles !== n || !c.imagesDedans)) fautes.push(`${ici} : une à la fois, ${c.vignettesVisibles} vignettes visibles sur ${n}`);
    if (doublons && !c.pleinVisible) fautes.push(`${ici} : « Accepter » plein hors de l’écran (C-4.1)`);
    if (!c.rappelVisible || !(doublons ? /↑ ↓ photo · ← → groupe/ : /↑ ↓ photo/).test(c.rappel)) fautes.push(`${ici} : rappel des flèches absent ou caché (C-4.10) : « ${c.rappel} »`);
    if (doublons && !c.rienSupprime) fautes.push(`${ici} : « Rien n’est supprimé » absent de la vue où l’on écarte (C-8.4)`);
    if (!doublons && c.rienSupprime) fautes.push(`${ici} : « Rien n’est supprimé » dans une vue où l’on n’écarte pas (C-8.4)`);
    if (c.coupes.length) fautes.push(`${ici} : texte coupé (C-10.4) : ${c.coupes.slice(0, 5).join(' ; ')}`);
    if (!c.focusDansLaVue) fautes.push(`${ici} : le clavier n’est pas dans la vue (il reste sur la page dessous)`);
    console.log(`${ici} : ${c.presentation}, ${c.presentation === 'cote' ? `photos de ${c.hauteurs.join(', ')} px de haut` : `${c.vignettesVisibles} vignettes visibles`}`);
    // Entrée bascule ; « Côte à côte » choisi à la main garde toutes les photos à l'écran.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(mesurerComparer);
    if (c.coteImpossible) {
      if (apres.presentation !== 'une') fautes.push(`${ici} : « Côte à côte » désactivé, et pourtant Entrée y passe`);
      console.log(`${ici} : « Côte à côte » désactivé à cette taille (${n} photos ne tiennent pas), Entrée ne change rien`);
      return;
    }
    if (apres.presentation === c.presentation) fautes.push(`${ici} : Entrée ne bascule pas la présentation`);
    if (apres.presentation === 'cote' && (apres.volets !== n || !apres.imagesDedans || apres.sceneDebordeLargeur)) fautes.push(`${ici} : « Côte à côte » choisi à la main, des photos sortent de l’écran`);
    if (apres.coupes.length) fautes.push(`${ici} (après Entrée) : texte coupé (C-10.4) : ${apres.coupes.slice(0, 5).join(' ; ')}`);
    // Côte à côte : ↓ puis Entrée bascule, sans changer l'état d'aucune photo (le clavier va sur la carte).
    if (apres.presentation !== 'cote') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }
    const etatsAvant = (await page.evaluate(mesurerComparer)).etats;
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const piege = await page.evaluate(mesurerComparer);
    if (piege.presentation !== 'une') fautes.push(`${ici} : côte à côte, ↓ puis Entrée ne bascule pas la présentation (${piege.presentation})`);
    if (piege.etats !== etatsAvant) fautes.push(`${ici} : côte à côte, ↓ puis Entrée a changé l’état d’une photo (« ${etatsAvant} » → « ${piege.etats} »)`);
    // Une à la fois : ↓ passe à la photo suivante.
    const avant = piege.titre;
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    if ((await page.evaluate(mesurerComparer)).titre === avant) {
      // Sur la dernière photo : ↑ revient à l'avant-dernière.
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(200);
    }
    if ((await page.evaluate(mesurerComparer)).titre === avant) fautes.push(`${ici} : ↑ ↓ ne changent pas de photo (« ${avant} »)`);
  };

  const vusComparer = new Set();
  const cartes = page.locator('article.carte-doublons');
  for (let i = 0; i < (await cartes.count()); i++) {
    const n = await cartes.nth(i).locator('.tuile-doublon').count();
    if (![2, 3, 4, 6].includes(n) || vusComparer.has(n)) continue;
    vusComparer.add(n);
    // La paire : la photo 2 « À garder », la 1 « À écarter » ; rouverte, la vue doit s'ouvrir sur la 2.
    if (n === 2) {
      await cartes.nth(i).getByRole('button', { name: 'Comparer en grand' }).click();
      await page.locator('.comparateur[data-presentation]').waitFor();
      await page.waitForTimeout(300);
      await page.locator('.cmp-carte[data-numero="2"] .choix-photo button', { hasText: 'À garder' }).click();
      const un = page.locator('.cmp-carte[data-numero="1"] .choix-photo button', { hasText: 'À écarter' });
      if (!/\bon\b/.test((await un.getAttribute('class')) ?? '')) await un.click();
      await page.keyboard.press('Escape');
      await page.locator('.comparateur').waitFor({ state: 'detached' });
    }
    await cartes.nth(i).getByRole('button', { name: 'Comparer en grand' }).click();
    await page.locator('.comparateur[data-presentation]').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.comparateur .volet-image img')].every((x) => x.complete && x.naturalWidth > 0), null, { timeout: 20_000 }).catch(() => undefined);
    const nomVue = `doublons-comparer-${n}`;
    // Ouverture (C-7.5) : sans photo conseillée, sur la première « À garder ».
    const ouverture = await page.evaluate(mesurerComparer);
    if (n === 2) console.log(`${nomVue} : ouverture sur « ${ouverture.etatCourante} », états ${ouverture.etats}`);
    if (ouverture.unAGarder && !/À garder/.test(ouverture.etatCourante)) fautes.push(`${nomVue} : la vue s’ouvre sur une photo « ${ouverture.etatCourante} » alors qu’une autre est « À garder »`);
    await controler(nomVue);
    for (const taille of TAILLES_COMPARER) {
      await controlerComparer(nomVue, n, taille, { doublons: true });
      // Retour à la présentation calculée pour la taille suivante (le choix à la main est gardé par la page : on la quitte).
      await page.keyboard.press('Escape');
      await page.locator('.comparateur').waitFor({ state: 'detached' });
      await cartes.nth(i).getByRole('button', { name: 'Comparer en grand' }).click();
      await page.locator('.comparateur[data-presentation]').waitFor();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('Escape');
    await page.locator('.comparateur').waitFor({ state: 'detached' });
  }
  for (const n of [2, 3, 4, 6]) if (!vusComparer.has(n)) fautes.push(`Comparer en grand : aucun groupe de ${n} photos à essayer`);
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
  // Une photo choisie : la colonne de droite « 1 photo choisie » (lot 4 : plus de barre noire).
  await page.locator('.page-selection .tuile').nth(1).click();
  await page.locator('.panneau-choix .bloc-fixe').waitFor();
  await controler('selection-choisies');
  // Recadrer et tourner (salle sombre, tiers dessinés).
  const recadrer = page.locator('.panneau-choix').getByRole('button', { name: /^Recadrer et tourner/ });
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
  // Le mot de la bande n'est jamais coupé (C-10.4) : « ✕ Pas pour l'album » et ↻ au bout, au plus petit curseur.
  {
    const tuile = page.locator('.page-selection .tuile').nth(0);
    await tuile.click();
    await page.keyboard.press('x');
    await page.keyboard.press('r');
    await tuile.locator('.bande-etat.pas').waitFor();
    // Taille des photos (retours du 29.10) : la petite photo jusqu'à la plus petite taille, puis la grande autant de
    // fois pour revenir.
    const moins = page.locator('[data-place="taille"] [data-action="plus-petites"]');
    const plus = page.locator('[data-place="taille"] [data-action="plus-grandes"]');
    let pas = 0;
    while (await moins.isEnabled()) {
      await moins.click();
      pas++;
    }
    await page.waitForTimeout(600);
    for (const [w, h] of TAILLES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      const m = await page.evaluate(mesurer);
      const coupes = m.bandes.filter((x) => x.startsWith('mot d’état coupé'));
      if (coupes.length) fautes.push(`selection ${w}×${h}, curseur au minimum : ${coupes.slice(0, 3).join(' ; ')}`);
      const serree = await tuile.evaluate((x) => ({ serree: 'serree' in x.dataset, marque: !!x.querySelector('.marques-remarque .badge.rotation') && getComputedStyle(x.querySelector('.marques-remarque')).display !== 'none' }));
      if (serree.serree && !serree.marque) fautes.push(`selection ${w}×${h} : la marque ↻ a quitté la bande sans passer dans la remarque (C-9.7)`);
      console.log(`selection ${w}×${h}, curseur au minimum : ${coupes.length ? 'mot coupé' : 'mot entier'}${serree.serree ? ', ↻ dans la remarque' : ', ↻ au bout de la bande'}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    for (let i = 0; i < pas; i++) await plus.click();
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Escape');
  }
  // Comparer de la Sélection à 3 photos (C-7.5), aux trois tailles ; ↓ puis Entrée ne met aucune photo dans l'album.
  {
    const tuiles = page.locator('.page-selection .tuile');
    await tuiles.nth(0).click();
    await tuiles.nth(1).click({ modifiers: ['Control'] });
    await tuiles.nth(2).click({ modifiers: ['Control'] });
    const ouvrir = async () => {
      await page.locator('.panneau-choix').getByRole('button', { name: /^Comparer en grand/ }).click();
      await page.locator('.comparateur[data-presentation]').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.comparateur .volet-image img')].every((x) => x.complete && x.naturalWidth > 0), null, { timeout: 20_000 }).catch(() => undefined);
    };
    await ouvrir();
    await controler('selection-comparer-3');
    for (const taille of TAILLES_COMPARER) {
      await controlerComparer('selection-comparer-3', 3, taille, { doublons: false });
      await page.keyboard.press('Escape');
      await page.locator('.comparateur').waitFor({ state: 'detached' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await ouvrir();
    }
    await page.keyboard.press('Escape');
    await page.locator('.comparateur').waitFor({ state: 'detached' });
    await page.keyboard.press('Escape');
  }
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
