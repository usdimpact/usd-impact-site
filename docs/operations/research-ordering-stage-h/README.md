# USD Impact Research O1/O4 Stage H — provider window + pending-only journal

**DRAFT / REVIEW ONLY / NO-GO. Never merge, publish, install or deploy this design as a live entitlement handler.**

This is a separate stacked Draft above Stage G #1141. It adds only review/test files under `docs/operations/research-ordering-stage-h/` and a dedicated Actions workflow. It imports Stage G's **review-only** HMAC + mock JSON:API evaluator, not a production webhook module. No `supabase/migrations` changes and no real provider credentials or customer data.

## Problem / verified facts

- Lemon Squeezy's [Subscription Invoice Object](https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object) includes `status`, `billing_reason`, `total`, `refunded`, `refunded_amount`, `created_at` and `updated_at`; these are invoice status fields, **not a documented paid-period-start attestation or conditional-version token**.
- The [Subscription Object](https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object) includes `renews_at` (end of billing cycle, next invoice) or `ends_at` (cancelled/expired); neither property is a provider-signed *start* of the paid cycle. Invoice `updated_at` and subscription `updated_at` are object timestamps, **not provider compare-and-swap proofs**.
- Stage G verifies signed delivery against mocked provider invoice and subscription GETs. Stage F fences local database row versions only. A new remote refund/cancellation can occur immediately after either successful GET, including after the final GET and before local commit.

## Stage H isolated tests

1. Stage G mocked provider GET evaluation is run twice under a bounded injected 10-second review window; each pair must agree on signed webhook hash, event ID, invoice and subscription versions, current state, period end and digest. Tests simulate changes **between** the reads: refund, partial refund, new invoice/subscription version, cancellation, past due, shortened paid horizon, changed variant, and unavailable API.
2. A separate, explicitly **synthetic external-reviewer** cycle-start witness is required to check candidate period shape. No such witness comes from Lemon Squeezy's documented GET schemas, and a synthetic candidate is **never** a settled/authorized payment decision.
3. Test demonstrates the irreducible late remote event: a refund immediately **after the second GET** cannot be detected by a two-read protocol. Even in that case the candidate has `canMutate=false`, `remoteAtomicityProven=false`, and requires manual/independent reconciliation.
4. Disposable PostgreSQL 17.6 replays **six historical Research migrations** with RLS, adds a private `research_ordering_stage_h` audit-only schema, and tests a pending-only evidence journal. It persists one immutable original event fingerprint and append-only audit events; same-key same-hash retry stays pending, conflicting hash quarantines, and two concurrent database connections serialize without duplicate receipts. No APPLY or entitlement-grant function exists.
5. The journal exercises a purchase-backed Library Pass fixture and existing Research subscription/entitlement rows, confirming all remain byte-identical. It never contacts connected Supabase or Lemon Squeezy.

## Exact acceptance boundary

- **PASS**, if the two isolated hosted jobs and Production migration-intake guard pass on the exact child HEAD.
- **Not a live fix:** repeated GETs detect some intermediate changes but not the final GET-to-commit remote race. The test-only cycle-start witness and local journal do not prove provider settlement. No customer gain/loss of access can be inferred from tests.
- A proposed Production policy would need a trusted checkout/account binding, real settled invoice-to-cycle witness and signed HMAC provenance, strict effect-bound Stage F verifier, compensating post-commit reconciliation with bounded exposure, audited unresolved cases, and a coordinated closure of legacy 16-argument RPC/direct `service_role` writes. Require independent QA and explicit Development/Production owner approvals first.
- Preserve existing Research checkout activated Oct 28, Library Pass, B-5/D2-B/C/D4/D6/D7 holds and D2-16 TRUNCATE/mixed-product deletion risks.

## Files

- `provider_window_review.mjs`, `test_provider_window_review.mjs` — two-GET window and remote-race evidence; all outcomes non-mutating
- `receipt_journal_review.sql`, `test_receipt_journal.py` — PG17 pending-only review journal and two-connection tests, disposable schema only
- `PROVIDER_RACE_DECISION.md` — release decisions and precise unresolved provider/source contracts
- `.github/workflows/research-ordering-stage-h-review.yml` — isolated GitHub Actions runner
