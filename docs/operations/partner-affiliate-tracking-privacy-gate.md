# Partner Affiliate Tracking Privacy / ePrivacy Activation Gate

Status: internal implementation checklist. Not legal advice. Not an activation approval.

Version: 0.1

Related authority:
- `docs/operations/partner-referral-program-readiness.md`
- `docs/operations/partner-program-terms-draft.md` (Draft PR #729)
- `apps/web/src/pages/privacy.md`
- current website consent controls and consent-contract tests

Provider assumption: Lemon Squeezy may be used for affiliate attribution if and when the Partner Program is activated. No tracking script, cookie, storage mechanism, affiliate program setting, or public enrollment is activated by this document.

## 1. Legal / privacy principle

For users in the EU/EEA, storing or accessing non-essential information on a user's device generally requires prior informed consent under the ePrivacy rules; technically necessary storage is the narrow exception.

Official reference points:
- European Data Protection Board FAQ on cookies and consent: https://www.edpb.europa.eu/contact/frequently-asked-questions_en
- European Commission cookies policy: https://commission.europa.eu/cookies-policy_en
- European Commission privacy guidance: https://commission.europa.eu/digital-life/protecting-your-data-and-privacy_en

The current USD Impact pattern already keeps optional analytics OFF by default, offers Accept and Reject at the same decision level, and allows later withdrawal through Privacy settings. Affiliate tracking must not weaken that standard.

## 2. Classification before implementation

Before enabling any Lemon Squeezy affiliate tracking script or comparable browser-side mechanism, record:

- exact script/source URL;
- exact cookies or browser-storage keys it creates;
- first-party vs third-party status;
- purpose of each identifier;
- whether the identifier persists across sessions;
- retention / expiry period;
- whether it is read before consent;
- data fields transmitted to Lemon Squeezy or another provider;
- whether IP address, user agent, page URL, referrer, campaign identifiers, or device identifiers are transmitted;
- whether the provider can combine the identifier with account, order, or customer data;
- supported attribution model and window;
- deletion / opt-out behavior;
- whether the provider honors withdrawal immediately for future tracking.

Unknown behavior fails closed.

## 3. Consent gate

If affiliate attribution uses any non-essential browser storage or device access:

- do not load or execute the affiliate tracking mechanism before valid consent;
- do not create the affiliate identifier before consent;
- do not infer consent from continued browsing;
- do not bundle affiliate tracking consent into required authentication or purchase access;
- Reject must be available as easily as Accept;
- withdrawal must be available later through the same Privacy settings surface;
- withdrawing consent must stop future affiliate tracking from that browser;
- previously collected data may remain only where a lawful retention basis applies.

Do not classify an attribution cookie as "essential" merely because it is commercially useful.

## 4. Consent-purpose design

Recommended model:

- preserve the existing essential category for authentication/security/remembered privacy choice;
- keep optional analytics as its existing independent purpose;
- introduce a separate optional purpose for affiliate / partner attribution unless legal review determines that combining it with another optional purpose remains specific, informed, and unambiguous.

Preferred internal identifier:
`partner_attribution`

Do not silently reuse `analytics=true` as consent for affiliate tracking.

## 5. Privacy Notice changes required before activation

The public Privacy Notice must be updated before the first Production affiliate-tracked visit to describe:

- that USD Impact uses partner / affiliate attribution when the user consents;
- the purpose: attribute qualifying purchases to an approved partner and reconcile commission;
- the provider used;
- categories of information processed;
- browser identifiers / cookies / storage involved;
- attribution window;
- legal basis;
- retention period;
- withdrawal mechanism;
- whether an affiliate ID may later be associated with a completed order;
- whether the partner receives customer identity (expected answer: no, unless explicitly approved and legally justified);
- provider privacy notice;
- any cross-border transfer information required after legal review.

The Privacy Notice must continue to state that attribution data cannot grant or modify product entitlement.

## 6. Cookie / storage inventory

Before activation, add every affiliate-related identifier to the public cookie/storage inventory.

For each identifier record:

| Field | Required value |
| --- | --- |
| Name | Exact cookie/storage key |
| Provider | USD Impact / Lemon Squeezy / other |
| Purpose | Affiliate attribution only |
| Category | Optional / non-essential unless legal review says otherwise |
| Set before consent | Must be No for optional tracking |
| Duration | Exact provider-configured value |
| Scope | Domain/path |
| Data | Non-personal affiliate/referral identifier where possible |
| Withdrawal behavior | Exact deletion/disable behavior |
| Provider docs | Current authoritative reference |

Do not publish placeholder cookie names or durations as fact.

## 7. Data minimization

Use only the minimum attribution information needed to reconcile a partner referral.

Preferred data:
- stable non-personal partner ID;
- campaign identifier where approved;
- landing path where useful;
- provider referral/order relationship;
- referral amount / commission state where exposed by the provider.

Do not place into the attribution identifier:
- email address;
- customer name;
- account ID;
- payment instrument;
- full IP address;
- quiz or learning data;
- private purchase details.

## 8. Account / commerce boundary

Affiliate attribution may be attached to a verified order for reconciliation only.

It must never:
- change checkout price;
- create a discount;
- choose a product;
- change tax;
- grant or extend entitlement;
- create a subscription;
- suppress a refund;
- alter dispute/chargeback handling;
- override purchase verification.

The provider purchase event remains authoritative for commerce state.

## 9. Partner visibility boundary

A partner should receive only the provider reporting necessary to administer its affiliate relationship.

Default position:
- no customer email;
- no account identity;
- no learning telemetry;
- no support history;
- no payment method;
- no private purchase metadata beyond provider-permitted referral reporting.

If provider dashboards expose additional customer information, document and review that exposure before activation.

## 10. Retention

Before activation, document:

- browser identifier expiry;
- provider click/referral retention;
- USD Impact reconciliation-record retention;
- refund/dispute/chargeback evidence retention;
- affiliate payout/audit retention;
- deletion behavior after withdrawal;
- any accounting or legal hold exceptions.

The attribution window and data-retention period are different concepts and must be documented separately.

## 11. Withdrawal / reset behavior

Acceptance test must prove:

1. user rejects affiliate tracking -> no affiliate identifier is created;
2. user accepts -> provider attribution can operate;
3. user later withdraws -> future tracking stops;
4. optional affiliate cookie/storage is removed where technically possible;
5. authentication, public content, Library Pass access, and account security continue to work;
6. withdrawal does not erase authoritative historical order/refund/accounting records that must lawfully remain.

## 12. Browser and region test matrix

Test at minimum:

- fresh browser / no prior consent;
- explicit reject;
- explicit accept;
- accept then withdraw;
- consent cookie expired;
- logged out;
- logged in;
- partner link -> public lesson;
- partner link -> checkout;
- same browser returning within attribution window;
- browser with storage blocked;
- browser with Do Not Track / Global Privacy Control where applicable to the chosen implementation policy;
- mobile and desktop;
- EU/EEA visitor path;
- non-EU path only if behavior differs by region.

Do not introduce regional consent bypass without explicit legal review.

## 13. Provider-specific Lemon Squeezy checks

### Current documentation inconsistency

As of 2026-09-30, Lemon Squeezy's public documentation is internally inconsistent about the browser persistence mechanism:

- merchant Getting Started says the configured Tracking length determines how long a **cookie** is stored in the visitor's browser;
- affiliate Generating Referrals says referral tracking **requires no cookies** and creates an anonymous unique identifier;
- the custom landing-page guide likewise describes tracking as not relying on cookies;
- the merchant Getting Referrals guide confirms the website script at `https://lmsqueezy.com/affiliate.js`, `?aff=` referral codes, an anonymous tracking identifier, `LemonSqueezy.Affiliate.GetId()`, `LemonSqueezy.Url.Build()`, and `?aff_ref=` propagation, but does not resolve the persistence mechanism contradiction.

Therefore the persistence mechanism is **PROVIDER-DOCUMENTATION-CONFLICT / UNKNOWN UNTIL OBSERVED**. Do not label the implementation cookie-based or cookie-free in the public Privacy Notice until a controlled browser/network/storage inspection of the current provider script settles the behavior.

Authoritative references to recheck immediately before testing:
- https://docs.lemonsqueezy.com/help/affiliates-for-merchants/getting-started
- https://docs.lemonsqueezy.com/help/affiliates-for-merchants/getting-referrals
- https://docs.lemonsqueezy.com/help/affiliates/generating-referrals
- https://docs.lemonsqueezy.com/guides/tutorials/affiliate-landing-pages

Before any Production configuration:

- confirm the current Lemon Squeezy affiliate tracking documentation and exact script;
- capture exact cookie/storage behavior from a controlled non-Production test;
- confirm configured attribution window;
- confirm whether first-click, last-click, or another rule applies;
- confirm order and subscription invoice affiliate relationships;
- confirm referral approval/rejection behavior;
- confirm refund/dispute/chargeback effect on referral/commission;
- confirm affiliate dashboard customer-data exposure;
- confirm provider deletion / consent-withdrawal limitations;
- confirm test-mode behavior where available.

Provider documentation must be rechecked immediately before activation because implementation details can change.

## 14. Technical release requirements

Implementation must be a separately reviewed PR from then-current main.

Required properties:

- affiliate script absent from the default page path before consent;
- consent resolver is fail-closed;
- no tracking call occurs on Reject;
- no tracking call occurs before a choice;
- withdrawal suppresses future affiliate calls;
- existing analytics consent continues to behave independently;
- existing authentication cookies remain unaffected;
- no affiliate identifier appears in first-party telemetry;
- CSP changes, if required, are narrow and provider-specific;
- tests cover script loading, storage, withdrawal, and failure states;
- Preview network inspection proves no affiliate request before consent.

## 15. Controlled end-to-end acceptance

Before Partner Program activation, prove in a permitted test environment:

`partner link -> consent choice -> provider attribution -> eligible checkout -> verified purchase -> affiliate/referral record -> lock/approval -> refund/reversal -> entitlement remains governed only by commerce state`

Also prove:

- self-referral fails or is rejected;
- duplicate/circular attribution cannot create extra commission;
- excluded product does not earn commission;
- customer discount does not silently stack;
- suspended partner cannot create new eligible referral credit;
- provider reporting reconciles to the authoritative order.

## 16. Documentation / governance acceptance

Before activation, all must be true:

- [ ] Privacy Notice updated and reviewed.
- [ ] Cookie/storage inventory updated.
- [ ] Consent purpose and UI copy approved.
- [ ] Retention rules recorded.
- [ ] Provider privacy / subprocessors reviewed.
- [ ] Partner Terms legally reviewed.
- [ ] Creative Pack approved.
- [ ] Provider tracking behavior captured in test.
- [ ] E2E attribution/reversal test passes.
- [ ] Production feature/config gate exists and defaults OFF.
- [ ] Rollback disables new tracking without affecting customer access.
- [ ] Explicit owner activation approval recorded.

## 17. Current decision

Current status:

`PRIVACY ARCHITECTURE READY FOR REVIEW / TRACKING REMAINS DISABLED / PUBLIC PRIVACY NOTICE UNCHANGED`

No browser tracking, cookie, localStorage, sessionStorage, affiliate identifier, provider setting, Partner Program enrollment, commission, payout, checkout, customer, entitlement, or Production configuration is authorized by this document.
