# Recherche : bonnes pratiques UI/UX, avec sources

Recherche documentaire de l'audit D108. Les règles du projet qui en découlent
sont dans `docs/GUIDE_UX.md` ; ce document garde le détail, les exemples
d'applications réelles et les sources.

Contexte visé : application de bureau dans Chrome/Edge (écran 1280 à 1920 px),
utilisateur de la famille non informaticien, 13 étapes guidées de tri de
photos, aperçu modifiable avant chaque validation, aides IA facultatives.

Recherche faite le 26-27 octobre 2026 ; 50 sources consultées (liste au § 16).

## Mode d'emploi du guide

- Chaque règle est **impérative et vérifiable sur une capture d'écran**
  (ou en manipulant l'écran quelques secondes).
- Marquage :
  - **[C]** = *consensus* : la règle est écrite (ou montrée) par au moins
    une source de référence (NN/g, Apple, Microsoft, GOV.UK, W3C…), et je
    n'ai trouvé aucune source qui la contredise.
  - **[C~]** = *consensus avec divergence* : les sources sont d'accord sur
    le fond mais pas sur un détail (je le précise).
  - **[A]** = *mon avis* : adaptation au projet, déduction, ou choix entre
    sources qui divergent. À discuter, ce n'est pas une norme.
- Les exemples « ce que font les applications » viennent de leur
  documentation officielle ou de tutoriels d'auteurs reconnus (Julieanne Kost
  pour Adobe). Quand je n'ai pu vérifier un fait que par une source
  secondaire, c'est écrit « (source secondaire) ».

---

## 1. Structure d'écran stable

**Ce que font réellement les applications**

| Application | Barre principale | Curseur de taille des miniatures | Panneau d'infos / réglages | Aide |
|---|---|---|---|---|
| Lightroom Classic | Barre d'outils **sous** la grille (touche T) ; ses outils changent selon la vue | **Dans la barre d'outils, extrémité droite** (« Thumbnails ») ; aussi touches `-` et `+` | Panneaux latéraux gauche (navigation) et **droit** (réglages de la photo) | Menu Aide |
| digiKam | Barre d'outils en haut | **Barre d'état, en bas à droite** (curseur loupe) ; règle aussi la taille de l'aperçu | **Barre latérale droite** à onglets : Propriétés, Métadonnées, Couleurs, Carte… | Menu Aide |
| Apple Photos (Mac) | Barre d'outils en haut ; une seule action principale « Terminé » à droite en mode édition | Curseur « Zoom » dans la barre d'outils ; aussi pincement | Fenêtre Infos (⌘I) ; en édition, réglages dans la **barre latérale droite** | Menu Aide |
| Aftershoot | Filtres en haut ; icônes de vue en haut à gauche | (non documenté) | Panneau « Cull Filters » **à droite** | Icône clavier qui liste les raccourcis |

Constat : aucune de ces applications ne met le curseur de taille au même
endroit qu'une autre, **mais chacune le garde au même endroit dans toutes ses
vues** et le colle au bord **droit (fin de ligne)** d'une barre attachée à la
grille.

**Règles**

- **R1.1 [C]** Chaque écran a exactement la même ossature : barre du haut
  (titre de l'étape + progression + aide), zone de contenu, barre d'actions.
  Aucun écran n'ajoute ou ne déplace une de ces zones.
  *Ex.* Apple : éléments de navigation à gauche, titre, actions communes au
  centre, action principale et boutons d'inspecteur **à droite**, « visibles à
  toutes les tailles de fenêtre ».
  *Sources* : Apple HIG Toolbars ; NN/g heuristique 4 « Consistency and
  standards » ; Laws of UX, Jakob.
- **R1.2 [C]** L'action principale de l'écran (« Valider… », « Continuer… »)
  est **unique**, mise en évidence (couleur d'accent) et toujours au même
  endroit d'un écran à l'autre.
  *Ex.* Apple : « Only specify one primary action, and put it on the trailing
  side of the toolbar » ; GOV.UK : un seul bouton par défaut par page ; Apple
  Photos : « Terminé » à droite en édition.
  *Sources* : Apple HIG Toolbars, Apple HIG Buttons (« one or two prominent
  buttons per view »), GOV.UK Button.
- **R1.3 [C~]** Le curseur de taille des miniatures est dans une barre
  attachée à la grille, **côté droit**, au même endroit sur toutes les pages
  qui montrent une grille, et doublé des raccourcis `-` / `+`.
  *Divergence* : en bas pour Lightroom (barre d'outils) et digiKam (barre
  d'état), en haut pour Apple Photos.
  **[A]** Pour cette application : **en haut à droite de la grille**, dans la
  barre de la grille, parce que la barre du bas porte la validation et que
  l'utilisateur novice regarde d'abord en haut.
  *Sources* : jkost.com (Grid view Lightroom) ; docs.digikam.org (Image view) ;
  Apple Photos (pht56eafa987).
- **R1.4 [C]** Le réglage de taille des miniatures est **mémorisé** et
  commun à toutes les étapes (on ne le refait pas à chaque écran).
  *Ex.* Lightroom et digiKam : réglage global de la vue, pas par dossier.
  *Sources* : idem R1.3 ; NN/g heuristique 7 (personnalisation).
- **R1.5 [C]** L'aide a une **porte d'entrée permanente**, au même endroit
  sur tous les écrans (bouton « Aide » ou « ? » avec libellé), en plus de
  l'aide contextuelle.
  *Ex.* NN/g : « provide a persistent entry point in the UI so users who
  ignored earlier help can find it later » ; Apple : bouton d'aide rond,
  de taille constante, sans texte d'introduction.
  *Sources* : NN/g Help and documentation ; Apple HIG Buttons (Help buttons).
- **R1.6 [C]** L'aide utile au moment présent est **visible sur l'écran**
  (une phrase sous le titre), pas cachée dans une infobulle : « keep critical
  information out of tooltips ».
  *Sources* : NN/g Tooltip guidelines ; NN/g heuristique 10.
- **R1.7 [C]** Rien d'important n'est placé tout en bas d'un panneau
  latéral (il peut sortir de l'écran).
  *Source* : Apple HIG Sidebars (« Avoid putting critical information or
  actions at the bottom of a sidebar »).
- **R1.8 [C]** Le titre de l'écran dit ce que l'on fait ici (pas le nom de
  l'application) et reste court.
  *Ex.* Apple : « Don't title windows with your app name », titre < 15
  caractères ; GOV.UK : un titre propre à chaque page, jamais réutilisé.
  *Sources* : Apple HIG Toolbars ; GOV.UK Question pages.
- **R1.9 [C]** Pas plus de **trois groupes** de commandes dans une barre.
  *Source* : Apple HIG Toolbars (« aim for a maximum of three »).
- **R1.10 [A]** À 1280 px de large, la barre du haut, la grille (au moins
  4 colonnes) et le panneau de détails tiennent ensemble sans défilement
  horizontal ; le panneau se replie avant que la grille ne descende sous
  4 colonnes.
  *Appui* : Apple HIG Split views (largeurs minimales de volets) et Layout
  (« Keep functionality the same as size classes change »).

---

## 2. Assistant en étapes (stepper)

**Ce que font réellement les applications**

- CEWE : un « Assistant » en six étapes qui produit une **proposition**
  (répartition des photos sur les pages) que l'on modifie ensuite à la main ;
  check-list de relecture avant commande (cases vides, alignement, résolution,
  orthographe, couverture, dos).
- GOV.UK : lien « Retour » en haut de chaque page, bouton « Continuer »,
  page « Vérifiez vos réponses » avec un lien « Modifier » par réponse, puis
  bouton nommé par l'action (« Accepter et envoyer »).
- Carbon (IBM) : indicateur d'étapes avec états *terminé* (coche), *en
  cours*, *pas commencé*, *erreur*, libellés de 1 à 2 mots verbe + nom.

**Règles**

- **R2.1 [C]** La liste complète des étapes est visible, l'étape courante
  est mise en évidence et les étapes terminées portent une coche.
  *Sources* : NN/g Wizards (« show the full process… current step
  highlighted… clearly mark completed steps ») ; Carbon Progress indicator.
- **R2.2 [C]** Les états de l'indicateur ne reposent pas sur la couleur
  seule : coche pour « terminé », forme pleine/demi-pleine pour « en cours »,
  icône pour « erreur ».
  *Sources* : Carbon ; WCAG 1.4.11 (états d'un composant à 3:1) ; NN/g Visual
  hierarchy (« Don't rely on color alone »).
- **R2.3 [C]** Chaque étape a un libellé court commençant si possible par un
  verbe (« Repérer les floues », « Nommer les dossiers »).
  *Sources* : Carbon (« one or two words… verb + noun ») ; GOV.UK Task list
  (« Start task names with a verb »).
- **R2.4 [C]** Un bouton « Retour » (ou « Étape précédente ») est toujours
  présent et ramène **à l'état laissé**, sans perte.
  *Sources* : NN/g Wizards ; NN/g User control and freedom (« A Back control
  should go to the previous screen, not cancel the whole flow ») ; GOV.UK
  Question pages.
- **R2.5 [C~]** Le bouton d'avancée dit **où il mène ou ce qu'il fait**.
  *Divergence* : NN/g préfère nommer l'étape suivante plutôt que « Next » ;
  GOV.UK impose « Continue » (et « Save and continue » si l'on enregistre).
  **[A]** Ici : « Valider et continuer → Doublons » (verbe + destination),
  parce que l'étape enregistre un choix.
  *Sources* : NN/g Wizards ; NN/g UI copy ; GOV.UK Button.
- **R2.6 [C]** Avant toute action qui écrit ou déplace des fichiers, un
  écran **récapitule** ce qui va se passer, avec un lien « Modifier » à côté
  de chaque élément ; le bouton final nomme l'action.
  *Ex.* GOV.UK « Check answers » ; CEWE : check-list avant commande.
  *Sources* : GOV.UK Check answers ; CEWE Creator software guide.
- **R2.7 [C]** Après une modification depuis le récapitulatif, l'utilisateur
  revient **au récapitulatif**, pas au début du parcours.
  *Source* : GOV.UK Check answers.
- **R2.8 [C]** On peut quitter à mi-parcours et reprendre plus tard au même
  point.
  *Sources* : NN/g Wizards (« Saving and resuming ») ; GOV.UK Task list
  (« finish over more than one session »).
- **R2.9 [C]** Une étape n'est déclarée « terminée » que par une action de
  l'utilisateur ; les étapes qu'on ne peut pas encore faire sont marquées
  « Pas encore possible » et ne sont pas cliquables.
  *Source* : GOV.UK Task list (« Cannot start yet », pas de lien).
- **R2.10 [C]** Chaque étape se suffit à elle-même : l'utilisateur n'a pas
  besoin de se souvenir d'une information vue deux écrans plus tôt.
  *Sources* : NN/g Wizards (« make each step self-sufficient ») ; NN/g
  heuristique 6.
- **R2.11 [A]** Avec 13 étapes, l'indicateur est **vertical** (colonne de
  gauche) ou regroupé en 4-5 phases ; un indicateur horizontal de 13 cercles
  à 1280 px oblige à tronquer les libellés.
  *Appui* : Carbon (« Vertical is preferred when possible because it is
  easier to read ») ; NN/g Progressive disclosure (regroupement).
- **R2.12 [C]** Les erreurs sont signalées **sur l'étape et à l'endroit du
  problème**, avec la marche à suivre, pas dans une fenêtre modale.
  *Sources* : Carbon ; NN/g Modal vs nonmodal (« Errors in forms should
  appear on the page next to the problem »).

---

## 3. Grilles de miniatures

**Ce que font réellement les applications**

- Lightroom : taille par curseur + `-`/`+` ; styles de cellule (touche J :
  sans extras / compact / étendu) ; **badges en bas à droite** de la miniature
  (recadrée, retouchée, mots-clés, GPS) ; badges masqués si la miniature est
  trop petite ; les photos rejetées sont **estompées**, pas supprimées.
- Aftershoot : une pile de doublons porte une **icône de pile + un nombre
  en haut à droite** ; `,` et `.` font défiler la pile.
- digiKam : au survol, icônes « pivoter » et « plein écran » sur la
  miniature + infobulle de propriétés.
- Google Photos : photos similaires regroupées en « piles » avec une
  « photo choisie » (*top pick*) modifiable ; actions « Définir comme photo
  choisie », « Retirer de la pile », « Garder 1, supprimer le reste ».
- Blurb (source secondaire) : coche violette sur les photos déjà utilisées
  dans le livre.

**Règles**

- **R3.1 [C]** La taille des miniatures se règle par un curseur visible
  **et** au clavier ; elle s'applique immédiatement (aperçu en direct).
  *Sources* : jkost.com Grid view ; docs.digikam.org.
- **R3.2 [C]** Les états importants d'une photo (gardée, écartée, doublon,
  floue, déjà utilisée dans l'album) sont des **badges visibles sans survol**,
  toujours au même coin.
  *Ex.* Lightroom (badges en bas à droite), Aftershoot (pile en haut à
  droite), Blurb (coche « déjà utilisée »).
  *Sources* : jkost.com ; support.aftershoot.com ; comparably.com (Blurb,
  secondaire).
- **R3.3 [C]** Une photo écartée reste visible dans la grille, **estompée**
  (ou dans un groupe « Mis de côté ») ; elle n'est jamais supprimée par le
  simple fait d'être rejetée.
  *Ex.* Lightroom : le rejet grise la miniature, la photo reste sur le disque.
  *Sources* : jkost.com (flags) ; havecamerawilltravel.com (secondaire).
- **R3.4 [C]** Les actions d'une miniature ne sont **jamais uniquement au
  survol** : le survol peut les raccourcir, mais elles existent aussi dans le
  panneau de détails, le menu contextuel ou au clavier.
  *Sources* : NN/g Icon usability (le survol « adds interaction cost ») ;
  brouillon W3C « Visible controls » ; NN/g Timing exposing content.
- **R3.5 [C]** La sélection se voit par un **contour épais et une coche**
  (pas seulement une teinte), avec un contraste d'au moins 3:1.
  *Sources* : WCAG 2.2 SC 1.4.11 (états « selected » à 3:1) ; Apple HIG
  Split views (« persistently highlight the current selection »).
- **R3.6 [C]** Sélection multiple standard : clic, Ctrl/⌘+clic, Maj+clic
  pour une plage, Ctrl/⌘+A ; le **nombre de photos sélectionnées** est
  affiché en permanence.
  *Sources* : PatternFly Bulk selection (compteur mis à jour à chaque
  changement) ; Google Photos (Maj+clic, source secondaire).
- **R3.7 [C~]** Rognage des miniatures : les grilles de tri utilisent des
  cases **carrées et uniformes** (alignement parfait, comparaison rapide) ;
  les vues de lecture préfèrent la mise en page justifiée sans rognage.
  *Divergence* : une grille justifiée « no cropping, no reordering, no
  holes » rapetisse les portraits et rend les lignes irrégulières.
  **[A]** Pour trier (floues, doublons, sélection) : cases carrées en
  *contain* (photo entière, bandes neutres) pour que l'on juge le cadrage ;
  *cover* seulement pour des vignettes représentatives de dossiers.
  *Sources* : blog.vjeux.com (mise en page à la Google+) ; GNOME HIG Grid
  views (contour de cellule seulement si les images varient en forme) ;
  Apple HIG Image views (taille cohérente).
- **R3.8 [C]** Espacement de la grille **constant** (gouttière multiple de
  4 px) ; légendes alignées à gauche ou centrées, jamais mélangées.
  *Sources* : Apple HIG Layout (« Use consistent spacing… otherwise it no
  longer looks like a grid ») ; Fluent 2 Layout.
- **R3.9 [C]** Pendant le chargement, chaque case garde sa place
  (rectangle gris de la bonne taille), sans décalage de la grille ; au-delà
  de 10 s, une barre de progression chiffrée (« 312 / 1 450 photos »).
  *Sources* : NN/g Skeleton screens ; NN/g Progress indicators.
- **R3.10 [C]** Les groupes (doublons, rafales) ont une **photo choisie**
  mise en avant et modifiable en un clic ; les autres restent consultables.
  *Ex.* Google Photos (piles, *top pick*) ; Apple Photos (album Doublons,
  « Fusionner » garde un original, les autres vont dans « Supprimés
  récemment », récupérables) ; Aftershoot (piles).
  *Sources* : support.google.com/photos/answer/14169846 ; Apple Photos
  (pht5a3157c1d) ; support.aftershoot.com.
- **R3.11 [A]** Taille minimale utile d'une miniature pour juger le flou ou
  une rafale : ~160 px ; la valeur par défaut de l'étape « Floues » est plus
  grande que celle de l'inventaire. Le curseur reste le même, seule la valeur
  initiale change.

---

## 4. Panneau de détails (inspecteur)

**Ce que font réellement les applications**

- Apple : l'inspecteur est sur le **bord droit** (*trailing*), son bouton
  est en fin de barre d'outils, et il **se met à jour quand la sélection
  change** ; préférer curseurs et cases plutôt que des champs à taper.
- digiKam : barre latérale droite à onglets (Propriétés, Métadonnées,
  Couleurs, Carte, Légendes…).
- Lightroom : panneau droit avec réglages de la photo active ; badges
  cliquables qui ouvrent le panneau correspondant.
- Aftershoot : panneau des doublons sous « Key Faces », filtres à droite.

**Règles**

- **R4.1 [C]** Le panneau de détails est **à droite**, toujours au même
  endroit, et montre la photo (ou le groupe) sélectionnée ; il se met à jour
  à chaque changement de sélection.
  *Sources* : Apple HIG Panels (« An inspector displays the details of the
  currently selected item, automatically updating ») ; Apple HIG Toolbars
  (boutons d'inspecteur côté droit) ; docs.digikam.org.
- **R4.2 [C]** Le panneau est **collant** : il reste visible quand on fait
  défiler la grille ; aucun bouton du panneau ne sort de l'écran à 1280×720.
  *Sources* : Apple HIG Sidebars (rien de critique en bas) ; WCAG 2.2 SC
  2.4.11 (un élément focalisé ne doit pas être masqué par un contenu collant).
- **R4.3 [C]** Le panneau ne contient que des actions **sur la sélection** ;
  les actions générales de l'étape restent dans la barre d'actions.
  *Sources* : Apple HIG Panels ; Microsoft Commanding basics (commandes près
  des objets qu'elles affectent).
- **R4.4 [C]** Sans sélection, le panneau affiche un **état vide utile**
  (« Cliquez sur une photo pour voir ses détails ») plutôt que de
  disparaître et de faire sauter la mise en page.
  *Sources* : PatternFly / Salesforce (état vide = ce que c'est, pourquoi,
  quoi faire) ; Apple HIG Split views (« display the most relevant detail
  view »).
- **R4.5 [C]** Avec plusieurs photos sélectionnées, le panneau dit « 12
  photos sélectionnées » et propose les actions groupées ; il ne montre pas
  les détails de la seule première.
  *Source* : PatternFly Bulk selection.
- **R4.6 [C]** Le panneau peut se replier par un bouton visible **et** un
  raccourci ; replié, un bouton le rouvre au même endroit.
  *Source* : Apple HIG Split views (« Provide multiple ways to reveal hidden
  panes »).
- **R4.7 [A]** Ordre dans le panneau : 1) aperçu moyen, 2) statut et
  boutons de décision (Garder / Mettre de côté), 3) informations (date,
  lieu, dossier), 4) aides IA, 5) détails techniques repliés.

---

## 5. Visionneuse plein écran et outils

**Ce que font réellement les applications**

- Lightroom : Loupe (E), Comparer 2 photos (C : « Select » et « Candidate »,
  flèche bas pour échanger), Survol de plusieurs (N : retirer une photo par
  le X au survol), avant/après (`\`), infos en surimpression (I).
- Lightroom, recadrage (R) : **recadrage, angle, « Auto », verrou de
  proportions et grille au même endroit** ; tirer hors du cadre pour faire
  pivoter ; Entrée applique, Échap annule ; « Réinitialiser » au clic droit.
- Apple Photos : en mode Recadrer, **Auto, proportions, Retourner,
  orientation, curseurs Redresser / Vertical / Horizontal, Réinitialiser**
  sont réunis ; « Terminé » ou Entrée pour valider ; maintenir M pour voir
  l'original ; « Revenir à l'original » à tout moment. Le bouton Pivoter
  (90°) est dans la barre d'outils d'édition (Option-clic = autre sens).
- Google Photos : l'outil Recadrer réunit proportions, **Pivoter (90°),
  cadran de redressement**, Auto ; « Enregistrer une copie » préserve
  l'original.
- Aftershoot : Loupe avec bande de miniatures en bas ; mode Survey pour
  comparer des doublons côte à côte.

**Règles**

- **R5.1 [C]** Recadrer, redresser et pivoter de 90° sont **dans le même
  outil**, avec un bouton « Auto » (redressement automatique) et un bouton
  « Réinitialiser ».
  *Sources* : Apple Photos (crop, pht13f0918f0) ; Google Photos Edit
  (6128850) ; jkost.com Crop.
- **R5.2 [C]** L'outil s'ouvre en un clic, se valide par un bouton
  « Terminé » (et Entrée), s'abandonne par « Annuler les modifications »
  (et Échap), sans rien perdre d'autre.
  *Sources* : Apple Photos Editing basics ; jkost.com Crop.
- **R5.3 [C]** L'original est toujours récupérable (« Revenir à
  l'original ») et comparable d'un geste (maintenir une touche ou un bouton).
  *Sources* : Apple Photos Editing basics (touche M, « Revert to Original ») ;
  Lightroom avant/après (`\`).
- **R5.4 [C]** Navigation : flèches gauche/droite pour la photo
  précédente/suivante, Échap pour fermer ; boutons **visibles** pour chacune
  de ces actions (flèches à l'écran, bouton « Fermer » avec libellé en haut à
  droite).
  *Sources* : NN/g User control and freedom (« Place Close where users
  expect it… Use "Close" instead of a bare X ») ; SAP Fiori Lightbox (bouton
  de fermeture obligatoire) ; Narrative / Aftershoot (flèches).
- **R5.5 [C]** La comparaison côte à côte existe pour 2 photos (une
  « retenue », une « candidate », échange en un geste) et pour un petit
  groupe (retirer une photo du groupe d'un clic).
  *Sources* : jkost.com Compare and Survey ; support.aftershoot.com (Survey).
- **R5.6 [C]** Dans la visionneuse, les décisions de tri (Garder /
  Mettre de côté) restent accessibles par boutons et raccourcis, comme dans la
  grille.
  *Source* : Adobe Lightroom Browse and compare (drapeaux sous chaque photo
  en Comparer et Survol).
- **R5.7 [C]** Les surimpressions sur l'image sont lisibles (fond ou ombre)
  et ne couvrent pas la zone utile ; elles peuvent se masquer.
  *Sources* : Apple HIG Image views (« Take care when overlaying text on
  images ») ; demande d'utilisateurs Adobe contre le message d'annulation qui
  couvre le bas de la photo (community.adobe.com).
- **R5.8 [A]** Le redressement ne se fait jamais au seul glisser de la
  souris : il a aussi un **curseur gradué** (± 45°) avec valeur affichée et
  boutons − / +, pour l'utilisateur peu à l'aise avec la souris.
  *Appui* : GOV.UK (éviter le glisser seul, offrir une autre méthode) ;
  WCAG 2.2 SC 2.5.7 (alternative au glisser).

---

## 6. Tri rapide (culling)

**Ce que font réellement les applications**

| Application | Garder | Écarter | Neutre / à revoir | Avance auto |
|---|---|---|---|---|
| Lightroom Classic | P (Pick) | X (Reject) | U (Unflag) | Verr. Maj ou Maj+touche |
| Narrative Select | T (Tag) / étoiles | X (Reject) | U (Untag) | option du menu Rate |
| Photo Mechanic | T (Tag) | — (classes de couleur 0-8) | — | préférence « Auto advance » |
| Aftershoot | P (My Selections) | — | groupes « Maybe », « For Review » | — |

Constat : **P/X/U** (Lightroom) est le vocabulaire le plus répandu ; toutes
proposent l'avance automatique ; les outils IA classent en « sélection /
peut-être / à revoir (flou, yeux fermés) » mais laissent l'utilisateur
décider.

**Règles**

- **R6.1 [C]** Trois états seulement, nommés en mots simples : **Garder**,
  **Mettre de côté**, **À revoir** (état initial). Pas de notes, couleurs et
  drapeaux cumulés pour un novice.
  *Sources* : NN/g Progressive disclosure ; Laws of UX, Hick ; Lightroom
  (pick / reject / unflagged) ; Aftershoot (« Maybe », « For Review »).
- **R6.2 [C]** Une décision = **un geste** (une touche ou un clic), et la
  photo suivante s'affiche (avance automatique, désactivable).
  *Sources* : jkost.com Flags (Caps Lock) ; Narrative shortcuts ; Photo
  Mechanic (Auto advance).
- **R6.3 [C]** Les raccourcis sont **affichés à côté des boutons** (« Garder
  (G) ») et listés dans une aide clavier accessible depuis l'écran ; ils ne
  sont jamais le seul moyen.
  *Sources* : NN/g UI copy (« Show shortcuts next to their commands ») ;
  NN/g heuristique 7 ; Aftershoot (icône clavier).
- **R6.4 [C]** Les propositions automatiques (flou, yeux fermés, doublon)
  apparaissent comme **suggestions marquées** que l'utilisateur confirme ;
  elles ne changent pas l'état de la photo d'elles-mêmes.
  *Ex.* Aftershoot : mode « AI Assisted » où l'IA ne fait que regrouper et
  noter ; Excire : critères qui *marquent* « garder / rejeter », puis filtrage.
  *Sources* : support.aftershoot.com ; excire.com.
- **R6.5 [C]** Le seuil d'une détection automatique (sévérité des doublons,
  écart de temps d'une rafale) est un **réglage unique** avec une valeur par
  défaut recommandée (« stricte »).
  *Sources* : Excire Foto (mode « strict » recommandé par défaut) ;
  support.aftershoot.com (curseur de similarité).
- **R6.6 [C]** On peut filtrer la grille par état (Gardées / Mises de côté /
  À revoir) en un clic, avec le compte de chaque groupe.
  *Sources* : Aftershoot (Quick filters) ; Lightroom (filtres de drapeaux).
- **R6.7 [A]** Ne pas utiliser les lettres anglaises P/X/U : choisir des
  touches mnémoniques en français (G = garder, C = côté, R = revoir) **et**
  accepter ← → pour naviguer ; afficher la lettre sur le bouton.

---

## 7. Listes et tableaux (renommage de dossiers)

**Ce que font réellement les applications**

- digiKam, Renommer (F2) : **liste ancien nom → nouveau nom** avant
  application, modèle avec éléments insérables (date, numéro, nom de
  dossier) par boutons, options de numérotation, dernier modèle mémorisé.
- PatternFly : édition en ligne d'une ligne par crayon à droite ;
  KDE : l'édition en ligne est peu découvrable si peu de cellules sont
  modifiables.
- Microsoft : listes à plusieurs lignes en Body + Caption, icônes 32 px ;
  texte aligné à gauche de l'image pour les listes avec gros visuels.

**Règles**

- **R7.1 [C]** Tout renommage en lot montre un **aperçu « avant → après »**
  ligne par ligne avant application.
  *Sources* : docs.digikam.org (Rename) ; NN/g heuristique 5 (prévention des
  erreurs).
- **R7.2 [C]** Chaque ligne de dossier montre **2 à 4 miniatures
  représentatives**, le nombre de photos et la période ; le nom proposé est
  modifiable directement dans la ligne.
  *Sources* : Microsoft Content basics (listes à gros visuels) ; GNOME HIG
  Grid views (vignette distincte par élément).
- **R7.3 [C]** Un champ modifiable **ressemble à un champ** (bordure,
  crayon visible) sans survol ; Entrée valide, Échap annule la saisie en
  cours.
  *Sources* : KDE HIG Table view (découvrabilité) ; WCAG 1.4.11 (frontière
  de composant à 3:1) ; PatternFly Inline edit.
- **R7.4 [C]** Colonnes : texte aligné à gauche, nombres alignés à droite,
  en-têtes alignés comme leur contenu ; une seule taille de ligne.
  *Sources* : Fluent 2 Layout (« Text: align left ») ; Microsoft Typography
  (alignement gauche par défaut).
- **R7.5 [C]** Les conflits (deux dossiers au même nom, caractère
  interdit) sont signalés **sur la ligne**, en mots simples, avec une
  correction proposée.
  *Sources* : NN/g heuristique 9 ; digiKam (`{unique}` ajoute un suffixe).
- **R7.6 [C]** Libellés : pas de « Nom : … » répété sur chaque ligne ; le
  format parle de lui-même (« 124 photos · juillet 2024 »).
  *Source* : Refactoring UI « Labels are a last resort ».
- **R7.7 [A]** Les noms trop longs sont tronqués avec « … » et le nom
  complet en infobulle, jamais coupés au milieu d'un mot sans signe.
  *Appui* : Microsoft Typography (ellipses) ; Carbon (troncature + infobulle).

---

## 8. Annuler / rétablir

**Ce que font réellement les applications**

- Apple : libellés « Annuler la saisie », « Rétablir Gras » ; Annuler en
  tête du menu Édition, ⌘Z / ⇧⌘Z ; montrer le résultat (faire défiler
  jusqu'à l'élément restauré).
- Lightroom : le menu Édition nomme l'étape (« Annuler Split Toning… »),
  panneau Historique cliquable, message en surimpression à chaque annulation.
- Apple Photos : les doublons fusionnés vont dans « Supprimés récemment »,
  récupérables.
- Microsoft : confirmer seulement l'irréversible aux conséquences majeures ;
  pour le reste, une commande Annuler suffit.

**Règles**

- **R8.1 [C]** Toute action sur les photos (garder, écarter, déplacer,
  renommer, pivoter) est annulable, **plusieurs fois de suite**, avec
  Ctrl+Z / Ctrl+Y (ou Ctrl+Maj+Z).
  *Sources* : Apple HIG Undo and redo (« Let people undo multiple times ») ;
  NN/g User control and freedom ; Narrative (⌘Z / Ctrl+Z).
- **R8.2 [C]** Le bouton d'annulation **dit ce qu'il annule** : « Annuler :
  déplacement de 12 photos », pas « Annuler ».
  *Sources* : Apple HIG Undo and redo (« Undo Typing ») ; Lightroom (menu
  Édition nommé).
- **R8.3 [C]** Après annulation, l'écran **montre** l'élément restauré
  (défilement + surbrillance brève).
  *Source* : Apple HIG Undo and redo (« Show the results of an undo »).
- **R8.4 [C]** Le bouton Annuler est **à un endroit fixe et visible**
  (barre du haut), pas seulement dans une notification éphémère.
  *Sources* : NN/g User control and freedom (« Don't rely on transient
  elements alone ») ; Apple HIG Undo (boutons dans la barre d'outils si
  nécessaires).
- **R8.5 [C]** Préférer l'annulation à la confirmation ; réserver la
  boîte de confirmation aux actions **irréversibles et lourdes** (création de
  la sortie, abandon d'un projet).
  *Sources* : NN/g Confirmation dialog ; Microsoft Commanding basics.
- **R8.6 [C]** Une confirmation nomme l'objet et les chiffres (« Créer la
  sortie : 1 450 photos, 38 dossiers, dans D:\Album ») ; ses boutons sont
  des verbes (« Créer la sortie » / « Revenir au récapitulatif »), jamais
  Oui/Non/OK ; pas de bouton par défaut sur une action destructrice.
  *Sources* : NN/g Confirmation dialog ; Apple HIG Buttons (ne pas donner le
  rôle principal à une action destructrice) ; NN/g OK–Cancel.
- **R8.7 [C]** On peut annuler un **lot** d'un coup (tout ce qu'a fait une
  aide automatique, ou toute l'étape).
  *Source* : Apple HIG Undo (« revert multiple changes at once »).
- **R8.8 [C]** Rien n'est effacé : ce qui est écarté va dans un lieu
  visible et récupérable.
  *Ex.* Apple Photos (« Supprimés récemment ») ; Lightroom (rejet ≠
  suppression).
  *Sources* : Apple Photos duplicates ; jkost.com Flags.
- **R8.9 [C]** Ne pas appeler « Réinitialiser » un bouton qui annule la
  dernière action (et inversement).
  *Source* : NN/g User control and freedom (exemple Mattamy).

---

## 9. Réglages

**Règles**

- **R9.1 [C]** Chaque écran montre **au plus 3 à 5 réglages**, avec une
  valeur par défaut recommandée et marquée comme telle ; le reste est
  derrière un seul lien « Réglages avancés » (un seul niveau).
  *Sources* : NN/g Progressive disclosure (deux niveaux maximum, déclencheur
  explicite) ; NN/g The power of defaults ; Laws of UX, Hick (« Flag
  recommended choices »).
- **R9.2 [C]** Le libellé du déclencheur annonce ce qu'il contient
  (« Réglages avancés : seuil de netteté, écart entre rafales »).
  *Source* : NN/g Progressive disclosure (« information scent »).
- **R9.3 [C]** Un réglage change l'aperçu **en direct** (on voit combien de
  photos passent de « floues » à « nettes » en bougeant le curseur).
  *Sources* : Apple HIG Panels (« Prefer simple adjustment controls… sliders
  and steppers… more direct control ») ; NN/g heuristique 1.
- **R9.4 [C]** Les valeurs par défaut sont les meilleures possibles pour la
  majorité : la plupart des gens ne les changent jamais.
  *Source* : NN/g The power of defaults.
- **R9.5 [C]** Un curseur a toujours une alternative précise (valeur
  affichée, boutons − / +) et un bouton « Valeur recommandée ».
  *Sources* : GOV.UK Question pages (« Avoid range sliders… provide a method
  that doesn't require click-and-drag ») ; WCAG 2.2 SC 2.5.7.
- **R9.6 [C]** Le réglage est mémorisé (la prochaine fois, on repart du
  dernier choix si c'est pertinent).
  *Source* : NN/g Wizards (réutiliser les choix précédents comme défauts).
- **R9.7 [A] Test pour décider qu'un réglage est inutile** (supprimer si
  « oui » à l'une des questions) :
  1. L'utilisateur cible peut-il prévoir l'effet du réglage **sans
     essayer** ? Non → le remplacer par un aperçu ou un choix visuel.
  2. Moins d'1 personne sur 10 le changerait-elle ? → avancé, ou supprimé.
  3. Existe-t-il une valeur qui convient à presque tous les jeux de photos
     (seuil calibré) ? → la fixer.
  4. Le même résultat s'obtient-il par une action directe sur la photo
     (déplacer, garder) ? → supprimer le réglage.
  5. Le réglage existe-t-il « parce que le code le permet » ? → supprimer.
  *Appui* : NN/g Progressive disclosure (mesurer la fréquence d'usage) ;
  Microsoft Commanding (« let users manipulate content directly »).

---

## 10. Libellés et microcopie

**Règles**

- **R10.1 [C]** Les boutons commencent par un **verbe** et nomment l'objet
  si nécessaire : « Mettre de côté 3 photos », « Créer la sortie »,
  « Renommer les dossiers ».
  *Sources* : NN/g UI copy (« Delete Folder » plutôt que « Delete ») ; Apple
  HIG Buttons (« Add to Cart ») ; GOV.UK Button.
- **R10.2 [C]** Interdits comme libellé seul : **OK, Oui, Non, Valider,
  Soumettre, Annuler** (sans complément). Exception : « Annuler » dans une
  boîte de dialogue au sens « fermer sans rien faire », à côté d'un bouton
  verbe explicite.
  *Sources* : NN/g Confirmation dialog ; NN/g UI copy ; Siemens iX / Maersk
  (« Submit could be used for most buttons »).
- **R10.3 [C]** Lever l'ambiguïté du mot « Annuler » : « Annuler la
  dernière action » (undo) ≠ « Fermer sans enregistrer » (cancel). Les deux
  ne portent jamais le même libellé dans l'application.
  *Sources* : NN/g User control and freedom (le X qui peut vouloir dire
  fermer ou abandonner) ; Apple HIG Undo.
- **R10.4 [C]** Les mots sont ceux de l'utilisateur : « photos floues »,
  « photos presque identiques », « dossier de sortie » ; jamais « hash »,
  « EXIF », « seuil Laplacien », « cluster », « JSON », « API ».
  *Sources* : NN/g heuristique 2 ; Ageing Lab (heuristiques pour seniors).
- **R10.5 [C]** Un même objet porte **un seul nom** partout (« Mis de
  côté » ne devient pas « Rejetées » ailleurs).
  *Source* : NN/g UI copy (« Use the same label for the same command in every
  menu, dialog, and flow »).
- **R10.6 [C]** Messages d'erreur : ce qui s'est passé + quoi faire, sans
  code, près de l'endroit concerné.
  *Sources* : NN/g heuristique 9 ; NN/g Usability for senior citizens.
- **R10.7 [C]** Majuscule en début de phrase seulement (pas de Majuscules À
  Chaque Mot) ; points de suspension sur une commande qui demande encore une
  information (« Choisir le dossier… »).
  *Sources* : Microsoft Typography (sentence case) ; GOV.UK Button ; NN/g UI
  copy (ellipse).
- **R10.8 [C]** Infobulles : courtes, utiles, ne répètent pas le libellé,
  au survol **et** au focus clavier ; obligatoires sur un bouton à icône
  seule.
  *Sources* : NN/g Tooltip guidelines ; Fluent 2 Tooltip (affichage au
  survol ou au focus, à 4 px de la cible).
- **R10.9 [C]** Le coût d'une aide IA est annoncé **dans le bouton ou juste
  à côté** avant le clic (« Proposer des noms — environ 0,04 CHF ») ; un
  traitement de plus de 10 s affiche un pourcentage et peut être arrêté.
  *Sources* : NN/g Progress indicators (« give users a way to stop ») ; NN/g
  heuristique 1. (Le chiffrage lui-même est une exigence du projet.)
- **R10.10 [A]** Une icône sans libellé n'est admise que pour loupe,
  imprimante, maison, flèches, fermer — et encore avec infobulle. Tout le
  reste a un mot.
  *Appui* : NN/g Icon usability (seules quelques icônes sont universelles ;
  règle des 5 secondes).

---

## 11. Hiérarchie visuelle, espacement, typographie, états

**Règles**

- **R11.1 [C]** Tous les espacements sont pris dans une **échelle fixe sur
  base 4 px** : 4, 8, 12, 16, 24, 32, 48. Aucune valeur hors échelle.
  *Ex.* Fluent 2 : rampe 2-4-6-8-10-12-16-20-24-28-32… ; Windows : 8 px entre
  boutons, 12 px entre zones de contenu, 16 px entre bord et texte.
  *Sources* : Fluent 2 Layout ; Microsoft Content basics ; Refactoring UI
  (système d'espacement).
- **R11.2 [C]** Au plus **3 tailles de texte** par écran (petit, moyen,
  grand) ; corps ≥ 14 px, rien sous 12 px.
  *Sources* : NN/g Visual hierarchy (« no more than 3 type sizes », corps
  14-16 px) ; Microsoft Typography (minimum 12 px Regular, 14 px Semibold).
- **R11.3 [C]** Au plus **2 éléments très grands** par écran (en général :
  le titre et la photo active).
  *Source* : NN/g Visual hierarchy.
- **R11.4 [C]** Une seule couleur d'accent, réservée à l'action principale,
  à la sélection et à l'étape courante ; rouge réservé aux erreurs et aux
  actions destructrices.
  *Sources* : Refactoring UI Color palette (« one, or at most two, primary
  colors ») ; NN/g Visual hierarchy ; Apple HIG Buttons (rôle destructif en
  rouge).
- **R11.5 [C]** Contraste : texte ≥ 4,5:1 (≥ 3:1 au-dessus de 24 px ou
  18,5 px gras) ; bordures de champs, icônes utiles, indicateur de focus et
  état sélectionné ≥ 3:1.
  *Sources* : WCAG 2.2 SC 1.4.3 et 1.4.11.
- **R11.6 [C]** Chaque élément interactif a les états **repos, survol,
  appuyé, focus clavier (contour visible), désactivé, chargement** ; un
  bouton en cours de traitement affiche un indicateur et un libellé au
  présent (« Création… »).
  *Sources* : Apple HIG Buttons (état appuyé obligatoire, indicateur dans le
  bouton) ; Carbon (hover et focus) ; WCAG 2.4.7.
- **R11.7 [C]** Éviter les boutons désactivés sans explication : soit le
  bouton reste actif et explique ce qui manque, soit une phrase à côté dit
  comment l'activer.
  *Sources* : GOV.UK Button (« Avoid them where possible ») ; Fluent 2
  Tooltip (pour un composant désactivé, expliquer ce qui l'activera).
- **R11.8 [C]** Chaque liste ou grille a un **état vide** rédigé : à quoi
  sert la zone, pourquoi elle est vide, quoi faire (avec un bouton) ; pas de
  barre de filtres sur une page entièrement vide.
  *Sources* : Salesforce Lightning et PatternFly Empty state ; NN/g Empty
  states.
- **R11.9 [C]** Attente : rien sous 1 s ; indicateur animé + texte entre 2
  et 10 s ; barre de progression chiffrée au-delà, avec moyen d'arrêter.
  *Sources* : NN/g Progress indicators ; NN/g Skeleton screens.
- **R11.10 [C]** Test du plissement d'yeux : en floutant la capture,
  l'action principale et le contenu (les photos) dominent ; aucun bandeau
  coloré ne vole l'attention.
  *Source* : NN/g Visual hierarchy (« squint test »).
- **R11.11 [C]** Éléments proches = éléments liés : l'espace entre un
  titre et son contenu est plus petit que l'espace entre deux groupes.
  *Sources* : Laws of UX, Proximity ; NN/g Visual hierarchy.
- **R11.12 [C]** Lignes de texte de 50 à 75 caractères au plus (pas de
  paragraphe d'aide sur toute la largeur de 1920 px).
  *Sources* : Microsoft Typography (50-60 lettres) ; GOV.UK Check answers
  (deux tiers de largeur pour la lisibilité).

---

## 12. Utilisateurs âgés ou peu technophiles

**Règles**

- **R12.1 [C]** Texte courant ≥ 16 px (14 px strict minimum pour les
  informations secondaires), texte foncé sur fond clair ou l'inverse, pas de
  gris pâle.
  *Sources* : NN/g Usability for senior citizens (« Don't use light text
  colors », éviter « tiny type ») ; NN/g Visual hierarchy (14-16 px) ;
  revue PMC9376262 (préférence pour les grands corps).
- **R12.2 [C]** L'application reste utilisable avec le zoom du navigateur à
  150 % (rien ne déborde, rien ne disparaît) ; idéalement un réglage de
  taille du texte dans l'application.
  *Sources* : NN/g senior citizens (« Let users control font size ») ; Apple
  HIG Layout (adapter la mise en page aux grandes tailles de texte).
- **R12.3 [C~]** Cibles cliquables ≥ 24×24 px (minimum WCAG AA) ;
  **≥ 44×44 px pour les actions fréquentes** (garder, écarter, suivant) ;
  au moins 8 px entre deux cibles.
  *Divergence* : WCAG AA = 24 px ; Fluent et Apple = 44 pt/px pour le
  tactile.
  *Sources* : WCAG 2.2 SC 2.5.8 ; Fluent 2 Layout (44×44) ; Apple HIG
  Accessibility (espacement 12 à 24 pt autour des contrôles) ; Laws of UX,
  Fitts.
- **R12.4 [C]** Aucune fonction n'est accessible **seulement** par un geste
  caché : survol, double-clic, clic droit, glisser-déposer ou raccourci ont
  toujours un bouton visible équivalent.
  *Sources* : NN/g Icon usability (survol) ; brouillon W3C Visible controls ;
  Apple HIG Accessibility (« Prefer system gestures… over custom gestures ») ;
  Microsoft Commanding (« provide as many commanding affordances as
  possible »).
- **R12.5 [C]** Moins d'options par écran, et la cohérence avant tout : pour
  ce public, la cohérence est l'heuristique prioritaire et l'erreur coûte
  plus que la lenteur.
  *Source* : Ageing Lab (heuristiques adaptées aux seniors).
- **R12.6 [C]** Aide sous forme de **phrases courtes à l'écran** ou de
  courtes vidéos, pas de long manuel.
  *Sources* : Ageing Lab ; NN/g Help and documentation (format court,
  étapes numérotées).
- **R12.7 [C]** Pas d'animation rapide ou clignotante ; respecter le
  réglage système « réduire les animations ».
  *Source* : Apple HIG Accessibility (Reduce Motion).
- **R12.8 [C]** Le focus clavier n'est jamais caché par une barre collante.
  *Source* : WCAG 2.2 SC 2.4.11 (technique C43 : `scroll-padding`).
- **R12.9 [A]** Le glisser-déposer de photos entre dossiers est doublé
  d'un bouton « Déplacer vers… » qui ouvre la liste des dossiers.
  *Appui* : WCAG 2.2 SC 2.5.7 (Dragging movements) ; Microsoft Commanding.

---

## 13. Éditeurs d'album (ifolor, CEWE, Blurb) — points spécifiques

- **R13.1 [C]** Une photo **déjà placée** dans l'album porte un badge dans
  la réserve de photos.
  *Ex.* Blurb BookWright : coche violette (source secondaire) ; CEWE conseille
  de vérifier les photos « insérées deux fois » (pas de badge documenté).
  *Sources* : comparably.com (Blurb FAQ) ; CEWE Creator software guide.
- **R13.2 [C]** La qualité d'impression d'une photo est signalée **sur la
  photo placée** par un code à trois niveaux : rien (bon), jaune
  (acceptable), rouge (trop faible) avec la correction proposée (réduire le
  cadre, choisir une autre photo).
  *Ex.* ifolor : « Résolution acceptable » (jaune) / « Résolution trop
  faible » (rouge) ; CEWE : smiley rouge dans la boîte à outils de droite.
  *Sources* : ifolor Designer FAQ ; CEWE Creator software guide.
- **R13.3 [C]** Une **proposition automatique** de mise en page est un point
  de départ modifiable (photos, gabarits, nombre de pages), pas un résultat
  figé.
  *Ex.* CEWE Assistant et « Smart Layout » ; ifolor : gabarits « Mes pages ».
  *Sources* : CEWE Creator software guide ; recherche CEWE app.
- **R13.4 [C]** Structure d'éditeur d'album : réserve de photos à gauche
  (ou en bande), page (ou double page) au centre, gabarits et réglages de
  l'élément sélectionné à droite, aperçu « livre fini » avant commande.
  *Sources* : CEWE (menu de design à gauche, boîte à outils à droite) ;
  ifolor (onglets Mise en page, Options, aperçu avant commande).
- **R13.5 [C]** Les pages se déplacent par **doubles pages** dans une bande
  de vignettes (comme le produit imprimé).
  *Source* : ifolor Designer FAQ (Mac et Windows).
- **R13.6 [C]** Avant la création finale, une **check-list** visible :
  cases vides, alignement, cadrage, résolution, texte, couverture.
  *Source* : CEWE Creator software guide.

---

## 14. Check-list de revue (sur capture d'écran)

Cocher « oui » pour chaque point vérifié. Chaque point renvoie à sa règle.

**Ossature et cohérence**
- [ ] 1. La barre du haut a la même structure que sur les autres écrans (R1.1).
- [ ] 2. Il y a exactement un bouton d'action principale, en couleur d'accent (R1.2).
- [ ] 3. L'action principale est au même endroit que sur l'écran précédent (R1.2).
- [ ] 4. Le curseur de taille des miniatures est à la même place que sur les autres écrans à grille (R1.3).
- [ ] 5. Un bouton « Aide » libellé est visible, à sa place habituelle (R1.5).
- [ ] 6. Une phrase d'explication de l'étape est visible sans survol (R1.6).
- [ ] 7. Le titre dit ce qu'on fait ici, en moins de ~6 mots (R1.8).
- [ ] 8. Aucune barre ne contient plus de trois groupes de commandes (R1.9).
- [ ] 9. À 1280 px, rien n'est coupé, pas de défilement horizontal (R1.10).

**Parcours en étapes**
- [ ] 10. Toutes les étapes sont listées, l'étape courante est mise en évidence (R2.1).
- [ ] 11. Les étapes terminées ont une coche (pas seulement une couleur) (R2.1, R2.2).
- [ ] 12. Un bouton « Retour / Étape précédente » est visible (R2.4).
- [ ] 13. Le bouton d'avancée nomme l'action ou la destination (pas « Suivant » seul) (R2.5).
- [ ] 14. Avant une écriture de fichiers, un récapitulatif chiffré est montré (R2.6).
- [ ] 15. Chaque ligne du récapitulatif a un lien « Modifier » (R2.6).
- [ ] 16. Les étapes non disponibles sont marquées « Pas encore possible » (R2.9).
- [ ] 17. Les erreurs apparaissent à côté de leur cause, pas en fenêtre modale (R2.12).

**Grille**
- [ ] 18. Toutes les cases de la grille ont la même taille et le même espacement (R3.7, R3.8).
- [ ] 19. Les états (gardée, écartée, doublon, floue, utilisée) sont des badges visibles sans survol (R3.2).
- [ ] 20. Les badges sont toujours au même coin (R3.2).
- [ ] 21. Les photos écartées sont estompées ou regroupées, pas absentes (R3.3).
- [ ] 22. La sélection se voit par un contour épais + coche (R3.5).
- [ ] 23. Le nombre de photos sélectionnées est affiché (R3.6).
- [ ] 24. Les groupes de doublons montrent la photo choisie et le nombre de photos (R3.10).
- [ ] 25. Pendant un chargement, les cases gardent leur place ; progression chiffrée si long (R3.9).

**Panneau de détails**
- [ ] 26. Le panneau de détails est à droite (R4.1).
- [ ] 27. Il correspond à la sélection courante (R4.1).
- [ ] 28. Tous ses boutons sont visibles sans faire défiler la page (R4.2).
- [ ] 29. Sans sélection, il affiche un message utile (R4.4).
- [ ] 30. Avec plusieurs photos, il annonce leur nombre et des actions groupées (R4.5).

**Visionneuse**
- [ ] 31. Un bouton « Fermer » libellé est visible en haut à droite (R5.4).
- [ ] 32. Des flèches précédente/suivante sont visibles (R5.4).
- [ ] 33. Recadrer, redresser et pivoter sont dans le même outil (R5.1).
- [ ] 34. Les boutons « Auto », « Réinitialiser », « Terminé » sont présents dans l'outil (R5.1, R5.2).
- [ ] 35. On peut voir l'original ou annuler toutes les retouches (R5.3).
- [ ] 36. Les boutons de décision (Garder / Mettre de côté) sont présents dans la visionneuse (R5.6).

**Tri**
- [ ] 37. Trois états seulement, en mots simples (R6.1).
- [ ] 38. Les raccourcis sont écrits sur les boutons (R6.3).
- [ ] 39. Les propositions automatiques sont marquées « suggestion », pas appliquées (R6.4).
- [ ] 40. Les filtres par état montrent leur compte (R6.6).

**Listes / renommage**
- [ ] 41. Un aperçu « avant → après » est montré avant tout renommage (R7.1).
- [ ] 42. Chaque dossier montre des miniatures représentatives et son nombre de photos (R7.2).
- [ ] 43. Les champs modifiables ont l'air de champs sans survol (R7.3).
- [ ] 44. Texte aligné à gauche, nombres à droite (R7.4).
- [ ] 45. Les conflits de noms sont signalés sur la ligne (R7.5).

**Annuler**
- [ ] 46. Un bouton d'annulation est visible à un endroit fixe (R8.4).
- [ ] 47. Il dit ce qu'il annulera (R8.2).
- [ ] 48. Les confirmations nomment l'objet et les chiffres (R8.6).
- [ ] 49. Les boutons de confirmation sont des verbes, pas Oui/Non/OK (R8.6).
- [ ] 50. Aucune action destructrice n'est le bouton par défaut (R8.6).

**Réglages**
- [ ] 51. Au plus 5 réglages visibles ; le reste derrière « Réglages avancés » (R9.1).
- [ ] 52. La valeur recommandée est marquée (R9.1).
- [ ] 53. Chaque curseur affiche sa valeur et a une alternative précise (R9.5).
- [ ] 54. L'effet d'un réglage est visible dans l'aperçu (R9.3).

**Libellés**
- [ ] 55. Tous les boutons commencent par un verbe (R10.1).
- [ ] 56. Aucun bouton « OK », « Oui », « Non », « Valider » ou « Annuler » seul (R10.2).
- [ ] 57. Aucun terme technique (EXIF, hash, JSON, seuil, cluster, API…) (R10.4).
- [ ] 58. Le même objet porte le même nom que sur les autres écrans (R10.5).
- [ ] 59. Les aides IA affichent leur coût avant le clic (R10.9).
- [ ] 60. Les boutons à icône seule sont limités aux icônes universelles (R10.10).

**Visuel et états**
- [ ] 61. Au plus 3 tailles de texte visibles (R11.2).
- [ ] 62. Une seule couleur d'accent ; le rouge n'apparaît que pour erreur ou danger (R11.4).
- [ ] 63. Le texte gris clair est absent ou contrasté à ≥ 4,5:1 (R11.5, R12.1).
- [ ] 64. L'élément qui a le focus clavier a un contour visible (R11.6).
- [ ] 65. Aucun bouton grisé sans explication (R11.7).
- [ ] 66. Chaque zone vide a un message et une action (R11.8).
- [ ] 67. Écran flouté : les photos et l'action principale dominent (R11.10).

**Public âgé**
- [ ] 68. Texte courant ≥ 16 px, secondaire ≥ 14 px (R12.1).
- [ ] 69. Boutons fréquents ≥ 44 px de haut, autres ≥ 24 px, 8 px d'écart (R12.3).
- [ ] 70. Aucune fonction visible uniquement au survol, au clic droit ou au glisser (R12.4).

---

## 15. Anti-modèles (à refuser en revue)

1. **Le bouton qui voyage** : l'action principale change de place ou de
   couleur d'une étape à l'autre.
2. **« Suivant » muet** : bouton qui ne dit ni ce qu'il enregistre ni où il
   mène ; pire, « Suivant » qui *applique* des déplacements de fichiers.
3. **Le double « Annuler »** : même mot pour « défaire la dernière action »
   et « fermer sans enregistrer ».
4. **Annulation éphémère seule** : un « Annuler » qui n'existe que 5 s dans
   une notification.
5. **Confirmation systématique** : « Êtes-vous sûr ? » sur des actions
   annulables ; l'utilisateur clique sans lire (accoutumance).
6. **Oui / Non / OK** dans une boîte de dialogue.
7. **Actions seulement au survol** sur les miniatures ; badges d'état
   visibles seulement au survol.
8. **Couleur seule** pour dire « gardée / écartée / étape terminée ».
9. **Rejet = disparition** : photo écartée qui sort de la vue sans trace ni
   moyen de la retrouver.
10. **Décision automatique silencieuse** : une aide qui écarte, déplace ou
    renomme sans que l'utilisateur ait validé.
11. **Panneau de détails qui fuit** : boutons hors écran, panneau qui défile
    avec la grille, ou qui disparaît quand rien n'est sélectionné et fait
    sauter la mise en page.
12. **Curseur de taille à géométrie variable** : présent sur certaines
    étapes, absent ou ailleurs sur d'autres ; réglage oublié d'un écran à
    l'autre.
13. **Outils d'édition éparpillés** : pivoter dans un menu, recadrer dans un
    autre, redresser dans un troisième.
14. **Réglage « parce que le code le permet »** : seuils techniques exposés
    au premier niveau, sans valeur recommandée ni aperçu.
15. **Trois niveaux de profondeur** : « Avancé » dans « Options » dans
    « Réglages ».
16. **Jargon** : EXIF, hash perceptuel, Laplacien, cluster, token, JSON.
17. **Bouton grisé muet** : désactivé sans dire pourquoi ni comment
    l'activer.
18. **Glisser obligatoire** : déplacer des photos uniquement au
    glisser-déposer.
19. **Icône mystère** : icône sans libellé ni infobulle, ou icône qui
    signifie deux choses selon l'écran.
20. **Grille qui saute** : miniatures qui changent de place pendant le
    chargement, cases de tailles différentes dans une grille de tri.
21. **Texte gris pâle en 12 px** pour des informations utiles.
22. **Fenêtre modale pour une erreur de saisie** au lieu d'un message à
    côté du champ.
23. **Indicateur figé** (« Chargement… » sans progression) sur un traitement
    long, sans possibilité d'arrêter.
24. **Surimpression qui masque la photo** (message d'annulation, barre
    d'outils) sans moyen de la cacher.
25. **Paragraphe pleine largeur** à 1920 px (lignes de 150 caractères).

---

## 16. Sources consultées

**Nielsen Norman Group**
- 10 heuristiques — https://www.nngroup.com/articles/ten-usability-heuristics/
- Wizards — https://www.nngroup.com/articles/wizards/
- Progressive disclosure — https://www.nngroup.com/articles/progressive-disclosure/
- Help and documentation — https://www.nngroup.com/articles/help-and-documentation/
- Tooltip guidelines — https://www.nngroup.com/articles/tooltip-guidelines/
- Confirmation dialogs — https://www.nngroup.com/articles/confirmation-dialog/
- User control and freedom — https://www.nngroup.com/articles/user-control-and-freedom/
- Usability for senior citizens — https://www.nngroup.com/articles/usability-for-senior-citizens/
- Icon usability — https://www.nngroup.com/articles/icon-usability/
- Progress indicators — https://www.nngroup.com/articles/progress-indicators/
- Skeleton screens — https://www.nngroup.com/articles/skeleton-screens/
- OK–Cancel or Cancel–OK — https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/
- The power of defaults — https://www.nngroup.com/articles/the-power-of-defaults/
- Visual hierarchy — https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- Modal vs nonmodal dialogs — https://www.nngroup.com/articles/modal-nonmodal-dialog/
- UI copy — https://www.nngroup.com/articles/ui-copy/
- Timing exposing content (résumé de recherche) — https://www.nngroup.com/articles/timing-exposing-content/
- Empty states (vidéo) — https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/

**Apple**
- HIG Toolbars — https://developer.apple.com/design/human-interface-guidelines/toolbars
- HIG Undo and redo — https://developer.apple.com/design/human-interface-guidelines/undo-and-redo
- HIG Sidebars — https://developer.apple.com/design/human-interface-guidelines/sidebars
- HIG Split views — https://developer.apple.com/design/human-interface-guidelines/split-views
- HIG Panels — https://developer.apple.com/design/human-interface-guidelines/panels
- HIG Buttons — https://developer.apple.com/design/human-interface-guidelines/buttons
- HIG Layout — https://developer.apple.com/design/human-interface-guidelines/layout
- HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility
- HIG Image views — https://developer.apple.com/design/human-interface-guidelines/image-views
- Photos : recadrer, redresser — https://support.apple.com/guide/photos/pht13f0918f0/mac
- Photos : bases de l'édition — https://support.apple.com/guide/photos/editing-basics-pht304c2ace6/mac
- Photos : doublons — https://support.apple.com/en-la/guide/photos/pht5a3157c1d/8.0/mac/13.0
- Photos : pivoter (ancienne version) — https://help.apple.com/photos/mac/1.0/en.lproj/phtba22db5d6.html
- Photos : parcourir, curseur Zoom — https://support.apple.com/en-us/guide/photos/pht56eafa987/6.0/mac/11.0

**Microsoft**
- Fluent 2 Layout — https://fluent2.microsoft.design/layout
- Fluent 2 Tooltip — https://fluent2.microsoft.design/components/web/react/core/tooltip/usage
- Content layout and spacing — https://learn.microsoft.com/en-us/windows/apps/design/basics/content-basics
- Commanding basics — https://learn.microsoft.com/en-us/windows/apps/design/basics/commanding-basics
- Typography — https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography

**GOV.UK, W3C, autres systèmes de conception**
- GOV.UK Question pages — https://design-system.service.gov.uk/patterns/question-pages/
- GOV.UK Check answers — https://design-system.service.gov.uk/patterns/check-answers/
- GOV.UK Button — https://design-system.service.gov.uk/components/button/
- GOV.UK Task list — https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- WCAG 2.2 Target size (minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 Focus not obscured — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- WCAG 2.2 Non-text contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 Contrast (minimum) — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Brouillon W3C « Visible controls » (résumé de recherche) — https://raw.githack.com/w3c/wcag/e5711d19748fa9feebf9767a277e637f21de8f2d/understanding/22/visible-controls.html
- IBM Carbon Progress indicator — https://carbondesignsystem.com/components/progress-indicator/usage/
- PatternFly Bulk selection — https://www.patternfly.org/patterns/bulk-selection/
- PatternFly Inline edit — https://www.patternfly.org/components/inline-edit/design-guidelines
- GNOME HIG Grid views (résumé de recherche) — https://developer.gnome.org/hig/patterns/containers/grid-views.html
- KDE HIG Table view (résumé de recherche) — https://develop.kde.org/hig/components/editing/tableview/
- SAP Fiori Lightbox (résumé de recherche) — https://www.sap.com/design-system/fiori-design-web/v1-142/ui-elements/lightbox/usage
- Material Design Snackbars (page non lisible directement ; extrait de recherche) — https://material.io/components/snackbars
- Laws of UX : Fitts https://lawsofux.com/fittss-law/ · Hick https://lawsofux.com/hicks-law/ · Jakob https://lawsofux.com/jakobs-law/ · Proximité https://lawsofux.com/law-of-proximity/
- Refactoring UI : palette https://www.refactoringui.com/previews/building-your-color-palette · libellés https://www.refactoringui.com/previews/labels-are-a-last-resort
- Ageing Lab (heuristiques pour seniors) — https://ageinglab.ctb.upm.es/en/ux-and-usability-for-older-users-en
- Revue sur la taille de police et les seniors — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9376262/

**Applications photo et album**
- Lightroom Classic, Grid et Loupe (J. Kost, Adobe) — https://jkost.com/blog/2024/06/working-in-grid-and-loupe-view-in-lightroom-classic.html
- Lightroom Classic, Compare et Survey — https://jkost.com/blog/2024/06/using-compare-and-survey-view-in-lightroom-classic.html
- Lightroom Classic, drapeaux et avance automatique — https://jkost.com/blog/2024/06/applying-flags-stars-and-color-labels-in-lightroom-classic.html
- Lightroom Classic, recadrage — https://jkost.com/blog/2024/08/crop-and-straighten-images-in-lightroom-classic.html
- Lightroom Classic, historique et avant/après — https://jkost.com/blog/2024/08/the-history-panel-and-before-after-view-in-lightroom-classic.html
- Lightroom Classic, comparer (Adobe, extrait de recherche) — https://helpx.adobe.com/lightroom-classic/help/browse-compare-photos.html
- Lightroom, message d'annulation sur l'image (demande d'utilisateurs) — https://community.adobe.com/feature-requests-676/p-give-option-to-disable-pop-up-notifications-over-your-image-665339
- Lightroom, le rejet ne supprime pas (secondaire) — https://havecamerawilltravel.com/lightroom/delete-rejected-photos/
- Aftershoot — https://support.aftershoot.com/en/articles/5223473-get-started-with-aftershoot-culling
- Narrative Select, raccourcis — https://help.narrative.so/en/articles/7337364-narrative-keyboard-shortcuts
- Photo Mechanic, classes de couleur — https://docs.camerabits.com/support/solutions/articles/48001142942
- Excire Foto — https://excire.com/en/excire-foto/
- digiKam, vue des images et renommage — https://docs.digikam.org/en/main_window/image_view.html
- Google Photos, retouche — https://support.google.com/photos/answer/6128850
- Google Photos, piles de photos similaires — https://support.google.com/photos/answer/14169846
- Mise en page justifiée à la Google+ (vjeux, résumé de recherche) — https://blog.vjeux.com/?p=599
- CEWE Creator, guide — https://cewe.co.uk/tutorials/photo-books/creator-software-guide.html
- ifolor Designer, FAQ Windows — https://www.ifolor.ch/en/customer-service/faq/product-creation/ifolor-designer-for-windows-faq
- ifolor Designer, FAQ Mac — https://www.ifolor.com/customer-service/faq/product-creation/ifolor-designer-for-mac-faq
- Blurb BookWright, FAQ (secondaire) — https://www.comparably.com/companies/blurb/faqs

## 17. Limites de cette recherche

- Pages Adobe helpx officielles inaccessibles (HTTP 403) : les faits
  Lightroom viennent des tutoriels de Julieanne Kost (Adobe) et d'extraits.
- Material Design 3 se charge en JavaScript : non lisible directement ;
  cité seulement pour le snackbar, et rien d'essentiel n'en dépend.
- Google Photos web : pas de documentation officielle de la grille ni du
  réglage de taille des miniatures ; je n'en ai rien affirmé.
- Narrative Select, Excire, Blurb : interfaces décrites surtout par des
  sources secondaires ; je ne m'appuie sur elles que pour du vocabulaire et
  des exemples, jamais seules pour une règle.
- Les pages Apple HIG ont été lues dans leur version actuelle (format JSON
  de developer.apple.com), d'où des citations exactes.
