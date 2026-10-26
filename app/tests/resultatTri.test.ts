// Résultat du tri automatique en lignes (D103, D104) : depuis le plan (après
// le rangement) et depuis l'arborescence proposée (aperçu en direct) ; voyage
// avec ses étapes, sorties, maison, distance, noms provisoires, mis à part.

import { describe, expect, it } from 'vitest';
import type { LieuConnu } from '../src/lib/config';
import { planVide, RACINE, type FichierPlan, type InfoTri, type Plan } from '../src/lib/plan';
import { compteSortes, repereLigne, resultatDuPlan, resultatPropose } from '../src/lib/resultatTri';
import type { DossierPropose } from '../src/lib/tri';

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

const MAISON: LieuConnu = { id: 'Maison', nom: 'Maison', lat: 45, lon: 5, rayon_m: 300, domicile: true, un_seul_dossier: false, notes: '' };
const maison: InfoTri = { origine: 'lieu_connu', lieu: 'Maison', lat: 45, lon: 5 };
const PARIS = { lat: 48.8584, lon: 2.2945 };

describe('resultatDuPlan', () => {
  const p = plan(
    {
      'Maison/06.25': [maison, ['2025-06-02T10:00:00', '2025-06-20T10:00:00']],
      'Maison/24-25.12.25': [maison, ['2025-12-24T18:00:00', '2025-12-25T10:00:00']],
      'Voyage_Paris_10-12.07.25/Paris_10-11.07.25': [{ origine: 'etape', lieu: 'Paris', ...PARIS }, ['2025-07-10T10:00:00', '2025-07-11T10:00:00']],
      'Voyage_Paris_10-12.07.25/Versailles_12.07.25': [{ origine: 'etape', lieu: 'Versailles', lat: 48.8049, lon: 2.1204 }, ['2025-07-12T10:00:00']],
      'Lyon_05.06.25': [{ origine: 'gps', lieu: 'Lyon', lat: 45.76, lon: 4.84 }, ['2025-06-05T15:00:00']],
      _sans_date: [{ origine: 'sans_lieu' }, ['2024-01-01']],
      '_videos_non_classees/2025-08': [{ origine: 'sans_lieu' }, ['2025-08-01T10:00:00']],
    },
    { Maison: maison, 'Voyage_Paris_10-12.07.25': { origine: 'voyage', lieu: 'Paris' } },
  );
  const r = resultatDuPlan(p, MAISON);

  it('une ligne par voyage, sortie et dossier de la maison, dans l’ordre du temps', () => {
    expect(r.lignes.map((l) => [l.nom, l.sorte])).toEqual([
      ['06.25', 'maison'],
      ['Lyon_05.06.25', 'sortie'],
      ['Voyage_Paris_10-12.07.25', 'voyage'],
      ['24-25.12.25', 'maison'],
    ]);
    expect(compteSortes(r)).toEqual({ voyage: 1, sortie: 1, maison: 2 });
  });

  it('un voyage porte ses étapes, ses dates, ses photos et la distance de sa plus lointaine étape', () => {
    const v = r.lignes.find((l) => l.sorte === 'voyage')!;
    expect(v.etapes.map((e) => [e.nom, e.photos])).toEqual([
      ['Paris_10-11.07.25', 2],
      ['Versailles_12.07.25', 1],
    ]);
    expect([v.du, v.au, v.photos]).toEqual(['2025-07-10', '2025-07-12', 3]);
    expect(v.km).toBe(Math.max(...v.etapes.map((e) => e.km!)));
    expect(v.km).toBeGreaterThan(400);
    // La maison n'a pas de distance ; une sortie a la sienne.
    expect(r.lignes[0].km).toBeUndefined();
    expect(r.lignes[1].km).toBeGreaterThan(10);
  });

  it('sans date et vidéos seules sont mises à part', () => {
    expect([r.sansDate, r.videosSeules, r.captures]).toEqual([1, 1, 0]);
  });

  it('sans domicile connu, les sous-dossiers d’un lieu connu sont des sorties, sans distance', () => {
    const sans = resultatDuPlan(p);
    expect(sans.lignes.filter((l) => l.sorte === 'maison')).toHaveLength(0);
    expect(sans.lignes.every((l) => l.km === undefined)).toBe(true);
  });

  it('un voyage d’un seul dossier : la distance du centre de ses photos situées', () => {
    const q = plan({ 'Voyage_Paris_10-11.07.25': [{ origine: 'voyage', lieu: 'Paris' }, ['2025-07-10T10:00:00', '2025-07-11T10:00:00']] });
    for (const f of q.fichiers.values()) f.gps = PARIS;
    expect(resultatDuPlan(q, MAISON).lignes[0].km).toBeGreaterThan(400);
  });

  it('une capture d’écran rangée est comptée à part', () => {
    const q = plan({ 'Lyon_05.06.25': [{ origine: 'gps', lieu: 'Lyon' }, ['2025-06-05T15:00:00']] });
    q.fichiers.set('cap.png', { id: 'cap.png', nom: 'cap.png', taille: 1, modifie: 0, categorie: 'photo', date: '2025-06-01', dossier: RACINE, statut: 'archive', capture: true });
    expect(resultatDuPlan(q).captures).toBe(1);
  });
});

describe('resultatPropose (aperçu en direct, D104)', () => {
  const fichiers = new Map<string, Pick<FichierPlan, 'categorie' | 'date'>>([
    ['a', { categorie: 'photo', date: '2026-03-14T10:00:00' }],
    ['b', { categorie: 'photo', date: '2026-03-15T10:00:00' }],
    ['c', { categorie: 'video', date: '2026-03-15T11:00:00' }],
    ['d', { categorie: 'photo', date: '2026-03-20T10:00:00' }],
    ['e', { categorie: 'photo', date: '2026-04-02T10:00:00' }],
    ['x', { categorie: 'photo', date: '2020-01-01' }],
  ]);
  const dossiers: DossierPropose[] = [
    { chemin: ['Voyage_Lieu_01_14-15.03.26', 'Lieu_02_14.03.26'], photos: ['a'], sorte: 'voyage', info: { origine: 'etape', lieu: 'Lieu_02' }, infoParent: { origine: 'voyage', lieu: 'Lieu_01' }, km: 300, nomProvisoire: true },
    { chemin: ['Voyage_Lieu_01_14-15.03.26', 'Lieu_01_15.03.26'], photos: ['b', 'c'], sorte: 'voyage', info: { origine: 'etape', lieu: 'Lieu_01' }, infoParent: { origine: 'voyage', lieu: 'Lieu_01' }, km: 450, nomProvisoire: true },
    { chemin: ['Annecy_20.03.26'], photos: ['d'], sorte: 'sortie', info: { origine: 'gps', lieu: 'Annecy' }, km: 40, evenement: 'Ski' },
    { chemin: ['Maison', '04.26'], photos: ['e'], sorte: 'maison', info: { origine: 'lieu_connu', lieu: 'Maison' } },
    { chemin: ['_sans_date'], photos: ['x'], sorte: 'sans_lieu', info: { origine: 'sans_lieu' } },
  ];
  const r = resultatPropose(dossiers, (id) => fichiers.get(id), 3);

  it('les étapes d’un voyage réunies sous lui ; un lieu sans nom est signalé provisoire', () => {
    expect(r.lignes.map((l) => [l.sorte, l.nom, l.provisoire])).toEqual([
      ['voyage', 'Voyage_Lieu_01_14-15.03.26', true],
      ['sortie', 'Annecy_20.03.26', false],
      ['maison', '04.26', false],
    ]);
    const v = r.lignes[0];
    expect([v.photos, v.videos, v.km, v.du, v.au]).toEqual([2, 1, 450, '2026-03-14', '2026-03-15']);
    expect(v.etapes.map((e) => [e.provisoire, e.photos])).toEqual([
      [true, 1],
      [true, 2],
    ]);
    expect(r.lignes[1].evenement).toBe('Ski');
  });

  it('une photo mise de côté (copie, floue) n’est pas comptée', () => {
    const avecCopie = resultatPropose([dossiers[3]], (id) => (id === 'e' ? { ...fichiers.get('e')!, statut: 'mis_de_cote' } : fichiers.get(id)));
    expect(avecCopie.lignes).toHaveLength(0);
  });

  it('mis à part : captures, sans date', () => {
    expect([r.captures, r.sansDate, r.videosSeules]).toEqual([3, 1, 0]);
  });

  it('une ligne se retrouve d’un réglage à l’autre par sa sorte et ses dates, pas son nom', () => {
    expect(repereLigne(r.lignes[0])).toBe('voyage|2026-03-14|2026-03-15');
  });
});
