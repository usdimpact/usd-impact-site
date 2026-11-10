#!/usr/bin/env python3
"""#1103 A-strict SQL overlay: synthetic-only disposable PG17 negative tests.
Never run against hosted Supabase. Execute AFTER P1 baseline suites and
the a-strict-overlay-review.sql DRAFT source overlay."""
import uuid
import time
import psycopg

def conn(autocommit=True):
    return psycopg.connect(dbname="ci_review",host="127.0.0.1",autocommit=autocommit)

def q(role, sql, args=()):
    with conn() as c:
        c.execute("SET ROLE " + role)
        try:
            x=c.execute(sql,args)
            return ("OK",x.fetchone()[0] if x.description else None)
        except psycopg.Error as e:
            return ("ERR",f"{e.sqlstate} {str(e).splitlines()[0][:130]}")

def db(sql,args=()):
    with conn() as c:
        cur=c.execute(sql,args)
        return cur.fetchone()[0] if cur.description else None

def check(label, condition, evidence=None):
    global count
    count+=1
    print(f"[A-STRICT] {'PASS' if condition else 'FAIL'} #{count}: {label} {str(evidence)[:140] if evidence else ''}",flush=True)
    if not condition: raise AssertionError(label)

def new_account():
    a=uuid.uuid4()
    db("INSERT INTO auth.users(id,email) VALUES (%s,%s)",(a,f"astrict-{a.hex[:10]}@invalid.example"))
    with conn() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(a),))
        c.execute("SELECT public.request_account_deletion()")
    db("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
    deletion_requested_at=now()-interval '31 days' WHERE account_id=%s""",(a,))
    return a

def clear(a,tag):
    return q("postgres","SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",(a,tag))

def start(a,ref):
    return q("postgres","SELECT public.a_strict_authorize(%s,%s,%s,'synthetic-owner',clock_timestamp()+interval '40 minutes')",(a,"p1-"+a.hex[:12],ref))

def phase(a,token):
    return q("service_role","SELECT public.a_strict_phase_a(%s,%s)",(a,token))

def lease(a,token,purpose):
    return q("service_role","SELECT public.a_strict_claim(%s,%s,%s)",(a,token,purpose))

def fence(a,token,l):
    return q("service_role","SELECT public.a_strict_fence(%s,%s,%s)",(a,token,l))

def inc(a):
    return db("SELECT status FROM research_lifecycle_private.deletion_billing_incidents WHERE account_id=%s",(a,))

def state(a):
    return db("SELECT to_jsonb(q) FROM research_lifecycle_private.deletion_auth_cleanup q WHERE account_id=%s",(a,))

def privacy_open(a):
    # The existing Phase A intentionally detaches privacy_requests.account_id.
    # Check the durable, private recorded request IDs; never look up by the
    # nullable account_id after SQL finalization.
    ids=(state(a) or {}).get("privacy_request_ids",[])
    if not ids: return 0
    return db("""SELECT count(*) FROM public.privacy_requests
      WHERE id=ANY(%s::uuid[]) AND status='in_progress'
       AND completed_at IS NULL""",(ids,))

def sendable(a):
    return db("""SELECT count(*) FROM public.notification_outbox WHERE business_object_id=%s
    AND message_id='account_deletion_completed'
    AND status IN ('queued','sending','accepted','delivered')""",(str(a),))

count=0
# Legacy direct calls and automatic batch cannot be used after the overlay.
for sig in [
  'public.finalize_deletion_and_queue_auth_cleanup(uuid)',
  'public.claim_deletion_auth_cleanup_batch(integer)',
  'public.check_deletion_auth_cleanup_billing_fence(uuid,uuid)',
  'public.confirm_deletion_auth_cleanup(uuid,uuid)',
  'public.finish_deletion_auth_cleanup(uuid,uuid)',
]:
    r=db("select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
    check("legacy direct RPC removed for "+sig, r is False,r)

a=new_account()
r=q("service_role","SELECT public.a_strict_authorize(%s,%s,%s,'spoof',clock_timestamp()+interval '40 minutes')",
    (a,'p1-'+a.hex[:12],uuid.uuid4()))
check("service_role cannot issue owner authorization",r[0]=="ERR" and "42501" in r[1],r)
check("unguarded Phase A denied",phase(a,uuid.uuid4())[0]=="ERR")
check("denial leaves Auth user intact",db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)
p=clear(a,"syn-astrict-pre-"+a.hex[:12])
check("owner preclearance recorded",p[0]=="OK",p)
pre=p[1]
r=start(a,pre)
check("owner single-account capability issued",r[0]=="OK",r)
token=r[1]
check("owner case cannot silently reauthorize",start(a,pre)[0]=="ERR")
check("wrong account capability fails",phase(a,uuid.uuid4())[0]=="ERR")
check("Phase A creates durable custody",phase(a,token)[0]=="OK")
check("Phase A leaves Auth intact",db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)
check("Phase A does not mark privacy completed",privacy_open(a)>=1)
check("Phase A cannot repeat",phase(a,token)[0]=="ERR")
r=lease(a,token,'auth')
check("single-account Auth lease",r[0]=="OK" and r[1]['phase']=='auth_pending',r)
l=uuid.UUID(r[1]['lease_id'])
check("simultaneous lease refused",lease(a,token,'auth')[0]=="ERR")
check("wrong lease refuses fence",fence(a,token,uuid.uuid4())[0]=="ERR")
check("pre-Phase-A clearance alone does not pass fence",fence(a,token,l)[0]=="ERR")
check("no deletion attempt recorded by refused fence",state(a)['financial_fence_passed_at'] is None)
check("owner fresh post-Phase-A clearance recorded",clear(a,"syn-astrict-fresh-"+a.hex[:12])[0]=="OK")
check("fence passes after current provider receipt",fence(a,token,l)==("OK",True))
check("Auth DELETE intent can be recorded once",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,token,l))==("OK",True))
check("repeated Auth intent DENIED",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,token,l))[0]=="ERR")
check("new fence denied after attempted Auth",
 fence(a,token,l)[0]=="ERR")
check("no implicit Auth deletion",db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)

# Synthetic external Auth retirement: no network; explicitly model deleted user.
db("DELETE FROM auth.users WHERE id=%s",(a,))
r=q("service_role","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(a,token,l))
check("account-bound Auth GET attestation stored",r[0]=="OK" and r[1]['post_auth_merchant_verified'] is False,r)
check("Auth observed but no email dispatch",sendable(a)==0)
r=lease(a,token,'complete')
check("post-Auth completion claim",r[0]=="OK" and r[1]['phase']=='auth_confirmed',r)
cl=uuid.UUID(r[1]['lease_id'])
check("completion denied without post-Auth merchant receipt",
 q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(a,token,cl))[0]=="ERR")
check("owner cannot certify pre-Auth evidence as post-Auth",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
   (a,token,pre,"p1-"+a.hex[:12]))[0]=="ERR")
time.sleep(0.03)
post=clear(a,"syn-astrict-post-"+a.hex[:12])
check("post-Auth clearance recorded",post[0]=="OK",post)
check("ambiguous merchant invoices refuse post-Auth clearance",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,false)",
   (a,token,post[1],"p1-"+a.hex[:12]))[0]=="ERR")
check("owner-reviewed post-Auth evidence admitted",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
   (a,token,post[1],"p1-"+a.hex[:12]))==("OK",True))

# Signed late payment after post-Auth provider read must invalidate release.
paid=q("service_role","SELECT public.record_research_paid_binding_refusal('lemon-squeezy',%s,%s,%s,%s)",
  ("syn-astrict-paid-"+a.hex[:12],a,"syn-astrict-checkout-"+a.hex[:12],"SIGNED_PAID_BINDING_REFUSED"))
check("late signed paid-binding evidence persisted",paid[0]=="OK",paid)
check("late signed evidence opens durable incident",inc(a)=="open")
check("late event denies completion",
 q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(a,token,cl))[0]=="ERR")
check("privacy remains pending",privacy_open(a)>=1)
check("no completion email released after late payment",sendable(a)==0)
h=q("service_role","SELECT public.a_strict_hold(%s,%s,%s,%s)",(a,token,cl,'unknown_payment'))
check("unknown payment adds durable supervised hold",h[0]=="OK" and h[1]['status']=='open',h)
check("hold persists and bars lease",state(a)['financial_hold_at'] is not None and lease(a,token,'complete')[0]=="ERR")
check("hold does not recreate Auth",db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==0)

# Separate account: Auth DELETE request ambiguous, refuse re-use of attempt.
b=new_account()
pr=clear(b,"syn-astrict-bpre-"+b.hex[:12])
tr=start(b,pr[1])
check("independent owner session",tr[0]=="OK")
tb=tr[1]
check("independent Phase A",phase(b,tb)[0]=="OK")
rb=lease(b,tb,'auth')
check("independent claim",rb[0]=="OK")
lb=uuid.UUID(rb[1]['lease_id'])
check("fresh authority after Phase A",clear(b,"syn-astrict-bfresh-"+b.hex[:12])[0]=="OK")
check("fresh fence on second account",fence(b,tb,lb)==("OK",True))
check("record possible irreversible Auth attempt",q("service_role",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(b,tb,lb))==("OK",True))
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup SET
  next_attempt_at=clock_timestamp()-interval '1 second' WHERE account_id=%s""",(b,))
again=lease(b,tb,'auth')
check("expired lease may be reclaimed only explicitly",again[0]=="OK" and again[1]['prior_auth_attempt'] is True,again)
check("reclaimed lease cannot authorize second Auth DELETE",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",
   (b,tb,uuid.UUID(again[1]['lease_id'])))[0]=="ERR")
check("Auth still intact after ambiguous retry",db("SELECT count(*) FROM auth.users WHERE id=%s",(b,))==1)
check("no silently restored entitlements or email",sendable(b)==0)
# A supervised account may outlive a session. Only the SQL owner can
# rotate the opaque capability; never reset the one-time Auth attempt.
check("service_role denied owner capability renewal",
 q("service_role","SELECT public.a_strict_owner_rotate(%s,%s,%s,%s,clock_timestamp()+interval '45 minutes')",
  (b,"p1-"+b.hex[:12],pr[1],"spoof"))[0]=="ERR")
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
 SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE account_id=%s""",(b,))
rotclear=clear(b,"syn-astrict-rotate-"+b.hex[:12])
check("fresh per-account owner evidence available before rotation",rotclear[0]=="OK")
rot=q("postgres","SELECT public.a_strict_owner_rotate(%s,%s,%s,%s,clock_timestamp()+interval '45 minutes')",
  (b,"p1-"+b.hex[:12],rotclear[1],"synthetic-owner"))
check("owner alone rotates case capability",rot[0]=="OK" and rot[1]!=tb,rot)
newcap=rot[1]
check("old owner capability invalidated immediately",lease(b,tb,'auth')[0]=="ERR")
newlease=lease(b,newcap,'auth')
check("new capability leases only that single account",
 newlease[0]=="OK" and newlease[1]['prior_auth_attempt'] is True,newlease)
check("renewal preserves one-time Auth DELETE ban",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",
   (b,newcap,uuid.UUID(newlease[1]['lease_id'])))[0]=="ERR")
check("renewal never recovers Auth identity",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(b,))==1)
# Deterministic race: signed charge after the SQL fence, before the external
# Auth call. The mark attempt rechecks under profile lock and must refuse.
c=new_account()
cp=clear(c,"syn-astrict-cpre-"+c.hex[:12])
cr=start(c,cp[1])
check("race account owner authorization",cr[0]=="OK")
tc=cr[1]
check("race account Phase A",phase(c,tc)[0]=="OK")
lcrow=lease(c,tc,'auth')
check("race account Auth lease",lcrow[0]=="OK")
lc=uuid.UUID(lcrow[1]['lease_id'])
check("race account post-Phase-A owner clearance",
 clear(c,"syn-astrict-cfresh-"+c.hex[:12])[0]=="OK")
check("race SQL fence passes before a late charge",fence(c,tc,lc)==("OK",True))
paid_c=q("service_role","SELECT public.record_research_paid_binding_refusal('lemon-squeezy',%s,%s,%s,%s)",
 ("syn-astrict-cpaid-"+c.hex[:12],c,"syn-astrict-ck-"+c.hex[:12],"SIGNED_PAID_BINDING_REFUSED"))
check("late signed charge after fence is durable",paid_c[0]=="OK" and inc(c)=="open")
check("mark Auth attempt refuses intervening paid event",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(c,tc,lc))[0]=="ERR")
check("Auth remains intact when payment commits before intent",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(c,))==1)
check("no completion email on refused post-fence payment",sendable(c)==0)

# Clean synthetic positive path and real outbox trigger behaviour: both
# post-Auth SQL barriers run before staged email may become dispatchable.
import hashlib
d=new_account()
dp=clear(d,"syn-astrict-dpre-"+d.hex[:12])
dr=start(d,dp[1])
check("clean path owner authorization",dr[0]=="OK")
td=dr[1]
check("clean Phase A",phase(d,td)[0]=="OK")
dl=lease(d,td,'auth')
check("clean Auth lease",dl[0]=="OK")
ld=uuid.UUID(dl[1]['lease_id'])
check("clean fresh pre-Auth clearance",clear(d,"syn-astrict-dfresh-"+d.hex[:12])[0]=="OK")
check("clean Auth financial fence",fence(d,td,ld)==("OK",True))
check("clean durable Auth intent",q("service_role",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(d,td,ld))==("OK",True))
# SIMULATE only the external Auth DELETE and positive GET in disposable PG17.
db("DELETE FROM auth.users WHERE id=%s",(d,))
observed=q("service_role","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(d,td,ld))
check("clean Auth retirement observed; merchant still unverified",observed[0]=="OK")
r=lease(d,td,'complete')
check("clean completion lease",r[0]=="OK")
dcomp=uuid.UUID(r[1]['lease_id'])
check("cannot confirm before post-Auth read",
 q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(d,td,dcomp))[0]=="ERR")
time.sleep(.03)
post_d=clear(d,"syn-astrict-dpost-"+d.hex[:12])
check("clean post-Auth evidence",post_d[0]=="OK")
check("owner explicitly marks all merchant paths as reviewed",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,post_d[1],"p1-"+d.hex[:12]))==("OK",True))
confirmed=q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(d,td,dcomp))
check("clean post-Auth barrier passes",confirmed[0]=="OK" and confirmed[1]['phase']=='auth_confirmed')
key="notification:v1:"+hashlib.sha256(("astrict-"+str(d)).encode()).hexdigest()
outbox=db("""INSERT INTO public.notification_outbox(
 idempotency_key,event_id,message_id,classification,business_object_type,
 business_object_id,state_version,recipient_email_normalized,
 template_id,template_version,provider,payload,status)
 SELECT %s,%s,'account_deletion_completed','transactional_operational',
 'account_deletion_request',%s,floor(extract(epoch from q.deleted_at)/60)::integer,
 lower(btrim(q.recipient_email)),
 'account_deletion_completed','v1','resend','{}'::jsonb,'queued'
 FROM research_lifecycle_private.deletion_auth_cleanup q WHERE q.account_id=%s
 RETURNING id""",(key,"synthetic-astrict-"+d.hex,str(d),d))
check("clean email becomes staged, not immediately sendable",
 outbox is not None and sendable(d)==0)
check("direct service_role cannot bypass staged email",
 q("service_role","UPDATE public.notification_outbox SET status='queued' WHERE id=%s RETURNING id",(outbox,))[0]=="ERR")
check("wrong outbox receipt cannot finish",
 q("service_role","SELECT public.a_strict_finish_release(%s,%s,%s,%s)",
 (d,td,dcomp,uuid.uuid4()))[0]=="ERR")
finish=q("service_role","SELECT public.a_strict_finish_release(%s,%s,%s,%s)",
 (d,td,dcomp,outbox))
check("staged email and privacy completion released atomically",finish==("OK",True),finish)
check("clean released outbox now sendable after both barriers",sendable(d)==1)
check("clean custody scrubs duplicate email",
 state(d)['phase']=='email_enqueued' and state(d)['recipient_email'] is None)
# Actual TWO-CONNECTION synthetic worker contention. Both callers race to
# lease one account; profile/q locks must permit only one unexpired lease.
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
e=new_account()
ep=clear(e,"syn-astrict-epre-"+e.hex[:12])
er=start(e,ep[1])
check("concurrent worker account authorized",er[0]=="OK")
te=er[1]
check("concurrent worker account Phase A",phase(e,te)[0]=="OK")
barrier=Barrier(3)
def competing_claim():
    barrier.wait(timeout=5)
    return lease(e,te,'auth')
with ThreadPoolExecutor(max_workers=2) as pool:
    first=pool.submit(competing_claim);second=pool.submit(competing_claim)
    barrier.wait(timeout=5)
    wins=[first.result(timeout=10),second.result(timeout=10)]
check("two concurrent deletion workers share exactly one valid lease",
  sorted(r[0] for r in wins)==['ERR','OK'],wins)
check("competing workers never retire Auth",db("SELECT count(*) FROM auth.users WHERE id=%s",(e,))==1)

# Signed payment writer waits on the same account lock while Phase A commits.
# That delivery MUST be persisted *after* Phase A as an unresolved incident,
# never be dropped merely because the original identity was finalized.
f=new_account()
fp=clear(f,"syn-astrict-fpre-"+f.hex[:12])
fr=start(f,fp[1])
check("concurrent payment account authorized",fr[0]=="OK")
tf=fr[1]
started=Event()
def signed_writer():
    started.set()
    return q("service_role","SELECT public.record_research_paid_binding_refusal('lemon-squeezy',%s,%s,%s,%s)",
      ("syn-astrict-fpaid-"+f.hex[:12],f,"syn-astrict-fck-"+f.hex[:12],"SIGNED_PAID_BINDING_REFUSED"))
with ThreadPoolExecutor(max_workers=1) as pool:
    with conn(autocommit=False) as locked:
        locked.execute("SET ROLE postgres")
        locked.execute("SELECT 1 FROM public.profiles WHERE account_id=%s FOR UPDATE",(f,))
        future=pool.submit(signed_writer)
        started.wait(timeout=5)
        time.sleep(.03)  # writer cannot pass the held profile lock
        locked.execute("SET ROLE service_role")
        phase_receipt=locked.execute("SELECT public.a_strict_phase_a(%s,%s)",(f,tf)).fetchone()[0]
        locked.commit()
    payment_receipt=future.result(timeout=10)
check("Phase A won account lock before signed payment",
 phase_receipt['phase']=='auth_pending')
check("concurrent signed payment persists after Phase A",
 payment_receipt[0]=='OK' and inc(f)=='open',payment_receipt)
check("post-finalization incident blocks subsequent worker lease",lease(f,tf,'auth')[0]=='ERR')
check("concurrent paid delivery never deletes Auth",db("SELECT count(*) FROM auth.users WHERE id=%s",(f,))==1)
check("no concurrent payment completion email",sendable(f)==0)
print(f"[A-STRICT] {count} executable disposable PG17 checks PASS; NO hosted SQL, Auth or merchant IO.",flush=True)
