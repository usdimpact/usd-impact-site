# Book-Site Bridge gap analysis

Date: 2026-08-29

## Existing strengths

| Capability | Current state | Reuse decision |
| --- | --- | --- |
| Durable framework | Certified Edition 1.2 PDF | Preserve as read-only source until a separately approved manuscript patch |
| Book product route | Canonical product page released | Extend contextually; do not create a second product page |
| Three-dial method | Public framework page plus fail-closed completed-week repository snapshot | Reuse as qualitative regime evidence |
| Transmission method | Public framework page | Reuse as mechanism layer |
| Weekly Score | Public dashboard and current methodology | Keep separate from the qualitative Three-Dials layer |
| Daily and reports | Dated evidence chain | Link as current evidence, not as book text |
| Companion | Phase 0-1 released through PR #383 | Keep as orchestration layer under the canonical book route |
| Contextual site-to-book returns | Phase 2A released through PR #392 | Keep centrally governed and sparse |
| Live-evidence practice | Phase 2B released through PR #393 | Preserve anti-anchoring and browser-local response boundaries |
| Print aliases | 19 released `/go/` aliases | Treat as the only approved print-link destinations |

## Gaps closed in Phase 0-1

Phase 0-1 established the governed chapter/tool registry, companion hierarchy, explanatory tool layer, two practice prototypes, 19 stable print aliases, orphan checks, `noindex` controls and sitemap exclusions.

## Gap closed in Phase 2A

Phase 2A added exactly five relevance-specific contextual returns from existing Score, methodology, selected Daily and weekly-report surfaces to the book. The mappings remain deliberately sparse and centrally governed.

## Gap closed in Phase 2B

Phase 2B replaced the static/prior-reader-only practice references with dated source-bound evidence from the existing completed-week Three-Dials artifact, without adding a new provider or market-data pipeline.

The released controls are:

1. source facts and dates are visible before classification;
2. deterministic classifications remain hidden until submission;
3. Weekly Regime Lab compares exactly three deterministic dials;
4. dominant driver, confidence and written response remain unscored and browser-local;
5. Score v2 appears only after submission as a separate descriptive model output;
6. freshness states distinguish `current`, `publication-pending`, `stale` and `invalid`;
7. stale/invalid evidence disables comparison;
8. the Three-Dials workflow, source-rights boundary, 35-route search-index gate and five Phase 2A mappings remain unchanged.

PR #393 merged as `3b6f40c3f22bf2960f0d465d215ed415f8ed165c` and released through Production deployment `dpl_HQbqsAoqUi9p3rj8iDVu7gswREfH`.

## Remaining publication gap after Phase 2B

The remaining high-value gap is now the frozen book itself.

The certified Edition 1.2 PDF contains Score-methodology language that predates the current Production Score v2 implementation. The differences are material enough that the manuscript should not be frozen for publication until they are reconciled.

### Methodology mismatches that require manuscript correction

| Topic | Certified PDF | Current Production authority |
| --- | --- | --- |
| Input transformation | weekly log returns / yield basis-point changes | Friday-ended weekly levels |
| Normalization | rolling one-year / rolling standard deviation | full-sample mean and sample standard deviation from the production sample available at run time |
| Clipping | +/-3.0 | +/-3.5 |
| Regime language | three-zone convention around +/-0.50 | five fixed bands at +/-0.3 and +/-1.0 |
| Historical evidence | repeated 84.5% hit-rate framing | descriptive robustness evidence; no present prospective predictive result |
| Vintage interpretation | wording implies older case studies show contemporaneous real-time readings | as-published archives must be distinguished from current recalculated history |

### Why this is a publication blocker

A final print edition should not teach one Score formula while the official live methodology uses another. It also should not present recalculated historical evidence as point-in-time predictive proof.

The mismatch does not invalidate the durable conceptual chapters or the released website bridge. It is concentrated in Chapter 10, the Chapter 13 dashboard/archive wording and Appendix B.

## Phase 2C response

Phase 2C is a preparation-only freeze pass. It should:

1. pin the website and Score-pipeline authorities used for the correction;
2. identify every manuscript block that must change and provide replacement copy;
3. preserve the existing chapter sequence and minimize reflow;
4. define QR placements using only existing `/go/` aliases;
5. separate required corrections from optional copy improvements;
6. create a final pre-edit checklist that prevents ISBN/barcode work from starting before the corrected manuscript is approved.

Phase 2C does not edit the master book.

## Current risks and controls

1. **Methodology drift:** the manuscript could become stale again before print. Control: pin the live methodology authority at the start of the final edit and re-check immediately before manuscript freeze.
2. **Historical overclaim:** old hit-rate language could be interpreted as predictive performance. Control: replace it with descriptive/robustness wording and a clear as-published-versus-recalculated distinction.
3. **Route decay:** QR codes could hard-code implementation paths. Control: QR only the stable `/go/` aliases already released and tested.
4. **Layout expansion:** replacing methodology prose could cause pagination drift. Control: keep patches section-bounded, use compact formulas/tables, and preserve chapter start pages where practical.
5. **Search/index confusion:** print destinations could expose Preview-only semantics incorrectly. Control: preserve the current alias/noindex architecture; the printed short links remain stable even if internal destinations later change under governance.
6. **Premature publication metadata:** ISBN/barcode could be assigned before the book text is truly final. Control: ISBN, barcode and publication metadata remain last.

## Intentionally deferred

- master PDF/Drive editing;
- ISBN, barcode, imprint, cover, trim and spine changes;
- saved practice progress or account state;
- new practice analytics;
- new data providers or Score methodology changes;
- new HeyGen renders;
- grounded AI framework guide;
- broad chapter promotion across every Daily edition.

## Sequence after Phase 2C preparation

1. approve the exact manuscript patch register and QR plan;
2. apply the surgical manuscript patch in an isolated book-edit phase;
3. run full book QA: pagination, TOC, bookmarks, internal page references, hyperlinks/QRs, accessibility/text extraction, methodology consistency and compliance wording;
4. freeze routes and manuscript together;
5. only then perform ISBN, barcode and publication-metadata work.
