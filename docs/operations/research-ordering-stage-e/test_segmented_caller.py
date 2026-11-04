#!/usr/bin/env python3
"""Disposable PostgreSQL 17.6 only: isolated Research writer vs shared Library Pass caller.

This is NOT trusted provider verification, Supavisor/TLS integration, or a Production fix.
No connected database can be addressed by the hardcoded loopback and synthetic creds.
"""
from __future__ import annotations
import hashlib
import importlib.util
from pathlib import Path
import psycopg

HERE = Path(__file__).resolve().parent
STAGE_C = HERE.parent/'research-ordering-stage-c'/'test_real_schema_ordering.py'
assert STAGE_C.is_file(), 'Exact Stage C source required'
spec=importlib.util.spec_from_file_location('research_e_stage_c',STAGE_C)
c=importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
assert c.DB['host']=='127.0.0.1' and c.DB['dbname']=='ci_review'
assert c.DB['user']=='ci_research' and c.DB['password']=='synthetic-stage-c-review-only'

SUBJECT='research-membership'
P17='170006'
GATEWAY_PASSWORD='synthetic-stage-e-gateway-only'
VERIFIER_PASSWORD='synthetic-stage-e-verifier-only'
CLOCK='2026-11-03T12:00:00+00:00'
GATEWAY_CALL="""select research_ordering_stage_e.apply_witnessed_review(
 %s::uuid,%s::uuid,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
 %s::timestamptz,%s::public.subscription_state,%s::timestamptz,%s::timestamptz)"""
WITNESS_INSERT="""insert into research_ordering_stage_e.verified_snapshot
 (event_key,subscription_id,account_id,provider_event_id,
  provider_subscription_id,provider_customer_id,store_id,variant_id,
  binding_fingerprint,event_fingerprint,snapshot_object_at)
 values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""


def role_db(role,password):
    return psycopg.connect(**{**c.DB,'user':role,'password':password},autocommit=False)


def deny(cx,sql,args=(), expected='42501'):
    cx.execute('SAVEPOINT negative')
    try:
        cx.execute(sql,args)
    except psycopg.Error as ex:
        code=ex.sqlstate
        cx.execute('ROLLBACK TO SAVEPOINT negative')
        cx.execute('RELEASE SAVEPOINT negative')
        assert code==expected,f'wrong SQLSTATE {code} for {sql[:100]}: {ex}'
        return
    cx.execute('ROLLBACK TO SAVEPOINT negative')
    cx.execute('RELEASE SAVEPOINT negative')
    raise AssertionError('unexpectedly allowed: '+sql[:120])


def args_for(sid,acc,key,clock=CLOCK,period=c.NEXT):
    return (sid,acc,c.PROVIDER,str(1000+int(str(sid)[-12:])),c.CUSTOMER,
            c.STORE,c.VARIANT,c.BINDING,key,key,
            hashlib.sha256(key.encode()).hexdigest(),'subscriptions',clock,
            'active',c.START,period)


def witness_args(a):
    sid,acc,_,provider_sub,customer,store,variant,binding,key,event_id,fingerprint,_,clock,_,_,_=a
    return (key,sid,acc,event_id,provider_sub,customer,store,variant,binding,fingerprint,clock)


def check_role_isolation(root):
    for role in ('research_e_owner','research_e_gateway','research_e_verifier'):
        details=root.execute('select rolcanlogin,rolbypassrls,rolsuper,rolcreaterole from pg_roles where rolname=%s',(role,)).fetchone()
        assert details is not None and not details[1] and not details[2] and not details[3]
        if role=='research_e_owner': assert not details[0]
        else: assert details[0]
    for role in ('research_e_gateway','research_e_verifier'):
        assert not root.execute('select has_table_privilege(%s,%s,%s)',(role,'public.entitlements','UPDATE')).fetchone()[0]
        assert not root.execute('select has_table_privilege(%s,%s,%s)',(role,'public.subscriptions','UPDATE')).fetchone()[0]
        assert not root.execute('select has_function_privilege(%s,%s,%s)',(
            role,
            'public.apply_research_membership_transition(uuid,text,text,text,text,public.subscription_state,public.subscription_state,timestamptz,timestamptz,boolean,public.entitlement_state,timestamptz,timestamptz,text,timestamptz,jsonb)',
            'EXECUTE')).fetchone()[0]
        assert not root.execute("select pg_has_role(%s,'research_e_owner','SET')",(role,)).fetchone()[0]
    assert root.execute("select has_function_privilege('research_e_gateway',%s,'EXECUTE')",(
        'research_ordering_stage_e.apply_witnessed_review(uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz,public.subscription_state,timestamptz,timestamptz)',)).fetchone()[0]
    assert not root.execute("select has_function_privilege('research_e_verifier',%s,'EXECUTE')",(
        'research_ordering_stage_e.apply_witnessed_review(uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz,public.subscription_state,timestamptz,timestamptz)',)).fetchone()[0]
    print('PASS independent LOGIN gateway/verifier and NOLOGIN non-BYPASSRLS owner have no legacy/direct Research write rights',flush=True)


def main():
    with c.db() as root:
        assert root.execute('show server_version_num').fetchone()[0]==P17
        c.bootstrap(root)
        acc,sid,eid=c.seed(root,15,library=True)
        baseline=c.evidence(root,sid)
        library=root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]
        root.execute((HERE/'segmented_caller_review.sql').read_text('utf-8'))
        check_role_isolation(root)

    # The original service_role retains broad DML grants, but Research-only
    # guard rejects the historical direct-write/RPC path without touching the
    # shared purchase-backed Library Pass table grant.
    with c.db(autocommit=False) as svc:
        svc.execute('SET LOCAL ROLE service_role')
        deny(svc,'update public.subscriptions set current_period_end=current_period_end where id=%s',(sid,))
        deny(svc,"update public.entitlements set state='suspended' where subscription_id=%s",(sid,))
        deny(svc,"update public.entitlements set product_id='read-the-dollar-first-guided-interactive-edition' where subscription_id=%s",(sid,))
        deny(svc,"insert into public.subscription_events (event_key,subscription_id,account_id,product_id,to_state,reason,actor_type) values ('negative',%s,%s,%s,'active','test','ci')",(sid,acc,SUBJECT))
        # Historical 16-param RPC still EXECUTE-granted but its Research writes
        # must now fail at the row guard even through this privileged role.
        deny(svc,"""select public.apply_research_membership_transition(
          %s::uuid,%s,%s,%s,%s,%s::public.subscription_state,
          %s::public.subscription_state,%s::timestamptz,%s::timestamptz,%s,
          %s::public.entitlement_state,%s::timestamptz,%s::timestamptz,%s,
          %s::timestamptz,%s::jsonb)""",(
            sid,'negative-legacy','synthetic','lemon-squeezy','1015',
            'active','past_due',c.START,'2026-11-01T00:00:00+00:00',False,
            'suspended',c.START,'2026-11-01T00:00:00+00:00',
            'synthetic','2026-10-30T00:00:00+00:00','{}'))
        assert svc.execute("update public.entitlements set state='suspended' where account_id=%s and purchase_id is not null",(acc,)).rowcount==1
        svc.rollback()
    with c.db() as root:
        assert c.evidence(root,sid)==baseline
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]==library
    print('PASS product-scoped guard blocks legacy Research RPC/direct DML but preserves shared Library Pass UPDATE; rolled back',flush=True)

    good=args_for(sid,acc,'stage-e-renewal')
    with role_db('research_e_gateway',GATEWAY_PASSWORD) as gw:
        who=gw.execute('select current_user,session_user').fetchone()
        assert who==('research_e_gateway','research_e_gateway')
        deny(gw,'SET ROLE research_e_owner')
        deny(gw,"update public.entitlements set state='suspended' where subscription_id=%s",(sid,))
        deny(gw,WITNESS_INSERT,witness_args(good))
        deny(gw,GATEWAY_CALL,good)  # missing independent witness must fail closed
        gw.rollback()
    with role_db('research_e_verifier',VERIFIER_PASSWORD) as verifier:
        who=verifier.execute('select current_user,session_user').fetchone()
        assert who==('research_e_verifier','research_e_verifier')
        deny(verifier,'SET ROLE research_e_owner')
        deny(verifier,GATEWAY_CALL,good)
        deny(verifier,"update public.entitlements set state='suspended' where subscription_id=%s",(sid,))
        verifier.execute(WITNESS_INSERT,witness_args(good))
        deny(verifier,"update research_ordering_stage_e.verified_snapshot set provider_customer_id='forged' where event_key='stage-e-renewal'")
        verifier.commit()
    with role_db('research_e_gateway',GATEWAY_PASSWORD) as gw:
        result=gw.execute(GATEWAY_CALL,good).fetchone()[0]
        assert result['action']=='applied',result
        gw.commit()
    with c.db() as root:
        sub=root.execute('select current_period_end,state::text from public.subscriptions where id=%s',(sid,)).fetchone()
        ent=root.execute('select ends_at,state::text from public.entitlements where subscription_id=%s',(sid,)).fetchone()
        assert str(sub[0])==str(ent[0]) and sub[1]=='active' and ent[1]=='active'
        assert sub[0].isoformat().startswith('2027-01-01')
        assert root.execute("select disposition from research_ordering_stage_c.delivery_audit where event_key='stage-e-renewal'").fetchone()[0]=='applied'
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]==library
    print('PASS separate synthetic verifier witness and restricted gateway execute one genuine role-limited Research renewal',flush=True)

    # Independent event identity and timestamp are required, not a caller bool.
    with role_db('research_e_gateway',GATEWAY_PASSWORD) as gw:
        dup=gw.execute(GATEWAY_CALL,good).fetchone()[0]
        assert dup['action']=='duplicate',dup
        gw.commit()
    stale=args_for(sid,acc,'stage-e-stale','2026-11-02T12:00:00+00:00',c.END)
    with role_db('research_e_verifier',VERIFIER_PASSWORD) as verifier:
        verifier.execute(WITNESS_INSERT,witness_args(stale))
        verifier.commit()
    with role_db('research_e_gateway',GATEWAY_PASSWORD) as gw:
        result=gw.execute(GATEWAY_CALL,stale).fetchone()[0]
        assert result['action']=='stale_ignored',result
        # A valid witness for an unrelated event must not authorize a new key.
        forged=list(stale)
        forged[8]='stage-e-other-event';forged[9]='stage-e-other-event'
        forged[10]=hashlib.sha256(forged[8].encode()).hexdigest()
        deny(gw,GATEWAY_CALL,tuple(forged))
        gw.commit()
    with c.db(autocommit=False) as root:
        assert root.execute('select current_period_end from public.subscriptions where id=%s',(sid,)).fetchone()[0].isoformat().startswith('2027-01-01')
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]==library
        deny(root,"update research_ordering_stage_e.verified_snapshot set provider_customer_id='forged' where event_key='stage-e-renewal'")
        assert root.execute("select count(*) from research_ordering_stage_e.verified_snapshot").fetchone()[0]==2
    print('PASS duplicate idempotence, stale event rejection, witness scope and immutable synthetic evidence',flush=True)
    print('STAGE_E_SEGMENTED_CALLER_REVIEW_PASS (NOT A LIVE FIX; OLD DEF-INER PATHS NEED SEPARATE CUTOVER)',flush=True)

if __name__=='__main__':
    main()
