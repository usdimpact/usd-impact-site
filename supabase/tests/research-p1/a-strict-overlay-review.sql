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

-- D2/D4/D5 owner decision is a proposal for disposable review only.
-- Decisions are append-only and case+incident-generation bound. This does not
-- prove remote merchant finality or create any permission for a live customer.
create table research_lifecycle_private.a_strict_owner_resolutions (
  decision_ref text primary key check(decision_ref ~ '^p1-[a-z0-9-]{12,80}
),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}
),
  d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}
),
  d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}
),
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
  if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}

     or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}

     or p_d2_privacy_ref !~ '^p1-[a-z0-9-]{12,80}

     or p_d4_remedy_ref !~ '^p1-[a-z0-9-]{12,80}

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
  if p_disposition='resume' then
    if p_clearance is null or v_q.phase<>'auth_confirmed'
       or v_a.auth_attempt_at is null or v_a.auth_observed_at is null
       or (v_q.lease_id is not null and v_q.next_attempt_at>v_now)
       or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
      raise exception using errcode='55000',message='Auth/rights/lease state forbids resumed deletion';
    end if;
    select c.* into v_c from public.research_billing_clearances c
      where c.id=p_clearance and c.account_id=p_account for share;
    select r.* into v_r from research_lifecycle_private.a_strict_merchant_receipts r
      where r.clearance_id=p_clearance and r.account_id=p_account
        and r.case_ref=p_case and r.stage='post_auth' for share;
    if v_c.id is null or v_r.id is null
       or v_r.read_observed_at is distinct from v_c.verified_at
       or v_r.read_observed_at<=v_i.last_observed_at
       or (v_q.financial_hold_at is not null
           and v_r.read_observed_at<=v_q.financial_hold_at)
       or v_r.read_observed_at<=v_a.auth_observed_at
       or v_r.read_observed_at>v_now
       or v_r.read_observed_at<v_now-interval '15 minutes'
       or not research_lifecycle_private.a_strict_receipt_valid(
         p_account,p_case,p_clearance,'post_auth',v_a.pre_clearance_id) then
      raise exception using errcode='55000',message='post-incident provider evidence invalid or stale';
    end if;
    if not public.resolve_research_deletion_billing_incident(
      p_account,p_clearance,p_decision_ref) then
      raise exception using errcode='55000',message='source incident resolver refused';
    end if;
    -- Sole writer to reconciled_hold_at. Never reset Auth DELETE intent.
    update research_lifecycle_private.a_strict_cases a
      set reconciled_hold_at=v_now,
          post_clearance_id=null,post_recorded_at=null
      where a.account_id=p_account;
  else
    -- A documented D2/D4 terminal decision still leaves financial/identity
    -- custody and the privacy request on HOLD for an external lawful response.
    if p_clearance is not null then
      raise exception using errcode='55000',message='terminal decision cannot certify merchant cessation';
    end if;
  end if;
  insert into research_lifecycle_private.a_strict_owner_resolutions
    (decision_ref,account_id,case_ref,d2_privacy_ref,d4_remedy_ref,
     disposition,clearance_id,incident_last_observed_at,financial_hold_at,
     actor_session_role)
  values(p_decision_ref,p_account,p_case,p_d2_privacy_ref,p_d4_remedy_ref,
    p_disposition,p_clearance,v_i.last_observed_at,v_q.financial_hold_at,
    session_user);
  return p_disposition;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile(
 uuid,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;

-- P1-A remains a separate HOLD: no reattempt gate is introduced here.
-- An Auth GET showing 'active' cannot prove the prior DELETE request is final.
-- All SQL above remains uninstalled, synthetic-only, and unapproved D2/D4/D5.
