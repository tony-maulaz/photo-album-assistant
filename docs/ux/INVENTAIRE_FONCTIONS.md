# Inventaire des fonctions — filet de sécurité avant refonte

Relevé dans le code (27.10.2026, `app/src/ui/`, audit D108) et vérifié sur des captures
réelles du parcours complet. À tenir à jour à chaque changement d'interface (agent
`ux-controle`). Pour chaque fonction : **où** on y accède et **comment** on la
découvre.

Légende de la colonne « Vu » :

- **V** visible (bouton, lien, case, champ libellé)
- **I** icône seule (le sens n'est donné que par l'infobulle)
- **C** clavier seulement
- **B** infobulle seulement (le geste existe, seule une bulle le dit)
- **G** geste caché (double-clic, glisser, clic sur une zone qui n'a pas l'air d'un bouton), dit nulle part ou seulement dans la page Aide
- **T** dans une notification temporaire (disparaît)

Après une refonte, chaque ligne doit rester faisable et découvrable, à l'endroit le
meilleur : la colonne « Accès » décrit l'existant, pas une obligation (D109). Les sections 16 à 18 donnent les **absences** et les **doublons
incohérents**.

---

## 0. Partout (cadre de l'application)

| Fonction | Accès | Vu | Fichier |
|---|---|---|---|
| Retour à l'accueil | logo en haut à gauche | V (I sans projet ouvert) | Cadre.tsx:175 |
| Nom du projet, source et sortie | nom dans l'en-tête, détail en infobulle | B | Cadre.tsx:180 |
| Aller à une étape | clic sur un des 13 rectangles de la frise ; état et nom seulement en infobulle | I/B | Cadre.tsx:76-87 |
| Liste des étapes avec leur état | « Étape n sur 13 · Nom ▾ » → menu déroulant | V | Cadre.tsx:89-111 |
| Budget IA dépensé | pastille à anneau « IA x / y CHF », détail en infobulle ; **pas cliquable** (l'infobulle renvoie au Journal) | V/B | Cadre.tsx:185-192 |
| Menu (icône et mot « Menu ») : Fonctions IA, Configuration, Réglages, Journal (projet ouvert), Aide, Fermer le projet | bouton « Menu » | I | Cadre.tsx:117-164 |
| Annuler la dernière modification | Ctrl+Z (pages d'étape seulement, **pas quand une fenêtre est ouverte**) | C | Raccourcis.tsx:391-413 |
| Rétablir | Ctrl+Y ou Ctrl+Maj+Z (mêmes limites) | C | idem |
| Liste des raccourcis | touche « ? » ; **aucun bouton** ne l'ouvre (seule la page Aide le dit) | C | Raccourcis.tsx:397, 484 |
| Fermer menu / fenêtre | Échap, clic à côté | C/G | Cadre.tsx:15-34 |
| Précédent du navigateur | reste dans l'application | G | navigation.ts |
| Bandeau « le dossier à trier a changé » | « Mettre à jour l'inventaire » / « Plus tard » | V | BandeauSource.tsx |
| Annuler depuis une notification | bouton « Annuler » dans le message (Lieux, Doublons, Petits, Consolidation, Nommage, Tri, Album, Floues) | T | etat.ts, organiser.ts:110 |
| Revenir / Valider et continuer | barre du bas, à droite, libellé variable selon la page | V | Cadre.tsx:244-283 |

## 1. Écran « Reprendre » (au lancement)

| Fonction | Accès | Vu |
|---|---|---|
| Autoriser tous les dossiers d'un coup | « Autoriser l'accès » | V |
| Autoriser un dossier précis (sauf le premier restant) | « Autoriser » sur sa ligne | V |
| Continuer sans autoriser / Continuer | bouton | V |

## 2. Accueil

| Fonction | Accès | Vu |
|---|---|---|
| Langue de l'interface | liste « Langue (language) » | V |
| Trier un nouveau dossier (ouvre tout de suite le sélecteur de dossier) | carte entière ou son faux bouton | V |
| Ouvrir un dossier déjà trié | carte | V |
| Reprendre un projet dont on choisit le dossier de sortie | lien « Reprendre un projet… » | V |
| Rouvrir un projet récent | « Ouvrir » sur la carte du projet | V (sous la ligne de flottaison à 1280×720) |
| Retirer un projet de la liste | « Retirer » (infobulle : les fichiers ne sont pas touchés) | V/B |
| État de la configuration et de la clé | puces « Cet ordinateur » | V |
| Configuration, Réglages | liens en bas | V |

## 3. Nouveau projet (étape 1, création)

| Fonction | Accès | Vu |
|---|---|---|
| Choisir le dossier à trier | « Choisir… » | V |
| Choisir le dossier de sortie | « Choisir… » | V |
| Fixer le dossier de départ des sélecteurs | lien « choisir un dossier de départ » | V |
| Ouvrir le projet déjà présent dans la sortie | « Ouvrir ce projet » (encart) | V |
| Nom, contexte | champs | V |
| Budget IA, langue des noms écrits | « Réglages avancés » (replié) | V |
| Confirmation si la sortie n'est pas vide | fenêtre « Continuer » / « Annuler » | V |
| Revenir / Créer le projet (grisé avec « Choisissez les deux dossiers. » dans le résumé) | barre du bas | V |

## 4. Étape 1 « Projet » (projet existant)

| Fonction | Accès | Vu |
|---|---|---|
| Aller à Configuration / Réglages | liens dans l'encart | V |
| Changer nom, contexte, budget | champs (enregistrés à la sortie du champ) | V |
| Continuer | barre du bas ; **pas de « Revenir »** | V |

## 5. Configuration (menu ☰, et liens depuis les étapes 1, 2, 6, 10)

| Fonction | Accès | Vu |
|---|---|---|
| Choisir / créer / recharger le dossier config | 3 boutons | V |
| Créer config.json, restaurer la dernière sauvegarde | encart selon le cas | V |
| Onglets Lieux connus / Appareils / Calendriers | onglets | V |
| Modifier un lieu (nom, lat, lon, rayon, domicile, un seul dossier, notes), voir ses photos dans le rayon | tableau | V |
| Retirer un lieu | « Retirer » | V |
| Ajouter un lieu depuis des coordonnées ou un lien Google Maps | champ + « Ajouter ce lieu » (grisé tant que rien n'est reconnu, message dessous) | V |
| Ajouter depuis une photo | bouton | V |
| Rechercher une adresse (OpenStreetMap) | champ + « Rechercher » ou Entrée, puis « ajouter » sur un résultat | V |
| Importer / exporter lieux_connus.csv | boutons | V |
| Appareils : modèle, décalage, surnom, retirer, ajouter | tableau + boutons | V |
| Calendriers : nom, actif, récurrents, voir les événements (filtre année, recherche), retirer, ajouter un .ics | tableau + boutons | V |
| Enregistrer (grisé sans explication tant que rien n'a changé) / Annuler les changements | boutons | V |
| **Retour à la page d'avant** | **absent** (les autres pages du menu ont « ← Retour ») | — |
| Avertissement si on quitte sans enregistrer | **absent** | — |

## 6. Réglages, Journal, Fonctions IA, Aide (menu ☰)

| Fonction | Accès | Vu |
|---|---|---|
| ← Retour | lien en haut | V |
| Clé API : saisir, se souvenir, enregistrer, tester, oublier | formulaire | V |
| Dossier de départ des sélecteurs | réglage | V |
| Langue, **taille des miniatures** (4e curseur de taille), thème | formulaire | V |
| Modèles IA, taux USD/CHF, seuil de confirmation, budget par défaut, e-mail Nominatim | « Réglages avancés » (replié) | V |
| Journal : coûts par aide, activité | page | V |
| Fonctions IA : coût estimé de chaque aide, dépensé, aller à l'étape de l'aide, redemander les réponses illisibles | page | V |
| Aide : mode d'emploi, mention de la touche « ? » | page | V |

## 7. Étape 2 « Inventaire »

| Fonction | Accès | Vu |
|---|---|---|
| Lancer / arrêter l'inventaire | boutons (pendant le calcul) | V |
| Mettre à jour l'inventaire (photos arrivées depuis) | lien à droite du titre (à la place où d'autres pages ont la loupe) | V |
| Dossier déjà trié : sauter vers Doublons, Lieux, Nommage, Sélection | 4 boutons dans un encart | V |
| Enregistrer un appareil dans la configuration | lien « Enregistrer » | V |
| Mesurer le décalage d'horloge entre deux appareils, l'enregistrer | lien + bouton | V/B |
| Corriger l'heure des photos selon les décalages | bouton (si utile) | V |
| Choisir ou créer le dossier de configuration sur place | lien → bloc ChoixConfiguration | V |
| Photos par mois | histogramme, nombre en infobulle | B |
| Refaire l'inventaire (perd l'arborescence, les noms, la sélection) | « Repartir de zéro » replié → bouton rouge + confirmation | V |
| Explication repliable | **absente** (pas de bouton Aide sur cette page) | — |
| Valider (grisé pendant l'analyse, le résumé dit pourquoi) | barre du bas | V |

## 8. Étape 3 « Dossiers »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | « Replier » / « Aide » collé au titre | V |
| Taille des photos (×0,6, n'agit que sur la ligne ouverte) | loupe à droite du titre | I |
| Chercher un dossier (aussi par le nom d'un sous-dossier) | champ | V |
| Ordre par nom / par période | liste | V |
| Même choix pour tous les dossiers affichés | « Pour tous : Trier / Garder, nettoyer / Ne pas toucher » | V |
| Choix par dossier | bouton segmenté sur la ligne | V |
| Voir les photos d'un dossier | clic n'importe où sur la ligne, ou flèche | V/G |
| Filtrer par sous-dossier | pastilles sous la ligne ouverte | V |
| Liste complète des sous-dossiers | infobulle sous le nom | B |
| Voir une photo en grand / toutes | clic sur une miniature, lien « Voir les N photos en grand » | V |
| Visionneuse : ← →, Échap, molette = zoom, glisser, double-clic ou 0 = taille écran | clavier/souris | C/G |
| Signaux « sur N mois », « N photos seules » | badges, explication en infobulle | V/B |

## 9. Étape 4 « Photos floues »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Tolérance au flou (plus tolérant ↔ plus strict), valeur en infobulle | curseur | V/B |
| Revenir au réglage conseillé | lien (grisé s'il l'est déjà) | V |
| Voir toutes les photos / seulement celles qui seront écartées | liste | V |
| Annuler (historique **global**, toutes étapes) ; Rétablir | « Annuler : *le geste* » (verbe et nombre, une ligne ; le geste avec ses noms en infobulle) et « Rétablir », dans l'en-tête de l'étape (lot 2 de la charte) | V/C |
| Faire juger les cas limites par l'IA (IA1), suivre son avis | bouton IA + bouton « Suivre l'avis… » | V |
| Sélectionner : clic, Ctrl+clic, Maj+clic, rectangle, flèches | souris/clavier | G/C |
| Sauver / Écarter / Selon le curseur / désélectionner | barre noire flottante en bas, touches S, X ou Suppr, Échap | V/C |
| Voir en grand | double-clic | G |
| Glisser vers un dossier | désactivé ici | — |
| Taille des photos | **absente** | — |
| Ctrl+A | **absent** (existe aux étapes 7 et 11) | — |

## 10. Étape 5 « Doublons »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Onglets Copies exactes / Rafales / Même scène (IA) / Mis de côté, avec compteur | onglets | V |
| Tout l'onglet (copies) : Accepter les N propositions, Garder tous les exemplaires | rangée « Tout l'onglet » | V |
| Tout l'onglet (rafales) : Choisir avec l'IA dans N rafales (IA16) | rangée | V |
| Afficher À accepter / Acceptés / Tous | bouton segmenté | V |
| Grouper par journée / mois / dossier | liste | V |
| Taille des photos | loupe dans la barre de filtres (y = 510 à 1440×900) | I |
| Classer par heure / plus grands groupes d'abord | liste | V |
| Liste de gauche : choisir une journée ou un dossier, ✓ ou nombre restant, chercher un dossier (Entrée = premier trouvé) | liste | V |
| Élargir la liste de gauche, double-clic = largeur d'origine | poignée sur le bord | G/B |
| Section : Choisir avec l'IA de cette journée, Accepter les N groupes de cette journée | en-tête de section, étiquette de portée | V |
| Groupe : clic sur une photo = la choisir (seule dans une rafale), Ctrl+clic = en plus | clic | V (expliqué en petit gris) |
| Groupe : Accepter (A), Tout garder, Tout écarter, Comparer en grand (C), Replier, Garder plusieurs photos (case) | pied de carte | V |
| Groupe validé replié : Revoir | lien | V |
| Suite à accepter : X › / Aller à la suite à accepter | bouton | V |
| Clavier : J/K ou ↓↑ groupe, ← → photo, Espace choisir, A accepter, C comparer, N/P journée suivante/précédente | clavier (dit en petit gris sous les filtres) | C |
| Comparateur (lot 3 de la charte) : présentation calculée « Côte à côte » / « Une à la fois » (bouton et Entrée, gardée d'un groupe à l'autre jusqu'à la fermeture ; côte à côte choisi à la main sur 2 ou 3 rangées, désactivé avec sa raison si les photos seraient trop petites), ↑ ↓ photo (le clavier sur la carte), ← → ou Page préc./suiv. groupe (« Groupe précédent », « Groupe suivant » ; « Groupe n sur N » dans le titre), Accepter et groupe suivant (A, libellé chiffré, alerte), 1 à 9 = garder/écarter la photo n si elle est à l'écran (« À garder » en mode une seule photo écarte les autres, dit dans l'infobulle), « À garder / À écarter » sous chaque photo (état allumé), Garder plusieurs photos (case : ligne d'information en côte à côte, sous le choix en « Une à la fois »), Choisir avec l'IA (prix), avis et raison de l'IA, dossier et « rangée dans … », copies : poids et nom s'il diffère, nom du fichier (« Une à la fois », infobulle), zoom − / Photo entière (0) / + (touches − +), molette, glisser, double-clic = une à la fois, Annuler / Rétablir (Ctrl+Z, Ctrl+Y), Fermer (Échap, le clavier revient au bouton qui l'a ouverte), bande des vignettes avec leur état, rappel « ↑ ↓ photo · ← → groupe » à toutes les tailles (au large : « 1–N choisir · A accepter ») | fenêtre | V/C |
| Même scène : Prudent / Strict, Analyser avec l'IA (coût dans le bouton), Arrêter | encart | V |
| Réglages avancés IA : modèle, redemander les réponses illisibles | replié | V |
| Mis de côté : Grouper, taille, Tout remettre (N), clic = remettre / écarter de nouveau | onglet | V |
| **Bouton Annuler** | **absent** (notification « Annuler » ou Ctrl+Z seulement) | — |

## 11. Étape 6 « Tri automatique » (refaite par D107, relevée pour cohérence)

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Taille des photos (×0,6) | loupe à droite du titre | I |
| Maison : Changer (→ page Configuration, sans retour) / L'indiquer… | liste « À faire » | V |
| Copies en double : Voir (→ étape Doublons), Mettre de côté | liste « À faire » | V |
| Captures d'écran : Voir (fenêtre : cocher, agrandir, voir toutes, ranger / garder), Ranger dans leur dossier | liste « À faire » + Fenetre | V |
| Endroits fréquents : Les nommer… (fenêtre : nom, Enregistrer, « C'est notre maison », « Pas maintenant », voir toutes les photos) | liste + Fenetre | V |
| Choix du rangement (listes avec effet chiffré), Ranger les photos | liste « À faire » | V |
| Après rangement : Ranger autrement…, Ranger avec ce réglage, Revenir au réglage actuel, Ranger à nouveau, Tout ranger à nouveau, Ranger N nouvelles photos | liste | V |
| Photos sans position : Demander à l'IA… (fenêtre : IA2, accepter les sûres, « déplacer » une à une) | liste + Fenetre | V |
| Arrêter la recherche des noms de lieux | bouton pendant le calcul | V |
| Résultat : onglets Tout / Voyages / Sorties / À la maison / Autres (captures, sans date, vidéos seules), Voir les lieux | colonne de droite | V |
| Valider (grisé avant rangement, l'alerte dit quoi faire) | barre du bas | V |

## 12. Étape 7 « Lieux et sorties »

| Fonction | Accès | Vu |
|---|---|---|
| Explication : « Replier » en haut à droite (1re visite), puis « Aide » au bout de la barre de la vue | 2 places différentes | V |
| Aller au tri automatique (arborescence pas calculée) | bouton dans l'explication | V |
| Panneau : chercher (aussi par événement du calendrier) | champ | V |
| Panneau : ordre par nom / période / taille | liste | V |
| Panneau : seulement les dossiers avec alerte | icône ⚠ (sans libellé) | I |
| Panneau : nouveau dossier dans le dossier affiché ; déposer des photos dessus = nouveau dossier voisin | icône + ; dépôt | I/G |
| Panneau : seulement les nouveautés | case (après mise à jour d'inventaire) | V |
| Panneau : déplier/replier | ▸ ▾ | I |
| Ouvrir un dossier | clic sur la ligne | V |
| Renommer un dossier | double-clic sur la ligne, F2, ou crayon à côté du titre (la saisie se fait **dans le panneau**, pas au titre) | G/C/I |
| Réunir deux dossiers | glisser un dossier sur un autre (confirmation), ou « Réunir avec… » (fenêtre de choix, ↑↓ Entrée) | G/V |
| Retirer un dossier vide | « Retirer ce dossier vide » | V |
| Déplacer des photos | glisser sur un dossier du panneau ; « Déplacer… » ou M (fenêtre avec recherche et « + Créer le dossier ») ; touches 1 à 9 ou puces « 1 » « 2 » (derniers dossiers) | G/V/C |
| Mettre de côté / remettre | « Mettre de côté » / « Remettre », Suppr ou Retour arrière ; glisser sur « Mis de côté » | V/C/G |
| Nouveau dossier avec les photos choisies | « Nouveau dossier » (barre) | V |
| Nouveau dossier avec une journée | bouton sur le titre de la journée (dossier de plusieurs jours) | V |
| Sélectionner les photos d'un événement du calendrier | clic sur l'étiquette 📅 du titre de journée | V/B |
| Toute la journée / Toute l'heure de la dernière photo cliquée | barre | V |
| Sélection : clic, Ctrl, Maj, rectangle, flèches (+Maj), Ctrl+A, Échap | souris/clavier | G/C |
| Chemin du dossier : remonter à un parent | liens au-dessus du titre | V |
| « Annuler : *le geste* » (infobulle : le geste avec ses noms) / « Rétablir » (icône et mot) | barre de la vue | V/I |
| Taille des photos | loupe dans la barre de la vue (absente en ligne de temps et Autres fichiers) | I |
| Vue Photos / Ligne de temps ; clic sur une barre = ouvrir le dossier | bascule | V |
| Mis de côté, Autres fichiers | lignes spéciales du panneau | V |
| Élargir le panneau | poignée | G/B |
| Voir en grand | double-clic ou Entrée ; visionneuse **sans aucun bouton** (M, Suppr, ← →, Échap, molette, 0) | G/C |

## 13. Étape 8 « Petits dossiers »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Taille des photos (centre ×1, côtés ×0,6) | loupe à droite du titre | I |
| Proposer un rattachement avec l'IA (IA3) | bouton IA | V |
| Petits dossiers à moins d'1 h et 10 km : les voir (fenêtre : Retirer / Remettre, Mettre les N avec leur dossier, Fermer) | bouton plein | V |
| Accepter les propositions sûres de l'IA (8/10 et plus) | bouton | V |
| Choisir un petit dossier | liste « Dans l'ordre du temps » | V |
| Mettre avec le dossier d'avant / d'après | boutons « Mettre avec ce dossier » avec chevrons SVG, touches ← → | V/C |
| Garder seul | bouton, touche G ; « Annuler » dans la notification (**pas** Ctrl+Z) | V/C/T |
| Le renommer « … » (nom proposé par l'IA) | bouton | V |
| Autre dossier… | lien → fenêtre de choix (recherche, ↑↓ Entrée, Annuler) | V |
| Annuler ce choix (rattaché ou gardé seul) | bouton dans l'encart | V |
| Petit dossier suivant / précédent | J / K | C |
| Voir une photo en grand | clic sur une photo du centre (pas sur les côtés) | V/B |
| Raccourcis dans la fenêtre « ? » | **absents** (seulement une ligne grise sous les photos) | — |

## 14. Étape 9 « Nommage »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Tous les dossiers (pas seulement les noms automatiques) | case | V |
| Recherche web (cochée par défaut, plus chère) | case | V |
| Nommer les sorties avec l'IA (IA4), coût dans le bouton | bouton IA | V |
| Accepter les noms de confiance 8 ou plus | bouton plein | V |
| Prendre le nom du calendrier pour les dossiers qui en ont un | bouton | V |
| Tout accepter (N noms)… (confirmation si confiance basse) | bouton | V |
| Écrire un nom ; Entrée = renommer | champ | V/B |
| Choisir un nom proposé (📅 calendrier, 📍 lieu, ✨ IA) | puces sous le champ | V |
| Renommer un dossier | bouton « Renommer » par ligne | V |
| Noms encore dans les champs en quittant (tapés, et proposés à « Valider ») : récapitulatif « avant → après » à cocher, peu sûrs « à vérifier » ; Rester sur la page / Renommer et continuer (ou revenir) / Continuer (ou revenir) sans renommer (D108) | fenêtre | V |
| Voir les photos d'un dossier en grand | **absent** (miniatures 64 px non cliquables) | — |
| Taille des photos | **absente** | — |
| Bouton Annuler | **absent** (notification ou Ctrl+Z) | — |

## 15. Étape 10 « Consolidation »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Taille des photos (×0,6, au moins 96 px) | loupe à droite du titre | I |
| Sortie coupée : écart de temps (1 h, 3 h, 6 h, la journée) et distance (1, 2, 4, 10, 20 km) | 2 boutons segmentés | V |
| Week-ends et petits voyages (case) jusqu'à 3 j / 4 j / 1 sem. / 2 sem. | case + segmenté | V |
| Indiquer le domicile dans la Configuration | lien (sans domicile) | V |
| Réglages avancés : noms proches ; les proposer à nouveau (refusées) | replié | V |
| Proposer des fusions avec l'IA (IA6) | bouton IA | V |
| Dossiers non pris en compte ; inclure à nouveau un dossier « exclu à la main » | replié | V |
| Exclure un dossier à la main | **plus aucun moyen** (reste dans le libellé) | — |
| Choisir une proposition | liste « Dans l'ordre du temps », J / K | V/C |
| Retirer un dossier de la proposition | case sur son nom | V |
| Un seul dossier / un dossier de voyage avec une étape par dossier | segmenté (voyages) | V |
| Nom du dossier réuni | champ | V |
| Pas la même sortie / Garder les étapes / Pas un même voyage | bouton, touche N | V/C |
| Réunir N dossiers / Ranger ensemble | bouton plein | V |
| Renommage proposé par l'IA : Non merci / Renommer | encart | V |
| Défaire une réunion ; Annuler ce choix (refus) | bouton | V |
| Voir une photo en grand | clic sur une photo | V/B |
| Raccourcis dans la fenêtre « ? » | **absents** | — |

## 16. Étape 11 « Sélection »

| Fonction | Accès | Vu |
|---|---|---|
| Explication : « Replier » en haut à droite, puis « Aide » coincé entre la loupe et la colonne de droite | 2 places | V |
| Tri rapide (plein écran, une photo à la fois) | bouton contour « Tri rapide » (ligne du titre), T ou Entrée, **double-clic sur une photo** | V/C/G |
| Annuler (historique global) : « Annuler : *le geste* », infobulle avec les noms | bouton | V/C |
| Rétablir | bouton « Rétablir » à côté d'« Annuler », Ctrl+Y | V/C |
| Taille des photos | loupe dans la barre de la vue (x = 958) | I |
| Filtrer : Toutes / À décider / Dans l'album / ★★ Grandes / Pas pour l'album (avec compteurs), Nouvelles | pastilles | V |
| Empiler les photos semblables ; déplier une pile | pastille ; badge ▸ N sur la photo | V/I |
| Rechercher dans les descriptions de l'IA (après IA8) | champ | V |
| Filtres secondaires : jour, arrivée, appareil, indicateurs, tri (date, netteté, appréciation), personnes, type, défauts | « Filtres ▾ » | V |
| Effacer les filtres | lien | V |
| Choisir une sortie | panneau de gauche (clic = filtre) | V |
| Sélectionner : clic, Ctrl, Maj, rectangle, flèches, Ctrl+A, Échap | souris/clavier | G/C |
| ★ Dans l'album / ★★ Grande / Pas pour l'album / À décider | barre noire flottante en bas ; Espace ou 1, 2, X, Suppr ou Retour arrière | V/C |
| Tourner d'un quart de tour (Maj : l'autre sens) | bouton « Tourner » (icône SVG et mot) ; R / Maj+R | I/C |
| Recadrer… (une seule photo) | barre flottante ; K | V/C |
| Comparer (2 à 4 photos) | barre flottante ; C | V/C |
| Déplacer… vers une autre sortie | barre flottante ; M | V/C |
| Déplacer en glissant une photo sur une sortie du panneau | glisser | G (dit nulle part) |
| Renommer une sortie (double-clic dans le panneau), **fusionner deux sorties en glissant l'une sur l'autre** | panneau « simple » qui garde ces gestes | G (dit nulle part) |
| Cible : nombre, pages/photos, photos par page, jauge | colonne de droite | V |
| Équilibre par jour/mois : barre = date au survol, clic = filtrer ce jour | colonne de droite | V/B |
| Sorties sans photo retenue : aller à la sortie | liens | V |
| Redondances : comparer | liens | V |
| Aides IA : étiquettes (IA8), appréciation (IA9), meilleure de la pile (IA10), contrôle de la sélection (IA11) ; vignettes → montrer la photo | colonne de droite | V |
| **Tri rapide** : Espace/1 ★, 2 ★★, X pas dans l'album, ⌫/Suppr à décider, R/Maj+R tourner, ← → précédente/suivante, Échap fermer, molette/glisser/0 zoom ; en fin : Aller à la première à décider (Entrée), Fermer, Terminer, Revoir depuis le début | boutons + clavier | V/C |
| Tri rapide : recadrer (K), déplacer (M), comparer (C), **annuler (Ctrl+Z)** | **absents** (touches avalées) | — |
| **Comparateur** (lot 3 de la charte) : « ★ Dans l'album / ★★ Grande / Pas pour l'album / À décider » sous chaque photo (état allumé), présentation calculée et Entrée, double-clic = une à la fois, ↑ ↓ photo, la photo courante (date, dossier, note et choix de l'IA en bref) sur la ligne d'information, le texte entier de l'IA dans « Une à la fois » et l'infobulle, zoom − / Photo entière (0) / +, molette, glisser, Annuler / Rétablir, Fermer (Échap), bande des vignettes avec leur état ; aucun numéro affiché (les touches 1 à 9 n'y servent pas) | fenêtre | V/C |
| Comparateur : Tourner, Recadrer… (photo affichée en « Une à la fois ») | légende de droite | V |
| **Recadreur** : glisser le cadre, tirer un coin, Libre / 3:2 / 4:3 / Carré, En portrait / En paysage, Redresser (curseur) + 0°, Tout reprendre, Fermer sans recadrer, Accepter le recadrage (Entrée), Échap | fenêtre plein écran | V/C/G |
| Voir une photo en grand **sans** la trier | **absent** (le double-clic ouvre le Tri rapide) | — |

## 17. Étape 12 « Album »

| Fonction | Accès | Vu |
|---|---|---|
| Replier / rouvrir l'explication | bouton collé au titre | V |
| Ordre (par journée puis sortie / chronologique) | liste | V |
| Photos par page ; chaque section sur une nouvelle page ; cible (pages) | champs | V |
| Un sous-dossier par section dans « Album » | « Réglages avancés » | V |
| Aides IA : ton, part des photos légendées, informations internet, titres (IA12), légendes (IA13), couvertures (IA14), contrôle (IA15) | « Aides IA » replié | V |
| Conseil cible : passer à N photos par page / Aller à la sélection | liens dans l'encart | V |
| Photos en double retirées | replié | V |
| Onglets Aperçu des pages / Tous les textes | onglets | V |
| Titre de l'album ; couverture : choisir une proposition de l'IA, retirer | en tête de l'aperçu | V |
| Section : titre, introduction, « utiliser » les textes de l'IA, Regrouper avec la précédente, Supprimer ce découpage, séparer un bloc regroupé | en-tête de section | V |
| Clic sur une photo → panneau collant : légende (« utiliser » celle de l'IA), Enregistrer la légende (et à la sortie du champ), Grande photo ★★ / Petite photo ★, ↻ Tourner, Choisir comme couverture / Ne plus…, Nouvelle section à partir d'ici / Supprimer la section qui commence ici, Retirer de l'album, Fermer | panneau en haut de la liste | V |
| Tous les textes : reprendre les légendes de l'IA, écrire chaque légende | tableau | V |
| Recadrer, voir en grand, changer l'ordre d'une photo | **absents** | — |
| Annuler un changement de titre, de section, de couverture, d'ordre | **impossible** (hors historique) ; Ctrl+Z annule à la place la dernière action du plan (étoile, légende, rotation) | — |

## 18. Étape 13 « Création de la sortie »

| Fonction | Accès | Vu |
|---|---|---|
| Ce qui sera écrit (tableau), place nécessaire | page | V |
| Créer / mettre à jour la sortie (confirmation chiffrée « Écrire » / « Annuler ») | barre du bas | V |
| Arrêter l'écriture | bouton | V |
| Mettre à jour l'inventaire (si la source a changé) | lien dans le bilan | V |
| Ouvrir le rapport | bouton | V |
| Vérifier à nouveau | barre du bas (après écriture) | V |
| Explication repliable | **absente** | — |

---

## 19. Fonctions présentes à un endroit, absentes là où on les attend

| Fonction | Présente | Absente (attendue) |
|---|---|---|
| **Recadrer / redresser** | Sélection : barre flottante (1 photo) et touche K | Tri rapide (vue en grand), Comparateur, Album (qui sait tourner), visionneuse des autres étapes |
| **Tourner** | Sélection (↻, R), Tri rapide (R), Album (« Tourner ») | Comparateur, visionneuse de l'étape 7 ; la grille de l'étape 7 n'affiche même pas la rotation décidée à l'étape 11 (`GrillePhotos.tsx:318` : rotation seulement si la page passe des badges) |
| **Bouton « Annuler : … »** | Floues (en-tête d'étape), Lieux, Sélection | Doublons, Petits dossiers, Nommage, Consolidation, Album, Tri (notification ou Ctrl+Z seulement) |
| **Bouton Rétablir** | Floues, Lieux, Sélection (icône et mot) | partout ailleurs (Ctrl+Y) |
| **Ctrl+Z** | pages d'étape | Tri rapide, Comparateur, Recadreur, Fenetre (rien ne se passe) |
| **Voir en grand** | Dossiers, Floues, Lieux, Petits (centre), Consolidation, captures | Sélection (le double-clic ouvre le Tri rapide), Nommage, Album, Doublons (seulement « Comparer en grand ») |
| **Boutons dans la vue en grand** | Tri rapide (8 boutons) | Visionneuse (aucun : M, Suppr seulement au clavier) |
| **Déplacer** | Lieux, Sélection | Tri rapide, visionneuse (clavier seulement à l'étape 7) |
| **Taille des photos** | Dossiers, Doublons, Tri, Lieux, Petits, Consolidation, Sélection, Réglages | Floues, Nommage, Album, ligne de temps, onglet Rafales vide |
| **Ctrl+A** | Lieux, Sélection | Floues |
| **Liste des raccourcis « ? »** | Floues, Lieux, Doublons, Sélection | Dossiers, Tri, Petits, Nommage, Consolidation, Album (alors que Petits et Consolidation ont des touches) |
| **Explication repliable** | étapes 3 à 12 | Inventaire, Sortie, étape 1 |
| **← Retour** | Réglages, Journal, Fonctions IA, Aide | Configuration (où mènent pourtant les étapes 1, 2, 6, 10) |
| **Chercher un dossier** | Lieux, Sélection, Dossiers, Doublons | listes de Petits et Consolidation |
| **Clic sur le budget IA → Journal** | annoncé dans l'infobulle | pas cliquable |
| **Changer l'ordre d'une photo dans l'album** | — | Album (seulement « ordre » global) |
| **Exclure un dossier de la consolidation** | libellé « exclus à la main » | aucun bouton ne le fait plus |

## 20. Fonctions en double qui se comportent différemment

| Doublon | Variantes | Problème |
|---|---|---|
| **« Annuler »** | (1) bouton Annuler des étapes 4, 7, 11 = dernière action **de n'importe quelle étape** ; (2) Ctrl+Z, idem, mais muet dans les fenêtres plein écran ; (3) « Annuler » des notifications = même historique, sauf à Petits dossiers « Gardé seul » où il défait autre chose (hors historique) ; (4) « Annuler ce choix » (Petits, Consolidation) = défait un élément précis ; (5) « Défaire » (Consolidation) ; (6) « Annuler » des fenêtres (Recadreur, confirmation, Autre dossier…, noms en attente) = fermer sans rien faire ; (7) « Annuler les changements » (Configuration) = oublier le brouillon | même mot pour « défaire » et « fermer » (anti-modèle 3) ; l'utilisateur ne sait ni quoi ni sur quelle étape |
| **Aide** | bouton « Replier »/« Aide » collé au titre (étapes 3-6, 8-10, 12) ; « Replier » en haut à droite puis « Aide » en bout de barre (7, 11) ; touche « ? » (raccourcis, aucun bouton) ; menu ☰ → Aide ; lignes grises « Clavier : … » (Doublons, Petits, Consolidation) ; infobulles | 4 places, 2 libellés, contenus différents |
| **Taille des photos** | composant `CurseurTaille` (3, 5, 6, 8, 10) ; curseur recopié à la main (7, 11, infobulles différentes) ; curseur de Réglages ; facteur 0,6 aux étapes 3, 6, 8, 10 | même position du curseur = tailles différentes selon la page |
| **Vue en grand** | Visionneuse (aucun bouton, M/Suppr) ; Tri rapide (boutons de choix, R) ; Comparateur « une à une » ; « Comparer en grand » (Doublons) | quatre visionneuses, quatre jeux de touches ; Comparer : ↑ ↓ photo, ← → groupe, alors que la visionneuse et le Tri rapide gardent ← → pour la photo (touche à deux sens, à aligner au lot 4) |
| **Explication** | `TeteEtape` (bouton dans le titre) ; `EnteteEtape` + `BoutonAide` (7, 11) | deux mécanismes, deux places |
| **« Pas dans l'album »** | « Pas pour l'album » (barre, filtres, comparateur), « pas dans l'album » (Tri rapide), « Pas dans l'album » (en-tête du Tri rapide), « Retirer de l'album » (Album), « ✕ » (badge) | 5 libellés pour le même état |
| **Écarter** | « Écarter » (Floues, va dans _mis_de_cote), « Mettre de côté » (Lieux), « Tout écarter » (Doublons), « Ranger dans leur dossier » (captures, leur propre dossier, pas mis de côté), « Pas pour l'album » (reste dans l'archive) | sens voisins, conséquences différentes |
| **Fermer** | « Fermer » (Fenetre, Comparateur), « × » (Visionneuse), « Échap fermer » (Tri rapide), « Fermer sans recadrer » (Recadreur), « Fermer le tri rapide » / « Terminer » | — |
| **Valider** | « Valider et continuer », « Continuer » (étape 1), « Créer le projet », « Créer / mettre à jour la sortie », « Vérifier à nouveau », « Accepter », « Réunir », « Ranger ensemble », « Renommer », « Valider le recadrage » | acceptable, mais le bouton du bas change de sens à l'étape 13 |
| **Clic sur une photo** | Doublons : **décide** (choisie à garder) ; Floues, Lieux, Sélection : sélectionne seulement ; Dossiers, Petits, Consolidation : ouvre en grand ; Album : ouvre le panneau | même geste, quatre effets |
| **Double-clic sur une photo** | visionneuse (Floues, Lieux) ; Tri rapide (Sélection) ; rien (Doublons) | — |
| **Suppr / Retour arrière** | Lieux : mettre de côté ; Floues : écarter ; Sélection et Tri rapide : remettre « à décider » | même touche, effets opposés |
| **X** | Floues : écarter (va dans _mis_de_cote) ; Sélection : pas pour l'album (reste dans l'archive) | — |
| **N** | Doublons : journée suivante ; Consolidation : **refuser** la proposition | une touche de navigation devient une décision |
| **K** | Doublons, Petits, Consolidation : élément précédent ; Sélection : recadrer | — |
| **1 à 9** | Lieux : déplacer vers un dossier récent ; Sélection : « 1 » = ★ ; Comparateur des Doublons : garder/écarter la photo n | — |
| **Entrée** | Lieux : voir en grand ; Sélection : Tri rapide ; Comparateur : bascule côte à côte / une à la fois (aussi sur le choix d'une photo, une vignette, le bouton de présentation ; Espace les active) ; Recadreur : valider ; Nommage : renommer | — |
| **Espace** | Doublons : choisir la photo (bouton actif) ; Sélection : ★ | — |
| **Cible de l'album** | Sélection (nombre, unité pages/photos, par page) ; Album (nombre, par page, sans l'unité) | deux réglages pour une donnée |
| **Légende** | panneau photo (sortie du champ **et** bouton « Enregistrer la légende ») ; tableau « Tous les textes » (sortie du champ) | — |
| **Enregistrer** | autosauvegarde partout ; Configuration : bouton « Enregistrer » obligatoire, brouillon perdu si on quitte ; lieux fréquents (étape 6) : enregistrés tout de suite | deux modèles d'enregistrement |
| **Badge « nouveau »** | dossier créé par le tri (étape 7, partout dans le panneau) ; photo arrivée à la dernière mise à jour de l'inventaire | même mot, deux sens |
