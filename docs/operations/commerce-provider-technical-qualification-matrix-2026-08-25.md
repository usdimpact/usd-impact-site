# Commerce provider technical qualification matrix — baseline 2026-08-25, selected-provider update 2026-08-26

## Current status

This document began as a normalized candidate comparison for Issue #53. The selection decision is now complete:

- **Lemon Squeezy: WRITTEN ELIGIBILITY APPROVED / SELECTED FOR ONE-TIME LIBRARY PASS / `mor-final-state-reconciliation` APPROVED / SANDBOX IMPLEMENTATION DRAFT.**
- FastSpring: written product-eligibility rejection; removed.
- Paddle: declined; removed.
- PayPro Global: not selected; no qualifying reply before selection and technical gaps remained.
- Stripe Managed Payments: fallback research only; not selected.

Production remains commerce-disabled. Provider selection does not register an adapter or populate Production `COMMERCE_PROVIDER`.

Current canonical engineering sources are:

- `docs/operations/commerce-provider-readiness.md`;
- `docs/operations/commerce-provider-responsibility-matrix.md`;
- `docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md`;
- `docs/operations/lemon-squeezy-sandbox-runtime-2026-08-26.md`;
- Draft PR #374.

Historical candidate-prefill documents remain evidence only and must not override this selected-provider update.

## Contract v3 qualification model

The earlier matrix assumed every provider had to expose direct dispute/chargeback/reversal events. Commerce contract version 3 now explicitly supports two security-reviewed profiles:

1. `direct-events`;
2. `mor-final-state-reconciliation`.

The Merchant-of-Record profile is valid only when the adapter has authoritative order retrieval/reconciliation, final-state revocation, documented MoR chargeback ownership, durable idempotency, fail-closed unsupported-state behavior, and no inferred browser/email/dashboard authority.

Lemon Squeezy is selected under profile 2.

## Selected-provider qualification matrix

| Qualification item | Lemon Squeezy finding | Current status |
|---|---|---|
| Written product/company eligibility | Human reviewer approved the disclosed USD Impact Library Pass scope on 2026-08-26 11:03 UTC | **PASS** |
| Initial product scope | one-time standardized digital Library Pass; recurring Research Membership/services excluded | **PASS / SCOPE FROZEN** |
| Romania merchant support | provider documentation supports Romanian merchant payout/onboarding subject to normal KYB/tax requirements | **PASS / MANUAL ONBOARDING** |
| Merchant of Record | provider documents MoR payment/tax/refund/chargeback responsibilities | **PASS** |
| Hosted/server-created checkout | API-created checkout for a trusted Store/Variant is supported | **PASS** |
| Server-authoritative pricing | two fixed Variants selected from durable server-side launch/standard tier; browser `custom_price` prohibited | **PASS BY DESIGN** |
| Exact raw-body authenticity | HMAC-SHA256 over exact request body with `X-Signature` | **PASS** |
| Test/Live isolation | separate Test Mode path; reviewer explicitly required Test Mode and no real-card testing | **PASS** |
| `order_created` | successful one-time order webhook; application additionally re-reads authoritative Order + Order Items before granting | **PASS BY DESIGN** |
| refund lifecycle | `order_refunded` plus authoritative `refunded` / `partial_refund` Order states | **PASS WITH POLICY** |
| partial refund | Library Pass supports full refunds only; unexpected `partial_refund` becomes review with no automatic entitlement mutation | **POLICY CLOSED** |
| pending/failed | authoritative Order states exist; never grant or restore | **PASS VIA RECONCILIATION** |
| fraudulent final state | authoritative `fraudulent` state revokes via canonical `payment.revoked` | **PASS VIA RECONCILIATION** |
| direct dispute-opened webhook | not present in reviewed one-time webhook surface | **NOT REQUIRED UNDER APPROVED MoR PROFILE** |
| direct final-chargeback webhook | not present in reviewed one-time webhook surface | **NOT REQUIRED UNDER APPROVED MoR PROFILE** |
| direct dispute-reversal webhook | not present in reviewed one-time webhook surface | **NOT REQUIRED UNDER APPROVED MoR PROFILE** |
| unobservable dispute behavior | no synthetic event and no provisional access mutation solely from an unobservable dispute | **FAIL CLOSED** |
| restoration behavior | later `paid` does not automatically restore a terminal/incompatible local state | **FAIL CLOSED** |
| durable purchase/receipt/reconciliation persistence | Draft PR #374 reuses existing paid-access primitives and adds `commerce_reconciliations` plus service-role-only RPCs | **IMPLEMENTED IN DRAFT / DB NOT APPLIED** |
| checkout/webhook/reconcile routes | isolated Test-Mode runtime in PR #374; exact raw body preserved; Production hard-blocked | **IMPLEMENTED IN DRAFT** |
| deterministic sandbox coverage | focused local contract tests exist; real provider Test Mode matrix not yet run | **PENDING EXTERNAL TEST CONFIG** |
| adapter registration | intentionally absent | **BLOCKED UNTIL SANDBOX EVIDENCE** |
| public Live activation | no Production credentials/config/public checkout authorized | **BLOCKED** |

## Commercial validation contract

For the selected one-time Library Pass:

- trusted base prices are USD 39 launch and USD 49 standard;
- each tier uses a distinct fixed-price Lemon Squeezy Variant;
- exactly one authoritative Order Item and quantity one are required;
- Store/Product/Variant are server-trusted;
- browser `custom_price` is prohibited;
- checkout discount entry is disabled and authoritative `discount_total` must be zero;
- authoritative Order `subtotal` must equal the durable purchase-intent base amount;
- currency must be USD;
- final Order `total` is retained as the Merchant-of-Record charged amount and may include tax;
- `first_order_item.price` is retained only as provider evidence, not treated as the pre-tax base-price authority;
- any commercial mismatch fails closed before entitlement mutation.

## Lifecycle normalization

| Provider evidence | Canonical/application behavior |
|---|---|
| trusted local checkout intent | `checkout.pending` application state only; never entitlement authority |
| signed `order_created` + fresh authoritative `paid` Order | `payment.completed` after all commercial/account/intent checks |
| authoritative `pending` / `failed` | hold/deny; never grant |
| signed refund or reconciled full `refunded` with full refunded amount | `refund.completed` / entitlement refunded idempotently |
| authoritative `partial_refund` | review only; no automatic purchase/entitlement transition |
| authoritative `fraudulent` | `payment.revoked` / entitlement revoked idempotently |
| unobservable provider dispute/chargeback/reversal process | no fabricated canonical event; MoR operational ownership plus authoritative final-state reconciliation/manual incident path |

## Required sandbox matrix

Use Lemon Squeezy **Test Mode only** and never a real card.

At minimum prove:

1. trusted checkout creation for the configured QA account;
2. browser price/Variant substitution cannot change trusted terms;
3. wrong Store/Product/Variant rejected;
4. item count or quantity other than one rejected;
5. subtotal, discount or currency mismatch rejected;
6. missing/foreign account or purchase-intent linkage rejected;
7. invalid/missing/mutated signature rejected before processing;
8. duplicate/replayed webhook remains idempotent and payload-hash conflicts fail closed;
9. successful `paid` order creates exactly one purchase and entitlement;
10. authoritative state change between webhook and re-read cannot grant stale access;
11. full refund creates exactly the reviewed access transition;
12. unexpected partial refund enters review without automatic entitlement mutation;
13. fraudulent state revokes through `payment.revoked` without fake chargeback state;
14. pending/failed state never grants or restores;
15. provider API outage cannot grant access and reconciliation retry remains bounded;
16. Test configuration cannot mutate Production;
17. Production runtime rejects sandbox commerce configuration;
18. disabling commerce blocks new checkout while preserving durable historical evidence.

## Historical candidate summary

FastSpring, Paddle, PayPro Global and Stripe Managed Payments records are retained only to preserve the due-diligence trail. No historical technical advantage can override the current provider-selection decision without a new explicit governance review.

## Current gate

The provider/lifecycle selection gate is **closed**. The remaining gate is evidence-driven implementation:

1. review and separately authorize the new migration on canonical Development only;
2. configure Lemon Squeezy Test Mode Store/Product/two fixed Variants and non-Production credentials;
3. execute the sandbox matrix;
4. review Development database/advisor evidence;
5. then decide adapter registration;
6. keep Production disabled until later release and independent-security gates pass.

No Production secret, public checkout, Live transaction, real-card test, or Production migration is authorized by this matrix.
