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
| 2026-10-27 | « Comparer en grand » avec 4 photos d'une rafale : photos minuscules, interface « horrible » | Doublons, Sélection | ouverte : le 2×2 prévu (D108 lot 2) est remplacé par la présentation calculée, choisie par l'utilisateur (côte à côte si chaque photo reste assez grande, sinon « Une à la fois » et bande ; ↑ ↓ photos, ← → groupes ; ouverture sur la ★ sinon la photo 1 ; navigation dans la journée ou le dossier) ; maquette v3 du style A à valider, cas « 4 portraits » pas encore dessiné |
| 2026-10-27 | Comparer en grand : on ne voit pas bien quelles infos vont avec quelle photo | Doublons, Sélection | ouverte : présentation calculée choisie par l'utilisateur (27.10) ; maquette v3 du style A à valider |
| 2026-10-27 | Comparer en grand : l'information « à garder » / « à écarter » se voit mal | Doublons, Sélection | ouverte : présentation calculée choisie par l'utilisateur (27.10) ; maquette v3 du style A à valider |
| 2026-10-27 | Comparer en grand : le bouton « Garder » plus la pastille « à garder », presque redondant | Doublons, Sélection | ouverte : présentation calculée choisie par l'utilisateur (27.10) ; maquette v3 du style A à valider |
| 2026-10-27 | Comparer en grand : pas de séparation entre les photos | Doublons, Sélection | ouverte : présentation calculée choisie par l'utilisateur (27.10) ; maquette v3 du style A à valider |
| 2026-10-27 | La loupe (taille des photos) change de place | toutes | prévue : D108 lot 1 |
| 2026-10-27 | Actions de la Sélection en bas de l'écran, loin des photos | Sélection | prévue : D108 (encadré « N photos choisies ») |
| 2026-10-27 | « Tri rapide » et « Annuler » incompris ; Annuler limité à l'étape affichée | Sélection, toutes | prévue : D108 (« Décider une par une », « ↶ Annuler : … ») |
| 2026-10-27 | Pas de recadrage dans la vue en grand | Sélection, visionneuse, Comparer en grand | prévue : D108 (« Recadrer et tourner » partout) ; absent de la maquette v3 de « Comparer en grand » (Doublons) |
| 2026-10-27 | Consolidation : les propositions d'abord, deux réglages visibles | Consolidation | prévue : D108 |
| 2026-10-27 | Noms proposés du Nommage perdus en quittant l'étape | Nommage | faite : D108 lot 0 (2b96740) |
| 2026-10-27 | Nommage décalé (traits des lignes) | Nommage | faite : 6ed767d |
| 2026-10-27 | Bande vide sous les photos quand l'explication est repliée | Organiser, Sélection | faite : e326e9f |
| 2026-10-27 | Agents de contrôle élargis ; les agents UX travaillent dès qu'une remarque touche l'interface | méthode | faite : agents de `.claude/agents/`, `CLAUDE.md` |
| 2026-10-27 | Agents d'interface entièrement libres et prioritaires sur le visuel (refus passés compris), puis un style figé gardé par un agent | méthode | faite : D109 (`CLAUDE.md`, `docs/ux/CADRE_REVUE.md`, `docs/ux/CHARTE.md`, `gardien-style`) |
| 2026-10-27 | Comparer en grand : couleurs du thème clair dans la vue sombre (textes illisibles), « Accepter » plus mis en avant, Ctrl+Z sans effet, touches 5 à 9 sur des photos invisibles, « Accepter » qui écarte tout sans alerte, photo tournée coupée (bogues relevés par l'analyse) | Doublons, Sélection | faite : lot A (ce commit) |
| 2026-10-27 | Ligne de style : partir sur la direction A « Table lumineuse », améliorée par les remarques de l'utilisateur novice sur B (accord aussi avec la recommandation : IA sans couleur propre, une seule police à zéro sans barre, rien de pâli avant « Accepter », C = thème sombre de A) | toutes | prévue : charte figée (D110, `docs/ux/CHARTE.md`) ; appliquée par lots, voir la ligne « Une ligne de style pour toute l'application » |
| 2026-10-27 | Style A (emprunt à B) : l'état de chaque photo écrit dans une bande sous la photo, un seul signal, rien posé sur l'image | Doublons, Sélection, Comparer, toutes les pages de photos | ouverte : maquette v3 à valider |
| 2026-10-27 | Style A (emprunt à B) : « Rien n'est supprimé » toujours visible ; la barre du bas rassure sur ce qui n'est pas encore accepté | toutes | ouverte : maquette v3 à valider |
| 2026-10-27 | Style A (emprunt à B) : le prix de l'IA écrit sur le bouton, avec sa portée | toutes les pages avec une aide IA | ouverte : maquette v3 à valider (exception « Relancer… », prix dans la fenêtre, à faire accepter) |
| 2026-10-27 | Style A (emprunt à B) : la liste « À faire ici » sur les pages de décisions ; des onglets qui disent ce qui reste sur les pages de photos | Dossiers, Tri, Petits dossiers, Nommage, Consolidation, Sortie ; Doublons | ouverte : maquette v3 (Tri, Nommage) à valider |
| 2026-10-27 | Style A (emprunt à B) : contour jaune et noir pour le clavier seulement | toutes | ouverte : maquette v3 à valider |
| 2026-10-27 | Une ligne de style pour toute l'application : direction A « Table lumineuse », améliorée par les remarques du novice sur B ; figer le style, dispositions provisoires | toutes | en cours : D110 ; lot 1 (Inter, jetons C-2/C-3/C-6, focus C-9.5, pâleur de Doublons, `charte.test.ts`, `essai_charte.mjs`) écrit le 27.10, non commité, **2 bloquants** au contrôle du gardien des demandes (vues plein écran illisibles en thème clair dans le fichier construit ; tiers du Recadreur disparus) ; lots 2 à 6 à venir |
