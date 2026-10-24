// Touches communes à toutes les pages et page retrouvée après un rechargement.

import { describe, expect, it } from 'vitest';
import { actionClavier, lirePageVue, textePageVue } from '../src/lib/navigation';

const touche = (key: string, o: { ctrl?: boolean; meta?: boolean; maj?: boolean; alt?: boolean } = {}) => ({
  key,
  ctrlKey: !!o.ctrl,
  metaKey: !!o.meta,
  shiftKey: !!o.maj,
  altKey: !!o.alt,
});

describe('touches communes', () => {
  it('Ctrl+Z annule, Ctrl+Y et Ctrl+Maj+Z rétablissent', () => {
    expect(actionClavier(touche('z', { ctrl: true }))).toBe('annuler');
    expect(actionClavier(touche('z', { meta: true }))).toBe('annuler');
    expect(actionClavier(touche('y', { ctrl: true }))).toBe('retablir');
    // Avec Maj, le navigateur donne souvent la majuscule.
    expect(actionClavier(touche('Z', { ctrl: true, maj: true }))).toBe('retablir');
  });

  it('ignore les lettres seules et AltGr', () => {
    expect(actionClavier(touche('z'))).toBeNull();
    expect(actionClavier(touche('y', { ctrl: true, maj: true }))).toBeNull();
    expect(actionClavier(touche('z', { ctrl: true, alt: true }))).toBeNull();
    expect(actionClavier(touche('a', { ctrl: true }))).toBeNull();
  });

  it('« ? » ouvre la liste des raccourcis, même tapé avec AltGr', () => {
    expect(actionClavier(touche('?', { maj: true }))).toBe('raccourcis');
    expect(actionClavier(touche('?', { ctrl: true, alt: true }))).toBe('raccourcis');
    expect(actionClavier(touche('?', { ctrl: true }))).toBeNull();
  });
});

describe('page retrouvée après un rechargement', () => {
  it('rend l’étape regardée du même projet', () => {
    expect(lirePageVue(textePageVue('p1', { nom: 'etape', numero: 7 }), 'p1', 13)).toEqual({ nom: 'etape', numero: 7 });
    expect(lirePageVue(textePageVue('p1', { nom: 'journal' }), 'p1', 13)).toEqual({ nom: 'journal' });
  });

  it('ignore un autre projet, une page à part ou un texte abîmé', () => {
    expect(lirePageVue(textePageVue('p1', { nom: 'etape', numero: 7 }), 'p2', 13)).toBeNull();
    expect(lirePageVue(textePageVue('p1', { nom: 'accueil' }), 'p1', 13)).toBeNull();
    expect(lirePageVue(textePageVue('p1', { nom: 'reprendre' }), 'p1', 13)).toBeNull();
    expect(lirePageVue(textePageVue('p1', { nom: 'etape', numero: 14 }), 'p1', 13)).toBeNull();
    expect(lirePageVue('{"projet":"p1","page":{"nom":"etape","numero":"3"}}', 'p1', 13)).toBeNull();
    expect(lirePageVue('{pas du json', 'p1', 13)).toBeNull();
    expect(lirePageVue(null, 'p1', 13)).toBeNull();
  });
});
