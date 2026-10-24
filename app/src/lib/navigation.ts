// Navigation dans l'application : touches communes à toutes les pages
// (annuler, rétablir, liste des raccourcis) et page retrouvée après un
// rechargement de l'onglet.

export type ActionClavier = 'annuler' | 'retablir' | 'raccourcis';

/** Ce qu'il faut d'un événement clavier (testable sans navigateur). */
export interface Touche {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Touche commune à toutes les pages : Ctrl+Z annule, Ctrl+Y ou Ctrl+Maj+Z
 * rétablit, « ? » ouvre la liste des raccourcis. AltGr (Ctrl+Alt sous
 * Windows) sert à taper des caractères : seul « ? » est alors reconnu.
 */
export function actionClavier(e: Touche): ActionClavier | null {
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === '?') return !ctrl || e.altKey ? 'raccourcis' : null;
  if (!ctrl || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (k === 'z') return e.shiftKey ? 'retablir' : 'annuler';
  if (k === 'y' && !e.shiftKey) return 'retablir';
  return null;
}

/** Page affichée, telle qu'on la garde pour la retrouver après un rechargement. */
export interface PageVue {
  nom: string;
  numero?: number;
}

/** Pages qu'on peut retrouver telles quelles (l'accueil, la reprise et la création ont leur propre logique). */
const RETROUVABLES = ['etape', 'ia', 'configuration', 'reglages', 'journal', 'aide'];

/** Texte gardé dans l'onglet : le projet et la page qu'on y regardait. */
export function textePageVue(projet: string, page: PageVue): string {
  return JSON.stringify({ projet, page: page.nom === 'etape' ? { nom: 'etape', numero: page.numero } : { nom: page.nom } });
}

/**
 * Page à rouvrir après un rechargement pour le projet `projet`, ou `null`
 * (rien de gardé, autre projet, texte abîmé, étape hors de 1 à `nbEtapes`).
 */
export function lirePageVue(texte: string | null, projet: string, nbEtapes: number): PageVue | null {
  if (!texte) return null;
  let v: unknown;
  try {
    v = JSON.parse(texte);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const { projet: p, page } = v as { projet?: unknown; page?: { nom?: unknown; numero?: unknown } };
  if (p !== projet || !page || typeof page !== 'object' || typeof page.nom !== 'string' || !RETROUVABLES.includes(page.nom)) return null;
  if (page.nom !== 'etape') return { nom: page.nom };
  const n = page.numero;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= nbEtapes ? { nom: 'etape', numero: n } : null;
}
