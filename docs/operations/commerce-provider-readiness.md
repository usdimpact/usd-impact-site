# USD Impact Provider-Neutral Commerce Readiness

## Current Production state

Lemon Squeezy is the selected provider for the one-time Read the Dollar First Library Pass, but selection is deliberately separate from activation.

Production must remain in:

`ready_for_provider_configuration`

with `COMMERCE_MODE=disabled`, `COMMERCE_PROVIDER` unset, the Lemon Squeezy adapter registered in code only, no public checkout, and no payment-authoritative browser path. Registration alone cannot activate commerce.

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

- checkout and authoritative Order Item quantity are exactly `1` and there must be exactly one Order Item;
- Store and Product are server-authoritative;
- the USD 39 limited-launch and USD 49 standard tiers use two distinct fixed-price Lemon Squeezy Variants;
- the trusted Variant is selected only from durable server-side `purchase_intents.price_tier`;
- browser `custom_price` is prohibited;
- the checkout hides discount-code entry and authoritative `discount_total` must equal zero;
- purchase-intent currency is `USD`;
- trusted base product price is the approved USD 39 limited-launch or USD 49 standard price;
- the authoritative Order `subtotal` must equal the trusted purchase-intent base price in cents;
- the provider Order currency must equal `USD`;
- the Merchant-of-Record final Order `total` is retained separately and may exceed the base subtotal because of applicable tax;
- `first_order_item.price` is audit evidence, not the trusted pre-tax base-price authority, because current provider examples can show that field as the tax-inclusive charged value while `subtotal` remains the base amount;
- any Store/Product/Variant/item-count/quantity/subtotal/discount/currency mismatch fails closed before entitlement mutation.

The runtime also retrieves authoritative Order Items, rather than relying solely on the Order object's abbreviated `first_order_item`, so quantity and item count are verified explicitly.

## Lemon Squeezy final-state rules

The current reviewed reconciliation model is:

- `paid` -> retain/allow payment completion only after every trusted invariant passes; if a terminal/non-active local state conflicts with a later `paid` observation, require review and never auto-restore;
- `pending` -> hold; never grant;
- `failed` -> hold/deny; never grant;
- `refunded` -> revoke idempotently through refund semantics only when the authoritative full refunded amount matches the authoritative final Order total;
- `fraudulent` -> revoke idempotently through `payment.revoked` without fabricating a chargeback state;
- `partial_refund` -> explicit review state under the approved full-refund-only Library Pass policy; no automatic purchase or entitlement mutation.

An unobservable dispute by itself is not payment authority and does not produce a synthetic local dispute event. Access is therefore not provisionally revoked merely because such a dispute might exist. A later unobservable reversal likewise does not require synthetic restoration. Any restoration must be supported by an authoritative compatible commercial state and compatible reviewed local state.

## Draft sandbox runtime implementation

PR #374 now carries credential-independent implementation code and a reviewed code-only Lemon Squeezy registry entry while keeping Production disabled:

- a `commerce_reconciliations` table that reuses existing purchase, entitlement, event and webhook-receipt primitives;
- service-role-only `SECURITY INVOKER` RPCs with explicit execution revokes from `public`, `anon` and `authenticated`;
- Test-Mode-only runtime configuration hard-blocked in Vercel Production and hard-bound to canonical Development Supabase;
- one verified QA-email sandbox allowlist;
- exact raw-body HMAC verification before webhook JSON parsing;
- durable SHA-256 webhook receipt idempotency;
- authoritative Order plus Order Items re-read before state mutation;
- bounded daily/three-day/weekly reconciliation cadence with a per-run cap of 25;
- full-refund-only partial-refund review behavior;
- an isolated commerce function at `/api/commerce` with `checkout`, `webhook` and `reconcile` actions;
- no public checkout UI and no Vercel reconciliation cron schedule yet.

The reconciliation migrations were applied to canonical Development only and verified with real Lemon Squeezy Test Mode evidence. They have not been applied to Production. Registration remains code-only and does not authorize any Production configuration or transaction.

## Controlled-Live/Live code-only preparation — 2026-08-27

After PR #374 merged as a public-facing fail-closed release, a separate Draft phase prepared the runtime for later controlled-Live and Live verification without configuring either environment.

The prepared contract:

- uses `LEMON_SQUEEZY_TEST_*` only for sandbox and `LEMON_SQUEEZY_LIVE_*` only for controlled-Live/Live, with no cross-namespace fallback;
- requires provider checkout, webhook, and authoritative Order state to match the configured `test_mode` exactly;
- pins the reviewed Live Product `1319591`, Launch Variant `2062957`, and Standard Variant `2062958`;
- restricts controlled-Live to one configured QA email, non-Production Vercel, canonical Development Supabase, completed sandbox proof, approved disclosures, and enabled reconciliation;
- restricts public Live to Vercel Production, canonical Production Supabase, completed sandbox and controlled-Live proof, explicit Live approval, approved disclosures, enabled reconciliation, and an approved USD Impact Production redirect host;
- preserves raw-body signature verification, trusted purchase intent validation, authoritative Order plus Order Items re-read, durable deduplication, and final-state reconciliation.

This code does not set any environment value or authorize a Production migration, secret, Live webhook, transaction, refund, or checkout activation. See `docs/operations/lemon-squeezy-controlled-live-runtime-2026-08-27.md`.

## Partner/referral boundary

Partner/referral features remain growth layers and never become payment or entitlement authority. Attribution metadata cannot alter product, price, payment state, purchase ownership or entitlement state. Partner/referral activation remains a separate later release.

## Provider onboarding sequence

1. Confirm written product/company eligibility and Merchant-of-Record/legal/tax responsibilities.
2. Select the provider and approved lifecycle profile explicitly.
3. Freeze the responsibility/message-ownership matrix.
4. Implement provider adapter, reconciliation, generic checkout route, verified webhook route and tests coherently.
5. Review and apply persistence changes to canonical Development only under explicit authorization.
6. Configure only non-Production Test/sandbox credentials first.
7. Prove checkout, signature, raw-body handling, replay/hash mismatch, duplicate, forgery, substitution, subtotal/discount/currency/item-count/quantity, out-of-order, refund, fraud and final-state reconciliation behavior.
8. Register the adapter only after the coherent Development/sandbox matrix is green and reviewed.
9. Record sandbox proof before any controlled Live stage.
10. Verify support/privacy/retention/accounting/incident ownership.
11. Record provider-compliant controlled-Live evidence under separate explicit approval: retain the full Test Mode lifecycle proof, validate the trusted Live catalog read-only, and verify the exact protected Live webhook fails closed without a Live checkout, merchant self-purchase or artificial refund.
12. Treat #343 as optional post-launch assurance; it is not a candidate-freeze or activation prerequisite, and this sequence does not authorize external testing.
13. Activate public checkout only after #54 Phase A and all final launch approvals are green, then monitor the first independent genuine buyer order as real commerce.

## Rollback

To stop commerce immediately, set `COMMERCE_MODE=disabled`, remove provider/evidence activation flags as required, redeploy, verify the public readiness endpoint reports checkout disabled, preserve all provider receipts/purchases/refunds/reconciliation/audit evidence, and investigate before reactivation.

Removing an adapter from the registry also fails closed. Existing customer access must remain based on verified durable purchase/entitlement records, never browser or provider-dashboard state alone.

## Production verification

After any commerce-related Production release, verify `/checkout/` remains non-payment-capable unless complete activation is approved, `/api/commerce-readiness` is `no-store` and secret-free, configured provider/adapter metadata matches the approved release when disclosed, disabled/blocked states cannot enable checkout, Live mode cannot activate outside Vercel Production, Production deployment metadata matches the merged commit, and runtime-error review is clean.

## Current release boundary — 2026-08-27

Lemon Squeezy is selected, PR #374 is merged, and its public-facing disclosure release remains fail closed in Production. The controlled-Live/Live runtime is merged but remains non-payment preparation only. Production still has `COMMERCE_MODE=disabled` with `COMMERCE_PROVIDER` unset; the reconciliation migrations exist only in canonical Development; no Production provider credentials, webhook, public checkout, Live transaction, real-card test, refund or Production database change is authorized. Provider-compliant Live evidence must follow `docs/operations/lemon-squeezy-provider-compliant-live-evidence-2026-08-27.md`. See `docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md`, `docs/operations/lemon-squeezy-sandbox-runtime-2026-08-26.md`, `docs/operations/lemon-squeezy-controlled-live-runtime-2026-08-27.md`, and Issues #53, #130 and #54.
