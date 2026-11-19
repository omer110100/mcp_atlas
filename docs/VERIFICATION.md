# Verification and coverage

Recorded on **19 November 2026 (UTC)** for the MapleStory Classic World **2.0.0** snapshot. The source data was updated at `2026-11-18T18:54:44Z`, from OSMS commit `8ec33d9a51855ddcf84edf1230793bf927c1da55` and client build `9edb6979db11216d5d887700de1ab91d1373ea19`.

The atlas preserves every map and portal record in that published source snapshot. It distinguishes a record's presence in the client from evidence that a player can currently enter it. The additional service connections and community drop observations retain their own provenance and limitations.

## Reproduce the checks

Run these commands from the repository root:

```sh
npm run verify
npm run test:app
npm run check:rebuild
```

The verification and application tests require Node.js 22 or newer and no third-party packages. Rebuilding additionally requires Python 3.11 or newer. The rebuild check uses an isolated temporary directory and compares the generated output with the checked-in files. See [SETUP.md](SETUP.md) for operating instructions.

## Recorded results

| Check | Result | What was exercised |
| --- | --- | --- |
| Repository verifier | Passed | Pinned source hashes, all raw map and portal fields, supplemental connections, catalog joins, spawn/NPC coordinates, local assets, drop provenance, JavaScript syntax and static HTTP responses |
| Directed routing suite | 28 passed, 0 failed | The application's actual route function, one-way edges, same-map routes, repeated names, service state and unresolved destinations |
| Application behavior suite | 28 passed, 0 failed | Actual search and click handlers, every fixed portal card, every internal portal card, entity layers, route departure buttons and image loading/error/retry state |
| Graph suite | 11 passed, 0 failed | Every world node and connection, all region filters, keyboard node selection, selection across filters and service highlighting |
| Catalog behavior suite | 17 passed, 0 failed | Item/monster/NPC search and routing, ranking, exact coordinates, ambiguous drops, focus retention, load-more controls, failed data requests and retries |
| Isolated rebuild | Passed | All three generated datasets and both build-audit files reproduced with identical bytes |

The four application suites comprise **84 passing checks**. They execute the actual `dist/app.js` and `dist/hunt.js` code inside Node VM contexts. Small DOM-contract stubs let the tests exercise the actual functions and registered handlers. They do not render a page, simulate browser layout or establish live server behavior. Image failure tests invoke the application's load/error handlers directly.

### Browser observations recorded during review

The primary UI reviewer separately recorded the following behavior in a browser:

* Exact numeric IDs appeared ahead of substring matches. Keyboard selection, Escape and Enter after clearing the input behaved correctly.
* Selecting a map outside the active region revealed the selected map.
* Pan Lid displayed 35 documented candidate maps, and changing the ranking between point share and point count changed the order.
* An invalid origin entered with native typing was identified. This check used native text entry because programmatic field filling alone did not reproduce the same blur/change event sequence in the automation environment.
* A 13-transition item route opened Henesys departure gate 9 at original-image coordinates `x=6753, y=419`.
* The map image loaded, NPC ID `313` appeared in The Magic Library at `x=583, y=540`, and Mushmom ID `700000` appeared at its recorded point `x=833, y=1070`.

These are the recorded browser observations for this review. The Node suites provide separate, repeatable data and behavior checks.

## Exact inventory

| Category | Verified count | Interpretation |
| --- | ---: | --- |
| Map IDs | 364 | Each ID is preserved separately, including identical names |
| World-scope records | 295 | Standard world geography in the atlas classification |
| Conditional records | 42 | Entry may depend on a quest, service or other condition |
| Event records | 23 | Presence in the client does not confirm an active event |
| System records | 3 | Retained as distinct catalog records |
| Unavailable records | 1 | The retained Orbis departure terminal, ID `10002091` |
| Raw portal records | 1,436 | Source identity, type, name, position and target preserved |
| Fixed cross-map portals | 694 | Directed raw records with another known map as target |
| Internal portal records | 357 | Transfers or anchors targeting the same map |
| Raw records without a fixed destination | 385 | No invented destination is assigned |
| Distinct directed raw map pairs | 621 | Different gates may share the same source and destination maps |
| Undirected raw visual connections | 328 | The overview combines reverse directions into one visual line |
| Supplemental connection records | 21 | 19 fixed destinations and 2 unresolved dynamic returns |
| Forgotten Hollow maps | 29 | Includes the two separately documented external entrances |
| Item IDs | 2,353 | Exact source IDs, with repeated names retained |
| Monster IDs | 128 | 98 have recorded spawn points |
| Monster spawn points | 8,623 | Across 233 maps and 799 distinct monster-map pairs |
| Boss IDs | 16 | 10 names; 8 IDs have recorded spawn points |
| NPC IDs | 311 | 221 have recorded locations |
| NPC placements | 270 | Across 132 maps |
| Local image references | 3,354 | Every referenced file exists |
| Catalog icons verified by SHA-256 | 2,674 | Checked against the pinned source asset manifest |

The two documented Hollow entrances remain unknown in the raw portal data. A separate, attributed supplement supplies their destinations for navigation. This preserves the distinction between the source record and evidence collected from a guide. The total of 1,436 raw records is unchanged.

## What the application tests establish

### Maps, gates and routing

All 364 source map IDs and all 1,436 raw portal identities match the normalized atlas. Each portal retains its raw name, type, coordinates, destination map and destination portal name. The no-effect flag applies only to source types `1` and `10`; it does not automatically classify every such portal as secret.

Every fixed cross-map gate is usable in its recorded direction. The remaining 33 one-way map pairs do not acquire a fabricated direct reverse. All 364 same-map requests return a zero-transition route. Ambiguous names such as Mushroom Town, Shortcut and Coconut Harvest require an ID to resolve a particular map.

Every one of the 694 fixed portal card handlers selects its exact destination. Every one of the 357 internal portal card handlers stays in the source map and selects the corresponding gate. Unresolved gates provide no fabricated travel button. A documented Hollow gate exposes its supplemental destination and keeps the original raw record intact.

| Route case | Verified behavior |
| --- | --- |
| Ellinia `10002000` to Forgotten Hollow `10006000` | 11 walking transitions, including the documented hidden entrance; optional conditional services are not required |
| Sleepy Dungeon V `10005054` to Forgotten Dungeon Tunnel `10006071` | One documented walking transition |
| Southperry `60` to Lith Harbor `10000000` | The one-way boat service is available when services are enabled; no reverse boat is invented |
| Florina Beach return | Pison requires the remembered departure origin; an unknown origin at route start is insufficient |
| Henesys Market `10001040` to Perion `10004000` | 10 walking transitions; the Free Market dynamic return creates no shortcut |
| Henesys Park `10001050` to Primrose Hill `80003000` | The documented Tory entry is available as a conditional service |
| Other four Moon Bunny records | No complete known route is invented |
| Kerning party quest | Documented stage progression is available only with conditional services enabled |

The route departure buttons were exercised for every step of the 11-transition Ellinia-to-Hollow route. Each opens the correct source map and exact departure gate, including the scripted Hollow entrance.

### Search, selection and scene layers

The regression checks cover stale results after clearing search, low numeric IDs being displaced by substring matches, keyboard selection and wraparound, active-option accessibility attributes, Escape, and selection of ordinary and archive maps outside the current region. Selected service connections and their neighboring nodes are highlighted.

All 8,623 monster points and 270 NPC points pass through the scene renderer without merging or moving them. Entity filters use exact IDs. Mushmom `700000` and its same-named copy `810002` remain distinct, and the copy receives no invented spawn point. The Pason `112` filter selects the documented point in Lith Harbor at `x=2750, y=1888`.

An open monster layer refreshes when its catalog arrives later. The image loading state, error message, retry action and successful recovery were tested. An invalid scene ID cannot replace the current scene with an invalid state.

The catalog behavior suite additionally checks Pan Lid's 35 documented candidate maps, target deduplication, ranking and tie ordering, invalid-origin route blocking, focus and scroll retention, and exact NPC/monster API arguments. Drop-data request failure and malformed drop JSON produce an explicit loading error rather than a claim that no drops are documented. A subsequent successful retry restores the relationships. Initial catalog failure also has a tested retry path.

### Drop observations

The exported dataset contains **124 unique item/monster relationships**, covering **63 item IDs** and **26 monster IDs**. The statuses are 99 `classic_counted`, 24 `classic_confirmed` and 1 `team_seen`. Every fixed relationship resolves to the current catalog IDs and carries its source attribution. The four Mushmom relationships use ID `700000`, not the same-named unlocated variant.

The data includes one separate unresolved species-level observation for item `4000020`. The candidate monster IDs `21` and `800011` are not collapsed into a single entity, and this observation supplies no automatic route. All 885 legacy-only relationships from the collected main table were excluded. No numeric drop rates or estimated drop chances are exported.

## Known limits

1. **Snapshot coverage:** all published records in the pinned client dataset are included. This does not prove that every record is reachable in the current server. The site does not detect a player's position, inventory, quest state or channel. Event dates and route eligibility use the researched snapshot; the data does not update itself after a game patch.
2. **Unresolved destinations:** 385 raw records have no fixed destination. Two have a separately documented Hollow supplement. The remaining records include landing points, anchors and scripts as well as possible transitions; they should not all be counted as missing active doors.
3. **Moon Bunny progression:** IDs `80003100`, `80003200`, `80003300` and `80003400` are retained without a fabricated sequence or return destination. The two maps named Shortcut remain distinct IDs.
4. **Dynamic returns:** Free Market return behavior and the party-quest final exit have no fixed target in the supplement. A Florina return requires source state. The planner intentionally reports an unknown route when that evidence is insufficient.
5. **Partial drop knowledge:** missing documentation means that no accepted relationship was found in the collected sources. It does not mean the item cannot drop. Individual observation dates and game builds are generally unpublished; matching a current ID does not establish that an observation was retested in version 2.0.0.
6. **Spawn semantics:** recorded points and their share of a map's points describe its source layout. They do not measure live population, spawn frequency, drop probability or loot per hour. A boss can move after spawning. Client timer fields are not verified live server timers, and the source's one-player capacity estimate is separate from the number of recorded points.
7. **Original coordinate exception:** event map `90040003`, Physical Fitness Test `<Level 3>`, contains raw anchor `t005`, portal ID `6`, at `x=2370, y=-63`, above the rendered image. It is preserved exactly. All recorded NPC and monster points are within their corresponding original-image bounds.
8. **Navigation model:** the overview is schematic. Route cost counts map transitions; it does not estimate travel time or simulate movement through platforms, character skills, quest requirements or combat. Internal links and exact gate positions are available separately in the map scene.

## Audited file fingerprints

These SHA-256 values identify the files used for the recorded application checks. Later changes should be checked again with the commands above.

| File | SHA-256 |
| --- | --- |
| `dist/app.js` | `4f9a3e7d95c28a674627657e769675c09ba9c3fffb09ae868d8ce606f9b53871` |
| `dist/hunt.js` | `34c4e8d54b6ed4284ab486ad5c33ab7db69ff85f5126e60a700a7a38310c59ab` |
| `dist/atlas-data.json` | `bc54ea6487f68ed3acf12e265ec46b124d8e37f523b8f9bb04af7c2dbfa3312e` |
| `dist/hunt-data.json` | `46ad01a87f1a5a876b564aa85d398f2b085023561201171be8d29119a1ce2f71` |
| `dist/drop-data.json` | `3f63b8f4e7484db1d5c90b62818cea543e1268a274b02839f5d3d15aaaab97cc` |

## Source and attribution records

The pinned inputs, original licenses and asset manifests are in [source-data](../source-data/README.md). Drop matching rules, accepted factual source snapshots and licensing details are in [the drop source notice](../source-data/drops/NOTICE.md). Every supplemental connection and fixed drop relationship also carries its source URL in the downloadable JSON.

Primary public references include the [OSMS public API documentation](https://osmsdataexplorer.com/data/api/v1/README.md), [MS-Classic observations](https://ms-classic.com/drops), [Mushmom observations](https://maplelandhub.com/classic/en/monster/700000), [MapleClassic Wiki reuse terms](https://mapleclassic.wiki/wiki/MapleWiki:About#Reusing_the_wiki) and [the Forgotten Hollow guide](https://ms-classic.com/guides/forgotten-hollow-guide).
