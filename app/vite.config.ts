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
      // CSS : navigateurs cibles (Chrome et Edge ≥ 123), pour que light-dark() reste
      // natif. Sans cela, Lightning CSS le remplace par des variables calculées une seule
      // fois sur :root, et les vues sombres (Comparer, tri rapide…) gardent le texte du
      // thème clair (charte C-3.9 ; vérifié par tests/charte.test.ts et essai_charte).
      cssTarget: ['chrome123', 'edge123'],
      emptyOutDir: entree === 'album-photos.html',
    },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    // Worker classique : en file://, l'origine est opaque et Chrome refuse un worker
    // de type module chargé depuis une adresse blob:.
    worker: { format: 'iife' },
    server: { open: false },
  };
});
