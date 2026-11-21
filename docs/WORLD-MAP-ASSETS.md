# Authentic Classic World map artwork

Historical provenance: the owner clarified on 2026-11-21 that the interactive
view should retain the full schematic graph with an illustrated backdrop.
The game-sheet modules and images below are retained as archived research but
are no longer loaded by the app. Storybook replaces the former `classic` view;
see `STORYBOOK-ART.md` for the background now displayed.

Retrieved 2026-11-21. These are actual MapleStory Classic World game sheets, not
generated illustrations or the atlas's schematic graph layout.

## Bundled assets

| File | Original pixels | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `dist/assets/worldmaps/victoria-island.png` | 636 × 466 | 748323 | `e9d3c394dbafe253344016ddfd786611e9ba906765e4af5a2c883a6b8ff299bb` |
| `dist/assets/worldmaps/maple-island.png` | 634 × 446 | 638736 | `808232f0b00b35c639434032dcc2508eb527b03f200b1efe11d51bfbfdb77f9f` |

Direct sources:

- <https://metacw.com/static/gd/world/WorldMap001.png>
- <https://metacw.com/static/gd/world/WorldMap000.png>
- Source page: <https://hubcw.com/db/world>, which redirected to
  <https://metacw.com/db/world> at retrieval.

The source identifies its game data as extracted from the Classic World client.
The PNGs are saved without transformation, cropping or rescaling. PNG signatures,
IHDR dimensions, nonempty payloads and hashes were checked after fetching.

## Marker data and rendering contract

`dist/world-map-art.js` exposes `window.AtlasWorldMapArt`. Each `maps` entry has
`id`, `name`, `image`, `width`, `height`, `sourceImageUrl`, `sha256` and `spots`.
Each spot has a stable source `id`, source `name`, source numeric `type`, `x`, `y`
and an array of integer `mapIds`.

Coordinates use the top-left corner of the original PNG as `(0, 0)`, with x to
the right and y downward. Preserve the image aspect ratio. The marker belongs
at its center, not its top-left corner. The presentation may scale the sheet,
but must scale its markers by the same factors.

Markers were read from the source page's `wspot` elements. Source percentages
were multiplied by the sheet's original dimension and rounded to the nearest
integer. Every coordinate was independently compared with the integer WZ spot
coordinates exposed in the page data at
<https://meowdb.com/msclassic/world-map>: all 65 Victoria and 11 Maple coordinates
matched exactly. The source keys there are `WorldMap001.img:<index>` and
`WorldMap000.img:<index>`.

Map membership comes from the corresponding source table row, including **all**
linked maps in multi-map locations; it is not inferred from names, regions or
the nearest drawn town. The source spot index links the marker to its table row.
`WorldMap001-6`, for example, is the Victoria Island Dungeon cluster, and
`WorldMap001-50` is Forgotten Hollow.

The data contains 65 Victoria spots covering 256 distinct map IDs and 11 Maple
spots covering 25 distinct IDs. All 281 IDs exist in the pinned atlas dataset,
and no map ID occurs under two different spots. The other 83 atlas maps have no
published anchor in these sheets. They include hidden maps, events, Free Market
rooms and system maps. Keep them accessible through the existing map list or
an explicitly unplaced list; do not invent positions and present them as exact
game coordinates. A multi-map spot should open a choice of its matching maps.

The atlas remains pinned to OSMS source commit
`8ec33d9a51855ddcf84edf1230793bf927c1da55` and Classic World 2.0.0. These additional
world-map anchors supplement that dataset; they do not update its route graph,
portal placements, monsters or NPCs.

## Official Nexon reference

Nexon's own Classic World map is at
<https://www.nexon.com/maplestory/mscw/world-map>. Its published map data is
<https://g.nexonstatic.com/maplestory/cms/v1/world-continent-maps-classic>.
The official site also publishes larger artwork versions:

- Victoria Island: <https://g.nexonstatic.com/media/vvsnp4gf/victoria-island.png>
  (1150 × 842).
- Maple Island: <https://g.nexonstatic.com/media/cpimtvcp/maple-island.png>
  (1150 × 810).

The official files' PNG signatures and dimensions were verified. They are not
bundled here: the original game-resolution sheets match the extracted marker
coordinates directly. Nexon's website polygons describe selected landmarks,
not the complete map-ID membership required by this atlas.

## Official theme artwork

The following small, unmodified WebP files are bundled for the MapleStory theme.
Their RIFF/WEBP signatures, decoded dimensions, image integrity, and hashes were
verified, and each downloaded image was visually inspected.

| File | Pixels | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `dist/assets/maplestory/logo.webp` | 620 × 202 (RGBA) | 90848 | `7b18cbda403d29a3237bb4195f36f8d785ca65ca160a233e40583166d3bd432a` |
| `dist/assets/maplestory/henesys.webp` | 900 × 506 (RGB) | 110580 | `bb9b518f32a5bc8e8721282ee8b5abd8fe5264af4d1f41ee2228f4a7d9451977` |

The transparent Classic World logo is published by the official landing page
<https://www.nexon.com/mscw/landing>. Its page bundle explicitly describes the
asset as “MapleStory Classic World logo”:
<https://g.nexonstatic.com/mscw/assets/logo-BNkmF6yW.webp>.

The Henesys scene comes from the official world-map CMS entry for Henesys:
<https://g.nexonstatic.com/media/vhmdy2sc/popup-henesys.webp>. It is a game scene
with mushroom houses, trees and the town's portal, suitable for a decorative
theme banner. Keep legible controls on their own readable surface; the source
scene already contains small in-game labels.

These assets remain Nexon artwork and trademarks. The Maple Atlas name and
unofficial-fan-project notice must remain clear; the logo is game identification,
not evidence that this site is operated or endorsed by Nexon.

## Attribution and rights

MapleStory names and game artwork are copyright Nexon. HubCW / MetaCW and
NiaMeowDB are independent fan data sources, not Nexon. No general artwork reuse
license was stated on the reviewed source page. The OSMS dataset's CC BY 4.0
license explicitly **excludes** game artwork and names, so do not label these
PNGs as CC BY 4.0 or as original Maple Atlas artwork.

Suggested visible credit: “MapleStory artwork © Nexon. World-map data:
HubCW / MetaCW. Unofficial fan atlas.” Link the data-source credit to
<https://metacw.com/db/world>. Preserve the existing OSMS data attribution as
well; it covers a different source.
