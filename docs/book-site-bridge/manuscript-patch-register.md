# Read the Dollar First — manuscript patch register

Date: 2026-08-29
Status: Phase 2C preparation only; no master-book edit authorized or performed.

## Purpose

This register converts the post-Phase-2B publication audit into a bounded manuscript correction plan for the certified Edition 1.2 PDF.

The correction target is deliberately narrow:

- Chapter 10 — `Reading Regimes: The Eleven-Year Record`;
- Chapter 13 — the live-dashboard / archive wording only;
- Appendix B — `USD Impact Score Methodology`;
- four required print-link insertions plus one optional companion insertion.

All other chapters remain editorially frozen unless the final layout pass reveals a direct cross-reference that must move because of pagination.

## Source authorities pinned for this register

### Frozen manuscript source

`USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks(1).pdf`

- Edition 1.2
- production build v5.94
- 83 PDF pages
- Chapter 10 printed pp. 49-55
- Chapter 11 printed pp. 56-59
- Chapter 13 printed pp. 65-70
- Appendix B printed pp. 75-79

### Website authority

`usdimpact/usd-impact-site` `main` at:

`a86e57dafe91da67553e73e01bb0c703a868c949`

Relevant authority:

- `apps/web/src/pages/score/methodology.astro`
- `apps/web/src/data/book-site-bridge/print-links.json`

### Score pipeline authority

`usdimpact/usd-impact-pipeline` `main` at:

`f51f7abf2d4ec99890eb5537424f6faab885ef32`

Relevant authority:

- `usd_impact_score_v2.py`
- `.github/workflows/weekly.yml`

The production Score workflow is Friday-ended and scheduled for Friday 22:00 UTC. The publication process is guarded by score-quality and reproduction-attestation checks before merge.

## Current production Score v2 facts the manuscript must match

1. Production uses eight inputs: DXY, WTI, S&P 500, VIX, Bitcoin, gold, U.S. 2Y yield and U.S. 10Y yield.
2. The production weekly input is the last available observation in the Friday-ended week.
3. Each weekly level is standardized against the complete production sample available at run time from the 2015 production start onward.
4. The normalization uses the full-sample mean and pandas sample standard deviation (`ddof=1`).
5. Standardized component values are clipped at `-3.5` and `+3.5`.
6. Equal absolute weights of `0.125` are applied with signs: `+DXY -WTI -SPX +VIX -BTC -GOLD +UST2Y +UST10Y`.
7. Current regime bands are:
   - `>= +1.0` Strong dollar regime;
   - `+0.3 to < +1.0` Firm dollar regime;
   - `-0.3 to < +0.3` Neutral / transitional;
   - `-1.0 to < -0.3` Soft dollar regime;
   - `< -1.0` Weak dollar regime.
8. Full-sample moments are recomputed as the sample expands. Therefore current recalculated historical scores can differ from earlier recalculations and are not a stable point-in-time out-of-sample record.
9. The production methodology publishes robustness and vintage diagnostics but does not treat them as proof of future predictive performance.
10. Dated as-published archives and current recalculated history must be described as different evidence types.

## Patch classes

- **P0 — required before publication:** factual/methodology inconsistency or historical-evidence overclaim.
- **P1 — required print bridge:** stable short-link / QR insertion needed for the intended book-site loop.
- **P2 — optional:** clarity improvement that can be omitted if layout cost is material.

---

## MP-01 — Chapter 10 opening frame

**Priority:** P0  
**PDF location:** PDF p. 50 / printed p. 49  
**Anchor:** Chapter 10 opening, beginning `Every framework in this book has earned its place...`

### Problem

The opening describes a quantitative score using a broader conceptual variable set than the current production Score v2 inputs and frames the chapter as a test of whether the framework has been `accurate`.

### Required replacement

> Every framework in this book has earned its place by being useful. This chapter asks a narrower question: how can the framework be compressed into a transparent weekly regime reading without pretending that compression is a forecast?
>
> The production USD Impact Score v2 is a descriptive weekly regime indicator built from eight market inputs the book has already introduced: DXY, WTI crude, the S&P 500, VIX, Bitcoin, gold, the U.S. 2-year Treasury yield, and the U.S. 10-year Treasury yield. The score is designed to summarize whether the cross-asset system is expressing firmer-dollar pressure, softer-dollar pressure, or a mixed transition.
>
> Read the historical material in this chapter as descriptive evidence and as a set of regime illustrations. Do not read it as a promise that the same relationships will repeat, as a point-in-time predictive backtest, or as a trading system. The live methodology page is the authority for the current production calculation and its robustness limits.

### Layout rule

Keep the Chapter 10 title and chapter-start page unchanged if practical.

---

## MP-02 — Chapter 10 `What the score is`

**Priority:** P0  
**PDF location:** PDF p. 51 / printed p. 50  
**Anchor:** heading `What the score is`

### Problem

The current text describes rolling-standard-deviation normalization and a weekly-move baseline. That no longer matches production.

### Required replacement

> The USD Impact Score v2 is recomputed weekly from eight Friday-ended market levels: DXY, WTI crude, the S&P 500, VIX, Bitcoin, gold, the U.S. 2-year Treasury yield, and the U.S. 10-year Treasury yield.
>
> For each input and each completed week, the pipeline takes the last available observation in that Friday-ended week. It then standardizes that weekly level against the complete production sample available at the time of the run, beginning in 2015. In compact form:
>
> `z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`
>
> The score is the equal-weighted signed average of those eight clipped standardized levels:
>
> `Score = 0.125 x (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`
>
> The signs are framework assumptions, not fitted regression coefficients. The absolute weights are fixed at 12.5 percent each. Because the full-sample mean and standard deviation are recomputed as the production sample expands, the current recalculated history can revise earlier historical score values. That makes the long-history chart useful for descriptive research, but not a stable point-in-time out-of-sample record.

### Production note

Do not restore language saying price/index variables use weekly log returns, yields use weekly basis-point changes, or normalization uses a rolling one-year window unless production itself changes and is separately versioned.

---

## MP-03 — Chapter 10 regime-label paragraph

**Priority:** P0  
**PDF location:** PDF p. 51 / printed p. 50  
**Anchor:** paragraph beginning `A clearly positive score means...`

### Required replacement

> Read the score in zones rather than as a precise forecast. A value at or above +1.0 is labeled a Strong dollar regime. Values from +0.3 to below +1.0 are Firm dollar. Values from -0.3 to below +0.3 are Neutral / transitional. Values from -1.0 to below -0.3 are Soft dollar. Values below -1.0 are Weak dollar. These are specification bands for descriptive language, not probabilities, confidence intervals, or trading triggers.

---

## MP-04 — Chapter 10 historical `hit rate` block

**Priority:** P0  
**PDF location:** PDF pp. 52-53 / printed pp. 51-52  
**Anchors:** headings `What the record shows` and `The honest record: what the score got right, and where it struggled`

### Problem

The current chapter repeatedly uses an approximately 84.5% aggregate historical hit-rate and per-regime percentages as evidence that the framework `reads regimes accurately`. Those figures belong to the earlier edition baseline and should not be used as current Score v2 predictive-performance evidence.

### Required replacement heading

`What the historical record can and cannot show`

### Required replacement body

> The long history is useful because it shows how a fixed cross-asset framework organizes very different market environments. But the current production history is recalculated with full-sample normalization, so it is not a frozen record of what the current formula would necessarily have published at every past date.
>
> That distinction changes how the evidence should be described. The historical chart can be used to study regime persistence, transitions, contribution concentration, driver sensitivity and episodes in which asset-specific forces override the macro pattern. It should not be described as a prospective predictive backtest.
>
> The live methodology publishes separate robustness work for point-in-time normalization, leave-one-driver-out sensitivity, threshold sensitivity, contribution concentration and as-published vintage comparison. Those diagnostics are designed to make weaknesses visible, not to manufacture a performance claim. Any prospective predictive study belongs to the live research record and should stand on its own observation history rather than be backfilled into this edition.
>
> The case studies below should therefore be read as retrospective regime illustrations. They show how the framework organizes the plumbing of a stress or tightening episode; they do not prove that a reader could have forecast the episode or earned a return from it.

### Delete from this edition

Remove the following as current validation claims:

- `84.5 percent` aggregate hit-rate language;
- `100 percent` claims for three regimes;
- `79.7 percent` and `73.2 percent` regime-performance claims;
- language that equates those percentages with present Score v2 accuracy.

Do not replace them with a new fixed performance percentage in the printed book.

---

## MP-05 — 2020 case-study wording

**Priority:** P0  
**PDF location:** PDF pp. 53-54 / printed pp. 52-53  
**Anchors:** `Case study one: the 2020 pandemic two-phase`

### Required edits

Replace:

`The 2020 episode is the most dramatic regime shift in the record and the cleanest test of whether the framework identifies regime changes in real time.`

with:

> The 2020 episode is the most dramatic regime shift in the record and a useful retrospective illustration of how the framework separates acute dollar-funding stress from the liquidity response that followed.

Replace the paragraph that says the score was designed before the pandemic and `read both phases correctly, in roughly real time` with:

> The current recalculated Score v2 history displays both phases clearly: acute funding stress followed by a sharp liquidity reversal. That is useful descriptive evidence. It should not be presented as proof that the current production formula published those exact historical readings contemporaneously.

Preserve the asset-transmission discussion where it remains explanatory rather than predictive.

---

## MP-06 — 2022 case-study wording

**Priority:** P0  
**PDF location:** PDF pp. 54-55 / printed pp. 53-54  
**Anchor:** `Case study two: the 2022 tightening cycle`

### Required edits

Replace `The 2022 cycle is the second test...` with:

> The 2022 tightening cycle is a second retrospective illustration, and it is more difficult than the 2020 case because the cross-asset signals conflicted during parts of the year.

Where the text says the framework `predicts` an asset will decouple or behave in a particular way, prefer `allows for`, `expects can`, or `explains why` unless the sentence is explicitly describing an already-observed historical move.

---

## MP-07 — Chapter 10 `What the record does not prove`

**Priority:** P0  
**PDF location:** PDF p. 55 / printed p. 54  
**Anchor:** heading `What the record does not prove`

### Required first-paragraph replacement

> The eleven-year recalculated record shows how the framework can organize past regimes. It does not establish future predictive accuracy, future investment returns, or superiority over alternative frameworks. Those are separate questions and require evidence that this chapter does not claim to provide.

Keep the existing limitations about future regimes, portfolio returns and alternative frameworks, subject to copy-fitting.

---

## MP-08 — Chapter 10 key takeaway

**Priority:** P0  
**PDF location:** PDF p. 56 / printed p. 55  
**Anchor:** `Key takeaway`

### Required replacement

> The USD Impact Score v2 is a single-number compression of a broader cross-asset framework. Its value comes from transparency: eight disclosed inputs, fixed signed equal weights, explicit normalization, fixed regime bands, dated source provenance and visible limitations. The current long history is a recalculated descriptive record, not a promise of future accuracy and not a trading signal. Use the score to orient the weekly read, then return to the chapter-level transmission logic when the assets disagree.

### Chapter recap replacement

Use three bullets only:

- The Score compresses eight disclosed market inputs into a descriptive weekly regime reading.
- Full-sample normalization means recalculated history is not the same thing as an as-published point-in-time archive.
- The Score is an orientation tool, not a forecast, trading signal or substitute for asset-specific transmission analysis.

---

## MP-09 — Chapter 10 live-methodology print bridge

**Priority:** P1  
**PDF location:** end of Chapter 10, printed p. 55  
**Insertion:** immediately after the revised recap and before Selected references.

### Required print copy

`Current Score v2 dashboard: usd-impact.com/go/score`

`Current Score v2 methodology: usd-impact.com/go/methodology`

QR requirement: one QR to `/go/score` at the end of Chapter 10. The methodology short link remains visible in text here and receives its own QR in Appendix B.

---

## MP-10 — Chapter 13 archive-vintage distinction

**Priority:** P0  
**PDF location:** PDF p. 70 / printed p. 69  
**Anchor:** paragraph beginning `The dashboard also maintains the case-study archive...`

### Problem

The text currently says older cases show how the score read them `in real time — not reconstructed with hindsight` without distinguishing as-published vintages from recalculated history.

### Required replacement

> The live system separates two kinds of history. Dated as-published archives preserve the weekly publications captured by the current archival process. The longer research history is recalculated from the current provider histories and the current Score v2 normalization. Treat those records differently: an as-published archive is evidence of what was actually released at that date, while a recalculated historical chart is a current research view of the past.
>
> When revisiting an older case such as 2020 or 2022, first identify which kind of record you are using. The difference is not cosmetic. It is part of the methodology discipline this book asks the reader to apply everywhere else.

### Preserve

The Friday 22:00 UTC weekly Score cadence can remain. It matches the authoritative production workflow.

---

## MP-11 — Chapter 13 companion short link

**Priority:** P2  
**PDF location:** printed pp. 68-69, inside `How to keep using the book — and the companion that comes with it`

### Optional insertion

`Book Companion: usd-impact.com/go/companion`

If layout is tight, keep this as text-only and omit the QR. Chapter 11 already receives the primary practice QR.

---

## MP-12 — Appendix B production provider disclosure

**Priority:** P0  
**PDF location:** PDF pp. 76-77 / printed pp. 75-76  
**Anchor:** heading `Primary data hierarchy`

### Required replacement

> Production v2 uses named, disclosed market-data series for automation and applies separate freshness gates before publication. The current production series are Yahoo Finance references for DXY, WTI, the S&P 500, VIX, Bitcoin and gold, and FRED series for the U.S. 2-year and 10-year Treasury yields.
>
> That automation choice does not remove the book's source discipline. Important interpretive claims should remain cross-checkable against the relevant benchmark owner or institutional source: ICE for DXY, CME/NYMEX for WTI, S&P Dow Jones Indices for the S&P 500, Cboe for VIX, Treasury/FRED for yields, and clearly named institutional or benchmark references for gold and Bitcoin. The live methodology page is the authority for the exact production provider/series mapping at the time of use.

---

## MP-13 — Appendix B normalization and formula

**Priority:** P0  
**PDF location:** PDF p. 77 / printed p. 76  
**Anchors:** headings `Normalization and weekly calculation` and `Baseline formula`

### Required replacement

> Each production input is aligned to a Friday-ended weekly series using the last available observation in that week. The production score standardizes the weekly level, not a weekly return, against the complete production sample available at run time.
>
> For input `i`, week `t`, and production run `T`:
>
> `z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`
>
> `mean(i,T)` is the full-sample mean and `sd(i,T)` is the sample standard deviation over the complete production sample available through run `T`, using the production start date of 2015-01-01.
>
> The production Score v2 is:
>
> `Score(t,T) = 0.125 x (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`
>
> All eight absolute weights are 0.125. The signs are fixed framework assumptions rather than fitted predictive coefficients. Standardized component values are clipped only after z-scoring, at -3.5 and +3.5.
>
> Because the production moments are full-sample and expand through time, recalculating the historical series later can change prior z-scores and, near thresholds, historical regime labels. The current long-history chart is therefore not a point-in-time out-of-sample record.

---

## MP-14 — Appendix B regime labels

**Priority:** P0  
**PDF location:** PDF p. 77 / printed p. 76  
**Anchor:** heading `Regime labels`

### Required replacement table

| Score | Published label |
| --- | --- |
| `>= +1.0` | Strong dollar regime |
| `+0.3 to < +1.0` | Firm dollar regime |
| `-0.3 to < +0.3` | Neutral / transitional |
| `-1.0 to < -0.3` | Soft dollar regime |
| `< -1.0` | Weak dollar regime |

Follow with:

> These thresholds are fixed specification choices. They are not probabilities, confidence intervals or trading triggers.

Delete the old `+/-0.50` three-zone convention from the final manuscript.

---

## MP-15 — Appendix B historical hit-rate section

**Priority:** P0  
**PDF location:** PDF p. 78 / printed p. 77  
**Anchor:** heading `How the 84.5 percent hit rate should be read`

### Required replacement heading

`How the validation evidence should be read`

### Required replacement body

> Production Score v2 publishes descriptive validation and robustness evidence, not a claim of proven future predictive power. The live research record includes tests of point-in-time normalization, single-driver omission, threshold sensitivity, contribution concentration and comparison of valid as-published archives with current recalculations.
>
> Those tests answer questions about stability, revision sensitivity and specification risk. They do not establish that the Score will predict future asset returns or that a portfolio based on it will outperform. The book therefore does not freeze a predictive success rate into this edition. Any later prospective result belongs to the dated live research record and must be interpreted under the protocol that produced it.

Delete the fixed 84.5% and per-regime percentage claims from Appendix B.

---

## MP-16 — Appendix B data hygiene / vintage wording

**Priority:** P0  
**PDF location:** PDF p. 79 / printed p. 78  
**Anchor:** heading `Data hygiene and version control`

### Required replacement / expansion

> The live dashboard should publish the score version, input set, source provenance, observation dates and methodology version needed to reproduce the release. Dated archives preserve as-published weekly vintages captured by the publication system. The current long-history chart may be recalculated from updated provider histories and the expanding full-sample normalization.
>
> Those two records must not be conflated. If a current recalculation differs from an as-published vintage, the difference is evidence to audit, not a value to overwrite silently. The book remains frozen to its stated edition and cut-off, while the website can evolve only with explicit version labels and public methodology notes.

Preserve the existing compliance boundary that the Score must not be used by itself for position sizing, entry, exit or suitability decisions.

---

## MP-17 — Appendix B reader audit checklist

**Priority:** P0  
**PDF location:** PDF pp. 79-80 / printed pp. 78-79  
**Anchor:** `Reader audit checklist`

### Required replacement checklist

Before relying on a dashboard reading, ask:

1. What Score version and methodology version produced this reading?
2. Are all eight required inputs active and within their publication freshness limits?
3. Is the displayed history an as-published vintage or a current recalculation?
4. Is the reading clearly inside a regime band or close enough to a threshold that recalculation sensitivity matters?
5. Is one asset being driven by a local shock that the single-number Score cannot explain?
6. What dated source or reproduction artifact would let another reader verify the release?

Close with:

> If any answer is unclear, treat the Score as a prompt for further analysis rather than as a finished regime conclusion.

---

## MP-18 — Appendix B methodology QR

**Priority:** P1  
**PDF location:** final page of Appendix B / printed p. 79  
**Required print copy:**

`Live Score v2 methodology and audit artifacts: usd-impact.com/go/methodology`

Add one QR encoding only:

`https://usd-impact.com/go/methodology`

Do not encode the long implementation URL or a provider URL in print.

---

## MP-19 — Chapter 3 practice QR

**Priority:** P1  
**PDF location:** end of Chapter 3 / printed p. 20, after recap and before Selected references  
**Required print copy:**

`Practice DXY vs. Broad USD: usd-impact.com/go/c03`

QR target:

`https://usd-impact.com/go/c03`

This alias currently resolves to the Chapter 3 DXY-versus-broad-USD practice route with book edition/chapter context.

---

## MP-20 — Chapter 11 practice QR

**Priority:** P1  
**PDF location:** end of Chapter 11 / printed p. 59, after recap and before Selected references  
**Required print copy:**

`Practice the weekly framework: usd-impact.com/go/c11`

QR target:

`https://usd-impact.com/go/c11`

This alias currently resolves to the Weekly Regime Lab with book edition/chapter context.

---

## Patch scope summary

### Required factual/manuscript corrections

- MP-01 through MP-08
- MP-10
- MP-12 through MP-17

### Required print bridge insertions

- MP-09 `/go/score`
- MP-18 `/go/methodology`
- MP-19 `/go/c03`
- MP-20 `/go/c11`

### Optional

- MP-11 `/go/companion` text/QR in Chapter 13

## Explicit non-goals

This register does not authorize:

- editing the master PDF or its Drive source;
- changing the live Score methodology or pipeline;
- changing any `/go/` destination;
- adding a new data provider;
- creating a new video or AI feature;
- assigning ISBN/barcode or changing imprint/publication metadata.

## Final edit acceptance criteria

A later manuscript-edit phase should not be considered complete until:

1. every P0 patch is applied or explicitly rejected with a documented reason;
2. all four required print links resolve through the governed `/go/` aliases;
3. Chapter 10 and Appendix B match the same pinned production methodology authority;
4. no `84.5%`, `100%`, `79.7%`, or `73.2%` performance claim remains as current Score v2 evidence;
5. no paragraph describes recalculated pre-archive history as an as-published real-time record;
6. TOC, printed page references, index ranges, bookmarks and internal hyperlinks are revalidated after layout;
7. the corrected manuscript receives a fresh edition/build identifier before ISBN/barcode work begins.
