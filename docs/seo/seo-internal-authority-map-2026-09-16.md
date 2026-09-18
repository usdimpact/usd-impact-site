# SEO Internal Authority Map — refreshed 2026-09-18

Status: planning only. No public links, metadata, canonicals, indexing controls, sitemap entries, redirects, or deployments are changed by this document.

## Live audit baseline

The following priority pages were audited live on 2026-09-16:

- `/learn/real-yield`
- `/learn/dxy-vs-broad-usd-what-each-index-answers`
- `/learn/dollar-index-points-do-not-equal-uniform-currency-moves`
- Sep. 4 BLS Employment Situation preview
- Sep. 4 BLS Employment Situation verified outcome
- Aug. 26 BEA Personal Income/PCE + Q2 GDP preview

All six returned HTTP 200, were indexable, self-canonical, had one H1, and had no critical/high/medium audit issues. This means the next SEO lever can focus on authority flow and intent alignment rather than repairing page availability or indexability.

## 1. Real Yield — inbound authority targets

Canonical target:
`/learn/real-yield`

Current evidence supports beginner-definition intent, especially `what is real yield` variants. Existing card relationships already establish semantic adjacency across the site.

### High-confidence inbound link sources

1. Dollar / Yields / Liquidity — Three Dials
   - Reason: explicitly relates the dollar, yields, liquidity and asset transmission.
   - Anchor family: `real yields`, `what real yield means`, `real-yield signal`.

2. TIPS mechanics pages
   - Reason: TIPS are the market instrument used by the current Real Yield page to explain market-based real yields.
   - Anchor family: `TIPS real yield`, `real yield`, `inflation-adjusted yield`.

3. Gold vs Real Yields
   - Reason: already semantically paired with Real Yield in catalog relationships.
   - Anchor family: `real yields`, `real-yield channel`.

4. Inflation expectations / market-pricing cards
   - Reason: distinguishes realized CPI from inflation compensation and market pricing.
   - Anchor family: `real yields and inflation expectations`, `real yield`.

5. Equity valuation / real-rate cards
   - Reason: connects real rates to discount-rate and valuation mechanics.
   - Anchor family: `real rates`, `real yields`.

### Rules

- Do not force an exact-match anchor repeatedly.
- Prefer one contextual link per source page where the concept is actually discussed.
- Do not create a second `What Is Real Yield?` URL.
- Preserve the existing concise H1; search-title work remains isolated in PR #627.

## 2. DXY vs Broad USD — inbound authority targets

Canonical comparison target:
`/learn/dxy-vs-broad-usd-what-each-index-answers`

The source card already defines the intended role: DXY is a fixed six-currency, euro-heavy basket; Broad USD is a wider trade-weighted measure. The choice depends on the question/exposure.

### High-confidence inbound link sources

1. DXY Signal vs Dollar System
   - Anchor family: `DXY vs broader dollar measures`, `DXY and Broad USD`.

2. Why the Euro Matters in DXY
   - Anchor family: `compare DXY with Broad USD`, `broader dollar benchmark`.

3. DXY/Broad USD agreement or divergence cards
   - Anchor family: `DXY vs Broad USD`, `benchmark breadth`.

4. Regime benchmark-selection cards
   - Anchor family: `choose the right dollar benchmark`, `DXY or Broad USD`.

5. Dollar-index-points scope page
   - Anchor family: `index construction and benchmark scope`, `DXY versus broader measures`.

6. USD glossary / structural-dollar pages
   - Anchor family: `DXY is one dollar measure`, `broader dollar measures`.

### Page-role boundaries

- Comparison intent → `/learn/dxy-vs-broad-usd-what-each-index-answers`.
- DXY construction/index-point mechanics → `/learn/dollar-index-points-do-not-equal-uniform-currency-moves` and DXY basket pages.
- Dollar-system/structural role → existing USD/DXY system pages.
- Do not merge or redirect these roles based on the current very low-volume overlap.

## 3. BLS Employment preview → outcome authority handoff

Preview:
`/news/catalysts/2026-09-04-bls-employment-situation-august-2026-scheduled-release-preview`

Outcome:
`/news/catalysts/2026-09-04-bls-employment-situation-for-august-2026-released-outcome`

The first implementation remains PR #626: add the governed archive handoff from preview to outcome. No additional broad internal-link edits are required before that is released and measured.

After release, consider contextual links from the outcome to evergreen explainers only when they genuinely help interpret:

- payrolls / Employment Situation;
- unemployment rate;
- wage growth / average hourly earnings;
- revisions and labor-data breadth.

Do not convert the outcome into an SEO hub or overload it with generic Learn links.

## 4. BEA PCE/GDP preview authority handoff

The Aug. 26 preview already has an archive/result handoff and does not need the same structural repair as BLS.

Potential evergreen interpretation links, only after the current canonical observation period:

- PCE inflation / inflation-measure explainer;
- GDP release/estimate mechanics;
- inflation expectations / real-yield transmission where contextually present.

Preserve the historical preview role and official release terminology.

## Refresh checkpoint — 2026-09-18

Search Console is settled through **2026-09-15**. The Master Keyword-to-Page Map v1 continues to support the same authority priorities: Real Yield, DXY/Broad USD, and bounded catalyst preview→outcome handoffs. Current implementation base is `a67320ac9d0a564d7b05fd8bf02c8cd486031a91`. No public link changes should begin while #569 remains open.

## 5. Implementation order after #569

1. Merge/release #626 BLS archive handoff after exact-head revalidation.
2. Merge/release #627 Real Yield search-title increment after exact-head revalidation.
3. Add a small Real Yield inbound-link increment from 3-5 highest-context sources; measure before wider rollout.
4. Re-query DXY/Broad USD GSC data and implement only the strongest 3-5 contextual inbound links.
5. Keep catalyst evergreen-link additions separate from metadata tests so impact remains measurable.

## Measurement

For every released increment:

- capture exact merge/deploy date;
- wait for settled Search Console data;
- compare canonical page impressions, clicks, CTR and average position;
- inspect query/page cannibalization before expanding the link graph;
- do not infer causality from a single-day move.

## Stop conditions

- #569 remains the gate for public SEO source changes.
- No bulk sitewide exact-match anchor insertion.
- No new duplicate evergreen pages.
- No redirect/consolidation decision from tiny-volume query overlap.
- No simultaneous metadata + large internal-link rollout on the same target if measurement can be separated.
