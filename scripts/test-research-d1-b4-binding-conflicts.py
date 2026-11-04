#!/usr/bin/env python3
"""Owner D1: ephemeral REAL PostgreSQL two-connection B-4 binding review only.

IMPORTANT: synthetic service/roles; not Production, Dev, Lemon Squeezy,
actual Research transition SQL, actual provider HMAC or RLS certification.
"""
import concurrent.futures
import os
from pathlib import Path
import threading
import time
import psycopg

PG = {
    "host": os.environ.get("PGHOST"), "port": os.environ.get("PGPORT"),
    "dbname": os.environ.get("PGDATABASE"), "user": os.environ.get("PGUSER"),
    "password": os.environ.get("PGPASSWORD"), "connect_timeout": 5,
    "autocommit": True,
}
ROOT = Path(__file__).resolve().parent.parent
SQL_PATH = ROOT / "docs/operations/research-b4-synthetic-binding-conflict-2026-11-04.sql"
P1 = "11111111-1111-4111-8111-111111111111"
P2 = "22222222-2222-4222-8222-222222222222"
P3 = "33333333-3333-4333-8333-333333333333"

def guard():
    assert os.environ.get("CI") == "true" and os.environ.get("GITHUB_ACTIONS") == "true"
    assert (PG["host"],PG["port"],PG["dbname"],PG["user"],PG["password"]) == (
        "127.0.0.1","5432","ci_review","ci_research","ci_fixture_only_password"
    ), "Only synthetic loopback PostgreSQL is authorized"
    body = SQL_PATH.read_text()
    assert "B-4: D1 OWNER-APPROVED SYNTHETIC" in body
    assert "create schema research_binding_review" in body.lower()
    assert "create schema research_private;" not in body.lower()
    assert "supabase.co" not in body.lower()
    return body

def admin():
    return psycopg.connect(**PG)

def api():
    return psycopg.connect(
        host="127.0.0.1",port=5432,dbname="ci_review",
        user="review_binding_api",password="ci_review_api_only_password",
        connect_timeout=5,autocommit=True,
    )

def query(connection, text, params=()):
    with connection.cursor() as cursor:
        cursor.execute(text,params)
        if cursor.description is None:
            return []
        return cursor.fetchall()

def one(connection,text,params=()):
    return query(connection,text,params)[0][0]

def invoke(connection, name, account, subscription, event):
    assert name in ("observe_signed_paid","try_bind_paid","try_activate_paid")
    return one(connection,
        "select research_binding_review."+name+"(%s::uuid,%s::text,%s::text)",
        (account,subscription,event))

def conflicts(admin_conn,event):
    return query(admin_conn,
        """select conflict_code,provider_subscription_id,provider_event_id, bound_account_id
             from research_binding_review.conflict_observations
            where provider_event_id=%s order by observed_at,id""",
        (event,))

def paid(admin_conn,event):
    return query(admin_conn,
        """select provider_event_id,provider_subscription_id,bound_account_id
             from research_binding_review.signed_paid_observations
            where provider_event_id=%s""",(event,))

def snapshot(admin_conn, table, predicate="TRUE"):
    assert table in ("entitlements","library_pass_receipts","subscriptions")
    return one(admin_conn,
        f"""select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
              from research_binding_review.{table} as t where {predicate}""")

def expect_error(operation, sqlstate="42501", contains=None):
    error = None
    try: operation()
    except psycopg.Error as ex: error=ex
    assert error is not None,"Expected SQL rejection"
    if sqlstate:
        assert error.sqlstate==sqlstate, str(error)
    if contains:
        assert contains.lower() in str(error).lower(),str(error)
    return error

def setup_fixture(root):
    root.execute(guard())
    for p in (P1,P2,P3):
        root.execute(
            "insert into research_binding_review.profiles(account_id,status) values (%s::uuid,'active')",
            (p,))
    root.execute(
        """insert into research_binding_review.entitlements(
          account_id,product_id,source,state,version)
          values (%s::uuid,'research-membership','complimentary','active',1)""",
        (P2,))
    for p in (P1,P3):
        root.execute(
            """insert into research_binding_review.entitlements(
              account_id,product_id,source,state,version)
              values (%s::uuid,'library-pass','library-pass','active',1)""",
            (p,))
        root.execute(
            """insert into research_binding_review.library_pass_receipts(
              account_id,provider,provider_event_id,status)
              values (%s::uuid,'lemon-squeezy',%s,'processed')""",
            (p,"library-event-"+p[:8]))

def test_t13_two_distinct_paid_bindings(a,b,watch):
    # Independent precommitted evidence for BOTH signed/paid provider objects.
    assert invoke(a,"observe_signed_paid",P1,"synthetic-provider-sub-1","evt-b4-1")["disposition"]=="recorded"
    assert invoke(b,"observe_signed_paid",P1,"synthetic-provider-sub-2","evt-b4-2")["disposition"]=="recorded"
    assert len(paid(watch,"evt-b4-1"))==len(paid(watch,"evt-b4-2"))==1

    before_library_ent=snapshot(watch,"entitlements","product_id='library-pass'")
    before_library_receipts=snapshot(watch,"library_pass_receipts")
    a.execute("BEGIN")
    first=invoke(a,"try_bind_paid",P1,"synthetic-provider-sub-1","evt-b4-1")
    assert first["disposition"]=="created",first
    b_pid=one(b,"select pg_backend_pid()")
    started=threading.Event()
    def bind_b():
        started.set()
        return invoke(b,"try_bind_paid",P1,"synthetic-provider-sub-2","evt-b4-2")
    observed=False
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(bind_b)
        assert started.wait(3)
        try:
            deadline=time.monotonic()+6
            while time.monotonic()<deadline:
                event_type=one(watch,"select wait_event_type from pg_stat_activity where pid=%s",(b_pid,))
                if event_type=="Lock":
                    observed=True
                    break
                if future.done():break
                time.sleep(0.07)
        finally:
            a.execute("COMMIT")
        second=future.result(timeout=10)
    assert observed,"T13 requires a real PostgreSQL profile-lock wait"
    assert second=={"disposition":"conflict","code":"duplicate_paid_subscription"},second

    subs=query(watch,
        """select provider_subscription_id,status
          from research_binding_review.subscriptions where account_id=%s::uuid""",(P1,))
    assert subs==[("synthetic-provider-sub-1","pending")],subs
    evidence=conflicts(watch,"evt-b4-2")
    assert len(evidence)==1 and evidence[0][0]=="duplicate_paid_subscription",evidence
    assert evidence[0][1]=="synthetic-provider-sub-2" and str(evidence[0][3])==P1
    assert snapshot(watch,"entitlements","product_id='library-pass'")==before_library_ent
    assert snapshot(watch,"library_pass_receipts")==before_library_receipts
    print("PASS B4 T13: real profile row lock; second paid subscription returned conflict; committed journal; first pending")

def test_t21_complimentary_preservation(a,b,watch):
    assert invoke(a,"observe_signed_paid",P2,"synthetic-provider-sub-3","evt-b4-3")["disposition"]=="recorded"
    before=snapshot(watch,"entitlements",
       f"account_id='{P2}'::uuid and product_id='research-membership'")
    assert len(before)==1
    bound=invoke(a,"try_bind_paid",P2,"synthetic-provider-sub-3","evt-b4-3")
    assert bound["disposition"]=="created",bound
    activated=invoke(b,"try_activate_paid",P2,"synthetic-provider-sub-3","evt-b4-3")
    assert activated=={"disposition":"conflict","code":"entitlement_conflict"},activated
    after=snapshot(watch,"entitlements",
       f"account_id='{P2}'::uuid and product_id='research-membership'")
    assert after==before,"T21 complimentary entitlement changed"
    sub=one(watch,"select status from research_binding_review.subscriptions where provider_subscription_id='synthetic-provider-sub-3'")
    assert sub=="pending"
    evidence=conflicts(watch,"evt-b4-3")
    assert any(row[0]=="entitlement_conflict" for row in evidence)
    print("PASS B4 T21: complimentary row byte-identical; activation non-applied, committed conflict evidence")

def test_t22_library_untouched(watch,before_ent,before_receipts):
    assert snapshot(watch,"entitlements","product_id='library-pass'")==before_ent
    assert snapshot(watch,"library_pass_receipts")==before_receipts
    print("PASS B4 T22: synthetic Library Pass entitlements and commerce receipts byte-identical")

def test_x1_expired_lease_reacquisition(admin_a,admin_b,watch):
    # Existing B3 receipt schema is created by the earlier D1 script.
    for trial in range(12):
        evt=f"b4-x1-expired-{trial}"
        original=one(admin_a,
            "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
            (evt,"subscription_created","research-receipt-business-v3","f"*64))
        assert original["disposition"]=="acquired"
        admin_a.execute("""update research_receipt_review.receipts
         set lease_expires_at=clock_timestamp()-interval '1 second'
         where id=%s::uuid""",(original["receipt_id"],))
        barrier=threading.Barrier(3)
        def contest(c):
            barrier.wait(timeout=5)
            return one(c,
                "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
                (evt,"subscription_created","research-receipt-business-v3","f"*64))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            a=pool.submit(contest,admin_a)
            b=pool.submit(contest,admin_b)
            barrier.wait(timeout=5)
            results=[a.result(timeout=10),b.result(timeout=10)]
        assert sorted(x["disposition"] for x in results)==["acquired","in_progress"],results
        assert one(watch,"select attempt_count from research_receipt_review.receipts where provider_event_id=%s",(evt,))==2
    print("PASS B4 X1: 12 real concurrent expired-lease contests, exactly one reacquired")

def test_x2_lease_uses_wall_clock(admin_a,watch):
    evt="b4-x2-clock-after-txn-delay"
    admin_a.execute("BEGIN")
    try:
        admin_a.execute("select pg_sleep(1.3)")
        r=one(admin_a,
            "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
            (evt,"subscription_created","research-receipt-business-v3","e"*64))
        assert r["disposition"]=="acquired"
    finally:
        admin_a.execute("COMMIT")
    diff=one(watch,
        """select extract(epoch from lease_expires_at-clock_timestamp())::float8
           from research_receipt_review.receipts where provider_event_id=%s""",(evt,))
    assert diff>=88.9, f"X2 expected wall-clock-based 90s lease, got {diff:.3f}s"
    print("PASS B4 X2: delayed transaction still receives 90s clock_timestamp lease")

def test_x3_rollback_journal_limitation(a,watch):
    # A signed/paid observation commits BEFORE a rollbackable binding attempt.
    # This cannot make the later conflict journal autonomous.
    event="evt-b4-rollback"
    assert invoke(a,"observe_signed_paid",P1,"synthetic-provider-sub-rollback",event)["disposition"]=="recorded"
    assert len(paid(watch,event))==1
    a.execute("BEGIN")
    result=invoke(a,"try_bind_paid",P1,"synthetic-provider-sub-rollback",event)
    assert result["disposition"]=="conflict" and result["code"]=="duplicate_paid_subscription"
    a.execute("ROLLBACK")
    assert conflicts(watch,event)==[],"Rollback should erase uncommitted conflict, limitation must be explicit"
    assert len(paid(watch,event))==1,"Previously committed signed paid evidence MUST survive later rollback"
    orphan=one(watch,
        """select count(*) from research_binding_review.signed_paid_observations p
          where provider_event_id=%s and not exists (
            select 1 from research_binding_review.subscriptions s
             where s.provider_subscription_id=p.provider_subscription_id)""",(event,))
    assert orphan==1
    print("EXPECTED B4 X3 LIMITATION: rollback erased uncommitted conflict; precommitted signed-paid record survived as unbound case")

def test_x4_force_truncate_review_journal(watch):
    # Confirm the trigger itself, not merely a foreign-key RESTRICT, blocks
    # both CASCADE and a stand-alone resolution table TRUNCATE.
    for statement in (
        "truncate research_receipt_review.conflict_observations cascade",
        "truncate research_receipt_review.resolution_observations",
        "truncate research_binding_review.conflict_observations cascade",
        "truncate research_binding_review.signed_paid_observations cascade",
    ):
        expect_error(lambda s=statement: watch.execute(s),contains="append-only")
    print("PASS B4 X4: TRUNCATE CASCADE refused by real trigger, not just FK")

def test_x8_version_mismatch_remains_non_applied(watch):
    evt="b4-x8-stuck-v1"
    old=one(watch,
        "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
        (evt,"subscription_created","research-receipt-business-v1","1"*64))
    assert old["disposition"]=="acquired"
    finish=one(watch,
        "select research_receipt_review.finish_review_receipt(%s::uuid,%s,%s::uuid,%s,%s)",
        (old["receipt_id"],old["attempt_count"],old["lease_token"],
         "failed","provider_reconciliation_needed"))
    assert finish["disposition"]=="applied"
    for _ in range(4):
        outcome=one(watch,
            "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
            (evt,"subscription_created","research-receipt-business-v3","3"*64))
        assert outcome["disposition"]=="version_mismatch"
    original=one(watch,
        "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
        (evt,"subscription_created","research-receipt-business-v1","1"*64))
    assert original["disposition"]=="acquired","Frozen v1 hash is required for an authorized retry"
    print("EXPECTED B4 X8 BLOCKER: v3 cannot replay a stored v1 failure; frozen v1 hash required (not wired into app)")

def test_d2_isolated_non_superuser_privileges(a,watch):
    assert one(a,"select current_user")=="review_binding_api"
    assert not one(a,"select rolbypassrls from pg_roles where rolname=current_user")
    assert not one(a,"select pg_has_role(current_user,'review_binding_writer','MEMBER')")
    assert one(watch,"select has_function_privilege('review_binding_api','research_binding_review.try_bind_paid(uuid,text,text)','EXECUTE')")
    for role in ("review_binding_anon","review_binding_authenticated"):
        assert not one(watch,
            "select has_function_privilege(%s,'research_binding_review.try_bind_paid(uuid,text,text)','EXECUTE')",(role,))
    for statement in (
        "update research_binding_review.subscriptions set status='cancelled'",
        "delete from research_binding_review.conflict_observations",
        "truncate research_binding_review.signed_paid_observations",
        "set role review_binding_writer",
    ):
        expect_error(lambda s=statement: a.execute(s),sqlstate="42501")
    assert one(watch,
        """select relowner::regrole::text from pg_class
            where oid='research_binding_review.conflict_observations'::regclass""")=="review_binding_evidence_owner"
    assert one(watch,
        """select pg_get_userbyid(proowner) from pg_proc
           where oid='research_binding_review.try_bind_paid(uuid,text,text)'::regprocedure""")=="review_binding_writer"
    print("PASS B4 synthetic D2: non-superuser API, no direct table writes, no SET ROLE, restricted execute; NOT actual Supabase RLS")

def test_paid_event_identity_conflict(a,watch):
    eid="evt-b4-identity"
    assert invoke(a,"observe_signed_paid",P1,"synthetic-sub-identity-a",eid)["disposition"]=="recorded"
    x=invoke(a,"observe_signed_paid",P1,"synthetic-sub-identity-b",eid)
    assert x["disposition"]=="event_identity_conflict"
    j=conflicts(watch,eid)
    assert any(z[0]=="paid_evidence_identity_mismatch" for z in j)
    assert paid(watch,eid)[0][1]=="synthetic-sub-identity-a"
    print("PASS B4 provider event identity collision is journalled, not silently reused")

def main():
    assert guard()
    with admin() as root:
        setup_fixture(root)
        library_ent=snapshot(root,"entitlements","product_id='library-pass'")
        library_receipts=snapshot(root,"library_pass_receipts")
        with api() as a, api() as b:
            test_d2_isolated_non_superuser_privileges(a,root)
            test_t13_two_distinct_paid_bindings(a,b,root)
            test_t21_complimentary_preservation(a,b,root)
            test_paid_event_identity_conflict(a,root)
            test_x3_rollback_journal_limitation(a,root)
            test_t22_library_untouched(root,library_ent,library_receipts)
        with admin() as a, admin() as b:
            test_x1_expired_lease_reacquisition(a,b,root)
            test_x2_lease_uses_wall_clock(a,root)
        test_x4_force_truncate_review_journal(root)
        test_x8_version_mismatch_remains_non_applied(root)
    print("B4 REAL PostgreSQL synthetic T13/T21/T22/X1/X2/X4/D2 PASS; X3/X8 LIMITATIONS DOCUMENTED.")
    print("NOT TESTED: actual USD Impact paid binding/Library Pass SQL migration, HMAC/merchant, Supabase roles, Production.")

if __name__=="__main__":
    main()
