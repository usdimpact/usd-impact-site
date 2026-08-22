-- Development-verified Web Push subscription foundation.
-- Subscription endpoint/key material is server-only by design.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete cascade,
  endpoint_hash text not null check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  endpoint text not null check (char_length(endpoint) between 1 and 4096),
  p256dh text not null check (char_length(p256dh) between 1 and 512),
  auth_secret text not null check (char_length(auth_secret) between 1 and 512),
  expiration_time bigint,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (account_id, endpoint_hash)
);

alter table public.push_subscriptions enable row level security;

-- Deliberately no anon/authenticated policies or grants. Browser push
-- credentials are handled only by authenticated server endpoints using the
-- service role, so they are not exposed through the Data API to clients.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create index if not exists push_subscriptions_delivery_idx
  on public.push_subscriptions (enabled, account_id)
  where enabled = true;

comment on table public.push_subscriptions is
  'Server-only Web Push subscription material. Never expose endpoint or key material directly through the public client.';
