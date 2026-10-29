# Account deletion — pre-Auth snapshot revalidation (Development-only)

**Date:** 2026-10-29  
**Issue:** https://github.com/usdimpact/usd-impact-site/issues/620  
**Source dependency:** [Draft #946](https://github.com/usdimpact/usd-impact-site/pull/946), exact reviewed head `9d6fee17d854cbc9f5bba8d081e462c176779444`. This Draft is **stacked on #946**, not merged into protected main.

## Confirmed problem

The daily finalizer first selects a batch of due `profiles` in PostgREST and later calls `/auth/v1/admin/users/{id}?should_soft_delete=true` on each stored account ID. Prior to this Draft, it did not independently confirm whether the deletion request was still in `deletion_pending` and due at the instant before its external Auth Admin request. The subsequent `finalize_account_deletion(uuid)` RPC rechecks due state under a lock, **but that happens after the potentially irreversible Auth soft DELETE**.

The existing source uses a hard daily batch limit, durable completion outbox, and failure escalation. Those paths remain unchanged.

## New fail-closed preflight

A lightweight `readDeletionProfile` REST read now selects the identity, email, status, request and due times and deleted timestamp. Immediately before any Auth Admin DELETE:

- A valid UUID and current time are required.
- The scanned candidate and freshly reloaded profile must refer to **exactly the same account**.
- Current and scanned status must be `deletion_pending`; both timestamp pairs must parse and agree, with due time after request time and not later than `now`.
- The recipient email must remain present and match the scanned identity. A changed email or request timestamp is treated as a stale snapshot, even if the new request is also due.
- If the authoritative profile is already `deleted` with a valid completion timestamp, return `already_finalized` without contacting Auth Admin or writing another email.
- Any missing, changed, cancelled, rescheduled, malformed, or unavailable record returns a fail-closed error **before Auth DELETE, finalization RPC, outbox or a new privacy escalation**. The scheduler records a failed candidate code without exposing email or account ID.

Synthetic offline tests cover positive and negative preflight paths, existing idempotent completion, Auth failure/recovery, and batch/route holds. They use injected HTTP mocks; no credential or real account is accessed.

## Explicit limitation — STILL NOT atomic

This is **risk reduction**, not an atomic claim or proof of race freedom. An external Auth call cannot share an atomic PostgreSQL row lock with a later SQL finalization RPC. A cancel/reschedule could still occur between the new successful revalidation GET and the Auth DELETE; concurrent workers may both pass the recheck.

For a future stronger design, separately review and approve an idempotent **claim/fencing** state in the Development database, with conditional claim under a transaction/lock, claim ownership/version and expiry/recovery, cancellation semantics, a claim-bound finalization RPC, Auth Admin response reconciliation, and session/token invalidation. Prefer a minimal restricted RPC; do not grant broad browser UPDATE/EXECUTE access. Do not implement schema/enum changes or actual identity deletion without a separate protected security review.

Development `profiles.status` enum currently contains `active`, `suspended`, `deletion_pending`, and `deleted`; no `deletion_in_progress` state is present. A claim design therefore needs an explicit migration and careful compatibility handling. This PR does **not** add or change a database enum, migration, trigger, Auth Admin protocol or Production scheduler.

Supabase's [user management docs](https://supabase.com/docs/guides/auth/managing-user-data) additionally state that already-issued access JWTs can remain valid until expiry after Auth user deletion; user/session invalidation needs a separate acceptance plan. See [user sessions](https://supabase.com/docs/guides/auth/sessions).

## Required tests and release gates

- Run the standalone no-send pre-Auth snapshot suite, full account-deletion finalizer suite, bounded-batch, scheduler and lifecycle-route tests at the **exact PR commit**.
- Check Web quality, CodeQL and dependency review; mark release HOLD on any failure.
- Confirm protected `main` and Production Vercel remain unchanged; confirm no Production/email/entitlement flags were activated.
- **No live Auth Admin DELETE**, real user, real recipient, credential exposure, membership change, SQL mutation, PR merge or Production deployment.
- The unrelated real Development PostgREST webhook concurrency test remains **BLOCKED / UNTESTED**. Do not bypass platform safety controls.
- If accepted as a future release candidate, re-run combined no-send integration with the reviewed snapshot and then require a **distinct Production authorization**.

The more comprehensive claim/fencing design remains an explicit separate review gate and should not be inferred from a green synthetic test.
