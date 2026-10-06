# Spanish Edition 1.3 whole-manuscript paragraph parity rollup

Status: **PARAGRAPH/UNIT AUDIT COMPLETE — RELEASE HOLD**  
Checkpoint date: 2026-10-06  
Production impact: **NONE**

## Source authority

English semantic authority:
- Candidate 2 / `v5.95-candidate.2`
- Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Historical Spanish translation memory:
- Edition 1.2
- Drive ID: `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`
- not a release authority

## Full mapped-unit totals

| Scope | Total units | REUSE_VERIFIED | REVISE | NEW_TRANSLATION | RETIRE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chapters 1-3 | 121 | 103 | 13 | 4 | 1 |
| Chapters 4-9 | 247 | 216 | 30 | 0 | 1 |
| Chapters 10-13 | 188 | 107 | 40 | 29 | 12 |
| Back matter | 148 | 74 | 8 | 58 | 8 |
| **Whole manuscript** | **704** | **500** | **91** | **91** | **22** |

Arithmetic check:
- `500 + 91 + 91 + 22 = 704`

## Interpretation

### REUSE_VERIFIED — 500 units

These units were freshly compared against Candidate 2 and may serve as current Spanish semantic translation authority.

This classification does **not** waive later:

- global terminology normalization;
- current source/link verification;
- compliance review of the assembled manuscript;
- typography/punctuation cleanup;
- page-reference regeneration;
- bookmarks/navigation QA;
- layout QA;
- explicit owner release approval.

### REVISE — 91 units

These units exist in historical Spanish translation memory but require bounded correction before release.

Main revision classes include:

- current Candidate 2 chapter-purpose/control wording;
- generic historical headings replaced by current specific headings;
- malformed Spanish grammar/wording;
- source-reference currentness or URL repair;
- historical page references;
- compliance-tail modernization;
- hurdle-rate terminology;
- Score v2 evidence/methodology replacement;
- archive/vintage wording;
- table placement/layout restoration.

### NEW_TRANSLATION — 91 units

These units have no safe historical Spanish release equivalent.

The largest concentration is Appendix B, which is entirely new controlled translation.

Other new units include:

- current Score v2 methodology/evidence blocks;
- governed print bridges;
- current archive/vintage controls;
- missing Candidate 2 control paragraphs;
- final index/navigation build unit.

### RETIRE — 22 units

These historical Spanish-only units must not survive into the new release unless a later explicit controlling-source decision reinstates them.

Retirement classes include:

- obsolete Score performance/hit-rate claims;
- moving-standard-deviation and approximate-clipping methodology;
- historical real-time/not-hindsight claims;
- historical-only figures;
- obsolete public-distribution, prescriptive-use and legacy archive wording; fixed Friday 22:00 UTC cadence remains source-authoritative;
- old index page ranges;
- glossary expansions absent from Candidate 2 authority.

## High-risk whole-manuscript controls

### 1. Score v2 methodology

The Spanish release must preserve exactly:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

No localization pass may alter:

- variable identifiers;
- signs;
- operators;
- 0.125 weights;
- +/-3.5 clipping;
- 2015-01-01 production start;
- regime thresholds;
- authority hashes.

### 2. Evidence vintage

The release must distinguish:

- dated as-published archives; and
- current recalculated long-history research views.

They must not be conflated.

### 3. Historical performance claims

The new Spanish candidate must not preserve as current Score v2 evidence:

- 84.5 / 84,5%;
- 100% regime claims;
- 79.7 / 79,7%;
- 73.2 / 73,2%;
- wording that retrospective cases prove future predictive accuracy.

### 4. Hurdle-rate terminology

Historical Spanish `tasa de descuento` is not safe for English `hurdle rate`.

One controlled Spanish term must be selected and applied consistently across:

- Appendix A;
- Chapter 7;
- Chapter 11;
- Chapter 13;
- any related table/caption/audio/lesson copy.

### 5. External source currentness

Independent current-source verification already found upstream or historical-reference issues including:

- EIA Balance vs OPEC-supply URL mismatch;
- current IMF Crypto Cycle destination;
- BIS 2025 Triennial final-vs-preliminary source label.

Final source/reference QA must continue before release assembly.

### 6. DOCX table extraction

Google Drive DOCX extraction can place table cells at the end of extracted text rather than inline.

Confirmed affected areas include:

- Chapter 3 DXY cross-check;
- Chapter 11 one-page discipline table;
- Chapter 13 checklist/discipline tables.

Table presence must be judged from semantic content plus source structure, then restored/validated in layout.

## Governed print bridges

Required current bridges:

- `usd-impact.com/go/c03`
- `usd-impact.com/go/score`
- `usd-impact.com/go/c11`
- `usd-impact.com/go/methodology`

The optional `/go/companion` insertion remains excluded under Candidate 2.

## Next controlled execution phase

The discovery/parity stage is complete.

The next phase is controlled manuscript construction:

1. lock Spanish terminology decisions;
2. translate all 91 `NEW_TRANSLATION` units;
3. revise all 91 `REVISE` units;
4. exclude all 22 `RETIRE` units;
5. assemble one Spanish Edition 1.3 Candidate 1 source;
6. run whole-manuscript compliance QA;
7. run source/reference/link QA;
8. render stable layout;
9. regenerate page references, TOC, index, bookmarks and internal links;
10. run visual/page-by-page QA;
11. produce a release-readiness packet;
12. require explicit owner approval before any public Spanish publication or delivery.

## Release boundary

Publication remains **HOLD**.

No public `/es/` routes, sitemap/hreflang, Spanish book delivery, Spanish audiobook release, marketing email, default caption switch, entitlement change, commerce change, auth/passkey change, database migration or Production localization activation is authorized by this audit.
