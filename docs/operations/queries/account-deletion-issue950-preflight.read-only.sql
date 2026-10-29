-- Issue #950 — READ ONLY / NO PII / NO DDL / NO DML.
-- Safe catalog and aggregate preflight. Do not treat backup evidence as present
-- merely because this returns successfully. Run separately per environment
-- and retain an operator-approved timestamp/project identity.
select jsonb_build_object(
 'postgreSQL_version', current_setting('server_version'),
 'claim_attempts_table',
    pg_catalog.to_regclass('account_deletion_internal.attempts') is not null,
 'claim_rpc',
    pg_catalog.to_regprocedure('public.claim_due_account_deletion(uuid,uuid,uuid)') is not null,
 'claimed_begin_rpc',
    pg_catalog.to_regprocedure('public.begin_claimed_auth_removal(uuid,uuid,uuid,bigint)') is not null,
 'claimed_finalize_rpc',
    pg_catalog.to_regprocedure('public.finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)') is not null,
 'private_completion_escrow',
    pg_catalog.to_regclass('account_deletion_internal.completion_intents') is not null,
 'completion_recovery_list_rpc',
    pg_catalog.to_regprocedure('public.list_account_deletion_completion_recoveries(integer)') is not null,
 'completion_recovery_ack_rpc',
    pg_catalog.to_regprocedure('public.confirm_account_deletion_completion_outbox(uuid,uuid,uuid)') is not null,
 'request_generation_column',
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles'
        and column_name='deletion_request_id'
    ),
 'legacy_prepare_callable_service',
    case when pg_catalog.to_regprocedure(
        'public.prepare_account_deletion_auth_removal(uuid)'
      ) is not null
      then has_function_privilege('service_role',
        'public.prepare_account_deletion_auth_removal(uuid)','EXECUTE')
      else false end,
 'legacy_finalize_callable_service',
    case when pg_catalog.to_regprocedure(
        'public.finalize_account_deletion(uuid)'
      ) is not null
      then has_function_privilege('service_role',
        'public.finalize_account_deletion(uuid)','EXECUTE')
      else false end,
 'pending_profiles',
    (select pg_catalog.count(*) from public.profiles where status='deletion_pending'),
 'detached_pending_profiles',
    (select pg_catalog.count(*) from public.profiles
      where status='deletion_pending' and auth_user_id is null),
 'owned_storage_objects',
    (select pg_catalog.count(*) from storage.objects where owner_id is not null),
 'owners_with_storage',
    (select pg_catalog.count(distinct owner_id) from storage.objects where owner_id is not null),
 'storage_bucket_count',
    (select pg_catalog.count(*) from storage.buckets),
 'auth_sessions_for_pending_accounts',
    (select pg_catalog.count(*) from auth.sessions s
      join public.profiles p on p.account_id=s.user_id
      where p.status='deletion_pending'),
 'jwt_link_fenced_own_policies',
    (select pg_catalog.count(*) from pg_catalog.pg_policies
      where schemaname='public'
        and roles @> array['authenticated']::name[]
        and qual ilike '%auth_user_id%'),
 'jwt_auth_uid_own_policies_total',
    (select pg_catalog.count(*) from pg_catalog.pg_policies
      where schemaname='public'
        and roles @> array['authenticated']::name[]
        and qual ilike '%auth.uid%'),
 'completed_email_outbox_count',
    (select pg_catalog.count(*) from public.notification_outbox
      where message_id='account_deletion_completed'),
 'raw_recipient_exported',false,
 'backup_restore_verified_by_this_query',false
) as issue950_read_only_preflight;
