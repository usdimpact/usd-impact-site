create table if not exists public.score_member_assets (
  path text primary key,
  content_type text not null default 'text/html; charset=utf-8',
  body text not null,
  source_commit text not null,
  source_sha text not null,
  updated_at timestamptz not null default now(),
  constraint score_member_assets_path_chk check (
    path in ('/en/','/es/','/archive/en/','/archive/es/')
    or path ~ '^/archive/[0-9]{4}-[0-9]{2}-[0-9]{2}/(en|es)\.html$'
  ),
  constraint score_member_assets_type_chk check (content_type = 'text/html; charset=utf-8'),
  constraint score_member_assets_commit_chk check (source_commit ~ '^[0-9a-f]{40}$'),
  constraint score_member_assets_sha_chk check (source_sha ~ '^[0-9a-f]{40}$')
);

alter table public.score_member_assets enable row level security;

revoke all on table public.score_member_assets from public, anon, authenticated;
grant select, insert, update, delete on table public.score_member_assets to service_role;

comment on table public.score_member_assets is
  'Private Score member HTML. Service-role only; Vercel rechecks Research Membership before every response.';
comment on column public.score_member_assets.source_commit is
  'Exact usd-impact-pipeline Git commit used to generate the stored HTML.';
comment on column public.score_member_assets.source_sha is
  'Exact Git blob SHA for the stored HTML source file.';
