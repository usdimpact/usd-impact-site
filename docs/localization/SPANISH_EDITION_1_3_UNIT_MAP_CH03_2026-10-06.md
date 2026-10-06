# Spanish Edition 1.3 paragraph/unit map — Chapter 3

Status: **PARAGRAPH AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
English authority: Candidate 2 / `v5.95-candidate.2` / SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`  
Spanish reference: Edition 1.2 / Drive ID `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`  
Production impact: **NONE**

## Extraction-order correction

The historical Spanish DOCX **does contain** the four-row DXY cross-check table corresponding to Candidate 2.

Google Drive's extracted DOCX text places the table cells after the main-flow/index text instead of at the inline Chapter 3 location. Therefore the earlier first-pass statement that the table itself was absent was an extraction-order false negative.

This unit map supersedes that specific first-pass finding.

The historical Spanish chapter still lacks the governed `/go/c03` practice bridge and contains two Spanish-only legacy additions that are not present in Candidate 2.

## Unit model

Stable source IDs use `ES13-C03-Uxxx`.

Allowed states remain `REUSE_VERIFIED`, `REVISE`, `NEW_TRANSLATION`, and `RETIRE`.

## Chapter 3 unit register

| ID | Candidate 2 unit / anchor | Spanish 1.2 unit / anchor | State | Audit note |
| --- | --- | --- | --- | --- |
| ES13-C03-U001 | title — `USD Is Not DXY` | `USD no es DXY` | REUSE_VERIFIED | faithful title |
| ES13-C03-U002 | opening — DXY useful but not whole dollar | matching paragraph | REUSE_VERIFIED | semantic meaning preserved |
| ES13-C03-U003 | heading `The shortcut that becomes a mistake` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C03-U004 | language mistake: “dollar is up” vs DXY | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U005 | DXY as lens, not regime | matching paragraph | REUSE_VERIFIED | funding/trade-weighted/EM boundary preserved |
| ES13-C03-U006 | chapter task: keep DXY, box it correctly, cross-check broad dollar | matching paragraph | REUSE_VERIFIED | Candidate 2 chapter-purpose meaning is present in Spanish |
| ES13-C03-U007 | heading `What DXY actually measures` | `Qué mide DXY` | REUSE_VERIFIED | faithful heading |
| ES13-C03-U008 | six-currency geometric basket / euro dominance | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U009 | specificity, liquidity and futures-complex usefulness | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U010 | mental model + blind spots outside six-currency set | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U011 | heading `DXY cross-check — when the narrow index can mislead you` | `Contraste de DXY — cuándo el índice estrecho puede engañarte` | REUSE_VERIFIED | faithful heading |
| ES13-C03-U012 | table-introduction paragraph | matching paragraph | REUSE_VERIFIED | purpose preserved |
| ES13-C03-U013 | four-row DXY/broad-dollar cross-check table | Spanish DOCX table cells extracted out of flow after index | REUSE_VERIFIED | all four scenarios and interpretations are present; final table placement/layout must be restored and QA'd |
| ES13-C03-U014 | heading `Why the basket can mislead you` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C03-U015 | working rule: DXY first, broad dollar second, asset conclusion third | matching sentence | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U016 | composition distortion / excluded trading partners and EM currencies | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U017 | current ICE weights paragraph | matching Spanish paragraph plus extra technical-verification sentence | REVISE | core weights/current composition are preserved; remove Spanish-only `Especificación técnica ICE para verificación...` sentence not present in Candidate 2 |
| ES13-C03-U018 | no Candidate 2 unit | `Figura 3.1 — Composición de la cesta DXY por divisa` | RETIRE | historical Spanish-only figure label/unit is absent from Candidate 2 release authority |
| ES13-C03-U019 | weighting distortion / euro-driven false universal claim | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U020 | category error: FX measure vs global funding/liability/invoicing system | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U021 | heading `The broader dollar is a trade and funding story` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C03-U022 | Fed broader trade-weighted indexes | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U023 | dollar funding/invoicing and dominant-currency role | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U024 | three-question investor implication | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U025 | heading `When DXY is still the right tool` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C03-U026 | appropriate quick-indicator use cases | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U027 | mistake is stopping with DXY / professionals cross-check | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U028 | WTI/gold/Bitcoin examples | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U029 | heading `How to use the distinction in practice` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C03-U030 | practical DXY→broad dollar→rates/credit/liquidity workflow | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U031 | three divergence examples | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U032 | respect indicator domain | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C03-U033 | heading `Key takeaway` | `Idea clave` | REUSE_VERIFIED | terminology acceptable pending global review |
| ES13-C03-U034 | key-takeaway body | matching paragraph | REUSE_VERIFIED | hierarchy preserved |
| ES13-C03-U035 | recap heading + three bullets | matching Spanish recap | REUSE_VERIFIED | all three current points preserved |
| ES13-C03-U036 | continue-reading block | matching Spanish block | REUSE_VERIFIED | destination chapters preserved |
| ES13-C03-U037 | `Practice DXY vs. Broad USD` + `usd-impact.com/go/c03` | none | NEW_TRANSLATION | governed MP-19 bridge absent from Spanish 1.2 |
| ES13-C03-U038 | selected-reference block | Spanish block with visible literal URLs | REVISE | source set broadly aligned; rebuild presentation and run final link/source-currentness QA |
| ES13-C03-U039 | Candidate 2 compliance note | historical Spanish compliance note | REVISE | historical note lacks explicit trading-advice/trading-signal/conditional-market/current-data-verification boundaries |

## Chapter 3 counts

Registered units: **39**

- `REUSE_VERIFIED`: 34
- `REVISE`: 3
- `NEW_TRANSLATION`: 1
- `RETIRE`: 1

## Release-critical work

The new Spanish candidate must:

1. restore U013 at the correct inline table position and validate table semantics/layout;
2. rebuild U017 without the Spanish-only technical-verification sentence;
3. retire U018 unless a later authoritative Candidate 2 layout source proves the figure belongs to the release;
4. translate/add U037 exactly as the governed MP-19 bridge;
5. rebuild/link-check U038;
6. replace U039 with the complete current compliance boundary.

## Audit conclusion

Chapter 3 has substantially reusable translation memory. The prior table-missing finding is corrected: the table content exists, but its extracted-text order is misleading.

The actual release blockers are bounded and explicit: one legacy extra sentence, one legacy figure unit, the missing governed practice bridge, and the outdated source/compliance tail.

Publication remains **HOLD**.
