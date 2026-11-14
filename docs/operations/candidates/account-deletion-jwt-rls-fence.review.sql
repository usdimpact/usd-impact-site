-- Issue #950 — REVIEW ONLY JWT/RLS read/write-fence SQL. DO NOT EXECUTE.
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
    'bookmarks_select_own','bookmarks_insert_own','bookmarks_update_own','bookmarks_delete_own',
    'learning_progress_select_own','learning_progress_insert_own','learning_progress_update_own',
    'entitlements_select_own','entitlement_events_select_own',
    'purchase_intents_select_own','purchases_select_own',
    'subscription_events_select_own','subscriptions_select_own',
    'privacy_requests_select_own','support_requests_select_own',
    'support_requests_insert_own'
  );
  if found_count <> 17 then
    raise exception 'account-deletion JWT fence preflight: expected 17 exact public policies, found %', found_count;
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


-- Existing INSERT checks only require status=active. Retain their complete
-- original ownership, status and support-input constraints while adding the
-- canonical Auth FK so stale JWTs cannot write into inconsistent detached
-- active profiles. Normal pending accounts were already blocked for INSERT.
alter policy bookmarks_insert_own on public.bookmarks
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  );

alter policy learning_progress_insert_own on public.learning_progress
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
    )
  );

-- Preserve EVERY existing support insert validation term (email ownership,
-- allowed category, length limits, whitespace, CR and LF restrictions).
-- Replacing the policy with a simple Auth-link check would be a regression.
alter policy support_requests_insert_own on public.support_requests
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.account_id = (select auth.uid())
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'::public.account_status
        and p.email = support_requests.email
    )
    and category = any(array[
      'access'::text,'commerce'::text,'privacy'::text,
      'security'::text,'product'::text,'general'::text
    ])
    and char_length(subject) >= 3
    and char_length(subject) <= 160
    and subject = btrim(subject)
    and strpos(subject, chr(10)) = 0
    and strpos(subject, chr(13)) = 0
    and char_length(message) >= 10
    and char_length(message) <= 5000
    and message = btrim(message)
    and strpos(message, chr(13)) = 0
  );

commit;
