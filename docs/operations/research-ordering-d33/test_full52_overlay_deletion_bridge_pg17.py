#!/usr/bin/env python3
"""D33 author-only: full 52 historical migrations + genuine Stage E/O guard
with restricted Research deletion bridge; synthetic PostgreSQL 17.6 ONLY."""
import os,sys,uuid
from pathlib import Path
import psycopg
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"docs/operations/research-ordering-stage-c"))
from test_real_schema_ordering import db

def bootstrap(c):
    # Full historical 52-migration replay on isolated PG17 only. Synthetic
    # platform shells are NOT a sanitized Supabase Production schema snapshot.
    c.execute("""create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create role postgres nologin noinherit nobypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable set search_path='' as $d2cu$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $d2cu$;
      create function auth.jwt() returns jsonb language sql stable set search_path='' as $d2cu$
        select '{}'::jsonb
      $d2cu$;
      create function auth.role() returns text language sql stable set search_path='' as $d2cu$
        select 'authenticated'::text
      $d2cu$;
      create schema storage;
      create table storage.buckets(
        id text primary key,name text not null unique,public boolean default false,
        file_size_limit bigint,allowed_mime_types text[],updated_at timestamptz
        default now());
    """)
    all_sql=sorted((ROOT/"supabase/migrations").glob("*.sql"))
    assert len(all_sql)==52, ("Historical migration count changed",len(all_sql))
    for migration in all_sql:
        sql=migration.read_text("utf-8")
        try:
            c.execute(sql)
        except psycopg.Error as exc:
            print("D2C_FULL52_MIGRATION_FAILURE",migration.name,exc.sqlstate,flush=True)
            raise
    oracle=ROOT/"docs/operations/research-ordering-stage-c/real_schema_ordering_review.sql"
    c.execute(oracle.read_text("utf-8"))
    print("D2C_ALL_52_HISTORICAL_MIGRATIONS_APPLIED_WITH_SYNTHETIC_PLATFORM_STUBS",flush=True)


for k in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
          "SUPABASE_SERVICE_ROLE_KEY","LEMON_SQUEEZY_API_KEY",
          "LEMON_SQUEEZY_WEBHOOK_SECRET","LEMON_SQUEEZY_STORE_ID"):
    assert not os.getenv(k),"connected secret forbidden: "+k
assert tuple(os.getenv(x) for x in ("PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD"))==(
  "127.0.0.1","5432","ci_review","ci_research","synthetic-stage-c-review-only")
LP="read-the-dollar-first-guided-interactive-edition"

def user(c,n):
    a=uuid.UUID(f"cccc0000-0000-4000-8000-{n:012d}")
    c.execute("insert into auth.users(id,email) values(%s,%s)",(a,f"d33-integrated-{n}@invalid.example"))
    return a

def due(c,a):
    c.execute("""update public.profiles set
      status='deletion_pending',auth_user_id=null,
      deletion_requested_at=clock_timestamp()-interval '3 days',
      deletion_due_at=clock_timestamp()-interval '1 day'
      where account_id=%s""",(a,))

def lp(c,a,n):
    p=c.execute("""insert into public.purchases(account_id,product_id,provider,
      provider_transaction_id,status,amount_cents,currency,price_tier,offer_terms,completed_at)
      values(%s,%s,'synthetic',%s,'completed',3900,'USD','launch','{}',now()) returning id""",
      (a,LP,f"d33-integrated-lp-{n}")).fetchone()[0]
    e=c.execute("""insert into public.entitlements(account_id,purchase_id,product_id,state,starts_at)
      values(%s,%s,%s,'active',now()-interval '7 days') returning id""",(a,p,LP)).fetchone()[0]
    return p,e

def research(c,a,n):
    # Synthetic pre-overlay subscription imported into guarded schema.
    # Only the fixture superuser disables the two guards briefly. Once
    # reenabled, actual deletion uses only legitimate role-granted paths.
    c.execute("alter table public.subscriptions disable trigger research_e_guard_subscriptions")
    c.execute("alter table public.entitlements disable trigger research_e_guard_entitlements")
    try:
        sid=c.execute("""insert into public.subscriptions(
          account_id,product_id,provider,provider_subscription_id,
          provider_price_id,billing_interval,state,metadata)
          values(%s,'research-membership','lemon-squeezy',%s,
            '313','monthly','active','{}') returning id""",
            (a,f"d33-integrated-sub-{n}")).fetchone()[0]
        eid=c.execute("""insert into public.entitlements(
          account_id,subscription_id,product_id,state,starts_at,ends_at)
          values(%s,%s,'research-membership','active',
            now()-interval '7 days',now()+interval '30 days') returning id""",
            (a,sid)).fetchone()[0]
    finally:
        c.execute("alter table public.subscriptions enable trigger research_e_guard_subscriptions")
        c.execute("alter table public.entitlements enable trigger research_e_guard_entitlements")
    return sid,eid

def finalize(c,a):
    c.execute("set role service_role")
    try:
        return c.execute("select * from public.finalize_account_deletion(%s)",(a,)).fetchone()
    finally:
        c.execute("reset role")

def hold(c,a):
    try:
        finalize(c,a)
        raise AssertionError("account finalization unexpectedly bypassed billing hold")
    except psycopg.Error as e:
        assert e.sqlstate=="55000",(e.sqlstate,str(e))

def cancellation(c,a,sid,n):
    c.execute("set role research_e_owner")
    try:
        c.execute("""update public.subscriptions set state='cancelled'
          where id=%s""",(sid,))
        c.execute("""insert into public.subscription_events(
          event_key,subscription_id,account_id,product_id,from_state,to_state,
          reason,actor_type,provider_event_id,metadata,occurred_at)
          values(%s,%s,%s,'research-membership','active','cancelled',
          'synthetic verified-looking cancellation','provider_webhook',%s,'{}',now())""",
          (f"d33-cancel-{n}",sid,a,f"synthetic-provider-{n}"))
    finally:
        c.execute("reset role")

with db() as root:
    assert root.execute("show server_version_num").fetchone()[0]=="170006"
    bootstrap(root)
    b5=ROOT/"docs/operations/research-ordering-stage-n/b5_m1_strict_pinned_review_only.sql"
    root.execute(b5.read_text("utf-8"))
    root.execute((ROOT/"docs/operations/research-ordering-stage-e/segmented_caller_review.sql").read_text("utf-8"))
    root.execute((ROOT/"docs/operations/research-ordering-d2c-author/guard_o_no_protected_rowtype_review.sql").read_text("utf-8"))
    root.execute((ROOT/"docs/operations/research-ordering-d33/finalizer_research_lifecycle_owner_bridge_review.sql").read_text("utf-8"))
    # Event and subscription tables must retain effective E guard triggers.
    assert root.execute("""select count(*) from pg_trigger where
      tgname in ('research_e_guard_entitlements','research_e_guard_entitlement_events',
                 'research_e_guard_subscriptions','research_e_guard_subscription_events')
      and tgenabled='O'""").fetchone()[0]==4
    print("D33_FULL52_STAGE_E_O_RESEARCH_DELETION_BRIDGE_INSTALLED",flush=True)

    a=user(root,7501)
    pid,eid=lp(root,a,7501)
    due(root,a)
    out=finalize(root,a)
    assert out and out[0]==a
    assert root.execute("select status::text from public.profiles where account_id=%s",(a,)).fetchone()[0]=="deleted"
    assert root.execute("select state::text from public.entitlements where id=%s",(eid,)).fetchone()[0]=="account_deleted"
    assert root.execute("select status::text from public.purchases where id=%s",(pid,)).fetchone()[0]=="completed"
    print("D33_FULL52_STAGE_E_O_LP_ONLY_FINALIZATION_PARITY_PASS",flush=True)

    a=user(root,7502)
    sid,eid=research(root,a,7502)
    pid,lpid=lp(root,a,7502)
    due(root,a)
    hold(root,a)
    assert root.execute("select state::text from public.subscriptions where id=%s",(sid,)).fetchone()[0]=="active"
    assert root.execute("select state::text from public.entitlements where id=%s",(eid,)).fetchone()[0]=="active"
    assert root.execute("select state::text from public.entitlements where id=%s",(lpid,)).fetchone()[0]=="active"
    print("D33_FULL52_STAGE_E_O_ACTIVE_RESEARCH_DUAL_PRODUCT_HOLD_PASS",flush=True)

    # Terminal local cancellation event permits the *local* deletion path.
    # Provider-side billing verification and owner authorization remain HOLD.
    cancellation(root,a,sid,7502)
    out=finalize(root,a)
    assert out and out[0]==a
    assert root.execute("select status::text from public.profiles where account_id=%s",(a,)).fetchone()[0]=="deleted"
    assert root.execute("select state::text from public.entitlements where id=%s",(eid,)).fetchone()[0]=="account_deleted"
    assert root.execute("select state::text from public.entitlements where id=%s",(lpid,)).fetchone()[0]=="account_deleted"
    assert root.execute("select state::text from public.subscriptions where id=%s",(sid,)).fetchone()[0]=="cancelled"
    assert root.execute("select status::text from public.purchases where id=%s",(pid,)).fetchone()[0]=="completed"
    research_event=root.execute("""select actor_type,to_state::text from public.entitlement_events
       where event_key=%s""",(f"account-deletion:{a}:research-membership",)).fetchone()
    assert research_event==("system","account_deleted"),research_event
    print("D33_FULL52_STAGE_E_O_CANCELLED_DUAL_PRODUCT_FINALIZER_PASS",flush=True)

    # A direct shared-service Research grant remains denied under Stage E/O.
    other=user(root,7503)
    root.execute("set role service_role")
    try:
        try:
            root.execute("""insert into public.entitlements(account_id,product_id,state,starts_at)
              values(%s,'research-membership','active',now())""",(other,))
            raise AssertionError("shared service_role bypassed Stage E guard")
        except psycopg.Error as exc:
            assert exc.sqlstate=="42501",exc.sqlstate
    finally:
        root.execute("reset role")
    print("D33_FULL52_STAGE_E_O_DIRECT_RESEARCH_MUTATION_DENY_PASS",flush=True)
    print("D33_AUTHOR_FULL52_E_O_DELETION_BRIDGE_PASS; provider cancellation NOT proven",flush=True)
