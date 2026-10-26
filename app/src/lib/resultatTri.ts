// Résultat du tri automatique (étape « Tri automatique », D103) : les dossiers
// faits par le tri, lus dans le plan (corrections à la main comprises), en
// cartes par sorte — voyage avec ses étapes, sortie, maison — dans l'ordre du
// temps, avec ce qui est mis à part (captures, sans date, vidéos seules) et ce
// qui mérite un coup d'œil (les sorties d'une ou deux photos).

import { enfants, type DossierPlan, type FichierPlan, type Plan } from './plan';
import { nomsSortie } from './sortie';
import { moisDeNom } from './tri';
import { cleNom } from './noms';

export type SorteCarte = 'voyage' | 'sortie' | 'maison';

export interface EtapeCarte {
  id: string;
  nom: string;
  du?: string;
  au?: string;
  fichiers: FichierPlan[];
}

export interface CarteTri {
  /** Dossier montré par la carte (pour un voyage, le dossier parent). */
  id: string;
  sorte: SorteCarte;
  nom: string;
  lieu?: string;
  du?: string;
  au?: string;
  /** Photos et vidéos gardées, sous-dossiers compris, dans l'ordre du temps. */
  fichiers: FichierPlan[];
  /** Voyage : ses étapes (sous-dossiers) ; vide pour un voyage d'un seul dossier. */
  etapes: EtapeCarte[];
}

export interface ResultatTri {
  cartes: CarteTri[];
  captures: FichierPlan[];
  sansDate: FichierPlan[];
  videosSeules: FichierPlan[];
}

/** Une sortie d'une ou deux photos : souvent une photo prise en passant (D103). */
export const PHOTOS_PETITE_SORTIE = 2;

const parDate = (a: FichierPlan, b: FichierPlan) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id);

/**
 * Cartes du résultat. `domicile` : nom du lieu connu « domicile » ; ses
 * sous-dossiers (mois, journées chargées) sont les cartes « à la maison »,
 * ceux d'un autre lieu connu (projet trié avant D103) sont des sorties.
 */
export function resultatTri(plan: Plan, domicile?: string): ResultatTri {
  const gardes = new Map<string, FichierPlan[]>();
  const captures: FichierPlan[] = [];
  for (const f of plan.fichiers.values()) {
    if (f.statut !== 'archive' || f.categorie === 'autre') continue;
    if (f.capture) captures.push(f);
    else gardes.set(f.dossier, [...(gardes.get(f.dossier) ?? []), f]);
  }
  const contenu = (id: string): FichierPlan[] => [...(gardes.get(id) ?? []), ...enfants(plan, id).flatMap((e) => contenu(e.id))];
  const bornes = (fichiers: FichierPlan[]) => {
    const jours = fichiers.map((f) => f.date?.slice(0, 10)).filter((j): j is string => !!j).sort();
    return jours.length ? { du: jours[0], au: jours.at(-1)! } : {};
  };
  const duTri = (d: DossierPlan) => d.origine === 'tri';
  const noms = nomsSortie();
  const estDomicile = (d: DossierPlan) => !!domicile && d.tri?.origine === 'lieu_connu' && cleNom(d.tri.lieu ?? '') === cleNom(domicile);

  const cartes: CarteTri[] = [];
  let sansDate: FichierPlan[] = [];
  let videosSeules: FichierPlan[] = [];
  const carte = (d: DossierPlan, sorte: SorteCarte, etapes: EtapeCarte[] = []) => {
    const fichiers = contenu(d.id).sort(parDate);
    if (fichiers.length) cartes.push({ id: d.id, sorte, nom: d.nom, ...(d.tri?.lieu ? { lieu: d.tri.lieu } : {}), ...bornes(fichiers), fichiers, etapes });
  };
  // Les dossiers du tri qui ne sont pas dans un autre dossier du tri.
  for (const d of plan.dossiers.values()) {
    if (!duTri(d) || (d.parent && plan.dossiers.get(d.parent) && duTri(plan.dossiers.get(d.parent)!))) continue;
    const sous = enfants(plan, d.id);
    if (cleNom(d.nom) === cleNom(noms.sansDate)) sansDate = contenu(d.id).sort(parDate);
    else if (cleNom(d.nom) === cleNom(noms.videosNonClassees)) videosSeules = contenu(d.id).sort(parDate);
    else if (d.tri?.origine === 'voyage')
      carte(
        d,
        'voyage',
        sous.map((e) => ({ id: e.id, nom: e.nom, fichiers: contenu(e.id).sort(parDate) })).filter((e) => e.fichiers.length).map((e) => ({ ...e, ...bornes(e.fichiers) })),
      );
    else if (d.tri?.origine === 'lieu_connu' && sous.length) {
      // Un lieu connu (le domicile) : chacun de ses sous-dossiers est une carte ; ses photos à lui aussi.
      const sorte: SorteCarte = estDomicile(d) ? 'maison' : 'sortie';
      for (const e of sous) carte(e, sorte);
      if (gardes.get(d.id)?.length) cartes.push({ id: d.id, sorte, nom: d.nom, fichiers: [...gardes.get(d.id)!].sort(parDate), etapes: [], ...bornes(gardes.get(d.id)!) });
    } else carte(d, estDomicile(d) ? 'maison' : 'sortie');
  }
  cartes.sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.nom.localeCompare(b.nom));
  return { cartes, captures: captures.sort(parDate), sansDate, videosSeules };
}

/** Sorties d'une ou deux photos, hors voyage. */
export function petitesSorties(r: ResultatTri): CarteTri[] {
  return r.cartes.filter((c) => c.sorte === 'sortie' && c.fichiers.length <= PHOTOS_PETITE_SORTIE);
}

/**
 * Dossier « maison » du même mois qu'une petite sortie, pour l'y mettre :
 * celui du mois (« 08.25 ») de préférence, sinon une carte « maison » qui
 * couvre ce jour. `null` sans domicile ou sans photo à la maison ce mois-là.
 */
export function moisDeLaSortie(r: ResultatTri, c: CarteTri): string | null {
  if (!c.du) return null;
  const maisons = r.cartes.filter((m) => m.sorte === 'maison');
  const nomMois = moisDeNom(c.du.slice(0, 7));
  const duMois = maisons.find((m) => cleNom(m.nom) === cleNom(nomMois));
  if (duMois) return duMois.id;
  return maisons.find((m) => m.du && m.au && m.du <= c.du! && c.du! <= m.au)?.id ?? null;
}

/** Jusqu'à `n` fichiers répartis sur toute la période (le premier, le dernier, et entre les deux). */
export function repartis<T>(liste: T[], n: number): T[] {
  if (liste.length <= n) return liste;
  return Array.from({ length: n }, (_, i) => liste[Math.round((i * (liste.length - 1)) / (n - 1))]);
}
