# Real Yield Strengthening Packet v1 — 2026-10-28

Status: **planning-only / preserve current snippet / no implementation authorized by this packet**.

Related:
- #570 — SEO Growth Architecture;
- Master Keyword-to-Page Map v1;
- current canonical: `/learn/real-yield`.

## Decision summary

**Primary state: STRENGTHEN_EXISTING.**

Do not create another “what is real yield?” page.

Do not change the current SEO title or meta description in the next increment.

Do not add broad or sitewide internal links merely to increase link count.

Current evidence supports a narrower hypothesis: Google is increasingly understanding and surfacing the existing canonical, while the page’s educational answer remains very concise. The next improvement should test conceptual precision and reader utility without resetting the improving snippet experiment.

## Current Search Console evidence

Settled 28-day window:
- 2026-09-28 through 2026-10-25;
- canonical page: `https://www.usd-impact.com/learn/real-yield`;
- **1 click / 386 impressions / 0.26% CTR / 12.60 average position**.

Prior equal window:
- 2026-08-31 through 2026-09-27;
- **0 clicks / 94 impressions / 26.05 average position**.

Descriptive change:
- impressions: 94 → 386;
- average position: 26.05 → 12.60;
- clicks: 0 → 1.

This is strong directional improvement, but not proof that any single prior SEO change caused the improvement.

### Current visible query family

Search Console exposes 14 query→page rows for this canonical, covering about 69.4% of its impressions.

High-signal rows include:
- `what are real yields` — 85 impressions / position 8.64;
- `what is real yield` — 80 / 9.35;
- `what is a real yield` — 15 / 8.33;
- `what is the real yield` — 10 / 8.50;
- `what are real yields and why do they matter` — 9 / 8.44;
- `what is real yields` — 6 / 6.33;
- `real yield` — 26 / 29.69;
- `real yields` — 29 / 32.14.

Interpretation:
- Google already associates the page strongly with definition/question intent;
- question variants are much closer to page one than the broad head terms;
- the page should answer the definition directly and clearly before expanding into asset implications.

## Current metadata

Current guarded SEO title:

`What Is Real Yield? TIPS, Inflation and Why It Matters`

Current guarded SEO description:

`Real yield is a return adjusted for inflation. Learn how TIPS, nominal yields and inflation expectations relate to real yields—and why the measure matters.`

Current visible H1/card title:

`Real Yield`

### Metadata decision

**NO CHANGE.**

The title already matches the highest-signal question intent.

The description already covers:
- inflation adjustment;
- TIPS;
- nominal yields;
- inflation expectations;
- why the measure matters.

Changing either now would create a new variable while the page is moving from page three toward page one.

## Current educational object

Governed source card:
`card-real-yield`.

Current answer structure:

- hook: opportunity cost for non-yielding assets such as gold;
- definition: real yield is yield adjusted for inflation expectations or compensation, depending on measure;
- why it matters: higher real yields can alter relative appeal of non-yielding assets;
- example: U.S. 10-year TIPS yield as common long-term market reference;
- common mistake: treating real yields as the only driver of gold;
- what to watch: 10-year TIPS yield, DXY, inflation expectations, risk demand;
- takeaway: real yields alter opportunity cost for non-interest-paying assets.

Current source links:
1. Federal Reserve — TIPS yield curve and inflation compensation;
2. TreasuryDirect — TIPS mechanics.

Both are authoritative first-party sources.

## Conceptual strengths

The page already gets several important things right:

- it does not claim real yields are the sole driver of gold;
- it uses 10-year TIPS as a market-based reference rather than a trading signal;
- it distinguishes real-yield analysis from nominal Treasury yields;
- it cites the Federal Reserve and U.S. Treasury;
- it is connected to the Three Dials framework and Gold vs Real Yields;
- it remains educational and non-recommendatory.

## Precision gap to evaluate

The current definition is concise but compresses several distinct concepts:

> “A real yield is a yield adjusted for inflation expectations or inflation compensation, depending on the measure used.”

A beginner can still conflate:

1. a **market real yield** such as a quoted TIPS yield;
2. a nominal yield minus a market inflation-expectation/compensation measure;
3. an **ex-post realized real return** calculated after actual inflation is known;
4. the TIPS **fixed coupon rate**;
5. the inflation-adjusted **TIPS principal**.

Those distinctions matter because current query intent is definition-led.

### Candidate clarification objective

The next implementation proposal should make this hierarchy explicit without turning the page into a long bond-pricing article:

- “Real yield” is an inflation-adjusted yield concept.
- A quoted TIPS yield is a market real-yield measure.
- TIPS principal adjusts with CPI while the stated coupon rate is fixed.
- A realized real return is not necessarily the same thing as the market real yield observed before inflation is realized.
- Nominal yield minus expected inflation is an approximation/framework, not an identity that makes every real-yield measure interchangeable.

Exact wording should be separately reviewed against the cited Federal Reserve/Treasury sources before implementation.

## Internal authority graph

### Existing direct relationships

`card-real-yield` currently links to:
- `card-gold-real-yields`;
- `card-dollar-yields-liquidity`.

Both link back to Real Yield.

This is already a strong core triangle:
- Real Yield;
- Gold vs Real Yields;
- Dollar / Yields / Liquidity — Three Dials.

### Existing inbound relationships outside the base card

Two especially relevant cards already point to Real Yield:

1. `card-tips-principal-inflation-adjustment`
   - slug: `tips-adjust-principal-with-inflation-not-the-coupon-rate`;
   - explains that TIPS inflation protection works through principal adjustment while the stated interest rate remains fixed;
   - explicitly warns against treating CPI adjustment, coupon rate and market real yield as the same variable;
   - `relatedCardIds` already includes `card-real-yield`.

2. `card-real-rates-equity-valuation`
   - slug: `real-rates-can-pressure-equity-valuations`;
   - explains the discount-rate channel for equities;
   - `relatedCardIds` already includes `card-real-yield`.

The Starter Guide also already links directly to `/learn/real-yield`.

### Authority decision

Do **not** launch a broad inbound-link campaign.

If a future implementation changes related-card reciprocity, the first candidates are only:
- Real Yield → TIPS principal mechanics;
- Real Yield → Real Rates & Equity Valuation.

Even those links should be added only if the Learn renderer’s related-card limit and relevance ordering remain clean.

## Historical authority constraint

The September 18 authority audit specifically concluded that Real Yield should not receive new inbound links merely to clear a Semrush internal-link issue, because it was no longer present in that issue after the earlier route/link repairs.

That remains valid.

Current GSC strength provides a different reason to revisit the page—definition intent—not a reason to manufacture links.

## Recommended bounded implementation candidate

If implementation is separately approved, prefer one small content-focused increment:

### Preserve

- slug;
- canonical;
- H1/card title;
- SEO title;
- SEO description;
- access/open status;
- source-link allowlist;
- video mapping;
- existing Gold and Three-Dials relationships.

### Candidate content changes

1. Refine the **definition** so market real yield and realized real return are not conflated.
2. Refine the **example** to explain why the 10-year TIPS yield is used as a market reference without implying that it equals realized inflation-adjusted return.
3. Consider broadening the **common mistake** from “real yields are the only driver of gold” to a concept-first mistake that also prevents TIPS coupon/principal/yield conflation, while preserving the gold warning elsewhere.
4. If renderer constraints allow, add at most two reciprocal related-card IDs:
   - TIPS principal mechanics;
   - real-rates/equity valuation.

No other page should change in the first increment.

## No-change alternative

A valid decision is **NO IMPLEMENTATION YET**.

Because impressions and position improved substantially in the current window, the site can also:
- leave the page unchanged;
- observe another 14–28 settled days;
- only intervene if definition-query CTR remains materially weak while positions stay near page one.

This is the lowest-risk option.

## Success metrics for any later implementation

Use a 28-settled-day comparison, not a short event window.

Primary:
- canonical page impressions;
- clicks;
- CTR;
- average position;
- question-intent rows: `what is real yield`, `what are real yields`, close variants.

Guardrails:
- no loss of canonical/indexability;
- no second competing Real Yield URL;
- no deterioration in authoritative source links;
- no misleading claim that TIPS coupon, principal adjustment, market real yield and realized real return are equivalent;
- no trading recommendation language;
- no broad link-count optimization.

## Explicit non-actions

This packet does not authorize:
- a title/meta change;
- a content edit;
- a related-card edit;
- a redirect/canonical change;
- a new Real Yield page;
- structured data;
- indexing request;
- sitemap change;
- outreach/backlinks;
- Production release.

## Final recommendation

**PRESERVE THE CURRENT SNIPPET.**

If the next implementation is approved, strengthen definition precision first and keep the diff limited to the Real Yield educational object plus, at most, carefully reviewed reciprocal related-card relationships.

If no implementation is approved, continued observation is fully acceptable because the current page is already moving materially closer to page one.
