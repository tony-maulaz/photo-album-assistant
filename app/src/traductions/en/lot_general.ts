// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Lot « general » de la campagne de tests du 24.10.2026.

export const TEXTES: Record<string, string> = {
  // Erreurs de l'API Claude, expliquées (navigateur/claude.ts)
  'Le service Claude ne répond pas à temps : vérifiez la connexion à internet, puis réessayez.': 'The Claude service is not answering in time: check the internet connection, then try again.',
  'Demande trop volumineuse (413) : relancez avec moins de photos à la fois.': 'Request too large (413): run it again with fewer photos at a time.',
  'Le service Claude est surchargé pour le moment (529) : réessayez dans quelques minutes.': 'The Claude service is overloaded right now (529): try again in a few minutes.',
  'Le service Claude a un problème passager ({0}) : réessayez plus tard.': 'The Claude service has a temporary problem ({0}): try again later.',
  'Crédit API épuisé : rechargez le compte sur console.anthropic.com, puis réessayez.': 'API credit used up: top up the account on console.anthropic.com, then try again.',

  // Réponses illisibles (navigateur/ia.ts, AidesIA.tsx, Pages.tsx)
  '{0} : réponse inutilisable, gardée comme illisible': '{0}: unusable answer, kept as unreadable',
  'refusée par l’IA': 'refused by the AI',
  'trop longue, coupée': 'too long, cut off',
  ' {0} : cliquez sur « Redemander » sous le bouton de l’aide.': ' {0}: click “Ask again” under the helper’s button.',
  'réponse illisible': 'unreadable answer',
  'réponses illisibles': 'unreadable answers',
  'Réponses de l’IA impossibles à lire, ou refusées : gardées pour ne pas les payer deux fois. « Redemander » les envoie à nouveau.':
    'AI answers that could not be read, or were refused: kept so as not to pay for them twice. “Ask again” sends them again.',
  'Redemander ({0})': 'Ask again ({0})',
  Redemander: 'Ask again',

  // Frise et liste des étapes (Cadre.tsx)
  'rien à décider': 'nothing to decide',
  'inutile ici': 'not needed here',
  'après l’étape {0}': 'after step {0}',

  // Raccourcis clavier (Raccourcis.tsx)
  'Rien à annuler.': 'Nothing to undo.',
  'Rien à rétablir.': 'Nothing to redo.',
  'Annuler la dernière modification (pages des étapes)': 'Undo the last change (step pages)',
  'Ctrl+Y ou Ctrl+Maj+Z': 'Ctrl+Y or Ctrl+Shift+Z',
  'Rétablir ce qui a été annulé': 'Redo what was undone',
  'Afficher cette liste': 'Show this list',
  'Fermer une fenêtre, désélectionner': 'Close a window, clear the selection',
  'Clic, Ctrl+clic, Maj+clic': 'Click, Ctrl+click, Shift+click',
  'Sélectionner une photo, en ajouter une, une plage': 'Select a photo, add one, a range',
  'Passer d’une photo à l’autre (avec Maj : étendre la sélection)': 'Move from one photo to the next (with Shift: extend the selection)',
  'Sauver les photos sélectionnées': 'Keep the selected photos',
  'X ou Suppr': 'X or Delete',
  'Écarter les photos sélectionnées': 'Set the selected photos aside',
  'Tout sélectionner': 'Select all',
  'Déplacer la sélection vers un dossier': 'Move the selection to a folder',
  '1 à 9': '1 to 9',
  'Déplacer vers un des derniers dossiers utilisés': 'Move to one of the last folders used',
  Suppr: 'Delete',
  'Mettre de côté (dans « Mis de côté » : remettre)': 'Set aside (in “Set aside”: put back)',
  'Renommer le dossier affiché': 'Rename the folder shown',
  Entrée: 'Enter',
  'Voir la photo en grand (← → : la suivante)': 'View the photo full size (← →: the next one)',
  'Espace ou 1': 'Space or 1',
  'Pas pour l’album (elle reste dans l’archive)': 'Not for the album (it stays in the archive)',
  'Retirer le choix': 'Remove the choice',
  'R (Maj+R)': 'R (Shift+R)',
  'Tourner d’un quart de tour (dans l’autre sens)': 'Rotate a quarter turn (the other way)',
  'Comparer 2 à 4 photos': 'Compare 2 to 4 photos',
  'Déplacer vers une autre sortie': 'Move to another outing',
  'T ou Entrée': 'T or Enter',
  'Tri rapide, une photo à la fois': 'Quick sort, one photo at a time',
  'Raccourcis clavier': 'Keyboard shortcuts',
  Partout: 'Everywhere',
  'Étape {0} : {1}': 'Step {0}: {1}',
  'Les raccourcis ne marchent pas pendant la saisie d’un texte.': 'Shortcuts do not work while typing text.',

  // Pages du menu (Pages.tsx)
  '← Retour': '← Back',
  'Analyse des photos': 'Photo analysis',
  'Écriture de la sortie': 'Writing the output',
  Alerte: 'Warning',
  '{0} {1} : {2} CHF ({3})': '{0} {1}: {2} CHF ({3})',
  'oui (option cochée)': 'yes (option ticked)',
  'en option': 'optional',
  'Pour commencer': 'Getting started',
  'À l’accueil, choisissez « Trier un nouveau dossier » (ou « Ouvrir un dossier déjà trié ») : indiquez le dossier de photos, puis un dossier vide où le résultat sera écrit.':
    'On the home page, choose “Sort a new folder” (or “Open an already sorted folder”): pick the photo folder, then an empty folder where the result will be written.',
  'Suivez les étapes dans l’ordre. En haut de chaque page, une explication dit quoi faire ; quand tout vous convient, cliquez sur « Valider et continuer », en bas à droite.':
    'Follow the steps in order. At the top of each page, an explanation says what to do; when everything suits you, click “Confirm and continue”, at the bottom right.',
  'Rien ne presse : vos photos d’origine ne sont jamais modifiées, Ctrl+Z annule la dernière modification, et vous pouvez fermer l’onglet à tout moment.':
    'No rush: your original photos are never changed, Ctrl+Z undoes the last change, and you can close the tab at any time.',
  'Les aides IA (boutons ✦) sont facultatives : elles affichent leur prix avant de partir et demandent une clé API (menu ☰, Réglages).':
    'The AI helpers (✦ buttons) are optional: they show their price before being sent and need an API key (☰ menu, Settings).',
  'Touche « ? » (hors d’un champ de saisie) : la liste des raccourcis clavier.': '“?” key (outside a text field): the list of keyboard shortcuts.',
};
