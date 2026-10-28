# Charte graphique : « Table lumineuse »

**État : style FIGÉ (D110, 27.10.2026) ; dispositions PROVISOIRES.**

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
| C-2.2 | **Rien sous 14 px** ; texte courant et boutons à 16 px | minimum mesuré ≥ 14 sur toutes les pages |
| C-2.3 | Graisses 400 / 600 / 700 ; aucune capitale de style | — |
| C-2.4 | Titre d'étape au même pixel partout : (24, 62) à 1440×900, (24, 54) à 1280×580 | mesure Playwright |

## C-3 Couleurs : un neutre et quatre sens

| N° | Règle | Test |
|---|---|---|
| C-3.1 | Neutres clairs : fond #f6f5f2, surface #fff, **table #ebeae5**, mat #dddcd5, filets #dcdbd4 / #c4c2b9, contour #7e828a, texte #1c1d20 / #4b505a | jetons de `:root` seulement |
| C-3.2 | **Vert : agir, garder, fait.** Deux intensités : **plein** #0f766e = le bouton d'action, seulement ; **doux** #e1f0ec, texte #0b544e = un état (« À garder », filtre actif, segment allumé, point fait, journée ouverte) | un seul élément au fond `--accent` visible par écran |
| C-3.3 | **Brun** #8f4508 sur #fcefe2 = reste à faire (« à accepter », « à vérifier », « Aperçu ») | — |
| C-3.4 | **Rouge** #b42318 = une perte possible, seulement | absent des pages où rien ne se perd |
| C-3.5 | **Ambre** #f2b01e = ★ dans l'album, seulement. **Aucune ★ ailleurs** (Doublons : « ✦ Conseillée par l'IA ») | aucune ★ hors Sélection, Album et leurs filtres |
| C-3.6 | **L'IA n'a pas de couleur** | aucun jeton `--ia`, aucun violet |
| C-3.7 | Texte ≥ 4,5:1, bord de commande ≥ 3:1, dans les deux thèmes, sur la surface et sur la table | `outils/contrastes.py` : tout « ok » |
| C-3.8 | Thème sombre = mêmes rôles, autres valeurs (fond #121315, surface #1b1d20, table #0e0f11, vert #4fc1b2 / doux #173a36 et #a7e3da). Il suit le système ; « Menu › Thème » le force | `prefers-color-scheme` et `data-theme` |
| C-3.9 | « Comparer en grand » : salle sombre neutre dans les deux thèmes (ardoise #2a2c30 en clair, #121316 en sombre) | — |

## C-4 Commandes

| N° | Règle | Test |
|---|---|---|
| C-4.1 | **Un seul bouton plein par écran : la prochaine action utile.** « Valider et continuer » ne devient plein qu'une fois l'étape finie | 1 plein visible (contrôle automatique) |
| C-4.2 | Un bouton d'action **dit ce qu'il fera** quand il écarte : « Accepter : garder 1, écarter 5 », le même libellé sur la page et dans Comparer. Une action groupée sur des groupes non ouverts passe par une fenêtre qui chiffre et dit « dont N où vous n'avez rien choisi » | — |
| C-4.3 | Hauteurs : **44** (plein, barre du bas) · 40 (standard) · 36 (pastille) · 28 (frise, bouton IA d'une ligne d'information) ; cible ≥ 24 partout | mesure des boîtes |
| C-4.4 | Contour : bord 1,5 px `--contour`, rayon 10 | — |
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
| C-5.1 | Un seul jeu SVG au trait (1,75, bouts arrondis), 20 px dans les boutons, 16 dans le texte, 14 dans une remarque. Aucun émoji |
| C-5.2 | Chaque icône a son mot (exceptions nommées pour les lecteurs d'écran : chevron « Replier », − / + ; au palier « texte agrandi » de Comparer, les chevrons de groupe et « Photo entière », leur nom dans l'infobulle et `aria-label`, accepté par l'utilisateur le 28.10) |
| C-5.3 | ✦ = IA, toujours avec un prix ou « … » ; ★ = album ; ✓ = garder, fait ; ✕ = écarter, Fermer |

## C-6 Espacements, rayons, ombres

| N° | Règle | Test |
|---|---|---|
| C-6.1 | Échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 ; marge de page 24, Comparer compris | jetons `--e1` à `--e7` |
| C-6.2 | **Bord tenu** : le dernier élément de chaque barre finit à ≥ 24 px du bord droit, vérifié avec le texte le plus long (étape 13, compteur « 12,40 », compteurs à 4 chiffres) | essai de charge de `capturer.mjs` |
| C-6.3 | **Proximité** : écart entre groupes ≥ 2 × écart dans un groupe ; deux contours ne se touchent jamais (≥ 4 px) | — |
| C-6.4 | Un seul bord de texte par colonne ; un fond de sélection peut déborder, le texte non | — |
| C-6.5 | Rayons 6 (photo, bande) · 10 (commande) · 16 (groupe, dossier) · 999 (pastille) ; aucune ombre dans la page, une seule pour ce qui flotte | — |
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

## C-8 Places fixes

| N° | Règle |
|---|---|
| C-8.1 | Aide puis Menu, en haut à droite, avec leur mot ; avant eux « ✦ IA : x sur y CHF » |
| C-8.2 | « Annuler : *ce qu'il défait* » et « Rétablir » : en-tête d'étape (barre du haut dans Comparer). Le libellé reste entier à toutes les tailles |
| C-8.3 | « Taille − + » au bout de la barre d'outils ; minimum : rangée de 120 px, case de 96 px |
| C-8.4 | **« Rien n'est supprimé… »** avec le bouclier, **seulement là où l'on écarte des photos** (choix de l'utilisateur, 28.10) : ligne 2 de la barre du bas des étapes Floues, Doublons, Tri, Lieux et sorties, Sortie ; ligne d'information de « Comparer en grand » des Doublons |
| C-8.5 | Ligne 1 de la barre du bas : ce que devient ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées ») |
| C-8.6 | Rien ne flotte : le retour se lit à la place du geste et dans « Annuler : … » ; une erreur reste jusqu'à un clic |

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
| C-10.4 | Jamais de « … » de coupure sur la consigne, la bande, la remarque (sauf au-delà de 2 lignes) ou Annuler | contrôle « texte coupé » : 0 (`essai_charte.mjs` : bandes de toutes les pages, au plus petit curseur avec ↻ ; titre, ligne d'information, légende et vignettes de Comparer à 1440, 1280 et 1024) |
| C-10.5 | Un libellé ne change pas avec la largeur ; on gagne la place ailleurs (menu « Plus ▾ », marges) | — |
| C-10.6 | « environ » plutôt que « ≈ » ; aucun « Ø » | — |

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

