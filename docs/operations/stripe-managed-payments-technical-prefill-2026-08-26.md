# Stripe Managed Payments technical and policy prefill — 2026-08-26

## Purpose

Prepare a bounded, provider-specific qualification packet for **Stripe Managed Payments** as a fallback Merchant-of-Record candidate for the one-time **Read the Dollar First Library Pass**.

This document does **not** select Stripe, create/activate a Stripe account, accept Managed Payments terms, create products/prices, configure API keys or webhook secrets, register an adapter, run a payment, or enable public checkout.

Current commerce state remains provider-neutral and fail-closed:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null`;
- `providerConfigured=false`;
- `checkoutEnabled=false`.

FastSpring has failed written product eligibility. Lemon Squeezy remains under application review. PayPro Global has not replied and retains technical gaps. Stripe is therefore worth preparing as a **policy-review fallback**, but FastSpring's rejection does not automatically promote or select Stripe.

## Executive disposition

**TECHNICAL FIT: STRONG. PRODUCT-POLICY ELIGIBILITY: BLOCKED PENDING WRITTEN STRIPE SUPPORT REVIEW. NOT SELECTED.**

Public Stripe documentation reviewed on 2026-08-26 supports a strong technical fit for the provider-neutral USD Impact contract:

- Romania is listed as a supported Managed Payments business location;
- Managed Payments supports direct business-to-customer sale of eligible digital products;
- one-time payments are supported through Stripe Checkout;
- Stripe/Link acts as Merchant of Record for Managed Payments and handles global indirect-tax compliance, fraud prevention, dispute response and transaction-level customer support;
- webhook verification uses the exact raw request body, the `Stripe-Signature` header and endpoint secret;
- Checkout/event documentation exposes authoritative completion, delayed-payment success/failure and expiry events;
- Stripe event documentation exposes refund and dispute lifecycle events, including dispute creation and closed outcomes.

However, Managed Payments documentation also explicitly prohibits **“NFT or cryptocurrency-related products.”** USD Impact does not sell, transfer, custody, exchange or facilitate cryptocurrency and does not provide personalized investment advice or signals, but Bitcoin is included as an educational asset class in the Library Pass. USD Impact must not infer that educational Bitcoin content is outside that prohibition. A product-specific written Stripe Support decision is required before Stripe can become an active implementation candidate.

## Canonical disclosed product scope

**Product:** Read the Dollar First Library Pass  
**Seller/operator:** SC Kela Leads SRL, Romania  
**Delivery:** first-party digital educational content through `usd-impact.com`  
**Billing model:** one-time purchase; no recurring Research Membership in this launch

Included:

- Guided Interactive Edition of *Read the Dollar First*;
- quizzes, progress and mastery features;
- protected educational reference resources;
- complete English audiobook;
- 51-film educational video library with English captions.

Explicitly not offered:

- cryptocurrency purchase, sale, exchange, transfer, custody, staking, mining or wallet services;
- brokerage, investment management, currency exchange, lending, banking or money transmission;
- personalized financial/investment advice;
- buy/sell signals, guaranteed returns, copy trading or managed portfolios;
- third-party marketplace/platform sales;
- physical goods or private consulting services in the Library Pass.

Bitcoin, FX, commodities and securities are educational subjects only.

## Public eligibility evidence

### Business location

Stripe Managed Payments documentation lists **Romania** among supported European business locations.

**Public technical status:** PASS.

This is not account approval. Stripe still verifies business identity, website ownership, bank information, product/category supportability and overall business risk during onboarding.

### Product form

Managed Payments supports digital products sold directly by a business to customers where the business holds the required distribution rights. Stripe describes the product family as including digital content/downloads, software and SaaS.

The Library Pass is sold directly by SC Kela Leads SRL on its own website and is not a platform/marketplace.

**Public technical status:** PASS for product form, subject to product-policy review and an eligible Stripe tax code.

### One-time billing

Managed Payments documentation supports one-time payments through Checkout.

**Public technical status:** PASS.

### Policy ambiguity — blocking

Managed Payments explicitly lists **NFT or cryptocurrency-related products** among prohibited products/businesses.

The Library Pass contains educational Bitcoin curriculum but does not provide a crypto product/service or facilitate a crypto transaction. The public wording is broad enough that USD Impact must obtain an explicit Stripe determination rather than self-classify.

**Product-policy status:** BLOCKED PENDING WRITTEN SUPPORT REVIEW.

Do not activate Managed Payments, create a Live product, configure Production credentials, or implement a Stripe adapter merely because Romania and digital products are generally supported.

## Merchant-of-Record / customer responsibility prefill

Public Managed Payments documentation says Stripe takes on responsibility for:

- global indirect-tax calculation, collection, filing and remittance for Managed Payments transactions;
- fraud prevention;
- dispute response;
- transaction-level customer support;
- order-management tooling through Link;
- transaction-related receipts and subscription emails.

The customer checkout/receipt experience identifies the transaction as sold through Link, and Link provides transaction/order support.

Important residual responsibilities for USD Impact remain:

- product-content and account/access support;
- accurate product classification and disclosures;
- responding to Stripe/Link product-specific questions;
- durable internal purchase/entitlement/audit correlation;
- privacy/support/account-rights obligations retained by USD Impact;
- application-controlled entitlement changes only after verified server events;
- reconciliation/accounting and any local obligations not assumed by the final account terms.

### Refund authority — material contract item

Stripe documents that customers may request refunds through Link support and that Stripe may issue refunds at its discretion within 60 days of the original transaction. Stripe may contact the business for input and notes that failure to respond within 48 hours may result in a refund without business input.

Before selection, USD Impact must reconcile this provider authority with:

- the published 14-day USD Impact refund policy;
- verified refund-event-driven entitlement revocation;
- customer support ownership;
- accounting/tax treatment where Stripe retains/remits tax on a refunded transaction in some jurisdictions.

**Account-specific responsibility status:** PENDING WRITTEN/TERMS REVIEW.

### Managed Payments customer deletion behavior — material integration item

Stripe documents that a Managed Payments/Link customer deletion request can delete transaction-linked Stripe objects and trigger an email notification to the business.

Before implementation, USD Impact must confirm how to retain the minimum legally/operationally required first-party purchase/entitlement/audit records without depending on long-term availability of Stripe customer/payment objects.

**Integration status:** DESIGN REQUIREMENT; NOT A BLOCKER TO POLICY REVIEW, BUT REQUIRED BEFORE SELECTION/ADAPTER COMPLETION.

## Checkout / server-authoritative design

Managed Payments supports Stripe Checkout as hosted or embedded Checkout. It does not support Payment Links or Connect for this use case.

For USD Impact, the safe implementation would require:

1. server creates the Checkout Session;
2. server chooses the approved Library Pass product/price/currency/quantity/account correlation;
3. browser never supplies an authoritative product, trusted price or entitlement claim;
4. success/cancel redirect is UX only;
5. entitlement is granted only after a verified, normalized, deduplicated server-side commercial event;
6. Library Pass remains separate from future Research Membership.

**Public technical status:** PASS / compatible with the existing provider-neutral contract.

## Webhook authenticity

Stripe's official webhook guidance requires signature verification using:

- the **raw, unmodified request body**;
- the `Stripe-Signature` request header;
- the endpoint-specific webhook secret;
- Stripe's signature-construction helper/equivalent verification logic.

Stripe explicitly warns that modifying/parsing the body before verification causes signature verification to fail.

This aligns with the existing USD Impact `webhook.verify-raw-body` contract.

**Public technical status:** PASS.

Implementation remains unauthorized until policy eligibility and provider selection are complete.

## Canonical commercial-event prefill

The following is a technical mapping candidate only. It must be proven against the exact Managed Payments account/API version and sandbox before adapter acceptance.

| USD Impact canonical event | Stripe public event/state candidate | Current technical disposition |
|---|---|---|
| `checkout.pending` | server-created open Checkout Session and/or underlying pending payment state | **PARTIAL** — session creation can create a durable local pending intent, but the exact normalized provider-state contract must be defined and sandbox-proven |
| `payment.completed` | `checkout.session.completed` for completed Checkout; `checkout.session.async_payment_succeeded` for delayed success | **PASS / design-constrained** — fulfillment must verify trusted session/payment state and be idempotent |
| `payment.failed` | `checkout.session.async_payment_failed` for delayed methods; additional synchronous-failure handling must be defined | **PARTIAL** — delayed failure is explicit; canonical coverage for all accepted payment methods must be proven |
| `payment.cancelled` | no dedicated one-time Checkout cancellation webhook identified in the reviewed Managed Payments setup; browser cancel redirect is not authoritative | **BLOCKED / needs authoritative design** |
| `payment.expired` | `checkout.session.expired` | **PASS — public event exists** |
| `refund.completed` | refund object plus `refund.created` / `refund.updated` / `charge.refunded`; normalize only an authoritative successful refund state | **PASS / sandbox semantics required** |
| `dispute.opened` | `charge.dispute.created` | **PASS — public event exists** |
| `chargeback.completed` | `charge.dispute.closed` with closed outcome such as `lost` | **PASS / outcome mapping must be explicit and sandbox-proven** |
| `dispute.reversed` | `charge.dispute.closed` with `won` and/or `charge.dispute.funds_reinstated` where applicable | **PASS / restoration rule must be explicit and sandbox-proven** |

No missing canonical state may be inferred from a browser redirect or email. If Stripe cannot provide an authoritative provider state/API object for a required transition, the adapter must either use a separately reviewed safe equivalent or fail the qualification gate.

## Idempotency / event identity

Stripe Event objects carry provider event identity and webhook delivery can be retried. The future adapter must persist provider event identity plus durable business identifiers and enforce business-state idempotency because:

- duplicate delivery is expected behavior in webhook systems;
- multiple legitimate Stripe events can refer to the same underlying commercial transaction;
- a replay-safe entitlement transition must not depend solely on one event type or browser state.

**Technical status:** STRONG PUBLIC FIT; exact deduplication/retry behavior must be sandbox-proven before acceptance.

## Public-preview risk

Managed Payments is currently documented as **Public preview**.

Before owner selection, capture and accept the operational implications of preview status, including feature/API change risk and any account-specific availability limitations. No customer-facing launch claim should imply a generally available service if the product remains in preview.

**Commercial/operational status:** OWNER REVIEW REQUIRED BEFORE SELECTION.

## Exact written policy question for Stripe Support

Use the following product scope without marketing language or attempts to reclassify the curriculum:

> SC Kela Leads SRL (Romania) operates USD Impact, a first-party digital macro-finance education website. We plan to sell one one-time digital educational Library Pass through our own website. It includes a book/interactive edition, quizzes, reference material, an audiobook and educational videos. The curriculum discusses Bitcoin as one macro/market asset class alongside the U.S. dollar, gold, oil, gas, FX, equities and interest rates. We do not sell, exchange, transfer, custody, stake, mine or facilitate cryptocurrency; we do not operate a wallet/exchange; and we do not provide brokerage, investment management, personalized financial advice, buy/sell signals or guaranteed returns. Managed Payments documentation lists “NFT or cryptocurrency-related products” as prohibited. Based on the scope above, is this first-party educational product eligible for Stripe Managed Payments for our Romanian company? Please provide a written yes/no eligibility determination and identify any content/product conditions that would apply.

If Stripe answers affirmatively, request the same thread also clarify:

1. whether the answer covers the complete disclosed Library Pass including educational Bitcoin chapters/videos;
2. account activation/verification requirements for SC Kela Leads SRL;
3. applicable Managed Payments fees, settlement/payout cadence and reserves/holds if any;
4. refund/dispute/support responsibilities and any conflict with the published 14-day product refund policy;
5. the correct eligible tax code(s) for the actual digital education/content delivery model;
6. whether all canonical commercial states can be authoritatively observed through webhooks/API in the account's enabled payment-method set;
7. Production/public-preview conditions, support/escalation route, secret rotation and rollback expectations.

## Selection gate

Stripe may enter the active provider comparison only after:

- [ ] affirmative written product/company eligibility covering the disclosed educational Bitcoin content;
- [ ] Managed Payments is activatable for SC Kela Leads SRL;
- [ ] eligible product tax-code mapping is confirmed;
- [ ] fees, reserves/holds, payouts and settlement are acceptable;
- [ ] refund/support/privacy/customer-deletion responsibilities are reviewed;
- [ ] authoritative lifecycle mapping closes `payment.cancelled` and complete payment-failure semantics;
- [ ] exact raw-body signature verification is confirmed in sandbox;
- [ ] event/business idempotency and out-of-order behavior are proven;
- [ ] full sandbox purchase/refund/dispute/chargeback/reversal/expiry/forgery/substitution matrix passes;
- [ ] explicit owner approval selects Stripe over any other then-eligible provider.

Until then: **NOT SELECTED / NO ADAPTER / NO SECRETS / NO LIVE OR SANDBOX COMMERCE ACTIVATION.**

## Official sources reviewed — 2026-08-26

- Managed Payments overview: `https://docs.stripe.com/payments/managed-payments`
- How Managed Payments works / eligibility: `https://docs.stripe.com/payments/managed-payments/how-it-works`
- Set up Managed Payments: `https://docs.stripe.com/payments/managed-payments/set-up`
- Managed Payments transaction support/refunds/order management: `https://support.stripe.com/questions/managed-payments-transaction-support-refunds-and-order-management`
- Webhook signature verification: `https://docs.stripe.com/webhooks/signature`
- Webhook endpoint guidance: `https://docs.stripe.com/webhooks`
- Stripe event types: `https://docs.stripe.com/api/events/types`
- Checkout lifecycle/expiration: `https://docs.stripe.com/payments/checkout/how-checkout-works`
- Checkout fulfillment: `https://docs.stripe.com/checkout/fulfillment`
- Restricted/prohibited businesses: `https://stripe.com/legal/restricted-businesses`
- Stripe business-information/supportability requirements: `https://support.stripe.com/questions/business-information-requirements-to-use-stripe`
- Romania Stripe Services Agreement: `https://stripe.com/se/legal/ssa/ro`

## Current decision

**Stripe Managed Payments is technically credible enough to preserve as the strongest policy-review fallback, but it is not an eligible candidate until Stripe gives a written product-specific determination on educational Bitcoin content.** The correct next external action is a Stripe Support policy review, not adapter implementation.
