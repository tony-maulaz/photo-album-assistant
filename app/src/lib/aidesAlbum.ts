// Aides IA de l'album (étape « Album », SPEC § 6.10) : titres et introductions de
// section (IA12) et légendes (IA13), d'après la consigne « textes » du
// script 03 ; suggestions de couverture (IA14) ; contrôle de l'album (IA15).
// Tous les textes restent modifiables, et l'IA ne décide de rien (P5).

import consigneControle from '../ia/consignes/album_controle.txt?raw';
import consigneControlePartie from '../ia/consignes/album_controle_partie.txt?raw';
import consigneCouverture from '../ia/consignes/album_couverture.txt?raw';
import consigneCouvertureTri from '../ia/consignes/album_couverture_tri.txt?raw';
import consigneRechercheWeb from '../ia/consignes/album_recherche_web.txt?raw';
import consigneSansCommentaires from '../ia/consignes/album_sans_commentaires.txt?raw';
import tonEnfants from '../ia/consignes/album_ton_enfants.txt?raw';
import tonHumoristique from '../ia/consignes/album_ton_humoristique.txt?raw';
import tonSobre from '../ia/consignes/album_ton_sobre.txt?raw';
import consigneTextes from '../ia/consignes/textes_titres_commentaires.txt?raw';
import type { Page, Section } from './album';
import { aTraduire } from './langue';
import {
  cleDemande,
  entier,
  estObjet,
  ligneContexte,
  liste,
  numeros,
  parPhoto,
  photosNumerotees,
  planches,
  remplir,
  repartis,
  simplifier,
  SYSTEME_CRITERES,
  texte,
  type DemandeIA,
  type PhotoIA,
} from './aidesSelection';

// ---------------------------------------------------------------------------
// IA12 et IA13 — titres, introductions et légendes d'une section
// ---------------------------------------------------------------------------

export type Ton = 'sobre' | 'chaleureux' | 'humoristique' | 'enfants';

/** Libellés affichés (à passer à `t` là où ils sont montrés). */
export const LIBELLES_TONS: Record<Ton, string> = {
  sobre: aTraduire('sobre'),
  chaleureux: aTraduire('chaleureux'),
  humoristique: aTraduire('humoristique'),
  enfants: aTraduire('pour les enfants'),
};

/** Le ton chaleureux est celui de la consigne du script 03 : rien à ajouter. */
const CONSIGNES_TONS: Record<Ton, string> = { sobre: tonSobre, chaleureux: '', humoristique: tonHumoristique, enfants: tonEnfants };

/** Réglages du script 03 : 12 photos par sortie (`--photos-textes`), 15 % de légendes (`--part-commentaires`), 1024 px. */
export const PARAMETRES_TEXTES = { photosParSection: 12, part: 0.15, cote: 1024, recherches: 3 };

export interface OptionsTextes {
  /** Légendes demandées (IA13) ; sinon titre et introduction seulement (IA12). */
  legendes: boolean;
  /** Part des photos de la section qui reçoit une légende (défaut 15 %). */
  part?: number;
  ton?: Ton;
  /** Recherche web pour enrichir les textes (IA12). */
  rechercheWeb?: boolean;
  contexte?: string;
  /** Bloc « Événements du calendrier familial… » déjà mis en forme (comme `bloc_calendrier` du script 03). */
  calendrier?: string;
  /** Notes d'appréciation (IA9), pour envoyer les meilleures photos comme le script 03. */
  notes?: Map<string, number>;
}

/**
 * Photos envoyées pour les textes d'une section : les mieux notées (IA9) si
 * l'on a des notes, comme le script 03 ; sinon les grandes photos d'abord,
 * puis des photos réparties dans le temps. Rendues dans l'ordre chronologique.
 */
export function echantillonTextes(photos: PhotoIA[], n = PARAMETRES_TEXTES.photosParSection, notes?: Map<string, number>): PhotoIA[] {
  let choisies: PhotoIA[];
  if (notes && photos.some((p) => notes.has(p.id))) {
    choisies = [...photos].sort((a, b) => (notes.get(b.id) ?? 0) - (notes.get(a.id) ?? 0)).slice(0, n);
  } else {
    const grandes = photos.filter((p) => p.album === 2).slice(0, n);
    const autres = photos.filter((p) => p.album !== 2);
    choisies = [...grandes, ...repartis(autres, n - grandes.length)];
  }
  return choisies.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

/** Nombre de légendes demandées : `max(1, round(photos × part))`, au plus les photos envoyées (script 03). */
export function nombreLegendes(photosSection: number, envoyees: number, part = PARAMETRES_TEXTES.part): number {
  return Math.min(Math.max(1, Math.round(photosSection * part)), envoyees);
}

function schemaTextes(references: boolean): Record<string, unknown> {
  const proprietes: Record<string, unknown> = {
    titre: { type: 'string' },
    sous_titre: { type: 'string' },
    commentaires: {
      type: 'array',
      items: { type: 'object', properties: { photo: { type: 'integer' }, texte: { type: 'string' } }, required: ['photo', 'texte'], additionalProperties: false },
    },
  };
  if (references) {
    proprietes.references = {
      type: 'array',
      items: { type: 'object', properties: { texte: { type: 'string' }, source: { type: 'string' } }, required: ['texte', 'source'], additionalProperties: false },
    };
  }
  return { type: 'object', properties: proprietes, required: Object.keys(proprietes), additionalProperties: false };
}

/**
 * Demande de textes pour une section : la consigne du script 03 mot pour
 * mot, suivie (comme dans le script) du nom du dossier et du nombre de
 * commentaires, puis du ton, de la recherche web, du calendrier et du contexte.
 */
export function demandeTextes(section: { nom: string; photos: PhotoIA[] }, o: OptionsTextes): DemandeIA | null {
  const ech = echantillonTextes(section.photos, PARAMETRES_TEXTES.photosParSection, o.notes);
  if (!ech.length) return null;
  const ton = CONSIGNES_TONS[o.ton ?? 'chaleureux'];
  const consigne =
    consigneTextes +
    `\n\nNom du dossier de cette sortie : ${section.nom}.` +
    (o.legendes ? `\nPropose environ ${nombreLegendes(section.photos.length, ech.length, o.part)} commentaire(s).` : `\n${consigneSansCommentaires}`) +
    (ton ? `\n${ton}` : '') +
    (o.rechercheWeb ? `\n\n${consigneRechercheWeb}` : '') +
    (o.calendrier ?? '') +
    ligneContexte(o.contexte);
  const d = { systeme: SYSTEME_CRITERES, consigne, images: photosNumerotees(ech, PARAMETRES_TEXTES.cote), rechercheWeb: o.rechercheWeb ? PARAMETRES_TEXTES.recherches : 0 };
  return {
    fonction: o.legendes ? 'IA13' : 'IA12',
    niveau: 'avance',
    ...d,
    schema: schemaTextes(!!o.rechercheWeb),
    effort: 'medium',
    maxTokens: 8000,
    ids: ech.map((p) => p.id),
    cle: cleDemande(o.legendes ? 'IA13' : 'IA12', ech, d),
    sortieEstimee: 1500 + (o.legendes ? 40 * ech.length : 0),
  };
}

export interface TextesSection {
  titre: string;
  /** Introduction de la section (le « sous-titre » du script 03), éventuellement vide. */
  introduction: string;
  /** Légendes proposées, par photo. */
  legendes: Map<string, string>;
  /** Informations trouvées sur internet, avec leur source. */
  references: { texte: string; source: string }[];
}

/** Textes lus ; `null` si la réponse n'apporte ni titre ni légende. */
export function lireTextes(reponse: unknown, ids: string[]): TextesSection | null {
  const o = Array.isArray(reponse) ? reponse.find(estObjet) : reponse;
  if (!estObjet(o)) return null;
  const titre = texte(o.titre, 80);
  // « "" » (la consigne du script montre un sous-titre vide échappé) ne compte pas.
  const intro = texte(o.sous_titre ?? o.introduction, 300);
  const legendes = new Map<string, string>();
  for (const [id, c] of parPhoto(liste(o.commentaires, 'commentaires'), ids)) {
    const t = texte(c.texte ?? c.commentaire, 200);
    if (t) legendes.set(id, t);
  }
  const references = liste(o.references)
    .filter(estObjet)
    .map((r) => ({ texte: texte(r.texte, 300), source: texte(r.source, 300) }))
    .filter((r) => r.texte && /^https?:\/\//.test(r.source));
  if (!titre && !legendes.size) return null;
  return { titre, introduction: /^[\s"\\]*$/.test(intro) ? '' : intro, legendes, references };
}

// ---------------------------------------------------------------------------
// IA14 — suggestions de couverture
// ---------------------------------------------------------------------------

/**
 * Deux temps (I5) : parmi beaucoup de grandes photos, un premier tri sur
 * planches retient 6 finalistes ; elles sont ensuite comparées en grand,
 * et 5 sont classées avec leur raison.
 */
export const PARAMETRES_COUVERTURE = { finalistes: 6, nombre: 5, parPlanche: 16, cellule: 300, colonnes: 4, maxPlanches: 3, cote: 1024 };

const guillemets = (t: string) => `« ${t} »`;

/** Premier tri sur planches ; `null` s'il y a déjà 6 grandes photos au plus. */
export function demandeCouvertureTri(grandes: PhotoIA[], o: { album: string; contexte?: string }, p = PARAMETRES_COUVERTURE): DemandeIA | null {
  if (grandes.length <= p.finalistes) return null;
  const choix = repartis(grandes, p.parPlanche * p.maxPlanches);
  const d = {
    systeme: SYSTEME_CRITERES,
    consigne: remplir(consigneCouvertureTri, { n: choix.length, k: p.finalistes, album: guillemets(o.album) }) + ligneContexte(o.contexte),
    images: planches(choix, 1, { libelle: 'Planche', parPlanche: p.parPlanche, cellule: p.cellule, colonnes: p.colonnes }),
    rechercheWeb: 0,
  };
  return {
    fonction: 'IA14',
    niveau: 'avance',
    ...d,
    schema: {
      type: 'object',
      properties: { candidates: { type: 'array', items: { type: 'integer' } } },
      required: ['candidates'],
      additionalProperties: false,
    },
    effort: 'medium',
    maxTokens: 6000,
    ids: choix.map((x) => x.id),
    cle: cleDemande('IA14', choix, d),
    sortieEstimee: 800,
  };
}

export function lireCouvertureTri(reponse: unknown, ids: string[], garder = PARAMETRES_COUVERTURE.finalistes): string[] {
  const brut = liste(reponse, 'candidates', 'photos').map((v) => (estObjet(v) ? v.photo : v));
  return numeros(brut, ids.length)
    .slice(0, garder)
    .map((n) => ids[n - 1]);
}

/** Comparaison en grand des finalistes (6 au plus) : 5 classées avec leur raison. */
export function demandeCouverture(finalistes: PhotoIA[], o: { album: string; contexte?: string; nombre?: number }, p = PARAMETRES_COUVERTURE): DemandeIA | null {
  const lot = finalistes.slice(0, p.finalistes);
  if (!lot.length) return null;
  const k = Math.min(o.nombre ?? p.nombre, lot.length);
  const d = {
    systeme: SYSTEME_CRITERES,
    consigne: remplir(consigneCouverture, { n: lot.length, k, album: guillemets(o.album) }) + ligneContexte(o.contexte),
    images: photosNumerotees(lot, p.cote),
    rechercheWeb: 0,
  };
  return {
    fonction: 'IA14',
    niveau: 'avance',
    ...d,
    schema: {
      type: 'object',
      properties: {
        couverture: {
          type: 'array',
          items: { type: 'object', properties: { photo: { type: 'integer' }, raison: { type: 'string' } }, required: ['photo', 'raison'], additionalProperties: false },
        },
      },
      required: ['couverture'],
      additionalProperties: false,
    },
    effort: 'medium',
    maxTokens: 6000,
    ids: lot.map((x) => x.id),
    cle: cleDemande('IA14', lot, d),
    sortieEstimee: 1000,
  };
}

/** Candidates classées (la première est la préférée), sans doublon ni numéro inventé. */
export function lireCouverture(reponse: unknown, ids: string[], nombre = PARAMETRES_COUVERTURE.nombre): { id: string; raison: string }[] {
  const vues = new Set<string>();
  const resultat: { id: string; raison: string }[] = [];
  for (const v of liste(reponse, 'couverture', 'candidates')) {
    const n = entier(estObjet(v) ? v.photo : v);
    if (n < 1 || n > ids.length || vues.has(ids[n - 1])) continue;
    vues.add(ids[n - 1]);
    resultat.push({ id: ids[n - 1], raison: estObjet(v) ? texte(v.raison, 300) : '' });
  }
  return resultat.slice(0, nombre);
}

// ---------------------------------------------------------------------------
// IA15 — contrôle de l'album (pages simulées)
// ---------------------------------------------------------------------------

/** Vue d'ensemble du script 06 : 24 vignettes de 220 px par planche ; 20 planches au plus par appel. */
export const PARAMETRES_CONTROLE_ALBUM = { parPlanche: 24, cellule: 220, colonnes: 6, maxPlanches: 20 };

export type TypeRemarqueAlbum = 'redondance' | 'rythme' | 'desequilibre' | 'autre';

export interface RemarqueAlbum {
  type: TypeRemarqueAlbum;
  pages: number[];
  photos: string[];
  texte: string;
}

const jourMois = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '?');

/** Numéro de page (à partir de 1) de chaque photo de l'album. */
export function pageDesPhotos(pages: Page[]): Map<string, number> {
  const m = new Map<string, number>();
  pages.forEach((p, i) => p.photos.forEach((id) => m.set(id, i + 1)));
  return m;
}

/** Plan des sections pour la consigne : titre, pages, nombre de photos, dates. */
export function planSections(ordre: PhotoIA[], secs: Section[], pages: Page[]): string {
  const page = pageDesPhotos(pages);
  return secs
    .map((s, k) => {
      const premiere = ordre[s.debut];
      const derniere = ordre[s.fin];
      const p1 = page.get(premiere.id) ?? 0;
      const p2 = page.get(derniere.id) ?? p1;
      const dates = jourMois(premiere.date) === jourMois(derniere.date) ? `le ${jourMois(premiere.date)}` : `du ${jourMois(premiere.date)} au ${jourMois(derniere.date)}`;
      return `${k + 1}. ${s.titre}${s.suite ? ' (suite)' : ''} : pages ${p1} à ${p2}, ${s.fin - s.debut + 1} photos, ${dates}`;
    })
    .join('\n');
}

/**
 * Demandes de contrôle : tout l'album en un appel (toutes les planches
 * ensemble, comme la vue d'ensemble du script 06) ; un album trop grand est
 * découpé entre deux sections.
 */
export function demandesControleAlbum(ordre: PhotoIA[], pages: Page[], secs: Section[], o: { album: string; contexte?: string }, p = PARAMETRES_CONTROLE_ALBUM): DemandeIA[] {
  if (!ordre.length || !secs.length) return [];
  const page = pageDesPhotos(pages);
  const plan = planSections(ordre, secs, pages);
  const max = p.parPlanche * p.maxPlanches;
  // Parties : sections consécutives tant qu'elles tiennent ; une section trop longue est coupée.
  const parties: { de: number; a: number; debut: number; fin: number }[] = [];
  secs.forEach((s, k) => {
    const derniere = parties.at(-1);
    if (derniere && s.fin - derniere.debut + 1 <= max) {
      derniere.a = k;
      derniere.fin = s.fin;
      return;
    }
    for (let i = s.debut; i <= s.fin; i += max) parties.push({ de: k, a: k, debut: i, fin: Math.min(s.fin, i + max - 1) });
  });
  return parties.map((partie) => {
    const photos = ordre.slice(partie.debut, partie.fin + 1);
    const ligne = parties.length > 1 ? `\n${remplir(consigneControlePartie, { de: partie.de + 1, a: partie.a + 1 })}` : '';
    const d = {
      systeme: SYSTEME_CRITERES,
      consigne: remplir(consigneControle, { album: guillemets(o.album), debut: 1, fin: photos.length, plan }) + ligne + ligneContexte(o.contexte),
      images: planches(photos, 1, { libelle: 'Planche', parPlanche: p.parPlanche, cellule: p.cellule, colonnes: p.colonnes, etiquettes: (x) => `p${page.get(x.id) ?? '?'}` }),
      rechercheWeb: 0,
    };
    return {
      fonction: 'IA15' as const,
      niveau: 'standard' as const,
      ...d,
      schema: {
        type: 'object',
        properties: {
          remarques: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['redondance', 'rythme', 'desequilibre', 'autre'] },
                pages: { type: 'array', items: { type: 'integer' } },
                photos: { type: 'array', items: { type: 'integer' } },
                texte: { type: 'string' },
              },
              required: ['type', 'pages', 'photos', 'texte'],
              additionalProperties: false,
            },
          },
        },
        required: ['remarques'],
        additionalProperties: false,
      },
      effort: 'medium' as const,
      maxTokens: 12000,
      ids: photos.map((x) => x.id),
      cle: cleDemande('IA15', photos, d),
      sortieEstimee: 2000,
    };
  });
}

const TYPES_REMARQUE_ALBUM: TypeRemarqueAlbum[] = ['redondance', 'rythme', 'desequilibre', 'autre'];

/** Pages montrées par une demande de contrôle (d'après les étiquettes « pN » des planches). */
export function pagesMontrees(d: Pick<DemandeIA, 'images'>): Set<number> {
  const pages = new Set<number>();
  for (const i of d.images) if (i.type === 'planche') for (const e of Object.values(i.etiquettes ?? {})) pages.add(entier(e.slice(1)));
  pages.delete(0);
  return pages;
}

/** Remarques validées : texte obligatoire, pages montrées et numéros valides seulement. */
export function lireControleAlbum(reponse: unknown, d: Pick<DemandeIA, 'ids' | 'images'>): RemarqueAlbum[] {
  const valides = pagesMontrees(d);
  const resultat: RemarqueAlbum[] = [];
  for (const o of liste(reponse, 'remarques').filter(estObjet)) {
    const t = simplifier(String(o.type ?? ''));
    const type = (TYPES_REMARQUE_ALBUM as string[]).includes(t) ? (t as TypeRemarqueAlbum) : t.startsWith('desequil') ? 'desequilibre' : t.startsWith('redond') ? 'redondance' : 'autre';
    const phrase = texte(o.texte ?? o.remarque, 300);
    if (!phrase) continue;
    const pages = [...new Set((Array.isArray(o.pages) ? o.pages : [o.pages]).map(entier).filter((n) => valides.has(n)))].sort((a, b) => a - b);
    resultat.push({ type, pages, photos: numeros(o.photos, d.ids.length).map((n) => d.ids[n - 1]), texte: phrase });
  }
  return resultat.slice(0, 10);
}
