-- #1103 P1-A/P1-B. UNINSTALLED OWNER RECOVERY PROPOSAL, disposable PG17 ONLY.
-- Replay after a-strict-overlay-review.sql. No D1-D6 owner acceptance.
-- No Auth DELETE, merchant/refund/notification calls, access restoration or privacy completion.
-- All owner RPCs below explicitly revoke execution for API roles.

create table research_lifecycle_private.a_strict_auth_review_log (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$'),
 auth_attempt_at timestamptz not null,
 observation text not null check(observation in ('active','retired','unknown')),
 request_evidence_digest text not null check(request_evidence_digest ~ '^[0-9a-f]{64}$'),
 observed_evidence_digest text not null check(observed_evidence_digest ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null,
 owner_ref text not null check(pg_catalog.length(owner_ref) between 3 and 120),
 recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
 unique(account_id,observed_evidence_digest), check(verified_at>auth_attempt_at)
);
alter table research_lifecycle_private.a_strict_auth_review_log enable row level security;
alter table research_lifecycle_private.a_strict_auth_review_log force row level security;
revoke all on research_lifecycle_private.a_strict_auth_review_log from public,anon,authenticated,service_role;
create trigger a_strict_auth_review_append_only before update or delete
 on research_lifecycle_private.a_strict_auth_review_log for each row
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_auth_review_no_truncate before truncate
 on research_lifecycle_private.a_strict_auth_review_log for each statement
 execute function research_lifecycle_private.reject_append_only_change();

-- Auth GET is owner-ATTESTED, not provider-proven in PostgreSQL.
-- Active GET after an unknown DELETE is NOT permission to reattempt DELETE.
create function public.a_strict_owner_record_auth_review(
 p_account uuid,p_case text,p_observation text,p_request_digest text,
 p_get_digest text,p_verified_at timestamptz,p_owner text
) returns bigint language plpgsql security definer set search_path='' as $auth_review$
declare v_a research_lifecycle_private.a_strict_cases;v_id bigint;
 v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
  or p_observation not in ('active','retired','unknown')
  or p_request_digest !~ '^[0-9a-f]{64}$' or p_get_digest !~ '^[0-9a-f]{64}$'
  or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120
  or p_verified_at is null or p_verified_at>v_now
  or p_verified_at<v_now-interval '15 minutes' then
   raise exception using errcode='55000',message='owner Auth review evidence incomplete';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 if v_a.account_id is null or v_a.case_ref<>p_case
    or v_a.auth_attempt_at is null or p_verified_at<=v_a.auth_attempt_at
    or v_a.completed_at is not null then
   raise exception using errcode='55000',message='Auth review case/attempt mismatch';
 end if;
 insert into research_lifecycle_private.a_strict_auth_review_log(
  account_id,case_ref,auth_attempt_at,observation,request_evidence_digest,
  observed_evidence_digest,verified_at,owner_ref
 ) values(p_account,p_case,v_a.auth_attempt_at,p_observation,p_request_digest,
          p_get_digest,p_verified_at,p_owner) returning id into v_id;
 return v_id;
end;
$auth_review$;
revoke all on function public.a_strict_owner_record_auth_review(
 uuid,text,text,text,text,timestamptz,text)
 from public,anon,authenticated,service_role;

-- Privacy log is evidence, NOT a notice sent or a legal-compliance decision.
-- Actual statutory deadline/extension must be supplied by owner/counsel.
create table research_lifecycle_private.a_strict_privacy_review_log (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$'),
 action text not null check(action in ('review_requested','notice_prepared','restrict_and_respond')),
 owner_ref text not null check(pg_catalog.length(owner_ref) between 3 and 120),
 legal_ref text not null check(legal_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 notice_ref text not null check(notice_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 actual_due_at timestamptz not null,
 recorded_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table research_lifecycle_private.a_strict_privacy_review_log enable row level security;
alter table research_lifecycle_private.a_strict_privacy_review_log force row level security;
revoke all on research_lifecycle_private.a_strict_privacy_review_log from public,anon,authenticated,service_role;
create unique index a_strict_privacy_one_terminal_decision
 on research_lifecycle_private.a_strict_privacy_review_log(account_id,case_ref)
 where action='restrict_and_respond';
create trigger a_strict_privacy_review_append_only before update or delete
 on research_lifecycle_private.a_strict_privacy_review_log for each row
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_privacy_review_no_truncate before truncate
 on research_lifecycle_private.a_strict_privacy_review_log for each statement
 execute function research_lifecycle_private.reject_append_only_change();

create function public.a_strict_owner_log_privacy_action(
 p_account uuid,p_case text,p_action text,p_owner text,p_legal_ref text,
 p_notice_ref text,p_actual_due_at timestamptz
) returns bigint language plpgsql security definer set search_path='' as $privacy_review$
declare v_case research_lifecycle_private.a_strict_cases;v_id bigint;
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
    or p_action not in ('review_requested','notice_prepared','restrict_and_respond')
    or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120
    or p_legal_ref !~ '^p1-[a-z0-9-]{12,80}$'
    or p_notice_ref !~ '^p1-[a-z0-9-]{12,80}$'
    or p_actual_due_at is null then
    raise exception using errcode='55000',message='legal privacy action requires owner/case references';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_case from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 if v_case.account_id is null or v_case.case_ref<>p_case
    or v_case.completed_at is not null then
    raise exception using errcode='55000',message='privacy action case invalid';
 end if;
 insert into research_lifecycle_private.a_strict_privacy_review_log(
  account_id,case_ref,action,owner_ref,legal_ref,notice_ref,actual_due_at
 ) values(p_account,p_case,p_action,p_owner,p_legal_ref,p_notice_ref,p_actual_due_at)
 returning id into v_id;
 return v_id;
end;
$privacy_review$;
revoke all on function public.a_strict_owner_log_privacy_action(
 uuid,text,text,text,text,text,timestamptz)
 from public,anon,authenticated,service_role;

-- Owner may reconcile one known post-Auth incident after full scoped
-- merchant evidence, financial resolution and documented legal remedy.
-- Reconciliation NEVER completes privacy or email, renews case, or alters Auth.
create table research_lifecycle_private.a_strict_financial_reconciliations (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$'),
 incident_last_observed_at timestamptz not null,
 incident_observation_count integer not null check(incident_observation_count>0),
 clearance_id uuid not null references public.research_billing_clearances(id) on delete restrict,
 owner_ref text not null check(pg_catalog.length(owner_ref) between 3 and 120),
 legal_ref text not null check(legal_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 remedy_ref text not null check(remedy_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 resolution_ref text not null check(resolution_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 auth_evidence_digest text not null check(auth_evidence_digest ~ '^[0-9a-f]{64}$'),
 reconciled_at timestamptz not null default pg_catalog.clock_timestamp(),
 unique(account_id,incident_last_observed_at,incident_observation_count),
 unique(account_id,resolution_ref)
);
alter table research_lifecycle_private.a_strict_financial_reconciliations enable row level security;
alter table research_lifecycle_private.a_strict_financial_reconciliations force row level security;
revoke all on research_lifecycle_private.a_strict_financial_reconciliations from public,anon,authenticated,service_role;
create trigger a_strict_financial_reconciliations_append_only before update or delete
 on research_lifecycle_private.a_strict_financial_reconciliations for each row
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_financial_reconciliations_no_truncate before truncate
 on research_lifecycle_private.a_strict_financial_reconciliations for each statement
 execute function research_lifecycle_private.reject_append_only_change();

create function public.a_strict_owner_reconcile_financial(
 p_account uuid,p_case text,p_clearance uuid,p_owner text,
 p_legal_ref text,p_remedy_ref text,p_resolution_ref text,p_auth_digest text
) returns bigint language plpgsql security definer set search_path='' as $reconcile$
declare v_a research_lifecycle_private.a_strict_cases;
 v_q research_lifecycle_private.deletion_auth_cleanup;
 v_i research_lifecycle_private.deletion_billing_incidents;
 v_c public.research_billing_clearances;
 v_now timestamptz:=pg_catalog.clock_timestamp();v_id bigint;
begin
 if p_account is null or p_case !~ '^p1-[0-9a-f]{12,40}$'
    or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120
    or p_legal_ref !~ '^p1-[a-z0-9-]{12,80}$'
    or p_remedy_ref !~ '^p1-[a-z0-9-]{12,80}$'
    or p_resolution_ref !~ '^p1-[a-z0-9-]{12,80}$'
    or p_auth_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='55000',message='owner financial adjudication inputs invalid';
 end if;
 -- Profile-first lock serializes signed webhook, hold and finalizer.
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select a.* into v_a from research_lifecycle_private.a_strict_cases a
  where a.account_id=p_account for update;
 select q.* into v_q from research_lifecycle_private.deletion_auth_cleanup q
  where q.account_id=p_account for update;
 select i.* into v_i from research_lifecycle_private.deletion_billing_incidents i
  where i.account_id=p_account for update;
 select c.* into v_c from public.research_billing_clearances c
  where c.id=p_clearance and c.account_id=p_account;
 if v_a.account_id is null or v_a.case_ref<>p_case or v_a.completed_at is not null
   or v_q.account_id is null or v_q.phase<>'auth_confirmed'
   or v_a.auth_observed_at is null or v_i.account_id is null or v_i.status<>'open'
   or v_q.financial_hold_at is null
   or v_c.id is null or v_c.verified_at<=v_a.auth_observed_at
   or v_c.verified_at<=v_q.financial_hold_at
   or v_c.verified_at<=v_i.last_observed_at
   or v_c.verified_at>v_now or v_c.verified_at<v_now-interval '15 minutes'
   -- Post-incident Auth must be re-observed and owner-attested as retired.
   -- An earlier GET or a bare digest argument cannot authorize financial release.
   or not exists (
     select 1 from research_lifecycle_private.a_strict_auth_review_log ar
      where ar.account_id=p_account and ar.case_ref=p_case
        and ar.observation='retired'
        and ar.observed_evidence_digest=p_auth_digest
        and ar.verified_at>v_i.last_observed_at
        and ar.verified_at>v_q.financial_hold_at
        and ar.verified_at<=v_now
   )
   or not research_lifecycle_private.a_strict_receipt_valid(
       p_account,p_case,p_clearance,'post_auth',v_a.pre_clearance_id)
   or research_lifecycle_private.a_strict_unsettled_rights(p_account) then
    raise exception using errcode='55000',message='post-Auth owner financial reconciliation refused';
 end if;
 if public.resolve_research_deletion_billing_incident(
   p_account,p_clearance,p_resolution_ref) is not true then
    raise exception using errcode='55000',message='base financial incident resolver refused';
 end if;
 insert into research_lifecycle_private.a_strict_financial_reconciliations (
  account_id,case_ref,incident_last_observed_at,incident_observation_count,
  clearance_id,owner_ref,legal_ref,remedy_ref,resolution_ref,auth_evidence_digest
 ) values (
  p_account,p_case,v_i.last_observed_at,v_i.observation_count,
  p_clearance,p_owner,p_legal_ref,p_remedy_ref,p_resolution_ref,p_auth_digest
 ) returning id into v_id;
 update research_lifecycle_private.a_strict_cases
  set reconciled_hold_at=pg_catalog.clock_timestamp(),
      post_clearance_id=null,post_recorded_at=null
  where account_id=p_account;
 -- Preserve financial_hold_at and one-time Auth intent. No Phase change.
 return v_id;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile_financial(
 uuid,text,uuid,text,text,text,text,text)
 from public,anon,authenticated,service_role;

-- There is deliberately NO reattempt Auth DELETE function. An active GET
-- after timeout does not prove an earlier ambiguous DELETE cannot commit.
-- Another DELETE requires external request-finality proof plus a separately
-- accepted single-use owner procedure, and is NOT enabled by this Draft.
