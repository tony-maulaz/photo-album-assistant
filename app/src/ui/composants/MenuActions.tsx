// Menu « … » d'un objet (C-4.14, D112 point 10) : à Lieux et sorties et à Petits dossiers, les actions sur un
// dossier, jamais un filtre ni une vue. Il s'ouvre sur le bouton « … », au clic droit et avec Maj+F10 ; fixe dans
// la fenêtre, jamais hors de l'écran. Clavier : ↑ ↓ Origine Fin pour passer d'une action à l'autre, Entrée pour la
// faire, Échap ou Tab pour fermer (le focus revient alors là d'où le menu est parti), ou un clic à côté. Posé par un
// portail à la fin de la page : la liste collée des dossiers, qui fait son propre empilement, ne le recouvre pas.

import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icone, type NomIcone } from './Icones';

export interface ActionMenu {
  /** Nom de l'action, avec « … » quand elle ouvre une fenêtre. */
  libelle: string;
  icone: NomIcone;
  /** Ce que fait l'action, en gris dessous ; désactivée, sa raison (C-4.7). */
  detail?: string;
  /** Raccourci écrit au bout (« F2 », « M »). */
  touche?: string;
  desactivee?: boolean;
  /** Un filet avant l'action (« Retirer ce dossier » à part). */
  apart?: boolean;
  faire: () => void;
}

let prochainMenu = 0;

/**
 * Le menu ouvert, posé à `x`, `y` (le bas du bouton « … », ou le pointeur au clic droit). `titre` : le nom du
 * dossier, en tête du menu et dans son nom lu. `fermer` rend le focus à `retour`.
 */
export function MenuActions({ titre, actions, x, y, retour, fermer }: { titre: string; actions: ActionMenu[]; x: number; y: number; retour?: HTMLElement | null; fermer: () => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [id] = useState(() => `menu-actions-${prochainMenu++}`);
  const quitter = (rendre = true) => {
    fermer();
    if (rendre && retour?.isConnected) retour.focus();
  };
  // Sous le point d'ouverture, au-dessus s'il ne tient pas dessous ; jamais hors de la fenêtre.
  useLayoutEffect(() => {
    const b = zone.current?.getBoundingClientRect();
    if (!b) return;
    const left = Math.max(8, Math.min(x, window.innerWidth - b.width - 8));
    const top = y + b.height <= window.innerHeight - 8 ? y : Math.max(8, y - b.height);
    setPlace({ left, top });
  }, []);
  // Une fois posé (caché, il ne peut pas recevoir le focus) : le focus sur la première action possible.
  const pose = place !== null;
  useLayoutEffect(() => {
    if (pose) zone.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [pose]);
  useEffect(() => {
    // Un clic sur le bouton qui l'a ouvert : le bouton le referme lui-même.
    const clic = (e: MouseEvent) => !zone.current?.contains(e.target as Node) && !retour?.contains(e.target as Node) && quitter(false);
    // Défiler la page déplacerait ce que le menu désigne : il se ferme (sauf s'il défile lui-même).
    const defile = (e: Event) => !zone.current?.contains(e.target as Node) && quitter(false);
    document.addEventListener('mousedown', clic, true);
    window.addEventListener('scroll', defile, true);
    window.addEventListener('resize', fermer);
    return () => {
      document.removeEventListener('mousedown', clic, true);
      window.removeEventListener('scroll', defile, true);
      window.removeEventListener('resize', fermer);
    };
  }, []);
  const touche = (e: KeyboardEvent) => {
    const items = [...(zone.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    // Le menu a la main sur le clavier : les raccourcis de la page ne voient pas ses touches.
    e.stopPropagation();
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items.at(-1)?.focus();
    else if (e.key === 'Escape' || (e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') quitter();
    else if (e.key === 'Tab') quitter();
    else return;
    e.preventDefault();
  };
  // Posé à la fin de la page (portail) : une liste collée, qui fait son propre empilement, ne le recouvre pas.
  return createPortal(
    <div
      ref={zone}
      class="menu-actions"
      role="menu"
      aria-label={titre}
      tabIndex={-1}
      style={place ? { left: `${place.left}px`, top: `${place.top}px` } : { left: `${x}px`, top: `${y}px`, visibility: 'hidden' }}
      onKeyDown={touche}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div class="titre-menu-actions" aria-hidden="true">
        {titre}
      </div>
      {actions.map((a, i) => (
        <div key={a.libelle} class={a.apart ? 'apart' : undefined}>
          <button
            type="button"
            role="menuitem"
            disabled={a.desactivee}
            aria-describedby={a.detail ? `${id}-${i}` : undefined}
            onClick={() => {
              quitter(false);
              a.faire();
            }}
          >
            <Icone nom={a.icone} taille={16} />
            <span class="texte-action">
              <span class="libelle-action">{a.libelle}</span>
              {a.detail && (
                <span id={`${id}-${i}`} class="detail-action">
                  {a.detail}
                </span>
              )}
            </span>
            {a.touche && <kbd>{a.touche}</kbd>}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
