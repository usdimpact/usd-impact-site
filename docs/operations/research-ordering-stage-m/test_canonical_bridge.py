#!/usr/bin/env python3
"""Stage M: one canonical synthetic invoice writer + immutable H/I archive."""
from pathlib import Path
import os,sys
import psycopg

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/"docs"/"operations"/"research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap,db,seed

for key in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
            "LEMON_SQUEEZY_API_KEY","LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(key),f"connected provider/DB forbidden: {key}"
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD"))==(
    "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")
H=ROOT/"docs"/"operations"/"research-ordering-stage-h"/"receipt_journal_review.sql"
I=ROOT/"docs"/"operations"/"research-ordering-stage-i"/"journal_hardening_review.sql"
J=ROOT/"docs"/"operations"/"research-ordering-stage-j"/"invoice_journal_review.sql"
K=ROOT/"docs"/"operations"/"research-ordering-stage-k"/"conflict_observation_review.sql"
M=HERE/"canonical_bridge_review.sql"
H_CALL="SELECT research_ordering_stage_h.hold_evidence(%s,%s,%s,%s,%s)"
K_CALL="SELECT research_ordering_stage_k.hold_observation(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
DIGEST="SELECT research_ordering_stage_m.invoice_handoff_digest_v1(%s,%s,%s,%s,%s,%s,%s)"
GOLDEN="ac468f71dbacfea1cb622e3f57a959f1c0a1560b0d31f1c0c107fa18b825c4e7"
def kargs(event="subscription_payment_success",invoice="118",delivery="a"*64,
          invversion="invoice-v1",subversion="subscription-v1",
          snapshot="1"*64,quote="2"*64):
    return ("lemon-squeezy","41",True,"217",invoice,event,delivery,
            snapshot,invversion,subversion,quote)
def remote():
    return psycopg.connect(host="127.0.0.1",port=5432,dbname="ci_review",
      user="research_stage_k_gateway",password="synthetic-stage-k-ci-only-long-password",
      connect_timeout=5,autocommit=True)
def denied(c,sql,params=None,states=("42501",)):
    try:c.execute(sql,params)
    except psycopg.Error as e:
        assert e.sqlstate in states,(sql,e.sqlstate,str(e))
        return
    raise AssertionError("unexpectedly authorized: "+sql)
def snapshot(c,account):
    return (
      c.execute("SELECT row_to_json(s)::text FROM public.subscriptions s "
                "WHERE account_id=%s",(account,)).fetchall(),
      c.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                "WHERE account_id=%s ORDER BY product_id",(account,)).fetchall(),
      c.execute("SELECT row_to_json(p)::text FROM public.purchases p "
                "WHERE account_id=%s",(account,)).fetchall(),
      c.execute("SELECT COUNT(*) FROM public.subscription_events").fetchone()[0],
      c.execute("SELECT COUNT(*) FROM public.entitlement_events").fetchone()[0],
    )
with db() as root:
    assert root.execute("SHOW server_version_num").fetchone()[0]=="170006"
    bootstrap(root)
    acc,sid,eid=seed(root,47,library=True)
    orig=snapshot(root,acc)
    for script in (H,I,J,K):
        assert script.is_file(),script
        root.execute(script.read_text("utf8"))
    # Load synthetic historical H/I evidence BEFORE the writer is retired.
    root.execute("SET ROLE research_stage_i_writer")
    h=root.execute(H_CALL,("subscription_payment_success:118","a"*64,
              "invoice-v1","subscription-v1","1"*64)).fetchone()[0]
    h_wrong=root.execute(H_CALL,("subscription_payment_recovered:119","f"*64,
              "invoice-v2","subscription-v2","3"*64)).fetchone()[0]
    assert h["action"]=="candidate_held" and h_wrong["action"]=="candidate_held"
    root.execute("RESET ROLE")
with remote() as gateway:
    got=gateway.execute(K_CALL,kargs()).fetchone()[0]
    assert got["action"]=="first_invoice_held" and got["can_mutate"] is False

with db() as root:
    root.execute(M.read_text("utf8"))
    assert root.execute("SELECT count(*) FROM research_ordering_stage_h.pending_receipts"
                       ).fetchone()[0]==2
    bridge=root.execute("SELECT event_key,provider,store_id,test_mode,invoice_id,"
       "signed_delivery_hash,disposition FROM research_ordering_stage_m.legacy_receipt_links"
       ).fetchall()
    assert len(bridge)==1,bridge
    assert bridge[0]==("subscription_payment_success:118","lemon-squeezy",
                       "41",True,"118","a"*64,"legacy_historical_only"),bridge
    assert root.execute("SELECT count(*) FROM research_ordering_stage_j.invoice_receipts"
                      ).fetchone()[0]==1
    assert not root.execute("SELECT has_function_privilege('research_stage_i_writer',%s,'EXECUTE')",
       ("research_ordering_stage_h.hold_evidence(text,text,text,text,text)",)).fetchone()[0]
    assert not root.execute("SELECT has_schema_privilege('research_stage_i_writer',"
       "'research_ordering_stage_h','USAGE')").fetchone()[0]
    for r in ("anon","authenticated","service_role","research_stage_i_writer",
              "research_stage_j_writer","research_stage_k_gateway"):
        assert not root.execute("SELECT has_schema_privilege(%s,'research_ordering_stage_m','USAGE')",
               (r,)).fetchone()[0]
    assert snapshot(root,acc)==orig

with db() as retired:
    retired.execute("SET ROLE research_stage_i_writer")
    denied(retired,H_CALL,("subscription_payment_success:120","b"*64,"v1","v2","4"*64))
    retired.execute("RESET ROLE")
with remote() as gateway:
    denied(gateway,H_CALL,("subscription_payment_success:120","b"*64,"v1","v2","4"*64))
    denied(gateway,"SELECT * FROM research_ordering_stage_m.legacy_receipt_links")
    denied(gateway,"DELETE FROM research_ordering_stage_m.legacy_receipt_links")
    next=gateway.execute(K_CALL,kargs(event="subscription_payment_recovered",delivery="b"*64)).fetchone()[0]
    assert next["action"]=="duplicate_invoice_held"
    assert next["can_mutate"] is False

with db() as root:
    assert root.execute("SELECT count(*) FROM research_ordering_stage_h.pending_receipts").fetchone()[0]==2
    assert root.execute("SELECT count(*) FROM research_ordering_stage_j.invoice_receipts").fetchone()[0]==1
    assert root.execute("SELECT count(*) FROM research_ordering_stage_k.provider_observations").fetchone()[0]==2
    assert root.execute("SELECT count(*) FROM research_ordering_stage_m.legacy_receipt_links").fetchone()[0]==1
    assert snapshot(root,acc)==orig
    print("STAGE_M_J1_PASS exact legacy history linked, H/I ordinary writer retired, one J/K canonical pending invoice",flush=True)

with db() as owner:
    owner.execute("SET ROLE research_stage_m_owner")
    for sql in (
        "UPDATE research_ordering_stage_m.legacy_receipt_links SET disposition='legacy_historical_only'",
        "DELETE FROM research_ordering_stage_m.legacy_receipt_links",
        "TRUNCATE research_ordering_stage_m.legacy_receipt_links",
    ):denied(owner,sql)
    owner.execute("RESET ROLE")

with db() as root:
    base=("lemon-squeezy","41",True,"118","217","1"*64,"2"*64)
    digest=root.execute(DIGEST,base).fetchone()[0]
    assert digest==GOLDEN,(digest,GOLDEN)
    for idx,sub in [(2,False),(3,"119"),(4,"218"),(5,"3"*64),(6,"4"*64)]:
        altered=list(base);altered[idx]=sub
        assert root.execute(DIGEST,tuple(altered)).fetchone()[0]!=GOLDEN,(idx,sub)
    for altered in (
      ("other",*base[1:]),
      ("lemon-squeezy","041",*base[2:]),
      ("lemon-squeezy","41",True,"0",*base[4:]),
      ("lemon-squeezy","41",True,"118","bad",*base[5:]),
      ("lemon-squeezy","41",True,"118","217","Z"*64,base[6]),
    ):
        denied(root,DIGEST,altered,states=("22023",))
    assert snapshot(root,acc)==orig
    print("STAGE_M_J4_PASS PostgreSQL SHA256 golden matches JS canonical envelope and fails closed on changes",flush=True)

print("RESEARCH_STAGE_M_PG17_ARCHIVE_AND_DIGEST_REVIEW_PASS; no connected DB, settlement, entitlement or release action",flush=True)
