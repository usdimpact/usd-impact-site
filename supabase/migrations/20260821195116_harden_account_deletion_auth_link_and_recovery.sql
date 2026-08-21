begin;

grant select, insert, update on table public.support_requests to service_role;

alter table public.profiles
  add column if not exists auth_user_id uuid;

update public.profiles p
set auth_user_id = p.account_id
where p.auth_user_id is null
  and p.status <> 'deleted'
  and exists (
    select 1 from auth.users u where u.id = p.account_id
  );

do $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.status in ('active', 'suspended')
      and p.auth_user_id is distinct from p.account_id
  ) then
    raise exception 'active or suspended profile is missing its canonical auth user link';
  end if;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_account_id_fkey;

alter table public.profiles
  drop constraint if exists profiles_auth_user_id_fkey;

alter table public.profiles
  add constraint profiles_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete set null;

create unique index if not exists profiles_auth_user_id_uidx
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

alter table public.profiles
  drop constraint if exists profiles_auth_link_state;

alter table public.profiles
  add constraint profiles_auth_link_state
  check (
    (status in ('active', 'suspended') and auth_user_id = account_id)
    or (status = 'deletion_pending' and (auth_user_id = account_id or auth_user_id is null))
    or (status = 'deleted' and auth_user_id is null)
  );

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (account_id, auth_user_id, email)
  values (new.id, new.id, coalesce(new.email, ''))
  on conflict (account_id) do update
    set auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        updated_at = pg_catalog.now()
    where profiles.status <> 'deleted';
  return new;
end;
$$;

create or replace function public.prepare_account_deletion_auth_removal(prepare_account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles;
  prepared_at timestamptz := pg_catalog.clock_timestamp();
begin
  if prepare_account_id is null then
    raise exception using
      errcode = '22023',
      message = 'account id is required';
  end if;

  select p.*
  into profile_row
  from public.profiles p
  where p.account_id = prepare_account_id
  for update;

  if profile_row.account_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'account profile was not found';
  end if;

  if profile_row.status <> 'deletion_pending'
     or profile_row.deletion_requested_at is null
     or profile_row.deletion_due_at is null
     or profile_row.deletion_due_at > prepared_at then
    raise exception using
      errcode = '22023',
      message = 'account is not eligible for auth removal preparation';
  end if;

  if profile_row.auth_user_id is not null
     and profile_row.auth_user_id <> profile_row.account_id then
    raise exception using
      errcode = '23514',
      message = 'profile auth user link is inconsistent';
  end if;

  update public.profiles
  set auth_user_id = null,
      updated_at = prepared_at
  where account_id = profile_row.account_id
    and auth_user_id is not null;

  return true;
end;
$$;

revoke all on function public.prepare_account_deletion_auth_removal(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion_auth_removal(uuid) to service_role;

create or replace function public.finalize_account_deletion(finalize_account_id uuid)
returns table (
  account_id uuid,
  recipient_email text,
  deletion_requested_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles;
  entitlement_row public.entitlements;
  finalized_at timestamptz := pg_catalog.clock_timestamp();
  deleted_email text;
begin
  if finalize_account_id is null then
    raise exception using
      errcode = '22023',
      message = 'account id is required';
  end if;

  select p.*
  into profile_row
  from public.profiles p
  where p.account_id = finalize_account_id
  for update;

  if profile_row.account_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'account profile was not found';
  end if;

  if profile_row.status = 'deleted' then
    return;
  end if;

  if profile_row.status <> 'deletion_pending'
     or profile_row.deletion_requested_at is null
     or profile_row.deletion_due_at is null
     or profile_row.deletion_due_at > finalized_at then
    raise exception using
      errcode = '22023',
      message = 'account is not eligible for deletion finalization';
  end if;

  if profile_row.auth_user_id is not null then
    raise exception using
      errcode = '55000',
      message = 'auth user link must be detached before deletion finalization';
  end if;

  deleted_email := format(
    'deleted+%s@accounts.invalid',
    substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
  );

  delete from public.learning_progress
  where learning_progress.account_id = profile_row.account_id;

  delete from public.bookmarks
  where bookmarks.account_id = profile_row.account_id;

  for entitlement_row in
    select e.*
    from public.entitlements e
    where e.account_id = profile_row.account_id
      and e.state <> 'account_deleted'
    for update
  loop
    insert into public.entitlement_events (
      event_key,
      entitlement_id,
      account_id,
      product_id,
      from_state,
      to_state,
      reason,
      actor_type,
      actor_id,
      metadata,
      occurred_at
    ) values (
      format('account-deletion:%s:%s', profile_row.account_id, entitlement_row.product_id),
      entitlement_row.id,
      profile_row.account_id,
      entitlement_row.product_id,
      entitlement_row.state,
      'account_deleted',
      'account deletion finalized',
      'system',
      'account-deletion-finalizer',
      '{}'::jsonb,
      finalized_at
    )
    on conflict (event_key) do nothing;

    update public.entitlements
    set state = 'account_deleted',
        ends_at = case
          when ends_at is null then greatest(finalized_at, starts_at + interval '1 microsecond')
          else ends_at
        end,
        version = version + 1,
        updated_at = finalized_at
    where id = entitlement_row.id
      and state <> 'account_deleted';
  end loop;

  update public.support_requests
  set account_id = null,
      email = format(
        'deleted+%s@support.invalid',
        substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
      ),
      updated_at = finalized_at
  where support_requests.account_id = profile_row.account_id;

  update public.privacy_requests
  set account_id = null,
      email = format(
        'deleted+%s@privacy.invalid',
        substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
      ),
      status = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then 'completed'::public.request_status
        else status
      end,
      completed_at = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then finalized_at
        else completed_at
      end,
      decision_reason = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then 'account deletion finalized'
        else decision_reason
      end,
      updated_at = finalized_at
  where privacy_requests.account_id = profile_row.account_id;

  update public.profiles
  set email = deleted_email,
      display_name = null,
      status = 'deleted',
      deleted_at = finalized_at,
      updated_at = finalized_at
  where profiles.account_id = profile_row.account_id;

  insert into public.admin_audit_entries (
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state,
    evidence_reference,
    occurred_at
  ) values (
    'account_deletion_finalized',
    'account',
    profile_row.account_id::text,
    'scheduled staged account deletion reached its due time',
    jsonb_build_object(
      'status', profile_row.status,
      'deletion_requested_at', profile_row.deletion_requested_at,
      'deletion_due_at', profile_row.deletion_due_at
    ),
    jsonb_build_object(
      'status', 'deleted',
      'deleted_at', finalized_at
    ),
    'account-deletion-finalizer:v2',
    finalized_at
  );

  account_id := profile_row.account_id;
  recipient_email := profile_row.email;
  deletion_requested_at := profile_row.deletion_requested_at;
  deleted_at := finalized_at;
  return next;
end;
$$;

revoke all on function public.finalize_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_deletion(uuid) to service_role;

commit;
