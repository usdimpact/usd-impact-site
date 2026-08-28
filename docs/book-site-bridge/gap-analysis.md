# Book-Site Bridge gap analysis

Date: 2026-08-28

## Existing strengths

| Capability | Current state | Reuse decision |
| --- | --- | --- |
| Durable framework | Certified Edition 1.2 PDF | Preserve as read-only source |
| Book product route | Canonical product page released | Extend contextually; do not create a second product page |
| Three-dial method | Public framework page | Reuse as the qualitative regime layer |
| Transmission method | Public framework page | Reuse as the mechanism layer |
| Weekly Score | Public dashboard and methodology | Compare with, but never merge into, the qualitative framework |
| Daily and reports | Dated evidence chain | Link as current evidence, not as book text |
| Companion | Phase 0-1 released through PR #383 | Keep as orchestration layer under the canonical book route |
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

## Phase 2A gap being addressed in Preview

The released companion is reachable from the book, but existing evidence surfaces do not yet consistently return readers to the exact chapter that resolves a conceptual issue.

Phase 2A addresses that gap with exactly five governed contextual mappings:

- Score -> Chapter 10;
- Score methodology -> Chapter 10;
- weekly report details -> Chapter 11;
- Daily 2026-08-20 -> Chapter 4;
- Daily 2026-08-27 -> Chapter 5.

The mappings are deliberately sparse. Unselected Daily editions and unrelated surfaces receive no contextual book card.

## Intentionally deferred

- live-data wiring inside the practice prototypes;
- current Score ingestion into the Weekly Regime Lab;
- saved progress, account state or database persistence;
- new analytics events;
- broad automatic chapter promotion across every Daily article;
- new HeyGen renders;
- grounded AI framework guide;
- manuscript patching and QR placement;
- ISBN, barcode and publication metadata.

## Current release risks

1. Phase 2A must keep mappings centrally governed so future content does not silently acquire a book promotion.
2. Exactly one card must render on each approved target surface and none on representative negative routes.
3. The existing Phase 0-1 `noindex` and sitemap exclusions must remain unchanged.
4. The final Phase 2A head requires exactly one Vercel Preview before any merge request could be considered.
5. A later live-data phase still requires explicit source-freshness, timestamp and privacy review.
6. The manuscript patch must still wait for final route and alias freeze.
