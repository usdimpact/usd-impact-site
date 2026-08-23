# Passkeys email-code recovery — Development activation

Date: 2026-08-23

## Purpose

Preserve the existing passwordless email-link / PKCE flow while adding a six-digit email-code fallback for mobile clients whose mail app opens the sign-in link in a different browser context.

The fallback is intentionally independent of the PKCE verifier cookie. A successful code verification still creates the same HttpOnly access and refresh cookies used by the existing account system.

## Feature gate

- `EMAIL_OTP_FALLBACK_ENABLED=true` enables the code-entry UI and server verifier.
- Missing or false keeps the fallback hidden and the recovery verifier unavailable.
- Production must remain false until Development acceptance is complete.

## Development Supabase email template

Authentication → Email Templates → Magic Link must preserve the existing sign-in link and also display the one-time code with the supported Supabase template variable:

`{{ .Token }}`

Do not remove the existing confirmation/sign-in link. The Development email should offer both choices:

1. Continue with the one-time sign-in link.
2. Enter the six-digit code on the USD Impact sign-in page.

The code is one-time and is verified by Supabase Auth at `/auth/v1/verify` with `type=email`.

## Acceptance

1. Existing email-link login still succeeds in the same browser context.
2. Request one sign-in email on the Development Preview.
3. The email contains both the sign-in link and six-digit code.
4. Open the USD Impact sign-in page in a browser context that does not hold the PKCE cookie.
5. Enter the same email address and six-digit code.
6. Code verification succeeds and `/account/` loads.
7. Passkey sign-in still succeeds with the existing Development NordPass and Apple Passwords credentials.
8. Account page exposes `Passkeys & security` only when `PASSKEY_AUTH_ENABLED=true`.
9. Production continues to report passkeys disabled and email-code recovery disabled.
10. Runtime error/fatal scan is clean.

## Security boundaries

- No Supabase secret/service-role key is sent to the browser.
- Code verification is same-site JSON only.
- Invalid/expired codes return a neutral error.
- Successful code verification clears any stale PKCE verifier cookie before installing the normal HttpOnly session cookies.
- No new Vercel function is introduced; the fallback stays inside the existing account/passkey gateway.
