-- REVIEW ONLY. Synthetic private-schema ordering oracle, not deployable Production SQL.
-- It cannot be called by the live webhook and does not access real commerce tables.
begin;
create schema research_ordering_review;
create table research_ordering_review.subscriptions (
  id uuid primary key,
  provider text not null,
  provider_subscription_id text not null,
  state text not null check (state in ('pending','active','past_due','cancel_scheduled','cancelled','refunded','disputed','charged_back')),
  current_period_end timestamptz,
  applied_subscription_at timestamptz,
  applied_event_key text,
  version integer not null default 1
);
create table research_ordering_review.entitlements (
  id uuid primary key,
  subscription_id uuid references research_ordering_review.subscriptions(id),
  product_id text not null,
  purchase_id uuid,
  state text not null,
  ends_at timestamptz,
  version integer not null default 1,
  constraint research_review_commercial_source check (not (subscription_id is not null and purchase_id is not null))
);
create table research_ordering_review.delivery_audit (
  event_key text primary key,
  subscription_id uuid not null references research_ordering_review.subscriptions(id),
  provider_event_id text not null,
  source_type text not null,
  occurred_at timestamptz,
  fingerprint text not null,
  disposition text not null check (disposition in ('stale_ignored','ordering_conflict','pending_reconciliation','applied')),
  pre_state text not null,
  post_state text not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create function research_ordering_review.reject_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'research ordering audit evidence is append-only';
end;
$$;
create trigger delivery_audit_immutable
before update or delete on research_ordering_review.delivery_audit
for each row execute function research_ordering_review.reject_audit_mutation();

create function research_ordering_review.apply_synthetic_delivery(
  p_subscription_id uuid,
  p_provider text,
  p_provider_subscription_id text,
  p_event_key text,
  p_provider_event_id text,
  p_fingerprint text,
  p_source_type text,
  p_occurred_at timestamptz,
  p_next_state text,
  p_next_period_end timestamptz,
  p_verified_current_snapshot boolean
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_sub research_ordering_review.subscriptions%rowtype;
  v_prior research_ordering_review.delivery_audit%rowtype;
  v_disposition text;
  v_next_entitlement text;
begin
  if p_event_key is null or btrim(p_event_key) = ''
     or p_provider_event_id is null or btrim(p_provider_event_id) = ''
     or p_provider is null or btrim(p_provider) = ''
     or p_provider_subscription_id is null or btrim(p_provider_subscription_id) = ''
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_source_type not in ('subscriptions','subscription-invoices')
     or p_next_state not in ('pending','active','past_due','cancel_scheduled','cancelled','refunded','disputed','charged_back')
  then raise exception 'invalid signed delivery classification inputs'; end if;

  -- Lock the same subscription record across duplicate, watermark, state and entitlement decisions.
  select * into strict v_sub from research_ordering_review.subscriptions
  where id=p_subscription_id for update;
  if v_sub.provider <> p_provider or v_sub.provider_subscription_id <> p_provider_subscription_id then
    raise exception 'provider identity/binding mismatch';
  end if;
  select * into v_prior from research_ordering_review.delivery_audit where event_key = p_event_key;
  if found then
    if v_prior.fingerprint <> p_fingerprint
       or v_prior.subscription_id <> p_subscription_id
       or v_prior.provider_event_id <> p_provider_event_id
       or v_prior.source_type <> p_source_type
       or v_prior.occurred_at is distinct from p_occurred_at then
      raise exception 'replayed delivery evidence conflicts';
    end if;
    return jsonb_build_object('action','duplicate','prior_disposition',v_prior.disposition,'can_mutate',false);
  end if;

  if p_source_type = 'subscription-invoices' then
    v_disposition := 'pending_reconciliation'; -- Invoice clocks are incomparable with subscriptions.updated_at.
  elsif p_occurred_at is null or v_sub.applied_subscription_at is null then
    v_disposition := 'pending_reconciliation'; -- No guessed first-subscriber watermark.
  elsif p_occurred_at < v_sub.applied_subscription_at then
    v_disposition := 'stale_ignored';
  elsif p_occurred_at = v_sub.applied_subscription_at then
    v_disposition := 'ordering_conflict'; -- Never tie-break distinct keys by lexical order.
  elsif p_verified_current_snapshot is distinct from true then
    v_disposition := 'pending_reconciliation';
  elsif v_sub.state in ('cancelled','refunded','charged_back') and p_next_state <> v_sub.state then
    v_disposition := 'pending_reconciliation'; -- No terminal resurrection.
  elsif p_next_state in ('active','cancel_scheduled') and
        (p_next_period_end is null or p_next_period_end <= p_occurred_at) then
    v_disposition := 'pending_reconciliation'; -- No open-ended paid access.
  elsif v_sub.current_period_end is not null and
        (p_next_period_end is null or p_next_period_end < v_sub.current_period_end) then
    v_disposition := 'pending_reconciliation'; -- Never shorten verified paid horizon.
  else
    v_disposition := 'applied';
  end if;

  if v_disposition = 'applied' then
    -- Synthetic transition uses the same locked record and transaction as audit/watermark.
    update research_ordering_review.subscriptions
      set state=p_next_state, current_period_end=p_next_period_end,
          applied_subscription_at=p_occurred_at, applied_event_key=p_event_key,
          version=version+1
      where id=p_subscription_id;
    v_next_entitlement := case p_next_state
      when 'active' then 'active' when 'cancel_scheduled' then 'active'
      when 'past_due' then 'suspended' when 'cancelled' then 'revoked'
      when 'refunded' then 'refunded' when 'disputed' then 'suspended_dispute'
      when 'charged_back' then 'charged_back' else 'pending' end;
    update research_ordering_review.entitlements
      set state=v_next_entitlement,
          ends_at=case when p_next_state in ('active','cancel_scheduled') then p_next_period_end
                       else p_occurred_at end,
          version=version+1
      where subscription_id=p_subscription_id and product_id='research-membership' and purchase_id is null;
    if not found then raise exception 'bound Research entitlement missing'; end if;
  end if;

  -- Rejected and held deliveries are durable evidence, never access changes.
  insert into research_ordering_review.delivery_audit
    (event_key,subscription_id,provider_event_id,source_type,occurred_at,fingerprint,
     disposition,pre_state,post_state)
  values (p_event_key,p_subscription_id,p_provider_event_id,p_source_type,p_occurred_at,
          p_fingerprint,v_disposition,v_sub.state,
          case when v_disposition='applied' then p_next_state else v_sub.state end);
  return jsonb_build_object('action',v_disposition,'can_mutate',v_disposition='applied');
end;
$$;

-- Defense in depth: private unexposed schema, no Data API/browser/service_role EXECUTE.
revoke all on schema research_ordering_review from public;
revoke all on all tables in schema research_ordering_review from public;
revoke all on all functions in schema research_ordering_review from public;
alter table research_ordering_review.subscriptions enable row level security;
alter table research_ordering_review.entitlements enable row level security;
alter table research_ordering_review.delivery_audit enable row level security;
commit;
