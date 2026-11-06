# F3 — Development UI02/UI03 and notification-outbox schema parity audit

**Status: PREPARED ONLY — NO CONNECTED SQL EXECUTED; NOT HOSTED-VERIFIED; HOLD/NO-GO.**  
**Scope:** USD Impact Research P1 account-deletion Draft PRs #1164 and stacked #1173. A separate Draft follow-up may tighten the SQL Auth-cleanup claim limit, but neither Draft is authorized to merge, migrate, deploy or delete a hosted identity.  
**Environment:** canonical Development project `ycstrcvshdluovtuasjc` only; **never Production** `gjzetjugmnwanvjkchux`.  
**Reviewer:** solo owner with an AI adversarial second opinion; do not describe an AI review as an external human audit.

## What is known without connected SQL

Read-only Supabase management migration metadata on 2026-11-06 shows 58 Development migrations and 57 Production migrations. Development alone lists:

- `20261030214706 ui02_atomic_purchase_access_locale_dev`
- `20261030221037 ui02_language_privacy_lifecycle_dev`
- `20261030234009 ui03_account_media_locale_preview_dev`

The candidate `20261105190000_research_p1_billing_safe_lifecycle.sql` is in neither migration history. **Migration names are not definitions or proof of actual triggers, grants or RLS.** The UI02/UI03 migration source has not been reconciled in the repository's disposable PG replay.

## Authorization boundary

**Do not execute the following queries automatically.** Before a separately approved catalog export, obtain owner approval naming the canonical Development project, exact query pack, read-only scope, retention destination and reviewer. Use a read-only database role when possible. No account UUID/email, payment row, merchant data, user table SELECT, secret, or live Auth/Admin call is required.

The queries below read PostgreSQL **system catalogs only**, returning object definitions and permission metadata. They do not modify tables or migration history. After owner approval, execute with a short `statement_timeout` and a transaction set to READ ONLY. When extracting functions for later isolated replay, keep *complete* function bodies in a restricted review location after checking for hard-coded secrets. Put **only redacted object names, hashes, classifications and test verdicts in GitHub**. Hash matches alone do not demonstrate semantic compatibility.

### A. Trigger order, attached table and function custody

```sql
-- SYSTEM CATALOG ONLY. DEVELOPMENT, SEPARATE OWNER APPROVAL REQUIRED.
select
  ns.nspname as table_schema,
  cl.relname as table_name,
  tg.tgname as trigger_name,
  tg.tgenabled as enabled_mode,
  pg_catalog.pg_get_triggerdef(tg.oid, true) as trigger_definition,
  pns.nspname || '.' || pr.proname as function_name,
  pg_catalog.pg_get_userbyid(pr.proowner) as function_owner,
  pr.prosecdef as security_definer,
  coalesce(
    (select string_agg(cfg, ', ' order by cfg) from unnest(pr.proconfig) as cfg
     where cfg like 'search_path=%'),
    '(no explicit search_path)'
  ) as function_search_path,
  pg_catalog.md5(pg_catalog.pg_get_functiondef(pr.oid)) as function_definition_md5
from pg_catalog.pg_trigger as tg
join pg_catalog.pg_class as cl on cl.oid=tg.tgrelid
join pg_catalog.pg_namespace as ns on ns.oid=cl.relnamespace
join pg_catalog.pg_proc as pr on pr.oid=tg.tgfoid
join pg_catalog.pg_namespace as pns on pns.oid=pr.pronamespace
where not tg.tgisinternal
  and (
    ns.nspname='public'
    or (ns.nspname='auth' and cl.relname='users')
  )
order by table_schema, table_name, trigger_name;
```

Do not assume trigger alphabetical order equals firing order when timing/event types differ. Inspect enabled/disabled status, `BEFORE` versus `AFTER`, event operations, and whether a failing UI02/UI03 trigger can roll back Phase A, cleanup-outbox staging or non-Research Library Pass behavior.

### B. Relevant table shape and constraints

```sql
select
  ns.nspname as table_schema,
  cl.relname as table_name,
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
  a.attnotnull as not_null,
  coalesce(pg_catalog.pg_get_expr(ad.adbin,ad.adrelid),'') as default_expression
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
join pg_catalog.pg_attribute a on a.attrelid=cl.oid
left join pg_catalog.pg_attrdef ad on ad.adrelid=cl.oid and ad.adnum=a.attnum
where cl.relkind in ('r','p')
  and a.attnum>0 and not a.attisdropped
  and ns.nspname='public'
  and (
    cl.relname in ('profiles','privacy_requests','notification_outbox',
                   'subscriptions','subscription_events','entitlements')
    or cl.relname ~* '(language|locale|media)'
  )
order by table_schema,table_name,a.attnum;
```

```sql
select
  ns.nspname as table_schema, cl.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid,true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cl on cl.oid=con.conrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
where ns.nspname='public'
  and (
    cl.relname in ('profiles','privacy_requests','notification_outbox',
                   'subscriptions','subscription_events','entitlements')
    or cl.relname ~* '(language|locale|media)'
  )
order by table_name,constraint_name;
```

### C. RLS and privilege boundaries

```sql
select
  ns.nspname as table_schema, cl.relname as table_name,
  cl.relrowsecurity as rls_enabled,
  cl.relforcerowsecurity as rls_forced,
  pg_catalog.has_table_privilege('anon',cl.oid,'SELECT') as anon_select,
  pg_catalog.has_table_privilege('authenticated',cl.oid,'SELECT') as authenticated_select,
  pg_catalog.has_table_privilege('service_role',cl.oid,'SELECT') as service_role_select,
  pol.polname as policy_name,
  pol.polcmd as command,
  coalesce(pg_catalog.pg_get_expr(pol.polqual,pol.polrelid),'') as using_clause,
  coalesce(pg_catalog.pg_get_expr(pol.polwithcheck,pol.polrelid),'') as check_clause
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
left join pg_catalog.pg_policy pol on pol.polrelid=cl.oid
where ns.nspname='public'
  and (
    cl.relname in ('profiles','privacy_requests','notification_outbox',
                   'subscriptions','subscription_events','entitlements')
    or cl.relname ~* '(language|locale|media)'
  )
order by table_name,policy_name;
```

```sql
select
  ns.nspname as function_schema,
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
  pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) as function_definition_md5
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
where ns.nspname in ('public','research_lifecycle_private')
  and p.proname ~* '(language|locale|media|privacy|deletion|account|outbox|notification)'
order by function_schema,function_name,signature;
```

Do not silently assume `SECURITY DEFINER` bypasses are restricted: check every `anon`/`authenticated` EXECUTE and the actual owner. On a candidate clone, test two distinct synthetic users to prove a caller cannot access the other's locale, media or payment records.

## Required follow-up in a disposable database

**Only after the approved, sanitized, complete Development DDL is obtained:**

1. Install the **exact** UI02/UI03 definitions and their dependencies in disposable PostgreSQL 17, then the pinned Research P1 candidate, with the actual owner/grant/RLS ordering. Record hashes and differences before tests.
2. Run an account with language and media-locale preferences and a pending deletion request through synthetic Phase A. Ensure no UI02/UI03 trigger tries to access a removed Auth FK or prematurely releases account-deletion email.
3. Test a separate outstanding `access` or `export` privacy request: Phase A must fail closed, preserving the request/account link; a completed request can follow the controlled deletion path.
4. Stage the shared `account_deletion_completed` outbox row and verify it remains **non-sendable** until confirmed Auth retirement, no new signed paid evidence, durable finish, and dispatcher permission. Inject a payment immediately after the fence; no email must send and the financial incident stays open.
5. Verify the owner-only financial clearances and incident-recovery functions are inaccessible to `anon`, `authenticated` and `service_role`; verify stale-JWT direct PostgREST access cannot read retained subscription/payment metadata.
6. Verify Library Pass purchase and entitlement rows remain isolated from Research billing holds for **other** accounts. Deletion of the owner account follows existing privacy/Library Pass retention policy; do not apply an unrelated Research hold.
7. Stop and report **FAIL/HOLD** for missing function DDL, incompatible trigger/RLS grants, untrusted owner or library policy ambiguity. Do not patch hosted schema as a debugging step.

## Acceptance record

| Gate | Evidence required | Current verdict |
|---|---|---|
| Canonical Development scope | Owner-signed read-only catalog authorization | **NOT AUTHORIZED HERE** |
| UI02/UI03 table / trigger / function DDL | Sanitized exact catalog export and owners | **NOT VERIFIED** |
| Shared notification-outbox trigger / dispatcher parity | Catalog + replay on disposable database | **NOT VERIFIED** |
| Research P1 candidate / UI02/UI03 combined replay | Deterministic two-user / stale-JWT negative tests | **NOT RUN** |
| Hosted Auth DELETE/GET/refresh semantics | Separately approved synthetic Dev Auth fixture | **NOT AUTHORIZED HERE** |
| Merchant cessation and late-charge boundary | Per-target authenticated proof + owner remediation | **HOLD** |
| Production migration, merge, worker, real customer | Separate item-specific release authorization | **HOLD / NO-GO** |

**Owner decision needed before any catalog request:** approve *only* system-catalog SELECTs on canonical Development, restricted export handling, no row/PII or Auth Admin reads, and no Production activity. A generic "continue" request is not a substitute for this separate approval.
