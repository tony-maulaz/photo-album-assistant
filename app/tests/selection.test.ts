import { describe, expect, it } from 'vitest';
import { disposer, elementsVisibles, voisinVertical } from '../src/lib/grille';
import { arrivees, copiesRetenues, groupesParJour, jourArrivee, periodesEquilibre } from '../src/lib/selection';

describe('grille avec titres de journée', () => {
  const o = { marge: 20, case: 100, titre: 40 };

  it('sans titre : les lignes se suivent comme avant', () => {
    const d = disposer(7, 3, [], o);
    expect(d.ligne).toEqual([0, 0, 0, 1, 1, 1, 2]);
    expect(d.colonne).toEqual([0, 1, 2, 0, 1, 2, 0]);
    expect(d.haut).toEqual([20, 120, 220]);
    expect(d.premier).toEqual([0, 3, 6, 7]);
    expect(d.hauteur).toBe(3 * 100 + 2 * 20);
    expect(d.titres).toEqual([]);
  });

  it('chaque titre ouvre une nouvelle ligne, précédée de sa hauteur', () => {
    // Deux journées : 4 photos puis 2, sur 3 colonnes.
    const d = disposer(6, 3, [0, 4], o);
    expect(d.titres).toEqual([
      { debut: 0, y: 20 },
      { debut: 4, y: 260 },
    ]);
    expect(d.haut).toEqual([60, 160, 300]);
    expect(d.ligne).toEqual([0, 0, 0, 1, 2, 2]);
    expect(d.colonne).toEqual([0, 1, 2, 0, 0, 1]);
    expect(d.hauteur).toBe(300 + 100 + 20);
  });

  it('éléments visibles : seulement les lignes de la bande demandée', () => {
    const d = disposer(6, 3, [0, 4], o);
    expect(elementsVisibles(d, 0, 100, 100)).toEqual({ debut: 0, fin: 3 });
    expect(elementsVisibles(d, 170, 310, 100)).toEqual({ debut: 3, fin: 6 });
    expect(elementsVisibles(d, 1000, 1200, 100)).toEqual({ debut: 6, fin: 6 });
    expect(elementsVisibles(disposer(0, 3, [], o), 0, 500, 100)).toEqual({ debut: 0, fin: 0 });
  });

  it('flèches haut et bas : même colonne, ou la dernière case d’une ligne plus courte', () => {
    const d = disposer(6, 3, [0, 4], o);
    expect(voisinVertical(d, 2, 1)).toBe(3);
    expect(voisinVertical(d, 3, 1)).toBe(4);
    expect(voisinVertical(d, 5, -1)).toBe(3);
    expect(voisinVertical(d, 1, -1)).toBe(1);
    expect(voisinVertical(d, 5, 1)).toBe(5);
  });
});

describe('journées de la grille', () => {
  it('découpe une liste triée par date en journées, avec leurs sorties', () => {
    const g = groupesParJour([
      { date: undefined, dossier: 'a' },
      { date: '2025-06-27T10:00:00', dossier: 'a' },
      { date: '2025-06-27T11:00:00', dossier: 'b' },
      { date: '2025-06-28', dossier: 'b' },
    ]);
    expect(g).toEqual([
      { debut: 0, n: 1, jour: '', dossiers: ['a'] },
      { debut: 1, n: 2, jour: '2025-06-27', dossiers: ['a', 'b'] },
      { debut: 3, n: 1, jour: '2025-06-28', dossiers: ['b'] },
    ]);
  });
});

describe('photos arrivées en plusieurs fois (D63)', () => {
  it('jour local d’arrivée et nombre de photos par arrivée', () => {
    const midi = new Date(2026, 9, 24, 12, 0).toISOString();
    const avant = new Date(2026, 9, 12, 9, 30).toISOString();
    expect(jourArrivee(midi)).toBe('2026-10-24');
    expect(jourArrivee('pas une date')).toBe('');
    expect(arrivees([{ ajout: midi }, {}, { ajout: avant }, { ajout: midi }])).toEqual([
      { jour: '2026-10-12', n: 1 },
      { jour: '2026-10-24', n: 2 },
    ]);
  });
});

describe('équilibre lisible', () => {
  const jour = (j: string, disponibles: number, retenues: number) => ({ jour: j, disponibles, retenues });

  it('une barre par jour tant qu’ils sont peu nombreux, sans les photos sans date', () => {
    const e = periodesEquilibre([jour('2025-06-27', 4, 1), jour('2025-06-28', 2, 0), jour('sans date', 3, 0)]);
    expect(e).toEqual({
      unite: 'jour',
      periodes: [
        { cle: '2025-06-27', disponibles: 4, retenues: 1 },
        { cle: '2025-06-28', disponibles: 2, retenues: 0 },
      ],
    });
  });

  it('une barre par mois au-delà', () => {
    const jours = Array.from({ length: 50 }, (_, i) => jour(`2025-${i < 30 ? '06' : '07'}-${String((i % 30) + 1).padStart(2, '0')}`, 2, i % 2));
    const e = periodesEquilibre(jours);
    expect(e.unite).toBe('mois');
    expect(e.periodes).toEqual([
      { cle: '2025-06', disponibles: 60, retenues: 15 },
      { cle: '2025-07', disponibles: 40, retenues: 10 },
    ]);
  });
});

describe('copies exactes retenues', () => {
  it('la même photo retenue dans deux dossiers est signalée ; dans un seul, ou écartée, non', () => {
    const photos = [
      { id: 'best/1.jpg', dossier: 'best', empreinte: 'e1', album: 1 as const },
      { id: 'juin/1.jpg', dossier: 'juin', empreinte: 'e1', album: 2 as const },
      { id: 'juin/2.jpg', dossier: 'juin', empreinte: 'e2', album: 1 as const },
      { id: 'juin/2b.jpg', dossier: 'juin', empreinte: 'e2', album: 1 as const },
      { id: 'best/3.jpg', dossier: 'best', empreinte: 'e3', album: 1 as const },
      { id: 'juin/3.jpg', dossier: 'juin', empreinte: 'e3', album: 0 as const },
      { id: 'juin/4.jpg', dossier: 'juin', album: 1 as const },
    ];
    expect(copiesRetenues(photos)).toEqual([['best/1.jpg', 'juin/1.jpg']]);
  });
});
