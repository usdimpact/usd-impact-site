# Issue #950 — Paid isolated restore evidence and acceptance

**Date:** 2026-10-29 UTC. **Current disposition:** independent database restore and selected integrity checks **PASS**; actual Storage bytes and full application recovery remain **HOLD**. **Account-deletion release remains HOLD.**

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
| Provider project status | **`ACTIVE_HEALTHY`** after the restored database became available |
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

## Post-restore acceptance and remaining gates

1. **PASS —** Provider reports target `ACTIVE_HEALTHY`, correct ref/name and new PostgreSQL 17.11.0.003 instance. A restored database is queryable; no external customer workflow has been used.
2. **PASS (observed dashboard settings) —** Data API `Enable Data API=OFF` with explicit `Data API disabled` confirmation; `Allow new users to sign up=OFF`, `Allow anonymous sign-ins=OFF`, and Email Auth provider `DISABLED`. Other Auth providers also show disabled. `Allow manual linking` remains ON, but cannot independently perform an Auth sign-in. No application, Vercel project or outbound provider was connected; source and Production untouched.
3. **PASS —** The exact same read-only aggregate SQL ran against the restored project and matched the source on **every reported aggregate**, both hashes and installed extension names. Source and restore each have 9 Auth users, 85 sessions, 9 profiles, 10 entitlements, 0 privacy requests, 33 outbox rows, 55 migration entries, 726 schema columns, 19 public policies, 3 original deletion functions and 21 Storage metadata records. Separate `list_migrations` returned 55/55 exact version+name matches. Hashes match all three baselines above.
4. **PASS (project identity) —** Source `ycstrcvshdluovtuasjc` and restored destination `movnekagnxgcyenczfoc` are distinct. Supabase creates new Auth settings/API keys rather than transferring originals, and no app integration was changed; actual key **values were deliberately never read**.
5. **PASS (synthetic-only rollback) —** On destination only, one temporary `issue950_restore_synthetic_probe` table was created in a transaction, one synthetic integer inserted, and the entire transaction rolled back. A same-call `to_regclass('pg_temp.issue950_restore_synthetic_probe') IS NULL` check returned `true`. No permanent schema change, user write, Auth DELETE or email.
6. **HOLD (real Storage bytes) —** Both source and destination have matching metadata for **20 private objects** in `library-pass-assets` (372,647,590 bytes recorded) and **1 private object** in `library-pass-books` (2,281,645 bytes recorded): total **374,929,235 bytes** (~375 MB). These are *metadata sizes, not verified restored bytes*. Supabase's physical clone **does not copy actual Storage file bytes**; neither fetch nor bulk secure transfer has been attempted. Separate access/transfer/hashing approval remains necessary.
7. **PARTIAL —** Database restore PASS, nonsecret evidence recorded here and Issue #950; full service restore remains HOLD for Storage and external configuration. A named cleanup owner/date still needs assignment. Cost is $9.68/month extra plus ordinary usage until the temporary project is removed.

**No approval to merge PRs, migrate source or Production SQL, switch active application credentials, run real-user deletion, send email, or activate Issue #950.** Green source-only CI remains separate.

Official documentation: https://supabase.com/docs/guides/platform/clone-project ; https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/api/securing-your-api .


## Post-restore security advisor and environment comparison

- Connected Supabase project inventory shows **Development**, **Production** and the **restored destination** each `ACTIVE_HEALTHY` with distinct refs; only the new project runs PostgreSQL 17.11, source/Production run 17.6. Matching SQL hashes mitigate but do not erase the need to review this minor-version change before an actual production rollout.
- Source and destination migration ledgers matched **all 55 version+name entries**.
- Read-only security advisor on clone reported 17 informational `rls_enabled_no_policy` instances and one `auth_leaked_password_protection` warning. These should be reviewed as existing schema/platform controls; the restored **Data API remains disabled** and the providers are off. See [RLS no policy remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [Auth leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The restored PostgreSQL image is **17.11** while source was **17.6**. Full application parity, load, and legacy Auth/session semantics have **not** been tested.
- External backup/Storage/SMTP/Auth/Edge Function configuration is intentionally **not** copied or activated. No version of the claim/fencing/escrow SQL was installed, and no original source/Production data or deployed application was modified.

## Release classification

**DATABASE RESTORE GATE:** PASS for a provider-created independent restore, non-PII integrity fingerprint match and synthetic rollback test.

**FULL SERVICE RESTORE GATE:** HOLD pending 21 actual private Storage file copies/hashes and separately approved external integrations (if required).

**ACCOUNT DELETION GO-LIVE:** HARD HOLD pending independent privacy/security/DBA review, coordinated SQL+runtime finalizer cutover, protected synthetic real Supabase Auth/JWT/Storage tests, and separate Production approval. Green CI + a database restore do **not** permit Auth soft deletion of any actual copied or real customer account.

**COST/CLEANUP:** The temporary project `movnekagnxgcyenczfoc` is billable at the quoted $9.68/month compute amount plus usage. Do not allow it to become a permanent unknown-cost project; plan decommissioning after necessary security/restore evidence is collected, with an explicit review before deletion.
