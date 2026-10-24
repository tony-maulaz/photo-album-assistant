// Album (SPEC § 6.10, § 12) : ordre (D8, I2), sections, pages simulées, noms
// numérotés de `Album/`, textes pour ifolor, et synchronisation de `Album/`.

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
}

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
    cible: { mode: 'pages', nombre: 100 },
  };
}

/** Photos de l'album : retenues (★ ou ★★), dans l'archive. */
export function photosAlbum(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && !f.capture && (f.album ?? 0) > 0);
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

/** `textes_album.md` : titres, introductions et légendes à recopier dans ifolor (script 03). */
export function textesAlbum(nomProjet: string, secs: Section[], fichiers: FichierAlbum[], legendes: Map<string, string>, config: ConfigAlbum): string {
  const lignes = [
    `# ${t`Textes de l'album — ${nomProjet}`}`,
    '',
    t`Titres de sections, introductions et légendes à recopier dans ifolor.`,
    t`Le titre se place sur la page où commence la photo indiquée.`,
    '',
  ];
  for (const s of secs) {
    const premier = fichiers[s.debut];
    lignes.push(`\n## ${s.titre}${s.suite ? t` (suite)` : ''}`);
    const intro = !s.suite ? config.intros[s.dossier] : undefined;
    if (intro) lignes.push(`*${intro}*`);
    lignes.push(`${t`(section démarrant à \`${premier.chemin.split('/').pop()}\`)`}\n`);
    for (let i = s.debut; i <= s.fin; i++) {
      const legende = legendes.get(fichiers[i].id);
      if (legende) lignes.push(t`- \`${fichiers[i].chemin.split('/').pop()}\` : ${legende}`);
    }
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
