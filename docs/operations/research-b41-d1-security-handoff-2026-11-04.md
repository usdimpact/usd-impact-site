# Research #1103 — B-4.1 isolated checkout reservation/security review

**Date:** 2026-11-04. **Scope:** D1-approved synthetic PostgreSQL tests ONLY.
This Draft is stacked from [#1117](https://github.com/usdimpact/usd-impact-site/pull/1117) at `9e3dc4dc56c283e329f82339d206c3a6eca340e3`; protected main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`.
Other active work includes [#1120](https://github.com/usdimpact/usd-impact-site/pull/1120), a separate D5/D6 **documentation-only** owner-decision packet; do not modify, copy, or merge that PR.

## Why the B-4 synthetic design needs further hardening

Claude Assignment 36 independently executed the previous D1 and B-4 suites on real PostgreSQL 16.15. Tests passed, but the independent verdict is **B-4 synthetic HOLD / Research Production activation BLOCK**. Key findings:

- **N36-1 / Live P1 risk:** `apps/web/src/lib/research-membership-first-purchase.js` checks a checkout key format, not its issuance or account-bound reservation. Owner screenshots show a direct Lemon Squeezy Research Membership Share URL that does not visibly contain trusted account-binding parameters. Lemon Squeezy documentation permits `checkout[custom][...]` query parameters from the buyer and relays them in signed `meta.custom_data`. Signing the webhook authenticates the payload delivery but does not prove the buyer-supplied account ID or checkout key was authorized by USD Impact. No actual fraudulent charge or signed-out payment completion is established.
- **Y1 (prototype P1):** Previously, any synthetic API caller could call `observe_signed_paid` and then activate an arbitrary account. Caller trust must be separated from authentic provider verification.
- **Y2 (prototype P1):** Refunded subscriptions were eligible for reactivation; activation must require the exact signed paid state and appropriate local pending state.
- **Y3, Y5, Y6 (prototype P2):** Cross-account provider-subscription collisions, default PUBLIC EXECUTE on future functions, and unscoped updates to Library Pass require fail-closed controls.
- **X3/X8 remain:** Conflict rows written inside rolled-back transactions disappear (the independently committed paid observation survives), and a stored v1 receipt cannot be replayed as v3 without frozen version handling.

## B-4.1 isolated fixture

New `docs/operations/research-b41-reservation-provenance-2026-11-04.sql` runs AFTER the original B-4 tests. It is intentionally **not** under `supabase/migrations`; it does not touch real application schemas.

- Only a separate synthetic `review_b41_checkout_issuer` role may call `issue_reserved_checkout_v41`, which mints a random high-entropy key in a private `checkout_reservations_v41` table, bound to an account, provider price and 30-minute expiry. Only a matching unexpired, unconsumed reservation permits binding; raw checkout keys are not stored, only SHA-256 digests.
- Only a distinct synthetic `review_b41_paid_verifier` role may call `record_verified_paid_v41`. Every observation records a *claimed* account/checkout digest, provider subscription/event, price, raw-body SHA-256, verifier version and signed provider state. The **real HMAC must be verified upstream**; the fixture CANNOT authenticate a real Lemon Squeezy payment, and a trusted verifier role could still lie if improperly configured. Never mistake these fields for real payment proof.
- Provider subscription identity is claimed at observation time, with distinct-account reuse recorded as `provider_identity_conflict`; a changed provider event id is not silent account transfer.
- The generic synthetic `review_binding_api` role can only bind/activate records accepted by the verifier and checkout issuer. Legacy unguarded B-4 RPC EXECUTE is explicitly revoked from that API role inside the test overlay; no real app is wired to the new functions.
- Binding returns an audited non-applied conflict for unissued, wrong-price, expired or already-consumed checkout keys. A paid but unbound direct Share checkout retains a signed-event observation but grants **no** entitlement, pending human reconciliation.
- Activation requires a verified paid event, a consumed matching reservation and a **pending** local subscription; a refunded/cancelled local subscription cannot be reactivated. The synthetic test also verifies exactly-once activation and a legitimate idempotent replay.
- Future function defaults revoke PUBLIC EXECUTE for test schema creators, while the existing synthetic writer grants remain narrowly scoped. A Library Pass trigger refuses INSERT/UPDATE/DELETE on Library Pass entitlements, even if the synthetic Research writer has generic table UPDATE; this is **not** a production RLS/grant proof.

## Expected D1 tests (synthetic real Postgres only)

The new `scripts/test-research-d1-b41-reservation-hardening.py` runs against the same throwaway PostgreSQL 16.15 service container **after** the earlier B-4 suite.

| Finding | Negative test |
|---|---|
| N36-1 | A buyer-invented checkout key is rejected without an issued reservation; direct Share event without account binding is observed but not entitled |
| Y1 | Binding API cannot mint verified-paid observations or issue reservations; verifier and issuer roles separate; no SET ROLE |
| Y2 | A local `refunded` subscription cannot activate; a consumed checkout key cannot bind another provider subscription |
| Y3 | Two different account IDs claiming the same provider subscription raise an observation-time conflict |
| Y5 | A new canary function created after the fixture has no PUBLIC EXECUTE privilege |
| Y6 | Attempts to modify/delete Library Pass entitlement rows are rejected; rows unchanged |
| Expiry | A paid event whose legitimate reservation expired is held unbound for operator reconciliation; this is expected loss-prevention tradeoff |
| Original B-4 | T13/T21/T22/X1/X2/X3/X4/X8 and original isolated receipt tests continue to run before B-4.1 |

**Known gaps:** A synthetic verifier caller can still report arbitrary fake data. This design does not prove real HMAC validation, issuer user-session authorization, an actual provider subscription-object watermark, real checkout/cancel/refund behavior, a committed conflict after outer-transaction rollback, Supabase service_role/RLS or historic v1/v2 receipt migration. The expiry policy may hold legitimate paid customers for manual recovery. These are **release blockers**, not ignored test failures.

## Owner decisions and parallel work

- D1: Approved for disposable synthetic PostgreSQL, without real customer or provider data. This Draft stays in that boundary.
- D2: Real roles, grants, RLS, SECURITY DEFINER and Production/Development migration — **HOLD**.
- D3: Existing hosted checkout and entitlement policy — **HOLD**.
- D4: Read-only provider reconciliation credentials — **DEFERRED**.
- D5: Product is Live with both $29 monthly and $290 annual subscriptions and standard direct Share checkout links — **CONFIRMED** from owner screenshots. Real signed-out paid checkout and exploit success — **UNVERIFIED**. Deciding to disable/hide a live product or link requires a separate owner-approved merchant/customer-impact plan. Do not change merchant settings.
- D6: Refund/relink/cancel and audit retention — **HOLD**; [#1120](https://github.com/usdimpact/usd-impact-site/pull/1120) is separately preparing the decision packet.
- D7: Receipt flag and Production activation — **BLOCKED**.

**Next independent Claude review:** verify exact GitHub SHA/5 checks and log-level B4.1 tests; challenge Y1's upstream verifier trust, reservation issuance authority, expiry and return paths, provider-identity collisions, refund replay, default privileges, Library Pass scope, role ownership, and X3 journal rollback. Return code-level PASS/BLOCK/HOLD for the synthetic fixture and separate Production BLOCK. Preserve unrelated #1111, #1120, #840, F2, Score Rights, issue #950 and all other active sessions.

**NO merge, Production SQL/deployment, workflow activation beyond D1, real merchant request, payment/refund, customer entitlement, secrets, email or receipt flag changes.**
