# MapleStory theme, world views and owner notices — review

Prepared 2026-11-21. Local working changes based on
`022069bf7917b2e1355f31b02eb91a6eef0db8bd` on `feat/v3-app-shell`.
This review is not a publication record. The owner approved publication on
2026-11-21 after reviewing this candidate and granted standing authorization
for future requested Atlas updates; see `AGENTS.md`. Actual delivery evidence
is recorded separately in the workspace's production release receipts.

## What changes for users

- Fourth appearance theme: MapleStory, with cream/orange game menus, the
  verified Classic World logo, Henesys artwork and animated local creature
  sprites, leaves and a portal. Motion can be disabled. Crowded and mobile
  layouts hide ambient decorations.
- Five independent world views: the existing atlas; an open transit diagram;
  regional constellations; a postcard board; and Storybook, the complete
  original atlas graph over an original illustrated fantasy backdrop.
  Wide displays use wider regional packing in the organized layouts.
- The owner clarified that literal game world sheets were not the intended
  result. Storybook preserves all original node coordinates and connections;
  the illustration does not define geography. A previous `classic` preference
  migrates to `storybook`, including when storage writes are unavailable.
  The game-sheet research is retained but its modules are not loaded by the app.
- Every view retains all 364 map IDs, routing, selected map, scene coordinates,
  navigation progress, region filters and reachability indicators. A view is
  a presentation layer, not a replacement dataset or route graph.
- Hebrew/English notices cover privacy, site use, voluntary support,
  accessibility limitations, credits and private contact at
  `labinskyomer@gmail.com`. The operator is described as the private
  individual in Israel specified by the user.
- Fonts are served locally under their bundled OFL licenses. Public issue
  links disclose the map/route context sent to GitHub. A local-data erasure
  control requires a checked confirmation and deletes only seven explicit
  atlas storage keys, with failure reporting and cross-tab reset handling.

## Files changed

| Area | Files |
| --- | --- |
| Delivery authorization and provenance | `AGENTS.md`, `.gitattributes` (preserves font/license source bytes) |
| Integration | `dist/index.html`, `dist/app.js`, `dist/app-shell.js`, `dist/appearance.js`, `dist/experience.js`, `dist/explorer.js`, `dist/translations.js`, `dist/styles.css` |
| Theme | `dist/maple-theme.css`, `dist/maple-theme.js`, `dist/assets/maplestory/logo.webp`, `dist/assets/maplestory/henesys.webp` |
| World views | `dist/world-views.js`, `dist/world-views.css`, `dist/world-presentation.js`, `dist/world-view-controls.js`, `dist/world-view-controls.css` |
| Original game map | `dist/world-map-art.js`, `dist/world-art-layout.js`, `dist/world-clusters.js`, `dist/assets/worldmaps/victoria-island.png`, `dist/assets/worldmaps/maple-island.png` |
| Corrected illustrated view | `dist/storybook-world.css`, `dist/assets/maplestory/storybook-world.webp`, `docs/STORYBOOK-ART.md`; original game-map research above is archived, not loaded |
| Privacy and notices | `dist/legal.html`, `dist/legal.css`, `dist/legal.js`, `dist/privacy-tools.js`, `dist/privacy-tools.css` |
| Fonts | `dist/fonts.css`; five WOFF2 subsets, two OFL texts and `SOURCES.json` in `dist/assets/fonts/` |
| Tests | `tests/world-views.cjs`, `tests/privacy-tools.cjs`, `tests/atlas-graph.cjs`, `tests/preferences.cjs`, `tests/run.cjs` |
| Documentation | `README.md`, this review, `docs/WORLD-MAP-ASSETS.md`, `docs/FONT-SOURCES.md`, `docs/OWNER-PROTECTION-REVIEW.md`, `docs/LEGAL-NOTICE-DECISIONS.md` |

No dataset, portal/spawn/NPC source coordinates, backend schema, credentials,
dependency installation or production configuration changed.

## Validation

- `npm run test:app`: 813 checks pass across 18 suites. These are data/logic
  and DOM-contract tests, not browser or live-game assertions.
- `npm run verify`: pinned hashes, dataset contracts, JavaScript syntax,
  local HTML dependencies and static HTTP checks pass.
- Whitespace validation: `git -c core.autocrlf=false diff --check`.
- Original PNG signatures, dimensions and hashes are checked by the layout
  suite. All 76 source positions were cross-checked against an independent
  published game-map dataset. Font signatures, lengths and hashes were also
  verified; source and license records are bundled.
- Initial candidate browser QA at 1280×720 and 375×812: four themes; all five views;
  no horizontal page overflow; readable region headings; region focusing;
  exact shop selection from Lith Harbor; routing preserved while changing
  all five views; next navigation step and stop navigation; Hebrew/English;
  motion switch; saved preferences after reload; loaded local fonts; both
  original game images loaded; no captured JavaScript errors.
- The corrected Storybook view was checked in desktop and mobile browser
  layouts. Its artwork is a decorative backdrop; all 364 graph nodes retain
  their exact centers. Fixed screen-space line widths and marker-size floors
  keep the overview readable. Ordinary labels stay decluttered, while points
  remain visible. The prior game-sheet selection migrates on reload.
- Standalone notices were checked in both languages and on mobile. The
  erase button is disabled before confirmation, enabled after checking,
  and disabled after revocation. No real user data was erased in browser QA;
  the actual deletion/failure/cross-tab paths have 40 isolated tests.
- A manual read-only security review found no confirmed new vulnerability
  in these changes. It did not certify the site, scan live infrastructure,
  audit payment accounts or create a formal persistent security-scan record.

Screenshots are outside the repository in the workspace `work/` directory:
`maple-worlds-classic-desktop.png`, `maple-worlds-classic-mobile.png`,
`maple-worlds-board-desktop.png`, `maple-worlds-celestial-desktop.png`,
`maple-worlds-metro-desktop.png`, and `maple-worlds-mobile-picker.png`.

## Material limits and unresolved decisions

The notices are review drafts, not legal clearance or immunity. Attribution
does not authorize Nexon artwork reuse. Applicable permission for this
standalone atlas, the official logo and redistributed game images remains
unconfirmed. CC BY-NC-SA source implications and financial support also need
licensor/legal assessment. Nexon regional policies must not be conflated.

The existing origin rate limit is shared, not per visitor, and the current
CSP does not restrict scripts. Edge analytics, security cookies, retention,
cross-border processing and infrastructure access still need an account-level
review. No Cloudflare, proxy or container security settings were changed.
Payment/tax classification needs an accountant; accessibility has not received
an independent full-standard assessment. See the owner-protection review for
the evidence and primary references.

## Proposed publication and rollback

The owner approved this publication and subsequent Atlas updates on 2026-11-21.
The approved change is a new source commit and static-site image for
`maple.omerlabinsky.com`, including the new theme/views and reviewable notices.
Before publication, revalidate the live release and current rollback image,
run CI on the final commit, and retain the prior immutable image. Only the
atlas service should be replaced using the existing deployment convention.

After replacement, check health, the exact source revision, public assets,
security headers and desktop/mobile smoke flows. If those checks fail,
restore the verified previous image and verify the public revision again.
The last recorded live release at the start of this work was `022069b`;
that record is not a substitute for a fresh production check.
