// Traductions anglaises, une table par partie de l'application : la clé est le
// texte français marqué par `t` (src/lib/langue.ts), {0}, {1}… les valeurs.

import { TEXTES as commun } from './commun';
import { TEXTES as composants } from './composants';
import { TEXTES as logique } from './logique';
import { TEXTES as lot_sortie } from './lot_sortie';
import { TEXTES as lot_album } from './lot_album';
import { TEXTES as lot_selection } from './lot_selection';
import { TEXTES as lot_rangement } from './lot_rangement';
import { TEXTES as lot_doublons } from './lot_doublons';
import { TEXTES as lot_accueil } from './lot_accueil';
import { TEXTES as lot_general } from './lot_general';
import { TEXTES as lot_tri } from './lot_tri';
import { TEXTES as lot_noms } from './lot_noms';
import { TEXTES as lot_consolidation } from './lot_consolidation';
import { TEXTES as navigateur } from './navigateur';
import { TEXTES as pagesA } from './pagesA';
import { TEXTES as pagesB } from './pagesB';
import { TEXTES as pagesC } from './pagesC';

/** Les tables séparément, pour que le test repère une même phrase traduite de deux façons. */
export const PARTIES = { commun, composants, logique, navigateur, pagesA, pagesB, pagesC, lot_sortie, lot_album, lot_selection, lot_rangement, lot_doublons, lot_accueil, lot_general, lot_tri, lot_noms, lot_consolidation };

export const EN: Record<string, string> = Object.assign({}, ...Object.values(PARTIES));
