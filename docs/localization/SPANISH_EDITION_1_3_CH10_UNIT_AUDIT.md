# Spanish Edition 1.3 — Phase 2A Chapter 10 Unit Audit

Status: **BATCH A AUDIT — TRANSLATION/PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Source baseline: `SPANISH_EDITION_1_3_PARITY_AUDIT_BASELINE.md`

## Scope

This file audits the release-critical Chapter 10 units required by MP-01 through MP-09.

It compares:

- current English authority: Edition 1.3 / v5.95 Candidate 2;
- historical Spanish reference: Edition 1.2 / April 2026.

This is an editorial disposition register. It does not publish, translate into a final artifact, or modify either source PDF.

## Unit dispositions

### C10-001 — Chapter opening: purpose of the chapter

**English authority anchor:** first paragraph after `Reading Regimes: The Eleven-Year Record`  
**MP:** MP-01  
**Historical ES anchor:** first paragraph after `Leer regímenes: el registro de once años`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** high

Current English asks how to compress the framework into a transparent weekly regime reading **without pretending the compression is a forecast**.

Historical Spanish instead opens with:

- whether the framework “has also been accurate”;
- a claim that the reader deserves to see the framework “tested against the evidence”;
- a setup toward measurable regime accuracy.

**Required action:** replace the accuracy-testing premise with the current descriptive-compression premise.

**Reuse rule:** do not reuse the current Spanish opening sentence structure as final copy.

---

### C10-002 — Production Score v2 identity and eight inputs

**English authority anchor:** paragraph beginning `The production USD Impact Score v2...`  
**MP:** MP-01  
**Historical ES anchor:** opening paragraph describing `dólar amplio, DXY, tasas reales, complejo de volatilidad...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** high

Current authority names eight production inputs directly:

1. DXY
2. WTI
3. S&P 500
4. VIX
5. Bitcoin
6. gold
7. U.S. 2-year Treasury yield
8. U.S. 10-year Treasury yield

Historical Spanish opening instead describes a broader conceptual set including broad dollar, real rates, curve structure and relative behavior of asset blocks.

**Required action:** translate the exact current eight-input identity and descriptive regime purpose.

---

### C10-003 — Historical-evidence reading boundary

**English authority anchor:** paragraph beginning `Read the historical material in this chapter as descriptive evidence...`  
**MP:** MP-01  
**Historical ES equivalent:** no sufficiently equivalent current-authority unit identified  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** high

Current authority explicitly prohibits reading the history as:

- a promise of repeated relationships;
- a point-in-time predictive backtest;
- a trading system.

It also identifies the live methodology page as authority for the current production calculation and robustness limits.

**Required action:** new translation. Do not infer this boundary from older generic compliance text.

---

### C10-004 — “How to read this evidence”: stress-test boundary

**English authority anchor:** first paragraph under `How to read this evidence`  
**MP:** MP-01  
**Historical ES anchor:** `Cómo leer esta evidencia` first paragraph  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

The historical Spanish sentence is directionally similar but does not preserve the full current boundary, including timing risk and asset-specific transmission channels.

**Required action:** revise against current English; do not mark `REUSE_VERIFIED` without a complete semantic check.

---

### C10-005 — “Useful question” paragraph

**English authority anchor:** paragraph beginning `The useful question is not whether a single number predicts every week...`  
**MP:** MP-01  
**Historical ES equivalent:** none identified as a standalone equivalent  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

**Required action:** translate current orientation-before-underlying-evidence framing.

---

### C10-006 — “What the score is”: weekly levels and Friday-ended observations

**English authority anchor:** `What the score is`, first two paragraphs  
**MP:** MP-02  
**Historical ES anchor:** paragraph beginning `La USD Impact Score es un único número...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** critical

Historical Spanish says each input is normalized against its own history using a moving standard deviation.

That does not match production.

**Required action:** replace with current Friday-ended weekly-level and full-production-sample description.

---

### C10-007 — Score formula and z-score definition

**English authority anchor:** formula block under `What the score is`  
**MP:** MP-02  
**Historical ES equivalent:** no current formula authority; legacy prose only  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** critical

Current authority requires:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

and

`Score = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

**Required action:** translate explanatory prose while preserving formula tokens exactly.

---

### C10-008 — Fixed signs/weights and recalculation limitation

**English authority anchor:** paragraph beginning `The signs are framework assumptions...`  
**MP:** MP-02  
**Historical ES anchor:** weights paragraph and clipping paragraph  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** critical

Historical Spanish:

- explains directional weights from transmission logic;
- says clipping is approximately three standard deviations;
- presents one time series from 2015 to present;
- does not preserve current full-sample-expansion revision limitation.

Current authority requires:

- signs are framework assumptions, not fitted regression coefficients;
- absolute weights are fixed at 12.5%;
- full-sample moments expand through time;
- recalculated historical values can revise;
- long-history chart is not a stable point-in-time out-of-sample record.

**Required action:** full revision.

---

### C10-009 — Five regime labels

**English authority anchor:** `Regime labels`  
**MP:** MP-03  
**Historical ES equivalent:** current five-band scheme absent  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** high

Translate the fixed five-band descriptive scheme:

- `>= +1.0` Strong dollar
- `+0.3 to < +1.0` Firm dollar
- `-0.3 to < +0.3` Neutral / transitional
- `-1.0 to < -0.3` Soft dollar
- `< -1.0` Weak dollar

The thresholds are specification choices, not probabilities, confidence intervals or trading triggers.

---

### C10-010 — “What the historical record can and cannot show”

**English authority anchor:** four paragraphs under the current heading  
**MP:** MP-04  
**Historical ES anchors:** `Qué muestra el registro` plus `El registro honesto: lo que la puntuación acertó y dónde sufrió`  
**Classification:** `RETIRE_DO_NOT_REUSE` for historical performance-accuracy block; `NEW_TRANSLATION_REQUIRED` for current replacement  
**Compliance risk:** critical  
**Methodology/vintage risk:** critical

Historical Spanish contains the obsolete current-evidence claims:

- approximately 84.5% aggregate hit rate;
- 100% for three regimes;
- 79.7% and 73.2% regime results;
- instructions to interpret the score through these accuracy figures.

Fresh deterministic scan counts across the historical Spanish PDF:

- 84.5 / 84,5: 8 matches
- 100%: 6 matches
- 79.7 / 79,7: 5 matches
- 73.2 / 73,2: 5 matches

**Required action:** retire the performance-accuracy block as current Score v2 evidence and translate Candidate 2’s descriptive-history/robustness wording.

No new fixed performance percentage may replace it.

---

### C10-011 — 2020 case study opening

**English authority anchor:** first paragraph under `Case study one: the 2020 pandemic two-phase`  
**MP:** MP-05  
**Historical ES anchor:** first paragraph under `Estudio de caso uno...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** critical

Historical Spanish calls 2020:

`... la prueba más limpia de si el marco identifica cambios de régimen en tiempo real.`

Current English calls it a **retrospective illustration** of funding stress and the liquidity response.

**Required action:** replace the real-time testing claim.

---

### C10-012 — 2020 first-phase description

**English authority anchor:** paragraph beginning `The first phase began...`  
**MP:** MP-05  
**Historical ES anchor:** first-phase paragraph beginning `La primera fase comenzó...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** high

Historical Spanish says the framework “correctly identified” what was happening and presents the score reading as contemporaneous proof.

Current authority says **in the recalculated history**, Score v2 rises into a firm dollar-stress configuration.

**Required action:** preserve the asset/funding mechanism, but explicitly identify the record as recalculated history.

---

### C10-013 — 2020 second-phase description

**English authority anchor:** `The liquidity response` and following paragraphs  
**MP:** MP-05  
**Historical ES anchor:** second-phase paragraph beginning `La segunda fase comenzó...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** high  
**Methodology/vintage risk:** high

Historical Spanish repeatedly describes the phase as “the correct reading” and states that assets moved in the direction the framework would have predicted.

Current authority describes the recalculated reversal and treats the episode as mechanism illustration.

**Required action:** remove predictive-success language; retain observed transmission explanation where factually aligned.

---

### C10-014 — 2020 contemporaneous-success conclusion

**English authority anchor:** current paragraphs stating recalculated history displays both phases and is not proof of contemporaneous publication  
**MP:** MP-05  
**Historical ES anchor:** paragraph beginning `El caso de 2020 importa...`  
**Classification:** `RETIRE_DO_NOT_REUSE`  
**Compliance risk:** critical  
**Methodology/vintage risk:** critical

Historical Spanish states:

`... el marco leyó ambas fases correctamente, en aproximadamente tiempo real ...`

This conflicts directly with current authority.

**Required action:** retire the claim and use the Candidate 2 replacement, which says the current recalculated history should not be presented as proof that the current formula published those exact readings contemporaneously.

---

### C10-015 — 2022 case study opening

**English authority anchor:** first paragraph under `Case study two: the 2022 tightening cycle`  
**MP:** MP-06  
**Historical ES anchor:** first paragraph under `Estudio de caso dos...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** high

Historical Spanish calls 2022 a second “test”.

Current authority calls it a second **retrospective illustration**.

**Required action:** revise terminology.

---

### C10-016 — 2022 transmission paragraphs

**English authority anchors:** paragraphs covering Fed tightening, real yields, DXY, gold, Bitcoin and oil  
**MP:** MP-06  
**Historical ES equivalent:** existing observed-asset discussion  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

Substantial descriptive material may remain useful, but wording such as:

- the framework “predicted” oil decoupling;
- “predicted” gold behavior;
- “predicted” Bitcoin behavior

must be replaced with the current `allows for` / explanatory framing.

No paragraph in this unit is `REUSE_VERIFIED` yet.

---

### C10-017 — Exception and gold-decoupling lesson

**English authority anchor:** `What the exceptions teach` through the 2023–2024 gold discussion  
**MP:** MP-06 / MP-07 supporting boundary  
**Historical ES anchor:** gold-decoupling discussion before the case studies  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

Current authority makes the compressed-tool boundary explicit: the score can show coherence/mixed/concentrated configuration, but cannot replace chapter-level causal analysis.

**Required action:** preserve the mechanism concept only after close semantic comparison.

---

### C10-018 — “What the record does not prove”

**English authority anchor:** three paragraphs under the heading  
**MP:** MP-07  
**Historical ES anchor:** `Lo que el registro no demuestra`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** high

Historical Spanish begins by asserting that the eleven-year record **shows the framework reads regimes accurately across five episodes** before listing limitations.

Current authority begins with the narrower statement that the recalculated record shows how the framework can organize past regimes and does **not** establish:

- future predictive accuracy;
- future investment returns;
- superiority over alternatives.

**Required action:** replace the opening limitation paragraph and review the remainder for predictive implications.

---

### C10-019 — “How to use the record”

**English authority anchor:** three paragraphs under `How to use the record`  
**MP:** MP-07 / MP-08 supporting unit  
**Historical ES anchor:** `Cómo usar el registro`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** high

Historical Spanish says the framework has been tested against evidence and uses that as the reason the dashboard “deserves” weekly use.

Current authority instead uses the recalculated history as a reference library and instructs the reader to distinguish as-published vintage from current recalculation.

**Required action:** revise fully against Candidate 2.

---

### C10-020 — Recalculated history vs as-published evidence

**English authority anchor:** `Recalculated history and as-published evidence`  
**MP:** MP-07 / MP-08; cross-reference MP-10  
**Historical ES equivalent:** no adequate unit in Chapter 10  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** critical

This distinction is mandatory:

- current long-history series uses provider histories available now and expanding production moments;
- dated as-published archive preserves what the publication system actually released on a date;
- the records cannot be substituted for one another.

**Required action:** new translation.

---

### C10-021 — Key takeaway

**English authority anchor:** `Key takeaway`  
**MP:** MP-08  
**Historical ES anchor:** `Idea clave`  
**Classification:** historical unit `RETIRE_DO_NOT_REUSE`; current replacement `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** critical

Historical Spanish repeats:

- 84.5% aggregate accuracy;
- 100% / 79.7% / 73.2% results;
- “framework has been tested” credibility language.

Current authority instead emphasizes:

- eight disclosed inputs;
- fixed signed equal weights;
- explicit normalization;
- fixed regime bands;
- dated provenance;
- visible limitations;
- recalculated descriptive history;
- not a promise of future accuracy;
- not a trading signal.

**Required action:** retire the historical takeaway and translate the current replacement.

---

### C10-022 — Chapter recap

**English authority anchor:** `Chapter recap — what to remember`  
**MP:** MP-08  
**Historical ES anchor:** `Repaso del capítulo — qué recordar`  
**Classification:** `REVISE_REQUIRED`, with obsolete percentage bullet `RETIRE_DO_NOT_REUSE`  
**Compliance risk:** critical  
**Methodology/vintage risk:** high

Current authority has exactly three recap bullets:

1. eight disclosed inputs → descriptive weekly regime reading;
2. full-sample normalization means recalculated history differs from an as-published archive;
3. orientation tool, not forecast/signal/substitute for asset-specific analysis.

**Required action:** replace the historical four-bullet recap with the current three-bullet authority.

---

### C10-023 — Weekly Score and methodology print bridges

**English authority anchor:** immediately after recap  
**MP:** MP-09  
**Historical ES equivalent:** absent  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** low  
**Methodology/vintage risk:** medium

Required visible targets:

- `usd-impact.com/go/score`
- `usd-impact.com/go/methodology`

The audit does not authorize changing either destination.

---

### C10-024 — Continue-reading block

**English authority anchor:** `Continue your reading`  
**MP:** supporting Chapter 10 parity  
**Historical ES anchor:** `Sigue leyendo`  
**Classification:** `REVISE_REQUIRED` pending exact cross-reference validation  
**Compliance risk:** low  
**Methodology/vintage risk:** low

The chapter references should resolve to:

- Chapter 11 — Weekly Operating Framework;
- Chapter 4 — cross-asset transmission companion.

**Required action:** update page references only in the later layout stage.

---

### C10-025 — Selected references

**English authority anchor:** `Selected references`  
**MP:** supporting Chapter 10 parity  
**Historical ES anchor:** `Referencias seleccionadas`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

Current authority identifies Federal Reserve H.10, FRED, ICE DXY methodology, CME/NYMEX WTI, Cboe VIX, plus live Score v2 methodology and dated audit artifacts.

Historical Spanish references should not be copied as-is merely because they are valid institutions.

**Required action:** rebuild the reference block from current English authority.

---

### C10-026 — Compliance note

**English authority anchor:** final Chapter 10 compliance note  
**MP:** supporting Chapter 10 parity  
**Historical ES anchor:** final `Nota de cumplimiento`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** medium

Current English explicitly says:

- educational and informational only;
- not personalized investment advice;
- not a forecast;
- not a trading signal;
- not a recommendation;
- historical and recalculated evidence does not establish future results.

Historical Spanish still describes a historical methodology and a backtest.

**Required action:** translate current compliance note rather than reuse the old one.

## Batch A disposition summary

| Classification | Unit count / treatment |
| --- | ---: |
| `REUSE_VERIFIED` | 0 |
| `REVISE_REQUIRED` | 17 units |
| `NEW_TRANSLATION_REQUIRED` | 7 units or replacement units |
| `RETIRE_DO_NOT_REUSE` | 4 historical units/blocks with explicit retirement treatment |

Counts reflect unit-level treatment above; some rows intentionally carry a retired historical unit plus a new current replacement.

The absence of `REUSE_VERIFIED` in this release-critical batch is deliberate. The historical Spanish chapter is close enough in structure to be useful as translation memory, but the current methodology/vintage/compliance changes are too material to certify any release-critical unit for direct reuse without revision.

## Batch A completion state

MP-01 through MP-09 are now mapped at unit level.

Still required before Batch A can be marked review-complete:

1. draft Spanish replacement text for all `REVISE_REQUIRED` and `NEW_TRANSLATION_REQUIRED` units;
2. second-pass terminology review against the approved localization terminology authority;
3. current reference-link validation;
4. compliance review;
5. reviewer sign-off;
6. layout/page-reference work only after a new Spanish candidate exists.

Publication remains HOLD.
