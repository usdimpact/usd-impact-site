# Issue #950 — Atomic deletion SQL candidate: implementation review

**Date:** 2026-10-29  
**Status:** REVIEW ONLY. No schema migration authorized; no real identity, message or provider call.  
**Upstream:** [Draft #953](https://github.com/usdimpact/usd-impact-site/pull/953) design RFC, [Draft #952](https://github.com/usdimpact/usd-impact-site/pull/952) last 25/25 no-send integrated snapshot.

The SQL is staged at **docs/operations/candidates/account-deletion-atomic-claim.review.sql** outside Supabase's migrations directory. It is not deployed or run automatically. A separate reviewed migration must be created through Supabase CLI after explicit permission; the authoring runtime does not have that CLI. Do not copy this candidate into a live SQL Editor and execute it.

## SQL proposal

- Adds **profiles.deletion_request_id**, minted within the existing authenticated request procedure to distinguish multiple requests by the same account (ABA avoidance).
- Creates an RLS-enabled, non-exposed internal attempts table storing request identity, expected Auth UUID, unique token digest, worker nonce, monotonic generation, dispatch phase and timestamps. No email or credentials are stored.
- **claim_due_account_deletion** locks the account profile and attempt, validates the request, due time and canonical Auth link. A second worker conflicts. An expired **pre-dispatch** attempt can be reissued only with an increased generation/token.
- **begin_claimed_auth_removal** checks token, request, generation, due time, expiry and identity, then atomically commits the one-shot **auth_dispatched** state and detaches the Auth foreign key. An interrupted response does not authorize an automatic HTTP retry.
- **confirm_claimed_auth_soft_delete** accepts only definite 200 or 204 status reported by the trusted worker. A 404 is not sufficient to finalize. **mark_claimed_auth_ambiguous** records an allowlisted non-PII failure and prohibits automatic takeover.
- **finalize_claimed_account_deletion** validates the same claim and a confirmed Auth outcome before invoking the existing erasure/tombstone finalization core in the same transaction.
- Moves legacy plain-ID prepare/finalize procedures into the non-exposed schema and replaces their public endpoints with fail-closed stubs. The profile trigger prevents late cancellation/reschedule or identity changes after claim, except fenced Auth detachment and verified finalization.
- Restricts new RPC execution to service_role, with browser-role EXECUTE explicitly revoked, internal schema USAGE revoked and RLS enabled.

## Verifications and limitations

- The included script **apps/web/scripts/test-account-deletion-atomic-claim-sql.mjs** runs candidate SQL only in an in-memory **PGlite** fixture from existing pinned dependencies, asserting PostgreSQL function semantics, grants, first-wins claims, stale token, 404, ambiguous outcomes, late cancellation conflict, claim expiry generation, and old-RPC denial. It sends no HTTP and uses synthetic UUIDs only.
- PGlite is **not** multi-connection PostgreSQL/PostgREST acceptance. A 100-worker Promise test cannot prove external concurrency, cancellation between actual network operations, or token effects in live Auth.
- The application finalizer on #951/#952 is intentionally **not updated** by this SQL-only candidate. Applying the SQL without the future claim-aware application adapter would disable finalization, by design. Any cutover must coordinate the SQL, app deployment, flags and a recovery rollback plan.
- A truly atomic cross-system Auth deletion cannot be guaranteed by PostgreSQL. After the committed dispatch intent, a crash may leave the result unknown. Manual or separately designed read-only reconciliation is required; blindly retrying DELETE is not authorized.
- No authenticated cancellation RPC is currently deployed; introducing one also requires a privacy-request closure design and clear customer UX. This SQL does not introduce a new browser cancellation function.
- Soft-delete protocol, actual Auth Admin opaque-key credentials, Storage ownership, existing JWT access tokens and session revocation still require separately approved synthetic-only Development acceptance.
- Supabase's announced **2026-10-30 Data API auto-exposure change** requires checking actual API availability and roles at live acceptance, independently of SQL EXECUTE. New private objects must not become browser-accessible.
- Current read-only Development preflight (2026-10-29): zero pending deletions and zero detached pending Auth links; built-in SHA-256 and UUID generators exist. Refresh this inspection before a separately approved migration.
- Current Development Security Advisors include a warning that the authenticated caller may invoke existing SECURITY DEFINER request_account_deletion. This access is intentional but must remain ownership-scoped and verified; do not confuse the warning with new browser access to claims.

## Gates required before merging or running any SQL

1. Independent SQL review: validate exact function signatures, dependency and trigger ordering, primary/foreign key constraints, RLS and default grants, scheduler/flags, legacy RPC consumers, request backfill and app serialization impact.
2. Obtain specific approval for a Development-only migration. Create a proper Supabase CLI migration in a dedicated PR and record the exact SHA. Re-run preflight before execution.
3. Independently develop a claim-aware application adapter with no automatic Auth re-dispatch and exact-response negative tests; never release the old finalizer with the new SQL.
4. Run real multi-connection Development Postgres/PostgREST concurrency acceptance only with authorized synthetic identities, safe cleanup, and proven no real user effects. Verify Auth Admin HTTP headers, JSON body, 404/503 ambiguity, JWT/session access and Storage-owned object behavior separately.
5. Require explicit Production schema/runtime/activation authorization, fail-closed rollback and manual recovery plan. A database rollback cannot undo a soft-deleted or hard-deleted Auth identity.

**HARD HOLD:** no source merge, SQL DDL/DML on any actual Supabase project, Auth Admin deletion, user-data mutation, email send, Production deployment, CRON activation, payment/entitlement/Score/Research change or device QA activation. Independent real webhook PostgREST race acceptance and physical passkey QA remain separate.
