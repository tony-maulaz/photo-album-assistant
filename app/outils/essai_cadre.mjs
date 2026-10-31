// Essai du cadre commun (lot 4 de la charte, sous-lot 1 « essais d'abord », D111) sur les vraies pages
// de l'application, dans Chromium sans affichage, avec le FICHIER CONSTRUIT (vite build servi tel quel,
// comme essai_charte.mjs). Les contrôles des maquettes du lot 4 (travail/charte-lot4/outils/capturer.mjs v6)
// y sont portés pour les pages du pilote (Doublons, Sélection, Recadreur), avec les essais de geste et
// les essais reportés du lot 3. Ils ÉCHOUENT tant que le pilote (sous-lot 2) n'est pas fait.
//
// Jeu d'essai : les photos de tests/photos_reelles, plus 110 photos fabriquées dans le navigateur
// (motifs nets, datées par leur nom) pour que les colonnes défilent vraiment :
//   - le 1er août 2026, 9 rafales (2, 3, 4, 5, 6, 3, 2, 4 et 12 photos) ; le 2 août, 3 rafales (journée suivante) ;
//   - le 3 août, 60 photos seules ; l'une est copiée dans « Juillet 2025 · vacances chez les cousins »
//     (40 signes) et « Album de Lea et Max » (copies exactes à 3 exemplaires) ; « copie de 0140.jpg ».
// Les nombres à 4 chiffres et le texte le plus long sont posés par des sondes (barre du bas, plein de
// Doublons) ; l'anglais est contrôlé à la fin (Doublons et Sélection, langue « en »).
//
// Tailles : 1440×900, 1280×580, 1024×464 (palier « texte agrandi ») et 1024×400 (écran très bas, < 440 px),
// en clair et en sombre.
//
// Pages du pilote (toujours contrôlées) :
//   cadre  : forme E (retours du 29.10, D112) : la page défile en entier, une seule barre de défilement (aucune
//            zone de photos ne défile dans une autre) ; à mi-course et en bas de la page, la ligne de l'étape est
//            collée en haut (titre, Annuler, Aide, Taille au même x), la barre du projet est partie, la vue en
//            cours reste écrite dans la ligne (« Rafales ▾ »), la barre du bas et Valider ne bougent pas ; la fin
//            des colonnes collées (liste, panneau, Aide) se voit ; barre du bas de 64 / 56 / 56 px, même avec
//            des nombres à 4 chiffres ; Valider au même pixel sur toutes les pages, à chaque taille ;
//   places : dans la ligne de l'étape, Aide juste avant Menu (un seul Menu à l'écran) ; ↶ à 284 px du bord
//            droit (x 996 à 1280, 1156 à 1440), ↷ juste après, en icônes seules avec leur nom lu et leur
//            infobulle ; Taille juste à gauche de ↶, à la même hauteur ; ↶ et ↷ à 32 px ; le titre de l'étape
//            à 24 px du bord et au même pixel d'une page à l'autre ;
//   plein  : exactement un bouton plein entier et non recouvert (elementFromPoint), à l'arrivée, à mi-course
//            et en bas de la page, et de chaque colonne collée qui défile ;
//   aide   : sous 1440 px, l'Aide ne s'ouvre pas seule à la première visite et porte « à lire » ; à 1440, elle
//            s'ouvre seule (choix 5) ;
//   liste  : au palier (1024), la liste de gauche devient un menu (un seul exemplaire dans la page) ;
//   image  : rien n'est posé sur une photo (C-9.1).
// Doublons : chaque en-tête de groupe sur une ligne (56 / 52 / 48 px au plus, plein au bout à droite), aussi
//   avec le texte le plus long ; la place de chaque photo au début de sa bande (« 4 · À garder ») ; le plein
//   nomme ce qu'il garde (« garder la 4, écarter 5 autres », « garder 3 photos, écarter 9 autres », Copies :
//   « garder celle de « dossier » ») et sa vignette est la photo gardée ; aucun nombre nu ; à chaque position,
//   ce que le plein garde se voit ou se lit ; Copies exactes : la photo une seule fois ; plus d'accroche du
//   défilement (forme E) ; « Journée suivante à accepter » entière sur la ligne du dernier groupe après la molette ;
//   « Rien n'est supprimé » court.
// Gestes (Doublons) : un clic dans un autre groupe lui donne le plein sans défilement, A vise ce groupe ;
//   double-clic sur le plein, A deux fois en 150 ms, A gardée enfoncée : un seul groupe accepté (garde de
//   0,5 s) ; un champ garde son focus pendant la molette et « a » n'y accepte rien ; après la molette, le plein
//   suit sans cadre jaune ; fermer Comparer après « Groupe suivant » donne le plein au groupe regardé ;
//   Tab vers un autre groupe lui donne le plein, le focus n'est pas caché.
// Sélection : pas de barre noire ; « N photos choisies » dans la colonne de droite ; un seul plein.
// Recadreur : « Accepter le recadrage » entier à toutes les tailles ; un seul « Annuler » ; « Remettre la
//   photo entière » ; quart de tour immédiat, défait par Annuler sans quitter la vue.
// Tour 1 des contrôles (29.10) : « Annuler : … » de l'en-tête suit chaque geste (Doublons : clic, A, Ctrl+Z ;
//   Sélection : deux décisions) ; aucun plein rogné (page et Comparer, rafale de 12) ; l'en-tête collé touche le
//   bord de la zone ; à l'arrivée, la bande « À garder » du groupe du plein est entière ; « Journée suivante » aussi
//   à 1024×400 ; A et Entrée gardées 1,2 s ; champ « Chercher » (groupé par dossier) ; Tab puis A ; « Garder
//   plusieurs photos » ; plein vers l'onglet suivant sur « Mis de côté » ; Espace sur un bouton de la Sélection ;
//   en-tête immobile d'un geste à l'autre et liste en menu fermée par Échap (palier) ; Recadreur : « Remettre la
//   photo entière » entier, pile mêlée, Rétablir, Entrée sur « Fermer sans recadrer ».
// Essais reportés du lot 3 (Comparer) : touches 1 à 9 sans effet sur une vignette hors de l'écran ;
//   ← → avec le filtre « À accepter » restent dans la journée ; onglet « Mis de côté » (bandes, rien sur l'image).
//
// Les autres pages traversées (Inventaire, Dossiers, Floues, Tri, Lieux, Petits dossiers, Nommage, Réunir) sont
// « pas encore passées au cadre » tant qu'elles ne portent pas data-cadre="commun" : elles n'ont que les
// contrôles qui valent déjà partout (Valider au même pixel et visible, rien sur une photo, pas de défilement en
// largeur). Une page qui porte data-cadre="commun" reçoit tous les contrôles du cadre.
//
// Repères attendus de l'application (sous-lot 2) : data-cadre="commun" (page passée au cadre ; « ancien » ou
// absent sinon) ; [data-place=aide] et [data-place=taille] (repli : .bouton-aide) ;
// [data-action=accepter] et [data-action=comparer] (existants) ; [data-action=journee-suivante] ;
// [data-action=menu-liste] ; [data-action=quart-de-tour] (repli : libellé « quart de tour » ou « Tourner ») ;
// .bande-etat.choisie / .gardee (À garder) ; .chemin-doublon sur la ligne de chaque exemplaire.
//
// Usage (depuis app/) : node outils/essai_cadre.mjs   (CAPTURES=dossier pour des captures d'écran)

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
const TAILLES = [
  [1440, 900],
  [1280, 580],
  [1024, 464],
  [1024, 400],
];
const THEMES = ['light', 'dark'];
/** Pages du pilote (sous-lot 2) : contrôlées même sans data-cadre="commun". */
const PILOTE = ['doublons', 'selection', 'recadreur'];
/** Pages qui doivent vraiment défiler (200 px au moins), sinon le jeu d'essai est trop petit. */
const DEFILE_ATTENDU = new Set(['doublons-rafales', 'selection']);
/** Rien n'est supprimé, en court (É-C-8.4, choix 1). */
const RIEN_SUPPRIME = 'Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ».';

const photosReelles = readdirSync(PHOTOS).filter((f) => f.endsWith('.jpg') && !f.startsWith('Vacances'));

// ---------------------------------------------------------------------------
// Jeu d'essai fabriqué (dans le navigateur) : rafales, journée suivante, photos seules, copies
// ---------------------------------------------------------------------------
const deux = (n) => String(n).padStart(2, '0');
const __norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const nomPhoto = (jour, minutes, s) => `202608${deux(jour)}_${deux(Math.floor(minutes / 60))}${deux(minutes % 60)}${deux(s)}.jpg`;
const SPECS = [];
let scene = 1;
const RAFALES_J1 = [2, 3, 4, 5, 6, 3, 2, 4, 12];
RAFALES_J1.forEach((n, r) => {
  for (let k = 0; k < n; k++) SPECS.push({ nom: nomPhoto(1, 8 * 60 + r * 15, 10 + 2 * k), scene, variante: k, portrait: r % 3 === 1 });
  scene++;
});
[3, 2, 2].forEach((n, r) => {
  for (let k = 0; k < n; k++) SPECS.push({ nom: nomPhoto(2, 9 * 60 + r * 20, 10 + 2 * k), scene, variante: k, portrait: r === 1 });
  scene++;
});
for (let i = 0; i < 60; i++) SPECS.push({ nom: nomPhoto(3, 7 * 60 + i * 12, 0), scene: scene++, variante: 0, portrait: i % 4 === 3 });
const ORIGINAL = nomPhoto(3, 7 * 60, 0);
const DOSSIER_LONG = 'Juillet 2025 · vacances chez les cousins';
SPECS.push({ nom: ORIGINAL, dossier: DOSSIER_LONG, copieDe: ORIGINAL }, { nom: ORIGINAL, dossier: 'Album de Lea et Max', copieDe: ORIGINAL });

async function fabriquer(specs) {
  const racine = await navigator.storage.getDirectory();
  const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
  const dossier = async (chemin) => {
    let d = source;
    for (const p of chemin.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: true });
    return d;
  };
  const alea = (graine) => () => {
    graine |= 0;
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const faits = new Map();
  for (const s of specs) {
    let blob = s.copieDe ? faits.get(s.copieDe) : null;
    if (!blob) {
      const [l, h] = s.portrait ? [400, 600] : [600, 400];
      const c = new OffscreenCanvas(l, h);
      const g = c.getContext('2d');
      const r = alea(s.scene * 7919 + 13);
      const teinte = Math.floor(r() * 360);
      const fond = g.createLinearGradient(0, 0, l, h);
      fond.addColorStop(0, `hsl(${teinte} 45% 72%)`);
      fond.addColorStop(1, `hsl(${(teinte + 70) % 360} 50% 32%)`);
      g.fillStyle = fond;
      g.fillRect(0, 0, l, h);
      // Une rafale : la même scène, à peine décalée ; le « sujet » (rond blanc) bouge un peu.
      const dx = s.variante % 3;
      const dy = s.variante % 2;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `hsl(${Math.floor(r() * 360)} ${40 + r() * 50}% ${22 + r() * 55}%)`;
        const x = r() * l;
        const y = r() * h;
        const w = 30 + (r() * l) / 3;
        const hh = 30 + (r() * h) / 3;
        if (i % 2) g.fillRect(x + dx, y + dy, w, hh);
        else {
          g.beginPath();
          g.arc(x + dx, y + dy, Math.min(w, hh) / 2, 0, 7);
          g.fill();
        }
      }
      // Texture fine : une photo nette (variance du Laplacien élevée), jamais prise pour floue.
      g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      g.lineWidth = 1;
      for (let x = -h; x < l; x += 7) {
        g.beginPath();
        g.moveTo(x + dx, 0);
        g.lineTo(x + dx + h * 0.4, h);
        g.stroke();
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(l * 0.5 + s.variante * 4, h * 0.55, 18, 0, 7);
      g.fill();
      blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      faits.set(s.nom, blob);
    }
    const d = await dossier(s.dossier ?? '');
    const w = await (await d.getFileHandle(s.nom, { create: true })).createWritable();
    await w.write(blob);
    await w.close();
  }
  return faits.size;
}

// ---------------------------------------------------------------------------
// Bibliothèque de mesures, posée dans la page (window.__c)
// ---------------------------------------------------------------------------
function bibliotheque() {
  const C = {};
  const norm = (x) => (x ?? '').replace(/[\s  ]+/g, ' ').trim();
  C.norm = norm;
  C.nom = (e) => norm(e?.textContent).slice(0, 50) || (e && (e.getAttribute?.('aria-label') || String(e.className?.baseVal ?? e.className ?? e.tagName))) || '?';
  C.VUES = '.comparateur, .recadreur, .tri-rapide, .visionneuse, [role="dialog"]';
  C.vueDessus = () => [...document.querySelectorAll(C.VUES)].filter((v) => v.getBoundingClientRect().width > 0).at(-1) ?? null;
  C.horsVue = (e) => !e.closest(C.VUES);
  /** Rectangle visible (rognage par les ancêtres qui coupent, puis la fenêtre). */
  C.coupe = (e) => {
    const r = e.getBoundingClientRect();
    let v = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let a = e.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const q = a.getBoundingClientRect();
        v = { l: Math.max(v.l, q.left), t: Math.max(v.t, q.top), r: Math.min(v.r, q.right), b: Math.min(v.b, q.bottom) };
      }
    }
    v = { l: Math.max(v.l, 0), t: Math.max(v.t, 0), r: Math.min(v.r, innerWidth), b: Math.min(v.b, innerHeight) };
    return { r, v };
  };
  C.affiche = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  /** Entier à l'écran et non recouvert en son centre. */
  C.vu = (e) => {
    if (!C.affiche(e)) return false;
    const { r, v } = C.coupe(e);
    if (v.l > r.left + 1 || v.t > r.top + 1 || v.r < r.right - 1 || v.b < r.bottom - 1) return false;
    const d = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return !!d && (d === e || e.contains(d));
  };
  C.verts = () => {
    const sonde = (theme, jeton) => {
      const d = document.createElement('div');
      d.style.cssText = `color-scheme:${theme};background:var(${jeton});position:fixed;width:1px;height:1px`;
      document.body.appendChild(d);
      const c = getComputedStyle(d).backgroundColor;
      d.remove();
      return c;
    };
    return new Set([sonde('light', '--accent'), sonde('dark', '--accent'), sonde('light', '--accent-survol'), sonde('dark', '--accent-survol')]);
  };
  const DONNEES = '.jauge, .barre-mois, .ldt-barre, .avancement, .pastille.retenues, .bandeau, .barre-jour, .poignee-panneau, .budget';
  /** Boutons pleins (fond vert) de la vue du dessus, ou de la page. */
  C.pleins = () => {
    const verts = C.verts();
    const racine = C.vueDessus() ?? document;
    return [...racine.querySelectorAll('button:not(:disabled), .faux-bouton')]
      .filter((x) => verts.has(getComputedStyle(x).backgroundColor) && !x.closest(DONNEES) && C.affiche(x) && (racine !== document || C.horsVue(x)));
  };
  C.estPlein = (x) => !!x && C.verts().has(getComputedStyle(x).backgroundColor) && !x.disabled;
  /** Zones qui défilent en hauteur (hors vues), dans l'ordre du document. */
  C.zones = () =>
    [...document.querySelectorAll('body *')].filter((e) => {
      if (!C.horsVue(e)) return false;
      const s = getComputedStyle(e);
      return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 40 && C.affiche(e);
    });
  C.nomZone = (e) => (e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : '')).slice(0, 50);
  C.defiler = (i, part) => {
    const z = C.zones()[i];
    if (!z) return null;
    z.scrollTop = Math.round((z.scrollHeight - z.clientHeight) * part);
    return C.nomZone(z);
  };
  C.remonter = () => {
    for (const z of C.zones()) z.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  };
  C.aide = () => document.querySelector('[data-place="aide"]') ?? [...document.querySelectorAll('.bouton-aide')].find((b) => C.affiche(b) && C.horsVue(b)) ?? null;
  C.taille = () => [...document.querySelectorAll('[data-place="taille"]')].find((b) => C.affiche(b) && C.horsVue(b)) ?? null;
  C.titre = () => [...document.querySelectorAll('.ligne-etape h1, main h1')].find((h) => C.affiche(h)) ?? null;
  /** Forme E (D112) : le bas de ce qui est collé en haut (ligne de l'étape, tête de la table), le haut de la barre du bas. */
  C.bornes = () => {
    const ligne = document.querySelector('.ligne-etape')?.getBoundingClientRect();
    const tete = [...document.querySelectorAll('.tete-table')].find((x) => C.affiche(x) && C.horsVue(x))?.getBoundingClientRect();
    const barre = document.querySelector('.barre-validation')?.getBoundingClientRect();
    return { haut: Math.max(0, ligne ? ligne.bottom : 0, tete ? tete.bottom : 0), bas: Math.min(innerHeight, barre && barre.height ? barre.top : innerHeight) };
  };
  const boite = (e) => {
    if (!C.affiche(e)) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), d: Math.round(r.right), b: Math.round(r.bottom), h: Math.round(r.height) };
  };
  /** Ce qui ne doit jamais défiler avec le contenu. */
  C.fixes = () => {
    const r = {};
    const el = {
      titre: C.titre(),
      annuler: [...document.querySelectorAll('.bouton-annuler')].find((x) => C.horsVue(x) && C.affiche(x)),
      aide: C.aide(),
      taille: C.taille(),
      barre: document.querySelector('.barre-validation'),
      valider: document.querySelector('[data-action=valider]'),
    };
    for (const [k, e] of Object.entries(el)) {
      const b = e && boite(e);
      if (b) r[k] = b;
    }
    return r;
  };
  /** C-9.1 : rien de posé sur une photo visible (repris d'essai_charte.mjs). */
  C.marques = () => {
    const CADRES = '.cadre-miniature, .cadre-tuile, .volet-image, .cadre-vignette, .tri-image, .image-visionneuse';
    const out = [];
    for (const img of document.querySelectorAll(`:is(${CADRES}) :is(img, canvas)`)) {
      const ri = img.getBoundingClientRect();
      if (ri.width < 40 || ri.height < 40 || ri.bottom < 0 || ri.top > innerHeight) continue;
      const cadre = img.closest(CADRES);
      const rc = cadre.matches('.tri-image, .image-visionneuse') ? ri : cadre.getBoundingClientRect();
      const porteur = cadre.closest('.tuile, .photo-doublon, .volet, .vignette-comparer, .tri-rapide, .visionneuse, .exemplaire, .carte-doublons') ?? cadre.parentElement;
      for (const e of porteur.querySelectorAll('*')) {
        if (e === img || e === cadre || e.contains(cadre) || img.contains(e)) continue;
        if (!/^(absolute|fixed)$/.test(getComputedStyle(e).position)) continue;
        if (!(norm(e.textContent) || e.querySelector('svg') || e.tagName.toLowerCase() === 'svg')) continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
        if (r.left >= rc.left - 2 && r.right <= rc.right + 2 && r.top >= rc.top - 2 && r.bottom <= rc.bottom + 2) out.push(`.${[...e.classList].join('.')} « ${C.nom(e)} »`);
      }
      for (const avant of ['::before', '::after']) {
        const c = getComputedStyle(cadre, avant).content;
        if (c && !['none', 'normal', '""', "''"].includes(c)) out.push(`${avant} « ${c} »`);
      }
    }
    return [...new Set(out)];
  };
  /** Le cadre jaune et noir du clavier, allumé quelque part ? */
  C.cadreJaune = () =>
    [...document.querySelectorAll('body *')]
      .filter((e) => C.affiche(e) && (/255, 214, 10/.test(getComputedStyle(e).boxShadow) || (getComputedStyle(e).outlineStyle !== 'none' && /255, 214, 10/.test(getComputedStyle(e).outlineColor))))
      .map((e) => C.nom(e).slice(0, 30));
  /** État du cadre de la page. */
  C.etat = () => {
    const vue = C.vueDessus();
    const val = document.querySelector('[data-action=valider]');
    const barre = document.querySelector('.barre-validation');
    const pleins = C.pleins();
    const racineCadre = document.querySelector('[data-cadre]');
    return {
      cadre: racineCadre?.dataset.cadre ?? '',
      vue: vue ? C.nom(vue).slice(0, 20) : '',
      pageDefile: Math.max(0, document.scrollingElement.scrollHeight - innerHeight),
      pageLargeur: document.scrollingElement.scrollWidth > innerWidth + 1,
      barreH: barre && C.affiche(barre) ? Math.round(barre.getBoundingClientRect().height) : null,
      valider: val && C.affiche(val) ? { x: Math.round(val.getBoundingClientRect().left), y: Math.round(val.getBoundingClientRect().top), vu: C.vu(val) } : null,
      fixes: C.fixes(),
      pleins: pleins.map((p) => ({ texte: C.nom(p), vu: C.vu(p) })),
      zones: C.zones().map((z) => ({ nom: C.nomZone(z), defile: z.scrollHeight - z.clientHeight, photos: !!z.querySelector('img, canvas') })),
      marques: C.marques(),
    };
  };
  /**
   * Places fixes (forme E, D112) : dans la ligne de l'étape, Aide juste avant Menu ; ↶ à 284 px du bord droit (x 996
   * à 1280, 1156 à 1440), ↷ juste après ; Taille juste à gauche de ↶ ; le titre à 24 px du bord. Le bord droit est
   * celui de la page, où finit la ligne de l'étape : la place de la barre de défilement est gardée sur toute étape
   * (`scrollbar-gutter: stable`, 15 px dans Chromium, même masquée ; `clientWidth` ne la compte pas), pour que ↶ ne
   * bouge pas entre une page qui défile et une qui ne défile pas.
   */
  C.places = (photos) => {
    const W = document.querySelector('.ligne-etape')?.getBoundingClientRect().right ?? innerWidth;
    const f = [];
    if (Math.abs(W - (document.querySelector('.app')?.getBoundingClientRect().right ?? W)) > 1) f.push(`la ligne de l’étape finit à x = ${Math.round(W)}, avant le bord de la page`);
    const aide = C.aide();
    const menus = [...document.querySelectorAll('.bouton-menu')].filter((x) => C.affiche(x));
    const menu = menus[0];
    if (menus.length !== 1) f.push(`${menus.length} boutons « Menu » à l’écran (1 attendu, dans la ligne de l’étape)`);
    if (!aide) f.push('pas de bouton « Aide » sur la page');
    else if (menu) {
      const a = aide.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      if (!aide.closest('.ligne-etape') || !menu.closest('.ligne-etape') || a.right > m.left + 1 || m.left - a.right > 24 || Math.abs((a.top + a.bottom) / 2 - (m.top + m.bottom) / 2) > 4)
        f.push(`« Aide » n’est pas juste avant « Menu » dans la ligne de l’étape (x = ${Math.round(a.left)}, y = ${Math.round(a.top)})`);
    }
    const ann = [...document.querySelectorAll('.bouton-annuler')].find((x) => C.horsVue(x) && C.affiche(x));
    const ret = [...document.querySelectorAll('.bouton-retablir')].find((x) => C.horsVue(x) && C.affiche(x));
    if (!ann) f.push('pas de bouton « Annuler » sur la page');
    else if (!C.vu(ann)) f.push('« Annuler » caché ou recouvert');
    else if (!ann.closest('.ligne-etape')) f.push('« Annuler » n’est pas dans la ligne de l’étape');
    else if (Math.abs(W - ann.getBoundingClientRect().left - 284) > 2) f.push(`« Annuler » à x = ${Math.round(ann.getBoundingClientRect().left)} (${W - 284} attendu : 284 px du bord droit)`);
    if (ann && ret && (ann.getBoundingClientRect().right > ret.getBoundingClientRect().left + 1 || ret.getBoundingClientRect().left - ann.getBoundingClientRect().right > 8)) f.push('« Annuler » n’est pas juste avant « Rétablir »');
    // ↶ ↷ en icônes seules (D112) : le geste dans le nom lu et l'infobulle, rien d'écrit à l'écran.
    for (const b of [ann, ret]) {
      if (!b) continue;
      const ecrit = [...b.childNodes].some((n) => (n.nodeType === 3 && norm(n.textContent)) || (n.nodeType === 1 && !n.matches('svg, .texte-masque') && norm(n.textContent)));
      if (ecrit) f.push(`« ${norm(b.textContent).slice(0, 30)} » : du texte écrit à l’écran (icône seule attendue)`);
      if (!norm(b.textContent) || !b.title) f.push(`« ${b.className} » sans nom lu ou sans infobulle`);
    }
    // Échelle sobre (retours du 29.10) : Annuler et Rétablir à 32 px de haut.
    for (const b of [ann, ret]) if (b && Math.abs(b.getBoundingClientRect().height - 32) > 1) f.push(`« ${norm(b.textContent).slice(0, 30)} » à ${Math.round(b.getBoundingClientRect().height)} px de haut (32 attendus)`);
    if (photos) {
      // La Taille dans l'en-tête de l'étape, juste à gauche d'« Annuler » et à sa hauteur (retours du 29.10, question 11).
      const t = C.taille();
      if (!t) f.push('pas de réglage « Taille »');
      else {
        const r = t.getBoundingClientRect();
        const a = ann?.getBoundingClientRect();
        if (!t.closest('.ligne-etape')) f.push('« Taille » n’est pas dans la ligne de l’étape');
        else if (a && (r.right > a.left + 1 || a.left - r.right > 24 || Math.abs((r.top + r.bottom) / 2 - (a.top + a.bottom) / 2) > 4))
          f.push(`« Taille » n’est pas juste à gauche d’« Annuler » (à ${Math.round(a.left - r.right)} px, décalée de ${Math.round((r.top + r.bottom) / 2 - (a.top + a.bottom) / 2)} px)`);
        if (/\bTaille\b/.test(norm(t.textContent))) f.push('le mot « Taille » est écrit à côté du curseur (retiré, question 11)');
      }
    }
    const h = C.titre();
    if (!h) f.push('pas de titre d’étape (h1) à l’écran');
    else if (Math.abs(h.getBoundingClientRect().left - 24) > 2) f.push(`titre de l’étape à x = ${Math.round(h.getBoundingClientRect().left)} (24 attendu)`);
    return f;
  };
  /**
   * Forme E (D112), sur toute étape : la ligne de l'étape, ↶ à 284 px du bord droit, Aide et un seul Menu dans la
   * ligne, aucune photo qui défile dans une boîte de la page (les colonnes collées défilent de leur côté) ; en bas
   * de la page, la ligne collée en haut et la barre du projet partie. La page est remise en haut.
   */
  C.formeE = () => {
    const f = [];
    const ligne = document.querySelector('.ligne-etape');
    if (!ligne || !C.affiche(ligne)) return ['pas de ligne d’étape'];
    const x = () => Math.round(ligne.querySelector('.bouton-annuler')?.getBoundingClientRect().left ?? -1);
    const x0 = x();
    const W = ligne.getBoundingClientRect().right;
    if (Math.abs(W - (document.querySelector('.app')?.getBoundingClientRect().right ?? W)) > 1) f.push(`la ligne de l’étape finit à x = ${Math.round(W)}, avant le bord de la page`);
    if (Math.abs(W - x0 - 284) > 2) f.push(`↶ à x = ${x0} (${W - 284} attendu : 284 px du bord droit de la page)`);
    const menus = [...document.querySelectorAll('.bouton-menu')].filter((m) => C.affiche(m));
    if (menus.length !== 1 || !menus[0].closest('.ligne-etape')) f.push(`${menus.length} « Menu » à l’écran, ${menus.filter((m) => m.closest('.ligne-etape')).length} dans la ligne de l’étape (1 attendu)`);
    const aide = ligne.querySelector('[data-place=aide]');
    if (!aide) f.push('pas d’« Aide » dans la ligne de l’étape');
    const boites = C.zones().filter((z) => z.querySelector('img, canvas') && !/colonne-liste|panneau|aide|arbre|sections|liste-petits|resultat-tri|ligne-de-temps/.test(C.nomZone(z)));
    if (boites.length) f.push(`des photos défilent dans une boîte de la page : ${boites.map((z) => C.nomZone(z)).join(', ')}`);
    const d = document.scrollingElement;
    const projet = document.querySelector('header.entete')?.getBoundingClientRect().height ?? 0;
    d.scrollTop = d.scrollHeight;
    if (scrollY >= projet + 1) {
      if (Math.round(ligne.getBoundingClientRect().top) !== 0) f.push(`en bas de la page, la ligne de l’étape n’est pas collée en haut (y ${Math.round(ligne.getBoundingClientRect().top)})`);
      if ((document.querySelector('header.entete')?.getBoundingClientRect().bottom ?? 0) > 0) f.push('en bas de la page, la barre du projet ne part pas');
      if (x() !== x0) f.push(`en bas de la page, ↶ bouge (x ${x0} → ${x()})`);
    }
    d.scrollTop = 0;
    return f;
  };
  /** Au palier, la liste de gauche devient un menu (un seul exemplaire dans la page). */
  C.liste = (selecteur) => {
    const tous = [...document.querySelectorAll(selecteur)];
    const colonne = tous.filter((x) => C.affiche(x) && x.getBoundingClientRect().width > 150 && !/^(absolute|fixed)$/.test(getComputedStyle(x).position));
    const menu = [...document.querySelectorAll('[data-action="menu-liste"]')].filter((x) => C.vu(x));
    return { exemplaires: tous.length, colonne: colonne.length, menu: menu.length };
  };
  /** Sonde : le texte de la ligne 1 de la barre du bas avec des nombres à 4 chiffres (puis remis). */
  C.sondeBarre = (anglais) => {
    const l1 = document.querySelector('.barre-validation .l1');
    if (!l1) return null;
    const barre = document.querySelector('.barre-validation');
    const val = document.querySelector('[data-action=valider]');
    const avant = { h: barre.getBoundingClientRect().height, v: val?.getBoundingClientRect().top };
    const noeuds = [];
    const m = document.createTreeWalker(l1, NodeFilter.SHOW_TEXT);
    for (let n = m.nextNode(); n; n = m.nextNode()) noeuds.push([n, n.data]);
    let k = 0;
    for (const [n] of noeuds) n.data = n.data.replace(/\d+(?:[\s  ',]\d{3})*/g, () => (anglais ? ['1,234', '5,678', '9,012'] : ['1 234', '5 678', '9 012'])[k++ % 3]);
    const texte = norm(l1.textContent);
    const apres = { h: barre.getBoundingClientRect().height, v: val?.getBoundingClientRect().top };
    const deborde = [...barre.querySelectorAll('.resume, .l1, .l2, .texte-l1')].some((x) => x.scrollWidth > x.clientWidth + 1 || (getComputedStyle(x).textOverflow === 'ellipsis' && x.scrollWidth > x.clientWidth));
    for (const [n, d] of noeuds) n.data = d;
    return { texte: texte.slice(0, 90), hAvant: Math.round(avant.h), hApres: Math.round(apres.h), bouge: val ? Math.abs(apres.v - avant.v) > 0.5 : false, deborde };
  };

  // ---- Doublons ----
  C.cartes = () => [...document.querySelectorAll('.carte-doublons')].filter((c) => C.horsVue(c));
  C.articles = () => [...document.querySelectorAll('article.carte-doublons')].filter((c) => C.horsVue(c) && C.affiche(c));
  C.articlePlein = () => {
    const b = [...document.querySelectorAll('article.carte-doublons [data-action=accepter]')].find((x) => C.horsVue(x) && C.estPlein(x));
    return b ? b.closest('article.carte-doublons') : null;
  };
  C.clePlein = () => C.articlePlein()?.dataset.cle ?? null;
  C.nAccepter = () => [...document.querySelectorAll('article.carte-doublons [data-action=accepter]')].filter((x) => C.horsVue(x)).length;
  C.zoneDe = (e) => {
    for (let a = e?.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll)/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 1) return a;
    }
    return document.scrollingElement;
  };
  /** Bas des en-têtes collés en haut de la zone des groupes. */
  C.basColles = (z) => {
    const zr = z === document.scrollingElement ? { top: C.bornes().haut, bottom: C.bornes().bas } : z.getBoundingClientRect();
    let hb = Math.max(zr.top, 0);
    for (const h of document.querySelectorAll('article.carte-doublons > header')) {
      const q = h.getBoundingClientRect();
      if (q.height && q.top <= Math.max(zr.top, 0) + 1 && q.bottom > hb && q.bottom < zr.bottom) hb = q.bottom;
    }
    return { hb, bas: Math.min(zr.bottom, innerHeight, document.querySelector('.barre-validation')?.getBoundingClientRect().top ?? innerHeight) };
  };
  const bandesDe = (a) => [...a.querySelectorAll('.bande-etat')].filter((b) => !b.closest('[data-action=accepter]'));
  // É14 : la bande de chaque photo est son badge ; « garder » = elle reste (proposé ou décidé).
  const gardees = (a) => bandesDe(a).filter((b) => b.dataset.sort === 'garder');
  /** La ligne d'un exemplaire : le plus grand ancêtre de la bande qui ne contient qu'elle comme bande. */
  const ligneDe = (b, a) => {
    let l = b;
    for (let x = b.parentElement; x && x !== a; x = x.parentElement) {
      if (bandesDe(x).length > 1) break;
      l = x;
    }
    return l;
  };
  /**
   * « Accepter → » d'un groupe (É14 a) : le bouton ne dit que « Accepter » ; ce qu'il fera est écrit juste à sa gauche,
   * en gris (« garde la 2 · écarte 1 », « garde 3 photos · écarte 9 », aux Copies « garde 1 exemplaire · écarte 2 »),
   * la place de la photo gardée étant aussi au début de sa bande, après l'icône. Rend '' si tout est juste.
   */
  C.libelleJuste = (a, sorte) => {
    const b = a.querySelector('[data-action=accepter]');
    if (!b) return '';
    const t = norm(b.textContent);
    if (t !== 'Accepter') return `« ${t} » : le bouton ne dit que « Accepter → »`;
    const gris = norm(a.querySelector(':scope > header .dit-accepter')?.textContent);
    const bandes = bandesDe(a);
    const k = gardees(a);
    const n = bandes.length;
    if (!gris) return 'pas de ligne grise à gauche d’« Accepter → »';
    if (sorte === 'copies') {
      if (k.length === 1 && !new RegExp(`^garde 1 exemplaire · écarte ${n - 1}\\b`).test(gris)) return `« ${gris} » ne dit pas « garde 1 exemplaire · écarte ${n - 1} »`;
      return '';
    }
    if (k.length === 1) {
      const i = bandes.indexOf(k[0]) + 1;
      const place = norm(k[0].querySelector('.etat-badge')?.textContent ?? k[0].textContent).match(/^(\d+)\s*·/)?.[1];
      if (!new RegExp(`^garde la ${i} · écarte ${n - 1}\\b`).test(gris)) return `« ${gris} » ne dit pas « garde la ${i} · écarte ${n - 1} »`;
      if (place !== String(i)) return `la photo à garder ne porte pas sa place « ${i} · » dans sa bande`;
      return '';
    }
    if (k.length > 1 && !new RegExp(`^garde ${k.length} photos · écarte ${n - k.length}\\b`).test(gris) && !new RegExp(`^garde les ${n}\\b`).test(gris)) return `« ${gris} » ne dit pas « garde ${k.length} photos · écarte ${n - k.length} »`;
    if (!k.length && !/^n’en garde aucune · écarte les \d+/.test(gris)) return `« ${gris} » ne dit pas « n’en garde aucune · écarte les ${n} »`;
    return '';
  };
  /** Ce que fera le plein se lit sans qu'on lise sa langue : la ligne grise d'à côté, entière à l'écran (É14 a). */
  C.nommeSansLangue = (a) => {
    const g = a.querySelector(':scope > header .dit-accepter');
    return !!g && !!norm(g.textContent) && C.vu(g) && g.scrollHeight <= g.clientHeight + 2;
  };
  /** « Accepter → » a la même largeur sur tous les groupes (É14 a, C-4.2) : les largeurs différentes, sinon rien. */
  C.largeursAccepter = () => [...new Set([...document.querySelectorAll('article.carte-doublons > header [data-action=accepter]')].filter((x) => C.affiche(x)).map((x) => Math.round(x.getBoundingClientRect().width)))];
  /** À cet instant, ce que le plein garde se voit (bande « À garder » entière, non recouverte) ou se lit. */
  C.gardee = (sorte) => {
    const a = C.articlePlein();
    if (!a) return null;
    // Se lit : le libellé juste (en français), ou, quelle que soit la langue, la vignette de la photo gardée
    // dans le plein (une rafale) ou le nom du dossier de l'exemplaire gardé (Copies).
    const nomme = C.libelleJuste(a, sorte) === '' || C.nommeSansLangue(a);
    const { hb, bas } = C.basColles(C.zoneDe(a));
    const bande = gardees(a).some((x) => {
      const q = x.getBoundingClientRect();
      if (q.height < 4 || q.top < hb - 1 || q.bottom > bas + 1) return false;
      const e = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2);
      return !!e && (e === x || x.contains(e));
    });
    // L'en-tête du groupe du plein entier dans ce qu'on voit (à l'arrivée sur ce groupe, sa bande doit suivre).
    const tete = a.querySelector(':scope > header')?.getBoundingClientRect();
    const zr = C.zoneDe(a) === document.scrollingElement ? { top: C.bornes().haut, bottom: C.bornes().bas } : C.zoneDe(a).getBoundingClientRect();
    // … et le premier groupe qui commence dans ce qu'on voit (sinon ce n'est pas l'arrivée sur ce groupe).
    const premier = C.articles().find((x) => x.getBoundingClientRect().top >= zr.top - 1) === a;
    const entete = premier && !!tete && tete.top >= zr.top - 1 && tete.bottom <= Math.min(zr.bottom, bas) + 1;
    return { nomme, bande, entete, cle: a.dataset.cle };
  };
  /** Tout en-tête de groupe sur une ligne, sans débord, le plein au bout à droite. */
  C.entetes = () => {
    const limite = innerWidth <= 1180 ? 48 : innerHeight < 700 ? 52 : 56;
    const out = [];
    for (const a of C.articles()) {
      const t = a.querySelector(':scope > header');
      if (!t || !C.affiche(t)) continue;
      const q = t.getBoundingClientRect();
      if (q.bottom < 0 || q.top > innerHeight) continue;
      const pb = [];
      const enfants = [...t.children].filter((c) => C.affiche(c) && !c.classList.contains('espace'));
      const centres = enfants.map((c) => (c.getBoundingClientRect().top + c.getBoundingClientRect().bottom) / 2);
      if (q.height > limite + 0.5) pb.push(`${Math.round(q.height)} px (${limite} au plus)`);
      if (centres.length && Math.max(...centres) - Math.min(...centres) > 6) pb.push('deux lignes');
      if (t.scrollWidth > t.clientWidth + 1) pb.push(`déborde de ${t.scrollWidth - t.clientWidth} px`);
      const acc = a.querySelector('[data-action=accepter]');
      if (acc && !t.contains(acc)) pb.push('« Accepter » n’est pas dans l’en-tête');
      if (acc && t.contains(acc)) {
        const ra = acc.getBoundingClientRect();
        if (enfants.some((c) => !c.contains(acc) && c.getBoundingClientRect().right > ra.right + 1)) pb.push('« Accepter » pas au bout à droite');
        if (ra.right > q.right - parseFloat(getComputedStyle(t).paddingRight) + 1) pb.push('« Accepter » coupé');
      }
      if (pb.length) out.push(`${a.getAttribute('aria-label')?.slice(0, 32) ?? a.dataset.cle} : ${pb.join(', ')}`);
    }
    return out;
  };
  /** Chaque photo d'une rafale porte sa place au début de sa bande (« 4 · À garder »), dans l'ordre. */
  C.placesBandes = () => {
    const out = [];
    for (const a of C.articles()) {
      bandesDe(a).forEach((b, i) => {
        const m = norm(b.querySelector('.etat-badge')?.textContent ?? b.textContent).match(/^(\d+)\s*·/);
        if (!m || m[1] !== String(i + 1)) out.push(`${a.getAttribute('aria-label')?.slice(0, 28) ?? '?'} photo ${i + 1} (« ${norm(b.textContent).slice(0, 20)} »)`);
      });
    }
    return out;
  };
  /** Le libellé de chaque « Accepter » dit ce qu'il garde. */
  C.libelles = (sorte) =>
    C.articles()
      .map((a) => C.libelleJuste(a, sorte))
      .filter(Boolean);
  /** Un nombre nu après « garder » ou « écarter » se lirait comme une place. */
  C.nombresNus = () =>
    [...document.querySelectorAll('[data-action=accepter]')]
      .filter((b) => C.affiche(b))
      .map((b) => norm(b.textContent))
      .filter((t) => /(?:^|\s)(garder|écarter) \d+(?!\d)(?! (photos?|autres?)(?![\p{L}\d]))/u.test(t));
  /** Virgule à 3 px au moins de la vignette du plein (son liseré la cacherait). */
  C.virgules = () =>
    [...document.querySelectorAll('[data-action=accepter] img')]
      .filter((m) => C.affiche(m))
      .flatMap((m) => {
        const r = document.createRange();
        let n = m.nextSibling;
        while (n && n.nodeType !== 3 && !(n.textContent || '').trim()) n = n.nextSibling;
        const texte = n?.nodeType === 3 ? n : n?.firstChild?.nodeType === 3 ? n.firstChild : null;
        if (!texte || !texte.data.trimStart().startsWith(',')) return ['pas de virgule après la vignette'];
        const i = texte.data.indexOf(',');
        r.setStart(texte, i);
        r.setEnd(texte, i + 1);
        const d = r.getBoundingClientRect().left - m.getBoundingClientRect().right;
        return d < 2.5 ? [`virgule à ${d.toFixed(1)} px de la vignette`] : [];
      });
  /** Copies exactes : la photo une seule fois, une ligne (une bande) par exemplaire. */
  C.copiesUneFois = () => {
    const out = [];
    for (const a of C.articles()) {
      const imgs = [...a.querySelectorAll('img, canvas')].filter((i) => !i.closest('[data-action=accepter]') && i.getBoundingClientRect().width >= 40);
      const bandes = bandesDe(a).length;
      if (imgs.length !== 1 || bandes < 2) out.push(`${a.getAttribute('aria-label')?.slice(0, 32) ?? '?'} : ${imgs.length} photos montrées pour ${bandes} exemplaires`);
    }
    return out;
  };
  /** Accroche du défilement au début des groupes : retirée avec la forme E (une seule barre, celle de la page). */
  C.accroche = () => {
    const a = C.articles()[0];
    if (!a) return null;
    const z = C.zoneDe(a);
    const s = getComputedStyle(z === document.scrollingElement ? document.documentElement : z).scrollSnapType;
    return s;
  };
  /** Le lien « Journée suivante à accepter », entier et non recouvert, sur la ligne du dernier groupe. */
  C.suite = () => {
    const l = [...document.querySelectorAll('[data-action="journee-suivante"], button, a')].find((x) => C.horsVue(x) && C.affiche(x) && (x.matches('[data-action="journee-suivante"]') || /Journée suivante à accepter/.test(norm(x.textContent))));
    if (!l) return { existe: false };
    const dernier = C.cartes().at(-1);
    return { existe: true, vu: C.vu(l), dansDernier: !!dernier && dernier.contains(l), texte: norm(l.textContent).slice(0, 50) };
  };
  /** Un point cliquable (sans commande) dans un autre groupe que celui du plein, à l'écran. */
  C.pointAutreGroupe = () => {
    const p = C.articlePlein();
    for (const a of C.articles()) {
      if (a === p) continue;
      const { hb, bas } = C.basColles(C.zoneDe(a));
      for (const cible of [a.querySelector(':scope > header .titre'), a.querySelector(':scope > header'), ...a.querySelectorAll('.legende-doublon')]) {
        if (!cible || !C.affiche(cible)) continue;
        const q = cible.getBoundingClientRect();
        const x = q.left + Math.min(20, q.width / 2);
        const y = (q.top + q.bottom) / 2;
        if (y < hb + 4 || y > bas - 4 || x < 0 || x > innerWidth) continue;
        const e = document.elementFromPoint(x, y);
        if (e && a.contains(e) && !e.closest('button, a, input, select, label')) return { x, y, cle: a.dataset.cle, zone: C.zoneDe(a).scrollTop, plein: p?.dataset.cle ?? null };
      }
    }
    return null;
  };
  /** Un plein rogné (C-10.5) : son texte déborde de sa boîte, ou sort de ce qu'on voit (page et vues). */
  C.pleinsRognes = () =>
    [...document.querySelectorAll('[data-action=accepter], [data-action=journee-suivante], [data-action=onglet-suivant], .accepter-recadrage')]
      .filter((b) => C.affiche(b) && C.estPlein(b))
      .filter((b) => {
        if (b.scrollWidth > b.clientWidth + 1) return true;
        const q = b.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(b);
        const t = r.getBoundingClientRect();
        return t.left < q.left - 1 || t.right > q.right + 1;
      })
      .map((b) => `« ${C.nom(b)} » (${b.scrollWidth} px pour ${b.clientWidth})`);
  /**
   * Rien ne se voit au-dessus d'un en-tête de groupe collé : il colle au bord haut de la zone qui défile, ou, la
   * page défilant en entier (forme E), juste sous la ligne de l'étape et la tête de la table.
   */
  C.colles = () => {
    const out = [];
    for (const a of C.articles()) {
      const h = a.querySelector(':scope > header');
      const z = C.zoneDe(a);
      if (!h) continue;
      const zq = z === document.scrollingElement ? { top: C.bornes().haut } : z.getBoundingClientRect();
      const q = h.getBoundingClientRect();
      // Collé : le groupe a commencé au-dessus de la zone.
      if (a.getBoundingClientRect().top >= zq.top - 1 || q.bottom <= zq.top) continue;
      if (Math.abs(q.top - zq.top) > 1 && q.top > zq.top) {
        const d = document.elementFromPoint(q.left + 40, (zq.top + q.top) / 2);
        out.push(`en-tête collé à ${Math.round(q.top - zq.top)} px sous le haut de la zone${d && d.closest('.photo-doublon, .tuile-doublon, img') ? ' (une photo se voit au-dessus)' : ''}`);
      }
    }
    return [...new Set(out)];
  };
  C.estAccepte = (cle) => {
    const c = document.querySelector(`.carte-doublons[data-cle="${CSS.escape(cle)}"]`);
    return !c || c.classList.contains('repliee') || !c.querySelector('[data-action=accepter]');
  };
  window.__c = C;
}

// ---------------------------------------------------------------------------
// Build figé, serveur, navigateur
// ---------------------------------------------------------------------------
const BUILD = mkdtempSync(join(tmpdir(), 'album-cadre-'));
// BUILD_FIGE=chemin/album-photos.html : essayer un build déjà fait (celui d'un tour précédent, pour voir un essai
// nouveau échouer sur l'ancien code) au lieu de construire `app/src`.
const FIGE = process.env.BUILD_FIGE;
if (!FIGE)
  await new Promise((ok, echec) => {
    const vite = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'warn'], { cwd: APP, stdio: ['ignore', 'inherit', 'inherit'] });
    vite.on('error', echec);
    vite.on('exit', (code) => (code === 0 ? ok() : echec(new Error(`vite build a échoué (code ${code})`))));
  });
const html = readFileSync(FIGE ?? join(BUILD, 'album-photos.html'), 'utf8');
rmSync(BUILD, { recursive: true, force: true });
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

const navigateur = await chromium.launch({ env });
const erreurs = [];
/** Écarts : { page, texte }. La page sert au bilan (pilote, essais du lot 3, autres pages). */
const fautes = [];
const signalements = [];
const valides = new Map(); // « 1440×900 » → [{ page, x, y }]
const pagesFaites = [];
const enAttente = new Set(); // pages « pas encore passées au cadre »
const t0 = performance.now();
const temps = () => `${((performance.now() - t0) / 1000).toFixed(0)} s`;
const faute = (page, texte) => {
  fautes.push({ page, texte });
  console.log(`  ✗ ${texte}`);
};

try {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  await contexte.route('https://nominatim.openstreetmap.org/**', async (route) => {
    const lat = Number(new URL(route.request().url()).searchParams.get('lat'));
    const nom = lat > 40 ? 'Annecy' : lat > 13 ? 'Lyon' : 'Paris';
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { town: nom, country: 'Pays' }, display_name: nom }) });
  });
  await contexte.route('https://api.anthropic.com/**', (route) => route.abort());
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.addInitScript(() => {
    window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(`selecteur_${o?.id ?? 'x'}`, { create: true });
  });
  await page.addInitScript(bibliotheque);
  await page.goto(ADRESSE);
  const attendre = (ms) => page.waitForTimeout(ms);
  const theme = (t) => page.evaluate((x) => (document.documentElement.dataset.theme = x), t);
  const taille = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await attendre(350);
  };
  const capture = async (nom) => {
    if (CAPTURES) await page.screenshot({ path: join(CAPTURES, `${nom}.png`) });
  };
  const noterValider = (nomPage, w, h, v) => {
    if (!v) return;
    const cle = `${w}×${h}`;
    if (!valides.has(cle)) valides.set(cle, []);
    valides.get(cle).push({ page: nomPage, x: v.x, y: v.y });
  };

  /**
   * Contrôles du cadre d'une page d'étape, à une taille et dans un thème. `sorte` : onglet de Doublons
   * ('rafales', 'copies') ; `photos` : la page montre des photos (Taille, liste de gauche) ; `ecarte` : on y
   * écarte (« Rien n'est supprimé ») ; `anglais` : l'interface est en anglais (les libellés ne sont pas lus).
   */
  const controlerCadre = async (nomPage, ici, w, h, { sorte = null, photos = false, ecarte = false, anglais = false, liste = null, thm = 'light', vue = true } = {}) => {
    await page.evaluate(() => __c.remonter());
    await attendre(250);
    const e = await page.evaluate(() => __c.etat());
    noterValider(nomPage, w, h, e.valider);
    // Le jeu d'essai : une colonne défile vraiment.
    // Forme E (D112) : une seule barre de défilement, celle de la page ; aucune zone de photos ne défile dans une autre.
    const dansUneBoite = e.zones.filter((z) => z.photos && !/colonne-liste|panneau|aide|arbre|sections/.test(z.nom));
    if (dansUneBoite.length) faute(nomPage, `${ici} : des photos défilent dans une boîte de la page (une seule barre de défilement attendue) : ${dansUneBoite.map((z) => `${z.nom} ${z.defile}`).join(', ')}`);
    if (DEFILE_ATTENDU.has(nomPage) && e.pageDefile < 200) faute(nomPage, `${ici} : la page ne défile que de ${e.pageDefile} px (200 au moins : jeu d’essai trop petit)`);
    if (e.pageLargeur) faute(nomPage, `${ici} : la page défile en largeur (C-7.1)`);
    const hBarre = w >= 1440 && h >= 700 ? 64 : 56;
    if (e.barreH !== null && Math.abs(e.barreH - hBarre) > 1) faute(nomPage, `${ici} : barre du bas de ${e.barreH} px (${hBarre} attendus)`);
    if (!e.valider) faute(nomPage, `${ici} : pas de « Valider et continuer »`);
    else if (!e.valider.vu) faute(nomPage, `${ici} : « Valider et continuer » caché ou recouvert`);
    const places = await page.evaluate((p) => __c.places(p), photos);
    for (const p of places) faute(nomPage, `${ici} : ${p}`);
    for (const x of await page.evaluate(() => __c.formeE())) faute(nomPage, `${ici} : ${x}`);
    await attendre(150);
    if (ecarte && !anglais) {
      const r = await page.evaluate(() => __c.norm(document.querySelector('.barre-validation .rien-supprime')?.textContent));
      if (r !== RIEN_SUPPRIME) faute(nomPage, `${ici} : « Rien n’est supprimé » n’est pas la phrase courte (${r.length} signes : « ${r.slice(0, 50)}… »)`);
    }
    if (liste) {
      const l = await page.evaluate((s) => __c.liste(s), liste);
      if (l.exemplaires > 1) faute(nomPage, `${ici} : la liste de gauche existe en ${l.exemplaires} exemplaires`);
      if (w <= 1180 && (l.colonne || !l.menu)) faute(nomPage, `${ici} : au palier, la liste de gauche ${l.colonne ? 'reste une colonne' : ''}${l.colonne && !l.menu ? ' et ' : ''}${l.menu ? '' : 'n’a pas de menu [data-action=menu-liste]'}`);
      if (w > 1180 && !l.colonne) faute(nomPage, `${ici} : la liste de gauche n’est pas affichée en colonne`);
    }
    if (thm === 'light') {
      const s = await page.evaluate((a) => __c.sondeBarre(a), anglais);
      if (s && (s.hApres !== s.hAvant || Math.abs(s.hApres - hBarre) > 1 || s.bouge || s.deborde))
        faute(nomPage, `${ici} : barre du bas avec des nombres à 4 chiffres : ${s.hApres} px${s.bouge ? ', « Valider » bouge' : ''}${s.deborde ? ', texte qui déborde' : ''} (« ${s.texte} »)`);
    }
    // Le plein, à l'arrivée : entier, et son texte n'est pas rogné (C-10.5).
    const rognes = await page.evaluate(() => __c.pleinsRognes());
    if (rognes.length) faute(nomPage, `${ici} : texte du plein rogné : ${rognes.slice(0, 2).join(' | ')}`);
    const vus = e.pleins.filter((p) => p.vu);
    if (vus.length !== 1) faute(nomPage, `${ici} : ${vus.length} bouton(s) plein(s) entier(s) à l’arrivée, 1 attendu (${e.pleins.map((p) => `« ${p.texte} »${p.vu ? '' : ' caché'}`).join(' ; ') || 'aucun'})`);
    if (e.marques.length) faute(nomPage, `${ici} : posé sur une photo (C-9.1) : ${e.marques.slice(0, 3).join(' ; ')}`);
    // Doublons, à l'arrivée.
    const groupes = async (ou) => {
      if (!sorte) return;
      const en = await page.evaluate(() => __c.entetes());
      if (en.length) faute(nomPage, `${ici}${ou} : en-tête de groupe pas sur une ligne : ${en.slice(0, 3).join(' | ')}${en.length > 3 ? ` (+${en.length - 3})` : ''}`);
      const g = await page.evaluate((s) => __c.gardee(s), sorte);
      if (g && !g.nomme && !g.bande) faute(nomPage, `${ici}${ou} : ce que le plein garde ne se voit ni ne se lit`);
      if (!g && !ou) faute(nomPage, `${ici}${ou} : aucun groupe ne porte le plein`);
      // À l'arrivée (h ≥ 440), la bande « À garder » du groupe du plein se voit entière (§ 1.4, tour 1 du lot 4) ;
      // après la molette, le libellé juste suffit.
      if (g && !ou && h >= 440 && g.entete && !g.bande) faute(nomPage, `${ici} : à l’arrivée, la bande « À garder » du groupe du plein n’est pas entière à l’écran`);
      const colles = await page.evaluate(() => __c.colles());
      if (colles.length) faute(nomPage, `${ici}${ou} : ${colles[0]}`);
      const larg = await page.evaluate(() => __c.largeursAccepter());
      if (larg.length > 1) faute(nomPage, `${ici}${ou} : « Accepter → » n’a pas la même largeur sur tous les groupes (${larg.join(', ')} px)`);
    };
    if (sorte) {
      await groupes('');
      if (!anglais) {
        const lib = await page.evaluate((s) => __c.libelles(s), sorte);
        if (lib.length) faute(nomPage, `${ici} : « Accepter → » et sa ligne grise ne disent pas ce qu’il fera : ${lib.slice(0, 2).join(' | ')}${lib.length > 2 ? ` (+${lib.length - 2})` : ''}`);
        if (sorte === 'rafales') {
          const nus = await page.evaluate(() => __c.nombresNus());
          if (nus.length) faute(nomPage, `${ici} : nombre nu dans « Accepter » : ${[...new Set(nus)].slice(0, 2).join(' | ')}`);
          const v = await page.evaluate(() => __c.virgules());
          if (v.length) faute(nomPage, `${ici} : ${[...new Set(v)].join(' | ')}`);
        }
      }
      // La tête de la table : le titre de la section et son compte ne sont jamais rognés (C-10.4) à 1280 et 1440,
      // Aide fermée (contrôle du tour 0 de l'étape 2d : « Samedi 1 août 20… 9 … » à 1280×580).
      if (w >= 1280) {
        const rognes = await page.evaluate(() => {
          if (__c.aide()?.getAttribute('aria-expanded') === 'true') return null;
          return [...document.querySelectorAll('.tete-table :is(.titre-section, .detail-section)')]
            .filter((x) => __c.affiche(x) && x.scrollWidth > x.clientWidth + 1)
            .map((x) => `« ${__c.norm(x.textContent)} » (${x.clientWidth} px sur ${x.scrollWidth})`);
        });
        if (rognes?.length) faute(nomPage, `${ici} : la tête de la table rogne ${rognes.join(', ')}`);
      }
      if (sorte === 'rafales') {
        const pl = await page.evaluate(() => __c.placesBandes());
        if (pl.length) faute(nomPage, `${ici} : place absente du début de la bande : ${pl.slice(0, 3).join(', ')}${pl.length > 3 ? ` (+${pl.length - 3})` : ''}`);
      }
      if (sorte === 'copies') {
        const c = await page.evaluate(() => __c.copiesUneFois());
        if (c.length) faute(nomPage, `${ici} : Copies exactes, la photo doit être montrée une fois : ${c.slice(0, 2).join(' | ')}`);
      }
      // Plus d'accroche (forme E) : sur une page qui défile en entier, elle ramenait le défilement au début du dernier
      // groupe et cachait la fin de la liste (tour 1 du lot 4).
      const a = await page.evaluate(() => __c.accroche());
      if (a !== null && a !== 'none') faute(nomPage, `${ici} : le défilement s’accroche encore au début des groupes (scroll-snap-type : ${a})`);
    }
    // Forme E (D112) : la page à mi-course et en bas, puis chaque colonne collée qui défile (liste, panneau, Aide), à
    // mi-course et en bas. La ligne de l'étape reste collée en haut, ses commandes au même x ; la barre du bas et « Valider » ne
    // bougent pas ; la barre du projet est partie ; la vue en cours reste écrite ; la fin des colonnes collées se voit.
    const avant = e.fixes;
    // Où était la ligne de l'étape au départ : jusqu'à se coller en haut, elle remonte exactement du défilement de la page.
    const depart = await page.evaluate(() => ({ y: scrollY, ligne: Math.round(document.querySelector('.ligne-etape')?.getBoundingClientRect().top ?? NaN) }));
    const positions = [];
    for (const part of [0.5, 1]) positions.push({ i: -1, part });
    const colonnes = e.zones.filter((z) => /colonne-liste|panneau|aide|arbre|sections/.test(z.nom)).length;
    for (let i = 0; i < e.zones.length && colonnes; i++) for (const part of [0.5, 1]) positions.push({ i, part });
    for (const { i, part } of positions) {
      const ou =
        i < 0
          ? await page.evaluate((p) => {
              const d = document.scrollingElement;
              d.scrollTop = Math.round((d.scrollHeight - innerHeight) * p);
              return 'page';
            }, part)
          : await page.evaluate(([i, p]) => __c.defiler(i, p), [i, part]);
      if (!ou) continue;
      await attendre(300);
      const lieu = ` (${ou} à ${part * 100} %)`;
      const m = await page.evaluate(() => __c.etat());
      const n = m.pleins.filter((p) => p.vu).length;
      if (n !== 1) faute(nomPage, `${ici}${lieu} : ${n} bouton(s) plein(s) entier(s), 1 attendu${m.pleins.length ? ` (${m.pleins.map((p) => `« ${p.texte} »${p.vu ? '' : ' caché'}`).join(' ; ')})` : ''}`);
      const haut = await page.evaluate(() => ({
        y: scrollY,
        ligne: Math.round(document.querySelector('.ligne-etape')?.getBoundingClientRect().top ?? -1),
        projet: Math.round(document.querySelector('header.entete')?.getBoundingClientRect().bottom ?? 0),
        projetH: Math.round(document.querySelector('header.entete')?.getBoundingClientRect().height ?? 0),
      }));
      // Collée dès que la page a défilé de la hauteur au-dessus de la ligne (barre du projet et bandeaux éventuels).
      const colle = Number.isNaN(depart.ligne) ? haut.y >= haut.projetH : haut.y >= depart.ligne + depart.y;
      if (colle && haut.ligne !== 0) faute(nomPage, `${ici}${lieu} : la ligne de l’étape n’est pas collée en haut (y ${haut.ligne})`);
      if (colle && haut.projet > 0) faute(nomPage, `${ici}${lieu} : la barre du projet n’est pas partie avec la page`);
      // Avant de se coller, la ligne remonte d'autant que la page a défilé (a.y ≈ b.y − scrollY), puis reste à y 0.
      const ligneAttendue = Number.isNaN(depart.ligne) ? null : Math.max(0, depart.ligne + depart.y - haut.y);
      if (ligneAttendue !== null && Math.abs(haut.ligne - ligneAttendue) > 1) faute(nomPage, `${ici}${lieu} : la ligne de l’étape ne suit pas le défilement (y ${haut.ligne}, ${ligneAttendue} attendu)`);
      for (const [k, b] of Object.entries(avant)) {
        const a = m.fixes[k];
        // Les commandes de la ligne gardent leur x et la suivent en y ; la barre du bas et « Valider » ne bougent pas.
        const dansLigne = !['barre', 'valider'].includes(k);
        const yAttendu = dansLigne && ligneAttendue !== null ? b.y - (depart.ligne - ligneAttendue) : b.y;
        if (!a) faute(nomPage, `${ici}${lieu} : « ${k} » disparaît`);
        else if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - yAttendu) > 1)
          faute(nomPage, `${ici}${lieu} : « ${k} » bouge (x ${b.x} → ${a.x}, y ${b.y} → ${a.y}, ${yAttendu} attendu)`);
      }
      // Les onglets ou les filtres sont partis : la vue en cours reste écrite dans la ligne (C-4.12) ; ou les filtres
      // sont dans la ligne elle-même, le filtre en cours enfoncé (Floues au-dessus de 1180 px, D112).
      if (vue && haut.y >= haut.projetH + 8) {
        const v = await page.evaluate(() => {
          const b = document.querySelector('.ligne-etape [data-action=menu-vue]') ?? document.querySelector('.ligne-etape .filtres-floues [aria-pressed=true]');
          return b && __c.vu(b) ? __c.norm(b.textContent) : null;
        });
        if (!v) faute(nomPage, `${ici}${lieu} : la vue en cours n’est pas écrite dans la ligne de l’étape (menu « … ▾ » attendu)`);
      }
      // La fin des colonnes collées (liste, panneau, Aide) se voit, au-dessus de la barre du bas.
      if (part === 1) {
        const coupees = await page.evaluate(() =>
          [...document.querySelectorAll('.colonne-liste, .corps-cadre > .panneau-cadre, .corps-cadre > .panneau-aide, .pile-droite')]
            .filter((c) => __c.affiche(c) && getComputedStyle(c).position === 'sticky')
            .filter((c) => c.getBoundingClientRect().bottom > __c.bornes().bas + 1 || c.getBoundingClientRect().top < (document.querySelector('.ligne-etape')?.getBoundingClientRect().bottom ?? 0) - 1)
            .map((c) => `.${[...c.classList].join('.')} (${Math.round(c.getBoundingClientRect().top)} → ${Math.round(c.getBoundingClientRect().bottom)})`),
        );
        if (coupees.length) faute(nomPage, `${ici}${lieu} : colonne collée qui sort de ce qu’on voit (sous la ligne, au-dessus de la barre du bas) : ${coupees.join(', ')}`);
      }
      const cadres = await page.evaluate(() => __c.cadreJaune());
      if (cadres.length) faute(nomPage, `${ici}${lieu} : cadre jaune et noir allumé après le défilement (${cadres[0]})`);
      await groupes(lieu);
    }
    await page.evaluate(() => __c.remonter());
    await attendre(150);
    // Le texte le plus long dans chaque ligne grise d'« Accepter → » (rafale de 12 : « garde la 11 · écarte 11 »).
    if (sorte === 'rafales' && thm === 'light') {
      const en = await page.evaluate(() => {
        const noeuds = [];
        for (const b of document.querySelectorAll('article.carte-doublons > header .dit-accepter')) {
          const m = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          for (let n = m.nextNode(); n; n = m.nextNode()) noeuds.push([n, n.data]);
        }
        for (const [n] of noeuds) n.data = n.data.replace(/\d+/g, '11');
        const r = __c.entetes();
        for (const [n, d] of noeuds) n.data = d;
        return r;
      });
      if (en.length) faute(nomPage, `${ici} : avec le texte le plus long, en-tête pas sur une ligne : ${en.slice(0, 2).join(' | ')}`);
    }
    return e;
  };

  /** Une page du pilote, aux 4 tailles et dans les 2 thèmes. */
  const controlerPilote = async (nomPage, opts = {}) => {
    pagesFaites.push(nomPage);
    console.log(`\n[${temps()}] ${nomPage} (pilote)`);
    for (const [w, h] of TAILLES) {
      await taille(w, h);
      for (const thm of THEMES) {
        await theme(thm);
        await attendre(200);
        const ici = `${w}×${h} ${thm === 'light' ? 'clair' : 'sombre'}`;
        const avant = fautes.length;
        await controlerCadre(nomPage, ici, w, h, { ...opts, thm });
        console.log(`  ${fautes.length > avant ? '✗' : '✓'} ${ici} : ${fautes.length - avant} écart(s)`);
        await capture(`${nomPage}_${w}x${h}_${thm}`);
      }
    }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await taille(1440, 900);
  };

  /** Une page pas encore passée au cadre : seulement les contrôles qui valent déjà partout. */
  const controlerAilleurs = async (nomPage, opts = {}) => {
    pagesFaites.push(nomPage);
    const cadre = await page.evaluate(() => document.querySelector('[data-cadre]')?.dataset.cadre ?? '');
    if (cadre === 'commun') {
      console.log(`\n[${temps()}] ${nomPage} (passée au cadre : data-cadre="commun")`);
      for (const [w, h] of TAILLES) {
        await taille(w, h);
        for (const thm of THEMES) {
          await theme(thm);
          const ici = `${w}×${h} ${thm === 'light' ? 'clair' : 'sombre'}`;
          const avant = fautes.length;
          await controlerCadre(nomPage, ici, w, h, { ...opts, thm });
          if (opts.gestes) for (const x of await opts.gestes(ici)) faute(nomPage, `${ici} : ${x}`);
          console.log(`  ${fautes.length > avant ? '✗' : '✓'} ${ici} : ${fautes.length - avant} écart(s)`);
          await capture(`${nomPage}_${w}x${h}_${thm}`);
        }
      }
    } else {
      enAttente.add(nomPage);
      const resume = [];
      for (const [w, h] of TAILLES) {
        await taille(w, h);
        for (const thm of THEMES) {
          await theme(thm);
          await attendre(150);
          const ici = `${w}×${h} ${thm === 'light' ? 'clair' : 'sombre'}`;
          const e = await page.evaluate(() => __c.etat());
          noterValider(nomPage, w, h, e.valider);
          if (e.valider && !e.valider.vu && !e.vue) faute(nomPage, `${nomPage} ${ici} : « Valider et continuer » caché ou recouvert`);
          // La forme E vaut sur les 13 étapes, au cadre commun ou non (D112).
          if (!e.vue) for (const x of await page.evaluate(() => __c.formeE())) faute(nomPage, `${nomPage} ${ici} : ${x}`);
          if (e.marques.length) faute(nomPage, `${nomPage} ${ici} : posé sur une photo (C-9.1) : ${e.marques.slice(0, 3).join(' ; ')}`);
          // Au palier (1024), la largeur relève du cadre commun (C-7.6) : signalée seulement.
          if (e.pageLargeur && w > 1180) faute(nomPage, `${nomPage} ${ici} : la page défile en largeur (C-7.1)`);
          else if (e.pageLargeur && thm === 'light') signalements.push(`${nomPage} ${ici} : la page défile en largeur (palier, à régler en passant la page au cadre)`);
          if (thm === 'light') resume.push(e.valider ? `${w}×${h} (${e.valider.x}, ${e.valider.y})` : `${w}×${h} sans Valider`);
        }
      }
      console.log(`\n[${temps()}] ${nomPage} : pas encore passée au cadre (contrôles généraux et forme E) · Valider : ${resume.join(' · ')}`);
    }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await taille(1440, 900);
  };

  /** Choix 5 : à la première visite, l'Aide s'ouvre seule à 1440 px, pas en dessous (« à lire »). */
  const controlerAide = async (nomPage, w) => {
    pagesFaites.push(nomPage);
    const a = await page.evaluate(() => {
      const b = __c.aide();
      return b ? { ouverte: b.getAttribute('aria-expanded') === 'true', texte: __c.norm(b.textContent) } : null;
    });
    if (!a) return faute(nomPage, `${nomPage} première visite à ${w} px : pas de bouton « Aide »`);
    if (w < 1440 && a.ouverte) faute(nomPage, `${nomPage} première visite à ${w} px : l’Aide s’est ouverte seule (sous 1440 px, elle porte « à lire »)`);
    if (w < 1440 && !/à lire/.test(a.texte)) faute(nomPage, `${nomPage} première visite à ${w} px : « Aide » ne porte pas « à lire » (« ${a.texte} »)`);
    if (w >= 1440 && !a.ouverte) faute(nomPage, `${nomPage} première visite à ${w} px : l’Aide ne s’est pas ouverte seule`);
    console.log(`  Aide à la première visite (${w} px) : ${a.ouverte ? 'ouverte' : 'fermée'}, « ${a.texte} »`);
  };
  /** Referme l'Aide si elle est ouverte (les mesures se font Aide fermée). */
  const fermerAide = async () => {
    const ouverte = await page.evaluate(() => __c.aide()?.getAttribute('aria-expanded') === 'true');
    if (ouverte) {
      await page.evaluate(() => __c.aide().click());
      await attendre(300);
    }
  };

  // ---- Le dossier à trier : photos réelles + photos fabriquées ----
  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).waitFor();
  await page.evaluate(() => {
    const c = document.createElement('input');
    c.type = 'file';
    c.multiple = true;
    c.id = 'remplissage';
    c.style.display = 'none';
    document.body.appendChild(c);
  });
  await page.setInputFiles('#remplissage', photosReelles.map((p) => join(PHOTOS, p)));
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const source = await racine.getDirectoryHandle('selecteur_source', { create: true });
    for (const f of document.getElementById('remplissage').files) {
      const w = await (await source.getFileHandle(f.name, { create: true })).createWritable();
      await w.write(f);
      await w.close();
    }
    const f140 = [...document.getElementById('remplissage').files].find((f) => f.name.startsWith('0140'));
    if (f140) {
      const w = await (await source.getFileHandle('copie de 0140.jpg', { create: true })).createWritable();
      await w.write(f140);
      await w.close();
    }
    await racine.getDirectoryHandle('selecteur_sortie', { create: true });
  });
  const fabriquees = await page.evaluate(fabriquer, SPECS);
  console.log(`[${temps()}] jeu d’essai : ${photosReelles.length} photos réelles + ${SPECS.length} fabriquées (${fabriquees} images)`);

  await page.getByRole('button', { name: /Trier un nouveau dossier/ }).click();
  const choisirDossier = page.getByRole('button', { name: 'Choisir…' });
  await choisirDossier.nth(0).click();
  await page.getByText('« selecteur_source »').waitFor();
  await choisirDossier.nth(1).click();
  await page.getByText('« selecteur_sortie »').first().waitFor();
  await page.fill('#nom-projet', 'Essai cadre');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  /**
   * Badges de Floues (D112) : une bande de 28 px sous chaque photo, son mot jamais coupé ; seule la bande montre la
   * main ; au survol, le mot dit l'effet du clic (« Garder », « Revenir à la proposition ») ; la bande n'est pas un
   * arrêt de Tab ; un clic ne choisit pas la photo, Ctrl+Z le défait ; les filtres de la ligne tiennent sans déborder.
   */
  const badgesFloues = async (ici) => {
    const f = [];
    // Vitrine (captures seulement) : un réglage strict pour voir « À écarter », « ? » et les décisions par vous.
    if (CAPTURES && /^(1280×580|1024×464)/.test(ici)) {
      await page.evaluate(() => {
        const r = document.querySelector('[data-action=tolerance]');
        if (r) {
          r.value = String(Math.round(Math.log(500) * 100));
          r.dispatchEvent(new Event('input', { bubbles: true }));
        }
        __c.remonter();
      });
      await attendre(300);
      const bandes = page.locator('.page-floues .tuile .badge-photo[data-cliquable] button');
      await bandes.nth(1).click();
      await attendre(600);
      await bandes.nth(4).click();
      await attendre(300);
      await page.mouse.move(2, 300);
      await capture(`floues-vitrine_${ici.replace('×', 'x').replace(' clair', '_light').replace(' sombre', '_dark')}`);
      await bandes.nth(2).hover();
      await attendre(200);
      await capture(`floues-survol_${ici.replace('×', 'x').replace(' clair', '_light').replace(' sombre', '_dark')}`);
      await page.mouse.move(2, 300);
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+z');
      // Retour au réglage conseillé (60), même quand l'Aide a pris la place du panneau.
      await page.evaluate(() => {
        const r = document.querySelector('[data-action=tolerance]');
        if (!r) return;
        r.value = String(Math.round(Math.log(60) * 100));
        r.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await attendre(300);
    }
    await page.evaluate(() => __c.remonter());
    const b = page.locator('.page-floues .tuile .badge-photo[data-cliquable]').first();
    if (!(await b.count())) return ['aucun badge cliquable sous les photos de Floues'];
    const m = await page.evaluate(() => {
      const r = [];
      for (const x of [...document.querySelectorAll('.page-floues .badge-photo')].slice(0, 40)) {
        const rb = x.getBoundingClientRect();
        if (!rb.width) continue;
        if (Math.abs(rb.height - 28) > 1) r.push(`bande de ${Math.round(rb.height)} px`);
        const mot = x.querySelector('.etat-badge .mot-badge');
        if (mot && mot.scrollWidth > mot.clientWidth + 1) r.push(`mot coupé « ${mot.textContent} »`);
        if (x.querySelector('button')?.tabIndex !== -1) r.push('bande arrêt de Tab');
      }
      const img = document.querySelector('.page-floues .tuile .cadre-miniature');
      if (img && getComputedStyle(img).cursor === 'pointer') r.push('la photo montre la main (seule la bande la montre)');
      const btn = document.querySelector('.page-floues .badge-photo[data-cliquable] button');
      if (btn && getComputedStyle(btn).cursor !== 'pointer') r.push('la bande ne montre pas la main');
      const filtres = document.querySelector('.ligne-etape .filtres-floues');
      const ligne = document.querySelector('.ligne-etape');
      if (filtres && (ligne.scrollWidth > ligne.clientWidth + 1 || filtres.getBoundingClientRect().right > (document.querySelector('.ligne-etape .droite-ligne')?.getBoundingClientRect().left ?? innerWidth) + 1)) r.push('les filtres débordent de la ligne de l’étape');
      return [...new Set(r)];
    });
    f.push(...m);
    // § B : les filtres sont dans la ligne de titre, de toute la largeur de la fenêtre, Aide ouverte ou non ; ils ne
    // descendent dans la barre d'outils que sous 1180 px.
    const place = await page.evaluate(() => ({
      largeur: innerWidth,
      aide: !!document.querySelector('.page-floues[data-aide]'),
      ligne: !!document.querySelector('.ligne-etape .filtres-floues'),
      outils: !!document.querySelector('.page-floues .filtres-floues:not(.ligne-etape *)'),
    }));
    if (place.largeur > 1180 && !place.ligne) f.push(`les filtres ne sont pas dans la ligne de titre à ${place.largeur} px${place.aide ? ', Aide ouverte' : ''}`);
    if (place.largeur <= 1180 && !place.outils) f.push(`les filtres ne sont pas dans la barre d’outils à ${place.largeur} px`);
    await b.scrollIntoViewIfNeeded();
    await b.hover();
    await attendre(150);
    const survol = await b.evaluate((x) => ({
      etat: getComputedStyle(x.querySelector('.etat-badge')).display,
      effet: x.querySelector('.effet-badge') && getComputedStyle(x.querySelector('.effet-badge')).display,
      mot: x.querySelector('.effet-badge')?.textContent?.trim(),
      // La forme de bouton (§ A.4) : le fond et le contour de la bande se voient, le bouton intérieur ne les couvre pas.
      fondBouton: getComputedStyle(x.querySelector('button')).backgroundColor,
      contour: getComputedStyle(x).boxShadow,
    }));
    if (survol.etat !== 'none' || survol.effet === 'none' || !/Garder|Écarter|Revenir/.test(survol.mot ?? '')) f.push(`au survol, la bande ne dit pas l’effet du clic (${JSON.stringify(survol)})`);
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(survol.fondBouton) || !/1\.5px/.test(survol.contour)) f.push(`au survol, la bande ne prend pas la forme d’un bouton (fond du bouton ${survol.fondBouton}, contour ${survol.contour})`);
    const avant = await b.evaluate((x) => x.dataset.sort + (x.hasAttribute('data-decide') ? ' décidé' : ''));
    await b.click();
    await attendre(150);
    const apres = await page.evaluate(() => {
      const x = document.querySelector('.page-floues .tuile .badge-photo[data-cliquable]');
      return { etat: x.dataset.sort + (x.hasAttribute('data-decide') ? ' décidé' : ''), origine: x.dataset.origine, choisie: !!x.closest('.tuile.choisie'), focus: !!document.activeElement?.closest('.badge-photo') };
    });
    if (apres.etat === avant || apres.origine !== 'vous') f.push(`clic sur la bande : « ${avant} » → « ${apres.etat} » (${apres.origine}), l’autre sort par vous attendu`);
    if (apres.choisie) f.push('clic sur la bande : la photo est choisie');
    // Sans focus, la photo écartée se délave dès que la souris s'en va, et Entrée reste à la photo choisie.
    if (apres.focus) f.push('clic sur la bande : elle prend le focus');
    await page.mouse.move(2, 300);
    await page.keyboard.press('Control+z');
    await attendre(150);
    const defait = await page.evaluate(() => {
      const x = document.querySelector('.page-floues .tuile .badge-photo[data-cliquable]');
      return x.dataset.sort + (x.hasAttribute('data-decide') ? ' décidé' : '');
    });
    if (defait !== avant) f.push(`Ctrl+Z ne défait pas le clic sur la bande (« ${defait} », « ${avant} » attendu)`);
    await page.evaluate(() => __c.remonter());
    await attendre(600);
    return f;
  };

  const valider = async (etape) => {
    await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 120_000 });
    await page.locator('[data-action=valider]').click();
    // Doublons avec des copies exactes restantes (É14 g) : la fenêtre à trois choix ; on part sans elles.
    const sans = page.locator('.dialogue [data-choix=sans]');
    if (await sans.waitFor({ timeout: 1500 }).then(() => true, () => false)) await sans.click();
    await page.locator(`main[data-etape=${etape}]`).waitFor({ timeout: 120_000 });
  };
  await page.locator('main[data-etape=inventaire]').waitFor({ timeout: 120_000 });
  await page.locator('[data-action=valider]').and(page.locator(':enabled')).waitFor({ timeout: 120_000 });
  await controlerAilleurs('inventaire');
  await valider('floues').catch(async () => {
    await page.locator('main[data-etape=dossiers]').waitFor({ timeout: 1000 });
    await controlerAilleurs('dossiers');
    await valider('floues');
  });
  // Floues dans le cadre commun (D112) : les badges sous la photo, à chaque taille et dans les deux thèmes.
  await controlerAilleurs('floues', { photos: true, ecarte: true, gestes: badgesFloues });

  // ---- Doublons : première visite à 1280×580 (choix 5) ----
  await taille(1280, 580);
  await valider('doublons');
  await attendre(500);
  await controlerAide('doublons-aide', 1280);
  await taille(1440, 900);
  await fermerAide();
  await page.locator('.carte-doublons').first().waitFor({ timeout: 120_000 });
  // L'analyse finie : l'onglet Rafales a ses groupes.
  await page.waitForFunction(() => !/…/.test(document.querySelectorAll('.onglet-doublons')[1]?.textContent ?? '…'), null, { timeout: 120_000 }).catch(() => undefined);
  const onglet = async (i) => {
    await page.locator('.onglet-doublons').nth(i).click();
    await attendre(500);
  };
  /** La section (journée, dossier) qui a le plus de groupes, ou la première où `test` est vrai. */
  const choisirSection = async (test) => {
    const n = await page.locator('.section-doublons').count();
    let meilleure = -1;
    let max = -1;
    for (let i = 0; i < n; i++) {
      await page.locator('.section-doublons').nth(i).click();
      await attendre(250);
      const r = await page.evaluate((t) => ({ n: __c.articles().length, ok: t ? __c.articles().some((a) => a.textContent.includes(t)) : false }), test ?? null);
      if (test && r.ok) return i;
      if (r.n > max) [max, meilleure] = [r.n, i];
    }
    if (meilleure >= 0) await page.locator('.section-doublons').nth(meilleure).click();
    await attendre(300);
    return meilleure;
  };

  // Copies exactes (onglet 1) : la section du nom de dossier long (40 signes).
  await onglet(0);
  await choisirSection(DOSSIER_LONG);
  await controlerPilote('doublons-copies', { sorte: 'copies', photos: true, ecarte: true, liste: '.sections-doublons' });

  // Rafales (onglet 2) : la journée de 9 rafales.
  await onglet(1);
  await choisirSection();
  console.log(`  rafales : ${await page.evaluate(() => __c.articles().length)} groupes dans la journée affichée`);
  await controlerPilote('doublons-rafales', { sorte: 'rafales', photos: true, ecarte: true, liste: '.sections-doublons' });

  // « Journée suivante à accepter » après le dernier cran de molette, sur la ligne du dernier groupe.
  pagesFaites.push('doublons-suite');
  console.log(`\n[${temps()}] doublons-suite (pilote)`);
  for (const [w, h] of TAILLES) {
    await taille(w, h);
    await page.evaluate(() => __c.remonter());
    const zone = await page.evaluate(() => {
      const a = __c.articles()[0];
      const z = __c.zoneDe(a);
      const q = z === document.scrollingElement ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : z.getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + Math.min(q.height / 2, 100) };
    });
    await page.mouse.move(zone.x, zone.y);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 120);
      await attendre(40);
    }
    await attendre(700);
    const s = await page.evaluate(() => __c.suite());
    const ici = `${w}×${h}`;
    if (!s.existe) faute('doublons-suite', `${ici} : pas de « Journée suivante à accepter » en bas de la journée`);
    else {
      if (!s.vu) faute('doublons-suite', `${ici} : « ${s.texte} » pas entier à l’écran après la molette`);
      if (!s.dansDernier) faute('doublons-suite', `${ici} : « ${s.texte} » n’est pas sur la ligne du dernier groupe`);
    }
    console.log(`  ${ici} : ${s.existe ? `« ${s.texte} »${s.vu ? ' entier' : ' caché'}${s.dansDernier ? ', dans le dernier groupe' : ''}` : 'absent'}`);
    await capture(`doublons-suite_${w}x${h}`);
  }
  await page.evaluate(() => __c.remonter());
  await taille(1440, 900);

  // ---- Essais reportés du lot 3 (Comparer) ----
  // ← → avec le filtre « À accepter » : les flèches restent dans la journée affichée.
  pagesFaites.push('comparer-fleches');
  {
    await page.locator('.outils-doublons [role=radio]').nth(0).click();
    await attendre(400);
    const m0 = await page.evaluate(() => __c.cartes().filter((x) => !x.classList.contains('repliee')).length);
    await page.locator('article.carte-doublons [data-action=comparer]').first().click();
    await page.locator('.comparateur').waitFor();
    await attendre(400);
    const vus = [];
    for (let i = 0; i <= m0; i++) {
      vus.push(await page.evaluate(() => __c.norm(document.querySelector('.comparateur .position-groupe')?.textContent)));
      await page.keyboard.press('ArrowRight');
      await attendre(300);
    }
    await page.keyboard.press('Escape');
    await page.locator('.comparateur').waitFor({ state: 'detached' });
    const nums = vus.map((v) => v.match(/(\d+)\D+(\d+)/)).filter(Boolean);
    const total = new Set(nums.map((x) => x[2]));
    const dernier = nums.at(-1)?.[1];
    if (!nums.length) faute('comparer-fleches', `← → : pas de position « Groupe k sur M » dans Comparer`);
    else if (total.size !== 1 || Number([...total][0]) !== m0 || Number(dernier) !== m0) faute('comparer-fleches', `← → avec « À accepter » : ${vus.join(' → ')} (${m0} groupes dans la journée)`);
    console.log(`\n[${temps()}] comparer-fleches : ${vus.join(' → ')} (${m0} groupes affichés)`);
  }
  // Touches 1 à 9 : sans effet sur une vignette hors de l'écran (rafale de 12, « Une à la fois », palier).
  pagesFaites.push('comparer-touches');
  {
    await taille(1024, 464);
    const i12 = await page.evaluate(() => __c.articles().findIndex((a) => a.querySelectorAll('.tuile-doublon').length === 12));
    if (i12 < 0) faute('comparer-touches', 'touches 1 à 9 : pas de rafale de 12 photos dans la journée');
    else {
      await page.locator('article.carte-doublons').nth(i12).locator('[data-action=comparer]').click();
      await page.locator('.comparateur[data-presentation]').waitFor();
      await attendre(500);
      if ((await page.locator('.comparateur').getAttribute('data-presentation')) !== 'une') {
        await page.keyboard.press('Enter');
        await attendre(400);
      }
      const lire = () =>
        page.evaluate(() => ({
          etats: [...document.querySelectorAll('.comparateur .vignette-comparer .bande-etat')].map((x) => `${x.dataset.sort}:${x.dataset.origine}:${x.hasAttribute('data-decide')}`).join('|'),
          titre: __c.norm(document.querySelector('.comparateur .titre-legende')?.textContent),
        }));
      const cachee = async () =>
        page.evaluate(() => {
          const ol = document.querySelector('.comparateur .vignettes-comparateur ol') ?? document.querySelector('.comparateur .vignettes-comparateur');
          if (!ol) return null;
          const r = ol.getBoundingClientRect();
          const v = [...document.querySelectorAll('.comparateur .vignette-comparer')];
          const dedans = (x) => {
            const q = x.getBoundingClientRect();
            // Même règle que l'application (numeroVisible) : « à l'écran » dès que 4 px de la vignette se voient.
            return q.width > 0 && q.bottom > r.top + 4 && q.top < r.bottom - 4 && q.right > 0 && q.left < innerWidth;
          };
          const k = v.slice(0, 9).findIndex((x) => !dedans(x) && !x.classList.contains('affichee'));
          const vis = v.slice(0, 9).findIndex((x) => dedans(x) && !x.classList.contains('affichee'));
          return { cachee: k + 1, visible: vis + 1 };
        });
      let c = await cachee();
      if (c && !c.cachee) {
        await page.evaluate(() => {
          const ol = document.querySelector('.comparateur .vignettes-comparateur ol') ?? document.querySelector('.comparateur .vignettes-comparateur');
          ol.scrollTop = ol.scrollHeight;
          ol.scrollLeft = ol.scrollWidth;
        });
        await attendre(300);
        c = await cachee();
      }
      if (!c?.cachee) signalements.push('touches 1 à 9 : les 9 premières vignettes sont toutes à l’écran, rien à essayer hors de l’écran');
      else {
        const avant = await lire();
        await page.keyboard.press(String(c.cachee));
        await attendre(400);
        const apres = await lire();
        if (apres.etats !== avant.etats || apres.titre !== avant.titre) faute('comparer-touches', `touche ${c.cachee} sur une vignette hors de l’écran : l’état a changé`);
        console.log(`\n[${temps()}] comparer-touches : touche ${c.cachee} (vignette hors de l’écran) ${apres.etats === avant.etats ? 'sans effet' : 'A CHANGÉ UNE PHOTO'}`);
        // Contre-essai : la touche d'une vignette à l'écran agit, puis Ctrl+Z la défait.
        if (c.visible) {
          await page.keyboard.press(String(c.visible));
          await attendre(400);
          const agit = (await lire()).etats !== avant.etats;
          if (!agit) signalements.push(`touche ${c.visible} sur une vignette à l’écran : aucun effet (contre-essai)`);
          else {
            await page.keyboard.press('Control+z');
            await attendre(400);
          }
        }
      }
      await page.keyboard.press('Escape');
      await page.locator('.comparateur').waitFor({ state: 'detached' });
    }
    await taille(1440, 900);
  }

  // ---- Comparer : le plein n'est jamais rogné (C-10.5, tour 1 du lot 4, B2), aux 3 tailles, rafale de 12 ----
  pagesFaites.push('doublons-comparer-plein');
  {
    for (const [w, h] of TAILLES.slice(0, 3))
      for (const thm of THEMES) {
        await taille(w, h);
        await theme(thm);
        const i12 = await page.evaluate(() => __c.articles().findIndex((a) => a.querySelectorAll('.tuile-doublon').length === 12));
        const loc = i12 >= 0 ? page.locator('article.carte-doublons').nth(i12) : page.locator('article.carte-doublons').first();
        await loc.locator('[data-action=comparer]').click();
        await page.locator('.comparateur').waitFor();
        await attendre(500);
        const r = await page.evaluate(() => ({
          rognes: __c.pleinsRognes(),
          vu: [...document.querySelectorAll('.comparateur [data-action=accepter]')].some((b) => __c.vu(b)),
          texte: __c.norm(document.querySelector('.comparateur [data-action=accepter]')?.textContent),
          // Tour 3 du lot 4 : le texte de « Garder plusieurs photos » (chaque ligne, pas la boîte du label) dans la
          // partie visible de la légende de « Une à la fois » (« Garder plusieurs photo▌ » à 1024×464).
          plusieurs: (() => {
            const l = document.querySelector('.comparateur .legende-une');
            const x = l?.querySelector('.plusieurs-photos');
            if (!l || !x) return null;
            const q = l.getBoundingClientRect();
            const droite = q.left + l.clientLeft + l.clientWidth;
            const r = document.createRange();
            r.selectNodeContents(x);
            const lignes = [...r.getClientRects()].filter((c) => c.width > 0);
            return { coupe: lignes.some((c) => c.right > droite + 0.5 || c.left < q.left - 0.5), lignes: lignes.length, largeur: Math.round(l.clientWidth) };
          })(),
        }));
        const ici = `${w}×${h} ${thm === 'light' ? 'clair' : 'sombre'}`;
        if (r.plusieurs?.coupe) faute('doublons-comparer-plein', `${ici} : « Garder plusieurs photos » rogné par la légende de « Une à la fois » (${r.plusieurs.largeur} px)`);
        if (thm === 'light' && r.plusieurs) console.log(`  ${ici} « Garder plusieurs photos » : ${r.plusieurs.coupe ? 'ROGNÉ' : 'entier'}, ${r.plusieurs.lignes} ligne(s) dans ${r.plusieurs.largeur} px`);
        if (r.rognes.length) faute('doublons-comparer-plein', `${ici} : plein de Comparer rogné : ${r.rognes[0]}`);
        if (!r.vu) faute('doublons-comparer-plein', `${ici} : plein de Comparer pas entier à l’écran (« ${r.texte} »)`);
        if (thm === 'light') console.log(`\n[${temps()}] doublons-comparer-plein ${ici} : « ${r.texte} »${r.rognes.length ? ' ROGNÉ' : ' entier'}`);
        await capture(`doublons-comparer-plein_${w}x${h}_${thm}`);
        await page.keyboard.press('Escape');
        await page.locator('.comparateur').waitFor({ state: 'detached' });
      }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await taille(1440, 900);
  }

  // ---- « Annuler » de l'en-tête suit chaque geste (tour 1 du lot 4, B1) ; « Garder plusieurs photos » ----
  pagesFaites.push('doublons-annuler');
  {
    const A = 'doublons-annuler';
    const lireA = () =>
      page.evaluate(() => {
        const a = document.querySelector('.ligne-etape .bouton-annuler');
        const r = document.querySelector('.ligne-etape .bouton-retablir');
        return { texte: __c.norm(a?.textContent), actif: !!a && !a.disabled, retablir: !!r && !r.disabled };
      });
    await page.evaluate(() => __c.remonter());
    await attendre(600);
    const a0 = await lireA();
    const cle = await page.evaluate(() => __c.clePlein());
    const carte = page.locator(`article.carte-doublons[data-cle="${cle}"]`);
    await carte.locator('.tuile-doublon.a_ecarter').first().click();
    await attendre(400);
    const a1 = await lireA();
    if (!a1.actif || a1.texte === a0.texte || !/^Annuler : /.test(a1.texte)) faute(A, `après un clic sur une photo, « Annuler » de l’en-tête reste « ${a1.texte} »${a1.actif ? '' : ' (désactivé)'}`);
    // « Garder plusieurs photos » cochée, deux autres photos : « garder 3 photos, écarter N autres », sur le plus
    // grand groupe à accepter (la rafale de 12 : « garder 3 photos, écarter 9 autres ») ; faute s'il n'y en a pas
    // d'au moins 3 photos (tour 2 du lot 4 : l'essai était sauté sans rien dire).
    await page.keyboard.press('Control+z');
    await attendre(300);
    const grand = await page.evaluate(() => {
      const a = __c.articles().filter((x) => x.querySelector('[data-action=accepter]')).sort((x, y) => y.querySelectorAll('.tuile-doublon').length - x.querySelectorAll('.tuile-doublon').length)[0];
      return a ? { cle: a.dataset.cle, n: a.querySelectorAll('.tuile-doublon').length } : null;
    });
    if (!grand || grand.n < 3) faute(A, `« Garder plusieurs photos » : aucun groupe d’au moins 3 photos à essayer (${grand?.n ?? 0})`);
    else {
      const c3 = page.locator(`article.carte-doublons[data-cle="${grand.cle}"]`);
      await c3.getByRole('checkbox', { name: 'Garder plusieurs photos' }).check();
      await c3.locator('.tuile-doublon.a_ecarter').first().click();
      await attendre(300);
      await c3.locator('.tuile-doublon.a_ecarter').first().click();
      await attendre(400);
      const lib = await page.evaluate((c) => {
        const a = document.querySelector(`article.carte-doublons[data-cle="${CSS.escape(c)}"]`);
        return { juste: __c.libelleJuste(a, 'rafales'), texte: __c.norm(a.querySelector(':scope > header .dit-accepter')?.textContent) };
      }, grand.cle);
      const attendu = new RegExp(`^garde 3 photos · écarte ${grand.n - 3}\\b`);
      if (lib.juste || !attendu.test(lib.texte)) faute(A, `« Garder plusieurs photos » (${grand.n} photos) : ${lib.juste || `« ${lib.texte} »`}`);
      console.log(`\n[${temps()}] doublons-annuler : « Garder plusieurs photos » (${grand.n} photos) → « ${lib.texte} »`);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Control+z');
      await attendre(300);
      await page.keyboard.press('Control+z');
      await attendre(300);
      await c3.getByRole('checkbox', { name: 'Garder plusieurs photos' }).uncheck();
      await attendre(300);
    }
    // Le clic sur une photo du début est rejoué : la suite part du même état qu'avant.
    await carte.locator('.tuile-doublon.a_ecarter').first().click();
    await attendre(400);
    await page.evaluate(() => document.activeElement?.blur());
    await attendre(600);
    await page.keyboard.press('a');
    await attendre(700);
    const a2 = await lireA();
    if (!a2.actif || !/^Annuler : accepter 1 rafale/.test(a2.texte)) faute(A, `après « Accepter », « Annuler » de l’en-tête dit « ${a2.texte} »${a2.actif ? '' : ' (désactivé)'} (« Annuler : accepter 1 rafale » attendu)`);
    await page.keyboard.press('Control+z');
    await attendre(500);
    const a3 = await lireA();
    if (!a3.retablir) faute(A, 'après Ctrl+Z, « Rétablir » de l’en-tête reste désactivé');
    if (a3.texte === a2.texte) faute(A, `après Ctrl+Z, « Annuler » de l’en-tête dit encore « ${a3.texte} »`);
    console.log(`  doublons-annuler : « ${a0.texte} » → clic « ${a1.texte} » → A « ${a2.texte} » → Ctrl+Z « ${a3.texte} », Rétablir ${a3.retablir ? 'actif' : 'désactivé'}`);
    await page.keyboard.press('Control+z');
    await attendre(400);
  }

  // ---- Après « Accepter » (tour 2 du lot 4) : le message compte avant le geste et s'écrit dans l'en-tête (jamais
  //      sur les photos ni sur le plein) ; le groupe suivant vient en haut de la zone, au même y qu'à l'arrivée, sa
  //      bande « À garder » entière ; double-clic près du bord droit du plein : « Revoir » n'est pas sous la
  //      souris ; un clic sur une photo du groupe suivant dans les 0,5 s ne choisit rien. Tout est défait ensuite. ----
  pagesFaites.push('doublons-accepter-suite');
  {
    const S = 'doublons-accepter-suite';
    const nAccS = () => page.evaluate(() => __c.nAccepter());
    await page.locator('.outils-doublons [role=radio]').nth(2).click(); // « Tous », comme par défaut
    await attendre(400);
    for (const [w, h] of TAILLES.slice(0, 3)) {
      await taille(w, h);
      const ici = `${w}×${h}`;
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.evaluate(() => __c.remonter());
      await attendre(800);
      const depart = await nAccS();
      const lire = (cle) =>
        page.evaluate((cle) => {
          const a = __c.articlePlein();
          const z = a ? __c.zoneDe(a) : null;
          let y = null;
          let attendu = null;
          let fin = false;
          let colle = false;
          if (a) {
            const zone = document.querySelector('.contenu-doublons');
            const zr = zone.getBoundingClientRect();
            const tete = document.querySelector('.tete-table')?.getBoundingClientRect();
            const haut = Math.max(zr.top, 0, tete ? tete.bottom : 0);
            y = Math.round(a.getBoundingClientRect().top);
            attendu = Math.round(haut + (parseFloat(getComputedStyle(zone).paddingTop) || 0));
            // Une grande rafale dont la photo gardée est en bas : la liste descend jusqu'à sa bande, l'en-tête (et son
            // plein) reste collé en haut de la zone.
            const t = a.querySelector(':scope > header')?.getBoundingClientRect();
            colle = !!t && a.getBoundingClientRect().top < t.top - 1 && t.top <= haut + 1;
            fin = z.scrollTop + z.clientHeight >= z.scrollHeight - 2;
          }
          const plein = a?.querySelector('[data-action=accepter]');
          return {
            msg: __c.norm(document.querySelector('.ligne-etape .message-entete .texte-message')?.textContent),
            bulles: [...document.querySelectorAll('.messages .message')].filter((m) => __c.affiche(m)).length,
            accepte: cle ? __c.estAccepte(cle) : false,
            cle: a?.dataset.cle ?? null,
            y,
            attendu,
            fin,
            colle,
            bande: !!__c.gardee('rafales')?.bande,
            pleinVu: !!plein && __c.vu(plein),
          };
        }, cle);
      const ys = [];
      for (let k = 1; k <= 5; k++) {
        const avant = await page.evaluate(() => {
          const a = __c.articlePlein();
          if (!a) return null;
          const bandes = [...a.querySelectorAll('.bande-etat')].filter((b) => !b.closest('[data-action=accepter]'));
          return { cle: a.dataset.cle, ecarter: bandes.filter((b) => b.dataset.sort !== 'garder').length };
        });
        if (!avant) {
          signalements.push(`${S} ${ici} : A n° ${k} : plus de groupe à accepter dans la section`);
          break;
        }
        await attendre(600);
        await page.keyboard.press('a');
        await attendre(800);
        const r = await lire(avant.cle);
        if (!r.accepte) faute(S, `${ici} : A n° ${k} n’a pas accepté le groupe du plein`);
        const attenduMsg = new RegExp(`^${avant.ecarter} photos? écartées? : dans « Mis de côté »`);
        if (!attenduMsg.test(r.msg)) faute(S, `${ici} : A n° ${k} : le message dit « ${r.msg || 'rien'} » (${avant.ecarter} photo(s) écartée(s) attendues, dans l’en-tête)`);
        if (r.bulles) faute(S, `${ici} : A n° ${k} : le message passager est une bulle posée sur la page (il va dans l’en-tête)`);
        if (r.cle && r.cle !== avant.cle) {
          if (!r.pleinVu) faute(S, `${ici} : A n° ${k} : le plein suivant est caché ou recouvert`);
          if (!r.fin && !r.colle && Math.abs(r.y - r.attendu) > 1) faute(S, `${ici} : A n° ${k} : le groupe suivant n’est pas en haut de la zone (y ${r.y}, ${r.attendu} attendu, comme à l’arrivée)`);
          if (!r.bande) faute(S, `${ici} : A n° ${k} : la bande « À garder » du groupe suivant n’est pas entière à l’écran`);
          ys.push(r.colle ? `${r.y} (en-tête collé, liste descendue jusqu’à la photo gardée)` : r.fin ? `${r.y} (fin de liste)` : r.y);
        }
      }
      console.log(`\n[${temps()}] ${S} ${ici} : en-tête du plein après chaque A, y ${ys.join(' / ')}`);
      // Double-clic à 20 px du bord droit du plein : un seul groupe accepté, et il reste replié.
      await attendre(800);
      const b = await page.evaluate(() => {
        const x = __c.articlePlein()?.querySelector('[data-action=accepter]');
        if (!x) return null;
        const q = x.getBoundingClientRect();
        return { cle: __c.clePlein(), x: q.right - 20, y: q.top + q.height / 2 };
      });
      if (!b) signalements.push(`${S} ${ici} : double-clic près du bord : plus de groupe à accepter`);
      else {
        const n0 = await nAccS();
        await page.mouse.dblclick(b.x, b.y);
        await attendre(900);
        const n1 = await nAccS();
        const replie = await page.evaluate((c) => !!document.querySelector(`.carte-doublons.repliee[data-cle="${CSS.escape(c)}"]`), b.cle);
        if (n0 - n1 !== 1 || !replie) faute(S, `${ici} : double-clic à 20 px du bord droit du plein : ${n0 - n1} groupe(s) accepté(s), ${replie ? 'replié' : 'groupe rouvert (« Revoir » sous la souris ?)'}`);
        console.log(`  ${ici} double-clic près du bord : ${n0 - n1} accepté(s), ${replie ? 'replié' : 'ROUVERT'}`);
      }
      // Clic sur « Accepter », puis aussitôt sur une photo à écarter du groupe suivant : elle n'est pas choisie.
      await attendre(800);
      const p = await page.evaluate(() => {
        const x = __c.articlePlein()?.querySelector('[data-action=accepter]');
        if (!x) return null;
        const q = x.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      });
      if (p) {
        const t0 = await page.evaluate(() => performance.now());
        await page.mouse.click(p.x, p.y);
        await attendre(120);
        const tuile = await page.evaluate(() => {
          const a = __c.articlePlein();
          const x = [...(a?.querySelectorAll('.tuile-doublon.a_ecarter') ?? [])].find((e) => __c.vu(e)) ?? null;
          if (!x) return null;
          const q = x.getBoundingClientRect();
          return { cle: a.dataset.cle, x: q.left + q.width / 2, y: q.top + Math.min(q.height / 2, 40), etats: [...a.querySelectorAll('.bande-etat')].map((e) => `${e.dataset.sort}:${e.dataset.origine}:${e.hasAttribute('data-decide')}`).join('|') };
        });
        if (!tuile) signalements.push(`${S} ${ici} : clic sur une photo dans les 0,5 s : aucune photo à écarter visible dans le groupe suivant`);
        else {
          await page.mouse.click(tuile.x, tuile.y);
          const t1 = await page.evaluate(() => performance.now());
          await attendre(700);
          const etats = await page.evaluate((c) => [...(document.querySelector(`article.carte-doublons[data-cle="${CSS.escape(c)}"]`)?.querySelectorAll('.bande-etat') ?? [])].map((e) => `${e.dataset.sort}:${e.dataset.origine}:${e.hasAttribute('data-decide')}`).join('|'), tuile.cle);
          if (t1 - t0 >= 500) signalements.push(`${S} ${ici} : le second clic est venu ${Math.round(t1 - t0)} ms après « Accepter » (essai non concluant)`);
          else if (etats !== tuile.etats) faute(S, `${ici} : un clic sur une photo du groupe suivant ${Math.round(t1 - t0)} ms après « Accepter » a changé son choix`);
          console.log(`  ${ici} clic sur une photo ${Math.round(t1 - t0)} ms après « Accepter » : ${etats === tuile.etats ? 'rien de choisi' : 'CHOISIE'}`);
        }
      }
      // Tout défaire : la suite des essais part du même état.
      await page.evaluate(() => document.activeElement?.blur?.());
      for (let k = 0; k < 20 && (await nAccS()) < depart; k++) {
        await page.keyboard.press('Control+z');
        await attendre(250);
      }
      if ((await nAccS()) !== depart) faute(S, `${ici} : Ctrl+Z n’a pas tout défait (${await nAccS()} groupes à accepter, ${depart} au départ)`);
    }
    await taille(1440, 900);
  }

  // ---- Tour 3 du lot 4 : après « Accepter », le focus va sur la photo gardée du groupe suivant, jamais sur son plein
  //      (→ puis Espace choisit une photo, n'accepte rien ; usage B1) ; Ctrl+Z rend le plein au groupe rouvert et le
  //      montre au même y qu'à l'arrivée, A l'accepte de nouveau (usage M1, novice M-T3-1) ; un double-clic sur
  //      « Tout garder » n'accepte qu'un groupe (critique T1). Aux 3 tailles ; tout est défait ensuite. ----
  pagesFaites.push('doublons-focus-annuler');
  {
    const F = 'doublons-focus-annuler';
    const nA = () => page.evaluate(() => __c.nAccepter());
    const etat = () =>
      page.evaluate(() => {
        const a = __c.articlePlein();
        const act = document.activeElement;
        const zone = document.querySelector('.contenu-doublons');
        const zr = zone.getBoundingClientRect();
        const tete = document.querySelector('.tete-table')?.getBoundingClientRect();
        const haut = Math.max(zr.top, 0, tete ? tete.bottom : 0);
        const t = a?.querySelector(':scope > header')?.getBoundingClientRect();
        const z = a ? __c.zoneDe(a) : null;
        return {
          cle: a?.dataset.cle ?? null,
          y: a ? Math.round(a.getBoundingClientRect().top) : null,
          attendu: Math.round(haut + (parseFloat(getComputedStyle(zone).paddingTop) || 0)),
          colle: !!t && !!a && a.getBoundingClientRect().top < t.top - 1 && t.top <= haut + 1,
          fin: !!z && z.scrollTop + z.clientHeight >= z.scrollHeight - 2,
          pleinVu: !!a && __c.vu(a.querySelector('[data-action=accepter]')),
          focusTuile: !!act?.classList.contains('tuile-doublon'),
          focusPlein: !!act?.matches('[data-action=accepter]'),
          focusCle: act?.closest('.carte-doublons')?.dataset.cle ?? null,
          focusGardee: act?.getAttribute('aria-pressed') === 'true',
          misDeCote: __c.norm(document.querySelectorAll('.onglet-doublons')[3]?.textContent),
        };
      });
    for (const [w, h] of TAILLES.slice(0, 3)) {
      await taille(w, h);
      const ici = `${w}×${h}`;
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.evaluate(() => __c.remonter());
      await attendre(800);
      const depart = await nA();
      // 1. Clic sur une photo du groupe du plein, A, →, Espace : un seul groupe accepté, une photo du suivant choisie.
      const cle0 = await page.evaluate(() => __c.clePlein());
      if (!cle0) {
        signalements.push(`${F} ${ici} : aucun groupe à accepter`);
        continue;
      }
      await page.locator(`article.carte-doublons[data-cle="${cle0}"] .tuile-doublon.a_ecarter`).first().click();
      await attendre(600);
      await page.keyboard.press('a');
      await attendre(800);
      const e1 = await etat();
      if (!e1.focusTuile || e1.focusCle !== e1.cle || !e1.focusGardee) faute(F, `${ici} : après A, le focus n’est pas sur la photo gardée du groupe suivant (${e1.focusPlein ? 'sur son plein' : `sur ${e1.focusCle ?? 'rien'}`})`);
      const n1 = await nA();
      await page.keyboard.press('ArrowRight');
      await attendre(300);
      const e2 = await etat();
      await page.keyboard.press(' ');
      await attendre(700);
      const n2 = await nA();
      const e3 = await etat();
      if (n2 !== n1) faute(F, `${ici} : A, →, Espace : Espace a accepté le groupe suivant (« Mis de côté » ${e1.misDeCote} → ${e3.misDeCote})`);
      if (!e2.focusTuile || e2.focusCle !== e1.cle) faute(F, `${ici} : A puis → : le focus ne passe pas à une photo du groupe suivant`);
      console.log(`\n[${temps()}] ${F} ${ici} : clic, A → focus ${e1.focusTuile ? 'photo gardée' : e1.focusPlein ? 'PLEIN' : '?'} ; → puis Espace : ${n1 - n2} accepté(s) (« ${e1.misDeCote} » → « ${e3.misDeCote} »)`);
      // Même chose après un clic sur « Accepter » à la souris.
      await attendre(600);
      const p = await page.evaluate(() => {
        const x = __c.articlePlein()?.querySelector('[data-action=accepter]');
        if (!x) return null;
        const q = x.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      });
      if (p) {
        await page.mouse.click(p.x, p.y);
        await attendre(800);
        const m1 = await nA();
        const f = await etat();
        await page.keyboard.press('ArrowRight');
        await attendre(300);
        await page.keyboard.press(' ');
        await attendre(700);
        const m2 = await nA();
        if (f.focusPlein) faute(F, `${ici} : après un clic sur « Accepter », le focus est sur le plein du groupe suivant`);
        if (m2 !== m1) faute(F, `${ici} : clic sur « Accepter », →, Espace : Espace a accepté le groupe suivant`);
        console.log(`  ${ici} clic « Accepter » → focus ${f.focusTuile ? 'photo' : f.focusPlein ? 'PLEIN' : 'ailleurs'} ; → Espace : ${m1 - m2} accepté(s)`);
      }
      // 2. A, puis Ctrl+Z : le groupe rouvert reprend le plein, en haut de la zone ; A l'accepte de nouveau.
      await attendre(600);
      const c0 = await page.evaluate(() => __c.clePlein());
      await page.keyboard.press('a');
      await attendre(800);
      await page.keyboard.press('Control+z');
      await attendre(800);
      const z = await etat();
      if (z.cle !== c0) faute(F, `${ici} : après A puis Ctrl+Z, le plein n’est pas sur le groupe rouvert (${z.cle}, ${c0} attendu)`);
      else {
        if (!z.pleinVu) faute(F, `${ici} : après Ctrl+Z, le plein du groupe rouvert n’est pas visible`);
        if (!z.fin && !z.colle && Math.abs(z.y - z.attendu) > 1) faute(F, `${ici} : après Ctrl+Z, le groupe rouvert n’est pas en haut de la zone (y ${z.y}, ${z.attendu} attendu)`);
      }
      await attendre(600);
      await page.keyboard.press('a');
      await attendre(800);
      const reaccepte = await page.evaluate((c) => __c.estAccepte(c), c0);
      if (!reaccepte) faute(F, `${ici} : A après Ctrl+Z n’accepte pas le groupe rouvert`);
      console.log(`  ${ici} A, Ctrl+Z : plein sur ${z.cle === c0 ? 'le groupe rouvert' : 'UN AUTRE GROUPE'}, y ${z.y} (${z.attendu} attendu${z.colle ? ', en-tête collé' : ''}) ; A ${reaccepte ? 'le réaccepte' : 'NE LE RÉACCEPTE PAS'}`);
      // 3. « Tout garder » est devenu « choisir : toutes » (É14 e) : la case cochée, un double-clic sur « toutes » du
      //    groupe du plein choisit toutes ses photos et n'accepte aucun groupe ; on décoche la case ensuite.
      await attendre(800);
      const cleToutes = await page.evaluate(() => {
        const a = __c.articlePlein();
        const c = a?.querySelector(':scope > footer .plusieurs-photos input[type=checkbox]');
        if (!c) return null;
        if (!c.checked) c.click();
        return a.dataset.cle;
      });
      await attendre(300);
      const tg = cleToutes
        ? await page.evaluate((cle) => {
            const b = document.querySelector(`article.carte-doublons[data-cle="${CSS.escape(cle)}"] [data-action=toutes]`);
            if (!b) return null;
            if (!__c.vu(b)) b.scrollIntoView({ block: 'center' });
            if (!__c.vu(b)) return null;
            const q = b.getBoundingClientRect();
            return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
          }, cleToutes)
        : null;
      if (!tg) signalements.push(`${F} ${ici} : « toutes » du groupe du plein pas visible, double-clic non essayé`);
      else {
        const d0 = await nA();
        await page.mouse.dblclick(tg.x, tg.y);
        await attendre(900);
        const d1 = await nA();
        const reste = await page.evaluate((cle) => document.querySelectorAll(`article.carte-doublons[data-cle="${CSS.escape(cle)}"] .tuile-doublon.a_ecarter`).length, cleToutes);
        if (d0 !== d1) faute(F, `${ici} : double-clic sur « toutes » : ${d0 - d1} groupe(s) accepté(s) (aucun attendu)`);
        if (reste) faute(F, `${ici} : double-clic sur « toutes » : ${reste} photo(s) encore « À écarter »`);
        // « toutes » fixe tout le groupe « par vous » (punaise, plein), même la photo que la proposition gardait (31.10).
        const badgesToutes = await page.evaluate((cle) => [...document.querySelectorAll(`article.carte-doublons[data-cle="${CSS.escape(cle)}"] .badge-photo`)].map((b) => `${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`), cleToutes);
        if (!badgesToutes.length || badgesToutes.some((b) => b !== 'vous:plein')) faute(F, `${ici} : « toutes » : chaque photo du groupe « par vous » en plein attendue (${badgesToutes.join(', ')})`);
        console.log(`  ${ici} double-clic sur « toutes » : ${d0 - d1} groupe(s) accepté(s), ${reste} photo(s) à écarter`);
        // Un seul geste : un Ctrl+Z rend les bandes d'avant « toutes » (validation du 31.10).
        const lireToutes = () => page.evaluate((cle) => [...document.querySelectorAll(`article.carte-doublons[data-cle="${CSS.escape(cle)}"] .badge-photo`)].map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`).join('|'), cleToutes);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Control+z');
        await attendre(400);
        const apresZ = await lireToutes();
        if (/vous:plein/.test(apresZ) && apresZ.split('|').every((b) => b.endsWith('vous:plein'))) faute(F, `${ici} : Ctrl+Z après le double-clic sur « toutes » : le groupe reste « par vous » (${apresZ})`);
        console.log(`  ${ici} Ctrl+Z après « toutes » : ${apresZ}`);
      }
      if (cleToutes)
        await page.evaluate((cle) => {
          const c = document.querySelector(`article.carte-doublons[data-cle="${CSS.escape(cle)}"] .plusieurs-photos input[type=checkbox]`);
          if (c?.checked) c.click();
        }, cleToutes);
      // Tout défaire.
      await page.evaluate(() => document.activeElement?.blur?.());
      for (let k = 0; k < 20 && (await nA()) < depart; k++) {
        await page.keyboard.press('Control+z');
        await attendre(250);
      }
      // Le clic du début sur une photo (le seul geste qui reste, avant le premier A) : défait aussi.
      if (/^Annuler : choisir/.test(await page.evaluate(() => __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent)))) {
        await page.keyboard.press('Control+z');
        await attendre(250);
      }
      if ((await nA()) !== depart) faute(F, `${ici} : Ctrl+Z n’a pas tout défait (${await nA()} groupes à accepter, ${depart} au départ)`);
      if (w === 1280) await capture(`doublons-focus-annuler_${w}x${h}`);
    }
    await taille(1440, 900);
  }

  // ---- Gestes (Doublons) : le plein suit le dernier geste, la garde de 0,5 s ----
  pagesFaites.push('doublons-gestes');
  console.log(`\n[${temps()}] doublons-gestes (pilote)`);
  const G = 'doublons-gestes';
  const nAcc = () => page.evaluate(() => __c.nAccepter());
  const clePlein = () => page.evaluate(() => __c.clePlein());
  /** Un clic dans un autre groupe que celui du plein : il prend le plein sans défilement ; A l'accepte. */
  const clicPuisA = async (ici) => {
    await page.evaluate(() => __c.remonter());
    await attendre(300);
    let p = null;
    for (let k = 0; k < 32 && !p; k++) {
      p = await page.evaluate(() => __c.pointAutreGroupe());
      if (!p && k < 16)
        // Le premier autre groupe (les groupes acceptés restent repliés au-dessus) : son haut, puis plus bas.
        await page.evaluate((k) => {
          const plein = __c.articlePlein();
          const a = __c.articles().find((x) => x !== plein);
          if (!a) return;
          const z = __c.zoneDe(a);
          const haut = z === document.scrollingElement ? 0 : z.getBoundingClientRect().top;
          // Son en-tête juste sous le haut de la zone, pas encore collé (un collé n'est pas « un autre groupe à l'écran »).
          z.scrollTop += a.getBoundingClientRect().top - haut - 90 + k * 25;
        }, k);
      else if (!p)
        // Sinon, un autre groupe : son en-tête amené en bas de la zone, au-dessus de la barre du bas, puis 30 px plus
        // haut à chaque essai ; d'abord les groupes qui suivent le plein, puis ceux d'avant. Sous 700 px de haut, un
        // groupe peut être presque aussi haut que la zone : un autre en-tête ne se voit alors qu'en bas, sous le groupe
        // du plein ; amené en haut, ce groupe prend le plein (il suit le défilement) et son en-tête passe pour collé
        // (tour 1 des retours du 29.10 : à 1280×580, la première recherche ne trouvait plus que par hasard).
        await page.evaluate((k) => {
          const plein = __c.articlePlein();
          const arts = __c.articles();
          const i = arts.indexOf(plein);
          const autres = [...arts.slice(i + 1), ...arts.slice(0, Math.max(i, 0)).reverse()];
          const a = autres[Math.floor(k / 4)] ?? autres[0];
          if (!a) return;
          const z = __c.zoneDe(a);
          const { bas } = __c.basColles(z);
          const h = a.querySelector(':scope > header') ?? a;
          z.scrollTop += h.getBoundingClientRect().bottom - (bas - 8 - (k % 4) * 30);
        }, k - 16);
      await attendre(250);
    }
    if (!p) return faute(G, `${ici} : aucun autre groupe cliquable à l’écran`);
    await page.mouse.click(p.x, p.y);
    await attendre(300);
    const apres = await page.evaluate((cle) => {
      const a = document.querySelector(`.carte-doublons[data-cle="${CSS.escape(cle)}"]`);
      return { plein: __c.clePlein(), zone: __c.zoneDe(a).scrollTop, cadre: __c.cadreJaune().length };
    }, p.cle);
    if (apres.plein !== p.cle) faute(G, `${ici} : clic dans un autre groupe : il ne prend pas le plein`);
    if (Math.abs(apres.zone - p.zone) > 2) faute(G, `${ici} : le clic a fait défiler la liste (${p.zone} → ${apres.zone})`);
    if (apres.cadre) faute(G, `${ici} : le clic à la souris allume le cadre jaune et noir`);
    const n0 = await nAcc();
    await attendre(600);
    await page.keyboard.press('a');
    await attendre(700);
    const n1 = await nAcc();
    const acceptes = await page.evaluate(([c, d]) => ({ clique: __c.estAccepte(c), ancien: d ? __c.estAccepte(d) : false }), [p.cle, p.plein]);
    if (!acceptes.clique || n0 - n1 !== 1) faute(G, `${ici} : A après le clic n’accepte pas le groupe cliqué (${n0 - n1} groupe(s) accepté(s)${acceptes.ancien ? ', dont celui qui avait le plein' : ''})`);
    console.log(`  ${ici} clic puis A : plein ${apres.plein === p.cle ? 'sur le groupe cliqué' : 'resté ailleurs'}, ${n0 - n1} accepté(s)`);
  };
  /** Fermer Comparer après « Groupe suivant » : le groupe regardé prend le plein. */
  const retourComparer = async (ici) => {
    await page.evaluate(() => __c.remonter());
    await attendre(800);
    const p = await clePlein();
    const loc = p ? page.locator(`article.carte-doublons[data-cle="${p}"] [data-action=comparer]`) : page.locator('article.carte-doublons [data-action=comparer]').first();
    await loc.click();
    await page.locator('.comparateur').waitFor();
    await attendre(400);
    await page.keyboard.press('ArrowRight');
    await attendre(400);
    const pos = await page.evaluate(() => __c.norm(document.querySelector('.comparateur .position-groupe')?.textContent).match(/(\d+)\D+(\d+)/)?.[1]);
    await page.keyboard.press('Escape');
    await page.locator('.comparateur').waitFor({ state: 'detached' });
    await attendre(800);
    const r = await page.evaluate((k) => {
      // Avec « À accepter », Comparer compte les groupes encore à accepter (les acceptés restent repliés).
      const c = __c.cartes().filter((x) => !x.classList.contains('repliee'))[Number(k) - 1];
      const h = c?.querySelector(':scope > header') ?? c;
      return { attendu: c?.dataset.cle ?? null, plein: __c.clePlein(), vu: !!h && __c.vu(h) };
    }, pos ?? 0);
    if (!r.attendu || r.plein !== r.attendu) faute(G, `${ici} : après Comparer (groupe ${pos}), le plein n’est pas sur le dernier groupe regardé`);
    else if (!r.vu) faute(G, `${ici} : après Comparer, le dernier groupe regardé n’est pas à l’écran`);
    console.log(`  ${ici} fermer Comparer sur le groupe ${pos} : plein ${r.plein === r.attendu ? 'sur ce groupe' : 'ailleurs'}`);
  };
  {
    await page.locator('.outils-doublons [role=radio]').nth(0).click();
    await attendre(400);
    for (const [w, h] of TAILLES.slice(0, 3)) {
      await taille(w, h);
      const ici = `${w}×${h}`;
      await clicPuisA(ici);
      if (w !== 1440) {
        await retourComparer(ici);
        continue;
      }
      // Double-clic sur le plein : un seul groupe accepté.
      await page.evaluate(() => __c.remonter());
      await attendre(800);
      let p = await clePlein();
      let n0 = await nAcc();
      const b = await page.evaluate(() => {
        const x = __c.articlePlein()?.querySelector('[data-action=accepter]');
        if (!x) return null;
        x.scrollIntoView({ block: 'center' });
        const q = x.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      });
      if (!b) faute(G, `${ici} : double-clic : aucun plein à cliquer`);
      else {
        await attendre(500);
        const b2 = await page.evaluate(() => {
          const q = __c.articlePlein().querySelector('[data-action=accepter]').getBoundingClientRect();
          return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
        });
        await page.mouse.dblclick(b2.x, b2.y);
        await attendre(900);
        const n1 = await nAcc();
        if (n0 - n1 !== 1 || !(await page.evaluate((c) => __c.estAccepte(c), p))) faute(G, `${ici} : double-clic sur le plein : ${n0 - n1} groupe(s) accepté(s), 1 attendu (celui du plein)`);
        console.log(`  ${ici} double-clic sur le plein : ${n0 - n1} accepté(s)`);
      }
      // A deux fois en 150 ms : un seul groupe accepté.
      await attendre(800);
      p = await clePlein();
      n0 = await nAcc();
      await page.keyboard.press('a');
      await attendre(150);
      await page.keyboard.press('a');
      await attendre(900);
      let n1 = await nAcc();
      if (n0 - n1 !== 1 || !(p && (await page.evaluate((c) => __c.estAccepte(c), p)))) faute(G, `${ici} : A deux fois en 150 ms : ${n0 - n1} groupe(s) accepté(s), 1 attendu (celui du plein)`);
      console.log(`  ${ici} A, A : ${n0 - n1} accepté(s)`);
      // A gardée enfoncée (touche répétée) : un seul groupe accepté.
      await attendre(800);
      n0 = await nAcc();
      // Gardée 1,2 s, plus longtemps que la garde de 0,5 s : seul le premier appui compte (e.repeat).
      await page.keyboard.down('a');
      for (let i = 0; i < 10; i++) {
        await attendre(120);
        await page.keyboard.down('a');
      }
      await page.keyboard.up('a');
      await attendre(900);
      n1 = await nAcc();
      if (n0 - n1 !== 1) faute(G, `${ici} : A gardée enfoncée 1,2 s : ${n0 - n1} groupe(s) accepté(s), 1 attendu`);
      console.log(`  ${ici} A gardée 1,2 s : ${n0 - n1} accepté(s)`);
      // Entrée gardée enfoncée 1,2 s sur le plein (le focus le suit) : un seul groupe accepté.
      await attendre(800);
      n0 = await nAcc();
      await page.evaluate(() => __c.articlePlein()?.querySelector('[data-action=accepter]')?.focus());
      await page.keyboard.down('Enter');
      for (let i = 0; i < 10; i++) {
        await attendre(120);
        await page.keyboard.down('Enter');
      }
      await page.keyboard.up('Enter');
      await attendre(900);
      n1 = await nAcc();
      if (n0 - n1 !== 1) faute(G, `${ici} : Entrée gardée enfoncée 1,2 s sur le plein : ${n0 - n1} groupe(s) accepté(s), 1 attendu`);
      console.log(`  ${ici} Entrée gardée 1,2 s : ${n0 - n1} accepté(s)`);
      await page.evaluate(() => document.activeElement?.blur?.());
      // Un champ garde son focus pendant la molette, et « a » n'y accepte rien : « Chercher » n'existe qu'en
      // groupant par dossier (tour 1 du lot 4 : l'essai ne se rabat plus sur un bouton).
      const journee = await page.evaluate(() => document.querySelector('.section-doublons.choisie')?.getAttribute('title') ?? null);
      await page.locator('.outils-doublons').getByRole('radio', { name: 'Dossier', exact: true }).click();
      await attendre(500);
      await page.evaluate(() => __c.remonter());
      await attendre(300);
      const champ = page.locator('.recherche-sections');
      if (!(await champ.count()) || !(await champ.isVisible())) faute(G, `${ici} : pas de champ « Chercher » en groupant par dossier`);
      if ((await champ.count()) && (await champ.isVisible())) {
        await champ.click();
        const z = await page.evaluate(() => {
          const q = __c.articles()[0].getBoundingClientRect();
          return { x: q.left + q.width / 2, y: Math.max(q.top, 0) + 60 };
        });
        await page.mouse.move(z.x, z.y);
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 120);
          await attendre(150);
        }
        await attendre(500);
        const garde = await page.evaluate(() => document.activeElement?.classList.contains('recherche-sections'));
        if (!garde) faute(G, `${ici} : la molette a pris le focus du champ « Chercher »`);
        n0 = await nAcc();
        await page.keyboard.type('a');
        await attendre(500);
        n1 = await nAcc();
        if (n0 !== n1) faute(G, `${ici} : « a » tapé dans « Chercher » a accepté ${n0 - n1} groupe(s)`);
        await champ.fill('');
        await page.evaluate(() => document.activeElement?.blur?.());
        console.log(`  ${ici} champ « Chercher » et molette : focus ${garde ? 'gardé' : 'perdu'}, « a » tapé : ${n0 - n1} accepté(s)`);
      }
      await page.locator('.outils-doublons').getByRole('radio', { name: 'Journée', exact: true }).click();
      await attendre(500);
      if (journee) {
        await page.evaluate((j) => [...document.querySelectorAll('.section-doublons')].find((b) => b.getAttribute('title') === j)?.click(), journee);
        await attendre(400);
      }
      {
        // Sans champ (journées sans dossier) : un bouton hors de la table (Aide) garde son focus pendant la molette.
        await page.evaluate(() => __c.aide()?.focus());
        const z = await page.evaluate(() => {
          const q = __c.articles()[0].getBoundingClientRect();
          return { x: q.left + q.width / 2, y: Math.max(q.top, 0) + 60 };
        });
        await page.mouse.move(z.x, z.y);
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 120);
          await attendre(150);
        }
        await attendre(500);
        const garde = await page.evaluate(() => document.activeElement === __c.aide());
        if (!garde) faute(G, `${ici} : la molette a pris le focus du bouton « Aide » (hors de la table)`);
        await page.evaluate(() => document.activeElement?.blur?.());
        console.log(`  ${ici} bouton hors de la table et molette : focus ${garde ? 'gardé' : 'perdu'}`);
      }
      // Après la molette, le plein suit, sans cadre jaune ; ce qu'il garde se voit ou se lit.
      {
        const z = await page.evaluate(() => {
          const q = __c.articles()[0].getBoundingClientRect();
          return { x: q.left + q.width / 2, y: Math.max(q.top, 0) + 60 };
        });
        await page.mouse.move(z.x, z.y);
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, 150);
          await attendre(200);
        }
        await attendre(600);
        const r = await page.evaluate(() => ({ g: __c.gardee('rafales'), cadre: __c.cadreJaune(), plein: __c.pleins().filter((x) => __c.vu(x)).length }));
        if (!r.g || (!r.g.nomme && !r.g.bande)) faute(G, `${ici} : après la molette, ce que le plein garde ne se voit ni ne se lit`);
        if (r.plein !== 1) faute(G, `${ici} : après la molette, ${r.plein} plein(s) entier(s)`);
        if (r.cadre.length) faute(G, `${ici} : après la molette, le cadre jaune et noir est allumé (${r.cadre[0]})`);
      }
      // Tab vers un autre groupe : il prend le plein, et le focus n'est pas caché sous un en-tête collé.
      {
        await attendre(600);
        const t = await page.evaluate(() => {
          const a = __c.articlePlein();
          if (!a) return null;
          // Le dernier élément du groupe qui prend le focus, hors « Journée suivante » (qui mène ailleurs).
          const f = [...a.querySelectorAll('button, input, [tabindex]')].filter((x) => __c.affiche(x) && !x.disabled && !x.matches('[data-action=journee-suivante]'));
          f.at(-1)?.focus({ preventScroll: true });
          return a.nextElementSibling ? a.dataset.cle : null;
        });
        if (!t) signalements.push(`${ici} : Tab vers un autre groupe : le groupe du plein est le dernier, rien à essayer`);
        if (t) {
          await page.keyboard.press('Tab');
          await attendre(400);
          const r = await page.evaluate(() => {
            const f = document.activeElement;
            const a = f?.closest('article.carte-doublons');
            const q = f?.getBoundingClientRect();
            const d = q ? document.elementFromPoint(q.left + q.width / 2, q.top + Math.min(q.height / 2, 12)) : null;
            return { cle: a?.dataset.cle ?? null, plein: __c.clePlein(), cache: !!q && !(d && (d === f || f.contains(d))) };
          });
          if (!r.cle) faute(G, `${ici} : Tab depuis le dernier bouton d’un groupe : le focus a quitté la table`);
          else if (r.cle === t) faute(G, `${ici} : Tab depuis le dernier bouton d’un groupe : le focus reste dans ce groupe`);
          else if (r.plein !== r.cle) faute(G, `${ici} : Tab vers un autre groupe : il ne prend pas le plein`);
          if (r.cle && r.cache) faute(G, `${ici} : après Tab, le focus est caché (sous un en-tête collé ?)`);
          // Puis A : c'est ce groupe-là qui est accepté (§ 1.7).
          if (r.cle && r.cle !== t) {
            const nA = await nAcc();
            await attendre(600);
            await page.keyboard.press('a');
            await attendre(700);
            const ok = await page.evaluate((c) => __c.estAccepte(c), r.cle);
            if (!ok || nA - (await nAcc()) !== 1) faute(G, `${ici} : Tab puis A n’accepte pas le groupe qui a reçu le focus`);
            console.log(`  ${ici} Tab puis A : ${ok ? 'le groupe du focus est accepté' : 'AUTRE GROUPE'}`);
          }
          await page.evaluate(() => document.activeElement?.blur?.());
        }
      }
      await retourComparer(ici);
    }
    await taille(1440, 900);
  }

  // ---- É14 (retours du 29.10, étape 2d) : plus de menu de portée ; la fenêtre qui chiffre ; « Accepter → » sur le
  //      dernier groupe d'une journée ouvre la suivante ; les bandes (clic, second clic, garde, double-clic, Ctrl+Z) ;
  //      l'infobulle du curseur au palier. Tout est défait ensuite. ----
  pagesFaites.push('doublons-e14');
  {
    const E = 'doublons-e14';
    console.log(`\n[${temps()}] ${E}`);
    await page.locator('.outils-doublons [role=radio]').nth(2).click(); // « Tous »
    await attendre(400);
    // 1. Plus aucun menu de portée, ni « Autres choix », ni liste déroulante ou réglage replié dans la liste de gauche.
    {
      const r = await page.evaluate(() => ({
        menus: [...document.querySelectorAll('.page-doublons [aria-haspopup=true]:not([data-action=menu-liste])')].map((x) => __c.nom(x)),
        listes: document.querySelectorAll('.outils-doublons select, .outils-doublons details').length,
        autres: [...document.querySelectorAll('.page-doublons button')].filter((x) => /^(Autres choix|Tout garder|Tout écarter)$/.test(__c.norm(x.textContent))).length,
      }));
      if (r.menus.length || r.listes || r.autres) faute(E, `menus de portée (${r.menus.join(', ') || 'aucun'}), ${r.listes} liste(s) déroulante(s), ${r.autres} « Tout garder / Tout écarter / Autres choix »`);
    }
    // 2. La fenêtre qui chiffre : « Accepter les N groupes » n'écarte rien avant son plein ; Échap ne fait rien.
    {
      const b = page.locator('[data-action=accepter-section]');
      if (!(await b.count())) faute(E, `pas de « Accepter les N groupes » dans la journée affichée (jeu d’essai changé ?)`);
      else {
        const n0 = await page.evaluate(() => __c.nAccepter());
        await b.click();
        const f = page.locator('.dialogue[role=dialog]');
        await f.waitFor();
        const texte = (await f.innerText()).replace(/\s+/g, ' ').trim();
        const n1 = await page.evaluate(() => __c.nAccepter());
        await page.keyboard.press('Escape');
        await f.waitFor({ state: 'detached' });
        await attendre(300);
        const n2 = await page.evaluate(() => __c.nAccepter());
        if (n1 !== n0 || n2 !== n0) faute(E, `fenêtre « Accepter les N groupes » : ${n0 - n1} accepté(s) avant le plein, ${n0 - n2} après Échap (aucun attendu)`);
        if (!/photos? (sera|seront) écartées?|Aucune photo ne sera écartée/.test(texte) || !/Ne rien faire/.test(texte)) faute(E, `fenêtre « Accepter les N groupes » : elle ne chiffre pas (« ${texte.slice(0, 120)} »)`);
        console.log(`  fenêtre de la journée : « ${texte.slice(0, 110)}… » ; Échap : ${n0 - n2} accepté(s)`);
      }
    }
    // 3. Dernier groupe à accepter d'une journée : « · puis … » dans la ligne grise, A ouvre la journée suivante, son
    //    premier groupe sous les têtes collées ; Ctrl+Z défait l'acceptation et ramène dans la journée quittée, où le
    //    groupe rouvert prend le plein (A le vise).
    {
      const journee = await page.evaluate(() => document.querySelector('.section-doublons.choisie')?.getAttribute('title') ?? null);
      const une = await page.evaluate(() => [...document.querySelectorAll('.section-doublons')].findIndex((b) => __c.norm(b.querySelector('.reste')?.textContent) === '1'));
      if (une < 0) faute(E, `aucune journée avec un seul groupe à accepter (jeu d’essai changé ?)`);
      else {
        await page.locator('.section-doublons').nth(une).click();
        await attendre(500);
        const avant = await page.evaluate(() => ({ titre: document.querySelector('.section-doublons.choisie')?.getAttribute('title'), cle: __c.articlePlein()?.dataset.cle, gris: __c.norm(__c.articlePlein()?.querySelector(':scope > header .dit-accepter')?.textContent) }));
        await page.evaluate(() => document.activeElement?.blur?.());
        await attendre(600);
        await page.keyboard.press('a');
        await attendre(900);
        const apres = await page.evaluate(() => ({ titre: document.querySelector('.section-doublons.choisie')?.getAttribute('title'), g: __c.gardee('rafales') }));
        if (!/ · puis /.test(avant.gris)) faute(E, `dernier groupe de « ${avant.titre} » : la ligne grise ne dit pas où mène « Accepter → » (« ${avant.gris} »)`);
        if (apres.titre === avant.titre) faute(E, `A sur le dernier groupe de « ${avant.titre} » : la journée suivante ne s’ouvre pas`);
        else if (apres.g && !apres.g.entete) faute(E, `A sur le dernier groupe de « ${avant.titre} » : le premier groupe de « ${apres.titre} » n’est pas sous les têtes collées`);
        console.log(`  dernier groupe : « ${avant.gris} » ; A : « ${avant.titre} » → « ${apres.titre} »`);
        await page.keyboard.press('Control+z');
        await attendre(500);
        const annule = await page.evaluate(() => ({ titre: document.querySelector('.section-doublons.choisie')?.getAttribute('title'), cle: __c.articlePlein()?.dataset.cle }));
        if (apres.titre !== avant.titre && annule.titre !== avant.titre) faute(E, `Ctrl+Z après « Accepter → » : la page reste sur « ${annule.titre} », le groupe rouvert de « ${avant.titre} » ne se voit pas`);
        else if (annule.cle !== avant.cle) faute(E, `Ctrl+Z après « Accepter → » : le plein est sur « ${annule.cle} », pas sur le groupe rouvert « ${avant.cle} »`);
        console.log(`  Ctrl+Z : retour à « ${annule.titre} », plein sur le groupe rouvert : ${annule.cle === avant.cle ? 'oui' : 'non'}`);
        if (journee) await page.evaluate((j) => [...document.querySelectorAll('.section-doublons')].find((b) => b.getAttribute('title') === j)?.click(), journee);
        await attendre(500);
      }
    }
    // 4. Les bandes (C-9.12) : en bordure avant « Accepter » ; un clic sur une bande « À écarter » garde la photo par
    //    vous, en plein (la photo ne se choisit pas, pas de vue en grand) ; un second clic revient à la proposition ;
    //    un double-clic ne fait qu'un geste ; Ctrl+Z défait. Aux 3 tailles.
    for (const [w, h] of TAILLES.slice(0, 3)) {
      await taille(w, h);
      const ici = `${w}×${h}`;
      await page.evaluate(() => __c.remonter());
      await attendre(600);
      const lireB = () =>
        page.evaluate(() => {
          const a = __c.articlePlein();
          return a ? [...a.querySelectorAll('.photo-doublon > .badge-photo')].map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`).join('|') : null;
        });
      const depart = await lireB();
      const cible = await page.evaluate(() => {
        const a = __c.articlePlein();
        const b = [...(a?.querySelectorAll('.photo-doublon > .badge-photo[data-sort=ecarter] .clic-badge') ?? [])].find((x) => __c.vu(x));
        if (!b) return null;
        const q = b.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2, cle: a.dataset.cle };
      });
      if (!depart || !cible) {
        faute(E, `${ici} : pas de bande « À écarter » visible dans le groupe du plein (jeu d’essai changé ?)`);
        continue;
      }
      if (/plein/.test(depart)) faute(E, `${ici} : avant « Accepter », une bande est en plein sans geste (${depart})`);
      await page.mouse.click(cible.x, cible.y);
      await attendre(300);
      const un = await page.evaluate(() => ({ b: [...(__c.articlePlein()?.querySelectorAll('.photo-doublon > .badge-photo') ?? [])].map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`).join('|'), vue: !!document.querySelector('.comparateur, .visionneuse'), focus: !!document.activeElement?.closest('.badge-photo') }));
      if (!un.b.split('|').some((x) => x === 'garder:vous:plein')) faute(E, `${ici} : clic sur une bande « À écarter » : pas de « Gardée par vous » en plein (${un.b})`);
      if (un.vue || un.focus) faute(E, `${ici} : clic sur la bande : ${un.vue ? 'une vue en grand s’ouvre' : 'la bande prend le focus'}`);
      await attendre(600);
      await page.mouse.click(cible.x, cible.y);
      await attendre(300);
      const deux = await lireB();
      if (deux !== depart) faute(E, `${ici} : second clic sur la bande : pas de retour à la proposition (${deux}, ${depart} attendu)`);
      await attendre(600);
      await page.mouse.dblclick(cible.x, cible.y);
      await attendre(700);
      const dbl = await lireB();
      const vue = await page.evaluate(() => !!document.querySelector('.comparateur, .visionneuse'));
      if (dbl === depart || vue) faute(E, `${ici} : double-clic sur la bande : ${vue ? 'une vue en grand s’ouvre' : 'aucun geste'} (un seul geste attendu)`);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Control+z');
      await attendre(400);
      const z = await lireB();
      if (z !== depart) faute(E, `${ici} : Ctrl+Z après le double-clic : ${z} (${depart} attendu : un seul geste à défaire)`);
      // Les deux gestes du début (clic, second clic) : défaits aussi.
      for (let k = 0; k < 2; k++) {
        await page.keyboard.press('Control+z');
        await attendre(300);
      }
      console.log(`  ${ici} bandes : ${depart} → clic ${un.b} → second clic ${deux === depart ? 'proposition' : deux} → double-clic ${dbl} → Ctrl+Z ${z === depart ? 'proposition' : z}`);
    }
    // 5. L'infobulle du curseur au palier : la taille vraiment montrée (les trois quarts du réglage, É14 m).
    {
      await taille(1024, 464);
      await attendre(400);
      const r = await page.evaluate(() => ({ titre: document.querySelector('.ligne-etape [data-place=taille]')?.getAttribute('title') ?? '', valeur: document.querySelector('.ligne-etape .curseur-taille')?.getAttribute('aria-valuetext') ?? '', cote: Math.round(document.querySelector('.photo-doublon .cadre-tuile')?.getBoundingClientRect().height ?? 0) }));
      if (!r.titre.includes(`${r.cote} px`) || r.valeur !== `${r.cote} px`) faute(E, `1024×464 : le curseur dit « ${r.titre} » / « ${r.valeur} », les photos font ${r.cote} px`);
      console.log(`  curseur au palier : « ${r.titre} », « ${r.valeur} » (photos de ${r.cote} px)`);
      await taille(1440, 900);
    }
    // 6. Validation du 31.10 : le plein de « Accepter les N groupes » accepte la journée en un geste ; Ctrl+Z la
    //    rouvre en entier (une acceptation de plusieurs groupes est un seul geste).
    {
      const reste = () => page.evaluate(() => Number(__c.norm(document.querySelector('.section-doublons.choisie .reste')?.textContent) || 0));
      const b = page.locator('[data-action=accepter-section]');
      if (!(await b.count()) || (await b.isDisabled())) faute(E, '« Accepter les N groupes » absent ou grisé : son plein n’est pas essayé (jeu d’essai changé ?)');
      else {
        const n = Number((await b.innerText()).match(/(\d+) groupes?/)?.[1] ?? 0);
        const r0 = await reste();
        await b.click();
        const f = page.locator('.dialogue[role=dialog]');
        await f.waitFor();
        await f.locator('button.principal').click();
        await f.waitFor({ state: 'detached' });
        await attendre(700);
        const r1 = await reste();
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Control+z');
        await attendre(700);
        const r2 = await reste();
        if (r1 !== r0 - n) faute(E, `plein de « Accepter les ${n} groupes » : ${r0} → ${r1} à accepter (${r0 - n} attendu)`);
        if (r2 !== r0) faute(E, `Ctrl+Z après « Accepter les ${n} groupes » : ${r2} à accepter (${r0} attendu, un seul geste)`);
        console.log(`  plein « Accepter les ${n} groupes » : ${r0} → ${r1} à accepter ; Ctrl+Z : ${r2}`);
      }
    }
    // 7. « Choisir avec l'IA » de la section : dans la tête, son prix écrit sur le bouton et dans son nom lu (règle d'or 5).
    {
      const r = await page.evaluate(() => {
        const b = document.querySelector('.tete-table .bouton-ia');
        return b ? { texte: __c.norm(b.textContent), nom: b.getAttribute('aria-label') ?? '' } : null;
      });
      if (!r) faute(E, '« Choisir avec l’IA » absent de la tête de la section (rafales de deux journées attendues)');
      else if (!/CHF/.test(r.texte) || !/CHF/.test(r.nom) || !/de cette journée/.test(r.nom)) faute(E, `« Choisir avec l’IA » de la section : « ${r.texte} » / nom lu « ${r.nom} » (prix et portée attendus)`);
      else console.log(`  IA de la section : « ${r.texte} » ; nom lu « ${r.nom} »`);
    }
    // 8. « Classer : Plus grands d'abord » : les groupes du plus grand au plus petit ; « Heure » remet l'ordre.
    {
      const tailles = () => page.evaluate(() => __c.articles().map((a) => a.querySelectorAll('.tuile-doublon').length));
      await page.locator('.outils-doublons [role=radio]', { hasText: 'Plus grands d’abord' }).click();
      await attendre(500);
      const t1 = await tailles();
      const ok = t1.length > 1 && t1.every((x, i) => i === 0 || t1[i - 1] >= x) && (await page.locator('.outils-doublons [role=radio]', { hasText: 'Plus grands d’abord' }).getAttribute('aria-checked')) === 'true';
      if (!ok) faute(E, `« Plus grands d’abord » : groupes de ${t1.join(', ')} photos`);
      await page.locator('.outils-doublons [role=radio]', { hasText: 'Heure' }).click();
      await attendre(500);
      console.log(`  Classer « Plus grands d’abord » : ${t1.join(', ')}`);
    }
    // 9. Comparer en grand : « choisir : toutes · aucune » ne chevauche jamais l'état du groupe (M1 du contrôle du
    //    31.10), à 1280×580 et au palier ; un clic sur la bande d'une vignette donne l'autre sort, par vous ; Ctrl+Z.
    for (const [w, h] of [[1280, 580], [1024, 464]]) {
      await taille(w, h);
      await page.evaluate(() => __c.remonter());
      await attendre(400);
      const a = page.locator('article.carte-doublons', { has: page.locator('[data-action=accepter]') }).first();
      await a.locator('[data-action=comparer]').click();
      await page.locator('.comparateur').waitFor();
      await attendre(500);
      const caseP = page.locator('.comparateur .plusieurs-photos input[type=checkbox]');
      const cochee = (await caseP.count()) && (await caseP.isChecked());
      if ((await caseP.count()) && !cochee) await caseP.check();
      await attendre(400);
      const r = await page.evaluate(() => {
        const l = document.querySelector('.comparateur .cmp-ligne');
        const els = [...(l?.querySelectorAll('.cmp-ligne-texte > *, .plusieurs-photos label, .toutes-aucune button, .rien-supprime-vue, .alerte-doublons') ?? [])].filter((e) => e.getBoundingClientRect().width > 0);
        const rects = els.map((e) => ({ n: __c.norm(e.textContent).slice(0, 24), r: e.getBoundingClientRect() }));
        const croisees = [];
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const x = rects[i].r;
            const y = rects[j].r;
            if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1 && !els[i].contains(els[j]) && !els[j].contains(els[i])) croisees.push(`« ${rects[i].n} » / « ${rects[j].n} »`);
          }
        return { n: rects.length, croisees, dehors: rects.filter((x) => x.r.right > innerWidth + 1).map((x) => x.n) };
      });
      const ici = `${w}×${h}`;
      if (!r.n) faute(E, `${ici} : Comparer sans ligne d’information`);
      if (r.croisees.length) faute(E, `${ici} : Comparer, ligne d’information : ${r.croisees.join(' ; ')} se chevauchent`);
      if (r.dehors.length) faute(E, `${ici} : Comparer, hors de la fenêtre : ${r.dehors.join(' ; ')}`);
      console.log(`  ${ici} Comparer, ligne d’information : ${r.n} éléments, ${r.croisees.length} chevauchement(s)`);
      if (!cochee && (await caseP.count())) await caseP.uncheck();
      // La bande d'une vignette : un clic donne l'autre sort, par vous (comme sous la photo) ; Ctrl+Z, sans fermer.
      const lireB = () => page.evaluate(() => [...document.querySelectorAll('.comparateur .badge-photo')].map((b) => `${b.dataset.sort}:${b.dataset.origine}:${b.hasAttribute('data-decide') ? 'plein' : 'bord'}`).join('|'));
      const b0 = await lireB();
      const clic = page.locator('.comparateur .badge-photo[data-sort=ecarter] .clic-badge').first();
      if (!(await clic.count())) faute(E, `${ici} : Comparer, aucune bande « À écarter » à cliquer`);
      else {
        await clic.click();
        await attendre(400);
        const b1 = await lireB();
        await page.keyboard.press('Control+z');
        await attendre(500);
        const b2 = await lireB();
        if (!b1.split('|').includes('garder:vous:plein')) faute(E, `${ici} : Comparer, clic sur la bande : pas de « Gardée par vous » (${b0} → ${b1})`);
        if (b2 !== b0 || !(await page.locator('.comparateur').count())) faute(E, `${ici} : Comparer, Ctrl+Z après le clic sur la bande : ${b2} (${b0} attendu, sans fermer)`);
        console.log(`  ${ici} Comparer, bande : ${b0} → ${b1} → Ctrl+Z ${b2 === b0 ? 'comme avant' : b2}`);
      }
      await page.keyboard.press('Escape');
      await page.locator('.comparateur').waitFor({ state: 'detached' });
    }
    await taille(1440, 900);
  }

  // ---- Onglet « Mis de côté » (essai reporté du lot 3) : une bande sous chaque photo, rien sur l'image ----
  pagesFaites.push('doublons-mis-de-cote');
  {
    await onglet(3);
    // Un plein mène au prochain onglet qui reste à accepter (É1, tour 1 du lot 4).
    {
      const r = await page.evaluate(() => ({ suite: __c.norm(document.querySelector('[data-action=onglet-suivant]')?.textContent), pleins: __c.pleins().filter((x) => __c.vu(x)).map((x) => __c.nom(x)) }));
      if (r.pleins.length !== 1 || !/à accepter/.test(r.suite)) faute('doublons-mis-de-cote', `« Mis de côté » : ${r.pleins.length} plein(s) (« ${r.pleins.join(' ; ')} »), « Rafales : N à accepter › » attendu`);
      console.log(`\n[${temps()}] doublons-mis-de-cote : plein « ${r.suite || r.pleins[0] || 'aucun'} »`);
    }
    await page.locator('.grille-mis-de-cote').waitFor({ timeout: 10_000 }).catch(() => undefined);
    for (const [w, h] of TAILLES.slice(0, 2))
      for (const thm of THEMES) {
        await taille(w, h);
        await theme(thm);
        await attendre(250);
        const r = await page.evaluate(() => {
          const cadres = [...document.querySelectorAll('.grille-mis-de-cote .cadre-tuile')].filter((c) => {
            const b = c.getBoundingClientRect();
            return b.width > 0 && b.bottom > 0 && b.top < innerHeight;
          });
          const pb = [];
          for (const c of cadres) {
            // É14 : la bande suit le bouton de la photo, jamais dedans.
            const b = c.nextElementSibling ?? c.parentElement?.nextElementSibling;
            if (!b?.matches('.bande-etat')) pb.push('photo sans bande');
            else if (Math.abs(b.getBoundingClientRect().height - 28) > 1 || b.getBoundingClientRect().top < c.getBoundingClientRect().bottom - 1 || !__c.norm(b.textContent)) pb.push(`bande « ${__c.norm(b.textContent)} » de ${Math.round(b.getBoundingClientRect().height)} px`);
          }
          return { n: cadres.length, pb: [...new Set(pb)], marques: __c.marques() };
        });
        const ici = `${w}×${h} ${thm === 'light' ? 'clair' : 'sombre'}`;
        if (!r.n) faute('doublons-mis-de-cote', `${ici} : aucune photo dans « Mis de côté » (les gestes n’ont rien écarté ?)`);
        if (r.pb.length) faute('doublons-mis-de-cote', `${ici} : ${r.pb.join(' ; ')}`);
        if (r.marques.length) faute('doublons-mis-de-cote', `${ici} : posé sur une photo : ${r.marques.slice(0, 3).join(' ; ')}`);
        if (thm === 'light') console.log(`\n[${temps()}] doublons-mis-de-cote ${ici} : ${r.n} photos, ${r.pb.length + r.marques.length} écart(s)`);
      }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await taille(1440, 900);
    await onglet(1);
  }

  // ---- La suite du parcours (comme essai_charte.mjs), pages pas encore passées au cadre ----
  await valider('tri');
  await controlerAilleurs('tri-apercu');
  const copies = page.locator('.copies-avant-tri');
  if (await copies.count()) await copies.getByRole('button', { name: 'Les écarter ici' }).click();
  await page.locator('.ligne-ranger').getByRole('button', { name: 'Ranger les photos', exact: true }).click();
  await page.locator('.ligne-ranger.fait').waitFor({ timeout: 120_000 });
  await controlerAilleurs('tri-range');
  // Le bouton « N photos » (D112 point 9) : à chaque taille, le dépliant tient dans la ligne, sur une rangée de 3 à 8
  // vignettes, sans défilement en largeur ; le bouton est à la même place sur chaque ligne.
  {
    // Une ligne d'au moins 3 photos, pour que le minimum de 3 vignettes se vérifie (validation du 31.10 : la première
    // ligne n'en avait que 2) ; sinon la première, et le minimum devient son nombre de photos.
    const boutons = page.locator('.resultat-tri .ligne-tri:not(.voyage) .bouton-photos');
    const nombres = await boutons.evaluateAll((l) => l.map((b) => Number((b.textContent.match(/\d+/) ?? ['0'])[0])));
    const iBouton = Math.max(0, nombres.findIndex((n) => n >= 3));
    const bouton = boutons.nth(iBouton);
    const minimum = Math.min(3, nombres[iBouton] ?? 0);
    if (!(await boutons.count())) faute('tri-photos', 'aucun bouton « N photos » au tri');
    else {
      if (minimum < 3) signalements.push(`tri-photos : aucune ligne de 3 photos ou plus, minimum vérifié ${minimum}`);
      for (const [w, h] of TAILLES) {
        await taille(w, h);
        await bouton.scrollIntoViewIfNeeded();
        if ((await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click();
        await page.locator('.depliant-tri img').first().waitFor({ timeout: 10_000 }).catch(() => {});
        await attendre(300);
        const r = await page.evaluate(() => {
          const d = document.querySelector('.depliant-tri');
          const l = d?.closest('.ligne-tri');
          if (!d || !l) return null;
          const imgs = [...d.querySelectorAll('.bande-depliant img')].map((i) => i.getBoundingClientRect());
          const lr = l.getBoundingClientRect();
          const col = document.querySelector('.resultat-tri');
          const xBoutons = [...document.querySelectorAll('.resultat-tri .bouton-photos')].map((b) => Math.round(b.getBoundingClientRect().right));
          return {
            n: imgs.length,
            dehors: imgs.filter((i) => i.right > lr.right + 0.5 || i.left < lr.left - 0.5).length,
            // Une rangée : des vignettes qui se chevauchent en hauteur (une photo en hauteur et une en largeur, centrées,
            // n'ont pas le même haut : compter les hauts distincts en faisait deux rangées).
            rangees: imgs
              .slice()
              .sort((a, b) => a.top - b.top)
              .reduce((r, i) => (i.top >= r.bas - 1 ? { n: r.n + 1, bas: i.bottom } : { n: r.n, bas: Math.max(r.bas, i.bottom) }), { n: 0, bas: -Infinity }).n,
            largeur: col.scrollWidth > col.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
            memeX: new Set(xBoutons).size === 1,
          };
        });
        const ici = `${w}×${h}`;
        if (!r) faute('tri-photos', `${ici} : pas de dépliant après le clic`);
        else {
          if (r.n < Math.max(1, minimum) || r.n > 8 || r.dehors || r.rangees > 1) faute('tri-photos', `${ici} : ${r.n} vignette(s), ${r.dehors} hors de la ligne, ${r.rangees} rangée(s) (une rangée de ${Math.max(1, minimum)} à 8 attendue)`);
          if (r.largeur) faute('tri-photos', `${ici} : défilement en largeur avec le dépliant ouvert`);
          if (!r.memeX) faute('tri-photos', `${ici} : « N photos » n’est pas au même bord droit sur chaque ligne`);
          console.log(`  tri-photos ${ici} : ${r.n} vignette(s) sur ${r.rangees} rangée(s)`);
        }
      }
      await taille(1440, 900);
      await bouton.click();
    }
  }
  await page.locator('[data-action=valider]').click();
  await page.locator('.panneau-dossiers').waitFor({ timeout: 120_000 });
  await controlerAilleurs('lieux');
  await valider('petits');
  await controlerAilleurs('petits-dossiers');
  await valider('nommage');
  await controlerAilleurs('nommage');
  // Nommage (D112 point 11) : les onglets partent avec la page ; la vue en cours reste écrite dans la ligne
  // (« À nommer · N ▾ », C-4.12) quand la page défile ; l'onglet « Déjà nommés » passe les mêmes contrôles.
  for (const [w, h] of [[1280, 580], [1024, 464]]) {
    await taille(w, h);
    const defile = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 40);
    if (!defile) continue;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await attendre(300);
    const vue = await page.locator('.ligne-etape .bouton-vue').getAttribute('aria-label').catch(() => null);
    if (!vue || !/^Dossiers montrés : À nommer · \d+$/.test(vue)) faute('nommage', `${w}×${h} : après défilement, la vue en cours n’est pas écrite dans la ligne (« ${vue} »)`);
    console.log(`  nommage ${w}×${h}, après défilement : « ${vue} »`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await taille(1440, 900);
  await page.locator('.onglets-nommage [data-onglet=deja_nommes]').click();
  await controlerAilleurs('nommage-deja-nommes');
  await page.locator('.onglets-nommage [data-onglet=a_nommer]').click();
  await page.locator('[data-action=valider]').click();
  const recap = page.getByRole('dialog', { name: 'Des noms ne sont pas encore appliqués' });
  await Promise.race([recap.waitFor(), page.locator('main[data-etape=consolidation]').waitFor()]);
  if (await recap.count()) await recap.getByRole('button', { name: 'Renommer et continuer' }).click();
  await page.locator('main[data-etape=consolidation]').waitFor({ timeout: 120_000 });
  await controlerAilleurs('consolidation');

  // ---- Sélection : première visite à 1440×900 (l'Aide s'ouvre seule, choix 5) ----
  await page.locator('[data-action=valider]').click();
  await page.locator('.page-selection').waitFor({ timeout: 120_000 });
  await page.locator('.page-selection .tuile').first().waitFor({ timeout: 120_000 });
  await attendre(500);
  await controlerAide('selection-aide', 1440);
  await fermerAide();
  await controlerPilote('selection', { photos: true, liste: '.panneau-dossiers' });
  // La liste des sorties sur deux lignes (É14 l, C-7.7) : le nom en 600 sur une ligne, la période dessous, l'événement
  // du calendrier en icône (plus de ligne à part) ; à 1280 et au palier (dans le menu de la tête de la table).
  pagesFaites.push('selection-liste');
  for (const [w, h] of [TAILLES[1], TAILLES[2]]) {
    await taille(w, h);
    await attendre(400);
    const menu = page.locator('.page-selection [data-action=menu-liste]');
    const ouvrir = (await menu.count()) && (await menu.isVisible());
    if (ouvrir) {
      await menu.click();
      await attendre(300);
    }
    const r = await page.evaluate(() =>
      [...document.querySelectorAll('.page-selection .panneau-dossiers.liste-simple .ligne-dossier:not(.speciale)')]
        .filter((l) => __c.affiche(l))
        .slice(0, 6)
        .map((l) => {
          const nom = l.querySelector('.nom-dossier');
          const dates = l.querySelector('.dates-dossier');
          const qn = nom.getBoundingClientRect();
          const qd = dates?.getBoundingClientRect();
          const coupe = nom.scrollWidth > nom.clientWidth + 1 && !l.getAttribute('title');
          return { nom: __c.norm(nom.textContent), poids: getComputedStyle(nom).fontWeight, dessous: !!qd && qd.top >= qn.bottom - 1, uneLigne: qn.height <= 24, coupe, ligneEvenement: !!l.querySelector('.evenement-dossier') };
        }),
    );
    const pb = r.filter((x) => x.poids !== '600' || !x.dessous || !x.uneLigne || x.coupe || x.ligneEvenement).map((x) => `« ${x.nom} » (${x.poids}${x.dessous ? '' : ', période pas dessous'}${x.uneLigne ? '' : ', nom sur deux lignes'}${x.coupe ? ', coupé sans infobulle' : ''}${x.ligneEvenement ? ', événement sur sa ligne' : ''})`);
    if (!r.length) faute('selection-liste', `${w}×${h} : aucune sortie dans la liste`);
    if (pb.length) faute('selection-liste', `${w}×${h} : ${pb.slice(0, 3).join(' ; ')}`);
    console.log(`  selection-liste ${w}×${h} : ${r.length} sorties, ${pb.length} écart(s)`);
    if (ouvrir) {
      await page.keyboard.press('Escape');
      await attendre(300);
    }
  }
  await taille(1440, 900);
  // Tour 3 du lot 4 (choix 6 A, accessibilité N2) : à l'arrivée, le dernier geste est à une autre étape ; Ctrl+Z suit
  // le bouton de l'en-tête : il ne défait rien et le dit (« Rien à annuler ici… »).
  {
    const lireZ = () => page.evaluate(() => ({ bouton: __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent), msg: __c.norm(document.querySelector('.ligne-etape .message-entete .texte-message')?.textContent) }));
    const z0 = await lireZ();
    if (!/^Rien à annuler ici/.test(z0.bouton)) signalements.push(`selection-ctrl-z : à l’arrivée, « ${z0.bouton} » (pas de geste d’une autre étape à essayer)`);
    else {
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Control+z');
      await attendre(400);
      const z1 = await lireZ();
      if (z1.bouton !== z0.bouton || !/^Rien à annuler ici\. Votre dernier changement est à l’étape \d+/.test(z1.msg)) faute('selection-ctrl-z', `Ctrl+Z à l’arrivée (« ${z0.bouton} ») : « ${z1.msg} », bouton « ${z1.bouton} » (rien ne doit être défait, l’étape dite)`);
      console.log(`\n[${temps()}] selection-ctrl-z : « ${z0.bouton} » ; Ctrl+Z → « ${z1.msg} »`);
    }
  }
  // Une photo choisie, puis trois : la colonne de droite « N photos choisies », pas de barre noire.
  {
    const tuiles = page.locator('.page-selection .tuile');
    await tuiles.nth(1).click();
    await attendre(400);
    const lireChoix = () =>
      page.evaluate(() => {
        const barre = document.querySelector('.barre-action');
        const t = [...document.querySelectorAll('body *')].find((e) => __c.horsVue(e) && __c.affiche(e) && [...e.childNodes].some((n) => n.nodeType === 3 && /photos? choisies?/.test(n.textContent)));
        const q = t?.getBoundingClientRect();
        return { barre: !!barre && __c.affiche(barre), texte: t ? __c.norm(t.textContent) : '', droite: !!q && q.left > innerWidth * 0.55, vu: !!t && __c.vu(t) };
      });
    let r = await lireChoix();
    const nomP = 'selection-choisies';
    if (r.barre) faute(nomP, '1 photo choisie : la barre noire d’actions est encore là');
    if (!/^1 photo choisie\b/.test(r.texte) || !r.droite || !r.vu) faute(nomP, `1 photo choisie : pas de « 1 photo choisie » entier dans la colonne de droite${r.texte ? ` (« ${r.texte} »)` : ''}`);
    await tuiles.nth(2).click({ modifiers: ['Control'] });
    await tuiles.nth(3).click({ modifiers: ['Control'] });
    await attendre(400);
    r = await lireChoix();
    if (!/^3 photos choisies\b/.test(r.texte) || !r.droite) faute(nomP, `3 photos choisies : pas de « 3 photos choisies » dans la colonne de droite${r.texte ? ` (« ${r.texte} »)` : ''}`);
    await controlerPilote(nomP, { photos: true, liste: '.panneau-dossiers' });
    // Tour 1 du lot 4, au palier : Espace sur un bouton qui a le focus, c'est ce bouton qui agit ; « Annuler » de
    // l'en-tête suit chaque geste ; l'en-tête et la barre d'outils ne bougent pas d'un geste à l'autre ; la liste
    // en menu se ferme par Échap, sans vider la sélection, et rend le focus à son bouton.
    {
      await taille(1024, 464);
      await attendre(300);
      const lire = () =>
        page.evaluate(() => {
          const a = document.querySelector('.ligne-etape .bouton-annuler');
          const r = document.querySelector('.ligne-etape .bouton-retablir');
          return {
            outils: Math.round(document.querySelector('.outils-cadre').getBoundingClientRect().top),
            titre: Math.round(__c.titre().getBoundingClientRect().top),
            annuler: __c.norm(a?.textContent),
            actif: !!a && !a.disabled,
            retablir: !!r && !r.disabled,
            pas: document.querySelector('.panneau-choix .decision.pas')?.getAttribute('aria-pressed'),
            album: document.querySelector('.panneau-choix .decision.album')?.getAttribute('aria-pressed'),
            grande: document.querySelector('.panneau-choix .decision.grande')?.getAttribute('aria-pressed'),
          };
        });
      const s0 = await lire();
      await page.locator('.panneau-choix .decision.pas').focus();
      await page.keyboard.press(' ');
      await attendre(400);
      const s1 = await lire();
      if (s1.pas !== 'true' || s1.album === 'true') faute(nomP, `Espace sur « Pas pour l’album » (focus) : ${s1.album === 'true' ? 'les photos vont dans l’album' : 'rien n’est fait'}`);
      if (!s1.actif || s1.annuler === s0.annuler) faute(nomP, `après « Pas pour l’album », « Annuler » de l’en-tête reste « ${s1.annuler} »`);
      await page.locator('.panneau-choix .decision.grande').click();
      await attendre(400);
      const s2 = await lire();
      if (s2.grande !== 'true') faute(nomP, 'clic sur « Grande » : la décision n’est pas prise');
      if (s2.annuler === s1.annuler) faute(nomP, `second geste : « Annuler » de l’en-tête garde « ${s2.annuler} »`);
      for (const x of [s1, s2]) if (x.outils !== s0.outils || x.titre !== s0.titre) faute(nomP, `1024×464 : l’en-tête bouge d’un geste à l’autre (titre ${s0.titre} → ${x.titre}, barre d’outils ${s0.outils} → ${x.outils})`);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+z');
      await attendre(400);
      const s3 = await lire();
      if (!s3.retablir) faute(nomP, 'après Ctrl+Z, « Rétablir » de l’en-tête reste désactivé');
      console.log(`\n[${temps()}] ${nomP} 1024×464 : « ${s0.annuler} » → Espace « ${s1.annuler} » → Grande « ${s2.annuler} » ; titre y ${s0.titre}/${s1.titre}/${s2.titre}`);
      // La liste en menu : Échap la ferme, la sélection reste, le focus revient au bouton.
      const menu = page.locator('[data-action=menu-liste]');
      if (await menu.count()) {
        await menu.click();
        await attendre(400);
        const ouverte = await page.evaluate(() => ({ ouverte: !!document.querySelector('.page-cadre[data-liste="ouverte"]'), focus: !!document.activeElement?.closest('.colonne-liste') }));
        await page.keyboard.press('Escape');
        await attendre(300);
        const apres = await page.evaluate(() => ({ ouverte: !!document.querySelector('.page-cadre[data-liste="ouverte"]'), focus: document.activeElement?.matches('[data-action=menu-liste]'), choisies: __c.norm(document.querySelector('.panneau-choix h2')?.textContent) }));
        if (!ouverte.ouverte) faute(nomP, 'au palier, le menu de la liste ne s’ouvre pas');
        if (!ouverte.focus) faute(nomP, 'au palier, la liste ouverte ne reçoit pas le focus');
        if (apres.ouverte) faute(nomP, 'au palier, Échap ne ferme pas la liste en menu');
        if (!apres.focus) faute(nomP, 'au palier, après Échap, le focus ne revient pas au bouton de la liste');
        if (!/^3 photos choisies/.test(apres.choisies)) faute(nomP, `au palier, Échap dans la liste a vidé la sélection (« ${apres.choisies} »)`);
      }
      await taille(1440, 900);
    }
    // Tour 2 du lot 4 : un clic à la souris sur « Tourner » ou « Pas pour l'album » ne laisse pas le focus sur le
    // bouton ; Espace, ensuite, met les photos dans l'album (un seul quart de tour, pas un second).
    {
      const lireS = () =>
        page.evaluate(() => ({
          annuler: __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent),
          album: document.querySelector('.panneau-choix .decision.album')?.getAttribute('aria-pressed'),
          focusBouton: !!document.activeElement?.closest('.panneau-choix button'),
        }));
      for (const [quoi, bouton] of [
        ['Tourner', page.locator('.panneau-choix .outil-photo').filter({ hasText: /^\s*Tourner/ })],
        ['Pas pour l’album', page.locator('.panneau-choix .decision.pas')],
      ]) {
        await page.evaluate(() => document.querySelector('.page-selection .tuile')?.closest('[tabindex="0"]')?.focus());
        if ((await lireS()).album === 'true') {
          faute(nomP, `clic sur « ${quoi} » puis Espace : les photos choisies sont déjà dans l’album, rien à essayer`);
          continue;
        }
        await bouton.first().click();
        await attendre(300);
        const c = await lireS();
        await page.keyboard.press(' ');
        await attendre(400);
        const e = await lireS();
        if (c.focusBouton) faute(nomP, `clic sur « ${quoi} » : le focus reste sur le bouton`);
        if (e.album !== 'true') faute(nomP, `clic sur « ${quoi} » puis Espace : les photos ne vont pas dans l’album (« ${e.annuler} »)`);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Control+z');
        await attendre(300);
        const z1 = await lireS();
        await page.keyboard.press('Control+z');
        await attendre(300);
        const z2 = await lireS();
        if (quoi === 'Tourner' && /tourner/i.test(z2.annuler)) faute(nomP, `clic sur « Tourner » puis Espace : deux quarts de tour (« ${z1.annuler} », puis « ${z2.annuler} »)`);
        console.log(`  ${nomP} clic « ${quoi} » puis Espace : « ${e.annuler} » ; Ctrl+Z « ${z1.annuler} » ; Ctrl+Z « ${z2.annuler} »`);
      }
    }
    await page.keyboard.press('Escape');
    await attendre(300);
  }

  // ---- Recadreur, ouvert à chaque taille ----
  pagesFaites.push('recadreur');
  console.log(`\n[${temps()}] recadreur (pilote)`);
  // Une photo en largeur et une en hauteur : la photo en hauteur pousse les commandes vers le bas.
  for (const [w, h, forme] of TAILLES.flatMap(([w, h]) => [[w, h, 'paysage'], [w, h, 'portrait']])) {
    await taille(w, h);
    await page.keyboard.press('Escape');
    await page.evaluate((forme) => {
      __c.remonter();
      const tuiles = [...document.querySelectorAll('.page-selection .tuile')];
      const t =
        tuiles.find((x) => {
          const i = x.querySelector('img');
          return i && i.naturalWidth && (forme === 'portrait' ? i.naturalHeight > i.naturalWidth * 1.2 : i.naturalWidth > i.naturalHeight * 1.2);
        }) ?? tuiles[0];
      t?.click();
    }, forme);
    await attendre(400);
    const bouton = page.getByRole('button', { name: /^Recadrer/ });
    const n = await bouton.count();
    let ouvert = false;
    for (let i = 0; i < n && !ouvert; i++)
      if (await bouton.nth(i).isVisible()) {
        await bouton.nth(i).click({ timeout: 5000 }).catch(() => bouton.nth(i).evaluate((x) => x.click()));
        ouvert = true;
      }
    if (!ouvert) {
      faute('recadreur', `${w}×${h} ${forme} : pas de bouton « Recadrer… » visible pour la photo choisie`);
      continue;
    }
    if (!(await page.locator('.recadreur').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))) {
      faute('recadreur', `${w}×${h} ${forme} : le Recadreur ne s’ouvre pas`);
      continue;
    }
    await attendre(900);
    for (const thm of THEMES) {
      await theme(thm);
      await attendre(200);
      const ici = `${w}×${h} ${forme} ${thm === 'light' ? 'clair' : 'sombre'}`;
      const avant = fautes.length;
      const r = await page.evaluate(() => {
        const v = document.querySelector('.recadreur');
        const pleins = __c.pleins();
        const boutons = [...v.querySelectorAll('button')].filter((b) => __c.affiche(b));
        const texte = (b) => __c.norm(b.textContent);
        return {
          pleins: pleins.map((p) => ({ texte: texte(p), vu: __c.vu(p) })),
          annuler: boutons.filter((b) => b.matches('.bouton-annuler') || /^Annuler\b/.test(texte(b))).length,
          // « Déjà la photo entière » (désactivé, la raison dans le libellé) tant qu'il n'y a rien à remettre.
          remettre: boutons.some((b) => /(Remettre|Déjà) la photo entière/.test(texte(b))),
          remettreVu: boutons.some((b) => /(Remettre|Déjà) la photo entière/.test(texte(b)) && __c.vu(b)),
          reprendre: boutons.some((b) => /Tout reprendre/.test(texte(b))),
          quart: boutons.some((b) => b.matches('[data-action="quart-de-tour"]') || /quart de tour|^Tourner/i.test(texte(b))),
          marques: __c.marques(),
        };
      });
      const vus = r.pleins.filter((p) => p.vu);
      if (vus.length !== 1 || !/Accepter le recadrage/.test(vus[0]?.texte ?? '')) faute('recadreur', `${ici} : « Accepter le recadrage » ${r.pleins.length ? `pas entier à l’écran (${r.pleins.map((p) => `« ${p.texte} »${p.vu ? '' : ' caché'}`).join(' ; ')})` : 'absent'}`);
      if (r.annuler !== 1) faute('recadreur', `${ici} : ${r.annuler} bouton(s) « Annuler » dans le Recadreur, 1 attendu`);
      if (!r.remettre) faute('recadreur', `${ici} : pas de « Remettre la photo entière »`);
      else if (!r.remettreVu) faute('recadreur', `${ici} : « Remettre la photo entière » pas entier à l’écran`);
      if (r.reprendre) faute('recadreur', `${ici} : « Tout reprendre » est encore là`);
      if (!r.quart) faute('recadreur', `${ici} : pas de quart de tour dans le Recadreur`);
      if (r.marques.length) faute('recadreur', `${ici} : posé sur la photo : ${r.marques.slice(0, 2).join(' ; ')}`);
      console.log(`  ${fautes.length > avant ? '✗' : '✓'} ${ici} : ${fautes.length - avant} écart(s)`);
      await capture(`recadreur_${w}x${h}_${forme}_${thm}`);
    }
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    // Quart de tour tout de suite, défait par « Annuler » sans quitter la vue (à 1440).
    if (w === 1440 && forme === 'paysage') {
      const proportion = () => page.evaluate(() => {
        const c = document.querySelector('.recadreur canvas');
        const q = c?.getBoundingClientRect();
        return q ? q.width / q.height : null;
      });
      const f0 = await proportion();
      const quart = page.locator('.recadreur [data-action="quart-de-tour"], .recadreur button').filter({ hasText: /quart de tour|^Tourner/i });
      const q = (await page.locator('.recadreur [data-action="quart-de-tour"]').count()) ? page.locator('.recadreur [data-action="quart-de-tour"]').first() : quart.first();
      if (await q.count()) {
        await q.click();
        await attendre(500);
        const f1 = await proportion();
        if (!(f0 && f1 && Math.abs(f1 * f0 - 1) < 0.08) && Math.abs(f0 - 1) > 0.1) faute('recadreur', `quart de tour : la photo n’a pas tourné tout de suite (forme ${f0?.toFixed(2)} → ${f1?.toFixed(2)})`);
        const ann = page.locator('.recadreur .bouton-annuler');
        if (await ann.count()) {
          await ann.first().click();
          await attendre(500);
          const f2 = await proportion();
          if (!(await page.locator('.recadreur').count())) faute('recadreur', 'Annuler a fermé le Recadreur au lieu de défaire le quart de tour');
          else if (!(f2 && Math.abs(f2 - f0) < 0.05)) faute('recadreur', `Annuler ne défait pas le quart de tour (forme ${f0?.toFixed(2)} → ${f2?.toFixed(2)})`);
        }
      } else faute('recadreur', 'quart de tour : pas de bouton à essayer');
      // Pile mêlée (tour 1 du lot 4) : format 3:2, quart de tour, puis Ctrl+Z deux fois, puis Rétablir.
      const format = () => page.evaluate(() => __c.norm(document.querySelector('.recadreur .formats [aria-checked="true"]')?.textContent));
      const fo0 = await format();
      await page.locator('.recadreur .formats [role=radio]', { hasText: '3:2' }).click();
      await attendre(300);
      await page.locator('.recadreur [data-action="quart-de-tour"]').last().click();
      await attendre(400);
      const fq = await proportion();
      await page.keyboard.press('Control+z');
      await attendre(400);
      const fz1 = await proportion();
      await page.keyboard.press('Control+z');
      await attendre(400);
      const fo1 = await format();
      if (!(fz1 && f0 && Math.abs(fz1 - f0) < 0.05) || fq === fz1) faute('recadreur', `pile mêlée : Ctrl+Z ne défait pas d’abord le quart de tour (forme ${f0?.toFixed(2)} → ${fq?.toFixed(2)} → ${fz1?.toFixed(2)})`);
      if (fo1 !== fo0) faute('recadreur', `pile mêlée : le second Ctrl+Z ne remet pas le format (« ${fo0} » attendu, « ${fo1} »)`);
      await page.locator('.recadreur .bouton-retablir').click();
      await attendre(300);
      if ((await format()) !== '3:2') faute('recadreur', `« Rétablir » ne refait pas le format 3:2 (« ${await format()} »)`);
      console.log(`  recadreur pile mêlée : format « ${fo0} » → 3:2 → quart → Ctrl+Z ×2 « ${fo1} » → Rétablir « ${await format()} »`);
      // Entrée sur « Fermer sans recadrer » : ferme sans accepter ; un quart de tour fait reste fait.
      await page.locator('.recadreur [data-action="quart-de-tour"]').last().click();
      await attendre(300);
      await page.locator('.recadreur .fermer-recadreur').focus();
      await page.keyboard.press('Enter');
      await page.locator('.recadreur').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
      const apres = await page.evaluate(() => ({ ouvert: !!document.querySelector('.recadreur'), annuler: __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent) }));
      if (apres.ouvert) faute('recadreur', 'Entrée sur « Fermer sans recadrer » ne ferme pas la vue');
      else {
        if (/recadr/i.test(apres.annuler)) faute('recadreur', `Entrée sur « Fermer sans recadrer » a accepté le recadrage (« ${apres.annuler} »)`);
        if (!/tourner/i.test(apres.annuler)) faute('recadreur', `« Fermer sans recadrer » : le quart de tour n’est pas resté fait (« ${apres.annuler} »)`);
        console.log(`  recadreur Entrée sur « Fermer sans recadrer » : fermé, en-tête « ${apres.annuler} »`);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Control+z');
        await attendre(300);
      }
      // Tour 2 du lot 4 : rouvert, la photo entière : « Déjà la photo entière » désactivé ; clic « À droite » à la
      // souris, puis Entrée : la vue se ferme (Entrée accepte, elle ne refait pas le quart de tour).
      const rouvrir = page.getByRole('button', { name: /^Recadrer/ });
      for (let i = 0; i < (await rouvrir.count()); i++)
        if (await rouvrir.nth(i).isVisible()) {
          await rouvrir.nth(i).click();
          break;
        }
      if (await page.locator('.recadreur').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)) {
        await attendre(900);
        const rem = await page.evaluate(() => {
          const b = document.querySelector('.recadreur .remettre-entiere');
          return { texte: __c.norm(b?.textContent), inactif: !!b?.disabled };
        });
        if (!rem.inactif) faute('recadreur', `photo déjà entière : « ${rem.texte} » reste actif (un clic entrerait dans la pile sans rien faire)`);
        await page.locator('.recadreur [data-action="quart-de-tour"]').last().click();
        await attendre(400);
        const focusBouton = await page.evaluate(() => !!document.activeElement?.closest('.recadreur [data-action="quart-de-tour"]'));
        await page.keyboard.press('Enter');
        const ferme = await page.locator('.recadreur').waitFor({ state: 'detached', timeout: 3000 }).then(() => true).catch(() => false);
        if (focusBouton) faute('recadreur', 'clic sur « À droite » : le focus reste sur le bouton');
        if (!ferme) faute('recadreur', 'clic sur « À droite » puis Entrée : la vue ne se ferme pas (Entrée refait le quart de tour au lieu d’accepter)');
        const ann = await page.evaluate(() => __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent));
        console.log(`  recadreur « Déjà la photo entière » ${rem.inactif ? 'désactivé' : 'ACTIF'} ; clic « À droite » puis Entrée : ${ferme ? 'fermé' : 'RESTÉ OUVERT'}, en-tête « ${ann} »`);
        if (!ferme) await page.keyboard.press('Escape');
        await page.evaluate(() => document.activeElement?.blur?.());
        for (let k = 0; k < 3; k++) {
          const a = await page.evaluate(() => __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent));
          if (!/recadr|tourner/i.test(a)) break;
          await page.keyboard.press('Control+z');
          await attendre(300);
        }
      } else faute('recadreur', 'le Recadreur ne se rouvre pas');
    }
    await page.keyboard.press('Escape');
    await page.locator('.recadreur').waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
      await page.locator('.recadreur').getByRole('button', { name: /^(Annuler|Fermer|Fermer sans recadrer)$/ }).last().click();
    });
    await page.keyboard.press('Escape');
    await attendre(300);
  }
  await taille(1440, 900);

  // ---- En anglais : Doublons (rafales) et Sélection ----
  {
    await page.locator('.bouton-menu').click();
    await page.locator('.menu-deroulant [role=menuitem]').nth(2).click();
    await page.selectOption('#langue', 'en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.locator('.bandeau .etape').nth(4).click();
    await page.locator('main[data-etape=doublons]').waitFor();
    await fermerAide();
    await onglet(1);
    await page.locator('.outils-doublons [role=radio]').nth(2).click();
    await attendre(300);
    await choisirSection();
    await controlerPilote('doublons-rafales-en', { sorte: 'rafales', photos: true, ecarte: true, anglais: true, liste: '.sections-doublons' });
    await page.locator('.bandeau .etape').nth(10).click();
    await page.locator('.page-selection .tuile').first().waitFor({ timeout: 60_000 });
    await fermerAide();
    await controlerPilote('selection-en', { photos: true, anglais: true, liste: '.panneau-dossiers' });
  }

  // ---- Tour 3 du lot 4 (en anglais, à la fin : le geste de Floues change les rafales) : le message venu de Floues
  //      (« Blurry: N photos set aside… ») garde son lien sur Doublons, où le bouton de l'en-tête dit « Nothing to undo
  //      here » (testeur M2, gardien-demandes M1) ; Ctrl+Z ne défait pas le geste de Floues (choix 6 A) ; la zone
  //      role=status de l'en-tête est dans l'arbre d'accessibilité, même vide (WCAG 4.1.3, accessibilité N1). ----
  pagesFaites.push('doublons-message-arrivee');
  {
    const M = 'doublons-message-arrivee';
    await page.locator('.bandeau .etape').nth(3).click();
    await page.locator('main[data-etape=floues]').waitFor({ timeout: 60_000 });
    // Le curseur de tolérance poussé au bout (« Plus strict », sinon l'autre bout) : des photos passent sous le seuil.
    for (const bout of ['max', 'min']) {
      if (!/^0\b/.test(__norm(await page.locator('.compteur-floues').textContent()))) break;
      await page.locator('main[data-etape=floues] input[type=range]').evaluate((e, b) => {
        e.value = e[b];
        e.dispatchEvent(new Event('input', { bubbles: true }));
      }, bout);
      await attendre(400);
    }
    const n = __norm(await page.locator('.compteur-floues').textContent());
    if (/^0\b/.test(n)) signalements.push(`${M} : aucune photo floue à écarter, essai non fait`);
    else {
      await page.locator('[data-action=valider]').click();
      await page.locator('main[data-etape=doublons]').waitFor({ timeout: 60_000 });
      await attendre(500);
      const lire = () =>
        page.evaluate(() => {
          const lien = document.querySelector('.ligne-etape .message-entete [data-action=y-aller]');
          return {
            msg: __c.norm(document.querySelector('.ligne-etape .message-entete .texte-message')?.textContent),
            lien: lien ? __c.norm(lien.textContent) : null,
            lienVu: !!lien && __c.vu(lien),
            bouton: __c.norm(document.querySelector('.ligne-etape .bouton-annuler')?.textContent),
            mis: __c.norm(document.querySelectorAll('.onglet-doublons')[3]?.textContent),
          };
        });
      const a0 = await lire();
      // Choix 6 de D111, forme E : le message venu d'une autre étape garde son lien « Y aller » (« Go there »), qui mène
      // à l'étape du geste ; le bouton ↶ de la ligne dit « Rien à annuler ici ».
      if (!a0.lien || !a0.lienVu) faute(M, `arrivée sur Doublons après Floues (« ${n} ») : le message « ${a0.msg} » n’a pas de lien « Go there » visible (bouton de la ligne : « ${a0.bouton} »)`);
      // Il commence par le nom court de l'étape du geste (É12 g : « Floues : 6 photos écartées… »).
      if (!/^Blurry: /.test(a0.msg)) faute(M, `arrivée sur Doublons après Floues : le message « ${a0.msg} » ne commence pas par le nom de l’étape (« Blurry: … » attendu)`);
      if (/\bCtrl\+Z\b/.test(a0.msg)) faute(M, `arrivée sur Doublons après Floues : le message « ${a0.msg} » propose Ctrl+Z, qui ne le défait pas ici`);
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('Control+z');
      await attendre(500);
      const a1 = await lire();
      if (a1.mis !== a0.mis || a1.bouton !== a0.bouton) faute(M, `Ctrl+Z sur Doublons a défait le geste de Floues (« ${a0.mis} » → « ${a1.mis} », bouton « ${a0.bouton} » → « ${a1.bouton} »)`);
      console.log(`\n[${temps()}] ${M} : Floues « ${n} » → Doublons « ${a0.msg} » (lien ${a0.lien ? (a0.lienVu ? 'visible' : 'CACHÉ') : 'ABSENT'}), bouton « ${a0.bouton} » ; Ctrl+Z → « ${a1.msg} »`);
      await capture('doublons-message-arrivee_1440x900');
      // « Go there » mène à Floues, où ↶ défait le geste.
      if (a0.lien) {
        // Après Ctrl+Z, le message « Rien à annuler ici… » porte lui aussi « Go there ».
        await page.locator('.ligne-etape .message-entete button.lien').filter({ hasText: 'Go there' }).click().catch(() => undefined);
        const ici = await page.locator('main[data-etape=floues]').waitFor({ timeout: 10_000 }).then(() => true, () => false);
        const ann = ici ? await page.evaluate(() => { const b = document.querySelector('.ligne-etape .bouton-annuler'); return b && !b.disabled ? __c.norm(b.textContent) : ''; }) : '';
        if (!ici || !/^Undo/.test(ann)) faute(M, `« Go there » ne mène pas à Floues avec ↶ prêt à défaire le geste (${ici ? `↶ « ${ann} »` : 'pas sur Floues'})`);
        console.log(`  ${M} : « Go there » → ${ici ? 'Floues' : 'AILLEURS'}, ↶ « ${ann} »`);
      }
    }
    // La zone role=status de l'en-tête, vide, est dans l'arbre d'accessibilité.
    await page.waitForFunction(() => !document.querySelector('.ligne-etape .message-entete')?.textContent, null, { timeout: 15_000 }).catch(() => undefined);
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    let present = false;
    const vus = [];
    for (const x of nodes.filter((x) => x.role?.value === 'status' && x.backendDOMNodeId)) {
      const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: x.backendDOMNodeId });
      const { result } = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: 'function () { return `${this.className}|${this.textContent.length}`; }', returnByValue: true });
      vus.push(`${result.value}${x.ignored ? ' (ignoré)' : ''}`);
      if (!x.ignored && /message-entete/.test(result.value)) present = true;
    }
    const vide = await page.evaluate(() => { const e = document.querySelector('.ligne-etape .message-entete'); return e ? !e.textContent : null; });
    if (!present) faute(M, `la zone role=status de l’en-tête${vide ? ', vide,' : ''} n’est pas dans l’arbre d’accessibilité (un message qui y arrive ne serait pas lu) ; status vus : ${vus.join(' ; ') || 'aucun'}`);
    console.log(`  ${M} : zone role=status ${vide ? 'vide' : 'NON VIDE'} ${present ? 'présente' : 'ABSENTE'} dans l’arbre d’accessibilité (status vus : ${vus.join(' ; ') || 'aucun'})`);
  }
  // ---- Vue « Mis de côté » (tour 0 de l'étape 2d, règle d'or 3) : la photo écartée par le réglage du flou juste
  //      au-dessus (curseur au bout, « Valider »), sans décision, reste en bordure (« Floue », proposée : le réglage
  //      peut la faire revenir), comme à Floues ; une décision est en plein. Vue depuis Lieux et sorties. ----
  pagesFaites.push('lieux-mis-de-cote');
  {
    const L = 'lieux-mis-de-cote';
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.bandeau .etape').nth(6).click();
    await page.locator('.panneau-dossiers').waitFor({ timeout: 60_000 });
    // La première ligne spéciale du panneau : « Mis de côté » (la langue est l'anglais à ce point de l'essai).
    await page.locator('.panneau-dossiers .ligne-dossier.speciale').first().click();
    await page.locator('.tuile .badge-photo').first().waitFor({ timeout: 10_000 });
    const auto = await page.evaluate(async () => {
      const album = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('selecteur_sortie')).getDirectoryHandle('.album');
      const plan = JSON.parse(await (await (await album.getFileHandle('plan.json')).getFile()).text());
      return plan.fichiers.filter((f) => f.statut === 'mis_de_cote' && f.raison === 'floues' && f.flou === 'auto' && !f.origine?.flou && !f.avant).map((f) => f.id);
    });
    const vus = new Map();
    for (let k = 0; k < 60; k++) {
      for (const [id, b] of await page.locator('.tuile[data-id]').evaluateAll((l) => l.map((t) => [t.dataset.id, t.querySelector('.badge-photo')?.hasAttribute('data-decide') ? 'plein' : 'bord'])))
        vus.set(id, b);
      if (auto.every((id) => vus.has(id))) break;
      const fin = await page.evaluate(() => {
        const d = document.scrollingElement;
        const avant = d.scrollTop;
        d.scrollTop += Math.round(innerHeight * 0.6);
        return d.scrollTop === avant;
      });
      if (fin) break;
      await attendre(250);
    }
    await page.evaluate(() => (document.scrollingElement.scrollTop = 0));
    const autoVus = auto.filter((id) => vus.has(id));
    const autres = [...vus].filter(([id]) => !auto.includes(id));
    if (!auto.length) faute(L, 'aucune photo écartée par le réglage du flou dans le jeu d’essai (une attendue : rien à vérifier)');
    else if (autoVus.length < auto.length) faute(L, `${auto.length - autoVus.length} photo(s) écartée(s) par le réglage introuvable(s) dans la vue « Mis de côté »`);
    if (autoVus.some((id) => vus.get(id) !== 'bord')) faute(L, `une photo écartée par le réglage du flou est en plein (décidée) dans « Mis de côté » : la bordure est attendue`);
    if (autres.some(([, b]) => b !== 'plein')) faute(L, `une photo décidée est en bordure dans « Mis de côté »`);
    console.log(`\n[${temps()}] ${L} : ${autoVus.length} photo(s) écartée(s) par le réglage, en bordure ; ${autres.length} décidée(s), en plein`);
  }
} catch (e) {
  fautes.push({ page: 'parcours', texte: `parcours interrompu après « ${pagesFaites.at(-1) ?? 'rien'} » : ${e.message.split('\n')[0]}` });
  console.log(`  ✗ ${fautes.at(-1).texte}`);
} finally {
  await navigateur.close();
  serveur.close();
}

// « Valider et continuer » au même pixel sur toutes les pages, à chaque taille.
for (const [cle, liste] of valides) {
  const compte = new Map();
  for (const v of liste) compte.set(`${v.x},${v.y}`, (compte.get(`${v.x},${v.y}`) ?? 0) + 1);
  const [mode] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
  const ecarts = [...new Set(liste.filter((v) => `${v.x},${v.y}` !== mode).map((v) => `${v.page} (${v.x}, ${v.y})`))];
  for (const e of ecarts) fautes.push({ page: e.split(' ')[0], texte: `${cle} : « Valider et continuer » pas au même pixel que les autres pages (${mode}) : ${e}` });
  console.log(`Valider ${cle} : (${mode}) sur ${liste.length - ecarts.length} mesures${ecarts.length ? `, ailleurs : ${ecarts.join(', ')}` : ''}`);
}
if (erreurs.length) fautes.push({ page: 'console', texte: `erreurs de la console : ${[...new Set(erreurs)].slice(0, 5).join(' ; ')}` });

// Bilan : le pilote (doit échouer avant le sous-lot 2), les essais du lot 3, les autres pages.
const groupe = (p) => (/^(doublons|selection|recadreur)/.test(p) ? 'pilote' : /^comparer/.test(p) ? 'lot3' : p === 'parcours' || p === 'console' ? 'parcours' : 'autres');
const parPage = new Map();
for (const f of fautes) parPage.set(f.page, (parPage.get(f.page) ?? 0) + 1);
console.log(`\nBilan (${temps()}) :`);
for (const p of [...new Set([...pagesFaites, ...parPage.keys()])]) {
  const n = parPage.get(p) ?? 0;
  const etiquette = enAttente.has(p) ? ' (pas encore passée au cadre : contrôles généraux)' : groupe(p) === 'pilote' ? ' (pilote)' : groupe(p) === 'lot3' ? ' (essai reporté du lot 3)' : '';
  console.log(`  ${n ? '✗' : '✓'} ${p}${etiquette} : ${n} écart(s)`);
}
if (signalements.length) {
  console.log(`\nÀ revoir (n'échoue pas) :`);
  for (const s of signalements) console.log(`  • ${s}`);
}
for (const f of fautes.filter((f) => groupe(f.page) === 'parcours')) console.log(`  ✗ ${f.texte}`);
const n = (g) => fautes.filter((f) => groupe(f.page) === g).length;
console.log(`\nPilote : ${n('pilote')} écart(s) · essais du lot 3 : ${n('lot3')} · autres pages : ${n('autres')} · parcours : ${n('parcours')}`);
if (fautes.length) {
  console.log(`✗ ${fautes.length} écart(s) au cadre commun`);
  process.exit(1);
}
console.log('✓ Cadre commun respecté sur toutes les pages contrôlées');
