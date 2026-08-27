begin;

-- Future public tables must not inherit any API-role privileges implicitly.
-- Reviewed migrations can opt service_role or user-facing roles back in with
-- the minimum privileges required for each object.
alter default privileges for role postgres in schema public
  revoke all on tables
  from public, anon, authenticated, service_role;

-- Normalize the commerce reconciliation table to the reviewed least-privilege
-- contract. RLS remains enabled; this changes ACLs only.
revoke all on public.commerce_reconciliations
  from public, anon, authenticated, service_role;
grant select, insert, update on public.commerce_reconciliations to service_role;

-- Fail closed if either the future-table defaults or the current commerce ACL
-- are broader than the reviewed contract after the statements above.
do $audit$
declare
  unexpected_default_privileges text;
  unexpected_commerce_privileges text;
  missing_commerce_privileges text;
begin
  select string_agg(
           format('%s:%s',
             case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
             acl.privilege_type
           ),
           ', '
           order by case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
                    acl.privilege_type
         )
    into unexpected_default_privileges
  from pg_default_acl as defaults
  join pg_roles as owner_role
    on owner_role.oid = defaults.defaclrole
  join pg_namespace as namespace
    on namespace.oid = defaults.defaclnamespace
  cross join lateral aclexplode(defaults.defaclacl) as acl
  left join pg_roles as grantee
    on grantee.oid = acl.grantee
  where owner_role.rolname = 'postgres'
    and namespace.nspname = 'public'
    and defaults.defaclobjtype = 'r'
    and (
      acl.grantee = 0
      or grantee.rolname in ('anon', 'authenticated', 'service_role')
    );

  if unexpected_default_privileges is not null then
    raise exception 'future public table defaults still expose API-role privileges: %',
      unexpected_default_privileges
      using errcode = '42501';
  end if;

  select string_agg(
           format('%s:%s',
             case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
             acl.privilege_type
           ),
           ', '
           order by case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
                    acl.privilege_type
         )
    into unexpected_commerce_privileges
  from pg_class as relation
  join pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as acl
  left join pg_roles as grantee
    on grantee.oid = acl.grantee
  where namespace.nspname = 'public'
    and relation.relname = 'commerce_reconciliations'
    and (
      acl.grantee = 0
      or grantee.rolname in ('anon', 'authenticated')
      or (
        grantee.rolname = 'service_role'
        and acl.privilege_type not in ('SELECT', 'INSERT', 'UPDATE')
      )
    );

  if unexpected_commerce_privileges is not null then
    raise exception 'commerce reconciliation ACL exceeds reviewed contract: %',
      unexpected_commerce_privileges
      using errcode = '42501';
  end if;

  select string_agg(required.privilege, ', ' order by required.privilege)
    into missing_commerce_privileges
  from (values ('SELECT'), ('INSERT'), ('UPDATE')) as required(privilege)
  where not has_table_privilege(
    'service_role',
    'public.commerce_reconciliations',
    required.privilege
  );

  if missing_commerce_privileges is not null then
    raise exception 'commerce reconciliation service_role is missing required privileges: %',
      missing_commerce_privileges
      using errcode = '42501';
  end if;
end
$audit$;

commit;
