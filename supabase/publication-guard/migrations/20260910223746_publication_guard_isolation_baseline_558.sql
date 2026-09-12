do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','f')
  ) or exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  ) then
    raise exception 'HOLD_PUBLIC_SCHEMA_NOT_EMPTY';
  end if;
  if to_regnamespace('publication_guard') is not null
     or to_regnamespace('publication_guard_api') is not null
     or exists (select 1 from pg_roles where rolname like 'fx558_%') then
    raise exception 'HOLD_GUARD_ALREADY_PRESENT';
  end if;
end $$;

revoke temporary on database postgres from public;
revoke usage on schema public from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

do $$
begin
  if has_database_privilege('public', current_database(), 'TEMP') then
    raise exception 'HOLD_PUBLIC_TEMP_REMAINS';
  end if;
  if has_schema_privilege('public', 'public', 'USAGE')
     or has_schema_privilege('anon', 'public', 'USAGE')
     or has_schema_privilege('authenticated', 'public', 'USAGE')
     or has_schema_privilege('service_role', 'public', 'USAGE') then
    raise exception 'HOLD_PUBLIC_SCHEMA_USAGE_REMAINS';
  end if;
end $$;