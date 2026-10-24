import { describe, expect, it } from 'vitest';
import { planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';
import { dossiersNouveaux, etiquettesJours, fichiersSousDossiers, premierDossierAvecPhotos, rangsEvenements } from '../src/lib/rangement';

/** Petit plan : dossiers (chemin → nombre de photos), datées du 1er janvier. */
function plan(dossiers: Record<string, number>): Plan {
  const p = planVide();
  for (const [chemin, n] of Object.entries(dossiers)) {
    let parent = RACINE;
    const parties = chemin.split('/');
    parties.forEach((nom, i) => {
      const id = `d:${parties.slice(0, i + 1).join('/')}`;
      if (!p.dossiers.has(id)) p.dossiers.set(id, { id, nom, parent, origine: 'tri' });
      parent = id;
    });
    for (let k = 0; k < n; k++) {
      const f: FichierPlan = { id: `${chemin}/IMG_${k}.jpg`, nom: `IMG_${k}.jpg`, taille: 1, modifie: 0, categorie: 'photo', date: `2026-01-0${k + 1}T10:00:00`, dossier: parent, statut: 'archive' };
      p.fichiers.set(f.id, f);
    }
  }
  return p;
}

describe('lieux et sorties : dossier ouvert et dossiers faits de sous-dossiers', () => {
  it('ouvre le premier dossier qui a des photos, dans l’ordre du panneau, les dossiers techniques en dernier', () => {
    expect(premierDossierAvecPhotos(plan({ _videos_non_classees: 1, 'Maison/2025-01-05': 2, Annecy: 0, Zurich: 1 }))).toBe('d:Maison/2025-01-05');
    expect(premierDossierAvecPhotos(plan({ '_videos_non_classees/2026-01': 1, Vide: 0 }))).toBe('d:_videos_non_classees/2026-01');
    expect(premierDossierAvecPhotos(plan({ Vide: 0 }))).toBeNull();
  });

  it('un dossier fait seulement de sous-dossiers montre leurs photos', () => {
    const p = plan({ 'Maison/A': 2, 'Maison/B/C': 1, Autre: 1 });
    expect(fichiersSousDossiers(p, 'd:Maison').map((f) => f.id)).toEqual(['Maison/A/IMG_0.jpg', 'Maison/B/C/IMG_0.jpg', 'Maison/A/IMG_1.jpg']);
    expect(fichiersSousDossiers(p, RACINE)).toHaveLength(4);
  });

  it('nouveautés d’une mise à jour de l’inventaire, tant qu’elles ne sont pas dans la sortie', () => {
    const p = plan({ Annecy: 2, Zurich: 1 });
    p.fichiers.set('Annecy/IMG_1.jpg', { ...p.fichiers.get('Annecy/IMG_1.jpg')!, ajout: '2026-10-24T10:00:00Z' });
    p.fichiers.set('Zurich/IMG_0.jpg', { ...p.fichiers.get('Zurich/IMG_0.jpg')!, ajout: '2026-10-24T10:00:00Z' });
    expect([...dossiersNouveaux(p, () => false)]).toEqual([
      ['d:Annecy', 1],
      ['d:Zurich', 1],
    ]);
    expect([...dossiersNouveaux(p, (id) => id.startsWith('Zurich'))]).toEqual([['d:Annecy', 1]]);
  });
});

describe('ligne de temps', () => {
  it('dates sous les colonnes : jamais collées, la première, les mois et les sauts d’abord', () => {
    // 28.06 puis 15.07 : deux colonnes voisines, qui s'écrivaient « 28.0615.07 ».
    const colonnes = ['2026-03-21', '2026-03-22', '2026-06-28', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'];
    const e = etiquettesJours(colonnes);
    expect([...e]).toEqual([
      [0, '21.03.26'],
      [3, '15.07'],
      [10, '22.07'],
    ]);
    const indices = [...e.keys()];
    for (let i = 1; i < indices.length; i++) expect(indices[i] - indices[i - 1]).toBeGreaterThanOrEqual(3);
    // L'année revient quand elle change.
    expect([...etiquettesJours(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])]).toEqual([
      [0, '30.12.25'],
      [3, '02.01.26'],
    ]);
  });

  it('événements du calendrier sur des rangées où leurs noms ne se touchent pas', () => {
    expect(rangsEvenements([{ debut: 0, fin: 120 }, { debut: 44, fin: 100 }, { debut: 130, fin: 200 }, { debut: 60, fin: 70 }])).toEqual([0, 1, 0, 2]);
  });
});
