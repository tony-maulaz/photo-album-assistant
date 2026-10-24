// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Lot « album » de la campagne de tests du 24.10.2026.

export const TEXTES: Record<string, string> = {
  // album.ts : textes_album.md (titre, couverture, plan des pages)
  "Titre de l'album : {0}": 'Album title: {0}',
  'Couverture : `{0}`': 'Cover: `{0}`',
  'Couverture : pas encore choisie (étape « Album »).': 'Cover: not chosen yet (“Album” step).',
  "Pages de l'aperçu : 0001, 0002… sont les photos du dossier « Album » ; ★★ = une photo seule, en pleine page.":
    'Pages of the preview: 0001, 0002… are the photos of the “Album” folder; ★★ = a photo on its own, full page.',
  '- Page {0} : {1} ★★ (pleine page)': '- Page {0}: {1} ★★ (full page)',
  '- Page {0} : {1}': '- Page {0}: {1}',
  'Légendes :': 'Captions:',

  // AidesPhotos.tsx : couvertures proposées (IA14)
  'Couvertures proposées : voyez-les sous « Couverture », en tête de l’aperçu des pages.': 'Suggested covers: see them under “Cover”, at the top of the page preview.',

  // Album.tsx : couverture et titre de l'album
  'Titre de l’album': 'Album title',
  'Couverture et titre de l’album': 'Cover and album title',
  Couverture: 'Cover',
  'Pas encore de couverture : cliquez une photo de l’album, puis « Choisir comme couverture ».': 'No cover yet: click a photo of the album, then “Choose as cover”.',
  'Couvertures proposées :': 'Suggested covers:',
  'Copiée en tête du dossier « Album » sous le nom « {0} ».': 'Copied at the start of the “Album” folder under the name “{0}”.',
  'Ne plus en faire la couverture': 'No longer use as cover',
  'Choisir comme couverture': 'Choose as cover',

  // Album.tsx : écart à la cible de pages
  'Il manque {0}': '{0} missing',
  '{0} de trop': '{0} too many',
  'retenez environ {0} de plus': 'add about {0} to the selection',
  'retirez environ {0}': 'remove about {0}',
  '{0} pour atteindre la cible : {1}': '{0} to reach the target: {1}',
  ', ou': ', or',
  'passez à {0} par page': 'switch to {0} per page',

  // Album.tsx : copies retenues deux fois
  '{0} de l’album : la même photo était retenue dans deux dossiers.': '{0} from the album: the same photo was selected in two folders.',
  'photo en double retirée': 'duplicate photo removed',
  'photos en double retirées': 'duplicate photos removed',
  '{0} (« {1} ») : déjà dans « {2} »': '{0} (“{1}”): already in “{2}”',
};
