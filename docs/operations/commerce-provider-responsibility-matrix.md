# USD Impact Commerce Provider Responsibility Matrix

## Status

Decision-support version: `2026-08-21.v2`

Product: `Read the Dollar First Library Pass`

Business entity: SC Kela Leads SRL, Romania

Current commerce state: **provider-neutral / checkout disabled**.

This document prepares the provider-selection and lifecycle-ownership decision required by Issue #53. It does not select a provider, register an adapter, create an account, configure a secret, activate checkout, authorize a Production purchase, or change customer/entitlement state.

## Current provider-selection state

- Paddle is removed from the active release path.
- FastSpring is the current primary Merchant-of-Record candidate.
- FastSpring Seller Support routed the product/company eligibility questions to Sales; written Sales pre-clearance is pending.
- No provider is selected.
- No commerce adapter is registered.
- Production reports `ready_for_provider_configuration` with commerce mode `disabled` and checkout disabled.

A provider may move from candidate to selected only after the evidence fields below are completed from authoritative provider documentation and, where required, a written provider response.

## Non-negotiable application contract

Every selected adapter must satisfy the canonical commerce capabilities already enforced by the application:

1. `checkout.create`
2. `webhook.verify-raw-body`
3. `event.normalize`
4. `payment.complete`
5. `refund.complete`
6. `dispute.open`
7. `chargeback.complete`
8. `dispute.reverse`

The provider must support normalization into the canonical USD Impact event set:

- `checkout.pending`
- `payment.completed`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `refund.completed`
- `dispute.opened`
- `chargeback.completed`
- `dispute.reversed`

Browser redirects, screenshots, email assertions, or unverified provider state never grant access. Entitlement changes require verified server-side commercial events.

## Responsibility decision table

Complete every row before provider selection. Use `provider`, `USD Impact`, `shared`, or `not applicable` only after the responsibility is supported by provider evidence.

| Responsibility | Required evidence | Provider answer | USD Impact residual responsibility | Gate |
|---|---|---|---|---|
| Merchant of Record / seller of record | written contractual/product eligibility statement | pending | pending | BLOCKED |
| Product-category acceptance | written confirmation covering macro-finance education and educational Bitcoin content | pending | disclose curriculum accurately; maintain compliance boundaries | BLOCKED |
| Romanian company onboarding | required entity, UBO, tax, banking, and verification documents | pending | supply accurate company records | BLOCKED |
| Sales tax / VAT calculation | contractual tax responsibility by buyer jurisdiction | pending | accounting reconciliation | BLOCKED |
| Tax registration / filing / remittance | contractual allocation of filing/remittance responsibility | pending | any explicitly retained local obligations | BLOCKED |
| Customer invoice / receipt | sample/documentation and legal issuer identity | pending | account/access communication remains separate | BLOCKED |
| Checkout hosting / payment collection | hosted or tokenized checkout documentation | pending | server-authoritative product/price/purchase-intent creation | BLOCKED |
| Fraud screening | provider documentation and allocation of loss/risk | pending | application abuse controls and entitlement verification | BLOCKED |
| Buyer-facing payment support | support terms and escalation path | pending | USD Impact product/account/access support | BLOCKED |
| Refund initiation | API/dashboard/customer-support pathways and authority | pending | enforce USD Impact refund policy where retained | BLOCKED |
| Refund approval / execution | who decides, who executes, provider-initiated behavior | pending | verified refund event drives access revocation | BLOCKED |
| Dispute warning / early alert | exact event or API evidence | pending | customer/access warning after verified event | BLOCKED |
| Chargeback handling | provider responsibilities, fees, evidence process | pending | verified chargeback event drives access revocation | BLOCKED |
| Won dispute / reversal | exact reversal event and restoration criteria | pending | restore access only after eligible verified reversal | BLOCKED |
| Reserves / rolling hold | written reserve policy or confirmation none applies | pending | cash-flow planning | BLOCKED |
| Fees | complete fixed/percentage/currency/cross-border/refund/dispute fees | pending | accounting reconciliation | BLOCKED |
| Settlement | payout country, currency, cadence, threshold, banking route | pending | reconcile provider settlement to company books | BLOCKED |
| Data processing / DPA | DPA, subprocessors, data locations, retention/export terms | pending | maintain USD Impact privacy/account records | BLOCKED |
| Incident escalation | provider support channel, severity route, status page | pending | USD Impact incident ownership and customer communication | BLOCKED |
| Secret rotation | documented API/webhook secret rotation procedure | pending | environment-scoped secret management and rollback | BLOCKED |
| Sandbox / test mode | test-account and event-simulation documentation | pending | complete required sandbox matrix | BLOCKED |
| Live-domain review | production-domain/business review requirements | pending | complete release gate before activation | BLOCKED |

## Customer-message ownership after verified commercial events

Provider receipts do not replace USD Impact account, entitlement, privacy, support, or exceptional-state messages. Current source policy establishes these boundaries:

| USD Impact message | Classification | Provider boundary | Required selection decision |
|---|---|---|---|
| `purchase_pending` | transactional operational | shared after provider selection | determine whether provider sends payment-processing receipt/status; USD Impact sends only non-duplicative account/access context it owns |
| `purchase_access_ready` | transactional | application-owned after verified event | USD Impact owns access-ready communication after trusted payment + entitlement state |
| `purchase_failed` | transactional operational | shared after provider selection | determine provider payment-failure messaging and define non-duplicative USD Impact support/access message if needed |
| `refund_approved` | transactional | application-owned after verified event | USD Impact communicates verified refund/access consequence; provider may separately issue financial receipt |
| `dispute_warning` | transactional operational | application-owned after verified event | USD Impact owns account/access warning after trusted dispute event |
| `chargeback_revoked` | transactional | application-owned after verified event | USD Impact owns access-revocation communication after trusted chargeback event |
| `dispute_reversal_restored` | transactional | application-owned after verified event | USD Impact owns eligible access-restoration communication after trusted reversal event |

Required authentication, privacy, deletion, support, waitlist, and marketing paths remain governed by the existing email operations policy and are not delegated merely by selecting a commerce provider.

## Webhook and event evidence matrix

For each candidate, complete this table from authoritative technical documentation before adapter work starts.

| Canonical USD Impact event | Provider event(s) | Raw-body signature verified? | Stable event ID? | Transaction/order ID? | Sandbox simulation? | Retry / redelivery behavior | Evidence status |
|---|---|---:|---:|---:|---:|---|---|
| `checkout.pending` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `payment.completed` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `payment.failed` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `payment.cancelled` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `payment.expired` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `refund.completed` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `dispute.opened` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `chargeback.completed` | pending | pending | pending | pending | pending | pending | BLOCKED |
| `dispute.reversed` | pending | pending | pending | pending | pending | pending | BLOCKED |

A missing native provider event does not permit inference from a redirect or email. The adapter design must identify an authoritative API/event mechanism or the provider fails the required capability gate.

## FastSpring public technical evidence prefill — 2026-08-21

This section records what current FastSpring public developer documentation supports before the written Sales eligibility response arrives. It is **technical evidence only** and does not select FastSpring.

### Confirmed from public FastSpring documentation

- Webhook authenticity can use an HMAC-SHA256 secret. FastSpring computes the digest over the webhook payload, Base64-encodes it, and sends it in `X-FS-Signature`; their Node/Express examples explicitly validate the raw body before JSON parsing.
- FastSpring advises duplicate-safe webhook handlers. Automatic retries keep the same event ID, while manual resends generate a new event ID, so USD Impact must deduplicate at both provider-event and durable business-state levels.
- Failed webhook delivery is retried for up to seven days. Current documentation describes up to 12 retries: 1h, 2h, 4h, then 6h intervals during the first day, followed by daily retries. Permanently failed events remain recoverable through the webhook log or events API.
- Webhooks can be configured for live orders, test orders, or both.
- FastSpring provides Test mode/test orders and supports server-created sessions with `live: false`.
- `order.payment.pending` is a documented pending-payment event.
- `order.completed` is documented for successful orders after payment succeeds and fulfillment completes.
- `order.failed` is documented for failed payment attempts.
- `order.canceled` is documented for canceled orders.
- `return.created` is documented when a refund/return has been issued.
- `chargeback.created` is documented when a buyer's bank/card issuer initiates a chargeback and includes an order reference plus processor case metadata.
- FastSpring states that it acts as Merchant of Record in its chargeback/dispute documentation, but product/company eligibility and the exact commercial allocation still require the pending written Sales response.

### Provisional canonical mapping

| USD Impact canonical event | FastSpring public event/evidence | Current technical disposition |
|---|---|---|
| `checkout.pending` | `order.payment.pending` | plausible documented mapping; sandbox proof still required |
| `payment.completed` | `order.completed` | documented mapping; sandbox proof still required |
| `payment.failed` | `order.failed` | documented mapping; sandbox proof still required |
| `payment.cancelled` | `order.canceled` | documented mapping; sandbox proof still required |
| `payment.expired` | no distinct order-expiry webhook found in reviewed public order-event documentation | **BLOCKED pending authoritative equivalent** |
| `refund.completed` | `return.created` | documented mapping for issued refunds/returns; sandbox proof still required |
| `dispute.opened` | `chargeback.created` covers chargeback initiation; public material also describes PayPal disputes operationally | **PARTIAL** — generic dispute-warning semantics need confirmation |
| `chargeback.completed` | `chargeback.created` fires at initiation, not clearly at final lost-dispute outcome | **BLOCKED pending final-outcome mechanism** |
| `dispute.reversed` | no native won-dispute/restoration webhook found in the reviewed public event catalog | **BLOCKED pending authoritative equivalent** |

The three blocked/partial rows above are selection-critical. A Sales or technical response may close them by naming a documented webhook, API status transition, or another authoritative server-side mechanism. A browser redirect, customer email, or assumption about provider workflow is not an acceptable substitute.

### Official FastSpring references reviewed

- Message Security — `https://developer.fastspring.com/reference/message-security`
- Webhooks Overview — `https://developer.fastspring.com/reference/webhooks-overview`
- Processed and unprocessed webhook events — `https://developer.fastspring.com/reference/processed-and-unprocessed-webhook-events`
- Order Related Webhooks — `https://developer.fastspring.com/reference/orders-1`
- Successful Orders / `order.completed` — `https://developer.fastspring.com/reference/ordercompleted`
- Unsuccessful Orders / `order.failed` — `https://developer.fastspring.com/reference/orderfailed`
- Canceled Orders / `order.canceled` — `https://developer.fastspring.com/reference/ordercanceled`
- Return or Refund an Order / `return.created` — `https://developer.fastspring.com/reference/returncreated`
- Order Chargeback / `chargeback.created` — `https://developer.fastspring.com/reference/order-chargeback`
- Chargebacks and disputes — `https://developer.fastspring.com/docs/chargebacks-and-disputes`
- Test orders — `https://developer.fastspring.com/docs/test-orders`
- Activate your store — `https://developer.fastspring.com/docs/activate-your-store`
- Create session — `https://developer.fastspring.com/reference/createsession`

## FastSpring pending-answer checklist

The Sales/pre-clearance response should be recorded here without copying credentials or unnecessary personal data.

- [ ] Product/company eligibility confirmed in writing.
- [ ] Educational Bitcoin content explicitly accepted within the disclosed product boundaries.
- [ ] Merchant-of-Record responsibilities confirmed contractually for this seller/product.
- [ ] Romanian entity/settlement requirements confirmed.
- [ ] Fees, reserve, payout, refund, dispute, and chargeback terms confirmed.
- [ ] Provider-initiated refund behavior confirmed.
- [ ] Buyer-support escalation behavior confirmed.
- [x] Public docs confirm hosted/test checkout and server-created session support; account-specific setup remains pending.
- [x] Public docs confirm raw-body HMAC-SHA256 webhook signature procedure.
- [x] Public docs confirm bounded webhook retry/redelivery behavior and event-ID retry semantics.
- [ ] Pending/completed/failed/cancelled/expired canonical coverage confirmed end-to-end; `payment.expired` remains unresolved.
- [x] Public docs confirm full-refund/return event coverage via `return.created`; sandbox proof remains pending.
- [ ] Dispute-warning/opened event coverage confirmed beyond chargeback initiation.
- [ ] Chargeback final/lost-dispute event coverage confirmed.
- [ ] Eligible won-dispute/reversal event coverage confirmed.
- [ ] Sandbox/test simulation coverage confirmed for the complete USD Impact lifecycle matrix.
- [ ] DPA/subprocessor/data-retention/export terms reviewed.
- [ ] Live review, secret rotation, rollback, and incident paths reviewed.

## Selection gate

A provider may be marked **selected for sandbox implementation** only when all of the following are true:

1. product/company eligibility is affirmative and documented;
2. legal/tax/Merchant-of-Record responsibilities are explicit;
3. fees, reserves, payout, refund, dispute, and support obligations are acceptable to the business owner;
4. all required canonical events have an authoritative provider source or a documented safe equivalent;
5. exact raw-body webhook verification is supported;
6. provider event/transaction identifiers are adequate for idempotency and out-of-order handling;
7. sandbox coverage is sufficient for the USD Impact test matrix;
8. privacy/DPA/subprocessor terms are reviewed;
9. incident, rollback, and secret-rotation procedures are known;
10. the provider choice is explicitly approved before any adapter registration or environment configuration.

If any required item is unresolved, remain in `ready_for_provider_configuration` with checkout disabled.

## Post-selection implementation sequence

After explicit provider selection only:

1. freeze the completed responsibility matrix as provider evidence;
2. implement one provider adapter with checkout route, raw webhook route, normalization, configuration assessment, and tests as one coherent release;
3. keep `COMMERCE_MODE=sandbox` outside Production;
4. prove pending, completion, failure/cancellation/expiry, refund, dispute, chargeback, reversal, duplicate, forgery, substitution, delayed, and out-of-order cases;
5. reconcile USD Impact lifecycle-email ownership against the completed responsibility table;
6. complete controlled Live proof under separate approval;
7. activate Production only after #130, #53, and #54 gates are green and explicit Live approval is recorded.

## Evidence handling

Record provider decisions using links, document titles, case/reference numbers, dates, and bounded summaries. Do not commit API keys, dashboard passwords, bank details, identity documents, recovery codes, webhook secrets, full provider message IDs, or customer data.

## Related controls

- GitHub Issue #53
- GitHub Issue #130
- GitHub Issue #54
- `apps/web/src/lib/commerce-provider.js`
- `apps/web/src/lib/commerce-adapters.js`
- `apps/web/src/lib/email-operations-policy.js`
- `docs/operations/email-readiness-release-gate.md`

This matrix is intentionally provider-neutral until written provider evidence and explicit selection are complete.
