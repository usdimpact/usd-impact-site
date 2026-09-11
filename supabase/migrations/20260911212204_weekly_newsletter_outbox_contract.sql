begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.notification_outbox
  drop constraint notification_outbox_payload_contract;

alter table public.notification_outbox
  add constraint notification_outbox_payload_contract check (
    (
      template_id = 'purchase_receipt'
      and classification = 'transactional'
      and not consent_required
      and consent_record_id is null
      and consent_purpose is null
      and consent_checked_at is null
      and payload ?& array['amountCents', 'currency']
      and payload - array['amountCents', 'currency', 'customer'] = '{}'::jsonb
      and jsonb_typeof(payload -> 'amountCents') = 'number'
      and payload ->> 'amountCents' ~ '^[0-9]+$'
      and (payload ->> 'amountCents')::bigint between 0 and 999999999
      and jsonb_typeof(payload -> 'currency') = 'string'
      and payload ->> 'currency' ~ '^[A-Z]{3}$'
      and (
        not (payload ? 'customer')
        or (
          jsonb_typeof(payload -> 'customer') = 'object'
          and payload -> 'customer' ? 'displayName'
          and (payload -> 'customer') - 'displayName' = '{}'::jsonb
          and jsonb_typeof(payload -> 'customer' -> 'displayName') = 'string'
          and length(payload -> 'customer' ->> 'displayName') between 1 and 160
        )
      )
    )
    or (
      template_id = 'market_update'
      and classification = 'marketing'
      and consent_required
      and consent_record_id is not null
      and consent_purpose ~ '^[a-z][a-z0-9_.-]{1,79}$'
      and consent_checked_at is not null
      and payload ? 'editionId'
      and payload - 'editionId' = '{}'::jsonb
      and jsonb_typeof(payload -> 'editionId') = 'string'
      and payload ->> 'editionId' ~ '^[a-z][a-z0-9_.:-]{1,127}$'
    )
    or (
      (template_id, classification) in (
        ('purchase_pending', 'transactional_operational'),
        ('purchase_access_ready', 'transactional'),
        ('purchase_failed', 'transactional_operational'),
        ('refund_approved', 'transactional'),
        ('dispute_warning', 'transactional_operational'),
        ('chargeback_revoked', 'transactional'),
        ('dispute_reversal_restored', 'transactional'),
        ('privacy_export_acknowledgement', 'transactional_operational'),
        ('account_deletion_requested', 'transactional_operational'),
        ('account_deletion_completed', 'transactional_operational'),
        ('support_case_received', 'operational')
      )
      and not consent_required
      and consent_record_id is null
      and consent_purpose is null
      and consent_checked_at is null
      and payload = '{}'::jsonb
    )
    or (
      (template_id, classification) in (
        ('waitlist_confirmation', 'operational'),
        ('book_availability', 'marketing')
      )
      and consent_required
      and consent_record_id is not null
      and consent_purpose = 'book_availability'
      and consent_checked_at is not null
      and payload = '{}'::jsonb
    )
    or (
      template_id = 'marketing_opt_in_confirmation'
      and classification = 'operational'
      and not consent_required
      and consent_record_id is null
      and consent_purpose is null
      and consent_checked_at is null
      and payload ?& array['purpose', 'issuedAt', 'locale']
      and payload - array['purpose', 'issuedAt', 'locale', 'userId'] = '{}'::jsonb
      and jsonb_typeof(payload -> 'purpose') = 'string'
      and payload ->> 'purpose' in ('weekly_newsletter', 'learning_progress_updates')
      and jsonb_typeof(payload -> 'issuedAt') = 'number'
      and payload ->> 'issuedAt' ~ '^[0-9]+$'
      and (payload ->> 'issuedAt')::bigint between 1 and 4102444800
      and jsonb_typeof(payload -> 'locale') = 'string'
      and payload ->> 'locale' = 'en'
      and (
        (
          payload ->> 'purpose' = 'weekly_newsletter'
          and (
            not (payload ? 'userId')
            or (
              jsonb_typeof(payload -> 'userId') = 'string'
              and payload ->> 'userId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            )
          )
        )
        or (
          payload ->> 'purpose' = 'learning_progress_updates'
          and payload ? 'userId'
          and jsonb_typeof(payload -> 'userId') = 'string'
          and payload ->> 'userId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )
    )
    or (
      template_id = 'weekly_newsletter'
      and classification = 'marketing'
      and consent_required
      and consent_record_id is not null
      and consent_purpose = 'weekly_newsletter'
      and consent_checked_at is not null
      and payload ?& array['weekEnding', 'editionChecksum']
      and payload - array['weekEnding', 'editionChecksum'] = '{}'::jsonb
      and jsonb_typeof(payload -> 'weekEnding') = 'string'
      and payload ->> 'weekEnding' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      and jsonb_typeof(payload -> 'editionChecksum') = 'string'
      and payload ->> 'editionChecksum' ~ '^[0-9a-f]{64}$'
    )
  );

comment on constraint notification_outbox_payload_contract
  on public.notification_outbox is
  'Allowlisted minimized payload and consent contracts for existing lifecycle notifications, purpose-specific marketing opt-in confirmation, and Weekly Newsletter send intents.';

commit;
