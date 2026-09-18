# Instagram Resume Point — 2026-09-18

Purpose: durable handoff so the originating ChatGPT conversation is not required for continuation.

## Live status checked 2026-09-18

Repository: `usdimpact/usd-impact-site`

PR #630:
- title: `feat(social): define Instagram system and candidate generator`
- state: OPEN
- draft: true
- merged: false
- mergeable: true
- exact head: `49ff75325ecc47bbd169a56789252677a73df635`
- original/recorded base: `ead2afb72fd98a00b3a57eb33cc451c226e85110`

Exact-head checks:
- Social Candidate Contract — PASS
- Dependency Review — PASS
- Web Quality — PASS
- CodeQL security analysis — PASS

## Important current-main drift

The branch is **not merge-ready without reconciliation**.

Live compare `social/instagram-editorial-system-v1...main` reports:
- status: diverged
- main has 93 commits not on the Instagram branch
- Instagram branch has 39 commits not on main
- merge base: `ead2afb72fd98a00b3a57eb33cc451c226e85110`

Current main has materially evolved in publishing/calendar, analytics/GA4, consent/telemetry, navigation, privacy, catalyst handling, current Daily content, and watchdog controls.

Therefore:
- do not reuse the old base approval;
- do not silently rebase;
- before any future merge, inspect current main, reconcile conflicts/contracts, then rerun exact-head CI and Preview QA.

The Instagram base remains useful as a governed creative/editorial system; the divergence primarily changes the integration/release path.

## Completed Instagram base

- governed evergreen Reel system;
- 24 governed evergreen Reel renders plus 4 interactive renders;
- 10 HOW onboarding videos;
- deterministic 12-carousel base;
- deterministic 10-interaction / 20-frame Story/quiz base;
- fixture-only Daily / Weekly Score / Catalyst Ahead / Catalyst Result / Report templates;
- profile proposition and Highlight architecture;
- pinned foundation system with `PIN-003`; canonical `IG-003` remains intentionally unassigned;
- 45-slot non-dated feed rotation with evergreen fallbacks;
- first-nine deterministic covers;
- first-nine caption/alt-text/metadata pack;
- operator runbook and measurement taxonomy;
- launch-readiness matrix;
- future Instagram publishing integration design;
- provider-readiness probe contract.

## Publishing boundary

No Instagram/Meta publishing has been activated.

Do not assume authorization for:
- Meta/Instagram account connection;
- OAuth/token creation;
- scheduling;
- public posting;
- PR merge;
- Production deployment.

## Provider-readiness probe result

Increment A was attempted read-only.

Direct Instagram browser path:
- result: `AUTH_REQUIRED`
- no authenticated Instagram session available;
- zero writes.

Windsor.ai:
- Instagram connector exists;
- auth type: OAuth;
- no Instagram account connected yet;
- supports image, video/Reel, carousel and Story actions;
- no action was executed.

Preferred initial controlled provider path:
- Windsor delegated connector for the first controlled tests;
- direct Meta API remains the long-term self-hosted option if later justified.

## Manual resume step

When ready to resume:

1. Connect the intended **USD Impact Instagram Business/Creator account** through the Windsor.ai Instagram OAuth connector.
2. Do not connect a personal/test account unless it is explicitly the intended publishing target.
3. Then rerun Increment A read-only verification:
   - exact account ID and handle;
   - Business/Creator eligibility;
   - ownership/account match;
   - available read capabilities;
   - publishing action availability;
   - zero-write confirmation.
4. Stop before any publishing action.
5. Separately reconcile PR #630 against current `main` before considering merge.

## Launch-time gates still held

- then-current Daily selection;
- then-current Weekly Score selection;
- reliable real-device motion QA;
- live CTA route verification;
- then-current product-state verification;
- final editorial/compliance sign-off;
- publishing account ownership/recovery verification.

## Safe continuation prompt

Use:

> Resume the USD Impact Instagram project from `docs/operations/instagram-resume-point-2026-09-18.md`. Refresh PR #630 and current main first. Do not merge, deploy, connect Meta, schedule or publish unless separately authorized. If the Windsor Instagram account is now connected, rerun Increment A read-only provider verification and stop before writes.

This file is intended to make the original conversation unnecessary for future continuation.
