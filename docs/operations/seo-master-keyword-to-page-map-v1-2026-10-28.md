# Master Keyword-to-Page Map v1 — 2026-10-28

Status: **planning-only / evidence-gated / no content or indexing change authorized**.

Related:
- #570 — SEO Growth Architecture;
- #661 — long-title remediation experiments;
- #569 — completed technical/canonical observation gate.

## Evidence window

Primary source: Google Search Console via GSC Wizard.

Current settled window:
- 2026-09-28 through 2026-10-25;
- property: `sc-domain:usd-impact.com`;
- search type: Web;
- site totals: **8 clicks / 3,629 impressions / 0.22% CTR / 7.10 weighted average position**;
- comparison period: 2026-08-31 through 2026-09-27.

The query→page extract contains **170 privacy-visible pairs**.

Important sampling limitation:
- those 170 query→page rows cover only **15.51% of property impressions**;
- they expose **0 of 8 property clicks** because Search Console hides some low-volume query data;
- therefore pair-level impressions must not be summed and presented as full property totals;
- page-level and property-level totals from the SEO report are preferred where available.

Sitemap evidence:
- submitted sitemap index: healthy;
- sitemap errors: **0**;
- sitemap warnings: **0**;
- `sitemap-0.xml`: **200 URLs inspected**, **121 URLs with impressions** in the reporting window.

Semrush difficulty/backlink layers remain unavailable because the connected Semrush account currently has no API units. Do not invent KD, volume, backlink-gap or competitor metrics.

## Decision vocabulary

Each family receives exactly one primary state:

- **OBSERVE** — demand exists but no change is justified yet;
- **STRENGTHEN_EXISTING** — reuse the current canonical page; no net-new URL;
- **SNIPPET_TEST_CANDIDATE** — title/meta experiment may be proposed separately after page-specific review;
- **INTERNAL_LINK_CANDIDATE** — strengthen contextual authority without new content;
- **AUTHORITY_CANDIDATE** — potential cite-worthy/linkable asset, no outreach authorized here;
- **NEW_PAGE_CANDIDATE** — only if the full #570 new-page gate is satisfied;
- **DEFER** — insufficient current evidence.

## Current map

| Query family / intent | Canonical target or role | Current evidence | State | Priority | Decision / rationale |
| --- | --- | --- | --- | --- | --- |
| **Real yield / real yields / “what is real yield?”** — definition | `/learn/real-yield` | Page total: **386 impressions / 1 click / 12.60 avg position**. Privacy-visible query pairs include “what are real yields” (85 imp, pos 8.64), “what is real yield” (80, 9.35), “real yields” (29, 32.14), “real yield” (26, 29.69). | **STRENGTHEN_EXISTING** | **P1** | Strongest current evergreen demand. One canonical already answers the intent. Do not create a second “what is real yield” page. Next work should be bounded on-page/internal-authority review, not URL creation. |
| **DXY vs broad USD / dollar-index comparison** — comparison | `/learn/dxy-vs-broad-usd-what-each-index-answers` | “dxy vs broad usd”: 14 visible impressions at pos 13.36 on the intended page; divergence page receives 2 at pos 54.5. | **STRENGTHEN_EXISTING** | **P1** | Keep the explicit comparison page as primary canonical. Supporting divergence/agreement pages remain secondary. No generic “currency index” page justified. |
| **Employment Situation / payroll / unemployment / JOLTS** — scheduled-event + released-result | Dated Catalyst preview/outcome + corresponding dated Daily page | 53 visible pairs / 69 visible impressions / weighted pos ~5.14. Main Oct 2 Catalyst preview carries 50 visible impressions; many query variants rank positions 2–9. | **OBSERVE** | **P1** | Event architecture is already matching search intent. Preserve preview/result separation. Do not convert this demand into a generic duplicate jobs page. A future snippet test must be event-page-specific. |
| **BEA Personal Income & Outlays / PCE / GDP** — scheduled-event + released-result | Dated Catalyst page for schedule intent; dated Daily/outcome; Weekly Report for archive synthesis | 41 visible pairs / 98 visible impressions / weighted pos ~7.69. Weekly 2026-09-25, Daily 2026-09-24 and Sep 30 Catalyst each rank for different time-bound variants. | **OBSERVE** | **P1** | Multi-page visibility reflects legitimate publication roles, not automatically cannibalization. Keep dated intent boundaries. Do not create generic duplicate release-date pages. |
| **CPI release/result** — scheduled-event + released-result | Dated CPI Catalyst and Daily pages | 6 visible pairs / 6 visible impressions / weighted pos ~7.67; examples rank positions 2–10. | **OBSERVE** | **P2** | Existing publication architecture is adequate. Freshness/source correctness outranks SEO expansion. |
| **PPI release/result** — scheduled-event + released-result | Dated PPI Daily/Catalyst surfaces | 3 visible pairs / 3 visible impressions / weighted pos ~7.67. | **OBSERVE** | **P2** | Too little evidence for an evergreen or net-new page. |
| **Other macro/news long-tail** — current event lookup | `/news` plus dated Daily/Catalyst pages | 25 visible pairs / 56 visible impressions / weighted pos ~10.09. Includes BLS-date, official-release and multilingual long-tail variants. | **OBSERVE** | **P2** | Preserve publication governance. Do not chase long-tail event strings with new evergreen URLs. |
| **Gas pipeline constraints** — mechanism | `/learn/pipeline-constraints-can-divide-regional-gas-markets` | “gas pipeline constraints”: **10 visible impressions / pos 20.5**. | **INTERNAL_LINK_CANDIDATE** | **P2** | Existing explainer fits intent. Strengthen links from LNG/regional gas pages before any new page. |
| **WTI / EIA / petroleum inventories** — event + mechanism | Dated Daily/Catalyst for releases; `/learn/wti-backwardation-vs-contango`, `/learn/why-oil-inventories-matter` for evergreen mechanics | 4 visible pairs / 4 visible impressions; current event queries can rank positions 3–9. | **OBSERVE** | **P2** | Keep release intent on dated pages. Evergreen strengthening remains secondary to Real Yield/DXY. |
| **Treasury yield curve / coupon / maturity mechanics** — definition + mechanism | Treasury Learn cluster, especially `/learn/treasury-coupon-rate-is-not-yield-to-maturity` | Current page total for Treasury coupon explainer: **29 impressions / 1 click / 7.69 avg position**. Its Oct 4 SEO-title experiment improved descriptive 21-day metrics from 20 imp / pos 9.0 / 0 clicks to 21 imp / pos 7.29 / 1 click. | **OBSERVE** | **P2** | Existing page is already visible on page one. Protect it from further edits until its experiment window is fully evaluated. |
| **Liquidity / Three Dials / regime framework** — mechanism/methodology | `/framework/three-dial-dashboard` and `/learn/dollar-yields-liquidity-three-dials` | “dollar liquidity” visible once at pos 44; broader framework visibility remains low-volume. | **INTERNAL_LINK_CANDIDATE** | **P2** | Build authority through contextual links and methodology clarity, not new generic liquidity pages. |
| **Dollar history / Jamaica / Bretton Woods / Smithsonian** — historical education | Existing history Learn cluster | Current privacy-visible row is not meaningful demand (“help me with this page”); historical pages have prior low-volume visibility. | **DEFER** | **P3** | Keep existing cluster; no new history URL from current evidence. |
| **Brand / navigation (“usd impact”, “dollar impact”)** — brand/navigation | Homepage and `/start-here` | 7 visible pairs / 13 visible impressions; brand query is split across homepage/start-here at low volume. Homepage overall remains a top-click page. | **OBSERVE** | **P2** | Do not force consolidation from tiny query counts. Preserve page roles. |
| **Score / USD dashboard** — methodology/product navigation | `/score` and public methodology surfaces | “usd dashboard”: 4 visible impressions / pos 8. | **OBSERVE** | **P2** | Current route already matches intent. Rights constraints on Score data remain governed separately; SEO must not broaden public data exposure. |
| **Book / “usd book”** — product/entity | `/book/read-the-dollar-first` | “usd book”: 1 visible impression / pos 10. | **DEFER** | **P3** | Too little search evidence for metadata/content expansion. |
| **Gold / XAUUSD** — definition/mechanism | Existing XAUUSD/Gold Learn cluster | No meaningful privacy-visible query family in the current 170-pair extract. | **DEFER** | **P3** | Absence from the sampled query rows is not proof of zero property impressions. Preserve coverage; do not expand. |
| **Bitcoin / BTCUSD** — definition/mechanism | Existing BTCUSD/Bitcoin Learn cluster | No meaningful privacy-visible query family in the current 170-pair extract. | **DEFER** | **P3** | Preserve existing coverage; no new page. |
| **EURUSD / FX / translation mechanics** — comparison/mechanism | Existing FX/EURUSD Learn cluster | No material current family in the privacy-visible extract. | **DEFER** | **P3** | Revisit only with stronger query evidence. |

## Priority conclusions

### P1 — next analytical/optimization queue

1. **Real Yield**
   - strongest durable evergreen opportunity;
   - current page already owns the relevant intent;
   - next proposal should inspect copy structure, answer-first definition, internal contextual links and snippet alignment;
   - no new URL.

2. **DXY vs Broad USD**
   - comparison intent is explicit and already maps to the intended page;
   - strengthen existing authority before considering any broader “currency index” content.

3. **Labor / Employment Situation event family**
   - ranking proximity is already strong;
   - continue event-governed publishing;
   - only page-specific snippet experiments are eligible, not generic duplicate pages.

4. **BEA / PCE / GDP event family**
   - strong visibility across legitimate dated roles;
   - first action is query-role review, not consolidation or page deletion.

### P2 — authority/internal-link queue

- Gas pipeline constraints;
- Treasury mechanics;
- WTI/EIA evergreen support;
- Three Dials/liquidity framework;
- Score public methodology/navigation within existing rights constraints.

### P3 — preserve and monitor

- Gold/XAUUSD;
- Bitcoin/BTCUSD;
- generic FX/EURUSD;
- broad historical/institutional expansion;
- book/product generic terms.

## Cannibalization interpretation

The current SEO report flags only two low-volume cannibalization candidates, with the worst being `usd impact` across four pages and 10 total impressions.

Do **not** treat legitimate dated macro publication overlap as cannibalization merely because the same official-release phrase appears on:
- a preview;
- a released-result Daily/Catalyst;
- a Weekly archive/report.

Those URLs have different lifecycle roles.

A cannibalization repair is eligible only when two same-role pages compete persistently for the same query intent after enough settled data.

## Current CTR / opportunity signal

All seven position buckets with data are below the selected AWR CTR benchmark, but the site has only 8 clicks in the current 28-day window. Treat CTR benchmarks as prioritization context, not proof of defective snippets.

GSC Wizard's current top opportunity is:
- query: **“what are real yields”**;
- 85 impressions;
- avg position ~8.64;
- opportunity score 85.

This reinforces the Real Yield **STRENGTHEN_EXISTING** decision.

## New-page gate result

**No NEW_PAGE_CANDIDATE is approved by this v1 map.**

Every current meaningful family either:
- already has an appropriate canonical page;
- belongs to governed dated publication architecture; or
- lacks enough evidence.

Any future new-page proposal must satisfy the full #570 evidence packet before source work begins.

## Implementation boundaries

This map does **not** authorize:
- page creation;
- title/meta edits;
- article rewrites;
- structured data;
- redirects;
- canonical changes;
- sitemap/indexing requests;
- internal-link edits;
- outreach/backlink acquisition;
- content generation;
- branch deployment beyond this documentation record.

Every implementation candidate requires its own page-specific evidence, exact current-main branch, regression checks, Preview and release decision.

## Next analytical deliverables

In order:

1. **Real Yield Strengthening Packet v1**
   - inspect current H1/title/description/body answer structure;
   - map authoritative sources;
   - map existing in/out internal links;
   - propose only bounded changes with explicit no-change alternatives;
   - define 28-day success window.

2. **DXY vs Broad USD Internal Authority Packet**
   - map parent/supporting Learn pages and contextual links;
   - verify no cannibalization between comparison/divergence/agreement pages.

3. **Macro event query-role matrix**
   - separate schedule, preview, released-result and archive/report intent for BLS/BEA/CPI/PPI;
   - prevent SEO optimization from collapsing publication roles.

4. Add Semrush external/KD/backlink evidence only when API units become available.

## Final classification

**MASTER KEYWORD-TO-PAGE MAP V1 COMPLETE / REUSE-FIRST / ZERO NEW PAGES APPROVED / REAL YIELD = TOP EVERGREEN PRIORITY / EVENT ARCHITECTURE PRESERVED / SEMRUSH LAYER DEFERRED.**
