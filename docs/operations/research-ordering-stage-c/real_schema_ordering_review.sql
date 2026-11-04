-- REVIEW-ONLY. Install ONLY in a disposable PostgreSQL cluster after the six
-- original USD Impact Research migrations. NEVER put into supabase/migrations.
-- This private review function is not a live authorization path. Its provider
-- snapshot evidence flag is a synthetic fixture, NOT an authenticated proof.
begin;
create schema research_ordering_stage_c;
revoke all on schema research_ordering_stage_c from public, anon, authenticated, service_role;

create table research_ordering_stage_c.applied_watermarks (
 subscription_id uuid primary key references public.subscriptions(id) on delete restrict,
 subscription_object_at timestamptz not null,
 source_event_key text not null,
 witness_digest text not null check (witness_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
create table research_ordering_stage_c.delivery_audit (
 event_key text primary key,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 provider_event_id text not null,
 signed_object_kind text not null check (signed_object_kind in ('subscriptions','subscription-invoices')),
 occurred_at timestamptz,
 fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
 disposition text not null check (disposition in ('applied','stale_ignored','ordering_conflict','pending_reconciliation')),
 reason text not null,
 from_state public.subscription_state not null,
 to_state public.subscription_state not null,
 created_at timestamptz not null default clock_timestamp()
);
create function research_ordering_stage_c.reject_delivery_audit_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'stage-c audit is immutable'; end;
$$;
create trigger delivery_audit_immutable before update or delete on research_ordering_stage_c.delivery_audit
for each row execute function research_ordering_stage_c.reject_delivery_audit_mutation();

create function research_ordering_stage_c.apply_real_schema_review(
 p_subscription_id uuid,
 p_account_id uuid,
 p_provider text,
 p_provider_subscription_id text,
 p_provider_customer_id text,
 p_store_id text,
 p_variant_id text,
 p_binding_fingerprint text,
 p_event_key text,
 p_provider_event_id text,
 p_fingerprint text,
 p_source_type text,
 p_occurred_at timestamptz,
 p_next_state public.subscription_state,
 p_next_period_start timestamptz,
 p_next_period_end timestamptz,
 p_snapshot_verified boolean
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_sub public.subscriptions%rowtype;
 v_ent public.entitlements%rowtype;
 v_wm research_ordering_stage_c.applied_watermarks%rowtype;
 v_old research_ordering_stage_c.delivery_audit%rowtype;
 v_disposition text := 'pending_reconciliation';
 v_reason text := 'provider_state_not_verified';
 v_entitlement public.entitlement_state;
 v_old_ent public.entitlement_state;
 v_allowed boolean := false;
begin
 if p_event_key is null or btrim(p_event_key)='' or p_provider_event_id is null
     or btrim(p_provider_event_id)='' or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_binding_fingerprint !~ '^[0-9a-f]{64}$'
     or p_source_type not in ('subscriptions','subscription-invoices') then
   raise exception 'invalid stage-c input';
 end if;
 -- Lock real historical Research subscription row, not a synthetic duplicate.
 select * into strict v_sub from public.subscriptions where id=p_subscription_id for update;
 if v_sub.account_id is distinct from p_account_id
   or v_sub.product_id <> 'research-membership'
   or v_sub.provider is distinct from p_provider
   or v_sub.provider_subscription_id is distinct from p_provider_subscription_id
   or v_sub.provider_customer_id is distinct from p_provider_customer_id then
   raise exception 'Research account or provider binding mismatch';
 end if;
 -- Review-only fixture fields: they do not exist as an approved live binding contract.
 if v_sub.metadata->>'review_store_id' is distinct from p_store_id
   or v_sub.metadata->>'review_variant_id' is distinct from p_variant_id
   or v_sub.metadata->>'review_binding_fingerprint' is distinct from p_binding_fingerprint then
   raise exception 'Review-only store/variant/custody binding mismatch';
 end if;
 select * into v_old from research_ordering_stage_c.delivery_audit where event_key=p_event_key;
 if found then
   if v_old.subscription_id is distinct from p_subscription_id
     or v_old.provider_event_id is distinct from p_provider_event_id
     or v_old.fingerprint is distinct from p_fingerprint
     or v_old.signed_object_kind is distinct from p_source_type
     or v_old.occurred_at is distinct from p_occurred_at then
     raise exception 'review replay evidence conflict';
   end if;
   return jsonb_build_object('action','duplicate','prior_disposition',v_old.disposition,'can_mutate',false);
 end if;
 select * into v_wm from research_ordering_stage_c.applied_watermarks where subscription_id=p_subscription_id for update;
 select * into v_ent from public.entitlements
   where account_id=v_sub.account_id and product_id='research-membership' for update;
 if not found or v_ent.subscription_id is distinct from p_subscription_id or v_ent.purchase_id is not null then
   v_reason := 'missing_or_non_subscription_entitlement';
 elsif p_source_type='subscription-invoices' then
   v_reason := 'invoice_object_clock_is_not_subscription_clock';
 elsif v_wm.subscription_id is null or p_occurred_at is null then
   v_reason := 'missing_applied_subscription_object_watermark';
 elsif p_occurred_at < v_wm.subscription_object_at then
   v_disposition := 'stale_ignored'; v_reason := 'older_subscription_object';
 elsif p_occurred_at = v_wm.subscription_object_at then
   v_disposition := 'ordering_conflict'; v_reason := 'equal_timestamp_distinct_event_key';
 elsif p_snapshot_verified is distinct from true then
   v_reason := 'current_provider_snapshot_unverified';
 elsif v_sub.state in ('cancelled','refunded','charged_back') then
   v_reason := 'terminal_state_cannot_reopen';
 elsif p_next_period_start is null or p_next_period_end is null
       or p_next_period_end <= p_next_period_start then
   v_reason := 'missing_or_invalid_paid_period';
 elsif v_sub.current_period_end is not null and p_next_period_end < v_sub.current_period_end then
   v_reason := 'paid_horizon_would_shorten';
 else
   -- Match the existing historical trigger's transition matrix. Do not raise
   -- after inserting an ignored receipt: invalid flows are durably quarantined.
   v_allowed := p_next_state=v_sub.state
     or (v_sub.state='pending' and p_next_state in ('active','cancelled'))
     or (v_sub.state='active' and p_next_state in
         ('past_due','cancel_scheduled','cancelled','refunded','disputed','charged_back'))
     or (v_sub.state='past_due' and p_next_state in
         ('active','cancel_scheduled','cancelled','refunded','disputed','charged_back'))
     or (v_sub.state='cancel_scheduled' and p_next_state in
         ('active','cancelled','refunded','disputed','charged_back'))
     or (v_sub.state='disputed' and p_next_state in ('active','refunded','charged_back'));
   if v_allowed then
      v_disposition := 'applied'; v_reason := 'synthetic_verified_snapshot_candidate';
   else
      v_reason := 'not_allowed_by_existing_subscription_transition_matrix';
   end if;
 end if;

 if v_disposition='applied' then
   v_entitlement := case p_next_state
      when 'active' then 'active'::public.entitlement_state
      when 'cancel_scheduled' then 'active'::public.entitlement_state
      when 'past_due' then 'suspended'::public.entitlement_state
      when 'cancelled' then 'revoked'::public.entitlement_state
      when 'refunded' then 'refunded'::public.entitlement_state
      when 'disputed' then 'suspended_dispute'::public.entitlement_state
      when 'charged_back' then 'charged_back'::public.entitlement_state
      else 'suspended'::public.entitlement_state end;
   v_old_ent:=v_ent.state;
   update public.subscriptions set
      state=p_next_state,
      current_period_start=p_next_period_start,
      current_period_end=p_next_period_end,
      cancel_at_period_end=(p_next_state='cancel_scheduled'),
      cancel_scheduled_at=case when p_next_state='cancel_scheduled' then p_occurred_at else null end,
      last_provider_event_id=p_provider_event_id,
      version=version+1
   where id=p_subscription_id;
   update public.entitlements set
      state=v_entitlement,
      starts_at=case when v_entitlement='active' then least(starts_at,p_next_period_start) else starts_at end,
      ends_at=case when v_entitlement='active' then p_next_period_end else ends_at end,
      version=version+1
   where id=v_ent.id;
   update research_ordering_stage_c.applied_watermarks set
      subscription_object_at=p_occurred_at,source_event_key=p_event_key
      where subscription_id=p_subscription_id;
   insert into public.subscription_events (
      event_key,subscription_id,account_id,product_id,from_state,to_state,
      reason,actor_type,provider_event_id,occurred_at,metadata
   ) values (
      p_event_key,p_subscription_id,v_sub.account_id,'research-membership',v_sub.state,p_next_state,
      'stage_c_synthetic_preview','provider_webhook',p_provider_event_id,p_occurred_at,
      jsonb_build_object('source','stage-c-REAL-SCHEMA-DISPOSABLE-ONLY')
   );
   insert into public.entitlement_events (
      event_key,entitlement_id,account_id,product_id,from_state,to_state,
      reason,actor_type,provider_event_id,occurred_at,metadata
   ) values (
      p_event_key||':entitlement',v_ent.id,v_sub.account_id,'research-membership',v_old_ent,v_entitlement,
      'stage_c_synthetic_preview','provider_webhook',p_provider_event_id,p_occurred_at,
      jsonb_build_object('source','stage-c-REAL-SCHEMA-DISPOSABLE-ONLY')
   );
 end if;
 -- Held deliveries remain durably reviewable, rather than raising after INSERT.
 insert into research_ordering_stage_c.delivery_audit(
      event_key,subscription_id,provider_event_id,signed_object_kind,occurred_at,
      fingerprint,disposition,reason,from_state,to_state
 ) values (p_event_key,p_subscription_id,p_provider_event_id,p_source_type,p_occurred_at,
           p_fingerprint,v_disposition,v_reason,v_sub.state,
           case when v_disposition='applied' then p_next_state else v_sub.state end);
 return jsonb_build_object('action',v_disposition,'reason',v_reason,
                            'can_mutate',v_disposition='applied');
end;
$$;
revoke all on schema research_ordering_stage_c from public, anon, authenticated, service_role;
revoke all on all tables in schema research_ordering_stage_c from public, anon, authenticated, service_role;
revoke all on all functions in schema research_ordering_stage_c from public, anon, authenticated, service_role;
alter table research_ordering_stage_c.applied_watermarks enable row level security;
alter table research_ordering_stage_c.delivery_audit enable row level security;
commit;
