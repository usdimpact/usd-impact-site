set lock_timeout = '5s';
set statement_timeout = '30s';

do $$
declare
  existing_expr text;
begin
  select pg_get_expr(conbin, conrelid)
    into existing_expr
  from pg_constraint
  where conrelid = 'public.notification_outbox'::regclass
    and conname = 'notification_outbox_payload_contract';

  if existing_expr is null then
    raise exception 'notification_outbox_payload_contract is missing';
  end if;

  execute 'alter table public.notification_outbox drop constraint notification_outbox_payload_contract';
  execute format($sql$
    alter table public.notification_outbox
      add constraint notification_outbox_payload_contract check (
        (%s)
        or (
          template_id = 'learning_progress_email'
          and classification = 'marketing'
          and consent_required
          and consent_record_id is not null
          and consent_purpose = 'learning_progress_updates'
          and consent_checked_at is not null
          and payload ?& array['cohort', 'cycleKey']
          and payload - array['cohort', 'cycleKey'] = '{}'::jsonb
          and jsonb_typeof(payload -> 'cohort') = 'string'
          and payload ->> 'cohort' in ('inactive_7d', 'inactive_14d', 'inactive_30d')
          and jsonb_typeof(payload -> 'cycleKey') = 'string'
          and payload ->> 'cycleKey' ~ '^[0-9a-f]{64}$'
        )
      )
  $sql$, existing_expr);
end
$$;

comment on constraint notification_outbox_payload_contract
  on public.notification_outbox is
  'Allowlisted minimized payload and consent contracts for lifecycle notifications, purpose-specific marketing opt-in confirmation, Weekly Newsletter, and Learning Progress email.';
