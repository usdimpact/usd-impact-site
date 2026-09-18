# Instagram Launch Readiness Matrix — 2026-09-18

Status: canonical pre-launch control matrix for USD Impact Instagram. This document does not authorize Meta/Instagram connection, scheduling, posting, merge, or Production deployment.

## Overall state

**Base production:** READY  
**Launch-current content:** HELD until launch window  
**Real-device motion QA:** HELD  
**Meta/Instagram integration:** NOT AUTHORIZED  
**Publishing:** NOT AUTHORIZED

PR #630 exact head at this checkpoint:

`fbeae27912b50d95fa2c2bf53956cd2fd80c2630`

Exact-head checks:

- Social Candidate Contract — PASS
- Dependency Review — PASS
- Web Quality — PASS
- CodeQL security analysis — PASS

PR remains draft, open, unmerged and mergeable.

---

## Readiness matrix

| Gate | State | Evidence / current status | Required to clear | Fail-closed condition |
|---|---|---|---|---|
| Editorial system | READY | Instagram Editorial System v1 present | none before launch-current review | conflicting content-family or CTA rules |
| Canonical Reel inventory | READY | 24/24 governed evergreen + 4 interactive renders verified | final launch-device review only | missing canonical render / wrong governed ID |
| HOW onboarding videos | READY_WITH_RECHECK | 10/10 renders verified | revalidate mutable product claims before posting | current Production no longer matches tutorial |
| Carousel base | READY | 12/12 deterministic decks rendered and structurally QA-checked | phone review before posting | text clipping / wrong claim / wrong CTA |
| Story/quiz base | READY | 10 interactions / 20 frames rendered | phone review before posting | answer/explanation mismatch or unsafe wording |
| Current-context templates | READY | Daily / Weekly / Catalyst Ahead / Catalyst Result / Report templates complete | populate from launch-current source packets | fixture or stale data remains in final asset |
| Pinned foundation | READY_WITH_RECHECK | IG-001, IG-002 and PIN-003 architecture complete | recheck PIN-003 product/navigation claims | current product structure changed |
| Highlights | READY | START / DAILY / SCORE / LEARN / QUIZZES / REPORTS / LIBRARY | account-level setup later | highlight labels no longer match public surface |
| First-nine covers | READY | deterministic 4:5 cover set passed structural/contact-sheet QA | final phone-size visual review | provider thumbnail used instead of canonical cover |
| Captioned Reel deliverables | READY_WITH_DEVICE_QA | captioned MP4 + SRT confirmed for canonical launch Reels | reliable phone/device opening-middle-end review | captions clipped, unreadable, wrong, or unsynced |
| First-nine captions / alt text | READY_WITH_RECHECK | canonical copy and metadata pack complete | proofread against final media + live destination | copy/media mismatch or stale product claim |
| CTA architecture | READY_WITH_LIVE_CHECK | Start Here / Daily / Score / Reports / Library mapping defined | re-test Production routes immediately before posting | route broken, gated unexpectedly, or mismatched |
| Dynamic Daily slot | HELD | intentionally unassigned | current verified Daily source packet + freshness pass | stale/wrong edition or unresolved source blocker |
| Dynamic Weekly Score slot | HELD | intentionally unassigned | completed governed launch-relevant week | wrong week / incomplete score / stale context |
| Catalyst Ahead | HELD_UNTIL_EVENT | template ready | verified event identity, schedule, primary source | event/schedule cannot be verified |
| Catalyst Result | HELD_UNTIL_RESULT | template ready | verified actual result and market reaction | result/reaction not verified |
| Report derivative | HELD_UNTIL_SOURCE | template ready | published or explicitly approved report | report not approved/published |
| Product-state verification | HELD_TO_LAUNCH | current checks support architecture | re-check navigation/access/product wording at launch | any public contract drift |
| Editorial sign-off | HELD_TO_LAUNCH | governance complete | human review of final selected batch | unsupported certainty or unclear fact/interpretation split |
| Compliance sign-off | HELD_TO_LAUNCH | guardrails defined | final content review | advice-like wording, guarantee, unsupported forecast |
| Account ownership / recovery | NOT YET VERIFIED | outside current base scope | confirm owner, recovery path and operator | ownership/recovery unclear |
| Meta/Instagram connection | NOT AUTHORIZED | intentionally absent | separate explicit authorization + provider/security design | missing authorization or insecure credential model |
| Scheduling | NOT AUTHORIZED | intentionally absent | separate explicit authorization | schedule exists before content/source QA |
| Publishing | NOT AUTHORIZED | intentionally absent | separate explicit authorization after all green launch gates | any unresolved HOLD/FAIL |
| Post-publication verification | DEFINED_NOT_ACTIVE | operator runbook complete | activate only after first real post | no media ID / no verification / platform uncertainty |
| Measurement | READY_NOT_ACTIVE | 24h / 7d / 30d taxonomy defined | activate after publication | metrics collected without consistent content IDs |

---

## Canonical launch sequence

### First nine

1. IG-001 — Read the Driver
2. IG-002 — The 3 Dials
3. PIN-003 — What USD Impact Is
4. IG-006 — DXY in 30 Seconds
5. IG-011 — Dollar vs Gold
6. IG-021 — Repo in Plain English
7. current DYN-DAILY, otherwise IG-008
8. IG-004 — What Changed First?
9. current DYN-SCORE, otherwise IG-007

No launch date is assigned.

## Launch-week critical path

1. Establish the intended launch window.
2. Resolve slot 7 from the then-current Daily or select IG-008.
3. Resolve slot 9 from the then-current Weekly Score or select IG-007.
4. Re-test all CTA destinations in Production.
5. Recheck PIN-003 and any HOW/product claims against Production.
6. Perform reliable phone/device motion QA on selected captioned MP4s.
7. Review final covers, captions and alt text together.
8. Complete editorial sign-off.
9. Complete compliance sign-off.
10. Confirm publishing account ownership, recovery path and operator.
11. Only under separate authorization, configure Meta/Instagram integration.
12. Only after integration verification, assign schedule or publish.

## Stop conditions

Do not advance to publishing if any of the following is true:

- Daily/Weekly source is stale or incorrect;
- CTA route is broken or mismatched;
- product claims drifted;
- captioned media cannot be visually verified;
- wrong cover or media variant is selected;
- editorial/compliance approval is incomplete;
- account ownership/recovery is unclear;
- credentials would need to be placed in repo/docs/logs;
- Meta permissions/scopes are broader than required;
- a platform action returns ambiguous or partial success.

## Integration design requirements for a future separately authorized increment

Before connecting Meta/Instagram, define and review:

- account/business ownership;
- provider/app registration;
- minimum permission scopes;
- approved secret storage;
- token rotation/expiry handling;
- idempotent publish keys;
- duplicate prevention;
- scheduling semantics;
- audit trail;
- media processing/status checks;
- post-publication verification;
- rollback/removal procedure;
- incident and recovery evidence.

## Boundary

This matrix consolidates readiness only. It does not authorize merge, Production deployment, Meta/Instagram login, OAuth/token creation, account changes, scheduling or public posting.
