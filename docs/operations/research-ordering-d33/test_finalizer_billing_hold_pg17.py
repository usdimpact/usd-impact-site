#!/usr/bin/env python3
"""D33 author-only safe deletion billing hold, full52 SQL, no provider calls."""
import os,sys,uuid
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"docs/operations/research-ordering-stage-c"))
from test_real_schema_ordering import db,seed

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


for name in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
             "SUPABASE_SERVICE_ROLE_KEY","LEMON_SQUEEZY_API_KEY",
             "LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(name),"remote credential forbidden "+name
assert tuple(os.getenv(x) for x in ("PGHOST","PGDATABASE","PGUSER","PGPASSWORD"))==(
  "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")

LP="read-the-dollar-first-guided-interactive-edition"
FN="select * from public.finalize_account_deletion(%s)"
TRANS="select public.apply_research_membership_transition("+",".join(["%s"]*16)+")"
NOW="2026-11-05T14:00:00+00:00"
START="2026-11-01T00:00:00+00:00"
END="2026-12-01T00:00:00+00:00"

def service_call(c,sql,args):
    c.execute("set role service_role")
    try:
        return c.execute(sql,args).fetchone()
    finally:
        c.execute("reset role")

def due(c,a):
    c.execute("""update public.profiles set status='deletion_pending',
      deletion_requested_at=clock_timestamp()-interval '3 days',
      deletion_due_at=clock_timestamp()-interval '1 day',
      auth_user_id=null where account_id=%s""",(a,))

def check_hold(c,a):
    before=c.execute("select status::text,email from public.profiles where account_id=%s",(a,)).fetchone()
    before_events=c.execute("select count(*) from public.entitlement_events where account_id=%s",(a,)).fetchone()[0]
    try:
        service_call(c,FN,(a,))
        raise AssertionError("unexpected irreversible deletion")
    except psycopg.Error as ex:
        assert ex.sqlstate=="55000",(ex.sqlstate,str(ex))
    assert c.execute("select status::text,email from public.profiles where account_id=%s",(a,)).fetchone()==before
    assert c.execute("select count(*) from public.entitlement_events where account_id=%s",(a,)).fetchone()[0]==before_events
    return True

with db() as c:
    assert c.execute("show server_version_num").fetchone()[0]=="170006"
    bootstrap(c)
    c.execute((ROOT/"docs/operations/research-ordering-d33/live_transition_profile_lock_review.sql").read_text("utf-8"))
    c.execute((ROOT/"docs/operations/research-ordering-d33/finalizer_subscription_billing_hold_review.sql").read_text("utf-8"))
    print("D33_BILLING_FINALIZER_REVIEW_APPLIED_52_MIGRATIONS",flush=True)

    # Library Pass-only account should still complete its existing deletion.
    lp=uuid.UUID("bbbb0000-0000-4000-8000-000000007201")
    c.execute("insert into auth.users(id,email) values(%s,'d33-lp-only@invalid.example')",(lp,))
    pid=c.execute("""insert into public.purchases(account_id,product_id,provider,
      provider_transaction_id,status,amount_cents,currency,price_tier,offer_terms,completed_at)
      values(%s,%s,'synthetic','d33-lp-only-7201','completed',3900,'USD','launch','{}',
       clock_timestamp()) returning id""",(lp,LP)).fetchone()[0]
    ent=c.execute("""insert into public.entitlements(account_id,purchase_id,product_id,state,starts_at)
      values(%s,%s,%s,'active',clock_timestamp()-interval '7 days') returning id""",
      (lp,pid,LP)).fetchone()[0]
    due(c,lp)
    res=service_call(c,FN,(lp,))
    assert res and res[0]==lp,res
    assert c.execute("select status::text from public.profiles where account_id=%s",(lp,)).fetchone()[0]=="deleted"
    assert c.execute("select state::text from public.entitlements where id=%s",(ent,)).fetchone()[0]=="account_deleted"
    assert c.execute("select status::text from public.purchases where id=%s",(pid,)).fetchone()[0]=="completed"
    print("D33_LP_ONLY_DELETION_AND_PURCHASE_PARITY_PASS",flush=True)

    # Active Research and dual-product account: no orphaned active subscription.
    active_acc,active_sid,active_eid=seed(c,7202,library=True)
    lp_preserved=c.execute("select row_to_json(e)::text from public.entitlements e where "
      "account_id=%s and product_id=%s",(active_acc,LP)).fetchone()[0]
    due(c,active_acc)
    assert check_hold(c,active_acc)
    assert c.execute("select state::text from public.subscriptions where id=%s",(active_sid,)).fetchone()[0]=="active"
    assert c.execute("select state::text from public.entitlements where id=%s",(active_eid,)).fetchone()[0]=="active"
    assert c.execute("select row_to_json(e)::text from public.entitlements e where "
      "account_id=%s and product_id=%s",(active_acc,LP)).fetchone()[0]==lp_preserved
    print("D33_ACTIVE_RESEARCH_DUAL_PRODUCT_FINALIZATION_HOLD_PASS",flush=True)

    # Research-only pending without any entitlement is not mistaken for no billing.
    pending_acc=uuid.UUID("bbbb0000-0000-4000-8000-000000007203")
    c.execute("insert into auth.users(id,email) values(%s,'d33-pending@invalid.example')",(pending_acc,))
    c.execute("""insert into public.subscriptions(account_id,product_id,provider,
      provider_subscription_id,billing_interval,state,metadata) values
      (%s,'research-membership','lemon-squeezy','pending-7203','monthly','pending','{}')""",(pending_acc,))
    due(c,pending_acc)
    assert check_hold(c,pending_acc)
    print("D33_PENDING_ONLY_SUBSCRIPTION_FINALIZATION_HOLD_PASS",flush=True)

    # Local cancelled state without an authoritative historical provider event
    # must also HOLD, rather than falsely asserting billing stopped.
    terminal_acc,terminal_sid,terminal_eid=seed(c,7204)
    c.execute("update public.subscriptions set state='cancelled' where id=%s",(terminal_sid,))
    due(c,terminal_acc)
    assert check_hold(c,terminal_acc)
    print("D33_FAKE_TERMINAL_STATE_WITHOUT_PROVIDER_EVENT_HOLD_PASS",flush=True)

    # Historical provider-event-backed local cancellation MAY meet the SQL
    # *local* gate. This does not verify real merchant cancellation.
    provider_acc,provider_sid,provider_eid=seed(c,7205,library=True)
    provider_args=(provider_sid,"d33-provider-cancel-7205","d33-provider-event-7205",
      "lemon-squeezy","8205","active","cancelled",START,END,False,
      "revoked",START,END,"synthetic provider cancellation",NOW,Jsonb({}))
    value=service_call(c,TRANS,provider_args)[0]
    assert value["action"]=="applied",value
    due(c,provider_acc)
    result=service_call(c,FN,(provider_acc,))
    assert result and result[0]==provider_acc,result
    assert c.execute("select status::text from public.profiles where account_id=%s",(provider_acc,)).fetchone()[0]=="deleted"
    assert c.execute("select state::text from public.subscriptions where id=%s",(provider_sid,)).fetchone()[0]=="cancelled"
    assert c.execute("select state::text from public.entitlements where id=%s",(provider_eid,)).fetchone()[0]=="account_deleted"
    print("D33_LOCAL_CANCELLATION_EVIDENCE_DELETION_POSSIBLE_NOT_PROVIDER_PROOF_PASS",flush=True)
print("D33_FINALIZATION_AUTHOR_SAFE_HOLD_PG17_PASS_NO_LIVE_AUTH_PROVIDER",flush=True)
