# Demandes de l'utilisateur

Liste suivie par l'agent `gardien-demandes` : chaque remarque de
l'utilisateur sur l'application y entre dès qu'elle est faite, et n'en sort
qu'une fois **faite** (avec son commit ou sa décision) ou **reportée** (avec
le lot prévu). Rien ne se présente ni ne se commite avec une demande oubliée.
Pas de données privées : les remarques sont reformulées sans noms réels.

États : **ouverte** · **prévue** (lot ou décision annoncés) · **faite**
(commit ou D…) · **abandonnée** (avec l'accord de l'utilisateur).

| Date | Demande | Pages | État |
|---|---|---|---|
| 2026-10-27 | L'aide est tantôt à gauche, tantôt à droite : une seule place, partout | toutes | prévue : D108 lot 1 (« ? Aide » en haut à droite) |
| 2026-10-27 | « Comparer en grand » avec 4 photos d'une rafale : photos minuscules, interface « horrible » | Doublons, Sélection | prévue : D108 lot 2 (2×2 selon l'orientation, boutons sous chaque photo) |
| 2026-10-27 | La loupe (taille des photos) change de place | toutes | prévue : D108 lot 1 |
| 2026-10-27 | Actions de la Sélection en bas de l'écran, loin des photos | Sélection | prévue : D108 (encadré « N photos choisies ») |
| 2026-10-27 | « Tri rapide » et « Annuler » incompris ; Annuler limité à l'étape affichée | Sélection, toutes | prévue : D108 (« Décider une par une », « ↶ Annuler : … ») |
| 2026-10-27 | Pas de recadrage dans la vue en grand | Sélection, visionneuse | prévue : D108 (« Recadrer et tourner » partout) |
| 2026-10-27 | Consolidation : les propositions d'abord, deux réglages visibles | Consolidation | prévue : D108 |
| 2026-10-27 | Noms proposés du Nommage perdus en quittant l'étape | Nommage | faite : D108 lot 0 (2b96740) |
| 2026-10-27 | Nommage décalé (traits des lignes) | Nommage | faite : 6ed767d |
| 2026-10-27 | Bande vide sous les photos quand l'explication est repliée | Organiser, Sélection | faite : e326e9f |
| 2026-10-27 | Agents de contrôle élargis ; les agents UX travaillent dès qu'une remarque touche l'interface | méthode | faite : agents de `.claude/agents/`, `CLAUDE.md` |
