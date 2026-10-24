// Navigation entre les pages : le bouton « Précédent » du navigateur reste
// dans l'application, « Retour » ramène à la page d'avant, et la page
// regardée est gardée pour un rechargement de l'onglet.

import { effect } from '@preact/signals';
import { garderPageVue, page, session, type Page } from './etat';
import { etapeAReprendre } from './projets';

/** Entrée de l'historique du navigateur : la page, et son rang depuis la première page ouverte dans l'onglet. */
interface EntreeHistorique {
  album: Page;
  rang: number;
}

let demarrage = true;
let depuisHistorique = false;
/** Rang de l'entrée où ce chargement de la page a commencé : « Retour » ne remonte pas plus loin. */
let rangDebut = 0;

function entree(): EntreeHistorique | null {
  const e = history.state as Partial<EntreeHistorique> | null;
  return e && typeof e === 'object' && e.album && typeof e.rang === 'number' ? (e as EntreeHistorique) : null;
}

function memePage(a: Page, b: Page): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function installerNavigation() {
  rangDebut = entree()?.rang ?? 0;
  // Chaque page ouverte devient une entrée de l'historique du navigateur.
  effect(() => {
    const p = page.value;
    const actuelle = entree();
    if (depuisHistorique || (actuelle && memePage(actuelle.album, p))) return;
    try {
      // Au démarrage (reprise du dernier projet), la page remplace l'entrée : « Précédent » ne mène pas à un écran jamais vu.
      if (demarrage || !actuelle) history.replaceState({ album: p, rang: actuelle?.rang ?? 0 } satisfies EntreeHistorique, '');
      else history.pushState({ album: p, rang: actuelle.rang + 1 } satisfies EntreeHistorique, '');
    } catch {
      // Historique indisponible : on navigue seulement avec les boutons de l'application.
    }
  });
  window.addEventListener('popstate', () => {
    const e = entree();
    if (!e) return;
    depuisHistorique = true;
    try {
      // L'écran des autorisations ne sert qu'au démarrage.
      page.value = e.album.nom === 'reprendre' ? { nom: 'accueil' } : e.album;
    } finally {
      depuisHistorique = false;
    }
  });
  // Page regardée gardée pour un rechargement ; oubliée quand le projet est fermé.
  let ouvert = false;
  effect(() => {
    const s = session.value;
    const p = page.value;
    if (s) garderPageVue(s.projet.id, p);
    else if (ouvert) garderPageVue(null, p);
    ouvert = !!s;
  });
}

/** Fin du démarrage : les pages suivantes s'ajoutent à l'historique. */
export function finDemarrage() {
  demarrage = false;
}

/** « Retour » : la page d'avant dans l'application, sinon l'étape à reprendre (ou l'accueil). */
export function revenir() {
  const e = entree();
  if (e && e.rang > rangDebut) {
    history.back();
    return;
  }
  const s = session.value;
  page.value = s ? { nom: 'etape', numero: etapeAReprendre(s.projet) } : { nom: 'accueil' };
}
