# Classic drop observations: sources and reuse

This directory stores the factual source payloads used by `build_drop_data.py`.
It does not contain a complete or official Classic World drop table. All files
were collected on 19 November 2026. Exact input and source-page hashes are in
`provenance.json`. Run `python build_drop_data.py` from the project directory to
rebuild `dist/drop-data.json`; the script also accepts `--output PATH`.

## MapleClassic Wiki observations, published through MS-Classic

Source: <https://ms-classic.com/drops>

The original published payload had 1,006 relationships for 65 monster names.
Only its 121 rows explicitly labelled `Confirmed in Classic` or `Seen by our
team` are archived here. The other 885 rows were old-version references without
a Classic confirmation label and were excluded. One of the 121 observations
has an unresolved monster variant and is retained separately from routable
links. The output therefore has 120 usable relationships from this source.

MS-Classic attributes its Classic kill observations to MapleClassic Wiki.
MapleClassic Wiki licenses its original content and Cargo data under Creative
Commons Attribution-NonCommercial-ShareAlike 4.0 International:

- Attribution and reuse: <https://mapleclassic.wiki/wiki/MapleWiki:About#Reusing_the_wiki>
- License: <https://creativecommons.org/licenses/by-nc-sa/4.0/>
- Credit: MapleClassic Wiki contributors, via MS-Classic.
- Changes: selected explicit Classic labels; matched IDs to the current OSMS
  catalogue; separated an ambiguous variant; translated explanatory labels;
  removed every drop rate from the application dataset.

The Pan Lid observation is explicitly labelled as MS-Classic's own team
sighting. The source page does not state a general reuse license for the team's
work. Only that isolated factual relationship is used, linked and attributed;
no page prose, interface, or publisher code is reproduced.

Original `rate` strings in the archived MS-Classic factual payload are retained
solely for reproducibility. Some are historical references even when the
relationship is confirmed. The builder never transfers them into the output.

## MaplelandHub Classic World: Mushmom observations

Source: <https://maplelandhub.com/classic/en/monster/700000>

Four rows explicitly labelled `Confirmed in Classic` are retained as isolated
factual relationships: Tobi Throwing Stars, Ilbi Throwing Stars, Gloves Attack
Scroll: Intermediate, and Earring INT Scroll: Intermediate. Both item IDs and
monster ID 700000 match the current OSMS catalogue exactly. The Ilbi and Gloves
Attack rows cite NiaDB as their underlying source; those source URLs are kept.

The page does not state a general reuse license. Only the four facts and their
source references are included. Page prose, interface, and code are not copied.
Historical KMS rates displayed next to these labels are entirely omitted.

## Six Path: numeric identifier corroboration

Source: <https://sixpath.wiki/drops>

The public page exposes 49 rows labelled `Counted in Classic`. Their numeric
item and monster URL IDs corroborate 49 of the MS-Classic relationships. They
are not counted as additional sightings because their underlying wiki source
overlaps. The page's structured dataset metadata declares CC BY-NC-SA 4.0 and
its footer attributes data to MapleClassic Wiki, MS-Classic and legacy tables.
Only the explicitly counted Classic rows are retained; no legacy rows, drop
rates, prices, or publisher interface are included.

- Terms and attribution: <https://sixpath.wiki/terms>
- License: <https://creativecommons.org/licenses/by-nc-sa/4.0/>

## Current catalogue and limits

Item and monster identities come from OSMS Data Explorer, CC BY 4.0, pinned to
the project's existing 18 November 2026 client snapshot. Its public dataset
explicitly does not contain server-side drop tables:
<https://osmsdataexplorer.com/data/api/v1/README.md>.

The final dataset has 124 fixed item/monster relationships covering 63 item IDs
and 26 monster IDs, plus one unresolved species-level relationship. Observation
dates and observation game versions are not supplied per row by the published
tables, so the output leaves them unknown. Matching a record to catalogue
version 2.0.0 does not mean the observation was retested in version 2.0.0.

An absent row means there is no supporting record in these collected sources.
It does not mean the item never drops. No drop chance is inferred or estimated.
Game names, assets and content remain the property of Nexon.
