// Petits dossiers (étape « Petits dossiers », IA3) : portage du script 05 `--fragments`.
// Chaque dossier de moins de 5 photos est montré entre le dossier juste avant
// et juste après lui DANS LE TEMPS, photo à photo, quel que soit l'écart
// (D90 ; le script ne regardait que les voisins à moins de 12 h, triés par
// ressemblance, ce qui ne laissait presque jamais de voisin, et la
// ressemblance ne distinguait pas deux scènes d'une même sortie). Ces deux
// voisins partent avec sa planche, et le modèle dit s'il faut l'y rattacher.
// Sans IA : l'utilisateur décide en voyant les photos et les heures.

import consigneFragment from '../ia/consignes/fragments_consigne.txt?raw';
import consigneSysteme from '../ia/consignes/fragments_systeme.txt?raw';
import { plancheDossier, PLANCHE_05, type DossierInfo } from './consolidation';
import { t } from './langue';
import { cleNom } from './noms';
import { booleen, cleRequete, confiance, coutEstime, jetonsPlanche, normaliserNom, periodeHeures, premierObjet, texteCourt, type BlocContenu, type Estimation, type RequeteIA } from './nommage';
import { distanceHamming } from './phash';
import { cheminDossier, enfants, nePasToucher, RACINE, Transaction, type DossierPlan, type FichierPlan, type Modification, type Plan } from './plan';
import { minutes } from './selection';
import { modele as infoModele } from './tarifs';
import { distanceM, estDossierMois, nomDossierLibre } from './tri';
import { estNomDeSortie } from './sortie';

/**
 * Un dossier de moins de N photos est « petit » (`--seuil-fragment` du
 * script 05) : le même seuil pour le badge du panneau des dossiers, l'alerte
 * de « Lieux et sorties » et l'étape « Petits dossiers ».
 */
export const SEUIL_PETIT_DOSSIER = 5;

export const OPTIONS_FRAGMENTS = {
  /** Un dossier de moins de N photos est un fragment candidat (`--seuil-fragment`). */
  seuilFragment: SEUIL_PETIT_DOSSIER,
  /** Voisins envoyés au modèle : le dossier juste avant et juste après (D90). */
  voisinsIA: 2,
  /** Empreintes comparées par dossier (`phash_dossier`). */
  empreintes: 4,
};

export interface Voisin {
  /** Le dossier voisin, avec ses photos propres (sans celles de ses sous-dossiers). */
  dossier: DossierInfo;
  /** Chemin depuis `Photos/` (« Voyage_…/Etape »). */
  chemin: string;
  /** Le dossier juste avant ou juste après le petit dossier dans le temps. */
  cote: 'avant' | 'apres';
  /** Le petit dossier tombe pendant ce dossier (des photos avant et après lui). */
  pendant: boolean;
  /** Minutes entre la photo du voisin la plus proche et le petit dossier. */
  ecart: number;
  /** Kilomètres entre ces deux photos, quand elles ont une position. */
  distanceKm: number | null;
  /** Ses photos les plus proches du petit dossier dans le temps (4 au plus), dans l'ordre. */
  proches: FichierPlan[];
  /** Le voisin est lui-même un petit dossier. */
  petit: boolean;
  /** Plus petite distance de hachage avec le petit dossier (99 sans empreinte) : indice secondaire, dans la bulle. */
  ressemblance: number;
}

/**
 * Ressemblance en mots, d'après les calibrations (DECISIONS § 2) : ≤ 12 même
 * prise ou presque, ≤ 20 même scène, au-delà des scènes différentes.
 */
export function niveauRessemblance(distance: number): 'tres' | 'oui' | 'peu' | null {
  if (distance >= 99) return null;
  return distance <= 12 ? 'tres' : distance <= 20 ? 'oui' : 'peu';
}

export interface Fragment {
  dossier: DossierInfo;
  /** Le dossier juste avant (ou pendant), puis le dossier juste après, quand ils existent. */
  voisins: Voisin[];
}

/** Plus petite distance de hachage entre deux jeux d'empreintes (script 05) ; 99 si l'un est vide. */
export function ressemblance(h1: string[], h2: string[]): number {
  let min = 99;
  for (const a of h1) for (const b of h2) min = Math.min(min, distanceHamming(a, b));
  return min;
}

/**
 * Dossiers où un petit dossier peut aller (D90) : tous ceux qui ont des photos
 * en propre, avec ces photos par date ; ni la racine, ni les dossiers
 * techniques (« _… », captures, « Sans_lieu »), ni ceux « Ne pas toucher ».
 */
export function dossiersAvecPhotos(plan: Plan): DossierInfo[] {
  const parDossier = new Map<string, FichierPlan[]>();
  for (const f of plan.fichiers.values()) if (f.statut === 'archive' && f.categorie === 'photo') parDossier.set(f.dossier, [...(parDossier.get(f.dossier) ?? []), f]);
  const resultat: DossierInfo[] = [];
  for (const [id, photos] of parDossier) {
    const d = plan.dossiers.get(id);
    if (!d || d.parent === null || d.nom.startsWith('_') || estNomDeSortie('captures', d.nom) || estNomDeSortie('sansLieu', d.nom) || nePasToucher(plan, id)) continue;
    photos.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id));
    const dates = photos.map((p) => p.date).filter((x): x is string => !!x);
    resultat.push({ id, nom: d.nom, photos, du: dates[0], au: dates.at(-1) });
  }
  return resultat;
}

/** Photos d'un dossier les plus proches d'un instant (minutes), remises dans l'ordre. */
function prochesDe(d: DossierInfo, instant: number, n = 4): FichierPlan[] {
  const garde = [...d.photos]
    .filter((p) => minutes(p.date) !== null)
    .sort((a, b) => Math.abs(minutes(a.date)! - instant) - Math.abs(minutes(b.date)! - instant))
    .slice(0, n);
  return d.photos.filter((p) => garde.includes(p));
}

const km = (a?: FichierPlan, b?: FichierPlan) => (a?.gps && b?.gps ? distanceM(a.gps.lat, a.gps.lon, b.gps.lat, b.gps.lon) / 1000 : null);

/**
 * Le dossier juste avant et juste après chaque petit dossier dans le temps
 * (D90), parmi `cibles` (voir `dossiersAvecPhotos`), photo à photo : la photo
 * d'un autre dossier la plus proche avant sa première photo, et après sa
 * dernière, quel que soit l'écart. Un dossier qui a des photos avant ET après
 * lui est celui « pendant » lequel il a été pris ; il prend la place d'avant,
 * et le suivant après lui la place d'après.
 */
export function fragments(petits: DossierInfo[], cibles: DossierInfo[], plan: Plan, empreinte: (f: FichierPlan) => string | undefined, o = OPTIONS_FRAGMENTS): Fragment[] {
  const empreintes = (photos: FichierPlan[]) =>
    photos
      .slice(0, o.empreintes)
      .map(empreinte)
      .filter((h): h is string => !!h);
  return petits.map((it) => {
    const datees = it.photos.filter((p) => minutes(p.date) !== null);
    if (!datees.length) return { dossier: it, voisins: [] };
    const t1 = minutes(datees[0].date)!;
    const t2 = minutes(datees.at(-1)!.date)!;
    let avant: { c: DossierInfo; p: FichierPlan; ecart: number; pendant: boolean } | null = null;
    const apres: { c: DossierInfo; p: FichierPlan; ecart: number }[] = [];
    for (const c of cibles) {
      if (c.id === it.id) continue;
      const tc = c.photos.map((p) => minutes(p.date));
      let iAvant = -1;
      let iApres = -1;
      tc.forEach((x, i) => {
        if (x === null) return;
        if (x < t1 || (x === t1 && iAvant < 0)) iAvant = i;
        if (x > t2 && iApres < 0) iApres = i;
      });
      if (iAvant >= 0) {
        const ecart = t1 - tc[iAvant]!;
        const pendant = iApres >= 0;
        // Pendant une sortie : elle passe devant, même si un autre dossier a une photo un peu plus proche.
        const mieux = !avant || (pendant && !avant.pendant) || (pendant === avant.pendant && (ecart < avant.ecart || (ecart === avant.ecart && c.nom.localeCompare(avant.c.nom) < 0)));
        if (mieux) avant = { c, p: c.photos[iAvant], ecart, pendant };
      }
      if (iApres >= 0) apres.push({ c, p: c.photos[iApres], ecart: tc[iApres]! - t2 });
    }
    apres.sort((a, b) => a.ecart - b.ecart || a.c.nom.localeCompare(b.c.nom));
    const a = avant as { c: DossierInfo; p: FichierPlan; ecart: number; pendant: boolean } | null;
    const ap = apres.find((x) => x.c.id !== a?.c.id);
    const h = empreintes(it.photos);
    const voisin = (c: DossierInfo, p: FichierPlan, ecart: number, cote: 'avant' | 'apres', pendant: boolean): Voisin => {
      const proches = prochesDe(c, cote === 'avant' ? t1 : t2);
      return {
        dossier: c,
        chemin: cheminDossier(plan, c.id),
        cote,
        pendant,
        ecart: Math.round(ecart),
        distanceKm: km(p, cote === 'avant' ? datees[0] : datees.at(-1)),
        proches,
        petit: c.photos.length < o.seuilFragment,
        ressemblance: ressemblance(h, empreintes(proches)),
      };
    };
    const voisins: Voisin[] = [];
    if (a) voisins.push(voisin(a.c, a.p, a.ecart, 'avant', a.pendant));
    if (ap) voisins.push(voisin(ap.c, ap.p, ap.ecart, 'apres', false));
    return { dossier: it, voisins };
  });
}

/** Un dossier évident (D90) : à moins d'1 h et de 10 km. */
export const EVIDENT = { minutes: 60, km: 10 };

/**
 * Dossier évident pour un petit dossier (D90) : le voisin le plus proche,
 * s'il est à moins d'1 h et de 10 km (positions connues), et que ce n'est ni
 * un lieu connu (un arrêt pendant « Maison » n'est justement pas à la maison)
 * ni un dossier de mois. Sinon `null` : l'utilisateur décide.
 */
export function cibleEvidente(f: Fragment, plan: Plan): Voisin | null {
  const v = [...f.voisins].sort((a, b) => a.ecart - b.ecart)[0];
  if (!v || v.ecart > EVIDENT.minutes || v.distanceKm === null || v.distanceKm > EVIDENT.km) return null;
  const d = plan.dossiers.get(v.dossier.id);
  const parent = d?.parent ? plan.dossiers.get(d.parent) : undefined;
  if (!d || d.tri?.origine === 'lieu_connu' || parent?.tri?.origine === 'lieu_connu' || estDossierMois(d.nom)) return null;
  return v;
}

/**
 * Photos d'un voisin pour sa planche : les 6 plus proches dans le temps du
 * fragment (écart au script, qui prenait les 6 premières : sur un grand
 * dossier, elles pouvaient dater de la veille), remises dans l'ordre.
 */
export function photosVoisin(v: DossierInfo, fragment: DossierInfo, max = PLANCHE_05.max): FichierPlan[] {
  const t = minutes(fragment.du);
  if (t === null || v.photos.length <= max) return v.photos.slice(0, max);
  const proches = [...v.photos].sort((a, b) => Math.abs((minutes(a.date) ?? Infinity) - t) - Math.abs((minutes(b.date) ?? Infinity) - t)).slice(0, max);
  return v.photos.filter((p) => proches.includes(p));
}

export function consigneFragmentDossier(f: Fragment, voisinsIA = OPTIONS_FRAGMENTS.voisinsIA): string {
  const candidats = f.voisins
    .slice(0, voisinsIA)
    .map((v) => `- ${v.dossier.nom} (${v.dossier.photos.length} photos, ${periodeHeures(v.dossier.du, v.dossier.au)})`)
    .join('\n');
  return consigneFragment
    .replace('{n}', String(f.dossier.photos.length))
    .replace('{fragment}', f.dossier.nom)
    .replace('{periode_frag}', periodeHeures(f.dossier.du, f.dossier.au))
    .replace('{candidats}', candidats);
}

export const SCHEMA_FRAGMENT = {
  type: 'object',
  properties: {
    absorber: { type: 'boolean' },
    cible: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    nom_propose: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confiance: { type: 'integer' },
    raison: { type: 'string' },
  },
  required: ['absorber', 'cible', 'nom_propose', 'confiance', 'raison'],
  additionalProperties: false,
};

/**
 * Requête d'un fragment (script 05) : sa planche, puis celle de chaque
 * voisin retenu, chacune annoncée par son nom, puis la consigne. `null` si le
 * fragment n'a aucun voisin (laissé tel quel).
 */
export function requeteFragment(f: Fragment, idModele: string, identite: (p: FichierPlan) => string, voisinsIA = OPTIONS_FRAGMENTS.voisinsIA): RequeteIA | null {
  const voisins = f.voisins.slice(0, voisinsIA);
  if (!voisins.length) return null;
  const photosFragment = f.dossier.photos.slice(0, PLANCHE_05.max);
  const contenu: BlocContenu[] = [
    { type: 'texte', texte: `Planche du dossier isolé « ${f.dossier.nom} » :` },
    plancheDossier(photosFragment.map((p) => p.id)),
  ];
  const identites = photosFragment.map(identite);
  for (const v of voisins) {
    const photos = photosVoisin(v.dossier, f.dossier);
    contenu.push({ type: 'texte', texte: `Planche du voisin « ${v.dossier.nom} » :` });
    contenu.push(plancheDossier(photos.map((p) => p.id)));
    identites.push(...photos.map(identite));
  }
  const consigne = consigneFragmentDossier(f, voisinsIA);
  contenu.push({ type: 'texte', texte: consigne });
  return {
    fonction: 'IA3',
    systeme: consigneSysteme,
    contenu,
    schema: SCHEMA_FRAGMENT,
    cle: cleRequete('IA3', idModele, consigne, identites),
    effort: 'medium',
    maxTokens: 16000,
    outils: null,
    estimationUSD: estimationFragments([f], idModele, voisinsIA).usd,
  };
}

export interface DecisionFragment {
  /** Rattacher le fragment au voisin `cible`. */
  absorber: boolean;
  /** Identifiant du voisin désigné (seulement s'il fait partie des voisins envoyés). */
  cible: string | null;
  /** Nom proposé si le fragment reste à part (convention, ou `null`). */
  nomPropose: string | null;
  confiance: number | null;
  raison: string;
}

/**
 * Réponse validée (script 05) : on ne rattache qu'à un voisin réellement
 * envoyé ; un nom de cible inconnu vaut « garder à part » (dans le doute,
 * pas de fusion).
 */
export function lireFragment(v: unknown, f: Fragment, voisinsIA = OPTIONS_FRAGMENTS.voisinsIA): DecisionFragment | null {
  const r = premierObjet(v);
  if (!r) return null;
  const nomCible = texteCourt(r.cible, 200);
  const envoyes = f.voisins.slice(0, voisinsIA).map((x) => x.dossier);
  const cible = nomCible ? (envoyes.find((d) => d.nom === nomCible) ?? envoyes.find((d) => cleNom(d.nom) === cleNom(nomCible))) : undefined;
  const absorber = booleen(r.absorber) && !!cible;
  const nom = absorber ? '' : normaliserNom(texteCourt(r.nom_propose, 200));
  return {
    absorber,
    cible: absorber ? cible!.id : null,
    nomPropose: nom && nom !== f.dossier.nom ? nom : null,
    confiance: confiance(r.confiance),
    raison: texteCourt(r.raison),
  };
}

/**
 * Coût estimé (majorant) : un appel par fragment qui a des voisins, sa
 * planche et celles de ses voisins (au plus 3), 700 jetons de texte, 1500 de
 * sortie.
 */
export function estimationFragments(liste: Fragment[], idModele: string, voisinsIA = OPTIONS_FRAGMENTS.voisinsIA): Estimation {
  const m = infoModele(idModele);
  if (!m) return { appels: 0, images: 0, recherches: 0, usd: 0 };
  let appels = 0;
  let images = 0;
  let entree = 0;
  const planche = (n: number) => jetonsPlanche(Math.max(1, Math.min(PLANCHE_05.max, n)), PLANCHE_05.cellule, PLANCHE_05.colonnes, PLANCHE_05.marge, m.coteImageMax);
  for (const f of liste) {
    const voisins = f.voisins.slice(0, voisinsIA);
    if (!voisins.length) continue;
    appels++;
    images += 1 + voisins.length;
    entree += 700 + planche(f.dossier.photos.length) + voisins.reduce((t, v) => t + planche(v.dossier.photos.length), 0);
  }
  return { appels, images, recherches: 0, usd: coutEstime(idModele, entree, appels, 0) };
}

// ---------------------------------------------------------------------------
// Décisions de l'étape « Petits dossiers » (sans IA)
// ---------------------------------------------------------------------------

export interface Candidat {
  id: string;
  nom: string;
  chemin: string;
  du?: string;
  au?: string;
  /** Minutes entre ses photos et celles du petit dossier (0 s'il a été pris pendant), `null` sans date. */
  ecart: number | null;
  /** Une de ses photos, la plus proche dans le temps. */
  photo?: FichierPlan;
}

/**
 * Dossiers où mettre un petit dossier (« Autre dossier… ») : ceux de
 * `cibles` (voir `dossiersAvecPhotos` : ni dossiers techniques, ni « Ne pas
 * toucher », ni parents sans photos à eux), les plus proches dans le temps
 * d'abord, photo à photo (D90 : la période d'un dossier qui couvre l'année le
 * mettait en tête).
 */
export function candidatsRattachement(plan: Plan, petit: DossierInfo, cibles: DossierInfo[]): Candidat[] {
  const tp = petit.photos.map((p) => minutes(p.date)).filter((x): x is number => x !== null);
  const [t1, t2] = [Math.min(...tp), Math.max(...tp)];
  return cibles
    .filter((c) => c.id !== petit.id)
    .map((c) => {
      let ecart: number | null = null;
      let photo: FichierPlan | undefined;
      for (const p of c.photos) {
        const x = minutes(p.date);
        if (x === null || !tp.length) continue;
        const e = x < t1 ? t1 - x : x > t2 ? x - t2 : 0;
        if (ecart === null || e < ecart) [ecart, photo] = [e, p];
      }
      return { id: c.id, nom: c.nom, chemin: cheminDossier(plan, c.id), du: c.du, au: c.au, ecart, photo };
    })
    .sort((a, b) => (a.ecart ?? Infinity) - (b.ecart ?? Infinity) || a.chemin.localeCompare(b.chemin, 'fr', { numeric: true }));
}

/** Un petit dossier rattaché à un autre depuis l'étape « Petits dossiers » : de quoi l'afficher, et le ressortir. */
export interface FragmentRattache {
  /** Le petit dossier tel qu'il était. */
  dossier: DossierPlan;
  /** Ses fichiers (mis de côté compris), avec leur nom d'alors. */
  fichiers: { id: string; nom: string }[];
  /** Ses sous-dossiers directs. */
  sousDossiers: string[];
  cible: string;
  cibleNom: string;
  du?: string;
  au?: string;
  /** Il avait des sorties voisines (il reste affiché parmi elles). */
  avecVoisins: boolean;
}

/** Note un petit dossier avant de le rattacher à `cible` (`null` si l'un des deux n'existe plus). */
export function noterRattachement(plan: Plan, petit: DossierInfo, cible: string, avecVoisins: boolean): FragmentRattache | null {
  const d = plan.dossiers.get(petit.id);
  const c = plan.dossiers.get(cible);
  if (!d || !c) return null;
  const fichiers = [...plan.fichiers.values()].filter((f) => f.dossier === d.id).map((f) => ({ id: f.id, nom: f.nom }));
  return { dossier: d, fichiers, sousDossiers: enfants(plan, d.id).map((e) => e.id), cible, cibleNom: c.nom, du: petit.du, au: petit.au, avecVoisins };
}

/**
 * Défait un rattachement, même après d'autres changements : le petit dossier
 * revient (même identifiant, même place si son parent existe encore) avec ses
 * fichiers et sous-dossiers restés dans la cible. `null` s'il n'y a rien à
 * ressortir (dossier déjà revenu, ou photos déplacées depuis).
 */
export function ressortirFragment(plan: Plan, r: FragmentRattache): Modification | null {
  if (plan.dossiers.has(r.dossier.id)) return null;
  const fichiers = r.fichiers.filter((x) => plan.fichiers.get(x.id)?.dossier === r.cible);
  const sous = r.sousDossiers.filter((id) => plan.dossiers.get(id)?.parent === r.cible);
  if (!fichiers.length && !sous.length) return null;
  const parent = r.dossier.parent !== null && plan.dossiers.has(r.dossier.parent) ? r.dossier.parent : RACINE;
  const pris = new Set([...plan.dossiers.values()].filter((d) => d.parent === parent).map((d) => cleNom(d.nom)));
  const tx = new Transaction(plan);
  tx.dossier({ ...r.dossier, parent, nom: nomDossierLibre(r.dossier.nom, pris) });
  for (const { id, nom } of fichiers) tx.fichier({ ...plan.fichiers.get(id)!, dossier: r.dossier.id, nom });
  for (const id of sous) tx.dossier({ ...plan.dossiers.get(id)!, parent: r.dossier.id });
  return tx.terminer(t`Ressortir 1 dossier`, t`Ressortir « ${r.dossier.nom} » de « ${r.cibleNom} »`);
}
