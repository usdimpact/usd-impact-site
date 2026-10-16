# Spanish Edition 1.3 — Phase 2A Appendix A Glossary Audit

Status: **APPENDIX A AUDIT — PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773

## Scope

This file compares Candidate 2 `Appendix A — Quick Glossary` with the historical Spanish generic `Apéndice — Glosario rápido`.

The glossary must follow current English structure and Session 13E terminology authority. Historical entries are translation memory only.

## Structural treatment

### A-A-001 — Appendix designation

Candidate 2 uses:

`Appendix A — Quick Glossary`

Historical Spanish uses a generic `Apéndice`.

**Classification:** `STRUCTURE_REVISION_REQUIRED`

The Spanish candidate must label the glossary as Appendix A because current authority contains Appendix B.

### A-A-002 — “How to use this glossary”

**Classification:** `REVISE_REQUIRED`

Candidate 2 explicitly frames definitions as simplified working definitions for new investors and says high-friction terms are also defined at first use.

Historical Spanish is similar but requires sentence-level/native review.

### A-A-003 — “Why this appendix helps”

Candidate 2 contains a dedicated `Why this appendix helps` block.

Historical Spanish has no equivalent standalone block.

**Classification:** `NEW_TRANSLATION_REQUIRED`

## Direct term-set comparison

Candidate 2 and historical Spanish share most core glossary concepts across:

- dollar/macro;
- energy/commodities;
- cross-asset/FX;
- additional reference terms.

Every retained term still requires current definition comparison because wording, methodology and source scope can change even when the term name survives.

### Shared high-priority controlled terms

Use Session 13E terminology for at least:

- broad dollar;
- DXY;
- funding stress;
- real yields;
- risk-off;
- TIPS;
- WTI;
- OPEC+ / OPEP+ public-copy rule;
- carry;
- hedge;
- opportunity cost;
- safe-haven demand;
- translation risk;
- VIX.

No glossary definition may contradict the controlled terminology kit.

## Historical Spanish-only glossary entries

The historical Spanish Appendix contains entries that are not present in current Candidate 2 Appendix A.

Their absence from current Appendix A means they must not be carried forward automatically.

### A-A-004 — USD Impact Score

Historical Spanish contains a dedicated Score glossary entry with:

- moving-standard-deviation normalization;
- approximate three-standard-deviation clipping;
- fixed equal weights;
- five historical-regime performance testing;
- 84.5% aggregate hit rate;
- 100/100/100/79.7/73.2 regime figures;
- Friday 22:00 UTC recalculation claim.

Candidate 2 Appendix A contains **no Score glossary entry**.

Current Score authority is now:

- Chapter 10; and
- Appendix B.

**Classification:** `RETIRE_DO_NOT_REUSE`  
**Risk:** critical methodology/compliance

Deleting the obsolete performance claims from Chapter 10 is insufficient unless this glossary entry is also removed.

### A-A-005 — Brent

Historical Spanish glossary entry exists; Candidate 2 Appendix A does not contain a Brent entry.

**Classification:** `RETIRE_FROM_APPENDIX_A` unless a later governed English source reintroduces it.

This does not mean Brent is factually invalid elsewhere in the book; it means the historical glossary structure is not current authority.

### A-A-006 — Cushing

Historical Spanish glossary entry exists; Candidate 2 Appendix A does not contain a Cushing entry.

**Classification:** `RETIRE_FROM_APPENDIX_A` unless reintroduced by current English authority.

### A-A-007 — DTWEXBGS

Historical Spanish glossary entry exists; Candidate 2 Appendix A does not contain the FRED series code as a glossary entry.

**Classification:** `RETIRE_FROM_APPENDIX_A`

The code may still appear in sourced methodology or web evidence when relevant; do not infer glossary inclusion.

### A-A-008 — DFII10

Historical Spanish glossary entry exists; Candidate 2 Appendix A does not contain it.

**Classification:** `RETIRE_FROM_APPENDIX_A`

### A-A-009 — DHHNGSP

Historical Spanish glossary entry exists; Candidate 2 Appendix A does not contain it.

**Classification:** `RETIRE_FROM_APPENDIX_A`

## Candidate 2 glossary terms requiring fresh definition parity

The current Appendix A includes the following major current-English terms/categories and the Spanish candidate must compare each current definition rather than copying the old definition:

### Dollar and macro

- Broad dollar index
- DXY
- Funding stress
- Invoicing currency
- Liquidity
- Pass-through
- Real yields
- Reserve currency
- Risk-off
- Term premium
- Bretton Woods
- BIS
- COFER
- TIPS
- Duration
- USDX

### Energy and commodities

- Backwardation
- Benchmark
- Contango
- Front month
- Henry Hub
- LNG
- OPEC+
- Spare capacity
- Spot price
- TTF
- WTI
- JKM
- NYMEX
- OVX

### Cross-asset and FX

- Carry
- Correlation
- Hedge
- Opportunity cost
- Safe-haven demand
- Translation risk
- Volatility
- Carry trade
- ETF
- MXN
- VIX

### Additional reference terms

- Basis point
- Beta
- EIA
- Federal Reserve
- Hurdle rate
- IMF
- Treasury bill
- CFTC
- CME
- FRED

These are `UNIT_AUDIT_REQUIRED` until each current definition is compared against the historical Spanish definition and Session 13E term control.

## Important lexical controls

Historical Spanish uses several finance-native or legacy forms that must be checked against the current terminology kit rather than preserved by inertia.

Examples:

- `índice de dólar amplio` vs the controlled `dólar amplio` concept;
- `tasas reales` vs `rendimientos reales / tasas reales` by context;
- `precio de referencia` for benchmark;
- `riesgo de conversión` for translation risk;
- `OPEP+` is acceptable Spanish public copy under Session 13E;
- tickers/benchmarks remain locked where the terminology kit says so.

## Appendix A release gate

Appendix A cannot pass until:

1. all current Candidate 2 entries have current-definition parity decisions;
2. the historical Score entry is removed;
3. all historical-only non-current entries are removed unless explicitly reintroduced by governed English authority;
4. Session 13E controlled terms are applied;
5. Candidate 2’s new `Why this appendix helps` block is translated;
6. native-reader QA passes;
7. glossary page references/index entries are regenerated after layout.

Publication remains HOLD.
