begin;

-- The Guided Edition canonical release tables are server-read-only application
-- data. Keep browser roles fully denied and restrict the service role to the
-- single table privilege required by the application read path.
revoke all on table public.guided_content_releases
  from public, anon, authenticated, service_role;
grant select on table public.guided_content_releases to service_role;

revoke all on table public.guided_supplement_releases
  from public, anon, authenticated, service_role;
grant select on table public.guided_supplement_releases to service_role;

commit;
