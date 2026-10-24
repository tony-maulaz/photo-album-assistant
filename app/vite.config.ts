import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un seul fichier HTML autonome (C5) : scripts, styles et workers intégrés.
// ENTREE=essais-phase0.html construit la page d'essais de la phase 0.
const entree = process.env.ENTREE ?? 'album-photos.html';

export default defineConfig({
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
});
