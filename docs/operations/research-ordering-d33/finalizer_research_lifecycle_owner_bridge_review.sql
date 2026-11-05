-- D33-5 author review only, on FULL historical 52 migrations + Stage E/O/P/Q.
-- Explicitly NOT a deployable migration and NOT proof of provider cancellation.
begin;
create schema research_ordering_d33;
revoke all on schema research_ordering_d33 from public,anon,authenticated,service_role;
grant usage on schema research_ordering_d33 to research_e_owner;
grant select on public.subscription_events to research_e_owner;
drop policy if exists d33_research_owner_subscription_event_read on public.subscription_events;
create policy d33_research_owner_subscription_event_read on public.subscription_events
for select to research_e_owner using(product_id='research-membership');

create or replace function research_ordering_d33.finish_research_entitlement(
  p_account_id uuid,p_entitlement_id uuid,p_done timestamptz)
returns void language plpgsql security definer set search_path='' as $d33$
declare v_profile public.profiles%rowtype;
        v_ent public.entitlements%rowtype;
        v_event public.entitlement_events%rowtype;
        v_event_key text;
        v_inserted int;
begin
  select * into v_profile from public.profiles
   where account_id=p_account_id;
  if not found or v_profile.status<>'deletion_pending'
     or v_profile.auth_user_id is not null
     or v_profile.deletion_due_at is null
     or v_profile.deletion_due_at>p_done then
    raise exception 'd33: Research deletion state unverified'
      using errcode='42501';
  end if;
  select * into v_ent from public.entitlements
   where id=p_entitlement_id and account_id=p_account_id
     and product_id='research-membership' for update;
  if not found or v_ent.subscription_id is null then
    raise exception 'd33: Research entitlement source mismatch'
      using errcode='42501';
  end if;
  if not exists (
    select 1 from public.subscriptions s
    where s.id=v_ent.subscription_id
      and s.account_id=p_account_id
      and s.product_id='research-membership'
      and s.state='cancelled'
      and exists (
        select 1 from public.subscription_events ev
        where ev.subscription_id=s.id
          and ev.account_id=p_account_id
          and ev.product_id='research-membership'
          and ev.to_state='cancelled'
          and ev.actor_type='provider_webhook'
          and nullif(ev.provider_event_id,'') is not null
      )
  ) then
    raise exception 'd33: Research provider cancellation not locally corroborated'
      using errcode='55000';
  end if;
  if v_ent.state='account_deleted' then return; end if;
  v_event_key:=pg_catalog.format('account-deletion:%s:%s',
     p_account_id,'research-membership');
  insert into public.entitlement_events(
    event_key,entitlement_id,account_id,product_id,
    from_state,to_state,reason,actor_type,actor_id,metadata,occurred_at)
  values(v_event_key,v_ent.id,p_account_id,'research-membership',v_ent.state,
    'account_deleted','account deletion finalized','system',
    'account-deletion-finalizer','{}'::jsonb,p_done)
  on conflict(event_key) do nothing;
  get diagnostics v_inserted=ROW_COUNT;
  if v_inserted=0 then
    select * into v_event from public.entitlement_events
     where event_key=v_event_key;
    if not found
       or v_event.entitlement_id is distinct from v_ent.id
       or v_event.account_id is distinct from p_account_id
       or v_event.product_id<>'research-membership'
       or v_event.to_state<>'account_deleted'
       or v_event.actor_type<>'system'
       or v_event.actor_id<>'account-deletion-finalizer' then
      raise exception 'd33: Research account deletion ledger collision'
        using errcode='42501';
    end if;
  end if;
  update public.entitlements
    set state='account_deleted',
        ends_at=case when ends_at is null then
          greatest(p_done,starts_at+interval '1 microsecond') else ends_at end,
        version=version+1,updated_at=p_done
    where id=v_ent.id and state<>'account_deleted';
end;
$d33$;
alter function research_ordering_d33.finish_research_entitlement(uuid,uuid,timestamptz)
  owner to research_e_owner;
revoke all on function research_ordering_d33.finish_research_entitlement(uuid,uuid,timestamptz)
  from public,anon,authenticated,service_role;

create or replace function public.finalize_account_deletion(finalize_account_id uuid)
returns table (
  account_id uuid,
  recipient_email text,
  deletion_requested_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles;
  entitlement_row public.entitlements;
  finalized_at timestamptz := pg_catalog.clock_timestamp();
  deleted_email text;
begin
  if finalize_account_id is null then
    raise exception using
      errcode = '22023',
      message = 'account id is required';
  end if;

  select p.*
  into profile_row
  from public.profiles p
  where p.account_id = finalize_account_id
  for update;

  if profile_row.account_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'account profile was not found';
  end if;

  if profile_row.status = 'deleted' then
    return;
  end if;

  if profile_row.status <> 'deletion_pending'
     or profile_row.deletion_requested_at is null
     or profile_row.deletion_due_at is null
     or profile_row.deletion_due_at > finalized_at then
    raise exception using
      errcode = '22023',
      message = 'account is not eligible for deletion finalization';
  end if;

  if profile_row.auth_user_id is not null then
    raise exception using
      errcode = '55000',
      message = 'auth user link must be detached before deletion finalization';
  end if;

  -- D33 fail-closed policy-neutral readiness fence: the old finalizer ran
  -- even with an active/pending recurring subscription. Never claim provider
  -- cancellation from local SQL. Nonterminal or unsupported terminal states
  -- block deletion before content, entitlement or profile writes.
  if exists (
    select 1 from public.subscriptions s
    where s.account_id=profile_row.account_id
      and s.product_id='research-membership'
      and (
        s.state <> 'cancelled'
        or not exists (
          select 1 from public.subscription_events ev
          where ev.subscription_id=s.id
            and ev.account_id=s.account_id
            and ev.product_id='research-membership'
            and ev.to_state='cancelled'
            and ev.actor_type='provider_webhook'
            and nullif(ev.provider_event_id,'') is not null
        )
      )
  ) then
    raise exception using errcode='55000',
      message='d33: recurring billing requires cancellation evidence and owner reconciliation before deletion';
  end if;
  if exists (
    select 1 from public.entitlements e
    where e.account_id=profile_row.account_id
      and e.product_id='research-membership'
      and e.subscription_id is null
      and e.state <> 'account_deleted'
  ) then
    raise exception using errcode='55000',
      message='d33: Research entitlement has no trusted subscription source';
  end if;

  deleted_email := format(
    'deleted+%s@accounts.invalid',
    substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
  );

  delete from public.learning_progress
  where learning_progress.account_id = profile_row.account_id;

  delete from public.bookmarks
  where bookmarks.account_id = profile_row.account_id;

  for entitlement_row in
    select e.*
    from public.entitlements e
    where e.account_id = profile_row.account_id
      and e.state <> 'account_deleted'
    for update
  loop
    if entitlement_row.product_id='research-membership' then
      -- Restrict Research writes to the dedicated NOLOGIN lifecycle owner
      -- rather than allowing the main SECURITY DEFINER to bypass Stage E.
      perform research_ordering_d33.finish_research_entitlement(
        profile_row.account_id,entitlement_row.id,finalized_at);
    else
    insert into public.entitlement_events (
      event_key,
      entitlement_id,
      account_id,
      product_id,
      from_state,
      to_state,
      reason,
      actor_type,
      actor_id,
      metadata,
      occurred_at
    ) values (
      format('account-deletion:%s:%s', profile_row.account_id, entitlement_row.product_id),
      entitlement_row.id,
      profile_row.account_id,
      entitlement_row.product_id,
      entitlement_row.state,
      'account_deleted',
      'account deletion finalized',
      'system',
      'account-deletion-finalizer',
      '{}'::jsonb,
      finalized_at
    )
    on conflict (event_key) do nothing;

    update public.entitlements
    set state = 'account_deleted',
        ends_at = case
          when ends_at is null then greatest(finalized_at, starts_at + interval '1 microsecond')
          else ends_at
        end,
        version = version + 1,
        updated_at = finalized_at
    where id = entitlement_row.id
      and state <> 'account_deleted';
    end if;
  end loop;

  update public.support_requests
  set account_id = null,
      email = format(
        'deleted+%s@support.invalid',
        substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
      ),
      updated_at = finalized_at
  where support_requests.account_id = profile_row.account_id;

  update public.privacy_requests
  set account_id = null,
      email = format(
        'deleted+%s@privacy.invalid',
        substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
      ),
      status = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then 'completed'::public.request_status
        else status
      end,
      completed_at = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then finalized_at
        else completed_at
      end,
      decision_reason = case
        when request_type = 'deletion' and status in ('open', 'in_progress') then 'account deletion finalized'
        else decision_reason
      end,
      updated_at = finalized_at
  where privacy_requests.account_id = profile_row.account_id;

  update public.profiles
  set email = deleted_email,
      display_name = null,
      status = 'deleted',
      deleted_at = finalized_at,
      updated_at = finalized_at
  where profiles.account_id = profile_row.account_id;

  insert into public.admin_audit_entries (
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state,
    evidence_reference,
    occurred_at
  ) values (
    'account_deletion_finalized',
    'account',
    profile_row.account_id::text,
    'scheduled staged account deletion reached its due time',
    jsonb_build_object(
      'status', profile_row.status,
      'deletion_requested_at', profile_row.deletion_requested_at,
      'deletion_due_at', profile_row.deletion_due_at
    ),
    jsonb_build_object(
      'status', 'deleted',
      'deleted_at', finalized_at
    ),
    'account-deletion-finalizer:v2',
    finalized_at
  );

  account_id := profile_row.account_id;
  recipient_email := profile_row.email;
  deletion_requested_at := profile_row.deletion_requested_at;
  deleted_at := finalized_at;
  return next;
end;
$$;

-- Only the SECURITY DEFINER finalizer's existing owner can call the helper.
-- No generic service_role EXECUTE and no broad Research-owner bypass.
do $d33grant$
declare v_owner name;
begin
  select pg_catalog.pg_get_userbyid(p.proowner) into v_owner
  from pg_catalog.pg_proc p
  where p.oid='public.finalize_account_deletion(uuid)'::pg_catalog.regprocedure;
  if v_owner is null then raise exception 'd33: finalizer owner not found'; end if;
  execute pg_catalog.format('grant usage on schema research_ordering_d33 to %I',v_owner);
  execute pg_catalog.format(
    'grant execute on function research_ordering_d33.finish_research_entitlement(uuid,uuid,timestamptz) to %I',v_owner);
end;
$d33grant$;
commit;
