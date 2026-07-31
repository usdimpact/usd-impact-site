begin;

alter table public.purchases
  add column if not exists provider_price_id text,
  add column if not exists provider_event_id text,
  add column if not exists subtotal_cents integer,
  add column if not exists tax_cents integer,
  add column if not exists total_cents integer,
  add column if not exists raw_metadata jsonb not null default '{}'::jsonb;

alter table public.purchases
  drop constraint if exists purchases_subtotal_nonnegative,
  add constraint purchases_subtotal_nonnegative
    check (subtotal_cents is null or subtotal_cents >= 0),
  drop constraint if exists purchases_tax_nonnegative,
  add constraint purchases_tax_nonnegative
    check (tax_cents is null or tax_cents >= 0),
  drop constraint if exists purchases_total_nonnegative,
  add constraint purchases_total_nonnegative
    check (total_cents is null or total_cents >= 0),
  drop constraint if exists purchases_raw_metadata_object,
  add constraint purchases_raw_metadata_object
    check (jsonb_typeof(raw_metadata) = 'object');

create unique index if not exists purchases_provider_event_id_unique
  on public.purchases(provider_event_id)
  where provider_event_id is not null;

create or replace function public.reserve_paddle_purchase_intent(
  p_account_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id constant text := 'read-the-dollar-first-guided-interactive-edition';
  v_profile public.profiles%rowtype;
  v_offer public.product_offers%rowtype;
  v_existing public.purchase_intents%rowtype;
  v_intent public.purchase_intents%rowtype;
  v_completed_count integer;
  v_reservation_count integer;
  v_price_tier text;
  v_amount_cents integer;
  v_reason text;
begin
  if p_account_id is null then
    raise exception 'account_id is required' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 or char_length(p_idempotency_key) > 255 then
    raise exception 'idempotency_key is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_product_id, 0));

  select * into v_existing
  from public.purchase_intents
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.account_id <> p_account_id then
      raise exception 'idempotency key belongs to another account' using errcode = '42501';
    end if;
    return to_jsonb(v_existing);
  end if;

  select * into v_profile
  from public.profiles
  where account_id = p_account_id
  for update;

  if not found or v_profile.status <> 'active' then
    raise exception 'profile is not active' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.entitlements
    where account_id = p_account_id
      and product_id = v_product_id
      and state = 'active'
  ) then
    raise exception 'account is already entitled' using errcode = 'P0001';
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
  where product_id = v_product_id
    and status = 'completed';

  select count(*)::integer into v_reservation_count
  from public.purchase_intents
  where product_id = v_product_id
    and price_tier = 'launch'
    and status in ('pending', 'checkout_created')
    and expires_at > p_now;

  if v_offer.closed_at is not null then
    v_price_tier := 'standard';
    v_reason := 'offer-closed';
  elsif p_now < v_offer.launch_starts_at then
    v_price_tier := 'standard';
    v_reason := 'launch-not-started';
  elsif p_now >= v_offer.launch_ends_at then
    v_price_tier := 'standard';
    v_reason := 'launch-deadline-reached';
  elsif v_completed_count >= v_offer.purchase_limit then
    v_price_tier := 'standard';
    v_reason := 'launch-purchase-limit-reached';
  elsif (v_completed_count + v_reservation_count) >= v_offer.purchase_limit then
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
      'version', 1,
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
      'completedLivePurchaseCountAtSelection', v_completed_count,
      'inFlightLaunchReservationCountAtSelection', v_reservation_count,
      'offerClosedAtSelection', v_offer.closed_at
    ),
    p_now + interval '30 minutes'
  )
  returning * into v_intent;

  return to_jsonb(v_intent);
end;
$$;

create or replace function public.attach_paddle_transaction(
  p_intent_id uuid,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.purchase_intents%rowtype;
begin
  if p_transaction_id is null or p_transaction_id !~ '^txn_[a-z0-9]{26}$' then
    raise exception 'transaction_id is invalid' using errcode = '22023';
  end if;

  select * into v_intent
  from public.purchase_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'purchase intent not found' using errcode = 'P0002';
  end if;
  if v_intent.status not in ('pending', 'checkout_created') then
    raise exception 'purchase intent cannot attach a transaction' using errcode = 'P0001';
  end if;
  if v_intent.provider_checkout_id is not null
     and v_intent.provider_checkout_id <> p_transaction_id then
    raise exception 'purchase intent already has another transaction' using errcode = '23505';
  end if;

  update public.purchase_intents
  set status = 'checkout_created',
      provider_checkout_id = p_transaction_id,
      updated_at = now()
  where id = p_intent_id
  returning * into v_intent;

  return to_jsonb(v_intent);
end;
$$;

create or replace function public.complete_paddle_purchase(
  p_event_id text,
  p_occurred_at timestamptz,
  p_transaction_id text,
  p_customer_id text,
  p_intent_id uuid,
  p_account_id uuid,
  p_product_id text,
  p_price_id text,
  p_price_tier text,
  p_currency text,
  p_subtotal_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.purchase_intents%rowtype;
  v_existing_purchase public.purchases%rowtype;
  v_purchase public.purchases%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_previous_state public.entitlement_state;
  v_event_key text;
begin
  if p_event_id is null or p_transaction_id !~ '^txn_[a-z0-9]{26}$' then
    raise exception 'provider identifiers are invalid' using errcode = '22023';
  end if;
  if p_product_id <> 'read-the-dollar-first-guided-interactive-edition' then
    raise exception 'product does not match paid access product' using errcode = '42501';
  end if;
  if p_price_tier not in ('launch', 'standard') or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'commercial terms are invalid' using errcode = '22023';
  end if;
  if p_subtotal_cents <= 0 or p_tax_cents < 0 or p_total_cents < p_subtotal_cents then
    raise exception 'transaction totals are invalid' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id, 0));

  select * into v_existing_purchase
  from public.purchases
  where provider_transaction_id = p_transaction_id
  limit 1;

  if found then
    if v_existing_purchase.account_id <> p_account_id
       or v_existing_purchase.product_id <> p_product_id then
      raise exception 'existing transaction belongs to another purchase' using errcode = '42501';
    end if;
    return jsonb_build_object(
      'purchase_id', v_existing_purchase.id,
      'entitlement_id', (
        select id from public.entitlements
        where account_id = p_account_id and product_id = p_product_id
        limit 1
      ),
      'duplicate_transaction', true
    );
  end if;

  select * into v_intent
  from public.purchase_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'trusted purchase intent not found' using errcode = 'P0002';
  end if;
  if v_intent.account_id <> p_account_id
     or v_intent.product_id <> p_product_id
     or v_intent.price_tier <> p_price_tier
     or v_intent.currency <> p_currency
     or v_intent.amount_cents <> p_subtotal_cents then
    raise exception 'transaction does not match trusted purchase intent' using errcode = '42501';
  end if;
  if v_intent.provider_checkout_id is not null
     and v_intent.provider_checkout_id <> p_transaction_id then
    raise exception 'transaction does not match attached checkout' using errcode = '42501';
  end if;

  insert into public.purchases (
    account_id,
    purchase_intent_id,
    product_id,
    provider,
    provider_customer_id,
    provider_transaction_id,
    provider_price_id,
    provider_event_id,
    status,
    amount_cents,
    subtotal_cents,
    tax_cents,
    total_cents,
    currency,
    price_tier,
    offer_terms,
    completed_at,
    raw_metadata
  ) values (
    p_account_id,
    p_intent_id,
    p_product_id,
    'paddle',
    p_customer_id,
    p_transaction_id,
    p_price_id,
    p_event_id,
    'completed',
    p_subtotal_cents,
    p_subtotal_cents,
    p_tax_cents,
    p_total_cents,
    p_currency,
    p_price_tier,
    v_intent.offer_terms,
    coalesce(p_occurred_at, now()),
    p_payload
  )
  returning * into v_purchase;

  select * into v_entitlement
  from public.entitlements
  where account_id = p_account_id
    and product_id = p_product_id
  for update;

  if found then
    v_previous_state := v_entitlement.state;
    update public.entitlements
    set purchase_id = v_purchase.id,
        state = case
          when state in ('refunded', 'charged_back', 'account_deleted') then state
          else 'active'
        end,
        version = version + 1,
        updated_at = now()
    where id = v_entitlement.id
    returning * into v_entitlement;
  else
    v_previous_state := null;
    insert into public.entitlements (
      account_id,
      purchase_id,
      product_id,
      state,
      starts_at
    ) values (
      p_account_id,
      v_purchase.id,
      p_product_id,
      'active',
      coalesce(p_occurred_at, now())
    )
    returning * into v_entitlement;
  end if;

  v_event_key := 'paddle:transaction:' || p_transaction_id || ':completed';
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
    p_account_id,
    p_product_id,
    v_previous_state,
    v_entitlement.state,
    'verified Paddle transaction completed',
    'paddle_webhook',
    p_transaction_id,
    p_event_id,
    jsonb_build_object(
      'purchaseId', v_purchase.id,
      'priceId', p_price_id,
      'priceTier', p_price_tier,
      'subtotalCents', p_subtotal_cents,
      'taxCents', p_tax_cents,
      'totalCents', p_total_cents,
      'currency', p_currency
    ),
    coalesce(p_occurred_at, now())
  ) on conflict (event_key) do nothing;

  update public.purchase_intents
  set status = 'completed',
      provider_checkout_id = p_transaction_id,
      updated_at = now()
  where id = p_intent_id;

  return jsonb_build_object(
    'purchase_id', v_purchase.id,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_entitlement.state,
    'duplicate_transaction', false
  );
end;
$$;

grant usage on schema public to service_role;
grant select, insert, update on public.product_offers to service_role;
grant select, insert, update on public.purchase_intents to service_role;
grant select, insert, update on public.purchases to service_role;
grant select, insert, update on public.entitlements to service_role;
grant select, insert on public.entitlement_events to service_role;
grant select, insert, update on public.webhook_receipts to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.reserve_paddle_purchase_intent(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.attach_paddle_transaction(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_paddle_purchase(text, timestamptz, text, text, uuid, uuid, text, text, text, text, integer, integer, integer, jsonb) from public, anon, authenticated;

grant execute on function public.reserve_paddle_purchase_intent(uuid, text, timestamptz) to service_role;
grant execute on function public.attach_paddle_transaction(uuid, text) to service_role;
grant execute on function public.complete_paddle_purchase(text, timestamptz, text, text, uuid, uuid, text, text, text, text, integer, integer, integer, jsonb) to service_role;

commit;
