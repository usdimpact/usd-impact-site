-- ISSUE #950 - REVIEW ONLY, NOT APPROVED FOR LIVE EXECUTION.
-- Scoped S3 JWT transfer rollback; this file is NOT a migration.
-- Target ONLY isolated restore movnekagnxgcyenczfoc.
-- NEVER Production gjzetjugmnwanvjkchux.
-- Independently verify the exact Management project ref in a protected runner.
-- An ephemeral host hash is only supplemental defense, NOT project identity.
-- Deliberately invalid private host/UUID placeholders make direct use fail.
-- If host changes, policies drift or an install partially exists, STOP and
-- seek DBA/security manual remediation. Do not blindly bypass the guard.
-- Rollback must be possible AFTER JWT expiry and Auth session revocation:
-- it checks existing policy identity without requiring an active Auth user.
-- No Storage files, Auth users or data rows are deleted by this template.
begin;

do $issue950_rollback_preflight$
declare
  approved_host_md5 text := '__ISSUE950_RESTORE_SERVER_HOST_MD5__';
  synthetic_subject uuid := '__ISSUE950_RESTORE_SYNTHETIC_UUID__'::uuid;
  observed_policies integer;
begin
  if inet_server_addr() is null
     or approved_host_md5 !~ '^[0-9a-f]{32}$'
     or md5(inet_server_addr()::text) <> approved_host_md5
  then raise exception 'issue950 rollback: project host binding not verified'; end if;

  select count(*) into observed_policies from pg_policies p
  where p.schemaname='storage' and p.tablename in ('objects','buckets');
  -- A zero-policy baseline makes an already completed rollback idempotent.
  if observed_policies=0 then return; end if;
  -- Never drop another policy or continue on a partial/mismatched state.
  if observed_policies<>4 or exists (
    select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename in ('objects','buckets')
      and (p.permissive<>'PERMISSIVE'
        or p.roles<>array['authenticated']::name[]
        or not ((p.tablename='objects' and p.policyname='issue950_restore_session_objects_select' and p.cmd='SELECT')
            or (p.tablename='objects' and p.policyname='issue950_restore_session_objects_insert' and p.cmd='INSERT')
            or (p.tablename='objects' and p.policyname='issue950_restore_session_objects_update' and p.cmd='UPDATE')
            or (p.tablename='buckets' and p.policyname='issue950_restore_session_buckets_select' and p.cmd='SELECT'))
        -- UPDATE must retain BOTH its USING and WITH CHECK fencing.
        -- Checking their concatenation would miss a widened second clause.
        or (p.cmd in ('SELECT','UPDATE') and (
           p.qual is null
           or position(synthetic_subject::text in p.qual)=0
           or position('now()' in p.qual)=0))
        or (p.cmd in ('INSERT','UPDATE') and (
           p.with_check is null
           or position(synthetic_subject::text in p.with_check)=0
           or position('now()' in p.with_check)=0))
        or (p.tablename='objects' and (
           (p.cmd in ('SELECT','UPDATE') and (
             position('bucket_id' in coalesce(p.qual,''))=0
             or position('name' in coalesce(p.qual,''))=0
             or position('library-pass-assets' in coalesce(p.qual,''))=0
             or position('library-pass-books' in coalesce(p.qual,''))=0))
           or (p.cmd in ('INSERT','UPDATE') and (
             position('bucket_id' in coalesce(p.with_check,''))=0
             or position('name' in coalesce(p.with_check,''))=0
             or position('library-pass-assets' in coalesce(p.with_check,''))=0
             or position('library-pass-books' in coalesce(p.with_check,''))=0))))
        or (p.tablename='buckets' and (
           position('public' in coalesce(p.qual,''))=0
           or position('library-pass-assets' in coalesce(p.qual,''))=0
           or position('library-pass-books' in coalesce(p.qual,''))=0)))
  )
  then raise exception 'issue950 rollback: unexpected policy identity or shape'; end if;
end
$issue950_rollback_preflight$;

drop policy if exists issue950_restore_session_objects_select on storage.objects;
drop policy if exists issue950_restore_session_objects_insert on storage.objects;
drop policy if exists issue950_restore_session_objects_update on storage.objects;
drop policy if exists issue950_restore_session_buckets_select on storage.buckets;
commit;
