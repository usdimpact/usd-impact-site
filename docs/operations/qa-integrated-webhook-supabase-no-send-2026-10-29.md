# USD Impact — isolated webhook and Supabase no-send integration candidate

**Prepared:** 2026-10-29  
**Related:** [Issue #620](https://github.com/usdimpact/usd-impact-site/issues/620)  
**Disposition:** Development-only, read/test/Preview candidate. **NOT a merge queue, Production deployment, email activation, or live HTTP acceptance.**

## Source-provenance snapshot

This branch began from protected `main` commit `06e185d39b4768e1f2ab8aeabccd63b531bf1435`. The 38 reviewed, nonoverlapping file blobs below were overlaid **directly** from each exact GitHub Draft PR head. No source PR was merged; the integration branch does not claim their independent branches have been rebased.

| Source Draft PR | Exact reviewed head SHA | Scope |
|---|---|---|
| [#935](https://github.com/usdimpact/usd-impact-site/pull/935) | `f2bd8a0c2308366779cf424a9251f027228246e6` | protected manual Development HTTP CAS runner; offline tests |
| [#936](https://github.com/usdimpact/usd-impact-site/pull/936) | `5f2951e1d44bf130c08ea99096bf628d4f7a12ce` | webhook receipt `status`/`attempt_count` CAS |
| [#937](https://github.com/usdimpact/usd-impact-site/pull/937) | `3bd7bc1bf08dedbc6833fe622c92f53460036414` | common account and Guided Supabase REST headers |
| [#940](https://github.com/usdimpact/usd-impact-site/pull/940) | `060431c4b7d79de5b5157db512261cfbf4b8a0b4` | Weekly, Progress and marketing preference REST headers |
| [#941](https://github.com/usdimpact/usd-impact-site/pull/941) | `e6319be7d01f7017559c7d1b236a03036eb29181` | launch-email ledger, opt-in, waitlist REST headers |
| [#942](https://github.com/usdimpact/usd-impact-site/pull/942) | `fbaa17c00bc53b71f75e49cfbd4562018cc00976` | Weekly canary read-state REST header |
| [#943](https://github.com/usdimpact/usd-impact-site/pull/943) | `5db82f759f2995977a804781687603b7fa3fa958` | opt-in delivery and unsubscribe REST-vs-Resend auth |

**Excluded:** #930 real-device passkey acceptance remains deferred; #931 unauthorized lifecycle cron guard and #934 additional Progress consent negatives were not overlaid, and must be integrated/reverified separately. No account deletion, Research Membership, payment, entitlement, Score, or Production email activation code was changed.

## Research-derived assessment (subject to empirical verification)

The available Deep Research cross-check (not the inaccessible original report) concluded that the next obstacle is **Development acceptance evidence, not permission to activate Production**. The PostgREST HTTP CAS check from #935 has only passed offline: a prior isolated authenticated call was stopped by platform safety checks, its synthetic row was deleted and its temporary function retired. **Do not retry the blocked route or claim the real concurrent HTTP acceptance passed.** Treat the [#936](https://github.com/usdimpact/usd-impact-site/pull/936) receipt CAS fix as a separate response-level safety improvement requiring combined tests.

Supabase's [API-key guide](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes modern opaque `sb_secret_` and `sb_publishable_` gateway keys from user and legacy JWT credentials. The combined branch ensures the separately reviewed code paths agree on the `apikey` vs Bearer contract. Resend's own bearer-token API is distinct and must not be silently altered.

GitHub's [environment-protection documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) supports reviewer-gated secrets, but availability and the actual configured rules must be checked before any credential-bearing run. This **integration PR has no secret-bearing job or manual dispatch**.

## Acceptance criteria — offline integration only

- PR-only CI checks the exact combined source snapshot, using Node 24 and pinned repository dependencies.
- Every synthetic webhook race regression passes: no terminal receipt resurrection, stale send completion or conflicting success.
- REST header behavior remains valid for user JWTs, opaque public/secret Supabase keys, legacy JWTs, and separate Resend provider credentials.
- Weekly, Learning Progress, consent, opt-in, waitlist, and unsubscribe tests continue rejecting Production and unauthorized send paths.
- No real Supabase/Resend credentials, user identifiers, provider calls, SQL mutations or real email sends are used. The QA-only CLI `--live` mode is **never invoked**.
- At completion, inspect exact GitHub workflow run conclusions and confirm that protected `main`/Production Vercel deployment have not changed.
- A build-ready automatic **Vercel Preview is not evidence of end-to-end membership, passkey or Production delivery acceptance**.

## Unresolved release gates and rollback

1. Live Development PostgREST two-PATCH race remains **BLOCKED / NOT TESTED** until a supported approved protected environment and secure credentials can be used without bypassing platform restrictions.
2. Passkey WebAuthn/browser/device testing remains **deferred**, not passed.
3. The ten original Drafts need their own review and dependency-aware integration decisions before any merge; absence of file-path conflicts does not prove behavior compatibility.
4. All Production Weekly and Learning Progress delivery flags and actual send paths remain **OFF/HOLD**.
5. This branch is disposable. If CI fails, correct only this isolated integration branch or abandon it; **do not merge it into `main`**. Deleting the branch (if approved) is the rollback; no database or email rollback should be needed because tests must remain offline.
6. Any future live HTTP test, Production deployment, email activation, Research entitlement modification or paid-commerce change is a separate authorization and security event.

## Follow-up outside this branch

Perform a dedicated **read-only** Auth Admin versus PostgREST header audit of `account-deletion-finalizer.js`, `lifecycle-qa-handler.js`, and Research Membership persistence; never blanket-remove Bearer from `/auth/v1/` endpoints. If a real defect is proven, create separate minimal Draft PRs with synthetic negative tests.
