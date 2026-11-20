# Maple Atlas

A Hebrew and English interactive atlas for the official **MapleStory Classic World v2.0.0**, researched on 19 November 2026. The atlas includes every record in the published current-client map dataset, with clear separation between live-world geography, conditional content, event records, and system rooms.

## Run locally

Open a terminal in this checkout. With **Node.js 22 or newer** installed, run:

```bash
node --version
npm --version
npm start
```

Open **http://127.0.0.1:5173**. There are no npm dependencies to install and no frontend compilation step. The checked-in website, datasets, and map images are ready to serve. Stop the server with `Ctrl+C`.

The same commands work on Windows, macOS, and Linux. In PowerShell, use `npm.cmd start` if the shell blocks the `npm.ps1` launcher. Read [local setup and development](docs/SETUP.md) for ports, validation, optional data rebuilding, and the project structure.

| Command | Purpose | Requirement |
| --- | --- | --- |
| `npm start` | Serve `dist/` locally on port 5173 | Node.js 22+ |
| `npm start -- --port 5180` | Use a different local port | Node.js 22+ |
| `npm run verify` | Validate source hashes, dataset joins, image files, JavaScript syntax, and static serving | Node.js 22+ |
| `npm run test:app` | Run routing, search, hunting, map occupants, local library/import, preferences and language regressions | Node.js 22+ |
| `npm run check:rebuild` | Rebuild in a temporary directory and compare with the checked-in output, without changing it | Node.js 22+ and Python 3.11+ |
| `npm run build:data` | Regenerate the three datasets and two audit reports from the archived local sources | Node.js 22+ and Python 3.11+ |

## Appearance and language

The header gear opens three themes: Midnight forest, Explorer's journal and Arcane aurora. Each includes postcard map cards, woodland ornaments, regional accents and optional motion: drifting lights, route strokes, selection rings and portal emphasis. Decorations do not move map coordinates or intercept controls. The motion switch and device reduced-motion preference suppress decorative animation and smooth scrolling.

Hebrew/English language, theme, reading mode and desktop panel width are saved locally. Language changes preserve the active route, progress, map camera, search and hunting comparison. Game entity names and source datasets retain their original values. A first-visit chooser, mobile bottom navigation, keyboard help and a map/postcard switch provide direct access to the main tools.

## Journeys, hunting and personal maps

- Build a directed route with up to **8 intermediate stops**, reorder or remove stops, compare ordinary and conditional entrances, or swap the endpoints and reverse the stop order before recalculating. The guide includes previous/next controls, an all-steps selector, compact navigation and recalculation after a detour. Arrival portals are marked only when a unique source-record match exists.
- Keep a hunting goal attached to a route and show its recorded spawn points at the destination. A session-only basket holds up to **8 items, monsters or bosses** and ranks maps by documented overlap. Shared spawn records count once; unresolved drop evidence stays explicit. Level-range and boss filters, map comparisons and local metric explanations support choosing a hunting map.
- Map details list every distinct monster and NPC with recorded placements on that map, including point counts. Selecting an occupant opens its exact map and highlights its recorded locations. NPC search offers explicit per-map location actions; missing or ambiguous location evidence does not produce a guessed destination.
- Use **My places** for favorites, recent maps, a manually chosen default origin, up to **50 named routes**, **20 favorite groups**, and map notes. Notes are also available beside full map images. Saved routes retain stops, hunting purpose and progress; restoring them recalculates against the current dataset.
- Export or preview and merge a local JSON backup, limited to **4 MiB (4,194,304 bytes)** on import. Existing notes for the same map and routes with the same name are retained; matching groups merge their map IDs. The file contains personal map data, not theme or language preferences, and is never uploaded by the atlas.

All personal data is browser-local, with session-only fallback when storage is unavailable. There is no account, cloud sync, player-location detection or live spawn feed. Shared route links contain route settings and hunting goals, not private notes or favorites. **Report a problem** opens a contextual GitHub draft for the user to review and submit; it sends no report automatically.

See [interface architecture and validation](docs/EXPERIENCE.md) and the [25-feature implementation checklist](docs/EXPEDITION-CHECKLIST.md) for implementation details and limits.

## Coverage

* 364 distinct map IDs and full map images.
* 1,436 original portal records: 694 cross-map gates, 357 internal transfers, and 385 records without a fixed destination in the client.
* 21 supplemental service or documented-portal records, including the two scripted Forgotten Hollow entrances.
* Exact gate coordinates over the corresponding rendered map, stable portal numbering, incoming links, search, directory, directed routing, and source attribution.
* A unified catalog of 2,353 items, 128 monster IDs, and 311 NPC IDs.
* 8,623 recorded monster spawn points in 233 maps, plus 270 NPC placements in 132 maps. Eight boss IDs and 221 NPC IDs have recorded locations; unlocated records remain searchable without invented destinations.
* 124 explicitly Classic-labelled community drop relationships covering 63 item IDs and 26 monster IDs. One ambiguous monster-version observation is shown without automatic routing. 885 old-version-only relationships and all numeric drop rates are excluded.
* Item-to-monster map recommendations, ranking by recorded target points, share of all points, or walking transitions. Boss/NPC position layers use original-render coordinates, with navigation from a user-selected origin.

Presence in the client does not prove current in-game accessibility. Unknown portal destinations are preserved. NPC services require their stated conditions. Dynamic Free Market returns are never treated as a shortcut between towns. Map layout is schematic; map-image coordinates use original render dimensions.

Recorded spawn-point share is not drop probability, spawn frequency, active population, or expected loot per hour. Client timer values are preserved in the downloadable data but are not presented as verified server respawn timers. The map capacity field is a source estimate for one player. Drop observations are partial and their individual observation dates/builds are generally unpublished; matching current IDs does not prove each observation was retested in v2.0.0. This website is a researched snapshot, not a live game integration, and it does not control a character or detect the player's current map.

## Data and rebuilding

`dist/` is a buildless static website. Its JavaScript fetches the adjacent `atlas-data.json`, `hunt-data.json`, and `drop-data.json`. Serve the directory over HTTP; opening `index.html` directly with a `file://` URL does not provide the required fetch behavior.

`source-data/` contains the pinned source snapshot, metadata, image dimensions, supplementary connections, license notices, and build audit reports. Local map renders, minimaps, and catalog icons are already included under `dist/assets/`.

Rebuilding uses the Python standard library and makes no network requests. `npm run check:rebuild` runs all three builders in an isolated temporary copy, compares the generated datasets and audit reports, then removes that copy. `npm run build:data` performs the same isolated build and copies the five generated files back only after all builders succeed. It preserves the original snapshots and all images. These commands reproduce the archived release; they do not fetch newer game data.

The individual builders remain available: `build_data.py` normalizes maps, portals, services, and deterministic overview positions; `build_hunt_data.py` builds the item/monster/NPC catalogs and exact positions; `build_drop_data.py` filters and attributes the community observations. The drop facts, matching rules, unresolved observation, and excluded legacy count are archived under `source-data/drops/`. The optional `build_hunt_data.py --icons` command can restore catalog icons from the pinned public source and is the only normal builder option that downloads files.

The original data snapshot was updated at 2026-11-18T18:54:44Z. Source commit: `8ec33d9a51855ddcf84edf1230793bf927c1da55`.

## Attribution

Data from [OSMS Data Explorer](https://osmsdataexplorer.com), CC BY 4.0. Grouping, Hebrew annotations, normalization and schematic layout adapted for this atlas. The exact dataset license is retained in [source-data/LICENSE](source-data/LICENSE), with the public API documentation in [source-data/README.md](source-data/README.md).

Game names and artwork © Nexon. This is an unofficial informational fan project, not affiliated with Nexon. Additional navigation evidence is linked beside each supplement and in the atlas source panel.

Classic drop observations: MapleClassic Wiki via MS-Classic (CC BY-NC-SA 4.0), plus separately attributed public MS-Classic and MaplelandHub observations. See [source-data/drops/NOTICE.md](source-data/drops/NOTICE.md) and each relationship's source URL. Only labelled Classic relationships were retained; numeric rates were removed.

The dataset, drop observations, and game artwork have different rights and attribution requirements. No general open-source license has been selected for the app code; `package.json` is private and marked `UNLICENSED`. This package setting does not override the separately documented source-data licenses.

## Validation

The [verification report](docs/VERIFICATION.md) records the source inventory, historical verification evidence, browser observations, file fingerprints, and known data limits. Run `npm run test:app` for the current regression inventory; the expedition feature checklist does not replace release verification.

`npm run verify` checks all four pinned API source hashes, original map/portal preservation, known destination joins, supplementary-service semantics, monster spawn counts, NPC positions, drop joins and attribution, local image dimensions, icon hashes, JavaScript syntax, HTML dependencies, and a short HTTP smoke check on an ephemeral local port. It requires no Python, downloads, or browser automation. The single source portal anchor outside its event-map render is retained and explicitly accounted for.

Independent source comparison preserved every map and portal field. Directed routing checks cover raw gates, the two documented Hollow entries, duplicate map names, same-map routes, unresolved targets, conditional services, and dynamic returns. Browser verification covers search, detailed map images, internal gates, documented entrances, and route generation.

Catalog verification checks every spawn count against the raw placements, exact coordinate bounds, icon decoding, item/monster ID joins, duplicate boss IDs, ambiguous observations, ranking semantics, and NPC/monster navigation arguments. Browser checks cover item recommendations, a boss's exact point, an NPC's exact room position, and complete walking navigation to that room.

The automated commands validate the archived data and app contracts. They do not test the live game server or establish current availability of conditional content. Browser checks remain useful after changes to interaction or layout. The runtime versions used for the reproducibility audit were Node.js 24.22.3 and Python 3.12.14 on Linux; the scripts use cross-platform standard-library APIs, and the November 20 interface update was checked on Windows with desktop and mobile browser viewports.
