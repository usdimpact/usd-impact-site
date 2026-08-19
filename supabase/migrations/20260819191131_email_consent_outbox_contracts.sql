begin;

-- Append-only evidence for marketing consent. Application code may insert a
-- new grant or withdrawal event, but it cannot rewrite or erase prior proof.
create table public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  source_event_id text not null,
  email_normalized text not null,
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null,
  status text not null,
  consent_text_version text not null,
  privacy_notice_version text not null,
  source text not null,
  captured_at timestamptz not null,
  withdrawn_at timestamptz,
  withdrawal_source text,
  related_grant_id uuid references public.marketing_consent_events(id) on delete restrict,
  provider_contact_ref text,
  evidence jsonb not null default '{}'::jsonb,
  evidence_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_consent_events_idempotency_key_unique unique (idempotency_key),
  constraint marketing_consent_events_idempotency_key_format check (
    idempotency_key ~ '^consent:v1:[0-9a-f]{64}$'
  ),
  constraint marketing_consent_events_source_event_id_length check (
    length(source_event_id) between 1 and 200
  ),
  constraint marketing_consent_events_email_normalized check (
    email_normalized = lower(btrim(email_normalized))
    and length(email_normalized) between 3 and 320
    and position('@' in email_normalized) > 1
  ),
  constraint marketing_consent_events_purpose_format check (
    purpose ~ '^[a-z][a-z0-9_.-]{1,79}$'
  ),
  constraint marketing_consent_events_status_allowed check (
    status in ('granted', 'withdrawn')
  ),
  constraint marketing_consent_events_version_lengths check (
    length(consent_text_version) between 1 and 80
    and length(privacy_notice_version) between 1 and 80
  ),
  constraint marketing_consent_events_source_format check (
    source ~ '^[a-z][a-z0-9_.:-]{1,79}$'
  ),
  constraint marketing_consent_events_withdrawal_relationship check (
    (
      status = 'granted'
      and withdrawn_at is null
      and withdrawal_source is null
      and related_grant_id is null
    )
    or (
      status = 'withdrawn'
      and withdrawn_at is not null
      and withdrawal_source ~ '^[a-z][a-z0-9_.:-]{1,79}$'
      and related_grant_id is not null
      and withdrawn_at >= captured_at
    )
  ),
  constraint marketing_consent_events_provider_ref_length check (
    provider_contact_ref is null or length(provider_contact_ref) between 1 and 255
  ),
  constraint marketing_consent_events_evidence_object check (
    jsonb_typeof(evidence) = 'object' and octet_length(evidence::text) <= 65536
  ),
  constraint marketing_consent_events_evidence_checksum_format check (
    evidence_checksum ~ '^[0-9a-f]{64}$'
  ),
  constraint marketing_consent_events_server_time_bounds check (
    captured_at <= created_at + interval '5 minutes'
    and (withdrawn_at is null or withdrawn_at <= created_at + interval '5 minutes')
  ),
  constraint marketing_consent_events_append_only_timestamps check (
    updated_at = created_at
  )
);

comment on table public.marketing_consent_events is
  'Append-only evidence of marketing consent grants and withdrawals. Backend access only.';

create index marketing_consent_events_email_purpose_captured_idx
  on public.marketing_consent_events (email_normalized, purpose, captured_at desc);
create index marketing_consent_events_user_id_idx
  on public.marketing_consent_events (user_id)
  where user_id is not null;
create index marketing_consent_events_related_grant_id_idx
  on public.marketing_consent_events (related_grant_id)
  where related_grant_id is not null;

-- Durable notification intent. The identity columns are immutable through
-- column-level UPDATE grants; workers may only advance delivery state.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  event_id text not null,
  message_id text not null,
  classification text not null,
  business_object_type text not null,
  business_object_id text not null,
  state_version integer not null,
  recipient_email_normalized text not null,
  template_id text not null,
  template_version text not null,
  provider text not null,
  consent_required boolean not null default false,
  consent_record_id uuid references public.marketing_consent_events(id) on delete restrict,
  consent_purpose text,
  consent_checked_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_ref text,
  error_code text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_idempotency_key_unique unique (idempotency_key),
  constraint notification_outbox_business_state_unique unique (
    message_id,
    business_object_type,
    business_object_id,
    state_version,
    recipient_email_normalized
  ),
  constraint notification_outbox_idempotency_key_format check (
    idempotency_key ~ '^notification:v1:[0-9a-f]{64}$'
  ),
  constraint notification_outbox_event_id_length check (
    length(event_id) between 1 and 200
  ),
  constraint notification_outbox_message_id_format check (
    message_id ~ '^[a-z][a-z0-9_.:-]{1,127}$'
  ),
  constraint notification_outbox_classification_allowed check (
    classification in (
      'transactional',
      'transactional_security',
      'transactional_operational',
      'operational',
      'marketing'
    )
  ),
  constraint notification_outbox_business_object_type_format check (
    business_object_type ~ '^[a-z][a-z0-9_.:-]{1,79}$'
  ),
  constraint notification_outbox_business_object_id_length check (
    length(business_object_id) between 1 and 200
  ),
  constraint notification_outbox_state_version_positive check (state_version >= 1),
  constraint notification_outbox_email_normalized check (
    recipient_email_normalized = lower(btrim(recipient_email_normalized))
    and length(recipient_email_normalized) between 3 and 320
    and position('@' in recipient_email_normalized) > 1
  ),
  constraint notification_outbox_template_id_format check (
    template_id ~ '^[a-z][a-z0-9_.:-]{1,127}$'
  ),
  constraint notification_outbox_template_version_length check (
    length(template_version) between 1 and 80
  ),
  constraint notification_outbox_provider_format check (
    provider ~ '^[a-z][a-z0-9_.:-]{1,79}$'
  ),
  constraint notification_outbox_marketing_consent_required check (
    classification <> 'marketing' or consent_required
  ),
  constraint notification_outbox_consent_reference_complete check (
    (
      not consent_required
      and consent_record_id is null
      and consent_purpose is null
      and consent_checked_at is null
    )
    or (
      consent_required
      and consent_record_id is not null
      and consent_purpose ~ '^[a-z][a-z0-9_.-]{1,79}$'
      and consent_checked_at is not null
    )
  ),
  constraint notification_outbox_payload_object check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536
  ),
  constraint notification_outbox_status_allowed check (
    status in (
      'queued',
      'sending',
      'accepted',
      'delivered',
      'soft_bounced',
      'hard_bounced',
      'complained',
      'suppressed',
      'retry_scheduled',
      'terminal_failed',
      'cancelled'
    )
  ),
  constraint notification_outbox_attempt_count_nonnegative check (attempt_count >= 0),
  constraint notification_outbox_provider_ref_length check (
    provider_message_ref is null or length(provider_message_ref) between 1 and 255
  ),
  constraint notification_outbox_error_code_format check (
    error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,79}$'
  )
);

comment on table public.notification_outbox is
  'Backend-only durable notification intent and delivery state. Does not send email itself.';

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

create index notification_outbox_dispatch_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where status in ('queued', 'retry_scheduled');
create index notification_outbox_classification_status_created_idx
  on public.notification_outbox (classification, status, created_at desc);
create index notification_outbox_consent_record_id_idx
  on public.notification_outbox (consent_record_id)
  where consent_record_id is not null;
create index notification_outbox_recipient_created_idx
  on public.notification_outbox (recipient_email_normalized, created_at desc);

alter table public.marketing_consent_events enable row level security;
alter table public.notification_outbox enable row level security;

-- No anon/authenticated policies are created. Only the service role may use
-- these tables, and the consent ledger deliberately has no UPDATE/DELETE grant.
revoke all on table public.marketing_consent_events
  from public, anon, authenticated, service_role;
revoke all on table public.notification_outbox
  from public, anon, authenticated, service_role;

grant select, insert on table public.marketing_consent_events to service_role;
grant select, insert on table public.notification_outbox to service_role;
grant update (
  status,
  attempt_count,
  next_attempt_at,
  provider_message_ref,
  error_code,
  accepted_at,
  delivered_at,
  failed_at,
  updated_at
) on table public.notification_outbox to service_role;

commit;
