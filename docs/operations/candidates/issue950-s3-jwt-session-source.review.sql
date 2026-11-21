-- ISSUE950 REVIEW ONLY - NOT A MIGRATION, NOT APPROVED, NOT EXECUTABLE AS WRITTEN.
-- Target ONLY the existing SOURCE Development project: ycstrcvshdluovtuasjc
-- Never Production gjzetjugmnwanvjkchux. No real customer identities.
-- This template deliberately contains invalid UUID and UTC-expiry placeholders.
-- Substituting real synthetic Auth IDs requires independent DBA/security/privacy
-- approval, bounded issuance, tested S3 JWT sessions and a rollback window.
-- Source SELECT only; restored-target SELECT/INSERT/UPDATE only; NO DELETE.
-- Does not create S3 credentials, JWTs, Auth users or Storage objects.
-- Supabase's S3 session-token option respects Storage RLS; unlike generated
-- project-wide S3 access keys, it does not bypass Storage policies.
begin;

do $issue950_preflight$
declare
  synthetic_subject uuid := '__ISSUE950_SOURCE_SYNTHETIC_UUID__'::uuid;
  approved_expires_at timestamptz := '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz;
  expected_count integer;
begin
  if approved_expires_at <= now() or approved_expires_at > now() + interval '8 hours'
  then raise exception 'issue950 scoped session: expiry must be future and <=8h'; end if;
  if to_regclass('auth.users') is null or to_regclass('public.profiles') is null
    or not exists (select 1 from auth.users where id=synthetic_subject)
  then raise exception 'issue950 scoped session: preapproved synthetic Auth user absent'; end if;
  if exists(select 1 from public.profiles p
    where p.account_id=synthetic_subject or p.auth_user_id=synthetic_subject)
  then raise exception 'issue950 scoped session: synthetic principal is an application profile'; end if;
  if (select relrowsecurity from pg_class where oid='storage.objects'::regclass) is distinct from true
    or (select relrowsecurity from pg_class where oid='storage.buckets'::regclass) is distinct from true
  then raise exception 'issue950 scoped session: Storage RLS is disabled'; end if;
  if exists(select 1 from pg_policies
    where schemaname='storage' and tablename in ('objects','buckets'))
  then raise exception 'issue950 scoped session: unexpected pre-existing Storage policies'; end if;
  if (select count(*) from storage.buckets
    where id in ('library-pass-assets','library-pass-books') and public=false) <> 2
  then raise exception 'issue950 scoped session: exact two private buckets required'; end if;
  if (select count(*) from storage.objects
    where bucket_id in ('library-pass-assets','library-pass-books')) <> 21
    or (select count(*) from storage.objects where (
      (bucket_id = 'library-pass-assets'
       and name in (
      'audiobook/read-the-dollar-first/v1/00-read-the-dollar-first.mp3',
      'audiobook/read-the-dollar-first/v1/01-acknowledgments-and-reader-guide.mp3',
      'audiobook/read-the-dollar-first/v1/02-introduction-why-this-book-exists.mp3',
      'audiobook/read-the-dollar-first/v1/03-chapter-1-why-the-dollar-comes-first.mp3',
      'audiobook/read-the-dollar-first/v1/04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3',
      'audiobook/read-the-dollar-first/v1/05-chapter-3-usd-is-not-dxy.mp3',
      'audiobook/read-the-dollar-first/v1/06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3',
      'audiobook/read-the-dollar-first/v1/07-chapter-5-oil-is-not-a-dollar-trade-only.mp3',
      'audiobook/read-the-dollar-first/v1/08-chapter-6-gold-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/09-chapter-7-bitcoin-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/10-chapter-8-gas-lng-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/11-chapter-9-fx-carry-and-translation-risk.mp3',
      'audiobook/read-the-dollar-first/v1/12-chapter-10-reading-regimes-the-eleven-year-record.mp3',
      'audiobook/read-the-dollar-first/v1/13-chapter-11-the-weekly-operating-framework.mp3',
      'audiobook/read-the-dollar-first/v1/14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3',
      'audiobook/read-the-dollar-first/v1/15-chapter-13-what-to-watch-from-here.mp3',
      'audiobook/read-the-dollar-first/v1/16-further-reading.mp3',
      'audiobook/read-the-dollar-first/v1/17-appendix-a-quick-glossary.mp3',
      'audiobook/read-the-dollar-first/v1/18-appendix-b-usd-impact-score-methodology.mp3',
      'audiobook/read-the-dollar-first/v1/19-about-usd-impact.mp3'
       ))
      or (bucket_id = 'library-pass-books'
       and name = 'book/read-the-dollar-first/edition-1.3/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf')
    )) <> 21
    or (select count(*) from storage.objects
      where bucket_id='library-pass-assets') <>20
    or (select count(*) from storage.objects
      where bucket_id='library-pass-books') <>1
  then raise exception 'issue950 scoped session: exact 21-key immutable manifest mismatch'; end if;
end
$issue950_preflight$;

create policy issue950_source_session_objects_select on storage.objects
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_SOURCE_SYNTHETIC_UUID__'::uuid
    and now() < '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz
    and (
      (bucket_id = 'library-pass-assets'
       and name in (
      'audiobook/read-the-dollar-first/v1/00-read-the-dollar-first.mp3',
      'audiobook/read-the-dollar-first/v1/01-acknowledgments-and-reader-guide.mp3',
      'audiobook/read-the-dollar-first/v1/02-introduction-why-this-book-exists.mp3',
      'audiobook/read-the-dollar-first/v1/03-chapter-1-why-the-dollar-comes-first.mp3',
      'audiobook/read-the-dollar-first/v1/04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3',
      'audiobook/read-the-dollar-first/v1/05-chapter-3-usd-is-not-dxy.mp3',
      'audiobook/read-the-dollar-first/v1/06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3',
      'audiobook/read-the-dollar-first/v1/07-chapter-5-oil-is-not-a-dollar-trade-only.mp3',
      'audiobook/read-the-dollar-first/v1/08-chapter-6-gold-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/09-chapter-7-bitcoin-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/10-chapter-8-gas-lng-and-the-dollar.mp3',
      'audiobook/read-the-dollar-first/v1/11-chapter-9-fx-carry-and-translation-risk.mp3',
      'audiobook/read-the-dollar-first/v1/12-chapter-10-reading-regimes-the-eleven-year-record.mp3',
      'audiobook/read-the-dollar-first/v1/13-chapter-11-the-weekly-operating-framework.mp3',
      'audiobook/read-the-dollar-first/v1/14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3',
      'audiobook/read-the-dollar-first/v1/15-chapter-13-what-to-watch-from-here.mp3',
      'audiobook/read-the-dollar-first/v1/16-further-reading.mp3',
      'audiobook/read-the-dollar-first/v1/17-appendix-a-quick-glossary.mp3',
      'audiobook/read-the-dollar-first/v1/18-appendix-b-usd-impact-score-methodology.mp3',
      'audiobook/read-the-dollar-first/v1/19-about-usd-impact.mp3'
       ))
      or (bucket_id = 'library-pass-books'
       and name = 'book/read-the-dollar-first/edition-1.3/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf')
    )
  );

create policy issue950_source_session_buckets_select on storage.buckets
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_SOURCE_SYNTHETIC_UUID__'::uuid
    and now() < '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz
    and id in ('library-pass-assets','library-pass-books')
    and public=false
  );

commit;
