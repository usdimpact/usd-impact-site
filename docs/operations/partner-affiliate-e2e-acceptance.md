# Partner Program — Lemon Squeezy Affiliate E2E Acceptance Plan

Status: internal pre-activation test plan. No provider configuration or Production activation is authorized.

Version: 0.1

Related governance:
- `docs/operations/partner-referral-program-readiness.md`
- Draft PR #729 — Partner Program Terms
- Draft PR #730 — affiliate tracking privacy/ePrivacy gate
- issue #234 — Partner Program + Member Referral activation

Provider: Lemon Squeezy.

## 1. Objective

Prove, in a permitted non-Production or controlled test environment, that provider-backed affiliate attribution can operate without changing USD Impact's commerce, entitlement, privacy, or customer-safety boundaries.

The acceptance chain is:

`approved affiliate -> referral link -> permitted tracking -> eligible checkout -> verified order -> provider affiliate attribution -> commission/referral record -> refund/reversal behavior -> entitlement remains governed only by canonical commerce state`

No test is accepted if attribution metadata can independently grant, extend, revoke, or otherwise modify entitlement.

## 2. Current provider evidence

Current Lemon Squeezy API documentation exposes:

- `affiliate_id` on Order objects;
- `referral_amount` on Order objects;
- `affiliate_id` on Subscription Invoice objects;
- `referral_amount` on Subscription Invoice objects;
- Affiliate API endpoints;
- `affiliate_activated` webhook event;
- refund/payment lifecycle events through the standard order/subscription-invoice webhook model.

Order and Subscription Invoice objects also expose `test_mode`, allowing test-origin evidence to be distinguished from live objects.

Provider references:
- https://docs.lemonsqueezy.com/api/getting-started/changelog
- https://docs.lemonsqueezy.com/api/orders/the-order-object
- https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
- https://docs.lemonsqueezy.com/help/webhooks/event-types
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks

These references must be rechecked immediately before execution because provider behavior may change.

## 3. Preconditions

Before executing any E2E affiliate test:

- [ ] Library Pass checkout lifecycle is healthy.
- [ ] affiliate feature/config gate exists and defaults OFF.
- [ ] Draft Partner Terms have completed legal/provider review.
- [ ] privacy/ePrivacy implementation decision is approved.
- [ ] exact affiliate tracking persistence behavior has been observed and documented.
- [ ] Privacy Notice / consent UI changes, if required, are separately reviewed.
- [ ] provider test-mode or equivalent controlled test path is confirmed.
- [ ] one dedicated QA affiliate identity is approved for testing.
- [ ] one dedicated QA buyer account/payment path is approved.
- [ ] no real customer account is used.
- [ ] no Production affiliate payout is possible from the test.
- [ ] rollback procedure is documented.

Missing or ambiguous preconditions fail closed.

## 4. Evidence packet required per test

Record:

- test ID;
- date/time;
- environment;
- USD Impact commit SHA;
- deployment ID;
- provider Store/Product/Variant IDs used;
- affiliate/provider ID;
- referral code/link identifier;
- consent state;
- browser profile;
- provider order ID;
- provider customer ID;
- `affiliate_id`;
- `referral_amount`;
- `test_mode`;
- webhook event IDs and event names;
- USD Impact purchase/entitlement IDs, if created in the permitted test system;
- before/after entitlement state;
- refund/reversal state;
- expected result;
- actual result;
- PASS/FAIL/UNKNOWN;
- screenshots/log excerpts or API evidence references.

Do not copy complete payment data, secrets, authentication links, or unnecessary personal data into the packet.

## 5. Core attribution tests

### AFF-01 — approved affiliate activation

Action:
- activate only the dedicated QA affiliate in the permitted provider test path.

Expected:
- provider reports the affiliate as active;
- if webhook delivery is supported for the test environment, `affiliate_activated` is emitted exactly once per activation event;
- no USD Impact customer entitlement or purchase is created merely by affiliate activation.

PASS requires:
- affiliate identity can be reconciled to provider data;
- no commerce state mutation occurs.

### AFF-02 — valid referral click / attribution

Action:
- use the approved QA affiliate link through the permitted consent/tracking path.

Expected:
- provider attribution identifier is created only when permitted by the approved privacy implementation;
- affiliate identity is recoverable through the documented provider mechanism;
- no checkout price changes;
- no entitlement is created.

PASS requires:
- provider attribution is present;
- USD Impact commerce state remains unchanged before purchase.

### AFF-03 — eligible one-time Library Pass purchase

Action:
- complete one approved test purchase for the eligible Library Pass product.

Expected provider evidence:
- Order object has the expected product/variant;
- `affiliate_id` equals the QA affiliate;
- `referral_amount` equals the expected provider-calculated commission;
- `test_mode` reflects the intended test environment;
- canonical order webhook is received and verified.

Expected USD Impact evidence:
- purchase/entitlement follows the ordinary verified commerce lifecycle;
- attribution metadata is informational only;
- exactly one valid entitlement is created for the eligible purchase.

PASS requires both provider and application evidence to reconcile.

### AFF-04 — non-affiliate control purchase

Action:
- complete the same eligible purchase without an affiliate referral.

Expected:
- `affiliate_id = null`;
- `referral_amount = null`;
- ordinary purchase/entitlement behavior is otherwise identical.

This proves affiliate state is not accidentally injected globally.

## 6. Product eligibility tests

### AFF-05 — excluded product

Action:
- attempt an affiliate-referred purchase of a product excluded from the beta.

Expected:
- no eligible affiliate commission/referral amount for the excluded product;
- purchase remains valid if independently purchasable;
- entitlement follows ordinary product rules.

FAIL if exclusion can be bypassed through URL parameters or stale attribution.

### AFF-06 — Research Membership excluded

Action:
- where a safe test representation exists, verify Research Membership is not affiliate-eligible.

Expected:
- no Partner Program commission;
- no Member Referral logic is invoked;
- no discount or free-month reward is created.

Research Membership remains separately gated under #122.

## 7. Commission-rate tests

### AFF-07 — standard opening rate

Expected:
- provider commission matches the approved active Offer Card rate;
- current policy opening rate remains 15% unless a later approved Offer Card says otherwise.

### AFF-08 — reviewed higher-rate affiliate

Expected:
- provider-specific override can represent an approved 20% or 25% test rate;
- only the targeted affiliate receives the override;
- unrelated affiliates remain unchanged.

### AFF-09 — 30% ceiling guardrail

Expected:
- no routine/default path configures >30%;
- 30% requires explicit exceptional approval;
- test documentation treats 30% as a ceiling, not a default.

Do not configure a live 30% affiliate merely to prove this rule if provider settings can be validated without Production activation.

## 8. Refund and reversal tests

### AFF-10 — full refund before commission lock/payout

Action:
- refund the QA affiliate order through the permitted provider test flow.

Expected:
- provider order reflects refunded state;
- referral/commission becomes rejected, reversed, reduced, or otherwise non-payable according to provider rules;
- USD Impact entitlement changes only because of the verified refund lifecycle, not because affiliate state changed.

PASS requires entitlement and affiliate reversal to be independently attributable to their authoritative events.

### AFF-11 — partial refund

If Lemon Squeezy supports the test case:

Expected:
- `referral_amount` / payable commission adjusts according to provider behavior;
- purchase/entitlement policy follows the existing partial-refund commerce contract;
- no duplicate commission remains.

If provider behavior cannot be tested safely, mark UNKNOWN rather than assuming proportional reversal.

### AFF-12 — dispute / chargeback

If a controlled test path exists:

Expected:
- referral/commission is suspended or reversed under provider rules;
- entitlement follows the verified dispute/chargeback commerce lifecycle;
- no affiliate record can restore access.

If test-mode cannot simulate this faithfully, preserve as a mandatory Production-readiness UNKNOWN requiring provider evidence or documented limitation.

## 9. Fraud and abuse tests

### AFF-13 — self-referral

Action:
- QA affiliate attempts to be the purchaser using the same controlled identity where provider/test rules allow.

Expected:
- referral is rejected, non-payable, or flagged according to approved anti-abuse handling;
- no Partner Program reward is created;
- legitimate purchase entitlement, if the purchase is otherwise valid, remains governed separately.

### AFF-14 — duplicate referral / repeated checkout

Expected:
- one valid purchase cannot produce multiple commission records;
- repeated webhook delivery remains idempotent;
- duplicate URL visits do not create duplicate payable referrals.

### AFF-15 — circular referral

Where two QA identities can be used safely:

Expected:
- circular behavior is rejected or held for manual review;
- no compounded commission/reward state is created.

### AFF-16 — unauthorized discount stacking

Action:
- attempt referral attribution alongside an unrelated customer discount mechanism.

Expected:
- existing non-stacking policy holds;
- no Partner Program commission is created where the approved policy forbids stacking;
- no hidden price mutation occurs.

## 10. Attribution-window tests

### AFF-17 — within approved window

Expected:
- referral remains attributable within the provider-configured approved window.

### AFF-18 — after window expiry

Expected:
- stale attribution no longer creates an eligible affiliate referral.

Because current Lemon Squeezy documentation is inconsistent about the persistence mechanism, window testing must observe actual browser/network/storage behavior rather than relying on a claimed cookie implementation.

## 11. Consent / privacy tests

These tests are governed by Draft PR #730.

### AFF-19 — no decision yet

Expected:
- no non-essential affiliate tracking request/storage occurs before valid consent where consent is required.

### AFF-20 — explicit reject

Expected:
- no affiliate tracking identifier is created;
- public content and checkout remain usable.

### AFF-21 — explicit accept

Expected:
- affiliate attribution can operate within the approved scope.

### AFF-22 — accept then withdraw

Expected:
- future affiliate tracking stops;
- optional storage is removed or disabled where technically possible;
- historical order/refund/audit records that must remain are preserved;
- account/access behavior is unaffected.

## 12. Webhook and API reconciliation tests

### AFF-23 — order webhook/API agreement

Expected:
- provider webhook Order object and later API retrieval agree on:
  - order ID;
  - affiliate ID;
  - referral amount;
  - refunded status;
  - test-mode status.

### AFF-24 — replayed webhook

Expected:
- replay/retry of an already processed provider event does not create duplicate purchase, entitlement, or commission/reconciliation records.

### AFF-25 — out-of-order event

Expected:
- later/earlier provider events cannot corrupt canonical purchase or entitlement state;
- affiliate reporting remains reconcilable;
- ambiguous order fails closed for reward eligibility.

### AFF-26 — invalid webhook signature

Expected:
- rejected;
- no purchase, entitlement, or affiliate/reconciliation mutation occurs.

## 13. Entitlement isolation tests

### AFF-27 — attribution-only event

Expected:
- zero entitlement change.

### AFF-28 — affiliate activation/deactivation

Expected:
- zero customer entitlement change.

### AFF-29 — referral approval/rejection

Expected:
- zero customer entitlement change.

### AFF-30 — payout creation/completion

Expected:
- zero customer entitlement change.

The only events allowed to change customer access are the existing verified commerce/entitlement lifecycle events.

## 14. Suspension / rollback tests

### AFF-31 — suspend individual affiliate

Expected:
- new eligible referrals stop for that affiliate;
- historical records remain;
- unrelated affiliates and customers remain unaffected;
- customer access is unchanged.

### AFF-32 — disable Partner Program globally

Expected:
- new affiliate tracking/eligibility stops;
- core checkout continues if separately active;
- existing Library Pass access continues;
- historical attribution/reconciliation evidence remains available;
- no customer entitlement is revoked merely because the Partner Program is disabled.

## 15. Reporting reconciliation

For each accepted referral, prove the following can be reconciled:

`provider affiliate -> provider order/invoice -> affiliate_id -> referral_amount -> USD Impact authoritative purchase -> entitlement lifecycle -> refund/dispute state`

Required rule:
- provider affiliate records may explain acquisition economics;
- they may not become the source of truth for access.

## 16. Pass criteria

The Partner Program provider integration may be considered technically ready only when:

- all mandatory AFF tests are PASS;
- any provider-limited tests are explicitly UNKNOWN with documented mitigation;
- no P0/P1 privacy, commerce, entitlement, or fraud failure remains;
- exact provider tracking/storage behavior is documented;
- reconciliation is deterministic;
- rollback is proven;
- no customer state depends on affiliate data;
- legal/privacy review is complete;
- owner activation approval is separately recorded.

## 17. Stop boundary

This plan does not authorize:
- creating or activating a live affiliate;
- changing Lemon Squeezy affiliate settings;
- installing `affiliate.js`;
- adding cookies/storage;
- changing consent UI;
- changing Privacy Notice;
- issuing commission;
- paying an affiliate;
- enabling public enrollment;
- adding Research Membership eligibility;
- changing checkout;
- changing customer, purchase, subscription, or entitlement state.

Current status:

`TEST PLAN READY / EXECUTION NOT AUTHORIZED / PARTNER PROGRAM REMAINS DISABLED`
