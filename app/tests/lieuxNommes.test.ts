// Lieux nommés du projet et correction d'un nom (fenêtre « Vos lieux » du Tri, D112 point 9) : les lieux de la
// configuration où des photos ont été prises, la maison d'abord ; corriger un nom renomme les dossiers qui portent
// encore le nom automatique, pas ceux renommés à la main ; Ctrl+Z défait tout.

import { describe, expect, it } from 'vitest';
import type { LieuConnu } from '../src/lib/config';
import { dossiersDuLieu, lieuxNommesDuProjet, renommerLieu } from '../src/lib/lieuxNommes';
import { Historique, planVide, RACINE, type DossierPlan, type InfoTri, type Plan } from '../src/lib/plan';
import { reparties } from '../src/lib/resultatTri';

const lieu = (id: string, nom: string, lat: number, lon: number, domicile = false): LieuConnu => ({ id, nom, lat, lon, rayon_m: 200, domicile, un_seul_dossier: false, notes: '' });
const MAISON = lieu('maison', 'Maison', 45, 5, true);
const MAMIE = lieu('mamie', 'Chez_Mamie', 45.5, 5.5);
const CLUB = lieu('club', 'Club', 46, 6);

describe('lieuxNommesDuProjet', () => {
  const photos = [
    { id: 'a', nom: 'a.jpg', date: '2026-03-02T10:00:00', gps: { lat: 45.5, lon: 5.5 } },
    { id: 'b', nom: 'b.jpg', date: '2026-03-01T10:00:00', gps: { lat: 45.5005, lon: 5.5 } },
    { id: 'c', nom: 'c.jpg', date: '2026-03-01T12:00:00', gps: { lat: 45.5, lon: 5.5005 } },
    { id: 'd', nom: 'd.jpg', date: '2026-03-04T10:00:00', gps: { lat: 47, lon: 7 } },
    { id: 'e', nom: 'e.jpg', date: '2026-03-04T10:00:00' },
  ];

  it('les lieux où des photos ont été prises, la maison toujours et d’abord ; les photos dans l’ordre du temps', () => {
    const r = lieuxNommesDuProjet(photos, [CLUB, MAMIE, MAISON]);
    expect(r.map((x) => [x.lieu.id, x.photos, x.jours])).toEqual([
      ['maison', [], 0],
      ['mamie', ['b', 'c', 'a'], 2],
    ]);
  });

  it('sans lieu connu, rien', () => {
    expect(lieuxNommesDuProjet(photos, [])).toEqual([]);
  });
});

/** Un dossier du tri : nom automatique (`tri.nom`), sauf `renomme`. */
function plan(dossiers: { id: string; nom: string; parent?: string; tri: InfoTri; renomme?: string }[]): Plan {
  const p = planVide();
  for (const d of dossiers) {
    const x: DossierPlan = { id: d.id, nom: d.renomme ?? d.nom, parent: d.parent ?? RACINE, origine: 'tri', tri: { ...d.tri, nom: d.nom } };
    p.dossiers.set(d.id, x);
  }
  return p;
}

describe('renommerLieu (corriger un nom dans « Nommés »)', () => {
  const p = plan([
    { id: 'm1', nom: 'Chez_Mamie_12.03.25', tri: { origine: 'gps', lieu: 'Chez_Mamie', lat: 45.5, lon: 5.5 } },
    { id: 'm2', nom: 'Anniversaire_Chez_Mamie_14.04.25', tri: { origine: 'gps', lieu: 'Chez_Mamie', lat: 45.5001, lon: 5.5 } },
    { id: 'm3', nom: 'Chez_Mamie_20.05.25', renomme: 'Paques_chez_les_grands-parents', tri: { origine: 'gps', lieu: 'Chez_Mamie', lat: 45.5, lon: 5.5 } },
    // Une commune homonyme loin du lieu : pas touchée.
    { id: 'loin', nom: 'Chez_Mamie_01.06.25', tri: { origine: 'gps', lieu: 'Chez_Mamie', lat: 48, lon: 2 } },
    // Un voyage dont une étape est chez Mamie : son nom suit.
    { id: 'v', nom: 'Voyage_Chez_Mamie_01-03.08.25', tri: { origine: 'voyage', lieu: 'Chez_Mamie' } },
    { id: 'v1', nom: 'Chez_Mamie_01-02.08.25', parent: 'v', tri: { origine: 'etape', lieu: 'Chez_Mamie', lat: 45.5, lon: 5.5 } },
    { id: 'v2', nom: 'Lyon_03.08.25', parent: 'v', tri: { origine: 'etape', lieu: 'Lyon', lat: 45.76, lon: 4.84 } },
    // Déjà un dossier du nouveau nom à côté : pas de collision.
    { id: 'pris', nom: 'Chez_Mamie_et_Papi_12.03.25', tri: { origine: 'gps', lieu: 'Autre', lat: 40, lon: 1 } },
  ]);

  it('compte ce qui sera renommé et ce qui garde son nom', () => {
    const r = dossiersDuLieu(p, MAMIE);
    expect(r.automatiques.map((d) => d.id).sort()).toEqual(['m1', 'm2', 'v', 'v1']);
    expect(r.renommes.map((d) => d.id)).toEqual(['m3']);
  });

  it('les noms automatiques changent, un nom donné à la main reste ; Ctrl+Z défait tout', () => {
    const h = new Historique();
    const m = renommerLieu(p, MAMIE, 'Chez_Mamie_et_Papi');
    h.enregistrer(m);
    const nom = (id: string) => p.dossiers.get(id)!.nom;
    expect(['m1', 'm2', 'm3', 'loin', 'v', 'v1', 'v2'].map(nom)).toEqual([
      'Chez_Mamie_et_Papi_12.03.25_2',
      'Anniversaire_Chez_Mamie_et_Papi_14.04.25',
      'Paques_chez_les_grands-parents',
      'Chez_Mamie_01.06.25',
      'Voyage_Chez_Mamie_et_Papi_01-03.08.25',
      'Chez_Mamie_et_Papi_01-02.08.25',
      'Lyon_03.08.25',
    ]);
    // Toujours automatiques : le nom du tri suit ; le lieu est noté partout.
    expect(p.dossiers.get('m2')!.tri).toMatchObject({ lieu: 'Chez_Mamie_et_Papi', nom: 'Anniversaire_Chez_Mamie_et_Papi_14.04.25' });
    expect(p.dossiers.get('m3')!.tri).toMatchObject({ lieu: 'Chez_Mamie_et_Papi', nom: 'Chez_Mamie_20.05.25' });
    expect(p.dossiers.get('loin')!.tri!.lieu).toBe('Chez_Mamie');
    expect(m?.detail).toBe('Renommer le lieu « Chez_Mamie » en « Chez_Mamie_et_Papi »');
    h.annuler(p);
    expect(['m1', 'm2', 'm3', 'v'].map(nom)).toEqual(['Chez_Mamie_12.03.25', 'Anniversaire_Chez_Mamie_14.04.25', 'Paques_chez_les_grands-parents', 'Voyage_Chez_Mamie_01-03.08.25']);
    expect(p.dossiers.get('m3')!.tri!.lieu).toBe('Chez_Mamie');
  });

  it('la maison : son dossier prend le nom, ses mois gardent le leur et restent ceux de la maison', () => {
    const q = plan([
      { id: 'mx', nom: 'Maison', tri: { origine: 'lieu_connu', lieu: 'Maison', lat: 45, lon: 5 } },
      { id: 'mx1', nom: '07.25', parent: 'mx', tri: { origine: 'lieu_connu', lieu: 'Maison', lat: 45, lon: 5 } },
    ]);
    renommerLieu(q, MAISON, 'Notre_maison');
    expect([q.dossiers.get('mx')!.nom, q.dossiers.get('mx1')!.nom]).toEqual(['Notre_maison', '07.25']);
    expect(q.dossiers.get('mx1')!.tri!.lieu).toBe('Notre_maison');
  });

  it('aucun dossier du lieu : rien à faire', () => {
    expect(renommerLieu(plan([]), CLUB, 'Club_de_judo')).toBeNull();
  });
});

describe('reparties (dépliant d’un dossier)', () => {
  it('au plus n, le premier et le dernier compris', () => {
    expect(reparties([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 5, 9]);
    expect(reparties([1, 2], 8)).toEqual([1, 2]);
    expect(reparties([1, 2, 3], 1)).toEqual([1]);
  });
});
