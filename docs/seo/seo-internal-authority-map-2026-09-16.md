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

Search Console is settled through **2026-09-15**. Semrush Site Audit snapshot `6aad41bad29f71103c475252` still predates the #663 canonical shared-navigation release, so issue 213 remains a **pre-#663 candidate set**, not a post-release defect list.

Current issue-213 count: **112 pages**. Legal, utility, feed and authentication surfaces remain excluded from artificial authority work.

### Current GSC intersection — 2026-08-19 through 2026-09-15

| Learn target | Clicks | Impressions | Avg. position | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `/learn/real-yield` | 0 | 61 | 27.11 | strongest impression volume; canonical URL directly URL-Inspection PASS |
| `/learn/dxy-vs-broad-usd-what-each-index-answers` | 1 | 25 | 11.92 | only click in the underlinked Learn candidate set; strong comparison intent |
| `/learn/dollar-index-points-do-not-equal-uniform-currency-moves` | 0 | 55 | 33.27 | meaningful impressions, but keep separate from DXY/Broad comparison intent |
| `/learn/smithsonian-agreement-interim-repair` | 0 | 16 | 18.63 | useful history chain, lower immediate priority |
| `/learn/treasury-coupon-rate-is-not-yield-to-maturity` | 0 | 11 | 24.91 | natural reciprocal Treasury-mechanics relationship |
| `/learn/treasury-prices-and-yields-move-in-opposite-directions` | 0 | 16 | 48.69 | contextually strong but weaker current search position |
| `/learn/wti-backwardation-vs-contango` | 0 | 13 | 36.31 | oil-structure candidate after higher-confidence dollar/rates tests |
| `/learn/why-oil-inventories-matter` | 0 | 11 | 46.55 | oil-physical-balance candidate after higher-confidence dollar/rates tests |
| `/learn/floating-rates-before-jamaica-formalization` | 0 | 7 | 12.43 | history-chain candidate; low volume |
| `/learn/tips-adjust-principal-with-inflation-not-the-coupon-rate` | 0 | 7 | 35.29 | semantically strong source for Real Yield rather than a first target itself |

The Master Keyword-to-Page Map v1 therefore continues to support **Real Yield** and **DXY/Broad USD** as the first authority experiments once the observation hold clears. Dollar Index Points remains a distinct follow-on target; do not consolidate these page roles.

### Prebuilt source → target pairs for the first bounded increment

These pairs are already supported by explicit `relatedCardIds` relationships in the production card graph. They are candidates only; verify they are still missing or underrepresented in the first post-#663 Semrush crawl before adding anything.

**Real Yield target — `/learn/real-yield`**

1. `/learn/dollar-yields-liquidity-three-dials` → Real Yield  
   - existing graph: `card-dollar-yields-liquidity` explicitly relates to `card-real-yield`
   - contextual anchor family: `real yields`, `real-yield signal`

2. `/learn/gold-dollar-vs-real-yields` → Real Yield  
   - existing graph: `card-gold-real-yields` explicitly relates to `card-real-yield`
   - contextual anchor family: `real yields`, `what real yield means`

3. `/learn/tips-adjust-principal-with-inflation-not-the-coupon-rate` → Real Yield  
   - existing graph: `card-tips-principal-inflation-adjustment` explicitly relates to `card-real-yield`
   - contextual anchor family: `market real yield`, `TIPS real yield`
   - preserve the distinction between TIPS cash-flow mechanics and market real yield

**DXY vs Broad USD target — `/learn/dxy-vs-broad-usd-what-each-index-answers`**

1. `/learn/why-the-euro-matters-in-dxy` → DXY vs Broad USD  
   - existing graph: `card-dxy-euro-weight` explicitly relates to `card-dxy-broad-purpose`
   - contextual anchor family: `compare DXY with Broad USD`, `broader dollar benchmark`

2. `/learn/why-dxy-and-broad-usd-agreement-matters` → DXY vs Broad USD  
   - existing graph: `card-dxy-broad-agreement` explicitly relates to `card-dxy-broad-purpose`
   - contextual anchor family: `DXY and Broad USD`, `benchmark breadth`

3. `/learn/why-dxy-and-broad-usd-divergence-matters` → DXY vs Broad USD  
   - existing graph: divergence card explicitly relates to `card-dxy-broad-purpose`
   - contextual anchor family: `DXY vs Broad USD`, `benchmark divergence`

Do **not** automatically add all six links. The first post-#663 audit must be used to confirm which inbound links Semrush is actually discovering and which candidate relationships are genuinely absent.

Current target base after branch reconciliation: `a68fda7de98096edecbf9c7aa8eb04e03eb5d38c`. No public link changes should begin while #569 remains open.

## 5. Implementation order after #569

1. Obtain the first Semrush Site Audit snapshot completed after #663 Production deployment and re-check issue 213.
2. Intersect the remaining issue-213 Learn URLs with settled GSC.
3. Revalidate #626 BLS archive handoff separately; do not bundle it with evergreen authority changes.
4. Revalidate #627 Real Yield search-title increment separately so title and internal-link effects remain measurable.
5. For the first authority test, choose **one target** and add only **1–3** missing contextual inbound links from the prebuilt pairs above.
6. Wait for settled Search Console data before expanding to the second target.
7. Keep catalyst evergreen-link additions separate from metadata and evergreen-link experiments.

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
