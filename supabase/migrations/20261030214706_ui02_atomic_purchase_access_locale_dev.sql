-- USD Impact UI-02: Development-only migration, approved October 30 2026.
-- Default inactive. Does not send emails, modify purchases, or enable a scheduler.
-- A Production release and activation need separate explicit approval.
create table public.account_transactional_locale_preferences (
  account_id uuid primary key references public.profiles(account_id) on delete restrict,
  preferred_locale text not null check (preferred_locale in ('en', 'es')),
  selection_provenance text not null default 'authenticated_account'
    check (selection_provenance = 'authenticated_account'),
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.account_transactional_locale_preferences enable row level security;
revoke all on public.account_transactional_locale_preferences from public, anon, authenticated;
grant select(account_id,preferred_locale,selection_provenance,revision,updated_at)
  on public.account_transactional_locale_preferences to authenticated;
grant insert(account_id,preferred_locale)
  on public.account_transactional_locale_preferences to authenticated;
grant update(preferred_locale)
  on public.account_transactional_locale_preferences to authenticated;
grant select,insert,update,delete
  on public.account_transactional_locale_preferences to service_role;
create function public.ui02_version_transactional_locale()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  -- Serialize authenticated language changes against purchase email freeze.
  -- Does not require or grant UPDATE on public.profiles.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ui02_account_locale:'||new.account_id::text,0)
  );
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    if new.account_id is distinct from old.account_id then
      raise exception 'UI02_ACCOUNT_ID_IMMUTABLE';
    end if;
    if old.revision >= 2147483647 then
      raise exception 'UI02_LOCALE_REVISION_EXHAUSTED';
    end if;
    new.revision := old.revision + 1;
  end if;
  new.selection_provenance := 'authenticated_account';
  new.updated_at := now();
  return new;
end
$fn$;
revoke all on function public.ui02_version_transactional_locale() from public, anon, authenticated;
grant execute on function public.ui02_version_transactional_locale() to service_role;
create trigger ui02_version_transactional_locale
before insert or update on public.account_transactional_locale_preferences
for each row execute function public.ui02_version_transactional_locale();

create policy ui02_account_locale_read_own
on public.account_transactional_locale_preferences for select to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui02_account_locale_insert_own
on public.account_transactional_locale_preferences for insert to authenticated
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));
create policy ui02_account_locale_update_own
on public.account_transactional_locale_preferences for update to authenticated
using (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'))
with check (account_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (select 1 from public.profiles p
    where p.account_id = (select auth.uid()) and p.status = 'active'));

-- Immutable locale template snapshot; NEVER put locale into existing
-- purchase_access_ready notification_outbox.payload, which must remain '{}'.
create table public.purchase_access_ready_locale_snapshots (
  outbox_id uuid primary key references public.notification_outbox(id) on delete restrict,
  purchase_id uuid not null unique references public.purchases(id) on delete restrict,
  account_id uuid not null references public.profiles(account_id) on delete restrict,
  render_locale text not null check (render_locale in ('en', 'es')),
  locale_source text not null check (locale_source in ('verified_account','english_fallback')),
  preference_revision integer,
  recipient_sha256 text not null check (recipient_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_identity text not null unique check (snapshot_identity ~ '^[0-9a-f]{64}$'),
  template_version text not null check (char_length(template_version) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint ui02_locale_source_version_consistent check (
    (locale_source='verified_account' and preference_revision>=1)
    or (locale_source='english_fallback' and render_locale='en' and preference_revision is null))
);
alter table public.purchase_access_ready_locale_snapshots enable row level security;
revoke all on public.purchase_access_ready_locale_snapshots from public, anon, authenticated;
grant select,insert on public.purchase_access_ready_locale_snapshots to service_role;

create function public.ui02_enforce_immutable_access_locale()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  if tg_op <> 'INSERT' then raise exception 'UI02_LOCALE_SNAPSHOT_IMMUTABLE'; end if;
  if not exists (
    select 1 from public.notification_outbox o
    join public.purchases pu on pu.id=new.purchase_id
    join public.profiles pr on pr.account_id=new.account_id
    where o.id=new.outbox_id
      and o.message_id='purchase_access_ready'
      and o.template_id='purchase_access_ready'
      and o.classification='transactional'
      and o.business_object_type='purchase'
      and o.business_object_id=new.purchase_id::text
      and o.template_version=new.template_version
      and o.provider='resend' and o.status='queued'
      and o.recipient_email_normalized=lower(btrim(pr.email))
      and new.recipient_sha256=encode(extensions.digest(o.recipient_email_normalized,'sha256'),'hex')
      and pu.product_id='read-the-dollar-first-guided-interactive-edition'
      and pu.account_id=new.account_id
      and pu.provider='lemon-squeezy'
      and pu.status='completed'
      and pu.refunded_at is null and pu.disputed_at is null
      and pr.status='active'
      and exists (select 1 from public.entitlements e
        where e.purchase_id=new.purchase_id
          and e.account_id=new.account_id
          and e.product_id=pu.product_id and e.state='active'
          and e.version=o.state_version)
  ) then raise exception 'UI02_LOCALE_SNAPSHOT_AUTHORITY_MISMATCH'; end if;
  if new.locale_source='verified_account' then
    if not exists (select 1 from public.account_transactional_locale_preferences ap
      where ap.account_id=new.account_id
        and ap.preferred_locale=new.render_locale
        and ap.revision=new.preference_revision)
    then raise exception 'UI02_LOCALE_PREFERENCE_REVISION_MISMATCH'; end if;
  elsif exists (select 1 from public.account_transactional_locale_preferences ap
      where ap.account_id=new.account_id)
  then raise exception 'UI02_ENGLISH_FALLBACK_WITH_EXISTING_PREFERENCE'; end if;
  return new;
end
$fn$;
revoke all on function public.ui02_enforce_immutable_access_locale() from public, anon, authenticated;
grant execute on function public.ui02_enforce_immutable_access_locale() to service_role;
create trigger ui02_access_locale_authoritative_insert
before insert on public.purchase_access_ready_locale_snapshots
for each row execute function public.ui02_enforce_immutable_access_locale();
create trigger ui02_access_locale_immutable_mutation
before update or delete on public.purchase_access_ready_locale_snapshots
for each row execute function public.ui02_enforce_immutable_access_locale();

-- BLOCKED until separate approval:
-- 1. Atomic pairing of outbox+locale snapshot in a single trusted transaction.
-- 2. Dispatch must reject any outbox record missing its snapshot.
-- 3. Snapshot/template version must be bound to existing deterministic key.
-- 4. Concurrency proof under customer preference updates; RLS actor tests.
-- 5. No production migration, no historic send, no merchant replay.

create table public.ui02_access_ready_activation (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  cutover_at timestamptz,
  changed_at timestamptz not null default now(),
  constraint ui02_activation_requires_cutover check (not enabled or cutover_at is not null)
);
alter table public.ui02_access_ready_activation enable row level security;
revoke all on public.ui02_access_ready_activation from public, anon, authenticated;
grant select on public.ui02_access_ready_activation to service_role;
insert into public.ui02_access_ready_activation(singleton,enabled,cutover_at)
values(true,false,null);
-- Intentionally no UPDATE/INSERT/DELETE grant to service_role: activation
-- requires separate explicit owner/DB-authority approval, NEVER runtime.

-- This RPC is SECURITY INVOKER, NOT SECURITY DEFINER. Only service_role
-- can EXECUTE it. The service-role credential must stay server-side.
-- The entire function is one Postgres transaction. A failure before the
-- locale snapshot insert rolls the outbox insertion back, not half-commit.
create function public.ui02_enqueue_access_ready_atomic(p_purchase_id uuid)
returns jsonb
language plpgsql security invoker set search_path=pg_catalog
as $function$
declare
  v_gate public.ui02_access_ready_activation%rowtype;
  v_purchase public.purchases%rowtype;
  v_profile public.profiles%rowtype;
  v_intent public.purchase_intents%rowtype;
  v_ent public.entitlements%rowtype;
  v_pref public.account_transactional_locale_preferences%rowtype;
  v_outbox public.notification_outbox%rowtype;
  v_snapshot public.purchase_access_ready_locale_snapshots%rowtype;
  v_email text;
  v_source text;
  v_locale text;
  v_revision integer;
  v_template text := '2026-09-04.v2';
  v_notify_key text;
  v_event_hash text;
  v_event_id text;
  v_recipient_hash text;
  v_snapshot_hash text;
  v_json text;
  v_existing_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'UI02_SERVICE_ROLE_ONLY';
  end if;
  select * into v_gate from public.ui02_access_ready_activation where singleton = true;
  if not found or v_gate.enabled is distinct from true or v_gate.cutover_at is null
  then raise exception 'UI02_ATOMIC_WRITER_HOLD'; end if;

  if p_purchase_id is null then raise exception 'UI02_PURCHASE_REQUIRED'; end if;
  -- FOR UPDATE serializes repeated purchase events and conflicts with any
  -- merchant refund/dispute update using this purchase row.
  select * into v_purchase from public.purchases
  where id = p_purchase_id for update;
  if not found or v_purchase.status <> 'completed' or v_purchase.refunded_at is not null
    or v_purchase.disputed_at is not null
    or v_purchase.product_id <> 'read-the-dollar-first-guided-interactive-edition'
    or v_purchase.provider <> 'lemon-squeezy'
    or v_purchase.purchase_intent_id is null
    or nullif(btrim(v_purchase.provider_event_id),'') is null
    or v_purchase.completed_at < v_gate.cutover_at
    or v_purchase.completed_at > now() + interval '5 minutes'
  then raise exception 'UI02_PURCHASE_AUTHORITY_HOLD'; end if;

  -- A shared profile lock protects the current email/status without needing
  -- UPDATE permission on public.profiles (which is intentionally absent).
  -- Shared account advisory lock is also held by preference INSERT/UPDATE
  -- trigger; this prevents a language change during locale freeze.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ui02_account_locale:'||v_purchase.account_id::text,0)
  );
  -- Read-only profile lookup. PostgreSQL requires UPDATE privilege for
  -- SELECT ... FOR SHARE in this environment, and service_role intentionally
  -- cannot UPDATE public.profiles. The advisory lock serializes locale edits;
  -- a separate DB dispatch gate rechecks the account email and status.
  select * into v_profile from public.profiles
  where account_id=v_purchase.account_id;
  if not found or v_profile.status <> 'active'
    or v_profile.auth_user_id is distinct from v_profile.account_id
  then raise exception 'UI02_PROFILE_IDENTITY_HOLD'; end if;

  select * into v_intent from public.purchase_intents
  where id=v_purchase.purchase_intent_id for share;
  if not found or v_intent.status <> 'completed'
    or v_intent.account_id <> v_purchase.account_id
    or v_intent.product_id <> v_purchase.product_id
  then raise exception 'UI02_PURCHASE_INTENT_HOLD'; end if;

  select * into v_ent from public.entitlements
  where purchase_id=p_purchase_id for share;
  if not found or v_ent.state <> 'active'
    or v_ent.account_id <> v_purchase.account_id
    or v_ent.product_id <> v_purchase.product_id
    or v_ent.version < 1
  then raise exception 'UI02_ENTITLEMENT_HOLD'; end if;

  select * into v_pref from public.account_transactional_locale_preferences
  where account_id=v_profile.account_id for share;
  if found then
    if v_pref.selection_provenance <> 'authenticated_account'
       or v_pref.preferred_locale not in ('en','es') or v_pref.revision < 1
    then raise exception 'UI02_LOCALE_PROVENANCE_HOLD'; end if;
    v_locale := v_pref.preferred_locale;
    v_source := 'verified_account';
    v_revision := v_pref.revision;
  else
    v_locale := 'en';
    v_source := 'english_fallback';
    v_revision := null;
  end if;
  -- The Spanish email still has a render-ONLY version; until its immutable
  -- outbox/renderer dispatch path is approved do not create a sendable row.
  if v_locale <> 'en' then raise exception 'UI02_SPANISH_RUNTIME_HOLD'; end if;

  v_email := lower(btrim(v_profile.email));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or char_length(v_email) > 320
  then raise exception 'UI02_RECIPIENT_INVALID'; end if;

  -- Match the existing JS canonicalize(JSON.stringify) key exactly:
  -- keys in lexical order. All data values JSON escaped with to_json().
  v_json := '{"businessObjectId":'||to_json(p_purchase_id::text)::text||
    ',"businessObjectType":"purchase","messageId":"purchase_access_ready"'||
    ',"recipientEmail":'||to_json(v_email)::text||
    ',"stateVersion":'||v_ent.version::text||',"version":1}';
  v_notify_key := 'notification:v1:'||
    encode(extensions.digest(convert_to(v_json,'UTF8'),'sha256'),'hex');
  v_json := '{"messageId":"purchase_access_ready","businessObjectType":"purchase"'||
    ',"businessObjectId":'||to_json(p_purchase_id::text)::text||
    ',"stateVersion":'||v_ent.version::text||
    ',"recipientEmail":'||to_json(v_email)::text||'}';
  v_event_hash := encode(extensions.digest(convert_to(v_json,'UTF8'),'sha256'),'hex');
  v_event_id := 'purchase_access_ready:'||left(v_event_hash,40)||':v'||v_ent.version::text;
  v_recipient_hash := encode(extensions.digest(convert_to(v_email,'UTF8'),'sha256'),'hex');
  v_json := '{"accountId":'||to_json(v_profile.account_id::text)::text||
    ',"purchaseId":'||to_json(p_purchase_id::text)::text||
    ',"outboxKey":'||to_json(v_notify_key)::text||
    ',"recipientSha256":'||to_json(v_recipient_hash)::text||
    ',"locale":'||to_json(v_locale)::text||
    ',"source":'||to_json(v_source)::text||
    ',"preferenceRevision":'||coalesce(v_revision::text,'null')||
    ',"templateVersion":'||to_json(v_template)::text||'}';
  v_snapshot_hash := encode(extensions.digest(convert_to(v_json,'UTF8'),'sha256'),'hex');

  -- Never generate an additional access-ready email for a purchase already
  -- having one, even if the recipient, entitlement version or policy changed.
  select count(*)::integer into v_existing_count
  from public.notification_outbox
  where message_id='purchase_access_ready'
    and business_object_id=p_purchase_id::text;
  if v_existing_count > 1 then raise exception 'UI02_DUPLICATE_PURCHASE_EMAIL_ROWS'; end if;
  if v_existing_count = 0 then
    insert into public.notification_outbox(
      idempotency_key,event_id,message_id,classification,business_object_type,
      business_object_id,state_version,recipient_email_normalized,
      template_id,template_version,provider,consent_required,
      consent_record_id,consent_purpose,consent_checked_at,payload,
      next_attempt_at
    ) values (
      v_notify_key,v_event_id,'purchase_access_ready','transactional','purchase',
      p_purchase_id::text,v_ent.version,v_email,
      'purchase_access_ready',v_template,'resend',false,
      null,null,null,'{}'::jsonb,
      v_purchase.completed_at
    ) on conflict(idempotency_key) do nothing;
  end if;
  select * into v_outbox from public.notification_outbox
    where idempotency_key=v_notify_key for update;
  if not found or v_outbox.message_id <> 'purchase_access_ready'
    or v_outbox.event_id <> v_event_id or v_outbox.classification <> 'transactional'
    or v_outbox.business_object_type <> 'purchase'
    or v_outbox.business_object_id <> p_purchase_id::text
    or v_outbox.state_version <> v_ent.version or v_outbox.recipient_email_normalized <> v_email
    or v_outbox.template_id <> 'purchase_access_ready' or v_outbox.template_version <> v_template
    or v_outbox.provider <> 'resend' or v_outbox.consent_required is distinct from false
    or v_outbox.consent_record_id is not null or v_outbox.consent_purpose is not null
    or v_outbox.consent_checked_at is not null or v_outbox.payload <> '{}'::jsonb
  then raise exception 'UI02_EXISTING_OUTBOX_IDENTITY_HOLD'; end if;
  if v_existing_count = 1 and not exists (
    select 1 from public.purchase_access_ready_locale_snapshots
    where outbox_id=v_outbox.id
  ) then raise exception 'UI02_ORPHANED_OUTBOX_HOLD'; end if;
  if v_existing_count = 0 then
    insert into public.purchase_access_ready_locale_snapshots(
      outbox_id,purchase_id,account_id,render_locale,locale_source,
      preference_revision,recipient_sha256,snapshot_identity,template_version
    ) values (
      v_outbox.id,p_purchase_id,v_profile.account_id,v_locale,v_source,
      v_revision,v_recipient_hash,v_snapshot_hash,v_template
    );
  end if;
  select * into v_snapshot from public.purchase_access_ready_locale_snapshots
    where outbox_id=v_outbox.id;
  if not found
    or v_snapshot.purchase_id <> p_purchase_id
    or v_snapshot.account_id <> v_profile.account_id
    or v_snapshot.render_locale <> v_locale
    or v_snapshot.locale_source <> v_source
    or v_snapshot.preference_revision is distinct from v_revision
    or v_snapshot.recipient_sha256 <> v_recipient_hash
    or v_snapshot.snapshot_identity <> v_snapshot_hash
    or v_snapshot.template_version <> v_template
  then raise exception 'UI02_IMMUTABLE_SNAPSHOT_HOLD'; end if;

  -- Outbox returned privately to the server only; not to a browser.
  return jsonb_build_object('state','atomic_pair_verified',
    'outbox',to_jsonb(v_outbox),'snapshot',to_jsonb(v_snapshot));
end;
$function$;
revoke all on function public.ui02_enqueue_access_ready_atomic(uuid)
  from public, anon, authenticated;
grant execute on function public.ui02_enqueue_access_ready_atomic(uuid)
  to service_role;

-- At the exact pre-send boundary, the privileged server must ask the DB
-- to revalidate the unchanged pair. This does NOT authorize dispatch by
-- itself. English-only hold until Spanish rendering is fully approved.
create function public.ui02_check_access_ready_dispatch(
  p_outbox_id uuid, p_idempotency_key text
) returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $function$
declare
  v_gate public.ui02_access_ready_activation%rowtype;
  v_outbox public.notification_outbox%rowtype;
  v_snapshot public.purchase_access_ready_locale_snapshots%rowtype;
  v_purchase public.purchases%rowtype;
  v_profile public.profiles%rowtype;
  v_ent public.entitlements%rowtype;
  v_pi public.purchase_intents%rowtype;
  v_expected_hash text;
  v_snapshot_hash text;
  v_hash_json text;
begin
  if current_user <> 'service_role' then
    raise exception 'UI02_SERVICE_ROLE_ONLY';
  end if;
  select * into v_gate from public.ui02_access_ready_activation where singleton;
  if not found or v_gate.enabled is distinct from true or v_gate.cutover_at is null
  then raise exception 'UI02_DISPATCH_NOT_APPROVED'; end if;
  select * into v_outbox from public.notification_outbox
    where id=p_outbox_id for share;
  if not found or v_outbox.idempotency_key is distinct from p_idempotency_key
    or v_outbox.message_id <> 'purchase_access_ready'
    or v_outbox.business_object_type <> 'purchase'
    or v_outbox.classification <> 'transactional'
    or v_outbox.provider <> 'resend'
    or v_outbox.template_id <> 'purchase_access_ready'
    or v_outbox.template_version <> '2026-09-04.v2'
    or v_outbox.status not in ('queued','retry_scheduled','soft_bounced','sending')
  then raise exception 'UI02_DISPATCH_OUTBOX_HOLD'; end if;
  select * into v_snapshot from public.purchase_access_ready_locale_snapshots
  where outbox_id=p_outbox_id;
  if not found or v_snapshot.template_version <> v_outbox.template_version
    or v_snapshot.render_locale <> 'en'
    or v_snapshot.locale_source not in ('english_fallback','verified_account')
    or v_snapshot.purchase_id::text <> v_outbox.business_object_id
  then raise exception 'UI02_DISPATCH_SNAPSHOT_HOLD'; end if;
  if v_snapshot.locale_source='english_fallback' and v_snapshot.preference_revision is not null
  then raise exception 'UI02_DISPATCH_SOURCE_HOLD'; end if;
  if v_snapshot.locale_source='verified_account' and v_snapshot.preference_revision < 1
  then raise exception 'UI02_DISPATCH_SOURCE_HOLD'; end if;

  select * into v_purchase from public.purchases where id=v_snapshot.purchase_id for share;
  -- Service role has SELECT but intentionally no UPDATE on profiles.
  -- Read-only revalidation immediately before any future provider handoff.
  select * into v_profile from public.profiles where account_id=v_snapshot.account_id;
  select * into v_ent from public.entitlements where purchase_id=v_snapshot.purchase_id for share;
  if not found or v_ent.version <> v_outbox.state_version
    or v_ent.account_id <> v_snapshot.account_id
    or v_ent.state <> 'active'
    or v_ent.product_id <> 'read-the-dollar-first-guided-interactive-edition'
    or v_purchase.id is null or v_purchase.status <> 'completed'
    or v_purchase.provider <> 'lemon-squeezy'
    or v_purchase.refunded_at is not null or v_purchase.disputed_at is not null
    or v_purchase.account_id <> v_snapshot.account_id
    or v_purchase.product_id <> v_ent.product_id
    or v_purchase.completed_at < v_gate.cutover_at
    or v_profile.account_id is null or v_profile.status <> 'active'
    or v_profile.auth_user_id is distinct from v_profile.account_id
    or lower(btrim(v_profile.email)) <> v_outbox.recipient_email_normalized
  then raise exception 'UI02_DISPATCH_AUTHORITY_HOLD'; end if;
  select * into v_pi from public.purchase_intents where id=v_purchase.purchase_intent_id;
  if not found or v_pi.status <> 'completed'
    or v_pi.account_id <> v_purchase.account_id
    or v_pi.product_id <> v_purchase.product_id
  then raise exception 'UI02_DISPATCH_INTENT_HOLD'; end if;

  v_expected_hash:=encode(extensions.digest(
    convert_to(v_outbox.recipient_email_normalized,'UTF8'),'sha256'),'hex');
  if v_snapshot.recipient_sha256 <> v_expected_hash
  then raise exception 'UI02_DISPATCH_RECIPIENT_HASH_HOLD'; end if;
  v_hash_json := '{"accountId":'||to_json(v_snapshot.account_id::text)::text||
    ',"purchaseId":'||to_json(v_snapshot.purchase_id::text)::text||
    ',"outboxKey":'||to_json(v_outbox.idempotency_key)::text||
    ',"recipientSha256":'||to_json(v_expected_hash)::text||
    ',"locale":'||to_json(v_snapshot.render_locale)::text||
    ',"source":'||to_json(v_snapshot.locale_source)::text||
    ',"preferenceRevision":'||coalesce(v_snapshot.preference_revision::text,'null')||
    ',"templateVersion":'||to_json(v_snapshot.template_version)::text||'}';
  v_snapshot_hash:=encode(extensions.digest(convert_to(v_hash_json,'UTF8'),'sha256'),'hex');
  if v_snapshot.snapshot_identity <> v_snapshot_hash
  then raise exception 'UI02_DISPATCH_SNAPSHOT_HASH_HOLD'; end if;
  return jsonb_build_object('verified',true,'locale','en',
    'outboxId',p_outbox_id::text,
    'idempotencyKey',v_outbox.idempotency_key,
    'templateVersion',v_outbox.template_version);
end;
$function$;
revoke all on function public.ui02_check_access_ready_dispatch(uuid,text)
  from public, anon, authenticated;
grant execute on function public.ui02_check_access_ready_dispatch(uuid,text)
  to service_role;

-- IMPORTANT: No sender/trigger/scheduler is installed. Service_role has
-- no UPDATE grant on the activation table. The user must separately
-- authorize a future cutover, Production ledger and email gates.
