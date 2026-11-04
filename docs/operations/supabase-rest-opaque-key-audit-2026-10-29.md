# Issue #620 — Supabase REST opaque API-key header audit

**Date:** 2026-10-29  
**Status:** Development-only Draft PR; no runtime activation, merge, database write, credential handling or email send.

## Confirmed source-level incompatibility

Supabase's modern `sb_publishable_` and `sb_secret_` API keys are opaque gateway credentials, not signed JWTs. Its API-key documentation warns that passing an opaque key as `Authorization: Bearer <opaque-key>` to PostgREST can result in rejection because the key is not a JWT. These keys belong in the `apikey` header. An authenticated user access token still belongs in `Authorization: Bearer <user JWT>`.

Source: https://supabase.com/docs/guides/getting-started/api-keys

USD Impact's `supabase-server.js` and `guided-supabase-server.js` previously built the generic REST headers with `Authorization: Bearer ${accessToken || apiKey}`, so an opaque key could be incorrectly used as a Bearer fallback. This is **a code-level compatibility defect, not proof of a customer incident, broken production flow or credential compromise**.

## Exact changes under review

1. Add a pure exported `buildSupabaseRestHeaders({ apiKey, accessToken, headers })` to the common Supabase server module. It always sends the API key as `apikey`, adds Bearer **only** for an explicit nonempty access token or a legacy JWT-format API key, and otherwise omits Authorization. Invalid API-key type and invalid access-token shapes fail closed before network access. Existing JSON/Prefer headers are preserved.
2. Update the common REST helper to call this one builder. Existing own-account reads and writes continue to send the caller's user token and therefore continue to enforce user-scoped RLS; no entitlement or authorization decisions are changed.
3. Update the Guided Edition REST helper to use the same builder. Guided catalog, release, supplement and authorized learning-progress RPC reads using opaque server-only `sb_secret_` keys now omit Bearer. User-scoped Guided progress reads continue to carry an actual user token.
4. Extend the existing account-foundation tests for public/secret opaque keys, real access tokens, legacy JWTs and invalid types; update Guided Edition tests to assert **no** opaque Bearer across all six secret-key paths, while ensuring signed-in learning progress still has a Bearer user token.
5. Add a tiny PR-only offline GitHub Actions workflow testing those contracts and existing Auth session regression. The workflow has no secret environment, provider calls, database mutations, `workflow_dispatch` or schedule.

## Deliberately excluded

- `supabase-secret-rest.js` **already uses apikey only** and needs no modification.
- `supabase-auth.js` addresses Supabase **Auth** endpoints (passwordless sign-in/refresh), not the inspected PostgREST data request path. Auth protocol changes are **not** authorized by this narrow Draft and need their own evidence before any edit.
- Other direct request sites that construct their own Supabase HTTP headers (newsletter, marketing, commerce, shared ledger, research, account services) require separate audit and regression coverage. This PR does **not** claim a repository-wide fix.
- Draft PR #936 separately changes the Resend webhook's direct REST header. It does not overlap these files.
- No Production/Development Supabase SQL, live API requests, Vercel environment change, email sending, payment, entitlement, Score or Research action.

## Release gate

**Draft / unmerged.** Require exact-head offline CI success, review of auth/JWT boundaries, and a separately approved merge/deployment plan. Do not merge this PR merely because tests are green. Protected `main` remains the source of live Production behavior; advanced Development HTTP race acceptance under Issue #620 remains BLOCKED/UNTESTED.

See also:
- https://github.com/usdimpact/usd-impact-site/issues/620
- https://github.com/usdimpact/usd-impact-site/pull/935 (Development HTTP runner)
- https://github.com/usdimpact/usd-impact-site/pull/936 (webhook receipt CAS)
