begin;

alter table public.product_offers
  drop constraint product_offers_purchase_limit;
alter table public.product_offers
  alter column purchase_limit drop not null;
alter table public.product_offers
  add constraint product_offers_purchase_limit
  check (purchase_limit is null or purchase_limit > 0);

alter table public.product_offers
  drop constraint product_offers_window;
alter table public.product_offers
  alter column launch_ends_at drop not null;
alter table public.product_offers
  add constraint product_offers_window
  check (launch_ends_at is null or launch_ends_at > launch_starts_at);

do $$
declare
  v_offer public.product_offers%rowtype;
begin
  select * into v_offer
  from public.product_offers
  where product_id = 'read-the-dollar-first-guided-interactive-edition'
  for update;

  if not found then
    raise exception 'Library Pass offer is missing';
  end if;

  if v_offer.currency <> 'USD'
    or v_offer.launch_price_cents <> 3900
    or v_offer.standard_price_cents <> 4900 then
    raise exception 'Library Pass price terms do not match the approved contract';
  end if;

  if v_offer.closed_at is not null then
    raise exception 'Library Pass offer must remain open while applying the uncapped contract';
  end if;

  update public.product_offers
  set
    purchase_limit = null,
    launch_ends_at = null,
    updated_at = now()
  where product_id = 'read-the-dollar-first-guided-interactive-edition';
end;
$$;

create or replace function public.reserve_commerce_purchase_intent(
  p_account_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product_id constant text := 'read-the-dollar-first-guided-interactive-edition';
  v_profile public.profiles%rowtype;
  v_offer public.product_offers%rowtype;
  v_existing public.purchase_intents%rowtype;
  v_open public.purchase_intents%rowtype;
  v_intent public.purchase_intents%rowtype;
  v_entitlement_state public.entitlement_state;
  v_completed_count integer;
  v_reservation_count integer;
  v_price_tier text;
  v_amount_cents integer;
  v_reason text;
begin
  if p_account_id is null then
    raise exception 'account_id is required' using errcode = '22023';
  end if;
  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 8
     or char_length(p_idempotency_key) > 255 then
    raise exception 'idempotency_key is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_product_id || ':' || p_account_id::text, 0));

  select * into v_profile
  from public.profiles
  where account_id = p_account_id;

  if not found or v_profile.status <> 'active' then
    raise exception 'profile is not active' using errcode = 'P0001';
  end if;

  select state into v_entitlement_state
  from public.entitlements
  where account_id = p_account_id
    and product_id = v_product_id
  for update;

  if found and v_entitlement_state in ('active', 'suspended', 'suspended_dispute') then
    raise exception 'account is already entitled' using errcode = 'P0001';
  end if;
  if found and v_entitlement_state in ('charged_back', 'revoked', 'account_deleted') then
    raise exception 'account is not eligible for checkout' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.purchase_intents
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.account_id <> p_account_id then
      raise exception 'idempotency key belongs to another account' using errcode = '42501';
    end if;
    if v_existing.status not in ('pending', 'checkout_created', 'failed')
       or v_existing.expires_at is null
       or v_existing.expires_at <= p_now then
      raise exception 'idempotency key is no longer reusable' using errcode = 'P0001';
    end if;
    return to_jsonb(v_existing) || jsonb_build_object('reused_open_intent', true);
  end if;

  select * into v_open
  from public.purchase_intents
  where account_id = p_account_id
    and product_id = v_product_id
    and status in ('pending', 'checkout_created', 'failed')
    and expires_at > p_now
  order by created_at desc
  limit 1
  for update;

  if found then
    return to_jsonb(v_open) || jsonb_build_object('reused_open_intent', true);
  end if;

  select * into v_offer
  from public.product_offers
  where product_id = v_product_id
  for update;

  if not found then
    raise exception 'product offer is not configured' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_completed_count
  from public.purchases
  where product_id = v_product_id;

  select count(*)::integer into v_reservation_count
  from public.purchase_intents
  where product_id = v_product_id
    and price_tier = 'launch'
    and status in ('pending', 'checkout_created', 'failed')
    and expires_at > p_now;

  if v_offer.closed_at is not null then
    v_price_tier := 'standard';
    v_reason := 'offer-closed';
  elsif p_now < v_offer.launch_starts_at then
    v_price_tier := 'standard';
    v_reason := 'launch-not-started';
  elsif v_offer.launch_ends_at is not null
    and p_now >= v_offer.launch_ends_at then
    v_price_tier := 'standard';
    v_reason := 'launch-deadline-reached';
  elsif v_offer.purchase_limit is not null
    and v_completed_count >= v_offer.purchase_limit then
    v_price_tier := 'standard';
    v_reason := 'launch-purchase-limit-reached';
  elsif v_offer.purchase_limit is not null
    and (v_completed_count + v_reservation_count) >= v_offer.purchase_limit then
    v_price_tier := 'standard';
    v_reason := 'launch-capacity-reserved';
  else
    v_price_tier := 'launch';
    v_reason := 'launch-active';
  end if;

  v_amount_cents := case
    when v_price_tier = 'launch' then v_offer.launch_price_cents
    else v_offer.standard_price_cents
  end;

  insert into public.purchase_intents (
    idempotency_key,
    account_id,
    product_id,
    status,
    price_tier,
    amount_cents,
    currency,
    offer_terms,
    expires_at
  ) values (
    p_idempotency_key,
    p_account_id,
    v_product_id,
    'pending',
    v_price_tier,
    v_amount_cents,
    v_offer.currency,
    jsonb_build_object(
      'version', 4,
      'productId', v_product_id,
      'currency', v_offer.currency,
      'launchPriceCents', v_offer.launch_price_cents,
      'standardPriceCents', v_offer.standard_price_cents,
      'purchaseLimit', v_offer.purchase_limit,
      'launchStartsAt', v_offer.launch_starts_at,
      'launchEndsAt', v_offer.launch_ends_at,
      'selectedPriceTier', v_price_tier,
      'selectedAmountCents', v_amount_cents,
      'selectionReason', v_reason,
      'selectedAt', p_now,
      'completedTransactionCountAtSelection', v_completed_count,
      'inFlightLaunchReservationCountAtSelection', v_reservation_count,
      'offerClosedAtSelection', v_offer.closed_at
    ),
    p_now + interval '30 minutes'
  )
  returning * into v_intent;

  return to_jsonb(v_intent) || jsonb_build_object('reused_open_intent', false);
end;
$$;

revoke all on function public.reserve_commerce_purchase_intent(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_commerce_purchase_intent(uuid, text, timestamptz)
  to service_role;

do $$
declare
  v_offer public.product_offers%rowtype;
  v_security_definer boolean;
begin
  select * into v_offer
  from public.product_offers
  where product_id = 'read-the-dollar-first-guided-interactive-edition';

  if not found
    or v_offer.purchase_limit is not null
    or v_offer.launch_ends_at is not null
    or v_offer.closed_at is not null then
    raise exception 'Library Pass offer must remain open, uncapped, and without an automatic deadline';
  end if;

  if has_table_privilege('service_role', 'public.profiles', 'UPDATE') then
    raise exception 'service_role must not gain UPDATE on public.profiles for commerce reservation';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.reserve_commerce_purchase_intent(uuid,text,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'service_role must retain EXECUTE on reserve_commerce_purchase_intent';
  end if;

  if has_function_privilege(
    'anon',
    'public.reserve_commerce_purchase_intent(uuid,text,timestamp with time zone)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reserve_commerce_purchase_intent(uuid,text,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'API user roles must not execute reserve_commerce_purchase_intent';
  end if;

  select p.prosecdef
    into v_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'reserve_commerce_purchase_intent'
    and pg_get_function_identity_arguments(p.oid) = 'p_account_id uuid, p_idempotency_key text, p_now timestamp with time zone';

  if v_security_definer is distinct from false then
    raise exception 'reserve_commerce_purchase_intent must remain SECURITY INVOKER';
  end if;
end;
$$;

commit;
