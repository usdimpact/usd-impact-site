# Issue #950 — Dormant bounded due-account batch coordinator

**Date:** 2026-10-29. **State:** source-only / offline fixture / never imported by scheduler.

The proposed atomic-claim client in Draft #955 handles one supplied candidate but had no due-list scan, hard snapshot validation, batch limits or opaque batch diagnostics. The new `apps/web/src/lib/account-deletion-due-batch-candidate.js` addresses those source-level needs without changing live behavior.

## Bounded no-send sequence

1. Require `mode=offline_fixture`, non-Production canonical Supabase Development origin and explicitly injected GET/RPC, Auth and completion callbacks; no implicit global fetch or environment credential loading.
2. GET a bounded list of pending, due profiles with **non-NULL Auth link** and `deletion_request_id`, limited to five synthetic rows. A detached pending profile is excluded from the due scan and belongs to a separate reconciliation path.
3. Fail the **entire** scan before any Auth operation for malformed JSON, over-limit, duplicate accounts, missing request UUID, changed/missing Auth link, deleted marker, not-yet-due timestamp, or request date newer than due.
4. Invoke the existing dormant `runOfflineFencedDeletion` with one distinct worker nonce per eligible candidate. Actual SQL claim/fence remains the authority against status changes after scan; the snapshot alone is insufficient.
5. Convert only `CLAIM_NOT_GRANTED` to a non-destructive conflict. Any other failure after a possible claim/begin is `manual_review`; no retry or second Auth request in the same run.
6. Return counts and stable SHA-256 account references, **never names, email, raw UUID, key or token**, and use an injected durable completion recorder only after confirmed SQL finalization.

The offline tests cover one confirmed completion, one 404 ambiguity, one concurrent claim conflict, a subsequent stale scan that cannot repeat Auth, malformed/duplicate/over-limit snapshots, disabled/Production/wrong-origin guard, and scan/network errors. No email or real provider operation is attempted.

## Still mandatory

This batch coordinator is **not wired** to the existing cron handler or active finalizer. The SQL candidate still deliberately disables legacy plain-ID RPCs and must be migrated **only** alongside the approved claim-aware implementation. The diagnostics are not persisted to production support or audit ledgers; a future approved recovery ledger/reconciler must be designed to handle interruption between SQL dispatch and Auth HTTP response. Real multi-connection SQL test in Draft #960 runs on disposable PostgreSQL 17, not Supabase/PostgREST.

**No activation or destructive operation is approved.** Await independent SQL/RLS, coordinated finalizer, Development synthetic Auth acceptance, actual PostgREST contention, sessions/JWT/Storage, email recovery and Production release review.

Refs: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Draft #960](https://github.com/usdimpact/usd-impact-site/pull/960).
