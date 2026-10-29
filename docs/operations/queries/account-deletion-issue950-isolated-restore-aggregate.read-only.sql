-- Issue #950 — Source vs. isolated restore fingerprint, SELECT ONLY.
-- Run only with explicit project_id for each project; never execute SQL in
-- Production as part of this acceptance. No personal rows, emails, secrets,
-- UUIDs, tokens or Vault contents returned.
-- Source: ycstrcvshdluovtuasjc
-- Temporary RESTORE ONLY: movnekagnxgcyenczfoc
-- NO DDL/DML, no role changes, no provider calls, no Auth operations.
with
  cols as (
    select table_schema,table_name,column_name,udt_name,is_nullable,ordinal_position
    from information_schema.columns
    where table_schema in ('public','auth','storage')
  ),
  policies as (
    select schemaname,tablename,policyname,cmd,roles,qual,with_check
    from pg_policies where schemaname='public'
  ),
  definitions as (
    select n.nspname,p.proname,
      pg_get_function_identity_arguments(p.oid) as args,
      pg_get_functiondef(p.oid) as body
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'request_account_deletion',
        'prepare_account_deletion_auth_removal',
        'finalize_account_deletion'
      )
  )
select jsonb_build_object(
 'pg_major',split_part(current_setting('server_version'),'.',1),
 'auth_users',(select count(*) from auth.users),
 'auth_sessions',(select count(*) from auth.sessions),
 'profiles',(select count(*) from public.profiles),
 'pending_deletions',(select count(*) from public.profiles where status='deletion_pending'),
 'entitlements',(select count(*) from public.entitlements),
 'privacy_requests',(select count(*) from public.privacy_requests),
 'notification_outbox',(select count(*) from public.notification_outbox),
 'storage_objects_metadata',(select count(*) from storage.objects),
 'storage_buckets_metadata',(select count(*) from storage.buckets),
 'migration_entries',(select count(*) from supabase_migrations.schema_migrations),
 'schema_columns_count',(select count(*) from cols),
 'schema_columns_sha256',(select encode(sha256(convert_to(
   string_agg(table_schema||'.'||table_name||'.'||column_name||':'||
     udt_name||':'||is_nullable||':'||ordinal_position::text,
     E'\n' order by table_schema,table_name,ordinal_position
   ),'UTF8')),'hex') from cols),
 'public_policies_count',(select count(*) from policies),
 'public_policies_sha256',(select encode(sha256(convert_to(
   string_agg(schemaname||'.'||tablename||'.'||policyname||':'||
     cmd||':'||array_to_string(roles,',')||':'||coalesce(qual,'')||
     ':'||coalesce(with_check,''),
     E'\n' order by schemaname,tablename,policyname
   ),'UTF8')),'hex') from policies),
 'legacy_deletion_functions_count',(select count(*) from definitions),
 'legacy_deletion_functions_sha256',(select encode(sha256(convert_to(
   string_agg(nspname||'.'||proname||'('||args||'):'||body,
     E'\n' order by nspname,proname,args
   ),'UTF8')),'hex') from definitions),
 'installed_extensions',(select coalesce(
   jsonb_agg(extname order by extname),'[]'::jsonb
 ) from pg_extension),
 'cron_jobs_present',to_regclass('cron.job') is not null,
 'outbound_http_queue_present',to_regclass('net.http_request_queue') is not null,
 'contains_personal_rows',false,
 'full_service_restore_proven',false
) as issue950_restore_snapshot;