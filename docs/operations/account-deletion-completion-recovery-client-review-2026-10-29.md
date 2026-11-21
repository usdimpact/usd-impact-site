# Issue #950 — Dormant service-only completion recovery adapter

**Date:** 2026-10-29. **Status:** review only; no runtime/scheduler imports, no database mutation or email send.

The proposed SQL extension in Draft #963 creates a private completion intent **atomically with erasure**, so a worker crash after SQL finalization cannot irrevocably lose the original recipient. This Draft provides the missing unimported JavaScript recovery consumer for an **offline fixture only**.

## Contract

1. Require a canonical Development project, `mode=offline_fixture`, explicit non-Production guard, injected PostgREST transport and injected durable outbox writer. No implicit process.env/global fetch or provider adapter.
2. Call service-only `list_account_deletion_completion_recoveries` with a maximum of five records. This returns a temporary sensitive recipient; the consumer must not log raw records. Validate every row and reject duplicate accounts before any enqueue callback.
3. Reconstruct the **existing** `createAccountDeletionCompletedEmailIntent` exactly (message, business object, timestamp minute version, normalized address, idempotency key). Never invent a new SQL-side hashing implementation or a new notification identity.
4. Invoke a strictly injected `enqueueCompletion(intent)` callback. It must return an `enabled:true` result with a durable outbox UUID and all expected identity fields. Verify it with `verifyLaunchEmailOutboxIdentity`, and do NOT call Auth Admin, Resend or another provider here.
5. Only then POST service-only `confirm_account_deletion_completion_outbox`. SQL independently reads the actual outbox row, checks recipient/message/version/account, and scrubs the private escrow email.
6. If outbox enqueue fails, is disabled, returns a wrong identity, or the acknowledgment response is lost, return an **opaque manual_review** code with no PII/UUID in public results. Never claim success before a confirmed `true`. Retries reuse the exact existing outbox idempotency key; service-side SQL acknowledgment is idempotent for the same outbox ID.
7. The real process that dispatches transactional mail must continue to obey existing email ledger, responsibility, suppression, send authorization, idempotency and privacy retention policy. No live wiring in this Draft.

## Outstanding reviews

The temporary escrow retains recipient PII until the durable outbox is recorded. Set a reviewed maximum retention, failure alert and responsible operator before any migration. Test that existing `notification_outbox` retention purges recipient after the applicable period. A non-recorded escrow older than the accepted remediation window must escalate to privacy operations rather than persist indefinitely.

The adapter is offline-only and not imported by the current finalizer or scheduler. The current #962 integration's static activation guard remains authoritative. Actual SQL migration, encrypted backups/point-in-time restore evidence, finalizer cutover, real synthetic Development PostgREST/GoTrue acceptance, Auth session/JWT/Storage and Production approval all remain HOLD.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) and [Draft #963](https://github.com/usdimpact/usd-impact-site/pull/963).
