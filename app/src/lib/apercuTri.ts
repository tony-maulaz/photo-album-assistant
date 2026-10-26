// Aperçu du tri automatique (étape « Tri automatique ») : chiffres, semaines
// d'exemple et frise, calculés sur les dossiers proposés par le tri (grouper +
// arborescence, sans les noms OpenStreetMap). L'écran recalcule les dossiers à
// chaque changement de réglage ; ces fonctions pures n'en font que la lecture.

import type { DossierPropose } from './tri';

/** Bornes hautes des classes de taille : 1-2, 3-10, 11-50, 51-200, puis plus de 200 éléments. */
export const BORNES_TAILLES = [2, 10, 50, 200] as const;

export type Tailles = [number, number, number, number, number];

export interface StatistiquesTri {
  dossiers: number;
  /** Dossiers « Voyage_… » distincts (parents des étapes). */
  voyages: number;
  /** Nombre de dossiers de 1-2, 3-10, 11-50, 51-200 et plus de 200 éléments. */
  tailles: Tailles;
  tresPetits: number;
  tresGrands: number;
}

/** Classe de taille (0 à 4) d'un dossier de `n` éléments. */
export function classeTaille(n: number): number {
  const i = BORNES_TAILLES.findIndex((b) => n <= b);
  return i < 0 ? BORNES_TAILLES.length : i;
}

export function statistiquesTri(dossiers: DossierPropose[]): StatistiquesTri {
  const tailles: Tailles = [0, 0, 0, 0, 0];
  const voyages = new Set<string>();
  for (const d of dossiers) {
    tailles[classeTaille(d.photos.length)]++;
    if (d.infoParent?.origine === 'voyage') voyages.add(d.chemin[0]);
  }
  return { dossiers: dossiers.length, voyages: voyages.size, tailles, tresPetits: tailles[0], tresGrands: tailles[4] };
}

// ---------------------------------------------------------------------------
// Jours
// ---------------------------------------------------------------------------

const JOUR_MS = 86_400_000;

/** « AAAA-MM-JJ » d'une date « AAAA-MM-JJ » ou « AAAA-MM-JJTHH:MM:SS » ; `null` si absente ou illisible. */
export function jourDe(date?: string): string | null {
  if (!date || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/.test(date)) return null;
  return date.slice(0, 10);
}

/** Jour `n` jours après `jour` (avant si `n` est négatif). */
export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `du` à `au` (0 pour le même jour). */
export function ecartJours(du: string, au: string): number {
  return Math.round((Date.parse(`${au}T12:00:00Z`) - Date.parse(`${du}T12:00:00Z`)) / JOUR_MS);
}

/** Jours de `du` à `au` inclus. */
export function joursEntre(du: string, au: string): string[] {
  const jours: string[] = [];
  for (let j = du; j <= au; j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}

/** Ce que l'aperçu sait d'un dossier : ses éléments par jour, premier et dernier jour. */
interface Lecture {
  jours: Map<string, number>;
  du: string | null;
  au: string | null;
}

function lire(dossiers: DossierPropose[], dates: Map<string, string | undefined>): Lecture[] {
  return dossiers.map((d) => {
    const jours = new Map<string, number>();
    let du: string | null = null;
    let au: string | null = null;
    for (const id of d.photos) {
      const j = jourDe(dates.get(id));
      if (!j) continue;
      jours.set(j, (jours.get(j) ?? 0) + 1);
      if (!du || j < du) du = j;
      if (!au || j > au) au = j;
    }
    return { jours, du, au };
  });
}

/** Le dossier est-il au domicile (lieu connu marqué « domicile ») ? */
export function auDomicile(d: DossierPropose, domicile?: string): boolean {
  return !!domicile && d.info.origine === 'lieu_connu' && d.info.lieu === domicile;
}

// ---------------------------------------------------------------------------
// Semaines d'exemple
// ---------------------------------------------------------------------------

export type RaisonExemple = 'chargee' | 'voyage' | 'maison' | 'petits' | 'grand';

export interface ExempleTri {
  raison: RaisonExemple;
  /** Premier et dernier jour montrés (AAAA-MM-JJ). */
  du: string;
  au: string;
}

/** Jours d'une semaine d'exemple, et au plus pour un voyage. */
export const JOURS_SEMAINE = 7;
export const JOURS_VOYAGE_MAX = 14;

/**
 * Pour chaque début de fenêtre (`debuts`, triés), somme des valeurs de
 * `parJour` sur `largeur` jours à partir de ce début.
 */
function sommesFenetres(parJour: Map<string, number>, debuts: string[], largeur = JOURS_SEMAINE): number[] {
  const jours = [...parJour.keys()].sort();
  let a = 0;
  let b = 0;
  let somme = 0;
  return debuts.map((s) => {
    const fin = ajouterJours(s, largeur - 1);
    while (b < jours.length && jours[b] <= fin) somme += parJour.get(jours[b++])!;
    while (a < b && jours[a] < s) somme -= parJour.get(jours[a++])!;
    return somme;
  });
}

/**
 * Pour chaque début de fenêtre (`debuts`, triés), nombre de dossiers présents
 * (au moins un élément) sur `largeur` jours. `joursDossiers` : jours triés de
 * chaque dossier. Un dossier couvre les débuts [j − largeur + 1, j] de chacun
 * de ses jours j ; ces intervalles, fusionnés, ne le comptent qu'une fois.
 */
function dossiersParFenetre(joursDossiers: string[][], debuts: string[], largeur = JOURS_SEMAINE): number[] {
  const ouvertures: string[] = [];
  const fermetures: string[] = [];
  const fermer = (c: [string, string] | null) => {
    if (!c) return;
    ouvertures.push(c[0]);
    fermetures.push(c[1]);
  };
  for (const jours of joursDossiers) {
    let courant: [string, string] | null = null;
    for (const j of jours) {
      const a = ajouterJours(j, 1 - largeur);
      if (courant && a <= courant[1]) courant[1] = j;
      else {
        fermer(courant);
        courant = [a, j];
      }
    }
    fermer(courant);
  }
  ouvertures.sort();
  fermetures.sort();
  let o = 0;
  let f = 0;
  return debuts.map((s) => {
    while (o < ouvertures.length && ouvertures[o] <= s) o++;
    while (f < fermetures.length && fermetures[f] < s) f++;
    return o - f;
  });
}

/** Jours communs à deux périodes. */
function joursCommuns(a: { du: string; au: string }, b: { du: string; au: string }): number {
  const du = a.du > b.du ? a.du : b.du;
  const au = a.au < b.au ? a.au : b.au;
  return du > au ? 0 : ecartJours(du, au) + 1;
}

/**
 * Au plus cinq périodes à montrer en exemple, dans cet ordre : la semaine la
 * plus chargée en photos ; le plus long voyage (du premier au dernier jour,
 * coupé à 14 jours) ; une semaine dominée par le domicile (si `domicile`, nom
 * du lieu connu) ; la semaine qui contient le plus de dossiers de 1-2
 * éléments ; la semaine qui commence au début du plus grand dossier daté.
 * Une semaine commence toujours un jour avec photos ; à égalité, la plus
 * ancienne. Pas de doublon : le voyage est omis s'il montre exactement la même
 * période qu'un exemple déjà choisi ; la semaine à la maison et celle des
 * petits dossiers passent à la suivante si elles partagent plus de la moitié de
 * leurs jours avec un exemple déjà choisi ; le plus grand dossier est alors
 * omis. `dates` : date de chaque identifiant (non datés ignorés).
 */
export function choisirExemples(dossiers: DossierPropose[], dates: Map<string, string | undefined>, domicile?: string): ExempleTri[] {
  const lus = lire(dossiers, dates);
  const parJour = new Map<string, number>();
  for (const l of lus) for (const [j, n] of l.jours) parJour.set(j, (parJour.get(j) ?? 0) + n);
  const debuts = [...parJour.keys()].sort();
  if (!debuts.length) return [];

  const exemples: ExempleTri[] = [];
  const semaine = (du: string) => ({ du, au: ajouterJours(du, JOURS_SEMAINE - 1) });
  const identique = (p: { du: string; au: string }) => exemples.some((e) => e.du === p.du && e.au === p.au);
  const proche = (p: { du: string; au: string }) => exemples.some((e) => 2 * joursCommuns(e, p) > Math.min(ecartJours(e.du, e.au), ecartJours(p.du, p.au)) + 1);
  /** Meilleure semaine selon `scores` (alignés sur `candidats`, triés par date) qui ne double pas un exemple. */
  const meilleure = (candidats: string[], scores: number[], prioritaire: (i: number) => boolean = () => true) => {
    const ordre = candidats.map((_, i) => i).filter((i) => scores[i] > 0);
    ordre.sort((a, b) => Number(prioritaire(b)) - Number(prioritaire(a)) || scores[b] - scores[a] || a - b);
    for (const i of ordre) if (!proche(semaine(candidats[i]))) return semaine(candidats[i]);
    return null;
  };

  // La semaine la plus chargée.
  const sommes = sommesFenetres(parJour, debuts);
  let iMax = 0;
  for (let i = 1; i < sommes.length; i++) if (sommes[i] > sommes[iMax]) iMax = i;
  exemples.push({ raison: 'chargee', ...semaine(debuts[iMax]) });

  // Le plus long voyage (à égalité, celui qui a le plus de photos, puis le plus ancien).
  const voyages = new Map<string, { du: string; au: string; n: number }>();
  dossiers.forEach((d, i) => {
    const { du, au } = lus[i];
    if (d.infoParent?.origine !== 'voyage' || !du || !au) return;
    const v = voyages.get(d.chemin[0]);
    if (!v) voyages.set(d.chemin[0], { du, au, n: d.photos.length });
    else Object.assign(v, { du: du < v.du ? du : v.du, au: au > v.au ? au : v.au, n: v.n + d.photos.length });
  });
  const [long] = [...voyages.values()].sort((a, b) => ecartJours(b.du, b.au) - ecartJours(a.du, a.au) || b.n - a.n || a.du.localeCompare(b.du));
  if (long) {
    const p = { du: long.du, au: ecartJours(long.du, long.au) >= JOURS_VOYAGE_MAX ? ajouterJours(long.du, JOURS_VOYAGE_MAX - 1) : long.au };
    if (!identique(p)) exemples.push({ raison: 'voyage', ...p });
  }

  // Une semaine à la maison : d'abord celles où la maison a au moins la moitié des photos, puis le plus de photos à la maison.
  if (domicile) {
    const maison = new Map<string, number>();
    dossiers.forEach((d, i) => {
      if (auDomicile(d, domicile)) for (const [j, n] of lus[i].jours) maison.set(j, (maison.get(j) ?? 0) + n);
    });
    const candidats = [...maison.keys()].sort();
    const aLaMaison = sommesFenetres(maison, candidats);
    const toutes = sommesFenetres(parJour, candidats);
    const p = meilleure(candidats, aLaMaison, (i) => 2 * aLaMaison[i] >= toutes[i]);
    if (p) exemples.push({ raison: 'maison', ...p });
  }

  // La semaine qui contient le plus de très petits dossiers.
  const petits = lus.filter((l, i) => l.du && classeTaille(dossiers[i].photos.length) === 0).map((l) => [...l.jours.keys()].sort());
  if (petits.length) {
    const candidats = [...new Set(petits.flat())].sort();
    const p = meilleure(candidats, dossiersParFenetre(petits, candidats));
    if (p) exemples.push({ raison: 'petits', ...p });
  }

  // La semaine qui commence au début du plus grand dossier daté.
  let grand = -1;
  dossiers.forEach((d, i) => {
    if (!lus[i].du) return;
    if (grand < 0) grand = i;
    else {
      const g = dossiers[grand];
      const ecart = d.photos.length - g.photos.length || lus[grand].du!.localeCompare(lus[i].du!) || g.chemin.join('/').localeCompare(d.chemin.join('/'));
      if (ecart > 0) grand = i;
    }
  });
  if (grand >= 0) {
    const p = semaine(lus[grand].du!);
    if (!proche(p)) exemples.push({ raison: 'grand', ...p });
  }
  return exemples;
}

// ---------------------------------------------------------------------------
// Frise d'une période
// ---------------------------------------------------------------------------

export interface JourFrise {
  jour: string;
  total: number;
  /** Éléments du jour par dossier (indice dans `dossiers`), dans l'ordre des portions. */
  parDossier: { dossier: number; n: number }[];
}

export interface PortionFrise {
  /** Indice dans `dossiers`. */
  dossier: number;
  /** Première et dernière colonne (indice du jour dans la période) où le dossier a des éléments. */
  premier: number;
  dernier: number;
  /** Éléments du dossier dans la période. */
  dansPeriode: number;
  /** Le dossier en entier : éléments, jours du premier au dernier, dates. */
  elements: number;
  jours: number;
  du: string;
  au: string;
  /** Le dossier commence avant la période, ou finit après. */
  coupeAvant: boolean;
  coupeApres: boolean;
}

export interface VoyageFrise {
  /** Nom du dossier du voyage (première partie du chemin). */
  parent: string;
  lieu?: string;
  premier: number;
  dernier: number;
}

export interface FriseTri {
  jours: JourFrise[];
  /** Dossiers présents dans la période, par premier jour, puis dernier jour, puis chemin. */
  portions: PortionFrise[];
  /** Voyages dont des étapes sont dans la période, avec les colonnes qu'elles couvrent. */
  voyages: VoyageFrise[];
}

/**
 * Jours que la frise montre pour un exemple : la période elle-même, élargie à
 * `min` jours au moins (autant de jours avant qu'après, un de plus après si
 * besoin) : un voyage d'un jour se voit avec les jours qui l'entourent.
 */
export function periodeFrise(du: string, au: string, min = JOURS_SEMAINE): { du: string; au: string } {
  const manque = min - (ecartJours(du, au) + 1);
  if (manque <= 0) return { du, au };
  const avant = Math.floor(manque / 2);
  return { du: ajouterJours(du, -avant), au: ajouterJours(au, manque - avant) };
}

/** Ce que montre la frise de `du` à `au` : une colonne par jour, une portion par dossier présent. */
export function colonnesFrise(dossiers: DossierPropose[], dates: Map<string, string | undefined>, du: string, au: string): FriseTri {
  const lus = lire(dossiers, dates);
  const jours = joursEntre(du, au);
  const colonne = new Map(jours.map((j, i) => [j, i]));
  const portions: PortionFrise[] = [];
  lus.forEach((l, i) => {
    let premier = Infinity;
    let dernier = -1;
    let dansPeriode = 0;
    for (const [j, n] of l.jours) {
      const c = colonne.get(j);
      if (c === undefined) continue;
      premier = Math.min(premier, c);
      dernier = Math.max(dernier, c);
      dansPeriode += n;
    }
    if (dernier < 0) return;
    portions.push({
      dossier: i,
      premier,
      dernier,
      dansPeriode,
      elements: dossiers[i].photos.length,
      jours: ecartJours(l.du!, l.au!) + 1,
      du: l.du!,
      au: l.au!,
      coupeAvant: l.du! < du,
      coupeApres: l.au! > au,
    });
  });
  const chemin = (p: PortionFrise) => dossiers[p.dossier].chemin.join('/');
  portions.sort((a, b) => a.premier - b.premier || a.dernier - b.dernier || chemin(a).localeCompare(chemin(b)));

  const colonnes: JourFrise[] = jours.map((jour) => {
    const parDossier = portions.map((p) => ({ dossier: p.dossier, n: lus[p.dossier].jours.get(jour) ?? 0 })).filter((x) => x.n > 0);
    return { jour, total: parDossier.reduce((s, x) => s + x.n, 0), parDossier };
  });

  const voyages = new Map<string, VoyageFrise>();
  for (const p of portions) {
    const d = dossiers[p.dossier];
    if (d.infoParent?.origine !== 'voyage') continue;
    const v = voyages.get(d.chemin[0]);
    if (v) Object.assign(v, { premier: Math.min(v.premier, p.premier), dernier: Math.max(v.dernier, p.dernier) });
    else voyages.set(d.chemin[0], { parent: d.chemin[0], ...(d.infoParent.lieu ? { lieu: d.infoParent.lieu } : {}), premier: p.premier, dernier: p.dernier });
  }
  return { jours: colonnes, portions, voyages: [...voyages.values()].sort((a, b) => a.premier - b.premier || a.parent.localeCompare(b.parent)) };
}

/**
 * Pastilles d'un jour de la frise (une par élément, `max` au plus) : chaque
 * dossier présent en garde au moins une, les autres se répartissent au
 * prorata (plus forts restes). `reste` : éléments non montrés (« +n »).
 */
export function pastillesJour(parDossier: { dossier: number; n: number }[], max = 12): { pastilles: number[]; reste: number } {
  const presents = parDossier.filter((x) => x.n > 0);
  const total = presents.reduce((s, x) => s + x.n, 0);
  if (total <= max) return { pastilles: presents.flatMap((x) => Array<number>(x.n).fill(x.dossier)), reste: 0 };
  if (presents.length >= max) return { pastilles: presents.slice(0, max).map((x) => x.dossier), reste: total - max };
  // Une chacun, puis les places restantes au prorata des éléments au-delà du premier.
  const libres = max - presents.length;
  const auDela = total - presents.length;
  const parts = presents.map((x) => (libres * (x.n - 1)) / auDela);
  const quotas = parts.map((p) => 1 + Math.floor(p));
  let manque = max - quotas.reduce((s, q) => s + q, 0);
  const ordre = parts.map((_, i) => i).sort((a, b) => parts[b] - Math.floor(parts[b]) - (parts[a] - Math.floor(parts[a])) || a - b);
  for (const i of ordre) {
    if (manque <= 0) break;
    quotas[i]++;
    manque--;
  }
  return { pastilles: presents.flatMap((x, i) => Array<number>(quotas[i]).fill(x.dossier)), reste: total - max };
}

/** Dossiers par date (premier jour, puis chemin), les non datés à la fin, avec leur premier et dernier jour. */
export function listeParDate(dossiers: DossierPropose[], dates: Map<string, string | undefined>): { dossier: number; du: string | null; au: string | null }[] {
  const chemin = (i: number) => dossiers[i].chemin.join('/');
  return lire(dossiers, dates)
    .map((l, dossier) => ({ dossier, du: l.du, au: l.au }))
    .sort((a, b) => Number(a.du === null) - Number(b.du === null) || (a.du ?? '').localeCompare(b.du ?? '') || chemin(a.dossier).localeCompare(chemin(b.dossier)));
}
