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
      and consent_purpose = 'book_availability'
      and payload = '{}'::jsonb
    )
  );

comment on constraint notification_outbox_payload_contract
  on public.notification_outbox is
  'Allowlisted minimized payload and consent contracts for legacy and Library Pass lifecycle notifications.';

commit;
