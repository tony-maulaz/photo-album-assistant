import { describe, expect, it } from 'vitest';
import { deplacerFichiers, Historique, RACINE, type Plan } from '../src/lib/plan';
import { comparerSource, integrerSource, planInitial, type ElementSource } from '../src/lib/source';

const element = (chemin: string, taille = 100, extra: Partial<ElementSource> = {}): ElementSource => ({
  chemin,
  taille,
  modifie: 1_750_000_000_000,
  categorie: chemin.endsWith('.txt') ? 'autre' : 'photo',
  exif: { date: '2026:06:12 10:00:00', modele: 'SM-G780G' },
  ...extra,
});

/** Un dossier en vrac déjà trié une première fois, avec des décisions. */
function projet(): Plan {
  const plan = planInitial([element('a.jpg'), element('b.jpg'), element('c.jpg'), element('Divers/x.jpg'), element('BESTOF/y.jpg')]).plan;
  plan.dossiers.set('s:Divers', { ...plan.dossiers.get('s:Divers')!, traitement: 'trier' });
  plan.dossiers.set('s:BESTOF', { ...plan.dossiers.get('s:BESTOF')!, traitement: 'nettoyer' });
  // Le tri a rangé la racine et « Divers » dans « Annecy », et supprimé « Divers » devenu vide.
  plan.dossiers.set('n1', { id: 'n1', nom: 'Annecy_2026-06-12', parent: RACINE, origine: 'tri' });
  deplacerFichiers(plan, ['a.jpg', 'b.jpg', 'c.jpg', 'Divers/x.jpg'], 'n1');
  plan.dossiers.delete('s:Divers');
  plan.fichiers.set('a.jpg', { ...plan.fichiers.get('a.jpg')!, album: 2, legende: 'Au bord du lac' });
  return plan;
}

describe('mise à jour de l’inventaire (D63)', () => {
  it('compare la source relue au plan : nouveaux, modifiés, disparus', () => {
    const plan = projet();
    const liste = [
      { chemin: 'a.jpg', taille: 150, modifie: 1_750_000_000_000 },
      { chemin: 'b.jpg', taille: 100, modifie: 1_750_000_000_000 },
      { chemin: 'Divers/x.jpg', taille: 100, modifie: 1_750_000_000_000 },
      { chemin: 'BESTOF/y.jpg', taille: 100, modifie: 1_750_000_000_000 },
      { chemin: 'juillet.jpg', taille: 100, modifie: 1 },
      { chemin: '.album/plan.json', taille: 9, modifie: 1 },
    ];
    expect(comparerSource(plan, liste)).toEqual({ nouveaux: ['juillet.jpg'], modifies: ['a.jpg'], disparus: ['c.jpg'] });
  });

  it('ajoute les nouvelles photos sans toucher aux décisions, et s’annule d’un coup', () => {
    const plan = projet();
    const instantane = (p: Plan) => JSON.stringify([...p.fichiers.entries()].sort((x, y) => x[0].localeCompare(y[0])));
    const avant = instantane(plan);
    const r = integrerSource(
      plan,
      [element('juillet.jpg'), element('BESTOF/z.jpg'), element('Divers/w.jpg'), element('Nouveau/n.jpg'), element('a.jpg', 150)],
      ['b.jpg', 'c.jpg'],
      { quand: '2026-07-20T10:00:00.000Z', vrac: true, dansLaSortie: (id) => id === 'b.jpg' },
    );
    expect(r).toMatchObject({ ajoutes: 4, modifies: 1, retires: ['c.jpg'], gardesSansSource: ['b.jpg'] });
    // À trier à la racine, marquée comme ajoutée.
    expect(plan.fichiers.get('juillet.jpg')).toMatchObject({ dossier: RACINE, ajout: '2026-07-20T10:00:00.000Z', statut: 'archive' });
    // Dans un dossier gardé : elle y va.
    expect(plan.fichiers.get('BESTOF/z.jpg')!.dossier).toBe('s:BESTOF');
    // « Divers » avait été trié : recréé, toujours « à trier ».
    expect(plan.dossiers.get('s:Divers')).toMatchObject({ parent: RACINE, traitement: 'trier' });
    expect(plan.fichiers.get('Divers/w.jpg')!.dossier).toBe('s:Divers');
    // Nouveau sous-dossier : il garde sa place et sera nettoyé (choix à l'étape « Dossiers »).
    expect(plan.dossiers.get('s:Nouveau')).toMatchObject({ traitement: 'nettoyer' });
    // Photo modifiée : relue, ses décisions et sa place gardées.
    expect(plan.fichiers.get('a.jpg')).toMatchObject({ taille: 150, album: 2, legende: 'Au bord du lac', dossier: 'n1' });
    // Disparue mais déjà copiée : gardée ; disparue avant copie : retirée.
    expect(plan.fichiers.has('b.jpg')).toBe(true);
    expect(plan.fichiers.has('c.jpg')).toBe(false);
    // Les photos déjà triées n'ont pas bougé.
    expect(plan.fichiers.get('Divers/x.jpg')!.dossier).toBe('n1');
    const h = new Historique();
    h.enregistrer(r.modification);
    h.annuler(plan);
    expect(instantane(plan)).toBe(avant);
    expect(plan.dossiers.has('s:Nouveau')).toBe(false);
  });

  it('dossier déjà trié : un nouveau sous-dossier n’a pas de choix à faire', () => {
    const plan = planInitial([element('Plage/a.jpg')]).plan;
    integrerSource(plan, [element('Montagne/b.jpg')], [], { quand: 'q', vrac: false, dansLaSortie: () => false });
    expect(plan.dossiers.get('s:Montagne')!.traitement).toBeUndefined();
    expect(plan.fichiers.get('Montagne/b.jpg')!.dossier).toBe('s:Montagne');
  });
});
