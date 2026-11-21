-- Issue #950 — REVIEW ONLY: operator-only Auth-confirmed token-loss recovery.
-- Apply after the review-only atomic claim and transactional escrow SQL, and
-- ONLY inside disposable synthetic CI PostgreSQL. NOT a Supabase migration.
--
-- THREAT BOUNDARY: this does not allow recovery from auth_dispatched or
-- auth_ambiguous, cannot repeat Auth DELETE, and is NOT a service-role RPC.
-- It is an unexposed, SECURITY INVOKER, postgres-operator-only function.
-- A separately attested change/security ticket is required by OPERATIONS;
-- the DB records references but cannot independently attest human approval.
begin;

do $preflight$
begin
  if pg_catalog.to_regclass('account_deletion_internal.attempts') is null
    or pg_catalog.to_regclass('account_deletion_internal.completion_intents') is null
    or pg_catalog.to_regprocedure('public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)') is null
    or pg_catalog.to_regprocedure('account_deletion_internal.finalize_account_deletion(uuid)') is null
  then
    raise exception 'account deletion claim/escrow prerequisite missing';
  end if;
  if pg_catalog.to_regclass('account_deletion_internal.confirmed_recovery_audit') is not null then
    raise exception 'confirmed token-loss recovery audit already installed';
  end if;
end
$preflight$;

create table account_deletion_internal.confirmed_recovery_audit (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  request_id uuid not null,
  attempt_id uuid not null,
  generation bigint not null check (generation > 0),
  operator_role text not null,
  change_ticket text not null
    check (change_ticket ~ '^[A-Za-z0-9][A-Za-z0-9:/_-]{7,79}$'),
  security_review_ticket text not null
    check (security_review_ticket ~ '^[A-Za-z0-9][A-Za-z0-9:/_-]{7,79}$'),
  recovered_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint confirmed_recovery_distinct_tickets
    check (change_ticket <> security_review_ticket),
  constraint confirmed_recovery_unique_account_request
    unique(account_id,request_id),
  constraint confirmed_recovery_unique_attempt
    unique(attempt_id)
);
alter table account_deletion_internal.confirmed_recovery_audit enable row level security;
revoke all on account_deletion_internal.confirmed_recovery_audit
  from public, anon, authenticated, service_role;
revoke all on schema account_deletion_internal
  from public, anon, authenticated, service_role;

-- Shared, private, identical erasure+escrow path for normal token-fenced
-- finalization and operator-only confirmed-state recovery. SECURITY INVOKER
-- under the definer-owner context for ordinary service-role finalization,
-- or under the postgres operator for the manual path.
create function account_deletion_internal.complete_confirmed_deletion(
  complete_account_id uuid,
  complete_request_id uuid,
  complete_attempt_id uuid,
  complete_generation bigint
)
returns table (
  account_id uuid,
  recipient_email text,
  deletion_requested_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $complete$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  f record;
  v_recipient text;
  v_now timestamptz;
begin
  if complete_account_id is null or complete_request_id is null
    or complete_attempt_id is null or complete_generation is null
    or complete_generation < 1 then
    raise exception using errcode='22023',
      message='confirmed finalization identity is incomplete';
  end if;

  -- Global lock order: profile then attempt. The procedure may only run
  -- after a previously token-fenced HTTP 200/204 confirmation was committed.
  select x.* into p from public.profiles x
    where x.account_id=complete_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id=complete_account_id for update;
  v_now:=pg_catalog.clock_timestamp();

  if p.account_id is null or a.account_id is null
    or a.state <> 'auth_confirmed'
    or a.request_id is distinct from complete_request_id
    or a.attempt_id is distinct from complete_attempt_id
    or a.generation is distinct from complete_generation
    or a.claim_token_sha256 is null
    or a.expected_auth_user_id is distinct from p.account_id
    or a.auth_dispatched_at is null
    or a.auth_outcome_at is null
    or a.auth_outcome_at < a.auth_dispatched_at
    or a.finalized_at is not null
    or p.status <> 'deletion_pending'
    or p.deleted_at is not null
    or p.deletion_request_id is distinct from a.request_id
    or p.deletion_requested_at is null
    or p.deletion_requested_at is distinct from a.requested_at
    or p.deletion_due_at is null
    or p.deletion_due_at is distinct from a.due_at
    or p.deletion_due_at > v_now
    or p.auth_user_id is not null
  then
    raise exception using errcode='55000',
      message='confirmed-state erasure fence rejected';
  end if;

  -- Existing private reviewed core must return the ORIGINAL recipient.
  -- Its profile, entitlement, support, privacy and audit changes will roll
  -- back if either the completion intent or the operator audit fails.
  select x.* into f
    from account_deletion_internal.finalize_account_deletion(complete_account_id) x;

  if not found or f.account_id is distinct from complete_account_id
    or f.deleted_at is null or f.deletion_requested_at is null
    or f.deletion_requested_at is distinct from p.deletion_requested_at
    or f.recipient_email is null then
    raise exception using errcode='55000',
      message='erasure core did not provide a durable completion identity';
  end if;
  v_recipient:=pg_catalog.lower(pg_catalog.btrim(f.recipient_email));
  if v_recipient='' or pg_catalog.strpos(v_recipient,'@') <= 1
    or pg_catalog.length(v_recipient) > 320 then
    raise exception using errcode='55000',
      message='completion recipient invalid; erasure aborted';
  end if;

  insert into account_deletion_internal.completion_intents(
    account_id,deletion_request_id,recipient_email_normalized,
    deletion_requested_at,deleted_at,state
  ) values (
    f.account_id,a.request_id,v_recipient,
    f.deletion_requested_at,f.deleted_at,'pending'
  );

  update account_deletion_internal.attempts x
  set state='finalized',finalized_at=v_now,updated_at=v_now
  where x.account_id=complete_account_id and x.state='auth_confirmed';

  return query select f.account_id,f.recipient_email,
    f.deletion_requested_at,f.deleted_at;
end
$complete$;

revoke all on function
  account_deletion_internal.complete_confirmed_deletion(uuid,uuid,uuid,bigint)
  from public, anon, authenticated, service_role;

-- Retain the original normal 4-argument service-role API. The token is
-- verified against the stored digest BEFORE invoking the common private
-- erasure+escrow implementation, preserving ordinary worker fencing.
create or replace function public.finalize_claimed_account_deletion(
  finalize_account_id uuid,
  finalize_request_id uuid,
  finalize_token uuid,
  finalize_generation bigint
)
returns table (
  account_id uuid,recipient_email text,
  deletion_requested_at timestamptz,deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $finalizer$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
begin
  if finalize_account_id is null or finalize_request_id is null
    or finalize_token is null or finalize_generation is null then
    raise exception using errcode='22023',message='fenced finalization identity missing';
  end if;
  select x.* into p from public.profiles x
    where x.account_id=finalize_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id=finalize_account_id for update;

  if p.account_id is null or a.account_id is null
    or a.state <> 'auth_confirmed'
    or a.request_id is distinct from finalize_request_id
    or a.generation is distinct from finalize_generation
    or a.claim_token_sha256 is distinct from
        pg_catalog.sha256(pg_catalog.convert_to(finalize_token::text,'UTF8'))
  then
    raise exception using errcode='55000',
      message='account deletion finalize fence rejected';
  end if;

  return query
    select x.* from account_deletion_internal.complete_confirmed_deletion(
      finalize_account_id,finalize_request_id,a.attempt_id,finalize_generation
    ) x;
end
$finalizer$;
revoke all on function
  public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  from public,anon,authenticated;
grant execute on function
  public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  to service_role;

-- This operator-only procedure is intentionally not in public/REST.
-- There is no ability to confirm Auth or change auth_dispatched into
-- auth_confirmed here. It cannot retry Auth DELETE or reset ownership.
create function account_deletion_internal.recover_confirmed_without_token(
  recover_account_id uuid,
  recover_request_id uuid,
  recover_attempt_id uuid,
  recover_generation bigint,
  recover_change_ticket text,
  recover_security_review_ticket text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $recover$
declare
  f record;
  v_count integer := 0;
begin
  -- Postgres DBA only. RPC service_role is prohibited even if accidentally
  -- granted USAGE on the private schema in a later schema edit.
  if current_user <> 'postgres' then
    raise exception using errcode='42501',
      message='only an authorized DBA role may recover a confirmed deletion';
  end if;
  if recover_change_ticket is null
    or recover_change_ticket !~ '^[A-Za-z0-9][A-Za-z0-9:/_-]{7,79}$'
    or recover_security_review_ticket is null
    or recover_security_review_ticket !~ '^[A-Za-z0-9][A-Za-z0-9:/_-]{7,79}$'
    or recover_change_ticket=recover_security_review_ticket then
    raise exception using errcode='22023',
      message='distinct change/security review ticket references required';
  end if;

  for f in
    select * from account_deletion_internal.complete_confirmed_deletion(
      recover_account_id,recover_request_id,recover_attempt_id,
      recover_generation
    )
  loop
    v_count:=v_count+1;
    if v_count>1 then
      raise exception using errcode='55000',
        message='confirmed erasure returned unexpected row count';
    end if;
  end loop;
  if v_count<>1 then
    raise exception using errcode='55000',
      message='confirmed erasure did not produce one completion intent';
  end if;

  -- Provenance is durable in the SAME transaction. Ticket strings are
  -- references, NOT cryptographic or automated proof of human signoff.
  insert into account_deletion_internal.confirmed_recovery_audit(
    account_id,request_id,attempt_id,generation,operator_role,
    change_ticket,security_review_ticket
  ) values (
    recover_account_id,recover_request_id,recover_attempt_id,
    recover_generation,current_user::text,
    recover_change_ticket,recover_security_review_ticket
  );

  return true;
end
$recover$;
revoke all on function
  account_deletion_internal.recover_confirmed_without_token(
    uuid,uuid,uuid,bigint,text,text
  ) from public,anon,authenticated,service_role;

commit;
