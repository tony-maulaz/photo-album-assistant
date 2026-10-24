// Comparateur (SPEC § 5.4) : 2 à 4 photos côte à côte, zoom (molette) et
// déplacement (glisser) synchronisés pour vérifier visages et netteté.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FichierPlan } from '../../lib/plan';
import { session } from '../etat';
import { dateHeure } from '../format';

/** Adresse `blob:` de l'original d'une photo, libérée quand le composant disparaît. */
export function useOriginal(f: FichierPlan | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const s = session.value;
    if (!f || !s) return;
    let actif = true;
    let u: string | null = null;
    setUrl(null);
    void s.source
      .fichier(f.id)
      .then((fichier) => {
        if (!actif) return;
        u = URL.createObjectURL(fichier);
        setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [f?.id]);
  return url;
}

interface Vue {
  zoom: number;
  x: number;
  y: number;
}

function Volet({ f, vue, rotation, actions, entete }: { f: FichierPlan; vue: Vue; rotation: number; actions?: ComponentChildren; entete?: ComponentChildren }) {
  const url = useOriginal(f);
  return (
    <div class="volet">
      <div class="volet-entete">
        <strong>{f.date ? dateHeure(f.date) : f.nom}</strong>
        <span class="discret">{f.nom}</span>
        {entete}
      </div>
      <div class="volet-image">
        {url ? (
          <img
            src={url}
            alt={f.nom}
            draggable={false}
            style={{ transform: `translate(-50%, -50%) translate(${vue.x}px, ${vue.y}px) scale(${vue.zoom}) rotate(${rotation}deg)` }}
          />
        ) : (
          <p class="discret">Chargement…</p>
        )}
      </div>
      {actions && <div class="volet-actions">{actions}</div>}
    </div>
  );
}

export function Comparateur({
  photos,
  fermer,
  actions,
  entete,
  titre = 'Comparer',
}: {
  photos: FichierPlan[];
  fermer: () => void;
  actions?: (f: FichierPlan) => ComponentChildren;
  entete?: (f: FichierPlan) => ComponentChildren;
  titre?: string;
}) {
  const [vue, setVue] = useState<Vue>({ zoom: 1, x: 0, y: 0 });
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
      else if (e.key === '0') setVue({ zoom: 1, x: 0, y: 0 });
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [fermer]);

  // Zoom vers le pointeur : le point visé reste sous la souris, dans chaque volet.
  const molette = (e: WheelEvent) => {
    e.preventDefault();
    const volet = (e.target as HTMLElement).closest('.volet-image');
    if (!volet) return;
    const b = volet.getBoundingClientRect();
    const px = e.clientX - (b.left + b.width / 2);
    const py = e.clientY - (b.top + b.height / 2);
    setVue((v) => {
      const zoom = Math.min(10, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
      const k = zoom / v.zoom;
      return zoom === 1 ? { zoom, x: 0, y: 0 } : { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const glisser = (e: MouseEvent) => {
    if (e.button !== 0 || !(e.target as HTMLElement).closest('.volet-image')) return;
    e.preventDefault();
    const bouger = (ev: MouseEvent) => setVue((v) => ({ ...v, x: v.x + ev.movementX, y: v.y + ev.movementY }));
    const lacher = () => {
      window.removeEventListener('mousemove', bouger);
      window.removeEventListener('mouseup', lacher);
    };
    window.addEventListener('mousemove', bouger);
    window.addEventListener('mouseup', lacher);
  };

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.addEventListener('wheel', molette, { passive: false });
    return () => el.removeEventListener('wheel', molette);
  }, []);

  return (
    <div class="comparateur" role="dialog" aria-label={titre}>
      <div class="comparateur-tete">
        <h2>{titre}</h2>
        <span class="discret">Molette : zoom · glisser : déplacer · 0 : taille normale · Échap : fermer</span>
        <span class="espace" />
        <button type="button" onClick={() => setVue({ zoom: 1, x: 0, y: 0 })} disabled={vue.zoom === 1}>
          Taille normale
        </button>
        <button type="button" class="fermer-comparateur" onClick={fermer}>
          Fermer
        </button>
      </div>
      <div class={`volets n${Math.min(4, photos.length)}`} ref={zone} onMouseDown={glisser}>
        {photos.slice(0, 4).map((f) => (
          <Volet key={f.id} f={f} vue={vue} rotation={f.rotation ?? 0} actions={actions?.(f)} entete={entete?.(f)} />
        ))}
      </div>
    </div>
  );
}
