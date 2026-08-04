begin;

create table public.guided_supplement_releases (
  content_id text not null,
  version integer not null,
  slug text not null,
  supplement_type text not null,
  sort_order integer not null,
  status text not null default 'draft',
  source_sha256 text not null,
  reader_sha256 text not null,
  payload jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (content_id, version),
  unique (slug, version),
  constraint guided_supplement_releases_content_id check (
    content_id ~ '^guided-supplement:[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint guided_supplement_releases_version check (version > 0),
  constraint guided_supplement_releases_slug check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint guided_supplement_releases_type check (
    supplement_type in ('further-reading', 'appendix')
  ),
  constraint guided_supplement_releases_sort_order check (sort_order > 0),
  constraint guided_supplement_releases_status check (
    status in ('draft', 'published', 'retired')
  ),
  constraint guided_supplement_releases_source_hash check (
    source_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint guided_supplement_releases_reader_hash check (
    reader_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint guided_supplement_releases_payload_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint guided_supplement_releases_payload_size check (
    octet_length(payload::text) <= 262144
  ),
  constraint guided_supplement_releases_publication check (
    status <> 'published' or published_at is not null
  )
);

create unique index guided_supplement_releases_one_published_content_idx
  on public.guided_supplement_releases (content_id)
  where status = 'published';

create unique index guided_supplement_releases_one_published_slug_idx
  on public.guided_supplement_releases (slug)
  where status = 'published';

create unique index guided_supplement_releases_published_sort_order_idx
  on public.guided_supplement_releases (sort_order)
  where status = 'published';

alter table public.guided_supplement_releases enable row level security;
alter table public.guided_supplement_releases force row level security;

revoke all on public.guided_supplement_releases from public, anon, authenticated;
grant select on public.guided_supplement_releases to service_role;

create policy guided_supplement_releases_deny_client_access
  on public.guided_supplement_releases
  for select
  to anon, authenticated
  using (false);

comment on table public.guided_supplement_releases is
  'Server-only canonical Guided Edition supplements; payloads are excluded from browser-role access.';

commit;

