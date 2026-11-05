#!/usr/bin/env python3
"""Stage N actual pinned B5 M1_strict + J/K/L locked integration, disposable PG17.6 only."""
import hashlib,os,sys,uuid
from pathlib import Path
import psycopg

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/"docs"/"operations"/"research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap,db
for k in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL","LEMON_SQUEEZY_API_KEY",
          "LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(k),f"forbidden linked-provider/DB environment: {k}"
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD"))==(
  "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")

B5=HERE/"b5_m1_strict_pinned_review_only.sql"
SRC_SHA="e936e18f1ed78743e77d2b158e562af07b0aedcd62d85efed08ab95244b2ea74"
PATHS=[ROOT/"docs"/"operations"/f"research-ordering-stage-{name}"/path for name,path in [
 ("e","segmented_caller_review.sql"),("f","strict_witness_review.sql"),
 ("h","receipt_journal_review.sql"),("i","journal_hardening_review.sql"),
 ("j","invoice_journal_review.sql"),("k","conflict_observation_review.sql"),
 ("l","first_activation_review.sql"),("m","canonical_bridge_review.sql"),
 ("n","locked_first_purchase_review.sql")
]]
CALL_N="SELECT research_ordering_stage_n.apply_b5_bound_lifecycle_review("+",".join(["%s"]*16)+")"
CALL_L="SELECT research_ordering_stage_l.apply_lifecycle_review("+",".join(["%s"]*16)+")"
ISSUE="SELECT public.issue_research_membership_checkout_intent(%s,%s,%s,%s,%s,%s,%s)"
ATTACH="SELECT public.attach_research_membership_checkout_intent(%s,%s,%s)"
OBSERVE="SELECT public.observe_signed_research_subscription_created("+",".join(["%s"]*13)+")"
BIND="SELECT public.bind_research_membership_with_checkout_intent("+",".join(["%s"]*14)+")"
K_CALL="SELECT research_ordering_stage_k.hold_observation("+",".join(["%s"]*11)+")"
W_INSERT="INSERT INTO research_ordering_stage_l.verified_first_activation(" + (
 "event_key,subscription_id,account_id,provider,provider_subscription_id,provider_customer_id,"
 "store_id,variant_id,binding_fingerprint,provider_event_id,event_fingerprint,source_type,"
 "snapshot_object_at,target_state,target_period_start,target_period_end,expected_subscription_version,"
 "expected_entitlement_absent,checkout_intent_id,invoice_id,invoice_snapshot_digest,"
 "issued_quote_digest,billing_reason,provider_snapshot_version,evidence_authority"
 )+") VALUES ("+",".join(["%s"]*25)+")"
RENEW_INSERT="INSERT INTO research_ordering_stage_f.verified_transition(" + (
 "event_key,subscription_id,account_id,provider,provider_event_id,provider_subscription_id,"
 "provider_customer_id,store_id,variant_id,binding_fingerprint,event_fingerprint,source_type,"
 "snapshot_object_at,target_state,target_period_start,target_period_end,"
 "expected_subscription_version,expected_entitlement_version,provider_snapshot_version"
 )+") VALUES ("+",".join(["%s"]*19)+")"
ACC=uuid.UUID("88888888-8888-4888-8888-000000000041")
CUSTOMER="78"; STORE="41"; VARIANT="313"; PSUB="217"
FP="f"*64; SNAP="1"*64; QUOTE="2"*64
START="2026-11-05T00:00:00+00:00"
END="2026-12-05T00:00:00+00:00"
NEXT="2027-01-05T00:00:00+00:00"
KEY="synthetic-stage-n-first-41"
EVENT_FP=hashlib.sha256(KEY.encode()).hexdigest()

def sha(b):return hashlib.sha256(b.encode()).hexdigest()
def denied(c,query,args=(),states=("42501",)):
    try:c.execute(query,args)
    except psycopg.Error as e:
        assert e.sqlstate in states,(e.sqlstate,str(e),query)
        return
    raise AssertionError("UNSAFE: operation allowed: "+query)
def as_role(c,role,sql,args=()):
    c.execute("SET ROLE "+role)
    try:return c.execute(sql,args).fetchone()[0]
    finally:c.execute("RESET ROLE")
def args(account,sid,key=KEY,variant=VARIANT,begin=START,end=END,when="2026-11-05T01:03:08+00:00",state="active"):
    return (sid,account,"lemon-squeezy",PSUB,CUSTOMER,STORE,variant,FP,
            key,key,sha(key),"subscriptions",when,state,begin,end)
def wargs(a,intent_id,invoice="118",digest=SNAP,quote=QUOTE):
    sid,acc,provider,psub,customer,store,variant,binding,key,event,fingerprint,kind,clock,state,start,end=a
    return (key,sid,acc,provider,psub,customer,store,variant,binding,event,fingerprint,kind,
           clock,state,start,end,1,True,str(intent_id),invoice,digest,quote,
           "initial","synthetic-stable-v1","synthetic_not_provider_authoritative")
def ent(c,a):
    return c.execute("SELECT product_id,state::text,purchase_id,subscription_id "
                     "FROM public.entitlements WHERE account_id=%s ORDER BY product_id",(a,)).fetchall()
def count(c,t,where="",params=()):
    return c.execute("SELECT COUNT(*) FROM "+t+(" WHERE "+where if where else ""),params).fetchone()[0]
def snapshot(c,a,sid):
    return (c.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(a,)).fetchall(),
            c.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(a,)).fetchall(),
            c.execute("SELECT row_to_json(s)::text FROM public.subscriptions s WHERE id=%s",(sid,)).fetchall(),
            c.execute("SELECT COUNT(*) FROM public.subscription_events WHERE subscription_id=%s",(sid,)).fetchone()[0])
def role_denied(c,role,sql,params=(),states=("42501",)):
    c.execute("SET ROLE "+role)
    try:denied(c,sql,params,states)
    finally:c.execute("RESET ROLE")

assert B5.is_file()
assert hashlib.sha256(B5.read_bytes()).hexdigest()==SRC_SHA,"Original B5 M1 fixture has changed"
with db() as root:
    assert root.execute("SHOW server_version_num").fetchone()[0]=="170006"
    root.execute("CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions")
    bootstrap(root)
    root.execute("""CREATE ROLE postgres LOGIN CREATEROLE BYPASSRLS NOSUPERUSER;
                  CREATE ROLE authenticator NOLOGIN NOINHERIT;
                  GRANT USAGE ON SCHEMA auth,extensions TO postgres;""")
    root.execute(B5.read_text("utf8"))
    root.execute("INSERT INTO research_checkout_guard.allowed_variants"
                 "(store_id,product_id,variant_id,billing_interval,test_mode)"
                 " VALUES ('41','research-membership','313','monthly',true)")
    root.execute("INSERT INTO auth.users(id,email) VALUES(%s,%s)",
                 (ACC,"stage-n-test@invalid.example"))
    root.execute("INSERT INTO public.profiles(account_id,email) VALUES(%s,%s)",
                 (ACC,"stage-n-test@invalid.example"))
    issuer=as_role(root,"review_checkout_issuer",ISSUE,
      (ACC,"research-membership",STORE,VARIANT,"monthly",True,"synthetic-stage-n-request"))
    assert issuer["action"]=="reserved",issuer
    intent_id=issuer["intent_id"]
    checkout_key=issuer["checkout_key"]
    attached=as_role(root,"review_checkout_issuer",ATTACH,
                     (intent_id,checkout_key,"checkout-stage-n-41"))
    assert attached["action"]=="attached",attached
    paid_at=root.execute("SELECT created_at + interval '5 seconds' FROM "
                 "research_checkout_guard.checkout_intents WHERE id=%s",(intent_id,)).fetchone()[0]
    observed=as_role(root,"review_checkout_verifier",OBSERVE,
     ("lemon-squeezy",PSUB,CUSTOMER,STORE,"research-membership",VARIANT,True,
      paid_at,"a"*64,ACC,sha(checkout_key),"research-receipt-business-v3",FP))
    assert observed["action"]=="recorded",observed
    bound=as_role(root,"review_checkout_binder",BIND,
      (ACC,"lemon-squeezy",PSUB,CUSTOMER,VARIANT,"monthly",paid_at,
       checkout_key,"a"*64,STORE,"research-membership",True,"research-receipt-business-v3",FP))
    assert bound["action"]=="created" and bound["subscription_state"]=="pending",bound
    SID=bound["subscription_id"]
    assert root.execute("SELECT state,provider_subscription_id FROM research_checkout_guard.checkout_intents "
             "WHERE id=%s",(intent_id,)).fetchone()==("consumed",PSUB)
    assert count(root,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==0
    # Stage C/E/F/L legacy synthetic contract relies on local trusted binding.
    # The real B5 pending subscription does not provide one. Attach ONLY in this
    # disposable fixture, never pretend it came from an authenticated provider.
    root.execute("UPDATE public.subscriptions SET metadata=jsonb_build_object("
       "'review_store_id',%s::text,'review_variant_id',%s::text,"
       "'review_binding_fingerprint',%s::text) WHERE id=%s",(STORE,VARIANT,FP,SID))
    root.execute("""INSERT INTO public.purchases(
       account_id,product_id,provider,provider_transaction_id,status,amount_cents,
       currency,price_tier,offer_terms,completed_at)
       VALUES (%s,'read-the-dollar-first-guided-interactive-edition',
       'review-provider','synthetic-one-time-n-41','completed',3900,
       'USD','launch','{}','2026-09-01T00:00:00Z') RETURNING id""",(ACC,))
    purchase=root.execute("SELECT id FROM public.purchases WHERE account_id=%s",(ACC,)).fetchone()[0]
    root.execute("INSERT INTO public.entitlements(account_id,purchase_id,product_id,state,starts_at) "
      "VALUES(%s,%s,'read-the-dollar-first-guided-interactive-edition','active',%s)",
       (ACC,purchase,START))
    lib_before=(
       root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(ACC,)).fetchall(),
       root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall())
    for p in PATHS[:-1]:
        assert p.is_file(),p
        root.execute(p.read_text("utf8"))

with db() as root:
    root.execute(PATHS[-1].read_text("utf8"))
    assert root.execute("SELECT has_function_privilege('research_e_gateway',%s,'EXECUTE')",
      ("research_ordering_stage_n.apply_b5_bound_lifecycle_review("
       "uuid,uuid,text,text,text,text,text,text,text,text,text,text,"
       "timestamptz,public.subscription_state,timestamptz,timestamptz)",)
      ).fetchone()[0] is True
    assert root.execute("SELECT has_function_privilege('research_e_gateway',%s,'EXECUTE')",
      ("research_ordering_stage_l.apply_lifecycle_review("
       "uuid,uuid,text,text,text,text,text,text,text,text,text,text,"
       "timestamptz,public.subscription_state,timestamptz,timestamptz)",)
      ).fetchone()[0] is False
    assert root.execute("SELECT rolcanlogin,rolbypassrls FROM pg_roles WHERE rolname='research_e_owner'").fetchone()==(False,False)
    print("STAGE_N_B5_M1_PIN_PASS real strict fixture installed in isolated 6-migration PG17; consumed intent + pending subscription + no Research entitlement",flush=True)

a=args(ACC,SID)
with db() as verifier:
    verifier.execute("SET ROLE research_e_verifier")
    verifier.execute(W_INSERT,wargs(a,intent_id))
    verifier.execute(W_INSERT,wargs(args(ACC,SID,key="fake-stage-n-intent"),uuid.UUID(
        "99999999-9999-4999-8999-000000000099")))
    verifier.execute("RESET ROLE")
with db() as g:
    role_denied(g,"research_e_gateway",CALL_L,a)
    role_denied(g,"research_e_gateway",CALL_N,args(ACC,SID,key="fake-stage-n-intent"))
    role_denied(g,"research_e_gateway",CALL_N,a)  # no J/K invoice observed yet
    assert count(g,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==0

with db() as k:
    held=as_role(k,"research_stage_k_gateway",K_CALL,
       ("lemon-squeezy",STORE,True,PSUB,"118","subscription_payment_success",
        "b"*64,SNAP,"invoice-v1","subscription-v1",QUOTE))
    assert held["action"]=="first_invoice_held" and held["can_mutate"] is False

with db() as g:
    role_denied(g,"research_e_gateway",CALL_N,args(ACC,SID,variant="314"))
    role_denied(g,"research_e_gateway",CALL_N,args(ACC,SID,key="fake-stage-n-intent"))
    role_denied(g,"research_e_gateway",CALL_N,args(ACC,SID,state="past_due"))
    assert count(g,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==0

# P2 L-2 direct privileged but NOLOGIN owner cannot write Library Pass.
with db() as r:
    r.execute("SET ROLE research_e_owner")
    # Limited old/new product RLS policy cannot see or alter the Library Pass row.
    assert r.execute("SELECT count(*) FROM public.entitlements WHERE account_id=%s AND "
      "product_id='read-the-dollar-first-guided-interactive-edition'",(ACC,)).fetchone()[0]==0
    changed=r.execute("UPDATE public.entitlements SET state='revoked' WHERE "
      "account_id=%s AND product_id='read-the-dollar-first-guided-interactive-edition'",
      (ACC,)).rowcount
    assert changed==0
    denied(r,"INSERT INTO public.entitlements(account_id,product_id,state,starts_at) "
      "VALUES(%s,'read-the-dollar-first-guided-interactive-edition','active',%s)",
      (ACC,START),states=("42501",))
    r.execute("RESET ROLE")
    print("STAGE_N_L2_PASS Research NOLOGIN owner denied Library Pass SELECT/UPDATE/INSERT by OLD+NEW product RLS",flush=True)

with db() as g:
    result=as_role(g,"research_e_gateway",CALL_N,a)
    assert result["action"]=="synthetic_first_activation_applied",result
    assert result["synthetic_effect_occurred"] is True
    assert result["can_mutate"] is False and result["live_can_mutate"] is False
    assert result["provider_paid_cycle_authoritative"] is False
    duplicate=as_role(g,"research_e_gateway",CALL_N,a)
    assert duplicate["action"]=="synthetic_duplicate"
    assert duplicate["synthetic_effect_occurred"] is False
    assert duplicate["can_mutate"] is False
with db() as root:
    assert count(root,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==1
    assert count(root,"public.subscription_events","subscription_id=%s",(SID,))==1
    assert count(root,"public.entitlement_events","account_id=%s AND product_id='research-membership'",(ACC,))==1
    assert root.execute("SELECT state::text,version FROM public.subscriptions WHERE id=%s",(SID,)).fetchone()==("active",2)
    assert (root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(ACC,)).fetchall(),
        root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall())==lib_before
    print("STAGE_N_L1_PASS actual B5 consumed SQL+signed observation+J/K invoice bound under one locked synthetic transition, exact duplicate nonmutating",flush=True)

# Unified response for both first purchase and pre-existing entitlement renewal.
renew=args(ACC,SID,key="synthetic-stage-n-renewal",end=NEXT,
           when="2026-11-05T02:03:08+00:00")
with db() as root:
    sub_v=root.execute("SELECT version FROM public.subscriptions WHERE id=%s",(SID,)).fetchone()[0]
    ent_v=root.execute("SELECT version FROM public.entitlements WHERE account_id=%s AND "
       "product_id='research-membership'",(ACC,)).fetchone()[0]
with db() as verifier:
    verifier.execute("SET ROLE research_e_verifier")
    verifier.execute(RENEW_INSERT,(
      renew[8],SID,ACC,"lemon-squeezy",renew[9],PSUB,CUSTOMER,STORE,VARIANT,
      FP,renew[10],"subscriptions",renew[12],"active",START,NEXT,
      sub_v,ent_v,"synthetic-renew-v2"))
    verifier.execute("RESET ROLE")
with db() as g:
    renewal=as_role(g,"research_e_gateway",CALL_N,renew)
    assert renewal["action"]=="applied" and renewal["synthetic_effect_occurred"] is True
    assert renewal["can_mutate"] is False and renewal["live_can_mutate"] is False
with db() as root:
    assert root.execute("SELECT version FROM public.subscriptions WHERE id=%s",(SID,)).fetchone()[0]==3
    assert (root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(ACC,)).fetchall(),
        root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall())==lib_before
    print("STAGE_N_L3_PASS renewal parity and unified nonauthorizing response; Library Pass byte-identical",flush=True)

print("RESEARCH_STAGE_N_LOCKED_B5_JK_L_PG17_REVIEW_PASS; ALL effects synthetic, no provider settlement, R1/R2/L1 remains NO-GO",flush=True)
