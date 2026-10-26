// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Aperçu du tri automatique (ApercuTri.tsx) : chiffres, frise d'exemple, liste des dossiers prévus.

export const TEXTES: Record<string, string> = {
  // Raisons des exemples
  'la semaine la plus chargée': 'the busiest week',
  'le plus long voyage': 'the longest trip',
  'une semaine à la maison': 'a week at home',
  'là où il y a le plus de petits dossiers': 'where there are the most small folders',
  'le plus grand dossier': 'the largest folder',
  // Chiffres et répartition par taille
  'Résultat avec vos photos': 'Result with your photos',
  'Aucun dossier prévu : il n’y a pas de photo à trier.': 'No folder planned: there is no photo to sort.',
  dossier: 'folder',
  dossiers: 'folders',
  voyage: 'trip',
  voyages: 'trips',
  'très petit': 'very small',
  'très petits': 'very small',
  '(1-2 photos)': '(1-2 photos)',
  'très grand': 'very large',
  'très grands': 'very large',
  '{0} photos : {1}': '{0} photos: {1}',
  '{0} — cliquer pour en voir un exemple': '{0} — click to see an example',
  'Photos par dossier :': 'Photos per folder:',
  'Voir un exemple de très petits dossiers': 'See an example of very small folders',
  // Exemple et frise
  'Exemple précédent': 'Previous example',
  'Exemple suivant': 'Next example',
  'Exemple {0}/{1} :': 'Example {0}/{1}:',
  'Aucune photo datée : pas d’exemple à montrer.': 'No dated photo: no example to show.',
  'Frise jour par jour, {0} : {1}, {2}.': 'Day-by-day timeline, {0}: {1}, {2}.',
  Voyage: 'Trip',
  '{0} : {1}': '{0}: {1}',
  '{0} : {1}, {2}': '{0}: {1}, {2}',
  '… et {0}': '… and {0}',
  'autre dossier': 'other folder',
  'autres dossiers': 'other folders',
  'Une pastille par photo (12 au plus par jour), de la couleur et de la lettre de son dossier ; la barre de chaque dossier est en dessous.':
    'One dot per photo (at most 12 per day), with the colour and letter of its folder; each folder’s bar is below.',
  '⌂ : à la maison.': '⌂: at home.',
  photo: 'photo',
  photos: 'photos',
  jour: 'day',
  jours: 'days',
  // Liste des dossiers prévus
  'Voir le dossier prévu': 'See the planned folder',
  'Voir la liste des {0} dossiers prévus': 'See the list of the {0} planned folders',
  'à la maison': 'at home',
  'sans date': 'no date',
  'Les noms définitifs des lieux sont demandés à OpenStreetMap au moment de ranger.': 'The final place names are requested from OpenStreetMap when the photos are arranged.',
};
