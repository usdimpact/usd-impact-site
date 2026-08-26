# Lemon Squeezy Selected Provider Contract — 2026-08-26

## Decision

**Selected provider: Lemon Squeezy.**

Selection is approved for the one-time **Read the Dollar First Library Pass** under the existing fail-closed release process. This selection does not activate checkout, register the adapter, create Production credentials, authorize a Live transaction, or approve public paid activation.

Production remains `COMMERCE_MODE=disabled`. The active adapter registry remains empty until implementation and sandbox evidence are complete.

## Approved lifecycle architecture

Lemon Squeezy uses the provider-neutral `mor-final-state-reconciliation` lifecycle profile.

The reviewed provider documentation exposes one-time `order_created` and `order_refunded` webhooks, plus authoritative Order API states including `pending`, `failed`, `paid`, `refunded`, `partial_refund`, and `fraudulent`. It does not expose deterministic one-time `dispute.opened`, `chargeback.completed`, or `dispute.reversed` webhooks.

USD Impact therefore does **not** synthesize events that the provider cannot authoritatively produce.

The selected security-equivalent model is:

- entitlement can be created only from a verified `order_created` whose authoritative order state is `paid` and whose trusted product, variant, quantity, item price, currency, account and purchase-intent invariants all match;
- `pending` and `failed` can never grant entitlement;
- a full `order_refunded` or reconciled `refunded` final state revokes access idempotently;
- a reconciled `fraudulent` final state revokes access idempotently using canonical `payment.revoked` semantics;
- `partial_refund` is not guessed: it remains a review state until the explicit entitlement policy is approved;
- no provisional access revocation occurs solely because an unobservable dispute may exist;
- because an unobservable dispute alone does not revoke access, an unobservable provider dispute reversal does not require a synthetic restoration event;
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
- quantity: exactly `1`;
- approved variant is selected from server-side configuration;
- the trusted purchase intent stores the applicable base product price (`USD 39` limited-launch or `USD 49` standard);
- Lemon Squeezy `first_order_item.price` must equal that trusted base price in cents;
- browser `custom_price` is prohibited;
- the order `currency` must be `USD`;
- Lemon Squeezy's final order `total` is retained as the authoritative tax-inclusive charged total and may exceed the base price because the Merchant of Record calculates applicable tax;
- a mismatch in Store, Product, Variant, quantity, item price or currency fails closed before entitlement mutation.

## Customer-message and responsibility ownership

| Lifecycle area | Lemon Squeezy / MoR | USD Impact |
| --- | --- | --- |
| Payment collection / checkout | Owns hosted payment collection and payment-method processing | Creates only trusted server-side purchase intent and hosted checkout request |
| Payment receipt / legal invoice | Owns financial receipt/invoice and MoR tax/VAT disclosures | Does not duplicate the financial receipt; may send separate access-ready communication |
| Tax / VAT | Calculates, collects and remits applicable transactional tax as MoR | Reconciles payout/accounting and maintains required Romanian business records |
| Successful purchase | Sends provider financial confirmation according to provider behavior | Sends access-ready message only after verified normalized payment and entitlement creation |
| Pending / failed payment | Owns payment-processing state and provider-side customer messaging | Does not imply purchase success; provides account/support context only if needed |
| Refund execution / financial refund notice | Processes/records provider refund and financial notice | Applies verified access transition and may communicate the access consequence |
| Partial refund | Provider records the financial state | USD Impact fails closed to reviewed/manual entitlement policy until explicitly approved |
| Dispute / chargeback processing | Primary operational owner as Merchant of Record | Does not invent unobservable dispute events; monitors authoritative final state and handles access/support consequences |
| Fraudulent / provider final revocation state | Exposes authoritative Order final state where available | Reconciliation revokes entitlement idempotently and records audit evidence |
| Dispute reversal | Provider owns the underlying MoR dispute process | No synthetic restoration is required when access was never revoked solely for an unobservable dispute; any restoration must be based on an authoritative compatible final state |
| Product/account access | No authority to grant USD Impact entitlement | Sole application authority after verified commercial state |
| Buyer product support | Escalates payment-specific matters according to MoR support boundary | Owns Library Pass account, access, content, privacy and product support |
| Privacy / deletion | Retains transaction records under its legal/MoR obligations | Owns USD Impact account/privacy/export/deletion flows and explains provider retention boundary |
| Incident escalation | Owns provider payment/MoR incidents | Owns application incident response, entitlement controls and customer-facing product/access communication |

## Required work before adapter registration

- implement durable Order reconciliation persistence/scheduling and idempotent final-state application;
- implement generic checkout and verified webhook routes coherently with the adapter;
- approve explicit partial-refund entitlement policy;
- create/configure the authorized Lemon Squeezy Test Mode Store/Product/Variant only in the controlled sandbox stage;
- add Test Mode credentials and webhook signing secret only to the approved non-Production environment;
- prove signature forgery, duplicate, replay, out-of-order, substitution, environment-isolation, price/currency/quantity mismatch and reconciliation cases;
- keep `REGISTERED_COMMERCE_ADAPTERS` empty until all of the above are reviewed together.

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

- Production payment secrets;
- public checkout;
- a Live provider transaction;
- real-card testing;
- Production `COMMERCE_PROVIDER` or `COMMERCE_MODE` changes;
- adapter registration before coherent route/reconciliation/sandbox proof;
- bypass of #343 or #54.

All payment testing must use Lemon Squeezy Test Mode until a separate controlled-Live approval is recorded.
