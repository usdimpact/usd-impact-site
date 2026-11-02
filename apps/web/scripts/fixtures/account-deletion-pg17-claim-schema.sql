-- Issue #950: disposable PostgreSQL 17 TEST-ONLY schema.
-- Intentionally contains NO real Supabase Auth or customer tables.
-- Only run against the isolated CI postgres service on 127.0.0.1.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select null::uuid $$;

create type public.account_status as enum
  ('active','suspended','deletion_pending','deleted');
create type public.request_status as enum
  ('open','in_progress','completed');

create table public.profiles (
  account_id uuid primary key,
  email text not null,
  display_name text,
  status public.account_status not null default 'active',
  deletion_requested_at timestamptz,
  deletion_due_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default pg_catalog.now(),
  updated_at timestamptz default pg_catalog.now(),
  auth_user_id uuid
);
create table public.privacy_requests (
  account_id uuid,
  email text,
  request_type text,
  status public.request_status,
  requested_at timestamptz,
  due_at timestamptz
);

-- The two old functions exist only as synthetic migration prerequisites.
create function public.request_account_deletion()
returns public.profiles language plpgsql security definer
set search_path = ''
as $$ begin raise exception 'synthetic old request stub must not execute'; end $$;
revoke all on function public.request_account_deletion() from public,anon,service_role;
grant execute on function public.request_account_deletion() to authenticated;

create function public.prepare_account_deletion_auth_removal(prepare_account_id uuid)
returns boolean language plpgsql security definer
set search_path = ''
as $$ begin return true; end $$;
revoke all on function public.prepare_account_deletion_auth_removal(uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion_auth_removal(uuid) to service_role;

-- A minimal stand-in for original erasure RPC; not an erasure integration test.
create function public.finalize_account_deletion(finalize_account_id uuid)
returns table (
  account_id uuid,recipient_email text,
  deletion_requested_at timestamptz,deleted_at timestamptz
)
language plpgsql security definer set search_path = ''
as $core$
declare
  p public.profiles;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select x.* into p from public.profiles x
  where x.account_id=finalize_account_id for update;
  if p.account_id is null or p.status<>'deletion_pending'
    or p.auth_user_id is not null then
    raise exception 'unqualified synthetic finalization';
  end if;
  update public.profiles x
  set status='deleted',deleted_at=v_now,updated_at=v_now,
      email='deleted+fixture@accounts.invalid'
  where x.account_id=p.account_id;
  return query select p.account_id,p.email,p.deletion_requested_at,v_now;
end
$core$;
revoke all on function public.finalize_account_deletion(uuid)
  from public,anon,authenticated;
grant execute on function public.finalize_account_deletion(uuid) to service_role;
