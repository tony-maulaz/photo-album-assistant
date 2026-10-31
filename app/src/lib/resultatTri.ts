// Résultat du tri automatique (étape « Tri automatique », D103, D104) : une
// ligne par voyage (avec ses étapes), sortie ou période à la maison, dans
// l'ordre du temps ; ses photos ne se montrent qu'à la demande (bouton « N photos »,
// D112 point 9), d'où leurs identifiants. Avant de ranger, les lignes viennent de
// l'arborescence proposée, recalculée à chaque réglage (aperçu en direct) ;
// après, des dossiers du plan, corrections à la main comprises. À part : les
// captures d'écran, les photos sans date et les vidéos seules.

import type { LieuConnu } from './config';
import { cleNom } from './noms';
import { enfants, type DossierPlan, type FichierPlan, type Plan } from './plan';
import { nomsSortie } from './sortie';
import { distanceM, type DossierPropose } from './tri';

export type SorteLigne = 'voyage' | 'sortie' | 'maison';

export interface EtapeLigne {
  cle: string;
  nom: string;
  /** Nom fait d'un lieu pas encore nommé par OpenStreetMap : l'écran ne le montre pas tel quel. */
  provisoire: boolean;
  du?: string;
  au?: string;
  photos: number;
  /** Photos de l'étape (sans les vidéos), dans l'ordre du temps : le dépliant en montre quelques-unes. */
  ids: string[];
  km?: number;
}

export interface LigneTri {
  cle: string;
  sorte: SorteLigne;
  nom: string;
  /** Chemin du dossier sous Photos/ (« Maison/07.25 »), montré en petit sous le titre lisible (D107). */
  chemin: string;
  /** Lieu du dossier (nom de commune, lieu connu ; pour un voyage, celui de sa plus grande étape). */
  lieu?: string;
  provisoire: boolean;
  du?: string;
  au?: string;
  photos: number;
  videos: number;
  /** Dates des photos et vidéos, pour l'événement du calendrier. */
  dates: string[];
  /** Photos du dossier (sans les vidéos), dans l'ordre du temps : le bouton « N photos » les déplie (D112). */
  ids: string[];
  /** Voyage : ses étapes (sous-dossiers) ; vide pour un voyage d'un seul dossier. */
  etapes: EtapeLigne[];
  /** Distance de la maison (km) : la plus lointaine étape d'un voyage. */
  km?: number;
  /** Événement du calendrier déjà trouvé (arborescence proposée). */
  evenement?: string;
}

export interface ResultatTri {
  lignes: LigneTri[];
  captures: number;
  sansDate: number;
  videosSeules: number;
}

type Fichier = Pick<FichierPlan, 'categorie' | 'date'> & Partial<Pick<FichierPlan, 'statut' | 'gps'>>;

/** Dans l'ordre du temps (sans date : à la fin), puis par identifiant. */
const parMoment = (a: [string, Fichier], b: [string, Fichier]) => (a[1].date ?? '9').localeCompare(b[1].date ?? '9') || a[0].localeCompare(b[0]);

const bornes = (dates: string[]) => {
  const jours = dates.map((d) => d.slice(0, 10)).sort();
  return jours.length ? { du: jours[0], au: jours.at(-1)! } : {};
};

const compter = (fichiers: [string, Fichier | undefined][]) => {
  // Une photo mise de côté (copie, floue) n'est pas rangée : l'aperçu ne la compte pas.
  const f = fichiers.filter((x): x is [string, Fichier] => !!x[1] && x[1].statut !== 'mis_de_cote');
  const photos = f.filter((x) => x[1].categorie === 'photo').sort(parMoment);
  return { photos: photos.length, videos: f.filter((x) => x[1].categorie === 'video').length, dates: f.map((x) => x[1].date).filter((d): d is string => !!d), ids: photos.map((x) => x[0]) };
};

/** Au plus `n` éléments répartis sur toute la liste, le premier et le dernier compris (dépliant d'un dossier). */
export function reparties<T>(liste: T[], n: number): T[] {
  if (liste.length <= n) return liste;
  if (n < 2) return liste.slice(0, Math.max(0, n));
  return Array.from({ length: n }, (_, i) => liste[Math.round((i * (liste.length - 1)) / (n - 1))]);
}

const parDate = (a: { du?: string; nom: string }, b: { du?: string; nom: string }) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.nom.localeCompare(b.nom);

/** Lieu sans nom d'OpenStreetMap (« Lieu_01 »…, donné hors ligne ou avant de ranger). */
const provisoire = (lieu?: string) => !!lieu && new RegExp(`^${nomsSortie().lieu}_\\d{2,}$`).test(lieu);

/** Dossiers d'à côté : `_sans_date`, `_videos_non_classees`. */
function aPart(nom: string): 'sansDate' | 'videos' | null {
  const n = nomsSortie();
  if (cleNom(nom) === cleNom(n.sansDate)) return 'sansDate';
  if (cleNom(nom) === cleNom(n.videosNonClassees)) return 'videos';
  return null;
}

/**
 * Lignes de l'arborescence proposée (aperçu avant de ranger, D104). Les
 * étapes d'un voyage sont réunies sous lui ; `fichier` donne la sorte et la
 * date de chaque élément ; `captures` : celles déjà mises à part.
 */
export function resultatPropose(dossiers: DossierPropose[], fichier: (id: string) => Fichier | undefined, captures = 0): ResultatTri {
  const lignes = new Map<string, LigneTri>();
  let sansDate = 0;
  let videosSeules = 0;
  for (const d of dossiers) {
    const c = compter(d.photos.map((id) => [id, fichier(id)]));
    const cote = aPart(d.chemin[0]);
    if (cote === 'sansDate') sansDate += c.photos + c.videos;
    if (cote === 'videos') videosSeules += c.photos + c.videos;
    if (cote || (!c.photos && !c.videos)) continue;
    const sorte: SorteLigne = d.sorte === 'sans_lieu' ? 'sortie' : d.sorte;
    if (sorte === 'voyage' && d.chemin.length > 1) {
      const cle = d.chemin[0];
      const v = lignes.get(cle) ?? { cle, sorte, nom: cle, chemin: cle, ...(d.infoParent?.lieu ? { lieu: d.infoParent.lieu } : {}), provisoire: false, photos: 0, videos: 0, dates: [], ids: [], etapes: [] };
      v.photos += c.photos;
      v.videos += c.videos;
      v.dates.push(...c.dates);
      v.ids.push(...c.ids);
      v.provisoire = provisoire(d.infoParent?.lieu);
      if (d.km !== undefined) v.km = Math.max(v.km ?? 0, d.km);
      v.etapes.push({ cle: d.chemin.join('/'), nom: d.chemin[1], provisoire: provisoire(d.info.lieu), photos: c.photos + c.videos, ids: c.ids, ...bornes(c.dates), ...(d.km !== undefined ? { km: d.km } : {}) });
      lignes.set(cle, v);
    } else {
      const cle = d.chemin.join('/');
      lignes.set(cle, {
        cle,
        sorte,
        nom: d.chemin.at(-1)!,
        chemin: cle,
        ...(d.info.lieu && d.info.origine !== 'lieu_connu' ? { lieu: d.info.lieu } : {}),
        provisoire: !!d.nomProvisoire,
        ...c,
        etapes: [],
        ...(d.km !== undefined ? { km: d.km } : {}),
        ...(d.evenement ? { evenement: d.evenement } : {}),
      });
    }
  }
  // Les photos d'un voyage à étapes : dans l'ordre de ses étapes (chacune dans l'ordre du temps).
  const resultat = [...lignes.values()].map((l) => {
    const etapes = l.etapes.sort(parDate);
    return { ...l, ...bornes(l.dates), etapes, ...(etapes.length ? { ids: etapes.flatMap((e) => e.ids) } : {}) };
  });
  // Un voyage à étapes : son événement est celui de ses étapes, recalculé à l'écran sur toutes ses dates.
  return { lignes: resultat.sort(parDate), captures, sansDate, videosSeules };
}

/**
 * Lignes des dossiers faits par le tri, lus dans le plan. Les sous-dossiers
 * du domicile (mois, semaines, journées chargées) sont « à la maison » ; ceux
 * d'un autre lieu connu (projet trié avant D103) sont des sorties.
 */
export function resultatDuPlan(plan: Plan, domicile?: LieuConnu): ResultatTri {
  const gardes = new Map<string, FichierPlan[]>();
  let captures = 0;
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre') continue;
    if (f.capture) captures++;
    else gardes.set(f.dossier, [...(gardes.get(f.dossier) ?? []), f]);
  }
  const contenu = (id: string): FichierPlan[] => [...(gardes.get(id) ?? []), ...enfants(plan, id).flatMap((e) => contenu(e.id))];
  const duTri = (d: DossierPlan) => d.origine === 'tri';
  const estDomicile = (d: DossierPlan) => !!domicile && d.tri?.origine === 'lieu_connu' && cleNom(d.tri.lieu ?? '') === cleNom(domicile.nom);
  // Distance du centre du dossier (celui du tri, sinon celui de ses photos situées, pour un voyage d'un seul dossier).
  const km = (d: DossierPlan) => {
    if (!domicile || estDomicile(d)) return undefined;
    let c = d.tri?.lat !== undefined && d.tri.lon !== undefined ? { lat: d.tri.lat, lon: d.tri.lon } : null;
    if (!c) {
      const g = contenu(d.id).filter((f) => f.gps);
      if (g.length) c = { lat: g.reduce((a, f) => a + f.gps!.lat, 0) / g.length, lon: g.reduce((a, f) => a + f.gps!.lon, 0) / g.length };
    }
    return c ? Math.round(distanceM(c.lat, c.lon, domicile.lat, domicile.lon) / 1000) : undefined;
  };

  const lignes: LigneTri[] = [];
  let sansDate = 0;
  let videosSeules = 0;
  const avecId = (fichiers: FichierPlan[]): [string, FichierPlan][] => fichiers.map((f) => [f.id, f]);
  const ligne = (d: DossierPlan, sorte: SorteLigne, fichiers: FichierPlan[], etapes: EtapeLigne[] = []) => {
    const c = compter(avecId(fichiers));
    if (!c.photos && !c.videos) return;
    const k = etapes.some((e) => e.km !== undefined) ? Math.max(...etapes.map((e) => e.km ?? 0)) : km(d);
    const parent = d.parent ? plan.dossiers.get(d.parent) : undefined;
    const chemin = parent && parent.parent !== null ? `${parent.nom}/${d.nom}` : d.nom;
    const lieu = d.tri?.origine !== 'lieu_connu' ? d.tri?.lieu : undefined;
    lignes.push({ cle: d.id, sorte, nom: d.nom, chemin, ...(lieu ? { lieu } : {}), provisoire: false, ...c, ...bornes(c.dates), etapes, ...(k !== undefined && domicile ? { km: k } : {}) });
  };
  for (const d of plan.dossiers.values()) {
    if (!duTri(d) || (d.parent && plan.dossiers.get(d.parent) && duTri(plan.dossiers.get(d.parent)!))) continue;
    const sous = enfants(plan, d.id);
    const cote = aPart(d.nom);
    if (cote === 'sansDate') sansDate += contenu(d.id).length;
    else if (cote === 'videos') videosSeules += contenu(d.id).length;
    else if (d.tri?.origine === 'voyage') {
      const etapes = sous
        .map((e) => {
          const c = compter(avecId(contenu(e.id)));
          const k = km(e);
          return { cle: e.id, nom: e.nom, provisoire: false, photos: c.photos + c.videos, ids: c.ids, ...bornes(c.dates), ...(k !== undefined ? { km: k } : {}) };
        })
        .filter((e) => e.photos)
        .sort(parDate);
      ligne(d, 'voyage', contenu(d.id), etapes);
    } else if (d.tri?.origine === 'lieu_connu' && sous.length) {
      // Un lieu connu (le domicile) : chacun de ses sous-dossiers est une ligne ; ses photos à lui aussi.
      const sorte: SorteLigne = estDomicile(d) ? 'maison' : 'sortie';
      for (const e of sous) ligne(e, sorte, contenu(e.id));
      ligne(d, sorte, gardes.get(d.id) ?? []);
    } else ligne(d, estDomicile(d) ? 'maison' : 'sortie', contenu(d.id));
  }
  return { lignes: lignes.sort(parDate), captures, sansDate, videosSeules };
}

/** Nombre de voyages, de sorties et de périodes à la maison. */
export function compteSortes(r: ResultatTri): Record<SorteLigne, number> {
  const n = { voyage: 0, sortie: 0, maison: 0 };
  for (const l of r.lignes) n[l.sorte]++;
  return n;
}

/** Identité d'une ligne d'un réglage à l'autre : sa sorte et ses dates (les noms changent). */
export const repereLigne = (l: Pick<LigneTri, 'sorte' | 'du' | 'au'>) => `${l.sorte}|${l.du ?? ''}|${l.au ?? ''}`;
