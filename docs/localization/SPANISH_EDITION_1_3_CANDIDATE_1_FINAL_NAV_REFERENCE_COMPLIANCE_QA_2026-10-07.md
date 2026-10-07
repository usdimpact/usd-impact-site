# Spanish Edition 1.3 Candidate 1 — final navigation, reference and compliance QA

Status: **FINAL CONTENT/NAVIGATION QA PASS — RELEASE APPROVAL HOLD**  
Checkpoint date: 2026-10-07  
Production impact: **NONE**

## Canonical working source

Private Google Doc:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- final verified revision: `AHj4eMRlqgvFi-UjSW8mj0t1Ye347dCeqBwOD_kVcmIOxVFHDj06s01aUPtPIeh4BcsZ6KjJfeIY74CdoSU_GdK-4bUMtyclRWkyuzfSEMY`
- tab: `t.0`
- sharing/release state: private / HOLD

Historical Spanish Edition 1.2 remains unchanged.

## Final PDF state

Fresh export from the exact revision above:

- pages: **73**
- page size: **612 x 792 pt** throughout
- encrypted: **no**
- openable: **yes**
- image-only/scanned: **no**
- PDF outline/bookmark items: **311**
- external link annotations: **73**
- unique external destinations: **44**
- explicit internal page-link annotations: **0**

Internal navigation is provided by the generated PDF outline/bookmarks from document headings. The visible Contents block remains plain text with current page numbers; no unsupported artificial internal links were added.

All **311 outline targets** resolve to valid pages in the 73-page export.

## Final pagination

The current visible starts are:

- Introduction: page 4
- Chapter 1: page 7
- Chapter 2: page 11
- Chapter 3: page 15
- Chapter 4: page 19
- Chapter 5: page 24
- Chapter 6: page 29
- Chapter 7: page 33
- Chapter 8: page 37
- Chapter 9: page 41
- Chapter 10: page 45
- Chapter 11: page 50
- Chapter 12: page 54
- Chapter 13: page 58
- Further Reading: page 62
- Appendix A: page 64
- Appendix B: page 69
- About the Author / analytical index: page 72
- analytical index continues through page 73

The visible Contents page already carries these current page numbers. The analytical-index ranges are aligned to the same final pagination.

## Reintroduced blank-page defect — corrected

A fresh current export before this gate showed **74 pages** with page 74 blank except for footer/page number.

Native Google Docs structure exposed **15 trailing empty paragraph objects** after the last analytical-index entry.

Bounded cleanup:

- first trailing empty paragraph start: `228934`
- final trailing paragraph: `228948:228949`
- deleted exact range: `228934:228948`
- deleted empty paragraphs: **14**
- required final terminal paragraph preserved: **1**
- semantic prose/tables/links/headings deleted: **0**

The cleanup used `requiredRevisionId` against the exact pre-write revision.

Fresh export after cleanup:

- pages: **73**
- prior blank page 74: removed

Rendered comparison at **140 DPI** proved that pages 1-73 were byte-identical before versus after the blank-page cleanup.

## Final text defects corrected

### Duplicate Part label

Native readback found two visible `PARTE VV` construction typos immediately before Chapters 12 and 13.

Both were corrected to:

`PARTE V`

The revision-controlled replacement changed exactly **2 occurrences**.

Final native readback:

- `PARTE VV`: **0**
- corrected `PARTE V`: present

Rendered regression comparison between the 73-page pre-fix and final export found visual differences on exactly:

- page 54
- page 58

Those are the expected Chapter 12 and Chapter 13 starts.

Targeted full-page inspection confirms both render cleanly as `PARTE V`, with no clipping, overlap, reflow defect or neighboring layout damage.

All other **71 / 73 pages** are pixel-file identical to the immediately preceding 73-page export.

### IMF canonical link target

One Google Docs hyperlink target used a mixed-case IMF path for:

`Dominant Currencies and External Adjustment`

The current canonical lowercase IMF destination resolves reliably. Only hyperlink metadata was changed; visible reference text was not changed.

Final PDF link inventory confirms:

- old mixed-case target: **absent**
- canonical lowercase target: **present**
- visual rendering impact: **none**

## Reference click-through

The final PDF exposes **73** external link annotations across **44** unique destinations.

Live current-source checks covered the institutional/reference set, including:

- BIS
- Federal Reserve / FRED
- EIA
- CFTC
- CME / NYMEX
- ICE
- Cboe
- World Gold Council
- IMF
- OPEC
- SEC
- FASB
- Bitcoin white paper and other cited source destinations

The previously identified historical/source issues remain corrected or governed:

- EIA Balance is separate from EIA OPEC Supply;
- IMF Crypto Cycle uses the current institutional destination;
- BIS 2025 Triennial source state is treated as final/current rather than silently preserving the stale preliminary label;
- the IMF Dominant Currencies target is normalized to its current canonical path.

No final-reference blocker was identified in this gate.

## Whole-manuscript compliance readback

Final native readback finds **14** explicit `Nota de cumplimiento` units across Introduction/Chapters.

The manuscript preserves the material boundaries required by Candidate 2, including:

- educational/informational purpose;
- no personalized investment advice;
- legal/tax/trading boundaries where applicable;
- no trading-signal framing;
- no recommendation framing;
- conditional market relationships;
- current-data verification;
- Chapter 10 evidence limitations;
- Appendix B orientation-tool / non-position-sizing boundary.

No compliance regression requiring a manuscript hold was found.

## High-risk regression scan

Final native readback is clean for:

- `84.5%` / `84,5 %`;
- `79.7%` / `79,7 %`;
- `73.2%` / `73,2 %`;
- retired fixed regime-performance claims;
- moving-standard-deviation methodology wording;
- historical `tasa de descuento` hurdle-rate translation;
- `en tiempo real — no reconstruidos con visión retrospectiva`;
- malformed legacy strings:
  - `sobrelectoreando`
  - `infralectoreando`
  - `precio de referenciaing`
  - `reprecios`
  - `reprecioando`
- `PARTE VV`

## Governed controls retained

Final native readback confirms all required bridges:

- `usd-impact.com/go/c03`
- `usd-impact.com/go/score`
- `usd-impact.com/go/c11`
- `usd-impact.com/go/methodology`

Authority hashes remain present:

- `a86e57dafe91da67553e73e01bb0c703a868c949`
- `f51f7abf2d4ec99890eb5537424f6faab885ef32`

Score v2 formulas remain present exactly:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Controlled Spanish `hurdle rate` terminology remains:

`rentabilidad mínima exigida`

## Final QA conclusion

Candidate 1 now passes the currently scoped:

- paragraph/source parity gate;
- construction-control gate;
- reference/current-source gate;
- hyperlink metadata gate;
- full rendered visual gate;
- final pagination/index-range gate;
- PDF outline/bookmark target gate;
- final external-link gate;
- whole-manuscript compliance readback;
- high-risk regression scan.

The manuscript remains private and **HOLD** only for the explicit owner release decision and any separately authorized publication/delivery implementation.

## Release boundary

This checkpoint does **not** itself authorize:

- public `/es/` routes;
- sitemap/hreflang publication;
- Spanish book/member delivery;
- Spanish audiobook release;
- default Spanish captions;
- Spanish marketing email;
- entitlement changes;
- commerce changes;
- auth/passkey changes;
- database changes;
- Production localization activation.

Those require explicit owner release authorization.
