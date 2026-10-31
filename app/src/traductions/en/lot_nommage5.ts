// Retours du 29.10, étape 5 (D112 point 11) : le Nommage en deux onglets et en cartes (« Nom actuel », « Noms
// proposés », « Nouveau nom »), les boutons d'ensemble qui disent leur portée et leur prix.

export const TEXTES: Record<string, string> = {
  // Onglets et boutons d'ensemble.
  'Déjà nommés': 'Already named',
  '{0} déjà nommés': '{0} already named',
  '{0}, avec recherche web': '{0}, with web search',
  'Nommer le dossier avec l’IA': 'Name the folder with AI',
  'Nommer les {0} avec l’IA': 'Name the {0} with AI',
  'Nommer ce dossier avec l’IA': 'Name this folder with AI',
  'Nommer ces {0} avec l’IA': 'Name these {0} with AI',
  'chercher aussi sur internet': 'also search the internet',
  'Les noms de l’IA de confiance 8 sur 10 ou plus. Ctrl+Z annule.': 'The AI names with a confidence of 8 out of 10 or more. Ctrl+Z undoes.',
  'Accepter les noms sûrs de l’IA ({0})': 'Accept the AI’s sure names ({0})',
  'Seulement là où un seul événement du calendrier convient ; quand plusieurs conviennent, choisissez dans « Noms proposés ». Ctrl+Z annule.':
    'Only where a single calendar event fits; when several fit, choose in “Suggested names”. Ctrl+Z undoes.',
  'Prendre le nom du calendrier ({0})': 'Use the calendar name ({0})',
  'Aussi les noms de l’IA à vérifier (une confirmation est demandée)': 'Also the AI names to check (you will be asked to confirm)',
  'nom de l’IA à vérifier': 'AI name to check',
  'noms de l’IA à vérifier': 'AI names to check',
  'Aucun dossier au nom automatique : tout est déjà nommé. Vous pouvez encore les renommer dans « Déjà nommés ».':
    'No folder has an automatic name: everything is already named. You can still rename them in “Already named”.',
  'Aucun dossier déjà nommé : ils sont tous dans « À nommer ».': 'No folder is named yet: they are all in “To name”.',
  '1 dossier à nommer : il garde son nom actuel tant que vous ne le renommez pas': '1 folder to name: it keeps its current name until you rename it',
  '{0} dossiers à nommer : ils gardent leur nom actuel tant que vous ne les renommez pas': '{0} folders to name: they keep their current names until you rename them',

  // La carte d'un dossier.
  'Nom actuel': 'Current name',
  'Noms proposés': 'Suggested names',
  'votre dossier d’origine': 'your original folder',
  'renommé par vous (avant : {0})': 'renamed by you (before: {0})',
  'garde son nom tant que le champ est vide': 'keeps its name while the field is empty',
  'Écrivez un nom avec des lettres ou des chiffres': 'Write a name with letters or digits',
  'Par exemple : {0}': 'For example: {0}',
  'Anniversaire de Lea 26.01.25': 'Lea’s birthday 26.01.25',
  'Plusieurs événements du calendrier conviennent : choisissez le bon.': 'Several calendar events fit: choose the right one.',
  sûr: 'sure',

  // Aide de l'étape.
  'Donnez à chaque dossier un nom parlant, sur le modèle « Theme_Lieu_JJ.MM.AA » (Anniversaire_Lea_26.01.25). « À nommer » : les dossiers qui portent encore le nom donné par le tri (lieu et date) ; « Déjà nommés » : ceux que vous avez nommés, ou venus tels quels de votre dossier d’origine. Sous « Nom actuel », les noms proposés : un clic en met un dans le champ « Nouveau nom »,':
    'Give each folder a meaningful name, following the pattern “Theme_Place_DD.MM.YY” (Birthday_Lea_26.01.25). “To name”: the folders that still carry the name given by the sorting (place and date); “Already named”: those you named, or that came as they were from your original folder. Under “Current name”, the suggested names: one click puts one in the “New name” field,',
  'la proposition de l’IA, « sûre » ou « à vérifier » (sa raison dans l’infobulle). L’IA regarde quelques photos, le lieu, le calendrier et le contexte du projet ; son prix s’affiche sur le bouton avant de la lancer. Vous pouvez aussi écrire votre nom : rien n’est renommé sans « Renommer » (ou Entrée dans le champ), et Ctrl+Z l’annule.':
    'the AI’s suggestion, “sure” or “to check” (its reason in the tooltip). The AI looks at a few photos, the place, the calendar and the project context; its price shows on the button before you start it. You can also type your own name: nothing is renamed without “Rename” (or Enter in the field), and Ctrl+Z undoes it.',

  // Raccourcis et mode d'emploi.
  Tab: 'Tab',
  'Des noms proposés au champ « Nouveau nom », puis à « Renommer »': 'From the suggested names to the “New name” field, then to “Rename”',
  '← → sur les noms proposés': '← → on the suggested names',
  'Mettre le nom proposé suivant, précédent dans le champ': 'Put the next, previous suggested name in the field',
  'Entrée dans « Nouveau nom »': 'Enter in “New name”',
  'Renommer le dossier': 'Rename the folder',
  ' : un nom parlant par dossier (Theme_Lieu_JJ.MM.AA), en deux onglets, « À nommer » et « Déjà nommés ». Chaque carte dit le nom actuel, puis les noms proposés (calendrier, lieu, IA « sûre » ou « à vérifier ») : un clic en met un dans le champ « Nouveau nom », et « Renommer » (ou Entrée) le donne. Le bouton de l’IA dit combien de dossiers il nomme et son prix avant de le lancer.':
    ': a meaningful name for each folder (Theme_Place_DD.MM.YY), in two tabs, “To name” and “Already named”. Each card shows the current name, then the suggested names (calendar, place, AI “sure” or “to check”): one click puts one in the “New name” field, and “Rename” (or Enter) gives it. The AI button says how many folders it names and its price before you start it.',
};
