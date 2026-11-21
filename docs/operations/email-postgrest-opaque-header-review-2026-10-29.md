# Issue #620 — governed email PostgREST opaque-key header review

**Prepared:** 2026-10-29  
**Scope:** Development-only Draft PR. This is not an authorization to merge, deploy, send emails, change consent records, or activate Production flags.

## Confirmed source-level defect

Supabase's modern `sb_secret_` key is an **opaque gateway credential**, not a JWT. It is supplied in the `apikey` HTTP header for PostgREST. The Supabase API-key documentation states that `Authorization: Bearer sb_secret_...` can cause a downstream JWT rejection. See https://supabase.com/docs/guides/getting-started/api-keys.

On protected `main`, three separate governed email and consent request helpers used `apikey: config.secretKey` **plus** `Authorization: Bearer ${config.secretKey}` for REST access. This may prevent the requests from working; there is **no evidence here of a Production incident, delivered email failure or credential compromise**.

## Deliberately bounded change

The following PostgREST helpers now use `apikey` only, retaining their existing `Accept`, `Content-Type`, `Prefer`, method, payload, URL, response handling, guards, and error behavior:

- `apps/web/src/lib/weekly-newsletter-dispatch.js` — edition outbox enqueue, eligibility rechecks, consent withdrawal, suppression, send-state transitions.
- `apps/web/src/lib/progress-email-dispatch.js` — Learning Progress outbox enqueue, rechecks, cancellation and failure handling.
- `apps/web/src/lib/marketing-email-preferences.js` — purpose-specific consent reads and idempotent withdrawals.

The existing offline tests assert that **every** Development database fetch through their mock adapters contains the correct `apikey` and does **not** include a Bearer `Authorization` fallback. They still check the preexisting fail-closed Production guards, consent-withdrawal behavior, outbox idempotency and state transitions. A dedicated PR-only, secret-free workflow executes all three suites. Tests mock both PostgREST and provider functions; **no real HTTP, provider call or consent mutation** occurs during CI.

## Explicitly excluded

- The current protected `main` and public Production site.
- Any `/auth/v1/` requests (user JWT, passkey, signup, session or admin)—Auth protocol changes require separate review.
- `supabase-server.js` and Guided Edition helper; addressed in [Draft #937](https://github.com/usdimpact/usd-impact-site/pull/937).
- Resend webhook receipt compare-and-set, addressed in [Draft #936](https://github.com/usdimpact/usd-impact-site/pull/936).
- Additional direct secret-key REST helpers (launch ledger, marketing opt-in, waitlist readiness, weekly canary, research membership, account deletion). Those need separately scoped tests.
- No environment settings, database schema, permission, secrets, cron, payment/entitlement, Score or Research change.

## Release gate

Keep this PR **Draft and unmerged**, even when offline tests pass. No Production Weekly or Learning Progress email activation is authorized. The earlier Development-only real PostgREST HTTP concurrency acceptance remains **BLOCKED/UNTESTED** and must not be substituted with these offline tests. Before any future release: inspect exact-head CI, combine relevant Drafts with current `main` in a separately reviewed integration process, and request distinct Production deployment and email authorization.

Tracking: https://github.com/usdimpact/usd-impact-site/issues/620.
