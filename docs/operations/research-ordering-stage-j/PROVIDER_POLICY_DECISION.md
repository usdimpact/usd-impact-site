# Stage J owner security and provider policy decision record (NO-GO)

**Unapproved options for later owner/security review.** This packet does not
claim any of the choices below were made. No merchant, connected DB,
customer-entitlement, infrastructure or release action is permitted.

## What the offline review now demonstrates

1. Canonical paid-invoice identity must be based on store/subscription/invoice;
   delivery/event names remain distinct audit evidence. Lemon Squeezy states
   `subscription_payment_recovered` accompanies `subscription_payment_success`;
   two event names alone cannot create two paid cycles.
2. Amount and currency need the *actually issued* local quote or an approved
   tax/discount/credit-adjustment reconciliation; `total > 0` is not price proof.
   A 1-cent invoice against a 1,299-cent quote fails. A 1-cent invoice against
   a synthetic 1-cent quote remains non-authorizing.
3. `billing_reason=initial` only fits a first-activation intent with a single
   consumed B-5 checkout reservation; `renewal` needs renewal terms and existing
   subscription version. `updated` is not a new cycle grant. No transition
   can change a customer entitlement from the Stage J test.
4. An invoice that is currently `paid` plus a currently `active` subscription
   is not an authoritative relation between that invoice and the subscription's
   current paid cycle. The historical invoice/current `renews_at` mismatch
   must stay `pending_reconciliation` until the authority exists.

## Decisions that remain owner HOLD

| Gate | Evidence/choice needed | Default until approved |
| --- | --- | --- |
| R2 paid-cycle start & end | Provider/merchant-authoritative, account-, subscription-, invoice- and quote-linked start/end or independently reviewable payment ledger; no created_at inference | HOLD first activation; no access derived from pending journal |
| R1 remote GET-to-commit race | Owner-approved maximum exposure, recheck cadence, interruption recovery, refund/chargeback handling and reconciliation ownership | Do NOT label two GETs atomic; maintain NO-GO |
| NG1 durable receipt | Single-version SQL invoice identity plus audit with distinct signed deliveries and rollback-proof quarantine | Draft-only PG tests |
| NG3 quote price | Durable B-5 issued quote plus permitted taxes/discounts/credits and currency rule; what exact amount is authoritative | Unmatched amounts pending; do not invent a price threshold |
| NG4 transition | Single lifecycle RPC supporting absent Research entitlement on initial purchase and forward renewal only, version-checked | Stage F F1 P1 open |
| Security & shared commerce | Role ownership, RLS/SEC DEF and legacy RPC cutover together; D2-17 first activation, TRIGGER/TRUNCATE, account-deletion, Library Pass/Paddle fixtures | B-5/D2-C NO-GO |
| Runtime & transport | Independently authenticated HTTPS provider reads, credential custody, egress, hosted verification and monitoring | No live API key or merchant calls |
| Release | Exact-head integrated CI; independent reviewer; verified Development parity; explicit deployment/checkout changes separately approved | Protected main and checkout unchanged |

## Non-authoritative future policy discussion

Potential future approaches—**not approved**—include (a) holding newly paid but
unbound first-activation events for manual/independent settlement verification,
or (b) granting only a time-bounded provisional entitlement followed by
provider reconciliation and audited downgrade. Neither is demonstrated safe:
option (a) can delay a paid customer's access; option (b) can grant unearned
access or produce confusing revocations. The business policy, customer notice,
refund handling and exposure ceiling require explicit owner decisions and
independent security review before any technical rollout.

Already valid paid access, one-time Library Pass and complimentary entitlements
must not be automatically revoked because a verification request fails. Keep
ambiguous evidence auditable, return pending, avoid speculative widening or
shortening of paid horizons. Do not silently alter live customer rights.

## Exact follow-up ownership

- **O1/O4 Draft author:** Stage J NG1–NG4 reviewer notes, use current PR
  #1143 as parent and keep previous branches unchanged; no live imports.
- **Independent QA/Claude:** exact-SHA tests on Stages F–J, especially NG
  invoice candidate assumptions, J4/J5 and risk of disabling owner triggers.
- **Separate B-5 D2 owner:** real shared-Commerce Library Pass/Paddle/QA,
  dual-product deletion and TRUNCATE/TRIGGER compatibility harness.
- **Owner decision:** authoritative paid-cycle source, reconciliation cadence,
  max exposure, first-activation customer policy, Development rehearsal and
  separately authorized Production cutover.

Current disposition: **LIVE O1/O4 P1 OPEN; B-5 NO-GO.**
