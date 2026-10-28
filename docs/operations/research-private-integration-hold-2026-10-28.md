# Research private-report integration HOLD — consolidated Draft

**Date:** 2026-10-28
**Status:** Engineering test candidate only. No merge, Preview/Production activation, payment activity, rights approval, or customer data changes.
**Protected baseline:** `usdimpact/usd-impact-site` main refreshed to `995ad4f44ded6a52caaed5103f4e4d228f3b29e7` (the existing Draft retains current Daily News/Catalyst content).
**Mandatory unresolved decision:** [Score data rights, pipeline #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155).

## Why consolidate

Four stacked Drafts have individually passed exact-head CI, but a nested set of branches is difficult to review as one coherent security unit. This integration Draft is the **combined review surface** for:

| Draft | Reversible deliverable | Remains blocked |
| --- | --- | --- |
| [#920](https://github.com/usdimpact/usd-impact-site/pull/920) | 16-row public historical report source inventory, Git blob drift detection, candidate-only publication categories | Public/member rights classification |
| [#921](https://github.com/usdimpact/usd-impact-site/pull/921) | Offline synthetic Research session, entitlement, and private-report response simulation | Actual private route |
| [#922](https://github.com/usdimpact/usd-impact-site/pull/922) | Post-build scanner of public static output, sitemaps, feeds, and assets | Historical rights, caches, hypothetical unmarked content |
| [#923](https://github.com/usdimpact/usd-impact-site/pull/923) | Mock-origin typed metadata lookup, synthetic SHA-256 report body, negative authorization tests | Actual private storage and Data API permission verification |

This integration **does not** merge or close those Draft PRs. It adds an explicit hold-only non-activation tripwire to the stacked state.

## Fifth safety unit: runtime non-activation

`apps/web/scripts/audit-research-private-integration-hold.mjs --check` verifies:

1. The current rights governance gate remains `hold` for issue #155, with no decision receipt or named approval.
2. The Vercel `agent/*` auto-deploy exclusion remains false.
3. There is no Vercel private Research member-report rewrite, API action, direct API function, Astro member-report page, public asset source tree, or middleware activation.
4. Runtime code does not import the synthetic authorization/origin scripts, publication candidate policy, or static audit logic.
5. Existing Score member rewrite and private/no-store/noindex headers are preserved.
6. Astro remains in static mode and the intentionally public 2026-08-07 sample with 30-day minimum age stays unchanged.
7. The four upstream candidate/test scripts remain present and readable.

The checks operate on repository source/configuration only, with no external requests or secrets. Runtime-source scanning reports *only finding codes and counts*. A missing/unreadable configuration, unsupported runtime symlink, activated private route, rights state flip, or mock import produces HOLD and a nonzero `--check` exit.

`apps/web/scripts/test-research-private-integration-hold.mjs` uses synthetic temporary directories to prove negative cases. It never opens a real subscription, reads Production Supabase rows, or fetches provider data.

## Build/CI integration

- `npm run validate:reports` runs the synthetic mutation tests followed by the exact real-worktree hold audit.
- `npm run build` also invokes the hold audit *after* the public-artifact scan. This catches a direct build even if the full validation command is skipped.
- `vercel.json` remains unchanged; all `agent/*` branches are deliberately excluded from automatic Vercel deployment.
- Every successful result still includes `rightsState: HOLD` and `releaseAuthorized: false`. This is a safety-check PASS, **never** a publication approval.

## What is specifically not proven

This is not a full security proof of hypothetical unmarked content, a legal data-redistribution determination, a live CDN cache audit, a real Supabase RLS/storage test, a signed-in Development browser run, or acceptance of the first genuine independent paid Research subscriber. Existing 13 weekly and 3 monthly reports remain historical public outputs pending the separate rights disposition.

## Verified read-only Production entitlement and ACL audit

A **separate read-only Supabase audit on 2026-10-28** found eight active Research Membership entitlements: seven have one event each with `actor_type=admin`, while one active entitlement created on **2026-10-19 UTC** has **no matching entitlement-event row**. None of the eight has a linked purchase or subscription; there are zero Research purchases, subscriptions, and subscription-event rows. This is an **audit/provenance exception**, not evidence that the remaining entitlement is unauthorized or that a paid lifecycle was accepted.

The same read-only permission query confirmed that `score_member_assets`, `score_member_sessions`, and `score_handoff_tickets` have RLS enabled and direct `anon` / `authenticated` SELECT privilege **false**. `score_member_assets` has 58 records; no private body or customer identifiers were retrieved. RLS and grant inspection are **not** a substitute for live Development end-to-end authorization tests.

Full non-identifying evidence, reproducible read-only SQL, risk classification and stop conditions: [research-entitlement-provenance-readonly-audit-2026-10-28.md](research-entitlement-provenance-readonly-audit-2026-10-28.md). No repair/backfill, entitlement revoke, access change, webhook replay, provider purchase or direct Production mutation is authorized by this audit.

## Report-by-report access and rights decision packet

All **13 Weekly and 3 Monthly** historical reports now have an independent metadata-only, **undecided/HOLD** disposition row tied to the frozen source inventory and Git blob. Review decision packet: `docs/operations/research-historical-report-disposition-review-2026-10-28.md`; machine-readable packet: `apps/web/scripts/fixtures/research-historical-disposition-review-2026-10-28.json`. Synthetic tests deny unilateral "member-only" reclassification, historical URL removal, forged rights clearance and new Production flags. This is not a public or paid rights grant and changes no historical URL or content.

## Review gates and handoff

1. **Rights decision — HOLD:** written provider/counsel disposition for Score-derived material, historical public reports, the public sample, and the permitted scope of paid member distribution.
2. **Historical content decision — HOLD:** keep/redact/replace outcomes for every inventory entry; preserve provenance and handle existing public URLs explicitly.
3. **Private delivery architecture — candidate only:** choose a reviewed, server-only private origin, least-privilege database grants and RLS where appropriate, immutable artifact metadata, and no public provider/raw-data URLs.
4. **Development/Preview QA — not started:** real middleware/route, verified session and Research entitlement checks, anonymous and Library-only denial, expiry/refund state, HEAD, no-store/noindex, direct-origin denial, public-build/cache checks, TradingView exclusion, Library Pass independence.
5. **Production — not authorized:** separate exact-head review, approved rights receipt, QA evidence, cost confirmation, and explicit launch authorization. The genuine independent first paid subscriber remains under its existing read-only runbook.

**No existing Production deployment, data rights state, entitlement, subscription, purchase, webhook, payment, Library Pass resource, TradingView access, published historical report, or public sample was changed by this Draft.**
