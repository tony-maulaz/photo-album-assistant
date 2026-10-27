# Guide UX — règles d'interface de l'application

Ce guide est la référence de toute revue et de tout changement d'interface.
Il condense l'audit général du 27.10.2026 (D108) : 118 captures réelles, 5
relecteurs, 60 sources (NN/g, Apple HIG, Fluent 2, GOV.UK, WCAG 2.2,
Lightroom, Apple Photos, Google Photos, Photo Mechanic, Narrative,
Aftershoot, digiKam, ifolor/CEWE/Blurb). La recherche complète, avec les
sources et la check-list détaillée, est dans `docs/ux/RECHERCHE.md` ;
l'inventaire des fonctions de chaque page, dans
`docs/ux/INVENTAIRE_FONCTIONS.md`.

**Pour qui.** Un membre de la famille, non informaticien, souvent âgé, qui
lit chaque bouton avant de cliquer et a peur de perdre ses photos. Écran de
1280×720 à 1920×1080, Chrome ou Edge, souris et clavier.

**Priorité.** La convivialité passe avant les décisions passées : une
décision (D…) qui gêne une interface simple, fluide et intuitive peut être
levée ; on le dit à l'utilisateur avec son numéro. Les règles d'or de
`CLAUDE.md` ne sont pas concernées : elles restent intouchables (source
jamais modifiée, rien ne se perd, l'humain décide, IA transparente et
vérifiée, état écrit au fil de l'eau, seuils calibrés).

Chaque règle est vérifiable sur une capture d'écran ou dans le code. Une
règle marquée **(cible D108)** décrit l'état visé par la refonte ; tant
qu'elle n'est pas faite, elle s'applique à tout nouveau code.

---

## 1. Ossature d'écran — une seule pour toutes les étapes (cible D108)

```
┌ Barre de l'application : logo · projet · frise · Étape n · Nom ▾   IA · ? Aide · ☰ ┐
├ En-tête d'étape : « Étape n · Titre » + consigne d'une ligne     ↶ Annuler : … ↷ ┤
├ Barre au-dessus des photos : onglets / filtres                       Taille −━+ ┤
│ Contenu : la seule zone qui défile                      │ panneau d'aide (poussé) │
└ Barre de validation : résumé chiffré               [Revenir] [Valider et continuer] ┘
```

- **O1** Une page ne crée pas son propre gabarit : elle remplit ces zones.
  Le titre de l'étape est au même x, y sur toutes les étapes.
- **O2** « ? Aide » a une seule place, en haut à droite de la barre de
  l'application, sur toutes les pages (accueil et configuration compris).
  Il ouvre un panneau à droite qui pousse le contenu (sans rien cacher) :
  explication de l'étape et raccourcis clavier. À la première visite d'une
  étape, ce panneau s'ouvre seul. Le bouton ne s'appelle jamais « Replier ».
  Sous le titre, une consigne d'une ligne reste visible. Un bouton utile de
  l'explication (« Aller au tri automatique ») reste aussi sur la page.
- **O3** Le réglage de taille des photos a une seule place : au bout à droite
  de la barre au-dessus des photos, avec le mot « Taille » et − / +, réglage commun à
  toutes les étapes. Absent des pages sans photos, jamais un second curseur.
- **O4** « Annuler » a une seule place (en haut à droite de l'en-tête
  d'étape) et dit ce qu'il défait : « ↶ Annuler : ★ sur 3 photos ».
- **O5** Un seul bouton plein par écran : l'action principale (« Valider et
  continuer », ou l'action du moment quand l'étape est bloquée). Tout le
  reste en bouton « contour ». Test : compter les `button.principal` visibles.
- **O6** « Revenir » et le bouton principal ne bougent pas d'une étape à
  l'autre (largeur fixe).
- **O7** Rien ne flotte sur les photos : ni barre, ni bulle, ni panneau en
  `position: absolute/fixed` au-dessus d'une grille. Les messages passagers
  ne couvrent aucune photo ni aucun bouton.
- **O8** Une seule grande fenêtre (`Fenetre` de `Dialogues.tsx`) et une seule
  visionneuse plein écran, avec les mêmes boutons partout.
- **O9** À 1280×720, à la première visite (explication visible), la première
  photo ou la première décision de l'étape est visible sans défiler ; aucune
  barre ne passe sur deux lignes ; au moins 4 colonnes de photos.

## 2. Photos, sélection, vue en grand

- **P1** Les actions sur la sélection ont une place fixe, visible là où l'on
  regarde : en haut de la colonne de droite (encadré « 3 photos choisies »)
  ou dans une rangée de hauteur réservée au-dessus des photos ; jamais en
  bas, jamais en surimpression, jamais à la place des filtres (la grille ne
  doit pas sauter sous la souris). L'état de chaque photo (★, ★★, ✕, à
  décider) se voit et se change sur la miniature elle-même. Toutes les
  actions existantes restent (inventaire).
- **P2** Une fonction sur une photo existe partout où la photo est montrée en
  grand : choisir, tourner, recadrer/redresser, déplacer, comparer. Quart de
  tour, redresser et recadrer sont un seul outil (« Recadrer et tourner »),
  comme Apple Photos, Google Photos et Lightroom ; « Tourner » d'un clic
  reste à côté.
- **P3** Toute action au clavier a son bouton visible, et l'indication
  affichée correspond au gestionnaire réel (pas de « M pour déplacer » là où
  M ne fait rien).
- **P4** Une touche = un sens dans toute l'application. Les raccourcis sont
  déclarés dans un seul tableau (`Raccourcis.tsx`).
- **P5** Grilles justifiées : la dernière colonne touche le bord droit de sa
  zone (écart ≤ 16 px). Miniatures en cadrage constant (pas de formes
  mélangées dans une même rangée de liste).
- **P6** Un clic choisit, un bouton valide (D101) ; un bouton groupé porte une
  étiquette de portée (« Pour tout l'onglet », « Pour cette photo ») et se
  place juste au-dessus de ce qu'il touche (D98).

## 3. Annuler, valider, ne rien perdre

- **A1** Ce qui est écrit dans un champ est ce qui sera appliqué. Une valeur
  pré-remplie (calendrier, IA) est soit appliquée par « Valider et
  continuer » après un récapitulatif « avant → après » à cocher (les
  propositions peu sûres décochées d'office), soit affichée comme une
  proposition hors du champ. Jamais d'état intermédiaire invisible. Toute
  sortie de la page (frise, menu, Revenir, Valider, onglet fermé) garde ou
  demande ce qui est en attente.
- **A2** « Annuler » ne défait que ce qui a été fait sur l'étape affichée :
  l'historique est coupé quand on change d'étape, le bouton est grisé à
  l'arrivée (cible D108). « Rétablir » à côté. Revenir sur une décision d'une
  autre étape passe par une action enregistrée dans le projet (« Remettre
  l'ancien nom », « Défaire la réunion »), jamais par Ctrl+Z.
- **A3** Toute décision passe par l'historique, refus compris ; Ctrl+Z marche
  aussi dans les vues plein écran (une par une, comparer, recadrer).
- **A4** Le mot « Annuler » veut dire « défaire le dernier geste ». Fermer une
  fenêtre sans rien faire s'écrit « Fermer sans enregistrer », « Ne rien
  faire » ou « Revenir ».
- **A5** On ne confirme que l'irréversible ; ailleurs, on agit et on permet
  d'annuler.
- **A6** Toute page atteinte depuis une étape a « ← Retour à l'étape n » et ne
  perd jamais une saisie sans demander.
- **A7** Les chiffres d'une confirmation sont ceux de la page, ou l'écart est
  expliqué dans la même phrase.

## 4. Réglages

- **R1** Au premier niveau, le résultat ; les réglages ensuite. Une
  proposition ou une photo doit être visible avant tout réglage.
- **R2** Un réglage n'est au premier niveau que s'il a changé le résultat
  sur de vraies photos de la famille (sur plusieurs années, pas un seul
  voyage) ; un choix simple (« Proposer : moins / conseillé ») et une
  préférence en clair (« Week-ends et petits voyages ») valent mieux que des
  crans en heures et en kilomètres ; un cran non calibré ne s'affiche pas. Les seuils calibrés vont dans « Réglages avancés », replié,
  avec la valeur « (conseillé) ».
- **R3** Chaque choix montre son effet chiffré en direct (« 6 dossiers »).
- **R4** Réglages en listes verticales, une ligne par choix (D107).

## 5. Mots

- **M1** Un mot = un sens dans toute l'application. Avant d'ajouter un
  libellé, chercher le mot dans `app/src/traductions/` et le glossaire. Mots
  déjà pris : « sortie » (une balade ; le dossier de résultat porte encore ce
  nom, à résoudre dans le lot du vocabulaire), « tri » (le rangement par
  date et lieu), « étape »
  (les étapes de l'assistant), « Mis de côté » (jamais « mis à part »,
  « exclu », « archive »), « Dans l'album » (jamais « retenue »).
- **M2** Un nom de bouton commence par un verbe et dit ce qu'on va voir ou
  faire (« Décider une par une ») ; jamais un mot qui décrit la vitesse ou un
  terme interne (« Tri rapide », « Empiler », « Consolidation »).
- **M3** Pas de nombre technique nu au premier niveau (netteté 7103,
  confiance 6, latitude, distance de hachage, codes IA*) : un mot (« floue »,
  « à vérifier ») ou rien. Pas de nom technique seul (`_`, extensions,
  chemins) : le nom lisible d'abord, le nom technique en gris dessous.
- **M4** Une icône a toujours un mot (sauf ✕ pour fermer). Icônes de
  `Icones.tsx` seulement : pas d'emoji ni de glyphe comme icône.
- **M5** Rouge = perte possible seulement ; un conseil est un encadré neutre
  avec la marche à suivre. Un avertissement propose sa correction en un clic.
- **M6** Phrases rassurantes là où l'on a peur (« Vos photos d'origine ne
  bougent pas », « Rien n'est supprimé ») ; messages courts : ce qui s'est
  passé, quoi faire.

## 6. Visuel

- **V1** Échelles fermées : tailles de texte 13 / 16 / 18 / 22 px (titre
  d'accueil 40) ; espacements 4 / 8 / 12 / 16 / 24 / 32 ; hauteurs de
  commandes 36 ou 44 px. Texte courant ≥ 16 px.
- **V2** Contrastes WCAG 2.2 : texte 4,5:1 ; bordures de champs, de boutons
  et repères d'état 3:1 ; un état ne se distingue jamais par la couleur
  seule.
- **V3** Cibles de clic ≥ 24 px, ≥ 44 px pour les actions fréquentes ; rien
  accessible seulement au survol ou au glisser.
- **V4** États prévus pour chaque composant : survol, focus visible,
  désactivé (avec la raison écrite à côté), vide, chargement, erreur.
- **V5** Jamais `display: flex` ou `grid` sur un `<td>` : un `<div>` dedans.
- **V6** Lignes de texte de 66 caractères au plus ; l'explication longue va
  dans le panneau d'aide.

## 7. Accueil, parcours

- **C1** Un projet en cours passe avant « Nouveau projet ».
- **C2** La frise des étapes montre leur nom (au survol au moins) et l'état
  autrement que par la couleur.
- **C3** Chaque étape commence par ce qui reste à faire et finit par un
  résumé chiffré ; « Valider et continuer » dit où l'on va si ce n'est pas
  évident.

---

## Méthode de revue (obligatoire pour tout changement d'interface)

1. **Captures** de l'existant et de la proposition : `node
   app/outils/captures_ux.mjs DOSSIER_PHOTOS DOSSIER_CAPTURES` (build figé,
   13 étapes, 1440×900 et 1280×720, positions mesurées de l'aide, de la
   loupe et d'Annuler). Maquette quand plusieurs dispositions sont possibles.
2. **Relecture en parallèle** par les agents de `.claude/agents/` :
   `ux-novice`, `ux-ergonome`, `ux-visuel`, `ux-reference`, `ux-critique`
   (et `ux-avocat` sur une proposition). Chacun cite les règles de ce guide
   par leur code (O2, P1…).
3. **Synthèse** à l'utilisateur : avis franc sur sa demande, décisions D à
   lever, ce qui est gardé ; **accord avant de coder**.
4. **Contrôle de livraison** (`ux-controle`) : captures avant/après,
   inventaire des fonctions (aucune ne disparaît), règles de ce guide,
   1280×720, traductions, tests et essais.
