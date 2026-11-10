#!/usr/bin/env python3
"""Synthetic CI-only PostgREST-to-disposable-PG17 bridge for #1103 F1/F2.

Runs ONLY with ci_review on loopback; never connected Supabase/Auth/Merchant.
Whitelisted operations; no arbitrary SQL from caller; no PII output.
"""
import sys, json, uuid, hashlib
from datetime import datetime
import psycopg
from psycopg.types.json import Jsonb

if len(sys.argv)!=3 or sys.argv[1] not in {"setup","subscription","events","invoice","status"}:
    raise SystemExit("bridge operation not allowed")
import os
if os.getenv("PGHOST","127.0.0.1") not in ("127.0.0.1","localhost") or os.getenv("PGDATABASE","ci_review")!="ci_review":
    raise SystemExit("REFUSE non-disposable PostgreSQL")
cmd=sys.argv[1]
data=json.loads(sys.argv[2])

def conn():
    return psycopg.connect(host="127.0.0.1",dbname="ci_review",autocommit=True)

def select(sql,args=(),role="postgres"):
    with conn() as c:
        c.execute("SET ROLE "+role)
        cur=c.execute(sql,args)
        return cur.fetchall() if cur.description else []

def first(sql,args=(),role="postgres"):
    rows=select(sql,args,role)
    return rows[0][0] if rows else None

def hashed(text):
    return hashlib.sha256(str(text).encode()).hexdigest()

def clearance(a,case,label,stage):
    ref="p1-"+hashed(str(a)+label)[:24]
    receipt=first("""SELECT public.record_research_billing_clearance(
      %s,'provider_api',%s,clock_timestamp(),'synthetic-owner')""",(a,ref))
    verified=first("SELECT verified_at FROM public.research_billing_clearances WHERE id=%s",(receipt,))
    proof={
      "store_id":"42","product_key":"research-membership","mode":"live",
      "customer_scope_digest":hashed(str(a)),
      "inventory_digest":hashed(label+" inventory"),
      "receipt_digest":hashed(label+" owner custody"),
      "read_observed_at":verified.isoformat(),
      "subscription_pages":1,"invoice_pages":1,"order_pages":1,"checkout_pages":1,
      "subscriptions_terminal":True,"invoices_settled":True,
      "checkout_closed":True,"no_retries":True,"no_unknown_provider_objects":True
    }
    rid=first("""SELECT public.a_strict_owner_record_merchant_receipt(%s,%s,%s,%s,%s)""",
              (a,case,receipt,stage,Jsonb(proof)))
    if not rid: raise AssertionError("owner merchant receipt not persisted")
    return receipt

def do_setup():
    a=uuid.uuid4()
    case="p1-"+a.hex[:12]
    psub="sub_p1_f2_"+a.hex[:16]
    u="intent-"+a.hex[:12]+"@invalid.example"
    select("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(a,u))
    s=first("""INSERT INTO public.subscriptions(
       account_id,product_id,provider,provider_subscription_id,
       billing_interval,state,current_period_start,current_period_end)
       VALUES(%s,'research-membership','lemon-squeezy',%s,
          'monthly','refunded',now()-interval '60 days',now()-interval '30 days')
       RETURNING id""",(a,psub))
    if s is None: raise AssertionError("historical terminal subscription failed")
    with conn() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(a),))
        c.execute("SELECT public.request_account_deletion()")
    select("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
      deletion_requested_at=now()-interval '31 days' WHERE account_id=%s""",(a,))
    pre=clearance(a,case,"before-case","pre_auth")
    cap=first("SELECT public.a_strict_authorize(%s,%s,%s,'synthetic-owner',clock_timestamp()+interval '40 minutes')",(a,case,pre))
    phase=first("SELECT public.a_strict_phase_a(%s,%s)",(a,cap))
    if phase is None: raise AssertionError("Phase A missing")
    lease=first("SELECT public.a_strict_claim(%s,%s,'auth')",(a,cap),role="service_role")
    if not isinstance(lease,dict) or not lease.get("lease_id"):
        raise AssertionError("Auth lease missing")
    fresh=clearance(a,case,"after-phase","pre_auth")
    fence=first("SELECT public.a_strict_fence(%s,%s,%s)",(a,cap,uuid.UUID(lease["lease_id"])),role="service_role")
    if fence is not True: raise AssertionError("pre-Auth SQL fence failed")
    marked=first("SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,cap,uuid.UUID(lease["lease_id"])))
    if marked is not True: raise AssertionError("Auth intent not durable")
    historical=first("SELECT state::text FROM public.subscriptions WHERE id=%s",(s,))
    if historical not in ("refunded","cancelled"):
        raise AssertionError("historical terminal Research subscription state changed: "+str(historical))
    return {"accountId":str(a),"subscriptionId":str(s),"providerSubscriptionId":psub,
      "state":historical,"serverVersion":first("SHOW server_version"),
      "preAuthIntent":True}

def do_subscription():
    p=data["providerSubscriptionId"]
    rows=select("""SELECT id,account_id,product_id,provider,provider_subscription_id,
       state::text,current_period_start,current_period_end,cancel_at_period_end
       FROM public.subscriptions
       WHERE provider='lemon-squeezy' AND product_id='research-membership'
         AND provider_subscription_id=%s""",(p,),role="service_role")
    return [{
      "id":str(r[0]),"account_id":str(r[1]),"product_id":r[2],"provider":r[3],
      "provider_subscription_id":r[4],"state":r[5],
      "current_period_start":r[6].isoformat() if r[6] else None,
      "current_period_end":r[7].isoformat() if r[7] else None,
      "cancel_at_period_end":r[8],
    } for r in rows]

def do_events():
    rows=select("SELECT to_jsonb(e) FROM public.subscription_events e WHERE event_key=%s",(data["key"],),role="service_role")
    return [r[0] for r in rows]

def do_invoice():
    row=first("""SELECT public.record_research_signed_invoice_receipt(
       %s::uuid,%s,%s,%s,%s::timestamptz,%s::jsonb)""",
      (data["p_subscription_id"],data["p_event_key"],data["p_provider_event_id"],
       data["p_event_name"],data["p_occurred_at"],json.dumps(data["p_metadata"])),
       role="service_role")
    return row

def do_status():
    a=uuid.UUID(data["accountId"])
    s=uuid.UUID(data["subscriptionId"])
    incident=first("""SELECT to_jsonb(i) FROM research_lifecycle_private.deletion_billing_incidents i
       WHERE i.account_id=%s""",(a,))
    state=first("SELECT state::text FROM public.subscriptions WHERE id=%s",(s,))
    q=first("SELECT phase FROM research_lifecycle_private.deletion_auth_cleanup WHERE account_id=%s",(a,))
    return {
      "incident":incident,
      "subscriptionState":state,
      "eventCount":first("""SELECT count(*) FROM public.subscription_events
          WHERE subscription_id=%s AND metadata->>'researchP1InvoiceReceipt'='true'""",(s,)),
      "authUserCount":first("SELECT count(*) FROM auth.users WHERE id=%s",(a,)),
      "sendableEmailCount":first("""SELECT count(*) FROM public.notification_outbox
        WHERE message_id='account_deletion_completed'
        AND business_object_id=%s AND status IN ('queued','sending','accepted','delivered')""",(str(a),)),
      "pendingPrivacyCount":first("""SELECT count(*) FROM public.privacy_requests pr
         WHERE pr.request_type='deletion' AND pr.status='in_progress'
         AND pr.id=ANY((SELECT privacy_request_ids FROM research_lifecycle_private.deletion_auth_cleanup
           WHERE account_id=%s))""",(a,)),
      "queuePhase":q,
    }

actions={"setup":do_setup,"subscription":do_subscription,"events":do_events,
         "invoice":do_invoice,"status":do_status}
try:
    result=actions[cmd]()
    print(json.dumps(result,default=str))
except Exception as e:
    print(f"SYNTHETIC_BRIDGE_REFUSAL {type(e).__name__}: {str(e)[:240]}",file=sys.stderr)
    raise
