# Commerce provider technical qualification matrix — baseline 2026-08-25, eligibility updated 2026-08-26

## Purpose

This is a normalized decision aid for Issue #53. It compares the provider technical evidence already collected against the **same** USD Impact one-time Library Pass requirements.

**2026-08-26 eligibility update:** FastSpring has failed the written product-eligibility gate and is removed from the active implementation path. Its technical rows are retained as historical due-diligence evidence only. Lemon Squeezy and PayPro Global remain unselected candidates with open eligibility/technical gates. Stripe Managed Payments remains a separate policy-review fallback and is not silently promoted by FastSpring's rejection.

This matrix does **not** select a provider, change the application contract, authorize provider-specific implementation, create a provider account/product/secret/webhook, enable checkout, authorize a payment, or change entitlement/customer state.

Source evidence packs:

- `docs/operations/commerce-provider-responsibility-matrix.md` — provider-neutral contract plus historical FastSpring public technical prefill;
- `docs/operations/lemon-squeezy-commerce-technical-prefill-2026-08-25.md`;
- `docs/operations/paypro-global-commerce-technical-prefill-2026-08-25.md`;
- `docs/operations/commerce-provider-eligibility-update-2026-08-26.md` — current written eligibility state.

Issue #53 remains the authoritative tracker for current written eligibility/contact state.

## Status vocabulary

- **PASS — public technical evidence:** public provider documentation supports the required capability, subject to later sandbox proof and account-specific configuration.
- **PARTIAL:** useful provider capability exists, but the exact USD Impact canonical transition/security property still needs authoritative clarification or a reviewed design.
- **BLOCKED:** the reviewed evidence does not currently establish the required capability.
- **PENDING WRITTEN:** technical evidence cannot replace product/company/account-specific written approval or contractual allocation.
- **REJECTED / INELIGIBLE:** the provider supplied a written product-eligibility decision that closes the current product path. Technical capability does not override this gate.

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
| Written product/company eligibility for USD Impact | **REJECTED / INELIGIBLE** — case #01856172, written decision received 2026-08-25 22:33 UTC: disclosed product is not one FastSpring is licensed to process | **PENDING WRITTEN** — application review pending; store provisioning is not approval | **PENDING WRITTEN** — outreach/follow-up unanswered |
| Account-specific Merchant-of-Record/legal/tax responsibility allocation | **CLOSED WITH ELIGIBILITY FAILURE** — no implementation path under current product scope | **PENDING WRITTEN** | **PENDING WRITTEN** |
| Hosted/server-created checkout | **PASS — historical public technical evidence** | **PASS — public technical evidence** | **PASS — public technical evidence** |
| Server-authoritative product/price design can be enforced by USD Impact | **PASS — historical public technical evidence**, but not actionable after eligibility rejection | **PASS — public technical evidence** using approved server-selected variant/price; do not use client-controlled custom price | **PASS / design-constrained** — use fixed approved product/price and server-built checkout; do not trust dynamic client pricing |
| Exact raw-body cryptographic webhook verification | **PASS — historical public technical evidence** — HMAC-SHA256 over raw payload with `X-FS-Signature` | **PASS — public technical evidence** — HMAC-SHA256 over exact request body with `X-Signature` | **BLOCKED against current contract** — reviewed docs sign selected fields + validation key, not the exact raw POST body |
| Stable provider event/delivery identity for retry deduplication | **PARTIAL / strong historical evidence** — automatic retries retain event ID; manual resend gets a new event ID, so durable business-state dedup remains required | **BLOCKED / not documented in reviewed payload examples** | **BLOCKED / not documented as a separate immutable IPN event ID** |
| Retry/redelivery behavior documented | **PASS — historical public technical evidence** | **PASS — public technical evidence** | **PASS — public technical evidence** |
| Separate test/sandbox path | **PASS — historical public technical evidence** | **PASS — public technical evidence** | **PASS / PARTIAL** — test orders/webhooks documented; complete required event simulation still unproven |
| `checkout.pending` | **PASS / historical** — `order.payment.pending` | **PARTIAL** — server-created checkout/local pending state possible; no native one-time pending webhook identified | **PARTIAL** — `OrderOnWaiting` exists for review/non-instant payment but extended-webhook availability/design must be confirmed |
| `payment.completed` | **PASS / historical** — `order.completed` | **PASS — public technical evidence** — `order_created` after successful order | **PASS — public technical evidence** — `OrderCharged` |
| `payment.failed` | **PASS / historical** — `order.failed` | **BLOCKED** — failed test-card UX exists but no distinct one-time failure webhook in reviewed full event list | **PASS — public technical evidence** — `OrderDeclined` |
| `payment.cancelled` | **PASS / historical** — `order.canceled` | **BLOCKED** — no distinct one-time cancellation webhook identified | **PARTIAL / BLOCKED** — Canceled order API status exists, but no dedicated order-cancel webhook identified |
| `payment.expired` | **BLOCKED / historical unresolved gap** — no distinct expiry event/equivalent confirmed | **PARTIAL / BLOCKED** — checkout `expires_at` exists but no expiry webhook identified | **PARTIAL / BLOCKED** — checkout expiration exists but no dedicated expiry webhook identified |
| Full `refund.completed` | **PASS / historical** — `return.created` | **PASS — public technical evidence** — `order_refunded` | **PASS — public technical evidence** — `OrderRefunded` |
| Partial-refund semantics | **PARTIAL / historical** — must be handled without silently equating partial refund to full access reversal | **PARTIAL** — `order_refunded` can represent full or partial; entitlement policy required | **PASS for distinct event / policy still required** — `OrderPartiallyRefunded` is distinct from full refund |
| `dispute.opened` | **PARTIAL / historical** — `chargeback.created` represents chargeback initiation; broader dispute-warning semantics unresolved | **BLOCKED** — no dedicated one-time dispute event identified | **PARTIAL** — `OrderChargedBack` occurs when chargeback is received; whether this is the opening or later chargeback state needs clarification |
| `chargeback.completed` | **BLOCKED / historical unresolved gap** — `chargeback.created` is initiation, not clearly final lost outcome | **BLOCKED** — no dedicated final chargeback outcome event identified | **PARTIAL / plausible** — `OrderChargedBack` + Chargeback state exist, but final-vs-open semantics must be confirmed |
| `dispute.reversed` / eligible restoration | **BLOCKED / historical unresolved gap** — no native won-dispute/restoration event identified in reviewed docs | **BLOCKED** — no won-dispute/reversal event identified | **PARTIAL / strong** — `OrderChargedBackWon` exists; exact restoration criteria/sandbox proof still required |
| Complete deterministic test coverage for USD Impact lifecycle matrix | **NOT APPLICABLE — current product eligibility failed** | **BLOCKED pending proof** | **BLOCKED pending proof** |
| Current technical qualification | **INELIGIBLE FOR CURRENT PRODUCT — technical analysis retained only** | **NOT QUALIFIED YET** | **NOT QUALIFIED YET** |
| Current selection status | **REMOVED FROM ACTIVE PATH / NOT SELECTED** | **NOT SELECTED** | **NOT SELECTED** |

## FastSpring — historical technical profile, current path closed

FastSpring had the strongest reviewed combination of exact raw-body authenticity and several native one-time order events. That technical fit is now **non-actionable** because the written eligibility gate failed.

Written evidence controlling the current disposition:

- case #01856172;
- decision received 2026-08-25 22:33 UTC;
- bounded result: the disclosed product is not one FastSpring is licensed to process transactions for.

Therefore:

- do not send another eligibility follow-up under the current product scope;
- do not open/configure a seller path merely because the public APIs look compatible;
- do not register a FastSpring adapter or credentials;
- do not reinterpret the rejection as a technical gap that engineering can cure.

The prior technical blockers (`payment.expired`, generic dispute-open semantics, final/lost chargeback state, won-dispute/reversal, complete sandbox matrix) remain historical observations only.

## Lemon Squeezy — active candidate, written approval still absent

Clean raw-body HMAC signing, hosted/server-created checkout, bounded webhook retry behavior and clear Test/Live separation are useful technical foundations.

Main remaining technical blockers:

- sparse published one-time event lifecycle beyond successful order and refund;
- failed/cancelled/expired authoritative transitions;
- dispute/chargeback/reversal authoritative transitions;
- stable immutable webhook event/delivery identity in the reviewed public payload material;
- complete test matrix.

The store application is under review. Store/dashboard provisioning does **not** close product/company eligibility. No later affirmative eligibility message was present in the fresh 2026-08-26 mailbox check.

## PayPro Global — active candidate with security-contract mismatch

PayPro Global has the richest currently documented one-time lifecycle surface of the remaining normalized candidates: success, decline, full/partial refund, chargeback, chargeback-won and waiting events are publicly described.

Main remaining technical blockers:

- the reviewed signature model does **not** prove exact-raw-body cryptographic verification required by the existing contract;
- no separately documented immutable unique IPN event/delivery ID;
- cancellation and expiry authoritative transitions;
- distinction between dispute opening and final chargeback state;
- complete test matrix.

Fresh 2026-08-26 mailbox review found no PayPro Global response to the pre-clearance/follow-up messages.

Do not weaken `webhook.verify-raw-body` implicitly to make the provider fit. Any alternative field-signature design would require a separate security-reviewed, versioned contract change before adapter work.

## Stripe Managed Payments — separate fallback, not automatically promoted

Stripe is not normalized into the three-column baseline matrix above. Public Managed Payments material appears strong technically and for Merchant-of-Record responsibilities, but product-policy wording around cryptocurrency-related products creates a material eligibility ambiguity because the Library Pass includes educational Bitcoin curriculum.

FastSpring's rejection does not authorize Stripe implementation. Product-specific written clarification through an official qualifying route is still required before Stripe can enter the active implementation comparison.

## Current decision

**FASTSPRING REMOVED; NO TECHNICAL WINNER; NO PROVIDER SELECTED.**

The current evidence does not support selecting any remaining provider:

- FastSpring is closed as **ineligible for the current disclosed product**, regardless of its historical technical fit.
- Lemon Squeezy has strong signing/test foundations but product eligibility remains under review and its one-time lifecycle surface has unresolved canonical-state gaps.
- PayPro Global has strong one-time lifecycle breadth but the reviewed authenticity mechanism does not satisfy the current exact-raw-body contract, and written eligibility is absent.
- Stripe remains a fallback requiring product-policy written clarification before technical selection work.

The next meaningful provider event is an **affirmative written eligibility decision from a remaining provider**. Such a decision is necessary but not sufficient: technical closure and explicit owner selection still follow.

## Decision procedure when a remaining provider replies

For any affirmative provider reply:

1. preserve the written eligibility response privately and record only bounded evidence in Issue #53;
2. confirm the response explicitly covers SC Kela Leads SRL, USD Impact and the disclosed Library Pass product scope;
3. complete the account-specific Merchant-of-Record/legal/tax/refund/support/fees/reserve/payout/privacy responsibility rows;
4. resolve only the provider-specific technical questions that remain BLOCKED/PARTIAL in this matrix;
5. require an authoritative mechanism for every canonical lifecycle transition or a separately reviewed safe equivalent;
6. require adequate webhook authenticity, event/business idempotency and deterministic test coverage;
7. compare all affirmative candidates on the same matrix rather than selecting the first responder automatically;
8. record explicit owner approval before registering an adapter or configuring environment secrets;
9. keep Production `COMMERCE_MODE=disabled` until the later controlled gates authorize otherwise.

For a rejection, close that provider path; do not keep it classified as pending.

## Fail-closed rule

Until one remaining provider passes both **written eligibility/account responsibility** and **technical qualification**, USD Impact remains:

- `state=ready_for_provider_configuration`;
- `mode=disabled`;
- `provider=null`;
- `providerConfigured=false`;
- `checkoutEnabled=false`.

This matrix is decision support only and cannot activate commerce.
