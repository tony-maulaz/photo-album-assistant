import { describe, expect, it } from 'vitest';
import { appliquerDecalages, rangerCaptures, ressembleACapture, resumeSource } from '../src/lib/inventaire';
import { definirLangueSortie, nomsSortie } from '../src/lib/sortie';
import { deplacerFichiers, Historique, mettreDeCote, planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';

function plan(): Plan {
  const p = planVide();
  const f = (id: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({ id, nom: id, taille: 1, modifie: 0, categorie: 'photo', date: '2026-07-21T10:00:00', origineDate: 'exif', dossier: 'racine', statut: 'archive', ...extra });
  for (const x of [f('Screenshot_1.png'), f('a.jpg', { appareil: 'Galaxy A54 5G' }), f('b.jpg', { appareil: 'Galaxy S25' }), f('c.jpg')]) p.fichiers.set(x.id, x);
  return p;
}

describe('propositions de l’inventaire (étape 2)', () => {
  it('range les captures dans Captures_ecran, en une opération annulable', () => {
    const p = plan();
    const h = new Historique();
    h.enregistrer(rangerCaptures(p, ['Screenshot_1.png']));
    const f = p.fichiers.get('Screenshot_1.png')!;
    expect(f.capture).toBe(true);
    expect(p.dossiers.get(f.dossier)!.nom).toBe(nomsSortie().captures);
    h.annuler(p);
    expect(p.fichiers.get('Screenshot_1.png')!.capture).toBeUndefined();
    expect([...p.dossiers.values()].some((d) => d.nom === nomsSortie().captures)).toBe(false);
  });

  it('dans un projet en anglais, les captures vont dans « Screenshots » (D60)', () => {
    definirLangueSortie('en');
    try {
      const p = plan();
      rangerCaptures(p, ['Screenshot_1.png']);
      expect(p.dossiers.get(p.fichiers.get('Screenshot_1.png')!.dossier)!.nom).toBe('Screenshots');
    } finally {
      definirLangueSortie('fr');
    }
  });

  it('les photos décochées restent dans le tri et ne sont plus proposées', () => {
    const p = plan();
    p.fichiers.set('d.png', { ...p.fichiers.get('c.jpg')!, id: 'd.png', nom: 'Screenshot_2.png' });
    expect(ressembleACapture(p.fichiers.get('d.png')!)).toBe(true);
    const h = new Historique();
    h.enregistrer(rangerCaptures(p, ['Screenshot_1.png'], ['d.png']));
    expect(p.fichiers.get('Screenshot_1.png')!.capture).toBe(true);
    expect(p.fichiers.get('d.png')).toMatchObject({ capture: false, dossier: RACINE });
    expect(ressembleACapture(p.fichiers.get('d.png')!)).toBe(false);
    // Un seul Ctrl+Z défait tout.
    h.annuler(p);
    expect(p.fichiers.get('d.png')!.capture).toBeUndefined();
    expect(p.fichiers.get('Screenshot_1.png')!.capture).toBeUndefined();
    // Toutes décochées : seulement gardées dans le tri.
    const m = rangerCaptures(p, [], ['Screenshot_1.png', 'd.png']);
    expect(m?.libelle).toBe('Garder 2 photos dans le tri');
    expect([...p.dossiers.values()].some((d) => d.nom === nomsSortie().captures)).toBe(false);
  });

  it('une vraie photo au format d’un écran de téléphone n’est pas proposée (GPS, ou appareil et date EXIF)', () => {
    const vraie: FichierPlan = { id: 'p.jpg', nom: 'p.jpg', taille: 1, modifie: 0, categorie: 'photo', date: '2025-05-24T20:58:29', origineDate: 'exif', dossier: RACINE, statut: 'archive', dims: { l: 1080, h: 1920 } };
    expect(ressembleACapture(vraie)).toBe(true);
    expect(ressembleACapture({ ...vraie, gps: { lat: 46.5, lon: 6.6 } })).toBe(false);
    expect(ressembleACapture({ ...vraie, nom: 'Screenshot_1.jpg', marque: 'samsung' })).toBe(false);
    expect(ressembleACapture({ ...vraie, nom: 'Screenshot_1.jpg', marque: 'samsung', origineDate: 'fichier' })).toBe(true);
  });

  it('résume la source d’après les chemins : les chiffres ne bougent pas quand le plan change', () => {
    const p = planVide();
    const f = (id: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({ id, nom: id.split('/').pop()!, taille: 1, modifie: 0, categorie: 'photo', dossier: RACINE, statut: 'archive', ...extra });
    for (const x of [
      f('a.jpg'),
      f('b.mp4', { categorie: 'video' }),
      f('notes.txt', { categorie: 'autre' }),
      f('Annecy/1.jpg'),
      f('Annecy/2.jpg'),
      f('Annecy/3.jpg'),
      f('2025/Paleo/1.jpg'),
      f('_a_supprimer/flou.jpg', { statut: 'mis_de_cote', raison: 'floues' }),
    ])
      p.fichiers.set(x.id, x);
    const attendu = { photos: 6, videos: 1, autres: 1, dossiers: 4, aLaRacine: 2, petitsDossiers: 2 };
    expect(resumeSource(p)).toEqual(attendu);
    // Après un tri et une mise de côté, la source n'a pas changé.
    p.dossiers.set('n1', { id: 'n1', nom: 'Lieu_01', parent: RACINE, origine: 'tri' });
    deplacerFichiers(p, ['a.jpg', 'Annecy/1.jpg'], 'n1');
    mettreDeCote(p, ['Annecy/2.jpg'], 'doublons');
    expect(resumeSource(p)).toEqual(attendu);
  });

  it('corrige l’heure d’un appareil sans cumuler les décalages', () => {
    const p = plan();
    appliquerDecalages(p, [{ modele: 'Galaxy A54 5G', decalage: '+01:30' }]);
    expect(p.fichiers.get('a.jpg')!.date).toBe('2026-07-21T11:30:00');
    expect(p.fichiers.get('b.jpg')!.date).toBe('2026-07-21T10:00:00');
    appliquerDecalages(p, [{ modele: 'Galaxy A54 5G', decalage: '-00:30' }]);
    expect(p.fichiers.get('a.jpg')!.date).toBe('2026-07-21T09:30:00');
    appliquerDecalages(p, []);
    expect(p.fichiers.get('a.jpg')!.date).toBe('2026-07-21T10:00:00');
    expect(p.fichiers.get('a.jpg')!.decalage).toBeUndefined();
  });
});
