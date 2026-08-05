begin;

create or replace function public.apply_paddle_access_revocation(
  p_event_id text,
  p_occurred_at timestamptz,
  p_adjustment_id text,
  p_transaction_id text,
  p_action text,
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
  v_previous_state public.entitlement_state;
  v_target_state public.entitlement_state;
  v_event_key text;
begin
  if p_event_id is null or char_length(p_event_id) < 4 then
    raise exception 'event_id is invalid' using errcode = '22023';
  end if;
  if p_adjustment_id !~ '^adj_[a-z0-9]{26}$'
     or p_transaction_id !~ '^txn_[a-z0-9]{26}$' then
    raise exception 'provider identifiers are invalid' using errcode = '22023';
  end if;
  if p_action not in ('refund', 'chargeback') then
    raise exception 'adjustment action does not revoke access' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload is invalid' using errcode = '22023';
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

  select * into v_entitlement
  from public.entitlements
  where purchase_id = v_purchase.id
    and account_id = v_purchase.account_id
    and product_id = v_purchase.product_id
  for update;

  if not found then
    raise exception 'matching entitlement not found' using errcode = 'P0002';
  end if;

  v_target_state := case
    when p_action = 'chargeback' then 'charged_back'::public.entitlement_state
    else 'refunded'::public.entitlement_state
  end;
  v_previous_state := v_entitlement.state;
  v_event_key := 'paddle:adjustment:' || p_adjustment_id || ':approved-full';

  if exists (
    select 1 from public.entitlement_events where event_key = v_event_key
  ) then
    return jsonb_build_object(
      'purchase_id', v_purchase.id,
      'entitlement_id', v_entitlement.id,
      'entitlement_state', v_entitlement.state,
      'duplicate_adjustment', true
    );
  end if;

  update public.purchases
  set status = case
        when p_action = 'chargeback' then 'charged_back'
        else 'refunded'
      end,
      raw_metadata = raw_metadata || jsonb_build_object(
        'latestAdjustmentId', p_adjustment_id,
        'latestAdjustmentAction', p_action,
        'latestAdjustmentEventId', p_event_id,
        'latestAdjustmentOccurredAt', coalesce(p_occurred_at, now()),
        'latestAdjustmentPayload', p_payload
      ),
      updated_at = now()
  where id = v_purchase.id
  returning * into v_purchase;

  update public.entitlements
  set state = case
        when state = 'account_deleted' then state
        else v_target_state
      end,
      version = version + 1,
      updated_at = now()
  where id = v_entitlement.id
  returning * into v_entitlement;

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
    v_entitlement.state,
    case
      when p_action = 'chargeback' then 'approved full Paddle chargeback'
      else 'approved full Paddle refund'
    end,
    'paddle_webhook',
    p_adjustment_id,
    p_event_id,
    jsonb_build_object(
      'purchaseId', v_purchase.id,
      'transactionId', p_transaction_id,
      'adjustmentId', p_adjustment_id,
      'action', p_action,
      'fullAdjustment', true
    ),
    coalesce(p_occurred_at, now())
  );

  return jsonb_build_object(
    'purchase_id', v_purchase.id,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_entitlement.state,
    'duplicate_adjustment', false
  );
end;
$$;

grant usage on schema public to service_role;
grant select, update on public.purchases to service_role;
grant select, update on public.entitlements to service_role;
grant select, insert on public.entitlement_events to service_role;

revoke all on function public.apply_paddle_access_revocation(text, timestamptz, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_paddle_access_revocation(text, timestamptz, text, text, text, jsonb)
  to service_role;

commit;
