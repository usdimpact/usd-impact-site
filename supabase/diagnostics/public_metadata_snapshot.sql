-- USD Impact public-schema metadata snapshot
--
-- REVIEW-ONLY SOURCE: committing this file does not authorize execution.
-- When separately approved, run it once per explicitly confirmed project and
-- compare the JSON outputs in a restricted workspace. Do not commit snapshots:
-- function definitions and access-control metadata are operational evidence.
--
-- This transaction is read-only and queries PostgreSQL catalogs only. It does
-- not read application, Auth, Storage, or migration-history rows.

begin transaction isolation level repeatable read read only;

set local statement_timeout = '30s';
set local lock_timeout = '2s';

with
schemas as (
  select
    namespace.nspname as schema_name,
    pg_catalog.pg_get_userbyid(namespace.nspowner) as owner_name,
    namespace.nspacl is null as acl_uses_builtin_default,
    coalesce(
      (
        select jsonb_agg(entry::text order by entry::text)
        from unnest(
          coalesce(
            namespace.nspacl,
            pg_catalog.acldefault('n', namespace.nspowner)
          )
        ) as entry
      ),
      '[]'::jsonb
    ) as acl
  from pg_catalog.pg_namespace as namespace
  where namespace.nspname = 'public'
),
relations as (
  select
    relation.relname as relation_name,
    relation.relkind as relation_kind,
    relation.relpersistence as persistence,
    pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
    relation.relrowsecurity as row_security_enabled,
    relation.relforcerowsecurity as row_security_forced,
    relation.relreplident as replica_identity,
    relation.relacl is null as acl_uses_builtin_default,
    coalesce(
      (
        select jsonb_agg(entry::text order by entry::text)
        from unnest(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault(
              case
                when relation.relkind = 'S' then 's'::"char"
                else 'r'::"char"
              end,
              relation.relowner
            )
          )
        ) as entry
      ),
      '[]'::jsonb
    ) as acl
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm', 'S')
),
columns as (
  select
    relation.relname as relation_name,
    attribute.attnum as ordinal_position,
    attribute.attname as column_name,
    pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as data_type,
    attribute.attnotnull as not_null,
    attribute.attidentity as identity_kind,
    attribute.attgenerated as generated_kind,
    collation_entry.collname as collation_name,
    pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as relation
    on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  left join pg_catalog.pg_attrdef as default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  left join pg_catalog.pg_collation as collation_entry
    on collation_entry.oid = attribute.attcollation
   and attribute.attcollation <> 0
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm')
    and attribute.attnum > 0
    and not attribute.attisdropped
),
constraints as (
  select
    relation.relname as relation_name,
    constraint_entry.conname as constraint_name,
    constraint_entry.contype as constraint_type,
    constraint_entry.condeferrable as is_deferrable,
    constraint_entry.condeferred as is_initially_deferred,
    constraint_entry.convalidated as is_validated,
    pg_catalog.pg_get_constraintdef(constraint_entry.oid, true) as definition
  from pg_catalog.pg_constraint as constraint_entry
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_entry.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
),
types as (
  select
    type_entry.typname as type_name,
    type_entry.typtype as type_kind,
    type_entry.typcategory as type_category,
    pg_catalog.format_type(type_entry.typbasetype, type_entry.typtypmod) as base_type,
    relation.relname as related_relation,
    pg_catalog.pg_get_userbyid(type_entry.typowner) as owner_name
  from pg_catalog.pg_type as type_entry
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = type_entry.typnamespace
  left join pg_catalog.pg_class as relation
    on relation.oid = type_entry.typrelid
  where namespace.nspname = 'public'
    and type_entry.typelem = 0
),
enums as (
  select
    type_entry.typname as type_name,
    enum_entry.enumsortorder as sort_order,
    enum_entry.enumlabel as label
  from pg_catalog.pg_enum as enum_entry
  join pg_catalog.pg_type as type_entry
    on type_entry.oid = enum_entry.enumtypid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = type_entry.typnamespace
  where namespace.nspname = 'public'
),
functions as (
  select
    procedure.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(procedure.oid) as result_type,
    language.lanname as language_name,
    procedure.prokind as function_kind,
    procedure.provolatile as volatility,
    procedure.proparallel as parallel_safety,
    procedure.prosecdef as security_definer,
    procedure.proleakproof as leakproof,
    procedure.proisstrict as strict,
    pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
    coalesce(procedure.proconfig, array[]::text[]) as configuration,
    procedure.proacl is null as acl_uses_builtin_default,
    coalesce(
      (
        select jsonb_agg(entry::text order by entry::text)
        from unnest(
          coalesce(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )
        ) as entry
      ),
      '[]'::jsonb
    ) as acl,
    pg_catalog.pg_get_functiondef(procedure.oid) as definition
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_language as language
    on language.oid = procedure.prolang
  where namespace.nspname = 'public'
    and procedure.prokind in ('f', 'p')
),
triggers as (
  select
    relation.relname as relation_name,
    trigger_entry.tgname as trigger_name,
    trigger_entry.tgenabled as enabled_mode,
    trigger_entry.tgisinternal as internal,
    pg_catalog.pg_get_triggerdef(trigger_entry.oid, true) as definition
  from pg_catalog.pg_trigger as trigger_entry
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_entry.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
),
policies as (
  select
    relation.relname as relation_name,
    policy.polname as policy_name,
    policy.polcmd as command,
    policy.polpermissive as permissive,
    coalesce(
      (
        select jsonb_agg(
          case
            when role_oid.oid = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(role_oid.oid)
          end
          order by
            case
              when role_oid.oid = 0 then 'PUBLIC'
              else pg_catalog.pg_get_userbyid(role_oid.oid)
            end
        )
        from unnest(policy.polroles) as role_oid(oid)
      ),
      '[]'::jsonb
    ) as roles,
    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) as using_expression,
    pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid) as check_expression
  from pg_catalog.pg_policy as policy
  join pg_catalog.pg_class as relation
    on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
),
indexes as (
  select
    relation.relname as relation_name,
    index_relation.relname as index_name,
    index_entry.indisprimary as primary_index,
    index_entry.indisunique as unique_index,
    index_entry.indisvalid as valid,
    index_entry.indisready as ready,
    pg_catalog.pg_get_expr(index_entry.indpred, index_entry.indrelid) as predicate,
    pg_catalog.pg_get_expr(index_entry.indexprs, index_entry.indrelid) as expressions,
    pg_catalog.pg_get_indexdef(index_entry.indexrelid) as definition
  from pg_catalog.pg_index as index_entry
  join pg_catalog.pg_class as relation
    on relation.oid = index_entry.indrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_entry.indexrelid
  where namespace.nspname = 'public'
),
sequences as (
  select
    relation.relname as sequence_name,
    pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
    pg_catalog.format_type(sequence_entry.seqtypid, null) as data_type,
    sequence_entry.seqstart as start_value,
    sequence_entry.seqincrement as increment_by,
    sequence_entry.seqmin as minimum_value,
    sequence_entry.seqmax as maximum_value,
    sequence_entry.seqcache as cache_size,
    sequence_entry.seqcycle as cycles
  from pg_catalog.pg_sequence as sequence_entry
  join pg_catalog.pg_class as relation
    on relation.oid = sequence_entry.seqrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
),
views as (
  select
    relation.relname as view_name,
    relation.relkind as view_kind,
    pg_catalog.pg_get_viewdef(relation.oid, true) as definition
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('v', 'm')
),
extensions as (
  select
    extension.extname as extension_name,
    extension.extversion as extension_version,
    namespace.nspname as schema_name
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
),
default_privileges as (
  select
    pg_catalog.pg_get_userbyid(default_acl.defaclrole) as owner_name,
    namespace.nspname as schema_name,
    default_acl.defaclobjtype as object_type,
    coalesce(
      (
        select jsonb_agg(entry::text order by entry::text)
        from unnest(default_acl.defaclacl) as entry
      ),
      '[]'::jsonb
    ) as acl
  from pg_catalog.pg_default_acl as default_acl
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = default_acl.defaclnamespace
  where namespace.nspname = 'public'
     or default_acl.defaclnamespace = 0
)
select jsonb_pretty(
  jsonb_build_object(
    'snapshot_format_version', 1,
    'server_version', current_setting('server_version'),
    'schemas', coalesce((select jsonb_agg(to_jsonb(item) order by item.schema_name) from schemas as item), '[]'::jsonb),
    'relations', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.relation_kind) from relations as item), '[]'::jsonb),
    'columns', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.ordinal_position) from columns as item), '[]'::jsonb),
    'constraints', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.constraint_name) from constraints as item), '[]'::jsonb),
    'types', coalesce((select jsonb_agg(to_jsonb(item) order by item.type_name) from types as item), '[]'::jsonb),
    'enums', coalesce((select jsonb_agg(to_jsonb(item) order by item.type_name, item.sort_order) from enums as item), '[]'::jsonb),
    'functions', coalesce((select jsonb_agg(to_jsonb(item) order by item.function_name, item.identity_arguments) from functions as item), '[]'::jsonb),
    'triggers', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.trigger_name) from triggers as item), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.policy_name) from policies as item), '[]'::jsonb),
    'indexes', coalesce((select jsonb_agg(to_jsonb(item) order by item.relation_name, item.index_name) from indexes as item), '[]'::jsonb),
    'sequences', coalesce((select jsonb_agg(to_jsonb(item) order by item.sequence_name) from sequences as item), '[]'::jsonb),
    'views', coalesce((select jsonb_agg(to_jsonb(item) order by item.view_name) from views as item), '[]'::jsonb),
    'extensions', coalesce((select jsonb_agg(to_jsonb(item) order by item.extension_name) from extensions as item), '[]'::jsonb),
    'default_privileges', coalesce((select jsonb_agg(to_jsonb(item) order by item.owner_name, item.schema_name, item.object_type) from default_privileges as item), '[]'::jsonb)
  )
) as metadata_snapshot;

rollback;
