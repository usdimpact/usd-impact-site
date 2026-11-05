#!/usr/bin/env python3
"""Stage K H1/H2/D1 isolated journal review, NEVER connected Supabase."""
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
    assert not os.getenv(key),f"remote database/provider credential forbidden: {key}"
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD"))==(
    "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")
LOGIN=dict(host="127.0.0.1",port=5432,dbname="ci_review",
           user="research_stage_k_gateway",password="synthetic-stage-k-ci-only-long-password",
           connect_timeout=5,autocommit=True)
H_SQL=ROOT/"docs"/"operations"/"research-ordering-stage-h"/"receipt_journal_review.sql"
I_SQL=ROOT/"docs"/"operations"/"research-ordering-stage-i"/"journal_hardening_review.sql"
J_SQL=ROOT/"docs"/"operations"/"research-ordering-stage-j"/"invoice_journal_review.sql"
K_SQL=HERE/"conflict_observation_review.sql"
CALL="SELECT research_ordering_stage_k.hold_observation(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
J_CALL="SELECT research_ordering_stage_j.hold_paid_invoice(%s,%s,%s,%s,%s,%s,%s,%s)"
H_CALL="SELECT research_ordering_stage_h.hold_evidence(%s,%s,%s,%s,%s)"

def payload(event="subscription_payment_success",signed="a"*64,iv="invoice-v1",
            sv="subscription-v1",digest="1"*64,quote="c"*64,sub="217",invoice="118",
            test_mode=True):
    return ("lemon-squeezy","41",test_mode,sub,invoice,event,signed,digest,iv,sv,quote)

def remote_login():
    c=psycopg.connect(**LOGIN)
    assert c.execute("SELECT current_user,session_user").fetchone()==(
        "research_stage_k_gateway","research_stage_k_gateway")
    return c

def deny(conn,sql,values=None,allowed=("42501",)):
    try:conn.execute(sql,values)
    except psycopg.Error as ex:
        assert ex.sqlstate in allowed,(ex.sqlstate,str(ex),sql)
        return
    raise AssertionError("operation should have failed: "+sql)

def snap(c,account):
    return (
      c.execute("SELECT row_to_json(s)::text FROM public.subscriptions s WHERE account_id=%s",(account,)).fetchall(),
      c.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s ORDER BY product_id",(account,)).fetchall(),
      c.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(account,)).fetchall(),
      c.execute("SELECT count(*) FROM public.subscription_events").fetchone()[0],
      c.execute("SELECT count(*) FROM public.entitlement_events").fetchone()[0],
    )

def audit(c,invoice="118"):
    return c.execute("SELECT action,disposition,event_name,signed_delivery_hash,"
      "provider_invoice_version,provider_subscription_version,quote_evidence_digest,"
      "invoice_snapshot_digest,subscription_id FROM research_ordering_stage_k.provider_observations "
      "WHERE provider='lemon-squeezy' AND store_id='41' AND test_mode=true AND invoice_id=%s "
      "ORDER BY id",(invoice,)).fetchall()

with db() as c:
    assert c.execute("SHOW server_version_num").fetchone()[0]=="170006"
    bootstrap(c)
    account,sid,eid=seed(c,38,library=True)
    before=snap(c,account)
    for p in (H_SQL,I_SQL,J_SQL,K_SQL):
        assert p.is_file(),p
        c.execute(p.read_text("utf8"))

    # H1: verify the EXACT SQL-language function settings, not a code comment.
    for signature in (
      "research_ordering_stage_h.hold_evidence(text,text,text,text,text)",
      "research_ordering_stage_j.hold_paid_invoice(text,text,boolean,text,text,text,text,text)",
      "research_ordering_stage_k.hold_observation(text,text,boolean,text,text,text,text,text,text,text,text)",
    ):
        cfg=c.execute("SELECT proconfig FROM pg_proc WHERE oid=%s::regprocedure",
                      (signature,)).fetchone()[0]
        assert cfg and any(v in ("search_path=","search_path=\"\"") for v in cfg),(signature,cfg)
    for role in ("anon","authenticated","service_role","research_stage_j_writer"):
        assert c.execute("SELECT has_function_privilege(%s,%s,'EXECUTE')",
            (role,"research_ordering_stage_k.hold_observation(text,text,boolean,text,text,text,text,text,text,text,text)")
          ).fetchone()[0] is False,role
    assert c.execute("SELECT has_function_privilege('research_stage_j_writer',%s,'EXECUTE')",
        ("research_ordering_stage_j.hold_paid_invoice(text,text,boolean,text,text,text,text,text)",)
        ).fetchone()[0] is False
    for table in ("provider_observations",):
        for verb in ("SELECT","INSERT","UPDATE","DELETE","TRUNCATE","TRIGGER","REFERENCES"):
            assert c.execute("SELECT has_table_privilege('research_stage_k_gateway',%s,%s)",
                ("research_ordering_stage_k."+table,verb)).fetchone()[0] is False
    for role in ("research_stage_k_owner","research_stage_j_owner","research_stage_i_owner"):
        assert c.execute("SELECT pg_has_role('research_stage_k_gateway',%s,'MEMBER')",
            (role,)).fetchone()[0] is False
    assert c.execute("SELECT rolcanlogin,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname='research_stage_k_gateway'").fetchone()==(True,False,2)
    print("STAGE_K_H1_PASS all three review definer holders empty search_path; direct J bypass revoked",flush=True)

# Real 127.0.0.1 TCP LOGIN, not superuser SET ROLE simulation.
with remote_login() as gateway:
    assert gateway.execute("SHOW statement_timeout").fetchone()[0] in ("2s","2000ms")
    assert gateway.execute("SHOW lock_timeout").fetchone()[0] in ("1s","1000ms")
    deny(gateway,"SET ROLE research_stage_k_owner",allowed=("42501",))
    deny(gateway,"SET ROLE research_stage_j_owner",allowed=("42501",))
    deny(gateway,"SELECT * FROM research_ordering_stage_k.provider_observations",allowed=("42501",))
    deny(gateway,"DELETE FROM research_ordering_stage_k.provider_observations",allowed=("42501",))
    deny(gateway,"TRUNCATE research_ordering_stage_k.provider_observations",allowed=("42501",))
    deny(gateway,"ALTER TABLE research_ordering_stage_k.provider_observations DISABLE TRIGGER ALL",allowed=("42501",))
    deny(gateway,J_CALL,("lemon-squeezy","41",True,"217","118",
        "subscription_payment_success","a"*64,"1"*64),allowed=("42501",))
    a=gateway.execute(CALL,payload()).fetchone()[0]
    b=gateway.execute(CALL,payload(event="subscription_payment_recovered",signed="b"*64)).fetchone()[0]
    conflict=gateway.execute(CALL,payload(event="subscription_payment_recovered",
        signed="d"*64,iv="invoice-v2",sv="subscription-v2",digest="2"*64,quote="e"*64)).fetchone()[0]
    again=gateway.execute(CALL,payload(event="subscription_payment_recovered",signed="f"*64)).fetchone()[0]
    assert [q["action"] for q in (a,b,conflict,again)]==[
      "first_invoice_held","duplicate_invoice_held",
      "invoice_conflict_quarantined","duplicate_invoice_held"
    ]
    assert conflict["disposition"]==again["disposition"]=="quarantined_conflict"
    assert all(q["can_mutate"] is False and q["provider_settlement_proven"] is False
               and q["authoritative_paid_cycle"] is False and
               q["remote_atomicity_proven"] is False for q in (a,b,conflict,again))
    for invalid in (
       payload(quote="not-a-hash"),payload(iv=""),payload(sv="x"*161),
       payload(signed="notsha"),payload(digest="bad")
    ):
        deny(gateway,CALL,invalid,allowed=("22023",))
    # The actual LOGIN owns no bypass path, no table grants and cannot change
    # another customer's entitlements.
    deny(gateway,"UPDATE public.entitlements SET state='revoked'",
         allowed=("42501",))
    print("STAGE_K_H2_PASS real restricted TCP LOGIN, 2s statement timeout, no role/table/direct J access",flush=True)

with db() as verify:
    rows=audit(verify)
    assert len(rows)==4,rows
    assert [x[0] for x in rows]==[
        "first_invoice_held","duplicate_invoice_held",
        "invoice_conflict_quarantined","duplicate_invoice_held"
    ]
    assert [x[3] for x in rows]==["a"*64,"b"*64,"d"*64,"f"*64]
    assert rows[2][4:8]==("invoice-v2","subscription-v2","e"*64,"2"*64)
    assert rows[0][4:8]==("invoice-v1","subscription-v1","c"*64,"1"*64)
    assert all(x[8]=="217" for x in rows)
    assert verify.execute("SELECT invoice_snapshot_digest,disposition FROM "
      "research_ordering_stage_j.invoice_receipts WHERE provider='lemon-squeezy' AND "
      "store_id='41' AND test_mode=true AND invoice_id='118'").fetchone()==(
      "1"*64,"quarantined_conflict")
    assert snap(verify,account)==before
    # Check H1 holder also functions with an empty search path (no data grant).
    verify.execute("SET ROLE research_stage_i_writer")
    h=verify.execute(H_CALL,("synthetic-stage-k-h1","a"*64,"invoice-v1","sub-v1","1"*64)).fetchone()[0]
    assert h["action"]=="candidate_held" and h["can_mutate"] is False
    verify.execute("RESET ROLE")
    print("STAGE_K_D1_PASS conflicting signed hash, invoice/sub versions, quote+snapshot digests retained append-only",flush=True)

with db() as owner:
    owner.execute("SET ROLE research_stage_k_owner")
    for sql in (
      "UPDATE research_ordering_stage_k.provider_observations SET action='first_invoice_held'",
      "DELETE FROM research_ordering_stage_k.provider_observations",
      "TRUNCATE research_ordering_stage_k.provider_observations",
    ):deny(owner,sql)
    print("STAGE_K_APPEND_ONLY_PASS owner DML denied by triggers; superuser bypass remains open",flush=True)

# Two concurrent REAL restricted TCP LOGIN connections, each independently
# holding a distinct signed delivery of one canonical invoice.
barrier=threading.Barrier(2)
def worker(event,digest):
    with remote_login() as c:
        barrier.wait(timeout=10)
        return c.execute(CALL,payload(event=event,signed=digest,invoice="120")).fetchone()[0]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    x=pool.submit(worker,"subscription_payment_success","1"*64)
    y=pool.submit(worker,"subscription_payment_recovered","2"*64)
    out=[x.result(timeout=20),y.result(timeout=20)]
assert sorted(q["action"] for q in out)==[
 "duplicate_invoice_held","first_invoice_held"],out
assert all(q["can_mutate"] is False for q in out)

with db() as final:
    assert len(audit(final,invoice="120"))==2
    assert final.execute("SELECT count(*) FROM research_ordering_stage_j.invoice_receipts "
      "WHERE provider='lemon-squeezy' AND store_id='41' AND test_mode=true "
      "AND invoice_id='120'").fetchone()[0]==1
    assert snap(final,account)==before,"Research or Library Pass fixture mutated"
    assert final.execute("SELECT has_table_privilege('service_role','public.entitlements','UPDATE')").fetchone()[0]
print("RESEARCH_STAGE_K_PG17_REVIEW_PASS isolated H1/H2/D1 audit + two-login concurrency; LIVE service_role P1 OPEN",flush=True)
