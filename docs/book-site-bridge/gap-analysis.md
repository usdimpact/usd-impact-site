# Book-Site Bridge gap analysis

Date: 2026-08-29

## Existing strengths

| Capability | Current state | Reuse decision |
| --- | --- | --- |
| Durable framework | Certified Edition 1.2 PDF | Preserve as read-only source |
| Book product route | Canonical product page released | Extend contextually; do not create a second product page |
| Three-dial method | Public framework page plus fail-closed completed-week repository snapshot | Reuse as the qualitative regime evidence layer |
| Transmission method | Public framework page | Reuse as the mechanism layer |
| Weekly Score | Public dashboard and methodology | Compare with, but never merge into, the qualitative framework |
| Daily and reports | Dated evidence chain | Link as current evidence, not as book text |
| Companion | Phase 0-1 released through PR #383 | Keep as orchestration layer under the canonical book route |
| Contextual site-to-book returns | Phase 2A released through PR #392 | Keep centrally governed and sparse |
| Print aliases | 19 released `/go/` aliases | Preserve as stable print destinations |

## Gaps closed in Phase 0-1

| Gap | Released response |
| --- | --- |
| No canonical bidirectional chapter/tool registry | Reciprocal JSON registries and reviewer matrices |
| No stable print-link layer | 19 static `/go/` aliases with edition/chapter context |
| Tool pages lack one explanatory anatomy | `BookToolGuide.astro` |
| Site-to-book references risk generic promotion | `BookChapterBridgeCard.astro` plus promotion policy |
| Chapter 3 lacks a direct practice interaction | DXY versus broad USD comparator |
| Chapter 11 lacks an anti-anchoring practice flow | Weekly Regime Lab with comparison hidden until submission |
| Prior package conflicts with current route hierarchy | Existing book route retained as canonical parent |
| No automated orphan check | Reciprocal mapping and route QA |
| Release evidence incomplete | Preview, build, Production host, alias, `noindex` and sitemap gates completed for PR #383 |

## Gap closed in Phase 2A

The released companion was reachable from the book, but existing evidence surfaces did not consistently return readers to the exact chapter that resolves a conceptual issue.

Phase 2A closed that gap with exactly five governed contextual mappings:

- Score -> Chapter 10;
- Score methodology -> Chapter 10;
- weekly report details -> Chapter 11;
- Daily 2026-08-20 -> Chapter 4;
- Daily 2026-08-27 -> Chapter 5.

The mappings remain deliberately sparse. Unselected Daily editions and unrelated surfaces receive no contextual book card.

## Phase 2B gap being addressed in Preview

The two released practice prototypes still rely on reader-selected or static comparison states even though the repository already contains a stronger source-bound completed-week Three-Dials snapshot.

Phase 2B closes the UX gap without creating another market-data pipeline:

1. reuse only the checked-in completed-week Three-Dials snapshot and its exact-week Score bridge;
2. show source facts, actual observation dates, changes and source links before the reader classifies the week;
3. keep deterministic classifications hidden until submission to preserve the anti-anchoring learning sequence;
4. compare only the three deterministic dials in the Weekly Regime Lab;
5. leave dominant-driver hypotheses, confidence selections and written readings unscored and browser-local;
6. reveal Score v2 only after submission as a separate descriptive model output, never as an answer key;
7. distinguish a normal publication-pending window from genuinely stale data and disable comparison outside the approved cadence.

## Why no new data integration is needed

The existing Three-Dials generator already enforces the relevant source and freshness boundaries:

- DXY uses the existing disclosed Yahoo Finance accessible proxy;
- broad USD, real/nominal yields, HY OAS, VIX, SOFR and IORB are obtained through the existing FRED source boundary;
- required source ages are bounded per series;
- the Score bridge must match the exact completed week;
- dated archives are immutable;
- generated-data publication is guarded by full validation/build plus protected quality, CodeQL and bounded dependency checks.

Phase 2B therefore consumes the repository artifact at Astro build time and adds no browser market-data request, server runtime market-data API, new secret or provider.

## Phase 2B current risks and controls

1. **Anchoring risk:** deterministic dial labels or the Score could bias the reader before classification. Control: all deterministic classifications and the Score remain inside the hidden post-submit result.
2. **False freshness risk:** an older published week could be mistaken for current evidence. Control: explicit `current`, `publication-pending`, `stale` and `invalid` states; stale/invalid states disable comparison.
3. **Unsupported driver precision:** the repository snapshot does not contain a deterministic dominant-driver field. Control: driver remains a reader hypothesis and is never machine-scored.
4. **Score conflation risk:** Score v2 could be treated as the qualitative answer key. Control: separate post-submit model-output panel with explicit non-answer-key disclosure.
5. **Privacy/state risk:** practice answers could become a financial profile. Control: no response telemetry, local storage, database, account persistence or entitlement writes.
6. **Source-rights drift:** UI work could accidentally add another source or origin. Control: the rendering helper validates only the existing approved fact origins and exact-week Score origin; the publication workflow remains unchanged.
7. **Existing bridge regression:** live-evidence work could disturb Phase 0-1 noindex/sitemap or Phase 2A contextual mapping behavior. Control: both existing generated-output gates remain in the build and Phase 2B adds its own generated HTML checks.

## Intentionally deferred

- saved progress, account state or database persistence for practice responses;
- new analytics events for the practice tools;
- broad automatic chapter promotion across every Daily article;
- changes to the Three-Dials publication workflow, generator or provider/source-rights boundary;
- new HeyGen renders;
- grounded AI framework guide;
- manuscript patching and QR placement;
- ISBN, barcode and publication metadata.

## Sequence after Phase 2B

If the Phase 2B live-evidence UX is accepted and route behavior remains stable, the next high-value candidate is the surgical manuscript and QR/print-link patch. That work should remain minimal and wait for route/live-evidence UX freeze before any final route/manuscript freeze and ISBN/barcode/publication-metadata work.
