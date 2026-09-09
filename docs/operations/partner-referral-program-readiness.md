# USD Impact Partner Program and Member Referral Program Readiness

Status: approved provider-neutral foundation; runtime rewards and discounts inactive.

This document defines the provider-neutral operating contract for two separate acquisition programs:

1. **USD Impact Partner Program** — approved publishers, educators, creators, newsletters, communities, and other professional distribution partners that may earn cash commission on eligible purchases.
2. **USD Impact Member Referral Program** — verified USD Impact customers who may refer new customers and receive an approved non-cash benefit or future membership credit once a reward design is activated.

Neither program is currently active. This foundation does not activate checkout, persistent browser tracking, partner payouts, member rewards, public partner enrollment, or access entitlements.

## Product and commerce boundary

The active paid product remains the USD Impact Guided Interactive Edition / Library Pass defined by the application commerce contract. Research Membership and its member-invitation exception remain separately gated under issue #122.

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
- Standard starting rate: **15%** of the final defined eligible commission base.
- Earned reviewed rates: **20%** and **25%** after retained-sales, compliance, refund, and contribution evidence.
- Exceptional strategic maximum: **30%**. Thirty percent is a ceiling, not a default offer.
- Initial eligible product: full-price Library Pass purchases only.
- Attribution target: **60–90 days** if supported by the approved provider/affiliate platform and privacy implementation.
- Reward locking: at least the applicable refund/chargeback protection window; provider rules govern where longer.
- Self-referral: prohibited.
- Double attribution/reward stacking: prohibited.
- Paid trademark/brand search: prohibited unless explicitly approved in writing.
- Coupon/deal/cashback sites: excluded from beta.
- Unauthorized discounts, incentives, bonuses, rebates, or giveaways: prohibited.
- Sub-affiliate networks: require explicit approval.
- Redistribution of paid USD Impact content: prohibited.

The tier schedule is an approved planning direction, not a hard-coded payment promise. Final economics and competitor terms must be refreshed against provider fees, taxes, refunds, reserves, settlement, support, and unit economics before activation or any issued rate.

### Member Referral Program

- Launch mode: inactive until Research Membership and its paid customer lifecycle are stable and the separate referral gates pass.
- Referrer eligibility: a verified existing Research member with a valid paid or legitimately earned/granted entitlement; staff, internal test, and QA accounts do not qualify.
- New-client benefit: **50% off the first annual Research Membership term only**. At the USD 290 ordinary annual reference, the new client pays USD 145 before applicable tax. Later terms use the ordinary price disclosed before checkout.
- Referring-member benefit: free Research access only; no annual discount, cash payout, rebate, gift card, or transferable value.
- Cumulative milestones: 1 / 3 / 5 distinct qualifying paid referrals earn 3 / 6 / 12 Research months total. Incremental grants are 3 / 3 / 6 months, capped at 12 months per referring account in the pilot.
- Intended same-event benefits: the qualifying discounted annual purchase both gives the new client the authorized first-term discount and advances the referring member's free-month count. This is one customer-referral program event, not affiliate/reward stacking.
- New-customer requirement: the referred purchaser must be a genuinely new eligible Research customer under the final rules.
- Self-referral, duplicate accounts, household/payment-instrument abuse, and circular referrals: prohibited.
- Affiliate commission cannot stack with either customer-program benefit on the same purchase. No other checkout discount may stack with the 50% member-invitation price.
- Reward becomes eligible only after verified payment and the defined lock period.
- Refund, dispute, or chargeback invalidates or suspends the reward according to the final lifecycle policy.
- A buyer may count once per referrer. Duplicate, out-of-order, self-referral, and circular-referral events must fail closed and be processed idempotently.
- Earned months must extend or defer valid access without charging during the rewarded interval or automatically enrolling an earned/granted member in a paid plan.

The inactive policy contract is defined in `apps/web/src/lib/member-referral-policy.js`. It has no runtime, price, payment, or entitlement authority and is not imported by checkout, provider, account, email, or entitlement paths.

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

- Research Membership has completed its own provider, stability, preflight, and explicit Production activation gates under issue #122;
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
- 15% Partner Program starting rate, earned 20%/25% tiers, and exceptional 30% ceiling;
- invite-only beta strategy;
- 50% first-annual-term benefit for the new Research client and cumulative 3/6/12 free-month benefit for the referring member;
- compliance/disclosure controls;
- provider-selection scoring criteria;
- readiness and testing work.

Not approved by this document:

- public partner enrollment;
- live tracking persistence;
- any commission payment;
- any member referral reward;
- any member-invitation checkout discount;
- a specific affiliate platform contract;
- provider activation;
- Production checkout changes.
