-- D1 ISOLATED REVIEW ONLY. NEVER APPLY TO SUPABASE OR LIVE CUSTOMER DATA.
-- These names/signatures match actual-app #1123 259903e5 exactly.
-- This D1 fixture models a D2 proposal; grants are to FAKE review roles only.
-- Expects fixture public.profiles, public.subscriptions, public.entitlements,
-- public.subscription_offers and public.subscription_billing_interval precreated.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema research_checkout_guard;
revoke all on schema research_checkout_guard from public;
create role review_checkout_issuer login noinherit password 'only_synthetic_issuer';
create role review_checkout_verifier login noinherit password 'only_synthetic_verifier';
create role review_checkout_binder login noinherit password 'only_synthetic_binder';
create role anon nologin;
create role authenticated nologin;

-- Variant allowlist MUST be set from independently reviewed merchant config
-- by a privileged operator before any real deployment. CI uses fake IDs.
create table research_checkout_guard.allowed_variants(
 store_id text not null, product_id text not null,
 variant_id text not null, billing_interval text not null
   check (billing_interval in ('monthly','annual')),
 test_mode boolean not null,
 primary key (store_id, product_id, variant_id, test_mode)
);
create table research_checkout_guard.checkout_intents(
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 client_request_id text not null,
 store_id text not null, product_id text not null,
 variant_id text not null,
 billing_interval text not null check (billing_interval in ('monthly','annual')),
 test_mode boolean not null,
 checkout_proof_sha256 text not null unique check (checkout_proof_sha256 ~ '^[a-f0-9]{64}$'),
 state text not null default 'reserved' check(state in ('reserved','attached','consumed')),
 provider_checkout_id text,
 provider_subscription_id text,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 unique (account_id, client_request_id),
 check (expires_at > created_at and expires_at <= created_at + interval '30 minutes'),
 check (state = 'reserved' or provider_checkout_id is not null)
);
create unique index research_intent_provider_checkout_unique
 on research_checkout_guard.checkout_intents(test_mode,provider_checkout_id)
 where provider_checkout_id is not null;
create unique index research_intent_provider_sub_unique
 on research_checkout_guard.checkout_intents(provider_subscription_id)
 where provider_subscription_id is not null;

create table research_checkout_guard.signed_paid_observations(
 id uuid primary key default gen_random_uuid(),
 provider text not null check (provider = 'lemon-squeezy'),
 provider_subscription_id text not null,
 provider_customer_id text not null,
 store_id text not null, product_id text not null,
 provider_price_id text not null, test_mode boolean not null,
 occurred_at timestamptz not null,
 raw_body_sha256 text not null check(raw_body_sha256 ~ '^[a-f0-9]{64}$'),
 claimed_account_id uuid,
 claimed_checkout_proof_sha256 text
   check(claimed_checkout_proof_sha256 is null or
         claimed_checkout_proof_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 unique (provider,provider_subscription_id)
);
create table research_checkout_guard.conflict_evidence(
 id uuid primary key default gen_random_uuid(),
 paid_observation_id uuid not null references research_checkout_guard.signed_paid_observations(id),
 provider_subscription_id text not null,
 conflict_code text not null,
 raw_body_sha256 text not null check(raw_body_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz not null default clock_timestamp(),
 unique (paid_observation_id,conflict_code,raw_body_sha256)
);
-- No UPDATE/DELETE/TRUNCATE even by the fixture table owner. Privileged
-- schema owners can disable triggers; D2 must separately evaluate ownership.
create function research_checkout_guard.reject_evidence_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $fn$
begin
 raise exception 'signed-paid/conflict evidence is immutable' using errcode='42501';
end;
$fn$;
create trigger reject_paid_update_delete
 before update or delete on research_checkout_guard.signed_paid_observations
 for each row execute function research_checkout_guard.reject_evidence_mutation();
create trigger reject_paid_truncate
 before truncate on research_checkout_guard.signed_paid_observations
 for each statement execute function research_checkout_guard.reject_evidence_mutation();
create trigger reject_conflict_update_delete
 before update or delete on research_checkout_guard.conflict_evidence
 for each row execute function research_checkout_guard.reject_evidence_mutation();
create trigger reject_conflict_truncate
 before truncate on research_checkout_guard.conflict_evidence
 for each statement execute function research_checkout_guard.reject_evidence_mutation();

-- A separately committed binding conflict journal. Caller must not RAISE
-- after invoking it; a failed binding transaction could roll this back.
create function research_checkout_guard.hold_binding_conflict(
 p_observation_id uuid, p_code text, p_sha text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid; v_sub text;
begin
 select provider_subscription_id into v_sub
 from research_checkout_guard.signed_paid_observations where id=p_observation_id;
 if v_sub is null then raise exception 'unrecognized paid observation'; end if;
 insert into research_checkout_guard.conflict_evidence(
   paid_observation_id,provider_subscription_id,conflict_code,raw_body_sha256
 ) values (p_observation_id,v_sub,p_code,p_sha)
 on conflict (paid_observation_id,conflict_code,raw_body_sha256) do nothing
 returning id into v_id;
 if v_id is null then
   select id into v_id from research_checkout_guard.conflict_evidence
    where paid_observation_id=p_observation_id and conflict_code=p_code
     and raw_body_sha256=p_sha;
 end if;
 return jsonb_build_object('action','conflict','code',p_code,
        'conflict_evidence_id',v_id,'raw_body_sha256',p_sha);
end;
$fn$;

create function public.issue_research_membership_checkout_intent(
 p_account_id uuid, p_product_id text, p_store_id text,
 p_variant_id text, p_billing_interval text, p_test_mode boolean,
 p_client_request_id text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_now timestamptz:=clock_timestamp();
 v_proof text; v_id uuid;
begin
 if p_account_id is null or p_product_id <> 'research-membership'
    or p_store_id is null or p_variant_id is null
    or p_billing_interval not in ('monthly','annual')
    or p_test_mode is null or p_client_request_id is null
    or length(p_client_request_id) not between 8 and 255 then
   return jsonb_build_object('action','rejected','code','invalid_issuer_request');
 end if;
 -- Lock the independently authenticated account; serialize issuance against
 -- same-account checkout attempts. The issuer role is NOT browser-callable.
 perform 1 from public.profiles
 where account_id=p_account_id and status='active' for update;
 if not found then return jsonb_build_object('action','rejected','code','account_unavailable'); end if;
 if not exists(select 1 from research_checkout_guard.allowed_variants
   where store_id=p_store_id and product_id=p_product_id
     and variant_id=p_variant_id and billing_interval=p_billing_interval
     and test_mode=p_test_mode) then
   return jsonb_build_object('action','rejected','code','untrusted_catalog');
 end if;
 if exists(select 1 from public.subscriptions
      where account_id=p_account_id and product_id=p_product_id)
    or exists(select 1 from public.entitlements
      where account_id=p_account_id and product_id=p_product_id and state='active') then
   return jsonb_build_object('action','rejected','code','already_subscribed_or_entitled');
 end if;
 -- No redisclosure of one-time proofs on client-request retries: safe
 -- 409/503 at app boundary rather than multiple potentially paid checkouts.
 if exists(select 1 from research_checkout_guard.checkout_intents
     where account_id=p_account_id and
       (client_request_id=p_client_request_id or
        (state in ('reserved','attached') and expires_at>v_now))) then
   return jsonb_build_object('action','rejected','code','existing_checkout_intent');
 end if;
 v_proof:=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
 insert into research_checkout_guard.checkout_intents(
   account_id,client_request_id,store_id,product_id,variant_id,
   billing_interval,test_mode,checkout_proof_sha256,created_at,expires_at)
 values (p_account_id,p_client_request_id,p_store_id,p_product_id,p_variant_id,
   p_billing_interval,p_test_mode,encode(sha256(convert_to(v_proof,'UTF8')),'hex'),
   v_now,v_now+interval '30 minutes') returning id into v_id;
 return jsonb_build_object(
   'action','reserved','intent_id',v_id,'checkout_key',v_proof,
   'account_id',p_account_id,'store_id',p_store_id,'variant_id',p_variant_id,
   'billing_interval',p_billing_interval,'test_mode',p_test_mode,
   'expires_at',v_now+interval '30 minutes');
end;
$fn$;

create function public.attach_research_membership_checkout_intent(
 p_intent_id uuid,p_checkout_proof text,p_provider_checkout_id text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_intent research_checkout_guard.checkout_intents%rowtype;
begin
 if p_intent_id is null or p_checkout_proof !~ '^[A-Za-z0-9_-]{43}$'
    or p_provider_checkout_id is null or
       p_provider_checkout_id !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$' then
   return jsonb_build_object('action','rejected');
 end if;
 select * into v_intent from research_checkout_guard.checkout_intents
  where id=p_intent_id for update;
 if not found or v_intent.state<>'reserved'
    or v_intent.expires_at <= clock_timestamp()
    or v_intent.checkout_proof_sha256 <> encode(sha256(convert_to(p_checkout_proof,'UTF8')),'hex') then
   return jsonb_build_object('action','rejected');
 end if;
 update research_checkout_guard.checkout_intents set state='attached',
   provider_checkout_id=p_provider_checkout_id where id=p_intent_id;
 return jsonb_build_object('action','attached','intent_id',p_intent_id,
                           'provider_checkout_id',p_provider_checkout_id);
end;
$fn$;

create function public.observe_signed_research_subscription_created(
 p_provider text,p_provider_subscription_id text,p_provider_customer_id text,
 p_store_id text,p_product_id text,p_provider_price_id text,
 p_test_mode boolean,p_occurred_at timestamptz,p_raw_body_sha256 text,
 p_claimed_account_id uuid,p_claimed_checkout_proof_sha256 text
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_obs research_checkout_guard.signed_paid_observations%rowtype;
 v_changed boolean; v_disposition text;
begin
 -- Only a separate D2-approved trusted verifier may call this after
 -- raw-body HMAC + status/no-trial + catalog checks. SQL cannot verify HMAC.
 if p_provider<>'lemon-squeezy'
    or p_provider_subscription_id is null or length(p_provider_subscription_id) not between 1 and 255
    or p_provider_customer_id is null or btrim(p_provider_customer_id)=''
    or p_store_id is null or p_product_id<>'research-membership'
    or p_provider_price_id is null or p_occurred_at is null or p_test_mode is null
    or p_raw_body_sha256 !~ '^[a-f0-9]{64}$'
    or (p_claimed_checkout_proof_sha256 is not null and
        p_claimed_checkout_proof_sha256 !~ '^[a-f0-9]{64}$') then
   return jsonb_build_object('action','rejected');
 end if;
 if not exists(select 1 from research_checkout_guard.allowed_variants
  where store_id=p_store_id and product_id=p_product_id
   and variant_id=p_provider_price_id and test_mode=p_test_mode) then
   return jsonb_build_object('action','rejected');
 end if;
 -- Unique provider subscription ID is a logical event key for this one
 -- subscription_created flow; serialization is by DB unique index.
 insert into research_checkout_guard.signed_paid_observations(
  provider,provider_subscription_id,provider_customer_id,store_id,
  product_id,provider_price_id,test_mode,occurred_at,raw_body_sha256,
  claimed_account_id,claimed_checkout_proof_sha256)
 values(p_provider,p_provider_subscription_id,p_provider_customer_id,
  p_store_id,p_product_id,p_provider_price_id,p_test_mode,p_occurred_at,
  p_raw_body_sha256,p_claimed_account_id,p_claimed_checkout_proof_sha256)
 on conflict(provider,provider_subscription_id) do nothing
 returning * into v_obs;
 if found then
   return jsonb_build_object('action','recorded',
      'provider_subscription_id',p_provider_subscription_id,
      'raw_body_sha256',p_raw_body_sha256);
 end if;
 select * into v_obs from research_checkout_guard.signed_paid_observations
  where provider=p_provider and provider_subscription_id=p_provider_subscription_id
  for update;
 v_changed := v_obs.raw_body_sha256<>p_raw_body_sha256
   or v_obs.provider_customer_id is distinct from p_provider_customer_id
   or v_obs.store_id is distinct from p_store_id
   or v_obs.product_id is distinct from p_product_id
   or v_obs.provider_price_id is distinct from p_provider_price_id
   or v_obs.test_mode is distinct from p_test_mode
   or v_obs.claimed_account_id is distinct from p_claimed_account_id
   or v_obs.claimed_checkout_proof_sha256 is distinct from p_claimed_checkout_proof_sha256;
 if not v_changed then
   return jsonb_build_object('action','already_recorded',
      'provider_subscription_id',p_provider_subscription_id,
      'raw_body_sha256',p_raw_body_sha256);
 end if;
 -- Separate append-only conflicting evidence; no update to first signed fact.
 insert into research_checkout_guard.conflict_evidence(
    paid_observation_id,provider_subscription_id,conflict_code,raw_body_sha256)
 values(v_obs.id,p_provider_subscription_id,'signed_paid_identity_conflict',p_raw_body_sha256)
 on conflict (paid_observation_id,conflict_code,raw_body_sha256) do nothing;
 return jsonb_build_object('action','conflict_recorded',
    'provider_subscription_id',p_provider_subscription_id,
    'raw_body_sha256',p_raw_body_sha256);
end;
$fn$;

create function public.bind_research_membership_with_checkout_intent(
 p_account_id uuid,p_provider text,p_provider_subscription_id text,
 p_provider_customer_id text,p_provider_price_id text,
 p_billing_interval text,p_occurred_at timestamptz,
 p_checkout_proof text,p_raw_body_sha256 text,p_store_id text,
 p_product_id text,p_test_mode boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_obs research_checkout_guard.signed_paid_observations%rowtype;
 v_intent research_checkout_guard.checkout_intents%rowtype;
 v_existing public.subscriptions%rowtype;
 v_created uuid; v_hash text;
begin
 if p_account_id is null or p_provider<>'lemon-squeezy' or
    p_provider_subscription_id is null or p_provider_customer_id is null or
    p_provider_price_id is null or p_billing_interval not in ('monthly','annual')
    or p_occurred_at is null or p_checkout_proof !~ '^[A-Za-z0-9_-]{43}$'
    or p_raw_body_sha256 !~ '^[a-f0-9]{64}$' or p_store_id is null
    or p_product_id<>'research-membership' or p_test_mode is null then
    return jsonb_build_object('action','rejected');
 end if;
 select * into v_obs from research_checkout_guard.signed_paid_observations
  where provider=p_provider and provider_subscription_id=p_provider_subscription_id
  for update;
 if not found or v_obs.raw_body_sha256<>p_raw_body_sha256 then
   return jsonb_build_object('action','unverified_paid_evidence');
 end if;
 -- A signed/committed provider fact cannot authenticate an account by itself.
 -- These claims must all match a separately issued private intent.
 if v_obs.claimed_account_id is distinct from p_account_id
    or v_obs.claimed_checkout_proof_sha256 is distinct from
         encode(sha256(convert_to(p_checkout_proof,'UTF8')),'hex') then
   return research_checkout_guard.hold_binding_conflict(
       v_obs.id,'unissued_checkout_key',v_obs.raw_body_sha256);
 end if;
 if v_obs.provider_customer_id<>p_provider_customer_id or
    v_obs.provider_price_id<>p_provider_price_id or
    v_obs.store_id<>p_store_id or v_obs.product_id<>p_product_id or
    v_obs.test_mode<>p_test_mode then
   return research_checkout_guard.hold_binding_conflict(
       v_obs.id,'provider_subscription_account_mismatch',v_obs.raw_body_sha256);
 end if;
 -- Account serialization prevents two distinct paid subscriptions binding.
 perform 1 from public.profiles where account_id=p_account_id
   and status='active' for update;
 if not found then return research_checkout_guard.hold_binding_conflict(
    v_obs.id,'account_unavailable',v_obs.raw_body_sha256); end if;
 v_hash:=encode(sha256(convert_to(p_checkout_proof,'UTF8')),'hex');
 select * into v_intent from research_checkout_guard.checkout_intents
  where account_id=p_account_id and checkout_proof_sha256=v_hash for update;
 if not found or v_intent.product_id<>p_product_id or
    v_intent.store_id<>p_store_id or v_intent.variant_id<>p_provider_price_id or
    v_intent.billing_interval<>p_billing_interval or
    v_intent.test_mode<>p_test_mode or v_intent.provider_checkout_id is null then
   return research_checkout_guard.hold_binding_conflict(
      v_obs.id,'unissued_checkout_key',v_obs.raw_body_sha256);
 end if;
 if v_intent.state='consumed' then
   select * into v_existing from public.subscriptions
    where provider=p_provider and provider_subscription_id=p_provider_subscription_id;
   if v_intent.provider_subscription_id=p_provider_subscription_id
       and v_existing.account_id=p_account_id and
       v_existing.provider_customer_id=p_provider_customer_id
       and v_existing.provider_price_id=p_provider_price_id
       and v_existing.state not in ('cancelled','refunded','disputed','charged_back') then
     return jsonb_build_object('action','existing','subscription_id',v_existing.id,
       'subscription_state',v_existing.state,'raw_body_sha256',p_raw_body_sha256);
   end if;
   return research_checkout_guard.hold_binding_conflict(
     v_obs.id,'checkout_consumed_by_other',v_obs.raw_body_sha256);
 end if;
 if v_intent.state<>'attached' or v_intent.expires_at<=clock_timestamp() then
   return research_checkout_guard.hold_binding_conflict(
     v_obs.id,'expired_checkout_key',v_obs.raw_body_sha256);
 end if;
 if p_occurred_at < v_intent.created_at-interval '5 minutes' or
    p_occurred_at>clock_timestamp()+interval '5 minutes' then
   return research_checkout_guard.hold_binding_conflict(
      v_obs.id,'expired_checkout_key',v_obs.raw_body_sha256);
 end if;
 select * into v_existing from public.subscriptions
   where provider=p_provider and provider_subscription_id=p_provider_subscription_id;
 if found then
   return research_checkout_guard.hold_binding_conflict(
      v_obs.id,'provider_subscription_in_use',v_obs.raw_body_sha256);
 end if;
 if exists(select 1 from public.subscriptions
     where account_id=p_account_id and product_id=p_product_id) then
   return research_checkout_guard.hold_binding_conflict(
      v_obs.id,'duplicate_paid_subscription',v_obs.raw_body_sha256);
 end if;
 if exists(select 1 from public.entitlements
      where account_id=p_account_id and product_id=p_product_id) then
   return research_checkout_guard.hold_binding_conflict(
      v_obs.id,'entitlement_conflict',v_obs.raw_body_sha256);
 end if;
 -- Pending row only; NO entitlement writes. Signed lifecycle processing
 -- remains a separate, independently reviewed state transition operation.
 insert into public.subscriptions(
  account_id,product_id,provider,provider_subscription_id,
  provider_customer_id,provider_price_id,billing_interval,state,metadata,
  created_at,updated_at)
 values(p_account_id,p_product_id,p_provider,p_provider_subscription_id,
  p_provider_customer_id,p_provider_price_id,
  p_billing_interval::public.subscription_billing_interval,
  'pending','{}'::jsonb,p_occurred_at,p_occurred_at)
 returning id into v_created;
 update research_checkout_guard.checkout_intents
  set state='consumed',provider_subscription_id=p_provider_subscription_id,
      consumed_at=clock_timestamp() where id=v_intent.id;
 return jsonb_build_object('action','created','subscription_id',v_created,
   'subscription_state','pending','raw_body_sha256',p_raw_body_sha256);
end;
$fn$;

-- D1 FAKE ROLE GRANTS ONLY, not production service-role permission.
revoke all on function public.issue_research_membership_checkout_intent(
 uuid,text,text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function public.attach_research_membership_checkout_intent(
 uuid,text,text) from public,anon,authenticated;
revoke all on function public.observe_signed_research_subscription_created(
 text,text,text,text,text,text,boolean,timestamptz,text,uuid,text)
 from public,anon,authenticated;
revoke all on function public.bind_research_membership_with_checkout_intent(
 uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean)
 from public,anon,authenticated;
revoke all on function research_checkout_guard.hold_binding_conflict(uuid,text,text)
 from public,anon,authenticated;
revoke all on function research_checkout_guard.reject_evidence_mutation()
 from public,anon,authenticated;
grant execute on function public.issue_research_membership_checkout_intent(
 uuid,text,text,text,text,boolean,text) to review_checkout_issuer;
grant execute on function public.attach_research_membership_checkout_intent(
 uuid,text,text) to review_checkout_issuer;
grant execute on function public.observe_signed_research_subscription_created(
 text,text,text,text,text,text,boolean,timestamptz,text,uuid,text)
 to review_checkout_verifier;
grant execute on function public.bind_research_membership_with_checkout_intent(
 uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean)
 to review_checkout_binder;
-- Public schema is exposed in Supabase by default; role-specific EXECUTE,
-- issuer session validation, private writer custody and D2 actual grants
-- all require owner approval before a real migration can be authored.
commit;
