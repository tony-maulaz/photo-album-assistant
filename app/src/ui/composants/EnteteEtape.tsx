// Explication des pages de travail (Lieux et sorties, Sélection) : ouverte
// en haut à la première visite, puis repliée ; le bouton « Aide et outils »,
// au bout de la ligne du titre, la rouvre. Repliée, elle ne prend aucune
// ligne : le panneau des dossiers et les photos ont toute la hauteur.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { planifierEnregistrement, session } from '../etat';
import { TeteEtape } from './Cadre';

/** Choix fait dans la session (ouvrir, replier) ; sinon, ouverte tant que la page n'a pas été vue. */
const choix = signal<Record<string, boolean>>({});

function noterVue(cle: string) {
  const s = session.value;
  if (!s || s.projet.entetes_vus?.includes(cle)) return;
  s.projet.entetes_vus = [...(s.projet.entetes_vus ?? []), cle];
  planifierEnregistrement();
}

function estOuverte(cle: string, ouverte: boolean): boolean {
  return choix.value[cle] ?? (ouverte || !session.value?.projet.entetes_vus?.includes(cle));
}

/** Replie l'explication (par exemple une fois le tri automatique calculé). */
export function replierEntete(cle: string) {
  choix.value = { ...choix.value, [cle]: false };
  noterVue(cle);
}

export function EnteteEtape({
  cle,
  numero,
  titre,
  explication,
  ouverte = false,
  children,
}: {
  /** Identifiant stable de la page (« lieux », « selection »). */
  cle: string;
  numero: number;
  titre: string;
  explication: ComponentChildren;
  /** Ouverte quoi qu'il arrive (sauf si on la replie), par exemple tant que la première action reste à faire. */
  ouverte?: boolean;
  children?: ComponentChildren;
}) {
  // En quittant la page, l'explication compte comme vue : à la visite suivante, elle est repliée.
  useEffect(() => () => noterVue(cle), [cle]);
  if (!estOuverte(cle, ouverte)) return null;
  return (
    <div class="tete-organiser">
      <button type="button" class="doux replier-entete" onClick={() => replierEntete(cle)} aria-expanded="true">
        Replier ▴
      </button>
      <TeteEtape numero={numero} titre={titre}>
        {explication}
      </TeteEtape>
      {children}
    </div>
  );
}

/** Bouton au bout de la ligne du titre, quand l'explication est repliée, avec les signaux à garder en vue. */
export function BoutonAide({ cle, ouverte = false, libelle = 'Aide et outils', pastilles }: { cle: string; ouverte?: boolean; libelle?: string; pastilles?: ComponentChildren }) {
  if (estOuverte(cle, ouverte)) return null;
  return (
    <>
      {pastilles}
      <button type="button" class="doux" onClick={() => (choix.value = { ...choix.value, [cle]: true })} aria-expanded="false">
        {libelle} ▾
      </button>
    </>
  );
}
