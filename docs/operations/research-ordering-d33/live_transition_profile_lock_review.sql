-- D33-1/2/3 AUTHOR CANDIDATE: actual live-RPC source shape; NO deployment.
-- Applies ONLY to disposable PG17.6 fixture; holds all Production changes.
begin;
create schema if not exists review_d33_lock;
revoke all on schema review_d33_lock from public,anon,authenticated,service_role;
create or replace function review_d33_lock.lock_account_profile(p_account uuid)
returns public.account_status
language plpgsql security definer set search_path='' as $d33$
declare v_status public.account_status;
begin
  select p.status into v_status from public.profiles p
   where p.account_id=p_account for share;
  if not found then
    raise exception 'd33: missing profile' using errcode='42501';
  end if;
  return v_status;
end;
$d33$;
revoke all on function review_d33_lock.lock_account_profile(uuid)
 from public,anon,authenticated,service_role;
grant usage on schema review_d33_lock to service_role;
grant execute on function review_d33_lock.lock_account_profile(uuid) to service_role;
-- The private definer is a *modelled migration owner*. Its real custody must
-- receive separate security acceptance; no broad profiles.UPDATE to service_role.
create or replace function public.apply_research_membership_transition(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_expected_provider text,
  p_expected_provider_subscription_id text,
  p_expected_from_state public.subscription_state,
  p_to_state public.subscription_state,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_entitlement_state public.entitlement_state,
  p_entitlement_starts_at timestamptz,
  p_entitlement_ends_at timestamptz,
  p_reason text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
  v_profile_status public.account_status;
  v_subscription public.subscriptions%rowtype;
  v_existing_event public.subscription_events%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_old_entitlement_state public.entitlement_state;
  v_terminal boolean;
  v_effective_entitlement_state public.entitlement_state;
  v_kept_deleted boolean := false;
begin
  if p_event_key is null or btrim(p_event_key) = '' then
    raise exception 'event key is required';
  end if;
  if p_provider_event_id is null or btrim(p_provider_event_id) = '' then
    raise exception 'provider event id is required';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'transition reason is required';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'transition metadata must be a JSON object';
  end if;
  if p_occurred_at is null then
    raise exception 'occurred_at is required';
  end if;

  -- Resolve immutable subscription account identity BEFORE taking any subscription
  -- or entitlement row lock. Hold a profile SHARE lock until transaction commit:
  -- deletion request/finalizer update the profile row and cannot overtake it.
  select s.account_id into v_account_id from public.subscriptions s
   where s.id=p_subscription_id;
  if not found then
    raise exception 'Research Membership subscription not found' using errcode='P0002';
  end if;
  v_profile_status := review_d33_lock.lock_account_profile(v_account_id);

  select *
    into v_subscription
    from public.subscriptions
   where id = p_subscription_id
   for update;

  if not found then
    raise exception 'Research Membership subscription not found';
  end if;

  select *
    into v_existing_event
    from public.subscription_events
   where event_key = p_event_key;

  if found then
    if v_existing_event.subscription_id <> p_subscription_id
       or coalesce(v_existing_event.provider_event_id, '') <> p_provider_event_id then
      raise exception 'duplicate event key conflicts with existing subscription evidence';
    end if;
    return jsonb_build_object(
      'action', 'duplicate',
      'subscription_id', p_subscription_id,
      'event_key', p_event_key
    );
  end if;

  if v_subscription.account_id is distinct from v_account_id then
    raise exception 'account binding changed during transition' using errcode='42501';
  end if;
  if v_subscription.product_id <> 'research-membership' then
    raise exception 'subscription product mismatch';
  end if;
  if v_subscription.provider <> p_expected_provider then
    raise exception 'subscription provider mismatch';
  end if;
  if v_subscription.provider_subscription_id <> p_expected_provider_subscription_id then
    raise exception 'provider subscription id mismatch';
  end if;
  if v_subscription.state <> p_expected_from_state then
    raise exception 'subscription state drift: expected %, found %', p_expected_from_state, v_subscription.state;
  end if;

  -- Positive/benefit-bearing lifecycle events must not grant anything once
  -- an account is suspended, deletion_pending or already deleted.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    raise exception 'd33: Research paid grant refused for nonactive profile'
      using errcode='42501';
  end if;
  v_effective_entitlement_state := p_entitlement_state;
  v_terminal := p_to_state in ('cancelled', 'refunded', 'charged_back');

  update public.subscriptions
     set state = p_to_state,
         current_period_start = p_current_period_start,
         current_period_end = p_current_period_end,
         cancel_at_period_end = p_cancel_at_period_end,
         cancel_scheduled_at = case
           when p_to_state = 'cancel_scheduled' then coalesce(cancel_scheduled_at, p_occurred_at)
           when p_to_state = 'active' then null
           else cancel_scheduled_at
         end,
         cancelled_at = case
           when p_to_state = 'cancelled' then coalesce(cancelled_at, p_occurred_at)
           else cancelled_at
         end,
         ended_at = case
           when v_terminal then coalesce(ended_at, p_occurred_at)
           else ended_at
         end,
         last_provider_event_id = p_provider_event_id,
         version = version + 1
   where id = p_subscription_id;

  select *
    into v_entitlement
    from public.entitlements
   where account_id = v_subscription.account_id
     and product_id = 'research-membership'
   for update;

  if not found then
    if p_entitlement_state <> 'active' then
      raise exception 'non-active transition cannot create a missing Research Membership entitlement';
    end if;
    if p_entitlement_starts_at is null then
      raise exception 'active entitlement requires starts_at';
    end if;

    insert into public.entitlements (
      account_id,
      subscription_id,
      product_id,
      state,
      starts_at,
      ends_at
    ) values (
      v_subscription.account_id,
      p_subscription_id,
      'research-membership',
      p_entitlement_state,
      p_entitlement_starts_at,
      p_entitlement_ends_at
    )
    returning * into v_entitlement;

    v_old_entitlement_state := null;
  else
    if v_entitlement.purchase_id is not null then
      raise exception 'Research Membership entitlement is unexpectedly purchase-backed';
    end if;
    if v_entitlement.subscription_id is distinct from p_subscription_id then
      raise exception 'Research Membership entitlement subscription mismatch';
    end if;
    if p_entitlement_ends_at is not null and p_entitlement_ends_at <= v_entitlement.starts_at then
      raise exception 'entitlement ends_at must be after starts_at';
    end if;

    v_old_entitlement_state := v_entitlement.state;

    if v_entitlement.state = 'account_deleted' then
      -- A legitimate late negative provider fact may settle the subscription,
      -- but MUST NOT erase the terminal account_deleted entitlement marker.
      -- Store the provider outcome in subscription_events and an append-only
      -- entitlement_event with the same terminal effective state.
      if p_to_state not in ('cancelled','refunded','charged_back','disputed')
         or p_entitlement_state not in
            ('refunded','charged_back','revoked','suspended_dispute','account_deleted') then
        raise exception 'd33: deleted entitlement cannot reopen'
          using errcode='42501';
      end if;
      v_effective_entitlement_state := 'account_deleted';
      v_kept_deleted := true;
    else
      update public.entitlements
         set state = p_entitlement_state,
             starts_at = case
               when p_entitlement_state = 'active' and p_entitlement_starts_at is not null
                 then least(starts_at, p_entitlement_starts_at)
               else starts_at
             end,
             ends_at = p_entitlement_ends_at,
             version = version + 1
       where id = v_entitlement.id
       returning * into v_entitlement;
    end if;
  end if;

  insert into public.subscription_events (
    event_key,
    subscription_id,
    account_id,
    product_id,
    from_state,
    to_state,
    reason,
    actor_type,
    provider_event_id,
    metadata,
    occurred_at
  ) values (
    p_event_key,
    p_subscription_id,
    v_subscription.account_id,
    'research-membership',
    p_expected_from_state,
    p_to_state,
    p_reason,
    'provider_webhook',
    p_provider_event_id,
    p_metadata,
    p_occurred_at
  );

  insert into public.entitlement_events (
    event_key,
    entitlement_id,
    account_id,
    product_id,
    from_state,
    to_state,
    reason,
    actor_type,
    provider_event_id,
    metadata,
    occurred_at
  ) values (
    p_event_key || ':entitlement',
    v_entitlement.id,
    v_subscription.account_id,
    'research-membership',
    v_old_entitlement_state,
    v_effective_entitlement_state,
    p_reason,
    'provider_webhook',
    p_provider_event_id,
    p_metadata || case when v_kept_deleted then
      jsonb_build_object('d33_terminal_marker_preserved',true,
                         'requested_entitlement_state',p_entitlement_state::text)
      else '{}'::jsonb end,
    p_occurred_at
  );

  return jsonb_build_object(
    'action', 'applied',
    'subscription_id', p_subscription_id,
    'subscription_state', p_to_state,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_effective_entitlement_state,
    'account_deleted_marker_preserved',v_kept_deleted,
    'event_key', p_event_key
  );
end;
$$;
commit;
