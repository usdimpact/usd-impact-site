# Daily Card Book Batch 04 — editorial review

Reviewed: 2026-08-24
Source hierarchy: published USD Impact Book lessons
Collection: Core Dollar Framework
Disposition: 3 promoted, 3 overlap-resolved, 0 forced promotions
Access: Open for promoted cards

## Promoted

### Six Errors That Break a Dollar Explanation

Source: `src/content/pages/what-is-the-us-dollar.md` → `Common interpretation errors`.

Distinct learning objective: a diagnostic checklist for rejecting weak dollar narratives that skip benchmark scope, cause, confirmation, asset-specific evidence or conditionality. This synthesizes failure modes into an analysis-quality gate rather than creating another DXY definition.

### Dollar Index Points Do Not Equal Uniform Currency Moves

Source: `src/content/pages/dxy-vs-broad-usd.md` → `Index-points learning block`.

Distinct learning objective: explain why a change in a constructed dollar index belongs to that benchmark and must not be copied onto every bilateral exchange rate. The hypothetical 100-to-102 / 100-to-103 examples remain explicitly educational and are not current-market claims.

### A Five-Step Sequence for Testing a Dollar Story

Source: `src/content/pages/what-is-the-us-dollar.md` → `A five-step reading sequence`.

Distinct learning objective: a repeatable order of operations — define signal, identify driver, confirm independently, map transmission, state conditions/invalidation. This is a process card rather than another regime-definition card.

## Explicit overlap resolutions

### DXY vs Broad USD — Four practical scenarios

Resolved to `card-dollar-breadth-signal-matrix` with agreement/divergence and benchmark-selection cards as related concepts. The scenario set substantially repeats the same breadth/confirmation decisions already represented canonically.

### What Is DXY — Four interpretation scenarios

Resolved to `card-dollar-breadth-signal-matrix`. The examples closely parallel the DXY-vs-Broad scenario set and would fragment one learning objective across near-identical scenario cards.

### What Is DXY — Common mistakes

Resolved primarily to `card-dollar-story-diagnostic-errors`, with the DXY scope and benchmark-selection cards retained as related destinations. A separate canonical mistake card would repeat the same warnings at narrower scope.

## Queue hygiene

A durable `daily-card-book-resolutions.js` registry is introduced so manually reviewed overlap sections are excluded from future Book candidate generation instead of resurfacing every week. The generator now keeps promoted sections and reviewed overlap resolutions as separate auditable counts and rejects any section that appears in both states.

## Expected post-batch state

- Total Daily Cards: 133 / 150
- Core Dollar Framework: 19 / 25
- Open cards: 80
- Promoted published-Book sections across the full catalog: 35
- Reviewed Book overlap resolutions: 3
- No commerce, authentication, entitlement, scheduler, customer-state, Supabase mutation or outbound-delivery changes.
