-- DISPOSABLE PG17 REVIEW ONLY. NEVER INSTALL AS A CONNECTED SUPABASE MIGRATION.
-- Run only after historical Research migrations, Stage C, and Stage E isolated SQL.
-- The verifier is synthetic. No provider / settlement proof is established.
begin;
create schema research_ordering_stage_f;
revoke all on schema research_ordering_stage_f from public, anon, authenticated, service_role;
create table research_ordering_stage_f.verified_transition (
  event_key text primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  account_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  provider_subscription_id text not null,
  provider_customer_id text not null,
  store_id text not null,
  variant_id text not null,
  binding_fingerprint text not null check (binding_fingerprint ~ '^[0-9a-f]{64}$'),
  event_fingerprint text not null check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  source_type text not null check (source_type = 'subscriptions'),
  snapshot_object_at timestamptz not null,
  target_state public.subscription_state not null,
  target_period_start timestamptz not null,
  target_period_end timestamptz not null,
  expected_subscription_version bigint not null check (expected_subscription_version > 0),
  expected_entitlement_version bigint not null check (expected_entitlement_version > 0),
  provider_snapshot_version text not null check (length(provider_snapshot_version) between 1 and 160),
  created_at timestamptz not null default clock_timestamp(),
  constraint review_f_period_valid check (target_period_end > target_period_start)
);
create trigger review_f_witness_immutable before update or delete
on research_ordering_stage_f.verified_transition for each row
execute function research_ordering_stage_e.forbid_witness_change();
alter table research_ordering_stage_f.verified_transition enable row level security;
grant usage on schema research_ordering_stage_f to research_e_owner,research_e_gateway,research_e_verifier;
grant select on research_ordering_stage_f.verified_transition to research_e_owner;
grant insert on research_ordering_stage_f.verified_transition to research_e_verifier;
create policy review_f_witness_select on research_ordering_stage_f.verified_transition
for select to research_e_owner using (true);
create policy review_f_witness_insert on research_ordering_stage_f.verified_transition
for insert to research_e_verifier with check (true);

-- Lock subscription first, then entitlement, to atomically compare database
-- versions with the full verified target before invoking the Stage C oracle.
-- A provider API GET is not an atomic database witness; this is only a
-- synthetic version-fence candidate, not a proof of source freshness.
create function research_ordering_stage_f.apply_strict_review(
 p_subscription_id uuid, p_account_id uuid, p_provider text,
 p_provider_subscription_id text, p_provider_customer_id text,
 p_store_id text, p_variant_id text, p_binding_fingerprint text,
 p_event_key text, p_provider_event_id text, p_fingerprint text,
 p_source_type text, p_occurred_at timestamptz,
 p_next_state public.subscription_state,
 p_next_period_start timestamptz, p_next_period_end timestamptz
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_sub public.subscriptions%rowtype;
 v_ent public.entitlements%rowtype;
 v_wit research_ordering_stage_f.verified_transition%rowtype;
 v_duplicate boolean;
begin
 select * into strict v_sub from public.subscriptions
   where id=p_subscription_id for update;
 select * into strict v_ent from public.entitlements
   where subscription_id=p_subscription_id
     and account_id=p_account_id and product_id='research-membership'
   for update;
 select * into v_wit from research_ordering_stage_f.verified_transition w
 where w.event_key=p_event_key and w.subscription_id=p_subscription_id
   and w.account_id=p_account_id and w.provider=p_provider
   and w.provider_subscription_id=p_provider_subscription_id
   and w.provider_customer_id=p_provider_customer_id
   and w.store_id=p_store_id and w.variant_id=p_variant_id
   and w.binding_fingerprint=p_binding_fingerprint
   and w.provider_event_id=p_provider_event_id
   and w.event_fingerprint=p_fingerprint
   and w.source_type=p_source_type
   and w.snapshot_object_at=p_occurred_at
   and w.target_state=p_next_state
   and w.target_period_start=p_next_period_start
   and w.target_period_end=p_next_period_end;
 if not found then
   raise exception 'review: all effect-changing fields require independent attestation'
     using errcode='42501';
 end if;
 select exists(select 1 from research_ordering_stage_c.delivery_audit a
     where a.event_key=p_event_key) into v_duplicate;
 if not v_duplicate and (v_sub.version is distinct from v_wit.expected_subscription_version
    or v_ent.version is distinct from v_wit.expected_entitlement_version) then
   raise exception 'review: verified database version is stale; reacquire evidence'
     using errcode='42501';
 end if;
 return research_ordering_stage_c.apply_real_schema_review(
   p_subscription_id,p_account_id,p_provider,p_provider_subscription_id,
   p_provider_customer_id,p_store_id,p_variant_id,p_binding_fingerprint,
   p_event_key,p_provider_event_id,p_fingerprint,p_source_type,
   p_occurred_at,p_next_state,p_next_period_start,p_next_period_end,true);
end; $$;
alter function research_ordering_stage_f.apply_strict_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) owner to research_e_owner;
revoke all on all functions in schema research_ordering_stage_f from public, anon, authenticated, service_role;
revoke all on all tables in schema research_ordering_stage_f from public, anon, authenticated, service_role;
grant execute on function research_ordering_stage_f.apply_strict_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) to research_e_gateway;
-- Critical cutover: leaving Stage E's insufficiently bound gateway callable
-- would permit bypassing the new checks. Revoke in the SAME review transaction.
revoke execute on function research_ordering_stage_e.apply_witnessed_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) from research_e_gateway;
commit;
