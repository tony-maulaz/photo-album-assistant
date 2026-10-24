// Consolidation des dossiers (étape « Consolidation », IA6) : portage du script 05 (mode
// par défaut). Pour chaque répertoire d'au moins deux dossiers de photos, le
// modèle voit la liste (nom, nombre, période) et les planches des petits
// dossiers et des `Lieu_*`, et propose des fusions et des renommages.
// Sans IA : les dossiers aux noms proches ou qui se chevauchent sont
// présentés côte à côte, l'utilisateur décide.

import consigneConsolidation from '../ia/consignes/consolidation_consigne.txt?raw';
import sectionPlanches from '../ia/consignes/consolidation_section_planches.txt?raw';
import consigneSysteme from '../ia/consignes/consolidation_systeme.txt?raw';
import { cleNom } from './noms';
import { photosDuDossier, IGNORES_NOMMAGE, cleRequete, coutEstime, jetonsPlanche, normaliserNom, premierObjet, texteCourt, type BlocContenu, type Estimation, type RequeteIA } from './nommage';
import type { FichierPlan, Plan } from './plan';
import { minutes } from './selection';
import { modele as infoModele } from './tarifs';

/** Un dossier et ses photos (sous-dossiers compris), triées par date. */
export interface DossierInfo {
  id: string;
  nom: string;
  photos: FichierPlan[];
  /** Première et dernière date (heure locale), si connues. */
  du?: string;
  au?: string;
}

/** Répertoire à consolider : ses dossiers de photos (au moins deux). */
export interface GroupeFreres {
  /** Identifiant du répertoire parent (la racine comprise). */
  parent: string;
  dossiers: DossierInfo[];
}

function info(plan: Plan, id: string): DossierInfo {
  const photos = photosDuDossier(plan, id);
  const dates = photos.map((p) => p.date).filter((d): d is string => !!d);
  return { id, nom: plan.dossiers.get(id)!.nom, photos, du: dates[0], au: dates.at(-1) };
}

/**
 * Répertoires traités par le script 05 : la racine et tout dossier qui
 * contient au moins deux dossiers de photos (hors `_a_supprimer`, `_autres`,
 * `Sans_lieu`), chacun consolidé indépendamment.
 */
export function groupesDeFreres(plan: Plan): GroupeFreres[] {
  const enfants = new Map<string, string[]>();
  for (const d of plan.dossiers.values()) {
    if (d.parent === null || IGNORES_NOMMAGE.has(d.nom)) continue;
    enfants.set(d.parent, [...(enfants.get(d.parent) ?? []), d.id]);
  }
  const groupes: GroupeFreres[] = [];
  for (const [parent, ids] of enfants) {
    const p = plan.dossiers.get(parent);
    if (!p || (p.parent !== null && IGNORES_NOMMAGE.has(p.nom))) continue;
    const dossiers = ids
      .map((id) => info(plan, id))
      .filter((d) => d.photos.length > 0)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    if (dossiers.length >= 2) groupes.push({ parent, dossiers });
  }
  return groupes;
}

/** « 09.06 » ou « 09.06-11.06 » (script 05). */
function periodeCourte(d: DossierInfo): string {
  if (!d.du || !d.au) return 'date inconnue';
  const j = (x: string) => `${x.slice(8, 10)}.${x.slice(5, 7)}`;
  return d.du.slice(0, 10) === d.au.slice(0, 10) ? j(d.du) : `${j(d.du)}-${j(d.au)}`;
}

/** Liste donnée au modèle : « - Nom  (12 photos, 09.06-11.06) », comme le script. */
export function listeDossiers(dossiers: DossierInfo[]): string {
  return dossiers.map((d) => `- ${d.nom}  (${d.photos.length} photos, ${periodeCourte(d)})`).join('\n');
}

export const SEUIL_PLANCHE = 8;

/** Dossiers qui reçoivent une planche : moins de `seuil` photos, ou nom `Lieu_*` (non identifié). */
export function dossiersAPlanche(dossiers: DossierInfo[], seuil = SEUIL_PLANCHE): DossierInfo[] {
  return dossiers.filter((d) => d.photos.length < seuil || d.nom.toLowerCase().startsWith('lieu_'));
}

/** Planche des scripts 05 : 6 premières photos, 260 px, 3 colonnes, marge 5, JPEG 0,75, sans numéros. */
export const PLANCHE_05 = { cellule: 260, colonnes: 3, marge: 5, qualite: 0.75, max: 6 } as const;

export function plancheDossier(ids: string[]): Extract<BlocContenu, { type: 'planche' }> {
  return { type: 'planche', ids: ids.slice(0, PLANCHE_05.max), cellule: PLANCHE_05.cellule, colonnes: PLANCHE_05.colonnes, marge: PLANCHE_05.marge, qualite: PLANCHE_05.qualite };
}

export function consigneConsolidationGroupe(g: GroupeFreres, seuilPlanche = SEUIL_PLANCHE): string {
  const avecPlanches = dossiersAPlanche(g.dossiers, seuilPlanche).length > 0;
  return consigneConsolidation.replace('{liste}', listeDossiers(g.dossiers)).replace('{section_planches}', avecPlanches ? sectionPlanches : '');
}

export const SCHEMA_CONSOLIDATION = {
  type: 'object',
  properties: {
    fusions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { cible: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, raison: { type: 'string' } },
        required: ['cible', 'sources', 'raison'],
        additionalProperties: false,
      },
    },
    renommages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { dossier: { type: 'string' }, nom: { type: 'string' }, raison: { type: 'string' } },
        required: ['dossier', 'nom', 'raison'],
        additionalProperties: false,
      },
    },
  },
  required: ['fusions', 'renommages'],
  additionalProperties: false,
};

/** Requête d'un répertoire : planches des petits dossiers (« Planche du dossier « X » : »), puis la consigne. */
export function requeteConsolidation(g: GroupeFreres, idModele: string, identite: (f: FichierPlan) => string, seuilPlanche = SEUIL_PLANCHE): RequeteIA {
  const contenu: BlocContenu[] = [];
  const identites: string[] = [];
  for (const d of dossiersAPlanche(g.dossiers, seuilPlanche)) {
    const photos = d.photos.slice(0, PLANCHE_05.max);
    contenu.push({ type: 'texte', texte: `Planche du dossier « ${d.nom} » :` });
    contenu.push(plancheDossier(photos.map((p) => p.id)));
    identites.push(...photos.map(identite));
  }
  const consigne = consigneConsolidationGroupe(g, seuilPlanche);
  contenu.push({ type: 'texte', texte: consigne });
  return {
    fonction: 'IA6',
    systeme: consigneSysteme,
    contenu,
    schema: SCHEMA_CONSOLIDATION,
    cle: cleRequete('IA6', idModele, consigne, identites),
    effort: 'medium',
    maxTokens: 16000,
    outils: null,
    estimationUSD: estimationConsolidation([g], idModele, seuilPlanche).usd,
  };
}

export interface FusionProposee {
  /** Nom final (dossier existant, ou nouveau nom qui étend la période). */
  cible: string;
  /** Dossier existant qui porte déjà ce nom, s'il y en a un (il reçoit les autres). */
  cibleId: string | null;
  /** Dossiers à fusionner dans la cible (connus, différents de la cible). */
  sources: string[];
  raison: string;
}

export interface RenommageConsolidation {
  dossier: string;
  nom: string;
  raison: string;
}

export interface Consolidation {
  fusions: FusionProposee[];
  renommages: RenommageConsolidation[];
  /** Noms cités par le modèle mais inconnus (ignorés, I9). */
  inconnus: string[];
}

/** Dossier désigné par son nom : exact, sinon sans tenir compte de la casse ni des accents composés. */
function trouver(dossiers: DossierInfo[], nom: string): DossierInfo | undefined {
  return dossiers.find((d) => d.nom === nom) ?? dossiers.find((d) => cleNom(d.nom) === cleNom(nom));
}

/**
 * Réponse validée (règles du script 05) : une source doit être un dossier
 * du répertoire, différent de la cible ; un dossier n'est fusionné qu'une
 * fois ; un dossier fusionné n'est pas aussi renommé (écart : le script
 * gardait la dernière ligne écrite) ; un nom vide ou inchangé est ignoré.
 */
export function lireConsolidation(v: unknown, g: GroupeFreres): Consolidation {
  const r = premierObjet(v);
  const resultat: Consolidation = { fusions: [], renommages: [], inconnus: [] };
  if (!r) return resultat;
  const pris = new Set<string>();
  for (const f of Array.isArray(r.fusions) ? r.fusions : []) {
    const o = premierObjet(f);
    if (!o) continue;
    const cible = normaliserNom(texteCourt(o.cible, 200));
    if (!cible) continue;
    const cibleDossier = trouver(g.dossiers, cible) ?? trouver(g.dossiers, texteCourt(o.cible, 200));
    const sources: string[] = [];
    for (const s of Array.isArray(o.sources) ? o.sources : []) {
      const nom = texteCourt(s, 200);
      const d = nom ? trouver(g.dossiers, nom) : undefined;
      if (!d) {
        if (nom) resultat.inconnus.push(nom);
        continue;
      }
      if (d.id === cibleDossier?.id || pris.has(d.id)) continue;
      pris.add(d.id);
      sources.push(d.id);
    }
    // Cible sans dossier existant (nom étendu à la nouvelle période) : le script créait ce
    // dossier et y versait les sources ; `cibleId` vaut alors `null`.
    if (!sources.length) continue;
    resultat.fusions.push({ cible: cibleDossier?.nom ?? cible, cibleId: cibleDossier?.id ?? null, sources, raison: texteCourt(o.raison) });
    if (cibleDossier) pris.add(cibleDossier.id);
  }
  for (const x of Array.isArray(r.renommages) ? r.renommages : []) {
    const o = premierObjet(x);
    if (!o) continue;
    const nomActuel = texteCourt(o.dossier, 200);
    const d = nomActuel ? trouver(g.dossiers, nomActuel) : undefined;
    if (!d) {
      if (nomActuel) resultat.inconnus.push(nomActuel);
      continue;
    }
    const nom = normaliserNom(texteCourt(o.nom, 200));
    if (!nom || nom === d.nom || pris.has(d.id)) continue;
    pris.add(d.id);
    resultat.renommages.push({ dossier: d.id, nom, raison: texteCourt(o.raison) });
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Sans IA : rapprochements locaux
// ---------------------------------------------------------------------------

export interface Rapprochement {
  a: string;
  b: string;
  raisons: ('noms_proches' | 'chevauchement')[];
}

/** Nom sans date ni suffixe, en minuscules, sans séparateurs : « Vol_Koh_Samui_18.07.26 » → « volkohsamui ». */
export function racineNom(nom: string): string {
  return nom
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[_\-. ]\d{1,2}([-–]\d{1,2})?[.\-]\d{1,2}[.\-]\d{2,4}$/, '')
    .replace(/[_\-. ]\d{4}[-_]\d{2}([-_]\d{2})?(_[b-z])?$/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Distance d'édition (Levenshtein), bornée : au-delà de `max`, renvoie `max + 1`. */
function distanceEdition(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minLigne = Math.min(minLigne, cour[j]);
    }
    if (minLigne > max) return max + 1;
    prec = cour;
  }
  return prec[b.length];
}

/** Noms proches : même racine, l'une contient l'autre, ou une ou deux lettres d'écart. */
export function nomsProches(a: string, b: string): boolean {
  const ra = racineNom(a);
  const rb = racineNom(b);
  if (ra.length < 3 || rb.length < 3) return false;
  if (ra === rb || ra.includes(rb) || rb.includes(ra)) return true;
  return distanceEdition(ra, rb, 2) <= Math.max(1, Math.min(2, Math.floor(Math.min(ra.length, rb.length) / 6)));
}

/** Les périodes de deux dossiers se recouvrent-elles ? */
export function chevauchement(a: DossierInfo, b: DossierInfo): boolean {
  const [a1, a2, b1, b2] = [minutes(a.du), minutes(a.au), minutes(b.du), minutes(b.au)];
  if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
  return a1 <= b2 && b1 <= a2;
}

/** Paires de dossiers d'un répertoire à présenter côte à côte (version sans IA de l'étape « Consolidation »). */
export function rapprochementsLocaux(g: GroupeFreres): Rapprochement[] {
  const paires: Rapprochement[] = [];
  g.dossiers.forEach((a, i) => {
    for (const b of g.dossiers.slice(i + 1)) {
      const raisons: Rapprochement['raisons'] = [];
      if (nomsProches(a.nom, b.nom)) raisons.push('noms_proches');
      if (chevauchement(a, b)) raisons.push('chevauchement');
      if (raisons.length) paires.push({ a: a.id, b: b.id, raisons });
    }
  });
  return paires;
}

// ---------------------------------------------------------------------------
// Coût
// ---------------------------------------------------------------------------

/**
 * Coût estimé (majorant) : un appel par répertoire, la liste (20 jetons par
 * dossier) et la consigne (900), une planche par petit dossier, 1500 jetons
 * de sortie.
 */
export function estimationConsolidation(groupes: GroupeFreres[], idModele: string, seuilPlanche = SEUIL_PLANCHE): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  let images = 0;
  let entree = 0;
  for (const g of groupes) {
    entree += 900 + 20 * g.dossiers.length;
    for (const d of dossiersAPlanche(g.dossiers, seuilPlanche)) {
      images++;
      entree += jetonsPlanche(Math.min(PLANCHE_05.max, d.photos.length), PLANCHE_05.cellule, PLANCHE_05.colonnes, PLANCHE_05.marge, m.coteImageMax);
    }
  }
  return { appels: groupes.length, images, recherches: 0, usd: coutEstime(idModele, entree, groupes.length, 0) };
}
