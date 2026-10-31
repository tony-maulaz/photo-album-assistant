// Lieux nommés du projet (fenêtre « Vos lieux » du Tri automatique, D112 point 9) : les lieux connus de la
// configuration où des photos du projet ont été prises, pour les revoir et corriger leur nom (onglet
// « Nommés »). Corriger un nom renomme aussi les dossiers du projet qui portent encore le nom donné par le
// tri (nom automatique) ; ceux que l'utilisateur a renommés gardent le leur. Le plan seul est touché ici ;
// la configuration est écrite par l'interface, qui garde les deux d'accord (annulation comprise).

import type { LieuConnu } from './config';
import { t } from './langue';
import { cleNom } from './noms';
import { Transaction, type DossierPlan, type Modification, type Plan } from './plan';
import { distanceM, nomDossierLibre, sanitize, type PhotoTri } from './tri';

export interface LieuDuProjet {
  lieu: LieuConnu;
  /** Photos du projet prises dans son rayon, dans l'ordre du temps. */
  photos: string[];
  /** Nombre de jours différents où ces photos ont été prises. */
  jours: number;
}

/**
 * Lieux connus où des photos du projet ont été prises (chaque photo au lieu le plus proche dont elle est
 * dans le rayon), la maison toujours, même sans photo : la maison d'abord, puis les lieux les plus visités.
 */
export function lieuxNommesDuProjet(photos: PhotoTri[], lieux: LieuConnu[]): LieuDuProjet[] {
  const parLieu = new Map<string, { ids: [string, string][]; jours: Set<string> }>(lieux.map((l) => [l.id, { ids: [], jours: new Set() }]));
  for (const p of photos) {
    if (!p.gps) continue;
    let proche: { l: LieuConnu; d: number } | null = null;
    for (const l of lieux) {
      const d = distanceM(p.gps.lat, p.gps.lon, l.lat, l.lon);
      if (d <= l.rayon_m && (!proche || d < proche.d)) proche = { l, d };
    }
    if (!proche) continue;
    const x = parLieu.get(proche.l.id)!;
    x.ids.push([p.date ?? '9', p.id]);
    if (p.date) x.jours.add(p.date.slice(0, 10));
  }
  return lieux
    .map((lieu) => {
      const x = parLieu.get(lieu.id)!;
      return { lieu, photos: x.ids.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).map((y) => y[1]), jours: x.jours.size };
    })
    .filter((x) => x.photos.length || x.lieu.domicile)
    .sort((a, b) => Number(b.lieu.domicile) - Number(a.lieu.domicile) || b.jours - a.jours || b.photos.length - a.photos.length);
}

/** Un dossier d'un tri éloigné de plus de cette distance n'est pas celui du lieu, même s'il porte son nom (une commune homonyme). */
const PRES_DU_LIEU_M = 5000;

/** Le nom du dossier est encore celui que le tri a donné (`tri.nom`). */
const automatique = (d: DossierPlan) => d.tri?.nom !== undefined && d.nom === d.tri.nom;

/** `nom` où la suite de mots `ancien` (séparés par « _ ») est remplacée par `nouveau` ; `null` si elle n'y est pas. */
function remplacerMots(nom: string, ancien: string, nouveau: string): string | null {
  const mots = nom.split('_');
  const a = ancien.split('_').map(cleNom);
  for (let i = 0; i + a.length <= mots.length; i++) {
    if (a.every((m, k) => cleNom(mots[i + k]) === m)) return [...mots.slice(0, i), ...nouveau.split('_'), ...mots.slice(i + a.length)].join('_');
  }
  return null;
}

/**
 * Dossiers du tri formés autour du lieu `lieu` : ceux d'un lieu connu qui porte son nom, et ceux d'une sortie ou
 * d'une étape nommées d'après lui (à moins de 5 km) ; le dossier d'un voyage dont une étape en est. `renommes` :
 * ceux dont le nom a été changé à la main (ils le gardent) ; `automatiques` : ceux qui portent encore le nom du
 * tri et le prendront.
 */
export function dossiersDuLieu(plan: Plan, lieu: LieuConnu): { automatiques: DossierPlan[]; renommes: DossierPlan[]; touches: DossierPlan[] } {
  const noms = new Set([cleNom(lieu.nom), cleNom(sanitize(lieu.nom))]);
  const proche = (d: DossierPlan) => d.tri?.lat !== undefined && d.tri.lon !== undefined && distanceM(d.tri.lat, d.tri.lon, lieu.lat, lieu.lon) <= PRES_DU_LIEU_M;
  const duLieu = (d: DossierPlan) => d.origine === 'tri' && !!d.tri?.lieu && noms.has(cleNom(d.tri.lieu)) && (d.tri.origine === 'lieu_connu' || proche(d));
  const touches = [...plan.dossiers.values()].filter(duLieu);
  // Un voyage porte le nom de sa plus grande étape, sans position : il en est si l'une de ses étapes en est.
  const ids = new Set(touches.map((d) => d.id));
  for (const d of plan.dossiers.values()) {
    if (d.origine === 'tri' && d.tri?.origine === 'voyage' && d.tri.lieu && noms.has(cleNom(d.tri.lieu)) && [...ids].some((id) => plan.dossiers.get(id)?.parent === d.id)) touches.push(d);
  }
  const mot = sanitize(lieu.nom);
  return {
    touches,
    automatiques: touches.filter((d) => automatique(d) && remplacerMots(d.nom, mot, mot) !== null),
    renommes: touches.filter((d) => !automatique(d)),
  };
}

/**
 * Corrige le nom d'un lieu dans le plan (D112 point 9) : les dossiers qui portent encore le nom automatique le
 * prennent (« Chez_Mamie_12.03.25 » devient « Chez_Mamie_et_Papi_12.03.25 », sans collision avec un voisin) ;
 * tous les dossiers du lieu le gardent en mémoire (`tri.lieu`), pour que la maison reste reconnue. Annulable.
 */
export function renommerLieu(plan: Plan, lieu: LieuConnu, nouveau: string): Modification | null {
  const ancienMot = sanitize(lieu.nom);
  const nouveauMot = sanitize(nouveau);
  const { touches } = dossiersDuLieu(plan, lieu);
  const tx = new Transaction(plan);
  for (const d of touches) {
    const tri = d.tri!;
    const lieuDit = tri.lieu === lieu.nom ? nouveau : nouveauMot;
    const remplace = automatique(d) ? remplacerMots(d.nom, ancienMot, nouveauMot) : null;
    if (!remplace) {
      tx.dossier({ ...d, tri: { ...tri, lieu: lieuDit } });
      continue;
    }
    const voisins = new Set([...plan.dossiers.values()].filter((x) => x.parent === d.parent && x.id !== d.id).map((x) => cleNom(x.nom)));
    const nom = nomDossierLibre(remplace, voisins);
    tx.dossier({ ...d, nom, tri: { ...tri, lieu: lieuDit, nom } });
  }
  return tx.terminer(t`Corriger le nom d’un lieu`, t`Renommer le lieu « ${lieu.nom} » en « ${nouveau} »`);
}
