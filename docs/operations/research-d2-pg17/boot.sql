-- Supabase-faithful bootstrap (ASSUMPTIONS labelled): run as cluster superuser (stands in for supabase_admin)
create role postgres login password 'synthetic_pg' createrole createdb bypassrls nosuperuser;   -- ASSUMPTION: Supabase postgres = non-superuser, CREATEROLE, BYPASSRLS
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'synthetic_authn';
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;        -- ASSUMPTION (Supabase grants these to postgres)
