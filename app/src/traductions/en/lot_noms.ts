// Traductions anglaises : voir src/lib/langue.ts (clé = texte français, {0}, {1}… = valeurs).
// Nommage.tsx : les noms possibles de chaque dossier (calendrier, lieu, IA) et le nom du calendrier pour tous.

export const TEXTES: Record<string, string> = {
  // Puces sous le champ
  'Noms possibles': 'Possible names',
  'Calendrier : « {0} », pendant {1} % des photos': 'Calendar: “{0}”, during {1}% of the photos',
  '(titre long : jamais pris d’office)': '(long title: never filled in automatically)',
  'Lieu des photos': 'Place of the photos',
  'Proposition de l’IA': 'AI suggestion',
  'Proposition de l’IA, confiance {0} sur 10': 'AI suggestion, confidence {0} out of 10',
  // Colonne « Justification »
  'Calendrier : « {0} » ; titre long, à raccourcir si besoin': 'Calendar: “{0}”; long title, shorten it if needed',
  'Plusieurs événements du calendrier conviennent : cliquez sur le bon nom.': 'Several calendar events fit: click the right name.',
  // Nom du calendrier pour tous les dossiers qui en ont un seul
  'Prendre le nom du calendrier pour les {0} dossiers qui en ont un': 'Use the calendar name for the {0} folders that have one',
  'Prendre le nom du calendrier pour le dossier qui en a un': 'Use the calendar name for the folder that has one',
  'Seulement là où un seul événement du calendrier convient ; quand plusieurs conviennent, choisissez sous le nom. Ctrl+Z annule.':
    'Only where a single calendar event fits; when several fit, choose under the name. Ctrl+Z undoes.',
};
