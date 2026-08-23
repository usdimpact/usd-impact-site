# Passkeys / WebAuthn foundation — 2026-08-23

## State

The application foundation is implemented behind the server-side `PASSKEY_AUTH_ENABLED` feature gate.

Default behavior remains fail-closed:

- email magic-link + PKCE remains the active sign-in and recovery path;
- Supabase access and refresh tokens remain in HttpOnly cookies;
- passkey UI is hidden on sign-in while the gate is disabled;
- `/account/passkeys/` shows the disabled state until the gate is enabled;
- no database migration or entitlement change is required;
- no Production passkey configuration is changed by this foundation.

Supabase currently labels passkey support experimental. Development proof is mandatory before Production activation.

## Development activation

Use the Development Supabase project first and deliberately isolate Development credentials from Production.

1. Create and keep a stable HTTPS Development hostname: `passkeys-dev.usd-impact.com`.
2. In Supabase Development → Authentication → Passkeys:
   - Enable Passkey authentication.
   - Relying Party Display Name: `USD Impact Development`.
   - Relying Party ID: `passkeys-dev.usd-impact.com`.
   - Relying Party Origins: `https://passkeys-dev.usd-impact.com`.
3. Do not later change this Development RP ID after users enroll. Changing an RP ID invalidates passkeys registered against it.
4. Enable `PASSKEY_AUTH_ENABLED=true` only for the matching Vercel Preview/test environment and branch.
5. Confirm that the same Preview/test environment is wired to the Development Supabase project, not Production.
6. Deploy the exact green candidate to `passkeys-dev.usd-impact.com`.
7. Sign in with the existing email-link flow using a confirmed Development account.
8. Open `/account/passkeys/` and add one passkey.
9. Verify list and rename behavior.
10. Sign out completely.
11. Open `/account/sign-in/`, complete Turnstile, and select **Sign in with a passkey**.
12. Verify the server creates the normal HttpOnly session-cookie pair and that `/account/` loads successfully.
13. Verify email-link sign-in still works as recovery.
14. Add a second passkey on another trusted device/password manager before testing deletion.
15. Verify one passkey can be removed without losing account access.

Development passkeys are test credentials only. They are intentionally bound to `passkeys-dev.usd-impact.com` and must not be treated as Production credentials.

## Production acceptance gate

Do not enable Production until all Development checks above pass on real WebAuthn hardware/software.

For Production:

- RP Display Name: `USD Impact`
- RP ID: `usd-impact.com`
- Origins:
  - `https://usd-impact.com`
  - `https://www.usd-impact.com`
- Keep email sign-in enabled as recovery.
- Enable `PASSKEY_AUTH_ENABLED=true` only after Supabase Production has the matching RP configuration.
- Redeploy exact green `main` and perform one bounded owner-account enrollment/sign-in proof.
- Enroll a fresh Production passkey; do not reuse Development enrollment as Production evidence.

## Rollback

Set `PASSKEY_AUTH_ENABLED=false` (or remove it) and redeploy. The passkey button becomes hidden and passkey server operations return fail-closed responses while email magic-link sign-in continues unchanged.

Do not change the RP ID as a rollback mechanism because doing so invalidates previously enrolled passkeys.
