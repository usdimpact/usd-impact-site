# USD Impact Commerce Provider Responsibility Matrix

## Status

Decision version: `2026-08-27.v7-administrative-gates-deferred`

Product: `Read the Dollar First Library Pass`  
Business entity: KELA LEADS S.R.L., Romania  
Selected provider: **Lemon Squeezy**  
Lifecycle profile: **`mor-final-state-reconciliation`**  
Production commerce state: **disabled / Lemon Squeezy adapter registered in code only / public checkout disabled**.

This matrix freezes the selected-provider responsibility and lifecycle-ownership decision required by Issues #53 and #130. The later code-only adapter registration does not configure Production secrets, apply a Production migration, authorize a Live purchase, or activate public checkout.

## Provider-selection state

- **Lemon Squeezy is selected** for the one-time Library Pass after affirmative written product/company approval on 2026-08-26 and explicit owner approval of the Merchant-of-Record final-state reconciliation architecture.
- Paddle is removed from the active path after its application decision.
- FastSpring is removed after written product-eligibility rejection received 2026-08-25 22:33 UTC in case #01856172.
- PayPro Global was not selected and received no qualifying reply before selection.
- Stripe Managed Payments remains fallback research only.
- `REGISTERED_COMMERCE_ADAPTERS` now contains only the reviewed Lemon Squeezy adapter on Draft PR #374; its configuration assessment remains fail closed.
- Production remains `ready_for_provider_configuration` with `COMMERCE_MODE=disabled`, `COMMERCE_PROVIDER` unset/null, and checkout disabled.

Provider selection is therefore complete; **activation is not**.

## Authenticated account launch-gate status — 2026-08-27

The current account-level evidence is recorded without publishing Live product/Variant identifiers, bank details, tax identifiers, identity documents, private email metadata or credentials:

- the Lemon Squeezy store is approved and active; identity verification, two-factor authentication and the payout bank connection are complete;
- the required customer-support contact is saved as `support@usd-impact.com`;
- the approved one-time Library Pass configuration has been copied to Live Mode with distinct USD 39 launch and USD 49 standard Variants, digital-goods tax categorization, licences disabled and storefront display disabled;
- no Live webhook is configured, and no Live checkout, payment or refund has been performed;
- the account still reports tax certification as action required, but its current enforcement notice says bank payouts pause only at €8,577,810 processed payment volume; W-8 completion remains required and pending accountant confirmation, but is not a present payment, payout, implementation or Preview blocker;
- the official ONRC company-document request remains in progress as corroborating evidence, but the certificate itself is not an implementation or Preview prerequisite; the mandatory boundary is accurate buyer-facing trader identification before public selling;
- W-8 completion and the ONRC evidence request are tracked for administrative completion before marketing starts, without guessing tax classifications or public company wording;
- before public selling, USD Impact must still expose the required verified trader information: legal name, geographic address, direct contact details, trade-register identity/registration number and VAT identifier where applicable;
- the controlled `support@usd-impact.com` inbound/reply continuity test remains intentionally deferred to the final launch window;
- Production remains `COMMERCE_MODE=disabled` with `COMMERCE_PROVIDER` unset, no provider secrets, no commerce migration and no public checkout.

The W-8 enforcement interpretation follows the current account notice and Stripe's documented volume-based enforcement model. The trader-information boundary follows Article 5 of Directive 2000/31/EC and Romanian Law 365/2002; neither source requires an ONRC certificate to be published, but the underlying verified identification information must be accessible.

## Contract v3 lifecycle boundary

Commerce contract version 3 supports two reviewed lifecycle profiles:

1. `direct-events` — requires direct authoritative dispute/chargeback/reversal events;
2. `mor-final-state-reconciliation` — requires authoritative order retrieval/reconciliation, final-state revocation, and documented Merchant-of-Record chargeback ownership.

Lemon Squeezy uses profile 2 because its documented one-time webhook surface exposes successful-order and refund events but not deterministic one-time dispute-opened, chargeback-completed or dispute-reversed events.

Lemon Squeezy Support (Arnab Bose) confirmed in writing on 2026-08-27 that Lemon Squeezy generally informs merchants by email when a dispute opens and manages the dispute directly as Merchant of Record. When Lemon Squeezy issues a refund to settle or prevent a chargeback, it dispatches an `order_refunded` webhook. Unresolved dispute notices, the stated $15 dispute fee and balance adjustments are exposed through email, dashboard and payout reports rather than a public API feed.

USD Impact must not invent unavailable events. Browser redirects, screenshots, email assertions, provider-dashboard observations, or client-provided order IDs never grant, revoke, or restore entitlement.

## Selected-provider responsibility table

| Responsibility | Lemon Squeezy / MoR | USD Impact residual responsibility | Release gate |
|---|---|---|---|
| Merchant of Record / legal seller for provider transaction | Primary | accurately disclose product/business and reconcile provider records | **SELECTED / PRE-LIVE** |
| Product-category acceptance | Written approval for disclosed Library Pass scope | do not expand approval to Research Membership/services without review | **PASS** |
| Romanian company onboarding | Supports merchant onboarding/payout subject to provider KYB/tax requirements | complete accurate KYB/tax/payout fields privately; current W-8 enforcement is volume-threshold based | **ADMIN / PRE-MARKETING — NOT CURRENT IMPLEMENTATION BLOCKER** |
| Sales tax / VAT at checkout | Primary MoR calculation/collection/remittance responsibility | Romanian accounting/payout reconciliation | **PASS + ACCOUNTING REVIEW** |
| Financial receipt / invoice | Primary provider financial document | do not send a duplicate financial receipt; access-ready communication stays separate | **PASS** |
| Checkout / payment collection | Hosted/provider payment surface | create only trusted server-side purchase intent + fixed Variant checkout | **IMPLEMENTING** |
| Card/processor fraud screening | Provider payment layer | account abuse controls, trusted intent and entitlement verification | **SHARED** |
| Buyer payment support | Primary for provider payment/MoR transaction issues | product/account/access support | **OWNERSHIP FROZEN** |
| Refund execution / financial refund notice | Primary provider financial state/notice | apply verified access consequence | **OWNERSHIP FROZEN** |
| Voluntary Library Pass refund policy | Provider executes supported refund | USD Impact policy is full-refund only; unexpected partial refund goes to review | **POLICY FROZEN** |
| Dispute / chargeback operations | Primary as Merchant of Record; generally emails the merchant when a dispute opens | monitor email, dashboard and payout reports; never mutate access from a notice alone; apply only authoritative supported state | **MoR RECONCILIATION + OPS MONITORING** |
| Dispute fees / balance adjustments | Reports unresolved disputes, the stated $15 dispute fee and balance adjustments through email, dashboard and payout reports rather than a public API | reconcile operational/financial records and escalate anomalies; these records are not direct entitlement authority | **MANUAL PRE-LIVE** |
| Fraudulent final order state | Exposes authoritative Order state | idempotently revoke entitlement using `payment.revoked` | **IMPLEMENTING** |
| Reversal / restoration | Provider owns underlying financial dispute process | no synthetic restoration; require authoritative compatible provider and local state | **FAIL CLOSED** |
| Entitlement grant | No direct application authority | sole authority after signed event + authoritative current Order checks | **APPLICATION OWNED** |
| Product/account access | No direct application authority | sole owner | **APPLICATION OWNED** |
| Privacy/export/deletion for USD Impact account | Provider retains its own legally required transaction records | own USD Impact account/privacy/export/deletion flows and disclose provider boundary | **PRE-LIVE REVIEW** |
| Incident escalation | Provider payment/MoR incident channel | application incident response, entitlement controls, customer product/access communication | **OWNERSHIP FROZEN** |
| Secret rotation | provider API/webhook credential mechanisms | environment-scoped secret management, overlap/cutover, rollback | **TEST-MODE PROOF COMPLETE / PRODUCTION PENDING** |
| Sandbox / Test Mode | separate Test Mode; reviewer explicitly required Test Mode and no real-card testing | complete deterministic matrix in non-Production only | **COMPLETE** |
| Public Live activation | provider Live capability only | verified buyer disclosures, #54/support/accounting/privacy/release approval before enabling; #343 remains optional/post-launch | **BLOCKED PENDING SEPARATE OWNER APPROVAL** |

## Customer-message ownership

| Lifecycle area | Provider financial message | USD Impact message |
|---|---|---|
| successful purchase | provider receipt/invoice | `purchase_access_ready` only after verified entitlement creation |
| pending / failed payment | provider-side processing/failure message where applicable | non-duplicative account/support context only |
| refund | financial refund notice | verified access consequence |
| dispute / chargeback | provider/MoR operational and financial process plus email/dashboard/payout reporting | no invented dispute state; monitor operational notices and communicate only verified product/access consequence |
| fraudulent final state | provider authoritative Order state | access-revocation/support message after durable application transition |
| restoration | provider underlying financial state | only after authoritative compatible state plus reviewed local state; never synthetic |
| product/account/privacy support | not application authority | USD Impact owns product, account, entitlement, privacy/export/deletion support |

Authentication, privacy, deletion, support, waitlist, and marketing messages remain governed by the existing email operations policy.

## Lemon Squeezy authoritative event/state matrix

| USD Impact behavior | Provider evidence | Application rule | Status |
|---|---|---|---|
| checkout pending | trusted local purchase intent + provider Test checkout | never grant from checkout creation/redirect | **IMPLEMENTED DRAFT** |
| `payment.completed` | signed `order_created` plus fresh authoritative Order + Order Items read | grant only if current status is `paid` and Store/Product/Variant/item-count/quantity/subtotal/discount/currency/account/intent all match | **IMPLEMENTED DRAFT** |
| payment pending/failed | authoritative Order `pending` / `failed` | never grant or restore | **IMPLEMENTED DRAFT** |
| `refund.completed` | signed `order_refunded`, including a provider refund used to settle or prevent a chargeback, or authoritative `refunded` reconciliation | full refund only; final refunded amount must match final Order total before idempotent refund access transition | **IMPLEMENTED DRAFT** |
| partial refund | authoritative `partial_refund` | explicit review; no automatic purchase/entitlement mutation | **POLICY + DRAFT IMPLEMENTATION** |
| `payment.revoked` | authoritative `fraudulent` Order state | idempotently revoke entitlement; do not fabricate chargeback state | **IMPLEMENTED DRAFT** |
| dispute opened | no deterministic one-time provider webhook reviewed; provider generally emails the merchant | open an operational review only; no synthetic local event and no provisional revocation solely from the notice | **MoR MODEL + OPS MONITORING** |
| chargeback completed | provider owns the MoR process; unresolved notices, fees and balance adjustments have no public API feed; a provider-issued refund emits `order_refunded` | use the verified webhook or authoritative supported final state only; email/dashboard/payout records may trigger incident review but are not direct DB authority | **MoR MODEL + OPS MONITORING** |
| dispute reversed | no deterministic one-time provider webhook reviewed | no synthetic reversal; no automatic restoration of terminal/incompatible local state | **MoR MODEL** |

## Written provider-support confirmation — 2026-08-27

The bounded support confirmation closes the open dispute-observability question without changing the approved lifecycle profile:

- process a valid `order_refunded` webhook and authoritative refunded Order state as the access-revocation signal when Lemon Squeezy issues a refund to settle or prevent a chargeback;
- monitor the merchant mailbox, Lemon Squeezy dashboard and payout reports for new/unresolved disputes, the stated $15 dispute fee and balance adjustments;
- treat email, dashboard and payout evidence as operational and accounting inputs only, never as direct entitlement or database authority;
- do not synthesize dispute-opened, chargeback-completed or dispute-reversed application events;
- do not auto-restore a terminal or incompatible local state without authoritative compatible provider evidence and reviewed local state.

No full provider message ID, private mail header, account credential, customer data or dashboard detail is recorded in this repository.

## Commercial invariant

The active Library Pass checkout must be server-authoritative:

- two distinct fixed-price Test Mode Variants: USD 39 launch / USD 49 standard;
- exactly one authoritative Order Item and quantity one;
- no browser `custom_price`;
- discount UI disabled and authoritative `discount_total=0`;
- trusted Order `subtotal` must match the durable purchase-intent base amount;
- Order currency must be USD;
- final provider `total` is retained separately and may include tax;
- Store/Product/Variant/item-count/quantity/subtotal/discount/currency mismatch fails closed.

## Adapter-registration decision — complete 2026-08-27

The Development/Test registration gate is complete: canonical Development migrations, Test Mode product mapping, non-Production credentials, paid and duplicate-delivery evidence, automatic negative cases, rolled-back lifecycle probes, database/advisor review, exact-head protected CI and exact-tree Preview verification were reviewed coherently.

The registry may contain only Lemon Squeezy in this Draft PR. Its configuration assessment remains fail closed, and registration does not authorize a Production mode/provider value, secret, webhook, checkout, transaction, refund, merge or Production database change.

## Historical candidate evidence

FastSpring/PayPro/Stripe/Paddle technical records remain historical due diligence. They are not active implementation paths and must not be used to override the selected-provider state.

## Evidence handling

Record provider decisions using links, document titles, dates, case/reference numbers, and bounded summaries. Do not commit API keys, dashboard passwords, bank details, identity documents, recovery codes, webhook secrets, full provider message IDs, or customer data.

Related controls:

- Issue #53 — provider selection / commerce implementation;
- Issue #130 — customer-message ownership;
- Issue #343 — optional post-launch independent security assurance, not a launch gate;
- Issue #54 — final integrated launch gate;
- `docs/operations/commerce-provider-eligibility-update-2026-08-26.md`;
- `docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md`;
- `docs/operations/lemon-squeezy-sandbox-runtime-2026-08-26.md`;
- `docs/operations/commerce-provider-readiness.md`.
