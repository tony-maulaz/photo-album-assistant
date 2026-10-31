# Spécification — application « Album photos »

Version 4.3 — application navigateur autonome, en accès local uniquement. Elle **remplace entièrement**
six scripts Python d'origine (non publiés), qui ont servi de référence pour
le portage. Mise à jour après la phase 0 : propositions P1 à P20, validées le
21.10.2026.

## 1. Vision et principes

Une application **conviviale et simple**, qui tourne dans le navigateur sans
serveur ni installation. On choisit le dossier de photos à trier et un dossier
de sortie, puis on est **guidé étape par étape** pour réaliser tout ce que
faisaient les scripts : inventaire, photos floues, tri par lieux et sorties,
petits dossiers, nommage avec le calendrier, consolidation, doublons, puis
**sélection des photos de l'album avec un maximum d'outils**, et création de
l'album. Un seul utilisateur à la fois.

Ces principes s'appliquent à **chaque** écran et l'emportent sur le reste en
cas de doute.

| # | Principe | Concrètement |
|---|---|---|
| P1 | **Simple par défaut, avancé sur demande** | Chaque étape fonctionne avec ses réglages par défaut ; les paramètres fins sont dans « Réglages avancés », replié. |
| P2 | **Guidé mais libre** | Un assistant mène d'étape en étape, chaque étape a sa page, on peut revenir en arrière à tout moment. |
| P3 | **Voir avant de valider** | Chaque étape montre un **aperçu de l'état qui en résultera** (dates, nombre de photos, miniatures, alertes). On corrige dans l'aperçu, puis on valide. |
| P4 | **La source n'est jamais touchée** | Lecture seule. Tout est écrit dans le dossier de sortie. À la fin, un bilan prouve que **chaque fichier de la source** se retrouve dans la sortie ; l'utilisateur supprime alors lui-même la source. |
| P5 | **L'humain choisit** | Pas de sélection automatique. L'application et l'IA proposent, décrivent, signalent ; l'utilisateur décide. |
| P6 | **Rien ne se perd** | Sauvegarde continue, reprise après fermeture de l'onglet, annulation (Ctrl+Z). Rien n'est jamais supprimé : ce qui est écarté va dans `_mis_de_cote/`. |
| P7 | **Langage clair** | Pas de jargon (« photos semblables » plutôt que « distance de hachage »), une bulle d'aide par réglage. |
| P8 | **Configuration commune, projets autonomes** | Lieux connus, calendriers, appareils et préréglages dans un dossier `config/` commun ; chaque projet garde une copie des valeurs utilisées. |
| P9 | **L'IA à la carte** | Toutes les aides IA utiles sont proposées. Chacune est facultative, son **coût est estimé avant le lancement** et suivi ; l'utilisateur sait ce qu'il paie. Un budget d'environ 50 CHF par album est acceptable si l'on gagne du temps. |
| P10 | **Manipulation directe** | Déplacer des photos vers un dossier doit se faire **en un geste**, partout : sélectionner, glisser sur le dossier (§ 5.3). |

## 2. Utilisateurs et contexte

- Un utilisateur de la famille, adulte non informaticien, sur Windows ou Mac.
- Photos dans un **dossier local**. L'accès réseau (NAS) ne fait **pas partie
  du projet** : une fois le tri terminé, l'utilisateur copie lui-même la
  sortie sur le NAS.
- Volumes : un voyage (~1500 photos), une année (~5000 photos). Deux
  téléphones Samsung Galaxy, JPG avec date et GPS, plus des photos reçues
  (WhatsApp), des captures d'écran et des vidéos.
- Deux usages : partir d'un dossier en vrac, ou ouvrir un dossier **déjà
  trié** (par les anciens scripts ou à la main) pour passer aux doublons et à
  la sélection.

## 3. Contraintes

| # | Contrainte |
|---|---|
| C1 | **Aucun serveur.** Calcul local dans le navigateur (EXIF, netteté, ressemblance, tri GPS, copies). |
| C2 | **IA à distance** via l'API Claude, avec la clé de l'utilisateur. Tout ce qui ne demande pas d'IA fonctionne sans clé. |
| C3 | Services réseau : `api.anthropic.com` (IA, y compris recherche web côté API) et `nominatim.openstreetmap.org` (noms de lieux, recherche d'adresse). Option : tuiles OpenStreetMap pour la carte (§ 8.3). Pas de CDN à l'exécution. |
| C4 | Chrome ou Edge sur ordinateur (accès aux dossiers locaux). Message clair sinon. |
| C5 | Un fichier HTML unique, posé dans le dossier de l'application à côté de `config/`, ouvert par double-clic (`file://`). Chrome y redemande l'accès à chaque dossier à chaque session : l'écran **« Reprendre »** regroupe ces autorisations (§ 5.1). Workers « classiques » et cache des miniatures dans IndexedDB, seuls possibles en `file://` (§ 13). |

## 4. Parcours utilisateur

### 4.1 Les treize étapes

Ordre en vigueur depuis le 24.10.2026 (D54, D61) : on fait l'inventaire et on
dit ce que deviennent les sous-dossiers, on nettoie (floues, doublons), puis
on range (tri, lieux et sorties, petits dossiers, nommage, consolidation),
puis on choisit (sélection, album). Dans le code, chaque étape a un code
stable (`ETAPE.lieux`), indépendant de son numéro.

| # | Étape | Ce que fait l'application | Aperçu à valider | IA |
|---|---|---|---|---|
| 1 | **Projet** | Source, dossier de sortie, préréglage, contexte, configuration, clé, budget | Récapitulatif | — |
| 2 | **Inventaire** | Date (EXIF, sinon nom de fichier), GPS, appareil ; analyse locale (netteté, ressemblance, empreintes) ; vidéos et autres fichiers | Tableau de bord du contenu, rien à décider (§ 6.2) | — |
| 3 | **Dossiers** | Pour chaque sous-dossier d'un dossier en vrac : Trier, Garder et nettoyer, ou Ne pas toucher ; sautée sans sous-dossier et pour un dossier déjà trié | Tableau des sous-dossiers, trois boutons par ligne, photos au clic (§ 6.2) | — |
| 4 | **Photos floues** | Classement par netteté | Grille des floues, curseur avec mise à jour en direct | Option : vérification IA des cas limites |
| 5 | **Doublons** | Copies exactes, rafales (local), puis vue d'ensemble et vérification (IA), par dossier, ou par journée pour un dossier en vrac (§ 6.8) | Onglets par sorte, relecture journée par journée, un clic par photo | Oui |
| 6 | **Tri automatique** | Liste « À faire » (maison, captures d'écran, vos lieux), bandeau des copies restées à Doublons, rangement dans l'ordre du temps : voyages avec leurs étapes, sorties, maison par mois ; noms de lieux ; inutile pour un dossier déjà trié | Résultat en cartes, onglets par sorte (§ 6.4) | Option : lieu des photos sans GPS |
| 7 | **Lieux et sorties** | Vérifier et corriger l'arborescence | **Arborescence prévue** éditable (§ 6.4) | — |
| 8 | **Petits dossiers** | Rattachement des petits dossiers à une sortie voisine | Propositions à accepter ou refuser | Oui |
| 9 | **Nommage** | Noms parlants (calendrier, recherche web, monuments reconnus) | Tableau des noms | Oui |
| 10 | **Consolidation** | Fusion des dossiers couvrant la même activité | Groupes à fusionner | Oui, ou manuel |
| 11 | **Sélection** | Boîte à outils de sélection (§ 6.9) | Album en préparation : jauge, équilibre, redondances | Nombreuses options |
| 12 | **Album** | Ordre, sections, titres, légendes, couverture, contrôle | Aperçu paginé de l'album | Options |
| 13 | **Création de la sortie** | Écrit l'archive triée, l'album, les éléments mis de côté, le rapport ; **bilan complet** | Arborescence finale, bilan fichier par fichier | — |

Pour un dossier déjà trié, « Valider et continuer » enchaîne Projet,
Inventaire, Doublons, Lieux et sorties, Sélection, Album, Sortie ; les autres
étapes restent accessibles par la frise.

Chaque étape IA reste facultative : sans clé ou sans budget, l'étape propose
une version manuelle ou peut être sautée.

### 4.2 Un plan, une écriture

Les étapes 2 à 11 ne modifient aucun fichier : toutes les décisions (floues,
dossiers, noms, doublons, sélection, ordre, légendes) vivent dans le **plan**
du projet (`.album/plan.json`). Conséquences :
- aperçus modifiables instantanément (déplacer une photo ne copie rien) ;
- retour en arrière toujours possible, sans risque ;
- **une seule écriture**, sans fichiers à moitié renommés après un
  plantage.

Le bouton **« Créer / mettre à jour la sortie »** est disponible dès que le tri
(étape 6, Lieux et sorties) est validé, pour qui veut voir le résultat dans l'explorateur. Il
est **relançable** : il synchronise la sortie avec le plan (copie ce qui
manque, déplace ce qui a changé de dossier — un renommage instantané sur le
même disque —, ne recopie jamais un fichier identique). L'étape 12 fait la synchronisation finale et le bilan.

### 4.3 Points d'entrée

- **« Trier un nouveau dossier »** : étapes 1 à 11.
- **« Reprendre un projet »** : choisir un dossier de sortie existant ; l'état
  est relu depuis `.album/`.
- **« Ouvrir un dossier déjà trié »** : l'arborescence existante devient le
  plan initial (ses sous-dossiers = sorties) ; l'application propose de
  commencer au nommage, aux doublons ou à la sélection. La source reste en
  lecture seule, la sortie est un nouveau dossier.

### 4.4 Navigation

- Bandeau d'étapes toujours visible : validée ✓, en cours, à faire,
  verrouillée.
- Revenir sur une étape validée marque les suivantes « à revoir » sans effacer
  les décisions encore valables. Exemple : déplacer une photo d'une sortie à
  l'autre conserve son étoile et ses étiquettes.

## 5. Interface

> **Formes indicatives (D109).** Les places, couleurs, tailles, onglets,
> colonnes, panneaux, cartes, miniatures et styles de boutons décrits dans
> ce § et le suivant sont l'état actuel, **pas des exigences** : les agents
> d'interface sont libres sur le visuel (`docs/ux/CADRE_REVUE.md`). Ce qui
> fait foi, ce sont les **fonctions** décrites (ce que l'utilisateur peut
> faire, voir, annuler) et les règles d'or.

### 5.1 Pages

| Page | Contenu |
|---|---|
| **Reprendre** | Au lancement, si des dossiers mémorisés (source, sortie, `config/`) attendent une autorisation : un bouton « Autoriser l'accès » par dossier, enchaînés autant que Chrome le permet |
| **Accueil** | Projets récents, « Trier un nouveau dossier », « Ouvrir un dossier déjà trié », état de la configuration |
| **Étapes 1 à 11** | Une page par étape (§ 6) |
| **Fonctions IA** | Catalogue des aides IA, coûts estimés pour le projet, lancement, suivi du budget (§ 7) |
| **Configuration** | Onglets Lieux connus, Calendriers, Appareils, Préréglages (§ 8) |
| **Réglages** | Clé API, modèles, budget, affichage — propres à l'ordinateur (§ 9) |
| **Journal** | Activité, coûts par fonction, alertes |
| **Aide** | Chaque étape et chaque réglage expliqués avec des exemples |

### 5.2 Gabarit des pages d'étape

1. **Explication** en deux phrases.
2. **Réglages simples** (2 à 4), puis **« Réglages avancés »** replié (§ 10).
3. **Boutons d'action** : l'action locale, et les **aides IA de l'étape**,
   chacune avec son coût estimé (« Nommer avec l'IA — environ 1,20 CHF »).
4. **Progression** : barre, temps restant, Pause.
5. **Aperçu du résultat** avec ses outils de correction, et le **panneau des
   dossiers** (§ 5.3).
6. **Barre de validation** fixée en bas : résumé chiffré, alertes, « Revenir »,
   **« Valider et continuer »**.

### 5.3 Panneau des dossiers et déplacement des photos

Présent dans toutes les pages où l'on voit des photos (étapes 3 à 10).

- **Panneau latéral** : la liste des dossiers de destination (arborescence),
  chacun avec son nom sur une ligne, ses dates et ses alertes dessous, et son
  nombre de photos, mis à jour en direct. Champ de recherche pour filtrer les
  dossiers. Trois ordres (D89) : **par nom** et **par période** (la même
  arborescence, chaque niveau par nom ou dans l'ordre du temps), **par
  taille** (à plat, les plus petits d'abord). Un dossier créé par le tri ou à
  la main porte l'étiquette « nouveau » ; ceux de la source, non. Le panneau
  s'élargit en tirant son bord droit (largeur gardée).
- **Sélectionner** des photos dans la grille : clic, Maj+clic (plage),
  Ctrl+clic, rectangle de sélection, « toute la journée », « toutes les photos
  de cette heure ».
- **Déplacer**, au choix :
  - **glisser** la sélection sur un dossier du panneau ;
  - touche **M** : « Déplacer vers… » avec recherche au clavier ;
  - touches **1 à 9** : les derniers dossiers utilisés ;
  - **déposer sur « + Nouveau dossier »**, qui crée le dossier et y range la
    sélection.
- **Nouveau dossier** (D52) : avec des photos sélectionnées, il est créé au
  même niveau que le dossier affiché (on en fait une sortie voisine) ; sans
  photos, il est créé dans le dossier affiché, comme dans l'Explorateur.
- Effet immédiat : compteurs et dates mis à jour, annulation par Ctrl+Z.
- Aussi possible : glisser un dossier sur un autre (fusion, avec
  confirmation), renommer en double-cliquant.

### 5.4 Composants réutilisables

- **Carte de dossier** : nom, dates du–au, nombre de photos, lieu,
  4 à 6 miniatures, badges d'alerte.
- **Grille de photos** virtualisée (des milliers de miniatures), badges
  (étoiles, étiquettes, alertes), taille réglable.
- **Visionneuse** plein écran : ←/→, informations (date, appareil, lieu,
  netteté, étiquettes IA), zoom, rotation.
- **Comparateur** : 2 à 4 photos côte à côte, **zoom et déplacement
  synchronisés**.
- **Chronologie** (ancien « Ligne de temps ») : journées en colonnes, dossiers
  en blocs, événements du calendrier en bandeau.

## 6. Pages d'étape

> **Formes indicatives (D109).** Les places, couleurs, tailles, onglets,
> colonnes, panneaux, cartes, miniatures et styles de boutons décrits dans
> ce § sont l'état actuel, **pas des exigences** : les agents
> d'interface sont libres sur le visuel (`docs/ux/CADRE_REVUE.md`). Ce qui
> fait foi, ce sont les **fonctions** décrites (ce que l'utilisateur peut
> faire, voir, annuler) et les règles d'or.

### 6.1 Étape 1 — Projet
- **Dossier à trier** (lecture seule, rappelé) et **dossier de sortie**
  (refus si l'un contient l'autre).
- **Contexte** (texte libre, facultatif) : « Vacances au bord de la mer en
  famille, 2 adultes et 2 enfants, juillet 2026 ». Il est transmis aux fonctions IA ;
  l'interface le signale.
- État de la configuration et de la clé ; **budget IA du projet** (défaut :
  50 CHF, modifiable).

### 6.2 Étapes 2 et 3 — Inventaire (local, gratuit), puis Dossiers
**Lecture** : chaque fichier est classé en photo, vidéo, capture d'écran ou
autre fichier.
- **Date** : EXIF DateTimeOriginal ; sinon **date tirée du nom de fichier**
  (`20250704_123456.jpg`, `IMG-20250704-WA0012.jpg`,
  `Screenshot_20250704-123456.jpg`, `PXL_…`, `VID-…`, `FB_IMG_<ms>`, renommages
  `Lieu_JJ.MM.AA (n)`) ; sinon date du fichier, marquée « date incertaine ».
  **Vidéos**, dans l'ordre : nom Samsung `AAAAMMJJ_HHMMSS` (heure locale de
  début) ; date interne (temps universel, **fin** de l'enregistrement) moins
  la durée, convertie avec le fuseau des photos voisines
  (`OffsetTimeOriginal`) ; nom daté au jour ; date du fichier. Le GPS des
  vidéos (90 % des vidéos Samsung) sert au tri par lieux.
- **Fichiers sans autre date que celle du fichier** : signalés, car la copie
  ne conserve pas la date de modification (limite du navigateur, § 12).
- **Analyse locale**, toute seule après la lecture (D56) : netteté,
  ressemblance, empreinte des photos de même taille (copies exactes), puis
  recherche des rafales (D81), traitées à l'étape Doublons (§ 6.8).
  « Valider et continuer » attend sa fin. Après les étapes Dossiers et
  Photos floues, seules les journées dont les photos ont changé sont
  cherchées de nouveau.

**Aperçu (tableau de bord)** :
- nombre de photos, vidéos, captures, autres fichiers ; période ;
  histogramme par jour ;
- appareils détectés avec leur plage de dates. Proposition d'enregistrer un
  appareil nouveau ; mesure d'un **décalage d'horloge** sur une scène
  photographiée par deux appareils ;
- photos sans GPS, sans date, à date incertaine (miniatures) ;
- ce qui attend aux étapes suivantes (sous-dossiers, copies exactes, photos
  sans date), sans rien à décider ici ; « Refaire l'inventaire » en haut de la
  page relit la source, relance l'analyse (résultats des photos inchangées
  réutilisés) et remet les étapes suivantes à faire.

**Trier en plusieurs fois** (D63) : à l'ouverture du projet, la source est
relue rapidement ; un bandeau annonce les fichiers nouveaux, modifiés ou
disparus. « Mettre à jour l'inventaire » ne lit que ceux-là et les ajoute au
plan sans rien changer à ce qui est décidé (annulable) ; les étapes validées
repassent « à revoir » et ne traitent que le nouveau. « Refaire
l'inventaire » (repartir de zéro) est replié en bas de la page.

**Étape 3 — Dossiers** (dossier en vrac avec sous-dossiers, D61) : pour
chaque sous-dossier déjà présent dans la source, trois boutons côte à côte :
- **Trier** : ses photos rejoignent le tri par lieux et sorties ;
- **Garder, nettoyer** (par défaut) : le dossier garde son nom et sa place ;
  ses floues et ses doublons sont proposés aux étapes suivantes ;
- **Ne pas toucher** : recopié tel quel, ni floues, ni rafales, ni copies
  cherchées (une sélection « Best of », des scans).
Les sous-dossiers sont par nom (ou par période, au choix), avec une
recherche ; « Pour tous » s'applique aux dossiers trouvés. Sous le nom d'un
dossier qui a lui-même des sous-dossiers : leur nombre et les premiers noms
(liste complète dans la bulle), et ses photos propres s'il en a (D92) ; la
bulle de « Trier » rappelle que ses sous-dossiers disparaissent aussi.
Pas de miniature dans les lignes : les noms sont alignés, et une colonne
donne le nombre de sous-dossiers. Un clic sur la ligne la déplie sur une
bande de photos réparties dans le temps, à la taille du curseur (une seule
ligne ouverte à la fois), avec des pastilles par sous-dossier ; un clic sur
une photo l'ouvre en grand (D95). Deux signaux discrets, qui ne choisissent
rien : « sur N mois » (un dossier qui n'est pas un mois s'étale sur plus d'un
mois) et « N photos seules » (un dossier gardé de moins de 5 photos ne sera
proposé ni aux Petits dossiers ni à la Consolidation). Aucun choix n'est
proposé d'après le nom : « Garder, nettoyer » reste le défaut.
Le vrac de la racine est toujours trié. L'ancien choix « hors de l'album »
n'existe plus (un projet qui l'avait le lit comme « Ne pas toucher »).

### 6.3 Étape 4 — Photos floues
- Curseur « tolérance au flou » (défaut calibré : 60). Le nombre de photos
  écartées se met à jour **en direct**.
- Grille de la moins nette à la plus nette, valeur de netteté, visionneuse.
- Actions : **Sauver** (reste dans le tri), **Écarter** une photo nette mais
  ratée.
- **IA (option)** : faire juger les cas limites (« flou artistique, mouvement
  voulu, ou ratée ? »).
- Les photos écartées iront dans `_mis_de_cote/floues/`.

### 6.4 Étapes 6 et 7 — Tri automatique, puis Lieux et sorties (aperçu central)
Après une mise à jour de l'inventaire (D63), le tri automatique propose
« Ranger les N nouvelles photos » : seules les photos pas encore rangées sont
rangées, les dossiers déjà faits ne bougent pas.

Deux pages (D54) : le **tri automatique**, puis **Lieux et sorties**, la page
de travail (panneau des dossiers et photos sur toute la hauteur, explication
ouverte à la première visite seulement).

**Le principe** (D103, D104, remplace D87 et D88) : les photos sont prises dans
l'ordre du temps. Un **moment** est une suite de photos sans trou de plus de
3 h, ni passage de la maison au dehors. Des moments à plus de 50 km de la
maison (réglage avancé), sur au moins deux jours, sans photo prise à la maison
entre eux, forment un **voyage** : tout ce qui est pris entre le premier et le
dernier en fait partie, photos de la route comprises ; ses **étapes** sont ses
lieux (à 10 km près), un petit arrêt (moins de 3 photos) rejoint l'étape la
plus proche dans le temps. Tout autre moment dehors est une **sortie** ; le
même endroit (5 km) le lendemain, sans retour à la maison, reste la même
sortie. **À la maison** : un dossier par mois (ou par semaine, au choix), et une journée d'au moins
10 photos (les journées chargées qui se suivent, comme Noël, réunies) forme le
sien. Une photo sans GPS suit l'heure à laquelle elle a été prise. Les lieux
connus autres que le domicile donnent leur nom aux sorties qui s'y passent.
**Le calendrier ne découpe rien** : l'événement pendant lequel la moitié au
moins des photos d'un dossier ont été prises est montré sur sa carte, et
proposé comme nom au Nommage. Sans domicile, aucun voyage n'est reconnu et
chaque moment devient une sortie : la page le dit.

**La liste « À faire »**, à gauche (D107), une ligne par chose, chacune avec
un anneau d'état — orange à faire, vert coché fait, pointillé facultatif
(avec l'étiquette « facultatif ») —, ses boutons à droite, et **un seul bouton
plein** : celui de la première chose à faire, les autres en contour :
- **la maison** (le domicile) : « L'indiquer… » ouvre la fenêtre « Vos lieux »
  (ou la Configuration s'il n'y en a pas) ; une fois indiquée, « Changer »
  ouvre son onglet « Nommés » ;
- **les captures d'écran** parmi les photos à trier : « Voir » ouvre une
  fenêtre (décocher une vraie photo, l'agrandir), « Mettre à part » les
  range dans `Captures_ecran/`, hors du tri et de l'album ;
- **vos lieux** (« Vos lieux : 3 à nommer », facultatif ; « 5 lieux nommés »
  une fois tout nommé : la ligne reste) : « Les nommer… » ou « Les voir… »
  ouvre une **grande fenêtre** (composant `Fenetre`, une seule façon d'ouvrir
  une fenêtre dans l'application) à deux onglets (D112 point 9).
  « À nommer » : une carte par lieu qui revient souvent, trois photos (une par
  jour), l'adresse (OpenStreetMap), « Voir les 39 photos », « Nom » et son
  champ avec « Enregistrer » (grisé tant qu'il est vide, « attend un nom »),
  « C'est notre maison » quand il n'y a pas de domicile, « Plus tard » (pour la
  séance ; « Remis à plus tard : 1 lieu · Le remontrer »). « Nommés » : les
  lieux de la configuration où le projet a des photos, la maison d'abord, le
  nom dans son champ ; le corriger dit combien de dossiers du projet le
  prendront (ceux qui portent encore le nom automatique ; ceux renommés à la
  main gardent le leur), puis écrit la configuration et renomme ces dossiers
  en un geste annulable (si la configuration ne s'écrit pas, rien ne change).
  La fenêtre ne se ferme plus seule ; Échap ou « Fermer » ; retirer un lieu ou
  changer son rayon : « Configuration › » dans son pied ;
- **ranger les photos**, avec trois **listes de choix** (une ligne par choix,
  son effet chiffré à droite, « conseillé » en simple texte, D104, D107) :
  « Les voyages de plusieurs jours » (un sous-dossier par lieu visité,
  conseillé — avec le nombre de lieux visités —, ou tout le voyage dans un seul
  dossier), « C'est un voyage quand on part à plus de… » (30, 50 conseillé,
  100 km de la maison, chacun avec son nombre de voyages), « À la maison, un
  dossier… » (par mois conseillé, par semaine) ; sans domicile, une phrase dit
  de l'indiquer d'abord et ces questions ne sont pas posées. Puis le bouton
  « Ranger les photos » (« Vos photos d'origine ne bougent pas. ») ; la
  phrase sur OpenStreetMap (« seule leur position est envoyée, jamais vos
  photos ») est dans l'Aide de l'étape, la barre de progression des noms et le
  pied de « Vos lieux ». Une fois rangé : « Photos rangées : 14 voyages, 119 sorties, la
  maison en 26 dossiers », et « Ranger autrement… » qui rouvre les mêmes
  choix : un autre réglage ne range rien en silence, l'écart s'affiche
  (« Avec ce réglage : 16 voyages (+2)… ») avec « Ranger avec ce réglage » et
  « Revenir au réglage actuel » ; sinon « Ranger à nouveau » ;
- après le rangement, facultatif, **les photos sans position** : « Demander à
  l'IA… » ouvre l'aide dans une fenêtre (coût affiché avant de la lancer).
La barre du bas rappelle ce qui reste à faire (« Encore 2 choses à faire »).
**Les copies exactes restées à l'étape Doublons** (D85, D112 point 9) ne sont
pas une tâche du tri : un **bandeau brun doux** au-dessus des deux colonnes
le dit (« Il reste 255 copies exactes à accepter à l'étape Doublons. Sans
cela, le tri les rangerait une seconde fois. »), avec « Aller à Doublons › »
et « Les écarter ici » (un clic, annulable ; jamais un groupe où aucun
exemplaire n'est choisi, D101), tous deux en contour ; il disparaît quand il
ne reste rien. Dans la frise, l'étape Doublons validée passe en brun doux.

**Le résultat**, **à droite de la liste** (deux colonnes, D105 : il reste à
l'écran et défile seul, et l'on voit l'effet d'un cran sans descendre ; sous
1 200 px de large, il repasse dessous), en **onglets comme aux Doublons** : Tout,
Voyages, Sorties, À la maison, Mis à part, chacun avec son nombre. **Avant de
ranger, c'est un aperçu en direct** (D104), recalculé à chaque choix
(quelques dizaines de millisecondes pour une année) : ce qui vient
d'apparaître est marqué « nouveau » et les comptes montrent l'écart
(« 16 voyages (+2) »). En tête, une seule phrase : « Les noms des dossiers
se choisissent plus tard, à l'étape Nommage. » Une **ligne** par dossier, dans
l'ordre du temps, mois par mois, avec un **titre lisible** (D107) : « La
maison en juillet », « Voyage à Rome », « Florence, sam. 22 mars » ; avant le
rangement, tant qu'un lieu n'a pas de nom, la date (« Voyage du 24 juillet au
7 août », « Sortie du sam. 9 août »), une **icône calendrier** s'il y a un
événement pendant le dossier (avec leur nombre s'il y en a plusieurs ; sa
bulle s'ouvre au survol, au clic et au clavier, l'événement de la plupart des
photos d'abord, D88, D94), et au bout de la ligne le bouton **« 38 photos »**.
Dessous : les dates en clair, le nombre de lieux visités, la distance de la
maison, les vidéos. Fermée, une ligne tient sur deux lignes de texte. « 38
photos » **déplie quelques photos** sous la ligne (8 au plus, réparties sur la
période ; pour un voyage, deux par lieu visité avec ses dates et son nombre),
« Voir les 38 en grand » ouvre la visionneuse, et, une fois rangé, le dossier
(« Dossier « Maison/07.25 » ») ; une ligne dépliée à la fois, sans rien
retenir ni écarter (réponses 13 et 14 du 29.10 : il remplace les miniatures
toujours visibles choisies le 27.10). Avant le rangement,
OpenStreetMap n'est pas interrogé : un lieu déjà nommé à 1 km près garde son
nom, sinon la ligne s'appelle d'après sa date, jamais « Lieu_01 ». Aucune correction sur cette page
(l'Aide le dit : « Pour couper un dossier ou déplacer des photos : étape
suivante, « Lieux et sorties » ») : l'étape 6 range, l'étape 7 corrige. **Mis à part** : captures
d'écran, photos sans date, vidéos sans photo du même moment, avec leur
nombre.

**Lieux et sorties : l'arborescence.** Pour chaque dossier :
- nom prévu, **dates (du–au)**, **nombre de photos**, lieu, origine (lieu
  connu, GPS, voyage, sans GPS, sous-dossier gardé), 4 à 6 miniatures ;
- **badges d'alerte** : **petit dossier** (moins de 3 photos, réglable ;
  seulement pour un dossier déjà trié : en vrac, l'étape 8 s'en charge, D94),
  lieu inconnu, photos sans date, nom en double, très grand dossier (plus de
  200), même sortie qu'un dossier voisin ;
- **événement du calendrier** du dossier, sous son nom : celui pendant lequel
  la moitié au moins de ses photos ont été prises (D94).

**Journées** (D94) : dans la grille, chaque journée a son titre (date, nombre
de photos, événements du calendrier pendant lesquels ses photos ont été
prises, le jour même et à l'heure près ; un clic sélectionne ces photos). Dans
un dossier de plusieurs jours, « Nouveau dossier avec cette journée » la sort
dans un dossier voisin, nommé d'après l'événement ou le lieu et le jour.

**Vues** : arborescence, Chronologie (choix « Photos · Chronologie » au bout
de la tête du dossier ouvert, D112 point 10), filtre « seulement les alertes ».
**Liste des dossiers** (D112 point 10, CHARTE C-7.7) : le nom, puis la période
et de petites icônes à bulle (calendrier ; petit dossier, gris, même en vrac) ;
au bout, le menu « … » (C-4.14) : Renommer (F2), Réunir avec un autre
dossier…, Mettre dans un autre dossier… (il en devient un sous-dossier,
annulable), Déplacer les photos choisies… (M), Retirer ce dossier s'il est
vide ; le même menu à côté du nom du dossier ouvert, au clic droit et avec
Maj+F10. L'événement du calendrier s'écrit en entier dans la tête du dossier
ouvert.
**Calendrier** : les dossiers d'un même événement ne sont plus proposés à
réunir à cette étape (D106) : la Consolidation (§ 6.7) le fait, photos à
l'appui, pour un même événement au même endroit.
**Corrections** : panneau des dossiers et déplacement (§ 5.3), fusionner
(« Fusionner avec… », les dossiers les plus proches dans le temps en tête, ou
en glissant un dossier sur un autre), sortir une journée, renommer, mettre
dans `_autres/`, annuler.
**Suggestion de lieux connus** : un endroit qui revient sur de nombreux
jours (maison, grands-parents, école, club) est proposé dans la liste « À
faire » de la page du tri automatique.
**IA (option)** : **situer les photos sans GPS** d'après leur contenu et les
photos prises juste avant et après ; proposition de rattachement.

### 6.5 Étape 8 — Petits dossiers (IA)
Un petit dossier à la fois (D90), comme les Doublons : à gauche, la liste des
petits dossiers dans l'ordre du temps (la ligne de dossier commune, C-7.7 :
le nom, puis la date et l'état écrit, « à décider », « mis avec … », « gardé
seul », et le nombre de photos ; la même poignée que Lieux et sorties) ;
au centre, ses photos en grand (curseur de taille, clic : visionneuse), entre
le dossier **juste avant** et **juste après** lui dans le temps, photo à
photo, quel que soit l'écart (« Pendant cette sortie » s'il a été pris
pendant un dossier). Pour chaque voisin : l'écart (« 31 min plus tôt », « le
lendemain »), la distance, ses photos prises au plus près avec leur heure,
« petit aussi » s'il est petit, et sous lui « ◀ Mettre avec ce dossier »
(son infobulle : « Ses 2 photos iront dans « … » (14 photos ensuite). Le
petit dossier disparaît. »). Le rôle de chaque colonne en titre (« ← Pendant
cette sortie », « Ce petit dossier », « Juste après → »), puis le nom du
voisin, puis l'écart en gris (D112 point 10). Au centre : « Garder seul ». À
côté du nom du petit dossier, le crayon (F2) et le menu « … » : Renommer,
Réunir avec un autre dossier… (les dossiers pris au plus près dans le temps
d'abord, avec une vignette ; ni dossiers techniques, ni « Ne pas toucher », ni
parents sans photos à eux ; l'ancien « Autre dossier… »), et le nom proposé
par l'IA. Après un choix, on passe au suivant ; rien ne disparaît de la liste,
« Annuler ce choix » et Ctrl+Z défont. Clavier : ← et →, G, J et K, F2,
Maj+F10. **Cas évidents** (un voisin à moins d'1 h et de 10 km, ni lieu connu
ni dossier de mois) : « 1 petit dossier a un voisin évident : voir », dans la
barre d'outils avec l'aide IA, ouvre leur liste, « Retirer » par ligne, puis
un bouton les range tous. **Aide IA** facultative : elle compare chaque petit dossier à ses deux
voisins ; sa proposition s'affiche sur le voisin choisi, « Accepter les N
propositions sûres » pour celles à 8 sur 10 ou plus. Un dossier qui a des
sous-dossiers n'est jamais un petit dossier (ses étapes le sont).

### 6.6 Étape 9 — Nommage (IA)
- Tableau : miniatures, nom actuel, **nom proposé modifiable**, confiance,
  justification, événement du calendrier utilisé, **monuments ou lieux
  reconnus**.
- L'IA combine les photos, le GPS, le calendrier, le contexte du projet et
  une **recherche web** (événements locaux, lieux touristiques, résultats de
  course…).
- Tri par confiance croissante ; « Accepter les noms de confiance ≥ 8 ».
- **Choisir le nom** (D83, D88) : sous chaque dossier, les noms possibles à
  prendre d'un clic : 📅 un par événement du calendrier (pas récurrent,
  21 jours au plus, couvrant au moins 80 % des photos ; titre suivi du lieu,
  `Theme_Lieu_JJ.MM.AA`, le lieu omis s'il est dans le titre ou dans le
  dossier parent), 📍 le lieu, ✨ la proposition de l'IA ; le champ reste
  libre. Le champ est pré-rempli avec le meilleur événement (la plus grande
  part, puis le plus court : « 18 ans de Lea » plutôt que le voyage qui
  l'entoure), sauf égalité parfaite, sinon avec la proposition de l'IA.
  « Prendre le nom du calendrier » renomme d'un coup les dossiers qui n'ont
  qu'un seul événement (titre de 40 caractères au plus) ; avec plusieurs,
  l'utilisateur vérifie.
- Convention `Theme_Lieu_JJ.MM.AA`, sans accents ni espaces, correction
  proposée.

### 6.7 Étape 10 — Consolidation
- **En tête, ce qu'il faut proposer** (D91), avec le nombre de propositions
  qui change sous les yeux : une sortie coupée en plusieurs dossiers (des
  photos prises à moins de 1 h, 3 h, 6 h ou la journée, et de 1 à 20 km ; par
  défaut 3 h et 4 km, 2 × la taille d'un endroit du tri d'avant D103), les week-ends et petits
  voyages (dossiers à plus de 10 km de la maison, jours qui se suivent, sans
  photo prise à la maison entre-temps, jusqu'à 3 jours, 4 jours, 1 ou 2
  semaines ; il faut un domicile), et les dossiers d'un **même événement du
  calendrier au même endroit** (D106 : événement de 4 jours au plus, pas
  récurrent, pendant lequel au moins la moitié des photos de chaque dossier
  ont été prises — la règle de l'événement montré sous un dossier —, dossiers
  à 5 km au plus l'un de l'autre, hors dossiers de voyage ; une fête sur deux
  jours avec retour à la maison, un concours en deux séances). Sur les mêmes
  dossiers qu'une sortie coupée, le calendrier la confirme (« Pris pendant
  « … » (votre calendrier), au même endroit ») ; le nom proposé est alors son
  titre suivi des dates. En avancé : les noms proches à 2 jours près
  (noms donnés au Nommage), et proposer à nouveau ce qui a été refusé.
- **Des groupes, pas des paires**, dans l'ordre du temps : la liste à gauche
  (comme les petits dossiers), une proposition à la fois à droite. Ses
  dossiers côte à côte, chacun avec ses photos réparties sur sa durée et
  leurs heures (un clic ouvre la visionneuse), une case pour en laisser un à
  part ; la raison en mots (« Des photos prises à 31 min et 2,4 km d'écart »).
- **Décider** : le nom du dossier réuni est modifiable (le plus grand, dates
  étendues à toute la période) ; pour un petit voyage, un seul dossier ou un
  dossier « Voyage_… » avec une étape par dossier ; « Réunir », « Pas la même
  sortie » (touche N). Les étapes d'un voyage du tri peuvent être réunies en
  un seul dossier. Rien ne disparaît : une réunion ou un refus reste dans la
  liste, et se défait plus tard. Ctrl+Z annule aussi.
- **IA6** : une fusion proposée par l'IA confirme ou complète un groupe (son
  nom et sa raison s'affichent), ou en ajoute un ; un renommage se propose à
  part (« Renommer », « Non merci »).

### 6.8 Étape 5 — Doublons (IA)
- **Cadre commun** (lot 4 de la charte, D111, provisoire jusqu'à l'essai sur
  de vraies photos ; `docs/ux/CHARTE.md` C-7, C-8) : bandes fixes (barre de
  l'application, en-tête d'étape avec « Annuler : … » et « Rétablir », barre
  d'outils, barre du bas) ; seules la liste de gauche et la zone des groupes
  défilent ; l'explication de l'étape et de l'onglet, et le clavier, sont dans
  l'**Aide** (barre de l'application, « à lire » sous 1440 px).
- **Onglets** (D71), un par sorte de doublons, dans la barre d'outils, chacun
  avec ce qui reste à accepter : **Copies exactes** (avec les photos présentes
  dans plusieurs dossiers gardés, D86), **Rafales**, **Même scène (IA)**,
  puis, après un filet, **Écartées** (tout ce que l'étape a écarté, à garder
  de nouveau d'un clic ; D112). Ce qui touche tout l'onglet est écrit en clair,
  avec sa portée (D98, D112 : plus de menu) : « Accepter les N propositions »
  et « Garder tous les exemplaires » (Copies), « ✦ Choisir avec l'IA dans N
  rafales » et son prix (Rafales). La taille des photos est le curseur de la
  ligne de l'étape (au palier, les photos en font les trois quarts, et le
  curseur le dit). En haut de la liste de gauche : **Afficher** (À accepter,
  Acceptés, **Tous** par défaut), **Grouper** (Journée · Mois · Dossier) et
  **Classer** (Heure · Plus grands d'abord), visibles, « Chercher » (par
  dossier) ; dessous, les
  journées (puis les dossiers gardés, puis les photos sans date), avec ce qui
  reste ; au palier, la liste devient un menu dans la tête de la table. Tête de
  la table : le titre de la section et son compte, puis en clair « Accepter les
  N groupes » (s'il reste au moins deux groupes ; ceux où au moins une photo est
  choisie ; une fenêtre dit d'abord combien de photos seront écartées, dont
  combien dans des groupes où rien n'a été choisi, D112) et « ✦ Choisir avec
  l'IA de cette journée » : on parcourt la section en choisissant d'un clic,
  puis on la valide d'un coup (D100, D101) ; quand la section est finie, le plein « Suite à accepter :
  … › » ; quand l'onglet est fini (et sur « Écartées »), le plein mène au
  prochain onglet qui reste (« Rafales : 6 à accepter › »). Pas de boutons
  vers les sections voisines (N et P au clavier ; « Journée suivante à
  accepter » sur la ligne des boutons du dernier groupe). Groupé par dossier,
  la photo du dossier choisi est à gauche dans chaque groupe. « Grouper » :
  par journée, par mois ou par dossier (par défaut par journée, par mois
  au-delà de 20 journées) ; par dossier, une copie se range sous chaque
  dossier de la source où elle a un exemplaire (même après le tri), et les
  dossiers sont par ordre alphabétique, avec une recherche.
- **Un groupe**, posé sur la table : un en-tête d'une ligne, collé en haut de
  la zone tant que le groupe se voit (heure · sorte, « Comparer en grand »,
  « Accepter → » au bout à droite, ce qu'il fera écrit en gris à sa gauche),
  puis les photos, chacune avec son badge (D112 : le mot et sa couleur disent
  ce qui lui arrive, l'icône d'où vient l'idée ; bordure : proposé, plein :
  décidé ; la place après l'icône, « ✓ 4 · À garder ») ; aux Copies, la photo
  une fois et une ligne par exemplaire. Chaque photo a une proposition
  (garder ou écarter). **Un clic choisit, « Accepter » applique** (D101) : un
  clic sur une photo pose un choix en attente (« À garder », « À écarter » ;
  « Votre choix · pas encore accepté »), noté dans le plan, annulable, sans
  rien mettre de côté ; dans une rafale ou une même scène, il choisit cette
  photo seule (les autres passent « à écarter »), sauf la case **Garder
  plusieurs photos** du groupe (cochée d'office dès deux photos choisies ;
  Ctrl+clic ajoute une photo) ; pour les copies exactes, il change cet
  exemplaire seul. Le plein suit **le dernier geste** (le groupe cliqué, ou
  touché au clavier ; après la molette, le premier groupe dont on voit la
  bande « À garder ») ; il dit seulement « Accepter → », à largeur fixe, et
  la ligne grise d'à côté dit ce qu'il fera : « garde la 4 · écarte 5 »,
  « garde 3 photos · écarte 9 », aux Copies « garde 1 exemplaire · écarte 2 »
  (« · puis septembre 2026 » sur le dernier groupe d'une section, qu'il
  ouvre ensuite) ; il applique les choix et accepte le groupe (« Gardée »,
  « Écartée », « Accepté » avec la coche) ; il ignore les clics, A et Entrée
  0,5 s après une acceptation (comme « toutes · aucune » et les photos du
  groupe suivant) ; le focus passe alors à la photo gardée du groupe
  suivant, jamais à son plein (Espace y choisit, il n'accepte pas). Un clic
  sur le badge donne l'autre sort, par vous ; un second clic revient à la
  proposition ; G et X fixent le sort de la photo qui a le focus. La case
  **Garder plusieurs photos**, cochée, montre « choisir : toutes · aucune »
  (Ctrl+A : toutes), à la place de « Tout garder » et « Tout écarter » (D112).
  Aussi **Comparer en grand** (zoom synchronisé, dossier de chaque photo, le
  même badge sous chaque photo, ← → d'un groupe à l'autre, 1, 2, 3…
  choisissent la photo de ce numéro, le même « Accepter → »). S'il reste des
  copies exactes, la barre du bas le dit en brun, la case de Doublons de la
  frise passe en brun doux et « Valider et continuer » propose « Continuer
  sans elles », « Les voir d'abord » ou « Accepter les N copies et
  continuer » (D112 ; jamais pour des rafales). Un groupe accepté se
  replie à sa place, quel que soit le filtre (« Revoir » le rouvre,
  « Replier » le referme ; D100 levée le 27.10) ; « Annuler » le rouvre et
  lui rend le plein, en haut de la zone. Un
  groupe pas encore accepté garde ses photos dans l'archive. Tout s'annule
  (Ctrl+Z, ou « Annuler : … » de l'en-tête). Clavier : J et K (ou ↓ ↑), ← et
  →, Espace, A et C (le groupe du plein), N et P.
- **Copies exactes** sur tout le projet, quels que soient le dossier et la
  date (D61) : même contenu (empreinte du fichier) ou **même photo en
  version réduite** (WhatsApp : très semblable, dimensions plus petites,
  sans EXIF). Proposition : n'écarter que ce qui ferait double emploi au
  même endroit. Le meilleur exemplaire de chaque emplacement (un dossier qui
  garde sa place, ou les photos à trier) est gardé, version réduite comprise
  quand elle y est seule ; les autres copies d'un même emplacement vont dans
  `_mis_de_cote/doublons_exacts/`. Une photo déjà rangée dans un dossier
  « Garder, nettoyer » n'est pas triée une seconde fois ; si ce dossier n'en
  a qu'une version réduite, l'original y prend sa place. Une photo présente
  dans plusieurs dossiers gardés y reste partout : ses groupes, rien à
  relire, se montrent sous ceux à relire (« Aussi dans d'autres dossiers
  gardés : tout est gardé ») ; groupé par dossier, « Écarter N exemplaires
  de ce dossier » écarte d'un coup ceux qui restent gardés ailleurs (jamais
  le dernier exemplaire), « Remettre » les rend. Un dossier « Ne pas toucher » n'est pas examiné : ses copies
  sont voulues (une sélection `BESTOF`, D85). Tous les exemplaires
  peuvent être écartés. Les vidéos et autres fichiers ne sont que copiés,
  contrôlés par leur taille.
- **Rafales et mêmes scènes, sans IA** (D99) : sous une photo, une
  remarque au plus quand elle se distingue nettement des autres du groupe
  (« plus nette », « plus sombre », « trop claire (zones blanches) »,
  « contre-jour »), d'après la netteté et l'exposition mesurées par
  l'analyse. La ★ ne s'affiche que si une photo est vraiment meilleure (la
  plus nette d'une rafale, le choix de l'IA, l'original d'une copie
  réduite) ; quand les photos se valent, une photo est choisie sans ★ et la
  proposition le dit (D101). Un « Accepter » groupé ne valide jamais un
  groupe où aucune photo n'est choisie.
- **Choisir dans les rafales (IA16, D102)** : « Choisir avec l'IA » dans le
  menu « ✦ Toutes les rafales ▾ » (toutes les rafales à valider), dans celui
  de la section, ou dans « Comparer en grand » (cette rafale), coût affiché.
  L'IA (modèle rapide, photos en 1568 px) choisit la meilleure photo et dit
  pourquoi, « IA : … » sous chaque photo ; son choix est posé comme un clic,
  à valider, seulement sur les rafales pas encore touchées. Au-delà de
  5 personnes, elle ne choisit rien.
- Réglage simple de l'IA : **Prudent** (défaut, les expressions différentes
  sont gardées) ou **Strict**. Son coût est affiché dans l'onglet « Même
  scène (IA) », où elle se lance.
- Algorithme du script 06 (§ 11) : rafales (local, cherchées avec l'analyse
  automatique, D81), vue d'ensemble de tout le dossier, scènes locales,
  vérification en grand format, garde-fous (une photo refusée par le
  garde-fou est montrée, gardée, et peut être écartée). Juste après les
  floues, un dossier en vrac n'est pas encore rangé : ses photos sont
  comparées **journée par journée** (un dossier « Garder, nettoyer » forme
  son propre lot, un dossier « Ne pas toucher » n'est pas comparé) ; un
  dossier déjà trié, dossier par dossier. Les groupes ne changent pas d'une
  recherche à l'autre : une nouvelle recherche retrouve les décisions prises.
- Les **scènes** repérées sont conservées pour la sélection (piles).

### 6.9 Étape 11 — Sélection (boîte à outils)
L'utilisateur choisit, l'application l'aide au maximum. Deux niveaux :
**★ dans l'album**, **★★ grande photo** (pleine page, candidate à la
couverture).

**Outils locaux (gratuits) :**

| Outil | Fonctionnement |
|---|---|
| **Tri rapide** | Plein écran, photo par photo : Espace = ★, 2 = ★★, X = non, ←/→. Compteur « reste à décider ». |
| **Piles** | Les photos semblables (scènes de l'étape Doublons + ressemblance) sont empilées : une pile = une scène, on choisit en un clic, les autres restent dans l'archive. |
| **Comparateur** | 2 à 4 photos, zoom et déplacement synchronisés pour vérifier visages et netteté. |
| **Indicateurs techniques** | Netteté, photo sombre ou cramée, contre-jour ; tri et filtre par ces critères. |
| **Alerte de redondance** | « 3 photos retenues du même panorama » : photos retenues trop semblables (seuils du script 03 : diversité 20, fenêtre 45 min). |
| **Équilibre** | Graphique des photos retenues par jour et par sortie, à côté du nombre disponible ; sortie sans aucune photo retenue signalée. |
| **Cible** | Nombre de photos, ou pages ifolor × photos par page ; jauge ; ★★ comptée comme une page. |
| **Filtres** | Sortie, jour, appareil, étoiles, décidée ou non, étiquettes IA, indicateurs. |
| **Rotation** | Corriger une photo mal orientée : à l'étape 12, seule la balise Orientation de la copie dans `Album/` change, sans recompression ; l'archive `Photos/` reste identique à la source. |

**Aides IA (facultatives, coût affiché avant lancement)** :

| Aide | Ce que l'IA apporte |
|---|---|
| **Étiquettes** | Pour chaque photo : personnes (aucune, 1, 2-4, groupe), type (portrait, groupe, paysage, monument, repas, animal, activité, selfie, document), défauts (yeux fermés, flou de bougé, tête coupée, contre-jour, horizon penché), courte description. Tout sert de filtre. |
| **Appréciation** | Note indicative de qualité photo (composition, expressions, lumière) avec une phrase d'explication. Sert à trier une pile ou une sortie, **jamais** à cocher automatiquement. |
| **Meilleure de la pile** | Dans une pile, l'IA indique celle qu'elle préférerait et pourquoi ; l'utilisateur garde la main. |
| **Recherche en langage naturel** | « Les enfants sur un éléphant », « coucher de soleil sur la plage » : recherche dans les descriptions (après étiquetage). |
| **Contrôle de la sélection** | Relecture des photos retenues par sortie : redondances, moments manquants (« aucune photo de groupe à Bangkok »), photos faibles. Uniquement des remarques. |

**Page (cadre commun du lot 4, D111, règles C-7 et C-8 provisoires jusqu'à
l'essai sur de vraies photos)** : en-tête fixe (titre, consigne d'une ligne,
« Annuler : … » et « Rétablir » ; le message passager s'y écrit à la place de
la consigne), barre d'outils « Afficher : Toutes · À décider · ★ Dans
l'album · Pas pour l'album » et « Taille − + », la grille seule défile, barre
du bas fixe. **Plus de barre noire** : la colonne de droite « *N* photos
choisies » porte les décisions (« ★ Dans l'album », plein tant qu'une photo
choisie n'y est pas ; ★★ Grande, À décider, Pas pour l'album ; la décision
déjà prise par toutes est allumée), puis les outils (Ne plus choisir,
Tourner, Recadrer et tourner…, Comparer en grand, Déplacer vers une
sortie…) ; sans photo choisie, « L'album » (cible, équilibre, redondances,
aides IA). Un clic à la souris sur une décision ou un outil laisse le focus
dans la grille : Espace garde son sens (« Dans l'album »). « Annuler » de
l'en-tête, comme Ctrl+Z, ne défait qu'un geste fait à cette étape ; sinon
« Rien à annuler ici », et la touche nomme l'étape du dernier changement
(choix 6 A ; « Y aller » au sous-lot 4a2).

**Recadrage** (D62, lot 4) : « Recadrer et tourner… » ou la touche K sur une
photo choisie ouvre la photo en grand avec un cadre à tirer, des formats
(libre, 3:2, 4:3, carré, en portrait ou en paysage), « Tourner » (à gauche,
à droite : le **quart de tour est fait tout de suite**, le cadre tourne avec
la photo) et un curseur « Redresser » (±15°, « Remettre à 0° »). Un seul
« Annuler » et une seule pile : réglages du cadre et quarts de tour mêlés,
défaits dans l'ordre inverse (Ctrl+Z aussi) ; un geste sans effet n'y entre
pas. La barre du bas, toujours visible, porte « Remettre la photo entière »
(« Déjà la photo entière », désactivé, quand il n'y a rien à remettre) et
« Accepter le recadrage » (Entrée) ; « Fermer sans recadrer » (Échap)
abandonne le cadre et le redressement, un quart de tour reste fait. Seule la
copie dans `Album/` est recadrée, réencodée en haute qualité avec l'EXIF de
l'original ; la miniature et l'aperçu de l'album montrent la photo recadrée,
un badge ✂ la signale.

### 6.10 Étape 12 — Album
- **Ordre** : par journée puis par segment d'activité (défaut, cf. incident I2)
  ou chronologique strict.
- **Sections** = sorties ; titres repris des noms de dossiers et modifiables ;
  regroupement ou découpage de sections par glisser-déposer.
- **Légendes** manuelles par photo.
- **Aperçu paginé** : simulation des pages (photos par page, ★★ en pleine
  page), sections, nombre de pages total.
- **Aides IA (facultatives)** :
  - **titres de section** et **texte d'introduction** de chaque sortie ;
  - **légendes** pour une part des photos (réglable, défaut 15 %), avec le
    **ton** choisi (sobre, chaleureux, humoristique, pour les enfants) ;
  - **informations et références** trouvées sur internet pour enrichir les
    textes (monument, histoire d'un lieu, fait marquant d'une course) ;
  - **suggestions de couverture** : 5 candidates parmi les ★★, avec la
    raison ;
  - **contrôle de l'album** : relecture de l'aperçu paginé (redondances entre
    pages voisines, rythme, sections déséquilibrées).
- Tous les textes sont modifiables dans un tableau.

### 6.11 Étape 13 — Création de la sortie et bilan
- **Aperçu** : arborescence finale, nombres et tailles par catégorie, espace
  disque nécessaire.
- **Écriture** (synchronisation, § 4.2) de l'archive, de l'album, des éléments
  mis de côté et du rapport (§ 12).
- **Bilan** :
  - chaque fichier de la source est retrouvé dans la sortie (même taille) :
    « 5123 fichiers dans la source → 5123 dans la sortie : 4890 photos
    triées, 102 vidéos, 23 floues, 98 doublons, 7 autres fichiers » ;
  - tout fichier manquant est listé, avec « réessayer » ;
  - le bilan précise que les fichiers système masqués par le navigateur
    (`Thumbs.db` de Windows) ne sont ni comptés ni copiés, et que Windows les
    recrée ;
  - la date de modification d'origine des fichiers est consignée dans le
    rapport (la copie ne la conserve pas) ; ceux qui n'ont aucune autre date
    sont listés.
- Seulement si le bilan est complet : *« Tout est dans le dossier de sortie.
  Vérifiez-le et copiez-le à son emplacement définitif (NAS) ; vous pourrez
  ensuite supprimer le dossier d'origine vous-même. »*

## 7. Fonctions IA

### 7.1 Catalogue

Page « Fonctions IA » : toutes les aides IA, avec pour chacune ce qu'elle
fait, ce qui est envoyé, si elle utilise la recherche web, le modèle, le
**coût estimé pour le projet en cours**, l'état (non lancée, en cours, faite).
Les mêmes aides apparaissent comme boutons dans les étapes concernées.

| # | Fonction | Étape | Envoi | Web |
|---|---|---|---|---|
| IA1 | Cas limites de netteté | 3 | Miniatures des photos à la limite | — |
| IA2 | Situer les photos sans GPS | 4 | Miniatures + photos voisines dans le temps | Oui |
| IA3 | Petits dossiers | 5 | Planches du fragment et de ses voisins | — |
| IA4 | Nommage des sorties | 6 | 5 photos par dossier, GPS, calendrier, contexte | Oui |
| IA5 | Reconnaissance de lieux et monuments : **intégrée à IA4** (même appel, D51) | 6 | — | — |
| IA6 | Consolidation | 7 | Liste des dossiers + planches des petits | — |
| IA7 | Doublons | 8 | Planches vue d'ensemble + vérifications | — |
| IA16 | Choisir dans les rafales (D102) | 5 | Photos de chaque rafale en 1568 px | — |
| IA8 | Étiquettes et description | 9 | Planches de miniatures | — |
| IA9 | Appréciation | 9 | Miniatures moyennes | — |
| IA10 | Meilleure de la pile | 9 | Photos de la pile en grand | — |
| IA11 | Contrôle de la sélection | 9 | Photos retenues par sortie | — |
| IA12 | Titres et introductions de section | 10 | Photos retenues, noms, contexte | Oui |
| IA13 | Légendes | 10 | Photos concernées, contexte | Option |
| IA14 | Suggestions de couverture | 10 | Les ★★ | — |
| IA15 | Contrôle de l'album | 10 | Pages simulées | — |

La recherche en langage naturel (§ 6.9) utilise les descriptions d'IA8
localement, sans nouvel appel. De nouvelles fonctions s'ajoutent en
complétant ce tableau.

### 7.2 Coûts et budget
- Avant chaque lancement : **estimation** (nombre d'appels, d'images, de
  recherches web) en CHF ; confirmation au-dessus d'un seuil réglable (défaut
  2 CHF).
- **Budget du projet** (défaut 50 CHF) : jauge permanente dans l'en-tête,
  alertes à 50 % et 80 %, pause automatique avant dépassement.
- Coûts réels par fonction dans le Journal. Les tarifs (USD par million de
  jetons, recherche web) et le taux USD → CHF sont dans une table unique,
  modifiable dans Réglages.
- **Pas de mode lots** : l'API de traitement par lots refuse les appels
  venant d'une page web (CORS, vérifié en phase 0). Les gros traitements se
  font par 2 à 4 appels simultanés, mis en cache au fil de l'eau ; avec les
  tarifs actuels, l'économie perdue est de quelques francs par album.

### 7.3 Règles communes
- Toute réponse IA est **réparée puis validée** avant usage (§ 11) ; une
  réponse inexploitable est signalée, jamais bloquante.
- Toute réponse est **mise en cache** : relancer ne repaie jamais.
- Toute proposition IA est visible, expliquée, modifiable ou refusable.
- **Transparence** : ce qui est envoyé (miniatures, textes, contexte) est
  indiqué dans le catalogue ; rien n'est envoyé sans action de l'utilisateur.
- Les consignes envoyées à l'IA sont dans `app/src/ia/consignes/`, un fichier
  par consigne, reprises **mot pour mot** des scripts pour les fonctions
  existantes (IA3, IA4, IA6, IA7, textes de l'IA12-13). Calibrées sur Sonnet
  4.6, elles sont **revalidées sur les modèles actuels** avec les cas de
  référence (I5, I7, A7, A8) avant la phase 4.
- Réponses demandées en **sorties structurées** (`output_config.format`) ;
  la réparation et la validation restent obligatoires (règle d'or 6). Pas
  d'appel d'outil forcé ni de pré-remplissage (refusés par les modèles 5.5).
  `effort` fixé par fonction (bas pour les étiquettes) ; une réponse
  `refusal` est traitée comme inexploitable, sans blocage.

## 8. Configuration

### 8.1 Dossier `config/`

```
album-photos/                    (dossier local de l'application)
├── album-photos.html
└── config/
    ├── config.json              lieux connus, appareils, calendriers, préréglages
    ├── calendriers/famille.ics
    └── sauvegardes/             10 dernières versions de config.json
```

Une page web ne peut pas découvrir seule son dossier : au premier lancement
sur un ordinateur, l'application demande de choisir le dossier `config/` (ou
d'en créer un), puis s'en souvient ; à chaque session, l'accès est
réautorisé d'un clic (écran « Reprendre »). Pour utiliser l'application sur un autre
ordinateur, il suffit de copier le dossier `album-photos/` avec son `config/`. Elle contient le domicile : **jamais dans un dépôt Git ni
en ligne**. Modèle anonyme : `config.exemple/`.

### 8.2 `config.json`

Format de référence : `config.exemple/config.json`. Contenu : `version`,
`modifie_le`, `lieux_connus` (`id`, `nom`, `lat`, `lon`, `rayon_m`,
`domicile` — un seul —, `un_seul_dossier`, `notes`), `appareils` (`modele`,
`decalage`, `surnom`), `calendriers` (`fichier`, `nom`, `actif`,
`inclure_recurrents`), `prereglages`.

Écriture sûre (fichier temporaire puis remplacement), sauvegarde horodatée,
validation à la lecture avec proposition de restaurer, détection d'une
modification faite ailleurs (proposer de recharger plutôt que d'écraser). La
clé API n'y figure jamais.

### 8.3 Lieux connus
Tableau : nom, rayon, domicile, « toutes les photos à plat », **nombre de
photos du projet dans le rayon** (aperçu immédiat de l'effet du rayon).
Ajouter ou modifier un lieu :
1. **à partir d'une photo** prise à cet endroit ;
2. par **recherche d'adresse** ;
3. en **collant des coordonnées** ou un lien Google Maps.

Option avancée : carte (tuiles OpenStreetMap) pour voir et ajuster le cercle.
Contrôles : noms valides, chevauchements signalés, import et export de
`lieux_connus.csv` (format des anciens scripts). Création possible depuis
l'étape 5 (suggestions).

### 8.4 Calendriers
Ajouter un `.ics` (copié dans `config/calendriers/`), voir le nombre
d'événements et la période, activer ou désactiver, inclure les récurrents
(avancé : les anniversaires d'une année sur l'autre). Utilisés à l'étape
Lieux et sorties (ligne de temps, titres des journées), sur les cartes du tri
automatique (sans rien découper, D103), à la Consolidation (même événement au
même endroit, D106), au Nommage (titre de l'événement
proposé comme nom) et pour les textes de l'album (D83).

### 8.5 Appareils
Modèles détectés, décalage d'horloge (`+HH:MM`), surnom (« téléphone
d'Anna »).

### 8.6 Préréglages
Les préréglages « Année » et « Voyage » de `config.json` ne sont plus lus
(D58, D87) : les trois questions du Tri automatique les remplacent.
`prereglages` reste accepté dans le fichier, sans effet.

### 8.7 Propre au projet
Contexte (§ 6.1), budget, et **instantané de la configuration utilisée**
(`.album/config_utilisee.json`) à chaque validation d'étape : le projet reste
reproductible même si la configuration change.

## 9. Réglages (propres à chaque ordinateur)

Stockés dans le navigateur, jamais dans `config/` :
- **Clé API** : saisie masquée, « Tester ». Par défaut gardée **le temps de
  l'onglet** et redemandée à chaque session ; option « se souvenir de la clé
  sur cet ordinateur », décochée par défaut, avec avertissement : en
  `file://`, toute page HTML locale ouverte dans le navigateur peut lire ce
  qui est mémorisé ;
- **Modèles** par usage : rapide (gros volumes : étiquettes) =
  `claude-haiku-5-5`, standard (défaut) = `claude-sonnet-5-5`, avancé
  (doublons, nommage difficile, textes) = `claude-opus-5-5`. Liste et tarifs
  centralisés dans `app/src/lib/tarifs.ts`, modifiables ici ;
- **adresse e-mail pour Nominatim** (facultative) : identifie l'application
  auprès du service (paramètre `email`), indiquée dans la transparence des
  envois ;
- taux USD → CHF, seuil de confirmation, budget par défaut ;
- affichage : taille des miniatures, thème clair ou sombre.

## 10. Reprise des fonctions des scripts

Tout ce que faisaient les scripts est repris. Accès : **S** = réglage simple,
**A** = réglages avancés, **Auto** = géré par l'application.

| Script | Fonction ou option (défaut) | Étape | Accès |
|---|---|---|---|
| 01 | `--seuil-flou` (60) | 3 | S, curseur en direct |
| 01 | Voyages : un sous-dossier par étape ou un seul dossier (remplace `--sans-voyages`, D103) | 6 | S |
| 01 | `--distance-voyage` (50 au lieu de 30, D87 ; 30 / 50 / 100 km en crans, D104), maison par mois ou par semaine (D104) | 6 | S |
| 01 | Tri dans l'ordre du temps (D103) : trou de 3 h, même lieu à 5 km le lendemain, journée chargée de 10 photos à la maison, lieux connus et noms de fichiers toujours utilisés (mesurés sur 2024, 2025 et 2026, D104) | 6 | Auto |
| 01 | `--par-jour`, `--par-mois`, `--rayon-km`, `--gap-jours`, `--duree-max-jours`, `--gap-voyage-max` (le tri suit l'ordre du temps, D103) ; `--sans-evenement` (remplacé par un lieu connu « un seul dossier »), `--gap-voyage` (un retour à la maison coupe toujours le voyage, D87) | — | Retirés |
| 01 | `--maison-un-seul-dossier` | 8.3 | Par lieu connu |
| 01 | `--a-trier`, `--trier-mois`, `--tout-trier`, `--sans-copie-tries` | 2 | S, par sous-dossier |
| 01 | Géocodage français puis anglais, collisions de noms, inventaire | 4, 11 | Auto |
| 03 | Ordre jour / segments, `--ordre-strict-chrono` | 10 | Auto / A |
| 03 | `--textes`, `--part-commentaires` (0,15), `--photos-textes` (12) | 10 | IA12-13 |
| 03 | `--seuil-diversite` (20), `--fenetre-diversite` (45) | 9 | A (alerte de redondance) |
| 03 | `--decalage-appareil` | 2, 8.5 | S |
| 03 | Validation anti-redondance | 9 | IA11 (remarques seulement) |
| 04 | Nommage, `--photos-par-dossier` (5), `--sans-recherche-web`, `--tous-dossiers`, calendrier | 6 | IA4, A |
| 05 | `--fragments`, `--seuil-fragment` (5), `--fenetre-heures` (12) | 5 | IA3, A |
| 05 | Consolidation, `--seuil-planche` (8), `--lister` | 7 | IA6 / manuel |
| 06 | `--agressif` | 8 | S (Prudent / Strict) |
| 06 | `--par-vue` (24), `--taille-vue` (220), `--colonnes-vue` (6), `--par-verif` (6), `--taille-verif` (520), `--distance-scene` (20), `--distance-hash` (12), `--fenetre-min` (10) | 8 | A |
| 06 | `--reanalyser` | 8 | Bouton par dossier |
| 06 | `--numeroter` | 11 | Auto (numérotation de l'album) |

**Volontairement non repris** :
- la **sélection automatique** des scripts 02 et 03 (notes, importances,
  plafonds, cible imposée) : remplacée par la boîte à outils et les aides IA
  de l'étape 10 (principe P5) ;
- `--deplacer` : contraire à P4 ;
- `--maison`, `--rayon-maison`, `--nom-maison` : hérités, remplacés par un lieu
  connu « domicile » ;
- `--qualite-jpeg` : l'album copie les originaux sans recompression ;
- `--dry-run`, `--estimer`, `--appliquer` : remplacés par les aperçus,
  estimations et boutons de validation.

## 11. Algorithmes

Référence : `docs/REFERENCE_SCRIPTS.md` et le code des scripts d'origine
(non publiés). Les consignes IA existantes sont reprises mot pour mot.

| Étape | Référence | Particularités navigateur |
|---|---|---|
| 2, 3 | 01 | `exifr` pour l'EXIF ; netteté = variance du Laplacien sur l'image réduite à **1024 px** (comme le script 01, d'où vient le seuil 60) ; **voie rapide** en Web Worker : le navigateur décode directement à 1024 px, netteté et phash sont calculés sur cette image (≤ 2 bits d'écart avec le calcul complet) ; empreinte de fichier (SubtleCrypto) en trois temps : taille, début et fin, puis contenu complet pour les candidats |
| 4 | 01 | DBSCAN haversine ; Nominatim français puis anglais si nom non latin, 1 requête/s, cache |
| 5, 7 | 05 | Voisins temporels classés par phash |
| 6 | 04 | Recherche web via l'outil côté API ; analyse `.ics` |
| 8 | 06 | À l'identique : rafales, vue d'ensemble (toutes les planches dans un appel), scènes locales, vérification (6 photos max, 520 px, heure sur les vignettes), garde-fou des descriptions, règles de refus |
| 9 | 03 (diversité) | Redondance, équilibre |
| 10 | 03 | Ordre jour / segments |

**Phash** : calcul identique à `imagehash.phash` (niveaux de gris, Lanczos
32×32, DCT 2D, bloc 8×8, médiane ; 0 bit d'écart vérifié), sur l'image **à
l'endroit**. Les seuils 12 et 20 sont conservés (vérifiés sur 8568 paires de
photos de 2025). **Orientation** : `createImageBitmap`
applique l'orientation EXIF (incident I14) ; photos à l'endroit partout.
**Réponses IA** : réparation JSON en 5 niveaux puis validation de structure
(incident I12).

## 12. Dossier de sortie

```
<sortie>/
├── .album/                      état du projet (masqué)
│   ├── projet.json              étapes, préréglage, contexte, budget, coûts
│   ├── plan.json                toutes les décisions (dossiers, statuts, étoiles, légendes…) et la date de modification d'origine de chaque fichier
│   ├── etat_sortie.json         ce qui a été écrit dans la sortie (synchronisation relançable)
│   ├── config_utilisee.json     instantané de la configuration
│   ├── cache_ia.json            réponses IA
│   ├── analyse.json             netteté, ressemblance (phash) et exposition de chaque photo
│   ├── doublons.json            propositions de l'étape 4 et scènes repérées
│   ├── album.json               réglages de l'album (ordre, sections, titres, cible, couverture)
│   ├── aides.json               propositions et remarques des aides IA (noms, étiquettes, textes…)
│   ├── geocodage.json           cache Nominatim
│   ├── adresses.json            adresses précises des lieux fréquents
│   └── journal.jsonl            activité, coûts, alertes
├── Photos/                      l'ARCHIVE triée : remplace la source
│   ├── <sorties>/               photos et vidéos de chaque sortie
│   ├── Captures_ecran/
│   └── _videos_non_classees/AAAA-MM/
├── Album/                       la SÉLECTION, prête pour ifolor
│   ├── 0001_20260711_Arrivee_Bangkok.jpg …   ordre de l'album, originaux
│   ├── (option) un sous-dossier par section
│   └── textes_album.md          titres, introductions, légendes
├── _mis_de_cote/
│   ├── floues/  doublons/  doublons_exacts/  autres/
├── _autres_fichiers/            fichiers non photo/vidéo, chemins d'origine préservés
└── Rapport.html                 bilan lisible dans un navigateur
```

- **Contrôle de la source** (D63) : après l'écriture, la source est relue ;
  un fichier qui n'est pas dans le projet (arrivé ou modifié depuis
  l'inventaire) empêche d'annoncer qu'on peut supprimer la source, dans le
  bilan comme dans le rapport.
- **Vidéos** : rangées dans la sortie dont la période contient leur date (à
  quelques heures près), sinon dans `_videos_non_classees/`.
- **Dates des fichiers** : la copie porte la date du jour (le navigateur ne
  peut pas fixer la date de modification). La date d'origine est consignée
  dans `.album/plan.json` et `Rapport.html`.
- `_mis_de_cote/` garde les chemins relatifs : un glisser-déposer suffit à
  remettre une photo.
- La numérotation de `Album/` garantit l'ordre à l'import. Les légendes sont
  fournies dans `textes_album.md` (copier-coller dans ifolor).
- **Projet en anglais** (D60) : mêmes emplacements, noms anglais pour ce que
  l'application crée : `_set_aside/` (`blurry/`, `duplicates/`,
  `exact_duplicates/`, `other/`), `_other_files/`, `Photos/Screenshots/`,
  `_no_date/`, `No_place/`, `Trip_…`, `Place_03`, `_unsorted_videos/`,
  `Album/album_texts.md`, `Album/0000_Cover`, `Report.html`. `Photos/`,
  `Album/` et `.album/` ne changent pas. La langue est fixée à la création du
  projet : changer la langue de l'interface ne renomme rien.

## 13. Exigences non fonctionnelles

**Convivialité** (exigence principale) :
- un membre de la famille trie un dossier de voyage seul, en suivant
  l'assistant ;
- déplacer des photos vers un dossier en un geste, partout ;
- bulle d'aide par réglage ; chaque alerte dit quoi faire ;
- confirmations seulement pour l'écriture (étape 12) et les dépenses IA
  au-dessus du seuil ;
- annulation, sauvegarde automatique, raccourcis clavier ;
- largeur d'écran minimale 1366 px.

**Performance** :
- miniatures via `createImageBitmap(..., {resizeWidth})` ; **cache de
  miniatures dans le stockage privé du navigateur** (Origin Private File
  System), **ou dans IndexedDB quand la page est ouverte en `file://`** (OPFS
  y est refusé), pour garder `.album/` léger (quelques Mo) ;
- Web Workers « classiques » (un worker « module » est refusé en `file://`) ;
- grilles virtualisées ;
- inventaire de 5000 photos en moins de 30 min (mesuré en phase 0 : environ
  1 min sur un ordinateur récent) ;
- déplacement de 500 photos dans le plan instantané.

**Robustesse** : aucune réponse IA ne fait planter l'application ; étapes
longues interruptibles et reprises sans repayer ; 2 à 4 appels IA simultanés,
attente sur les erreurs 429/529.

**Sécurité et vie privée** :
- la clé API reste dans le navigateur, le temps de la session par défaut
  (§ 9), et ne part que vers `api.anthropic.com` ;
- l'interface indique ce qui est envoyé à l'IA et à Nominatim ;
- `config/` n'est jamais publié.

## 14. Tests et critères d'acceptation

**Tests automatiques (vitest)** :
- phash (vecteurs de référence calculés en Python, écart ≤ 2 bits),
  Laplacien ;
- dates tirées des noms de fichiers et des vidéos, doublons exacts ;
- DBSCAN, sorties, voyages, lieux connus ;
- `.ics` ;
- `config.json` (lecture, validation, migration) ;
- réparation JSON (I12), garde-fou des descriptions (I7) ;
- opérations sur le plan (déplacer, fusionner, créer un dossier, annuler) ;
- redondance, ordre jour / segments (I2) ;
- synchronisation de la sortie (idempotente) et bilan.

**Critères d'acceptation** (photos de `tests/photos_reelles/` et un dossier de
voyage complet) :

| # | Critère |
|---|---|
| A1 | La source est identique avant et après |
| A2 | Bilan : chaque fichier de la source (photos, vidéos, autres) est retrouvé dans la sortie ; un fichier manquant empêche le message « vous pouvez supprimer la source » |
| A3 | Étape 6 : chaque dossier prévu affiche dates, nombre de photos et miniatures ; un dossier de 1-2 photos porte le badge « petit dossier » |
| A4 | Sélectionner 20 photos et les glisser sur un dossier du panneau : compteurs et dates mis à jour, Ctrl+Z annule |
| A5 | Un lieu connu ajouté à partir d'une photo regroupe aussitôt les photos concernées et est retrouvé sur un autre ordinateur |
| A6 | Photo WhatsApp sans EXIF : date tirée du nom ; même photo en double (originale + WhatsApp) : détectée, l'originale est gardée |
| A7 | Photos de Koh Samui (`20260718_*`) : dossier nommé d'après un lieu réel (I3) |
| A8 | Doublons : Angthong 0181/0182/0183 → un seul gardé ; 0193/0194 → une seule gardée ; planche pont/rocher → les deux scènes survivent (I7) |
| A9 | Ordre de l'album Kanchanaburi : 14 → 15 (rivière) → 16 (09:43 puis 09:47) (I2) |
| A10 | Chaque fonction IA affiche son coût estimé avant lancement ; le budget atteint met en pause |
| A11 | Onglet fermé pendant une fonction IA → reprise sans repayer |
| A12 | Photos à l'endroit sur toutes les planches et miniatures (I14) |
| A13 | Deuxième synchronisation sans changement : aucun fichier recopié |
| A14 | Un membre de la famille qui découvre l'application trie un dossier de voyage et prépare l'album seul |

## 15. Feuille de route

Chaque phase livre une application utilisable.

| Phase | Contenu | Résultat |
|---|---|---|
| **0 — Prototype** | Dossier local, dossier `config/`, EXIF, miniature orientée, copie, appel API (avec image et recherche web), Nominatim ; mesures | **Fait** (21.10.2026) : go |
| **1 — Ossature** | Accueil, écran « Reprendre », projet, Réglages, Configuration, bandeau d'étapes, gabarit, **« Ouvrir un dossier déjà trié »**, **panneau des dossiers et déplacement**, **création de la sortie avec bilan** | Réorganiser un dossier déjà trié et produire une sortie complète |
| **2 — Doublons et sélection** | Étape 8 ; étape 9 (outils locaux) ; étape 10 sans IA (ancienne numérotation) (ordre, sections, légendes manuelles, aperçu paginé) | **Livrée** (21.10.2026), à valider avec la vraie API : album Thaïlande réalisable (D33 à D38) |
| **3 — Tri complet** | Étapes 2, 3, 4 ; lieux connus et calendriers complets | **Livrée** (22.10.2026), à valider : partir d'un dossier en vrac (D39 à D44, D48) |
| **4 — IA d'organisation** | Étapes 5, 6, 7 ; IA1, IA2, IA5 | **Livrée** (22.10.2026), à valider avec la vraie API : tous les scripts remplacés (D45) |
| **5 — IA de sélection et d'album** | IA8 à IA15, recherche en langage naturel | **Livrée** (22.10.2026), à valider avec la vraie API : toutes les aides (D46, D47) |

## 16. Points vérifiés en phase 0

Mesures de la phase 0, en bref :

| # | Point | Réponse |
|---|---|---|
| 1 | Dossier local de 5000 photos | 3610 fichiers (36 Go) inventoriés en ≈ 19 s ; copie de 100 à 135 Mo/s ; déplacement instantané |
| 2 | Mémorisation des dossiers | Retrouvés ; en `file://`, accès redemandé à chaque session (écran « Reprendre ») |
| 3 | `file://` | Fonctionne ; pas d'OPFS (IndexedDB), workers classiques, stockage partagé entre pages locales (clé de session) |
| 4 | API depuis le navigateur | SDK officiel, `dangerouslyAllowBrowser` ; image et recherche web ✓ ; **API de lots refusée (CORS)** |
| 5 | Nominatim | CORS ✓, 1 requête/s, e-mail facultatif |
| 6 | Mémoire et durée | 2000 miniatures en < 20 s, grille à 60 images/s, onglet ≈ 150 Mo |
| 7 | Vidéos Samsung, HEIC | Dates : § 6.2 ; aucun HEIC, pas de décodeur |

## 17. Risques

| Risque | Mesure |
|---|---|
| Ampleur du projet (treize étapes, quinze fonctions IA) | Phases livrant chacune une application utile ; IA en dernier |
| Espace disque local (la sortie double temporairement le volume) | Taille à écrire affichée avant l'étape 12 |
| Onglet à garder ouvert pendant les longues étapes | Reprise sans perte ; appels IA courts, mis en cache au fil de l'eau |
| Autorisations redemandées à chaque session (`file://`) | Écran « Reprendre » ; publication sur une adresse https possible plus tard sans réécriture |
| Coût IA | Estimation avant chaque lancement, budget du projet, cache |
| Perte de données si la source est supprimée trop tôt | Bilan fichier par fichier (A2) ; message seulement si tout est retrouvé |
| Vie privée | Transparence sur les envois ; `config/` jamais publié |
