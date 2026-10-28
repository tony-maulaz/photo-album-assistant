// Langue de l'interface (français ou anglais) et traduction des textes.
//
// Les textes restent écrits en français dans le code, marqués par `t` :
//   t`Valider et continuer`
//   t`${nombre(n)} dossiers proposés pour ${nombre(m)} photos`
//   t(libelle)            // libellé d'une table, marqué par aTraduire('…')
// En anglais, `t` cherche la traduction dans `src/traductions/en/` : la clé est
// le texte français, chaque `${…}` y devenant {0}, {1}… dans l'ordre. Le test
// `traductions.test.ts` vérifie que chaque texte marqué a sa traduction.

import { EN } from '../traductions/en';

export type Langue = 'fr' | 'en';

/** Langues proposées, chacune écrite dans sa propre langue. */
export const LANGUES: Record<Langue, string> = { fr: 'Français', en: 'English' };

let courante: Langue = 'fr';
const signales = new Set<string>();

export function langue(): Langue {
  return courante;
}

export function definirLangue(l: Langue): void {
  courante = l;
}

/** Exécute `f` dans la langue `l`, puis revient à celle de l'interface (textes écrits dans la sortie, D60). */
export function avecLangue<T>(l: Langue, f: () => T): T {
  const avant = courante;
  courante = l;
  try {
    return f();
  } finally {
    courante = avant;
  }
}

/** Langue du navigateur, si l'utilisateur n'en a pas choisi : français pour fr-*, anglais sinon. */
export function langueDuNavigateur(langues: readonly string[]): Langue {
  return langues[0]?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Clé d'un texte marqué : le français, avec {0}, {1}… à la place des valeurs. */
export function cleTexte(morceaux: readonly string[]): string {
  return morceaux.reduce((cle, m, i) => (i === 0 ? m : `${cle}{${i - 1}}${m}`), '');
}

/** Texte dans la langue de l'interface (le français si une traduction manque). */
export function t(texte: string | TemplateStringsArray, ...valeurs: unknown[]): string {
  const cle = typeof texte === 'string' ? texte : cleTexte(texte);
  let traduit = cle;
  if (courante === 'en') {
    const en = EN[cle];
    if (en !== undefined) traduit = en;
    else if (!signales.has(cle)) {
      signales.add(cle);
      console.warn(`Traduction manquante : ${cle}`);
    }
  }
  if (!valeurs.length) return traduit;
  return traduit.replace(/\{(\d+)\}/g, (m, i: string) => (Number(i) < valeurs.length ? String(valeurs[Number(i)]) : m));
}

/** Marque un texte à traduire là où il est utilisé (`t(libelle)`), par exemple dans une table de libellés. */
export function aTraduire<T extends string>(texte: T): T {
  return texte;
}
