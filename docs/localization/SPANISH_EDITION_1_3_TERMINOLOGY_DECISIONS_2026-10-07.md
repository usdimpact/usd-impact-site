# Spanish Edition 1.3 — controlled terminology decisions

Status: **CONSTRUCTION PHASE — RELEASE HOLD**  
Decision date: 2026-10-07  
English authority: Candidate 2 / `v5.95-candidate.2`  
Spanish Candidate 1 working source: Google Doc `16rFyUWOvgHt5r7Axp52K56zUQzhhLWOVgGCRymChCWk`

## Core rule

Terminology changes are semantic, not global string replacements.

A Spanish term may be replaced only where the English source concept matches the controlled term. Identical Spanish surface wording used for a different English concept must remain untouched.

## Decision T-01 — hurdle rate

English concept: `hurdle rate`

Approved Spanish release term:

**rentabilidad mínima exigida**

Use `umbral de rentabilidad exigida` only where sentence grammar requires a noun phrase describing the threshold itself.

Do **not** use `tasa de descuento` for `hurdle rate`.

### Rationale

`Hurdle rate` is the minimum required return or threshold return used to compare an investment or position with the next-best alternative.

`Tasa de descuento` is a different financial concept: a rate used to discount future cash flows or as a policy/valuation discount rate.

Conflating the two changes meaning.

### Required application

Apply this decision to the Candidate 2 `hurdle rate` concept in:

- Chapter 7;
- Chapter 11;
- Chapter 13;
- Appendix A;
- related tables/captions/audio/lesson copy derived from those units.

### Explicit non-application

Do **not** automatically replace every historical occurrence of `tasa de descuento`.

For example, the front/introductory explanation that real rates can function as a discount rate for non-cash-flow assets is a legitimate discount-rate usage and remains conceptually distinct.

## Decision T-02 — Score name

Keep the product name **USD Impact Score** untranslated.

Translate surrounding descriptive language, but do not rename the product.

## Decision T-03 — DXY / USDX

Keep `DXY` and `USDX` as identifiers.

Do not localize the identifiers.

## Decision T-04 — WTI / TTF / JKM / VIX / OVX / FRED / BIS / IMF / EIA / CFTC / CME

Keep institutional/benchmark/ticker identifiers unchanged.

Translate explanatory definitions only.

## Decision T-05 — risk-off

Default book term: **risk-off**.

At first pedagogical use in a self-contained section, explanatory Spanish such as `entorno de aversión al riesgo` may follow in prose, but the glossary identifier remains `Risk-off`.

## Decision T-06 — carry / carry trade

Keep `carry` and `carry trade` as established market terms, with Spanish explanation where needed.

Do not force literal replacements that reduce recognizability for market readers.

## Decision T-07 — pass-through

Controlled glossary term remains **traspaso a precios**.

In prose, `transmisión a precios` is acceptable where it better fits grammar, provided the economic meaning remains pass-through rather than generic transmission.

## Decision T-08 — spare capacity

Controlled term: **capacidad ociosa**.

## Decision T-09 — safe-haven demand

Controlled term: **demanda de refugio**.

## Decision T-10 — translation risk

Controlled term: **riesgo de conversión** when referring to portfolio/currency translation effects.

Do not use this term for linguistic translation.

## Immutable methodology terms

The following remain unchanged under localization:

- variable identifiers: `DXY`, `WTI`, `SPX`, `VIX`, `BTC`, `GOLD`, `UST2Y`, `UST10Y`;
- weights and signs;
- formula operators;
- regime thresholds;
- clipping threshold;
- governed URLs;
- authority hashes.

## QA rule

Before Candidate 1 can advance:

1. search the assembled Spanish manuscript for every controlled term;
2. compare each occurrence to its English source concept;
3. reject mechanical replacements that cross semantic boundaries;
4. verify glossary/chapter/table/audio terminology consistency.

Publication remains **HOLD**.
