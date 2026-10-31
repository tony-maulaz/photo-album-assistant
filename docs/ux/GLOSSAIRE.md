# Glossaire de l'interface

Un mot, un sens, dans toute l'application (règle M1 de `docs/GUIDE_UX.md`).
Avant d'écrire un libellé, chercher ici le mot et son sens ; un mot nouveau
s'ajoute ici en même temps que dans le code et dans sa table anglaise
(`app/src/traductions/en/`).

Colonnes : le mot tel qu'il s'affiche, ce qu'il veut dire **et seulement
cela**, sa traduction anglaise (celle des tables quand elle existe), les mots à ne pas employer pour la
même chose. **(à résoudre)** marque un double sens relevé par l'audit D108,
à trancher dans le lot du vocabulaire ; d'ici là, ne pas l'étendre.

## Le projet et ses dossiers

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| projet | Un tri en cours : un dossier source, un dossier de sortie et les décisions prises | project | travail, session |
| source, dossier de photos d'origine | Le dossier à trier ; jamais modifié | source | entrée, original seul |
| sortie, dossier de sortie **(à résoudre)** | Le dossier où le résultat est écrit (étape 13 « Création de la sortie ») ; double sens avec « sortie » = balade | output, output folder | export, destination |
| sortie **(à résoudre)** | Une balade d'un jour ou d'une demi-journée, devenue un dossier (« Lieux et sorties ») | outing | excursion, événement |
| dossier | Un dossier du rangement proposé (le plan), avant écriture | folder | répertoire, album |
| Photos | Le dossier principal de la sortie, qui contient tous les dossiers rangés | Photos | racine (sauf dans le code) |
| Mis de côté | **Le lieu** : le dossier de la sortie (`_mis_de_cote/`) où va ce qui est écarté, et la vue de ce dossier dans une liste de dossiers ; rien n'est supprimé. Jamais un état ni un geste (30.10, É14, question 4) | Set aside (the “Set aside” folder) | mis à part, exclu, archive, supprimé, poubelle ; « mis de côté » pour un état (« Écartée ») ; l'onglet « Mis de côté » de Doublons (devenu « Écartées ») |
| écarter, Écarter | **Le seul verbe** pour enlever une photo ou un élément du rangement, partout (Floues, Doublons, Tri, Lieux et sorties, visionneuse, Aide) : ce qui est écarté va dans « Mis de côté », rien n'est supprimé (É14, question 4 ; CHARTE C-10.9) | set aside, Set aside | supprimer, jeter, retirer, mettre de côté |
| Autres fichiers | Ce qui n'est ni photo ni vidéo, recopié tel quel | Other files | divers |
| Autres (onglet du Tri) | Les photos rangées hors des voyages, sorties et dossiers de la maison : captures d'écran (leur propre dossier), photos sans date, vidéos seules | Others | mis à part (sens de « Mis de côté ») |
| Ranger dans leur dossier | Mettre les captures d'écran dans leur propre dossier, hors de l'album ; rien n'est mis de côté | Put in their folder | mettre à part |
| journée | Les photos d'une même date, regroupées pour la relecture | day | jour (seul, ambigu avec la date) |
| voyage | Plusieurs jours loin du domicile, un dossier par voyage | trip | séjour, vacances |
| domicile, maison | Le lieu de résidence, d'après la configuration | home | adresse |

## Les étapes

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| étape | Une des treize étapes de l'assistant, numérotées | step | phase ; jamais pour un lieu d'un voyage (« lieux visités ») |
| Inventaire | Étape 2 : lister et analyser la source | Inventory | scan |
| Photos floues / floues | Étape 4 : photos ratées par le flou | Blurry photos / Blurry | nettes (sens inverse), ratées |
| Doublons | Étape 5 : copies exactes, rafales, même scène | Duplicates | copies (seul), double |
| Copies exactes | Le même fichier en plusieurs exemplaires (ou copie réduite) | Exact copies | doublons stricts |
| Rafales | Photos quasi identiques prises à la suite | Bursts | séries |
| Même scène (IA) | La même scène photographiée plusieurs fois, repérée par l'IA | Same scene (AI) | similaires |
| tri, Tri automatique **(à résoudre)** | Étape 6 : le rangement par date et lieu | Automatic sorting | « Tri rapide » (autre sens, à renommer) |
| Lieux et sorties | Étape 7 : relire les dossiers proposés par le tri | Places and outings | organisation |
| Petits dossiers | Étape 8 : rattacher les dossiers de quelques photos | Small folders | dossiers orphelins |
| Nommage | Étape 9 : donner un nom parlant aux dossiers | Naming | renommage (c'est l'action) |
| Consolidation **(à résoudre)** | Étape 10 : réunir les dossiers d'une même sortie ou d'un même voyage ; terme interne (M2) | Consolidation | fusion (dans l'interface : « réunir ») |
| réunir, « Réunir avec… » | Mettre deux dossiers ou plus en un seul (Lieux : « Réunir avec… », glisser un dossier sur un autre ; Consolidation) | gather, Gather with… | fusionner, empiler, consolider |
| Sélection | Étape 11 : choisir les photos de l'album | Selection | tri (autre sens) |
| Album | Étape 12 : la mise en page du livre photo | Album | livre, ifolor (marque) |
| Création de la sortie **(à résoudre)** | Étape 13 : écrire le dossier de sortie et le bilan | Creating the output | export, synchronisation |

## La bande sous la photo : proposé ou décidé (30.10.2026, É13, D112)

Le mot et sa couleur disent ce qui arrive à la photo ; l'icône dit d'où vient
l'idée ; le plein dit que c'est décidé (CHARTE C-9.2). D'abord à Floues ;
depuis le 30.10 (É14), aussi à Doublons, dans « Comparer en grand », à la Sélection
(sans punaise, C-9.13) et dans « Mis de côté » (C-9.14).

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| proposé ; À garder, À écarter | Ce que l'application (le réglage, le groupe) ou l'IA propose pour une photo ; cela peut encore changer sans vous (si vous bougez le réglage). Bande en bordure fine, le mot à l'infinitif (« À garder », « À écarter »), icône ✓ ✕ ou ✦ ; « Valider et continuer » suit la proposition | suggested ; To keep, To set aside | automatique (rien n'est automatique), conseillé (réservé au réglage conseillé), à valider |
| par vous ; Gardée par vous, Écartée par vous | Décidé par votre geste : un clic sur la bande, G (ou S à Floues), X. La photo ne bouge plus avec le réglage. Bande pleine, avec la punaise ; quand la place manque, « Gardée » / « Écartée » avec la punaise, « par vous » dans l'infobulle et le nom lu. Filtre « Par vous » | by you ; Kept by you, Set aside by you | forcé, manuel, épinglé, sauvée, « Sauver » (devenu « Garder ») |
| Écartée avant | Une photo écartée par les anciens scripts, que le réglage d'aujourd'hui garderait : elle reste écartée, rien ne change dans ce qui sort (question 9). Bande pleine grise, ✕ | Set aside earlier | écartée par un script, ancienne, archivée |
| à vérifier, « ? » | Une proposition peu sûre, à relire : proche du réglage, ou l'IA n'est pas du même avis. Un « ? » brun, nu, toujours suivi du mot (« ? À écarter ») ; jamais sur une décision. Filtre « ? » de Floues ; « dont 3 à vérifier » dans la barre du bas | to check | confiance basse, Conf., incertain, douteux, l'icône Aide (« ? » cerclé, bleu) |
| Écartée, Écartées | **L'état** d'une photo qui part dans « Mis de côté » (bande « Écartée », « Écartée par vous ») ; l'onglet « Écartées » de Doublons, qui montre les photos écartées à cette étape (« 5 photos » dessous) et où un clic sur la bande la garde par vous (30.10, É14, question 4 ; CHARTE C-9.14) | Set aside | Mis de côté (le lieu), Remise, mise de côté |
| Floue, Doublon, Copie exacte | La raison écrite dans la bande d'une photo de « Mis de côté », avec l'icône de son origine (« ✕ Floue », « ✦ Floue », « ✕ Copie exacte ») ; une photo écartée à la main dit « Écartée par vous » (É14, C-9.14) | Blurry, Duplicate, Exact copy | doublon exact, doublon strict |
| Retirer mon choix | Enlever votre décision sur une photo : la punaise s'en va, la photo revient à la proposition (à Floues, au réglage). Touche Suppr ; un second clic sur une bande « par vous » fait de même (« ↺ Revenir à la proposition » au survol). À ne pas confondre avec « Annuler » (Ctrl+Z), qui défait le dernier geste | Remove my choice ; Back to the suggestion | Selon le curseur, Selon le réglage, réinitialiser, Annuler, Ne plus choisir (sens : ne plus sélectionner) |

## Décisions sur une photo (Sélection, Album)

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| Dans l'album ★ | Photo choisie pour l'album ; bande ambre pleine (É14, C-9.13). Un clic sur la bande d'une photo hors de l'album l'y met (« ⇄ Mettre dans l'album ») ; sur une photo de l'album, la remet à décider (« ⇄ Remettre à décider ») | In the album ★ ; Put in the album, Back to undecided | retenue, sélectionnée, favorite |
| Grande ★★ | Photo choisie, en grand dans l'album | Large photo ★★ | top, coup de cœur |
| Pas pour l'album | Photo gardée dans le rangement, pas dans l'album ; bande grise pleine, sans icône (É14, C-9.13) ; « Hors album » quand la bande est trop étroite | Not for the album ; Out of album | rejetée, supprimée, mise de côté (autre sens), écartée (elle reste rangée) |
| À décider | Photo sur laquelle on reviendra | To decide | en attente, plus tard |
| Décider une par une | Parcourir les photos en grand, une décision par photo (remplace « Tri rapide », D108) | (à traduire) | Tri rapide |
| Cible | Nombre de photos visé pour l'album | Target | objectif, quota |
| Recadrer et tourner | L'outil unique : quart de tour, redresser, recadrer (D108) | (à traduire) | Recadrer… seul, rogner |
| Tourner | Quart de tour en un clic | Rotate | pivoter |
| Comparer | Voir plusieurs photos côte à côte pour choisir | Compare | confronter |
| Déplacer… | Mettre une ou plusieurs photos dans un autre dossier | Move… | ranger, transférer |
| choisir (un clic) | Marquer une photo pour agir dessus ; un bouton valide (D101) | select | cocher (pour une photo) |

## Boutons et gestes communs

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| Valider et continuer | Accepter l'étape et passer à la suivante ; le seul emploi de « valider » (C-10.1). Plein seulement une fois l'étape finie (C-4.1) | Confirm and continue | Suivant, OK ; « valider » pour un groupe, un nom, un recadrage |
| Revenir | Retourner à l'étape précédente, ou à la page d'avant | Back | Retour (sauf « ← Retour à l'étape n »), Précédent |
| Annuler : *ce qu'il défait* | Défaire le dernier geste (Ctrl+Z), et seulement cela (A4) ; le bouton dit le geste, un verbe et un nombre sans nom ni parenthèse (« Annuler : déplacer 3 éléments », « Annuler : mettre 2 photos dans l'album »), le geste avec ses noms dans l'infobulle ; « Rien à annuler » sinon (C-8.2) | Undo: … / Nothing to undo | pour fermer une fenêtre ; un état (« Annuler : dans l'album ★ ») |
| Rétablir | Refaire ce qu'« Annuler » a défait (Ctrl+Y), à côté d'« Annuler » ; « Rien à rétablir » sinon | Redo / Nothing to redo | Refaire |
| Fermer, Ne rien faire, Rester sur la page | Quitter une fenêtre sans rien changer ; « Fermer sans recadrer » quand la vue laisse un réglage en cours | Close, Do nothing, Stay on the page, Close without cropping | Annuler |
| Accepter | Appliquer un choix ou une proposition : un groupe de doublons, un nom, un rangement, un recadrage (C-10.1). À plusieurs groupes, le bouton nomme sa portée (« Accepter les 7 groupes », « Accepter les 3 propositions ») et passe par une fenêtre qui chiffre | Accept | valider (réservé à l'étape), OK, appliquer |
| Accepter → | Le bouton d'un groupe de doublons : accepte puis passe au groupe suivant, sur le dernier d'une section à la section suivante (É14, C-4.2, C-10.8). Il ne nomme pas la photo : la ligne grise d'à côté dit ce qu'il fera (« garde la 2 · écarte 1 », « · puis septembre 2026 ») | Accept → ; keeps 2 · sets aside 1 | « Accepter : garder la 2… » dans le bouton, Valider →, OK |
| → et › | → : agit puis avance (« Accepter → », « Valider et continuer → ») ; › : va quelque part sans rien décider (« Suite à accepter : … › ») (É14, C-10.8) | → and › | → sur un lien qui ne décide rien |
| Garder plusieurs photos ; choisir : toutes · aucune | La case d'un groupe de doublons pour garder plus d'une photo ; cochée, elle montre « choisir : toutes · aucune » (aux Copies « tous · aucun »), et Ctrl+A fait « toutes ». Remplace « Tout garder » et « Tout écarter » (É14, question 3) | Keep several photos ; select: all · none | Tout garder, Tout écarter, Autres choix |
| Grouper, Classer | Les deux réglages de la liste de gauche de Doublons, visibles en segmentés : Grouper par Journée · Mois · Dossier ; Classer par Heure · Plus grands d'abord (É14) | Group, Sort | trier (autre sens), Grouper et classer (replié) |
| Continuer sans elles, Les voir d'abord | Les deux autres choix de la fenêtre qui s'ouvre à « Valider et continuer » quand des copies exactes restent à Doublons ; le plein est « Accepter les 3 copies et continuer » (É14, C-8.11) | Continue without them, See them first | Ignorer, Annuler |
| à accepter, pas encore accepté(s) | L'état d'un groupe de doublons dont le choix n'est pas encore appliqué (un état, un mot : C-10.2) ; filtres « À accepter · Acceptés · Tous » | to accept, not accepted yet | à valider, à relire, validé |
| Rien n'est supprimé | La phrase de la barre du bas, avec le bouclier, sur les étapes où l'on écarte : « Rien n'est supprimé : ce que vous écartez va dans « Mis de côté ». Vos photos d'origine ne bougent pas. » (C-8.4) | Nothing is deleted | supprimé, effacé |
| Par exemple : | Le début de tout texte d'exemple qui montre un contenu dans un champ, avec sa majuscule et ses deux-points (29.10, É11, réponse 12 de l’utilisateur ; C-10.7) ; jamais devant une consigne | For example: | ex., p. ex., « par exemple » en minuscule, italique |
| environ | Un prix ou une durée estimés (« environ 0,03 CHF », « moins de 0,01 CHF ») | about | ≈, ~ |
| Ignorer | Écarter une proposition pour de bon, sans toucher aux photos | Ignore | refuser, supprimer |
| Aide | Le panneau d'explication de l'étape (O2) | Help | Replier, Aide et outils (deux libellés à réunir) |
| Taille, Taille des photos | Le réglage de la taille des miniatures (O3) : un curseur gris entre une petite et une grande photo. Depuis le 29.10 (É11, réponse 11 de l’utilisateur), le mot ne s'affiche plus ; « Taille des photos » reste son nom pour le lecteur d'écran et l'infobulle (C-8.3) | Size, Photo size | zoom, loupe, « − + » |
| aide IA | Une fonction facultative qui envoie des photos à l'IA, coût affiché avant ; un bouton contour marqué de l'étincelle, avec son prix écrit dessus (C-4.6) | AI helper | automatique (rien n'est automatique) |
| Menu | Le menu de l'en-tête (Fonctions IA, Configuration, Réglages, Journal, Aide), écrit en toutes lettres à côté de son icône | Menu | ☰ seul |
| En essai | Une étape qui marche, mais dont la présentation peut encore changer ; vos réglages et vos choix sont gardés. Pastille neutre après le titre de l'étape et dans « Étape n sur 13 ▾ », avec sa bulle (29.10, É11, étape 1 des retours acceptée par l’utilisateur ; C-8.10). Aujourd'hui l'Album seul | Trial | bêta, beta, expérimental, provisoire, en test |
| nouveau | Arrivé avec la mise à jour de l'inventaire | new | créé (pour un dossier du tri) |
