// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Composants partagés (src/ui/composants/).

export const TEXTES: Record<string, string> = {
  // TriAuto.tsx
  'Tri par lieux : {0} pour {1}':
    'Sort by place: {0} for {1}',
  'dossier proposé': 'folder proposed',
  'dossiers proposés': 'folders proposed',
  '{0} : vérifiez-les à l’étape suivante, « Lieux et sorties ».': '{0}: check them in the next step, “Places and outings”.',
  'Tri interrompu : {0}': 'Sorting interrupted: {0}',
  'Réglages du tri': 'Sorting settings',
  'fichier à trier': 'file to sort',
  'fichiers à trier': 'files to sort',
  'Sans effet pour l’instant : cochez « C’est notre domicile » sur un lieu ci-dessus, ou indiquez-le dans la Configuration.':
    'No effect for now: tick “This is our home” on a place above, or set it in the Configuration.',
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
  'photo à la limite': 'borderline photo',
  'photos à la limite': 'borderline photos',
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
  'Ranger {0} groupes de photos sans GPS': 'Move {0} groups of photos without GPS',
  'groupe rangé': 'group moved',
  'groupes rangés': 'groups moved',
  Annuler: 'Undo',
  'dialogue|Annuler': 'Cancel',
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
  'Replier l’explication': 'Hide the explanation',
  'Afficher l’explication de l’étape': 'Show the explanation of this step',
  Replier: 'Hide',
  'Valider et continuer': 'Confirm and continue',
  Revenir: 'Back',

  // Comparateur.tsx
  'Double-clic : cette photo seule, en grand': 'Double-click: this photo alone, enlarged',
  'Chargement…': 'Loading…',
  Comparer: 'Compare',
  'Photo {0} sur {1}': 'Photo {0} of {1}',
  'Double-clic ou Entrée : une à une, en grand · molette : zoom · glisser : déplacer · Échap : fermer':
    'Double-click or Enter: one by one, enlarged · wheel: zoom · drag: move · Esc: close',
  '← → : photo précédente ou suivante, même zoom · molette : zoom · Échap : revenir au côte à côte':
    '← →: previous or next photo, same zoom · wheel: zoom · Esc: back to side by side',
  'Photo précédente': 'Previous photo',
  'Flèche gauche': 'Left arrow',
  'Photo suivante': 'Next photo',
  'Flèche droite': 'Right arrow',
  'Côte à côte': 'Side by side',
  'Taille normale': 'Normal size',
  Fermer: 'Close',
  '{0} : double-clic ou Entrée pour les voir une à une.': '{0}: double-click or press Enter to see all the photos one by one.',

  // Dialogues.tsx
  Valider: 'Confirm',
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

  // EnteteEtape.tsx
  'Aide et outils': 'Help and tools',

  // ExtrasInventaire.tsx
  'Captures d’écran': 'Screenshots',
  'capture d’écran trouvée': 'screenshot found',
  'captures d’écran trouvées': 'screenshots found',
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
  '▶ vidéo': '▶ video',
  'aperçu indisponible': 'no preview',
  élément: 'item',
  éléments: 'items',
  ' (date du fichier)': ' (file date)',
  vidéo: 'video',
  'Photos du dossier': 'Photos in the folder',
  'Aucune photo ni vidéo dans ce dossier.': 'No photos or videos in this folder.',

  // LieuxFrequents.tsx
  'Donnez d’abord un nom au lieu (ex. Chez_Grands_Parents).': 'First give the place a name (e.g. Grandparents).',
  'Domicile « {0} » enregistré : les voyages seront repérés au prochain calcul de l’arborescence.':
    'Home “{0}” saved: trips will be detected the next time the folder tree is calculated.',
  'lieu qui revient souvent': 'place that comes up often',
  'lieux qui reviennent souvent': 'places that come up often',
  '— à enregistrer comme lieu connu (maison, grands-parents, école…)': '— to save as a known place (home, grandparents, school…)',
  'Un lieu enregistré reçoit son propre dossier (« Maison », « Chez_Grands_Parents »…), rangé par sortie. L’adresse vient d’OpenStreetMap (seules les coordonnées sont envoyées).':
    'A saved place gets its own folder (“Home”, “Grandparents”…), arranged by outing. The address comes from OpenStreetMap (only the coordinates are sent).',
  'sur {0} jours ·': 'over {0} days ·',
  'Coordonnées : {0}, {1}': 'Coordinates: {0}, {1}',
  'Recherche de l’adresse…': 'Looking up the address…',
  'Moins de photos': 'Fewer photos',
  'Voir les {0} photos': 'See all {0} photos',
  'Nom du lieu (ex. Maison)': 'Place name (e.g. Home)',
  'Le domicile sert à repérer les voyages (sorties loin de la maison qui s’enchaînent).':
    'Home is used to detect trips (outings far from home that follow one another).',
  'C’est notre domicile': 'This is our home',
  'Enregistrer comme lieu connu': 'Save as a known place',
  ignorer: 'ignore',

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
  'Fusionner les dossiers ?': 'Merge the folders?',
  'Les {0} photos et vidéos de « {1} » (avec ses sous-dossiers) passent dans « {2} », puis « {3} » disparaît. Ctrl+Z annule.':
    'The {0} photos and videos of “{1}” (with its subfolders) move into “{2}”, then “{3}” disappears. Ctrl+Z undoes.',
  Fusionner: 'Merge',
  '« {0} » fusionné dans « {1} ».': '“{0}” merged into “{1}”.',
  'Ce qui est écarté va dans « {0} » : rien n’est supprimé':
    'What is set aside goes to “{0}”: nothing is deleted',
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
  'Seulement les dossiers avec une alerte (sans date, nom en double, même sortie ?…)': 'Only folders with a warning (no date, duplicate name, same outing?…)',
  'Seulement les alertes': 'Only warnings',
  'Nouveau dossier, dans le dossier affiché (des photos déposées ici partent dans un dossier voisin)':
    'New folder, inside the folder shown (photos dropped here go to a neighbouring folder)',
  'Nouveau dossier': 'New folder',
  'Renommer (F2 ou double-clic sur le dossier)': 'Rename (F2 or double-click on the folder)',
  Renommer: 'Rename',
  'Supprimer (vide)': 'Delete (empty)',
  // Fusionner avec… et calendrier sous le nom d'un dossier (D94).
  'Fusionner avec…': 'Merge with…',
  'Mettre ses photos dans un autre dossier (ou glisser ce dossier sur un autre, à gauche)': 'Put its photos into another folder (or drag this folder onto another, on the left)',
  'Fusionner avec un autre dossier': 'Merge with another folder',
  'Fusionner « {0} » avec…': 'Merge “{0}” with…',
  'Ses photos passent dans le dossier choisi. Les plus proches dans le temps sont en tête.': 'Its photos go into the chosen folder. The closest in time come first.',
  '↑ ↓ pour choisir, Entrée pour fusionner, Échap pour fermer.': '↑ ↓ to choose, Enter to merge, Esc to close.',

  // TriRapide.tsx
  'Pas dans l’album': 'Not in the album',
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
  '← → pour naviguer · M pour déplacer · Suppr pour mettre de côté · Échap pour fermer': '← → to browse · M to move · Del to set aside · Esc to close',
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

  // Captures.tsx
  '{0} parmi les photos à trier (nom de fichier, dimensions d’écran, pas de marque d’appareil). Proposition : les ranger dans « {1} », hors du tri et de l’album. Celles qui sont dans un dossier gardé restent à leur place.':
    '{0} among the photos to sort (file name, screen size, no camera brand). Proposal: put them in “{1}”, outside the sorting and the album. Those in a kept folder stay where they are.',

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
  'Recadrer « {0} »': 'Crop “{0}”',
  'Seule la copie de l’album est recadrée : la photo de l’archive reste entière.': 'Only the album copy is cropped: the photo in the archive stays whole.',
  'Cette photo ne peut pas être affichée ici ({0}).': 'This photo cannot be shown here ({0}).',
  Format: 'Format',
  'En paysage': 'Landscape',
  'En portrait': 'Portrait',
  'Redresser : {0}°': 'Straighten: {0}°',
  '{0} × {1} pixels': '{0} × {1} pixels',
  'Tout reprendre': 'Start over',
  'Valider le recadrage': 'Apply the crop',

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
  'nouveau fichier à ranger': 'new file to arrange',
  'nouveaux fichiers à ranger': 'new files to arrange',
  'Range seulement les photos arrivées depuis le dernier tri : les dossiers déjà faits ne bougent pas.': 'Arranges only the photos added since the last sort: the folders already made do not move.',
  'Ranger les {0}': 'Arrange the {0}',
  'nouvelle photo': 'new photo',
  'nouvelles photos': 'new photos',
  // Copies exactes en attente avant le tri (D85).
  'Copies exactes pas encore écartées : {0}.': 'Exact copies not yet set aside: {0}.',
  'Ces photos existent déjà ailleurs dans votre dossier (proposition de l’étape « {0} », pas encore acceptée). Écartez-les d’abord : sinon, le tri les rangera une seconde fois.':
    'These photos already exist elsewhere in your folder (suggestion of the “{0}” step, not yet accepted). Set them aside first: otherwise, the sorting will file them a second time.',
  'Les voir d’abord': 'See them first',
  // Tri automatique en trois questions, avec l'aperçu (D87).
  'Lieu « {0} » enregistré : rangez à nouveau pour en tenir compte.': 'Place “{0}” saved: arrange again to take it into account.',
  'Par sortie (conseillé)': 'By outing (recommended)',
  'Les jours passés au même endroit forment une sortie ; chaque nouvel endroit a la sienne. Une semaine au même hôtel donne un dossier. Pour en sortir une journée : « Nouveau dossier avec cette journée », à l’étape suivante.':
    'Days spent at the same place form one outing; each new place has its own. A week at the same hotel gives one folder. To take one day out of it: “New folder with this day”, at the next step.',
  'Par jour': 'By day',
  'Un dossier par endroit et par journée : des dossiers courts, utile pour un projet d’un seul voyage.': 'One folder per place and per day: short folders, useful for a project of a single trip.',
  'Par mois': 'By month',
  'Un dossier par endroit et par mois, sans chercher les sorties : le plus rapide à parcourir.': 'One folder per place and per month, without looking for outings: the quickest to browse.',
  'une rue': 'a street',
  'un quartier': 'a neighbourhood',
  'un village': 'a village',
  'une ville': 'a town',
  'une région': 'a region',
  '{0} → « {1} ». Rangez à nouveau : des dossiers ont pu se vider.': '{0} → “{1}”. Arrange again: some folders may now be empty.',
  'Ces photos existent déjà ailleurs dans votre dossier (proposition de l’étape « {0} », pas encore acceptée) : le tri les a rangées une seconde fois. Écartez-les, puis rangez à nouveau.':
    'These photos already exist elsewhere in your folder (suggestion of the “{0}” step, not yet accepted): the sorting filed them a second time. Set them aside, then arrange again.',
  'Ranger à nouveau ?': 'Arrange again?',
  'Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier rangement seront remplacés (Ctrl+Z annule).':
    'The photos to sort will be arranged again: moves made by hand since the last arrangement will be replaced (Ctrl+Z undoes).',
  'Ranger à nouveau': 'Arrange again',
  'Noms des lieux indisponibles (OpenStreetMap injoignable) : les dossiers ont des noms provisoires (« {0}_01 »…). Renommez-les plus tard, ou rangez à nouveau une fois connecté.':
    'Place names unavailable (OpenStreetMap cannot be reached): the folders have temporary names (“{0}_01”…). Rename them later, or arrange again once connected.',
  'Une sortie dure au plus (jours)': 'An outing lasts at most (days)',
  'Au même endroit, une nouvelle sortie commence au-delà de cette durée, ou après une semaine sans photo. Coupe en plusieurs sorties un lieu photographié très souvent, comme la maison.':
    'At the same place, a new outing starts beyond this length, or after a week without photos. Splits a very often photographed place, such as home, into several outings.',
  'Un voyage commence à (km de la maison)': 'A trip starts at (km from home)',
  'Une sortie plus loin que cette distance de la maison peut faire partie d’un voyage.': 'An outing further than this distance from home can be part of a trip.',
  ' (déjà rangés : vous pouvez ranger à nouveau avec d’autres réglages)': ' (already arranged: you can arrange again with other settings)',
  'Comment ranger ?': 'How to arrange?',
  'Deux photos sont au même endroit si elles sont dans…': 'Two photos are at the same place if they are in…',
  'Taille d’un même endroit': 'Size of a same place',
  'À moins de {0} km l’une de l’autre': 'Less than {0} km apart',
  'Avec vos photos : {0}, hors des lieux connus. Deux photos à moins de {1} km l’une de l’autre vont au même endroit, de proche en proche.':
    'With your photos: {0}, outside the known places. Two photos less than {1} km apart go to the same place, step by step.',
  endroit: 'place',
  endroits: 'places',
  'Réunir les étapes d’un voyage': 'Gather the stages of a trip',
  'Les sorties à plus de {0} km de la maison qui s’enchaînent, sans retour entre-temps, vont dans un dossier « {1}_… », avec une étape par lieu.':
    'Outings more than {0} km from home that follow one another, without going back home in between, go to a “{1}_…” folder, with one stage per place.',
  'Tout ranger à nouveau': 'Arrange everything again',
  'Ranger à nouveau dans ces {0}': 'Arrange again into these {0}',
  'Ranger les photos dans ces {0}': 'Arrange the photos into these {0}',
  'Ensuite, les noms des endroits sont demandés à OpenStreetMap (Nominatim) : seules les coordonnées moyennes de chaque endroit sont envoyées, une par seconde.':
    'The place names are then asked from OpenStreetMap (Nominatim): only the average coordinates of each place are sent, one per second.',
  ' : rangez à part les captures d’écran, enregistrez les lieux qui reviennent souvent, choisissez comment ranger (le résultat se voit tout de suite), puis « Ranger les photos » ; l’IA peut situer les photos sans GPS.':
    ': put screenshots aside, save the places that come up often, choose how to arrange (the result shows at once), then “Arrange the photos”; the AI can locate photos without GPS.',
  'L’application range les photos par lieu (position GPS) et par sortie (les jours passés au même endroit). Écartez d’abord les copies s’il en reste, rangez à part les captures d’écran et enregistrez les lieux qui reviennent souvent (maison, grands-parents…). Choisissez ensuite comment ranger : le résultat se voit tout de suite avec vos photos. Vous le vérifierez et le corrigerez à l’étape suivante.':
    'The application arranges the photos by place (GPS position) and by outing (the days spent at the same place). First set aside any remaining copies, put screenshots aside and save the places that come up often (home, grandparents…). Then choose how to arrange: the result shows at once with your photos. You will check and correct it at the next step.',
  'Photos pas encore rangées': 'Photos not arranged yet',
  'Rangez les photos pour continuer': 'Arrange the photos to continue',
  // Étape 7 : dossiers nouveaux, ordre par taille (D89) ; le calendrier dans les lieux connus (D88).
  'Dossier créé par le tri automatique : il n’existe pas dans votre dossier d’origine': 'Folder created by the automatic sorting: it does not exist in your original folder',
  'Dossier créé à la main : il n’existe pas dans votre dossier d’origine': 'Folder created by hand: it does not exist in your original folder',
  'Par taille (les plus petits d’abord)': 'By size (smallest first)',
  'À la maison et dans vos lieux connus, séparer les événements du calendrier (Noël, anniversaires…)': 'At home and in your known places, separate the events of the calendar (Christmas, birthdays…)',
  'Plus de 3 jours au même endroit sont coupés autour des événements de votre calendrier pendant lesquels au moins 5 photos ont été prises. Les dossiers gardent un nom fait de dates : vous choisirez leur nom au Nommage.':
    'More than 3 days at the same place are cut around the events of your calendar during which at least 5 photos were taken. The folders keep a name made of dates: you will choose their name at the Naming step.',
  'Avec vos photos : {0}.': 'With your photos: {0}.',
  'sous-dossier séparé': 'separated subfolder',
  'sous-dossiers séparés': 'separated subfolders',
  'Aucun calendrier pour l’instant.': 'No calendar yet.',
  'Ajouter un calendrier dans la Configuration': 'Add a calendar in the Configuration',
};
