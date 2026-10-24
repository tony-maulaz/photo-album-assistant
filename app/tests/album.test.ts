import { describe, expect, it } from 'vitest';
import { signatureRecadrage } from '../src/lib/recadrage';
import { conseilCible, configAlbumDefaut, fichiersAlbum, nombrePages, ordreAlbum, paginer, partieNom, planifierAlbum, sansDoubles, sections, textesAlbum, titreDepuisNom, type EtatAlbum } from '../src/lib/album';
import type { FichierPlan } from '../src/lib/plan';
import { avancement, equilibre, minutes, piles, redondances } from '../src/lib/selection';

function photo(id: string, dossier: string, date: string, extra: Partial<FichierPlan> = {}): FichierPlan {
  return { id, nom: id.split('/').pop()!, taille: 1000, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier, statut: 'archive', album: 1, ...extra };
}

describe('ordre de l’album (D8, incident I2)', () => {
  // Kanchanaburi : une sortie sur plusieurs jours, et la rivière le 15 au milieu.
  const photos = [
    photo('Elephants/0107.jpg', 'Elephants_Kanchanaburi_14-17', '2026-07-16T09:47:00'),
    photo('Elephants/0117.jpg', 'Elephants_Kanchanaburi_14-17', '2026-07-16T09:43:00'),
    photo('Elephants/0100.jpg', 'Elephants_Kanchanaburi_14-17', '2026-07-14T16:00:00'),
    photo('Riviere/0109.jpg', 'Riviere_Kwai_15', '2026-07-15T17:02:00'),
    photo('Riviere/0110.jpg', 'Riviere_Kwai_15', '2026-07-15T17:44:00'),
  ];

  it('14 → 15 (rivière) → 16 (09:43 puis 09:47)', () => {
    expect(ordreAlbum(photos).map((p) => p.id)).toEqual(['Elephants/0100.jpg', 'Riviere/0109.jpg', 'Riviere/0110.jpg', 'Elephants/0117.jpg', 'Elephants/0107.jpg']);
  });

  it('groupe les activités d’une même journée en blocs contigus', () => {
    const jour = [
      photo('a1', 'Marche', '2026-07-12T09:00:00'),
      photo('b1', 'Temple', '2026-07-12T10:00:00'),
      photo('a2', 'Marche', '2026-07-12T11:00:00'),
      photo('b2', 'Temple', '2026-07-12T12:00:00'),
    ];
    expect(ordreAlbum(jour).map((p) => p.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(ordreAlbum(jour, 'chrono').map((p) => p.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('une photo sans vraie date se place à la fin de sa sortie, pas à la date du fichier', () => {
    const photos = [
      { id: 'a1', dossier: 'A', date: '2026-07-15T10:00:00', origineDate: 'exif' },
      { id: 'copie', dossier: 'A', date: '2026-10-01T09:00:00', origineDate: 'fichier' },
      { id: 'a2', dossier: 'A', date: '2026-07-15T12:00:00', origineDate: 'exif' },
      { id: 'b1', dossier: 'B', date: '2026-07-16T10:00:00', origineDate: 'exif' },
    ];
    expect(ordreAlbum(photos).map((p) => p.id)).toEqual(['a1', 'a2', 'copie', 'b1']);
    expect(ordreAlbum(photos, 'chrono').map((p) => p.id)).toEqual(['a1', 'a2', 'copie', 'b1']);
  });
});

describe('sections et pages', () => {
  const config = { ...configAlbumDefaut(), photosParPage: 2 };
  const ordre = ordreAlbum([
    photo('e1', 'Elephants', '2026-07-14T10:00:00'),
    photo('r1', 'Riviere', '2026-07-15T10:00:00', { album: 2 }),
    photo('r2', 'Riviere', '2026-07-15T11:00:00'),
    photo('e2', 'Elephants', '2026-07-16T09:43:00'),
    photo('e3', 'Elephants', '2026-07-16T09:47:00'),
    photo('e4', 'Elephants', '2026-07-16T10:00:00'),
  ]);
  const titre = (d: string) => d.replace('_', ' ');

  it('une section par bloc ; une sortie qui revient est une « suite »', () => {
    const s = sections(ordre, titre, config);
    expect(s.map((x) => [x.titre, x.debut, x.fin, x.suite])).toEqual([
      ['Elephants', 0, 0, false],
      ['Riviere', 1, 2, false],
      ['Elephants', 3, 5, true],
    ]);
  });

  it('coupures et rattachements', () => {
    const s = sections(ordre, titre, { ...config, coupures: { e3: 'Bain des éléphants' }, rattachements: ['r1'] });
    expect(s.map((x) => [x.titre, x.debut, x.fin])).toEqual([
      ['Elephants', 0, 2],
      ['Elephants', 3, 3],
      ['Bain des éléphants', 4, 5],
    ]);
  });

  it('pagine : ★★ seule sur sa page, nouvelle page à chaque section', () => {
    const s = sections(ordre, titre, config);
    const pages = paginer(ordre, s, config);
    expect(pages.map((p) => [p.photos, p.grande, p.sections])).toEqual([
      [['e1'], false, [0]],
      [['r1'], true, [1]],
      [['r2'], false, []],
      [['e2', 'e3'], false, [2]],
      [['e4'], false, []],
    ]);
    expect(paginer(ordre, s, { ...config, nouvellePageParSection: false }).length).toBe(4);
  });

  it('nomme les fichiers de l’album dans l’ordre, avec la date et la section', () => {
    const s = sections(ordre, titre, { ...config, titres: { Riviere: 'Rivière Kwaï' } });
    const f = fichiersAlbum(ordre, s, config);
    expect(f.map((x) => x.chemin)).toEqual([
      '0001_20260714_Elephants.jpg',
      '0002_20260715_Riviere_Kwai.jpg',
      '0003_20260715_Riviere_Kwai.jpg',
      '0004_20260716_Elephants.jpg',
      '0005_20260716_Elephants.jpg',
      '0006_20260716_Elephants.jpg',
    ]);
    expect(fichiersAlbum(ordre, s, { ...config, sousDossiers: true })[1].chemin).toBe('02_Riviere_Kwai/0002_20260715_Riviere_Kwai.jpg');
    expect(partieNom('Fête d’été — 2025 !')).toBe('Fete_dete_2025');
  });

  it('écrit les textes de l’album pour ifolor', () => {
    const s = sections(ordre, titre, { ...config, intros: { Riviere: 'Une journée sur la rivière Kwaï.' } });
    const f = fichiersAlbum(ordre, s, config);
    const md = textesAlbum('Thaïlande 2026', s, f, new Map([['r2', 'Le pont sur la rivière']]), { ...config, intros: { Riviere: 'Une journée sur la rivière Kwaï.' } });
    expect(md).toContain('## Riviere\n*Une journée sur la rivière Kwaï.*');
    expect(md).toContain('(section démarrant à `0002_20260715_Riviere.jpg`)');
    expect(md).toContain('- `0003_20260715_Riviere.jpg` : Le pont sur la rivière');
    expect(md).toContain('## Elephants (suite)');
    expect(md).toContain('Couverture : pas encore choisie');
  });

  it('les textes gardent le titre, la couverture et le plan des pages de l’aperçu', () => {
    const s = sections(ordre, titre, config);
    const f = fichiersAlbum(ordre, s, config);
    const md = textesAlbum('Thaïlande 2026', s, f, new Map([['r2', 'Le pont sur la rivière']]), config, paginer(ordre, s, config), '0000_Couverture.jpg');
    expect(md).toContain("Titre de l'album : Thaïlande 2026\nCouverture : `0000_Couverture.jpg`");
    expect(md).toContain('## Riviere\n(section démarrant à `0002_20260715_Riviere.jpg`)\n\n- Page 2 : 0002 ★★ (pleine page)\n- Page 3 : 0003\n\nLégendes :\n- `0003_20260715_Riviere.jpg` : Le pont sur la rivière');
    expect(md).toContain('## Elephants (suite)\n(section démarrant à `0004_20260716_Elephants.jpg`)\n\n- Page 4 : 0004, 0005\n- Page 5 : 0006');
    // Sections sur une même page : chacune n'y montre que ses photos.
    const serre = { ...config, nouvellePageParSection: false };
    const md2 = textesAlbum('T', s, f, new Map(), serre, paginer(ordre, s, serre));
    expect(md2).toContain('## Elephants\n(section démarrant à `0001_20260714_Elephants.jpg`)\n\n- Page 1 : 0001\n');
    expect(md2).toContain('- Page 3 : 0003\n\n## Elephants (suite)\n(section démarrant à `0004_20260716_Elephants.jpg`)\n\n- Page 3 : 0004\n- Page 4 : 0005, 0006');
  });
});

describe('titres de section tirés des noms de dossiers', () => {
  it('sans la date finale, sans soulignés, mots collés séparés', () => {
    expect(titreDepuisNom('SpectacleFeu_Chaweng_24.07.26')).toBe('Spectacle Feu Chaweng');
    expect(titreDepuisNom('SpectacleFeu Chaweng 24.07.26')).toBe('Spectacle Feu Chaweng');
    expect(titreDepuisNom('Kanchanaburi_2026-07-15')).toBe('Kanchanaburi');
    expect(titreDepuisNom('Voyage_Kanchanaburi_2026-07')).toBe('Voyage Kanchanaburi');
    expect(titreDepuisNom('Annecy_27-29.06.25')).toBe('Annecy');
    expect(titreDepuisNom('Belgique_25.07-08.08.25')).toBe('Belgique');
    expect(titreDepuisNom('Ski_Montagne_Martin_7-9.02.25')).toBe('Ski Montagne Martin');
    expect(titreDepuisNom('Sejour_2026-07-15_2026-07-20')).toBe('Sejour');
    expect(titreDepuisNom('Plage à Ko Samui 18.07.26')).toBe('Plage à Ko Samui');
    expect(titreDepuisNom('KoSamui_18.07.2026')).toBe('Ko Samui');
  });

  it('garde une année seule, les sigles, les noms qui ne sont qu’une date', () => {
    expect(titreDepuisNom('Valais_Mars_2025')).toBe('Valais Mars 2025');
    expect(titreDepuisNom('BESTOF_2025')).toBe('BESTOF 2025');
    expect(titreDepuisNom('Anna&Marc')).toBe('Anna&Marc');
    expect(titreDepuisNom('iPhone_Lea')).toBe('iPhone Lea');
    expect(titreDepuisNom('Sortie_Famille_35_12.05.25')).toBe('Sortie Famille 35');
    expect(titreDepuisNom('2026-07-18')).toBe('2026-07-18');
    expect(titreDepuisNom('_sans_date')).toBe('sans date');
  });
});

describe('une même photo retenue dans deux dossiers', () => {
  // « A imprimer » : un « Best of » fait de copies ; la sortie du jour contient les originaux.
  const plage = [
    photo('Koh_Samui/0.jpg', 'Koh_Samui', '2026-07-18T09:00:00', { taille: 5000 }),
    photo('Koh_Samui/1.jpg', 'Koh_Samui', '2026-07-18T10:00:00', { taille: 5001, empreinte: 'e1' }),
    photo('Koh_Samui/2.jpg', 'Koh_Samui', '2026-07-18T11:00:00', { taille: 5002, empreinte: 'e2' }),
    photo('Koh_Samui/3.jpg', 'Koh_Samui', '2026-07-18T12:00:00', { taille: 5003 }),
  ];
  const bestOf = [
    photo('A_imprimer/1.jpg', 'A_imprimer', '2026-07-18T10:00:00', { taille: 5001, empreinte: 'e1' }),
    photo('A_imprimer/3.jpg', 'A_imprimer', '2026-07-18T12:00:00', { taille: 5003 }),
    // Même taille, autre contenu : gardée.
    photo('A_imprimer/autre.jpg', 'A_imprimer', '2026-07-18T11:00:00', { taille: 5002, empreinte: 'e9' }),
  ];

  it('gardée une fois, à sa première place dans l’album (empreinte, ou même date et mêmes dimensions)', () => {
    const r = sansDoubles([...bestOf, ...plage]);
    expect(r.retirees).toEqual([
      { id: 'A_imprimer/1.jpg', garde: 'Koh_Samui/1.jpg' },
      { id: 'A_imprimer/3.jpg', garde: 'Koh_Samui/3.jpg' },
    ]);
    // Les photos gardées restent dans l'ordre reçu.
    expect(r.gardees.map((p) => p.id)).toEqual(['A_imprimer/autre.jpg', 'Koh_Samui/0.jpg', 'Koh_Samui/1.jpg', 'Koh_Samui/2.jpg', 'Koh_Samui/3.jpg']);
    // La sortie commence plus tard que le « Best of » ce jour-là : c'est elle qui perd ses copies.
    const tard = sansDoubles([...bestOf, ...plage.slice(1)]);
    expect(tard.retirees.map((x) => x.id)).toEqual(['Koh_Samui/1.jpg', 'Koh_Samui/3.jpg']);
    // Sans vraie date ni empreinte, deux fichiers de même taille ne sont pas confondus.
    const sansDate = [photo('a', 'A', '2026-07-18T10:00:00', { taille: 9, origineDate: 'fichier' }), photo('b', 'B', '2026-07-18T10:00:00', { taille: 9, origineDate: 'fichier' })];
    expect(sansDoubles(sansDate).retirees).toEqual([]);
  });

  it('l’album et la jauge de la cible ne la comptent qu’une fois', () => {
    const config = { ...configAlbumDefaut(), photosParPage: 2 };
    expect(nombrePages([...plage, ...bestOf], config)).toBe(nombrePages([...plage, bestOf[2]], config));
  });
});

describe('cible de pages', () => {
  // Trois sorties de 3 photos : 6 pages à 2 par page (chaque section sur une nouvelle page), 3 pages à 4 par page.
  const photos = ['A', 'B', 'C'].flatMap((d, j) => [0, 1, 2].map((i) => photo(`${d}${i}`, d, `2026-07-1${j}T1${i}:00:00`)));

  it('la jauge de « Sélection » compte les pages comme l’aperçu de « Album »', () => {
    const config = { ...configAlbumDefaut(), photosParPage: 4 };
    const ordre = ordreAlbum(photos);
    const pages = paginer(ordre, sections(ordre, (d) => d, config), config).length;
    expect(pages).toBe(3);
    expect(nombrePages(photos, config)).toBe(pages);
    expect(avancement(photos, { mode: 'pages', nombre: 24, photosParPage: 4 }).pages).toBe(3);
    expect(avancement(photos, { mode: 'pages', nombre: 24, photosParPage: 4, nouvellePageParSection: false }).pages).toBe(3);
    expect(avancement(photos, { mode: 'pages', nombre: 24, photosParPage: 2 }).pages).toBe(6);
    expect(avancement(photos, { mode: 'pages', nombre: 24, photosParPage: 2, nouvellePageParSection: false }).pages).toBe(5);
  });

  it('dit combien de pages manquent, ou sont de trop, et comment y remédier', () => {
    const config = { ...configAlbumDefaut(), photosParPage: 4 };
    expect(configAlbumDefaut().cible).toEqual({ mode: 'pages', nombre: 24 });
    // 3 pages pour 24 : il en manque 21, soit environ 84 photos ; même à 1 photo par page (9 pages), c'est trop peu.
    expect(conseilCible(photos, config)).toEqual({ ecart: -21, photos: 84 });
    expect(conseilCible(photos, { ...config, cible: { mode: 'pages', nombre: 6 } })).toEqual({ ecart: -3, photos: 12, photosParPage: 2 });
    expect(conseilCible(photos, { ...config, cible: { mode: 'pages', nombre: 3 } })).toBeNull();
    expect(conseilCible(photos, { ...config, photosParPage: 1, cible: { mode: 'pages', nombre: 4 } })).toEqual({ ecart: 5, photos: 5, photosParPage: 3 });
    // Cible en photos : ramenée en pages, sans changer de mise en page.
    expect(conseilCible(photos, { ...config, cible: { mode: 'photos', nombre: 40 } })).toEqual({ ecart: -7, photos: 28 });
  });
});

describe('synchronisation de Album/', () => {
  const voulus = (ids: string[], rotation: Record<string, number> = {}) => ids.map((id, i) => ({ id, chemin: `${String(i + 1).padStart(4, '0')}_x_${id}.jpg`, rotation: rotation[id] ?? 0, taille: 10 }));
  const appliquer = (actions: ReturnType<typeof planifierAlbum>, presents: Map<string, number>, etat: EtatAlbum) => {
    for (const a of actions) {
      if (a.type === 'retirer') {
        presents.delete(a.chemin);
        delete etat[a.chemin];
      }
    }
    for (const a of actions) {
      if (a.type === 'renommer') {
        const e = etat[a.depuis];
        presents.delete(a.depuis);
        delete etat[a.depuis];
        presents.set(a.chemin, 10);
        etat[a.chemin] = e;
      }
      if (a.type === 'copier') {
        presents.set(a.chemin, 10);
        etat[a.chemin] = { id: a.id, taille: 10, rotation: a.rotation, ...(a.recadrage ? { recadrage: signatureRecadrage(a.recadrage) } : {}) };
      }
    }
  };
  const types = (a: ReturnType<typeof planifierAlbum>) => a.map((x) => x.type).sort().join(',');

  it('une photo recadrée autrement est recopiée ; le même recadrage garde la copie (D62)', () => {
    const presents = new Map<string, number>();
    const etat: EtatAlbum = {};
    const carre = { x: 0.125, y: 0, l: 0.75, h: 1, angle: 0 };
    const avec = (r?: typeof carre) => voulus(['a']).map((v) => (r ? { ...v, recadrage: r } : v));
    appliquer(planifierAlbum(avec(), presents, etat), presents, etat);
    const recadree = planifierAlbum(avec(carre), presents, etat);
    expect(recadree.map((x) => x.type).sort()).toEqual(['copier', 'retirer']);
    expect(recadree.find((x) => x.type === 'copier')).toMatchObject({ recadrage: carre });
    appliquer(recadree, presents, etat);
    expect(types(planifierAlbum(avec(carre), presents, etat))).toBe('garder');
    expect(types(planifierAlbum(avec({ ...carre, angle: 2 }), presents, etat))).toBe('copier,retirer');
  });

  it('copie, puis garde, renomme si l’ordre change, retire les anciennes copies (I1)', () => {
    const presents = new Map<string, number>();
    const etat: EtatAlbum = {};
    const premiere = planifierAlbum(voulus(['a', 'b', 'c']), presents, etat);
    expect(types(premiere)).toBe('copier,copier,copier');
    appliquer(premiere, presents, etat);
    expect(types(planifierAlbum(voulus(['a', 'b', 'c']), presents, etat))).toBe('garder,garder,garder');
    // b retirée de l'album : c avance d'un rang.
    const apres = planifierAlbum(voulus(['a', 'c']), presents, etat);
    expect(apres.find((x) => x.type === 'renommer')).toMatchObject({ depuis: '0003_x_c.jpg', chemin: '0002_x_c.jpg' });
    expect(apres.find((x) => x.type === 'retirer')).toMatchObject({ chemin: '0002_x_b.jpg' });
    appliquer(apres, presents, etat);
    expect([...presents.keys()].sort()).toEqual(['0001_x_a.jpg', '0002_x_c.jpg']);
  });

  it('recopie une photo tournée, et ne touche jamais un fichier de l’utilisateur', () => {
    const presents = new Map<string, number>([['0002_x_b.jpg', 99]]);
    const etat: EtatAlbum = {};
    const a = planifierAlbum(voulus(['a', 'b']), presents, etat);
    expect(a.find((x) => x.chemin === '0002_x_b.jpg')!.type).toBe('conflit');
    presents.clear();
    appliquer(planifierAlbum(voulus(['a']), presents, etat), presents, etat);
    expect(types(planifierAlbum(voulus(['a'], { a: 90 }), presents, etat))).toBe('copier,retirer');
  });

  it('suit la nouvelle version de l’original (date de modification) ; un état sans date garde la copie', () => {
    const presents = new Map([['0001_x_a.jpg', 10]]);
    const avec = (modifie: number) => voulus(['a']).map((v) => ({ ...v, modifie }));
    const etat: EtatAlbum = { '0001_x_a.jpg': { id: 'a', taille: 10, rotation: 0, modifie: 1 } };
    expect(types(planifierAlbum(avec(1), presents, etat))).toBe('garder');
    expect(types(planifierAlbum(avec(2), presents, etat))).toBe('copier,retirer');
    delete etat['0001_x_a.jpg'].modifie;
    expect(types(planifierAlbum(avec(2), presents, etat))).toBe('garder');
  });
});

describe('outils de sélection', () => {
  const h = (n: number) => n.toString(16).padStart(16, '0');
  const base = [
    photo('p1', 'Plage', '2026-07-18T11:00:00', { phash: h(0) } as never),
    photo('p2', 'Plage', '2026-07-18T11:10:00', { phash: h(3) } as never),
    photo('p3', 'Plage', '2026-07-18T13:00:00', { phash: h(0) } as never),
    photo('p4', 'Temple', '2026-07-18T11:05:00', { phash: h(0) } as never),
  ].map((p) => ({ ...p, phash: (p as unknown as { phash: string }).phash }));

  it('minutes', () => {
    expect(minutes('2026-07-18T11:10:00')! - minutes('2026-07-18T11:00:00')!).toBe(10);
    expect(minutes(undefined)).toBeNull();
  });

  it('redondance : retenues semblables d’une même sortie, à moins de 45 min', () => {
    expect(redondances(base)).toEqual([['p1', 'p2']]);
    expect(redondances(base.map((p) => (p.id === 'p2' ? { ...p, album: 0 as const } : p)))).toEqual([]);
  });

  it('piles : ressemblance locale et scènes de l’étape 8', () => {
    expect(piles(base)).toEqual([['p1', 'p2']]);
    expect(piles(base, [['p1', 'p3']])).toEqual([['p1', 'p2', 'p3']]);
  });

  it('équilibre et cible (une ★★ vaut une page)', () => {
    const photos = [...base, photo('t2', 'Temple', '2026-07-19T10:00:00', { album: 2 }), photo('t3', 'Temple', '2026-07-19T11:00:00', { album: undefined }), photo('t4', 'Temple', '2026-07-19T12:00:00', { album: 0 })];
    const e = equilibre(photos);
    expect(e.jours).toEqual([
      { jour: '2026-07-18', disponibles: 4, retenues: 4 },
      { jour: '2026-07-19', disponibles: 3, retenues: 1 },
    ]);
    // Pages de l'aperçu : Plage (3 photos), Temple (1), puis la ★★ du Temple le lendemain, chaque section sur une nouvelle page.
    const a = avancement(photos, { mode: 'pages', nombre: 10, photosParPage: 4 });
    expect([a.retenues, a.grandes, a.aDecider, a.pages, a.pourcent]).toEqual([5, 1, 1, 3, 30]);
    expect(avancement(photos, { mode: 'photos', nombre: 16, photosParPage: 4 }).valeur).toBe(8);
  });
});
