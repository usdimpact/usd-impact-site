# Newsletter / Progress Production Dispatch Activation Candidate

Status: design-only candidate. This document does not authorize Production email delivery.

## Required invariant

Production dispatch must remain fail-closed unless all of the following are true:

- the runtime environment is exactly `production`;
- the applicable Production dispatch feature flag is exactly `true`;
- the Production email readiness gate is exactly `true`;
- Supabase server configuration resolves to the canonical Production project `gjzetjugmnwanvjkchux`;
- the existing purpose-specific consent, outbox, idempotency, provider-suppression, complaint, hard-bounce, retry-window, collision, and frequency-cap contracts pass unchanged;
- the sender/base URL configuration is inside the approved Production origin and sender set;
- a separately authorized owner canary is the first Production delivery action.

## Activation sequence

1. Merge code only after exact-head CI/security/Preview verification.
2. Keep Production dispatch feature flags false or absent after merge.
3. Verify Production runtime remains unable to send.
4. Configure only the minimum Production readiness variables required by the reviewed implementation.
5. Run one owner-controlled canary.
6. Verify provider acceptance, webhook correlation, terminal delivery state, duplicate suppression, unsubscribe, and runtime logs.
7. Broader scheduling/enablement requires a separate decision.

## Non-goals

This candidate does not authorize scheduler activation, broad subscriber sends, consent migration, audience imports, Resend automation changes, tracking changes, commerce/auth changes, or Research Membership activation.
