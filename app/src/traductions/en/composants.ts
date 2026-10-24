// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Composants partagés (src/ui/composants/).

export const TEXTES: Record<string, string> = {
  // TriAuto.tsx
  'Recalculer l’arborescence ?': 'Recalculate the folder tree?',
  'Les photos à trier seront rangées à nouveau : les déplacements faits à la main depuis le dernier calcul seront remplacés (Ctrl+Z annule).':
    'The photos to sort will be arranged again: moves made by hand since the last calculation will be replaced (Ctrl+Z undoes).',
  Recalculer: 'Recalculate',
  'Tri par lieux : {0} dossiers proposés pour {1} fichiers': 'Sort by place: {0} folders proposed for {1} files',
  'dossier proposé': 'folder proposed',
  'dossiers proposés': 'folders proposed',
  '{0} : vérifiez-les à l’étape suivante, « Lieux et sorties ».': '{0}: check them in the next step, “Places and outings”.',
  'Tri interrompu : {0}': 'Sorting interrupted: {0}',
  'Réglages du tri': 'Sorting settings',
  'fichier à trier': 'file to sort',
  'fichiers à trier': 'files to sort',
  ' (déjà calculé : vous pouvez recalculer avec d’autres réglages)': ' (already calculated: you can recalculate with other settings)',
  'Précision des lieux : {0} km': 'Place precision: {0} km',
  'Deux photos prises à moins de {0} km l’une de l’autre vont dans le même lieu. Plus petit : un dossier par quartier ; plus grand : un dossier par ville ou par région.':
    'Two photos taken less than {0} km apart go to the same place. Smaller: one folder per neighbourhood; larger: one folder per town or region.',
  'Un dossier par jour': 'One folder per day',
  'Coché : un séjour de 4 jours au même endroit donne 4 dossiers, un par jour (pratique pour un voyage). Décoché : les jours qui se suivent au même endroit forment une seule sortie (pratique pour une année).':
    'Ticked: a 4-day stay in the same place gives 4 folders, one per day (handy for a trip). Unticked: consecutive days in the same place form a single outing (handy for a whole year).',
  'Regrouper les voyages': 'Group trips',
  'Les sorties loin de chez vous qui s’enchaînent sans retour à la maison sont réunies dans un dossier « Voyage_… », avec une sortie par étape.':
    'Outings far from home that follow one another without going back home are gathered in a “Voyage_…” folder, with one outing per stage.',
  'Sans effet pour l’instant : cochez « C’est notre domicile » sur un lieu ci-dessus, ou indiquez-le dans la Configuration.':
    'No effect for now: tick “This is our home” on a place above, or set it in the Configuration.',
  'Utiliser les lieux connus ({0})': 'Use known places ({0})',
  'Les photos prises dans un lieu enregistré (maison, grands-parents, école, club…) vont dans le dossier de ce lieu, rangées par sortie. Les lieux se définissent dans la Configuration, ou ci-dessus parmi les lieux fréquents.':
    'Photos taken at a saved place (home, grandparents, school, club…) go to that place’s folder, arranged by outing. Places are defined in the Configuration, or above among the frequent places.',
  'Réglages avancés': 'Advanced settings',
  'Nouvelle sortie après (jours sans photo)': 'New outing after (days without photos)',
  'Au même lieu, si plus de jours passent sans photo, une nouvelle sortie commence.': 'At the same place, if more days than this pass without photos, a new outing starts.',
  'Durée maximale d’une sortie (jours)': 'Maximum length of an outing (days)',
  'Coupe en plusieurs sorties un lieu photographié très souvent, comme la maison.': 'Splits a very often photographed place, such as home, into several outings.',
  'Un dossier par mois': 'One folder per month',
  'Un dossier par lieu et par mois (Lieu_AAAA-MM), sans chercher les sorties.': 'One folder per place and per month (Place_YYYY-MM), without looking for outings.',
  'Un seul dossier par lieu': 'A single folder per place',
  'Toutes les photos d’un lieu ensemble, sans découpage en sorties ni date.': 'All the photos of a place together, not split into outings and without a date.',
  'Voyage au-delà de (km du domicile)': 'Trip beyond (km from home)',
  'Une sortie plus loin que cette distance de la maison compte comme un voyage.': 'An outing further than this distance from home counts as a trip.',
  'Étapes d’un voyage : écart maximal (jours)': 'Stages of a trip: maximum gap (days)',
  'Deux sorties lointaines séparées de plus de jours que cela forment deux voyages.': 'Two distant outings separated by more days than this form two trips.',
  'Écart toléré sans retour au domicile (jours)': 'Gap allowed without going back home (days)',
  'Jours sans photo acceptés au milieu d’un voyage, tant qu’aucune photo n’est prise à la maison.': 'Days without photos accepted in the middle of a trip, as long as no photo is taken at home.',
  'Utiliser les noms de fichiers parlants': 'Use meaningful file names',
  '« Anniversaire Lea.jpg » donne son nom à la sortie.': '“Lea birthday.jpg” gives its name to the outing.',
  'Noms des lieux (OpenStreetMap) : {0} / {1} — encore {2}': 'Place names (OpenStreetMap): {0} / {1} — {2} left',
  'Arrêter (les noms déjà reçus sont gardés)': 'Stop (names already received are kept)',
  'Recalculer l’arborescence': 'Recalculate the folder tree',
  'Calculer l’arborescence': 'Calculate the folder tree',
  'Les coordonnées moyennes de chaque lieu sont envoyées à OpenStreetMap (Nominatim) pour le nommer, une par seconde ; rien d’autre.':
    'The average coordinates of each place are sent to OpenStreetMap (Nominatim) to name it, one per second; nothing else.',

  // ChoixLangue.tsx
  'Langue du navigateur': 'Browser language',
};
