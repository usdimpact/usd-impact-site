#!/usr/bin/env python3
"""Author-only full-52-migration hold-ledger acceptance on disposable PG17.6."""
import os,sys,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
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
assert tuple(os.getenv(k) for k in
    ("PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD"))==(
    "127.0.0.1","5432","ci_review","ci_research","synthetic-stage-c-review-only")
CALL="select public.record_research_deletion_billing_hold(%s,%s)"
def user(c,n,due=True):
    aid=uuid.UUID(f"eeee0000-0000-4000-8000-{n:012d}")
    c.execute("insert into auth.users(id,email) values (%s,%s)",(aid,f"hold-{n}@invalid.example"))
    if due:
        c.execute("""update public.profiles set
          status='deletion_pending',
          deletion_requested_at=clock_timestamp()-interval '3 days',
          deletion_due_at=clock_timestamp()-interval '1 day'
          where account_id=%s""",(aid,))
    return aid

def invoke(c,aid,reason="subscription_present"):
    c.execute("set role service_role")
    try:
        return c.execute(CALL,(aid,reason)).fetchone()[0]
    finally:
        c.execute("reset role")

with db() as c:
    assert c.execute("show server_version_num").fetchone()[0]=="170006"
    bootstrap(c)
    path=ROOT/"docs/operations/research-deletion-billing-hold/hold_ledger_schema_review_only.sql"
    c.execute(path.read_text("utf-8"))
    assert c.execute("select relrowsecurity from pg_class where oid='public.research_deletion_billing_holds'::regclass").fetchone()[0] is True
    for role in ("anon","authenticated"):
        assert c.execute("select has_table_privilege(%s,'public.research_deletion_billing_holds','SELECT')",(role,)).fetchone()[0] is False
        assert c.execute("select has_function_privilege(%s,"
            "'public.record_research_deletion_billing_hold(uuid,text)','EXECUTE')",(role,)).fetchone()[0] is False
    assert c.execute("select has_function_privilege('service_role',"
        "'public.record_research_deletion_billing_hold(uuid,text)','EXECUTE')").fetchone()[0] is True
    print("D33_LEDGER_RLS_AND_SERVER_ONLY_EXECUTE_PASS",flush=True)

    aid=user(c,8001)
    first=invoke(c,aid)
    assert first["hold_state"]=="open" and first["reason_code"]=="subscription_present"
    assert first["attempt_count"]==1
    rows=c.execute("select first_seen_at,next_check_at from public.research_deletion_billing_holds where account_id=%s",(aid,)).fetchone()
    assert rows and rows[1]>rows[0]
    same=invoke(c,aid,"existing_hold")
    assert same["attempt_count"]==1 and same["reason_code"]=="existing_hold"
    assert c.execute("select count(*) from public.research_deletion_billing_holds where account_id=%s",(aid,)).fetchone()[0]==1
    assert c.execute("select first_seen_at from public.research_deletion_billing_holds where account_id=%s",(aid,)).fetchone()[0]==rows[0]
    print("D33_LEDGER_ACCOUNT_KEY_DEDUP_AND_SCHEDULE_THROTTLE_PASS",flush=True)

    for expected in (2,3,4):
        c.execute("update public.research_deletion_billing_holds set next_check_at=clock_timestamp()-interval '1 second' where account_id=%s",(aid,))
        again=invoke(c,aid,"lookup_unavailable")
        assert again["attempt_count"]==expected,again
        assert again["hold_state"]=="open" or expected>=4
    assert again["hold_state"]=="open","review escalation is time-driven, not auto at 4 attempts"
    c.execute("update public.research_deletion_billing_holds set escalate_at=clock_timestamp()-interval '1 minute' where account_id=%s",(aid,))
    escalation=invoke(c,aid,"lookup_malformed")
    assert escalation["hold_state"]=="manual_review" and escalation["attempt_count"]==4
    assert c.execute("select escalated_at from public.research_deletion_billing_holds where account_id=%s",(aid,)).fetchone()[0] is not None
    assert invoke(c,aid,"existing_hold")["hold_state"]=="manual_review"
    print("D33_LEDGER_ESCALATION_AFTER_BOUNDED_24H_REVIEW_PASS",flush=True)

    active=user(c,8002,due=False)
    before=c.execute("select count(*) from public.research_deletion_billing_holds").fetchone()[0]
    try:
        invoke(c,active)
        raise AssertionError("active account billing-hold creation allowed")
    except psycopg.Error as e:
        assert e.sqlstate=="42501",e.sqlstate
    try:
        invoke(c,aid,"arbitrary_provider_response")
        raise AssertionError("unapproved reason inserted")
    except psycopg.Error as e:
        assert e.sqlstate=="22023",e.sqlstate
    assert c.execute("select count(*) from public.research_deletion_billing_holds").fetchone()[0]==before
    print("D33_LEDGER_ACTIVE_ACCOUNT_AND_REASON_INJECTION_DENIED_PASS",flush=True)

    raced=user(c,8003)
    initial_count=c.execute("select count(*) from public.research_deletion_billing_holds").fetchone()[0]
def concurrent():
    with db() as conn:
        return invoke(conn,raced,"subscription_present")
with ThreadPoolExecutor(max_workers=2) as pool:
    outcomes=list(pool.map(lambda _:concurrent(),range(2)))
assert all(v["hold_state"]=="open" for v in outcomes),outcomes
with db() as c:
    assert c.execute("select count(*) from public.research_deletion_billing_holds").fetchone()[0]==initial_count+1
    assert c.execute("select attempt_count from public.research_deletion_billing_holds where account_id=%s",(raced,)).fetchone()[0]==1
print("D33_LEDGER_TWO_BACKEND_CONCURRENT_UPSERT_SINGLE_CASE_PASS",flush=True)
print("D33_FULL52_HOLD_LEDGER_AUTHOR_PG17_PASS: NO MERGE OR CONNECTED DB",flush=True)
