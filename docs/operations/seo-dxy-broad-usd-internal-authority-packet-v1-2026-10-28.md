# DXY vs Broad USD Internal Authority Packet v1 — 2026-10-28

Status: **planning-only / preserve improving canonical / no implementation authorized by this packet**.

Related:
- #570 — SEO Growth Architecture;
- Master Keyword-to-Page Map v1;
- canonical comparison page: `/learn/dxy-vs-broad-usd-what-each-index-answers`.

## Decision summary

**Primary state: STRENGTHEN_EXISTING / PRESERVE-FIRST.**

Do not create a second DXY-vs-Broad-USD comparison page.

Do not redirect or merge the existing Agreement, Divergence, Euro Weight, nominal-vs-real, structural-dollar, benchmark-selection, or index-point pages.

Do not change the comparison page's title/meta merely because related pages also rank for adjacent concepts.

The canonical comparison page is already moving toward page one. The authority task is therefore to preserve role clarity and, only if needed later, improve a small number of reciprocal contextual relationships.

## Current Search Console evidence

Settled current window:
- 2026-09-28 through 2026-10-25;
- canonical: `https://www.usd-impact.com/learn/dxy-vs-broad-usd-what-each-index-answers`;
- **0 clicks / 48 impressions / 8.67 average position**.

Prior equal window:
- 2026-08-31 through 2026-09-27;
- **1 click / 28 impressions / 14.89 average position**.

Descriptive change:
- impressions: 28 → 48;
- average position: 14.89 → 8.67;
- clicks: 1 → 0.

Interpretation:
- ranking proximity improved materially;
- the current 0-click window is too small to justify a snippet rewrite by itself;
- preserving the current canonical and role boundaries is lower risk than introducing a new title/URL variable.

Privacy-visible query evidence includes:
- `dxy vs broad usd` → canonical comparison page, 14 visible impressions around position 13.36;
- the same query also appears on `/learn/why-dxy-and-broad-usd-divergence-matters` at much weaker visibility, showing adjacent semantic overlap rather than evidence for redirect/merge.

Page-level totals are authoritative for this packet because Search Console suppresses some low-volume query rows.

## Canonical comparison role

Governed object:
`card-dxy-broad-purpose`

Slug:
`dxy-vs-broad-usd-what-each-index-answers`

Visible title:
`DXY vs Broad USD: What Each Index Is Designed to Answer`

Current core answer:
- DXY = fixed six-currency basket with heavy euro exposure;
- Broad USD = wider trade-weighted group of U.S. trading partners;
- neither measure is universally superior;
- benchmark choice depends on the exposure or analytical question.

Current key takeaway:
`Match the dollar benchmark to the exposure or claim being tested.`

This is the correct role for comparison intent.

## Current authoritative sources

The comparison page has three reviewed source links:

1. ICE — U.S. Dollar Index reference basket;
2. Federal Reserve — dollar-index methodology (2019 methodology note);
3. Federal Reserve H.10 — nominal and real dollar-index definitions/access.

Source scopes explicitly avoid:
- treating historical weights as a current snapshot;
- reproducing current index values;
- implying a trading recommendation.

**Source decision: NO CHANGE.**

## Current related-card graph

The comparison card currently links directly to:
- `card-dxy-signal-system`;
- `card-usd`.

The wider graph already sends substantial authority/context *into* the comparison page.

### Existing inbound / semantic neighbors

#### Euro concentration
`card-dxy-euro-weight`
- slug: `why-the-euro-matters-in-dxy`;
- explicitly links to `card-dxy-broad-purpose`;
- role: explain why one large EURUSD move can dominate DXY.

#### Agreement / breadth confirmation
`card-dxy-broad-agreement`
- slug: `why-dxy-and-broad-usd-agreement-matters`;
- explicitly links to the comparison page;
- role: agreement strengthens breadth evidence but does not prove cause.

#### Divergence / scope narrowing
`card-dxy-broad-divergence`
- slug: `why-dxy-and-broad-usd-divergence-matters`;
- explicitly links to comparison and agreement;
- role: disagreement helps locate where the dollar move is concentrated.

#### Nominal vs real indexes
`card-nominal-real-dollar-index`
- slug: `nominal-vs-real-dollar-indexes`;
- explicitly links to comparison;
- role: distinguish nominal exchange-rate questions from inflation-adjusted competitiveness questions.

#### Index-point mechanics
`card-dollar-index-points-scope`
- role: explain why index points are construction-dependent and should not be generalized across bilateral rates;
- links to comparison, agreement and divergence.

#### Benchmark selection
`card-regime-benchmark-selection`
- role: choose bilateral, DXY, Broad USD, real-dollar or funding measures according to the claim/exposure;
- explicitly links to comparison.

#### Structural dollar role
`card-structural-dollar-use-vs-exchange-rate`
- slug: `structural-dollar-use-is-not-dollar-exchange-rate-direction`;
- links to comparison;
- role: separate structural currency use from short-horizon exchange-rate direction.

#### DXY system framing
`card-dxy-signal-system`
- already directly connected to the comparison page;
- role: DXY is one signal inside a broader dollar system.

## Page-role boundaries

Keep these roles distinct:

| Intent | Canonical role |
| --- | --- |
| “DXY vs Broad USD” / which benchmark answers what? | `/learn/dxy-vs-broad-usd-what-each-index-answers` |
| Why euro weight matters in DXY | `/learn/why-the-euro-matters-in-dxy` |
| What agreement between DXY and Broad USD means | `/learn/why-dxy-and-broad-usd-agreement-matters` |
| What divergence between DXY and Broad USD means | `/learn/why-dxy-and-broad-usd-divergence-matters` |
| Nominal vs real dollar indexes | `/learn/nominal-vs-real-dollar-indexes` |
| Index-point / basket-construction mechanics | `/learn/dollar-index-points-do-not-equal-uniform-currency-moves` |
| Benchmark choice inside regime analysis | existing benchmark-selection card |
| Structural use vs exchange-rate direction | `/learn/structural-dollar-use-is-not-dollar-exchange-rate-direction` |

These are complementary, not duplicates.

## Cannibalization decision

**NO CONSOLIDATION / NO REDIRECT.**

Current evidence is not sufficient to classify the comparison/divergence/agreement pages as harmful cannibalization.

Reasons:
- the comparison canonical is already averaging position 8.67;
- divergence has a distinct diagnostic role;
- agreement has a distinct confirmation role;
- euro-weighting, index construction and nominal/real pages answer separate concepts;
- low-volume query overlap is expected in a tightly related educational cluster.

A future cannibalization action requires persistent same-role competition, not merely shared vocabulary.

## Metadata decision

The main comparison card currently uses the normal Learn fallback metadata path rather than a dedicated SEO-title override.

**Recommendation: PRESERVE FOR NOW.**

Do not introduce a title test while:
- average position is improving from 14.89 to 8.67;
- impressions are rising;
- click volume is still too small to isolate a snippet problem.

A future title experiment should require a stable page-one observation window with persistently weak CTR and a page-specific hypothesis.

## Internal-authority decision

The graph is already broad.

Do **not** add every reciprocal relation to `card-dxy-broad-purpose`.

That would make the comparison card a generic hub and weaken its concise beginner role.

### If a later implementation is approved

At most two reciprocal related-card additions should be considered first:

1. **Euro Weight in DXY**
   - strongest construction-specific reason the comparison matters;
   - direct beginner path from comparison → concentrated basket explanation.

2. **Agreement or Divergence** — choose one first, not both automatically
   - Agreement if the educational priority is breadth confirmation;
   - Divergence if the educational priority is diagnosing conflicting dollar signals.

The choice should respect the renderer's related-card limit and current ordering.

No sitewide link campaign is justified.

## Content decision

The current comparison copy is already conceptually strong:
- identifies fixed-basket vs trade-weighted construction;
- states neither benchmark is universally superior;
- explains the risk of making a concentrated move look broad;
- gives an EURUSD-driven DXY example;
- warns against interchangeability;
- tells the reader to match benchmark to exposure/claim.

**No content rewrite is currently required.**

A valid next action is simply observation.

## Measurement window

If any later internal-authority change is approved:
- use a minimum 28 settled Search Console days;
- compare canonical page impressions, clicks, CTR and average position;
- track `dxy vs broad usd` and close semantic variants;
- verify Agreement/Divergence pages do not lose their distinct query roles;
- verify no canonical/indexability regression.

## Explicit non-actions

This packet does not authorize:
- a title/meta edit;
- a content rewrite;
- a related-card edit;
- a new page;
- a redirect;
- canonical changes;
- sitemap/indexing requests;
- structured data;
- outreach/backlinks;
- Production release.

## Final recommendation

**PRESERVE THE IMPROVING COMPARISON PAGE.**

The cluster already has strong semantic connectivity. If a future bounded implementation is approved, test no more than one or two reciprocal contextual relationships and preserve all distinct Agreement/Divergence/Euro Weight/index-construction roles.

A no-change observation period is fully acceptable and may be preferable while the canonical is already averaging page one.
