# Photo Album Assistant

A guided assistant, in a single HTML page, to sort a folder of family photos
and prepare a printed photo album. Everything happens on your own computer:
there is no server and no account to create.

It is built for people who are not computer experts. You choose the folder to
sort and an output folder, then follow thirteen steps, each with a preview you
can adjust before validating. **The original folder is never modified**, and
nothing is ever deleted: what you set aside is kept in the output folder.

## What it does

| Step | What happens |
|---|---|
| Inventory | Reads dates (camera data or file names), GPS positions, cameras; analyses sharpness and similarity on your computer. Sort a folder in several sessions: photos added later are detected and added without losing what is already decided. |
| Folders | For each existing subfolder: sort its photos, keep it and clean it (blurry photos, duplicates), or leave it as is. |
| Blurry photos | Scores the sharpness of every photo; you adjust the tolerance and rescue the ones you like. |
| Duplicates | Exact copies (you choose which one to keep), bursts of near-identical photos found locally; optionally, the same scene shot several times (AI). |
| Automatic sorting | Puts screenshots aside, then groups photos by place and outing (GPS, trips away from home, known places, place names from OpenStreetMap, family calendar). |
| Places and outings | Fix the result: drag photos between folders, timeline view, undo. |
| Small folders, naming, consolidation | Attach stray photos to the right outing, give folders meaningful names, merge folders that cover the same activity. |
| Selection | A toolbox, never an automatic choice: ★ / ★★, quick review, piles of similar photos, side-by-side comparison, balance per day, target number of pages. |
| Album | Order, sections, titles, captions, cover, paginated preview. |
| Output | Writes the sorted archive, the numbered album folder ready for a photo book service, the set-aside items and a report proving that every source file is in the output. |

## Optional AI helpers

Some steps offer help from Claude (Anthropic): naming folders, finding
duplicates of the same scene, describing and rating photos, proposing album
texts. They are all optional and use your own API key, typed in the page.

- The estimated cost is shown before anything is sent.
- A budget per project is enforced.
- Every answer is cached: running a helper again costs nothing.

Without a key, everything else works.

## Privacy

- The page runs from a local file (`file://`); your photos are only read.
- The only network calls are:
  - `api.anthropic.com`, when you launch an AI helper;
  - `nominatim.openstreetmap.org`, to name places (only coordinates are sent).
- Your API key stays in the browser and is never written to the output folder.

## Requirements

Chrome or Edge on a desktop computer. The app relies on the File System Access
API, which Firefox and Safari do not provide.

## Getting started

Build the single-file app (Node 24, see `app/.nvmrc`):

```sh
cd app
npm install
npm run build
```

Then open `app/dist/album-photos.html` by double-clicking it.

## Language

The interface is available in **English** and **French**. It follows the
browser language; you can change it on the welcome page or in Settings.

Each project also has a language, chosen when it is created (by default the
interface language). It sets the language of everything the app writes: the
names of the folders it creates in the output, the report, the names and
texts proposed by the AI, and place names from OpenStreetMap.

## Development

```sh
cd app
npm run dev        # http://localhost:5173/album-photos.html
npm test           # unit tests (Vitest)
npm run verifier   # type checking
```

- Code structure and tools: [`app/README.md`](app/README.md) (French).
- Design documents (French): [specification](docs/SPEC_APP.md),
  [decisions and calibrations](docs/DECISIONS.md),
  [algorithms of the original scripts](docs/REFERENCE_SCRIPTS.md).

## Contributing

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
