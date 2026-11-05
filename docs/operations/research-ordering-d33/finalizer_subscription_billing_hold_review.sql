-- D33-4 review-only: block account deletion when Research recurring billing
-- has no *local* terminal cancellation history. Local history does not prove
-- the external Lemon Squeezy billing is actually stopped.
-- The application must also check BEFORE Auth soft-delete; see JS preflight.
-- NO deployable migration; synthetic PG17 tests only. Production HOLD.
begin;
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

  -- D33 fail-closed policy-neutral readiness fence: the old finalizer ran
  -- even with an active/pending recurring subscription. Never claim provider
  -- cancellation from local SQL. Nonterminal or unsupported terminal states
  -- block deletion before content, entitlement or profile writes.
  if exists (
    select 1 from public.subscriptions s
    where s.account_id=profile_row.account_id
      and s.product_id='research-membership'
      and (
        s.state <> 'cancelled'
        or not exists (
          select 1 from public.subscription_events ev
          where ev.subscription_id=s.id
            and ev.account_id=s.account_id
            and ev.product_id='research-membership'
            and ev.to_state='cancelled'
            and ev.actor_type='provider_webhook'
            and nullif(ev.provider_event_id,'') is not null
        )
      )
  ) then
    raise exception using errcode='55000',
      message='d33: recurring billing requires cancellation evidence and owner reconciliation before deletion';
  end if;
  if exists (
    select 1 from public.entitlements e
    where e.account_id=profile_row.account_id
      and e.product_id='research-membership'
      and e.subscription_id is null
      and e.state <> 'account_deleted'
  ) then
    raise exception using errcode='55000',
      message='d33: Research entitlement has no trusted subscription source';
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
commit;
