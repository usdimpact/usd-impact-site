# Issue #950 — Ephemeral PostgreSQL 17 independent-connection claim race

**Date:** 2026-10-29. **Status:** review-only GitHub Actions test; neither Supabase Development nor Production is accessed.

## What improves over the prior PGlite tests

The prior PGlite tests exercised the proposed SQL and client contracts but serialized all work in one in-process PostgreSQL instance. The new source-only workflow launches a **disposable local PostgreSQL 17 CI service**, creates minimal synthetic schema/functions, applies the exact candidate SQL from Draft #954 to that disposable database, and uses independent `psql` processes to exercise real PostgreSQL row locks and transaction races.

The fixture is under `apps/web/scripts/fixtures/` and contains only synthetic schema prerequisites and a minimal mock of the original finalization function; it is NOT production database data or a real erasure test. The SQL candidate remains outside `supabase/migrations`. It cannot mutate a connected Supabase project.

## Independent-connection acceptance matrix

- Start 24 separate PostgreSQL clients to claim the same due synthetic account: require exactly one token, 23 claim conflicts and no duplicate ownership.
- Reject forged token before Auth-link detachment; verify a valid begin detaches the FK and commits `auth_dispatched`; repeat begin and second claim fail.
- Reject a synthetic Auth 404 as confirmed success; mark the attempt `auth_ambiguous`, then refuse later claims.
- Age only a pre-dispatch attempt (respecting `expiry > claimed_at`) and race 16 new clients: require exactly one incremented-generation token, reject stale token, allow one new begin, and reject cancellation while claimed.
- After a simulated confirmed 200, require matching claim token/generation for finalization and one `deleted` profile transition; forbid second finalization and old unfenced SQL endpoint.
- Cancel before claim; ensure a stale due-scan cannot obtain authority. Race cancellation and claim on independent connections and require one winner, never both.
- Reject not-yet-due requests and authenticated browser-role claim EXECUTE.

These tests **do not issue any Auth DELETE**; 200/404 are only local values supplied to SQL procedures. They prove a stronger database concurrency property but not exactly-once operations across PostgreSQL and external Auth, real Supabase/PostgREST project behavior, or JWT/session/Storage revocation.

## Security and operating constraints

No real API keys are present. The localhost PostgreSQL password in CI is a deliberately non-secret test fixture value; GitHub workflow has read-only repository permissions. It uses pinned GitHub Actions, the official PostgreSQL 17 Docker service and the GitHub-hosted Node 24 environment. There is no service-role credential, real user, direct email or external HTTP. This test does not authorize applying the SQL to Development or Production.

**Outstanding HOLD:** complete SQL security review and CLI-generated migration; coordinated claim-aware finalizer; actual Supabase/PostgREST protected Development HTTP concurrency; dedicated synthetic Auth Admin JSON soft-delete, session, Storage and cleanup acceptance; explicit Production release approval. Live deletion, email, payments, entitlements, Score and Research remain unchanged.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Draft #959](https://github.com/usdimpact/usd-impact-site/pull/959).
