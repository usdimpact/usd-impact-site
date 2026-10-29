-- ISSUE #950 DEVELOPMENT METADATA CONTRACT — SELECT ONLY / NO USER ROWS.
-- Source pin: 2026-10-29, USD Impact Development ycstrcvshdluovtuasjc.
-- No DDL, DML, backups, Auth Admin, schema migration, or provider actions.
-- VERIFY project identity in your connector before execution. It is NOT
-- authenticated by this SQL; never execute blindly on Production.
--
-- A MATCH means only that these published metadata dependencies match the
-- reviewed Development baseline. It does NOT authorize deployment, backup
-- restore, irreversible identity deletion, or production cutover.
with required_columns(table_name, column_name, udt_name) as (
  values
    ('profiles', 'account_id', 'uuid'),
    ('profiles', 'auth_user_id', 'uuid'),
    ('profiles', 'status', 'account_status'),
    ('profiles', 'email', 'text'),
    ('profiles', 'display_name', 'text'),
    ('profiles', 'deletion_requested_at', 'timestamptz'),
    ('profiles', 'deletion_due_at', 'timestamptz'),
    ('profiles', 'deleted_at', 'timestamptz'),
    ('profiles', 'updated_at', 'timestamptz'),
    ('privacy_requests', 'account_id', 'uuid'),
    ('privacy_requests', 'email', 'text'),
    ('privacy_requests', 'request_type', 'privacy_request_type'),
    ('privacy_requests', 'status', 'request_status'),
    ('privacy_requests', 'requested_at', 'timestamptz'),
    ('privacy_requests', 'due_at', 'timestamptz'),
    ('privacy_requests', 'completed_at', 'timestamptz'),
    ('entitlements', 'account_id', 'uuid'),
    ('entitlements', 'state', 'entitlement_state'),
    ('entitlements', 'id', 'uuid'),
    ('entitlement_events', 'account_id', 'uuid'),
    ('entitlement_events', 'event_key', 'text'),
    ('entitlement_events', 'to_state', 'entitlement_state'),
    ('bookmarks', 'account_id', 'uuid'),
    ('learning_progress', 'account_id', 'uuid'),
    ('support_requests', 'account_id', 'uuid'),
    ('support_requests', 'email', 'text'),
    ('admin_audit_entries', 'action', 'text'),
    ('admin_audit_entries', 'target_type', 'text'),
    ('notification_outbox', 'id', 'uuid'),
    ('notification_outbox', 'message_id', 'text'),
    ('notification_outbox', 'business_object_type', 'text'),
    ('notification_outbox', 'business_object_id', 'text'),
    ('notification_outbox', 'state_version', 'int4'),
    ('notification_outbox', 'recipient_email_normalized', 'text'),
    ('notification_outbox', 'template_id', 'text'),
    ('notification_outbox', 'classification', 'text'),
    ('notification_outbox', 'consent_required', 'bool'),
    ('notification_outbox', 'payload', 'jsonb'),
    ('notification_outbox', 'idempotency_key', 'text')
), missing_columns as (
  select format('column:%s.%s:%s', e.table_name,e.column_name,e.udt_name) as reason
  from required_columns e
  left join information_schema.columns c
    on c.table_schema='public'
    and c.table_name=e.table_name
    and c.column_name=e.column_name
  where c.column_name is null or c.udt_name is distinct from e.udt_name
), required_policies(table_name, policy_name, policy_cmd) as (
  values
    ('profiles', 'profiles_select_own', 'SELECT'),
    ('bookmarks', 'bookmarks_select_own', 'SELECT'),
    ('bookmarks', 'bookmarks_delete_own', 'DELETE'),
    ('bookmarks', 'bookmarks_update_own', 'UPDATE'),
    ('learning_progress', 'learning_progress_select_own', 'SELECT'),
    ('learning_progress', 'learning_progress_update_own', 'UPDATE'),
    ('entitlements', 'entitlements_select_own', 'SELECT'),
    ('entitlement_events', 'entitlement_events_select_own', 'SELECT'),
    ('purchase_intents', 'purchase_intents_select_own', 'SELECT'),
    ('purchases', 'purchases_select_own', 'SELECT'),
    ('subscription_events', 'subscription_events_select_own', 'SELECT'),
    ('subscriptions', 'subscriptions_select_own', 'SELECT'),
    ('privacy_requests', 'privacy_requests_select_own', 'SELECT'),
    ('support_requests', 'support_requests_select_own', 'SELECT')
), missing_policies as (
  select format('policy:%s.%s:%s',e.table_name,e.policy_name,e.policy_cmd) as reason
  from required_policies e
  left join pg_catalog.pg_policies p
    on p.schemaname='public' and p.tablename=e.table_name
    and p.policyname=e.policy_name
  where p.policyname is null or p.cmd is distinct from e.policy_cmd
    or not (p.roles @> array['authenticated']::name[])
), required_functions(signature, definition_sha256, authenticated_execute, service_execute) as (
  values
    ('public.request_account_deletion()', '1a415cd54636501495932aba842b582a36dbbb9e44d1fc96af4c7cf16fe3168d', true, false),
    ('public.prepare_account_deletion_auth_removal(uuid)', 'c507fd1049f6104aef93cdd2583b30c8c41cd1c6baea963057d5eab2465a68d0', false, true),
    ('public.finalize_account_deletion(uuid)', '02f71619e17782ef50baf141fb82a6245908232d1b21787ddb6feb323545c3cb', false, true)
), function_checks as (
  select e.signature,e.definition_sha256,
    e.authenticated_execute,e.service_execute,p.oid as function_oid,
    pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
    p.prosecdef,
    case when p.oid is not null then
      pg_catalog.encode(pg_catalog.sha256(
        pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid),'UTF8')
      ),'hex')
    end as actual_definition_sha256,
    case when p.oid is not null then
      pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    end as anon_execute,
    case when p.oid is not null then
      pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
    end as actual_authenticated_execute,
    case when p.oid is not null then
      pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
    end as actual_service_execute
  from required_functions e
  left join pg_catalog.pg_proc p
    on p.oid=pg_catalog.to_regprocedure(e.signature)
), changed_functions as (
  select 'function:'||signature as reason from function_checks
  where function_oid is null
    or actual_definition_sha256 is distinct from definition_sha256
    or function_owner is distinct from 'postgres'
    or prosecdef is distinct from true
    or anon_execute is distinct from false
    or actual_authenticated_execute is distinct from authenticated_execute
    or actual_service_execute is distinct from service_execute
), checks as (
  select 'postgres_major_not_17' as reason
    where pg_catalog.current_setting('server_version_num')::integer < 170000
       or pg_catalog.current_setting('server_version_num')::integer >= 180000
  union all
  select 'auth_fk_on_delete_set_null_missing'
    where not exists (
      select 1 from pg_catalog.pg_constraint c
      where c.conrelid=pg_catalog.to_regclass('public.profiles')
        and c.conname='profiles_auth_user_id_fkey'
        and c.contype='f' and c.confdeltype='n'
        and c.confrelid=pg_catalog.to_regclass('auth.users')
    )
  union all
  select 'outbox_idempotency_unique_index_missing'
    where not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_index i on i.indexrelid=c.oid
      where c.relname='notification_outbox_idempotency_key_unique'
        and i.indrelid=pg_catalog.to_regclass('public.notification_outbox')
        and i.indisunique
    )
  union all
  select 'outbox_business_state_unique_index_missing'
    where not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_index i on i.indexrelid=c.oid
      where c.relname='notification_outbox_business_state_unique'
        and i.indrelid=pg_catalog.to_regclass('public.notification_outbox')
        and i.indisunique
    )
  union all
  select 'pending_profiles_require_independent_reconciliation'
    where exists(select 1 from public.profiles where status='deletion_pending')
  union all
  select 'claim_already_installed_or_partially_installed'
    where pg_catalog.to_regclass('account_deletion_internal.attempts') is not null
       or pg_catalog.to_regclass('account_deletion_internal.completion_intents') is not null
       or pg_catalog.to_regprocedure('public.claim_due_account_deletion(uuid,uuid,uuid)') is not null
       or exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='profiles'
           and column_name='deletion_request_id'
       )
  union all
  select 'target_profile_fence_trigger_name_in_use'
    where exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid=pg_catalog.to_regclass('public.profiles')
        and tgname='profiles_enforce_account_deletion_claim' and not tgisinternal
    )
  union all
  select 'entitlement_deleted_enum_missing'
    where not exists (
      select 1 from pg_catalog.pg_enum e
      join pg_catalog.pg_type t on t.oid=e.enumtypid
      join pg_catalog.pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and t.typname='entitlement_state'
        and e.enumlabel='account_deleted'
    )
), issues as (
  select reason from missing_columns
  union all select reason from missing_policies
  union all select reason from changed_functions
  union all select reason from checks
)
select pg_catalog.jsonb_build_object(
 'checkpoint','2026-10-29-dev-schema-issue950',
 'metadata_match',not exists(select 1 from issues),
 'findings',(select pg_catalog.coalesce(
   pg_catalog.jsonb_agg(reason order by reason),'[]'::jsonb
  ) from issues),
 'columns_expected',(select count(*) from required_columns),
 'policies_expected',(select count(*) from required_policies),
 'functions_pinned',(select count(*) from required_functions),
 'sampled_pending_profiles',(select count(*) from public.profiles where status='deletion_pending'),
 'backup_restore_verified',false,
 'migration_authorized',false,
 'production_approved',false,
 'note','Read-only Development source contract; requires separate full schema, backup and synthetic Auth review'
) as issue950_schema_contract;
