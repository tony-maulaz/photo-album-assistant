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
