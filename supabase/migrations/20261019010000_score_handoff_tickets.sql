-- DRAFT ONLY. Do not apply before security review and Preview acceptance.
-- Server-only, one-time Score handoff tickets; no raw ticket is persisted.
begin;

create table if not exists public.score_handoff_tickets (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  account_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience = 'score.usd-impact.com'),
  path text not null check (path in ('/en/', '/es/', '/archive/en/', '/archive/es/')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint score_ticket_max_lifetime check (expires_at <= created_at + interval '60 seconds')
);
create index if not exists score_handoff_tickets_expiry_idx on public.score_handoff_tickets(expires_at);
alter table public.score_handoff_tickets enable row level security;
revoke all on table public.score_handoff_tickets from public, anon, authenticated;
grant select, insert, delete on table public.score_handoff_tickets to service_role;

-- Must run only from trusted server with secret/service credentials.
-- ON CONFLICT prevents accidental digest reuse. Validation is repeated by DB.
create or replace function public.score_ticket_issue_atomic(
  p_digest text, p_account_id uuid, p_audience text, p_path text, p_expires_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_inserted integer;
begin
  if p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
     or p_account_id is null
     or p_audience is null or p_audience <> 'score.usd-impact.com'
     or p_path is null or p_path not in ('/en/', '/es/', '/archive/en/', '/archive/es/')
     or p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '60 seconds' then
    return false;
  end if;
  insert into public.score_handoff_tickets(digest, account_id, audience, path, expires_at)
  values(p_digest, p_account_id, p_audience, p_path, p_expires_at)
  on conflict (digest) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

-- DELETE RETURNING is atomic across concurrent consumers; only one wins.
create or replace function public.score_ticket_consume_atomic(p_digest text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_row public.score_handoff_tickets%rowtype;
begin
  if p_digest !~ '^[a-f0-9]{64}$' then return null; end if;
  delete from public.score_handoff_tickets
  where digest = p_digest and expires_at > now()
  returning * into v_row;
  if not found then return null; end if;
  return jsonb_build_object(
    'digest', v_row.digest, 'account_id', v_row.account_id,
    'audience', v_row.audience, 'path', v_row.path,
    'expires_at', v_row.expires_at
  );
end;
$$;

revoke all on function public.score_ticket_issue_atomic(text,uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.score_ticket_consume_atomic(text) from public, anon, authenticated;
grant execute on function public.score_ticket_issue_atomic(text,uuid,text,text,timestamptz) to service_role;
grant execute on function public.score_ticket_consume_atomic(text) to service_role;
comment on table public.score_handoff_tickets is 'Server-only ephemeral SHA-256 ticket digests for Score handoff; never stores bearer ticket';
commit;