-- Private Library Pass audiobook delivery bucket (migration 20260812104532).
--
-- Deliberately do not add storage.objects policies. The authenticated browser
-- never reads this bucket directly; the server verifies Library Pass access
-- before using its Supabase secret key to mint a short-lived signed URL.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'library-pass-assets',
  'library-pass-assets',
  false,
  41943040,
  array['audio/mpeg']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
