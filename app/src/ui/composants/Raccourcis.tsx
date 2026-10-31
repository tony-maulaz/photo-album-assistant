// Raccourcis clavier communs à toutes les pages : Ctrl+Z annule, Ctrl+Y (ou
// Ctrl+Maj+Z) rétablit, Origine remonte en haut de la page (barre du projet,
// onglets), « ? » affiche la liste des raccourcis. Un seul
// gestionnaire, posé avant tous les autres : les pages qui écoutaient déjà
// Ctrl+Z ne le reçoivent plus, rien n'est donc annulé deux fois.

import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import { actionClavier } from '../../lib/navigation';
import { CODES_ETAPES, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { page, session } from '../etat';
import { annulerIci, retablirIci } from './CadreCommun';

/** Liste des raccourcis affichée. */
export const raccourcisOuverts = signal(false);

/** Champ où l'on tape (Ctrl+Z y annule la frappe) ; une case à cocher ou un curseur n'en sont pas. */
function estChampDeSaisie(cible: EventTarget | null): boolean {
  const el = cible as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file'].includes(el.type);
  return el.isContentEditable || ['TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Une fenêtre (dialogue, visionneuse, tri rapide…) a la main sur le clavier ; celles marquées
 * `data-annulable` (comparateur) laissent passer Ctrl+Z et Ctrl+Y, mais pas « ? » : la liste des
 * raccourcis s'ouvrirait par-dessus une vue qui écoute encore le clavier.
 */
function fenetreOuverte(action: string): boolean {
  return !!document.querySelector(action === 'raccourcis' ? '[role="dialog"]' : '[role="dialog"]:not([data-annulable])');
}

/**
 * Gestionnaire unique, en phase de capture sur `window` : il passe avant ceux
 * des pages et des fenêtres. Hors champ de saisie et hors fenêtre ouverte, il
 * traite Ctrl+Z / Ctrl+Y et arrête la touche (les pages ne la voient pas).
 */
export function installerRaccourcis() {
  window.addEventListener(
    'keydown',
    (e) => {
      // Origine : la barre du projet, la frise et les onglets sont partis avec la page (forme E, D112) ; la touche
      // les ramène, sauf dans un champ, un curseur ou une liste qui s'en sert (son premier élément).
      if (e.key === 'Home' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !e.defaultPrevented) {
        const cible = e.target as HTMLElement | null;
        if (cible?.closest?.('input, select, textarea, [contenteditable="true"], [role="menu"], [role="listbox"]')) return;
        if (document.querySelector('[role="dialog"], .comparateur, .visionneuse, .tri-rapide, .recadreur')) return;
        window.scrollTo(0, 0);
        e.preventDefault();
        return;
      }
      const action = actionClavier(e);
      if (!action || e.defaultPrevented || estChampDeSaisie(e.target) || fenetreOuverte(action)) return;
      if (action === 'raccourcis') raccourcisOuverts.value = true;
      else {
        const s = session.value;
        // Sur les pages d'étape seulement : ailleurs, rien de ce qu'on voit ne changerait.
        if (page.value.nom !== 'etape' || !s) return;
        // La règle de ↶ ↷ de la ligne de l'étape (choix 6 A, sur les 13 étapes) : rien d'une autre étape.
        if (action === 'annuler') annulerIci();
        else retablirIci();
      }
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
}

/** Touche, effet (texte à traduire) ; la touche n'est traduite que si elle contient des mots (« Échap »). */
type Ligne = [touche: string, effet: string, toucheTraduite: boolean];

const L = (touche: string, effet: string): Ligne => [touche, effet, false];
const LT = (touche: string, effet: string): Ligne => [touche, effet, true];

const COMMUNS: Ligne[] = [
  L('Ctrl+Z', aTraduire('Annuler la dernière modification (pages des étapes)')),
  LT(aTraduire('Ctrl+Y ou Ctrl+Maj+Z'), aTraduire('Rétablir ce qui a été annulé')),
  LT(aTraduire('Origine'), aTraduire('Revenir en haut de la page : frise des étapes, budget de l’IA, onglets')),
  L('?', aTraduire('Afficher cette liste')),
  LT(aTraduire('Échap'), aTraduire('Fermer une fenêtre, désélectionner')),
];

const GRILLE: Ligne[] = [
  LT(aTraduire('Clic, Ctrl+clic, Maj+clic'), aTraduire('Sélectionner une photo, en ajouter une, une plage')),
  L('← → ↑ ↓', aTraduire('Passer d’une photo à l’autre (avec Maj : étendre la sélection)')),
];

/** Raccourcis propres à certaines étapes (les autres n'en ont pas). */
const PAR_ETAPE: Partial<Record<CodeEtape, Ligne[]>> = {
  // Badges (D112) : G et X décident « par vous », Suppr rend la photo à la proposition ; un clic sur la bande fait l'autre sort.
  floues: [
    ...GRILLE,
    LT(aTraduire('G ou S'), aTraduire('Garder les photos choisies (par vous : le réglage n’y touche plus)')),
    L('X', aTraduire('Écarter les photos choisies (par vous)')),
    LT(aTraduire('Retour arrière ou Suppr'), aTraduire('Retirer mon choix : la photo revient à la proposition')),
    LT(aTraduire('Clic sur la bande'), aTraduire('L’autre sort, décidé par vous ; un second clic revient à la proposition')),
    L('Ctrl+A', aTraduire('Tout sélectionner')),
    LT(aTraduire('Entrée'), aTraduire('Voir la photo en grand (← → : la suivante)')),
  ],
  // Tri automatique (D112 point 9) : le bouton « N photos », l'icône calendrier et la fenêtre « Vos lieux ».
  tri: [
    LT(aTraduire('Tab puis Entrée'), aTraduire('Sur « N photos » : déplier quelques photos du dossier ; sur l’icône calendrier : garder ses événements ouverts')),
    LT(aTraduire('Échap'), aTraduire('Fermer la bulle du calendrier, la vue en grand ou la fenêtre « Vos lieux »')),
    LT(aTraduire('Entrée dans « Nom »'), aTraduire('Enregistrer le nom d’un lieu (« Vos lieux »)')),
  ],
  lieux: [
    ...GRILLE,
    L('Ctrl+A', aTraduire('Tout sélectionner')),
    L('M', aTraduire('Déplacer la sélection vers un dossier')),
    LT(aTraduire('1 à 9'), aTraduire('Déplacer vers un des derniers dossiers utilisés')),
    LT(aTraduire('Suppr'), aTraduire('Écarter (dans « Mis de côté » : remettre)')),
    L('F2', aTraduire('Renommer le dossier affiché')),
    // Menu « … » (D112 point 10, C-4.14).
    LT(aTraduire('Maj+F10 ou clic droit'), aTraduire('Menu « … » du dossier : renommer, réunir, mettre dans un autre dossier, retirer s’il est vide')),
    LT(aTraduire('Entrée'), aTraduire('Voir la photo en grand (← → : la suivante)')),
  ],
  // Petits dossiers (D90 ; D112 point 10 : renommer, menu « … »).
  petits: [
    L('← →', aTraduire('Mettre le petit dossier avec le dossier d’avant, d’après')),
    L('G', aTraduire('Le garder seul')),
    LT(aTraduire('J et K'), aTraduire('Petit dossier suivant, précédent')),
    L('F2', aTraduire('Renommer le petit dossier affiché')),
    LT(aTraduire('Maj+F10'), aTraduire('Menu « … » du petit dossier : renommer, réunir avec un autre dossier')),
  ],
  doublons: [
    LT(aTraduire('J et K (ou ↓ ↑)'), aTraduire('Groupe suivant, groupe précédent')),
    L('← →', aTraduire('Passer d’une photo du groupe à l’autre')),
    LT(aTraduire('Espace'), aTraduire('Garder ou écarter la photo')),
    L('G', aTraduire('Garder la photo (par vous)')),
    L('X', aTraduire('Écarter la photo (par vous)')),
    L('Ctrl+A', aTraduire('Choisir toutes les photos du groupe, par vous (« Accepter » les garde ; groupe déjà accepté : tout de suite)')),
    LT(aTraduire('Clic sur la bande'), aTraduire('L’autre sort, décidé par vous ; un second clic revient à la proposition')),
    L('A', aTraduire('Accepter la proposition du groupe (sur le dernier groupe : la suite s’ouvre)')),
    L('C', aTraduire('Comparer le groupe en grand (↑ ↓ : photo, ← → : autre groupe, Entrée : côte à côte ou une à la fois)')),
    LT(aTraduire('N et P'), aTraduire('Journée (ou dossier) suivante, précédente')),
  ],
  selection: [
    ...GRILLE,
    LT(aTraduire('Espace ou 1'), aTraduire('★ dans l’album')),
    L('2', aTraduire('★★ grande photo')),
    L('X', aTraduire('Pas pour l’album (elle reste dans l’archive)')),
    LT(aTraduire('Suppr'), aTraduire('Retirer le choix')),
    LT(aTraduire('Clic sur la bande'), aTraduire('Dans l’album, ou de nouveau à décider')),
    LT(aTraduire('R (Maj+R)'), aTraduire('Tourner d’un quart de tour (dans l’autre sens)')),
    L('K', aTraduire('Recadrer la photo')),
    L('C', aTraduire('Comparer 2 à 4 photos (↑ ↓ : photo, Entrée : côte à côte ou une à la fois)')),
    L('M', aTraduire('Déplacer vers une autre sortie')),
    LT(aTraduire('T ou Entrée'), aTraduire('Tri rapide, une photo à la fois')),
    L('Ctrl+A', aTraduire('Tout sélectionner')),
  ],
};

function Tableau({ lignes }: { lignes: Ligne[] }) {
  return (
    <dl class="liste-raccourcis">
      {lignes.map(([touche, effet, traduite]) => (
        <div key={touche + effet}>
          <dt>
            <kbd>{traduite ? t(touche) : touche}</kbd>
          </dt>
          <dd>{t(effet)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Fenêtre « Raccourcis clavier », ouverte par « ? ». */
export function Raccourcis() {
  const ouverte = raccourcisOuverts.value;
  const bouton = useRef<HTMLButtonElement>(null);
  const fermer = () => (raccourcisOuverts.value = false);

  useEffect(() => {
    if (!ouverte) return;
    bouton.current?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== '?') return;
      fermer();
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [ouverte]);

  if (!ouverte) return null;
  const p = page.value;
  const code = p.nom === 'etape' && session.value ? CODES_ETAPES[p.numero - 1] : undefined;
  const propres = code ? PAR_ETAPE[code] : undefined;
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue raccourcis" role="dialog" aria-modal="true" aria-label={t`Raccourcis clavier`}>
        <h2>{t`Raccourcis clavier`}</h2>
        <h3>{t`Partout`}</h3>
        <Tableau lignes={COMMUNS} />
        {propres && p.nom === 'etape' && (
          <>
            <h3>{t`Étape ${p.numero} : ${nomEtape(p.numero)}`}</h3>
            <Tableau lignes={propres} />
          </>
        )}
        <p class="discret">{t`Les raccourcis ne marchent pas pendant la saisie d’un texte.`}</p>
        <div class="actions droite">
          <button ref={bouton} type="button" class="principal" onClick={fermer}>
            {t`Fermer`}
          </button>
        </div>
      </div>
    </div>
  );
}
