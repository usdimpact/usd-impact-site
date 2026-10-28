# Passkey remembered-session Preview candidate — no live WebAuthn claim

Prepared 2026-10-28; Development QA only. This is a **separate Preview mirror** of [Draft PR #930](https://github.com/usdimpact/usd-impact-site/pull/930) at source commit `29ad78ffead23dd02d762ed0c1bf527dac6adc4e`.

This file is added solely to trigger a distinct non-Production Preview build and document the isolation boundary. It does not change account runtime or the governed PR head. The Preview mirror is not a merge candidate; the canonical code change remains PR #930.

## Invariants

- No Production alias, website main, Vercel Production env variable, Supabase Auth setting, passkey credential, email, payment or customer entitlement is changed.
- The stable Development WebAuthn relying-party origin is `https://passkeys-dev.usd-impact.com`. A generic Vercel Preview URL is **not** RP-equivalent and must not be presented as a completed real-passkey acceptance test.
- The existing Development alias remains pinned to its prior deployment until a separately reviewed and reversible candidate cutover is ready.
- The mirror has no branch-scoped `PASSKEY_AUTH_ENABLED` setting. The build may be useful for anonymous/static no-send smoke, but live session/password-manager testing requires a fully reviewed Development project/env mapping and the correct RP origin.
- Do not use actual enrolled passkeys, sign-in links, or session cookies on an unverified Preview deployment.
- Do not merge this mirror branch into main.

## Acceptance yet to perform

1. Confirm the mirror Preview's exact commit and READY state, and static anonymous access boundaries.
2. Verify that the target runtime uses only the isolated Development Supabase project before any authenticated test.
3. Under the stable RP ID, test account-backed passkey list, registration, rename and deletion after an expired access token and one refresh.
4. Validate both remember-on and remember-off behavior, then confirm recovery and multi-device boundaries.
5. Collect only non-sensitive outcomes in a PR #930 QA comment; keep it Draft pending those proofs.

## Approved branch-scoped Preview rebuild

The owner approved a QA-only WebAuthn cutover. `PASSKEY_AUTH_ENABLED=true` was configured for **this Preview branch only** (not Production or default Preview). This documentation-only revision triggers a new Vercel Preview so the deployment captures the new branch-scoped environment setting. The stable `passkeys-dev.usd-impact.com` alias must not move until the new exact deployment is READY and validated. Roll back to `dpl_4AFH5j8SV4uKeMugTknK7Q1qKJVn` if validation fails. No user secrets or credentials are recorded here.
