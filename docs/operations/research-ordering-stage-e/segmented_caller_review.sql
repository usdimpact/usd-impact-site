-- DISPOSABLE REVIEW ONLY. DO NOT INSTALL IN CONNECTED SUPABASE DATABASES.
-- Replay only after the six historical Research migrations and Stage C private oracle.
-- This is deliberately NOT a deployable migration or verified provider witness.
begin;
create role research_e_owner nologin noinherit nobypassrls;
create role research_e_gateway login password 'synthetic-stage-e-gateway-only' noinherit nobypassrls;
create role research_e_verifier login password 'synthetic-stage-e-verifier-only' noinherit nobypassrls;

create schema research_ordering_stage_e;
revoke all on schema research_ordering_stage_e from public, anon, authenticated, service_role;
create table research_ordering_stage_e.verified_snapshot (
  event_key text primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  account_id uuid not null,
  provider_event_id text not null,
  provider_subscription_id text not null,
  provider_customer_id text not null,
  store_id text not null,
  variant_id text not null,
  binding_fingerprint text not null check (binding_fingerprint ~ '^[0-9a-f]{64}$'),
  event_fingerprint text not null check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  snapshot_object_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create function research_ordering_stage_e.forbid_witness_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'synthetic witness record is immutable' using errcode='42501';
end; $$;
create trigger review_witness_immutable before update or delete
on research_ordering_stage_e.verified_snapshot for each row
execute function research_ordering_stage_e.forbid_witness_change();
alter table research_ordering_stage_e.verified_snapshot enable row level security;

-- Private, row-type-independent guard: check BOTH old and new product to
-- prevent bypass by changing product_id during a privileged UPDATE.
create function research_ordering_stage_e.reject_unauthorized_research_write()
returns trigger language plpgsql security invoker set search_path='' as $$
declare old_research boolean := false;
declare new_research boolean := false;
begin
  if TG_OP <> 'INSERT' then
    old_research := coalesce((to_jsonb(OLD)->>'product_id')='research-membership',false);
  end if;
  if TG_OP <> 'DELETE' then
    new_research := coalesce((to_jsonb(NEW)->>'product_id')='research-membership',false);
  end if;
  if (old_research or new_research) and current_user <> 'research_e_owner' then
    raise exception 'review: Research writes require isolated lifecycle owner'
      using errcode='42501';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end; $$;
create trigger research_e_guard_subscriptions
before insert or update or delete on public.subscriptions for each row
execute function research_ordering_stage_e.reject_unauthorized_research_write();
create trigger research_e_guard_entitlements
before insert or update or delete on public.entitlements for each row
execute function research_ordering_stage_e.reject_unauthorized_research_write();
create trigger research_e_guard_subscription_events
before insert or update or delete on public.subscription_events for each row
execute function research_ordering_stage_e.reject_unauthorized_research_write();
create trigger research_e_guard_entitlement_events
before insert or update or delete on public.entitlement_events for each row
execute function research_ordering_stage_e.reject_unauthorized_research_write();

-- An isolated NOLOGIN owner is allowed only the exact DML and private resources
-- that the Stage C review function needs. It is NOT BYPASSRLS or superuser.
grant usage on schema public, research_ordering_stage_c to research_e_owner;
grant select, update on public.subscriptions, public.entitlements to research_e_owner;
grant insert on public.subscription_events, public.entitlement_events to research_e_owner;
grant select, update on research_ordering_stage_c.applied_watermarks to research_e_owner;
grant select, insert on research_ordering_stage_c.delivery_audit to research_e_owner;
grant execute on function research_ordering_stage_c.apply_real_schema_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz,boolean
) to research_e_owner;
create policy research_e_subscriptions_owner on public.subscriptions
for all to research_e_owner using (true) with check (true);
create policy research_e_entitlements_owner on public.entitlements
for all to research_e_owner using (true) with check (true);
create policy research_e_subscription_events_owner on public.subscription_events
for insert to research_e_owner with check (true);
create policy research_e_entitlement_events_owner on public.entitlement_events
for insert to research_e_owner with check (true);
create policy research_e_stage_c_watermark_owner on research_ordering_stage_c.applied_watermarks
for all to research_e_owner using (true) with check (true);
create policy research_e_stage_c_audit_owner on research_ordering_stage_c.delivery_audit
for all to research_e_owner using (true) with check (true);

-- The caller CAN'T create a trusted witness; the independent synthetic
-- verifier can INSERT a witnessed event, but cannot call the lifecycle gateway.
grant usage on schema research_ordering_stage_e to research_e_owner,research_e_gateway,research_e_verifier;
grant select on research_ordering_stage_e.verified_snapshot to research_e_owner;
grant insert on research_ordering_stage_e.verified_snapshot to research_e_verifier;
create policy research_e_witness_select on research_ordering_stage_e.verified_snapshot
for select to research_e_owner using (true);
create policy research_e_witness_insert on research_ordering_stage_e.verified_snapshot
for insert to research_e_verifier with check (true);

-- Only exact trusted-event identity authorizes the private Stage C oracle.
-- No p_snapshot_verified input exists in the gateway signature.
create function research_ordering_stage_e.apply_witnessed_review(
 p_subscription_id uuid, p_account_id uuid, p_provider text,
 p_provider_subscription_id text, p_provider_customer_id text,
 p_store_id text, p_variant_id text, p_binding_fingerprint text,
 p_event_key text, p_provider_event_id text, p_fingerprint text,
 p_source_type text, p_occurred_at timestamptz,
 p_next_state public.subscription_state,
 p_next_period_start timestamptz, p_next_period_end timestamptz
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_exists boolean;
begin
  select exists(select 1 from research_ordering_stage_e.verified_snapshot w
    where w.subscription_id=p_subscription_id
      and w.account_id=p_account_id
      and w.provider_subscription_id=p_provider_subscription_id
      and w.provider_customer_id=p_provider_customer_id
      and w.store_id=p_store_id
      and w.variant_id=p_variant_id
      and w.binding_fingerprint=p_binding_fingerprint
      and w.event_key=p_event_key
      and w.provider_event_id=p_provider_event_id
      and w.event_fingerprint=p_fingerprint
      and w.snapshot_object_at=p_occurred_at
  ) into v_exists;
  if not v_exists then
    raise exception 'synthetic independent witness required' using errcode='42501';
  end if;
  return research_ordering_stage_c.apply_real_schema_review(
    p_subscription_id,p_account_id,p_provider,p_provider_subscription_id,
    p_provider_customer_id,p_store_id,p_variant_id,p_binding_fingerprint,
    p_event_key,p_provider_event_id,p_fingerprint,p_source_type,
    p_occurred_at,p_next_state,p_next_period_start,p_next_period_end,true);
end; $$;
alter function research_ordering_stage_e.apply_witnessed_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) owner to research_e_owner;
revoke all on all functions in schema research_ordering_stage_e from public, anon, authenticated, service_role;
revoke all on all tables in schema research_ordering_stage_e from public, anon, authenticated, service_role;
grant execute on function research_ordering_stage_e.apply_witnessed_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) to research_e_gateway;
commit;
