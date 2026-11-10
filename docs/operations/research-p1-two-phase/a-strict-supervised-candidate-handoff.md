# P0 A-strict supervised deletion: isolated review candidate (Issue #1103)

**DRAFT / NO-GO.** This branch is based on exact #1164 head `18a3c73bb514f1e380f741353707026835fa9af0`. It intentionally does **not** incorporate #1189 UI02/UI03 source parity or #1229 D3 policy changes. The sole in-repository runtime change is an unconditional fail-closed block of the *actual* old automatic two-phase batch runner; the test-only dependency injection path is retained for existing synthetic tests. This is not a deployable end-to-end fix.

## Required D1 procedure (proposal, not owner acceptance)

1. Record separate, time-bounded, single-account, owner-authorized case; protect the opaque authorization ID from application and web roles. Authenticated Lemon Squeezy per-account/checkout/invoice/order read and quiet period are external prerequisites. A local SQL clearance row is **not** proof of cessation.
2. Inside one SQL transaction and account profile lock, check active case, approved pre-Auth provider evidence, all local billing holds, open privacy requests and deleted-profile state. Execute **only that account's** Phase A; no due-account scan, batch Phase A or implicit cron.
3. Reclaim a single-account Auth lease under the account lock. Record the irrevocable Auth-attempt intent *before* HTTP. Recheck the local fence and authorization. A previous/unknown attempt requires fresh Admin GET and owner reconciliation, not blind repeat DELETE.
4. Only the owner-supervised operator may send Auth DELETE, and must independently verify authenticated Auth GET. Unknown GET, timeout, mismatched user, expired lease, signed new payment or uncertain response creates a durable financial/identity hold and no completion.
5. After verified Auth retirement, **stop**. Do not confirm release, enqueue a dispatchable completed email, close privacy requests or discard the minimal recovery email. Owner must re-read paginated merchant subscriptions/invoices/orders/checkouts and reconcile signed receipts/settlements **after Auth retirement**.
6. Owner records a distinct post-Auth clearance bound to the account, case and Auth observation. The DB barrier must check the clearance time and every newer signed incident under the account lock. Then, and only then, permit a staged nondispatchable email and an atomic release of email, privacy-request status and custody.
7. Any subsequent unknown, retried or late signed charge invalidates the clearance and creates a durable incident. Never restore a retired Auth identity or benefits automatically. Owner handles merchant refund/remediation, communication, legal/privacy deadline and monitored incident recovery; a fresh verified provider clearance and a **new** explicit supervised authorization are necessary before retry.

## What this exact branch does and does not prove

- **Implements now:** actual Draft review route calls the default automatic `runDraftTwoPhaseReviewCycle` only to receive HTTP 423 / `TWO_PHASE_A_STRICT_SUPERVISION_REQUIRED`, before **any** SQL, Auth or email call. The old default batch worker cannot be enabled solely by Preview flags. A synthetic negative test covers this behavior.
- **Offline design prototype only (outside this in-repo patch):** injectable A-strict three-stage JS review module and uninstalled SQL overlay need schema-level integration review. No real role, migrations or external systems are exercised.
- **NOT implemented on this branch:** durable owner case issuance/grants, SQL owner-only per-account Phase A, post-Auth merchant SQL release fence, live provider verification, outbox replay custody, strict D1 runtime cutover, 15-minute D3 freshness, hosted grant/trigger parity, actual Auth/JWT/session semantics, production release.
- The original legacy account deletion finalizer **remains a separate risk**. Do not re-enable or migrate it to this unapproved procedure. Do not characterize an absent Research subscription in local SQL as merchant cessation. Existing Library Pass and Research entitlements and signed financial history are not modified by this branch.

## Independent review checklist / executable evidence

- Read `apps/web/src/lib/account-deletion-two-phase-worker-review.js` and new `apps/web/scripts/test-account-deletion-a-strict-route-hold.mjs`; execute `node apps/web/scripts/test-account-deletion-a-strict-route-hold.mjs` with no credentials. Compare exact SHA.
- Verify the branch does not change `apps/web/vercel.json`, cron, payment/checkout, legacy finalizer, live migrations, outbox or entitlements.
- Independently challenge all separate boundaries: pre-Auth SQL fence -> signed payment -> DELETE; failed or ambiguous GET; late webhook after owner clearance; repeated/expired leases; process crash after DELETE; simultaneous payment/deletion workers; direct legacy RPCs; notification outbox bypass.
- Require a PostgreSQL 17 disposable source replay **and independent tests**, including all expected source migrations + UI02/UI03 and true least-privilege role/trigger/grant parity. An offline assertion is not proof of SQL behavior.
- Require external provider reconciliation, no open future billable path, exact Auth retirement, post-Auth provider verification and privacy deadline policy before any real deletion; D1, D2, D3, D4, D5, D6 each need item-specific owner approval.

**Recovery:** on unknown outcome, stop batch/routes, preserve signed receipts and private incident history, do not restore Auth or entitlements, read the exact Auth state with authorized Admin GET, reconcile all paginated provider financial state, document remediation/refund and privacy communication, record new case-bound evidence, obtain independent acceptance and owner authorization before another account-specific action. No rollback to Auth-first automatic deletion.

**Release gate:** #1103 OPEN; Research security release NO-GO; no merge/deploy/SQL/Auth/merchant/customer work authorized.
