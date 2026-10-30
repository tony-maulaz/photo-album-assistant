// Reprise des projets ouverts avant les badges d'origine (D112) : chaque décision déjà prise reçoit son origine,
// une fois, à l'ouverture du projet ; le plan est ensuite enregistré (règle d'or 7). Ce n'est pas un geste de
// l'utilisateur : rien n'entre dans l'historique d'annulation.
//
// - Floues : une photo gardée ou écartée à la main est « par vous » ; si l'IA avait donné le même avis, c'était
//   « Suivre l'avis de l'IA » (✦) ; une photo écartée par les anciens scripts est « avant ».
// - Doublons : une photo écartée par « Accepter » vient du groupe accepté (l'application, ✓, ou l'IA pour une même
//   scène, ✦) ; une photo gardée volontairement (`protegee`) ne l'est que par un geste de l'utilisateur (choisie
//   avant « Accepter », « Garder aussi », « Tout garder ») : « par vous », comme l'écrit le code d'aujourd'hui ;
//   la décision en attente d'un clic (`choixDoublons`) n'est pas encore une décision.

import { avisValide, decisionFlou, estAvant, sortAvis } from './floues';
import { avecOrigine, type FichierPlan, type Plan } from './plan';

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
    if (r.statut === 'mis_de_cote' && r.raison === cle) r = avecOrigine(r, cle, r.doublon?.source === 'ia' ? 'ia' : 'application');
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
