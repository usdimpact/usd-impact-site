# Spanish Edition 1.3 parity audit — Batch 01: front matter, Introduction, Chapters 1-3

Status: **AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
Production impact: **NONE**  
Historical Spanish artifact mutation: **NONE**

## Scope

Fresh comparison of the current English Candidate 2 semantic authority against historical Spanish Edition 1.2 for:

- front matter;
- acknowledgments / reader note / use guidance;
- Introduction;
- Chapter 1;
- Chapter 2;
- Chapter 3.

This batch classifies release treatment only. It does not create or publish revised Spanish prose.

## Source authority

English:
- Candidate 2 Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- build: `v5.95-candidate.2`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Historical Spanish reference:
- Edition 1.2 Drive ID: `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`
- use: translation memory only

## Batch result

| Unit | State | Reason |
| --- | --- | --- |
| Front matter / copyright / distribution wording | REVISE | historical Spanish release/distribution wording does not match Candidate 2 control wording |
| Front matter compliance disclaimer | REVISE | Candidate 2 adds current-data verification language and broader trading-advice boundary |
| Acknowledgments | PARAGRAPH_AUDIT_REQUIRED | broadly aligned, but not certified paragraph-by-paragraph in this batch |
| Reader note / how-to-use / book-help bullets | PARAGRAPH_AUDIT_REQUIRED | broadly aligned; keep unpromoted until exact unit mapping |
| Introduction | REVISE | structural/content drift and missing Candidate 2 reader-checkpoint block |
| Chapter 1 | REVISE | missing Candidate 2 chapter-purpose control text and closing delta; page-reference drift |
| Chapter 2 | REVISE | missing Candidate 2 chapter-purpose control text; page-reference drift |
| Chapter 3 | REVISE | governed `/go/c03` bridge absent; Spanish-only legacy Figure 3.1 and extra ICE-verification sentence require retirement/revision; compliance tail is not current |
| Chapter 3 `/go/c03` bridge | NEW INSERTION | required by MP-19 and absent from Spanish 1.2 |

## Front matter findings

Historical Spanish Edition 1.2 contains release-oriented wording stating that the book is prepared for digital distribution and print-composition review through the official site. Candidate 2 does not use that historical formulation as its current opening release statement.

Candidate 2 also explicitly says that:

- historical relationships, market examples and dashboard references should be checked against current data before use;
- the book is not personalized investment, legal or tax advice;
- it is not a recommendation to buy or sell securities, commodities, currencies or digital assets.

The historical Spanish front matter preserves the educational boundary but does not carry the full current Candidate 2 wording. Treat the front matter as `REVISE`, not `REUSE_VERIFIED`.

## Introduction findings

The broad narrative remains recognizably related, but the current English Candidate 2 and historical Spanish Edition 1.2 are not release-identical.

Confirmed differences include:

1. Candidate 2 has a dedicated portability section for readers outside the United States with explicit local-currency, import-cost, funding, commodity and central-bank transmission language.
2. Historical Spanish contains a separate scope note about equities/rates and Mag 7 that is not the same unit as the current Candidate 2 sequence.
3. Candidate 2 closes the Introduction with a three-item **Reader checkpoint**:
   - read the dollar regime before the asset headline;
   - identify the active transmission channel;
   - apply asset-specific evidence before forming a view.
4. That Candidate 2 reader-checkpoint block is absent from the historical Spanish Introduction.
5. Printed page references differ because the current English edition has the Appendix B/layout expansion.

Disposition: **REVISE**.

## Chapter 1 findings

The central translated narrative is substantially related to Candidate 2, but the chapter cannot yet be reused unchanged.

Confirmed deltas:

- Candidate 2 includes a dedicated `What this chapter does` control paragraph immediately after the opening; the historical Spanish Chapter 1 does not carry that unit.
- Candidate 2 includes an additional closing sentence explaining that the dollar-first habit reduces avoidable confusion; the historical Spanish closing sequence does not carry the same final unit.
- Candidate 2 internal page references point to current edition pagination; Spanish 1.2 references the older layout.
- Final release reuse still requires paragraph-by-paragraph source mapping and terminology/compliance review.

Disposition: **REVISE**. No whole-chapter `REUSE_VERIFIED` classification is permitted yet.

## Chapter 2 findings

The historical Spanish Chapter 2 follows the same broad Bretton Woods → 1971 → Smithsonian → 1973 float → fiat-discipline sequence.

Confirmed deltas:

- Candidate 2 includes a dedicated `What this chapter does` control paragraph defining the chapter goal and explicitly rejecting the simplistic “gold discipline versus chaos” framing.
- That control unit is absent from historical Spanish 1.2.
- Current-edition page references differ from the historical Spanish layout.
- Exact source/currentness of all historical-statistic/reference units still requires unit mapping.

Disposition: **REVISE**.

## Chapter 3 findings — corrected by paragraph/unit audit

Historical Spanish Chapter 3 preserves most of the DXY-versus-broad-dollar explanation and includes the Candidate 2 four-row DXY cross-check table.

A later paragraph/unit audit identified a DOCX extraction-order artifact: Google Drive's extracted text places the table cells after the main-flow/index text rather than at the inline Chapter 3 location. The earlier first-pass inference that the table itself was missing was therefore a false negative.

Fresh unit-level findings:

1. Candidate 2's chapter-purpose meaning ("keep DXY, box it correctly, cross-check broader dollar measures") is already present in the historical Spanish prose.
2. The four-row **DXY cross-check — when the narrow index can mislead you** table is present in Spanish translation memory and can be `REUSE_VERIFIED` subject to correct inline placement/layout QA.
3. The historical Spanish ICE-weights paragraph contains one extra technical-verification sentence not present in Candidate 2 and must be revised.
4. Historical Spanish contains a `Figura 3.1 — Composición de la cesta DXY por divisa` unit that is not present in Candidate 2 and should be retired unless a later authoritative layout source proves otherwise.
5. The governed practice bridge remains absent:
   - `Practice DXY vs. Broad USD`
   - `usd-impact.com/go/c03`
6. The historical Spanish compliance tail does not carry the complete Candidate 2 trading-signal/current-data-verification boundary.

Disposition:
- Chapter 3: **REVISE**
- DXY cross-check table: **REUSE_VERIFIED** for semantic content; restore correct inline placement and run table/layout QA
- Spanish-only Figure 3.1: **RETIRE**
- extra ICE-verification sentence: **REVISE**
- MP-19 practice bridge: **NEW INSERTION**
- compliance tail: **REVISE**

Detailed controlling unit map: `SPANISH_EDITION_1_3_UNIT_MAP_CH03_2026-10-06.md`.

## Page-number and navigation rule

Historical Spanish page-number references must not be patched opportunistically during translation. Final printed page references, TOC, index ranges, bookmarks and internal links are to be regenerated/validated only after the new Spanish candidate reaches stable layout.

## Compliance rule for this batch

Do not carry forward wording that:

- overstates release status;
- implies public distribution authorization;
- promotes the Score as predictive;
- weakens current-data verification language;
- changes educational/non-recommendation boundaries.

## Next batch

Batch 02 should audit Chapters 4-9, preserving the same conservative rule:

- no unit becomes `REUSE_VERIFIED` without fresh Candidate 2 comparison;
- any missing current control block/table/link becomes `REVISE` or `NEW_TRANSLATION`;
- historical Spanish remains unchanged.

This batch is evidence only and does not authorize Spanish publication, delivery or Production activation.
