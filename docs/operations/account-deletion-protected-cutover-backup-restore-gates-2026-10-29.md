# Issue #950 — Account-deletion protected cutover, backup and recovery hold

**Recorded:** 2026-10-29. **Status:** no-release engineering checkpoint; these steps are not permission to mutate real users or Production.

## Verified baseline (read-only Development)

Canonical Development Supabase project: `ycstrcvshdluovtuasjc`, PostgreSQL 17.6. No claim table, request-generation column, claimed RPC, recovery escrow, or 14-policy Auth-link RLS fence is installed. Existing plain-ID preparation and finalization RPCs remain service-role callable.

The reusable, non-PII SQL at `docs/operations/queries/account-deletion-issue950-preflight.read-only.sql` was executed successfully on Development during this review. It returned:

| Observed count | Result |
| --- | ---: |
| Pending profiles | 0 |
| Detached pending profiles | 0 |
| Storage buckets | 2 |
| Storage objects with recorded owner | 0 |
| Auth sessions attached to pending profiles | 0 |
| Direct authenticated own-record RLS policies checking auth.uid | 14 |
| Such policies also checking canonical profile Auth link | 0 |
| Completed-account-deletion outbox messages | 0 |

The query performs no data changes and does not expose account identifiers, email addresses or secrets. An aggregate of zero owned objects is **not** a substitute for the synthetic case with Storage-owned objects.

## A. Independent backup and restoration evidence — STOP until proved

1. Identify the exact Development project and environment. Never confuse it with Production. Document the GitHub schema/app SHA, protected-main/Production SHA, Data API exposed schema settings, scheduler and delivery flags (do not include credentials).
2. Obtain the provider's confirmed backup method, checkpoint/timestamp and retention from the Supabase dashboard/operator. No connected tool in this review has verified a PITR/backup or a tested restore. **A successful read-only SQL preflight is not a backup.**
3. Export the current schema and the exact original function definitions, privileges, RLS policies, triggers, constraints, indexes and migration history using authorized, secure administration. Keep backups in restricted storage, not GitHub PRs or chat attachments. A `pg_dump --schema-only` cannot restore user data and does **not** replace a database backup.
4. Prove a disposable isolated restore on the same PostgreSQL major version. Confirm that the pre-claim environment can be started without making emails, Auth deletes or payments. Record restore checkpoint ID, test date, encrypted storage location, access owner and outcome without exposing secrets.
5. Verify an explicit fail-closed rollback/runbook at each boundary and that it does not mistakenly restore customer entitlements, reattach deleted Auth identities or replay webhook purchases.
6. If any backup, restore or environment/identity match is absent, **STOP. No Development migration.** A new Supabase branch may incur charges; no branch was created by this work.

## B. Coordinated cutover gates (all separately reviewed)

1. Freeze existing account-deletion scheduler and reconcile all pending real requests first. The currently dormant old finalizer uses nonexclusive `prepare_account_deletion_auth_removal` and `finalize_account_deletion`; applying the new claim SQL without changing that runtime would deliberately make it fail closed.
2. Independent SQL/security review: stable request UUID, unique claim generation, token-digest storage, lock-time clock sampling, detached FK/one-shot dispatch intent, service-only RPC grants, private schema RLS and the replacement of old plain-ID RPC entrypoints.
3. Independent RLS review for 14 exposed read/update/delete policies, full function/view and Storage Data API audit, and signed JWT/session behavior. Pre-dispatch pending account UX and cancellation must not silently break.
4. Review temporary recipient escrow and the existing notification outbox. The proposed completion escrow is written **in the same SQL transaction as erasure** and scrubbed after the exact existing outbox identity is persisted. Approve legal basis, privacy retention, manual escalation timeout, field-level access and full purge protocol; no indefinite quiet PII retention.
5. Develop and independently test the coordinated production-grade finalizer and on-call recovery worker. Dormant `offline_fixture` modules are NOT live adapters, and no scheduler imports them. Inject the exact existing outbox identity and approved email policies; do not send email merely because the account was finalized.
6. Apply a real CLI-generated migration to **Development only** once backup/restore evidence and approval are recorded; verify each SQL function, grant, schema exposure and security advisor; never apply a review SQL candidate in a live SQL editor without the approved migration plan.
7. Protected synthetic Development acceptance must cover real multiple PostgREST connections, exact Auth Admin service credentials, JSON `should_soft_delete`, Auth 200/204/404/503/timeout, Storage ownership obstruction, preexisting JWT/session refresh, subscription/entitlement revocation, full data erasure, one durable completion intent and email suppression/dispatch consent. Dedicated synthetic identities only; record cleanup attestation.
8. Only after all gates pass, seek a separate explicit Production change/rollback signoff, re-run the read-only preflight on both environments, and pin source/migration SHA with a qualified release owner. Never infer permission from green Preview CI.

## C. Crash/recovery matrix

| Boundary | Expected durable state | Automatic action permitted | Required recovery |
| --- | --- | --- | --- |
| Before claim | Pending and due; Auth FK linked | New exclusive claim after fresh due check | Re-scan only |
| Claimed, before dispatch | Pre-dispatch token/lease | New generation **only after lease expiry** and row lock | Confirm no dispatch ever committed |
| `auth_dispatched` committed, Auth request never sent | FK null, one-shot dispatch intent | **No Auth DELETE retry** | Manual verified Auth status, then evidence-backed decision |
| Auth request timed out or returned unexpected response | Unknown external Auth outcome | **No Auth DELETE retry or finalization** | Read-only Auth verification and manual reconciliation |
| Auth request succeeded but confirmation RPC response lost | DB might be `auth_dispatched` or `auth_confirmed` | **No Auth DELETE replay** | Verify claim, Auth outcome and DB state separately |
| Auth was confirmed in SQL, worker dies before finalization | `auth_confirmed`; original token only hashed in DB | **No token forgery/replay** | Dedicated operator-approved tokenless confirmed-state recovery is STILL TO BE DESIGNED |
| Profile erasure core errors before completion escrow | Transaction rolls back; no profile deleted | Only exact verified fenced finalization retry | Investigate SQL, entitlement, storage/privacy issue |
| Erasure + escrow transaction commits; worker dies before outbox enqueue | Profile deleted; private recipient pending | The separately approved **completion-only** recovery worker may enqueue idempotently | No Auth DELETE; use exact existing completion message identity |
| Outbox inserted; escrow-ack response lost | Outbox durable; escrow may or may not be scrubbed | Safe idempotent outbox identity lookup/ack only | Verify recorded outbox; no second provider send |
| Auth was already deleted; schema rollback requested | External identity irreversible | **NO automatic rollback** | Identity-aware operator/manual legal and support response |

**Important extra gap:** the current claim state stores only a hash of the worker token. A process crash after Auth has been confirmed but before the claimed finalization call can lose the only plaintext token. Existing draft SQL has no separately approved, evidence-based tokenless *confirmed-state-only* finalization continuation. That requires a narrowly scoped, auditable operator action, distinct from reconciliation of genuinely ambiguous Auth outcomes. Do not work around it by resetting `auth_dispatched`, guessing the token, calling the legacy plain-ID finalizer, or automatically repeating Auth DELETE.

## D. Explicit stop and restore criteria

- A failing SQL migration step, lost credential validation, claimed/dispatch state mismatch, missing backup, anomalous signed-JWT access, Storage owner obstruction, outbox identity mismatch, missing recipient escrow, failed security advisor gate, or unreviewed real-account candidate triggers STOP.
- Before an external Auth dispatch: stop the scheduler, keep the old runtime disabled, and use only the tested schema restore/cutover steps, with no entitlement replay.
- After an external Auth dispatch: do not blindly restore an earlier DB snapshot; it cannot re-create the correct external Auth state and may resurrect grants or privacy records. Use an account-specific read-only provenance check and the manual incident runbook.
- Do not send or re-send a confirmation message until the database has durably finalized and the exact outbox identity is verified. Enforce bounded retries and privacy retention, not indefinite storage.

## E. Current evidence hierarchy

- [Draft #962](https://github.com/usdimpact/usd-impact-site/pull/962): 32/32 baseline source-only workflows, Vercel Preview READY, no Production activation.
- [Draft #963](https://github.com/usdimpact/usd-impact-site/pull/963): atomic completion escrow and rollback tests.
- [Draft #964](https://github.com/usdimpact/usd-impact-site/pull/964): dormant completion-only outbox recovery; exact identity and no-activation tests.
- [Draft #965](https://github.com/usdimpact/usd-impact-site/pull/965): real PostgreSQL 17 post-lock lease expiry test.
- This final integration Draft: all previous tests re-run on a single exact head, subject to GitHub workflow completion.

**All green offline tests remain necessary but insufficient.** No real user, Auth Admin request, Development/Production SQL DDL or DML, provider email, changes to commerce/entitlements/Research/Score or finalizer flag/cron activation are authorized from this document.


## F. Dated continuation — 2026-10-29 (after Draft #968)

**Historical statement correction:** Section C's row saying that confirmed-state token-loss recovery is "STILL TO BE DESIGNED" recorded the earlier design state. The source-only candidate was subsequently staged in [Draft #967](https://github.com/usdimpact/usd-impact-site/pull/967) and included in [Draft #968](https://github.com/usdimpact/usd-impact-site/pull/968), with offline PostgreSQL and independent-connection tests passing. The restricted procedure remains unapproved for any real Supabase application; real operator signoff, backup and restore are still missing. This note does not backdate the original review.

**New read-only findings:** The connected Supabase organization is Pro (normally seven days of daily backup retention), but no actual backup checkpoint or successful restore has been verified. An isolated new-project restore has an independently quoted $10/month base cost; a Development branch has a $0.01344/hour cost. No paid project or branch was created. Development contains 2 Storage buckets with 21 objects, none with a recorded owner, and 9 Auth users. Database backups do not include Storage file bytes. The migration ledgers currently have 55 Development and 57 Production entries; only 39 exact version+name pairs are common. These are additional independent pre-cutover gates, not permission to run SQL or Auth deletion.

See [dated backup evidence intake](./account-deletion-issue950-backup-restore-evidence-gate-2026-10-29.md) and [migration-history reconciliation](./account-deletion-issue950-current-migration-ledger-delta-2026-10-29.md).