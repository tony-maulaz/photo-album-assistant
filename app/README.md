# Application « Album photos »

Spécification : `../docs/SPEC_APP.md`. État actuel : les douze étapes et les
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
| `src/ui/` | Interface (Preact) : `etat.ts` (état partagé, annulation, enregistrement), `projets.ts` (actions), `pages/`, `composants/` (dont `Icones.tsx`, icônes SVG), `style.css` (jetons de couleur clair et sombre, police Plus Jakarta Sans intégrée au build, D49) |
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
