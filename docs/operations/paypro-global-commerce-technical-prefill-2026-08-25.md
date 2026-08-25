# PayPro Global commerce technical prefill — 2026-08-25

## Status and boundary

This is **public-documentation technical due diligence only** for Issue #53.

PayPro Global remains a commerce-provider candidate. No written product/company eligibility approval has been received. This document does not select PayPro Global, create a vendor account/product, register an adapter, configure a secret or webhook, enable checkout, authorize a payment, or change customer/entitlement state.

The purpose is to compare current public PayPro Global technical documentation with the existing USD Impact provider-neutral commerce contract before any provider-specific implementation is authorized.

## USD Impact contract that remains non-negotiable

Any selected adapter must satisfy the capabilities already enforced by `apps/web/src/lib/commerce-provider.js`:

1. `checkout.create`
2. `webhook.verify-raw-body`
3. `event.normalize`
4. `payment.complete`
5. `refund.complete`
6. `dispute.open`
7. `chargeback.complete`
8. `dispute.reverse`

The provider path must normalize into:

- `checkout.pending`
- `payment.completed`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `refund.completed`
- `dispute.opened`
- `chargeback.completed`
- `dispute.reversed`

Browser redirects, thank-you-page parameters, emails, screenshots or unverified client state never grant or restore entitlement.

## Public PayPro Global evidence reviewed

### 1. Hosted checkout and server-authoritative product/price boundary

PayPro Global documents hosted web checkout and URL-based checkout configuration for one-time purchases. Product ID and quantity can be supplied in the purchase link. Dynamic settings can also alter names, discounts and prices, and custom `x-` fields can be returned through webhooks/API.

For USD Impact, dynamic client-controlled pricing must not be used as authority. If PayPro Global is selected, the safest initial design is:

- use one approved fixed provider product/price configuration;
- construct the checkout URL on the server from the trusted purchase intent;
- do not rely on client-supplied price/name/discount parameters;
- disable or avoid unnecessary cross-sell/upsell/dynamic-price surfaces;
- send only bounded opaque account/purchase-intent correlation data through approved custom fields;
- verify product ID, quantity, amount, currency, account and purchase intent again from the authenticated webhook/API evidence before entitlement changes.

Even if a user tampers with a checkout URL, a mismatched verified commercial event must fail closed rather than grant access.

Public references:

- https://developers.payproglobal.com/docs/checkout-pages/checkout-page-overview/
- https://developers.payproglobal.com/docs/checkout-pages/web-page/
- https://developers.payproglobal.com/docs/checkout-pages/url-parameters/
- https://developers.payproglobal.com/docs/checkout-pages/dynamic-checkout-links/
- https://developers.payproglobal.com/docs/checkout-pages/custom-parameters/

### 2. Webhook transport, retry and history

PayPro Global documents HTTPS POST webhooks/IPNs with `application/x-www-form-urlencoded` bodies. A successful endpoint response is HTTP 200. If initial IPN delivery fails, the provider documents retries every 30 minutes for a maximum of three attempts and a failed-IPN notification path. Dashboard IPN history can be inspected and events can be resent.

The payload includes `IS_RESENT=1` for a resent IPN. Public documentation does not expose a separate immutable unique IPN-delivery/event identifier comparable to a dedicated provider event UUID. `ORDER_ID`, `IPN_TYPE_NAME`, status and commercial fields are available, but a safe durable deduplication identity still needs to be designed and proven for repeated/partial/state-changing events.

Public reference:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/

### 3. Webhook authenticity — current contract mismatch

PayPro Global documents several authenticity controls:

- fixed provider source IP addresses;
- a `HASH` value derived from the order ID and a secret key for real orders;
- a `SIGNATURE` value calculated as SHA-256 over a concatenation of selected webhook fields plus a validation key.

This is useful authenticity evidence, but the reviewed public documentation does **not** describe an HMAC/digital signature calculated over the exact raw POST request body. The published `SIGNATURE` covers selected normalized field values, not the entire raw `application/x-www-form-urlencoded` byte sequence.

Therefore the current USD Impact capability `webhook.verify-raw-body` is **not yet proven compatible** with PayPro Global's public signing scheme. Do not weaken or rename that security contract solely to accommodate the provider.

Before selection, obtain authoritative technical confirmation of one of the following:

1. PayPro Global supports a cryptographic signature/HMAC over the exact raw webhook body; or
2. a separately security-reviewed field-signature design is accepted as an equivalent control, with a deliberate versioned change to the USD Impact contract and regression tests.

Option 2 would be a security-design change and must not happen implicitly as part of adapter implementation.

Public reference:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/

### 4. One-time webhook event surface

PayPro Global's order-related webhook catalog is comparatively rich:

- `OrderCharged` — successful one-time order processing;
- `OrderRefunded` — full refund;
- `OrderChargedBack` — provider has received a chargeback for the order;
- `OrderDeclined` — manual risk/support decline or bank decline;
- `OrderPartiallyRefunded` — partial refund;
- `OrderChargedBackWon` — dispute over a chargeback won in PayPro Global's favor;
- `OrderOnWaiting` — manual review or non-instant payment is waiting for processing; this is documented as an extended-webhook event.

Webhook/API order statuses include Waiting, Canceled, Refunded, Chargeback and Processed.

Public references:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/
- https://developers.payproglobal.com/docs/api/orders/get-list/
- https://developers.payproglobal.com/docs/api/orders/get-order-details/

### 5. Test-mode evidence

PayPro Global documents test orders through checkout parameters and test-mode support in its product/checkout tooling. Test webhooks are available and can carry the same order-related integration fields. Public documentation also describes separate test-order behavior for webhook hash verification.

However, the reviewed public documentation does not establish that every required USD Impact lifecycle case can be generated deterministically in test mode, especially chargeback receipt, chargeback-won/reversal, cancellation and expiry. Full sandbox/test coverage remains a selection gate.

Public references:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/
- https://developers.payproglobal.com/docs/one-time-fee-product/product-overview/
- https://developers.payproglobal.com/docs/checkout-pages/url-parameters/

### 6. Order identity and API reconciliation

The PayPro Global Orders API exposes stable order IDs and queryable order state. `GetOrderDetails` / `GetList` document order ID, order status, product ID, customer data, billing currency and other reconciliation fields. Webhooks also include `ORDER_ID`, `PRODUCT_ID`, quantity, order item ID, status, refund/chargeback amounts, test mode and custom fields.

These fields provide a strong basis for server-authoritative reconciliation. They do not by themselves solve the missing unique-IPN-event-ID question; provider-event deduplication and durable business-state idempotency both need explicit tests.

Public references:

- https://developers.payproglobal.com/docs/api/orders/get-list/
- https://developers.payproglobal.com/docs/api/orders/get-order-details/
- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/

### 7. Refund behavior

PayPro Global documents full refunds via `OrderRefunded` and partial refunds via `OrderPartiallyRefunded`; the payload identifies refunded amounts and can identify whether the refund was issued by PayPro Global or the vendor. A vendor API also exists for initiating refunds.

USD Impact must not silently map a partial refund to the same access transition as a complete purchase reversal. The initial one-time Library Pass should use a separately reviewed rule for partial refunds or operationally avoid them if the selected provider permits that simplification.

Public references:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/
- https://developers.payproglobal.com/docs/api/orders/do-refund/

### 8. Chargeback/dispute lifecycle

`OrderChargedBack` is documented when PayPro Global has received a chargeback for the order. `OrderChargedBackWon` is documented when the dispute over that chargeback is won in PayPro Global's favor. This gives PayPro Global a clearer chargeback reversal signal than some other candidates.

For USD Impact's canonical semantics, a conservative provisional interpretation is:

- `OrderChargedBack` can support immediate access revocation through `chargeback.completed` **or** may represent the opening of the chargeback dispute, depending on the final lifecycle semantics confirmed by PayPro Global;
- `OrderChargedBackWon` is a strong candidate for `dispute.reversed` / eligible access restoration;
- a distinct earlier `dispute.opened` / early-warning event is not documented in the reviewed order webhook list.

Do not emit both `dispute.opened` and `chargeback.completed` from a single provider event without an explicitly reviewed state-machine design. Written technical clarification is required on when a chargeback is considered opened versus final/lost in PayPro Global's model.

Public reference:

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/

### 9. Merchant-of-Record and tax claims remain provider-selection evidence, not eligibility approval

PayPro Global's current public technical documentation describes PayPro Global as a Merchant of Record and says its checkout/payment lifecycle includes tax calculation/remittance, invoicing, chargeback management and customer support. Its checkout documentation also says tax is added and PayPro Global accounting files/remits taxes.

Those general public statements are useful due-diligence evidence but do not constitute written acceptance of **SC Kela Leads SRL / USD Impact / Read the Dollar First Library Pass**. Product/company eligibility, the binding commercial agreement, fees/reserves/settlement and the exact responsibility allocation must still be confirmed for this account before selection.

Public references:

- https://developers.payproglobal.com/docs/selling-apps-outside-app-stores/technical-integration/
- https://developers.payproglobal.com/docs/checkout-pages/checkout-page-overview/

## Provisional canonical mapping

| USD Impact canonical event | PayPro Global public evidence | Current technical disposition |
|---|---|---|
| `checkout.pending` | `OrderOnWaiting` for manual review/non-instant payment; extended webhook access required | **PARTIAL / PLAUSIBLE** — extended-webhook availability and initial local-pending design must be confirmed |
| `payment.completed` | `OrderCharged` | **SUPPORTED IN PUBLIC DOCS** — sandbox proof still required |
| `payment.failed` | `OrderDeclined` | **SUPPORTED IN PUBLIC DOCS** — sandbox proof still required |
| `payment.cancelled` | order API/status model includes `Canceled`, but no dedicated `OrderCanceled` webhook is listed | **PARTIAL / BLOCKED** — authoritative transition mechanism must be defined |
| `payment.expired` | checkout links can have expiration, but no dedicated expiry webhook is listed | **PARTIAL / BLOCKED** — server-owned purchase-intent expiry may be possible but needs reviewed design |
| `refund.completed` | `OrderRefunded` for full refund; partial refund has separate event | **SUPPORTED IN PUBLIC DOCS** — partial-refund access policy and sandbox proof required |
| `dispute.opened` | no distinct early dispute/open event identified; `OrderChargedBack` fires when chargeback is received | **PARTIAL / BLOCKED** — provider lifecycle semantics must be confirmed |
| `chargeback.completed` | `OrderChargedBack` plus Chargeback order state | **PLAUSIBLE** — confirm whether event represents final/lost state or chargeback opening before canonical mapping |
| `dispute.reversed` | `OrderChargedBackWon` | **SUPPORTED / PLAUSIBLE** — exact restoration criteria and sandbox proof required |

## Current technical qualification result

PayPro Global's published one-time lifecycle surface is **closer to the USD Impact canonical event model than Lemon Squeezy's current public one-time webhook list**, particularly because it documents pending, success, decline, refund, chargeback and chargeback-won events.

It is **not yet technically qualified for selection** because the current public evidence leaves at least these selection-critical items unresolved:

1. exact-raw-body cryptographic verification versus PayPro Global's selected-field signature model;
2. a stable immutable webhook event/delivery identifier or an approved deterministic deduplication scheme;
3. authoritative `payment.cancelled` semantics;
4. authoritative `payment.expired` semantics;
5. the distinction between `dispute.opened` and final `chargeback.completed`;
6. deterministic test coverage for the complete required lifecycle matrix;
7. written product/company eligibility and account-specific commercial/legal/privacy obligations.

These are qualification questions, not a conclusion that PayPro Global cannot satisfy the contract. They must be resolved before adapter registration.

## Questions to resolve if/when PayPro Global replies

1. Does PayPro Global offer an HMAC/digital signature over the **exact raw webhook request body**? If not, what is its strongest recommended authenticity mechanism, and which fields are cryptographically covered?
2. Is there an immutable unique IPN/event ID for automatic retries and manual resends? If not, what deduplication key does PayPro Global recommend for one-time order events, including repeated partial refunds/state changes?
3. What authoritative server-side event/API transition represents a customer-cancelled one-time payment?
4. What authoritative server-side event/API transition represents an expired checkout or expired pending one-time payment?
5. At exactly what stage does `OrderChargedBack` fire: chargeback/dispute opening, processor acceptance, or final lost outcome?
6. Is there any separate dispute/early-warning event before `OrderChargedBack`?
7. Can `OrderChargedBack`, `OrderChargedBackWon`, `OrderOnWaiting`, `OrderDeclined`, full refund and cancellation/expiry states all be generated in test mode or through provider-supported simulation?
8. Is `OrderOnWaiting`/extended-webhook access available for this account/product and what activation is required?
9. Can the initial Library Pass be configured with one fixed server-authoritative product/price/quantity and without client-editable dynamic pricing/cross-sell behavior?
10. What are the definitive Merchant-of-Record, tax/VAT, invoice, refund-support, chargeback, reserve, payout and buyer-support responsibilities for SC Kela Leads SRL and this product?
11. What DPA/subprocessor/data-retention/export, incident escalation, credential rotation, webhook-key rotation and Live-review requirements apply?

## Selection rule

PayPro Global may move from candidate to **selected for sandbox implementation** only after:

- written product/company eligibility is affirmative;
- the account-specific responsibility/commercial matrix is acceptable;
- every required canonical lifecycle transition has an authoritative provider source or separately reviewed safe equivalent;
- webhook authenticity meets the existing raw-body security contract or an explicitly reviewed replacement contract is approved before adapter code;
- event/delivery deduplication and business-state idempotency are adequate;
- test-mode coverage is sufficient for the complete USD Impact matrix;
- privacy, incident, rollback and secret-rotation requirements are known;
- the provider choice is explicitly approved.

Until then, Production remains `ready_for_provider_configuration`, `COMMERCE_MODE=disabled`, no adapter is registered and public checkout remains disabled.
