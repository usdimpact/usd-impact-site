# P1 Research Membership webhook ordering — Stage A review-only prototype (2026-11-04)

**Source:** [Issue #1103](https://github.com/usdimpact/usd-impact-site/issues/1103), revised Assignment 22. **Base:** protected main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`. This Draft has **NO effective webhook or database fix**. The new helper is intentionally not imported by the live handler, persistence client or server route; its results always set `canMutate: false`. Never publish or merge as a P1 remediation.

## Verified defect and non-negotiable provider boundary

Current `apply_research_membership_transition` has a subscription row `FOR UPDATE`, duplicate-key and expected-state checks, but no applied provider-event chronology. Signed different-key stale events can overwrite a renewal. The provider's `subscriptions.updated_at` is not a globally comparable stream with `subscription-invoices.updated_at`. Invoice failed/recovered/refunded deliveries therefore require independently verified subscription-state reconciliation or a durable pending disposition; invoice timestamp alone may never revoke/recover paid access.

Current protected main has live Research checkout; last read-only Production aggregate recorded zero paid, provider-backed Research subscriptions. This is not proof that no in-flight checkout can complete.

## Stage A classification (executed synthetic only)

- Missing/unverified subscription-object watermark or invalid timestamp => `pending_reconciliation`.
- Older **subscription-object** event => `stale_ignored` candidate for durable audit, no state change.
- Equal timestamp (including different keys) => `ordering_conflict`, never invent order by event ID.
- Invoice object of any transition kind => `pending_reconciliation`, regardless of apparent time order.
- Verified newer subscription-object with confirmed finite, nondecreasing paid period => `candidate_for_atomic_review`, **NOT authority to mutate**.
- A duplicate key must be validated against the durable full signed-event ledger before classification/acknowledgment.
- Existing entitlement/source, terminal-state and binding checks remain mandatory; current RPC cannot be trusted to enforce the new classifier.

## Required Stage B database plan (not implemented or executed)

1. Independently reconcile Development migration history and current schema. Add review-only DDL to a `docs/operations/` path, **never directly to `supabase/migrations/`** under Draft; obtain separate migration-intake approval.
2. Under the **same existing `subscriptions ... FOR UPDATE` lock**, validate signed-provider binding, expected account/merchant/store/product/variant, provider object class and monotonic **subscription-object** watermark. Persist the watermark with the entitlement and subscription transition in the same transaction. On older/equal/conflict/pending event, durably insert `subscription_events` with a standardized metadata disposition then **RETURN without mutating**. Never `RAISE EXCEPTION` after an audit INSERT in the same transaction.
3. The current `subscription_events` table has no explicit disposition column; use a separately reviewed schema amendment or a tightly validated metadata schema. The existing `event_key` uniqueness is appropriate for idempotent audit, but the duplicate verifier today assumes an applied transition. Adjust verification to recognize and validate ignored/pending rows without confusing them with applied transitions.
4. A legacy caller must not reach the current unguarded 16-parameter RPC. Preserve `SECURITY INVOKER`, service-role-only execute and RLS. Specify a migration-first compatible rollout where old callers fail closed, with no rollback that reopens bypass. Backfill the applied watermark from authoritative *subscription-object* rows only; flag ambiguities for reconciliation rather than guessing from invoice time or wall-clock `updated_at`.
5. Remove any active/renewal `ends_at = null` possibility; preserve existing Library Pass `purchase_id` and admin/complimentary Research entitlements. Legitimate terminal refunds/chargebacks require the trusted current subscription/invoice scope and valid transition rules.

## Stage B tests required before any review PASS

- O1 old payment failure after renewal; O4 old cancellation after renewal; verified forward renewal/recovery.
- Different-key equal timestamps; duplicate matching/mismatching fingerprint; changed billing period under same event key.
- Full/partial historical invoice refunds, genuine current terminal refund/dispute, invoice-then-subscription ordering, and unreadable provider state.
- Two genuine PostgreSQL sessions per opposite event arrival order under the same subscription row lock; crash/retry/audit persistence; period dates, entitlement states and disposition for every case.
- Invalid account/store/product/variant/test mode, missing timestamp/period, Library purchase isolation, complimentary Research isolation.
- An executed isolated database receipt (not mocks/PGlite alone), full migration intake and independent Claude PASS or BLOCK, then **separate explicit** Production rollout authorization.

## Progress / hold

The helper plus tests are **contract scaffolding only**; no app import or RPC call is changed. No SQL is deployed. Open decisions: owner-selected isolated two-session PostgreSQL target, migration/backfill strategy, provider re-fetch/reconciliation credential authority, and explicit future Production plan. Existing checkout stays live and untouched; Daily #840 remains first natural-publication priority; Score/F2/media/release and email HOLDS stay intact.
