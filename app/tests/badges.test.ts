// Badges d'origine (D112) : l'origine de chaque décision dans le plan, les gestes de Floues (clic sur la bande,
// second clic, G, X, Suppr, Ctrl+Z), les comptes de l'étape et la reprise des projets ouverts avant les badges.

import { describe, expect, it } from 'vitest';
import { accepter, choisir, type GroupeDoublons } from '../src/lib/groupesDoublons';
import {
  aJugerParIA,
  appliquerFloues,
  basculerFlou,
  deciderFlou,
  estAvant,
  etatFlou,
  origineFlou,
  photosConcernees,
  raisonAvis,
  resumeFloues,
  suivreAvisFlou,
  type AvisFlou,
  type EtatFlou,
} from '../src/lib/floues';
import { repriseOrigine, reprendreOrigines } from '../src/lib/origines';
import { avecOrigine, deplacerFichiers, depuisJson, ecarterDoublons, garderAussi, Historique, planVide, RACINE, remettre, versJson, type FichierPlan, type Plan } from '../src/lib/plan';

const photo = (id: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({
  id,
  nom: `${id}.jpg`,
  taille: 1,
  modifie: 0,
  categorie: 'photo',
  date: '2026-07-21T10:00:00',
  origineDate: 'exif',
  dossier: 'd1',
  statut: 'archive',
  ...extra,
});

function plan(...photos: FichierPlan[]): Plan {
  const p = planVide();
  p.dossiers.set('d1', { id: 'd1', nom: 'Annecy', parent: RACINE, origine: 'source', traitement: 'trier' });
  for (const f of photos) p.fichiers.set(f.id, f);
  return p;
}

const NETTETES: Record<string, number> = { floue: 12, limite: 55, nette: 400, ancienne: 300, f1: 10, f2: 11, f3: 12, f4: 13, f5: 14, f6: 15, n1: 200 };
const nettete = (f: FichierPlan) => NETTETES[f.id];

/** Les états de toutes les photos concernées, comme la page les calcule. */
function etats(p: Plan, seuil = 60, avis: Record<string, AvisFlou> = {}): Map<string, EtatFlou> {
  const concernees = photosConcernees(p);
  const limites = new Set(aJugerParIA(concernees, nettete, seuil, avis).map((f) => f.id));
  return new Map(concernees.map((f) => [f.id, etatFlou(f, nettete(f), seuil, avis[f.id], limites.has(f.id))]));
}

describe('badges de Floues : les gestes', () => {
  it('un clic donne l’autre sort, décidé par vous ; un second clic rend la proposition', () => {
    const p = plan(photo('floue'));
    const h = new Historique();
    expect(etats(p).get('floue')).toMatchObject({ sort: 'ecarter', qui: 'reglage' });
    h.enregistrer(basculerFlou(p, 'floue', 12, 60));
    expect(p.fichiers.get('floue')).toMatchObject({ flou: 'sauvee', origine: { flou: 'vous' } });
    expect(etats(p).get('floue')).toMatchObject({ sort: 'garder', qui: 'vous', proposition: 'ecarter' });
    h.enregistrer(basculerFlou(p, 'floue', 12, 60));
    expect(p.fichiers.get('floue')!.flou).toBeUndefined();
    expect(p.fichiers.get('floue')!.origine).toBeUndefined();
    expect(etats(p).get('floue')).toMatchObject({ sort: 'ecarter', qui: 'reglage' });
    // Ctrl+Z défait chaque geste : le second clic, puis le premier.
    h.annuler(p);
    expect(p.fichiers.get('floue')).toMatchObject({ flou: 'sauvee', origine: { flou: 'vous' } });
    h.annuler(p);
    expect(p.fichiers.get('floue')!.flou).toBeUndefined();
    h.retablir(p);
    expect(p.fichiers.get('floue')!.flou).toBe('sauvee');
  });

  it('une photo nette : le clic l’écarte, par vous', () => {
    const p = plan(photo('nette'));
    basculerFlou(p, 'nette', 400, 60);
    expect(etats(p).get('nette')).toMatchObject({ sort: 'ecarter', qui: 'vous' });
  });

  it('G et X fixent un sort par vous, même celui de la proposition : il ne bouge plus avec le réglage', () => {
    const p = plan(photo('floue'), photo('nette'));
    const h = new Historique();
    h.enregistrer(deciderFlou(p, ['floue'], 'ecartee'));
    h.enregistrer(deciderFlou(p, ['nette'], 'sauvee'));
    expect(p.fichiers.get('floue')).toMatchObject({ flou: 'ecartee', origine: { flou: 'vous' } });
    // Réglage très tolérant : la floue resterait, mais elle est écartée par vous.
    expect(etats(p, 5).get('floue')).toMatchObject({ sort: 'ecarter', qui: 'vous', proposition: 'garder' });
    expect(etats(p, 1000).get('nette')).toMatchObject({ sort: 'garder', qui: 'vous', proposition: 'ecarter' });
    h.annuler(p);
    expect(p.fichiers.get('nette')!.flou).toBeUndefined();
  });

  it('Suppr retire mon choix : la photo revient au réglage ; sans décision, rien à annuler', () => {
    const p = plan(photo('floue'));
    deciderFlou(p, ['floue'], 'sauvee');
    const m = deciderFlou(p, ['floue'], undefined);
    expect(m?.libelle).toBe('Retirer mon choix sur 1 photo');
    expect(p.fichiers.get('floue')!.flou).toBeUndefined();
    expect(deciderFlou(p, ['floue'], undefined)).toBeNull();
  });

  it('« Garder » et « Écarter » disent leur geste pour « Annuler : … »', () => {
    const p = plan(photo('floue'), photo('nette'));
    expect(deciderFlou(p, ['floue'], 'sauvee')!.libelle).toBe('Garder 1 photo');
    expect(deciderFlou(p, ['nette'], 'ecartee')!.libelle).toBe('Écarter 1 photo');
  });

  it('« Écartée avant » : laissée écartée quel que soit le réglage ; un clic la garde, le second la rend « avant »', () => {
    const p = plan(photo('ancienne', { statut: 'mis_de_cote', raison: 'floues' }));
    expect(estAvant(p.fichiers.get('ancienne')!)).toBe(true);
    expect(etats(p).get('ancienne')).toMatchObject({ sort: 'ecarter', qui: 'avant' });
    expect(origineFlou(p.fichiers.get('ancienne')!)).toBe('avant');
    // Nette au réglage, elle reste mise de côté à « Valider ».
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('ancienne')).toMatchObject({ statut: 'mis_de_cote', raison: 'floues' });
    expect(p.fichiers.get('ancienne')!.flou).toBeUndefined();
    basculerFlou(p, 'ancienne', 300, 60);
    expect(p.fichiers.get('ancienne')).toMatchObject({ flou: 'sauvee', avant: true, origine: { flou: 'vous' } });
    basculerFlou(p, 'ancienne', 300, 60);
    expect(p.fichiers.get('ancienne')!.flou).toBeUndefined();
    expect(etats(p).get('ancienne')).toMatchObject({ sort: 'ecarter', qui: 'avant' });
    // Gardée, validée (elle revient), puis rendue : elle repart à la validation suivante.
    deciderFlou(p, ['ancienne'], 'sauvee');
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('ancienne')!.statut).toBe('archive');
    deciderFlou(p, ['ancienne'], undefined);
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('ancienne')).toMatchObject({ statut: 'mis_de_cote', raison: 'floues', avant: true });
    expect(p.fichiers.get('ancienne')!.flou).toBeUndefined();
  });

  it('« Suivre l’avis de l’IA » : une décision d’origine IA (plein ✦), un seul Ctrl+Z', () => {
    const p = plan(photo('limite'), photo('floue'));
    const avis: Record<string, AvisFlou> = { limite: { verdict: 'ratee', raison: 'bougé' }, floue: { verdict: 'flou_voulu', raison: 'filé' } };
    expect(etats(p, 60, avis).get('limite')).toMatchObject({ qui: 'ia', sort: 'ecarter' });
    expect(etats(p, 60, avis).get('floue')).toMatchObject({ qui: 'verifier', sort: 'ecarter' });
    const h = new Historique();
    h.enregistrer(suivreAvisFlou(p, ['limite', 'floue'], avis));
    expect(p.fichiers.get('limite')).toMatchObject({ flou: 'ecartee', origine: { flou: 'ia' } });
    expect(p.fichiers.get('floue')).toMatchObject({ flou: 'sauvee', origine: { flou: 'ia' } });
    expect(etats(p, 60, avis).get('floue')).toMatchObject({ qui: 'ia-suivi', sort: 'garder' });
    // Le filtre « Par vous » ne compte que la punaise : un avis suivi n'y est pas (le compte dit ce que montre la grille).
    const r = resumeFloues(photosConcernees(p), etats(p, 60, avis), nettete);
    expect(r).toMatchObject({ faitesParVous: 0, parIA: { gardees: 1, ecartees: 1 } });
    h.enregistrer(deciderFlou(p, ['limite'], 'sauvee'));
    expect(resumeFloues(photosConcernees(p), etats(p, 60, avis), nettete).faitesParVous).toBe(1);
    h.annuler(p);
    h.annuler(p);
    expect(p.fichiers.get('limite')!.flou).toBeUndefined();
    expect(p.fichiers.get('floue')!.flou).toBeUndefined();
  });

  it('un avis illisible dans aides.json n’est jamais suivi (règle d’or 6)', () => {
    const p = plan(photo('limite'));
    expect(suivreAvisFlou(p, ['limite'], { limite: { verdict: 'peut-être' } })).toBeNull();
  });

  it('la raison de l’IA n’est lue que si c’est un texte (règle d’or 6)', () => {
    expect(raisonAvis({ verdict: 'ratee', raison: ' bougé ' })).toBe('bougé');
    expect(raisonAvis({ verdict: 'ratee' })).toBeUndefined();
    expect(raisonAvis({ verdict: 'ratee', raison: 42 })).toBeUndefined();
    expect(raisonAvis({ verdict: 'ratee', raison: '  ' })).toBeUndefined();
  });

  it('remise depuis « Mis de côté » par l’utilisateur : « Gardée par vous » ; remise par « Valider » : rien ne change', () => {
    // Remise à la main : comme un clic sur sa bande, elle est gardée par vous et garde sa marque « Écartée avant ».
    const p = plan(photo('ancienne', { statut: 'mis_de_cote', raison: 'floues' }));
    reprendreOrigines(p, {});
    expect(p.fichiers.get('ancienne')!.avant).toBe(true);
    const h = new Historique();
    h.enregistrer(remettre(p, ['ancienne']));
    expect(p.fichiers.get('ancienne')).toMatchObject({ statut: 'archive', flou: 'sauvee', avant: true });
    expect(origineFlou(p.fichiers.get('ancienne')!)).toBe('vous');
    expect(etats(p).get('ancienne')).toMatchObject({ qui: 'vous', sort: 'garder' });
    // « Valider » ne la renvoie plus dans « Mis de côté ».
    appliquerFloues(p, nettete, 60);
    expect(p.fichiers.get('ancienne')!.statut).toBe('archive');
    // « Retirer mon choix » la rend « Écartée avant ».
    deciderFlou(p, ['ancienne'], undefined);
    expect(etats(p).get('ancienne')).toMatchObject({ qui: 'avant', sort: 'ecarter' });
    // Ctrl+Z rend la mise de côté, sans décision.
    const q = plan(photo('ancienne', { statut: 'mis_de_cote', raison: 'floues', avant: true }));
    const hq = new Historique();
    hq.enregistrer(remettre(q, ['ancienne']));
    hq.annuler(q);
    expect(q.fichiers.get('ancienne')).toMatchObject({ statut: 'mis_de_cote', avant: true });
    expect(q.fichiers.get('ancienne')!.flou).toBeUndefined();
    expect(origineFlou(q.fichiers.get('ancienne')!)).toBe('avant');
    // Déplacée vers un dossier : même chose qu'une remise.
    deplacerFichiers(q, ['ancienne'], 'd1');
    expect(q.fichiers.get('ancienne')).toMatchObject({ flou: 'sauvee', avant: true });
    expect(origineFlou(q.fichiers.get('ancienne')!)).toBe('vous');
    // Écartée par le réglage puis remise à la main : gardée par vous, le réglage ne la reprend plus.
    const a = plan(photo('floue', { statut: 'mis_de_cote', raison: 'floues', flou: 'auto' }));
    remettre(a, ['floue']);
    expect(a.fichiers.get('floue')).toMatchObject({ statut: 'archive', flou: 'sauvee' });
    expect(origineFlou(a.fichiers.get('floue')!)).toBe('vous');
    // Gardée à Floues puis validée : remise par l'étape, elle garde sa marque (« Retirer mon choix » la rend « avant »).
    const r = plan(photo('ancienne', { statut: 'mis_de_cote', raison: 'floues' }));
    deciderFlou(r, ['ancienne'], 'sauvee');
    appliquerFloues(r, nettete, 60);
    expect(r.fichiers.get('ancienne')).toMatchObject({ statut: 'archive', avant: true });
    // Gardée par vous et déjà dans le tri : la déplacer de dossier ne change rien à sa marque.
    r.dossiers.set('d2', { id: 'd2', nom: 'Lyon', parent: RACINE, origine: 'source', traitement: 'trier' });
    deplacerFichiers(r, ['ancienne'], 'd2');
    expect(r.fichiers.get('ancienne')).toMatchObject({ dossier: 'd2', avant: true });
  });

  it('reprise d’un ancien projet : une photo des anciens scripts déjà gardée reçoit la marque « Écartée avant »', () => {
    const p = plan(photo('_a_supprimer/vieille', { flou: 'sauvee' }), photo('Lyon/autre', { flou: 'sauvee' }));
    reprendreOrigines(p, {});
    expect(p.fichiers.get('_a_supprimer/vieille')).toMatchObject({ avant: true, origine: { flou: 'vous' } });
    expect(p.fichiers.get('Lyon/autre')!.avant).toBeUndefined();
  });
});

describe('badges de Floues : à vérifier et comptes', () => {
  it('à vérifier : proche du réglage sans avis, ou l’IA n’est pas d’accord ; une décision ne l’est plus', () => {
    const p = plan(photo('limite'), photo('nette'), photo('floue'));
    expect(etats(p).get('limite')).toMatchObject({ qui: 'verifier', sort: 'ecarter' });
    expect(etats(p).get('nette')!.qui).toBe('reglage');
    deciderFlou(p, ['limite'], 'sauvee');
    expect(etats(p).get('limite')!.qui).toBe('vous');
    // L'IA n'a plus à juger une photo décidée.
    expect(aJugerParIA(photosConcernees(p), nettete, 60, {}).map((f) => f.id)).toEqual([]);
  });

  it('les comptes : 6 trop floues, 2 gardées par vous, 1 nette écartée par vous → 5 seront écartées', () => {
    const p = plan(...['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'n1'].map((id) => photo(id)));
    deciderFlou(p, ['f1', 'f2'], 'sauvee');
    deciderFlou(p, ['n1'], 'ecartee');
    const r = resumeFloues(photosConcernees(p), etats(p), nettete);
    expect(r).toMatchObject({ total: 7, seront: 5, parReglage: 4, parVous: { gardees: 2, ecartees: 1 }, faitesParVous: 3, avant: 0 });
    // « Valider » écarte bien ce nombre.
    appliquerFloues(p, nettete, 60);
    expect([...p.fichiers.values()].filter((f) => f.statut === 'mis_de_cote')).toHaveLength(5);
  });
});

describe('origine des décisions de Doublons', () => {
  const rafale: GroupeDoublons = {
    cle: 'rafale:a',
    sorte: 'rafales',
    etoile: 'a',
    section: 'jour:2026-07-21',
    membres: [
      { id: 'a', garder: true },
      { id: 'b', garder: false, raison: 'quasi identique' },
      { id: 'c', garder: false, raison: 'quasi identique' },
    ],
  };

  it('un groupe accepté : l’application ; un choix photo par photo : vous', () => {
    const p = plan(photo('a'), photo('b'), photo('c'));
    accepter(p, [rafale]);
    expect(p.fichiers.get('b')).toMatchObject({ statut: 'mis_de_cote', origine: { doublons: 'application' } });
    const q = plan(photo('a'), photo('b'), photo('c'));
    choisir(q, rafale, 'c', true);
    accepter(q, [rafale]);
    expect(q.fichiers.get('a')).toMatchObject({ statut: 'mis_de_cote', origine: { doublons: 'vous' } });
    expect(q.fichiers.get('c')).toMatchObject({ statut: 'archive', protegee: true, origine: { doublons: 'vous' } });
  });

  it('une même scène acceptée vient de l’IA ; « Garder aussi » est un geste de l’utilisateur', () => {
    const p = plan(photo('a'), photo('b'), photo('c'));
    accepter(p, [{ ...rafale, cle: 'ia:a', sorte: 'ia' }]);
    expect(p.fichiers.get('b')!.origine).toEqual({ doublons: 'ia' });
    garderAussi(p, ['b']);
    expect(p.fichiers.get('b')).toMatchObject({ statut: 'archive', origine: { doublons: 'vous' } });
  });

  it('une origine tombe avec sa décision : doublon remis ou déplacé, photo gardée puis écartée', () => {
    const p = plan(photo('a'), photo('b'), photo('c'));
    accepter(p, [rafale]);
    const h = new Historique();
    h.enregistrer(remettre(p, ['b']));
    expect(p.fichiers.get('b')!.statut).toBe('archive');
    expect(p.fichiers.get('b')!.origine).toBeUndefined();
    h.annuler(p);
    expect(p.fichiers.get('b')!.origine).toEqual({ doublons: 'application' });
    deplacerFichiers(p, ['c'], 'd1');
    expect(p.fichiers.get('c')!.origine).toBeUndefined();
    // Gardée volontairement parmi des copies exactes, puis écartée dans une rafale : seule la nouvelle décision reste.
    const q = plan(photo('a', { protegee: true, origine: { doublons_exacts: 'vous', flou: 'vous' }, flou: 'sauvee' }));
    ecarterDoublons(q, [{ id: 'a', raison: 'doublons' }]);
    expect(q.fichiers.get('a')).toMatchObject({ statut: 'mis_de_cote', origine: { doublons: 'vous', flou: 'vous' } });
    expect(q.fichiers.get('a')!.origine!.doublons_exacts).toBeUndefined();
    expect(q.fichiers.get('a')!.protegee).toBeUndefined();
  });

  it('avecOrigine retire la clé, et l’objet quand il est vide', () => {
    const f = avecOrigine(photo('a'), 'flou', 'vous');
    expect(f.origine).toEqual({ flou: 'vous' });
    expect(avecOrigine(f, 'flou', undefined).origine).toBeUndefined();
  });
});

describe('reprise des projets ouverts avant les badges', () => {
  it('un choix photo par photo devient « par vous », un avis suivi « IA », une photo des anciens scripts « avant »', () => {
    const p = plan(
      photo('gardee', { flou: 'sauvee' }),
      photo('suivie', { flou: 'ecartee' }),
      photo('contre', { flou: 'sauvee' }),
      photo('ancienne', { statut: 'mis_de_cote', raison: 'floues' }),
      photo('auto', { statut: 'mis_de_cote', raison: 'floues', flou: 'auto' }),
      photo('rien'),
    );
    const avis = { suivie: { verdict: 'ratee', raison: 'bougé' }, contre: { verdict: 'ratee', raison: 'bougé' } };
    expect(reprendreOrigines(p, avis)).toBe(4);
    expect(p.fichiers.get('gardee')!.origine).toEqual({ flou: 'vous' });
    expect(p.fichiers.get('suivie')!.origine).toEqual({ flou: 'ia' });
    // L'IA disait « ratée », elle a été gardée : c'est un choix de l'utilisateur.
    expect(p.fichiers.get('contre')!.origine).toEqual({ flou: 'vous' });
    expect(p.fichiers.get('ancienne')).toMatchObject({ avant: true });
    expect(origineFlou(p.fichiers.get('ancienne')!)).toBe('avant');
    expect(p.fichiers.get('auto')!.origine).toBeUndefined();
    expect(p.fichiers.get('rien')!.origine).toBeUndefined();
    // Une seule fois : la reprise suivante ne change rien.
    expect(reprendreOrigines(p, avis)).toBe(0);
  });

  it('un groupe de doublons accepté devient « application » (✓), une même scène « IA » (✦)', () => {
    const rafale = repriseOrigine(photo('b', { statut: 'mis_de_cote', raison: 'doublons', doublon: { garde: 'a', source: 'rafale' } }), {});
    const scene = repriseOrigine(photo('c', { statut: 'mis_de_cote', raison: 'doublons', doublon: { garde: 'a', source: 'ia' } }), {});
    const copie = repriseOrigine(photo('d', { statut: 'mis_de_cote', raison: 'doublons_exacts' }), {});
    expect(rafale.origine).toEqual({ doublons: 'application' });
    expect(scene.origine).toEqual({ doublons: 'ia' });
    expect(copie.origine).toEqual({ doublons_exacts: 'application' });
  });

  it('une photo gardée volontairement (« Garder aussi », choisie, « Tout garder ») est « par vous », dans sa famille', () => {
    // Le code d'aujourd'hui écrit « vous » pour ces gestes : un ancien projet reçoit la même origine.
    expect(repriseOrigine(photo('e', { protegee: true }), {}).origine).toEqual({ doublons: 'vous' });
    // Copie exacte d'une autre photo (même empreinte) : la famille des copies exactes.
    const p = plan(photo('e', { protegee: true, empreinte: 'abc' }), photo('f', { statut: 'mis_de_cote', raison: 'doublons_exacts', empreinte: 'abc' }), photo('g', { protegee: true, empreinte: 'xyz' }));
    reprendreOrigines(p, {});
    expect(p.fichiers.get('e')!.origine).toEqual({ doublons_exacts: 'vous' });
    expect(p.fichiers.get('f')!.origine).toEqual({ doublons_exacts: 'application' });
    expect(p.fichiers.get('g')!.origine).toEqual({ doublons: 'vous' });
    // Même cas, même origine, que le projet soit ancien ou neuf.
    const q = plan(photo('h', { statut: 'mis_de_cote', raison: 'doublons' }));
    garderAussi(q, ['h']);
    expect(q.fichiers.get('h')!.origine).toEqual(repriseOrigine({ ...q.fichiers.get('h')!, origine: undefined }, {}).origine);
  });

  it('un avis illisible ne fait pas une origine IA', () => {
    expect(repriseOrigine(photo('x', { flou: 'ecartee' }), { x: { verdict: 42 } }).origine).toEqual({ flou: 'vous' });
  });
});

describe('reprise d’un fichier .album/plan.json écrit avant les badges', () => {
  // Un plan.json tel que l'écrivaient les versions d'avant D112 : des décisions, aucune origine.
  const ancien = JSON.stringify({
    version: 1,
    prochainId: 2,
    dossiers: [
      { id: RACINE, nom: '', parent: null, origine: 'source', traitement: 'trier' },
      { id: 'd1', nom: 'Annecy', parent: RACINE, origine: 'source', traitement: 'trier' },
    ],
    fichiers: [
      photo('gardee', { flou: 'sauvee' }),
      photo('suivie', { flou: 'ecartee', statut: 'mis_de_cote', raison: 'floues' }),
      photo('_a_supprimer/ancienne', { statut: 'mis_de_cote', raison: 'floues' }),
      photo('auto', { flou: 'auto', statut: 'mis_de_cote', raison: 'floues' }),
      photo('copie', { statut: 'mis_de_cote', raison: 'doublons_exacts' }),
      photo('rafale', { statut: 'mis_de_cote', raison: 'doublons', doublon: { garde: 'gardee', source: 'rafale' } }),
      photo('rien'),
    ],
  });

  it('lu, repris, réécrit puis relu : les origines restent, la reprise ne change plus rien', () => {
    const p = depuisJson(JSON.parse(ancien));
    const avis = { suivie: { verdict: 'ratee', raison: 'bougé' } };
    expect(reprendreOrigines(p, avis)).toBe(5);
    const relu = depuisJson(JSON.parse(JSON.stringify(versJson(p))));
    expect(relu.fichiers.get('gardee')).toMatchObject({ flou: 'sauvee', origine: { flou: 'vous' } });
    expect(relu.fichiers.get('suivie')).toMatchObject({ flou: 'ecartee', origine: { flou: 'ia' } });
    expect(relu.fichiers.get('_a_supprimer/ancienne')).toMatchObject({ avant: true, statut: 'mis_de_cote' });
    expect(relu.fichiers.get('copie')!.origine).toEqual({ doublons_exacts: 'application' });
    expect(relu.fichiers.get('rafale')!.origine).toEqual({ doublons: 'application' });
    expect(relu.fichiers.get('auto')!.origine).toBeUndefined();
    expect(relu.fichiers.get('rien')).toEqual(JSON.parse(ancien).fichiers.find((f: FichierPlan) => f.id === 'rien'));
    expect(reprendreOrigines(relu, avis)).toBe(0);
    // Les états de Floues après la reprise : par vous, IA suivie, « Écartée avant ».
    const e = etats(relu);
    expect(e.get('gardee')).toMatchObject({ qui: 'vous', sort: 'garder' });
    expect(e.get('_a_supprimer/ancienne')).toMatchObject({ qui: 'avant', sort: 'ecarter' });
  });

  it('un geste après la reprise s’annule sans défaire la reprise', () => {
    const p = depuisJson(JSON.parse(ancien));
    reprendreOrigines(p, {});
    const h = new Historique();
    h.enregistrer(basculerFlou(p, 'gardee', 12, 60));
    expect(p.fichiers.get('gardee')!.flou).toBeUndefined();
    h.annuler(p);
    expect(p.fichiers.get('gardee')).toMatchObject({ flou: 'sauvee', origine: { flou: 'vous' } });
    expect(h.annuler(p)).toBeFalsy();
  });
});
