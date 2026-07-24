-- Design draft for review before running in Supabase.
-- All writes are intended to come from verified server endpoints using a
-- server-only credential. Browser clients receive read access to their own rows.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_id text not null,
  score smallint not null check (score between 0 and 10),
  question_count smallint not null default 10 check (question_count = 10),
  passed boolean not null,
  attempt_source text not null default 'chapter' check (attempt_source in ('chapter', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_created_idx
  on public.quiz_attempts (user_id, created_at desc);

create index if not exists quiz_attempts_user_quiz_idx
  on public.quiz_attempts (user_id, canonical_id, passed);

create table if not exists public.chapter_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_slug text not null,
  access_source text not null check (access_source in ('quiz', 'purchase', 'admin')),
  source_reference text,
  granted_at timestamptz not null default now(),
  primary key (user_id, chapter_slug)
);

create index if not exists chapter_access_user_idx
  on public.chapter_access (user_id, chapter_slug);

create table if not exists public.book_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  purchaser_email citext not null,
  product_key text not null,
  status text not null default 'active' check (status in ('active', 'refunded', 'revoked')),
  stripe_customer_id text,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_entitlements_user_status_idx
  on public.book_entitlements (user_id, status);

create index if not exists book_entitlements_email_status_idx
  on public.book_entitlements (purchaser_email, status);

alter table public.quiz_attempts enable row level security;
alter table public.chapter_access enable row level security;
alter table public.book_entitlements enable row level security;

revoke all on public.quiz_attempts from anon, authenticated;
revoke all on public.chapter_access from anon, authenticated;
revoke all on public.book_entitlements from anon, authenticated;

grant select on public.quiz_attempts to authenticated;
grant select on public.chapter_access to authenticated;
grant select on public.book_entitlements to authenticated;

create policy "Users read their own quiz attempts"
  on public.quiz_attempts
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users read their own chapter access"
  on public.chapter_access
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users read their own book entitlements"
  on public.book_entitlements
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Link an entitlement created by the Stripe webhook to the signed-in user only
-- when the verified Auth email matches. Review function ownership and grants in
-- the target Supabase project before applying.
create or replace function public.claim_my_book_entitlements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed integer;
begin
  if (select auth.uid()) is null or nullif((select auth.jwt() ->> 'email'), '') is null then
    raise exception 'Authentication with a verified email is required';
  end if;

  update public.book_entitlements
     set user_id = (select auth.uid()),
         updated_at = now()
   where user_id is null
     and status = 'active'
     and lower(purchaser_email::text) = lower((select auth.jwt() ->> 'email'));

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_my_book_entitlements() from public, anon;
grant execute on function public.claim_my_book_entitlements() to authenticated;
