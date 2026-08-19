begin;

grant insert, update on table public.learning_progress to authenticated;

drop policy if exists learning_progress_insert_own on public.learning_progress;
create policy learning_progress_insert_own
on public.learning_progress
for insert
to authenticated
with check (
  account_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

drop policy if exists learning_progress_update_own on public.learning_progress;
create policy learning_progress_update_own
on public.learning_progress
for update
to authenticated
using (account_id = (select auth.uid()))
with check (
  account_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.account_id = (select auth.uid())
      and p.status = 'active'
  )
);

commit;
