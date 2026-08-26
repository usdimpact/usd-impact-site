# USD Impact Provider-Neutral Commerce Readiness

## Current Production state

Lemon Squeezy is the selected provider for the one-time Read the Dollar First Library Pass, but selection is deliberately separate from activation.

Production must remain in:

`ready_for_provider_configuration`

with `COMMERCE_MODE=disabled`, no registered commerce adapter, no public checkout, and no payment-authoritative browser path until the selected adapter, routes, reconciliation, sandbox evidence and release gates are complete.

Paddle and FastSpring are not active payment dependencies. Historical provider material remains evidence only.

The readiness endpoint is exposed at `/api/commerce-readiness` through the existing account function slot and returns only bounded non-secret state.

## Commerce contract version 3

Contract version `3` preserves the existing direct-event lifecycle model and adds one explicit security-equivalent Merchant-of-Record reconciliation model. This is a provider-neutral architecture rule, not a Lemon Squeezy exception hidden inside an adapter.

Every adapter must declare a `lifecycleModel`:

- `direct-events` — for providers that expose deterministic dispute/chargeback/reversal lifecycle events;
- `mor-final-state-reconciliation` — for a reviewed Merchant-of-Record provider whose authoritative API exposes safe final commercial states even when intermediate dispute events are not machine-readable.

If `lifecycleModel` is omitted, validation defaults to `direct-events` for backwards compatibility.

## Generic configuration

The application recognizes these non-secret controls:

- `COMMERCE_MODE`
  - `disabled` — default Production hold; no checkout;
  - `sandbox` — non-Production controlled provider proof only;
  - `live-test` — separately approved non-public controlled Live proof only;
  - `live` — public checkout only after every release gate and explicit activation approval.
- `COMMERCE_PROVIDER`
  - lowercase stable provider identifier matching a registered adapter.
- `COMMERCE_SANDBOX_VERIFIED`
  - `true` only after the complete selected-provider sandbox matrix passes.
- `COMMERCE_CONTROLLED_LIVE_VERIFIED`
  - `true` only after separately approved controlled Live evidence.
- `COMMERCE_LIVE_APPROVED`
  - `true` only after the final launch decision.

Provider credentials, Store/Product/Variant identifiers, price configuration, webhook secrets and API credentials remain environment-scoped and must never be returned by the readiness endpoint.

Legacy `PADDLE_*` values are ignored by the active readiness contract and cannot select a provider, register an adapter or activate checkout.

## Runtime states

### `ready_for_provider_configuration`

Production default while commerce is disabled. A provider may be selected in governance without being configured or active in Production.

### `ready_for_sandbox`

A registered adapter exists, `COMMERCE_MODE=sandbox`, the deployment is outside Production, and the adapter confirms the bounded sandbox configuration. Public checkout remains disabled.

### `ready_for_controlled_live_test`

A registered adapter exists, sandbox proof is recorded, `COMMERCE_MODE=live-test`, the deployment is outside Production, buyer-facing disclosures are complete, and the adapter confirms controlled-Live configuration. Public checkout remains disabled.

### `active`

Allowed only when the adapter is registered and matches `COMMERCE_PROVIDER`, configuration is complete, sandbox and controlled-Live evidence are green, `COMMERCE_MODE=live`, `COMMERCE_LIVE_APPROVED=true`, `VERCEL_ENV=production`, buyer disclosures are complete, and every legal/accounting/privacy/support/security/release gate is green.

Any contradictory, unknown, incomplete, Production-sandbox, non-Production-live, or provider-without-adapter state resolves to `blocked` with checkout disabled.

## Public readiness response

The public endpoint may expose only bounded readiness information: contract version, USD Impact product ID, readiness state/message, generic mode, provider ID/adapter version only when non-blocked, approved seller disclosure where applicable, and checkout-enabled state.

It must not expose credentials, secret-presence indicators, webhook secrets, approval evidence flags, internal failure diagnostics, legacy-provider environment state, customer identifiers, purchase identifiers, entitlement identifiers or provider event identifiers.

## Base adapter contract

Every adapter must provide:

- `createCheckout` — server-authoritative checkout creation;
- `verifyWebhookSignature` — exact raw-body verification before parsing or mutation;
- `normalizeEvent` — provider payload to canonical event conversion;
- `assessConfiguration` — fail-closed environment/configuration readiness without leaking credentials.

Every adapter must declare these base capabilities:

- `checkout.create`;
- `webhook.verify-raw-body`;
- `event.normalize`;
- `payment.complete`;
- `refund.complete`.

Adapter registration, checkout routing, webhook routing, provider-specific configuration validation, lifecycle processing, and tests must land as one coherent reviewed release. A selected provider is not automatically registerable.

## Direct-event lifecycle profile

A `direct-events` adapter must additionally declare:

- `dispute.open`;
- `chargeback.complete`;
- `dispute.reverse`.

It must normalize authoritative provider events into the corresponding canonical event types.

## Merchant-of-Record final-state reconciliation profile

A `mor-final-state-reconciliation` adapter must additionally declare:

- `order.retrieve`;
- `order.reconcile`;
- `payment.revoke-final-state`;
- `mor.chargeback-managed`.

It must also implement:

- `retrieveOrder` — fetches authoritative provider order/transaction state using environment-scoped server credentials;
- `reconcileTransaction` — converts a reviewed provider final state into a deterministic fail-closed application action.

This profile is acceptable only when all of the following are true:

1. the provider is a documented Merchant of Record with primary operational chargeback/payment responsibility;
2. the application grants entitlement only from verified authoritative successful-payment state;
3. non-final/failed states never grant entitlement;
4. authoritative full-refund or fraud/final-revocation state can revoke entitlement idempotently;
5. provider API reconciliation backs webhook delivery and catches supported final-state changes;
6. unavailable intermediate dispute events are not inferred from browser redirects, email, screenshots or dashboard observation;
7. no synthetic restoration event is created merely to mirror a provider event that does not exist;
8. any state outside the reviewed contract fails closed to bounded manual incident review;
9. reconciliation persistence, scheduling, idempotency, audit evidence, retries and outage handling are proven before adapter registration.

For Lemon Squeezy, this is the selected lifecycle profile. The provider's documented one-time webhooks are used where available, while Order API reconciliation provides the authoritative final-state backstop.

## Canonical event boundary

Provider-specific payloads must be validated and normalized before database mutation. Canonical events may include provider/event IDs, event type, occurrence time, provider transaction/customer/checkout/price references, trusted account and purchase-intent references, the active USD Impact product ID, amount/currency where applicable, and minimized processing metadata.

A completed payment requires a trusted account ID, trusted purchase-intent ID, provider transaction ID, positive amount and ISO currency. An event for any other product is rejected.

Supported canonical event types are:

- `checkout.pending`;
- `payment.completed`;
- `payment.failed`;
- `payment.cancelled`;
- `payment.expired`;
- `payment.revoked`;
- `refund.completed`;
- `dispute.opened`;
- `chargeback.completed`;
- `dispute.reversed`.

`payment.revoked` is a provider-neutral final-state revocation event for authoritative fraud/final-invalid-payment reconciliation. It must never be created from a browser claim or unsupported inference.

## Selected Lemon Squeezy price/currency rule

For the current one-time Library Pass scope:

- checkout quantity is exactly `1`;
- Store/Product/Variant are server-authoritative;
- browser `custom_price` is prohibited;
- purchase-intent currency is `USD`;
- trusted base product price is the approved USD 39 limited-launch or USD 49 standard price;
- the provider order item's base price must equal the trusted purchase-intent base price in cents;
- the provider order currency must equal `USD`;
- the Merchant-of-Record tax-inclusive final order total is retained separately and is not incorrectly required to equal the pre-tax base product price;
- any Store/Product/Variant/quantity/base-price/currency mismatch fails closed before entitlement mutation.

## Lemon Squeezy final-state rules

The current reviewed reconciliation model is:

- `paid` -> retain/allow payment completion only after every trusted invariant passes;
- `pending` -> hold; never grant;
- `failed` -> hold/deny; never grant;
- `refunded` -> revoke idempotently through refund semantics;
- `fraudulent` -> revoke idempotently through `payment.revoked`;
- `partial_refund` -> explicit review state until the entitlement policy is approved.

An unobservable dispute by itself is not payment authority and does not produce a synthetic local dispute event. Access is therefore not provisionally revoked merely because such a dispute might exist. A later unobservable reversal likewise does not require synthetic restoration. Any restoration must be supported by an authoritative compatible commercial state.

## Partner/referral boundary

Partner/referral features remain growth layers and never become payment or entitlement authority. Attribution metadata cannot alter product, price, payment state, purchase ownership or entitlement state. Partner/referral activation remains a separate later release.

## Provider onboarding sequence

1. Confirm written product/company eligibility and Merchant-of-Record/legal/tax responsibilities.
2. Select the provider and approved lifecycle profile explicitly.
3. Freeze the responsibility/message-ownership matrix.
4. Implement provider adapter, reconciliation, generic checkout route, verified webhook route and tests coherently.
5. Configure only non-Production Test/sandbox credentials first.
6. Register the adapter only when route/reconciliation/persistence behavior is ready for the sandbox matrix.
7. Prove checkout, signature, replay, duplicate, forgery, substitution, price/currency/quantity, out-of-order, refund and final-state reconciliation behavior.
8. Record sandbox proof before any controlled Live stage.
9. Verify support/privacy/retention/accounting/incident ownership.
10. Perform a controlled Live test only under separate explicit approval.
11. Complete #343 against the commerce-enabled near-final candidate.
12. Activate public checkout only after #54 Phase A and all final launch approvals are green.

## Rollback

To stop commerce immediately, set `COMMERCE_MODE=disabled`, remove provider/evidence activation flags as required, redeploy, verify the public readiness endpoint reports checkout disabled, preserve all provider receipts/purchases/refunds/reconciliation/audit evidence, and investigate before reactivation.

Removing an adapter from the registry also fails closed. Existing customer access must remain based on verified durable purchase/entitlement records, never browser or provider-dashboard state alone.

## Production verification

After any commerce-related Production release, verify `/checkout/` remains non-payment-capable unless complete activation is approved, `/api/commerce-readiness` is `no-store` and secret-free, configured provider/adapter metadata matches the approved release when disclosed, disabled/blocked states cannot enable checkout, Live mode cannot activate outside Vercel Production, Production deployment metadata matches the merged commit, and runtime-error review is clean.

## Current release boundary — 2026-08-26

Lemon Squeezy is selected, but Draft PR #374 remains implementation work. Production still has `COMMERCE_MODE=disabled`; `REGISTERED_COMMERCE_ADAPTERS` remains empty; no Production provider credentials, public checkout, Live transaction or real-card test is authorized. See `docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md` and Issues #53, #130, #343 and #54.
