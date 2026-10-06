# Spanish Edition 1.3 paragraph/unit map — Chapter 11

Status: **PARAGRAPH AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
English authority: Candidate 2 / `v5.95-candidate.2` / SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`  
Spanish reference: Edition 1.2 / Drive ID `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`  
Production impact: **NONE**

Stable source IDs use `ES13-C11-Uxxx`.

## Extraction-order note

The historical Spanish DOCX contains the five-row one-page discipline table corresponding to Candidate 2:

- Broad USD / DXY
- Real yields
- WPSR oil data
- Curve + volatility
- COT positioning

Google Drive's extracted DOCX text places the table cells near the end of the document rather than inline in Chapter 11. The semantic table content is therefore present; final inline placement/layout still requires QA.

## Chapter 11 unit register

| ID | Candidate 2 unit / anchor | Spanish 1.2 unit / anchor | State | Audit note |
| --- | --- | --- | --- | --- |
| ES13-C11-U001 | title — `The Weekly Operating Framework` | `El marco operativo semanal` | REUSE_VERIFIED | faithful title |
| ES13-C11-U002 | subtitle — read dollar regime without drowning in noise | matching subtitle | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U003 | heading `The chapter most readers need` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U004 | conceptual-work recap | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U005 | usable-routine problem | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U006 | working framework: repeatable/disciplined/broad, not prediction | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U007 | heading `Start with the driver, not the asset` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U008 | common mistake: start with asset | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U009 | four possible weekly engines | matching paragraph | REUSE_VERIFIED | rates/liquidity/growth/composition preserved |
| ES13-C11-U010 | operating framework forces sequence | historical paragraph | REVISE | Spanish wording shifts to `causa probable` rather than Candidate 2's explicit dollar-direction/real-rate/liquidity-stress sequence; align to current authority |
| ES13-C11-U011 | heading `The minimum weekly screen` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U012 | Fed H.10 weekly source paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved; current external-source check still required |
| ES13-C11-U013 | EIA WPSR paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U014 | CME WTI liquidity/depth paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U015 | OVX/CVOL + COT paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U016 | heading `The weekly sequence` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U017 | Monday sequence | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U018 | Tuesday contradiction-cleaning | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U019 | Wednesday physical confirmation | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U020 | Thursday/Friday integration | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U021 | heading `How the framework maps across assets` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U022 | gold paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U023 | Bitcoin paragraph | historical paragraph uses `tasa de descuento` | REVISE | apply controlled `hurdle rate` terminology decision from Chapter 7 |
| ES13-C11-U024 | oil/gas paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U025 | FX paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U026 | heading `The anti-noise rule` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U027 | never let headline outrank regime | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U028 | deliberate intellectual delay | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U029 | heading `A one-page discipline` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C11-U030 | five-row Check / Why it matters / Primary source table | Spanish table cells extracted out of flow | REUSE_VERIFIED | semantic content present; restore inline table and run layout QA |
| ES13-C11-U031 | weekly checklist question paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U032 | checklist purpose: eliminate confusion, not uncertainty | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U033 | key takeaway | historical block has one extra sentence about the next candle | REVISE | core meaning current; remove Spanish-only extra sentence not in Candidate 2 |
| ES13-C11-U034 | recap bullets | matching recap | REUSE_VERIFIED | meaning preserved |
| ES13-C11-U035 | `Practice the weekly framework` + `usd-impact.com/go/c11` | absent | NEW_TRANSLATION | governed MP-20 insertion |
| ES13-C11-U036 | continue-reading block | historical destinations match | REUSE_VERIFIED | destination text aligned |
| ES13-C11-U037 | selected-reference block | historical URL-rich block | REVISE | rebuild from current Candidate 2 source set and verify live destinations |
| ES13-C11-U038 | Candidate 2 compliance note | historical Spanish note | REVISE | historical note adds profitability wording but is not the exact current compact trading-signal/current-data-verification boundary |

## Chapter 11 counts

Registered units: **38**

- `REUSE_VERIFIED`: 32
- `REVISE`: 5
- `NEW_TRANSLATION`: 1
- `RETIRE`: 0

## Release-critical work

1. Align U010 to the current explicit sequence.
2. Apply globally controlled hurdle-rate terminology in U023.
3. Restore U030 inline table placement and validate layout.
4. Remove Spanish-only extra sentence from U033.
5. Insert U035 governed `/go/c11` practice bridge.
6. Rebuild/link-check U037.
7. Replace U038 with the current Candidate 2 compliance boundary.

Publication remains **HOLD**.
