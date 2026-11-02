-- Issue #950 — REVIEW ONLY JWT/RLS read-fence SQL. DO NOT EXECUTE.
-- STAGE OUTSIDE migrations: no live DDL, no Production or Development writes.
-- Distinguish still-linked 7-day pending accounts from Auth-dispatched ones.
-- Supabase JWT can remain valid after Auth deletion; auth.uid() alone does not
-- prove the profile remains linked. No session revocation claim is made.
-- Intended to be reviewed alongside (not silently merged into) claim SQL.

begin;

do $preflight$
declare found_count integer;
begin
  select count(*) into found_count
  from pg_catalog.pg_policies p
  where p.schemaname='public' and p.policyname in (
    'profiles_select_own',
    'bookmarks_select_own','bookmarks_update_own','bookmarks_delete_own',
    'learning_progress_select_own','learning_progress_update_own',
    'entitlements_select_own','entitlement_events_select_own',
    'purchase_intents_select_own','purchases_select_own',
    'subscription_events_select_own','subscriptions_select_own',
    'privacy_requests_select_own','support_requests_select_own'
  );
  if found_count <> 14 then
    raise exception 'account-deletion JWT fence preflight: expected 14 exact public policies, found %', found_count;
  end if;
end
$preflight$;

-- No self-referencing subquery here: adding EXISTS(profiles) inside its own
-- RLS policy would cause recursion. A detached Auth FK directly denies SELECT.
alter policy profiles_select_own on public.profiles
  using (
    account_id = (select auth.uid())
    and auth_user_id = (select auth.uid())
  );

-- Existing 7-day pre-claim read semantics stay intact while the canonical
-- Auth link exists; after fenced begin() detaches, stale JWTs cannot read.
alter policy bookmarks_select_own on public.bookmarks
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

alter policy bookmarks_delete_own on public.bookmarks
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  );

alter policy bookmarks_update_own on public.bookmarks
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  )
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  );

alter policy learning_progress_select_own on public.learning_progress
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

alter policy learning_progress_update_own on public.learning_progress
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  )
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  );

alter policy entitlements_select_own on public.entitlements
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status <> 'deleted'::public.account_status
    )
  );

alter policy entitlement_events_select_own on public.entitlement_events
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status <> 'deleted'::public.account_status
    )
  );

alter policy purchase_intents_select_own on public.purchase_intents
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status <> 'deleted'::public.account_status
    )
  );

alter policy purchases_select_own on public.purchases
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status <> 'deleted'::public.account_status
    )
  );

alter policy subscription_events_select_own on public.subscription_events
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

alter policy subscriptions_select_own on public.subscriptions
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

alter policy privacy_requests_select_own on public.privacy_requests
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

alter policy support_requests_select_own on public.support_requests
  using (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
    )
  );

commit;
