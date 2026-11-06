-- USD Impact — interim (non-destructive) account deletion: owner review queue
--
-- READ ONLY. One SELECT, no writes. Run by the owner only, inside a read-only
-- transaction, against the current Production schema (the 52 live
-- migrations; it does not depend on the uninstalled Research P1 Draft SQL):
--
--   begin transaction read only;
--   \i interim-deletion-review-queue.sql
--   rollback;
--
-- RESTRICTED OUTPUT. account_ref and privacy_request_id are internal,
-- linkable personal identifiers: anyone with database access can join them
-- to a person. The output also reveals that a person asked for deletion and
-- their payment states. It contains no email address, name, provider
-- customer id or payment id, but it is NOT anonymous and NOT free of
-- personal data. Keep it in owner custody only; never paste it into GitHub,
-- CI, trackers, chat, tickets or logs.
--
-- Interim rules:
--   * Nothing here is ever eligible for deletion or automatic finalization.
--     deletion_eligibility is always 'not_determined'.
--   * The live schema has no per-account provider clearance record, so
--     merchant_cessation_evidence is always 'unknown'. Local rows can never
--     show that the provider stopped charging; unchecked_financial_sources
--     lists what this query cannot see.
--   * review_flags lists every condition at once, so a financial exception
--     never hides a privacy deadline. Order is by review_priority, then due.
select
  pr.id                                              as privacy_request_id,
  pr.account_id                                      as account_ref,
  'restricted_linkable_identifier'::text             as identifier_handling,
  p.status::text                                     as profile_status,
  pr.status::text                                    as privacy_status,
  pr.requested_at,
  p.deletion_due_at                                  as safety_period_ends_at,
  pr.due_at                                          as privacy_due_at,
  floor(extract(epoch from (pr.due_at - now())) / 86400)::integer
                                                     as days_until_privacy_due,
  f.privacy_deadline_state,
  array_remove(array[
    case f.privacy_deadline_state
      when 'overdue' then 'privacy_overdue'
      when 'due_within_7_days' then 'privacy_due_within_7_days'
    end,
    case when f.financial_exception then 'financial_exception' end,
    case when f.state_mismatch then 'state_mismatch' end
  ], null)                                           as review_flags,
  case
    when f.privacy_deadline_state = 'overdue' then 1
    when f.privacy_deadline_state = 'due_within_7_days' then 2
    when f.financial_exception or f.state_mismatch then 3
    else 4
  end                                                as review_priority,
  coalesce(rs.open_states, '{}')                     as research_open_subscription_states,
  coalesce(rs.dispute_states, '{}')                  as research_dispute_states,
  re.state::text                                     as research_entitlement_state,
  lp.state::text                                     as library_pass_entitlement_state,
  coalesce(pu.disputed_or_charged_back, 0)           as purchases_disputed_or_charged_back,
  'unknown'::text                                    as merchant_cessation_evidence,
  array[
    'provider_subscriptions_all_pages',
    'provider_invoices_pending_and_retries',
    'open_or_non_expiring_checkouts',
    'signed_late_or_out_of_order_webhooks',
    'paid_binding_quarantine_and_checkout_custody'
  ]::text[]                                          as unchecked_financial_sources,
  'not_determined'::text                             as deletion_eligibility,
  false                                              as automatic_finalization_allowed
from public.privacy_requests pr
left join public.profiles p
  on p.account_id = pr.account_id
left join lateral (
  select
    array_agg(distinct s.state::text order by s.state::text)
      filter (where s.state in ('pending', 'active', 'past_due', 'cancel_scheduled')) as open_states,
    array_agg(distinct s.state::text order by s.state::text)
      filter (where s.state in ('disputed', 'charged_back')) as dispute_states
  from public.subscriptions s
  where s.account_id = pr.account_id
    and s.product_id = 'research-membership'
) rs on true
left join public.entitlements re
  on re.account_id = pr.account_id and re.product_id = 'research-membership'
left join public.entitlements lp
  on lp.account_id = pr.account_id
 and lp.product_id = 'read-the-dollar-first-guided-interactive-edition'
left join lateral (
  select count(*)::integer as disputed_or_charged_back
  from public.purchases u
  where u.account_id = pr.account_id
    and (u.status in ('disputed', 'charged_back') or u.disputed_at is not null)
) pu on true
cross join lateral (
  select
    case
      when pr.due_at <= now() then 'overdue'
      when pr.due_at <= now() + interval '7 days' then 'due_within_7_days'
      else 'open'
    end as privacy_deadline_state,
    (cardinality(coalesce(rs.open_states, '{}')) > 0
      or cardinality(coalesce(rs.dispute_states, '{}')) > 0
      or coalesce(pu.disputed_or_charged_back, 0) > 0) as financial_exception,
    (p.status is distinct from 'deletion_pending') as state_mismatch
) f
where pr.request_type = 'deletion'
  and pr.status in ('open', 'in_progress')
order by review_priority, pr.due_at, pr.requested_at, pr.id;
