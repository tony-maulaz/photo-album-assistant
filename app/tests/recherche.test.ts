import { describe, expect, it } from 'vitest';
import { rechercher, singulier, termes } from '../src/lib/recherche';

const documents = [
  { id: 'A', texte: 'deux enfants assis sur un éléphant dans la jungle ; activité ; 2 à 4 personnes' },
  { id: 'B', texte: 'éléphant qui se baigne dans la rivière ; animal ; sans personne' },
  { id: 'C', texte: 'enfants jouant sur la plage ; groupe' },
  { id: 'D', texte: 'temple doré au toit rouge ; monument' },
  { id: 'E', texte: 'soleil couchant sur la mer ; paysage' },
  { id: 'F', texte: 'plage de sable blanc ; paysage' },
  { id: 'G', texte: 'coucher de soleil en montagne ; paysage' },
  { id: 'H', texte: 'petite fille sur un cheval ; une personne' },
];

describe('recherche en langage naturel (locale)', () => {
  it('normalise accents, casse, pluriels et expressions', () => {
    expect(termes('Les Éléphants, les chevaux et les bateaux')).toEqual(['les', 'elephant', 'les', 'cheval', 'et', 'les', 'bateau']);
    expect(termes('Couchers de soleil')).toEqual(['couchersoleil']);
    expect(singulier('bois')).toBe('boi');
    expect(singulier('ss')).toBe('ss');
  });

  it('« les enfants sur un éléphant » : la photo qui a tout d’abord', () => {
    const r = rechercher('les enfants sur un éléphant', documents);
    expect(r[0]).toMatchObject({ id: 'A', complet: true, trouves: ['enfant', 'elephant'] });
    expect(r.slice(1).map((x) => x.id)).toEqual(['B', 'C', 'H']);
    expect(r.find((x) => x.id === 'H')).toMatchObject({ score: 0.7, complet: false });
  });

  it('« coucher de soleil sur la plage » : synonymes (soleil couchant, mer)', () => {
    const r = rechercher('coucher de soleil sur la plage', documents);
    expect(r[0]).toMatchObject({ id: 'E', complet: true });
    expect(r.map((x) => x.id)).toEqual(['E', 'C', 'F', 'G']);
  });

  it('un mot générique trouve les photos plus précises', () => {
    // B porte l'étiquette « animal » ; A (éléphant) et H (cheval) sont trouvées par le terme générique.
    expect(rechercher('animaux', documents).map((x) => x.id)).toEqual(['B', 'A', 'H']);
    expect(rechercher('monuments', documents).map((x) => x.id)).toEqual(['D']);
  });

  it('requête vide ou faite de mots vides : aucun résultat', () => {
    expect(rechercher('', documents)).toEqual([]);
    expect(rechercher('les photos de la', documents)).toEqual([]);
    expect(rechercher('girafe', documents)).toEqual([]);
  });
});
