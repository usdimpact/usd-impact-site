create or replace function pg_temp.usd_impact_test_account_rpc_hardening()
returns table (
  step_no integer,
  step text,
  expected_value text,
  actual_value text,
  passed boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_other_account_id constant uuid := '00000000-0000-4000-8000-000000000002';
  v_original_profile_status text;
  v_original_privacy_request_count integer;
  v_profile public.profiles;
  v_actual_profile_status text;
  v_actual_privacy_request_count integer;
  v_repeat_denied boolean := false;
  v_results jsonb := '[]'::jsonb;
begin
  select p.account_id, p.status::text
    into v_account_id, v_original_profile_status
  from public.profiles p
  where p.status = 'active'
  order by p.created_at
  limit 1;

  if v_account_id is null then
    raise exception 'An active Development profile is required for the rollback-only account RPC test.';
  end if;

  select count(*)::integer
    into v_original_privacy_request_count
  from public.privacy_requests r
  where r.account_id = v_account_id;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_account_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_account_id, 'role', 'authenticated')::text,
    true
  );

  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'step_no', 1,
    'step', 'parameterless export returns the authenticated account payload',
    'expected_value', 'true',
    'actual_value', (public.account_export() is not null)::text,
    'passed', public.account_export() is not null
  ));

  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'step_no', 2,
    'step', 'compatibility export accepts only the authenticated account ID',
    'expected_value', 'own=true:other=true',
    'actual_value',
      'own=' || (public.account_export(v_account_id) = public.account_export())::text
      || ':other=' || (public.account_export(v_other_account_id) is null)::text,
    'passed', public.account_export(v_account_id) = public.account_export()
      and public.account_export(v_other_account_id) is null
  ));

  begin
    v_profile := public.request_account_deletion();

    select p.status::text
      into v_actual_profile_status
    from public.profiles p
    where p.account_id = v_account_id;

    select count(*)::integer
      into v_actual_privacy_request_count
    from public.privacy_requests r
    where r.account_id = v_account_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 3,
      'step', 'own deletion request stages only the authenticated account',
      'expected_value', 'deletion_pending:+1',
      'actual_value',
        coalesce(v_profile.status::text, 'null') || ':'
        || (v_actual_privacy_request_count - v_original_privacy_request_count)::text,
      'passed', v_profile.account_id = v_account_id
        and v_actual_profile_status = 'deletion_pending'
        and v_actual_privacy_request_count = v_original_privacy_request_count + 1
    ));

    begin
      perform public.request_account_deletion();
    exception
      when others then
        v_repeat_denied := sqlerrm = 'account is not eligible for deletion request';
    end;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'step_no', 4,
      'step', 'repeat deletion request is rejected',
      'expected_value', 'true',
      'actual_value', v_repeat_denied::text,
      'passed', v_repeat_denied
    ));

    raise exception using
      errcode = 'ZX003',
      message = 'rollback-only account RPC test complete';
  exception
    when sqlstate 'ZX003' then
      null;
  end;

  select p.status::text
    into v_actual_profile_status
  from public.profiles p
  where p.account_id = v_account_id;

  select count(*)::integer
    into v_actual_privacy_request_count
  from public.privacy_requests r
  where r.account_id = v_account_id;

  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'step_no', 5,
    'step', 'rollback restores profile and privacy-request state',
    'expected_value',
      v_original_profile_status || ':privacy=' || v_original_privacy_request_count::text,
    'actual_value',
      v_actual_profile_status || ':privacy=' || v_actual_privacy_request_count::text,
    'passed', v_actual_profile_status = v_original_profile_status
      and v_actual_privacy_request_count = v_original_privacy_request_count
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
from pg_temp.usd_impact_test_account_rpc_hardening();
