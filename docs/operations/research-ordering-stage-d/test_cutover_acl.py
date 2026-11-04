#!/usr/bin/env python3
"""Test-only partial-cutover ACL behavior on six historical Research migrations.

ALL ROLE REVOKES AND ALL WRITES ARE ROLLED BACK, INCLUDING TEST SETUP WRITES.
No Supabase, merchant, provider or customer host is contacted.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import psycopg

HERE=Path(__file__).resolve().parent
STAGE_C=HERE.parent/'research-ordering-stage-c'/'test_real_schema_ordering.py'
assert STAGE_C.is_file(), 'Stage C exact source is required'
spec=importlib.util.spec_from_file_location('stage_c_original',STAGE_C)
c=importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
assert c.DB['host']=='127.0.0.1' and c.DB['dbname']=='ci_review'
assert c.DB['user']=='ci_research' and c.DB['password']=='synthetic-stage-c-review-only'
RESEARCH='research-membership'


def one(q,*args):
    with c.db() as cx:
        return cx.execute(q,args).fetchone()[0]


def acl(cx):
    return {
      'legacy_exec':cx.execute("""select has_function_privilege('service_role',
      'public.apply_research_membership_transition(uuid,text,text,text,text,public.subscription_state,public.subscription_state,timestamptz,timestamptz,boolean,public.entitlement_state,timestamptz,timestamptz,text,timestamptz,jsonb)'::regprocedure,'EXECUTE')""").fetchone()[0],
      'subscription_update':cx.execute("select has_table_privilege('service_role','public.subscriptions','UPDATE')").fetchone()[0],
      'entitlement_update':cx.execute("select has_table_privilege('service_role','public.entitlements','UPDATE')").fetchone()[0],
      'entitlement_insert':cx.execute("select has_table_privilege('service_role','public.entitlements','INSERT')").fetchone()[0],
      'entitlement_delete':cx.execute("select has_table_privilege('service_role','public.entitlements','DELETE')").fetchone()[0],
      'entitlement_select':cx.execute("select has_table_privilege('service_role','public.entitlements','SELECT')").fetchone()[0],
      'binder_execute':cx.execute("""select has_function_privilege('service_role',
      'public.bind_research_membership_subscription(uuid,text,text,text,text,public.subscription_billing_interval,timestamptz,jsonb)'::regprocedure,'EXECUTE')""").fetchone()[0],
      'subscription_events_insert':cx.execute("select has_table_privilege('service_role','public.subscription_events','INSERT')").fetchone()[0],
      'entitlement_events_insert':cx.execute("select has_table_privilege('service_role','public.entitlement_events','INSERT')").fetchone()[0]
    }


def denied(cx,sql,args=()):
    cx.execute('SAVEPOINT test_denied')
    try:
        cx.execute(sql,args)
    except psycopg.Error as err:
        code=err.sqlstate
        cx.execute('ROLLBACK TO SAVEPOINT test_denied')
        cx.execute('RELEASE SAVEPOINT test_denied')
        assert code=='42501',f'expected permission denial, found {code}: {err}'
        return
    cx.execute('ROLLBACK TO SAVEPOINT test_denied')
    cx.execute('RELEASE SAVEPOINT test_denied')
    raise AssertionError('unauthorized SQL succeeded: '+sql[:130])


def main():
    with c.db() as root:
        assert root.execute('show server_version_num').fetchone()[0]=='170006'
        c.bootstrap(root)
        account,sid,_=c.seed(root,1,library=True)
        initial=c.evidence(root,sid)
        library=root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(account,)).fetchone()[0]
        before=acl(root)
        assert before['legacy_exec'] and before['subscription_update'] and before['entitlement_update']
        assert before['entitlement_insert'] and before['binder_execute']
        assert before['subscription_events_insert'] and before['entitlement_events_insert']
        assert before['entitlement_select']
        print('PASS historical six-migration ACL confirms legacy RPC and direct Research privileges',flush=True)

    # Demonstrate SHARED-OBJECT risk: the same service credential can change
    # a purchase-backed Library Pass entitlement, and a blanket UPDATE revoke
    # also removes that capability. Both sides stay in disposable rollbacks.
    with c.db(autocommit=False) as role_test:
        role_test.execute('set local role service_role')
        updated=role_test.execute("update public.entitlements set state='suspended' where account_id=%s and purchase_id is not null",(account,))
        assert updated.rowcount==1,'historical service role should write one purchase-backed fixture'
        role_test.rollback()
    with c.db() as root:
        assert root.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(account,)).fetchone()[0]==library

    candidate=(HERE/'candidate_acl_review.sql').read_text('utf-8')
    assert candidate.startswith('-- DISPOSABLE CI REVIEW ONLY.')
    assert 'begin;' not in candidate.lower() and 'commit;' not in candidate.lower()
    with c.db(autocommit=False) as review:
        review.execute(candidate)
        after=acl(review)
        assert not after['legacy_exec'] and not after['subscription_update']
        assert not after['entitlement_update'] and not after['entitlement_insert']
        assert not after['entitlement_delete'] and not after['subscription_events_insert']
        assert not after['entitlement_events_insert']
        assert after['entitlement_select'] and after['binder_execute']
        # The same low-level role loses BOTH Research and Library Pass direct
        # mutations: this is an outage-risk witness, NOT approval to revoke.
        review.execute('SET LOCAL ROLE service_role')
        denied(review,'update public.subscriptions set current_period_end=current_period_end where id=%s',(sid,))
        denied(review,"update public.entitlements set state='suspended' where subscription_id=%s",(sid,))
        denied(review,"update public.entitlements set state='suspended' where account_id=%s and purchase_id is not null",(account,))
        denied(review,"insert into public.subscription_events (event_key,subscription_id,account_id,product_id,to_state,reason,actor_type) values ('cutover-negative',%s,%s,%s,'active','test','ci')",(sid,account,RESEARCH))
        # A previously callable legacy RPC must no longer be executable.
        denied(review,"""select public.apply_research_membership_transition(
          %s::uuid,%s,%s,%s,%s,%s::public.subscription_state,
          %s::public.subscription_state,%s::timestamptz,%s::timestamptz,%s,
          %s::public.entitlement_state,%s::timestamptz,%s::timestamptz,%s,
          %s::timestamptz,%s::jsonb)""",(
          sid,'cutover-denied','synthetic-event','lemon-squeezy','1001',
          'active','past_due',c.START,'2026-11-15T00:00:00+00:00',False,
          'suspended',c.START,'2026-11-15T00:00:00+00:00',
          'synthetic','2026-10-30T00:00:00+00:00','{}'))
        review.rollback()  # CRITICAL: all grants revert, no persistent cutover.

    with c.db() as verify:
        assert acl(verify)==before, 'a simulated ACL cutover escaped rollback'
        assert c.evidence(verify,sid)==initial, 'subscription or evidence changed'
        assert verify.execute("select row_to_json(e)::text from public.entitlements e where account_id=%s and purchase_id is not null",(account,)).fetchone()[0]==library
    print('PASS isolated candidate revokes DENY old RPC, direct Research UPDATE and shared Library Pass UPDATE',flush=True)
    print('PASS original grants and purchase-backed Library Pass state unchanged after ROLLBACK',flush=True)
    print('STAGE_D_ACL_BLAST_RADIUS_REVIEW_PASS (CANDIDATE NOT DEPLOYABLE; LIVE P1 OPEN)',flush=True)


if __name__=='__main__':
    main()
