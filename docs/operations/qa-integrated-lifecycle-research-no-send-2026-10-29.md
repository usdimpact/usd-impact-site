# Integrated no-send lifecycle and Research security acceptance — 2026-10-29

**Status:** Development-only Draft QA candidate; never merge or publish as a release.  
**Issue:** https://github.com/usdimpact/usd-impact-site/issues/620

## Input provenance

This branch is based on the exact no-send [integration Draft #944](https://github.com/usdimpact/usd-impact-site/pull/944) at `9b9e8be7a6196eb55d9041733d2907149cd85f10`, which already overlaid 38 reviewed files from #935/#936/#937/#940/#941/#942/#943 on the unchanged protected main `06e185d39b4768e1f2ab8aeabccd63b531bf1435`. Its **17/17 checks passed** at that exact head, including 18 offline scripts, CodeQL, Web quality and dependency review. This continuation overlays only 15 additional nonoverlapping exact source files:

| Source Draft | Reviewed head | Files | Boundary |
|---|---|---:|---|
| [#931](https://github.com/usdimpact/usd-impact-site/pull/931) | `f7549b37bf3ba84808512f8443d16d6cf4c054b5` | 3 | no unauthorized Weekly/Progress email crons or hard-coded send flags |
| [#934](https://github.com/usdimpact/usd-impact-site/pull/934) | `539fdf4ab76603014c07b3ce1e649786419b44f0` | 1 | additional negative Progress consent and Production hold tests |
| [#945](https://github.com/usdimpact/usd-impact-site/pull/945) | `d3afb08aecd940bdb68f53f54eda62257d3760a2` | 7 | Research Membership RPC key header, project pin and signed event replay |
| [#946](https://github.com/usdimpact/usd-impact-site/pull/946) | `9d6fee17d854cbc9f5bba8d081e462c176779444` | 4 | account-deletion PostgREST vs preserved Auth Admin headers |

The two new files here are the PR-only, no-secret integration workflow and this runbook, bringing the candidate to **57 files** over main. All source PRs remain Draft/unmerged. PRs #931/#934 start from an earlier base; their four file paths were checked against the intervening protected-main commit and do **not** overlap its modified files. They were copied as blobs and were **not** rebased/merged.

## Verified Development database boundaries (read-only)

- `public.apply_research_membership_transition(...)`: **SECURITY INVOKER**, `anon`/ `authenticated` have **no EXECUTE**, `service_role` has EXECUTE. The SQL locks the subscription row and checks product/provider/subscription identity, event key, expected state and entitlement linkage.
- `public.request_account_deletion()`: **SECURITY DEFINER**, `authenticated` EXECUTE only (no `anon`), and requires `auth.uid()` plus the caller's active profile.
- `public.finalize_account_deletion(uuid)`: **SECURITY DEFINER**, only `service_role` EXECUTE among those checked. It requires a due pending state and a detached Auth link before scrubbing.
- This inspection cannot certify business logic or underlying sessions against all race conditions. The linter's `request_account_deletion` warning requires intentional-privilege review rather than blindly revoking EXECUTE.

No schema, grants, RLS, user, entitlement or subscription data were modified.

## Acceptance — source and offline CI only

The PR-only `qa-integrated-lifecycle-research-no-send.yml` runs nine synthetic test scripts on the combined exact code:
1. Weekly cron/rewrite HOLD, hard-coded send flags and mandatory safeguards.
2. Learning Progress consent purpose, recipient, withdrawal, Production block and disallowed project.
3. Research Membership signed webhook execution and replay, persistence RPC body, 409 drift, opaque key header and Development/Production project isolation.
4. Account finalization's separate REST and Auth Admin protocols, due batch limits, cron and missing/invalid authorization, recoverable escalation and disabled Production lifecycle QA route.

The earlier combined `qa-integrated-webhook-supabase-no-send.yml` still executes its 18 synthetic scripts from #944. Other GitHub workflows for affected paths must also pass on the new exact head. All test HTTP responses are injected mocks; **do not invoke `--live` in the PostgREST CLI** and do not supply real GitHub/Supabase/Resend/Lemon Squeezy credentials.

## Release HOLD

1. The real Development PostgREST two-HTTP-PATCH concurrency test remains **BLOCKED/UNTESTED**, after a platform invocation safety refusal. Do not bypass.
2. The Auth Admin soft-delete protocol is **preserved but empirically unverified** with the modern opaque key. Account deletion has a **scan-to-Auth-soft-delete concurrency interval** before the final SQL RPC's due-state lock. A claim/revalidation design needs its own review before changing identity behavior.
3. Production Research Membership commerce, all entitlements, payments, Score, Weekly/Learning Progress sending and webhook activation remain **OFF/HOLD**. No live sends or identity/commerce mutations are authorized.
4. #930 passkey remember-me remains separate; visual QA is accepted but real-device ceremony and token refresh remain **DEFERRED**, never marked PASS.
5. GitHub CI green + Vercel Preview READY are **not** live provider acceptance or Production authorization. Any future merge to `main`, Production deployment, live protected acceptance or feature-flag change requires its own explicit release decision.

**Rollback:** the isolated QA branch can be left Draft/closed. Since its checks have no live side effects, there are no data or send operations to reverse.
