# Application « Album photos »

Spécification : `../docs/SPEC_APP.md`. État actuel : les treize étapes et les
aides IA sont livrées. Présentation générale et contribution (en anglais) :
`../README.md`, `../CONTRIBUTING.md`.

## Commandes

Node 24 (fichier `.nvmrc`) : `source ~/.nvm/nvm.sh && nvm use`, puis :

| Commande | Effet |
|---|---|
| `npm install` | Installe les dépendances |
| `npm run dev` | Serveur de développement : http://localhost:5173/album-photos.html |
| `npm run build` | Fichier unique `dist/album-photos.html` (ouvrable par double-clic), et `dist/essais-phase0.html` (page d'essais de la phase 0) |
| `npm test` | Tests vitest (les tests sur photos réelles sont sautés si `../tests/photos_reelles/` est vide) |
| `npm run verifier` | Contrôle des types |

## Structure

| Dossier | Contenu |
|---|---|
| `src/lib/` | Fonctions pures, testées sous Node : plan du projet et annulation, plan initial, inventaire (captures, doublons exacts, appareils), floues, tri par lieux (script 01), calendriers `.ics`, synchronisation de la sortie et bilan, rapport, phash, netteté, indicateurs, aides IA (nommage, fragments, consolidation, cas limites, lieux sans GPS, monuments, doublons, étiquettes, appréciation, textes, couverture, contrôles), recherche locale, outils de sélection, album, dates, vidéos MP4, JPEG, configuration, tarifs IA, noms |
| `src/navigateur/` | Code propre au navigateur : dossiers et autorisations, état du projet (`.album/`), inventaire, analyses des photos, géocodage (cache), calendriers, synchronisation, écriture de `Album/`, planches-contact, appels IA (cache, budget, coûts, recherche web) et exécuteur des demandes, résultats des aides, doublons du projet, miniatures, configuration, clé API, réglages, Nominatim, workers |
| `src/ia/consignes/` | Consignes envoyées à l'IA, une par fichier, reprises mot pour mot des scripts d'origine (non publiés) |
| `src/workers/` | Worker d'analyse (décodage à l'endroit, phash, netteté, empreinte, miniatures) |
| `src/ui/` | Interface (Preact) : `etat.ts` (état partagé, annulation, enregistrement), `projets.ts` (actions), `pages/`, `composants/` (dont `Icones.tsx`, icônes SVG), `style.css` (jetons de la charte « Table lumineuse » : couleurs claires et sombres, tailles, espacements ; `tests/charte.test.ts` refuse toute couleur ou taille de texte écrite ailleurs), `police/` (Inter 4 intégrée au build, licence OFL) |
| `src/proto/` | Page d'essais de la phase 0 (`essais-phase0.html`), gardée pour refaire les mesures sur un autre ordinateur |
| `tests/` | Tests vitest ; `tests/vecteurs/` : vecteurs de référence Python (images de synthèse) |
| `outils/` | Vecteurs Python, extraction des consignes, essais automatiques dans Chromium, contrôle indépendant d'une sortie |

## Outils

- `python3 outils/vecteurs_reference.py synthetiques > tests/vecteurs/synthetiques.json`
  et `python3 outils/vecteurs_reference.py photos ../tests/photos_reelles` :
  recalculent les vecteurs de référence avec Pillow, imagehash et OpenCV.
- `node outils/essai_application.mjs` : essai de bout en bout de
  l'application dans Chromium sans affichage (ouvrir un dossier trié,
  déplacer, annuler, créer la sortie, bilan, resynchronisation, doublons avec
  une API Claude simulée, sélection, album, `Album/`). Avec
  `CAPTURES=dossier`, enregistre des captures d'écran des pages principales.
- `node outils/essai_vrac.mjs` : parcours « Trier un nouveau dossier »
  (inventaire, captures, doublons exacts, floues, tri par lieux, étapes 5 à
  7, sortie), OpenStreetMap et API Claude simulés.
- `node outils/essai_charte.mjs` : la charte (`docs/ux/CHARTE.md`) sur le
  **fichier construit** (le build peut récrire le CSS), 21 pages de l'accueil à
  la Sortie (vues sombres comprises : Comparer, tri rapide, recadrage,
  visionneuse), à 1440×900 et 1280×580, en clair et en sombre : aucun texte
  sous 14 px, boutons à 16 px, contrastes ≥ 4,5:1, Inter seule, désactivés en
  pointillé et avec leur raison écrite (`data-raison="libelle"` ou
  `aria-describedby`), un seul bouton plein par écran (« Valider et
  continuer » plein seulement une fois l'étape finie, `data-fini`), vert plein
  sur les seuls boutons d'action, aucun caractère-icône ni émoji dans les
  textes, « Rien n'est supprimé » dans la barre du bas des étapes où l'on
  écarte, contour du clavier à chaque Tab ; `light-dark()` intact dans le
  build ; signale (sans échouer) les écrans sans bouton plein.
- `node outils/essai_cadre.mjs` : le cadre des étapes sur le fichier construit, à 1440×900, 1280×580,
  1024×464 et 1024×400, en clair et en sombre, avec 110 photos fabriquées pour que la page défile : forme E
  (D112 : la page défile en entier, une seule barre de défilement ; la ligne de l'étape collée en haut, ↶ au
  même pixel, Aide et Menu dedans ; la barre du projet part ; la vue en cours écrite dans la ligne ; la fin des
  colonnes collées visible), sur les 13 étapes ; un seul bouton plein visible à l'arrivée, à mi-course et en bas
  de la page et de chaque colonne collée, « Valider et continuer » au même pixel sur toutes les pages, Sélection (« N photos choisies »),
  Recadreur, Doublons et ses gestes. Les pages pas encore passées au cadre commun (`data-cadre="ancien"`) n'ont
  que les contrôles généraux et ceux de la forme E.
- `node outils/essai_echelle.mjs DOSSIER [CAPTURES]` : même parcours sur un
  vrai dossier trié (copié dans le stockage du navigateur), avec les durées ;
  `VRAC=1` pour tout retrier par lieux.
- `python3 outils/controler_sortie.py instantane SOURCE > avant.json`, puis
  `python3 outils/controler_sortie.py comparer SOURCE SORTIE avant.json` :
  contrôle indépendant d'une sortie (A1, A2).
- `node outils/essai_navigateur.mjs` (après `npm run build`) : pilote la page
  d'essais de la phase 0 en `file://` et via le serveur de développement.
- Dans ces deux essais, le sélecteur de dossier est simulé par le stockage
  privé du navigateur : les performances sur un vrai disque se mesurent à la
  main dans Chrome ou Edge.

## Police

`src/ui/police/inter.woff2` : sous-ensemble d'Inter 4.0 variable (65 Ko ; axes
`opsz` 14-32 et `wght` 100-900 ; fonctions `cv05`, `cv08`, `tnum`, `case`,
`calt`, `locl`, `ccmp`), latin de base, Latin-1 et **latin étendu A** (noms de
lieux et de personnes : Kraków, Dvořák, Łódź ; plus ș ț roumains), ponctuation
générale, flèches, `−`, `★`, `✓`, espace fine U+202F. Les autres signes (✕ ✦ ▾…)
ne sont jamais des caractères : ce sont les icônes SVG de
`src/ui/composants/Icones.tsx` (C-1.4). Pas de paquet fontsource : celui
d'Inter perd `cv05` et `cv08`. Pour le refaire depuis `InterVariable.woff2`
(https://github.com/rsms/inter, version 4.0 ; `pip install fonttools brotli`) :

```sh
python3 -m fontTools.subset InterVariable.woff2 --flavor=woff2 --output-file=src/ui/police/inter.woff2 \
  --unicodes="U+0020-007E,U+00A0-017F,U+0218-021B,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-205F,U+20AC,U+2122,U+2190-2193,U+2212,U+2605,U+2713" \
  --layout-features="calt,case,ccmp,cv05,cv08,locl,tnum"
```
