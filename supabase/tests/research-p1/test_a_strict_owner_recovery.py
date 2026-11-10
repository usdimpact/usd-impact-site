#!/usr/bin/env python3
"""Issue #1103: P1-A/B owner recovery, synthetic only in disposable PG17.
Run after source migration, base A-strict overlay and recovery overlay.
No hosted SQL, merchant/Auth requests, refunds, emails or customer records.
"""
import uuid
import hashlib
import psycopg
from psycopg.types.json import Jsonb

def cx(autocommit=True):
    return psycopg.connect(host="127.0.0.1",dbname="ci_review",autocommit=autocommit)

def db(sql,args=()):
    with cx() as c:
        x=c.execute(sql,args)
        return x.fetchone()[0] if x.description else None

def call(role,sql,args=()):
    with cx() as c:
        c.execute("SET ROLE "+role)
        try:
            x=c.execute(sql,args)
            return ("OK",x.fetchone()[0] if x.description else None)
        except psycopg.Error as e:
            return ("ERR",e.sqlstate+" "+str(e).splitlines()[0][:120])

N=0
def ok(name,condition,evidence=None):
    global N
    N+=1
    print(f"[A-STRICT-RECOVERY] {'PASS' if condition else 'FAIL'} #{N}: {name}"
          +(f" {str(evidence)[:130]}" if evidence is not None else ""),flush=True)
    if not condition:
        raise AssertionError(name)

def make():
    a=uuid.uuid4()
    db("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(a,"recovery-"+a.hex[:8]+"@invalid.example"))
    with cx() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(a),))
        c.execute("SELECT public.request_account_deletion()")
    db("""UPDATE public.profiles SET deletion_due_at=clock_timestamp()-interval '1 minute',
       deletion_requested_at=clock_timestamp()-interval '31 days' WHERE account_id=%s""",(a,))
    return a

def case(a):
    return "p1-"+a.hex[:12]

def code(a,label):
    return "p1-"+hashlib.sha256((str(a)+label).encode()).hexdigest()[:24]

def digest(label):
    return hashlib.sha256(label.encode()).hexdigest()

def evidence(a,label,at):
    return {
      "store_id":"41","product_key":"research-membership","mode":"live",
      "customer_scope_digest":digest("merchant-scope-"+str(a)),
      "inventory_digest":digest("inventory-"+label),
      "receipt_digest":digest("receipt-"+label),
      "read_observed_at":at.isoformat(),
      "subscription_pages":1,"invoice_pages":1,"order_pages":1,"checkout_pages":1,
      "subscriptions_terminal":True,"invoices_settled":True,
      "checkout_closed":True,"no_retries":True,"no_unknown_provider_objects":True
    }

def clearance(a,label,stage="pre_auth"):
    c=call("postgres","SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",(a,code(a,label)))
    assert c[0]=="OK",c
    ref=c[1]
    at=db("SELECT verified_at FROM public.research_billing_clearances WHERE id=%s",(ref,))
    att=call("postgres","SELECT public.a_strict_owner_record_merchant_receipt(%s,%s,%s,%s,%s)",(a,case(a),ref,stage,Jsonb(evidence(a,label,at))))
    assert att[0]=="OK",att
    return ref

def authorize(a,c):
    return call("postgres","SELECT public.a_strict_authorize(%s,%s,%s,'owner',clock_timestamp()+interval '40 minutes')",(a,case(a),c))

def phase(a,auth):
    return call("postgres","SELECT public.a_strict_phase_a(%s,%s)",(a,auth))

def claim(a,auth,purpose):
    return call("service_role","SELECT public.a_strict_claim(%s,%s,%s)",(a,auth,purpose))

def fence(a,auth,lease):
    return call("service_role","SELECT public.a_strict_fence(%s,%s,%s)",(a,auth,lease))

def mark(a,auth,lease):
    return call("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,auth,lease))

def incident(a):
    return db("SELECT to_jsonb(i) FROM research_lifecycle_private.deletion_billing_incidents i WHERE account_id=%s",(a,))

def queue(a):
    return db("SELECT to_jsonb(q) FROM research_lifecycle_private.deletion_auth_cleanup q WHERE account_id=%s",(a,))

def status(a):
    return db("SELECT to_jsonb(c) FROM research_lifecycle_private.a_strict_cases c WHERE account_id=%s",(a,))

def emails(a):
    return db("""SELECT count(*) FROM public.notification_outbox
      WHERE message_id='account_deletion_completed'
        AND business_object_id=%s AND status IN ('queued','sending','accepted','delivered')""",(str(a),))

def privacy_pending(a):
    ids=(queue(a) or {}).get("privacy_request_ids",[])
    if not ids:return 0
    return db("""SELECT count(*) FROM public.privacy_requests
      WHERE id=ANY(%s::uuid[]) AND status='in_progress' AND completed_at IS NULL""",(ids,))

# P1-A: durable intent -> crash -> later GET active is OBSERVATION, never re-DELETE.
a=make()
pre=clearance(a,"pre")
au=authorize(a,pre)
ok("owner-only case established",au[0]=="OK",au)
token=au[1]
ok("supervised Phase A",phase(a,token)[0]=="OK")
lr=claim(a,token,"auth")
ok("one exclusive Auth lease",lr[0]=="OK",lr)
l=uuid.UUID(lr[1]["lease_id"])
clearance(a,"fresh-after-phase")
ok("owner fresh merchant read permits SQL fence",fence(a,token,l)==("OK",True))
ok("one durable Auth DELETE intent",mark(a,token,l)==("OK",True))
ok("synthetic process crash leaves Auth user active",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)
# A hold is restrictive-only, allowed even if the case later expires.
held=call("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",(a,token,l,"prior_auth_attempt_ambiguous"))
ok("uncertain Auth result produces durable held incident",
 held[0]=="OK" and incident(a)["status"]=="open",held)
get_time=db("SELECT clock_timestamp()")
args=(a,case(a),"active",digest("request-"+str(a)),digest("get-active-"+str(a)),get_time,"owner")
ok("service_role cannot forge Auth GET evidence",
 call("service_role","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",args)[0]=="ERR")
review=call("postgres","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",args)
ok("owner may append authenticated-GET observation",review[0]=="OK",review)
ok("duplicate Auth evidence refused",
 call("postgres","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",args)[0]=="ERR")
ok("GET active alone never resets the one-time Auth DELETE intent",
 status(a)["auth_attempt_at"] is not None and mark(a,token,l)[0]=="ERR")
ok("no automatic Auth re-DELETE/identity restoration/queued completion",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1 and emails(a)==0)
due=db("SELECT clock_timestamp()+interval '20 days'")
pa=(a,case(a),"review_requested","owner",code(a,"legal"),code(a,"notice"),due)
ok("service_role cannot forge legal/privacy action",
 call("service_role","SELECT public.a_strict_owner_log_privacy_action(%s,%s,%s,%s,%s,%s,%s)",pa)[0]=="ERR")
pr=call("postgres","SELECT public.a_strict_owner_log_privacy_action(%s,%s,%s,%s,%s,%s,%s)",pa)
ok("owner logs pending privacy deadline with opaque references",pr[0]=="OK",pr)
ok("privacy log does not falsely complete actual privacy request",privacy_pending(a)>=1)
restrict=(a,case(a),"restrict_and_respond","owner",code(a,"legal2"),code(a,"notice2"),due)
ok("owner may record restrictive legal disposition without clearing hold",
 call("postgres","SELECT public.a_strict_owner_log_privacy_action(%s,%s,%s,%s,%s,%s,%s)",restrict)[0]=="OK")
ok("duplicate terminal privacy disposition refused",
 call("postgres","SELECT public.a_strict_owner_log_privacy_action(%s,%s,%s,%s,%s,%s,%s)",restrict)[0]=="ERR")
ok("terminal response LOG does not delete Auth or clear incident",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1 and incident(a)["status"]=="open")
ok("owner cannot financially resume while Auth is unconfirmed",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",
 (a,case(a),pre,"owner",code(a,"legal3"),code(a,"remedy3"),code(a,"resolve3"),digest("auth-a")))[0]=="ERR")

# P1-B: post-Auth account and late financial hold -> owner-only audited
# reconciliation after new merchant receipt. No email/privacy completion.
b=make()
bpre=clearance(b,"pre")
bt=authorize(b,bpre)[1]
ok("financial-case Phase A",phase(b,bt)[0]=="OK")
bl=claim(b,bt,"auth")
ok("financial-case Auth lease",bl[0]=="OK")
bid=uuid.UUID(bl[1]["lease_id"])
clearance(b,"new-fence")
ok("financial-case SQL fence",fence(b,bt,bid)==("OK",True))
ok("financial-case irrevocable Auth intent",mark(b,bt,bid)==("OK",True))
# Simulated external Auth DELETE and Admin GET in disposable source model ONLY.
db("DELETE FROM auth.users WHERE id=%s",(b,))
obs=call("postgres","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(b,bt,bid))
ok("synthetic Auth retired and independently attested",obs[0]=="OK",obs)
holdb=call("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",(b,bt,bid,"unknown_payment"))
ok("post-Auth financial incident durable",holdb[0]=="OK" and incident(b)["status"]=="open")
ok("unreconciled incident prevents completion claim",claim(b,bt,"complete")[0]=="ERR")
ok("pre-Auth merchant observation cannot resolve late post-Auth event",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",
 (b,case(b),bpre,"owner",code(b,"legal"),code(b,"remedy"),code(b,"resolve"),digest("auth-b")))[0]=="ERR")
post=clearance(b,"post-after-hold","post_auth")
refs=(b,case(b),post,"owner",code(b,"legal"),code(b,"remedy"),code(b,"resolve"),digest("auth-b"))
ok("service_role cannot release a held financial incident",
 call("service_role","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",refs)[0]=="ERR")
bad=list(refs);bad[4]="private-email@example.invalid"
ok("plain-text PII in legal reference rejected",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",tuple(bad))[0]=="ERR")
ok("bare Auth evidence digest without post-hold retired GET is rejected",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",refs)[0]=="ERR")
bget=call("postgres","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",
 (b,case(b),"retired",digest("b-auth-request"),digest("auth-b"),db("SELECT clock_timestamp()"),"owner"))
ok("fresh post-hold owner Auth-retired observation recorded",bget[0]=="OK",bget)
resolved=call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",refs)
ok("owner financial reconciliation durable after new post-Auth merchant custody",resolved[0]=="OK",resolved)
ok("reconciliation records monotonic event and timestamp",
 incident(b)["status"]=="resolved" and status(b)["reconciled_hold_at"]>=queue(b)["financial_hold_at"])
ok("reconciliation keeps original Auth attempt and financial hold custody",
 status(b)["auth_attempt_at"] is not None and queue(b)["financial_hold_at"] is not None)
ok("reconciliation does NOT complete privacy/email",
 privacy_pending(b)>=1 and emails(b)==0 and status(b)["completed_at"] is None)
ok("same incident cannot be reconciled twice",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",refs)[0]=="ERR")
ok("append-only reconciliation cannot be rewritten",
 call("postgres","UPDATE research_lifecycle_private.a_strict_financial_reconciliations SET legal_ref=%s WHERE account_id=%s RETURNING id",
 (code(b,"fake"),b))[0]=="ERR")
ok("no Auth identity silently restored after reconciliation",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(b,))==0)

# A second late event after reconciliation must reopen financial custody;
# the old owner resolution and post-Auth evidence cannot silently carry over.
again=call("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",(b,bt,bid,"retried_payment"))
ok("later retry reopens a new durable financial incident",again[0]=="OK" and incident(b)["status"]=="open")
ok("reopened incident cannot claim completion",claim(b,bt,"complete")[0]=="ERR")
ok("reopened incident does not send completion email",emails(b)==0)
ok("reused merchant receipt cannot resolve later event",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",refs)[0]=="ERR")

# P1-B recovery after case expiry when financial issue is adjudicated:
# prior attempt stays one-time and a NEW case capability is required.
c=make()
cp=clearance(c,"pre")
ct=authorize(c,cp)[1]
ok("expiry case Phase A",phase(c,ct)[0]=="OK")
cc=claim(c,ct,"auth")
ok("expiry case lease",cc[0]=="OK")
cl=uuid.UUID(cc[1]["lease_id"])
clearance(c,"post-phase")
ok("expiry case fence",fence(c,ct,cl)==("OK",True))
ok("expiry case Auth intent",mark(c,ct,cl)==("OK",True))
db("DELETE FROM auth.users WHERE id=%s",(c,))
ok("expiry case Auth observation",
 call("postgres","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(c,ct,cl))[0]=="OK")
ok("expiry case financial hold",
 call("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",(c,ct,cl,"unknown_payment"))[0]=="OK")
db("""UPDATE research_lifecycle_private.a_strict_cases
  SET expires_at=clock_timestamp()-interval '1 second' WHERE account_id=%s""",(c,))
ok("expired case blocks direct completion",claim(c,ct,"complete")[0]=="ERR")
after=clearance(c,"recovery","post_auth")
cref=(c,case(c),after,"owner",code(c,"legal"),code(c,"remedy"),code(c,"resolve"),digest("auth-c"))
ok("expired post-Auth case refuses reconciliation without fresh owner GET",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",cref)[0]=="ERR")
cget=call("postgres","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",
 (c,case(c),"retired",digest("c-auth-request"),digest("auth-c"),db("SELECT clock_timestamp()"),"owner"))
ok("owner may record fresh Auth-retired GET after case expiry",cget[0]=="OK",cget)
ok("owner reconciliation allowed for expired but Auth-retired case",
 call("postgres","SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",cref)[0]=="OK")
ok("old expired token still blocked",claim(c,ct,"complete")[0]=="ERR")
nextpre=clearance(c,"owner-rotate-after-hold")
rot=call("postgres","SELECT public.a_strict_owner_rotate(%s,%s,%s,%s,clock_timestamp()+interval '35 minutes')",
 (c,case(c),nextpre,"owner"))
ok("only owner can renew after incident reconciled",rot[0]=="OK" and rot[1]!=ct,rot)
newcap=rot[1]
ok("old token invalidated by renewal",claim(c,ct,"complete")[0]=="ERR")
lease2=claim(c,newcap,"complete")
ok("new owner case may lease after explicit recovery",lease2[0]=="OK",lease2)
ok("old post-Auth merchant receipt cannot complete the renewed case",
 call("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",
 (c,newcap,uuid.UUID(lease2[1]["lease_id"])))[0]=="ERR")
ok("recovery never resends DELETE, restores access or queues email",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(c,))==0 and emails(c)==0)
ok("privacy after recovery remains pending",privacy_pending(c)>=1)


# Real TWO-CONNECTION overlap: the financial hold writer cannot pass the
# owner reconciliation's profile lock. A later committed payment/hold reopens
# an incident even if the owner had an earlier valid clearance.
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import time
post2=clearance(b,"owner-second-reconciliation","post_auth")
auth2=call("postgres","SELECT public.a_strict_owner_record_auth_review(%s,%s,%s,%s,%s,%s,%s)",
 (b,case(b),"retired",digest("b-auth-request-2"),digest("auth-b-2"),
  db("SELECT clock_timestamp()"),"owner"))
ok("second incident has fresh post-hold Auth observation",auth2[0]=="OK",auth2)
refs2=(b,case(b),post2,"owner",code(b,"legal-2"),code(b,"remedy-2"),
       code(b,"resolve-2"),digest("auth-b-2"))
started=Event()
def concurrent_hold_writer():
    started.set()
    return call("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",
        (b,bt,bid,"late_signed_webhook"))
with ThreadPoolExecutor(max_workers=1) as pool:
    with cx(autocommit=False) as owner_tx:
        owner_tx.execute("SET ROLE postgres")
        owner_tx.execute("SELECT 1 FROM public.profiles WHERE account_id=%s FOR UPDATE",(b,))
        owned=owner_tx.execute(
          "SELECT public.a_strict_owner_reconcile_financial(%s,%s,%s,%s,%s,%s,%s,%s)",
          refs2).fetchone()[0]
        ok("owner financial reconciliation held open inside profile transaction",owned is not None)
        future=pool.submit(concurrent_hold_writer)
        ok("concurrent financial writer began its separate connection",started.wait(timeout=5))
        time.sleep(.10)
        ok("financial hold writer actually blocks behind profile lock",not future.done())
        owner_tx.commit()
    late=future.result(timeout=10)
ok("financial hold worker proceeds after owner commit",late[0]=="OK",late)
ok("later financial observation reopens hold despite prior owner decision",
 incident(b)["status"]=="open" and
 incident(b)["last_observed_at"]>status(b)["reconciled_hold_at"])
ok("new hold blocks completion and case rotation",
 claim(b,bt,"complete")[0]=="ERR" and
 call("postgres","SELECT public.a_strict_owner_rotate(%s,%s,%s,%s,clock_timestamp()+interval '35 minutes')",
      (b,case(b),post2,"owner"))[0]=="ERR")
ok("concurrent financial event never restores Auth or sends email",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(b,))==0 and emails(b)==0)
print(f"[A-STRICT-RECOVERY] {N} disposable PostgreSQL {db('SHOW server_version')} owner-only recovery tests PASS; no hosted operations.",flush=True)
