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
| Mis de côté | Ce qui est écarté du rangement mais gardé (`_mis_de_cote/`) ; rien n'est supprimé | Set aside | mis à part, exclu, archive, supprimé, poubelle |
| écarter | Mettre de côté | set aside | supprimer, jeter, retirer |
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

## Décisions sur une photo (Sélection, Album)

| Mot | Sens | Anglais | À éviter |
|---|---|---|---|
| Dans l'album ★ | Photo choisie pour l'album | In the album ★ | retenue, sélectionnée, favorite |
| Grande ★★ | Photo choisie, en grand dans l'album | Large photo ★★ | top, coup de cœur |
| Pas pour l'album ✕ | Photo gardée dans le rangement, pas dans l'album | Not for the album | rejetée, supprimée, mise de côté (autre sens) |
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
| Accepter | Appliquer un choix ou une proposition : un groupe de doublons, un nom, un rangement, un recadrage (C-10.1) | Accept | valider (réservé à l'étape), OK, appliquer |
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
| à vérifier | Une proposition peu sûre, à relire | to check | confiance basse, Conf. |
| nouveau | Arrivé avec la mise à jour de l'inventaire | new | créé (pour un dossier du tri) |
