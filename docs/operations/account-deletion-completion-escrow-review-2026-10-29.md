# Issue #950 — Transactional completion recovery: new release blocker

**Date:** 2026-10-29. **Status:** Draft source-only candidate, NOT a Supabase migration; NO real database writes.

## Verified source/data contract gap

The existing completed-deletion flow performs two independent operations:
1. Database `finalize_account_deletion(uuid)` commits account profile erasure, entitlement revocation, privacy/support scrubbing and audit; its response includes the original recipient email.
2. Node calls `enqueueAccountDeletionCompletedEmail` to persist an outbox record. The existing recovery handler can sometimes use a post-failure support escalation.

If the process crashes after step 1 but before step 2 (or before escalation is created), the recipient no longer exists in the profile or scrubbed privacy/support rows, and the current system has no guaranteed durable record with which to enqueue a completion acknowledgment. Previously green mock and race tests did not simulate this precise crash boundary. Existing `notification_outbox` uniqueness is important but cannot make two independent commits atomic.

## Review-only proposed change

The new SQL source at `docs/operations/candidates/account-deletion-transactional-completion-escrow.review.sql` is intentionally **outside** `supabase/migrations/`. It extends the earlier atomic-claim SQL after explicit preflight:

- Creates private, RLS-enabled `account_deletion_internal.completion_intents` with one row per account and request, a minimal normalized recipient address, finalization timestamps and a pending/recorded state; direct access is revoked from API roles.
- Replaces only the proposed `finalize_claimed_account_deletion` body. It verifies the fence, invokes the original scrubbing core, **inserts the durable completion recovery intent in the same PostgreSQL transaction**, and marks the attempt finalized. Any escrow insert error rolls back the entire erasure transaction rather than leaving an unrecoverable deletion.
- Adds service-role-only, bounded `list_account_deletion_completion_recoveries`. It returns a recipient *only* while an already-finalized attempt is pending completion-outbox persistence. It does not resend Auth DELETE or email and must not be logged.
- Adds service-role-only `confirm_account_deletion_completion_outbox`. Before releasing the recipient, it verifies a genuinely existing `public.notification_outbox` row matching account ID, request, completion message/template, state version derived from the committed deletion timestamp, recipient, classification and minimal payload. The acknowledgment is idempotent only for the same outbox UUID.
- On durable outbox confirmation, the private recovery row **scrubs the recipient email**, leaving only opaque UUIDs, state and audit timestamps. The recipient remains in the existing governed email outbox, subject to the existing notification retention policy.

This is **not** an automatic email sender or a new permission to send. No application code is wired to the new RPCs. A separately approved recovery worker must reuse the existing `createAccountDeletionCompletedEmailIntent` / `enqueueLaunchEmailIntent` identity exactly, with the existing ledger flag and provider approval, then call the receipt-confirmation RPC only after the outbox row is verified. Never invent a new idempotency calculation in SQL.

## Offline acceptance

The disposable PostgreSQL-WASM test:
- Runs the earlier atomic-claim SQL and this new SQL against synthetic legacy functions.
- Completes a claim, Auth dispatch and synthetic confirmed success.
- Verifies finalization commits the scrubbed profile and private original recipient together; a simulated worker crash can recover the recipient through the bounded service RPC.
- Rejects missing/wrong outbox IDs and recipient mismatches; the original recipient remains pending until a matching outbox is actually durable.
- Verifies the matching receipt marks the completion recorded, scrubs the private recipient, and is idempotent for the same outbox but never a conflicting outbox.
- Forces a database trigger failure on escrow INSERT **after** the synthetic legacy core updates the profile. Asserts the entire transaction rolls back, preserving pre-erasure profile state and claim confirmation; retry after clearing the fixture error succeeds.
- Checks anonymous/authenticated EXECUTE is denied, service role only, and the private schema and table have no direct browser grants.

## Open privacy/security decisions

The private recovery escrow temporarily retains the recipient address *after* deletion until a durable acknowledgment is created. This requires explicit privacy/legal review, access logging, a defined retention/aging alert and data minimization policy before any Development migration. It is **not** sufficient to rely on an indefinite pending escrow; a failed/unavailable email ledger must raise a manual review alert, not silently keep personal data forever.

Also outstanding: independently reviewed actual PostgreSQL migration and rollback, real Dev/Production backup verification, legacy-RPC cutover, real Supabase HTTP Auth Admin headers and JSON, actual JWT/session/Storage acceptance, complete original erasure and notification outbox schema compatibility, and exact-head integration CI. The synthetic fixture does not prove full Production data erasure or live provider delivery.

**HARD HOLD:** no SQL application in real Supabase Development/Production, no real Auth user deletion, no email send, no user data tests, no Production deploy or merge/flags/cron/commerce/Research/Score changes.

Refs: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Draft #962](https://github.com/usdimpact/usd-impact-site/pull/962), [Supabase Auth user management](https://supabase.com/docs/guides/auth/managing-user-data).
