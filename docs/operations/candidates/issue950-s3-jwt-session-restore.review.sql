-- ISSUE950 REVIEW ONLY - NOT A MIGRATION, NOT APPROVED, NOT EXECUTABLE AS WRITTEN.
-- Target ONLY the existing ISOLATED RESTORED Development project: movnekagnxgcyenczfoc
-- Never Production gjzetjugmnwanvjkchux. No real customer identities.
-- This template deliberately contains invalid UUID, UTC-expiry, approved-email and
-- private project-host fingerprint placeholders. Cluster system_identifier
-- is shared by all 3 environments, so it CANNOT identify a target.
-- Substituting real synthetic Auth IDs requires independent DBA/security/privacy
-- approval, bounded issuance, tested S3 JWT sessions and a rollback window.
-- Source SELECT only; restored-target SELECT/INSERT/UPDATE only; NO DELETE.
-- Does not create S3 credentials, JWTs, Auth users or Storage objects.
-- Supabase's S3 session-token option respects Storage RLS; unlike generated
-- project-wide S3 access keys, it does not bypass Storage policies.
begin;

do $issue950_preflight$
declare
  synthetic_subject uuid := '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid;
  approved_expires_at timestamptz := '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz;
  -- The runner must privately attest the exact target project's current
  -- server address before SQL is instantiated. This is an additional
  -- fail-closed, failover-sensitive guard, not a durable project identity.
  -- Never publish the actual address or fingerprint in source control.
  approved_host_md5 text := '__ISSUE950_RESTORE_SERVER_HOST_MD5__';
  expected_count integer;
begin
  if inet_server_addr() is null
     or approved_host_md5 !~ '^[0-9a-f]{32} or approved_expires_at > now() + interval '8 hours'
  then raise exception 'issue950 scoped session: expiry must be future and <=8h'; end if;
  -- Both real projects have on_auth_user_created -> handle_new_auth_user,
  -- which ALWAYS creates a profile. The temporary Auth principal therefore
  -- MUST have a canonical but explicitly SUSPENDED application profile,
  -- not an absent one. Admin-only raw_app_meta_data distinguishes the
  -- synthetic transfer subject; user-editable raw_user_meta_data is unsafe.
  if to_regclass('auth.users') is null or to_regclass('public.profiles') is null
    or to_regclass('public.entitlements') is null
  then raise exception 'issue950 scoped session: Auth/profile/entitlement schema missing'; end if;
  if not exists (
    select 1 from auth.users u
    join public.profiles p on p.account_id=u.id
    where u.id=synthetic_subject
      and p.auth_user_id=u.id
      and p.status::text='suspended'
      and p.deleted_at is null
      and p.deletion_requested_at is null
      and p.deletion_due_at is null
      and p.email = coalesce(u.email,'')
      and u.email = '__ISSUE950_APPROVED_TEST_EMAIL__'
      and u.raw_app_meta_data->>'issue950_scoped_s3' = 'restore'
  )
  then raise exception 'issue950 scoped session: synthetic Auth/profile isolation proof missing'; end if;
  if exists(select 1 from public.entitlements e
    where e.account_id=synthetic_subject)
  then raise exception 'issue950 scoped session: synthetic user has paid entitlements'; end if;
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

create policy issue950_restore_session_objects_select on storage.objects
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_objects_insert on storage.objects
  for insert to authenticated
  with check (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_objects_update on storage.objects
  for update to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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
  )
  with check (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_buckets_select on storage.buckets
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
    and now() < '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz
    and id in ('library-pass-assets','library-pass-books')
    and public=false
  );

commit;

     or md5(inet_server_addr()::text) <> approved_host_md5
  then raise exception 'issue950 scoped session: project host binding not verified'; end if;
  if approved_expires_at <= now() or approved_expires_at > now() + interval '8 hours'
  then raise exception 'issue950 scoped session: expiry must be future and <=8h'; end if;
  -- Both real projects have on_auth_user_created -> handle_new_auth_user,
  -- which ALWAYS creates a profile. The temporary Auth principal therefore
  -- MUST have a canonical but explicitly SUSPENDED application profile,
  -- not an absent one. Admin-only raw_app_meta_data distinguishes the
  -- synthetic transfer subject; user-editable raw_user_meta_data is unsafe.
  if to_regclass('auth.users') is null or to_regclass('public.profiles') is null
    or to_regclass('public.entitlements') is null
  then raise exception 'issue950 scoped session: Auth/profile/entitlement schema missing'; end if;
  if not exists (
    select 1 from auth.users u
    join public.profiles p on p.account_id=u.id
    where u.id=synthetic_subject
      and p.auth_user_id=u.id
      and p.status::text='suspended'
      and p.deleted_at is null
      and p.deletion_requested_at is null
      and p.deletion_due_at is null
      and p.email = coalesce(u.email,'')
      and u.email = '__ISSUE950_APPROVED_TEST_EMAIL__'
      and u.raw_app_meta_data->>'issue950_scoped_s3' = 'restore'
  )
  then raise exception 'issue950 scoped session: synthetic Auth/profile isolation proof missing'; end if;
  if exists(select 1 from public.entitlements e
    where e.account_id=synthetic_subject)
  then raise exception 'issue950 scoped session: synthetic user has paid entitlements'; end if;
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

create policy issue950_restore_session_objects_select on storage.objects
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_objects_insert on storage.objects
  for insert to authenticated
  with check (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_objects_update on storage.objects
  for update to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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
  )
  with check (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
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

create policy issue950_restore_session_buckets_select on storage.buckets
  for select to authenticated
  using (
    (select auth.uid()) = '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid
    and now() < '__ISSUE950_EXPIRES_AT_UTC__'::timestamptz
    and id in ('library-pass-assets','library-pass-books')
    and public=false
  );

commit;
