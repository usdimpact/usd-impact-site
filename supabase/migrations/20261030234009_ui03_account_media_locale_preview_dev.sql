-- USD Impact Development-only: independent media caption preference. Never activate Production media or notifications.
create table public.account_media_locale_preferences (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  preferred_media_locale text not null check (preferred_media_locale in ('en', 'es')),
  selection_provenance text not null default 'authenticated_media_account'
    check (selection_provenance = 'authenticated_media_account'),
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.account_media_locale_preferences enable row level security;
revoke all on public.account_media_locale_preferences from public, anon, authenticated;
grant select(account_id,preferred_media_locale,selection_provenance,revision,updated_at)
  on public.account_media_locale_preferences to authenticated;
grant insert(account_id,preferred_media_locale)
  on public.account_media_locale_preferences to authenticated;
grant update(preferred_media_locale)
  on public.account_media_locale_preferences to authenticated;
grant select,insert,update,delete
  on public.account_media_locale_preferences to service_role;
create function public.ui03_version_media_locale()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  -- Serialize authenticated language changes against independent media preference changes.
  -- Does not require or grant UPDATE on public.profiles.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ui03_media_locale:'||new.account_id::text,0)
  );
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    if new.account_id is distinct from old.account_id then
      raise exception 'UI03_ACCOUNT_ID_IMMUTABLE';
    end if;
    if old.revision >= 2147483647 then
      raise exception 'UI03_LOCALE_REVISION_EXHAUSTED';
    end if;
    new.revision := old.revision + 1;
  end if;
  new.selection_provenance := 'authenticated_media_account';
  new.updated_at := now();
  return new;
end
$fn$;
revoke all on function public.ui03_version_media_locale() from public, anon, authenticated;
grant execute on function public.ui03_version_media_locale() to service_role;
create trigger ui03_version_media_locale
before insert or update on public.account_media_locale_preferences
for each row execute function public.ui03_version_media_locale();

create policy ui03_media_locale_read_own
on public.account_media_locale_preferences for select to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui03_media_locale_insert_own
on public.account_media_locale_preferences for insert to authenticated
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui03_media_locale_update_own
on public.account_media_locale_preferences for update to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'))
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));


create function public.ui03_purge_media_locale_on_deletion()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $fn$
begin
 if new.status='deleted' and old.status is distinct from 'deleted' then
   delete from public.account_media_locale_preferences where account_id=new.account_id;
 end if;
 return new;
end $fn$;
revoke all on function public.ui03_purge_media_locale_on_deletion() from public,anon,authenticated;
grant execute on function public.ui03_purge_media_locale_on_deletion() to service_role;
create trigger ui03_purge_media_locale_when_account_deleted
after update of status on public.profiles
for each row
when (old.status is distinct from new.status and new.status='deleted')
execute function public.ui03_purge_media_locale_on_deletion();

CREATE OR REPLACE FUNCTION public.account_export()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  with caller as (
    select (select auth.uid()) as account_id
  )
  select jsonb_build_object(
    'mediaLanguagePreference', (
      select to_jsonb(pref)
      from public.account_media_locale_preferences pref
      where pref.account_id = caller.account_id
    ),
    'transactionalLanguagePreference', (
      select to_jsonb(pref)
      from public.account_transactional_locale_preferences pref
      where pref.account_id = caller.account_id
    ),
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
$function$;
