-- Server-only idempotency ledger for outbound Daily Card publication.
-- No external channel is enabled by this migration.

create table if not exists public.daily_card_dispatches (
  id uuid primary key default gen_random_uuid(),
  publish_date date not null,
  card_id text not null check (char_length(card_id) between 1 and 160),
  channel text not null check (channel in ('telegram')),
  destination_hash text not null check (destination_hash ~ '^[a-f0-9]{64}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) between 1 and 256),
  error_code text check (error_code is null or char_length(error_code) between 1 and 96),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (publish_date, card_id, channel, destination_hash)
);

alter table public.daily_card_dispatches enable row level security;
revoke all on table public.daily_card_dispatches from public, anon, authenticated;
grant select, insert, update on table public.daily_card_dispatches to service_role;

create or replace function public.claim_daily_card_dispatch(
  p_publish_date date,
  p_card_id text,
  p_channel text,
  p_destination_hash text,
  p_payload_sha256 text
)
returns table (
  dispatch_id uuid,
  claim_status text,
  existing_status text,
  existing_payload_sha256 text
)
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_payload text;
begin
  insert into public.daily_card_dispatches (
    publish_date,
    card_id,
    channel,
    destination_hash,
    payload_sha256
  ) values (
    p_publish_date,
    p_card_id,
    p_channel,
    p_destination_hash,
    p_payload_sha256
  )
  on conflict (publish_date, card_id, channel, destination_hash) do nothing
  returning id, status, payload_sha256 into v_id, v_status, v_payload;

  if v_id is not null then
    return query select v_id, 'claimed'::text, v_status, v_payload;
    return;
  end if;

  select id, status, payload_sha256
    into v_id, v_status, v_payload
    from public.daily_card_dispatches
   where publish_date = p_publish_date
     and card_id = p_card_id
     and channel = p_channel
     and destination_hash = p_destination_hash;

  return query select
    v_id,
    case when v_payload = p_payload_sha256 then 'duplicate'::text else 'payload_mismatch'::text end,
    v_status,
    v_payload;
end;
$$;

revoke all on function public.claim_daily_card_dispatch(date, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_daily_card_dispatch(date, text, text, text, text) to service_role;

create index if not exists daily_card_dispatches_status_idx
  on public.daily_card_dispatches (channel, status, publish_date desc);

comment on table public.daily_card_dispatches is
  'Server-only at-most-once ledger for Daily Card outbound publication. Stores hashes rather than raw destinations.';
