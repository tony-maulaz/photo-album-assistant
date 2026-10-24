import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un seul fichier HTML autonome (C5) : scripts, styles et workers intégrés.
// `vite build --mode essais` construit la page d'essais de la phase 0 (sans
// variable d'environnement : la commande marche aussi sous Windows).
export default defineConfig(({ mode }) => {
  const entree = mode === 'essais' ? 'essais-phase0.html' : 'album-photos.html';
  return {
    plugins: [viteSingleFile()],
    build: {
      rollupOptions: { input: entree },
      target: 'es2023',
      emptyOutDir: entree === 'album-photos.html',
    },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    // Worker classique : en file://, l'origine est opaque et Chrome refuse un worker
    // de type module chargé depuis une adresse blob:.
    worker: { format: 'iife' },
    server: { open: false },
  };
});
