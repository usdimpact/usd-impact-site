#!/usr/bin/env python3
"""Full 52-migration B-5 D2-C author correction PG17 regression; disposable only.

Historical Research schema and commerce RPC are loaded as-is, with Stage E
product guard. Expected negative outcomes are NOT fixes or Production evidence.
"""
import os
import sys
from pathlib import Path
import uuid
import psycopg

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"docs/operations/research-ordering-stage-c"))
from test_real_schema_ordering import db, seed

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
        assert sql.strip().lower().startswith("begin;"),migration.name
        c.execute(sql)
    oracle=ROOT/"docs/operations/research-ordering-stage-c/real_schema_ordering_review.sql"
    c.execute(oracle.read_text("utf-8"))
    print("D2C_ALL_52_HISTORICAL_MIGRATIONS_APPLIED_WITH_SYNTHETIC_PLATFORM_STUBS",flush=True)


for k in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
          "SUPABASE_SERVICE_ROLE_KEY","LEMON_SQUEEZY_API_KEY",
          "LEMON_SQUEEZY_WEBHOOK_SECRET","LEMON_SQUEEZY_STORE_ID"):
    assert not os.getenv(k), "connected secret forbidden: "+k
assert tuple(os.getenv(k) for k in
    ("PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD")) == (
    "127.0.0.1","5432","ci_review","ci_research",
    "synthetic-stage-c-review-only")

LP="read-the-dollar-first-guided-interactive-edition"
PADDLE=ROOT/"supabase/migrations/20260731160000_paddle_checkout_completed.sql"
COMMERCE=ROOT/"supabase/migrations/20260826170000_commerce_reconciliation_runtime.sql"
STAGE_E=ROOT/"docs/operations/research-ordering-stage-e/segmented_caller_review.sql"
GUARD_O=ROOT/"docs/operations/research-ordering-d2c-author/guard_o_no_protected_rowtype_review.sql"
LP_FIX=ROOT/"docs/operations/research-ordering-d2c-author/lp_payment_audit_fence_review.sql"
COMPLETE="select public.complete_commerce_purchase("+",".join(["%s"]*15)+")"
REFUND="select public.apply_commerce_reconciliation("+",".join(["%s"]*8)+")"

def account(c,n):
    aid=uuid.UUID(f"aaaa0000-0000-4000-8000-{n:012d}")
    c.execute("insert into auth.users(id,email) values (%s,%s)",
              (aid,f"d2-30-{n}@invalid.example"))
    assert c.execute("select status::text from public.profiles where account_id=%s",
                     (aid,)).fetchone()==("active",)
    return aid

def intent(c,aid,n):
    return c.execute("""insert into public.purchase_intents(
      idempotency_key,account_id,product_id,status,price_tier,amount_cents,
      currency,offer_terms,expires_at)
      values(%s,%s,%s,'pending','standard',3900,'USD','{}',
             now()+interval '30 minutes') returning id""",
      (f"d2-30-purchase-intent-{n}",aid,LP)).fetchone()[0]

def existing_lp(c,aid,n):
    pid=c.execute("""insert into public.purchases(
      account_id,product_id,provider,provider_transaction_id,status,
      amount_cents,currency,price_tier,offer_terms,completed_at)
      values(%s,%s,'lemon-squeezy',%s,'completed',3900,'USD',
             'standard','{}',now()) returning id""",
      (aid,LP,f"d2-30-existing-{n}")).fetchone()[0]
    return c.execute("""insert into public.entitlements(
      account_id,purchase_id,product_id,state,starts_at)
      values(%s,%s,%s,'active',now()) returning id""",
      (aid,pid,LP)).fetchone()[0]

def complete_args(aid,iid,n):
    return ("lemon-squeezy",f"d2-30-order-event-{n}",
            "2026-11-05T13:00:00Z",f"d2-30-new-order-{n}",
            f"customer-{n}",iid,aid,LP,"314","USD",
            3900,0,3900,"{}",None)

def run_service(c,sql,args):
    c.execute("set role service_role")
    try:
        return c.execute(sql,args).fetchone()[0]
    finally:
        c.execute("reset role")

def seed_event(c,key,eid,aid,state="active"):
    c.execute("""insert into public.entitlement_events(
      event_key,entitlement_id,account_id,product_id,to_state,
      reason,actor_type,metadata)
      values(%s,%s,%s,%s,%s::public.entitlement_state,
             'synthetic wrong-parent','review-fixture','{}')""",
      (key,eid,aid,LP,state))

def entitlement_state(c,aid):
    return c.execute("select state::text from public.entitlements "
                     "where account_id=%s and product_id=%s",
                     (aid,LP)).fetchone()[0]

with db() as c:
    assert c.execute("show server_version_num").fetchone()[0]=="170006"
    bootstrap(c)
    # Foundation + Research alone is insufficient for the later LP commerce RPC:
    # real 20260731 Paddle migration adds purchases provider_price_id and related
    # columns. Replay this historical dependency unchanged before commerce.
    # Both original Paddle and commerce migrations were applied in the
    # 52-migration replay above; do not apply them a second time.
    research,sid,_=seed(c,9001,library=True)
    before_research=c.execute("select row_to_json(s)::text from public.subscriptions s "
                              "where id=%s",(sid,)).fetchone()[0]
    before_library=c.execute("select row_to_json(e)::text from public.entitlements e "
                             "where account_id=%s and product_id=%s",
                             (research,LP)).fetchone()[0]
    wrong=account(c,101)
    wrong_entitlement=existing_lp(c,wrong,101)
    target=account(c,102)
    target_intent=intent(c,target,102)
    good=account(c,103)
    good_intent=intent(c,good,103)
    pending=account(c,104)
    pending_intent=intent(c,pending,104)
    deleted=account(c,105)
    deleted_intent=intent(c,deleted,105)
    c.execute(STAGE_E.read_text())
    c.execute(GUARD_O.read_text())
    c.execute(LP_FIX.read_text())
    x=c.execute("""select pg_get_userbyid(proowner),prosecdef
      from pg_proc where oid=%s::regprocedure""",(
       "public.complete_commerce_purchase(text,text,timestamptz,text,text,"
       "uuid,uuid,text,text,text,integer,integer,integer,jsonb,timestamptz)",)).fetchone()
    assert x[1] is False, x
    assert c.execute("select rolbypassrls from pg_roles where rolname='service_role'").fetchone()[0]
    assert c.execute("select has_table_privilege('service_role',"
                     "'public.entitlement_events','INSERT')").fetchone()[0]
    print("PG17_SCHEMA_ACL_OWNER_PASS",x,flush=True)

    # Wrong-parent payment event MUST fail atomically and preserve the intent.
    wrong_key="commerce:lemon-squeezy:d2-30-new-order-102:payment.completed"
    c.execute("set role service_role")
    try:
        seed_event(c,wrong_key,wrong_entitlement,wrong)
    finally:
        c.execute("reset role")
    try:
        run_service(c,COMPLETE,complete_args(target,target_intent,102))
        raise AssertionError("conflicting payment event was accepted")
    except psycopg.Error as exc:
        assert exc.sqlstate=="42501",exc.sqlstate
    assert c.execute("select count(*) from public.purchases "
                     "where account_id=%s",(target,)).fetchone()[0]==0
    assert c.execute("select count(*) from public.entitlements "
                     "where account_id=%s",(target,)).fetchone()[0]==0
    assert c.execute("select status::text from public.purchase_intents "
                     "where id=%s",(target_intent,)).fetchone()[0]=="pending"
    assert c.execute("select account_id from public.entitlement_events where event_key=%s",
                     (wrong_key,)).fetchone()[0]==wrong
    print("D2C_PG17_PAYMENT_COLLISION_ATOMIC_DENY_PASS",flush=True)

    # Remove *synthetic* poison under local fixture owner and retry normal LP.
    c.execute("delete from public.entitlement_events where event_key=%s",(wrong_key,))
    completed=run_service(c,COMPLETE,complete_args(target,target_intent,102))
    assert completed["duplicate_transaction"] is False and entitlement_state(c,target)=="active"
    assert c.execute("select status::text from public.purchase_intents "
                     "where id=%s",(target_intent,)).fetchone()[0]=="completed"
    print("D2C_PG17_PAYMENT_POST_DENIAL_RECOVERY_PASS",flush=True)

    # Wrong-parent full refund audit MUST roll back entitlement and financial update.
    refund_key="commerce:lemon-squeezy:d2-30-new-order-102:refund.completed"
    c.execute("set role service_role")
    try:
        seed_event(c,refund_key,wrong_entitlement,wrong,"refunded")
    finally:
        c.execute("reset role")
    refund_args=(
      "lemon-squeezy","d2-30-new-order-102","d2-30-refund-event-102",
      "refunded","2026-11-05T13:05:00Z",3900,"{}",None)
    try:
        run_service(c,REFUND,refund_args)
        raise AssertionError("conflicting refund event accepted")
    except psycopg.Error as exc:
        assert exc.sqlstate=="42501",exc.sqlstate
    assert entitlement_state(c,target)=="active"
    assert c.execute("select status::text from public.purchases "
                     "where account_id=%s",(target,)).fetchone()[0]=="completed"
    assert c.execute("select account_id from public.entitlement_events where event_key=%s",
                     (refund_key,)).fetchone()[0]==wrong
    print("D2C_PG17_REFUND_COLLISION_ATOMIC_DENY_PASS",flush=True)

    # Normal authoritative full refund & duplicate still reconcile.
    c.execute("delete from public.entitlement_events where event_key=%s",(refund_key,))
    r=run_service(c,REFUND,refund_args)
    assert r["disposition"]=="refunded" and entitlement_state(c,target)=="refunded"
    r2=run_service(c,REFUND,refund_args)
    assert r2["disposition"]=="refunded"
    assert c.execute("select account_id from public.entitlement_events where event_key=%s",
                     (refund_key,)).fetchone()[0]==target
    print("D2C_PG17_REFUND_RECOVERY_DUPLICATE_PASS",flush=True)

    # Clean one-time purchase and repeated transaction remain functional.
    clean=run_service(c,COMPLETE,complete_args(good,good_intent,103))
    assert clean["duplicate_transaction"] is False
    record=c.execute("select account_id,entitlement_id from public.entitlement_events "
      "where event_key='commerce:lemon-squeezy:d2-30-new-order-103:payment.completed'").fetchone()
    assert record==(good,uuid.UUID(clean["entitlement_id"])),record
    assert run_service(c,COMPLETE,complete_args(good,good_intent,103))[
      "duplicate_transaction"] is True
    print("D2C_PG17_CLEAN_LP_DUPLICATE_PASS",flush=True)

    # Prior active intent + later deletion status: no new paid access record.
    for n,aid,iid,state in (
      (104,pending,pending_intent,"deletion_pending"),
      (105,deleted,deleted_intent,"deleted"),
    ):
        c.execute("update public.profiles set status=%s::public.account_status "
                  "where account_id=%s",(state,aid))
        try:
            run_service(c,COMPLETE,complete_args(aid,iid,n))
            raise AssertionError("late paid event was granted to "+state)
        except psycopg.Error as exc:
            assert exc.sqlstate=="42501",exc.sqlstate
        assert c.execute("select count(*) from public.purchases "
                         "where account_id=%s",(aid,)).fetchone()[0]==0
        assert c.execute("select count(*) from public.entitlements "
                         "where account_id=%s",(aid,)).fetchone()[0]==0
        assert c.execute("select status::text from public.purchase_intents "
                         "where id=%s",(iid,)).fetchone()[0]=="pending"
        print("D2C_PG17_LATE_PAID_"+state.upper()+"_DENY_PASS",flush=True)

    c.execute("set role service_role")
    try:
        try:
            c.execute("insert into public.entitlements(account_id,product_id,state) "
                      "values(%s,'research-membership','active')",(wrong,))
            raise AssertionError("Stage E direct Research write accepted")
        except psycopg.Error as exc:
            assert exc.sqlstate=="42501",exc.sqlstate
    finally:
        c.execute("reset role")
    assert c.execute("select row_to_json(s)::text from public.subscriptions s "
                     "where id=%s",(sid,)).fetchone()[0]==before_research
    assert c.execute("select row_to_json(e)::text from public.entitlements e "
                     "where account_id=%s and product_id=%s",
                     (research,LP)).fetchone()[0]==before_library
    print("D2C_STAGE_O_RESEARCH_DENY_LP_PARITY_PASS",flush=True)
    print("D2C_AUTHOR_PG17_SYNTHETIC_FIX_REVIEW_PASS: not independent acceptance, HOLD/NO-GO",flush=True)
