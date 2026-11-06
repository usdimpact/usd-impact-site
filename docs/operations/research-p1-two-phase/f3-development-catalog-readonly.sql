-- F3 Development system-catalog audit (PREPARED; NOT AUTHORIZED FOR HOSTED EXECUTION)
-- READ ONLY system catalogs. Run only under separately approved canonical
-- Development scope, restricted read-only role, READ ONLY transaction with a
-- short statement_timeout. Do not export unredacted SQL/DDL to GitHub.
-- No SELECTs from customer, Auth, merchant, storage objects or cron.job rows.
-- Each F3_QUERY block is one SELECT, tested against disposable PG17.

-- F3_QUERY: Q00_SERVER_VERSION
-- Record PostgreSQL server major version BEFORE choosing Q17's compatible
-- role-membership query. This selects one safe value from pg_catalog only.
select pg_catalog.current_setting('server_version_num')::integer as server_version_num
from pg_catalog.pg_settings
where name='server_version_num';

-- F3_QUERY: Q01_TRIGGERS
select ns.nspname as table_schema, cl.relname as table_name,
       tg.tgname as trigger_name, tg.tgenabled as enabled_mode,
       tg.tgnargs as argument_count,
       tg.tgtype as trigger_type_bits,
       -- NEVER export raw pg_get_triggerdef: webhook triggers can embed
       -- Authorization credentials in their TG_ARGV literals.
       pg_catalog.md5(pg_catalog.pg_get_triggerdef(tg.oid,true)) as trigger_definition_md5,
       pns.nspname as function_schema, pr.proname as function_name,
       pg_catalog.pg_get_userbyid(pr.proowner) as function_owner,
       pr.prosecdef as security_definer,
       pg_catalog.md5(pg_catalog.pg_get_functiondef(pr.oid)) as function_definition_md5
from pg_catalog.pg_trigger tg
join pg_catalog.pg_class cl on cl.oid=tg.tgrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
join pg_catalog.pg_proc pr on pr.oid=tg.tgfoid
join pg_catalog.pg_namespace pns on pns.oid=pr.pronamespace
where not tg.tgisinternal and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,table_name,trigger_name;

-- F3_QUERY: Q02_EVENT_TRIGGERS
select et.evtname as event_trigger_name, et.evtevent as event_name,
       et.evtenabled as enabled_mode, et.evttags as command_tags,
       ns.nspname as function_schema, p.proname as function_name,
       pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer
from pg_catalog.pg_event_trigger et
join pg_catalog.pg_proc p on p.oid=et.evtfoid
join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
order by event_trigger_name;

-- F3_QUERY: Q03_COLUMNS_AND_DEFAULTS
select ns.nspname as table_schema, cl.relname as relation_name, cl.relkind,
       a.attnum as column_ordinal, a.attname as column_name,
       pg_catalog.format_type(a.atttypid,a.atttypmod) as column_type,
       a.attnotnull as not_null, a.attidentity as identity_kind,
       a.attgenerated as generated_kind,
       def.oid is not null as has_default,
       pg_catalog.md5(pg_catalog.pg_get_expr(def.adbin,def.adrelid)) as default_expression_md5
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
join pg_catalog.pg_attribute a on a.attrelid=cl.oid
left join pg_catalog.pg_attrdef def on def.adrelid=cl.oid and def.adnum=a.attnum
where cl.relkind in ('r','p','v','m','f')
  and a.attnum>0 and not a.attisdropped
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,column_ordinal;

-- F3_QUERY: Q04_ALL_ROUTINES
-- Includes every non-system routine name, including checkout/Library Pass;
-- aggregate/window entries are inventoried WITHOUT pg_get_functiondef.
select ns.nspname as routine_schema, p.proname as routine_name,
       p.oid::pg_catalog.regprocedure::text as signature,
       p.prokind as routine_kind, p.prosecdef as security_definer,
       p.provolatile as volatility,
       pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
       p.proacl::text as explicit_acl,
       p.proconfig is not null as has_routine_config,
       (select pg_catalog.md5(pg_catalog.string_agg(v, ', ' order by v))
          from pg_catalog.unnest(p.proconfig) as v
          where v like 'search_path=%') as search_path_config_md5,
       case when p.prokind in ('f','p')
            then pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))
            else null end as definition_md5,
       pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by routine_schema,routine_name,signature;

-- F3_QUERY: Q05_CONSTRAINTS
select ns.nspname as table_schema, cl.relname as relation_name,
       con.conname as constraint_name, con.contype as constraint_type,
       con.convalidated as validated, con.condeferrable as deferrable,
       con.condeferred as initially_deferred,
       pg_catalog.md5(pg_catalog.pg_get_constraintdef(con.oid,true)) as definition_md5
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cl on cl.oid=con.conrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,constraint_name;

-- F3_QUERY: Q06_ALL_INDEXES
-- Includes unique indexes without pg_constraint rows and partial indexes.
select ns.nspname as table_schema, cl.relname as relation_name,
       idx.relname as index_name, i.indisunique as unique_index,
       i.indisprimary as primary_index, i.indisvalid as valid,
       i.indisready as ready, con.conname as backing_constraint,
       pg_catalog.md5(pg_catalog.pg_get_indexdef(idx.oid)) as definition_md5
from pg_catalog.pg_index i
join pg_catalog.pg_class cl on cl.oid=i.indrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
join pg_catalog.pg_class idx on idx.oid=i.indexrelid
left join pg_catalog.pg_constraint con on con.conindid=idx.oid
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,index_name;

-- F3_QUERY: Q07_ENUM_LABELS
select ns.nspname as type_schema, typ.typname as enum_name,
       e.enumsortorder as sort_order, e.enumlabel as enum_value
from pg_catalog.pg_type typ
join pg_catalog.pg_namespace ns on ns.oid=typ.typnamespace
join pg_catalog.pg_enum e on e.enumtypid=typ.oid
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by type_schema,enum_name,sort_order;

-- F3_QUERY: Q08_RLS_POLICIES_AND_ROLES
select ns.nspname as table_schema, cl.relname as relation_name,
       cl.relrowsecurity as rls_enabled, cl.relforcerowsecurity as rls_forced,
       pol.polname as policy_name, pol.polcmd as policy_command,
       pol.polpermissive as permissive,
       (select coalesce(pg_catalog.array_agg(
           case when role_oid=0 then 'PUBLIC'::text
                else pg_catalog.pg_get_userbyid(role_oid)::text end
           order by role_oid),array[]::text[])
          from pg_catalog.unnest(pol.polroles) as role_oid) as policy_roles,
       pol.polqual is not null as has_using_clause,
       pol.polwithcheck is not null as has_check_clause,
       pg_catalog.md5(pg_catalog.pg_get_expr(pol.polqual,pol.polrelid)) as using_clause_md5,
       pg_catalog.md5(pg_catalog.pg_get_expr(pol.polwithcheck,pol.polrelid)) as check_clause_md5
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
left join pg_catalog.pg_policy pol on pol.polrelid=cl.oid
where cl.relkind in ('r','p','v','m','f')
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,policy_name;

-- F3_QUERY: Q09_TABLE_DML_ACL
select ns.nspname as table_schema, cl.relname as relation_name,
       cl.relacl::text as explicit_acl, role_name,
       pg_catalog.has_table_privilege(role_name,cl.oid,'SELECT') as can_select,
       pg_catalog.has_table_privilege(role_name,cl.oid,'INSERT') as can_insert,
       pg_catalog.has_table_privilege(role_name,cl.oid,'UPDATE') as can_update,
       pg_catalog.has_table_privilege(role_name,cl.oid,'DELETE') as can_delete,
       pg_catalog.has_table_privilege(role_name,cl.oid,'TRUNCATE') as can_truncate,
       pg_catalog.has_table_privilege(role_name,cl.oid,'REFERENCES') as can_reference,
       pg_catalog.has_table_privilege(role_name,cl.oid,'TRIGGER') as can_trigger
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) as roles(role_name)
where cl.relkind in ('r','p','v','m','f')
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,role_name;

-- F3_QUERY: Q10_COLUMN_ACL
select ns.nspname as table_schema, cl.relname as relation_name,
       a.attname as column_name, a.attacl::text as explicit_column_acl,
       case when acl.grantee=0 then 'PUBLIC'::text
            else pg_catalog.pg_get_userbyid(acl.grantee)::text end as grantee_role,
       pg_catalog.pg_get_userbyid(acl.grantor)::text as grantor_role,
       acl.privilege_type, acl.is_grantable
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
join pg_catalog.pg_attribute a on a.attrelid=cl.oid
cross join lateral pg_catalog.aclexplode(a.attacl) acl
where cl.relkind in ('r','p','v','m','f')
  and a.attnum>0 and not a.attisdropped
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by table_schema,relation_name,column_name,privilege_type;

-- F3_QUERY: Q11_DEFAULT_ACL
select pg_catalog.pg_get_userbyid(d.defaclrole) as grantor_role,
       coalesce(ns.nspname,'(global)') as target_schema,
       d.defaclobjtype as object_kind, d.defaclacl::text as default_acl
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace ns on ns.oid=d.defaclnamespace
where ns.nspname is null or (
  ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
)
order by grantor_role,target_schema,object_kind;

-- F3_QUERY: Q12_PUBLICATION_MEMBERSHIP
-- Includes table/schema/all-table publications, operation flags, table-level
-- column allowlist and row-filter PRESENCE/HASH (never emit filter expressions).
select pub.pubname as publication_name, pub.puballtables as all_tables,
       pub.pubinsert as publishes_insert, pub.pubupdate as publishes_update,
       pub.pubdelete as publishes_delete, pub.pubtruncate as publishes_truncate,
       ns.nspname as schema_name, cl.relname as relation_name,
       'table'::text as membership_kind,
       r.prattrs::text as column_attnums,
       r.prqual is not null as has_row_filter,
       pg_catalog.md5(pg_catalog.pg_get_expr(r.prqual,r.prrelid)) as row_filter_md5
from pg_catalog.pg_publication pub
join pg_catalog.pg_publication_rel r on r.prpubid=pub.oid
join pg_catalog.pg_class cl on cl.oid=r.prrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
union all
select pub.pubname,pub.puballtables,
       pub.pubinsert,pub.pubupdate,pub.pubdelete,pub.pubtruncate,
       ns.nspname,null::name,'schema'::text,null::text,
       null::boolean,null::text
from pg_catalog.pg_publication pub
join pg_catalog.pg_publication_namespace pn on pn.pnpubid=pub.oid
join pg_catalog.pg_namespace ns on ns.oid=pn.pnnspid
union all
select pub.pubname,pub.puballtables,
       pub.pubinsert,pub.pubupdate,pub.pubdelete,pub.pubtruncate,
       null::name,null::name,'all_tables'::text,null::text,
       null::boolean,null::text
from pg_catalog.pg_publication pub where pub.puballtables
order by publication_name,membership_kind,schema_name,relation_name;

-- F3_QUERY: Q13_SCHEMA_PRIVILEGES
select ns.nspname as schema_name,
       pg_catalog.pg_get_userbyid(ns.nspowner) as owner_name,
       ns.nspacl::text as explicit_acl, role_name,
       pg_catalog.has_schema_privilege(role_name,ns.oid,'USAGE') as can_use,
       pg_catalog.has_schema_privilege(role_name,ns.oid,'CREATE') as can_create
from pg_catalog.pg_namespace ns
cross join (values ('anon'),('authenticated'),('service_role')) as roles(role_name)
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by schema_name,role_name;

-- F3_QUERY: Q14_VIEWS_AND_SECURITY_BARRIER
select ns.nspname as view_schema, cl.relname as view_name,
       cl.relkind as kind, cl.reloptions::text as view_options,
       pg_catalog.pg_get_userbyid(cl.relowner) as owner_name,
       pg_catalog.md5(pg_catalog.pg_get_viewdef(cl.oid,true)) as definition_md5
from pg_catalog.pg_class cl
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
where cl.relkind in ('v','m')
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by view_schema,view_name;

-- F3_QUERY: Q15_EXTENSIONS
select ext.extname as extension_name, ext.extversion as installed_version,
       ns.nspname as extension_schema,
       pg_catalog.pg_get_userbyid(ext.extowner) as owner_name
from pg_catalog.pg_extension ext
join pg_catalog.pg_namespace ns on ns.oid=ext.extnamespace
order by extension_name;

-- F3_QUERY: Q16_ROLE_ATTRIBUTES
-- pg_roles hides password hashes; never query pg_authid.
select r.rolname as role_name, r.rolsuper as superuser,
       r.rolinherit as inherits, r.rolcreaterole as can_create_roles,
       r.rolcreatedb as can_create_databases, r.rolcanlogin as can_login,
       r.rolreplication as replication, r.rolbypassrls as bypass_rls
from pg_catalog.pg_roles r
order by role_name;

-- F3_QUERY: Q17_ROLE_MEMBERSHIPS
select pg_catalog.pg_get_userbyid(m.roleid)::text as granted_role,
       pg_catalog.pg_get_userbyid(m.member)::text as member_role,
       pg_catalog.pg_get_userbyid(m.grantor)::text as grantor_role,
       m.admin_option as admin_option,
       m.inherit_option as inherit_option,
       m.set_option as set_option
from pg_catalog.pg_auth_members m
order by granted_role,member_role;

-- F3_QUERY: Q18_SEQUENCES_AND_ACL
-- pg_sequence is a system catalog, unlike pg_sequences.last_value (runtime data).
select ns.nspname as sequence_schema, cl.relname as sequence_name,
       pg_catalog.pg_get_userbyid(cl.relowner)::text as owner_name,
       cl.relacl::text as explicit_acl, role_name,
       pg_catalog.has_sequence_privilege(role_name,cl.oid,'USAGE') as can_use,
       pg_catalog.has_sequence_privilege(role_name,cl.oid,'SELECT') as can_select,
       pg_catalog.has_sequence_privilege(role_name,cl.oid,'UPDATE') as can_update,
       seq.seqstart as start_value, seq.seqincrement as increment_by,
       seq.seqmin as min_value, seq.seqmax as max_value,
       seq.seqcache as cache_size, seq.seqcycle as cycles
from pg_catalog.pg_sequence seq
join pg_catalog.pg_class cl on cl.oid=seq.seqrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) as roles(role_name)
where ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by sequence_schema,sequence_name,role_name;

-- F3_QUERY: Q19_DOMAIN_CONSTRAINTS
-- Domain constraints have conrelid=0 and are absent from table-only Q05.
select ns.nspname as domain_schema, typ.typname as domain_name,
       pg_catalog.format_type(typ.typbasetype,typ.typtypmod) as base_type,
       typ.typnotnull as not_null, con.conname as constraint_name,
       con.contype as constraint_type, con.convalidated as validated,
       pg_catalog.md5(pg_catalog.pg_get_constraintdef(con.oid,true)) as constraint_definition_md5
from pg_catalog.pg_type typ
join pg_catalog.pg_namespace ns on ns.oid=typ.typnamespace
join pg_catalog.pg_constraint con on con.contypid=typ.oid
where typ.typtype='d'
  and ns.nspname not in ('pg_catalog','information_schema')
  and ns.nspname not like 'pg_toast%' and ns.nspname not like 'pg_temp%'
order by domain_schema,domain_name,constraint_name;

-- F3_QUERY_PG15: Q17_ROLE_MEMBERSHIPS
-- PostgreSQL 15 pg_auth_members lacks inherit_option / set_option.
-- Execute this alternative INSTEAD of the PG16+ Q17; never run both in hosted.
select pg_catalog.pg_get_userbyid(m.roleid)::text as granted_role,
       pg_catalog.pg_get_userbyid(m.member)::text as member_role,
       pg_catalog.pg_get_userbyid(m.grantor)::text as grantor_role,
       m.admin_option as admin_option,
       null::boolean as inherit_option,
       null::boolean as set_option
from pg_catalog.pg_auth_members m
order by granted_role,member_role;
