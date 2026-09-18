# DXY / Broad USD SEO Preimplementation Packet — refreshed 2026-09-18

Status: planning-only candidate under #570. HOLD IMPLEMENTATION while #569 remains open. This packet does not authorize a merge, Production deployment, title/meta change, canonical/indexing/sitemap change, redirect, page consolidation, or new page.

## Evidence window

Google Search Console is now settled through 2026-09-15; 2026-09-16 is the first incomplete date. The first fully settled seven-day post-#568 observation window is therefore still unavailable, so #569 remains the implementation gate.

### Existing page roles and settled query evidence

1. `/learn/dxy-vs-broad-usd-what-each-index-answers`
   - Existing role: benchmark-selection explainer comparing DXY with the Federal Reserve Broad Dollar Index.
   - Existing title/H1: `DXY vs Broad USD: What Each Index Is Designed to Answer`.
   - Source definition already distinguishes DXY's fixed six-currency, euro-heavy basket from the wider trade-weighted Broad USD measure and states that neither is universally superior.
   - Settled page-query evidence includes the precise comparison query `what is the difference between the trade-weighted dollar index and the dxy, and which is more relevant for investors?` at 2 impressions and average position 4; `broad dollar index` at 1 impression / position 24; `a basket of currencies` at 1 impression / position 31.
   - Page-level 28-day baseline previously recorded under #570: 22 impressions / average position 13.18.

2. `/learn/dollar-index-points-do-not-equal-uniform-currency-moves`
   - Existing role: interpretation/scope explainer warning that an index move does not imply uniform bilateral currency moves.
   - Settled query evidence through 2026-09-15: `currency index` 16 impressions / position 30.63; `currency indexes` 13 / 34.92 on the canonical URL, with only 2 residual impressions on the historical trailing-slash variant. Broader dollar-index terms remain lower.
   - Page-level 28-day baseline previously recorded under #570: 55 impressions / average position 33.27.

3. `/learn/dxy-signal-vs-dollar-system`
   - Existing role: separates the market-price signal in DXY from the broader dollar system.
   - Settled query evidence is currently sparse: `a basket of currencies` 1 impression / position 74.
   - Page-level 28-day baseline previously recorded under #570: 13 impressions / average position 25.46.

## Cannibalization assessment

Current absolute overlap is too small to justify consolidation, deletion, redirects, or a new generic currency-index page.

- `a basket of currencies`: 2 total impressions split between the DXY-vs-Broad page and DXY-signal-vs-system page.
- `broad dollar index`: 2 total impressions split between the DXY-vs-Broad page and `why-dxy-and-broad-usd-divergence-matters`.

The observed overlap is a monitoring signal, not evidence of harmful cannibalization. Historical slash/non-slash duplication remains visible elsewhere in GSC while #569 is still observing canonical consolidation, so page-architecture decisions should not be made from this window alone.

## Recommended page-role contract

Preserve the existing architecture. Do not create a generic `currency index`, `dollar index`, or duplicate `what is DXY vs Broad USD` page at this stage.

- **DXY vs Broad USD** owns comparison/benchmark-selection intent: what each index measures, trade-weighted vs fixed basket, which benchmark answers which question.
- **Dollar index points do not equal uniform currency moves** owns index-interpretation intent: why index points are not equivalent to uniform bilateral FX moves and why basket construction matters.
- **DXY signal vs dollar system** owns structural/system intent: why DXY is a market signal but not the complete global dollar/funding system.

## Candidate strengthening after #569 clears

### A. DXY vs Broad USD comparison page — P1

The current title already matches the strongest observed intent and the page is ranking near the top for a highly specific comparison query. Avoid a broad rewrite.

Candidate search-title test, only if settled CTR/position evidence later supports it:

`DXY vs Broad Dollar Index: What Each Measures | USD Impact`

Candidate meta-description test:

`Compare DXY with the Federal Reserve Broad Dollar Index: basket construction, trade weighting, euro concentration, and which dollar benchmark fits the question.`

Keep the visible H1 and educational body stable for the first metadata test unless later evidence shows a content gap.

### B. Dollar-index-points page — P1/P2

The page is already receiving broader `currency index/indexes/indices` discovery but ranks around positions 31–35. Strengthen semantic clarity without trying to make it a generic index encyclopedia.

Candidate search-title test:

`Currency Index Moves vs Bilateral FX: Why the Difference Matters | USD Impact`

Candidate meta-description test:

`Learn why a currency-index move does not mean every bilateral exchange rate moved equally, and how basket weights change the signal from DXY and other indexes.`

Preserve the page's existing interpretation/scope role. Do not retarget it to own the DXY-vs-Broad comparison query.

### C. DXY signal vs dollar system — observe

Current settled search evidence is too sparse for a metadata rewrite. Keep the page stable and improve its contextual authority first. Reassess after #569 and after stronger internal links have had a settled observation window.

## Internal authority plan

Use contextual links rather than creating new pages:

- From the DXY-vs-Broad comparison page, link naturally to the index-points page when explaining basket construction/index interpretation and to DXY-signal-vs-system when distinguishing a benchmark from the broader dollar system.
- From the index-points page, link back to DXY-vs-Broad for benchmark selection.
- From DXY-signal-vs-system, link to DXY-vs-Broad where the reader needs the narrower benchmark comparison.
- Preserve existing related-card relationships and avoid mechanically adding duplicate links where the relationship is already represented.
- Future relevant live reports/catalyst/daily pages may link to the comparison explainer when the article explicitly relies on DXY-vs-Broad divergence; do not add sitewide boilerplate links.

## Release gate

No source implementation should begin until all of the following are true:

1. #569's canonical/noindex observation gate is explicitly cleared using settled post-release GSC evidence.
2. The target page's latest settled query/page data is re-run immediately before implementation.
3. No material new cannibalization signal appears.
4. Exact current `main` is captured before any source branch is created.
5. Each implementation remains narrow and separately reviewable.

Suggested order after the gate clears:

1. Merge/release already prepared #626 BLS archive handoff if still valid against current main.
2. Merge/release #627 Real Yield search-title work if still valid and exact-head checks remain clean.
3. Re-query settled GSC.
4. Prepare the DXY-vs-Broad comparison metadata increment first.
5. Measure before deciding whether to change the index-points metadata.
6. Keep DXY-signal-vs-system in OBSERVE unless new query evidence supports a targeted change.

## Refresh checkpoint — 2026-09-18

- Current implementation base: `a67320ac9d0a564d7b05fd8bf02c8cd486031a91`.
- Current settled GSC through: **2026-09-15**.
- Master Keyword-to-Page Map v1 in #570 still classifies this cluster as **STRENGTHEN_EXISTING / NO NEW PAGE**.
- #569 remains open, so this packet is prepared only; no source implementation is authorized by this document.

## Classification

`REFRESHED / STRENGTHEN_EXISTING / NO NEW PAGE / HOLD IMPLEMENTATION BY #569 / PRODUCTION UNCHANGED`
