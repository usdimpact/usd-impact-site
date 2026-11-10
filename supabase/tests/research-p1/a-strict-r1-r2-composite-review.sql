-- #1103 R1/R2 COMPOSITE — UNINSTALLED DISPOSABLE REVIEW ONLY.
-- Requires source migration + #1236 A-strict overlay + #1232 recovery overlay.
-- Owner approved R1/R2 composite *Draft design only*; R3 pre-intent resume HOLD.
-- No hosted SQL, migration, Auth DELETE, billing calls, email sends or customer IO.
-- This is one coherent post-Auth owner reconciliation and one outbox trigger.
-- Legacy owner-only resolver is NOT independent authorization.

create table research_lifecycle_private.a_strict_owner_generation_decisions (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 case_ref text not null check(case_ref ~ '^p1-[0-9a-f]{12,40}$'),
 incident_last_observed_at timestamptz not null,
 incident_observation_count integer not null check(incident_observation_count>0),
 disposition text not null check(disposition in ('resume','terminal_hold')),
 clearance_id uuid references public.research_billing_clearances(id) on delete restrict,
 decision_ref text not null unique check(decision_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 d2_privacy_ref text not null check(d2_privacy_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 d4_remedy_ref text not null check(d4_remedy_ref ~ '^p1-[a-z0-9-]{12,80}$'),
 owner_ref text not null check(pg_catalog.length(owner_ref) between 3 and 120),
 auth_evidence_digest text check(auth_evidence_digest ~ '^[0-9a-f]{64}$'),
 decided_at timestamptz not null default pg_catalog.clock_timestamp(),
 unique(account_id,case_ref,incident_last_observed_at,incident_observation_count),
 check ((disposition='resume' and clearance_id is not null and auth_evidence_digest is not null)
    or (disposition='terminal_hold' and clearance_id is null and auth_evidence_digest is null))
);
alter table research_lifecycle_private.a_strict_owner_generation_decisions enable row level security;
alter table research_lifecycle_private.a_strict_owner_generation_decisions force row level security;
revoke all on research_lifecycle_private.a_strict_owner_generation_decisions
 from public,anon,authenticated,service_role;
create trigger a_strict_owner_generation_decisions_append_only before update or delete
 on research_lifecycle_private.a_strict_owner_generation_decisions for each row
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_owner_generation_decisions_no_truncate before truncate
 on research_lifecycle_private.a_strict_owner_generation_decisions for each statement
 execute function research_lifecycle_private.reject_append_only_change();

-- An append-only evidence log is written for every source incident INSERT or
-- observation_count increment. This is not a reconstructive production backfill:
-- the review-only seed below captures only the current aggregate generation.
create table research_lifecycle_private.a_strict_incident_observation_journal (
 account_id uuid not null references public.profiles(account_id) on delete restrict,
 observation_count integer not null check(observation_count>0),
 last_observed_at timestamptz not null,
 reason_codes text[] not null,
 recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
 primary key(account_id,observation_count)
);
alter table research_lifecycle_private.a_strict_incident_observation_journal enable row level security;
alter table research_lifecycle_private.a_strict_incident_observation_journal force row level security;
revoke all on research_lifecycle_private.a_strict_incident_observation_journal
 from public,anon,authenticated,service_role;
insert into research_lifecycle_private.a_strict_incident_observation_journal(
 account_id,observation_count,last_observed_at,reason_codes
) select account_id,observation_count,last_observed_at,reason_codes
 from research_lifecycle_private.deletion_billing_incidents;
create trigger a_strict_incident_observation_journal_append_only before update or delete
 on research_lifecycle_private.a_strict_incident_observation_journal for each row
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_incident_observation_journal_no_truncate before truncate
 on research_lifecycle_private.a_strict_incident_observation_journal for each statement
 execute function research_lifecycle_private.reject_append_only_change();

create function research_lifecycle_private.a_strict_write_incident_observation()
returns trigger language plpgsql security definer set search_path='' as $journal$
begin
 if tg_op='INSERT' or new.observation_count>old.observation_count then
   insert into research_lifecycle_private.a_strict_incident_observation_journal(
     account_id,observation_count,last_observed_at,reason_codes
   ) values(new.account_id,new.observation_count,new.last_observed_at,new.reason_codes);
 end if;
 return null;
end;
$journal$;
revoke all on function research_lifecycle_private.a_strict_write_incident_observation()
 from public,anon,authenticated,service_role;

-- The global guard protects accounts without a supervised case too. Unlike
-- #1230 B1, it is NOT conditional on IF FOUND for a case; no case => DENY.
-- It also rejects owner DELETE/TRUNCATE, rewinding, altered case identity,
-- reused decisions for identical timestamps but different observation counts.
create function research_lifecycle_private.a_strict_global_incident_guard()
returns trigger language plpgsql security definer set search_path='' as $guard$
declare v_case text;
begin
 if tg_op='DELETE' then
   raise exception using errcode='42501',message='financial incident custody cannot be deleted';
 end if;
 if new.account_id is distinct from old.account_id
    or new.first_observed_at is distinct from old.first_observed_at
    or new.observation_count<old.observation_count
    or new.last_observed_at<old.last_observed_at
    or not (old.reason_codes <@ new.reason_codes) then
   raise exception using errcode='42501',message='financial incident generation cannot rewind';
 end if;
 if new.observation_count>old.observation_count then
   if new.observation_count<>old.observation_count+1
      or new.status<>'open'
      or new.resolved_at is not null
      or new.resolution_reference is not null
      or new.resolution_clearance_id is not null then
      raise exception using errcode='42501',message='new financial generation requires open unadjudicated custody';
   end if;
 elsif new.last_observed_at is distinct from old.last_observed_at
    or new.reason_codes is distinct from old.reason_codes then
   raise exception using errcode='42501',message='financial incident observation must advance its generation';
 end if;
 if new.status='resolved' and old.status is distinct from new.status then
   select a.case_ref into v_case from research_lifecycle_private.a_strict_cases a
     where a.account_id=new.account_id;
   if v_case is null or
      new.observation_count is distinct from old.observation_count
      or new.last_observed_at is distinct from old.last_observed_at
      or not exists (
        select 1 from research_lifecycle_private.a_strict_incident_observation_journal j
         where j.account_id=new.account_id
           and j.observation_count=old.observation_count
           and j.last_observed_at=old.last_observed_at
      )
      or not exists (
        select 1 from research_lifecycle_private.a_strict_owner_generation_decisions d
        join research_lifecycle_private.a_strict_financial_reconciliations f
          on f.account_id=d.account_id and f.case_ref=d.case_ref
         and f.incident_last_observed_at=d.incident_last_observed_at
         and f.incident_observation_count=d.incident_observation_count
         and f.clearance_id=d.clearance_id and f.resolution_ref=d.decision_ref
        where d.account_id=new.account_id and d.case_ref=v_case
          and d.incident_last_observed_at=old.last_observed_at
          and d.incident_observation_count=old.observation_count
          and d.disposition='resume'
          and d.decision_ref=new.resolution_reference
          and d.clearance_id=new.resolution_clearance_id
      ) then
      raise exception using errcode='42501',message='global generation-bound owner financial decision absent';
   end if;
 elsif new.status='resolved' and (
       new.resolution_reference is distinct from old.resolution_reference
       or new.resolution_clearance_id is distinct from old.resolution_clearance_id
       or new.resolved_at is distinct from old.resolved_at
    ) then
   raise exception using errcode='42501',message='resolved financial custody is immutable';
 end if;
 return new;
end;
$guard$;
revoke all on function research_lifecycle_private.a_strict_global_incident_guard()
 from public,anon,authenticated,service_role;
create trigger a_strict_global_incident_guard
 before update or delete on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_global_incident_guard();
create trigger a_strict_global_incident_no_truncate before truncate
 on research_lifecycle_private.deletion_billing_incidents for each statement
 execute function research_lifecycle_private.reject_append_only_change();
create trigger a_strict_incident_observation_journal
 after insert or update on research_lifecycle_private.deletion_billing_incidents
 for each row execute function research_lifecycle_private.a_strict_write_incident_observation();

-- Explicitly no pre-intent owner resume entrypoint. Terminal HOLD records
-- D2/D4 review but never releases finance, Auth, privacy or outbox.
create function public.a_strict_owner_terminal_financial_hold(
 p_account uuid,p_case text,p_decision_ref text,
 p_d2_ref text,p_d4_ref text,p_owner text
) returns bigint language plpgsql security definer set search_path='' as $terminal$
declare v_a research_lifecycle_private.a_strict_cases;
        v_i research_lifecycle_private.deletion_billing_incidents;
        v_id bigint;
begin
 if p_case !~ '^p1-[0-9a-f]{12,40}$'
   or p_decision_ref !~ '^p1-[a-z0-9-]{12,80}$'
   or p_d2_ref !~ '^p1-[a-z0-9-]{12,80}$'
   or p_d4_ref !~ '^p1-[a-z0-9-]{12,80}$'
   or pg_catalog.length(coalesce(p_owner,'')) not between 3 and 120 then
   raise exception using errcode='55000',message='terminal owner decision references invalid';
 end if;
 perform 1 from public.profiles p where p.account_id=p_account for update;
 select * into v_a from research_lifecycle_private.a_strict_cases
  where account_id=p_account for update;
 select * into v_i from research_lifecycle_private.deletion_billing_incidents
  where account_id=p_account for update;
 if v_a.account_id is null or v_a.case_ref<>p_case
    or v_a.completed_at is not null or v_i.account_id is null
    or v_i.status<>'open' then
   raise exception using errcode='55000',message='cannot attest terminal hold without open case';
 end if;
 insert into research_lifecycle_private.a_strict_owner_generation_decisions(
   account_id,case_ref,incident_last_observed_at,incident_observation_count,
   disposition,clearance_id,decision_ref,d2_privacy_ref,d4_remedy_ref,
   owner_ref,auth_evidence_digest
 ) values(p_account,p_case,v_i.last_observed_at,v_i.observation_count,
   'terminal_hold',null,p_decision_ref,p_d2_ref,p_d4_ref,p_owner,null)
 returning id into v_id;
 return v_id;
end;
$terminal$;
revoke all on function public.a_strict_owner_terminal_financial_hold(
 uuid,text,text,text,text,text) from public,anon,authenticated,service_role;

-- Override the existing #1232 owner reconciliation with a single *transactional*
-- source-resolver path that writes the full-generation decision and finance
-- evidence before calling the old owner resolver. No second resolver exists.
create or replace function public.a_strict_owner_reconcile_financial(
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
 -- A-single-generation owner decision and complete financial proof must be
 -- durable in THIS transaction BEFORE the legacy source resolver runs.
 -- A rejecting legacy resolver rolls both append-only records back.
 insert into research_lifecycle_private.a_strict_owner_generation_decisions (
   account_id,case_ref,incident_last_observed_at,incident_observation_count,
   disposition,clearance_id,decision_ref,d2_privacy_ref,d4_remedy_ref,
   owner_ref,auth_evidence_digest
 ) values (
   p_account,p_case,v_i.last_observed_at,v_i.observation_count,
   'resume',p_clearance,p_resolution_ref,p_legal_ref,p_remedy_ref,
   p_owner,p_auth_digest
 );
 insert into research_lifecycle_private.a_strict_financial_reconciliations (
  account_id,case_ref,incident_last_observed_at,incident_observation_count,
  clearance_id,owner_ref,legal_ref,remedy_ref,resolution_ref,auth_evidence_digest
 ) values (
  p_account,p_case,v_i.last_observed_at,v_i.observation_count,
  p_clearance,p_owner,p_legal_ref,p_remedy_ref,p_resolution_ref,p_auth_digest
 ) returning id into v_id;
 if public.resolve_research_deletion_billing_incident(
   p_account,p_clearance,p_resolution_ref) is not true then
    raise exception using errcode='55000',message='base financial incident resolver refused';
 end if;
 update research_lifecycle_private.a_strict_cases
  set reconciled_hold_at=pg_catalog.clock_timestamp(),
      post_clearance_id=null,post_recorded_at=null
  where account_id=p_account;
 -- Preserve financial_hold_at and one-time Auth intent. No Phase change.
 return v_id;
end;
$reconcile$;
revoke all on function public.a_strict_owner_reconcile_financial(
 uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;

-- R2: replace the #1231 trigger's FUNCTION body in place (no stacked second
-- completion identity trigger). Base Part 10 staged→queued barrier stays.
create or replace function research_lifecycle_private.a_strict_completion_email_identity_guard()
returns trigger language plpgsql security definer set search_path='' as $immutable$
begin
 if tg_op<>'UPDATE' then return new; end if;
 if old.message_id is distinct from 'account_deletion_completed'
    and new.message_id is distinct from 'account_deletion_completed' then
   return new;
 end if;
 if new.id is distinct from old.id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.event_id is distinct from old.event_id
    or new.message_id is distinct from old.message_id
    or new.classification is distinct from old.classification
    or new.business_object_type is distinct from old.business_object_type
    or new.business_object_id is distinct from old.business_object_id
    or new.state_version is distinct from old.state_version
    or new.recipient_email_normalized is distinct from old.recipient_email_normalized
    or new.template_id is distinct from old.template_id
    or new.template_version is distinct from old.template_version
    or new.provider is distinct from old.provider
    or new.payload is distinct from old.payload
    or new.consent_required is distinct from old.consent_required
    or new.consent_record_id is distinct from old.consent_record_id
    or new.consent_purpose is distinct from old.consent_purpose
    or new.consent_checked_at is distinct from old.consent_checked_at
    or new.created_at is distinct from old.created_at then
   raise exception using errcode='42501',
     message='completion email identity, original recipient and custody immutable';
 end if;
 -- The actual Resend planner allows email.complained after delivered.
 -- It explicitly refuses email.bounced/email.suppressed after delivered;
 -- do not expand the provider transition contract merely via SQL grants.
 if old.status in ('delivered','terminal_failed','hard_bounced',
                   'complained','suppressed','cancelled')
    and new.status is distinct from old.status then
   if not (old.status='delivered' and new.status='complained') then
     raise exception using errcode='42501',
       message='terminal account deletion completion cannot be rearmed';
   end if;
 end if;
 return new;
end;
$immutable$;
revoke all on function research_lifecycle_private.a_strict_completion_email_identity_guard()
 from public,anon,authenticated,service_role;

-- Column-UPDATE contract verified against PostgREST ignore-duplicates and
-- actual PATCH payloads before promotion; this synthetic overlay is not live.
revoke update on table public.notification_outbox from service_role;
grant update (
 status,attempt_count,next_attempt_at,provider_message_ref,error_code,
 accepted_at,delivered_at,failed_at,updated_at
) on table public.notification_outbox to service_role;
