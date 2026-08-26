# Lemon Squeezy Store Application Packet — 2026-08-25

## Current status — approved 2026-08-26

Lemon Squeezy has issued **affirmative written product/company eligibility approval** for the disclosed USD Impact launch scope.

Timeline:

- application submitted: **2026-08-25**;
- application receipt/review message: **2026-08-25 13:06 UTC**;
- public product/business evidence supplied: **2026-08-25 13:29 UTC**;
- store/dashboard provisioned: **2026-08-25 13:45 UTC**;
- reviewer requested pricing, demo/PDF, social/KYB information and detailed product/fulfillment explanation: **2026-08-26 04:43 UTC**;
- USD Impact supplied the detailed response and PDF evidence pack: **2026-08-26 10:26 UTC**;
- reviewer **Tanay Khemka** confirmed account approval: **2026-08-26 11:03 UTC**.

The approval states that the disclosed products meet Lemon Squeezy's Terms of Service and that the Merchant-of-Record risk profile is low enough to allow USD Impact to sell through Lemon Squeezy.

The reviewer also reiterated two operating boundaries:

1. products must be fully prepared and instantly fulfilled; seller time/customization after purchase is not allowed;
2. test purchases must use **Test Mode** and must **not** use a real card.

## Decision boundary

Approval closes the external **product/company eligibility** gate. It does **not**, by itself:

- select Lemon Squeezy as the final provider;
- authorize adapter registration;
- authorize Production API keys or webhook secrets;
- authorize a Live transaction;
- authorize public checkout activation;
- expand the approved product scope to Research Membership or services.

Current commerce state remains fail-closed:

- `COMMERCE_MODE=disabled`;
- no provider selected;
- no provider adapter registered;
- no public payment entry;
- no browser redirect can grant entitlement.

Lemon Squeezy is now the **preferred candidate**, pending closure of the one-time dispute/chargeback/reversal lifecycle question documented in `docs/operations/lemon-squeezy-technical-qualification-2026-08-26.md` and Issue #53.

## Canonical business identity

| Field | Canonical answer |
| --- | --- |
| Store / brand | USD Impact |
| Legal operator | SC Kela Leads SRL |
| Jurisdiction | Romania |
| CUI | 40790448 |
| Trade Register | J38/820/2020 |
| Founder / authorial lead | Mircea Albulescu |
| Website | https://www.usd-impact.com/ |
| Product page | https://www.usd-impact.com/book/read-the-dollar-first/ |
| About / operator disclosure | https://www.usd-impact.com/about/ |
| Support email | support@usd-impact.com |
| Terms | https://www.usd-impact.com/terms/ |
| Privacy Notice | https://www.usd-impact.com/privacy/ |
| Refund Policy | https://www.usd-impact.com/refund-policy/ |
| Business Instagram | https://www.instagram.com/usdimpact/ |

Sensitive KYC, tax, payout and credential values must remain only in the authenticated provider UI or secret-management systems. Do not commit identity documents, residential addresses, bank details, API keys, webhook secrets or recovery codes.

## Approved disclosed business description

USD Impact is an educational macro-finance publishing platform operated by SC Kela Leads SRL in Romania. It publishes beginner-to-intermediate educational material explaining how the U.S. dollar, interest rates, liquidity and funding conditions interact with major asset classes.

USD Impact is a publisher of educational content, not a regulated financial-services business. It does not provide investment management, brokerage, exchange, custody, lending, personalized investment advice, transaction execution, buy/sell signals, guaranteed returns, copy trading or managed portfolios.

Bitcoin, foreign exchange, commodities and securities are discussed only as educational subjects. USD Impact does not sell, transfer, custody or facilitate cryptocurrency.

## Approved initial product scope

**Read the Dollar First Library Pass** is the only product included in this initial Lemon Squeezy approval record.

It is a standardized, one-time digital macro-finance education product delivered through a verified USD Impact account. It includes:

- the complete Guided Interactive Edition of *Read the Dollar First*;
- chapter-by-chapter learning;
- interactive quizzes and explanations;
- saved progress;
- protected reference resources;
- the complete English audiobook; and
- a 51-film educational video library with English captions.

Access is account-based and ongoing for the purchased edition, subject to the published account/refund policies.

### Explicitly outside the current approval scope

- recurring Research Membership;
- customized research/reports;
- private coaching or consultation;
- private trading groups;
- personalized investment recommendations;
- trading signals or portfolio management;
- brokerage/exchange/custody/lending/payment services;
- physical goods.

Any materially different product category or recurring service should receive its own provider-policy review before being offered through Lemon Squeezy.

## Pricing / billing disclosed to Lemon Squeezy

- **Planned limited-launch price:** USD 39.00, single payment.
- **Planned standard price:** USD 49.00, single payment.
- **No recurring subscription fee** for the Library Pass.
- No public launch window or quantity cutoff is currently active.
- Taxes and supported currency conversion are to be handled/displayed by the approved Merchant of Record at checkout.

## Instant fulfillment contract

The product is fully prepared before purchase and requires no customization or manual order preparation.

Target fulfillment sequence after integration:

1. the authenticated customer creates a trusted USD Impact purchase intent;
2. USD Impact creates a server-authoritative Lemon Squeezy checkout for the approved Library Pass variant;
3. Lemon Squeezy completes payment;
4. USD Impact receives and verifies the signed provider event;
5. product, variant, quantity, amount, currency, account and purchase-intent invariants are validated;
6. exactly one durable Library Pass entitlement is attached automatically to the verified USD Impact account;
7. the customer signs in and accesses the prepared digital library immediately.

No customized report, consultation, coaching, portfolio analysis or manual fulfillment is required.

A browser success redirect, client state, email receipt or self-reported order number is never payment authority.

## Public product evidence supplied to reviewer

1. https://www.usd-impact.com/
2. https://www.usd-impact.com/book/read-the-dollar-first/
3. https://www.usd-impact.com/book/read-the-dollar-first/preview/
4. https://www.usd-impact.com/video-library/
5. https://www.usd-impact.com/audiobook/read-the-dollar-first/
6. https://www.usd-impact.com/about/
7. https://www.usd-impact.com/terms/
8. https://www.usd-impact.com/privacy/
9. https://www.usd-impact.com/refund-policy/
10. https://www.instagram.com/usdimpact/

Reviewer PDF supplied on the thread: `USD_Impact_Lemon_Squeezy_Product_Demo_2026-08-26.pdf`.

## Eligibility evidence

The 2026-08-26 approval email is the authoritative human product/company eligibility record. It confirms:

- account approved;
- disclosed products meet Lemon Squeezy Terms of Service;
- Merchant-of-Record risk profile acceptable for sales through Lemon Squeezy;
- instant digital fulfillment/no customization requirement;
- Test Mode/real-card testing restriction.

Do not reinterpret this approval as permission for undisclosed services or future subscription products.

## Technical qualification status

Passed or materially satisfied from official Lemon Squeezy documentation:

- [x] written product/company eligibility;
- [x] Romanian merchant payout support;
- [x] Merchant-of-Record payment/tax/PCI/refund/chargeback allocation;
- [x] hosted/API-created checkout for a fixed product variant;
- [x] server-authoritative product/price design compatible with USD Impact;
- [x] checkout custom metadata returned in Order webhooks;
- [x] exact raw-body HMAC-SHA256 webhook signature using `X-Signature`;
- [x] webhook retry/resend support;
- [x] Test/Live separation;
- [x] test-card checkout support;
- [x] `order_created` successful-order webhook;
- [x] `order_refunded` full/partial-refund webhook;
- [x] public Order API states for paid/pending/failed/refunded/partial-refund/fraudulent;
- [x] public payout schedule/fee documentation;
- [x] public DPA/privacy materials;
- [x] native affiliate tooling available for a later separate growth release.

Open P0 item:

- [ ] identify and approve the authoritative machine-readable lifecycle path for a one-time purchase **dispute opened / chargeback completed / dispute reversed** state, or explicitly approve a reviewed MoR-managed security-equivalent reconciliation contract if Lemon Squeezy exposes no such signal.

See `docs/operations/lemon-squeezy-technical-qualification-2026-08-26.md` for the detailed engineering matrix and sandbox plan.

## Sensitive/manual onboarding fields

Complete only in Lemon Squeezy's authenticated UI when required:

- registered business street address;
- beneficial-owner/representative identity verification;
- personal address/date of birth/phone if requested for KYC;
- ownership percentages;
- W-8/tax forms and tax identifiers beyond already-public company registration data;
- bank or PayPal payout details;
- provider API keys and webhook signing secrets.

## Current checklist

- [x] public legal operator and founder disclosure exists;
- [x] public product page exists;
- [x] public Terms, Privacy Notice and Refund Policy exist;
- [x] support contact exists;
- [x] public checkout remains fail-closed;
- [x] product described consistently as one-time standardized digital education;
- [x] audiobook and 51-film library included in canonical scope;
- [x] store application submitted;
- [x] reviewer-requested public evidence supplied;
- [x] detailed pricing/product/KYB/fulfillment response supplied;
- [x] demo PDF supplied;
- [x] **affirmative written product/company eligibility approval received**;
- [x] Romania / MoR / checkout / webhook-signature / Test Mode baseline technically qualified;
- [ ] one-time dispute/chargeback/reversal lifecycle contract closed;
- [ ] provider selected explicitly in Issue #53;
- [ ] Lemon Squeezy adapter implemented and tested in Test Mode;
- [ ] accounting/privacy/support release gates closed;
- [ ] separately approved controlled Live proof completed;
- [ ] explicit public launch approval granted.

## Current provider ranking — 2026-08-26

- **Lemon Squeezy:** **WRITTEN ELIGIBILITY APPROVED / PREFERRED CANDIDATE / TECHNICAL QUALIFICATION IN PROGRESS / NOT YET SELECTED**.
- **FastSpring:** **REJECTED / removed** after written product-category rejection.
- **Paddle:** **DECLINED / removed**.
- **PayPro Global:** no qualifying reply; technical gaps remain.
- **Stripe Managed Payments:** fallback only; no qualifying product-specific human eligibility decision.

## Next gate

Obtain the Lemon Squeezy one-time dispute/chargeback/reversal lifecycle clarification. Then Issue #53 may make the explicit provider-selection decision and authorize one coherent Test Mode adapter implementation.

Until then, Production remains unchanged and commerce-disabled.