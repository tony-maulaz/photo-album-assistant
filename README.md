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

1. **Download** `album-photos.html` from the
   [latest release](https://github.com/tony-maulaz/photo-album-assistant/releases/latest).
   It is the whole app in one file: nothing to install.
2. **Open it** in Chrome or Edge (double-click the file).
3. Click **Sort a new folder** (an unsorted folder: phone dumps, a holiday…)
   or **Open an already sorted folder** (you mainly want the album), then
   choose the folder to sort and an empty output folder. Each step explains
   itself; the **Help** button reopens the explanation.

You can stop at any time: everything is saved in the output folder (in a
hidden `.album` folder) and the project reopens where you left it. Photos
added to the folder later are detected when you reopen the project.

### Optional: AI helpers

To use them, create an API key in the
[Claude Console](https://console.anthropic.com/) (Anthropic, paid per use)
and paste it in **Settings** (menu ☰). Each project has a budget; costs are
shown in Swiss francs (CHF), with an exchange rate you can change in
Settings.

### Optional: configuration folder

A small folder of your own (see [`config.exemple/`](config.exemple)) holds
your known places (home, grandparents, school…), family calendars and
cameras. It is not needed to start; with your home location, the automatic
sorting can also recognise trips. Choose it on the **Configuration** page
(menu ☰). Never publish it: it contains your home address.

### The album

The `Album/` folder of the output holds copies of the selected photos,
numbered in album order, and a text file with section titles, captions and a
page plan. Import them into your photo-book service (the app was designed
with [ifolor](https://www.ifolor.ch) in mind, but any service that keeps the
file order works).

### Building it yourself

Node 24 (see `app/.nvmrc`):

```sh
cd app
npm install
npm run build
```

Then open `app/dist/album-photos.html`.

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
