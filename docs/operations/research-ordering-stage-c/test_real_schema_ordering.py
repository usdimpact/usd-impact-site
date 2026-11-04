#!/usr/bin/env python3
"""Six historical USD Impact Research migrations + private O1/O4 PG17 review; no connected Supabase."""
from __future__ import annotations
import concurrent.futures
import hashlib
import os
from pathlib import Path
import threading
import time
import uuid
import psycopg

ROOT = Path(__file__).resolve().parents[3]  # <repo>/docs/operations/research-ordering-stage-c
HERE = Path(__file__).resolve().parent
DB = dict(host=os.getenv('PGHOST'),port=int(os.getenv('PGPORT','5432')),
          dbname=os.getenv('PGDATABASE'),user=os.getenv('PGUSER'),password=os.getenv('PGPASSWORD'),connect_timeout=5)
assert DB['host']=='127.0.0.1' and DB['dbname']=='ci_review'
assert DB['user']=='ci_research' and DB['password']=='synthetic-stage-c-review-only'
for key in ('SUPABASE_URL','SUPABASE_DB_URL','DATABASE_URL','LEMON_SQUEEZY_API_KEY'):
    assert not os.getenv(key), f'remote credential is forbidden: {key}'
MIGRATIONS = [
 '20260729203000_paid_access_foundation.sql',
 '20260905201000_research_membership_recurring_foundation.sql',
 '20260906004500_research_membership_transition_persistence.sql',
 '20260906104500_research_membership_performance_hardening.sql',
 '20260906180500_research_membership_service_role_grants.sql',
 '20260907154500_research_membership_first_purchase_binding.sql'
]
A='2026-11-01T12:00:00+00:00'
END='2026-12-01T00:00:00+00:00'
START='2026-11-01T00:00:00+00:00'
NEXT='2027-01-01T00:00:00+00:00'
STORE='41'; VARIANT='313'; CUSTOMER='78'; PROVIDER='lemon-squeezy'; BINDING='f'*64
CALL_SQL = """select research_ordering_stage_c.apply_real_schema_review(
 %s::uuid,%s::uuid,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
 %s::timestamptz,%s::public.subscription_state,%s::timestamptz,%s::timestamptz,%s)"""


def db(autocommit=True):
    return psycopg.connect(**DB,autocommit=autocommit)


def bootstrap(c):
    c.execute("""create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable set search_path='' as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
    """)
    for name in MIGRATIONS:
        p=ROOT/'supabase'/'migrations'/name
        assert p.is_file(),f'missing historical migration {name}'
        content=p.read_text('utf-8')
        assert content.startswith('begin;') and content.rstrip().endswith('commit;')
        c.execute(content)
    c.execute((HERE/'real_schema_ordering_review.sql').read_text('utf-8'))
    assert c.execute("select count(*) from pg_class where relname='subscriptions' and relnamespace='public'::regnamespace and relrowsecurity").fetchone()[0]==1
    assert c.execute("select count(*) from pg_class where relname='entitlements' and relnamespace='public'::regnamespace and relrowsecurity").fetchone()[0]==1
    assert c.execute("select count(*) from pg_proc where proname='apply_research_membership_transition' and pronamespace='public'::regnamespace").fetchone()[0]==1
    # The still-open direct service_role WRITE path is explicitly detected, NOT fixed.
    assert c.execute("select has_table_privilege('service_role','public.subscriptions','UPDATE')").fetchone()[0]
    assert c.execute("select has_table_privilege('service_role','public.entitlements','UPDATE')").fetchone()[0]
    assert c.execute("select has_schema_privilege('service_role','research_ordering_stage_c','USAGE')").fetchone()[0] is False
    print('PASS six actual historical Research migrations, RLS, and acknowledged legacy service_role bypass risk',flush=True)


def seed(c,i, *, state='active',watermark=A,period_end=END, library=False):
    acc=uuid.UUID(f'11111111-1111-4111-8111-{i:012d}')
    sid=uuid.UUID(f'22222222-2222-4222-8222-{i:012d}')
    eid=uuid.UUID(f'33333333-3333-4333-8333-{i:012d}')
    c.execute('insert into auth.users(id,email) values (%s,%s)',(acc,f'synthetic-review-{i}@invalid.example'))
    c.execute("""insert into public.subscriptions
      (id,account_id,product_id,provider,provider_subscription_id,provider_customer_id,
       provider_price_id,billing_interval,state,current_period_start,current_period_end,metadata)
       values (%s,%s,'research-membership','lemon-squeezy',%s,%s,%s,'monthly',%s,%s,%s,
       jsonb_build_object('review_store_id',%s::text,'review_variant_id',%s::text,'review_binding_fingerprint',%s::text))""",
      (sid,acc,str(1000+i),CUSTOMER,VARIANT,state,START,period_end,STORE,VARIANT,BINDING))
    c.execute("""insert into public.entitlements
      (id,account_id,subscription_id,product_id,state,starts_at,ends_at)
      values (%s,%s,%s,'research-membership','active',%s,%s)""",(eid,acc,sid,START,period_end))
    if watermark is not None:
        c.execute("""insert into research_ordering_stage_c.applied_watermarks
          (subscription_id,subscription_object_at,source_event_key,witness_digest)
          values (%s,%s,'synthetic-initial-snapshot',%s)""",(sid,watermark,'a'*64))
    if library:
        lib=uuid.UUID(f'44444444-4444-4444-8444-{i:012d}')
        purchase=uuid.UUID(f'55555555-5555-4555-8555-{i:012d}')
        c.execute("""insert into public.purchases
          (id,account_id,product_id,provider,provider_transaction_id,status,amount_cents,
           currency,price_tier,offer_terms,completed_at) values
          (%s,%s,'read-the-dollar-first-guided-interactive-edition','review-provider',%s,
           'completed',3900,'USD','launch','{}','2026-09-01T00:00:00Z')""",
          (purchase,acc,f'synthetic-one-time-{i}'))
        c.execute("""insert into public.entitlements
          (id,account_id,purchase_id,product_id,state,starts_at)
          values (%s,%s,%s,'read-the-dollar-first-guided-interactive-edition','active',%s)""",
          (lib,acc,purchase,START))
    return acc,sid,eid


def apply(c,sid,acc,key, *,clock='2026-11-02T12:00:00+00:00',kind='subscriptions',
          state='active',period=NEXT,start=START,snapshot=True,customer=CUSTOMER,
          store=STORE,variant=VARIANT,binding=BINDING,fingerprint=None):
    args=(sid,acc,PROVIDER,str(1000+int(str(sid)[-12:])),customer,store,variant,binding,
          key,key, fingerprint or hashlib.sha256(key.encode()).hexdigest(),kind,
          clock,state,start,period,snapshot)
    return c.execute(CALL_SQL,args).fetchone()[0]


def evidence(c,sid):
    return {
      'subscription':c.execute("""select state::text,current_period_start,current_period_end,version,last_provider_event_id
        from public.subscriptions where id=%s""",(sid,)).fetchone(),
      'entitlement':c.execute("""select state::text,starts_at,ends_at,version from public.entitlements
        where subscription_id=%s and product_id='research-membership'""",(sid,)).fetchone(),
      'wm':c.execute('select subscription_object_at,source_event_key from research_ordering_stage_c.applied_watermarks where subscription_id=%s',(sid,)).fetchone(),
      'events':c.execute('select count(*) from public.subscription_events where subscription_id=%s',(sid,)).fetchone()[0],
      'audit':c.execute('select count(*) from research_ordering_stage_c.delivery_audit where subscription_id=%s',(sid,)).fetchone()[0],
    }


def held(c,sid,acc,key,expected,**kw):
    before=evidence(c,sid)
    result=apply(c,sid,acc,key,**kw)
    assert result['action']==expected and result['can_mutate'] is False,(key,result)
    after=evidence(c,sid)
    assert before['subscription']==after['subscription'],(key,before,after)
    assert before['entitlement']==after['entitlement']
    assert before['wm']==after['wm']
    assert before['events']==after['events']
    assert after['audit']==before['audit']+1
    return result


def main():
    with db() as c:
        assert c.execute('show server_version_num').fetchone()[0]=='170006'
        bootstrap(c)
        acc,sid,_=seed(c,1,library=True)
        lb=c.execute("""select row_to_json(e)::text from public.entitlements e
          where account_id=%s and purchase_id is not null""",(acc,)).fetchone()[0]
        assert held(c,sid,acc,'O1-old-failure','stale_ignored',clock='2026-10-30T12:00:00+00:00',state='past_due')['reason']=='older_subscription_object'
        assert held(c,sid,acc,'O4-old-cancel','stale_ignored',clock='2026-10-30T13:00:00+00:00',state='cancel_scheduled',period='2026-11-15T00:00:00+00:00')['reason']=='older_subscription_object'
        assert held(c,sid,acc,'equal','ordering_conflict',clock=A)['reason']=='equal_timestamp_distinct_event_key'
        assert held(c,sid,acc,'invoice','pending_reconciliation',kind='subscription-invoices',state='past_due')['reason']=='invoice_object_clock_is_not_subscription_clock'
        assert held(c,sid,acc,'unverified','pending_reconciliation',snapshot=False)['reason']=='current_provider_snapshot_unverified'
        assert held(c,sid,acc,'horizon','pending_reconciliation',period='2026-11-15T00:00:00+00:00')['reason']=='paid_horizon_would_shorten'
        assert held(c,sid,acc,'no-period','pending_reconciliation',period=None)['reason']=='missing_or_invalid_paid_period'
        good=apply(c,sid,acc,'newer-paid-renewal');assert good['action']=='applied',good
        before=evidence(c,sid)
        assert before['subscription'][0]=='active' and before['entitlement'][0]=='active'
        assert before['subscription'][2].isoformat()=='2027-01-01T00:00:00+00:00'
        assert before['events']==1
        dup=apply(c,sid,acc,'newer-paid-renewal');assert dup['action']=='duplicate' and evidence(c,sid)==before
        try: apply(c,sid,acc,'newer-paid-renewal',fingerprint='b'*64)
        except psycopg.Error as ex:assert 'replay evidence conflict' in str(ex)
        else:raise AssertionError('conflicting duplicate accepted')
        try: apply(c,sid,acc,'bad-binding',store='999')
        except psycopg.Error as ex:assert 'binding mismatch' in str(ex)
        else:raise AssertionError('bad merchant binding accepted')
        try: c.execute("update research_ordering_stage_c.delivery_audit set disposition='applied' where event_key='O1-old-failure'")
        except psycopg.Error as ex:assert 'stage-c audit is immutable' in str(ex)
        else:raise AssertionError('audited event mutated')
        assert c.execute("""select row_to_json(e)::text from public.entitlements e
          where account_id=%s and purchase_id is not null""",(acc,)).fetchone()[0]==lb
        acc2,sid2,_=seed(c,2,watermark=None)
        assert held(c,sid2,acc2,'missing-trusted-watermark','pending_reconciliation')['reason']=='missing_applied_subscription_object_watermark'
        print('PASS real Research schema O1/O4, invoice, equal clocks, idempotence, period, binding, immutable audit, purchase-backed Library Pass',flush=True)

    # Two physical DB backends, NEW order holds same real subscriptions row lock.
    def racing(i,kind,old_clock,old_state,old_period,expected):
        with db() as prepare:
            acc,sid,_=seed(prepare,i)
        with db(autocommit=False) as first:
            first.execute('select id from public.subscriptions where id=%s for update',(sid,))
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                def second():
                    with db() as c:
                        return apply(c,sid,acc,f'race-old-{kind}-{i}',clock=old_clock,state=old_state,period=old_period)
                future=pool.submit(second)
                time.sleep(0.2)
                assert not future.done(),f'row lock bypassed: {kind}'
                latest=apply(first,sid,acc,f'race-renewal-{kind}-{i}',clock='2026-11-03T12:00:00+00:00')
                assert latest['action']=='applied',latest
                first.commit()
                older=future.result(timeout=15)
                assert older['action']==expected,older
        with db() as verify:
            state=evidence(verify,sid)
            assert state['subscription'][0]=='active' and state['entitlement'][0]=='active'
            assert state['events']==1 and state['audit']==2
        print(f'PASS 2 PostgreSQL sessions on actual Research tables: {kind} {expected}',flush=True)
    racing(3,'O1','2026-11-02T12:00:00+00:00','past_due',END,'stale_ignored')
    racing(4,'O4','2026-11-02T13:00:00+00:00','cancel_scheduled','2026-11-15T00:00:00+00:00','stale_ignored')
    racing(5,'equal','2026-11-03T12:00:00+00:00','past_due',END,'ordering_conflict')

    with db() as prepare:
        acc,sid,_=seed(prepare,6)
    barrier=threading.Barrier(2)
    def same_delivery():
        with db() as c:
            barrier.wait(timeout=8)
            return apply(c,sid,acc,'same-delivery-two-postgres-sessions')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        x=pool.submit(same_delivery);y=pool.submit(same_delivery)
        actions=sorted([x.result(timeout=15)['action'],y.result(timeout=15)['action']])
        assert actions==['applied','duplicate'],actions
    with db() as c:
        state=evidence(c,sid)
        assert state['events']==1 and state['audit']==1 and state['subscription'][3]==2
    print('PASS concurrent same-key real-schema idempotence: one applied, one duplicate, one audit row',flush=True)

    # SECURITY NEGATIVE: mimic real Supabase service_role BYPASSRLS on this
    # disposable DB, prove the existing 16-parameter RPC can still overwrite
    # newer Research access. Always ROLLBACK; never use a connected project.
    with db() as prep:
        acc,sid,_=seed(prep,7)
        assert apply(prep,sid,acc,'safe-applied-renewal')['action']=='applied'
        good=evidence(prep,sid)
    with db(autocommit=False) as unsafe:
        unsafe.execute('set local role service_role')
        old_result=unsafe.execute('''select public.apply_research_membership_transition(
            %s::uuid,%s,%s,%s,%s,%s::public.subscription_state,
            %s::public.subscription_state,%s::timestamptz,%s::timestamptz,%s,
            %s::public.entitlement_state,%s::timestamptz,%s::timestamptz,
            %s,%s::timestamptz,%s::jsonb)''',(
            sid,'review-legacy-out-of-order','review-old-payment-failed','lemon-squeezy','1007',
            'active','past_due',START,'2026-11-15T00:00:00+00:00',False,
            'suspended',START,'2026-11-03T00:00:00+00:00',
            'subscription.payment_failed','2026-10-30T00:00:00+00:00','{}'
        )).fetchone()[0]
        assert old_result['action']=='applied',old_result
        sub=unsafe.execute('select state::text,current_period_end from public.subscriptions where id=%s',(sid,)).fetchone()
        ent=unsafe.execute('select state::text from public.entitlements where subscription_id=%s',(sid,)).fetchone()
        assert sub[0]=='past_due' and ent[0]=='suspended' and sub[1] < good['subscription'][2]
        unsafe.execute("update public.entitlements set state='revoked' where subscription_id=%s",(sid,))
        assert unsafe.execute('select state::text from public.entitlements where subscription_id=%s',(sid,)).fetchone()[0]=='revoked'
        unsafe.rollback()  # Must restore all synthetic rows; this negative never commits.
    with db() as verify:
        assert evidence(verify,sid)==good,'review legacy bypass negative did not roll back'
    print('CONFIRMED P1 BLOCKER: historical service_role and old 16-arg RPC bypass ordering in disposable PG; all writes rolled back',flush=True)
    print('RESEARCH_STAGE_C_ACTUAL_SCHEMA_REVIEW_PASS (security blocker remains, no live install)',flush=True)


if __name__=='__main__':main()
