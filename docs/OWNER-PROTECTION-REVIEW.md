# Owner-protection review and outstanding decisions

Prepared 2026-11-21 for an individual operator based in Israel. This is an
engineering inventory and risk checklist, not a legal opinion, compliance
certification, guarantee against claims, or fresh full security audit.

The source review began at commit
`022069bf7917b2e1355f31b02eb91a6eef0db8bd`, with the MapleStory theme/world-map
changes present in the working tree. Public HTTP observations below describe
the site as observed during this review, not a guarantee about later releases.
No Cloudflare account settings, private payment account or production server
configuration were inspected for this review.

## Observed data flows

| Area | Evidence and scope |
| --- | --- |
| Application backend | `dist/` serves a static application. App code fetches adjacent `atlas-data.json`, `hunt-data.json` and `drop-data.json`. No app login, server-side user database, form-submission API, payment checkout or upload endpoint was found. |
| Browser storage | `appearance.js`, `i18n.js`, `experience.js`, `personal.js`, `library.js`, `explorer.js` and `world-view-controls.js` use seven `maple-atlas-*` localStorage keys. Stored values include preferences, favorite/recent maps, navigation state, personal notes, collections and saved routes. They have no app-defined expiry. |
| Backups | `library.js` and `library-store.js` read and validate a selected JSON file locally, limit imports to 4 MiB, and export local data. Exported files can contain personal notes and should be treated as private, unencrypted files. There is no atlas upload. |
| Shared routes | `personal.js` puts map IDs, route options and progress into URL fragments when a user shares a route. Personal map notes are not part of that route link. |
| GitHub reports | `experience.js` creates an issue-draft URL containing the current map, route, theme and language. Clicking transfers that context to GitHub; creating a public issue is a further user action. Do not invite private details or security exploits into public reports. |
| Support links | PayPal.Me and Buy Me a Coffee are external links, opened on user action. The app does not process card data. Those providers process payment/account data independently, and payment records can make personal data available to the recipient. |
| Fonts | At review baseline, `styles.css` automatically imported Heebo/Cinzel from Google. The local replacement assets are documented in `FONT-SOURCES.md`; release verification must confirm the remote import is actually gone. |
| Cloudflare | Public HTML returned HTTP 200, a `Server: cloudflare` header and an injected `static.cloudflareinsights.com/beacon.min.js` script. That script is not present in the app source. Analytics is therefore part of observed delivery even though the app code does not initialize it. |
| Logs | `deploy/nginx.conf` disables origin access logs but retains warning/error logs. Edge/Traefik logging, retention, access and processing locations remain unverified. One HTTP response without a cookie does not establish that no browser can receive a security cookie. |

The seven observed keys are `maple-atlas-appearance-v1`,
`maple-atlas-language-v1`, `maple-atlas-experience-v1`,
`maple-atlas-personal-v1`, `maple-atlas-library-v1`,
`maple-atlas-location-v1` and `maple-atlas-world-view-v1`.

Browser-local data is not a secret vault: another person using the same browser
profile can access it, browser eviction/clearing can remove it, and a script
executing with this origin's privileges could read it. Keep the application free
of unnecessary third-party scripts and do not ask users to store sensitive data.

## Highest-priority unresolved issue: content rights

OSMS data structure and derived values are CC BY 4.0, with attribution and
modification notices already retained. Its license explicitly excludes game
names and artwork. Nexon owns the game imagery, including downloaded official
logos and original map sheets. `WORLD-MAP-ASSETS.md` records their sources; a
public download URL and an attribution do not themselves establish permission
for this site's use.

[Nexon America's Game IP guide](https://m.nexon.com/terms/1037) permits some
free-platform UGC monetization, but is not an explicit blanket authorization
for a standalone atlas rehosting extracted assets and offering downloads.
[Nexon Korea's separate guide](https://m-page.nexon.com/term/716) discusses
applications differently. Do not silently substitute one regional policy for
another. Obtain clarification or written permission covering the actual site,
artwork distribution, theme branding and optional financial support. Preserve
the independent Maple Atlas identity and a clear, visible unofficial notice.

The drop dataset includes adaptations of CC BY-NC-SA material as documented in
`source-data/drops/NOTICE.md`. Existing source/changes notices are useful;
noncommercial status alongside support links needs a specific assessment, not
an automatic assumption that a donation either is or is not commercial.
[The license](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en)
defines NC by purpose and commercial advantage/monetary compensation and
requires qualifying adaptations to retain the applicable license conditions.

Israeli fair-use analysis depends on the facts and scope of use. Being an
individual, operating a free site, or writing a disclaimer is not automatic
clearance. Consult an Israeli internet/IP lawyer for the substantial image
collection and monetization model.
[Copyright Act and amendments](https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawPrimary.aspx?lawitemid=2000641).

## Privacy, contacts and support payments

- Publish a short, accurate Hebrew/English privacy notice identifying the
  operator and a working contact channel, actual data flows, providers, purposes,
  storage behavior and relevant rights. Do not claim that no information reaches
  third parties, that no cookie is ever used, or that all infrastructure retention
  is known. [Privacy Authority disclosure guidance](https://www.gov.il/he/pages/duty_to_notify)
  and [Amendment 13 FAQ](https://www.gov.il/he/pages/tikun13_qa) explain relevant
  duties; lack of a registration requirement does not remove all other duties.
- Offer a confirmed removal action limited to this app's storage keys, with an
  export option and an honest explanation of what will be removed. Do not clear
  all origin storage indiscriminately or imply this deletes provider records.
- Distinguish [Cloudflare Analytics](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/),
  which says it does not use client storage or fingerprinting for these metrics,
  from [Cloudflare security cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/),
  which may be used by configured security products. Confirm actual settings
  before making consent or retention promises. A frontend toggle does not stop
  an analytics script injected by the edge.
- Provide a private contact channel for privacy/security/rights/accessibility
  requests. A public GitHub issue is not a suitable substitute for all of these.
  Do not invent an email address or publish private home details without an
  informed decision and a reason grounded in the applicable requirements.
- Describe support as optional; do not promise paid access, game privileges,
  service availability, charitable status or tax deductibility unless those
  claims are independently established. Keep mandatory legal rights intact;
  do not rely on an absolute no-refunds/no-liability clause.
- [Israeli PayPal.Me terms](https://www.paypal.com/paypalme/pages/terms?country.x=IL&locale.x=he_IL)
  explain public recipient details and the distinction from personal
  friends/family payments, which the Israeli page says are unavailable there.
  [PayPal's Israel agreement](https://www.paypal.com/il/legalhub/paypal/useragreement-full)
  and [privacy statement](https://www.paypal.com/il/legalhub/paypal/privacy-full)
  apply independently of the atlas's text.
- Ask an accountant to classify actual support receipts, recordkeeping and any
  registration/reporting duties. Calling money a gift or donation is not by
  itself decisive. [Officially published Israeli judgment discussing this](https://www.gov.il/BlobFolder/legalinfo/law8198-02-17/he/LegalInformation_kesher_8198-02-17.pdf).
  Do not invent a webshop contract for this currently free informational tool.
  If paid products/services are later offered, reassess consumer disclosures
  and cancellation duties. [Consumer Protection Authority guidance](https://www.gov.il/he/pages/qaflight23).

## Accessibility and security follow-through

Publish an honest accessibility statement describing the implemented features,
known limitations and contact method after testing both languages, keyboard
navigation, focus management, screen readers, text zoom, contrast, reduced
motion and alternatives to the visual map. Existing readability and motion
controls are helpful but do not establish compliance. Any exemption depends
on the actual service/operator criteria.
[Official accessibility guide](https://www.gov.il/he/pages/website_accessibility?chapterIndex=8)
and [statement guidance](https://www.gov.il/he/pages/declaration_website_accessibility?chapterIndex=2).

The repository already specifies a non-root, read-only container; dropped
capabilities; GET/HEAD-only serving; bounded requests/timeouts; several security
headers; and an aggregate origin rate limit. See `SECURITY-REVIEW.md` for the
scope of the earlier scan and tests. The rate limit is shared by all visitors,
not per-IP, and the current CSP deliberately does not restrict scripts. Neither
feature guarantees resistance to all attacks. Preserve patching, verified
releases and rollback, account MFA and scoped access, and a private incident
contact. Review actual infrastructure controls separately before changing them.

## Release checklist and limits

- Confirm local font loads and absence of automatic Google font requests.
- Test local-data deletion against unrelated storage and storage failures.
- Review every published privacy/support statement against the shipped behavior.
- Verify contact links without sending test messages to third parties.
- Recheck browser network activity and edge injection after deployment.
- Record accessibility tests actually performed and unresolved limitations.
- Keep the artwork/licensing, payment classification and infrastructure-retention
  questions visible until they are actually resolved; interface work does not
  close those questions.

This review did not contact licensors, inspect payment transactions, obtain
legal/tax advice, alter provider policies, change production configuration, or
establish compliance in every country where the site can be accessed.
