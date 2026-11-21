# Notice preparation and unresolved decisions

Prepared 2026-11-21 for operator review. This records implementation decisions and
primary-source checks; it is not a legal opinion, certification or permission to
use third-party material. Publication approval and deployment remain separate.

## Scope and factual basis

The owner provided the public identity **Omer Labinsky, private individual in
Israel**, and contact address **labinskyomer@gmail.com**. No residential address,
registration number, business status or charity status was inferred.

The standalone public candidate is `dist/legal.html`, `dist/legal.css` and
`dist/legal.js`. It contains privacy, use/support, accessibility, credits and
contact sections in Hebrew and English. Both language versions are present in
the HTML and remain readable when JavaScript is disabled. The script uses the
existing `maple-atlas-language-v1` preference and accepts only `he` or `en`.

The page also provides `#localDataTools` for the separately implemented local-data
controls, loads their standalone CSS/JS, and dispatches `legal-languagechange`
after language rendering. The notice distinguishes local deletion from requests
about information held by the operator or infrastructure providers.

Statements about the application were checked against `dist/library.js`,
`dist/library-store.js`, `dist/personal.js`, `dist/i18n.js`, `dist/appearance.js`,
`dist/experience.js`, the existing source notices and `docs/WORLD-MAP-ASSETS.md`.
The current design is static: no atlas accounts, account synchronization, payment
checkout or server endpoint for personal notes/backups. Backup import reads a
selected file in the browser; export creates a local download. Shared links and
public GitHub reports are separate disclosure paths. Support links lead to
PayPal and Buy Me a Coffee; the atlas itself does not collect card numbers.

The standalone legal page requests no remote fonts, scripts or media. Removing
remote Google Fonts from the atlas is a separate parallel change and must be
verified on the integrated build, not inferred from this page.

## Privacy source checks

The Israeli Privacy Protection Authority's [duty-to-notify guidance](https://www.gov.il/he/pages/duty_to_notify)
was reviewed on 2026-11-21. Its notice topics include collection purpose,
voluntary or required disclosure and consequences, recipients, controller/contact
identity and access/correction rights. The draft therefore identifies the
operator and email contact, explains optional email requests and their purpose,
and offers a route for personal-information requests without promising automatic
deletion of all records.

The Authority's [Amendment 13 professional guide](https://www.gov.il/he/pages/sguide_tikon13_professional_new)
and [questions and answers](https://www.gov.il/he/pages/tikun13_qa?chapterIndex=6)
were checked. Reduced database-registration duties do not establish an exemption
from other privacy obligations. No claim that a small private site is exempt,
that registration is required, or that a privacy officer is required was made.
Those questions depend on the actual processing and applicable law.

Cloudflare's [cookie documentation](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/)
describes security/traffic cookies that vary by enabled products and notes
cross-border processing. The notice consequently avoids “no cookies,” “anonymous
only,” or “nothing ever leaves your device.” It separates local app data from
technical delivery/security records and links the [provider privacy policy](https://www.cloudflare.com/privacypolicy/).

## Intellectual-property policies: do not collapse the jurisdictions

Two distinct primary Nexon pages were reviewed on 2026-11-21:

- [Nexon America Game IP Guide, 1037](https://m.nexon.com/terms/1037): prohibits
  commercial UGC, sets attribution and non-affiliation conditions, and describes
  limited exceptions including ad/donation revenue on freely accessible content
  platforms. It does not establish blanket permission for this independent
  atlas or its payment links.
- [Nexon Korea Game IP Guide, 716](https://m-page.nexon.com/term/716): separately
  addresses digital games/apps and prior written consent for certain nonprofit
  educational digital content. These additional provisions were **not** treated
  as automatically applicable to this owner, territory or Classic World product.

Confirm the relevant licensor, game/product terms, territory and policy scope
before relying on either guide. A professional review or specific written
permission may be needed, particularly for downloaded artwork/logo use and
financial support on a standalone site. No conclusion that the site is licensed,
unlicensed, lawful or unlawful was inferred solely from these pages.

Attribution and a disclaimer do not themselves supply permission. The visible
notice makes the fan-project relationship clear but is not a substitute for
clearing rights. No outreach to Nexon or rights holder occurred in this task.

The retained [OSMS license](../source-data/LICENSE) covers only its specified
dataset contributions and expressly excludes Nexon game content. The
[drop-data notice](../source-data/drops/NOTICE.md) distinguishes CC BY-NC-SA 4.0
wiki-derived observations from separately attributed factual observations.
Public credit identifies transformations and links the relevant licenses; it
does not relicense all downloads under a single license. No app-code license was
invented. Noncommercial and share-alike obligations need separate consideration
when support revenue, redistribution or new uses are contemplated.

## Deliberately bounded claims

- Support is voluntary, not a paid-feature purchase or commitment to perpetual
  operation. The page makes no tax-deductibility assertion or blanket no-refund
  rule. It preserves applicable rights and provider terms.
- No absolute liability waiver, exclusive court clause, indemnity demand or
  claim of security/compliance certification was introduced.
- Accessibility describes existing controls, reduced motion and list-based
  alternatives. It acknowledges complex visual-map limitations and offers help;
  it does not claim a completed WCAG/Israeli-standard audit or exemption.
- Email contact is optional. The page discourages sending unnecessary identity,
  payment, medical or security-sensitive information, and does not promise an
  unsupported response deadline.
- The footer marks the wording as an informational draft for operator review.
  Review and approve the wording before treating it as final published policy.

## Outstanding owner/infrastructure decisions

1. Verify live hosting/Cloudflare products, enabled analytics, cookie behavior,
   log fields, access permissions, retention schedules and processor locations.
   The draft intentionally does not invent a retention period. A final notice
   should be made more specific once those details are established.
2. Review the operator's email-retention process and how proportionate identity
   verification, access/correction requests and legal retention will be handled.
3. Confirm applicable Nexon permission and each data-source reuse condition;
   contact the relevant rights holder if needed. Attribution alone is not a fix.
4. Ask an Israeli legal professional to assess the actual privacy, consumer and
   accessibility duties for this service. Ask an accountant about support income,
   documentation and reporting. No business/charitable status was determined.
5. Finish integrated browser checks: both languages, keyboard/zoom, no-script
   readability, local-data controls, outbound-request inventory and link entry
   points from the atlas. Recheck whenever accounts, analytics, forms, payments,
   uploads or server storage are added.

## Checks performed for the standalone page

- `node --check dist/legal.js` passed.
- Ten in-memory Node/DOM-contract checks passed: unique IDs; all internal anchors
  resolve; five sections plus local-data mount exist; no remote asset loads;
  invalid stored-language fallback; saved-English direction/visibility;
  switching persists and updates pressed states; blocked-storage fallback;
  query-language allowlist; and initial/change notifications to privacy tools.
- These are syntax and behavior-contract checks, not browser, screen-reader,
  legal or production-infrastructure validation.

No package installation, production configuration change, Git mutation or
deployment was performed as part of this standalone notice implementation.
