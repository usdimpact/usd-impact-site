# Issue #950 — Dated read-only Development schema contract acceptance

**Date:** 2026-10-29. **Disposition:** SELECT-only metadata check PASS; release remains HOLD.
**Project:** `usd-impact-development` `ycstrcvshdluovtuasjc`, PostgreSQL 17.6.
**Source baseline:** Draft #970 `49877ab47d77bf4a1e641b6ee5a4c6cb46ad42f5`.

Executed the byte-for-byte read-only SQL from `docs/operations/queries/account-deletion-issue950-dev-schema-contract.read-only.sql` through the connected Supabase `execute_sql` action, targeting **only Development**. First attempt identified a SQL spelling error (`pg_catalog.coalesce`); fixed it in the review-only file before rerunning. Successful result:

| Test | Result |
|---|---|
| 39 selected column names and Postgres types | MATCH |
| 14 named authenticated RLS policies, command kinds and grants | MATCH |
| 3 existing deletion functions, SHA-256 body digests, SECURITY DEFINER owners, execution grants | MATCH |
| Profile/Auth FK `ON DELETE SET NULL` contract | MATCH |
| Outbox unique indexes for idempotency and business state | MATCH |
| No partially installed claim table, completion escrow, new request UUID column or target trigger | MATCH |
| `account_deleted` entitlement enum | MATCH |
| Due/pending real deletion profiles | 0 |
| Unresolved findings | **0** |
| Verified backup/restore | **NO** |
| Schema migration / Production approval | **NO** |

The selected checks are explicit and bounded; they are **not** a full dump/DDL diff. RLS policy predicates, function declarations, triggers, roles, default privileges, Auth/Storage schema and migration history must still receive independent complete security review. Supabase 17.6 is not automatically equivalent to local CI PostgreSQL 17 across minor-version or extension differences.

This query is intentionally a non-PII metadata contract with pinned function SHA-256 digests rather than raw function bodies or customer rows. It should be rerun immediately before any separately approved Development cutover; any mismatch is a STOP, not permission to patch the database.

New recent Supabase changelog notes: 2026-08-12 fix for skipped daily backups, 2026-09-25 PostgreSQL minor-update/extension breaking-change warning, and 2026-10-12 TLS cipher removal scheduled for 2026-11-10. These do not change the Auth/Admin contract today but reinforce provider compatibility and actual backup evidence requirements.

**HARD HOLD:** no verified provider checkpoint/restore, no live Auth Admin test, no full schema diff, no linked application cutover, no schema migration or Production activation. Issue #950 remains open.
