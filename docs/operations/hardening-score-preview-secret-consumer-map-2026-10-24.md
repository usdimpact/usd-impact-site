# Score Preview shared-secret consumer map — 2026-10-24

Status: **READ-ONLY / PREVIEW-ONLY / NO SECRET ROTATION / NO ACTIVATION**

This document maps the current and historical consumers of `SCORE_EDGE_SHARED_SECRET` so the Vercel Preview `readable-secret` finding can be remediated later without breaking the isolated Score handoff.

## Current provider evidence

### Website Vercel Preview — PR #836

Branch: `feat/score-membership-handoff-147`

Provider metadata currently contains a branch-scoped Preview variable:

- name: `SCORE_EDGE_SHARED_SECRET`
- target: Preview only
- Vercel type: `encrypted`
- provider issue: `readable-secret`
- intended scope: one-use private Score handoff for issue #147

The branch source still exposes two **disabled-by-default** private routes:

- `/api/score-edge-redeem`
- `/api/score-edge-validate`

Both read `SCORE_EDGE_SHARED_SECRET` and compare the incoming `x-score-edge-secret` value in constant time. Their separate activation flags remain the controlling safety boundary. This is the older Cloudflare-to-Vercel path.

### Cloudflare Workers Preview — Score PR #148

Parent Worker: `usd-impact-score-isolated-dev`

Isolated Preview: `pr-148`

Latest inspected Preview deployment:

- deployment id: `01242206-e5cc-46a8-9119-ff6f5fdada60`
- deployment number: 17
- Score source commit: `9c311b7e316f7aa2c707728d0a2477ef24131965`
- `SCORE_EDGE_SHARED_SECRET`: provider type `secret_text`
- `SCORE_PREVIEW_MACHINE_PASSWORD`: provider type `secret_text`
- `SCORE_PREVIEW_REDEEM_LIMIT`: 30 / 60 seconds
- `SCORE_PREVIEW_VALIDATE_LIMIT`: 180 / 60 seconds
- `SCORE_WORKER_PREVIEW_ENABLED=false`
- `SCORE_DEV_BROKER_ENABLED=false`
- `SCORE_EDGE_GATE_ENABLED=false`
- `SCORE_EDGE_REDEMPTION_ENABLED=false`
- `SCORE_PREVIEW_DIAGNOSTICS_ENABLED=false`

The current Worker source does **not** call the Vercel private edge routes. It calls the Development Supabase Edge broker directly and supplies:

1. `X-Score-Edge-Secret: SCORE_EDGE_SHARED_SECRET`; and
2. a freshly minted least-privilege Supabase machine-user JWT.

Thus the current Worker architecture is Worker -> Supabase Development broker, not Worker -> Vercel private edge endpoint.

The parent Worker script's ordinary secret list is empty because Preview secrets belong to the isolated Workers Preview deployment rather than the parent Worker.

### Supabase Development Edge broker

Project: `usd-impact-development` (`ycstrcvshdluovtuasjc`)

Function: `score-preview-broker`

Current inspected metadata:

- version: 17
- status: ACTIVE
- `verify_jwt=true`
- handler reads `SCORE_EDGE_SHARED_SECRET`
- handler reads `SCORE_PREVIEW_BROKER_ENABLED`
- handler verifies the request URL is exactly the Development broker endpoint
- handler validates `x-score-edge-secret` against the configured shared secret
- handler accepts only bounded JSON operations `redeem` or `validate`
- database access uses the Development secret key server-side only
- request budget is enforced after authentication through the dedicated database RPC

The connected Supabase tools do not expose Edge Function secret values or a safe secret-equality primitive. Therefore **cryptographic equality of the Cloudflare and Supabase shared-secret values is not established by this audit**.

## Architecture conclusion

There are currently two source-level consumers on the website/Score branches:

1. **Current intended Preview path:** Cloudflare Worker -> Supabase Development Edge broker.
2. **Older disabled compatibility path:** Cloudflare -> Vercel `/api/score-edge-redeem` / `/api/score-edge-validate`.

Because the current Worker client uses the direct Supabase broker, the Vercel branch-scoped `SCORE_EDGE_SHARED_SECRET` may now be redundant. It must **not** be deleted or reclassified yet because the website branch still contains executable handlers and tests for the older path.

## Safe remediation sequence

No step below is authorized by this document; it is a future cutover plan.

1. Keep all Worker and broker activation flags OFF.
2. Confirm PR #148's direct Worker -> Supabase broker path is the sole intended architecture.
3. Confirm no browser, Worker, test, recovery path, or operational runbook depends on the Vercel private edge endpoints.
4. Decide explicitly whether the Vercel edge handlers are:
   - retained as a documented disabled fallback; or
   - removed from the Score branch as obsolete.
5. If retained, migrate the Vercel branch variable to Vercel's non-readable secret classification through a Preview-only cutover, then re-run all disabled-state and exact-head checks.
6. If removed, delete the two Vercel edge routes/handlers and only then remove the branch-scoped Vercel shared-secret variable.
7. Do not alter the Cloudflare Preview secret or Supabase Development secret during the Vercel cleanup.
8. Establish Cloudflare <-> Supabase secret equality only through a safe authenticated challenge/exchange that reveals no secret material.
9. Re-run:
   - anonymous disabled-state denial;
   - machine-JWT rejection/acceptance boundaries;
   - wrong-secret denial;
   - replay/expiry/revocation tests;
   - rate-limit behavior;
   - direct broker abuse review;
   - standalone and iframe browser acceptance.
10. Keep both PR #836 and #148 draft/unmerged until separate Development acceptance is complete.

## Rollback

If any Preview validation regresses:

- restore the prior branch-only Vercel variable metadata/configuration if it was changed;
- keep all Score activation flags OFF;
- do not alter Cloudflare Production, Supabase Production, DNS, or `main`;
- preserve the known-good isolated Preview deployment and previous Vercel Preview as rollback references.

## Explicit non-actions in this audit

- no secret value read or printed;
- no Vercel variable changed;
- no Cloudflare secret changed;
- no Supabase secret changed;
- no activation flag changed;
- no ticket issued;
- no session created;
- no entitlement changed;
- no Production resource changed.
