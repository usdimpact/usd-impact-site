-- USD Impact Research #1103 — B-3 isolated PGlite prototype, 2026-11-04
-- REVIEW / OFFLINE TEST ONLY. THIS FILE IS NOT A SUPABASE MIGRATION.
-- DO NOT RUN ON DEVELOPMENT OR PRODUCTION. NO OWNER APPROVAL FOR DATABASE CHANGES.
-- Deliberately uses review-only schema research_receipt_review, NOT research_private,
-- and is NOT imported by application/runtime code or any deployment workflow.
-- No SECURITY DEFINER, no GRANT, no role creation, no payment or entitlement writes.
-- Distinct, frozen v1/v2/v3 hash functions must be implemented/reviewed separately.
-- This prototype checks caller-supplied hash against STORED VERSION, never upgrades
-- the version on an existing receipt. Caller must compute old-version hash itself.
-- No real PostgreSQL two-session proof, DB ownership/security proof or release fix.

create schema research_receipt_review;

create table research_receipt_review.receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lemon-squeezy-research'
    check (provider = 'lemon-squeezy-research'),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 100),
  fingerprint_version text not null check (fingerprint_version in (
    'research-receipt-business-v1',
    'research-receipt-business-v2',
    'research-receipt-business-v3'
  )),
  fingerprint_sha256 text not null check (fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('received','processed','ignored','failed')),
  attempt_count bigint not null check (attempt_count >= 1),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_finished_attempt bigint,
  last_finished_token_digest text check (
    last_finished_token_digest is null or last_finished_token_digest ~ '^[a-f0-9]{64}$'
  ),
  last_finished_status text check (
    last_finished_status is null or last_finished_status in ('processed','ignored','failed')
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (provider, provider_event_id),
  check ((lease_token is null) = (lease_expires_at is null)),
  check (
    (last_finished_attempt is null and last_finished_token_digest is null and last_finished_status is null)
    or
    (last_finished_attempt is not null and last_finished_token_digest is not null and last_finished_status is not null)
  )
);

create table research_receipt_review.conflict_observations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references research_receipt_review.receipts(id) on delete restrict,
  provider text not null check (provider = 'lemon-squeezy-research'),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  fingerprint_version text not null check (char_length(fingerprint_version) between 1 and 100),
  fingerprint_sha256 text not null check (fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  conflict_code text not null check (conflict_code in (
    'fingerprint_version_unknown','fingerprint_version_mismatch',
    'semantic_payload_conflict','duplicate_paid_subscription',
    'entitlement_conflict','unbound_subscription',
    'missing_custom_binding','foreign_invoice',
    'receipt_completion_conflict','provider_reconciliation_needed'
  )),
  observed_at timestamptz not null default transaction_timestamp(),
  attempt_count bigint,
  bound_account_id uuid,
  provider_subscription_id text
);

create table research_receipt_review.resolution_observations (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references research_receipt_review.conflict_observations(id) on delete restrict,
  resolution_code text not null check (resolution_code in (
    'owner_reviewed','provider_refund_verified','provider_cancel_verified',
    'safe_relink_verified','privacy_redaction_approved'
  )),
  observed_at timestamptz not null default transaction_timestamp()
);

create function research_receipt_review.reject_evidence_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Research receipt review evidence is append-only'
    using errcode = '42501';
end;
$$;

create trigger reject_conflict_update_delete
before update or delete on research_receipt_review.conflict_observations
for each row execute function research_receipt_review.reject_evidence_mutation();

create trigger reject_conflict_truncate
before truncate on research_receipt_review.conflict_observations
for each statement execute function research_receipt_review.reject_evidence_mutation();

create trigger reject_resolution_update_delete
before update or delete on research_receipt_review.resolution_observations
for each row execute function research_receipt_review.reject_evidence_mutation();

create trigger reject_resolution_truncate
before truncate on research_receipt_review.resolution_observations
for each statement execute function research_receipt_review.reject_evidence_mutation();

-- The application must verify provider HMAC, account/store/product/mode/variant
-- BEFORE invoking this function, via a separately reviewed server boundary.
-- This function is SECURITY INVOKER only; future production grants and the
-- privileged writer mechanism require owner D2 and independent security QA.
-- The ledger is deliberately NOT user-facing and not in an exposed schema.
create function research_receipt_review.begin_review_receipt(
  p_event_id text,
  p_event_type text,
  p_version text,
  p_hash text
) returns jsonb language plpgsql as $$
declare
  v_row research_receipt_review.receipts%rowtype;
  v_token uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_event_id is null or char_length(p_event_id) not between 1 and 255
    or p_event_type is null or char_length(p_event_type) not between 1 and 100
    or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
  then
    return jsonb_build_object('disposition','invalid_evidence');
  end if;

  if p_version is null or p_version not in (
    'research-receipt-business-v1',
    'research-receipt-business-v2',
    'research-receipt-business-v3'
  ) then
    insert into research_receipt_review.conflict_observations(
      provider, provider_event_id, fingerprint_version,
      fingerprint_sha256, conflict_code
    ) values (
      'lemon-squeezy-research', p_event_id, coalesce(p_version,'not-supplied'),
      p_hash, 'fingerprint_version_unknown'
    );
    return jsonb_build_object('disposition','unsupported_version');
  end if;

  v_token := gen_random_uuid();
  insert into research_receipt_review.receipts (
    provider_event_id, event_type, fingerprint_version,
    fingerprint_sha256, status, attempt_count, lease_token, lease_expires_at
  ) values (
    p_event_id, p_event_type, p_version, p_hash,
    'received', 1, v_token, v_now + interval '90 seconds'
  ) on conflict (provider,provider_event_id) do nothing
  returning * into v_row;

  if found then
    return jsonb_build_object(
      'disposition','acquired', 'receipt_id',v_row.id,
      'attempt_count',v_row.attempt_count,'lease_token',v_row.lease_token
    );
  end if;

  select * into v_row from research_receipt_review.receipts
   where provider = 'lemon-squeezy-research' and provider_event_id = p_event_id
   for update;

  if v_row.fingerprint_version <> p_version then
    insert into research_receipt_review.conflict_observations (
      receipt_id, provider, provider_event_id, fingerprint_version,
      fingerprint_sha256, conflict_code, attempt_count
    ) values (
      v_row.id, v_row.provider, v_row.provider_event_id,
      p_version, p_hash, 'fingerprint_version_mismatch',v_row.attempt_count
    );
    return jsonb_build_object(
      'disposition','version_mismatch', 'stored_version',v_row.fingerprint_version
    );
  end if;

  if v_row.fingerprint_sha256 <> p_hash
    or v_row.event_type <> p_event_type then
    insert into research_receipt_review.conflict_observations (
      receipt_id, provider, provider_event_id, fingerprint_version,
      fingerprint_sha256, conflict_code, attempt_count
    ) values (
      v_row.id, v_row.provider, v_row.provider_event_id,
      p_version, p_hash, 'semantic_payload_conflict',v_row.attempt_count
    );
    return jsonb_build_object('disposition','semantic_conflict');
  end if;

  if v_row.status in ('processed','ignored') then
    return jsonb_build_object('disposition','terminal_duplicate');
  end if;

  if v_row.lease_token is not null
    and v_row.lease_expires_at > v_now then
    return jsonb_build_object('disposition','in_progress');
  end if;

  v_token := gen_random_uuid();
  update research_receipt_review.receipts
     set attempt_count = attempt_count + 1,
         status = 'received',
         lease_token = v_token,
         lease_expires_at = v_now + interval '90 seconds',
         updated_at = v_now
   where id = v_row.id returning * into v_row;

  -- DO NOT CLEAR last_finished_* or any conflict evidence here.
  return jsonb_build_object(
    'disposition','acquired','receipt_id',v_row.id,
    'attempt_count',v_row.attempt_count,'lease_token',v_row.lease_token
  );
end;
$$;

-- A finish with stale token MUST return stale_attempt, not a false success.
-- Exact retry after an uncertain response yields already_applied only when
-- stored last_finished_* exactly matches the prior finish request.
create function research_receipt_review.finish_review_receipt(
  p_receipt_id uuid,
  p_attempt_count bigint,
  p_token uuid,
  p_status text,
  p_failure_code text default null
) returns jsonb language plpgsql as $$
declare
  v_row research_receipt_review.receipts%rowtype;
  v_digest text;
  v_failure text;
begin
  if p_status not in ('processed','ignored','failed')
     or p_receipt_id is null or p_token is null
     or p_attempt_count is null or p_attempt_count < 1 then
    return jsonb_build_object('disposition','invalid_finish');
  end if;

  v_failure := coalesce(p_failure_code,'provider_reconciliation_needed');
  if p_status = 'failed' and v_failure not in (
    'duplicate_paid_subscription','entitlement_conflict',
    'unbound_subscription','missing_custom_binding','foreign_invoice',
    'receipt_completion_conflict','provider_reconciliation_needed'
  ) then
    return jsonb_build_object('disposition','invalid_finish');
  end if;

  v_digest := encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
  update research_receipt_review.receipts
    set status = p_status, lease_token = null, lease_expires_at = null,
        last_finished_attempt = p_attempt_count,
        last_finished_token_digest = v_digest,
        last_finished_status = p_status,
        updated_at = transaction_timestamp()
  where id = p_receipt_id and attempt_count = p_attempt_count
    and lease_token = p_token and status = 'received'
  returning * into v_row;

  if found then
    if p_status = 'failed' then
      insert into research_receipt_review.conflict_observations (
        receipt_id,provider,provider_event_id,fingerprint_version,
        fingerprint_sha256,conflict_code,attempt_count
      ) values (
        v_row.id,v_row.provider,v_row.provider_event_id,
        v_row.fingerprint_version,v_row.fingerprint_sha256,
        v_failure,v_row.attempt_count
      );
    end if;
    return jsonb_build_object('disposition','applied','status',p_status);
  end if;

  select * into v_row from research_receipt_review.receipts
    where id = p_receipt_id for update;

  if not found then
    return jsonb_build_object('disposition','missing');
  end if;

  if v_row.last_finished_attempt = p_attempt_count
     and v_row.last_finished_token_digest = v_digest
     and v_row.last_finished_status = p_status then
    return jsonb_build_object('disposition','already_applied','status',p_status);
  end if;

  return jsonb_build_object('disposition','stale_attempt');
end;
$$;

-- NON-GOALS: this isolated mock does not implement, grant, or invoke the
-- production Research binding or entitlement transition. It cannot atomically
-- bind an external Lemon Squeezy payment, and it must NEVER be treated as
-- a release or two-connection PostgreSQL concurrency acceptance.
