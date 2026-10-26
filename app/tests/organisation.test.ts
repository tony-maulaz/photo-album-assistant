import { describe, expect, it } from 'vitest';
import consolidationConsigne from '../src/ia/consignes/consolidation_consigne.txt?raw';
import consolidationSysteme from '../src/ia/consignes/consolidation_systeme.txt?raw';
import fragmentsConsigne from '../src/ia/consignes/fragments_consigne.txt?raw';
import nommageConsigne from '../src/ia/consignes/nommage_consigne.txt?raw';
import nommageSousDossier from '../src/ia/consignes/nommage_sous_dossier.txt?raw';
import nommageSysteme from '../src/ia/consignes/nommage_systeme.txt?raw';
import {
  casLimites,
  groupesSansGps,
  lireCasLimites,
  lireSituation,
  lotsCasLimites,
  requeteCasLimites,
  requeteSituer,
  voisinesDuGroupe,
  type PhotoLieu,
} from '../src/lib/aidesTri';
import {
  consigneConsolidationGroupe,
  dossiersAPlanche,
  estimationConsolidation,
  groupesDeFreres,
  lireConsolidation,
  listeDossiers,
  requeteConsolidation,
} from '../src/lib/consolidation';
import {
  candidatsRattachement,
  cibleEvidente,
  consigneFragmentDossier,
  dossiersAvecPhotos,
  fragments,
  lireFragment,
  niveauRessemblance,
  noterRattachement,
  OPTIONS_FRAGMENTS,
  photosVoisin,
  requeteFragment,
  ressortirFragment,
  SEUIL_PETIT_DOSSIER,
} from '../src/lib/fragments';
import {
  consigneNommageDossier,
  dossiersANommer,
  echantillon,
  estimationNommage,
  estNomAutomatique,
  lieuDuDossier,
  MOTIF_AUTO,
  MOTIF_DATE_SEULE,
  lireNommage,
  normaliserNom,
  outilRechercheWeb,
  requeteNommage,
  respecteConvention,
  schemaNommage,
} from '../src/lib/nommage';
import { fusionnerDossiers, Historique, planVide, RACINE, renommerDossier, type FichierPlan, type Plan } from '../src/lib/plan';

/** Petit plan de test : dossiers (chemin → dates des photos). */
function plan(dossiers: Record<string, string[]>): Plan {
  const p = planVide();
  for (const [chemin, dates] of Object.entries(dossiers)) {
    let parent = RACINE;
    const parties = chemin.split('/');
    parties.forEach((nom, i) => {
      const id = `d:${parties.slice(0, i + 1).join('/')}`;
      if (!p.dossiers.has(id)) p.dossiers.set(id, { id, nom, parent, origine: 'tri' });
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

const identite = (f: FichierPlan) => `#${f.nom}@${f.taille}`;
const h = (n: number) => n.toString(16).padStart(16, '0');

describe('consignes reprises mot pour mot (scripts 04 et 05)', () => {
  it('nommage', () => {
    expect(nommageSysteme).toContain('Theme_Lieu_JJ.MM.AA          ex. Cigognes_Avenches_09.06.25');
    expect(nommageSysteme).toContain('Si l\'activité n\'est pas identifiable avec certitude, garde uniquement le lieu');
    expect(nommageConsigne).toContain('Lieu détecté par GPS : {lieu}\nDate : {dates}\nNombre total de photos : {n}');
    expect(nommageConsigne).toContain('{"nom": "<Theme_Lieu_JJ.MM.AA selon la convention>",');
    expect(nommageSousDossier).toBe(
      '\n\nCe dossier est un SOUS-DOSSIER de « {parent} » : ne répète pas ce nom, décris seulement l\'activité ou l\'occasion (ex. Anniversaire_Lea_26.01.25, Raclette_24.12.25).',
    );
  });

  it('consolidation et fragments', () => {
    expect(consolidationSysteme).toContain('après un tri GPS automatique qui a parfois éclaté une même activité');
    expect(consolidationConsigne).toContain('noms quasi identiques (Vol_KohSamui / Vol_Koh_Samui)');
    expect(consolidationConsigne).toContain('{"fusions": [{"cible": "<nom du dossier final>",');
    expect(fragmentsConsigne).toContain('Dossier isolé : « {fragment} » ({periode_frag})');
    expect(fragmentsConsigne).toContain('{"absorber": true|false, "cible": "<nom exact du dossier voisin ou null>",');
  });
});

describe('nommage (étape 6, script 04)', () => {
  const p = plan({
    'Vienne_2025-08-16': ['2025-08-16T10:00:00', '2025-08-16T11:00:00'],
    'Anniversaire_Lea_26.01.25': ['2025-01-26T15:00:00'],
    'Maison/2025-01-05': ['2025-01-05T12:00:00'],
    Maison: [],
    Sans_lieu: ['2025-03-03T10:00:00'],
    'Lieu_03': ['2025-04-01T09:00:00'],
    'Vide_2025-05-05': [],
  });

  it('choisit les dossiers au nom automatique, avec le parent des sous-dossiers', () => {
    expect(dossiersANommer(p).map((c) => [c.nom, c.parent, c.photos.length])).toEqual([
      ['Lieu_03', null, 1],
      ['2025-01-05', 'Maison', 1],
      ['Vienne_2025-08-16', null, 2],
    ]);
    expect(dossiersANommer(p, true).map((c) => c.nom)).toContain('Anniversaire_Lea_26.01.25');
    expect(dossiersANommer(p, true).map((c) => c.nom)).not.toContain('Sans_lieu');
  });

  it('noms automatiques : l’ancien format du tri toujours, JJ.MM.AA seulement s’il est encore celui du tri', () => {
    // Anciens noms (AAAA-MM-JJ) : seul le tri les donnait.
    expect(estNomAutomatique('Ko_Samui_2026-07-18')).toBe(true);
    expect(estNomAutomatique('Ko_Samui_2026-07_b')).toBe(true);
    expect(estNomAutomatique('2025-01-05')).toBe(true);
    expect(estNomAutomatique('Lieu_03')).toBe(true);
    // Format de la famille : le même que les dossiers nommés à la main.
    for (const nom of ['Vallon_22.11.25', 'Ko_Samui_18-24.07.26', 'Ko_Samui_28.06-02.07.26', 'Nouvel_An_28.12.25-02.01.26', 'Lausanne_11.25', 'Vallon_22.11.25_b', '22.11.25']) {
      expect(MOTIF_AUTO.test(nom) || MOTIF_DATE_SEULE.test(nom)).toBe(true);
      expect(estNomAutomatique(nom, nom)).toBe(true);
      expect(estNomAutomatique(nom)).toBe(false);
    }
    // Renommé par l'utilisateur (le nom du tri reste noté) : plus automatique.
    expect(estNomAutomatique('Concert_Vallon_22.11.25', 'Vallon_22.11.25')).toBe(false);
    // Un lieu connu sans date n'est pas un nom à remplacer.
    expect(estNomAutomatique('Maison', 'Maison')).toBe(false);
    const q = plan({ 'Vallon_22.11.25': ['2025-11-22T10:00:00'], 'Baignade_Lac_11.03.25': ['2025-03-11T10:00:00'] });
    const tri = [...q.dossiers.values()].find((d) => d.nom === 'Vallon_22.11.25')!;
    q.dossiers.set(tri.id, { ...tri, tri: { origine: 'gps', lieu: 'Vallon', nom: 'Vallon_22.11.25' } });
    expect(dossiersANommer(q).map((c) => c.nom)).toEqual(['Vallon_22.11.25']);
  });

  it('échantillon réparti et lieu tiré du nom', () => {
    expect(echantillon([...Array(12).keys()], 5)).toEqual([0, 2, 4, 7, 9]);
    expect(echantillon([1, 2], 5)).toEqual([1, 2]);
    expect(lieuDuDossier('Vienne_2025-08-16', null)).toBe('Vienne');
    expect(lieuDuDossier('Koh_Samui_2026-07_b', null)).toBe('Koh Samui');
    expect(lieuDuDossier('2025-01-05', 'Chez_Papi')).toBe('Chez Papi');
    expect(lieuDuDossier('Vallon_22.11.25', null)).toBe('Vallon');
    expect(lieuDuDossier('Ko_Samui_18-24.07.26_b', null)).toBe('Ko Samui');
    expect(lieuDuDossier('Ko_Samui_28.06-02.07.26', null)).toBe('Ko Samui');
    expect(lieuDuDossier('05.01.25', 'Chez_Papi')).toBe('Chez Papi');
  });

  it('assemble la consigne : lieu, période, sous-dossier, calendrier, contexte, monuments', () => {
    const [, sous, village] = dossiersANommer(p);
    const c = consigneNommageDossier(village, { gps: { lat: 45.89234, lon: 6.12 }, contexte: 'Année 2025 en famille' });
    expect(c).toContain('Lieu détecté par GPS : Vienne (45.8923, 6.1200)\nDate : 16.08.2025\nNombre total de photos : 2');
    expect(c).toContain('Contexte donné par la famille pour ce projet : Année 2025 en famille');
    const s = consigneNommageDossier(sous, { calendrier: '\n\nÉvénements du calendrier familial…', monuments: true });
    expect(s).toContain('Lieu détecté par GPS : Maison');
    expect(s).toContain('SOUS-DOSSIER de « Maison »');
    expect(s.indexOf('SOUS-DOSSIER')).toBeLessThan(s.indexOf('Événements du calendrier'));
    expect(s).toContain('"monuments"');
  });

  it('schéma : les monuments avant le nom, pour que l’IA s’en serve en nommant (D51)', () => {
    const avec = schemaNommage(true) as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(avec.properties)[0]).toBe('monuments');
    expect(avec.required).toEqual(['monuments', 'nom', 'activite', 'confiance', 'justification']);
    expect(Object.keys((schemaNommage() as { properties: Record<string, unknown> }).properties)).toEqual(['nom', 'activite', 'confiance', 'justification']);
  });

  it('requête : photos annoncées, recherche web, clé indépendante des chemins', () => {
    const [, , village] = dossiersANommer(p);
    const r = requeteNommage(village, 'claude-sonnet-5-5', identite);
    expect(r.contenu.map((b) => b.type)).toEqual(['texte', 'photo', 'texte', 'photo', 'texte']);
    expect(r.contenu[0]).toEqual({ type: 'texte', texte: 'Photo 1 :' });
    expect(r.contenu[1]).toMatchObject({ type: 'photo', cote: 768 });
    expect(r.outils).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }]);
    expect(requeteNommage(village, 'claude-sonnet-5-5', identite, { recherche: false }).outils).toBeNull();
    expect(outilRechercheWeb('claude-haiku-4-5', 2).type).toBe('web_search_20250305');
    const deplace = { ...village, photos: village.photos.map((f) => ({ ...f, id: `ailleurs/${f.id}` })) };
    expect(requeteNommage(deplace, 'claude-sonnet-5-5', identite).cle).toBe(r.cle);
    expect(requeteNommage(village, 'claude-sonnet-5-5', identite, { contexte: 'autre' }).cle).not.toBe(r.cle);
    expect(r.schema).toMatchObject({ required: ['nom', 'activite', 'confiance', 'justification'] });
  });

  it('lit des réponses abîmées (I9, I12)', () => {
    expect(lireNommage([{ nom: 'Fête à Lyon 9.6.25', confiance: '8/10', activite: 'Fête', justification: 'drapeaux', monuments: ['Château', 3, ''] }])).toEqual({
      nom: 'Fete_a_Lyon_09.06.25',
      nomBrut: 'Fête à Lyon 9.6.25',
      activite: 'Fête',
      confiance: 8,
      justification: 'drapeaux',
      monuments: ['Château'],
    });
    expect(lireNommage(null)).toBeNull();
    expect(lireNommage({ nom: '???' })).toBeNull();
    expect(lireNommage({ nom: 'Ski_Verbier_02.02.25', confiance: 42 })?.confiance).toBe(10);
  });

  it('ramène les noms à la convention', () => {
    expect(normaliserNom('Cigognes Avenches 09.06.2025')).toBe('Cigognes_Avenches_09.06.25');
    expect(normaliserNom('Vienne_2025-08-16')).toBe('Vienne_16.08.25');
    expect(normaliserNom('Annecy_27-29.06.25')).toBe('Annecy_27-29.06.25');
    expect(normaliserNom('Baignade à l’Isle')).toBe('Baignade_a_l_Isle');
    expect(normaliserNom('__CON__')).toBe('');
    expect(respecteConvention('Cigognes_Avenches_09.06.25')).toBe(true);
    expect(respecteConvention('Annecy_27-29.06.25')).toBe(true);
    expect(respecteConvention('Vienne_2025-08-16')).toBe(false);
  });

  it('estime le coût, recherches comprises', () => {
    const e = estimationNommage([12, 3, 0], 'claude-sonnet-5-5');
    expect([e.appels, e.images, e.recherches]).toEqual([2, 8, 6]);
    expect(e.usd).toBeGreaterThan(0.06);
    expect(estimationNommage([12], 'claude-sonnet-5-5', { recherche: false }).recherches).toBe(0);
  });
});

describe('consolidation (étape 7, script 05)', () => {
  const p = plan({
    'Vol_KohSamui_18.07.26': ['2026-07-18T08:00:00', '2026-07-18T09:00:00', '2026-07-18T09:30:00'],
    'Vol_Koh_Samui_18.07.26': ['2026-07-18T16:00:00'],
    'Plage_Chaweng_18-20.07.26': Array.from({ length: 10 }, (_, i) => `2026-07-${18 + (i % 3)}T15:0${i}:00`),
    'Lieu_07': Array.from({ length: 9 }, () => '2026-07-21T10:00:00'),
    'Temple_22.07.26': Array.from({ length: 9 }, () => '2026-07-22T10:00:00'),
    'Voyage_Thailande_2026-07/Marche_23.07.26': ['2026-07-23T08:00:00'],
    'Voyage_Thailande_2026-07/Temple_23.07.26': ['2026-07-23T15:00:00'],
    'Sans_lieu': ['2026-07-24T10:00:00'],
  });
  const groupes = groupesDeFreres(p);
  const racine = groupes.find((g) => g.parent === RACINE)!;

  it('répertoires d’au moins deux dossiers de photos', () => {
    expect(groupes.map((g) => g.dossiers.length).sort()).toEqual([2, 6]);
    expect(racine.dossiers.map((d) => d.nom)).not.toContain('Sans_lieu');
  });

  it('liste, planches et consigne comme le script', () => {
    expect(listeDossiers(racine.dossiers)).toContain('- Vol_KohSamui_18.07.26  (3 photos, 18.07)');
    expect(listeDossiers(racine.dossiers)).toContain('- Plage_Chaweng_18-20.07.26  (10 photos, 18.07-20.07)');
    expect(dossiersAPlanche(racine.dossiers).map((d) => d.nom)).toEqual(['Lieu_07', 'Vol_Koh_Samui_18.07.26', 'Vol_KohSamui_18.07.26', 'Voyage_Thailande_2026-07']);
    expect(consigneConsolidationGroupe(racine)).toContain('Des planches de miniatures sont fournies ci-dessus');
    const r = requeteConsolidation(racine, 'claude-sonnet-5-5', identite);
    expect(r.contenu[0]).toEqual({ type: 'texte', texte: 'Planche du dossier « Lieu_07 » :' });
    expect(r.contenu[1]).toMatchObject({ type: 'planche', cellule: 260, colonnes: 3 });
    expect((r.contenu[1] as { ids: string[] }).ids.length).toBe(6);
    expect(estimationConsolidation(groupes, 'claude-sonnet-5-5').appels).toBe(2);
  });

  it('valide les fusions et renommages (dossiers inconnus refusés, I9)', () => {
    const id = (nom: string) => racine.dossiers.find((d) => d.nom === nom)!.id;
    const c = lireConsolidation(
      {
        fusions: [
          { cible: 'Vol_KohSamui_18.07.26', sources: ['vol_koh_samui_18.07.26', 'Inconnu_01', 'Vol_KohSamui_18.07.26'], raison: 'même vol' },
          { cible: 'Plage_Chaweng_18-21.07.26', sources: ['Plage_Chaweng_18-20.07.26'], raison: 'étendue' },
          { cible: 'Rien', sources: [] },
          'pas un objet',
        ],
        renommages: [
          { dossier: 'Lieu_07', nom: 'Temple Wat Phra 21.07.26', raison: 'vu sur la planche' },
          { dossier: 'Vol_Koh_Samui_18.07.26', nom: 'Autre' },
          { dossier: 'Fantome', nom: 'X' },
          { dossier: 'Temple_22.07.26', nom: 'Temple_22.07.26' },
        ],
      },
      racine,
    );
    expect(c.fusions).toEqual([
      { cible: 'Vol_KohSamui_18.07.26', cibleId: id('Vol_KohSamui_18.07.26'), sources: [id('Vol_Koh_Samui_18.07.26')], raison: 'même vol' },
      { cible: 'Plage_Chaweng_18-21.07.26', cibleId: null, sources: [id('Plage_Chaweng_18-20.07.26')], raison: 'étendue' },
    ]);
    expect(c.renommages).toEqual([{ dossier: id('Lieu_07'), nom: 'Temple_Wat_Phra_21.07.26', raison: 'vu sur la planche' }]);
    expect(c.inconnus).toEqual(['Inconnu_01', 'Fantome']);
    expect(lireConsolidation([{ fusions: null, renommages: 'x' }], racine)).toEqual({ fusions: [], renommages: [], inconnus: [] });
    expect(lireConsolidation(null, racine).fusions).toEqual([]);
  });
});

describe('petits dossiers (étape 8, script 05 --fragments, D90)', () => {
  const p = plan({
    Bateau: ['2026-07-24T12:00:00', '2026-07-24T12:05:00'],
    Plage: Array.from({ length: 10 }, (_, i) => `2026-07-24T10:${String(i * 5).padStart(2, '0')}:00`),
    Temple: Array.from({ length: 8 }, (_, i) => `2026-07-24T1${3 + Math.floor(i / 4)}:${String(i * 7).padStart(2, '0')}:00`),
    Lendemain: Array.from({ length: 6 }, () => '2026-07-25T08:30:00'),
    Petit: ['2026-07-24T12:30:00', '2026-07-24T12:31:00', '2026-07-24T12:32:00'],
  });
  // Empreintes : le bateau ressemble à la plage, pas au temple.
  const empreintes: Record<string, string> = { Bateau: h(0), Plage: h(3), Temple: 'ffffffffffffffff', Lendemain: h(1), Petit: h(0) };
  const empreinte = (f: FichierPlan) => empreintes[f.id.split('/')[0]];
  const cibles = dossiersAvecPhotos(p);
  const liste = fragments(
    cibles.filter((d) => d.photos.length < SEUIL_PETIT_DOSSIER),
    cibles,
    p,
    empreinte,
  );
  const bateau = liste.find((f) => f.dossier.nom === 'Bateau')!;
  const petit = liste.find((f) => f.dossier.nom === 'Petit')!;

  it('le dossier juste avant et juste après, photo à photo, quel que soit l’écart ; petits compris', () => {
    expect(liste.map((f) => f.dossier.nom).sort()).toEqual(['Bateau', 'Petit']);
    expect(bateau.voisins.map((v) => [v.cote, v.dossier.nom, v.ecart, v.petit, v.pendant])).toEqual([
      ['avant', 'Plage', 75, false, false],
      ['apres', 'Petit', 25, true, false],
    ]);
    expect(petit.voisins.map((v) => [v.cote, v.dossier.nom, v.ecart])).toEqual([
      ['avant', 'Bateau', 25],
      ['apres', 'Temple', 28],
    ]);
    // Les photos du voisin prises au plus près, dans l'ordre ; la ressemblance reste un indice.
    expect(bateau.voisins[0].proches.map((f) => f.date!.slice(11, 16))).toEqual(['10:30', '10:35', '10:40', '10:45']);
    expect(bateau.voisins[0].ressemblance).toBe(2);
    expect([2, 12, 16, 26, 99].map(niveauRessemblance)).toEqual(['tres', 'tres', 'oui', 'peu', null]);
    expect(SEUIL_PETIT_DOSSIER).toBe(OPTIONS_FRAGMENTS.seuilFragment);
  });

  it('pris pendant une sortie : elle prend la place d’avant, le suivant celle d’après', () => {
    const q = plan({
      Ko_Samui: ['2026-07-18T10:00:00', '2026-07-20T10:00:00', '2026-07-22T10:00:00', '2026-07-23T10:00:00', '2026-07-24T10:00:00'],
      Arret: ['2026-07-21T12:00:00'],
      Retour: Array.from({ length: 5 }, () => '2026-07-26T09:00:00'),
    });
    const c = dossiersAvecPhotos(q);
    const [f] = fragments(
      c.filter((d) => d.nom === 'Arret'),
      c,
      q,
      () => undefined,
    );
    expect(f.voisins.map((v) => [v.cote, v.dossier.nom, v.pendant])).toEqual([
      ['avant', 'Ko_Samui', true],
      ['apres', 'Retour', false],
    ]);
  });

  it('planches : le petit dossier, puis ses deux voisins, puis la consigne', () => {
    expect(consigneFragmentDossier(bateau)).toContain('Dossier isolé : « Bateau » (24.07 12:00 - 12:05)');
    expect(consigneFragmentDossier(bateau)).toContain('- Plage (10 photos, 24.07 10:00 - 10:45)');
    const r = requeteFragment(bateau, 'claude-sonnet-5-5', identite)!;
    expect(r.contenu.map((b) => (b.type === 'texte' ? b.texte.slice(0, 30) : b.type))).toEqual([
      'Planche du dossier isolé « Bat',
      'planche',
      'Planche du voisin « Plage » :',
      'planche',
      'Planche du voisin « Petit » :',
      'planche',
      'Un petit dossier de 2 photo(s)',
    ]);
    expect(r.contenu[1]).toMatchObject({ cellule: 260, colonnes: 3 });
    expect(photosVoisin(cibles.find((d) => d.nom === 'Plage')!, bateau.dossier).map((f) => f.date!.slice(11, 16))).toEqual(['10:20', '10:25', '10:30', '10:35', '10:40', '10:45']);
    expect(requeteFragment({ ...bateau, voisins: [] }, 'claude-sonnet-5-5', identite)).toBeNull();
  });

  it('valide la décision : seul un voisin envoyé peut recevoir le petit dossier', () => {
    expect(lireFragment([{ absorber: 'true', cible: 'plage', confiance: 9, raison: 'même décor' }], bateau)).toEqual({
      absorber: true,
      cible: cibles.find((d) => d.nom === 'Plage')!.id,
      nomPropose: null,
      confiance: 9,
      raison: 'même décor',
    });
    expect(lireFragment({ absorber: true, cible: 'Lendemain' }, bateau)).toMatchObject({ absorber: false, cible: null });
    expect(lireFragment({ absorber: false, cible: null, nom_propose: 'Repas bateau 24.07.26', confiance: null }, bateau)).toMatchObject({
      absorber: false,
      nomPropose: 'Repas_bateau_24.07.26',
      confiance: null,
    });
    expect(lireFragment('n’importe quoi', bateau)).toBeNull();
  });

  it('dossier évident : à moins d’1 h et de 10 km, jamais un lieu connu ni un dossier de mois', () => {
    // Sans position : jamais évident.
    expect(cibleEvidente(petit, p)).toBeNull();
    const q = plan({ Bateau: ['2026-07-24T12:00:00', '2026-07-24T12:05:00'], Petit: ['2026-07-24T12:30:00'], Temple: Array.from({ length: 6 }, () => '2026-07-24T18:00:00') });
    for (const f of q.fichiers.values()) q.fichiers.set(f.id, { ...f, gps: { lat: f.id.startsWith('Petit') ? 46.505 : 46.5, lon: 6.6 } });
    const c = dossiersAvecPhotos(q);
    const evident = () => cibleEvidente(fragments(c.filter((d) => d.nom === 'Petit'), c, q, () => undefined)[0], q);
    expect(evident()?.dossier.nom).toBe('Bateau');
    expect(evident()?.distanceKm).toBeCloseTo(0.56, 1);
    q.dossiers.set('d:Bateau', { ...q.dossiers.get('d:Bateau')!, tri: { origine: 'lieu_connu', lieu: 'Maison' } });
    expect(evident()).toBeNull();
  });

  it('« Autre dossier… » : les dossiers pris au plus près dans le temps d’abord, photo à photo', () => {
    expect(candidatsRattachement(p, bateau.dossier, cibles).map((c) => [c.nom, c.ecart])).toEqual([
      ['Petit', 25],
      ['Temple', 55],
      ['Plage', 75],
      ['Lendemain', 1225],
    ]);
  });

  it('un petit dossier rattaché se ressort, même après d’autres changements', () => {
    const q = plan({
      Bateau: ['2026-07-24T12:00:00', '2026-07-24T12:05:00'],
      Plage: Array.from({ length: 6 }, (_, i) => `2026-07-24T10:0${i}:00`),
      Temple: Array.from({ length: 6 }, (_, i) => `2026-07-24T15:0${i}:00`),
    });
    const etat = () => JSON.stringify([[...q.dossiers.values()].sort((a, b) => a.id.localeCompare(b.id)), [...q.fichiers.values()].sort((a, b) => a.id.localeCompare(b.id))]);
    const avant = etat();
    const g = groupesDeFreres(q)[0];
    const bateauQ = g.dossiers.find((d) => d.nom === 'Bateau')!;
    const plage = g.dossiers.find((d) => d.nom === 'Plage')!.id;
    const temple = g.dossiers.find((d) => d.nom === 'Temple')!.id;
    const note = noterRattachement(q, bateauQ, plage, true)!;
    expect(note).toMatchObject({ cibleNom: 'Plage', avecVoisins: true, fichiers: [{ id: 'Bateau/IMG_0.jpg', nom: 'IMG_0.jpg' }, { id: 'Bateau/IMG_1.jpg', nom: 'IMG_1.jpg' }] });
    fusionnerDossiers(q, bateauQ.id, plage);
    // Les noms se heurtent dans Plage (IMG_0.jpg) : ils reprennent le leur en revenant.
    expect(q.fichiers.get('Bateau/IMG_0.jpg')!.nom).not.toBe('IMG_0.jpg');
    // Un autre changement entre-temps : le ressortir reste possible.
    renommerDossier(q, temple, 'Temple_Wat');
    const h = new Historique();
    h.enregistrer(ressortirFragment(q, note));
    expect(etat()).toBe(avant.replace('"nom":"Temple"', '"nom":"Temple_Wat"'));
    expect(ressortirFragment(q, note)).toBeNull();
    h.annuler(q);
    expect(q.dossiers.has(bateauQ.id)).toBe(false);
    // Photos déplacées ailleurs depuis : rien à ressortir.
    fusionnerDossiers(q, plage, temple);
    expect(ressortirFragment(q, note)).toBeNull();
  });
});

describe('aides du tri (IA1, IA2, IA5)', () => {
  it('IA1 : cas limites autour du seuil, par lots de 6 d’un même dossier', () => {
    const photos = [30, 45, 55, 62, 70, 81, 100].map((n, i) => ({ id: `p${i}`, dossier: i < 4 ? 'a' : 'b', nettete: n, date: `2026-07-24T10:0${i}:00` }));
    expect(casLimites(photos, 60).map((p) => p.nettete)).toEqual([62, 55, 70, 45, 81]);
    const lots = lotsCasLimites(casLimites(photos, 60));
    expect(lots.map((l) => l.map((p) => p.id))).toEqual([
      ['p1', 'p2', 'p3'],
      ['p4', 'p5'],
    ]);
    const r = requeteCasLimites(lots[0], 'claude-sonnet-5-5', (id) => `#${id}`);
    expect(r.contenu[0]).toMatchObject({ type: 'planche', numeros: [1, 2, 3], cellule: 520 });
    expect((r.contenu[1] as { texte: string }).texte).toContain('numérotées de 1 à 3');
    const v = lireCasLimites(
      {
        photos: [
          { numero: 1, verdict: 'ratée', raison: 'bougé' },
          { numero: 1, verdict: 'nette' },
          { numero: '2', verdict: 'flou_voulu' },
          { numero: 7, verdict: 'nette' },
          { numero: 3, verdict: 'magnifique' },
        ],
      },
      lots[0],
    );
    expect([...v]).toEqual([
      ['p1', { verdict: 'ratee', raison: 'bougé' }],
      ['p2', { verdict: 'flou_voulu', raison: '' }],
    ]);
    expect(lireCasLimites(null, lots[0]).size).toBe(0);
  });

  it('IA2 : photos sans GPS, voisines avant et après, réponse « aucun »', () => {
    const gps = { lat: 9.5, lon: 100 };
    const photos: PhotoLieu[] = [
      { id: 'v1', date: '2026-07-24T09:00:00', gps, dossier: 'Marche' },
      { id: 'v2', date: '2026-07-24T11:50:00', gps, dossier: 'Plage' },
      { id: 'v3', date: '2026-07-24T11:55:00', gps, dossier: 'Plage' },
      { id: 's1', date: '2026-07-24T12:00:00', dossier: 'Plage' },
      { id: 's2', date: '2026-07-24T12:20:00', dossier: 'Plage' },
      { id: 'v4', date: '2026-07-24T13:00:00', gps, dossier: 'Temple' },
      { id: 's3', date: '2026-07-24T18:00:00', dossier: 'Sans_lieu' },
    ];
    const groupes = groupesSansGps(photos);
    expect(groupes.map((g) => g.map((p) => p.id))).toEqual([['s1', 's2'], ['s3']]);
    const voisines = voisinesDuGroupe(groupes[0], photos);
    expect(voisines.map((p) => p.id)).toEqual(['v1', 'v3', 'v4']);
    const r = requeteSituer(groupes[0], voisines, (d) => ({ nom: d, lieu: d === 'Plage' ? 'Chaweng' : undefined }), 'claude-sonnet-5-5', (id) => `#${id}`)!;
    const consigne = (r.contenu.at(-1) as { texte: string }).texte;
    expect(consigne).toContain('Photos à situer : A (24.07 12:00), B (24.07 12:20)');
    expect(consigne).toContain('- Photo 2 : 24.07 11:55, dossier « Plage » (Chaweng)');
    expect(r.contenu.filter((b) => b.type === 'photo').length).toBe(5);
    expect(lireSituation({ voisine: 2, confiance: 8, raison: 'même plage' }, voisines)).toEqual({ dossier: 'Plage', voisine: 'v3', confiance: 8, raison: 'même plage' });
    expect(lireSituation({ voisine: 0 }, voisines)?.dossier).toBeNull();
    expect(lireSituation({ voisine: 9 }, voisines)?.dossier).toBeNull();
    expect(requeteSituer(groupes[1], [], () => ({ nom: '' }), 'claude-sonnet-5-5', (id) => id)).toBeNull();
  });
});
