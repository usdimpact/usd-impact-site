#!/usr/bin/env python3
"""B-4.1 isolated D1 REAL PostgreSQL negative tests; no live provider/Supabase."""
import os
from pathlib import Path
import psycopg

ROOT=Path(__file__).resolve().parent.parent
SQL=ROOT/"docs/operations/research-b41-reservation-provenance-2026-11-04.sql"
DB=dict(host="127.0.0.1",port=5432,dbname="ci_review",connect_timeout=5,autocommit=True)
A3="33333333-3333-4333-8333-333333333333"
A4="44444444-4444-4444-8444-444444444444"
A5="55555555-5555-4555-8555-555555555555"

def guard():
    assert os.getenv("GITHUB_ACTIONS")=="true" and os.getenv("CI")=="true"
    assert (os.getenv("PGHOST"),os.getenv("PGPORT"),os.getenv("PGDATABASE"),
            os.getenv("PGUSER"),os.getenv("PGPASSWORD"))==(
                "127.0.0.1","5432","ci_review","ci_research","ci_fixture_only_password")
    s=SQL.read_text()
    assert "ISOLATED D1 SYNTHETIC POSTGRES ONLY" in s
    assert "create schema research_private" not in s.lower()
    assert "supabase.co" not in s.lower()
    return s

def connect(user,pw):
    return psycopg.connect(**DB,user=user,password=pw)

def call(conn,name,args):
    allowed={
        "issue_reserved_checkout_v41","record_verified_paid_v41",
        "bind_reserved_paid_v41","activate_pending_paid_v41"
    }
    assert name in allowed
    params=",".join(["%s"]*len(args))
    with conn.cursor() as c:
        c.execute("select research_binding_review."+name+"("+params+")",args)
        return c.fetchone()[0]

def query(conn,sql,args=()):
    with conn.cursor() as c:
        c.execute(sql,args)
        return [] if c.description is None else c.fetchall()

def one(conn,sql,args=()):
    return query(conn,sql,args)[0][0]

def refused(fn,code="42501"):
    caught=None
    try:fn()
    except psycopg.Error as e:caught=e
    assert caught is not None,"Permission/append-only refusal expected"
    assert caught.sqlstate==code,(caught.sqlstate,str(caught))
    return caught

def issuer_checkout(issuer,account,price="review-monthly"):
    r=call(issuer,"issue_reserved_checkout_v41",[account,price])
    assert r["disposition"]=="issued",r
    assert len(r["checkout_key"])>=30
    return r["checkout_key"]

def event(verifier,account,sub,ev,key,price="review-monthly",state="paid"):
    return call(verifier,"record_verified_paid_v41",
        [account,sub,ev,key,price,"a"*64,"research-hmac-review-v1",state])

def bind(api,account,sub,ev,key):
    return call(api,"bind_reserved_paid_v41",[account,sub,ev,key])

def activate(api,account,sub,ev):
    return call(api,"activate_pending_paid_v41",[account,sub,ev])

def conflict_rows(root,event_id):
    return query(root, "select code,claimed_account_id from research_binding_review.conflicts_v41 where provider_event_id=%s order by observed_at,id",(event_id,))

def entitlement_rows(root,account):
    return one(root,
        """select coalesce(jsonb_agg(to_jsonb(e) order by id), '[]'::jsonb)
           from research_binding_review.entitlements e where account_id=%s::uuid""",
        (account,))

def test_privileges(root,issuer,verifier,api):
    # The untrusted binding API cannot fabricate a "verified" paid event,
    # or mint a server-issued checkout key.
    assert one(api,"select current_user")=="review_binding_api"
    assert not one(root,"select has_function_privilege('review_binding_api','research_binding_review.record_verified_paid_v41(uuid,text,text,text,text,text,text,text)','EXECUTE')")
    assert not one(root,"select has_function_privilege('review_binding_api','research_binding_review.issue_reserved_checkout_v41(uuid,text)','EXECUTE')")
    assert not one(root,"select has_function_privilege('review_b41_checkout_issuer','research_binding_review.record_verified_paid_v41(uuid,text,text,text,text,text,text,text)','EXECUTE')")
    assert not one(root,"select has_function_privilege('review_b41_paid_verifier','research_binding_review.issue_reserved_checkout_v41(uuid,text)','EXECUTE')")
    assert not one(root,"select has_function_privilege('review_binding_api','research_binding_review.observe_signed_paid(uuid,text,text)','EXECUTE')")
    refused(lambda: event(api,A3,"fake-api-sub","fake-api-event","forged"))
    refused(lambda: call(api,"issue_reserved_checkout_v41",[A3,"review-monthly"]))
    refused(lambda: api.execute("set role review_binding_writer"))
    refused(lambda: api.execute("update research_binding_review.verified_paid_events_v41 set disposition='accepted'"))
    assert not one(root,"select pg_has_role('review_binding_api','review_binding_writer','MEMBER')")
    assert not one(root,"select pg_has_role('review_b41_paid_verifier','review_binding_writer','MEMBER')")
    print("PASS B41 Y1 synthetic trust-boundary: API cannot mint paid proof or reservation; still NO real HMAC verification")

def test_reservation_and_happy_path(root,issuer,verifier,api):
    before=entitlement_rows(root,A3)
    key=issuer_checkout(issuer,A3)
    r=event(verifier,A3,"b41-good-sub","b41-good-event",key)
    assert r["disposition"]=="accepted",r
    made=bind(api,A3,"b41-good-sub","b41-good-event",key)
    assert made["disposition"]=="created",made
    assert bind(api,A3,"b41-good-sub","b41-good-event",key)["disposition"]=="already_bound"
    assert activate(api,A3,"b41-good-sub","b41-good-event")["disposition"]=="activated"
    assert activate(api,A3,"b41-good-sub","b41-good-event")["disposition"]=="already_active"
    after=entitlement_rows(root,A3)
    assert len(after)==len(before)+1
    assert any(x["product_id"]=="research-membership" and x["provider_subscription_id"]=="b41-good-sub" for x in after)
    print("PASS B41 server-issued reservation + verifier-only evidence + pending->active synthetic path")

def test_forged_and_direct_share(root,issuer,verifier,api):
    # A direct Buy link lets the customer invent custom metadata. Signed
    # webhook alone would not prove checkout key was issued by our server.
    existing=one(root,"select count(*) from research_binding_review.subscriptions")
    unissued=event(verifier,A4,"b41-forged-sub","b41-forged-event","customer-invented-key")
    assert unissued["disposition"]=="accepted",unissued
    refused_bind=bind(api,A4,"b41-forged-sub","b41-forged-event","customer-invented-key")
    assert refused_bind=={"disposition":"conflict","code":"unissued_checkout_key"},refused_bind
    assert conflict_rows(root,"b41-forged-event")[0][0]=="unissued_checkout_key"
    direct=event(verifier,None,"b41-share-sub","b41-share-event",None)
    assert direct["disposition"]=="unbound",direct
    assert conflict_rows(root,"b41-share-event")[0][0]=="missing_custom_binding"
    assert bind(api,A4,"b41-share-sub","b41-share-event","anything")["disposition"]=="unverified_or_unbound"
    assert one(root,"select count(*) from research_binding_review.subscriptions")==existing
    print("PASS B41 N36-1/D5 synthetic: forged URL key and direct unbound event cannot grant access")

def test_refunded_and_consumed(root,issuer,verifier,api):
    root.execute("insert into research_binding_review.profiles(account_id,status) values (%s::uuid,'active')",(A4,))
    key=issuer_checkout(issuer,A4)
    assert event(verifier,A4,"b41-refund-sub","b41-refund-event",key)["disposition"]=="accepted"
    assert bind(api,A4,"b41-refund-sub","b41-refund-event",key)["disposition"]=="created"
    root.execute("update research_binding_review.subscriptions set status='refunded' where provider_subscription_id='b41-refund-sub'")
    before=entitlement_rows(root,A4)
    no=activate(api,A4,"b41-refund-sub","b41-refund-event")
    assert no=={"disposition":"conflict","code":"subscription_not_pending"},no
    assert conflict_rows(root,"b41-refund-event")[0][0]=="subscription_not_pending"
    assert entitlement_rows(root,A4)==before
    # An issued key that is already consumed may not bind a second sub.
    assert event(verifier,A4,"b41-second-sub","b41-second-event",key)["disposition"]=="accepted"
    second=bind(api,A4,"b41-second-sub","b41-second-event",key)
    assert second=={"disposition":"conflict","code":"checkout_consumed_by_other"},second
    print("PASS B41 Y2: refunded cannot activate; consumed checkout cannot bind second paid sub")

def test_identity_conflict_at_observation(root,verifier,api):
    first=event(verifier,A3,"b41-cross-account-sub","b41-cross-event-a","not-reserved")
    assert first["disposition"]=="accepted"
    second=event(verifier,A4,"b41-cross-account-sub","b41-cross-event-b","not-reserved")
    assert second["disposition"]=="identity_conflict",second
    assert conflict_rows(root,"b41-cross-event-b")[0][0]=="provider_identity_conflict"
    assert bind(api,A4,"b41-cross-account-sub","b41-cross-event-b","not-reserved")["disposition"]=="unverified_or_unbound"
    print("PASS B41 Y3: second account identity collision flagged at verification observation time")

def test_defaults_and_library_guard(root,api):
    # Verify new functions default to no PUBLIC execute, not merely runtime
    # schema USAGE restriction. This canary is created after the DDL block.
    root.execute("create function research_binding_review.b41_default_canary() returns integer language sql as $$select 1$$")
    assert not one(root,"select has_function_privilege('review_binding_anon','research_binding_review.b41_default_canary()','EXECUTE')")
    assert not one(root,"select has_function_privilege('review_binding_authenticated','research_binding_review.b41_default_canary()','EXECUTE')")
    root.execute("drop function research_binding_review.b41_default_canary()")
    # The synthetic writer has broad UPDATE on entitlements but a product
    # trigger must prevent mutation across Library Pass rows.
    before=one(root,"select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from research_binding_review.entitlements x where product_id='library-pass'")
    refused(lambda:root.execute("update research_binding_review.entitlements set state='revoked' where product_id='library-pass'"))
    refused(lambda:root.execute("delete from research_binding_review.entitlements where product_id='library-pass'"))
    after=one(root,"select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from research_binding_review.entitlements x where product_id='library-pass'")
    assert after==before,"Library Pass changed"
    print("PASS B41 Y5/Y6: late function no PUBLIC EXECUTE; Library Pass mutation trigger blocks even privileged writer")

def test_expiry(root,issuer,verifier,api):
    root.execute("insert into research_binding_review.profiles(account_id,status) values (%s::uuid,'active')",(A5,))
    key=issuer_checkout(issuer,A5,"review-annual")
    assert event(verifier,A5,"b41-expired-sub","b41-expired-event",key,"review-annual")["disposition"]=="accepted"
    root.execute("update research_binding_review.checkout_reservations_v41 set expires_at=clock_timestamp()-interval '1 second' where account_id=%s::uuid",(A5,))
    r=bind(api,A5,"b41-expired-sub","b41-expired-event",key)
    assert r=={"disposition":"conflict","code":"expired_checkout_key"},r
    assert conflict_rows(root,"b41-expired-event")[0][0]=="expired_checkout_key"
    print("PASS B41 expected false-positive recovery debt: legitimate but expired reservation fails closed")

def main():
    sql=guard()
    with connect("ci_research","ci_fixture_only_password") as root:
        root.execute(sql)
        with connect("review_b41_checkout_issuer","ci_b41_issuer_only_password") as issuer, \
             connect("review_b41_paid_verifier","ci_b41_verifier_only_password") as verifier, \
             connect("review_binding_api","ci_review_api_only_password") as api:
            test_privileges(root,issuer,verifier,api)
            test_forged_and_direct_share(root,issuer,verifier,api)
            test_reservation_and_happy_path(root,issuer,verifier,api)
            test_refunded_and_consumed(root,issuer,verifier,api)
            test_identity_conflict_at_observation(root,verifier,api)
            test_defaults_and_library_guard(root,api)
            test_expiry(root,issuer,verifier,api)
    print("PASS B41 SYNTHETIC real PostgreSQL checkout reservation, caller-bound verification and negative access tests.")
    print("NOT TESTED: real provider HMAC, signed subscription authority, true customer sessions, Production RLS, D2 grants, actual checkout/payment, or live entitlements.")

if __name__=="__main__":
    main()
