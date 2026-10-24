// Chaque texte marqué pour la traduction (src/lib/langue.ts) a sa traduction
// anglaise, avec les mêmes valeurs {0}, {1}… ; une même phrase n'est pas
// traduite de deux façons.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseAst } from 'vite';
import { describe, expect, it } from 'vitest';
import { cleTexte } from '../src/lib/langue';
import { EN, PARTIES } from '../src/traductions/en';

const SRC = join(__dirname, '..', 'src');
/** La page d'essais de la phase 0 reste en français. */
const EXCLUS = [join(SRC, 'proto'), join(SRC, 'traductions')];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (EXCLUS.includes(chemin)) return [];
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) && !nom.endsWith('.d.ts') ? [chemin] : [];
  });
}

type Noeud = { type: string; [cle: string]: unknown };

/** Texte d'un argument qui est une chaîne littérale (ou un gabarit sans valeur), sinon `null`. */
function litteral(n: Noeud | undefined): string | null {
  if (n?.type === 'Literal' && typeof n.value === 'string') return n.value;
  const quasis = n?.type === 'TemplateLiteral' ? (n.quasis as { value: { cooked: string } }[]) : null;
  return quasis?.length === 1 ? quasis[0].value.cooked : null;
}

/** Textes marqués d'un fichier source : t`…`, t('…'), aTraduire('…'), pluriel(n, '…', '…'). */
export function textesMarques(src: string): string[] {
  const textes: string[] = [];
  const nom = (n: unknown) => ((n as Noeud).type === 'Identifier' ? ((n as Noeud).name as string) : null);
  const visiter = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visiter);
    if (!n || typeof n !== 'object') return;
    const x = n as Noeud;
    if (x.type === 'TaggedTemplateExpression' && nom(x.tag) === 't') {
      textes.push(cleTexte(((x.quasi as Noeud).quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked)));
    } else if (x.type === 'CallExpression') {
      const args = x.arguments as Noeud[];
      const f = nom(x.callee);
      if (f === 't' || f === 'aTraduire') {
        const texte = litteral(args[0]);
        if (texte !== null) textes.push(texte);
      } else if (f === 'pluriel') {
        const un = litteral(args[1]);
        if (un !== null) textes.push(un, args[2] ? (litteral(args[2]) ?? '') : `${un}s`);
      }
    }
    for (const [cle, v] of Object.entries(x)) if (cle !== 'parent' && v && typeof v === 'object') visiter(v);
  };
  visiter(parseAst(src, { lang: 'tsx' }));
  return textes.filter(Boolean);
}

const valeurs = (texte: string) => [...texte.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');

describe('traductions anglaises', () => {
  const parFichier = fichiers(SRC).map((f) => ({ fichier: relative(SRC, f), textes: textesMarques(readFileSync(f, 'utf8')) }));

  it('lit les textes marqués', () => {
    // Les commentaires sont ignorés : t`Pas ici`.
    expect(textesMarques("// t`Pas ici`\nt`Valider`; x = t`${a} photos sur ${b}`; t('Un'); pluriel(f(a, b), 'photo floue'); pluriel(n, 'lieu', 'lieux'); aTraduire('Deux'); y = /['\"]/")).toEqual([
      'Valider',
      '{0} photos sur {1}',
      'Un',
      'photo floue',
      'photo floues',
      'lieu',
      'lieux',
      'Deux',
    ]);
  });

  it('chaque texte marqué a sa traduction', () => {
    const manquants = parFichier.flatMap(({ fichier, textes }) => textes.filter((x) => !(x in EN)).map((x) => `${fichier} : ${x}`));
    expect([...new Set(manquants)]).toEqual([]);
  });

  it('chaque traduction garde les mêmes valeurs {0}, {1}…', () => {
    const fausses = Object.entries(EN).filter(([fr, en]) => valeurs(fr) !== valeurs(en));
    expect(fausses).toEqual([]);
  });

  it('une même phrase n’est pas traduite de deux façons', () => {
    const vues = new Map<string, string>();
    const conflits: string[] = [];
    for (const [partie, table] of Object.entries(PARTIES)) {
      for (const [fr, en] of Object.entries(table)) {
        const deja = vues.get(fr);
        if (deja !== undefined && deja !== en) conflits.push(`${partie} : « ${fr} » → « ${en} » / « ${deja} »`);
        vues.set(fr, en);
      }
    }
    expect(conflits).toEqual([]);
  });
});
