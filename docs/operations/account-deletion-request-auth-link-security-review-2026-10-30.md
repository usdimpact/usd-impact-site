# Issue #950 — Review of privileged deletion-request Auth-link ownership

**Date:** 2026-10-30. **Status:** draft-only security hardening; no deployed SQL or Auth action.

## Read-only findings

The current `public.request_account_deletion()` procedure is a `SECURITY DEFINER` owned by `postgres`, callable by `authenticated`, not `anon` or `service_role`. It checks `auth.uid()` against `profiles.account_id` and requires `status='active'`. It **does not check the profile's current `auth_user_id`**.

The reviewed candidate in `docs/operations/candidates/account-deletion-atomic-claim.review.sql` had preserved this omission. This creates an avoidable defense-in-depth gap: PostgreSQL `SECURITY DEFINER` bypasses ordinary RLS and a still-valid JWT may present an account UUID after Auth-link detachment. In ordinary deletion, status changes to `deletion_pending` and later `deleted`, so this is **not evidence of an exploitable Production incident**. It is nonetheless unacceptable to leave stale-identity eligibility implicit across a security-sensitive lifecycle.

SELECT-only Supabase checks on both the canonical Development project `ycstrcvshdluovtuasjc` and isolated restored project `movnekagnxgcyenczfoc` reported **9 active profiles with matching canonical Auth links and 0 active detached or mismatched profiles**, with no pending or deleted profiles. No real account record or email address was inspected or exported.

## Proposed correction (source-only)

The SQL candidate's authenticated deletion-request UPDATE now demands all of:

- The account UUID equals `auth.uid()`.
- The status is exactly `active`.
- `auth_user_id = auth.uid()`, proving the canonical Auth link is still attached.
- `deleted_at IS NULL`, rejecting inconsistent already-erased profiles.

The existing 7-day grace period, one-request generation, privacy_request insert, non-accessible plain-ID service RPC and existing RLS proposal are unchanged. These extra predicates are *additional* safeguards and do **not** replace the separately planned 14-policy stale-JWT RLS fence or full signed-session review.

The PR-only in-memory PostgreSQL test executes the real review SQL with synthetic identity claims and checks that null JWT, detached, mismatched, inconsistent-deleted, unknown-subject, duplicate and unauthorised-role calls cannot generate deletion requests or privacy records. An active profile with a matching Auth link still creates one request, a due timestamp and one privacy record.

## Still required before actual deployment

Independent SQL/DBA/security review of the complete candidate, privacy retention review, a coordinated app+schema cutover, fully restored 21 private S3 file bytes and controlled synthetic Supabase Auth/session/JWT/Storage acceptance remain mandatory. The current deployed request RPC and finalizer are **unchanged** and the privileged procedure is **not migrated** by this Draft. No Production/Development SQL DDL/DML, real Auth deletion, provider email, account or entitlement mutation, GitHub merge, deployment, S3 copy, or feature-flag activation occurred.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) · [Full no-release integration #977](https://github.com/usdimpact/usd-impact-site/pull/977) · [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
