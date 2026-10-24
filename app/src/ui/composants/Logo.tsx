// Logo de l'application : une pile de photos (l'album) ; sur celle de devant, un M
// en deux montagnes sous le soleil. Dessiné en SVG, aucune image à charger.
// L'icône d'onglet (album-photos.html) en est la version réduite : la photo de devant seule.

import { useId } from 'preact/hooks';

export function Logo() {
  // Identifiant propre à chaque logo affiché, pour que les dégradés ne se mélangent pas.
  const degrade = `logo-${useId()}`;
  return (
    <svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={degrade} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#22A898" />
          <stop offset=".55" stop-color="#0F766E" />
          <stop offset="1" stop-color="#0A5550" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${degrade})`} />
      {/* Les groupes .photo s'écartent au survol (style.css), le transform du dessin reste dessous. */}
      <g class="photo fond">
        <rect x="18" y="13" width="28" height="35" rx="3.5" fill="#fff" opacity=".3" transform="rotate(-20 32 38)" />
      </g>
      <g class="photo milieu">
        <rect x="18" y="13" width="28" height="35" rx="3.5" fill="#fff" opacity=".55" transform="rotate(-8 32 38)" />
      </g>
      <g class="photo devant">
        <g transform="rotate(7 32 38)">
          <rect x="16" y="11" width="32" height="39" rx="3.5" fill="#fff" />
          <rect x="19.5" y="14.5" width="25" height="25" rx="1.5" fill="#D6F1EB" />
          <circle cx="32" cy="20.2" r="3.3" fill="#FFC94D" />
          <path d="M23.6 36V22.5l8.4 8.5 8.4-8.5V36" fill="none" stroke="#0F766E" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </svg>
  );
}
