# UI-02 account-language, privacy, and signed-session acceptance

Status: DRAFT. Development-only migration installed. Production, email sending and merge remain HOLD.

## User interface and API
Account page: apps/web/src/pages/account/index.astro. Hidden by default, EN/ES selector only.
Endpoint: GET/POST /api/account?action=transactional-locale, with verified HTTP-only account cookie and the user's own JWT to Supabase PostgREST.
Two independent default-off flags: ACCOUNT_TRANSACTIONAL_LOCALE_UI_ENABLED and ACCOUNT_TRANSACTIONAL_LOCALE_WRITE_ENABLED. The route always returns 404 on Production.
Strict Development Supabase project host binding, RLS-only account ownership, signed session, and same-origin JSON writes. No service role or arbitrary account ID is accepted.
The preference is transactional, not consent for marketing, Resend newsletter groups, or financial receipts. The setting itself does not send an email.

## Development privacy migration
Version: 20261030221037, name: ui02_language_privacy_lifecycle_dev.
Exact body: supabase/migrations/20261030221037_ui02_language_privacy_lifecycle_dev.sql.
SHA-256: b741bd787610b412cc2b1439e1f74dc0bfb5b64e35e071f9400177a451217eb3. The offline contract test matches this exact applied SQL.
Adds own preference to public.account_export() without SECURITY DEFINER or new permissions.
Adds a SECURITY INVOKER trigger that deletes preference only when profile status reaches deleted, not during the reversible seven-day deletion_pending state.
Does NOT change Production, the current account-deletion finalizer, paid entitlements, commerce records or Resend.

## Confirmed post-install Development tests
1. Simulated authenticated user creates and reads own preference, increments revision, cannot read or edit another account, anonymous and unauthenticated access rejected.
2. Browser account-language API unit tests reject Production, missing session, malformed origin, cross-site writes, unsupported locales, extra account/marketing fields, invalid RLS responses.
3. Account export via authenticated-role simulation includes own saved Spanish preference.
4. Preference remains during deletion_pending and is erased on final deleted status; all customer fixture modifications rolled back.
5. Atomic email system remains disabled with no queued purchase ready outbox. No sending, payment replay or historical backfill.

## Remaining manual signed Development QA
A real signed Development browser session is required; synthetic SQL JWT-claim simulation and offline API tests are not a signed-session e2e proof.
Use an isolated Development user and protected Preview-branch-only env flags when expressly authorized; never share cookies, access tokens, magic links or keys in chat.
Verify EN default, ES save, EN save, revision progression, second-user row isolation, signed-out denial, account export, mobile/desktop accessible presentation.
Do not activate Production or expose this migration from the Draft PR. Preview must remain a non-Production deployment.
Review legal/privacy retention for immutable notification snapshots after account deletion, and later provider suppression, callbacks, recovery and change-of-email/refund concurrency.
