-- B-4: D1 OWNER-APPROVED SYNTHETIC PostgreSQL TWO-SESSION REVIEW ONLY.
-- NOT a Supabase migration. NOT deployed. NOT called by the Research app.
-- All identifiers and role credentials are throwaway synthetic fixtures.
-- HMAC/provider trust, payment settlement, production RLS and entitlements
-- are NOT established by this SQL. Keep all commerce activation HOLDs.
--
-- Functional model: (1) signed paid-sub evidence COMMIT, then (2) try
-- binding, returning a disposition and appending conflict evidence in a
-- successful transaction. If a caller wraps (2) in a transaction then
-- ROLLBACK, the conflict journal rolls back; (1) persists. PostgreSQL
-- provides NO autonomous transactions. No successful payment can be
-- claimed fulfilled on a conflict or unverified binding.

begin;

-- Scope of this global default-EXECUTE change is the disposable CI database
-- ONLY; ci_research is the isolated PostgreSQL fixture owner, not Supabase.
-- Schema-only default REVOKE cannot remove Postgres's global PUBLIC default.
alter default privileges for role ci_research
  revoke execute on functions from public;

create role review_binding_writer nologin;
create role review_binding_evidence_owner nologin;
create role review_binding_api login password 'ci_review_api_only_password';
-- Distinct simulated trusted server-side verifier. Its CI-only credential
-- does NOT prove Lemon Squeezy HMAC in SQL or authorize a live provider role.
create role review_binding_verifier login password 'ci_review_verifier_only_password';
create role review_binding_anon nologin;
create role review_binding_authenticated nologin;

create schema research_binding_review;
revoke all on schema research_binding_review from public;
grant usage on schema research_binding_review to review_binding_writer, review_binding_api, review_binding_verifier;
-- CREATE granted only temporarily to transfer SECURITY DEFINER ownership.
grant create on schema research_binding_review to review_binding_writer;
-- Temporary CREATE is required for the distinct evidence-owner transfer.
grant usage, create on schema research_binding_review to review_binding_evidence_owner;

create table research_binding_review.profiles (
  account_id uuid primary key,
  status text not null check (status in ('active','deletion_pending','deleted')),
  created_at timestamptz not null default clock_timestamp()
);

create table research_binding_review.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references research_binding_review.profiles(account_id) on delete restrict,
  provider text not null default 'lemon-squeezy-research'
    check (provider = 'lemon-squeezy-research'),
  provider_subscription_id text not null unique,
  status text not null default 'pending'
    check (status in ('pending','active','past_due','cancel_scheduled','cancelled','refunded')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index review_one_current_subscription_per_account
on research_binding_review.subscriptions(account_id)
where status in ('pending','active','past_due','cancel_scheduled');

create table research_binding_review.entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references research_binding_review.profiles(account_id) on delete restrict,
  product_id text not null check (product_id in ('research-membership','library-pass')),
  source text not null check (source in ('paid','complimentary','library-pass')),
  provider_subscription_id text,
  state text not null check (state in ('active','revoked')),
  starts_at timestamptz not null default clock_timestamp(),
  ends_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (ends_at is null or ends_at > starts_at)
);
create unique index review_one_active_product_entitlement
on research_binding_review.entitlements(account_id,product_id)
where state = 'active';

create table research_binding_review.library_pass_receipts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references research_binding_review.profiles(account_id) on delete restrict,
  provider text not null check (provider = 'lemon-squeezy'),
  provider_event_id text not null unique,
  status text not null check (status in ('processed','failed','ignored')),
  created_at timestamptz not null default clock_timestamp()
);

-- A *separately committed* pre-binding observation of an authenticated paid
-- subscription must exist, even if later binding or entitlement fails. In
-- real production the signed provider, store/product/mode and account
-- binding MUST be authenticated before this entrypoint; this demo cannot
-- establish the provider trust boundary.
create table research_binding_review.signed_paid_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lemon-squeezy-research'
    check (provider = 'lemon-squeezy-research'),
  provider_event_id text not null unique,
  provider_subscription_id text not null,
  bound_account_id uuid,
  observed_at timestamptz not null default clock_timestamp(),
  check (char_length(provider_event_id) between 1 and 255),
  check (char_length(provider_subscription_id) between 1 and 255)
);

create table research_binding_review.conflict_observations (
  id uuid primary key default gen_random_uuid(),
  paid_observation_id uuid references research_binding_review.signed_paid_observations(id) on delete restrict,
  provider_event_id text not null,
  provider_subscription_id text not null,
  bound_account_id uuid,
  conflict_code text not null check (conflict_code in (
    'duplicate_paid_subscription','entitlement_conflict',
    'provider_subscription_in_use','account_unavailable','unbound_subscription',
    'paid_evidence_identity_mismatch','missing_custom_binding',
    'provider_subscription_account_mismatch','subscription_not_activatable'
  )),
  observed_at timestamptz not null default clock_timestamp()
);
create index review_conflicts_by_account on research_binding_review.conflict_observations(bound_account_id,observed_at);

-- Distinct owner: role allowed to INSERT evidence cannot alter or remove it.
alter table research_binding_review.signed_paid_observations owner to review_binding_evidence_owner;
alter table research_binding_review.conflict_observations owner to review_binding_evidence_owner;

create function research_binding_review.reject_evidence_mutation()
returns trigger language plpgsql
set search_path = pg_catalog, research_binding_review, pg_temp as $$
begin
  raise exception 'B-4 review evidence is append-only'
    using errcode = '42501';
end;
$$;
alter function research_binding_review.reject_evidence_mutation() owner to review_binding_evidence_owner;
revoke create on schema research_binding_review from review_binding_evidence_owner;

create trigger no_signed_paid_update_delete
before update or delete on research_binding_review.signed_paid_observations
for each row execute function research_binding_review.reject_evidence_mutation();
create trigger no_signed_paid_truncate
before truncate on research_binding_review.signed_paid_observations
for each statement execute function research_binding_review.reject_evidence_mutation();
create trigger no_conflict_update_delete
before update or delete on research_binding_review.conflict_observations
for each row execute function research_binding_review.reject_evidence_mutation();
create trigger no_conflict_truncate
before truncate on research_binding_review.conflict_observations
for each statement execute function research_binding_review.reject_evidence_mutation();

-- Defense in depth: a privileged or accidentally broadened writer may NEVER
-- mutate historical Library Pass rows through this review fixture.
create function research_binding_review.guard_library_pass_mutation()
returns trigger language plpgsql
set search_path = pg_catalog, research_binding_review, pg_temp as $
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'B-4 Library Pass rows are immutable'
      using errcode = '42501';
  end if;
  if old.product_id = 'library-pass'
     or (tg_op = 'UPDATE' and new.product_id = 'library-pass') then
    raise exception 'B-4 Library Pass rows are immutable'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$;
create trigger guard_library_pass_update_delete
before update or delete on research_binding_review.entitlements
for each row execute function research_binding_review.guard_library_pass_mutation();
create trigger guard_entitlement_truncate
before truncate on research_binding_review.entitlements
for each statement execute function research_binding_review.guard_library_pass_mutation();

grant select, update on research_binding_review.profiles to review_binding_writer;
grant select, insert, update on research_binding_review.subscriptions to review_binding_writer;
grant select, insert on research_binding_review.entitlements to review_binding_writer;
grant select, insert on research_binding_review.signed_paid_observations to review_binding_writer;
grant select, insert on research_binding_review.conflict_observations to review_binding_writer;
-- Explicitly NO table privileges whatsoever for review_binding_api.

-- The only caller is the separate simulated verifier login, NOT the API
-- caller that requests binding/activation. SQL itself cannot verify HMAC,
-- catalog, a checkout-intent reservation, or a real customer charge.
-- Therefore this is ONLY the D1 trust-boundary simulation, not a live fix.
create function research_binding_review.observe_signed_paid(
  p_account_id uuid, p_subscription_id text, p_event_id text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, research_binding_review, pg_temp as $$
declare
  v_obs research_binding_review.signed_paid_observations%rowtype;
begin
  if p_subscription_id is null
     or char_length(p_subscription_id) not between 1 and 255
     or p_event_id is null or char_length(p_event_id) not between 1 and 255
  then
    return jsonb_build_object('disposition','invalid_input');
  end if;

  -- Serialize distinct paid-event identities for the same provider sub, so
  -- two verifier sessions cannot each pass a first-seen identity check.
  perform pg_advisory_xact_lock(hashtextextended(p_subscription_id, 0));

  insert into research_binding_review.signed_paid_observations(
    bound_account_id,provider_subscription_id,provider_event_id
  ) values (p_account_id,p_subscription_id,p_event_id)
  on conflict(provider_event_id) do nothing returning * into v_obs;

  if found then
    if exists (
      select 1 from research_binding_review.signed_paid_observations p
       where p.provider_subscription_id = p_subscription_id
         and p.id <> v_obs.id
         and p.bound_account_id is distinct from p_account_id
    ) then
      insert into research_binding_review.conflict_observations(
        paid_observation_id,provider_event_id,provider_subscription_id,
        bound_account_id,conflict_code
      ) values (v_obs.id,p_event_id,p_subscription_id,p_account_id,
        'provider_subscription_account_mismatch');
      return jsonb_build_object('disposition','subscription_account_conflict');
    end if;
    if p_account_id is null then
      insert into research_binding_review.conflict_observations(
        paid_observation_id,provider_event_id,provider_subscription_id,
        bound_account_id,conflict_code
      ) values (v_obs.id,p_event_id,p_subscription_id,null,'missing_custom_binding');
      return jsonb_build_object('disposition','unbound_paid_observed');
    end if;
    return jsonb_build_object('disposition','recorded');
  end if;

  select * into v_obs from research_binding_review.signed_paid_observations
    where provider_event_id=p_event_id;
  if v_obs.bound_account_id is not distinct from p_account_id
    and v_obs.provider_subscription_id=p_subscription_id then
    return jsonb_build_object('disposition','already_recorded');
  end if;

  insert into research_binding_review.conflict_observations(
    paid_observation_id,provider_event_id,provider_subscription_id,
    bound_account_id,conflict_code
  ) values (v_obs.id,p_event_id,p_subscription_id,p_account_id,
    'paid_evidence_identity_mismatch');
  return jsonb_build_object('disposition','event_identity_conflict');
end;
$$;

create function research_binding_review.try_bind_paid(
  p_account_id uuid, p_subscription_id text, p_event_id text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, research_binding_review, pg_temp as $$
declare
  v_paid_id uuid;
  v_profile_status text;
  v_existing research_binding_review.subscriptions%rowtype;
  v_id uuid;
begin
  if p_account_id is null or p_subscription_id is null or p_event_id is null
      or char_length(p_subscription_id) not between 1 and 255
      or char_length(p_event_id) not between 1 and 255 then
    return jsonb_build_object('disposition','invalid_input');
  end if;

  select id into v_paid_id
    from research_binding_review.signed_paid_observations
   where bound_account_id=p_account_id and provider_subscription_id=p_subscription_id
     and provider_event_id=p_event_id;

  if not found then
    return jsonb_build_object('disposition','unverified_paid_evidence');
  end if;

  -- Even a precommitted verifier observation cannot bind one provider
  -- subscription to contradictory account identities. Human D6 review only.
  if exists (
    select 1 from research_binding_review.signed_paid_observations p
     where p.provider_subscription_id = p_subscription_id
       and p.bound_account_id is distinct from p_account_id
  ) then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'provider_subscription_account_mismatch');
    return jsonb_build_object('disposition','conflict',
      'code','provider_subscription_account_mismatch');
  end if;

  -- Lock profile BEFORE subscription and entitlement to serialize bindings.
  select status into v_profile_status from research_binding_review.profiles
    where account_id=p_account_id for update;

  if not found or v_profile_status <> 'active' then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,'account_unavailable');
    return jsonb_build_object('disposition','conflict','code','account_unavailable');
  end if;

  select * into v_existing from research_binding_review.subscriptions
    where provider_subscription_id=p_subscription_id for update;

  if found then
    if v_existing.account_id=p_account_id then
      return jsonb_build_object('disposition','already_bound');
    end if;
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'provider_subscription_in_use');
    return jsonb_build_object('disposition','conflict','code','provider_subscription_in_use');
  end if;

  select * into v_existing from research_binding_review.subscriptions
    where account_id=p_account_id
      and status in ('pending','active','past_due','cancel_scheduled')
    order by created_at desc limit 1 for update;

  if found then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'duplicate_paid_subscription');
    return jsonb_build_object('disposition','conflict','code','duplicate_paid_subscription');
  end if;

  insert into research_binding_review.subscriptions(
    account_id,provider_subscription_id,status
  ) values (p_account_id,p_subscription_id,'pending') returning id into v_id;
  return jsonb_build_object('disposition','created','subscription_id',v_id);
end;
$$;

create function research_binding_review.try_activate_paid(
  p_account_id uuid, p_subscription_id text, p_event_id text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, research_binding_review, pg_temp as $$
declare
  v_paid_id uuid;
  v_profile_status text;
  v_sub research_binding_review.subscriptions%rowtype;
  v_ent research_binding_review.entitlements%rowtype;
begin
  select id into v_paid_id from research_binding_review.signed_paid_observations
    where bound_account_id=p_account_id and provider_subscription_id=p_subscription_id
      and provider_event_id=p_event_id;
  if not found then
    return jsonb_build_object('disposition','unverified_paid_evidence');
  end if;

  if exists (
    select 1 from research_binding_review.signed_paid_observations p
     where p.provider_subscription_id = p_subscription_id
       and p.bound_account_id is distinct from p_account_id
  ) then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'provider_subscription_account_mismatch');
    return jsonb_build_object('disposition','conflict',
      'code','provider_subscription_account_mismatch');
  end if;

  select status into v_profile_status from research_binding_review.profiles
    where account_id=p_account_id for update;
  if not found or v_profile_status <> 'active' then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values(v_paid_id,p_event_id,p_subscription_id,p_account_id,'account_unavailable');
    return jsonb_build_object('disposition','conflict','code','account_unavailable');
  end if;

  select * into v_sub from research_binding_review.subscriptions
    where account_id=p_account_id and provider_subscription_id=p_subscription_id
    for update;
  if not found then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,'unbound_subscription');
    return jsonb_build_object('disposition','conflict','code','unbound_subscription');
  end if;

  if v_sub.status not in ('pending','active') then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'subscription_not_activatable');
    return jsonb_build_object('disposition','conflict',
      'code','subscription_not_activatable');
  end if;

  select * into v_ent from research_binding_review.entitlements
    where account_id=p_account_id and product_id='research-membership'
      and state='active' for update;
  if found then
    if v_sub.status='active' and v_ent.source='paid'
       and v_ent.provider_subscription_id=p_subscription_id then
      return jsonb_build_object('disposition','already_active');
    end if;
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,'entitlement_conflict');
    return jsonb_build_object('disposition','conflict','code','entitlement_conflict');
  end if;

  -- A terminal/refunded/cancelled or pre-existing active subscription must
  -- never be reactivated or granted a fresh entitlement by this function.
  if v_sub.status <> 'pending' then
    insert into research_binding_review.conflict_observations(
      paid_observation_id,provider_event_id,provider_subscription_id,
      bound_account_id,conflict_code
    ) values (v_paid_id,p_event_id,p_subscription_id,p_account_id,
      'subscription_not_activatable');
    return jsonb_build_object('disposition','conflict',
      'code','subscription_not_activatable');
  end if;

  update research_binding_review.subscriptions
    set status='active',updated_at=clock_timestamp() where id=v_sub.id;
  insert into research_binding_review.entitlements(
    account_id,product_id,source,provider_subscription_id,state
  ) values (p_account_id,'research-membership','paid',p_subscription_id,'active');
  return jsonb_build_object('disposition','activated');
end;
$$;

alter function research_binding_review.observe_signed_paid(uuid,text,text)
  owner to review_binding_writer;
alter function research_binding_review.try_bind_paid(uuid,text,text)
  owner to review_binding_writer;
alter function research_binding_review.try_activate_paid(uuid,text,text)
  owner to review_binding_writer;
revoke create on schema research_binding_review from review_binding_writer;

-- The same explicit transaction creates and revokes FUNCTION privileges:
-- no intermediate public EXECUTE window. This models D2 review constraints
-- but is NOT a connected Supabase role/grant approval.
revoke all on all functions in schema research_binding_review from public;
-- The API cannot create its own paid proof. The simulated verifier alone may
-- assert a precommitted event. The verifier must be external, not an API alias.
grant execute on function research_binding_review.observe_signed_paid(uuid,text,text)
  to review_binding_verifier;
grant execute on function research_binding_review.try_bind_paid(uuid,text,text)
  to review_binding_api;
grant execute on function research_binding_review.try_activate_paid(uuid,text,text)
  to review_binding_api;

commit;
