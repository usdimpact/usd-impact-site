# Issue #950 — Full integrated offline acceptance, including confirmed-token-loss recovery

**Date:** 2026-10-29. **Release classification:** **DRAFT / DO NOT MERGE / NOT LIVE**.

## Exact evidence lineage

- [PR #962](https://github.com/usdimpact/usd-impact-site/pull/962): lifecycle, identity, webhook, email, RLS and default-off security baseline, 32/32 workflows previously passed.
- [PR #966](https://github.com/usdimpact/usd-impact-site/pull/966): combined atomic-claim SQL, real PostgreSQL 17 concurrency and lock-wait tests, private transactional completion escrow, dormant completion recovery, read-only Development preflight, backup/cutover controls, 35/35 workflows passed.
- [PR #967](https://github.com/usdimpact/usd-impact-site/pull/967): unexposed, postgres-operator-only confirmed-state token-loss recovery, shared private erasure+escrow SQL helper, atomic operator audit; disposable PGlite and independent PostgreSQL 17 race tests passed, with no Supabase/GoTrue/Resend interaction.
- This full integration Draft includes all those source paths and triggers the original plus new workflows on one exact Git commit. Successful CI is offline evidence, not permission to apply migration or delete identities.

## What is now covered by isolated tests

1. Exclusive claim identity per due deletion request; claimed pre-dispatch lease and generation fencing; post-lock expiry clock; no second claim/dispatch after a committed irreversible Auth-hand-off intent.
2. Auth administrative client JSON soft-delete contract is separately mock-validated; no real Auth DELETE is issued. 404, timeout, lost response and unknown Auth outcomes **cannot** be automatically treated as successful deletion.
3. RLS link-fence source for 14 authenticated ownership policies; simulated still-valid JWT read attempts denied after Auth link detachment.
4. PostgreSQL 17 independent-session contention: original claim and lock-wait races, plus two simultaneous DBA-only confirmed-state finalizations competing for one account.
5. Core erasure and original-recipient recovery intent commit together or roll back together; outbox identity confirmation scrubs the private recipient. Offline completion adapter uses the existing governed email idempotency identity and does not send email.
6. A worker that loses its token **after a confirmed Auth 200/204 is committed** has a narrowly guarded DBA-only, audited manual path that shares the same erasure core. It is deliberately not usable for `auth_dispatched` or `auth_ambiguous` and cannot replay external Auth deletion. Browser and application service roles have no privilege to call that path.
7. No review-only SQL files are executable migrations; all review SQL stays in `docs/operations/candidates`. Static CI ensures candidates are excluded from running routes/scheduler and legacy finalizer continues disabled.

## Critical non-claims and independent release gates

- **Backup/restore HARD HOLD:** no authenticated provider backup/PITR, restore checkpoint, independent tested restore or owner-approved recovery is verified. Source-only schema snapshots are insufficient. Do not create an actual migration until this gate is satisfied.
- **External Auth HARD HOLD:** none of these tests verifies a real Supabase admin request, soft-delete HTTP protocol, GoTrue identity state, session revocation, Storage-owned objects, or PostgREST multi-connection behavior on a real project. A dedicated synthetic Development identity and verified cleanup require distinct approval.
- **Operator audit HARD HOLD:** the token-loss procedure records two different ticket strings but cannot verify that two human reviewers approved them. Security/DBA ownership, out-of-band approval and immutable external audit must be verified before even a synthetic manual invocation.
- **Privacy HOLD:** private completion-recipient storage needs approved lawful basis, minimal retention and escalation/purge rules. The current schema is review-only and retains PII until the outbox acknowledgment; a bounded failed-delivery response and privacy review are required.
- **Coordinated runtime/database HOLD:** the existing finalizer still calls old unfenced prepare/finalize RPCs, which the proposed SQL intentionally disables. Dormant candidate modules are not live adapters; no DB migration alone or old runtime activation can be safe. A coordinated production-ready finalizer/outbox worker and real rollback runbook remain to be implemented and approved.
- **Operations HOLD:** review of other SQL SECURITY DEFINER functions, views, Storage, session/JWT fencing, privacy cancellation/entitlements, and release owner approval remains necessary.
- **Production HOLD:** no Production DDL/DML, deployment, real identity deletion, provider email, feature flag, cron/commerce/Research/Score/entitlement action, or GitHub merge is authorized.

## Suggested next authorized work

1. Have an operator verify backup/restore evidence and actual Supabase Development schema/auth API settings without sharing secrets.
2. Independent SQL and privacy/security review of the proposed claim, RLS, completion escrow and DBA recovery stack; retain the review as dated owner-attested evidence.
3. Prepare a coordinated migration and finalizer **on an isolated synthetic Development branch only** after cost, backup, restore, privacy and ownership gates. Do not test against real users.
4. Re-run exact-head tests, verify external Auth/session/Storage and email outbox semantics, then request an entirely separate Production change approval.

**The current Draft is the last source-only checkpoint, not an activation request.**
