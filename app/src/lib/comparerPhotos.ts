// Comparer les photos d'un groupe de doublons (D99) : netteté et exposition,
// déjà mesurées par l'analyse, gratuites. Les seuils de `signaux()` jugent une
// photo seule (Sélection) ; ici, seul un écart visible entre photos du même
// groupe compte, sinon rien n'est dit. Rien ne déplace la ★ : ces remarques
// expliquent la proposition et aident l'utilisateur à choisir.

import type { Indicateurs } from './indicateurs';
import type { Sorte } from './groupesDoublons';

/** Une remarque au plus par photo, en mots comparatifs. */
export type Remarque = 'plus_nette' | 'plus_sombre' | 'trop_claire' | 'contre_jour';

const aTraduire = <T extends string>(texte: T): T => texte;

/** Libellés affichés (à passer à `t` là où ils sont montrés). */
export const LIBELLES_REMARQUES: Record<Remarque, string> = {
  plus_nette: aTraduire('plus nette'),
  plus_sombre: aTraduire('plus sombre'),
  trop_claire: aTraduire('trop claire (zones blanches)'),
  contre_jour: aTraduire('contre-jour'),
};

/**
 * Seuils d'un écart visible, mesurés sur une année réelle (D99) : à la
 * Doublons, la luminosité d'une rafale ne varie que de 0,5 niveau en médiane.
 * La netteté (variance du laplacien) croît comme le carré du contraste : elle
 * se compare corrigée de l'exposition, et il faut 1,5× pour que ça se voie
 * (2× pour une même scène, dont le cadrage change).
 */
export const SEUILS_COMPARAISON = {
  netteteRafale: 1.5,
  netteteScene: 2,
  sombreNiveaux: 12,
  sombreRelatif: 0.15,
  sombreMax: 100,
  clairesEcart: 0.05,
  clairesMin: 0.1,
  contreJourEcart: 20,
};

export interface Comparaison {
  /** Remarque de chaque photo qui se distingue (les autres n'en ont pas). */
  remarques: Map<string, Remarque>;
  /** La photo nettement plus nette que toutes les autres, s'il y en a une. */
  plusNette?: string;
}

const AUCUNE: Comparaison = { remarques: new Map() };

/** Netteté corrigée de l'exposition : celle qu'aurait la photo à la luminosité de référence. */
function netteteCorrigee(i: Indicateurs, reference: number): number {
  const rapport = i.moyenne > 0 ? reference / i.moyenne : 1;
  return i.nettete * rapport * rapport;
}

/**
 * Compare les photos d'un groupe, écartées comprises (les remarques ne doivent
 * pas changer au clic). Une photo sans mesure : on ne dit rien du groupe.
 */
export function comparerPhotos(photos: { id: string; indicateurs?: Indicateurs }[], sorte: Sorte): Comparaison {
  if (photos.length < 2 || photos.some((p) => !p.indicateurs)) return AUCUNE;
  const s = SEUILS_COMPARAISON;
  const mesures = photos.map((p) => ({ id: p.id, i: p.indicateurs! }));
  const remarques = new Map<string, Remarque>();

  // Exposition : une photo plus sombre ou plus claire que la plus réussie du groupe.
  const plusClaire = Math.max(...mesures.map((m) => m.i.moyenne));
  const moinsBrulee = Math.min(...mesures.map((m) => m.i.claires));
  for (const { id, i } of mesures) {
    const ecart = plusClaire - i.moyenne;
    if (i.claires - moinsBrulee >= s.clairesEcart && i.claires >= s.clairesMin) remarques.set(id, 'trop_claire');
    else if (ecart >= s.sombreNiveaux && ecart >= s.sombreRelatif * plusClaire && i.moyenne < s.sombreMax) remarques.set(id, 'plus_sombre');
  }
  // Contre-jour : seulement dans une rafale (même cadrage), quand une photo l'a et pas l'autre.
  if (sorte === 'rafales') {
    const contraste = (i: Indicateurs) => i.bords - i.centre;
    const moindre = Math.min(...mesures.map((m) => contraste(m.i)));
    for (const { id, i } of mesures)
      if (!remarques.has(id) && i.bords > 170 && contraste(i) > 60 && contraste(i) - moindre >= s.contreJourEcart) remarques.set(id, 'contre_jour');
  }

  // Netteté : la plus nette doit l'être nettement plus que toutes les autres,
  // mesurée telle quelle ET corrigée de l'exposition (le bruit d'une photo
  // sombre ne doit pas la rendre « plus nette »).
  const reference = mesures.reduce((x, m) => x + m.i.moyenne, 0) / mesures.length;
  const seuil = sorte === 'rafales' ? s.netteteRafale : s.netteteScene;
  const devance = (a: (typeof mesures)[number], b: (typeof mesures)[number]) =>
    a.i.nettete >= seuil * b.i.nettete && netteteCorrigee(a.i, reference) >= seuil * netteteCorrigee(b.i, reference);
  const candidate = mesures.reduce((a, b) => (b.i.nettete > a.i.nettete ? b : a));
  const plusNette = candidate.i.nettete > 0 && mesures.every((m) => m === candidate || devance(candidate, m)) ? candidate.id : undefined;
  if (plusNette && !remarques.has(plusNette)) remarques.set(plusNette, 'plus_nette');
  return { remarques, ...(plusNette && { plusNette }) };
}
