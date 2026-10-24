import { describe, expect, it } from 'vitest';
import { planVide, type FichierPlan, type Plan } from '../src/lib/plan';
import { analyserDoublons, lotsDoublons, photosLot } from '../src/navigateur/doublons';
import type { Analyses } from '../src/navigateur/analyses';
import type { EtatProjet } from '../src/navigateur/projet';
import { arborescenceValidee, CODES_ETAPES, ETAPE, etapeInutile, etapePrecedente, etapeSuivante, migrerEtapes, nouveauProjet, parcours } from '../src/navigateur/projet';

describe('étapes (D54)', () => {
  it('treize étapes : « Dossiers » après l’inventaire, les doublons après les floues, le tri automatique séparé des lieux et sorties (D61)', () => {
    expect(CODES_ETAPES).toEqual(['projet', 'inventaire', 'dossiers', 'floues', 'doublons', 'tri', 'lieux', 'petits', 'nommage', 'consolidation', 'selection', 'album', 'sortie']);
    expect(ETAPE.doublons).toBe(5);
    expect(ETAPE.sortie).toBe(13);
  });

  it('« Dossiers » est sautée sans sous-dossier, et pour un dossier déjà trié', () => {
    expect(etapeSuivante('vrac', 'inventaire')).toBe('dossiers');
    expect(etapeSuivante('vrac', 'inventaire', true)).toBe('floues');
    expect(etapePrecedente('vrac', 'floues', true)).toBe('inventaire');
    expect(etapeInutile('vrac', 'dossiers', true)).toBe(true);
    expect(etapeInutile('vrac', 'dossiers')).toBe(false);
    expect(etapeInutile('deja_trie', 'dossiers')).toBe(true);
  });

  it('« Valider et continuer » suit le parcours du mode', () => {
    expect(parcours('deja_trie')).toEqual(['projet', 'inventaire', 'doublons', 'lieux', 'selection', 'album', 'sortie']);
    expect(etapeSuivante('vrac', 'floues')).toBe('doublons');
    expect(etapeSuivante('vrac', 'doublons')).toBe('tri');
    expect(etapeSuivante('vrac', 'consolidation')).toBe('selection');
    expect(etapeSuivante('deja_trie', 'inventaire')).toBe('doublons');
    expect(etapeSuivante('deja_trie', 'doublons')).toBe('lieux');
    expect(etapeSuivante('deja_trie', 'lieux')).toBe('selection');
    // Une étape hors du parcours (ouverte par la frise) mène à la suivante du parcours.
    expect(etapeSuivante('deja_trie', 'nommage')).toBe('selection');
    expect(etapeSuivante('vrac', 'sortie')).toBeNull();
  });

  it('« Revenir » remonte le même parcours', () => {
    expect(etapePrecedente('vrac', 'tri')).toBe('doublons');
    expect(etapePrecedente('vrac', 'selection')).toBe('consolidation');
    expect(etapePrecedente('deja_trie', 'selection')).toBe('lieux');
    expect(etapePrecedente('deja_trie', 'doublons')).toBe('inventaire');
    expect(etapePrecedente('vrac', 'projet')).toBeNull();
  });

  it('le tri automatique est inutile pour un dossier déjà trié', () => {
    expect(etapeInutile('deja_trie', 'tri')).toBe(true);
    expect(etapeInutile('vrac', 'tri')).toBe(false);
    expect(etapeInutile('deja_trie', 'lieux')).toBe(false);
  });

  it('la sortie reste possible quand l’arborescence, validée une fois, est repassée « à revoir »', () => {
    const p = nouveauProjet('Essai', 'deja_trie', { nom: 'source', fichiers: 0, octets: 0 }, 50);
    expect(arborescenceValidee(p)).toBe(false);
    p.etapes[ETAPE.lieux - 1] = 'validee';
    expect(arborescenceValidee(p)).toBe(true);
    p.etapes[ETAPE.lieux - 1] = 'a_revoir';
    expect(arborescenceValidee(p)).toBe(true);
  });

  it('un projet à onze étapes est converti au nouvel ordre', () => {
    const p = nouveauProjet('Essai', 'vrac', { nom: 'source', fichiers: 0, octets: 0 }, 50);
    // Ancien ordre : projet, inventaire, floues, lieux, petits, nommage, consolidation, doublons, sélection, album, sortie.
    p.etapes = ['validee', 'validee', 'validee', 'validee', 'validee', 'en_cours', 'a_faire', 'a_revoir', 'a_faire', 'a_faire', 'a_faire'];
    p.tri = { rayonKm: 2 };
    expect(migrerEtapes(p)).toBe(true);
    expect(p.etapes).toEqual(['validee', 'validee', 'validee', 'validee', 'a_revoir', 'validee', 'validee', 'validee', 'en_cours', 'a_faire', 'a_faire', 'a_faire', 'a_faire']);
    expect(migrerEtapes(p)).toBe(false);
    const d = nouveauProjet('Trié', 'deja_trie', { nom: 'source', fichiers: 0, octets: 0 }, 50);
    d.etapes = d.etapes.slice(0, 11);
    migrerEtapes(d);
    expect(d.etapes[ETAPE.tri - 1]).toBe('a_faire');
  });

  it('un projet à douze étapes reçoit l’étape « Dossiers », validée avec l’inventaire', () => {
    const p = nouveauProjet('Essai', 'vrac', { nom: 'source', fichiers: 0, octets: 0 }, 50);
    // Ordre du 23.10.2026 : projet, inventaire, floues, doublons, tri, lieux, petits, nommage, consolidation, sélection, album, sortie.
    p.etapes = ['validee', 'validee', 'validee', 'en_cours', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire'];
    expect(migrerEtapes(p)).toBe(true);
    expect(p.etapes).toEqual(['validee', 'validee', 'validee', 'validee', 'en_cours', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire', 'a_faire']);
    expect(migrerEtapes(p)).toBe(false);
  });
});

describe('lots des doublons', () => {
  function plan(): Plan {
    const p = planVide();
    p.dossiers.set('g', { id: 'g', nom: 'Anniversaire', parent: 'racine', origine: 'source', traitement: 'nettoyer' });
    p.dossiers.set('n', { id: 'n', nom: 'BESTOF', parent: 'racine', origine: 'source', traitement: 'garder' });
    p.dossiers.set('s', { id: 's', nom: 'Plage', parent: 'racine', origine: 'tri' });
    const photo = (id: string, dossier: string, date: string | undefined, extra: Partial<FichierPlan> = {}): FichierPlan => ({
      id, nom: `${id}.jpg`, taille: 1, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier, statut: 'archive', ...extra,
    });
    for (const f of [
      photo('a', 'racine', '2026-07-18T10:00:00'),
      photo('b', 'racine', '2026-07-18T10:00:05'),
      photo('c', 's', '2026-07-18T16:00:00'),
      photo('d', 'racine', '2026-07-19T09:00:00'),
      photo('e', 'g', '2026-07-18T11:00:00'),
      photo('f', 'g', '2026-07-19T11:00:00'),
      photo('h', 'n', '2026-07-18T11:00:00'),
      photo('i', 'n', '2026-07-18T11:00:01'),
      photo('capture', 'racine', '2026-07-18T12:00:00', { capture: true }),
      photo('ecartee', 'racine', '2026-07-18T13:00:00', { statut: 'mis_de_cote' }),
      photo('copie1', 'racine', '2026-10-01T09:00:00', { origineDate: 'fichier' }),
      photo('copie2', 'racine', '2026-10-01T09:05:00', { origineDate: 'fichier' }),
    ])
      p.fichiers.set(f.id, f);
    return p;
  }
  const analyses = { get: () => undefined } as unknown as Analyses;

  it('dossier en vrac : par journée, tous dossiers à trier confondus ; « Garder, nettoyer » à part, « Ne pas toucher » jamais comparé', () => {
    const p = plan();
    expect(lotsDoublons(p, true)).toEqual([
      { id: 'jour:2026-07-18', nom: '18.07.26' },
      { id: 'jour:sans', nom: 'Sans date' },
      { id: 'g', nom: 'Anniversaire' },
    ]);
    expect(photosLot(p, 'jour:sans', analyses).map((x) => x.id)).toEqual(['copie1', 'copie2']);
    expect(photosLot(p, 'jour:2026-07-18', analyses).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(photosLot(p, 'g', analyses).map((x) => x.id)).toEqual(['e', 'f']);
  });

  it('recherche arrêtée : les lots déjà traités sont gardés, et leur nombre est rendu pour le bilan', async () => {
    const p = plan();
    const lots = lotsDoublons(p, true).map((l) => l.id);
    let faits = 0;
    const options = {
      plan: p,
      etat: { ecrire: async () => undefined } as unknown as EtatProjet,
      analyses,
      dossiers: lots,
      strict: false,
      ia: null,
      miniature: async () => new Blob(),
      original: async () => new Blob(),
      progres: (n: number) => (faits = n),
    };
    const arretee = await analyserDoublons({ ...options, arreter: () => faits >= 1 });
    expect(arretee).toMatchObject({ faits: 1, arrete: true });
    expect(Object.keys(arretee.etat.dossiers)).toEqual([lots[0]]);
    faits = 0;
    const complete = await analyserDoublons({ ...options, arreter: () => false });
    expect(complete).toMatchObject({ faits: 3, arrete: false });
  });

  it('dossier déjà trié : par dossier, comme avant', () => {
    const p = plan();
    expect(lotsDoublons(p, false).map((l) => l.id)).toEqual(['g', 'racine']);
    expect(photosLot(p, 'racine', analyses).map((x) => x.id)).toEqual(['a', 'b', 'd', 'copie1', 'copie2']);
  });
});
