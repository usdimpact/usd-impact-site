# Issue #950 — Disabled legacy finalizer: non-JWT Auth credentials and 404 fail-closed

**Status:** Draft/unmerged source hardening for an already-disabled route. It does not replace the coordinated atomic-claim cutover.

## Hazard that justified this targeted fix

The existing account-deletion finalizer implements a soft DELETE with `DELETE /auth/v1/admin/users/<account-id>` and JSON `{"should_soft_delete":true}`, which is the correct way to avoid accidental hard deletion. However, its `authAdminHeaders` function **unconditionally** sent `Authorization: Bearer <secret>` even when the key was a modern opaque `sb_secret_` string. Current Supabase [API keys guidance](https://supabase.com/docs/guides/getting-started/api-keys) and [migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) distinguish opaque gateway keys from JWTs.

The legacy helper also mapped HTTP **404** to an idempotent `alreadyAbsent` success and allowed continuation into its plain-ID SQL finalizer. That is not a sufficient proof of an Auth soft-delete. This is **not evidence that a live deletion occurred**; the finalizer remains disabled.

## Exact Draft-only correction

- For `sb_secret_` and other non-JWT opaque keys, send the secret on **`apikey` only**. Preserve `Authorization: Bearer` only for JWT-form legacy `eyJ...` service-role credentials. Do not place secrets in URLs, query strings or public logs.
- Continue to send **exactly** `{"should_soft_delete":true}` in the DELETE JSON request body; no query-string toggle, no fallback to hard delete.
- Require an **explicit HTTP 200 or 204** result to proceed. Any 404, 401, 409, 429, 503, unexpected 201, malformed reply or unknown result now throws `ACCOUNT_DELETION_AUTH_OUTCOME_UNVERIFIED` and **never returns a successful deletion proof**.
- The existing error path can record a manual support escalation with its current governed rules, but **must not call** `finalize_account_deletion` or record a completion outbox after an unverified Auth status.
- No live GoTrue provider or customer identity is exercised. This is only mock-level contract hardening; real Auth Admin acceptance with a fresh synthetic identity remains outstanding.

## Tests and limits

The updated `test-account-deletion-auth-protocol.mjs` verifies the modern opaque header and body, HTTP 200/204 success, all listed unexpected statuses rejected with **one** Auth call, and a full mock finalizer run where HTTP 404 causes manual escalation but **zero** SQL erasure and **zero** completion mail. The previous `test-account-deletion-finalizer.mjs` is updated to validate the modern key-header contract.

**Important:** this legacy path still uses the old nonexclusive `prepare_account_deletion_auth_removal` and `finalize_account_deletion` RPCs. Even with the credential and 404 corrections it **MUST NOT BE ACTIVATED**. The new full claim-aware coordinator, private transactional completion escrow, 17-policy stale-JWT RLS fence, approved SQL migration, and live protected synthetic acceptance remain separate mandatory gates. The earlier review-only Auth Admin wire test is retained and remains unimported.

No PR merge, source/Production Supabase DDL/DML, Auth request, email, Storage file copy, cron activation, entitlement/payment/Research/Score update or Production deployment was performed.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) · [GoTrue wire review #984](https://github.com/usdimpact/usd-impact-site/pull/984) · [RLS review #985](https://github.com/usdimpact/usd-impact-site/pull/985).
