# Lemon Squeezy Store Application Packet — 2026-08-25

## Purpose and boundary

This packet prepares a consistent, evidence-backed store-activation application for Lemon Squeezy. It does **not** constitute provider selection, approval, acceptance of provider terms, KYB completion, API integration, Live activation, or authorization to open public checkout.

Current USD Impact commerce state remains provider-neutral and fail-closed:

- `COMMERCE_MODE=disabled`;
- no provider selected;
- no provider adapter registered;
- no public payment entry;
- no browser redirect can grant entitlement.

Lemon Squeezy's current documentation says every store is reviewed through a business/customer questionnaire and identity verification before Live mode. It says most fulfillable digital goods such as ebooks, PDFs, audio and video are generally eligible, with premium courses and membership sites typically allowed, subject to its Terms and prohibited-product rules. Its Terms prohibit regulated financial services including banking/financing and currency exchange. USD Impact must therefore describe the product precisely as digital education and allow Lemon Squeezy to make the classification decision.

Official references reviewed for this packet:

- Store activation: https://docs.lemonsqueezy.com/help/getting-started/activate-your-store
- Getting started / Test mode: https://docs.lemonsqueezy.com/guides/getting-started
- Merchant of Record: https://docs.lemonsqueezy.com/help/payments/merchant-of-record
- Terms / prohibited products: https://www.lemonsqueezy.com/terms

## Canonical business identity

Use these values consistently where the provider asks for public/business identity fields:

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

Do **not** place beneficial-owner ID documents, home/registered street address, date of birth, personal phone number, bank/payout details, identity-document numbers, or provider credentials in GitHub. Enter those directly in the authenticated provider UI only when required.

## Ready-to-paste business description

> USD Impact is an educational macro-finance publishing platform operated by SC Kela Leads SRL in Romania. We publish beginner-to-intermediate educational material explaining how the U.S. dollar, interest rates, liquidity and funding conditions interact with major asset classes. Our initial paid product is a one-time digital learning library called Read the Dollar First Library Pass. The product is educational only and does not provide investment management, brokerage, exchange, custody, lending, personalized investment advice, buy/sell signals, guaranteed returns, copy trading or managed portfolios.

## Ready-to-paste product description

> Read the Dollar First Library Pass is a one-time digital macro-finance education product delivered through a verified USD Impact account. It includes the complete Guided Interactive Edition of Read the Dollar First, chapter-by-chapter learning, quizzes and saved progress, protected reference resources, the complete English audiobook, and a 51-film educational video library with English captions. Access is account-based and permanent for the purchased edition, subject to the published refund and account policies. It is not a subscription and the recurring Research Membership is not part of this launch.

## Ready-to-paste “what customers receive” answer

> Customers receive secure account access to a digital educational library: the Guided Interactive Edition, quizzes and progress tracking, reference resources, an English audiobook, and 51 educational videos. Delivery is digital through the authenticated USD Impact website. We do not ship physical goods, provide private coaching, operate a private trading group, or provide managed financial services.

## Ready-to-paste financial-services clarification

> USD Impact is a publisher of educational content, not a regulated financial-services business. We do not hold or transmit customer funds other than receiving settlement from the approved payment provider for our digital product. We do not offer banking, financing, lending, mortgages, currency exchange, brokerage, custody, wallets, investment management or crypto transaction services. Bitcoin, foreign exchange, commodities and securities are discussed only as educational subjects. We do not execute transactions or provide personalized investment recommendations or trading signals.

## Ready-to-paste pricing / billing answer

> The initial product is a single-payment purchase, not a subscription. Planned pricing is USD 39 for an approved limited launch offer and USD 49 standard. No public launch window or quantity cutoff is active yet. Any launch offer will be enabled only after provider approval, integration testing and final release approval. Taxes and supported currency conversion should be handled and displayed by the approved Merchant of Record at checkout.

## Ready-to-paste fulfillment answer

> Fulfillment is digital and account-based. USD Impact creates durable paid entitlement only after a server-verified, signed and deduplicated completed-payment event from the selected provider. A browser success redirect is never treated as proof of payment. Protected media is not exposed through public file URLs. If payment is refunded, disputed, charged back or reversed, access transitions follow the verified commercial event and the published policy.

## Ready-to-paste customer support / refund answer

> Customer support is available at support@usd-impact.com. USD Impact publishes a 14-day Refund Policy, Terms & Conditions and Privacy Notice on the public website. Before Live activation, we will reconcile the final refund, dispute and buyer-support responsibilities with the selected Merchant of Record so that customer-facing wording matches the provider's actual transaction process.

## Audience answer — use without overclaiming

> The product is designed for new and intermediate investors, market observers, client-facing market educators and sales teams who want a structured macro framework. It is education, not individualized financial advice or a signal service.

If the application asks for exact customer geography, current revenue, customer count, expected monthly volume, average order volume, historical sales, traffic, or conversion rate, provide the **actual current figure directly in the provider application**. Do not invent a number and do not use an unverified estimate from repository history. USD Impact intentionally does not use revenue/customer-count claims as public social proof.

## Intellectual-property answer

> The Library Pass consists of USD Impact / Read the Dollar First educational content published by SC Kela Leads SRL. The store application should be submitted only for content the company has the right to sell and distribute. Third-party market data, citations or educational references are not sold as standalone licensed datasets.

If Lemon Squeezy asks for proof of rights beyond this statement, provide the applicable first-party publication/source evidence directly to the reviewer rather than adding private documents to GitHub.

## Provider-review URLs

Give the reviewer these public pages so the classification can be based on the actual product and policies:

1. https://www.usd-impact.com/book/read-the-dollar-first/
2. https://www.usd-impact.com/about/
3. https://www.usd-impact.com/terms/
4. https://www.usd-impact.com/privacy/
5. https://www.usd-impact.com/refund-policy/
6. https://www.usd-impact.com/checkout/ — intentionally closed until a provider is approved and integrated.

## Sensitive/manual fields — never commit values

Complete these only inside Lemon Squeezy's authenticated application/KYB flow:

- registered business street address;
- beneficial-owner / representative date of birth;
- personal residential address if requested for KYC;
- government ID or identity-verification upload;
- personal phone number;
- ownership percentages if requested;
- bank, PayPal or payout details;
- tax or VAT documents beyond the already public CUI where requested;
- provider credentials, API keys, webhook secrets or recovery codes.

## Pre-submit checklist

Before the owner submits the store application:

- [x] public legal operator and founder disclosure exists;
- [x] public product page exists;
- [x] public Terms, Privacy Notice and Refund Policy exist;
- [x] support contact is `support@usd-impact.com`;
- [x] public checkout is fail-closed and accepts no payment;
- [x] product is described as one-time digital education, not a financial service;
- [x] audiobook and 51-film library are part of the canonical Library Pass scope;
- [ ] owner creates/signs into Lemon Squeezy account and store;
- [ ] owner reviews and accepts any provider terms presented in the authenticated UI;
- [ ] owner enters sensitive KYB/KYC data directly in Lemon Squeezy;
- [ ] owner submits the store-activation questionnaire and identity verification;
- [ ] written approval or rejection is captured in issue #53 before any adapter work starts.

## Post-submission rule

Submission is only an **eligibility review**. It does not authorize engineering integration.

After a response:

### If approved

Record the written approval in issue #53 and verify, before selecting Lemon Squeezy:

1. Romanian-company settlement/onboarding requirements;
2. Merchant-of-Record tax, refund, chargeback and buyer-support allocation;
3. fees, reserves and payout schedule;
4. server-created checkout/product/price controls;
5. raw-body webhook signature algorithm and retry behavior;
6. event coverage for pending/completed/failed/cancelled/expired/refund/dispute/chargeback/reversal;
7. sandbox/test-mode behavior;
8. privacy/DPA/subprocessor/export obligations;
9. Live review, secret rotation, incident and rollback paths.

Only then may issue #53 select exactly one provider and authorize one coherent adapter implementation.

### If rejected or materially restricted

Do not attempt to reclassify the product or weaken the educational/compliance description to obtain approval. Record the stated reason, preserve checkout-disabled state, and continue the FastSpring/PayPro/other approved-provider path.

## Current provider ranking boundary

- **FastSpring:** primary candidate; active Sales case #01856172 awaiting written eligibility response after the 2026-08-24 follow-up.
- **Lemon Squeezy:** actionable fallback; provider has explicitly requested a store application, and current public policy appears compatible enough to justify formal review, but approval is not established.
- **PayPro Global:** parallel candidate; no reply after the existing follow-up.
- **Paddle:** declined and removed from the active release path.

No provider is selected by this packet.
