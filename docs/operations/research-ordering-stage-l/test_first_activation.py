#!/usr/bin/env python3
"""Stage L F1 first-activation design only; no connected Supabase or payment."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import os
import sys
import threading
import psycopg

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/"docs"/"operations"/"research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap,db,seed

for name in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
             "LEMON_SQUEEZY_API_KEY","LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(name), f"live DB or merchant credential forbidden: {name}"
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD"))==(
 "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")
E_SQL=ROOT/"docs"/"operations"/"research-ordering-stage-e"/"segmented_caller_review.sql"
F_SQL=ROOT/"docs"/"operations"/"research-ordering-stage-f"/"strict_witness_review.sql"
L_SQL=HERE/"first_activation_review.sql"
F_SIGNATURE=("uuid,uuid,text,text,text,text,text,text,text,text,text,text,"
             "timestamptz,public.subscription_state,timestamptz,timestamptz")
F_CALL="SELECT research_ordering_stage_f.apply_strict_review("+",".join(["%s"]*16)+")"
L_CALL="SELECT research_ordering_stage_l.apply_lifecycle_review("+",".join(["%s"]*16)+")"
FIRST_INSERT="""INSERT INTO research_ordering_stage_l.verified_first_activation(
 event_key,subscription_id,account_id,provider,provider_subscription_id,provider_customer_id,
 store_id,variant_id,binding_fingerprint,provider_event_id,event_fingerprint,source_type,
 snapshot_object_at,target_state,target_period_start,target_period_end,expected_subscription_version,
 expected_entitlement_absent,checkout_intent_id,invoice_id,invoice_snapshot_digest,
 issued_quote_digest,billing_reason,provider_snapshot_version,evidence_authority)
 VALUES ("""+",".join(["%s"]*25)+")"
F_INSERT="""INSERT INTO research_ordering_stage_f.verified_transition(
 event_key,subscription_id,account_id,provider,provider_event_id,
 provider_subscription_id,provider_customer_id,store_id,variant_id,
 binding_fingerprint,event_fingerprint,source_type,snapshot_object_at,
 target_state,target_period_start,target_period_end,
 expected_subscription_version,expected_entitlement_version,provider_snapshot_version)
 VALUES ("""+",".join(["%s"]*19)+")"
FP="f"*64
START="2026-11-05T00:00:00+00:00"
END="2026-12-05T00:00:00+00:00"
CLOCK="2026-11-05T01:02:04+00:00"

def actor(name):
    return psycopg.connect(host="127.0.0.1",port=5432,dbname="ci_review",
       user=name,password="synthetic-stage-e-"+("gateway-only" if name.endswith("gateway") else "verifier-only"),
       connect_timeout=5,autocommit=True)
def args(account,sid,index,key, *,state="active",start=START,end=END,clock=CLOCK,kind="subscriptions"):
    return (sid,account,"lemon-squeezy",str(1000+index),"78","41","313",FP,
            key,key,hashlib.sha256(key.encode()).hexdigest(),kind,clock,state,start,end)
def witness_initial(a,version=1,intent="synthetic-b5-issued-intent"):
    sid,acc,provider,psub,customer,store,variant,binding,key,event,fingerprint,kind,clock,state,start,end=a
    return (key,sid,acc,provider,psub,customer,store,variant,binding,event,fingerprint,kind,
       clock,state,start,end,version,True,intent,"118","a"*64,"b"*64,
       "initial","synthetic-current-subscription-v1","synthetic_not_provider_authoritative")
def witness_renew(a,sub_version,ent_version):
    sid,acc,provider,psub,customer,store,variant,binding,key,event,fingerprint,kind,clock,state,start,end=a
    return (key,sid,acc,provider,event,psub,customer,store,variant,binding,fingerprint,kind,
       clock,state,start,end,sub_version,ent_version,"synthetic-renewal-snapshot-v1")
def denied(c,sql,params=None,expected=("42501",)):
    try:c.execute(sql,params)
    except psycopg.Error as ex:
        assert ex.sqlstate in expected,(ex.sqlstate,str(ex),sql)
        return ex.sqlstate
    raise AssertionError("unexpected success for "+sql)
def receipt(c,sid):
    return c.execute("SELECT state::text,version,current_period_start,current_period_end "
        "FROM public.subscriptions WHERE id=%s",(sid,)).fetchone()
def entitlements(c,account):
    return c.execute("SELECT product_id,state::text,subscription_id,purchase_id,version "
         "FROM public.entitlements WHERE account_id=%s ORDER BY product_id",(account,)).fetchall()
def purchase_fixture(c,account):
    return (
       c.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(account,)).fetchall(),
       c.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
         "WHERE account_id=%s AND purchase_id IS NOT NULL",(account,)).fetchall(),
    )

with db() as root:
    assert root.execute("SHOW server_version_num").fetchone()[0]=="170006"
    bootstrap(root)
    acc,sid,_=seed(root,39,state="pending",watermark=None,library=True)
    race_acc,race_sid,_=seed(root,40,state="pending",watermark=None,library=True)
    renewal_acc,renewal_sid,_=seed(root,41,state="active",library=True)
    for subject in (sid,race_sid):
        root.execute("DELETE FROM public.entitlements WHERE subscription_id=%s",(subject,))
        root.execute("UPDATE public.subscriptions SET current_period_start=NULL,"
          "current_period_end=NULL WHERE id=%s",(subject,))
    initial_library=purchase_fixture(root,acc)
    race_library=purchase_fixture(root,race_acc)
    renewal_library=purchase_fixture(root,renewal_acc)
    assert [x[0] for x in entitlements(root,acc)]==[
      "read-the-dollar-first-guided-interactive-edition"]
    root.execute(E_SQL.read_text("utf8"))
    root.execute(F_SQL.read_text("utf8"))

# RED: Stage F strict witness does not recognize a missing entitlement at all.
red=args(acc,sid,39,"synthetic-stage-l-red")
with actor("research_e_gateway") as gateway:
    assert denied(gateway,F_CALL,red,expected=("P0002",))=="P0002"
with db() as root:
    assert [x[0] for x in entitlements(root,acc)]==[
      "read-the-dollar-first-guided-interactive-edition"]
    print("STAGE_L_RED_PASS Stage F missing entitlement raises untyped P0002 (no writes)",flush=True)
    root.execute(L_SQL.read_text("utf8"))
    assert root.execute("SELECT has_function_privilege('research_e_gateway',%s,'EXECUTE')",
       ("research_ordering_stage_l.apply_lifecycle_review("+F_SIGNATURE+")",)).fetchone()[0]
    assert not root.execute("SELECT has_function_privilege('research_e_gateway',%s,'EXECUTE')",
       ("research_ordering_stage_f.apply_strict_review("+F_SIGNATURE+")",)).fetchone()[0]
    assert not root.execute("SELECT has_function_privilege('service_role',%s,'EXECUTE')",
       ("research_ordering_stage_l.apply_lifecycle_review("+F_SIGNATURE+")",)).fetchone()[0]

a=args(acc,sid,39,"synthetic-stage-l-first")
with actor("research_e_gateway") as gateway:
    denied(gateway,F_CALL,a)
    denied(gateway,FIRST_INSERT,witness_initial(a))
    denied(gateway,L_CALL,a) # no signed synthetic witness
    for changed in (
       args(acc,sid,39,"synthetic-stage-l-missing",state="past_due"),
       args(acc,sid,39,"synthetic-stage-l-missing",kind="subscription-invoices"),
    ):denied(gateway,L_CALL,changed)

with actor("research_e_verifier") as verifier:
    denied(verifier,L_CALL,a)
    verifier.execute(FIRST_INSERT,witness_initial(a))
with actor("research_e_gateway") as gateway:
    for altered in (
       args(acc,sid,39,"synthetic-stage-l-first",state="past_due"),
       args(acc,sid,39,"synthetic-stage-l-first",end="2035-01-01T00:00:00+00:00"),
       args(acc,sid,39,"synthetic-stage-l-first",start="2026-10-01T00:00:00+00:00"),
       args(acc,sid,39,"synthetic-stage-l-first",kind="subscription-invoices"),
       args(acc,sid,39,"synthetic-stage-l-first",clock="2026-11-05T01:02:05+00:00"),
    ):denied(gateway,L_CALL,altered)
    applied=gateway.execute(L_CALL,a).fetchone()[0]
    duplicate=gateway.execute(L_CALL,a).fetchone()[0]
    assert applied["action"]=="synthetic_first_activation_applied"
    assert applied["live_can_mutate"] is False and applied["provider_paid_cycle_authoritative"] is False
    assert duplicate["action"]=="synthetic_duplicate" and duplicate["live_can_mutate"] is False
with db() as root:
    assert root.execute("SELECT COUNT(*) FROM public.entitlements WHERE account_id=%s "
                        "AND product_id='research-membership'",(acc,)).fetchone()[0]==1
    assert receipt(root,sid)[0:2]==("active",2)
    assert root.execute("SELECT COUNT(*) FROM public.subscription_events WHERE account_id=%s",(acc,)).fetchone()[0]==1
    assert root.execute("SELECT COUNT(*) FROM public.entitlement_events WHERE account_id=%s",(acc,)).fetchone()[0]==1
    assert purchase_fixture(root,acc)==initial_library
    assert root.execute("SELECT COUNT(*) FROM research_ordering_stage_c.delivery_audit "
                        "WHERE subscription_id=%s",(sid,)).fetchone()[0]==1
    print("STAGE_L_F1_PASS pending subscription with zero Research entitlements creates EXACTLY ONE in disposable PG and preserves Library Pass",flush=True)

# Two verified independent events both carry one eligible synthetic initial
# witness against version 1. Only one can win, the other must be typed 42501.
r1=args(race_acc,race_sid,40,"synthetic-stage-l-concurrent-a",clock="2026-11-05T01:02:08+00:00")
r2=args(race_acc,race_sid,40,"synthetic-stage-l-concurrent-b",clock="2026-11-05T01:02:09+00:00")
with actor("research_e_verifier") as verifier:
    verifier.execute(FIRST_INSERT,witness_initial(r1))
    verifier.execute(FIRST_INSERT,witness_initial(r2))
barrier=threading.Barrier(2)
def race_worker(p):
    with actor("research_e_gateway") as gateway:
        barrier.wait(timeout=12)
        try:
            result=gateway.execute(L_CALL,p).fetchone()[0]
            return ("applied",result["action"])
        except psycopg.Error as ex:
            return ("denied",ex.sqlstate)
with ThreadPoolExecutor(max_workers=2) as pool:
    xs=[pool.submit(race_worker,p) for p in (r1,r2)]
    outcome=sorted(f.result(timeout=25) for f in xs)
assert outcome==[("applied","synthetic_first_activation_applied"),("denied","42501")],outcome
with db() as root:
    assert root.execute("SELECT COUNT(*) FROM public.entitlements WHERE account_id=%s "
                        "AND product_id='research-membership'",(race_acc,)).fetchone()[0]==1
    assert root.execute("SELECT COUNT(*) FROM public.subscription_events WHERE account_id=%s",(race_acc,)).fetchone()[0]==1
    assert purchase_fixture(root,race_acc)==race_library
    print("STAGE_L_RACE_PASS two real gateways, one first entitlement and one typed stale-witness denial",flush=True)

# An existing Research entitlement must keep using the Stage F
# effect-bound witness and version fence through the SINGLE new gateway.
renew=args(renewal_acc,renewal_sid,41,"synthetic-stage-l-renewal",end="2027-01-05T00:00:00+00:00")
with db() as root:
    vsub=root.execute("SELECT version FROM public.subscriptions WHERE id=%s",(renewal_sid,)).fetchone()[0]
    vent=root.execute("SELECT version FROM public.entitlements WHERE subscription_id=%s",(renewal_sid,)).fetchone()[0]
with actor("research_e_verifier") as verifier:
    verifier.execute(F_INSERT,witness_renew(renew,vsub,vent))
with actor("research_e_gateway") as gateway:
    good=gateway.execute(L_CALL,renew).fetchone()[0]
    assert good["action"]=="applied"
    same=gateway.execute(L_CALL,renew).fetchone()[0]
    assert same["action"]=="duplicate" and same["can_mutate"] is False
with db() as root:
    assert receipt(root,renewal_sid)[0:2]==("active",2)
    assert root.execute("SELECT version FROM public.entitlements WHERE subscription_id=%s",
          (renewal_sid,)).fetchone()[0]==2
    assert purchase_fixture(root,renewal_acc)==renewal_library
    assert root.execute("SELECT has_table_privilege('service_role','public.entitlements','UPDATE')").fetchone()[0]
    print("STAGE_L_RENEWAL_PASS Stage F effect-bound renewal unchanged behind one gateway; live legacy service_role P1 still OPEN",flush=True)

print("RESEARCH_STAGE_L_FIRST_ACTIVATION_REVIEW_PASS isolated synthetic F1, strict denial, one entitlement, two-backend race and renewal parity; NO real provider settlement",flush=True)
