# Spanish Edition 1.3 paragraph parity — Part I rollup

Status: **PARAGRAPH AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
Scope: Chapters 1-3  
Production impact: **NONE**

## Source authority

English:
- Candidate 2 / `v5.95-candidate.2`
- Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Historical Spanish translation memory:
- Edition 1.2
- Drive ID: `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`

## Unit-map coverage

| Chapter | Total units | REUSE_VERIFIED | REVISE | NEW_TRANSLATION | RETIRE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chapter 1 | 41 | 35 | 4 | 2 | 0 |
| Chapter 2 | 41 | 34 | 6 | 1 | 0 |
| Chapter 3 | 39 | 34 | 3 | 1 | 1 |
| **Part I total** | **121** | **103** | **13** | **4** | **1** |

The totals above were mechanically checked against the status rows in the three unit-map files.

## Controlling unit maps

- `SPANISH_EDITION_1_3_UNIT_MAP_CH01_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH02_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH03_2026-10-06.md`

## Main Part I release deltas

### Chapter 1

Required non-reuse work includes:

- missing Candidate 2 chapter-purpose block;
- historical page/cross-reference update;
- transmission paragraph containing a historical extra Chapter 4/page-reference sentence;
- missing Candidate 2 “reduce avoidable confusion” closing unit;
- source/reference presentation QA;
- replacement with the current compliance boundary.

### Chapter 2

Required non-reuse work includes:

- missing Candidate 2 chapter-purpose block;
- three bounded punctuation/grammar/casing corrections;
- historical page-reference update;
- source/reference presentation QA;
- replacement with the current compliance boundary.

### Chapter 3

Required non-reuse work includes:

- removal of the Spanish-only ICE technical-verification sentence;
- retirement of Spanish-only `Figura 3.1` unless an authoritative later layout source proves it belongs;
- insertion of governed MP-19 `usd-impact.com/go/c03`;
- source/reference presentation QA;
- replacement with the current compliance boundary.

## Chapter 3 extraction-order correction

The four-row DXY cross-check table exists in historical Spanish Edition 1.2.

Google Drive DOCX extraction places its table cells at the end of extracted text rather than inline. The Chapter 3 unit map therefore supersedes the earlier first-pass “table missing” inference.

Current disposition:

- table semantic content: `REUSE_VERIFIED`;
- table inline placement/layout: QA required;
- `/go/c03`: `NEW_TRANSLATION`;
- Spanish-only Figure 3.1: `RETIRE`.

## Interpretation of REUSE_VERIFIED

`REUSE_VERIFIED` means the historical Spanish unit has been freshly compared against Candidate 2 and can serve as current semantic translation authority for that unit.

It does **not** waive later:

- global terminology review;
- compliance review of the assembled manuscript;
- typography/punctuation normalization;
- current source/link verification;
- page-number regeneration;
- bookmarks/navigation QA;
- layout QA;
- explicit owner release approval.

## Next controlled phase

Continue paragraph/unit mapping with Chapter 4 onward using the same stable-ID/state model.

No release candidate should be assembled until all manuscript areas have a complete unit map and all `REVISE`, `NEW_TRANSLATION`, and `RETIRE` actions are resolved.

Publication remains **HOLD**.
