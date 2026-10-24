# Décisions, calibrations et incidents

À lire avant de modifier un seuil ou une consigne. Chaque entrée dit **ce qui
a été décidé**, **pourquoi**, et souvent **ce qui a échoué avant**.

## 1. Décisions de conception

**D1 — Pipeline hybride local + IA, qualité avant coût.** Le local (EXIF,
netteté, hachage) élimine gratuitement l'évident ; le modèle juge ce qui
demande de la compréhension. Le budget API est accepté si le résultat est
meilleur : plusieurs passes valent mieux qu'une économie qui dégrade le tri.

**D2 — Planches-contact numérotées.** Le modèle juge mieux des photos vues
ensemble (doublons, redondances) qu'une par une, et pour moins cher.

**D3 — La famille choisit, le modèle nettoie (script 06).** La sélection
automatique du script 03 (cible, notes, plafonds) a été testée en famille et
jugée insatisfaisante : choisir les moments importants est subjectif. Le
script 06 ne fait que l'objectif (doublons), sans quota, et laisse une
arborescence propre et chronologique. Le script 03 reste disponible.

**D4 — Marquage par renommage, puis déplacement (scripts ; l'application procède autrement, D20).** Relire des fichiers
renommés dans l'explorateur, miniatures sous les yeux, est plus naturel qu'un
CSV ; sauver une photo = retirer le suffixe. Suffixe `_doublon` et non
`_a_supprimer`, pour ne pas le confondre avec le dossier des floues du
script 01. Les doublons sont déplacés dans `_doublons/`, jamais supprimés.

**D5 — Mode conservateur par défaut.** Des expressions différentes des mêmes
personnes dans la même scène ne sont pas des doublons. `--agressif` existe
pour l'inverse.

**D6 — Vue d'ensemble puis vérification.** Voir incidents I5 et I6. La vue
d'ensemble (petites miniatures, tout le dossier, un seul appel) repère les
scènes qui se répètent même à une heure d'écart. Elle ne décide rien. La
vérification (grand format, 6 photos max) décide, et peut répondre « ce ne
sont pas des doublons ». Plusieurs planches dans un même appel plutôt qu'une
planche géante : l'API réduit les images (environ 1500 px de côté à l'époque
des scripts, 2576 px et 4784 jetons au plus sur les modèles actuels), une
planche de 150 vignettes resterait illisible. La limite de 6 photos par
décision (I5) ne dépend pas de cette taille.

**D7 — Numérotation par préfixes.** Les explorateurs et ifolor trient par nom :
`01_` (dossiers) et `001_` (photos) donnent l'ordre chronologique, le nom
d'origine restant lisible derrière. Étape séparée, idempotente.

**D8 — Ordre de l'album (script 03).** Journées strictement croissantes ; dans
une journée, segments d'activité contigus ; une sortie sur plusieurs jours
forme un segment par jour. Voir I2.

**D9 — Tri des voyages : rayon fin + découpage par jour, puis consolidation.**
`--rayon-km 2 --par-jour` sépare les lieux et les journées. Ce découpage
éclate certaines activités mobiles (vols, bateaux) ; d'où le script 05 :
`--fragments` **avant** le nommage (moins de dossiers à nommer, chaque
activité nommée en voyant toutes ses photos), consolidation des variantes de
noms **après**.

**D10 — Fragments jugés par l'image et par le temps.** Un fragment n'est
comparé qu'à ses voisins temporels (fenêtre de 12 h), classés localement par
ressemblance ; la question posée au modèle est simple (« ces photos font-elles
partie de l'un de ces dossiers ? »), avec abstention en cas de doute.

**D11 — Le nommage utilise le calendrier familial et la recherche web.** Un
fichier `.ics` exporté (événements à ±1 jour, les récurrents ignorés) et 3
recherches web max par dossier. Résultats réels très bons (course identifiée
par un dossard, vol retrouvé grâce au calendrier). Les confiances basses (4-5)
sont à relire en priorité.

**D12 — Fichiers de décision éditables partout.** `evenements.csv`,
`groupes.csv`, `renommages.csv`, `fusions.csv`, `doublons.csv` : l'utilisateur garde la
main, rien n'est appliqué sans relecture.

**D13 — Application navigateur sans serveur.** La famille doit pouvoir
l'utiliser où elle veut, sans installation : calcul local dans le navigateur,
IA à distance via l'API Claude avec la clé de l'utilisateur. Contrainte
acceptée : Chrome ou Edge sur ordinateur.

**D14 — Application conviviale et guidée.** Assistant en onze étapes reprenant
tout ce que faisaient les scripts ; réglages simples par défaut, avancés
repliés ; une page par fonction ; langage sans jargon.

**D15 — Voir avant de valider.** Chaque étape montre l'état qui en résultera,
avec dates, nombre de photos et miniatures par dossier ; un dossier de 1 ou 2
photos doit sauter aux yeux pour être rattaché ailleurs.

**D16 — Source intouchable, dossier de sortie.** L'utilisateur supprime la
source lui-même quand le résultat lui convient.

**D17 — L'application remplace les scripts.** Les scripts Python ne sont plus
utilisés ni maintenus, ni publiés ; ils ont servi de référence au
portage. Conséquence : plus aucune contrainte de compatibilité de formats
(suffixe `_doublon`, CSV des scripts), et une seule implémentation des
consignes IA.

**D18 — Pas de sélection automatique, une boîte à outils.** La sélection
automatique (scripts 02 et 03) n'est pas reprise (voir D3). À la place : tri
rapide au clavier, piles de photos semblables, comparateur synchronisé,
indicateurs techniques, alerte de redondance, équilibre par sortie, cible en
pages ifolor, deux niveaux d'étoile, et aides IA qui décrivent ou commentent
sans jamais cocher à la place de l'utilisateur. Un seul utilisateur : pas de
sélection à plusieurs.

**D19 — Configuration commune dans `config/`.** Un fichier JSON
dans un dossier `config/` à côté de l'application. Retenue avec trois
ajustements :
1. une page web ne peut pas trouver seule son dossier : on choisit `config/`
   une fois par ordinateur ;
2. un fichier dans un dossier, plutôt que le stockage du navigateur (fragile,
   perdu si on vide le cache) ; pour un autre ordinateur, on copie le dossier
   de l'application ;
3. jamais de clé API dedans, et un instantané par projet.

Calendriers en fichiers `.ics` séparés. Le domicile est un attribut explicite
d'un lieu connu (et non plus « la première ligne du CSV »). Les critères de
sélection ont disparu avec la sélection automatique. `config/` contient des
coordonnées personnelles : jamais dans un dépôt.

**D20 — Un plan, une écriture.** Toutes les décisions vivent dans le plan du
projet ; la sortie est écrite par une synchronisation relançable. Comme la
compatibilité avec les scripts n'est plus requise, plus de renommage
`_doublon` sur le disque. Gains : aperçus instantanés, retour en arrière sans
risque, une seule copie, plus de fichiers à moitié
renommés après un plantage (I11).

**D21 — Tout copier et prouver.** Les scripts laissaient vidéos et autres
fichiers dans la source : supprimer la source comme prévu les aurait perdus.
L'application copie tout (vidéos rangées avec leur sortie) et un bilan
fichier par fichier conditionne le message « vous pouvez supprimer la
source ». La sortie distingue l'**archive** (`Photos/`, qui remplace la source)
et l'**album** (`Album/`, la sélection numérotée).

**D22 — L'IA à la carte, budget assumé.** Avec une clé API, toutes les aides IA
utiles sont proposées (catalogue IA1 à IA15 : étiquettes, appréciation,
lieux et monuments avec recherche web, légendes, couverture, contrôles…).
L'utilisateur choisit ce qu'il lance et voit ce qu'il paie : environ 50 CHF
par album est acceptable si l'on gagne du temps. Garde-fous : estimation avant
lancement, budget du projet, cache.

**D23 — Déplacer des photos en un geste.** Panneau des dossiers de destination
toujours visible : sélectionner des photos et les glisser sur un dossier, ou
touche M / touches 1-9, partout dans l'application.

**D24 — Inventaire enrichi.** Avec deux téléphones et WhatsApp : doublons
exacts entre dossiers (y compris versions réduites), date tirée du nom de
fichier quand l'EXIF manque, captures d'écran repérées et exclues de l'album
(souvenir du dossier VideoCapture, I12).

**D25 — Accès local uniquement.** Tout se fait sur des dossiers locaux. Une fois
le tri terminé, l'utilisateur copie lui-même la sortie sur le NAS : l'accès
réseau et la synchronisation avec le NAS ne font pas partie du projet. Le message final
rappelle simplement de copier la sortie à son emplacement définitif avant de
supprimer la source.

### Décisions de la phase 0 (21.10.2026)

Prises après les mesures de la phase 0 (propositions P1 à P20, rapport non publié).

**D26 — Fichier ouvert par double-clic, écran « Reprendre ».** La page reste
un fichier HTML unique ouvert en `file://` (pas d'hébergement, fonctionne hors
ligne). Prix à payer : Chrome redemande l'accès à chaque dossier à chaque
session (une demande simple, sans « Autoriser à chaque visite », qui n'existe
qu'avec une adresse http ou https). Un écran « Reprendre » regroupe ces 2 ou
3 clics. Publier la page sur une adresse https reste possible plus tard sans
réécriture (P20).

**D27 — Pas de mode lots.** L'API de traitement par lots refuse le CORS pour
toute origine (« Disallowed CORS origin », vérifié). Les gros traitements se
font par 2 à 4 appels simultanés ; avec les tarifs des modèles 5.5,
l'économie perdue est de quelques francs par album (P17).

**D28 — Clé API le temps de la session.** En `file://`, toutes les pages HTML
locales partagent le même stockage : une clé mémorisée serait lisible par
n'importe quel fichier HTML ouvert dans Chrome. La clé est donc gardée le
temps de l'onglet, avec une option « se souvenir » décochée par défaut (P12).

**D29 — Calculs identiques aux scripts, voie rapide.** Phash et netteté sont
portés à l'identique (0 bit d'écart, netteté à moins de 1 %). La netteté se
mesure à 1024 px, taille du script 01 d'où vient le seuil 60. L'inventaire
décode les photos à 1024 px directement dans le navigateur, trois fois plus
vite que le décodage complet, pour au plus 2 bits d'écart sur le phash. Le
phash est calculé sur l'image à l'endroit ; les seuils 12 et 20 restent
valables (P1 à P3).

**D30 — Dates.** La copie ne conserve pas la date de modification (limite du
navigateur) : elle est consignée dans `.album/plan.json` et `Rapport.html`, et
les fichiers sans autre date sont signalés (18 photos sur 3213 en 2025). Pour
les vidéos Samsung : le nom donne l'heure locale de début, la date interne
l'heure UTC de fin (P6, P7).

**D31 — Doublons exacts : photos seulement, jamais dans un dossier gardé tel
quel.** 2025 contenait 359 doublons exacts, surtout une photo et sa copie
renommée dans le même dossier, mais aussi 75 copies voulues dans
`BESTOF_2025`. Les vidéos ne sont que copiées (P5, P19).

**D32 — Modèles 5.5.** Rapide = Haiku 5.5, standard = Sonnet 5.5, avancé =
Opus 5.5 ; sorties structurées, `effort` par fonction, consignes revalidées
avant la phase 4 (P8, P9).

**Abandonné** : enchaînement automatique de toutes les étapes (« tout
enchaîner ») ; sélection à deux ; pré-sélection automatique ; mode lots
(D27).

### Décisions de la phase 2 (21.10.2026)

**D33 — Doublons : propositions à part, décisions dans le plan.** Les
propositions de l'étape 8 (groupes, raisons, scènes) sont dans
`.album/doublons.json` ; les décisions sont des opérations du plan, donc
annulables par Ctrl+Z et écrites par la synchronisation comme le reste :
« écarter » met la photo de côté (`_mis_de_cote/doublons/`), « garder aussi »
la protège pour toujours (I10). Relancer l'analyse garde les groupes déjà
acceptés.

**D34 — Cache IA par modèle et par identité des photos.** Clé = fonction,
modèle, puis l'identité de chaque photo (empreinte du chemin d'origine,
taille, date du fichier), jamais son chemin dans le plan : déplacer une photo
ne fait pas repayer. Une réponse illisible ou refusée est payée : elle est
gardée (`null`) et un bouton « Redemander les réponses illisibles » l'oublie.
Limite connue : la vue d'ensemble porte sur les photos restantes du dossier ;
après avoir écarté des doublons, réanalyser ce dossier coûte à nouveau (le
script 06 faisait de même).

**D35 — Garde-fou des descriptions : apostrophe typographique.** Le script
supprime « ’ » avec les accents : « l’archipel » devient « larchipel » et ne
correspond plus à « archipel ». L'application en fait un séparateur de mots,
comme « ' ». Seul écart volontaire au portage du script 06.

**D36 — Album/ : copies gérées par l'application.** `Album/` ne contient que
des copies dérivées de la sélection, suivies dans `etat_sortie.json` : elles
sont renommées quand l'ordre change (en deux temps, pour pouvoir échanger deux
noms), retirées quand une photo quitte l'album (I1), et ne comptent pas dans
le bilan de la source. Un fichier que l'application n'a pas écrit n'est
jamais touché. La rotation ne change que la balise Orientation de la copie
(même taille, pas de recompression) ; une photo sans balise est copiée telle
quelle et signalée.

**D37 — Coût de l'IA des doublons.** Estimation majorante affichée avant
lancement : vue d'ensemble de chaque dossier (rafales retirées, dossiers déjà
en cache gratuits), une vérification pour 4 photos sur 10, 1500 jetons de
sortie par appel (réflexion comprise). Modèle standard par défaut (Sonnet
5.5), effort moyen ; Sonnet 4.6, modèle de calibration des consignes, reste
au choix dans les réglages avancés de l'étape. Ordre de grandeur pour le
voyage en Thaïlande (1600 photos) : 2 à 5 CHF au plus.

Validé le 21.10.2026 au soir : Sonnet 5.5 pour les doublons (D37),
réanalyse payante après relecture acceptée (D34).

**D38 — Piles de l'étape 9.** Une pile réunit les scènes repérées à l'étape 8
et les photos semblables d'une même sortie (distance ≤ 20, à moins de 45 min,
seuils de diversité du script 03). La photo visible d'une pile est une photo
retenue si possible, sinon la première.


### Décisions des phases 3 à 5 (nuit du 21 au 22.10.2026)

Prises pendant la réalisation des phases 3 à 5 en une nuit, à la demande de
l'auteur ; à confirmer à l'essai.

**D39 — Dossier en vrac : trois traitements des sous-dossiers.** Les photos
à la racine sont triées ; les sous-dossiers existants (nommés ou de mois) sont
« gardés tels quels » par défaut (§ 6.2), au choix « à trier » ou « gardés
hors de l'album ». Un dossier gardé tel quel n'est jamais modifié : ni
floues, ni doublons exacts, ni tri ; « hors de l'album » l'exclut en plus des
doublons et de la sélection. Rien n'est ignoré au sens « non copié » (règle
d'or 2).

**D40 — Floues appliquées à la validation.** Le curseur ne change rien au
plan tant que l'étape 3 n'est pas validée : le compteur est en direct, la
décision une seule opération annulable. Une photo garde la trace de la façon
dont elle a été écartée (seuil, à la main) ou sauvée ; une photo écartée par
un ancien script (`_a_supprimer`) ne revient que si on la sauve. Les captures
d'écran ne sont pas concernées.

**D41 — Tri par lieux : relancer remplace.** « Recalculer l'arborescence »
range à nouveau toutes les photos à trier (avec confirmation : les corrections
à la main faites depuis sont remplacées, Ctrl+Z annule). Seules les
coordonnées moyennes de chaque groupe partent vers OpenStreetMap, une par
seconde, gardées dans `.album/geocodage.json`. Sans domicile marqué, pas de
détection des voyages (D19).

**D42 — Vidéos.** Rangées avec la photo prise le plus près dans le temps (à
3 h près), sinon dans `_videos_non_classees/AAAA-MM` (§ 12).

**D43 — Doublons exacts.** Empreinte SHA-256 calculée seulement pour les
photos de même taille. Copie réduite (WhatsApp) : sans EXIF, plus petite,
même rapport des côtés à 2 % près et phash à 4 bits au plus ; une photo avec
EXIF n'est jamais une copie réduite (ce sont les rafales de l'étape 8). Un
dossier gardé tel quel est exclu entièrement (D31).

**D44 — Badge « chevauche ».** Seulement si les photos de deux dossiers
voisins s'entremêlent dans le temps (A, puis B, puis A) : deux sorties le
même jour, l'une après l'autre, sont normales.

**D45 — Aides IA : un catalogue, un exécuteur.** Chaque aide est déclarée une
fois (nom, étape, ce qui est envoyé, estimation, lancement) : la page
« Fonctions IA » et les boutons des étapes en découlent. Les propositions
sont gardées dans `.album/aides.json`, les décisions dans le plan. Clé de
cache : fonction, modèle, identité des photos et empreinte de la consigne
(une consigne modifiée repaie, un déplacement non).

**D46 — Étiquettes (IA8) photo par photo.** Dix photos par appel, chacune
précédée de « Photo n : », à 768 px avec le modèle rapide, plutôt qu'une
planche : moins de confusions de numéros (I5), environ 0,20 USD pour 1600
photos.

**D47 — Couverture.** La couverture choisie (IA14 ou à la main) est copiée en
tête de `Album/` sous le nom `0000_Couverture`, en plus de sa place dans
l'album.

**D48 — Décalage d'horloge d'un appareil.** Appliqué aux dates du plan en
une opération annulable ; le décalage déjà appliqué est retiré d'abord, pour
ne jamais cumuler. Le signe suit `--decalage-appareil` du script 03 (on ajoute
le décalage à la date de l'appareil).

**D49 — Style de l'interface (22.10.2026).** Choisi sur maquette : fond
neutre clair, cartes blanches à coins arrondis, une seule couleur d'accent
(vert lagon `#0F766E`), l'ambre réservé aux étoiles de la sélection, police
Plus Jakarta Sans (licence OFL) **intégrée au fichier** : l'application
marche hors ligne, sans Google Fonts. Toutes les couleurs sont des jetons
de `style.css`, redéfinis pour le thème sombre. La barre d'action de la
sélection n'apparaît qu'avec une sélection ; les filtres rares sont repliés
(« Plus de filtres »).

**D50 — Dossier de départ des fenêtres de choix.** Le navigateur ne donne
pas le dossier parent d'un dossier choisi : partir du « dernier dossier
choisi » ouvre la fenêtre *dans* ce dossier (la source), pas à côté. D'où un
dossier de départ fixe, choisi une fois (Réglages, ou le lien sous les
boutons « Choisir… » du projet), passé en `startIn` à toutes les fenêtres ;
sans lui, le dernier dossier choisi comme avant.

**D51 — Monuments reconnus dans l'appel du nommage.** L'aide séparée IA5
(4 photos par dossier, recherche web) faisait presque le même travail que le
nommage, coûtait un second appel et son résultat n'était utilisé nulle part.
Le nommage (IA4) demande désormais toujours les monuments, dans le même
appel (quasi gratuit), et le schéma les place **avant** le nom : l'IA les
repère d'abord et peut s'en servir pour nommer. Un seul bouton à l'étape 6.

**D52 — « Nouveau dossier ».** Sans photos sélectionnées, il est créé dans le
dossier affiché, comme dans l'Explorateur ou VS Code. Avec des photos
sélectionnées, au même niveau : le geste courant est de sortir des photos
d'une sortie pour en faire une sortie voisine, et un dossier de sorties dans
une sortie allongerait les chemins. Le bouton « Sous-dossier » est retiré.

**D53 — Place pour les photos (étapes 4 et 9).** Une fois l'arborescence en
place, l'en-tête de l'étape (explication, tri automatique, photos sans GPS,
lieux fréquents) se replie en une ligne, dépliable (« Aide et outils »).
Dans le panneau, le nom des dossiers a toute la largeur (dates et alertes
sur une deuxième ligne) et le panneau s'élargit à la souris. À droite, le
titre montre le nom seul, ses dossiers parents en petit au-dessus. Dans la
ligne de temps, le dossier choisi ressort et les autres s'estompent.

**D54 — Nettoyer, ranger, choisir : douze étapes (23.10.2026).** Les
doublons viennent juste après les floues, avant le rangement : le tri et les
petits dossiers travaillent sur des photos propres (une rafale ne gonfle plus
un dossier). Pour un dossier en vrac, encore en un seul tas, les photos sont
comparées **journée par journée** (les dossiers gardés tels quels à part) :
une journée équivaut presque à une sortie, et la vue d'ensemble garde toutes
les planches d'un lot dans un seul appel (I6). À revérifier avec la vraie
API. L'ancienne étape 4 est coupée en deux : **Tri automatique** (lieux
fréquents à enregistrer d'abord, réglages, calcul, photos sans GPS ; inutile
pour un dossier déjà trié) et **Lieux et sorties** (la page de travail, sur
toute la hauteur). Dans le code, chaque étape a un code stable
(`ETAPE.lieux`) et « Valider et continuer » suit le parcours du mode
(`etapeSuivante`) ; un projet à onze étapes est converti à l'ouverture. La
sortie reste possible quand « Lieux et sorties », validée une fois, repasse
« à revoir ».

**D55 — En-tête sur une seule ligne.** La frise des étapes (78 px) rejoint
l'en-tête : un rectangle par étape (couleur = état, nom en infobulle, clic =
y aller), puis « Étape 6 sur 12 · Lieux et sorties ▾ » en clair (un clic
déroule la liste des douze étapes avec leur état). Le nom de l'étape en cours
reste écrit : c'est le repère principal d'un débutant. Les pages consultées
de temps en temps (Fonctions IA, Configuration, Réglages, Journal, Aide,
Fermer le projet) passent dans un menu ☰. Le budget IA reste visible (règle
d'or 5). Gain : environ 80 px sur toutes les pages.

## 2. Calibrations sur photos réelles

| Mesure | Valeurs observées | Conséquence |
|---|---|---|
| Distance phash, même scène prise plusieurs fois (diversité du script 03) | 12-16 | Seuil de diversité 20 |
| Distance phash, scènes différentes du même jour | 26 et plus | |
| Distance phash, rafale quasi identique | ≤ 12 | Seuil rafales 12 (scripts 02 et 06) |
| Panoramas Angthong « identiques » au sens de l'album (0181/0182/0183, avant-plans différents) | 26-36 | **Le hachage ne sait pas les rapprocher** : il faut le modèle |
| Scènes réellement différentes (Angthong vs autres, plage) | 26-38 | Chevauchement total avec la ligne précédente : **un garde-fou par hachage est impossible**, d'où le garde-fou par descriptions (I7) |
| Netteté relative | 15 % les moins nets d'un dossier net = photos nettes | Seuil `[flou?]` relatif **et** absolu (I8) |
| Netteté à 800 px comparée à 1024 px (300 photos, phase 0) | +36 % en médiane, de +8 à +111 % | Pas de conversion simple : mesurer à 1024 px comme le script 01 (D29) |
| Phash sur l'image à l'endroit plutôt que couchée (8568 paires < 10 min, phase 0) | Même orientation : verdict changé pour 0,2 % (seuil 12) et 1,7 % (seuil 20) des paires | Seuils 12 et 20 conservés (D29) |

## 3. Incidents et corrections (tests de non-régression)

**I1 — Mélange de deux exécutions dans le dossier album (script 03).** Faux
diagnostic d'ordre ; cause réelle : anciens fichiers numérotés restés dans le
dossier. Correction : nettoyage des JPG `^\d{4}_\d{8}_` avant copie.

**I2 — Ordre Kanchanaburi (script 03).** Photos 0107 (16.07 09:47), 0109
(15.07, bateau sur la rivière Kwai), 0117 (16.07 09:43) : le tri par blocs
plaçait chaque mini-série à sa première photo, donc des photos du 16
apparaissaient avant celles du 15. Correction : tri jour → segments. Attendu :
14 → 15 (rivière) → 16 (09:43 puis 09:47).

**I3 — 219 photos en `Lieu_inconnu` (script 01).** Les photos avaient un GPS
valide (plage de Chaweng Noi, 9.5057 N / 100.0562 E). Nominatim renvoyait le
nom en thaï, que la translittération ASCII vidait entièrement. Correction :
nouvelle requête en anglais (« Baan Chaweng Noi »), nom précis préféré à la
province.

**I4 — Clusters homonymes fusionnés (script 01).** Deux clusters différents
recevant le même nom de commune finissaient dans le même dossier. Correction :
registre global des noms, suffixe `_b`.

**I5 — Descriptions inventées (script 06, première version).** 6 planches de
12 photos (72 vignettes) par appel : le modèle a décrit « une éclaboussure
contre les rochers » pour une photo de voilier sur mer calme
(`20260721_113205`). Il perdait le lien numéro ↔ image. Correction : décision
sur 6 photos max par appel, en grand format, et description obligatoire de
chaque photo citée.

**I6 — Photos jamais comparées (script 06, deuxième version).** Avec des
planches de 9 indépendantes, deux photos de la même scène tombant dans deux
planches n'étaient jamais rapprochées. Correction : vue d'ensemble du dossier
entier (D6).

**I7 — Scène perdue « pont / rocher » (script 06).** Planche de vérification
SpectacleFeu Chaweng 007-012 : la fille qui fait le pont dans l'eau (photos
1-4) et la même fille assise sur un rocher 40 min plus tard (5-6) ont été
mises dans un seul groupe ; le rocher a été gardé, **toutes** les photos du
pont marquées. Corrections : consigne « un groupe = une scène, chaque scène
survit par sa meilleure photo », heure sur chaque vignette, et garde-fou
automatique : aucun mot significatif commun entre la description du doublon
et celle de la gardée → marquage refusé. Cas de test : « pose du pont dans
l'eau » vs « assise sur le rocher » → refus ; « même archipel avec branches »
vs « vue dégagée de l'archipel » → accepté.

**I8 — `[flou?]` sur des photos nettes (script 06).** Le seuil purement
relatif (15 % les moins nets) accusait toujours quelqu'un, même dans un
dossier entièrement net, et dissuadait le modèle de garder ces photos (I7).
Correction : `min(15e centile, 0,5 × médiane)`, et consigne « ne jamais
supprimer une scène entière pour cause de [flou?] ».

**I9 — Plantage sur numéro cité dans deux groupes (script 06).** Le premier
groupe renommait la photo, le second tentait de renommer un fichier disparu
(`FileNotFoundError`). Correction : un numéro n'est traité qu'une fois par
planche ; `marquer()` tolérant.

**I10 — Érosion à chaque relance (script 06).** Relancer l'analyse re-jugeait
les photos restantes et en marquait de nouvelles à chaque fois. Correction :
dossiers déjà analysés ignorés (`--reanalyser` pour forcer), gardiennes
protégées.

**I11 — Photos marquées absentes du CSV (script 06).** Le CSV n'était écrit
qu'à la fin ; un plantage laissait des marquages sans trace, invisibles
ensuite. Correction : écriture après chaque dossier et récupération des
orphelines (« marquage antérieur »).

**I12 — JSON invalide (scripts 03, 04, 06).** Formes rencontrées : `null` à la
place d'une note, guillemets non échappés dans une description, virgule en
trop, réponse tronquée, texte autour du JSON, **liste au lieu d'objet**
(script 04, dossier de captures d'écran → `AttributeError`). Correction :
réparation en 5 niveaux (guillemets typographiques, virgules, guillemets
internes, fermeture des structures tronquées, extraction des numéros au regex
en dernier recours), normalisation de type, consigne interdisant les
guillemets dans les valeurs, `max_tokens` 4000. Une entrée de cache
inutilisable est redemandée.

**I13 — `Errno 5` lors des copies vers le NAS monté en réseau (script 01, accès réseau abandonné, D25).** Copie par blocs de
1 Mo avec tentatives, journal `erreurs_copie.csv`.

**I14 — Photos couchées sur les planches (ouvert).** L'orientation EXIF n'est
pas appliquée lors de la création des miniatures (visible sur la planche
SpectacleFeu : photos 2, 3, 5, 6 couchées). Correction prévue :
`ImageOps.exif_transpose()` (Python) ; `createImageBitmap` applique
l'orientation côté navigateur.

## 4. Photos de référence pour les tests

À copier dans `tests/photos_reelles/` (non versionné) :

| Fichiers | Cas |
|---|---|
| `0181…`, `0182…`, `0183…` (Angthong, 21.07.26) | Même panorama sous plusieurs cadrages → 1 gardé (A1) |
| `0193…`, `0194…` (Angthong) | Même pose portrait et paysage → 1 gardée (A2) |
| `0107…`, `0109…`, `0110…`, `0117…` (Kanchanaburi) | Ordre chronologique jour/segments (I2) |
| `20260718_113536/113603/113642.jpg` | GPS Koh Samui, nom thaï → `Baan_Chaweng_Noi` (I3) ; enfants dans l'eau |
| `20260721_113205.jpg` | Voilier : la description doit parler d'un voilier (I5) ; vérifié en phase 0 avec Haiku 5.5 et Sonnet 5.5 |
| Planche `…SpectacleFeu_Chaweng…verif_007-…-012.jpg` | Pont / rocher : les deux scènes survivent (I7), orientation (I14) |
| `SpectacleFeu_A8/` : `20260724_121056(1)`, `121101`, `121511 (b`, `121511` (pont) ; `121840`, `121853` (rocher) | Les 6 originaux de la planche ci-dessus (critère A8), retrouvés grâce au `doublons.csv` du script 06 |
| `0140…`, `0141…`, `0144…`, `0145…` (VS Max) | Jeu complémentaire (sorties imbriquées) |
