// Aperçu du tri automatique : chiffres, semaines d'exemple, frise et pastilles,
// sur de petits jeux construits à la main.

import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  auDomicile,
  choisirExemples,
  classeTaille,
  colonnesFrise,
  ecartJours,
  jourDe,
  joursEntre,
  listeParDate,
  pastillesJour,
  periodeFrise,
  statistiquesTri,
} from '../src/lib/apercuTri';
import type { InfoTri } from '../src/lib/plan';
import type { DossierPropose } from '../src/lib/tri';

/** Jeu de dossiers : chaque série ajoute `n` photos par jour, du jour `du` pendant `nbJours` jours. */
function jeu() {
  const dates = new Map<string, string | undefined>();
  const dossiers: DossierPropose[] = [];
  let compteur = 0;
  const ajouter = (chemin: string[], series: [du: string, nbJours: number, n: number][], info: InfoTri = { origine: 'gps', lieu: chemin.at(-1) }, infoParent?: InfoTri) => {
    const photos: string[] = [];
    for (const [du, nbJours, n] of series)
      for (let j = 0; j < nbJours; j++)
        for (let k = 0; k < n; k++) {
          const id = `p${++compteur}.jpg`;
          photos.push(id);
          dates.set(id, `${ajouterJours(du, j)}T${String(8 + (k % 12)).padStart(2, '0')}:00:00`);
        }
    const d: DossierPropose = { chemin, photos, info, ...(infoParent ? { infoParent } : {}) };
    dossiers.push(d);
    return d;
  };
  return { dates, dossiers, ajouter };
}

const MAISON: InfoTri = { origine: 'lieu_connu', lieu: 'Maison' };
const voyage = (lieu: string): InfoTri => ({ origine: 'voyage', lieu });

/** Une année inventée : une semaine très chargée, un long voyage, la maison, des petits dossiers, un grand dossier. */
function annee() {
  const j = jeu();
  // Le plus grand dossier (210 éléments), étalé sur un mois : 7 par jour.
  j.ajouter(['Sans_lieu'], [['2025-01-01', 30, 7]], { origine: 'sans_lieu' });
  // La maison, seule pendant cinq jours ; puis un peu pendant la semaine chargée.
  j.ajouter(['Maison', '01-05.03.25'], [['2025-03-01', 5, 3]], MAISON, MAISON);
  j.ajouter(['Maison', '11-12.04.25'], [['2025-04-11', 2, 2]], MAISON, MAISON);
  // La semaine la plus chargée : 40 photos par jour pendant trois jours.
  j.ajouter(['Lieu_A_10-12.04.25'], [['2025-04-10', 3, 40]]);
  // Trois très petits dossiers la même semaine, un autre plus tard.
  j.ajouter(['Lieu_F_05.05.25'], [['2025-05-05', 1, 1]]);
  j.ajouter(['Lieu_G_07.05.25'], [['2025-05-07', 1, 2]]);
  j.ajouter(['Lieu_H_09.05.25'], [['2025-05-09', 1, 1]]);
  j.ajouter(['Lieu_I_01.09.25'], [['2025-09-01', 1, 1]]);
  // Le plus long voyage (dix jours, deux étapes) et un plus court.
  j.ajouter(['Voyage_Lieu_B_01-10.06.25', 'Lieu_B_01-05.06.25'], [['2025-06-01', 5, 5]], { origine: 'etape', lieu: 'Lieu_B' }, voyage('Lieu_B'));
  j.ajouter(['Voyage_Lieu_B_01-10.06.25', 'Lieu_C_07-10.06.25'], [['2025-06-07', 4, 4]], { origine: 'etape', lieu: 'Lieu_C' }, voyage('Lieu_B'));
  j.ajouter(['Voyage_Lieu_D_02-04.08.25', 'Lieu_D_02-03.08.25'], [['2025-08-02', 2, 3]], { origine: 'etape', lieu: 'Lieu_D' }, voyage('Lieu_D'));
  j.ajouter(['Voyage_Lieu_D_02-04.08.25', 'Lieu_E_04.08.25'], [['2025-08-04', 1, 3]], { origine: 'etape', lieu: 'Lieu_E' }, voyage('Lieu_D'));
  return j;
}

describe('jours', () => {
  it('lit le jour d’une date, ignore le reste', () => {
    expect(jourDe('2025-07-13T10:00:00')).toBe('2025-07-13');
    expect(jourDe('2025-07-13')).toBe('2025-07-13');
    expect(jourDe(undefined)).toBeNull();
    expect(jourDe('')).toBeNull();
    expect(jourDe('13.07.2025')).toBeNull();
    expect(jourDe('2025-13-01')).toBeNull();
  });

  it('compte les jours par-dessus les mois et les années', () => {
    expect(ajouterJours('2024-12-30', 3)).toBe('2025-01-02');
    expect(ajouterJours('2024-02-28', 1)).toBe('2024-02-29');
    expect(ajouterJours('2025-03-01', -1)).toBe('2025-02-28');
    expect(ecartJours('2024-12-30', '2025-01-02')).toBe(3);
    expect(ecartJours('2025-03-30', '2025-03-31')).toBe(1); // passage à l'heure d'été sans effet
    expect(joursEntre('2024-12-30', '2025-01-02')).toEqual(['2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02']);
    expect(joursEntre('2025-01-02', '2025-01-01')).toEqual([]);
  });
});

describe('statistiquesTri', () => {
  it('classe les dossiers par taille, bornes comprises', () => {
    expect([1, 2, 3, 10, 11, 50, 51, 200, 201, 5000].map(classeTaille)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('compte dossiers, voyages, très petits et très grands', () => {
    const { dossiers } = annee();
    expect(statistiquesTri(dossiers)).toEqual({ dossiers: 12, voyages: 2, tailles: [4, 3, 3, 1, 1], tresPetits: 4, tresGrands: 1 });
  });

  it('ne compte comme voyage que les parents « voyage », chacun une fois', () => {
    const j = jeu();
    j.ajouter(['Maison', '01.03.25'], [['2025-03-01', 1, 3]], MAISON, MAISON);
    j.ajouter(['Maison', '05.03.25'], [['2025-03-05', 1, 3]], MAISON, MAISON);
    j.ajouter(['Voyage_X', 'Etape_1'], [['2025-06-01', 1, 3]], { origine: 'etape' }, voyage('Lieu_X'));
    j.ajouter(['Voyage_X', 'Etape_2'], [['2025-06-02', 1, 3]], { origine: 'etape' }, voyage('Lieu_X'));
    expect(statistiquesTri(j.dossiers).voyages).toBe(1);
    expect(statistiquesTri([])).toEqual({ dossiers: 0, voyages: 0, tailles: [0, 0, 0, 0, 0], tresPetits: 0, tresGrands: 0 });
  });
});

describe('choisirExemples', () => {
  it('choisit une semaine par raison, dans l’ordre', () => {
    const { dossiers, dates } = annee();
    expect(choisirExemples(dossiers, dates, 'Maison')).toEqual([
      { raison: 'chargee', du: '2025-04-10', au: '2025-04-16' },
      { raison: 'voyage', du: '2025-06-01', au: '2025-06-10' },
      // La semaine chargée a aussi des photos à la maison, mais la maison n'y domine pas.
      { raison: 'maison', du: '2025-03-01', au: '2025-03-07' },
      { raison: 'petits', du: '2025-05-05', au: '2025-05-11' },
      { raison: 'grand', du: '2025-01-01', au: '2025-01-07' },
    ]);
  });

  it('sans domicile, pas de semaine à la maison', () => {
    const { dossiers, dates } = annee();
    expect(choisirExemples(dossiers, dates).map((e) => e.raison)).toEqual(['chargee', 'voyage', 'petits', 'grand']);
    expect(choisirExemples(dossiers, dates, 'Lieu_inconnu').map((e) => e.raison)).toEqual(['chargee', 'voyage', 'petits', 'grand']);
  });

  it('donne le même résultat quel que soit l’ordre des dossiers', () => {
    const { dossiers, dates } = annee();
    const attendu = choisirExemples(dossiers, dates, 'Maison');
    expect(choisirExemples([...dossiers].reverse(), dates, 'Maison')).toEqual(attendu);
    expect(choisirExemples([...dossiers.slice(5), ...dossiers.slice(0, 5)], dates, 'Maison')).toEqual(attendu);
  });

  it('ignore les éléments sans date ou à la date illisible', () => {
    const j = jeu();
    const d = j.ajouter(['Lieu_A'], [['2025-04-10', 1, 2]]);
    d.photos.push('sans_date.jpg', 'illisible.jpg');
    j.dates.set('illisible.jpg', '0000:00:00');
    expect(choisirExemples(j.dossiers, j.dates)).toEqual([
      { raison: 'chargee', du: '2025-04-10', au: '2025-04-16' },
      // Le plus grand dossier montrerait la même semaine : pas de doublon.
    ]);
    expect(choisirExemples([], new Map())).toEqual([]);
    expect(choisirExemples([{ chemin: ['_sans_date'], photos: ['a.jpg'], info: { origine: 'sans_lieu' } }], new Map([['a.jpg', undefined]]))).toEqual([]);
  });

  it('coupe un voyage à 14 jours', () => {
    const j = jeu();
    j.ajouter(['Voyage_Lieu_B', 'Lieu_B'], [['2025-06-01', 10, 5]], { origine: 'etape' }, voyage('Lieu_B'));
    j.ajouter(['Voyage_Lieu_B', 'Lieu_C'], [['2025-06-11', 10, 5]], { origine: 'etape' }, voyage('Lieu_B'));
    expect(choisirExemples(j.dossiers, j.dates).find((e) => e.raison === 'voyage')).toEqual({ raison: 'voyage', du: '2025-06-01', au: '2025-06-14' });
  });

  it('à durée égale, préfère le voyage qui a le plus de photos', () => {
    const j = jeu();
    j.ajouter(['Voyage_A', 'Etape'], [['2025-02-01', 3, 2]], { origine: 'etape' }, voyage('Lieu_A'));
    j.ajouter(['Voyage_B', 'Etape'], [['2025-06-01', 3, 4]], { origine: 'etape' }, voyage('Lieu_B'));
    j.ajouter(['Lieu_C'], [['2025-09-01', 1, 50]]);
    expect(choisirExemples(j.dossiers, j.dates).find((e) => e.raison === 'voyage')).toEqual({ raison: 'voyage', du: '2025-06-01', au: '2025-06-03' });
  });

  it('ne montre pas deux fois presque la même semaine', () => {
    const j = jeu();
    // Le plus grand dossier fait aussi la semaine la plus chargée ; deux très petits dossiers y sont.
    j.ajouter(['Lieu_A'], [['2025-04-10', 1, 50]]);
    j.ajouter(['Lieu_B'], [['2025-04-11', 1, 1]]);
    j.ajouter(['Lieu_C'], [['2025-04-12', 1, 1]]);
    j.ajouter(['Lieu_D'], [['2025-08-01', 1, 1]]);
    expect(choisirExemples(j.dossiers, j.dates)).toEqual([
      { raison: 'chargee', du: '2025-04-10', au: '2025-04-16' },
      // La semaine des deux très petits partage six jours avec la plus chargée : on passe à la suivante.
      { raison: 'petits', du: '2025-08-01', au: '2025-08-07' },
    ]);
  });

  it('une semaine à la maison : d’abord celles où la maison domine', () => {
    const j = jeu();
    j.ajouter(['Lieu_A'], [['2025-04-10', 3, 20]]);
    j.ajouter(['Maison', '10-12.04.25'], [['2025-04-10', 3, 10]], MAISON, MAISON);
    j.ajouter(['Maison', '01.03.25'], [['2025-03-01', 1, 3]], MAISON, MAISON);
    j.ajouter(['Lieu_K'], [['2025-07-01', 1, 200]]);
    // Plus de photos à la maison en avril, mais la maison n'y fait qu'un tiers des photos.
    expect(choisirExemples(j.dossiers, j.dates, 'Maison').find((e) => e.raison === 'maison')).toEqual({ raison: 'maison', du: '2025-03-01', au: '2025-03-07' });
    expect(auDomicile(j.dossiers[1], 'Maison')).toBe(true);
    expect(auDomicile(j.dossiers[0], 'Maison')).toBe(false);
    expect(auDomicile(j.dossiers[1])).toBe(false);
  });
});

describe('periodeFrise', () => {
  it('montre au moins une semaine, centrée sur la période', () => {
    expect(periodeFrise('2025-07-05', '2025-07-05')).toEqual({ du: '2025-07-02', au: '2025-07-08' });
    expect(periodeFrise('2025-07-05', '2025-07-06')).toEqual({ du: '2025-07-03', au: '2025-07-09' });
    expect(periodeFrise('2025-12-30', '2026-01-01')).toEqual({ du: '2025-12-28', au: '2026-01-03' });
    expect(periodeFrise('2025-07-01', '2025-07-07')).toEqual({ du: '2025-07-01', au: '2025-07-07' });
    expect(periodeFrise('2025-07-01', '2025-07-14')).toEqual({ du: '2025-07-01', au: '2025-07-14' });
  });
});

describe('colonnesFrise', () => {
  it('une colonne par jour, une portion par dossier présent', () => {
    const { dossiers, dates } = annee();
    const f = colonnesFrise(dossiers, dates, '2025-06-05', '2025-06-11');
    expect(f.jours.map((j) => j.jour)).toEqual(['2025-06-05', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09', '2025-06-10', '2025-06-11']);
    expect(f.jours.map((j) => j.total)).toEqual([5, 0, 4, 4, 4, 4, 0]);
    const b = dossiers.findIndex((d) => d.chemin[1] === 'Lieu_B_01-05.06.25');
    const c = dossiers.findIndex((d) => d.chemin[1] === 'Lieu_C_07-10.06.25');
    expect(f.jours[0].parDossier).toEqual([{ dossier: b, n: 5 }]);
    expect(f.jours[1].parDossier).toEqual([]);
    expect(f.portions).toEqual([
      { dossier: b, premier: 0, dernier: 0, dansPeriode: 5, elements: 25, jours: 5, du: '2025-06-01', au: '2025-06-05', coupeAvant: true, coupeApres: false },
      { dossier: c, premier: 2, dernier: 5, dansPeriode: 16, elements: 16, jours: 4, du: '2025-06-07', au: '2025-06-10', coupeAvant: false, coupeApres: false },
    ]);
    expect(f.voyages).toEqual([{ parent: 'Voyage_Lieu_B_01-10.06.25', lieu: 'Lieu_B', premier: 0, dernier: 5 }]);
  });

  it('ordonne les portions par premier jour, puis dernier jour, et les éléments du jour de même', () => {
    const j = jeu();
    j.ajouter(['Lieu_Z'], [['2025-04-10', 3, 1]]);
    j.ajouter(['Lieu_Y'], [['2025-04-10', 1, 2]]);
    j.ajouter(['Lieu_X'], [['2025-04-09', 2, 1]]);
    const f = colonnesFrise(j.dossiers, j.dates, '2025-04-09', '2025-04-15');
    expect(f.portions.map((p) => j.dossiers[p.dossier].chemin[0])).toEqual(['Lieu_X', 'Lieu_Y', 'Lieu_Z']);
    expect(f.jours[1].parDossier).toEqual([
      { dossier: 2, n: 1 },
      { dossier: 1, n: 2 },
      { dossier: 0, n: 1 },
    ]);
    expect(f.portions[2]).toMatchObject({ premier: 1, dernier: 3, coupeAvant: false, coupeApres: false, jours: 3 });
  });

  it('marque un dossier qui dépasse la période, d’une année à l’autre', () => {
    const j = jeu();
    j.ajouter(['Sans_lieu'], [['2024-12-20', 20, 1]], { origine: 'sans_lieu' });
    const f = colonnesFrise(j.dossiers, j.dates, '2024-12-29', '2025-01-04');
    expect(f.jours).toHaveLength(7);
    expect(f.portions).toEqual([{ dossier: 0, premier: 0, dernier: 6, dansPeriode: 7, elements: 20, jours: 20, du: '2024-12-20', au: '2025-01-08', coupeAvant: true, coupeApres: true }]);
    expect(f.voyages).toEqual([]);
    expect(colonnesFrise(j.dossiers, j.dates, '2025-03-01', '2025-03-07').portions).toEqual([]);
  });
});

describe('listeParDate', () => {
  it('trie les dossiers par premier jour, puis par chemin, les non datés à la fin', () => {
    const j = jeu();
    j.ajouter(['Lieu_B'], [['2025-04-10', 2, 1]]);
    j.ajouter(['_sans_date'], []);
    j.dossiers[1].photos.push('x.jpg');
    j.ajouter(['Lieu_A'], [['2025-04-10', 1, 1]]);
    j.ajouter(['Voyage_C', 'Etape'], [['2025-01-02', 3, 1]], { origine: 'etape' }, voyage('Lieu_C'));
    expect(listeParDate(j.dossiers, j.dates)).toEqual([
      { dossier: 3, du: '2025-01-02', au: '2025-01-04' },
      { dossier: 2, du: '2025-04-10', au: '2025-04-10' },
      { dossier: 0, du: '2025-04-10', au: '2025-04-11' },
      { dossier: 1, du: null, au: null },
    ]);
  });
});

describe('pastillesJour', () => {
  it('une pastille par élément jusqu’à 12', () => {
    expect(
      pastillesJour([
        { dossier: 3, n: 2 },
        { dossier: 1, n: 0 },
        { dossier: 0, n: 1 },
      ]),
    ).toEqual({ pastilles: [3, 3, 0], reste: 0 });
    expect(pastillesJour([{ dossier: 0, n: 12 }]).pastilles).toHaveLength(12);
    expect(pastillesJour([])).toEqual({ pastilles: [], reste: 0 });
  });

  it('au-delà, chaque dossier garde au moins une pastille, le reste au prorata', () => {
    expect(
      pastillesJour([
        { dossier: 0, n: 30 },
        { dossier: 1, n: 1 },
      ]),
    ).toEqual({ pastilles: [...Array<number>(11).fill(0), 1], reste: 19 });
    expect(
      pastillesJour([
        { dossier: 0, n: 10 },
        { dossier: 1, n: 10 },
        { dossier: 2, n: 4 },
      ]),
    ).toEqual({
      pastilles: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2],
      reste: 12,
    });
    const nombreux = Array.from({ length: 14 }, (_, i) => ({ dossier: i, n: 1 }));
    expect(pastillesJour(nombreux)).toEqual({ pastilles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], reste: 2 });
  });

  it('montre toujours exactement 12 pastilles quand il y a plus de 12 éléments', () => {
    for (const ns of [[13], [7, 7], [1, 1, 1, 100], [5, 9, 2, 3, 40], [2, 2, 2, 2, 2, 2, 2], [11, 1, 1]]) {
      const { pastilles, reste } = pastillesJour(ns.map((n, dossier) => ({ dossier, n })));
      expect(pastilles).toHaveLength(12);
      expect(reste).toBe(ns.reduce((a, b) => a + b, 0) - 12);
      // Chaque dossier présent, sans dépasser ses éléments.
      ns.forEach((n, dossier) => {
        const k = pastilles.filter((p) => p === dossier).length;
        expect(k).toBeGreaterThanOrEqual(1);
        expect(k).toBeLessThanOrEqual(n);
      });
    }
  });
});
