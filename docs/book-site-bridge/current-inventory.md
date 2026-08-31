# Book-Site Bridge current inventory

Status: Phase 0-1, Phase 2A, and Phase 2B are released to Production. Phase 2C is publication-freeze preparation only; the master book remains unchanged.

Date: 2026-08-29

## Authoritative book source

The read-only manuscript source remains the certified digital reader:

- `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks(1).pdf`
- Edition 1.2
- Production build v5.94
- no ISBN assigned

The current implementation preserves the book's operating sequence:

1. read the regime;
2. identify the transmission channel;
3. reach an asset-specific conclusion.

The PDF itself has not been edited during the Book-Site Bridge work.

## Released Phase 0-1 capabilities

PR #383 merged into `main` as `cd1ed4b0ef3f49bdc994bdfeecdf617741c3dc60` and was verified in Production deployment `dpl_CA8iXkjujC8azs3cKrmiQ9L4M3U6`.

Released capabilities include:

- governed JSON registries for all 13 chapters, six tools and 19 stable print aliases;
- reciprocal chapter-to-tool and tool-to-chapter validation;
- canonical companion hub at `/book/read-the-dollar-first/companion/`;
- 13 generated chapter companion pages;
- reusable explanatory tool and contextual chapter-card layers;
- Chapter 3 DXY-versus-broad-USD practice;
- Chapter 11 Weekly Regime Lab;
- static `/go/` aliases suitable for print use;
- `noindex` treatment and sitemap exclusion for companion, practice and `/go/**` route families.

The Production release generated 208 pages and retained the 35-route `noindex` / sitemap exclusion gate.

## Released Phase 2A contextual integration

PR #392 merged into `main` as `0e4d77e91b5f2795528be0db8e7bbecb8902f696` and was verified in Production deployment `dpl_CsiPZoySPYkZ6AS9kdpRzchZz3cr`.

Exactly five centrally governed site-to-book mappings remain active:

- `/score/` -> Chapter 10;
- `/score/methodology/` -> Chapter 10;
- `/reports/weekly/**` -> Chapter 11;
- `/news/2026-08-20/` -> Chapter 4;
- `/news/2026-08-27/` -> Chapter 5.

Unselected Daily editions and unrelated site surfaces receive no contextual book card.

## Released Phase 2B live-evidence integration

PR #393 merged the validated implementation head `3e1f15b8708cdb8876ac81c0682faa2d219f0ed1` into `main` as `3b6f40c3f22bf2960f0d465d215ed415f8ed165c`.

The automatic Production deployment was `dpl_HQbqsAoqUi9p3rj8iDVu7gswREfH`, state `READY`.

Phase 2B released the following without adding another market-data pipeline:

- the Chapter 3 comparator now consumes the checked-in completed-week Three-Dials snapshot and shows dated DXY, broad-dollar, rates and stress evidence before classification;
- the Chapter 11 Weekly Regime Lab shows all seven source-bound Three-Dials facts before submission;
- deterministic classifications remain hidden until the reader submits an independent view;
- Weekly Regime Lab compares exactly three deterministic dials: dollar, real rates and liquidity stress;
- dominant-driver hypothesis, confidence selection and written response remain unscored and browser-local;
- the exact-week Score v2 output is revealed only after submission as a separate descriptive model output and is explicitly not an answer key;
- freshness states are `current`, `publication-pending`, `stale` and `invalid`, with stale/invalid comparison disabled;
- no practice-response telemetry, local storage, account persistence, database write or entitlement write was added.

Production verification retained:

- 208 generated pages;
- the 35-route `noindex` / sitemap exclusion gate;
- the five Phase 2A contextual mappings;
- both Phase 2B practice-page generated-output gates;
- the existing Three-Dials workflow, generator and source-rights boundary unchanged.

## Current production evidence infrastructure

The site consumes `apps/web/src/data/three-dials-latest.json` for the qualitative completed-week practice layer. That artifact contains DXY, broad USD, real and nominal yields, HY OAS, VIX, SOFR-minus-IORB and a separate exact-week Score v2 bridge.

The Score itself remains a separate production system. The site methodology page documents Score v2 as a descriptive weekly regime indicator with eight inputs, fixed signed equal weights, full-sample level normalization, clipping at +/-3.5, five published regime bands, source/freshness controls, robustness diagnostics and explicit limitations.

The authoritative pipeline workflow remains Friday-ended and is scheduled for Friday 22:00 UTC. Generated weekly releases are merged only after the guarded score-quality and reproduction-attestation gates pass.

## Publication alignment issue identified after Phase 2B

The certified Edition 1.2 PDF predates the current production Score v2 specification in several material places. In particular, Chapter 10 and Appendix B describe an earlier rolling/weekly-move baseline, +/-3 clipping, a three-zone +/-0.50 convention, and an 84.5% historical hit-rate narrative. Current Production uses full-sample weekly levels, +/-3.5 clipping and five regime bands, and explicitly distinguishes recalculated descriptive history from point-in-time or prospective predictive evidence.

The PDF also states that older case-study history can be read as contemporaneous real-time output. Current methodology requires a stricter distinction between dated as-published archives and recalculated historical research.

These differences are publication blockers for a final manuscript freeze, but they do not affect the already released website bridge.

## Phase 2C publication-freeze preparation

Phase 2C is documentation and patch planning only. It adds:

- a page-by-page manuscript replacement register for the material Score-methodology mismatches;
- a governed QR/print-link placement plan using only the existing 19 stable `/go/` aliases;
- a publication-freeze gate that pins the website and Score-methodology authorities before any master-book edit.

No master PDF edit, Drive mutation, ISBN, barcode, imprint, cover, trim, spine or publication-metadata action is part of Phase 2C preparation.

## Explicitly unchanged

- checkout, Merchant-of-Record integration, payments, refunds and pricing operations;
- environment variables and secrets;
- webhooks, databases and migrations;
- accounts, entitlements and protected content;
- videos, captions and transcripts;
- Three-Dials publication workflow, generator and source-rights boundary;
- live Score pipeline and methodology;
- master PDF and Drive book files;
- ISBN, barcode and publication metadata.
