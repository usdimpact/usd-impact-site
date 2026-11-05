-- OWNER POLICY #1103. AUTHOR CANDIDATE ONLY; NOT A DEPLOYABLE MIGRATION.
-- Synthetic PG17 proof of a durable account-keyed, fail-closed reconciliation hold.
-- Do not run on Development/Production without a separately approved migration.
begin;

create table public.research_deletion_billing_holds (
  account_id uuid primary key
    references public.profiles(account_id) on delete restrict,
  hold_state text not null default 'open'
    check (hold_state in ('open', 'manual_review')),
  reason_code text not null
    check (reason_code in ('subscription_present','lookup_unavailable','lookup_malformed')),
  attempt_count integer not null default 1
    check (attempt_count between 1 and 2147483647),
  first_seen_at timestamptz not null default clock_timestamp(),
  last_checked_at timestamptz not null default clock_timestamp(),
  next_check_at timestamptz not null,
  escalate_at timestamptz not null,
  escalated_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint research_hold_time_order check (
    next_check_at >= first_seen_at and escalate_at >= first_seen_at
  )
);

create index research_deletion_billing_holds_escalation_idx
  on public.research_deletion_billing_holds(hold_state,escalate_at);

alter table public.research_deletion_billing_holds enable row level security;
revoke all on table public.research_deletion_billing_holds
  from public,anon,authenticated,service_role;
grant select,insert,update on public.research_deletion_billing_holds
  to service_role;

-- In a future rollout a scheduled, authorized operator/reconciler reads the
-- minimal manual-review rows. This function never contacts a merchant, closes
-- a case, calls account deletion, changes account status or proves cancellation.
create or replace function public.record_research_deletion_billing_hold(
  p_account_id uuid,
  p_reason_code text
) returns jsonb
language plpgsql security invoker set search_path=''
as $d33hold$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_profile public.profiles%rowtype;
  v_row public.research_deletion_billing_holds%rowtype;
begin
  if p_account_id is null
     or p_reason_code not in
      ('subscription_present','lookup_unavailable','lookup_malformed')
     or p_reason_code is null then
    raise exception 'invalid research deletion billing hold input'
      using errcode='22023';
  end if;
  -- Do not create ledger cases against unrelated/active profiles. SHARE locks
  -- the profile until commit, preventing concurrent status-write drift.
  select * into v_profile from public.profiles
    where account_id=p_account_id for share;
  if not found or v_profile.status <> 'deletion_pending' then
    raise exception 'account is not awaiting deletion'
      using errcode='42501';
  end if;

  insert into public.research_deletion_billing_holds (
    account_id,hold_state,reason_code,attempt_count,
    first_seen_at,last_checked_at,next_check_at,escalate_at,updated_at
  ) values (
    p_account_id,'open',p_reason_code,1,
    v_now,v_now,v_now + interval '6 hours',
    v_now + interval '24 hours',v_now
  )
  on conflict (account_id) do update
    set reason_code = excluded.reason_code,
        attempt_count = case
          when v_now >= research_deletion_billing_holds.next_check_at
          then least(research_deletion_billing_holds.attempt_count + 1,2147483647)
          else research_deletion_billing_holds.attempt_count end,
        last_checked_at = case
          when v_now >= research_deletion_billing_holds.next_check_at
          then v_now else research_deletion_billing_holds.last_checked_at end,
        next_check_at = case
          when v_now >= research_deletion_billing_holds.next_check_at
          then v_now + interval '6 hours'
          else research_deletion_billing_holds.next_check_at end,
        hold_state = case
          when v_now >= research_deletion_billing_holds.escalate_at
            or research_deletion_billing_holds.attempt_count >= 4
          then 'manual_review'
          else research_deletion_billing_holds.hold_state end,
        escalated_at = case
          when (v_now >= research_deletion_billing_holds.escalate_at
                or research_deletion_billing_holds.attempt_count >= 4)
               and research_deletion_billing_holds.escalated_at is null
          then v_now else research_deletion_billing_holds.escalated_at end,
        updated_at = v_now
  returning * into v_row;

  if not found or v_row.account_id is distinct from p_account_id
     or v_row.hold_state not in ('open','manual_review') then
    raise exception 'billing hold was not committed'
      using errcode='55000';
  end if;
  return pg_catalog.jsonb_build_object(
    'hold_state',v_row.hold_state,
    'reason_code',v_row.reason_code,
    'attempt_count',v_row.attempt_count,
    'next_check_at',v_row.next_check_at,
    'escalate_at',v_row.escalate_at
  );
end;
$d33hold$;

revoke all on function public.record_research_deletion_billing_hold(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_deletion_billing_hold(uuid,text)
  to service_role;
commit;
