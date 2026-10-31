// Le cache des copies exactes par signature (ui/copiesExactes.ts, tour 2 de l'étape 2d) et le compte unique des
// copies restantes (frise, barre de Doublons, bandeau du Tri ; validation du 31.10).

import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';

const etat = vi.hoisted(() => ({ calculs: 0 }));

vi.mock('../src/ui/etat', () => ({ session: signal(null), versionIA: signal(0), versionPlan: signal(0) }));
vi.mock('../src/ui/analyseDossier', () => ({ analyseEnCours: signal(null), analyseAFaire: () => false }));
vi.mock('../src/lib/doublonsExacts', async (importOriginal) => {
  const vrai = await importOriginal<typeof import('../src/lib/doublonsExacts')>();
  return {
    ...vrai,
    groupesDoublonsExacts: (...args: Parameters<typeof vrai.groupesDoublonsExacts>) => {
      etat.calculs++;
      return vrai.groupesDoublonsExacts(...args);
    },
  };
});

const { copiesAAccepter, copiesExactesDuProjet, copiesRestantes } = await import('../src/ui/copiesExactes');
const { versionPlan } = await import('../src/ui/etat');
const { choisirTous, groupesCopies } = await import('../src/lib/groupesDoublons');

function photo(id: string, extra: Partial<FichierPlan> = {}): FichierPlan {
  return { id, nom: id.split('/').pop()!, taille: 1000, modifie: 0, categorie: 'photo', date: '2025-07-01T10:00:00', origineDate: 'exif', dossier: RACINE, statut: 'archive', empreinte: 'e1', ...extra };
}

function projet(): { plan: Plan; projet: { mode: 'vrac' }; analyses: { get: () => undefined } } {
  const plan = planVide();
  plan.dossiers.set('best', { id: 'best', nom: 'Best of', parent: RACINE, origine: 'source', traitement: 'nettoyer' });
  for (const f of [photo('a.jpg'), photo('Best of/a.jpg', { dossier: 'best' }), photo('b.jpg', { empreinte: 'e2' })]) plan.fichiers.set(f.id, f);
  return { plan, projet: { mode: 'vrac' }, analyses: { get: () => undefined } };
}

// Le cache est un module : chaque test part d'un plan neuf (autre objet), donc d'un calcul neuf.
beforeEach(() => {
  etat.calculs = 0;
});

describe('copies exactes : cache par signature', () => {
  it('un seul calcul tant que rien de ce qui fait les groupes ne change ; une ★ ne relance pas la recherche', () => {
    const s = projet() as never as Parameters<typeof copiesExactesDuProjet>[0];
    const g1 = copiesExactesDuProjet(s);
    expect(g1?.length).toBe(1);
    expect(etat.calculs).toBe(1);
    copiesExactesDuProjet(s);
    expect(etat.calculs).toBe(1);
    // La ★ de la Sélection, une rotation : le plan change de version, pas les groupes.
    s.plan.fichiers.set('b.jpg', { ...s.plan.fichiers.get('b.jpg')!, album: 1, rotation: 90 });
    versionPlan.value++;
    expect(copiesExactesDuProjet(s)).toBe(g1);
    expect(etat.calculs).toBe(1);
  });

  it('un déplacement (emplacement), une empreinte ou un dossier « Ne pas toucher » relancent la recherche', () => {
    const s = projet() as never as Parameters<typeof copiesExactesDuProjet>[0];
    copiesExactesDuProjet(s);
    expect(etat.calculs).toBe(1);
    // L'empreinte de b devient celle de a : un groupe de trois.
    s.plan.fichiers.set('b.jpg', { ...s.plan.fichiers.get('b.jpg')!, empreinte: 'e1' });
    versionPlan.value++;
    expect(copiesExactesDuProjet(s)?.[0].copies.length).toBe(2);
    expect(etat.calculs).toBe(2);
    // « Best of » ne se touche plus : ses copies sont voulues, elles sortent des groupes.
    s.plan.dossiers.set('best', { ...s.plan.dossiers.get('best')!, traitement: 'garder' });
    versionPlan.value++;
    const g = copiesExactesDuProjet(s)![0];
    expect([g.garde, ...g.copies.map((c) => c.id)].sort()).toEqual(['a.jpg', 'b.jpg']);
    expect(etat.calculs).toBe(3);
    // Un autre emplacement (la photo passe dans un dossier gardé et nettoyé).
    s.plan.dossiers.set('best', { ...s.plan.dossiers.get('best')!, traitement: 'nettoyer' });
    s.plan.fichiers.set('b.jpg', { ...s.plan.fichiers.get('b.jpg')!, dossier: 'best' });
    versionPlan.value++;
    copiesExactesDuProjet(s);
    expect(etat.calculs).toBe(4);
  });
});

describe('copies restantes : un seul compte (frise, barre de Doublons, bandeau du Tri)', () => {
  it('un groupe où vous avez écarté tous les exemplaires compte, mais « Les écarter ici » ne le valide pas', () => {
    const s = projet() as never as Parameters<typeof copiesExactesDuProjet>[0];
    const fichier = (id: string) => s.plan.fichiers.get(id);
    const groupes = groupesCopies(copiesExactesDuProjet(s)!, fichier);
    const avant = copiesAAccepter(groupes, fichier);
    expect([avant.n, avant.nAcceptables, avant.groupes.length, avant.acceptables.length]).toEqual([1, 1, 1, 1]);
    // Les deux exemplaires « à écarter », sans « Accepter ».
    choisirTous(s.plan, groupes[0], false);
    const apres = copiesAAccepter(groupes, fichier);
    expect([apres.n, apres.nAcceptables, apres.groupes.length, apres.acceptables.length]).toEqual([2, 0, 1, 0]);
    // La frise lit le même compte.
    versionPlan.value++;
    expect(copiesRestantes(s)).toBe(2);
  });
});
