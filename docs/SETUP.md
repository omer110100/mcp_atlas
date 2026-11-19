# Local setup and development

## Start the website

Use Node.js 22 or newer. Check an existing installation before installing anything:

```bash
node --version
npm --version
```

From the repository directory:

```bash
npm start
```

Open http://127.0.0.1:5173. The command serves the checked-in `dist/` directory, including all map images and datasets. There is no `npm install` step, dependency lockfile, framework build, database, API key, or Python requirement for normal use.

The server works independently of the terminal's directory when invoked through its full script path. It serves only the website directory, supports GET and HEAD requests, and does not expose the research snapshots or repository files. Changes are available after refreshing the page; it does not inject automatic browser reloads.

To use another port:

```bash
npm start -- --port 5180
```

The server also accepts the `HOST` and `PORT` environment variables. Command-line options take precedence. By default it binds to the local machine at `127.0.0.1`.

```bash
npm start -- --host 0.0.0.0 --port 5173
```

The last command makes the preview reachable through the machine's network interfaces, subject to local network and firewall settings. This is useful when reviewing from another device. Press `Ctrl+C` to stop the server.

### Windows

The commands work in Command Prompt and PowerShell. If PowerShell reports that `npm.ps1` cannot run, use its executable launcher without changing the shell's execution policy:

```powershell
npm.cmd start
npm.cmd run verify
```

If a port is occupied, choose another port with `--port`. If `node` is not recognized, install Node.js from [the official Node.js website](https://nodejs.org/) and reopen the terminal so PATH is refreshed.

## Verify a checkout

```bash
npm run verify
```

This read-only check uses Node.js built-ins. It validates the stored datasets and assets against the archived sources, then starts a server briefly on a randomly allocated local port for HTTP checks. It closes that server automatically and does not use a browser or modify the managed site preview.

The checks cover the contracts that can change navigation or make a position marker inaccurate:

* Source SHA-256 hashes, record counts, release version, and client build.
* Original map and portal identifiers, coordinates, numbering, target semantics, and complete coverage.
* Service endpoints and evidence, preserved unknown scripted targets, and non-routable dynamic Free Market returns.
* Every monster/map count against its exact recorded points, and every NPC location against the map placements.
* Local image dimensions against the asset manifest and every catalog icon against its stored SHA-256 hash.
* Exact item/monster joins for the attributed drop observations, with ambiguous records kept outside automatic routes.
* JavaScript syntax, local HTML dependencies, static-file responses, HEAD support, missing-file behavior, and serving-directory boundaries.

One event-map portal is recorded above the visible image: map `90040003`, raw portal ID `6`, coordinates `(2370, -63)`. This source value is preserved. It is not moved into the image to make a validation rule pass.

The command checks image headers, dimensions, and icon hashes. Full map images and all icons were also decoded during initial asset preparation. It does not replace visual browser review after changing the UI.

## Reproduce the datasets

Python 3.11 or newer is only needed to rebuild the JSON data. The scripts use the standard library, so no `pip install`, virtual environment, or timezone package is required.

The npm wrapper detects an existing Python installation. On Windows it tries `py -3`, `python`, then `python3`. On macOS and Linux it tries `python3`, then `python`. If Python is missing, the website and `npm run verify` still work.

To confirm that the checked-in output is reproducible without changing any project file:

```bash
npm run check:rebuild
```

The command copies the builders and local sources to a temporary directory, runs all three builders with explicit UTF-8 settings, and compares the three datasets and two audit reports. It prints SHA-256 hashes for the generated datasets and distinguishes identical bytes from equivalent JSON. The temporary directory is removed whether the check succeeds or fails. It does not copy the large image directory or download any data.

To regenerate after an intentional source or builder change:

```bash
npm run build:data
npm run verify
```

`build:data` first completes the same temporary build. After all builders succeed, it replaces only:

* `dist/atlas-data.json`
* `dist/hunt-data.json`
* `dist/drop-data.json`
* `source-data/build-audit.json`
* `source-data/hunt-build-audit.json`

Original source snapshots and images remain in place. The atlas builder reads only the archived source files in this checkout; it has no dependency on the original research workspace. The archived Moon Bunny event's Israel-local deadline is explicitly pinned and checked against its UTC instant, so reproducing it does not depend on an operating-system timezone database. A future event date must be reviewed with its correct local offset.

The source snapshot is pinned to commit `8ec33d9a51855ddcf84edf1230793bf927c1da55`, updated at `2026-11-18T18:54:44Z`, for client build `9edb6979db11216d5d887700de1ab91d1373ea19`. Rebuilding is not a live-data refresh. Updating to another game release requires updating the source metadata, preserving the relevant licenses, reviewing unavailable/scripted content, and rerunning the checks.

### Individual Python commands

On macOS and Linux:

```bash
python3 build_data.py
python3 build_hunt_data.py
python3 build_drop_data.py
```

On Windows with the Python launcher:

```powershell
py -3 build_data.py
py -3 build_hunt_data.py
py -3 build_drop_data.py
```

These commands write their generated files directly. The npm wrapper is preferable when checking reproducibility because it keeps the build isolated until every builder succeeds.

All assets needed by the current atlas are included. If catalog icons have been deleted, the optional `python3 build_hunt_data.py --icons` command restores missing item, monster, and NPC PNGs from the pinned public source. This option makes network requests and updates the icon manifest. It does not regenerate full map images. On Windows use `py -3` instead of `python3` for the same option.

## Project structure

| Path | Responsibility |
| --- | --- |
| `dist/index.html` | Hebrew page structure and controls |
| `dist/styles.css` | Atlas layout, map scene, and responsive styling |
| `dist/app.js` | Map catalog, graph navigation, detailed scene, and routing |
| `dist/hunt.js`, `dist/hunt.css` | Item, monster, boss, and NPC search and recommendations |
| `dist/atlas-data.json` | Maps, raw portals, schematic coordinates, and documented services |
| `dist/hunt-data.json` | Catalogs, monster spawn points, and NPC placements |
| `dist/drop-data.json` | Partial, explicitly Classic-labelled community observations |
| `dist/assets/` | Full map renders, minimaps, and item/monster/NPC icons |
| `source-data/` | Pinned source snapshots, metadata, licenses, and image manifests |
| `source-data/drops/` | Attributed drop snapshots, matching evidence, and license notice |
| `build_data.py` | Atlas normalization and deterministic overview layout |
| `build_hunt_data.py` | Catalog and exact-position normalization |
| `build_drop_data.py` | Conservative joining and attribution of confirmed observations |
| `scripts/serve.mjs` | Static development server using Node.js built-ins |
| `scripts/verify.mjs` | Data, asset, syntax, and HTTP checks |
| `scripts/rebuild-data.mjs` | Isolated Python rebuild and comparison workflow |

## Interpretation and licensing

The scope is the **Classic World 2.0.0 client snapshot**, including conditional maps, event records, system rooms, and unknown destinations. Existence in a client file does not establish present access on a live server. The overview is schematic; portal, NPC, and monster markers use the original map render's pixel coordinates, even when the displayed image was resized.

Recorded target spawn-point share is a composition measure. It is not a drop probability, active monster count, respawn rate, or estimate of loot per hour. Drop observations are partial and keep their source attribution; absence of an observation does not imply an item cannot drop.

OSMS derived data is licensed under CC BY 4.0. Wiki-derived drop observations use CC BY-NC-SA 4.0, while separately attributed factual observations retain their source-specific notices. Game content and artwork belong to Nexon. See [the main attribution section](../README.md#attribution), [OSMS license](../source-data/LICENSE), and [drop notice](../source-data/drops/NOTICE.md). The app code has no selected general open-source license; package privacy is independent of the datasets' licenses.

## Static hosting

The website can be hosted by any static server that serves the contents of `dist/` over HTTP or HTTPS. Keep the three JSON files and `assets/` beside `index.html`; no server API or SPA fallback is required. Missing JSON should return a real 404, not a copy of `index.html`.

The project intentionally exposes `npm start` for local development and leaves managed preview commands unchanged. The provided server accepts `HOST` and `PORT` if an environment chooses to run it. Publishing and repository permissions are separate from local setup.

## Application behavior checks

Run `npm run test:app` for the 84 routing, search, graph and catalog regressions. They execute the actual application code in Node VM contexts with DOM-contract stubs. See the [verification report](VERIFICATION.md) for recorded results, browser observations and the limits of these checks.
