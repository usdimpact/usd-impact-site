# Backup and recovery hardening baseline — 2026-10-23

Status: **READ-ONLY EVIDENCE / RESTORE NOT EXECUTED**

This record evaluates recoverability of the USD Impact production application without exporting customer data, changing Supabase, creating a restore project, or performing a Production restore.

## Production database identity

Project: `usd-impact-production`
Project ref: `gjzetjugmnwanvjkchux`
Region: `eu-central-1`
Status observed: `ACTIVE_HEALTHY`
PostgreSQL engine: 17

Observed application database baseline:
- 53 migration-ledger entries;
- 30 tables across `public` and `sed_newsletter`;
- every listed table has RLS enabled;
- latest migration-ledger entry: `20261019123956_stage_sed_consent_no_login_roles_20261019`.

Exact customer/user row counts are deliberately not retained in this repository hardening record.

## Provider backup/PITR evidence

The currently available Supabase connector exposes project, schema, migration, advisor, log and SQL metadata, but does not expose backup history, backup retention, restore points, or PITR configuration.

Therefore:
- database backup retention: **UNKNOWN from current direct evidence**;
- PITR enabled/configured state: **UNKNOWN from current direct evidence**;
- most recent restorable point: **UNKNOWN**;
- successful website-production restore exercise: **NOT ESTABLISHED**.

Do not infer backup/PITR readiness solely from the project being healthy or on a paid plan.

The existing `docs/operations/resilience-baseline.md` is dated 2026-07-30 and explicitly required confirmation of backup/PITR capability and an isolated restore exercise. It should be treated as policy/runbook history, not proof that those controls were subsequently completed.

## Existing recovery rehearsal is not website restore proof

A separate active Supabase project exists:
`impact-control-recovery-rehearsal-20261001`.

Its observed schema contains Control Center objects such as `crm_*` and `evidence_*`, with recovery-labelled migrations. It does **not** reproduce the current USD Impact website production schema.

Accordingly, it is useful evidence of recovery practice for a different system, but it does not satisfy `BACKUP-RECOVERY-01` for `usd-impact-production`.

## Migration source reconciliation

Current website repository:
- `supabase/migrations/`: 48 SQL migration files.

Production Supabase migration ledger:
- 53 entries.

The exact filename/version sets do not match.

### Reconstructable timestamp remapping

Most historical mismatches are the same logical migration names recorded in Production under different timestamps than their repository filenames. These include the private Library Pass bucket, Research Membership migrations and email/newsletter outbox migrations.

This is migration-history drift. It is not by itself evidence of live schema divergence, but it complicates deterministic rebuilds and must be normalized in the restore ledger.

### Repository migration absent from Production ledger

Repository migration:
`20260830193000_harden_support_privacy_insert_integrity`

is not present by that name/version in the Production migration ledger.

However, read-only live catalog checks confirm its intended security effects are present:
- authenticated has no table-level INSERT on `support_requests`;
- authenticated INSERT is limited to the five application input columns;
- workflow/timestamp columns are not insertable by authenticated;
- authenticated cannot directly INSERT `privacy_requests`;
- `support_requests_insert_own` exists;
- legacy `privacy_requests_insert_own` does not exist.

Classification: **ledger/provenance drift, not an observed authorization regression**.

### Production-only sed_newsletter migration records

Production migration ledger contains six `sed_newsletter` migrations that are not present in the website repository:
- `20261010134741_sed_newsletter_private_baseline_20261010`
- `20261010141022_sed_newsletter_private_rpc_20261010`
- `20261010142655_sed_newsletter_preview_role_bootstrap_20261010`
- `20261010142748_sed_newsletter_preview_login_halt_20261010`
- `20261010142751_sed_newsletter_bootstrap_cleanup_20261010`
- `20261019123956_stage_sed_consent_no_login_roles_20261019`

The separate `usdimpact/siguiendo-el-dolar` repository establishes that `sed_newsletter` belongs to that product/workstream and was intentionally targeted at the existing `usd-impact-production` project.

Recovered source evidence:
- branch `preview/vercel-migration`
- `drizzle/migrations-sed/0001_private_schema.review.sql`
- `drizzle/migrations-sed/0002_private_rpc.review.sql`

These review SQL files provide source provenance for the baseline/private-RPC design and explicitly require manual migration authorization.

The currently inspected repository state does **not** establish source-controlled SQL provenance for the later four Production ledger steps:
- preview role bootstrap;
- preview login halt;
- bootstrap cleanup;
- staged no-login consent change.

Classification: **P0 recovery provenance gap until exact applied SQL or an equivalent immutable migration artifact is located and retained**.

Do not recreate these migrations from memory or reverse-engineer and then falsely label the reconstruction as the original source.

## Recovery acceptance target

A future isolated website restore is acceptable only if all of the following are independently evidenced:

1. exact source backup/restore-point identifier and timestamp;
2. restore performed into a non-production target;
3. all 53 current Production migration-ledger entries reconciled to immutable source artifacts or explicitly documented historical remappings;
4. current schema object inventory reproduced;
5. RLS remains enabled on all expected tables;
6. intentional-deny tables retain zero browser-role grants/policies;
7. account-deletion privileged boundary matches the attested contract;
8. commerce/entitlement uniqueness and idempotency constraints are present;
9. `sed_newsletter` roles/functions/grants match their approved source artifacts;
10. no live email, payment, entitlement, customer mutation or production DNS/deployment action is triggered by the restore test;
11. restored application can pass non-destructive validation against an isolated Preview;
12. recovery evidence records hashes, migration reconciliation and operator approval without publishing PII or secrets.

## HOLD / next safe evidence

Do not run a Production restore or create a paid restore project as part of this PR.

The next safe evidence sequence is:
- verify provider backup-retention/PITR settings in the authenticated Supabase control plane;
- locate and retain the exact SQL/source artifacts for the four unresolved `sed_newsletter` ledger entries;
- create a restore exercise plan with explicit cost/target approval;
- only then perform a separate isolated restore rehearsal;
- compare restored schema/security contracts with the current read-only baseline;
- retain a signed/hashed restore certificate.

Until that is complete, `BACKUP-RECOVERY-01` should remain **E_UNKNOWN / P0** rather than being upgraded from indirect evidence.
