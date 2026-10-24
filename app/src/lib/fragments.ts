// Petits dossiers (étape « Petits dossiers », IA3) : portage du script 05 `--fragments`.
// Chaque dossier de moins de 5 photos est comparé à ses voisins DANS LE
// TEMPS (plages à moins de 12 h, au moins 5 photos), classés localement par
// ressemblance ; les 3 premiers partent avec sa planche, et le modèle dit
// s'il faut l'y rattacher. Sans IA : les voisins classés, l'utilisateur décide.

import consigneFragment from '../ia/consignes/fragments_consigne.txt?raw';
import consigneSysteme from '../ia/consignes/fragments_systeme.txt?raw';
import { joursEntre, plancheDossier, PLANCHE_05, type DossierInfo, type GroupeFreres } from './consolidation';
import { t } from './langue';
import { cleNom } from './noms';
import { booleen, cleRequete, confiance, coutEstime, jetonsPlanche, normaliserNom, periodeHeures, premierObjet, texteCourt, type BlocContenu, type Estimation, type RequeteIA } from './nommage';
import { distanceHamming } from './phash';
import { cheminDossier, enfants, estDescendant, RACINE, resumes, Transaction, type DossierPlan, type FichierPlan, type Modification, type Plan } from './plan';
import { minutes } from './selection';
import { modele as infoModele } from './tarifs';
import { nomDossierLibre } from './tri';

/**
 * Un dossier de moins de N photos est « petit » (`--seuil-fragment` du
 * script 05) : le même seuil pour le badge du panneau des dossiers, l'alerte
 * de « Lieux et sorties » et l'étape « Petits dossiers ».
 */
export const SEUIL_PETIT_DOSSIER = 5;

export const OPTIONS_FRAGMENTS = {
  /** Un dossier de moins de N photos est un fragment candidat (`--seuil-fragment`). */
  seuilFragment: SEUIL_PETIT_DOSSIER,
  /** Un dossier est voisin s'il est à moins de N heures du fragment (`--fenetre-heures`). */
  fenetreHeures: 12,
  /** Voisins envoyés au modèle. */
  voisinsIA: 3,
  /** Empreintes comparées par dossier (`phash_dossier`). */
  empreintes: 4,
};

export interface Voisin {
  dossier: DossierInfo;
  /** Plus petite distance de hachage entre les deux jeux d'empreintes (99 sans empreinte) : 0 = identiques. */
  ressemblance: number;
  /**
   * Minutes entre les deux périodes (fin de l'une, début de l'autre) ; 0 si
   * elles se recouvrent (le petit dossier tombe pendant la sortie voisine).
   */
  ecart: number;
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
  /** Tous les voisins temporels, les plus ressemblants d'abord (version sans IA). */
  voisins: Voisin[];
}

/** Plus petite distance de hachage entre deux jeux d'empreintes (script 05) ; 99 si l'un est vide. */
export function ressemblance(h1: string[], h2: string[]): number {
  let min = 99;
  for (const a of h1) for (const b of h2) min = Math.min(min, distanceHamming(a, b));
  return min;
}

/**
 * Fragments d'un répertoire et leurs voisins temporels (script 05) :
 * voisins d'au moins `seuilFragment` photos dont la période touche celle du
 * fragment à `fenetreHeures` près, triés par ressemblance puis par écart.
 */
export function fragments(g: GroupeFreres, empreinte: (f: FichierPlan) => string | undefined, o = OPTIONS_FRAGMENTS): Fragment[] {
  const marge = o.fenetreHeures * 60;
  const empreintes = new Map<string, string[]>();
  const empreintesDe = (d: DossierInfo) => {
    let e = empreintes.get(d.id);
    if (!e) {
      e = d.photos
        .slice(0, o.empreintes)
        .map(empreinte)
        .filter((h): h is string => !!h);
      empreintes.set(d.id, e);
    }
    return e;
  };
  const resultat: Fragment[] = [];
  for (const it of g.dossiers) {
    if (it.photos.length >= o.seuilFragment) continue;
    const [d1, d2] = [minutes(it.du), minutes(it.au)];
    const voisins: Voisin[] = [];
    if (d1 !== null && d2 !== null) {
      for (const v of g.dossiers) {
        if (v === it || v.photos.length < o.seuilFragment) continue;
        const [v1, v2] = [minutes(v.du), minutes(v.au)];
        if (v1 === null || v2 === null || !(v1 - marge <= d2 && v2 + marge >= d1)) continue;
        // Écart entre les périodes, et non entre les premières photos : un arrêt le 21.07 pendant une sortie du 18 au 24.07 est à 0 h.
        voisins.push({ dossier: v, ressemblance: ressemblance(empreintesDe(it), empreintesDe(v)), ecart: Math.max(0, v1 - d2, d1 - v2) });
      }
    }
    voisins.sort((a, b) => a.ressemblance - b.ressemblance || a.ecart - b.ecart);
    resultat.push({ dossier: it, voisins });
  }
  return resultat;
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

/** Petits dossiers d'une même journée (au moins deux), à réunir en un seul : par date. */
export function petitsDuMemeJour(liste: Fragment[]): Fragment[][] {
  const parJour = new Map<string, Fragment[]>();
  for (const f of liste) {
    const jour = f.dossier.du?.slice(0, 10);
    if (!jour || f.dossier.au?.slice(0, 10) !== jour) continue;
    parJour.set(jour, [...(parJour.get(jour) ?? []), f]);
  }
  return [...parJour]
    .filter(([, l]) => l.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, l]) => l);
}

/** Dossier qui reçoit un groupe de petits dossiers réunis : celui qui a le plus de photos (le premier à égalité). */
export function receveur(groupe: Fragment[]): Fragment {
  return groupe.reduce((a, b) => (b.dossier.photos.length > a.dossier.photos.length ? b : a));
}

export interface Candidat {
  id: string;
  nom: string;
  chemin: string;
  du?: string;
  au?: string;
  /** Jours entre ce dossier et le petit dossier (0 s'ils se touchent), `null` sans date. */
  jours: number | null;
}

/**
 * Dossiers où rattacher un petit dossier (« Rattacher à… ») : tous, sauf la
 * racine, lui-même et ses sous-dossiers ; les plus proches dans le temps d'abord.
 */
export function candidatsRattachement(plan: Plan, petit: DossierInfo): Candidat[] {
  const r = resumes(plan);
  const liste: Candidat[] = [];
  for (const d of plan.dossiers.values()) {
    if (d.parent === null || d.id === petit.id || estDescendant(plan, d.id, petit.id)) continue;
    const x = r.get(d.id)!;
    const jours = joursEntre(petit, { id: d.id, nom: d.nom, photos: [], du: x.duTotal, au: x.auTotal });
    liste.push({ id: d.id, nom: d.nom, chemin: cheminDossier(plan, d.id), du: x.duTotal, au: x.auTotal, jours });
  }
  return liste.sort((a, b) => (a.jours ?? Infinity) - (b.jours ?? Infinity) || a.chemin.localeCompare(b.chemin, 'fr', { numeric: true }));
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
  return tx.terminer(t`Ressortir « ${r.dossier.nom} » de « ${r.cibleNom} »`);
}
