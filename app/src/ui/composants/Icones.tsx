// Icônes au trait (24 × 24), dessinées en SVG : aucune bibliothèque ni police d'icônes.
// Charte C-1.4 et C-5 : un seul jeu, trait de 1,75 aux bouts arrondis ; 20 px dans
// un bouton, 16 dans le texte, 14 dans une remarque. Jamais un caractère (✕ ✦ ▾…)
// ni un émoji à la place d'une icône (tests/charte.test.ts) ; chaque icône a son
// mot à côté, ou un nom pour les lecteurs d'écran (`titre`).

const TRACES = {
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  coche: <path d="M5 12l5 5 9-10" />,
  voyage: (
    <>
      <path d="M2 16l20-6-4-3-8 4-4-2-2 1 3 3-5 3z" />
      <path d="M4 20h16" />
    </>
  ),
  sortie: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  maison: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  croix: <path d="M6 6l12 12M18 6L6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  alerte: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  dossierPlus: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </>
  ),
  dossierCoche: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  etincelle: (
    <>
      <path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z" />
      <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  moins: <path d="M5 12h14" />,
  /** Photo entière (zoom remis à la taille de l'écran). */
  entier: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  /** Présentation « Côte à côte ». */
  comparer: (
    <>
      <rect x="3" y="5" width="7.5" height="14" rx="1.5" />
      <rect x="13.5" y="5" width="7.5" height="14" rx="1.5" />
    </>
  ),
  /** Présentation « Une à la fois » (la photo et la bande des autres). */
  une: (
    <>
      <rect x="3" y="4" width="13" height="16" rx="1.5" />
      <path d="M19.5 5v3M19.5 11v2M19.5 16v3" />
    </>
  ),
  aide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.6-2.5 2-2.5 3.8" />
      <path d="M12 17h.01" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  crayon: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  annuler: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  retablir: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </>
  ),
  calendrier: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  loupe: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  /** « Rien n'est supprimé » (C-8.4). */
  bouclier: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12 2.3 2.3 4.3-4.6" />
    </>
  ),
  chevronBas: <path d="m6 9 6 6 6-6" />,
  chevronHaut: <path d="m6 15 6-6 6 6" />,
  chevronDroite: <path d="m9 6 6 6-6 6" />,
  chevronGauche: <path d="m15 6-6 6 6 6" />,
  /** « Valider et continuer », « Suite ». */
  fleche: <path d="M5 12h14M13 6l6 6-6 6" />,
  /** Quart de tour (↻). */
  tourner: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  /** Quart de tour vers la droite (↻) : le trait de « tourner » (↺), en miroir. */
  tournerDroite: (
    <g transform="matrix(-1 0 0 1 24 0)">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4v4.5h4.5" />
    </g>
  ),
  /** Recadrée (✂). */
  recadrer: (
    <>
      <path d="M7 3v14h14" />
      <path d="M3 7h14v14" />
    </>
  ),
  /** Vidéo (▶). */
  lecture: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  /** Pas encore fait (○). */
  cercle: <circle cx="12" cy="12" r="7.5" />,
  /** Pile de photos semblables. */
  pile: (
    <>
      <rect x="3" y="8" width="13" height="12" rx="1.5" />
      <path d="M7 5h12.5a1.5 1.5 0 0 1 1.5 1.5V16" />
    </>
  ),
  /** Touche « Retour arrière » (⌫). */
  effacer: (
    <>
      <path d="M8.5 5H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8.5L3 12z" />
      <path d="m11 9 6 6M17 9l-6 6" />
    </>
  ),
  /** Lieu (📍), comme « sortie ». */
  lieu: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  /** Couverture de l'album (◆). */
  couverture: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 3v18" />
    </>
  ),
  /** Décidé par vous (D112) : une punaise, penchée. */
  punaise: (
    <g transform="rotate(40 12 12)">
      <path d="M12 15.5V22" />
      <path d="M8.5 3h7" />
      <path d="M9.6 3v6.2L6.5 12.6v2.9h11v-2.9l-3.1-3.4V3" />
    </g>
  ),
  /** À vérifier (D112) : un point d'interrogation nu, jamais cerclé (le cercle est celui de l'Aide). */
  question: (
    <>
      <path d="M8.5 8.5a3.5 3.5 0 0 1 7 0c0 2.2-3.5 2.8-3.5 5.3" />
      <path d="M12 18.5h.01" />
    </>
  ),
  /** L'autre sort (⇄) : l'effet d'un clic sur la bande d'une photo proposée. */
  echanger: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  /** Revenir à la proposition (↺) : l'effet d'un clic sur la bande d'une photo décidée. */
  revenir: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
} as const;

export type NomIcone = keyof typeof TRACES;

/** 16 dans un bouton (échelle sobre, retours du 29.10) et dans le texte, 20 sur une carte ou une ligne de liste, 14 dans une remarque (C-5.1). */
export type TailleIcone = 14 | 16 | 20;

/**
 * Une icône ; `titre` la nomme pour les lecteurs d'écran quand aucun mot ne
 * l'accompagne (sinon elle est cachée : le mot suffit).
 */
export function Icone({ nom, taille = 20, titre }: { nom: NomIcone; taille?: TailleIcone; titre?: string }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={titre ? undefined : 'true'}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      class="icone"
      data-icone={nom}
    >
      {TRACES[nom]}
    </svg>
  );
}
