# Commerce provider technical qualification matrix — 2026-08-25

## Purpose

This is a normalized decision aid for Issue #53. It compares the three active replacement-provider candidates against the **same** USD Impact one-time Library Pass requirements using evidence already recorded in the repository.

It does **not** select a provider, change the application contract, authorize provider-specific implementation, create a provider account/product/secret/webhook, enable checkout, authorize a payment, or change entitlement/customer state.

Source evidence packs:

- `docs/operations/commerce-provider-responsibility-matrix.md` — provider-neutral contract plus FastSpring public technical prefill;
- `docs/operations/lemon-squeezy-commerce-technical-prefill-2026-08-25.md`;
- `docs/operations/paypro-global-commerce-technical-prefill-2026-08-25.md`.

Issue #53 remains the authoritative tracker for current written eligibility/contact state.

## Status vocabulary

- **PASS — public technical evidence:** public provider documentation supports the required capability, subject to later sandbox proof and account-specific configuration.
- **PARTIAL:** useful provider capability exists, but the exact USD Impact canonical transition/security property still needs authoritative clarification or a reviewed design.
- **BLOCKED:** the reviewed evidence does not currently establish the required capability.
- **PENDING WRITTEN:** technical evidence cannot replace product/company/account-specific written approval or contractual allocation.

A technical PASS is never equivalent to product/company eligibility approval.

## Non-negotiable USD Impact contract

A selected adapter must continue to satisfy:

1. `checkout.create`
2. `webhook.verify-raw-body`
3. `event.normalize`
4. `payment.complete`
5. `refund.complete`
6. `dispute.open`
7. `chargeback.complete`
8. `dispute.reverse`

Canonical normalized events remain:

- `checkout.pending`
- `payment.completed`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `refund.completed`
- `dispute.opened`
- `chargeback.completed`
- `dispute.reversed`

No browser redirect, email, dashboard screenshot, client parameter or unverified provider state may grant or restore access.

## Normalized candidate matrix

| Qualification item | FastSpring | Lemon Squeezy | PayPro Global |
|---|---|---|---|
| Written product/company eligibility for USD Impact | **PENDING WRITTEN** — active Sales case awaiting response | **PENDING WRITTEN** — application review pending; store provisioning is not approval | **PENDING WRITTEN** — outreach/follow-up unanswered |
| Account-specific Merchant-of-Record/legal/tax responsibility allocation | **PENDING WRITTEN** | **PENDING WRITTEN** | **PENDING WRITTEN** |
| Hosted/server-created checkout | **PASS — public technical evidence** | **PASS — public technical evidence** | **PASS — public technical evidence** |
| Server-authoritative product/price design can be enforced by USD Impact | **PASS — public technical evidence**, subject to selected account/store setup | **PASS — public technical evidence** using approved server-selected variant/price; do not use client-controlled custom price | **PASS / design-constrained** — use fixed approved product/price and server-built checkout; do not trust dynamic client pricing |
| Exact raw-body cryptographic webhook verification | **PASS — public technical evidence** — HMAC-SHA256 over raw payload with `X-FS-Signature` | **PASS — public technical evidence** — HMAC-SHA256 over exact request body with `X-Signature` | **BLOCKED against current contract** — reviewed docs sign selected fields + validation key, not the exact raw POST body |
| Stable provider event/delivery identity for retry deduplication | **PARTIAL / strong** — automatic retries retain event ID; manual resend gets a new event ID, so durable business-state dedup remains required | **BLOCKED / not documented in reviewed payload examples** | **BLOCKED / not documented as a separate immutable IPN event ID** |
| Retry/redelivery behavior documented | **PASS — public technical evidence** | **PASS — public technical evidence** | **PASS — public technical evidence** |
| Separate test/sandbox path | **PASS — public technical evidence** | **PASS — public technical evidence** | **PASS / PARTIAL** — test orders/webhooks documented; complete required event simulation still unproven |
| `checkout.pending` | **PASS / sandbox proof required** — `order.payment.pending` | **PARTIAL** — server-created checkout/local pending state possible; no native one-time pending webhook identified | **PARTIAL** — `OrderOnWaiting` exists for review/non-instant payment but extended-webhook availability/design must be confirmed |
| `payment.completed` | **PASS — public technical evidence** — `order.completed` | **PASS — public technical evidence** — `order_created` after successful order | **PASS — public technical evidence** — `OrderCharged` |
| `payment.failed` | **PASS — public technical evidence** — `order.failed` | **BLOCKED** — failed test-card UX exists but no distinct one-time failure webhook in reviewed full event list | **PASS — public technical evidence** — `OrderDeclined` |
| `payment.cancelled` | **PASS — public technical evidence** — `order.canceled` | **BLOCKED** — no distinct one-time cancellation webhook identified | **PARTIAL / BLOCKED** — Canceled order API status exists, but no dedicated order-cancel webhook identified |
| `payment.expired` | **BLOCKED** — no distinct expiry event/equivalent confirmed | **PARTIAL / BLOCKED** — checkout `expires_at` exists but no expiry webhook identified | **PARTIAL / BLOCKED** — checkout expiration exists but no dedicated expiry webhook identified |
| Full `refund.completed` | **PASS — public technical evidence** — `return.created` | **PASS — public technical evidence** — `order_refunded` | **PASS — public technical evidence** — `OrderRefunded` |
| Partial-refund semantics | **PARTIAL** — must be confirmed/handled without silently equating partial refund to full access reversal | **PARTIAL** — `order_refunded` can represent full or partial; entitlement policy required | **PASS for distinct event / policy still required** — `OrderPartiallyRefunded` is distinct from full refund |
| `dispute.opened` | **PARTIAL** — `chargeback.created` represents chargeback initiation; broader dispute-warning semantics unresolved | **BLOCKED** — no dedicated one-time dispute event identified | **PARTIAL** — `OrderChargedBack` occurs when chargeback is received; whether this is the opening or later chargeback state needs clarification |
| `chargeback.completed` | **BLOCKED** — `chargeback.created` is initiation, not clearly final lost outcome | **BLOCKED** — no dedicated final chargeback outcome event identified | **PARTIAL / plausible** — `OrderChargedBack` + Chargeback state exist, but final-vs-open semantics must be confirmed |
| `dispute.reversed` / eligible restoration | **BLOCKED** — no native won-dispute/restoration event identified in reviewed docs | **BLOCKED** — no won-dispute/reversal event identified | **PARTIAL / strong** — `OrderChargedBackWon` exists; exact restoration criteria/sandbox proof still required |
| Complete deterministic test coverage for USD Impact lifecycle matrix | **BLOCKED pending proof** | **BLOCKED pending proof** | **BLOCKED pending proof** |
| Current technical qualification | **NOT QUALIFIED YET** | **NOT QUALIFIED YET** | **NOT QUALIFIED YET** |
| Current selection status | **NOT SELECTED** | **NOT SELECTED** | **NOT SELECTED** |

## What each candidate currently does best

### FastSpring

Best current fit for the existing **raw-body authenticity contract** while also documenting native pending/completed/failed/cancelled/refund events and useful event-ID retry semantics.

Main remaining technical blockers:

- `payment.expired`;
- generic dispute-open/warning semantics;
- final/lost chargeback outcome;
- won-dispute/reversal/restoration;
- complete sandbox matrix.

Written eligibility/Sales confirmation remains independently mandatory.

### Lemon Squeezy

Clean raw-body HMAC signing, hosted/server-created checkout, bounded webhook retry behavior and clear Test/Live separation.

Main remaining technical blockers:

- sparse published one-time event lifecycle beyond successful order and refund;
- failed/cancelled/expired authoritative transitions;
- dispute/chargeback/reversal authoritative transitions;
- stable immutable webhook event/delivery identity in the reviewed public payload material;
- complete test matrix.

Application/store approval, if later received, would not by itself close these technical gaps.

### PayPro Global

Richest currently documented one-time lifecycle surface of the three candidates: success, decline, full/partial refund, chargeback, chargeback-won and waiting events are publicly described.

Main remaining technical blockers:

- the reviewed signature model does **not** prove exact-raw-body cryptographic verification required by the existing contract;
- no separately documented immutable unique IPN event/delivery ID;
- cancellation and expiry authoritative transitions;
- distinction between dispute opening and final chargeback state;
- complete test matrix.

Do not weaken `webhook.verify-raw-body` implicitly to make the provider fit. Any alternative field-signature design would require a separate security-reviewed, versioned contract change before adapter work.

## Current decision

**NO TECHNICAL WINNER; NO PROVIDER SELECTED.**

The current evidence does not support selecting any provider solely from public documentation or store/account provisioning:

- FastSpring has the best current authenticity + broad-event balance, but still lacks required lifecycle closure and written eligibility.
- PayPro Global has the strongest documented one-time lifecycle breadth, but its reviewed authenticity mechanism does not satisfy the current exact-raw-body contract and written eligibility is absent.
- Lemon Squeezy has strong signing/test foundations, but its currently published one-time lifecycle event set leaves too many required states unresolved and written eligibility is still pending.

The first provider to receive affirmative written eligibility must still pass the **technical closure questions** in its evidence pack before explicit sandbox selection.

## Decision procedure when a provider replies

For any affirmative provider reply:

1. preserve the written eligibility response privately and record only bounded evidence in Issue #53;
2. confirm the response explicitly covers SC Kela Leads SRL, USD Impact and the disclosed Library Pass product scope;
3. complete the account-specific Merchant-of-Record/legal/tax/refund/support/fees/reserve/payout/privacy responsibility rows;
4. send or resolve only the provider-specific technical questions that remain BLOCKED/PARTIAL in this matrix;
5. require an authoritative mechanism for every canonical lifecycle transition or a separately reviewed safe equivalent;
6. require adequate webhook authenticity, event/business idempotency and deterministic test coverage;
7. compare all affirmative candidates on the same matrix rather than selecting the first responder automatically;
8. record explicit owner approval before registering an adapter or configuring environment secrets;
9. keep Production `COMMERCE_MODE=disabled` until the later controlled gates authorize otherwise.

## Fail-closed rule

Until one provider passes both **written eligibility/account responsibility** and **technical qualification**, USD Impact remains:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null`;
- `providerConfigured=false`;
- `checkoutEnabled=false`.

This matrix is decision support only and cannot activate commerce.
