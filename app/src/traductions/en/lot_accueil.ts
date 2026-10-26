// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Lot « accueil » de la campagne de tests du 24.10.2026.

export const TEXTES: Record<string, string> = {
  // Accueil.tsx, Projet.tsx
  'Des photos arrivées depuis ? Rouvrez-le : seules les nouvelles seront à trier.': 'New photos since? Reopen it: only the new ones will need sorting.',
  '« {0} » contient déjà le projet « {1} » (créé le {2}). Ouvrez-le pour le continuer ou y ajouter des photos, ou choisissez un autre dossier de sortie.':
    '“{0}” already contains the project “{1}” (created on {2}). Open it to continue it or add photos to it, or choose another output folder.',
  'Ouvrir ce projet': 'Open this project',
  'pas encore saisie': 'not entered yet',
  'calendrier actif': 'active calendar',
  'calendriers actifs': 'active calendars',

  // Inventaire.tsx, ExtrasInventaire.tsx
  datée: 'dated',
  datées: 'dated',
  'vidéo datée': 'video dated',
  'vidéos datées': 'videos dated',
  'élément mis de côté': 'item set aside',
  'éléments mis de côté': 'items set aside',
  'Les appareils et le décalage de leur horloge sont gardés dans un dossier de configuration.': 'Devices and their clock offsets are kept in a configuration folder.',
  'Facultatif : pour enregistrer un appareil ou mesurer le décalage de son horloge (deux appareils qui n’étaient pas à la même heure), il faut un dossier de configuration.':
    'Optional: to save a device or measure its clock offset (two devices that were not set to the same time), you need a configuration folder.',
  'Choisir ou créer le dossier de configuration': 'Choose or create the configuration folder',

  // ChoixConfiguration.tsx
  'Le config.json de « {0} » est illisible : la page Configuration permet de restaurer une sauvegarde.': 'The config.json in “{0}” cannot be read: the Configuration page can restore a backup.',
  'Créer config.json ?': 'Create config.json?',
  '« {0} » ne contient pas encore de config.json. Le créer pour y enregistrer vos lieux et vos appareils ?': '“{0}” does not contain a config.json yet. Create it to save your places and devices in it?',
  'Ce dossier « config » est commun à tous vos projets : créez-le une fois, par exemple à côté de l’application. Il contiendra l’adresse du domicile : ne le partagez pas.':
    'This “config” folder is shared by all your projects: create it once, for example next to the application. It will contain your home address: do not share it.',
  'Créer le dossier « config »…': 'Create the “config” folder…',
  'J’en ai déjà un : le choisir…': 'I already have one: choose it…',

  // LieuxFrequents.tsx
  'Ce lieu est déjà enregistré dans la configuration : « {0} ».': 'This place is already saved in the configuration: “{0}”.',
  'Adresse indisponible (OpenStreetMap injoignable)': 'Address unavailable (OpenStreetMap cannot be reached)',
  'Les lieux connus sont gardés dans un dossier de configuration : choisissez-le ou créez-le, le lieu sera enregistré aussitôt.':
    'Known places are kept in a configuration folder: choose or create it, and the place will be saved right away.',

  // TriAuto.tsx
  'Noms des lieux indisponibles (OpenStreetMap) : {0}': 'Place names unavailable (OpenStreetMap): {0}',
  'Sans effet pour l’instant : aucun domicile n’est enregistré.': 'No effect for now: no home is saved.',
  'Indiquer le domicile dans la Configuration': 'Set the home in the Configuration',

  // Captures.tsx, lib/inventaire.ts
  'Décochez une vraie photo pour la garder dans le tri ; cliquez sur une image pour l’agrandir.': 'Untick a real photo to keep it in the sort; click an image to enlarge it.',
  'Agrandir « {0} »': 'Enlarge “{0}”',
  'Voir les {0} propositions': 'See the {0} suggestions',
  capture: 'screenshot',
  captures: 'screenshots',
  'Garder ces photos dans le tri': 'Keep these photos in the sort',
  '{0} dans le tri': '{0} in the sort',
  'photo décochée gardée': 'unticked photo kept',
  'photos décochées gardées': 'unticked photos kept',
  'Garder {0} dans le tri': 'Keep {0} in the sort',
};
