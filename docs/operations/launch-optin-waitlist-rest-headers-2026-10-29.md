# Issue #620 — launch, opt-in and waitlist REST header compatibility

**Date:** 2026-10-29  
**Disposition:** source-only Draft PR; unmerged, no database write, live provider send, or Production action.

## Why this change

Supabase's modern `sb_secret_` API key is opaque, not a signed JWT. For PostgREST the supported server-side request uses the `apikey` HTTP header. Supabase documents that sending a modern secret as `Authorization: Bearer sb_secret_...` can be rejected downstream as an invalid JWT.

Reference: https://supabase.com/docs/guides/getting-started/api-keys.

The following three separate, authenticated **REST** helpers in USD Impact previously constructed that unsupported Bearer fallback:

- `launch-email-dispatch-ledger.js` — launch/support operational outbox persistence and status transitions.
- `marketing-opt-in-readiness.js` — request-specific opt-in outbox and purpose-grant creation after confirmation.
- `waitlist-readiness.js` — waitlist consent and optional confirmation outbox persistence.

## Exact change and checks

The three helpers now pass the same `apikey: config.secretKey` without the opaque-key Bearer fallback. Other HTTP headers, URL construction, bounded operation states, idempotency keys, database payloads, consent checks, and error behavior are unchanged.

Their existing offline tests now reject any database request that accidentally includes `Authorization` and check it carries the expected Development API key. Coverage includes launch dispatch and failure paths, double opt-in grant/replay behavior, waitlist consent/outbox insertion, retries, collisions, and Production/default-off guards. A dedicated **pull_request-only** GitHub Actions job runs these suites with no Supabase/Resend credentials or external sends.

## Safety boundaries

- No `/auth/v1/` API modifications, user session changes, passkey behavior or admin user operations.
- No Supabase migrations, RLS/permissions, SQL, environment variables or provider operations.
- No email send, subscription/consent grant, unsubscribe, entitlement, payment, Score or Research change.
- Production Weekly Newsletter, Learning Progress and other governed sends remain HOLD.
- Do not infer that offline tests prove the previously blocked real authenticated PostgREST HTTP race.

This Draft intentionally excludes the independent Weekly canary direct read and remaining commerce/Research/Account-delete request paths; those require their own review and tests.

Related Drafts: [#937](https://github.com/usdimpact/usd-impact-site/pull/937) (shared account/Guided REST), [#940](https://github.com/usdimpact/usd-impact-site/pull/940) (Weekly/Progress/preferences) and [#936](https://github.com/usdimpact/usd-impact-site/pull/936) (receipt CAS). Any Production release requires an explicit, separately reviewed merge and deployment decision.

Tracker: https://github.com/usdimpact/usd-impact-site/issues/620.
