# Maple Atlas

A Hebrew interactive atlas for the official **MapleStory Classic World v2.0.0**, researched on 19 November 2026. The atlas includes every record in the published current-client map dataset, with clear separation between live-world geography, conditional content, event records, and system rooms.

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

## Files and rebuilding

`dist/` is a buildless static website. Serve it over HTTP; its JavaScript loads the adjacent `atlas-data.json`.

Run `python3 build_data.py` from this checkout to regenerate normalized data and deterministic graph positions. `source-data/` contains the pinned source snapshot, metadata, asset dimensions, supplementary connections, and source license. Local resized images are already included in `dist/assets/`.

Run `python3 build_hunt_data.py` for the catalog and positions, and `python3 build_drop_data.py` for the filtered community observations. The public source facts, hashes, license notices, matching rules, unresolved observation and excluded legacy count are archived under `source-data/drops/`.

The original data snapshot was updated at 2026-11-18T18:54:44Z. Source commit: `8ec33d9a51855ddcf84edf1230793bf927c1da55`.

## Attribution

Data from OSMS Data Explorer (https://osmsdataexplorer.com), CC BY 4.0. Grouping, Hebrew annotations, normalization and schematic layout adapted for this atlas. The exact dataset license is retained under `source-data/`.

Game names and artwork © Nexon. This is an unofficial informational fan project, not affiliated with Nexon. Additional navigation evidence is linked beside each supplement and in the atlas source panel.

Classic drop observations: MapleClassic Wiki via MS-Classic (CC BY-NC-SA 4.0), plus separately attributed public MS-Classic and MaplelandHub observations. See `source-data/drops/NOTICE.md` and each relationship's source URL. Only labelled Classic relationships were retained; numeric rates were removed.

## Validation

Independent source comparison preserved every map and portal field. Directed routing checks cover raw gates, the two documented Hollow entries, duplicate map names, same-map routes, unresolved targets, conditional services, and dynamic returns. Browser verification covers search, detailed map images, internal gates, documented entrances, and route generation.

Catalog verification checks every spawn count against the raw placements, exact coordinate bounds, icon decoding, item/monster ID joins, duplicate boss IDs, ambiguous observations, ranking semantics, and NPC/monster navigation arguments. Browser checks cover item recommendations, a boss's exact point, an NPC's exact room position, and complete walking navigation to that room.
