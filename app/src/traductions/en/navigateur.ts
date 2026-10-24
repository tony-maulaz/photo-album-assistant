// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Accès aux dossiers, projet, IA, OpenStreetMap, workers (src/navigateur/, src/workers/).

export const TEXTES: Record<string, string> = {
  // album.ts
  'Ce navigateur ne sait pas renommer un fichier (move).': 'This browser cannot rename a file (move).',

  // claude.ts
  'Saisissez d’abord la clé API (Réglages).': 'First enter the API key (Settings).',
  'Clé API refusée (401) : vérifiez-la.': 'API key refused (401): please check it.',
  'Accès refusé (403) : {0}': 'Access denied (403): {0}',
  'Introuvable (404) : {0}': 'Not found (404): {0}',
  'Trop de requêtes (429) : patientez puis réessayez.': 'Too many requests (429): wait a moment, then try again.',
  'Requête refusée (400) : {0}': 'Request refused (400): {0}',
  'Échec réseau (connexion, CORS ou blocage) : {0}': 'Network failure (connection, CORS or blocked): {0}',
  'Erreur de l’API ({0}) : {1}': 'API error ({0}): {1}',

  // configuration.ts
  'config.json a été modifié ailleurs depuis sa lecture : rechargez-le avant d’enregistrer.':
    'config.json was changed elsewhere after it was read: reload it before saving.',
  'JSON illisible : {0}': 'Unreadable JSON: {0}',

  // dossiers.ts
  'Ce navigateur ne permet pas de choisir un dossier : utilisez Chrome ou Edge.': 'This browser cannot open a folder: use Chrome or Edge.',

  // doublons.ts
  'Sans date': 'No date',
  'Photos (racine)': 'Photos (top level)',
  '{0} : {1}': '{0}: {1}',

  // executeur.ts
  'Photo inconnue : {0}': 'Unknown photo: {0}',

  // ia.ts
  'Budget IA du projet atteint : augmentez-le (étape 1) pour continuer.': 'The project’s AI budget has been reached: increase it (step 1) to continue.',
  'Cache des réponses IA illisible : gardé dans .album/{0}, les aides devront être relancées.':
    'The saved AI answers could not be read: kept in .album/{0}; the AI helpers will have to be run again.',
  '{0} % du budget IA du projet dépensé ({1} / {2} CHF).': '{0}% of the project’s AI budget spent ({1} / {2} CHF).',
  '{0} : {1} USD ({2})': '{0}: {1} USD ({2})',
  '{0} : réponse inexploitable ({1}), ignorée': '{0}: unusable answer ({1}), ignored',
  illisible: 'unreadable',

  // nominatim.ts
  'Nominatim a répondu {0} {1}': 'Nominatim replied {0} {1}',
};
