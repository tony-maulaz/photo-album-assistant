// Doublons (étape « Doublons ») : portage du script 06 (SPEC § 11, REFERENCE_SCRIPTS § 8).
// Rafales en local ; vue d'ensemble du dossier par l'IA (repère les scènes,
// ne décide rien) ; scènes locales par ressemblance ; vérification en grand
// format (6 photos au plus) ; garde-fous. Les appels à l'IA et la fabrication
// des planches sont fournis par l'appelant, ce qui rend tout testable sans réseau.

import consigneSysteme from '../ia/consignes/doublons_systeme.txt?raw';
import consigneVerification from '../ia/consignes/doublons_verification.txt?raw';
import reglePrudente from '../ia/consignes/doublons_regle_prudente.txt?raw';
import regleStricte from '../ia/consignes/doublons_regle_stricte.txt?raw';
import consigneVue from '../ia/consignes/doublons_vue.txt?raw';
import { seuilFlou } from './indicateurs';
import { t } from './langue';
import { distanceHamming } from './phash';
import { combiner, ecarterGardee, echangerGardee, garderAussi, marquerDoublons, type DecisionDoublon, type FichierPlan, type Modification, type Plan } from './plan';
import { minutes } from './selection';
import { jetonsImage, type Modele } from './tarifs';

/** Réglages du script 06 (SPEC § 10). */
export const PARAMETRES_DOUBLONS = {
  fenetreMin: 10,
  distanceHash: 12,
  distanceScene: 20,
  parVue: 24,
  tailleVue: 220,
  colonnesVue: 6,
  parVerif: 6,
  tailleVerif: 520,
};

export interface PhotoDoublon {
  id: string;
  date?: string;
  phash?: string;
  nettete?: number;
  /** Gardée volontairement : jamais proposée comme doublon (I10). */
  protegee?: boolean;
}

export interface Proposition {
  garde: string;
  doublons: { id: string; description?: string; raison: string }[];
  source: 'rafale' | 'ia';
  scene?: string;
  descriptionGardee?: string;
  /** Doublons refusés par un garde-fou, à titre d'information. */
  refus?: { id: string; motif: string }[];
}

function semblables(a: PhotoDoublon, b: PhotoDoublon, seuil: number): boolean {
  return !!a.phash && !!b.phash && distanceHamming(a.phash, b.phash) <= seuil;
}

/**
 * Étage 1 : rafales quasi identiques (à moins de 10 min et distance ≤ 12),
 * groupement glouton ; la plus nette de chaque groupe est gardée.
 * `photos` est trié par date.
 */
export function rafales(photos: PhotoDoublon[], p = PARAMETRES_DOUBLONS): Proposition[] {
  const groupes: PhotoDoublon[][] = [];
  for (const r of photos) {
    const tr = minutes(r.date);
    const g = groupes.find((g) =>
      g.some((m) => {
        const tm = minutes(m.date);
        return tr !== null && tm !== null && tr - tm <= p.fenetreMin && semblables(r, m, p.distanceHash);
      }),
    );
    if (g) g.push(r);
    else groupes.push([r]);
  }
  const propositions: Proposition[] = [];
  for (const g of groupes) {
    if (g.length < 2) continue;
    const meilleure = g.reduce((a, b) => ((b.nettete ?? 0) > (a.nettete ?? 0) ? b : a));
    const doublons = g.filter((r) => r !== meilleure && !r.protegee).map((r) => ({ id: r.id, raison: t`quasi identique à quelques secondes` }));
    if (doublons.length) propositions.push({ garde: meilleure.id, doublons, source: 'rafale' });
  }
  return propositions;
}

/** Scènes locales : photos non groupées par le modèle, semblables (distance ≤ 20). */
export function scenesLocales(photos: PhotoDoublon[], deja: Set<string>, seuil = PARAMETRES_DOUBLONS.distanceScene): string[][] {
  const groupees = new Set(deja);
  const scenes: string[][] = [];
  photos.forEach((p, i) => {
    if (groupees.has(p.id)) return;
    const proches = photos.slice(i + 1).filter((q) => !groupees.has(q.id) && semblables(p, q, seuil));
    if (!proches.length) return;
    const scene = [p.id, ...proches.map((q) => q.id)];
    scene.forEach((id) => groupees.add(id));
    scenes.push(scene);
  });
  return scenes;
}

// ---------------------------------------------------------------------------
// Réponses du modèle : réparation (I12) et garde-fous (I7, I9)
// ---------------------------------------------------------------------------

export class JsonIrreparable extends Error {}

/** JSON du modèle, avec 5 niveaux de réparation (incident I12, `extraire_json` du script 06). */
export function extraireJson(brut: string): unknown {
  let texte = brut.replace(/```(?:json)?|```/g, '').trim();
  const debuts = [texte.indexOf('{'), texte.indexOf('[')].filter((i) => i >= 0);
  if (debuts.length) texte = texte.slice(Math.min(...debuts));
  const essayer = (t: string): unknown => {
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  };
  let r = essayer(texte);
  if (r !== undefined) return r;

  // 1. Guillemets typographiques et apostrophes exotiques ; 2. virgules en trop.
  let essai = texte
    .replace(/“|”/g, '"')
    .replace(/«|»/g, '')
    .replace(/‘|’/g, "'")
    .replace(/,(\s*[}\]])/g, '$1');
  r = essayer(essai);
  if (r !== undefined) return r;

  // 3. Guillemets non échappés DANS une valeur.
  const essai2 = essai.replace(/(:\s*)"([\s\S]*?)"(?=\s*[,}\]])/g, (_, a: string, b: string) => `${a}"${b.replace(/"/g, "'")}"`);
  r = essayer(essai2);
  if (r !== undefined) return r;

  // 4. Réponse tronquée : on ferme les structures ouvertes.
  const tronque = essai.trimEnd().replace(/,$/, '');
  for (const fermeture of [']}', '}]}', '"}]}', ']}]}']) {
    r = essayer(tronque + fermeture);
    if (r !== undefined) return r;
  }

  // 5. Dernier recours : les numéros, au regex.
  if (essai.includes('"scenes"')) {
    const scenes = [...essai.matchAll(/"numeros"\s*:\s*\[([\d,\s]*)\]?/g)]
      .map((m) => [...m[1].matchAll(/\d+/g)].map((x) => Number(x[0])))
      .filter((n) => n.length >= 2)
      .map((numeros) => ({ numeros, scene: '' }));
    if (scenes.length) return { scenes };
  }
  if (essai.includes('"garder"')) {
    const groupes = [...essai.matchAll(/"garder"\s*:\s*(\d+)[\s\S]*?"doublons"\s*:\s*\[([^\]]*)\]?/g)]
      .map((m) => {
        const numeros = [...m[2].matchAll(/"numero"\s*:\s*(\d+)/g)].map((x) => Number(x[1]));
        const nums = numeros.length ? numeros : [...m[2].matchAll(/\b\d+\b/g)].map((x) => Number(x[0]));
        return { garder: Number(m[1]), garder_description: '', doublons: nums.map((numero) => ({ numero, description: '' })), raison: 'JSON abîmé, numéros récupérés' };
      })
      .filter((g) => g.doublons.length);
    if (groupes.length) return { groupes };
  }
  throw new JsonIrreparable('Réponse illisible du modèle.');
}

const entier = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Scènes de la vue d'ensemble, validées : numéros dans [1, n], au moins deux par scène. */
export function lireScenes(v: unknown, n: number): { numeros: number[]; scene: string }[] {
  if (!estObjet(v) || !Array.isArray(v.scenes)) return [];
  return v.scenes.flatMap((s) => {
    if (!estObjet(s) || !Array.isArray(s.numeros)) return [];
    const numeros = [...new Set(s.numeros.map(entier).filter((x) => x >= 1 && x <= n))].sort((a, b) => a - b);
    return numeros.length >= 2 ? [{ numeros, scene: typeof s.scene === 'string' ? s.scene.trim() : '' }] : [];
  });
}

const MOTS_VIDES = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'd', 'un', 'une', 'dans', 'sur', 'sous', 'avec', 'et', 'en', 'au', 'aux', 'l', 'a', 'meme', 'même', 'photo', 'vue', 'plan']);

/**
 * Garde-fou des descriptions (I7) : la photo gardée et son doublon doivent
 * partager au moins un mot significatif ; sinon le modèle a mélangé deux scènes.
 * Écart volontaire avec le script : l'apostrophe typographique sépare les mots
 * (« l’archipel » donne « archipel », comme « l'archipel »).
 */
export function memesMots(a: string, b: string): boolean {
  const mots = (s: string) =>
    new Set(
      (s
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, ' ')
        .normalize('NFKD')
        .replace(/[^\x00-\x7f]/g, '')
        .match(/[a-z]{2,}/g) ?? []
      ).filter((m) => !MOTS_VIDES.has(m)),
    );
  const ma = mots(a);
  const mb = mots(b);
  if (!ma.size || !mb.size) return true;
  for (const m of ma) if (mb.has(m)) return true;
  return false;
}

export interface DecisionVerification {
  garder: number;
  descriptionGardee: string;
  doublons: { numero: number; description: string }[];
  raison: string;
  refus: { numero: number; motif: string }[];
}

/**
 * Décisions d'une vérification (règles du script 06) : un numéro hors plage,
 * désigné « à garder » ou déjà traité est ignoré (I9) ; une description sans
 * mot commun avec celle de la gardée est refusée (I7).
 */
export function decisionsVerification(v: unknown, n: number): DecisionVerification[] {
  if (!estObjet(v) || !Array.isArray(v.groupes)) return [];
  const groupes = v.groupes.filter((g): g is Record<string, unknown> => estObjet(g) && entier(g.garder) >= 1 && entier(g.garder) <= n);
  const gardiennes = new Set(groupes.map((g) => entier(g.garder)));
  const traites = new Set<number>();
  return groupes.map((g) => {
    const descriptionGardee = typeof g.garder_description === 'string' ? g.garder_description.trim() : '';
    const d: DecisionVerification = { garder: entier(g.garder), descriptionGardee, doublons: [], raison: typeof g.raison === 'string' ? g.raison.trim() : '', refus: [] };
    for (const item of Array.isArray(g.doublons) ? g.doublons : []) {
      const numero = estObjet(item) ? entier(item.numero) : entier(item);
      const description = estObjet(item) && typeof item.description === 'string' ? item.description.trim() : '';
      if (numero < 1 || numero > n || gardiennes.has(numero) || traites.has(numero)) continue;
      traites.add(numero);
      if (!memesMots(descriptionGardee, description)) {
        d.refus.push({ numero, motif: `garde-fou : « ${description} » ≠ « ${descriptionGardee} » (scènes distinctes ?)` });
        continue;
      }
      d.doublons.push({ numero, description });
    }
    return d;
  });
}

// ---------------------------------------------------------------------------
// Orchestration d'un dossier
// ---------------------------------------------------------------------------

export interface OutilsIA {
  /** Planche-contact en JPEG base64 : vignettes numérotées, marque [flou?], étiquettes. */
  planche(ids: string[], numeros: number[], flous: Set<number>, options: { cellule: number; colonnes: number; etiquettes?: Map<number, string> }): Promise<string>;
  /** Appel au modèle (avec cache) ; renvoie le JSON réparé, ou `null` si la réponse est inexploitable. */
  appeler(type: 'vue' | 'verif', planches: string[], consigne: string, cle: string): Promise<unknown | null>;
  /** Identité stable d'une photo pour les clés de cache (pas le chemin : piège n° 2). */
  identite(id: string): string;
}

export interface ResultatDossier {
  propositions: Proposition[];
  /** Scènes repérées, gardées pour les piles de l'étape « Sélection ». */
  scenes: string[][];
  /** Vue d'ensemble indisponible (réponse illisible) : seules les scènes locales ont été vérifiées. */
  vueIndisponible?: boolean;
}

/** Consigne de vérification remplie (n, scène, règle prudente ou stricte). */
export function consigneVerif(n: number, scene: string, strict: boolean): string {
  return consigneVerification
    .replaceAll('{n}', String(n))
    .replace('{scene}', scene || '?')
    .replace('{regle_expressions}', strict ? regleStricte : reglePrudente);
}

export { consigneSysteme, consigneVue };

/** Formats de réponse demandés au modèle (sorties structurées), calqués sur les consignes. */
export const SCHEMA_VUE = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { numeros: { type: 'array', items: { type: 'integer' } }, scene: { type: 'string' } },
        required: ['numeros', 'scene'],
        additionalProperties: false,
      },
    },
  },
  required: ['scenes'],
  additionalProperties: false,
};

export const SCHEMA_VERIF = {
  type: 'object',
  properties: {
    groupes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          garder: { type: 'integer' },
          garder_description: { type: 'string' },
          doublons: {
            type: 'array',
            items: {
              type: 'object',
              properties: { numero: { type: 'integer' }, description: { type: 'string' } },
              required: ['numero', 'description'],
              additionalProperties: false,
            },
          },
          raison: { type: 'string' },
        },
        required: ['garder', 'garder_description', 'doublons', 'raison'],
        additionalProperties: false,
      },
    },
  },
  required: ['groupes'],
  additionalProperties: false,
};

/** Analyse d'un dossier : rafales, puis (avec l'IA) vue d'ensemble, scènes locales et vérifications. */
/** Étage 1 d'un dossier : les rafales, et les photos qui restent pour l'IA (triées par date). */
export function etageRafales(photos: PhotoDoublon[], p = PARAMETRES_DOUBLONS): { propositions: Proposition[]; restants: PhotoDoublon[] } {
  const triees = [...photos].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const propositions = rafales(triees, p);
  const ecartees = new Set(propositions.flatMap((g) => g.doublons.map((d) => d.id)));
  return { propositions, restants: triees.filter((r) => !ecartees.has(r.id)) };
}

/** Clé de cache de la vue d'ensemble d'un dossier. */
export function cleVue(restants: PhotoDoublon[], identite: (id: string) => string): string {
  return `vue:${restants.map((r) => identite(r.id)).join('|')}`;
}

export async function analyserDossier(photos: PhotoDoublon[], ia: OutilsIA | null, strict: boolean, p = PARAMETRES_DOUBLONS): Promise<ResultatDossier> {
  const { propositions, restants } = etageRafales(photos, p);
  const scenes = propositions.map((g) => [g.garde, ...g.doublons.map((d) => d.id)]);
  if (!ia || restants.length < 2) return { propositions, scenes: [...scenes, ...scenesLocales(restants, new Set())] };

  // [flou?] seulement sous min(15e centile, 0,5 × médiane) du dossier (I8).
  const seuil = seuilFlou(restants.map((r) => r.nettete ?? 0));
  const numero = new Map(restants.map((r, i) => [r.id, i + 1]));
  const flous = new Set(restants.filter((r) => (r.nettete ?? 0) < seuil).map((r) => numero.get(r.id)!));

  // Vue d'ensemble : toutes les planches du dossier dans un seul appel (D6, I6).
  const planches: string[] = [];
  for (let i = 0; i < restants.length; i += p.parVue) {
    const bloc = restants.slice(i, i + p.parVue);
    planches.push(await ia.planche(bloc.map((r) => r.id), bloc.map((r) => numero.get(r.id)!), flous, { cellule: p.tailleVue, colonnes: p.colonnesVue }));
  }
  const vue = await ia.appeler('vue', planches, consigneVue, cleVue(restants, ia.identite));
  const candidats: { ids: string[]; scene: string }[] = lireScenes(vue, restants.length).map((s) => ({ ids: s.numeros.map((n) => restants[n - 1].id), scene: s.scene }));
  const groupees = new Set(candidats.flatMap((c) => c.ids));
  for (const s of scenesLocales(restants, groupees, p.distanceScene)) candidats.push({ ids: s, scene: 'scènes proches (détection locale)' });

  // Vérification en grand : 6 photos au plus par appel, heure sur chaque vignette (I5, I7).
  const marques = new Set<string>();
  const parId = new Map(restants.map((r) => [r.id, r]));
  for (const c of candidats) {
    for (let i = 0; i < c.ids.length; i += p.parVerif) {
      const sous = c.ids.slice(i, i + p.parVerif);
      if (sous.length < 2) continue;
      const locaux = sous.map((_, k) => k + 1);
      const flousLocaux = new Set(locaux.filter((k) => flous.has(numero.get(sous[k - 1])!)));
      const heures = new Map(locaux.map((k) => [k, (parId.get(sous[k - 1])!.date ?? '').slice(11, 16)]));
      const image = await ia.planche(sous, locaux, flousLocaux, { cellule: p.tailleVerif, colonnes: 3, etiquettes: heures });
      const reponse = await ia.appeler('verif', [image], consigneVerif(sous.length, c.scene, strict), `verif:${sous.map((id) => ia.identite(id)).join('|')}${strict ? ':agressif' : ''}`);
      for (const d of decisionsVerification(reponse, sous.length)) {
        const garde = sous[d.garder - 1];
        const doublons = d.doublons
          .map((x) => ({ id: sous[x.numero - 1], description: x.description }))
          .filter((x) => !parId.get(x.id)?.protegee && !marques.has(x.id) && x.id !== garde)
          .map((x) => ({ ...x, raison: x.description ? `${x.description} — ${d.raison}` : d.raison }));
        doublons.forEach((x) => marques.add(x.id));
        const refus = d.refus.map((r) => ({ id: sous[r.numero - 1], motif: r.motif }));
        if (doublons.length || refus.length) propositions.push({ garde, doublons, source: 'ia', scene: c.scene, descriptionGardee: d.descriptionGardee, refus });
      }
    }
  }
  return { propositions: propositions.filter((g) => g.doublons.length), scenes: [...scenes, ...candidats.map((c) => c.ids)], vueIndisponible: !estObjet(vue) };
}

// ---------------------------------------------------------------------------
// Coût estimé et décisions de l'utilisateur
// ---------------------------------------------------------------------------

/** Jetons d'une planche de `n` vignettes (cellule, colonnes, marges de 6 px). */
function jetonsPlanche(n: number, cellule: number, colonnes: number, m: Modele): number {
  const lignes = Math.ceil(n / colonnes);
  return jetonsImage(Math.min(n, colonnes) * cellule + (Math.min(n, colonnes) + 1) * 6, lignes * cellule + (lignes + 1) * 6, m.coteImageMax);
}

/**
 * Coût estimé (majorant) de l'analyse IA des doublons : une vue d'ensemble
 * par dossier, et une vérification pour 4 photos sur 10 (groupes de 4 en
 * moyenne) ; 1500 jetons de sortie par appel, réflexion comprise.
 */
export function estimationDoublons(photosParDossier: number[], m: Modele, p = PARAMETRES_DOUBLONS): { appels: number; images: number; usd: number } {
  let appels = 0;
  let images = 0;
  let entree = 0;
  let sortie = 0;
  for (const n of photosParDossier) {
    if (n < 2) continue;
    for (let i = 0; i < n; i += p.parVue) entree += jetonsPlanche(Math.min(p.parVue, n - i), p.tailleVue, p.colonnesVue, m);
    images += Math.ceil(n / p.parVue);
    appels++;
    entree += 900;
    sortie += 1500;
    const verifs = Math.ceil((0.4 * n) / 4);
    appels += verifs;
    images += verifs;
    entree += verifs * (jetonsPlanche(4, p.tailleVerif, 3, m) + 1300);
    sortie += verifs * 1500;
  }
  return { appels, images, usd: (entree * m.entree + sortie * m.sortie) / 1e6 };
}

/** État d'un doublon proposé, lu dans le plan (les décisions y sont enregistrées). */
export function etatDoublon(f: FichierPlan | undefined): 'propose' | 'accepte' | 'garde' {
  if (f?.statut === 'mis_de_cote' && f.raison === 'doublons') return 'accepte';
  if (!f || f.protegee || f.statut !== 'archive') return 'garde';
  return 'propose';
}

/** Photo gardée en ce moment dans un groupe : la proposée, ou celle choisie à sa place. */
export function gardeeActuelle(p: Proposition, fichier: (id: string) => FichierPlan | undefined): string {
  const proposee = fichier(p.garde);
  if (etatDoublon(proposee) !== 'accepte') return p.garde;
  const remplacante = proposee?.doublon?.garde;
  return remplacante && (remplacante === p.garde || p.doublons.some((d) => d.id === remplacante)) ? remplacante : p.garde;
}

function descriptionDans(p: Proposition, id: string): string | undefined {
  return id === p.garde ? p.descriptionGardee : p.doublons.find((d) => d.id === id)?.description;
}

/**
 * « Garder celle-ci à la place », depuis n'importe quel état : `nouvelle`
 * devient la gardée, la gardée actuelle est écartée, et les doublons encore
 * proposés du groupe sont écartés au profit de la nouvelle.
 */
export function garderALaPlace(plan: Plan, p: Proposition, nouvelle: string): Modification | null {
  const fichier = (id: string) => plan.fichiers.get(id);
  const actuelle = gardeeActuelle(p, fichier);
  const groupe = [p.garde, ...p.doublons.map((d) => d.id)];
  const info = (id: string, raison: string) => ({ garde: nouvelle, source: p.source, raison, description: descriptionDans(p, id), descriptionGardee: descriptionDans(p, nouvelle) });
  const remplacee = t`remplacée par une photo semblable choisie à la main`;
  const echange = echangerGardee(plan, groupe, actuelle, nouvelle, info(actuelle, remplacee));
  const restants = groupe.filter((id) => id !== nouvelle && id !== actuelle && etatDoublon(fichier(id)) === 'propose');
  const raisons = new Map(p.doublons.map((d) => [d.id, d.raison]));
  return combiner(t`Garder une autre photo à la place`, echange, marquerDoublons(plan, restants.map((id) => ({ id, ...info(id, raisons.get(id) ?? remplacee) }))));
}

/** « Écarter » une photo gardée aussi : on change d'avis, elle rejoint les doublons écartés du groupe. */
export function ecarterDuGroupe(plan: Plan, p: Proposition, id: string): Modification | null {
  const garde = gardeeActuelle(p, (x) => plan.fichiers.get(x));
  const raison = p.doublons.find((d) => d.id === id)?.raison ?? t`écartée à la main`;
  return ecarterGardee(plan, id, { garde, source: p.source, raison, description: descriptionDans(p, id), descriptionGardee: descriptionDans(p, garde) });
}

/**
 * Accepte une proposition : ses doublons sont mis de côté. Avec `garde`, une
 * autre photo du groupe est gardée à la place (« Garder celle-ci à la place ») :
 * elle est protégée, et l'ancienne gardée devient un doublon.
 */
export function accepterProposition(plan: Plan, p: Proposition, garde = p.garde): Modification | null {
  const doublons = new Map(p.doublons.map((d) => [d.id, d]));
  const descriptionGardee = garde === p.garde ? p.descriptionGardee : doublons.get(garde)?.description;
  const decisions: DecisionDoublon[] = [p.garde, ...doublons.keys()]
    .filter((id) => id !== garde && (id === p.garde || etatDoublon(plan.fichiers.get(id)) === 'propose'))
    .map((id) => ({
      id,
      garde,
      source: p.source,
      raison: doublons.get(id)?.raison ?? t`remplacée par une photo semblable choisie à la main`,
      description: id === p.garde ? p.descriptionGardee : doublons.get(id)?.description,
      descriptionGardee,
    }));
  return combiner(
    garde === p.garde ? t`Écarter les doublons` : t`Garder une autre photo à la place`,
    garde !== p.garde ? garderAussi(plan, [garde]) : null,
    marquerDoublons(plan, decisions),
  );
}
