# Lemon Squeezy commerce technical prefill — 2026-08-25

## Status and boundary

This is **public-documentation technical due diligence only** for Issue #53.

Lemon Squeezy has an active USD Impact store/application under review, but store provisioning and application receipt are **not** treated as product/company eligibility approval. This document does not select Lemon Squeezy, register an adapter, create a provider product or variant, configure an API key or webhook secret, enable checkout, authorize a payment, or change customer/entitlement state.

The purpose is narrower: determine how the current public Lemon Squeezy API/webhook surface maps to the already-approved USD Impact provider-neutral commerce contract so that an eventual eligibility approval cannot be mistaken for full technical compatibility.

## USD Impact contract that remains non-negotiable

Any selected provider must support the application capabilities already enforced by `apps/web/src/lib/commerce-provider.js`:

1. `checkout.create`
2. `webhook.verify-raw-body`
3. `event.normalize`
4. `payment.complete`
5. `refund.complete`
6. `dispute.open`
7. `chargeback.complete`
8. `dispute.reverse`

The provider path must normalize into the canonical event set:

- `checkout.pending`
- `payment.completed`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `refund.completed`
- `dispute.opened`
- `chargeback.completed`
- `dispute.reversed`

Browser redirects, receipt emails, screenshots, dashboard state, or unverified client data never grant or restore entitlement.

## Public Lemon Squeezy evidence reviewed

### 1. Hosted checkout and server-created checkout

Lemon Squeezy documents `POST /v1/checkouts` for creating a unique hosted checkout tied to a Store and Variant. The API supports:

- a provider variant relationship;
- `product_options.enabled_variants` to restrict which variants are offered;
- `checkout_data.custom` for bounded application metadata carried into order-related webhooks;
- `test_mode` separation;
- a server-specified `expires_at` timestamp;
- checkout preview values including currency, subtotal, tax and total.

The API also exposes `custom_price`. USD Impact must **not** use client-controlled custom pricing. If Lemon Squeezy is selected, the adapter should choose the approved provider variant/price server-side and restrict enabled variants/quantity according to the trusted purchase intent.

Public references:

- https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- https://docs.lemonsqueezy.com/api/checkouts/the-checkout-object
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- https://docs.lemonsqueezy.com/help/checkout/passing-custom-data

### 2. Raw-body webhook authenticity

Lemon Squeezy documents HMAC-SHA256 webhook signing with the signing secret and the exact request body. The signature is sent in `X-Signature`; the published Node example computes the digest over `request.rawBody` and uses a timing-safe comparison.

This maps cleanly to USD Impact's `webhook.verify-raw-body` requirement, subject to sandbox proof against the exact runtime route.

Public references:

- https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks

### 3. Webhook delivery and retry behavior

Lemon Squeezy requires a `200` response for successful capture. Public documentation says a failed delivery is retried up to three additional times using exponential backoff, with example intervals of approximately 5, 25 and 125 seconds.

Recent webhook payloads can be inspected and resent from the provider dashboard. The reviewed public payload examples expose `meta.event_name`, the resource object, resource IDs and optional `meta.custom_data` but do **not** document a separate immutable webhook-delivery/event identifier in the request payload.

If Lemon Squeezy is selected, USD Impact must prove a stable deduplication identity in sandbox. A deterministic identity derived from verified immutable provider data/raw-body evidence may be acceptable only if it is explicitly reviewed and proven to suppress true retries without collapsing distinct state changes.

Public references:

- https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
- https://docs.lemonsqueezy.com/help/webhooks/example-payloads
- https://docs.lemonsqueezy.com/help/webhooks

### 4. One-time order webhook surface

Lemon Squeezy labels its Event Types page as the **full list of webhook events available**. For one-time orders, the published order events are:

- `order_created` — a new order was successfully placed;
- `order_refunded` — a full or partial refund was made.

The reviewed list does not expose distinct one-time order webhooks for payment failure, customer cancellation, checkout expiry, dispute opening, chargeback completion or dispute reversal.

This is the main current compatibility gap and must not be hidden by a future product-eligibility approval.

Public reference:

- https://docs.lemonsqueezy.com/help/webhooks/event-types

### 5. Test mode and simulation

Lemon Squeezy provides a store Test mode with separate test/live products, purchases, API keys and webhooks. Test cards include successful cards as well as insufficient-funds and expired-card cases.

Test-mode webhooks behave like live-mode webhooks for events that occur. Lemon Squeezy also provides manual webhook simulation, but the published manually simulatable one-time order events are only:

- `order_created`
- `order_refunded`

Therefore Test mode can exercise declined/expired-card checkout UX and can prove the supported order/refund webhook path, but public documentation does not show a way to simulate the missing one-time failure/cancellation/expiry/dispute/chargeback/reversal events because those events are not in the published one-time order webhook set.

Public references:

- https://docs.lemonsqueezy.com/help/getting-started/test-mode
- https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events
- https://docs.lemonsqueezy.com/guides/developer-guide/testing-going-live

### 6. Order identity and completed-payment evidence

The Order object includes stable provider-side fields useful for trusted reconciliation, including:

- resource `id`;
- an order `identifier` UUID;
- customer ID;
- order status;
- currency, tax and total values;
- first order-item product and variant IDs;
- `created_at`, `updated_at` and `test_mode`.

`order_created` is documented as occurring when a new order is successfully placed and its example Order object has `status: paid`. This is a strong public basis for provisional mapping to `payment.completed`, subject to exact variant/product/amount/currency/account/purchase-intent verification in the adapter and sandbox.

Public references:

- https://docs.lemonsqueezy.com/api/orders/the-order-object
- https://docs.lemonsqueezy.com/help/webhooks/example-payloads

### 7. Refund behavior

Lemon Squeezy supports full and partial refunds from the dashboard and via `POST /v1/orders/:id/refund`. The `order_refunded` webhook is documented for both full and partial refunds.

USD Impact's launch policy must not silently treat every partial refund as equivalent to a complete purchase reversal. If Lemon Squeezy is selected, the adapter and operating policy must explicitly define whether partial refunds are permitted and how they affect entitlement. The safest launch configuration is to avoid partial-refund ambiguity unless a separately reviewed rule is required.

Lemon Squeezy also states that it reserves the right to issue refunds within 60 days to prevent chargebacks. Provider-initiated refunds therefore must be treated as authoritative commercial events once verified.

Public references:

- https://docs.lemonsqueezy.com/api/orders/issue-refund
- https://docs.lemonsqueezy.com/help/orders/refund-order
- https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks

### 8. Chargeback/dispute operations versus event visibility

Lemon Squeezy's public chargeback documentation says Lemon Squeezy generally handles chargebacks against seller transactions and may issue a refund on the seller's behalf, with the outcome ultimately determined by the payment provider/card network.

However, the reviewed **full webhook event list** does not document dedicated one-time events for:

- dispute opened;
- chargeback final/lost outcome;
- won dispute / reversal.

The public material also does not establish that an `order_refunded` webhook is guaranteed to represent every chargeback lifecycle stage or final dispute outcome. Those semantics therefore remain selection-critical and require authoritative written/provider-technical confirmation before an adapter can satisfy the USD Impact contract.

Public references:

- https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks
- https://docs.lemonsqueezy.com/help/webhooks/event-types

## Provisional canonical mapping

| USD Impact canonical event | Lemon Squeezy public evidence | Current technical disposition |
|---|---|---|
| `checkout.pending` | API can create a Checkout object, but no one-time `checkout_created/pending` webhook is listed | **PARTIAL / BLOCKED** — server-created purchase intent + checkout may establish local pending state, but the exact authoritative transition must be reviewed |
| `payment.completed` | `order_created` after a successfully placed order; Order object exposes paid order/product/variant/amount/currency data | **SUPPORTED IN PUBLIC DOCS** — sandbox proof still required |
| `payment.failed` | Test cards can cause failed checkout attempts; no one-time failure webhook appears in the full event list | **BLOCKED pending authoritative mechanism or approved safe equivalent** |
| `payment.cancelled` | no one-time cancellation webhook appears in the full event list | **BLOCKED pending authoritative mechanism or approved safe equivalent** |
| `payment.expired` | Checkout API supports `expires_at`; no expiry webhook appears in the full event list | **PARTIAL / BLOCKED** — a server-owned expiry rule may be possible, but must be explicitly reviewed and proven |
| `refund.completed` | `order_refunded`, including full or partial refunds | **SUPPORTED IN PUBLIC DOCS** — full-vs-partial entitlement policy and sandbox proof still required |
| `dispute.opened` | operational chargeback documentation exists; no dedicated dispute webhook appears in the full event list | **BLOCKED pending authoritative event/API evidence** |
| `chargeback.completed` | Lemon Squeezy generally handles chargebacks; no distinct final chargeback outcome webhook appears in the full event list | **BLOCKED pending authoritative final-outcome evidence** |
| `dispute.reversed` | no won-dispute/reversal webhook appears in the full event list | **BLOCKED pending authoritative restoration evidence** |

## Current technical qualification result

**Do not select Lemon Squeezy for sandbox implementation solely on the basis of store/product eligibility approval.**

Public documentation currently provides strong evidence for:

- provider-hosted/server-created checkout;
- server-controlled variant selection and bounded custom metadata;
- raw-body HMAC-SHA256 signature verification;
- separate test/live environments;
- successful order evidence;
- full/partial refund webhooks;
- bounded webhook retry behavior.

Public documentation does **not** yet close the complete USD Impact one-time lifecycle contract. At minimum, selection still requires authoritative answers for failed/cancelled/expired payments, dispute opening, final chargeback outcome, reversal/restoration, and stable delivery/deduplication identity.

These gaps are technical qualification questions, not evidence that Lemon Squeezy cannot support the required behavior through another documented API/status mechanism. They must be answered before adapter registration.

## Questions to resolve if product/company eligibility is approved

1. For one-time products, what server-authoritative event or API state should a seller use for failed payment, customer cancellation and checkout expiry?
2. Is there a documented API or webhook surface for dispute/chargeback opened, final lost outcome and won/reversed outcome for one-time orders?
3. Does an `order_refunded` webhook fire for provider-initiated chargeback-prevention refunds and chargeback-related refunds, and what field distinguishes ordinary seller refund from dispute/chargeback handling?
4. Is there an immutable delivery/event identifier for each webhook occurrence or resend that is not visible in the current public payload examples? If not, what deduplication key does Lemon Squeezy recommend?
5. Can all required lifecycle cases be produced in Test mode or through provider-supported simulation without real Production payments?
6. Can partial refunds be disabled or operationally avoided for the initial one-time Library Pass, and what exact refund fields identify full versus partial amount?
7. What are the definitive Merchant-of-Record, tax/VAT, invoice, refund-support, chargeback, reserve, payout and buyer-support responsibilities for SC Kela Leads SRL and this product?
8. What DPA/subprocessor/data-retention/export, incident escalation, API/webhook secret rotation and Live-review requirements apply to the approved store?

## Selection rule

Lemon Squeezy may move from application-review candidate to **selected for sandbox implementation** only after:

- written product/company eligibility is affirmative;
- the full responsibility matrix is acceptable;
- every required canonical lifecycle event has an authoritative provider source or separately reviewed safe equivalent;
- raw-body verification, identifiers/deduplication and sandbox coverage are adequate;
- privacy, incident, rollback and secret-rotation requirements are known;
- the provider choice is explicitly approved.

Until then, Production remains `ready_for_provider_configuration`, `COMMERCE_MODE=disabled`, no adapter is registered, and public checkout remains disabled.
