# Lemon Squeezy Technical Qualification — 2026-08-26

## Decision state

**Product/company eligibility: APPROVED IN WRITING.**

On 2026-08-26 at 11:03 UTC, Lemon Squeezy reviewer Tanay Khemka confirmed on the existing application thread that the USD Impact account had been approved, that the disclosed products meet Lemon Squeezy's Terms of Service, and that the Merchant-of-Record risk profile is low enough to allow sales through Lemon Squeezy.

The approved disclosed launch scope is intentionally narrow:

- product: **Read the Dollar First Library Pass**;
- billing: **single payment / not a subscription**;
- planned price: **USD 39 limited-launch / USD 49 standard**;
- delivery: standardized digital account access with no customization or manual order fulfillment;
- included: Guided Interactive Edition, chapter learning, quizzes/progress, protected references, complete English audiobook, and 51-film educational video library;
- excluded from this approval scope: recurring Research Membership, personalized advice, signals, coaching, managed portfolios, brokerage/exchange/custody/lending, private trading groups, physical goods, and custom reports.

The reviewer explicitly instructed USD Impact to use Lemon Squeezy **Test Mode** for test purchases and not to use a real card.

**Provider selection remains NOT YET FINAL. Public checkout remains disabled.** This document qualifies the approved provider against the existing provider-neutral contract and identifies the one remaining lifecycle-contract exception that must be resolved before adapter registration.

## Source set reviewed

Official Lemon Squeezy documentation reviewed on 2026-08-26:

- Store activation / product eligibility: https://docs.lemonsqueezy.com/help/getting-started/activate-your-store
- Test Mode: https://docs.lemonsqueezy.com/help/getting-started/test-mode
- Developer testing/go-live: https://docs.lemonsqueezy.com/guides/developer-guide/testing-going-live
- Taking payments: https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- Create checkout API: https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- Passing custom data: https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
- Webhooks: https://docs.lemonsqueezy.com/help/webhooks
- Webhook requests/retries: https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
- Webhook signing: https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- Webhook event types: https://docs.lemonsqueezy.com/help/webhooks/event-types
- Simulate webhooks: https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events
- Order object: https://docs.lemonsqueezy.com/api/orders/the-order-object
- Retrieve order: https://docs.lemonsqueezy.com/api/orders/retrieve-order
- Refund API: https://docs.lemonsqueezy.com/api/orders/issue-refund
- Refunds/chargebacks: https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks
- Merchant of Record: https://docs.lemonsqueezy.com/help/payments/merchant-of-record
- Sales tax/VAT: https://docs.lemonsqueezy.com/help/payments/sales-tax-vat
- Fees: https://docs.lemonsqueezy.com/help/getting-started/fees
- Getting paid: https://docs.lemonsqueezy.com/help/getting-started/getting-paid
- Supported countries: https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- W-8/W-9: https://docs.lemonsqueezy.com/help/tax-forms/w8-w9-forms
- DPA: https://www.lemonsqueezy.com/dpa
- Privacy: https://www.lemonsqueezy.com/privacy
- Affiliates: https://docs.lemonsqueezy.com/help/affiliates-for-merchants

## Qualification matrix

| Gate | Finding | Status |
| --- | --- | --- |
| Written product/company eligibility | Human reviewer approved the disclosed USD Impact account/product scope on 2026-08-26 11:03 UTC. | **PASS** |
| Romania support | Romania is listed as a supported merchant payout country. | **PASS** |
| Non-US tax onboarding | Non-US merchants must complete a W-8; payouts may be disabled until tax information is complete. | **PASS / MANUAL ONBOARDING REQUIRED** |
| Merchant of Record | Lemon Squeezy is the legal seller to the end customer and states it handles payment liability, sales tax/VAT, refunds/chargebacks and PCI responsibilities. | **PASS** |
| One-time digital product | Single-payment digital products are natively supported. | **PASS** |
| Hosted/tokenized checkout | Hosted checkout and checkout overlay are supported; API-created checkout is available for a specific Store + Variant. USD Impact need not handle raw card data. | **PASS** |
| Server-authoritative product/variant | Checkout API requires a specific variant relationship. USD Impact can keep the approved variant ID and expected amount/currency on the server. | **PASS** |
| Trusted account/purchase-intent linking | Checkout custom data is returned in Order webhooks. Use opaque local account/purchase-intent identifiers only; do not trust browser redirect state. | **PASS** |
| Raw-body webhook verification | Lemon Squeezy signs the exact payload using HMAC-SHA256 and sends the hex digest in `X-Signature`. Official Node examples use the raw request body and timing-safe comparison. | **PASS** |
| Webhook retries | Non-200 responses are retried up to three additional times using exponential backoff. Recent events can also be resent from the dashboard. | **PASS** |
| Test/Live isolation | Test Mode has separate products, purchases, API keys and webhooks; test webhooks only receive test data and vice versa. | **PASS** |
| Test payment safety | Lemon Squeezy provides test cards and explicitly warns against real-card testing. | **PASS** |
| Completed payment event | `order_created` is sent when a new order is successfully placed. Order object includes product/variant, price, quantity, totals, currency, status and test-mode state. | **PASS** |
| Refund lifecycle | `order_refunded` covers full/partial refunds; API can issue full or partial refunds. | **PASS** |
| Failed/pending order state | Order API exposes `pending`, `failed`, `paid`, `refunded`, `partial_refund`, and `fraudulent` states, but single-payment webhook docs do not advertise a failed/pending order webhook. | **PARTIAL — RECONCILIATION REQUIRED** |
| Cancelled/expired checkout events | No documented one-time-payment webhook maps directly to `payment.cancelled` or `payment.expired`. | **GAP / CANONICAL MODEL REVIEW REQUIRED** |
| Dispute/chargeback webhooks | Lemon Squeezy documents MoR handling of chargebacks, but its published webhook event list does not expose single-payment dispute-opened, chargeback-completed or dispute-reversed events. | **P0 GAP / SECURITY-EQUIVALENT CONTRACT REQUIRED** |
| Refund responsibility | Seller may issue refunds; Lemon Squeezy reserves the right to issue refunds within 60 days to prevent chargebacks. | **PASS WITH POLICY ALIGNMENT** |
| Chargeback responsibility | Lemon Squeezy generally handles chargebacks and may deduct the refund impact plus a documented dispute fee from seller payout. | **PASS OPERATIONALLY; EVENT GAP REMAINS** |
| Fees | Published standard fee is $0.50 + 5% of total order value, with documented additional fees including +1.5% international and +1.5% PayPal; subscriptions add +0.5% but are outside this initial launch. | **PASS / COST ACCEPTANCE REQUIRED AT SELECTION** |
| Payout schedule | Payouts created twice monthly; net sales held 13 days; bank arrival generally 1-5 days; $50 minimum threshold. | **PASS** |
| Payout fees | Published bank payout fee is 1% outside the US; exact settlement/conversion effect depends on payout method/currency. | **PASS / ACCOUNTING CONFIG REQUIRED** |
| Tax/VAT | Lemon Squeezy states that as MoR it calculates/collects/remits sales tax/VAT. USD Impact must still account for payout income in Romania. | **PASS / ACCOUNTANT REVIEW REQUIRED** |
| Privacy/DPA | Public DPA addresses GDPR controller/processor obligations, security, data-subject assistance, deletion, audit rights and international transfer safeguards. | **PASS, SUBJECT TO USD IMPACT PRIVACY MAPPING** |
| Affiliate capability | Native affiliates support manual approval, product inclusion, percentage/flat commissions, configurable attribution, referral review/rejection and automatic voiding after refunds. Merchant affiliate fee is published separately. | **STRONG OPTIONAL GROWTH FIT** |
| Future subscription capability | Subscriptions and subscription webhooks exist, but Research Membership was explicitly excluded from the approved launch scope. | **TECHNICALLY AVAILABLE / NOT AUTHORIZED FOR CURRENT LAUNCH** |

## Required implementation contract

### 1. Product and price authority

Create exactly one Lemon Squeezy **Test Mode** product representing the approved Library Pass scope. Use one server-approved single-payment variant for the active price. Do not use pay-what-you-want or customer-supplied quantity.

The application must maintain an allowlist mapping:

- USD Impact canonical product ID -> Lemon Squeezy product ID;
- approved launch/standard price state -> Lemon Squeezy variant ID;
- expected currency and amount -> server-side validation rule.

Do not accept `custom_price` from browser input. If the API supports custom pricing, that capability remains disabled unless a later reviewed promotion design explicitly requires it.

### 2. Checkout creation

`createCheckout` should execute server-side only after an authenticated USD Impact account creates a trusted purchase intent.

Required outbound checkout data:

- fixed Store ID from environment/config;
- fixed approved Variant ID from server-side mapping;
- customer email/name when appropriate;
- minimal `checkout_data.custom` containing opaque trusted account and purchase-intent references;
- receipt/redirect link may point back to the USD Impact account, but the redirect is **informational only** and must never grant entitlement.

### 3. Webhook authenticity and receipt

The webhook handler must:

1. read and retain the exact raw request body before JSON parsing;
2. read `X-Signature`;
3. compute HMAC-SHA256 using the environment-scoped Lemon Squeezy signing secret;
4. compare expected vs received signature using a timing-safe comparison and fixed encoding;
5. reject missing, malformed or mismatched signatures before parsing or mutation;
6. persist a bounded immutable webhook receipt/event identifier before asynchronous processing;
7. return 200 only once capture is durable enough to survive processing failure;
8. deduplicate replayed/resend events before purchase/entitlement mutation.

Test and Production webhook secrets must be distinct and environment-scoped.

### 4. `order_created` normalization

Treat `order_created` as `payment.completed` **only if every invariant passes**:

- webhook signature is valid;
- event is from the expected Test/Live environment;
- order status is `paid`;
- product ID and variant ID match the approved allowlist;
- quantity is exactly one;
- amount/currency match the trusted purchase intent and approved server-side price rule;
- trusted account ID and purchase-intent ID are present in `meta.custom_data` and resolve to existing compatible records;
- provider order/transaction identifier is new or maps idempotently to the same local purchase;
- no conflicting account, product, price or transaction ownership exists.

A browser success event, redirect, email receipt or client-provided order ID is never payment authority.

### 5. Refund normalization

`order_refunded` must be normalized from the order's refund amount/status and applied idempotently. Full vs partial refund behavior must be explicit. For the permanent Library Pass, the release policy should decide whether any partial refund is permitted; if partial refunds are not part of the published product policy, the application should fail closed and route unexpected partial refund states for review rather than silently guessing entitlement behavior.

### 6. Lifecycle exception — must close before adapter registration

The current USD Impact adapter contract requires canonical coverage for:

- `payment.failed`;
- `payment.cancelled`;
- `payment.expired`;
- `dispute.opened`;
- `chargeback.completed`;
- `dispute.reversed`.

Lemon Squeezy's documented one-time-payment webhook list does not directly publish those events. The Order API does expose `pending`, `failed`, `paid`, `refunded`, `partial_refund`, and `fraudulent` states, which can support reconciliation for some payment states, but that does not by itself prove deterministic dispute/chargeback/reversal transitions.

Before registering a Lemon Squeezy adapter, choose and review one of these paths:

**Preferred path A — obtain provider clarification:** ask Lemon Squeezy support for the authoritative machine-readable mechanism (webhook, API state, export, or support notification contract) for single-payment disputes, chargebacks and reversals.

**Path B — explicitly amend the canonical contract:** if Lemon Squeezy confirms it does not expose those lifecycle transitions programmatically, revise `commerce-provider-readiness.md` so that dispute/chargeback coverage may be satisfied by a reviewed MoR-managed security-equivalent contract plus reconciliation/manual incident controls. This must be an explicit architecture decision, not an adapter-specific bypass.

Until A or B is approved, status is **ELIGIBILITY APPROVED / TECHNICAL QUALIFICATION IN PROGRESS / ADAPTER NOT YET REGISTERED**.

## Sandbox matrix once lifecycle exception is closed

Use Lemon Squeezy Test Mode only.

Required automated/controlled cases:

1. valid checkout creation for trusted signed-in account;
2. wrong product rejected;
3. wrong variant rejected;
4. quantity != 1 rejected;
5. amount mismatch rejected;
6. currency mismatch rejected;
7. missing account/purchase-intent custom data rejected;
8. foreign account/purchase-intent substitution rejected;
9. invalid signature rejected;
10. missing signature rejected;
11. raw-body mutation rejected;
12. duplicate `order_created` is idempotent;
13. webhook resend is idempotent;
14. out-of-order refund before local payment processing fails closed and is reconciled safely;
15. successful paid `order_created` creates exactly one durable purchase and exactly one permanent Library Pass entitlement;
16. full `order_refunded` produces exactly the reviewed access transition;
17. partial refund follows explicit policy rather than guessing;
18. failed/pending/fraudulent order reconciliation cannot grant entitlement;
19. Test event cannot mutate Production records;
20. Production event cannot be accepted by Test configuration;
21. browser redirect cannot grant access;
22. API/checkout error cannot leave an entitlement-bearing local state;
23. webhook processing failure after durable capture can be replayed safely;
24. secret rotation supports overlap/controlled cutover without accepting an unbounded old secret;
25. provider disable/rollback immediately blocks new checkout creation while preserving historical purchase evidence.

No real card may be used during this matrix.

## Operational and accounting notes

- Romania is supported for payouts.
- Complete required non-US tax onboarding in the authenticated dashboard; do not commit tax-form contents.
- Configure payout details only in the authenticated Lemon Squeezy interface.
- Record the effective store fee plan shown in the account before Live approval; public pricing docs are the baseline, but account-specific terms control if different.
- Align USD Impact's 14-day refund policy with Lemon Squeezy's ability to issue refunds within 60 days to prevent chargebacks. This does not require changing the customer-facing voluntary refund window, but Terms/Refund wording should acknowledge MoR/payment-provider rights where appropriate.
- The accountant should confirm Romanian treatment of Lemon Squeezy reverse invoices/payout income and any W-8-related classification before Live activation.

## Privacy/data-minimization notes

Only send checkout data required for transaction and account linkage. Do not place health, investment holdings, trading behavior, government IDs or other unnecessary profile data into Lemon Squeezy custom fields.

Before Live activation:

- update the USD Impact Privacy Notice's payment-provider/MoR disclosure if not already generic enough;
- record Lemon Squeezy's DPA and international-transfer basis in the privacy register;
- document customer data deletion/export boundaries between Lemon Squeezy transaction records and USD Impact account records;
- preserve transaction/audit records only for the applicable legal, accounting, fraud and dispute retention basis.

## Growth fit — not part of core activation

Lemon Squeezy's affiliate system is a strong fit for the later Partner Program because it supports:

- Lemon Squeezy vetting of affiliate applicants before they can join programs;
- merchant-side manual acceptance/rejection when auto-approval is disabled;
- product-level affiliate eligibility and commission overrides;
- configurable tracking length and first/last attribution;
- percentage or flat commission;
- manual referral review/rejection;
- referral state that becomes void after the underlying order is refunded;
- native affiliate payout handling.

Published merchant affiliate fee is +3% on referred orders. Affiliate activation remains a separate later release and is not permission to add tracking scripts or change checkout behavior during the core commerce integration.

## Selection recommendation

**Recommendation: Lemon Squeezy should become the preferred replacement-provider candidate, conditional on closing the one-time dispute/chargeback/reversal machine-readable lifecycle question.**

Why:

- product/company eligibility is now explicit and written;
- Romanian merchant payout support is documented;
- MoR/tax/refund/chargeback allocation is substantially clear;
- checkout can remain provider-hosted and server-created;
- raw-body webhook verification matches the project's security contract;
- custom metadata can bind trusted local account/purchase intent to provider orders;
- Test/Live isolation supports the existing staged release process;
- first-party affiliate tooling is materially stronger than required for the initial launch and useful later;
- the remaining gap is narrow and identifiable rather than a general incompatibility.

Do **not** register or activate the adapter until Issue #53 records the lifecycle decision and explicit provider selection.

## Current release boundary

- `COMMERCE_MODE=disabled` remains unchanged.
- `COMMERCE_PROVIDER` remains unset/null.
- no Lemon Squeezy API key or webhook secret should be added to Production yet.
- no public checkout entry is authorized.
- no Live transaction is authorized by this qualification.
- next technical step is provider clarification or canonical-contract decision for dispute/chargeback/reversal coverage, then explicit provider selection and coherent adapter implementation in Test Mode.
