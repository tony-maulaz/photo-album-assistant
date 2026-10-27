# Cadre commun des revues d'interface

À lire par tout agent de revue (`.claude/agents/ux-*.md`) avant de commencer.

## Ce qu'on attend

Une revue **exigeante, précise et concrète**. Pas de généralités (« veiller
à la cohérence ») : un constat, sa preuve, la règle enfreinte, la correction
exacte (où, quoi, quel libellé). Mieux vaut cinq agents sérieux une fois que
quinze refontes ratées.

## À lire, dans l'ordre

1. `CLAUDE.md` (règles d'or, méthode de travail).
2. `docs/GUIDE_UX.md` : les règles du projet, citées par leur code (O2, P1,
   A1, M3…). C'est la grille de lecture.
3. `docs/ux/RECHERCHE.md` : bonnes pratiques détaillées et sources
   (règles R1.1 à R13.x, check-list § 14, anti-modèles § 15).
4. `docs/ux/INVENTAIRE_FONCTIONS.md` : ce que chaque page permet ; aucune
   fonction ne doit disparaître.
5. `docs/SPEC_APP.md` § 1 (principes P1 à P10) et § 5 (interface), et les
   décisions `docs/DECISIONS.md` citées par le sujet.
6. Les captures fournies par l'agent principal (ou les produire : `node
   app/outils/captures_ux.mjs`, voir son en-tête), puis le code des pages en
   jeu (`app/src/ui/pages/`, `app/src/ui/composants/`, `app/src/ui/style.css`,
   `app/src/ui/styles/`).

## Règles de conduite

- **Lecture seule** : un agent de revue ne modifie jamais le dépôt. Il écrit
  son rapport et ses zooms dans le dossier que l'agent principal lui donne
  (scratchpad), jamais dans `app/` ni `docs/`.
- Pas d'essai Playwright sur le serveur de développement pendant qu'une autre
  session modifie `app/src` : travailler sur un build figé
  (`captures_ux.mjs` le fait).
- Dans le shell de Claude Code, `grep` est une fonction qui échoue en pipe :
  utiliser `/usr/bin/grep`.
- Aucun vrai nom de personne, de lieu privé ou de dossier de la famille dans
  un rapport destiné au dépôt (le dépôt est public).
- Les décisions passées (D…) ne sont pas des acquis : une décision qui gêne
  une interface simple, fluide et intuitive se signale avec son numéro et
  une proposition pour la lever. Les règles d'or 1 à 3 et 5 à 7 de
  `CLAUDE.md` restent intouchables ; la 4 (ses moyens, pas son but) et la 8
  (après lecture de `docs/DECISIONS.md`) peuvent être revues, en le disant
  avec leur numéro.
- Vérifier avant d'affirmer : une affirmation sur le comportement cite
  `fichier:ligne` ou une capture. Ce qui n'est qu'un avis est marqué
  « avis ».
- Toujours regarder la page à **1280×720** en plus de 1440×900.

## Gravité

- **Bloquant** : l'utilisateur se trompe, perd du travail, ne trouve pas une
  fonction indispensable, ou croit avoir fait ce qui n'est pas fait.
- **Majeur** : il hésite, cherche, a peur, ou doit défiler pour l'essentiel ;
  incohérence visible entre pages.
- **Mineur** : finition (alignement, espacement, libellé perfectible).

## Format du rapport

1. Réponse argumentée à chaque remarque de l'utilisateur (pertinente ou
   non, vraie cause, meilleure solution, inconvénients).
2. Constats page par page : gravité · preuve (capture + zone, ou
   `fichier:ligne`) · règle (code du guide) · proposition concrète.
3. Décisions D… à lever, et pourquoi.
4. Ce qui est bien et doit être gardé.
5. Règles nouvelles à proposer pour `docs/GUIDE_UX.md` (courtes,
   vérifiables, propres à cette application).

Réponse finale à l'agent principal : 20 lignes au plus, les constats les
plus graves d'abord, avec le chemin du rapport.
