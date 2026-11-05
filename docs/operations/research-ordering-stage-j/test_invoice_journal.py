#!/usr/bin/env python3
"""Stage J synthetic invoice identity journal, PG17.6 loopback ONLY."""
import concurrent.futures
import os
from pathlib import Path
import sys
import threading
import psycopg

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/"docs"/"operations"/"research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap,db,seed

for key in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
            "LEMON_SQUEEZY_API_KEY","LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(key),f"remote database or provider credential forbidden: {key}"
assert os.getenv("PGHOST")=="127.0.0.1"
assert os.getenv("PGDATABASE")=="ci_review"
assert os.getenv("PGUSER")=="ci_research"
assert os.getenv("PGPASSWORD")=="synthetic-stage-c-review-only"

CALL="SELECT research_ordering_stage_j.hold_paid_invoice(%s,%s,%s,%s,%s,%s,%s,%s)"
SUCCESS="subscription_payment_success"
RECOVERED="subscription_payment_recovered"

def params(event=SUCCESS,digest="1"*64,delivery="a"*64,store="41",sub="217",inv="118",provider="lemon-squeezy",test_mode=True):
    return (provider,store,test_mode,sub,inv,event,delivery,digest)
def one(c,*args):
    return c.execute(CALL,args).fetchone()[0]
def snap(c,account):
    return (
      c.execute("SELECT row_to_json(s)::text FROM public.subscriptions s WHERE account_id=%s",
                (account,)).fetchall(),
      c.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                "WHERE account_id=%s ORDER BY product_id",(account,)).fetchall(),
      c.execute("SELECT row_to_json(p)::text FROM public.purchases p "
                "WHERE account_id=%s",(account,)).fetchall(),
      c.execute("SELECT count(*) FROM public.subscription_events").fetchone()[0],
      c.execute("SELECT count(*) FROM public.entitlement_events").fetchone()[0],
    )
def seen(c,store="41",inv="118",provider="lemon-squeezy",test_mode=True):
    return c.execute(
       "SELECT invoice_snapshot_digest,disposition FROM "
       "research_ordering_stage_j.invoice_receipts WHERE "
       "provider=%s AND store_id=%s AND test_mode=%s AND invoice_id=%s",
       (provider,store,test_mode,inv)).fetchone()
def audit(c,store="41",inv="118",provider="lemon-squeezy",test_mode=True):
    return c.execute("SELECT event_name,action,signed_delivery_hash,observed_invoice_digest,subscription_id "
       "FROM research_ordering_stage_j.invoice_delivery_audit "
       "WHERE provider=%s AND store_id=%s AND test_mode=%s AND invoice_id=%s ORDER BY id",
       (provider,store,test_mode,inv)).fetchall()
def denied(c,sql,parameters=None,expected=("42501",)):
    try:c.execute(sql,parameters)
    except psycopg.Error as ex:
        assert ex.sqlstate in expected,(ex.sqlstate,str(ex),sql)
        return
    raise AssertionError("unexpectedly permitted: "+sql)
def deny_holder(c,parameters,expected="22023"):
    try:c.execute(CALL,parameters)
    except psycopg.Error as ex:assert ex.sqlstate==expected,(ex.sqlstate,str(ex))
    else:raise AssertionError("invalid canonical custody evidence accepted")

with db() as conn:
    assert conn.execute("SHOW server_version_num").fetchone()[0]=="170006"
    bootstrap(conn)
    account,sid,eid=seed(conn,36,library=True)
    original=snap(conn,account)
    conn.execute((HERE/"invoice_journal_review.sql").read_text("utf8"))
    owner_role=conn.execute("SELECT rolcanlogin,rolbypassrls FROM pg_roles "
                            "WHERE rolname='research_stage_j_owner'").fetchone()
    assert owner_role==(False,False),owner_role
    for role in ("anon","authenticated","service_role"):
        assert conn.execute(
           "SELECT has_schema_privilege(%s,'research_ordering_stage_j','USAGE')",
           (role,)).fetchone()[0] is False
        assert conn.execute(
           "SELECT has_function_privilege(%s,"
           "'research_ordering_stage_j.hold_paid_invoice(text,text,boolean,text,text,text,text,text)',"
           "'EXECUTE')",(role,)).fetchone()[0] is False
    for table in ("invoice_receipts","invoice_delivery_audit"):
        for operation in ("SELECT","INSERT","UPDATE","DELETE","TRUNCATE","TRIGGER"):
            assert conn.execute(
             "SELECT has_table_privilege('research_stage_j_writer',%s,%s)",
             ("research_ordering_stage_j."+table,operation)).fetchone()[0] is False
    assert conn.execute("SELECT has_function_privilege('research_stage_j_writer',"
         "'research_ordering_stage_j.hold_paid_invoice(text,text,boolean,text,text,text,text,text)',"
         "'EXECUTE')").fetchone()[0] is True

with db() as writer:
    writer.execute("SET ROLE research_stage_j_writer")
    first=writer.execute(CALL,params()).fetchone()[0]
    recovered=writer.execute(CALL,params(RECOVERED,delivery="b"*64)).fetchone()[0]
    replay=writer.execute(CALL,params()).fetchone()[0]
    conflict=writer.execute(CALL,params(RECOVERED,digest="2"*64,delivery="c"*64)).fetchone()[0]
    old=writer.execute(CALL,params()).fetchone()[0]
    assert [x["action"] for x in (first,recovered,replay,conflict,old)] == [
        "first_invoice_held","duplicate_invoice_held","duplicate_invoice_held",
        "invoice_conflict_quarantined","duplicate_invoice_held"
    ]
    assert first["disposition"]=="pending_reconciliation"
    assert conflict["disposition"]==old["disposition"]=="quarantined_conflict"
    assert all(x["can_mutate"] is False for x in (first,recovered,replay,conflict,old))
    assert all(x["invoice_identity"]=="lemon-squeezy:41:test:118" for x in
               (first,recovered,replay,conflict,old))
    # Same provider/store/environment/invoice reused with another subscription
    # is ONE invoice identity in quarantine, never a second fresh receipt.
    first_cross=writer.execute(CALL,params(inv="121")).fetchone()[0]
    cross=writer.execute(CALL,params(inv="121",sub="218",delivery="f"*64)).fetchone()[0]
    assert first_cross["action"]=="first_invoice_held"
    assert cross["action"]=="invoice_conflict_quarantined"
    assert cross["disposition"]=="quarantined_conflict"
    assert first_cross["invoice_identity"]==cross["invoice_identity"]=="lemon-squeezy:41:test:121"
    separate_env=writer.execute(CALL,params(inv="121",test_mode=False,delivery="e"*64)).fetchone()[0]
    assert separate_env["action"]=="first_invoice_held" and separate_env["can_mutate"] is False
    # A separate invoice ID may produce an independent pending receipt,
    # but does not mean a paid cycle or entitlement has been authorized.
    new=writer.execute(CALL,params(inv="119",digest="9"*64)).fetchone()[0]
    assert new["action"]=="first_invoice_held" and new["can_mutate"] is False
    for malformed in [
       params(event="subscription_payment_failed"),
       params(event="subscription_payment_refunded"),
       params(store="0"),params(sub="../217"),params(inv="bad"),
       params(digest="xyz"),params(delivery="not-sha256"),
       params(event=None),params(provider="other"),params(test_mode=None),
    ]: deny_holder(writer,malformed)
    for statement in (
      "UPDATE research_ordering_stage_j.invoice_receipts SET disposition='pending_reconciliation'",
      "DELETE FROM research_ordering_stage_j.invoice_receipts",
      "TRUNCATE research_ordering_stage_j.invoice_receipts",
      "UPDATE research_ordering_stage_j.invoice_delivery_audit SET action='first_invoice_held'",
      "DELETE FROM research_ordering_stage_j.invoice_delivery_audit",
      "TRUNCATE research_ordering_stage_j.invoice_delivery_audit",
      "ALTER TABLE research_ordering_stage_j.invoice_receipts DISABLE TRIGGER ALL",
    ):denied(writer,statement)
    print("STAGE_J_WRITER_PASS success+recovered same invoice held once, conflict quarantined, direct DML and invalid inputs denied",flush=True)

with db() as owner:
    owner.execute("SET ROLE research_stage_j_owner")
    for statement in (
      "UPDATE research_ordering_stage_j.invoice_receipts SET disposition='pending_reconciliation'",
      "UPDATE research_ordering_stage_j.invoice_receipts SET invoice_snapshot_digest='"+ "e"*64 +"'",
      "UPDATE research_ordering_stage_j.invoice_delivery_audit SET action='first_invoice_held'",
      "DELETE FROM research_ordering_stage_j.invoice_receipts",
      "DELETE FROM research_ordering_stage_j.invoice_delivery_audit",
      "TRUNCATE research_ordering_stage_j.invoice_delivery_audit",
      "TRUNCATE research_ordering_stage_j.invoice_receipts,research_ordering_stage_j.invoice_delivery_audit",
    ):denied(owner,statement)
    denied(owner,"INSERT INTO research_ordering_stage_j.invoice_delivery_audit("
       "store_id,subscription_id,invoice_id,event_name,signed_delivery_hash,"
       "observed_invoice_digest,action) VALUES(%s,%s,%s,%s,%s,%s,%s)",
       ("41","217","999",SUCCESS,"a"*64,"1"*64,"first_invoice_held"),("23503",))
    print("STAGE_J_OWNER_GUARDS_PASS immutable original/append-only audit/TRUNCATE/FK negative tests",flush=True)

with db() as c:
    rows=audit(c)
    assert len(rows)==5 and [r[1] for r in rows]==[
        "first_invoice_held","duplicate_invoice_held","duplicate_invoice_held",
        "invoice_conflict_quarantined","duplicate_invoice_held"
    ]
    assert rows[0][2]=="a"*64 and rows[1][2]=="b"*64
    assert seen(c)==("1"*64,"quarantined_conflict")
    assert seen(c,inv="121")==("1"*64,"quarantined_conflict")
    assert seen(c,inv="121",test_mode=False)==("1"*64,"pending_reconciliation")
    assert [x[4] for x in audit(c,inv="121")]==["217","218"]
    assert snap(c,account)==original,"synthetic Research or Library Pass changed"

barrier=threading.Barrier(2)
def concurrent_worker(event,delivery):
    with db() as c:
        c.execute("SET ROLE research_stage_j_writer")
        barrier.wait(timeout=10)
        return c.execute(CALL,params(event=event,delivery=delivery,inv="120")).fetchone()[0]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    x=pool.submit(concurrent_worker,SUCCESS,"d"*64)
    y=pool.submit(concurrent_worker,RECOVERED,"e"*64)
    results=[x.result(timeout=20),y.result(timeout=20)]
assert sorted(r["action"] for r in results)==[
    "duplicate_invoice_held","first_invoice_held"],results
assert all(r["can_mutate"] is False for r in results)
with db() as c:
    assert seen(c,inv="120")==("1"*64,"pending_reconciliation")
    assert len(audit(c,inv="120"))==2
    assert c.execute("SELECT count(*) FROM research_ordering_stage_j.invoice_receipts "
                     "WHERE provider='lemon-squeezy' AND store_id='41' AND test_mode=true AND invoice_id='120'"
                     ).fetchone()[0]==1
    assert snap(c,account)==original
    # The old production-style service_role bypass remains a separate P1 blocker.
    assert c.execute("SELECT has_table_privilege('service_role',"
      "'public.entitlements','UPDATE')").fetchone()[0]
print("RESEARCH_STAGE_J_PG17_INVOICE_CUSTODY_PASS two backend success/recovered dedupe, immutable conflict, Library Pass unchanged; no live APPLY",flush=True)
