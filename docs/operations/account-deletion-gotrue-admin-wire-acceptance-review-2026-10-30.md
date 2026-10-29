# Issue #950 — GoTrue Auth Admin deletion wire protocol review

**Date:** 2026-10-30. **Disposition:** synthetic code-level acceptance only; **real GoTrue acceptance and any user deletion remain HARD HOLD**.

## Confirmed source-level mismatch

USD Impact's **disabled legacy finalizer** currently constructs an Auth Admin request with `Authorization: Bearer sb_secret_...`, even though the key is in the `apikey` header. This inherited protocol was intentionally left unchanged pending protected provider acceptance. Supabase's current [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) document that `sb_secret_` is an **opaque gateway key**, not a JWT; send it on `apikey`, not as an authorization JWT. The current legacy finalizer also classifies HTTP **404** as `alreadyAbsent` and continues into finalization. That is unsafe as proof of deletion in a one-shot, fenced protocol. The **separate, dormant** claim-aware candidate already treats 404 as **ambiguous**, but its Auth transport is an injected stub and did not yet test the actual wire shape.

No actual deletion is known to have run; this is a preventive review finding, not a confirmed Production incident.

## New strictly offline GoTrue wire adapter

`apps/web/src/lib/account-deletion-gotrue-admin-wire.review.js` can only execute with:

- `mode=offline_fixture`, `production=false`, the exact canonical Development origin, and an intentionally unusable test key `sb_secret_issue950_offline_wire_fixture_never_real` (not an actual credential);
- the exact fixed, non-customer synthetic UUID `11111111-2222-4333-8444-555555555555` passed as **both** claimed account and Auth user;
- an **explicitly injected fake transport**, never the ambient `fetch`, no fallback to environment keys, no global client, no Node HTTP or provider SDK.

It builds exactly one `DELETE /auth/v1/admin/users/<fixture-uuid>` with **no URL search params**, `apikey` and JSON headers, and body `{"should_soft_delete":true}`. It does not send `Authorization: Bearer sb_secret_...`; it does not inspect or log the response body.

The adapter returns only the opaque HTTP status to the existing *offline* fenced protocol, which independently validates the immutable request/claim token, database dispatch barrier and generation. HTTP **200 or 204** may proceed to SQL confirmation. HTTP **404, 409, 429, 503, 201**, thrown network errors and timeouts are classified as ambiguous, **never** interpreted as proof of prior deletion. After one attempted Auth call, no automatic retry is allowed; lost database begin/confirm responses also stop further Auth attempts. Completion enqueues into the existing governed durable-outbox identity, not directly to an email provider.

## Evidence and limitations

`apps/web/scripts/test-account-deletion-gotrue-admin-wire.review.mjs` performs end-to-end *synthetic mock-only* claim → begin → wire → confirm/ambiguous → finalize/outbox tests. The PR-only Node 24 workflow has **no Supabase, GoTrue, S3 or Resend keys** and cannot use a real network transport. The updated source-level activation guard verifies that no app route, middleware, API or current finalizer imports this module.

**This is not provider acceptance.** Different Supabase Auth/Admin endpoints may need gateway-specific handling. A separate authorized test with a **fresh, isolated synthetic identity**, a real protected project key held only in an approved runner, an ephemeral environment, and independent observation of a 200/204 soft delete versus 404/timeout is still mandatory. That acceptance must not operate on any of the nine real identities cloned into the paid restore; the clone's Data API and signup/Email Auth providers must remain disabled unless a separate reviewed safety plan requires scoped changes.

The legacy finalizer's **Bearer + 404** behavior remains a release-blocking compatibility defect until the coordinated cutover explicitly replaces it or a separate carefully reviewed patch is approved; no PR here modifies the live finalizer. Supabase Auth deletion does **not** necessarily make existing JWTs invalid immediately, so the separately tested canonical-link and RLS fences remain necessary.

## Release boundary

Do not merge, enable cron, change source/Production SQL, mutate customer data, email, transfer Storage S3 files, operate real Auth Admin, deploy or activate. The original independent restore and source-level QA do not lift this hold. Remaining account-deletion milestones: private Storage byte-for-byte recovery, DBA/privacy/security signoff, recipient escrow retention authorization, actual protected synthetic GoTrue/JWT/PostgREST/Storage acceptance, a coordinated CLI-generated migration and claim-aware finalizer, and separate Production approval. The restored project is billable and cleanup is tracked in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978).
