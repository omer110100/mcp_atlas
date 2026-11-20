# Expedition implementation checklist

This checklist maps the 25 approved product improvements to the current static-site implementation. It describes implemented behavior and its limits; it is not a deployment receipt or a substitute for browser verification. The map, portal, monster, NPC and drop source-data scope remains the pinned MapleStory Classic World v2.0.0 snapshot.

| # | Approved feature | Implementation and user-visible behavior | Limits / evidence |
| --- | --- | --- | --- |
| 1 | Multi-stop journeys | [app.js](../dist/app.js), [journey.js](../dist/journey.js): add, remove and reorder intermediate stops using the shared map picker. | At most 8 stops; exact known map IDs; directed routing preserves their order. |
| 2 | Named saved routes | [library.js](../dist/library.js), [personal.js](../dist/personal.js): save the current journey under a name, reopen it or update it from the current route. | At most 50 routes; names up to 60 characters. Browser-local recipes are recalculated on restore. |
| 3 | Hunting purpose through the journey | [hunt.js](../dist/hunt.js), [app.js](../dist/app.js), [personal.js](../dist/personal.js): carry selected goals through planning, sharing, saving and rerouting; show an arrival action for destination spawn points. | Up to 8 targets and 128 requested monster IDs. Arrival coordinates come only from matching source spawn records. |
| 4 | Three-action welcome | [experience.js](../dist/experience.js): first-visit entry points for finding something, planning a journey and finding a hunting spot. | The chooser can be reopened. Contextual map/route links are not replaced by onboarding. |
| 5 | Useful map overview | [map-info.js](../dist/map-info.js): category, exit count, special connections, monster and NPC lists; technical identifiers move into expandable details. | Occupant lists distinguish catalogue loading/failure from a map with no recorded placements. |
| 6 | Ordinary/conditional route alternatives | [app.js](../dist/app.js), [journey.js](../dist/journey.js): compare documented connections with a route allowing conditional entrances, including passage counts and unavailable alternatives. | No travel-time claim or automatic quest/character eligibility check. Documented walkable supplements retain their source semantics. |
| 7 | Swap route endpoints | [app.js](../dist/app.js): swap the start and destination and reverse intermediate-stop order. | Requires recalculation; a directed path may not work in reverse. Destination-specific hunting purpose is cleared. |
| 8 | Multi-target hunting basket | [hunt.js](../dist/hunt.js), [hunt-enhancements.css](../dist/hunt-enhancements.css): combine item, monster and boss goals; compare maps by documented goal overlap and deduplicated spawn points. | At most 8 exact goals, session-only. Partial/unresolved evidence remains explicit; shared points count once. |
| 9 | Level and boss filters | [hunt.js](../dist/hunt.js): minimum/maximum monster level and regular/all/boss choices, while retaining the dedicated boss tab. | Uses recorded levels, currently 1–200. Invalid or reversed bounds show an error; missing results are not invented. |
| 10 | Manual saved origin | [library.js](../dist/library.js), [personal.js](../dist/personal.js), [hunt.js](../dist/hunt.js): explicitly save or clear a default starting map and reuse it for new plans. | This is a user choice, not location detection. Editing a route/hunt origin does not automatically overwrite it. |
| 11 | Map notes, including the popup | [library.js](../dist/library.js): edit and read notes in map details and the full-map sidebar; keep them in My places. | One plain-text note per known map, at most 2,000 characters. Notes stay local and are escaped when rendered. |
| 12 | Favorite groups | [library.js](../dist/library.js): named map collections and assignment from the map note/group dialog. | At most 20 groups, names up to 40 characters. Map IDs are validated; group membership does not change source data. |
| 13 | Confirmed arrival and exit markers | [journey.js](../dist/journey.js), [app.js](../dist/app.js), [journey.css](../dist/journey.css): distinguish a documented arrival from the next required exit in the route guide. | Arrival requires one exact source portal-name match. Missing/ambiguous matches are disclosed without a guessed marker. |
| 14 | Breadcrumbs and all steps | [app.js](../dist/app.js): previous/current/next map context and an all-steps selector inside the navigation popup. | Guide progress is manual. Jumping among guide steps does not move or locate the player. |
| 15 | Zoom-adaptive world detail | [app.js](../dist/app.js): reduce overview clutter and expose more graph detail as the schematic map is zoomed. | Visual detail only; routing and source links remain unchanged. The overview is not geographic distance. |
| 16 | World/postcard view switch | [experience.js](../dist/experience.js), [experience.css](../dist/experience.css): switch between the graph and map-card directory, remembering the preference locally. | Deep links and an existing journey take precedence over an automatic view restore. |
| 17 | Consistent place categories | [app.js](../dist/app.js), [map-info.js](../dist/map-info.js), [map-info.css](../dist/map-info.css): category labels/icons on details, search and directory cards, with category metadata and visual cues on world nodes. | Town, hunting, special, archive and field describe source records. They do not guarantee current access. |
| 18 | Comfortable reading mode | [experience.js](../dist/experience.js), [experience.css](../dist/experience.css): roomier text and larger controls from appearance settings. | Does not alter map artwork, coordinates or data. Preference is browser-local. |
| 19 | Resizable desktop details panel | [experience.js](../dist/experience.js), [experience.css](../dist/experience.css): drag the divider or use its keyboard controls; save/reset the width. | Constrained to 300–520 pixels and available desktop space; mobile uses its dedicated layout. |
| 20 | Mobile bottom navigation | [experience.js](../dist/experience.js), [experience.css](../dist/experience.css): direct Search, Route, My places and Map actions. | Actions wait for the atlas to load; responsive browser testing is still required. |
| 21 | Keyboard help | [experience.js](../dist/experience.js): discoverable shortcut dialog; `/` search, `?` help and `N`/`P`/`F` for active route-guide actions. | Shortcuts avoid text-entry fields; route actions respect visibility, disabled controls and the active dialog. |
| 22 | Metric explanations | [hunt.js](../dist/hunt.js), [hunt-enhancements.css](../dist/hunt-enhancements.css): keyboard-accessible expandable help beside spawn points, point share and capacity. | Point share is not drop chance; point count is not live population; capacity is a single-player source estimate. |
| 23 | Contextual problem report | [experience.js](../dist/experience.js): open a GitHub issue draft with map, route, release, language and theme context. | The user reviews and submits it. No automatic sending or inclusion of private notes/favorites. |
| 24 | What is new since the last visit | [experience.js](../dist/experience.js): release notes and a New indicator keyed to the locally recorded last-seen release. | Local read state only; no account, notification service or live update feed. |
| 25 | Validated local backup | [library.js](../dist/library.js), [library-store.js](../dist/library-store.js), [personal.js](../dist/personal.js): download JSON, validate a chosen file, preview its contents and explicitly merge it. | At most 4 MiB; no upload. Existing notes/routes are retained and all map references and collection sizes are validated. |

## Additional requested map and visual improvements

Map details now show every distinct monster and NPC with a recorded placement in the selected map, with the number of positions for each ID. Selecting a row opens that exact map and highlights the requested entity. NPC catalogue results offer explicit per-map location actions; an NPC with several locations is not assigned an arbitrary single destination. Missing catalogue metadata may display a source map name or numeric ID, but never adds a placement.

The three themes remain Midnight forest, Explorer's journal and Arcane aurora. [themes.css](../dist/themes.css), [atmosphere.css](../dist/atmosphere.css) and [atlas-ornaments.svg](../dist/atlas-ornaments.svg) add woodland scenery, ambient lights, regional lighting, postcard stamps, animated route strokes, selected-map rings and required-exit emphasis. Decorations do not intercept input or move hit targets. Both the site motion switch and device reduced-motion preference suppress animations; reading mode and Hebrew/English direction remain available across themes.

## Transfer and evidence boundaries

Backups contain favorites, recent maps, active/named journey recipes, groups, notes and the manually saved origin. They exclude language/theme preferences. The 4 MiB limit is 4,194,304 bytes, labelled 4MB in the UI, and is checked before parsing. Validation rejects malformed records and unknown map IDs; foreign properties and prototype-like keys do not enter saved objects.

Merging retains an existing note for the same map ID and an existing route with the same case-insensitive name. Matching groups union their map IDs, while new routes and groups are capped. Existing personal entries and an existing origin are retained. A backup can fill a missing active journey without automatically starting it. Path signatures detect changed route data; they are not authentication signatures.

Imported/shared hunting targets use bounded safe numeric IDs. A target missing from the catalogue produces a generic localized goal description. Arrival actions separately intersect requested monsters with the destination's actual spawn records, so unknown IDs cannot fabricate positions. Manually edited shared item/monster relationships are not independently reverified. Route links include journey settings and hunting goals, not notes, groups or favorites, and fragments longer than 8,192 characters or containing duplicate/unknown route fields are rejected.

The hunting basket is session-only. Other personal data and preferences use browser storage; failure falls back to session state with visible warnings. No backend storage, account system, automatic location detection, live spawn tracking, new map coverage, drop rates or inferred portal destinations were added.

## Checks before release

Run the repository-native commands:

```bash
npm run verify
npm run test:app
npm run check:rebuild
```

The first two commands cover the source/asset and application contracts. The rebuild comparison requires Python and checks reproducibility without replacing the source snapshot. Review the actual browser UI in both languages, three themes, desktop/mobile widths and reduced-motion mode, including a multi-stop journey, exact NPC highlight, basket comparison, local notes/groups and backup preview/merge. Record release results separately; this checklist intentionally contains no final test total or deployment claim.
