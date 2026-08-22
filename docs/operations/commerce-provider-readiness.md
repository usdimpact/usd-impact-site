# USD Impact Provider-Neutral Commerce Readiness

## Current Production state

Paddle declined the USD Impact application on 20 August 2026 and is not an active payment dependency.

Production must remain in:

`ready_for_provider_configuration`

This means:

- account, purchase-intent, webhook-receipt, purchase, entitlement, refund, dispute, support, privacy, and audit foundations are available;
- public checkout is disabled;
- no payment can be entered on the USD Impact site;
- no browser redirect can grant access;
- no provider webhook route is accepted without a registered adapter;
- historical Paddle migrations and the archived Paddle branch are retained only for migration history and engineering reference.

The readiness endpoint is exposed at `/api/commerce-readiness` through the existing account function slot. It does not create another Vercel function and returns only bounded, non-secret public state.

## Generic configuration

The active application recognizes these non-secret control variables:

- `COMMERCE_MODE`
  - `disabled` — default; ready for provider configuration;
  - `sandbox` — adapter registered and ready for provider sandbox proof;
  - `live-test` — adapter registered and ready for a controlled Live test; public checkout remains disabled;
  - `live` — public checkout may be active only after every required proof and approval.
- `COMMERCE_PROVIDER`
  - lowercase stable provider identifier matching a registered adapter.
- `COMMERCE_SANDBOX_VERIFIED`
  - `true` only after the replacement-provider sandbox matrix passes.
- `COMMERCE_CONTROLLED_LIVE_VERIFIED`
  - `true` only after one separately approved controlled Live transaction and reversal or refund pass.
- `COMMERCE_LIVE_APPROVED`
  - `true` only after provider approval, operational readiness, sandbox proof, controlled-Live proof, and an explicit launch decision.

Provider credentials, price identifiers, webhook secrets, account identifiers, and API endpoints remain adapter-specific. They must be environment-scoped and must never be returned by the readiness endpoint.

Legacy `PADDLE_*` values are ignored by the active readiness contract and cannot select a provider, register an adapter, or activate checkout. Their values and presence are not disclosed by the public readiness response.

## Runtime states

### `ready_for_provider_configuration`

Default Production state. No provider is selected and checkout is disabled.

### `ready_for_sandbox`

A registered adapter exists, `COMMERCE_MODE=sandbox`, the deployment is outside Production, and the adapter confirms sandbox configuration. This state does not enable public checkout.

### `ready_for_controlled_live_test`

A registered adapter exists, `COMMERCE_MODE=live-test`, sandbox proof is recorded, the deployment is outside Production, and the adapter confirms controlled Live-test configuration. This state does not enable public checkout and must be restricted to a separately approved owner-controlled test.

### `active`

Allowed only when:

- a provider adapter is compiled and registered;
- the provider matches `COMMERCE_PROVIDER`;
- the adapter confirms Live configuration;
- `COMMERCE_SANDBOX_VERIFIED=true`;
- `COMMERCE_CONTROLLED_LIVE_VERIFIED=true`;
- `COMMERCE_MODE=live`;
- `COMMERCE_LIVE_APPROVED=true`;
- `VERCEL_ENV=production`;
- all email, support, legal, accounting, privacy, refund, security, and release gates are green.

Any incomplete, contradictory, unknown, non-Production Live, Production sandbox, or provider-without-adapter configuration resolves to `blocked` with checkout disabled.

## Public readiness response

The public endpoint may return only:

- contract version;
- USD Impact product ID;
- bounded readiness state and message;
- current generic mode;
- provider ID and adapter version only when configuration is non-blocked;
- whether public checkout is enabled.

It must not return:

- provider credentials or credential-presence indicators;
- webhook secrets;
- approval evidence flags;
- internal configuration failure details;
- legacy-provider environment state;
- customer, purchase, entitlement, or event identifiers.

## Adapter contract

A replacement provider adapter must declare a provider ID, semantic version, required capabilities, and these methods:

- `createCheckout` — creates a provider-hosted or tokenized checkout using server-authoritative account, product, price, quantity, purchase-intent, and metadata;
- `verifyWebhookSignature` — verifies the exact raw request body before parsing or processing;
- `normalizeEvent` — converts provider payloads into the canonical commerce event contract;
- `assessConfiguration` — confirms sandbox or Live readiness without exposing credentials.

Required capabilities:

- checkout creation;
- raw-body webhook verification;
- event normalization;
- completed payment;
- completed refund;
- opened dispute;
- completed chargeback;
- dispute reversal/restoration.

Adapter registration, generic checkout routing, webhook routing, provider-specific configuration validation, and adapter tests must land as one coherent reviewed change. Do not register an adapter before its routes and lifecycle processing are ready.

## Canonical event boundary

Provider-specific payloads must be normalized before database mutation. The canonical event includes:

- provider and provider event ID;
- canonical event type;
- occurrence timestamp;
- provider transaction, customer, checkout, and price references where applicable;
- trusted account and purchase-intent references;
- the active USD Impact product ID;
- amount and currency where applicable;
- minimized metadata required for audit or processing.

A completed payment must contain a trusted account ID, trusted purchase-intent ID, provider transaction ID, positive amount, and ISO currency. An event for any other product is rejected before processing.

Supported canonical event types:

- `checkout.pending`;
- `payment.completed`;
- `payment.failed`;
- `payment.cancelled`;
- `payment.expired`;
- `refund.completed`;
- `dispute.opened`;
- `chargeback.completed`;
- `dispute.reversed`.

## Partner and referral growth capability

The approved USD Impact Partner Program and Member Referral Program are growth layers, not payment authorities. Provider selection must now score the following capabilities in addition to the mandatory commerce/security gates:

- native or supported affiliate/partner platform;
- invite-only partner approval controls;
- configurable attribution window and attribution model;
- SKU/product inclusion and exclusion;
- percentage/fixed and recurring commission support;
- refund, dispute, and chargeback commission reversal or locking;
- partner KYC, tax, payout, and reporting responsibility;
- marketplace/discovery controls;
- API, webhook, or export access for reconciliation;
- self-referral and fraud controls;
- recurring-subscription compatibility for future Research Membership;
- incremental affiliate platform or transaction fees.

These are scored selection criteria, not permission to weaken the core adapter contract. A provider with excellent affiliate features remains ineligible if it fails product eligibility, Merchant-of-Record/legal/tax allocation, webhook authenticity, canonical lifecycle coverage, privacy, accounting, refund/dispute, security, or release requirements.

Attribution metadata is explicitly non-authoritative. It may identify a valid approved partner or member referral for later reward calculation, but it cannot change product, price, payment state, purchase ownership, or entitlement state. See `docs/operations/partner-referral-program-readiness.md` and `src/lib/acquisition-attribution.js`.

## Provider onboarding sequence

1. Confirm the provider accepts the USD Impact business, operating country, and educational product category.
2. Confirm Merchant-of-Record, tax/VAT, settlement, refund, dispute, and accounting responsibilities.
3. Record the provider's Partner Program and Member Referral Program capabilities as scored growth criteria without weakening mandatory commerce gates.
4. Implement the adapter behind the generic contract.
5. Add provider-specific secrets only to the required Vercel environment.
6. Add generic checkout and webhook routing without exposing raw card data to USD Impact.
7. Register the adapter in `src/lib/commerce-adapters.js` only in the same reviewed release.
8. Use `sandbox` mode and pass checkout, signature, event-normalization, replay, forgery, substitution, refund, dispute, chargeback, and reversal tests.
9. Record sandbox proof and set `COMMERCE_SANDBOX_VERIFIED=true` only in the controlled next-stage environment.
10. Verify email, support, privacy, retention, accounting, and incident ownership.
11. Move to `live-test` for one separately approved owner-controlled transaction.
12. Verify webhook receipt, exactly-one entitlement, customer delivery, and refund or reversal behavior.
13. Record controlled-Live proof and set `COMMERCE_CONTROLLED_LIVE_VERIFIED=true` only for the reviewed Production activation.
14. Move to `live` only after explicit approval and post-deployment verification.

Partner/referral activation remains a separate later release even after core commerce is Live. Persistent attribution, commission/reward calculation, enrollment, and payouts must pass their own privacy, fraud, compliance, reconciliation, and activation gates.

## Rollback

To stop commerce immediately:

1. set `COMMERCE_MODE=disabled`;
2. remove the provider and set every commerce evidence/approval flag to `false`;
3. redeploy;
4. verify `/api/commerce-readiness` reports `ready_for_provider_configuration` and checkout disabled;
5. do not delete provider receipts, purchases, entitlement events, refunds, disputes, or audit evidence;
6. investigate divergence before reactivation.

Removing an adapter from the registry also fails closed. Existing customer access must be handled according to verified purchase and entitlement records, not browser or provider-dashboard state alone.

## Production verification

After each commerce-related release, verify:

- `/checkout/` loads and does not accept payment unless the complete provider integration is active;
- `/api/commerce-readiness` returns `Cache-Control: no-store` and contains no secret or configuration-diagnostic values;
- configured provider and adapter version match the approved release when disclosed;
- checkout remains disabled in `disabled`, `sandbox`, `live-test`, `blocked`, and error states;
- Live mode cannot activate outside Vercel Production;
- no additional standalone Vercel function was introduced for readiness;
- Vercel Production deployment metadata matches the merged commit;
- no commerce runtime errors appear after release.
