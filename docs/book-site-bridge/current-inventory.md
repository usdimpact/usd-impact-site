# Book-Site Bridge current inventory

Status: Phase 0-1 and Phase 2A released to Production; Phase 2B live-evidence integration is Preview-only.

Date: 2026-08-29

## Authoritative book source

The read-only source for the Book-Site Bridge remains the certified digital reader:

- `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks(1).pdf`
- Edition 1.2
- Production build v5.94
- No ISBN

The implementation preserves the book's operating sequence:

1. read the regime;
2. identify the transmission channel;
3. reach an asset-specific conclusion.

The book defines the weekly operating framework as the bridge from theory to practice and describes the live companion as a continuation rather than a promotion. The PDF remains unchanged.

## Prior Drive companion package

The Drive register `USD Impact - Book Companion Fix Pass 7 REPO INSERTION READY Register` records a prior package with 72 files, 20 routes, 16 markdown chapter-body files, registries, static QA, a workflow, risk register, browser plan and release gates.

That prior design is retained as governance evidence only. The old parallel `/book-companion` topology was not adopted because the current Astro repository already contains the canonical book, framework, Daily, Score, report, audiobook, video and access layers.

## Released Phase 0-1 capabilities

PR #383 merged into `main` as `cd1ed4b0ef3f49bdc994bdfeecdf617741c3dc60` and was verified in Production deployment `dpl_CA8iXkjujC8azs3cKrmiQ9L4M3U6`.

The released bridge contains:

- governed JSON registries for all 13 chapters, six tools and 19 stable print aliases;
- reciprocal chapter-to-tool and tool-to-chapter validation;
- canonical companion hub at `/book/read-the-dollar-first/companion/`;
- 13 generated chapter companion pages;
- reusable explanatory tool layer;
- reusable contextual `BookChapterBridgeCard.astro`;
- Chapter 3 DXY versus broad USD practice;
- Chapter 11 Weekly Regime Lab with delayed comparison;
- static `/go/` alias pages suitable for the current static Astro output;
- `noindex` treatment and sitemap exclusion for the companion, practice and `/go/**` route families.

The Phase 0-1 Production release generated 208 pages, retained the 35-route `noindex` gate, and preserved all 19 stable aliases.

## Released Phase 2A contextual integration

PR #392 merged into `main` as `0e4d77e91b5f2795528be0db8e7bbecb8902f696` and was verified in Production deployment `dpl_CsiPZoySPYkZ6AS9kdpRzchZz3cr`.

Phase 2A reuses the released contextual card rather than creating a promotion component. The governed mapping file controls exactly five relevance-specific surface-to-chapter connections:

- Weekly Score `/score/` -> Chapter 10;
- Score methodology `/score/methodology/` -> Chapter 10;
- all weekly report detail routes `/reports/weekly/**` -> Chapter 11;
- selected Daily `/news/2026-08-20/` -> Chapter 4;
- selected Daily `/news/2026-08-27/` -> Chapter 5.

The Production build retained 208 generated pages, the existing 35-route `noindex` / sitemap gate, and all five contextual mappings. No generic book promotion or commerce path was added by Phase 2A.

## Existing completed-week evidence infrastructure reused by Phase 2B

The site already publishes a fail-closed repository snapshot at `apps/web/src/data/three-dials-latest.json` and a matching public JSON artifact. The snapshot contains the completed-week evidence needed by both practice tools:

- DXY proxy;
- Federal Reserve broad USD index;
- 10-year TIPS real yield;
- 10-year nominal Treasury yield;
- ICE BofA U.S. High Yield OAS via FRED;
- VIX via FRED;
- derived SOFR-minus-IORB funding spread;
- separate exact-week USD Impact Score v2 output.

Each fact retains previous/latest observation dates, values, changes, source disclosure and source URL. The Score remains explicitly separate from the qualitative Three-Dials interpretation.

The existing Three-Dials publication workflow remains unchanged. It already enforces bounded source origins, per-series freshness checks, exact-week Score matching, immutable dated archives, full validation/build, protected quality/security checks and guarded generated-data publication.

## Phase 2B Preview-only additions

Phase 2B does not create another data pipeline. It adds a presentation and learning layer over the checked-in completed-week snapshot.

### Chapter 3 DXY Comparator

- visible pre-submit evidence: DXY, broad USD and the existing rates/stress facts with dates, changes and source links;
- hidden until submit: deterministic DXY direction, broad-dollar direction and breadth confirmation;
- reader selects DXY, broad USD and a rates/stress confirmation from the visible facts;
- comparison remains disabled if the snapshot is invalid or stale.

### Chapter 11 Weekly Regime Lab

- visible pre-submit evidence: all seven source-bound facts grouped under the three dials;
- hidden until submit: deterministic dial classifications and separate Score v2 output;
- machine comparison is limited to exactly three deterministic fields: dollar, real rates and liquidity stress;
- rangebound, flat and contained states map to the reader-facing neutral/mixed choice;
- dominant-driver hypothesis, confidence selection and written conditional reading are explicitly unscored;
- the exact-week Score v2 is shown only after submit and explicitly not as an answer key.

## Phase 2B publication/freshness boundary

The new rendering helper validates the checked-in snapshot before enabling comparison. Required facts, source origins, dates, finite values and exact Score week must all pass.

The presentation layer distinguishes:

- `current`: workflow-defined latest completed Friday is published;
- `publication-pending`: the prior published week remains usable while the new completed Friday is still inside the established Monday/Tuesday publication window;
- `stale`: the publication window expired without a matching current snapshot, so comparison is disabled;
- `invalid`: source-bound or exact-week validation failed, so comparison is disabled.

This logic does not alter the publication workflow or generator.

## Phase 2B response/privacy boundary

The two practice pages still make no market-data request in the browser. Reader classifications, driver hypotheses, confidence selections and free-text readings are handled only by page JavaScript and are not sent to telemetry, local storage, a database, an account record or an entitlement service.

Global site telemetry remains unchanged and continues to cover its pre-existing checklist/quiz events only.

## Explicitly unchanged

- certified master PDF and Drive book files;
- checkout, Merchant-of-Record integration, payments, refunds and pricing operations;
- environment variables and secrets;
- webhooks, databases and migrations;
- accounts, entitlements and protected content;
- videos, captions and transcripts;
- Three-Dials publication workflow, generator and source-rights boundary;
- live Score methodology or Score pipeline;
- ISBN, barcode, imprint, cover, trim, spine and publication metadata.

No Phase 2B merge or Production deployment is authorized. Exactly one Vercel Preview is authorized only after the final Phase 2B branch is validated.
