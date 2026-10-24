// Disposition de la grille de photos (SPEC § 5.4) : des lignes de cases de
// même hauteur, avec, si on le demande, un titre avant certains éléments
// (« Samedi 27 juin 2025 ») qui ouvre une nouvelle ligne. Calcul pur, pour la
// grille virtualisée : seules les lignes visibles sont dessinées.

export interface Disposition {
  /** Ligne et colonne de chaque élément. */
  ligne: number[];
  colonne: number[];
  /** Premier élément de chaque ligne, suivi du nombre d'éléments (sentinelle). */
  premier: number[];
  /** Haut de chaque ligne de cases (px). */
  haut: number[];
  /** Titres : premier élément du groupe et haut du titre (px). */
  titres: { debut: number; y: number }[];
  /** Hauteur totale, marges comprises (px). */
  hauteur: number;
}

/**
 * Place `n` éléments sur `colonnes` colonnes ; chaque indice de `debuts`
 * commence une nouvelle ligne, précédée d'un titre de hauteur `titre`.
 */
export function disposer(n: number, colonnes: number, debuts: readonly number[], o: { marge: number; case: number; titre: number }): Disposition {
  const groupes = new Set(debuts);
  const ligne: number[] = new Array(n);
  const colonne: number[] = new Array(n);
  const premier: number[] = [];
  const haut: number[] = [];
  const titres: { debut: number; y: number }[] = [];
  let y = o.marge;
  let c = colonnes;
  for (let i = 0; i < n; i++) {
    const titre = groupes.has(i);
    if (titre || c >= colonnes) {
      // La ligne précédente est finie : la suivante s'ouvre en dessous (après le titre éventuel).
      if (premier.length) y += o.case;
      if (titre) {
        titres.push({ debut: i, y });
        y += o.titre;
      }
      premier.push(i);
      haut.push(y);
      c = 0;
    }
    ligne[i] = premier.length - 1;
    colonne[i] = c++;
  }
  const hauteur = (premier.length ? y + o.case : y) + o.marge;
  premier.push(n);
  return { ligne, colonne, premier, haut, titres, hauteur };
}

/** Éléments des lignes qui touchent la bande verticale [de, a] (px) : de `debut` inclus à `fin` exclu. */
export function elementsVisibles(d: Disposition, de: number, a: number, hauteurCase: number): { debut: number; fin: number } {
  const lignes = d.haut.length;
  if (!lignes) return { debut: 0, fin: 0 };
  // Première ligne dont le bas dépasse `de` (recherche dichotomique, les hauts croissent).
  let bas = 0;
  let h = lignes;
  while (bas < h) {
    const m = (bas + h) >> 1;
    if (d.haut[m] + hauteurCase < de) bas = m + 1;
    else h = m;
  }
  let fin = bas;
  while (fin < lignes && d.haut[fin] <= a) fin++;
  return { debut: d.premier[bas] ?? d.premier[lignes], fin: d.premier[fin] };
}

/** Élément de la ligne au-dessus (`sens` = -1) ou au-dessous (+1), dans la même colonne si elle existe. */
export function voisinVertical(d: Disposition, i: number, sens: -1 | 1): number {
  const l = d.ligne[i] + sens;
  if (l < 0 || l >= d.haut.length) return i;
  return Math.min(d.premier[l] + d.colonne[i], d.premier[l + 1] - 1);
}
