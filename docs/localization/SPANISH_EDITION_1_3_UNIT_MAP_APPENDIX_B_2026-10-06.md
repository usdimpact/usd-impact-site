# Spanish Edition 1.3 unit map — Appendix B / USD Impact Score Methodology

Status: **NEW CONTROLLED TRANSLATION REQUIRED — HOLD**  
Checkpoint date: 2026-10-06  
English authority: Candidate 2 / `v5.95-candidate.2` / SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`  
Historical Spanish reference: Edition 1.2 — **no Appendix B release section**  
Production impact: **NONE**

Stable IDs use `ES13-AB-Uxxx`.

## Translation rule

Every substantive Appendix B unit is translated from current English authority. Historical Spanish Score language must not be used as methodology authority.

Numerical specifications, formulas, variable identifiers, weights, thresholds, version hashes and governed URLs are immutable.

## Unit register

| ID | Candidate 2 unit | State | Translation/control note |
| --- | --- | --- | --- |
| ES13-AB-U001 | `APPENDIX B` | NEW_TRANSLATION | explicit Appendix B label required |
| ES13-AB-U002 | title `USD Impact Score Methodology` | NEW_TRANSLATION | preserve product name and methodology meaning |
| ES13-AB-U003 | auditability / educational-tool / not-model-portfolio-or-system opening | NEW_TRANSLATION | preserve all compliance exclusions |
| ES13-AB-U004 | heading `What the score is designed to measure` | NEW_TRANSLATION | current structure |
| ES13-AB-U005 | stronger-dollar / weaker-dollar-liquidity-supportive / mixed-transition summary | NEW_TRANSLATION | preserve descriptive scope |
| ES13-AB-U006 | score does not answer suitability/value question | NEW_TRANSLATION | critical non-recommendation boundary |
| ES13-AB-U007 | heading `Input set and fixed signs` | NEW_TRANSLATION | current structure |
| ES13-AB-U008 | eight Friday-ended weekly inputs | NEW_TRANSLATION | names/order must remain exact |
| ES13-AB-U009 | positive vs negative signs and non-fitted-coefficient caveat | NEW_TRANSLATION | signs immutable |
| ES13-AB-U010 | heading `Production provider disclosure` | NEW_TRANSLATION | MP-12 |
| ES13-AB-U011 | current production provider mapping | NEW_TRANSLATION | Yahoo Finance/FRED mapping must follow current English authority at this publication cut-off |
| ES13-AB-U012 | source-discipline cross-check paragraph | NEW_TRANSLATION | preserve ICE/CME/S&P DJI/Cboe/Treasury/FRED/institutional-reference hierarchy |
| ES13-AB-U013 | heading `Normalization and weekly calculation` | NEW_TRANSLATION | MP-13 |
| ES13-AB-U014 | Friday-ended last-observation + weekly-level-not-return paragraph | NEW_TRANSLATION | exact calculation semantics |
| ES13-AB-U015 | z-score formula | NEW_TRANSLATION | immutable: `z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)` |
| ES13-AB-U016 | full-sample mean / sample SD / 2015-01-01 production start | NEW_TRANSLATION | exact specification |
| ES13-AB-U017 | Score v2 formula | NEW_TRANSLATION | immutable signed formula |
| ES13-AB-U018 | equal 0.125 absolute weights + clipping timing | NEW_TRANSLATION | exact values |
| ES13-AB-U019 | expanding moments / recalculation can revise history | NEW_TRANSLATION | critical vintage limitation |
| ES13-AB-U020 | heading `Regime labels` | NEW_TRANSLATION | MP-14 |
| ES13-AB-U021 | five regime-band table | NEW_TRANSLATION | thresholds immutable; Spanish labels terminology-reviewed |
| ES13-AB-U022 | thresholds are specification bands, not probabilities/triggers | NEW_TRANSLATION | critical non-signal boundary |
| ES13-AB-U023 | heading `How the validation evidence should be read` | NEW_TRANSLATION | MP-15 |
| ES13-AB-U024 | descriptive robustness evidence, not proven predictive power | NEW_TRANSLATION | preserve exact evidence boundary |
| ES13-AB-U025 | diagnostics do not establish future returns/outperformance | NEW_TRANSLATION | no frozen predictive success rate |
| ES13-AB-U026 | heading `Failure modes` | NEW_TRANSLATION | current structure |
| ES13-AB-U027 | supply shocks / pivots / asset-specific events failure zones | NEW_TRANSLATION | preserve asset-specific caveat |
| ES13-AB-U028 | weak zones should be visible | NEW_TRANSLATION | current quality principle |
| ES13-AB-U029 | heading `Version and evidence boundary` | NEW_TRANSLATION | MP-16 scope |
| ES13-AB-U030 | research candidates do not alter production v2 without governed change | NEW_TRANSLATION | version-control principle |
| ES13-AB-U031 | dated artifact must identify formula/providers/dates/code version | NEW_TRANSLATION | auditability requirement |
| ES13-AB-U032 | heading `Data hygiene and version control` | NEW_TRANSLATION | current structure |
| ES13-AB-U033 | live dashboard reproducibility metadata | NEW_TRANSLATION | score/input/source/date/methodology version |
| ES13-AB-U034 | dated archives vs current recalculated history | NEW_TRANSLATION | as-published-vintage distinction |
| ES13-AB-U035 | records must not be conflated; differences are audit evidence | NEW_TRANSLATION | no silent overwrite |
| ES13-AB-U036 | heading `Compliance boundary` | NEW_TRANSLATION | current structure |
| ES13-AB-U037 | educational orientation tool; no advice/signal/recommendation/position sizing | NEW_TRANSLATION | preserve full boundary |
| ES13-AB-U038 | heading `Selected methodology sources` | NEW_TRANSLATION | current structure |
| ES13-AB-U039 | ICE DXY source | NEW_TRANSLATION | source label preserved |
| ES13-AB-U040 | CME/NYMEX WTI source | NEW_TRANSLATION | source label preserved |
| ES13-AB-U041 | Cboe VIX source | NEW_TRANSLATION | source label preserved |
| ES13-AB-U042 | FRED/Treasury yields source | NEW_TRANSLATION | source label preserved |
| ES13-AB-U043 | LBMA/FRED/WGC gold references | NEW_TRANSLATION | source label preserved |
| ES13-AB-U044 | S&P Dow Jones Indices S&P 500 source | NEW_TRANSLATION | source label preserved |
| ES13-AB-U045 | institutional/disclosed BTCUSD reference | NEW_TRANSLATION | preserve disclosure requirement |
| ES13-AB-U046 | heading `Source freshness` | NEW_TRANSLATION | current structure |
| ES13-AB-U047 | fail-closed freshness/missing/misalignment/series-mapping rule | NEW_TRANSLATION | preserve operational boundary |
| ES13-AB-U048 | published number without dated source context is incomplete evidence | NEW_TRANSLATION | current evidence principle |
| ES13-AB-U049 | key takeaway | NEW_TRANSLATION | fixed inputs, signs, normalization, no hidden optimization, provenance, limits |
| ES13-AB-U050 | heading `Reader audit checklist` | NEW_TRANSLATION | MP-17 |
| ES13-AB-U051 | six reader-audit questions | NEW_TRANSLATION | preserve questions and order |
| ES13-AB-U052 | unclear answer → further analysis, not finished conclusion | NEW_TRANSLATION | critical usage boundary |
| ES13-AB-U053 | heading `Live Score v2 methodology and audit artifacts` | NEW_TRANSLATION | MP-18 |
| ES13-AB-U054 | `usd-impact.com/go/methodology` | NEW_TRANSLATION | governed URL immutable |
| ES13-AB-U055 | publication-candidate website authority hash | NEW_TRANSLATION | immutable hash `a86e57dafe91da67553e73e01bb0c703a868c949` |
| ES13-AB-U056 | Score-pipeline authority hash | NEW_TRANSLATION | immutable hash `f51f7abf2d4ec99890eb5537424f6faab885ef32` |

## Immutable numeric/specification block

The Spanish release must preserve exactly:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Regime thresholds:

- `>= +1.0`
- `+0.3 to < +1.0`
- `-0.3 to < +0.3`
- `-1.0 to < -0.3`
- `< -1.0`

No translation pass may change signs, operators, weights, start date, clipping threshold, threshold boundaries, variable identifiers or authority hashes.

## Counts

Registered units: **56**

- REUSE_VERIFIED: 0
- REVISE: 0
- NEW_TRANSLATION: 56
- RETIRE: 0

Publication remains **HOLD**.
