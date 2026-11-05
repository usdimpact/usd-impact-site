#!/usr/bin/env python3
"""D33 author-only actual PostgreSQL 17.6 legacy RPC profile/deletion negative tests.
No connected Supabase, real payment, remote cancellation or customer data.
"""
import os
import sys
import uuid
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import psycopg
from psycopg.types.json import Jsonb

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
    assert not os.getenv(k),"connected credential forbidden: "+k
assert tuple(os.getenv(k) for k in
 ("PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD"))==(
 "127.0.0.1","5432","ci_review","ci_research","synthetic-stage-c-review-only")

FN="select public.apply_research_membership_transition("+",".join(["%s"]*16)+")"
START="2026-11-01T00:00:00+00:00"
END="2026-12-01T00:00:00+00:00"
NEXT="2027-01-01T00:00:00+00:00"

def args(sid,key,old="active",new="active",ent="active",end=NEXT):
    return (sid,key,key+"-provider-event","lemon-squeezy",
            str(1000+int(str(sid)[-12:])),old,new,START,end,False,
            ent,START,end,"synthetic D33 review", "2026-11-05T14:00:00+00:00",Jsonb({}))

def call(c,params):
    c.execute("set role service_role")
    try:
        return c.execute(FN,params).fetchone()[0]
    finally:
        c.execute("reset role")

def denied(c,params,expected="42501"):
    try:
        res=call(c,params)
        raise AssertionError(f"unexpected Research mutation: {res}")
    except psycopg.Error as exc:
        assert exc.sqlstate==expected,(exc.sqlstate,str(exc))
        return exc.sqlstate

def snapshot(c,sid,aid):
    return (
      c.execute("select state::text,version from public.subscriptions where id=%s",(sid,)).fetchone(),
      c.execute("select state::text,version from public.entitlements "
                "where account_id=%s and product_id='research-membership'",(aid,)).fetchone(),
      c.execute("select count(*) from public.subscription_events where subscription_id=%s",(sid,)).fetchone()[0],
      c.execute("select count(*) from public.entitlement_events "
                "where account_id=%s and product_id='research-membership'",(aid,)).fetchone()[0],
    )

def delete_profile(c,aid,*,deleted=True):
    if deleted:
        c.execute("""update public.profiles set
          status='deleted',auth_user_id=null,deleted_at=clock_timestamp(),
          deletion_requested_at=clock_timestamp()-interval '2 days',
          deletion_due_at=clock_timestamp()-interval '1 day'
          where account_id=%s""",(aid,))
    else:
        c.execute("""update public.profiles set
          status='deletion_pending',
          deletion_requested_at=clock_timestamp()-interval '2 days',
          deletion_due_at=clock_timestamp()-interval '1 day'
          where account_id=%s""",(aid,))

with db() as c:
    assert c.execute("show server_version_num").fetchone()[0]=="170006"
    bootstrap(c)
    patch=ROOT/"docs/operations/research-ordering-d33/live_transition_profile_lock_review.sql"
    c.execute(patch.read_text("utf-8"))
    assert c.execute("select has_table_privilege('service_role','public.profiles','UPDATE')").fetchone()[0] is False
    assert c.execute("select has_function_privilege('service_role','review_d33_lock.lock_account_profile(uuid)','EXECUTE')").fetchone()[0] is True
    print("D33_FULL52_LEGACY_RPC_FENCE_INSTALLED_SYNTHETIC",flush=True)

    # Existing Research member and Library Pass identity must remain unchanged.
    aid,sid,eid=seed(c,6101,library=True)
    lp_before=c.execute("select row_to_json(e)::text from public.entitlements e "
       "where e.account_id=%s and e.product_id='read-the-dollar-first-guided-interactive-edition'",(aid,)).fetchone()[0]
    ok=call(c,args(sid,"d33-valid-positive-01","active","past_due","suspended",END))
    assert ok["action"]=="applied" and snapshot(c,sid,aid)[0][0]=="past_due",ok
    ok2=call(c,args(sid,"d33-valid-positive-02","past_due","active","active"))
    assert ok2["action"]=="applied" and snapshot(c,sid,aid)[1][0]=="active",ok2
    assert call(c,args(sid,"d33-valid-positive-02","past_due","active","active"))["action"]=="duplicate"
    assert c.execute("select row_to_json(e)::text from public.entitlements e "
       "where e.account_id=%s and e.product_id='read-the-dollar-first-guided-interactive-edition'",(aid,)).fetchone()[0]==lp_before
    print("D33_VALID_ACTIVE_LIFECYCLE_DUPLICATE_AND_LP_PARITY_PASS",flush=True)

    # Deleted account retains active Research subscription and terminal entitlement.
    deleted_acc,deleted_sid,deleted_eid=seed(c,6102,library=True)
    c.execute("update public.entitlements set state='account_deleted' where id=%s",(deleted_eid,))
    delete_profile(c,deleted_acc)
    before=snapshot(c,deleted_sid,deleted_acc)
    denied(c,args(deleted_sid,"d33-after-deleted-active-renewal"))
    assert snapshot(c,deleted_sid,deleted_acc)==before
    print("D33_POST_DELETION_RENEWAL_NO_REGRANT_PASS",flush=True)
    # Financial negative fact can settle subscription without erasing deletion.
    refund=call(c,args(deleted_sid,"d33-after-deleted-refund","active","refunded","refunded"))
    assert refund["action"]=="applied" and refund["account_deleted_marker_preserved"] is True,refund
    assert snapshot(c,deleted_sid,deleted_acc)[0][0]=="refunded"
    assert snapshot(c,deleted_sid,deleted_acc)[1][0]=="account_deleted"
    audit=c.execute("""select to_state::text,metadata from public.entitlement_events
       where event_key='d33-after-deleted-refund:entitlement'""").fetchone()
    assert audit[0]=="account_deleted" and audit[1].get("d33_terminal_marker_preserved") is True,audit
    print("D33_NEGATIVE_REFUND_RECORDED_TERMINAL_MARKER_PRESERVED_PASS",flush=True)

    # First paid activation must not create a Research entitlement once requested.
    new_acc=uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-000000006103")
    c.execute("insert into auth.users(id,email) values (%s,'d33-new@invalid.example')",(new_acc,))
    new_sid=uuid.UUID("22222222-2222-4222-8222-000000006103")
    c.execute("""insert into public.subscriptions(
      id,account_id,product_id,provider,provider_subscription_id,provider_customer_id,
      provider_price_id,billing_interval,state,metadata)
      values(%s,%s,'research-membership','lemon-squeezy','7103','customer-33',
       '313','monthly','pending','{}')""",(new_sid,new_acc))
    delete_profile(c,new_acc,deleted=False)
    denied(c,args(new_sid,"d33-after-request-initial","pending","active","active"))
    assert snapshot(c,new_sid,new_acc)==(("pending",1),None,0,0)
    print("D33_AFTER_REQUEST_INITIAL_ACTIVATION_DENIED_PASS",flush=True)

    # Two physical connections: deletion request commits before first activation
    # can acquire its SHARE lock. Outcome must be a precise 42501 without effects.
    race_acc,race_sid,_=seed(c,6104)
    before=snapshot(c,race_sid,race_acc)
with db(autocommit=False) as requester:
    delete_profile(requester,race_acc,deleted=False)
    invoked=Event()
    def late_activation():
        with db() as checkout:
            checkout.execute("set statement_timeout='12s'")
            invoked.set()
            return denied(checkout,args(race_sid,"d33-request-race-first","active","past_due","suspended",END))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(late_activation)
        assert invoked.wait(timeout=5)
        time.sleep(0.1)
        assert not future.done(),"deletion request failed to serialize with Research transition"
        requester.commit()
        assert future.result(timeout=15)=="42501"
with db() as verify:
    assert snapshot(verify,race_sid,race_acc)==before
print("D33_TWO_BACKEND_REQUEST_BEATS_RENEWAL_DENY_PASS",flush=True)

# Two physical connections: a finalized profile commits while a renewal
# blocks on the profile SHARE lock. No stale positive grant after commit.
with db() as fixture:
    locked_acc,locked_sid,locked_eid=seed(fixture,6105)
    fixture.execute("update public.entitlements set state='account_deleted' where id=%s",(locked_eid,))
    before=snapshot(fixture,locked_sid,locked_acc)
with db(autocommit=False) as finalizing:
    delete_profile(finalizing,locked_acc,deleted=True)
    invoked=Event()
    def late_renewal():
        with db() as checkout:
            checkout.execute("set statement_timeout='12s'")
            invoked.set()
            return denied(checkout,args(locked_sid,"d33-finished-race-renewal"))
    with ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(late_renewal)
        assert invoked.wait(timeout=5)
        time.sleep(0.1)
        assert not future.done(),"renewal bypassed deleted-profile lock"
        finalizing.commit()
        assert future.result(timeout=15)=="42501"
with db() as check:
    assert snapshot(check,locked_sid,locked_acc)==before
print("D33_TWO_BACKEND_FINALIZED_ACCOUNT_RENEWAL_DENY_PASS",flush=True)
print("D33_LIVE_RPC_AUTHOR_GUARD_PG17_PASS: no customer/provider calls, NO-GO",flush=True)
