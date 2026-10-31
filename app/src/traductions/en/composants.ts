// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Composants partagés (src/ui/composants/).

export const TEXTES: Record<string, string> = {
  // TriAuto.tsx
  'dossier proposé': 'folder proposed',
  'dossiers proposés': 'folders proposed',
  'Tri interrompu : {0}': 'Sorting interrupted: {0}',
  'Réglages avancés': 'Advanced settings',
  'Noms des lieux (OpenStreetMap) : {0} / {1} — encore {2}': 'Place names (OpenStreetMap): {0} / {1} — {2} left',
  'Arrêter (les noms déjà reçus sont gardés)': 'Stop (names already received are kept)',

  // ChoixLangue.tsx
  'Langue du navigateur': 'Browser language',

  // AidesTri.tsx
  'Faire juger les cas limites par l’IA': 'Have the AI judge the borderline cases',
  'Les photos juste autour du seuil de netteté : flou artistique, mouvement voulu, ou ratée ? L’IA donne son avis, vous décidez.':
    'Photos just around the sharpness threshold: artistic blur, intended motion, or a failed shot? The AI gives its opinion, you decide.',
  'planches des photos à la limite (6 par appel, 520 px)': 'contact sheets of the borderline photos (6 per call, 520 px)',
  '{0} avis sur les cas limites : voir les badges « IA ».': 'AI opinions on the borderline cases: {0}. See the “AI” badges.',
  'Situer les photos sans GPS avec l’IA': 'Locate the photos without GPS with the AI',
  'Pour les photos sans position, l’IA compare leur contenu aux photos prises juste avant et après, et propose un dossier.':
    'For photos without a position, the AI compares their content with the photos taken just before and after, and suggests a folder.',
  'les photos sans GPS et leurs voisines dans le temps, avec le nom de leur dossier':
    'the photos without GPS and the ones taken just before and after, with the name of their folder',
  'photo sans GPS': 'photo without GPS',
  'photos sans GPS': 'photos without GPS',
  '{0} pour les photos sans GPS.': '{0} for the photos without GPS.',
  proposition: 'suggestion',
  propositions: 'suggestions',
  '— rangées avec les photos du même jour ; l’IA peut proposer un meilleur dossier':
    '— put with the photos of the same day; the AI can suggest a better folder',
  'groupe rangé': 'group moved',
  'groupes rangés': 'groups moved',
  Annuler: 'Undo',
  'Accepter les {0} propositions sûres (confiance 8 ou plus)': 'Accept the {0} reliable suggestions (confidence 8 or more)',
  photo: 'photo',
  photos: 'photos',
  '« {0} »': '“{0}”',
  ' (confiance {0}/10)': ' (confidence {0}/10)',
  déplacer: 'move',

  // Analyse.tsx
  'Analyse des photos (netteté, ressemblance)': 'Analysing the photos (sharpness, similarity)',
  'Recherche des copies exactes': 'Looking for exact copies',
  'Préparation de l’analyse…': 'Preparing the analysis…',
  '{0} : {1} / {2}': '{0}: {1} / {2}',
  ' · encore {0}': ' · {0} left',
  'L’analyse est gratuite et se fait sur cet ordinateur : {0}': 'The analysis is free and runs on this computer: {0}',

  // Cadre.tsx
  validée: 'confirmed',
  'en cours': 'in progress',
  'à faire': 'to do',
  'à revoir': 'to review',
  'inutile pour un dossier déjà trié': 'not needed for a folder that is already sorted',
  'validez d’abord l’étape {0} ({1})': 'first confirm step {0} ({1})',
  Étapes: 'Steps',
  '{0}. {1} : {2}': '{0}. {1}: {2}',
  'Toutes les étapes': 'All steps',
  'Étape {0} sur {1}': 'Step {0} of {1}',
  'Fonctions IA': 'AI helpers',
  Configuration: 'Configuration',
  Réglages: 'Settings',
  Journal: 'Log',
  Aide: 'Help',
  Menu: 'Menu',
  'Tout est déjà enregistré': 'Everything is already saved',
  'Fermer le projet': 'Close the project',
  Accueil: 'Home',
  'Album photos': 'Photo album',
  'Projet « {0} » — source : {1}, sortie : {2}': 'Project “{0}” — source: {1}, output: {2}',
  'Dépenses IA du projet : {0} CHF sur un budget de {1} CHF (taux {2} CHF par USD). Détail dans le Journal.':
    'AI spending for the project: {0} CHF out of a budget of {1} CHF (rate {2} CHF per USD). Details in the Log.',
  'IA {0} / {1} CHF': 'AI {0} / {1} CHF',
  'Étape {0}': 'Step {0}',
  Replier: 'Hide',
  'Valider et continuer': 'Confirm and continue',
  Revenir: 'Back',

  // Comparateur.tsx
  'Double-clic : cette photo seule, en grand': 'Double-click: this photo alone, enlarged',
  'Chargement…': 'Loading…',
  Comparer: 'Compare',
  'Photo {0} sur {1}': 'Photo {0} of {1}',
  'Touche {0} : garder ou écarter cette photo': 'Key {0}: keep or set aside this photo',
  'Côte à côte': 'Side by side',
  Fermer: 'Close',

  // Dialogues.tsx
  Accepter: 'Accept',
  Confirmer: 'Confirm',

  // DossierDepart.tsx
  'Les fenêtres de choix s’ouvriront désormais dans « {0} ».': 'Selection windows will now open in “{0}”.',
  'Plus de dossier de départ : les fenêtres de choix s’ouvrent dans le dernier dossier choisi.':
    'No starting folder any more: selection windows open in the last folder chosen.',
  'Dossier de départ': 'Starting folder',
  'Changer…': 'Change…',
  'Choisir…': 'Choose…',
  'aucun : les fenêtres s’ouvrent dans le dernier dossier choisi': 'none: windows open in the last folder chosen',
  'Ne plus utiliser': 'Stop using',
  'Choisissez le dossier où se trouvent vos photos (par exemple « Photos ») : toutes les fenêtres de choix de dossier et de fichier s’y ouvriront, sans avoir à le chercher à chaque fois.':
    'Choose the folder where your photos are (for example “Photos”): every window for choosing a folder or a file will open there, so you don’t have to look for it each time.',
  'Les fenêtres de choix s’ouvrent dans « {0} ».': 'Selection windows open in “{0}”.',
  Changer: 'Change',
  'Pour que les fenêtres de choix s’ouvrent toujours au même endroit :': 'To make selection windows always open in the same place:',
  'choisir un dossier de départ': 'choose a starting folder',

  // ExtrasInventaire.tsx
  'Captures d’écran': 'Screenshots',
  'Ranger {0} dans « {1} »':
    'Put {0} in “{1}”',
  '{0} dans « {1} ».':
    '{0} in “{1}”.',
  'capture rangée': 'screenshot filed',
  'captures rangées': 'screenshots filed',
  copie: 'copy',
  copies: 'copies',
  groupe: 'group',
  groupes: 'groups',
  gardée: 'kept',
  'copie réduite': 'smaller copy',
  Écarter: 'Set aside',
  'Appareil « {0} » enregistré dans la configuration avec le décalage {1}.': 'Camera “{0}” saved in the configuration with the offset {1}.',
  'Appareil « {0} » enregistré dans la configuration.': 'Camera “{0}” saved in the configuration.',
  Appareils: 'Cameras',
  Modèle: 'Model',
  Photos: 'Photos',
  Période: 'Period',
  'Décalage d’horloge': 'Clock offset',
  'non enregistré': 'not saved',
  Enregistrer: 'Save',
  'Compare les photos d’une même scène prises par deux appareils': 'Compares photos of the same scene taken by two cameras',
  'Mesurer le décalage': 'Measure the offset',
  '« {0} » a {1} photo(s) de la même scène que « {2} » : son horloge est décalée de': '“{0}” has {1} photo(s) of the same scene as “{2}”: its clock is off by',
  'Enregistrer ce décalage': 'Save this offset',
  'Pas assez de photos de la même scène prises par les deux appareils pour mesurer un décalage.':
    'Not enough photos of the same scene taken by both cameras to measure an offset.',
  'Corriger l’heure des photos selon les décalages enregistrés': 'Correct the time of the photos using the saved offsets',

  // GrillePhotos.tsx
  floue: 'blurry',
  doublon: 'duplicate',
  'doublon exact': 'exact duplicate',
  écartée: 'set aside',
  'aperçu indisponible': 'no preview',
  élément: 'item',
  éléments: 'items',
  ' (date du fichier)': ' (file date)',
  vidéo: 'video',
  'Photos du dossier': 'Photos in the folder',
  'Aucune photo ni vidéo dans ce dossier.': 'No photos or videos in this folder.',

  // LieuxFrequents.tsx
  'Donnez d’abord un nom au lieu (ex. Chez_Grands_Parents).': 'First give the place a name (e.g. Grandparents).',
  'Coordonnées : {0}, {1}': 'Coordinates: {0}, {1}',
  'Recherche de l’adresse…': 'Looking up the address…',
  'Moins de photos': 'Fewer photos',

  // LigneDeTemps.tsx
  'Aucun dossier daté.': 'No dated folders.',
  'Période très longue : seuls les {0} premiers jours avec photos sont montrés.': 'Very long period: only the first {0} days with photos are shown.',
  '{0} : {1}': '{0}: {1}',
  Calendrier: 'Calendar',
  '{0} : {1} – {2}, {3}': '{0}: {1} – {2}, {3}',

  // PanneauDossiers.tsx
  'Ouvrir « {0} »': 'Open “{0}”',
  grand: 'large',
  'Très grand dossier : plus de {0} photos, peut-être plusieurs sorties': 'Very large folder: more than {0} photos, maybe several outings',
  'lieu ?': 'place?',
  'Lieu inconnu : photos sans GPS ou lieu sans nom': 'Unknown place: photos without GPS or a place without a name',
  'sans date': 'no date',
  '{0} photo(s) sans autre date que celle du fichier': '{0} photo(s) with no date other than the file’s',
  'nom en double': 'duplicate name',
  'Un autre dossier porte le même nom': 'Another folder has the same name',
  gardé: 'kept',
  'même sortie ?': 'same outing?',
  'Photos prises juste avant ou après celles de « {0} », au même endroit : la même sortie ?': 'Photos taken just before or after those of “{0}”, at the same place: the same outing?',
  '{0} — {1} photos, {2} vidéos': '{0} — {1} photos, {2} videos',
  'Photos (racine)': 'Photos (top level)',
  ' (dont {0} directement)': ' (of which {0} directly)',
  Déplier: 'Show',
  'Petit dossier : moins de {0} photos': 'Small folder: fewer than {0} photos',
  petit: 'small',
  vide: 'empty',
  'Mis de côté': 'Set aside',
  'Ni photo ni vidéo : copiés dans « {0} » avec leur chemin d’origine':
    'Neither photos nor videos: copied to “{0}” with their original path',
  'Autres fichiers': 'Other files',
  Dossiers: 'Folders',
  'Tirer pour élargir le panneau (double-clic : largeur d’origine)': 'Drag to widen the panel (double-click: original width)',
  'Chercher…': 'Search…',
  'Chercher un dossier': 'Search for a folder',
  'Présentation des dossiers': 'Folder display',
  'Par période': 'By period',
  'Nouveau dossier': 'New folder',
  Renommer: 'Rename',
  // Fusionner avec… et calendrier sous le nom d'un dossier (D94).
  'Mettre ses photos dans un autre dossier (ou glisser ce dossier sur un autre, à gauche)': 'Put its photos into another folder (or drag this folder onto another, on the left)',
  'Ses photos passent dans le dossier choisi. Les plus proches dans le temps sont en tête.': 'Its photos go into the chosen folder. The closest in time come first.',

  // TriRapide.tsx
  '★ Dans l’album': '★ In the album',
  '★★ Grande photo': '★★ Large photo',
  'Tri rapide': 'Quick sort',
  'Molette : zoom · glisser : déplacer · double-clic ou 0 : taille de l’écran': 'Wheel: zoom · drag: move · double-click or 0: fit to screen',
  'À décider': 'To decide',
  'netteté {0}': 'sharpness {0}',
  'Reste à décider : {0}': 'Left to decide: {0}',
  Espace: 'Space',
  '★ dans l’album': '★ in the album',
  '★★ grande photo': '★★ large photo',
  'pas dans l’album': 'not in the album',
  'à décider': 'to decide',
  tourner: 'rotate',
  précédente: 'previous',
  suivante: 'next',
  Échap: 'Esc',
  fermer: 'close',

  // Visionneuse.tsx
  'appareil (EXIF)': 'camera (EXIF)',
  'nom du fichier': 'file name',
  'données de la vidéo': 'video data',
  'date du fichier (incertaine)': 'file date (uncertain)',
  Visionneuse: 'Viewer',
  'date : {0}': 'date: {0}',
  'source : {0}': 'source: {0}',
  '← → pour naviguer · Échap pour fermer': '← → to browse · Esc to close',
  'Nouveau dossier « {0} »': 'New folder “{0}”',
  'Dossier « {0} » créé avec {1} élément(s).': 'Folder “{0}” created with {1} item(s).',
  'Déplacer vers un dossier': 'Move to a folder',
  'Déplacer {0} vers…': 'Move {0} to…',
  'Tapez une partie du nom du dossier': 'Type part of the folder name',
  '+ Créer le dossier « ': '+ Create the folder “',
  ' »': '”',
  '↑ ↓ pour choisir, Entrée pour déplacer, Échap pour fermer.': '↑ ↓ to choose, Enter to move, Esc to close.',

  // Cadre.tsx (étape « Dossiers » sautée)
  'rien à décider : aucun sous-dossier': 'nothing to decide: no subfolders',

  // CopiesExactes.tsx
  'Copies exactes': 'Exact copies',

  // PanneauDossiers.tsx (choix par sous-dossier)
  'Sous-dossier de la source gardé à sa place ; ses floues et ses doublons sont proposés': 'Source subfolder kept in its place; its blurry photos and duplicates are proposed',
  'ne pas toucher': 'leave as is',
  'Sous-dossier de la source recopié tel quel': 'Source subfolder copied as is',
  'Écarter {0}': 'Set aside {0}',

  // Recadreur.tsx (D62)
  Libre: 'Free',
  Carré: 'Square',
  'Recadrer la photo': 'Crop the photo',
  'Seule la copie de l’album est recadrée : la photo de l’archive reste entière.': 'Only the album copy is cropped: the photo in the archive stays whole.',
  'Cette photo ne peut pas être affichée ici ({0}).': 'This photo cannot be shown here ({0}).',
  Format: 'Format',
  'En paysage': 'Landscape',
  'En portrait': 'Portrait',
  'Redresser : {0}°': 'Straighten: {0}°',
  'Accepter le recadrage': 'Accept the crop',

  // BandeauSource.tsx (D63)
  'nouveau fichier': 'new file',
  'nouveaux fichiers': 'new files',
  'fichier modifié': 'changed file',
  'fichiers modifiés': 'changed files',
  'fichier disparu': 'missing file',
  'fichiers disparus': 'missing files',
  'Le dossier à trier a changé depuis l’inventaire : {0}.': 'The folder to sort has changed since the inventory: {0}.',
  'Tout ce qui est déjà décidé sera gardé.': 'Everything already decided will be kept.',
  'Mettre à jour l’inventaire': 'Update the inventory',
  'Plus tard': 'Later',

  // TriAuto.tsx : nouvelles photos seulement (D63)
  'Tri des nouvelles photos : {0} dans {1}': 'Sorting new photos: {0} in {1}',
  'fichier rangé': 'file arranged',
  'fichiers rangés': 'files arranged',
  'nouvelle photo': 'new photo',
  'nouvelles photos': 'new photos',
  // Tri automatique (D87, D103).
  'Ranger à nouveau ?': 'Arrange again?',
  'Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier rangement seront remplacés (Ctrl+Z annule).':
    'The photos to sort will be arranged again: moves made by hand since the last arrangement will be replaced (Ctrl+Z undoes).',
  'Ranger à nouveau': 'Arrange again',
  'Noms des lieux indisponibles (OpenStreetMap injoignable) : les dossiers ont des noms provisoires (« {0}_01 »…). Renommez-les plus tard, ou rangez à nouveau une fois connecté.':
    'Place names unavailable (OpenStreetMap cannot be reached): the folders have temporary names (“{0}_01”…). Rename them later, or arrange again once connected.',
  'Tout ranger à nouveau': 'Arrange everything again',
  'Photos pas encore rangées': 'Photos not arranged yet',
  // Étape 7 : dossiers nouveaux, ordre par taille (D89) ; le calendrier dans les lieux connus (D88).
  'Dossier créé par le tri automatique : il n’existe pas dans votre dossier d’origine': 'Folder created by the automatic sorting: it does not exist in your original folder',
  'Dossier créé à la main : il n’existe pas dans votre dossier d’origine': 'Folder created by hand: it does not exist in your original folder',
  'Par taille (les plus petits d’abord)': 'By size (smallest first)',
};
