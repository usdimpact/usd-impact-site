begin;

alter table public.guided_content_releases
  add column chapter_number integer;

update public.guided_content_releases
set chapter_number = (payload ->> 'number')::integer
where chapter_number is null;

alter table public.guided_content_releases
  alter column chapter_number set not null,
  add constraint guided_content_releases_chapter_number
    check (chapter_number > 0);

create unique index guided_content_releases_one_published_content_idx
  on public.guided_content_releases (content_id)
  where status = 'published';

create unique index guided_content_releases_one_published_slug_idx
  on public.guided_content_releases (slug)
  where status = 'published';

create unique index guided_content_releases_published_chapter_number_idx
  on public.guided_content_releases (chapter_number)
  where status = 'published';

comment on column public.guided_content_releases.chapter_number is
  'Stable reading order for the server-side published Guided Edition catalog.';

commit;
