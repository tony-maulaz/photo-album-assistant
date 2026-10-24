// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Lot « rangement » de la campagne de tests du 24.10.2026.

export const TEXTES: Record<string, string> = {
  // lib/fragments.ts
  'Ressortir « {0} » de « {1} »': 'Take “{0}” back out of “{1}”',

  // PanneauDossiers.tsx
  '{0} avec la mise à jour de l’inventaire, pas encore dans la sortie': '{0} with the inventory update, not yet in the output',
  'photo ou vidéo arrivée': 'photo or video arrived',
  'photos ou vidéos arrivées': 'photos or videos arrived',
  nouveau: 'new',
  'Photos ajoutées à la source après le premier tri (mise à jour de l’inventaire), pas encore écrites dans la sortie':
    'Photos added to the source after the first sort (inventory update), not yet written to the output',
  'Seulement les nouveautés ({0})': 'New photos only ({0})',

  // Organiser.tsx
  'dans ses sous-dossiers': 'in its subfolders',
  '« {0} » ne contient que des sous-dossiers : voici leurs photos, avec le nom du sous-dossier sous chacune. Cliquez sur un sous-dossier à gauche pour ne voir que le sien.':
    '“{0}” only contains subfolders: here are their photos, with the subfolder name under each one. Click a subfolder on the left to see only its own.',

  // Nommage.tsx
  'renommé, avant : {0}': 'renamed, before: {0}',
  'Entrée pour renommer': 'Press Enter to rename',
  'Des noms saisis ne sont pas appliqués': 'Some typed names are not applied',
  '{0} sans cliquer sur « Renommer » :': '{0} without clicking “Rename”:',
  'nom saisi': 'name typed',
  'noms saisis': 'names typed',
  'Ne pas les appliquer': 'Do not apply them',
  'Appliquer et continuer': 'Apply and continue',
  'Accepter {0} ?': 'Accept {0}?',
  nom: 'name',
  noms: 'names',
  'Accepter le nom de confiance 8 ou plus': 'Accept the name with confidence 8 or more',
  'Dont {0} : relisez-les si possible. Ctrl+Z annule.': 'Including {0}: please review them if you can. Ctrl+Z undoes.',
  'nom proposé avec une confiance inférieure à 8': 'name suggested with a confidence below 8',
  'noms proposés avec une confiance inférieure à 8': 'names suggested with a confidence below 8',
  'Tout accepter': 'Accept all',
  'Aussi les noms de confiance inférieure à 8 (une confirmation est demandée)': 'Also the names with a confidence below 8 (you will be asked to confirm)',
  'Tout accepter ({0})…': 'Accept all ({0})…',

  // Organisation.tsx : petits dossiers
  'Impossible de ressortir « {0} » : ses photos ont été déplacées depuis.': 'Cannot take “{0}” back out: its photos have been moved since.',
  '« {0} » est ressorti de « {1} ».': '“{0}” is back out of “{1}”.',
  'Rattacher « {0} » à « {1} »': 'Attach “{0}” to “{1}”',
  'Rattacher {0}': 'Attach {0}',
  'Accepter la proposition sûre (confiance 8 ou plus)': 'Accept the safe suggestion (confidence 8 or more)',
  'Rattacher « {0} » à…': 'Attach “{0}” to…',
  'Ses photos rejoignent le dossier choisi, puis « {0} » disparaît. Les dossiers les plus proches dans le temps sont en tête.':
    'Its photos join the chosen folder, then “{0}” disappears. The folders closest in time come first.',
  ' · même période': ' · same period',
  ' · à {0}': ' · {0} away',
  jour: 'day',
  jours: 'days',
  'Aucun dossier ne correspond.': 'No folder matches.',
  'pendant cette sortie': 'during this outing',
  'à {0} min': '{0} min away',
  'photos très semblables': 'very similar photos',
  'photos semblables': 'similar photos',
  'photos peu semblables': 'rather different photos',
  'Réunir les petits dossiers du {0}': 'Group the small folders of {0}',
  'petit dossier réuni': 'small folder grouped',
  'petits dossiers réunis': 'small folders grouped',
  'rattaché à « {0} »': 'attached to “{0}”',
  'gardé à part': 'kept separate',
  'Chaque petit dossier a sa décision : vous pouvez continuer.': 'Every small folder has its decision: you can continue.',
  'Près d’autres sorties': 'Near other outings',
  'Différence entre les photos : {0} (0 = identiques)': 'Difference between the photos: {0} (0 = identical)',
  'Choisir n’importe quel dossier': 'Choose any folder',
  'Rattacher à…': 'Attach to…',
  'Sans sortie voisine à moins de 12 h': 'No neighbouring outing within 12 h',
  'Rattachez-les au dossier de votre choix (les plus proches dans le temps sont proposés d’abord), réunissez ceux d’une même journée, ou gardez-les à part.':
    'Attach them to the folder of your choice (the closest in time are suggested first), group those of the same day, or keep them separate.',
  'Le {0} : {1} le même jour': '{0}: {1} on the same day',
  'Les réunir dans « {0} »': 'Group them in “{0}”',

  // Organisation.tsx : consolidation
  '« {0} » et « {1} » ne seront plus proposés ensemble.': '“{0}” and “{1}” will no longer be suggested together.',
  '{0} : elles ne sont plus proposées.': '{0}: they are no longer suggested.',
  'paire ignorée': 'pair ignored',
  'paires ignorées': 'pairs ignored',
  'les proposer à nouveau': 'suggest them again',
  'Ce ne sont pas les mêmes sorties : ne plus proposer ces deux dossiers ensemble': 'These are not the same outings: stop suggesting these two folders together',
  'Ignorer cette paire': 'Ignore this pair',
};
