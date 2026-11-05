#!/usr/bin/env python3
"""D2-24 N-X0 RED->GREEN: install E..N before B5 paid binder, all disposable."""
from pathlib import Path
import hashlib,os,sys,uuid
import psycopg

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/"docs"/"operations"/"research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap,db
for k in ("DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL","SUPABASE_SERVICE_ROLE_KEY",
          "LEMON_SQUEEZY_API_KEY","LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(k),"NO CONNECTED DATABASE/PROVIDER: "+k
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD")) == (
  "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only")

B5=ROOT/"docs"/"operations"/"research-ordering-stage-n"/"b5_m1_strict_pinned_review_only.sql"
B5_SHA="e936e18f1ed78743e77d2b158e562af07b0aedcd62d85efed08ab95244b2ea74"
SCRIPTS=[ROOT/"docs"/"operations"/f"research-ordering-stage-{name}"/file for name,file in (
 ("e","segmented_caller_review.sql"),("f","strict_witness_review.sql"),
 ("h","receipt_journal_review.sql"),("i","journal_hardening_review.sql"),
 ("j","invoice_journal_review.sql"),("k","conflict_observation_review.sql"),
 ("l","first_activation_review.sql"),("m","canonical_bridge_review.sql"),
 ("n","locked_first_purchase_review.sql")
)]
GUARD=HERE/"b5_pending_guard_review.sql"
ISSUE="SELECT public.issue_research_membership_checkout_intent("+",".join(["%s"]*7)+")"
ATTACH="SELECT public.attach_research_membership_checkout_intent("+",".join(["%s"]*3)+")"
OBSERVE="SELECT public.observe_signed_research_subscription_created("+",".join(["%s"]*13)+")"
BIND="SELECT public.bind_research_membership_with_checkout_intent("+",".join(["%s"]*14)+")"
K_CALL="SELECT research_ordering_stage_k.hold_observation("+",".join(["%s"]*11)+")"
N_CALL="SELECT research_ordering_stage_n.apply_b5_bound_lifecycle_review("+",".join(["%s"]*16)+")"
W_INSERT="""INSERT INTO research_ordering_stage_l.verified_first_activation(
 event_key,subscription_id,account_id,provider,provider_subscription_id,
 provider_customer_id,store_id,variant_id,binding_fingerprint,provider_event_id,
 event_fingerprint,source_type,snapshot_object_at,target_state,target_period_start,
 target_period_end,expected_subscription_version,expected_entitlement_absent,
 checkout_intent_id,invoice_id,invoice_snapshot_digest,issued_quote_digest,
 billing_reason,provider_snapshot_version,evidence_authority)
 VALUES ("""+",".join(["%s"]*25)+")"
ACC=uuid.UUID("88888888-8888-4888-8888-000000000051")
STORE="41"; VARIANT="313"; CUSTOMER="78"; PSUB="217"; FP="f"*64
START="2026-11-05T00:00:00+00:00"; END="2026-12-05T00:00:00+00:00"
KEY="stage-o-guards-first-real-b5"; CLOCK="2026-11-05T01:03:08+00:00"
a=(None,ACC,"lemon-squeezy",PSUB,CUSTOMER,STORE,VARIANT,FP,KEY,KEY,
   hashlib.sha256(KEY.encode()).hexdigest(),"subscriptions",CLOCK,"active",START,END)

def signed(s):return hashlib.sha256(s.encode()).hexdigest()
def count(c,table,where="",params=()):
    return c.execute("SELECT count(*) FROM "+table+(" WHERE "+where if where else ""),params).fetchone()[0]
def as_role(c,role,query,values):
    c.execute("SET ROLE "+role)
    try:return c.execute(query,values).fetchone()[0]
    finally:c.execute("RESET ROLE")
def denied(c,query,values=(),state="42501"):
    try:c.execute(query,values)
    except psycopg.Error as ex:
        assert ex.sqlstate==state,(ex.sqlstate,str(ex))
        return
    raise AssertionError("UNAUTHORIZED operation accepted: "+query)
def denied_role(c,role,query,values=()):
    c.execute("SET ROLE "+role)
    try:denied(c,query,values)
    finally:c.execute("RESET ROLE")

assert B5.is_file() and hashlib.sha256(B5.read_bytes()).hexdigest()==B5_SHA
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
       " VALUES('41','research-membership','313','monthly',true)")
    for p in SCRIPTS:
        assert p.is_file(),p
        root.execute(p.read_text("utf8"))
    # No staged subscription or checkout before E..N protections exist.
    assert count(root,"research_checkout_guard.checkout_intents")==0
    assert count(root,"public.subscriptions")==0
    assert count(root,"public.entitlements")==0
    root.execute("INSERT INTO auth.users(id,email) VALUES(%s,%s)",
                 (ACC,"stage-o-guards-first@invalid.example"))
    assert root.execute("SELECT status::text FROM public.profiles WHERE account_id=%s",
      (ACC,)).fetchone()[0]=="active"
    root.execute("""INSERT INTO public.purchases(account_id,product_id,provider,
      provider_transaction_id,status,amount_cents,currency,price_tier,offer_terms,
      completed_at) VALUES (%s,
      'read-the-dollar-first-guided-interactive-edition','review-provider',
      'synthetic-o-lp-51','completed',3900,'USD','launch','{}',
      '2026-09-01T00:00:00Z') RETURNING id""",(ACC,))
    purchase=root.execute("SELECT id FROM public.purchases WHERE account_id=%s",(ACC,)).fetchone()[0]
    root.execute("INSERT INTO public.entitlements(account_id,purchase_id,product_id,state,starts_at) "
       "VALUES(%s,%s,'read-the-dollar-first-guided-interactive-edition','active',%s)",
       (ACC,purchase,START))
    original_lp=(
       root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s "
                    "AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
       root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",
                    (ACC,)).fetchall())
    assert count(root,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==0

with db() as root:
    issue=as_role(root,"review_checkout_issuer",ISSUE,
      (ACC,"research-membership",STORE,VARIANT,"monthly",True,"stage-o-request-000051"))
    assert issue["action"]=="reserved",issue
    intent_id=issue["intent_id"]; proof=issue["checkout_key"]
    attach=as_role(root,"review_checkout_issuer",ATTACH,
      (intent_id,proof,"synthetic-stage-o-checkout"))
    assert attach["action"]=="attached"
    occured=root.execute("SELECT created_at+interval '5 seconds' FROM "
      "research_checkout_guard.checkout_intents WHERE id=%s",(intent_id,)).fetchone()[0]
    obs=as_role(root,"review_checkout_verifier",OBSERVE,
      ("lemon-squeezy",PSUB,CUSTOMER,STORE,"research-membership",VARIANT,
       True,occured,"a"*64,ACC,signed(proof),"research-receipt-business-v3",FP))
    assert obs["action"]=="recorded",obs
    args=(ACC,"lemon-squeezy",PSUB,CUSTOMER,VARIANT,"monthly",occured,
          proof,"a"*64,STORE,"research-membership",True,"research-receipt-business-v3",FP)
    # D2-24 independent reproduction: current E guard prevents the real B5
    # NOLOGIN binder from inserting a PENDING Research subscription.
    denied_role(root,"review_checkout_binder",BIND,args)
    assert count(root,"public.subscriptions","account_id=%s",(ACC,))==0
    assert root.execute("SELECT state FROM research_checkout_guard.checkout_intents "
      "WHERE id=%s",(intent_id,)).fetchone()[0]=="attached"
    assert count(root,"research_checkout_guard.signed_paid_observations")==1
    print("STAGE_O_NX0_RED_PASS original Stage E guard rejects B5 binder after all overlays installed",flush=True)

with db() as root:
    root.execute(GUARD.read_text("utf8"))
    # Preserve trigger security invoker semantics and strict search path.
    props=root.execute("SELECT p.prosecdef,coalesce(p.proconfig,ARRAY[]::text[]) FROM pg_proc p "
      "WHERE p.oid='research_ordering_stage_e.reject_unauthorized_research_write()'::regprocedure").fetchone()
    assert props == (False, ['search_path=""']),props
    assert count(root,"pg_trigger","tgname='research_e_guard_subscriptions' AND NOT tgisinternal")==1
    bound=as_role(root,"review_checkout_binder",BIND,args)
    assert bound["action"]=="created" and bound["subscription_state"]=="pending",bound
    SID=bound["subscription_id"]
    sub=root.execute("SELECT state::text,version,metadata FROM public.subscriptions WHERE id=%s",(SID,)).fetchone()
    assert sub[0]=="pending" and sub[1]==1,sub
    assert sub[2]=={"review_store_id":STORE,"review_variant_id":VARIANT,
                    "review_binding_fingerprint":FP},sub
    assert root.execute("SELECT state,provider_subscription_id FROM research_checkout_guard.checkout_intents "
      "WHERE id=%s",(intent_id,)).fetchone()==("consumed",PSUB)
    assert count(root,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==0
    assert root.execute("SELECT count(*) FROM research_checkout_guard.signed_paid_observations").fetchone()[0]==1
    assert (root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
            root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(ACC,)).fetchall())==original_lp
    print("STAGE_O_NX0_GREEN_PASS real pinned B5 binder after E..N creates only pending subscription, trustworthy synthetic metadata, zero Research entitlement",flush=True)

with db() as root:
    # The B5 owner cannot UPDATE pending->active, insert active Research or edit LP.
    denied_role(root,"review_checkout_owner",
      "UPDATE public.subscriptions SET state='active' WHERE id=%s",(SID,))
    denied_role(root,"review_checkout_owner",
      "INSERT INTO public.subscriptions(account_id,product_id,provider,provider_subscription_id,"
      "provider_customer_id,provider_price_id,billing_interval,state) VALUES("
      "%s,'research-membership','lemon-squeezy','fake-sub-52','78','313','monthly','active')",(ACC,))
    denied_role(root,"review_checkout_owner",
      "INSERT INTO public.subscriptions(account_id,product_id,provider,provider_subscription_id,"
      "provider_customer_id,provider_price_id,billing_interval,state) VALUES("
      "%s,'research-membership','lemon-squeezy','fake-sub-53','78','313','monthly','pending')",(ACC,))
    denied_role(root,"review_checkout_owner",
      "INSERT INTO public.entitlements(account_id,product_id,state,starts_at)"
      " VALUES(%s,'read-the-dollar-first-guided-interactive-edition','active',%s)",(ACC,START))
    for role in ("service_role","postgres"):
        denied_role(root,role,
          "UPDATE public.subscriptions SET state='active' WHERE id=%s",(SID,))
    print("STAGE_O_NX0_PRIVILEGE_PASS no active/forged pending subscription, service_role/postgres overwrite or LP write through B5 owner",flush=True)

with db() as k:
    held=as_role(k,"research_stage_k_gateway",K_CALL,
       ("lemon-squeezy",STORE,True,PSUB,"118","subscription_payment_success",
        "b"*64,"1"*64,"invoice-v1","subscription-v1","2"*64))
    assert held["action"]=="first_invoice_held" and held["can_mutate"] is False,held
with db() as verifier:
    verifier.execute("SET ROLE research_e_verifier")
    verifier.execute(W_INSERT,(KEY,SID,ACC,"lemon-squeezy",PSUB,CUSTOMER,STORE,
      VARIANT,FP,KEY,signed(KEY),"subscriptions",CLOCK,"active",START,END,
      1,True,str(intent_id),"118","1"*64,"2"*64,
      "initial","synthetic-stable-v1","synthetic_not_provider_authoritative"))
    verifier.execute("RESET ROLE")
with db() as gateway:
    invocation=list(a);invocation[0]=SID
    result=as_role(gateway,"research_e_gateway",N_CALL,tuple(invocation))
    assert result["action"]=="synthetic_first_activation_applied",result
    assert result["can_mutate"] is False and result["live_can_mutate"] is False
    again=as_role(gateway,"research_e_gateway",N_CALL,tuple(invocation))
    assert again["action"]=="synthetic_duplicate" and again["can_mutate"] is False

with db() as root:
    assert count(root,"public.entitlements","account_id=%s AND product_id='research-membership'",(ACC,))==1
    assert count(root,"public.subscription_events","subscription_id=%s",(SID,))==1
    assert count(root,"public.entitlement_events","account_id=%s AND product_id='research-membership'",(ACC,))==1
    assert root.execute("SELECT state::text,version FROM public.subscriptions WHERE id=%s",(SID,)).fetchone()==("active",2)
    assert (root.execute("SELECT row_to_json(e)::text FROM public.entitlements e WHERE account_id=%s AND purchase_id IS NOT NULL",(ACC,)).fetchall(),
            root.execute("SELECT row_to_json(p)::text FROM public.purchases p WHERE account_id=%s",(ACC,)).fetchall())==original_lp
    print("STAGE_O_NX0_END_TO_END_PASS GUARDS FIRST -> REAL B5 BIND -> J/K INVOICE -> ONE N SYNTHETIC ACTIVATION; LP byte-identical",flush=True)
print("RESEARCH_STAGE_O_B5_NX0_DISPOSABLE_PASS; no real provider settlement, customer mutation or live activation",flush=True)
