# Issue #950 — Confirmed Auth state, worker-token loss: manual recovery candidate

**Status:** source-only design and disposable PostgreSQL QA, NOT an executable Supabase migration.
**Date:** 2026-10-29. Parent: [Draft #966](https://github.com/usdimpact/usd-impact-site/pull/966).

## Why this is distinct from Auth ambiguity

After a service worker receives a definite Auth Admin 200/204 and successfully commits the existing token-fenced SQL \`confirm_claimed_auth_soft_delete\`, the attempt is \`auth_confirmed\`. The worker can crash before calling token-fenced \`finalize_claimed_account_deletion\`, losing its only plaintext worker token. The DB deliberately stores only the token digest. This state must not be recovered by blindly replaying Auth DELETE, making a fresh claim, reversing the Auth FK detachment, or invoking the old plain-ID erasure procedure.

**Only an Auth-confirmed attempt** is eligible for the new candidate. A lost confirmation response can leave SQL in \`auth_dispatched\` or \`auth_ambiguous\`; those remain **manual investigation HARD HOLD**, NOT eligible for the recovery below.

## Proposed narrow database-only behavior

The source-only \`docs/operations/candidates/account-deletion-confirmed-tokenloss-recovery.review.sql\` is applied after the prior claim and escrow proposals in a disposable CI fixture ONLY. It:

- Factors the existing **post-confirmed** erasure, temporary notification escrow and finalized-state transition into **one private shared SQL helper**, so normal token-authorized finalization and exceptional DBA recovery take the same transactional path.
- Preserves the existing **public service-only four-argument token-fenced finalization** entrypoint and its digest verification. It must continue to reject missing, stale, mismatched and replayed tokens.
- Introduces a new unexposed \`account_deletion_internal.recover_confirmed_without_token\` function as **SECURITY INVOKER**, no \`PUBLIC\`, \`anon\`, \`authenticated\` or \`service_role\` EXECUTE and no API-schema exposure. It checks \`current_user = 'postgres'\`, exact account/request/attempt UUID/generation, already-token-confirmed state, original due/deletion timestamps, expected Auth UUID, NULL Auth link, non-finalized profile, and non-null valid Auth-confirmation timestamps. It NEVER calls Auth Admin and cannot transition \`auth_dispatched\` or \`auth_ambiguous\` to \`auth_confirmed\`.
- Requires **two distinct review-ticket references**, representing externally approved change/security reviews, and inserts a no-recipient private \`confirmed_recovery_audit\` row. **Ticket strings are audit metadata, not automated evidence of human approval.** Two actual reviewers must sign off outside this SQL before any future invocation.
- Executes the original protected erasure, completion-recipient escrow, finalized-state transition and operator audit within ONE SQL transaction. Any escrow/audit failure rolls back erasure and prevents the operation being reported as complete.
- Returns only \`true\`; it does not return recipient email to the operator. Completion notification is subsequently handled by the separate existing governed outbox recovery, not by this function.

## Tests and residual risk

The no-secret PGlite test exercises: regular token path still works, confirmed token-loss manual path, wrong attempt/request/generation, duplicate recovery, actual service-role EXECUTE denial, refusal of \`auth_dispatched\` and \`auth_ambiguous\`, distinct provenance ticket validation, private RLS/ACL, and erasure rollback if the final operator-audit INSERT fails. All synthetic UUIDs and invalid domains are fixtures only.

The separate `apps/web/scripts/test-account-deletion-pg17-tokenloss-race.mjs` and PR-only PostgreSQL 17 workflow additionally run the exact three review SQL files in a fresh, disposable PostgreSQL service. Two independent `psql` sessions race the same confirmed recovery and must produce exactly one successful finalized attempt and one rejected contender. The test checks the private audit, completion escrow, token-fenced normal path, service-role and authenticated-role denial, plus rejection of both `auth_dispatched` and `auth_ambiguous`. This is not a real Supabase PostgREST or GoTrue proof.

**This is not evidence of actual reviewer signoff, live GoTrue deletion, or a safe Production invocation.** A PostgreSQL superuser has extensive inherent authority; this function creates a transparent, auditable and narrowly conditioned route rather than granting new client or service-role power. Independent legal/security/DBA review, a documented operator ticket verification procedure, immutable external audit retention, actual backup/restore acceptance, and real synthetic Development Auth proof remain blockers.

## Release HOLD

No migration or SQL runs on an actual USD Impact Supabase project. No Production/Dev runtime wiring, user deletion, Auth Admin API call, provider email, cron change, payment/entitlement/Research/Score action, or PR merge is authorized. No automatic recovery for uncertain Auth outcomes. No irreversible external Auth action may be covered by a blind database rollback. The original [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) remains open.
