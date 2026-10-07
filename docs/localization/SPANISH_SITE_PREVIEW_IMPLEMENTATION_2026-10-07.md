# Spanish website Preview implementation — 2026-10-07

Status: **PREVIEW-ONLY IMPLEMENTATION AUTHORIZED / PUBLICATION HOLD**

Owner authorization:

> I authorize Preview-only Spanish website implementation. Keep publicationEnabled=false, do not index or publish /es/, do not change English defaults, member delivery, commerce, auth, passkeys, entitlements, email, captions default, or Production localization.

## Scope of this branch

Branch: `localization/spanish-site-preview-20261007`

Core learning Preview routes only:

- `/es/`
- `/es/start-here/`
- `/es/dollar-framework/`
- `/es/framework/dollar-transmission-chain/`
- `/es/framework/three-dial-dashboard/`

## Fail-closed controls

- `LOCALE_POLICY.es.publicationEnabled` remains `false`.
- Spanish content entries are `status: review`, never `published`.
- Spanish static paths are generated only when `VERCEL_ENV === 'preview'`.
- The Preview router has an explicit five-route allowlist; any additional Spanish `status: review` content remains unrouted until separately authorized.
- Production/static builds without `VERCEL_ENV=preview` generate zero routes from the Spanish Preview router.
- Spanish Preview layout emits `robots=noindex,nofollow,noarchive`.
- The Preview layout emits no canonical link and no hreflang.
- Existing sitemap filtering continues to reject unpublished locale paths.
- English `BaseLayout` remains unchanged.
- English remains the default locale.
- English remains the default video caption track.
- No member, checkout, account, audiobook, email, commerce, auth, passkey, entitlement, Supabase or Production localization behavior is added.

## Content authority

Spanish terminology and compliance wording are aligned to the final verified Spanish Edition 1.3 Candidate 1 and its current source-governance records. The website copy is a scoped web adaptation of the public English learning surfaces, not a release of the private book manuscript.

## Preview-only visual localization

- The Dollar Transmission Chain and Three-Dial Macro Dashboard have Spanish Preview-only inline SVG equivalents.
- The localized diagrams are rendered only on the authorized Spanish framework Preview routes.
- They are source components, not standalone files under `public/`, so there is no independent Spanish asset URL to expose when Spanish route generation is disabled.
- The English production SVG assets remain unchanged.
- Spanish visual labels use the same governed concepts as the page copy: `Dirección del USD`, `Tasas reales`, `Estrés de liquidez`, `Liquidez`, `Apetito por riesgo` and `Activos`.
- Regression tests reject fallback to the English diagram labels.
- TinyFish screenshot QA on the protected Preview identified one visual defect on the Spanish Dollar Transmission Chain: the inline diagram appeared clipped/overlapping.
- The Spanish-only transmission component now uses an explicit responsive figure contract: zero inherited horizontal figure margin, bounded overflow, block SVG rendering, `width:100%`, `max-width:100%`, and `height:auto`.
- The Three-Dial visual passed screenshot QA and was not changed.

## Preview validation state

- All five authorized `/es/` Preview routes return HTTP 200.
- All five render `lang="es"`, HTML `noindex,nofollow,noarchive`, and the Preview response includes `x-robots-tag: noindex`.
- No Spanish Preview route emits canonical or hreflang.
- The Spanish compliance label is localized as `Nota de cumplimiento`.
- Internal Preview navigation and explicitly labeled English legal/transparency links resolve successfully.
- Non-Preview/Production-style builds continue to generate zero Spanish Preview routes.
- Production `/es/` remains absent while `publicationEnabled=false`.

## Release boundary

This branch and its Preview deployment do **not** authorize:

- merge to `main`;
- Production Spanish route generation;
- public `/es/`;
- sitemap/hreflang;
- Spanish member delivery;
- Spanish audiobook;
- Spanish marketing email;
- changing `defaultTextTrack: 'en'`;
- entitlement, commerce, auth, passkey or database changes.

Any move beyond Preview requires a separate explicit owner authorization.

## Responsive navigation QA

The Spanish Preview originally rendered its full navigation permanently expanded on screens at or below the shared 760px breakpoint because the Preview layout set `data-open="true"` without a mobile toggle.

The Preview layout now reuses the proven site-header interaction contract without modifying shared CSS or the English layout:

- Spanish mobile control label: `Menú`;
- initial state: `aria-expanded="false"` and `data-open="false"`;
- control is bound to `#site-navigation`;
- tapping the control toggles the narrow-screen menu;
- pressing Escape closes an open narrow-screen menu and returns focus to the control;
- selecting a navigation link closes the menu;
- desktop behavior remains governed by the existing shared `.nav` flex layout;
- no English Production header/layout file was changed.

Regression tests lock this Spanish-only responsive contract.

The core-content parity restoration introduced four Markdown tables. Shared site CSS has no general table-overflow treatment, so the Spanish Preview layout now adds a local table contract:

- full-width tables with consistent cell spacing and separators;
- at the 760px mobile breakpoint, the table itself becomes horizontally scrollable;
- table cells retain a minimum readable width instead of compressing into unreadable columns;
- the rule is loaded only through `SpanishPreviewLayout.astro` and does not modify shared CSS or English Production pages.

## Accessibility and rendered-structure QA

Exact protected Preview deployment: `dpl_GmQvq3xtwwnuhLvDKKNRCcf64Tvf`  
Exact validated head: `597ad306ad836389464274f28fbda0364e0de823`

Across all five authorized Spanish Preview routes:

- exactly one `<h1>` per page;
- no heading-level jumps;
- skip link targets `#main-content` correctly;
- exactly one navigation item carries `aria-current="page"`;
- no unnamed links were found;
- all rendered `<img>` elements include alt text and explicit width/height;
- `<html lang="es">`, one page title and one meta description are present;
- no broken same-page fragment targets were found.

Spanish Preview framework SVGs:

- expose `role="img"`;
- use `aria-labelledby="title desc"`;
- include localized Spanish `<title>` and `<desc>`;
- retain no English governed diagram labels.

Review surfaces:

- unresolved Vercel Toolbar threads on the Preview branch: **0**;
- GitHub PR discussion contains only the normal Vercel deployment status bot comment; no human review blocker is present.

The regression suite also asserts the Spanish Preview allowlist is **exactly five routes**, not merely a prefix match.

## Core-content parity audit

The Spanish Preview core learning pages were compared against the current English source pages on `main`.

The initial Spanish adaptation preserved the three-dial model and route boundaries but was materially shorter in several safety-critical explanatory areas. The Preview now restores the most important omitted concepts without adding routes:

- **Empieza aquí**: same-stronger-dollar worked example plus common-confusion safeguards;
- **Marco del dólar**: rate-led vs stress-led worked example plus weekly reference-signal table;
- **Cadena de transmisión**: why driver identification matters, five-layer daily diagnostic, and explicit “what the chain does not prove” section;
- **Panel de tres diales**: worked weekly example plus explicit separation between the qualitative panel and any systematic measurement.

No new Spanish route, CTA, member surface, or link to an unauthorized Spanish surface was added.

Regression assertions lock these restored parity/safety sections in place.

## Source-authority terminology audit

Authority source: private Google Doc `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU` — **Spanish Edition 1.3 Candidate 1 — WORKING HOLD**.

Current Drive readback during this audit:

- current Drive revision: `53`;
- file remains `shared=false`;
- only owner permission is present;
- publication state remains WORKING HOLD.

Candidate 1 terminology is treated as authoritative for governed Spanish macro language. This audit aligned the Preview with two controlled terms:

- `Broad Dollar Index` → **índice de dólar amplio** / **índice de dólar amplio de la Reserva Federal**;
- generic web wording `tasa de descuento` in the rates framework → Candidate 1’s governed concept **rentabilidad mínima exigida**.

Standard market/institution proper nouns such as ICE, Cboe, FRED, DXY and OPEC+ were preserved. No route, release, member, commerce, auth, email, database or Production behavior changed.

Regression tests reject reintroduction of `Broad Dollar Index` or `tasa de descuento` in the governed Spanish Preview content.

## Source/reference visibility audit

The Spanish content entries already carried source metadata, but the Preview router did not render it. The first implementation rendered route-mapped external links dynamically; GitHub CodeQL flagged that new dynamic external-link surface. The implementation was therefore changed to static Markdown source sections inside each of the five authorized Spanish content files.

The ledger uses direct authoritative evidence surfaces rather than generic institution homepages:

- Federal Reserve H.10 current release — broad U.S. dollar indexes;
- FRED DFII10 — 10-year inflation-indexed Treasury yield / real-rate reference;
- U.S. Treasury Daily Treasury Par Yield Curve Rates;
- BIS Global Liquidity Indicators tables/dashboard;
- Cboe VIX official product/index page.

The reference set is route-specific. Links are static Markdown destinations rather than runtime-computed `href` values, and the Spanish copy explicitly notes that the linked primary sources are in English.

No source link is used to authorize publication; `publicationEnabled=false`, the five-route allowlist, noindex, sitemap exclusion, and Preview-only generation remain unchanged.

