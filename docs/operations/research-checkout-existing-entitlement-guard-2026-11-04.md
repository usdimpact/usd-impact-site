# Research Membership N1 checkout charge-without-access safeguard — Draft-only (2026-11-04)

**Source:** Claude Assignment 28 user-supplied independent read-only/PGlite report; canonical [Research P1 #1103](https://github.com/usdimpact/usd-impact-site/issues/1103); independent Stage A [Draft #1105](https://github.com/usdimpact/usd-impact-site/pull/1105). This document accompanies a **separate Draft** checkout-only guard from protected main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`.

## Failure verified in source

- `entitlements` permits only one row per `(account_id, product_id)`. A cancelled subscriber's revoked Research entitlement or a complimentary Research entitlement can remain in that slot.
- The checkout currently refuses *current* subscriptions, but a prior cancelled/refunded subscription or complimentary access may have none. Its first-purchase binding accepts `pending`; the activation RPC later rejects a conflicting old entitlement subscription source. Claude reported executing the corresponding R1/R2 reproduction against genuine migrations loaded into **single-session in-memory PGlite**. This is **not** a real PostgreSQL concurrency test or a verified Production incidence.
- Existing checkout links generated before any future deployment of this guard may still be usable; this is not a payment- or entitlement-level database guarantee.

## Interim fail-closed behavior proposed in this Draft

1. Preserve all existing auth, HTTPS, trusted test/Production merchant catalog, first-purchase checks and the existing block for `pending/active/past_due/cancel_scheduled` subscriptions.
2. Before **any** Lemon Squeezy paid checkout POST, perform one narrowly scoped server-side **read-only** `entitlements` query with verified account UUID, `product_id=research-membership`, `select=id`, `limit=1` and the **existing** service-role secret. No recipient email or extra PII is requested.
3. Any existing Research entitlement, whether revoked and linked to a historical subscription or active/complimentary with no subscription, yields `409 RESEARCH_CHECKOUT_ENTITLEMENT_CONFLICT`; no checkout URL is created. Do not attempt self-service migration or relink via this change.
4. A database failure, malformed response or invalid row ID yields `502 RESEARCH_CHECKOUT_ENTITLEMENT_LOOKUP_FAILED` and **no** provider checkout. An empty, valid entitlement result allows the existing flow to continue.
5. The public error mapper exposes only a generic rejection text plus safe categorical error code; no customer identity or provider credentials appear in the response.

## Synthetic acceptance

- First-time QA and Production checkout, with no current subscription or entitlement: continue as before.
- Historical cancelled subscriber with `revoked` Research entitlement: 409 before provider POST.
- Complimentary Research holder with active entitlement and null subscription link: 409 before provider POST.
- Production existing entitlement: 409 before provider POST.
- Existing current subscription: same existing 409 and no new entitlement read/provider POST.
- Entitlement lookup HTTP 503, malformed object, invalid returned UUID: fail closed 502 and no provider POST.
- Account/product-scoped REST filters verified and support-safe public error code.
- Existing first-purchase signed-webhook tests, refund/entitlement invariants and broader Web Quality regressions must remain green.

## Important limitations and decisions

- **The live N1 risk is NOT mitigated until separately approved deployment.** This branch is Draft/unmerged.
- Checkout-only eligibility is inherently a time-of-check/time-of-use check. It is **not atomic** with provider charge, existing outstanding checkout links, first binding or transition RPC. Stage B must add the durable database-level binding/entitlement guard and controlled re-subscription reconciliation. Any claim of preventing *all* new charges would be unsupported.
- Returning paid subscribers are temporarily directed to support instead of being allowed to purchase again. Complimentary holders must not be commercially converted by an implicit owner decision. Stage B should explicitly decide relink eligibility and notification terms.
- This change does **not** alter active Research checkout configuration, merchant products or variants, stored subscriptions or entitlements, SQL migrations, webhook event ordering, email, authentication, workflow/cron, privileges, keys or Production flags.
- Subsequent Stage B role ownership/SECURITY DEFINER proposal remains an independent security design decision and is **not** accepted by this checkout guard.

**HOLD:** no merge, Preview/Production deployment, live paid checkout, SQL execution, entitlement mutation or fee/refund action. Independent review of exact Draft SHA and separate owner release decision are required.
