create or replace function public.search_knowledge_chunks(
  query_text text,
  allowed_access_tiers text[] default array['open']::text[],
  match_count integer default 8,
  query_language text default null
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  source_path text,
  title text,
  content text,
  language text,
  access_tier text,
  chunk_index integer,
  published_at timestamptz,
  metadata jsonb,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    k.id,
    k.source_type,
    k.source_id,
    k.source_path,
    k.title,
    k.content,
    k.language,
    k.access_tier,
    k.chunk_index,
    k.published_at,
    k.metadata,
    ts_rank_cd(k.search_vector, websearch_to_tsquery('simple'::regconfig, query_text))::real as rank
  from public.knowledge_chunks as k
  where char_length(trim(query_text)) between 2 and 500
    and match_count between 1 and 20
    and k.access_tier = any(allowed_access_tiers)
    and (query_language is null or k.language = query_language)
    and k.search_vector @@ websearch_to_tsquery('simple'::regconfig, query_text)
  order by rank desc, k.published_at desc nulls last, k.source_type, k.source_id, k.chunk_index
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.search_knowledge_chunks(text, text[], integer, text) from public, anon, authenticated;
grant execute on function public.search_knowledge_chunks(text, text[], integer, text) to service_role;

comment on function public.search_knowledge_chunks(text, text[], integer, text) is
  'Server-only bounded full-text retrieval for USD Impact citation chunks. Caller must pass access tiers already authorized by application entitlement logic.';
