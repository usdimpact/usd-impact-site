#!/usr/bin/env python3
"""Stage H: six historical Research migrations + private pending-only PG17 evidence journal."""
import os, sys, uuid, hashlib, threading, concurrent.futures
from pathlib import Path
import psycopg

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'docs'/'operations'/'research-ordering-stage-c'))
from test_real_schema_ordering import bootstrap, db, seed
for k in ('SUPABASE_URL','SUPABASE_DB_URL','DATABASE_URL','LEMON_SQUEEZY_API_KEY'):
    assert not os.getenv(k), f'forbidden remote credentials: {k}'
assert os.getenv('PGHOST') == '127.0.0.1' and os.getenv('PGDATABASE') == 'ci_review'
assert os.getenv('PGUSER')=='ci_research' and os.getenv('PGPASSWORD')=='synthetic-stage-c-review-only'

CALL="select research_ordering_stage_h.hold_evidence(%s,%s,%s,%s,%s)"
def args(key, digest='1'*64, raw='a'*64):return (key,raw,'2026-11-05T01:02:03.123456Z','2026-11-05T01:02:04.123456Z',digest)
def snap(c,account):
    return (
      c.execute('select row_to_json(s)::text from public.subscriptions s where account_id=%s',(account,)).fetchall(),
      c.execute('select row_to_json(e)::text from public.entitlements e where account_id=%s order by product_id',(account,)).fetchall(),
      c.execute('select count(*) from public.subscription_events').fetchone()[0],
      c.execute('select count(*) from public.entitlement_events').fetchone()[0]
    )

with db() as conn:
  assert conn.execute('show server_version_num').fetchone()[0]=='170006'
  bootstrap(conn)
  acc,sid,_=seed(conn,34,library=True)
  start=snap(conn,acc)
  conn.execute((HERE/'receipt_journal_review.sql').read_text('utf8'))
  one=conn.execute(CALL,args('payment_success:118')).fetchone()[0]
  assert one=={'action':'candidate_held','can_mutate':False,'disposition':'pending_reconciliation'},one
  duplicate=conn.execute(CALL,args('payment_success:118')).fetchone()[0]
  assert duplicate['action']=='duplicate_held' and duplicate['can_mutate'] is False
  mismatch=conn.execute(CALL,args('payment_success:118','2'*64)).fetchone()[0]
  assert mismatch['action']=='conflict_quarantined' and mismatch['disposition']=='quarantined_conflict'
  assert conn.execute('select signed_delivery_hash,candidate_digest from research_ordering_stage_h.pending_receipts where event_key=%s',('payment_success:118',)).fetchone()==('a'*64,'1'*64)
  assert conn.execute('select action from research_ordering_stage_h.receipt_audit order by id').fetchall()==[('candidate_held',),('duplicate_held',),('conflict_quarantined',)]
  for statement in [
    "update research_ordering_stage_h.receipt_audit set action='candidate_held'",
    "delete from research_ordering_stage_h.receipt_audit",
    "update research_ordering_stage_h.pending_receipts set candidate_digest='b' where event_key='payment_success:118'"
  ]:
    try:conn.execute(statement)
    except psycopg.Error as ex: assert ex.sqlstate=='42501',str(ex)
    else:raise AssertionError('mutable original evidence / audit allowed')
  for bad in [('x','a'*64,'v','v','1'*64),('review-valid','bad','v','v','1'*64)]:
    try:conn.execute(CALL,bad)
    except psycopg.Error as ex:assert ex.sqlstate=='22023',str(ex)
    else:raise AssertionError('invalid evidence accepted')
  assert snap(conn,acc)==start,'Research/Library Pass mutated by private journal'
  print('PASS six historical Research migrations, private immutable pending journal, ambiguous event quarantine, original Library Pass rows unchanged',flush=True)

barrier=threading.Barrier(2)
def worker(_):
  with db() as conn:
    barrier.wait(timeout=10)
    return conn.execute(CALL,args('payment_success:concurrent')).fetchone()[0]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(worker,[1,2]))
assert sorted(r['action'] for r in results)==['candidate_held','duplicate_held'],results
with db() as conn:
  assert conn.execute('select count(*) from research_ordering_stage_h.pending_receipts where event_key=%s',('payment_success:concurrent',)).fetchone()[0]==1
  assert conn.execute('select count(*) from research_ordering_stage_h.receipt_audit where event_key=%s',('payment_success:concurrent',)).fetchone()[0]==2
  assert snap(conn,acc)==start
  assert conn.execute("select count(*) from public.entitlements where product_id='research-membership' and state='active'").fetchone()[0] == 1
  print('RESEARCH_STAGE_H_PG17_PENDING_JOURNAL_PASS 2 concurrent backend sessions, no entitlement mutation',flush=True)
