# Account deletion — Supabase Auth Admin versus PostgREST review

**Date:** 2026-10-29  
**Status:** Draft-only Development source and mocked acceptance. No actual deletion or database mutation performed.

## Separation and observed source-level issue

The account-deletion finalizer uses two different APIs:
1. **PostgREST** `/rest/v1/profiles`, `/rest/v1/rpc/finalize_account_deletion`, `/rest/v1/support_requests`, and an outbox request through the existing email helper.
2. **Supabase Auth Admin** `/auth/v1/admin/users/<id>?should_soft_delete=true` for identity soft deletion.

The modern server `sb_secret_` API key is opaque, not a JWT. The previous common header constructor sent that key as an `Authorization: Bearer` credential even on PostgREST reads/writes. This Draft splits the two protocols:

- `jsonHeaders` for PostgREST now uses **only** `apikey` plus JSON/Accept.
- `authAdminHeaders` for the distinct Auth Admin DELETE deliberately **retains its existing Authorization header** as well as `apikey`, rather than making an unverified behavioral change to the separate, destructive identity endpoint.
- All existing batch bounds, Production approvals, durable-email-ledger checks, retry/escalation behavior, privacy data scrubbing and HTTP targets are unchanged.

**Caution:** The Auth Admin request with an opaque key as Bearer is **not yet empirically validated**; this retention is a compatibility hold, not a recommendation to use non-JWT Bearer in new Admin code. A separately authorized protected Development-only Admin API acceptance, or migration to the official Supabase client, is required before further Auth Admin header changes. Supabase Auth docs for administrative user deletion: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser. API-key migration: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.

## Development database read-only privilege inspection

The following was established without querying account rows or changing schema:

| Function | SECURITY DEFINER | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---|
| `public.request_account_deletion()` | Yes | No | Yes | No |
| `public.finalize_account_deletion(uuid)` | Yes | No | No | Yes |

- `request_account_deletion()` requires nonnull `auth.uid()`, filters to that user's active profile, sets the pending state, and inserts a privacy request. `search_path` is empty.
- `finalize_account_deletion(uuid)` locks the profile, checks that the deletion request is due and still pending, requires detached `auth_user_id`, tombstones entitlements, and scrubs selected personal data. `search_path` is empty.
- The Supabase advisor WARN for a callable SECURITY DEFINER request RPC appears **intentional** based on these checks. It is **not** proof of the absence of all abuse paths; do not revoke `authenticated` EXECUTE merely because of the linter, or users could lose their self-service deletion request route.

## Residual risk — not solved by this header fix

A scheduled finalizer first lists due profiles and subsequently calls Auth Admin soft-delete before the locking finalization RPC. There can be a **scan-to-delete concurrency interval** if a deletion request is changed/cancelled after scanning. The later RPC checks eligibility, but it occurs *after* the Auth Admin call. Read-only inspection cannot establish that this interval is harmless, nor that soft deletion immediately revokes outstanding JWTs. These require a dedicated state-transition/claim design and protected Development identity acceptance rather than ad hoc live user deletion. Do not enable a new finalizer or change its Production flags to test this.

## Offline regression matrix

- A synthetic due scan, existing Auth Admin soft-delete request, finalization RPC and completion outbox all use the expected Development host.
- Every PostgREST call must use opaque `apikey` with **no** Authorization header.
- The Auth Admin request retains its old dedicated header behavior and DELETE method, guarded by canonical project and explicit finalizer readiness.
- Existing synthetic tests cover retries, duplicate receipt/recovery, escalation, bounded daily batch, disabled route, invalid cron auth and Production approval denial.
- No real HTTP, account, email, membership, SQL data or consumer identity was touched. PR-only CI has **no secrets**.

## Gate

Keep Draft/unmerged. No Production deployment, consent/account state changes, passkey changes, email send, entitlement or commerce activation. Before any release: exact-head CI, account-deletion security review focused on scan-to-delete and token revocation, independently confirmed Auth Admin authentication, plus separate Production approval. The blocked unrelated PostgREST HTTP race from Issue #620 remains UNTESTED.

Tracking: https://github.com/usdimpact/usd-impact-site/issues/620.
