# Instagram Launch / Feed Architecture v1 — 2026-09-18

Status: pre-publication architecture. No Meta/Instagram connection, scheduling, posting, Production deployment, or social activation.

## 1. Canonical profile proposition

Working bio:

> Read the dollar before the market headline.  
> Dollar • real rates • liquidity • cross-asset context.  
> Educational only.  
> Start here ↓

Primary destination: **Start Here**.

Do not hard-code Library Pass pricing in the bio.

## 2. Pinned foundation

The canonical catalog intentionally leaves **IG-003 unassigned**. The older launch inventory reserved IG-003 for a brand explainer. To avoid reusing a governed IG number, the third permanent pin is now independently governed as **PIN-003**.

1. **PIN-001 / IG-001 — Read the Dollar First**
   - Promise: read the driver before the story.
   - CTA: Start Here.
2. **PIN-002 / IG-002 — The 3 Dials**
   - Dollar → real rates → liquidity.
   - CTA: Start Here / Framework.
3. **PIN-003 — What USD Impact Is**
   - Platform map: Learn → current context → depth.
   - Covers Start Here / Guided Edition, Daily + Weekly Score, Reports, and Library.
   - CTA: Start Here.
   - Deterministic six-slide 4:5 base completed separately.
   - This asset does **not** consume IG-003.

Pin only after each post has independently passed launch-state QA and has actually been published.

## 3. Highlights

Canonical Highlight order:

- **START** — Start Here, framework, platform orientation.
- **DAILY** — current verified context only.
- **SCORE** — Weekly Score / broader regime context.
- **LEARN** — framework, One Chart, Macro Myth, glossary.
- **QUIZZES** — Story quiz interactions and explanations.
- **REPORTS** — deep dives and durable research.
- **LIBRARY** — Guided Edition, Audiobook, Video Library, product education.

Do not use a dated/current Highlight cover. Highlight covers are evergreen brand navigation.

## 4. Cover system

Every feed cover should answer these before the viewer opens the post:

1. **Family:** e.g. READ THE DOLLAR FIRST / WEEKLY SCORE / MACRO MYTH.
2. **Question or lesson:** one short mobile-readable line.
3. **Identity:** USD Impact mark / production palette.
4. **State where necessary:** current verified context vs evergreen education.

Dynamic/current covers must not imply freshness unless the source packet is actually current.

## 5. First nine grid posts

The initial grid should establish identity before cadence:

| Slot | Asset | Role |
|---|---|---|
| 1 | IG-001 / PIN-001 | Foundation |
| 2 | IG-002 / PIN-002 | Foundation |
| 3 | PIN-003 | Platform map |
| 4 | IG-006 — DXY in 30 Seconds | Evergreen |
| 5 | IG-011 — Dollar vs Gold | Evergreen |
| 6 | IG-021 — Repo in Plain English | Evergreen |
| 7 | DYN-DAILY if fresh; otherwise IG-008 | Dynamic / fallback |
| 8 | IG-004 — What Changed First? | Evergreen |
| 9 | DYN-SCORE if fresh; otherwise IG-007 | Dynamic / fallback |

This sequence does not assign a launch date.

## 6. 45-slot rotation

This is an **order-of-use architecture**, not a calendar schedule. A dynamic slot is populated only if its governed source is current and fully verified. Otherwise use the named evergreen fallback.

| # | Preferred asset | Family | Fallback / rule |
|---:|---|---|---|
| 1 | IG-001 | Foundation | Pin after publication |
| 2 | IG-002 | Framework | Pin after publication |
| 3 | PIN-003 | Brand/platform | Pin after publication |
| 4 | IG-006 | One Chart | — |
| 5 | IG-011 | Cross-asset | — |
| 6 | IG-021 | Funding | — |
| 7 | DYN-DAILY | Current context | IG-008 if no clean fresh Daily lesson |
| 8 | IG-004 | Framework | — |
| 9 | DYN-SCORE | Weekly | IG-007 if timing/source unsuitable |
| 10 | CAR-001 | Framework carousel | — |
| 11 | IG-007 | Learn | — |
| 12 | QUIZ-002 | Interaction | — |
| 13 | IG-012 | Cross-asset | — |
| 14 | DYN-DAILY | Current context | IG-008 |
| 15 | CAR-002 | Framework carousel | — |
| 16 | IG-019 | Funding | — |
| 17 | HOW-001 | Platform/how-to | Product-state check before posting |
| 18 | IG-014 | Cross-asset | — |
| 19 | QUIZ-005 | Interaction | — |
| 20 | DYN-CAT-AHEAD | Catalyst | IG-016 if no verified relevant event |
| 21 | CAR-003 | Learn carousel | — |
| 22 | IG-015 | Cross-asset | — |
| 23 | HOW-002 | Platform/how-to | Product-state check before posting |
| 24 | DYN-REPORT | Report | CAR-004 if no current approved report |
| 25 | IG-020 | Funding | — |
| 26 | CAR-008 | Funding carousel | — |
| 27 | QUIZ-006 | Interaction | — |
| 28 | DYN-DAILY | Current context | IG-017 |
| 29 | IG-017 | Energy | — |
| 30 | HOW-005 | Platform/how-to | Product-state check before posting |
| 31 | IG-023 | Funding | — |
| 32 | CAR-009 | Framework carousel | — |
| 33 | DYN-SCORE | Weekly | IG-018 |
| 34 | IG-024 | Funding | — |
| 35 | QUIZ-010 | Interaction | — |
| 36 | HOW-006 | Platform/how-to | Product-state check before posting |
| 37 | IG-025 | Funding | — |
| 38 | CAR-011 | Learn carousel | — |
| 39 | DYN-CAT-RESULT or AHEAD | Catalyst | IG-009 if no verified catalyst |
| 40 | IG-026 | Funding | — |
| 41 | HOW-009 | Platform/how-to | Product-state check before posting |
| 42 | CAR-012 conceptual | Weekly education | If showing live score, becomes ROLLING and must refresh |
| 43 | IG-030 | Interactive/evergreen | — |
| 44 | DYN-REPORT | Report | CAR-010 |
| 45 | IG-010 | Macro Myth | — |

## 7. Rotation constraints

- Do not publish two product/how-to posts back-to-back.
- Do not use a dynamic slot merely to preserve a visual pattern.
- High-importance verified catalysts may supersede the next non-foundation slot.
- A catalyst result never publishes before outcome verification.
- A Daily candidate that has gone stale is discarded or regenerated; it is not “saved for later.”
- A current Weekly Score slot must use the completed governed week.
- Report derivatives must be sourced from a published or explicitly approved report.
- Evergreen posts can move earlier/later without factual refresh if their product/CTA wording remains current.
- HOW-008 is excluded from the default first-45 rotation until live email-delivery/consent state is rechecked.

## 8. Content mix target

Across a mature 45-post sample, maintain approximately:

- **70% education / market-context learning**;
- **20% framework interaction / platform education**;
- **10% direct product evaluation / conversion**.

Do not force the exact percentage at the cost of source quality.

## 9. Visual rhythm

Avoid a mechanically tiled feed. Consistency comes from typography, color, family labels and recurring structures, not from alternating arbitrary colors.

Recommended rhythm:

- framework / One Chart / Macro Myth;
- current context when verified;
- funding / cross-asset;
- interaction;
- occasional platform education;
- report/deep dive when available.

## 10. Launch gate

Before assigning actual dates:

1. confirm profile ownership/recovery path;
2. verify public destinations for all CTAs;
3. phone-size visual QA on selected first 9;
4. check captions/subtitles on video variants;
5. product-state check on HOW/PIN-003 claims;
6. source freshness check on every dynamic slot;
7. compliance/editorial approval;
8. only then establish publishing ownership and schedule.

## Boundary

This architecture is a base plan only. It does not authorize Meta login, OAuth/token setup, scheduling, live posting, automatic publication, PR merge, or Production deployment.
