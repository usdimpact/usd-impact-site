# USD Impact Source-to-Social Transformation Schema v1

Status: internal implementation specification.

Purpose: convert existing USD Impact source publications into governed Instagram-ready outputs without creating a second editorial truth layer.

Scope: Daily USD Impact, Weekly Score, Important Catalyst, Reports, and evergreen framework/library education.

This document defines content transformation only. It does not publish to Instagram, authenticate to Meta, manage credentials, or modify Production.

## 1. Governing principle

Social content must be derived from an already governed USD Impact source artifact or from an explicitly approved evergreen education source.

The social layer may simplify, sequence, visualize, and shorten. It must not silently invent:

- new factual claims;
- unsupported causal certainty;
- forecasts;
- trading recommendations;
- product claims not present in the current public contract;
- stale or unverified statistics.

Source artifact remains authoritative.

## 2. Common social output contract

Every candidate output carries:

- `social_id`
- `source_type`
- `source_identifier`
- `source_date`
- `source_url_or_repo_ref`
- `source_freshness_status`
- `content_family`
- `hook`
- `core_claim`
- `supporting_evidence`
- `uncertainty_or_caveat`
- `cta`
- `destination`
- `required_sources`
- `fact_check_status`
- `compliance_status`
- `visual_status`
- `caption_status`
- `publish_status`

No candidate reaches `publishable` unless fact check, compliance, visual, captions, and destination-link QA all pass.

## 3. Output states

Use these states:

- `draft` — generated but not checked;
- `source_verified` — factual source chain confirmed;
- `editorial_ready` — hook/lesson/CTA approved;
- `creative_ready` — visual/video asset completed;
- `qa_passed` — mobile, captions, compliance, links passed;
- `publishable` — approved for publishing workflow;
- `published` — platform confirmation exists;
- `held` — intentionally not published;
- `stale` — source freshness window expired;
- `rejected` — failed editorial/compliance/source gate.

## 4. Daily USD Impact transformation

### Source

The current verified Daily USD Impact edition.

### Minimum source requirements

- correct edition date;
- all market facts and numbers already verified in the Daily workflow;
- no source freshness warning;
- no unresolved publication blocker that affects the selected claim.

### Candidate outputs

1. Daily Reel — 20–35 seconds
2. Daily Snapshot — one feed/story card
3. Story sequence — 2–4 frames
4. Optional framework quiz

### Reel schema

1. Hook: one question or change only.
2. Evidence: dollar / real rates / liquidity signal relevant to the selected move.
3. Cross-asset implication: selected asset(s), descriptive not prescriptive.
4. Caveat: what remains uncertain or asset-specific.
5. CTA: Full verified context → Daily USD Impact.

### Selection rule

Choose the highest-information move, not necessarily the largest percentage move.

Preferred candidates:

- regime-relevant dollar shift;
- meaningful real-rate move;
- liquidity/funding change;
- unusually clear cross-asset divergence;
- verified catalyst with a strong transmission lesson.

Avoid forcing a Reel when the Daily contains no single clean lesson.

### Daily expiry

Current-market Daily social candidates become stale when the underlying edition is no longer the current relevant Daily context. Stale candidates must not auto-publish.

## 5. Weekly Score transformation

### Source

The completed Weekly Score for the governed week.

### Candidate outputs

1. Weekly Score flagship Reel — 40–60 seconds
2. Weekly Score carousel — 5–7 slides
3. Story recap — 2–3 frames
4. One framework quiz

### Flagship Reel schema

1. Week/regime identification.
2. Dollar direction.
3. Real-rate direction.
4. Liquidity/stress condition.
5. Selected asset implications.
6. Highest-value upcoming catalyst.
7. Caveat / uncertainty.
8. CTA: Read the complete Weekly Score.

### Carousel schema

1. Cover
2. Dollar
3. Real rates
4. Liquidity/stress
5. Cross-asset implications
6. Upcoming catalyst(s)
7. Full-score CTA

### Guardrail

Weekly Score social content must not convert score outputs into direct buy/sell language.

## 6. Important Catalyst transformation

### A. Catalyst Ahead

Use only after event identity, schedule, and primary source are verified.

Fields:

- event;
- date/time;
- primary source;
- why it matters;
- dollar channel;
- rates channel;
- liquidity/risk channel where relevant;
- assets exposed;
- what would constitute genuinely new information;
- uncertainty.

Do not predict the outcome.

### B. Catalyst Result

Use only after the outcome is verified.

Fields:

- expected/prior where relevant;
- actual result;
- source timestamp;
- initial USD response;
- rates response;
- selected asset response;
- whether the first move held;
- what changed in the framework;
- remaining uncertainty.

### Fail-closed rule

If the event result or market reaction cannot be verified from acceptable sources, no result creative becomes publishable.

## 7. Report transformation

### Source

A published or explicitly approved USD Impact report.

### Candidate outputs

- 60–90 second flagship Reel;
- 5–8 slide carousel;
- 2–3 derivative micro-Reels;
- 1 quiz;
- 1 chart card when useful.

### Flagship Reel schema

1. Report question.
2. Context.
3. Two or three highest-value pieces of evidence.
4. Transmission mechanism.
5. Cross-asset implications.
6. Risks / uncertainty.
7. CTA: Read the full report.

### Derivative rule

Each micro-Reel must stand alone and teach one idea. Do not split a report into clips that require missing context to avoid being misleading.

## 8. Evergreen framework transformation

Approved evergreen source families:

- Start Here;
- Dollar Transmission Chain;
- Read the Dollar First public framework material;
- approved Video Library derivative map;
- glossary definitions backed by authoritative references.

Candidate formats:

- Read the Dollar First;
- One Chart / One Lesson;
- Macro Myth;
- Test Your Framework;
- glossary Reel;
- carousel.

Evergreen content does not require a current market hook.

## 9. Video Library derivative rule

Paid Library films may supply subject matter and intellectual structure, but public social assets should be newly authored by default.

For each film generate candidates for:

- core concept;
- common misconception;
- one visual mechanism;
- one quiz;
- one practical interpretation question.

Do not expose paid footage or substantial script text unless separately approved.

## 10. Hook rules

Good hooks:

- What changed first?
- Why did these two assets diverge?
- DXY moved. What does that actually tell you?
- One relationship does not equal one rule.
- What does repo have to do with dollar liquidity?
- Which force would you investigate first?

Avoid:

- Buy this now.
- This asset is about to explode.
- Guaranteed setup.
- The Fed just told you what to buy.
- You will miss this move.

## 11. CTA mapping

| Content family | Default CTA | Destination |
|---|---|---|
| Daily | Full verified context → Daily USD Impact | Daily edition |
| Weekly Score | Read the complete Weekly Score | Weekly Score |
| Catalyst | Read the verified catalyst brief | Catalyst brief |
| Report | Read the full report | Report |
| Framework | Learn the framework → Start Here | Start Here |
| Library-derived education | Explore Read the Dollar First | Book/Library evaluation path |
| Quiz | Learn the framework → Start Here | Start Here |

Use one CTA per asset.

## 12. Caption delivery rule

For HeyGen-produced Instagram pilots and future derivatives:

- the raw video may expose scene metadata with captions disabled;
- HeyGen may provide a separate `captionedVideoUrl` and SRT;
- publishing workflow must prefer the verified captioned MP4 when available;
- SRT must be retained as QA evidence or fallback;
- a raw uncaptioned render is not publishable for standard Instagram Reel delivery unless an explicit exception is approved.

## 13. Brand delivery rule

All social video outputs use the `USD Impact — Production` visual system:

- Navy `#071A33`;
- Midnight `#020A14`;
- Gold `#C9A35B`;
- White `#FFFFFF`;
- Graphite `#161A1F` where needed;
- Silver `#C6CCD4` where needed;
- Playfair Display Variable for display headings;
- Inter Variable for labels/body/captions;
- USD Impact horizontal logo;
- restrained institutional motion;
- no presenter by default.

## 14. Naming convention

Use governed IDs independent of provider dashboard titles.

Pattern:

`IG-### — CONTENT FAMILY — SHORT TITLE`

Examples:

- `IG-001 — START HERE — Read the Driver`
- `IG-002 — FRAMEWORK — The 3 Dials`
- `IG-006 — ONE CHART ONE LESSON — DXY in 30 Seconds`
- `IG-011 — MACRO MYTH — Dollar vs Gold`
- `IG-021 — LEARN — Repo in Plain English`

Provider-side title drift does not change the governed inventory ID.

## 15. QA gates

### Source

- correct source artifact;
- source current for its intended use;
- primary/authoritative source chain retained;
- no unsupported numeric claim.

### Script

- one main lesson;
- no silent additions to factual claims;
- no unsupported causal certainty;
- approved wording preserved where script is locked.

### Compliance

- educational framing;
- no personalized recommendation;
- no buy/sell/hold instruction;
- no guaranteed performance;
- no unsupported forecast;
- historical relationship not presented as deterministic.

### Creative

- 9:16 for Reels;
- brand-consistent typography and logo;
- no misleading finance imagery;
- mobile-safe text;
- captioned MP4 present;
- end CTA visible;
- educational-only disclosure where required.

### Link

- destination resolves;
- destination matches CTA;
- no stale campaign parameters;
- no broken or gated route for intended public CTA.

## 16. Pilot acceptance record

Initial five-video pilot set:

- IG-001 — corrected final candidate video `7f215827561a44e7a83481a68f71a2f8`; exact approved narration verified; dedicated captioned MP4 and SRT available.
- IG-002 — video `8fb537b27be64db6a1e4a1b627ff865e`; substantive script verified; dedicated captioned MP4 and SRT available.
- IG-006 — video `f951f11371264c0ca596ce64a35cfdde`; substantive script verified; dedicated captioned MP4 and SRT available.
- IG-011 — governed ID; provider dashboard currently labels source render IG-007; video `17c3f4ecb12c4061814023838a239a3e`; substantive script verified; dedicated captioned MP4 and SRT available.
- IG-021 — video `99dbccf5b1d447d7a51828f459fa7c89`; substantive script verified; dedicated captioned MP4 and SRT available.

Publishing must use captioned variants.

## 17. Automation boundary

Future automation may generate candidates, but initial design should stop before automatic public posting.

Allowed automated stages in a later reviewed increment:

1. source selection;
2. structured social brief generation;
3. candidate script/carousel generation;
4. source citation attachment;
5. deterministic compliance linting;
6. creative request generation;
7. QA packet assembly.

Public posting, credential setup, Meta app configuration, token handling, or automatic publishing requires separate explicit authorization and provider-level controls.
