begin;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Record an explicit global default revoke for functions created by postgres.
alter default privileges for role postgres
  revoke execute on functions
  from public;

-- Supabase can also carry schema-specific API-role defaults. Remove those for
-- the exposed public schema so every callable function must opt in explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions
  from anon, authenticated, service_role;

commit;
