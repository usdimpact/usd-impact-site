# Research Membership privileged REST boundary — Development review

**Date:** 2026-10-29  
**Status:** Draft only; no entitlement, subscription, Production, key or commerce activation.

## Finding from source audit

The Research Membership webhook handler and persistence RPC client sent the server-side `sb_secret_` API gateway key as `Authorization: Bearer`, although this opaque credential is not a JWT. The two privileged PostgREST helpers now send `apikey` only, while provider webhook HMAC verification, processing, event normalization, transition state mapping, and the Lemon Squeezy provider integration remain unchanged. Reference: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.

The standalone persistence RPC previously accepted any HTTPS `SUPABASE_URL`, allowing accidental routing of the privileged server key to an unrelated host if the worker environment were misconfigured. The new persistence boundary rejects invalid or unexpected origins, paths, query strings, credentials, and Vercel environments before `fetch`:
- Preview: **https://ycstrcvshdluovtuasjc.supabase.co**.
- Production: **https://gjzetjugmnwanvjkchux.supabase.co**.
- Any other environment/host: **reject**. Only `sb_secret_` may authorize the backend RPC. There is no browser credential exposure.

This is defensive config validation; it is not approval to set Production Research flags to true.

## Development SQL read-only security evidence

Read-only `pg_proc`, `pg_get_functiondef` and `has_function_privilege` inspection of `public.apply_research_membership_transition` (full signature) found:

- `prosecdef=false`: runs as security invoker, **not** SECURITY DEFINER.
- `anon` **NO EXECUTE**, `authenticated` **NO EXECUTE**, `service_role` **EXECUTE**.
- Locks the specified subscription with `SELECT ... FOR UPDATE`, checks product `research-membership`, expected provider/provider-subscription identifiers, event idempotency, state drift and corresponding entitlement purchase/subscription identity.
- Existing entitlement creation is constrained to active transitions; state changes create subscription and entitlement events.

These checks are strong but are not a full proof of every race or every SQL side effect, and no grant, RLS policy, migration, subscription record, or entitlement was changed.

## Test matrix

The existing synthetic-only persistence/execution/replay suites now assert:
- All subscription, event and RPC calls target the canonical Development origin and send `apikey` without opaque Bearer.
- Unsupported or cross-project HTTPS, production-to-Development, Preview-to-Production, missing env, invalid key, insecure URL, path/query injection fail **before** any privileged fetch.
- Signed payload verification and replay/idempotency still honor upstream Development-only Test Mode.
- A Production canonical host is covered with an **injected mock fetch**, never actual Production access.

CI is pull-request only, has no secrets and does not invoke real Supabase, Lemon Squeezy or Resend.

## Release and research gates

Do not merge, deploy Production, activate commerce, grant membership, mutate subscription/entitlement or alter webhook flags. The source changes must first pass exact-head CI and a human review of upstream webhook signature and project selection. A later protected Development HTTP acceptance should use a separately authorized execution path and only safely scoped synthetic fixtures; the previous provider/PostgREST race remains unverified. No bypass of platform safety controls.

Track: https://github.com/usdimpact/usd-impact-site/issues/620. Adjacent audit: account-deletion Auth Admin versus PostgREST requires a separate review and distinct credentials for each protocol.
