# Issue #950 — Stale-JWT Data API RLS detachment review

**Date:** 2026-10-29. **Status:** source-only, not a migration or approved policy change.  
**Base source:** Development read-only pg_policies inspection; no Production database incident is alleged.

## Confirmed access-control mismatch

Supabase documents that deleting an Auth user does not automatically invalidate existing JWT access tokens. In USD Impact Development, 14 authenticated RLS policies rely on matching account_id to auth.uid(), and **none of these 14 currently checks profiles.auth_user_id**. Five commerce/event SELECT policies check that the profile is not already deleted, but pending accounts remain within that predicate.

The current application readAccountAccessState() denies paid content when profiles.status is not active. That protects the participating site routes, but not direct REST/Data API queries backed solely by the existing RLS policies. An Auth soft-delete retains the Auth user row and may leave a valid previously issued JWT; the atomic-claim proposal leaves profiles.status as deletion_pending after detaching the Auth link, potentially for an extended time if the Auth outcome is unknown.

## Affected policy inventory — verified read-only on Development

- profiles: profiles_select_own
- bookmarks: bookmarks_select_own, bookmarks_update_own, bookmarks_delete_own
- learning_progress: learning_progress_select_own, learning_progress_update_own
- entitlements and entitlement_events: each select_own
- purchases and purchase_intents: each select_own
- subscription_events and subscriptions: each select_own
- privacy_requests and support_requests: each select_own

A separate read-only storage.objects inspection returned no own-user SELECT policy in this inspected subset; do not assume Storage ownership behavior is safe without synthetic acceptance.

## Proposed candidate and semantics

The SQL **docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql** is intentionally outside the migrations directory and MUST NOT be applied without separate approval.

- Adds the canonical profile link predicate to the existing RLS policies: the user can read their own records while the account's Auth link still matches the user's authenticated subject. After the claim-bound begin() commits Auth-link detachment, a still-cryptographically-valid JWT alone no longer meets the RLS policy.
- The profiles SELECT policy compares auth_user_id on the same row rather than using a self-referencing profiles subquery, preventing recursive RLS policy evaluation. The other tables use EXISTS(profiles), which in turn applies that link-aware policy.
- Retains prior read behavior for genuinely linked deletion_pending profiles during the seven-day pre-claim window. Bookmarks DELETE and bookmarks/learning_progress UPDATE are tightened to active only, consistently with their existing write WITH CHECK policies and site-level status-based paid access.
- Preserves existing policy names and grant boundaries, with an explicit 14-policy count preflight; no new grants, browser keys or SECURITY DEFINER functions.
- The PGlite synthetic test creates all 14 matching policy names and checks old-JWT read denial after FK detachment, active and pre-claim continuity, ownership isolation, and pending-account write denial. No real user or Supabase project is modified.

## Remaining gates and risks

1. Independently confirm that this narrower RLS policy does not break legitimate account deletion request status/support UX, privacy export or recovery. A separate authenticated cancellation RPC is still not approved or implemented.
2. Audit all other API tables, views, SECURITY DEFINER functions, Storage policies and signed download routes for access paths that can rely on stale JWT without a linked active profile. This patch only covers the 14 confirmed RLS policies.
3. Inspect Supabase JWT session_id, auth.sessions and refresh behavior in a separately approved synthetic Development-only identity flow. This RLS change is not a session revocation mechanism.
4. Any coordinated schema cutover must stage the policy restriction **before** a real Auth-dispatch operation, after a read-only deployment preflight and real multi-connection acceptance. Never apply standalone or release while old finalizer is active.
5. As with Drafts #953–#956, **no** Production/Development SQL DDL or DML, Auth Admin DELETE, credential exposure, user account deletion, real-provider message, entitlement/payment/Research/Score change, PR merge or finalizer activation is authorized.

Refs [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Supabase Auth user management](https://supabase.com/docs/guides/auth/managing-user-data), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).
