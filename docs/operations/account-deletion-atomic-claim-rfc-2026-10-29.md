# Issue #950 — Atomic account-deletion claim, Auth handoff and recovery RFC (review only)

**Date:** 2026-10-29  
**Status:** Proposed design, not an implementation or migration approval  
**Base:** protected main \`06e185d39b4768e1f2ab8aeabccd63b531bf1435\`  
**Reviewed integration:** Draft #952, exact head \`2a42ddc494dd81d59f3d4e34c37af27969223675\` (25/25 offline workflows green; Preview READY).  
**Scope:** No executable SQL, application change, actual identity operation, email, database mutation, merge or Production activation.

## Decision summary

1. **Separate the irreversible Auth handoff from a renewable pre-dispatch lease.** A unique service-only claim is created under a PostgreSQL transaction/row lock. Only the owner holding the current token and request generation can move it into the irreversible Auth-dispatch phase. Once dispatched, no automatic lease takeover or retry of Auth DELETE is permitted on timeout or ambiguous response.
2. **Detach the Auth FK only in the same fenced transaction that marks the operation as dispatched**, not in an independent, repeatably-successful \`prepare_account_deletion_auth_removal(uuid)\` call. Store the expected original Auth UUID in the private attempt before detachment. Do not infer successful Auth removal from a NULL profile link.
3. **Finalization must be claim-bound** to the same request generation, account ID, Auth UUID and token after a verified external result. The current \`finalize_account_deletion(uuid)\` and old preparation entrypoints must be retired, made fail-closed or routed through enforced claim checks in the eventual reviewed migration, so they cannot bypass the new contract.
4. **Do not promise cancellation after a claim is accepted.** An authorized cancellation/reschedule can succeed only before a claim. A competing or later cancellation must fail visibly, not silently change the profile. A public cancellation RPC does not exist in the inspected Development database; cancellation is a product/implementation decision, not a present feature.
5. **Soft-delete and access revocation require separate live synthetic acceptance.** JSON \`{"should_soft_delete":true}\` is the correct requested Auth protocol, but a soft-deleted Auth row remains in place. The exact effects on refresh sessions, still-valid JWTs and Storage ownership must be verified. Application authorization must not rely only on presence/absence of an Auth row or on a detached FK.

This RFC is intentionally stricter than a time-limited worker lease. A PostgreSQL transaction cannot atomically commit an external Auth HTTP call, so the design guarantees *exclusive database authority to initiate* an Auth operation, not cross-system exactly-once delivery.

## Verified baseline (read-only Development catalog and exact source)

- \`public.profiles\` has statuses \`active | suspended | deletion_pending | deleted\`, request/due timestamps and nullable \`auth_user_id\`. It has no deletion-claim column or request-generation UUID. Its Auth FK is \`ON DELETE SET NULL\`, which does not detach on an Auth soft-delete. Existing check \`profiles_auth_link_state\` permits NULL Auth links during \`deletion_pending\`, requires a canonical link for active/suspended profiles and NULL after deletion.
- \`public.request_account_deletion()\` is \`SECURITY DEFINER\`, available to \`authenticated\`, and creates a seven-day pending request from an active account. \`public.profiles\` has own-profile SELECT/RLS, not direct authenticated profile UPDATE. No cancellation RPC was found among the public functions.
- \`public.prepare_account_deletion_auth_removal(uuid)\` is \`SECURITY DEFINER\`, executable by \`service_role\` only among tested API roles; it takes a transaction-scoped \`FOR UPDATE\`, validates due state, detaches \`auth_user_id\`, and may return \`true\` again for an already-NULL link. **It is not a worker claim.**
- \`public.finalize_account_deletion(uuid)\` is \`service_role\` only, checks due status and \`auth_user_id IS NULL\` under a row lock, scrubs profile/child records and updates entitlements. **It does not authenticate a previous worker claim.**
- Draft #951 corrects the preparation and explicit Auth JSON request; Draft #952 integrates it into the full no-send candidate. Both are Draft/unmerged. Their synthetic CI does not prove cross-system exclusion, Auth credential acceptance or session revocation.
- Read-only Development inspection only: no schema, claims, identities, emails, flags or entitlements were modified.

## Proposed storage and API boundary (not yet approved)

Use a **non-exposed application-private schema** (name chosen only after schema/exposure audit) for an append-only/minimally mutable deletion-attempt record, keyed to \`account_id\` and a *new stable deletion_request_id UUID* minted when a user initiates a deletion request. The existing request timestamps are useful snapshots but not a sufficient anti-ABA version by themselves.

Suggested private fields: \`account_id\`, \`deletion_request_id\`, \`attempt_id\`, \`generation\` (monotonic), \`claim_token_digest\` (never plain token in logs), \`claim_owner\` (opaque worker nonce), \`expected_auth_user_id\`, \`requested_at\`, \`due_at\`, \`state\`, \`claimed_at\`, \`pre_dispatch_expires_at\`, \`dispatched_at\`, \`auth_outcome_at\`, \`finalized_at\`, \`last_error_code\`, \`audit_reference\`.

Constraints/invariants:
- At most one current claim per account/request; enforce with a database uniqueness constraint and locked state transitions, not a SELECT-then-INSERT in application code.
- A new request ID/generation invalidates all old tokens. Compare all of account, request ID, expected identity, token digest and generation in every claim-bound function. Persist the token only server-side, never in browser, notification, Vercel logs or support messages.
- A claim's \`claimed\` lease can expire and be reissued only **before** a committed dispatch. After \`auth_dispatched\`, expiry is NOT permission for another worker to make a DELETE. Use reconciliation/manual escalation.
- The claim table is unexposed and should use defense-in-depth RLS and tightly scoped grants. Because PostgREST cannot call non-exposed private RPCs directly, any needed exposed \`public\` wrapper must be **service-role-only**, with explicit \`REVOKE ... FROM PUBLIC, anon, authenticated\`, a fixed empty search_path, fully qualified names and audited \`EXECUTE\` privileges. No browser/service-role key is embedded in SQL or public JS.
- The existing plain-UUID \`prepare_account_deletion_auth_removal\` and \`finalize_account_deletion\` functions must **not** remain callable as bypasses once the claim-bound system becomes authoritative. Design and order the cutover/migration around the always-OFF scheduler and backwards compatibility.

Suggested service-only RPC interface (names illustrative; no signatures approved):
1. \`claim_due_account_deletion(account_id, scanned_request_id, worker_nonce)\` returns one unpredictable one-use token and verified request/identity snapshot, or an explicit no-claim/conflict. One transaction locks profile and claim state, validates due/pending/not-deleted, matches request ID, preserves canonical Auth identity and writes unique claim.
2. \`begin_claimed_auth_removal(account_id, request_id, token, generation)\` locks the same profile/attempt, validates all identity/version/status data, requires an unexpired \`claimed\` state, detaches the FK **and commits a unique \`auth_dispatched\` intent in the same transaction**. The old boolean preparation function is no longer called independently. If request is stale, Auth identity mismatches, link was already NULL without a proven earlier dispatch, or conflict is ambiguous: fail closed and reconcile.
3. Worker sends exactly one \`DELETE /auth/v1/admin/users/<saved_auth_uuid>\`, HTTPS on canonical Development origin, JSON body \`{"should_soft_delete":true}\`. Verify Auth Admin credential protocol independently; never infer it from PostgREST header success.
4. \`record_claimed_auth_outcome(...token, generation, verified_result)\` marks proven soft-deletion/accepted missing-user results under a lock. Mere transport timeout, unavailable JSON or detached FK means **ambiguous**, not success. On 404, require separately accepted proof and stable identity/project association before treating as already absent.
5. \`finalize_claimed_account_deletion(...token, generation)\` revalidates the same claim and proven Auth result, then performs the existing erase/tombstone/audit/outbox work idempotently within its appropriate transaction boundaries. Durable email enqueue remains outside Auth and must use one stable per-request idempotency key.
6. Reconciliation is a **distinct service-only operator path** for \`auth_dispatched\` unknowns, potentially using an independently verified Auth Admin read; it must never blindly resend DELETE, recreate the old FK, reset entitlements or forge successful completion.

## State-transition contract

| Current state | Event | Result | Auth DELETE authorized? |
| --- | --- | --- | --- |
| eligible (no claim) | valid due worker claim | claimed | No |
| eligible | valid cancellation/reschedule before claim | cancelled or rescheduled, old version revoked | No |
| claimed | duplicate worker claim | conflict / no token | No |
| claimed | cancellation/reschedule request | explicit conflict, do not say success | No |
| claimed | pre-dispatch lease expiry, no dispatch committed | safely reissue higher generation after row lock | No, until new owner begins dispatch |
| claimed | owner atomically confirms token + version and detaches FK | auth_dispatched | **One** external attempt by owner |
| auth_dispatched | second worker, expired lease or duplicate trigger | conflict / manual reconciliation | No new automatic DELETE |
| auth_dispatched | Auth success with verified identity | auth_confirmed | No further DELETE |
| auth_dispatched | timeout, 503, malformed response or unknown outcome | auth_ambiguous / manual_review | No automatic retry |
| auth_dispatched | 404 without independent accepted evidence | manual_review | No automatic retry |
| auth_confirmed | matching token/version finalization | finalized | No |
| finalized | any repeat invocation | idempotent completion, no second email | No |

The first irreversible boundary is the committed \`auth_dispatched\` transition, not the HTTP response. A crash between this commit and the actual network send may require manual reconciliation; this is preferable to two workers unknowingly deleting the same identity. If automatic reconciliation is later proposed, its safety proof and failure cases need a separate review.

## Cancellation / authorization decisions pending

There is no inspected customer cancellation RPC; do not add UI wording promising it. A future \`cancel_account_deletion\` implementation must lock the same profile and attempt rows, check caller ownership, status, pending request ID and absence of an active claim; only then atomically cancel and invalidate the version. Before claim, support cancellation without falsely implying identity was deleted. After claim or dispatch, show a clear conflict and route to support; do not mutate the Auth link or deletion version behind the worker.

All protected application paths need a current account status authorization guard even when a previously issued JWT remains cryptographically valid. Review all member-content, account, support, Storage and entitlement endpoints against \`deletion_pending\`, \`auth_dispatched\`, and \`deleted\`. JWT \`session_id\`/Auth sessions and refresh revocation must be assessed with the supported Supabase flow, not assumed from profile FK detachment.

## Exact acceptance matrix and stop rules

**Offline deterministic tests** before any Development SQL: 2/10/100 simultaneous claim attempts; unique token and generation; stale scan/request ABA; revoked token and forged token; duplicate \`begin\` and finalize; cancellation-vs-claim in both orders; claimed lease expiry with stale worker; failure between detachment and HTTP; crash after dispatch before HTTP; timeout/connection reset/2xx/404/409/429/503; malformed and empty Auth responses; duplicate finalization and email outbox; NULL/mismatched Auth FK, missing/duplicate rows; canonical project and secret-header negative cases; no log of PII or secrets. Explicitly assert no Auth DELETE on all invalid claim paths.

**Protected Development-only acceptance, separately authorized:** dedicated synthetic identity only; verify claim exclusivity against real PostgreSQL transactions and PostgREST RPC; verified soft-delete body + actual Auth Admin opaque-key header; with/without Storage-owned objects; stale access JWT, session ID and refresh behavior; account/member-content denial after transition; outbox dedupe and privacy retention; escrowed cleanup checklist and precise starting state; abort on missing credential/fixture guarantee. **Never** target a real user or infer success from mocks.

**Release/rollback gates:** Design review; distinct migration PR and approval; DEVELOPMENT database migration plus verification of RLS/grants/advisors; exact-head negative CI; independent protected synthetic live test; code/schema cutover rehearsal; recovery/runbook and destructive-operation rollback boundary; fresh Production read-only preflight; separately authorized Production schema/cutover/flag/deletion activation. Once Auth has been dispatched, rollback must be manual reconciliation; never automatically reattach the FK, recreate a user, or re-enable entitlements.

**Explicit hard HOLD:** no schema migration/DDL/DML, no claim RPC deployment, no real Auth Admin request, no Production merge or deployment, no scheduled finalizer, no notification send, no payment/entitlement/Research/Score/consent change. The separate webhook PostgREST two-PATCH live concurrency check and device passkey QA are not satisfied by this RFC.

## Evidence links

- [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) — required claim/fence and live identity acceptance.
- [Draft #951](https://github.com/usdimpact/usd-impact-site/pull/951) — reviewed prepare + explicit JSON soft-delete.
- [Draft #952](https://github.com/usdimpact/usd-impact-site/pull/952) — 25/25 green source-only combined integration; not a release.
- [Existing finalizer on the integration branch](https://github.com/usdimpact/usd-impact-site/blob/2a42ddc494dd81d59f3d4e34c37af27969223675/apps/web/src/lib/account-deletion-finalizer.js).
- [Existing database migration](https://github.com/usdimpact/usd-impact-site/blob/main/supabase/migrations/20260821195116_harden_account_deletion_auth_link_and_recovery.sql).
- [Supabase: Auth user management, JWT and Storage caveats](https://supabase.com/docs/guides/auth/managing-user-data).
- [Supabase: sessions](https://supabase.com/docs/guides/auth/sessions).
- [Supabase: Auth Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).
