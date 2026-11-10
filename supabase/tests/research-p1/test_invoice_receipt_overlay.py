#!/usr/bin/env python3
"""E3 exact source-proven invoice custody negatives on disposable PG17 ONLY."""
import uuid
import psycopg
from psycopg.types.json import Jsonb
N=0
def call(role,sql,args=()):
    with psycopg.connect(dbname='ci_review',host='127.0.0.1',autocommit=True) as c:
        c.execute('SET ROLE '+role)
        try:
            x=c.execute(sql,args)
            return ('OK',x.fetchone()[0] if x.description else x.rowcount)
        except psycopg.Error as exc: return ('ERR',exc.sqlstate)
def owner(sql,args=()):
    r=call('postgres',sql,args)
    if r[0]!='OK': raise AssertionError('synthetic setup failure '+str(r))
    return r[1]
def svc(sql,args=()): return call('service_role',sql,args)
def check(label,ok,x=None):
    global N
    N+=1
    print(f"[E3-OVERLAY] {'PASS' if ok else 'FAIL'} #{N}: {label} {str(x)[:90]}",flush=True)
    if not ok: raise AssertionError(label)
a=uuid.uuid4();key='e3bind'+a.hex;psub='e3sub'+a.hex[:12]
owner("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(a,'e3-'+a.hex[:9]+'@invalid.example'))
r=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",(a,key))
check('create synthetic checkout',r[0]=='OK',r)
r2=svc("SELECT public.attach_research_checkout_attempt(%s,%s,%s,now()+interval '30 minutes')",(r[1],a,'e3-ck-'+a.hex[-12:]))
check('attach synthetic checkout',r2[0]=='OK',r2)
owner("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '1 minute' WHERE id=%s",(r[1],))
r3=svc("SELECT public.bind_research_membership_subscription(%s,'lemon-squeezy',%s,%s,'313','monthly',now(),%s::jsonb)",(a,psub,'e3-cus-'+a.hex[-6:],Jsonb({'bindingSource':'signed-subscription-created','checkoutKey':key})))
check('bind synthetic Research subscription',r3[0]=='OK',r3)
sid=uuid.UUID(r3[1]['subscription_id'])
tr="""SELECT public.apply_research_membership_transition(%s,%s,%s,'lemon-squeezy',%s,
  %s::public.subscription_state,%s::public.subscription_state,now()-interval '1 day',
  now()+interval '29 days',false,%s::public.entitlement_state,now()-interval '1 day',
  null,'e3 synthetic',%s,'{}'::jsonb)"""
r4=svc(tr,(sid,'e3-first-'+psub,'e3-first-provider-'+psub,psub,'pending','active','active',owner('SELECT now()')))
check('paid activation remains permitted',r4[0]=='OK' and r4[1]['action']=='applied',r4)
before=owner("SELECT jsonb_build_object('s',s.state,'e',e.state) FROM public.subscriptions s JOIN public.entitlements e ON e.subscription_id=s.id WHERE s.id=%s",(sid,))
pid='lemon-squeezy:subscription_payment_success:subscription-invoices:inve3demo:2026-11-10T21:00:00Z'
ek='lemon-squeezy:'+pid
obs=owner("SELECT now()+interval '2 seconds'")
md=Jsonb({'lemonEventName':'subscription_payment_success','lemonDataType':'subscription-invoices','replayFingerprintVersion':1,'replayFingerprint':'a'*64,'invoiceFinancialDigest':'c'*64})
rpc="SELECT public.record_research_signed_invoice_receipt(%s,%s,%s,'subscription_payment_success',%s,%s::jsonb)"
# A direct service_role preclaim used to suppress genuine signed invoice custody.
# Forbidding direct INSERT must not deny the validated transition RPC.
priv=owner("SELECT has_table_privilege('service_role','public.subscription_events','INSERT')")
check('service_role has no direct subscription_events INSERT after overlay',priv is False,priv)
forge=svc("""INSERT INTO public.subscription_events(
   event_key,subscription_id,account_id,product_id,from_state,to_state,
   reason,actor_type,provider_event_id,metadata,occurred_at)
   SELECT %s,s.id,s.account_id,'research-membership',s.state,s.state,
   'subscription_payment_success','provider_webhook',%s,
   jsonb_build_object('researchP1InvoiceReceipt',true,'replayFingerprint',repeat('0',64)),
   clock_timestamp() FROM public.subscriptions s WHERE s.id=%s""",(ek,pid,sid))
check('E3 6b direct forged signed invoice preclaim denied as real service_role',
      forge==('ERR','42501'),forge)
validfn='public.apply_research_membership_transition(uuid,text,text,text,text,public.subscription_state,public.subscription_state,timestamptz,timestamptz,boolean,public.entitlement_state,timestamptz,timestamptz,text,timestamptz,jsonb)'
roles=[owner("SELECT has_function_privilege(%s,%s,'EXECUTE')",(r,validfn)) for r in ('anon','authenticated','service_role')]
check('transition definer RPC only callable by service_role',roles==[False,False,True],roles)
saved=svc(rpc,(sid,ek,pid,obs,md))
check('non-granting signed invoice persisted',saved[0]=='OK' and saved[1]['action']=='invoice_recorded',saved)

# Reject digest-free/malformed receipts before a new event key can be claimed.
without=svc(rpc,(sid,'lemon-squeezy:missing-finance','missing-finance',obs,
 Jsonb({'lemonEventName':'subscription_payment_success','lemonDataType':'subscription-invoices',
  'replayFingerprintVersion':1,'replayFingerprint':'1'*64})))
check('invoice custody rejects missing financial digest',without==('ERR','22023'),without)
bad=svc(rpc,(sid,'lemon-squeezy:malformed-finance','malformed-finance',obs,
 Jsonb({'lemonEventName':'subscription_payment_success','lemonDataType':'subscription-invoices',
  'replayFingerprintVersion':1,'replayFingerprint':'1'*64,'invoiceFinancialDigest':'z'*64})))
check('invoice custody rejects invalid financial digest',bad==('ERR','22023'),bad)
keys=owner("SELECT count(*) FROM public.subscription_events WHERE event_key=ANY(%s::text[])",
 (['lemon-squeezy:missing-finance','lemon-squeezy:malformed-finance'],))
check('invalid invoice digest cannot preclaim an event key',keys==0,keys)

after=owner("SELECT jsonb_build_object('s',s.state,'e',e.state) FROM public.subscriptions s JOIN public.entitlements e ON e.subscription_id=s.id WHERE s.id=%s",(sid,))
check('paid rights and state unchanged by receipt',before==after,(before,after))
dup=svc(rpc,(sid,ek,pid,obs,md))
check('exact signed invoice replay idempotent',dup[0]=='OK' and dup[1]['action']=='duplicate',dup)
other=svc(rpc,(sid,'lemon-squeezy:secondary-event-key',pid,obs,md))
check('alternate key for provider ID refused',other==('ERR','22023'),other)
future=svc(rpc,(sid,'lemon-squeezy:future','future','2099-01-01T00:00:00Z',md))
check('2099 timestamp refused',future==('ERR','22023'),future)
conflict=svc(rpc,(sid,ek,pid,obs,Jsonb({'lemonEventName':'subscription_payment_success','lemonDataType':'subscription-invoices','replayFingerprintVersion':1,'replayFingerprint':'b'*64,'invoiceFinancialDigest':'d'*64})))
check('conflicting signed fingerprint refused',conflict==('ERR','23505'),conflict)
original=owner("SELECT metadata->>'replayFingerprint' FROM public.subscription_events WHERE event_key=%s",(ek,))
check('stored fingerprint remains intact',original=='a'*64,original)
conf=svc("SELECT public.record_research_signed_invoice_conflict(%s,%s,%s,%s,%s)",(sid,ek,pid,'b'*64,'d'*64))
check('E3 4c conflicting signed invoice stored with digest-only custody',
  conf[0]=='OK' and conf[1]['action']=='conflict_quarantined',conf)
quarantine=owner("SELECT count(*) FROM public.research_paid_binding_quarantine WHERE claimed_account_id=%s",(a,))
check('E3 4c signed conflict also creates durable financial quarantine',quarantine==1,quarantine)
minimal=owner("SELECT count(*) FROM research_lifecycle_private.a_strict_invoice_conflicts WHERE account_id=%s AND conflicting_fingerprint=%s",(a,'b'*64))
check('E3 4c original+incoming fingerprint audit retained',minimal==1,minimal)
check('E3 4c conflicting event does not revoke paid Research access',owner("SELECT state::text FROM public.subscriptions WHERE id=%s",(sid,))=='active')
amount=svc("SELECT public.record_research_signed_invoice_conflict(%s,%s,%s,%s,%s)",(sid,ek,pid,'a'*64,'e'*64))
check('E3 4c changed amount digest with original v1 fingerprint is quarantined',
 amount[0]=='OK' and amount[1]['action']=='conflict_quarantined',amount)
count=owner("SELECT count(*) FROM research_lifecycle_private.a_strict_invoice_conflicts WHERE account_id=%s",(a,))
check('E3 4c two distinct conflicting financial claims retained',count==2,count)

# Client roles cannot inspect or forge private immutable conflict custody.
fn='public.record_research_signed_invoice_conflict(uuid,text,text,text,text)'
grants=[owner("SELECT has_function_privilege(%s,%s,'EXECUTE')",(r,fn))
  for r in ('anon','authenticated','service_role')]
check('conflict RPC EXECUTE restricted to service_role',grants==[False,False,True],grants)
table_grants=[owner("SELECT has_table_privilege(%s,'research_lifecycle_private.a_strict_invoice_conflicts','SELECT')",(r,))
  for r in ('anon','authenticated','service_role')]
check('no client/service direct conflict-ledger SELECT',table_grants==[False,False,False],table_grants)
wrong_key=svc("SELECT public.record_research_signed_invoice_conflict(%s,%s,%s,%s,%s)",
 (sid,'lemon-squeezy:other-provider-id',pid,'b'*64,'d'*64))
check('conflict custody rejects unrelated event identity',wrong_key==('ERR','22023'),wrong_key)
wrong_sub=svc("SELECT public.record_research_signed_invoice_conflict(%s,%s,%s,%s,%s)",
 (uuid.uuid4(),ek,pid,'b'*64,'d'*64))
check('conflict custody rejects absent subscription',wrong_sub==('ERR','P0002'),wrong_sub)
row=owner("SELECT id FROM research_lifecycle_private.a_strict_invoice_conflicts WHERE account_id=%s LIMIT 1",(a,))
rewrite=call('postgres',"UPDATE research_lifecycle_private.a_strict_invoice_conflicts SET conflicting_financial_digest=%s WHERE id=%s",('f'*64,row))
check('even SQL owner cannot rewrite signed conflict evidence',rewrite[0]=='ERR',rewrite)
delete=call('postgres',"DELETE FROM research_lifecycle_private.a_strict_invoice_conflicts WHERE id=%s",(row,))
check('even SQL owner cannot delete signed conflict evidence',delete[0]=='ERR',delete)
truncate=call('postgres',"TRUNCATE research_lifecycle_private.a_strict_invoice_conflicts")
check('even SQL owner cannot truncate signed conflict evidence',truncate[0]=='ERR',truncate)
after=owner("SELECT count(*) FROM research_lifecycle_private.a_strict_invoice_conflicts WHERE account_id=%s",(a,))
check('original two signed conflict claims survived negative probes',after==2,after)


v=svc(tr,(sid,'e3-refund-'+psub,'e3-refund-provider-'+psub,psub,'active','refunded','refunded',owner("SELECT now()+interval '1 second'")))
check('invoice chronology does not suppress legitimate terminal refund',v[0]=='OK' and v[1]['action']=='applied',v)
s=owner("SELECT state::text FROM public.subscriptions WHERE id=%s",(sid,))
check('terminal refund state preserved',s=='refunded',s)
grant=[owner("SELECT has_function_privilege(%s,'public.record_research_signed_invoice_receipt(uuid,text,text,text,timestamptz,jsonb)','execute')",(u,)) for u in ('anon','authenticated','service_role')]
check('RPC only executable by service_role',grant==[False,False,True],grant)
print(f'[E3-OVERLAY] {N} disposable PG17 checks PASS; DRAFT HOLD',flush=True)
