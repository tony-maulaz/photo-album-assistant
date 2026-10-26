// Résultat du tri automatique en cartes (D103) : voyage avec ses étapes,
// sorties, maison, ce qui est mis à part, petites sorties et leur mois.

import { describe, expect, it } from 'vitest';
import { planVide, RACINE, type FichierPlan, type InfoTri, type Plan } from '../src/lib/plan';
import { moisDeLaSortie, petitesSorties, repartis, resultatTri } from '../src/lib/resultatTri';

/** Plan d'essai : chemin → [info du tri du dernier dossier, dates des photos] ; les parents prennent `parents[nom]`. */
function plan(dossiers: Record<string, [InfoTri | undefined, string[]]>, parents: Record<string, InfoTri> = {}): Plan {
  const p = planVide();
  for (const [chemin, [info, dates]] of Object.entries(dossiers)) {
    let parent = RACINE;
    const parties = chemin.split('/');
    parties.forEach((nom, i) => {
      const id = `d:${parties.slice(0, i + 1).join('/')}`;
      const tri = i === parties.length - 1 ? info : parents[nom];
      if (!p.dossiers.has(id)) p.dossiers.set(id, { id, nom, parent, origine: 'tri', ...(tri ? { tri } : {}) });
      parent = id;
    });
    dates.forEach((date, k) => {
      const id = `${chemin}/IMG_${k}.jpg`;
      const f: FichierPlan = { id, nom: `IMG_${k}.jpg`, taille: 100, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier: parent, statut: 'archive' };
      p.fichiers.set(id, f);
    });
  }
  return p;
}

const maison: InfoTri = { origine: 'lieu_connu', lieu: 'Maison' };
const gps: InfoTri = { origine: 'gps', lieu: 'Lyon' };

describe('resultatTri', () => {
  const p = plan(
    {
      'Maison/06.25': [maison, ['2025-06-02T10:00:00', '2025-06-20T10:00:00']],
      'Maison/24-25.12.25': [maison, ['2025-12-24T18:00:00', '2025-12-25T10:00:00']],
      'Voyage_Paris_10-12.07.25/Paris_10-11.07.25': [{ origine: 'etape', lieu: 'Paris' }, ['2025-07-10T10:00:00', '2025-07-11T10:00:00']],
      'Voyage_Paris_10-12.07.25/Versailles_12.07.25': [{ origine: 'etape', lieu: 'Versailles' }, ['2025-07-12T10:00:00']],
      'Lyon_05.06.25': [gps, ['2025-06-05T15:00:00']],
      'Annecy_15.06.25': [{ origine: 'gps', lieu: 'Annecy' }, ['2025-06-15T09:00:00', '2025-06-15T10:00:00', '2025-06-15T11:00:00']],
      _sans_date: [{ origine: 'sans_lieu' }, ['2024-01-01']],
      '_videos_non_classees/2025-08': [{ origine: 'sans_lieu' }, ['2025-08-01T10:00:00']],
    },
    { Maison: maison, 'Voyage_Paris_10-12.07.25': { origine: 'voyage', lieu: 'Paris' } },
  );
  const r = resultatTri(p, 'Maison');

  it('une carte par voyage, sortie et dossier de la maison, dans l’ordre du temps', () => {
    expect(r.cartes.map((c) => [c.nom, c.sorte])).toEqual([
      ['06.25', 'maison'],
      ['Lyon_05.06.25', 'sortie'],
      ['Annecy_15.06.25', 'sortie'],
      ['Voyage_Paris_10-12.07.25', 'voyage'],
      ['24-25.12.25', 'maison'],
    ]);
  });

  it('un voyage porte ses étapes, ses dates et toutes ses photos', () => {
    const v = r.cartes.find((c) => c.sorte === 'voyage')!;
    expect(v.etapes.map((e) => [e.nom, e.fichiers.length])).toEqual([
      ['Paris_10-11.07.25', 2],
      ['Versailles_12.07.25', 1],
    ]);
    expect([v.du, v.au, v.fichiers.length]).toEqual(['2025-07-10', '2025-07-12', 3]);
  });

  it('sans date et vidéos seules sont mis à part, pas en cartes', () => {
    expect(r.sansDate).toHaveLength(1);
    expect(r.videosSeules).toHaveLength(1);
    expect(r.captures).toHaveLength(0);
  });

  it('sans domicile connu, les sous-dossiers d’un lieu connu sont des sorties', () => {
    expect(resultatTri(p).cartes.filter((c) => c.sorte === 'maison')).toHaveLength(0);
  });

  it('une capture d’écran rangée est mise à part', () => {
    const q = plan({ Captures_ecran: [undefined, []], 'Lyon_05.06.25': [gps, ['2025-06-05T15:00:00']] });
    q.fichiers.set('cap.png', { id: 'cap.png', nom: 'cap.png', taille: 1, modifie: 0, categorie: 'photo', date: '2025-06-01', dossier: RACINE, statut: 'archive', capture: true });
    expect(resultatTri(q).captures.map((f) => f.id)).toEqual(['cap.png']);
  });

  it('une petite sortie va avec la maison de son mois', () => {
    const petites = petitesSorties(r);
    expect(petites.map((c) => c.nom)).toEqual(['Lyon_05.06.25']);
    expect(moisDeLaSortie(r, petites[0])).toBe('d:Maison/06.25');
    // Pas de photo à la maison ce mois-là : rien à proposer.
    const q = plan({ 'Lyon_05.03.25': [gps, ['2025-03-05T15:00:00']] });
    const rq = resultatTri(q, 'Maison');
    expect(moisDeLaSortie(rq, petitesSorties(rq)[0])).toBeNull();
  });
});

describe('repartis', () => {
  it('garde le premier, le dernier et des éléments entre les deux', () => {
    expect(repartis([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 5, 9]);
    expect(repartis([1, 2], 6)).toEqual([1, 2]);
  });
});
