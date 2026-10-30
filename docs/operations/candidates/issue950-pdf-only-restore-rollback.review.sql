-- ISSUE950 PDF-PILOT ROLLBACK REVIEW ONLY - NO LIVE EXECUTION AUTHORIZATION.
-- Destination RESTORE project movnekagnxgcyenczfoc ONLY; never Production.
-- Invalid host and subject placeholders deliberately fail until privately attested.
-- Abort on unexpected policy or partial install; DBA incident/manual review needed.
-- No Storage object, customer data or Auth user is modified by this SQL.
begin;

do $issue950_pdf_pilot_rollback$
declare
  synthetic_subject uuid := '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid;
  approved_host_md5 text := '__ISSUE950_RESTORE_SERVER_HOST_MD5__';
  observed_count integer;
begin
  if inet_server_addr() is null
     or approved_host_md5 !~ '^[0-9a-f]{32}$'
     or md5(inet_server_addr()::text) <> approved_host_md5
  then raise exception 'issue950 PDF pilot rollback: host binding not verified'; end if;

  select count(*) into observed_count from pg_policies p
    where p.schemaname='storage' and p.tablename in ('objects','buckets');
  if observed_count=0 then return; end if;
  if observed_count<>4 or exists (
    select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename in ('objects','buckets')
      and (
        p.permissive <> 'PERMISSIVE'
        or p.roles <> array['authenticated']::name[]
        or not (
          (p.tablename='objects' and (
             (p.policyname='issue950_pdf_pilot_session_objects_select' and p.cmd='SELECT')
             or (p.policyname='issue950_pdf_pilot_session_objects_insert' and p.cmd='INSERT')
             or (p.policyname='issue950_pdf_pilot_session_objects_update' and p.cmd='UPDATE')
          ))
          or (p.tablename='buckets'
             and p.policyname='issue950_pdf_pilot_session_buckets_select'
             and p.cmd='SELECT')
        )
        or (p.cmd in ('SELECT','UPDATE') and
          (p.qual is null or
           position(synthetic_subject::text in p.qual)=0 or
           position('now()' in p.qual)=0))
        or (p.cmd in ('INSERT','UPDATE') and
          (p.with_check is null or
           position(synthetic_subject::text in p.with_check)=0 or
           position('now()' in p.with_check)=0))
        or (p.tablename='objects' and (
          (p.cmd in ('SELECT','UPDATE') and (
            position('library-pass-books' in coalesce(p.qual,''))=0 or
            position('USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf' in coalesce(p.qual,''))=0 or
            position('name' in coalesce(p.qual,''))=0))
          or (p.cmd in ('INSERT','UPDATE') and (
            position('library-pass-books' in coalesce(p.with_check,''))=0 or
            position('USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf' in coalesce(p.with_check,''))=0 or
            position('name' in coalesce(p.with_check,''))=0))))
        or (p.tablename='buckets' and
          (position('library-pass-books' in coalesce(p.qual,''))=0 or
           position('public' in coalesce(p.qual,''))=0))
      )
  ) then
    raise exception 'issue950 PDF pilot rollback: unexpected policy identity or shape';
  end if;
end
$issue950_pdf_pilot_rollback$;

drop policy if exists issue950_pdf_pilot_session_objects_select on storage.objects;
drop policy if exists issue950_pdf_pilot_session_objects_insert on storage.objects;
drop policy if exists issue950_pdf_pilot_session_objects_update on storage.objects;
drop policy if exists issue950_pdf_pilot_session_buckets_select on storage.buckets;

commit;
