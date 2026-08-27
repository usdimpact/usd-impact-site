# Commerce provider eligibility update — 2026-08-26

## Purpose

Record the written commerce-provider eligibility decisions and the resulting selected-provider state for the one-time **Read the Dollar First Library Pass** without activating commerce.

Product: **Read the Dollar First Library Pass**  
Business entity: **SC Kela Leads SRL, Romania**  
Governance-selected provider: **Lemon Squeezy**  
Production runtime state: **checkout disabled / `COMMERCE_MODE=disabled` / `COMMERCE_PROVIDER` unset / Lemon Squeezy adapter registered in code only**.

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

Disposition: **WRITTEN ELIGIBILITY APPROVED / PROVIDER SELECTED / MoR FINAL-STATE RECONCILIATION APPROVED / DEVELOPMENT-TEST MATRIX COMPLETE / CODE-ONLY ADAPTER REGISTRATION APPROVED / NOT LIVE.**

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

Provider selection, lifecycle architecture, Development-only persistence, Test Mode proof and the coherent registration review are complete:

1. keep PR #374 Draft and register only the reviewed Lemon Squeezy adapter in code;
2. keep Production `COMMERCE_MODE=disabled` and `COMMERCE_PROVIDER` unset;
3. retain Test credentials and webhook configuration only in the approved non-Production scope;
4. preserve the complete sandbox, duplicate, negative, lifecycle, database/advisor, exact-head CI and Preview evidence;
5. complete the remaining KYB, tax, accounting, privacy, buyer-disclosure and launch-window support gates;
6. require separate explicit approval for any controlled-Live or Production activation step;
7. keep payment/refund testing in Test Mode and prohibit merchant self-purchases, related-party real-card tests and artificial Live refunds;
8. use the provider-compliant evidence model in `docs/operations/lemon-squeezy-provider-compliant-live-evidence-2026-08-27.md` before any public activation.

## Fail-closed runtime state

Provider selection is a governance decision. It does **not** populate Production runtime configuration.

Current Production expectations remain:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null` / `COMMERCE_PROVIDER` unset;
- `providerConfigured=false`;
- `checkoutEnabled=false`;
- `REGISTERED_COMMERCE_ADAPTERS` contains only the reviewed Lemon Squeezy adapter in code; registration alone does not alter the disabled state.

No browser redirect, dashboard state, store provisioning, email receipt, or unverified commercial state can grant access.

## Evidence handling

The provider decision date, reviewer role/name where operationally useful, and bounded decision summary are sufficient for the repository. Do not commit full Gmail message identifiers, private mail headers, provider credentials, identity documents, banking data, secrets or customer data.

Authoritative operational tracker: **Issue #53**.  
Selected-provider implementation: **Draft PR #374**.
