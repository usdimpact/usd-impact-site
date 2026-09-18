# USD Impact SEO Authority Assets — Reuse-First Implementation Plan

Status: planning only  
Governing issue: #658  
Related: #569, #570, #629, #657  
Base at preparation: `0e87f30136520eda876ab3a169a21032bd1dab71`

This packet defines how to turn existing governed USD Impact content into citation-grade public reference assets without creating competing pages, weakening compliance boundaries, or changing Production before the Search Console observation gate clears.

## Operating rules

1. Reuse existing canonical public routes before creating any new URL.
2. Add evidence/reference value, not promotional copy.
3. Primary-source mapping must be explicit and reviewable.
4. Every factual table must distinguish sourced facts from USD Impact interpretation.
5. No ranking, performance, investment-return, or trading-outcome claims.
6. No outreach is authorized by this document.
7. No implementation is authorized while #569 remains open unless separately approved.
8. Any downloadable data must respect source licensing and redistribution terms.

---

## Asset A — DXY vs Broad USD reference

### Canonical route

`/dxy/dxy-vs-broad-usd`

Existing source:
`apps/web/src/content/pages/dxy-vs-broad-usd.md`

### Why this route is the authority candidate

The existing lesson already contains:
- DXY vs Federal Reserve Broad USD definitions;
- a side-by-side benchmark table;
- agreement/divergence interpretation;
- nominal-vs-real measure distinctions;
- benchmark decision tree;
- compliance-safe scope language;
- direct links to the wider Dollar Transmission Chain.

Creating another “DXY vs Broad USD” page would split authority and risk keyword cannibalization.

### Existing governed sources

- Federal Reserve — H.10 Foreign Exchange Rates and Dollar Indexes
- Federal Reserve — Revisions to the Federal Reserve Dollar Indexes
- ICE — U.S. Dollar Index methodology/composition

Additional reviewed Learn-source implementation already uses:
- ICE U.S. Dollar Index product/basket reference
- Federal Reserve 2019 dollar-index methodology note
- Federal Reserve H.10 nominal/real dollar-index summary

### Proposed authority enhancement

Add a bounded “Reference methodology” section to the existing canonical route, not a new page.

Candidate fields:

| Field | DXY | Federal Reserve Broad USD |
| --- | --- | --- |
| Publisher / administrator | ICE | Federal Reserve Board |
| Benchmark purpose | fixed-basket market index | trade-weighted analytical dollar index |
| Currency scope | six fixed currencies | broad trading-partner set |
| Weight concept | fixed index weights | trade-based weights revised over time |
| Primary use in USD Impact | fast market signal | breadth confirmation |
| Key limitation | basket concentration, especially EUR | less immediate market visibility |
| Source reference | reviewed ICE methodology/product source | reviewed Federal Reserve methodology/H.10 source |

Do not reproduce proprietary current weights or data values unless source/licensing review permits it.

### Optional public reference file

Only if licensing review permits:
- machine-readable methodology summary generated from USD Impact-authored fields;
- no copied proprietary data series;
- version/date metadata;
- source URLs and access date;
- stable path such as `/data/research/dxy-vs-broad-usd-methodology.json`.

### Link-worthiness hypothesis

Semrush evidence shows high-authority editorial and research pages link to specific charts, datasets, methodology notes and factual reference pages. A stable benchmark-comparison reference is more likely to be cited than a generic explanatory article.

### Release gate

Hold implementation until:
- #569 observation clears;
- current DXY title/canonical consolidation is stable;
- source/licensing review passes;
- no duplicate route is introduced.

---

## Asset B — Real Yield / TIPS reference

### Canonical route

`/learn/real-yield`

Renderer:
`apps/web/src/pages/learn/[slug].astro`

Governed source object:
`card-real-yield` in `apps/web/src/data/daily-cards.js`

### Existing governed definition

The current card defines real yield as a yield adjusted for inflation expectations or inflation compensation depending on the measure, and identifies the U.S. 10-year TIPS yield as a common market-based reference.

### Existing primary references

`apps/web/src/lib/learn-source-links.mjs` already allowlists:

1. Federal Reserve — TIPS yields and inflation compensation
   - scope explicitly notes the series is revisable research data rather than an official statistical release;
2. TreasuryDirect — TIPS mechanics
   - scope distinguishes fixed interest rates / inflation-adjusted principal from realized secondary-market return.

These references already have security and rendered-output regression tests.

### Proposed authority enhancement

Do not replace the Learn card with a new “real yield” article.

Instead, extend the existing route with a compact “Reference framework” section that distinguishes:

| Concept | Definition / role |
| --- | --- |
| Nominal Treasury yield | yield before inflation adjustment |
| TIPS real yield | market-based real yield on inflation-protected Treasury securities |
| Inflation compensation / breakeven | nominal-vs-real yield relationship; not identical to a forecast of realized CPI |
| Ex-post real return | realized nominal return adjusted by realized inflation; different from market-implied real yield |

Required caveat:
“Real yield” is not one universal series. The measure must be named before drawing a conclusion.

### Candidate source-backed fields

- source institution;
- exact series/reference type;
- maturity where relevant;
- update/revision note;
- interpretation boundary;
- USD Impact use case;
- last reviewed date.

### Link-worthiness hypothesis

Academic/editorial backlink evidence shows external pages cite precise data-series and methodology references. A concise, source-transparent Real Yield reference can become useful for educators, journalists and research notes without making investment claims.

### Release gate

Hold implementation until:
- #569 clears;
- the existing Real Yield Search Console baseline is stable enough to avoid confounding;
- source wording remains consistent with the allowlisted references;
- no new canonical page is created.

---

## Asset C — Dollar Transmission Chain reference

### Canonical route

`/framework/dollar-transmission-chain`

Existing source:
`apps/web/src/content/frameworks/framework-dollar-transmission-chain.md`

### Current strengths

The page already provides:
- macro/policy → rates → dollar/funding → liquidity/risk → cross-asset sequence;
- explicit reverse-transmission caveat;
- rate-led vs liquidity-stress worked examples;
- asset-specific boundaries;
- primary-source institutional categories;
- public visual asset.

### Proposed authority enhancement

Prefer a versioned reference block over creating another framework page.

Candidate additions:
- “framework version” and last-reviewed date;
- concise stage dictionary;
- evidence-class table (Fed/Treasury/BIS/FRED);
- explicit “what would falsify this interpretation?” field;
- stable visual filename/version where practical;
- optional downloadable framework legend authored by USD Impact.

Do not present the framework as a forecasting model or validated causal estimator.

---

## Asset D — Open technical companion

Create only if a reusable artifact exists.

Eligible examples:
- reproducible DXY-vs-broad-USD comparison notebook using source-permitted data;
- source-mapped macro release calendar schema;
- methodology validator for Dollar Transmission Chain evidence tagging;
- public data dictionary for USD Impact reference assets.

A repository created only to obtain links is out of scope.

---

## Prospect-to-asset mapping

| Prospect class | Suitable USD Impact asset | Evidence pattern |
| --- | --- | --- |
| GitHub / open tooling | Asset D, possibly A | comparable sites receive links from data/tool repositories to APIs, series and methodology |
| Finance editorial | Asset A, B, C | citations tend to support a specific factual statement/chart |
| Academic/reference | Asset B, selected A/C | citations favor exact series, data definitions and methodology |
| Medium/Substack research | A, B, C | contextual explanatory citations to reusable data/reference pages |
| Wikipedia/Wikimedia | none as an outreach target | independent citation only; no promotional editing |

---

## Measurement plan

Before implementation:
- record GSC impressions/clicks/average position for the exact canonical routes;
- record referring-domain baseline;
- record Semrush Position Tracking terms associated with DXY and Real Yield.

After implementation:
- 7-day check is observational only;
- 14–28 day window for indexing/visibility comparison;
- new referring links must be manually classified as legitimate, neutral or low quality;
- no causality claim from ranking changes.

---

## Explicit non-goals

This packet does not authorize:
- new competing DXY or Real Yield pages;
- keyword stuffing;
- paid links;
- link exchanges;
- bulk directory submissions;
- Wikipedia promotion;
- guest-post purchasing;
- disavow actions;
- canonical changes;
- title/meta changes while #569 is open;
- Production merge or deployment.

## Recommended implementation order after #569

1. DXY reference methodology block on existing canonical lesson.
2. Real Yield reference framework on existing Learn route.
3. Dollar Transmission Chain version/evidence reference block.
4. Only then evaluate whether an open technical companion has enough genuine utility to publish.
