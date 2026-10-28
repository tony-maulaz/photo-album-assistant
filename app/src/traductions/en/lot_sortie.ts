// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Lot « sortie » de la campagne de tests du 24.10.2026.

export const TEXTES: Record<string, string> = {
  // rapport.ts : phrase de bilan qui dit vrai (dossier à trier relu, D63)
  '{0} dans le projet → {1} dans la sortie : {2}.': '{0} in the project → {1} in the output: {2}.',
  '{0} dans le dossier à trier, {1} dans le projet → {2} dans la sortie : {3}.': '{0} in the folder to sort, {1} in the project → {2} in the output: {3}.',

  // rapport.ts, Sortie.tsx : fichiers qui ne sont plus dans le dossier à trier
  '{0} fichiers ne sont plus dans le dossier à trier (supprimés, renommés ou déplacés depuis l’inventaire) : ils ne peuvent pas être copiés.':
    '{0} files are no longer in the folder to sort (deleted, renamed or moved since the inventory): they cannot be copied.',
  '{0} fichier n’est plus dans le dossier à trier (supprimé, renommé ou déplacé depuis l’inventaire) : il ne peut pas être copié.':
    '{0} file is no longer in the folder to sort (deleted, renamed or moved since the inventory): it cannot be copied.',
  'Mettez à jour l’inventaire.': 'Update the inventory.',
  'Fichiers qui ne sont plus dans le dossier à trier': 'Files no longer in the folder to sort',

  // rapport.ts : accords au singulier
  '{0} fichier de la source n’est pas dans le projet (arrivé ou modifié depuis l’inventaire) : mettez à jour l’inventaire, ne supprimez pas la source.':
    '{0} source file is not in the project (added or changed since the inventory): update the inventory, do not delete the source.',
  '… et {0} autre': '… and {0} more',
  '{0} photo dans {1} ({2}, environ {3}) : importez-la dans ifolor.': '{0} photo in {1} ({2}, about {3}): import it into ifolor.',
  '{0} (ni photo ni vidéo), dans {1} avec son chemin d’origine': '{0} (neither photo nor video), in {1} with its original path',
  'Présent dans la sortie mais absent du plan (déposé à la main, ou ancienne copie) : il n’a pas été touché.':
    'In the output but not in the plan (added by hand, or an old copy): it has not been touched.',

  // Sortie.tsx : aperçu
  'Rien à copier ni à déplacer : {0} déjà en place.': 'Nothing to copy or move: {0} already in place.',
  '{0} fichiers ont changé dans le dossier à trier depuis leur copie : leur nouvelle version remplacera l’ancienne copie.':
    '{0} files have changed in the folder to sort since they were copied: their new version will replace the old copy.',
  '{0} fichier a changé dans le dossier à trier depuis sa copie : sa nouvelle version remplacera l’ancienne copie.':
    '{0} file has changed in the folder to sort since it was copied: its new version will replace the old copy.',
  '{0} fichiers ne peuvent pas être écrits : d’autres fichiers, que l’application n’a pas écrits, occupent déjà leur place (par exemple {1}). Ils ne sont jamais écrasés : déplacez-les, puis relancez.':
    '{0} files cannot be written: other files, not written by the application, already take their place (for example {1}). They are never overwritten: move them, then run again.',
  '{0} fichiers de « Album » n’ont pas été écrits par l’application et occupent des places prévues : ils ne sont pas touchés. Déplacez-les pour que l’album soit complet.':
    '{0} files in “Album” were not written by the application and take places planned for the album: they are not touched. Move them so that the album is complete.',
  '{0} de l’album, et les textes ({1})': '{0} from the album, and the texts ({1})',

  // Sortie.tsx : bilan, accords au singulier
  ' (arrivé ou modifié depuis l’inventaire) : il n’est pas dans la sortie. Ne supprimez pas le dossier d’origine.':
    ' (added or changed since the inventory): it is not in the output. Do not delete the original folder.',
  '… et {0} autre (voir le rapport)': '… and {0} more (see the report)',
  '{0} de la sortie hors du plan (laissé tel quel, listé dans le rapport).': '{0} in the output outside the plan (left as it is, listed in the report).',
  '{0} sans autre date que celle du fichier : sa date d’origine est dans le rapport.': '{0} with no date other than the file date: its original date is in the report.',

  // Sortie.tsx : journal
  copié: 'copied',
  copiés: 'copied',
  déplacé: 'moved',
  déplacés: 'moved',
  copiée: 'copied',
  copiées: 'copied',
  renommée: 'renamed',
  renommées: 'renamed',
  retirée: 'removed',
  retirées: 'removed',

  // Sortie.tsx : « Et maintenant ? » après une sortie complète
  'Et maintenant ?': 'What next?',
  'Copiez le dossier « {0} » à son emplacement définitif (disque externe, NAS…), puis vérifiez la copie.':
    'Copy the folder “{0}” to its final location (external disk, NAS…), then check the copy.',
  'Livre photo : importez dans ifolor les photos du dossier « Album », numérotées dans l’ordre de l’album. Titres, introductions et légendes : « Album/{0} ».':
    'Photo book: import the photos of the “Album” folder into ifolor; they are numbered in album order. Titles, introductions and captions: “Album/{0}”.',
  'Ensuite seulement, vous pouvez supprimer vous-même les photos du dossier d’origine « {0} » : l’application ne supprime jamais rien.':
    'Only then can you delete the photos of the original folder “{0}” yourself: the application never deletes anything.',
  'De nouvelles photos plus tard ? Mettez-les dans « {0} », rouvrez ce projet depuis l’accueil et choisissez « Mettre à jour l’inventaire » : ce qui est déjà trié est gardé.':
    'New photos later? Put them in “{0}”, reopen this project from the home page and choose “Update the inventory”: what is already sorted is kept.',
};
