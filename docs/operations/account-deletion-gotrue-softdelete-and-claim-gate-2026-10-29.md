# Issue #950 — Account deletion GoTrue protocol and atomic claim gate

**Date:** 2026-10-29
**Disposition:** Development-only **Draft** source implementation and synthetic QA. No SQL migration applied, no identity deleted, no Production activation.

## 1. Source evidence: the existing deployed contract is incomplete

The Development database (read-only `pg_get_functiondef` + grant inspection) contains:

- `public.request_account_deletion()`: SECURITY DEFINER, only `authenticated` EXECUTE among the checked browser/service roles. It changes the signed-in user's active profile to `deletion_pending`, due after seven days.
- `public.prepare_account_deletion_auth_removal(uuid)`: SECURITY DEFINER, only `service_role` EXECUTE. Takes `FOR UPDATE` on the profile, refuses a not-due/nonpending request, checks the link if present, and sets `profiles.auth_user_id=NULL`. It **returns boolean TRUE even when the link was already NULL** and does **not** provide a claim token, ownership, version or exclusive worker fencing.
- `public.finalize_account_deletion(uuid)`: SECURITY DEFINER, only `service_role` EXECUTE. Locks the profile, checks due state, and refuses any remaining `auth_user_id`. It deletes bookmarks/progress, tombstones entitlements, scrubs profile/support/privacy identity, and records audit evidence.

Existing `profiles.auth_user_id` references `auth.users(id)` with `ON DELETE SET NULL`. That FK action is for a **hard row deletion** only; it does **not** fire when the Auth row is merely soft-deleted.

The source prior to this Draft performed:
`GET due profiles` → `GET current profile` → **`DELETE /auth/v1/admin/users/{id}?should_soft_delete=true`** → `POST /rpc/finalize_account_deletion`.

Two verified problems:
1. The existing prepare RPC was never called by the scheduled finalizer. Successful soft deletion can leave `auth_user_id` set, in conflict with the finalization RPC's required null link.
2. Supabase's [GoTrue Admin handler](https://github.com/supabase/auth/blob/master/internal/api/admin.go) and official client [deleteUser source](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts) parse `should_soft_delete` from the DELETE **JSON body**. With no body the server defaults to a **hard delete**; the previous query-string value does not establish the intended soft-delete mode. This is a verified source-level compatibility bug, **not evidence that a live deletion or incident occurred**.

## 2. Contained Draft correction

The proposed source change, layered atop [Draft #948](https://github.com/usdimpact/usd-impact-site/pull/948), does the following **only after its earlier profile snapshot eligibility preflight**:

1. Calls exactly `POST /rest/v1/rpc/prepare_account_deletion_auth_removal` with `{"prepare_account_id":"<uuid>"}`, using the canonical per-environment Supabase origin and opaque `apikey` only.
2. Requires **HTTP 2xx with JSON boolean `true`**; a 204, false, null, object, 403, 409, 5xx or malformed response fails before the external Auth DELETE. This preparation RPC still performs no exclusive worker claim, and unknown/ambiguous network responses must be reconciled; no auto-activation.
3. Issues `DELETE /auth/v1/admin/users/<uuid>` with JSON `{"should_soft_delete":true}` and **no query-string flag**, using the existing, **separately unverified** Auth Admin header contract from Draft #946. This Draft does *not* introduce or share a live privileged credential.
4. Continues with the existing finalization RPC and durable completion outbox *only* after Auth success, preserving the failure/recovery/escalation logic.

The test adapter covers order, exact URL, explicit soft-delete body and fail-close behavior with **no real network**. Existing tests for due eligibility, batch bounds and recovery remain in place.

## 3. Critical unresolved race: prepare is NOT a claim

The current prepare function locks the row only during one database transaction and releases the lock before the separate Auth API call. Two workers can both receive `true`; a cancellation/status change could also occur after preparation. Its boolean result cannot be used as a fencing token. A good CI result here does not justify enabling the scheduler.

**Do not** treat NULL `auth_user_id` as proof of Auth deletion. It could mean a successful preparation followed by an external failure, with Auth still present. Do not simply reattach the link to “rollback,” or issue a second blind DELETE.

Before atomic claim can be implemented, resolve these design decisions under a separately reviewed **schema/identity gate**:

- Define claim table and function ownership in a non-exposed schema, or an equivalent explicit profile claim/version field; ensure RLS/default function grants cannot expose service-only claims to browsers.
- A **single transaction** must select and lock the target due profile, verify its request identity/version and Auth link, allocate a unique unpredictable claim UUID and assign worker ownership, creation time, expiry and state; return that token only to the server.
- Define monotonic state transitions: `eligible → claimed → auth_in_progress → auth_confirmed_or_missing → finalized`, with distinct `retryable_unknown` and `manual_review`. Concurrent claims must return a conflict and never both authorize Auth deletion.
- Atomically fence cancellation/reschedule against an existing claim. **There is no approved customer cancellation RPC in the inspected current source**; the desired cancellation policy is a design decision, not existing functionality.
- Require the original claim token/version at every next transaction. Never reassign a claimed deletion to another worker purely on wall-clock lease expiry after an Auth attempt may have started. Use a reconciler for ambiguous Auth network outcomes.
- Decide the supported Auth action (`should_soft_delete=true` preserves a user row; hard deletion physically removes it), session revocation, issued-JWT expiry boundary, Storage object ownership, and identity/PII retention. These must be tested against a dedicated synthetic Development identity with explicit approval and verified cleanup.
- Limit durable audit output to opaque references, claim state/version, timestamps and error codes; never log secrets or personal email.
- Preserve existing default-off finalizer/cron guards and manual recoverable outbox semantics.

A mere retry loop, (FOR UPDATE) row lock before an external request, or a time-based lease without fencing does **not** establish cross-system atomicity.

## 4. Acceptance and explicit release blockers

**Offline CI for this Draft only:**
- Existing 7-day due, already-finalized, stale-scan, Production hold, batch, recovery and cron negative tests.
- One verified prepare POST before Auth DELETE; require `true` result.
- Negative preparation returns `false`, `null`, unexpected object, empty 204, 403, 409 and 503; each yields **zero Auth/Admin or completion calls**.
- Auth soft-delete uses JSON `should_soft_delete: true`, with no reliance on URL query; preserves the **unverified** Auth Admin credentials pending independent acceptance.

**Still HOLD after green CI:**
1. Actual atomic claim/fence SQL implementation and schema migration, including a separately authorized Development-only controlled test; **do not apply any DDL/DML without a new approval**.
2. Privileged Auth Admin real-HTTP credential/protocol acceptance, synthetic user only, cleanup verified; no real account or contact.
3. Real Development concurrent PostgREST webhook HTTP test previously blocked by platform safety controls—**NOT PASSED**, not replaced by this mock.
4. Device-level passkey QA—**DEFERRED**.
5. Production account deletion, member entitlements, payments, email, Research, Score and all activation flags—**UNCHANGED and NOT AUTHORIZED**.

The stable rollback is to leave the new Draft unmerged; the original, currently disabled Production finalizer remains untouched. A future schema rollback cannot be assumed to undo an Auth deletion.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [Supabase Auth JavaScript deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [GoTrue Admin server source](https://github.com/supabase/auth/blob/master/internal/api/admin.go), [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950).
