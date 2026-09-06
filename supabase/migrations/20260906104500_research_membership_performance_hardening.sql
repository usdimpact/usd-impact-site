begin;

-- Resolve the Research Membership performance findings identified immediately
-- after the Production recurring-schema rollout. This migration does not change
-- authorization semantics, commercial state, provider configuration, or access.

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (account_id = (select auth.uid()));

drop policy if exists subscription_events_select_own on public.subscription_events;
create policy subscription_events_select_own
on public.subscription_events
for select
to authenticated
using (account_id = (select auth.uid()));

create index if not exists subscription_events_account_id_idx
  on public.subscription_events(account_id);

commit;
