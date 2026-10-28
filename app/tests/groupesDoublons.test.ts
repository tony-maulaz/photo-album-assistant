import { describe, expect, it } from 'vitest';
import {
  acceptablesSansVider,
  accepter,
  prochainAAccepter,
  aRelire,
  avancementGroupes,
  choisir,
  copiesEnAttente,
  ecarterTout,
  etatPhoto,
  exemplairesAEcarterDans,
  exemplairesEcartesDans,
  garderTout,
  groupesCopies,
  groupesScenes,
  groupeVisible,
  photosDuGroupe,
  type GroupeDoublons,
} from '../src/lib/groupesDoublons';
import { dossierSource, ecarterDoublons, garderAussi, Historique, mettreDeCote, planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';

function plan(): Plan {
  const p = planVide();
  p.dossiers.set('best', { id: 'best', nom: 'Best of', parent: RACINE, origine: 'source', traitement: 'nettoyer' });
  const f = (id: string, extra: Partial<FichierPlan> = {}): FichierPlan => ({
    id,
    nom: id.split('/').pop()!,
    taille: 1000,
    modifie: 0,
    categorie: 'photo',
    date: '2025-12-13T14:29:00',
    origineDate: 'exif',
    dossier: RACINE,
    statut: 'archive',
    ...extra,
  });
  for (const x of [
    f('a.jpg', { date: '2025-12-13T14:29:03' }),
    f('b.jpg', { date: '2025-12-13T14:29:04' }),
    f('c.jpg', { date: '2025-12-13T14:29:06' }),
    f('IMG_1.jpg'),
    f('Best of/IMG-WA1.jpg', { dossier: 'best', origineDate: 'fichier' }),
  ])
    p.fichiers.set(x.id, x);
  return p;
}

const rafale: GroupeDoublons = {
  cle: 'rafale:a',
  sorte: 'rafales',
  etoile: 'a',
  section: 'jour:2025-12-13',
  membres: [
    { id: 'a.jpg', garder: true },
    { id: 'b.jpg', garder: false, raison: 'quasi identique' },
    { id: 'c.jpg', garder: false, raison: 'quasi identique' },
  ],
};
rafale.etoile = 'a.jpg';

const etats = (p: Plan, g: GroupeDoublons) => photosDuGroupe(g, (id) => p.fichiers.get(id)).map((x) => x.etat);
const fichiers = (p: Plan) => (id: string) => p.fichiers.get(id);

describe('état des photos d’un groupe (D71)', () => {
  it('lit l’état dans le plan : gardée, à écarter (proposition), écartée', () => {
    const p = plan();
    expect(etats(p, rafale)).toEqual(['gardee', 'a_ecarter', 'a_ecarter']);
    expect(aRelire(rafale, fichiers(p))).toBe(true);
  });

  it('une photo écartée pour une autre raison (floue, copie exacte) quitte le groupe, sans badge faux', () => {
    const p = plan();
    mettreDeCote(p, ['c.jpg'], 'doublons_exacts');
    expect(photosDuGroupe(rafale, fichiers(p)).map((x) => x.m.id)).toEqual(['a.jpg', 'b.jpg']);
    mettreDeCote(p, ['b.jpg'], 'floues');
    expect(groupeVisible(rafale, fichiers(p))).toBe(false);
  });
});

describe('décisions (un clic, Accepter, Tout garder, Tout écarter)', () => {
  it('un clic choisit la photo seule, sans rien écarter ni valider ; Ctrl+clic en ajoute une (D101)', () => {
    const p = plan();
    choisir(p, rafale, 'b.jpg', true);
    expect(etats(p, rafale)).toEqual(['a_ecarter', 'choisie', 'a_ecarter']);
    expect([...p.fichiers.values()].some((f) => f.statut === 'mis_de_cote')).toBe(false);
    expect(aRelire(rafale, fichiers(p))).toBe(true);
    // Seuls les écarts à la proposition sont notés : c.jpg était déjà « à écarter ».
    expect(p.fichiers.get('a.jpg')!.choixDoublons).toEqual({ doublons: false });
    expect(p.fichiers.get('b.jpg')!.choixDoublons).toEqual({ doublons: true });
    expect(p.fichiers.get('c.jpg')!.choixDoublons).toBeUndefined();
    choisir(p, rafale, 'a.jpg', false);
    expect(etats(p, rafale)).toEqual(['gardee', 'choisie', 'a_ecarter']);
    expect(p.fichiers.get('a.jpg')!.choixDoublons).toBeUndefined();
  });

  it('« Accepter » applique le choix et valide le groupe ; Ctrl+Z revient au choix', () => {
    const p = plan();
    const h = new Historique();
    h.enregistrer(choisir(p, rafale, 'b.jpg', true));
    h.enregistrer(accepter(p, [rafale]));
    expect(etats(p, rafale)).toEqual(['ecartee', 'gardee', 'ecartee']);
    expect(aRelire(rafale, fichiers(p))).toBe(false);
    expect(p.fichiers.get('b.jpg')!.protegee).toBe(true);
    expect([...p.fichiers.values()].some((f) => f.choixDoublons)).toBe(false);
    // La photo gardée à la place de la ★ : celle qui a été choisie.
    expect(p.fichiers.get('a.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons', doublon: { garde: 'b.jpg', source: 'rafale' } });
    h.annuler(p);
    expect(etats(p, rafale)).toEqual(['a_ecarter', 'choisie', 'a_ecarter']);
  });

  it('un groupe validé qu’on touche repasse à valider ; une photo écartée choisie revient à « Accepter »', () => {
    const p = plan();
    accepter(p, [rafale]);
    expect(aRelire(rafale, fichiers(p))).toBe(false);
    choisir(p, rafale, 'c.jpg', true);
    expect(etats(p, rafale)).toEqual(['a_ecarter', 'ecartee', 'choisie']);
    expect(aRelire(rafale, fichiers(p))).toBe(true);
    accepter(p, [rafale]);
    expect(etats(p, rafale)).toEqual(['ecartee', 'ecartee', 'gardee']);
    expect(p.fichiers.get('c.jpg')).toMatchObject({ statut: 'archive', protegee: true });
  });

  it('un « Accepter » groupé laisse à valider le groupe où aucune photo n’est choisie (D99, D101)', () => {
    const p = plan();
    choisir(p, rafale, 'a.jpg', false);
    expect(etats(p, rafale)).toEqual(['a_ecarter', 'a_ecarter', 'a_ecarter']);
    const autre: GroupeDoublons = { ...rafale, cle: 'rafale:IMG_1', etoile: 'IMG_1.jpg', membres: [{ id: 'IMG_1.jpg', garder: true }, { id: 'c.jpg', garder: false }] };
    expect(acceptablesSansVider([rafale, autre], fichiers(p))).toEqual([autre]);
  });

  it('un choix dans une rafale ne décide pas d’une copie exacte de la même photo (D101)', () => {
    const p = plan();
    const copie: GroupeDoublons = { cle: 'copie:a', sorte: 'copies', etoile: 'a.jpg', section: 'jour:2025-12-13', membres: [{ id: 'a.jpg', garder: true }, { id: 'IMG_1.jpg', garder: false }] };
    choisir(p, rafale, 'b.jpg', true);
    expect(etatPhoto(copie, copie.membres[0], p.fichiers.get('a.jpg'))).toBe('gardee');
    accepter(p, [copie]);
    expect(p.fichiers.get('a.jpg')!.choixDoublons).toEqual({ doublons: false });
  });

  it('« Tout écarter » écarte aussi la ★ ; « Tout garder » remet tout', () => {
    const p = plan();
    ecarterTout(p, [rafale]);
    expect(etats(p, rafale)).toEqual(['ecartee', 'ecartee', 'ecartee']);
    garderTout(p, [rafale]);
    expect(etats(p, rafale)).toEqual(['gardee', 'gardee', 'gardee']);
    expect(avancementGroupes([rafale], fichiers(p))).toEqual({ relus: 1, total: 1 });
  });

  it('copie réduite rangée dans un dossier « Garder, nettoyer » : l’original prend sa place (D71)', () => {
    const p = plan();
    const [g] = groupesCopies(
      [{ garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'reduite' }], aGarder: ['IMG_1.jpg'], remplacement: { original: 'IMG_1.jpg', copie: 'Best of/IMG-WA1.jpg', dossier: 'best' } }],
      fichiers(p),
    );
    expect(g.sorte).toBe('copies');
    expect(etatPhoto(g, g.membres[1], p.fichiers.get('Best of/IMG-WA1.jpg'))).toBe('a_ecarter');
    accepter(p, [g]);
    expect(p.fichiers.get('IMG_1.jpg')).toMatchObject({ statut: 'archive', dossier: 'best' });
    expect(p.fichiers.get('Best of/IMG-WA1.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons_exacts' });
    // L'exemplaire écarté reste dans le groupe : on peut changer d'avis.
    expect(etats(p, g)).toEqual(['gardee', 'ecartee']);
  });

  it('toutes les copies d’une photo peuvent être écartées (rien n’est supprimé)', () => {
    const p = plan();
    const [g] = groupesCopies([{ garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg'] }], fichiers(p));
    ecarterTout(p, [g]);
    expect(etats(p, g)).toEqual(['ecartee', 'ecartee']);
    expect(p.fichiers.get('a.jpg')).toMatchObject({ statut: 'mis_de_cote', raison: 'doublons_exacts' });
  });
});

describe('construction des groupes', () => {
  it('copies : « Dans plusieurs dossiers » quand tous les exemplaires sont gardés ; section = la journée', () => {
    const p = plan();
    const groupes = groupesCopies(
      [
        { garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg'] },
        { garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'identique' }], aGarder: ['IMG_1.jpg', 'Best of/IMG-WA1.jpg'] },
      ],
      fichiers(p),
    );
    expect(groupes.map((g) => [g.sorte, g.section])).toEqual([
      ['copies', 'jour:2025-12-13'],
      ['dossiers', 'jour:2025-12-13'],
    ]);
  });

  it('rafales et IA : ordre chronologique, refus du garde-fou visibles et gardés, clés stables', () => {
    const p = plan();
    const lots = {
      'jour:2025-12-13': {
        propositions: [
          { garde: 'b.jpg', doublons: [{ id: 'c.jpg', raison: 'r' }, { id: 'a.jpg', raison: 'r' }], source: 'rafale' as const },
          { garde: 'a.jpg', doublons: [{ id: 'b.jpg', raison: 'r' }], source: 'ia' as const, scene: 'pont', refus: [{ id: 'c.jpg', motif: 'garde-fou' }] },
        ],
      },
      'jour:sans': { propositions: [{ garde: 'IMG_1.jpg', doublons: [{ id: 'a.jpg', raison: 'r' }], source: 'rafale' as const }] },
      best: { propositions: [{ garde: 'IMG_1.jpg', doublons: [{ id: 'b.jpg', raison: 'r' }], source: 'rafale' as const }] },
    };
    const groupes = groupesScenes(lots, fichiers(p));
    expect(groupes[0].membres.map((m) => m.id)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(groupes[1]).toMatchObject({ sorte: 'ia', scene: 'pont' });
    expect(groupes[1].membres.find((m) => m.id === 'c.jpg')).toMatchObject({ garder: true, refus: true });
    expect(groupes.map((g) => g.section)).toEqual(['jour:2025-12-13', 'jour:2025-12-13', 'sans', 'dossier:best']);
    expect(groupesScenes(lots, fichiers(p)).map((g) => g.cle)).toEqual(groupes.map((g) => g.cle));
  });
});

describe('avant le tri (D85)', () => {
  it('signale les copies encore « à écarter » parmi les photos que le tri range, et seulement celles-là', () => {
    const p = plan();
    const groupes = groupesCopies(
      [
        { garde: 'Best of/IMG-WA1.jpg', copies: [{ id: 'IMG_1.jpg', type: 'identique' }], aGarder: ['Best of/IMG-WA1.jpg'] },
        { garde: 'a.jpg', copies: [{ id: 'b.jpg', type: 'identique' }], aGarder: ['a.jpg', 'b.jpg'] },
      ],
      fichiers(p),
    );
    const aTrier = new Set(['IMG_1.jpg', 'a.jpg', 'b.jpg', 'c.jpg']);
    expect(copiesEnAttente(groupes, aTrier, fichiers(p)).map((g) => g.cle)).toEqual(['copie:Best of/IMG-WA1.jpg']);
    // Une fois acceptée, la copie n'attend plus.
    new Historique().enregistrer(accepter(p, groupes));
    expect(copiesEnAttente(groupes, aTrier, fichiers(p))).toEqual([]);
    expect(p.fichiers.get('IMG_1.jpg')?.statut).toBe('mis_de_cote');
  });
});

describe('copies dans plusieurs dossiers gardés : tout un dossier d’un coup (D86)', () => {
  it('écarte les exemplaires du dossier gardés aussi ailleurs, jamais le dernier ; puis les remet', () => {
    const p = plan();
    const groupes = groupesCopies([{ garde: 'IMG_1.jpg', copies: [{ id: 'Best of/IMG-WA1.jpg', type: 'identique' }], aGarder: ['IMG_1.jpg', 'Best of/IMG-WA1.jpg'] }], fichiers(p));
    const dansBest = (f: FichierPlan) => dossierSource(f) === 'Best of';
    const aLaRacine = (f: FichierPlan) => dossierSource(f) === '';
    expect(exemplairesAEcarterDans(groupes, dansBest, fichiers(p))).toEqual(['Best of/IMG-WA1.jpg']);
    new Historique().enregistrer(ecarterDoublons(p, [{ id: 'Best of/IMG-WA1.jpg', raison: 'doublons_exacts' }]));
    // Le seul exemplaire encore gardé, à la racine, n'est jamais proposé.
    expect(exemplairesAEcarterDans(groupes, aLaRacine, fichiers(p))).toEqual([]);
    expect(exemplairesEcartesDans(groupes, dansBest, fichiers(p))).toEqual(['Best of/IMG-WA1.jpg']);
    new Historique().enregistrer(garderAussi(p, ['Best of/IMG-WA1.jpg']));
    expect(exemplairesEcartesDans(groupes, dansBest, fichiers(p))).toEqual([]);
    expect(p.fichiers.get('Best of/IMG-WA1.jpg')?.statut).toBe('archive');
  });
});

describe('bouton plein des Doublons (C-4.1) : le groupe à accepter qui suit le groupe en cours', () => {
  const liste = ['a', 'b', 'c', 'd'];
  const id = (x: string) => x;
  it('le groupe en cours s’il reste à accepter, sinon le suivant, en repartant du début', () => {
    expect(prochainAAccepter(liste, id, 'b', () => true, () => true)).toBe('b');
    expect(prochainAAccepter(liste, id, 'b', () => true, (x) => x !== 'b')).toBe('c');
    expect(prochainAAccepter(liste, id, 'd', () => true, (x) => x === 'a')).toBe('a');
    expect(prochainAAccepter(liste, id, null, () => true, (x) => x !== 'a')).toBe('b');
    expect(prochainAAccepter(liste, id, 'c', () => true, () => false)).toBeUndefined();
  });
  it('le groupe en cours masqué par le filtre « À accepter » : on part de sa place, pas du premier groupe', () => {
    // « b » vient d'être accepté : il n'est plus affiché ; « a » et « c » restent à accepter.
    expect(prochainAAccepter(liste, id, 'b', (x) => x !== 'b', (x) => x !== 'b')).toBe('c');
  });
});
