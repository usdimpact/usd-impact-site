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

Use the Development Supabase project first.

1. Choose the final WebAuthn RP ID before enrolling any passkey. Changing the RP ID invalidates existing passkeys.
2. Prefer a stable HTTPS origin on the `usd-impact.com` domain for Development/Preview testing so the intended RP ID can remain `usd-impact.com`.
3. In Supabase Development → Authentication → Passkeys:
   - Enable Passkey authentication.
   - Relying Party Display Name: `USD Impact`.
   - Relying Party ID: `usd-impact.com` when the test origin is a subdomain of `usd-impact.com`.
   - Add the exact HTTPS test origin to Relying Party Origins.
4. Enable `PASSKEY_AUTH_ENABLED=true` only for the matching Vercel Preview/test environment.
5. Deploy the exact green candidate.
6. Sign in with the existing email-link flow using a confirmed Development account.
7. Open `/account/passkeys/` and add one passkey.
8. Verify list and rename behavior.
9. Sign out completely.
10. Open `/account/sign-in/`, complete Turnstile, and select **Sign in with a passkey**.
11. Verify the server creates the normal HttpOnly session-cookie pair and that `/account/` loads successfully.
12. Verify email-link sign-in still works as recovery.
13. Add a second passkey on another trusted device/password manager before testing deletion.
14. Verify one passkey can be removed without losing account access.

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

## Rollback

Set `PASSKEY_AUTH_ENABLED=false` (or remove it) and redeploy. The passkey button becomes hidden and passkey server operations return fail-closed responses while email magic-link sign-in continues unchanged.

Do not change the RP ID as a rollback mechanism because doing so invalidates previously enrolled passkeys.
