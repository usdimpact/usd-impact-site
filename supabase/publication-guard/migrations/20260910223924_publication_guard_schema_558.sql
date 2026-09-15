-- Development-only Phase A installation for issue #558.
-- Managed-Supabase-compatible ownership model: low-privilege NOLOGIN definer owners,
-- temporary CREATE/membership only for ownership transfer, then revoked before completion.

do $$
begin
  if to_regnamespace('publication_guard') is not null
     or to_regnamespace('publication_guard_api') is not null then
    raise exception 'HOLD_PHASE_A_DRIFT_SCHEMA';
  end if;
  if exists (select 1 from pg_roles where rolname like 'fx558_%') then
    raise exception 'HOLD_PHASE_A_DRIFT_ROLE';
  end if;
end $$;

create schema publication_guard;
revoke all on schema publication_guard from public, anon, authenticated, service_role;
alter default privileges in schema publication_guard revoke execute on functions from public;

create table publication_guard.history_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0)
);
insert into publication_guard.history_state values (true, 0);

create table publication_guard.release_authorizations (
  release_id uuid primary key,
  repository text not null check (repository = 'usdimpact/usd-impact-site'),
  project_id text not null check (project_id = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7'),
  team_id text not null check (team_id = 'team_1LuMlacGuM198mRjoID4O3Ct'),
  deployment_id text not null check (deployment_id ~ '^dpl_[A-Za-z0-9]{8,80}$'),
  commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  approval_sha256 text not null check (approval_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null check (isfinite(expires_at)),
  created_at timestamptz not null,
  revoked_at timestamptz
);

create table publication_guard.publication_admissions (
  path text not null check (path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  release_id uuid not null references publication_guard.release_authorizations(release_id),
  event_mode text not null check (event_mode in ('preview', 'outcome', 'none')),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  calendar_checked_at timestamptz not null check (isfinite(calendar_checked_at)),
  calendar_valid_until timestamptz not null check (isfinite(calendar_valid_until)),
  preview_deadline timestamptz,
  not_before timestamptz,
  state text not null default 'pending' check (state in ('pending', 'admitted', 'revoked')),
  prepared_at timestamptz not null,
  admitted_at timestamptz,
  response_receipt_sha256 text,
  revoked_at timestamptz,
  primary key (path, source_sha256),
  unique (release_id, path),
  check (calendar_valid_until > calendar_checked_at and calendar_valid_until <= calendar_checked_at + interval '15 minutes'),
  check ((event_mode = 'preview' and preview_deadline is not null and isfinite(preview_deadline) and not_before is null)
    or (event_mode = 'outcome' and preview_deadline is null and not_before is not null and isfinite(not_before))
    or (event_mode = 'none' and preview_deadline is null and not_before is null and path !~ '^/news/catalysts/')),
  check (admitted_at is null or (isfinite(admitted_at) and admitted_at >= prepared_at and admitted_at >= calendar_checked_at
    and admitted_at < calendar_valid_until and (preview_deadline is null or admitted_at < preview_deadline)
    and (not_before is null or admitted_at >= not_before))),
  check ((admitted_at is null and response_receipt_sha256 is null)
    or (admitted_at is not null and response_receipt_sha256 is not null and response_receipt_sha256 ~ '^[a-f0-9]{64}$')),
  check ((state = 'pending' and admitted_at is null and revoked_at is null)
    or (state = 'admitted' and admitted_at is not null and revoked_at is null)
    or (state = 'revoked' and revoked_at is not null))
);

alter table publication_guard.history_state enable row level security;
alter table publication_guard.release_authorizations enable row level security;
alter table publication_guard.publication_admissions enable row level security;

create function publication_guard.guard_release() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare t timestamptz;
begin
  if TG_OP = 'DELETE' then raise exception 'HOLD_IMMUTABLE_RELEASE'; end if;
  t := clock_timestamp();
  if TG_OP = 'INSERT' then
    if NEW.created_at is not null or NEW.revoked_at is not null then raise exception 'HOLD_SERVER_TIME_REQUIRED'; end if;
    if not (NEW.expires_at > t and NEW.expires_at <= t + interval '15 minutes') then raise exception 'HOLD_APPROVAL_EXPIRED'; end if;
    NEW.created_at := t;
  else
    if (to_jsonb(NEW) - 'revoked_at') is distinct from (to_jsonb(OLD) - 'revoked_at')
      or OLD.revoked_at is not null or NEW.revoked_at is null then raise exception 'HOLD_IMMUTABLE_RELEASE'; end if;
    NEW.revoked_at := t;
  end if;
  return NEW;
end $$;
create trigger guard_release before insert or update or delete on publication_guard.release_authorizations
for each row execute function publication_guard.guard_release();

create function publication_guard.guard_admission() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare r publication_guard.release_authorizations; t timestamptz;
begin
  if TG_OP = 'DELETE' then raise exception 'HOLD_IMMUTABLE_ADMISSION'; end if;
  if TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) - array['state','admitted_at','response_receipt_sha256','revoked_at'])
      is distinct from (to_jsonb(OLD) - array['state','admitted_at','response_receipt_sha256','revoked_at']) then
      raise exception 'HOLD_IMMUTABLE_ADMISSION';
    end if;
    if NEW.state = 'revoked' and OLD.state in ('pending','admitted') then
      if NEW.admitted_at is distinct from OLD.admitted_at or NEW.response_receipt_sha256 is distinct from OLD.response_receipt_sha256
        or NEW.revoked_at is not null then raise exception 'HOLD_IMMUTABLE_ADMISSION'; end if;
      NEW.revoked_at := clock_timestamp();
      return NEW;
    end if;
    if not (OLD.state = 'pending' and NEW.state = 'admitted') then raise exception 'HOLD_INVALID_TRANSITION'; end if;
    if NEW.admitted_at is not null or NEW.revoked_at is not null then raise exception 'HOLD_SERVER_TIME_REQUIRED'; end if;
    if (NEW.response_receipt_sha256 ~ '^[a-f0-9]{64}$') is not true then raise exception 'HOLD_RESPONSE_RECEIPT_REQUIRED'; end if;
  else
    if NEW.state <> 'pending' or NEW.prepared_at is not null or NEW.admitted_at is not null
      or NEW.revoked_at is not null or NEW.response_receipt_sha256 is not null then raise exception 'HOLD_PENDING_REQUIRED'; end if;
  end if;
  select * into r from publication_guard.release_authorizations where release_id = NEW.release_id for update;
  if not found or r.revoked_at is not null then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
  t := clock_timestamp();
  if not (t < r.expires_at) then raise exception 'HOLD_APPROVAL_EXPIRED'; end if;
  if not (NEW.calendar_checked_at <= t and t < NEW.calendar_valid_until) then raise exception 'HOLD_EVIDENCE_EXPIRED'; end if;
  if NEW.preview_deadline is not null and t >= NEW.preview_deadline then raise exception 'HOLD_PREVIEW_EXPIRED'; end if;
  if NEW.not_before is not null and t < NEW.not_before then raise exception 'HOLD_OUTCOME_NOT_RELEASED'; end if;
  if TG_OP = 'INSERT' then NEW.prepared_at := t; else NEW.admitted_at := t; end if;
  return NEW;
end $$;
create trigger guard_admission before insert or update or delete on publication_guard.publication_admissions
for each row execute function publication_guard.guard_admission();

create function publication_guard.advance_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update publication_guard.history_state set revision = revision + 1 where singleton;
  if not found then raise exception 'HOLD_HISTORY_UNAVAILABLE'; end if;
  return null;
end $$;
create trigger release_history after insert or update on publication_guard.release_authorizations
for each row execute function publication_guard.advance_history();
create trigger admission_history after insert or update on publication_guard.publication_admissions
for each row execute function publication_guard.advance_history();

create function publication_guard.finalize_admission(p_release uuid, p_path text, p_source text, p_receipt text)
returns text language plpgsql security invoker set search_path = '' set lock_timeout = '3s' as $$
declare r publication_guard.release_authorizations; a publication_guard.publication_admissions;
begin
  if p_release is null or p_path is null or p_source is null or (p_receipt ~ '^[a-f0-9]{64}$') is not true then
    raise exception 'HOLD_INVALID_REQUEST';
  end if;
  select * into r from publication_guard.release_authorizations where release_id = p_release for update;
  if not found or r.revoked_at is not null then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
  select * into a from publication_guard.publication_admissions where path = p_path and source_sha256 = p_source for update;
  if not found or a.release_id <> p_release then raise exception 'HOLD_ADMISSION_NOT_PREPARED'; end if;
  if a.state = 'revoked' then raise exception 'HOLD_REVOKED'; end if;
  if a.state = 'admitted' then
    if a.response_receipt_sha256 <> p_receipt then raise exception 'HOLD_RECEIPT_CONFLICT'; end if;
    return 'ALREADY_RECORDED';
  end if;
  update publication_guard.publication_admissions set state = 'admitted', response_receipt_sha256 = p_receipt
    where path = p_path and source_sha256 = p_source;
  return 'RECORDED';
end $$;

create function publication_guard.iso(t timestamptz) returns text
language sql stable security invoker set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create function publication_guard.read_history(p_revision text, p_keys jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare rev text; result jsonb;
begin
  select revision::text into rev from publication_guard.history_state where singleton;
  if rev is null or p_revision is distinct from rev then raise exception 'HOLD_HISTORY_REVISION'; end if;
  if jsonb_typeof(p_keys) is distinct from 'array' or octet_length(p_keys::text) > 100000 then raise exception 'HOLD_INVALID_KEYS'; end if;
  if jsonb_array_length(p_keys) > 500 then raise exception 'HOLD_INVALID_KEYS'; end if;
  if exists (select 1 from jsonb_array_elements(p_keys) k where jsonb_typeof(k) <> 'object'
    or (k->>'path' ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') is not true
    or (k->>'sourceSha256' ~ '^[a-f0-9]{64}$') is not true
    or k - array['path','sourceSha256'] <> '{}'::jsonb) then raise exception 'HOLD_INVALID_KEYS'; end if;
  if (select count(*) from jsonb_array_elements(p_keys)) <> (select count(distinct k->>'path') from jsonb_array_elements(p_keys) k)
    then raise exception 'HOLD_DUPLICATE_KEYS'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('path', k->>'path', 'sourceSha256', k->>'sourceSha256',
    'record', case when a.path is null then null else jsonb_build_object(
      'schema', 'publication-admission/v1', 'repository', r.repository, 'projectId', r.project_id, 'teamId', r.team_id,
      'path', a.path, 'sourceSha256', a.source_sha256,
      'state', case when r.revoked_at is not null then 'revoked' else a.state end,
      'basis', case when a.event_mode = 'none' then 'no-calendar-entries' else 'calendar-verified' end,
      'calendarVerified', a.event_mode <> 'none', 'deploymentId', r.deployment_id, 'commitSha', r.commit_sha,
      'artifactSha256', r.artifact_sha256, 'evidenceSha256', a.evidence_sha256,
      'calendarCheckedAt', publication_guard.iso(a.calendar_checked_at),
      'calendarValidUntil', publication_guard.iso(a.calendar_valid_until),
      'previewDeadline', publication_guard.iso(a.preview_deadline), 'admittedAt', publication_guard.iso(a.admitted_at)
    ) end) order by ordinal), '[]'::jsonb) into result
    from jsonb_array_elements(p_keys) with ordinality as keys(k,ordinal)
    left join publication_guard.publication_admissions a on a.path = k->>'path' and a.source_sha256 = k->>'sourceSha256'
    left join publication_guard.release_authorizations r on r.release_id = a.release_id;
  return jsonb_build_object('revision', rev, 'records', result);
end $$;

revoke all on all tables in schema publication_guard from public, anon, authenticated, service_role;
revoke all on all functions in schema publication_guard from public, anon, authenticated, service_role;

create role fx558_reader_owner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_reader nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_controller_owner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_controller nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_recorder_owner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_recorder nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_revoker_owner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
create role fx558_revoker nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;

create schema publication_guard_api;
revoke all on schema publication_guard_api from public, anon, authenticated, service_role;
grant usage on schema publication_guard_api to fx558_reader,fx558_controller,fx558_recorder,fx558_revoker,
 fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant usage on schema publication_guard to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant select on publication_guard.history_state,publication_guard.release_authorizations,publication_guard.publication_admissions
 to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant update (revision) on publication_guard.history_state to fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant update (revoked_at) on publication_guard.release_authorizations to fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant update (state) on publication_guard.publication_admissions to fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant update (response_receipt_sha256) on publication_guard.publication_admissions to fx558_recorder_owner;
grant insert (release_id,repository,project_id,team_id,deployment_id,commit_sha,artifact_sha256,approval_sha256,expires_at)
 on publication_guard.release_authorizations to fx558_controller_owner;
grant insert (path,source_sha256,release_id,event_mode,evidence_sha256,calendar_checked_at,calendar_valid_until,preview_deadline,not_before)
 on publication_guard.publication_admissions to fx558_controller_owner;

create policy fx558_history_read on publication_guard.history_state for select
 to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner using (true);
create policy fx558_release_read on publication_guard.release_authorizations for select
 to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner using (true);
create policy fx558_admission_read on publication_guard.publication_admissions for select
 to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner using (true);
create policy fx558_history_advance on publication_guard.history_state for update
 to fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner using (singleton) with check (singleton and revision>=0);
create policy fx558_release_lock_only on publication_guard.release_authorizations for update
 to fx558_controller_owner,fx558_recorder_owner using (true) with check (false);
create policy fx558_admission_lock_only on publication_guard.publication_admissions for update
 to fx558_controller_owner using (true) with check (false);
create policy fx558_release_prepare on publication_guard.release_authorizations for insert
 to fx558_controller_owner with check (revoked_at is null);
create policy fx558_admission_prepare on publication_guard.publication_admissions for insert
 to fx558_controller_owner with check (state='pending' and admitted_at is null and response_receipt_sha256 is null);
create policy fx558_admission_record on publication_guard.publication_admissions for update
 to fx558_recorder_owner using (state in ('pending','admitted','revoked')) with check (state='admitted');
create policy fx558_release_revoke on publication_guard.release_authorizations for update
 to fx558_revoker_owner using (true) with check (revoked_at is not null);
create policy fx558_admission_revoke on publication_guard.publication_admissions for update
 to fx558_revoker_owner using (true) with check (state='revoked');

grant execute on function publication_guard.read_history(text,jsonb), publication_guard.iso(timestamptz) to fx558_reader_owner;
grant execute on function publication_guard.finalize_admission(uuid,text,text,text) to fx558_recorder_owner;

create function publication_guard_api.acquire_writer_gate() returns void
language plpgsql volatile security invoker set search_path='' set row_security=on as $$
begin
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'HOLD_ISOLATION_UNSUPPORTED'; end if;
 perform 1 from publication_guard.history_state where singleton for update;
 if not found then raise exception 'HOLD_HISTORY_UNAVAILABLE'; end if;
end $$;

create function publication_guard_api.read_snapshot(p_revision text,p_keys jsonb)
returns jsonb language sql stable security definer set search_path='' set row_security=on as $$
 select publication_guard.read_history(p_revision,p_keys)
$$;

create function publication_guard_api.authorize_release(p_release uuid,p_deployment text,p_commit text,p_artifact text,p_approval text,p_expires timestamptz)
returns text language plpgsql volatile security definer set search_path='' set row_security=on set lock_timeout='2s' as $$
declare r publication_guard.release_authorizations;
begin
 if p_release is null or (p_deployment ~ '^dpl_[A-Za-z0-9]{8,80}$') is not true
  or (p_commit ~ '^[a-f0-9]{40}$') is not true or (p_artifact ~ '^[a-f0-9]{64}$') is not true
  or (p_approval ~ '^[a-f0-9]{64}$') is not true or p_expires is null or not pg_catalog.isfinite(p_expires)
 then raise exception 'HOLD_INVALID_REQUEST'; end if;
 perform publication_guard_api.acquire_writer_gate();
 select * into r from publication_guard.release_authorizations where release_id=p_release for update;
 if found then
  if row(r.deployment_id,r.commit_sha,r.artifact_sha256,r.approval_sha256,r.expires_at)
   is distinct from row(p_deployment,p_commit,p_artifact,p_approval,p_expires) then raise exception 'HOLD_AUTHORIZATION_CONFLICT'; end if;
  if r.revoked_at is not null then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
  if pg_catalog.clock_timestamp()>=r.expires_at then raise exception 'HOLD_APPROVAL_EXPIRED'; end if;
  return 'ALREADY_AUTHORIZED';
 end if;
 insert into publication_guard.release_authorizations
  (release_id,repository,project_id,team_id,deployment_id,commit_sha,artifact_sha256,approval_sha256,expires_at)
 values (p_release,'usdimpact/usd-impact-site','prj_ZoLLM35ksI6wk17PcfS2xYknaVl7','team_1LuMlacGuM198mRjoID4O3Ct',p_deployment,p_commit,p_artifact,p_approval,p_expires);
 if not found then raise exception 'HOLD_WRITE_NOT_APPLIED'; end if;
 return 'AUTHORIZED_PENDING_ONLY';
end $$;

create function publication_guard_api.prepare_admission(p_release uuid,p_path text,p_source text,p_mode text,p_evidence text,p_checked timestamptz,p_until timestamptz,p_deadline timestamptz,p_not_before timestamptz)
returns text language plpgsql volatile security definer set search_path='' set row_security=on set lock_timeout='2s' as $$
declare r publication_guard.release_authorizations; a publication_guard.publication_admissions; t timestamptz;
begin
 if p_release is null or pg_catalog.octet_length(p_path)>300
  or (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') is not true
  or (p_source ~ '^[a-f0-9]{64}$') is not true or (p_evidence ~ '^[a-f0-9]{64}$') is not true
  or (p_mode in ('preview','outcome','none')) is not true or p_checked is null or p_until is null
  or not pg_catalog.isfinite(p_checked) or not pg_catalog.isfinite(p_until) then raise exception 'HOLD_INVALID_REQUEST'; end if;
 perform publication_guard_api.acquire_writer_gate();
 select * into r from publication_guard.release_authorizations where release_id=p_release for update;
 if not found or r.revoked_at is not null then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
 select * into a from publication_guard.publication_admissions where path=p_path and source_sha256=p_source for update;
 if found then
  if row(a.release_id,a.event_mode,a.evidence_sha256,a.calendar_checked_at,a.calendar_valid_until,a.preview_deadline,a.not_before)
   is distinct from row(p_release,p_mode,p_evidence,p_checked,p_until,p_deadline,p_not_before) then raise exception 'HOLD_PREPARATION_CONFLICT'; end if;
  if a.state='revoked' then raise exception 'HOLD_REVOKED'; end if;
  t:=pg_catalog.clock_timestamp();
  if t>=r.expires_at then raise exception 'HOLD_APPROVAL_EXPIRED'; end if;
  if t<p_checked or t>=p_until then raise exception 'HOLD_EVIDENCE_EXPIRED'; end if;
  if p_deadline is not null and t>=p_deadline then raise exception 'HOLD_PREVIEW_EXPIRED'; end if;
  if p_not_before is not null and t<p_not_before then raise exception 'HOLD_OUTCOME_NOT_RELEASED'; end if;
  return case when a.state='admitted' then 'ALREADY_ADMITTED' else 'ALREADY_PREPARED' end;
 end if;
 perform 1 from publication_guard.publication_admissions where release_id=p_release and path=p_path for update;
 if found then raise exception 'HOLD_PREPARATION_CONFLICT'; end if;
 insert into publication_guard.publication_admissions
  (path,source_sha256,release_id,event_mode,evidence_sha256,calendar_checked_at,calendar_valid_until,preview_deadline,not_before)
 values (p_path,p_source,p_release,p_mode,p_evidence,p_checked,p_until,p_deadline,p_not_before);
 if not found then raise exception 'HOLD_WRITE_NOT_APPLIED'; end if;
 return 'PREPARED_NOT_ADMITTED';
end $$;

create function publication_guard_api.record_verified_receipt(p_release uuid,p_path text,p_source text,p_receipt text)
returns text language plpgsql volatile security definer set search_path='' set row_security=on set lock_timeout='2s' as $$
begin
 if p_release is null or pg_catalog.octet_length(p_path)>300
  or (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') is not true
  or (p_source ~ '^[a-f0-9]{64}$') is not true or (p_receipt ~ '^[a-f0-9]{64}$') is not true then raise exception 'HOLD_INVALID_REQUEST'; end if;
 perform publication_guard_api.acquire_writer_gate();
 return publication_guard.finalize_admission(p_release,p_path,p_source,p_receipt);
end $$;

create function publication_guard_api.revoke_release(p_release uuid) returns text
language plpgsql volatile security definer set search_path='' set row_security=on set lock_timeout='2s' as $$
declare r publication_guard.release_authorizations;
begin
 if p_release is null then raise exception 'HOLD_INVALID_REQUEST'; end if;
 perform publication_guard_api.acquire_writer_gate();
 select * into r from publication_guard.release_authorizations where release_id=p_release for update;
 if not found then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
 if r.revoked_at is not null then return 'ALREADY_REVOKED'; end if;
 update publication_guard.release_authorizations set revoked_at=pg_catalog.clock_timestamp() where release_id=p_release;
 if not found then raise exception 'HOLD_WRITE_NOT_APPLIED'; end if;
 return 'REVOKED';
end $$;

create function publication_guard_api.revoke_admission(p_release uuid,p_path text,p_source text) returns text
language plpgsql volatile security definer set search_path='' set row_security=on set lock_timeout='2s' as $$
declare r publication_guard.release_authorizations; a publication_guard.publication_admissions;
begin
 if p_release is null or pg_catalog.octet_length(p_path)>300
  or (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') is not true
  or (p_source ~ '^[a-f0-9]{64}$') is not true then raise exception 'HOLD_INVALID_REQUEST'; end if;
 perform publication_guard_api.acquire_writer_gate();
 select * into r from publication_guard.release_authorizations where release_id=p_release for update;
 if not found then raise exception 'HOLD_RELEASE_UNAUTHORIZED'; end if;
 select * into a from publication_guard.publication_admissions where path=p_path and source_sha256=p_source for update;
 if not found or a.release_id<>p_release then raise exception 'HOLD_ADMISSION_NOT_PREPARED'; end if;
 if a.state='revoked' then return 'ALREADY_REVOKED'; end if;
 update publication_guard.publication_admissions set state='revoked' where path=p_path and source_sha256=p_source;
 if not found then raise exception 'HOLD_WRITE_NOT_APPLIED'; end if;
 return 'REVOKED';
end $$;

revoke all on all functions in schema publication_guard_api from public,anon,authenticated,service_role;
grant execute on function publication_guard_api.read_snapshot(text,jsonb) to fx558_reader;
grant execute on function publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz) to fx558_controller;
grant execute on function publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz) to fx558_controller;
grant execute on function publication_guard_api.record_verified_receipt(uuid,text,text,text) to fx558_recorder;
grant execute on function publication_guard_api.revoke_release(uuid) to fx558_revoker;
grant execute on function publication_guard_api.revoke_admission(uuid,text,text) to fx558_revoker;
grant execute on function publication_guard_api.acquire_writer_gate() to fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;

-- Hosted ownership transfer prerequisites, deliberately temporary.
grant create on schema publication_guard_api to fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
grant fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner to postgres;

alter function publication_guard_api.read_snapshot(text,jsonb) owner to fx558_reader_owner;
alter function publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz) owner to fx558_controller_owner;
alter function publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz) owner to fx558_controller_owner;
alter function publication_guard_api.record_verified_receipt(uuid,text,text,text) owner to fx558_recorder_owner;
alter function publication_guard_api.revoke_release(uuid) owner to fx558_revoker_owner;
alter function publication_guard_api.revoke_admission(uuid,text,text) owner to fx558_revoker_owner;

revoke fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner from postgres;
revoke create on schema publication_guard_api from fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;

-- Final fail-closed assertions for hosted managed membership semantics and owner privilege floor.
do $$
declare r record;
begin
  for r in select * from pg_roles where rolname in ('fx558_reader_owner','fx558_controller_owner','fx558_recorder_owner','fx558_revoker_owner','fx558_reader','fx558_controller','fx558_recorder','fx558_revoker') loop
    if r.rolsuper or r.rolbypassrls or r.rolcanlogin or r.rolcreaterole or r.rolcreatedb or r.rolreplication then
      raise exception 'HOLD_PHASE_A_ROLE_PRIVILEGE:%', r.rolname;
    end if;
  end loop;
  if exists (
    select 1 from pg_auth_members m
    join pg_roles rr on rr.oid=m.roleid
    join pg_roles mm on mm.oid=m.member
    where rr.rolname in ('fx558_reader_owner','fx558_controller_owner','fx558_recorder_owner','fx558_revoker_owner')
      and mm.rolname='postgres'
      and (m.inherit_option or m.set_option)
  ) then raise exception 'HOLD_PHASE_A_POSTGRES_EFFECTIVE_MEMBERSHIP'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles o on o.oid=p.proowner
    where n.nspname='publication_guard_api' and p.prosecdef
      and ((p.proname='read_snapshot' and o.rolname<>'fx558_reader_owner')
        or (p.proname in ('authorize_release','prepare_admission') and o.rolname<>'fx558_controller_owner')
        or (p.proname='record_verified_receipt' and o.rolname<>'fx558_recorder_owner')
        or (p.proname in ('revoke_release','revoke_admission') and o.rolname<>'fx558_revoker_owner'))
  ) then raise exception 'HOLD_PHASE_A_DEFINER_OWNER'; end if;
end $$;