// Album (SPEC § 6.10, § 12) : ordre (D8, I2), sections, pages simulées, cible,
// noms numérotés de `Album/`, textes pour ifolor, et synchronisation de `Album/`.

import { recadrageUtile, signatureRecadrage, type Recadrage } from './recadrage';
import { t } from './langue';
import { nomAscii } from './noms';
import type { FichierPlan, Plan } from './plan';

export interface ConfigAlbum {
  /** Jour puis segments d'activité (défaut, I2), ou chronologique strict. */
  ordre: 'segments' | 'chrono';
  photosParPage: number;
  /** Chaque section commence sur une nouvelle page. */
  nouvellePageParSection: boolean;
  /** Un sous-dossier par section dans `Album/`. */
  sousDossiers: boolean;
  /** Titre et introduction par sortie (identifiant de dossier). */
  titres: Record<string, string>;
  intros: Record<string, string>;
  /** Nouvelle section qui commence à cette photo : identifiant → titre. */
  coupures: Record<string, string>;
  /** Blocs rattachés à la section précédente, par leur première photo. */
  rattachements: string[];
  cible: { mode: 'photos' | 'pages'; nombre: number };
  /** Photo de couverture choisie (étape « Album ») : copiée en tête de `Album/`. */
  couverture?: string;
  /** Titre de l'album (pour la couverture), s'il diffère du nom du projet. */
  titre?: string;
}

/** Cible par défaut : un livre photo courant de 24 pages (l'ancienne, 100 pages, ne convenait qu'aux très gros albums). */
export const PAGES_CIBLE_DEFAUT = 24;

export function configAlbumDefaut(): ConfigAlbum {
  return {
    ordre: 'segments',
    photosParPage: 4,
    nouvellePageParSection: true,
    sousDossiers: false,
    titres: {},
    intros: {},
    coupures: {},
    rattachements: [],
    cible: { mode: 'pages', nombre: PAGES_CIBLE_DEFAUT },
  };
}

/** Photos retenues pour l'album (★ ou ★★), dans l'archive, copies en double comprises. */
function retenues(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && !f.capture && (f.album ?? 0) > 0);
}

/** Photos de l'album : retenues (★ ou ★★), dans l'archive, chacune une seule fois (`sansDoubles`). */
export function photosAlbum(plan: Plan): FichierPlan[] {
  return sansDoubles(retenues(plan)).gardees;
}

/** Copies d'une photo déjà dans l'album, retenues une deuxième fois (`sansDoubles`) : laissées hors de l'album. */
export function doublesAlbum(plan: Plan): { id: string; garde: string }[] {
  return sansDoubles(retenues(plan)).retirees;
}

/** Ce qui permet de reconnaître deux copies d'une même photo. */
interface Copie {
  id: string;
  dossier: string;
  date?: string;
  origineDate?: string;
  taille?: number;
  empreinte?: string;
  dims?: { l: number; h: number };
}

/**
 * Deux fichiers sont-ils la même photo ? Même taille en octets et même
 * empreinte ; sans empreinte (calculée seulement pour les candidats aux
 * doublons exacts), même date de prise de vue à la seconde et mêmes dimensions.
 */
function memePhoto(a: Copie, b: Copie): boolean {
  if (!a.taille || a.taille !== b.taille) return false;
  if (a.empreinte && b.empreinte) return a.empreinte === b.empreinte;
  const dateSure = (p: Copie) => !!p.date && p.date.length >= 19 && p.origineDate !== 'fichier';
  return dateSure(a) && dateSure(b) && a.date === b.date && a.dims?.l === b.dims?.l && a.dims?.h === b.dims?.h;
}

/**
 * Copies exactes retenues deux fois (une sélection « Best of » faite de copies
 * reste entière à l'étape « Doublons », D61, et ses photos sont aussi dans le
 * dossier de leur sortie) : la photo n'est mise qu'une fois dans l'album, à sa
 * première place dans l'ordre par journée puis par sortie. Les photos gardées
 * restent dans l'ordre reçu.
 */
export function sansDoubles<T extends Copie>(photos: T[]): { gardees: T[]; retirees: { id: string; garde: string }[] } {
  // Seules des photos de même taille en octets peuvent être des copies : le plus souvent, il n'y en a pas.
  const tailles = new Map<number, number>();
  for (const p of photos) if (p.taille) tailles.set(p.taille, (tailles.get(p.taille) ?? 0) + 1);
  const candidate = (p: T) => (tailles.get(p.taille ?? 0) ?? 0) > 1;
  if (!photos.some(candidate)) return { gardees: photos, retirees: [] };
  const vues = new Map<number, T[]>();
  const retirees: { id: string; garde: string }[] = [];
  for (const p of ordreAlbum(photos)) {
    if (!candidate(p)) continue;
    const memeTaille = vues.get(p.taille!) ?? [];
    const garde = memeTaille.find((g) => memePhoto(g, p));
    if (garde) retirees.push({ id: p.id, garde: garde.id });
    else vues.set(p.taille!, [...memeTaille, p]);
  }
  const ids = new Set(retirees.map((r) => r.id));
  return { gardees: retirees.length ? photos.filter((p) => !ids.has(p.id)) : photos, retirees };
}

/**
 * Ordre de l'album (script 03, D8, incident I2) : les journées se suivent
 * strictement ; dans une journée, les photos d'une même sortie forment un
 * bloc contigu, les blocs suivant l'ordre de leur première photo du jour.
 * Une sortie sur plusieurs jours donne un segment par jour.
 */
export function ordreAlbum<T extends { id: string; dossier: string; date?: string; origineDate?: string }>(photos: T[], ordre: ConfigAlbum['ordre'] = 'segments'): T[] {
  // Une photo sans vraie date (date du fichier seulement) se place à la fin de sa sortie, pas à une fausse date.
  const finDossier = new Map<string, string>();
  for (const p of photos) if (p.origineDate !== 'fichier' && p.date && p.date > (finDossier.get(p.dossier) ?? '')) finDossier.set(p.dossier, p.date);
  const incertaine = (p: T) => p.origineDate === 'fichier' && finDossier.has(p.dossier);
  const cle = (p: T) => (incertaine(p) ? finDossier.get(p.dossier)! : (p.date ?? ''));
  if (ordre === 'chrono') return [...photos].sort((a, b) => cle(a).localeCompare(cle(b)) || Number(incertaine(a)) - Number(incertaine(b)) || a.id.localeCompare(b.id));
  const debutSegment = new Map<string, string>();
  for (const p of photos) {
    const k = `${p.dossier}|${cle(p).slice(0, 10)}`;
    const d = debutSegment.get(k);
    if (d === undefined || cle(p) < d) debutSegment.set(k, cle(p));
  }
  return [...photos].sort(
    (a, b) =>
      cle(a).slice(0, 10).localeCompare(cle(b).slice(0, 10)) ||
      debutSegment.get(`${a.dossier}|${cle(a).slice(0, 10)}`)!.localeCompare(debutSegment.get(`${b.dossier}|${cle(b).slice(0, 10)}`)!) ||
      a.dossier.localeCompare(b.dossier) ||
      cle(a).localeCompare(cle(b)) ||
      Number(incertaine(a)) - Number(incertaine(b)) ||
      a.id.localeCompare(b.id),
  );
}

export interface Section {
  /** Index de la première et de la dernière photo (incluses) dans l'ordre. */
  debut: number;
  fin: number;
  titre: string;
  /** Sortie d'origine (le dossier de la première photo). */
  dossier: string;
  /** La sortie a déjà eu une section plus tôt dans l'album (sortie sur plusieurs jours). */
  suite: boolean;
}

/** Date en fin de nom de dossier (convention JJ.MM.AA, tri automatique AAAA-MM-JJ…), déjà affichée à côté du titre. */
const DATE_FINALE = /[\s_]+(?:\d{4}-\d{2}(?:-\d{2})?|\d{1,2}(?:\.\d{1,2})?(?:-\d{1,2}(?:\.\d{1,2})?)?\.\d{2}(?:\d{2})?)$/;

/**
 * Titre de section tiré d'un nom de dossier : sans la date finale (déjà
 * affichée à côté), soulignés changés en espaces, mots collés séparés
 * (« SpectacleFeu_Chaweng_24.07.26 » → « Spectacle Feu Chaweng »). Une année
 * seule reste (« Valais_Mars_2025 »), comme un nom qui n'est qu'une date.
 */
export function titreDepuisNom(nom: string): string {
  // Deux fois : une période « 2026-07-15_2026-07-20 » finit par deux dates.
  const sansDate = nom.replace(DATE_FINALE, '').replace(DATE_FINALE, '');
  const titre = (/[^\s_]/.test(sansDate) ? sansDate : nom)
    .replace(/_/g, ' ')
    .replace(/(?<=\p{L}\p{Ll})(?=\p{Lu})/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return titre || nom;
}

/** Sections = blocs contigus d'une même sortie, ajustés par coupures et rattachements. */
export function sections(ordre: { id: string; dossier: string }[], titreDossier: (dossier: string) => string, config: ConfigAlbum): Section[] {
  const resultat: Section[] = [];
  const vues = new Set<string>();
  ordre.forEach((p, i) => {
    const precedente = resultat.at(-1);
    const coupure = config.coupures[p.id];
    const changement = !precedente || ordre[i - 1].dossier !== p.dossier;
    if (precedente && !coupure && (!changement || config.rattachements.includes(p.id))) {
      precedente.fin = i;
      return;
    }
    resultat.push({
      debut: i,
      fin: i,
      titre: coupure ?? config.titres[p.dossier] ?? titreDossier(p.dossier),
      dossier: p.dossier,
      suite: !coupure && vues.has(p.dossier),
    });
    vues.add(p.dossier);
  });
  return resultat;
}

export interface Page {
  photos: string[];
  grande: boolean;
  /** Section qui commence sur cette page (index dans la liste des sections). */
  sections: number[];
}

/** Pages simulées : `photosParPage` par page, une ★★ seule sur sa page. */
export function paginer(ordre: { id: string; album?: 0 | 1 | 2 }[], secs: Section[], config: ConfigAlbum): Page[] {
  const pages: Page[] = [];
  let courante: Page | null = null;
  const debuts = new Map(secs.map((s, i) => [s.debut, i]));
  const fermer = () => {
    if (courante && courante.photos.length) pages.push(courante);
    courante = null;
  };
  ordre.forEach((p, i) => {
    const section = debuts.get(i);
    if (section !== undefined && config.nouvellePageParSection) fermer();
    if (p.album === 2) {
      fermer();
      pages.push({ photos: [p.id], grande: true, sections: section !== undefined ? [section] : [] });
      return;
    }
    courante ??= { photos: [], grande: false, sections: [] };
    if (section !== undefined) courante.sections.push(section);
    courante.photos.push(p.id);
    if (courante.photos.length >= Math.max(1, config.photosParPage)) fermer();
  });
  fermer();
  return pages;
}

/** Réglages qui changent la pagination ; ceux qui manquent gardent leur valeur par défaut. */
export type ReglagesPages = Pick<ConfigAlbum, 'photosParPage'> & Partial<Pick<ConfigAlbum, 'ordre' | 'nouvellePageParSection' | 'coupures' | 'rattachements'>>;

/** Ce qu'il faut savoir d'une photo pour la placer dans les pages simulées. */
export type PhotoPage = Copie & { album?: 0 | 1 | 2 };

/**
 * Nombre de pages simulées pour les photos retenues parmi `photos` : le calcul
 * de l'aperçu de l'étape « Album » (sections, ★★ seule sur sa page, copies en
 * double comptées une fois), repris par la jauge de la cible (« Sélection »).
 */
export function nombrePages(photos: PhotoPage[], reglages: ReglagesPages): number {
  const config = { ...configAlbumDefaut(), ...reglages };
  const ordre = ordreAlbum(sansDoubles(photos.filter((p) => (p.album ?? 0) > 0)).gardees, config.ordre);
  return paginer(ordre, sections(ordre, () => '', config), config).length;
}

/** Cible en pages (une cible en photos est ramenée à des pages pleines). */
export function cibleEnPages(config: Pick<ConfigAlbum, 'cible' | 'photosParPage'>): number {
  return config.cible.mode === 'pages' ? config.cible.nombre : Math.ceil(config.cible.nombre / Math.max(1, config.photosParPage));
}

/** Photos par page, au plus. */
export const PHOTOS_PAR_PAGE_MAX = 12;

export interface ConseilCible {
  /** Pages simulées moins pages visées : négatif s'il en manque. */
  ecart: number;
  /** Environ combien de photos retenir de plus (ou retirer) pour atteindre la cible. */
  photos: number;
  /** Photos par page qui atteindraient la cible avec les mêmes photos, s'il y en a. */
  photosParPage?: number;
}

/**
 * Écart à la cible quand il dépasse 10 % (trop ou trop peu de pages), et deux
 * façons de le combler : retenir (ou retirer) des photos, ou changer le nombre
 * de photos par page. `null` si l'album est proche de la cible.
 */
export function conseilCible(photos: PhotoPage[], config: ConfigAlbum): ConseilCible | null {
  const pages = nombrePages(photos, config);
  const cible = cibleEnPages(config);
  const ecart = pages - cible;
  if (Math.abs(ecart) <= cible * 0.1) return null;
  const conseil: ConseilCible = { ecart, photos: Math.abs(ecart) * Math.max(1, config.photosParPage) };
  // Une cible en photos ne dépend pas de la mise en page : seul le nombre de photos compte.
  if (config.cible.mode !== 'pages') return conseil;
  // Moins de photos par page s'il manque des pages, plus s'il y en a trop : le réglage le plus proche qui suffit.
  const pas = ecart < 0 ? -1 : 1;
  for (let n = config.photosParPage + pas; n >= 1 && n <= PHOTOS_PAR_PAGE_MAX; n += pas) {
    const p = nombrePages(photos, { ...config, photosParPage: n });
    if (ecart < 0 ? p >= cible : p <= cible) return { ...conseil, photosParPage: n };
  }
  return conseil;
}

/** Partie de nom de fichier tirée d'un titre : sans espaces ni caractères spéciaux (script 03). */
export function partieNom(titre: string): string {
  return nomAscii(titre).replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'Section';
}

function extension(nom: string): string {
  const i = nom.lastIndexOf('.');
  return i > 0 ? nom.slice(i).toLowerCase() : '.jpg';
}

export interface FichierAlbum {
  id: string;
  /** Chemin dans `Album/`, numéroté pour garder l'ordre à l'import (D7). */
  chemin: string;
  rotation: number;
  /** Recadrage demandé (D62) : la copie est alors réencodée. */
  recadrage?: Recadrage;
  taille: number;
  /** Date de modification de l'original : quand elle change (nouvelle version), la copie est refaite. */
  modifie?: number;
}

/** Noms numérotés « 0001_AAAAMMJJ_Section.jpg », dans l'ordre de l'album. */
export function fichiersAlbum(ordre: FichierPlan[], secs: Section[], config: ConfigAlbum): FichierAlbum[] {
  const sectionDe: number[] = [];
  secs.forEach((s, k) => {
    for (let i = s.debut; i <= s.fin; i++) sectionDe[i] = k;
  });
  return ordre.map((f, i) => {
    const s = secs[sectionDe[i]];
    const jour = (f.date ?? '').slice(0, 10).replace(/-/g, '') || '00000000';
    const nom = `${String(i + 1).padStart(4, '0')}_${jour}_${partieNom(s.titre)}${extension(f.nom)}`;
    const dossier = config.sousDossiers ? `${String(sectionDe[i] + 1).padStart(2, '0')}_${partieNom(s.titre)}/` : '';
    return { id: f.id, chemin: `${dossier}${nom}`, rotation: f.rotation ?? 0, ...(recadrageUtile(f.recadrage) ? { recadrage: f.recadrage } : {}), taille: f.taille, modifie: f.modifie };
  });
}

/**
 * `textes_album.md` : titre de l'album et couverture, puis, section par
 * section, le titre, l'introduction, le plan des pages de l'aperçu (quelles
 * photos sur quelle page, ★★ en pleine page) et les légendes, à reproduire
 * dans ifolor (script 03). `fichiers` : les photos de l'album dans l'ordre,
 * sans la couverture.
 */
export function textesAlbum(titre: string, secs: Section[], fichiers: FichierAlbum[], legendes: Map<string, string>, config: ConfigAlbum, pages: Page[] = [], couverture?: string): string {
  const nom = (f: FichierAlbum) => f.chemin.split('/').pop()!;
  const indexDe = new Map(fichiers.map((f, i) => [f.id, i]));
  const lignes = [
    `# ${t`Textes de l'album — ${titre}`}`,
    '',
    t`Titre de l'album : ${titre}`,
    couverture ? t`Couverture : \`${couverture}\`` : t`Couverture : pas encore choisie (étape « Album »).`,
    '',
    t`Titres de sections, introductions et légendes à recopier dans ifolor.`,
    t`Le titre se place sur la page où commence la photo indiquée.`,
  ];
  if (pages.length) lignes.push(t`Pages de l'aperçu : 0001, 0002… sont les photos du dossier « Album » ; ★★ = une photo seule, en pleine page.`);
  lignes.push('');
  for (const s of secs) {
    lignes.push(`\n## ${s.titre}${s.suite ? t` (suite)` : ''}`);
    const intro = !s.suite ? config.intros[s.dossier] : undefined;
    if (intro) lignes.push(`*${intro}*`);
    lignes.push(`${t`(section démarrant à \`${nom(fichiers[s.debut])}\`)`}\n`);
    // Pages de la section ; une page partagée avec la section voisine n'y montre que les photos de celle-ci.
    pages.forEach((p, j) => {
      const numeros = p.photos
        .map((id) => indexDe.get(id))
        .filter((i): i is number => i !== undefined && i >= s.debut && i <= s.fin)
        .map((i) => String(i + 1).padStart(4, '0'));
      if (numeros.length) lignes.push(p.grande ? t`- Page ${j + 1} : ${numeros[0]} ★★ (pleine page)` : t`- Page ${j + 1} : ${numeros.join(', ')}`);
    });
    const legendees = fichiers.slice(s.debut, s.fin + 1).filter((f) => legendes.get(f.id));
    if (legendees.length && pages.length) lignes.push('', t`Légendes :`);
    for (const f of legendees) lignes.push(t`- \`${nom(f)}\` : ${legendes.get(f.id)}`);
  }
  return `${lignes.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Synchronisation de Album/ : copies dérivées, entièrement gérées par l'application
// ---------------------------------------------------------------------------

/**
 * Ce que l'application a écrit dans `Album/` : chemin → photo, rotation,
 * recadrage (sa signature) et date de modification de l'original copié
 * (absente dans un état d'avant qu'elle soit notée).
 */
export type EtatAlbum = Record<string, { id: string; taille: number; rotation: number; recadrage?: string; modifie?: number }>;

export type ActionAlbum =
  | { type: 'garder'; chemin: string; id: string }
  | { type: 'renommer'; depuis: string; chemin: string; id: string }
  | { type: 'copier'; chemin: string; id: string; rotation: number; recadrage?: Recadrage }
  /** Ancienne copie de l'album qui n'a plus sa place (jamais un fichier de l'utilisateur). */
  | { type: 'retirer'; chemin: string }
  /** La place est occupée par un fichier que l'application n'a pas écrit : on n'y touche pas. */
  | { type: 'conflit'; chemin: string; id: string };

/**
 * Amène `Album/` à l'état voulu : les copies déjà faites sont gardées ou
 * renommées (l'ordre a changé), les anciennes copies devenues inutiles sont
 * retirées pour ne pas se mélanger aux nouvelles dans ifolor (incident I1).
 * Les fichiers que l'application n'a pas écrits ne sont jamais touchés.
 */
export function planifierAlbum(voulus: FichierAlbum[], presents: Map<string, number>, etat: EtatAlbum): ActionAlbum[] {
  const cle = (c: string) => c.normalize('NFC').toLowerCase();
  const presentsCle = new Map([...presents].map(([c, t]) => [cle(c), t]));
  const nos = new Map(Object.entries(etat).filter(([c, e]) => presentsCle.get(cle(c)) === e.taille));
  const voulusCle = new Set(voulus.map((v) => cle(v.chemin)));
  const actions: ActionAlbum[] = [];
  const reutilises = new Set<string>();

  // Copies réutilisables, par photo, rotation et recadrage, faites depuis la même version de l'original.
  const version = (x: { id: string; rotation: number }, recadrage: string | undefined) => `${x.id}|${x.rotation}|${recadrage ?? ''}`;
  const memeOriginal = (e: { modifie?: number }, v: FichierAlbum) => e.modifie === undefined || v.modifie === undefined || e.modifie === v.modifie;
  const parPhoto = new Map<string, string[]>();
  for (const [c, e] of nos) parPhoto.set(version(e, e.recadrage), [...(parPhoto.get(version(e, e.recadrage)) ?? []), c]);

  for (const v of voulus) {
    const voulue = version(v, signatureRecadrage(v.recadrage));
    const e = nos.get(v.chemin) ?? [...nos].find(([c]) => cle(c) === cle(v.chemin))?.[1];
    if (e && version(e, e.recadrage) === voulue && memeOriginal(e, v)) {
      actions.push({ type: 'garder', chemin: v.chemin, id: v.id });
      reutilises.add(cle(v.chemin));
      continue;
    }
    const candidats = (parPhoto.get(voulue) ?? []).filter((c) => !reutilises.has(cle(c)) && !voulusCle.has(cle(c)) && memeOriginal(nos.get(c)!, v));
    if (candidats.length) {
      actions.push({ type: 'renommer', depuis: candidats[0], chemin: v.chemin, id: v.id });
      reutilises.add(cle(candidats[0]));
      continue;
    }
    if (presentsCle.has(cle(v.chemin)) && !nos.has(v.chemin) && ![...nos.keys()].some((c) => cle(c) === cle(v.chemin))) {
      actions.push({ type: 'conflit', chemin: v.chemin, id: v.id });
      continue;
    }
    actions.push({ type: 'copier', chemin: v.chemin, id: v.id, rotation: v.rotation, ...(v.recadrage ? { recadrage: v.recadrage } : {}) });
  }
  // Nos anciennes copies qui ne servent plus, ou dont la place est reprise par une autre photo.
  for (const c of nos.keys()) {
    if (reutilises.has(cle(c))) continue;
    actions.push({ type: 'retirer', chemin: c });
  }
  return actions;
}
