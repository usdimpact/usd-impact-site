# Commerce provider eligibility update — 2026-08-26

## Purpose

Record the current written commerce-provider eligibility decisions and refresh the active provider shortlist without activating commerce.

Product: **Read the Dollar First Library Pass**  
Business entity: **SC Kela Leads SRL, Romania**  
Commerce state after this update: **checkout disabled / no provider selected / Lemon Squeezy preferred candidate pending lifecycle closure**.

This document is bounded due-diligence evidence. It does not register an adapter, configure credentials, enable sandbox/Live commerce, authorize a payment, or change customer/entitlement state.

## FastSpring written eligibility decision

FastSpring Seller Support case **#01856172** supplied the missing written decision on **2026-08-25 at 22:33 UTC**.

Bounded decision summary:

> FastSpring stated that the disclosed product is not one FastSpring is licensed to process transactions for.

Disposition:

- **Product eligibility: REJECTED / FAILED.**
- **Current candidacy: REMOVED FROM ACTIVE PATH.**
- **Selection status: NOT SELECTED.**
- **Further eligibility follow-up under the current disclosed product scope: NOT REQUIRED / DO NOT SEND.**
- **Provider-specific account, adapter, secret, webhook, product, sandbox and Production work: NOT AUTHORIZED.**

The prior public technical research remains valid only as historical technical due diligence. It demonstrates that a technically compatible webhook/checkout surface cannot substitute for affirmative product eligibility.

The rejection must not be rewritten as “pending,” “awaiting Sales,” or “primary candidate.” A future FastSpring path would require a new written provider determination covering a materially revised disclosed product; no such path is currently planned or authorized.

## Remaining provider state — refreshed 2026-08-26

### Lemon Squeezy

- Store application submitted 2026-08-25 after Support requested formal review.
- USD Impact supplied public product/business evidence and the requested detailed pricing, product, licensing, audience, instant-fulfillment and KYB/KYC information.
- On **2026-08-26 at 11:03 UTC**, Lemon Squeezy reviewer Tanay Khemka supplied an affirmative written decision: the account is approved, the disclosed products meet Lemon Squeezy's Terms of Service, and the Merchant-of-Record risk profile is low enough to allow USD Impact to sell through Lemon Squeezy.
- The reviewer reiterated that fulfillment must be immediate and standardized, with no manual service fulfillment after purchase.
- The reviewer explicitly instructed USD Impact to use **Test Mode** for test purchases and not to use a real card.
- Technical qualification is favorable for server-created checkout, server-authoritative product/variant controls, exact raw-body HMAC-SHA256 webhook verification, Test/Live isolation, successful-order handling and refunds.
- One P0 lifecycle-contract question remains open: the published single-payment webhook list does not identify direct dispute-opened, chargeback-completed or dispute-reversed events. A focused clarification was sent to the approving reviewer on 2026-08-26.

Disposition: **WRITTEN ELIGIBILITY APPROVED / PREFERRED CANDIDATE / TECHNICAL QUALIFICATION IN PROGRESS / NOT YET SELECTED.**

No Lemon Squeezy adapter, Production API key, Production webhook secret or public checkout activation is authorized until the lifecycle exception is explicitly closed and provider selection is recorded.

### PayPro Global

- Detailed pre-clearance request sent 2026-08-20.
- Focused follow-up sent 2026-08-22.
- Fresh Gmail review on 2026-08-26 found **no PayPro Global reply**.
- Existing technical analysis still identifies an authenticity-contract mismatch: reviewed PayPro signing documentation covers selected fields rather than the exact raw POST body required by the current USD Impact adapter contract.

Disposition: **PENDING WRITTEN ELIGIBILITY / TECHNICAL GAPS OPEN / NOT SELECTED.**

### Stripe Managed Payments / Stripe

Stripe remains a fallback only. The prior direct Sales email route was not a qualifying human review. Public Managed Payments material appears technically strong for Merchant-of-Record flows, but its cryptocurrency-related-product prohibition is broad enough that USD Impact's educational Bitcoin curriculum requires product-specific written clarification before the provider can advance.

Disposition: **NOT YET UNDER A QUALIFYING HUMAN ELIGIBILITY REVIEW / NOT SELECTED.**

## Active decision rule

FastSpring is no longer part of the active candidate comparison. Lemon Squeezy is the first remaining candidate to pass written product/company eligibility. The path is now:

1. close Lemon Squeezy's provider-specific one-time dispute/chargeback/reversal lifecycle question or explicitly approve a reviewed security-equivalent reconciliation contract;
2. complete account-specific Merchant-of-Record/legal/tax/refund/support/fees/reserve/payout/privacy responsibility evidence;
3. record explicit provider selection before registering an adapter;
4. create/configure the approved Library Pass in Lemon Squeezy Test Mode only;
5. require adequate webhook authenticity, idempotency and deterministic sandbox coverage;
6. keep Production commerce disabled until later sandbox, controlled-Live, independent-security and integrated-launch gates pass.

## Fail-closed state

Until Lemon Squeezy passes the remaining technical qualification gate and provider selection is explicitly recorded:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null`;
- `providerConfigured=false`;
- `checkoutEnabled=false`.

No browser redirect, dashboard state, store provisioning, email receipt, or unverified commercial state can grant access.

## Evidence handling

The provider decision date, reviewer role/name where operationally useful, and bounded decision summary are sufficient for the repository. Do not commit full Gmail message identifiers, private mail headers, provider credentials, identity documents, banking data, secrets or customer data.

Authoritative operational tracker: **Issue #53**.
