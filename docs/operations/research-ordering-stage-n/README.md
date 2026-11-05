# Stage N — actual B-5 M1 strict + locked J/K/L integration (DRAFT HOLD)

**DISPOSABLE POSTGRESQL 17.6 ONLY. This directory is NOT a migration or a live payment/entitlement authorization.**

Parent: Stage M Draft #1149 exact `a7c57e99aede094d436808225c0dafd49abffc3b`. This Draft adds a **byte-identical** copy of B5 D2-07 `M1_strict_matrix_review_only.sql`, from [#1128](https://github.com/usdimpact/usd-impact-site/pull/1128) at `2850ad84e189befe32b7893ed4541a2cb2259d7b`. Fixture SHA256 **`e936e18f1ed78743e77d2b158e562af07b0aedcd62d85efed08ab95244b2ea74`** is asserted before installation. This is a test copy, not an edit or merge of B5's branch.

## What the isolated test attempts

Replays all six historical Research migrations plus the C/E/F/H/I/J/K/L/M review-only overlays. Runs B-5's actual **issuer, checkout attachment, signed paid observation and binding RPC** in a disposable PG17.6 database. The binder returns a **pending Research subscription**, a **consumed checkout intent** and **zero Research entitlements**, which is materially different from an invented `pending` checkout-intent state.

The Stage N private lifecycle wrapper locks the *same* subscription record, then obtains row locks on the persisted B5 consumed checkout intent/signed observation and canonical J receipt/K signed invoice observation during the synthetic first transition. Before calling the Stage L synthetic lifecycle wrapper, it rejects a fabricated/missing checkout UUID, unconsumed, wrong account, variant, store, test/live namespace, signed identity/delivery mismatch, B5 conflict/quarantine, absent or conflicting J invoice and mismatched K quote digest. B-5's separate signed `subscription_created` delivery is not confused with an invoice `payment_success` delivery.

- **L-1 test design:** first activation must be backed by rows from *actual pinned* B5 M1 SQL, not a standalone caller-provided witness. The gateway loses its direct Stage L EXECUTE grant. The wrapper still returns `can_mutate=false`, `provider_paid_cycle_authoritative=false` and `remote_atomicity_proven=false` after synthetic test-only DML.
- **L-2 product isolation:** the private NOLOGIN Research owner is restricted via existing Stage E policies to `product_id='research-membership'` for OLD+NEW rows. Library Pass SELECT/UPDATE/INSERT by this owner must fail or affect zero rows; existing purchase-backed Library Pass data must remain identical.
- **L-3 uniform outcome:** both first activation and Stage F full-effect-witnessed renewal are wrapped in the same **non-authorizing** response shape.
- **Race/rollback parity:** original Stage L two-backend race, duplicate, rollback, stage E product guard and F renewal tests remain required and unchanged in their own isolated job.

## Open critical safety gates

This is an **isolated synthetic simulation**. The temporary B5 verifier role has not authenticated a real Lemon Squeezy payment. Its `signed_paid_observations` proves only fixture shape. The J/K invoice evidence is also synthetic and remains `pending_reconciliation`; the quote digest and cycle dates have no provider/merchant-authoritative issuance provenance. Stage N does NOT establish a paid-cycle start or safe remote last-GET-to-commit atomicity, so it CANNOT be imported into live code. Even a green result is a design test, not permission to grant any new access.

B5's actual fixture uses fake `review_checkout_*` roles and must **never be installed** in a connected database. Real issuer/verifier/binder identities, privileges and cutover differ from this test; live shared `service_role` DML and legacy 16-argument RPC remain P1. Additional B5/D2-C Library Pass/Paddle/dual-product deletion/TRUNCATE/TRIGGER, real provider HTTPS/credential custody, Development parity, independent exact-head review and owner authorization remain mandatory. P2-K1 role timeouts can be disabled in a session; external driver/pooler cancellation is needed in real transport.

There is still no owner-approved J-3 recovered-payment conflict policy, authoritative R2 invoice→paid-cycle start, or R1 post-final-GET refund exposure and reconciliation cadence. **LIVE O1/O4 P1 OPEN; B5 NO-GO.** Do not merge, deploy, install SQL, call a real provider, change checkout/payment/refund, real entitlement, Library Pass or the connected Supabase database.
