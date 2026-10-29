# Issue #950 — Development backup and isolated restore evidence gate

**Assessed:** 2026-10-29 (read-only). **State: HOLD — no specific backup listed or successfully restored.**
**Target:** `usd-impact-development`, Supabase ref `ycstrcvshdluovtuasjc` (Pro organization).
**Tracked release:** [Draft #968](https://github.com/usdimpact/usd-impact-site/pull/968), source SHA `0b97056ad5f4109298f1932d4a07c8c921b8a3d6`.
**Parent:** [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950).

## Evidence obtained without mutating the database

| Read-only fact | Verified value |
|---|---|
| Development project | ACTIVE_HEALTHY, PostgreSQL 17.6.1 |
| Organization plan | Pro |
| Supabase development branches | None |
| Database size (point-in-time aggregate) | 24,325,267 bytes |
| Public relations footprint | 10,420,224 bytes |
| Auth users (count only) | 9 |
| Storage buckets / objects | 2 / 21 |
| Storage objects with non-null `owner_id` | 0 |
| Pending account-deletion profiles | 0 |
| Atomic-claim table and recovery escrow | Not installed |
| Actual backup ID, backup time, restore success | **NOT VERIFIED** |

**Important:** 0 Storage owners **does not** mean 0 files. The 21 actual Storage objects are NOT included as file bytes in a physical database backup; database backups preserve metadata only. A database-only restore is not a complete service restoration.

Supabase documentation states that Pro projects receive daily backups with a seven-day retention window, but **plan eligibility is not evidence that a particular checkpoint exists or is restorable**. The Management API read-only `GET /v1/projects/{ref}/database/backups` can list available backups, but the connected Supabase app tools do not expose that endpoint. Do not paste a Supabase personal access token into chat or commit it to GitHub.

### Exact read-only dashboard procedure

1. Open the [Development backup page](https://supabase.com/dashboard/project/ycstrcvshdluovtuasjc/database/backups/scheduled). Verify the project reference in the URL and project header before inspecting any settings.
2. Record the latest **successful** backup checkpoint UTC, status, backup kind (physical/daily or PITR), oldest available restore point and configured retention. Do not click Restore on the active project.
3. Record the source project region, PostgreSQL major version, migration ledger count, and secure ownership/contact for the restore operation.
4. Review the **Restore to a New Project** operation for this project without executing it. The isolated restored project can contain real Auth users, password hashes, sensitive data, and Vault-encrypted records; it must be restricted, with outbound email, webhooks, cron, payment, login links and publishing disabled. Never use a restored customer identity for destructive QA.
5. Obtain independent consent for any recurring cost and any customer-data processing in the restore environment. **Read-only cost quotations:** a new project is $10/month; a Development branch is $0.01344/hour, subject to further provider usage. Neither was created.
6. In a separately approved operation, restore into a **new isolated project** (never over Development or Production), record source backup ID/checkpoint and target project ID privately, and verify the restore at PostgreSQL 17 without emails or identity deletions.
7. Verify schema/migration versions, policies, functions and protected profile/Auth aggregates, without exporting user rows into public issues. Verify separate copies of all **21 Storage file objects**, hash and count them, and confirm that post-restore URLs and rules do not expose them. Supabase physical backup alone does **not** restore those files.
8. Document an incident-grade recovery test: run a harmless synthetic transaction only on the isolated destination, roll it back, compare signed nonsecret schema/aggregate evidence to the source, prove no outbound side effects, and record a named independent witness.
9. Store the source backup ID, restore checkpoint UTC, target ref, operator and reviewer approvals, storage transfer/hash evidence, outcome and expiry in the **restricted company recovery register**, not the public repo. This document intentionally contains no user data, tokens, passwords or provider recovery codes.

### Gate completion criteria

The backup gate is **NOT PASSED** until a real provider-listed successful backup and its independent isolated restoration are confirmed, including data/Storage coverage, migration compatibility, confidentiality, exact source/target IDs, and a nonsecret dated operator attestation. If the checkpoint is older than its retention horizon, the restore was partial, or storage/email isolation was not demonstrated, remain HOLD. A schema-only `pg_dump`, a GitHub source archive, a Supabase Development branch, and a Vercel Preview are **not** substitutes for a full restoration exercise.

### No authorization granted

No new project, paid branch, PITR add-on, backup restoration, database migration, identity deletion, email, Vercel deployment or scheduler flag was started by this review. Even a verified backup does **not** authorize applying the claim SQL while the old finalizer remains incompatible. Require independent security/privacy review and a separately approved coordinated application+schema cutover.

Official references: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups); [Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project); [Management API backup list](https://supabase.com/docs/reference/api/v1-list-all-backups); [Resilience baseline](../operations/resilience-baseline.md).
