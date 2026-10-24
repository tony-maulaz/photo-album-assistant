# Contributing

Thank you for your interest in Photo Album Assistant. Bug reports, ideas and
pull requests are welcome.

## Before you start

The app is meant for people who are not computer experts, so **simplicity
comes first**. Please open an issue to discuss any change to the behaviour or
the interface before writing code.

A few rules are not negotiable (details in [`CLAUDE.md`](CLAUDE.md), in
French):

1. **The source folder is never modified.** Everything is written to the
   output folder, in one synchronisation from the project plan.
2. **Nothing is lost.** Every source file ends up in the output; the final
   report proves it. Nothing is deleted: rejected items go to `_mis_de_cote/`.
3. **The user decides.** Helpers propose and explain; no photo is kept or
   rejected without a user action.
4. **AI is optional and transparent.** Each AI helper shows its estimated
   cost first, respects the project budget and caches its answers.
5. **Never trust the format of an AI answer.** Repair the JSON, then validate
   its structure before reading any field.
6. **Save state as you go** in the project's `.album/` folder: closing the tab
   must lose nothing and never cost twice.

## Setting up

You need Node 24 (`app/.nvmrc`) and Chrome or Edge.

```sh
cd app
npm install
npm run dev          # http://localhost:5173/album-photos.html
```

## Checks

Run these before opening a pull request:

```sh
npm run verifier     # type checking
npm test             # unit tests (Vitest)
npm run build        # single-file build in dist/
```

### End-to-end tests

The scripts in `app/outils/` drive the app in Chromium with Playwright, with
the Claude API and OpenStreetMap simulated (no network calls, no cost):

```sh
npx playwright install chromium
node outils/essai_application.mjs   # an already sorted folder
node outils/essai_vrac.mjs          # an unsorted folder, all steps
```

They need a small set of real photos in `tests/photos_reelles/`, which is not
included in the repository (personal photos). Providing a public, synthetic
photo set for these tests would be a welcome contribution.

## Code conventions

- **TypeScript**, **Preact** for the interface, **Vite** to build a single
  HTML file that works offline from `file://` (classic workers only, no
  network dependency except the two services above).
- Logic lives in pure, tested functions in `app/src/lib/`; browser code in
  `app/src/navigateur/`; the interface in `app/src/ui/`.
- The project plan is only changed through undoable operations
  (`appliquer()` in `app/src/ui/etat.ts`).
- Identifiers and comments are in **French**, like the rest of the code base.
- **Interface texts are written in French in the code and marked for
  translation** with the `t` tag: `` t`Valider et continuer` ``,
  `` t`${nombre(n)} photos écartées` ``. The English text goes in the matching
  table of `app/src/traductions/en/` (the key is the French text, each
  `${…}` becoming `{0}`, `{1}`…). Plurals: `pluriel(n, 'photo', 'photos')`.
  Never call `t` at module level: mark table labels with `aTraduire('…')`
  and translate them where they are displayed. `npm test` fails if a marked
  text has no English translation. Details in `app/src/lib/langue.ts`.
- AI prompts and the names of the folders written to the output are not
  translated through `t`: prompts stay in French, and the project language
  decides the output names and the language of AI answers.
- AI prompts live in `app/src/ia/consignes/`, one file per prompt. They were
  calibrated on real photos: explain why in `docs/DECISIONS.md` before
  changing one, and keep a test showing the change.
- Keep messages short and actionable: what happened, what to do.

## Privacy

Never commit photos, videos, calendars, API keys, a personal `config/`
folder or real coordinates of a home. The `.gitignore` already excludes the
usual ones; please double-check your changes.

## Commits and pull requests

- One topic per pull request, with a short description of the why.
- Commit messages in English or French, describing what changes for the user.
- Add or update tests for any change in `app/src/lib/`.
