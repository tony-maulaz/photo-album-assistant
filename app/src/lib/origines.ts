// Reprise des projets ouverts avant les badges d'origine (D112) : chaque décision déjà prise reçoit son origine,
// une fois, à l'ouverture du projet ; le plan est ensuite enregistré (règle d'or 7). Ce n'est pas un geste de
// l'utilisateur : rien n'entre dans l'historique d'annulation.
//
// - Floues : une photo gardée ou écartée à la main est « par vous » ; si l'IA avait donné le même avis, c'était
//   « Suivre l'avis de l'IA » (✦) ; une photo écartée par les anciens scripts est « avant ».
// - Doublons : une photo écartée par « Accepter » vient du groupe accepté (l'application, ✓, ou l'IA pour une même
//   scène, ✦) ; un doublon des anciens scripts (`_doublons/`, « …_doublon.jpg ») est « avant » ; une photo gardée
//   volontairement (`protegee`) dans un ancien projet l'a été par un geste de l'utilisateur (choisie avant
//   « Accepter », « Garder aussi », « Tout garder ») : « par vous ». Aujourd'hui, « Accepter » donne aussi `protegee`
//   à une photo que « Choisir avec l'IA » a choisie, avec l'origine `ia` (`accepter`, groupesDoublons.ts) ; ces
//   projets-là ont déjà leur origine et ne sont pas repris. La décision en attente d'un clic (`choixDoublons`)
//   n'est pas encore une décision.

import { avisValide, decisionFlou, estAvant, sortAvis } from './floues';
import { avecOrigine, type FichierPlan, type OrigineDecision, type Plan } from './plan';

/**
 * L'origine que reçoit une photo d'un ancien projet (la même photo, renvoyée telle quelle s'il n'y a rien à reprendre).
 * `copiesExactes` : les photos dont le contenu (l'empreinte) est aussi celui d'une autre ; une photo gardée
 * volontairement y est rangée dans la famille des copies exactes, faute de savoir quel groupe l'a gardée.
 */
export function repriseOrigine(f: FichierPlan, avisIA: Record<string, unknown>, copiesExactes: ReadonlySet<string> = new Set()): FichierPlan {
  let r = f;
  const decision = decisionFlou(r);
  if (decision && !r.origine?.flou) {
    const avis = avisIA[r.id];
    r = avecOrigine(r, 'flou', avisValide(avis) && sortAvis(avis) === decision ? 'ia' : 'vous');
    // Venue du dossier des anciens scripts : « Retirer mon choix » doit la rendre « Écartée avant », pas au réglage.
    if (!r.avant && r.id.split('/').includes('_a_supprimer')) r = { ...r, avant: true };
  } else if (!decision && !r.avant && estAvant(r)) r = { ...r, avant: true };
  for (const cle of ['doublons', 'doublons_exacts'] as const) {
    if (r.origine?.[cle]) continue;
    if (r.statut === 'mis_de_cote' && r.raison === cle) r = avecOrigine(r, cle, doublonAvant(r) ? 'avant' : r.doublon?.source === 'ia' ? 'ia' : 'application');
  }
  // Gardée volontairement : un geste de l'utilisateur, dans la famille de son groupe (copie exacte d'une autre
  // photo, sinon rafale ou même scène) ; rien si l'une des deux familles a déjà son origine.
  if (r.protegee && !r.origine?.doublons && !r.origine?.doublons_exacts) r = avecOrigine(r, copiesExactes.has(r.id) ? 'doublons_exacts' : 'doublons', 'vous');
  return r;
}

/** Reprend l'origine de toutes les décisions du plan, sur place ; renvoie le nombre de photos complétées. */
export function reprendreOrigines(plan: Plan, avisIA: Record<string, unknown>): number {
  // Les empreintes partagées par plusieurs photos : leurs photos gardées volontairement l'ont été parmi des copies exactes.
  const parEmpreinte = new Map<string, string[]>();
  for (const f of plan.fichiers.values()) if (f.categorie === 'photo' && f.empreinte) parEmpreinte.set(f.empreinte, [...(parEmpreinte.get(f.empreinte) ?? []), f.id]);
  const copiesExactes = new Set([...parEmpreinte.values()].filter((ids) => ids.length > 1).flat());
  let n = 0;
  for (const f of [...plan.fichiers.values()]) {
    if (f.categorie !== 'photo') continue;
    const r = repriseOrigine(f, avisIA, copiesExactes);
    if (r !== f) {
      plan.fichiers.set(f.id, r);
      n++;
    }
  }
  return n;
}

/**
 * Venue d'un dossier ou d'un nom des anciens scripts : `_a_supprimer/`, `_doublons/`, `_planches/`, ou une photo
 * marquée « …_doublon.jpg » (son identifiant, le chemin dans la source, garde la marque ; source.ts).
 */
export function venueDesAnciensScripts(f: FichierPlan): boolean {
  return f.id.split('/').some((x) => x === '_a_supprimer' || x === '_doublons' || x === '_planches') || /_doublon\.[^./]+$/i.test(f.id);
}

/**
 * Doublon écarté par les anciens scripts, sans geste depuis : un groupe accepté note toujours la photo gardée à sa
 * place (`doublon`), eux jamais. Une reprise faite avant ce correctif l'a noté « application » : il reste « avant ».
 */
function doublonAvant(f: FichierPlan): boolean {
  const o = f.origine?.doublons;
  return f.statut === 'mis_de_cote' && f.raison === 'doublons' && !f.doublon && o !== 'vous' && o !== 'ia' && venueDesAnciensScripts(f);
}

/** D'où vient l'écart d'une photo de « Mis de côté », pour son badge (D112) ; `decide` faux : une proposition. */
export interface OrigineMisDeCote {
  origine: OrigineDecision;
  decide: boolean;
  /** Écartée pour flou par le réglage, sans décision : il peut encore la faire revenir (en bordure). */
  reglage: boolean;
}

/**
 * Le badge d'une photo de « Mis de côté », et de l'onglet « Écartées » de Doublons : écartée par vous (à la main,
 * ou une décision de flou sans autre origine), par les anciens scripts (« avant » : leurs dossiers `_a_supprimer`,
 * `_doublons`, `_planches` ou la marque « _doublon », sans geste depuis, D112 point 7),
 * par une proposition acceptée (l'application, l'IA) ; ou proposée par le réglage du flou, en bordure, comme à
 * Floues (D112, précisions du 30.10 ; règle d'or 3).
 */
export function origineMisDeCote(f: FichierPlan): OrigineMisDeCote {
  const cle = f.raison === 'floues' ? 'flou' : f.raison === 'doublons' || f.raison === 'doublons_exacts' ? f.raison : undefined;
  const o = cle ? f.origine?.[cle] : undefined;
  const avant = doublonAvant(f) || ((o === 'avant' || o === undefined) && (venueDesAnciensScripts(f) || (cle === 'flou' && (!!f.avant || !f.flou))));
  if (avant) return { origine: 'avant', decide: true, reglage: false };
  if (cle === 'flou' && f.flou !== 'ecartee') return { origine: 'application', decide: false, reglage: true };
  if (o === 'vous' || !cle || (cle === 'flou' && o === undefined)) return { origine: 'vous', decide: true, reglage: false };
  return { origine: o === 'ia' ? 'ia' : 'application', decide: true, reglage: false };
}
