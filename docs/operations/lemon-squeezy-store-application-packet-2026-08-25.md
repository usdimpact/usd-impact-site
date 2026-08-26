# Lemon Squeezy Store Application Packet — 2026-08-25

## Current status — approved and selected 2026-08-26

Lemon Squeezy issued **affirmative written product/company eligibility approval** for the disclosed USD Impact launch scope, and USD Impact subsequently selected Lemon Squeezy for the one-time **Read the Dollar First Library Pass** under the reviewed `mor-final-state-reconciliation` lifecycle model.

Timeline:

- application submitted: **2026-08-25**;
- application receipt/review message: **2026-08-25 13:06 UTC**;
- public product/business evidence supplied: **2026-08-25 13:29 UTC**;
- store/dashboard provisioned: **2026-08-25 13:45 UTC**;
- reviewer requested additional pricing, product/demo, social/KYB and fulfillment detail: **2026-08-26 04:43 UTC**;
- USD Impact supplied the detailed response and product evidence: **2026-08-26 10:26 UTC**;
- reviewer **Tanay Khemka** confirmed account approval: **2026-08-26 11:03 UTC**;
- USD Impact later approved Lemon Squeezy as the selected one-time Library Pass provider and approved the security-equivalent Merchant-of-Record reconciliation architecture in Issue #53 / PR #374 governance.

The written approval states that the disclosed products meet Lemon Squeezy's Terms of Service and that the Merchant-of-Record risk profile is low enough to allow USD Impact to sell through Lemon Squeezy.

The reviewer also reiterated two operating boundaries:

1. products must be fully prepared and instantly fulfilled; seller time/customization after purchase is not allowed;
2. test purchases must use **Test Mode** and must **not** use a real card.

## Selection is not activation

The approval and selection do **not** authorize public paid activation.

Current Production boundary remains:

- `COMMERCE_MODE=disabled`;
- `COMMERCE_PROVIDER` unset/null in Production;
- no commerce adapter registered;
- no public payment entry;
- no Production payment API key or webhook secret;
- no Live provider transaction;
- no real-card testing;
- no browser redirect can grant entitlement.

Draft PR #374 contains credential-independent sandbox implementation code. Its database migration is code-only until separately authorized for canonical Development.

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

**Read the Dollar First Library Pass** is the only product included in this initial selected-provider record.

It is a standardized, one-time digital macro-finance education product delivered through a verified USD Impact account. It includes:

- the complete Guided Interactive Edition of *Read the Dollar First*;
- chapter-by-chapter learning;
- interactive quizzes and explanations;
- saved progress;
- protected reference resources;
- the complete English audiobook; and
- a 51-film educational video library with English captions.

Access is account-based and ongoing for the purchased edition, subject to the published account/refund policies.

### Explicitly outside the current provider scope

- recurring Research Membership;
- customized research/reports;
- private coaching or consultation;
- private trading groups;
- personalized investment recommendations;
- trading signals or portfolio management;
- brokerage/exchange/custody/lending/payment services;
- physical goods.

Any materially different product category or recurring service requires its own provider-policy and release review.

## Pricing / billing disclosed

- **Limited-launch base price:** USD 39.00, single payment.
- **Standard base price:** USD 49.00, single payment.
- **No recurring subscription fee** for the Library Pass.
- Two distinct fixed-price Lemon Squeezy Test Mode Variants are required so the server, not the browser, selects the applicable trusted price tier.
- `custom_price` is not used.
- quantity is exactly one and authoritative Order Items must contain exactly one item.
- authoritative Order `subtotal` must match the trusted purchase-intent base price;
- discounts are disabled and a non-zero authoritative `discount_total` fails closed;
- Lemon Squeezy's final Order `total` is retained separately as the Merchant-of-Record charged total and may include tax.

## Instant fulfillment contract

The product is fully prepared before purchase and requires no customization or manual order preparation.

Target fulfillment sequence after sandbox approval:

1. the authenticated customer creates a trusted USD Impact purchase intent;
2. USD Impact creates a server-authoritative Lemon Squeezy checkout for the trusted fixed-price Variant;
3. Lemon Squeezy completes payment;
4. USD Impact verifies the exact raw-body signed webhook;
5. USD Impact re-reads the current authoritative Order and Order Items;
6. Store/Product/Variant/item-count/quantity/subtotal/discount/currency/account/purchase-intent invariants are validated;
7. exactly one durable Library Pass entitlement is attached only when authoritative state is compatible with `paid`;
8. the customer can then access the prepared digital library.

A browser success redirect, client state, email receipt or self-reported order number is never payment authority.

## Merchant-of-Record lifecycle decision

Lemon Squeezy's documented single-payment webhooks do not expose deterministic one-time dispute-opened, chargeback-completed or dispute-reversed events. USD Impact therefore approved the provider-neutral `mor-final-state-reconciliation` profile rather than inventing events.

Current policy:

- signed `order_created` + current authoritative `paid` state can complete payment;
- full `refunded` revokes access idempotently;
- `fraudulent` revokes through canonical `payment.revoked`;
- `pending` / `failed` never grant;
- Library Pass refunds are full-refund only; unexpected `partial_refund` is review-required and does not automatically mutate entitlement;
- no synthetic chargeback or reversal event is created;
- a terminal local state is not automatically restored merely because a later provider read says `paid`.

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

A bounded product/demo evidence pack was also supplied in the provider review thread. Private message identifiers and sensitive attachments are not committed to GitHub.

## Current checklist

- [x] public legal operator and founder disclosure exists;
- [x] public product page exists;
- [x] public Terms, Privacy Notice and Refund Policy exist;
- [x] support contact is `support@usd-impact.com`;
- [x] public checkout remains fail-closed;
- [x] product described consistently as one-time standardized digital education;
- [x] audiobook and 51-film library included in canonical scope;
- [x] store application submitted;
- [x] requested public/product evidence supplied;
- [x] detailed pricing/product/KYB/fulfillment response supplied;
- [x] **affirmative written product/company eligibility approval received**;
- [x] Lemon Squeezy explicitly selected for the one-time Library Pass;
- [x] Merchant-of-Record final-state reconciliation architecture approved;
- [x] credential-independent Draft adapter/runtime/persistence implementation added to PR #374;
- [ ] Development reconciliation migration reviewed and separately authorized/applied;
- [ ] Lemon Squeezy Test Mode Store/Product/two fixed-price Variants and non-Production credentials configured;
- [ ] full sandbox matrix completed and reviewed;
- [ ] Development database/advisor evidence green;
- [ ] adapter registration explicitly approved;
- [ ] controlled release / integrated rehearsal / independent security gates completed;
- [ ] explicit public launch approval granted.

## Current provider ranking — 2026-08-26

- **Lemon Squeezy:** **APPROVED / SELECTED FOR ONE-TIME LIBRARY PASS / SANDBOX IMPLEMENTATION DRAFT / NOT LIVE**.
- **FastSpring:** **REJECTED / removed** after written product-category rejection.
- **Paddle:** **DECLINED / removed**.
- **PayPro Global:** **NOT SELECTED**; no qualifying reply before selection.
- **Stripe Managed Payments:** **FALLBACK ONLY / NOT SELECTED**.

Production remains unchanged and commerce-disabled until later explicit release approval.
