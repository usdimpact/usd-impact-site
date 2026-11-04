#!/usr/bin/env python3
"""B5 exact-app-RPC SQL test using a disposable real PostgreSQL 16 server only."""
import os, json, time, uuid, hashlib, concurrent.futures, datetime
from pathlib import Path
import psycopg
ROOT=Path(__file__).resolve().parents[1]
SQL=ROOT/"docs/operations/research-b5-real-app-rpc-proposed-d1-review-2026-11-04.sql"
A=["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222",
   "33333333-3333-4333-8333-333333333333","44444444-4444-4444-8444-444444444444",
   "55555555-5555-4555-8555-555555555555"]
CREDENTIALS={"root":("ci_research","ci_fixture_only_password"),
  "issuer":("review_checkout_issuer","only_synthetic_issuer"),
  "verifier":("review_checkout_verifier","only_synthetic_verifier"),
  "binder":("review_checkout_binder","only_synthetic_binder")}
def db(who="root",autocommit=True):
    user,password=CREDENTIALS[who]
    return psycopg.connect(host="127.0.0.1",port=5432,dbname="ci_review",
        user=user,password=password,autocommit=autocommit,connect_timeout=5)
def one(conn,sql,args=()):
    row=conn.execute(sql,args).fetchone()
    assert row is not None,sql
    return row[0]
def eq(got,want,label):
    assert got==want,f"{label}: got={got!r} want={want!r}"
def hash256(s): return hashlib.sha256(s.encode()).hexdigest()
def issuer(c,account,request=None,variant="314",mode=True):
    return one(c,"select public.issue_research_membership_checkout_intent("
      "%s::uuid,'research-membership','42',%s,'monthly',%s,%s)",
      (account,variant,mode,request or "request-"+uuid.uuid4().hex))
def attach(c,intent,provider="checkout_1",proof=None):
    return one(c,"select public.attach_research_membership_checkout_intent(%s::uuid,%s,%s)",
      (intent["intent_id"],proof or intent["checkout_key"],provider))
def observe(c,sub,sha,account=None,proof=None,customer="cust_1"):
    return one(c,"select public.observe_signed_research_subscription_created("
       "'lemon-squeezy',%s,%s,'42','research-membership','314',true,"
       "clock_timestamp(),%s,%s::uuid,%s)",
       (sub,customer,sha,account,hash256(proof) if proof else None))
def bind(c,account,sub,sha,proof,customer="cust_1"):
    return one(c,"select public.bind_research_membership_with_checkout_intent("
       "%s::uuid,'lemon-squeezy',%s,%s,'314','monthly',"
       "clock_timestamp(),%s,%s,'42','research-membership',true)",
       (account,sub,customer,proof,sha))
def refused(c,sql,args=()):
    try: c.execute(sql,args)
    except psycopg.Error as e: eq(e.sqlstate,"42501","must deny mutation")
    else: raise AssertionError("Unexpected permission to execute "+sql[:100])
def setup():
    with db() as c:
        c.execute("""
        create type public.subscription_billing_interval as enum ('monthly','annual');
        create table public.profiles(account_id uuid primary key,status text not null);
        create table public.subscription_offers(product_id text primary key);
        create table public.subscriptions(
          id uuid primary key default gen_random_uuid(),
          account_id uuid not null references public.profiles(account_id),
          product_id text not null references public.subscription_offers(product_id),
          provider text not null,provider_subscription_id text not null,
          provider_customer_id text,provider_price_id text,
          billing_interval public.subscription_billing_interval not null,
          state text not null default 'pending',
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique(provider,provider_subscription_id));
        create unique index one_current on public.subscriptions(account_id,product_id)
          where state in ('pending','active','past_due','cancel_scheduled');
        create table public.entitlements(id uuid primary key default gen_random_uuid(),
          account_id uuid not null references public.profiles(account_id),
          product_id text not null,state text not null,purchase_id uuid,
          subscription_id uuid references public.subscriptions(id),
          unique(account_id,product_id));
        insert into public.subscription_offers(product_id) values ('research-membership');
        """)
        for a in A:
            c.execute("insert into public.profiles values (%s::uuid,'active')",(a,))
        content=SQL.read_text()
        assert content.startswith("-- D1 ISOLATED REVIEW ONLY.")
        assert content.count("create function public.")==4
        c.execute(content)
        c.execute("""insert into research_checkout_guard.allowed_variants
          (store_id,product_id,variant_id,billing_interval,test_mode)
          values ('42','research-membership','314','monthly',true),
                 ('42','research-membership','315','annual',true)""")
        c.execute("""grant usage on schema public to
          review_checkout_issuer,review_checkout_verifier,review_checkout_binder""")
def roles():
    funcs=["issue_research_membership_checkout_intent(uuid,text,text,text,text,boolean,text)",
      "attach_research_membership_checkout_intent(uuid,text,text)",
      "observe_signed_research_subscription_created(text,text,text,text,text,text,boolean,timestamptz,text,uuid,text)",
      "bind_research_membership_with_checkout_intent(uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean)"]
    with db() as root,db("issuer") as i,db("verifier") as v,db("binder") as b:
        for role in ("anon","authenticated","public"):
            for f in funcs:
                eq(one(root,"select has_function_privilege(%s,%s,'EXECUTE')",(role,"public."+f)),False,"public denied "+f)
        for role in ("review_checkout_issuer","review_checkout_verifier","review_checkout_binder"):
            eq(one(root,"select has_schema_privilege(%s,'research_checkout_guard','USAGE')",(role,)),False,"private schema")
        refused(i,"select public.observe_signed_research_subscription_created('lemon-squeezy','forged','cust','42','research-membership','314',true,now(),%s,null,null)",("a"*64,))
        refused(v,"select public.issue_research_membership_checkout_intent(%s::uuid,'research-membership','42','314','monthly',true,'request123456')",(A[0],))
        refused(b,"select public.observe_signed_research_subscription_created('lemon-squeezy','forged','cust','42','research-membership','314',true,now(),%s,null,null)",("b"*64,))
        eq(one(root,"select count(*) from research_checkout_guard.signed_paid_observations"),0,"no forged observation")
    print("PASS B5 role isolation: public/anon/authenticated and cross-role EXECUTE denied",flush=True)
def issue_attach():
    with db("issuer") as i,db() as root:
        eq(issuer(i,A[0],variant="fake")["action"],"rejected","variant allowlist")
        eq(issuer(i,A[0],mode=False)["action"],"rejected","live/test boundary")
        k=issuer(i,A[0],request="request-fixed-111")
        eq(k["action"],"reserved","issue valid")
        eq(len(k["checkout_key"]),43,"strong key encoding")
        eq(k["account_id"],A[0],"server account")
        eq(k["store_id"],"42","store")
        eq(k["test_mode"],True,"test mode")
        assert 0 < k["expires_at"].timestamp()-time.time() <=1805
        eq(issuer(i,A[0],request="request-fixed-111")["action"],"rejected","cannot reissue same proof")
        eq(issuer(i,A[0],request="request-next111")["action"],"rejected","no parallel checkouts")
        eq(attach(i,k,proof="A"*43)["action"],"rejected","forged attachment proof")
        eq(attach(i,k,provider="checkout-a1")["action"],"attached","attached before URL")
        eq(attach(i,k,provider="checkout-b1")["action"],"rejected","no second checkout ID")
        eq(one(root,"select checkout_proof_sha256 from research_checkout_guard.checkout_intents where id=%s::uuid",(k["intent_id"],)),hash256(k["checkout_key"]),"only hash stored")
    print("PASS B5 G1: account+catalog+mode+30m issuance, proof digest, one attached checkout",flush=True)
    return k
def custody_and_bind(k):
    with db("verifier") as v,db("binder") as b,db() as root:
        sha=hash256("signed provider subscription_created alice")
        eq(observe(v,"sub-alice",sha,A[0],k["checkout_key"])["action"],"recorded","committed signed observation")
        eq(observe(v,"sub-alice",sha,A[0],k["checkout_key"])["action"],"already_recorded","signed retry")
        eq(observe(v,"sub-alice",hash256("changed bytes"),A[0],k["checkout_key"])["action"],"conflict_recorded","immutable signed identity")
        eq(bind(b,A[0],"sub-alice",hash256("unknown"),k["checkout_key"])["action"],"unverified_paid_evidence","exact SHA")
        first=bind(b,A[0],"sub-alice",sha,k["checkout_key"])
        eq(first["action"],"created","safe pending binding")
        eq(first["raw_body_sha256"],sha,"same signed event")
        eq(bind(b,A[0],"sub-alice",sha,k["checkout_key"])["action"],"existing","same paid event idempotent")
        eq(one(root,"select count(*) from public.entitlements where account_id=%s::uuid",(A[0],)),0,"no entitlement grant")
        root.execute("update public.subscriptions set state='refunded' where provider_subscription_id='sub-alice'")
        eq(bind(b,A[0],"sub-alice",sha,k["checkout_key"])["action"],"conflict","refund cannot reactivate")
        eq(one(root,"select state from public.subscriptions where provider_subscription_id='sub-alice'"),"refunded","terminal remains")
    print("PASS B5 G2/G4: paid before bind, exact SHA, conflicting replay journalled, no grant, refunded deny",flush=True)
def unbound():
    with db("verifier") as v,db("binder") as b,db() as root:
        sha=hash256("signed direct Share unbound")
        eq(observe(v,"sub-direct",sha)["action"],"recorded","unbound preserved")
        result=bind(b,A[1],"sub-direct",sha,"B"*43)
        eq(result["action"],"conflict","unissued proof held")
        eq(result["code"],"unissued_checkout_key","unbound not granted")
        assert result["conflict_evidence_id"]
        eq(one(root,"select count(*) from public.subscriptions where provider_subscription_id='sub-direct'"),0,"no binding")
        eq(one(root,"select count(*) from research_checkout_guard.signed_paid_observations where provider_subscription_id='sub-direct'"),1,"separately committed signed fact")
    print("PASS B5 D5: unbound direct Share fact held, no subscription or entitlement",flush=True)
def inject(root,account,proof,request):
    iid=str(uuid.uuid4())
    now=one(root,"select clock_timestamp()")
    root.execute("""insert into research_checkout_guard.checkout_intents(
        id,account_id,client_request_id,store_id,product_id,variant_id,
        billing_interval,test_mode,checkout_proof_sha256,state,provider_checkout_id,
        created_at,expires_at)
        values(%s::uuid,%s::uuid,%s,'42','research-membership','314',
        'monthly',true,%s,'attached',%s,%s::timestamptz,%s::timestamptz)""",
        (iid,account,request,hash256(proof),"checkout-"+request,
         now,now+datetime.timedelta(minutes=29)))
def concurrent_paid():
    with db() as root,db("verifier") as v:
        inject(root,A[3],"C"*43,"dupe-a")
        inject(root,A[3],"D"*43,"dupe-b")
        s1,s2=hash256("competing paid 1"),hash256("competing paid 2")
        eq(observe(v,"sub-dupe-a",s1,A[3],"C"*43)["action"],"recorded","first paid")
        eq(observe(v,"sub-dupe-b",s2,A[3],"D"*43)["action"],"recorded","second paid")
    a,b=db("binder",False),db("binder",False)
    try:
        assert one(a,"select pg_backend_pid()") != one(b,"select pg_backend_pid()")
        a.execute("begin")
        eq(bind(a,A[3],"sub-dupe-a",s1,"C"*43)["action"],"created","first contested bind")
        b.execute("begin")
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            fut=pool.submit(bind,b,A[3],"sub-dupe-b",s2,"D"*43)
            time.sleep(.3)
            assert not fut.done(),"second PostgreSQL backend did not block"
            a.commit()
            second=fut.result(timeout=20)
        eq(second["action"],"conflict","second paid held")
        eq(second["code"],"duplicate_paid_subscription","T13 recorded duplicate paid")
        b.commit()
    finally:
        a.rollback(); b.rollback(); a.close(); b.close()
    with db() as root:
        eq(one(root,"select count(*) from public.subscriptions where account_id=%s::uuid",(A[3],)),1,"one subscription")
        eq(one(root,"select count(*) from research_checkout_guard.signed_paid_observations where provider_subscription_id like 'sub-dupe-%'"),2,"both paid events retained")
        assert one(root,"select count(*) from research_checkout_guard.conflict_evidence where conflict_code='duplicate_paid_subscription'")>=1
    print("PASS B5 T13: two distinct PostgreSQL sessions blocked; second paid preserved without second grant",flush=True)
def complimentary_and_library():
    with db() as root:
        root.execute("insert into public.entitlements(account_id,product_id,state,purchase_id) values (%s::uuid,'research-membership','active',%s::uuid)",(A[2],str(uuid.uuid4())))
        root.execute("insert into public.entitlements(account_id,product_id,state,purchase_id) values (%s::uuid,'library-pass','active',%s::uuid)",(A[2],str(uuid.uuid4())))
        before=one(root,"select row_to_json(e)::text from public.entitlements e where account_id=%s::uuid and product_id='library-pass'",(A[2],))
    with db("issuer") as i,db("verifier") as v,db("binder") as b,db() as root:
        eq(issuer(i,A[2])["action"],"rejected","complimentary prevents checkout")
        inject(root,A[2],"E"*43,"comp-inject")
        sha=hash256("paid complimentary")
        eq(observe(v,"sub-comp",sha,A[2],"E"*43)["action"],"recorded","paid custody")
        outcome=bind(b,A[2],"sub-comp",sha,"E"*43)
        eq(outcome["code"],"entitlement_conflict","T21 access preserved")
        eq(one(root,"select count(*) from public.subscriptions where account_id=%s::uuid",(A[2],)),0,"no paid bind")
        after=one(root,"select row_to_json(e)::text from public.entitlements e where account_id=%s::uuid and product_id='library-pass'",(A[2],))
        eq(after,before,"T22 byte-identical Library Pass")
        eq(one(root,"select state from public.entitlements where account_id=%s::uuid and product_id='research-membership'",(A[2],)),"active","complimentary retained")
    print("PASS B5 T21/T22: complimentary Research and historical Library Pass unchanged",flush=True)
def expiry_and_immutable():
    with db("issuer") as i,db("verifier") as v,db("binder") as b,db() as root:
        intent=issuer(i,A[4])
        eq(intent["action"],"reserved","expiry setup")
        eq(attach(i,intent,provider="checkout-expire")["action"],"attached","expiry attached")
        root.execute("update research_checkout_guard.checkout_intents set expires_at=created_at+interval '1 second' where id=%s::uuid",(intent["intent_id"],))
        time.sleep(1.5)
        sha=hash256("signed after expiry")
        eq(observe(v,"sub-expiry",sha,A[4],intent["checkout_key"])["action"],"recorded","paid survives expiry")
        eq(bind(b,A[4],"sub-expiry",sha,intent["checkout_key"])["code"],"expired_checkout_key","no expired binding")
        eq(one(root,"select count(*) from public.subscriptions where provider_subscription_id='sub-expiry'"),0,"no subscription")
        eq(observe(v,"sub-expiry",hash256("changed raw"),A[4],intent["checkout_key"],customer="different")["action"],"conflict_recorded","wrong provider customer")
        refused(root,"delete from research_checkout_guard.signed_paid_observations")
        refused(root,"truncate research_checkout_guard.conflict_evidence")
        refused(b,"update research_checkout_guard.checkout_intents set state='consumed'")
        eq(one(root,"select count(*) from public.entitlements where subscription_id is not null"),0,"never granted")
    print("PASS B5 X3 partial: journal immutability and expired paid-event custody; no entitlement",flush=True)
def main():
    assert os.environ.get("GITHUB_ACTIONS")=="true"
    assert os.environ.get("GITHUB_HEAD_REF")=="agent/1103-b5-rpc-sql-isolated-d1-20261104"
    for key in ("SUPABASE_URL","SUPABASE_DB_URL","DATABASE_URL","LEMON_SQUEEZY_API_KEY"):
        assert not os.environ.get(key),f"Remote environment prohibited: {key}"
    setup(); roles(); k=issue_attach(); custody_and_bind(k)
    unbound(); concurrent_paid(); complimentary_and_library(); expiry_and_immutable()
    with db() as root:
        version=one(root,"show server_version")
    print("B5_D1_POSTGRES_PROPOSAL_PASS "+json.dumps({"version":version,
      "evidence":["G1","G2","G4","T13 two sessions","T21","T22","D5","role isolation","X3 partial"],
      "not_proven":["Production schema","real HMAC","merchant settlement",
       "actual Supabase D2 roles","receipt X8","lifecycle O1/O4"]}),flush=True)
if __name__=="__main__": main()
