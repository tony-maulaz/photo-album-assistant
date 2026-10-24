// Outils de sélection de l'étape « Sélection » (SPEC § 6.9) : redondances, piles,
// équilibre, cible. Ils éclairent le choix, sans jamais choisir.

import { nombrePages, type PhotoPage, type ReglagesPages } from './album';
import { distanceHamming } from './phash';

export interface PhotoChoix {
  id: string;
  dossier: string;
  date?: string;
  phash?: string;
  album?: 0 | 1 | 2;
}

/** Minutes depuis l'an 0 d'une date « AAAA-MM-JJTHH:MM:SS » (heure locale, sans fuseau). */
export function minutes(date?: string): number | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) / 60_000;
}

/** Regroupe les éléments reliés (union-find), dans l'ordre de la liste. */
function composantes(ids: string[], liens: [string, string][]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const trouver = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const [a, b] of liens) {
    if (!parent.has(a) || !parent.has(b)) continue;
    const ra = trouver(a);
    const rb = trouver(b);
    if (ra !== rb) parent.set(rb, ra);
  }
  const groupes = new Map<string, string[]>();
  for (const id of ids) {
    const r = trouver(id);
    groupes.set(r, [...(groupes.get(r) ?? []), id]);
  }
  return [...groupes.values()].filter((g) => g.length > 1);
}

/** Paires semblables d'une même sortie : à moins de `fenetre` minutes et à distance ≤ `seuil`. */
function pairesSemblables(photos: PhotoChoix[], seuil: number, fenetre: number): [string, string][] {
  const paires: [string, string][] = [];
  const parDossier = new Map<string, { p: PhotoChoix; t: number }[]>();
  for (const p of photos) {
    const t = minutes(p.date);
    if (t === null || !p.phash) continue;
    parDossier.set(p.dossier, [...(parDossier.get(p.dossier) ?? []), { p, t }]);
  }
  for (const liste of parDossier.values()) {
    liste.sort((a, b) => a.t - b.t);
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length && liste[j].t - liste[i].t <= fenetre; j++) {
        if (distanceHamming(liste[i].p.phash!, liste[j].p.phash!) <= seuil) paires.push([liste[i].p.id, liste[j].p.id]);
      }
    }
  }
  return paires;
}

/**
 * Alerte de redondance (seuils du script 03 : diversité 20, fenêtre 45 min) :
 * groupes de photos RETENUES trop semblables (« 3 photos retenues du même panorama »).
 */
export function redondances(photos: PhotoChoix[], seuil = 20, fenetre = 45): string[][] {
  const retenues = photos.filter((p) => (p.album ?? 0) > 0);
  return composantes(
    retenues.map((p) => p.id),
    pairesSemblables(retenues, seuil, fenetre),
  );
}

/** Piles de photos semblables : scènes de l'étape « Doublons », plus la ressemblance locale. */
export function piles(photos: PhotoChoix[], scenes: string[][] = [], seuil = 20, fenetre = 45): string[][] {
  const liens = pairesSemblables(photos, seuil, fenetre);
  for (const s of scenes) for (let i = 1; i < s.length; i++) liens.push([s[0], s[i]]);
  return composantes(
    photos.map((p) => p.id),
    liens,
  );
}

export interface Equilibre {
  jours: { jour: string; disponibles: number; retenues: number }[];
  sorties: { dossier: string; disponibles: number; retenues: number }[];
}

/** Photos retenues par jour et par sortie, à côté du nombre disponible. */
export function equilibre(photos: PhotoChoix[]): Equilibre {
  const jours = new Map<string, { disponibles: number; retenues: number }>();
  const sorties = new Map<string, { disponibles: number; retenues: number }>();
  for (const p of photos) {
    const retenue = (p.album ?? 0) > 0 ? 1 : 0;
    const jour = p.date?.slice(0, 10) ?? 'sans date';
    const j = jours.get(jour) ?? { disponibles: 0, retenues: 0 };
    j.disponibles++;
    j.retenues += retenue;
    jours.set(jour, j);
    const s = sorties.get(p.dossier) ?? { disponibles: 0, retenues: 0 };
    s.disponibles++;
    s.retenues += retenue;
    sorties.set(p.dossier, s);
  }
  return {
    jours: [...jours].map(([jour, v]) => ({ jour, ...v })).sort((a, b) => a.jour.localeCompare(b.jour)),
    sorties: [...sorties].map(([dossier, v]) => ({ dossier, ...v })),
  };
}

/** Cible, et réglages de l'album qui changent la pagination (valeur par défaut s'ils manquent). */
export interface Cible extends ReglagesPages {
  mode: 'photos' | 'pages';
  nombre: number;
}

export interface Avancement {
  retenues: number;
  grandes: number;
  aDecider: number;
  pages: number;
  /** Ce qui est comparé à la cible : des pages ou des photos (une ★★ vaut une page). */
  valeur: number;
  pourcent: number;
}

/**
 * Jauge de la cible (§ 6.9) : une ★★ occupe une page entière. Les pages sont
 * celles de l'aperçu de l'étape « Album » (`nombrePages` : sections sur une
 * nouvelle page, copies en double comptées une fois).
 */
export function avancement(photos: (PhotoChoix & PhotoPage)[], cible: Cible): Avancement {
  const petites = photos.filter((p) => p.album === 1).length;
  const grandes = photos.filter((p) => p.album === 2).length;
  const aDecider = photos.filter((p) => p.album === undefined).length;
  const pages = nombrePages(photos, cible);
  const valeur = cible.mode === 'pages' ? pages : petites + grandes * cible.photosParPage;
  return { retenues: petites + grandes, grandes, aDecider, pages, valeur, pourcent: cible.nombre > 0 ? (valeur / cible.nombre) * 100 : 0 };
}
