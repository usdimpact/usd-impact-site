# Issue #950 — Coordinated finalizer: recovery-first application-layer review

**Status:** Draft, offline fixture ONLY. **Not imported by any live route, scheduled job, or Production build entrypoint.**
**Reviewed:** 2026-10-29; based on [Draft #972](https://github.com/usdimpact/usd-impact-site/pull/972) and inherited SQL/CI snapshots.

## Source composition

The new `account-deletion-coordinated-offline-candidate.js` connects existing reviewed building blocks without changing current runtime behavior:

1. Verify canonical Development project, `mode=offline_fixture`, non-Production state, explicit injection of HTTP-shaped database transport, Auth stub and durable-outbox stub; reject before network if any dependency is missing. No ambient credentials or global HTTP.
2. Run bounded pending completion-escrow recovery **first**. Every recovered recipient is converted into the **existing** email outbox identity. Persist through the injected governed outbox writer and demand an exact match. Re-acknowledge the private escrow only with SQL RPC confirmation after the durable outbox identity is verified.
3. If any recovery remains uncertain or mismatched, **do not initiate any new Auth work** during this execution. A response-loss after outbox persistence must not be treated as confirmed success.
4. Only with no unresolved recovery, scan new due profiles. The coordinated batch opts into an explicit **halt-on-first-manual-review** policy. If a newly encountered Auth outcome or completion-outbox acknowledgment becomes uncertain, later due candidates are deferred rather than processed. The result distinguishes total scanned, processed and deferred rows. Ordinary claim conflicts do not require the same stop. Require deletion request UUID, canonical non-null Auth link, due/cancellation revalidation and exclusive SQL claim. A committed one-shot Auth handoff precedes exactly one injected synthetic Auth call; no automatic repeat for 404/503/timeout/unknown outcome.
5. After confirmed SQL erasure, use the **same** exported verified completion receipt function as older recovery items. Report a deletion as fully finalized only if the exact governed outbox record exists and SQL independently confirms that its account/request/recipient/version match the pending escrow.
6. The due batch binds each finalized account to its original deletion request UUID, preventing a cross-request escrow acknowledgment. Report only opaque account references and stable error codes; no customer identity, recipient, claim token or raw UUID in public result.

The shared `recordOfflineCompletionOutbox` helper eliminates divergent new-deletion and recovery paths. Existing `runOfflineCompletionRecovery` tests still run unchanged. New end-to-end mock suite verifies RLS-independent mocked claim, completion first, ordinary finalization, Auth 404, stale scans, an outbox ACK failing after insertion and then succeeding through recovery using the same idempotency key, and blocking new Auth attempts when old recovery fails.

## Explicit security boundary

The candidate is **not** a deployable finalizer. In particular it does NOT provide an actual GoTrue provider adapter, Supabase service-role credential handling, real migration, real-storage object cleanup, session/JWT revocation, durable outbound message dispatch, operator incident tooling or Production feature flags. The existing scheduled finalizer remains on the unfenced old RPC and **must not be activated with the proposed SQL**.

The static CI guard allows only two explicitly declared offline source imports: due-batch -> fenced protocol and coordinator -> due-batch + completion recovery. No API, middleware, other app source or executable SQL migration may import/deploy the candidate.

## Remaining gated work

- Actual **independent isolated restore** of a completed Development backup, with 21 separate Storage file objects, nine Auth identities protected, no outbound side effects and owner-approved cost.
- Independent SQL/RLS/security/privacy and DBA review, especially temporary recipient escrow retention.
- Real Development synthetic-only PostgREST and GoTrue/Storage/JWT acceptance, including one-shot Auth HTTP headers and JSON body.
- A coordinated and separately approved claim-aware production finalizer, migration and rollback plan. Green source-level tests and Vercel Preview do **not** lift the current HOLD.

**No PR merge, live DDL/DML, billable restore, Auth Admin call, email, payment, entitlement, Research/Score, scheduler or Production deployment performed.**
