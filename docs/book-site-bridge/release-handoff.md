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
- sitemap gate: companion, practice and `/go/**` route families verified absent from the generated and live sitemap
- stable print aliases: all 19 verified on the released host

The released Phase 0-1 implementation includes the governed 13-chapter / 6-tool / 19-alias registry, companion hub, generated chapter companion pages, Chapter 3 comparator, Chapter 11 Weekly Regime Lab, explanatory tool layer, contextual chapter card, and print-safe aliases.

## Released Phase 2A contextual integration

Phase 2A was merged through PR #392 and released to Production after its bounded Preview gate passed.

- PR: `#392` — `Preview: Book-Site Bridge Phase 2A contextual integration`
- validated PR head: `d3e1bd5206a6f7bce8a582d4af875eaa9ca14cad`
- merge commit: `0e4d77e91b5f2795528be0db8e7bbecb8902f696`
- Production deployment: `dpl_CsiPZoySPYkZ6AS9kdpRzchZz3cr`
- Production state: `READY`
- Production build: 208 generated pages
- existing 35-route `noindex` / sitemap gate: preserved
- five contextual mappings: verified in generated output and live Production HTML

The five released mappings remain centrally governed and relevance-specific:

| Surface | Match | Book connection | Rationale |
| --- | --- | --- | --- |
| `/score/` | exact | Chapter 10 | Interpret regime evidence and the Weekly Score as descriptive context rather than a forecast or signal. |
| `/score/methodology/` | exact | Chapter 10 | Connect construction, recalculation limits and descriptive validation to the book's regime-history context. |
| `/reports/weekly/**` | prefix | Chapter 11 | Reinforce the driver-first weekly sequence before asset-specific interpretation. |
| `/news/2026-08-20/` | exact | Chapter 4 | Revisit the active transmission channel when liquidity support, oil-linked inflation and rates conflict. |
| `/news/2026-08-27/` | exact | Chapter 5 | Revisit physical oil balance when EIA inventories and refinery activity matter. |

No generic book advertising, checkout path, scarcity, performance implication or Score-as-predictive-sales claim was introduced by Phase 2A.

## Phase 2B Preview-only live-evidence scope

Phase 2B is separately authorized for Preview only. It reuses the existing fail-closed Three-Dials completed-week publication artifact and exact-week Score bridge rather than introducing a new provider, secret, runtime market-data API or browser fetch.

### Chapter 3 DXY Comparator

- show the repository-published completed-week DXY and broad-dollar facts with their actual previous/latest observation dates, changes, source disclosures and source links;
- show the existing rates/stress facts as a confirmation layer;
- hide the deterministic DXY/broad classification until the reader submits an independent classification;
- allow the latest previously published week during the normal Monday/Tuesday publication window with an explicit `publication-pending` label;
- disable comparison if the snapshot falls outside the approved publication cadence.

### Chapter 11 Weekly Regime Lab

- show the source-bound completed-week facts for all three dials before submission;
- keep the deterministic dial directions, confidence labels, existing qualitative interpretation and Score output hidden before the reader records a view;
- compare only dollar direction, real-rate pressure and liquidity stress;
- map rangebound / flat / contained states to the reader-facing mixed or neutral choice rather than forcing direction;
- leave the dominant-driver hypothesis, evidence-confidence selection and written conditional reading unscored and browser-local;
- reveal the exact-week USD Impact Score v2 only after submission as a separate descriptive model output, never as an answer key.

### Phase 2B freshness and privacy gate

The Phase 2B rendering layer consumes only the checked-in `src/data/three-dials-latest.json` artifact. It validates the required seven source-bound facts, the approved FRED/Yahoo disclosure origins, and the exact-week `score.usd-impact.com` model bridge before enabling comparison.

Publication states are fail closed:

1. `current` — snapshot week equals the workflow-defined latest completed Friday; comparison enabled;
2. `publication-pending` — the prior published snapshot remains usable only while the next completed Friday is still inside the established Monday/Tuesday publication window;
3. `stale` — comparison disabled after the publication window expires;
4. `invalid` — comparison disabled for missing facts, invalid dates/values, source-origin violations or Score-week mismatch.

Reader classifications, driver hypotheses, confidence selections and free-text readings remain in page memory only. Phase 2B adds no practice-response telemetry, local storage, database persistence, account state or financial profile.

## Phase 2B regression and Preview gate

Before Phase 2B can be considered complete in Preview, the final head must provide:

1. snapshot contract validation for all seven existing source-bound facts and exact-week Score separation;
2. deterministic freshness-state tests for current, publication-pending, stale and invalid conditions;
3. proof that Weekly Regime Lab compares exactly three deterministic dials and ignores driver differences for scoring;
4. source-level checks proving both practice pages add no market-data `fetch`, local storage or practice-response telemetry;
5. generated HTML checks for all seven evidence markers on both practice pages, hidden post-submit DXY reference, hidden post-submit Weekly Score output, and existing `noindex` treatment;
6. the existing Phase 0-1 35-route `noindex` / sitemap gate and Phase 2A five-mapping gate unchanged;
7. the repository's normal validation, security and build checks;
8. exactly one Vercel Preview from the final validated content.

## Explicitly unchanged in Phase 2B

- no change to `.github/workflows/three-dials-snapshot.yml`, the Three-Dials generator or its source-rights boundary;
- no new data provider, browser market-data request, runtime market-data API, environment variable or secret;
- no account, progress-storage, analytics, database or migration change;
- no checkout, payment, pricing, refund, commerce runtime or Merchant-of-Record change;
- no webhook change;
- no entitlement or protected-content change;
- no video render, upload, caption or transcript change;
- no master PDF or Drive book edit;
- no ISBN, barcode, imprint, cover, trim, spine or publication-metadata work;
- no Production deployment or merge without separate authorization.

## Deferred sequence

After Phase 2B, the next candidates remain separately gated:

1. surgical manuscript and QR/print-link patch after route and live-evidence UX freeze;
2. video-gap and grounded-AI work only if separately approved;
3. route/manuscript freeze;
4. ISBN, barcode and publication metadata last.
