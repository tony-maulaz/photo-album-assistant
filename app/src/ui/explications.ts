// Explications des pages d'étape (D53, D56) : ouvertes à la première visite,
// puis repliées ; un bouton « Aide » les rouvre. Les pages déjà vues sont
// gardées dans le projet (`entetes_vus`).

import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { planifierEnregistrement, session } from './etat';

/** Choix fait dans la session (ouvrir, replier) ; sinon, ouverte tant que la page n'a pas été vue. */
const choix = signal<Record<string, boolean>>({});

function noterVue(cle: string) {
  const s = session.value;
  if (!s || s.projet.entetes_vus?.includes(cle)) return;
  s.projet.entetes_vus = [...(s.projet.entetes_vus ?? []), cle];
  planifierEnregistrement();
}

export function explicationOuverte(cle: string, ouverte = false): boolean {
  return choix.value[cle] ?? (ouverte || !session.value?.projet.entetes_vus?.includes(cle));
}

export function ouvrirExplication(cle: string, ouverte: boolean) {
  choix.value = { ...choix.value, [cle]: ouverte };
  if (!ouverte) noterVue(cle);
}

/** En quittant la page, son explication compte comme vue : à la visite suivante, elle est repliée. */
export function useExplicationVue(cle: string | undefined) {
  useEffect(() => () => void (cle && noterVue(cle)), [cle]);
}

// --- Cadre commun (lot 4 de la charte, D111, choix 5) ---
// L'Aide d'une page passée au cadre s'ouvre d'elle-même à la première visite à partir de 1440 px de large ;
// en dessous, elle reste fermée et son bouton porte « à lire » jusqu'à la première ouverture. L'étape n'est
// notée « vue » qu'à l'ouverture de l'Aide (les projets existants, déjà dans `entetes_vus`, n'ont pas « à lire »).

/** L'Aide de l'étape a déjà été ouverte (ou l'étape vue avant le cadre commun). */
export function aideVue(cle: string): boolean {
  return !!session.value?.projet.entetes_vus?.includes(cle);
}

/** L'Aide est ouverte : choix de la session, sinon ouverte seule à la première visite à 1440 px et plus. */
export function aideOuverte(cle: string, largeur: number): boolean {
  return choix.value[cle] ?? (!aideVue(cle) && largeur >= 1440);
}

/** Ouvre ou ferme l'Aide d'une page du cadre ; l'ouvrir note l'étape comme vue. */
export function ouvrirAide(cle: string, ouverte: boolean) {
  choix.value = { ...choix.value, [cle]: ouverte };
  if (ouverte) noterVue(cle);
}
