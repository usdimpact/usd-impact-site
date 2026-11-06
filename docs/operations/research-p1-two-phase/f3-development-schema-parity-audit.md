# F3 — Development UI02/UI03 and shared-outbox schema parity audit (revised after Claude P1)

**Status: PREPARED FOR REVIEW ONLY — NOT AUTHORIZED TO RUN AGAINST HOSTED DEVELOPMENT; F3 NOT VERIFIED; PRODUCTION NO-GO.**  
**Repository:** `usdimpact/usd-impact-site`. Stacked Draft #1178 on #1173 on #1164; all remain unmerged.  
**Canonical Development:** `ycstrcvshdluovtuasjc`. **Production project is excluded.**  
**Query pack:** [f3-development-catalog-readonly.sql](./f3-development-catalog-readonly.sql), revision-controlled as the **single executable source** for 20 system-catalog SELECTs. A separate CI contract runs this pack against disposable synthetic PostgreSQL 17, *not* hosted Development.  
**Independence:** Claude's adversarial AI review is a second model review, not an independent human audit or owner acceptance.

## 1. Grounded scope and hard limits

Read-only Supabase **management metadata**, checked November 6, 2026, showed 58 Development migrations including these three Development-only UI02/UI03 migrations:

- `20261030214706 ui02_atomic_purchase_access_locale_dev`
- `20261030221037 ui02_language_privacy_lifecycle_dev`
- `20261030234009 ui03_account_media_locale_preview_dev`

It showed 57 Production migrations, without these three. The proposed Research P1 migration `20261105190000_research_p1_billing_safe_lifecycle.sql` was not installed in either environment. Those numbers are **owner/author-observed management metadata, not verified by Claude**, and do **not** prove live function definitions, grants, trigger state or schema compatibility. Revalidate metadata at the exact time of an authorized catalog audit.

**No connected SQL, table-row read, hosted Auth, merchant, cleanup operation or migration is authorized by this packet.** A generic approval to continue Draft work cannot authorize hosted access.

## 2. Separate, tightly bounded owner permission required

Before any Development catalog read, the owner must approve all of: the exact **canonical Development** project; the pinned commit and 20-query SQL pack; a specified already-available **least-privileged, SELECT-only audit role** (mandatory, *not* the SQL Editor's default owner/superuser); a `READ ONLY` transaction and short query timeout; the named reviewer; and where/how long restricted catalog evidence is retained. If that role cannot access needed catalog metadata, **HOLD** and seek a separate access decision; do not change hosted grants/roles to make the audit work.

Execute only after authorization, inside a single bounded consistent snapshot (and check every query result for truncation, missing schema, and permission errors):

```text
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5000ms';
SET LOCAL search_path = pg_catalog;
-- Run the 20 approved SELECT statements from f3-development-catalog-readonly.sql,
-- under the authenticated, least-privileged audit connection.
ROLLBACK;
```

The transaction wrapper is an *example*, not an authorization or a connected command to execute now. Never query `auth.users`, `storage.objects`, `cron.job`, `supabase_migrations.schema_migrations` or customer/payment/email rows. Catalog metadata about these tables is in scope; their **records are not**. Do not use Supabase SQL Editor/REST service-role privileges merely because they are convenient.

Raw `pg_get_triggerdef`, view definitions, `pg_get_expr`, ACL and routine configuration may still contain sensitive literals; restrict and inspect them before sharing. GitHub/PR/CI receive only sanitized object identifiers, counts, nonsecret checksums, findings and verdicts. A successful hash match alone is not evidence of semantic or permission compatibility. Always set **`search_path = pg_catalog`** on both replay and approved Development audit before comparing definition hashes, record Q00 `server_version_num`, and avoid claims of byte-equivalence across PostgreSQL versions. Use only the Q17 variant compatible with Q00 (PG15 or PG16+).

## 3. Complete inventory — 20 catalog-only queries

The previous five queries omitted checkout and Library Pass functions, enum labels, standalone unique indexes, policy roles, default grants and storage/event-trigger coverage. The revision inventories **all non-system schemas**, including `auth`, `storage`, `public` and extension namespaces, instead of filtering functions by a list of keywords.

| Query | Evidence collected |
|---|---|
| Q00_SERVER_VERSION | Records `server_version_num`, selecting PG16+ Q17 or a separately marked PG15-compatible Q17 variant. The hosted Development version is unknown. |
| Q01_TRIGGERS | All noninternal triggers and attached functions, including storage/auth; trigger type, argument **count** and a definition **hash only** — no raw trigger arguments or headers |
| Q02_EVENT_TRIGGERS | Database event triggers and their owning functions |
| Q03_COLUMNS_AND_DEFAULTS | Non-system table/view column types, nullability, identity, default presence and **hashed** default expressions only |
| Q04_ALL_ROUTINES | Every non-system routine including Library Pass/Research checkout and binding, owners, security-definer and effective EXECUTE; routine-body and configured search-path **hashes only** |
| Q05_CONSTRAINTS | Constraints, validity, deferrability and **definition hashes only** |
| Q06_ALL_INDEXES | All indexes including unique/partial/expression indexes without backing constraints; **definition hashes only** |
| Q07_ENUM_LABELS | Complete ordered labels of enum types (not merely column type names), including privacy request/status where present |
| Q08_RLS_POLICIES_AND_ROLES | Enabled/forced RLS, policy roles and modes, USING/WITH CHECK **presence and hashes only** |
| Q09_TABLE_DML_ACL | Table-level effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for `anon`, `authenticated`, `service_role` |
| Q10_COLUMN_ACL | Explicit column grants with **resolved grantor/grantee role names**, privilege and grant option; inspect inherited table rights via Q09 |
| Q11_DEFAULT_ACL | `pg_default_acl` at global and schema scope, critical for future `SECURITY DEFINER` function grants |
| Q12_PUBLICATION_MEMBERSHIP | Explicit table, all-schema and all-tables publications; INSERT/UPDATE/DELETE/TRUNCATE flags, column-list attnums and **row-filter hash only** (not raw predicate) |
| Q13_SCHEMA_PRIVILEGES | Schema owner and effective USAGE/CREATE for application roles |
| Q14_VIEWS_AND_SECURITY_BARRIER | View-definition **hash only**, ownership, `security_invoker`/`security_barrier` options and materialized-view inventory |
| Q15_EXTENSIONS | Extension names, installed versions, owners and schemas |
| Q16_ROLE_ATTRIBUTES | `pg_roles` authorization flags, including `BYPASSRLS`, LOGIN, SUPERUSER and role-creation capabilities; **never** `pg_authid` password material |
| Q17_ROLE_MEMBERSHIPS | `pg_auth_members` grantor/role membership options; use PG16+ definition with inherit/SET options, or **Q17 PG15 variant** (NULL for unsupported columns) |
| Q18_SEQUENCES_AND_ACL | `pg_sequence` metadata and effective USAGE/SELECT/UPDATE privileges; **never** `pg_sequences.last_value` runtime data |
| Q19_DOMAIN_CONSTRAINTS | Non-system domain checks with type, validity and a **constraint-definition hash**, including `conrelid=0` objects |

**Default credential protection:** Database-webhook trigger arguments can contain bearer tokens, API keys or signed URLs. Q01 MUST NEVER emit `pg_get_triggerdef` as plaintext. Its output contains only argument count, trigger type bits and `md5(pg_get_triggerdef)` alongside object identity; full arguments/definitions require a **separate, item-specific sensitive-source approval**, not this pack. The disposable contract deliberately creates a synthetic trigger with `Authorization: Bearer sb_secret_...` and asserts that Q01 does not return the secret. Q03/Q05/Q06/Q08/Q14 now emit **hashes instead of raw SQL expressions**; Q04 routine configuration is hashed. Object and role names remain sensitive metadata and must stay inside restricted custody. The disposable harness plants synthetic credentials in trigger arguments, defaults, policy and view SQL and scans **all query result sets** for recognizable secrets. Never store raw results in GitHub or workflow logs.

**Query execution and fixtures:** Q02, Q12 and Q14 have nonempty event-trigger, three-publication-mode and `security_invoker` view fixtures; Q18/Q19 have sequence/domain fixtures. The parser rejects quoted identifiers, inline block comments and unapproved function calls, including the two previously observed `pg_terminate_backend` bypasses; raw `pg_get_triggerdef` is never allowed. Both Q17 variants are syntactically tested on disposable PG17, although **hosted PG15 semantics remain NOT VERIFIED**. Green CI is neither proof of live Dev permissions nor authorization to export.

**Aggregate safety:** `pg_proc.prokind='a'` (aggregate) and `'w'` (window) rows are inventoried by Q04, but only `'f'` (function) and `'p'` (procedure) are passed to `pg_get_functiondef`. Do **not** call `pg_get_functiondef` on aggregates; the former query fails in that case. Include aggregates in the inventory, not in the body-export set.

**Coverage review:** Verify Q04 includes all purchase/checkout/binding routines regardless of name, and Q06 includes `profiles_auth_user_id_uidx` and `subscriptions_one_current_product_idx` if those indexes are present. Investigate missing expected objects rather than filling from guesses. Inspect cross-schema trigger dependencies and ensure default grants do not reopen restricted RPCs.

## 4. Getting the **exact** UI02/UI03 DDL — separate source decision

Catalog inventories, function hashes and definitions of constraints do **not** reconstruct the complete original migration program or deployment order. Do not claim that this packet alone supplies the code needed to replay UI02/UI03.

**Preferred option A (source provenance) — source files FOUND, equivalence still unverified:** the original three SQL migration source files are already committed under `supabase/migrations/` on existing GitHub branch `draft/media-language-es-captions-preview-20261031`, with distinct October 30 commits:

| Applied version name (from management metadata) | Version-controlled source commit | Git blob SHA |
|---|---|---|
| `20261030214706_ui02_atomic_purchase_access_locale_dev.sql` | [`51beea4650`](https://github.com/usdimpact/usd-impact-site/commit/51beea4650524d0dbc9370fa9c1b23176ec7af0b) | `4ebdeb72cfb140ea8bd24ae0f84f91b3e81b5762` |
| `20261030221037_ui02_language_privacy_lifecycle_dev.sql` | [`4fd21f3889`](https://github.com/usdimpact/usd-impact-site/commit/4fd21f388916bd21167cd24f5e31f2097a0f2e49) | `0df302812a95982b7c0d9dbdbe5fc983849ccc5a` |
| `20261030234009_ui03_account_media_locale_preview_dev.sql` | [`7005aa0585`](https://github.com/usdimpact/usd-impact-site/commit/7005aa0585301892c96490d341c3c5645a616890) | `63a15deb451704efa94e6f0f6a561fe1b817d01d` |

This removes the need to read `schema_migrations.statements` merely to **locate** the source. It does **not** establish that the live Development database executed exactly those file bytes; version-name equality is insufficient. Independently check original file SHA-256 attestations/recorded apply receipts and all dependencies, then pin a sanitized **offline-only reference copy or source commit** before combined disposable replay. Keep the source branch Draft and do not cherry-pick these migration files into `main`, `supabase/migrations` on a release branch, or hosted Dev/Production under this authority. No connected SQL was used in locating the sources.

**Fallback option B (new approval, not included in the 20-query pack):** owner authorizes a **separate**, narrowly scoped SELECT of exactly those three versions' `supabase_migrations.schema_migrations.statements` (and version/name metadata) as a **migration-table row read**, under restricted custody. It is *not* a system-catalog read, and it must never be executed under this packet's present authorization. Missing or truncated statements remain HOLD.

**Fallback option C (different authorization):** selectively export full current routine definitions via `pg_get_functiondef` for owner-reviewed, allowlisted function OIDs from Q04, and associated triggers/views/constraints/indexes/policies/enum data. This is a **separate sensitive source extraction**; a routine definition may embed credentials. Store raw SQL only in the restricted review workspace, not a public issue or CI. A current-state reconstruction is not the same as the original migration sequence; document losses and prohibit speculative replay.

Until A, B or appropriately complete C is obtained, mark **exact DDL / combined replay NOT VERIFIED**. Never issue a broad live `SELECT *` against migration history, user tables, payments, sessions or task queues.

## 5. Scheduler/outbox scope needs a second approval

Q01 finds attached triggers, Q12 finds logical publication membership and Q04 identifies callable dispatcher functions. **They do not discover or prove the runtime scheduler.** A complete outbox verdict separately needs read-only evidence of the *actual* Vercel cron/environment routing and any `pg_cron` or `pg_net` integration, Resend dispatch policy, webhook event hooks, trigger order and protected completion-email state. `cron.job` and `net.*` are application/system **table row reads**, not system-catalog SELECTs: separately authorize minimized metadata queries and redact command arguments, URLs, credentials and bodies. If authorization is absent, scheduler/dispatcher parity remains **NOT VERIFIED**, even if Q00–Q19 all pass.

Do not infer `notification_outbox` is unpublished or unobservable solely from an empty explicit `pg_publication_rel`: Q12 also includes entire-schema and all-table publications. Inspect `pg_event_trigger` for DDL-time side effects and `storage.objects` triggers for UI03 media-locale compatibility.

## 6. Disposable replay / negative-test acceptance

**Only after complete, sanitized, authorized Development DDL is available:** build a new disposable PostgreSQL 17 environment matching the actual extension versions, object owners, explicit/default ACLs, enum types, RLS, unique indexes and trigger attachments. Apply the exact UI02/UI03 definitions in migration order, then the **pinned** Research P1 candidate. Use synthetic accounts and two distinct role-bearing clients. Stop if any dependency or object owner is unknown.

1. Test purchase/checkout and Library Pass flows alongside Research billing, with explicit negative tests for cross-account grants, direct stale-JWT reads and two-user RLS isolation.
2. Exercise Phase A for an account with UI02/UI03 account-language/media-locale records; assert FK and trigger order compatibility and that no incomplete privacy request is orphaned. A pending unrelated access/export request must hold Phase A.
3. Exercise the real *shared* `notification_outbox` schema, constraints, staging triggers and dispatcher policy. Simulate late payment immediately after a passed SQL fence: **no completion email may send**, financial custody must hold. **This test can still PASS while Auth was already irreversibly deleted; it NEVER closes P0.**
4. Verify owner-only financial clearances and incident recovery deny `anon`, `authenticated`, `service_role`, and that an unexpired deleted-account JWT cannot read retained financial metadata directly.
5. Confirm lease expiry and concurrent one-account claims with distinct synthetic identities, along with the legacy Auth-first RPC cutoff and idle/failed-worker recovery.
6. Verify Library Pass purchasers in **other accounts** are not affected by a Research deletion hold. For deletion of a Library Pass owner's *own* account, preservation, deletion and refund/notice obligations require a cited, owner-approved privacy/commercial policy **not supplied by F3**; mark HOLD rather than invent a rule.
7. Record full source provenance, reference hashes, trigger/constraint/role deltas, test failures and missing evidence. Never patch connected Development while diagnosing a replay failure.

## 7. Separate owner operating decisions (still OPEN)

| Decision | Requirement | Current disposition |
|---|---|---|
| Development scope/role | Approve a named least-privileged catalog-only role and exact query pack | **NOT AUTHORIZED** |
| Source option A/B/C | Option A files **located in GitHub Draft source branch**; verify exact applied-byte provenance, dependency chain and safe offline reuse; B/C remain separate approvals | **SOURCE LOCATED / EQUIVALENCE NOT VERIFIED** |
| Scheduler evidence | Approve minimized, restricted `cron.job`/`pg_net` metadata only if needed | **NOT AUTHORIZED** |
| Auth retirement clearance | Parent requires fresh owner merchant verification *after* Phase A and within 24 hours for **every account**, even those with no Research purchase. Decide operating workload, monitor privacy deadlines and escalation | **OWNER DECISION OPEN** |
| Library Pass self-deletion | Cite approved retention/refund/support and privacy policy before applying it to owner's own account | **POLICY EVIDENCE MISSING** |
| Post-fence payment race | Remove external charge path or explicitly decide on residual and incident/restoration policy; owner acknowledgement cannot itself make the HTTP race atomic | **P0 UNRESOLVED** |

## 8. Evidence and go/no-go ledger

| Gate | Current |
|---|---|
| Catalog query pack Q00–Q19 with alternate PG15 Q17, full result-set credential scan and nonempty fixtures | **Run revised synthetic contract on disposable PG17; hosted role/version still NOT VERIFIED** |
| Catalog-only scope and least-privilege owner-approved Development access | **PREPARED, NOT EXECUTED/APPROVED** |
| Hosted Development function/trigger/RLS/enum/index and outbox parity | **NOT VERIFIED** |
| Complete UI02/UI03 SQL and combined disposable replay | **NOT VERIFIED** |
| Auth Admin DELETE/GET, stale JWT/refresh and direct PostgREST behavior on hosted synthetic fixture | **NOT VERIFIED** |
| Lemon Squeezy per-target payment cessation and owner privacy/refund/remediation | **HOLD** |
| Unresolved signed payment between SQL fence and Auth DELETE | **P0 / NO-GO** |
| Merge, deployment, hosted migration or live account action | **HOLD / NO-GO** |

**No completed catalog inspection or hosted release authorization is implied by a green synthetic test or this revised packet.**
