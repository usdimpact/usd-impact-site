-- Issue #950 — REVIEW ONLY transactional account-deletion completion recovery.
-- Applies ONLY after the separate account-deletion-atomic-claim.review.sql
-- in an entirely disposable PostgreSQL test fixture.
--
-- NOT an actual migration. No Supabase Development/Production execution is
-- authorized by this file. This is a PII-sensitive cutover proposal.
--
-- Problem: the original finalization RPC scrubs profiles.email and the
-- support/privacy tables before a separate JS call enqueues completion mail.
-- If the process dies after committing finalization but before enqueueing,
-- the recipient is unrecoverable. The recipient must be durably escrowed in
-- the SAME transaction as irreversible profile erasure.
begin;

do $preflight$
begin
  if pg_catalog.to_regclass('account_deletion_internal.attempts') is null
    or pg_catalog.to_regprocedure('public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)') is null
    or pg_catalog.to_regprocedure('account_deletion_internal.finalize_account_deletion(uuid)') is null
    or pg_catalog.to_regclass('public.notification_outbox') is null
  then
    raise exception 'account deletion claim and email-outbox prerequisites missing';
  end if;

  if exists(select 1 from account_deletion_internal.attempts
            where state='finalized') then
    raise exception 'existing finalized claims require a manual transactional-outbox backfill review';
  end if;
end
$preflight$;

create table account_deletion_internal.completion_intents (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  deletion_request_id uuid not null unique,
  recipient_email_normalized text,
  deletion_requested_at timestamptz not null,
  deleted_at timestamptz not null,
  state text not null default 'pending'
    check (state in ('pending','outbox_recorded')),
  outbox_id uuid,
  recorded_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint account_deletion_completion_email_minimal check (
    recipient_email_normalized is null
    or (
      recipient_email_normalized=pg_catalog.lower(pg_catalog.btrim(recipient_email_normalized))
      and pg_catalog.length(recipient_email_normalized) between 3 and 320
      and pg_catalog.strpos(recipient_email_normalized, '@') > 1
    )
  ),
  constraint account_deletion_completion_timeline check (
    deleted_at >= deletion_requested_at
  ),
  constraint account_deletion_completion_state check (
    (state = 'pending'
      and recipient_email_normalized is not null
      and outbox_id is null and recorded_at is null)
    or
    (state = 'outbox_recorded'
      and recipient_email_normalized is null
      and outbox_id is not null and recorded_at is not null)
  )
);

create index account_deletion_completion_pending_idx
 on account_deletion_internal.completion_intents(created_at,account_id)
 where state='pending';

alter table account_deletion_internal.completion_intents enable row level security;
revoke all on table account_deletion_internal.completion_intents
  from public, anon, authenticated, service_role;
revoke all on schema account_deletion_internal
  from public, anon, authenticated, service_role;

-- Replace claim-bound finalizer IN PLACE. The PRIVATE legacy erasure core and
-- the escrow INSERT are in one SQL transaction. Failure in either operation
-- rolls back profile erasure, entitlement transitions, audits and the attempt.
create or replace function public.finalize_claimed_account_deletion(
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
as $fenced_completion$
declare
  p public.profiles;
  a account_deletion_internal.attempts;
  f record;
  v_now timestamptz;
  v_recipient text;
begin
  if finalize_account_id is null or finalize_request_id is null
     or finalize_token is null or finalize_generation is null then
    raise exception using errcode='22023', message='account deletion fencing identity is required';
  end if;

  -- All functions lock profiles BEFORE attempts. Preserve this global order.
  select x.* into p from public.profiles x
    where x.account_id=finalize_account_id for update;
  select x.* into a from account_deletion_internal.attempts x
    where x.account_id=finalize_account_id for update;

  if p.account_id is null or a.account_id is null
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
    or a.expected_auth_user_id is distinct from p.account_id
  then
    raise exception using errcode='55000', message='account deletion finalize fence rejected';
  end if;

  -- Existing reviewed core executes the real erasure and returns ORIGINAL
  -- profile.email. It must not commit independently of this function.
  select x.* into f
  from account_deletion_internal.finalize_account_deletion(finalize_account_id) x;

  if not found or f.account_id is distinct from finalize_account_id
    or f.deleted_at is null or f.deletion_requested_at is null
    or f.recipient_email is null then
    raise exception using errcode='55000',
      message='deletion erasure core did not return a recoverable completion';
  end if;

  v_recipient:=pg_catalog.lower(pg_catalog.btrim(f.recipient_email));
  if v_recipient='' or pg_catalog.strpos(v_recipient,'@')<=1
    or pg_catalog.length(v_recipient)>320 then
    raise exception using errcode='55000',
      message='completion recipient is invalid; aborting database erasure';
  end if;

  -- Any duplicate/account collision fails closed. This must commit WITH the
  -- deletion and cannot be deferred to Node, Resend or an after-commit hook.
  insert into account_deletion_internal.completion_intents(
    account_id,deletion_request_id,recipient_email_normalized,
    deletion_requested_at,deleted_at,state
  ) values (
    f.account_id,a.request_id,v_recipient,
    f.deletion_requested_at,f.deleted_at,'pending'
  );

  v_now:=pg_catalog.clock_timestamp();
  update account_deletion_internal.attempts x
  set state='finalized',finalized_at=v_now,updated_at=v_now
  where x.account_id=finalize_account_id and x.state='auth_confirmed';

  return query select f.account_id,f.recipient_email,
    f.deletion_requested_at,f.deleted_at;
end
$fenced_completion$;

revoke all on function public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)
  to service_role;

-- Service-only recovery inventory: no secrets or tokens are exposed, but the
-- recipient address is sensitive. Caller MUST NEVER log raw RPC JSON.
-- This list is read-only and does NOT claim a send or permit Auth retries.
create function public.list_account_deletion_completion_recoveries(
  max_items integer default 5
)
returns table (
  account_id uuid,
  deletion_request_id uuid,
  recipient_email_normalized text,
  deletion_requested_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $list$
begin
  if max_items is null or max_items<1 or max_items>5 then
    raise exception using errcode='22023',
      message='completion recovery batch must be between 1 and 5';
  end if;

  return query
    select x.account_id,x.deletion_request_id,
      x.recipient_email_normalized,x.deletion_requested_at,x.deleted_at
    from account_deletion_internal.completion_intents x
    join account_deletion_internal.attempts a
      on a.account_id=x.account_id and a.request_id=x.deletion_request_id
    join public.profiles p on p.account_id=x.account_id
    where x.state='pending'
      and a.state='finalized'
      and p.status='deleted' and p.auth_user_id is null
      and x.recipient_email_normalized is not null
    order by x.created_at,x.account_id
    limit max_items;
end
$list$;

revoke all on function public.list_account_deletion_completion_recoveries(integer)
  from public, anon, authenticated;
grant execute on function public.list_account_deletion_completion_recoveries(integer)
  to service_role;

-- A queued email must already exist in the REAL notification_outbox BEFORE
-- escrow can be scrubbed. Verify exact recipient, account, state-version and
-- approved message identity. A client-provided arbitrary UUID is insufficient.
-- Retry with same outbox is idempotent; a different outbox is a hard conflict.
create function public.confirm_account_deletion_completion_outbox(
  recorded_account_id uuid,
  recorded_request_id uuid,
  recorded_outbox_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $mark$
declare
  x account_deletion_internal.completion_intents;
  a account_deletion_internal.attempts;
  p public.profiles;
  o public.notification_outbox;
  v_expected_version integer;
  v_now timestamptz;
begin
  if recorded_account_id is null or recorded_request_id is null
     or recorded_outbox_id is null then
    raise exception using errcode='22023',message='completion outbox identity required';
  end if;

  -- Profile > attempt > intent > existing outbox is the common lock order.
  select t.* into p from public.profiles t
   where t.account_id=recorded_account_id for update;
  select t.* into a from account_deletion_internal.attempts t
   where t.account_id=recorded_account_id for update;
  select t.* into x from account_deletion_internal.completion_intents t
   where t.account_id=recorded_account_id for update;

  if p.account_id is null or a.account_id is null or x.account_id is null
     or a.state<>'finalized'
     or p.status<>'deleted' or p.auth_user_id is not null
     or a.request_id is distinct from recorded_request_id
     or x.deletion_request_id is distinct from recorded_request_id then
    raise exception using errcode='55000',
      message='completion outbox account/request fence rejected';
  end if;

  if x.state='outbox_recorded' then
    if x.outbox_id=recorded_outbox_id then return true; end if;
    raise exception using errcode='55000',
      message='completion outbox was already acknowledged for a different identity';
  end if;

  if x.state<>'pending' or x.recipient_email_normalized is null then
    raise exception using errcode='55000',message='completion intent is not pending';
  end if;

  v_expected_version:=
    pg_catalog.floor(pg_catalog.date_part('epoch', x.deleted_at)/60)::integer;
  if v_expected_version<1 then
    raise exception using errcode='22023', message='completion version is invalid';
  end if;

  select t.* into o from public.notification_outbox t
    where t.id=recorded_outbox_id for update;

  if o.id is null
    or o.message_id<>'account_deletion_completed'
    or o.business_object_type<>'account_deletion_request'
    or o.business_object_id is distinct from recorded_account_id::text
    or o.state_version is distinct from v_expected_version
    or o.recipient_email_normalized is distinct from x.recipient_email_normalized
    or o.template_id<>'account_deletion_completed'
    or o.classification<>'transactional_operational'
    or o.consent_required is distinct from false
    or o.payload is distinct from '{}'::jsonb
  then
    raise exception using errcode='55000',
      message='completion outbox record identity is unverified';
  end if;

  v_now:=pg_catalog.clock_timestamp();
  update account_deletion_internal.completion_intents t
  set state='outbox_recorded',recipient_email_normalized=null,
      outbox_id=recorded_outbox_id,recorded_at=v_now,updated_at=v_now
  where t.account_id=recorded_account_id and t.state='pending';
  return true;
end
$mark$;

revoke all on function public.confirm_account_deletion_completion_outbox(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_account_deletion_completion_outbox(uuid,uuid,uuid)
  to service_role;

commit;
