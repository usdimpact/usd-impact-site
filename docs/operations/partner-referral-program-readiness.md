# USD Impact Partner Program and Member Referral Program Readiness

Status: approved foundation; runtime rewards inactive.

This document defines the provider-neutral operating contract for two separate acquisition programs:

1. **USD Impact Partner Program** — approved publishers, educators, creators, newsletters, communities, and other professional distribution partners that may earn cash commission on eligible purchases.
2. **USD Impact Member Referral Program** — verified USD Impact customers who may refer new customers and receive an approved non-cash benefit or future membership credit once a reward design is activated.

Neither program is currently active. This foundation does not activate checkout, persistent browser tracking, partner payouts, member rewards, public partner enrollment, or access entitlements.

## Product and commerce boundary

The active paid product remains the USD Impact Guided Interactive Edition / Library Pass defined by the application commerce contract.

Attribution data is informational only. It must never:

- grant or restore an entitlement;
- change product, price, quantity, tax, refund, dispute, or payment state;
- substitute for a verified provider event;
- bypass account verification or purchase-intent validation;
- override the canonical commerce lifecycle.

Any future reward requires a verified completed payment and must be reversed or suspended according to refund, dispute, and chargeback state.

## Approved beta commercial design

### Partner Program

- Launch mode: invite/approval only.
- Initial beta cohort: target 10–20 partners.
- Base commission target: **20% of eligible net purchase revenue**.
- Enhanced rate: up to **25%** only for separately approved strategic partners after performance and compliance evidence.
- Attribution target: **60–90 days** if supported by the approved provider/affiliate platform and privacy implementation.
- Reward locking: at least the applicable refund/chargeback protection window; provider rules govern where longer.
- Self-referral: prohibited.
- Double attribution/reward stacking: prohibited.
- Paid trademark/brand search: prohibited unless explicitly approved in writing.
- Coupon/deal/cashback sites: excluded from beta.
- Unauthorized discounts, incentives, bonuses, rebates, or giveaways: prohibited.
- Sub-affiliate networks: require explicit approval.
- Redistribution of paid USD Impact content: prohibited.

The 20% target is an operating recommendation, not a hard-coded payment promise. Final economics must be confirmed against provider fees, taxes, refunds, reserves, settlement, and unit economics before activation.

### Member Referral Program

- Launch mode: inactive until the paid product and customer lifecycle are stable.
- Eligibility: verified existing customer only.
- Reward type at first activation: non-cash benefit or future membership/service credit; no cash payout in the initial design.
- New-customer requirement: referred purchaser must be a genuinely new eligible customer under the final rules.
- Self-referral, duplicate accounts, household/payment-instrument abuse, and circular referrals: prohibited.
- Partner and member-referral rewards cannot stack on the same purchase.
- Reward becomes eligible only after verified payment and the defined lock period.
- Refund, dispute, or chargeback invalidates or suspends the reward according to the final lifecycle policy.

## Attribution contract

Application contract: `apps/web/src/lib/acquisition-attribution.js`.

Supported mutually exclusive channels:

- `partner` with a stable non-personal `partnerId`;
- `member_referral` with a stable non-personal `referralCode`.

The contract intentionally does not store email addresses, names, phone numbers, or payment data in referral identifiers.

Attribution may additionally carry bounded campaign and landing-path fields for reporting. Attribution can be converted into canonical commerce metadata, but the metadata has no price, product, payment, or entitlement authority.

## Persistent attribution is intentionally not active

The readiness release must not introduce cookies, localStorage, sessionStorage, fingerprinting, or another persistent browser identifier merely to retain a partner/referral click.

Before persistent attribution is enabled, the implementation must complete:

1. privacy/ePrivacy review for the selected implementation and target markets;
2. Privacy Notice and cookie/tracking disclosures where required;
3. consent handling where required;
4. retention and deletion rules;
5. attribution-window and last-click/first-click decision;
6. cross-device/account attribution policy;
7. provider/Impact integration proof;
8. anti-fraud controls and test cases.

This preserves the current low-risk telemetry behavior while making the data model ready for later activation.

## Required partner disclosure

Partners must clearly disclose that they may receive compensation when a user purchases through their link. The disclosure must be prominent and proximate to the recommendation/link, adapted to the applicable jurisdiction and medium.

Approved baseline wording:

> I may earn a commission if you purchase USD Impact through this link.

Translations or platform-specific versions must preserve the same meaning and must not hide the commercial relationship behind ambiguous labels.

## Approved positioning

Partner claims must describe USD Impact as educational macro-finance content and tools for learning how the dollar, rates, liquidity, funding, and cross-asset relationships interact.

Partners may accurately describe included product features using the current approved product page and partner creative pack.

## Prohibited claims

Partners and member advocates must not represent USD Impact as:

- investment advice;
- a signal service;
- a prediction or forecasting service;
- a portfolio recommendation;
- a broker, exchange, execution venue, custody service, or crypto product;
- a guaranteed or expected-profit system;
- a way to know when to buy or sell a financial instrument;
- a method that guarantees beating the market or avoiding losses.

Examples of prohibited language include claims such as "know when to buy Bitcoin", "predict gold", "guaranteed profitable trades", "trading signals", or materially equivalent language.

## Partner approval process

Each Partner Program applicant must be reviewed before receiving an active commission arrangement.

Minimum review record:

- legal/business or creator identity as required by the selected affiliate platform;
- primary websites/channels;
- target geography and language;
- audience topic and approximate size;
- proposed promotional methods;
- prohibited-method acknowledgment;
- disclosure acknowledgment;
- claims/compliance acknowledgment;
- payout/KYC/tax onboarding completed by the approved partner platform where applicable;
- approval status, date, reviewer, and any special restrictions.

High-risk applicants should be rejected or require enhanced review, including those focused on high-pressure trading signals, guaranteed returns, misleading crypto promotions, coupon arbitrage, unauthorized paid search, or opaque traffic sources.

## Creative and claim controls

USD Impact should provide a versioned Partner Creative Pack containing:

- approved product description;
- approved short/medium/long promotional copy;
- approved disclosure text;
- current price/offer language with expiry/version control;
- approved logo/brand assets;
- educational deep links by topic;
- prohibited-claims examples;
- compliance note;
- contact path for approval of new claims or creatives.

Partners may create original commentary, but any material product claim outside the approved factual set remains subject to review.

## Recommended acquisition funnel

Preferred flow:

`partner content -> relevant free USD Impact lesson/resource -> account/waitlist/education -> approved checkout -> verified payment -> protected access`

Preferred deep-link destinations include educational material on DXY, broad USD, gold, Bitcoin, oil, gas/LNG, FX, equities, the weekly checklist, and Start Here.

The program should not depend on direct high-pressure checkout links.

## Provider selection requirement

Affiliate/referral capability becomes a scored commerce-provider criterion but is not allowed to weaken the payment/security contract.

For each provider candidate record:

- native or supported affiliate platform;
- invite-only partner controls;
- attribution-window options;
- first-click/last-click behavior;
- SKU/product inclusion/exclusion;
- percentage/fixed and recurring commission support;
- refund/chargeback clawback behavior;
- commission locking period;
- partner KYC/tax/payout responsibility;
- marketplace/discovery controls;
- API/webhook/export/reporting access;
- self-referral and fraud tooling;
- recurring-subscription compatibility for future Research Membership;
- fees charged for affiliate transactions or payouts.

Provider affiliate convenience must never override Merchant-of-Record, webhook authenticity, event lifecycle, privacy, security, refund, dispute, accounting, or operational release gates.

## Measurement model

The acquisition dashboard should eventually measure by partner/referral channel:

- referred visits;
- free-resource conversion;
- account/waitlist conversion;
- checkout starts;
- completed purchases;
- gross revenue;
- refunds and chargebacks;
- locked/approved commission or referral rewards;
- net revenue after channel cost;
- customer engagement and learning completion;
- repeat/recurring revenue once Research Membership exists;
- compliance incidents;
- revenue concentration by partner.

Primary decision metric:

`net contribution after commissions/rewards, provider fees, refunds, and support cost`

Scale only where economics and customer quality are acceptable relative to direct/organic and other acquisition sources.

## Activation gates

### Partner Program Beta may activate only when

- approved payment provider is Live and commerce release gates are green;
- provider/affiliate tracking integration is verified end-to-end;
- attribution/privacy implementation has passed review;
- approved Partner Terms and disclosure requirements are published;
- creative/claims pack is available;
- refund/dispute/chargeback reward reversal has been proven;
- partner approval and suspension process exists;
- reporting reconciles partner attribution to authoritative completed commercial events;
- first beta cohort is manually approved;
- explicit launch approval is recorded.

### Member Referral Program may activate only when

- paid customer lifecycle is stable;
- reward economics and benefit are explicitly approved;
- new-customer/self-referral/fraud rules are implemented and tested;
- referral identifiers are account-bound without exposing personal data;
- reward grant/reversal state is auditable;
- Terms and Privacy disclosures are updated;
- explicit launch approval is recorded.

## Rollback / suspension

Either program must be independently suspendable without disabling customer access or core commerce.

Suspension must stop new reward eligibility while preserving historical attribution, authoritative payment records, refunds/disputes, audit evidence, and already-earned obligations according to the final terms.

A partner must be individually suspendable for compliance, fraud, quality, or contractual reasons without changing unrelated customer entitlements.

## Current decision

Approved now:

- program names and two-channel structure;
- provider-neutral attribution contract;
- non-stacking rule;
- verified-payment reward boundary;
- 20% Partner Program beta target;
- invite-only beta strategy;
- non-cash-first Member Referral strategy;
- compliance/disclosure controls;
- provider-selection scoring criteria;
- readiness and testing work.

Not approved by this document:

- public partner enrollment;
- live tracking persistence;
- any commission payment;
- any member referral reward;
- a specific affiliate platform contract;
- provider activation;
- Production checkout changes.
