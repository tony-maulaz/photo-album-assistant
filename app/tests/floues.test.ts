import { describe, expect, it } from 'vitest';
import { appliquerFloues, compterFloues, deciderFlou, photosConcernees, SEUIL_FLOU } from '../src/lib/floues';
import { Historique, planVide, type FichierPlan, type Plan } from '../src/lib/plan';

function plan(): Plan {
  const p = planVide();
  p.dossiers.set('d1', { id: 'd1', nom: 'Vrac', parent: 'racine', origine: 'source', traitement: 'trier' });
  p.dossiers.set('g', { id: 'g', nom: 'BESTOF', parent: 'racine', origine: 'source', traitement: 'garder' });
  const photo = (id: string, dossier: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({
    id, nom: `${id}.jpg`, taille: 1, modifie: 0, categorie: 'photo', date: '2026-07-21T10:00:00', origineDate: 'exif', dossier, statut: 'archive', ...extra,
  });
  for (const f of [photo('nette', 'd1'), photo('floue', 'd1'), photo('limite', 'd1'), photo('gardee', 'g'), photo('ancienne', 'd1', { statut: 'mis_de_cote', raison: 'floues' })]) p.fichiers.set(f.id, f);
  return p;
}
const nettetes: Record<string, number> = { nette: 400, floue: 12, limite: 70, gardee: 5, ancienne: 300 };
const nettete = (f: FichierPlan) => nettetes[f.id];

describe('photos floues (étape 3)', () => {
  it('le seuil calibré du script 01 est 60', () => expect(SEUIL_FLOU).toBe(60));

  it('ne touche pas aux dossiers gardés tels quels', () => {
    expect(photosConcernees(plan()).map((f) => f.id).sort()).toEqual(['ancienne', 'floue', 'limite', 'nette']);
  });

  it('compte en direct et applique le seuil, en une opération annulable', () => {
    const p = plan();
    expect(compterFloues(photosConcernees(p), nettete, 60)).toBe(1);
    expect(compterFloues(photosConcernees(p), nettete, 100)).toBe(2);
    const h = new Historique();
    h.enregistrer(appliquerFloues(p, nettete, 100));
    expect(p.fichiers.get('floue')).toMatchObject({ statut: 'mis_de_cote', raison: 'floues', flou: 'auto' });
    expect(p.fichiers.get('limite')!.statut).toBe('mis_de_cote');
    // Seuil abaissé : la photo « limite » revient, l'ancienne (script) reste écartée.
    h.enregistrer(appliquerFloues(p, nettete, 60));
    expect(p.fichiers.get('limite')!.statut).toBe('archive');
    expect(p.fichiers.get('limite')!.flou).toBeUndefined();
    expect(p.fichiers.get('ancienne')!.statut).toBe('mis_de_cote');
    h.annuler(p);
    expect(p.fichiers.get('limite')!.statut).toBe('mis_de_cote');
  });

  it('sauver et écarter à la main l’emportent sur le seuil', () => {
    const p = plan();
    deciderFlou(p, ['floue', 'ancienne'], 'sauvee');
    deciderFlou(p, ['nette'], 'ecartee');
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('floue')!.statut).toBe('archive');
    expect(p.fichiers.get('ancienne')!.statut).toBe('archive');
    expect(p.fichiers.get('nette')!.statut).toBe('mis_de_cote');
  });
});

describe('revenir au seuil après validation', () => {
  it('une photo écartée par le seuil puis « laissée au seuil » revient si le seuil baisse', () => {
    const p = plan();
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('floue')!.statut).toBe('mis_de_cote');
    deciderFlou(p, ['floue'], 'ecartee');
    deciderFlou(p, ['floue'], undefined);
    expect(p.fichiers.get('floue')!.flou).toBe('auto');
    appliquerFloues(p, nettete, 10);
    expect(p.fichiers.get('floue')!.statut).toBe('archive');
  });
});
