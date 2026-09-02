# Production passkey activation — 2026-09-03

## Approved scope

- Enable passkey authentication for the USD Impact Production application.
- Keep the relying-party ID fixed at `usd-impact.com`.
- Allow only these Production origins:
  - `https://usd-impact.com`
  - `https://www.usd-impact.com`
- Keep email sign-in and the six-digit email-code flow available as recovery.
- Use only the commerce QA/owner account for the bounded enrollment and sign-in proof.
- Do not contact or modify Michael's account.
- Allow exactly one configuration-uptake Production deployment.

## Configuration gate

The owner confirmed that the following provider settings were saved before the
configuration-uptake release:

- Supabase Production passkeys enabled with display name `USD Impact`, RP ID
  `usd-impact.com`, and both approved Production origins.
- Vercel Production `PASSKEY_AUTH_ENABLED=true`, scoped to Production only.

The Vercel Preview branch-specific passkey variable remains separate from the
Production variable.

## Immutable source

- Pre-activation `main`: `7d29112ce6d34e977033f3520987249852606de4`
- Source tree: `660ac4a80008fe91e760f060ae271f2932d92d14`
- Runtime code is unchanged by this activation record.

## Acceptance evidence required after deployment

- Exactly one Vercel Production deployment reaches `READY` from the checked PR
  head and the expected merge commit.
- Production reports passkey authentication enabled.
- Anonymous passkey sign-in options are issued only through the configured
  WebAuthn relying party and origins.
- Existing email-code recovery remains enabled.
- A real-device enrollment and sign-in proof is completed using only the
  commerce QA/owner account; cloud-browser WebAuthn is not acceptance evidence.
- Runtime and build error scans remain clean.
