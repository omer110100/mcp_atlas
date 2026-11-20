# Atlas expedition experience

The November 20, 2026 expedition update builds on the three-theme Hebrew/English atlas with journey planning, hunting goals, map occupants and a local personal library. The [25-feature checklist](EXPEDITION-CHECKLIST.md) maps the approved scope to the implementation. The pinned source-data scope is unchanged.

## Interface and visual layers

`dist/themes.css` supplies shared semantic colors for Midnight forest, Explorer's journal and Arcane aurora. The later feature stylesheets use those tokens for their own controls. `dist/atmosphere.css` and `dist/atlas-ornaments.svg` add woodland artwork, regional lighting, postcard stamps, flowing route strokes, selected-map rings and exit-portal emphasis. These layers do not change coordinates or intercept map input.

`dist/appearance.js` manages theme and motion choices. `dist/experience.js` provides the first-visit chooser, map/postcard switch, mobile bottom navigation, reading mode, desktop panel resizing, keyboard help, release notes and report/support links. Panel resizing supports pointer and keyboard input; its saved width is constrained to 300–520 pixels and available desktop space. The mobile layout has its own navigation and does not expose the desktop resize handle.

Motion is optional. Both the site switch and device reduced-motion preference stop decorative animation; JavaScript smooth scrolling also checks those preferences. The underlying map images remain source artwork with their existing attribution.

## Language and state ownership

`dist/translations.js` contains English equivalents for the static shell and Hebrew source annotations. `dist/i18n.js` captures the initial shell text nodes and attributes once, ignores detached nodes, sets `lang`/`dir`, and emits `atlas-languagechange`. Dynamic modules translate their own generated content rather than trying to translate rendered HTML. Game map, item, monster and NPC names retain their original form.

Route progress, map camera, selected targets, origin, comparison and search state survive language changes. The shared combobox in `dist/map-search.js` supports map IDs, English names and documented Hebrew aliases. A single language listener refreshes currently attached inputs, including dynamically added stops and hunting origins, without retaining detached controls.

The map overview and local tools use `atlas-ready`, `atlas-viewchange`, `hunt-ready` and `hunt-unavailable` to refresh source-backed UI. `atlas-originchange` updates default-origin indicators without silently replacing an origin the user is editing.

## Journey contracts

`dist/journey.js` owns pure recipe normalization and directed routing. A recipe contains `from`, `to`, up to eight ordered `stops`, a Boolean `services` choice, a progress `step`, and an optional hunting `goal`. All map references must exist in the loaded map catalogue. Routing minimizes transitions while satisfying the stop order and documented service state; it does not estimate walking time or inspect a player's quest eligibility.

`dist/app.js` owns the planner and guide. It compares ordinary connections with routes allowing conditional entrances, supports stop reordering, swaps endpoints and stop order, and recalculates from an explored map. The guide includes nearby-step breadcrumbs, an all-steps selector, compact mode, previous/next controls, exit focus and a destination action. Swapping endpoints requires recalculation because the graph is directed.

An arrival marker requires a unique portal-name match in the destination's source records. Missing or ambiguous arrivals are described without guessing coordinates. Saved or shared route restoration recalculates the path; a changed path/data signature or invalid stored progress resets the guide with an explanation. Signatures are change-detection metadata, not proof that an imported file is trusted.

Hunting handoff uses `Atlas.planTo(mapId, originId, {goal})`, where `goal` is `{kind:'hunt', targets:[{kind,id}], monsterIds:[...]}`. Targets are bounded to eight, monster IDs to 128, and IDs must be nonnegative safe integers. `Hunt.describeGoal()` produces a localized plain-text description. Unknown entity IDs fall back to a generic goal count. The arrival button independently intersects requested monster IDs with actual destination spawn records, so unknown IDs cannot create coordinates. A manually edited shared goal's item-to-monster relationship is not independently reverified; rendered positions still come from the source dataset.

## Hunting and map occupants

`dist/hunt.js` retains item, monster, boss and NPC search, source attribution, exact-ID locations and map comparison. Its session-only basket holds eight goals and ranks by the number with recorded map evidence before applying the selected point/share/distance ordering. An item goal resolves through retained Classic drop observations; ambiguous or unavailable observations remain visible as unresolved evidence. Shared spawn records are counted once, and a map covering only some goals states that coverage explicitly.

Monster/boss filtering uses the levels in the loaded catalogue, currently 1–200. Empty bounds mean unrestricted bounds; malformed or reversed ranges show an error rather than silently broadening results. Native expandable explanations beside spawn points, point share and capacity explain their limits. None of these metrics represents drop probability, live population or items per hour.

`dist/map-info.js` adds a useful map summary, category indicators and per-map occupant lists. Monster counts come from `hunt-data.json` spawn records; NPC locations come from exact atlas placements. Counts distinguish entity types from their placement totals. Clicking an occupant passes its exact map and entity ID to `Atlas.openSpawns` or `Atlas.openNpcs`. NPC search retains explicit choices where an NPC has multiple documented maps. Entries without coordinates remain searchable without invented locations.

The overview distinguishes catalogue loading, failure and documented empty results, provides a retry entry point, and preserves expanded occupant sections during refresh. Categories annotate map details, directory cards, map search results and world nodes; they describe the source record, not guaranteed in-game access.

## Personal data and transfer

`dist/personal.js` retains favorites, recent maps and the active journey. `dist/library.js` adds named routes, favorite groups, map notes, an explicitly selected default origin and local backup UI. Notes and group controls are available in both map details and the full-map popup. All are browser-local; storage failure keeps the interface usable for the current page and exposes a warning. There is no account or cloud synchronization.

| Boundary | Limit or behavior |
| --- | --- |
| Route stops / hunting goals | 8 each; the basket itself lasts only for the current page |
| Named routes | 50; names up to 60 characters |
| Favorite groups | 20; names up to 40 characters |
| Map notes | One per known map ID; up to 2,000 characters |
| Recent maps | 20, with revisits moved to the front |
| Backup input | JSON, at most 4,194,304 bytes (4 MiB, labelled 4MB in the UI) |
| Shared route fragment | At most 8,192 characters; only allowed fields and no duplicate keys |

`dist/library-store.js` normalizes an allow-listed backup shape with the real journey contract. It validates known map IDs and bounds, discards foreign fields, and rejects malformed records. Prototype-like keys are not merged into application objects. File size is checked before reading/parsing, then the user sees an import preview before choosing to merge. No backup is uploaded.

Import retains existing notes for the same map ID and routes with the same case-insensitive name. Matching groups union their map IDs; new groups/routes are added only within their caps. Existing favorites/recent entries and a current journey are retained, and an existing default origin is not overwritten. A missing current journey may be imported without automatically starting it. The backup includes favorites, recent maps, current/named journeys, notes, groups and default origin; it excludes appearance/language preferences. Shared route links exclude notes, favorites and groups.

The contextual report action opens a GitHub issue draft containing the current map, route context, release, language and theme. It does not attach private notes or favorites and does not submit the issue. The support link is optional and external.

## Verification

Run `npm run verify` for pinned-source integrity, asset inventory, JavaScript syntax, HTML dependencies and static HTTP checks. Run `npm run test:app` for journey/routing, shared-link validation, catalogues, hunting overlap, map occupants, local import/merge, storage, language and preference regressions. Run `npm run check:rebuild` when checking source-data reproducibility.

Browser review should exercise the actual site on desktop and mobile viewports: all three themes and both directions, motion disabled, reading mode, stop editing, route alternatives, guide/arrival actions, hunting comparison, exact NPC highlighting, notes/groups, and backup preview/merge. Automated DOM contracts and screenshots do not establish behavior on a physical handset or verify live-game availability. Release verification belongs in the verification report; this architecture note does not claim a completed deployment or a final test count.

No packages, backend services, accounts or network translation services were added for these features. The atlas remains a researched v2.0.0 snapshot, not a live game integration.

Saved routes and groups have explicit removal controls and a session-local undo for the latest removal. Undo respects current capacity and name conflicts; it does not replace existing records or change the active journey, favorites or notes. Narrow world overviews suppress colliding labels while preserving selected-map priority and all click targets. Explicit all-labels mode and closer zoom restore labels.
