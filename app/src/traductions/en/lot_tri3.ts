// Retours du 29.10, étape 3 (D112 point 9) : Tri automatique (bandeau des copies restantes, bouton « N photos »
// et son dépliant, icône calendrier et sa bulle, une seule phrase sur les noms) et la fenêtre « Vos lieux »
// (onglets « À nommer » et « Nommés », corriger un nom).

export const TEXTES: Record<string, string> = {
  // Bandeau des copies exactes restées à Doublons.
  'Il reste 1 copie exacte à accepter à l’étape Doublons.': '1 exact copy is still to be accepted at the Duplicates step.',
  'Il reste {0} copies exactes à accepter à l’étape Doublons.': '{0} exact copies are still to be accepted at the Duplicates step.',
  'Le tri les a rangées une seconde fois : écartez-les, puis rangez à nouveau.': 'The sorting arranged them a second time: set them aside, then arrange again.',
  'Sans cela, le tri les rangerait une seconde fois.': 'Otherwise, the sorting would arrange them a second time.',
  'Aller à Doublons': 'Go to Duplicates',
  'Les écarter ici': 'Set them aside here',
  'écarter {0}': 'set {0} aside',

  // Liste « À faire » : vos lieux.
  'Vos lieux : {0} à nommer': 'Your places: {0} to name',
  'Vos lieux : {0}': 'Your places: {0}',
  'lieu nommé': 'place named',
  'lieux nommés': 'places named',
  '{0}. Un nom donne de meilleurs noms de dossiers.': '{0}. A name gives better folder names.',
  'déjà nommé': 'already named',
  'déjà nommés': 'already named',
  'Photographiés sur de nombreux jours. Un nom donne de meilleurs noms de dossiers.': 'Photographed on many days. A name gives better folder names.',
  'Revoyez-les, corrigez un nom.': 'Review them, correct a name.',
  'Les voir…': 'See them…',

  // Liste des dossiers : une seule phrase, le bouton des photos, le dépliant.
  'Les noms des dossiers se choisissent plus tard, à l’étape Nommage.': 'Folder names are chosen later, at the Naming step.',
  'Voir 1 photo de « {0} »': 'See 1 photo of “{0}”',
  'Voir les {0} photos de « {1} »': 'See the {0} photos of “{1}”',
  'Voir en grand : {0}': 'View large: {0}',
  'Voir les {0} en grand': 'View all {0} large',
  '2 photos par lieu visité, prises au début et à la fin': '2 photos per place visited, taken at the start and at the end',
  '{0} photos sur {1}, réparties de {2} à {3}': '{0} photos out of {1}, spread from {2} to {3}',
  '{0} photos sur {1}, réparties du {2}': '{0} photos out of {1}, spread from {2}',

  // L'icône calendrier et sa bulle.
  'Votre calendrier pendant ce voyage': 'Your calendar during this trip',
  'Votre calendrier pendant cette sortie': 'Your calendar during this outing',
  'Votre calendrier pendant cette période': 'Your calendar during this period',
  'Votre calendrier : « {0} »': 'Your calendar: “{0}”',
  'Votre calendrier : {0} événements pendant ce dossier': 'Your calendar: {0} events during this folder',
  'la plupart des photos': 'most of the photos',
  'et {0}': 'and {0}',
  'Échap ou un clic ailleurs pour fermer': 'Esc or a click elsewhere to close',

  // Fenêtre « Vos lieux ».
  'Vos lieux': 'Your places',
  Nommés: 'Named',
  'tout est nommé': 'all named',
  lieux: 'places',
  'Remis à plus tard : {0}': 'Put off until later: {0}',
  'Le remontrer': 'Show it again',
  'Les remontrer': 'Show them again',
  'Donnez-leur un nom : vos dossiers s’appelleront « Chez Mamie » plutôt que le nom de la commune. Un nom sert à tous vos albums.':
    'Give them a name: your folders will be called “At Grandma’s” rather than the name of the town. A name is used for all your albums.',
  'Donnez-leur un nom : vos dossiers s’appelleront « Chez Mamie » plutôt que le nom de la commune. Un nom sert à tous vos albums. Indiquez aussi lequel est votre maison.':
    'Give them a name: your folders will be called “At Grandma’s” rather than the name of the town. A name is used for all your albums. Also say which one is your home.',
  'L’adresse vient d’OpenStreetMap : seule la position est envoyée.': 'The address comes from OpenStreetMap: only the position is sent.',
  '{0}, retirer un lieu, changer son rayon :': '{0}, remove a place, change its radius:',
  'autre lieu': 'other place',
  'autres lieux': 'other places',
  'Retirer un lieu, changer son rayon :': 'Remove a place, change its radius:',
  'Plus rien à nommer pour l’instant : les lieux remis à plus tard reviennent avec « Le remontrer ».': 'Nothing more to name for now: the places put off until later come back with “Show it again”.',
  'Tout est nommé. Vos lieux nommés sont dans l’onglet « Nommés ».': 'Everything is named. Your named places are in the “Named” tab.',
  'Aucun lieu nommé où ce projet a des photos.': 'No named place where this project has photos.',
  'Notre maison': 'Our home',
  'Aucune photo de ce projet': 'No photo from this project',
  'Voir la photo': 'See the photo',
  'Voir les {0} photos': 'See the {0} photos',
  'attend un nom': 'waiting for a name',
  'nom inchangé': 'name unchanged',
  'Ne plus le proposer pendant cette séance': 'Do not suggest it again during this session',
  '{0} ce nom.': '{0} this name.',
  'dossier de ce projet prendra': 'folder of this project will take',
  'dossiers de ce projet prendront': 'folders of this project will take',
  'Aucun dossier de ce projet ne porte ce nom : seule la configuration change.': 'No folder of this project bears this name: only the configuration changes.',
  'Ceux que vous avez renommés gardent le leur.': 'Those you renamed keep theirs.',

  // Corriger le nom d'un lieu : la configuration et le plan, gardés d'accord.
  'Corriger le nom d’un lieu': 'Correct the name of a place',
  'Renommer le lieu « {0} » en « {1} »': 'Rename the place “{0}” to “{1}”',
  'aucune configuration n’est choisie.': 'no configuration is chosen.',
  'ce lieu n’est plus dans la configuration.': 'this place is no longer in the configuration.',
  'Un autre lieu s’appelle déjà « {0} » : choisissez un autre nom.': 'Another place is already called “{0}”: choose another name.',
  'Le nom n’a pas pu être enregistré dans la configuration ({0}). Rien n’a changé.': 'The name could not be saved in the configuration ({0}). Nothing has changed.',
  'La configuration n’a pas suivi ({0}) : le lieu y garde son autre nom. Mettez « {1} » dans la Configuration.': 'The configuration did not follow ({0}): the place keeps its other name there. Put “{1}” in the Configuration.',
  '« {0} » enregistré : {1}.': '“{0}” saved: {1}.',
  '« {0} » enregistré.': '“{0}” saved.',

  // Aide, mode d'emploi et raccourcis du Tri.
  'Pour couper un dossier ou déplacer des photos : étape suivante, « Lieux et sorties ». Les noms des dossiers se choisissent à l’étape Nommage.':
    'To split a folder or move photos: next step, “Places and outings”. Folder names are chosen at the Naming step.',
  '« Vos lieux » : donnez un nom aux lieux qui reviennent souvent, revoyez ceux déjà nommés (onglet « Nommés ») et corrigez un nom : les dossiers de ce projet qui portent encore le nom automatique le prennent. Un nom sert à tous vos albums.':
    '“Your places”: give a name to the places that come up often, review those already named (“Named” tab) and correct a name: the folders of this project that still bear the automatic name take it. A name is used for all your albums.',
  ' : rangez à part les captures d’écran, nommez vos lieux (et corrigez un nom dans « Nommés »), choisissez comment ranger (le résultat se voit tout de suite), puis « Ranger les photos » ; « 38 photos » montre quelques photos d’un dossier, l’icône calendrier ses événements ; l’IA peut situer les photos sans GPS. Un bandeau rappelle les copies exactes restées à l’étape Doublons.':
    ': put screenshots aside, name your places (and correct a name in “Named”), choose how to arrange (the result shows straight away), then “Arrange the photos”; “38 photos” shows a few photos of a folder, the calendar icon its events; AI can place the photos without GPS. A banner recalls the exact copies left at the Duplicates step.',
  'Tab puis Entrée': 'Tab then Enter',
  'Sur « N photos » : déplier quelques photos du dossier ; sur l’icône calendrier : garder ses événements ouverts': 'On “N photos”: unfold a few photos of the folder; on the calendar icon: keep its events open',
  'Fermer la bulle du calendrier, la vue en grand ou la fenêtre « Vos lieux »': 'Close the calendar bubble, the large view or the “Your places” window',
  'Entrée dans « Nom »': 'Enter in “Name”',
  'Enregistrer le nom d’un lieu (« Vos lieux »)': 'Save the name of a place (“Your places”)',
};
