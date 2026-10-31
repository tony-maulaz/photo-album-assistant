// Retours du 29.10, étape 4 (D112 point 10) : Lieux et sorties et Petits dossiers (ligne de dossier commune,
// icônes à bulle, menu « … », « Mettre dans un autre dossier », Chronologie, renommer un petit dossier).

export const TEXTES: Record<string, string> = {
  // Ligne de dossier commune et ses icônes.
  'Nouveau nom de « {0} »': 'New name for “{0}”',
  'Nouveau : créé par le tri automatique, il n’existe pas dans votre dossier d’origine': 'New: created by the automatic sorting, it does not exist in your original folder',
  'Nouveau : créé à la main, il n’existe pas dans votre dossier d’origine': 'New: created by hand, it does not exist in your original folder',
  'Votre calendrier pendant ce dossier': 'Your calendar during this folder',
  'Petit dossier : {0}': 'Small folder: {0}',
  'Il sera traité à l’étape suivante, « Petits dossiers », qui vous proposera un dossier voisin. Rien à faire ici.': 'It will be handled at the next step, “Small folders”, which will suggest a neighbouring folder. Nothing to do here.',
  'Moins de {0} photos : vous pouvez le réunir avec un autre dossier (menu « … »).': 'Fewer than {0} photos: you can gather it with another folder (“…” menu).',

  // Menu « … » et ses fenêtres.
  'Actions sur « {0} »': 'Actions on “{0}”',
  'Renommer, réunir, mettre dans un autre dossier… (aussi au clic droit)': 'Rename, gather, put in another folder… (also with a right-click)',
  'Renommer, réunir, mettre dans un autre dossier… (Maj+F10)': 'Rename, gather, put in another folder… (Shift+F10)',
  'Renommer « {0} » (F2)': 'Rename “{0}” (F2)',
  'Renommer (F2, ou double-clic sur le dossier à gauche)': 'Rename (F2, or double-click the folder on the left)',
  'Réunir avec un autre dossier…': 'Gather with another folder…',
  'Il est vide : rien à réunir.': 'It is empty: nothing to gather.',
  'Ses photos y vont ; ce dossier disparaît.': 'Its photos go there; this folder disappears.',
  'Mettre dans un autre dossier…': 'Put in another folder…',
  'Mettre dans un autre dossier': 'Put in another folder',
  'Il devient un sous-dossier, ses photos restent.': 'It becomes a subfolder; its photos stay in it.',
  'Il devient un sous-dossier du dossier choisi, avec ses photos. Les plus proches dans le temps sont en tête.': 'It becomes a subfolder of the chosen folder, with its photos. The closest in time come first.',
  '↑ ↓ pour choisir, Entrée pour l’y mettre, Échap pour fermer.': '↑ ↓ to choose, Enter to put it there, Esc to close.',
  '« {0} » est maintenant dans « {1} ».': '“{0}” is now in “{1}”.',
  'Déplacer les photos choisies…': 'Move the chosen photos…',
  '{0}, vers un autre dossier.': '{0}, to another folder.',
  'Choisissez d’abord des photos.': 'Choose photos first.',
  'Ouvrez ce dossier et choisissez des photos.': 'Open this folder and choose photos.',
  'Retirer ce dossier': 'Remove this folder',
  'Il est vide : il ne sera pas créé.': 'It is empty: it will not be created.',
  'Seulement s’il est vide.': 'Only if it is empty.',
  'Dossier vide « {0} » retiré.': 'Empty folder “{0}” removed.',

  // Tête du dossier ouvert : Photos · Chronologie, petit dossier.
  Vue: 'View',
  Chronologie: 'Timeline',
  'Petit dossier.': 'Small folder.',
  'Il sera traité à l’étape suivante, « Petits dossiers » : rien à faire ici.': 'It will be handled at the next step, “Small folders”: nothing to do here.',
  'Moins de {0} photos : vous pouvez le réunir avec un autre dossier.': 'Fewer than {0} photos: you can gather it with another folder.',
  'Le réunir maintenant…': 'Gather it now…',

  // Petits dossiers.
  'Ses photos y vont ; ce petit dossier disparaît.': 'Its photos go there; this small folder disappears.',
  'Nom proposé par l’IA.': 'Name suggested by the AI.',
  'mis avec « {0} »': 'put with “{0}”',
  'Outils des petits dossiers': 'Small folder tools',
  'Pris à moins d’une heure et de 10 km d’un autre dossier': 'Taken less than an hour and 10 km from another folder',
  '1 petit dossier a un voisin évident : voir': '1 small folder has an obvious neighbour: see',
  '{0} petits dossiers ont un voisin évident : les voir': '{0} small folders have an obvious neighbour: see them',
  '{0} sur {1} décidés': '{0} of {1} decided',
  'Renommer (F2)': 'Rename (F2)',
  'Renommer, réunir avec un autre dossier… (Maj+F10)': 'Rename, gather with another folder… (Shift+F10)',
  'Clavier : ← avec le dossier d’avant, → avec celui d’après, G garder seul, J et K petit dossier suivant ou précédent, F2 renommer, Ctrl+Z annuler.':
    'Keyboard: ← with the folder before, → with the one after, G keep alone, J and K next or previous small folder, F2 rename, Ctrl+Z undo.',

  // Raccourcis et Aide.
  'Maj+F10 ou clic droit': 'Shift+F10 or right-click',
  'Menu « … » du dossier : renommer, réunir, mettre dans un autre dossier, retirer s’il est vide': 'Folder “…” menu: rename, gather, put in another folder, remove if empty',
  'Mettre le petit dossier avec le dossier d’avant, d’après': 'Put the small folder with the folder before, after',
  'Le garder seul': 'Keep it alone',
  'J et K': 'J and K',
  'Petit dossier suivant, précédent': 'Next, previous small folder',
  'Renommer le petit dossier affiché': 'Rename the small folder shown',
  'Maj+F10': 'Shift+F10',
  'Menu « … » du petit dossier : renommer, réunir avec un autre dossier': 'Small folder “…” menu: rename, gather with another folder',
  ' : rattachez-les à une sortie voisine, ou gardez-les à part ; le crayon, F2 ou le menu « … » les renomment.': ': attach them to a neighbouring outing, or keep them apart; the pencil, F2 or the “…” menu rename them.',
  'Le menu « … » d’un dossier (au bout de sa ligne, à côté de son nom en haut, au clic droit ou avec Maj+F10) le renomme, le réunit avec un autre, le met dans un autre dossier (il en devient un sous-dossier) ou le retire s’il est vide. Glisser un dossier sur un autre les réunit aussi ; double-cliquez sur un nom, ou F2, pour le renommer. Dans un dossier de plusieurs jours, chaque journée a son titre, avec les événements du calendrier (un clic choisit leurs photos) ; « Nouveau dossier avec cette journée » la sort du dossier. « Chronologie » montre les dossiers sur une ligne de temps.':
    'A folder’s “…” menu (at the end of its line, next to its name at the top, with a right-click or Shift+F10) renames it, gathers it with another, puts it in another folder (it becomes a subfolder) or removes it if it is empty. Dragging a folder onto another also gathers them; double-click a name, or press F2, to rename it. In a folder of several days, each day has its title, with the calendar events (a click chooses their photos); “New folder with this day” takes it out of the folder. “Timeline” shows the folders on a timeline.',
  'Sous le nom de chaque dossier, sa période, puis de petites icônes : le calendrier (ses événements dans une bulle) et le petit dossier (traité à l’étape suivante quand vous triez un dossier en vrac). Les badges signalent ce qui mérite un coup d’œil : très grand, lieu inconnu, sans date, nom en double, même sortie qu’un dossier voisin (photos prises à la suite, au même endroit).':
    'Under each folder’s name, its period, then small icons: the calendar (its events in a bubble) and the small folder (handled at the next step when you sort an unsorted folder). The badges point out what deserves a look: very large, unknown place, no date, duplicate name, same outing as a neighbouring folder (photos taken one after the other, at the same place).',
};
