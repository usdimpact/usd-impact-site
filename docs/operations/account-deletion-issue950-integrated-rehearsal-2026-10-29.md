# Issue #950 — Combined QA snapshot with explicit default-off enforcement

**Date:** 2026-10-29. **Disposition:** combined offline QA, not a release.

The protected integration candidate contains the reviewed earlier 28 successful lifecycle/Research/webhook/email/security workflows plus the additional Issue #950 tests:

- **Cross-layer PG-WASM:** disposable in-memory PostgreSQL executes the actual claim SQL and stale-JWT RLS SQL via the dormant JS client and mocked PostgREST; verifies SQL request/response shape, 100 serialized claim contenders, Auth handoff uncertainty, 404 and direct JWT/RLS denial.
- **Independent PostgreSQL 17 clients:** disposable PostgreSQL container in CI, with 24 simultaneous independent claim clients and 16 lease-reclaim clients, plus cancellation/claim races and legacy RPC denial. No live Supabase/PostgREST or Auth Admin.
- **Bounded due batch:** dormant GET scan requires a matching non-null Auth link and stable request UUID, validates the entire snapshot before claims, uses a strict five-row fixture limit and returns opaque final/claim-conflict/manual-review summaries. No live scheduler integration.
- **New static activation invariant:** fail if any actual API or source code outside the dormant candidate batch module imports either account-deletion candidate, if their SQL review files appear in `supabase/migrations`, if a new deletion cron appears, if the old finalizer no longer defaults off, or if injected IO / canonical Development guards are relaxed.

**Known difference:** Existing `apps/web/src/lib/account-deletion-finalizer.js` still calls the old nonexclusive preparation and finalization RPCs and is NOT compatible with the proposed SQL's deliberate disabling of those RPCs. It cannot be activated. The source-only claim adapter, due scanner and recovery diagnostics still require approved integration and a durable reconciler.

No PGlite or disposable PostgreSQL test establishes actual Supabase/PostgREST concurrent HTTP behavior, Auth Admin opaque-key protocol, Auth session/Storage/JWT revocation or full live erasure/notification. A real Development synthetic identity and migration are blocked pending separate approvals, and Production cannot be activated from this integration snapshot.

**HARD HOLD:** no actual SQL migration/DDL/DML, no real user or Auth deletion, no email, no PR merge, no flags/cron, no Production Vercel deployment, no commerce/Research/Score or entitlement change.

Refs: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Draft #958](https://github.com/usdimpact/usd-impact-site/pull/958), [Draft #960](https://github.com/usdimpact/usd-impact-site/pull/960), [Draft #961](https://github.com/usdimpact/usd-impact-site/pull/961).
