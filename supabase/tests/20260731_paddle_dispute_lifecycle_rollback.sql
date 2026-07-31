create or replace function pg_temp.usd_impact_test_paddle_dispute_lifecycle()
returns table (
  step_no integer,
  step text,
  expected_purchase_status text,
  actual_purchase_status text,
  expected_entitlement_state text,
  actual_entitlement_state text,
  passed boolean
)
language plpgsql
as $$
declare
  v_transaction_id constant text := 'txn_01kywhr3epw118s45sg3hemhp0';
  v_purchase_id uuid;
  v_entitlement_id uuid;
  v_original_purchase_status text;
  v_original_entitlement_state text;
  v_purchase_status text;
  v_entitlement_state text;
  v_results jsonb := '[]'::jsonb;

  v_warning_1_id text := 'adj_' || substr(md5('usd-impact-warning-1'), 1, 26);
  v_warning_reverse_id text := 'adj_' || substr(md5('usd-impact-warning-reverse'), 1, 26);
  v_warning_2_id text := 'adj_' || substr(md5('usd-impact-warning-2'), 1, 26);
  v_chargeback_id text := 'adj_' || substr(md5('usd-impact-chargeback'), 1, 26);
  v_chargeback_reverse_id text := 'adj_' || substr(md5('usd-impact-chargeback-reverse'), 1, 26);
  v_stale_warning_id text := 'adj_' || substr(md5('usd-impact-stale-warning'), 1, 26);
  v_chargeback_2_id text := 'adj_' || substr(md5('usd-impact-chargeback-2'), 1, 26);
  v_refund_id text := 'adj_' || substr(md5('usd-impact-refund-after-chargeback'), 1, 26);
  v_blocked_reverse_id text := 'adj_' || substr(md5('usd-impact-blocked-reverse'), 1, 26);
begin
  select p.id, e.id, p.status::text, e.state::text
    into v_purchase_id, v_entitlement_id,
         v_original_purchase_status, v_original_entitlement_state
  from public.purchases p
  join public.entitlements e
    on e.purchase_id = p.id
  where p.provider = 'paddle'
    and p.provider_transaction_id = v_transaction_id
  limit 1;

  if not found then
    raise exception 'Sandbox test purchase % was not found.', v_transaction_id;
  end if;

  begin
    delete from public.paddle_adjustments
    where purchase_id = v_purchase_id;

    update public.purchases
    set status = 'completed'::public.purchase_status,
        refunded_at = null,
        disputed_at = null
    where id = v_purchase_id;

    update public.entitlements
    set state = 'active'::public.entitlement_state,
        version = version + 1
    where id = v_entitlement_id;

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback_warning_1',
      '2026-07-31T20:00:00Z'::timestamptz,
      v_warning_1_id,
      v_transaction_id,
      'chargeback_warning',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'warning')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 1,
      'step', 'chargeback warning suspends access',
      'expected_purchase_status', 'disputed',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'suspended_dispute',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'disputed' and v_entitlement_state = 'suspended_dispute'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback_warning_reverse',
      '2026-07-31T20:01:00Z'::timestamptz,
      v_warning_reverse_id,
      v_transaction_id,
      'chargeback_warning_reverse',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'warning_reverse')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 2,
      'step', 'warning reversal restores eligible access',
      'expected_purchase_status', 'completed',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'active',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'completed' and v_entitlement_state = 'active'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback_warning_2',
      '2026-07-31T20:02:00Z'::timestamptz,
      v_warning_2_id,
      v_transaction_id,
      'chargeback_warning',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'warning_again')
    );

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback',
      '2026-07-31T20:03:00Z'::timestamptz,
      v_chargeback_id,
      v_transaction_id,
      'chargeback',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'chargeback')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 3,
      'step', 'approved chargeback revokes access',
      'expected_purchase_status', 'charged_back',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'charged_back',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'charged_back' and v_entitlement_state = 'charged_back'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback_reverse',
      '2026-07-31T20:04:00Z'::timestamptz,
      v_chargeback_reverse_id,
      v_transaction_id,
      'chargeback_reverse',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'chargeback_reverse')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 4,
      'step', 'chargeback reversal restores eligible access',
      'expected_purchase_status', 'completed',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'active',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'completed' and v_entitlement_state = 'active'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_stale_chargeback_warning',
      '2026-07-31T19:59:00Z'::timestamptz,
      v_stale_warning_id,
      v_transaction_id,
      'chargeback_warning',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'stale_warning')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 5,
      'step', 'older delayed warning cannot undo newer reversal',
      'expected_purchase_status', 'completed',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'active',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'completed' and v_entitlement_state = 'active'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_chargeback_2',
      '2026-07-31T20:05:00Z'::timestamptz,
      v_chargeback_2_id,
      v_transaction_id,
      'chargeback',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'chargeback_before_refund')
    );

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_refund_after_chargeback',
      '2026-07-31T20:06:00Z'::timestamptz,
      v_refund_id,
      v_transaction_id,
      'refund',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'refund_after_chargeback')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 6,
      'step', 'approved full refund remains final',
      'expected_purchase_status', 'refunded',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'refunded',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'refunded' and v_entitlement_state = 'refunded'
    ));

    perform public.apply_paddle_adjustment_lifecycle(
      'evt_test_blocked_chargeback_reverse',
      '2026-07-31T20:07:00Z'::timestamptz,
      v_blocked_reverse_id,
      v_transaction_id,
      'chargeback_reverse',
      'approved',
      4900,
      'full',
      'rollback-only lifecycle test',
      jsonb_build_object('test', true, 'step', 'blocked_reverse_after_refund')
    );

    select p.status::text, e.state::text
      into v_purchase_status, v_entitlement_state
    from public.purchases p
    join public.entitlements e on e.purchase_id = p.id
    where p.id = v_purchase_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 7,
      'step', 'chargeback reversal cannot restore refunded access',
      'expected_purchase_status', 'refunded',
      'actual_purchase_status', v_purchase_status,
      'expected_entitlement_state', 'refunded',
      'actual_entitlement_state', v_entitlement_state,
      'passed', v_purchase_status = 'refunded' and v_entitlement_state = 'refunded'
    ));

    raise exception using
      errcode = 'ZX001',
      message = 'rollback-only dispute lifecycle test complete';
  exception
    when sqlstate 'ZX001' then
      null;
  end;

  select p.status::text, e.state::text
    into v_purchase_status, v_entitlement_state
  from public.purchases p
  join public.entitlements e on e.purchase_id = p.id
  where p.id = v_purchase_id;

  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'step_no', 8,
    'step', 'test rollback restored original database state',
    'expected_purchase_status', v_original_purchase_status,
    'actual_purchase_status', v_purchase_status,
    'expected_entitlement_state', v_original_entitlement_state,
    'actual_entitlement_state', v_entitlement_state,
    'passed', v_purchase_status = v_original_purchase_status
      and v_entitlement_state = v_original_entitlement_state
  ));

  return query
  select
    (item->>'step_no')::integer,
    item->>'step',
    item->>'expected_purchase_status',
    item->>'actual_purchase_status',
    item->>'expected_entitlement_state',
    item->>'actual_entitlement_state',
    (item->>'passed')::boolean
  from jsonb_array_elements(v_results) as item
  order by (item->>'step_no')::integer;
end;
$$;

select *
from pg_temp.usd_impact_test_paddle_dispute_lifecycle();
