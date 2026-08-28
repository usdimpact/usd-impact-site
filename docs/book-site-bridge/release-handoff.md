# Book-Site Bridge release handoff

Date: 2026-08-28

## Released Phase 0-1 baseline

Phase 0-1 was merged through PR #383 and released to Production.

- PR: `#383` — `Preview: Book-Site Bridge Phase 0-1`
- approved PR head: `967c53ea406ae59560ca697ff6b268df864048f4`
- merge commit: `cd1ed4b0ef3f49bdc994bdfeecdf617741c3dc60`
- Production deployment: `dpl_CA8iXkjujC8azs3cKrmiQ9L4M3U6`
- Production build: 208 generated pages
- governed bridge routes: 35 routes verified with `noindex`
- sitemap gate: companion, practice and `/go/**` route families verified absent from the generated and live sitemap
- stable print aliases: all 19 verified on the released host

The released Phase 0-1 implementation includes the governed 13-chapter / 6-tool / 19-alias registry, companion hub, generated chapter companion pages, Chapter 3 comparator, Chapter 11 Weekly Regime Lab, explanatory tool layer, contextual chapter card, and print-safe aliases.

## Phase 2A state

Phase 2A is authorized for Preview only on branch:

`agent/book-site-bridge-phase-2a-contextual`

It is not authorized for merge or Production deployment.

### Bounded contextual mappings

Phase 2A adds five centrally governed, relevance-specific site-to-book mappings:

| Surface | Match | Book connection | Rationale |
| --- | --- | --- | --- |
| `/score/` | exact | Chapter 10 | Interpret regime evidence and the Weekly Score as descriptive context rather than a forecast or signal. |
| `/score/methodology/` | exact | Chapter 10 | Connect construction, recalculation limits and descriptive validation to the book's regime-history context. |
| `/reports/weekly/**` | prefix | Chapter 11 | Reinforce the driver-first weekly sequence before asset-specific interpretation. |
| `/news/2026-08-20/` | exact | Chapter 4 | Revisit the active transmission channel when liquidity support, oil-linked inflation and rates conflict. |
| `/news/2026-08-27/` | exact | Chapter 5 | Revisit physical oil balance when EIA inventories and refinery activity matter. |

The mappings use the existing `BookChapterBridgeCard.astro`, the canonical chapter registry and the contextual-promotion policy. They do not add generic book advertising or a checkout path.

## Phase 2A regression gates

Before any merge request can be considered, the final Phase 2A head must provide:

1. registry validation for exactly five approved contextual mappings;
2. exact/prefix route-resolution tests, including representative negative routes;
3. generated-output checks proving exactly one governed chapter card on each target page and no contextual card on representative unselected pages;
4. the existing Phase 0-1 `noindex` and sitemap-exclusion checks unchanged;
5. the repository's normal validation and build gates;
6. exactly one Vercel Preview from the final synchronized head;
7. Preview verification for Score, methodology, both selected Daily editions, at least one weekly report, and representative negative routes.

## Explicitly unchanged in Phase 2A

- no live-data wiring or Score ingestion into the practice prototypes;
- no account, progress-storage, analytics, database or migration change;
- no checkout, payment, pricing, refund, commerce runtime or Merchant-of-Record change;
- no environment variable, secret or webhook change;
- no entitlement or protected-content change;
- no video render, upload, caption or transcript change;
- no master PDF or Drive book edit;
- no ISBN, barcode, imprint, cover, trim, spine or publication-metadata work;
- no Production deployment or merge without separate authorization.

## Deferred sequence

After Phase 2A, the next candidates remain separately gated:

1. Phase 2B live-data/freshness layer with explicit source timestamps and privacy review;
2. surgical manuscript and QR/print-link patch after route freeze;
3. video-gap and grounded-AI work only if separately approved;
4. route/manuscript freeze;
5. ISBN, barcode and publication metadata last.
