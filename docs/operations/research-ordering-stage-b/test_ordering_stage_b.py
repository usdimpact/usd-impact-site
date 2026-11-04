#!/usr/bin/env python3
"""Disposable PG17 oracle: never accepts a Supabase URL, DATABASE_URL, or cloud host."""
from __future__ import annotations

import concurrent.futures
import hashlib
import os
import pathlib
import time
import uuid

import psycopg

ROOT = pathlib.Path(__file__).resolve().parent
HOST = os.environ.get('PGHOST', '127.0.0.1')
assert HOST == '127.0.0.1', 'synthetic review is loopback-only'
assert 'DATABASE_URL' not in os.environ and 'SUPABASE_URL' not in os.environ
PARAMS = dict(host=HOST, port=int(os.environ.get('PGPORT', '5432')),
              dbname=os.environ.get('PGDATABASE', 'ci_review'),
              user=os.environ.get('PGUSER', 'ci_review'),
              password=os.environ.get('PGPASSWORD', 'local-review-only'),connect_timeout=5)
AT = '2026-11-01T12:00:00+00:00'
END = '2026-12-01T00:00:00+00:00'
LIBRARY_ID = uuid.UUID('33333333-3333-4333-8333-333333333333')


def run(conn, event_key, *, sid, clock='2026-11-02T12:00:00+00:00', kind='subscriptions',
        state='active', period='2027-01-01T00:00:00+00:00', verified=True,
        fingerprint=None, provider='lemon-squeezy', provider_sid='sub_offline', provider_event=None):
    fingerprint = fingerprint or hashlib.sha256(event_key.encode('utf8')).hexdigest()
    args = (sid,provider,provider_sid,event_key,provider_event or event_key,fingerprint,kind,clock,state,period,verified)
    row=conn.execute('select research_ordering_review.apply_synthetic_delivery(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',args).fetchone()
    return row[0]


def setup(conn):
    conn.execute((ROOT/'ordering_stage_b_synthetic.sql').read_text('utf8'))


def seed(conn, i, *, watermark=AT, state='active', period=END):
    sid=uuid.UUID(f'11111111-1111-4111-8111-{i:012d}')
    ent=uuid.UUID(f'22222222-2222-4222-8222-{i:012d}')
    conn.execute('''insert into research_ordering_review.subscriptions
      (id, provider, provider_subscription_id, state, current_period_end, applied_subscription_at, applied_event_key)
      values (%s,'lemon-squeezy','sub_offline',%s,%s,%s,'seed-by-authoritative-snapshot')''', (sid,state,period,watermark))
    conn.execute('''insert into research_ordering_review.entitlements
      (id,subscription_id,product_id,state,ends_at) values (%s,%s,'research-membership','active',%s)''', (ent,sid,period))
    return sid


def snapshot(conn, sid):
    sub=conn.execute('''select state,current_period_end,applied_subscription_at,version
        from research_ordering_review.subscriptions where id=%s''',(sid,)).fetchone()
    ent=conn.execute('''select state,ends_at,version from research_ordering_review.entitlements
        where subscription_id=%s''',(sid,)).fetchone()
    return (sub,ent)


def count(conn, sid):
    return conn.execute('select count(*) from research_ordering_review.delivery_audit where subscription_id=%s',(sid,)).fetchone()[0]


def expect_no_change(conn, sid, event_key, **kw):
    before=snapshot(conn,sid)
    res=run(conn,event_key,sid=sid,**kw)
    assert res['can_mutate'] is False, res
    assert snapshot(conn,sid)==before,(event_key,res)
    return res['action']


def main():
    with psycopg.connect(**PARAMS, autocommit=True) as db:
        assert db.execute('show server_version_num').fetchone()[0] == '170006'
        setup(db)
        sid=seed(db,1)
        # Library Pass and complimentary rows are never selected by the Research update.
        db.execute('''insert into research_ordering_review.entitlements
          (id,subscription_id,product_id,purchase_id,state,ends_at)
          values (%s,null,'guided-book',%s,'active',null)''',(LIBRARY_ID,uuid.uuid4()))
        library_before=db.execute('select row_to_json(e)::text from research_ordering_review.entitlements e where id=%s',(LIBRARY_ID,)).fetchone()[0]
        assert expect_no_change(db,sid,'O1-old-failed',clock='2026-10-30T12:00:00+00:00',state='past_due',period=END)=='stale_ignored'
        assert expect_no_change(db,sid,'O4-old-cancelled',clock='2026-10-30T13:00:00+00:00',state='cancel_scheduled',period='2026-11-15T00:00:00+00:00')=='stale_ignored'
        assert expect_no_change(db,sid,'equal-new-key',clock=AT)=='ordering_conflict'
        assert expect_no_change(db,sid,'invoice-failed',kind='subscription-invoices',clock='2027-02-01T12:00:00+00:00',state='past_due',period=END)=='pending_reconciliation'
        assert expect_no_change(db,sid,'unverified',verified=False)=='pending_reconciliation'
        assert expect_no_change(db,sid,'missing-paid-end',period=None)=='pending_reconciliation'
        assert expect_no_change(db,sid,'period-shortening',period='2026-11-15T00:00:00+00:00')=='pending_reconciliation'
        assert expect_no_change(db,sid,'old-refund',clock='2026-10-31T00:00:00+00:00',state='refunded',period=END)=='stale_ignored'
        a=run(db,'newer-renewal',sid=sid)
        assert a['action']=='applied' and a['can_mutate'] is True
        after=snapshot(db,sid)
        assert after[0][0]=='active' and after[1][0]=='active' and str(after[0][1])=='2027-01-01 00:00:00+00:00'
        assert run(db,'newer-renewal',sid=sid)['action']=='duplicate'
        try:
            run(db,'newer-renewal',sid=sid,fingerprint='f'*64)
        except psycopg.Error as e:
            assert 'replayed delivery evidence conflicts' in str(e)
        else: raise AssertionError('conflicting duplicate was accepted')
        assert snapshot(db,sid)==after
        assert db.execute('select row_to_json(e)::text from research_ordering_review.entitlements e where id=%s',(LIBRARY_ID,)).fetchone()[0]==library_before
        sid2=seed(db,2,watermark=None)
        assert expect_no_change(db,sid2,'first-unverified',verified=True)=='pending_reconciliation'
        sid3=seed(db,3,watermark=AT,state='refunded')
        assert expect_no_change(db,sid3,'terminal-reopen',state='active')=='pending_reconciliation'
        acl=db.execute("select proacl is not null from pg_proc where proname='apply_synthetic_delivery' and pronamespace='research_ordering_review'::regnamespace").fetchone()
        assert acl == (True,), 'review-only function must have explicit revoked ACL'
        # Even owner may not rewrite audit evidence through normal SQL.
        try: db.execute("update research_ordering_review.delivery_audit set disposition='applied' where event_key='O1-old-failed'")
        except psycopg.Error as e: assert 'append-only' in str(e)
        else: raise AssertionError('audit changed')
        print('PASS O1/O4, equal-time, duplicate conflicts, invoice clocks, finite horizon, terminal, Library Pass, immutable audit')

    # Two PostgreSQL connections: newer transaction holds row lock; older delivery waits then reads new watermark.
    sid=uuid.UUID('11111111-1111-4111-8111-000000000004')
    with psycopg.connect(**PARAMS,autocommit=True) as init:
        seed(init,4)
    with psycopg.connect(**PARAMS) as newer:
        newer.execute('select id from research_ordering_review.subscriptions where id=%s for update',(sid,))
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            def delayed():
                with psycopg.connect(**PARAMS,autocommit=True) as older:
                    return run(older,'race-old-failure',sid=sid,clock='2026-11-01T13:00:00+00:00',state='past_due',period=END)
            pending=pool.submit(delayed)
            time.sleep(0.25)
            assert not pending.done(), 'older writer bypassed row lock'
            newer_applied=run(newer,'race-new-renewal',sid=sid,clock='2026-11-02T00:00:00+00:00')
            assert newer_applied['action']=='applied'
            newer.commit()
            stale=pending.result(timeout=10)
            assert stale['action']=='stale_ignored',stale
    with psycopg.connect(**PARAMS,autocommit=True) as check:
        sub= snapshot(check,sid)
        assert sub[0][0]=='active' and sub[1][0]=='active'
        assert count(check,sid)==2
        assert check.execute("select disposition from research_ordering_review.delivery_audit where event_key='race-old-failure'").fetchone()[0]=='stale_ignored'
    print('PASS real 2-connection PostgreSQL 17 FOR UPDATE serialization; paid period intact; 2 audit rows')
    print('RESEARCH_STAGE_B_ISOLATED_ORDERING_ORACLE_PASS')


if __name__ == '__main__':
    main()
