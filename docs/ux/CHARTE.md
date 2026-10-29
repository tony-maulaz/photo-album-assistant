# Charte graphique : « Table lumineuse »

**État : style FIGÉ (D110, 27.10.2026), avec les évolutions É1 à É10 acceptées le 28.10 (D111) et É11 acceptée le 29.10 ; dispositions PROVISOIRES.**

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
  (D104 levée sur ce point).
- **Dossier de la photo dans l'infobulle** et dans Comparer, plus sous chaque
  miniature (D96 levée sur ce point ; « rangée dans … » reste dans Comparer).
- À Doublons, menu **« Autres choix ▾ »** pour Tout écarter ; **« Tout
  garder » reste un bouton visible** et **« Garder plusieurs photos » une
  case visible** (jamais cachée, D101).
- Accepter une journée entière passe par une **fenêtre qui chiffre** ce qui
  sera écarté (« dont N où vous n'avez rien choisi »).
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

État du code (29.10) : É11 en cours d'application (étape 1 des retours du
29.10), pas encore commitée.

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
| C-1.4 | ✕ ✦ ▣ ◀ ≤ ≥ sont des **icônes SVG**, jamais des caractères | recherche de ces caractères dans les textes de `app/src` : 0 |
| C-1.5 | Milliers séparés par U+202F | `Intl.NumberFormat('fr-CH')` |

## C-2 Tailles et graisses

| N° | Règle | Test |
|---|---|---|
| C-2.1 | Quatre tailles : **14 / 16 / 20 / 24 px** (interlignes 20 / 24 / 28 / 32). Le titre d'étape fait 24 px **aux deux tailles d'écran**. L'accueil seul a 40 px | aucune `font-size` hors jetons |
| C-2.2 | **Rien sous 14 px** ; texte courant à 16 px ; boutons à 14 px, sauf « Revenir » et « Valider et continuer » à 16 px (É11) | minimum mesuré ≥ 14 sur toutes les pages |
| C-2.3 | Graisses 400 / 500 / 600 / 700 : 500 pour un bouton ordinaire et la barre du bas, 600 pour le plein dans la page, 700 pour les titres seulement, **jamais sur un bouton** (É11) ; aucune capitale de style | aucun `font-weight: 700` sur un `button` dans les CSS |
| C-2.4 | Titre d'étape au même pixel partout : (24, 62) à 1440×900, (24, 54) à 1280×580 | mesure Playwright |

## C-3 Couleurs : un neutre et cinq sens

| N° | Règle | Test |
|---|---|---|
| C-3.1 | Neutres clairs : fond #f6f5f2, surface #fff, **table #ebeae5**, mat #dddcd5, filets #dcdbd4 / #c4c2b9, contour #7e828a, texte #1c1d20 / #4b505a, **exemple #6b7079** (`--texte-exemple`, le texte d'exemple des champs seulement, C-10.7 ; É11) | jetons de `:root` seulement |
| C-3.2 | **Vert : agir, garder, fait.** Deux intensités : **plein** #0f766e = le bouton d'action, seulement ; **doux** #e1f0ec, texte #0b544e = un état (« À garder », filtre actif, segment allumé, point fait, journée ouverte). **Jamais sur un curseur** : `accent-color` est retiré des curseurs, gardé sur les cases à cocher (É11) | un seul élément au fond `--accent` visible par écran |
| C-3.3 | **Brun** #8f4508 sur #fcefe2 = reste à faire (« à accepter », « à vérifier », « Aperçu ») | — |
| C-3.4 | **Rouge** #b42318 = une perte possible, seulement | absent des pages où rien ne se perd |
| C-3.5 | **Ambre** #f2b01e = ★ dans l'album, seulement. **Aucune ★ ailleurs** (Doublons : « ✦ Conseillée par l'IA ») | aucune ★ hors Sélection, Album et leurs filtres |
| C-3.6 | **L'IA n'a pas de couleur** | aucun jeton `--ia`, aucun violet |
| C-3.7 | Texte ≥ 4,5:1, bord de commande ≥ 3:1, dans les deux thèmes, sur la surface et sur la table | `outils/contrastes.py` : tout « ok » |
| C-3.8 | Thème sombre = mêmes rôles, autres valeurs (fond #121315, surface #1b1d20, table #0e0f11, vert #4fc1b2 / doux #173a36 et #a7e3da, exemple #8b9099, la valeur de `--contour`). Il suit le système ; « Menu › Thème » le force | `prefers-color-scheme` et `data-theme` |
| C-3.9 | « Comparer en grand » : salle sombre neutre dans les deux thèmes (ardoise #2a2c30 en clair, #121316 en sombre) | — |
| C-3.10 | **Bleu doux = le bouton Aide, seulement** (É11) : fond #dbe6f9, texte et icône #1f4e96 (6,45:1), bord 1 px #5b85c9 (3,72:1) ; en sombre #1f3050, #b7d0f5 (8,36:1), #6f97d6 (5,69:1) ; jetons `--aide-doux`, `--aide-texte`, `--aide-bord`. Jamais en aplat foncé, jamais sur un lien ni sur ✦ (C-3.6), **aucun clignotement**. États : normal ; « à lire » = la pastille brune s'ajoute (C-3.3) jusqu'à la première ouverture de l'Aide de l'étape ; ouverte = filet intérieur de 2 px `--aide-texte`. Le même sur les deux boutons Aide (cadre commun et pages pas encore passées) ; il reste plus calme que le plein vert | un seul élément au fond `--aide-doux` par écran ; `contrastes.py` : les trois paires, dans les deux thèmes |

## C-4 Commandes

| N° | Règle | Test |
|---|---|---|
| C-4.1 | **Un seul bouton plein par écran : la prochaine action utile.** « Valider et continuer » ne devient plein qu'une fois l'étape finie | 1 plein visible (contrôle automatique) |
| C-4.2 | Un bouton d'action **dit ce qu'il fera** quand il écarte : « Accepter : garder 1, écarter 5 », le même libellé sur la page et dans Comparer. Une action groupée sur des groupes non ouverts passe par une fenêtre qui chiffre et dit « dont N où vous n'avez rien choisi » | — |
| C-4.3 | Hauteurs (É11) : **32** (bouton ordinaire, plein dans la page, segmenté, pastille de filtre) · **36** (« Revenir », « Valider et continuer ») · 28 (frise, bouton IA d'une ligne d'information, pastille « En essai ») ; cible ≥ 24 partout | mesure des boîtes |
| C-4.4 | Contour : bord 1 px `--contour`, rayon 8 ; Menu sans bord ; Aide bordé de bleu (C-3.10) ; le plein, un aplat vert sans autre marque (É11) | — |
| C-4.5 | Lien : vert foncé souligné, sans marge intérieure, ≥ 24 px de haut | — |
| C-4.6 | Aide IA : bouton contour + ✦ + prix (« environ 0,03 CHF ») ; portée écrite. Si le prix dépend d'un réglage, il est **recalculé en direct sur le bouton** (choix de l'utilisateur, 28.10) ; « … » seulement quand le prix ne peut être estimé qu'au lancement, il est alors dans la fenêtre avant de lancer | toute commande qui dépense a ✦ et un prix (ou « … ») |
| C-4.7 | Désactivé : bord en pointillé, texte gris, et sa raison écrite à côté ou dans la barre du bas | — |
| C-4.8 | Filtres d'état = pastilles dans la barre d'outils après « Afficher : », une seule forme sur toutes les pages ; **« Tous » allumé par défaut**. Réglage d'une liste de gauche = liste nommée. Onglets = soulignés, disent ce qui reste. Les trois ne se ressemblent pas | — |
| C-4.9 | Segmenté : la case allumée est l'état ; allumage doux et bordé (2 px), jamais plein | — |
| C-4.10 | Touches dans l'infobulle et l'Aide ; dans Comparer, rappel permanent « ↑ ↓ photo · ← → groupe », **à toutes les tailles** ; au large, le chemin le plus court en entier (« 1–N choisir · A accepter ») | `essai_charte.mjs` : rappel visible à 1440, 1280 et 1024 |
| C-4.11 | Revenir / Valider et continuer : 140 / 260 px au moins, même place partout | — |

## C-5 Icônes

| N° | Règle |
|---|---|
| C-5.1 | Un seul jeu SVG au trait (1,75, bouts arrondis), 16 px dans les boutons (É11 ; seule exception, la grande photo du curseur de taille, 22 px), 16 dans le texte, 14 dans une remarque ou une pastille. Aucun émoji |
| C-5.2 | Chaque icône a son mot (exceptions nommées pour les lecteurs d'écran : chevron « Replier », − / + ; au palier « texte agrandi » de Comparer, les chevrons de groupe et « Photo entière », leur nom dans l'infobulle et `aria-label`, accepté par l'utilisateur le 28.10 ; le curseur de taille et ses deux photos, « Photos plus petites » et « Photos plus grandes », sans le mot « Taille », choix de l'utilisateur du 29.10, É11) |
| C-5.3 | ✦ = IA, toujours avec un prix ou « … » ; ★ = album ; ✓ = garder, fait ; ✕ = écarter, Fermer |

## C-6 Espacements, rayons, ombres

| N° | Règle | Test |
|---|---|---|
| C-6.1 | Échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 ; marge de page 24, Comparer compris | jetons `--e1` à `--e7` |
| C-6.2 | **Bord tenu** : le dernier élément de chaque barre finit à ≥ 24 px du bord droit, vérifié avec le texte le plus long (étape 13, compteur « 12,40 », compteurs à 4 chiffres) | essai de charge de `capturer.mjs` |
| C-6.3 | **Proximité** : écart entre groupes ≥ 2 × écart dans un groupe ; deux contours ne se touchent jamais (≥ 4 px) | — |
| C-6.4 | Un seul bord de texte par colonne ; un fond de sélection peut déborder, le texte non | — |
| C-6.5 | Rayons 6 (photo, bande) · 8 (commande, É11) · 16 (groupe, dossier) · 999 (pastille) ; aucune ombre dans la page, une seule pour ce qui flotte | — |
| C-6.6 | Photos toujours sur la table ; un groupe = filet de 1 px (2 px vert pour le groupe en cours) ; seuls les « dossiers » sont des cartes blanches | — |

## C-7 Gabarits

| N° | Règle | Test |
|---|---|---|
| C-7.1 | **5 bandes de hauteur fixe** : 52/44, 76/52, 60/56, contenu, 64/56. Seul le contenu défile, chaque colonne de son côté ; aucune colonne ne défile en largeur | contrôles automatiques |
| C-7.2 | Barre de l'application : logo et projet · frise · « Étape n sur 13 ▾ » (sans le nom de l'étape) · ✦ IA · Aide · Menu | — |
| C-7.3 | Gabarit **Photos** : liste 248/232 avec vignettes et état sous la date ; table ; panneau 304/288 seulement s'il porte des actions. **Réduire le panneau ne cache jamais les décisions** (colonne de 224 px) | `selection-replie_*` |
| C-7.4 | Gabarit **Décisions** : « À faire ici » 440/420, numérotée. Point fait = une ligne + lien ; point en cours = titre, détail, choix, **bouton plein en dernier**, collé en bas de la colonne s'il ne tient pas ; sous 700 px de haut, les points faits se replient en « ✓ N points faits · Revoir ▾ » | Nommage et Tri à 1280 |
| C-7.5 | Vue **Comparer** : barres 48 / 32 / scène / 56. Présentation calculée (côte à côte si chaque photo y garde ≥ la moitié de sa surface en « Une à la fois », jamais sous 220 px de haut). « Une à la fois » : photo, légende à droite (220 px), bande de vignettes (1 colonne, 2 sous 700 px de haut ; toutes visibles jusqu'à 6). Côte à côte : cartes de la largeur de la photo, au moins celle de l'état et de ses choix (240 px ; 340 à la Sélection) ; c'est la rangée qui doit tenir. Choisi à la main : 2 ou 3 rangées si une ne tient pas, désactivé sous 80 px de haut. Une paire toujours côte à côte. Sous la carte : le choix, puis 2 lignes au plus (remarque, heure, dossier). Ligne d'information et titre passent à la ligne, jamais coupés. Ouverture sur la photo conseillée (IA ou la plus nette), sinon la première « À garder », sinon la 1 ; la réponse de « Choisir avec l'IA » y fait passer (choix de l'utilisateur). Le clavier entre dans la vue à l'ouverture et y reste ; ↑ ↓ le posent sur la carte, jamais sur un choix ; Entrée bascule partout sauf sur une commande (Fermer, Accepter…). ↑ ↓ photo, ← → groupe, dans la journée ou le dossier. Quitter : « Fermer » (Échap). Calcul : `app/src/lib/presentationComparer.ts` (proportions lues sur les miniatures, quart de tour compris) | mesures de `systeme.md` § 10 ; `essai_charte.mjs` à 2, 3, 4 et 6 photos (Doublons) et 3 (Sélection), à 1440, 1280 et 1024 ; ↓ puis Entrée ne change aucun état |
| C-7.6 | Palier « texte agrandi » (moins de 1180 px de large, soit 1280 à 125 %) : frise et nom du projet masqués, barre d'outils sur 2 lignes, en-têtes qui passent à la ligne ; rien ne défile en largeur | fenêtre de 1024×464 |

### C-7 du cadre commun (lot 4, PROVISOIRE, pages passées : Sélection, Doublons, et le Recadreur)

Une page passée au cadre porte `data-cadre="commun"` sur `.app` ; les autres
gardent l'ancien défilement (`data-cadre="ancien"`) jusqu'à leur tour.
Contrôle : `app/outils/essai_cadre.mjs`.

| N° | Règle | Test |
|---|---|---|
| C-7.1 (lot 4) | Bandes fixes : barre de l'application 52 / 44, en-tête d'étape 76 / 52, barre d'outils 60 / 56 / 52, contenu, barre du bas **64 / 56 / 56** (1440×900 ; sous 1440 px de large ou 700 px de haut ; palier). Seul le contenu défile, chaque colonne de son côté ; la page ne défile pas à 440 px de haut et plus | `essai_cadre.mjs` : titre, Annuler, Aide, Taille, barre du bas et Valider immobiles quand chaque colonne est menée à 50 % puis 100 % |
| C-7.1 bis | Le plein n'est jamais dans ce qui défile (tête de table, bloc fixe du panneau, barre du bas), ou bien il suit le dernier geste (Doublons) | un seul plein entier, non recouvert (`elementFromPoint`), à l'arrivée, à 50 % et à 100 % de chaque colonne |
| C-7.1 ter | À tout moment, ce que fait le plein se voit ou se lit. **À l'arrivée et après « Accepter »** (440 px de haut et plus), la bande « À garder » du groupe qui porte le plein est entière : après « Accepter », le groupe suivant vient en haut de la zone, au même y qu'à l'arrivée (une grande rafale dont la photo gardée est en bas descend jusqu'à sa bande, son en-tête collé en haut) ; après la molette, le libellé juste suffit (place et vignette ; aux Copies, le dossier, ou le fichier si deux exemplaires sont dans le même dossier). Le texte d'un plein n'est jamais rogné : il ne rétrécit pas, ce sont ses voisins qui cèdent (dans Comparer : « Photo entière » en icône sous 1440 px, puis le rappel des touches sur deux lignes, jamais coupé) | Doublons : bande entière à l'arrivée ; à chaque position, bande ou libellé ; `scrollWidth ≤ clientWidth` et texte dans sa boîte pour chaque plein, page et Comparer (rafale de 12), aux 3 tailles et aux 2 thèmes |
| C-7.1 quater (lot 4, Doublons) | Le plein est dans l'en-tête du groupe en cours, collé en haut de la zone qui défile (chaque en-tête pousse le précédent ; sous 440 px de haut, sous la tête de la table). **Le dernier geste gagne** : un clic, une touche ou le focus venu du clavier dans un groupe le rend « en cours », sur place, sans défilement ; après la molette, s'il est sorti de la vue, le plein passe au premier groupe dont on voit la bande « À garder » entière, à défaut à celui dont l'en-tête est collé en haut. A et C visent ce groupe, où que soit le focus, sauf dans un champ de texte ou un menu ouvert. Après « Accepter » — et après tout geste qui replie un groupe : « Tout garder », « Tout écarter », la section, l'onglet (tour 3) — le plein suivant ignore les clics, A et Entrée 0,5 s (il arrive en fondu), « Tout garder » et les photos du groupe suivant aussi ; une touche gardée enfoncée n'accepte qu'une fois, sur le plein comme sur une photo. Après « Accepter », si le focus était dans la table, il va sur la photo gardée du groupe qui prend le plein, jamais sur le plein : Espace y garde le sens « choisir », → passe à la photo d'à côté (tour 3). Une annulation qui rouvre un groupe de la page (Ctrl+Z, « Annuler » de l'en-tête ou du message) lui rend le plein et le montre en haut de la zone, comme après « Accepter » (tour 3). Fermer « Comparer en grand » rend le plein au dernier groupe regardé et le montre. Seul « Accepter » fait avancer la liste : le groupe accepté se replie à sa place, avec tous les filtres (D100 levée) ; le focus ne suit le plein que s'il était déjà dans la table. L'en-tête collé touche le bord haut de la zone (rien ne défile au-dessus de lui). Un seul groupe porte le filet vert : le focus n'en dessine pas un second | `essai_cadre.mjs`, essais de geste (clic dans un autre groupe puis A, double-clic au centre et à 20 px du bord droit du plein, double-clic sur « Tout garder » aux 3 tailles, clic sur une photo puis A, → et Espace (rien d'accepté), A puis Ctrl+Z (plein sur le groupe rouvert, au y d'arrivée, A le réaccepte), A deux fois, A et Entrée gardées 1,2 s, clic sur une photo du groupe suivant 150 ms après « Accepter », A cinq fois de suite aux 3 tailles, champ « Chercher » et molette, Tab puis A, retour de Comparer) ; en-tête collé au bord de la zone. Après un geste qui replie un groupe, rien de cliquable n'arrive à la place du plein : « Revoir » suit le texte de la ligne repliée et ignore les clics 0,5 s |
| C-7.3 bis (lot 4, Doublons) | Barre d'outils : les onglets (le nom, et dessous ce qui reste), puis le menu de l'onglet (« Toutes les copies ▾ », « ✦ Toutes les rafales ▾ ») ; le curseur de taille est dans l'en-tête d'étape (É11). Liste de gauche : en haut « Afficher » (« Tous » allumé par défaut), « Grouper et classer » replié (ouvert d'office par dossier ou par taille ; ouvert, chaque mot au-dessus de sa liste, les deux listes alignées et de la même largeur, tour 3), « Chercher » ; dessous les journées ou dossiers. Tête de la table : le titre de la section et son compte, le menu « Cette journée ▾ » (ou « Ce mois », « Ce dossier ») ; quand la section est finie, le plein « Suite à accepter : … › » ; quand l'onglet est fini (et sur « Mis de côté »), le plein « Rafales : 6 à accepter › » vers le prochain onglet qui reste ; tout accepté : « Valider et continuer » plein. Chaque en-tête de groupe sur une ligne (56 / 52 / 48 px au plus) : heure et titre, « Comparer en grand », le plein au bout à droite. Dessous : les photos, chacune avec sa place au début de sa bande (« 4 · À garder ») ; aux Copies, la photo une fois et une ligne par exemplaire. Ligne des boutons : « Garder plusieurs photos », « Tout garder », « Autres choix ▾ » (« Tout écarter »), l'état du groupe en mots, son dossier, et sur le dernier groupe « Journée suivante à accepter : … › ». Sous 700 px de haut, le défilement s'accroche au début des groupes (proximité) | Doublons |
| C-7.3 (lot 4) | Gabarit Photos : liste de gauche (largeur réglable), table, panneau de droite 304 / 288 « N photos choisies » ; sans photo choisie, « L'album » ; Aide 320 / 304 qui pousse le contenu | Sélection |
| C-7.6 (lot 4) | Palier : quand la largeur du contenu (Aide déduite) est de 1180 px ou moins, la liste de gauche devient un menu dans la tête de la table (le même panneau, en un seul exemplaire) ; frise et nom du projet masqués ; l'Aide ouverte prend la place du panneau de droite (les décisions restent au-dessus d'elle) ; rien ne défile en largeur | 1024×464 |
| C-7.6 bis | Écran très bas (moins de 440 px de haut) : la page défile en entier, la barre du bas reste fixe, la tête de la table et le haut du panneau (avec leur plein) collent en haut de la fenêtre ; la grille de photos suit le défilement de la fenêtre (une seule barre de défilement) | 1024×400 |

## C-8 Places fixes

| N° | Règle |
|---|---|
| C-8.1 | Aide puis Menu, en haut à droite, avec leur mot ; Aide en bleu doux bordé (C-3.10), Menu neutre sans bord (É11) ; avant eux « ✦ IA : x sur y CHF » |
| C-8.2 | « Annuler : *ce qu'il défait* » et « Rétablir » : en-tête d'étape (barre du haut dans Comparer). Le libellé reste entier à toutes les tailles |
| C-8.3 | **Curseur de taille** (É11, remplace « Taille − + ») : un seul composant sur toutes les pages, gris, sans le mot « Taille » (nom accessible « Taille des photos »). Aux bouts, l'icône `photo` en 16 et 22 px, dans deux boutons de 30 × 32 à bord 1 px `--filet-fort` visible dès le repos (« Photos plus petites », « Photos plus grandes » en infobulle et nom accessible), un cran au clic, grisés au bout avec leur raison. Curseur de 120 × 32 (piste de 96 px au palier) : piste 4 px `--contour`, partie parcourue `--texte-2`, poignée `--surface` bordée `--texte`, jamais vert. 12 crans de `PAS_TAILLE` (100 à 600) ; une taille enregistrée hors cran est ramenée au plus proche à l'affichage, sans toucher aux réglages ; ← → un cran, Origine, Fin ; `aria-valuetext` « 160 px ». Le réglage du flou de Floues prend la même encre neutre, à sa place (pas de mot « Taille » ni de petites photos, `data-action="tolerance"`) ; minimum : rangée de 120 px, case de 96 px |
| C-8.4 | **« Rien n'est supprimé… »** avec le bouclier, **seulement là où l'on écarte des photos** (choix de l'utilisateur, 28.10) : ligne 2 de la barre du bas des étapes Floues, Doublons, Tri, Lieux et sorties, Sortie ; ligne d'information de « Comparer en grand » des Doublons |
| C-8.5 | Ligne 1 de la barre du bas : ce que devient ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées ») |
| C-8.6 | Rien ne flotte : le retour se lit à la place du geste et dans « Annuler : … » ; une erreur reste jusqu'à un clic |

### C-8 du cadre commun (lot 4, PROVISOIRE, mêmes pages)

| N° | Règle |
|---|---|
| C-8.1 (lot 4) | « Aide » dans la barre de l'application, juste avant Menu (`data-place="aide"`) ; elle s'ouvre d'elle-même à la première visite d'une étape à partir de 1440 px de large ; en dessous, elle porte « à lire » (pastille brune) jusqu'à la première ouverture ; bleu doux, états de C-3.10 (É11) ; « Fermer » (avec le mot) ou Échap la ferment ; « Tout le mode d'emploi » en bas |
| C-8.2 (lot 4) | « Annuler : … » et « Rétablir » à droite de l'en-tête d'étape, Rétablir à 24 px du bord ; leur libellé suit chaque geste (« Annuler : accepter 1 rafale ») ; au palier, ils passent en 14 px avec la consigne, pour que l'en-tête garde sa hauteur d'un geste à l'autre (rien n'est coupé). Dans le Recadreur, un seul « Annuler » (une seule pile : réglages du cadre et quarts de tour) ; « Remettre la photo entière » dans la barre du bas, à gauche d'« Accepter le recadrage ». Contrôle : `essai_cadre.mjs` (libellé après un clic, « Accepter » et Ctrl+Z à Doublons, après deux décisions à la Sélection ; titre et barre d'outils au même y d'un geste à l'autre à 1024×464) |
| C-8.2 bis (lot 4, tours 2-3, provisoire) | Sur une page passée au cadre, « Annuler » et « Rétablir » de l'en-tête, Ctrl+Z et Ctrl+Y ne défont et ne refont qu'un geste fait à l'étape affichée ; sinon « Rien à annuler ici » / « Rien à rétablir ici », l'étape du dernier changement en infobulle, et la touche le dit par un message (choix 6 A ; « Y aller » au sous-lot 4a2). Un message venu d'une autre étape garde son propre « Annuler ». Un geste sans effet n'entre pas dans l'historique et ne vide pas « Rétablir » (Recadreur : format déjà choisi, photo déjà entière, « Accepter » sans changement). Un clic à la souris sur une décision ou un outil (Sélection, Recadreur) ne laisse pas le focus sur le bouton : Espace et Entrée gardent le sens de la page. Contrôle : `essai_cadre.mjs` (clic « Tourner » puis Espace : un quart de tour et les photos dans l'album ; clic « À droite » puis Entrée : le Recadreur se ferme ; « Déjà la photo entière » désactivé ; Ctrl+Z à l'arrivée sur la Sélection et sur Doublons après Floues : rien de défait, l'étape dite ; le message de Floues garde son lien « Annuler ») |
| C-8.3 (lot 4) | Le curseur de taille (C-8.3) dans l'en-tête d'étape, à la même place sur chaque page, à gauche d'« Annuler » tant qu'Annuler y est (sa place est à l'étude, hors É11) (`data-place="taille"`), de 100 à 600 px ; il quitte la barre d'outils de la Sélection et de Doublons (É11) |
| C-8.3 bis (lot 4, tours 2-3, provisoire) | Message passager d'une page passée au cadre : dans l'en-tête d'étape, à la place de la consigne (deux lignes au plus, entier en infobulle), jamais sur les photos, le plein ou la barre du bas ; le nombre qu'il annonce est compté avant le geste. Dans une vue en grand ou un dialogue, la bulle. La zone `role=status` est toujours dans l'arbre d'accessibilité : vide, elle est masquée à l'écran (`clip-path`), jamais `display: none` ; chaque message est un nouveau nœud (WCAG 4.1.3). Contrôle : `essai_cadre.mjs` (après chaque A, « N photos écartées » juste dans l'en-tête, aucune bulle sur la page ; zone `status` vide présente dans l'arbre d'accessibilité, lu par CDP) |
| C-8.4 (lot 4) | « Valider et continuer » au même pixel sur toutes les pages, passées au cadre ou non ; la ligne 1 de la barre du bas tient sur deux lignes au plus (14 px au palier), nombres à 4 chiffres compris |
| C-8.4 bis (lot 4) | Pages passées au cadre où l'on écarte (Doublons) : la phrase courte « Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». » (66 signes) ; « Vos photos d’origine ne bougent pas » dans son infobulle et dans l'Aide. La ligne 1 dit ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées. ») ; le compte des photos écartées est sur l'onglet « Mis de côté » |
| C-8.10 | **« En essai »** (É11) : pastille neutre, jamais brune ni verte (fond `--mat`, texte `--texte-2`, 14 px / 500, 28 px de haut, rayon 999, icône fiole de 14 px), juste après le titre d'une étape dont la présentation peut encore changer (aujourd'hui l'Album seul), et après son nom dans « Étape n sur 13 ▾ ». Après le titre, c'est un bouton qui ouvre sa bulle (survol, clic, clavier) : « Étape en essai » / « Cette étape marche, mais sa présentation peut encore changer. Vos réglages et vos choix sont gardés. » Jamais « bêta » |
| C-8.7 | Panneau de droite : une tête (« 3 photos choisies »), le bloc fixe des décisions (le plein n'y est qu'à la Sélection, la décision déjà prise est allumée), puis ce qui défile : les outils de la photo avec leur touche (« Ne plus choisir » en premier), et l'album |

## C-9 États des photos

| N° | Règle | Test |
|---|---|---|
| C-9.1 | **Un seul signal d'état, écrit dans une bande de 28 px sous la photo** ; rien sur l'image | aucun élément positionné sur une photo |
| C-9.2 | **Une bande n'a jamais la forme d'un bouton** : À garder = vert doux + filet vert de 3 px en haut ; À écarter / Pas pour l'album = blanc sans bord, texte gris ; Dans l'album = ambre clair + filet ambre ; Grande = ambre plein ; À décider = blanc, texte gris. Exception à Floues (utilisateur, 28.10) : « Nette : gardée » en gris, pour ne pas couvrir la page de vert | aucune bande au fond `--accent` ni au bord `--contour` |
| C-9.3 | **Aucune photo pâlie avant une décision de l'utilisateur** (groupe accepté, « Pas pour l'album ») ; exception à Floues (utilisateur, 28.10) : les photos sous le seuil sont pâlies, le réglage de tolérance est la décision | — |
| C-9.4 | Groupe pas encore accepté : pastille brune « à accepter » | — |
| C-9.5 | **Choisie** = anneau vert de 3 px dedans ; **focus** = noir 2 / jaune 3 / noir 2 dehors, `:focus-visible` seulement ; les deux se voient ensemble | capture Sélection |
| C-9.6 | Remarque sous la bande : 14 px, 2 lignes au plus, ✦ pour ce qui vient de l'IA ; Sélection : heure · signal · ✦ note ; marques ↻ ✂ ▣ au bout de la bande ; le texte entier, l'heure et le dossier sont dans l'infobulle et dans Comparer | — |
| C-9.7 | Ce qui quitte la miniature est **déplacé, jamais supprimé** : chaque badge du code a sa place écrite (remarque, bout de bande, infobulle, Comparer) | contrôle contre `badges` et `legende` des pages |

## C-10 Mots

| N° | Règle | Test |
|---|---|---|
| C-10.1 | Un verbe par portée : **Accepter** (un groupe, un nom, un rangement), **Valider et continuer** (l'étape) ; « Fermer » pour quitter une vue | aucun « valid » hors du bouton d'étape |
| C-10.2 | **Un état, un mot**, sur toute la page et dans la vue en grand : « à accepter » / « pas encore acceptés » | — |
| C-10.3 | Un compteur dit de quoi il parle ; pas de parenthèses ; les compteurs exclusifs s'additionnent, sinon « dont » | somme des pastilles = total |
| C-10.4 | Jamais de « … » de coupure sur la consigne, la bande, la remarque (sauf au-delà de 2 lignes) ou Annuler | contrôle « texte coupé » : 0 (`essai_charte.mjs` : bandes de toutes les pages, au plus petit curseur avec ↻ ; titre, ligne d'information, légende et vignettes de Comparer à 1440, 1280 et 1024 ; dans la légende de « Une à la fois », le texte mesuré ligne par ligne, pas la boîte : `essai_charte.mjs` et `essai_cadre.mjs`, « Garder plusieurs photos » à 1024×464, tour 3) |
| C-10.5 | Un libellé ne change pas avec la largeur ; on gagne la place ailleurs (menu « Plus ▾ », marges) | — |
| C-10.6 | « environ » plutôt que « ≈ » ; aucun « Ø » | — |
| C-10.7 | **Texte d'exemple** (É11) : un exemple de contenu commence par « Par exemple : » (majuscule) ; une consigne (« Chercher un événement ») n'en prend pas, ni une proposition de l'IA ou un format. Jamais d'italique (la police n'a pas d'italique, C-1.1). Un exemple court (« Par exemple : vacances au bord de la mer, juillet 2026 »). Couleur `--texte-exemple`, champ sur `--surface`. S'il ne tient pas dans le champ, il passe dessous, en aide, sur la même ligne que l'aide qui y est déjà | `contrastes.py` : exemple ≥ 4,5:1 sur le fond réel de chaque champ et écart ≥ 2,5:1 avec le texte tapé, dans les deux thèmes ; aucun `font-style: italic` sur `::placeholder` ; aucun « par exemple » en minuscule en tête d'exemple |

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

