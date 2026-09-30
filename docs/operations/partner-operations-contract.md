# Partner Program Operations Contract — Application, Review, and Reconciliation

Status: internal implementation contract. Documentation only. Not an activation approval.

Version: 0.1
Reconciled: 2026-09-30

Authority:
- `docs/operations/partner-referral-program-readiness.md`
- `docs/operations/partner-program-terms-draft.md`
- `docs/operations/partner-affiliate-tracking-privacy-gate.md`
- `docs/operations/partner-affiliate-e2e-acceptance.md`
- `docs/operations/partner-creative-pack.md`
- `docs/operations/partner-recruitment-onboarding-playbook.md`

This contract defines the minimum provider-neutral records and review states needed for a future invite-only Partner Program. It does not create database tables, public enrollment, admin UI, affiliate tracking, commissions, payouts, customer discounts, Member Referral rewards, or provider configuration.

## 1. Design principles

- Invite/approval based; no open public enrollment by default.
- Fail closed when required partner, compliance, provider, attribution, or reconciliation evidence is missing.
- Provider-backed affiliate attribution remains authoritative for provider-managed referral state.
- USD Impact commerce and entitlement records remain authoritative for customer access.
- Attribution metadata may never grant, extend, revoke, or restore entitlement.
- Do not create a custom affiliate balance or payout ledger unless a separate architecture review explicitly approves it.
- Store the minimum partner data necessary for review, compliance, reconciliation, and audit.
- Do not store payment-card data, provider secrets, tax documents, passwords, authentication links, or customer learning data in Partner Program records.

## 2. Partner application record

Internal logical record name:

`partner_application`

Minimum fields:

| Field | Required | Purpose |
| --- | --- | --- |
| application_id | Yes | Immutable internal identifier |
| submitted_at | Yes | Intake timestamp |
| status | Yes | Current review state |
| partner_type | Yes | Creator / publisher / newsletter / organization / educator / other approved class |
| display_name | Yes | Human-readable partner or organization name |
| legal_or_business_name | Conditional | Required when commercial/legal onboarding needs it |
| primary_contact_name | Yes | Review contact |
| primary_contact_email | Yes | Purpose-specific contact |
| website_or_primary_channel | Yes | Primary public evidence source |
| additional_channels | No | Other declared promotional channels |
| primary_audience | Yes | Concise audience description |
| audience_geographies | No | Declared audience markets |
| languages | Yes | Approved working/publishing language(s) |
| proposed_promotion_methods | Yes | Newsletter/video/podcast/resource page/etc. |
| paid_search_intent | Yes | Declared yes/no |
| coupon_or_cashback_model | Yes | Declared yes/no |
| sub_affiliate_use | Yes | Declared yes/no |
| prior_finance_promotions | No | Relevant disclosure/compliance context |
| disclosure_practice | Yes | How commercial relationships are disclosed |
| self_referral_acknowledgment | Yes | Explicit acknowledgment |
| terms_version | Conditional | Populated only when Terms are accepted |
| terms_accepted_at | Conditional | Acceptance evidence timestamp |
| provider_affiliate_id | Conditional | Added only after approved provider onboarding |
| offer_card_id | Conditional | Active approved commercial card |
| reviewer_id | Yes | Internal reviewer reference |
| review_notes | Yes | Factual rationale, not unsupported scoring claims |
| created_at | Yes | Record creation |
| updated_at | Yes | Last material update |

Do not collect:
- government identity documents directly when the provider can own KYC;
- tax forms directly when the provider can own tax onboarding;
- customer lists;
- unrelated personal data;
- private audience datasets;
- payment information.

## 3. Application states

Allowed states:

- `draft`
- `submitted`
- `under_review`
- `needs_evidence`
- `conditionally_approved`
- `provider_onboarding`
- `ready_for_activation`
- `active`
- `paused`
- `rejected`
- `terminated`

State rules:

- `conditionally_approved` is not an active affiliate appointment.
- `ready_for_activation` requires program-wide activation gates, Terms acceptance, approved channels, Offer Card, provider onboarding where required, and first-campaign readiness.
- `active` requires separate explicit program/partner activation authorization.
- `paused` stops new eligible promotion/commission activity to the extent supported by the provider but must preserve historical records.
- `rejected` and `terminated` do not erase historical compliance or reconciliation evidence.

Public enrollment must remain disabled until separately authorized.

## 4. Review record

Logical record:

`partner_review`

Minimum fields:

- review_id
- application_id
- reviewed_at
- reviewer_id
- audience_fit_notes
- trust_and_compliance_notes
- channel_fit_notes
- traffic_source_notes
- disclosure_notes
- prohibited_claim_risk
- coupon_cashback_risk
- paid_search_risk
- sub_affiliate_risk
- self_referral_risk
- provider_eligibility_state
- privacy_review_state
- proposed_offer_card
- proposed_first_campaign
- decision
- required_followups
- next_review_at

Allowed decisions:
- approve conditionally;
- request evidence;
- content-only collaboration;
- defer;
- reject;
- pause;
- activate only after separate authorization.

If a numeric internal score is later used, retain the component evidence and do not allow the score alone to activate a partner.

## 5. Approved-channel contract

Logical record:

`partner_channel_approval`

Fields:

- application_id
- channel_type
- canonical_channel_url
- approved_geographies
- approved_languages
- allowed_promotion_methods
- prohibited_promotion_methods
- disclosure_requirement
- paid_search_allowed
- coupon_cashback_allowed
- sub_affiliate_allowed
- approved_from
- approved_until
- reviewer_id

Defaults:
- paid trademark search: No;
- coupon/cashback: No;
- sub-affiliates: No;
- undisclosed endorsements: No;
- trading-signal / guaranteed-return claims: No.

## 6. Offer Card record

Logical record:

`partner_offer_card`

Required fields:

- offer_card_id
- application_id
- eligible_product_id
- commission_rate
- customer_discount
- commission_basis
- attribution_model
- attribution_window
- lock_or_reversal_rule
- effective_from
- effective_until
- approved_destinations
- approved_asset_version
- special_restrictions
- approver_id
- approved_at
- superseded_by

Initial policy constraints:
- P15 standard opening rate;
- P20/P25 only after documented review;
- P30 strategic ceiling only with explicit economic/owner approval;
- customer discount: None;
- Research Membership excluded unless separately approved later.

## 7. Attribution observation record

Logical record:

`partner_attribution_observation`

This is a reconciliation record, not a source of commerce authority.

Fields:

- observation_id
- observed_at
- provider
- provider_affiliate_id
- provider_referral_id if available
- provider_order_id
- provider_subscription_invoice_id if applicable
- provider_event_id
- campaign_id if approved
- landing_destination if permitted
- affiliate_id_observed
- referral_amount_observed
- provider_status
- provider_test_mode
- consent_state_reference if applicable
- reconciliation_state
- reconciliation_notes

Do not store:
- full IP addresses unless separately justified and approved;
- raw browser fingerprints;
- customer email unless the authoritative commerce record already requires it and reconciliation cannot be completed without a lawful reference;
- learning telemetry;
- payment credentials.

## 8. Reconciliation view

Internal dashboard/view name:

`partner_reconciliation_view`

Each row should reconcile:

`partner -> Offer Card -> provider affiliate -> provider referral/order -> USD Impact authoritative purchase -> entitlement lifecycle -> refund/dispute/chargeback state`

Minimum columns:

- partner display name
- application state
- Offer Card / rate
- provider affiliate ID
- provider referral/order ID
- USD Impact purchase ID
- eligible product
- provider order status
- affiliate/referral status
- referral amount
- commission state
- refund state
- dispute/chargeback state
- entitlement state
- reconciliation state
- exception reason
- last reconciled at

The dashboard must never expose customer payment instrument data or unnecessary customer identity.

## 9. Reconciliation states

Allowed values:

- `pending_provider_evidence`
- `pending_purchase_match`
- `matched`
- `held`
- `ineligible`
- `reversed`
- `exception_review`
- `closed`

Rules:
- missing provider/order evidence fails closed;
- duplicate provider events must not create duplicate payable records;
- refunded/disputed/charged-back transactions cannot remain finally commissionable;
- self-referral/circular/duplicate-buyer cases must be held or rejected;
- provider attribution never overrides canonical purchase or entitlement state.

## 10. Commission state

Internal reporting states only:

- `not_eligible`
- `pending`
- `held`
- `approved_by_provider`
- `rejected`
- `reversed`
- `paid_by_provider`
- `unknown`

USD Impact must not infer a payout merely from an order existing.

Where Lemon Squeezy owns referral approval/payout, its provider record remains authoritative for provider-managed commission status.

## 11. Exception queue

Logical view:

`partner_reconciliation_exceptions`

Include:
- missing purchase match;
- unexpected product;
- unexpected commission rate;
- affiliate ID mismatch;
- duplicate referral;
- self-referral indicator;
- circular referral indicator;
- refund without referral reversal;
- dispute/chargeback without hold/reversal;
- unknown provider state;
- provider/API mismatch;
- consent/tracking evidence mismatch;
- entitlement mismatch.

Every exception has:
- severity;
- owner;
- opened_at;
- evidence;
- current state;
- resolution;
- closed_at.

Unknown material state fails closed for commission eligibility.

## 12. Admin workflow

Internal sequence:

1. research candidate;
2. create internal application record;
3. review public evidence and declared channels;
4. record decision;
5. if conditionally approved, complete Terms/provider/KYC/privacy prerequisites;
6. issue approved Offer Card;
7. approve first campaign;
8. activate only under explicit separate authorization;
9. monitor provider referrals and reconciliation;
10. review compliance/economics;
11. retain, coach, change tier, pause, or terminate.

No step in this workflow authorizes public enrollment by itself.

## 13. Audit and retention

Retain enough evidence to reconstruct:
- who approved the partner;
- what Terms version applied;
- what Offer Card/rate applied;
- which channels were permitted;
- which referral/order generated a commission state;
- why a referral was accepted, rejected, held, or reversed;
- when the partner was paused/terminated.

Retention periods must be finalized with legal/privacy review and provider obligations.

## 14. Access control

Future implementation should enforce:
- server/admin-only application and reconciliation data;
- least-privilege access;
- no anonymous or general authenticated-user table access;
- audit logging for activation, rate, status, and exception-resolution changes;
- no browser exposure of provider secrets;
- no partner access to unrelated customer data.

## 15. Test fixtures required before implementation acceptance

Create synthetic fixtures only for:
- conditionally approved partner;
- rejected partner;
- P15 / P20 / P25 / P30 exception Offer Cards;
- valid eligible referral;
- excluded-product referral;
- self-referral;
- duplicate referral;
- circular referral;
- full refund;
- partial-refund UNKNOWN/review case if provider behavior is not proven;
- dispute/chargeback;
- out-of-order/replayed provider event;
- provider/API mismatch;
- entitlement-isolation assertion.

Fixtures must contain no real customer or partner personal data.

## 16. Activation boundary

This contract is considered implementation-ready only when:
- schema/API/admin design follows this contract;
- provider-specific fields are mapped to observed Lemon Squeezy behavior;
- privacy/legal review approves retained data;
- synthetic fixture tests pass;
- no attribution field can mutate entitlement;
- no custom payout ledger is introduced without separate approval;
- public enrollment remains disabled until separately approved.

Current status:

`OPERATIONS CONTRACT PREPARED / NO RUNTIME IMPLEMENTATION / PARTNER PROGRAM REMAINS DISABLED`

This document does not authorize recruitment, outreach, public enrollment, tracking, browser storage, commissions, discounts, payouts, Member Referral, Research Membership affiliate eligibility, checkout changes, customer-data changes, entitlement changes, provider configuration, or Production activation.
