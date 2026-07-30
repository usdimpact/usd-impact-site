begin;

create extension if not exists pgcrypto;

create type public.account_status as enum (
  'active',
  'suspended',
  'deletion_pending',
  'deleted'
);

create type public.purchase_intent_status as enum (
  'pending',
  'checkout_created',
  'completed',
  'failed',
  'expired',
  'cancelled'
);

create type public.purchase_status as enum (
  'completed',
  'refunded',
  'disputed',
  'charged_back'
);

create type public.entitlement_state as enum (
  'active',
  'suspended',
  'suspended_dispute',
  'refunded',
  'charged_back',
  'revoked',
  'account_deleted'
);

create type public.privacy_request_type as enum (
  'access',
  'export',
  'correction',
  'restriction',
  'objection',
  'deletion'
);

create type public.request_status as enum (
  'open',
  'in_progress',
  'completed',
  'rejected',
  'cancelled'
);

create table public.profiles (
  account_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  display_name text,
  status public.account_status not null default 'active',
  deletion_requested_at timestamptz,
  deletion_due_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_length check (char_length(email) between 3 and 254),
  constraint profiles_deletion_window check (
    deletion_due_at is null
    or deletion_requested_at is not null
  )
);

create table public.product_offers (
  product_id text primary key,
  currency text not null,
  launch_price_cents integer not null,
  standard_price_cents integer not null,
  purchase_limit integer not null,
  launch_starts_at timestamptz not null,
  launch_ends_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_offers_currency check (currency ~ '^[A-Z]{3}$'),
  constraint product_offers_prices check (
    launch_price_cents > 0
    and standard_price_cents > launch_price_cents
  ),
  constraint product_offers_purchase_limit check (purchase_limit > 0),
  constraint product_offers_window check (launch_ends_at > launch_starts_at)
);

create table public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null references public.product_offers(product_id) on delete restrict,
  status public.purchase_intent_status not null default 'pending',
  price_tier text not null,
  amount_cents integer not null,
  currency text not null,
  offer_terms jsonb not null,
  provider_checkout_id text unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_intents_price_tier check (price_tier in ('launch', 'standard')),
  constraint purchase_intents_amount check (amount_cents > 0),
  constraint purchase_intents_currency check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_intents_offer_terms_object check (jsonb_typeof(offer_terms) = 'object')
);

create index purchase_intents_account_created_idx
  on public.purchase_intents(account_id, created_at desc);
create index purchase_intents_product_status_idx
  on public.purchase_intents(product_id, status);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  purchase_intent_id uuid references public.purchase_intents(id) on delete restrict,
  product_id text not null,
  provider text not null,
  provider_customer_id text,
  provider_transaction_id text not null unique,
  status public.purchase_status not null default 'completed',
  amount_cents integer not null,
  currency text not null,
  price_tier text not null,
  offer_terms jsonb not null,
  completed_at timestamptz not null,
  refunded_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_amount check (amount_cents > 0),
  constraint purchases_currency check (currency ~ '^[A-Z]{3}$'),
  constraint purchases_price_tier check (price_tier in ('launch', 'standard')),
  constraint purchases_offer_terms_object check (jsonb_typeof(offer_terms) = 'object')
);

create index purchases_account_completed_idx
  on public.purchases(account_id, completed_at desc);
create index purchases_product_status_idx
  on public.purchases(product_id, status);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  product_id text not null,
  state public.entitlement_state not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_version check (version > 0),
  constraint entitlements_window check (ends_at is null or ends_at > starts_at),
  unique (account_id, product_id)
);

create index entitlements_account_state_idx
  on public.entitlements(account_id, state);

create table public.entitlement_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  entitlement_id uuid not null references public.entitlements(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  product_id text not null,
  from_state public.entitlement_state,
  to_state public.entitlement_state not null,
  reason text not null,
  actor_type text not null,
  actor_id text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint entitlement_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index entitlement_events_entitlement_occurred_idx
  on public.entitlement_events(entitlement_id, occurred_at desc);

create table public.webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_sha256 text not null,
  status text not null default 'received',
  attempt_count integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (provider, provider_event_id),
  constraint webhook_receipts_status check (status in ('received', 'processed', 'failed', 'ignored')),
  constraint webhook_receipts_attempt_count check (attempt_count > 0),
  constraint webhook_receipts_hash check (payload_sha256 ~ '^[a-f0-9]{64}$')
);

create table public.learning_progress (
  account_id uuid not null references public.profiles(account_id) on delete cascade,
  content_id text not null,
  status text not null default 'started',
  progress_percent integer not null default 0,
  resume_position text,
  mastery_score integer,
  attempt_count integer not null default 0,
  completed_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, content_id),
  constraint learning_progress_status check (status in ('started', 'in_progress', 'completed')),
  constraint learning_progress_percent check (progress_percent between 0 and 100),
  constraint learning_progress_mastery check (mastery_score is null or mastery_score between 0 and 100),
  constraint learning_progress_attempt_count check (attempt_count >= 0),
  constraint learning_progress_data_object check (jsonb_typeof(data) = 'object')
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete cascade,
  content_id text not null,
  anchor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookmarks_account_created_idx
  on public.bookmarks(account_id, created_at desc);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles(account_id) on delete set null,
  email text,
  category text not null,
  subject text not null,
  message text not null,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint support_requests_identity check (account_id is not null or email is not null)
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles(account_id) on delete set null,
  email text not null,
  request_type public.privacy_request_type not null,
  status public.request_status not null default 'open',
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '1 month'),
  completed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_entries (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  reason text not null,
  before_state jsonb,
  after_state jsonb,
  evidence_reference text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_audit_before_object check (before_state is null or jsonb_typeof(before_state) = 'object'),
  constraint admin_audit_after_object check (after_state is null or jsonb_typeof(after_state) = 'object')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger product_offers_set_updated_at
before update on public.product_offers
for each row execute function public.set_updated_at();
create trigger purchase_intents_set_updated_at
before update on public.purchase_intents
for each row execute function public.set_updated_at();
create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();
create trigger learning_progress_set_updated_at
before update on public.learning_progress
for each row execute function public.set_updated_at();
create trigger bookmarks_set_updated_at
before update on public.bookmarks
for each row execute function public.set_updated_at();
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.set_updated_at();
create trigger privacy_requests_set_updated_at
before update on public.privacy_requests
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (account_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (account_id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.product_offers enable row level security;
alter table public.purchase_intents enable row level security;
alter table public.purchases enable row level security;
alter table public.entitlements enable row level security;
alter table public.entitlement_events enable row level security;
alter table public.webhook_receipts enable row level security;
alter table public.learning_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.support_requests enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.admin_audit_entries enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Authenticated customers receive narrowly scoped read access to their own records.
grant select on public.profiles to authenticated;
grant select on public.purchase_intents to authenticated;
grant select on public.purchases to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.entitlement_events to authenticated;
grant select, insert, update, delete on public.learning_progress to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert on public.support_requests to authenticated;
grant select, insert on public.privacy_requests to authenticated;

grant usage, select on all sequences in schema public to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (account_id = auth.uid());

create policy purchase_intents_select_own
on public.purchase_intents
for select
to authenticated
using (account_id = auth.uid());

create policy purchases_select_own
on public.purchases
for select
to authenticated
using (account_id = auth.uid());

create policy entitlements_select_own
on public.entitlements
for select
to authenticated
using (account_id = auth.uid());

create policy entitlement_events_select_own
on public.entitlement_events
for select
to authenticated
using (account_id = auth.uid());

create policy learning_progress_select_own
on public.learning_progress
for select
to authenticated
using (account_id = auth.uid());
create policy learning_progress_insert_own
on public.learning_progress
for insert
to authenticated
with check (
  account_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.account_id = auth.uid()
      and p.status = 'active'
  )
);
create policy learning_progress_update_own
on public.learning_progress
for update
to authenticated
using (account_id = auth.uid())
with check (
  account_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.account_id = auth.uid()
      and p.status = 'active'
  )
);
create policy learning_progress_delete_own
on public.learning_progress
for delete
to authenticated
using (account_id = auth.uid());

create policy bookmarks_select_own
on public.bookmarks
for select
to authenticated
using (account_id = auth.uid());
create policy bookmarks_insert_own
on public.bookmarks
for insert
to authenticated
with check (
  account_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.account_id = auth.uid()
      and p.status = 'active'
  )
);
create policy bookmarks_update_own
on public.bookmarks
for update
to authenticated
using (account_id = auth.uid())
with check (
  account_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.account_id = auth.uid()
      and p.status = 'active'
  )
);
create policy bookmarks_delete_own
on public.bookmarks
for delete
to authenticated
using (account_id = auth.uid());

create policy support_requests_select_own
on public.support_requests
for select
to authenticated
using (account_id = auth.uid());
create policy support_requests_insert_own
on public.support_requests
for insert
to authenticated
with check (account_id = auth.uid());

create policy privacy_requests_select_own
on public.privacy_requests
for select
to authenticated
using (account_id = auth.uid());
create policy privacy_requests_insert_own
on public.privacy_requests
for insert
to authenticated
with check (account_id = auth.uid());

-- Service-role and database-owner paths retain full access. Browser roles receive no
-- write grants for purchases, entitlements, webhook receipts, offers, or audit logs.

create or replace function public.account_export(export_account_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'email' || jsonb_build_object('email', p.email) from public.profiles p where p.account_id = export_account_id),
    'purchases', coalesce((select jsonb_agg(to_jsonb(x) order by x.completed_at desc) from public.purchases x where x.account_id = export_account_id), '[]'::jsonb),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.entitlements x where x.account_id = export_account_id), '[]'::jsonb),
    'learningProgress', coalesce((select jsonb_agg(to_jsonb(x) order by x.content_id) from public.learning_progress x where x.account_id = export_account_id), '[]'::jsonb),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.bookmarks x where x.account_id = export_account_id), '[]'::jsonb),
    'supportRequests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.support_requests x where x.account_id = export_account_id), '[]'::jsonb),
    'privacyRequests', coalesce((select jsonb_agg(to_jsonb(x) order by x.requested_at) from public.privacy_requests x where x.account_id = export_account_id), '[]'::jsonb)
  )
  where export_account_id = auth.uid();
$$;

revoke all on function public.account_export(uuid) from public, anon;
grant execute on function public.account_export(uuid) to authenticated;

create or replace function public.request_account_deletion()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  update public.profiles
  set status = 'deletion_pending',
      deletion_requested_at = now(),
      deletion_due_at = now() + interval '7 days',
      updated_at = now()
  where account_id = auth.uid()
    and status = 'active'
  returning * into updated_profile;

  if updated_profile.account_id is null then
    raise exception 'account is not eligible for deletion request';
  end if;

  insert into public.privacy_requests (
    account_id,
    email,
    request_type,
    status,
    requested_at,
    due_at
  ) values (
    updated_profile.account_id,
    updated_profile.email,
    'deletion',
    'open',
    now(),
    now() + interval '1 month'
  );

  return updated_profile;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

insert into public.product_offers (
  product_id,
  currency,
  launch_price_cents,
  standard_price_cents,
  purchase_limit,
  launch_starts_at,
  launch_ends_at
) values (
  'read-the-dollar-first-guided-interactive-edition',
  'USD',
  3900,
  4900,
  100,
  '2099-01-01T00:00:00Z',
  '2099-01-31T00:00:00Z'
)
on conflict (product_id) do nothing;

commit;
