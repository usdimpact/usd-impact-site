#!/usr/bin/env python3
"""Stage F disposable PG17 effect-bound witness negative review; NO CONNECTED DB."""
from __future__ import annotations
import concurrent.futures
import importlib.util
from pathlib import Path
import threading
import psycopg

HERE=Path(__file__).resolve().parent
STAGE_E=HERE.parent/'research-ordering-stage-e'/'test_segmented_caller.py'
assert STAGE_E.is_file(),'Original Stage E source required'
spec=importlib.util.spec_from_file_location('stage_e',STAGE_E)
e=importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)
c=e.c
assert c.DB==dict(host='127.0.0.1',port=5432,dbname='ci_review',user='ci_research',password='synthetic-stage-c-review-only',connect_timeout=5)
assert HERE.name=='research-ordering-stage-f'
F_CALL="""select research_ordering_stage_f.apply_strict_review(
 %s::uuid,%s::uuid,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
 %s::timestamptz,%s::public.subscription_state,%s::timestamptz,%s::timestamptz)"""
F_INSERT="""insert into research_ordering_stage_f.verified_transition (
 event_key,subscription_id,account_id,provider,provider_event_id,
 provider_subscription_id,provider_customer_id,store_id,variant_id,
 binding_fingerprint,event_fingerprint,source_type,snapshot_object_at,
 target_state,target_period_start,target_period_end,
 expected_subscription_version,expected_entitlement_version,provider_snapshot_version)
 values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""


def versions(sid):
    with c.db() as root:
        return (root.execute('select version from public.subscriptions where id=%s',(sid,)).fetchone()[0],
                root.execute("select version from public.entitlements where subscription_id=%s and product_id='research-membership'",(sid,)).fetchone()[0])


def witness(a,vs,provider_version='synthetic-provider-v1'):
    sid,acc,prov,psub,pcustomer,store,variant,binding,key,pevent,fp,kind,clock,state,start,end=a
    return (key,sid,acc,prov,pevent,psub,pcustomer,store,variant,binding,fp,kind,
            clock,state,start,end,vs[0],vs[1],provider_version)


def insert_witness(a,vs):
    with e.role_db('research_e_verifier',e.VERIFIER_PASSWORD) as vr:
        vr.execute(F_INSERT,witness(a,vs))
        vr.commit()


def call_gateway(a):
    with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
        result=gw.execute(F_CALL,a).fetchone()[0]
        gw.commit()
        return result


def deny_gateway(a):
    with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
        e.deny(gw,F_CALL,a)
        gw.rollback()


def main():
    with c.db() as root:
        assert root.execute('show server_version_num').fetchone()[0]=='170006'
        c.bootstrap(root)
        acc,sid,_=c.seed(root,18,library=True)
        baseline=c.evidence(root,sid)
        lib=root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]
        root.execute((HERE.parent/'research-ordering-stage-e'/'segmented_caller_review.sql').read_text('utf-8'))

    # Red test: Stage E witnesses bind the signed-event identity, NOT the target
    # state or paid period. A gateway can change the effect without another
    # verifier authorization. Both successful malicious effects are ROLLED BACK.
    original=e.args_for(sid,acc,'stage-f-stage-e-gap')
    with e.role_db('research_e_verifier',e.VERIFIER_PASSWORD) as vr:
        vr.execute(e.WITNESS_INSERT,e.witness_args(original))
        vr.commit()
    far_future=list(original)
    far_future[-1]='2035-01-01T00:00:00+00:00'
    with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
        outcome=gw.execute(e.GATEWAY_CALL,tuple(far_future)).fetchone()[0]
        assert outcome['action']=='applied',outcome
        gw.rollback()
    suspended=list(original)
    suspended[-3]='past_due'
    with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
        outcome=gw.execute(e.GATEWAY_CALL,tuple(suspended)).fetchone()[0]
        assert outcome['action']=='applied',outcome
        gw.rollback()
    with c.db() as root:
        assert c.evidence(root,sid)==baseline,'Stage E negative reproduction escaped rollback'
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]==lib
    print('CONFIRMED DESIGN GAP: Stage E allows gateway substitution of paid end AND target state using the same witness; both rolled back',flush=True)

    # Green candidate: separate attestation for every transition effect;
    # old unsafe entry point is retired atomically in disposable SQL only.
    with c.db() as root:
        root.execute((HERE/'strict_witness_review.sql').read_text('utf-8'))
        assert root.execute("select has_function_privilege('research_e_gateway',%s,'EXECUTE')",(
          'research_ordering_stage_f.apply_strict_review(uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz,public.subscription_state,timestamptz,timestamptz)',)).fetchone()[0]
        assert not root.execute("select has_function_privilege('research_e_gateway',%s,'EXECUTE')",(
          'research_ordering_stage_e.apply_witnessed_review(uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz,public.subscription_state,timestamptz,timestamptz)',)).fetchone()[0]
    good=e.args_for(sid,acc,'stage-f-good')
    with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
        e.deny(gw,e.GATEWAY_CALL,original)
        e.deny(gw,F_INSERT,witness(good,versions(sid)))
        e.deny(gw,F_CALL,good)  # no effect-bound evidence yet
        gw.rollback()
    with e.role_db('research_e_verifier',e.VERIFIER_PASSWORD) as vr:
        e.deny(vr,F_CALL,good)
        vr.rollback()
    v0=versions(sid)
    insert_witness(good,v0)
    for change in ('state','start','end','source'):
        bad=list(good)
        if change=='state':bad[-3]='past_due'
        elif change=='start':bad[-2]='2026-11-02T00:00:00+00:00'
        elif change=='end':bad[-1]='2035-01-01T00:00:00+00:00'
        else:bad[11]='subscription-invoices'
        deny_gateway(tuple(bad))
    assert call_gateway(good)['action']=='applied'
    assert call_gateway(good)['action']=='duplicate'
    print('PASS effect-bound attestation denies state, start, end and object-type substitution; retires unsafe wrapper; duplicate idempotent',flush=True)

    # An already-issued witness cannot change current subscription state
    # after another committed transition, even if its event clock is newer.
    stale=e.args_for(sid,acc,'stage-f-stale-version',clock='2026-11-04T08:00:00+00:00',period='2027-02-01T00:00:00+00:00')
    insert_witness(stale,v0)
    deny_gateway(stale)
    with c.db() as root:
        assert root.execute("select 1 from research_ordering_stage_c.delivery_audit where event_key='stage-f-stale-version'").fetchone() is None
    print('PASS committed database-version change makes preissued witness fail closed, no audit/state changes',flush=True)

    # Two verified events may be valid against the same DB row version. Lock
    # serializes them: exactly one may commit and the other must be denied.
    v1=versions(sid)
    event_a=e.args_for(sid,acc,'stage-f-race-a',clock='2026-11-04T12:00:00+00:00',period='2027-03-01T00:00:00+00:00')
    event_b=e.args_for(sid,acc,'stage-f-race-b',clock='2026-11-05T12:00:00+00:00',period='2027-04-01T00:00:00+00:00')
    insert_witness(event_a,v1)
    insert_witness(event_b,v1)
    barrier=threading.Barrier(2)
    def worker(a):
        with e.role_db('research_e_gateway',e.GATEWAY_PASSWORD) as gw:
            barrier.wait(timeout=8)
            try:
                value=gw.execute(F_CALL,a).fetchone()[0]
                gw.commit()
                return ('applied',value['action'])
            except psycopg.Error as ex:
                gw.rollback()
                return ('denied',ex.sqlstate)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(worker,x) for x in (event_a,event_b)]
        results=[f.result(timeout=15) for f in futures]
    assert sorted(results)==[('applied','applied'),('denied','42501')],results
    with c.db() as root:
        assert root.execute("select count(*) from research_ordering_stage_c.delivery_audit where event_key in ('stage-f-race-a','stage-f-race-b')").fetchone()[0]==1
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(acc,)).fetchone()[0]==lib
        assert root.execute("select count(*) from research_ordering_stage_f.verified_transition").fetchone()[0]==4
    print('PASS real two-backend version-fenced race: one applied, one 42501 denied; Library Pass invariant intact',flush=True)
    print('STAGE_F_EFFECT_BOUND_WITNESS_REVIEW_PASS (SYNTHETIC PROVIDER EVIDENCE, NOT LIVE FIX)',flush=True)


if __name__=='__main__':
    main()
