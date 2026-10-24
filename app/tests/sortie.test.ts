import { describe, expect, it } from 'vitest';
import { creerDossier, deplacerFichiers, mettreDeCote, renommerDossier, type Plan } from '../src/lib/plan';
import { genererRapport, phraseBilan } from '../src/lib/rapport';
import { bilan, cheminSortie, cleChemin, definirLangueSortie, etatVide, octetsACopier, planifierSynchro, type ActionSynchro, type EtatSortie, type ListingSortie } from '../src/lib/sortie';
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

/** Simule l'exécution des actions : la sortie et l'état après synchronisation. */
function executer(plan: Plan, actions: ActionSynchro[], listing: ListingSortie, etat: EtatSortie) {
  for (const a of actions) {
    const taille = plan.fichiers.get(a.id)!.taille;
    if (a.type === 'deplacer') listing.delete(cleChemin(a.depuis));
    if (a.type !== 'conflit') {
      listing.set(cleChemin(a.cible), { chemin: a.cible, taille });
      etat.fichiers[a.id] = { chemin: a.cible, taille };
    }
  }
}

const compter = (actions: ActionSynchro[]) =>
  actions.reduce<Record<string, number>>((c, a) => ((c[a.type] = (c[a.type] ?? 0) + 1), c), {});

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
    const plan = exemple();
    const listing: ListingSortie = new Map();
    const etat = etatVide();
    executer(plan, planifierSynchro(plan, listing, etat), listing, etat);
    const { id } = creerDossier(plan, 'Festival');
    deplacerFichiers(plan, ['Paleo/IMG_1.jpg'], id);
    mettreDeCote(plan, ['Paleo/IMG_2.jpg']);
    renommerDossier(plan, 's:Paleo', 'Paléo 2025');
    const actions = planifierSynchro(plan, listing, etat);
    expect(compter(actions)).toEqual({ deplacer: 3, garder: 2 });
    expect(actions.find((a) => a.id === 'Paleo/clip.mp4')).toMatchObject({ type: 'deplacer', depuis: 'Photos/Paleo/clip.mp4', cible: 'Photos/Paléo 2025/clip.mp4' });
    expect(actions.find((a) => a.id === 'Paleo/IMG_2.jpg')).toMatchObject({ cible: '_mis_de_cote/autres/Paleo/IMG_2.jpg' });
    executer(plan, actions, listing, etat);
    expect(bilan(plan, listing).manquants).toEqual([]);
    expect(compter(planifierSynchro(plan, listing, etat))).toEqual({ garder: 5 });
  });

  it('ne touche jamais un fichier étranger qui occupe la place', () => {
    const plan = exemple();
    const listing: ListingSortie = new Map([[cleChemin('Photos/Paleo/IMG_1.jpg'), { chemin: 'Photos/Paleo/IMG_1.jpg', taille: 999 }]]);
    const actions = planifierSynchro(plan, listing, etatVide());
    expect(actions.find((a) => a.id === 'Paleo/IMG_1.jpg')!.type).toBe('conflit');
  });

  it('compare les chemins sans tenir compte de la casse ni des accents décomposés', () => {
    const plan = exemple();
    renommerDossier(plan, 's:Paleo', 'Paléo');
    const nfd = 'photos/paléo/img_1.jpg';
    const listing: ListingSortie = new Map([[cleChemin(nfd), { chemin: nfd, taille: 100 }]]);
    expect(planifierSynchro(plan, listing, etatVide()).find((a) => a.id === 'Paleo/IMG_1.jpg')!.type).toBe('garder');
  });
});

describe('bilan et rapport', () => {
  it('compte chaque fichier et liste les manquants et les fichiers en trop (A2)', () => {
    const plan = exemple();
    const listing: ListingSortie = new Map();
    const etat = etatVide();
    executer(plan, planifierSynchro(plan, listing, etat), listing, etat);
    listing.delete(cleChemin('Photos/Paleo/clip.mp4'));
    listing.set(cleChemin('Photos/ajout.jpg'), { chemin: 'Photos/ajout.jpg', taille: 1 });
    const b = bilan(plan, listing);
    expect([b.total, b.presents, b.manquants.map((m) => m.id), b.enTrop]).toEqual([5, 4, ['Paleo/clip.mp4'], ['Photos/ajout.jpg']]);
    expect(b.categories).toEqual({ photos: 2, videos: 1, autres: 1, misDeCote: { doublons: 1 } });
    expect(phraseBilan(b)).toBe('5 fichiers dans la source → 4 dans la sortie : 2 photos triées, 1 vidéo, 1 doublon, 1 autre fichier.');
  });

  it('écrit un rapport qui n’annonce « tout est dans la sortie » que si rien ne manque', () => {
    const plan = exemple();
    const listing: ListingSortie = new Map();
    const etat = etatVide();
    executer(plan, planifierSynchro(plan, listing, etat), listing, etat);
    const infos = { projet: 'Été <2025>', source: 'vrac', sortie: 'sortie', date: new Date(2025, 9, 21) };
    const complet = genererRapport(infos, plan, bilan(plan, listing));
    expect(complet).toContain('Tout est dans le dossier de sortie');
    expect(complet).toContain('Été &lt;2025&gt;');
    expect(complet).toContain('Thumbs.db');
    listing.clear();
    const incomplet = genererRapport(infos, plan, bilan(plan, listing));
    expect(incomplet).not.toContain('Tout est dans le dossier de sortie');
    expect(incomplet).toContain('ne supprimez pas la source');
  });

  it('liste les photos dont la seule date est celle du fichier (D30)', () => {
    const plan = planInitial([{ chemin: 'Famille (3).jpg', taille: 10, modifie: Date.UTC(2025, 0, 2), categorie: 'photo' }]).plan;
    expect(bilan(plan, new Map()).datesFichierSeulement.map((f) => f.id)).toEqual(['Famille (3).jpg']);
  });
});
