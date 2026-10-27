-- DRAFT: Score sessions and authoritative current membership check.
-- Review and test in isolated Preview before applying to Production.
begin;
create table if not exists public.score_member_sessions (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  account_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint score_session_lifetime check (expires_at <= created_at + interval '15 minutes')
);
create index if not exists score_member_sessions_expiry_idx on public.score_member_sessions(expires_at);
alter table public.score_member_sessions enable row level security;
revoke all on table public.score_member_sessions from public, anon, authenticated;
grant select, insert, delete on table public.score_member_sessions to service_role;

create or replace function public.score_membership_active(p_account_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.entitlements e on e.account_id = p.account_id
    where p.account_id = p_account_id and p.status = 'active'
      and e.product_id = 'research-membership' and e.state = 'active'
      and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      and p.deleted_at is null
  );
$$;

create or replace function public.score_session_create(
  p_digest text, p_account_id uuid, p_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
  if p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
     or p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '15 minutes'
     or not public.score_membership_active(p_account_id) then return false; end if;
  insert into public.score_member_sessions(digest, account_id, expires_at)
    values(p_digest, p_account_id, p_expires_at)
    on conflict (digest) do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.score_session_lookup(p_digest text)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare v_row public.score_member_sessions%rowtype;
begin
  if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into v_row from public.score_member_sessions
    where digest = p_digest and expires_at > now();
  if not found or not public.score_membership_active(v_row.account_id) then return null; end if;
  return jsonb_build_object('account_id',v_row.account_id,'expires_at',v_row.expires_at);
end;
$$;
revoke all on function public.score_membership_active(uuid) from public, anon, authenticated;
revoke all on function public.score_session_create(text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.score_session_lookup(text) from public, anon, authenticated;
grant execute on function public.score_membership_active(uuid) to service_role;
grant execute on function public.score_session_create(text,uuid,timestamptz) to service_role;
grant execute on function public.score_session_lookup(text) to service_role;
commit;
