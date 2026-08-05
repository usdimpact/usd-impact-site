begin;

create table if not exists public.paddle_transaction_events (
  id uuid primary key default gen_random_uuid(),
  purchase_intent_id uuid not null references public.purchase_intents(id) on delete restrict,
  provider_transaction_id text not null,
  provider_event_id text not null unique,
  event_type text not null,
  provider_status text not null,
  transition text not null default 'none',
  transition_rank integer not null default 0,
  payment_error_code text,
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint paddle_transaction_events_transaction_id
    check (provider_transaction_id ~ '^txn_[a-z0-9]{26}$'),
  constraint paddle_transaction_events_event_id
    check (char_length(provider_event_id) between 4 and 128),
  constraint paddle_transaction_events_type
    check (event_type in (
      'transaction.updated',
      'transaction.ready',
      'transaction.paid',
      'transaction.payment_failed',
      'transaction.past_due',
      'transaction.canceled',
      'transaction.completed'
    )),
  constraint paddle_transaction_events_transition
    check (transition in ('none', 'pending', 'failed', 'cancelled', 'completed')),
  constraint paddle_transaction_events_rank
    check (transition_rank between 0 and 50),
  constraint paddle_transaction_events_payload
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists paddle_transaction_events_transaction_occurred_idx
  on public.paddle_transaction_events(provider_transaction_id, occurred_at desc);
create index if not exists paddle_transaction_events_intent_occurred_idx
  on public.paddle_transaction_events(purchase_intent_id, occurred_at desc);

alter table public.paddle_transaction_events enable row level security;

create table if not exists public.paddle_duplicate_purchases (
  id uuid primary key default gen_random_uuid(),
  original_purchase_id uuid not null references public.purchases(id) on delete restrict,
  purchase_intent_id uuid not null references public.purchase_intents(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null,
  provider_transaction_id text not null unique,
  provider_event_id text not null unique,
  provider_customer_id text,
  provider_price_id text not null,
  price_tier text not null,
  subtotal_cents integer not null,
  tax_cents integer not null,
  total_cents integer not null,
  currency text not null,
  status text not null default 'refund_required',
  refund_adjustment_id text,
  refund_adjustment_status text,
  completed_at timestamptz not null,
  refund_requested_at timestamptz,
  refunded_at timestamptz,
  payload jsonb not null,
  adjustment_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paddle_duplicate_purchases_transaction_id
    check (provider_transaction_id ~ '^txn_[a-z0-9]{26}$'),
  constraint paddle_duplicate_purchases_event_id
    check (char_length(provider_event_id) between 4 and 128),
  constraint paddle_duplicate_purchases_customer_id
    check (provider_customer_id is null or provider_customer_id ~ '^ctm_[a-z0-9]{26}$'),
  constraint paddle_duplicate_purchases_price_id
    check (provider_price_id ~ '^pri_[a-z0-9]{26}$'),
  constraint paddle_duplicate_purchases_adjustment_id
    check (refund_adjustment_id is null or refund_adjustment_id ~ '^adj_[a-z0-9]{26}$'),
  constraint paddle_duplicate_purchases_price_tier
    check (price_tier in ('launch', 'standard')),
  constraint paddle_duplicate_purchases_amounts
    check (subtotal_cents > 0 and tax_cents >= 0 and total_cents >= subtotal_cents),
  constraint paddle_duplicate_purchases_currency
    check (currency ~ '^[A-Z]{3}$'),
  constraint paddle_duplicate_purchases_status
    check (status in (
      'refund_required',
      'refund_pending',
      'refunded',
      'refund_rejected',
      'refund_failed',
      'charged_back'
    )),
  constraint paddle_duplicate_purchases_payload
    check (jsonb_typeof(payload) = 'object'),
  constraint paddle_duplicate_purchases_adjustment_payload
    check (adjustment_payload is null or jsonb_typeof(adjustment_payload) = 'object')
);

create index if not exists paddle_duplicate_purchases_account_created_idx
  on public.paddle_duplicate_purchases(account_id, created_at desc);
create index if not exists paddle_duplicate_purchases_original_purchase_idx
  on public.paddle_duplicate_purchases(original_purchase_id, created_at desc);

alter table public.paddle_duplicate_purchases enable row level security;

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
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 or char_length(p_idempotency_key) > 255 then
    raise exception 'idempotency_key is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_product_id || ':' || p_account_id::text, 0));

  select * into v_profile
  from public.profiles
  where account_id = p_account_id
  for update;

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
    return to_jsonb(v_existing) || jsonb_build_object(
      'reused_open_intent',
      v_existing.status in ('pending', 'checkout_created', 'failed')
        and v_existing.expires_at > p_now
    );
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

  select (
    (select count(*) from public.purchases where product_id = v_product_id)
    +
    (select count(*) from public.paddle_duplicate_purchases where product_id = v_product_id)
  )::integer into v_completed_count;

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
      'version', 2,
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
  if v_intent.status not in ('pending', 'checkout_created', 'failed') then
    raise exception 'purchase intent cannot attach a transaction' using errcode = 'P0001';
  end if;

  if v_intent.provider_checkout_id is not null
     and v_intent.provider_checkout_id <> p_transaction_id then
    return to_jsonb(v_intent) || jsonb_build_object('attached', false);
  end if;

  update public.purchase_intents
  set status = 'checkout_created',
      provider_checkout_id = p_transaction_id,
      updated_at = now()
  where id = p_intent_id
  returning * into v_intent;

  return to_jsonb(v_intent) || jsonb_build_object('attached', true);
end;
$$;

create or replace function public.apply_paddle_transaction_lifecycle(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_transaction_id text,
  p_intent_id uuid,
  p_account_id uuid,
  p_product_id text,
  p_provider_status text,
  p_transition text,
  p_payment_error_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.purchase_intents%rowtype;
  v_latest public.paddle_transaction_events%rowtype;
  v_target_status public.purchase_intent_status;
  v_rank integer := 0;
  v_effective_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_state_changed boolean := false;
begin
  if p_event_id is null or char_length(p_event_id) < 4 or char_length(p_event_id) > 128 then
    raise exception 'event_id is invalid' using errcode = '22023';
  end if;
  if p_event_type not in (
    'transaction.updated',
    'transaction.ready',
    'transaction.paid',
    'transaction.payment_failed',
    'transaction.past_due',
    'transaction.canceled'
  ) then
    raise exception 'transaction event type is unsupported' using errcode = '22023';
  end if;
  if p_transaction_id !~ '^txn_[a-z0-9]{26}$' then
    raise exception 'transaction_id is invalid' using errcode = '22023';
  end if;
  if p_provider_status is null or char_length(p_provider_status) > 64 then
    raise exception 'provider status is invalid' using errcode = '22023';
  end if;
  if p_transition is not null and p_transition not in ('pending', 'failed', 'cancelled') then
    raise exception 'transaction transition is invalid' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload is invalid' using errcode = '22023';
  end if;

  v_rank := case p_transition
    when 'pending' then 10
    when 'failed' then 20
    when 'cancelled' then 30
    else 0
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id, 0));

  select * into v_intent
  from public.purchase_intents
  where id = p_intent_id
    and account_id = p_account_id
    and product_id = p_product_id
  for update;

  if not found then
    raise exception 'trusted purchase intent not found' using errcode = 'P0002';
  end if;
  if v_intent.provider_checkout_id is not null
     and v_intent.provider_checkout_id <> p_transaction_id then
    raise exception 'transaction does not match attached checkout' using errcode = '42501';
  end if;

  insert into public.paddle_transaction_events (
    purchase_intent_id,
    provider_transaction_id,
    provider_event_id,
    event_type,
    provider_status,
    transition,
    transition_rank,
    payment_error_code,
    payload,
    occurred_at
  ) values (
    v_intent.id,
    p_transaction_id,
    p_event_id,
    p_event_type,
    p_provider_status,
    coalesce(p_transition, 'none'),
    v_rank,
    nullif(p_payment_error_code, ''),
    p_payload,
    v_effective_occurred_at
  ) on conflict (provider_event_id) do nothing;

  if v_intent.status in ('completed', 'cancelled', 'expired') then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', true,
      'intent_id', v_intent.id,
      'intent_status', v_intent.status,
      'reason', 'intent_is_final'
    );
  end if;

  select * into v_latest
  from public.paddle_transaction_events
  where provider_transaction_id = p_transaction_id
  order by occurred_at desc, transition_rank desc, created_at desc
  limit 1;

  if found and v_latest.provider_event_id <> p_event_id and (
    v_latest.occurred_at > v_effective_occurred_at
    or (v_latest.occurred_at = v_effective_occurred_at and v_latest.transition_rank > v_rank)
  ) then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', true,
      'intent_id', v_intent.id,
      'intent_status', v_intent.status,
      'reason', 'newer_transaction_event_exists'
    );
  end if;

  if p_transition is null then
    return jsonb_build_object(
      'handled', true,
      'state_changed', false,
      'stale', false,
      'intent_id', v_intent.id,
      'intent_status', v_intent.status,
      'reason', 'no_intent_transition'
    );
  end if;

  v_target_status := case p_transition
    when 'failed' then 'failed'::public.purchase_intent_status
    when 'cancelled' then 'cancelled'::public.purchase_intent_status
    else 'checkout_created'::public.purchase_intent_status
  end;
  v_state_changed := v_target_status <> v_intent.status;

  update public.purchase_intents
  set status = v_target_status,
      provider_checkout_id = coalesce(provider_checkout_id, p_transaction_id),
      updated_at = now()
  where id = v_intent.id
  returning * into v_intent;

  return jsonb_build_object(
    'handled', true,
    'state_changed', v_state_changed,
    'stale', false,
    'transition', p_transition,
    'intent_id', v_intent.id,
    'intent_status', v_intent.status,
    'payment_error_code', nullif(p_payment_error_code, '')
  );
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
  v_duplicate public.paddle_duplicate_purchases%rowtype;
  v_purchase public.purchases%rowtype;
  v_valid_purchase public.purchases%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_previous_state public.entitlement_state;
  v_event_key text;
  v_effective_occurred_at timestamptz := coalesce(p_occurred_at, now());
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
  perform pg_advisory_xact_lock(hashtextextended(p_product_id || ':' || p_account_id::text, 0));

  select * into v_existing_purchase
  from public.purchases
  where provider_transaction_id = p_transaction_id
  limit 1;

  if found then
    return jsonb_build_object(
      'purchase_id', v_existing_purchase.id,
      'entitlement_id', (
        select id from public.entitlements
        where account_id = p_account_id and product_id = p_product_id
        limit 1
      ),
      'duplicate_transaction', true,
      'duplicate_purchase', false,
      'refund_required', false
    );
  end if;

  select * into v_duplicate
  from public.paddle_duplicate_purchases
  where provider_transaction_id = p_transaction_id
  limit 1;

  if found then
    return jsonb_build_object(
      'duplicate_purchase_id', v_duplicate.id,
      'original_purchase_id', v_duplicate.original_purchase_id,
      'entitlement_id', (
        select id from public.entitlements
        where account_id = p_account_id and product_id = p_product_id
        limit 1
      ),
      'duplicate_transaction', true,
      'duplicate_purchase', true,
      'refund_required', v_duplicate.status not in ('refund_pending', 'refunded', 'charged_back'),
      'duplicate_status', v_duplicate.status
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

  select * into v_entitlement
  from public.entitlements
  where account_id = p_account_id
    and product_id = p_product_id
  for update;

  if found and v_entitlement.state in ('active', 'suspended', 'suspended_dispute') then
    select * into v_valid_purchase
    from public.purchases
    where id = v_entitlement.purchase_id
      and status in ('completed', 'disputed')
    for update;

    if found then
      insert into public.paddle_duplicate_purchases (
        original_purchase_id,
        purchase_intent_id,
        account_id,
        product_id,
        provider_transaction_id,
        provider_event_id,
        provider_customer_id,
        provider_price_id,
        price_tier,
        subtotal_cents,
        tax_cents,
        total_cents,
        currency,
        status,
        completed_at,
        payload
      ) values (
        v_valid_purchase.id,
        v_intent.id,
        p_account_id,
        p_product_id,
        p_transaction_id,
        p_event_id,
        p_customer_id,
        p_price_id,
        p_price_tier,
        p_subtotal_cents,
        p_tax_cents,
        p_total_cents,
        p_currency,
        'refund_required',
        v_effective_occurred_at,
        p_payload
      )
      returning * into v_duplicate;

      update public.purchase_intents
      set status = 'completed',
          provider_checkout_id = p_transaction_id,
          updated_at = now()
      where id = v_intent.id;

      insert into public.paddle_transaction_events (
        purchase_intent_id,
        provider_transaction_id,
        provider_event_id,
        event_type,
        provider_status,
        transition,
        transition_rank,
        payload,
        occurred_at
      ) values (
        v_intent.id,
        p_transaction_id,
        p_event_id,
        'transaction.completed',
        'completed',
        'completed',
        50,
        p_payload,
        v_effective_occurred_at
      ) on conflict (provider_event_id) do nothing;

      return jsonb_build_object(
        'duplicate_purchase_id', v_duplicate.id,
        'original_purchase_id', v_valid_purchase.id,
        'entitlement_id', v_entitlement.id,
        'duplicate_transaction', false,
        'duplicate_purchase', true,
        'refund_required', true,
        'duplicate_status', v_duplicate.status
      );
    end if;
  end if;

  if found and v_entitlement.state in ('charged_back', 'revoked', 'account_deleted') then
    raise exception 'account is not eligible for checkout' using errcode = 'P0001';
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
    v_effective_occurred_at,
    p_payload
  )
  returning * into v_purchase;

  if v_entitlement.id is not null then
    v_previous_state := v_entitlement.state;
    update public.entitlements
    set purchase_id = v_purchase.id,
        state = 'active',
        starts_at = v_effective_occurred_at,
        ends_at = null,
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
      v_effective_occurred_at
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
    v_effective_occurred_at
  ) on conflict (event_key) do nothing;

  update public.purchase_intents
  set status = 'completed',
      provider_checkout_id = p_transaction_id,
      updated_at = now()
  where id = p_intent_id;

  insert into public.paddle_transaction_events (
    purchase_intent_id,
    provider_transaction_id,
    provider_event_id,
    event_type,
    provider_status,
    transition,
    transition_rank,
    payload,
    occurred_at
  ) values (
    v_intent.id,
    p_transaction_id,
    p_event_id,
    'transaction.completed',
    'completed',
    'completed',
    50,
    p_payload,
    v_effective_occurred_at
  ) on conflict (provider_event_id) do nothing;

  return jsonb_build_object(
    'purchase_id', v_purchase.id,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_entitlement.state,
    'duplicate_transaction', false,
    'duplicate_purchase', false,
    'refund_required', false
  );
end;
$$;

create or replace function public.record_paddle_duplicate_refund_request(
  p_transaction_id text,
  p_adjustment_id text,
  p_adjustment_status text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicate public.paddle_duplicate_purchases%rowtype;
  v_status text;
begin
  if p_transaction_id !~ '^txn_[a-z0-9]{26}$'
     or p_adjustment_id !~ '^adj_[a-z0-9]{26}$' then
    raise exception 'provider identifiers are invalid' using errcode = '22023';
  end if;
  if p_adjustment_status is null or char_length(p_adjustment_status) > 64 then
    raise exception 'adjustment status is invalid' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload is invalid' using errcode = '22023';
  end if;

  v_status := case
    when p_adjustment_status = 'approved' then 'refunded'
    when p_adjustment_status = 'rejected' then 'refund_rejected'
    else 'refund_pending'
  end;

  update public.paddle_duplicate_purchases
  set status = v_status,
      refund_adjustment_id = p_adjustment_id,
      refund_adjustment_status = p_adjustment_status,
      refund_requested_at = coalesce(refund_requested_at, now()),
      refunded_at = case when p_adjustment_status = 'approved' then now() else refunded_at end,
      adjustment_payload = p_payload,
      updated_at = now()
  where provider_transaction_id = p_transaction_id
  returning * into v_duplicate;

  if not found then
    raise exception 'duplicate purchase not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'duplicate_purchase_id', v_duplicate.id,
    'transaction_id', v_duplicate.provider_transaction_id,
    'status', v_duplicate.status,
    'adjustment_id', v_duplicate.refund_adjustment_id,
    'adjustment_status', v_duplicate.refund_adjustment_status
  );
end;
$$;

create or replace function public.apply_paddle_adjustment_dispatch(
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
  v_duplicate public.paddle_duplicate_purchases%rowtype;
  v_previous_status text;
  v_target_status text;
begin
  select * into v_duplicate
  from public.paddle_duplicate_purchases
  where provider_transaction_id = p_transaction_id
  for update;

  if not found then
    return public.apply_paddle_adjustment_lifecycle(
      p_event_id,
      p_occurred_at,
      p_adjustment_id,
      p_transaction_id,
      p_action,
      p_status,
      p_adjustment_total_cents,
      p_adjustment_type,
      p_reason,
      p_payload
    );
  end if;

  v_previous_status := v_duplicate.status;
  v_target_status := v_duplicate.status;

  if p_action = 'refund' then
    v_target_status := case
      when p_status = 'approved' then 'refunded'
      when p_status = 'rejected' then 'refund_rejected'
      else 'refund_pending'
    end;
  elsif p_action in ('chargeback', 'chargeback_warning') and p_status = 'approved' then
    v_target_status := 'charged_back';
  end if;

  update public.paddle_duplicate_purchases
  set status = v_target_status,
      refund_adjustment_id = case when p_action = 'refund' then p_adjustment_id else refund_adjustment_id end,
      refund_adjustment_status = case when p_action = 'refund' then p_status else refund_adjustment_status end,
      refund_requested_at = case
        when p_action = 'refund' then coalesce(refund_requested_at, coalesce(p_occurred_at, now()))
        else refund_requested_at
      end,
      refunded_at = case
        when (p_action = 'refund' and p_status = 'approved')
          or (p_action in ('chargeback', 'chargeback_warning') and p_status = 'approved')
        then coalesce(p_occurred_at, now())
        else refunded_at
      end,
      adjustment_payload = p_payload,
      updated_at = now()
  where id = v_duplicate.id
  returning * into v_duplicate;

  return jsonb_build_object(
    'handled', true,
    'state_changed', v_previous_status <> v_duplicate.status,
    'duplicate_purchase', true,
    'duplicate_purchase_id', v_duplicate.id,
    'duplicate_status', v_duplicate.status,
    'adjustment_id', p_adjustment_id,
    'transition', p_action,
    'stale', false
  );
end;
$$;

grant usage on schema public to service_role;
grant select, insert, update on public.purchase_intents to service_role;
grant select, insert, update on public.purchases to service_role;
grant select, insert, update on public.entitlements to service_role;
grant select, insert on public.entitlement_events to service_role;
grant select, insert, update on public.paddle_transaction_events to service_role;
grant select, insert, update on public.paddle_duplicate_purchases to service_role;

revoke all on table public.paddle_transaction_events from public, anon, authenticated;
revoke all on table public.paddle_duplicate_purchases from public, anon, authenticated;

revoke all on function public.reserve_paddle_purchase_intent(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.attach_paddle_transaction(uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_paddle_transaction_lifecycle(
  text, text, timestamptz, text, uuid, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_paddle_purchase(
  text, timestamptz, text, text, uuid, uuid, text, text, text, text, integer, integer, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.record_paddle_duplicate_refund_request(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.apply_paddle_adjustment_dispatch(
  text, timestamptz, text, text, text, text, integer, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.reserve_paddle_purchase_intent(uuid, text, timestamptz)
  to service_role;
grant execute on function public.attach_paddle_transaction(uuid, text)
  to service_role;
grant execute on function public.apply_paddle_transaction_lifecycle(
  text, text, timestamptz, text, uuid, uuid, text, text, text, text, jsonb
) to service_role;
grant execute on function public.complete_paddle_purchase(
  text, timestamptz, text, text, uuid, uuid, text, text, text, text, integer, integer, integer, jsonb
) to service_role;
grant execute on function public.record_paddle_duplicate_refund_request(text, text, text, jsonb)
  to service_role;
grant execute on function public.apply_paddle_adjustment_dispatch(
  text, timestamptz, text, text, text, text, integer, text, text, jsonb
) to service_role;

commit;
