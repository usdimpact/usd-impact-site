begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.notification_outbox
  drop constraint notification_outbox_payload_contract;

alter table public.notification_outbox
  add constraint notification_outbox_payload_contract check (
    message_id = template_id
    and (
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
        and consent_purpose = 'book_availability'
        and consent_checked_at is not null
        and payload ? 'editionId'
        and payload - 'editionId' = '{}'::jsonb
        and jsonb_typeof(payload -> 'editionId') = 'string'
        and payload ->> 'editionId' ~ '^[a-z][a-z0-9_.:-]{1,127}$'
      )
      or (
        template_id = 'waitlist_confirmation'
        and classification = 'operational'
        and consent_required
        and consent_record_id is not null
        and consent_purpose = 'book_availability'
        and consent_checked_at is not null
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'book_availability'
        and classification = 'marketing'
        and consent_required
        and consent_record_id is not null
        and consent_purpose = 'book_availability'
        and consent_checked_at is not null
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'purchase_pending'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'purchase_access_ready'
        and classification = 'transactional'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'purchase_failed'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'refund_approved'
        and classification = 'transactional'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'dispute_warning'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'chargeback_revoked'
        and classification = 'transactional'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'dispute_reversal_restored'
        and classification = 'transactional'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'privacy_export_acknowledgement'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'account_deletion_requested'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'account_deletion_completed'
        and classification = 'transactional_operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
      or (
        template_id = 'support_case_received'
        and classification = 'operational'
        and not consent_required
        and payload = '{}'::jsonb
      )
    )
  );

comment on constraint notification_outbox_payload_contract
  on public.notification_outbox is
  'Allowlisted minimized payload contracts for legacy and Library Pass lifecycle templates. Message identity must match template identity; consent-bound messages require active book-availability consent.';

commit;
