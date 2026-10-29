-- Issue #950 — REVIEW ONLY: privacy-safe escrow age and consistency monitor.
-- Disposable CI PostgreSQL fixture ONLY. NOT an executable migration.
-- No recipient email, account UUID, deletion request, tokens, outbox IDs, or
-- personal event timestamps are returned. NO cleanup, send or Auth attempt.
-- The 2-hour/24-hour *operational* markers follow the existing governed
-- "transactional critical" email retry/staleness policy; they do NOT establish
-- a legal data-retention period, nor authorize an automatic purge.
begin;

do $preflight$
begin
  if pg_catalog.to_regclass('account_deletion_internal.completion_intents') is null
    or pg_catalog.to_regclass('account_deletion_internal.attempts') is null
    or pg_catalog.to_regclass('public.notification_outbox') is null
  then
    raise exception 'Issue #950 completion escrow prerequisites are missing';
  end if;
end
$preflight$;

create function account_deletion_internal.completion_escrow_health()
returns table(
  pending_count bigint,
  pending_over_two_hours bigint,
  pending_over_twenty_four_hours bigint,
  pending_inconsistent_count bigint,
  recorded_missing_outbox_count bigint,
  oldest_pending_age_band text,
  manual_review_required boolean
)
language sql
volatile
security invoker
set search_path = ''
as $monitor$
  with at_time as (
    select pg_catalog.clock_timestamp() as checked_at
  ), counted as (
    select
      count(*) filter (where x.state='pending')::bigint as pending_count,
      count(*) filter (
        where x.state='pending'
          and x.created_at <= t.checked_at-interval '2 hours'
      )::bigint as over_two_hours,
      count(*) filter (
        where x.state='pending'
          and x.created_at <= t.checked_at-interval '24 hours'
      )::bigint as over_twenty_four_hours,
      count(*) filter (
        where x.state='pending' and (
          a.account_id is null or a.state<>'finalized'
          or p.account_id is null or p.status<>'deleted'
          or p.auth_user_id is not null
          or x.recipient_email_normalized is null
        )
      )::bigint as inconsistent,
      count(*) filter (
        where x.state='outbox_recorded'
          and (o.id is null or o.message_id<>'account_deletion_completed'
            or o.business_object_id is distinct from x.account_id::text)
      )::bigint as missing_outbox,
      max(t.checked_at-x.created_at)
        filter (where x.state='pending') as oldest_pending_interval
    from account_deletion_internal.completion_intents x
    cross join at_time t
    left join account_deletion_internal.attempts a
      on a.account_id=x.account_id
       and a.request_id=x.deletion_request_id
    left join public.profiles p
      on p.account_id=x.account_id
    left join public.notification_outbox o
      on o.id=x.outbox_id
  )
  select
    counted.pending_count,
    counted.over_two_hours,
    counted.over_twenty_four_hours,
    counted.inconsistent,
    counted.missing_outbox,
    case
      when counted.pending_count=0 then 'none'
      when counted.over_twenty_four_hours>0 then 'at_least_24_hours'
      when counted.over_two_hours>0 then 'two_to_24_hours'
      else 'under_two_hours'
    end,
    (counted.over_twenty_four_hours>0
      or counted.inconsistent>0
      or counted.missing_outbox>0)
  from counted;
$monitor$;

-- private, postgres-operator-only. No callable public/Data API RPC,
-- service role, authenticated browser, anon, or direct recipient disclosure.
revoke all on function account_deletion_internal.completion_escrow_health()
  from public, anon, authenticated, service_role;
revoke all on schema account_deletion_internal
  from public, anon, authenticated, service_role;
commit;
