// Raccourcis clavier communs à toutes les pages : Ctrl+Z annule, Ctrl+Y (ou
// Ctrl+Maj+Z) rétablit, « ? » affiche la liste des raccourcis. Un seul
// gestionnaire, posé avant tous les autres : les pages qui écoutaient déjà
// Ctrl+Z ne le reçoivent plus, rien n'est donc annulé deux fois.

import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import { actionClavier } from '../../lib/navigation';
import { CODES_ETAPES, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { annuler, notifier, page, retablir, session } from '../etat';

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
      const action = actionClavier(e);
      if (!action || e.defaultPrevented || estChampDeSaisie(e.target) || fenetreOuverte(action)) return;
      if (action === 'raccourcis') raccourcisOuverts.value = true;
      else {
        const s = session.value;
        // Sur les pages d'étape seulement : ailleurs, rien de ce qu'on voit ne changerait.
        if (page.value.nom !== 'etape' || !s) return;
        if (action === 'annuler') {
          if (s.historique.peutAnnuler) annuler();
          else notifier('info', t`Rien à annuler.`);
        } else if (s.historique.peutRetablir) retablir();
        else notifier('info', t`Rien à rétablir.`);
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
  L('?', aTraduire('Afficher cette liste')),
  LT(aTraduire('Échap'), aTraduire('Fermer une fenêtre, désélectionner')),
];

const GRILLE: Ligne[] = [
  LT(aTraduire('Clic, Ctrl+clic, Maj+clic'), aTraduire('Sélectionner une photo, en ajouter une, une plage')),
  L('← → ↑ ↓', aTraduire('Passer d’une photo à l’autre (avec Maj : étendre la sélection)')),
];

/** Raccourcis propres à certaines étapes (les autres n'en ont pas). */
const PAR_ETAPE: Partial<Record<CodeEtape, Ligne[]>> = {
  floues: [...GRILLE, L('S', aTraduire('Sauver les photos sélectionnées')), LT(aTraduire('X ou Suppr'), aTraduire('Écarter les photos sélectionnées'))],
  lieux: [
    ...GRILLE,
    L('Ctrl+A', aTraduire('Tout sélectionner')),
    L('M', aTraduire('Déplacer la sélection vers un dossier')),
    LT(aTraduire('1 à 9'), aTraduire('Déplacer vers un des derniers dossiers utilisés')),
    LT(aTraduire('Suppr'), aTraduire('Mettre de côté (dans « Mis de côté » : remettre)')),
    L('F2', aTraduire('Renommer le dossier affiché')),
    LT(aTraduire('Entrée'), aTraduire('Voir la photo en grand (← → : la suivante)')),
  ],
  doublons: [
    LT(aTraduire('J et K (ou ↓ ↑)'), aTraduire('Groupe suivant, groupe précédent')),
    L('← →', aTraduire('Passer d’une photo du groupe à l’autre')),
    LT(aTraduire('Espace'), aTraduire('Garder ou écarter la photo')),
    L('A', aTraduire('Accepter la proposition du groupe')),
    L('C', aTraduire('Comparer le groupe en grand (Page préc. / Page suiv. : autre groupe)')),
    LT(aTraduire('N et P'), aTraduire('Journée (ou dossier) suivante, précédente')),
  ],
  selection: [
    ...GRILLE,
    LT(aTraduire('Espace ou 1'), aTraduire('★ dans l’album')),
    L('2', aTraduire('★★ grande photo')),
    L('X', aTraduire('Pas pour l’album (elle reste dans l’archive)')),
    LT(aTraduire('Suppr'), aTraduire('Retirer le choix')),
    LT(aTraduire('R (Maj+R)'), aTraduire('Tourner d’un quart de tour (dans l’autre sens)')),
    L('K', aTraduire('Recadrer la photo')),
    L('C', aTraduire('Comparer 2 à 4 photos')),
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
