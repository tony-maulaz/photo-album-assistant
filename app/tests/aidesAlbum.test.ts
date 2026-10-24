import { describe, expect, it } from 'vitest';
import consigneTextes from '../src/ia/consignes/textes_titres_commentaires.txt?raw';
import { configAlbumDefaut, ordreAlbum, paginer, sections } from '../src/lib/album';
import {
  demandeCouverture,
  demandeCouvertureTri,
  demandesControleAlbum,
  demandeTextes,
  echantillonTextes,
  lireControleAlbum,
  lireCouverture,
  lireCouvertureTri,
  lireTextes,
  nombreLegendes,
  pagesMontrees,
} from '../src/lib/aidesAlbum';
import type { PhotoIA } from '../src/lib/aidesSelection';
import { extraireJson } from '../src/lib/doublons';

const photos = (n: number, grandes: number[] = []): PhotoIA[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    identite: `id${i + 1}`,
    date: `2026-07-15T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00`,
    album: grandes.includes(i + 1) ? 2 : 1,
  }));

describe('IA12 et IA13 : textes d’une section (consigne du script 03)', () => {
  it('échantillon : grandes photos d’abord, puis réparties, rendues dans l’ordre', () => {
    const e = echantillonTextes(photos(30, [25, 3]));
    expect(e).toHaveLength(12);
    expect(e.map((p) => p.id)).toContain('p3');
    expect(e.map((p) => p.id)).toContain('p25');
    expect(e.map((p) => p.date)).toEqual([...e.map((p) => p.date)].sort());
    // Avec des notes (IA9), les mieux notées, comme le script.
    const notes = new Map(photos(30).map((p, i) => [p.id, i]));
    expect(echantillonTextes(photos(30), 3, notes).map((p) => p.id)).toEqual(['p28', 'p29', 'p30']);
  });

  it('nombre de légendes : 15 % des photos de la section, au moins une, au plus les photos envoyées', () => {
    expect(nombreLegendes(40, 12)).toBe(6);
    expect(nombreLegendes(3, 3)).toBe(1);
    expect(nombreLegendes(200, 12)).toBe(12);
    expect(nombreLegendes(40, 12, 0.5)).toBe(12);
  });

  it('consigne du script, puis nom du dossier, nombre de commentaires, ton, recherche web', () => {
    const d = demandeTextes({ nom: 'Elephants_Kanchanaburi_14-17.07.26', photos: photos(40) }, { legendes: true, ton: 'humoristique', rechercheWeb: true, contexte: 'Voyage en famille' })!;
    expect(d.consigne.startsWith(`${consigneTextes}\n\nNom du dossier de cette sortie : Elephants_Kanchanaburi_14-17.07.26.\nPropose environ 6 commentaire(s).`)).toBe(true);
    expect(d.consigne).toContain('humoristique');
    expect(d.consigne).toContain('"references"');
    expect(d).toMatchObject({ fonction: 'IA13', niveau: 'avance', rechercheWeb: 3 });
    expect(Object.keys((d.schema as { properties: object }).properties)).toEqual(['titre', 'sous_titre', 'commentaires', 'references']);
    const titres = demandeTextes({ nom: 'X', photos: photos(5) }, { legendes: false })!;
    expect(titres.fonction).toBe('IA12');
    expect(titres.consigne).toContain('laisse la liste des commentaires vide');
    expect(titres.consigne).not.toContain('Ton demandé');
    expect(titres.rechercheWeb).toBe(0);
    expect(titres.cle).not.toBe(demandeTextes({ nom: 'X', photos: photos(5) }, { legendes: false, ton: 'sobre' })!.cle);
    expect(demandeTextes({ nom: 'vide', photos: [] }, { legendes: true })).toBeNull();
  });

  it('lecture : sous-titre vide échappé, numéros hors plage, sources non vérifiables écartées', () => {
    const ids = ['a', 'b', 'c'];
    const r = lireTextes(
      {
        titre: 'Les éléphants de Kanchanaburi',
        sous_titre: '\\"\\"',
        commentaires: [{ photo: 2, texte: 'Douche géante !' }, { photo: 7, texte: 'hors plage' }, { photo: '2', texte: 'doublon' }, { photo: 3 }],
        references: [{ texte: 'Le pont de la rivière Kwaï date de 1943.', source: 'https://fr.wikipedia.org/wiki/Pont_de_la_rivière_Kwaï' }, { texte: 'Sans source', source: 'souvenir' }],
      },
      ids,
    )!;
    expect(r.titre).toBe('Les éléphants de Kanchanaburi');
    expect(r.introduction).toBe('');
    expect([...r.legendes]).toEqual([['b', 'Douche géante !']]);
    expect(r.references).toHaveLength(1);
    expect(lireTextes(extraireJson('{"titre": \u201cPlage\u201d, "sous_titre": "Soleil et sable", "commentaires": [],}'), ids)).toMatchObject({ titre: 'Plage', introduction: 'Soleil et sable' });
    expect(lireTextes({ sous_titre: 'rien' }, ids)).toBeNull();
    expect(lireTextes([], ids)).toBeNull();
  });
});

describe('IA14 : couverture en deux temps (I5)', () => {
  it('premier tri sur planches seulement au-delà de 6 grandes photos', () => {
    expect(demandeCouvertureTri(photos(5), { album: 'Thaïlande 2026' })).toBeNull();
    const tri = demandeCouvertureTri(photos(20), { album: 'Thaïlande 2026' })!;
    expect(tri.images.map((i) => i.libelle)).toEqual(['Planche 1 :', 'Planche 2 :']);
    expect(tri.consigne).toContain('les 20 grandes photos de l\'album « Thaïlande 2026 »');
    expect(lireCouvertureTri({ candidates: [3, '3', 25, { photo: 7 }, 1, 2, 4, 5, 6] }, tri.ids)).toEqual(['p3', 'p7', 'p1', 'p2', 'p4', 'p5']);
  });

  it('finalistes comparées en grand : 5 classées, sans doublon', () => {
    const d = demandeCouverture(photos(6), { album: 'Thaïlande 2026' })!;
    expect(d.images.every((i) => i.type === 'photo')).toBe(true);
    expect(d.consigne).toContain('Classe les 5 meilleures');
    expect(demandeCouverture(photos(3), { album: 'A' })!.consigne).toContain('Classe les 3 meilleures');
    expect(lireCouverture({ couverture: [{ photo: 2, raison: 'Lumière superbe.' }, { photo: 2, raison: 'encore' }, { photo: 9 }, { photo: '1', raison: 'Toute la famille.' }] }, d.ids)).toEqual([
      { id: 'p2', raison: 'Lumière superbe.' },
      { id: 'p1', raison: 'Toute la famille.' },
    ]);
  });
});

describe('IA15 : contrôle de l’album', () => {
  const fichiers = Array.from({ length: 30 }, (_, i) => ({
    id: `f${i + 1}`,
    nom: `f${i + 1}.jpg`,
    taille: 1,
    modifie: 0,
    categorie: 'photo' as const,
    date: `2026-07-${i < 10 ? '14' : i < 20 ? '15' : '16'}T10:${String(i).padStart(2, '0')}:00`,
    origineDate: 'exif' as const,
    dossier: i < 10 ? 'Elephants' : i < 20 ? 'Riviere' : 'Plage',
    statut: 'archive' as const,
    album: (i === 12 ? 2 : 1) as 1 | 2,
  }));
  const config = configAlbumDefaut();
  const ordre = ordreAlbum(fichiers);
  const secs = sections(ordre, (d) => d, config);
  const pages = paginer(ordre, secs, config);
  const ordreIA: PhotoIA[] = ordre.map((f) => ({ id: f.id, identite: f.id, date: f.date, album: f.album }));

  it('tout l’album en un appel, page de chaque vignette, plan des sections', () => {
    const d = demandesControleAlbum(ordreIA, pages, secs, { album: 'Thaïlande' });
    expect(d).toHaveLength(1);
    expect(d[0].ids).toHaveLength(30);
    const premiere = d[0].images[0];
    expect(premiere.type === 'planche' && premiere.etiquettes?.[1]).toBe('p1');
    expect(d[0].consigne).toContain('1. Elephants : pages 1 à 3, 10 photos, le 14.07');
    expect(d[0].consigne).toContain('2. Riviere : pages 4 à 7, 10 photos, le 15.07');
    expect(d[0].consigne).toContain('numérotées de 1 à 30');
    expect([...pagesMontrees(d[0])]).toEqual(Array.from({ length: pages.length }, (_, i) => i + 1));
  });

  it('un album trop grand est découpé entre deux sections', () => {
    const d = demandesControleAlbum(ordreIA, pages, secs, { album: 'Thaïlande' }, { parPlanche: 12, cellule: 220, colonnes: 6, maxPlanches: 1 });
    expect(d.map((x) => x.ids.length)).toEqual([10, 10, 10]);
    expect(d[1].consigne).toContain('montre les sections 2 à 2');
    expect(d[1].consigne).toContain('numérotées de 1 à 10');
  });

  it('remarques validées : pages montrées et numéros valides seulement', () => {
    const d = demandesControleAlbum(ordreIA, pages, secs, { album: 'Thaïlande' }, { parPlanche: 12, cellule: 220, colonnes: 6, maxPlanches: 1 })[0];
    const r = lireControleAlbum(
      {
        remarques: [
          { type: 'Déséquilibre', pages: [1, 2, 40], photos: [1, '2', 99], texte: 'La section des éléphants est courte.' },
          { type: 'rythme', pages: '3', photos: [], texte: 'Trois pages de portraits.' },
          { type: 'redondance', pages: [1] },
        ],
      },
      d,
    );
    expect(r).toEqual([
      { type: 'desequilibre', pages: [1, 2], photos: [d.ids[0], d.ids[1]], texte: 'La section des éléphants est courte.' },
      { type: 'rythme', pages: [3], photos: [], texte: 'Trois pages de portraits.' },
    ]);
  });
});
