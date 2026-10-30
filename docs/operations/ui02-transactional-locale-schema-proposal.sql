-- UI-02 REVIEW-ONLY schema proposal. NOT in supabase/migrations.
-- Tested on canonical Development in BEGIN/ROLLBACK on 2026-10-30.
-- Never deploy, apply to Production, or enable email sending from this file.
-- Account locale is transactional (not marketing consent). Default no row => EN.
create table public.account_transactional_locale_preferences (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  preferred_locale text not null check (preferred_locale in ('en', 'es')),
  selection_provenance text not null default 'authenticated_account'
    check (selection_provenance = 'authenticated_account'),
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.account_transactional_locale_preferences enable row level security;
revoke all on public.account_transactional_locale_preferences from public, anon, authenticated;
grant select(account_id,preferred_locale,selection_provenance,revision,updated_at)
  on public.account_transactional_locale_preferences to authenticated;
grant insert(account_id,preferred_locale)
  on public.account_transactional_locale_preferences to authenticated;
grant update(preferred_locale)
  on public.account_transactional_locale_preferences to authenticated;
grant select,insert,update,delete
  on public.account_transactional_locale_preferences to service_role;
create function public.ui02_version_transactional_locale()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    if new.account_id is distinct from old.account_id then
      raise exception 'UI02_ACCOUNT_ID_IMMUTABLE';
    end if;
    if old.revision >= 2147483647 then
      raise exception 'UI02_LOCALE_REVISION_EXHAUSTED';
    end if;
    new.revision := old.revision + 1;
  end if;
  new.selection_provenance := 'authenticated_account';
  new.updated_at := now();
  return new;
end
$fn$;
revoke all on function public.ui02_version_transactional_locale() from public, anon, authenticated;
grant execute on function public.ui02_version_transactional_locale() to service_role;
create trigger ui02_version_transactional_locale
before insert or update on public.account_transactional_locale_preferences
for each row execute function public.ui02_version_transactional_locale();

create policy ui02_account_locale_read_own
on public.account_transactional_locale_preferences for select to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui02_account_locale_insert_own
on public.account_transactional_locale_preferences for insert to authenticated
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui02_account_locale_update_own
on public.account_transactional_locale_preferences for update to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'))
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));

-- Immutable locale template snapshot; NEVER put locale into existing
-- purchase_access_ready notification_outbox.payload, which must remain '{}'.
create table public.purchase_access_ready_locale_snapshots (
  outbox_id uuid primary key references public.notification_outbox(id) on delete restrict,
  purchase_id uuid not null unique references public.purchases(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  render_locale text not null check (render_locale in ('en', 'es')),
  locale_source text not null check (locale_source in ('verified_account','english_fallback')),
  preference_revision integer,
  template_version text not null check (char_length(template_version) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint ui02_locale_source_version_consistent check (
    (locale_source='verified_account' and preference_revision>=1)
    or (locale_source='english_fallback' and render_locale='en' and preference_revision is null))
);
alter table public.purchase_access_ready_locale_snapshots enable row level security;
revoke all on public.purchase_access_ready_locale_snapshots from public, anon, authenticated;
grant select,insert on public.purchase_access_ready_locale_snapshots to service_role;

create function public.ui02_enforce_immutable_access_locale()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  if tg_op <> 'INSERT' then raise exception 'UI02_LOCALE_SNAPSHOT_IMMUTABLE'; end if;
  if not exists (
    select 1 from public.notification_outbox o
    join public.purchases pu on pu.id=new.purchase_id
    join public.profiles pr on pr.account_id=new.account_id
    where o.id=new.outbox_id
      and o.message_id='purchase_access_ready'
      and o.template_id='purchase_access_ready'
      and o.classification='transactional'
      and o.business_object_type='purchase'
      and o.business_object_id=new.purchase_id::text
      and o.template_version=new.template_version
      and o.provider='resend' and o.status='queued'
      and o.recipient_email_normalized=lower(btrim(pr.email))
      and pu.account_id=new.account_id
      and pu.provider='lemon-squeezy'
      and pu.status='completed'
      and pu.refunded_at is null and pu.disputed_at is null
      and pr.status='active'
      and exists (select 1 from public.entitlements e
        where e.purchase_id=new.purchase_id
          and e.account_id=new.account_id
          and e.product_id=pu.product_id and e.state='active')
  ) then raise exception 'UI02_LOCALE_SNAPSHOT_AUTHORITY_MISMATCH'; end if;
  if new.locale_source='verified_account' then
    if not exists (select 1 from public.account_transactional_locale_preferences ap
      where ap.account_id=new.account_id
        and ap.preferred_locale=new.render_locale
        and ap.revision=new.preference_revision)
    then raise exception 'UI02_LOCALE_PREFERENCE_REVISION_MISMATCH'; end if;
  elsif exists (select 1 from public.account_transactional_locale_preferences ap
      where ap.account_id=new.account_id)
  then raise exception 'UI02_ENGLISH_FALLBACK_WITH_EXISTING_PREFERENCE'; end if;
  return new;
end
$fn$;
revoke all on function public.ui02_enforce_immutable_access_locale() from public, anon, authenticated;
grant execute on function public.ui02_enforce_immutable_access_locale() to service_role;
create trigger ui02_access_locale_authoritative_insert
before insert on public.purchase_access_ready_locale_snapshots
for each row execute function public.ui02_enforce_immutable_access_locale();
create trigger ui02_access_locale_immutable_mutation
before update or delete on public.purchase_access_ready_locale_snapshots
for each row execute function public.ui02_enforce_immutable_access_locale();

-- BLOCKED until separate approval:
-- 1. Atomic pairing of outbox+locale snapshot in a single trusted transaction.
-- 2. Dispatch must reject any outbox record missing its snapshot.
-- 3. Snapshot/template version must be bound to existing deterministic key.
-- 4. Concurrency proof under customer preference updates; RLS actor tests.
-- 5. No production migration, no historic send, no merchant replay.
