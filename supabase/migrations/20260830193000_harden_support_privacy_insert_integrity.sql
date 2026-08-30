begin;

-- Authenticated support creation remains available, but only through the
-- application-owned input columns. Database defaults own IDs, workflow state,
-- and timestamps.
revoke insert on public.support_requests from authenticated;
grant insert (account_id, email, category, subject, message)
  on public.support_requests
  to authenticated;

drop policy if exists support_requests_insert_own
  on public.support_requests;

create policy support_requests_insert_own
on public.support_requests
for insert
to authenticated
with check (
  account_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
      and p.email = support_requests.email
  )
  and category in (
    'access',
    'commerce',
    'privacy',
    'security',
    'product',
    'general'
  )
  and char_length(subject) between 3 and 160
  and subject = btrim(subject)
  and strpos(subject, chr(0)) = 0
  and strpos(subject, chr(10)) = 0
  and strpos(subject, chr(13)) = 0
  and char_length(message) between 10 and 5000
  and message = btrim(message)
  and strpos(message, chr(0)) = 0
  and strpos(message, chr(13)) = 0
);

-- No application route directly inserts privacy requests. Account deletion
-- continues through request_account_deletion(), whose owner-executed
-- SECURITY DEFINER body retains the required table access.
revoke insert on public.privacy_requests from authenticated;
drop policy if exists privacy_requests_insert_own
  on public.privacy_requests;

do $verify$
begin
  if has_table_privilege('authenticated', 'public.support_requests', 'INSERT') then
    raise exception 'authenticated must not retain table-level support INSERT';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.support_requests',
    'account_id',
    'INSERT'
  ) or not has_column_privilege(
    'authenticated',
    'public.support_requests',
    'email',
    'INSERT'
  ) or not has_column_privilege(
    'authenticated',
    'public.support_requests',
    'category',
    'INSERT'
  ) or not has_column_privilege(
    'authenticated',
    'public.support_requests',
    'subject',
    'INSERT'
  ) or not has_column_privilege(
    'authenticated',
    'public.support_requests',
    'message',
    'INSERT'
  ) then
    raise exception 'authenticated support input-column grants are incomplete';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.support_requests',
    'status',
    'INSERT'
  ) or has_column_privilege(
    'authenticated',
    'public.support_requests',
    'closed_at',
    'INSERT'
  ) or has_column_privilege(
    'authenticated',
    'public.support_requests',
    'created_at',
    'INSERT'
  ) or has_column_privilege(
    'authenticated',
    'public.support_requests',
    'updated_at',
    'INSERT'
  ) then
    raise exception 'authenticated can insert support workflow columns';
  end if;

  if has_table_privilege('authenticated', 'public.privacy_requests', 'INSERT') then
    raise exception 'authenticated must not directly insert privacy requests';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'privacy_requests'
      and policyname = 'privacy_requests_insert_own'
  ) then
    raise exception 'legacy privacy INSERT policy remains';
  end if;
end
$verify$;

commit;
