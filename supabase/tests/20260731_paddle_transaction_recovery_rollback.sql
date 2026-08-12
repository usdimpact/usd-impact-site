create or replace function pg_temp.usd_impact_test_paddle_transaction_recovery()
returns table (
  step_no integer,
  step text,
  expected_value text,
  actual_value text,
  passed boolean
)
language plpgsql
as $$
declare
  v_original_transaction_id constant text := 'txn_01kywhr3epw118s45sg3hemhp0';
  v_transaction_a text := 'txn_' || substr(md5('usd-impact-recovery-transaction-a'), 1, 26);
  v_transaction_b text := 'txn_' || substr(md5('usd-impact-recovery-transaction-b'), 1, 26);
  v_customer_id text := 'ctm_' || substr(md5('usd-impact-recovery-customer'), 1, 26);
  v_refund_adjustment_id text := 'adj_' || substr(md5('usd-impact-recovery-refund'), 1, 26);

  v_purchase_id uuid;
  v_entitlement_id uuid;
  v_account_id uuid;
  v_product_id text;
  v_price_id text;
  v_price_tier text;
  v_currency text;
  v_subtotal_cents integer;
  v_tax_cents integer;
  v_total_cents integer;
  v_offer_terms jsonb;
  v_original_purchase_status text;
  v_original_entitlement_state text;

  v_intent_id uuid;
  v_result jsonb;
  v_actual text;
  v_status text;
  v_entitlement_state text;
  v_count integer;
  v_test_rows integer;
  v_results jsonb := '[]'::jsonb;
begin
  select
    p.id,
    e.id,
    p.account_id,
    p.product_id,
    p.provider_price_id,
    p.price_tier,
    p.currency,
    p.amount_cents,
    coalesce(p.tax_cents, 0),
    coalesce(p.total_cents, p.amount_cents),
    p.offer_terms,
    p.status::text,
    e.state::text
  into
    v_purchase_id,
    v_entitlement_id,
    v_account_id,
    v_product_id,
    v_price_id,
    v_price_tier,
    v_currency,
    v_subtotal_cents,
    v_tax_cents,
    v_total_cents,
    v_offer_terms,
    v_original_purchase_status,
    v_original_entitlement_state
  from public.purchases p
  join public.entitlements e
    on e.purchase_id = p.id
  where p.provider = 'paddle'
    and p.provider_transaction_id = v_original_transaction_id
  limit 1;

  if not found then
    raise exception 'Sandbox test purchase % was not found.', v_original_transaction_id;
  end if;
  if v_price_id is null then
    raise exception 'Sandbox test purchase does not contain a Paddle price ID.';
  end if;

  begin
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
      'rollback-recovery:' || gen_random_uuid()::text,
      v_account_id,
      v_product_id,
      'pending',
      v_price_tier,
      v_subtotal_cents,
      v_currency,
      v_offer_terms,
      now() + interval '30 minutes'
    ) returning id into v_intent_id;

    v_result := public.attach_paddle_transaction(v_intent_id, v_transaction_a);
    select status::text || ':' || provider_checkout_id
      into v_actual
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 1,
      'step', 'first checkout transaction attaches to the intent',
      'expected_value', 'checkout_created:' || v_transaction_a,
      'actual_value', v_actual,
      'passed', v_actual = 'checkout_created:' || v_transaction_a
        and (v_result->>'attached')::boolean
    ));

    v_result := public.attach_paddle_transaction(v_intent_id, v_transaction_b);
    select status::text || ':' || provider_checkout_id
      into v_actual
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 2,
      'step', 'a concurrent second transaction cannot replace the first',
      'expected_value', 'checkout_created:' || v_transaction_a,
      'actual_value', v_actual,
      'passed', v_actual = 'checkout_created:' || v_transaction_a
        and not (v_result->>'attached')::boolean
    ));

    v_result := public.apply_paddle_transaction_lifecycle(
      'evt_test_recovery_payment_failed',
      'transaction.payment_failed',
      '2026-07-31T20:20:00Z'::timestamptz,
      v_transaction_a,
      v_intent_id,
      v_account_id,
      v_product_id,
      'past_due',
      'failed',
      'card_declined',
      jsonb_build_object('test', true, 'step', 'payment_failed')
    );

    select status::text into v_status
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 3,
      'step', 'payment failure marks the intent failed without granting access',
      'expected_value', 'failed',
      'actual_value', v_status,
      'passed', v_status = 'failed'
        and (v_result->>'state_changed')::boolean
    ));

    v_result := public.apply_paddle_transaction_lifecycle(
      'evt_test_recovery_retry_pending',
      'transaction.updated',
      '2026-07-31T20:22:00Z'::timestamptz,
      v_transaction_a,
      v_intent_id,
      v_account_id,
      v_product_id,
      'ready',
      'pending',
      null,
      jsonb_build_object('test', true, 'step', 'retry_pending')
    );

    select status::text into v_status
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 4,
      'step', 'a newer retry reopens the existing checkout intent',
      'expected_value', 'checkout_created',
      'actual_value', v_status,
      'passed', v_status = 'checkout_created'
        and not (v_result->>'stale')::boolean
    ));

    v_result := public.apply_paddle_transaction_lifecycle(
      'evt_test_recovery_delayed_failure',
      'transaction.payment_failed',
      '2026-07-31T20:21:00Z'::timestamptz,
      v_transaction_a,
      v_intent_id,
      v_account_id,
      v_product_id,
      'past_due',
      'failed',
      'delayed_failure',
      jsonb_build_object('test', true, 'step', 'delayed_failure')
    );

    select status::text into v_status
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 5,
      'step', 'an older delayed failure cannot overwrite the newer retry',
      'expected_value', 'checkout_created:stale',
      'actual_value', v_status || ':' || coalesce(v_result->>'stale', 'false'),
      'passed', v_status = 'checkout_created'
        and (v_result->>'stale')::boolean
    ));

    v_result := public.reserve_paddle_purchase_intent(
      v_account_id,
      'rollback-recovery-reserve:' || substr(md5('usd-impact-recovery-reserve'), 1, 32),
      '2026-07-31T20:23:00Z'::timestamptz
    );

    v_actual := coalesce(v_result->>'id', '') || ':' || coalesce(v_result->>'reused_open_intent', 'false');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 6,
      'step', 'a new checkout click reuses the open intent',
      'expected_value', v_intent_id::text || ':true',
      'actual_value', v_actual,
      'passed', v_result->>'id' = v_intent_id::text
        and (v_result->>'reused_open_intent')::boolean
    ));

    update public.purchases
    set status = 'completed'::public.purchase_status,
        refunded_at = null,
        disputed_at = null
    where id = v_purchase_id;

    update public.entitlements
    set state = 'active'::public.entitlement_state,
        version = version + 1,
        updated_at = now()
    where id = v_entitlement_id;

    v_result := public.complete_paddle_purchase(
      'evt_test_recovery_duplicate_completed',
      '2026-07-31T20:24:00Z'::timestamptz,
      v_transaction_a,
      v_customer_id,
      v_intent_id,
      v_account_id,
      v_product_id,
      v_price_id,
      v_price_tier,
      v_currency,
      v_subtotal_cents,
      v_tax_cents,
      v_total_cents,
      jsonb_build_object('test', true, 'step', 'duplicate_completed')
    );

    select e.state::text into v_entitlement_state
    from public.entitlements e
    where e.id = v_entitlement_id;

    select count(*)::integer into v_count
    from public.paddle_duplicate_purchases
    where provider_transaction_id = v_transaction_a
      and status = 'refund_required';

    v_actual := coalesce(v_result->>'duplicate_purchase', 'false') || ':'
      || coalesce(v_result->>'refund_required', 'false') || ':'
      || v_count::text || ':' || v_entitlement_state;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 7,
      'step', 'a second completed purchase is routed to refund while one entitlement stays active',
      'expected_value', 'true:true:1:active',
      'actual_value', v_actual,
      'passed', (v_result->>'duplicate_purchase')::boolean
        and (v_result->>'refund_required')::boolean
        and v_count = 1
        and v_entitlement_state = 'active'
    ));

    v_result := public.record_paddle_duplicate_refund_request(
      v_transaction_a,
      v_refund_adjustment_id,
      'pending_approval',
      jsonb_build_object('test', true, 'step', 'refund_requested')
    );

    select status into v_status
    from public.paddle_duplicate_purchases
    where provider_transaction_id = v_transaction_a;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 8,
      'step', 'the automatic duplicate refund request is tracked as pending',
      'expected_value', 'refund_pending',
      'actual_value', v_status,
      'passed', v_status = 'refund_pending'
        and v_result->>'status' = 'refund_pending'
    ));

    v_result := public.apply_paddle_adjustment_dispatch(
      'evt_test_recovery_duplicate_refund_approved',
      '2026-07-31T20:25:00Z'::timestamptz,
      v_refund_adjustment_id,
      v_transaction_a,
      'refund',
      'approved',
      v_total_cents,
      'full',
      'rollback-only duplicate refund test',
      jsonb_build_object('test', true, 'step', 'duplicate_refund_approved')
    );

    select d.status, e.state::text
      into v_status, v_entitlement_state
    from public.paddle_duplicate_purchases d
    cross join public.entitlements e
    where d.provider_transaction_id = v_transaction_a
      and e.id = v_entitlement_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 9,
      'step', 'approved duplicate refund closes only the duplicate record',
      'expected_value', 'refunded:active',
      'actual_value', v_status || ':' || v_entitlement_state,
      'passed', v_status = 'refunded'
        and v_entitlement_state = 'active'
        and (v_result->>'duplicate_purchase')::boolean
    ));

    v_result := public.apply_paddle_transaction_lifecycle(
      'evt_test_recovery_failure_after_completion',
      'transaction.payment_failed',
      '2026-07-31T20:26:00Z'::timestamptz,
      v_transaction_a,
      v_intent_id,
      v_account_id,
      v_product_id,
      'past_due',
      'failed',
      'late_after_completed',
      jsonb_build_object('test', true, 'step', 'failure_after_completion')
    );

    select status::text into v_status
    from public.purchase_intents
    where id = v_intent_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 10,
      'step', 'a failure event cannot overwrite a completed intent',
      'expected_value', 'completed:stale',
      'actual_value', v_status || ':' || coalesce(v_result->>'stale', 'false'),
      'passed', v_status = 'completed'
        and (v_result->>'stale')::boolean
    ));

    v_result := public.complete_paddle_purchase(
      'evt_test_recovery_duplicate_completed',
      '2026-07-31T20:24:00Z'::timestamptz,
      v_transaction_a,
      v_customer_id,
      v_intent_id,
      v_account_id,
      v_product_id,
      v_price_id,
      v_price_tier,
      v_currency,
      v_subtotal_cents,
      v_tax_cents,
      v_total_cents,
      jsonb_build_object('test', true, 'step', 'duplicate_completed_replay')
    );

    select count(*)::integer into v_count
    from public.paddle_duplicate_purchases
    where provider_transaction_id = v_transaction_a;

    v_actual := coalesce(v_result->>'duplicate_transaction', 'false') || ':'
      || coalesce(v_result->>'duplicate_purchase', 'false') || ':' || v_count::text;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 11,
      'step', 'replaying the duplicate completion remains idempotent',
      'expected_value', 'true:true:1',
      'actual_value', v_actual,
      'passed', (v_result->>'duplicate_transaction')::boolean
        and (v_result->>'duplicate_purchase')::boolean
        and v_count = 1
    ));

    raise exception using
      errcode = 'ZX002',
      message = 'rollback-only transaction recovery test complete';
  exception
    when sqlstate 'ZX002' then
      null;
  end;

  select p.status::text, e.state::text
    into v_status, v_entitlement_state
  from public.purchases p
  join public.entitlements e on e.purchase_id = p.id
  where p.id = v_purchase_id;

  select (
    (select count(*) from public.purchase_intents where id = v_intent_id)
    +
    (select count(*) from public.paddle_transaction_events
      where provider_transaction_id in (v_transaction_a, v_transaction_b))
    +
    (select count(*) from public.paddle_duplicate_purchases
      where provider_transaction_id in (v_transaction_a, v_transaction_b))
  )::integer into v_test_rows;

  v_actual := v_status || ':' || v_entitlement_state || ':test_rows=' || v_test_rows::text;
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'step_no', 12,
    'step', 'test rollback restores the original database state and removes all test rows',
    'expected_value', v_original_purchase_status || ':' || v_original_entitlement_state || ':test_rows=0',
    'actual_value', v_actual,
    'passed', v_status = v_original_purchase_status
      and v_entitlement_state = v_original_entitlement_state
      and v_test_rows = 0
  ));

  return query
  select
    (item->>'step_no')::integer,
    item->>'step',
    item->>'expected_value',
    item->>'actual_value',
    (item->>'passed')::boolean
  from jsonb_array_elements(v_results) as item
  order by (item->>'step_no')::integer;
end;
$$;

select *
from pg_temp.usd_impact_test_paddle_transaction_recovery();
