-- REVIEW-ONLY SQL CANDIDATE for Issue #950.
-- NOT a Supabase migration file. DO NOT EXECUTE on Development or Production
-- without separate database/schema, rollback and synthetic identity approval.
-- Requires current Supabase Postgres 17 + existing account-deletion v2 SQL.
-- This proposal intentionally makes legacy non-fenced entrypoints fail closed.
-- A new, separately authorized CLI-generated migration must be reviewed before
-- any execution. The website finalizer remains DISABLED and is NOT wired here.

begin;

do $preflight$
begin
  if pg_catalog.to_regclass('public.profiles') is null
    or pg_catalog.to_regprocedure('public.request_account_deletion()') is null
    or pg_catalog.to_regprocedure('public.prepare_account_deletion_auth_removal(uuid)') is null
    or pg_catalog.to_regprocedure('public.finalize_account_deletion(uuid)') is null
  then
    raise exception 'account deletion v2 prerequisites are missing';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.status = 'deletion_pending'
      and p.auth_user_id is distinct from p.account_id
  ) then
    raise exception 'pending account with already-detached or mismatched auth link requires manual reconciliation';
  end if;
end
$preflight$;

create schema if not exists account_deletion_internal;
revoke all on schema account_deletion_internal from public, anon, authenticated, service_role;

-- Stable identity distinguishes one request from any later one (ABA protection).
alter table public.profiles add column if not exists deletion_request_id uuid;
update public.profiles p
set deletion_request_id = pg_catalog.gen_random_uuid()
where p.status = 'deletion_pending' and p.deletion_request_id is null;
alter table public.profiles
  add constraint profiles_deletion_request_identity
  check (status <> 'deletion_pending' or deletion_request_id is not null);

create table account_deletion_internal.attempts (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  request_id uuid not null,
  attempt_id uuid not null unique,
  generation bigint not null check (generation > 0),
  claim_token_sha256 bytea not null,
  worker_nonce uuid not null,
  expected_auth_user_id uuid not null,
  requested_at timestamptz not null,
  due_at timestamptz not null,
  state text not null check (
    state in ('claimed', 'auth_dispatched', 'auth_confirmed', 'auth_ambiguous', 'finalized')
  ),
  claimed_at timestamptz not null,
  pre_dispatch_expires_at timestamptz not null,
  auth_dispatched_at timestamptz,
  auth_outcome_at timestamptz,
  finalized_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null,
  constraint deletion_attempt_time_order check (pre_dispatch_expires_at > claimed_at),
  constraint deletion_attempt_dispatch_precondition check (
    (state = 'claimed' and auth_dispatched_at is null)
    or (state <> 'claimed' and auth_dispatched_at is not null)
  )
);
alter table account_deletion_internal.attempts enable row level security;
revoke all on table account_deletion_internal.attempts from public, anon, authenticated, service_role;

-- The existing request RPC must mint the request UUID at the same time as
-- changing status, under its existing authenticated-user access rule.
create or replace function public.request_account_deletion()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $request$
declare
  caller_account_id uuid := auth.uid();
  updated_profile public.profiles;
begin
  if caller_account_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  update public.profiles
  set status = 'deletion_pending',
      deletion_request_id = pg_catalog.gen_random_uuid(),
      deletion_requested_at = pg_catalog.now(),
      deletion_due_at = pg_catalog.now() + interval '7 days',
      updated_at = pg_catalog.now()
  -- SECURITY DEFINER bypasses RLS. A still-valid JWT cannot authorize
  -- an account whose canonical Auth link was detached, replaced or deleted.
  -- This also closes any inconsistent active-but-already-erased profile.
  where account_id = caller_account_id and status = 'active'
    and auth_user_id = caller_account_id
    and deleted_at is null
  returning * into updated_profile;

  if updated_profile.account_id is null then
    raise exception 'account is not eligible for deletion request';
  end if;

  insert into public.privacy_requests (
    account_id, email, request_type, status, requested_at, due_at
  ) values (
    updated_profile.account_id, updated_profile.email, 'deletion',
    'open', pg_catalog.now(), pg_catalog.now() + interval '1 month'
  );

  return updated_profile;
end
$request$;
revoke all on function public.request_account_deletion() from public, anon, service_role;
grant execute on function public.request_account_deletion() to authenticated;

-- Database row locks on profiles serialize all claim attempts for an account.
-- Return an unpredictable token exactly once to the current worker.
create function public.claim_due_account_deletion(
  claim_account_id uuid,
  claim_request_id uuid,
  claim_worker_nonce uuid
)
returns table (
  claim_token uuid,
  claim_generation bigint,
  claimed_auth_user_id uuid,
  claimed_request_id uuid
)
language plpgsql
security definer
set search_path = ''
as $claim$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_token uuid := pg_catalog.gen_random_uuid();
  v_generation bigint;
begin
  if claim_account_id is null or claim_request_id is null or claim_worker_nonce is null then
    raise exception using errcode = '22023', message = 'claim identity is required';
  end if;

  select x.* into p from public.profiles x
  where x.account_id = claim_account_id
  for update;

  if p.account_id is null
    or p.status <> 'deletion_pending'
    or p.deletion_request_id is distinct from claim_request_id
    or p.deletion_requested_at is null
    or p.deletion_due_at is null
    or p.deletion_due_at > v_now
    or p.deletion_due_at < p.deletion_requested_at
    or p.deleted_at is not null
    or p.auth_user_id is distinct from p.account_id
  then
    raise exception using errcode = '55000', message = 'account deletion is not claimable';
  end if;

  select x.* into a from account_deletion_internal.attempts x
  where x.account_id = claim_account_id
  for update;

  -- A contender can wait on a locked profile/attempt for longer than a lease.
  -- The expiry comparison and new lease timestamps MUST use post-lock time.
  v_now := pg_catalog.clock_timestamp();
  if a.account_id is null then
    v_generation := 1;
    insert into account_deletion_internal.attempts (
      account_id, request_id, attempt_id, generation, claim_token_sha256,
      worker_nonce, expected_auth_user_id, requested_at, due_at, state,
      claimed_at, pre_dispatch_expires_at, updated_at
    ) values (
      p.account_id, p.deletion_request_id, pg_catalog.gen_random_uuid(),
      v_generation,
      pg_catalog.sha256(pg_catalog.convert_to(v_token::text, 'UTF8')),
      claim_worker_nonce, p.auth_user_id, p.deletion_requested_at, p.deletion_due_at,
      'claimed', v_now, v_now + interval '5 minutes', v_now
    );
  elsif a.request_id = claim_request_id and a.state = 'claimed'
    and a.auth_dispatched_at is null and a.pre_dispatch_expires_at <= v_now
  then
    v_generation := a.generation + 1;
    update account_deletion_internal.attempts x
    set attempt_id = pg_catalog.gen_random_uuid(),
        generation = v_generation,
        claim_token_sha256 = pg_catalog.sha256(pg_catalog.convert_to(v_token::text, 'UTF8')),
        worker_nonce = claim_worker_nonce,
        expected_auth_user_id = p.auth_user_id,
        requested_at = p.deletion_requested_at,
        due_at = p.deletion_due_at,
        claimed_at = v_now,
        pre_dispatch_expires_at = v_now + interval '5 minutes',
        updated_at = v_now
    where x.account_id = p.account_id;
  else
    raise exception using errcode = '55000', message = 'account deletion claim already held or dispatched';
  end if;

  return query select v_token, v_generation, p.auth_user_id, p.deletion_request_id;
end
$claim$;
revoke all on function public.claim_due_account_deletion(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_due_account_deletion(uuid,uuid,uuid) to service_role;

-- Begin is a one-shot commit barrier. An RPC response can be lost, in which
-- case no worker may retry Auth DELETE: the record is already auth_dispatched.
-- Auth link detachment and the dispatch intent are in ONE database transaction.
create function public.begin_claimed_auth_removal(
  begin_account_id uuid,
  begin_request_id uuid,
  begin_token uuid,
  begin_generation bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $begin$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if begin_account_id is null or begin_request_id is null
    or begin_token is null or begin_generation is null then
    raise exception using errcode = '22023', message = 'fencing identity is required';
  end if;
  select x.* into p from public.profiles x
    where x.account_id = begin_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id = begin_account_id for update;
  -- Re-sample after the row locks. Entry-time v_now may precede a long wait
  -- and otherwise authorize an expired one-shot Auth dispatch.
  v_now := pg_catalog.clock_timestamp();
  if p.account_id is null or a.account_id is null
    or a.state <> 'claimed'
    or a.generation <> begin_generation
    or a.request_id <> begin_request_id
    or p.deletion_request_id is distinct from begin_request_id
    or a.claim_token_sha256 <>
       pg_catalog.sha256(pg_catalog.convert_to(begin_token::text, 'UTF8'))
    or v_now >= a.pre_dispatch_expires_at
    or p.status <> 'deletion_pending'
    or p.deleted_at is not null
    or p.deletion_due_at > v_now
    or p.deletion_requested_at is distinct from a.requested_at
    or p.deletion_due_at is distinct from a.due_at
    or p.auth_user_id is distinct from a.expected_auth_user_id
    or a.expected_auth_user_id <> p.account_id
  then
    raise exception using errcode = '55000', message = 'deletion dispatch fence rejected';
  end if;

  update account_deletion_internal.attempts x
  set state = 'auth_dispatched',
      auth_dispatched_at = v_now,
      updated_at = v_now
  where x.account_id = begin_account_id;

  update public.profiles x
  set auth_user_id = null, updated_at = v_now
  where x.account_id = begin_account_id;
  return a.expected_auth_user_id;
end
$begin$;
revoke all on function public.begin_claimed_auth_removal(uuid,uuid,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.begin_claimed_auth_removal(uuid,uuid,uuid,bigint)
  to service_role;

-- Only an accepted, definite success response (not a 404, timeout or 503)
-- may mark Auth confirmed. The caller must still undergo separate protected
-- Auth Admin credential/protocol acceptance against synthetic identity.
create function public.confirm_claimed_auth_soft_delete(
  confirm_account_id uuid,
  confirm_request_id uuid,
  confirm_token uuid,
  confirm_generation bigint,
  confirm_http_status integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $confirm$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select x.* into p from public.profiles x
    where x.account_id = confirm_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id = confirm_account_id for update;
  if p.account_id is null or a.account_id is null
    or confirm_token is null or confirm_generation is null
    or confirm_http_status not in (200, 204)
    or a.state <> 'auth_dispatched'
    or a.request_id is distinct from confirm_request_id
    or a.generation <> confirm_generation
    or a.claim_token_sha256 <>
       pg_catalog.sha256(pg_catalog.convert_to(confirm_token::text, 'UTF8'))
    or p.status <> 'deletion_pending'
    or p.deletion_request_id is distinct from a.request_id
    or p.auth_user_id is not null
    or p.deletion_requested_at is distinct from a.requested_at
    or p.deletion_due_at is distinct from a.due_at
  then
    raise exception using errcode = '55000', message = 'Auth result confirmation fence rejected';
  end if;
  update account_deletion_internal.attempts x
  set state = 'auth_confirmed', auth_outcome_at = v_now, updated_at = v_now
  where x.account_id = confirm_account_id;
  return true;
end
$confirm$;
revoke all on function public.confirm_claimed_auth_soft_delete(uuid,uuid,uuid,bigint,integer)
  from public, anon, authenticated;
grant execute on function public.confirm_claimed_auth_soft_delete(uuid,uuid,uuid,bigint,integer)
  to service_role;

-- Unknown Auth outcomes can ONLY move toward manual reconciliation; there
-- is deliberately no automatic claim reset from this state.
create function public.mark_claimed_auth_ambiguous(
  ambiguous_account_id uuid,
  ambiguous_request_id uuid,
  ambiguous_token uuid,
  ambiguous_generation bigint,
  ambiguous_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $ambiguous$
declare
  a account_deletion_internal.attempts;
  p public.profiles;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select x.* into p from public.profiles x where x.account_id=ambiguous_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id=ambiguous_account_id for update;
  if p.account_id is null or a.account_id is null
    or ambiguous_token is null or ambiguous_generation is null
    or a.state <> 'auth_dispatched'
    or a.request_id is distinct from ambiguous_request_id
    or a.generation <> ambiguous_generation
    or a.claim_token_sha256 <>
       pg_catalog.sha256(pg_catalog.convert_to(ambiguous_token::text, 'UTF8'))
    or ambiguous_error_code is null
    or ambiguous_error_code not in (
      'timeout', 'network_error', 'auth_404', 'auth_409', 'auth_429',
      'auth_503', 'auth_unexpected', 'response_lost'
    )
  then
    raise exception using errcode = '55000', message = 'ambiguous result fence rejected';
  end if;
  update account_deletion_internal.attempts x
  set state='auth_ambiguous', last_error_code=ambiguous_error_code,
      updated_at=v_now
  where x.account_id=ambiguous_account_id;
  return true;
end
$ambiguous$;
revoke all on function public.mark_claimed_auth_ambiguous(uuid,uuid,uuid,bigint,text)
  from public, anon, authenticated;
grant execute on function public.mark_claimed_auth_ambiguous(uuid,uuid,uuid,bigint,text)
  to service_role;

-- Lock-sensitive profile changes must not defeat ownership. Routine updated_at
-- modifications remain allowed; only the known begin and confirmed finalization
-- transitions may change the sensitive identity/status columns after claim.
create function account_deletion_internal.enforce_profile_deletion_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  a account_deletion_internal.attempts;
  v_snapshot_ok boolean;
  v_no_identity_change boolean;
  v_detach boolean;
  v_final boolean;
begin
  if old.status <> 'deletion_pending' then return new; end if;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id=old.account_id;
  if a.account_id is null or a.request_id is distinct from old.deletion_request_id
  then return new; end if;
  if a.state='finalized' then return new; end if;

  v_snapshot_ok :=
    new.account_id = old.account_id
    and new.deletion_request_id is not distinct from old.deletion_request_id
    and new.deletion_requested_at is not distinct from old.deletion_requested_at
    and new.deletion_due_at is not distinct from old.deletion_due_at;

  v_no_identity_change :=
    v_snapshot_ok and new.status=old.status
    and new.auth_user_id is not distinct from old.auth_user_id
    and new.email is not distinct from old.email
    and new.display_name is not distinct from old.display_name
    and new.deleted_at is not distinct from old.deleted_at;

  v_detach :=
    v_snapshot_ok and a.state='auth_dispatched'
    and new.status='deletion_pending'
    and old.auth_user_id=a.expected_auth_user_id
    and new.auth_user_id is null
    and new.email is not distinct from old.email
    and new.display_name is not distinct from old.display_name
    and new.deleted_at is not distinct from old.deleted_at;

  v_final :=
    v_snapshot_ok and a.state='auth_confirmed'
    and new.status='deleted' and new.auth_user_id is null
    and old.auth_user_id is null and new.deleted_at is not null
    and new.email like 'deleted+%@accounts.invalid';

  if not (v_no_identity_change or v_detach or v_final) then
    raise exception using errcode='55000', message='claimed deletion forbids profile mutation';
  end if;
  return new;
end
$guard$;
revoke all on function account_deletion_internal.enforce_profile_deletion_fence()
  from public, anon, authenticated, service_role;

create trigger profiles_enforce_account_deletion_claim
before update on public.profiles
for each row execute function account_deletion_internal.enforce_profile_deletion_fence();

-- The legacy plain-account-id procedures must NOT remain alternate bypasses.
-- Move existing core into a non-exposed schema and keep the legacy route as
-- a fail-closed error. This necessarily requires a coordinated app cutover.
alter function public.prepare_account_deletion_auth_removal(uuid)
  set schema account_deletion_internal;
alter function public.finalize_account_deletion(uuid)
  set schema account_deletion_internal;
revoke all on function account_deletion_internal.prepare_account_deletion_auth_removal(uuid)
  from public, anon, authenticated, service_role;
revoke all on function account_deletion_internal.finalize_account_deletion(uuid)
  from public, anon, authenticated, service_role;

create function public.prepare_account_deletion_auth_removal(prepare_account_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $oldprepare$
begin
  raise exception using errcode='55000',
    message='legacy unfenced account deletion preparation is disabled';
end
$oldprepare$;
revoke all on function public.prepare_account_deletion_auth_removal(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_account_deletion_auth_removal(uuid)
  to service_role;

create function public.finalize_account_deletion(finalize_account_id uuid)
returns table (
  account_id uuid, recipient_email text,
  deletion_requested_at timestamptz, deleted_at timestamptz
)
language plpgsql security definer set search_path = ''
as $oldfinalize$
begin
  raise exception using errcode='55000',
    message='legacy unfenced account deletion finalization is disabled';
end
$oldfinalize$;
revoke all on function public.finalize_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_account_deletion(uuid) to service_role;

-- Calls the EXISTING, reviewed erasure/tombstone core only while holding the
-- matching claim/profile row locks in the same transaction.
create function public.finalize_claimed_account_deletion(
  finalize_account_id uuid,
  finalize_request_id uuid,
  finalize_token uuid,
  finalize_generation bigint
)
returns table (
  account_id uuid, recipient_email text,
  deletion_requested_at timestamptz, deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fencefinal$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  f record;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select x.* into p from public.profiles x
    where x.account_id = finalize_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id = finalize_account_id for update;
  if p.account_id is null or a.account_id is null
    or finalize_token is null or finalize_generation is null
    or a.state <> 'auth_confirmed'
    or a.request_id is distinct from finalize_request_id
    or a.generation <> finalize_generation
    or a.claim_token_sha256 <>
      pg_catalog.sha256(pg_catalog.convert_to(finalize_token::text,'UTF8'))
    or p.status <> 'deletion_pending'
    or p.deletion_request_id is distinct from a.request_id
    or p.deletion_requested_at is distinct from a.requested_at
    or p.deletion_due_at is distinct from a.due_at
    or p.auth_user_id is not null
    or p.deleted_at is not null
  then
    raise exception using errcode='55000', message='account deletion finalize fence rejected';
  end if;

  select x.* into f from account_deletion_internal.finalize_account_deletion(finalize_account_id) x;
  if not found or f.account_id is distinct from finalize_account_id
    or f.deleted_at is null then
    raise exception using errcode='55000', message='deletion core did not confirm finalization';
  end if;

  update account_deletion_internal.attempts x
  set state='finalized', finalized_at=v_now, updated_at=v_now
  where x.account_id=finalize_account_id;
  return query select f.account_id, f.recipient_email,
    f.deletion_requested_at, f.deleted_at;
end
$fencefinal$;
revoke all on function public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  to service_role;

commit;
