# Atlas appearance and languages

The November 20, 2026 interface update adds three complete visual themes, postcard map cards, regional color accents, clearer route progress and Hebrew/English presentation. Existing map, portal, routing, catalog, comparison and personal-library behavior is retained.

## Structure

- `dist/themes.css` is the final stylesheet. Shared semantic colors cover controls, dialogs, maps and catalog states; theme overrides do not alter map coordinates.
- `dist/translations.js` contains English equivalents for the static shell and every Hebrew annotation in the pinned datasets. It does not change source JSON or entity names.
- `dist/i18n.js` captures the initial shell's text nodes and attributes once. Dynamic modules own their own translations and rerender on `atlas-languagechange`. Detached shell nodes are ignored.
- `dist/appearance.js` validates and saves local theme/motion choices. Language is saved separately by `i18n.js`. Unavailable storage falls back to usable session preferences with a visible explanation.
- `app.js`, `hunt.js`, `personal.js` and `map-search.js` rerender text while retaining feature state. Direction follows the chosen language; game-map coordinates and names retain their proper orientation.

No packages, accounts, network translation services or backend endpoints were added. Decorative artwork is CSS/SVG; existing game artwork retains attribution. Motion is restrained, optional, and disabled for device reduced-motion preferences.

## Verification

Run `npm run verify` for source integrity, assets, all browser-script syntax, HTML dependencies and static HTTP checks. Run `npm run test:app` for behavior regressions, including invalid/blocked preference storage, complete dataset/shell translation coverage, English route and catalog rendering, language-state preservation and dynamically replaced map comboboxes.

Browser review uses the actual site at desktop and mobile viewport sizes. Check all three themes, both directions, map directory, route guide, compact navigation, portal travel, hunting comparison and local preferences. CSS screenshots and VM tests do not establish behavior on a physical handset or live-game availability.

The data remains the researched v2.0.0 snapshot; translating annotations is not a new verification of time-sensitive game conditions. Preferences and saved journeys remain browser-local.
