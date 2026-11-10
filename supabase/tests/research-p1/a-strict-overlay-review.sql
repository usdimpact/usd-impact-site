-- #1103 A-strict OWNER-SUPERVISED review overlay, disposable PostgreSQL only.
-- NOT a Supabase migration, NOT owner D1/D3 acceptance; do not apply hosted.
-- Replay only AFTER source P1 migration and its legacy synthetic tests.
-- This cutover revokes automatic direct service_role entry points.
revoke all on function public.finalize_deletion_and_queue_auth_cleanup(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.claim_deletion_auth_cleanup_batch(integer)
  from public,anon,authenticated,service_role;
revoke all on function public.check_deletion_auth_cleanup_billing_fence(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.confirm_deletion_auth_cleanup(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.finish_deletion_auth_cleanup(uuid,uuid)
  from public,anon,authenticated,service_role;

create table research_lifecycle_private.a_strict_cases (
 account_id uuid primary key references public.profiles(account_id) on delete restrict,
 authorization_id uuid not null unique default pg_catalog.gen_random_uuid(),
 case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$'),
 owner_ref text not null check(pg_catalog.length(owner_ref) between 3 and 120),
 pre_clearance_id uuid not null references public.research_billing_clearances(id),
 authorized_at timestamptz not null default pg_catalog.clock_timestamp(),
 expires_at timestamptz not null,
 phase_a_at timestamptz,
 last_auth_lease_id uuid,
 auth_fenced_at timestamptz,
 auth_attempt_at timestamptz,
 auth_observed_at timestamptz,
 post_clearance_id uuid references public.research_billing_clearances(id),
 post_recorded_at timestamptz,
 latest_exception_at timestamptz,
 reconciled_hold_at timestamptz,
 completed_at timestamptz
);
alter table research_lifecycle_private.a_strict_cases enable row level security;
alter table research_lifecycle_private.a_strict_cases force row level security;
revoke all on research_lifecycle_private.a_strict_cases from public,anon,authenticated,service_role;

create table research_lifecycle_private.a_strict_exceptions (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 authorization_id uuid not null,
 reason text not null,
 recorded_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table research_lifecycle_private.a_strict_exceptions enable row level security;
alter table research_lifecycle_private.a_strict_exceptions force row level security;
revoke all on research_lifecycle_private.a_strict_exceptions from public,anon,authenticated,service_role;
create trigger a_strict_append_only before update or delete
 on research_lifecycle_private.a_strict_exceptions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_no_truncate before truncate
 on research_lifecycle_private.a_strict_exceptions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- SQL owner issues one opaque, expiring, case-bound capability. NEVER callable
-- from PostgREST service_role, anon or authenticated. No re-issuance after Phase A
-- in this conservative candidate; crash/recovery requires owner incident review.
create function public.a_strict_authorize(
 p_account uuid,p_case text,p_clearance uuid,p_owner text,p_expires timestamptz
) returns uuid language plpgsql security definer set search_path='' as $open$
declare v_now timestamptz:=pg_catalog.clock_timestamp();v_id uuid;v_profile public.profiles;
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
    or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120
    or p_expires is null or p_expires <= v_now or p_expires > v_now + interval '1 hour'
    or not exists (
       select 1 from public.research_billing_clearances c
        where c.id=p_clearance and c.account_id=p_account
          and c.verified_at<=v_now
          and c.verified_at>=v_now-interval '24 hours'
    ) then
  raise exception using errcode='55000',message='owner cessation custody or expiry invalid';
 end if;
 select p.* into v_profile from public.profiles p where p.account_id=p_account for update;
 if not found or v_profile.status<>'deletion_pending' or v_profile.deletion_due_at>v_now
    or v_profile.deletion_due_at is null then
   raise exception using errcode='55000',message='account not eligible for supervised deletion';
 end if;
 if exists(select 1 from research_lifecycle_private.a_strict_cases a where a.account_id=p_account) then
   raise exception using errcode='55000',message='case already exists; manual recovery required';
 end if;
 if pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0 then
   raise exception using errcode='55000',message='financial hold before supervision';
 end if;
 insert into research_lifecycle_private.a_strict_cases
   (account_id,case_ref,pre_clearance_id,owner_ref,expires_at)
 values(p_account,p_case,p_clearance,p_owner,p_expires)
 returning authorization_id into v_id;
 return v_id;
end;
$open$;
revoke all on function public.a_strict_authorize(uuid,text,uuid,text,timestamptz)
 from public,anon,authenticated,service_role;

create function research_lifecycle_private.a_strict_assert(
 p_account uuid,p_authorization uuid
) returns boolean language plpgsql security definer set search_path='' as $assert$
begin
 if p_account is null or p_authorization is null or not exists (
 select 1 from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account and a.authorization_id=p_authorization
   and a.expires_at>pg_catalog.clock_timestamp() and a.completed_at is null
 ) then
  raise exception using errcode='42501',message='single-account owner session required';
 end if;
 return true;
end;
$assert$;
revoke all on function research_lifecycle_private.a_strict_assert(uuid,uuid)
 from public,anon,authenticated,service_role;

create function public.a_strict_phase_a(
 p_account uuid,p_authorization uuid
) returns jsonb language plpgsql security definer set search_path='' as $phase$
declare v_a research_lifecycle_private.a_strict_cases;v_receipt jsonb;
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 if v_a.phase_a_at is not null or v_a.auth_attempt_at is not null then
   raise exception using errcode='55000',message='Phase A already attempted';
 end if;
 v_receipt:=public.finalize_deletion_and_queue_auth_cleanup(p_account);
 if v_receipt->>'phase'<>'auth_pending' or v_receipt->>'account_id'<>p_account::text then
   raise exception using errcode='55000',message='Phase A receipt invalid';
 end if;
 update research_lifecycle_private.a_strict_cases set phase_a_at=pg_catalog.clock_timestamp()
  where account_id=p_account;
 return pg_catalog.jsonb_build_object('account_id',p_account,'authorization_id',p_authorization,
 'case_ref',v_a.case_ref,'phase','auth_pending');
end;
$phase$;
revoke all on function public.a_strict_phase_a(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_phase_a(uuid,uuid) to service_role;

create function public.a_strict_claim(
 p_account uuid,p_authorization uuid,p_purpose text
) returns jsonb language plpgsql security definer set search_path='' as $lease$
declare v_a research_lifecycle_private.a_strict_cases;
        v_q research_lifecycle_private.deletion_auth_cleanup;
        v_now timestamptz:=pg_catalog.clock_timestamp();v_lease uuid;
begin
 if p_purpose not in ('auth','complete') then
    raise exception using errcode='22023',message='invalid supervised purpose';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 if v_a.phase_a_at is null or v_q.account_id is null
  or (p_purpose='auth' and v_q.phase<>'auth_pending')
  or (p_purpose='complete' and (v_q.phase<>'auth_confirmed' or v_a.auth_observed_at is null))
  or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
  or (v_q.financial_hold_at is not null and (v_a.reconciled_hold_at is null
     or v_a.reconciled_hold_at<v_q.financial_hold_at))
  or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
     where i.account_id=p_account and i.status='open') then
   raise exception using errcode='55000',message='phase, financial hold or concurrent lease';
 end if;
 v_lease:=pg_catalog.gen_random_uuid();
 update research_lifecycle_private.deletion_auth_cleanup
  set lease_id=v_lease,next_attempt_at=v_now+interval '15 minutes',attempt_count=attempt_count+1
  where account_id=p_account;
 if p_purpose='auth' then
  update research_lifecycle_private.a_strict_cases
   set last_auth_lease_id=v_lease,auth_fenced_at=null where account_id=p_account;
 end if;
 return pg_catalog.jsonb_build_object('account_id',p_account,'authorization_id',p_authorization,
   'case_ref',v_a.case_ref,'lease_id',v_lease,'phase',v_q.phase,
   'prior_auth_attempt',v_a.auth_attempt_at is not null);
end;
$lease$;
revoke all on function public.a_strict_claim(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.a_strict_claim(uuid,uuid,text) to service_role;

create function public.a_strict_fence(
 p_account uuid,p_authorization uuid,p_lease uuid
) returns boolean language plpgsql security definer set search_path='' as $fence$
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 if not exists(select 1 from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account and a.last_auth_lease_id=p_lease
   and a.auth_attempt_at is null) then
  raise exception using errcode='42501',message='supervised lease mismatch or prior Auth attempt';
 end if;
 if public.check_deletion_auth_cleanup_billing_fence(p_account,p_lease) is not true then
  raise exception using errcode='55000',message='financial fence refused';
 end if;
 update research_lifecycle_private.a_strict_cases set auth_fenced_at=pg_catalog.clock_timestamp()
 where account_id=p_account;
 return true;
end;
$fence$;
revoke all on function public.a_strict_fence(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.a_strict_fence(uuid,uuid,uuid) to service_role;

create function public.a_strict_mark_auth_attempt(
 p_account uuid,p_authorization uuid,p_lease uuid
) returns boolean language plpgsql security definer set search_path='' as $mark$
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 update research_lifecycle_private.a_strict_cases a
 set auth_attempt_at=pg_catalog.clock_timestamp()
 where a.account_id=p_account and a.last_auth_lease_id=p_lease
  and a.auth_attempt_at is null and a.auth_fenced_at is not null
  and exists (select 1 from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account and q.lease_id=p_lease
      and q.phase='auth_pending' and q.next_attempt_at>pg_catalog.clock_timestamp())
  and pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))=0
  and not exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
       where i.account_id=p_account and i.status='open');
 if not found then raise exception using errcode='42501',message='Auth attempt denied'; end if;
 return true;
end;
$mark$;
revoke all on function public.a_strict_mark_auth_attempt(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_mark_auth_attempt(uuid,uuid,uuid) to service_role;

-- Caller must independently perform authenticated Admin GET. SQL cannot
-- attest an external Auth outcome. A GET error MUST leave this phase held.
create function public.a_strict_record_auth_observed(
 p_account uuid,p_authorization uuid,p_lease uuid
) returns jsonb language plpgsql security definer set search_path='' as $obs$
declare v_a research_lifecycle_private.a_strict_cases;
        v_q research_lifecycle_private.deletion_auth_cleanup;
        v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 if v_a.auth_attempt_at is null or v_a.last_auth_lease_id is distinct from p_lease
    or v_q.lease_id is distinct from p_lease or v_q.next_attempt_at<=v_now
    or v_q.phase<>'auth_pending'
    or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
    or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
       where i.account_id=p_account and i.status='open') then
  raise exception using errcode='55000',message='Auth result cannot be confirmed';
 end if;
 update research_lifecycle_private.deletion_auth_cleanup
  set phase='auth_confirmed',auth_confirmed_at=coalesce(auth_confirmed_at,v_now),
      auth_retired_observed_at=coalesce(auth_retired_observed_at,v_now),
      lease_id=null,next_attempt_at=v_now
  where account_id=p_account;
 update research_lifecycle_private.a_strict_cases
  set auth_observed_at=coalesce(auth_observed_at,v_now),
      post_clearance_id=null,post_recorded_at=null where account_id=p_account;
 return pg_catalog.jsonb_build_object('account_id',p_account,'authorization_id',p_authorization,
 'phase','auth_confirmed','post_auth_merchant_verified',false);
end;
$obs$;
revoke all on function public.a_strict_record_auth_observed(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_record_auth_observed(uuid,uuid,uuid) to service_role;

-- Provider read is external, case-specific, owner-custodied and explicitly
-- attested; none of these booleans makes remote merchant behaviour atomic.
create function public.a_strict_owner_post_auth_clearance(
 p_account uuid,p_authorization uuid,p_clearance uuid,p_case text,
 p_all_pages boolean,p_no_future_charge boolean,p_pending_invoices_cleared boolean
) returns boolean language plpgsql security definer set search_path='' as $post$
declare v_a research_lifecycle_private.a_strict_cases;
        v_q research_lifecycle_private.deletion_auth_cleanup;
        v_c public.research_billing_clearances;
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 select c.* into v_c from public.research_billing_clearances c
  where c.id=p_clearance and c.account_id=p_account;
 if v_a.case_ref is distinct from p_case or v_q.phase<>'auth_confirmed'
    or v_a.auth_observed_at is null or v_c.id is null
    or v_c.verified_at<=v_a.auth_observed_at
    or v_c.verified_at>pg_catalog.clock_timestamp()
    or (v_q.financial_hold_at is not null and v_c.verified_at<=v_q.financial_hold_at)
    or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
    or p_all_pages is not true or p_no_future_charge is not true
    or p_pending_invoices_cleared is not true
    or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
    or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account and
         (i.status='open' or i.last_observed_at>=v_c.verified_at)) then
   raise exception using errcode='55000',message='post-Auth provider evidence rejected';
 end if;
 update research_lifecycle_private.a_strict_cases
  set post_clearance_id=p_clearance,post_recorded_at=pg_catalog.clock_timestamp()
  where account_id=p_account;
 return true;
end;
$post$;
revoke all on function public.a_strict_owner_post_auth_clearance(
 uuid,uuid,uuid,text,boolean,boolean,boolean)
 from public,anon,authenticated,service_role;

create function research_lifecycle_private.a_strict_barrier(
 p_account uuid,p_authorization uuid
) returns boolean language plpgsql security definer set search_path='' as $barrier$
declare v_a research_lifecycle_private.a_strict_cases;
        v_q research_lifecycle_private.deletion_auth_cleanup;
        v_c public.research_billing_clearances;
begin
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 select c.* into v_c from public.research_billing_clearances c
  where c.id=v_a.post_clearance_id and c.account_id=p_account;
 if v_q.phase<>'auth_confirmed' or v_a.auth_observed_at is null
   or v_a.post_recorded_at is null or v_c.id is null
   or v_c.verified_at<=v_a.auth_observed_at
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at)) then
  raise exception using errcode='55000',message='post-Auth financial completion barrier held';
 end if;
 return true;
end;
$barrier$;
revoke all on function research_lifecycle_private.a_strict_barrier(uuid,uuid)
 from public,anon,authenticated,service_role;

create function public.a_strict_confirm_release(
 p_account uuid,p_authorization uuid,p_lease uuid
) returns jsonb language plpgsql security definer set search_path='' as $confirm$
begin
 perform research_lifecycle_private.a_strict_barrier(p_account,p_authorization);
 if not exists(select 1 from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account and q.phase='auth_confirmed'
     and q.lease_id=p_lease and q.next_attempt_at>pg_catalog.clock_timestamp()) then
   raise exception using errcode='42501',message='completion lease invalid';
 end if;
 return public.confirm_deletion_auth_cleanup(p_account,p_lease);
end;
$confirm$;
revoke all on function public.a_strict_confirm_release(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_confirm_release(uuid,uuid,uuid) to service_role;

create function public.a_strict_finish_release(
 p_account uuid,p_authorization uuid,p_lease uuid,p_outbox uuid
) returns boolean language plpgsql security definer set search_path='' as $finish$
begin
 perform research_lifecycle_private.a_strict_barrier(p_account,p_authorization);
 if p_outbox is null or not exists(select 1 from public.notification_outbox o
 where o.id=p_outbox and o.message_id='account_deletion_completed'
  and o.business_object_type='account_deletion_request'
  and o.business_object_id=p_account::text and o.status='deletion_staged') then
   raise exception using errcode='55000',message='nondispatchable outbox receipt absent';
 end if;
 if public.finish_deletion_auth_cleanup(p_account,p_lease) is not true then
   raise exception using errcode='55000',message='final acknowledgement refused';
 end if;
 update research_lifecycle_private.a_strict_cases
   set completed_at=pg_catalog.clock_timestamp() where account_id=p_account;
 return true;
end;
$finish$;
revoke all on function public.a_strict_finish_release(uuid,uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_finish_release(uuid,uuid,uuid,uuid) to service_role;

-- Deliberately allowed after session expiration: restrictive-only action.
-- Never resuscitates an Auth identity, entitlement or profile.
create function public.a_strict_hold(
 p_account uuid,p_authorization uuid,p_lease uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $hold$
declare v_q research_lifecycle_private.deletion_auth_cleanup;
 v_a research_lifecycle_private.a_strict_cases;
 v_now timestamptz:=pg_catalog.clock_timestamp();v_class text;
begin
 if p_reason not in ('unknown_payment','late_signed_webhook','retried_payment',
   'auth_get_ambiguous','auth_delete_ambiguous','auth_not_retired',
   'prior_auth_attempt_ambiguous','auth_result_unknown','provider_ambiguous',
   'outbox_uncertain') then
  raise exception using errcode='22023',message='unrecognized supervised hold reason';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account and a.authorization_id=p_authorization for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or p_lease is null
   or (v_q.lease_id is distinct from p_lease and v_a.last_auth_lease_id is distinct from p_lease)
   or v_q.phase='email_enqueued' then
   raise exception using errcode='42501',message='hold account or prior lease not verified';
 end if;
 v_class:=case
  when v_q.phase='auth_confirmed' or v_q.auth_retired_observed_at is not null
    then 'auth_retired_financial_evidence'
  when v_q.financial_fence_passed_at is not null or v_a.auth_attempt_at is not null
    then 'auth_outcome_unknown_financial_evidence'
  else 'auth_intact_financial_evidence' end;
 if research_lifecycle_private.financial_hold_rank(v_q.financial_hold_class)
  > research_lifecycle_private.financial_hold_rank(v_class) then
   v_class:=v_q.financial_hold_class;
 end if;
 update research_lifecycle_private.deletion_auth_cleanup q set
   financial_hold_at=v_now,
   financial_hold_first_at=coalesce(q.financial_hold_first_at,v_now),
   financial_hold_class=v_class,lease_id=null,next_attempt_at=v_now,
   last_error_code='RESEARCH_A_STRICT_FINANCIAL_HOLD'
  where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a set
   latest_exception_at=v_now,post_clearance_id=null,post_recorded_at=null
 where a.account_id=p_account;
 insert into research_lifecycle_private.a_strict_exceptions
   (account_id,authorization_id,reason,recorded_at)
 values(p_account,p_authorization,p_reason,v_now);
 insert into research_lifecycle_private.deletion_auth_financial_hold_events
   (account_id,hold_class,computed_class,evidence_reasons,phase,auth_retired_observed,recorded_at)
 values(p_account,v_class,v_class,p_reason,v_q.phase,
  v_q.phase='auth_confirmed' or v_q.auth_retired_observed_at is not null,v_now);
 insert into research_lifecycle_private.deletion_billing_incidents as i
  (account_id,status,reason_codes,first_observed_at,last_observed_at)
 values(p_account,'open',array[p_reason],v_now,v_now)
 on conflict(account_id) do update set status='open',
  reason_codes=(select array(select distinct t.code from pg_catalog.unnest(
   i.reason_codes||excluded.reason_codes) t(code) order by t.code)),
  last_observed_at=v_now,observation_count=i.observation_count+1,
  resolution_reference=null,resolution_clearance_id=null,resolved_at=null;
 return pg_catalog.jsonb_build_object('account_id',p_account,
    'authorization_id',p_authorization,'status','open','persisted',true);
end;
$hold$;
revoke all on function public.a_strict_hold(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.a_strict_hold(uuid,uuid,uuid,text) to service_role;

-- The owner-only reconciliation decision is intentionally *not* implemented
-- in this first review overlay. A financial incident is permanently held
-- pending a separate D2/D4/D5 decision. No automatic resume after payment.
