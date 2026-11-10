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

-- Evidence is OWNER-ATTESTED, NOT cryptographically verified provider cessation.
-- Only digests/opaque references; never store email, invoice links or raw IDs.
-- This is a private append-only capsule linking a canonical live Research
-- merchant scope, one account+case and exact clearance/read-observation time.
create table research_lifecycle_private.a_strict_merchant_receipts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check (case_ref ~ '^p1-[0-9a-f]{12,40}$'),
  clearance_id uuid not null unique references public.research_billing_clearances(id),
  stage text not null check (stage in ('pre_auth','post_auth')),
  merchant_store_id text not null check (merchant_store_id ~ '^[0-9]{1,20}$'),
  product_key text not null check (product_key='research-membership'),
  merchant_mode text not null check (merchant_mode='live'),
  customer_scope_digest text not null check(customer_scope_digest ~ '^[0-9a-f]{64}$'),
  inventory_digest text not null check(inventory_digest ~ '^[0-9a-f]{64}$'),
  receipt_digest text not null check(receipt_digest ~ '^[0-9a-f]{64}$'),
  subscription_pages integer not null check(subscription_pages between 1 and 10000),
  invoice_pages integer not null check(invoice_pages between 1 and 10000),
  order_pages integer not null check(order_pages between 1 and 10000),
  checkout_pages integer not null check(checkout_pages between 1 and 10000),
  read_observed_at timestamptz not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,clearance_id,stage)
);
alter table research_lifecycle_private.a_strict_merchant_receipts enable row level security;
alter table research_lifecycle_private.a_strict_merchant_receipts force row level security;
revoke all on research_lifecycle_private.a_strict_merchant_receipts from public,anon,authenticated,service_role;
create trigger a_strict_merchant_receipts_append_only before update or delete
 on research_lifecycle_private.a_strict_merchant_receipts
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_merchant_receipts_no_truncate before truncate
 on research_lifecycle_private.a_strict_merchant_receipts
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- p_evidence is a STRICT allowlist, not a free-text evidence blob:
-- store_id, product_key, mode, customer_scope_digest, inventory_digest,
-- receipt_digest, read_observed_at, subscription_pages, invoice_pages,
-- order_pages, checkout_pages and 5 boolean coverage checks. A missing
-- provider page, unsettled invoice, open checkout or unknown state is HOLD.
-- This function NEVER calls the merchant and can never verify owner truth.
create function public.a_strict_owner_record_merchant_receipt(
 p_account uuid,p_case text,p_clearance uuid,p_stage text,p_evidence jsonb
) returns uuid language plpgsql security definer set search_path='' as $merchant$
declare
 v_clearance public.research_billing_clearances;
 v_case research_lifecycle_private.a_strict_cases;
 v_id uuid;
 v_observed timestamptz;
 v_pages text;
 v_key text;
 v_allowed text[] := array[
  'store_id','product_key','mode','customer_scope_digest',
  'inventory_digest','receipt_digest','read_observed_at',
  'subscription_pages','invoice_pages','order_pages','checkout_pages',
  'subscriptions_terminal','invoices_settled','checkout_closed',
  'no_retries','no_unknown_provider_objects'
 ];
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
    or p_stage not in ('pre_auth','post_auth')
    or pg_catalog.jsonb_typeof(p_evidence) is distinct from 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_evidence) as t(key))<>16
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_evidence) as t(key)
      where not (t.key=any(v_allowed)))
    or p_evidence->>'store_id' !~ '^[0-9]{1,20}$'
    or p_evidence->>'product_key' is distinct from 'research-membership'
    or p_evidence->>'mode' is distinct from 'live'
    or p_evidence->>'customer_scope_digest' !~ '^[0-9a-f]{64}$'
    or p_evidence->>'inventory_digest' !~ '^[0-9a-f]{64}$'
    or p_evidence->>'receipt_digest' !~ '^[0-9a-f]{64}$'
    or p_evidence->>'read_observed_at' is null
    or p_evidence->'subscriptions_terminal' is distinct from 'true'::jsonb
    or p_evidence->'invoices_settled' is distinct from 'true'::jsonb
    or p_evidence->'checkout_closed' is distinct from 'true'::jsonb
    or p_evidence->'no_retries' is distinct from 'true'::jsonb
    or p_evidence->'no_unknown_provider_objects' is distinct from 'true'::jsonb then
   raise exception using errcode='55000',message='merchant attestation incomplete or unsafe';
 end if;
 foreach v_key in array array['subscription_pages','invoice_pages','order_pages','checkout_pages'] loop
   v_pages:=p_evidence->>v_key;
   if v_pages is null or v_pages !~ '^[1-9][0-9]{0,3}$' then
     raise exception using errcode='55000',message='merchant page inventory incomplete';
   end if;
 end loop;
 begin
  v_observed:=(p_evidence->>'read_observed_at')::timestamptz;
 exception when others then
  raise exception using errcode='55000',message='merchant observation timestamp malformed';
 end;
 select c.* into v_clearance from public.research_billing_clearances c
   where c.id=p_clearance and c.account_id=p_account;
 if not found or v_clearance.verification_reference !~ '^p1-[a-z0-9-]{12,80}$'
   or v_clearance.verified_at is distinct from v_observed
   or v_observed>pg_catalog.clock_timestamp()
   or v_observed<pg_catalog.clock_timestamp()-interval '15 minutes' then
  raise exception using errcode='55000',message='merchant observation lacks current opaque clearance';
 end if;
 select a.* into v_case from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 if p_stage='post_auth' and (
   v_case.account_id is null or v_case.case_ref<>p_case
   or v_case.auth_observed_at is null or v_observed<=v_case.auth_observed_at
 ) then
   raise exception using errcode='55000',message='post-Auth evidence not account/case bound';
 end if;
 insert into research_lifecycle_private.a_strict_merchant_receipts (
  account_id,case_ref,clearance_id,stage,merchant_store_id,product_key,
  merchant_mode,customer_scope_digest,inventory_digest,receipt_digest,
  subscription_pages,invoice_pages,order_pages,checkout_pages,read_observed_at
 ) values (
  p_account,p_case,p_clearance,p_stage,p_evidence->>'store_id',
  p_evidence->>'product_key',p_evidence->>'mode',
  p_evidence->>'customer_scope_digest',p_evidence->>'inventory_digest',
  p_evidence->>'receipt_digest',
  (p_evidence->>'subscription_pages')::integer,
  (p_evidence->>'invoice_pages')::integer,
  (p_evidence->>'order_pages')::integer,
  (p_evidence->>'checkout_pages')::integer,v_observed
 ) returning id into v_id;
 return v_id;
end;
$merchant$;
revoke all on function public.a_strict_owner_record_merchant_receipt(uuid,text,uuid,text,jsonb)
 from public,anon,authenticated,service_role;

-- Immutable receipt predicate. Pre/post reads must retain the same live
-- merchant store, Research product and canonical customer scope digest.
-- Never mistake a fresh generic clearance row for provider inventory.
create function research_lifecycle_private.a_strict_receipt_valid(
 p_account uuid,p_case text,p_clearance uuid,p_stage text,p_pre_scope_clearance uuid
) returns boolean language sql security definer set search_path='' as $receipt_valid$
 select exists (
   select 1
   from research_lifecycle_private.a_strict_merchant_receipts r
   join public.research_billing_clearances c
     on c.id=r.clearance_id and c.account_id=r.account_id
   join research_lifecycle_private.a_strict_merchant_receipts r0
     on r0.clearance_id=p_pre_scope_clearance
     and r0.account_id=r.account_id and r0.case_ref=r.case_ref
     and r0.stage='pre_auth'
   where r.account_id=p_account and r.case_ref=p_case
     and r.clearance_id=p_clearance and r.stage=p_stage
     and r.read_observed_at=c.verified_at
     and r.read_observed_at<=pg_catalog.clock_timestamp()
     and r.read_observed_at>=pg_catalog.clock_timestamp()-interval '15 minutes'
     and r.merchant_store_id=r0.merchant_store_id
     and r.product_key=r0.product_key
     and r.merchant_mode=r0.merchant_mode
     and r.customer_scope_digest=r0.customer_scope_digest
 );
$receipt_valid$;
revoke all on function research_lifecycle_private.a_strict_receipt_valid(uuid,text,uuid,text,uuid)
 from public,anon,authenticated,service_role;

-- D1 owner custody: no web/service_role can execute database Phase A,
-- authorize an Auth DELETE intent or attest a successful Admin GET. These
-- steps require the SQL owner in a deliberately supervised session; the
-- synthetic JS module is not wired to such an owner connection.
-- A fresh merchant attestation must not silently extinguish a still-valid
-- locally known Research paid/complimentary period. This HOLD is independent
-- of billing_hold_reasons() clearing stale local events via later clearances.
-- Do not touch Library Pass or rewrite any historic subscription/entitlement.
create function research_lifecycle_private.a_strict_unsettled_rights(p_account uuid)
returns boolean language sql security definer set search_path='' as $rights$
 select exists (
   select 1 from public.entitlements e
   where e.account_id=p_account and e.product_id='research-membership'
     and e.state::text not in ('account_deleted','revoked')
     and (e.ends_at is null or e.ends_at>pg_catalog.clock_timestamp())
 ) or exists (
   select 1 from public.subscriptions s
   where s.account_id=p_account and s.product_id='research-membership'
     and s.state::text not in ('expired','refunded','chargeback')
 );
$rights$;
revoke all on function research_lifecycle_private.a_strict_unsettled_rights(uuid)
 from public,anon,authenticated,service_role;

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
          and c.verified_at>=v_now-interval '15 minutes'
    )
    or not research_lifecycle_private.a_strict_receipt_valid(
        p_account,p_case,p_clearance,'pre_auth',p_clearance) then
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
 if pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
    or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
   raise exception using errcode='55000',message='financial hold or unexpired Research rights before supervision';
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

-- Owner-only capability rotation, never automatic: a quiet period may outlive
-- a one-hour supervised session. Preserve Auth attempt, financial hold, Phase A
-- and case identity; invalidate the old opaque token and earlier post-Auth
-- evidence. Nothing here resolves incidents or authorizes another Auth DELETE.
create function public.a_strict_owner_rotate(
 p_account uuid,p_case text,p_clearance uuid,p_owner text,p_expires timestamptz
) returns uuid language plpgsql security definer set search_path='' as $rotate$
declare v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_now timestamptz:=pg_catalog.clock_timestamp();v_new uuid;
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
  or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120
  or p_expires is null or p_expires<=v_now or p_expires>v_now+interval '1 hour' then
   raise exception using errcode='55000',message='owner renewal parameters invalid';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 if v_a.account_id is null or v_a.case_ref<>p_case
   or v_a.completed_at is not null
   or (v_q.account_id is not null and v_q.lease_id is not null
       and v_q.next_attempt_at>v_now)
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account and i.status='open')
   or (v_q.financial_hold_at is not null and (v_a.reconciled_hold_at is null
      or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or not exists(select 1 from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account
        and c.verified_at>v_a.authorized_at
        and c.verified_at<=v_now and c.verified_at>=v_now-interval '15 minutes')
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,p_case,p_clearance,'pre_auth',v_a.pre_clearance_id) then
  raise exception using errcode='55000',message='supervised case requires new owner reconciliation';
 end if;
 update research_lifecycle_private.a_strict_cases a set
  authorization_id=pg_catalog.gen_random_uuid(),
  owner_ref=p_owner,pre_clearance_id=p_clearance,
  authorized_at=v_now,expires_at=p_expires,
  post_clearance_id=null,post_recorded_at=null
  where a.account_id=p_account returning authorization_id into v_new;
 return v_new;
end;
$rotate$;
revoke all on function public.a_strict_owner_rotate(uuid,text,uuid,text,timestamptz)
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
 -- Recheck under the profile lock before the irreversible SQL finalizer:
 -- cancellation in grace or newly created paid rights cannot be overwritten.
 if research_lifecycle_private.a_strict_unsettled_rights(p_account) then
   raise exception using errcode='55000',message='Research paid period or historical right requires owner remedy';
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
 -- D3 15-minute *proposal* in this uninstalled overlay, NOT owner acceptance.
 -- Parent #1164 still admits 24h; test the stricter pre-Auth bound here.
 if not exists (
    select 1 from public.research_billing_clearances c
    join research_lifecycle_private.a_strict_cases a on a.account_id=c.account_id
    join research_lifecycle_private.deletion_auth_cleanup q on q.account_id=a.account_id
    where a.account_id=p_account and a.authorization_id=p_authorization
      and c.verified_at>=a.phase_a_at
      and c.verified_at>=pg_catalog.clock_timestamp()-interval '15 minutes'
      and c.verified_at<=pg_catalog.clock_timestamp()
      and (q.financial_hold_at is null or c.verified_at>q.financial_hold_at)
      and research_lifecycle_private.a_strict_receipt_valid(
          p_account,a.case_ref,c.id,'pre_auth',a.pre_clearance_id)
 ) then
    raise exception using errcode='55000',message='A-strict D3 pre-Auth clearance stale';
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
  -- Do not re-use a previously passed fence when 15 minutes have elapsed.
  and exists (select 1 from public.research_billing_clearances c
      where c.account_id=p_account
        and c.verified_at>=a.phase_a_at
        and c.verified_at>=pg_catalog.clock_timestamp()-interval '15 minutes'
        and c.verified_at<=pg_catalog.clock_timestamp()
        and research_lifecycle_private.a_strict_receipt_valid(
          p_account,a.case_ref,c.id,'pre_auth',a.pre_clearance_id))
  and not exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
       where i.account_id=p_account and i.status='open');
 if not found then raise exception using errcode='42501',message='Auth attempt denied'; end if;
 return true;
end;
$mark$;
revoke all on function public.a_strict_mark_auth_attempt(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;

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
    or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
    or (v_q.financial_hold_at is not null and v_c.verified_at<=v_q.financial_hold_at)
    or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
    or p_all_pages is not true or p_no_future_charge is not true
    or p_pending_invoices_cleared is not true
    or not research_lifecycle_private.a_strict_receipt_valid(
        p_account,p_case,p_clearance,'post_auth',v_a.pre_clearance_id)
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


-- E3-5-outage supplemental owner-custodied financial delivery comparison.
-- These opaque entries remain owner ATTESTATIONS, not provider proof,
-- D2/D4 approval or an authorization to release Production deletion.
create table research_lifecycle_private.a_strict_delivery_reconciliations (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 case_ref text not null,
 post_clearance_id uuid not null references public.research_billing_clearances(id) on delete restrict,
 reconciliation_ref text not null unique check(reconciliation_ref ~ '^p1-[a-z0-9-]{12,80}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or not exists (
     select 1 from research_lifecycle_private.a_strict_delivery_reconciliations d
      join research_lifecycle_private.a_strict_merchant_receipts r
       on r.clearance_id=d.post_clearance_id and r.account_id=d.account_id
     where d.account_id=p_account and d.case_ref=v_a.case_ref
       and d.post_clearance_id=v_a.post_clearance_id
       and d.merchant_receipt_digest=r.receipt_digest
       and d.provider_only_count=0 and d.unresolved_transport_count=0
       and d.provider_count=d.database_count
       and d.observed_at>=r.read_observed_at
       and d.observed_at>=pg_catalog.clock_timestamp()-interval '15 minutes'
       and d.database_count=(
         select count(*) from public.subscription_events e
         where e.account_id=p_account and e.product_id='research-membership'
          and e.actor_type='provider_webhook' and e.created_at>=v_a.phase_a_at
       )
   )
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';
),
 provider_count bigint not null check(provider_count>=0),
 database_count bigint not null check(database_count>=0),
 provider_only_count bigint not null check(provider_only_count>=0),
 unresolved_transport_count bigint not null check(unresolved_transport_count>=0),
 delivery_audit_digest text not null check(delivery_audit_digest ~ '^[0-9a-f]{64}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';
),
 merchant_receipt_digest text not null check(merchant_receipt_digest ~ '^[0-9a-f]{64}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';
),
 observed_at timestamptz not null,
 recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
 actor_session_role text not null,
 unique(account_id,post_clearance_id)
);
alter table research_lifecycle_private.a_strict_delivery_reconciliations enable row level security;
alter table research_lifecycle_private.a_strict_delivery_reconciliations force row level security;
revoke all on research_lifecycle_private.a_strict_delivery_reconciliations from public,anon,authenticated,service_role;
create trigger a_strict_delivery_reconciliation_append_only before update or delete
 on research_lifecycle_private.a_strict_delivery_reconciliations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_delivery_reconciliation_no_truncate before truncate
 on research_lifecycle_private.a_strict_delivery_reconciliations
 for each statement execute function research_lifecycle_private.reject_append_only_change();

create function public.a_strict_owner_record_delivery_reconciliation(
 p_account uuid,p_authorization uuid,p_clearance uuid,
 p_ref text,p_provider_count bigint,p_provider_only bigint,p_transport_unknown bigint,
 p_audit_digest text,p_receipt_digest text,p_observed_at timestamptz
) returns boolean language plpgsql security definer set search_path='' as $delivery$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_r research_lifecycle_private.a_strict_merchant_receipts;
 v_db_count bigint;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_authorization is null or p_clearance is null
    or p_ref is null or p_ref !~ '^p1-[a-z0-9-]{12,80}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';

    or p_audit_digest is null or p_audit_digest !~ '^[0-9a-f]{64}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';

    or p_receipt_digest is null or p_receipt_digest !~ '^[0-9a-f]{64}
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';

    or p_provider_count is null or p_provider_count<0
    or p_provider_only is null or p_provider_only<>0
    or p_transport_unknown is null or p_transport_unknown<>0
    or p_observed_at is null then
   raise exception using errcode='55000',message='unresolved signed delivery or transport gap';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 perform research_lifecycle_private.a_strict_assert(p_account,p_authorization);
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
   where r.account_id=p_account and r.clearance_id=p_clearance
    and r.case_ref=v_a.case_ref and r.stage='post_auth';
 if v_a.account_id is null or v_a.phase_a_at is null or v_a.auth_observed_at is null
    or v_a.post_recorded_at is null or v_a.post_clearance_id is distinct from p_clearance
    or v_r.id is null or v_r.receipt_digest is distinct from p_receipt_digest
    or p_observed_at<v_r.read_observed_at or p_observed_at<v_a.auth_observed_at
    or p_observed_at>v_now or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account and i.status='open') then
   raise exception using errcode='55000',message='delivery account/case/merchant read mismatch';
 end if;
 select count(*) into v_db_count from public.subscription_events e
   where e.account_id=p_account and e.product_id='research-membership'
    and e.actor_type='provider_webhook' and e.created_at>=v_a.phase_a_at;
 if p_provider_count is distinct from v_db_count then
   raise exception using errcode='55000',message='merchant deliveries differ from durable local custody';
 end if;
 insert into research_lifecycle_private.a_strict_delivery_reconciliations(
   account_id,case_ref,post_clearance_id,reconciliation_ref,provider_count,database_count,
   provider_only_count,unresolved_transport_count,delivery_audit_digest,
   merchant_receipt_digest,observed_at,actor_session_role
 ) values (
   p_account,v_a.case_ref,p_clearance,p_ref,p_provider_count,v_db_count,
   p_provider_only,p_transport_unknown,p_audit_digest,p_receipt_digest,p_observed_at,session_user
 );
 return true;
end;
$delivery$;
revoke all on function public.a_strict_owner_record_delivery_reconciliation(
 uuid,uuid,uuid,text,bigint,bigint,bigint,text,text,timestamptz)
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
   or v_c.verified_at<pg_catalog.clock_timestamp()-interval '15 minutes'
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,v_a.case_ref,v_a.post_clearance_id,'post_auth',v_a.pre_clearance_id)
   or (v_a.latest_exception_at is not null and v_c.verified_at<=v_a.latest_exception_at)
   or (v_q.financial_hold_at is not null and
      (v_c.verified_at<=v_q.financial_hold_at
       or v_a.reconciled_hold_at is null or v_a.reconciled_hold_at<v_q.financial_hold_at))
   or pg_catalog.cardinality(research_lifecycle_private.billing_hold_reasons(p_account))>0
   or exists(select 1 from research_lifecycle_private.deletion_billing_incidents i
      where i.account_id=p_account
        and (i.status='open' or i.last_observed_at>=v_c.verified_at
           or not exists(
             select 1 from research_lifecycle_private.a_strict_owner_resolutions d
             where d.account_id=i.account_id and d.case_ref=v_a.case_ref
               and d.disposition='resume'
               and d.incident_last_observed_at=i.last_observed_at
               and d.decision_ref=i.resolution_reference
               and d.clearance_id=i.resolution_clearance_id
           ))) then
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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$')
,
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$')
,
  disposition text not null check(disposition in ('resume','terminal_hold')),
  clearance_id uuid references public.research_billing_clearances(id),
  incident_last_observed_at timestamptz not null,
  financial_hold_at timestamptz,
  actor_session_role text not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(account_id,case_ref,incident_last_observed_at)
);
alter table research_lifecycle_private.a_strict_owner_resolutions enable row level security;
alter table research_lifecycle_private.a_strict_owner_resolutions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_resolutions
  from public,anon,authenticated,service_role;
create trigger a_strict_owner_resolutions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_resolutions
 for each row execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_resolutions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_resolutions
 for each statement execute function research_lifecycle_private.reject_append_only_change();

-- B1: deny legacy/source resolver status transition without an owner
-- ledger decision for the same case and incident generation.
create function research_lifecycle_private.a_strict_require_incident_decision()
returns trigger language plpgsql security definer set search_path='' as $incident_decision$
declare v_case text;
begin
  if new.status='resolved' and (
      old.status is distinct from new.status
      or old.resolution_reference is distinct from new.resolution_reference
      or old.resolution_clearance_id is distinct from new.resolution_clearance_id
    ) then
    select a.case_ref into v_case
      from research_lifecycle_private.a_strict_cases a
      where a.account_id=new.account_id;
    if found and not exists (
       select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=new.account_id and d.case_ref=v_case
         and d.incident_last_observed_at=old.last_observed_at
         and d.disposition='resume'
         and d.decision_ref=new.resolution_reference
         and d.clearance_id=new.resolution_clearance_id
    ) then
      raise exception using errcode='42501',
        message='supervised incident cannot resolve without owner D2/D4 decision';
    end if;
  end if;
  return new;
end;
$incident_decision$;
revoke all on function research_lifecycle_private.a_strict_require_incident_decision()
  from public,anon,authenticated,service_role;
create trigger a_strict_require_incident_decision
 before update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_require_incident_decision();

-- Owner SQL session ONLY. The worker, service_role and web client cannot call
-- this entry point. An owner-chosen terminal_hold is a non-destructive legal
-- record: it DOES NOT clear the incident, perform Auth deletion, mark privacy
-- complete, or cause an email. Resume only after an independently attested
-- post-incident merchant read and confirmed Auth retirement.
create function public.a_strict_owner_reconcile(
  p_account uuid,p_case text,p_clearance uuid,p_decision_ref text,
  p_d2_privacy_ref text,p_d4_remedy_ref text,p_disposition text
) returns text language plpgsql security definer set search_path='' as $reconcile$
declare
  v_a research_lifecycle_private.a_strict_cases;
  v_q research_lifecycle_private.deletion_auth_cleanup;
  v_i research_lifecycle_private.deletion_billing_incidents;
  v_r research_lifecycle_private.a_strict_merchant_receipts;
  v_c public.research_billing_clearances;
  v_existing research_lifecycle_private.a_strict_owner_resolutions;
  v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'

     or p_disposition not in ('resume','terminal_hold') then
    raise exception using errcode='22023',message='owner decision identifiers or disposition invalid';
  end if;
  -- Same order as restrictive hold: profile, case, queue, incident.
  perform 1 from public.profiles p where p.account_id=p_account for update;
  select a.* into v_a from research_lifecycle_private.a_strict_cases a
    where a.account_id=p_account for update;
  select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
    where q.account_id=p_account for update;
  select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
    where i.account_id=p_account for update;
  if v_a.account_id is null or v_q.account_id is null
     or v_i.account_id is null or v_a.case_ref<>p_case
     or v_a.phase_a_at is null or v_a.completed_at is not null then
    raise exception using errcode='55000',message='no reviewable supervised financial incident';
  end if;
  select d.* into v_existing from research_lifecycle_private.a_strict_owner_resolutions d
    where d.decision_ref=p_decision_ref for share;
  if found then
    if v_existing.account_id=p_account and v_existing.case_ref=p_case
      and v_existing.disposition=p_disposition
      and v_existing.clearance_id is not distinct from p_clearance
      and v_existing.d2_privacy_ref=p_d2_privacy_ref
      and v_existing.d4_remedy_ref=p_d4_remedy_ref
      and v_existing.incident_last_observed_at=v_i.last_observed_at
      and (p_disposition='terminal_hold' or v_i.status='resolved') then
      return p_disposition; -- idempotent same exact owner decision
    end if;
    raise exception using errcode='55000',message='conflicting or superseded owner decision';
  end if;
  if exists(select 1 from research_lifecycle_private.a_strict_owner_resolutions d
       where d.account_id=p_account and d.case_ref=p_case
         and d.incident_last_observed_at=v_i.last_observed_at) then
    raise exception using errcode='55000',message='incident generation already adjudicated';
  end if;
  if v_i.status<>'open' then
    raise exception using errcode='55000',message='incident is no longer open';
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  if p_disposition='resume' then
    if p_clearance is null
       or not (
         (v_q.phase='auth_confirmed' and v_a.auth_attempt_at is not null
            and v_a.auth_observed_at is not null)
         or (v_q.phase='auth_pending' and v_a.auth_attempt_at is null
            and v_a.auth_observed_at is null and exists(
              select 1 from auth.users u where u.id=p_account))
       )
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case
        and r.stage=case when v_q.phase='auth_pending' then 'pre_auth'
                         else 'post_auth' end for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or (v_q.phase='auth_confirmed'
            and v_r.read_observed_at<=v_a.auth_observed_at)
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,
          case when v_q.phase='auth_pending' then 'pre_auth'
               else 'post_auth' end,v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null,
          auth_fenced_at=case when v_q.phase='auth_pending' then null
                               else a.auth_fenced_at end,
          last_auth_lease_id=case when v_q.phase='auth_pending' then null
                                  else a.last_auth_lease_id end
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- Synthetic owner-only attestation: Auth is ALREADY absent despite open
-- financial incident. This NEVER issues or authorizes another DELETE.
create table research_lifecycle_private.a_strict_retirement_observations (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  case_ref text not null, observation_ref text not null unique,
  observed_at timestamptz not null, actor_session_role text not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp());
alter table research_lifecycle_private.a_strict_retirement_observations enable row level security;
alter table research_lifecycle_private.a_strict_retirement_observations force row level security;
revoke all on research_lifecycle_private.a_strict_retirement_observations
 from public,anon,authenticated,service_role;
create trigger a_strict_retirement_observations_append_only before update or delete
 on research_lifecycle_private.a_strict_retirement_observations
 for each row execute function research_lifecycle_private.reject_append_only_change();
create function public.a_strict_owner_attest_retired_under_incident(
 p_account uuid,p_case text,p_observation_ref text,p_observed_at timestamptz)
 returns boolean language plpgsql security definer set search_path='' as $retired_hold$
declare
 v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case is null or p_observation_ref is null
    or pg_catalog.left(p_observation_ref,3)<>'p1-'
    or pg_catalog.length(p_observation_ref) not between 16 and 90
    or p_observed_at is null then
   raise exception using errcode='22023',message='owner Auth observation reference required';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
   where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
   where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
   where i.account_id=p_account for update;
 if v_a.account_id is null or v_q.account_id is null or v_i.account_id is null
    or v_a.case_ref<>p_case or v_a.auth_attempt_at is null
    or v_a.auth_observed_at is not null or v_q.phase<>'auth_pending'
    or v_i.status<>'open' or p_observed_at<=v_i.last_observed_at
    or p_observed_at<=v_a.auth_attempt_at or p_observed_at>v_now
    or p_observed_at<v_now-interval '15 minutes'
    or exists(select 1 from auth.users u where u.id=p_account) then
   raise exception using errcode='55000',message='Auth retirement under incident unverified';
 end if;
 insert into research_lifecycle_private.a_strict_retirement_observations
   (account_id,case_ref,observation_ref,observed_at,actor_session_role)
 values(p_account,p_case,p_observation_ref,p_observed_at,session_user);
 update research_lifecycle_private.deletion_auth_cleanup q
 set phase='auth_confirmed',auth_confirmed_at=coalesce(q.auth_confirmed_at,v_now),
     auth_retired_observed_at=coalesce(q.auth_retired_observed_at,v_now),
     lease_id=null,next_attempt_at=v_now where q.account_id=p_account;
 update research_lifecycle_private.a_strict_cases a
 set auth_observed_at=coalesce(a.auth_observed_at,v_now),
     post_clearance_id=null,post_recorded_at=null where a.account_id=p_account;
 return true;
end;
$retired_hold$;
revoke all on function public.a_strict_owner_attest_retired_under_incident(
 uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.

-- P2 isolated Review overlay only: immutable identity for completion email.
-- The existing table-wide service_role grant is NOT changed by this overlay.
-- A future independently reviewed source migration must reconcile permissions
-- and all email-writer contracts before any hosted cutover.
create function research_lifecycle_private.a_strict_completion_identity_immutable()
returns trigger language plpgsql security definer set search_path='' as $immutable_outbox$
begin
  if old.message_id='account_deletion_completed'
     or new.message_id='account_deletion_completed' then
    if old.message_id is distinct from new.message_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.event_id is distinct from new.event_id
      or old.classification is distinct from new.classification
      or old.business_object_type is distinct from new.business_object_type
      or old.business_object_id is distinct from new.business_object_id
      or old.state_version is distinct from new.state_version
      or old.recipient_email_normalized is distinct from new.recipient_email_normalized
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
       or old.provider is distinct from new.provider
       or old.payload is distinct from new.payload
       or old.consent_required is distinct from new.consent_required
       or old.consent_record_id is distinct from new.consent_record_id
       or old.consent_purpose is distinct from new.consent_purpose
       or old.consent_checked_at is distinct from new.consent_checked_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode='42501',
        message='account deletion completion identity cannot change after insert';
    end if;
  end if;
  if old.message_id='account_deletion_completed'
     and old.status in ('delivered','terminal_failed','hard_bounced',
                        'complained','suppressed','cancelled')
     and old.status is distinct from new.status then
    raise exception using errcode='42501',
      message='terminal completion notification cannot be requeued';
  end if;
  return new;
end;
$immutable_outbox$;
revoke all on function research_lifecycle_private.a_strict_completion_identity_immutable()
  from public,anon,authenticated,service_role;
create trigger a_strict_completion_identity_immutable
 before update on public.notification_outbox
 for each row execute function
   research_lifecycle_private.a_strict_completion_identity_immutable();

-- P2 disposable-overlay privilege correction. Keep SELECT and INSERT; replace
-- the later table-wide service_role UPDATE with delivery-status columns only.
-- Do not copy into a live migration until all outbox writers are reconciled.
revoke update on table public.notification_outbox from service_role;
grant update (
  status,attempt_count,next_attempt_at,provider_message_ref,error_code,
  accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;

-- E3 #1103 source-proven invoice custody and applied-only chronology.
-- DISPOSABLE PG17 A-strict overlay ONLY; never run as hosted migration.
-- Preserves #1189 source semantics without moving/merging sibling branches.
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
  v_last_provider_at timestamptz;
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
  if p_metadata ? 'researchP1StaleHeld'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1OriginalToState'
     or p_metadata ? 'researchP1LatestAt' then
    raise exception using errcode='42501',
      message='Research event metadata cannot set internal custody markers';
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

  -- Only APPLIED provider transitions establish state chronology. Signed
  -- invoice receipts, stale holds and nonactive holds are financial evidence,
  -- not state mutations: including them would suppress a legitimate renewal
  -- or cancellation arriving after a same-second payment/refund receipt.
  -- Financial deletion holds independently include ALL event created_at rows.
  select max(ev.occurred_at) into v_last_provider_at
  from public.subscription_events ev
  where ev.subscription_id=p_subscription_id
    and ev.actor_type='provider_webhook'
    and ev.metadata ->> 'researchP1StaleHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1NonactiveHeld' is distinct from 'true'
    and ev.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true';
  if v_profile_status<>'deleted' and v_last_provider_at is not null
     and p_occurred_at<=v_last_provider_at then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1StaleHeld',true,
        'researchP1OriginalToState',p_to_state::text,
        'researchP1LatestAt',v_last_provider_at
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_stale','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
  end if;

  -- Valid signed positive events remain financial evidence after the account
  -- is no longer active. Never restore benefits; retain a non-applied event.
  -- Its INSERT created_at invalidates any older owner billing clearance.
  if v_profile_status <> 'active'
     and (p_to_state in ('pending','active','past_due','cancel_scheduled')
          or p_entitlement_state in ('active','suspended')) then
    insert into public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,metadata,occurred_at)
    values (
      p_event_key,p_subscription_id,v_subscription.account_id,'research-membership',
      p_expected_from_state,p_expected_from_state,p_reason,'provider_webhook',
      p_provider_event_id,
      p_metadata || pg_catalog.jsonb_build_object(
        'researchP1NonactiveHeld',true,
        'researchP1OriginalToState',p_to_state::text
      ),p_occurred_at
    );
    return pg_catalog.jsonb_build_object(
      'action','held_nonactive','subscription_id',p_subscription_id,
      'event_key',p_event_key
    );
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

-- Non-granting signed payment/refund receipt: 2xx only after durable row.
create or replace function public.record_research_signed_invoice_receipt(
  p_subscription_id uuid,
  p_event_key text,
  p_provider_event_id text,
  p_event_name text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $invoice$
declare
  v_account_id uuid;
  v_provider text;
  v_subscription public.subscriptions;
  v_existing public.subscription_events;
begin
  if p_subscription_id is null or p_occurred_at is null
     or p_event_name not in ('subscription_payment_success','subscription_payment_refunded')
     or p_event_key is null or char_length(p_event_key) not between 6 and 255
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 6 and 255
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
     or p_metadata ->> 'lemonEventName' is distinct from p_event_name
     or p_metadata ->> 'lemonDataType' is distinct from 'subscription-invoices'
     or p_metadata ->> 'replayFingerprintVersion' is distinct from '1'
     or coalesce(p_metadata ->> 'replayFingerprint','') !~ '^[0-9a-f]{64}$'
     or p_metadata ? 'researchP1InvoiceReceipt'
     or p_metadata ? 'researchP1NonactiveHeld'
     or p_metadata ? 'researchP1StaleHeld' then
    raise exception using errcode='22023',message='signed Research invoice receipt is invalid';
  end if;
  -- Proposal only; merchant clock-skew policy not approved for release.
  if p_occurred_at>pg_catalog.clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='Research invoice future timestamp invalid';
  end if;
  select s.account_id into v_account_id
    from public.subscriptions s where s.id=p_subscription_id;
  if not found then
    raise exception using errcode='P0002',message='Research invoice subscription is missing';
  end if;
  perform research_lifecycle_private.lock_account_profile(v_account_id);
  select s.* into v_subscription from public.subscriptions s
    where s.id=p_subscription_id for update;
  if not found or v_subscription.account_id is distinct from v_account_id
     or v_subscription.product_id<>'research-membership'
     or v_subscription.provider<>'lemon-squeezy' then
    raise exception using errcode='42501',message='signed Research invoice binding mismatch';
  end if;

  select e.* into v_existing
    from public.subscription_events e where e.event_key=p_event_key;
  if found then
    if v_existing.subscription_id<>p_subscription_id
       or v_existing.account_id<>v_account_id
       or v_existing.provider_event_id is distinct from p_provider_event_id
       or v_existing.reason is distinct from p_event_name
       or v_existing.metadata ->> 'researchP1InvoiceReceipt' is distinct from 'true'
       or v_existing.metadata ->> 'replayFingerprint' is distinct from p_metadata ->> 'replayFingerprint'
       or v_existing.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='Research invoice event key conflicts with stored evidence';
    end if;
    return pg_catalog.jsonb_build_object('action','duplicate','event_key',p_event_key);
  end if;

  -- Check exact existing-key conflicts first, then reject a new secondary key.
  if p_event_key is distinct from ('lemon-squeezy:' || p_provider_event_id) then
    raise exception using errcode='22023',message='invoice event key/provider ID mismatch';
  end if;
  insert into public.subscription_events(
    event_key,subscription_id,account_id,product_id,from_state,to_state,
    reason,actor_type,provider_event_id,metadata,occurred_at
  ) values (
    p_event_key,p_subscription_id,v_account_id,'research-membership',
    v_subscription.state,v_subscription.state,p_event_name,'provider_webhook',
    p_provider_event_id,
    p_metadata || pg_catalog.jsonb_build_object('researchP1InvoiceReceipt',true),
    p_occurred_at
  );
  return pg_catalog.jsonb_build_object('action','invoice_recorded','event_key',p_event_key);
end;
$invoice$;
revoke all on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.record_research_signed_invoice_receipt(
  uuid,text,text,text,timestamptz,jsonb) to service_role;

-- Synthetic-only uniqueness check; future release needs historical provider-ID audit.
create unique index a_strict_e3_invoice_provider_identity
  on public.subscription_events(provider_event_id)
  where product_id='research-membership'
    and actor_type='provider_webhook'
    and metadata->>'researchP1InvoiceReceipt'='true';
