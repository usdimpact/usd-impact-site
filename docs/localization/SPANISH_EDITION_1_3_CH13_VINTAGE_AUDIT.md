# Spanish Edition 1.3 — Phase 2A Chapter 13 Vintage Audit

Status: **BATCH B AUDIT — TRANSLATION/PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Primary patch: MP-10

## Scope

This file audits the Chapter 13 companion/archive units that control the distinction between:

- dated as-published archives; and
- current recalculated Score v2 history.

The rest of Chapter 13 remains subject to the later full-book paragraph parity pass.

## C13-001 — Companion publication description

**English authority anchor:** paragraph beginning `The book also has a companion...`  
**Historical ES anchor:** paragraph beginning `El libro también tiene un complemento...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** high

Current authority says the dashboard keeps dated publications and current research views within a governed evidence system.

Historical Spanish says it keeps a rolling archive of past scores/comments alongside an eleven-year historical record, without the current distinction.

**Required action:** revise against current English authority.

---

## C13-002 — Companion is not a signal service

**English authority anchor:** `The companion is not a signal service...`  
**Historical ES equivalent:** no sufficiently equivalent standalone unit  
**Classification:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** medium

**Required action:** translate the explicit boundary that the companion does not tell the reader what to buy and exists to practise the framework on a fixed cadence.

---

## C13-003 — Friday cadence explanation

**English authority anchor:** paragraph beginning `The Friday release cycle is deliberate...`  
**Historical ES anchor:** paragraph beginning `El ciclo de publicación del viernes es deliberado...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** low  
**Methodology/vintage risk:** medium

Historical Spanish contains older timing rationale and behavioral instructions that are not identical to Candidate 2.

Current authority gives the narrower reason that the U.S. week is complete enough for a coherent weekly observation and the fixed cadence prevents an intraday-reaction model.

**Required action:** revise against current text.

---

## C13-004 — How to use the dashboard

**English authority anchor:** paragraph beginning `When you use the dashboard...`  
**Historical ES anchor:** paragraph beginning `Cuando uses el panel...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** medium  
**Methodology/vintage risk:** medium

Historical Spanish adds calibration language implying the reader should determine whether the dashboard or personal read was “closer” and diagnose personal miscalibration over time.

Current Candidate 2 is narrower: read the current week, compare with underlying evidence, and return to the relevant chapter when the reads differ.

**Required action:** revise to Candidate 2.

---

## C13-005 — Historical archive claim

**English authority anchor:** `The live system separates two kinds of history...`  
**Historical ES anchor:** paragraph beginning `El panel también mantiene el archivo de estudios de caso...`  
**MP:** MP-10  
**Historical classification:** `RETIRE_DO_NOT_REUSE`  
**Current replacement:** `NEW_TRANSLATION_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** critical

Historical Spanish states:

`... puedes ver cómo la puntuación los leyó en tiempo real — no reconstruidos con visión retrospectiva. La claridad retrospectiva es fácil; el archivo muestra si el marco fue claro en el momento.`

This directly conflicts with current evidence governance.

Candidate 2 requires the following conceptual distinction:

1. **Dated as-published archives** preserve weekly publications captured by the current archival process.
2. **Longer research history** is recalculated from current provider histories and current Score v2 normalization.
3. An as-published archive is evidence of what was actually released at that date.
4. A recalculated historical chart is a current research view of the past.
5. Older cases such as 2020 or 2022 must first be identified as one record type or the other.

**Required action:** retire the historical claim in full and translate the current two-record distinction.

No Spanish candidate may contain a sentence implying the long reconstructed history is proof of contemporaneous publication.

---

## C13-006 — Return to book / operating-system close

**English authority anchor:** `Use the dashboard. Return to the book...`  
**Historical ES anchor:** `Usa el panel. Vuelve al libro...`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** low  
**Methodology/vintage risk:** medium

The sentence is structurally similar, but its placement after the corrected vintage distinction changes the meaning.

**Required action:** translate/revise in context after C13-005.

---

## C13-007 — Continue-reading bridge to Appendix B

**English authority anchor:** `Continue your reading`  
**Historical ES anchor:** `Sigue leyendo`  
**Classification:** `REVISE_REQUIRED` plus `NEW_TRANSLATION_REQUIRED` Appendix B reference  
**Compliance risk:** low  
**Methodology/vintage risk:** low

Current English explicitly directs the reader to:

- Appendix A — Quick Glossary; and
- Appendix B — USD Impact Score Methodology.

Historical Spanish only points to the glossary because Appendix B does not exist.

**Required action:** add the Appendix B cross-reference after the new Spanish Appendix B exists.

---

## C13-008 — Final compliance note

**English authority anchor:** final Chapter 13 compliance note  
**Historical ES anchor:** final `Nota de cumplimiento`  
**Classification:** `REVISE_REQUIRED`  
**Compliance risk:** critical  
**Methodology/vintage risk:** low

Current authority explicitly includes:

- educational and informational only;
- not personalized investment/legal/tax/trading advice;
- not a trading signal;
- not a recommendation;
- relationships are conditional;
- current data should be verified.

**Required action:** translate current authority rather than carry the old note forward unchanged.

## Batch B disposition summary

| Classification | Treatment |
| --- | ---: |
| `REUSE_VERIFIED` | 0 |
| `REVISE_REQUIRED` | 6 units |
| `NEW_TRANSLATION_REQUIRED` | 3 current/replacement units |
| `RETIRE_DO_NOT_REUSE` | 1 critical historical archive claim |

## Batch B completion state

MP-10 is now mapped to explicit historical retirement and a new current replacement.

Before Batch B review-complete:

1. draft the current Spanish replacement text;
2. verify terminology for `as-published`, `recalculated history`, `vintage`, and `current research view`;
3. compliance-review the companion wording;
4. confirm the later Appendix B cross-reference;
5. reviewer sign-off.

Publication remains HOLD.
