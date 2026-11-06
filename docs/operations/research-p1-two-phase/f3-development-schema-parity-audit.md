# F3 — Development UI02/UI03 and shared-outbox schema parity audit (revised after Claude P1)

**Status: PREPARED FOR REVIEW ONLY — NOT AUTHORIZED TO RUN AGAINST HOSTED DEVELOPMENT; F3 NOT VERIFIED; PRODUCTION NO-GO.**  
**Repository:** `usdimpact/usd-impact-site`. Stacked Draft #1178 on #1173 on #1164; all remain unmerged.  
**Canonical Development:** `ycstrcvshdluovtuasjc`. **Production project is excluded.**  
**Query pack:** [f3-development-catalog-readonly.sql](./f3-development-catalog-readonly.sql), revision-controlled as the **single executable source** for 15 system-catalog SELECTs. A separate CI contract runs this pack against disposable synthetic PostgreSQL 17, *not* hosted Development.  
**Independence:** Claude's adversarial AI review is a second model review, not an independent human audit or owner acceptance.

## 1. Grounded scope and hard limits

Read-only Supabase **management metadata**, checked November 6, 2026, showed 58 Development migrations including these three Development-only UI02/UI03 migrations:

- `20261030214706 ui02_atomic_purchase_access_locale_dev`
- `20261030221037 ui02_language_privacy_lifecycle_dev`
- `20261030234009 ui03_account_media_locale_preview_dev`

It showed 57 Production migrations, without these three. The proposed Research P1 migration `20261105190000_research_p1_billing_safe_lifecycle.sql` was not installed in either environment. Those numbers are **owner/author-observed management metadata, not verified by Claude**, and do **not** prove live function definitions, grants, trigger state or schema compatibility. Revalidate metadata at the exact time of an authorized catalog audit.

**No connected SQL, table-row read, hosted Auth, merchant, cleanup operation or migration is authorized by this packet.** A generic approval to continue Draft work cannot authorize hosted access.

## 2. Separate, tightly bounded owner permission required

Before any Development catalog read, the owner must approve all of: the exact **canonical Development** project; the pinned commit and 15-query SQL pack; a specified already-available **least-privileged, SELECT-only audit role** (mandatory, *not* the SQL Editor's default owner/superuser); a `READ ONLY` transaction and short query timeout; the named reviewer; and where/how long restricted catalog evidence is retained. If that role cannot access needed catalog metadata, **HOLD** and seek a separate access decision; do not change hosted grants/roles to make the audit work.

Execute only after authorization, inside a single bounded consistent snapshot (and check every query result for truncation, missing schema, and permission errors):

```text
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5000ms';
-- Run the 15 approved SELECT statements from f3-development-catalog-readonly.sql,
-- under the authenticated, least-privileged audit connection.
ROLLBACK;
```

The transaction wrapper is an *example*, not an authorization or a connected command to execute now. Never query `auth.users`, `storage.objects`, `cron.job`, `supabase_migrations.schema_migrations` or customer/payment/email rows. Catalog metadata about these tables is in scope; their **records are not**. Do not use Supabase SQL Editor/REST service-role privileges merely because they are convenient.

Raw `pg_get_triggerdef`, view definitions, `pg_get_expr`, ACL and routine configuration may still contain sensitive literals; restrict and inspect them before sharing. GitHub/PR/CI receive only sanitized object identifiers, counts, nonsecret checksums, findings and verdicts. A successful hash match alone is not evidence of semantic or permission compatibility.

## 3. Complete inventory — 15 catalog-only queries

The previous five queries omitted checkout and Library Pass functions, enum labels, standalone unique indexes, policy roles, default grants and storage/event-trigger coverage. The revision inventories **all non-system schemas**, including `auth`, `storage`, `public` and extension namespaces, instead of filtering functions by a list of keywords.

| Query | Evidence collected |
|---|---|
| Q01_TRIGGERS | All noninternal table triggers, including `storage.objects`, *all* `auth` tables, attachment, function identity and owner |
| Q02_EVENT_TRIGGERS | Database event triggers and their owning functions |
| Q03_COLUMNS_AND_DEFAULTS | Non-system table/view column types, nullability, identity, generated/default expressions |
| Q04_ALL_ROUTINES | **Every** non-system routine including `complete_paddle_purchase`, `reserve_paddle_purchase_intent`, Research checkout/binding and email handlers; signatures, owners, security-definer, volatility, effective EXECUTE, definition hashes for functions/procedures |
| Q05_CONSTRAINTS | Constraints, validity and deferrability |
| Q06_ALL_INDEXES | All indexes, including unique/partial/expression indexes with no backing `pg_constraint` |
| Q07_ENUM_LABELS | Complete ordered labels of enum types (not merely column type names), including privacy request/status where present |
| Q08_RLS_POLICIES_AND_ROLES | Enabled/forced RLS, permissive/restrictive policies, `polroles`, actions, USING and WITH CHECK |
| Q09_TABLE_DML_ACL | Table-level effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for `anon`, `authenticated`, `service_role` |
| Q10_COLUMN_ACL | Explicit column grants, including grantor/grantee and grant option; inspect inherited table-level rights via Q09 |
| Q11_DEFAULT_ACL | `pg_default_acl` at global and schema scope, critical for future `SECURITY DEFINER` function grants |
| Q12_PUBLICATION_MEMBERSHIP | Explicit table, all-schema and all-tables publication membership (including Realtime scope) |
| Q13_SCHEMA_PRIVILEGES | Schema owner and effective USAGE/CREATE for application roles |
| Q14_VIEWS_AND_SECURITY_BARRIER | View definitions and `security_invoker`/`security_barrier` options, including materialized views |
| Q15_EXTENSIONS | Extension names, installed versions, owners and schemas |

**Aggregate safety:** `pg_proc.prokind='a'` (aggregate) and `'w'` (window) rows are inventoried by Q04, but only `'f'` (function) and `'p'` (procedure) are passed to `pg_get_functiondef`. Do **not** call `pg_get_functiondef` on aggregates; the former query fails in that case. Include aggregates in the inventory, not in the body-export set.

**Coverage review:** Verify Q04 includes all purchase/checkout/binding routines regardless of name, and Q06 includes `profiles_auth_user_id_uidx` and `subscriptions_one_current_product_idx` if those indexes are present. Investigate missing expected objects rather than filling from guesses. Inspect cross-schema trigger dependencies and ensure default grants do not reopen restricted RPCs.

## 4. Getting the **exact** UI02/UI03 DDL — separate source decision

Catalog inventories, function hashes and definitions of constraints do **not** reconstruct the complete original migration program or deployment order. Do not claim that this packet alone supplies the code needed to replay UI02/UI03.

**Preferred option A (source provenance):** the owner retrieves and commits the *three exact Development migration SQL files* through the appropriate controlled development-source workflow, after secret/PII inspection. Pin each original version, hash, dependency list, owner, target environment and source provenance. This is preferable to reverse-engineering current state, and can be reviewed without reading connected rows.

**Fallback option B (new approval, not included in 15-query pack):** owner authorizes a **separate**, narrowly scoped SELECT of exactly those three versions' `supabase_migrations.schema_migrations.statements` (and version/name metadata) as a **migration-table row read**, under restricted custody. It is *not* a system-catalog read, and it must never be executed under this packet's present authorization. Missing or truncated statements remain HOLD.

**Fallback option C (different authorization):** selectively export full current routine definitions via `pg_get_functiondef` for owner-reviewed, allowlisted function OIDs from Q04, and associated triggers/views/constraints/indexes/policies/enum data. This is a **separate sensitive source extraction**; a routine definition may embed credentials. Store raw SQL only in the restricted review workspace, not a public issue or CI. A current-state reconstruction is not the same as the original migration sequence; document losses and prohibit speculative replay.

Until A, B or appropriately complete C is obtained, mark **exact DDL / combined replay NOT VERIFIED**. Never issue a broad live `SELECT *` against migration history, user tables, payments, sessions or task queues.

## 5. Scheduler/outbox scope needs a second approval

Q01 finds attached triggers, Q12 finds logical publication membership and Q04 identifies callable dispatcher functions. **They do not discover or prove the runtime scheduler.** A complete outbox verdict separately needs read-only evidence of the *actual* Vercel cron/environment routing and any `pg_cron` or `pg_net` integration, Resend dispatch policy, webhook event hooks, trigger order and protected completion-email state. `cron.job` and `net.*` are application/system **table row reads**, not system-catalog SELECTs: separately authorize minimized metadata queries and redact command arguments, URLs, credentials and bodies. If authorization is absent, scheduler/dispatcher parity remains **NOT VERIFIED**, even if Q01–Q15 all pass.

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
| Source option A/B/C | Commit exact UI02/UI03 SQL, or independently approve migration-row / complete DDL extraction | **UNDECIDED** |
| Scheduler evidence | Approve minimized, restricted `cron.job`/`pg_net` metadata only if needed | **NOT AUTHORIZED** |
| Auth retirement clearance | Parent requires fresh owner merchant verification *after* Phase A and within 24 hours for **every account**, even those with no Research purchase. Decide operating workload, monitor privacy deadlines and escalation | **OWNER DECISION OPEN** |
| Library Pass self-deletion | Cite approved retention/refund/support and privacy policy before applying it to owner's own account | **POLICY EVIDENCE MISSING** |
| Post-fence payment race | Remove external charge path or explicitly decide on residual and incident/restoration policy; owner acknowledgement cannot itself make the HTTP race atomic | **P0 UNRESOLVED** |

## 8. Evidence and go/no-go ledger

| Gate | Current |
|---|---|
| Catalog query pack Q01–Q15 syntax on disposable database | **Run local synthetic contract; see exact-head CI** |
| Catalog-only scope and least-privilege owner-approved Development access | **PREPARED, NOT EXECUTED/APPROVED** |
| Hosted Development function/trigger/RLS/enum/index and outbox parity | **NOT VERIFIED** |
| Complete UI02/UI03 SQL and combined disposable replay | **NOT VERIFIED** |
| Auth Admin DELETE/GET, stale JWT/refresh and direct PostgREST behavior on hosted synthetic fixture | **NOT VERIFIED** |
| Lemon Squeezy per-target payment cessation and owner privacy/refund/remediation | **HOLD** |
| Unresolved signed payment between SQL fence and Auth DELETE | **P0 / NO-GO** |
| Merge, deployment, hosted migration or live account action | **HOLD / NO-GO** |

**No completed catalog inspection or hosted release authorization is implied by a green synthetic test or this revised packet.**
