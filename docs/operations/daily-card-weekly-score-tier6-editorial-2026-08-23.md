# Weekly Score Daily Card Tier 6 editorial decision — 2026-08-23

## Decision

The five recurring Weekly Score methodology candidates introduced in PR #283 are fully accounted for after editorial comparison against the canonical Daily Card catalog.

### Promote as Research-only canonical cards

1. `candidate-weekly-score-news-vs-regime` -> `card-weekly-score-news-vs-regime`
2. `candidate-weekly-score-components-offset` -> `card-weekly-score-component-offsets`
3. `candidate-weekly-score-component-breadth` -> `card-weekly-score-component-breadth`

These three concepts add distinct Weekly Score methodology: event/news sensitivity versus completed-week regime measurement, opposing component contributions inside a combined score, and component breadth as confirmation context.

### Resolve as existing-catalog overlap

1. `candidate-weekly-score-cross-asset-regime` -> composite of `card-regime-evidence-ladder`, `card-dxy-signal-system`, and `card-dollar-yields-liquidity`.
2. `candidate-weekly-score-multiple-horizons` -> `card-regime-time-horizon-invalidation`, with `card-regime-evidence-ladder` as supporting context.

These two candidates do not create a sufficiently distinct learning objective to justify duplicate canonical cards.

## Content boundary

- All three promotions are `research` access and `ready-for-build`.
- No current or historical score value is embedded in evergreen card prose.
- No week-specific date or event claim is promoted.
- Provenance is the recurring methodology verified across the published weekly reports dated 2026-07-31, 2026-08-07, and 2026-08-14 plus the canonical Score page methodology boundary.
- The durable resolution registry must account for all five source candidates.
- The generated Tier 6 review queue must contain zero unresolved candidates after this decision.

## Expected inventory effect

- canonical Daily Cards: 97 -> 100
- publishable open cards: unchanged at 51
- Market Application: 6 -> 9 of target 15
- public `/learn/[slug]` pages: unchanged because the three promoted cards are Research-only
- Vercel function count: unchanged

## Release boundary

This work does not activate payment, authentication changes, entitlement changes, Supabase mutations, Daily Learning email, Telegram, WhatsApp, Web Push, knowledge search, Adaptive Learning, or public commerce.
