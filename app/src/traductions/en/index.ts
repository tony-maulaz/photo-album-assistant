// Traductions anglaises, une table par partie de l'application : la clé est le
// texte français marqué par `t` (src/lib/langue.ts), {0}, {1}… les valeurs.

import { TEXTES as commun } from './commun';
import { TEXTES as composants } from './composants';
import { TEXTES as logique } from './logique';
import { TEXTES as navigateur } from './navigateur';
import { TEXTES as pagesA } from './pagesA';
import { TEXTES as pagesB } from './pagesB';
import { TEXTES as pagesC } from './pagesC';

/** Les tables séparément, pour que le test repère une même phrase traduite de deux façons. */
export const PARTIES = { commun, composants, logique, navigateur, pagesA, pagesB, pagesC };

export const EN: Record<string, string> = Object.assign({}, ...Object.values(PARTIES));
