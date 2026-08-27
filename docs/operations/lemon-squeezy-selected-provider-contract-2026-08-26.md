# Lemon Squeezy Selected Provider Contract — 2026-08-26

## Decision

**Selected provider: Lemon Squeezy.**

Selection is approved for the one-time **Read the Dollar First Library Pass** under the existing fail-closed release process. Selection did not by itself activate checkout or register the adapter. After the coherent Development/Test matrix passed, the adapter-registration decision was separately approved on 2026-08-27 as code-only preparation.

Production remains `COMMERCE_MODE=disabled` with `COMMERCE_PROVIDER` unset. `REGISTERED_COMMERCE_ADAPTERS` now contains only the reviewed Lemon Squeezy adapter; this creates no Production credentials, webhook, checkout, Live transaction, or public paid activation.

## Approved lifecycle architecture

Lemon Squeezy uses the provider-neutral `mor-final-state-reconciliation` lifecycle profile.

The reviewed provider documentation exposes one-time `order_created` and `order_refunded` webhooks, plus authoritative Order API states including `pending`, `failed`, `paid`, `refunded`, `partial_refund`, and `fraudulent`. It does not expose deterministic one-time `dispute.opened`, `chargeback.completed`, or `dispute.reversed` webhooks.

USD Impact therefore does **not** synthesize events that the provider cannot authoritatively produce.

The selected security-equivalent model is:

- entitlement can be created only from a verified `order_created` whose current authoritative Order state is `paid` and whose trusted Store, Product, Variant, one-item/quantity-one, base subtotal, zero-discount, currency, account and purchase-intent invariants all match;
- webhook delivery is necessary but not sufficient: before granting, USD Impact re-reads the authoritative Order plus Order Items from the Lemon Squeezy API;
- `pending` and `failed` can never grant entitlement;
- a full `order_refunded` or reconciled `refunded` final state revokes access idempotently;
- a reconciled `fraudulent` final state revokes access idempotently using canonical `payment.revoked` semantics;
- the Library Pass supports full refunds only; an unexpected `partial_refund` is an explicit review-required state and never automatically grants, revokes, refunds, suspends or restores entitlement;
- no provisional access revocation occurs solely because an unobservable dispute may exist;
- because an unobservable dispute alone does not revoke access, an unobservable provider dispute reversal does not require a synthetic restoration event;
- a later `paid` observation does not auto-restore an already terminal local state; conflicting terminal/local state requires review;
- provider Order API reconciliation backs webhook processing and covers supported final states;
- MoR notices without a machine-readable state remain an operational incident/escalation input, not direct database authority;
- redirects, receipts, email messages, screenshots, dashboard observations and browser-provided IDs remain non-authoritative.

## Provider-neutral contract amendment

Commerce contract version `3` supports two lifecycle models:

1. `direct-events` — the existing model requiring deterministic dispute-opened, chargeback-completed and dispute-reversed capabilities;
2. `mor-final-state-reconciliation` — allowed only when the adapter has authoritative Order retrieval/reconciliation, final-state revocation, and documented Merchant-of-Record chargeback ownership.

The Lemon Squeezy adapter uses only model 2. This is an explicit architecture decision, not an adapter-specific bypass.

## Price, amount and currency invariant

The active Library Pass price remains server-authoritative.

For the currently approved launch scope:

- currency: `USD`;
- quantity: exactly `1` and exactly one authoritative Order Item;
- two distinct fixed-price Lemon Squeezy Variants are required: one for the USD 39 limited-launch tier and one for the USD 49 standard tier;
- the trusted Variant is selected only from durable server-side `purchase_intents.price_tier`; the browser does not select the trusted price tier or Variant;
- the trusted purchase intent stores the applicable base product price (`USD 39` limited-launch or `USD 49` standard);
- Lemon Squeezy Order `subtotal` must equal that trusted base price in cents;
- `discount_total` must equal zero and the checkout hides the discount-code field;
- browser `custom_price` is prohibited;
- the order `currency` must be `USD`;
- Lemon Squeezy's final Order `total` is retained as the authoritative Merchant-of-Record charged total and may exceed the base subtotal because of applicable tax;
- `first_order_item.price` is retained as provider evidence but is **not** used as the pre-tax base-price authority because current Lemon Squeezy Order examples can show that field as the tax-inclusive charged amount while `subtotal` remains the base product amount;
- a mismatch in Store, Product, Variant, item count, quantity, subtotal, discount policy or currency fails closed before entitlement mutation.

This source-driven correction tightens the implementation and avoids incorrectly rejecting legitimate taxed orders while preserving server-authoritative pricing.

## Customer-message and responsibility ownership

| Lifecycle area | Lemon Squeezy / MoR | USD Impact |
| --- | --- | --- |
| Payment collection / checkout | Owns hosted payment collection and payment-method processing | Creates only trusted server-side purchase intent and hosted checkout request |
| Payment receipt / legal invoice | Owns financial receipt/invoice and MoR tax/VAT disclosures | Does not duplicate the financial receipt; may send separate access-ready communication |
| Tax / VAT | Calculates, collects and remits applicable transactional tax as MoR | Reconciles payout/accounting and maintains required Romanian business records |
| Successful purchase | Sends provider financial confirmation according to provider behavior | Sends access-ready message only after verified normalized payment and entitlement creation |
| Pending / failed payment | Owns payment-processing state and provider-side customer messaging | Does not imply purchase success; provides account/support context only if needed |
| Refund execution / financial refund notice | Processes/records provider refund and financial notice | Applies verified access transition and may communicate the access consequence |
| Partial refund | Provider records the financial state | Full-refund-only policy: unexpected partial refund moves to review; no automatic entitlement mutation |
| Dispute / chargeback processing | Primary operational owner as Merchant of Record | Does not invent unobservable dispute events; monitors authoritative final state and handles access/support consequences |
| Fraudulent / provider final revocation state | Exposes authoritative Order final state where available | Reconciliation revokes entitlement idempotently and records audit evidence |
| Dispute reversal | Provider owns the underlying MoR dispute process | No synthetic restoration is required when access was never revoked solely for an unobservable dispute; any restoration must be based on an authoritative compatible state and reviewed local state |
| Product/account access | No authority to grant USD Impact entitlement | Sole application authority after verified commercial state |
| Buyer product support | Escalates payment-specific matters according to MoR support boundary | Owns Library Pass account, access, content, privacy and product support |
| Privacy / deletion | Retains transaction records under its legal/MoR obligations | Owns USD Impact account/privacy/export/deletion flows and explains provider retention boundary |
| Incident escalation | Owns provider payment/MoR incidents | Owns application incident response, entitlement controls and customer-facing product/access communication |

## Implementation now carried by PR #374

Credential-independent implementation is now included in Draft form:

- durable provider-neutral `commerce_reconciliations` persistence reusing the existing paid-access tables;
- service-role-only, `SECURITY INVOKER` RPCs for purchase-intent reservation, checkout attachment, webhook receipt idempotency, atomic purchase completion, authoritative final-state application and reconciliation retry recording;
- Test-Mode-only runtime configuration that rejects Production and rejects any Supabase project other than canonical Development;
- one verified QA-email sandbox allowlist;
- two server-trusted fixed-price Variant mappings for launch and standard price tiers;
- exact raw-body webhook verification before JSON parsing;
- immediate Order + Order Items API re-read before entitlement grant or refund/fraud mutation;
- bounded reconciliation scheduling logic;
- isolated `api/commerce.js` action routes with body parsing disabled for the webhook path;
- explicit full-refund-only / partial-review policy;
- automated contract tests for runtime, route, migration and adapter behavior.

The reconciliation migrations were applied to canonical Development only and verified. They have not been applied to Production.

## Adapter-registration decision — approved 2026-08-27

The registration gate is satisfied by the reviewed Development-only migration, Test Mode Store/Product/two-Variant mapping, non-Production credentials, real paid-order and duplicate-delivery evidence, automatic negative matrix, rolled-back lifecycle probes, database/advisor review, exact-head protected CI and exact-tree Preview evidence.

`REGISTERED_COMMERCE_ADAPTERS` may therefore contain only the reviewed Lemon Squeezy adapter in Draft PR #374. This is a code-only registration decision: the adapter's configuration assessment remains fail closed, Production remains disabled, and activation requires a separate mode-specific implementation and explicit release approval.

## #130 message ownership disposition

The selected-provider ownership mapping is now sufficient to unblock provider-dependent #130 design work:

- purchase financial receipt/invoice: Lemon Squeezy;
- access-ready/entitlement confirmation: USD Impact after verified payment;
- payment failure/pending processing communication: Lemon Squeezy primary, USD Impact only for non-duplicative account/support context;
- refund financial notice: Lemon Squeezy; access consequence: USD Impact;
- dispute/chargeback handling: Lemon Squeezy as MoR; USD Impact communicates only verified access/support consequences;
- tax/VAT invoice notices: Lemon Squeezy as MoR;
- entitlement/access-state communication: USD Impact;
- customer-support escalation: split by payment/MoR vs product/account/access responsibility.

The final controlled `support@usd-impact.com` inbound/reply recheck remains a launch-window gate and is not repeated now.

## Safety boundary

This decision does not authorize:

- applying the new migration to Production;
- Production payment secrets;
- public checkout;
- a Live provider transaction;
- real-card testing;
- Production `COMMERCE_PROVIDER` or `COMMERCE_MODE` changes;
- enabling any commerce mode or provider selection in Production through this registration decision;
- bypass of #343 or #54.

All payment testing must use Lemon Squeezy Test Mode until a separate controlled-Live approval is recorded.
