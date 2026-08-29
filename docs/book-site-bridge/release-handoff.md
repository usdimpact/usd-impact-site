# Book-Site Bridge release handoff

Date: 2026-08-29

## Released Phase 0-1 baseline

Phase 0-1 was merged through PR #383 and released to Production.

- PR: `#383` — `Preview: Book-Site Bridge Phase 0-1`
- approved PR head: `967c53ea406ae59560ca697ff6b268df864048f4`
- merge commit: `cd1ed4b0ef3f49bdc994bdfeecdf617741c3dc60`
- Production deployment: `dpl_CA8iXkjujC8azs3cKrmiQ9L4M3U6`
- Production build: 208 generated pages
- governed bridge routes: 35 routes verified with `noindex`
- sitemap gate: companion, practice and `/go/**` route families excluded
- stable print aliases: all 19 released

## Released Phase 2A contextual integration

Phase 2A was merged through PR #392 and released to Production.

- validated PR head: `d3e1bd5206a6f7bce8a582d4af875eaa9ca14cad`
- merge commit: `0e4d77e91b5f2795528be0db8e7bbecb8902f696`
- Production deployment: `dpl_CsiPZoySPYkZ6AS9kdpRzchZz3cr`
- Production state: `READY`
- Production build: 208 generated pages
- existing 35-route `noindex` / sitemap gate: preserved
- five contextual mappings: verified in generated output and live Production HTML

The five released mappings remain centrally governed and relevance-specific:

| Surface | Match | Book connection |
| --- | --- | --- |
| `/score/` | exact | Chapter 10 |
| `/score/methodology/` | exact | Chapter 10 |
| `/reports/weekly/**` | prefix | Chapter 11 |
| `/news/2026-08-20/` | exact | Chapter 4 |
| `/news/2026-08-27/` | exact | Chapter 5 |

## Released Phase 2B live-evidence integration

Phase 2B was merged through PR #393 after its bounded Preview gate passed.

- PR: `#393` — `Preview: Book-Site Bridge Phase 2B live evidence`
- validated implementation head: `3e1f15b8708cdb8876ac81c0682faa2d219f0ed1`
- merge commit / current release baseline: `3b6f40c3f22bf2960f0d465d215ed415f8ed165c`
- exactly one automatic Production deployment: `dpl_HQbqsAoqUi9p3rj8iDVu7gswREfH`
- Production state: `READY`
- Production build: 208 generated pages
- existing 35-route `noindex` / sitemap gate: preserved
- existing five Phase 2A contextual mappings: preserved
- Phase 2B generated live-evidence verification: passed for both practice pages

### Chapter 3 DXY Comparator

The released page now:

- shows repository-published completed-week DXY and broad-dollar observations before classification;
- shows the existing rates and stress facts as a confirmation layer;
- preserves the source fact dates, changes, source disclosures and source links;
- keeps the deterministic DXY/broad classification hidden until submission;
- disables comparison for stale or invalid snapshot states.

### Chapter 11 Weekly Regime Lab

The released page now:

- shows all seven source-bound Three-Dials facts before submission;
- compares only dollar direction, real-rate pressure and liquidity stress;
- keeps dominant-driver hypothesis, confidence selection and written reading unscored and browser-local;
- reveals Score v2 only after submission as a separate descriptive model output;
- states explicitly that Score v2 is not an answer key.

### Phase 2B freshness and privacy boundary

The rendering layer consumes only the checked-in `apps/web/src/data/three-dials-latest.json` artifact.

Publication states remain fail closed:

1. `current` — comparison enabled;
2. `publication-pending` — prior snapshot usable only inside the established publication window;
3. `stale` — comparison disabled;
4. `invalid` — comparison disabled.

Reader classifications, driver hypotheses, confidence selections and free-text readings remain page-local. No practice-response telemetry, local storage, database persistence, account state or financial profile was added.

## Phase 2B explicit non-changes

The release did not change:

- `.github/workflows/three-dials-snapshot.yml`, the Three-Dials generator or source-rights boundary;
- data providers, runtime market-data APIs, browser market-data fetches, environment variables or secrets;
- accounts, progress storage, analytics, databases or migrations;
- checkout, payments, pricing, refunds or commerce configuration;
- webhooks or entitlements;
- video assets;
- the master PDF or Drive book;
- ISBN, barcode, imprint, cover, trim, spine or publication metadata.

## Post-Phase-2B publication audit

A publication-freeze audit found that the certified Edition 1.2 PDF and the current Production Score v2 methodology are materially out of alignment in Chapter 10 and Appendix B.

The book still describes an earlier methodology using weekly moves, rolling one-year normalization, clipping at +/-3.0 and a three-zone +/-0.50 convention. Current Production uses Friday-ended weekly levels, full-sample normalization from the production sample, clipping at +/-3.5 and five published regime bands.

The book also repeats an 84.5% historical hit-rate narrative and contains wording that can be read as contemporaneous real-time proof. Current Production explicitly treats the current long history as recalculated descriptive evidence, distinguishes it from dated as-published vintages, and does not claim prospective predictive performance.

This is a manuscript-publication issue, not a website-release regression.

## Phase 2C publication-freeze preparation

The next governed step is documentation-only preparation before any master-book edit:

1. freeze the existing print-safe route destinations;
2. create an exact manuscript replacement register for Chapter 10, Chapter 13 and Appendix B;
3. define minimal QR placements using only existing `/go/` aliases;
4. pin the website and Score-pipeline methodology authorities used for the manuscript patch;
5. require a new explicit authorization before editing the master PDF or publication metadata.

Phase 2C preparation does not authorize a Preview, Production deployment, master-PDF edit, Drive mutation, ISBN, barcode or publication-metadata action.
