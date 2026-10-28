// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).

export const TEXTES: Record<string, string> = {
  // navigateur/projet.ts : noms des étapes (les mêmes partout dans l'interface)
  Projet: 'Project',
  Inventaire: 'Inventory',
  'Photos floues': 'Blurry photos',
  Floues: 'Blurry',
  Doublons: 'Duplicates',
  'Tri automatique': 'Automatic sorting',
  'Lieux et sorties': 'Places and outings',
  'Petits dossiers': 'Small folders',
  Nommage: 'Naming',
  Consolidation: 'Consolidation',
  Sélection: 'Selection',
  Album: 'Album',
  'Création de la sortie': 'Creating the output',
  Sortie: 'Output',

  // Logique (src/lib/). Une phrase déjà traduite plus haut n'est pas répétée.

  // aidesAlbum.ts : tons des textes de l'album
  sobre: 'plain',
  chaleureux: 'warm',
  humoristique: 'humorous',
  'pour les enfants': 'for children',

  // aidesSelection.ts : étiquettes des photos
  'sans personne': 'no people',
  'une personne': 'one person',
  '2 à 4 personnes': '2 to 4 people',
  groupe: 'group',
  portrait: 'portrait',
  'photo de groupe': 'group photo',
  paysage: 'landscape',
  monument: 'monument',
  repas: 'meal',
  animal: 'animal',
  activité: 'activity',
  selfie: 'selfie',
  document: 'document',
  'yeux fermés': 'eyes closed',
  'flou de bougé': 'motion blur',
  'tête coupée': 'head cut off',
  'contre-jour': 'backlit',
  'horizon penché': 'tilted horizon',

  // album.ts : textes_album.md
  'Textes de l\'album — {0}': 'Album texts — {0}',
  'Titres de sections, introductions et légendes à recopier dans ifolor.': 'Section titles, introductions and captions to copy into ifolor.',
  'Le titre se place sur la page où commence la photo indiquée.': 'Place each title on the page where the photo shown begins.',
  ' (suite)': ' (continued)',
  '(section démarrant à `{0}`)': '(section starting at `{0}`)',
  '- `{0}` : {1}': '- `{0}`: {1}',

  // config.ts
  'Le fichier ne contient pas un objet JSON.': 'The file does not contain a JSON object.',
  'Version {0} inconnue (attendue : {1}).': 'Unknown version {0} (expected: {1}).',
  'Date de modification absente.': 'Modification date missing.',
  '« {0} » doit être une liste.': '“{0}” must be a list.',
  '« prereglages » doit être un objet.': '“prereglages” must be an object.',
  'Lieu {0} : objet attendu.': 'Place {0}: object expected.',
  'Lieu {0} : nom manquant.': 'Place {0}: name missing.',
  'Lieu {0} : latitude invalide.': 'Place {0}: invalid latitude.',
  'Lieu {0} : longitude invalide.': 'Place {0}: invalid longitude.',
  'Lieu {0} : rayon invalide.': 'Place {0}: invalid radius.',
  'Un seul lieu peut être le domicile.': 'Only one place can be home.',
  'Appareil {0} : décalage attendu au format +HH:MM.': 'Camera {0}: time offset expected in the format +HH:MM.',

  // doublons.ts
  'quasi identique, prise à la suite': 'almost identical, taken in a row',
  'écartée à la main': 'set aside by hand',

  // floues.ts
  'Photos floues : {0}, {1}': 'Blurry photos: {0}, {1}',
  écartée: 'set aside',
  écartées: 'set aside',
  remise: 'put back',
  remises: 'put back',
  Sauver: 'Keep',
  Écarter: 'Set aside',

  // indicateurs.ts : signaux des photos
  'peu nette': 'not sharp',
  sombre: 'dark',
  cramée: 'overexposed',

  // inventaire.ts
  'Ranger {0}': 'Put away {0}',
  'capture d’écran': 'screenshot',
  'captures d’écran': 'screenshots',
  'Corriger l’heure de {0}': 'Correct the time of {0}',
  photo: 'photo',
  photos: 'photos',

  // noms.ts
  'Le nom est vide.': 'The name is empty.',
  'Le nom est trop long (120 caractères au plus).': 'The name is too long (120 characters at most).',
  'Le caractère « {0} » n’est pas permis dans un nom de dossier.': 'The character “{0}” is not allowed in a folder name.',
  'Le nom ne peut pas finir par un point ou une espace.': 'The name cannot end with a full stop or a space.',
  '« {0} » est un nom réservé par Windows.': '“{0}” is a name reserved by Windows.',

  // plan.ts : erreurs et opérations annulables (Ctrl+Z)
  'plan.json illisible ou d’une version inconnue.': 'plan.json cannot be read or comes from an unknown version.',
  'plan.json sans dossier racine.': 'plan.json has no root folder.',
  'Ce dossier n’existe plus.': 'This folder no longer exists.',
  'Déplacer {0} vers « {1} »': 'Move {0} to “{1}”',
  élément: 'item',
  éléments: 'items',
  'Mettre de côté {0}': 'Set aside {0}',
  'Remettre {0}': 'Put back {0}',
  'Un dossier « {0} » existe déjà à cet endroit.': 'A folder “{0}” already exists here.',
  'Créer le dossier « {0} »': 'Create the folder “{0}”',
  'Le dossier Photos ne peut pas être renommé.': 'The Photos folder cannot be renamed.',
  'Renommer « {0} » en « {1} »': 'Rename “{0}” to “{1}”',
  'Le dossier Photos ne peut pas être fusionné dans un autre.': 'The Photos folder cannot be merged into another one.',
  'Impossible de fusionner un dossier dans un de ses sous-dossiers.': 'A folder cannot be merged into one of its own subfolders.',
  'Le dossier Photos ne peut pas être supprimé.': 'The Photos folder cannot be deleted.',
  'Ce dossier contient des sous-dossiers.': 'This folder contains subfolders.',
  'Ce dossier n’est pas vide.': 'This folder is not empty.',
  dossier: 'folder',
  dossiers: 'folders',
  'Pas dans l’album': 'Not in the album',
  'Grande photo ★★': 'Large photo ★★',
  'Tourner {0}': 'Rotate {0}',
  'Changer la légende': 'Change the caption',
  'Écarter {0}': 'Set aside {0}',
  doublon: 'duplicate',
  doublons: 'duplicates',
  'Garder {0}': 'Keep {0}',

  // rapport.ts : Rapport.html, écrit dans la sortie
  'photo floue': 'blurry photo',
  'photos floues': 'blurry photos',
  'doublon exact': 'exact duplicate',
  'doublons exacts': 'exact duplicates',
  'écartées à la main': 'set aside by hand',
  'photo triée': 'sorted photo',
  'photos triées': 'sorted photos',
  vidéo: 'video',
  vidéos: 'videos',
  'autre fichier': 'other file',
  'autres fichiers': 'other files',
  '{0} dans le dossier à trier → {1} dans la sortie : {2}.': '{0} in the folder to sort → {1} in the output: {2}.',
  fichier: 'file',
  fichiers: 'files',
  '… et {0} autres': '… and {0} more',
  'Rapport — {0}': 'Report — {0}',
  'Rapport du {0} — source « {1} », sortie « {2} ».': 'Report of {0} — source “{1}”, output “{2}”.',
  'Tout est dans le dossier de sortie.': 'Everything is in the output folder.',
  'Vérifiez-le et copiez-le à son emplacement définitif (NAS) ; vous pourrez ensuite supprimer le dossier d’origine vous-même.':
    'Check it and copy it to its final location (NAS); you can then delete the original folder yourself.',
  '{0} dans la sortie : ne supprimez pas la source.': '{0} from the output: do not delete the source.',
  'Fichiers manquants': 'Missing files',
  'Les fichiers système masqués par le navigateur (comme {0}, le cache de miniatures de Windows) ne sont ni comptés ni copiés : Windows les recrée.':
    'System files hidden by the browser (such as {0}, the Windows thumbnail cache) are neither counted nor copied: Windows recreates them.',
  'Dossiers ({0})': 'Folders ({0})',
  'Dossier dans Photos/': 'Folder in Photos/',
  Dates: 'Dates',
  Photos: 'Photos',
  Vidéos: 'Videos',
  '(à la racine de Photos/)': '(at the root of Photos/)',
  '{0} photos dans {1}, numérotées dans l’ordre de l’album ({2}, environ {3}) : importez-les dans ifolor dans cet ordre.':
    '{0} photos in {1}, numbered in album order ({2}, about {3}): import them into ifolor in this order.',
  section: 'section',
  sections: 'sections',
  page: 'page',
  pages: 'pages',
  'Titres, introductions et légendes : {0}.': 'Titles, introductions and captions: {0}.',
  '{0} copies n’ont pas pu être écrites : relancez la création de la sortie.': '{0} copies could not be written: create the output again.',
  '{0} copie n’a pas pu être écrite : relancez la création de la sortie.': '{0} copy could not be written: create the output again.',
  'Mis de côté et autres fichiers': 'Set aside and other files',
  '{0}, dans {1}': '{0}, in {1}',
  '{0} (ni photo ni vidéo), dans {1} avec leur chemin d’origine': '{0} (neither photos nor videos), in {1} with their original path',
  'Autres fichiers': 'Other files',
  'Dates des fichiers': 'File dates',
  'La copie porte la date du jour : le navigateur ne peut pas conserver la date de modification d’origine.':
    'Each copy has today’s date: the browser cannot keep the original modification date.',
  'Celle de chaque fichier est enregistrée dans {0}.': 'The original date of each file is saved in {0}.',
  'Les photos et vidéos ci-dessous n’ont {0} (ni EXIF, ni nom daté) : voici leur date d’origine.':
    'The photos and videos below have {0} (no EXIF, no date in the name): here is their original date.',
  'aucune autre date': 'no other date',
  'Toutes les photos et vidéos ont une date de prise de vue (EXIF, nom ou date interne).': 'All photos and videos have a date taken (EXIF, name or internal date).',
  'Photos et vidéos sans autre date que celle du fichier': 'Photos and videos with no date other than the file’s',
  '{0} — modifié le {1}': '{0} — modified on {1}',
  'Fichiers de la sortie hors du plan': 'Files in the output that are not in the plan',
  'Présents dans la sortie mais absents du plan (déposés à la main, ou anciennes copies) : ils n’ont pas été touchés.':
    'In the output but not in the plan (added by hand, or old copies): they have not been touched.',
  Fichiers: 'Files',

  // tarifs.ts : noms des modèles
  'Claude Haiku 5.5 (rapide)': 'Claude Haiku 5.5 (fast)',
  'Claude Sonnet 5.5 (standard)': 'Claude Sonnet 5.5 (standard)',
  'Claude Opus 5.5 (avancé)': 'Claude Opus 5.5 (advanced)',
  'Claude Haiku 4.5 (ancien, scripts)': 'Claude Haiku 4.5 (old, scripts)',
  'Claude Sonnet 4.6 (ancien, scripts)': 'Claude Sonnet 4.6 (old, scripts)',

  // tri.ts
  'Trier par lieux et sorties': 'Sort by places and outings',

  // plan.ts : choix par sous-dossier (étape « Dossiers », D61)
  'Ne pas toucher': 'Leave as is',

  // plan.ts : recadrage (D62)
  'Recadrer {0}': 'Crop {0}',
  'Enlever le recadrage de {0}': 'Remove the crop of {0}',

  // rapport.ts, source.ts : trier en plusieurs fois (D63)
  '{0} fichiers de la source ne sont pas dans le projet (arrivés ou modifiés depuis l’inventaire) : mettez à jour l’inventaire, ne supprimez pas la source.':
    '{0} source files are not in the project (added or changed since the inventory): update the inventory, do not delete the source.',
  'Fichiers de la source pas encore dans le projet': 'Source files not yet in the project',
  'Mettre à jour l’inventaire': 'Update the inventory',
};
