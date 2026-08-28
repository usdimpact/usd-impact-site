# Book-Site Bridge gap analysis

Date: 2026-08-28

## Existing strengths

| Capability | Existing state | Reuse decision |
| --- | --- | --- |
| Durable framework | Certified Edition 1.2 PDF | Preserve as read-only source |
| Book product route | Existing canonical product page | Extend contextually in Preview; do not create a second product page |
| Three-dial method | Existing public framework page | Reuse as the qualitative regime layer |
| Transmission method | Existing public framework page | Reuse as the mechanism layer |
| Weekly Score | Existing dashboard and methodology | Compare with, but never merge into, the qualitative framework |
| Daily and reports | Existing dated evidence chain | Link as current evidence, not as book text |
| Companion design package | Drive register, routes, QA and release gates | Reuse governance; do not copy obsolete topology blindly |

## Gaps closed in Phase 1

| Gap | Phase 1 response |
| --- | --- |
| No canonical bidirectional chapter/tool registry | Added reciprocal JSON registries and a reviewer matrix |
| No stable print-link layer | Added 19 static `/go/` aliases with edition and chapter context |
| Tool pages lack one consistent explanatory anatomy | Added `BookToolGuide.astro` |
| Site-to-book references risk becoming generic promotion | Added `BookChapterBridgeCard.astro` with relevance-specific rationale |
| Chapter 3 lacks a direct practice interaction | Added scenario-based DXY versus broad USD comparator |
| Chapter 11 lacks an anti-anchoring practice flow | Added Weekly Regime Lab that hides the comparison until submission |
| Prior package conflicts with current route hierarchy | Chose the current book route as canonical parent |
| No automated orphan check | Added reciprocal mapping and route QA script |

## Intentionally deferred

- live-data wiring inside the practice prototypes;
- saved progress, accounts or database persistence;
- current Score ingestion into the lab;
- public navigation and sitemap approval;
- analytics events;
- AI framework guide;
- new HeyGen renders;
- manuscript patching and QR placement;
- ISBN and publication work.

## Main risks still open

1. The full Astro build and browser rendering must pass on Vercel Preview.
2. Static alias behavior must be verified on the deployed host.
3. Mobile, keyboard and screen-reader QA remain browser tasks.
4. A later live-data phase needs an explicit source-freshness and privacy review.
5. The manuscript patch must wait until final route names and aliases are frozen.
