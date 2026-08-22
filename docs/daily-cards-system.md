# USD Impact Daily Cards System

## Objective

Turn the existing USD Impact knowledge base into a reusable micro-learning and distribution system. One approved knowledge object should be able to power the website, email, Telegram, WhatsApp-style messages, and social posts without maintaining separate source content for each channel.

## Design principle

Use two dimensions:

1. **Knowledge collection** — where the concept belongs in the USD Impact learning system.
2. **Card format** — how the concept is taught on a given day.

This mirrors the existing video-library organization while making the same knowledge reusable across channels.

## Knowledge collections

### 1. Core Dollar Framework
Start here. USD, DXY, broad dollar measures, yields, liquidity, regime thinking, and transmission chains.

### 2. Asset Transmission
Gold, oil, Bitcoin, equities, LNG/gas, EUR/USD and other asset-specific transmission channels.

### 3. Rates, Liquidity & Policy
Treasury yields, real yields, curve shape, credit spreads, reserves, TGA, QT, repo, SRF, Treasury issuance and related domestic market plumbing.

### 4. Global Dollar & FX Mechanics
FX swaps, basis, cross-border dollar credit, central-bank swap lines, FIMA repo, reserve management, correspondent banking, hedging and funding stress.

### 5. Dollar Funding Stack
Sequential advanced learning path covering instruments, intermediaries, constraints, collateral, funding chains and policy backstops.

### 6. Market Application
Current-market application of approved educational concepts. Links Daily USD Impact, catalyst briefs and Weekly Score to the evergreen learning system.

### 7. History & Institutions
Bretton Woods, post-1971 monetary system, Plaza Accord, 2008 funding stress, 2020 dollar stress and other institutional/historical context.

## Card formats

- `word` — one term, plain-English definition, why it matters.
- `concept` — one mechanism explained in 30–90 seconds.
- `connection` — one relationship between two or more market variables.
- `mistake` — one common analytical error and its correction.
- `chart` — one visual relationship with a short interpretation.
- `scenario` — conditional market setup; teaches reasoning rather than prediction.
- `quiz` — one check-for-understanding question.
- `watch` — one variable or event to watch and why.
- `history` — one historical event or institutional change.
- `score` — educational explanation of one Weekly Score component or regime signal.

## Audience levels

- `foundation` — new investor; no assumed macro knowledge.
- `intermediate` — basic market vocabulary assumed.
- `advanced` — funding, policy, balance-sheet and cross-border mechanics.

## Access levels

- `open` — vocabulary, foundational concepts, basic relationships, history, simple quizzes and public Daily News connections.
- `library` — permanent educational library links where appropriate.
- `research` — advanced mechanisms, scenarios, Weekly Score interpretation, premium charts, guided paths and deeper applications.

The card itself should remain educational. Paid gating should control deeper context, linked research, archives or advanced application rather than turning basic definitions into promotional copy.

## Canonical card fields

Each card should have one canonical object containing:

- `id`
- `slug`
- `title`
- `shortTitle`
- `collectionId`
- `format`
- `level`
- `access`
- `hook`
- `definition`
- `whyItMatters`
- `example`
- `commonMistake`
- `whatToWatch`
- `keyTakeaway`
- `assets`
- `concepts`
- `relatedCardIds`
- `sourceNames`
- `sourceUrls`
- `videoSlug`
- `lessonUrl`
- `quizSlug`
- `complianceNote`
- `status`
- `lastReviewed`

Optional channel overrides may exist, but the canonical object remains the source of truth.

## Channel adapters

### Website
Full card. 60–180 seconds reading time.

Recommended order:
1. Hook
2. Definition / mechanism
3. Why it matters
4. Example
5. Common mistake
6. What to watch
7. Key takeaway
8. Related cards / lesson / video
9. Sources
10. Compliance note

### Email
One-card daily email or a 5–7 card weekly digest.

Daily structure:
- subject: concept-led, not promotional
- 1-sentence hook
- 3–5 short educational blocks
- one `Learn more` link
- compliance footer

### Telegram
Compact, scannable card:
- title
- 1–2 sentence definition
- why it matters
- one watch item
- one link

Use the channel as a broadcast stream first. Avoid conversational bot complexity until the content system is stable.

### WhatsApp-style message
Very short mobile version:
- `USD Impact Daily — <title>`
- definition
- why it matters
- one takeaway
- canonical link

Initial implementation should prepare WhatsApp-compatible text outputs without assuming direct API sending. Direct automated sending should only be added after provider/account/consent requirements are confirmed.

### Social post
Use a channel-specific derivative, not a copy of the full card:
- hook
- compact concept
- one insight
- canonical card link

Visual cards can later use the same canonical content object to generate branded images.

## Recommended weekly rotation

The schedule should create variety while reinforcing the same knowledge graph.

- Monday — **Word / Foundation**
- Tuesday — **Connection**
- Wednesday — **Rates / Liquidity / Policy concept**
- Thursday — **Asset Transmission**
- Friday — **Common Mistake or Scenario**
- Saturday — **Weekly Score / Market Application**
- Sunday — **History + weekly recap / quiz**

The scheduler should remain flexible: important current-market educational connections may replace a routine slot when they are supported by verified public sources.

## Daily stack option

A higher-engagement version can publish 3 small objects per day from one topic:

1. **Learn** — definition or concept.
2. **Connect** — cross-asset or mechanism relationship.
3. **Apply** — what to watch or a one-question quiz.

This is preferable to publishing three unrelated facts.

## Distribution model

Canonical card
→ website card
→ email adapter
→ Telegram adapter
→ WhatsApp-compatible adapter
→ social adapter
→ weekly digest

No channel should become a separate editorial database.

## Source hierarchy

Evergreen cards should prefer primary or institutional sources already used by USD Impact, including Federal Reserve, New York Fed, U.S. Treasury, BIS, ECB, BLS, EIA, ICE/CME documentation and other authoritative sources appropriate to the topic.

Current-market cards should inherit the verification discipline used by Daily USD Impact and Catalyst Briefs.

## Compliance rules

- Educational and informational purposes only.
- No individualized investment advice.
- Avoid deterministic asset predictions.
- Use conditional language for scenarios.
- Separate educational mechanism from current-market interpretation.
- Preserve source traceability.
- Do not imply that DXY, liquidity, yields or any single variable fully determines an asset price.

## MVP

Phase 1 should include:

1. Canonical taxonomy and schema.
2. 30–50 seed cards from already-reviewed video/glossary concepts.
3. `/learn` archive and `/learn/[slug]` card routes.
4. homepage `Daily Card` component.
5. deterministic daily rotation.
6. channel adapter functions that return website/email/Telegram/WhatsApp/social representations.
7. related-video and related-lesson links.
8. tests for schema, publication status, links and access level.

No automated external message sending is required for Phase 1.

## Phase 2

- email delivery integration
- Telegram channel publishing
- approved WhatsApp Business provider integration
- social publishing integrations where appropriate
- weekly digest generator
- progress tracking and saved cards
- card-based quizzes

## Phase 3

- personalized learning paths
- mastered/unmastered concepts
- recommendation engine using only approved cards
- dynamic `Explain this term` overlays across USD Impact articles
- member-specific advanced sequences

## Initial learning paths

### Start Here
USD → DXY → broad dollar → yields → real yields → liquidity → transmission.

### Gold
Gold → DXY → real yields → inflation expectations → uncertainty → liquidity.

### Bitcoin
Bitcoin → dollar liquidity → real yields → risk appetite → crypto-specific flows.

### Oil & Gas
Dollar pricing → physical balance → inventories → term structure → geopolitics → LNG/regional constraints.

### Dollar Plumbing
Bank reserves → TGA → Treasury issuance → QT → repo → SRF → collateral/liquidity.

### Global Dollar
Cross-border credit → FX swaps → basis → swap lines → FIMA repo → funding stress.

## Success metrics

Track:
- card opens
- completion / dwell proxy
- next-card clicks
- related-video clicks
- related-lesson clicks
- quiz attempts
- email open/click rates
- Telegram link clicks
- returning readers
- conversion from open cards into Library or Research content

The primary product metric should be repeat learning behavior, not raw post volume.
