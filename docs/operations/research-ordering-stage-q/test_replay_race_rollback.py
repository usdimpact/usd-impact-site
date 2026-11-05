#!/usr/bin/env python3
"""Stage Q: actual Stage P locked gateway two-backend race and transaction rollback.

Runs Stage P's real pinned B5 / historical Research PG17 harness first, then
adds a second synthetic test-mode checkout. This is NOT independent review,
merchant settlement, live activation, a Production migration or an RPC grant.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import os
import runpy
import threading
import uuid

import psycopg

ROOT = Path(__file__).resolve().parents[3]
for key in (
    "DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY","LEMON_SQUEEZY_API_KEY",
    "LEMON_SQUEEZY_WEBHOOK_SECRET","LEMON_SQUEEZY_STORE_ID"
):
    assert not os.getenv(key), "connected credential forbidden: "+key
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),
        os.getenv("PGPASSWORD")) == (
    "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")
P = ROOT/"docs/operations/research-ordering-stage-p/test_strict_evidence.py"
assert P.is_file()
# Runs all Stage P source-negative and synthetic-live-HOLD tests and leaves
# their isolated database and reusable review-only helper objects available.
env = runpy.run_path(str(P))
db=env["db"]
as_role=env["as_role"]
denied=env["denied"]
denied_role=env["denied_role"]
count=env["count"]
ISSUE,ATTACH,OBSERVE,BIND=(
    env["ISSUE"],env["ATTACH"],env["OBSERVE"],env["BIND"])
K_CALL,W_INSERT,N_CALL,HANDOFF=(
    env["K_CALL"],env["W_INSERT"],env["N_CALL"],env["HANDOFF"])
STORE,VARIANT,FP,START,END=(
    env["STORE"],env["VARIANT"],env["FP"],env["START"],env["END"])
signed=env["signed"]
ACC=uuid.UUID("88888888-8888-4888-8888-000000000053")
PSUB="223"
CUSTOMER="83"
INVOICE="122"
PAID_RAW="d"*64
FINGERPRINT="a"*64
INVOICE_SHA="1"*64
QUOTE_SHA="2"*64
FIRST_KEY="stage-q-race-first-53"
SECOND_KEY="stage-q-race-second-53"
FIRST_CLOCK="2026-11-05T01:13:08+00:00"
SECOND_CLOCK="2026-11-05T01:13:09+00:00"
audit_before=None

def snapshot(c):
    return (
      c.execute("SELECT count(*) FROM public.entitlements WHERE "
                "account_id=%s AND product_id='research-membership'",(ACC,)).fetchone()[0],
      c.execute("SELECT count(*) FROM public.subscription_events WHERE "
                "account_id=%s",(ACC,)).fetchone()[0],
      c.execute("SELECT count(*) FROM public.entitlement_events WHERE "
                "account_id=%s",(ACC,)).fetchone()[0],
      c.execute("SELECT count(*) FROM research_ordering_stage_c.delivery_audit "
                "WHERE subscription_id=%s",(SID,)).fetchone()[0],
      c.execute("SELECT state::text,version FROM public.subscriptions "
                "WHERE id=%s",(SID,)).fetchone(),
    )

with db() as admin:
    assert admin.execute("SHOW server_version_num").fetchone()[0]=="170006"
    admin.execute("INSERT INTO auth.users(id,email) VALUES(%s,%s)",
      (ACC,"stage-q-race@invalid.example"))
    admin.execute("""INSERT INTO public.purchases(
      account_id,product_id,provider,provider_transaction_id,status,
      amount_cents,currency,price_tier,offer_terms,completed_at)
      VALUES(%s,'read-the-dollar-first-guided-interactive-edition',
      'review-provider','synthetic-q-lp-53','completed',3900,'USD',
      'launch','{}','2026-09-01T00:00:00Z') RETURNING id""",(ACC,))
    purchase=admin.execute("SELECT id FROM public.purchases WHERE account_id=%s",
                           (ACC,)).fetchone()[0]
    admin.execute("""INSERT INTO public.entitlements(
      account_id,purchase_id,product_id,state,starts_at)
      VALUES(%s,%s,'read-the-dollar-first-guided-interactive-edition',
      'active',%s)""",(ACC,purchase,START))
    lp_original = (
      admin.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                    "WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
      admin.execute("SELECT row_to_json(p)::text FROM public.purchases p "
                    "WHERE account_id=%s",(ACC,)).fetchall(),
    )
    assert count(admin,"public.entitlements",
      "account_id=%s AND product_id='research-membership'",(ACC,))==0

with db() as checkout:
    issued=as_role(checkout,"review_checkout_issuer",ISSUE,(
        ACC,"research-membership",STORE,VARIANT,"monthly",True,"stage-q-issued-53"))
    assert issued["action"]=="reserved",issued
    intent_id=issued["intent_id"]
    proof=issued["checkout_key"]
    attached=as_role(checkout,"review_checkout_issuer",ATTACH,
      (intent_id,proof,"synthetic-stage-q-provider-checkout"))
    assert attached["action"]=="attached",attached
    paid_time=checkout.execute(
       "SELECT created_at FROM research_checkout_guard.checkout_intents "
       "WHERE id=%s",(intent_id,)).fetchone()[0]
    paid=as_role(checkout,"review_checkout_verifier",OBSERVE,(
      "lemon-squeezy",PSUB,CUSTOMER,STORE,"research-membership",
      VARIANT,True,paid_time,PAID_RAW,ACC,signed(proof),
      "research-receipt-business-v3",FP))
    assert paid["action"]=="recorded",paid
    bound=as_role(checkout,"review_checkout_binder",BIND,(
      ACC,"lemon-squeezy",PSUB,CUSTOMER,VARIANT,"monthly",
      paid_time,proof,PAID_RAW,STORE,"research-membership",True,
      "research-receipt-business-v3",FP))
    assert bound["action"]=="created" and bound["subscription_state"]=="pending",bound
    SID=bound["subscription_id"]
    assert checkout.execute(
      "SELECT state,provider_subscription_id FROM "
      "research_checkout_guard.checkout_intents WHERE id=%s",
      (intent_id,)).fetchone()==("consumed",PSUB)
    assert snapshot(checkout)==(0,0,0,0,("pending",1))

with db() as receipt:
    observed=as_role(receipt,"research_stage_k_gateway",K_CALL,(
      "lemon-squeezy",STORE,True,PSUB,INVOICE,
      "subscription_payment_success",FINGERPRINT,INVOICE_SHA,
      "invoice-v1","subscription-v1",QUOTE_SHA))
    assert observed["action"]=="first_invoice_held" and observed["can_mutate"] is False

canon="m1|lemon-squeezy|41|test|"+INVOICE+"|"+PSUB+"|"+INVOICE_SHA+"|"+QUOTE_SHA
canonical_digest=hashlib.sha256(canon.encode("utf8")).hexdigest()
def make_args(event_key,when):
    return (SID,ACC,"lemon-squeezy",PSUB,CUSTOMER,STORE,VARIANT,FP,
            event_key,event_key,signed(event_key),
            "subscriptions",when,"active",START,END)

FIRST=make_args(FIRST_KEY,FIRST_CLOCK)
SECOND=make_args(SECOND_KEY,SECOND_CLOCK)
with db() as verifier:
    verifier.execute("SET ROLE research_e_verifier")
    for args in (FIRST,SECOND):
        event_key=args[8]
        verifier.execute(W_INSERT,(
          event_key,SID,ACC,"lemon-squeezy",PSUB,CUSTOMER,STORE,VARIANT,FP,
          event_key,signed(event_key),"subscriptions",args[12],"active",START,END,
          1,True,str(intent_id),INVOICE,INVOICE_SHA,QUOTE_SHA,
          "initial","synthetic-stage-q-v1","synthetic_not_provider_authoritative"))
        verifier.execute(HANDOFF,(
          event_key,ACC,PSUB,INVOICE,True,
          INVOICE_SHA,QUOTE_SHA,canonical_digest))
    verifier.execute("RESET ROLE")

with db() as check:
    assert snapshot(check)==(0,0,0,0,("pending",1))
    assert count(check,"research_ordering_stage_p.verified_handoffs",
       "account_id=%s",(ACC,))==2
    assert check.execute(
      "SELECT research_ordering_stage_m.invoice_handoff_digest_v1("
      "%s,%s,%s,%s,%s,%s,%s)",(
      "lemon-squeezy",STORE,True,INVOICE,PSUB,
      INVOICE_SHA,QUOTE_SHA)).fetchone()[0]==canonical_digest

# A legitimate-looking synthetic first activation *inside an uncommitted
# transaction* must not survive a subsequent exception from a downstream
# local step. No remote provider settlement is involved.
with db(autocommit=False) as tx:
    tx.execute("SET LOCAL ROLE research_e_gateway")
    provisional=tx.execute(N_CALL,FIRST).fetchone()[0]
    assert provisional["action"]=="synthetic_first_activation_applied",provisional
    assert provisional["can_mutate"] is False and provisional["live_can_mutate"] is False
    tx.execute("RESET ROLE")
    assert snapshot(tx)==(1,1,1,1,("active",2))
    try:
        tx.execute("""DO $q$ BEGIN
          RAISE EXCEPTION 'Stage Q synthetic post-effect failure'
          USING ERRCODE='P0001';
        END $q$;""")
        raise AssertionError("fault injection did not abort")
    except psycopg.Error as exc:
        assert exc.sqlstate=="P0001",exc.sqlstate
    tx.rollback()

with db() as check:
    assert snapshot(check)==(0,0,0,0,("pending",1))
    assert check.execute(
      "SELECT count(*) FROM research_ordering_stage_p.verified_handoffs "
      "WHERE account_id=%s",(ACC,)).fetchone()[0]==2
    assert check.execute(
      "SELECT state FROM research_checkout_guard.checkout_intents "
      "WHERE id=%s",(intent_id,)).fetchone()[0]=="consumed"
    assert (
      check.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                    "WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
      check.execute("SELECT row_to_json(p)::text FROM public.purchases p "
                    "WHERE account_id=%s",(ACC,)).fetchall(),
    )==lp_original
print("STAGE_Q_ATOMIC_ROLLBACK_PASS provisional synthetic entitlement, events and audit all rolled back; B5/J/K/LP preserved",flush=True)

# The real restricted gateway connections race on the *same pending
# subscription* but present two separately verifier-inserted event witnesses.
# Exactly one first-activation transaction may win; the competing stale
# event must fail closed with SQLSTATE 42501, not cause a duplicate grant.
barrier=threading.Barrier(2)
def worker(args):
    with db() as connection:
        connection.execute("SET ROLE research_e_gateway")
        connection.execute("SET statement_timeout='8s'")
        connection.execute("SET lock_timeout='6s'")
        barrier.wait(timeout=15)
        try:
            receipt=connection.execute(N_CALL,args).fetchone()[0]
            return ("applied",args[8],receipt["action"],receipt["can_mutate"],
                    receipt["live_can_mutate"])
        except psycopg.Error as exc:
            return ("denied",args[8],exc.sqlstate)

with ThreadPoolExecutor(max_workers=2) as pool:
    xs=[pool.submit(worker,arg) for arg in (FIRST,SECOND)]
    outcomes=[x.result(timeout=35) for x in xs]

wins=[x for x in outcomes if x[0]=="applied"]
denials=[x for x in outcomes if x[0]=="denied"]
assert len(wins)==1 and len(denials)==1,outcomes
assert wins[0][2]=="synthetic_first_activation_applied" and wins[0][3:] == (False,False),wins
assert denials[0][2]=="42501",denials
winning_key=wins[0][1]
losing_key=denials[0][1]
with db() as check:
    assert snapshot(check)==(1,1,1,1,("active",2))
    assert check.execute(
      "SELECT event_key FROM public.subscription_events WHERE account_id=%s",
      (ACC,)).fetchone()[0]==winning_key
    assert check.execute(
      "SELECT count(*) FROM research_ordering_stage_c.delivery_audit "
      "WHERE event_key=%s",(losing_key,)).fetchone()[0]==0
    assert (
      check.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                    "WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
      check.execute("SELECT row_to_json(p)::text FROM public.purchases p "
                    "WHERE account_id=%s",(ACC,)).fetchall(),
    )==lp_original
print("STAGE_Q_TWO_BACKEND_RACE_PASS one synthetic gateway first-activation, competing independent witness 42501, exact one effect and LP parity",flush=True)

with db() as gateway:
    winner=FIRST if winning_key==FIRST_KEY else SECOND
    loser=SECOND if winning_key==FIRST_KEY else FIRST
    repeated=as_role(gateway,"research_e_gateway",N_CALL,winner)
    assert repeated["action"]=="synthetic_duplicate",repeated
    assert repeated["can_mutate"] is False and repeated["live_can_mutate"] is False
    denied_role(gateway,"research_e_gateway",N_CALL,loser)
with db() as check:
    assert snapshot(check)==(1,1,1,1,("active",2))
    assert check.execute(
       "SELECT count(*) FROM research_checkout_guard.conflict_evidence "
       "WHERE provider_subscription_id=%s",(PSUB,)).fetchone()[0]==0
print("STAGE_Q_REPLAY_PASS winning event is nonmutating duplicate; losing event still denied; no second entitlement or events",flush=True)
print("RESEARCH_STAGE_Q_SYNTHETIC_REPLAY_RACE_ROLLBACK_PASS; "
      "independent D2-26 still pending, R1/R2 settlement and Production NO-GO",flush=True)
