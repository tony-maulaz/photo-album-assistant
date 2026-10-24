import { describe, expect, it } from 'vitest';
import { appliquerDecalages, DOSSIER_CAPTURES, ecarterDoublonsExacts, rangerCaptures } from '../src/lib/inventaire';
import { Historique, planVide, type FichierPlan, type Plan } from '../src/lib/plan';

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
    expect(p.dossiers.get(f.dossier)!.nom).toBe(DOSSIER_CAPTURES);
    h.annuler(p);
    expect(p.fichiers.get('Screenshot_1.png')!.capture).toBeUndefined();
    expect([...p.dossiers.values()].some((d) => d.nom === DOSSIER_CAPTURES)).toBe(false);
  });

  it('met les copies exactes de côté', () => {
    const p = plan();
    ecarterDoublonsExacts(p, [{ garde: 'a.jpg', copies: [{ id: 'c.jpg', type: 'identique' }] }]);
    expect(p.fichiers.get('c.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons_exacts' });
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
