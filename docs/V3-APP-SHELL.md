# Maple Atlas 3.0: architecture and verification notes

## Scope and preserved baseline

V3 changes the application layout and route ranking. The map and catalogue data remain the existing pinned dataset; the application version and game-data version are separate.

The V2 baseline is commit `64f207cdcc80029b38a662a1e2c15985e49ec680`, saved as branch `backup/v2-legacy-design` and tag `v2.0.0-backup`. V3 work belongs to `feat/v3-app-shell`. These references are not a production rollout record.

The retained support URL is `https://buymeacoffee.com/omerlabinsky`. Support is an ordinary optional external link, with no embedded donation script or automatic outbound request.

No source-coordinate transformation, new package, account service, database or migration is required for this upgrade. Existing data downloads, catalogue browsing, hunting comparisons, notes, collections, saved routes, backup import/export, multi-stop journeys and language/theme preferences remain part of the application.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `dist/app.js` | Existing world and source-image rendering, map selection, portal interactions, route integration and scene state. |
| `dist/journey.js` | Pure recipe validation, weighted routing, directed reachability, confirmed arrival matching and route metrics. No DOM or storage. |
| `dist/app-shell.js` / `app-shell.css` | Floating top bar, collapsible drawer, mobile sheet, map controls, context tabs and companion layout. Existing controls are reparented so their handlers and state remain attached. |
| `dist/explorer.js` / `explorer.css` | Unified command search, explicit current-map memory, four recent-map breadcrumbs and nearby-map exploration. Search/ranking/storage contracts are also exposed as `AtlasExplorerCore` for tests. |
| `dist/route-tools.js` / `route-tools.css` | Route detours, comparative-estimate explanation, Discord copy, image prefetch and navigation keyboard shortcuts. |
| `dist/personal.js` | Existing route persistence and sharing, extended to preserve bounded avoidance settings. |
| `dist/map-info.js`, `hunt.js`, library and preference modules | Existing occupants, catalogue, personal information and appearance behavior, integrated into the shell. |

`Atlas` remains the integration boundary. Explorer uses `findRoute`, `reachable`, `planJourney`, `selectMap`, `openNpcs` and `openSpawns`; it does not invent routes or write map data. Shell code controls presentation rather than duplicating route state. `atlas-ready`, `atlas-viewchange`, `hunt-ready`, `hunt-unavailable` and `atlas-languagechange` update the relevant surfaces.

## Layout and interaction model

The world map or individual map image fills a `100dvh` canvas. The document itself does not scroll; drawers, catalogue panels, popovers and central dialogs scroll internally. The image scene is nonmodal, allowing search and the top bar to remain usable. About and command search use actual modal dialogs.

The default collapsed layout prioritizes map area. Opening the specified 400-pixel drawer or a half/full mobile sheet necessarily covers more than 20% of some viewports. The map remains full-size behind these contextual overlays, and the drawer can be collapsed to recover the space. This reconciles the screen-area goal with the explicit drawer and sheet requirements.

The drawer has route and map-detail modes. Detailed map content has portal, monster and NPC tabs. Advanced route stops, source explanations, technical identifiers and long About text are disclosed contextually. Mobile sheet height has three named stops and pointer/keyboard controls.

The command palette opens with the top-bar search field, `Ctrl+K` / `Cmd+K`, or `/` outside editable fields. Original English names and IDs are searchable for all indexed records. Common Hebrew name/token aliases are provided for maps, creatures, NPCs and items; this is an alias dictionary, not a claim that every possible Hebrew spelling has been translated. Canonical game names remain visible.

Monster and NPC results show only recorded locations. A nearest-location action compares actual route costs from the displayed origin under the selected travel policy. It captures the origin before opening or selecting a destination. Monsters without recorded spawn maps receive no fabricated navigation destination.

Current location means the last map opened in the atlas, including a navigation step. It is not live game tracking. It is stored separately from a manually pinned library origin in `maple-atlas-location-v1`; only known map IDs and four recent entries are retained. Storage errors keep the current session usable and expose a session-only notice.

Nearby-map exploration covers one to three directed transitions under the selected travel policy. It highlights reachable map nodes and summarizes source-backed monster spawns. Reachability does not imply a return route or satisfaction of an in-game quest requirement.

## Weighted route model

Dijkstra operates on more than a map ID: the state includes the arrival portal identity, progress through ordered stops and travel-service state such as the recorded Florina origin. Entering the same map through different portals can therefore produce different onward costs.

| Transition | Base cost |
| --- | ---: |
| Ordinary source portal | 1.0 |
| No-effect/hidden/door portal, or a supplementary documented walkable passage | 1.4 |
| Conditional NPC, quest, ship or other travel service | 3.5 |

Where a unique source-backed arrival portal and an exit coordinate are known, the added cost is their Euclidean distance divided by **1,000 source-image units**. Every map uses the same scale; a large map is not normalized down by its own width or diagonal. Straight-line distance does not model walkable platforms or obstacles.

An unrecorded or ambiguous intermediate arrival uses an explicit **1,000-unit distance assumption**, counted in `unknownDistanceSegments`. It never creates a visual arrival marker. The initial player position inside the origin map is unknown and its first walking segment is excluded from the estimate.

Displayed minutes are a comparative heuristic, using **100 source units per second** and **3 seconds per base-cost unit**. These are product assumptions, not measured MapleStory movement speed. They exclude obstacles, climbing, waiting, loading, dialogue duration and completion of entry requirements. The estimate explanation exposes both recorded distance and unknown segment count. No exact real-world arrival time is promised.

Arrival markers require an unambiguous match of the previous source portal's destination name to a portal in the destination map. Existing source coordinates are used unchanged. NPC/service arrivals without such evidence remain unmarked.

Recipe validation bounds stops, goals and avoidance lists. Detours can exclude a particular directed portal/service or map. Required origin, destination and selected stop maps are retained. Failed detours keep the previous usable route. Shared links and saved recipes retain the selected policy and exclusions so deterministic recalculation can restore the route and step.

## Performance and data boundaries

Route-image prefetch uses a bounded background queue. Replacing a route cancels obsolete work; errors/timeouts do not block navigation. Reduced-data/network conditions can limit prefetch. Cached images can make transitions faster, but network and decoding conditions mean **zero-millisecond loading cannot be guaranteed**.

Search input, local-location records and route link data are bounded. Search and source names are rendered as text or escaped markup. Search does not send queries to another service. Persisted personal notes and private library content are not added to route links or Discord copy. Remote navigation destinations are never accepted from catalogue aliases or stored location objects.

All new appearance surfaces use existing semantic theme variables. Layout uses logical directions for Hebrew RTL and English LTR. Motion preferences and operating-system reduced-motion settings remain applicable.

## Verification

The project is buildless JavaScript. It has no TypeScript compilation or standalone lint command; checks must use the actual package scripts rather than claiming unavailable tasks passed.

Relevant commands:

```text
npm run verify
npm run test:app
npm run check:rebuild
node tests/explorer.cjs
node tests/v3-routing.cjs
```

### Final native checks — 2026-11-20

| Check | Result |
| --- | --- |
| `npm run test:app` | **531 checks, 0 failures** across 15 suites. Node VM/DOM contract checks; browser observations are recorded separately below. |
| `npm run verify` | Passed source hashes/version, 364 maps, 1,436 raw portals, 621 directed pairs, 21 documented services, 2,353 items, 128 monsters, 311 NPCs, 8,623 spawn points, 270 NPC placements, 3,354 referenced images, icon hashes, syntax, HTML dependencies and static HTTP checks. |
| `npm run check:rebuild` | Passed; generated datasets and audit files remained byte-identical. |
| `git diff --check` | Passed. Existing Windows line-ending normalization warnings were informational. |

A final independent code review reproduced and fixed a language-refresh ordering regression: when the first route was planned before opening any map scene, rebuilding the route DOM could remove estimates, detours and Discord controls. A regression check now exercises that listener order. Browser confirmation retained the 25-map summary, 24 detour menus and Discord copy after switching to English with the scene still closed. No additional concrete exploitable issue was identified in this scoped review; it was not a penetration test.

### Observed browser checks — 2026-11-20

These checks used the locally served application in a real browser, separately from the Node contracts. They do not represent a production deployment or tests inside the live game.

| Requirement | Observed result |
| --- | --- |
| Full-screen desktop and mobile | At 1280×720 and 375×812, document scroll bounds equalled the viewport. The mobile sheet opened at minimized, half and full heights, scrolled internally, and responded to a real pointer drag. |
| Themes and directions | All 12 combinations of three themes × Hebrew/English × desktop/mobile retained viewport bounds. Desktop header controls and mobile appearance popovers fit. Language direction changed correctly. |
| Weighted route and alternatives | Henesys → Ellinia produced a valid seven-transition path, eight-map summary and approximately four-minute comparative estimate. Walking/conditional alternatives were selectable. Henesys → Perion is additionally covered by source-data routing contracts. |
| Successful detour | Magic Library → Parched Land changed from 14 to 24 transitions after excluding map 10002050. The excluded map was absent from the new route and present in the shared recipe exclusion list. |
| Unsuccessful detour | Avoiding the only documented Lith Harbor → Florina service showed a failure explanation while preserving the usable route and URL. Conditional requirements remained visible. |
| Arrival and departure markers | In Ellinia, the exit marker used source coordinate (252, 4895), and the confirmed arrival used (1598, 610). Labels were visibly readable in dark and parchment themes after correcting a legacy CSS specificity conflict. No inferred arrival location was drawn. |
| Companion navigation | At 375 pixels, the compact card fit with a full-width Next action, Previous and return controls. Right/left arrows advanced and returned one step. Exit focus remained above the card. |
| Unified search | Hebrew “סטמפי” and English “Stumpy” found the recorded boss and spawn location. Quick routing used the displayed current origin. Hebrew “גרנדל” found Grendel and highlighted its Magic Library location at (583, 540). Ctrl+K worked from an individual-map scene. Escape restored focus without reopening search. |
| Sharing | An actually copied route URL opened in a new tab with the same 24-transition detour, excluded map and Ellinia step (index 1). Copied Discord text contained map/portal instructions and the route URL, without personal notes or collection contents. |
| Nearby exploration | Three transitions from Henesys produced 29 highlighted reachable world-map nodes and source-backed monster disclosures. |
| Existing tools | Hunting catalogue and boss-location actions, map postcards and filters, My Places and its library sections remained accessible after shell reparenting. Catalogue stacking and keyboard focus were checked. |
| Support and motion | The support link remains https://buymeacoffee.com/omerlabinsky. The actual motion toggle was exercised; operating-system reduced-motion rules remain in CSS. OS preference emulation was not performed. |
| Browser errors | No warning or error was captured during the final inspected desktop/mobile flows. This is a scoped observation, not a guarantee of error-free behavior in every browser. |

Six representative semantic text/surface color pairs were calculated for each theme; the lowest ratio among those pairs was **5.02:1**, above the 4.5:1 normal-text threshold. This is not a complete WCAG certification. Keyboard interaction and visible focus were manually exercised in the flows above; no full screen-reader audit or physical-device Safari test was performed.

Browser artifacts are kept outside the repository in the workspace `work` folder:

- `atlas-v3-desktop.png`: Hebrew midnight world view.
- `atlas-v3-route-desktop.png`: exact source-backed entry/exit markers and route controls.
- `atlas-v3-mobile-companion.png`: 375-pixel compact navigation.
- `atlas-v3-browser-checks.json`: the 12 theme/language/viewport measurements.

### Data and Git evidence

`npm run check:rebuild` rebuilt the generated datasets for comparison and found byte-identical output, including both audit files. SHA-256 values:

| Dataset | SHA-256 |
| --- | --- |
| Atlas | `bc54ea6487f68ed3acf12e265ec46b124d8e37f523b8f9bb04af7c2dbfa3312e` |
| Hunt | `46ad01a87f1a5a876b564aa85d398f2b085023561201171be8d29119a1ce2f71` |
| Drops | `3f63b8f4e7484db1d5c90b62818cea543e1268a274b02839f5d3d15aaaab97cc` |

Local and remote `backup/v2-legacy-design` and `v2.0.0-backup` were rechecked and all resolve to `64f207cdcc80029b38a662a1e2c15985e49ec680`. The current branch is `feat/v3-app-shell`. No map, monster, NPC, item or source image data file is part of the V3 diff.

### Release status and remaining limits

At completion of local QA, V3 was an uncommitted feature-branch change and the public site still served V2. The owner subsequently explicitly approved committing/pushing `feat/v3-app-shell` and publishing it to `maple.omerlabinsky.com`. This document records the verified source candidate; actual deployed revision, CI result, image IDs and public checks belong in the separate operational release receipt. No main-branch merge is part of this release. The preflight confirmed V2 image `sha256:103379e240e76f502be5f84964b2225801ad49390781f6fa5d5b36d48d9b6678` as the live rollback baseline.

Main behavior risks are changed route ranking and reorganized navigation surfaces. Estimated minutes, incomplete Hebrew spelling aliases, unrecorded arrival locations, network-dependent image loading and overlay coverage are subject to the explicit assumptions above. Existing conditional game requirements remain visible; availability in a live game is not inferred from archived data.

## Changed files

- New UI modules: `dist/app-shell.js`, `dist/app-shell.css`, `dist/explorer.js`, `dist/explorer.css`, `dist/route-tools.js`, `dist/route-tools.css`.
- Integrated application modules: `dist/app.js`, `dist/journey.js`, `dist/personal.js`, `dist/hunt.js`, `dist/appearance.js`, `dist/experience.js`, `dist/translations.js`, `dist/index.html`.
- New checks: `tests/explorer.cjs`, `tests/v3-routing.cjs`, `tests/v3-route-tools.cjs`.
- Updated checks and runner: `tests/atlas-behavior.cjs`, `tests/atlas-graph.cjs`, `tests/hunt.cjs`, `tests/personal.cjs`, `tests/run.cjs`.
- Architecture and evidence: `docs/V3-APP-SHELL.md`.
