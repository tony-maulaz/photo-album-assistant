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
| 3 | **Dossiers** | Pour chaque sous-dossier d'un dossier en vrac : Trier, Garder et nettoyer, ou Ne pas toucher ; sautée sans sous-dossier et pour un dossier déjà trié | Tableau des sous-dossiers, trois boutons par ligne (§ 6.2) | — |
| 4 | **Photos floues** | Classement par netteté | Grille des floues, curseur avec mise à jour en direct | Option : vérification IA des cas limites |
| 5 | **Doublons** | Copies exactes, rafales (local), puis vue d'ensemble et vérification (IA), par dossier, ou par journée pour un dossier en vrac (§ 6.8) | Onglets par sorte, relecture journée par journée, un clic par photo | Oui |
| 6 | **Tri automatique** | Captures d'écran rangées à part, lieux fréquents à enregistrer, réglages, regroupement GPS, sorties, voyages, noms de lieux ; inutile pour un dossier déjà trié | Résumé du tri (§ 6.4) | Option : lieu des photos sans GPS |
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
  dossiers. Le panneau s'élargit en tirant son bord droit (largeur gardée).
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
- **Ligne de temps** : journées en colonnes, dossiers en blocs, événements du
  calendrier en bandeau.

## 6. Pages d'étape

### 6.1 Étape 1 — Projet
- **Dossier à trier** (lecture seule, rappelé) et **dossier de sortie**
  (refus si l'un contient l'autre).
- **Préréglage** : Année, Voyage, ou personnalisé (§ 8.6).
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
- **Ne pas toucher** : recopié tel quel, ni floues ni rafales cherchées (une
  sélection « Best of », des scans).
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
groupées, les dossiers déjà faits ne bougent pas.

Deux pages (D54) : le **tri automatique** (captures d'écran parmi les photos
à trier, rangées à part dans `Captures_ecran/` hors de l'album ; lieux
fréquents à enregistrer ; réglages, calcul, résumé, photos sans GPS), puis **Lieux et
sorties**, la page de travail (panneau des dossiers et photos sur toute la
hauteur, explication ouverte à la première visite seulement).

**Réglages simples** : précision des lieux (curseur → rayon en km), un
dossier par jour, détecter les voyages, utiliser les lieux connus.

**Aperçu : l'arborescence prévue.** Pour chaque dossier qui sera créé :
- nom prévu, **dates (du–au)**, **nombre de photos**, lieu, origine (lieu
  connu, GPS, voyage, sans GPS, sous-dossier gardé), 4 à 6 miniatures ;
- **badges d'alerte** : **petit dossier** (moins de 3 photos, réglable), lieu
  inconnu, photos sans date, nom en double, très grand dossier (plus de 200),
  chevauchement dans le temps ;
- **événements du calendrier** correspondant aux dates.

**Vues** : arborescence, ligne de temps, filtre « seulement les alertes ».
**Corrections** : panneau des dossiers et déplacement (§ 5.3), fusionner,
scinder par jour, renommer, mettre dans `_autres/`, annuler.
**Suggestion de lieux connus** : un groupe GPS qui revient sur de nombreux
jours (maison, grands-parents, école, club) est proposé à l'enregistrement
avant le calcul, sur la page du tri automatique.
**IA (option)** : **situer les photos sans GPS** d'après leur contenu et les
photos prises juste avant et après ; proposition de rattachement.

### 6.5 Étape 8 — Petits dossiers (IA)
Chaque petit dossier à côté du dossier proposé, avec la raison :
« Rattacher », « Garder à part », « Rattacher à un autre… ». « Tout accepter »
pour les propositions sûres. Sans IA : les voisins dans le temps sont
présentés, l'utilisateur décide.

### 6.6 Étape 9 — Nommage (IA)
- Tableau : miniatures, nom actuel, **nom proposé modifiable**, confiance,
  justification, événement du calendrier utilisé, **monuments ou lieux
  reconnus**.
- L'IA combine les photos, le GPS, le calendrier, le contexte du projet et
  une **recherche web** (événements locaux, lieux touristiques, résultats de
  course…).
- Tri par confiance croissante ; « Accepter les noms de confiance ≥ 8 ».
- Convention `Theme_Lieu_JJ.MM.AA`, sans accents ni espaces, correction
  proposée.

### 6.7 Étape 10 — Consolidation
Groupes proposés à la fusion, côte à côte (nom, dates, nombre de photos,
miniatures, nom cible modifiable). Fusion manuelle par glisser-déposer. Sans
IA : noms proches et chevauchements présentés côte à côte.

### 6.8 Étape 5 — Doublons (IA)
- **Onglets** (D71), un par sorte de doublons, chacun avec ce qui reste à
  relire : **Copies exactes**, **Dans plusieurs dossiers**, **Rafales**,
  **Même scène (IA)**, **Mis de côté** (tout ce que l'étape a écarté, à
  remettre d'un clic). En haut, toujours visibles : Afficher (À relire,
  Relus, Tous), Classer, l'avancement et « Accepter les propositions » de la
  journée affichée. À gauche, la liste des journées (puis des dossiers
  gardés, puis des photos sans date) ; on relit une journée à la fois.
  Au-delà de 20 entrées (une année), la liste passe aux mois.
- **Un groupe par carte** : heure, sorte, emplacement, proposition. Chaque
  photo a une proposition (garder ou écarter) et un état lu dans le plan :
  gardée, écartée, ou « à écarter » tant que la proposition n'est pas
  acceptée. Un clic sur n'importe quelle photo, la ★ comprise, inverse ce
  qu'on voit ; **Accepter**, **Tout garder**, **Tout écarter**, **Comparer
  en grand** (zoom synchronisé, groupe suivant, « Accepter et groupe
  suivant »). Rien ne disparaît : un groupe accepté se replie à sa place.
  Un groupe non relu garde ses photos dans l'archive. Tout s'annule
  (Ctrl+Z). Clavier : J et K, ← et →, Espace, A, C, N et P.
- **Copies exactes** sur tout le projet, quels que soient le dossier et la
  date (D61) : même contenu (empreinte du fichier) ou **même photo en
  version réduite** (WhatsApp : très semblable, dimensions plus petites,
  sans EXIF). Proposition : le meilleur exemplaire de chaque emplacement (un
  dossier qui garde sa place, ou les photos à trier) est gardé ; les copies
  d'un même emplacement et les versions réduites vont dans
  `_mis_de_cote/doublons_exacts/`. Une photo déjà rangée dans un dossier
  « Garder, nettoyer » n'est pas triée une seconde fois ; si ce dossier n'en
  a qu'une version réduite, l'original y prend sa place. Une photo présente
  dans plusieurs dossiers gardés (une sélection `BESTOF` faite de copies)
  reste entière : onglet « Dans plusieurs dossiers ». Tous les exemplaires
  peuvent être écartés. Les vidéos et autres fichiers ne sont que copiés,
  contrôlés par leur taille.
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

**Recadrage** (D62) : « Recadrer… » ou la touche K sur une photo retenue
ouvre la photo en grand avec un cadre à tirer, des formats (libre, 3:2, 4:3,
carré, portrait ou paysage) et un curseur « Redresser » (±15°). Seule la
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
(avancé). Utilisés aux étapes 4 (information), 6 (nommage) et 10 (textes).

### 8.5 Appareils
Modèles détectés, décalage d'horloge (`+HH:MM`), surnom (« téléphone
d'Anna »).

### 8.6 Préréglages
« Année » et « Voyage » modifiables ; on peut en créer d'autres
(« Week-end », « Camp de ski »).

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
| 01 | `--rayon-km` (2), `--par-jour`, `--sans-voyages`, `--lieux-connus` | 4 | S |
| 01 | `--sans-evenement`, `--par-mois`, `--gap-jours` (30), `--duree-max-jours` (21) | 4 | A |
| 01 | `--distance-voyage` (30), `--gap-voyage` (1), `--gap-voyage-max` (7), `--sans-noms-fichiers` | 4 | A |
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
- opérations sur le plan (déplacer, fusionner, scinder, annuler) ;
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
