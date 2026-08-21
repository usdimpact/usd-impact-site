# Commerce provider candidate evidence — 2026-08-21

## Status

Decision support only. No provider is selected. Checkout remains disabled. This evidence does not authorize account creation, adapter registration, secrets, sandbox activation, Live testing, or Production commerce activation.

Product: `Read the Dollar First Library Pass`

Business entity: SC Kela Leads SRL, Romania.

## Current provisional ranking

1. **FastSpring — current primary Merchant-of-Record candidate pending Sales pre-clearance and closure of final lifecycle-event gaps.**
2. **PayPro Global — strong Merchant-of-Record and lifecycle coverage, but its documented webhook signature is field-derived rather than a raw-body signature and therefore does not yet satisfy the current USD Impact adapter contract.**
3. **Stripe Managed Payments — excellent technical/Merchant-of-Record fit and Romania support, but policy-blocked pending written confirmation because Managed Payments explicitly prohibits NFT or cryptocurrency-related products.**
4. **Lemon Squeezy — policy-blocked pending an affirmative written determination because its public prohibited-products policy includes NFT and crypto-related products.**

This ranking is provisional. Written product/company eligibility, commercial terms, privacy terms, and technical sandbox evidence remain mandatory before selection.

## FastSpring

### Confirmed current public evidence

- FastSpring webhook signing supports HMAC-SHA256 over the raw payload, Base64 encoded in `X-FS-Signature`.
- Webhook endpoints can receive live, test, or both event classes.
- Documented order events include `order.payment.pending`, `order.completed`, `order.failed`, and `order.canceled`.
- `return.created` covers an issued refund/return.
- `chargeback.created` covers chargeback initiation.
- Duplicate/retry handling is documented; automatic retries preserve event identity while manual resends can create a new event ID.

### Current mailbox state

FastSpring Seller Support case `01856169` redirected the eligibility packet to Sales through FastSpring's sign-up route. A follow-up asked Support to forward the packet or provide a Sales path that can answer the written questions before integration. No affirmative Sales eligibility decision has been received yet.

### Remaining technical gaps

- authoritative equivalent for `payment.expired`;
- generic dispute-warning/opened semantics beyond chargeback initiation;
- final lost-chargeback outcome event/state;
- won-dispute/reversal event/state suitable for access restoration;
- complete sandbox simulation proof.

FastSpring remains the primary candidate, but these are release-significant gaps until Sales/technical onboarding supplies authoritative mechanisms.

### Official references

- https://developer.fastspring.com/reference/message-security
- https://developer.fastspring.com/reference/webhooks-overview
- https://developer.fastspring.com/reference/orders-1
- https://developer.fastspring.com/reference/returncreated
- https://developer.fastspring.com/reference/order-chargeback

## PayPro Global

### Confirmed current public evidence

- PayPro Global publicly positions itself as Merchant of Record for digital businesses and lists a Romania office.
- Its documentation covers one-time `OrderCharged`, `OrderRefunded`, `OrderChargedBack`, `OrderDeclined`, `OrderChargedBackWon`, and `OrderOnWaiting` events.
- `OrderChargedBackWon` is a particularly useful authoritative reversal signal.
- Webhook/IPN failure is retried every 30 minutes for a maximum of three attempts, followed by email notification; the dashboard supports IPN history and manual resend.
- PayPro provides an IPN simulator and test-order mode.
- PayPro documents a SHA-256 `SIGNATURE` computed from selected order/status/amount/email/validation-key/test-mode/event-name fields, plus an older MD5 `HASH` mechanism and source-IP controls.

### Contract mismatch

The current USD Impact adapter contract requires exact raw-body webhook verification. PayPro's documented SHA-256 signature is calculated from selected canonical fields rather than the exact `application/x-www-form-urlencoded` request body.

Therefore PayPro must remain **technically blocked** unless either:

1. PayPro confirms an additional raw-body signing mechanism for this account/integration, or
2. a separately reviewed security decision changes the USD Impact adapter contract without weakening authenticity, replay, substitution and parsing-boundary protections.

No such contract change is authorized by this evidence update.

### Remaining selection gates

- written product/company eligibility;
- commercial terms, reserves and settlement details;
- explicit confirmation of webhook security options available to this seller;
- privacy/DPA review;
- full sandbox matrix;
- explicit provider-selection approval.

### Official references

- https://developers.payproglobal.com/docs/integrate-with-paypro-global/webhook-ipn/
- https://developers.payproglobal.com/docs/api/overview/
- https://payproglobal.com/
- https://payproglobal.com/about/

## Stripe Managed Payments

### Confirmed current public evidence

- Managed Payments is in Public Preview.
- Stripe lists **Romania** as a supported business location for Managed Payments.
- Managed Payments supports eligible digital products, including digital content/downloads, and supports one-time payments.
- Stripe acts as Merchant of Record for Managed Payments.
- Stripe documents responsibility for indirect-tax calculation/collection/filing/remittance, fraud prevention, dispute management, and transaction-level customer support.
- Stripe's standard webhook verification requires the exact raw request body, `Stripe-Signature`, and endpoint secret before parsing.
- Stripe exposes dispute-created and dispute-closed events. `charge.dispute.closed` identifies `won` or `lost` outcomes, allowing deterministic revocation/restoration mapping.
- Stripe documents refund events including `refund.created`, `refund.updated`, and `refund.failed`.

### Blocking product-policy ambiguity

Stripe Managed Payments explicitly lists **NFT or cryptocurrency-related products** among prohibited products. USD Impact does not sell cryptocurrency, transactions, custody, brokerage, signals, or financial services, but the Library Pass contains educational Bitcoin curriculum.

That wording is broad enough that USD Impact must not infer eligibility from the technical fit or Romania support. Stripe requires written product-specific clarification before Managed Payments can remain on the implementation path.

### Current USD Impact disposition

**Technical fit: excellent. Product-policy eligibility: BLOCKED pending written clearance.**

No account activation, Managed Payments enablement, or adapter work should begin on the assumption that educational Bitcoin content is permitted.

### Remaining selection gates

- written confirmation that the disclosed macro-finance education product, including educational Bitcoin content, is not prohibited as a cryptocurrency-related product;
- confirmation that Managed Payments is activatable for SC Kela Leads SRL during the Public Preview;
- full fee/reserve/payout/settlement terms for the account;
- DPA/subprocessor/data-location/retention review;
- sandbox proof for the complete USD Impact canonical event matrix;
- explicit provider-selection approval before adapter work.

### Official references

- https://docs.stripe.com/payments/managed-payments/how-it-works
- https://docs.stripe.com/payments/managed-payments/set-up
- https://docs.stripe.com/webhooks/signature
- https://docs.stripe.com/api/events/types
- https://docs.stripe.com/refunds
- https://docs.stripe.com/disputes/responding

## Lemon Squeezy

Lemon Squeezy's public documentation generally permits digital goods such as eBooks, PDFs, audio and video, but explicitly lists **NFT & Crypto related products** as prohibited. USD Impact does not sell or facilitate cryptocurrency, but the Library Pass includes educational Bitcoin content.

The support pre-clearance request already asks for a written policy determination. Until Lemon Squeezy confirms that educational discussion of Bitcoin does not make the product prohibited, this candidate remains **policy blocked** and no integration/account activation should begin.

### Official references

- https://docs.lemonsqueezy.com/help/getting-started/prohibited-products
- https://docs.lemonsqueezy.com/help/getting-started/activate-your-store

## Outreach state

- **FastSpring:** Support response received; Sales eligibility still pending.
- **PayPro Global:** written pre-clearance packet sent; no response yet.
- **Lemon Squeezy:** written policy pre-clearance packet sent; no response yet.
- **Stripe:** direct Sales email is not monitored. The product-specific policy question must be routed through Stripe's official Sales/Support path before eligibility can be considered pending with a human reviewer.

## Decision rule

Do not build or register an adapter merely because public documentation looks compatible. Selection requires:

1. affirmative product/company eligibility;
2. acceptable Merchant-of-Record/legal/tax/support allocation;
3. acceptable commercial terms;
4. authoritative coverage for every required USD Impact canonical commercial state;
5. webhook authenticity compatible with the reviewed application contract;
6. complete sandbox proof;
7. privacy and operational review;
8. explicit owner approval of the selected provider.

Until then, `COMMERCE_MODE=disabled`, no adapter is registered, and public checkout remains disabled.
