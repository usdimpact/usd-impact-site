# USD Impact Research — Stage L F1 first purchase (ISOLATED REVIEW ONLY)

**Draft-only, NO-GO. This is not an authorization to create customer entitlements.**

Stacked on Stage K Draft #1147. The proposed SQL and Python tests are in
`docs/operations/research-ordering-stage-l`, not deployable migrations. The
independent provider evidence in the test is deliberately synthetic and
`provider_paid_cycle_authoritative=false`.

## Why this exists

Independent D2-17 reproduced that Stage F `apply_strict_review` performs
`SELECT ... INTO STRICT` for the Research entitlement before evaluating its
full-effect witness. A legitimate B-5 pending Research subscription has **zero**
Research entitlements. Stage F fails `P0002` and cannot apply a first purchase.

## Design/test change

One private new `apply_lifecycle_review` function replaces the gateway's direct
Stage F EXECUTE **in the disposable overlay**. It locks the subscription first,
then checks the Research entitlement for this account:

- If absent, only `pending -> active` with a matching immutable independent
  *synthetic* first-activation witness is eligible. The witness binds all
  account/provider/store/variant/event/fingerprint fields, subscription row
  version, target state, exact paid start/end, issued synthetic checkout-intent
  ID, invoice ID/digest, quote digest and `billing_reason=initial`.
- It inserts exactly one Research entitlement within the same PostgreSQL
  transaction as the subscription update, watermark and event audit.
  Account/product uniqueness and the locked subscription serialize races.
  Changed effect, missing witness, stale version and missing Research source
  are typed fail-closed denials.
- A matching replay is a non-mutating duplicate. A second different
  first-purchase event after activation cannot make a second entitlement.
- If an existing Research entitlement is present, the same gateway function
  delegates to Stage F's *full-effect witnessed* existing-member renewal path.
  Stage F's direct gateway EXECUTE is revoked, avoiding two active entrypoints.
- Purchase-backed **Library Pass** rows must remain byte-identical across
  positive, negative and two-backend tests.

Tests reproduce the original P0002 on disposable PG17.6, then exercise the
synthetic corrective design, first-time activation with zero Research rows,
exact duplicate, two physical gateway connections racing, and renewal
compatibility. The six historical Research migrations and RLS are replayed.

## Important limitations (P1 release remains OPEN)

There is **no real provider-issued full-effect witness**, no authoritative
paid-cycle start, no conditionally versioned provider snapshot, no real B-5
issued/consumed checkout intent, and no post-final-GET refund protection in
this branch. A test-only verifier with direct INSERT in a disposable database
is NOT an acceptable live settlement authority. The SQL returns
`live_can_mutate=false` even when it creates a synthetic test entitlement.

Separately open: old 16-argument lifecycle RPC and shared `service_role`
privileged writes; Library Pass/Paddle/account deletion/TRUNCATE/TRIGGER
D2-C shared-commerce cutover; hosted credential/transport and independent
security review; Development parity; owner-approved late-refund exposure,
customer notice and reconciliation policy; integrated release CI and
explicit release authorization. Protect existing Oct 28 Research checkout,
all existing members and one-time Library Pass.

Do not merge, install SQL, run merchant requests, create/refund real payments,
change customer entitlement, rotate credentials, reconfigure commerce,
deploy, change DNS, activate Research sales or alter Production/Development.
**LIVE O1/O4 P1 OPEN / B-5 NO-GO.**
