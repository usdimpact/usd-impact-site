# Commerce provider eligibility update — 2026-08-26

## Purpose

Record the newly received written FastSpring product-eligibility decision and refresh the active provider shortlist without selecting a replacement provider or activating commerce.

Product: **Read the Dollar First Library Pass**  
Business entity: **SC Kela Leads SRL, Romania**  
Commerce state after this update: **provider-neutral / checkout disabled / no provider selected**.

This document is bounded due-diligence evidence. It does not create a provider account, register an adapter, configure credentials, enable sandbox/Live commerce, authorize a payment, or change customer/entitlement state.

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

## Remaining provider state — mailbox refresh 2026-08-26

### Lemon Squeezy

- Store application submitted 2026-08-25 after Support requested formal review.
- Application-received message stated the team would review the application.
- USD Impact supplied public product/business evidence on the review thread.
- Store/dashboard access was provisioned afterward.
- Fresh Gmail review on 2026-08-26 found **no later affirmative product/company eligibility decision**.
- Store provisioning is **not** eligibility approval.

Disposition: **PENDING WRITTEN ELIGIBILITY / NOT SELECTED.**

No Lemon Squeezy adapter, API key, webhook, product/variant, Production credential or checkout activation is authorized while review remains pending.

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

FastSpring is no longer part of the active candidate comparison. The remaining path is:

1. obtain an **affirmative written product/company eligibility** decision from a remaining provider;
2. complete account-specific Merchant-of-Record/legal/tax/refund/support/fees/reserve/payout/privacy responsibility evidence;
3. close provider-specific technical gaps against the same canonical lifecycle/security matrix;
4. require adequate webhook authenticity, idempotency and deterministic sandbox coverage;
5. compare any affirmative candidates on the same criteria;
6. obtain explicit owner approval before selecting a provider or registering an adapter;
7. keep Production commerce disabled until later sandbox, controlled-Live, independent-security and integrated-launch gates pass.

## Fail-closed state

Until one remaining provider passes both written eligibility and technical qualification:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null`;
- `providerConfigured=false`;
- `checkoutEnabled=false`.

No browser redirect, dashboard state, store provisioning, email receipt, or unverified commercial state can grant access.

## Evidence handling

The FastSpring case number, decision date and bounded decision summary are sufficient for the repository. Do not commit full Gmail message identifiers, private mail headers, provider credentials, identity documents, banking data, secrets or customer data.

Authoritative operational tracker: **Issue #53**.
