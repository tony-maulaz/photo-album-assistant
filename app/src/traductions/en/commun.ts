// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Textes partagés : mise en forme (src/ui/format.ts), démarrage (src/ui/main.tsx), choix de la langue.

export const TEXTES: Record<string, string> = {
  // format.ts
  'date inconnue': 'unknown date',
  '{0} à {1}': '{0} at {1}',

  // main.tsx
  'Album photos': 'Photo album',
  'Navigateur non pris en charge': 'Browser not supported',
  'Cette application a besoin d’accéder à vos dossiers de photos : ouvrez-la avec Google Chrome ou Microsoft Edge, sur un ordinateur.':
    'This application needs access to your photo folders: open it with Google Chrome or Microsoft Edge, on a computer.',
  'Configuration illisible : {0}': 'Configuration cannot be read: {0}',

  // Choix de la langue (Réglages, accueil)
  'Langue (language)': 'Language (langue)',
};
