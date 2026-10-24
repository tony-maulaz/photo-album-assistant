import { describe, expect, it } from 'vitest';
import { creerDossier, deplacerFichiers, mettreDeCote, renommerDossier, type Plan } from '../src/lib/plan';
import { genererRapport, phraseBilan } from '../src/lib/rapport';
import {
  bilan,
  cheminSortie,
  cleChemin,
  definirLangueSortie,
  etatVide,
  octetsACopier,
  planifierSynchro,
  sourceRelue,
  type ActionSynchro,
  type EtatSortie,
  type ListingSortie,
} from '../src/lib/sortie';
import { planInitial, type ElementSource } from '../src/lib/source';

function element(chemin: string, taille: number): ElementSource {
  const categorie = chemin.endsWith('.jpg') ? 'photo' : chemin.endsWith('.mp4') ? 'video' : 'autre';
  return { chemin, taille, modifie: Date.UTC(2025, 0, 1), categorie, exif: categorie === 'photo' ? { date: '2025:07:24 20:00:00' } : null };
}

function exemple(): Plan {
  return planInitial([
    element('Paleo/IMG_1.jpg', 100),
    element('Paleo/IMG_2.jpg', 200),
    element('Paleo/clip.mp4', 5000),
    element('_doublons/Paleo/IMG_9.jpg', 90),
    element('notes/liste.txt', 7),
  ]).plan;
}

/** Simule l'exécution des actions : la sortie et l'état après synchronisation (copie de la version du plan). */
function executer(plan: Plan, actions: ActionSynchro[], listing: ListingSortie, etat: EtatSortie) {
  for (const a of actions) {
    const { taille, modifie } = plan.fichiers.get(a.id)!;
    if ((a.type === 'deplacer' || a.type === 'remplacer') && a.depuis) listing.delete(cleChemin(a.depuis));
    if (a.type !== 'conflit') {
      listing.set(cleChemin(a.cible), { chemin: a.cible, taille });
      etat.fichiers[a.id] = { chemin: a.cible, taille, modifie };
    }
  }
}

/** L'original a changé dans la source, et l'inventaire a été mis à jour (D63). */
function modifier(plan: Plan, id: string, changement: { taille?: number; modifie?: number }) {
  plan.fichiers.set(id, { ...plan.fichiers.get(id)!, ...changement });
}

/** Sortie complète, écrite une première fois. */
function ecrite() {
  const plan = exemple();
  const listing: ListingSortie = new Map();
  const etat = etatVide();
  executer(plan, planifierSynchro(plan, listing, etat), listing, etat);
  return { plan, listing, etat };
}

const compter = (actions: ActionSynchro[]) =>
  actions.reduce<Record<string, number>>((c, a) => ((c[a.type] = (c[a.type] ?? 0) + 1), c), {});

const action = (actions: ActionSynchro[], id: string) => actions.find((a) => a.id === id)!;

describe('chemins dans la sortie', () => {
  it('range archive, mis de côté et autres fichiers', () => {
    const plan = planInitial([element('Paleo/IMG_3.jpg', 1), element('Paleo/IMG_3_doublon.jpg', 2), element('_doublons/Paleo/IMG_9.jpg', 90), element('notes/liste.txt', 7), element('Paleo/IMG_1.jpg', 100)]).plan;
    mettreDeCote(plan, ['Paleo/IMG_3.jpg'], 'doublons');
    // Même nom après retrait du suffixe « _doublon » : les chemins d'origine restent distincts.
    expect(cheminSortie(plan, plan.fichiers.get('Paleo/IMG_3.jpg')!)).toBe('_mis_de_cote/doublons/Paleo/IMG_3.jpg');
    expect(cheminSortie(plan, plan.fichiers.get('Paleo/IMG_3_doublon.jpg')!)).toBe('_mis_de_cote/doublons/Paleo/IMG_3_doublon.jpg');
    expect(cheminSortie(plan, plan.fichiers.get('Paleo/IMG_1.jpg')!)).toBe('Photos/Paleo/IMG_1.jpg');
    expect(cheminSortie(plan, plan.fichiers.get('_doublons/Paleo/IMG_9.jpg')!)).toBe('_mis_de_cote/doublons/_doublons/Paleo/IMG_9.jpg');
    expect(cheminSortie(plan, plan.fichiers.get('notes/liste.txt')!)).toBe('_autres_fichiers/notes/liste.txt');
    // Projet en anglais (D60) : mêmes chemins, noms des dossiers techniques en anglais.
    definirLangueSortie('en');
    try {
      expect(cheminSortie(plan, plan.fichiers.get('Paleo/IMG_3.jpg')!)).toBe('_set_aside/duplicates/Paleo/IMG_3.jpg');
      expect(cheminSortie(plan, plan.fichiers.get('notes/liste.txt')!)).toBe('_other_files/notes/liste.txt');
      expect(cheminSortie(plan, plan.fichiers.get('Paleo/IMG_1.jpg')!)).toBe('Photos/Paleo/IMG_1.jpg');
    } finally {
      definirLangueSortie('fr');
    }
  });
});

describe('synchronisation', () => {
  it('copie tout la première fois, puis plus rien (A13)', () => {
    const plan = exemple();
    const listing: ListingSortie = new Map();
    const etat = etatVide();
    const premiere = planifierSynchro(plan, listing, etat);
    expect(compter(premiere)).toEqual({ copier: 5 });
    expect(octetsACopier(plan, premiere)).toBe(100 + 200 + 5000 + 90 + 7);
    executer(plan, premiere, listing, etat);
    expect(compter(planifierSynchro(plan, listing, etat))).toEqual({ garder: 5 });
  });

  it('déplace ce qui a changé de dossier au lieu de le recopier', () => {
    const { plan, listing, etat } = ecrite();
    const { id } = creerDossier(plan, 'Festival');
    deplacerFichiers(plan, ['Paleo/IMG_1.jpg'], id);
    mettreDeCote(plan, ['Paleo/IMG_2.jpg']);
    renommerDossier(plan, 's:Paleo', 'Paléo 2025');
    const actions = planifierSynchro(plan, listing, etat);
    expect(compter(actions)).toEqual({ deplacer: 3, garder: 2 });
    expect(action(actions, 'Paleo/clip.mp4')).toMatchObject({ type: 'deplacer', depuis: 'Photos/Paleo/clip.mp4', cible: 'Photos/Paléo 2025/clip.mp4' });
    expect(action(actions, 'Paleo/IMG_2.jpg')).toMatchObject({ cible: '_mis_de_cote/autres/Paleo/IMG_2.jpg' });
    executer(plan, actions, listing, etat);
    expect(bilan(plan, listing, etat).manquants).toEqual([]);
    expect(compter(planifierSynchro(plan, listing, etat))).toEqual({ garder: 5 });
  });

  it('ne touche jamais un fichier étranger qui occupe la place', () => {
    const plan = exemple();
    const listing: ListingSortie = new Map([[cleChemin('Photos/Paleo/IMG_1.jpg'), { chemin: 'Photos/Paleo/IMG_1.jpg', taille: 999 }]]);
    const actions = planifierSynchro(plan, listing, etatVide());
    expect(action(actions, 'Paleo/IMG_1.jpg').type).toBe('conflit');
  });

  it('compare les chemins sans tenir compte de la casse ni des accents décomposés', () => {
    const plan = exemple();
    renommerDossier(plan, 's:Paleo', 'Paléo');
    const nfd = 'photos/paléo/img_1.jpg';
    const listing: ListingSortie = new Map([[cleChemin(nfd), { chemin: nfd, taille: 100 }]]);
    expect(action(planifierSynchro(plan, listing, etatVide()), 'Paleo/IMG_1.jpg').type).toBe('garder');
  });
});

describe('nouvelle version d’un fichier déjà copié', () => {
  it('même taille, autre date : la copie est remplacée, et le bilan ne la compte pas avant', () => {
    const { plan, listing, etat } = ecrite();
    modifier(plan, 'Paleo/IMG_1.jpg', { modifie: Date.UTC(2025, 5, 1) });
    // Avant : « à jour » (taille seule), et le bilan annonçait « tout est dans la sortie ».
    expect(bilan(plan, listing, etat).manquants.map((m) => m.id)).toEqual(['Paleo/IMG_1.jpg']);
    const actions = planifierSynchro(plan, listing, etat);
    expect(compter(actions)).toEqual({ remplacer: 1, garder: 4 });
    expect(action(actions, 'Paleo/IMG_1.jpg')).toEqual({ type: 'remplacer', id: 'Paleo/IMG_1.jpg', cible: 'Photos/Paleo/IMG_1.jpg' });
    expect(octetsACopier(plan, actions)).toBe(100);
    executer(plan, actions, listing, etat);
    expect(bilan(plan, listing, etat).manquants).toEqual([]);
    expect(compter(planifierSynchro(plan, listing, etat))).toEqual({ garder: 5 });
  });

  it('autre taille : la copie de l’application est remplacée, pas signalée comme un fichier étranger', () => {
    const { plan, listing, etat } = ecrite();
    modifier(plan, 'Paleo/IMG_2.jpg', { taille: 250, modifie: Date.UTC(2025, 5, 1) });
    expect(action(planifierSynchro(plan, listing, etat), 'Paleo/IMG_2.jpg').type).toBe('remplacer');
  });

  it('état ancien, sans la date : la taille seule compte, comme avant', () => {
    const { plan, listing, etat } = ecrite();
    for (const e of Object.values(etat.fichiers)) delete e.modifie;
    modifier(plan, 'Paleo/IMG_1.jpg', { modifie: Date.UTC(2025, 5, 1) });
    modifier(plan, 'Paleo/IMG_2.jpg', { taille: 250 });
    const actions = planifierSynchro(plan, listing, etat);
    expect(action(actions, 'Paleo/IMG_1.jpg').type).toBe('garder');
    expect(action(actions, 'Paleo/IMG_2.jpg').type).toBe('remplacer');
    expect(bilan(plan, listing, etat).manquants.map((m) => m.id)).toEqual(['Paleo/IMG_2.jpg']);
  });

  it('une copie retouchée à la main dans la sortie n’est jamais écrasée', () => {
    const { plan, listing, etat } = ecrite();
    listing.set(cleChemin('Photos/Paleo/IMG_1.jpg'), { chemin: 'Photos/Paleo/IMG_1.jpg', taille: 120 });
    modifier(plan, 'Paleo/IMG_1.jpg', { taille: 130 });
    expect(action(planifierSynchro(plan, listing, etat), 'Paleo/IMG_1.jpg').type).toBe('conflit');
  });

  it('changé et déplacé : la copie est déplacée puis remplacée', () => {
    const { plan, listing, etat } = ecrite();
    renommerDossier(plan, 's:Paleo', 'Paleo 2025');
    modifier(plan, 'Paleo/IMG_1.jpg', { taille: 110 });
    const actions = planifierSynchro(plan, listing, etat);
    expect(action(actions, 'Paleo/IMG_1.jpg')).toEqual({ type: 'remplacer', id: 'Paleo/IMG_1.jpg', cible: 'Photos/Paleo 2025/IMG_1.jpg', depuis: 'Photos/Paleo/IMG_1.jpg' });
    executer(plan, actions, listing, etat);
    expect(bilan(plan, listing, etat)).toMatchObject({ manquants: [], enTrop: [] });
  });
});

describe('place prise par la copie d’un autre fichier', () => {
  /** Deux photos du même nom dans deux dossiers de la source. */
  function deuxHomonymes() {
    const plan = planInitial([element('A/IMG_1.jpg', 100), element('B/IMG_1.jpg', 150)]).plan;
    const listing: ListingSortie = new Map();
    const etat = etatVide();
    executer(plan, planifierSynchro(plan, listing, etat), listing, etat);
    return { plan, listing, etat };
  }

  it('libérée par le déplacement de cette copie : l’autre fichier y est copié', () => {
    const { plan, listing, etat } = deuxHomonymes();
    // A part dans « Ailleurs », B prend sa place dans « A ».
    const { id } = creerDossier(plan, 'Ailleurs');
    deplacerFichiers(plan, ['A/IMG_1.jpg'], id);
    deplacerFichiers(plan, ['B/IMG_1.jpg'], 's:A');
    const actions = planifierSynchro(plan, listing, etat);
    expect(action(actions, 'A/IMG_1.jpg')).toMatchObject({ type: 'deplacer', depuis: 'Photos/A/IMG_1.jpg', cible: 'Photos/Ailleurs/IMG_1.jpg' });
    expect(action(actions, 'B/IMG_1.jpg')).toMatchObject({ type: 'copier', cible: 'Photos/A/IMG_1.jpg', libere: 'A/IMG_1.jpg' });
    // La copie de A n'est pas celle de B : B manque tant qu'il n'est pas copié.
    expect(bilan(plan, listing, etat).manquants.map((m) => m.id).sort()).toEqual(['A/IMG_1.jpg', 'B/IMG_1.jpg']);
    executer(plan, actions, listing, etat);
    expect(bilan(plan, listing, etat).manquants).toEqual([]);
  });

  it('pas libérée si cette copie ne part pas : conflit, rien n’est écrasé', () => {
    const { plan, listing, etat } = deuxHomonymes();
    const { id } = creerDossier(plan, 'Ailleurs');
    deplacerFichiers(plan, ['A/IMG_1.jpg'], id);
    deplacerFichiers(plan, ['B/IMG_1.jpg'], 's:A');
    // Un fichier déposé à la main occupe la nouvelle place de A : A ne peut pas partir.
    listing.set(cleChemin('Photos/Ailleurs/IMG_1.jpg'), { chemin: 'Photos/Ailleurs/IMG_1.jpg', taille: 1 });
    const actions = planifierSynchro(plan, listing, etat);
    expect(action(actions, 'A/IMG_1.jpg').type).toBe('conflit');
    expect(action(actions, 'B/IMG_1.jpg').type).toBe('conflit');
  });
});

describe('bilan et rapport', () => {
  it('compte chaque fichier et liste les manquants et les fichiers en trop (A2)', () => {
    const { plan, listing, etat } = ecrite();
    listing.delete(cleChemin('Photos/Paleo/clip.mp4'));
    listing.set(cleChemin('Photos/ajout.jpg'), { chemin: 'Photos/ajout.jpg', taille: 1 });
    const b = bilan(plan, listing, etat);
    expect([b.total, b.presents, b.manquants.map((m) => m.id), b.enTrop]).toEqual([5, 4, ['Paleo/clip.mp4'], ['Photos/ajout.jpg']]);
    expect(b.categories).toEqual({ photos: 2, videos: 1, autres: 1, misDeCote: { doublons: 1 } });
    expect(phraseBilan(b)).toBe('5 fichiers dans le projet → 4 dans la sortie : 2 photos triées, 1 vidéo, 1 doublon, 1 autre fichier.');
  });

  it('dit vrai sur le dossier à trier relu après l’écriture (D63)', () => {
    const { plan, listing, etat } = ecrite();
    const b = bilan(plan, listing, etat);
    const pareil = sourceRelue(plan, { nouveaux: [], modifies: [], disparus: [] });
    expect(phraseBilan(b, pareil)).toBe('5 fichiers dans le dossier à trier → 5 dans la sortie : 2 photos triées, 1 vidéo, 1 doublon, 1 autre fichier.');
    // 43 photos arrivées, une disparue : le dossier à trier en a 47, le projet 5.
    const arrivees = Array.from({ length: 43 }, (_, i) => `juin/${i}.jpg`);
    const relue = sourceRelue(plan, { nouveaux: arrivees, modifies: [], disparus: ['notes/liste.txt'] });
    expect(relue).toEqual({ fichiers: 47, commeLeProjet: false });
    expect(phraseBilan(b, relue)).toBe('47 fichiers dans le dossier à trier, 5 dans le projet → 5 dans la sortie : 2 photos triées, 1 vidéo, 1 doublon, 1 autre fichier.');
  });

  it('écrit un rapport qui n’annonce « tout est dans la sortie » que si rien ne manque', () => {
    const { plan, listing, etat } = ecrite();
    const infos = { projet: 'Été <2025>', source: 'vrac', sortie: 'sortie', date: new Date(2025, 9, 21) };
    const complet = genererRapport(infos, plan, bilan(plan, listing, etat));
    expect(complet).toContain('Tout est dans le dossier de sortie');
    expect(complet).toContain('Été &lt;2025&gt;');
    expect(complet).toContain('Thumbs.db');
    listing.clear();
    const incomplet = genererRapport(infos, plan, bilan(plan, listing, etat));
    expect(incomplet).not.toContain('Tout est dans le dossier de sortie');
    expect(incomplet).toContain('5 fichiers manquent dans la sortie : ne supprimez pas la source.');
    expect(incomplet).not.toContain('pas dans le projet');
  });

  it('ne donne que les messages qui s’appliquent, accordés au nombre', () => {
    const { plan, listing, etat } = ecrite();
    const infos = { projet: 'p', source: 'vrac', sortie: 'sortie', date: new Date(2025, 9, 21) };
    // Rien ne manque, mais un fichier de la source n'est pas dans le projet : pas de « 0 fichier manque ».
    const horsProjet = genererRapport({ ...infos, horsProjet: ['juin/Piscine.jpg'] }, plan, bilan(plan, listing, etat));
    expect(horsProjet).toContain('1 fichier de la source n’est pas dans le projet (arrivé ou modifié depuis l’inventaire)');
    expect(horsProjet).not.toContain('manque');
    expect(horsProjet).not.toContain('Tout est dans le dossier de sortie');
    // Un fichier qui manque parce qu'il n'est plus dans le dossier à trier : expliqué.
    listing.delete(cleChemin('Photos/Paleo/IMG_1.jpg'));
    const disparu = genererRapport({ ...infos, disparus: ['Paleo/IMG_1.jpg'] }, plan, bilan(plan, listing, etat));
    expect(disparu).toContain('1 fichier manque dans la sortie : ne supprimez pas la source.');
    expect(disparu).toContain('1 fichier n’est plus dans le dossier à trier (supprimé, renommé ou déplacé depuis l’inventaire)');
    expect(disparu).not.toContain('pas dans le projet');
  });

  it('liste les photos dont la seule date est celle du fichier (D30)', () => {
    const plan = planInitial([{ chemin: 'Famille (3).jpg', taille: 10, modifie: Date.UTC(2025, 0, 2), categorie: 'photo' }]).plan;
    expect(bilan(plan, new Map(), etatVide()).datesFichierSeulement.map((f) => f.id)).toEqual(['Famille (3).jpg']);
  });
});
