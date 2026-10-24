// Explication des pages de travail (Lieux et sorties, Sélection) : ouverte
// en haut à la première visite, puis repliée ; le bouton « Aide et outils »,
// au bout de la ligne du titre, la rouvre. Repliée, elle ne prend aucune
// ligne : le panneau des dossiers et les photos ont toute la hauteur.

import type { ComponentChildren } from 'preact';
import { explicationOuverte, ouvrirExplication, useExplicationVue } from '../explications';
import { TeteEtape } from './Cadre';
import { Icone } from './Icones';

/** Replie l'explication d'une page. */
export function replierEntete(cle: string) {
  ouvrirExplication(cle, false);
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
  useExplicationVue(cle);
  if (!explicationOuverte(cle, ouverte)) return null;
  return (
    <div class="tete-organiser">
      <button type="button" class="bouton-aide replier-entete" onClick={() => replierEntete(cle)} aria-expanded="true">
        <Icone nom="aide" taille={16} />
        Replier
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
  if (explicationOuverte(cle, ouverte)) return null;
  return (
    <>
      {pastilles}
      <button type="button" class="bouton-aide" onClick={() => ouvrirExplication(cle, true)} aria-expanded="false" title="Afficher l’explication de l’étape">
        <Icone nom="aide" taille={16} />
        {libelle}
      </button>
    </>
  );
}
