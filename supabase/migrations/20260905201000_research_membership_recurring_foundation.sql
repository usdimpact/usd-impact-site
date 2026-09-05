begin;

-- Provider-neutral recurring subscription foundation for Research Membership.
-- This migration defines Development-first state only. It does not configure a
-- commerce provider, create a live subscription, or alter Library Pass semantics.

create type public.subscription_billing_interval as enum (
  'monthly',
  'annual'
);

create type public.subscription_state as enum (
  'pending',
  'active',
  'past_due',
  'cancel_scheduled',
  'cancelled',
  'refunded',
  'disputed',
  'charged_back'
);

create table public.subscription_offers (
  product_id text primary key,
  currency text not null,
  monthly_price_cents integer not null,
  annual_price_cents integer not null,
  trial_days integer not null default 0,
  public_sample_min_age_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_offers_currency check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_offers_prices check (
    monthly_price_cents > 0
    and annual_price_cents > 0
  ),
  constraint subscription_offers_trial_days check (trial_days >= 0),
  constraint subscription_offers_sample_age check (public_sample_min_age_days >= 0)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null references public.subscription_offers(product_id) on delete restrict,
  provider text not null,
  provider_subscription_id text not null,
  provider_customer_id text,
  provider_price_id text,
  billing_interval public.subscription_billing_interval not null,
  state public.subscription_state not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_scheduled_at timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,
  last_provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_length check (char_length(provider) between 1 and 100),
  constraint subscriptions_provider_subscription_id_length check (char_length(provider_subscription_id) between 1 and 255),
  constraint subscriptions_version check (version > 0),
  constraint subscriptions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint subscriptions_period_window check (
    current_period_start is null
    or current_period_end is null
    or current_period_end > current_period_start
  ),
  constraint subscriptions_cancel_scheduled_shape check (
    state <> 'cancel_scheduled'
    or (cancel_at_period_end = true and current_period_end is not null)
  ),
  unique (provider, provider_subscription_id)
);

create unique index subscriptions_one_current_product_idx
  on public.subscriptions(account_id, product_id)
  where state in ('pending', 'active', 'past_due', 'cancel_scheduled');

create index subscriptions_account_state_idx
  on public.subscriptions(account_id, state);

create index subscriptions_product_state_idx
  on public.subscriptions(product_id, state);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null,
  from_state public.subscription_state,
  to_state public.subscription_state not null,
  reason text not null,
  actor_type text not null,
  actor_id text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint subscription_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index subscription_events_subscription_occurred_idx
  on public.subscription_events(subscription_id, occurred_at desc);

create or replace function public.validate_subscription_state_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.state = old.state then
    return new;
  end if;

  if old.state = 'pending' and new.state in ('active', 'cancelled') then
    return new;
  end if;

  if old.state = 'active' and new.state in (
    'past_due', 'cancel_scheduled', 'cancelled', 'refunded', 'disputed', 'charged_back'
  ) then
    return new;
  end if;

  if old.state = 'past_due' and new.state in (
    'active', 'cancel_scheduled', 'cancelled', 'refunded', 'disputed', 'charged_back'
  ) then
    return new;
  end if;

  if old.state = 'cancel_scheduled' and new.state in (
    'active', 'cancelled', 'refunded', 'disputed', 'charged_back'
  ) then
    return new;
  end if;

  if old.state = 'disputed' and new.state in (
    'active', 'refunded', 'charged_back'
  ) then
    return new;
  end if;

  raise exception 'invalid subscription state transition: % -> %', old.state, new.state;
end;
$$;

create trigger subscriptions_validate_state_transition
before update of state on public.subscriptions
for each row execute function public.validate_subscription_state_transition();

create trigger subscription_offers_set_updated_at
before update on public.subscription_offers
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Link recurring entitlements to their subscription without changing existing
-- one-time purchase-backed Library Pass entitlements.
alter table public.entitlements
  add column subscription_id uuid references public.subscriptions(id) on delete restrict;

alter table public.entitlements
  add constraint entitlements_single_commercial_source check (
    not (purchase_id is not null and subscription_id is not null)
  );

create unique index entitlements_subscription_id_unique_idx
  on public.entitlements(subscription_id)
  where subscription_id is not null;

alter table public.subscription_offers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

revoke all on public.subscription_offers from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.subscription_events from anon, authenticated;

-- Customers may read only their own recurring billing state. Browser roles do
-- not receive write privileges; provider/webhook processing remains server-only.
grant select on public.subscriptions to authenticated;
grant select on public.subscription_events to authenticated;

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (account_id = auth.uid());

create policy subscription_events_select_own
on public.subscription_events
for select
to authenticated
using (account_id = auth.uid());

insert into public.subscription_offers (
  product_id,
  currency,
  monthly_price_cents,
  annual_price_cents,
  trial_days,
  public_sample_min_age_days
) values (
  'research-membership',
  'USD',
  2900,
  29000,
  0,
  30
)
on conflict (product_id) do nothing;

commit;
