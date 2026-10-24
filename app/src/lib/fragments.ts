// Petits dossiers (étape « Petits dossiers », IA3) : portage du script 05 `--fragments`.
// Chaque dossier de moins de 5 photos est comparé à ses voisins DANS LE
// TEMPS (plages à moins de 12 h, au moins 5 photos), classés localement par
// ressemblance ; les 3 premiers partent avec sa planche, et le modèle dit
// s'il faut l'y rattacher. Sans IA : les voisins classés, l'utilisateur décide.

import consigneFragment from '../ia/consignes/fragments_consigne.txt?raw';
import consigneSysteme from '../ia/consignes/fragments_systeme.txt?raw';
import { plancheDossier, PLANCHE_05, type DossierInfo, type GroupeFreres } from './consolidation';
import { cleNom } from './noms';
import { booleen, cleRequete, confiance, coutEstime, jetonsPlanche, normaliserNom, periodeHeures, premierObjet, texteCourt, type BlocContenu, type Estimation, type RequeteIA } from './nommage';
import { distanceHamming } from './phash';
import type { FichierPlan } from './plan';
import { minutes } from './selection';
import { modele as infoModele } from './tarifs';

export const OPTIONS_FRAGMENTS = {
  /** Un dossier de moins de N photos est un fragment candidat (`--seuil-fragment`). */
  seuilFragment: 5,
  /** Un dossier est voisin s'il est à moins de N heures du fragment (`--fenetre-heures`). */
  fenetreHeures: 12,
  /** Voisins envoyés au modèle. */
  voisinsIA: 3,
  /** Empreintes comparées par dossier (`phash_dossier`). */
  empreintes: 4,
};

export interface Voisin {
  dossier: DossierInfo;
  /** Plus petite distance de hachage entre les deux jeux d'empreintes (99 sans empreinte). */
  ressemblance: number;
  /** Écart en minutes entre les premières photos. */
  ecart: number;
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
        voisins.push({ dossier: v, ressemblance: ressemblance(empreintesDe(it), empreintesDe(v)), ecart: Math.abs(v1 - d1) });
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
