begin;

create table if not exists public.paddle_adjustments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  provider_adjustment_id text not null unique,
  provider_event_id text not null,
  provider_transaction_id text not null,
  action text not null,
  status text not null,
  adjustment_type text,
  reason text,
  amount_cents integer not null,
  transition text not null default 'none',
  transition_rank integer not null default 0,
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paddle_adjustments_adjustment_id
    check (provider_adjustment_id ~ '^adj_[a-z0-9]{26}$'),
  constraint paddle_adjustments_transaction_id
    check (provider_transaction_id ~ '^txn_[a-z0-9]{26}$'),
  constraint paddle_adjustments_event_id
    check (char_length(provider_event_id) between 4 and 128),
  constraint paddle_adjustments_action
    check (action in (
      'refund',
      'chargeback_warning',
      'chargeback_warning_reverse',
      'chargeback',
      'chargeback_reverse'
    )),
  constraint paddle_adjustments_amount
    check (amount_cents >= 0),
  constraint paddle_adjustments_transition
    check (transition in (
      'none',
      'refund',
      'chargeback_warning',
      'chargeback_warning_reverse',
      'chargeback',
      'chargeback_reverse'
    )),
  constraint paddle_adjustments_transition_rank
    check (transition_rank between 0 and 50),
  constraint paddle_adjustments_payload
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists paddle_adjustments_transaction_occurred_idx
  on public.paddle_adjustments(provider_transaction_id, occurred_at desc);
create index if not exists paddle_adjustments_purchase_occurred_idx
  on public.paddle_adjustments(purchase_id, occurred_at desc);

alter table public.paddle_adjustments enable row level security;

create or replace function public.apply_paddle_adjustment_lifecycle(
  p_event_id text,
  p_occurred_at timestamptz,
  p_adjustment_id text,
  p_transaction_id text,
  p_action text,
  p_status text,
  p_adjustment_total_cents integer,
  p_adjustment_type text,
  p_reason text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_existing_adjustment public.paddle_adjustments%rowtype;
  v_latest_dispute public.paddle_adjustments%rowtype;
  v_profile_status public.account_status;
  v_previous_state public.entitlement_state;
  v_target_state public.entitlement_state;
  v_target_purchase_status public.purchase_status;
  v_purchase_total_cents integer;
  v_transition text := 'none';
  v_transition_rank integer := 0;
  v_event_key text;
  v_effective_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_state_changed boolean := false;
  v_purchase_changed boolean := false;
  v_stale boolean := false;
  v_restore_allowed boolean := false;
  v_full_refund_exists boolean := false;
  v_event_reason text;
begin
  if p_event_id is null or char_length(p_event_id) < 4 or char_length(p_event_id) > 128 then
    raise exception 'event_id is invalid' using errcode = '22023';
  end if;
  if p_adjustment_id !~ '^adj_[a-z0-9]{26}$'
     or p_transaction_id !~ '^txn_[a-z0-9]{26}$' then
    raise exception 'provider identifiers are invalid' using errcode = '22023';
  end if;
  if p_action not in (
    'refund',
    'chargeback_warning',
    'chargeback_warning_reverse',
    'chargeback',
    'chargeback_reverse'
  ) then
    raise exception 'adjustment action is unsupported' using errcode = '22023';
  end if;
  if p_status is null or char_length(p_status) < 2 or char_length(p_status) > 64 then
    raise exception 'adjustment status is invalid' using errcode = '22023';
  end if;
  if p_adjustment_total_cents is null or p_adjustment_total_cents < 0 then
    raise exception 'adjustment total is invalid' using errcode = '22023';
  end if;
  if p_adjustment_type is not null and char_length(p_adjustment_type) > 32 then
    raise exception 'adjustment type is invalid' using errcode = '22023';
  end if;
  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'adjustment reason is invalid' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload is invalid' using errcode = '22023';
  end if;

  if p_action = 'refund' and p_status = 'approved' and p_adjustment_total_cents > 0 then
    v_transition := 'refund';
    v_transition_rank := 50;
  elsif p_action = 'chargeback_warning' and p_status = 'approved' and p_adjustment_total_cents > 0 then
    v_transition := 'chargeback_warning';
    v_transition_rank := 10;
  elsif p_action = 'chargeback' and p_status = 'approved' and p_adjustment_total_cents > 0 then
    v_transition := 'chargeback';
    v_transition_rank := 30;
  elsif p_action = 'chargeback_warning_reverse' and p_status = 'approved' then
    v_transition := 'chargeback_warning_reverse';
    v_transition_rank := 20;
  elsif p_action = 'chargeback_reverse' and p_status = 'approved' then
    v_transition := 'chargeback_reverse';
    v_transition_rank := 40;
  elsif p_action = 'chargeback_warning' and p_status = 'reversed' then
    v_transition := 'chargeback_warning_reverse';
    v_transition_rank := 20;
  elsif p_action = 'chargeback' and p_status = 'reversed' then
    v_transition := 'chargeback_reverse';
    v_transition_rank := 40;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id, 0));

  select * into v_purchase
  from public.purchases
  where provider = 'paddle'
    and provider_transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'matching Paddle purchase not found' using errcode = 'P0002';
  end if;

  v_purchase_total_cents := coalesce(v_purchase.total_cents, v_purchase.amount_cents);
  if v_purchase_total_cents is null or v_purchase_total_cents <= 0 then
    raise exception 'matching purchase total is invalid' using errcode = 'P0001';
  end if;

  select * into v_existing_adjustment
  from public.paddle_adjustments
  where provider_adjustment_id = p_adjustment_id
  for update;

  if found and v_existing_adjustment.occurred_at > v_effective_occurred_at then
    v_stale := true;
  else
    insert into public.paddle_adjustments (
      purchase_id,
      provider_adjustment_id,
      provider_event_id,
      provider_transaction_id,
      action,
      status,
      adjustment_type,
      reason,
      amount_cents,
      transition,
      transition_rank,
      payload,
      occurred_at
    ) values (
      v_purchase.id,
      p_adjustment_id,
      p_event_id,
      p_transaction_id,
      p_action,
      p_status,
      p_adjustment_type,
      p_reason,
      p_adjustment_total_cents,
      v_transition,
      v_transition_rank,
      p_payload,
      v_effective_occurred_at
    )
    on conflict (provider_adjustment_id) do update
    set provider_event_id = excluded.provider_event_id,
        purchase_id = excluded.purchase_id,
        provider_transaction_id = excluded.provider_transaction_id,
        action = excluded.action,
        status = excluded.status,
        adjustment_type = excluded.adjustment_type,
        reason = excluded.reason,
        amount_cents = excluded.amount_cents,
        transition = excluded.transition,
        transition_rank = excluded.transition_rank,
        payload = excluded.payload,
        occurred_at = excluded.occurred_at,
        updated_at = now()
    where excluded.occurred_at > public.paddle_adjustments.occurred_at
       or (
         excluded.occurred_at = public.paddle_adjustments.occurred_at
         and excluded.transition_rank >= public.paddle_adjustments.transition_rank
       );
  end if;

  if v_transition in (
    'chargeback_warning',
    'chargeback_warning_reverse',
    'chargeback',
    'chargeback_reverse'
  ) then
    select * into v_latest_dispute
    from public.paddle_adjustments
    where provider_transaction_id = p_transaction_id
      and transition in (
        'chargeback_warning',
        'chargeback_warning_reverse',
        'chargeback',
        'chargeback_reverse'
      )
    order by occurred_at desc, transition_rank desc, updated_at desc
    limit 1;

    if found and (
      v_latest_dispute.occurred_at > v_effective_occurred_at
      or (
        v_latest_dispute.occurred_at = v_effective_occurred_at
        and v_latest_dispute.transition_rank > v_transition_rank
      )
    ) then
      v_stale := true;
    end if;
  end if;

  if v_stale then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', true,
      'transition', v_transition,
      'purchase_id', v_purchase.id
    );
  end if;

  if v_transition = 'none' then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', false,
      'transition', v_transition,
      'purchase_id', v_purchase.id,
      'reason', 'no_access_transition_for_status'
    );
  end if;

  if v_transition = 'refund' and p_adjustment_total_cents < v_purchase_total_cents then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', false,
      'transition', v_transition,
      'purchase_id', v_purchase.id,
      'reason', 'partial_amount',
      'purchase_total_cents', v_purchase_total_cents,
      'adjustment_total_cents', p_adjustment_total_cents
    );
  end if;

  select * into v_entitlement
  from public.entitlements
  where purchase_id = v_purchase.id
    and account_id = v_purchase.account_id
    and product_id = v_purchase.product_id
  for update;

  if not found then
    raise exception 'matching entitlement not found' using errcode = 'P0002';
  end if;

  select status into v_profile_status
  from public.profiles
  where account_id = v_purchase.account_id;

  v_previous_state := v_entitlement.state;
  v_target_state := v_entitlement.state;
  v_target_purchase_status := v_purchase.status;

  if v_transition = 'refund' then
    v_target_purchase_status := 'refunded'::public.purchase_status;
    if v_entitlement.state <> 'account_deleted' then
      v_target_state := 'refunded'::public.entitlement_state;
    end if;
    v_event_reason := 'approved full-amount Paddle refund';
  elsif v_transition = 'chargeback_warning' then
    if v_purchase.status = 'completed' then
      v_target_purchase_status := 'disputed'::public.purchase_status;
    end if;
    if v_entitlement.state = 'active' then
      v_target_state := 'suspended_dispute'::public.entitlement_state;
    end if;
    v_event_reason := 'Paddle chargeback warning suspended access';
  elsif v_transition = 'chargeback' then
    if v_purchase.status <> 'refunded' then
      v_target_purchase_status := 'charged_back'::public.purchase_status;
    end if;
    if v_entitlement.state not in ('account_deleted', 'refunded', 'revoked') then
      v_target_state := 'charged_back'::public.entitlement_state;
    end if;
    v_event_reason := 'Paddle chargeback revoked access';
  elsif v_transition = 'chargeback_warning_reverse' then
    v_restore_allowed := v_profile_status = 'active'
      and v_entitlement.state = 'suspended_dispute'
      and v_purchase.status = 'disputed';
    if v_restore_allowed then
      v_target_state := 'active'::public.entitlement_state;
      v_target_purchase_status := 'completed'::public.purchase_status;
      v_event_reason := 'Paddle chargeback warning reversal restored access';
    else
      v_event_reason := 'Paddle chargeback warning reversal did not restore access';
    end if;
  elsif v_transition = 'chargeback_reverse' then
    select exists (
      select 1
      from public.paddle_adjustments
      where purchase_id = v_purchase.id
        and action = 'refund'
        and status = 'approved'
        and amount_cents >= v_purchase_total_cents
    ) into v_full_refund_exists;

    v_restore_allowed := v_profile_status = 'active'
      and v_entitlement.state in ('suspended_dispute', 'charged_back')
      and not v_full_refund_exists
      and v_purchase.status <> 'refunded';
    if v_restore_allowed then
      v_target_state := 'active'::public.entitlement_state;
      v_target_purchase_status := 'completed'::public.purchase_status;
      v_event_reason := 'Paddle chargeback reversal restored access';
    else
      v_event_reason := 'Paddle chargeback reversal did not restore access';
    end if;
  end if;

  v_state_changed := v_target_state <> v_entitlement.state;
  v_purchase_changed := v_target_purchase_status <> v_purchase.status;
  v_event_key := 'paddle:adjustment:' || p_adjustment_id || ':' || v_transition;

  if exists (
    select 1 from public.entitlement_events where event_key = v_event_key
  ) then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', false,
      'duplicate_transition', true,
      'transition', v_transition,
      'purchase_id', v_purchase.id,
      'entitlement_id', v_entitlement.id,
      'entitlement_state', v_entitlement.state
    );
  end if;

  update public.purchases
  set status = v_target_purchase_status,
      refunded_at = case
        when v_transition = 'refund' then v_effective_occurred_at
        else refunded_at
      end,
      disputed_at = case
        when v_transition in ('chargeback_warning', 'chargeback')
          then coalesce(disputed_at, v_effective_occurred_at)
        else disputed_at
      end,
      raw_metadata = raw_metadata || jsonb_build_object(
        'latestAdjustmentId', p_adjustment_id,
        'latestAdjustmentAction', p_action,
        'latestAdjustmentStatus', p_status,
        'latestAdjustmentType', p_adjustment_type,
        'latestAdjustmentReason', p_reason,
        'latestAdjustmentTotalCents', p_adjustment_total_cents,
        'latestAdjustmentTransition', v_transition,
        'latestAdjustmentEventId', p_event_id,
        'latestAdjustmentOccurredAt', v_effective_occurred_at,
        'latestAdjustmentPayload', p_payload
      ),
      updated_at = now()
  where id = v_purchase.id
  returning * into v_purchase;

  if v_state_changed then
    update public.entitlements
    set state = v_target_state,
        version = version + 1,
        updated_at = now()
    where id = v_entitlement.id
    returning * into v_entitlement;
  end if;

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
    provider_event_id,
    metadata,
    occurred_at
  ) values (
    v_event_key,
    v_entitlement.id,
    v_purchase.account_id,
    v_purchase.product_id,
    v_previous_state,
    v_target_state,
    v_event_reason,
    'paddle_webhook',
    p_adjustment_id,
    p_event_id,
    jsonb_build_object(
      'purchaseId', v_purchase.id,
      'transactionId', p_transaction_id,
      'adjustmentId', p_adjustment_id,
      'action', p_action,
      'status', p_status,
      'adjustmentType', p_adjustment_type,
      'reason', p_reason,
      'purchaseTotalCents', v_purchase_total_cents,
      'adjustmentTotalCents', p_adjustment_total_cents,
      'transition', v_transition,
      'stateChanged', v_state_changed,
      'purchaseStatusChanged', v_purchase_changed,
      'restoreAllowed', v_restore_allowed,
      'fullRefundExists', v_full_refund_exists
    ),
    v_effective_occurred_at
  );

  return jsonb_build_object(
    'handled', true,
    'state_changed', v_state_changed,
    'purchase_status_changed', v_purchase_changed,
    'stale', false,
    'duplicate_transition', false,
    'transition', v_transition,
    'purchase_id', v_purchase.id,
    'purchase_status', v_purchase.status,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_target_state,
    'restore_allowed', v_restore_allowed
  );
end;
$$;

grant usage on schema public to service_role;
grant select, insert, update on public.paddle_adjustments to service_role;
grant select, update on public.purchases to service_role;
grant select, update on public.entitlements to service_role;
grant select on public.profiles to service_role;
grant select, insert on public.entitlement_events to service_role;

revoke all on table public.paddle_adjustments from public, anon, authenticated;
revoke all on function public.apply_paddle_adjustment_lifecycle(
  text, timestamptz, text, text, text, text, integer, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_paddle_adjustment_lifecycle(
  text, timestamptz, text, text, text, text, integer, text, text, jsonb
) to service_role;

commit;
