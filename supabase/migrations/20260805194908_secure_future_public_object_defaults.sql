begin;

-- Keep future public objects private until a reviewed migration grants the
-- minimum API privileges they require. Existing object privileges are not
-- changed by ALTER DEFAULT PRIVILEGES.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences
  from anon, authenticated, service_role;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Require
-- every future API or service function to opt in explicitly instead.
alter default privileges for role postgres in schema public
  revoke execute on functions
  from public, anon, authenticated, service_role;

-- Fail closed if the current public schema contains a table that would rely
-- on API grants without the row-level security boundary.
do $audit$
declare
  tables_without_rls text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into tables_without_rls
  from pg_class as relation
  join pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and not relation.relrowsecurity;

  if tables_without_rls is not null then
    raise exception 'public tables without row-level security: %', tables_without_rls
      using errcode = '42501';
  end if;
end
$audit$;

commit;
