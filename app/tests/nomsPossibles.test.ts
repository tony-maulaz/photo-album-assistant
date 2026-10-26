// Noms possibles d'un dossier à l'étape « Nommage » : événements du calendrier
// candidats (80 % des photos, ni récurrents ni de plus de 21 jours), lieu du
// tri, proposition de l'IA, et celui pris d'office pour le champ.

import { describe, expect, it } from 'vitest';
import type { EvenementCalendrier } from '../src/lib/ics';
import { dossiersANommer, evenementsCandidats, lieuPourNom, nomPourJournee, nomsPossibles, normaliserNom, TITRE_MAX_PRIS_D_OFFICE } from '../src/lib/nommage';
import { planVide, RACINE, type FichierPlan, type InfoTri, type Plan } from '../src/lib/plan';

/** Petit plan de test : dossiers (chemin → dates des photos), avec l'information du tri de certains. */
function plan(dossiers: Record<string, string[]>, tri: Record<string, Omit<InfoTri, 'nom'>> = {}): Plan {
  const p = planVide();
  for (const [chemin, dates] of Object.entries(dossiers)) {
    let parent = RACINE;
    const parties = chemin.split('/');
    parties.forEach((nom, i) => {
      const sous = parties.slice(0, i + 1).join('/');
      const id = `d:${sous}`;
      // Le tri note le nom qu'il a donné : tant que le dossier le porte, il est à nommer.
      if (!p.dossiers.has(id)) p.dossiers.set(id, { id, nom, parent, origine: 'tri', ...(tri[sous] ? { tri: { ...tri[sous], nom } } : {}) });
      parent = id;
    });
    dates.forEach((date, k) => {
      const id = `${chemin}/IMG_${k}.jpg`;
      const f: FichierPlan = { id, nom: `IMG_${k}.jpg`, taille: 100, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier: parent, statut: 'archive' };
      p.fichiers.set(id, f);
    });
  }
  return p;
}

const jour = (titre: string, debut: string, fin = debut, recurrent = false): EvenementCalendrier => ({ titre, debut, fin, journee: true, recurrent });
const heures = (titre: string, debut: string, fin: string): EvenementCalendrier => ({ titre, debut, fin, journee: false, recurrent: false });

/** Noms possibles de tous les dossiers à nommer, par chemin. */
function noms(p: Plan, evts: EvenementCalendrier[], ia: Record<string, unknown> = {}) {
  const r = nomsPossibles(p, dossiersANommer(p), evts, ia);
  return (chemin: string) => r.get(`d:${chemin}`)!;
}

const GPS = (lieu: string): Omit<InfoTri, 'nom'> => ({ origine: 'gps', lieu });

describe('événements candidats', () => {
  const cinq = ['2025-07-04T10:00:00', '2025-07-04T11:00:00', '2025-07-04T12:00:00', '2025-07-04T15:00:00', '2025-07-05T09:00:00'];

  it('couvrent au moins 80 % des photos datées', () => {
    const r = evenementsCandidats([jour('Fete_X', '2025-07-04'), jour('Fete_Y', '2025-07-05')], cinq);
    expect(r.map((c) => [c.evenement.titre, c.part])).toEqual([['Fete_X', 0.8]]);
    // À l'heure, avec une heure de marge : de 10 h 30 à 11 h 30, seules les photos de 10 h, 11 h et 12 h comptent (60 %).
    expect(evenementsCandidats([heures('Course_X', '2025-07-04T10:30:00', '2025-07-04T11:30:00')], cinq)).toEqual([]);
    expect(evenementsCandidats([heures('Course_X', '2025-07-04T10:30:00', '2025-07-04T14:30:00')], cinq).map((c) => c.part)).toEqual([0.8]);
    expect(evenementsCandidats([jour('Fete_X', '2025-07-04')], [])).toEqual([]);
  });

  it('ni récurrents ni de plus de 21 jours', () => {
    const evts = [
      jour('Cours_X', '2025-07-04', '2025-07-05', true),
      jour('Vacances_X', '2025-06-20', '2025-08-09'),
      jour('Camp_X', '2025-06-20', '2025-07-11'),
      jour('Camp_Y', '2025-06-21', '2025-07-11'),
    ];
    // 22 jours : une période, pas une sortie ; 21 jours : encore une sortie.
    expect(evenementsCandidats(evts, cinq).map((c) => c.evenement.titre)).toEqual(['Camp_Y']);
  });

  it('plusieurs candidats : la plus grande part, puis le plus court ; un même titre (deux calendriers) une seule fois', () => {
    const evts = [jour('Week-end_X', '2025-07-04', '2025-07-06'), jour('Fete_X', '2025-07-04'), jour('Fete_Y', '2025-07-05'), jour('Fete_Z', '2025-07-04', '2025-07-05'), jour('Fete_X', '2025-07-04')];
    const r = evenementsCandidats(evts, cinq);
    expect(r.map((c) => c.evenement.titre)).toEqual(['Fete_Z', 'Week-end_X', 'Fete_X']);
    expect(evenementsCandidats([jour('Fête X', '2025-07-04'), jour('fete x', '2025-07-04')], cinq)).toHaveLength(1);
  });
});

describe('noms possibles', () => {
  it('titre, lieu et dates, selon la convention ; le lieu seul ; pris d’office', () => {
    const p = plan({ 'Lieu_A_04.07.25': ['2025-07-04T10:00:00', '2025-07-04T16:00:00'] }, { 'Lieu_A_04.07.25': GPS('Lieu_A') });
    const n = noms(p, [jour('Fete X', '2025-07-04')])('Lieu_A_04.07.25');
    expect(n.calendrier).toEqual([{ nom: 'Fete X Lieu A 04.07.25', titre: 'Fete X', part: 1, long: false }]);
    expect(normaliserNom(n.calendrier[0].nom)).toBe('Fete_X_Lieu_A_04.07.25');
    expect(n.lieu).toBe('Lieu A 04.07.25');
    expect(n.ia).toBeNull();
    expect(n.propose).toEqual({ nom: 'Fete X Lieu A 04.07.25', source: 'calendrier', seul: true });
  });

  it('le lieu n’est pas répété s’il figure déjà dans le titre', () => {
    const p = plan({ 'Lieu_A_04.07.25': ['2025-07-04T10:00:00'] }, { 'Lieu_A_04.07.25': GPS('Lieu_A') });
    const n = noms(p, [jour('Course des quais Lieu-A', '2025-07-04')])('Lieu_A_04.07.25');
    expect(normaliserNom(n.calendrier[0].nom)).toBe('Course_des_quais_Lieu-A_04.07.25');
    // Sans tenir compte des accents ni des majuscules.
    expect(noms(p, [jour('Fête à lieu-a', '2025-07-04')])('Lieu_A_04.07.25').calendrier[0].nom).toBe('Fête à lieu-a 04.07.25');
    // Un mot qui commence pareil n'est pas le lieu.
    expect(noms(p, [jour('Fete Lieu_AB', '2025-07-04')])('Lieu_A_04.07.25').calendrier[0].nom).toBe('Fete Lieu_AB Lieu A 04.07.25');
  });

  it('sous-dossier d’un lieu connu : le parent dit déjà le lieu', () => {
    const connu = { origine: 'lieu_connu' as const, lieu: 'Domicile' };
    const p = plan({ 'Domicile/24-26.12.25': ['2025-12-24T18:00:00', '2025-12-25T10:00:00', '2025-12-26T11:00:00'] }, { Domicile: connu, 'Domicile/24-26.12.25': connu });
    const n = noms(p, [jour('Noel', '2025-12-24', '2025-12-26')])('Domicile/24-26.12.25');
    expect(n.calendrier.map((k) => k.nom)).toEqual(['Noel 24-26.12.25']);
    expect(n.lieu).toBe('Domicile 24-26.12.25');
  });

  it('voyage : le titre du voyage nomme le parent, pas chaque étape ; une étape ne répète pas le lieu', () => {
    const chemins = {
      'Voyage_Lieu_B_10-16.07.25/Lieu_B_10-14.07.25': ['2025-07-10T10:00:00', '2025-07-12T10:00:00', '2025-07-14T10:00:00'],
      'Voyage_Lieu_B_10-16.07.25/Lieu_C_16.07.25': ['2025-07-16T10:00:00', '2025-07-16T12:00:00', '2025-07-16T14:00:00', '2025-07-16T16:00:00'],
    };
    const tri = {
      'Voyage_Lieu_B_10-16.07.25': { origine: 'voyage' as const, lieu: 'Lieu_B' },
      'Voyage_Lieu_B_10-16.07.25/Lieu_B_10-14.07.25': { origine: 'etape' as const, lieu: 'Lieu_B' },
      'Voyage_Lieu_B_10-16.07.25/Lieu_C_16.07.25': { origine: 'etape' as const, lieu: 'Lieu_C' },
    };
    const evts = [jour('Vacances Z', '2025-07-10', '2025-07-20'), jour('Fete Y', '2025-07-16')];
    const p = plan(chemins, tri);
    const n = noms(p, evts);
    expect(n('Voyage_Lieu_B_10-16.07.25').calendrier.map((k) => k.nom)).toEqual(['Vacances Z Lieu B 10-16.07.25']);
    expect(n('Voyage_Lieu_B_10-16.07.25/Lieu_B_10-14.07.25').calendrier).toEqual([]);
    expect(n('Voyage_Lieu_B_10-16.07.25/Lieu_B_10-14.07.25').lieu).toBe('Lieu B 10-14.07.25');
    expect(n('Voyage_Lieu_B_10-16.07.25/Lieu_C_16.07.25').calendrier.map((k) => k.nom)).toEqual(['Fete Y 16.07.25']);

    // Parent déjà nommé d'après l'événement : ses étapes ne le reprennent pas non plus.
    const q = plan(chemins, tri);
    const voyage = q.dossiers.get('d:Voyage_Lieu_B_10-16.07.25')!;
    q.dossiers.set(voyage.id, { ...voyage, nom: 'Vacances_Z_Lieu_B_10-16.07.25' });
    const m = noms(q, evts);
    expect(m('Voyage_Lieu_B_10-16.07.25/Lieu_C_16.07.25').calendrier.map((k) => k.titre)).toEqual(['Fete Y']);
    expect(m('Voyage_Lieu_B_10-16.07.25/Lieu_B_10-14.07.25').calendrier).toEqual([]);
  });

  it('un parent qui n’est pas à nommer garde l’événement pour son sous-dossier', () => {
    // « Domicile » n'est pas un nom automatique : Noël n'irait nulle part si le sous-dossier ne le recevait pas.
    const connu = { origine: 'lieu_connu' as const, lieu: 'Domicile' };
    const p = plan({ 'Domicile/24.12.25': ['2025-12-24T18:00:00', '2025-12-24T20:00:00'] }, { Domicile: connu, 'Domicile/24.12.25': connu });
    expect(noms(p, [jour('Noel', '2025-12-24')])('Domicile/24.12.25').propose).toEqual({ nom: 'Noel 24.12.25', source: 'calendrier', seul: true });
  });

  it('plusieurs candidats : le plus précis pré-remplit le champ, sans être renommé d’un coup ; à égalité parfaite, rien', () => {
    const p = plan({ 'Lieu_A_04.07.25': ['2025-07-04T10:00:00', '2025-07-04T16:00:00'] }, { 'Lieu_A_04.07.25': GPS('Lieu_A') });
    const evts = [jour('Fete X', '2025-07-04'), jour('Week-end Y', '2025-07-04', '2025-07-05')];
    const n = noms(p, evts)('Lieu_A_04.07.25');
    expect(n.calendrier.map((k) => k.nom)).toEqual(['Fete X Lieu A 04.07.25', 'Week-end Y Lieu A 04.07.25']);
    expect(n.propose).toEqual({ nom: 'Fete X Lieu A 04.07.25', source: 'calendrier', seul: false });
    // Deux événements aux mêmes dates : aucun choix d'office, la proposition de l'IA s'il y en a une.
    const egaux = [jour('Fete X', '2025-07-04'), jour('Repas Z', '2025-07-04')];
    expect(noms(p, egaux)('Lieu_A_04.07.25').propose).toBeNull();
    const avecIA = noms(p, egaux, { 'd:Lieu_A_04.07.25': { nom: 'Nom_IA_04.07.25', confiance: 7 } })('Lieu_A_04.07.25');
    expect(avecIA.ia).toBe('Nom_IA_04.07.25');
    expect(avecIA.propose).toEqual({ nom: 'Nom_IA_04.07.25', source: 'ia' });
  });

  it('un titre de plus de 40 caractères est proposé mais pas pris d’office', () => {
    const p = plan({ 'Lieu_A_04.07.25': ['2025-07-04T10:00:00'] }, { 'Lieu_A_04.07.25': GPS('Lieu_A') });
    const long = 'Fete X '.padEnd(TITRE_MAX_PRIS_D_OFFICE + 1, 'x');
    const n = noms(p, [jour(long, '2025-07-04')])('Lieu_A_04.07.25');
    expect(n.calendrier).toHaveLength(1);
    expect(n.calendrier[0].long).toBe(true);
    expect(n.propose).toBeNull();
    expect(noms(p, [jour(long, '2025-07-04')], { 'd:Lieu_A_04.07.25': { nom: 'Nom_IA_04.07.25' } })('Lieu_A_04.07.25').propose?.source).toBe('ia');
    // 40 caractères : pris d'office.
    expect(noms(p, [jour(long.slice(0, TITRE_MAX_PRIS_D_OFFICE), '2025-07-04')])('Lieu_A_04.07.25').propose?.source).toBe('calendrier');
  });

  it('deux dossiers voisins du même lieu le même jour sont numérotés ; pas dans deux parents différents', () => {
    const p = plan(
      { 'Lieu_A_04.07.25': ['2025-07-04T10:00:00'], 'Lieu_A_04.07.25_b': ['2025-07-04T18:00:00'] },
      { 'Lieu_A_04.07.25': GPS('Lieu_A'), 'Lieu_A_04.07.25_b': GPS('Lieu_A') },
    );
    const n = noms(p, [jour('Fete X', '2025-07-04')]);
    expect([n('Lieu_A_04.07.25').calendrier[0].nom, n('Lieu_A_04.07.25_b').calendrier[0].nom]).toEqual(['Fete X Lieu A 04.07.25', 'Fete X Lieu A 2 04.07.25']);

    const a = { origine: 'lieu_connu' as const, lieu: 'Maison_A' };
    const b = { origine: 'lieu_connu' as const, lieu: 'Maison_B' };
    const q = plan({ 'Maison_A/04.07.25': ['2025-07-04T10:00:00'], 'Maison_B/04.07.25': ['2025-07-04T18:00:00'] }, { Maison_A: a, 'Maison_A/04.07.25': a, Maison_B: b, 'Maison_B/04.07.25': b });
    const m = noms(q, [jour('Fete X', '2025-07-04')]);
    expect([m('Maison_A/04.07.25').calendrier[0].nom, m('Maison_B/04.07.25').calendrier[0].nom]).toEqual(['Fete X 04.07.25', 'Fete X 04.07.25']);
  });

  it('lieu inconnu, ancien nom du tri, nom donné à la main, photos sans date', () => {
    const p = plan({ Lieu_03: ['2025-07-04T10:00:00'], 'Lieu_A_2025-07-05': ['2025-07-05T10:00:00'], 'Fete_W_06.07.25': ['2025-07-06T10:00:00'] }, { Lieu_03: GPS('Lieu_03') });
    const evts = [jour('Fete X', '2025-07-04'), jour('Fete Y', '2025-07-05')];
    const cibles = dossiersANommer(p, true);
    const r = nomsPossibles(p, cibles, evts);
    const de = (nom: string) => r.get(`d:${nom}`)!;
    expect(de('Lieu_03').lieu).toBeNull();
    expect(de('Lieu_03').calendrier.map((k) => k.nom)).toEqual(['Fete X 04.07.25']);
    expect(lieuPourNom(p, cibles.find((c) => c.nom === 'Lieu_A_2025-07-05')!)).toBe('Lieu A');
    expect(de('Lieu_A_2025-07-05').calendrier.map((k) => k.nom)).toEqual(['Fete Y Lieu A 05.07.25']);
    // Nommé à la main : son nom ne dit pas forcément un lieu.
    expect(de('Fete_W_06.07.25').lieu).toBeNull();

    const q = plan({ 'Lieu_E_07.07.25': ['2025-07-07T10:00:00'] }, { 'Lieu_E_07.07.25': GPS('Lieu_E') });
    for (const x of q.fichiers.values()) q.fichiers.set(x.id, { ...x, origineDate: 'fichier' });
    const n = noms(q, [jour('Fete X', '2025-07-07')])('Lieu_E_07.07.25');
    // Date tirée du fichier seulement : pas sûre, rien du calendrier, le lieu sans date.
    expect(n.calendrier).toEqual([]);
    expect(n.lieu).toBe('Lieu E');
  });

  it('une proposition de l’IA mal formée est ignorée', () => {
    const p = plan({ 'Lieu_A_04.07.25': ['2025-07-04T10:00:00'] }, { 'Lieu_A_04.07.25': GPS('Lieu_A') });
    for (const ia of [{ 'd:Lieu_A_04.07.25': { nom: 42 } }, { 'd:Lieu_A_04.07.25': 'Nom' }, { 'd:Lieu_A_04.07.25': { nom: '  ' } }, { 'd:Lieu_A_04.07.25': [{ nom: 'x' }] }]) {
      const n = noms(p, [], ia)('Lieu_A_04.07.25');
      expect(n.ia).toBeNull();
      expect(n.propose).toBeNull();
    }
  });
});

describe('nom d’une journée sortie d’un dossier (D94)', () => {
  const noel: EvenementCalendrier = { titre: 'Noël chez Mamie', debut: '2025-12-24', fin: '2025-12-24', journee: true, recurrent: false };
  const dates = ['2025-12-24T18:00:00', '2025-12-24T20:30:00'];

  it('le titre de l’événement qui couvre les photos, avec le jour', () => {
    expect(nomPourJournee('Domicile', null, '2025-12-24', dates, [noel])).toBe('Noel_chez_Mamie_24.12.25');
  });

  it('sinon le lieu du dossier, ou celui du parent pour un dossier daté', () => {
    expect(nomPourJournee('Lieu_A_13-29.08.25', null, '2025-08-15', ['2025-08-15T10:00:00'], [noel])).toBe('Lieu_A_15.08.25');
    expect(nomPourJournee('Lieu_A_15.08.25_b', null, '2025-08-15', ['2025-08-15T10:00:00'], [])).toBe('Lieu_A_15.08.25');
    expect(nomPourJournee('09-26.12.25', 'Domicile', '2025-12-13', ['2025-12-13T10:00:00'], [])).toBe('Domicile_13.12.25');
  });
});
