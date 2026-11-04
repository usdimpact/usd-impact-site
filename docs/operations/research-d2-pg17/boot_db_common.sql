create schema auth; create schema extensions;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $f$;
grant usage on schema auth, extensions to postgres, anon, authenticated, service_role;
grant select, references, trigger on auth.users to postgres;  -- ASSUMPTION: matches Supabase (migration already applied in Production)
grant execute on function auth.uid(), auth.jwt() to public;
create extension pgcrypto with schema extensions;
