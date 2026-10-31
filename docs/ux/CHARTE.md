# Charte graphique : « Table lumineuse »

**État : style FIGÉ (D110, 27.10.2026), avec les évolutions É1 à É10 acceptées le 28.10 (D111), É11 et É12 (forme E, D112 point 8) acceptées le 29.10, É13 (badges d'origine et Floues dans le cadre, D112 points 6 et 7, réponse 20) et É14 (Doublons et Sélection, D112 points 2, 3, 4, 6 et 10) écrites le 30.10, É15 (Tri automatique et « Vos lieux », D112 point 9) écrite le 31.10 ; dispositions PROVISOIRES.**

- **Figé** (l'agent `gardien-style` le fait respecter, en priorité sur les
  autres agents d'interface ; seul l'utilisateur peut le faire évoluer) :
  C-1 police, C-2 tailles, C-3 couleurs, C-4 commandes, C-5 icônes, C-6
  espacements, rayons et ombres, C-9 états des photos, C-10 mots.
- **Provisoire** (les agents restent libres, D109, jusqu'à l'essai avec de
  vraies photos, le zoom à 125 % et les pages encore à dessiner : Album,
  Lieux et sorties, Consolidation, onglet Copies, Comparer de la Sélection) :
  C-7 gabarits et C-8 places fixes.

Direction choisie par l'utilisateur : la « Table lumineuse » (direction A),
améliorée par les remarques de l'utilisateur novice sur la direction B.
En une phrase : l'interface est plate et calme ; seules les photos ont du
relief, posées sur une table gris chaud ; chaque photo porte son état écrit
dans une bande sous elle ; **le vert plein veut dire « agir », et lui seul.**

Ce qui reste fixe au-dessus de cette charte : règles d'or 1 à 3 et 5 à 7,
fonctions de l'inventaire, glossaire, annulation et raccourcis, écran de
1280×580 utilisable.

Maquettes de référence : `docs/ux/charte/` (Doublons, Comparer en grand,
Sélection, Nommage, Tri ; bascule clair / sombre par `data-theme`). Les
captures aux deux tailles et aux deux thèmes se refont avec Playwright à
1440×900 et 1280×580.

## Choix de l'utilisateur (27.10.2026)

- Groupe accepté : il **reste visible, replié** en une ligne (« acceptée :
  1 gardée, 1 mise de côté · Revoir ») ; D100 levée sur ce point.
- **Miniatures au Tri** : les dossiers proposés montrent quelques photos
  (D104 levée sur ce point). *Changé par É15 (réponses 13 et 14 du 29.10) :
  les photos viennent à la demande, bouton « 38 photos » de chaque ligne.*
- **Dossier de la photo dans l'infobulle** et dans Comparer, plus sous chaque
  miniature (D96 levée sur ce point ; « rangée dans … » reste dans Comparer).
- À Doublons, menu **« Autres choix ▾ »** pour Tout écarter ; **« Tout
  garder » reste un bouton visible** et **« Garder plusieurs photos » une
  case visible** (jamais cachée, D101). *Levé par É14 (question 3 du 29.10) :
  « choisir : toutes · aucune » après la case, et Ctrl+A ; la case reste.*
- Accepter une journée entière passe par une **fenêtre qui chiffre** ce qui
  sera écarté (« dont N où vous n'avez rien choisi »). *Gardé par É14 d, pour
  toute acceptation de plusieurs groupes.*
- Pas de ★ à Doublons : la photo conseillée se dit en mots (« ✦ Conseillée
  par l'IA », « La plus nette ») ; Comparer s'ouvre sur cette photo, sinon
  sur la première « À garder », sinon la première (choix de Tony du 27.10,
  précisé le 28.10). Après « Choisir avec l'IA », la vue passe sur la photo
  choisie par l'IA (28.10).
- Flèches dans Comparer : **↑ ↓ photo, ← → groupe**, dans la journée ou le
  dossier affiché ; règle fixe, avec le rappel écrit.

## Choix de l'utilisateur (28.10.2026, questions du lot 2)

- Le **bouton plein visible sans défiler**, toujours. Fait dans « Comparer en
  grand » (barre du bas fixe) ; sur les pages Doublons et Sélection, il
  demande les bandes fixes du gabarit (C-7.1, C-7.3) : lot 4.
- Le **prix d'une aide IA** reste recalculé en direct sur le bouton (C-4.6).
- La police fait **65 Ko** (C-1.1).
- **« Rien n'est supprimé »** seulement là où l'on écarte des photos (C-8.4).

## Corrections après la revue du lot 3 (28.10.2026), à confirmer par l'utilisateur

- **Côte à côte : la rangée doit tenir, pas chaque photo.** Une carte garde
  au moins la largeur de son état et de ses choix (240 px, 340 à la
  Sélection) ; ce minimum compte dans la largeur de la rangée et ne refuse
  plus une photo étroite (portraits 9:16). Choisi à la main pour beaucoup de
  photos, le côte à côte passe sur deux ou trois rangées ; si les photos y
  feraient moins de 80 px de haut, le bouton est désactivé et dit pourquoi.
- **Le rappel des flèches reste à toutes les tailles** (C-4.10). Au palier
  « texte agrandi », les boutons de groupe et « Photo entière » gardent leur
  icône, leur nom passe dans l'infobulle et le lecteur d'écran (exception
  ajoutée à C-5.2, acceptée par Tony le 28.10).
- **« Groupe 2 sur 4 » passe dans le titre de la vue** (comme la maquette) ;
  la barre du bas dit « Groupe précédent » et « Groupe suivant ».
- **La présentation choisie à la main** est gardée d'un groupe à l'autre
  (pour les groupes du même nombre de photos), jusqu'à la fermeture de la vue.

## Évolutions acceptées par l'utilisateur (D111, 28.10.2026, lot 4)

Ces évolutions changent des règles figées ; elles sont acceptées (choix 1 et 2
de D111). Les règles C-7 et C-8 du cadre commun, plus bas, restent
**provisoires** jusqu'à l'essai de l'utilisateur sur de vraies photos.

| N° | Règle | Évolution |
|---|---|---|
| É1 | C-4.1 | Exactement un bouton plein sur les pages d'étape, dans Comparer et dans le Recadreur ; aucun dans la visionneuse et pendant « Décider une par une », où les choix sont la commande ; à la fin du parcours, un plein |
| É2 | C-3.9 | Salle sombre pour toutes les vues en grand (Comparer, Décider une par une, visionneuse, Recadrer et tourner) |
| É3 | C-6.6 | Les doubles pages de l'Album sont des feuilles blanches (rayon 6, sans ombre) posées sur la table |
| É4 | C-9.1, C-9.2 | Copies exactes : la photo une fois ; une bande par exemplaire, à gauche de sa ligne (44 / 40 px) ; la ligne entière se choisit |
| É5 | C-10.1, glossaire | « Réunir des dossiers » remplace « Consolidation » ; « Accepter » vaut aussi pour un recadrage |
| É6 | C-9.1, C-5.2 | Vignettes des vues de parcours : bande de 24 px, icône de 16 px, le mot dans l'infobulle et le lecteur d'écran |
| É7 | C-5.2 | Au palier, ‹ › de la journée en icône seule ; « Comparer en grand » prend son icône dans toute la liste de Doublons dès qu'un en-tête manque de place ; la pastille « à accepter » quitte l'en-tête d'un groupe ouvert ; les 4 outils de « Décider une par une » gardent leur mot |
| É8 | C-7.6 | Écran très bas (moins de 440 px de haut) : la page défile en entier, seule la barre du bas reste fixe (et la liste de gauche, là où elle est une colonne) |
| É9 | C-4.2, C-6.5, C-6.6, C-9.1, C-9.2 | Chaque photo d'une rafale porte sa place au début de sa bande d'état (« 4 · À garder »), qui prend la place de l'icône ; rien sur l'image. Le plein de Doublons nomme la photo gardée et la montre en vignette de 24 px : « Accepter : garder la 4 [vignette], écarter 5 autres » ; « garder 3 photos, écarter 9 autres » ; un compte n'est jamais un nombre nu ; aux Copies, « garder celle de « dossier » » (nom exact, coupé au milieu au-delà de 40 signes si la place manque). Le même libellé sur la page et dans Comparer ; le plein au bout à droite de son en-tête, sur une ligne |
| É10 | C-10.1, glossaire | Une vue qui prend la place d'une page (« Décider une par une ») se quitte par « ← Revenir à *la page* » ; les vues ouvertes par-dessus (Comparer, visionneuse, Recadreur) par « ✕ Fermer » ; « Revenir » ne sert jamais à remettre un réglage (Recadreur : « Remettre la photo entière ») |

État du code (29.10, sous-lots 1 et 2 du lot 4, pas encore commités) : É1 et
É10 appliquées à la Sélection, à Doublons et au Recadreur ; É2 au Recadreur
(déjà en salle sombre) ; É4, É7 (« Comparer en grand » en icône dans toute
la liste, pastille hors de l'en-tête) et É9 à Doublons (page et « Comparer en
grand ») ; les autres viennent avec leurs pages.

Écarts du code à la proposition validée, **en attente de la décision de
l'utilisateur** (ils ne font pas évoluer la charte tant qu'il ne les a pas
acceptés ; questions dans `docs/ux/DEMANDES.md`, ligne du 29.10) :
- É4 : la ligne d'un exemplaire fait 56 / 40 px (deux lignes de texte :
  dossier, puis nom, date et poids), et non 44 / 40 ;
- É9 : le nom du dossier se raccourcit par la fin, pas au milieu (40 signes
  tiennent à 1024 px ; mesuré par `essai_cadre.mjs`) ; quand deux exemplaires
  sont dans le même dossier, le plein nomme le fichier gardé (« garder
  « 0140_….jpg », écarter 1 », raccourci au milieu), proposé après le tour 1
  des contrôles (le dossier ne dit pas lequel est gardé) ;
- les menus de portée (« Toutes les copies ▾ », « ✦ Toutes les rafales ▾ »,
  « Cette journée ▾ ») restent des menus à toutes les largeurs, alors que la
  maquette met l'action en clair à 1280 et 1440 (prix compris) ;
- « Garder plusieurs photos » reste sur la ligne des boutons au palier, pas
  dans l'en-tête ; pas de ‹ › autour du menu de la journée (N et P au clavier) ;
- le compte des photos écartées est sur l'onglet « Mis de côté », plus dans
  la barre du bas ;
- au palier, les photos de Doublons font les trois quarts du réglage « Taille »
  (160 → 120 px, comme la maquette) pour que la bande « À garder » se voie à
  l'arrivée ;
- (tour 2 des contrôles) le message passager des pages passées au cadre
  s'écrit dans l'en-tête d'étape, à la place de la consigne et à côté
  d'« Annuler » (son propre « Annuler » y est retiré, celui de l'en-tête suffit,
  sauf pour un message venu d'une autre étape, « 12 photos écartées » de
  Floues à l'arrivée : il garde son « Annuler », tour 3) ; dans une vue en
  grand ou un dialogue, la bulle d'avant revient ; la zone `role=status` de
  l'en-tête reste dans l'arbre d'accessibilité même vide (masquée à l'écran) ;
- (tour 2, complété au tour 3) choix 6 A sur les pages passées au cadre :
  « Rien à annuler ici » / « Rien à rétablir ici » quand le dernier geste est
  d'une autre étape (l'étape en infobulle, « allez-y pour l'annuler ») ;
  **Ctrl+Z et Ctrl+Y suivent la même règle** et le disent (« Rien à annuler
  ici. Votre dernier changement est à l'étape 4, … ») ; les pages pas encore
  passées gardent l'annulation globale ; « Y aller » reste au sous-lot 4a2 ;
- (tour 2) Recadreur : « Remettre la photo entière » devient « Déjà la photo
  entière », désactivé, quand il n'y a rien à remettre ; restent à faire au
  sous-lot 4c, pour que l'essai ne prenne pas l'écran d'aujourd'hui pour la
  cible : Aide en haut à droite, formats en segmenté sur deux lignes,
  « En largeur | En hauteur » au lieu du lien « En portrait / En paysage »,
  « Assez net pour une grande photo » au lieu des « pixels gardés », ✓ sur le
  plein, cadre réglé aux flèches et par + / −.

Repris dans le code après le tour 1 des contrôles (29.10), conformément aux
choix de l'utilisateur du 27.10 : « Tous » allumé par défaut à Doublons
(C-4.8) ; un groupe accepté se replie à sa place avec tous les filtres, il ne
s'en va plus avec « À accepter » (D100 levée) ; les groupes posés sur la
table, sans carte blanche (C-6.6) ; la frise en vert doux bordé (sa coche
dans des cases de 28 px viendra avec la barre de l'application, sous-lot 4b).

## Évolution É11 acceptée par l'utilisateur (29.10.2026, retours du 29.10)

Réponses de l’utilisateur du 29.10 aux 18 questions de la page des retours (mot pour
mot dans le dossier de travail, hors dépôt : `retours-29-10/reponses.md`) :
« 1 a », « 11 oui mais on enlève le texte taille », « 12 oui », « pour l'aide
c'est top », et l'étape 1 de l'ordre proposé (« Partout »), qui comprend la
pastille « En essai » de l'Album. É11 change le style figé de D110 ; les
règles plus bas sont récrites en conséquence (marquées « É11 »).

| É11 | Règles | Évolution |
|---|---|---|
| a. Boutons sobres | C-2.2, C-2.3, C-4.3, C-4.4, C-5.1, C-5.2, C-6.5, C-8.1 | Bouton ordinaire : 14 px, graisse 500, 32 px de haut, bord 1 px `--contour`, rayon 8, marge intérieure 12. Plein dans la page : 14 px, 600, 32 px, aplat vert, rayon 8, marge 14. Barre du bas (« Revenir », « Valider et continuer ») : 16 px, 500, 36 px, bord 1 px, rayon 8. Segmenté et pastilles de filtre : 32 px, 14 px. Icônes de 16 px dans tous les boutons. Menu sans bord (Aide : voir d). Aucun `font-weight: 700` sur un bouton. Le plein ne se distingue que par son vert et reste le seul (C-4.1). Sur toutes les pages à la fois, passées au cadre ou non |
| b. Texte d'exemple | C-3.1, C-3.8, C-10.7 (nouvelle) | Jeton `--texte-exemple` (#6b7079 en clair, #8b9099 en sombre), pour `::placeholder` seulement : nettement plus pâle qu'un texte tapé dans les deux thèmes. « Par exemple : » devant chaque exemple de contenu, sans italique, exemples trop longs raccourcis |
| c. Curseur de taille | C-3.2, C-5.2, C-7.3 bis, C-8.3, C-8.3 (lot 4) | Un seul curseur gris, une petite et une grande photo à ses bouts (un cran au clic), flèches du clavier ; dans l'en-tête d'étape, à la même place sur chaque page ; il remplace « Taille − + » à la Sélection et à Doublons. **Sans le mot « Taille »** (choix de l'utilisateur) : le nom accessible reste « Taille des photos ». Le curseur du flou de Floues passe en gris lui aussi, à sa place |
| d. Bleu = Aide | titre de C-3, C-3.10 (nouvelle), C-8.1, C-8.1 (lot 4) | Un bleu doux bordé, réservé au bouton Aide, sans clignotement ; états normal, « à lire », ouvert |
| e. « En essai » | C-8.10 (nouvelle), glossaire | Pastille neutre grise après le titre de l'Album et dans « Étape 12 sur 13 ▾ », avec sa bulle |

**Précisions du gardien** (écarts des maquettes, tranchés par la charte) :
- l'Aide de la maquette `lot_b` est en graisse 600 : elle suit l'échelle, 500 ;
- la pastille « En essai » de la liste des étapes est en 12 px dans la maquette
  `lot_d` : 14 px (C-2.2) ;
- la grande photo du curseur fait 22 px, seule icône de bouton au-dessus de
  16 px : c'est elle qui dit « plus grand » (C-5.1).

**Ce qu'É11 change ailleurs** : toutes les pages sont à recapturer (Playwright,
1440×900 et 1280×580, clair et sombre) ; `charte.test.ts` (tailles, graisses,
rayons), les hauteurs mesurées par `essai_cadre.mjs` (qui trouve la Taille dans
l'en-tête, et distingue le réglage du flou par `data-action="tolerance"`) et
`outils/contrastes.py` (texte d'exemple sur le fond réel de chaque champ, trois
paires de l'Aide) sont à adapter.

**Hors É11** (proposés le 29.10, en cours d'analyse, rien n'est figé) : la place
d'Annuler et Rétablir, le défilement de toute la page, les badges sous les
photos, Floues dans le cadre commun, « Accepter → » et les menus de Doublons, le
Tri automatique, Lieux et sorties, le Nommage. Numéros réservés pour eux, pour
que les analyses ne se marchent pas dessus : C-4.12 (filtres visibles hors de
tout menu), C-8.9 (bandeau de rappel), C-10.8 (flèches → et ›), C-10.9 (un état
nommé par le participe), C-10.10 (ce qui vaut pour chaque ligne s'écrit une
fois).
Depuis, la place d'Annuler et Rétablir et le défilement de toute la page sont
tranchés par É12 (plus bas), qui prend aussi C-4.12.

État du code (29.10) : É11 appliquée (étape 1 des retours du 29.10, 33512c1).

## Évolution É12 acceptée par l'utilisateur (29.10.2026, D112 point 8 : forme E)

Réponses de l'utilisateur du 29.10 (mot pour mot dans `retours-29-10/reponses.md`,
hors dépôt) : la question 10, puis sa précision sur le défilement (« une barre
menu simple reste en haut avec titre et action principale »), la remarque de
Floues (« on met que le icon annuler et le texte en tooltip ») et « 21 oui »
(la consigne quitte toutes les étapes). Spécification : `reponses/proposition.md`
§ C, qui prime, complétée par `proposition.md` § 2 « forme E », points 1 à 10,
**sauf le point 4** (Aide et Menu ne restent pas dans la barre de
l'application : ils descendent dans la ligne de l'étape ; pas de « ↑ Haut de la
page ») et sauf la largeur d'« Annuler : … » du point 7 (↶ ↷ en icônes seules).
Maquettes : `reponses/maquettes/` (captures `2_floues_*`, `3_doublons_*`,
`3_selection_*`, `4_nommage_*`, arrivée et après défilement ; `mesures.json`).
É12 change C-7 et C-8 (provisoires), C-5.2 et C-10.4 (figées) ; les règles plus
bas sont récrites en conséquence (marquées « É12 »). Dans les règles plus
anciennes, « en-tête d'étape » désigne désormais la ligne de l'étape.

> **Ce qui parle du projet part avec la page ; ce qui parle de l'étape reste.**

| É12 | Règles | Évolution |
|---|---|---|
| a. Une seule barre de défilement | C-7.1, C-7.1 (lot 4), C-7.6 bis ; GUIDE O10 | La page défile en entier, à toute hauteur (le cas « moins de 440 px » d'É8 devient la règle). **Une zone de photos ne défile jamais dans une autre** : la grille suit la page. Seules les colonnes collées (liste de gauche, panneau de droite, Aide ouverte) défilent seules |
| b. Ce qui part avec la page | C-7.1, C-7.2 | La barre du projet (logo, nom du projet, frise, « Étape n sur 13 ▾ », ✦ IA), la barre d'outils (onglets, filtres, aides ✦ d'ensemble) et les bandeaux au-dessus de l'étape (« Le dossier à trier a changé », copies restantes du Tri). On les retrouve en remontant ou avec la touche Origine ; le prix reste écrit sur chaque bouton ✦ (C-4.6) |
| c. La ligne de l'étape reste | C-2.4, C-7.1, C-8.3 (lot 4) | Collée en haut, sur les **13 étapes**, passées au cadre ou non : titre · vue en cours (f) · filtres s'ils tiennent · message passager (g) · curseur de taille · ↶ ↷ · Aide · Menu. Une page sans photos garde la place vide du curseur. Accueil, Configuration et pages sans étape : leur barre ne change pas |
| d. ↶ ↷ en icônes seules | C-5.2, C-8.2, C-8.2 (lot 4) ; GUIDE O4, M4 | Le geste est dans l'infobulle et le nom lu (« Annuler : écarter 1 photo », Ctrl+Z ; « Rétablir : … », Ctrl+Y) ; sans geste, « Rien à annuler ici » / « Rien à rétablir ici », grisé. ↶ au **même pixel sur chaque page** (maquettes : x ≈ 996 à 1280, 1156 à 1440, 740 à 1024), avant comme après le défilement, quel que soit le geste |
| e. Aide et Menu dans la ligne | C-7.2, C-8.1, C-8.1 (lot 4) ; GUIDE O2 | Ils quittent la barre de l'application des pages d'étape et descendent au bout de la ligne de l'étape : toujours visibles pendant le travail |
| f. Vue en cours en menu écrit | C-4.12 (nouvelle) | Après défilement, là où les onglets ou filtres ne tiennent pas dans la ligne (Doublons, Sélection, Nommage), la vue en cours tient dans la ligne en petit menu écrit (« Rafales ▾ », « Toutes ▾ », « À nommer ▾ ») : la vue choisie reste toujours écrite |
| g. Message qui rappelle ↶ | C-8.2 bis, C-8.3 bis | Chaque message qui suit un geste de la page finit par « ↶ ou Ctrl+Z pour l'annuler » ; un message venu d'une autre étape commence par le nom de cette étape et garde son lien « Y aller » (choix 6 de D111) |
| h. Consigne dans l'Aide | C-10.4 ; GUIDE O2 | La phrase de consigne quitte la ligne de l'étape, sur les 13 étapes ; son contenu est dans l'Aide de l'étape |
| i. Colonnes et têtes collées sous la ligne | C-7.1 ter, C-7.1 quater, C-7.3 (lot 4), C-7.3 bis, C-7.6 (lot 4), C-7.6 bis | Liste de gauche, panneau de droite, colonne d'Aide ouverte et têtes collées (tête de la table, en-tête du groupe en cours de Doublons avec « Accepter ») se collent **sous** la ligne de l'étape ; leur hauteur suit la place visible (variable CSS), leur fin reste atteignable ; une colonne dont la suite est cachée le dit par « ⌄ suite » fondu en bas. L'accroche des groupes de Doublons (`scroll-snap`) disparaît |
| j. Barre du bas | C-7.1 bis, C-8.4 (lot 4) | Inchangée, « Valider et continuer » au même pixel ; elle devient **opaque** : les photos passent dessous |

**Précisions du gardien** (écarts des maquettes et trous de la spécification,
tranchés par la charte) :
- le Menu de la maquette finit à 16 px du bord droit : **24** (C-6.2) ; ↶ garde
  sa place unique, ce sont les écarts entre ↷, Aide et Menu qui cèdent. La
  valeur mesurée dans le code, la même sur les 13 étapes à une largeur donnée,
  devient la référence de l'essai ;
- hauteur de la ligne : **48 px** (maquettes), la même sur les 13 étapes et
  d'un geste à l'autre ; le message ne la fait jamais grandir ;
- ↶ ↷ : boutons de 32 × 32 sans bord, comme Menu (C-4.4), icônes `annuler` et
  `retablir` de 16 px (C-5.1) ; grisés, l'icône passe en `--filet-fort` mais
  le bouton reste dans l'ordre de Tab (`aria-disabled="true"`, jamais
  `disabled`), pour que « Rien à annuler ici » se lise au clavier et au lecteur
  d'écran : sa raison est dans l'infobulle et le nom (exception à C-4.7) ;
- filets de 1 px `--filet`, 20 px de haut, entre le curseur et ↶, et entre ↷ et
  Aide (maquettes) ;
- dans le message, ↶ est l'icône SVG `annuler` de 14 px (C-1.4, C-5.1), jamais
  le caractère ; elle est lue « le bouton Annuler » ;
- Origine ramène en haut de la page **sauf** dans un champ, sur le curseur de
  taille (Origine y garde « plus petit cran », C-8.3), dans une liste ou un
  menu ouvert : une touche, un sens (GUIDE P4) ; elle figure dans les
  raccourcis de l'Aide ;
- le focus n'est jamais caché sous la ligne de l'étape ni sous la barre du bas
  (WCAG 2.4.11) : `scroll-padding` haut et bas égal à leur hauteur mesurée ;
- à l'arrivée sur une étape, la page est en haut (`history.scrollRestoration`
  manuel) : on voit la barre du projet et la barre d'outils.

**Ce qu'É12 change ailleurs** : GUIDE_UX O2 (Aide en haut de la barre de
l'application, consigne visible), O3 (curseur absent des pages sans photos),
O4 (« Annuler » avec son mot) et M4 (↶ ↷ sans mot), ainsi que le schéma de
l'ossature, sont remplacés sur ces points ; O10 est ajoutée. Hors charte, avec
le code : `docs/SPEC_APP.md` § 5 (disposition des pages) et
`docs/ux/INVENTAIRE_FONCTIONS.md` § 0 (ce qui part avec la barre). Essais à
adapter **sans assouplir ce qui reste vrai** : `essai_cadre.mjs` (ligne de
l'étape collée et immobile au lieu des bandes fixes ; Aide et Menu dans la
ligne ; plus de contrôle de l'accroche ; le message de Floues arrivé à
Doublons porte « Y aller ») et `essai_charte.mjs` (↶ ↷ de 32 × 32, le geste
dans le nom ; la ligne ne bouge pas avec le plus long geste) ; positions
d'Annuler de `captures_ux.mjs` ; `GrillePhotos` (bornes visibles : ligne de
l'étape et barre du bas déduites, mesurées) ; toutes les pages à recapturer.

**Hors É12** (sous-lots suivants de D112) : à Floues, ses badges, sa ligne de
titre avec filtres et le cadre commun complet (É12 n'y fait que la forme E :
la grille suit la page, plus de boîte de 420 px qui défile) ; les badges sous
les photos ; « Accepter → » et les menus de Doublons ; le Tri automatique ;
Lieux et sorties ; le Nommage (hors le menu écrit de f).
Depuis, les badges et Floues dans le cadre sont tranchés par É13 (plus bas).

État du code (29.10) : É12 appliquée (étape 2a des retours du 29.10, 3040b00).

## Évolution É13 acceptée par l'utilisateur (30.10.2026, D112 points 6 et 7 : badges d'origine ; Floues dans le cadre)

Réponses de l'utilisateur du 29.10 (mot pour mot dans `retours-29-10/reponses.md`,
hors dépôt) : question 6 (badges « style A » : punaise quand il a choisi, ✓ ou ✕
quand c'est l'application, ✦ pour l'IA, ? quand ce n'est pas sûr ; plein et
bordure ; un clic sur le badge change le choix ; « appliquer ces principes
partout »), 7, 9 (« écartée avant »), la remarque de Floues (les filtres sur la
ligne du titre, plus de phrase de consigne ni de mot « Taille »), puis **19 à 22**,
dont **la réponse 20, qui prime** : le premier clic sur le badge donne l'autre
sort, décidé par l'utilisateur ; un second clic rend la photo à la proposition
automatique. Spécification, dans cet ordre : la réponse 20 ; `reponses/proposition.md`
§ A (badges) et § B (ligne du titre de Floues) ; `proposition.md` § 3 à § 9
(Floues). Maquettes : `reponses/maquettes/` (`badges.html`, `floues.html`,
captures `1_badges_*`, `2_floues_*`, `mesures.json`). É13 change C-9.2 (récrite),
C-9.3, C-9.6, C-9.7, C-3.2, C-5.1 à C-5.3, C-4.8 et C-10.2 (figées), C-7 et C-8
(provisoires) ; les règles plus bas sont récrites en conséquence (marquées « É13 »).

> **Le mot et sa couleur disent ce qui arrive ; l'icône dit d'où vient l'idée ;
> le plein dit que c'est décidé.**

| É13 | Règles | Évolution |
|---|---|---|
| a. Le mot et sa couleur = quoi | C-9.2 (récrite), C-3.2, C-3.11 (nouvelle) | Le mot dit toujours ce qui arrive à la photo, et il ne disparaît jamais : « À garder », « À écarter » (proposé) ; « Gardée », « Écartée » (décidé). Sa couleur le redit : **vert, elle reste ; gris, elle part** (ambre, l'album, à la Sélection) |
| b. L'icône = d'où | C-5.1, C-5.3, C-9.2 | Une seule icône en tête de bande, 16 px : **punaise** = vous ; **✓ ✕** = l'application (le réglage, le groupe) ; **✦** = l'IA (sans prix dans la bande, comme dans la remarque, C-9.6) ; **« ? » brun nu**, sans cercle, toujours suivi du mot (« ? À écarter ») = à vérifier. « ? » ne sert qu'à une proposition : une fois décidée, la bande prend l'icône de son origine |
| c. Plein = décidé, bordure = proposé | C-9.2, C-3.11 | **Plein franc** (fond moyen, graisse 600) = décidé par un geste de l'utilisateur : un clic sur la bande, G ou X, « Accepter » un groupe, « Suivre l'avis de l'IA » ; l'icône garde l'origine (un groupe accepté montre « ✓ Gardée » en plein, un avis suivi « ✦ Écartée » en plein). **Bordure fine et pâle** de 1 px sur la surface (graisse 500) = proposé, cela peut encore changer sans vous. Une fois l'étape validée, tout passe en plein, l'icône gardant l'origine. Règle d'or 3 : une proposition ne ressemble jamais à une décision |
| d. « Écartée avant » | C-9.2 | Une photo écartée par les anciens scripts, que le réglage d'aujourd'hui garderait, reste écartée et le dit : « ✕ Écartée avant », en plein gris (question 9). Rien ne change dans ce qui sort |
| e. Le clic sur la bande | C-9.10 (nouvelle) | 1er clic : l'autre sort, décidé par vous (punaise) ; 2e clic : retour à la proposition (le réglage, l'IA ou le groupe ; à Floues, le réglage). Au survol, la bande prend la forme d'un bouton et dit l'effet du clic : « ⇄ Garder » / « ⇄ Écarter » sur une proposition, « ↺ Revenir à la proposition » sur un choix par vous. G et X fixent un sort par vous, même celui qui est proposé (il ne bouge plus avec le réglage) ; S reste un second nom de G à Floues ; Suppr = « Retirer mon choix » ; Ctrl+Z défait chaque geste. Gardes : la bande arrête le clic, ignore le double-clic et un second clic pendant 0,5 s, seule elle montre la main |
| f. Libellés mesurés | C-9.9 (nouvelle), C-10.2 | Le libellé long s'écrit dès qu'il tient dans la bande, mesuré selon sa largeur ; sinon le court (« punaise Gardée »), « par vous » passant dans l'infobulle et le nom lu. Jamais coupé (C-10.4) |
| g. Floues dans le cadre | C-4.8, C-4.12, C-5.2, C-6.6, C-7.3 ter (nouvelle), C-8.4 bis, C-8.7 bis (nouvelle), C-9.3, C-9.6, C-9.7, C-9.8 (nouvelle) | Une seule ligne de titre : « Photos floues · [Toutes 58 · À écarter 6 · ? 3 · punaise Par vous 2] · message · curseur de taille · ↶ ↷ · Aide · Menu », sans phrase de consigne, sans le mot « Taille », sans « Afficher : » visible ; sous 1180 px, les filtres redescendent dans une barre d'outils. Photos sur la table, une seule bande de 28 px, plus de chiffre sous la photo ; parties titrées ; photos qui partent un peu délavées ; panneau collé à droite |
| h. Ce que fera « Valider » | C-8.5 bis (nouvelle) | La barre du bas dit ce que « Valider » fera des bordures et des « ? » : « 6 photos seront écartées · 52 gardées · dont 3 à vérifier — Valider suit le réglage pour les photos en bordure » |
| i. Projets déjà ouverts | C-9.11 (nouvelle) | À la reprise (règle d'or 7), un choix fait photo par photo devient « par vous » (punaise, plein), un groupe accepté « application » (plein ✓ ✕), un avis de l'IA suivi « IA » (plein ✦), une photo écartée par les anciens scripts « avant » (« Écartée avant ») : aucune bande ne change de sens en passant à É13 |

**Précisions du gardien** (écarts des maquettes et trous de la spécification,
tranchés par la charte) :
- **Les filtres de Floues prennent la forme commune des filtres d'état** (C-4.8 :
  pastilles de 32 px, « Toutes » allumée par défaut, allumage vert doux bordé),
  pas le segmenté de la maquette `floues.html` : une seule forme sur toutes les
  pages. Mesuré par l'essai : la ligne ne déborde pas à 1280 et 1440, en français
  et en anglais ; c'est le message qui cède (C-2.4) ;
- au survol, la bande prend **la forme du bouton ordinaire** (C-4.4) : fond
  `--surface`, bord intérieur 1 px `--contour`, texte `--texte` ; la maquette dit
  1,5 px, la charte dit 1 (C-4.4). Sa graisse ne change pas (pas de saut du texte) ;
- ⇄, ↺ et « ? » sont des **icônes SVG** de 16 px au trait 1,75 (C-1.4, C-5.1),
  jamais des caractères ; le « ? » est un dessin propre, jamais l'icône `aide`
  cerclée (le bleu et le cercle restent à l'Aide, C-3.10) ;
- « ↺ Revenir à la proposition » tient à partir d'environ 192 px de bande
  (mesuré : 159 px de texte en 14 / 600) ; au-dessous, la bande dit « ↺ » suivi du
  mot de la proposition (« ↺ À écarter »), le libellé entier en infobulle et dans
  le nom lu (C-9.9) ;
- **écart à É10 relevé, à confirmer par l'utilisateur** : É10 réserve
  « Revenir » au départ d'une vue (« ← Revenir à *la page* ») et l'interdit pour
  remettre un réglage ; « Revenir à la proposition » (réponse 20, lecture du
  coordinateur) et « Revenir au réglage conseillé » (`proposition.md` § 8, déjà
  dans le code) le font. D'ici sa réponse, ces deux libellés de D112 s'appliquent,
  et ce sont les deux seuls ; si l'utilisateur veut tenir É10 : « ↺ Rendre à la
  proposition » et « Remettre le réglage conseillé » ;
- l'icône « avant » n'existe pas : « Écartée avant » prend ✕ (l'application, au
  sens large) et le mot « avant » dit l'origine ; à 120 px, la bande perd son
  icône pour garder son mot (maquette `1_badges_*`) ;
- à la Sélection, l'utilisateur n'a dit oui qu'à la question 4 (« pas de punaise,
  tout y est de vous ») : les règles de la Sélection, des Doublons, de Comparer et
  de Mis de côté s'écriront à leur sous-lot (tableau ci-dessous) ;
- C-10.3 : les filtres de Floues se recouvrent (« ? » et « Par vous » sont des
  vues, pas des parts) ; seuls « seront écartées » et « gardées » de la barre du
  bas s'additionnent au total.

**Pages qui gardent leur bande d'avant É13 jusqu'à leur sous-lot** (D112, points
6 et 7) : Doublons (rafales, scènes, copies, Écartées), « Comparer en grand », la
Sélection et « Décider une par une », les vues « Mis de côté ». Le composant de
bande est commun, mais leur rendu reste **identique** à celui d'avant É13 (C-9.2
d'avant, rappelée sous la règle), vérifié par `essai_charte.mjs` et
`essai_cadre.mjs`. Prévu, non figé :

| Page | Ce qui viendra |
|---|---|
| Doublons, Comparer | bordure jusqu'à « Accepter », plein ensuite ; l'icône revient devant le numéro (« ✓ 2 · À garder », change É9) ; « ? » quand l'IA préfère une autre photo ; case de rafale de 128 px au moins |
| Sélection | pas de punaise (★ et ★★ disent déjà « vous ») ; clic = « Dans l'album » ↔ « À décider » ; ambre plein #f5d27a / #6e5410 |
| Mis de côté | la raison prend l'icône d'origine (« ✕ Floue », « punaise Écartée par vous ») |
| Petits dossiers, Tri, Nommage | même grammaire sur les pastilles de dossier, sans clic (plus tard) |

Depuis, Doublons, « Comparer en grand », la Sélection, « Décider une par une » et
les vues « Mis de côté » sont tranchés par É14 (plus bas) : plus aucune page ne garde
la bande d'avant É13.

**Ce qu'É13 change ailleurs** : `docs/ux/GLOSSAIRE.md` (« par vous »,
« proposé », « Écartée avant », « à vérifier », « Retirer mon choix ») ; hors
charte, avec le code : `docs/SPEC_APP.md` § 6.3 et `docs/ux/INVENTAIRE_FONCTIONS.md`
§ 9 (chaque fonction de Floues garde une place : `proposition.md` § 8) ; la liste
des raccourcis et l'Aide de Floues (G ou S, X, Suppr) ; les traductions (« Kept by
you »). Essais à adapter **sans assouplir ce qui reste vrai** : `charte.test.ts`
(aucune bande au fond `--accent` ; aucun `font-weight: 700`), `essai_charte.mjs`
(bandes jamais coupées à 120, 160 et 240 px, libellé long et court ; au repos,
aucune bande au bord `--contour`), `essai_cadre.mjs` (Floues passée au cadre :
ligne de l'étape, ↶ au même x, gestes de la bande), `essai_vrac.mjs` et
`essai_application.mjs` (Floues) ; `outils/contrastes.py` (les paires de C-3.11,
dans les deux thèmes) ; toutes les captures de Floues à refaire.

État du code (30.10) : É13 appliquée (étape 2b des retours du 29.10, 63a028a).

## Évolution É14 acceptée par l'utilisateur (30.10.2026, D112 points 2, 3, 4, 6 et 10 : Doublons et Sélection)

Réponses de l'utilisateur du 29.10 (mot pour mot dans `retours-29-10/reponses.md`,
hors dépôt) : « 2 oui, 3 oui, 4 oui (Écarter partout), 5 oui » pour Doublons, la
partie 14 de la page des retours pour la Sélection, et « 22 oui » (les badges sur
les photos : Doublons, « Comparer en grand », la Sélection sans punaise, « Mis de
côté »). Spécification, dans cet ordre : D112 et ses précisions du 30.10 ; la page
`page/retours.html` § 2 et § 14 ; `general/proposition.md` (retours 3 à 6) et ses
revues ; `reponses/proposition.md` § A (tableau « Où, page par page ») ; É13, dont
la grammaire de la bande vaut ici sans changement (C-9.2, C-9.9, C-9.10).
Maquettes : `page/captures/` (`doublons_apres_*`, `4_doublons_ecartees_*`,
`4_doublons_valider_copies_*`, `5_selection_liste_*`), `general/maquettes/` et
`reponses/maquettes/` (`badges.html`, `1_badges_*`, `3_doublons_*`, `3_selection_*`).
É14 change C-3.3, C-4.2, C-4.8, C-4.12, C-9.2 et C-9.3 (figées), C-7 et C-8
(provisoires), et remplace en partie É4, É7 et É9 ; les règles plus bas sont récrites
en conséquence (marquées « É14 »).

> **Un geste, un verbe : Écarter. Un état : Écartée. Un lieu : « Mis de côté ».**
> **Le bouton dit quoi faire ; la ligne grise d'à côté dit ce qu'il fera.**

| É14 | Règles | Évolution |
|---|---|---|
| a. « Accepter → » | C-4.2, C-7.1 ter, C-7.3 bis, C-10.8 (nouvelle) ; remplace la forme d'É9 | Le bouton d'un groupe dit seulement « **Accepter →** », de **largeur fixe** (la même sur tous les groupes, sur la page et dans Comparer). Juste à sa gauche, en gris (`--texte-2`, 14 px, 400) : « garde la 2 · écarte 1 », « garde 3 photos · écarte 9 », aux Copies « garde 1 exemplaire · écarte 1 », sans aucune « n'en garde aucune · écarte les 4 ». La phrase entière (« Accepter : garder la 2, écarter 1 autre, puis groupe suivant ») est dans l'infobulle et le nom lu. Plus de vignette ni de nom de fichier dans le bouton. Plein sur le groupe en cours, contour sur les autres, le même libellé |
| b. Le mois suivant | C-7.1 quater, C-7.3 bis | Sur le dernier groupe d'une journée, d'un mois ou d'un dossier, « Accepter → » accepte puis **ouvre la section suivante qui reste à accepter** (question 2) : son premier groupe vient sous les têtes collées, comme après tout « Accepter ». La ligne grise le dit d'avance : « garde la 2 · écarte 1 · puis septembre 2026 ». Même chose dans Comparer |
| c. Plus de menus de portée | C-4.6, C-4.12, C-7.3 bis | « Toutes les copies ▾ », « ✦ Toutes les rafales ▾ », « Cette journée ▾ » et « Grouper et classer » replié disparaissent. En clair, en contour : « Accepter les 7 groupes » et « ✦ Choisir avec l'IA dans ce mois · environ 0,03 CHF » (tête de la table, à gauche, après le compte) ; « Accepter les 3 propositions », « Garder tous les exemplaires » (barre d'outils, Copies) ; « ✦ Choisir avec l'IA dans 8 rafales · environ 0,03 CHF » (barre d'outils, Rafales). « Grouper » et « Classer » : deux segmentés visibles dans la liste de gauche, chaque mot au-dessus du sien |
| d. La fenêtre qui chiffre | C-4.2 | Toute acceptation de plusieurs groupes (un mois, un onglet) ouvre d'abord une petite fenêtre : « Accepter les 7 groupes ? 12 photos seront écartées, dont 4 dans des groupes où vous n'avez rien choisi. » · « Ne rien faire » · plein « Accepter les 7 groupes ». Rien ne s'écarte avant |
| e. « toutes · aucune » | C-7.1 quater, C-7.3 bis | « Tout garder », « Tout écarter » et « Autres choix ▾ » quittent la ligne sous les photos (question 3). Il reste la case « Garder plusieurs photos » ; cochée, elle montre à sa droite « choisir : toutes · aucune » (aux Copies « tous · aucun »), deux liens (C-4.5). **Ctrl+A** fait « toutes » dans le groupe en cours (et coche la case), sauf dans un champ de texte. Dans un groupe pas encore accepté, « toutes », « aucune » et Ctrl+A fixent **tout le groupe** « par vous » (punaise, plein), même les photos dont la proposition avait déjà ce sort (D112, précision du 2026-10-31) |
| f. « Écartées » | C-8.4 bis, C-10.9 (nouvelle), glossaire | L'onglet « Mis de côté » devient « **Écartées** » (« 5 photos » dessous), séparé des trois autres par un filet (question 4). « Écarter » est **le seul verbe** partout : Doublons, Floues, Tri, Lieux et sorties, visionneuse, Aide (« Mettre de côté » devient « Écarter », « Suppr met de côté » devient « Suppr écarte »). « Mis de côté » ne nomme plus que le dossier de la sortie, et sa phrase « Rien n'est supprimé : ce que vous écartez va dans « Mis de côté » » |
| g. Copies restantes | C-3.3, C-8.5, C-8.11 (nouvelle) | Seulement s'il reste des **copies exactes** pas acceptées (question 5) : la ligne 1 de la barre du bas le dit en brun, avec l'icône `alerte` (« 3 copies exactes pas encore acceptées : le tri les rangerait deux fois. ») ; la case de Doublons dans la frise passe en **brun doux** dès que l'étape est validée ; « Valider et continuer » ouvre une fenêtre à **trois choix**. Les rafales et les scènes jamais : garder toutes les photos d'une rafale est un choix normal |
| h. Badges à Doublons et dans Comparer | C-9.2, C-9.12 (nouvelle), C-7.5 | La bande d'É13 : **bordure jusqu'à « Accepter »** (✓ ✕ l'application, ✦ l'IA, « ? » quand l'IA préfère une autre photo), **plein ensuite** (l'icône garde l'origine) ; un choix fait à la main avant « Accepter » est « par vous » (punaise, plein). L'icône revient **devant** le numéro : « ✓ 2 · À garder » (change É9). Dans Comparer, la même bande sous chaque photo, les choix dessous |
| i. Badges à la Sélection | C-3.12 (nouvelle), C-9.13 (nouvelle) | **Pas de punaise** : tout y est de vous, ★ et ★★ en tiennent lieu (question 22). « À décider » (rien, sans bord), « ★ Dans l'album » (ambre plein), « ★★ Grande » (ambre fort), « Pas pour l'album » (gris plein, sans icône). Clic sur la bande : « Dans l'album » ↔ « À décider » |
| j. Badges de « Mis de côté » et d'« Écartées » | C-9.14 (nouvelle) | Tout y est décidé (plein) ; la raison prend l'icône de son origine : « ✕ Floue », « ✦ Floue », « ✕ Doublon », « ✕ Copie exacte », « punaise Écartée par vous », « ✕ Écartée avant ». Dans l'onglet « Écartées », un clic sur la bande garde la photo « par vous » (« Remise » disparaît) |
| k. Délavé, jamais d'opacité | C-9.3 | Une photo écartée (décidée) à Doublons et une photo « Pas pour l'album » à la Sélection sont un peu délavées, comme à Floues (C-9.3) : l'opacité de 0,4 de ces deux pages disparaît |
| l. Liste des dossiers sur deux lignes | C-7.7 (nouvelle) | À la Sélection : le nom en gras, puis la période sur une deuxième ligne, le nombre de photos à droite ; l'événement du calendrier devient une petite icône après la période (maquette `5_selection_liste_*`). Lieux et sorties et Petits dossiers la prendront à leur sous-lot, avec leur menu « … » |
| m. Deux petits défauts | C-8.3, C-8.3 bis | L'infobulle et `aria-valuetext` du curseur de taille disent la taille **vraiment affichée** (au palier de Doublons, les trois quarts du réglage). À la Sélection, chaque décision laisse son message dans la ligne de l'étape (« **Dans l'album.** ↶ ou Ctrl+Z pour l'annuler ») |

**Précisions du gardien** (écarts des maquettes et trous de la spécification,
tranchés par la charte) :
- **un seul plein** (C-4.1) : la maquette `3_doublons_*` montre « Accepter → » et
  « Valider et continuer » pleins ensemble ; « Valider et continuer » ne devient plein
  qu'une fois l'étape finie ; dans les deux fenêtres (d et g), le plein est la
  dernière commande, à droite ;
- **le libellé ne change pas** (C-10.2, C-10.5) : « Accepter → » garde sa flèche et sa
  largeur sur le dernier groupe d'une section comme sur le dernier de l'onglet ; c'est
  la ligne grise qui dit où il mène (« · puis septembre 2026 ») ; sans suite à
  accepter, elle ne dit rien de plus. Le groupe en contour garde aussi la flèche
  (la maquette `doublons_apres_*` l'enlève) : le même geste, le même mot ;
- largeur fixe d'« Accepter → » : celle du libellé le plus long des langues de
  l'interface, plus la marge du plein (repère : 117 px en français, maquette
  `doublons_apres_*`) ; la ligne grise cède, sur deux lignes au plus (l'en-tête garde
  ses 56 / 52 / 48 px), jamais coupée (C-10.4) ; avant elle, « Comparer en grand »
  prend son icône (É7) ;
- **la ligne grise compte avant le geste** et parle de la photo par sa place
  (« la 2 ») : jamais un nom de fichier ni un dossier ; aux Copies, la bande de
  l'exemplaire « À garder » dit lequel (É4). L'écart d'É9 sur les noms de fichier et
  de dossier dans le plein tombe avec lui ;
- `Grouper` et `Classer` sont des **segmentés** (C-4.9 : 32 px, case allumée en vert
  doux bordé), pas des pastilles de filtre ni des listes déroulantes : la maquette
  `doublons_apres_*` donne à « Afficher » la même forme, la charte la garde en
  pastilles (C-4.8, « Tous » allumé). Ils tiennent dans la largeur de la liste
  (248 / 232), en français et en anglais ; sinon la liste s'élargit, jamais un
  libellé coupé. Au palier, ils restent dans le même panneau, devenu le menu de la
  tête de la table (C-7.6 lot 4) ;
- au palier, la tête de la table passe sur **deux lignes** (titre et compte, puis les
  deux boutons de la section) : pas de menu « Accepter… ▾ » (proposé par
  `general/proposition.md`, écarté par la réponse « plus de menus ») ;
- **Valider et les groupes non acceptés** : à Doublons, « Valider et continuer »
  n'écarte rien d'un groupe non accepté (inchangé : toutes ses photos sont gardées) ;
  leurs bandes restent donc en bordure après « Valider » (elles disent vrai : rien
  n'est fait). La phrase prévue par C-8.5 bis pour Doublons (« Valider suivra les 19
  propositions ») **n'est pas reprise** : elle changerait ce que fait « Valider »,
  ce que l'utilisateur n'a pas demandé ; la ligne 1 garde « 12 groupes pas encore
  acceptés : toutes leurs photos sont gardées. » ;
- la fenêtre des copies (g) : titre « 3 copies exactes ne sont pas encore
  acceptées », une phrase (« Ce sont des copies d'une photo déjà gardée. Sans les
  accepter, le tri les rangerait une seconde fois. Rien n'est supprimé : elles
  iraient dans « Mis de côté ». »), puis « Continuer sans elles » · « Les voir
  d'abord » · plein « Accepter les 3 copies et continuer ». Échap = « Les voir
  d'abord » (on reste, l'onglet Copies s'ouvre) ;
- la frise en brun doux : fond `--afaire-doux`, bord intérieur 1,5 px `--afaire`
  (comme le vert doux bordé d'une étape faite) ; jamais la couleur seule : l'infobulle
  et le nom lu de la case disent « 5. Doublons : validée, 3 copies exactes à
  accepter », et « Étape n sur 13 ▾ » porte un point brun de 8 px devant son nom ;
- **Dans Comparer**, la bande (28 px, la même que sur la page, cliquable de même)
  est juste sous la photo ; les choix restent dessous comme commandes (C-4.9) : à
  Doublons ils disent le verbe, « Garder » / « Écarter », la bande disant l'état ;
  à la Sélection, ses quatre choix, inchangés. Les vignettes de la bande de gauche
  (É6) prennent le plein ou la bordure et l'icône d'origine, le numéro après
  l'icône, le mot dans l'infobulle. Les 28 px de la bande comptent dans la hauteur
  de la légende (C-7.5 : côte à côte jamais sous 220 px de haut) ;
- sur la salle sombre de Comparer (C-3.9), les bandes gardent les valeurs de leur
  thème ; `contrastes.py` mesure leur texte sur le fond réel de la légende ;
- « Pas pour l'album » n'a **pas d'icône** (✕ dirait « l'application », C-5.3 É13) ;
  son mot court est « Hors album » (C-9.9). Les pleins « Dans l'album » (#f5d27a) et
  « Pas pour l'album » (#d6d5cd) ont la même clarté en clair (1,01:1) : la teinte, ★
  et le mot les distinguent, jamais la clarté seule ;
- à la Sélection, la bande n'a ni « ↺ Revenir à la proposition » ni « ? » : il n'y a
  pas de proposition (« ✦ Pour l'album » en bordure viendra plus tard, avec une aide
  de l'IA) ;
- l'écart à É10 relevé par É13 (« Revenir à la proposition ») vaut aussi à Doublons
  et dans Comparer : même réponse attendue de l'utilisateur ;
- dans la liste à deux lignes (C-7.7), le nom est en **600**, pas en 700 (C-2.3 : 700
  pour les titres) ; le menu « … » de la maquette `5_selection_liste_*` n'est **pas**
  repris à la Sélection (il vient avec Lieux et sorties, hors de ce sous-lot) ;
- Sélection : au repos, l'infobulle de la bande dit l'état (« Dans l'album, choisie
  par vous ») ; « par vous » n'est jamais écrit dans la bande (pas de punaise).

**Ce qu'É14 change ailleurs** : `docs/ux/GLOSSAIRE.md` (« Écartées », « écarter »,
« Mis de côté », « Accepter → », « toutes · aucune », « Hors album », raisons de « Mis
de côté ») ; hors charte, avec le code : `docs/ux/INVENTAIRE_FONCTIONS.md` § 10
(Doublons : « Tout garder », « Tout écarter », menus de portée, onglet « Écartées »,
fenêtres) et § 16 (Sélection : liste, bande, message), `docs/SPEC_APP.md` (Doublons,
Sélection) ; la liste des raccourcis (Ctrl+A à Doublons) et l'Aide de Doublons, de la
Sélection, du Tri, de Lieux et sorties et de la visionneuse (le verbe « Écarter ») ;
les traductions (clés retirées : « Tout garder », « Tout écarter », « Autres choix »,
« Tout remettre », « Remise », « Mettre de côté »…). Essais à adapter **sans
assouplir ce qui reste vrai** : `essai_cadre.mjs` (« Accepter → » de même largeur sur
tous les groupes et dans Comparer, texte jamais rogné ; dernier groupe d'un mois puis
A : le mois suivant ouvert, son premier groupe sous les têtes collées ; fenêtre du
mois : rien d'écarté avant « Accepter les N groupes », Échap ne fait rien ; case puis
« toutes », « aucune », Ctrl+A ; plus aucun menu de portée ni « Autres choix » ;
copies restantes : ligne brune, case brune de la frise, fenêtre à trois choix, rien
pour une rafale restante ; bandes de Doublons, de Comparer, de la Sélection et
d'« Écartées » : clic, second clic, garde de 0,5 s, double-clic, Ctrl+Z ; message
après « Dans l'album » ; infobulle du curseur au palier de Doublons ; liste de la
Sélection sur deux lignes à 1280 et 1024), `essai_charte.mjs` (bandes jamais coupées
à 120, 160 et 240 px avec le numéro, en français et en anglais ; au repos, aucune
bande au bord `--contour` ; plus aucune bande d'avant É13), `essai_vrac.mjs` et
`essai_application.mjs` (Doublons et Sélection), `charte.test.ts` (aucune opacité sur
une photo écartée), `outils/contrastes.py` (paires de C-3.12, dans les deux thèmes) ;
toutes les captures de Doublons, de Comparer et de la Sélection à refaire.

**Hors É14** (sous-lots suivants de D112) : le bandeau des copies restantes au Tri
(C-8.9 réservé), la liste et la fenêtre des lieux du Tri ; Lieux et sorties et Petits
dossiers (liste à deux lignes, menu « … », « Chronologie ») ; le Nommage ; les badges
sur les dossiers.

État du code (30.10) : É14 à appliquer (étape 2d des retours du 29.10).

## Évolution É15 acceptée par l'utilisateur (2026-10-31, D112 point 9 : Tri automatique et « Vos lieux »)

Réponses de l'utilisateur du 29.10 (mot pour mot dans `retours-29-10/reponses.md`,
hors dépôt) : « 13 ok avec ton avis » (l'icône et le nombre : « 38 photos »),
« 14 oui » (le bouton remplace les miniatures toujours visibles), « 15 oui » (deux
onglets, « Remis à plus tard · Le remontrer », corriger un nom renomme les dossiers
concernés). Spécification : `page/retours.html` § 8 et § 9, `lot_b/proposition.md`
§ 1 et § 2, `lot_c/proposition.md` ; maquettes `lot_b/maquettes/lieux.html`,
`tri.html`, `lot_c/maquettes/tri_liste.html`. Ce que l'étape 2d a déjà fait (barre
du bas brune et fenêtre à trois choix de Doublons, case brune de la frise : C-8.11)
n'est pas refait. É15 ajoute C-4.13, C-8.9 et C-10.10 (réservées), étend C-6.6 et
change le Choix de l'utilisateur du 27.10 « Miniatures au Tri ».

> **Une ligne se reconnaît d'un coup d'œil ; ce qui l'explique vient à la demande.**

| É15 | Règles | Évolution |
|---|---|---|
| a. Le bandeau des copies | C-8.9 (nouvelle), C-3.3 | Au Tri, les copies exactes restées à Doublons quittent la liste « À faire » (elles s'y lisaient comme une tâche du tri) pour un **bandeau brun doux** au-dessus des deux colonnes, sur une ligne quand il tient : l'icône `alerte`, « **Il reste 255 copies exactes à accepter à l'étape Doublons.** Sans cela, le tri les rangerait une seconde fois. » (une fois rangé : « Le tri les a rangées une seconde fois : écartez-les, puis rangez à nouveau. »), puis « Aller à Doublons › » et « Les écarter ici », **tous deux en contour** (le plein reste la tâche de la page, C-4.1). Il disparaît quand il ne reste rien |
| b. Le bouton « 38 photos » | C-4.13, C-5.2, C-6.6 | Au bout droit de chaque ligne de dossier, à la même place : « [photo] 38 photos [chevron] », bouton tonal (fond `--neutre-doux`, sans bord, 14 px / 500, 32 px, 136 px au moins) ; ouvert, vert doux, chevron vers le haut, `aria-expanded`. Nom lu : « Voir les 38 photos de « Sortie du sam. 12 juillet » ». Le compte quitte la ligne des détails. **Le dépliant**, sous la ligne, sur la table : une rangée de 8 vignettes au plus (autant qu'il en tient, 3 au moins), réparties sur la période, à la taille du curseur (×0,45 : 72 px par défaut) ; dessous « 8 photos sur 38, réparties de 10 h à 18 h · Voir les 38 en grand », et une fois rangé « Dossier « … » ». Pour un voyage, un bloc par lieu visité (« Vieille ville · 3 juil. → 4 juil. · 48 », deux photos : la première et la dernière). Une vignette ou « Voir les 38 en grand » ouvre la visionneuse, sans rangement. Une ligne dépliée à la fois ; rien n'est retenu ni écarté. Remplace les miniatures toujours visibles (choix du 27.10), les pastilles des lieux visités et « Voir les lieux » |
| c. L'icône calendrier | C-4.13 (nouvelle), C-5.2 (exception) | Après le titre, une icône `calendrier` de 16 px en `--texte-2` (cible de 24 px), suivie du nombre d'événements s'il y en a plusieurs ; seulement si un événement tombe pendant le dossier. **Sa bulle** : au survol après 300 ms, au focus du clavier ; un clic ou Entrée l'épinglent (« Échap ou un clic ailleurs pour fermer ») ; Échap ou un clic ailleurs la ferment. 340 px, en surface, rayon 10, la seule ombre de la page, fixe dans la fenêtre (la colonne qui défile ne la coupe pas) : « Votre calendrier pendant ce voyage », 3 événements au plus puis « et 2 autres », celui de la plupart des photos d'abord avec la coche. Remplace la phrase verte « Votre calendrier : … » (un écart à C-3.2) |
| d. Une seule phrase | C-10.10 (nouvelle) | En tête de la liste, après le titre : « (i) Les noms des dossiers se choisissent plus tard, à l'étape Nommage. » (14 px, `--texte-2`, sur la ligne du titre quand elle tient, sinon dessous, entière). La phrase sur OpenStreetMap et « Pour couper un dossier… » quittent la page pour l'Aide de l'étape (OpenStreetMap reste aussi sur la barre de progression des noms et au pied de « Vos lieux ») |
| e. La fenêtre « Vos lieux » | C-6.6 (étendue), C-4.7, C-10.7 | Titre « Vos lieux ». **Deux onglets** soulignés, le compte dessous, sans parenthèses : « À nommer · 3 lieux » (« tout est nommé ») et « Nommés · 2 lieux » ; à droite, sur « À nommer », « Remis à plus tard : 1 lieu · Le remontrer ». **Une carte par lieu** (C-6.6 : un lieu se présente en carte, comme un dossier) : fond `--surface`, filet `--filet-fort`, rayon 16, 12 px entre deux, sur la table ; 3 vignettes de 72 px (une par jour) ; l'adresse en 16 px / 600, « Notre maison » en pastille vert doux pour la maison ; « 39 photos sur 8 jours · Voir les 39 photos » ; « Nom » écrit devant le champ (« Par exemple : Chez Mamie », C-10.7), « Enregistrer » en contour avec la coche, sa raison écrite quand il est désactivé (« attend un nom », « nom inchangé », C-4.7). Sur « À nommer » : « C'est notre maison » (sans domicile) et « Plus tard », sans bord, sur la ligne du titre. Sur « Nommés » : le nom dans le champ ; changé, la carte prend le filet vert, « Annuler » (lien) remet le nom et une ligne dit l'effet : « **4 dossiers de ce projet prendront ce nom.** Ceux que vous avez renommés gardent le leur. ». Pied : « L'adresse vient d'OpenStreetMap : seule la position est envoyée. » et « Retirer un lieu, changer son rayon : Configuration › ». **La fenêtre ne se ferme plus seule** ; au Tri, la ligne « Vos lieux » reste quand tout est nommé (« Vos lieux : 5 lieux nommés · Les voir… ») et « Changer » de la maison ouvre « Nommés ». Mots : « lieu » (jamais « endroit »), « Plus tard » (jamais « Pas maintenant ») |

**Ce qu'É15 change ailleurs** : `essai_vrac.mjs` (bandeau, « Aller à Doublons », « Les
écarter ici » ; une seule phrase ; bouton des photos, visionneuse, une ligne dépliée ;
icône calendrier au survol, au clic, au clavier ; « Vos lieux » : onglets, carte,
correction d'un nom écrite dans la configuration et le plan, Ctrl+Z), `essai_cadre.mjs`
(dépliant d'une rangée, dans la ligne, bouton au même bord, aux 4 tailles),
`essai_charte.mjs` (page du tri dépliant ouvert) ; captures du Tri et de « Vos lieux »
à refaire. La finition d'É14 du 31.10 (« toutes », « aucune » et Ctrl+A fixent tout le
groupe « par vous ») est écrite dans É14 e et C-9.12.

État du code (31.10) : É15 appliquée (étape 3 des retours du 29.10), pas encore commitée.

## Corrections à intégrer avant d'appliquer (contrôleurs du 27.10)

- Le vert porte trop de sens : « ici, choisi, allumé » passe en encre
  neutre ; le ✓ ne veut dire que « gardé / fait ».
- Filtres « Afficher » : une seule forme sur toutes les pages, et « Tous »
  allumé par défaut (rien d'allumé ne doit vouloir dire « tout »).
- Compteurs qui s'additionnent, un état un mot (« à accepter » partout, pas
  « à relire »).
- Le cadre jaune et noir n'apparaît qu'au clavier (`:focus-visible`).
- Dans Comparer côte à côte, « À garder » et « À écarter » ne doivent pas
  se ressembler (C-9.2 appliquée aussi aux segments).
- Au Tri, aucun bouton collé ne cache un réglage.

---

## C-1 Police

| N° | Règle | Test |
|---|---|---|
| C-1.1 | Une seule police : **Inter 4** variable, embarquée (`app/src/ui/police/inter.woff2`, 65 Ko), aucun chargement en ligne | une seule `@font-face` ; aucune URL de police dans le build |
| C-1.2 | `cv05` et `cv08` activées partout ; zéro ouvert | `font-feature-settings` sur `body` ; aucun « Ø » |
| C-1.3 | `tabular-nums` sur le nombre seul, ou une pastille courte (prix, compteur) ; jamais sur une phrase | aucun `.num` sur un élément de plus de 20 signes contenant un trait d'union |
| C-1.4 | ✕ ✦ ▣ ◀ ≤ ≥ sont des **icônes SVG**, jamais des caractères ; de même ⇄ ↺, la punaise et le « ? » de la bande d'état (É13) | recherche de ces caractères dans les textes de `app/src` : 0 |
| C-1.5 | Milliers séparés par U+202F | `Intl.NumberFormat('fr-CH')` |

## C-2 Tailles et graisses

| N° | Règle | Test |
|---|---|---|
| C-2.1 | Quatre tailles : **14 / 16 / 20 / 24 px** (interlignes 20 / 24 / 28 / 32). Le titre d'étape fait 24 px **aux deux tailles d'écran**. L'accueil seul a 40 px | aucune `font-size` hors jetons |
| C-2.2 | **Rien sous 14 px** ; texte courant à 16 px ; boutons à 14 px, sauf « Revenir » et « Valider et continuer » à 16 px (É11) | minimum mesuré ≥ 14 sur toutes les pages |
| C-2.3 | Graisses 400 / 500 / 600 / 700 : 500 pour un bouton ordinaire et la barre du bas, 600 pour le plein dans la page, 700 pour les titres seulement, **jamais sur un bouton** (É11) ; aucune capitale de style | aucun `font-weight: 700` sur un `button` dans les CSS |
| C-2.4 | Titre d'étape au même pixel sur les 13 étapes, dans la ligne de l'étape (É12) : à x 24, au même y à l'arrivée sous la barre du projet, puis collé en haut après défilement ; il ne cède jamais sa place (c'est le message qui cède) | mesure Playwright, à l'arrivée et après défilement |

## C-3 Couleurs : un neutre et cinq sens

| N° | Règle | Test |
|---|---|---|
| C-3.1 | Neutres clairs : fond #f6f5f2, surface #fff, **table #ebeae5**, mat #dddcd5, filets #dcdbd4 / #c4c2b9, contour #7e828a, texte #1c1d20 / #4b505a, **exemple #6b7079** (`--texte-exemple`, le texte d'exemple des champs seulement, C-10.7 ; É11) | jetons de `:root` seulement |
| C-3.2 | **Vert : agir, garder, fait.** Deux intensités : **plein** #0f766e = le bouton d'action, seulement ; **doux** #e1f0ec, texte #0b544e = un état (« À garder », filtre actif, segment allumé, point fait, journée ouverte). **Jamais sur un curseur** : `accent-color` est retiré des curseurs, gardé sur les cases à cocher (É11). Dans une bande d'état seulement, un **vert moyen** dit « gardée, décidé » (C-3.11, É13) : jamais sur un bouton, il reste à 3,96:1 (clair) et 2,98:1 (sombre) du plein | un seul élément au fond `--accent` visible par écran |
| C-3.3 | **Brun** #8f4508 sur #fcefe2 = reste à faire (« à accepter », « à vérifier », « Aperçu ») ; **dans la frise**, la case d'une étape validée avec un reste qui compte (aujourd'hui : des copies exactes pas acceptées à Doublons) est en **brun doux bordé** (`--afaire-doux`, bord intérieur 1,5 px `--afaire`), son reste dans l'infobulle et le nom lu (É14) | case de Doublons brune avec des copies restantes, verte sinon |
| C-3.4 | **Rouge** #b42318 = une perte possible, seulement | absent des pages où rien ne se perd |
| C-3.5 | **Ambre** #f2b01e = ★ dans l'album, seulement. **Aucune ★ ailleurs** (Doublons : « ✦ Conseillée par l'IA ») | aucune ★ hors Sélection, Album et leurs filtres |
| C-3.6 | **L'IA n'a pas de couleur** | aucun jeton `--ia`, aucun violet |
| C-3.7 | Texte ≥ 4,5:1, bord de commande ≥ 3:1, dans les deux thèmes, sur la surface et sur la table | `outils/contrastes.py` : tout « ok » |
| C-3.8 | Thème sombre = mêmes rôles, autres valeurs (fond #121315, surface #1b1d20, table #0e0f11, vert #4fc1b2 / doux #173a36 et #a7e3da, exemple #8b9099, la valeur de `--contour`). Il suit le système ; « Menu › Thème » le force | `prefers-color-scheme` et `data-theme` |
| C-3.9 | « Comparer en grand » : salle sombre neutre dans les deux thèmes (ardoise #2a2c30 en clair, #121316 en sombre) | — |
| C-3.10 | **Bleu doux = le bouton Aide, seulement** (É11) : fond #dbe6f9, texte et icône #1f4e96 (6,45:1), bord 1 px #5b85c9 (3,72:1) ; en sombre #1f3050, #b7d0f5 (8,36:1), #6f97d6 (5,69:1) ; jetons `--aide-doux`, `--aide-texte`, `--aide-bord`. Jamais en aplat foncé, jamais sur un lien ni sur ✦ (C-3.6), **aucun clignotement**. États : normal ; « à lire » = la pastille brune s'ajoute (C-3.3) jusqu'à la première ouverture de l'Aide de l'étape ; ouverte = filet intérieur de 2 px `--aide-texte`. Le même sur les deux boutons Aide (cadre commun et pages pas encore passées) ; il reste plus calme que le plein vert | un seul élément au fond `--aide-doux` par écran ; `contrastes.py` : les trois paires, dans les deux thèmes |
| C-3.11 | **Bande d'état : plein franc, bordure pâle** (É13 ; maquette `badges.html`, valeurs `ux-visuel`). **Décidé** (graisse 600) : gardée = fond #bfe3d9, texte #0b544e (6,36:1) ; en sombre #24685f, texte #e6faf6 (6,01:1) · écartée = fond #d6d5cd, texte #1c1d20 (11,44:1) ; en sombre #4a4f57, texte #ecebe7 (6,91:1). **Proposé** (graisse 500, fond `--surface`, bord intérieur 1 px) : garder = bord #8cc7bb, texte #0b544e (8,78:1) ; en sombre bord #3a8a7f, texte #a7e3da (11,78:1) · écarter = bord #c4c2b9 (`--filet-fort`), texte `--texte-2` (8,09:1) ; en sombre bord #555a63, texte `--texte-2` (8,2:1) · **à vérifier** = bord #d9a274, « ? » et texte #8f4508 (6,95:1) ; en sombre bord #8a5e38, texte #f0b27a (9,13:1). Le bord d'une proposition est décoratif (le mot porte le sens) : il n'a pas à tenir 3:1 (exception à C-3.7, qui vaut pour le bord d'une commande). Les deux pleins ont presque la même clarté en clair (1,07:1) : jamais la couleur seule, toujours le mot et l'icône. Jetons de `:root` par `light-dark()`, un par rôle | `contrastes.py` : chaque texte de bande ≥ 4,5:1 sur son fond, dans les deux thèmes ; aucune bande au fond `--accent` ni `--accent-doux` sur une page passée à É13 |
| C-3.12 | **Bande de la Sélection : l'ambre** (É14 ; maquette `badges.html`, revue de l'avocat). Tout y est de vous : plein ou rien, jamais de bordure. **À décider** = fond `--surface`, texte `--texte-2`, graisse 500, sans bord ni icône. **Dans l'album** = fond #f5d27a, texte #5c3d00 (6,78:1), ★ ; en sombre #6e5410, texte #fff1c7 (6,35:1). **Grande** = fond `--etoile` #f2b01e, texte #1c1d20 (8,83:1), ★★, dans les deux thèmes. **Pas pour l'album** = le plein gris de C-3.11 (« écartée »), sans icône. Graisse 600 sur les trois pleins. En clair, « Dans l'album » et « Pas pour l'album » ont la même clarté (1,01:1) : la teinte, ★ et le mot les distinguent. Jetons de `:root` par `light-dark()` | `contrastes.py` : chaque texte ≥ 4,5:1 sur son fond, dans les deux thèmes |

## C-4 Commandes

| N° | Règle | Test |
|---|---|---|
| C-4.1 | **Un seul bouton plein par écran : la prochaine action utile.** « Valider et continuer » ne devient plein qu'une fois l'étape finie | 1 plein visible (contrôle automatique) |
| C-4.2 (récrite par É14) | Un bouton qui écarte **dit quoi faire, et ce qu'il fera se lit juste à côté** : le plein d'un groupe dit « Accepter → », de largeur fixe ; à sa gauche, en gris (`--texte-2`, 14 px, 400), « garde la 2 · écarte 1 » (« garde 3 photos · écarte 9 », « garde 1 exemplaire · écarte 1 ») ; la phrase entière dans l'infobulle et le nom lu ; le même bouton et la même ligne sur la page et dans Comparer. Un bouton de portée nomme sa portée (« Accepter les 7 groupes »). Toute acceptation de plusieurs groupes passe d'abord par une fenêtre qui chiffre : « 12 photos seront écartées, dont 4 dans des groupes où vous n'avez rien choisi » | largeur d'« Accepter → » identique sur tous les groupes et dans Comparer ; aucune photo écartée avant le plein de la fenêtre |
| C-4.3 | Hauteurs (É11) : **32** (bouton ordinaire, plein dans la page, segmenté, pastille de filtre) · **36** (« Revenir », « Valider et continuer ») · 28 (frise, bouton IA d'une ligne d'information, pastille « En essai ») ; cible ≥ 24 partout | mesure des boîtes |
| C-4.4 | Contour : bord 1 px `--contour`, rayon 8 ; Menu sans bord ; Aide bordé de bleu (C-3.10) ; le plein, un aplat vert sans autre marque (É11) | — |
| C-4.5 | Lien : vert foncé souligné, sans marge intérieure, ≥ 24 px de haut | — |
| C-4.6 | Aide IA : bouton contour + ✦ + prix (« environ 0,03 CHF ») ; portée écrite. Si le prix dépend d'un réglage, il est **recalculé en direct sur le bouton** (choix de l'utilisateur, 28.10) ; « … » seulement quand le prix ne peut être estimé qu'au lancement, il est alors dans la fenêtre avant de lancer. Désactivée, l'aide dit ce qui lui manque à la place du prix (« sélectionnez 2 à 12 photos semblables », C-4.7) ; le prix revient dès qu'elle peut servir (29.10, D112) | toute commande qui dépense a ✦ et un prix (ou « … ») |
| C-4.7 | Désactivé : bord en pointillé, texte gris, et sa raison écrite à côté ou dans la barre du bas | — |
| C-4.8 | Filtres d'état = pastilles dans la barre d'outils après « Afficher : », une seule forme sur toutes les pages ; **« Tous » allumé par défaut**. Réglage d'une liste de gauche = segmenté nommé, le mot au-dessus (« Grouper », « Classer », É14 : jamais une liste déroulante). Onglets = soulignés, disent ce qui reste. Les trois ne se ressemblent pas. **À Floues (É13)**, les pastilles sont dans la ligne de l'étape, sans « Afficher : » visible (c'est le nom accessible du groupe) ; sous 1180 px de contenu, elles redescendent dans la barre d'outils, avec « Afficher : » | Floues à 1280 et 1440 : filtres dans la ligne de l'étape, rien ne déborde ; à 1024 : dans la barre d'outils |
| C-4.9 | Segmenté : la case allumée est l'état ; allumage doux et bordé (2 px), jamais plein | — |
| C-4.10 | Touches dans l'infobulle et l'Aide ; dans Comparer, rappel permanent « ↑ ↓ photo · ← → groupe », **à toutes les tailles** ; au large, le chemin le plus court en entier (« 1–N choisir · A accepter ») | `essai_charte.mjs` : rappel visible à 1440, 1280 et 1024 |
| C-4.11 | Revenir / Valider et continuer : 140 / 260 px au moins, même place partout | — |
| C-4.12 | **La vue choisie reste toujours écrite** (É12) : onglets et filtres d'état visibles dans la barre d'outils, hors de tout menu ; quand la barre d'outils est sortie de la vue et qu'ils ne tiennent pas dans la ligne de l'étape (Doublons, Sélection, Nommage), la vue en cours tient dans la ligne, juste après le titre, en petit menu écrit à son nom (« Rafales ▾ », « Toutes ▾ », « À nommer ▾ ») : 14 px, 500, sans bord comme Menu, les mêmes choix, mots et comptes que la barre d'outils (C-10.2). Il apparaît sans faire bouger le titre, le curseur, ↶ ↷, Aide ni Menu (le message lui cède la place). Il n'y a plus de menu de portée (É14 : « Toutes les copies ▾ », « ✦ Toutes les rafales ▾ », « Cette journée ▾ » et « Autres choix ▾ » deviennent des boutons en clair) ; ce petit menu est le seul menu de vue. À Floues, les filtres tiennent dans la ligne ; au palier, où ils redescendent dans la barre d'outils, la vue en cours prend ce petit menu (« Toutes ▾ », É13) | après défilement : le nom de la vue choisie écrit dans la ligne sur Doublons, Sélection et Nommage, et sur Floues à 1024 ; changer de vue par ce menu, au clavier compris |
| C-4.13 (É15) | **Bulle d'information** d'une icône (au Tri : l'icône calendrier d'une ligne) : s'ouvre au survol après 300 ms, au focus du clavier ; un clic ou Entrée l'épinglent ; Échap ou un clic ailleurs la ferment, le focus reste sur l'icône. En surface, rayon 10, la seule ombre de la page, 340 px au plus, fixe dans la fenêtre, jamais hors de l'écran. L'icône seule y est permise (exception à C-5.2) parce que son nom lu dit tout (« Votre calendrier : « Vacances à Annecy » ») | `essai_vrac.mjs` : survol, départ de la souris, clic épinglé, clic ailleurs, focus, Entrée, Échap ; la bulle tient dans la fenêtre |

## C-5 Icônes

| N° | Règle |
|---|---|
| C-5.1 | Un seul jeu SVG au trait (1,75, bouts arrondis), 16 px dans les boutons (É11 ; seule exception, la grande photo du curseur de taille, 22 px), 16 dans le texte et dans la bande d'état, 14 dans une remarque ou une pastille. Aucun émoji. Icônes ajoutées par É13 : la **punaise** (penchée de 40°), le **« ? » nu** (sans cercle, distinct de l'icône `aide`), **⇄** (l'autre sort) et **↺** (revenir à la proposition) |
| C-5.2 | Chaque icône a son mot (exceptions nommées pour les lecteurs d'écran : chevron « Replier », − / + ; au palier « texte agrandi » de Comparer, les chevrons de groupe et « Photo entière », leur nom dans l'infobulle et `aria-label`, accepté par l'utilisateur le 28.10 ; le curseur de taille et ses deux photos, « Photos plus petites » et « Photos plus grandes », sans le mot « Taille », choix de l'utilisateur du 29.10, É11 ; ↶ ↷ de la ligne de l'étape, le geste dans l'infobulle et le nom lu, « Annuler : écarter 1 photo », et rappelé par chaque message, choix de l'utilisateur du 29.10, É12 ; le filtre « ? 3 » de Floues, icône et nombre, « À vérifier » dans l'infobulle et le nom lu, É13) |
| C-5.3 | ✦ = IA, toujours avec un prix ou « … » (sauf dans une bande d'état et une remarque, où il dit l'origine d'un avis déjà payé, É13) ; ★ = album ; ✓ = garder, fait ; ✕ = écarter, Fermer. Dans une bande d'état (É13), l'icône dit **d'où vient l'idée** : punaise = vous ; ✓ ✕ = l'application ; ✦ = l'IA ; « ? » brun = à vérifier ; ⇄ et ↺ n'y paraissent qu'au survol, pour dire l'effet du clic |

## C-6 Espacements, rayons, ombres

| N° | Règle | Test |
|---|---|---|
| C-6.1 | Échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 ; marge de page 24, Comparer compris | jetons `--e1` à `--e7` |
| C-6.2 | **Bord tenu** : le dernier élément de chaque barre finit à ≥ 24 px du bord droit, vérifié avec le texte le plus long (étape 13, compteur « 12,40 », compteurs à 4 chiffres) | essai de charge de `capturer.mjs` |
| C-6.3 | **Proximité** : écart entre groupes ≥ 2 × écart dans un groupe ; deux contours ne se touchent jamais (≥ 4 px) | — |
| C-6.4 | Un seul bord de texte par colonne ; un fond de sélection peut déborder, le texte non | — |
| C-6.5 | Rayons 6 (photo, bande) · 8 (commande, É11) · 16 (groupe, dossier) · 999 (pastille) ; aucune ombre dans la page, une seule pour ce qui flotte | — |
| C-6.6 | Photos toujours sur la table ; un groupe = filet de 1 px (2 px vert pour le groupe en cours) ; seuls les « dossiers » sont des cartes blanches. Floues comprise : plus de carte blanche sous sa grille (É13) | — |
| C-6.6 bis (É15) | **Un lieu se présente en carte**, comme un dossier : fond `--surface`, filet `--filet-fort`, rayon 16, 12 px entre deux cartes, sur la table (« Vos lieux ») ; la carte dont le nom change prend le filet vert | — |

## C-7 Gabarits

| N° | Règle | Test |
|---|---|---|
| C-7.1 | **La page défile en entier, avec une seule barre de défilement** (É12). De haut en bas : barre du projet et barre d'outils (elles partent avec la page), **ligne de l'étape** (48 px, collée en haut), contenu, barre du bas 64 / 56 (fixe, opaque). Une zone de photos ne défile jamais dans une autre ; seules les colonnes collées défilent seules ; aucune colonne ne défile en largeur | contrôles automatiques |
| C-7.2 | Barre de l'application : logo et projet · frise · « Étape n sur 13 ▾ » (sans le nom de l'étape) · ✦ IA ; sur les pages d'étape, Aide et Menu sont au bout de la ligne de l'étape (É12) ; sur l'Accueil, la Configuration et les pages sans étape, la barre ne change pas (Aide · Menu au bout) | — |
| C-7.3 | Gabarit **Photos** : liste 248/232 avec vignettes et état sous la date ; table ; panneau 304/288 seulement s'il porte des actions. **Réduire le panneau ne cache jamais les décisions** (colonne de 224 px) | `selection-replie_*` |
| C-7.4 | Gabarit **Décisions** : « À faire ici » 440/420, numérotée. Point fait = une ligne + lien ; point en cours = titre, détail, choix, **bouton plein en dernier**, collé en bas de la colonne s'il ne tient pas ; sous 700 px de haut, les points faits se replient en « ✓ N points faits · Revoir ▾ » | Nommage et Tri à 1280 |
| C-7.5 | Vue **Comparer** : barres 48 / 32 / scène / 56. Présentation calculée (côte à côte si chaque photo y garde ≥ la moitié de sa surface en « Une à la fois », jamais sous 220 px de haut). « Une à la fois » : photo, légende à droite (220 px), bande de vignettes (1 colonne, 2 sous 700 px de haut ; toutes visibles jusqu'à 6). Côte à côte : cartes de la largeur de la photo, au moins celle de l'état et de ses choix (240 px ; 340 à la Sélection) ; c'est la rangée qui doit tenir. Choisi à la main : 2 ou 3 rangées si une ne tient pas, désactivé sous 80 px de haut. Une paire toujours côte à côte. Sous la carte : la bande d'état (C-9.12, C-9.13 : 28 px, la même que sur la page, cliquable de même), puis les choix, puis 2 lignes au plus (remarque, heure, dossier) ; à Doublons, les choix disent le verbe (« Garder » / « Écarter »), la bande l'état (É14). Le plein de la barre du bas est « Accepter → » avec la ligne grise de la page (C-4.2) ; sur le dernier groupe d'une section, il passe au premier groupe de la suivante. Ligne d'information et titre passent à la ligne, jamais coupés. Ouverture sur la photo conseillée (IA ou la plus nette), sinon la première « À garder », sinon la 1 ; la réponse de « Choisir avec l'IA » y fait passer (choix de l'utilisateur). Le clavier entre dans la vue à l'ouverture et y reste ; ↑ ↓ le posent sur la carte, jamais sur un choix ; Entrée bascule partout sauf sur une commande (Fermer, Accepter…). ↑ ↓ photo, ← → groupe, dans la journée ou le dossier. Quitter : « Fermer » (Échap). Calcul : `app/src/lib/presentationComparer.ts` (proportions lues sur les miniatures, quart de tour compris) | mesures de `systeme.md` § 10 ; `essai_charte.mjs` à 2, 3, 4 et 6 photos (Doublons) et 3 (Sélection), à 1440, 1280 et 1024 ; ↓ puis Entrée ne change aucun état |
| C-7.6 | Palier « texte agrandi » (moins de 1180 px de large, soit 1280 à 125 %) : frise et nom du projet masqués, barre d'outils sur 2 lignes, en-têtes qui passent à la ligne ; rien ne défile en largeur | fenêtre de 1024×464 |
| C-7.7 (É14) | **Liste de dossiers sur deux lignes** (forme de Lieux et sorties, D112 point 10 ; d'abord à la Sélection) : ligne 1, le nom en 14 px / 600, sur une ligne (raccourci à la fin, entier en infobulle et dans le nom lu) ; ligne 2, la période en 14 px / 400 `--texte-2` (« 21.03 – 22.03.25 », un seul jour « 15.07.26 »), puis l'icône `calendrier` de 14 px si un événement du calendrier s'y rapporte (son titre en infobulle et dans le nom lu, plus de ligne à part) ; le nombre de photos à droite, en pastille, centré sur les deux lignes (C-1.3). Arborescence : le chevron et le retrait ne bougent pas le bord du texte d'un même niveau (C-6.4). Lieux et sorties et Petits dossiers la prennent à leur sous-lot, avec le menu « … » | Sélection à 1280 et 1024 : deux lignes par dossier, aucun nom coupé sans infobulle |

### C-7 du cadre commun (lot 4, PROVISOIRE, pages passées : Sélection, Doublons, Floues (É13), et le Recadreur)

Une page passée au cadre porte `data-cadre="commun"` sur `.app` ; les autres
gardent `data-cadre="ancien"` jusqu'à leur tour. La forme E (É12 : la page
défile, la ligne de l'étape reste) vaut sur les **13 étapes**, passées au
cadre ou non. Contrôle : `app/outils/essai_cadre.mjs`.

| N° | Règle | Test |
|---|---|---|
| C-7.1 (lot 4, récrite par É12) | **Forme E** : la page défile en entier, à toute hauteur, avec une seule barre de défilement. Partent avec la page : la barre du projet (52 / 44 : logo, nom du projet, frise, « Étape n sur 13 ▾ », ✦ IA), les bandeaux au-dessus de l'étape et la barre d'outils (onglets, filtres, aides ✦ d'ensemble) ; on les retrouve en remontant ou avec Origine. **Reste collée en haut : la ligne de l'étape**, 48 px, une seule ligne : titre · vue en cours (C-4.12) · filtres s'ils tiennent · message (C-8.3 bis) · curseur de taille (place vide gardée sans photos) · ↶ ↷ · Aide · Menu. **Reste en bas : la barre du bas** 64 / 56 / 56 (1440×900 ; sous 1440 px de large ou 700 px de haut ; palier), opaque, les photos passent dessous. La grille de photos suit la page : aucune boîte de photos qui défile (Floues comprise, plus de boîte de 420 px) ; seules les colonnes collées (C-7.6 bis) défilent seules | `essai_cadre.mjs`, sur les 13 étapes, la page menée à 0, 50 % et 100 % : une seule barre de défilement (aucun ancêtre de la grille avec `overflow` qui défile) ; ligne de l'étape collée à y 0 dès que la barre du projet est sortie, titre, curseur, ↶ ↷, Aide et Menu au même x à chaque position, d'un geste à l'autre et d'une étape à l'autre ; barre du bas et Valider immobiles et opaques ; barre du projet et barre d'outils revenues avec Origine |
| C-7.1 bis | Le plein n'est jamais dans ce qui défile sans lui : il est dans la barre du bas, une tête collée (tête de table, bloc fixe du panneau) ou l'en-tête collé du groupe en cours, qui suit le dernier geste (Doublons) | un seul plein entier, non recouvert (`elementFromPoint`, ligne de l'étape et barre du bas comprises), à l'arrivée, à 50 % et à 100 % de la page et de chaque colonne collée |
| C-7.1 ter | À tout moment, ce que fait le plein se voit ou se lit. **À l'arrivée et après « Accepter »** (440 px de haut et plus), la bande « À garder » du groupe qui porte le plein est entière : après « Accepter », le groupe suivant vient juste sous les têtes collées (ligne de l'étape, tête de la table), au même y d'un « Accepter » à l'autre (É12 ; une grande rafale dont la photo gardée est en bas descend jusqu'à sa bande, son en-tête collé sous elles) ; après la molette, la ligne grise d'à côté suffit (« garde la 2 · écarte 1 », É14). Le texte d'un plein n'est jamais rogné : il ne rétrécit pas, ce sont ses voisins qui cèdent (dans Comparer : « Photo entière » en icône sous 1440 px, puis le rappel des touches sur deux lignes, jamais coupé) | Doublons : bande entière à l'arrivée ; à chaque position, bande ou libellé ; `scrollWidth ≤ clientWidth` et texte dans sa boîte pour chaque plein, page et Comparer (rafale de 12), aux 3 tailles et aux 2 thèmes |
| C-7.1 quater (lot 4, Doublons, récrite par É12) | Le plein est dans l'en-tête du groupe en cours, collé **sous la ligne de l'étape et la tête de la table**, à toute hauteur (chaque en-tête pousse le précédent ; plus d'accroche des groupes, `scroll-snap` retiré : la page entière défile). **Le dernier geste gagne** : un clic, une touche ou le focus venu du clavier dans un groupe le rend « en cours », sur place, sans défilement ; après la molette, s'il est sorti de la vue, le plein passe au premier groupe dont on voit la bande « À garder » entière, à défaut à celui dont l'en-tête est collé en haut. A et C visent ce groupe, où que soit le focus, sauf dans un champ de texte ou un menu ouvert. Après « Accepter » — et après tout geste qui replie un groupe : la section, l'onglet (tour 3) — le plein suivant ignore les clics, A et Entrée 0,5 s (il arrive en fondu), « toutes · aucune » et les photos du groupe suivant aussi ; sur le dernier groupe d'une section, « Accepter → » ouvre la section suivante qui reste à accepter, son premier groupe sous les têtes collées (É14, question 2) ; une touche gardée enfoncée n'accepte qu'une fois, sur le plein comme sur une photo. Après « Accepter », si le focus était dans la table, il va sur la photo gardée du groupe qui prend le plein, jamais sur le plein : Espace y garde le sens « choisir », → passe à la photo d'à côté (tour 3). Une annulation qui rouvre un groupe de la page (Ctrl+Z, ↶ de la ligne de l'étape) lui rend le plein et le montre sous les têtes collées, comme après « Accepter » (tour 3, É12). Fermer « Comparer en grand » rend le plein au dernier groupe regardé et le montre. Seul « Accepter » fait avancer la liste : le groupe accepté se replie à sa place, avec tous les filtres (D100 levée) ; le focus ne suit le plein que s'il était déjà dans la table. L'en-tête collé touche le bas de la tête collée au-dessus de lui (rien ne passe entre eux). Un seul groupe porte le filet vert : le focus n'en dessine pas un second | `essai_cadre.mjs`, essais de geste (clic dans un autre groupe puis A, double-clic au centre et à 20 px du bord droit du plein, double-clic sur « toutes » aux 3 tailles, A sur le dernier groupe d'un mois (le mois suivant ouvert), clic sur une photo puis A, → et Espace (rien d'accepté), A puis Ctrl+Z (plein sur le groupe rouvert, au y d'arrivée, A le réaccepte), A deux fois, A et Entrée gardées 1,2 s, clic sur une photo du groupe suivant 150 ms après « Accepter », A cinq fois de suite aux 3 tailles, champ « Chercher » et molette, Tab puis A, retour de Comparer) ; en-tête collé juste sous la ligne de l'étape et la tête de la table, la page menée à 50 % et 100 %. Après un geste qui replie un groupe, rien de cliquable n'arrive à la place du plein : « Revoir » suit le texte de la ligne repliée et ignore les clics 0,5 s |
| C-7.3 bis (lot 4, Doublons, récrite par É14) | **Barre d'outils** : les onglets « Copies exactes · Rafales · Même scène (IA) », un filet, « Écartées » (le nom, et dessous ce qui reste ou « 5 photos ») ; puis les boutons de l'onglet, en clair et en contour : Copies, « Accepter les 3 propositions » et « Garder tous les exemplaires » ; Rafales, « ✦ Choisir avec l'IA dans 8 rafales · environ 0,03 CHF ». Au palier, elle passe sur deux lignes. **Liste de gauche** : en haut « Afficher » (pastilles, « Tous » allumé), « Grouper » (Journée · Mois · Dossier) et « Classer » (Heure · Plus grands d'abord), deux segmentés visibles, chaque mot au-dessus du sien ; « Chercher » ; dessous les journées ou dossiers. **Tête de la table** : le titre de la section et son compte, puis à gauche, en contour, « Accepter les 7 groupes » et « ✦ Choisir avec l'IA dans ce mois · environ 0,03 CHF » (deux lignes au palier) ; quand la section est finie, le plein « Suite à accepter : … › » ; quand l'onglet est fini (et sur « Écartées »), le plein « Rafales : 6 à accepter › » vers le prochain onglet qui reste ; tout accepté : « Valider et continuer » plein. **En-tête de groupe**, une ligne (56 / 52 / 48 px au plus) : heure et titre, « Comparer en grand », la ligne grise « garde la 2 · écarte 1 » (« · puis septembre 2026 » sur le dernier groupe d'une section), « Accepter → » au bout à droite, de largeur fixe (C-4.2). Dessous : les photos, chacune avec sa bande (« ✓ 2 · À garder », C-9.12) ; aux Copies, la photo une fois et une ligne par exemplaire. **Ligne sous les photos** : la case « Garder plusieurs photos » et, cochée, « choisir : toutes · aucune » ; l'état du groupe en mots, son dossier ; sur le dernier groupe, « Journée suivante à accepter : … › ». Ni « Tout garder », ni « Tout écarter », ni « Autres choix ▾ », ni aucun menu de portée. Pas d'accroche du défilement (É12). Après défilement, l'onglet en cours est écrit dans la ligne de l'étape (« Rafales ▾ », C-4.12) | Doublons : aucun bouton à ▾ hors du menu de vue ; « Accepter → » de même largeur sur chaque groupe ; ligne de l'étape et têtes collées inchangées |
| C-7.3 ter (É13, Floues) | **Ligne de l'étape**, une seule, 48 px : « Photos floues » · filtres « Toutes 58 · À écarter 6 · ? 3 · punaise Par vous 2 » (C-4.8 ; « À écarter » compte ce qui **sera** écarté ; « ? » en brun, icône et nombre, C-5.2) · message passager (C-8.3 bis : « **Écartée par vous.** ↶ ou Ctrl+Z pour l'annuler ») · curseur de taille sans le mot « Taille » · ↶ ↷ · Aide · Menu. Ni phrase de consigne (elle est dans l'Aide), ni « Afficher : » visible. Sous 1180 px de contenu, les filtres redescendent dans la barre d'outils, qui part avec la page (C-4.12 : « Toutes ▾ » dans la ligne après défilement). **Table** : les photos posées sur la table (C-6.6), en parties titrées (C-9.8), une seule bande de 28 px (C-9.2), aucun chiffre sous la photo (C-9.7). **Panneau** collé à droite, 304 / 288 (C-8.7 bis). Pas de barre d'action flottante ; « Valider et continuer » est le seul plein (C-4.1) | `essai_cadre.mjs` : Floues dans `PAGES_CADRE` ; titre, curseur et ↶ au même x que sur les autres étapes, à l'arrivée et après défilement, à 1440×900, 1280×580 et 1024×464 ; la ligne ne déborde pas, en français et en anglais (mesuré par la maquette : message de 197 px à 1280, 357 à 1440) ; une seule barre de défilement |
| C-7.3 (lot 4) | Gabarit Photos : liste de gauche (largeur réglable), table, panneau de droite 304 / 288 « N photos choisies » ; sans photo choisie, « L'album » ; Aide 320 / 304 qui pousse le contenu. Liste, panneau et Aide sont des colonnes collées sous la ligne de l'étape (C-7.6 bis, É12) | Sélection |
| C-7.6 (lot 4) | Palier : quand la largeur du contenu (Aide déduite) est de 1180 px ou moins, la liste de gauche devient un menu dans la tête de la table (le même panneau, en un seul exemplaire) ; frise et nom du projet masqués ; l'Aide ouverte prend la place du panneau de droite (les décisions restent au-dessus d'elle) ; rien ne défile en largeur | 1024×464 |
| C-7.6 bis (récrite par É12) | **À toute hauteur** (É8 devient la règle) : la page défile en entier, la grille de photos suit la fenêtre (une seule barre de défilement), la barre du bas reste fixe. Liste de gauche, panneau de droite, colonne d'Aide ouverte et têtes collées (tête de la table, haut du panneau avec son plein, en-tête du groupe en cours de Doublons avec « Accepter ») se collent **sous la ligne de l'étape**, jamais sous le bord de la fenêtre. Une colonne collée a pour hauteur la place visible entre la ligne de l'étape et la barre du bas (variable CSS mise à jour au défilement et au redimensionnement) : sa fin reste atteignable, même sur une page courte ; si sa suite est cachée, « ⌄ suite » fondu en bas le dit. Le focus n'est jamais caché sous la ligne ni sous la barre du bas (`scroll-padding`) | 1024×400, 1024×464, 1280×580, 1440×900 : fin de chaque colonne collée atteinte ; un élément atteint par Tab entier entre la ligne et la barre du bas ; avec ↓ répété dans la grille, la photo choisie reste entière |

## C-8 Places fixes

| N° | Règle |
|---|---|
| C-8.1 (récrite par É12) | Aide puis Menu, avec leur mot, toujours au bout à droite : sur les pages d'étape, **au bout de la ligne de l'étape**, donc visibles pendant tout le défilement ; sur l'Accueil, la Configuration et les pages sans étape, au bout de leur barre, comme avant. Aide en bleu doux bordé (C-3.10), Menu neutre sans bord (É11). « ✦ IA : x sur y CHF » reste dans la barre du projet et part avec elle |
| C-8.2 (récrite par É12) | **↶ et ↷** (Annuler, Rétablir) : dans la ligne de l'étape, entre le curseur de taille et Aide, ↶ au même pixel sur chaque page (barre du haut dans Comparer, avec leur mot, inchangée). Icônes seules : le geste est dans l'infobulle et le nom lu (« Annuler : écarter 1 photo », Ctrl+Z ; « Rétablir : écarter 1 photo », Ctrl+Y) ; sans geste, « Rien à annuler ici » / « Rien à rétablir ici », grisé. Le geste se lit aussi dans chaque message (C-8.3 bis) |
| C-8.3 | **Curseur de taille** (É11, remplace « Taille − + ») : un seul composant sur toutes les pages, gris, sans le mot « Taille » (nom accessible « Taille des photos »). Aux bouts, l'icône `photo` en 16 et 22 px, dans deux boutons de 30 × 32 à bord 1 px `--filet-fort` visible dès le repos (« Photos plus petites », « Photos plus grandes » en infobulle et nom accessible), un cran au clic, grisés au bout avec leur raison. Curseur de 120 × 32 (piste de 96 px au palier) : piste 4 px `--contour`, partie parcourue `--texte-2`, poignée `--surface` bordée `--texte`, jamais vert. 12 crans de `PAS_TAILLE` (100 à 600) ; une taille enregistrée hors cran est ramenée au plus proche à l'affichage, sans toucher aux réglages ; ← → un cran, Origine, Fin ; `aria-valuetext` et l'infobulle disent la taille **vraiment affichée** (« 120 px » au palier de Doublons, où les photos font les trois quarts du réglage, É14). Le réglage du flou de Floues prend la même encre neutre, à sa place (pas de mot « Taille » ni de petites photos, `data-action="tolerance"`) ; minimum : rangée de 120 px, case de 96 px |
| C-8.4 | **« Rien n'est supprimé… »** avec le bouclier, **seulement là où l'on écarte des photos** (choix de l'utilisateur, 28.10) : ligne 2 de la barre du bas des étapes Floues, Doublons, Tri, Lieux et sorties, Sortie ; ligne d'information de « Comparer en grand » des Doublons |
| C-8.5 | Ligne 1 de la barre du bas : ce que devient ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées ») |
| C-8.6 | Rien ne flotte : le retour se lit à la place du geste, dans le message de la ligne de l'étape et dans l'infobulle de ↶ (É12) ; une erreur reste jusqu'à un clic |

### C-8 du cadre commun (lot 4, PROVISOIRE, mêmes pages)

| N° | Règle |
|---|---|
| C-8.1 (lot 4, récrite par É12) | « Aide » **dans la ligne de l'étape**, juste après ↷ et avant Menu (`data-place="aide"`), sur les 13 étapes ; Menu en dernier, à 24 px du bord (C-6.2), rendu une seule fois. Elle porte aussi la consigne de l'étape : la phrase qui était sous le titre y est, en tête de l'explication. La colonne d'Aide ouverte est collée sous la ligne (C-7.6 bis). Elle s'ouvre d'elle-même à la première visite d'une étape à partir de 1440 px de large ; en dessous, elle porte « à lire » (pastille brune) jusqu'à la première ouverture ; bleu doux, états de C-3.10 (É11) ; « Fermer » (avec le mot) ou Échap la ferment ; « Tout le mode d'emploi » en bas |
| C-8.2 (lot 4, récrite par É12) | ↶ ↷ dans la ligne de l'étape, après le curseur de taille, avant Aide : boutons de 32 × 32 sans bord, icônes de 16 px ; ↶ au même x sur les 13 étapes à une largeur donnée (maquettes : x ≈ 996 à 1280, 1156 à 1440, 740 à 1024), à l'arrivée, après défilement et quel que soit le geste. Leur nom lu et leur infobulle suivent chaque geste (« Annuler : accepter 1 rafale », avec Ctrl+Z ; `aria-keyshortcuts`) ; grisés, ils restent dans l'ordre de Tab (`aria-disabled`), « Rien à annuler ici » dans le nom et l'infobulle. La ligne garde sa hauteur et ses places d'un geste à l'autre. Dans le Recadreur, un seul « Annuler » (une seule pile : réglages du cadre et quarts de tour) ; « Remettre la photo entière » dans la barre du bas, à gauche d'« Accepter le recadrage ». Contrôle : `essai_cadre.mjs` (nom et infobulle de ↶ après un clic, « Accepter » et Ctrl+Z à Doublons, après deux décisions à la Sélection ; titre, curseur et ↶ au même x et y d'un geste à l'autre à 1024×464 et 1280×580) |
| C-8.2 bis (lot 4, tours 2-3, provisoire, É12) | Sur une page passée au cadre, ↶ et ↷ de la ligne de l'étape, Ctrl+Z et Ctrl+Y ne défont et ne refont qu'un geste fait à l'étape affichée ; sinon « Rien à annuler ici » / « Rien à rétablir ici », l'étape du dernier changement en infobulle, et la touche le dit par un message (choix 6 A). Un message venu d'une autre étape commence par le nom de cette étape (« **Floues : 12 photos écartées,** dans « Mis de côté » ») et garde son lien « Y aller », qui mène à l'étape du geste, où ↶ le défait ; il ne finit pas par « ↶ ou Ctrl+Z » : jamais deux « Annuler » visibles ensemble. Un geste sans effet n'entre pas dans l'historique et ne vide pas « Rétablir » (Recadreur : format déjà choisi, photo déjà entière, « Accepter » sans changement). Un clic à la souris sur une décision ou un outil (Sélection, Recadreur) ne laisse pas le focus sur le bouton : Espace et Entrée gardent le sens de la page. Contrôle : `essai_cadre.mjs` (clic « Tourner » puis Espace : un quart de tour et les photos dans l'album ; clic « À droite » puis Entrée : le Recadreur se ferme ; « Déjà la photo entière » désactivé ; Ctrl+Z à l'arrivée sur la Sélection et sur Doublons après Floues : rien de défait, l'étape dite ; le message de Floues commence par « Floues » et porte « Y aller ») |
| C-8.3 (lot 4) | Le curseur de taille (C-8.3) dans la ligne de l'étape, à la même place sur chaque page, juste à gauche de ↶ (É12) (`data-place="taille"`), de 100 à 600 px ; une page sans photos garde sa place vide, pour que ↶ ne bouge pas ; il quitte la barre d'outils de la Sélection et de Doublons (É11) |
| C-8.3 bis (lot 4, tours 2-3, provisoire, É12) | Message passager : dans la ligne de l'étape, entre le titre (ou la vue en cours) et le curseur, sur les 13 étapes (deux lignes de 14 px au plus, coupé au-delà, entier en infobulle et pour le lecteur d'écran), jamais sur les photos, le plein ou la barre du bas ; le nombre qu'il annonce est compté avant le geste. Il commence par **ce qui s'est passé, en gras**, qui reste entier ; un message qui suit un geste de la page finit par « ↶ ou Ctrl+Z pour l'annuler » (« **Écartée par vous.** ↶ ou Ctrl+Z pour l'annuler » ; à la Sélection, après chaque décision, « **Dans l'album.** ↶ ou Ctrl+Z pour l'annuler », « **3 photos dans l'album.** … », É14). Dans une vue en grand ou un dialogue, la bulle. La zone `role=status` est toujours dans l'arbre d'accessibilité : vide, elle est masquée à l'écran (`clip-path`), jamais `display: none` ; chaque message est un nouveau nœud (WCAG 4.1.3). Contrôle : `essai_cadre.mjs` (après chaque A, « N photos écartées » juste dans la ligne de l'étape, suivi de « ↶ ou Ctrl+Z pour l'annuler », partie en gras entière, aucune bulle sur la page ; zone `status` vide présente dans l'arbre d'accessibilité, lu par CDP) |
| C-8.4 (lot 4) | « Valider et continuer » au même pixel sur toutes les pages, passées au cadre ou non ; la ligne 1 de la barre du bas tient sur deux lignes au plus (14 px au palier), nombres à 4 chiffres compris |
| C-8.4 bis (lot 4) | Pages passées au cadre où l'on écarte (Doublons, Floues) : la phrase courte « Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». » (66 signes) ; « Vos photos d’origine ne bougent pas » dans son infobulle et dans l'Aide. La ligne 1 dit ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées. »), en brun s'il reste des copies exactes (C-8.11) ; le compte des photos écartées est sur l'onglet « Écartées » (É14) |
| C-8.10 | **« En essai »** (É11) : pastille neutre, jamais brune ni verte (fond `--mat`, texte `--texte-2`, 14 px / 500, 28 px de haut, rayon 999, icône fiole de 14 px), juste après le titre d'une étape dont la présentation peut encore changer (aujourd'hui l'Album seul), et après son nom dans « Étape n sur 13 ▾ ». Après le titre, c'est un bouton qui ouvre sa bulle (survol, clic, clavier) : « Étape en essai » / « Cette étape marche, mais sa présentation peut encore changer. Vos réglages et vos choix sont gardés. » Jamais « bêta » |
| C-8.7 | Panneau de droite : une tête (« 3 photos choisies »), le bloc fixe des décisions (le plein n'y est qu'à la Sélection, la décision déjà prise est allumée), puis ce qui défile : les outils de la photo avec leur touche (« Ne plus choisir » en premier), et l'album |
| C-8.5 bis (É13) | **La barre du bas dit ce que fera « Valider »** des bordures et des « ? » : ligne 1, « 6 photos seront écartées · 52 gardées · dont 3 à vérifier — Valider suit le réglage pour les photos en bordure » (deux lignes au plus, C-8.4 lot 4) ; « dont N à vérifier » seulement si N ≥ 1, la phrase sur « Valider » seulement s'il reste une bordure. « seront écartées » et « gardées » s'additionnent au total (C-10.3) et disent le même nombre que le filtre « À écarter » et le compte du panneau. Ligne 2 : « Rien n'est supprimé… » (C-8.4 bis). À Doublons, cette phrase n'est pas reprise (É14) : « Valider » n'y écarte rien d'un groupe non accepté, la ligne 1 le dit (C-8.4 bis) |
| C-8.7 bis (É13, Floues) | Panneau collé à droite, de haut en bas : la mesure en cours (`EncartAnalyse`) tant qu'elle tourne ; **« Réglage du flou »**, avec « Revenir au réglage conseillé » (ou « ✓ Réglage conseillé »), le curseur neutre (C-8.3, `data-action="tolerance"`) entre « Écarter moins » et « Écarter plus », le seuil en infobulle et dans `aria-valuetext` ; le **compte en direct** en gras (« 6 photos seront écartées sur 58 »), et dessous, en gris, d'où viennent les décisions, seulement s'il y en a une hors du réglage (« Réglage : 3 · vous : 1 gardée, 1 écartée · IA : 1 · avant : 1 ») ; **« ✦ Demander l'avis de l'IA »** avec sa portée et son prix (C-4.6 : « sur les 3 photos à vérifier · environ 0,02 CHF ») ; **« ✦ Suivre l'avis de l'IA pour N photos »** ; pour la photo choisie, sa netteté avec son repère, d'où vient son sort, **Garder** (G ou S), **Écarter** (X), **« Retirer mon choix »** (Suppr ; désactivé avec sa raison quand rien n'est choisi par vous, C-4.7) et « Voir en grand » ; la **petite légende des badges** (« bordure : proposé · plein : décidé · punaise vous · ✦ l'IA · ? à vérifier » ; « Clic sur la bande : l'autre sort, décidé par vous ; un second clic rend la proposition ») ; « Comment on mesure le flou », replié |
| C-8.11 (É14, Doublons) | **Copies exactes restantes**, et elles seules (pas les rafales ni les scènes) : ligne 1 de la barre du bas en brun `--afaire`, graisse 600, avec l'icône `alerte` de 16 px (« 3 copies exactes pas encore acceptées : le tri les rangerait deux fois. ») ; la case de Doublons de la frise en brun doux une fois l'étape validée (C-3.3) ; « Valider et continuer » ouvre une fenêtre à trois choix : « Continuer sans elles » · « Les voir d'abord » · plein « Accepter les 3 copies et continuer » (Échap = « Les voir d'abord » : on reste, l'onglet Copies s'ouvre). Sans copie restante, « Valider et continuer » ne demande rien |
| C-8.9 (É15) | **Bandeau de rappel** : un reste à faire ailleurs (au Tri, les copies exactes restées à Doublons) se dit dans un bandeau brun doux (`--afaire-doux`, filet `--afaire`, icône `alerte`) au-dessus du contenu, une phrase avec un nombre et deux commandes au plus, en contour ; il disparaît de lui-même. Jamais le plein de la page | `essai_vrac.mjs` : texte, deux contours, au-dessus des colonnes, hors de la liste « À faire » ; disparu après « Les écarter ici » |

## C-9 États des photos

| N° | Règle | Test |
|---|---|---|
| C-9.1 | **Un seul signal d'état, écrit dans une bande de 28 px sous la photo** ; rien sur l'image | aucun élément positionné sur une photo |
| C-9.2 (récrite par É13) | **Le mot et sa couleur disent ce qui arrive ; l'icône dit d'où vient l'idée ; le plein dit que c'est décidé.** Le mot ne disparaît jamais : proposé « À garder » / « À écarter », décidé « Gardée » / « Écartée » (« Gardée par vous » / « Écartée par vous » quand c'est votre geste). **Vert, elle reste ; gris, elle part.** Une icône de 16 px en tête : punaise (vous), ✓ ✕ (l'application), ✦ (l'IA), « ? » brun nu suivi du mot (à vérifier, sur une proposition seulement). **Plein franc** (C-3.11, graisse 600) = décidé par un geste de l'utilisateur (clic sur la bande, G, X, « Accepter », « Suivre l'avis de l'IA », « Valider et continuer ») ; **bordure fine et pâle** de 1 px sur la surface (graisse 500) = proposé. « ✕ Écartée avant » (plein gris) = écartée par les anciens scripts, laissée écartée. Marques ↻ ✂ ▣ et « nouveau » au bout de la bande quand elle a la place, sinon dans l'infobulle et le nom lu. **Au repos, une bande n'a jamais la forme d'un bouton** ; au survol seulement, celle du bouton ordinaire (C-9.10). Les états, à 120 et 240 px : `reponses/maquettes/captures/1_badges_*` | au repos, aucune bande au fond `--accent` ni au bord `--contour` ; chaque bande a un mot ; une seule icône ; « ? » jamais sur un plein |
| C-9.2 (avant É13) | Plus aucune page ne la garde (É14) : Doublons, Comparer, la Sélection, « Décider une par une » et « Mis de côté » suivent C-9.2, C-9.12 à C-9.14 | plus aucun rendu d'avant É13 sur aucune page (`essai_charte.mjs`) |
| C-9.3 (récrite par É13) | **Aucune photo pâlie avant une décision de l'utilisateur** (groupe accepté, « Pas pour l'album »). À Floues, une photo qui part est **un peu délavée** (`saturate(0.3) contrast(0.7)` sur `img` et `canvas`, jamais une opacité : une photo de nuit resterait noire), qu'elle soit proposée ou décidée ; elle redevient **entière au survol, au focus et choisie** (120 ms, rien si « réduire les animations ») ; rien n'est délavé dans le filtre « À écarter ». **À Doublons**, une photo écartée **décidée** (groupe accepté, par vous) et, **à la Sélection**, une photo « Pas pour l'album » prennent le même délavé (É14) : plus aucune opacité sur une photo. Le délavé n'est qu'un renfort : la bande reste le signal | — |
| C-9.4 | Groupe pas encore accepté : pastille brune « à accepter » | — |
| C-9.5 | **Choisie** = anneau vert de 3 px dedans ; **focus** = noir 2 / jaune 3 / noir 2 dehors, `:focus-visible` seulement ; les deux se voient ensemble | capture Sélection |
| C-9.6 | Remarque sous la bande : 14 px, 2 lignes au plus, ✦ pour ce qui vient de l'IA ; Sélection : heure · signal · ✦ note ; marques ↻ ✂ ▣ au bout de la bande ; le texte entier, l'heure et le dossier sont dans l'infobulle et dans Comparer. À Floues (É13), la remarque n'existe que tant qu'un avis de l'IA n'est pas tranché (« ✦ L'IA : assez nette ? ») : sa ligne de 24 px est alors réservée sous toutes les photos de la grille, et disparaît quand tous les avis sont tranchés | — |
| C-9.7 | Ce qui quitte la miniature est **déplacé, jamais supprimé** : chaque badge du code a sa place écrite (remarque, bout de bande, infobulle, Comparer). À Floues (É13), la netteté quitte la miniature et s'écrit avec son repère (« Netteté mesurée : 47 · le réglage écarte sous 60 ») dans l'infobulle de la photo, le panneau de la photo choisie et la vue en grand | contrôle contre `badges` et `legende` des pages |
| C-9.8 (É13) | **Une grille triée par une mesure se coupe en parties titrées, jamais par un trait.** À Floues : « Trop floues » puis « Assez nettes », et en dernier les photos sans mesure ; chaque titre dit ce que la partie contient (« 6 photos, dont 2 gardées par vous »), pas l'effet ; une partie vide n'est pas dessinée. Une photo décidée par vous reste à sa place de netteté | Floues : titres des parties non vides, dans cet ordre |
| C-9.9 (É13) | **Libellés mesurés** : le libellé long d'une bande s'écrit dès qu'il tient, mesuré selon la largeur de la bande et dans la langue de l'interface (repère : « Gardée par vous » tient dès 164 px de case) ; sinon le court, icône comprise (« punaise Gardée »), le long dans l'infobulle et le nom lu. Le mot n'est jamais coupé (C-10.4) : sous 120 px, « Écartée avant » perd son icône pour garder son mot | `essai_charte.mjs` : aucune bande coupée au plus petit curseur, à 160 et 240 px, en français et en anglais |
| C-9.10 (É13) | **Le clic sur la bande** (réponse 20 de l'utilisateur). Sur une proposition ou une décision qui n'est pas de vous, un clic donne **l'autre sort, décidé par vous** (punaise, plein) ; sur un choix par vous, un clic **rend la photo à la proposition** (le réglage, l'IA ou le groupe ; à Floues, le réglage ; « Écartée avant » pour une photo écartée par les anciens scripts). Au survol, la bande prend la forme du bouton ordinaire (fond `--surface`, bord intérieur 1 px `--contour`, texte `--texte`, même graisse) et son mot devient l'effet du clic : **« ⇄ Garder »** / **« ⇄ Écarter »**, ou **« ↺ Revenir à la proposition »** (court : « ↺ » et le mot de la proposition, C-9.9) ; la bulle, qui vient après, rappelle l'état et d'où il vient. Après le clic, le message : « **Gardée par vous.** ↶ ou Ctrl+Z pour l'annuler ». **Gardes** : la bande arrête le clic (la photo n'est pas choisie pour autant), ignore le double-clic (pas de vue en grand) et un second clic pendant 0,5 s, ne se glisse pas et ne commence pas un rectangle ; **seule la bande montre la main** ; sa cible est toute la bande (28 px × sa largeur). Avec plusieurs photos choisies, le clic ne touche que sa photo. Elle n'est pas un arrêt de Tab (`tabindex=-1`) : le clavier passe par la photo qui a le focus, **G** (S en second nom à Floues) et **X** fixent un sort par vous, même celui qui est proposé, **Suppr** = « Retirer mon choix » ; son nom lu dit l'état et l'effet (« À écarter, proposé par le réglage. Activer pour la garder »). **Ctrl+Z défait chaque geste** | `essai_cadre.mjs` : clic (punaise, l'autre sort), second clic après 0,5 s (proposition rendue), double-clic (un seul changement, pas de vue en grand), clic pendant 0,5 s ignoré, G et X sur une photo proposée du même sort (plein, punaise), Suppr, Ctrl+Z après chacun ; la main seulement sur la bande ; rien de choisi après un clic sur la bande |
| C-9.11 (É13) | **L'origine est dans le plan**, écrite au fil de l'eau (règle d'or 7) : vous, l'application, l'IA, avant. À la reprise d'un projet ouvert avant É13, un choix fait photo par photo devient « par vous », un groupe accepté « application » (plein ✓ ✕), un avis de l'IA suivi « IA » (plein ✦), une photo écartée par les anciens scripts « avant » : la bande d'une photo ne change pas de sens en passant à É13 | tests unitaires de la reprise |
| C-9.12 (É14, Doublons et Comparer) | La bande d'É13, avec la place en tête après l'icône : « ✓ 2 · À garder » (change É9 : l'icône revient devant le numéro ; aux Copies, pas de numéro, une bande par exemplaire, É4). **Bordure** jusqu'à « Accepter » : ✓ ✕ quand c'est le groupe qui propose (la plus nette, l'original), ✦ quand c'est l'IA (même scène, « Choisir avec l'IA »), **« ? »** sur la photo proposée quand l'IA en préfère une autre (sa remarque dit « ✦ Conseillée par l'IA », C-9.6). **Plein** après « Accepter » (« ✓ 2 · Gardée », « ✕ 1 · Écartée », ✦ pour l'IA) ou pour un choix à la main (« punaise 3 · Gardée par vous », « punaise 2 · Écartée par vous »). **Clic** (C-9.10) : sur « À écarter », la photo est gardée par vous, seule si la case « Garder plusieurs photos » n'est pas cochée (les autres passent « À écarter », comme un clic sur la photo) ; sur « À garder », elle est écartée par vous ; sur un choix par vous, retour à la proposition du groupe ; « toutes », « aucune » et Ctrl+A fixent tout le groupe par vous, chaque photo en plein (2026-10-31, D112) ; dans un groupe accepté (« Revoir »), l'autre sort par vous, sans rouvrir le groupe. Libellés mesurés (C-9.9) : le mot et le numéro ne disparaissent jamais ; d'abord « par vous » passe dans l'infobulle, puis l'icône part. Une case de rafale fait au moins **128 px** de large | `essai_charte.mjs` : à 120, 160 et 240 px, numéro et mot entiers ; `essai_cadre.mjs` : bordure avant « Accepter », plein après, punaise après un clic |
| C-9.13 (É14, Sélection) | **Pas de punaise** : ★ et ★★ disent « vous ». Quatre bandes (C-3.12) : « À décider » (rien) · « ★ Dans l'album » · « ★★ Grande » · « Pas pour l'album » (court : « Hors album »). **Clic** : tout état hors de l'album donne « Dans l'album », tout état dans l'album (Grande comprise) redonne « À décider » ; au survol, « ⇄ Mettre dans l'album » / « ⇄ Remettre à décider » (courts : « ⇄ Album », « ⇄ À décider »). « Grande » et « Pas pour l'album » : touches 2 et X, ou le panneau. Mêmes gardes que C-9.10 (arrêt du clic, double-clic ignoré, 0,5 s, main seulement sur la bande). Les vignettes de « Décider une par une » (É6) prennent les mêmes couleurs | `essai_cadre.mjs` : clic sur « À décider » puis sur « Dans l'album », Ctrl+Z, message dans la ligne de l'étape |
| C-9.14 (É14, « Mis de côté » et « Écartées ») | Tout y est décidé : **plein gris**, la raison en mot, l'icône de son origine : « ✕ Floue » (le réglage), « ✦ Floue » (l'IA), « ✕ Doublon », « ✕ Copie exacte », « ✦ Doublon » (même scène), « punaise Écartée par vous », « ✕ Écartée avant ». Dans l'onglet « Écartées » de Doublons, un clic sur la bande donne « punaise Gardée par vous » (plein vert ; « Remise » disparaît), un second clic la rend écartée comme avant ; « Garder les 5 photos » remplace « Tout remettre (5) ». Dans la vue « Mis de côté » d'une liste de dossiers, la bande ne se clique pas : « Remettre » et Suppr y font ce geste, la photo quittant la vue | `essai_cadre.mjs` : « Écartées », clic puis second clic, Ctrl+Z |

## C-10 Mots

| N° | Règle | Test |
|---|---|---|
| C-10.1 | Un verbe par portée : **Accepter** (un groupe, un nom, un rangement), **Valider et continuer** (l'étape) ; « Fermer » pour quitter une vue | aucun « valid » hors du bouton d'étape |
| C-10.2 | **Un état, un mot**, sur toute la page et dans la vue en grand : « à accepter » / « pas encore acceptés ». Exception écrite (É13, comme É6) : « Gardée par vous » / « Écartée par vous » s'écrivent « Gardée » / « Écartée » avec la punaise quand la bande est trop étroite (C-9.9) ; la punaise reste à toutes les tailles, et « par vous » est dans l'infobulle et le nom lu | — |
| C-10.3 | Un compteur dit de quoi il parle ; pas de parenthèses ; les compteurs exclusifs s'additionnent, sinon « dont » | somme des pastilles = total |
| C-10.4 | Jamais de « … » de coupure sur le titre, la bande, la remarque ou le message (sauf au-delà de 2 lignes, entier en infobulle ; la partie en gras du message jamais), ni sur le nom lu et l'infobulle de ↶ ↷ (É12 : la consigne n'est plus sous le titre, elle est dans l'Aide) | contrôle « texte coupé » : 0 (`essai_charte.mjs` : bandes de toutes les pages, au plus petit curseur avec ↻ ; titre, ligne d'information, légende et vignettes de Comparer à 1440, 1280 et 1024 ; dans la légende de « Une à la fois », le texte mesuré ligne par ligne, pas la boîte : `essai_charte.mjs` et `essai_cadre.mjs`, « Garder plusieurs photos » à 1024×464, tour 3) |
| C-10.5 | Un libellé ne change pas avec la largeur ; on gagne la place ailleurs (menu « Plus ▾ », marges) | — |
| C-10.6 | « environ » plutôt que « ≈ » ; aucun « Ø » | — |
| C-10.7 | **Texte d'exemple** (É11) : un exemple de contenu commence par « Par exemple : » (majuscule) ; une consigne (« Chercher un événement ») n'en prend pas, ni une proposition de l'IA ou un format. Jamais d'italique (la police n'a pas d'italique, C-1.1). Un exemple court (« Par exemple : vacances au bord de la mer, juillet 2026 »). Couleur `--texte-exemple`, champ sur `--surface`. S'il ne tient pas dans le champ, il passe dessous, en aide, sur la même ligne que l'aide qui y est déjà | `contrastes.py` : exemple ≥ 4,5:1 sur le fond réel de chaque champ et écart ≥ 2,5:1 avec le texte tapé, dans les deux thèmes ; aucun `font-style: italic` sur `::placeholder` ; aucun « par exemple » en minuscule en tête d'exemple |
| C-10.8 (É14) | **Les flèches** : **→** = agit puis avance (« Accepter → », « Valider et continuer → ») ; **›** = va quelque part sans rien décider (« Suite à accepter : … › », « Journée suivante à accepter : … › »). Une action qui n'avance pas n'a pas de flèche (« Accepter les 7 groupes », « Accepter le recadrage ») | — |
| C-10.9 (É14) | **Un geste, un verbe ; un état, un participe ; un lieu, un nom.** Écarter (le geste, partout : Doublons, Floues, Tri, Lieux et sorties, visionneuse, Aide), Écartée(s) (l'état : bande, onglet « Écartées », compteurs), « Mis de côté » (le dossier de la sortie, et lui seul). « Mettre de côté », « mis de côté » pour un état, « Remise » et « Tout remettre » ne s'écrivent plus | recherche de « mettre de côté » et « Remise » dans les textes de `app/src` : 0 |
| C-10.10 (É15) | **Ce qui vaut pour chaque ligne s'écrit une fois**, en tête de la liste (au Tri : « Les noms des dossiers se choisissent plus tard, à l'étape Nommage. »), jamais répété sur chaque ligne | `essai_vrac.mjs` : la phrase en tête, rien sur le Nommage ni OpenStreetMap dans les lignes |

---


## Ce que cette charte remplace (D110)

- **GUIDE_UX O5** : le plein est la prochaine action utile, pas « Valider et
  continuer ».
- **V1** : 13 / 16 / 18 / 22 → 14 / 16 / 20 / 24.
- **P1** : l'état s'écrit sous la miniature.
- **P4** précisée : les flèches suivent la disposition de la vue.
- **D100** levée : un groupe accepté reste dans la liste, replié ; le filtre
  s'appelle « Tous ».
- **D101, D104, D108, D96** gardées (libellé chiffré, écart avant de ranger à
  nouveau, récapitulatif des noms, dossier de la photo).
- Plus Jakarta Sans → Inter 4 ; rôle de couleur de l'IA supprimé ; jetons de
  `style.css` à aligner sur C-3 à C-6.
- **É12 (D112 point 8, 29.10.2026)** : GUIDE **O2** (Aide dans la ligne de
  l'étape, plus dans la barre de l'application ; consigne dans l'Aide, plus
  sous le titre), **O3** (curseur de taille, place vide gardée sans photos),
  **O4** (↶ ↷ en icônes, le geste dans l'infobulle et le message), **M4**
  (↶ ↷ sans mot) et le schéma de l'ossature (la page défile, la ligne de
  l'étape reste) ; D111 « bandes fixes, seul le contenu défile » et « Annuler
  dans l'en-tête avec son mot » ; la proposition du lot D (Annuler dans la
  barre de l'application) est abandonnée.
- **É13 (D112 points 6 et 7, réponse 20, écrite le 30.10.2026)** : C-9.2 (la
  bande « ne prend jamais la forme d'un bouton » devient « au repos seulement »,
  et l'exception « Nette : gardée » en gris de Floues disparaît) ; C-9.3 (pâlie
  devient un peu délavée, à Floues) ; à Floues, la touche Suppr cesse d'écarter
  (X le fait ; Suppr = « Retirer mon choix ») et « Sauver » devient « Garder » ;
  « Selon le curseur » devient « Retirer mon choix » ; la ligne de consigne et la
  barre d'outils de Floues deviennent une seule ligne de titre ; plus tard, à leur
  sous-lot, É9 (l'icône revient devant le numéro à Doublons) et la puce cochée ✓
  du Nommage.
- **É14 (D112 points 2, 3, 4, 6 et 10, écrite le 30.10.2026)** : É9 (le plein
  nomme la photo et la montre en vignette ; « 4 · À garder » sans icône) et ses
  écarts sur les noms de fichier et de dossier ; É4 (« la ligne entière se
  choisit » reste, la bande prend la grammaire d'É13) ; les choix du 27.10 « Tout
  garder » visible et « Autres choix ▾ » ; D101 sur ce point (« Tout garder » en un
  geste devient « toutes », puis « Accepter → ») ; les menus de portée et
  « Grouper et classer » replié (C-4.12, C-7.3 bis) ; le verbe « mettre de côté »
  et l'onglet « Mis de côté » ; l'opacité des photos écartées de Doublons et de la
  Sélection ; la phrase prévue pour Doublons par C-8.5 bis.

