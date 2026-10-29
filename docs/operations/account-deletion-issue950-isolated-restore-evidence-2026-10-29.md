# Issue #950 — Paid isolated restore evidence and acceptance

**Date:** 2026-10-29 UTC. **Current disposition:** restore project CREATED; database restore still RESTORING at this checkpoint. **Account-deletion release remains HOLD.**

## User authorization and billing

The user explicitly approved the budget and the prior request to create a temporary isolated restoration project. The authenticated Supabase restore wizard quoted **$9.68/month additional compute + $0/month additional disk**, excluding ordinary usage (no add-ons), within the previously disclosed approximately $10/month budget. Exactly one paid project was created.

| Identity | Value |
| --- | --- |
| Source | `usd-impact-development`, `ycstrcvshdluovtuasjc` |
| Physical backup | **2026-10-29 03:14:21 UTC**, dashboard state `COMPLETED` |
| Restore type | **Restore to NEW project**, NOT in-place |
| Destination | `usd-impact-restore-issue950-20261029`, `movnekagnxgcyenczfoc` |
| Region | `eu-central-1` |
| Project created | 2026-10-29 21:42:47 UTC |
| Provider project status | Initially `COMING_UP`, subsequently `RESTORING`; no successful restore attested yet |
| Source PostgreSQL | 17.6 |
| Target initially provisioned PostgreSQL | 17.11.0.003 — different **minor version**, require post-restore schema verification |

[Temporary destination](https://supabase.com/dashboard/project/movnekagnxgcyenczfoc) · [Source backup list](https://supabase.com/dashboard/project/ycstrcvshdluovtuasjc/database/backups/restore-to-new-project).

## Pre-clone side-effect check (read-only, Development only)

Supabase documentation states that a physical/binary clone may restart previously configured `pg_cron`, `pg_net` and wrappers immediately; the wizard has **no pre-create option** to disable these jobs or Auth/Data API/network. We verified current source catalog **before** creation:

- Installed extensions: `plpgsql`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault` only.
- No installed `pg_cron`, `pg_net`, `http`, `wrappers`, `postgres_fdw`, or `dblink`.
- No `cron.job` table, no `net.http_request_queue` table, zero foreign servers and zero enabled webhook-like triggers.
- One source-code match for HTTP keywords was the standard `extensions.grant_pg_net_access` helper; **the extension is not installed**.
- Existing Supabase platform event triggers remain. No source application deployments, credentials, scheduler, or extension settings were changed.

**Important limitation:** these checks reduce, but cannot completely rule out, non-extension external side effects. Do not publish or connect the clone's API endpoint to an application. Auth settings and API keys are not copied; JWT secrets are unique to the destination, which further limits existing tokens.

## Source snapshot for independent restoration comparison

A successful read-only aggregate-only query is retained in `docs/operations/queries/account-deletion-issue950-isolated-restore-aggregate.read-only.sql`. Its source results (2026-10-29, after the physical backup) were:

| Non-PII aggregate | Source |
| --- | ---: |
| Profiles | 9 |
| Auth user records | 9 |
| Auth session records | 85 |
| Entitlements | 10 |
| Privacy request rows | 0 |
| Notification outbox rows | 33 |
| Storage buckets (metadata) | 2 |
| Storage objects (metadata) | 21 |
| Migration ledger entries | 55 |
| Public/Auth/Storage columns | 726 |
| Public RLS policies | 19 |
| Legacy deletion functions | 3 |

**Source metadata fingerprints (SHA-256, no user rows):**

- Schema columns: `0b8863dc62e3f52066990b5c051bdfeedf6504255b1956a2eced351aaa620219`
- Public policies: `73578c5ac3e989249ca2907d684fdf14d529a332501e38754fe9ebef127bdc25`
- Three legacy deletion functions: `32fc7bd66def8110e1bb01a780eab6963b685f0c9cf90d9a1fbf3639a482b63a`

These are source observations **after** backup creation, not a point-in-time attestation of 03:14 UTC. Any clone-vs-live difference must be investigated for legitimate intervening changes before declaring restore failure. PostgreSQL minor-version changes may also affect metadata representations.

## Mandatory post-restore gates (NOT YET VERIFIED)

1. Provider status `ACTIVE_HEALTHY` or equivalent, with the exact target project ID and completed restore job.
2. Immediately disable **Data API** on **destination only**, and restrict new Auth signups/email providers where project UI permits. Verify outbound integrations cannot contact customers. Do not alter the source or Production.
3. Run the same query **read-only** on destination. Compare schema/policy/function fingerprints, migrations, Auth/Profile/entitlement/outbox counts and Storage metadata; do not log PII.
4. Prove source and target are distinct: new API keys and destination reference, no Vercel/other production deployment integration.
5. A separate non-production/synthetic rollback or harmless transaction probe may be used, but **no Auth DELETE** on any copied real identity and no email send.
6. **Storage file bytes are NOT included** in a physical database clone, even if 21 Storage metadata rows appear. Copy and verify files separately only through an approved secure data-transfer method and separately review Storage access controls; do not publish or log private file contents.
7. Record a successful or failed restore attestation without sensitive row data, plus a cleanup owner and deletion plan. The temporary project incurs charges until decommissioned.

**No approval to merge PRs, migrate source or Production SQL, switch active application credentials, run real-user deletion, send email, or activate Issue #950.** Green source-only CI remains separate.

Official documentation: https://supabase.com/docs/guides/platform/clone-project ; https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/api/securing-your-api .
