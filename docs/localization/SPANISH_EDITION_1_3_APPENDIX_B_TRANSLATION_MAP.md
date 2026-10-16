# Spanish Edition 1.3 — Phase 2A Appendix B Translation Map

Status: **BATCH C AUDIT — NEW TRANSLATION REQUIRED — PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Primary patches: MP-12 through MP-18

## Source finding

The active English Candidate 2 contains:

`APPENDIX B — USD Impact Score Methodology`

The historical Spanish Edition 1.2 PDF contains no Appendix B.

Therefore, the entire current Appendix B starts from:

`NEW_TRANSLATION_REQUIRED`

No paragraph in this appendix may be inferred from the historical Spanish glossary or older Chapter 10 methodology wording.

## AB-001 — Appendix purpose and compliance boundary

**English anchor:** opening paragraphs under `USD Impact Score Methodology`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical compliance / high methodology

Required concepts:

- appendix exists for auditability;
- educational regime-reading tool;
- not a model portfolio;
- not a trading system;
- not a forecast;
- not a recommendation.

---

## AB-002 — What the score is designed to measure

**English anchor:** `What the score is designed to measure`  
**Classification:** `NEW_TRANSLATION_REQUIRED`

Required concepts:

- stronger-dollar regime;
- weaker-dollar / liquidity-supportive regime;
- mixed transition;
- sequence: regime → channel → asset-specific interpretation;
- no answer about attractiveness, cheap/expensive status, or reader suitability.

---

## AB-003 — Input set and fixed signs

**English anchor:** `Input set and fixed signs`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical methodology

Translate the exact eight production inputs and fixed sign assignments.

Preserve the boundary that signs are framework assumptions, not permanent laws or fitted predictive coefficients.

---

## AB-004 — Production provider disclosure

**English anchor:** `Production provider disclosure`  
**MP:** MP-12  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** high methodology / medium compliance

Translate current production series disclosure:

- Yahoo Finance references for DXY, WTI, S&P 500, VIX, Bitcoin and gold;
- FRED for U.S. 2-year and 10-year Treasury yields;
- separate freshness gates;
- benchmark/institutional cross-check discipline;
- live methodology page as authority for the exact mapping at time of use.

Do not substitute the older Spanish source list for this provider disclosure.

---

## AB-005 — Normalization and weekly calculation

**English anchor:** `Normalization and weekly calculation`  
**MP:** MP-13  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical methodology

Preserve exactly:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

and

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Required concepts:

- Friday-ended weekly levels;
- last available observation in the week;
- weekly level, not weekly return;
- complete production sample available at run time;
- production start date 2015-01-01;
- sample standard deviation;
- eight absolute weights = 0.125;
- clipping after z-scoring;
- expanding production moments can change prior recalculated values.

Historical Spanish `desviación estándar móvil` wording is not valid authority for this unit.

---

## AB-006 — Regime labels

**English anchor:** `Regime labels`  
**MP:** MP-14  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** high methodology

Translate the five fixed bands without changing thresholds:

| Score | English authority |
| --- | --- |
| `>= +1.0` | Strong dollar regime |
| `+0.3 to < +1.0` | Firm dollar regime |
| `-0.3 to < +0.3` | Neutral / transitional |
| `-1.0 to < -0.3` | Soft dollar regime |
| `< -1.0` | Weak dollar regime |

Translate the boundary that these are specification choices, not probabilities, confidence intervals or trading triggers.

---

## AB-007 — Validation evidence

**English anchor:** `How the validation evidence should be read`  
**MP:** MP-15  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical compliance / critical methodology

Required concepts:

- descriptive validation and robustness evidence;
- not proven future predictive power;
- point-in-time normalization tests;
- single-driver omission;
- threshold sensitivity;
- contribution concentration;
- as-published vs current recalculation comparison;
- no claim that the Score predicts future returns;
- no fixed predictive success rate in the book.

The historical 84.5/100/79.7/73.2 claims must not be imported into this appendix.

---

## AB-008 — Failure modes

**English anchor:** `Failure modes`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** medium methodology

Translate the expected weak zones:

- supply shocks;
- policy/liquidity pivots;
- asset-specific adoption/liquidation events;
- flows and positioning dominating broad pattern.

Preserve the purpose: weak zones tell the reader where to slow down.

---

## AB-009 — Version and evidence boundary

**English anchor:** `Version and evidence boundary`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical governance

Required concepts:

- production Score v2 is distinct from research-only candidate models;
- a model candidate does not change production without a governed version change;
- dated evidence should identify formula, providers, observation dates and code version.

---

## AB-010 — Data hygiene and version control

**English anchor:** `Data hygiene and version control`  
**MP:** MP-16  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical methodology/vintage

Required concepts:

- publish score version, input set, source provenance, observation dates and methodology version;
- dated archives preserve as-published weekly vintages;
- current long-history chart may be recalculated;
- records must not be conflated;
- differences are evidence to audit, not values to overwrite silently;
- book remains frozen to stated edition/cut-off;
- website evolution requires explicit version labels and public methodology notes.

---

## AB-011 — Compliance boundary

**English anchor:** `Compliance boundary`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** critical compliance

Translate exactly in meaning:

- educational orientation tool;
- not personalized investment advice;
- not legal/tax opinion;
- not trading signal;
- not recommendation;
- not for position sizing, entry, exit or suitability by itself;
- proper use is regime → channel → asset-specific evidence.

---

## AB-012 — Selected methodology sources

**English anchor:** `Selected methodology sources`  
**Classification:** `NEW_TRANSLATION_REQUIRED`

Translate institution names carefully and preserve product/index names.

No source should be replaced merely to simplify Spanish copy.

---

## AB-013 — Source freshness

**English anchor:** `Source freshness`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** high governance

Required fail-closed concepts:

- missing source;
- source outside freshness limit;
- source misaligned to completed week;
- series mapping inconsistency;
- published number without dated source context = incomplete evidence.

---

## AB-014 — Key takeaway

**English anchor:** `Key takeaway`  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** medium compliance

Preserve:

- auditability;
- fixed inputs;
- disclosed signs;
- consistent normalization;
- no hidden optimization;
- version control;
- provenance;
- explicit limitations;
- supports framework without becoming trading system.

---

## AB-015 — Reader audit checklist

**English anchor:** `Reader audit checklist`  
**MP:** MP-17  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** high methodology

Translate all six questions:

1. Score/methodology version?
2. Eight inputs active and fresh?
3. As-published vintage or current recalculation?
4. Inside band or near revision-sensitive threshold?
5. Local shock beyond single-number explanation?
6. Dated source/reproduction artifact available?

Close with the instruction to treat unclear cases as prompts for further analysis, not finished regime conclusions.

---

## AB-016 — Live methodology bridge

**English anchor:** `Live Score v2 methodology and audit artifacts`  
**MP:** MP-18  
**Classification:** `NEW_TRANSLATION_REQUIRED`

Required visible target:

`usd-impact.com/go/methodology`

The QR/destination itself remains separately governed; this audit does not change it.

---

## AB-017 — Methodology cut-off authority identifiers

**English anchor:** final methodology cut-off line  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Risk:** high release-control

Current Candidate 2 prints:

- website authority `a86e57dafe91da67553e73e01bb0c703a868c949`;
- Score-pipeline authority `f51f7abf2d4ec99890eb5537424f6faab885ef32`.

Before the final Spanish candidate is generated, these identifiers must be reviewed for whether they remain the intended frozen publication-candidate references or require an explicitly versioned newer authority.

Do not silently substitute a newer hash during translation.

## Batch C disposition summary

All Appendix B units are:

`NEW_TRANSLATION_REQUIRED`

Historical Spanish Edition 1.2 provides no release authority for this appendix.

## Batch C review gate

Before Appendix B can be translation-review complete:

1. draft all AB-001 through AB-017 in Spanish;
2. terminology-review Score, regime, vintage, recalculation, provider and freshness language;
3. compliance-review all predictive/non-signal boundaries;
4. verify formulas and thresholds character-for-character;
5. verify source and provider names;
6. decide the final methodology cut-off authority identifiers explicitly;
7. validate the governed `/go/methodology` destination;
8. reviewer sign-off.

Publication remains HOLD.
