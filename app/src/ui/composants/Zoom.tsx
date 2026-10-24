// Zoom d'une photo affichée en grand : molette vers le pointeur, glisser pour
// se déplacer, double-clic ou touche 0 pour revenir à la taille de l'écran.

import { useEffect, useRef, useState } from 'preact/hooks';

export function useZoom(cle: string) {
  const [vue, setVue] = useState({ zoom: 1, x: 0, y: 0 });
  const zone = useRef<HTMLDivElement>(null);

  // Nouvelle photo : taille de l'écran.
  useEffect(() => setVue({ zoom: 1, x: 0, y: 0 }), [cle]);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const molette = (e: WheelEvent) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      const px = e.clientX - (b.left + b.width / 2);
      const py = e.clientY - (b.top + b.height / 2);
      setVue((v) => {
        const zoom = Math.min(10, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
        const k = zoom / v.zoom;
        return zoom === 1 ? { zoom, x: 0, y: 0 } : { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === '0') setVue({ zoom: 1, x: 0, y: 0 });
    };
    el.addEventListener('wheel', molette, { passive: false });
    window.addEventListener('keydown', touche);
    return () => {
      el.removeEventListener('wheel', molette);
      window.removeEventListener('keydown', touche);
    };
  }, []);

  const glisser = (e: MouseEvent) => {
    if (e.button !== 0 || vue.zoom === 1) return;
    e.preventDefault();
    e.stopPropagation();
    const bouger = (ev: MouseEvent) => setVue((v) => ({ ...v, x: v.x + ev.movementX, y: v.y + ev.movementY }));
    const lacher = () => {
      window.removeEventListener('mousemove', bouger);
      window.removeEventListener('mouseup', lacher);
    };
    window.addEventListener('mousemove', bouger);
    window.addEventListener('mouseup', lacher);
  };

  return {
    zone,
    zoom: vue.zoom,
    /** Transformation à appliquer à l'image (en plus d'une éventuelle rotation). */
    transformation: (rotation = 0) => `translate(${vue.x}px, ${vue.y}px) scale(${vue.zoom})${rotation ? ` rotate(${rotation}deg)` : ''}`,
    proprietes: {
      onMouseDown: glisser,
      onDblClick: (e: MouseEvent) => {
        e.stopPropagation();
        setVue({ zoom: 1, x: 0, y: 0 });
      },
    },
  };
}
