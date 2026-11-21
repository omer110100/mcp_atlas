# Self-hosted typefaces

Retrieved on 2026-11-21 from Google's official Fonts delivery service. The
unmodified font bytes are served locally so loading the atlas does not need a
request to Google for these typefaces.

`dist/fonts.css` preserves the existing typefaces and requested normal-style
weights: **Heebo 400–800** for the interface and **Cinzel 500–700** for Latin
headings. Unicode ranges select Hebrew, Latin or Latin Extended as needed.
`font-display: swap` keeps the existing fallback behavior. The site's existing
system-font fallbacks remain applicable to other characters. Extra mathematical
and symbol subsets offered by the current Google response are not bundled;
interface icons are SVG and remaining glyphs can use the existing fallbacks.

## Assets and verification

| Local file under `dist/assets/fonts/` | Bytes | SHA-256 |
| --- | --- | --- |
| `heebo-hebrew-variable.woff2` | 12036 | `f1f7cfaef59431c7b391df81fb05520273303840bbe917213a2ab9f41b839675` |
| `heebo-latin-variable.woff2` | 30116 | `50dae2e12dae22c920388023e35aaebcd1e1d27bbe915c83d64210377e083e60` |
| `heebo-latin-ext-variable.woff2` | 14748 | `dd3af41d4eac7f8b09b12d8d4a4bbf7ae13b0ff812560722d1a1d7c2077e02ea` |
| `cinzel-latin-variable.woff2` | 25904 | `09941fb1c169c38fd414536b37690057fc01b3117a5c63dd6571186540c8f370` |
| `cinzel-latin-ext-variable.woff2` | 14540 | `8fc2606f8ae6c569f444e138dba052d9a6e3f0657f9031796503bbb94eced600` |

Combined font payload: **97,344 bytes**. Retrieval checked the WOFF2 signature,
declared file length, table count and compressed-data size bounds. Browser font
decoding, Hebrew/English rendering and absence of Google requests should also be
checked after integrating the stylesheet; the binary checks alone do not prove
rendered layout or accessibility.

The exact source URL of every binary, its hash, weight declaration and license
URL are retained in `dist/assets/fonts/SOURCES.json`. Source CSS:

<https://fonts.googleapis.com/css2?family=Heebo:wght@400..800&family=Cinzel:wght@500..700&display=swap>

The CSS response was requested with a modern Chromium user agent to obtain
WOFF2 variable subsets. No font conversion, font editor or new dependency was
used. The source stylesheet's `unicode-range` declarations were preserved for
the selected subsets; only the URLs were changed to local paths.

## Licenses and attribution

Both typefaces are licensed under the **SIL Open Font License 1.1**. The full
copyright and license notices are redistributed alongside the font files:

- Heebo: Copyright 2014 The Heebo Project Authors
  (<https://github.com/OdedEzer/heebo>), `HEEBO-OFL.txt`.
  [Pinned Google Fonts license](https://github.com/google/fonts/blob/c1eda9233c33ad7775b27efd794f931095cf6133/ofl/heebo/OFL.txt).
- Cinzel: Copyright 2020 The Cinzel Project Authors
  (<https://github.com/NDISCOVER/Cinzel>), `CINZEL-OFL.txt`.
  [Pinned Google Fonts license](https://github.com/google/fonts/blob/3dd78844021e948ceb633d1dcee3f7885561b5d9/ofl/cinzel/OFL.txt).

The license commits identify the copied notices. The served WOFF2 binaries are
identified by their separate immutable-looking Google CDN URLs and recorded
hashes; no claim is made that a repository commit produces an identical Google
CDN subset. Font redistribution rights are separate from the Nexon artwork and
game-data rights described elsewhere in this project.

## Integration and release check

Load `fonts.css` before the other stylesheets. Remove the previous remote
`@import` from the first line of `dist/styles.css`; keeping it would still cause
a Google request. The local font-face rules contain no remote fetches.

Verify with a fresh browser context that local font requests succeed, both
families load without decoding errors, and no request reaches
`fonts.googleapis.com` or `fonts.gstatic.com`. This change addresses font
delivery only; independently injected Cloudflare services must be assessed
separately before making broader privacy claims.
