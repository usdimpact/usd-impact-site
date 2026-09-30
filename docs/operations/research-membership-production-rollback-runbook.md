# Research Membership Production rollback runbook

Status: prelaunch control document under issue #122. This runbook defines the fail-closed rollback sequence for recurring Research Membership. It does **not** authorize activation, configuration changes, customer mutations, email/push distribution, or provider actions by itself.

## Purpose

Provide an explicit operator sequence to disable Research Membership checkout and, if necessary, the broader Production activation path without affecting independently purchased Library Pass access.

This runbook is intended for use only after Research Membership has been separately authorized and activated. Before activation, it serves as rollback-readiness evidence.

## Core invariants

- Daily News remains public.
- Library Pass remains independent and permanent.
- Disabling Research checkout must not revoke Library Pass.
- Disabling Research activation must not alter existing Library Pass purchases or entitlements.
- No rollback step should delete customer, purchase, subscription, entitlement, consent, outbox, or provider audit records.
- Historical records remain preserved for reconciliation.
- TradingView remains outside the initial Research launch scope.

## Rollback controls

Research Production execution is designed to fail closed through two independent controls:

1. `RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED`
   - controls whether new Production Research checkout creation is allowed;
   - when false or absent, checkout creation must fail closed.

2. `RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED`
   - controls whether Production Research execution is approved at all;
   - when false or absent, Production Research first-purchase/bootstrap execution must fail closed.

The checkout control is the first-line rollback switch. The activation-approval control is the stronger containment switch when the incident scope is broader than new checkout creation.

## Rollback trigger examples

Use rollback when a verified incident materially affects Research Membership launch safety, including:

- incorrect Product/Store/Variant binding;
- Research checkout opening when it should be closed;
- duplicate or malformed first-purchase processing;
- subscription lifecycle corruption;
- entitlement mismatch;
- provider Test/Live mode mismatch;
- canonical Production Supabase mismatch;
- unexpected customer-impacting Research runtime failure;
- rollback explicitly required by Release Control or incident response.

Do not trigger rollback merely for unrelated Daily, SEO, Partner, Web Push, or Library content changes unless they create a direct Research Membership safety impact.

## Phase 0 — freeze and record

Before any mutation:

1. Record UTC incident time.
2. Record exact current GitHub `main` SHA.
3. Record exact current Vercel Production deployment ID.
4. Record current Research state:
   - Research purchases count;
   - Research subscriptions count by state;
   - active Research entitlements count;
   - due/error commerce reconciliation counts;
   - pending/retrying outbox count;
   - enabled push subscription count.
5. Record current Library Pass state:
   - completed Library purchases;
   - active Library Pass entitlements.
6. Record the incident evidence and reason for rollback.
7. Do not merge unrelated code while rollback is in progress.

## Phase 1 — disable new Research checkout

Protected action: configuration mutation requires explicit authorization.

Set:

`RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED=false`

Then allow exactly the minimum configuration-uptake deployment required by the current Vercel environment model.

Verification:

1. Confirm resulting Production deployment is READY.
2. Confirm Production remains on the expected exact source revision/configuration.
3. Verify a Research checkout request fails closed with the expected disabled condition.
4. Verify no new Research checkout URL is returned.
5. Verify Research purchase count has not increased unexpectedly.
6. Verify Research subscription count has not increased unexpectedly.
7. Verify Library Pass purchase/entitlement state is unchanged.

If all pass, classify:

**CHECKOUT ROLLBACK PASS / NEW RESEARCH SALES DISABLED**

## Phase 2 — disable broader Research Production activation

Use only when the incident requires stronger containment than checkout disablement.

Protected action: configuration mutation requires explicit authorization.

Set:

`RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED=false`

Keep:

`RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED=false`

Verification:

1. Confirm resulting Production deployment/configuration uptake is READY.
2. Confirm Production Research execution rejects with the not-approved fail-closed condition.
3. Verify no new Research purchases or subscriptions appear.
4. Verify no Research entitlement mutation occurs solely because activation was disabled.
5. Verify Library Pass purchase/entitlement state remains unchanged.
6. Verify Daily News remains public and unaffected.

If all pass, classify:

**RESEARCH PRODUCTION CONTAINED / ACTIVATION DISABLED / LIBRARY PASS UNAFFECTED**

## Existing Research customers during rollback

Rollback of checkout or activation controls is not authorization to revoke already-valid paid-period access.

For existing Research subscriptions:

- preserve canonical subscription and entitlement records;
- do not mass-cancel subscriptions;
- do not manually revoke entitlements unless a separate incident-specific lifecycle decision authorizes it;
- cancellation/refund/dispute/chargeback handling continues under the canonical lifecycle rules;
- do not grant compensating Library Pass changes.

If provider billing itself must be suspended or modified, that is a separate protected provider action requiring its own explicit approval and evidence.

## Distribution controls

Research rollback does not require deleting consent or outbox history.

Verify:

- no pending/retrying Research distribution rows;
- no newly enabled push subscriptions;
- no Research broadcast or lifecycle campaign is activated as part of rollback.

Historical consent/outbox rows must remain preserved.

## Post-rollback reconciliation

After containment:

1. Re-run commerce reconciliation read-only.
2. Verify:
   - due reconciliations = 0 or explicitly classified;
   - reconciliation errors = 0 or explicitly classified;
   - Research purchases/subscriptions match expected incident state;
   - active Research entitlements match expected lifecycle state;
   - Library Pass state is unchanged.
3. Review Vercel runtime errors for the rollback deployment.
4. Record exact before/after counts.
5. Record rollback deployment ID and exact source SHA.
6. Update issue #122 and the Control Center with the incident classification.

## Re-enable gate

Do not re-enable Research checkout or activation merely because the immediate error disappeared.

Re-enable requires:

1. root cause identified;
2. incident evidence reconciled;
3. required code/configuration fix verified;
4. exact-head checks green;
5. current Production runtime healthy;
6. Research purchase/subscription/entitlement state reconciled;
7. Library Pass independence re-verified;
8. rollback path still intact;
9. a fresh explicit owner authorization for the bounded re-enable action.

Re-enable order:

1. activation approval only when required and explicitly authorized;
2. verify fail-closed state before checkout;
3. checkout enablement only as a separate explicitly authorized step;
4. verify one bounded Production uptake;
5. stop and reconcile before any broader rollout.

## Evidence checklist

Record:

- incident UTC timestamp;
- current `main` SHA;
- pre-rollback Production deployment ID;
- post-rollback Production deployment ID;
- changed control(s);
- Research purchase count before/after;
- Research subscription count before/after;
- Research entitlement count before/after;
- Library purchase count before/after;
- Library Pass entitlement count before/after;
- reconciliation due/error counts;
- runtime-error result;
- checkout fail-closed result;
- distribution-state result;
- operator/authorization reference;
- final classification.

## Final safety rule

Rollback is a containment operation, not a data-cleanup operation.

Prefer disabling new Research execution while preserving canonical commercial and audit records. Never use rollback to erase evidence, manufacture a clean prelaunch state, or alter independent Library Pass access.
