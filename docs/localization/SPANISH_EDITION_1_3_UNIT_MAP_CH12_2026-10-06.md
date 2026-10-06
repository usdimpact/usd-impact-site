# Spanish Edition 1.3 paragraph/unit map — Chapter 12

Status: **PARAGRAPH AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
English authority: Candidate 2 / `v5.95-candidate.2` / SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`  
Spanish reference: Edition 1.2 / Drive ID `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`  
Production impact: **NONE**

Stable source IDs use `ES13-C12-Uxxx`.

## External source-currentness escalation

Candidate 2's selected-reference block still describes the BIS 2025 Triennial Central Bank Survey as `preliminary results`.

Current BIS authority states that final 2025 turnover results were released in June 2026.

This is an upstream English-source-currentness issue. Spanish localization must not silently alter the English semantic/source authority; final release assembly should resolve the source label in the controlling English/reference layer or record an explicit governed update.

## Chapter 12 unit register

| ID | Candidate 2 unit / anchor | Spanish 1.2 unit / anchor | State | Audit note |
| --- | --- | --- | --- | --- |
| ES13-C12-U001 | title — `Common Mistakes in Dollar and Cross-Asset Analysis` | matching title | REUSE_VERIFIED | faithful title |
| ES13-C12-U002 | opening — true idea applied too aggressively | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U003 | dollar framework can become misleading slogan | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U004 | examples of turning useful relationships into laws | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U005 | chapter purpose — denomination vs driver, benchmark vs regime, horizon discipline | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U006 | heading `Mistake 1: Treating DXY as the whole dollar` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U007 | DXY six-currency partial-system paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U008 | DXY misses broader transmission channels | historical paragraph | REVISE | core meaning current; malformed `sobrelectoreando` / `infralectoreando` wording must be corrected |
| ES13-C12-U009 | two weekly questions: DXY vs broader regime | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U010 | heading `Mistake 2: Assuming every dollar relationship is immediate, inverse, and mechanical` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U011 | one-clock/one-sign shortcut | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U012 | multi-channel examples across gold/oil/gas/Bitcoin | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U013 | identify transmission channel before dollar reinforcement/offset | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U014 | heading `Mistake 3: Confusing the currency of pricing with the driver of price` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U015 | denomination is unit of account, not cause | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U016 | EIA oil/gas driver paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U017 | three-question pricing discipline | historical paragraph | REVISE | malformed `precio de referenciaing` wording must be corrected |
| ES13-C12-U018 | heading `Mistake 4: Using one commodity template for all commodities` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U019 | oil/gold/gas structural differences | historical paragraph | REVISE | malformed `precio de referenciaing` wording must be corrected |
| ES13-C12-U020 | gas vs gold structural example | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U021 | asset structure before dollar overlay | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U022 | heading `Mistake 5: Ignoring funding, carry, and translation risk in FX analysis` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U023 | FX funding/carry/translation system paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U024 | portfolio consequences | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U025 | beginner FX question vs useful consequence question | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U026 | heading `Mistake 6: Turning one data release into a complete regime call` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U027 | one-release overreaction | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U028 | stack evidence + Chapter 11 cross-reference | historical paragraph | REVISE | conceptual meaning current; historical `Capítulo 11 (p. 50)` page reference must be regenerated |
| ES13-C12-U029 | false coherence paragraph | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U030 | heading `Mistake 7: Refusing to distinguish short-run moves from medium-run adjustment` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U031 | immediate move vs staged adjustment | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U032 | examples of staged transmission | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U033 | time horizons can make statements true intraday/false quarterly | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U034 | heading `A practical discipline for avoiding these errors` | matching heading | REUSE_VERIFIED | faithful heading |
| ES13-C12-U035 | five-step discipline | matching Spanish sequence | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U036 | mistakes less primitive, not forecasting easy | matching paragraph | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U037 | key takeaway | matching `Idea clave` block | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U038 | recap bullets | matching recap | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U039 | continue-reading block | matching destinations | REUSE_VERIFIED | meaning preserved |
| ES13-C12-U040 | selected-reference block | historical URL-rich block | REVISE | rebuild source presentation; BIS `preliminary` label is stale at current date and requires upstream source-authority resolution |
| ES13-C12-U041 | Candidate 2 compliance note | historical Spanish note | REVISE | historical note includes conditional/current-data language but lacks explicit trading-advice/trading-signal boundary of Candidate 2 |

## Chapter 12 counts

Registered units: **41**

- `REUSE_VERIFIED`: 34
- `REVISE`: 7
- `NEW_TRANSLATION`: 0
- `RETIRE`: 0

## Release-critical work

1. Correct malformed wording in U008, U017 and U019.
2. Regenerate U028 page-reference metadata after stable layout.
3. Resolve the BIS 2025 survey source label upstream before final U040 assembly.
4. Rebuild/link-check U040.
5. Replace U041 with the complete Candidate 2 compliance boundary.

Publication remains **HOLD**.
