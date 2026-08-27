# Lemon Squeezy sandbox commerce runtime — 2026-08-26

Status: **Development/Test proof complete. Adapter registered in code only. No Production activation.**

This record supplements the selected-provider contract for the one-time Read the Dollar First Library Pass. It documents the credential-independent runtime and persistence implementation carried by PR #374.

## Safety boundary

The implementation remains fail closed:

- `COMMERCE_MODE` must be `sandbox` and `COMMERCE_PROVIDER` must be `lemon-squeezy`.
- `VERCEL_ENV=production` is rejected before provider or database credentials are used.
- `LEMON_SQUEEZY_TEST_MODE=true` is mandatory.
- the runtime accepts only the canonical Development Supabase project;
- sandbox checkout is restricted to one explicitly configured verified QA email;
- `commerce-adapters.js` registers only the reviewed Lemon Squeezy adapter in code; its configuration assessment remains fail closed;
- no Production provider secret, public checkout, Live transaction, real-card test, or Production schema application is authorized by this PR;
- the reconciliation route has no Vercel cron schedule in this implementation and also requires the existing `CRON_SECRET` plus `COMMERCE_RECONCILIATION_ENABLED=true`.

The reconciliation migrations were applied to canonical Development only and verified. They have not been applied to Production.

## Fixed-price variant model

The Library Pass has two server-trusted fixed price tiers:

- `launch`: USD 39.00;
- `standard`: USD 49.00.

The runtime therefore requires two distinct Lemon Squeezy Test Mode Variant IDs under the trusted Product. The server selects the Variant strictly from the durable `purchase_intents.price_tier`. A browser never supplies the price or trusted Variant selection.

`custom_price` is not used. The checkout exposes only the selected Variant, fixes quantity to one, and hides the discount-code field. Any authoritative order with a non-zero `discount_total` is rejected as outside the approved commercial contract.

## Source-driven amount invariant correction

Lemon Squeezy's current Order API documents `subtotal`, `discount_total`, `tax`, and `total` separately. Its current Order examples can show `first_order_item.price` equal to the tax-inclusive charged total while `subtotal` is the pre-tax product amount.

For that reason, the reviewed invariant is now:

1. trusted Store, Product, Variant and Test Mode must match;
2. authoritative Order Items must contain exactly one item with quantity exactly one;
3. order currency must be USD;
4. `subtotal` must equal the trusted purchase-intent base amount (3900 or 4900 cents);
5. `discount_total` must equal zero;
6. `total` is retained as the Merchant-of-Record final charged amount and may be greater than the base subtotal because of tax;
7. `first_order_item.price` is retained only as provider evidence and is not used as the trusted pre-tax base-price authority.

This is a tightening/correction of the earlier scaffold assumption, not permission for browser-controlled pricing.

## Authoritative event processing

Signed webhook delivery is necessary but not sufficient to mutate entitlement state.

For every supported webhook:

1. verify the exact raw request body with Lemon Squeezy HMAC-SHA256 `X-Signature` before parsing JSON;
2. load the durable trusted purchase intent from Supabase;
3. validate Store/Product/Variant/currency/base-price terms;
4. create or resume an idempotent durable webhook receipt using a SHA-256 hash of the raw body;
5. retrieve the current authoritative Order and its Order Items from the Lemon Squeezy Test Mode API;
6. apply the database mutation only from that current authoritative state;
7. mark the durable webhook receipt processed or failed.

An `order_created` webhook grants access only if the current authoritative Order still has status `paid`. If retrieval fails or the current state is no longer `paid`, no entitlement is granted.

## Reconciliation states

The durable `commerce_reconciliations` row tracks one purchased provider transaction. The application schedules bounded reconciliation attempts: initially daily, then every three days, then weekly. Each run is capped at 25 transactions, well below the provider API's published request limit.

Authoritative state behavior:

- `paid`: retain only when the local purchase is completed and entitlement remains active; a terminal/local conflict is review-required and is never auto-restored;
- `refunded`: revoke access as refunded only when the full refunded amount equals the authoritative final order total;
- `fraudulent`: revoke entitlement using canonical `payment.revoked`; do not invent a local chargeback event or mutate the purchase into a fabricated chargeback state;
- `partial_refund`: review-required, with no automatic purchase or entitlement mutation;
- `pending` / `failed` after an existing completed purchase: review-required, with no grant or restoration.

## Partial-refund policy

The one-time Library Pass supports full refunds only. An unexpected provider `partial_refund` is therefore an exception state. It must not automatically grant, revoke, suspend, refund, or restore entitlement. The reconciliation row is moved to `review` for explicit handling.

## Persistence

The migration reuses the existing provider-neutral paid-access primitives:

- `purchase_intents`;
- `purchases`;
- `entitlements`;
- `entitlement_events`;
- `webhook_receipts`.

It adds only `commerce_reconciliations` plus service-role-only security-invoker RPCs for intent reservation, checkout attachment, webhook receipt state, atomic purchase completion, final-state application, and retry recording.

The new table has RLS enabled, no anon/authenticated grants, and explicit service-role-only access. New functions use `SECURITY INVOKER`, pin `search_path`, revoke execution from `public`, `anon`, and `authenticated`, and grant execution only to `service_role`.

## Route surface

One isolated Vercel function is added at `api/commerce.js` with framework body parsing disabled so the exact raw webhook body remains available.

Current action paths are:

- `POST /api/commerce?action=checkout` — verified sandbox QA account only;
- `POST /api/commerce?action=webhook` — exact raw-body signature verification;
- `GET /api/commerce?action=reconcile` — existing cron authorization plus explicit reconciliation enable flag.

No public checkout UI is connected by this implementation.

## Remaining gates

The Development/Test registration gate is complete. Remaining work is deliberately outside this code-only decision:

1. finish the account-specific KYB, tax, accounting, privacy and buyer-disclosure review;
2. perform the final launch-window support continuity check;
3. implement and review any mode-specific activation configuration separately;
4. obtain explicit approval before any Production secret, Live webhook, controlled Live transaction, public checkout, refund or Production database change;
5. keep Production `COMMERCE_MODE=disabled` until those later gates pass.
