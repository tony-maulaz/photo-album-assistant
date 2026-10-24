// Aides IA du tri, sans équivalent dans les scripts (consignes nouvelles,
// SPEC § 7.1) :
// - IA1 (étape 3) : juger les cas limites de netteté, photo par photo ;
// - IA2 (étape « Tri automatique ») : situer des photos sans GPS d'après leur contenu et les
//   photos prises juste avant et après.
// (IA5, la reconnaissance séparée des monuments, est intégrée au nommage IA4 : D51.)
// Chaque aide propose ; l'utilisateur accepte ou refuse (règle d'or 3).

import consigneSystemeLieu from '../ia/consignes/lieu_systeme.txt?raw';
import consigneSituer from '../ia/consignes/lieu_situer.txt?raw';
import consigneCasLimites from '../ia/consignes/nettete_cas_limites.txt?raw';
import consigneSystemeNettete from '../ia/consignes/nettete_systeme.txt?raw';
import {
  cleRequete,
  confiance,
  coutEstime,
  entier,
  estObjet,
  jetonsPhoto,
  jetonsPlanche,
  premierObjet,
  texteCourt,
  type BlocContenu,
  type Estimation,
  type RequeteIA,
} from './nommage';
import { minutes } from './selection';
import { modele as infoModele } from './tarifs';

/** « 24.07 12:10 » : jour et heure d'une date locale. */
function jourHeure(d?: string): string {
  if (!d) return 'heure inconnue';
  return `${d.slice(8, 10)}.${d.slice(5, 7)}${d.length > 10 ? ` ${d.slice(11, 16)}` : ''}`;
}

// ---------------------------------------------------------------------------
// IA1 — cas limites de netteté (étape 3)
// ---------------------------------------------------------------------------

export interface PhotoNettete {
  id: string;
  dossier: string;
  date?: string;
  nettete: number;
}

export const OPTIONS_CAS_LIMITES = {
  /** Cas limite : netteté entre seuil × (1 − marge) et seuil × (1 + marge). */
  marge: 0.35,
  /** Photos envoyées au plus. */
  max: 60,
  /** Photos par décision, en grand (I5 : au-delà de ~9 vignettes, le modèle confond les numéros). */
  parPlanche: 6,
  cellule: 520,
  colonnes: 3,
};

/** Photos dont la netteté est proche du seuil, les plus proches d'abord. */
export function casLimites(photos: PhotoNettete[], seuil: number, o = OPTIONS_CAS_LIMITES): PhotoNettete[] {
  if (seuil <= 0) return [];
  return photos
    .filter((p) => p.nettete >= seuil * (1 - o.marge) && p.nettete <= seuil * (1 + o.marge))
    .sort((a, b) => Math.abs(Math.log(a.nettete / seuil)) - Math.abs(Math.log(b.nettete / seuil)))
    .slice(0, o.max);
}

/** Lots d'au plus 6 photos d'un même dossier, par date : une planche et un appel par lot. */
export function lotsCasLimites(cas: PhotoNettete[], o = OPTIONS_CAS_LIMITES): PhotoNettete[][] {
  const parDossier = new Map<string, PhotoNettete[]>();
  for (const p of cas) parDossier.set(p.dossier, [...(parDossier.get(p.dossier) ?? []), p]);
  const lots: PhotoNettete[][] = [];
  for (const liste of parDossier.values()) {
    liste.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    for (let i = 0; i < liste.length; i += o.parPlanche) lots.push(liste.slice(i, i + o.parPlanche));
  }
  return lots;
}

export const SCHEMA_CAS_LIMITES = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { numero: { type: 'integer' }, verdict: { type: 'string', enum: ['nette', 'flou_voulu', 'ratee'] }, raison: { type: 'string' } },
        required: ['numero', 'verdict', 'raison'],
        additionalProperties: false,
      },
    },
  },
  required: ['photos'],
  additionalProperties: false,
};

export function requeteCasLimites(lot: PhotoNettete[], idModele: string, identite: (id: string) => string, o = OPTIONS_CAS_LIMITES): RequeteIA {
  const consigne = consigneCasLimites.replaceAll('{n}', String(lot.length));
  const contenu: BlocContenu[] = [
    {
      type: 'planche',
      ids: lot.map((p) => p.id),
      cellule: o.cellule,
      colonnes: o.colonnes,
      marge: 6,
      qualite: 0.78,
      numeros: lot.map((_, i) => i + 1),
      etiquettes: Object.fromEntries(lot.map((p, i) => [String(i + 1), p.date && p.date.length > 10 ? p.date.slice(11, 16) : ''])),
    },
    { type: 'texte', texte: consigne },
  ];
  return {
    fonction: 'IA1',
    systeme: consigneSystemeNettete,
    contenu,
    schema: SCHEMA_CAS_LIMITES,
    cle: cleRequete('IA1', idModele, consigne, lot.map((p) => identite(p.id))),
    effort: 'low',
    maxTokens: 16000,
    outils: null,
    estimationUSD: estimationCasLimites([lot.length], idModele, o).usd,
  };
}

export type VerdictNettete = 'nette' | 'flou_voulu' | 'ratee';

const VERDICTS: Record<string, VerdictNettete> = { nette: 'nette', flou_voulu: 'flou_voulu', 'flou voulu': 'flou_voulu', ratee: 'ratee', 'ratée': 'ratee' };

/** Verdicts validés : numéro dans le lot, verdict connu, premier verdict retenu pour un numéro cité deux fois (I9). */
export function lireCasLimites(v: unknown, lot: PhotoNettete[]): Map<string, { verdict: VerdictNettete; raison: string }> {
  const r = premierObjet(v);
  const resultat = new Map<string, { verdict: VerdictNettete; raison: string }>();
  const liste = r && Array.isArray(r.photos) ? r.photos : Array.isArray(v) ? v : [];
  for (const x of liste) {
    if (!estObjet(x)) continue;
    const n = entier(x.numero);
    const verdict = VERDICTS[texteCourt(x.verdict, 20).toLowerCase()];
    if (n === null || n < 1 || n > lot.length || !verdict || resultat.has(lot[n - 1].id)) continue;
    resultat.set(lot[n - 1].id, { verdict, raison: texteCourt(x.raison, 200) });
  }
  return resultat;
}

export function estimationCasLimites(taillesLots: number[], idModele: string, o = OPTIONS_CAS_LIMITES): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  const lots = taillesLots.filter((n) => n > 0);
  const entree = lots.reduce((t, n) => t + 600 + jetonsPlanche(n, o.cellule, o.colonnes, 6, m.coteImageMax), 0);
  return { appels: lots.length, images: lots.length, recherches: 0, usd: coutEstime(idModele, entree, lots.length, 0) };
}

// ---------------------------------------------------------------------------
// IA2 — situer les photos sans GPS (étape « Tri automatique »)
// ---------------------------------------------------------------------------

export interface PhotoLieu {
  id: string;
  date?: string;
  gps?: { lat: number; lon: number };
  /** Dossier où la photo est rangée (pour les voisines : la réponse attendue). */
  dossier: string;
}

export const OPTIONS_SITUER = {
  /** Photos sans GPS prises à moins de N minutes l'une de l'autre : situées ensemble. */
  ecartGroupeMin: 60,
  maxCibles: 4,
  voisinsAvant: 2,
  voisinsApres: 2,
  /** Une voisine doit être à moins de N heures. */
  fenetreHeures: 12,
  cote: 640,
};

/** Photos datées sans GPS, groupées quand elles se suivent de près le même jour (4 au plus par groupe). */
export function groupesSansGps(photos: PhotoLieu[], o = OPTIONS_SITUER): PhotoLieu[][] {
  const sans = photos.filter((p) => !p.gps && minutes(p.date) !== null).sort((a, b) => a.date!.localeCompare(b.date!));
  const groupes: PhotoLieu[][] = [];
  for (const p of sans) {
    const g = groupes.at(-1);
    const prec = g?.at(-1);
    if (g && prec && g.length < o.maxCibles && prec.date!.slice(0, 10) === p.date!.slice(0, 10) && minutes(p.date)! - minutes(prec.date)! <= o.ecartGroupeMin) g.push(p);
    else groupes.push([p]);
  }
  return groupes;
}

/**
 * Photos voisines d'un groupe : les plus proches avec GPS, juste avant et
 * juste après (2 + 2), de dossiers différents quand c'est possible, à moins
 * de 12 h.
 */
export function voisinesDuGroupe(groupe: PhotoLieu[], photos: PhotoLieu[], o = OPTIONS_SITUER): PhotoLieu[] {
  const debut = minutes(groupe[0].date);
  const fin = minutes(groupe.at(-1)!.date);
  if (debut === null || fin === null) return [];
  const avec = photosAvecGps(photos);
  const choisir = (candidates: PhotoLieu[], n: number) => {
    const pris: PhotoLieu[] = [];
    const dossiers = new Set<string>();
    for (const passe of [true, false]) {
      for (const p of candidates) {
        if (pris.length >= n) break;
        if (pris.includes(p) || (passe && dossiers.has(p.dossier))) continue;
        pris.push(p);
        dossiers.add(p.dossier);
      }
    }
    return pris;
  };
  const marge = o.fenetreHeures * 60;
  // Photos avec GPS triées par heure une fois pour toutes : on ne parcourt que la fenêtre utile.
  const avant: PhotoLieu[] = [];
  for (let i = premierApres(avec, debut - marge); i < avec.length && avec[i].t <= debut; i++) avant.push(avec[i].p);
  avant.reverse();
  const apres: PhotoLieu[] = [];
  for (let i = premierApres(avec, fin); i < avec.length && avec[i].t <= fin + marge; i++) apres.push(avec[i].p);
  return [...choisir(avant, o.voisinsAvant).reverse(), ...choisir(apres, o.voisinsApres)];
}

const triees = new WeakMap<PhotoLieu[], { p: PhotoLieu; t: number }[]>();

/** Photos datées avec GPS, triées par heure (calculé une fois par liste). */
function photosAvecGps(photos: PhotoLieu[]): { p: PhotoLieu; t: number }[] {
  let l = triees.get(photos);
  if (!l) {
    l = photos.flatMap((p) => {
      const t = minutes(p.date);
      return p.gps && t !== null ? [{ p, t }] : [];
    });
    l.sort((a, b) => a.t - b.t);
    triees.set(photos, l);
  }
  return l;
}

/** Premier indice dont l'heure est ≥ `t` (recherche dichotomique). */
function premierApres(l: { t: number }[], t: number): number {
  let bas = 0;
  let haut = l.length;
  while (bas < haut) {
    const m = (bas + haut) >> 1;
    if (l[m].t < t) bas = m + 1;
    else haut = m;
  }
  return bas;
}

const LETTRES = 'ABCDEFGH';

export const SCHEMA_SITUER = {
  type: 'object',
  properties: { voisine: { type: 'integer' }, confiance: { type: 'integer' }, raison: { type: 'string' } },
  required: ['voisine', 'confiance', 'raison'],
  additionalProperties: false,
};

/**
 * Requête d'un groupe : les photos à situer (« Photo A : »…), puis les
 * voisines (« Photo 1 : »…), puis la consigne. `null` sans voisine.
 */
export function requeteSituer(
  groupe: PhotoLieu[],
  voisines: PhotoLieu[],
  dossier: (id: string) => { nom: string; lieu?: string },
  idModele: string,
  identite: (id: string) => string,
  o = OPTIONS_SITUER,
): RequeteIA | null {
  if (!voisines.length || !groupe.length) return null;
  const cibles = groupe.slice(0, LETTRES.length);
  const contenu: BlocContenu[] = [];
  cibles.forEach((p, i) => {
    contenu.push({ type: 'texte', texte: `Photo ${LETTRES[i]} :` });
    contenu.push({ type: 'photo', id: p.id, cote: o.cote });
  });
  voisines.forEach((p, i) => {
    contenu.push({ type: 'texte', texte: `Photo ${i + 1} :` });
    contenu.push({ type: 'photo', id: p.id, cote: o.cote });
  });
  const lignes = voisines.map((p, i) => {
    const d = dossier(p.dossier);
    return `- Photo ${i + 1} : ${jourHeure(p.date)}, dossier « ${d.nom} »${d.lieu ? ` (${d.lieu})` : ''}`;
  });
  const consigne = consigneSituer.replace('{cibles}', cibles.map((p, i) => `${LETTRES[i]} (${jourHeure(p.date)})`).join(', ')).replace('{voisins}', lignes.join('\n'));
  contenu.push({ type: 'texte', texte: consigne });
  return {
    fonction: 'IA2',
    systeme: consigneSystemeLieu,
    contenu,
    schema: SCHEMA_SITUER,
    cle: cleRequete('IA2', idModele, consigne, [...cibles, ...voisines].map((p) => identite(p.id))),
    effort: 'medium',
    maxTokens: 16000,
    outils: null,
    estimationUSD: estimationSituer([cibles.length + voisines.length], idModele, o).usd,
  };
}

export interface Situation {
  /** Dossier proposé (celui de la photo voisine désignée), ou `null` (« aucun »). */
  dossier: string | null;
  voisine: string | null;
  confiance: number | null;
  raison: string;
}

/** Réponse validée : un numéro hors des voisines envoyées vaut « aucun ». */
export function lireSituation(v: unknown, voisines: PhotoLieu[]): Situation | null {
  const r = premierObjet(v);
  if (!r) return null;
  const n = entier(r.voisine);
  const p = n !== null && n >= 1 && n <= voisines.length ? voisines[n - 1] : null;
  return { dossier: p?.dossier ?? null, voisine: p?.id ?? null, confiance: confiance(r.confiance), raison: texteCourt(r.raison) };
}

/** Coût estimé : par groupe, ses photos et ses voisines (640 px), 500 jetons de texte, 1500 de sortie. */
export function estimationSituer(imagesParGroupe: number[], idModele: string, o = OPTIONS_SITUER): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  const groupes = imagesParGroupe.filter((n) => n > 0);
  const images = groupes.reduce((t, n) => t + n, 0);
  const entree = groupes.length * 500 + images * jetonsPhoto(o.cote, m.coteImageMax);
  return { appels: groupes.length, images, recherches: 0, usd: coutEstime(idModele, entree, groupes.length, 0) };
}
