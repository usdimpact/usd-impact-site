# Commerce provider candidate evidence — 2026-08-21

> **Historical snapshot — superseded for current provider status.** FastSpring's written eligibility decision was received on 2026-08-25 22:33 UTC and **rejected the disclosed product for processing**, so FastSpring is no longer an active candidate. For current eligibility/contact state use `docs/operations/commerce-provider-eligibility-update-2026-08-26.md`, `docs/operations/commerce-provider-technical-qualification-matrix-2026-08-25.md`, and Issue #53. The technical research below is retained as the evidence available on 2026-08-21 and must not be read as today's ranking.

## Status

Decision support only. No provider is selected. Checkout remains disabled. This evidence does not authorize account creation, adapter registration, secrets, sandbox activation, Live testing, or Production commerce activation.

Product: `Read the Dollar First Library Pass`

Business entity: SC Kela Leads SRL, Romania.

## Current provisional ranking as recorded on 2026-08-21

1. **FastSpring — then-current primary Merchant-of-Record candidate pending Sales pre-clearance and closure of final lifecycle-event gaps.** **This ranking is superseded by the later written rejection.**
2. **PayPro Global — strong Merchant-of-Record and lifecycle coverage, but its documented webhook signature is field-derived rather than a raw-body signature and therefore does not yet satisfy the current USD Impact adapter contract.**
3. **Stripe Managed Payments — excellent technical/Merchant-of-Record fit and Romania support, but policy-blocked pending written confirmation because Managed Payments explicitly prohibits NFT or cryptocurrency-related products.**
4. **Lemon Squeezy — policy-blocked pending an affirmative written determination because its public prohibited-products policy includes NFT and crypto-related products.**

This ranking was provisional even when written. Written product/company eligibility, commercial terms, privacy terms, and technical sandbox evidence were mandatory before selection. The later FastSpring rejection demonstrates why public technical fit alone was never sufficient.

## FastSpring

### Confirmed public evidence available at the time

- FastSpring webhook signing supports HMAC-SHA256 over the raw payload, Base64 encoded in `X-FS-Signature`.
- Webhook endpoints can receive live, test, or both event classes.
- Documented order events include `order.payment.pending`, `order.completed`, `order.failed`, and `order.canceled`.
- `return.created` covers an issued refund/return.
- `chargeback.created` covers chargeback initiation.
- Duplicate/retry handling is documented; automatic retries preserve event identity while manual resends can create a new event ID.

### Mailbox state as of the 2026-08-21 snapshot

FastSpring Seller Support case `01856169` redirected the eligibility packet to Sales through FastSpring's sign-up route. A follow-up asked Support to forward the packet or provide a Sales path that could answer the written questions before integration. No affirmative Sales eligibility decision had been received at that snapshot date.

**Later disposition:** case #01856172 delivered the written decision on 2026-08-25 22:33 UTC and the current product path is now **REJECTED / CLOSED**. See the 2026-08-26 eligibility update.

### Remaining technical gaps recorded at the time

- authoritative equivalent for `payment.expired`;
- generic dispute-warning/opened semantics beyond chargeback initiation;
- final lost-chargeback outcome event/state;
- won-dispute/reversal event/state suitable for access restoration;
- complete sandbox simulation proof.

These gaps are now historical because product eligibility failed before adapter work.

### Official references

- https://developer.fastspring.com/reference/message-security
- https://developer.fastspring.com/reference/webhooks-overview
- https://developer.fastspring.com/reference/orders-1
- https://developer.fastspring.com/reference/returncreated
- https://developer.fastspring.com/reference/order-chargeback

## PayPro Global

### Confirmed current public evidence in the 2026-08-21 review

- PayPro Global publicly positions itself as Merchant of Record for digital businesses and lists a Romania office.
- Its documentation covers one-time `OrderCharged`, `OrderRefunded`, `OrderChargedBack`, `OrderDeclined`, `OrderChargedBackWon`, and `OrderOnWaiting` events.
- `OrderChargedBackWon` is a particularly useful authoritative reversal signal.
- Webhook/IPN failure is retried every 30 minutes for a maximum of three attempts, followed by email notification; the dashboard supports IPN history and manual resend.
- PayPro provides an IPN simulator and test-order mode.
- PayPro documents a SHA-256 `SIGNATURE` computed from selected order/status/amount/email/validation-key/test-mode/event-name fields, plus an older MD5 `HASH` mechanism and source-IP controls.

### Contract mismatch

The current USD Impact adapter contract requires exact raw-body webhook verification. PayPro's documented SHA-256 signature is calculated from selected canonical fields rather than the exact `application/x-www-form-urlencoded` request body.

Therefore PayPro remains **technically blocked** unless either:

1. PayPro confirms an additional raw-body signing mechanism for this account/integration, or
2. a separately reviewed security decision changes the USD Impact adapter contract without weakening authenticity, replay, substitution and parsing-boundary protections.

No such contract change is authorized by this evidence.

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

### Confirmed public evidence in the 2026-08-21 review

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

At the 2026-08-21 snapshot, the support pre-clearance request had already asked for a written policy determination. Since then, Lemon Squeezy requested a store application, the application was submitted, product/business evidence was supplied, and store access was provisioned. As of the fresh 2026-08-26 mailbox review, **no affirmative product/company eligibility decision has arrived**. Store provisioning is not treated as approval.

### Official references

- https://docs.lemonsqueezy.com/help/getting-started/prohibited-products
- https://docs.lemonsqueezy.com/help/getting-started/activate-your-store

## Outreach state — historical snapshot plus current correction

- **FastSpring:** historical state was Sales pending; **current state is rejected/closed after case #01856172 decision on 2026-08-25 22:33 UTC**.
- **PayPro Global:** written pre-clearance packet/follow-up sent; fresh 2026-08-26 Gmail review shows no reply.
- **Lemon Squeezy:** application review remains pending; fresh 2026-08-26 Gmail review shows no affirmative approval after store provisioning.
- **Stripe:** direct Sales email was not a qualifying review; product-specific policy question still requires an official human review path before eligibility can advance.

## Decision rule

Do not build or register an adapter merely because public documentation looks compatible or a store/account is provisioned. Selection requires:

1. affirmative product/company eligibility;
2. acceptable Merchant-of-Record/legal/tax/support allocation;
3. acceptable commercial terms;
4. authoritative coverage for every required USD Impact canonical commercial state;
5. webhook authenticity compatible with the reviewed application contract;
6. complete sandbox proof;
7. privacy and operational review;
8. explicit owner approval of the selected provider.

A provider that issues a written rejection is removed from the current product path rather than left “pending.”

Until one remaining provider passes these gates, `COMMERCE_MODE=disabled`, no adapter is registered, and public checkout remains disabled.
