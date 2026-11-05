-- Research P1 integrated security candidate (Draft PR #1164). DRAFT ONLY.
-- Not reviewed for deployment; must not be applied to Development or
-- Production without the owner release decision recorded for Issue #1103.
--
-- Ports (with private schema rename only, logic unchanged unless noted):
--   * #1159 docs/operations/research-ordering-d33/live_transition_profile_lock_review.sql
--     (D33-1/2/3: profile FOR SHARE lock, no paid grant for non-active
--     profiles, account_deleted never reopens)
--   * #1158 docs/operations/research-ordering-d2c-author/lp_payment_audit_fence_review.sql
--     (D2-C: Library Pass purchase/reconciliation requires an active profile,
--     audit-collision checks)
-- New in this candidate:
--   * immutable subscription/entitlement ownership (D37-1, D38-3)
--   * RPC-only custody ledgers: checkout attempts, paid-binding quarantine,
--     deletion billing holds + history, owner-only billing clearances
--   * strict finalizer: local cancellation evidence never clears a hold
--     (supersedes the #1159 finalizer fence, which accepted forgeable rows)
-- Not ported: #1158 guard_o_no_protected_rowtype_review.sql patches the
-- Stage C-Q review overlay guard, which is not part of supabase/migrations.
--
-- No grant to anon/authenticated. No existing grant is widened. SECURITY
-- DEFINER functions use search_path=''. EXECUTE is granted to service_role
-- only where the web server must call the function; the clearance writer is
-- owner-only.

create schema if not exists research_lifecycle_private;
revoke all on schema research_lifecycle_private from public, anon, authenticated, service_role;
-- service_role needs USAGE only to reach the two narrowly scoped definer
-- helpers that the existing invoker RPCs call (profile status read + lock).
grant usage on schema research_lifecycle_private to service_role;

-- ---------------------------------------------------------------------------
-- Part 1. D33 live transition RPC (from #1159).
-- ---------------------------------------------------------------------------
create or replace function research_lifecycle_private.lock_account_profile(p_account uuid)
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
revoke all on function research_lifecycle_private.lock_account_profile(uuid)
 from public,anon,authenticated,service_role;

grant execute on function research_lifecycle_private.lock_account_profile(uuid) to service_role;
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
  v_profile_status := research_lifecycle_private.lock_account_profile(v_account_id);

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

-- ---------------------------------------------------------------------------
-- Part 2. D2-C Library Pass payment/reconciliation fence (from #1158).
-- ---------------------------------------------------------------------------
create or replace function research_lifecycle_private.require_active_profile(p_account_id uuid)
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
revoke all on function research_lifecycle_private.require_active_profile(uuid)
  from public, anon, authenticated, service_role;

grant execute on function research_lifecycle_private.require_active_profile(uuid)
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
  perform research_lifecycle_private.require_active_profile(p_account_id);

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

-- ---------------------------------------------------------------------------
-- Part 3. Immutable ownership of subscription and entitlement rows (D37-1,
-- D38-3). Legacy service_role UPDATE grants remain (no grant change in this
-- migration), but no caller - including service_role and SECURITY DEFINER
-- RPCs - may re-key a row to another account, product or provider identity.
-- No existing function in supabase/migrations performs such a re-key.
-- ---------------------------------------------------------------------------
create or replace function research_lifecycle_private.reject_subscription_rekey()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is distinct from old.account_id
     or new.product_id is distinct from old.product_id
     or new.provider is distinct from old.provider
     or new.provider_subscription_id is distinct from old.provider_subscription_id then
    raise exception using
      errcode = '42501',
      message = 'research p1: subscription ownership and provider identity are immutable';
  end if;
  return new;
end;
$$;

create or replace function research_lifecycle_private.reject_entitlement_rekey()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is distinct from old.account_id
     or new.product_id is distinct from old.product_id then
    raise exception using
      errcode = '42501',
      message = 'research p1: entitlement ownership and product are immutable';
  end if;
  return new;
end;
$$;

revoke all on function research_lifecycle_private.reject_subscription_rekey() from public, anon, authenticated, service_role;
revoke all on function research_lifecycle_private.reject_entitlement_rekey() from public, anon, authenticated, service_role;

drop trigger if exists subscriptions_reject_rekey on public.subscriptions;
create trigger subscriptions_reject_rekey
  before update on public.subscriptions
  for each row execute function research_lifecycle_private.reject_subscription_rekey();

drop trigger if exists entitlements_reject_rekey on public.entitlements;
create trigger entitlements_reject_rekey
  before update on public.entitlements
  for each row execute function research_lifecycle_private.reject_entitlement_rekey();

-- ---------------------------------------------------------------------------
-- Part 4. Durable custody ledgers. RLS on, no policies, no table grants to
-- any API role: rows are written and read only through the SECURITY DEFINER
-- RPCs below. Rows never hold emails, payment details or provider payloads.
-- ---------------------------------------------------------------------------
create table if not exists public.research_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  checkout_key text not null unique,
  billing_interval public.subscription_billing_interval not null,
  status text not null default 'issued',
  provider_checkout_id text unique,
  provider_expires_at timestamptz,
  hold_until timestamptz not null,
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint research_checkout_attempts_status check (status in ('issued', 'attached', 'attach_refused')),
  constraint research_checkout_attempts_key_length check (char_length(checkout_key) between 16 and 128),
  constraint research_checkout_attempts_attached_shape check (
    (status = 'attached') = (provider_checkout_id is not null and attached_at is not null)
  )
);
create index if not exists research_checkout_attempts_account_idx
  on public.research_checkout_attempts(account_id, hold_until);

create table if not exists public.research_paid_binding_quarantine (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_subscription_id text not null,
  claimed_account_id uuid,
  checkout_key text,
  -- Preserve ALL distinct signed claims for a provider subscription. The
  -- first claimed ID/key alone is not authoritative for later replays.
  seen_claimed_account_ids uuid[] not null default '{}'::uuid[],
  seen_checkout_keys text[] not null default '{}'::text[],
  reason_code text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  delivery_count integer not null default 1,
  resolved_at timestamptz,
  resolution_reference text,
  updated_at timestamptz not null default now(),
  constraint research_paid_binding_quarantine_unique unique (provider, provider_subscription_id),
  constraint research_paid_binding_quarantine_reason check (char_length(reason_code) between 1 and 80),
  constraint research_paid_binding_quarantine_ids check (
    char_length(provider) between 1 and 100 and char_length(provider_subscription_id) between 1 and 255
  ),
  constraint research_paid_binding_quarantine_count check (delivery_count > 0)
);
create index if not exists research_paid_binding_quarantine_account_idx
  on public.research_paid_binding_quarantine(claimed_account_id) where resolved_at is null;

create table if not exists public.research_billing_clearances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  verification_source text not null,
  verification_reference text not null,
  verified_at timestamptz not null,
  recorded_by text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint research_billing_clearances_source check (
    verification_source in ('provider_api', 'provider_dashboard', 'provider_support')
  ),
  constraint research_billing_clearances_reference check (char_length(verification_reference) between 8 and 200),
  constraint research_billing_clearances_recorded_by check (char_length(recorded_by) between 2 and 100)
);
create index if not exists research_billing_clearances_account_idx
  on public.research_billing_clearances(account_id, verified_at desc);

create table if not exists public.research_deletion_billing_holds (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  status text not null default 'open',
  reason_codes text[] not null,
  first_held_at timestamptz not null default clock_timestamp(),
  last_checked_at timestamptz not null default clock_timestamp(),
  check_count integer not null default 1,
  escalation_claimed_at timestamptz,
  escalated_at timestamptz,
  escalation_reference text,
  cleared_at timestamptz,
  constraint research_deletion_billing_holds_status check (status in ('open', 'cleared')),
  constraint research_deletion_billing_holds_count check (check_count > 0)
);

create table if not exists public.research_deletion_billing_hold_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  event_type text not null,
  reason_codes text[] not null default '{}',
  occurred_at timestamptz not null default clock_timestamp(),
  constraint research_deletion_billing_hold_events_type check (
    event_type in ('held', 'rechecked', 'escalation_claimed', 'escalated', 'cleared')
  )
);
create index if not exists research_deletion_billing_hold_events_account_idx
  on public.research_deletion_billing_hold_events(account_id, occurred_at);

do $grants$
declare t text;
begin
  foreach t in array array[
    'research_checkout_attempts', 'research_paid_binding_quarantine', 'research_billing_clearances',
    'research_deletion_billing_holds', 'research_deletion_billing_hold_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end;
$grants$;
revoke all on sequence public.research_deletion_billing_hold_events_id_seq from public, anon, authenticated, service_role;

create or replace function research_lifecycle_private.reject_ledger_rekey()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception using errcode = '42501', message = 'research p1: ledger account binding is immutable';
  end if;
  return new;
end;
$$;
revoke all on function research_lifecycle_private.reject_ledger_rekey() from public, anon, authenticated, service_role;

create or replace function research_lifecycle_private.reject_append_only_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'research p1: ledger history is append-only';
end;
$$;
revoke all on function research_lifecycle_private.reject_append_only_change() from public, anon, authenticated, service_role;

drop trigger if exists research_checkout_attempts_reject_rekey on public.research_checkout_attempts;
create trigger research_checkout_attempts_reject_rekey before update on public.research_checkout_attempts
  for each row execute function research_lifecycle_private.reject_ledger_rekey();
drop trigger if exists research_deletion_billing_holds_reject_rekey on public.research_deletion_billing_holds;
create trigger research_deletion_billing_holds_reject_rekey before update on public.research_deletion_billing_holds
  for each row execute function research_lifecycle_private.reject_ledger_rekey();
drop trigger if exists research_billing_clearances_append_only on public.research_billing_clearances;
create trigger research_billing_clearances_append_only before update or delete on public.research_billing_clearances
  for each row execute function research_lifecycle_private.reject_append_only_change();
drop trigger if exists research_deletion_billing_hold_events_append_only on public.research_deletion_billing_hold_events;
create trigger research_deletion_billing_hold_events_append_only before update or delete on public.research_deletion_billing_hold_events
  for each row execute function research_lifecycle_private.reject_append_only_change();

-- ---------------------------------------------------------------------------
-- Part 5. Billing readiness. Local subscription state - including a local
-- 'cancelled' row or a 'provider_webhook' event row - is NEVER accepted as
-- proof that merchant billing has stopped (D35-3, D36-3). Any Research
-- footprint holds deletion until an owner-recorded clearance, based on
-- authoritative external verification, postdates every footprint change.
-- ---------------------------------------------------------------------------
create or replace function research_lifecycle_private.billing_hold_reasons(p_account_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reasons text[] := '{}';
  v_latest timestamptz;
  v_cleared timestamptz;
begin
  select max(s.updated_at) into v_latest
  from public.subscriptions s
  where s.account_id = p_account_id and s.product_id = 'research-membership';
  if v_latest is not null then v_reasons := pg_catalog.array_append(v_reasons, 'research_subscription_present'); end if;

  select greatest(v_latest, max(e.updated_at)) into v_latest
  from public.entitlements e
  where e.account_id = p_account_id and e.product_id = 'research-membership' and e.state <> 'account_deleted';
  if exists (
    select 1 from public.entitlements e
    where e.account_id = p_account_id and e.product_id = 'research-membership' and e.state <> 'account_deleted'
  ) then v_reasons := pg_catalog.array_append(v_reasons, 'research_entitlement_present'); end if;

  -- Checkout issuance is a durable financial footprint even AFTER its
  -- exposure window expires. A timeout does not prove that the provider
  -- declined a purchase, stopped retrying, or never created a charge.
  -- Require owner-verified provider clearance observed after the attempt.
  if exists (
    select 1 from public.research_checkout_attempts a
    where a.account_id = p_account_id
  ) then
    v_reasons := pg_catalog.array_append(v_reasons, 'research_checkout_issued');
    select greatest(v_latest, max(a.updated_at), max(a.created_at)) into v_latest
    from public.research_checkout_attempts a where a.account_id = p_account_id;
  end if;
  if exists (
    select 1 from public.research_checkout_attempts a
    where a.account_id = p_account_id and a.hold_until > pg_catalog.clock_timestamp()
  ) then
    v_reasons := pg_catalog.array_append(v_reasons, 'research_checkout_window_open');
  end if;

  -- A signed paid refusal may claim the WRONG or NO account but carry the
  -- canonical DB-issued checkout key. Billing must hold the checkout owner
  -- as well as the claimed account until the conflict is reconciled.
  if exists (
    select 1 from public.research_paid_binding_quarantine q
    where q.resolved_at is null and (
      q.claimed_account_id = p_account_id
      or p_account_id = any(q.seen_claimed_account_ids)
      or exists (
        select 1 from public.research_checkout_attempts a
        where a.account_id = p_account_id
          and (a.checkout_key = q.checkout_key
               or a.checkout_key = any(q.seen_checkout_keys))
      )
    )
  ) then
    v_reasons := pg_catalog.array_append(v_reasons, 'research_paid_binding_quarantined');
    select greatest(v_latest, max(q.updated_at)) into v_latest
    from public.research_paid_binding_quarantine q
    where q.claimed_account_id = p_account_id
      or p_account_id = any(q.seen_claimed_account_ids)
      or exists (
        select 1 from public.research_checkout_attempts a
        where a.account_id = p_account_id
          and (a.checkout_key = q.checkout_key
               or a.checkout_key = any(q.seen_checkout_keys))
      );
  end if;

  if cardinality(v_reasons) = 0 then
    return v_reasons;
  end if;

  -- An open checkout window and an unresolved quarantine can never be cleared
  -- by a clearance record: they mean a provider charge may still be created.
  if 'research_checkout_window_open' = any(v_reasons)
     or 'research_paid_binding_quarantined' = any(v_reasons) then
    return v_reasons;
  end if;

  -- An operator entering old proof today must not turn its recorded_at into
  -- a fictitious fresh provider observation. Only verified_at is evidence.
  select max(c.verified_at) into v_cleared
  from public.research_billing_clearances c
  where c.account_id = p_account_id;
  if v_cleared is not null and v_cleared > v_latest then
    return '{}';
  end if;
  return v_reasons;
end;
$$;
revoke all on function research_lifecycle_private.billing_hold_reasons(uuid) from public, anon, authenticated, service_role;

-- Pre-Auth readiness RPC for the web finalizer (called BEFORE any Auth
-- deletion). Records/refreshes a durable hold, keeps reason history and hands
-- out at most one escalation claim per hold (re-claimable after one hour if
-- the claimant never confirmed).
create or replace function public.check_research_deletion_billing_readiness(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
  v_reasons text[];
  v_hold public.research_deletion_billing_holds;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_escalate boolean := false;
begin
  if p_account_id is null then
    raise exception using errcode = '22023', message = 'account id is required';
  end if;
  select p.status into v_status from public.profiles p where p.account_id = p_account_id for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'account profile was not found';
  end if;

  v_reasons := research_lifecycle_private.billing_hold_reasons(p_account_id);

  if cardinality(v_reasons) = 0 then
    update public.research_deletion_billing_holds h
    set status = 'cleared', cleared_at = v_now, last_checked_at = v_now, check_count = h.check_count + 1
    where h.account_id = p_account_id and h.status = 'open';
    if found then
      insert into public.research_deletion_billing_hold_events(account_id, event_type, reason_codes, occurred_at)
      values (p_account_id, 'cleared', '{}', v_now);
    end if;
    return jsonb_build_object('clear', true, 'reasons', '[]'::jsonb, 'escalate', false);
  end if;

  insert into public.research_deletion_billing_holds as h (account_id, status, reason_codes, first_held_at, last_checked_at)
  values (p_account_id, 'open', v_reasons, v_now, v_now)
  on conflict (account_id) do update
    set status = 'open',
        reason_codes = excluded.reason_codes,
        last_checked_at = v_now,
        check_count = h.check_count + 1,
        cleared_at = null,
        first_held_at = case when h.status = 'cleared' then v_now else h.first_held_at end,
        escalated_at = case when h.status = 'cleared' then null else h.escalated_at end,
        escalation_claimed_at = case when h.status = 'cleared' then null else h.escalation_claimed_at end,
        escalation_reference = case when h.status = 'cleared' then null else h.escalation_reference end
  returning h.* into v_hold;

  insert into public.research_deletion_billing_hold_events(account_id, event_type, reason_codes, occurred_at)
  values (p_account_id, case when v_hold.check_count = 1 then 'held' else 'rechecked' end, v_reasons, v_now);

  if v_hold.escalated_at is null
     and (v_hold.escalation_claimed_at is null or v_hold.escalation_claimed_at < v_now - interval '1 hour') then
    update public.research_deletion_billing_holds h
    set escalation_claimed_at = v_now
    where h.account_id = p_account_id
    returning h.* into v_hold;
    insert into public.research_deletion_billing_hold_events(account_id, event_type, reason_codes, occurred_at)
    values (p_account_id, 'escalation_claimed', v_reasons, v_now);
    v_escalate := true;
  end if;

  return jsonb_build_object(
    'clear', false,
    'reasons', to_jsonb(v_reasons),
    'escalate', v_escalate,
    'first_held_at', v_hold.first_held_at,
    'check_count', v_hold.check_count
  );
end;
$$;
revoke all on function public.check_research_deletion_billing_readiness(uuid) from public, anon, authenticated;
grant execute on function public.check_research_deletion_billing_readiness(uuid) to service_role;

create or replace function public.mark_research_deletion_hold_escalated(p_account_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reference is null or p_reference !~ '^ui-[0-9a-f]{16}$' then
    raise exception using errcode = '22023', message = 'escalation reference must be an opaque ui- reference';
  end if;
  update public.research_deletion_billing_holds h
  set escalated_at = pg_catalog.clock_timestamp(), escalation_reference = p_reference
  where h.account_id = p_account_id and h.status = 'open' and h.escalated_at is null
    and h.escalation_claimed_at is not null;
  if not found then
    return false;
  end if;
  insert into public.research_deletion_billing_hold_events(account_id, event_type)
  values (p_account_id, 'escalated');
  return true;
end;
$$;
revoke all on function public.mark_research_deletion_hold_escalated(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_research_deletion_hold_escalated(uuid, text) to service_role;

-- OWNER-ONLY clearance writer. Deliberately NOT executable by service_role or
-- any API role: a web/server compromise must not be able to manufacture a
-- billing clearance. Who may run it and which external evidence suffices is
-- an owner/provider decision (see release checklist).
create or replace function public.record_research_billing_clearance(
  p_account_id uuid,
  p_verification_source text,
  p_verification_reference text,
  p_verified_at timestamptz,
  p_recorded_by text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_verified_at is null or p_verified_at > pg_catalog.clock_timestamp() then
    raise exception using errcode = '22023', message = 'verification time is required and cannot be in the future';
  end if;
  if not exists (select 1 from public.profiles p where p.account_id = p_account_id) then
    raise exception using errcode = 'P0002', message = 'account profile was not found';
  end if;
  insert into public.research_billing_clearances(account_id, verification_source, verification_reference, verified_at, recorded_by)
  values (p_account_id, p_verification_source, p_verification_reference, p_verified_at, p_recorded_by)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_research_billing_clearance(uuid, text, text, timestamptz, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 6. Checkout custody. A DB-issued attempt is created under a profile
-- FOR SHARE lock before the merchant call, and the merchant checkout id must
-- be attached (again under the lock, profile still active) before any URL is
-- returned to the browser. Attempts keep deletion on hold for 72 hours after
-- the merchant checkout expiry (late-webhook allowance; provider retry
-- behaviour is UNVERIFIED).
-- ---------------------------------------------------------------------------
create or replace function public.create_research_checkout_attempt(
  p_account_id uuid,
  p_checkout_key text,
  p_billing_interval public.subscription_billing_interval
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
  v_deletion timestamptz;
  v_deleted timestamptz;
  v_attempt public.research_checkout_attempts;
begin
  if p_account_id is null or p_checkout_key is null or p_billing_interval is null then
    raise exception using errcode = '22023', message = 'research checkout attempt input is incomplete';
  end if;
  select p.status, p.deletion_requested_at, p.deleted_at into v_status, v_deletion, v_deleted
  from public.profiles p where p.account_id = p_account_id for share;
  if not found or v_status <> 'active' or v_deletion is not null or v_deleted is not null then
    raise exception using errcode = '42501', message = 'research p1: checkout requires an active account';
  end if;

  select a.* into v_attempt from public.research_checkout_attempts a where a.checkout_key = p_checkout_key for update;
  if found then
    if v_attempt.account_id <> p_account_id or v_attempt.status <> 'issued'
       or v_attempt.billing_interval <> p_billing_interval then
      raise exception using errcode = '23505', message = 'research p1: checkout key already used';
    end if;
    return v_attempt.id;
  end if;

  insert into public.research_checkout_attempts(account_id, checkout_key, billing_interval, status, hold_until)
  values (p_account_id, p_checkout_key, p_billing_interval, 'issued', pg_catalog.clock_timestamp() + interval '1 hour' + interval '72 hours')
  returning id into v_attempt.id;
  return v_attempt.id;
end;
$$;
revoke all on function public.create_research_checkout_attempt(uuid, text, public.subscription_billing_interval) from public, anon, authenticated;
grant execute on function public.create_research_checkout_attempt(uuid, text, public.subscription_billing_interval) to service_role;

create or replace function public.attach_research_checkout_attempt(
  p_attempt_id uuid,
  p_account_id uuid,
  p_provider_checkout_id text,
  p_provider_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
  v_deletion timestamptz;
  v_attempt public.research_checkout_attempts;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_provider_checkout_id is null or char_length(p_provider_checkout_id) not between 1 and 255
     or p_provider_expires_at is null then
    raise exception using errcode = '22023', message = 'research checkout attachment input is incomplete';
  end if;
  select a.* into v_attempt from public.research_checkout_attempts a
  where a.id = p_attempt_id and a.account_id = p_account_id for update;
  if not found or v_attempt.status <> 'issued' or v_attempt.created_at < v_now - interval '15 minutes' then
    raise exception using errcode = '42501', message = 'research p1: checkout attempt is not attachable';
  end if;

  select p.status, p.deletion_requested_at into v_status, v_deletion
  from public.profiles p where p.account_id = p_account_id for share;
  if not found or v_status <> 'active' or v_deletion is not null then
    -- Keep the attempt (and its deletion hold window): the merchant checkout
    -- exists even though no URL will be returned.
    update public.research_checkout_attempts
    set status = 'attach_refused', updated_at = v_now,
        hold_until = greatest(hold_until, p_provider_expires_at + interval '72 hours')
    where id = v_attempt.id;
    return false;
  end if;

  update public.research_checkout_attempts
  set status = 'attached',
      provider_checkout_id = p_provider_checkout_id,
      provider_expires_at = p_provider_expires_at,
      attached_at = v_now,
      updated_at = v_now,
      hold_until = greatest(hold_until, p_provider_expires_at + interval '72 hours')
  where id = v_attempt.id;
  return true;
end;
$$;
revoke all on function public.attach_research_checkout_attempt(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.attach_research_checkout_attempt(uuid, uuid, text, timestamptz) to service_role;

-- Paid-but-unbound quarantine: written only after the web layer has verified
-- the merchant webhook signature and the binding RPC refused it. Idempotent
-- per provider subscription; repeated deliveries only increase the counter.
create or replace function public.record_research_paid_binding_refusal(
  p_provider text,
  p_provider_subscription_id text,
  p_claimed_account_id uuid,
  p_checkout_key text,
  p_reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_provider is null or p_provider_subscription_id is null or p_reason_code is null then
    raise exception using errcode = '22023', message = 'research paid binding refusal input is incomplete';
  end if;
  insert into public.research_paid_binding_quarantine as q
    (provider, provider_subscription_id, claimed_account_id, checkout_key, reason_code)
  values (p_provider, p_provider_subscription_id, p_claimed_account_id, p_checkout_key, p_reason_code)
  on conflict (provider, provider_subscription_id) do update
    set last_seen_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp(),
        delivery_count = q.delivery_count + 1,
        claimed_account_id = coalesce(q.claimed_account_id, excluded.claimed_account_id),
        checkout_key = coalesce(q.checkout_key, excluded.checkout_key)
  returning q.id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_research_paid_binding_refusal(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_research_paid_binding_refusal(text, text, uuid, text, text) to service_role;


-- ---------------------------------------------------------------------------
-- Part 7. Strict account deletion finalizer (supersedes the #1159 fence).
-- Body identical to 20260821195116 except the readiness check below.
-- ---------------------------------------------------------------------------
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

  -- Research P1: billing-safe finalization. Any Research footprint (any
  -- subscription state, a non-deleted Research entitlement, an open checkout
  -- window or an unresolved paid-binding quarantine) blocks finalization unless
  -- an owner-recorded external clearance postdates every footprint change.
  -- Local 'cancelled' rows and 'provider_webhook' events are never accepted.
  if cardinality(research_lifecycle_private.billing_hold_reasons(profile_row.account_id)) > 0 then
    raise exception using
      errcode = '55000',
      message = 'research p1: Research billing is not externally verified as stopped; deletion is on hold';
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


revoke all on function public.finalize_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_deletion(uuid) to service_role;
-- ---------------------------------------------------------------------------
-- Part 8. Bounded and starvation-resistant account-deletion scan.
--
-- The old REST query always selected the earliest 25 due profiles. Twenty-five
-- older Research billing holds could therefore prevent any later account's
-- deletion request from being visited. Persist one stable (due_at, account_id)
-- round-robin cursor so each invocation advances beyond held profiles even
-- if provider reconciliation remains unresolved. Cursor advances when IDs
-- are handed out; a failed web attempt is retried on a future full rotation.
--
-- This is only fair scheduling: it DOES NOT change readiness, owner-only
-- merchant evidence, Auth deletion, or the SQL finalization restrictions.
-- A daily job with a large backlog still needs monitored privacy deadlines.
-- ---------------------------------------------------------------------------
create table if not exists research_lifecycle_private.deletion_scan_cursor (
  singleton_id integer primary key check (singleton_id = 1),
  last_due_at timestamptz,
  last_account_id uuid,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint deletion_scan_cursor_pair check (
    (last_due_at is null) = (last_account_id is null)
  )
);
alter table research_lifecycle_private.deletion_scan_cursor enable row level security;
revoke all on table research_lifecycle_private.deletion_scan_cursor
  from public, anon, authenticated, service_role;
insert into research_lifecycle_private.deletion_scan_cursor(singleton_id)
values (1) on conflict (singleton_id) do nothing;

create or replace function public.list_due_account_deletions_fair(
  p_limit integer,
  p_due_at timestamptz
)
returns table (
  account_id uuid,
  email text,
  status public.account_status,
  deletion_requested_at timestamptz,
  deletion_due_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $scan$
declare
  v_due_at timestamptz;
  v_last_due_at timestamptz;
  v_last_account_id uuid;
  v_row record;
  v_count integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception using errcode='22023', message='account deletion scan batch must be between 1 and 25';
  end if;
  if p_due_at is null or not pg_catalog.isfinite(p_due_at) then
    raise exception using errcode='22023', message='account deletion scan due time is required';
  end if;
  v_due_at := p_due_at;

  -- The singleton row lock serializes cursor advancement across cron workers.
  -- The query never locks profiles or bypasses eligibility/readiness checks.
  select c.last_due_at, c.last_account_id
    into v_last_due_at, v_last_account_id
    from research_lifecycle_private.deletion_scan_cursor c
    where c.singleton_id=1
    for update;
  if not found then
    raise exception using errcode='55000', message='account deletion scan cursor unavailable';
  end if;

  for v_row in
    select p.account_id, p.email, p.status,
           p.deletion_requested_at, p.deletion_due_at
      from public.profiles p
      where p.status='deletion_pending'::public.account_status
        and p.deletion_due_at is not null
        and p.deletion_due_at <= v_due_at
      order by case
        when v_last_due_at is null then 0
        when (p.deletion_due_at, p.account_id) > (v_last_due_at, v_last_account_id) then 0
        else 1
      end,
      p.deletion_due_at asc,
      p.account_id asc
      limit p_limit
  loop
    account_id := v_row.account_id;
    email := v_row.email;
    status := v_row.status;
    deletion_requested_at := v_row.deletion_requested_at;
    deletion_due_at := v_row.deletion_due_at;
    v_count := v_count + 1;
    return next;
    v_last_due_at := v_row.deletion_due_at;
    v_last_account_id := v_row.account_id;
  end loop;

  if v_count > 0 then
    update research_lifecycle_private.deletion_scan_cursor c
       set last_due_at = v_last_due_at,
           last_account_id = v_last_account_id,
           updated_at = pg_catalog.clock_timestamp()
     where c.singleton_id = 1;
  end if;
end;
$scan$;
revoke all on function public.list_due_account_deletions_fair(integer,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.list_due_account_deletions_fair(integer,timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Part 9. DRAFT two-phase deletion candidate: ONE atomic database finalization,
-- followed by durable, idempotent Auth identity cleanup and only then the email.
--
-- This intentionally DOES NOT change or activate the existing Vercel runtime.
-- External provider cancellation evidence and live role parity remain HOLD.
-- ---------------------------------------------------------------------------
create table if not exists research_lifecycle_private.deletion_auth_cleanup (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  phase text not null default 'auth_pending'
    check (phase in ('auth_pending','auth_confirmed','email_enqueued')),
  original_auth_user_id uuid not null,
  recipient_email text,
  deletion_requested_at timestamptz not null,
  deleted_at timestamptz not null,
  privacy_request_ids uuid[] not null default '{}',
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  auth_confirmed_at timestamptz,
  email_enqueued_at timestamptz,
  next_attempt_at timestamptz not null default pg_catalog.clock_timestamp(),
  lease_id uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  constraint deletion_auth_cleanup_email_state check (
    (phase='email_enqueued' and recipient_email is null)
    or (phase<>'email_enqueued' and recipient_email is not null)
  )
);
alter table research_lifecycle_private.deletion_auth_cleanup enable row level security;
alter table research_lifecycle_private.deletion_auth_cleanup force row level security;
revoke all on table research_lifecycle_private.deletion_auth_cleanup
  from public, anon, authenticated, service_role;
create index if not exists deletion_auth_cleanup_due_idx
  on research_lifecycle_private.deletion_auth_cleanup(next_attempt_at,started_at)
  where phase in ('auth_pending','auth_confirmed');

-- Protect the post-Auth race: the SQL finalizer and verified paid-event
-- quarantine now acquire the same account profile lock. The signed merchant
-- event is still recorded if it arrives AFTER DB finalization; this never
-- reactivates the deleted account and must be independently reconciled.
create or replace function public.record_research_paid_binding_refusal(
  p_provider text, p_provider_subscription_id text,
  p_claimed_account_id uuid, p_checkout_key text, p_reason_code text
)
returns uuid language plpgsql security definer set search_path='' as $quarantine$
declare v_id uuid;
begin
  if p_provider is null or p_provider_subscription_id is null or p_reason_code is null then
    raise exception using errcode='22023', message='research paid binding refusal input is incomplete';
  end if;
  -- Lock BOTH identities (claimed account and checkout owner) in account
  -- order before writing signed evidence. This synchronizes with Phase A's
  -- profile lock even when custom claimed_account_id was misbound.
  perform 1 from public.profiles p
    where p.account_id = p_claimed_account_id
       or p.account_id in (
         select a.account_id from public.research_checkout_attempts a
         where a.checkout_key = p_checkout_key
       )
    order by p.account_id
    for share;
  -- Never discard signed evidence merely because either profile is absent.
  insert into public.research_paid_binding_quarantine as q
    (provider,provider_subscription_id,claimed_account_id,checkout_key,
     seen_claimed_account_ids,seen_checkout_keys,reason_code)
  values (
    p_provider,p_provider_subscription_id,p_claimed_account_id,p_checkout_key,
    case when p_claimed_account_id is null then '{}'::uuid[] else array[p_claimed_account_id] end,
    case when p_checkout_key is null then '{}'::text[] else array[p_checkout_key] end,
    p_reason_code
  )
  on conflict (provider,provider_subscription_id) do update
    set last_seen_at=pg_catalog.clock_timestamp(),
        updated_at=pg_catalog.clock_timestamp(),
        delivery_count=q.delivery_count+1,
        claimed_account_id=coalesce(q.claimed_account_id,excluded.claimed_account_id),
        checkout_key=coalesce(q.checkout_key,excluded.checkout_key),
        seen_claimed_account_ids=array(
          select distinct t.id from pg_catalog.unnest(
            q.seen_claimed_account_ids || excluded.seen_claimed_account_ids
          ) as t(id) order by t.id
        ),
        seen_checkout_keys=array(
          select distinct t.key from pg_catalog.unnest(
            q.seen_checkout_keys || excluded.seen_checkout_keys
          ) as t(key) order by t.key
        ),
        -- A newly observed signed delivery is never silently treated as
        -- resolved based on an earlier owner's review.
        resolved_at=null,
        resolution_reference=null
  returning q.id into v_id;
  return v_id;
end;
$quarantine$;
revoke all on function public.record_research_paid_binding_refusal(text,text,uuid,text,text)
 from public,anon,authenticated,service_role;
grant execute on function public.record_research_paid_binding_refusal(text,text,uuid,text,text)
 to service_role;

-- Phase A: Acquire the profile row lock once, inspect billing evidence, detach
-- the FK only *inside this transaction*, finalize database state, and commit a
-- recoverable Auth cleanup record together. Any error rolls the WHOLE phase A
-- back, including the auth_user_id change. No Auth Admin request occurs yet.
create or replace function public.finalize_deletion_and_queue_auth_cleanup(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $phase_a$
declare
  v_profile public.profiles;
  v_existing research_lifecycle_private.deletion_auth_cleanup;
  v_done record;
  v_privacy uuid[];
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_account_id is null then
    raise exception using errcode='22023', message='account id is required';
  end if;
  select p.* into v_profile from public.profiles p
    where p.account_id=p_account_id for update;
  if not found then
    raise exception using errcode='P0002', message='account profile not found';
  end if;

  select q.* into v_existing from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account_id for update;
  if found then
    if v_profile.status<>'deleted' then
      raise exception using errcode='55000', message='auth cleanup exists for non-finalized profile';
    end if;
    return pg_catalog.jsonb_build_object('phase',v_existing.phase,'account_id',p_account_id);
  end if;
  if v_profile.status<>'deletion_pending'
     or v_profile.deletion_requested_at is null
     or v_profile.deletion_due_at is null
     or v_profile.deletion_due_at>v_now then
    raise exception using errcode='22023', message='account is not due for deletion';
  end if;
  if v_profile.auth_user_id is not null and v_profile.auth_user_id<>p_account_id then
    raise exception using errcode='23514', message='noncanonical Auth identity link';
  end if;
  if pg_catalog.cardinality(
       research_lifecycle_private.billing_hold_reasons(p_account_id)
     )>0 then
    raise exception using errcode='55000',
      message='Research billing has not been externally verified as stopped';
  end if;

  select coalesce(pg_catalog.array_agg(pr.id),'{}'::uuid[]) into v_privacy
    from public.privacy_requests pr
    where pr.account_id=p_account_id and pr.request_type='deletion'
      and pr.status in ('open','in_progress');

  insert into research_lifecycle_private.deletion_auth_cleanup
    (account_id,phase,original_auth_user_id,recipient_email,
     deletion_requested_at,deleted_at,privacy_request_ids,started_at,next_attempt_at)
  values (p_account_id,'auth_pending',p_account_id,v_profile.email,
          v_profile.deletion_requested_at,v_now,v_privacy,v_now,v_now);

  -- Existing migration helper detaches the FK but does not delete Auth.
  -- Both it and the finalizer run in this same SQL transaction.
  perform public.prepare_account_deletion_auth_removal(p_account_id);
  select f.* into v_done from public.finalize_account_deletion(p_account_id) f;
  if not found or v_done.account_id is null or v_done.deleted_at is null then
    raise exception using errcode='55000', message='database finalization receipt missing';
  end if;

  update research_lifecycle_private.deletion_auth_cleanup q
    set deleted_at=v_done.deleted_at
    where q.account_id=p_account_id;

  -- The legacy finalizer marks privacy requests completed too early. Defer
  -- that status until durable Auth cleanup and email-enqueue acknowledgement.
  update public.privacy_requests pr
    set status='in_progress', completed_at=null,
        decision_reason='Auth cleanup pending verification',
        updated_at=pg_catalog.clock_timestamp()
    where pr.id=any(v_privacy) and pr.request_type='deletion';

  return pg_catalog.jsonb_build_object('phase','auth_pending','account_id',p_account_id);
end;
$phase_a$;
revoke all on function public.finalize_deletion_and_queue_auth_cleanup(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.finalize_deletion_and_queue_auth_cleanup(uuid)
  to service_role;

-- Phase B lease: SKIP LOCKED prevents two workers from deleting the same Auth
-- identity concurrently; expiry permits recovery when a worker crashes after
-- DB commit or midway through the Auth HTTP operation.
create or replace function public.claim_deletion_auth_cleanup_batch(p_limit integer)
returns table (account_id uuid, phase text, lease_id uuid, attempt_count integer)
language plpgsql security definer set search_path='' as $claim$
declare v_item record; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_limit is null or p_limit<1 or p_limit>25 then
    raise exception using errcode='22023', message='Auth cleanup batch must be between 1 and 25';
  end if;
  for v_item in
    select q.account_id from research_lifecycle_private.deletion_auth_cleanup q
    where q.phase in ('auth_pending','auth_confirmed')
      and q.next_attempt_at <= v_now
    order by q.next_attempt_at,q.started_at,q.account_id
    for update skip locked
    limit p_limit
  loop
    update research_lifecycle_private.deletion_auth_cleanup q
      set lease_id=pg_catalog.gen_random_uuid(),
          next_attempt_at=v_now+interval '15 minutes',
          attempt_count=q.attempt_count+1
      where q.account_id=v_item.account_id
      returning q.account_id,q.phase,q.lease_id,q.attempt_count
        into account_id,phase,lease_id,attempt_count;
    return next;
  end loop;
end;
$claim$;
revoke all on function public.claim_deletion_auth_cleanup_batch(integer)
  from public,anon,authenticated,service_role;
grant execute on function public.claim_deletion_auth_cleanup_batch(integer)
  to service_role;

-- Pre-Auth / pre-email financial fence. The caller must present the active
-- lease. The same profile row lock serializes this check against in-flight
-- signed paid-binding quarantine and Research lifecycle writers. This RPC is
-- a point-in-time check, NOT a lock across subsequent Auth/HTTP requests and
-- NOT standalone provider cancellation evidence.
create or replace function public.check_deletion_auth_cleanup_billing_fence(
  p_account_id uuid, p_lease_id uuid
)
returns boolean language plpgsql security definer set search_path='' as $fence$
declare
  v_profile public.profiles;
  v_row research_lifecycle_private.deletion_auth_cleanup;
begin
  select p.* into v_profile from public.profiles p
   where p.account_id=p_account_id for update;
  if not found or v_profile.status<>'deleted'
     or v_profile.auth_user_id is not null or v_profile.deleted_at is null then
    raise exception using errcode='55000', message='deletion identity is not finalized';
  end if;
  select q.* into v_row from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account_id for update;
  if not found or p_lease_id is null
     or v_row.lease_id is distinct from p_lease_id
     or v_row.next_attempt_at <= pg_catalog.clock_timestamp()
     or v_row.phase not in ('auth_pending','auth_confirmed')
     or v_row.original_auth_user_id is distinct from p_account_id
     or v_row.deleted_at is distinct from v_profile.deleted_at then
    raise exception using errcode='42501', message='Auth cleanup financial fence lease invalid';
  end if;
  if pg_catalog.cardinality(
      research_lifecycle_private.billing_hold_reasons(p_account_id)
    ) > 0 then
    raise exception using errcode='55000',
      message='post-finalization Research financial evidence requires reconciliation';
  end if;
  return true;
end;
$fence$;
revoke all on function public.check_deletion_auth_cleanup_billing_fence(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.check_deletion_auth_cleanup_billing_fence(uuid,uuid)
  to service_role;

-- The caller attests Auth Admin DELETE success (or verified absence). Only
-- service_role may attest, and it must present the current lease. Database
-- finalization is already done; no billing hold may be silently erased here.
create or replace function public.confirm_deletion_auth_cleanup(
  p_account_id uuid,p_lease_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $confirm$
declare
  v_row research_lifecycle_private.deletion_auth_cleanup;
  v_profile public.profiles;
begin
  -- Match Phase A lock order (profile first) and serialize against new
  -- signed payment observations before acknowledging Auth retirement.
  select p.* into v_profile from public.profiles p
   where p.account_id=p_account_id for update;
  if not found or v_profile.status<>'deleted' or v_profile.auth_user_id is not null
     or v_profile.deleted_at is null then
    raise exception using errcode='55000', message='database identity not finalized';
  end if;
  select q.* into v_row from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account_id for update;
  if not found or p_lease_id is null or v_row.lease_id is distinct from p_lease_id
    or v_row.next_attempt_at <= pg_catalog.clock_timestamp()
    or v_row.phase not in ('auth_pending','auth_confirmed')
    or v_row.deleted_at is distinct from v_profile.deleted_at then
    raise exception using errcode='42501', message='Auth cleanup lease invalid';
  end if;
  if pg_catalog.cardinality(
       research_lifecycle_private.billing_hold_reasons(p_account_id)
     ) > 0 then
    raise exception using errcode='55000',
      message='Research payment evidence arrived after database deletion';
  end if;
  update research_lifecycle_private.deletion_auth_cleanup q
    set phase='auth_confirmed',
        auth_confirmed_at=coalesce(q.auth_confirmed_at,pg_catalog.clock_timestamp())
    where q.account_id=p_account_id;
  return pg_catalog.jsonb_build_object(
    'phase','auth_confirmed','account_id',v_row.account_id,
    'recipient_email',v_row.recipient_email,
    'deletion_requested_at',v_row.deletion_requested_at,
    'deleted_at',v_row.deleted_at
  );
end;
$confirm$;
revoke all on function public.confirm_deletion_auth_cleanup(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.confirm_deletion_auth_cleanup(uuid,uuid)
  to service_role;

-- Phase C acknowledgement. An actual durable notification_outbox entry must
-- exist BEFORE the recovery ledger can discard the original recipient email.
create or replace function public.finish_deletion_auth_cleanup(
  p_account_id uuid,p_lease_id uuid
)
returns boolean language plpgsql security definer set search_path='' as $finish$
declare
  v_row research_lifecycle_private.deletion_auth_cleanup;
  v_profile public.profiles;
  v_outbox_id uuid;
begin
  -- DB-first reconciliation and the paid-event writer use profile locks.
  -- A late signed payment must prevent privacy/completion acknowledgement.
  select p.* into v_profile from public.profiles p
   where p.account_id=p_account_id for update;
  if not found or v_profile.status<>'deleted' or v_profile.auth_user_id is not null
     or v_profile.deleted_at is null then
    raise exception using errcode='55000', message='database identity not finalized';
  end if;
  select q.* into v_row from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account_id for update;
  if not found then
    raise exception using errcode='P0002', message='Auth cleanup record missing';
  end if;
  if v_row.phase='email_enqueued' then return true; end if;
  if p_lease_id is null or v_row.lease_id is distinct from p_lease_id
     or v_row.next_attempt_at <= pg_catalog.clock_timestamp()
     or v_row.phase<>'auth_confirmed'
     or v_row.deleted_at is distinct from v_profile.deleted_at then
    raise exception using errcode='42501', message='Auth email cleanup lease invalid';
  end if;
  if pg_catalog.cardinality(
       research_lifecycle_private.billing_hold_reasons(p_account_id)
     ) > 0 then
    raise exception using errcode='55000',
      message='Research payment evidence arrived before deletion acknowledgement';
  end if;
  -- The email is inserted by the ordinary ledger helper, but the trigger
  -- stages it as NON-DISPATCHABLE until this transaction acknowledges it.
  select o.id into v_outbox_id from public.notification_outbox o
   where o.message_id='account_deletion_completed'
     and o.business_object_type='account_deletion_request'
     and o.business_object_id=p_account_id::text
     and o.recipient_email_normalized=pg_catalog.lower(pg_catalog.btrim(v_row.recipient_email))
     and o.state_version=pg_catalog.floor(
       extract(epoch from v_row.deleted_at)/60
     )::integer
     and o.status='deletion_staged'
   for update;
  if not found then
    raise exception using errcode='55000', message='staged completion email outbox not found';
  end if;

  update research_lifecycle_private.deletion_auth_cleanup q
     set phase='email_enqueued',recipient_email=null,
         privacy_request_ids='{}'::uuid[],lease_id=null,
         email_enqueued_at=pg_catalog.clock_timestamp(),last_error_code=null
   where q.account_id=p_account_id;

  -- The update trigger refuses queued delivery unless the private phase
  -- already says email_enqueued. Both changes roll back together on failure.
  update public.notification_outbox o
     set status='queued',updated_at=pg_catalog.clock_timestamp()
   where o.id=v_outbox_id and o.status='deletion_staged';
  if not found then
    raise exception using errcode='55000', message='completion email release lost';
  end if;

  update public.privacy_requests pr
     set status='completed', completed_at=pg_catalog.clock_timestamp(),
         decision_reason='Auth cleanup confirmed; account deletion completed',
         updated_at=pg_catalog.clock_timestamp()
   where pr.id=any(v_row.privacy_request_ids) and pr.request_type='deletion';
  return true;
end;
$finish$;
revoke all on function public.finish_deletion_auth_cleanup(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.finish_deletion_auth_cleanup(uuid,uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Part 10. HOLD-BY-DEFAULT completion email outbox. This is a DRAFT-only
-- proposed release barrier; it changes a shared table, so owner approval and
-- independent compatibility review are mandatory before any migration.
--
-- The ordinary service_role email helper inserts without a status value.
-- A privileged BEFORE INSERT trigger forces account_deletion_completed rows
-- to deletion_staged (never dispatchable) only after the Auth lease has been
-- confirmed and the same profile-based billing lock is clear.
--
-- finish_deletion_auth_cleanup above flips the private phase and releases the
-- staged outbox to queued IN ONE SQL TRANSACTION, after a fresh billing check.
-- A direct service_role UPDATE cannot release a staged outbox prematurely.
-- ---------------------------------------------------------------------------
alter table public.notification_outbox drop constraint notification_outbox_status_allowed;
alter table public.notification_outbox add constraint notification_outbox_status_allowed
  check (status in (
    'queued','sending','accepted','delivered','soft_bounced','hard_bounced',
    'complained','suppressed','retry_scheduled','terminal_failed','cancelled',
    'deletion_staged'
  ));

create or replace function research_lifecycle_private.stage_deletion_completion_email()
returns trigger language plpgsql security definer set search_path='' as $stage$
declare
  v_account_id uuid;
  v_profile public.profiles;
  v_queue research_lifecycle_private.deletion_auth_cleanup;
begin
  if new.message_id<>'account_deletion_completed' then
    return new;
  end if;
  if new.business_object_type<>'account_deletion_request'
     or new.business_object_id is null
     or pg_catalog.char_length(new.business_object_id) <> 36
     or new.business_object_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
  then
    raise exception using errcode='42501', message='completion email has invalid account identity';
  end if;
  v_account_id:=new.business_object_id::uuid;

  if tg_op='INSERT' then
    select p.* into v_profile from public.profiles p
     where p.account_id=v_account_id for update;
    if not found or v_profile.status<>'deleted' or v_profile.auth_user_id is not null
       or v_profile.deleted_at is null then
      raise exception using errcode='55000', message='completion email account is not finalized';
    end if;
    select q.* into v_queue from research_lifecycle_private.deletion_auth_cleanup q
     where q.account_id=v_account_id for update;
    if not found or v_queue.phase<>'auth_confirmed'
       or v_queue.lease_id is null
       or v_queue.next_attempt_at<=pg_catalog.clock_timestamp()
       or v_queue.deleted_at is distinct from v_profile.deleted_at
       or new.recipient_email_normalized is distinct from
          pg_catalog.lower(pg_catalog.btrim(v_queue.recipient_email))
       or new.state_version is distinct from pg_catalog.floor(
          extract(epoch from v_queue.deleted_at)/60
       )::integer then
      raise exception using errcode='42501', message='completion email lacks Auth-confirmed custody';
    end if;
    if pg_catalog.cardinality(
         research_lifecycle_private.billing_hold_reasons(v_account_id)
       )>0 then
      raise exception using errcode='55000',
        message='completion email blocked by late Research billing observation';
    end if;
    new.status:='deletion_staged';
  elsif tg_op='UPDATE' and old.status='deletion_staged'
        and new.status is distinct from old.status then
    -- Only the SQL finisher can first move private custody to email_enqueued.
    -- Do not permit a direct privileged PATCH to bypass that transaction.
    if new.status<>'queued' or not exists (
      select 1 from research_lifecycle_private.deletion_auth_cleanup q
       where q.account_id=v_account_id and q.phase='email_enqueued'
    ) then
      raise exception using errcode='42501', message='staged deletion email cannot be dispatched';
    end if;
  end if;
  return new;
end;
$stage$;
revoke all on function research_lifecycle_private.stage_deletion_completion_email()
 from public,anon,authenticated,service_role;
drop trigger if exists research_p1_stage_deletion_completion_email on public.notification_outbox;
create trigger research_p1_stage_deletion_completion_email
 before insert or update on public.notification_outbox
 for each row execute function research_lifecycle_private.stage_deletion_completion_email();


