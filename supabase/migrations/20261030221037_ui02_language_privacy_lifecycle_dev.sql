-- UI02 Development-only privacy export and deletion cleanup, NOT a Production migration.
-- Existing account export remains SECURITY INVOKER. No email flag or activation changes.
CREATE OR REPLACE FUNCTION public.account_export()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  with caller as (
    select (select auth.uid()) as account_id
  )
  select jsonb_build_object(
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


-- No SECURITY DEFINER. The account-deletion finalizer already executes its
-- profile status transition as its existing owner; this trigger runs as invoker.
create function public.ui02_purge_transactional_locale_on_deletion()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $ui02$
begin
  if tg_op <> 'UPDATE' then raise exception 'UI02_DELETION_TRIGGER_WRONG_EVENT'; end if;
  if new.status = 'deleted' and old.status is distinct from 'deleted' then
    delete from public.account_transactional_locale_preferences
    where account_id = new.account_id;
  end if;
  return new;
end $ui02$;
revoke all on function public.ui02_purge_transactional_locale_on_deletion()
from public, anon, authenticated;
grant execute on function public.ui02_purge_transactional_locale_on_deletion()
to service_role;
create trigger ui02_purge_language_when_account_deleted
after update of status on public.profiles
for each row
when (old.status is distinct from new.status and new.status = 'deleted')
execute function public.ui02_purge_transactional_locale_on_deletion();
