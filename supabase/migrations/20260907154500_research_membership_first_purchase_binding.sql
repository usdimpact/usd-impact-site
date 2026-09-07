begin;

-- Bind the first provider-created Research Membership subscription to the
-- authenticated USD Impact account carried through signed checkout custom data.
-- This function creates only a pending subscription row; the existing signed
-- lifecycle transition RPC remains responsible for entitlement activation.
create or replace function public.bind_research_membership_subscription(
  p_account_id uuid,
  p_provider text,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_provider_price_id text,
  p_billing_interval public.subscription_billing_interval,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.subscriptions%rowtype;
  v_current public.subscriptions%rowtype;
  v_created public.subscriptions%rowtype;
begin
  if p_account_id is null then
    raise exception 'Research Membership account id is required';
  end if;
  if p_provider <> 'lemon-squeezy' then
    raise exception 'Research Membership provider mismatch';
  end if;
  if p_provider_subscription_id is null or btrim(p_provider_subscription_id) = '' then
    raise exception 'Research Membership provider subscription id is required';
  end if;
  if p_provider_customer_id is null or btrim(p_provider_customer_id) = '' then
    raise exception 'Research Membership provider customer id is required';
  end if;
  if p_provider_price_id is null or btrim(p_provider_price_id) = '' then
    raise exception 'Research Membership provider price id is required';
  end if;
  if p_occurred_at is null then
    raise exception 'Research Membership binding occurred_at is required';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Research Membership binding metadata must be a JSON object';
  end if;

  -- Serialize first-binding attempts per account. A concurrent delivery waits
  -- here, then observes the binding committed by the winner and returns the
  -- exact existing subscription instead of surfacing a uniqueness race.
  perform 1
    from public.profiles
   where account_id = p_account_id
     and status = 'active'
   for update;

  if not found then
    raise exception 'Research Membership account is not an active profile';
  end if;

  select *
    into v_existing
    from public.subscriptions
   where provider = p_provider
     and provider_subscription_id = p_provider_subscription_id
   for update;

  if found then
    if v_existing.account_id <> p_account_id
       or v_existing.product_id <> 'research-membership'
       or v_existing.provider <> p_provider
       or v_existing.provider_customer_id is distinct from p_provider_customer_id
       or v_existing.provider_price_id is distinct from p_provider_price_id
       or v_existing.billing_interval <> p_billing_interval then
      raise exception 'Research Membership provider subscription binding conflicts with existing evidence';
    end if;

    return jsonb_build_object(
      'action', 'existing',
      'subscription_id', v_existing.id,
      'subscription_state', v_existing.state
    );
  end if;

  select *
    into v_current
    from public.subscriptions
   where account_id = p_account_id
     and product_id = 'research-membership'
     and state in ('pending', 'active', 'past_due', 'cancel_scheduled')
   order by created_at desc
   limit 1
   for update;

  if found then
    raise exception 'Research Membership account already has a current subscription';
  end if;

  insert into public.subscriptions (
    account_id,
    product_id,
    provider,
    provider_subscription_id,
    provider_customer_id,
    provider_price_id,
    billing_interval,
    state,
    metadata,
    created_at,
    updated_at
  ) values (
    p_account_id,
    'research-membership',
    p_provider,
    p_provider_subscription_id,
    p_provider_customer_id,
    p_provider_price_id,
    p_billing_interval,
    'pending',
    p_metadata,
    p_occurred_at,
    p_occurred_at
  )
  returning * into v_created;

  return jsonb_build_object(
    'action', 'created',
    'subscription_id', v_created.id,
    'subscription_state', v_created.state
  );
end;
$$;

revoke all on function public.bind_research_membership_subscription(
  uuid, text, text, text, text, public.subscription_billing_interval, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.bind_research_membership_subscription(
  uuid, text, text, text, text, public.subscription_billing_interval, timestamptz, jsonb
) to service_role;

commit;
