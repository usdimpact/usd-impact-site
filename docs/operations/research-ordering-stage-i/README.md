# USD Impact Research O1/O4 — Stage I isolated journal hardening (REVIEW ONLY)

**DRAFT / HOLD / NO-GO. Not a live migration or release candidate.**

Parent: Stage H Draft PR #1142 at `34b7e7b72bc1759028c8174540603446e949e523`.
This child adds ONLY a separate Stage I test overlay, Python negative probes,
this README and an isolated Actions workflow. It changes no runtime application,
no `supabase/migrations`, no routes, merchant/account/credential configuration.

## Reproduced baseline security gaps

Stage H's journal triggers protect original receipt fields on UPDATE and audit
rows against UPDATE/DELETE, but do not prevent:

- an UPDATE-capable writer from downgrading `quarantined_conflict` to
  `pending_reconciliation`;
- DELETE or TRUNCATE of `pending_receipts`;
- TRUNCATE of `receipt_audit`, including despite its row-level DELETE trigger;
- audit rows with no enforced reference to an original receipt.

`test_journal_hardening.py` demonstrates Stage H's original gaps inside a
**ROLLED-BACK transaction** on a disposable PostgreSQL 17.6 instance. A green
"red baseline" means the defects were reproduced, not accepted.

## Tested Stage I isolated overlay

`journal_hardening_review.sql` loads **after** the original Stage H journal,
exclusively in CI. It adds statement-level DELETE/TRUNCATE denial on both
tables, a monotonic disposition trigger, and an audit-to-receipt foreign key.
Journal ownership is transferred to a **NOLOGIN / NOBYPASSRLS** test role.
A separate NOLOGIN writer has only schema USAGE and EXECUTE on the existing
`hold_evidence` function, which remains **strictly pending-only**, with
`can_mutate=false`. The function is modeled as SECURITY DEFINER with a
fixed `pg_catalog` search path; it neither grants nor changes entitlements.
No routine enables remote transport, provider settlement, or APPLY.

Synthetic tests must verify:

1. Stage H baseline downgrade/DELETE/TRUNCATE reproduction is rolled back.
2. After overlay, writer has no direct table SELECT/INSERT/UPDATE/DELETE,
   TRUNCATE, TRIGGER or REFERENCES; `service_role`, `anon` and
   `authenticated` cannot access the private journal.
3. The synthetic owner cannot perform DELETE, TRUNCATE or quarantine downgrade
   without changing privileges or disabling triggers. An orphan audit FK insert
   is rejected.
4. Matching retries append a duplicate audit; changed fingerprints quarantine
   and cannot revert. Two separate database connections serialize a same-key
   receipt to one original and one duplicate.
5. Original Research subscription, entitlement and purchase-backed Library
   Pass fixture rows remain byte-identical.
6. Offline Stage H provider-window tests continue to reject mutation.

## What Stage I does NOT prove

This is **not** a tamper-proof ledger against a real table owner, superuser,
compromised migration owner, or a caller that can ALTER TABLE/DISABLE TRIGGER.
The NOLOGIN owner is a review design, not a deployed separation-of-duties or
Production privilege migration. `service_role` still has effective privileges
on **public** Research/shared-commerce tables; the old 16-arg lifecycle RPC,
`SECURITY DEFINER` routes, TRUNCATE/TRIGGER, Library Pass mixed-product
deletion and D2-17 first-activation gap are separate unresolved blockers.

The two-GET provider check still cannot detect a refund or cancellation
immediately after the final GET. Neither paid-cycle-start authority nor a
provider-atomic conditional version is established. The observed 10-second
synthetic time span is not authenticated wall-clock/commit freshness. The
owner must still define reconciliation cadence, exposure bound, refund/paid
horizon treatment, and customer-safe recovery policy.

The CI role model cannot replace independent security acceptance, hosted
credential/TLS review, actual first-purchase integration, Development parity,
or separate owner authorization for any connected operation. Preserve the
existing Oct 28 Research checkout, all Library Pass purchases, and all B-5,
D2-B/C/D4/D6/D7, Score and other release holds.

**No connected Supabase/merchant/API credentials; no real payment, refund,
webhook, customer, role, Production/Development database, merge, deployment,
or publication action is authorized.**
