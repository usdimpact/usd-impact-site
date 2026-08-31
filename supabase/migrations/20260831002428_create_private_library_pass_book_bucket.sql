insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'library-pass-books',
  'library-pass-books',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- Intentionally no storage.objects policies. Only the trusted server-side
-- service credential may upload or mint short-lived signed delivery URLs.
