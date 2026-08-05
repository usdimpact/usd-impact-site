begin;

-- Evaluate the authenticated account ID once per statement instead of once
-- for every candidate row. The authorization predicates remain unchanged.
alter policy profiles_select_own
on public.profiles
using (account_id = (select auth.uid()));

alter policy purchase_intents_select_own
on public.purchase_intents
using (account_id = (select auth.uid()));

alter policy purchases_select_own
on public.purchases
using (account_id = (select auth.uid()));

alter policy entitlements_select_own
on public.entitlements
using (account_id = (select auth.uid()));

alter policy entitlement_events_select_own
on public.entitlement_events
using (account_id = (select auth.uid()));

alter policy learning_progress_select_own
on public.learning_progress
using (account_id = (select auth.uid()));

alter policy learning_progress_insert_own
on public.learning_progress
with check (
  account_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

alter policy learning_progress_update_own
on public.learning_progress
using (account_id = (select auth.uid()))
with check (
  account_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

alter policy learning_progress_delete_own
on public.learning_progress
using (account_id = (select auth.uid()));

alter policy bookmarks_select_own
on public.bookmarks
using (account_id = (select auth.uid()));

alter policy bookmarks_insert_own
on public.bookmarks
with check (
  account_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

alter policy bookmarks_update_own
on public.bookmarks
using (account_id = (select auth.uid()))
with check (
  account_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

alter policy bookmarks_delete_own
on public.bookmarks
using (account_id = (select auth.uid()));

alter policy support_requests_select_own
on public.support_requests
using (account_id = (select auth.uid()));

alter policy support_requests_insert_own
on public.support_requests
with check (account_id = (select auth.uid()));

alter policy privacy_requests_select_own
on public.privacy_requests
using (account_id = (select auth.uid()));

alter policy privacy_requests_insert_own
on public.privacy_requests
with check (account_id = (select auth.uid()));

-- PostgreSQL does not automatically index the referencing side of a foreign
-- key. Add the six indexes identified by the Supabase database advisor.
create index entitlement_events_account_id_idx
  on public.entitlement_events (account_id);
create index entitlements_purchase_id_idx
  on public.entitlements (purchase_id);
create index paddle_duplicate_purchases_purchase_intent_id_idx
  on public.paddle_duplicate_purchases (purchase_intent_id);
create index privacy_requests_account_id_idx
  on public.privacy_requests (account_id);
create index purchases_purchase_intent_id_idx
  on public.purchases (purchase_intent_id);
create index support_requests_account_id_idx
  on public.support_requests (account_id);

commit;
