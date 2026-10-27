# CLAUDE.md — Application « Album photos »

Contexte et règles pour Claude Code. Lire `docs/SPEC_APP.md` (§ 1 d'abord)
avant toute modification non triviale.

## Le projet

Application **navigateur sans serveur** (TypeScript + Vite, un seul fichier
HTML) pour trier les photos de famille et préparer des albums photo (format
ifolor). Elle **remplace entièrement** six scripts Python d'origine, **non
publiés** : s'ils sont présents en local dans `reference/python/` (ignoré par
Git), ils servent uniquement de référence (consignes IA, seuils calibrés,
algorithmes) ; ne pas les modifier.

Un utilisateur de la famille, non informaticien : choix du dossier à trier et
d'un dossier de sortie, puis treize étapes guidées (inventaire, dossiers,
floues, doublons, tri automatique, lieux et sorties, petits dossiers,
nommage, consolidation, sélection, album, création de la sortie), chacune avec un
**aperçu modifiable** avant validation. Pas de sélection automatique : une
boîte à outils et des **aides IA à la carte**, dont le coût est affiché avant
lancement.

| Document | Contenu |
|---|---|
| `docs/SPEC_APP.md` | **La spécification** : principes, étapes, interface, fonctions IA, configuration, sortie, tests, feuille de route |
| `docs/DECISIONS.md` | Pourquoi chaque choix, calibrations sur photos réelles, incidents et leçons |
| `docs/GUIDE_UX.md` | **Règles d'interface** (ossature, photos, annuler, réglages, mots, visuel), méthode de revue |
| `docs/ux/` | Cadre des revues, inventaire des fonctions de chaque page, recherche de bonnes pratiques avec sources |
| `docs/REFERENCE_SCRIPTS.md` | Algorithmes des scripts d'origine, formats, pièges connus |
| `config.exemple/` | Modèle anonyme du dossier de configuration |
| `CONTRIBUTING.md` | Comment contribuer (en anglais) |

## Règles d'or (non négociables)

1. **La source n'est jamais modifiée.** Tout est écrit dans le dossier de
   sortie, en une synchronisation depuis le plan (`docs/SPEC_APP.md` § 4.2).
2. **Rien ne se perd.** Chaque fichier de la source (photos, vidéos, autres)
   doit se retrouver dans la sortie ; le bilan le prouve avant d'annoncer
   qu'on peut supprimer la source. Rien n'est jamais supprimé : ce qui est
   écarté va dans `_mis_de_cote/`.
3. **L'humain décide.** Les aides proposent et expliquent ; aucune photo n'est
   retenue ni écartée sans action de l'utilisateur (hors propositions qu'il
   valide).
4. **La convivialité est l'exigence principale** : simple par défaut,
   réglages avancés repliés, aperçu avant chaque validation, déplacement de
   photos en un geste, langage sans jargon (principes P1 à P10).
5. **IA à la carte et transparente** : chaque fonction IA est facultative,
   son coût est estimé avant lancement, le budget du projet est respecté,
   toute réponse est mise en cache.
6. **Ne jamais faire confiance au format des réponses IA** : réparation JSON
   puis validation de structure ; jamais d'accès à un champ non vérifié
   (incidents I9 et I12).
7. **Écrire l'état au fil de l'eau** dans `.album/` : un onglet fermé ne doit
   rien perdre ni coûter deux fois.
8. **Seuils et consignes** : calibrés sur de vraies photos. Lire
   `docs/DECISIONS.md` avant d'en changer un ; consignes IA reprises mot pour
   mot des scripts, dans `app/src/ia/consignes/` (un fichier par consigne).

## Environnement

- Node 24 (`app/.nvmrc`, installé avec nvm : `source ~/.nvm/nvm.sh && nvm use`),
  Vite, TypeScript, tests `vitest`. Commandes et structure : `app/README.md`.
- Fichier unique `app/dist/album-photos.html`, ouvert en `file://` : workers
  « classiques » seulement, pas d'OPFS (IndexedDB à la place), accès aux
  dossiers redemandé à chaque session (D26).
- Interface en Preact (`app/src/ui/`) ; la logique reste dans des fonctions
  pures testées (`app/src/lib/`) : le plan n'est modifié que par ses
  opérations annulables (`appliquer()` dans `ui/etat.ts`).
- Essais automatiques dans Chromium : `node app/outils/essai_application.mjs`
  (dossier déjà trié, API Claude simulée par interception réseau),
  `node app/outils/essai_vrac.mjs` (dossier en vrac, étapes 2 à 7 et 11,
  OpenStreetMap et API simulés),
  `node app/outils/essai_echelle.mjs DOSSIER` (vrai dossier, durées ; avec
  `VRAC=1`, tout est retrié par lieux) et
  `node app/outils/essai_navigateur.mjs` (page d'essais de la phase 0) ; sous
  WSL, bibliothèques extraites dans `~/.cache/ms-playwright/bibliotheques`.
  Ne pas modifier `app/src` pendant un essai : Vite rechargerait la page.
- Navigateurs cibles : Chrome et Edge sur ordinateur.
- **Accès local uniquement** : source, sortie et `config/` sont des dossiers
  locaux. L'accès au NAS ne fait pas partie du projet (l'utilisateur y copie
  la sortie lui-même une fois le tri terminé).
- Clé API : jamais dans le dépôt ; pour les tests, `fetch` simulé. Dans
  l'application, gardée le temps de l'onglet par défaut (D28).
- Photos de référence (incidents réels) : `tests/photos_reelles/`, non
  versionné, liste dans `docs/DECISIONS.md` § 4.
- Configuration personnelle (`config/`, coordonnées du domicile) : jamais
  dans le dépôt.

## Méthode de travail

- **Challenger chaque demande avant de l'implémenter.** Pour chaque remarque
  de l'utilisateur : reformuler le besoin réel, vérifier qu'il est bien ciblé
  (le problème vient-il vraiment de là ?), dire franchement si la remarque est
  pertinente ou non, proposer une meilleure solution si elle existe et
  signaler ses inconvénients (autres étapes, tests, simplicité). Si c'est
  ambigu, poser la question.
- Donner cet avis **avant** de coder et attendre l'accord de l'utilisateur
  pour tout ce qui change le comportement ou l'interface. Seuls les bogues
  évidents se corrigent sans attendre.
- **La convivialité passe avant les décisions passées.** Une décision (D…)
  ou une contrainte qui gêne une interface simple, fluide et intuitive, ou
  une bonne mise en page, peut être levée : le dire à l'utilisateur avec son
  numéro et proposer mieux. Les règles d'or 1 à 3 et 5 à 7 restent
  intouchables. La 4 et la 8 peuvent être revues si l'interface y gagne, en
  le disant avec leur numéro : la 4 garde son but (la convivialité), ses
  moyens peuvent changer ; pour la 8, lire `docs/DECISIONS.md` avant.
- **Toute demande d'analyse lance plusieurs agents en parallèle**, chacun
  avec un rôle, avant de rendre une synthèse et une recommandation. Rapports
  écrits dans le scratchpad ; maquette quand plusieurs dispositions sont
  possibles. Pour un sujet technique : chercheur de la meilleure technique
  (algorithmes, bibliothèques, autres approches), critique, avocat du diable.
- **Interface : les agents de `.claude/agents/` font le travail, de manière
  sérieuse, à chaque fois** (même pour une petite remarque : mieux vaut
  cinq agents qu'une page à refaire quinze fois). Ils appliquent
  `docs/GUIDE_UX.md` et `docs/ux/CADRE_REVUE.md` :
  1. **Captures** de l'existant (`node app/outils/captures_ux.mjs DOSSIER
     DOSSIER_CAPTURES`, build figé : ne gêne pas les autres sessions), à
     1440×900 et 1280×720.
  2. **Revue en parallèle** par `ux-novice` (utilisateur sans connaissance),
     `ux-ergonome` (parcours, annulation, erreurs), `ux-visuel` (pixel,
     alignements, cohérence entre pages), `ux-reference` (applications
     photo de référence, exemples cherchés sur Internet) et `ux-critique`
     (défauts, inventaire des fonctions).
  3. **Synthèse**, puis `ux-avocat` (et un contrôle indépendant des faits)
     sur la proposition ; maquette si la disposition change. Ne présenter
     à l'utilisateur que la version corrigée, avec un avis franc sur sa
     demande ; **attendre son accord avant de coder**.
  4. **Après le code**, `ux-controle` : captures avant/après, aucune fonction
     perdue (`docs/ux/INVENTAIRE_FONCTIONS.md`), règles du guide, 1280×720,
     traductions, tests et essais. Rien n'est commité sans son feu vert.

## Conventions

- Code et commentaires **en français**. Interface en français et en anglais :
  les textes restent écrits en français dans le code, marqués `` t`…` ``,
  leur traduction anglaise dans `app/src/traductions/en/` (une table par
  partie ; un test vérifie qu'aucune ne manque). Mécanisme et règles :
  `app/src/lib/langue.ts`, `CONTRIBUTING.md`, D60.
- Consignes IA en français (calibrées) ; la langue du projet décide de la
  langue des noms de dossiers écrits dans la sortie et des réponses de l'IA.
- Messages courts et actionnables : ce qui s'est passé, quoi faire.
- Modèles et tarifs IA dans une table unique ; vérifier les valeurs actuelles
  sur https://docs.claude.com.
- Pas de dépendance réseau hors `api.anthropic.com` et Nominatim ;
  bibliothèques embarquées dans le build.

## État

Toutes les phases de `docs/SPEC_APP.md` § 15 sont livrées : les treize étapes
et les aides IA. La suite : corrections et améliorations d'après les essais
sur de vraies photos.
