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

**D56 — Calculer tout seul, ne demander que les décisions.** L'analyse
locale des photos (netteté, ressemblance, exposition) et l'empreinte des
photos de même taille démarrent toutes seules après l'inventaire, sur la page
Inventaire, avec leur progression ; « Valider et continuer » attend la fin.
Les copies exactes sont alors proposées sans bouton, et les rafales sont
repérées dès l'ouverture de l'étape Doublons. Plus aucun bouton « Analyser
les photos ». Rien n'est écarté sans validation ; l'analyse IA des doublons
reste un bouton facultatif, avec son coût. Une analyse en arrière-plan
pendant les étapes suivantes a été écartée : moins claire pour un débutant
(pages à moitié prêtes), et le gain est faible (environ 1 minute pour 1600
photos).

**D57 — Photos sans date : `_sans_date`.** Sans date dans les données de
l'appareil ni dans le nom, la date du fichier est souvent celle d'une copie :
sur une vraie année, toutes ces photos tombaient le même jour, dans une
fausse sortie. Le tri automatique les met dans `_sans_date`, à placer à la
main ; les doublons les comparent entre elles (lot « Sans date ») ; dans
l'album, une photo sans date rangée dans une sortie se place à la fin de
cette sortie. Pour un dossier déjà trié, elles restent dans leurs dossiers.

**D58 — Tri automatique sans choix de préréglage, options expliquées.** Le
menu « Préréglage » de l'étape Tri n'était pas compris (« Année » ou
« Voyage » de quoi ?) et doublait le choix fait à la création du projet. Il
est retiré : les réglages du projet (« Année » par défaut) servent de départ,
et chaque option a une phrase visible qui dit ce qu'elle change (au lieu
d'une bulle au survol). Les lieux fréquents montrent une photo par jour, la
liste complète sur demande et le nom de la ville proche (OpenStreetMap,
déjà utilisé par le tri), pour qu'on sache ce qu'on nomme.

**D59 — Lieux fréquents : l'adresse précise plutôt qu'un nom proposé par
l'IA.** Pour reconnaître un lieu qui revient souvent, chaque carte montre
son adresse (OpenStreetMap au zoom 18 : nom de l'endroit s'il en a un, rue,
localité ; une requête gratuite par lieu, gardée dans `.album/adresses.json`).
Une proposition de nom par l'IA (recherche internet, analyse des photos) a
été écartée pour l'instant : les lieux les plus fréquents sont des lieux de
famille (maison, grands-parents) que ni l'IA ni internet ne peuvent nommer,
et les lieux publics (école, stade) ont déjà leur nom dans OpenStreetMap. À
reconsidérer si l'adresse ne suffit pas. Une case « C'est notre domicile »
permet d'enregistrer le domicile sans passer par la Configuration (les
voyages en ont besoin).

**D60 — Interface en anglais et en français, langue du projet pour la
sortie.** L'application est publiée : l'interface existe en anglais et en
français. Les textes restent écrits en français dans le code, marqués
`` t`…` `` (la clé est le texte français, chaque `${…}` devient `{0}`, `{1}`…),
et leur traduction anglaise est dans `app/src/traductions/en/`, une table
par partie de l'application ; un test vérifie que chaque texte marqué a sa
traduction. Ce choix garde le code lisible pour qui connaît le projet, et
une phrase modifiée sans sa traduction est signalée par le test. La langue
de l'interface suit le navigateur, ou le choix fait sur la page d'accueil et
dans les Réglages. Chaque projet a en plus sa propre langue, choisie à la
création (par défaut celle de l'interface) puis fixe : elle décide des noms
de dossiers écrits dans la sortie (`_mis_de_cote` ou `_set_aside`…), du
rapport, de la langue des réponses de l'IA et des noms de lieux
d'OpenStreetMap. Changer la langue de l'interface en cours de projet ne
renomme donc rien. Les consignes IA restent en français, mot pour mot ; une
seule ligne demande des réponses en anglais quand le projet est en anglais.

**D61 — Étape « Dossiers », trois choix, copies et captures déplacées.**
Avec une vraie année (59 sous-dossiers), le tableau des sous-dossiers
occupait l'Inventaire et cachait les copies et les captures en dessous ; la
liste déroulante de chaque ligne se confondait avec celles des lignes
voisines. Le choix passe dans une étape à lui, juste après l'Inventaire (13
étapes, sautée sans sous-dossier et pour un dossier déjà trié), avec trois
boutons par ligne : **Trier**, **Garder, nettoyer** (par défaut : le dossier
garde sa place, mais ses floues et ses doublons sont proposés — avant, un
dossier gardé échappait à tout) et **Ne pas toucher**. Le choix « hors de
l'album » disparaît : ces dossiers (scans, documents) prennent « Ne pas
toucher » et ne sont simplement pas choisis à la Sélection. Les **copies
exactes** passent en tête de l'étape Doublons, sur tous les dossiers, et
l'utilisateur choisit les exemplaires à garder ; la proposition garde le
meilleur exemplaire de chaque emplacement (un dossier qui garde sa place, ou
les photos à trier), pour qu'une sélection « Best of » faite de copies reste
entière, et propose d'écarter les copies d'un même emplacement et les
versions réduites (WhatsApp). Une capture d'écran rangée dans un dossier y a
été mise exprès : seules celles des photos à trier sont proposées, à l'étape
Tri automatique ; l'étape Floues ignore toute capture (une image d'écran est
nette mais « plate », la mesure la prenait pour floue). L'Inventaire devient
une page d'information, avec « Refaire l'inventaire » en haut (l'analyse
reprend, les résultats des photos inchangées sont réutilisés, les rafales
sont recalculées et les étapes suivantes remises à faire).

**D62 — Recadrage pour l'album, la seule copie réencodée.** À l'étape
Sélection, une photo se recadre (bouton « Recadrer… » ou touche K) : un cadre
à tirer, des formats tout faits (libre, 3:2, 4:3, carré, en portrait ou en
paysage) et un redressement de ±15° ; l'image est agrandie juste assez pour
qu'aucun coin vide n'apparaisse. Le recadrage est une décision du plan,
annulable comme la rotation, et ne touche que la copie dans `Album/` :
l'archive et la source restent entières. Contrairement à la rotation (balise
Orientation, sans recompression, P13), un recadrage oblige à réencoder : la
copie est écrite en JPEG qualité 0,95 (aucune perte visible à l'impression),
avec la date et l'appareil de l'original (EXIF repris, orientation remise à
1). Le même calcul dessine l'aperçu et la copie : ce qu'on voit est ce qui
est imprimé. Un format que le navigateur ne sait pas décoder est copié entier,
et la page Sortie le signale.

**D63 — Trier un dossier en plusieurs fois.** On trie une année au fil des
mois : le projet doit accepter des photos ajoutées à la source après un
premier tri. Avant, le plan figeait la source à l'inventaire : les photos
ajoutées étaient ignorées, et le bilan, qui ne comparait la sortie qu'au
plan, annonçait « tout est dans la sortie » (risque de perte si l'on
supprimait la source). Désormais : (1) à l'ouverture du projet, la source est
relue rapidement (chemins, tailles, dates) et un bandeau annonce les fichiers
nouveaux, modifiés ou disparus ; (2) « Mettre à jour l'inventaire » ne lit que
ces fichiers et les intègre au plan en une opération annulable, sans rien
changer à ce qui est décidé (dossier de la source, ou à trier à la racine ;
un dossier « à trier » déjà trié le reste ; un nouveau sous-dossier est
« Garder, nettoyer ») ; un fichier disparu est gardé s'il est déjà dans la
sortie, retiré sinon (journal) ; les étapes validées repassent « à revoir » ;
(3) le tri automatique propose « Ranger les N nouvelles photos », qui ne
touche pas aux dossiers déjà faits (une sortie à cheval se fusionne à
l'étape Lieux et sorties) ; les rafales ne sont recherchées que là où des
photos sont arrivées ; (4) après l'écriture, la page Sortie relit la source :
tant qu'un fichier n'est pas dans le projet, le bilan et le rapport disent de
ne pas supprimer la source. « Refaire l'inventaire » (tout perdre) est replié
sous « Repartir de zéro ».

**D64 — Lieux et sorties : jamais de grille vide.** Après le tri, la racine
n'a plus de photos en propre : la page s'ouvrait sur « Photos (racine) · 0
photo » alors que le panneau en annonçait des centaines. Elle ouvre désormais
le premier dossier qui a des photos, dans l'ordre du panneau (les dossiers
techniques en dernier). Un dossier fait seulement de sous-dossiers (« Maison
», la racine) montre les photos de ses sous-dossiers, avec le nom du
sous-dossier sous chacune, comme la Sélection. Un nouveau dossier créé depuis
cette vue avec des photos sélectionnées va dans le dossier affiché, à côté de
leurs sous-dossiers.

**D65 — Nouveautés d'une mise à jour de l'inventaire.** Une photo arrivée par
une mise à jour (D63) et pas encore écrite dans la sortie est « nouvelle ».
Son dossier porte un badge « nouveau », et une case du panneau ne montre que
ces dossiers et leurs parents. La définition s'appuie sur la sortie et non sur
la dernière mise à jour : deux mises à jour successives avant d'écrire la
sortie gardent toutes leurs photos « nouvelles ».

**D66 — Ligne de temps lisible.** Les dates sous les colonnes sont espacées
d'au moins trois colonnes : d'abord la première, les débuts de mois (qui
peuvent glisser de quelques jours) et les sauts, puis une par semaine. L'année
s'écrit quand elle change. Les événements du calendrier s'étagent sur
plusieurs rangées pour que leur nom tienne en entier ; un événement d'un jour
n'est plus tronqué en « We… ».

**D67 — Petits dossiers : un seuil, une action pour chacun.** Le seuil du
script 05 (moins de 5 photos) vaut maintenant aussi pour le badge « petit » et
l'alerte de « Lieux et sorties », au lieu de 3. Sur une vraie année, 28 petits
dossiers sur 29 n'avaient pas de sortie voisine à moins de 12 h et restaient
sans action possible. Chacun peut maintenant être rattaché au dossier de son
choix (les plus proches dans le temps proposés d'abord), ceux d'une même
journée réunis, ou gardés à part. Une décision reste affichée, cochée, avec «
Annuler ». Pour un rattachement, cet « Annuler » ressort le dossier (même
identifiant, mêmes noms de fichiers) même après d'autres changements ; la note
est gardée dans `aides.json` (`fragments_rattaches`). L'écart avec une sortie
voisine se mesure entre les périodes (0 = « pendant cette sortie ») et non
plus entre les premières photos, qui donnait « à 72 h » pour un arrêt au
milieu d'un voyage. La ressemblance est dite en mots d'après les calibrations
(§ 2) : ≤ 12 très semblables, ≤ 20 semblables, au-delà peu semblables. La
distance reste dans la bulle.

**D68 — Noms du tri au format de la famille.** Le tri écrit `Lieu_JJ.MM.AA`,
`Lieu_JJ-JJ.MM.AA` sur plusieurs jours (`JJ.MM-JJ.MM.AA` sur deux mois) et
`Lieu_MM.AA` par mois, au lieu des dates AAAA-MM-JJ. C'est la forme des
dossiers nommés à la main, que le Nommage ne doit pas reprendre. Le tri note
donc le nom qu'il donne (`tri.nom`) : un nom à ce format n'est automatique que
tant que le dossier le porte. Les anciens noms AAAA-MM-JJ restent toujours
automatiques, pour les projets existants et pour « Scinder par jour ». Un nom
déjà pris reçoit `_2` sans couper la date, ce qui évite `X_12.01_2.26`.

**D69 — Nommage sans perte.** Entrée applique le nom tapé. Quitter l'étape
avec des noms tapés mais pas appliqués demande quoi en faire : les appliquer,
les laisser, ou rester. Un dossier renommé reste dans le tableau, coché. «
Tout accepter » existe aussi pour les noms de confiance inférieure à 8, avec
une confirmation qui dit combien sont à relire.

**D70 — Consolidation : noms proches et proches dans le temps.** Sans IA, deux
noms proches n'étaient comparés que par le nom : le nom d'un village
rapprochait toutes les sorties de l'année à cet endroit (le 22.11 avec le
13.12), celui d'une ville janvier avec juillet. Ils doivent maintenant être à
2 jours d'écart au plus. « Ignorer cette paire » écarte une paire pour de bon
(`consolidation_paires_ignorees`), et un lien permet de les reproposer toutes.

**D71 — Étape « Doublons » en onglets ; chaque photo se garde ou s'écarte d'un
clic.** Sur une vraie année (3 213 photos), la page faisait 26 écrans : neuf
écrans de copies avant les filtres, un « Aperçu par journée » au milieu, des
groupes qui disparaissaient au clic (le filtre « À relire » les retirait
aussitôt), des choix impossibles (la photo gardée n'avait aucun bouton, une
photo refusée par le garde-fou n'était pas affichée, 40 groupes de copies
visibles sur 270 alors que « Écarter 270 copies » les traitait tous), des
choix de copies perdus en quittant l'étape, et des badges faux (une copie
écartée montrée « gardée » dans une rafale). Désormais : un onglet par sorte
(Copies exactes, Dans plusieurs dossiers, Rafales, Même scène (IA), Mis de
côté), chacun avec son compteur ; filtres, classement et avancement collés en
haut ; à gauche, les journées (puis les dossiers gardés, puis les photos sans
date) avec ce qui reste à relire. Au-delà de 20 journées et dossiers (une
année), la liste passe aux mois, dans l'ordre du temps, et chaque carte dit sa
journée et son dossier : sur 2025, 13 mois au lieu de 74 journées et 39
dossiers, souvent d'un seul groupe. Une période relue, « Suite à relire » mène
à la suivante. Un seul modèle (`lib/groupesDoublons.ts`) : chaque photo d'un
groupe porte une proposition (garder ou écarter) et un état lu dans le plan,
gardée, écartée par cette étape, ou « à écarter » tant que la proposition
n'est pas acceptée. Un clic sur n'importe quelle photo, la ★ comprise, inverse
ce qu'on voit ; « Accepter » applique ce qui reste proposé ; « Tout garder »
et « Tout écarter » complètent (tous les exemplaires d'une copie peuvent être
écartés : rien n'est supprimé). Rien n'est écarté sans action (règle d'or 3) :
un groupe non relu garde ses photos dans l'archive. Rien ne disparaît : la
liste affichée est figée tant qu'on reste sur la journée, un groupe accepté se
replie à sa place ; tout est dans le plan, donc enregistré au fil de l'eau et
annulable (Ctrl+Z). Les actions groupées ne portent que sur la journée
affichée, sauf « Accepter les N propositions » des copies exactes, qui dit son
nombre. Les groupes ne changent plus d'une recherche à l'autre : une photo
écartée par l'étape reste dans son lot, une photo gardée reste dans son
groupe, si bien qu'une nouvelle recherche (en cache, gratuite) retrouve les
mêmes groupes avec leurs décisions ; une photo écartée pour une autre raison
(floue, copie exacte) quitte le groupe. Une recherche arrêtée en route reprend
d'elle-même les journées manquantes et annonce combien sont faites ; une
recherche locale (nouvelles photos) garde les scènes de l'IA du lot. Copies
exactes : une photo déjà rangée dans un dossier « Garder, nettoyer » n'est pas
triée une seconde fois (ses exemplaires à trier sont proposés à l'écart) ; si
ce dossier n'en a qu'une version réduite (WhatsApp), l'original y prend sa
place et la copie réduite est écartée (choix de l'utilisateur, 24.10.2026). «
Comparer en grand » ouvre le comparateur, qui passe d'un groupe à l'autre
(Page préc., Page suiv.) et accepte (A). Clavier : J et K, ← et →, Espace, A,
C, N et P.

**D72 — Photos floues : le seuil est celui du projet.** La position du curseur
de netteté est enregistrée dans le projet dès qu'elle change, et non plus
seulement à « Valider » : un rechargement la perdait (3 photos écartées
redevenaient 1). Le seuil ne s'applique au plan qu'à la validation, comme
avant. L'aide IA des cas limites lit ce seuil dans le projet : lancée depuis «
Aides IA » avant de passer par l'étape, elle prenait 60 au lieu du réglage
choisi.

**D73 — Recadrer puis tourner ; copies recadrées.** Le rectangle de recadrage
est en fractions de l'image tournée : tourner une photo déjà recadrée fait
donc tourner le rectangle d'un quart de tour avec elle (avant, la copie
montrait une bande verticale, 1281 × 4000 au lieu de 4000 × 1848). Le
redressement reste, car il tourne autour du centre comme le quart de tour. La
copie réencodée garde la date et l'appareil, mais plus la vignette EXIF (IFD1)
de la photo entière, et porte sa vraie taille en pixels : certains
explorateurs et l'import du livre photo montraient la photo entière. Dans le
recadreur, 3:2 et 4:3 commencent dans le sens de la photo. Une photo recadrée
puis tournée avant ce changement est à recadrer de nouveau.

**D74 — Album : couverture, cible, copies et textes.** Toute photo de l'album
peut devenir la couverture, depuis son panneau, sans IA ; l'IA ne fait que
proposer, en miniatures. La couverture est la première page de l'aperçu, avec
le titre de l'album (nom du projet par défaut, modifiable), et sa copie garde
rotation et recadrage. La cible passe de 100 à 24 pages, un livre photo
courant (un projet existant garde la sienne) ; l'alerte part dès 10 % d'écart,
en dessous comme au-dessus, et dit comment combler l'écart ; la jauge de «
Sélection » et l'aperçu de « Album » font le même calcul (`nombrePages`). Une
même photo retenue dans deux dossiers (même empreinte, ou même date EXIF à la
seconde avec mêmes taille et dimensions, un « Best of » fait de copies)
n'entre qu'une fois dans l'album, à sa première place ; l'étape « Album » le
dit. `textes_album.md` reprend titre, couverture et plan des pages. Les titres
de section sont tirés du nom du dossier sans la date ; le texte tapé au
Nommage (accents, espaces) est gardé (`nomSaisi`) et sert de titre, le nom de
dossier restant ASCII.

**D75 — Accueil, nouveau projet et configuration sur place.** Cliquer sur une
carte d'entrée ouvre aussitôt le sélecteur du dossier à trier ; le formulaire
s'ouvre ensuite avec ce dossier rempli. Configuration et clé API sont dites «
facultatives », en gris neutre. Un dossier de sortie qui contient déjà un
projet est signalé tout de suite, avec « Ouvrir ce projet ». Un projet terminé
rappelle qu'on peut le rouvrir pour de nouvelles photos (D63). Enregistrer un
lieu fréquent ou un appareil sans dossier de configuration ouvre un encart qui
le crée ou le choisit sans quitter l'étape, puis l'action se poursuit. Le
bandeau « le dossier à trier a changé » est dans le flux, sous l'en-tête : il
pousse la page au lieu de cacher son titre.

**D76 — Inventaire : les chiffres de la source.** La page dit ce que contient
la source : ses chiffres (photos, vidéos, dossiers, période, dates, GPS, à la
racine, petits dossiers) sont tirés des chemins dans la source, éléments mis
de côté compris. Ils ne bougent plus quand le tri crée des dossiers ou quand
les floues et les doublons écartent des photos ; seule une mise à jour de
l'inventaire les change. La date du fichier d'une photo sans date, souvent
celle d'une copie, n'entre plus dans la période d'un dossier (panneau, étape
Dossiers, rapport, ligne de temps) ni d'une section d'album.

**D77 — Tri sans connexion ; une vraie photo n'est jamais une capture.** Si
OpenStreetMap ne répond pas, le tri continue : les noms en cache sont gardés,
les autres lieux reçoivent un nom provisoire (`Lieu_01`…) et un message dit de
les renommer ou de recalculer une fois connecté. Des photos de téléphone en
1080 × 1920, avec GPS et date EXIF mais sans marque, étaient prises pour des
captures : une position GPS, ou une marque d'appareil avec une date EXIF,
prouve maintenant que c'est une photo. Une date EXIF seule ne suffit pas (les
captures d'iPhone en ont une). Chaque capture proposée peut être décochée
(notée « pas une capture »), agrandie d'un clic, et montre son nom.

**D78 — Sortie : une nouvelle version d'un fichier, un bilan qui dit vrai.**
Le bilan ne comparait que les tailles : une photo retouchée dans la source
après sa copie, de même taille, était jugée « à jour ». `etat_sortie.json`
note maintenant pour chaque copie la taille et la date de modification de
l'original lu ; une copie de l'application faite d'une version plus ancienne
est remplacée, et le bilan ne compte une copie que si taille et date
concordent. Un fichier que l'application n'a pas écrit, ou une copie retouchée
à la main, n'est jamais écrasé. Un état écrit avant ce changement, sans date,
garde l'ancienne règle. La phrase « N fichiers → M dans la sortie » compte le
dossier à trier relu après l'écriture, ou donne les deux nombres s'il diffère
du projet. L'aperçu ne dit plus « à jour » quand un fichier ne peut pas être
écrit ou quand `Album/` reste à écrire ; la place disque compte `Album/`.
Après une sortie complète, « Et maintenant ? » dit ce qui reste à faire à la
main (copier la sortie, importer `Album/` dans ifolor, supprimer soi-même les
originaux).

**D79 — Sélection sur plusieurs séances et plusieurs jours.** Les photos de la
dernière mise à jour de l'inventaire portent un badge « nouveau » ; la
Sélection offre une pastille « Nouvelles » et un filtre « Arrivées le … »,
dont les comptes suivent les autres filtres. Triée par date, la grille est
découpée en journées titrées, avec la date et l'heure sous chaque miniature.
Après la dernière photo du tri rapide, un encart dit « Tout est décidé » ou
combien il en reste. L'équilibre a une barre par jour jusqu'à 45 jours, puis
une par mois. L'alerte de redondance signale aussi une même photo retenue dans
deux dossiers. Une photo citée par l'IA est montrée, jamais nommée par son
fichier. L'étape Dossiers présente les sous-dossiers dans l'ordre du temps. En
anglais, le choix pour l'album se dit « in the album » ; « selected » est
réservé à la sélection dans la grille.

**D80 — Annuler partout ; coûts et dépenses justes ; navigation.** Un seul
gestionnaire, en capture sur `window`, traite Ctrl+Z, Ctrl+Y et Ctrl+Maj+Z sur
toutes les étapes, hors champ de saisie et hors fenêtre ouverte : aucune page
n'annule deux fois. « ? » ouvre la liste des raccourcis. Le coût d'une aide IA
est recalculé quand ses options changent. Une réponse illisible reste en cache
pour ne pas être payée deux fois, mais est comptée, et l'aide propose «
Redemander » avec son coût. Chaque coût IA est écrit dans `projet.json` avant
que la réponse entre dans le cache (règle d'or 7). Chaque page s'ouvre en haut
; le bouton Précédent du navigateur et « ← Retour » restent dans l'application
; un rechargement rouvre la page regardée. Les messages passagers s'affichent
au centre de la barre de validation, jamais sur ses boutons.

**D81 — Les rafales se cherchent avec l'analyse.** La recherche des rafales
(locale, gratuite) ne partait qu'en arrivant sur l'étape « Doublons » : il
fallait l'attendre, alors que les copies exactes, elles, étaient déjà
cherchées pendant l'analyse. Elle devient la dernière phase de l'analyse
automatique, juste après les copies exactes. Elle dépend pourtant des choix de
l'étape « Dossiers », faite ensuite (un dossier « Garder, nettoyer » forme son
propre lot, un dossier « Ne pas toucher » n'est pas comparé), et des photos
floues écartées. Chaque lot (journée ou dossier) garde donc l'empreinte de ses
photos : après « Dossiers » et « Photos floues », l'analyse ne cherche de
nouveau, en arrière-plan, que les lots dont les photos ont changé, et retire
ceux qui n'existent plus. Avant, un choix changé à l'étape « Dossiers » après
la recherche laissait des journées jamais cherchées. Les décisions, dans le
plan, ne se perdent pas ; les scènes de l'IA d'un lot sont gardées. L'arrivée
sur la page complète encore ce qui manquerait (recherche arrêtée en route,
nouvelles photos).

**D82 — Doublons : grouper au choix, photos à la taille voulue.** La liste de
gauche de l'étape « Doublons » se groupe par journée, par mois ou par dossier,
au choix de l'utilisateur (par défaut par journée, par mois au-delà de 20
journées). Par dossier, une copie exacte se range sous chacun des dossiers où
elle a un exemplaire : en ouvrant un « Best of », on voit toutes ses copies ;
avant le tri, les photos en vrac de la racine forment « Photos à trier ». Un
curseur règle la taille des photos jusqu'à 600 px, pour comparer sans ouvrir
le comparateur ; c'est le réglage de la Sélection (`tailleMiniatures`), réglé
une fois pour toutes les pages. Le Tri automatique a le même curseur : ses
captures d'écran et les photos des lieux fréquents, plus petites, en suivent
l'échelle. L'inventaire annonce aussi les rafales à relire, comme les copies
exactes.

**D83 — Le calendrier nomme et regroupe.** Les titres du calendrier familial
sont souvent les noms les plus parlants (« 18 ans de Lea », « Vacances Tessin
») : l'utilisateur les a écrits lui-même. Jusqu'ici, seule l'IA du nommage les
lisait, et rien ne s'en servait sans IA. Désormais, tous les événements des
calendriers actifs comptent (une journée, plusieurs jours, ou à l'heure, avec
une heure de marge). L'événement d'un ensemble de photos est celui pendant
lequel la plus grande part a été prise (la moitié au moins) ; à égalité, le
plus court, plus précis. Au Nommage, son titre suivi des dates du dossier est
proposé ; s'il couvre toutes les photos, il passe devant la proposition de
l'IA (confiance 9), qui reste à un clic, et inversement. Un événement partagé
par plusieurs dossiers (un voyage) est suivi du lieu, et deux dossiers du même
lieu le même jour reçoivent un numéro, pour que les noms ne se répètent pas. À
l'étape « Lieux et sorties », quand deux dossiers ou plus du premier niveau
ont été photographiés pendant un même événement (80 % de leurs photos),
l'application propose de les réunir sous son titre : en sous-dossiers pour un
événement de plusieurs jours (on garde les étapes, comme un voyage du tri),
fusionnés pour un seul jour ; une proposition ignorée n'est plus montrée
(`aides.json`, `regroupements_ignores`). Les dossiers qui gardent leur place
et les dossiers techniques ne sont jamais proposés. Les anniversaires répétés
chaque année ne comptent que si « inclure les récurrents » est coché pour le
calendrier.

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
