# Issue #950 — Supabase Development completed backups, read-only dashboard verification

**Dated check:** 2026-10-29. **Source:** authenticated, read-only Supabase Dashboard inspection. **Project:** `usd-impact-development` (`ycstrcvshdluovtuasjc`). **Status:** backup availability VERIFIED; independent restore NOT VERIFIED; release HOLD.

The Scheduled Backups and Restore to new project pages were inspected without selecting any backup, initiating a restore, downloading data, changing settings or creating a paid project.

| UTC backup timestamp | Type | Dashboard state |
| --- | --- | --- |
| 2026-10-29 03:14:21 | Physical | COMPLETED |
| 2026-10-28 03:14:08 | Physical | COMPLETED |
| 2026-10-27 03:14:04 | Physical | COMPLETED |
| 2026-10-26 03:18:48 | Physical | COMPLETED |
| 2026-10-25 03:17:40 | Physical | COMPLETED |
| 2026-10-24 03:19:19 | Physical | COMPLETED |
| 2026-10-23 03:20:51 | Physical | COMPLETED |
| 2026-10-22 04:29:11 | Physical | COMPLETED |

The Restore to new project tab is present and labeled **BETA**. Each completed backup has a Restore control, none of which was clicked. The page does not expose cost, resulting project name/region settings, or the final review/confirmation flow until further interaction.

A historical restore project, `usd-impact-restore-test-20260804`, appears with timestamp `2026-08-04 14:41:41 UTC`, status **REMOVED**. Its existence indicates a historical restore record, **not** a successful restore validation and not a current rollback capability.

**Storage warning visible in dashboard:** Physical backups restore database contents/metadata, **not Storage object bytes**. Prior read-only Development inventory found 21 Storage objects in two buckets and nine Auth users. An isolated restore must separately secure/verify Storage files and avoid outbound messages, Auth identity use, webhooks, payments, scheduled jobs and customer contact.

## Revised gating decision

- **Backup availability:** PASS (eight UI-listed completed backups on the correct Development project).
- **Backup independent restoration:** HOLD (no restore performed, health/functional acceptance absent).
- **Restored project identity and data handling:** HOLD (customer identities and Storage need separate consent, isolation, evidence).
- **Cost and action approval:** HOLD (dashboard did not show price before Restore action; connected Supabase cost estimate was $10/month for a new project, not a verified checkout price).
- **Claim-aware runtime, full migration, privacy/DBA/security acceptance:** HOLD.
- **Production activation:** HOLD.

**Next operator checkpoint:** review actual restore price and isolation controls, explicitly authorize creation of a separate paid restore project with customer-data safeguards, then independently verify restoration. Do not overwrite Development/Production or treat this source-only evidence as authorizing deletion SQL.

[Development backups](https://supabase.com/dashboard/project/ycstrcvshdluovtuasjc/database/backups/scheduled) · [Restore to new project](https://supabase.com/dashboard/project/ycstrcvshdluovtuasjc/database/backups/restore-to-new-project) · [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950)
