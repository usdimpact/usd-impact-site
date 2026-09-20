# SEO Internal Authority Map — refreshed 2026-09-20

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

Search Console remains settled through **2026-09-15**. The first completed post-#663 Semrush crawl is now available:

- snapshot: `6aad8ad9aa87d28497347354`
- completed: **2026-09-18 19:11:33Z**
- pages crawled: **463**
- issue 213: **112 → 101 pages**
- issue 214: **3,209 → 1,338 permanent-redirect link instances**
- exact #663 shared-route target set: **2,159 → 283 (-86.9%)**

Legal, utility, feed and authentication surfaces remain excluded from artificial authority work.

### Current GSC × Semrush intersection — 2026-08-19 through 2026-09-15

The fresh issue-213 set intersects **70** current GSC page rows, including **59 Learn pages**.

| Learn target | Clicks | Impressions | Avg. position | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `/learn/dxy-vs-broad-usd-what-each-index-answers` | 1 | 25 | 11.92 | strongest current underlinked comparison target; one click plus page-two visibility |
| `/learn/dollar-index-points-do-not-equal-uniform-currency-moves` | 0 | 55 | 33.27 | largest impression count among the remaining underlinked dollar-index targets; keep separate from comparison intent |
| `/learn/imf-role-in-bretton-woods` | 0 | 37 | 75.03 | higher volume but weak position; history-chain candidate, not first authority test |
| `/learn/smithsonian-agreement-interim-repair` | 0 | 16 | 18.63 | useful history chain; lower immediate priority than DXY/Broad |
| `/learn/treasury-coupon-rate-is-not-yield-to-maturity` | 0 | 11 | 24.91 | natural reciprocal Treasury-mechanics relationship |
| `/learn/wti-backwardation-vs-contango` | 0 | 13 | 36.31 | oil-structure candidate after the dollar tests |
| `/learn/why-oil-inventories-matter` | 0 | 11 | 46.55 | oil-physical-balance candidate after the dollar tests |
| `/learn/floating-rates-before-jamaica-formalization` | 0 | 7 | 12.43 | low-volume history-chain candidate |

### Real Yield classification changed

`/learn/real-yield` still has **61 canonical no-slash impressions** in the same GSC window and remains directly URL-Inspection PASS, but it is **no longer present in Semrush issue 213** after the post-#663 crawl.

Therefore:

- do **not** add new Real Yield inbound links merely to clear issue 213;
- keep PR #627's Real Yield search-title experiment separate from internal-authority work;
- retain the Real Yield source-pair research above only as a semantic map / future editorial reference, not as the first authority implementation.

The first internal-authority experiment should now be **DXY vs Broad USD**, not Real Yield. Dollar Index Points is the second candidate if the first experiment is released and measured cleanly.

### Prebuilt source → target pairs for the first bounded increment

These are planning candidates only. Confirm the selected source does not already expose an equivalent contextual link at implementation time.

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

**Dollar Index Points follow-on — `/learn/dollar-index-points-do-not-equal-uniform-currency-moves`**

1. `/learn/dxy-vs-broad-usd-what-each-index-answers` → Dollar Index Points  
   - target card explicitly relates to `card-dxy-broad-purpose`
   - contextual anchor family: `index construction`, `what an index-point move means`

2. `/learn/choose-the-dollar-benchmark-before-a-regime-call` → Dollar Index Points  
   - reviewed resolution explicitly pairs `card-regime-benchmark-selection` with `card-dollar-index-points-scope`
   - contextual anchor family: `benchmark construction and scope`, `interpret the index inside its basket`

3. `/learn/six-errors-that-break-a-dollar-explanation` → Dollar Index Points  
   - reviewed resolution explicitly groups the diagnostic-error concept with `card-dollar-index-points-scope`
   - contextual anchor family: `index scope`, `do not generalize an index move to every bilateral rate`

Do **not** add links to both targets in one release. The first experiment remains one target with **1–3** contextual inbound links.

### Residual canonical-link work is separate

Post-#663 issue 214 still includes a concentrated set of slash-form links to `/start-here/`, `/framework/dollar-transmission-chain/`, `/news/`, `/score/`, and `/reports/`. Most of those instances come from Daily/Report surfaces and a small number of reusable content/components.

That cleanup should remain a **separate canonical-link PR**, not be mixed into the authority experiment, so redirect reduction and authority-flow measurement remain distinguishable.

Current implementation hold: no public link changes while #569 remains open.

## Settled 7-day post-release checkpoint — 2026-09-20

Search Console is now settled through **2026-09-18**. The first complete post-release observation window used here is **2026-09-11 through 2026-09-17**.

Property-level observations for that 7-day window:
- clicks: **4**
- impressions: **1,399**
- CTR: **0.286%**
- average position: **8.27**

These totals remain heavily influenced by event-driven CPI/BLS queries and should not be treated as causal evidence for any individual SEO release.

### Canonical/no-slash evidence

Representative Learn rows:
- `/learn/dxy-vs-broad-usd-what-each-index-answers`: **1 click / 4 impressions / avg position 3.25**
- `/learn/dollar-index-points-do-not-equal-uniform-currency-moves`: **0 / 5 / 35.20**
- `/learn/real-yield`: **0 / 18 / 32.11**
- `/learn/real-yield/`: **0 / 1 / 11.00**

Fresh Google URL Inspection for Real Yield:
- no-slash canonical: **PASS / Submitted and indexed**
- slash form: **NEUTRAL / Page with redirect**
- both last crawled **2026-09-11 08:38:31Z**

This is positive evidence that Google recognizes the slash form as a redirect and the no-slash URL as the indexed destination. Residual low-volume slash impressions should not be interpreted as current canonical failure.

### Utility-page hold remains

The observed sign-in URL `/account/sign-in?next=%2Fguided-edition%2F` still received **3 impressions / 1 click** in the same 7-day window.

URL Inspection still reports it as submitted/indexed, but its last crawl was **2026-09-10 00:33:54Z**, before the remediation had time to propagate. Do not classify this as Google ignoring the current noindex policy until a post-remediation crawl is observed.

### BLS preview/outcome split

For the September 4 Employment Situation pair:
- preview: **24 impressions / avg position 7.46**
- released outcome: **154 impressions / avg position 9.10**

Both remain indexed. The outcome now receives materially more impressions than the preview. This keeps the prepared preview→outcome archive handoff (#626) plausible, but does not override its explicit hold while #569 remains open.

### Authority-map implication

The current first authority-test ordering remains unchanged:
1. **DXY vs Broad USD**
2. **Dollar Index Points**

Real Yield stays out of the first internal-link experiment because it is no longer in Semrush issue 213 and its slash/canonical behavior is now positively confirmed by URL Inspection.

No public links, metadata, canonical/indexing controls, sitemap actions, redirects, source-page changes, or Production behavior are authorized by this checkpoint. The 14-day #569 observation window is still incomplete.

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
