-- D2-C Author SOURCE-ONLY candidate. No connected SQL / not a deployment migration.
-- A31/A34: preserve original effective service_role grants, no broad profile
-- UPDATE permission. Actual PostgreSQL reviewed before any release decision.
begin;
create schema if not exists review_commerce_fence;
revoke all on schema review_commerce_fence from public, anon, authenticated, service_role;
create or replace function review_commerce_fence.require_active_profile(p_account_id uuid)
returns void
language plpgsql security definer set search_path='' as $d2c$
declare v_status public.account_status;
begin
  -- Definer only performs a narrowly bound status read and lock. This is
  -- FOR SHARE, conflicting with profile status updates and keeping account
  -- deletion finalization from racing an active purchase write.
  select p.status into v_status from public.profiles p
  where p.account_id=p_account_id for share;
  if not found or v_status<>'active' then
    raise exception 'd2c: Library Pass payment requires active account'
      using errcode='42501';
  end if;
end;
$d2c$;
revoke all on function review_commerce_fence.require_active_profile(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema review_commerce_fence to service_role;
grant execute on function review_commerce_fence.require_active_profile(uuid)
  to service_role;
-- Function owner is the migration/table owner in this synthetic review.
-- Do not install without verified restricted custody and source grants.
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
  v_audit_rows integer;
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

  -- Lock the profile through a tightly scoped private definer before ANY
  -- new financial/entitlement writes; this serializes with account deletion.
  perform review_commerce_fence.require_active_profile(p_account_id);

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
  get diagnostics v_audit_rows = ROW_COUNT;
  -- New purchase ID means a true webhook replay has already returned above.
  -- Any existing event key at this point would hide the new financial effect.
  if v_audit_rows <> 1 then
    raise exception 'd2c: payment event key collision; no effect committed'
      using errcode = '42501';
  end if;

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
  v_audit_rows integer;
  v_saved_event public.entitlement_events%rowtype;
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
      get diagnostics v_audit_rows = ROW_COUNT;
      if v_audit_rows = 0 then
        -- Exact duplicate reconciliation may use the same provider transaction
        -- key; reject only a foreign/wrong-effect event rather than silently
        -- accepting a corrupt audit trail.
        select * into v_saved_event from public.entitlement_events
        where event_key = v_event_key;
        if not found
           or v_saved_event.entitlement_id is distinct from v_entitlement.id
           or v_saved_event.account_id is distinct from v_purchase.account_id
           or v_saved_event.product_id is distinct from v_purchase.product_id
           or v_saved_event.to_state is distinct from 'refunded'::public.entitlement_state
           or v_saved_event.actor_type is distinct from 'commerce_reconciliation'
           or v_saved_event.actor_id is distinct from p_transaction_id
        then
          raise exception 'd2c: reconciliation event key effect mismatch'
            using errcode = '42501';
        end if;
      end if;
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
      get diagnostics v_audit_rows = ROW_COUNT;
      if v_audit_rows = 0 then
        -- Exact duplicate reconciliation may use the same provider transaction
        -- key; reject only a foreign/wrong-effect event rather than silently
        -- accepting a corrupt audit trail.
        select * into v_saved_event from public.entitlement_events
        where event_key = v_event_key;
        if not found
           or v_saved_event.entitlement_id is distinct from v_entitlement.id
           or v_saved_event.account_id is distinct from v_purchase.account_id
           or v_saved_event.product_id is distinct from v_purchase.product_id
           or v_saved_event.to_state is distinct from 'revoked'::public.entitlement_state
           or v_saved_event.actor_type is distinct from 'commerce_reconciliation'
           or v_saved_event.actor_id is distinct from p_transaction_id
        then
          raise exception 'd2c: reconciliation event key effect mismatch'
            using errcode = '42501';
        end if;
      end if;
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
commit;
