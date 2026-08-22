-- Development-verified server-only retrieval corpus for USD Impact.

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('book','lesson','daily','weekly_report','monthly_report','video','glossary','framework','other')),
  source_id text not null check (char_length(source_id) between 1 and 240),
  source_path text not null check (char_length(source_path) between 1 and 1000),
  title text not null check (char_length(title) between 1 and 500),
  content text not null check (char_length(content) between 1 and 20000),
  language text not null default 'en' check (language in ('en','es')),
  access_tier text not null default 'open' check (access_tier in ('open','library','research','internal')),
  chunk_index integer not null default 0 check (chunk_index >= 0),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 16384
  ),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, language, chunk_index)
);

alter table public.knowledge_chunks enable row level security;

-- The corpus may contain paid/internal text. Direct browser reads are denied;
-- application endpoints must authorize access tiers before returning excerpts.
revoke all on table public.knowledge_chunks from anon, authenticated;
grant select, insert, update, delete on table public.knowledge_chunks to service_role;

create index if not exists knowledge_chunks_search_idx
  on public.knowledge_chunks using gin (search_vector);

create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source_type, source_id, language, chunk_index);

create index if not exists knowledge_chunks_access_idx
  on public.knowledge_chunks (access_tier, language, published_at desc nulls last);

comment on table public.knowledge_chunks is
  'Server-only, citation-ready USD Impact retrieval corpus. Raw paid/internal chunks are never directly client-readable.';
