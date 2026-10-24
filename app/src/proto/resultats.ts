// Résultats des essais, conservés dans le navigateur (par origine : file:// et
// http://localhost sont distincts) et exportables pour le rapport.

import { ecrireLocal, lireLocal } from '../navigateur/stockage';
import type { Statut } from './ui';

export interface Mesure {
  statut: Statut;
  texte: string;
  valeur?: unknown;
  quand: string;
}

type Points = Record<string, Record<string, Mesure>>;

const CLE = 'proto0:resultats';

function charger(): Points {
  try {
    return JSON.parse(lireLocal(CLE) ?? '{}') as Points;
  } catch {
    return {};
  }
}

let points: Points = charger();
const abonnes: (() => void)[] = [];

/** Enregistre le résultat `cle` du point `point` (a à h) et prévient l'affichage. */
export function noter(point: string, cle: string, statut: Statut, texte: string, valeur?: unknown) {
  (points[point] ??= {})[cle] = { statut, texte, valeur, quand: new Date().toISOString() };
  ecrireLocal(CLE, JSON.stringify(points));
  for (const f of abonnes) f();
}

export function surChangement(f: () => void) {
  abonnes.push(f);
}

export function tousLesPoints(): Points {
  return points;
}

export function effacer() {
  points = {};
  ecrireLocal(CLE, null);
  for (const f of abonnes) f();
}

export function exporter(): string {
  return JSON.stringify(
    {
      page: 'Album photos — prototype phase 0',
      protocole: location.protocol,
      origine: location.origin,
      navigateur: navigator.userAgent,
      date: new Date().toISOString(),
      points,
    },
    null,
    1,
  );
}
