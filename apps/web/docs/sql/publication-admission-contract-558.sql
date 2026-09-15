-- Review/test prototype only. NOT a Supabase migration or automatic deployment input.
-- Apply only to an isolated test database. No application role receives access.
-- Trusted release/calendar evidence and response receipts must be authenticated upstream.
begin;
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
  -- Capture the wall clock AFTER the potentially blocking lock, not transaction start.
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
    return 'ALREADY_RECORDED'; -- No timestamp refresh and no new admission.
  end if;
  update publication_guard.publication_admissions set state = 'admitted', response_receipt_sha256 = p_receipt
    where path = p_path and source_sha256 = p_source;
  return 'RECORDED';
end $$;

create function publication_guard.iso(t timestamptz) returns text
language sql stable security invoker set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- STABLE uses the caller statement's snapshot for revision, records and revocations.
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

-- No public REST function, SECURITY DEFINER, policy, login, key or runtime grant.
revoke all on all tables in schema publication_guard from public, anon, authenticated, service_role;
revoke all on all functions in schema publication_guard from public, anon, authenticated, service_role;
commit;
