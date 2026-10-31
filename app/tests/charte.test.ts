// Charte « Table lumineuse » (docs/ux/CHARTE.md) : échelles fermées dans les
// styles de l'interface. Toute couleur vient d'un jeton (C-3), toute taille de
// texte est l'une des quatre de C-2 (plus 40 px à l'accueil), une seule police
// (C-1.1), et l'IA n'a pas de couleur (C-3.6). Les jetons s'écrivent dans
// style.css entre « @jetons début » et « @jetons fin », et nulle part ailleurs.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = join(__dirname, '..', 'src', 'ui');

function feuilles(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return feuilles(chemin);
    return nom.endsWith('.css') ? [chemin] : [];
  });
}

interface Declaration {
  fichier: string;
  ligne: number;
  propriete: string;
  valeur: string;
}

/** Les déclarations « propriété: valeur » hors commentaires et hors bloc des jetons. */
function declarations(chemin: string): Declaration[] {
  let texte = readFileSync(chemin, 'utf8');
  const debut = texte.indexOf('@jetons début');
  const fin = texte.indexOf('@jetons fin');
  if (debut >= 0 && fin > debut) texte = texte.slice(0, debut) + texte.slice(debut, fin).replace(/[^\n]/g, ' ') + texte.slice(fin);
  // Commentaires remplacés par des espaces : les numéros de ligne restent justes.
  texte = texte.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const resultat: Declaration[] = [];
  const motif = /([\w-]+)\s*:\s*([^;{}]+);/g;
  for (const m of texte.matchAll(motif)) {
    const ligne = texte.slice(0, m.index).split('\n').length;
    resultat.push({ fichier: relative(UI, chemin), ligne, propriete: m[1].toLowerCase(), valeur: m[2].trim() });
  }
  return resultat;
}

const TOUTES = feuilles(UI).flatMap(declarations);
const lieu = (d: Declaration) => `${d.fichier}:${d.ligne} ${d.propriete}: ${d.valeur}`;

const COULEUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|yellow|orange|purple|violet|gray|grey|silver)\b/i;

/**
 * Exceptions, courtes et justifiées :
 * - mask : seule l'opacité du dégradé compte (anneau du budget), sa couleur ne se voit jamais.
 */
const SANS_COULEUR_VISIBLE = new Set(['mask', '-webkit-mask', 'mask-image', '-webkit-mask-image']);

describe('charte : échelles fermées dans les CSS de app/src/ui', () => {
  it('trouve les feuilles de style et le bloc des jetons', () => {
    expect(TOUTES.length).toBeGreaterThan(1000);
    expect(readFileSync(join(UI, 'style.css'), 'utf8')).toMatch(/@jetons début[\s\S]+@jetons fin/);
  });

  it('aucune couleur écrite en dur hors des jetons (C-3)', () => {
    const fautes = TOUTES.filter((d) => !SANS_COULEUR_VISIBLE.has(d.propriete))
      .filter((d) => COULEUR.test(d.valeur));
    expect(fautes.map(lieu)).toEqual([]);
  });

  it('aucun jeton défini hors du bloc des jetons, sauf un renvoi vers un autre jeton', () => {
    // Une vue peut redéfinir un jeton par un autre (« --fond: var(--salle) »), jamais par une valeur.
    const fautes = TOUTES.filter((d) => d.propriete.startsWith('--') && !/^var\(--[\w-]+\)$/.test(d.valeur));
    expect(fautes.map(lieu)).toEqual([]);
  });

  it('toute taille de texte est un jeton : 14, 16, 20, 24 px, 40 à l’accueil (C-2.1)', () => {
    const jeton = /^var\(--t-(petit|corps|section|titre|accueil)\)$/;
    const fautes = TOUTES.filter((d) => d.propriete === 'font-size' && !jeton.test(d.valeur) && d.valeur !== 'inherit');
    const raccourcis = TOUTES.filter((d) => d.propriete === 'font' && d.valeur !== 'inherit' && !/var\(--t-(petit|corps|section|titre|accueil)\)/.test(d.valeur));
    expect([...fautes, ...raccourcis].map(lieu)).toEqual([]);
  });

  it('une seule police, Inter, embarquée (C-1.1)', () => {
    const familles = TOUTES.filter((d) => d.propriete === 'font-family' && !['inherit', 'var(--police)', "'Inter'"].includes(d.valeur));
    const raccourcis = TOUTES.filter((d) => d.propriete === 'font' && d.valeur !== 'inherit' && !d.valeur.endsWith('var(--police)'));
    expect([...familles, ...raccourcis].map(lieu)).toEqual([]);
    const style = readFileSync(join(UI, 'style.css'), 'utf8');
    expect(style.match(/@font-face/g)).toHaveLength(1);
    expect(style).not.toMatch(/url\(['"]?https?:/);
    expect(style).toMatch(/font-feature-settings:\s*'cv05',\s*'cv08'/);
  });

  it('graisses 400, 500, 600, 700 seulement (C-2.3) et aucune capitale de style', () => {
    // 500 : l'échelle sobre des boutons (retours du 29.10, question 1 a) ; 600 pour le plein et ce qui est choisi.
    const fautes = TOUTES.filter(
      (d) => (d.propriete === 'font-weight' && !['400', '500', '600', '700', 'inherit', 'normal', 'bold', '100 900'].includes(d.valeur)) || (d.propriete === 'text-transform' && d.valeur === 'uppercase'),
    );
    expect(fautes.map(lieu)).toEqual([]);
  });

  it('tout jeton utilisé est défini, et aucun jeton ne se cite lui-même', () => {
    // Un jeton absent ou circulaire rend la propriété invalide sans erreur visible :
    // la grille des tiers du recadrage avait disparu, une pastille brune passait au vert.
    const brut = feuilles(UI).map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    const definis = new Set([...brut.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    // Posés depuis le code (style={{ '--part': … }}) : cherchés dans les fichiers TSX.
    const tsx = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) return tsx(chemin);
        return nom.endsWith('.tsx') ? [readFileSync(chemin, 'utf8')] : [];
      });
    for (const texte of tsx(UI)) for (const m of texte.matchAll(/['"](--[\w-]+)['"]/g)) definis.add(m[1]);
    const utilises = new Set([...brut.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...utilises].filter((v) => !definis.has(v))).toEqual([]);
    const circulaires = [...brut.matchAll(/(--[\w-]+)\s*:([^;{}]+);/g)].filter((m) => new RegExp(`var\\(${m[1]}[,)]`).test(m[2])).map((m) => m[0]);
    expect(circulaires).toEqual([]);
  });

  it('chaque taille de texte a son interligne : 14/20, 16/24, 20/28, 24/32 (C-2.1)', () => {
    // L'interligne s'hérite en pixels : une règle qui change la taille doit poser le sien.
    const fautes: string[] = [];
    for (const f of feuilles(UI)) {
      const texte = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of texte.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        const taille = m[2].match(/font-size:\s*var\(--t-([a-z]+)\)/);
        if (!taille) continue;
        const interligne = m[2].match(/line-height:\s*([^;]+);/);
        if (!interligne) fautes.push(`${relative(UI, f)} ${m[1].trim()} : font-size sans line-height`);
        else if (interligne[1].startsWith('var(--lh-') && interligne[1] !== `var(--lh-${taille[1]})`) fautes.push(`${relative(UI, f)} ${m[1].trim()} : --t-${taille[1]} avec ${interligne[1]}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('aucun texte pâli par opacité (C-3.7, C-4.7) : seules les images le sont', () => {
    // Une photo écartée ou décochée peut être pâlie ; un texte, jamais (il tombe sous 4,5:1).
    // Exception : les rectangles de la frise (.bandeau .etape), dont le texte n'est lu
    // que par les lecteurs d'écran (.texte-masque).
    const IMAGES = /(img|\.image-capture|\.cadre-tuile|^\.bandeau \.etape\.verrouillee|^from|^to)\s*$/;
    const fautes: string[] = [];
    for (const f of feuilles(UI)) {
      const texte = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of texte.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        const o = m[2].match(/(?:^|[;\s])opacity:\s*([\d.]+)/);
        if (!o || Number(o[1]) >= 1) continue;
        const selecteurs = m[1].trim().split(',').map((x) => x.trim());
        if (!selecteurs.every((x) => IMAGES.test(x))) fautes.push(`${relative(UI, f)} ${m[1].trim()} : opacity ${o[1]}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('aucune opacité sur une photo écartée de Doublons ni « Pas pour l’album » : un peu délavée seulement (C-9.3, É14 k)', () => {
    // Une photo de nuit pâlie par opacité resterait noire ; le délavé (filtre) la laisse lisible, comme à Floues.
    const fautes: string[] = [];
    for (const f of feuilles(UI)) {
      const texte = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of texte.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        const o = m[2].match(/(?:^|[;\s])opacity:\s*([\d.]+)/);
        if (o && Number(o[1]) < 1 && /\.(ecartee|refusee)\b/.test(m[1])) fautes.push(`${relative(UI, f)} ${m[1].trim()} : opacity ${o[1]}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('le build garde light-dark() natif : cible CSS Chrome et Edge 123 ou plus (C-3.9)', () => {
    // Sinon Lightning CSS le remplace par des variables calculées sur :root, et les
    // vues sombres (Comparer, tri rapide, recadrage) gardent le texte du thème clair.
    const config = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
    const cible = config.match(/cssTarget:\s*\[([^\]]+)\]/);
    expect(cible, 'build.cssTarget absent de vite.config.ts').not.toBeNull();
    const versions = [...(cible?.[1] ?? '').matchAll(/'(chrome|edge)(\d+)'/g)];
    expect(versions.map((v) => v[1]).sort()).toEqual(['chrome', 'edge']);
    for (const v of versions) expect(Number(v[2])).toBeGreaterThanOrEqual(123);
  });

  it('l’IA n’a pas de couleur (C-3.6)', () => {
    const style = readFileSync(join(UI, 'style.css'), 'utf8');
    expect(style).not.toMatch(/--ia[-:]/);
    expect(TOUTES.filter((d) => /var\(--ia\b/.test(d.valeur)).map(lieu)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lot 2 : icônes et mots dans le code de l'interface (C-1.4, C-5, C-10)
// ---------------------------------------------------------------------------

const SRC = join(__dirname, '..', 'src');

/** Fichiers .ts et .tsx de l'interface, de la logique et des traductions (la page d'essais exceptée). */
function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === 'proto' || nom === 'consignes' ? [] : sources(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Le code sans ses commentaires (// et /* … *\/, JSX compris), lignes gardées. */
function sansCommentaires(texte: string): string {
  return texte.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/**
 * Caractères qui servaient d'icônes : ce sont des icônes SVG (Icones.tsx). Les flèches
 * ← → ↑ ↓ (touches du clavier), ★ (album, C-5.3) et ✓ (fait) sont dans la police et restent
 * des caractères. Aussi « ≈ » et « Ø » (C-10.6), et tout émoji.
 */
const CARACTERES_ICONES = /[✕✖✗✘✦✧✨▣◀▶►◄▾▸▴▹▿◂◆◇○●☰⌫✂✎✏↻↺⟳≤≥≈Ø⇄⧉↔⚠ℹ‹›]|\p{Extended_Pictographic}/u;
/** Caractères gardés malgré `Extended_Pictographic` : ils sont dans la police Inter. */
const DANS_LA_POLICE = new Set(['★', '✓', '™', '©', '®', '↔']);

describe('charte : icônes et mots dans app/src', () => {
  const fichiers = sources(SRC);

  it('aucun caractère-icône ni émoji dans les textes (C-1.4, C-5.1, C-10.6)', () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      sansCommentaires(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((ligne, i) => {
          for (const c of ligne) if (CARACTERES_ICONES.test(c) && !(DANS_LA_POLICE.has(c) && c !== '↔')) fautes.push(`${relative(SRC, f)}:${i + 1} « ${c} »`);
        });
    }
    expect(fautes).toEqual([]);
  });

  it('les icônes ont un trait de 1,75 et trois tailles : 20, 16, 14 (C-5.1)', () => {
    const icones = readFileSync(join(UI, 'composants', 'Icones.tsx'), 'utf8');
    expect(icones).toMatch(/stroke-width=\{1\.75\}/);
    expect(icones).toMatch(/export type TailleIcone = 14 \| 16 \| 20;/);
    // La seule exception, 22 px : la grande photo du curseur de taille, et nulle part ailleurs.
    expect(icones).toMatch(/export const TAILLE_GRANDE_PHOTO = 22;/);
    const ailleurs = fichiers.filter((f) => !f.endsWith('Icones.tsx') && !f.endsWith('CadreCommun.tsx') && readFileSync(f, 'utf8').includes('TAILLE_GRANDE_PHOTO'));
    expect(ailleurs.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('« valider » ne sert qu’à l’étape (C-10.1) : les groupes, les noms et les rangements s’acceptent', () => {
    // Textes français marqués (t`…`, aTraduire('…'), pluriel(n, '…')) qui disent « valider » pour autre chose
    // que l'étape. Restent permis : « Valider et continuer », l'étape validée (frise, liste des étapes),
    // « validez d'abord l'étape… », et l'adjectif « valide » (une sauvegarde, une latitude).
    const ETAPE = /Valider et continuer|étapes? validées?|^validée$|[Vv]alidez d’abord (?:l’étape|les lieux)|\b(?:in)?valides?\b/;
    const fautes: string[] = [];
    for (const f of fichiers.filter((x) => !x.includes('traductions'))) {
      const texte = sansCommentaires(readFileSync(f, 'utf8'));
      for (const m of texte.matchAll(/\bt`([^`]*)`|aTraduire\('([^']*)'\)|pluriel\([^,]+,\s*'([^']*)'(?:,\s*'([^']*)')?/g)) {
        for (const brut of m.slice(1)) {
          const s = (brut ?? '').replace(/\$\{[^}]*\}/g, '');
          if (/[Vv]alid/.test(s) && !ETAPE.test(s)) fautes.push(`${relative(SRC, f)} : ${s.slice(0, 80)}`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
