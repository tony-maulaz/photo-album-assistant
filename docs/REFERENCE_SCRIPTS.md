# Référence — algorithmes des scripts Python (archivés)

Les scripts Python d'origine ne sont **plus utilisés ni maintenus**, ni
publiés dans ce dépôt :
l'application navigateur les remplace (`docs/SPEC_APP.md`). Ce document décrit
leur comportement pour servir de **référence au portage** : algorithmes,
seuils, consignes, et pièges déjà rencontrés (§ 9). Les noms de fichiers et
formats décrits ici sont ceux des scripts ; l'application est libre des siens
(`docs/SPEC_APP.md` § 12).

## 1. Séquence d'utilisation

```
01 tri par lieux ─► 05 --fragments ─► 04 nommage ─► 05 consolidation ─► 06 nettoyage ─► ifolor
                                                                     └─► 03 sélection (alternative)
```

Chaque étape produit un fichier à relire (CSV ou noms de fichiers) avant une
commande d'application séparée. Chaque script est relançable : les appels API
sont en cache.

## 2. Briques communes

Ces fonctions sont aujourd'hui **dupliquées** dans plusieurs scripts, avec des
variantes. La version de référence est indiquée ; la factorisation dans
`commun.py` est une évolution prévue (§ 9).

| Brique | Rôle | Référence |
|---|---|---|
| `read_datetime` | Date de prise de vue : EXIF DateTimeOriginal (0x9003), sinon DateTime (0x0132), sinon mtime | 06 |
| `read_dt_model` | Idem + modèle d'appareil (0x0110), avec décalage d'horloge par modèle (`--decalage-appareil 'Modele=+HH:MM'`) | 03 |
| `tech_score` | Netteté = variance du Laplacien (OpenCV) sur l'image en niveaux de gris réduite à 800 px max | 06 |
| `phash` | Hachage perceptuel `imagehash.phash` (64 bits), comparé par distance de Hamming | 06 |
| `fabriquer_planche` | Planche-contact : grille de miniatures, numéro en jaune sur pastille noire, étiquettes optionnelles (`[flou?]`, heure, `R (n/10)`) | 06 |
| `extraire_json` | Parse la réponse du modèle avec 5 niveaux de réparation (§ 8) | 06 |
| `appel_planches` / `appel_claude` | Appel API, 3 tentatives (attente 5 s × n), cumul du coût d'après la table `PRIX` | 06 / 04 |
| `nom_valide` / `sanitize` | Nom de dossier ASCII, espaces et caractères spéciaux remplacés par `_`, 120 caractères max | 05 / 01 |
| `copie_robuste` | Copie par blocs de 1 Mo, 3 tentatives, conserve la date de modification | 06 / 01 |

Extensions photo reconnues : `.jpg .jpeg .png .heic .heif .webp .tif .tiff .bmp .gif`.
Les vidéos et autres fichiers sont ignorés par les scripts 05 et 06.

## 3. Script 01 — tri par lieux et netteté

**Entrée** : `--source` (dossier « vrac »). Seules les photos à la racine sont
triées ; les sous-dossiers existants (mois, dossiers déjà nommés) sont recopiés
tels quels, sauf options `--a-trier`, `--trier-mois`, `--tout-trier`.

**Traitement :**
1. Lecture EXIF (date, GPS) de chaque photo.
2. Photos floues (variance du Laplacien sous le seuil) vers `_a_supprimer/`.
3. **Lieux connus** (`lieux_connus.csv` : `nom;lat;lon;rayon_m`) : une photo
   dans le rayon d'un lieu connu est rattachée au plus proche et rangée dans
   `<Lieu>/<AAAA-MM-JJ>/`. `--lieux-connus aucun` désactive.
4. **Clustering GPS** des autres photos : DBSCAN en distance haversine, rayon
   `--rayon-km`.
5. **Découpage en événements** dans chaque cluster : nouvel événement si l'écart
   dépasse `--gap-jours` ou la durée totale `--duree-max-jours`. `--par-jour`
   coupe aussi à chaque changement de journée ; `--par-mois` regroupe par mois
   calendaire.
6. **Géocodage inverse** (Nominatim, zoom 14) : d'abord en français ; si le nom
   ne contient plus de lettres après translittération ASCII (thaï, grec…),
   nouvelle requête en anglais. Une clé précise (`village, town, city, hamlet,
   municipality, suburb, county, district`) est préférée à une clé large
   (`state_district, province, state, region, country`). Cache par coordonnée
   arrondie à 4 décimales, 1,1 s entre requêtes.
7. **Nommage** `Lieu_AAAA-MM-JJ` ou `Lieu_AAAA-MM`. Collisions de noms entre
   clusters différents : suffixes `_b`, `_c`… (registre global, sinon deux
   clusters homonymes fusionnaient silencieusement).
8. **Passe voyages** (sauf `--sans-voyages`) : les événements à plus de 30 km du
   domicile qui s'enchaînent (écart ≤ 1 jour, ou ≤ 7 jours sans photo près du
   domicile entre-temps) sont regroupés dans `Voyage_<LieuPrincipal>_<date>/`,
   un sous-dossier par étape.
9. **Copie** idempotente (reprise possible), erreurs dans `erreurs_copie.csv`.
10. **Inventaire** `dossiers.csv` en fin de traitement.

`--dry-run` : écrit le CSV de destination prévue (`dossier_cible`) sans copier.

**Recette voyage** (dossier de vacances déjà isolé) :
`--rayon-km 2 --par-jour --sans-voyages --lieux-connus aucun`.

## 4. Script 02 — sélection locale (repli)

Sélection sans IA : score de netteté et dédoublonnage par hachage (distance
≤ 12). Gratuit. Conservé comme solution de secours.

## 5. Script 03 — sélection IA avec cible

Conservé tel quel ; dans l'usage familial, il est remplacé par le script 06.
Utile quand une **cible stricte** de photos est imposée (ex. 950 pour l'album
annuel), avec titres de sections et commentaires.

1. **Local** : EXIF (date, modèle), netteté, hachage, réduction des rafales.
2. **Planches-contact** : grilles de 12 miniatures (380 px), 6 planches par
   appel, tranches chronologiques de 72 photos. Ratio de présélection
   `min(0,75 ; 1,5 × cible / total)`. Les variantes écartées sont tracées
   (`variante_de`).
3. **Notation fine** des présélectionnées en 1024 px, lots de 6, cache par photo
   (`note:<chemin>`).
4. **Passe Opus** sur les ~120 meilleures, en pleine page.
5. **Validation finale** par sortie (planche avec la réserve étiquetée
   `R (n/10)`), contrôle anti-redondance ; places libérées recomplétées au
   mérite. `--sans-validation` désactive.
6. **Sélection** : score, importances (`evenements.csv`), plafonds par
   importance `{1:2, 2:5, 3:15}`, plafonds par groupe (`groupes.csv`),
   diversité par hachage (seuil 20, fenêtre 45 min).
7. **Ordre de l'album** : journées strictement croissantes ; dans une journée,
   segments d'activité contigus ordonnés par leur première photo ; une sortie
   sur plusieurs jours forme un segment par jour. `--ordre-strict-chrono` pour
   un tri brut.
8. **Textes** (`--textes`) : titres de section et commentaires, fichier
   `textes_album.md`.

`--lister-evenements` produit `evenements.csv` (importance 1-10 à remplir) et
`groupes.csv` (`groupe;nb_sorties;nb_photos;du;au;max_photos`). `--calendrier`
injecte les événements de `famille.ics` (±1 jour, les plus courts d'abord).

Sorties : photos copiées `NNNN_AAAAMMJJ_<sortie>.jpg`, `selection_album.csv`,
`photos_ecartees.csv`. Les anciens JPG numérotés du dossier album sont
supprimés avant copie, pour éviter de mélanger deux exécutions.

## 6. Script 04 — nommage des dossiers

**Cible** : dossiers au nom automatique (`Lieu_AAAA-MM`, `Lieu_AAAA-MM-JJ`,
suffixes `_b`…) et sous-dossiers datés (`AAAA-MM-JJ`) sous un parent déjà
nommé. Dans ce dernier cas, la consigne demande de ne pas répéter le nom du
parent.

**Traitement** : échantillon de N photos réparties dans le temps (défaut 5),
recherche web côté API (3 recherches max par dossier, désactivable avec
`--sans-recherche-web`), événements du calendrier autour des dates
(`--calendrier`). Réponse attendue :
`{"nom", "confiance" (1-10), "activite", "justification"}`. Une réponse en
liste est normalisée (premier objet utilisable) ; une entrée de cache
inutilisable déclenche un nouvel appel.

**Convention de nom** : `Theme_Lieu_JJ.MM.AA`, ou `Theme_Lieu_JJ-JJ.MM.AA`
pour une plage, sans accents ni espaces.

**Fichiers :**
- Cache `noms_proposes.json`, clé = chemin relatif, suffixée `+cal` si des
  événements du calendrier ont été fournis.
- `renommages.csv` : `dossier_actuel;nb_photos;nom_propose;confiance;activite;justification;nom_final`.
  Seule `nom_final` est appliquée (vide = ignoré).
- `--appliquer` renomme par profondeur décroissante, pour que les chemins
  restent valides.

## 7. Script 05 — consolidation des dossiers

Traite chaque répertoire contenant au moins deux sous-dossiers de photos.
Ignore `_a_supprimer`, `_autres`, `Sans_lieu`.

| Mode | Moment | Fonctionnement |
|---|---|---|
| `--fragments` | Entre 01 et 04 | Chaque dossier de moins de `--seuil-fragment` photos (5) est comparé à ses voisins **temporels** (plages à moins de `--fenetre-heures`, 12 h) d'au moins 5 photos. Les voisins sont classés localement par ressemblance de hachage, les 3 premiers sont envoyés avec la planche du fragment (miniatures 260 px, 6 photos max). Réponse `{absorber, cible, nom_propose, confiance, raison}` → ligne `fusionner` ou `renommer`. |
| (défaut) | Après 04 | La liste complète (nom, nombre de photos, période), plus une planche pour les dossiers de moins de `--seuil-planche` photos (8) et les `Lieu_*`. Réponse `{fusions: [{cible, sources, raison}], renommages: [{dossier, nom, raison}]}`. |
| `--lister` | Au choix | Aucun appel API : la liste seule, à remplir à la main. |
| `--appliquer` | — | `fusionner` : déplace les fichiers dans la cible (collisions → suffixe `_1`, `_2`…), supprime le dossier vidé. `renommer` : renomme si la cible n'existe pas. |

`fusions.csv` : `dossier;nb_photos;du;au;action;cible_ou_nouveau_nom;raison`,
une ligne par dossier (action vide = on ne touche pas).

## 8. Script 06 — copie de travail sans doublons

**Principe** : le modèle repère ce qui est objectif (les doublons), la famille
choisit les photos de l'album.

### 8.1 Étapes

| Commande | Effet |
|---|---|
| `--copier --source S --dest D` | Copie les photos seules (pas les vidéos), même arborescence, mêmes noms ; ignore `_a_supprimer`, `_autres`, `Sans_lieu`, `_doublons`, `_planches`. Reprise : un fichier de même taille déjà présent est sauté. |
| (défaut) `--dest D` | Analyse et **marquage** : `photo.jpg` → `photo_doublon.jpg`. Rien n'est déplacé. |
| `--appliquer` | Déplace les `*_doublon.*` vers `_doublons/<chemin relatif>/`, suffixe retiré. |
| `--numeroter` | Préfixes chronologiques : dossiers `01_`, `02_`… (niveau par niveau, du plus profond au moins profond), photos `001_`… Idempotent (le préfixe existant `^\d{2,3}_` est retiré avant renumérotation). |

### 8.2 Analyse d'un dossier (photos non marquées, triées par date)

1. **Rafales (local)** : groupement glouton des photos à moins de
   `--fenetre-min` (10 min) et à distance de hachage ≤ `--distance-hash` (12).
   La plus nette de chaque groupe survit, les autres sont marquées
   (source `rafale`).
2. **Seuil `[flou?]`** : `min(15e centile, 0,5 × médiane)` de la netteté du
   dossier. Une photo n'est signalée que si elle est réellement moins nette que
   le reste du dossier.
3. **Vue d'ensemble** : **toutes** les photos restantes, numérotées de 1 à N en
   continu, en planches de `--par-vue` (24) miniatures de `--taille-vue`
   (220 px) sur `--colonnes-vue` (6) colonnes. **Toutes les planches partent
   dans un seul appel.** Consigne `CONSIGNE_VUE` : repérer les scènes qui se
   répètent, sans rien décider. Réponse `{scenes: [{numeros, scene}]}`.
4. **Scènes locales** : les photos non groupées par le modèle dont la distance
   de hachage est ≤ `--distance-scene` (20) forment des scènes candidates
   supplémentaires (« scènes proches (détection locale) »).
5. **Vérification** : chaque scène candidate, découpée par paquets de
   `--par-verif` (6), part **seule** en grand format (`--taille-verif` 520 px,
   3 colonnes), numérotée de 1 à n, avec l'heure de prise de vue sur chaque
   vignette. Consigne `CONSIGNE_VERIF` + règle conservatrice ou agressive.
   Réponse :
   `{groupes: [{garder, garder_description, doublons: [{numero, description}], raison}]}`.
6. **Application des décisions**, avec refus si :
   - le numéro est hors plage, déjà traité dans cette planche, ou désigné
     « à garder » par un groupe ;
   - la photo est **protégée** (§ 8.4) ;
   - **garde-fou des descriptions** : la description du doublon et celle de la
     photo gardée ne partagent aucun mot significatif (mots vides et accents
     ignorés). Deux scènes distinctes ne peuvent pas se supprimer l'une
     l'autre. Description absente (JSON réparé) : on laisse passer.

Mode **conservateur** par défaut : des expressions ou moments différents des
mêmes personnes ne sont pas des doublons. `--agressif` : seule la meilleure
version de chaque scène est gardée.

### 8.3 Fichiers produits (dans le dossier de travail)

| Fichier | Contenu |
|---|---|
| `doublons.csv` | `photo_marquee;numero_planche;gardee_a_la_place;gardee_description;source;raison;planche`. Réécrit **après chaque dossier**. Les photos marquées sur disque mais absentes du fichier y sont ajoutées avec la source `marquage antérieur`. |
| `nettoyage_cache.json` | Réponses API, clés `vue:<chemins>` et `verif:<chemins>[:agressif]` |
| `_planches/` | Toutes les planches envoyées : `<dossier>_vue_<i>sur<n>_<deb>-<fin>.jpg`, `<dossier>_verif_<n1>-<n2>-….jpg` (numéros de la vue d'ensemble) |
| `_doublons/` | Après `--appliquer` : photos écartées, chemins relatifs préservés |

### 8.4 Protections et reprise

- **Photo sauvée à la main** : listée dans `doublons.csv` mais plus marquée sur
  le disque → protégée, jamais re-marquée.
- **Photo gardienne** : toute photo apparaissant en `gardee_a_la_place` est
  protégée, sinon la scène entière pourrait disparaître à une relance.
- **Dossier déjà analysé** (présent dans `doublons.csv`) : ignoré, sauf avec
  `--reanalyser`. Sans cela, chaque relance grignotait les photos restantes.
- `marquer()` est tolérant : fichier absent ou déjà marqué → aucune action.

## 9. Pièges connus à ne pas reproduire dans l'application

1. **Orientation EXIF** : les scripts créaient les miniatures sans appliquer
   l'orientation, d'où des photos couchées sur les planches et un jugement IA
   dégradé (I14). En JavaScript, `createImageBitmap` l'applique ; le vérifier
   par un test (photo avec Orientation=6).
2. **Clés de cache contenant les chemins** : renommer ou déplacer un dossier
   obligeait à repayer. Dans l'application, clé fondée sur l'identité de la
   photo (nom + taille + date EXIF, ou empreinte), indépendante du dossier.
3. **CSV écrit seulement à la fin** (I11) : écrire l'état après chaque unité de
   travail.
4. **Réponses IA mal formées** (I9, I12) : liste au lieu d'objet, `null`,
   guillemets non échappés, JSON tronqué, numéro cité deux fois. Réparer,
   valider, ignorer proprement.
5. **Trop d'images par appel** (I5) : au-delà de ~9 vignettes pour une
   décision, le modèle confond les numéros. Décider sur 6 photos max en grand
   format.
6. **Seuil relatif seul** (I8) : un seuil purement relatif accuse toujours
   quelqu'un ; combiner relatif et absolu.
7. **Vidéos et autres fichiers non copiés** : dangereux si la source est
   supprimée ensuite (D21).
8. **Domicile implicite** (« première ligne du CSV ») : à remplacer par un
   attribut explicite (D19).
