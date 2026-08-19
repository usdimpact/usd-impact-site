begin;

-- Paid reader content must never be committed to the public application
-- repository. The server reads published releases with its service role only
-- after the requesting account passes the entitlement check.
create table public.guided_content_releases (
  content_id text not null,
  version integer not null,
  slug text not null,
  status text not null default 'draft',
  source_sha256 text not null,
  reader_sha256 text not null,
  payload jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (content_id, version),
  unique (slug, version),
  constraint guided_content_releases_content_id check (
    content_id ~ '^guided-edition:[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint guided_content_releases_version check (version > 0),
  constraint guided_content_releases_slug check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint guided_content_releases_status check (
    status in ('draft', 'published', 'retired')
  ),
  constraint guided_content_releases_source_hash check (
    source_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint guided_content_releases_reader_hash check (
    reader_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint guided_content_releases_payload_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint guided_content_releases_payload_size check (
    octet_length(payload::text) <= 262144
  ),
  constraint guided_content_releases_publication check (
    status <> 'published' or published_at is not null
  )
);

alter table public.guided_content_releases enable row level security;
alter table public.guided_content_releases force row level security;

revoke all on public.guided_content_releases from public, anon, authenticated;
grant select on public.guided_content_releases to service_role;

-- Defense in depth: even if a client table grant is added accidentally later,
-- browser roles still receive no rows.
create policy guided_content_releases_deny_client_access
  on public.guided_content_releases
  for select
  to anon, authenticated
  using (false);

comment on table public.guided_content_releases is
  'Server-only canonical Guided Edition releases; never expose payloads to browser roles.';

commit;
