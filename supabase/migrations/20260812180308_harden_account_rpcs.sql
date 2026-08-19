begin;

-- The customer export is a read-only operation over tables that already grant
-- authenticated SELECT access and enforce account ownership with RLS. Run it
-- with the caller's privileges so it cannot bypass those policies, and derive
-- the target account exclusively from the authenticated JWT.
create or replace function public.account_export()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as account_id
  )
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) - 'email' || jsonb_build_object('email', p.email)
      from public.profiles p
      where p.account_id = caller.account_id
    ),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.completed_at desc)
      from public.purchases x
      where x.account_id = caller.account_id
    ), '[]'::jsonb),
    'entitlements', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
      from public.entitlements x
      where x.account_id = caller.account_id
    ), '[]'::jsonb),
    'learningProgress', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.content_id)
      from public.learning_progress x
      where x.account_id = caller.account_id
    ), '[]'::jsonb),
    'bookmarks', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
      from public.bookmarks x
      where x.account_id = caller.account_id
    ), '[]'::jsonb),
    'supportRequests', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
      from public.support_requests x
      where x.account_id = caller.account_id
    ), '[]'::jsonb),
    'privacyRequests', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.requested_at)
      from public.privacy_requests x
      where x.account_id = caller.account_id
    ), '[]'::jsonb)
  )
  from caller
  where caller.account_id is not null;
$$;

revoke all on function public.account_export()
  from public, anon, authenticated, service_role;
grant execute on function public.account_export() to authenticated;

-- Preserve the previous RPC signature during the database-first release window.
-- It no longer bypasses RLS and refuses any account ID other than auth.uid().
-- The application uses the parameterless function after this release.
create or replace function public.account_export(export_account_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.account_export()
  where export_account_id is not null
    and export_account_id = (select auth.uid());
$$;

revoke all on function public.account_export(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.account_export(uuid) to authenticated;

-- Account deletion is the one intentional SECURITY DEFINER customer RPC. It
-- needs a narrowly bounded profile update that authenticated users cannot make
-- directly. Resolve the caller once, reject missing identity explicitly, keep
-- every object reference qualified, and expose only the required role grant.
create or replace function public.request_account_deletion()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_account_id uuid := auth.uid();
  updated_profile public.profiles;
begin
  if caller_account_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  update public.profiles
  set status = 'deletion_pending',
      deletion_requested_at = pg_catalog.now(),
      deletion_due_at = pg_catalog.now() + interval '7 days',
      updated_at = pg_catalog.now()
  where account_id = caller_account_id
    and status = 'active'
  returning * into updated_profile;

  if updated_profile.account_id is null then
    raise exception 'account is not eligible for deletion request';
  end if;

  insert into public.privacy_requests (
    account_id,
    email,
    request_type,
    status,
    requested_at,
    due_at
  ) values (
    updated_profile.account_id,
    updated_profile.email,
    'deletion',
    'open',
    pg_catalog.now(),
    pg_catalog.now() + interval '1 month'
  );

  return updated_profile;
end;
$$;

revoke all on function public.request_account_deletion()
  from public, anon, authenticated, service_role;
grant execute on function public.request_account_deletion() to authenticated;

commit;
