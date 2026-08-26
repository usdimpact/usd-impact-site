# Commerce provider eligibility update — 2026-08-26

## Purpose

Record the written commerce-provider eligibility decisions and the resulting selected-provider state for the one-time **Read the Dollar First Library Pass** without activating commerce.

Product: **Read the Dollar First Library Pass**  
Business entity: **SC Kela Leads SRL, Romania**  
Governance-selected provider: **Lemon Squeezy**  
Production runtime state: **checkout disabled / `COMMERCE_MODE=disabled` / `COMMERCE_PROVIDER` unset / adapter unregistered**.

This is bounded due-diligence evidence. It does not configure credentials, apply a database migration, enable sandbox or Live commerce, authorize a payment, or change customer/entitlement state.

## FastSpring written eligibility decision

FastSpring Seller Support case **#01856172** supplied the written decision on **2026-08-25 at 22:33 UTC**.

Bounded decision summary:

> FastSpring stated that the disclosed product is not one FastSpring is licensed to process transactions for.

Disposition:

- **Product eligibility: REJECTED / FAILED.**
- **Current candidacy: REMOVED FROM ACTIVE PATH.**
- **Selection status: NOT SELECTED.**
- **Further eligibility follow-up under the current disclosed product scope: NOT REQUIRED / DO NOT SEND.**
- **Provider-specific account, adapter, secret, webhook, product, sandbox and Production work: NOT AUTHORIZED.**

The prior FastSpring technical research remains historical due diligence only. Technical compatibility cannot substitute for affirmative product eligibility.

## Lemon Squeezy written approval and selection

- Store application submitted **2026-08-25** after Support requested formal review.
- USD Impact supplied public product/business evidence plus requested pricing, product, licensing, audience, instant-fulfillment and KYB/KYC information.
- On **2026-08-26 at 11:03 UTC**, Lemon Squeezy reviewer Tanay Khemka supplied an affirmative written decision: the account was approved, the disclosed products meet Lemon Squeezy's Terms of Service, and the Merchant-of-Record risk profile was low enough to allow sales through Lemon Squeezy.
- The reviewer reiterated that fulfillment must be immediate and standardized, with no manual service fulfillment after purchase.
- The reviewer explicitly instructed USD Impact to use **Test Mode** for test purchases and not to use a real card.
- Official technical documentation supports server-created checkout, server-authoritative Store/Product/Variant controls, exact raw-body HMAC-SHA256 webhook verification, Test/Live isolation, successful-order handling, refunds, authoritative Order state, and Merchant-of-Record chargeback ownership.

Lemon Squeezy's published one-time webhook list does not expose deterministic dispute-opened, chargeback-completed or dispute-reversed events. USD Impact therefore explicitly approved the provider-neutral **`mor-final-state-reconciliation`** lifecycle model instead of fabricating unavailable events.

Disposition: **WRITTEN ELIGIBILITY APPROVED / PROVIDER SELECTED / MoR FINAL-STATE RECONCILIATION APPROVED / DRAFT SANDBOX IMPLEMENTATION IN PROGRESS.**

The selected-provider implementation is carried by Draft PR #374. Selection is not activation.

## Lifecycle decision

The approved model is fail closed:

- signed `order_created` can grant only when a fresh authoritative Order read remains `paid` and every trusted commercial invariant matches;
- `pending` and `failed` never grant;
- authoritative full `refunded` revokes access idempotently;
- authoritative `fraudulent` revokes through canonical `payment.revoked`, not a fabricated chargeback event;
- the Library Pass supports full refunds only; unexpected `partial_refund` is review-required and causes no automatic entitlement mutation;
- no unobservable dispute is invented and access is not provisionally revoked merely because one might exist;
- a later `paid` observation cannot automatically restore a terminal or incompatible local state;
- browser redirects, provider emails, screenshots and dashboard observations are never database authority.

## Other candidates

### PayPro Global

- Detailed pre-clearance request sent 2026-08-20.
- Focused follow-up sent 2026-08-22.
- No qualifying reply was received before provider selection.
- Reviewed signing evidence did not establish the exact raw-body authenticity contract required by USD Impact.

Disposition: **NOT SELECTED / NO FURTHER ACTIVE IMPLEMENTATION PATH.**

### Stripe Managed Payments / Stripe

Stripe remains fallback research only. No product-specific qualifying human eligibility decision superseded the selected Lemon Squeezy path.

Disposition: **NOT SELECTED / FALLBACK ONLY.**

### Paddle

Paddle previously declined and is removed from the active path.

Disposition: **REMOVED / NOT SELECTED.**

## Remaining selected-provider gates

Provider selection and lifecycle architecture are complete. The remaining work is implementation evidence, not another provider comparison:

1. keep PR #374 Draft and the adapter registry empty;
2. review and separately authorize applying the reconciliation migration to **canonical Development only**;
3. configure the approved Library Pass in Lemon Squeezy **Test Mode only**, using two fixed-price Variants for USD 39 launch and USD 49 standard;
4. configure only non-Production Test API/webhook credentials;
5. run the complete sandbox matrix and Development database/advisor review;
6. register the adapter only after coherent sandbox evidence is reviewed;
7. keep Production disabled until the later controlled release, integrated rehearsal, support, accounting/privacy, and independent-security gates are complete.

## Fail-closed runtime state

Provider selection is a governance decision. It does **not** populate Production runtime configuration.

Current Production expectations remain:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null` / `COMMERCE_PROVIDER` unset;
- `providerConfigured=false`;
- `checkoutEnabled=false`;
- `REGISTERED_COMMERCE_ADAPTERS` empty.

No browser redirect, dashboard state, store provisioning, email receipt, or unverified commercial state can grant access.

## Evidence handling

The provider decision date, reviewer role/name where operationally useful, and bounded decision summary are sufficient for the repository. Do not commit full Gmail message identifiers, private mail headers, provider credentials, identity documents, banking data, secrets or customer data.

Authoritative operational tracker: **Issue #53**.  
Selected-provider implementation: **Draft PR #374**.
