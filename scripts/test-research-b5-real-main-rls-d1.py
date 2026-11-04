#!/usr/bin/env python3
"""D1 only: run B5 proposed RPCs on original protected-main Research migrations.

GitHub Actions starts PostgreSQL 16.15 locally. This never connects to Supabase.
No live keys, checkout, merchant/customer records, migrations, grants or roles.
"""
import importlib.util
import json
import os
import subprocess
import datetime
import hashlib
from pathlib import Path
import psycopg

ROOT = Path(__file__).resolve().parents[1]
D1 = ROOT / "scripts/test-research-b5-rpc-d1.py"
spec = importlib.util.spec_from_file_location("b5_fixture", D1)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
A = base.A
REAL_DB = "ci_review_real_main"
MIGRATIONS = (
    "20260729203000_paid_access_foundation.sql",
    "20260905201000_research_membership_recurring_foundation.sql",
    "20260906004500_research_membership_transition_persistence.sql",
    "20260906104500_research_membership_performance_hardening.sql",
    "20260906180500_research_membership_service_role_grants.sql",
    "20260907154500_research_membership_first_purchase_binding.sql",
)
def local_connection(who="root", autocommit=True, database=REAL_DB):
    user, password = base.CREDENTIALS[who]
    return psycopg.connect(
        host="127.0.0.1", port=5432, dbname=database, user=user,
        password=password, autocommit=autocommit, connect_timeout=5)
base.db = local_connection
def one(c, query, args=()):
    return base.one(c, query, args)
def check(got, want, label):
    base.eq(got, want, label)
def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()
def bootstrap():
    with local_connection(database="ci_review") as root:
        root.execute("create database " + REAL_DB)
    with local_connection() as c:
        c.execute("""create schema auth;
          create schema extensions;
          -- PostgreSQL roles are cluster-wide; earlier isolated D1 test
          -- created these synthetic role stubs in this same ephemeral server.
          create table auth.users(id uuid primary key, email text);
          create function auth.uid() returns uuid language sql stable as $fn$
             select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
          $fn$;
          create extension pgcrypto with schema extensions;""")
        for name in MIGRATIONS:
            data = (ROOT / "supabase/migrations" / name).read_text()
            assert data.startswith("begin;") and data.rstrip().endswith("commit;"), name
            c.execute(data)
        proposed = base.SQL.read_text()
        assert proposed.startswith("-- D1 ISOLATED REVIEW ONLY.")
        # REVIEW roles belong to the disposable PostgreSQL cluster, not a
        # particular DB. The prior D1 job creates/validates them. Omit only
        # their synthetic CREATE statements; functions/policies are unchanged.
        role_lines = (
          "create role anon nologin;",
          "create role authenticated nologin;",
          "create role review_checkout_issuer login noinherit password 'only_synthetic_issuer';",
          "create role review_checkout_verifier login noinherit password 'only_synthetic_verifier';",
          "create role review_checkout_binder login noinherit password 'only_synthetic_binder';",
          "create role review_checkout_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;",
        )
        for line in role_lines:
            assert proposed.count(line) == 1, "Proposed SQL review-role declaration changed: " + line
            proposed = proposed.replace(line, "-- existing isolated D1 cluster role")
        # All four *unchanged* function bodies and owner/RLS policies run
        # on actual historical table types, CHECKs, FKs, triggers, RLS.
        c.execute(proposed)
        c.execute("""insert into research_checkout_guard.allowed_variants
          (store_id,product_id,variant_id,billing_interval,test_mode)
          values ('42','research-membership','314','monthly',true),
                 ('42','research-membership','315','annual',true)""")
        c.execute("""grant usage on schema public to
          review_checkout_issuer,review_checkout_verifier,review_checkout_binder""")
        for idx, user_id in enumerate(A):
            c.execute("insert into auth.users(id,email) values(%s::uuid,%s)",
                (user_id, f"review-{idx}@example.invalid"))
    print("PASS ACTUAL-MAIN setup: six original migrations, original Research constraints, RLS and proposed owner policies", flush=True)
def account(identity):
    with local_connection() as c:
        c.execute("insert into auth.users(id,email) values(%s::uuid,%s)",
            (identity, "review-extra@example.invalid"))
def custody_refund_real_main(intent):
    with local_connection("verifier") as verifier, local_connection("binder") as binder, local_connection() as root:
        s = sha("original real-main signed observation")
        changed = sha("same paid identity changed raw webhook envelope")
        assert base.observe(verifier,"main-c5",s,A[0],intent["checkout_key"])["action"]=="recorded"
        assert base.observe(verifier,"main-c5",changed,A[0],intent["checkout_key"])["action"]=="already_recorded"
        assert base.observe(verifier,"main-c5",sha("different paid identity"),A[0],intent["checkout_key"],customer="changed")["action"]=="conflict_recorded"
        result=base.bind(binder,A[0],"main-c5",changed,intent["checkout_key"])
        check(result["action"],"created","actual-main pending")
        check(result["subscription_state"],"pending","actual-main state enum")
        check(base.bind(binder,A[0],"main-c5",s,intent["checkout_key"])["action"],"existing","real-main exact replay")
        check(one(root,"select count(*) from public.entitlements where account_id=%s::uuid",(A[0],)),0,"real-main zero entitlement")
        # Follow real original trigger transition, unlike simplified D1.
        root.execute("update public.subscriptions set state='active' where provider_subscription_id='main-c5'")
        root.execute("update public.subscriptions set state='refunded' where provider_subscription_id='main-c5'")
        check(base.bind(binder,A[0],"main-c5",s,intent["checkout_key"])["action"],"conflict","refunded terminal deny")
        check(one(root,"select state::text from public.subscriptions where provider_subscription_id='main-c5'"),"refunded","refund preserved")
    print("PASS ACTUAL-MAIN C5/C12: changed signed body, v3 identity conflict, pending only, state-trigger refund replay deny",flush=True)
def complimentary_library_real_main():
    # The real Library Pass has a valid historical paid purchase and one-time
    # entitlement. It must not be altered by any Research RPC.
    with local_connection() as root:
        purchase=one(root,"""insert into public.purchases
          (account_id,product_id,provider,provider_transaction_id,status,
           amount_cents,currency,price_tier,offer_terms,completed_at)
          values (%s::uuid,'read-the-dollar-first-guided-interactive-edition',
           'paddle','synthetic-library-pass-A2','completed',3900,'USD',
           'launch','{}'::jsonb,now()) returning id""",(A[2],))
        root.execute("""insert into public.entitlements(account_id,purchase_id,product_id,state)
          values (%s::uuid,%s::uuid,'read-the-dollar-first-guided-interactive-edition','active')""",(A[2],purchase))
        root.execute("""insert into public.entitlements(account_id,product_id,state)
          values (%s::uuid,'research-membership','active')""",(A[2],))
        before=one(root,"select row_to_json(e)::text from public.entitlements e where account_id=%s::uuid and product_id='read-the-dollar-first-guided-interactive-edition'",(A[2],))
        base.inject(root,A[2],"E"*43,"real-main-complimentary")
    with local_connection("issuer") as i,local_connection("verifier") as v,local_connection("binder") as b,local_connection() as root:
        check(base.issuer(i,A[2])["action"],"rejected","real-main no checkout for complimentary")
        s=sha("real-main paid event for complimentary account")
        check(base.observe(v,"main-comp",s,A[2],"E"*43)["action"],"recorded","paid preserved")
        r=base.bind(b,A[2],"main-comp",s,"E"*43)
        check(r["code"],"entitlement_conflict","actual-main complimentary conflict")
        check(one(root,"select count(*) from public.subscriptions where account_id=%s::uuid",(A[2],)),0,"no duplicate paid sub")
        after=one(root,"select row_to_json(e)::text from public.entitlements e where account_id=%s::uuid and product_id='read-the-dollar-first-guided-interactive-edition'",(A[2],))
        check(after,before,"actual Library Pass byte identity")
    print("PASS ACTUAL-MAIN T21/T22: complimentary Research held; historical paid Library Pass byte-identical",flush=True)
def late_webhook_real_main():
    identity="77777777-7777-4777-8777-777777777777"
    account(identity)
    with local_connection("issuer") as i,local_connection("verifier") as v,local_connection("binder") as b,local_connection() as root:
        intent=base.issuer(i,identity)
        check(base.attach(i,intent,"checkout-real-main-delayed")["action"],"attached","delayed checkout attachment")
        at=one(root,"select clock_timestamp()")
        start=at-datetime.timedelta(minutes=31)
        paid=start+datetime.timedelta(minutes=29)
        root.execute("""update research_checkout_guard.checkout_intents
          set created_at=%s::timestamptz, expires_at=%s::timestamptz
          where id=%s::uuid""",(start,start+datetime.timedelta(minutes=30),intent["intent_id"]))
        base.EVENT_OCCURRED_AT["main-delay"]=paid
        s=sha("main delayed signed payment")
        check(base.observe(v,"main-delay",s,identity,intent["checkout_key"])["action"],"recorded","late signed custody")
        check(base.bind(b,identity,"main-delay",s,intent["checkout_key"])["action"],"created","paid within window delivered after expiration")
    print("PASS ACTUAL-MAIN C4: authoritative-shape purchase timestamp within reserved window; later delivery",flush=True)
def js_bridge_real_main():
    identity="88888888-8888-4888-8888-888888888888"
    account(identity)
    with local_connection("issuer") as i:
        issued=base.issuer(i,identity,request="b5-real-js-bridge-request-001")
        check(issued["action"],"reserved","bridge real-main issuer")
    env=os.environ.copy()
    env["RESEARCH_B5_ISSUED_INTENT_JSON"]=json.dumps(issued,default=str)
    runner=subprocess.run(["node","scripts/export-research-b5-real-rpc-vectors.mjs"],
        cwd=ROOT/"apps/web",env=env,capture_output=True,text=True,timeout=45)
    if runner.returncode:
        raise AssertionError("Real-main JS capture failed: "+runner.stderr[-1500:])
    x=json.loads(runner.stdout.strip().splitlines()[-1])["requests"]
    assert set(x)=={"issue","attach","observe","bind"}
    check(x["issue"]["p_account_id"],identity,"real-main actual JS account")
    check(x["observe"]["p_product_id"],"research-membership","real-main JS internal product")
    check(x["observe"]["p_raw_body_sha256"],x["bind"]["p_raw_body_sha256"],"real-main JS raw body digest")
    a,o,b=x["attach"],x["observe"],x["bind"]
    with local_connection("issuer") as i:
        check(one(i,"select public.attach_research_membership_checkout_intent(%s::uuid,%s,%s)",
            (a["p_intent_id"],a["p_checkout_proof"],a["p_provider_checkout_id"]))["action"],
            "attached","real-main actual JS provider attachment")
    with local_connection("verifier") as v:
        ob_keys=("p_provider","p_provider_subscription_id","p_provider_customer_id",
          "p_store_id","p_product_id","p_provider_price_id","p_test_mode",
          "p_occurred_at","p_raw_body_sha256","p_claimed_account_id",
          "p_claimed_checkout_proof_sha256","p_business_fingerprint_version",
          "p_business_fingerprint_sha256")
        obs_sql="select public.observe_signed_research_subscription_created(" \
            "%s,%s,%s,%s,%s,%s,%s,%s::timestamptz,%s,%s::uuid,%s,%s,%s)"
        check(one(v,obs_sql,tuple(o[k] for k in ob_keys))["action"],"recorded","real-main JS paid observation")
    with local_connection("binder") as binder,local_connection() as root:
        keys=("p_account_id","p_provider","p_provider_subscription_id",
          "p_provider_customer_id","p_provider_price_id","p_billing_interval",
          "p_occurred_at","p_checkout_proof","p_raw_body_sha256","p_store_id",
          "p_product_id","p_test_mode","p_business_fingerprint_version",
          "p_business_fingerprint_sha256")
        bind_sql="select public.bind_research_membership_with_checkout_intent(" \
            "%s::uuid,%s,%s,%s,%s,%s,%s::timestamptz,%s,%s,%s,%s,%s,%s,%s)"
        check(one(binder,bind_sql,tuple(b[k] for k in keys))["action"],"created","real-main JS signed paid pending")
        check(one(binder,bind_sql,tuple(b[k] for k in keys))["action"],"existing","real-main JS idempotent retry")
        check(one(root,"select count(*) from public.entitlements where account_id=%s::uuid",(identity,)),0,"real-main JS zero entitlement")
    print("PASS ACTUAL-MAIN JS->SQL: four real request bodies against exact Research column types, triggers and RLS",flush=True)
def main():
    assert os.environ.get("GITHUB_ACTIONS")=="true"
    assert os.environ.get("GITHUB_HEAD_REF")=="agent/1103-b5-rpc-sql-isolated-d1-20261104"
    assert os.environ.get("PGHOST")=="127.0.0.1"
    for key in ("SUPABASE_URL","SUPABASE_DB_URL","DATABASE_URL","LEMON_SQUEEZY_API_KEY"):
        assert not os.environ.get(key),"Remote database/provider environment is prohibited"
    bootstrap()
    base.roles()
    issued=base.issue_attach()
    custody_refund_real_main(issued)
    base.unbound()
    base.concurrent_paid()
    complimentary_library_real_main()
    base.expiry_and_immutable()
    base.catalog_quarantine()
    late_webhook_real_main()
    js_bridge_real_main()
    with local_connection() as c:
        check(one(c,"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','subscriptions','entitlements','subscription_offers') and c.relrowsecurity"),4,"actual-main four protected RLS tables")
        check(one(c,"select count(*) from pg_policies where policyname like %s",("research_b5_owner_%",)),6,"actual-main owner policy count")
    print("B5_D1_ACTUAL_MAIN_MIGRATIONS_PASS "+
        json.dumps({"migrations":list(MIGRATIONS),"rls":"ON",
        "only_local_disposable_postgres":True,
        "not_proven":["Production permissions","real HMAC/settlement",
        "credential isolation","full A43 independent oracle",
        "X8 historic receipts","O1/O4 lifecycle","D2/D3/D4/D6/D7"]}),flush=True)
if __name__=="__main__": main()
