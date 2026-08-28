# Book-Site Bridge current inventory

Status: Phase 0-1 released to Production through PR #383; Phase 2A contextual integration is Preview-only.

Date: 2026-08-28

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
- Chapter 3 DXY versus broad USD scenario practice;
- Chapter 11 Weekly Regime Lab with delayed comparison;
- static `/go/` alias pages suitable for the current static Astro output;
- `noindex` treatment and sitemap exclusion for the companion, practice and `/go/**` route families.

The Phase 0-1 Production release generated 208 pages, retained the 35-route `noindex` gate, and preserved all 19 stable aliases.

## Phase 2A Preview-only additions

Phase 2A reuses the released contextual card rather than creating a new promotion component. A separate governed mapping file controls exactly five surface-to-chapter connections:

- Weekly Score `/score/` -> Chapter 10;
- Score methodology `/score/methodology/` -> Chapter 10;
- all weekly report detail routes `/reports/weekly/**` -> Chapter 11;
- selected Daily `/news/2026-08-20/` -> Chapter 4;
- selected Daily `/news/2026-08-27/` -> Chapter 5.

The two Daily selections are evidence-specific rather than generic:

- August 20 discusses competing liquidity-support, oil-inflation and rates transmission, matching Chapter 4;
- August 27 includes EIA petroleum inventories and refinery evidence, matching Chapter 5.

Representative unselected Daily, monthly-report, practice and companion routes remain outside the Phase 2A mapping.

## Phase 2A data and state boundary

Phase 2A adds no new data source and no user state. It does not fetch live market data, persist answers, create analytics events, authenticate users, read entitlements, alter the Score pipeline or call a commerce endpoint.

The contextual cards resolve from static governed metadata during Astro rendering.

## Explicitly unchanged

- certified master PDF and Drive book files;
- checkout, Merchant-of-Record integration, payments, refunds and pricing operations;
- environment variables and secrets;
- webhooks, databases and migrations;
- accounts, entitlements and protected content;
- videos, captions and transcripts;
- live Score methodology or data pipeline;
- ISBN, barcode, imprint, cover, trim, spine and publication metadata.

No Phase 2A merge or Production deployment is authorized. Exactly one Vercel Preview is authorized only after the final Phase 2A branch is validated and synchronized.
