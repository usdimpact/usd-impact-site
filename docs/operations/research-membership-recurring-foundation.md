# Research Membership recurring foundation

Status: Development-first foundation under issue #122. No Production activation is authorized by this document.

## Approved product contract

- USD 29/month.
- USD 290/year.
- No free trial or introductory discount.
- One complete Weekly Report at least 30 days old may be selected later as the public sample after editorial/rights review.
- Cancellation is allowed at any time and takes effect at the end of the paid billing period.
- Refund handling follows the selected provider's current policy plus mandatory local consumer law; no additional blanket seller refund guarantee is promised at launch.
- Recurring activation remains gated behind 14 consecutive stable Production days for the existing Library Pass.
- Lemon Squeezy is preferred only if recurring Research Membership is separately qualified/approved. Existing one-time Library Pass approval must not be treated as subscription approval.
- TradingView access starts with a controlled manual grant/revocation process. Source code remains private.

## Product boundary

The recurring product id is `research-membership`.

It is independent from the permanent Library Pass. A Research Membership cancellation, payment failure, refund, dispute, chargeback, or provider change must never revoke or modify a separately purchased Library Pass entitlement.

Daily USD Impact remains public.

Research Membership governs ongoing premium research, including the member Weekly Report/archive, detailed Weekly Score research surfaces, ongoing monthly research, and controlled private TradingView access when separately activated.

## Provider-neutral data model

The foundation adds:

- `subscription_offers` — reviewed recurring commercial terms independent of provider catalog ids;
- `subscriptions` — one canonical provider-neutral lifecycle row per current account/product subscription, with historical terminal rows retained;
- `subscription_events` — append-only transition evidence;
- a nullable `entitlements.subscription_id` commercial-source link for recurring access.

The existing one-time purchase path remains purchase-backed through `entitlements.purchase_id`.

The migration prevents a single entitlement from being both purchase-backed and subscription-backed.

## State model

Supported states:

- `pending`
- `active`
- `past_due`
- `cancel_scheduled`
- `cancelled`
- `refunded`
- `disputed`
- `charged_back`

Terminal states are historical evidence, not reusable current-subscription rows.

A partial unique index permits only one current subscription for an account/product across `pending`, `active`, `past_due`, and `cancel_scheduled`.

A database trigger rejects state changes outside the reviewed transition graph.

## Access semantics

This foundation deliberately separates provider subscription state from access entitlement state.

The later webhook/runtime adapter must map provider events into both:

1. the canonical subscription state; and
2. the separate `research-membership` entitlement.

Expected policy direction before provider activation:

- `active` -> Research entitlement active;
- `cancel_scheduled` -> Research entitlement remains active through the paid period;
- `past_due` -> fail closed unless a separately reviewed grace-period policy is adopted;
- `cancelled`, `refunded`, `charged_back` -> no Research access;
- `disputed` -> Research access suspended while the dispute is unresolved.

No grace-period policy is approved by this foundation.

## Security boundary

- `subscription_offers`, `subscriptions`, and `subscription_events` use RLS.
- Anonymous users receive no access.
- Authenticated customers may read only their own subscription and subscription-event rows.
- Browser roles receive no recurring-state write grant.
- Provider/webhook mutations remain server/service-role only.
- No provider credentials or provider-specific subscription identifiers are committed here.

## Provider adapter requirements

A future recurring adapter must be separately reviewed and must:

- verify provider webhook signatures from the raw body;
- deduplicate provider events using stable provider event ids;
- reject account/product/provider mismatches;
- normalize provider lifecycle states before entitlement mutation;
- handle renewal, payment failure, scheduled cancellation, effective cancellation, refund, dispute, chargeback and eligible recovery/reversal paths;
- preserve Library Pass entitlement independently;
- reconcile provider state against local state without silently granting access from browser redirects or client state.

## Development validation required before implementation expands

Before any Production consideration:

- apply the migration only to `usd-impact-development`;
- verify the seeded Research Membership offer is USD 29 monthly / USD 290 annual / zero trial / 30-day sample age;
- verify RLS and browser-role grants;
- verify one-current-subscription uniqueness;
- verify invalid state transitions fail closed;
- verify a recurring entitlement can reference `subscription_id` while the existing Library Pass remains purchase-backed;
- verify no Production schema/configuration/customer data changes occurred.

## Explicitly out of scope

This foundation does not:

- create a Lemon Squeezy or other provider recurring product;
- create provider monthly/annual prices;
- enable recurring checkout;
- deploy Production schema changes;
- create or modify a Production subscription;
- modify any current customer, purchase or entitlement;
- publish the public sample;
- upload or expose the private TradingView indicator/source;
- send email or other outbound communication.
