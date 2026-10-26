// Étape « Consolidation » sans IA (D91) : sorties coupées (photos qui se
// suivent), week-ends et petits voyages, fusions de l'IA, réunir et défaire.

import { describe, expect, it } from 'vitest';
import {
  avecIA,
  clePaire,
  DISTANCE_MAISON_KM,
  groupesDeFreres,
  instantsALaMaison,
  lireReglages,
  nomPropose,
  nomReuni,
  nomsProches,
  propositions,
  racineNom,
  reglagesParDefaut,
  rencontres,
  voisinage,
  type ContexteReunions,
  type DossierInfo,
  type Proposition,
} from '../src/lib/consolidation';
import type { EvenementCalendrier } from '../src/lib/ics';
import { deplacerDossier, planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';
import { defaireReunion, rangerEnVoyage, reunionEnPlace, reunirEnUn } from '../src/lib/reunions';

/** Domicile des essais ; 0,009° de latitude ≈ 1 km. */
const MAISON = { lat: 46.8, lon: 6.6 };
const aKm = (km: number, est = 0) => ({ lat: MAISON.lat + km * 0.009, lon: MAISON.lon + est * 0.0131 });

type Photo = string | [string, { lat: number; lon: number }];

/** Plan d'essai : chemin → photos (date, ou date et position) ; les dossiers sont ceux du tri. */
function plan(dossiers: Record<string, Photo[]>, voyages: string[] = []): Plan {
  const p = planVide();
  for (const [chemin, photos] of Object.entries(dossiers)) {
    let parent = RACINE;
    const parties = chemin.split('/');
    parties.forEach((nom, i) => {
      const id = `d:${parties.slice(0, i + 1).join('/')}`;
      if (!p.dossiers.has(id)) p.dossiers.set(id, { id, nom, parent, origine: 'tri', ...(voyages.includes(nom) ? { tri: { origine: 'voyage' as const } } : {}) });
      parent = id;
    });
    photos.forEach((x, k) => {
      const [date, gps] = typeof x === 'string' ? [x, undefined] : x;
      const id = `${chemin}/IMG_${k}.jpg`;
      const f: FichierPlan = { id, nom: `IMG_${k}.jpg`, taille: 100, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier: parent, statut: 'archive', ...(gps ? { gps } : {}) };
      p.fichiers.set(id, f);
    });
  }
  return p;
}

function contexte(p: Plan, autre: Partial<ContexteReunions> = {}): ContexteReunions {
  const maison = { ...MAISON, km: DISTANCE_MAISON_KM };
  const aLaMaison = instantsALaMaison(p.fichiers.values(), maison);
  const voyages = new Map([...p.dossiers.values()].filter((d) => d.tri?.origine === 'voyage').map((d) => [d.id, 'tri' as const]));
  return { ignorees: new Set(), voyagesIgnores: new Set(), maison, aLaMaison, nomDonne: () => false, voyages, ...autre };
}

const noms = (l: Proposition[]) => l.map((x) => [x.sorte, x.dossiers.map((d) => d.nom)]);
const calculer = (p: Plan, r = reglagesParDefaut(), c = contexte(p)) => propositions(voisinage(groupesDeFreres(p)), r, c);

describe('réglages', () => {
  it('par défaut : 3 h et 2 × la taille d’un endroit, au cran le plus proche', () => {
    expect(reglagesParDefaut()).toEqual({ heures: 3, km: 4, voyages: true, joursVoyage: 4, noms: true });
    expect(reglagesParDefaut(5).km).toBe(10);
    expect(reglagesParDefaut(0.5).km).toBe(1);
  });

  it('relus et ramenés aux crans', () => {
    expect(lireReglages({ heures: 2.5, km: 5, voyages: false, joursVoyage: 6, noms: 'oui' })).toEqual({ heures: 3, km: 4, voyages: false, joursVoyage: 7, noms: true });
    expect(lireReglages(null, 5)).toEqual(reglagesParDefaut(5));
  });
});

describe('sortie coupée : deux photos qui se suivent (D91)', () => {
  it('rencontres : pour chaque écart, la plus petite distance', () => {
    const d = (id: string, photos: [string, number][]): DossierInfo => ({
      id,
      nom: id,
      photos: photos.map(([date, km], i) => ({ id: `${id}${i}`, nom: '', taille: 0, modifie: 0, categorie: 'photo', date, dossier: id, statut: 'archive', gps: aKm(km) })),
    });
    const a = d('a', [['2025-06-28T10:00:00', 0], ['2025-06-28T11:00:00', 0]]);
    const b = d('b', [['2025-06-28T11:20:00', 6], ['2025-06-28T13:00:00', 2.5], ['2025-06-29T08:00:00', 0]]);
    const front = rencontres(a, b);
    expect(front.map((c) => [c.minutes, Math.round(c.km! * 10) / 10])).toEqual([[20, 6], [120, 2.5]]);
  });

  it('photos à moins de 3 h et 4 km : proposées ; des dossiers « gigognes » ou éloignés : non', () => {
    const p = plan({
      'Rando_28.06.25': [['2025-06-28T10:00:00', aKm(30)], ['2025-06-28T11:00:00', aKm(30)]],
      'Col_28.06.25': [['2025-06-28T11:31:00', aKm(32.4)], ['2025-06-28T12:30:00', aKm(32.4)]],
      // Le même jour, à 20 km : une autre sortie.
      'Fete_28.06.25': [['2025-06-28T19:00:00', aKm(50)]],
      // Un dossier qui s'étale sur trois jours tout près : ses photos ne croisent celles d'aucun autre.
      'Pres_27-29.06.25': [['2025-06-27T09:00:00', aKm(31)], ['2025-06-29T21:00:00', aKm(31)]],
    });
    const r = { ...reglagesParDefaut(), voyages: false };
    expect(noms(calculer(p, r))).toEqual([['sortie', ['Rando_28.06.25', 'Col_28.06.25']]]);
    const [x] = calculer(p, r);
    expect(x.rencontre).toMatchObject({ minutes: 31 });
    expect(noms(calculer(p, { ...r, km: 2 }))).toEqual([]);
    expect(noms(calculer(p, { ...r, heures: 12, km: 20 })).map((x) => x[1])).toContainEqual(['Rando_28.06.25', 'Col_28.06.25', 'Fete_28.06.25']);
    // Loin de la maison du 27 au 29 : aussi un week-end.
    expect(noms(calculer(p)).map((x) => x[0])).toEqual(['voyage', 'sortie']);
  });

  it('en groupes, sans chaîne à travers toute une région', () => {
    const etape = (h: number, km: number): Photo[] => [[`2025-06-28T${String(h).padStart(2, '0')}:00:00`, aKm(30 + km)]];
    const p = plan({ A: etape(9, 0), B: etape(10, 3.5), C: etape(11, 7), D: etape(12, 10.5), E: etape(13, 14) });
    // Chacun à moins de 12 km (3 × 4) de tous les autres : E, à 14 km de A, reste à part.
    expect(calculer(p).map((x) => x.dossiers.map((d) => d.nom))).toEqual([['A', 'B', 'C', 'D']]);
  });

  it('un dossier sans position : l’écart seul', () => {
    const p = plan({ Plage: [['2025-07-01T10:00:00', aKm(40)]], Telephone: ['2025-07-01T10:40:00'] });
    const [x] = calculer(p);
    expect(x.dossiers.map((d) => d.nom)).toEqual(['Plage', 'Telephone']);
    expect(x.rencontre).toEqual({ minutes: 40, km: null });
  });

  it('noms proches à 2 jours près, seulement pour des noms donnés', () => {
    const p = plan({ 'Ski_Bourg_D_04.01.25': [['2025-01-04T10:00:00', aKm(30)]], 'Ski_Bourg_D_06.01.25': [['2025-01-06T10:00:00', aKm(40)]] });
    expect(calculer(p)).toEqual([]);
    const [x] = calculer(p, reglagesParDefaut(), contexte(p, { nomDonne: () => true }));
    expect(x).toMatchObject({ sorte: 'sortie', noms: true, rencontre: null });
    expect(calculer(p, { ...reglagesParDefaut(), noms: false }, contexte(p, { nomDonne: () => true }))).toEqual([]);
    expect(racineNom('Ko_Samui_28.06-02.07.26')).toBe('kosamui');
    expect(racineNom('Village_22.11.25_b')).toBe('village');
    expect(racineNom('Village_2025-11-22')).toBe('village');
    expect(racineNom('Ville_11.25')).toBe('ville');
    expect(nomsProches('Muay_Thai_25.07.26', 'Muay_Thai_25-26.07.26')).toBe(true);
    expect(nomsProches('Vol_KohSamui_18.07.26', 'Vol_Koh_Samui_18.07.26')).toBe(true);
    expect(nomsProches('Marche_23.07.26', 'Temple_23.07.26')).toBe(false);
  });

  it('une paire refusée n’est plus proposée', () => {
    const p = plan({ A: [['2025-06-28T10:00:00', aKm(30)]], B: [['2025-06-28T10:30:00', aKm(32)]] });
    expect(calculer(p, reglagesParDefaut(), contexte(p, { ignorees: new Set([clePaire('d:B', 'd:A')]) }))).toEqual([]);
  });
});

describe('week-ends et petits voyages (D91)', () => {
  const weekend = {
    'Bourg_A_28.06.25': [['2025-06-28T10:00:00', aKm(60)], ['2025-06-28T18:00:00', aKm(60)]] as Photo[],
    'Bourg_B_29.06.25': [['2025-06-29T10:00:00', aKm(66)]] as Photo[],
    'Bourg_C_29.06.25': [['2025-06-29T16:00:00', aKm(60, 8)]] as Photo[],
    'Maison_02.07.25': [['2025-07-02T10:00:00', aKm(0.5)]] as Photo[],
  };

  it('des dossiers loin de la maison, jours qui se suivent : un week-end', () => {
    const p = plan(weekend);
    expect(noms(calculer(p))).toEqual([['voyage', ['Bourg_A_28.06.25', 'Bourg_B_29.06.25', 'Bourg_C_29.06.25']]]);
    expect(calculer(p, { ...reglagesParDefaut(), voyages: false })).toEqual([]);
    expect(calculer(p, reglagesParDefaut(), contexte(p, { maison: null }))).toEqual([]);
  });

  it('un retour à la maison coupe le voyage', () => {
    const p = plan({ ...weekend, Soir: [['2025-06-28T22:00:00', aKm(0.3)]] });
    expect(calculer(p).filter((x) => x.sorte === 'voyage')).toEqual([]);
  });

  it('pas sur une seule journée ; au plus la durée choisie', () => {
    const memeJour = plan({ A: [['2025-06-28T10:00:00', aKm(60)]], B: [['2025-06-28T18:00:00', aKm(80)]] });
    expect(calculer(memeJour)).toEqual([]);
    const semaine = plan(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`J${i}`, [[`2025-08-0${i + 1}T12:00:00`, aKm(100 + 10 * i)]] as Photo[]])));
    expect(calculer(semaine)).toEqual([]);
    expect(calculer(semaine, { ...reglagesParDefaut(), joursVoyage: 7 }).map((x) => x.dossiers.length)).toEqual([5]);
  });

  it('un groupe à la fois sortie et voyage est montré comme voyage', () => {
    const p = plan({ A: [['2025-06-28T22:00:00', aKm(60)]], B: [['2025-06-29T00:30:00', aKm(61)]] });
    expect(noms(calculer(p))).toEqual([['voyage', ['A', 'B']]]);
  });

  it('refusé : les étapes ne sont plus réunies', () => {
    const p = plan(weekend);
    const c = contexte(p, { voyagesIgnores: new Set([clePaire('d:Bourg_C_29.06.25', 'd:Bourg_B_29.06.25')]) });
    expect(noms(calculer(p, reglagesParDefaut(), c))).toEqual([['voyage', ['Bourg_A_28.06.25', 'Bourg_B_29.06.25']]]);
    // Coupé entre le samedi et le dimanche : il ne reste qu'une journée, pas de voyage.
    const d = contexte(p, { voyagesIgnores: new Set([clePaire('d:Bourg_A_28.06.25', 'd:Bourg_B_29.06.25')]) });
    expect(calculer(p, reglagesParDefaut(), d)).toEqual([]);
  });

  it('dans un dossier de voyage du tri : toutes ses étapes, à réunir en un dossier', () => {
    const p = plan(
      {
        'Voyage_Bourg_A_28-29.06.25/Bourg_A': [['2025-06-28T10:00:00', aKm(60)]],
        'Voyage_Bourg_A_28-29.06.25/Bourg_B': [['2025-06-29T10:00:00', aKm(70)]],
      },
      ['Voyage_Bourg_A_28-29.06.25'],
    );
    const [x] = calculer(p);
    expect(x).toMatchObject({ sorte: 'voyage', voyageEntier: true, parent: 'd:Voyage_Bourg_A_28-29.06.25' });
    expect(nomPropose(x, 'un', 'Voyage_Bourg_A_28-29.06.25')).toBe('Voyage_Bourg_A_28-29.06.25');
    // Un dossier de voyage rangé ici : plus rien à proposer dedans.
    const c = contexte(p, { voyages: new Map([['d:Voyage_Bourg_A_28-29.06.25', 'choisi']]) });
    expect(calculer(p, reglagesParDefaut(), c)).toEqual([]);
  });
});

describe('fusions de l’IA (IA6)', () => {
  const p = plan({
    A: [['2025-06-28T10:00:00', aKm(30)]],
    B: [['2025-06-28T10:30:00', aKm(32)]],
    C: [['2025-06-28T15:00:00', aKm(45)]],
    D: [['2025-06-29T15:00:00', aKm(1)]],
  });
  const v = voisinage(groupesDeFreres(p));
  const locales = propositions(v, reglagesParDefaut(), contexte(p));

  it('confirme et complète une sortie proposée', () => {
    const l = avecIA(locales, v, [{ parent: RACINE, f: { cible: 'Rando_28.06.25', cibleId: 'd:A', sources: ['d:B', 'd:C'], raison: 'même randonnée' } }], new Set());
    expect(l).toHaveLength(1);
    expect(l[0].dossiers.map((d) => d.nom)).toEqual(['A', 'B', 'C']);
    expect(l[0].ia).toEqual({ cible: 'Rando_28.06.25', raison: 'même randonnée' });
    expect(nomPropose(l[0], 'un')).toBe('Rando_28.06.25');
  });

  it('ajoute une fusion nouvelle ; plus rien si ses paires sont refusées', () => {
    const f = { cible: 'X', cibleId: null, sources: ['d:C', 'd:D'], raison: 'r' };
    expect(avecIA(locales, v, [{ parent: RACINE, f }], new Set()).map((x) => x.dossiers.map((d) => d.nom))).toEqual([['A', 'B'], ['C', 'D']]);
    expect(avecIA(locales, v, [{ parent: RACINE, f }], new Set([clePaire('d:C', 'd:D')]))).toHaveLength(1);
  });
});

describe('noms proposés', () => {
  it('date étendue à toute la période', () => {
    expect(nomReuni('Plage_Chaweng_18.07.26', '2026-07-18T10:00', '2026-07-19T09:00')).toBe('Plage_Chaweng_18-19.07.26');
    expect(nomReuni('28.06.25', '2025-06-28', '2025-06-29')).toBe('28-29.06.25');
    expect(nomReuni('Anniversaire', '2025-06-28', '2025-06-29')).toBe('Anniversaire');
  });

  it('un dossier, ou un dossier de voyage', () => {
    const p = plan({
      'Bourg_A_28.06.25': [['2025-06-28T10:00:00', aKm(60)], ['2025-06-28T18:00:00', aKm(60)]],
      'Bourg_B_29.06.25': [['2025-06-29T10:00:00', aKm(66)]],
    });
    const [x] = calculer(p);
    expect(nomPropose(x, 'un')).toBe('Bourg_A_28-29.06.25');
    expect(nomPropose(x, 'etapes')).toBe('Voyage_Bourg_A_28-29.06.25');
  });
});

describe('réunir et défaire', () => {
  const nouveau = () =>
    plan({
      'Bourg_A_28.06.25': [['2025-06-28T10:00:00', aKm(60)], ['2025-06-28T18:00:00', aKm(60)]],
      'Bourg_B_29.06.25': [['2025-06-29T10:00:00', aKm(66)]],
      Autre: ['2025-08-01T10:00:00'],
    });
  const dossiersDe = (p: Plan) => Object.fromEntries([...p.dossiers.values()].map((d) => [d.nom, p.dossiers.get(d.parent ?? '')?.nom ?? null]));

  it('en un dossier : le plus grand reçoit les autres et prend le nom choisi', () => {
    const p = nouveau();
    const [x] = calculer(p);
    const { modification, reunion } = reunirEnUn(p, x.cle, x.dossiers, 'Bourg_A_28-29.06.25');
    expect(modification).not.toBeNull();
    expect(dossiersDe(p)).toEqual({ Photos: null, 'Bourg_A_28-29.06.25': 'Photos', Autre: 'Photos' });
    expect([...p.fichiers.values()].filter((f) => f.dossier === 'd:Bourg_A_28.06.25')).toHaveLength(3);
    expect(reunionEnPlace(p, reunion)).toBe(true);
    defaireReunion(p, reunion);
    expect(dossiersDe(p)).toEqual({ Photos: null, 'Bourg_A_28.06.25': 'Photos', 'Bourg_B_29.06.25': 'Photos', Autre: 'Photos' });
    expect(p.fichiers.get('Bourg_B_29.06.25/IMG_0.jpg')!.dossier).toBe('d:Bourg_B_29.06.25');
    expect(reunionEnPlace(p, reunion)).toBe(false);
  });

  it('en un dossier de voyage : une étape par dossier', () => {
    const p = nouveau();
    const [x] = calculer(p);
    const { reunion } = rangerEnVoyage(p, x.cle, x.dossiers, RACINE, 'Voyage_Bourg_A_28-29.06.25');
    expect(dossiersDe(p)).toEqual({ Photos: null, 'Voyage_Bourg_A_28-29.06.25': 'Photos', 'Bourg_A_28.06.25': 'Voyage_Bourg_A_28-29.06.25', 'Bourg_B_29.06.25': 'Voyage_Bourg_A_28-29.06.25', Autre: 'Photos' });
    expect(reunionEnPlace(p, reunion)).toBe(true);
    defaireReunion(p, reunion);
    expect(dossiersDe(p)).toEqual({ Photos: null, 'Bourg_A_28.06.25': 'Photos', 'Bourg_B_29.06.25': 'Photos', Autre: 'Photos' });
  });

  it('les étapes d’un voyage du tri réunies dans le dossier de voyage', () => {
    const p = plan(
      { 'Voyage_A/Bourg_A': [['2025-06-28T10:00:00', aKm(60)]], 'Voyage_A/Bourg_B': [['2025-06-29T10:00:00', aKm(70)]] },
      ['Voyage_A'],
    );
    const [x] = calculer(p);
    const { reunion } = reunirEnUn(p, x.cle, x.dossiers, 'Bourg_A_28-29.06.25', x.parent);
    expect(dossiersDe(p)).toEqual({ Photos: null, 'Bourg_A_28-29.06.25': 'Photos' });
    defaireReunion(p, reunion);
    expect(dossiersDe(p)).toEqual({ Photos: null, Voyage_A: 'Photos', Bourg_A: 'Voyage_A', Bourg_B: 'Voyage_A' });
  });

  it('déplacer un dossier', () => {
    const p = nouveau();
    expect(() => deplacerDossier(p, RACINE, 'd:Autre')).toThrow();
    deplacerDossier(p, 'd:Bourg_B_29.06.25', 'd:Autre');
    expect(p.dossiers.get('d:Bourg_B_29.06.25')!.parent).toBe('d:Autre');
    expect(() => deplacerDossier(p, 'd:Autre', 'd:Bourg_B_29.06.25')).toThrow();
    expect(deplacerDossier(p, 'd:Bourg_B_29.06.25', 'd:Autre')).toBeNull();
  });
});

describe('même événement, même endroit (D106)', () => {
  const evt = (titre: string, debut: string, fin: string): EvenementCalendrier => ({ titre, debut, fin, journee: true, recurrent: false });
  const fete = evt('Fête du village', '2026-03-14', '2026-03-16');
  const p = () =>
    plan({
      // Samedi et lundi : deux jours d'écart, aucune photo qui se suive.
      'Fete_14.03.26': [['2026-03-14T15:00:00', aKm(2)], ['2026-03-14T16:00:00', aKm(2)]],
      'Fete_16.03.26': [['2026-03-16T15:00:00', aKm(3)]],
      // Le même événement, à 40 km : pas le même endroit.
      'Ailleurs_15.03.26': [['2026-03-15T10:00:00', aKm(40)]],
    });

  it('les dossiers d’un même événement au même endroit sont proposés, nommés d’après lui', () => {
    const x = p();
    const l = calculer(x, reglagesParDefaut(), contexte(x, { evts: [fete] }));
    expect(noms(l)).toEqual([['sortie', ['Fete_14.03.26', 'Fete_16.03.26']]]);
    expect(l[0]).toMatchObject({ evenement: 'Fête du village', rencontre: null });
    expect(nomPropose(l[0], 'un')).toBe('Fete_du_village_14-16.03.26');
    // Sans calendrier, rien : les photos ne se suivent pas.
    expect(calculer(x)).toEqual([]);
  });

  it('pas pour une période de plus de 4 jours, un refus ou un dossier de voyage', () => {
    const x = p();
    expect(calculer(x, reglagesParDefaut(), contexte(x, { evts: [evt('Vacances', '2026-03-10', '2026-03-20')] }))).toEqual([]);
    expect(calculer(x, reglagesParDefaut(), contexte(x, { evts: [fete], ignorees: new Set([clePaire('d:Fete_14.03.26', 'd:Fete_16.03.26')]) }))).toEqual([]);
    const y = plan({ 'Fete_14.03.26': [['2026-03-14T15:00:00', aKm(2)]], 'Fete_16.03.26': [['2026-03-16T15:00:00', aKm(3)]] }, ['Fete_16.03.26']);
    expect(calculer(y, reglagesParDefaut(), contexte(y, { evts: [fete] }))).toEqual([]);
  });

  it('le calendrier confirme une sortie coupée sur les mêmes dossiers', () => {
    const x = plan({
      'Rando_28.06.25': [['2025-06-28T10:00:00', aKm(30)], ['2025-06-28T11:00:00', aKm(30)]],
      'Col_28.06.25': [['2025-06-28T11:31:00', aKm(32.4)], ['2025-06-28T12:30:00', aKm(32.4)]],
    });
    const [s] = calculer(x, reglagesParDefaut(), contexte(x, { evts: [evt('Course', '2025-06-28', '2025-06-28')] }));
    expect(s).toMatchObject({ sorte: 'sortie', evenement: 'Course', rencontre: { minutes: 31 } });
  });
});

describe('réunir en un seul dossier : vraiment un seul (D106)', () => {
  const dossiersDe = (p: Plan) => Object.fromEntries([...p.dossiers.values()].map((d) => [d.nom, p.dossiers.get(d.parent ?? '')?.nom ?? null]));
  it('les sous-dossiers sont vidés dans le dossier réuni ; défaire remet tout, sous-dossiers vides compris', () => {
    const p = plan({
      'A_28.06.25': [['2025-06-28T10:00:00', aKm(60)], ['2025-06-28T18:00:00', aKm(60)]],
      'B_29.06.25/Matin': [['2025-06-29T09:00:00', aKm(61)]],
      'B_29.06.25/Soir/Feu': [['2025-06-29T21:00:00', aKm(61)]],
    });
    p.dossiers.set('d:B_29.06.25/Vide', { id: 'd:B_29.06.25/Vide', nom: 'Vide', parent: 'd:B_29.06.25', origine: 'tri' });
    const avant = dossiersDe(p);
    const fichiers = [...p.fichiers.values()].map((f) => [f.id, f.dossier]);
    const info = (id: string): DossierInfo => ({ id, nom: p.dossiers.get(id)!.nom, photos: [...p.fichiers.values()].filter((f) => f.dossier.startsWith(id)) });
    const { reunion } = reunirEnUn(p, 'sortie:essai', [info('d:A_28.06.25'), info('d:B_29.06.25')], 'A_28-29.06.25');
    expect(dossiersDe(p)).toEqual({ Photos: null, 'A_28-29.06.25': 'Photos' });
    expect([...p.fichiers.values()].every((f) => f.dossier === 'd:A_28.06.25')).toBe(true);
    expect(p.fichiers.size).toBe(fichiers.length);
    defaireReunion(p, reunion);
    expect(dossiersDe(p)).toEqual(avant);
    expect([...p.fichiers.values()].map((f) => [f.id, f.dossier])).toEqual(fichiers);
  });
});
