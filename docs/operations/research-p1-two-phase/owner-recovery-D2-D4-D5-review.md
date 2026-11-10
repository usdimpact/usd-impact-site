# #1103 — A-strict owner-only recovery runbook (DRAFT, uninstalled)

**Purpose:** a small-team, fail-closed design for interrupted Auth deletion and post-Auth financial incidents. Owner is one person; ChatGPT is the sole Research code author; Claude is the nonauthor adversarial reviewer. Human independence is limited. This document is **not** D1–D6 acceptance, an approved privacy policy, or authorization for hosted SQL/Auth/merchant/customer operations.

**Source boundary:** isolated Draft child #1232, based on frozen Draft #1231 at `0d80b06bfcfa6acc8f373e96a7edb721ff9c960b`. New SQL is in `supabase/tests/research-p1/a-strict-owner-recovery-review.sql`; it is executed **only in a disposable PG17 synthetic CI job**, not in `supabase/migrations/`. Existing #1230 and #1231 remain unchanged. Original legacy Auth-first route is not fixed/deployed by these files.

## The two recovery cases

| Observed failure | Allowed proposal | Explicitly prohibited |
| --- | --- | --- |
| **P1-A: Auth DELETE intent recorded, transport unknown or crash before DELETE.** Owner authenticates an Admin GET and logs its digest, request digest, observation, case and timestamp. Privacy response deadline is separately logged. | Record `active`, `retired` or `unknown` as an append-only **observation**. If `active`, keep the account held: first request might still commit. | No automatic second DELETE or reset of `auth_attempt_at`; no restoration of identity, access or entitlements; no false claim that a GET by itself proves request finality. |
| **P1-B: financially held account AFTER Auth retired.** Owner reviews the exact merchant store/customer case with complete subscription, invoice, order, checkout and retry evidence plus legal/remedy references; obtains a fresh distinct post-Auth receipt and a fresh authenticated Admin GET observation. | An owner-only SQL proposal invokes the existing incident resolver under profile-first account lock and appends immutable reconciliation, leaving completion/email held. New events reopen incident custody. | No automated refund, billing cancellation, reactivation, privacy completion, email dispatch or Auth retry; no financial release from a generic clearance row or a previously reviewed GET. |

## Manual owner procedure (policy-gated; not usable for real customers yet)

1. **Freeze a single case** (opaque `p1-` reference), capture source SHA, account scope, last known financial/identity phase and request/deletion deadline privately. Never post PII, merchant links, invoices, credentials, or email addresses to GitHub.
2. **Stop and preserve:** do not enable the legacy Auth-first cron or automatic two-phase worker. Do not send DELETE a second time on timeout. Keep the private recovery email, entitlement/paid-event custody, signed webhook ledger, deletion requests and outbox nondispatchable.
3. **Auth review:** independently obtain authorized Admin GET evidence including time and known request outcome/finality from Supabase. Store only SHA-256 evidence digests and case in the private append-only `a_strict_auth_review_log`. This log does **not** modify Auth or permit reattempt. An `active` result alone remains HOLD. Unknown response remains HOLD.
4. **Privacy review:** record actual statutory response deadline, case reference, owner, opaque legal/notice references and proposed action in `a_strict_privacy_review_log`. This is not a notice sent; separate authorized communication/retention decision is needed. Never silently defer an erasure request forever.
5. **Merchant review (post-Auth only):** independently verify canonical live store, Research product, customer identity, all paginated subscriptions, invoices, orders, issued/expired checkouts and pending retries/settlements; reconcile delayed signed events and money/rights. A digest/Boolean and a 15-minute timestamp are **owner attestations, not proof of merchant cessation**. Record a new post-Auth scoped merchant receipt only after reconciling.
6. **Remedy/legal approval:** obtain separate item-specific owner decisions for D2 retention/notice, D4 merchant refunds/late charges, D5 custody. A single human may accept residual solo-owner risk, but that must not be mistaken for a second independent auditor or professional legal opinion.
7. **SQL owner reconciliation only:** require a fresh, `retired` Auth observation newer than the financial incident, post-Auth merchant receipt newer than the incident and all holds, opaque legal/remedy/resolution refs, no active Research paid-period rights, and a passing base owner incident resolver. Under profile-first locking, append `a_strict_financial_reconciliations` and set `reconciled_hold_at` **without clearing historical `financial_hold_at`**. Service roles cannot invoke it. An owner cannot reconcile a still-active Auth user through this function.
8. **After reconciliation, STOP:** do not automatically rotate an expired capability or advance SQL Phase C. For a future approved completion, issue fresh case authorization (only if current controls permit), acquire a new lease, get a new post-Auth merchant read and re-run both SQL barriers. Until D1–D6 and external gates are approved, no real-account continuation.
9. **On new signed payment or failed verification:** reopen the incident, invalidate earlier clearance and return to HOLD; preserve Auth state and rights, record remediation/privacy communication separately. No automatic restore or refund.

## Evidence and constraints of the source-only proposal

- Owner-only SQL functions `a_strict_owner_record_auth_review`, `a_strict_owner_log_privacy_action`, `a_strict_owner_reconcile_financial` explicitly revoke EXECUTE from PUBLIC, anon, authenticated and service_role. The private ledgers have RLS plus append-only UPDATE/DELETE/TRUNCATE triggers. `postgres` is trusted in disposable CI; actual hosted role/credential custody is not verified.
- Reconciliation requires an owner-attested **post-incident retired GET digest**. It is only as strong as the independent operator evidence. There is **no replayable cryptographic signature from the external provider** in this model.
- Receipt freshness is the **proposed unapproved 15-minute D3 policy**, not a substitute for completed provider cancellation/settlement. Parent #1164 migration still uses 24 hours. All release source must be independently reconciled later.
- Financial reconciliations are atomic with the source incident resolver in PostgreSQL; they cannot make Supabase Auth and Lemon Squeezy atomic. Late charges after any read remain a monitored legal/financial risk.
- No service_role may perform Phase A, create a new Auth DELETE intent or attest an Auth GET in the A-strict overlay. No new real Auth reattempt function exists. This deliberately leaves some outcomes held until Supabase request-finality semantics and a separate one-time supervised procedure receive explicit approval.
- The incident resolver may not clear a remaining paid entitlement, open checkout or signed quarantine; it refuses while billing conflicts remain. Library Pass history/entitlements and existing Research historical paid events are untouched.

## Independent reviewer (Claude) acceptance tests

1. Confirm parent #1231 at pinned SHA, new child exact SHA and complete changed-file inventory; independently replay each pinned source migration in disposable PG17 and all old tests.
2. Test crash after Auth intent but before external DELETE, authoritative GET active/unknown/retired, duplicate or stale evidence, wrong account/case, owner-role restriction and absence of a second Auth DELETE.
3. Test expiry during a financial hold, forbidden rotation before resolution, post-incident fresh Auth GET and merchant scope, mismatched or stale clearance, service_role denial, duplicate/conflicting resolutions and monotonic held-row history.
4. Test concurrent signed payment and owner reconciliation using two actual PG17 connections under profile-first lock; verify new event reopens hold, no email/privacy completion and no rights restored.
5. Audit execution privileges (incl. implicit PUBLIC), RLS and append-only triggers; review test isolation, identity reclassification patch #1231 and transitive UI02/UI03 parity; do not count author-written green tests as a standalone adversarial PASS.

## Remaining release NO-GO gates

- **D1** accepted supervised deletion operator and authentic Auth request finality. **D2** privacy response/retention/legal basis and deadline. **D3** 15-minute threshold and merchant quiet-period policy. **D4** reimbursement/late charge/customer remedy. **D5** owner credential/custody and solo-owner residual risk. **D6** monitoring and escalation cadence.
- Lemon Squeezy written store-specific invoice/retry/settlement/previous checkout/PayPal cessation evidence; no merchant request sent by these changes.
- Real Development **synthetic-only** Auth/JWT/session and F3 schema/provenance test with separately approved hosted access; no customer identities used.
- Complete integrated #1164/#1189/#1229/#1230/#1231/#1232 source tree and independent exact-head security/code-quality review, legacy cron drain, separate release approval. None exists yet.

**Status:** #1103 OPEN / Research real-account deletion NO-GO; no hosted SQL, migration, Auth, merchant, customer-data, merge or deployment action is authorized by this runbook.
