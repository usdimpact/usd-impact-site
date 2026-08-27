begin;

create table if not exists public.commerce_reconciliations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_transaction_id text not null,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  purchase_intent_id uuid not null references public.purchase_intents(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null,
  provider_price_id text not null,
  price_tier text not null,
  expected_subtotal_cents integer not null,
  currency text not null,
  provider_status text not null default 'paid',
  disposition text not null default 'tracking',
  attempt_count integer not null default 0,
  last_checked_at timestamptz,
  next_reconcile_at timestamptz,
  last_error_code text,
  last_evidence_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id),
  unique (purchase_id),
  constraint commerce_reconciliations_provider
    check (provider ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint commerce_reconciliations_transaction
    check (char_length(provider_transaction_id) between 1 and 255),
  constraint commerce_reconciliations_price_id
    check (char_length(provider_price_id) between 1 and 255),
  constraint commerce_reconciliations_price_tier
    check (price_tier in ('launch', 'standard')),
  constraint commerce_reconciliations_amount
    check (expected_subtotal_cents > 0),
  constraint commerce_reconciliations_currency
    check (currency ~ '^[A-Z]{3}$'),
  constraint commerce_reconciliations_status
    check (provider_status in ('pending', 'failed', 'paid', 'refunded', 'partial_refund', 'fraudulent')),
  constraint commerce_reconciliations_disposition
    check (disposition in ('tracking', 'review', 'refunded', 'revoked')),
  constraint commerce_reconciliations_attempt_count
    check (attempt_count >= 0),
  constraint commerce_reconciliations_metadata
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists commerce_reconciliations_due_idx
  on public.commerce_reconciliations(next_reconcile_at, id)
  where disposition = 'tracking' and next_reconcile_at is not null;
create index if not exists commerce_reconciliations_account_idx
  on public.commerce_reconciliations(account_id, created_at desc);

alter table public.commerce_reconciliations enable row level security;
revoke all on public.commerce_reconciliations from anon, authenticated;
grant select, insert, update on public.commerce_reconciliations to service_role;

drop trigger if exists commerce_reconciliations_set_updated_at on public.commerce_reconciliations;
create trigger commerce_reconciliations_set_updated_at
before update on public.commerce_reconciliations
for each row execute function public.set_updated_at();

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
      'version', 3,
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

create or replace function public.attach_commerce_checkout(
  p_intent_id uuid,
  p_provider text,
  p_checkout_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_intent public.purchase_intents%rowtype;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'provider is invalid' using errcode = '22023';
  end if;
  if p_checkout_id is null or char_length(p_checkout_id) < 1 or char_length(p_checkout_id) > 255 then
    raise exception 'checkout_id is invalid' using errcode = '22023';
  end if;

  select * into v_intent
  from public.purchase_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'purchase intent not found' using errcode = 'P0002';
  end if;
  if v_intent.status not in ('pending', 'checkout_created', 'failed') then
    raise exception 'purchase intent cannot attach a checkout' using errcode = 'P0001';
  end if;

  if v_intent.provider_checkout_id is not null
     and v_intent.provider_checkout_id <> p_checkout_id then
    return to_jsonb(v_intent) || jsonb_build_object('attached', false);
  end if;

  update public.purchase_intents
  set status = 'checkout_created',
      provider_checkout_id = p_checkout_id,
      updated_at = now()
  where id = p_intent_id
  returning * into v_intent;

  return to_jsonb(v_intent) || jsonb_build_object('attached', true, 'provider', p_provider);
end;
$$;

create or replace function public.begin_commerce_webhook_receipt(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.webhook_receipts%rowtype;
  v_should_process boolean := true;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'provider is invalid' using errcode = '22023';
  end if;
  if p_provider_event_id is null or char_length(p_provider_event_id) < 1 or char_length(p_provider_event_id) > 255 then
    raise exception 'provider_event_id is invalid' using errcode = '22023';
  end if;
  if p_event_type is null or char_length(p_event_type) < 1 or char_length(p_event_type) > 128 then
    raise exception 'event_type is invalid' using errcode = '22023';
  end if;
  if p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'payload_sha256 is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_event_id, 0));

  select * into v_receipt
  from public.webhook_receipts
  where provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_receipt.payload_sha256 <> p_payload_sha256 then
      raise exception 'webhook replay payload hash mismatch' using errcode = '42501';
    end if;
    if v_receipt.status in ('processed', 'ignored') then
      v_should_process := false;
    else
      update public.webhook_receipts
      set status = 'received',
          event_type = p_event_type,
          attempt_count = attempt_count + 1,
          last_error = null
      where id = v_receipt.id
      returning * into v_receipt;
    end if;
  else
    insert into public.webhook_receipts (
      provider,
      provider_event_id,
      event_type,
      payload_sha256,
      status
    ) values (
      p_provider,
      p_provider_event_id,
      p_event_type,
      p_payload_sha256,
      'received'
    ) returning * into v_receipt;
  end if;

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'status', v_receipt.status,
    'attempt_count', v_receipt.attempt_count,
    'should_process', v_should_process
  );
end;
$$;

create or replace function public.finish_commerce_webhook_receipt(
  p_receipt_id uuid,
  p_status text,
  p_last_error text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.webhook_receipts%rowtype;
begin
  if p_receipt_id is null then
    raise exception 'receipt_id is required' using errcode = '22023';
  end if;
  if p_status not in ('processed', 'failed', 'ignored') then
    raise exception 'receipt status is invalid' using errcode = '22023';
  end if;

  update public.webhook_receipts
  set status = p_status,
      processed_at = case when p_status in ('processed', 'ignored') then now() else processed_at end,
      last_error = nullif(left(coalesce(p_last_error, ''), 500), '')
  where id = p_receipt_id
  returning * into v_receipt;

  if not found then
    raise exception 'webhook receipt not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'status', v_receipt.status,
    'attempt_count', v_receipt.attempt_count
  );
end;
$$;

create or replace function public.complete_commerce_purchase(
  p_provider text,
  p_event_id text,
  p_occurred_at timestamptz,
  p_transaction_id text,
  p_customer_id text,
  p_intent_id uuid,
  p_account_id uuid,
  p_product_id text,
  p_provider_price_id text,
  p_currency text,
  p_subtotal_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_metadata jsonb,
  p_next_reconcile_at timestamptz
)
returns jsonb
language plpgsql
security invoker
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
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'provider is invalid' using errcode = '22023';
  end if;
  if p_event_id is null or char_length(p_event_id) < 1 or char_length(p_event_id) > 255
     or p_transaction_id is null or char_length(p_transaction_id) < 1 or char_length(p_transaction_id) > 255 then
    raise exception 'provider identifiers are invalid' using errcode = '22023';
  end if;
  if p_product_id <> 'read-the-dollar-first-guided-interactive-edition' then
    raise exception 'product does not match paid access product' using errcode = '42501';
  end if;
  if p_provider_price_id is null or char_length(p_provider_price_id) < 1 or char_length(p_provider_price_id) > 255 then
    raise exception 'provider_price_id is invalid' using errcode = '22023';
  end if;
  if p_currency !~ '^[A-Z]{3}$'
     or p_subtotal_cents <= 0
     or p_tax_cents < 0
     or p_total_cents < p_subtotal_cents then
    raise exception 'commercial totals are invalid' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'metadata is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));

  select * into v_existing_purchase
  from public.purchases
  where provider_transaction_id = p_transaction_id
  limit 1;

  if found then
    if v_existing_purchase.provider <> p_provider
       or v_existing_purchase.account_id <> p_account_id
       or v_existing_purchase.product_id <> p_product_id
       or v_existing_purchase.purchase_intent_id <> p_intent_id then
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
     or v_intent.currency <> p_currency
     or v_intent.amount_cents <> p_subtotal_cents then
    raise exception 'transaction does not match trusted purchase intent' using errcode = '42501';
  end if;
  if v_intent.status not in ('pending', 'checkout_created', 'failed') then
    raise exception 'purchase intent is not completable' using errcode = 'P0001';
  end if;

  select * into v_entitlement
  from public.entitlements
  where account_id = p_account_id
    and product_id = p_product_id
  for update;

  if found and v_entitlement.state in ('active', 'suspended', 'suspended_dispute') then
    raise exception 'account already has a non-terminal entitlement' using errcode = 'P0001';
  end if;
  if found and v_entitlement.state in ('charged_back', 'revoked', 'account_deleted') then
    raise exception 'terminal entitlement cannot be restored by purchase completion' using errcode = 'P0001';
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
    p_provider,
    nullif(p_customer_id, ''),
    p_transaction_id,
    p_provider_price_id,
    p_event_id,
    'completed',
    p_subtotal_cents,
    p_subtotal_cents,
    p_tax_cents,
    p_total_cents,
    p_currency,
    v_intent.price_tier,
    v_intent.offer_terms,
    coalesce(p_occurred_at, now()),
    p_metadata
  ) returning * into v_purchase;

  if v_entitlement.id is not null then
    v_previous_state := v_entitlement.state;
    update public.entitlements
    set purchase_id = v_purchase.id,
        state = 'active',
        starts_at = coalesce(p_occurred_at, now()),
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
      coalesce(p_occurred_at, now())
    ) returning * into v_entitlement;
  end if;

  v_event_key := 'commerce:' || p_provider || ':' || p_transaction_id || ':payment.completed';
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
    'active',
    'verified provider payment completed',
    'commerce_webhook',
    p_transaction_id,
    p_event_id,
    jsonb_build_object(
      'provider', p_provider,
      'purchaseId', v_purchase.id,
      'priceTier', v_intent.price_tier,
      'subtotalCents', p_subtotal_cents,
      'taxCents', p_tax_cents,
      'totalCents', p_total_cents,
      'currency', p_currency
    ),
    coalesce(p_occurred_at, now())
  ) on conflict (event_key) do nothing;

  update public.purchase_intents
  set status = 'completed',
      updated_at = now()
  where id = p_intent_id;

  insert into public.commerce_reconciliations (
    provider,
    provider_transaction_id,
    purchase_id,
    purchase_intent_id,
    account_id,
    product_id,
    provider_price_id,
    price_tier,
    expected_subtotal_cents,
    currency,
    provider_status,
    disposition,
    attempt_count,
    last_checked_at,
    next_reconcile_at,
    last_evidence_id,
    metadata
  ) values (
    p_provider,
    p_transaction_id,
    v_purchase.id,
    p_intent_id,
    p_account_id,
    p_product_id,
    p_provider_price_id,
    v_intent.price_tier,
    p_subtotal_cents,
    p_currency,
    'paid',
    'tracking',
    0,
    coalesce(p_occurred_at, now()),
    p_next_reconcile_at,
    p_event_id,
    p_metadata
  ) on conflict (provider, provider_transaction_id) do update
    set next_reconcile_at = excluded.next_reconcile_at,
        last_checked_at = excluded.last_checked_at,
        last_evidence_id = excluded.last_evidence_id,
        metadata = public.commerce_reconciliations.metadata || excluded.metadata,
        updated_at = now();

  return jsonb_build_object(
    'purchase_id', v_purchase.id,
    'entitlement_id', v_entitlement.id,
    'entitlement_state', v_entitlement.state,
    'duplicate_transaction', false
  );
end;
$$;

create or replace function public.apply_commerce_reconciliation(
  p_provider text,
  p_transaction_id text,
  p_evidence_id text,
  p_provider_status text,
  p_occurred_at timestamptz,
  p_refunded_amount_cents integer,
  p_metadata jsonb,
  p_next_reconcile_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_reconciliation public.commerce_reconciliations%rowtype;
  v_previous_state public.entitlement_state;
  v_disposition text := 'review';
  v_state_changed boolean := false;
  v_event_key text;
  v_reason text;
  v_next timestamptz := null;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$'
     or p_transaction_id is null or char_length(p_transaction_id) < 1 or char_length(p_transaction_id) > 255
     or p_evidence_id is null or char_length(p_evidence_id) < 1 or char_length(p_evidence_id) > 255 then
    raise exception 'reconciliation identifiers are invalid' using errcode = '22023';
  end if;
  if p_provider_status not in ('pending', 'failed', 'paid', 'refunded', 'partial_refund', 'fraudulent') then
    raise exception 'provider status is outside the reviewed contract' using errcode = '22023';
  end if;
  if p_refunded_amount_cents is not null and p_refunded_amount_cents < 0 then
    raise exception 'refunded amount is invalid' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'metadata is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));

  select * into v_purchase
  from public.purchases
  where provider = p_provider
    and provider_transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'purchase for reconciliation not found' using errcode = 'P0002';
  end if;

  select * into v_entitlement
  from public.entitlements
  where account_id = v_purchase.account_id
    and product_id = v_purchase.product_id
  for update;

  if not found then
    raise exception 'entitlement for reconciliation not found' using errcode = 'P0002';
  end if;

  select * into v_reconciliation
  from public.commerce_reconciliations
  where provider = p_provider
    and provider_transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'reconciliation tracking row not found' using errcode = 'P0002';
  end if;

  v_previous_state := v_entitlement.state;

  if p_provider_status = 'paid' then
    if v_purchase.status = 'completed' and v_entitlement.state = 'active' then
      v_disposition := 'tracking';
      v_next := p_next_reconcile_at;
      v_reason := 'authoritative provider state remains paid';
    else
      v_disposition := 'review';
      v_reason := 'paid provider state conflicts with terminal or non-active local state; no automatic restoration';
    end if;
  elsif p_provider_status = 'refunded' then
    if p_refunded_amount_cents is null or p_refunded_amount_cents <> v_purchase.total_cents then
      v_disposition := 'review';
      v_reason := 'fully refunded provider state has inconsistent refund amount';
    elsif v_purchase.status in ('completed', 'refunded')
      and v_entitlement.state in ('active', 'suspended', 'suspended_dispute', 'refunded') then
      v_disposition := 'refunded';
      v_reason := 'authoritative provider state is fully refunded';
      if v_purchase.status <> 'refunded' then
        update public.purchases
        set status = 'refunded',
            refunded_at = coalesce(p_occurred_at, now()),
            updated_at = now()
        where id = v_purchase.id;
        v_state_changed := true;
      end if;
      if v_entitlement.state <> 'refunded' then
        update public.entitlements
        set state = 'refunded',
            version = version + 1,
            updated_at = now()
        where id = v_entitlement.id
        returning * into v_entitlement;
        v_state_changed := true;
      end if;
      v_event_key := 'commerce:' || p_provider || ':' || p_transaction_id || ':refund.completed';
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
        'refunded',
        'authoritative provider full refund',
        'commerce_reconciliation',
        p_transaction_id,
        p_evidence_id,
        p_metadata,
        coalesce(p_occurred_at, now())
      ) on conflict (event_key) do nothing;
    else
      v_disposition := 'review';
      v_reason := 'refund state conflicts with local terminal state; no guessed transition';
    end if;
  elsif p_provider_status = 'fraudulent' then
    if v_purchase.status = 'completed'
      and v_entitlement.state in ('active', 'suspended', 'suspended_dispute', 'revoked') then
      v_disposition := 'revoked';
      v_reason := 'authoritative provider state is fraudulent';
      if v_entitlement.state <> 'revoked' then
        update public.entitlements
        set state = 'revoked',
            version = version + 1,
            updated_at = now()
        where id = v_entitlement.id
        returning * into v_entitlement;
        v_state_changed := true;
      end if;
      v_event_key := 'commerce:' || p_provider || ':' || p_transaction_id || ':payment.revoked';
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
        'revoked',
        'authoritative provider fraudulent final state',
        'commerce_reconciliation',
        p_transaction_id,
        p_evidence_id,
        p_metadata,
        coalesce(p_occurred_at, now())
      ) on conflict (event_key) do nothing;
    else
      v_disposition := 'review';
      v_reason := 'fraudulent provider state conflicts with local terminal state; no synthetic chargeback transition';
    end if;
  elsif p_provider_status = 'partial_refund' then
    v_disposition := 'review';
    v_reason := 'Library Pass policy supports full refunds only; unexpected partial refund requires review and never changes entitlement automatically';
  else
    v_disposition := 'review';
    v_reason := 'post-purchase non-final provider state requires review and cannot grant or restore access';
  end if;

  update public.commerce_reconciliations
  set provider_status = p_provider_status,
      disposition = v_disposition,
      attempt_count = attempt_count + 1,
      last_checked_at = coalesce(p_occurred_at, now()),
      next_reconcile_at = v_next,
      last_error_code = null,
      last_evidence_id = p_evidence_id,
      metadata = metadata || p_metadata,
      updated_at = now()
  where id = v_reconciliation.id
  returning * into v_reconciliation;

  return jsonb_build_object(
    'purchase_id', v_purchase.id,
    'entitlement_id', v_entitlement.id,
    'provider_status', p_provider_status,
    'disposition', v_disposition,
    'state_changed', v_state_changed,
    'entitlement_state', v_entitlement.state,
    'next_reconcile_at', v_reconciliation.next_reconcile_at,
    'reason', v_reason
  );
end;
$$;

create or replace function public.record_commerce_reconciliation_failure(
  p_provider text,
  p_transaction_id text,
  p_error_code text,
  p_next_reconcile_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reconciliation public.commerce_reconciliations%rowtype;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$'
     or p_transaction_id is null or char_length(p_transaction_id) < 1 or char_length(p_transaction_id) > 255 then
    raise exception 'reconciliation identifiers are invalid' using errcode = '22023';
  end if;
  if p_error_code is null or char_length(p_error_code) < 1 or char_length(p_error_code) > 128 then
    raise exception 'error_code is invalid' using errcode = '22023';
  end if;

  update public.commerce_reconciliations
  set attempt_count = attempt_count + 1,
      last_checked_at = now(),
      next_reconcile_at = p_next_reconcile_at,
      last_error_code = p_error_code,
      updated_at = now()
  where provider = p_provider
    and provider_transaction_id = p_transaction_id
    and disposition = 'tracking'
  returning * into v_reconciliation;

  if not found then
    raise exception 'tracking reconciliation row not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'reconciliation_id', v_reconciliation.id,
    'attempt_count', v_reconciliation.attempt_count,
    'next_reconcile_at', v_reconciliation.next_reconcile_at,
    'last_error_code', v_reconciliation.last_error_code
  );
end;
$$;

grant select on public.profiles to service_role;
grant select on public.product_offers to service_role;
grant select, insert, update on public.purchase_intents to service_role;
grant select, insert, update on public.purchases to service_role;
grant select, insert, update on public.entitlements to service_role;
grant select, insert on public.entitlement_events to service_role;
grant select, insert, update on public.webhook_receipts to service_role;
grant select, insert, update on public.commerce_reconciliations to service_role;

revoke all on function public.reserve_commerce_purchase_intent(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.attach_commerce_checkout(uuid, text, text) from public, anon, authenticated;
revoke all on function public.begin_commerce_webhook_receipt(text, text, text, text) from public, anon, authenticated;
revoke all on function public.finish_commerce_webhook_receipt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_commerce_purchase(text, text, timestamptz, text, text, uuid, uuid, text, text, text, integer, integer, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_commerce_reconciliation(text, text, text, text, timestamptz, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.record_commerce_reconciliation_failure(text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.reserve_commerce_purchase_intent(uuid, text, timestamptz) to service_role;
grant execute on function public.attach_commerce_checkout(uuid, text, text) to service_role;
grant execute on function public.begin_commerce_webhook_receipt(text, text, text, text) to service_role;
grant execute on function public.finish_commerce_webhook_receipt(uuid, text, text) to service_role;
grant execute on function public.complete_commerce_purchase(text, text, timestamptz, text, text, uuid, uuid, text, text, text, integer, integer, integer, jsonb, timestamptz) to service_role;
grant execute on function public.apply_commerce_reconciliation(text, text, text, text, timestamptz, integer, jsonb, timestamptz) to service_role;
grant execute on function public.record_commerce_reconciliation_failure(text, text, text, timestamptz) to service_role;

commit;
