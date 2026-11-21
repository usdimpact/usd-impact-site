# Passkey management — remembered-session continuity (Development review)

**Prepared:** 2026-10-28  
**Status:** Draft, test-backed, **not merged or deployed**.  
**Scope:** Only `apps/web/src/lib/passkey-handler.js`, its existing wired Supabase authentication tests, and this QA handoff.

## Problem verified in source

`/account/sign-in/` offers **Keep me signed in on this device for 30 days**. The server's `usd_impact_refresh` HttpOnly Secure SameSite=Lax cookie supports this under the existing short-lived access-token lifecycle. Protected Guided Book, audiobook, Video Library, and viewing-progress handlers already call `resolveSessionWithRefresh()`.

Before this change, passkey-management `list`, `registration-options`, `registration-verify`, `rename`, and `delete` used `readSessionAccessToken()` directly. A stale access token therefore received a provider 401, and the passkeys settings browser redirected to sign-in even with a valid remembered refresh cookie. This was a **source-determined continuity gap**, not proof of a live incident.

## Bounded fix

- Passkey **management only** uses the already-reviewed `resolveSessionWithRefresh` flow, with fresh `getVerifiedSupabaseUser` verification. Account-security settings never require a paid Library Pass or Research entitlement.
- An expired access token may refresh **once**, rotating access/refresh HttpOnly cookies with existing 30-day or session-only persistence. A valid token bypasses refresh; absent or expired refresh returns 401 and clears invalid cookies.
- `Vary: Cookie, Authorization` and `Cache-Control: no-store` are set for passkey operations.
- Public passkey authentication-options, verification, recovery and status operations retain their existing behavior, Turnstile/same-site checks and sign-in redirect contract. No passkey is added, renamed or deleted by a test.
- No client storage, new auth method, elevated service-role key, background device tracking, entitlement change or cross-device sharing is introduced.

Existing `validate:supabase` already runs `test-supabase-auth.mjs`. Added deterministic synthetic tests cover existing authenticated access, token rotation after 401, remember-off session cookies, stale refresh denial+cookie clearing, and anonymous fail-closed denial. There are **no real tokens or provider requests** in the test.

## What still needs hands-on QA before Production

A browser with a genuine enrolled passkey is needed to confirm registration options, verify, list, rename and delete after token expiry on desktop and mobile. Synthetic tests cannot prove WebAuthn device prompts or cloud password manager behavior. Test on Development/Preview without exposing accounts or session recordings.

## Related member continuity, not changed

- The Video Library Continue card reads account-backed viewing progress and resumes through protected API routes.
- The audiobook accurately states that its bookmark is **stored only in this browser**. Cross-device listening-position sync is **not implemented** and must not be claimed.
- Account cookies apply to shared site routes, not to independent devices until each signs in.
- Newsletter/Progress production sending remains an independent owner-approved activation under [Issue #620](https://github.com/usdimpact/usd-impact-site/issues/620).

**Disposition:** Development fix for review only; protected `main`, Production Vercel, Supabase Auth settings, passkey records and payment/entitlement state remain unchanged.
