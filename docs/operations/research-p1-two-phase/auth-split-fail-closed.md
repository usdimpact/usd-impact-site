# Research P1 — Auth-absent financial split: fail-closed correction

**Status:** DRAFT design and synthetic tests only. Not installed in any database. Not a security PASS. Production **NO-GO**. Independent technical acceptance **OPEN**.
**Scope:** the Draft two-phase deletion path (`finalize_deletion_and_queue_auth_cleanup` → leased Auth cleanup → staged completion email). The legacy Auth-first finalizer is unchanged and remains isolated behind its existing holds.

## 1. The blocker

The pre-Auth billing fence is a separate SQL transaction. A signed Research payment can commit after the fence returns `true` and before the Auth Admin `DELETE` reaches GoTrue. The later SQL confirmation correctly refuses to complete privacy or email, but the Auth identity is already retired. The negative witnesses in `test_research_p1_two_phase.py` and `test-account-deletion-two-phase-review.mjs` reproduce this. **A green witness describes the gap; it is not a pass.**

## 2. What cannot be fixed in code

- **No cross-service atomicity.** A database transaction can keep locks open while an HTTP call to Supabase Auth Admin is in flight, but that cannot make the PostgreSQL commit, the Auth soft delete and any Lemon Squeezy charge one atomic operation: each system commits independently and a provider payment does not wait on our locks. Whatever the order, a window remains between the last SQL check and the external `DELETE`.
- **Absence of local evidence is not cessation.** Webhooks can be delayed, retried or lost; Lemon Squeezy can retry `past_due` charges for about two weeks; a cancelled subscription can stay in a paid grace period and be resumed; a checkout created before local custody, or with `expires_at=null`, has no local row. A database with no Research footprint cannot prove the provider will not charge.
- **Auth retirement cannot be undone here.** A soft-deleted GoTrue user is not restored by this code, and nothing here re-grants paid access.

So the correction does not claim to close the window. It makes the window **evidence-gated, short, detected and durably held**.

## 3. The correction (smallest fail-closed change)

| Control | Where | Effect |
|---|---|---|
| **Fresh per-account provider evidence before ANY Auth retirement step** | `auth_retirement_hold_reasons`, called by the fence | The fence refuses unless an owner-recorded `research_billing_clearances` row for this account was verified (a) after Phase A started, (b) within the last 24 hours, and (c) after any recorded financial hold, **in addition to** all existing billing hold reasons. This applies to every account, including accounts with no local Research footprint. |
| **Durable "Auth may have been attempted" marker** | fence sets `financial_fence_passed_at` before returning `true` | A later refusal after a timeout or crash is classified `auth_outcome_unknown_financial_evidence`, never "Auth intact". |
| **Durable, classified financial hold** | new `hold_deletion_auth_cleanup(account, lease, auth_retired_observed)`, called by the worker after any fence/confirm/finish failure | SQL re-evaluates the evidence itself and can only add a hold. Clean evidence returns `NULL` (transient failure, normal lease retry). The worker's own verified Auth GET can only make the class stricter. |
| **No automatic retry of a held row** | `claim_deletion_auth_cleanup_batch` filter | A held row is re-admitted only by an owner clearance verified after the hold. Unresolved quarantines and open checkout windows still refuse after re-admission, because they are never clearable. |
| **Monotonic incident severity** (Q-16) | `hold_deletion_auth_cleanup`, `financial_hold_rank` | A verified Auth retirement is stored once in `auth_retired_observed_at` and never forgotten. A later hold can only keep or raise the class, never lower it. Example: a re-admitted split whose fence refuses before any Auth call (worker passes `retired=false`) stays `auth_retired_financial_evidence`. `financial_hold_first_at` keeps the first incident time while `financial_hold_at` moves forward for the claim filter. |
| **Append-only incident history** | `deletion_auth_financial_hold_events` | One private row per hold: recorded class, the class computed from that observation alone, evidence reasons, phase and Auth-retired flag. No API role can read it. UPDATE, DELETE and TRUNCATE are rejected even for the table owner. |

Hold classes, from least to most severe:

| Class | Meaning | Worker code |
|---|---|---|
| `auth_intact_cessation_unverified` | No fresh post-Phase-A provider evidence; Auth not attempted | `TWO_PHASE_CESSATION_UNVERIFIED` |
| `auth_intact_financial_evidence` | Financial evidence before or during the fence; Auth not attempted | `TWO_PHASE_FINANCIAL_HOLD_AUTH_INTACT` |
| `auth_outcome_unknown_financial_evidence` | Fence had passed, Auth outcome not observed, then evidence | `TWO_PHASE_FINANCIAL_HOLD_AUTH_UNKNOWN` |
| `auth_retired_financial_evidence` | Auth retirement verified or confirmed, then evidence: **a split** | `TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED` |

Unchanged and preserved: checkout custody, paid-binding quarantine (including all seen claimed accounts and checkout keys), bounded privileged HTTP, stale-JWT RLS denial, staged non-dispatchable completion email, legacy direct-RPC revocation, Library Pass entitlements (the hold reasons only ever consider `research-membership`).

**Consequence (owner decision D1):** in this Draft, Auth retirement requires an owner-recorded clearance for every account, but once one exists the worker retires Auth automatically. Database Phase A still runs automatically; it already makes the profile deleted and denies stale JWTs, and the retained Auth identity is the recoverable side. The stricter proposals (owner-run Auth retirement, optionally also owner-run Phase A) are **not implemented**; see `post-fence-race-options.md` §2 Option A.

## 4. Per-account Lemon Squeezy evidence for an Auth-retirement clearance

Follow `merchant-cessation-acceptance.md` sections 1–3 in full. Additionally, a clearance used for **Auth retirement** must:

1. be observed **after** the account's Phase A time and **no more than 24 hours** before the Auth retirement attempt; record the provider observation time as `verified_at`, never the time the row was typed in;
2. cover all pages of subscriptions, subscription invoices, orders and checkouts matched by every identifier in section 1 of the runbook, including customer email search, since an account with no local Research rows may still have legacy provider records;
3. state explicitly that no subscription is `active`, `on_trial`, `paused`, `past_due`, `unpaid` or in cancellation grace; that no invoice is pending or retrying; and that no checkout for the customer is open or has `expires_at=null`;
4. be recorded only through the owner-only `record_research_billing_clearance`, with an opaque reference and no PII in GitHub, CI or trackers.

If any item cannot be established, do not record a clearance. The row stays held and Auth stays intact.

## 5. Recovery when Auth was retired before a newly observed charge

This is the `auth_retired_financial_evidence` class. The database profile is already deleted, Auth is retired, and the private ledger keeps the recipient email and the privacy request IDs because completion never happened.

1. **Stop.** The row is not re-leased automatically; no completion email is released; privacy requests stay `in_progress`. Any signed Research event or paid-binding delivery that commits after Phase A also opens a post-finalization incident (`deletion_billing_incidents`, Part 14) in its own transaction. While that incident is open, the claim never leases the row, so no worker reaches the fence at all.
2. **Reconcile with the provider** (owner, authenticated session): identify the charge, cancel any remaining subscription or retry, and refund or otherwise remediate according to the owner's refund policy. This code never calls the merchant.
3. **Resolve the signed-payment quarantine** with a reference to the remediation. Neither this nor a new clearance releases the row on its own.
4. **Record a new provider clearance** verified after the incident's last observation and after remediation.
5. **Resolve the incident** with the owner-only `resolve_research_deletion_billing_incident(account, clearance_id, 'p1-<opaque-case-ref>')`. It refuses a clearance older than the incident, a malformed case reference, a non-owner caller, and any remaining financial conflict. If the worker recorded its hold after the provider observation, record one more clearance newer than that hold, since re-admission also requires a clearance newer than the latest hold.
6. **Continue.** The row is re-admitted; the fence re-checks; `DELETE` is idempotent (404 or matching `deleted_at`); confirmation and the staged email then complete. A new signed payment after resolution reopens the incident and starts again from step 1.
7. **Customer contact** about the charge uses the retained recipient email under the privacy owner's procedure. The ledger scrubs that copy only at final completion.

Recovery never lowers the recorded hold class, never clears `auth_retired_observed_at` or `financial_hold_first_at`, and never edits the incident history.

For `auth_outcome_unknown_financial_evidence`, and for any open incident on a row whose `financial_fence_passed_at` is set (the payment can land before a retry worker ever re-leases it, so no classified hold is written), first establish the Auth state with an authenticated Admin `GET` (404 or matching `deleted_at` means retired). Then follow the same steps.

## 6. Privacy escalation

A held deletion is still an open data-subject request. The worker reports only counts and bounded codes, never account data. The owner must:

- monitor held rows by class, oldest first, and treat `auth_retired_financial_evidence` and `auth_outcome_unknown_financial_evidence` as incidents;
- set a maximum hold duration and escalation contact (**owner decision D2**). The deadline must fit the applicable privacy-law response window; this document does not determine that law;
- never use an indefinite silent hold as an assumed exemption; if billing cannot be resolved in time, escalate to the privacy owner and legal advice.

## 7. Owner decisions

Strict defaults, alternatives, consequences and required approvals for each item are in `post-fence-race-options.md` §5. Nothing there is approved.

| ID | Decision |
|---|---|
| D1 | Choose between the strict proposal (owner-run Phase A and Auth retirement for **all** accounts), the alternative (automatic Phase A, owner-run Auth retirement), or a narrower rule (for example a store-level attestation that Live Research was never purchasable for a cohort). Neither proposal is implemented; the Draft retires Auth automatically once a clearance exists. |
| D2 | Maximum privacy hold, escalation owner and customer-communication procedure for each hold class. |
| D3 | Freshness window for an Auth-retirement clearance (24 hours in this Draft). |
| D4 | Refund and remediation policy for a charge observed after Auth retirement. |
| D5 | Who may record clearances, and how their custody receipts are audited. |
| D6 | Monitoring and alerting for held rows before any hosted rehearsal. |

## 8. Evidence

All synthetic, disposable PostgreSQL 17.6 and offline mocks:

- `supabase/tests/research-p1/test_research_p1_auth_split_fence.py`: before, during (two connections) and after the fence; stale and pre-Phase-A clearances; ambiguous Auth outcome with and without later evidence; recovery; classifier abuse.
- `apps/web/scripts/test-account-deletion-two-phase-financial-hold.mjs`: worker classification at each stage, retry after an ambiguous DELETE, classifier failure modes.

Not established: hosted GoTrue soft-delete semantics, real webhook timing, Lemon Squeezy behaviour, hosted grants and owners, privacy-law deadlines.
