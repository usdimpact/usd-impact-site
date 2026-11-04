-- S2 PERMISSIVE (Supabase legacy platform default per 'Securing your API'): EXECUTE + table DML to API roles
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
