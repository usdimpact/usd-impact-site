#!/usr/bin/env python3
"""#1103 A-strict SQL overlay: synthetic-only disposable PG17 negative tests.
Never run against hosted Supabase. Execute AFTER P1 baseline suites and
the a-strict-overlay-review.sql DRAFT source overlay."""
import uuid
import time
import psycopg
import hashlib
from psycopg.types.json import Jsonb

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

def evidence(a,tag,verified, *, mode="live", store="41", customer_digest=None,
             complete=True):
    return {
        "store_id":store, "product_key":"research-membership", "mode":mode,
        "customer_scope_digest":customer_digest or hashlib.sha256(str(a).encode()).hexdigest(),
        "inventory_digest":hashlib.sha256(tag.encode()).hexdigest(),
        "receipt_digest":hashlib.sha256((tag+"-owner-custody").encode()).hexdigest(),
        "read_observed_at":verified.isoformat(),
        "subscription_pages":1, "invoice_pages":1, "order_pages":1, "checkout_pages":1,
        "subscriptions_terminal":True,"invoices_settled":True,
        "checkout_closed":True,"no_retries":True,
        "no_unknown_provider_objects":complete,
    }

def attest(a,tag,clearance,stage="pre_auth",*,mode="live",store="41",
           customer_digest=None,complete=True):
    observed=db("SELECT verified_at FROM public.research_billing_clearances WHERE id=%s",(clearance,))
    if observed is None: return ("ERR","no clearance")
    capsule=evidence(a,tag,observed,mode=mode,store=store,
                     customer_digest=customer_digest,complete=complete)
    return q("postgres",
      "SELECT public.a_strict_owner_record_merchant_receipt(%s,%s,%s,%s,%s)",
      (a,"p1-"+a.hex[:12],clearance,stage,Jsonb(capsule)))

def clear(a,tag,stage="pre_auth"):
    # Sanitize all public verification_reference values: opaque, never PII.
    ref="p1-"+hashlib.sha256(tag.encode()).hexdigest()[:24]
    receipt=q("postgres",
      "SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",
      (a,ref))
    if receipt[0]!="OK": return receipt
    att=attest(a,tag,receipt[1],stage)
    if att[0]!="OK": return att
    return receipt

def start(a,ref):
    return q("postgres","SELECT public.a_strict_authorize(%s,%s,%s,'synthetic-owner',clock_timestamp()+interval '40 minutes')",(a,"p1-"+a.hex[:12],ref))

def synthetic_age_immutable_observation(clearance_ids):
    # Disposable CI ONLY: simulate passage of 16 minutes without sleeping.
    # Disable append-only triggers under job-local superuser inside a single
    # transaction ONLY to backdate synthetic observation facts. Normal
    # transactions and all product code remain unable to modify such facts.
    with conn(autocommit=False) as c:
        c.execute("SET LOCAL session_replication_role = 'replica'")
        stamp=c.execute("SELECT clock_timestamp()-interval '16 minutes'").fetchone()[0]
        c.execute("""UPDATE public.research_billing_clearances
            SET verified_at=%s WHERE id=ANY(%s::uuid[])""",(stamp,clearance_ids))
        c.execute("""UPDATE research_lifecycle_private.a_strict_merchant_receipts
            SET read_observed_at=%s WHERE clearance_id=ANY(%s::uuid[])""",(stamp,clearance_ids))
        c.execute("SET LOCAL session_replication_role = 'origin'")
        c.commit()

def phase(a,token):
    return q("postgres","SELECT public.a_strict_phase_a(%s,%s)",(a,token))

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
check("even with correct capability service_role cannot enter owner Phase A",
 q("service_role","SELECT public.a_strict_phase_a(%s,%s)",(a,token))[0]=="ERR")
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
check("service_role cannot create supervised Auth DELETE intent",
 q("service_role","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,token,l))[0]=="ERR")
check("Auth DELETE intent can be recorded once",
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,token,l))==("OK",True))
check("repeated Auth intent DENIED",
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(a,token,l))[0]=="ERR")
check("new fence denied after attempted Auth",
 fence(a,token,l)[0]=="ERR")
check("no implicit Auth deletion",db("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)

# Synthetic external Auth retirement: no network; explicitly model deleted user.
db("DELETE FROM auth.users WHERE id=%s",(a,))
check("service_role cannot attest an external Auth Admin GET",
 q("service_role","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(a,token,l))[0]=="ERR")
r=q("postgres","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(a,token,l))
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
post=clear(a,"syn-astrict-post-"+a.hex[:12],"post_auth")
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
check("record possible irreversible Auth attempt",q("postgres",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(b,tb,lb))==("OK",True))
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup SET
  next_attempt_at=clock_timestamp()-interval '1 second' WHERE account_id=%s""",(b,))
again=lease(b,tb,'auth')
check("expired lease may be reclaimed only explicitly",again[0]=="OK" and again[1]['prior_auth_attempt'] is True,again)
check("reclaimed lease cannot authorize second Auth DELETE",
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",
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
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",
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
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(c,tc,lc))[0]=="ERR")
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
check("clean durable Auth intent",q("postgres",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(d,td,ld))==("OK",True))
# SIMULATE only the external Auth DELETE and positive GET in disposable PG17.
db("DELETE FROM auth.users WHERE id=%s",(d,))
observed=q("postgres","SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(d,td,ld))
check("clean Auth retirement observed; merchant still unverified",observed[0]=="OK")
r=lease(d,td,'complete')
check("clean completion lease",r[0]=="OK")
dcomp=uuid.UUID(r[1]['lease_id'])
check("cannot confirm before post-Auth read",
 q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(d,td,dcomp))[0]=="ERR")
time.sleep(.03)
# A generic owner clearance and three TRUE booleans cannot bypass the
# private post-Auth merchant receipt. Distinct store/customer scope is HOLD.
rawpost=q("postgres",
 "SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",
 (d,"p1-"+d.hex[:12]+"-generic-post"))
check("generic post-Auth clearance exists but has no inventory",rawpost[0]=="OK")
check("generic post-Auth clearance denied despite all booleans",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,rawpost[1],"p1-"+d.hex[:12]))[0]=="ERR")
wrongstore=q("postgres",
 "SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",
 (d,"p1-"+d.hex[:12]+"-wrong-store"))
check("different merchant store owner receipt can be recorded",
 attest(d,"wrong-store",wrongstore[1],"post_auth",store="42")[0]=="OK")
check("post-Auth merchant store mismatch rejected",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,wrongstore[1],"p1-"+d.hex[:12]))[0]=="ERR")
wrongcustomer=q("postgres",
 "SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",
 (d,"p1-"+d.hex[:12]+"-wrong-customer"))
check("different customer digest owner receipt can be recorded",
 attest(d,"wrong-customer",wrongcustomer[1],"post_auth",customer_digest="b"*64)[0]=="OK")
check("post-Auth canonical customer mismatch rejected",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,wrongcustomer[1],"p1-"+d.hex[:12]))[0]=="ERR")
post_d=clear(d,"syn-astrict-dpost-"+d.hex[:12],"post_auth")
check("clean post-Auth evidence",post_d[0]=="OK")
check("owner explicitly marks all merchant paths as reviewed",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,post_d[1],"p1-"+d.hex[:12]))==("OK",True))
# The post-Auth evidence can expire even after owner accepted it. Both
# confirm and finish enforce the same candidate 15-minute threshold.
synthetic_age_immutable_observation([post_d[1]])
check("D3 expired post-Auth evidence prevents SQL/notification completion",
 q("service_role","SELECT public.a_strict_confirm_release(%s,%s,%s)",(d,td,dcomp))[0]=="ERR")
post_retry=clear(d,"syn-astrict-dpost-fresh-"+d.hex[:12],"post_auth")
check("owner re-read creates new post-Auth immutable receipt",post_retry[0]=="OK")
check("owner explicitly replaces stale post-Auth attestation",
 q("postgres","SELECT public.a_strict_owner_post_auth_clearance(%s,%s,%s,%s,true,true,true)",
 (d,td,post_retry[1],"p1-"+d.hex[:12]))==("OK",True))
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
# N3: actual service_role cannot rewrite completion identity after release.
# N2 direct staged-to-queued bypass is separately covered above.
check("N3a queued completion recipient rewrite denied under service_role",
  q("service_role","UPDATE public.notification_outbox SET recipient_email_normalized=%s WHERE id=%s RETURNING id",
  ("redirected@invalid.example",outbox))[0]=="ERR")
check("N3b queued completion account rewrite denied under service_role",
  q("service_role","UPDATE public.notification_outbox SET business_object_id=%s WHERE id=%s RETURNING id",
  (str(uuid.uuid4()),outbox))[0]=="ERR")
check("N3c queued completion message rewrite denied under service_role",
  q("service_role","UPDATE public.notification_outbox SET message_id='other_message' WHERE id=%s RETURNING id",
  (outbox,))[0]=="ERR")
delivery=q("service_role",
  "UPDATE public.notification_outbox SET status='sending' WHERE id=%s RETURNING status",
  (outbox,))
check("legitimate completion delivery status update still permitted",
  delivery==("OK","sending"),delivery)
check("N3e provider mutation denied to SQL owner by immutable trigger",
  q("postgres","UPDATE public.notification_outbox SET provider='smtp' WHERE id=%s RETURNING id",
    (outbox,))[0]=="ERR")
check("N3f payload mutation denied to SQL owner by immutable trigger",
  q("postgres","UPDATE public.notification_outbox SET payload=payload || %s::jsonb WHERE id=%s RETURNING id",
    ('{"extra":"not-in-intent"}',outbox))[0]=="ERR")
check("N3g completion consent metadata mutation denied to SQL owner",
  q("postgres","UPDATE public.notification_outbox SET consent_checked_at=clock_timestamp() WHERE id=%s RETURNING id",
    (outbox,))[0]=="ERR")
check("N3h completion created timestamp mutation denied to SQL owner",
  q("postgres","UPDATE public.notification_outbox SET created_at=clock_timestamp() WHERE id=%s RETURNING id",
    (outbox,))[0]=="ERR")
check("P2 service_role cannot UPDATE completion identity even before trigger",
  db("SELECT has_column_privilege('service_role','public.notification_outbox','recipient_email_normalized','UPDATE')") is False)
check("P2 service_role retains status-only UPDATE permission",
  db("SELECT has_column_privilege('service_role','public.notification_outbox','status','UPDATE')") is True)
final=q("service_role","UPDATE public.notification_outbox SET status='delivered' WHERE id=%s RETURNING status",(outbox,))
check("P2 legitimate completion delivery terminal state still allowed",
  final==("OK","delivered"),final)
check("N6 delivered completion cannot re-arm queued resend",
  q("service_role","UPDATE public.notification_outbox SET status='queued' WHERE id=%s RETURNING id",(outbox,))[0]=="ERR")
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
        # SQL-owner Phase A only, while the signed service-role payment worker waits.
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

# D3 15-minute clearance is a source-only PROPOSAL. Test each independent
# boundary: authorization, post-Phase-A SQL fence and final Auth-attempt intent.
g=new_account()
# Deliberately pass a syntactically valid account+reference, but 16-min evidence.
# A fresh owner case is mandatory and no Auth operation occurs.
gpre=q("postgres","SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp()-interval '16 minutes','synthetic-owner')",
 (g,"p1-"+g.hex[:12]+"-stale"))
check("D3 16-minute owner clearance can be recorded for evidence",gpre[0]=="OK",gpre)
check("D3 16-minute pre-Auth case authorization refused",start(g,gpre[1])[0]=="ERR")
check("D3 stale case refusal preserves Auth identity",db("SELECT count(*) FROM auth.users WHERE id=%s",(g,))==1)
gfresh=clear(g,"p1-"+g.hex[:12]+"-fresh")
gr=start(g,gfresh[1])
check("D3 fresh owner case authorized",gr[0]=="OK")
tg=gr[1]
check("D3 Phase A for SQL-fence witness",phase(g,tg)[0]=="OK")
db("""UPDATE research_lifecycle_private.a_strict_cases SET phase_a_at=clock_timestamp()-interval '2 hours'
 WHERE account_id=%s""",(g,))
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
 SET started_at=clock_timestamp()-interval '2 hours' WHERE account_id=%s""",(g,))
synthetic_age_immutable_observation([gpre[1],gfresh[1]])
grow=lease(g,tg,'auth')
check("D3 account obtains synthetic single lease",grow[0]=="OK")
lg=uuid.UUID(grow[1]['lease_id'])
check("D3 16-minute post-Phase-A receipt refused at SQL fence",fence(g,tg,lg)[0]=="ERR")
newpost=clear(g,"p1-"+g.hex[:12]+"-current")
check("D3 15-minute current receipt recorded",newpost[0]=="OK")
check("D3 current receipt passes SQL fence",fence(g,tg,lg)==("OK",True))
synthetic_age_immutable_observation([newpost[1]])
check("D3 freshness expiring after fence prevents Auth-attempt intent",
 q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(g,tg,lg))[0]=="ERR")
check("D3 after-fence expiry leaves Auth intact",db("SELECT count(*) FROM auth.users WHERE id=%s",(g,))==1)
check("D3 after-fence expiry leaves no final email",sendable(g)==0)

# Evidence custody rejects test mode, unscanned pages, unknown provider status,
# raw customer metadata, and any service_role attempt to create owner receipts.
h=new_account()
raw=q("postgres","SELECT public.record_research_billing_clearance(%s,'provider_api',%s,clock_timestamp(),'synthetic-owner')",
 (h,"p1-"+h.hex[:12]+"-only-clearance"))
check("generic clearance lacks account/case merchant inventory",raw[0]=="OK")
check("generic owner clearance cannot authorize A-strict Phase A",start(h,raw[1])[0]=="ERR")
hv=db("SELECT verified_at FROM public.research_billing_clearances WHERE id=%s",(raw[1],))
complete_doc=evidence(h,"synthetic-h",hv)
check("service_role cannot forge owner merchant receipt",
 q("service_role","SELECT public.a_strict_owner_record_merchant_receipt(%s,%s,%s,%s,%s)",
 (h,"p1-"+h.hex[:12],raw[1],"pre_auth",Jsonb(complete_doc)))[0]=="ERR")
for label,patch in [
 ("test-mode",{"mode":"test"}),
 ("bad-product",{"product_key":"library-pass"}),
 ("unscanned-orders",{"order_pages":0}),
 ("unscanned-invoices",{"invoice_pages":0}),
 ("pending-provider-retry",{"no_retries":False}),
 ("unknown-provider-objects",{"no_unknown_provider_objects":False}),
 ("raw-customer-PII",{"customer_email":"synthetic@example.invalid"}),
 ("malformed-digest",{"customer_scope_digest":"abc"}),
]:
    invalid=dict(complete_doc,**patch)
    rejected=q("postgres","SELECT public.a_strict_owner_record_merchant_receipt(%s,%s,%s,%s,%s)",
      (h,"p1-"+h.hex[:12],raw[1],"pre_auth",Jsonb(invalid)))
    check("merchant inventory denies "+label,rejected[0]=="ERR",rejected)
valid=attest(h,"synthetic-h",raw[1])
check("one properly scoped owner merchant receipt admitted",valid[0]=="OK",valid)
check("append-only receipt cannot be rewritten",
 q("postgres","UPDATE research_lifecycle_private.a_strict_merchant_receipts SET merchant_store_id='42' WHERE clearance_id=%s RETURNING id",
  (raw[1],))[0]=="ERR")
hr=start(h,raw[1])
check("valid owner-scoped merchant packet authorizes case",hr[0]=="OK")
th=hr[1]
check("owner Phase A may run once",phase(h,th)[0]=="OK")
db("""UPDATE research_lifecycle_private.a_strict_cases SET expires_at=clock_timestamp()-interval '1 second'
 WHERE account_id=%s""",(h,))
check("expired owner case cannot lease/Auth/complete",lease(h,th,'auth')[0]=="ERR")
check("expired case leaves Auth and privacy pending",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(h,))==1 and privacy_open(h)>=1)
hnew=clear(h,"p1-"+h.hex[:12]+"-new-owner-read")
check("fresh owner inventory exists for session recovery",hnew[0]=="OK")
hrot=q("postgres","SELECT public.a_strict_owner_rotate(%s,%s,%s,%s,clock_timestamp()+interval '45 minutes')",
  (h,"p1-"+h.hex[:12],hnew[1],"synthetic-owner"))
check("owner-only session rotation after clean expiry",hrot[0]=="OK" and hrot[1]!=th,hrot)
check("expired token never regains authority",lease(h,th,'auth')[0]=="ERR")
check("new owner session may claim single held Auth identity",
 lease(h,hrot[1],'auth')[0]=="OK")
check("session renewal does not itself delete Auth",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(h,))==1)

# Active paid Research rights cannot be extinguished merely because an owner
# entered a later clearance. Both owner authorization and Phase A fail closed
# on still-valid rights; historical Library Pass source and receipts untouched.
k=new_account()
db("""INSERT INTO public.entitlements(account_id,product_id,state,starts_at,ends_at)
 VALUES(%s,'research-membership','active',clock_timestamp()-interval '1 day',
        clock_timestamp()+interval '3 days')""",(k,))
kpre=clear(k,"p1-"+k.hex[:12]+"-research-rights")
check("Research paid-period fixture and merchant receipt registered",kpre[0]=="OK")
k_auth=start(k,kpre[1])
check("unexpired Research entitlement blocks owner Phase A authorization",
 k_auth[0]=="ERR",k_auth)
check("paid-period hold preserves Auth identity",
 db("SELECT count(*) FROM auth.users WHERE id=%s",(k,))==1)
check("paid-period hold preserves existing Research entitlement",
 db("""SELECT count(*) FROM public.entitlements WHERE account_id=%s
      AND product_id='research-membership' AND state='active'
      AND ends_at>clock_timestamp()""",(k,))==1)
# D2/D4 owner-only synthetic reconciliation: a terminal privacy decision
# records an opaque legal decision but does NOT clear a financial incident,
# resurrect Auth, send completion email or falsely mark privacy complete.
m=new_account()
mp=clear(m,"syn-astrict-mpre-"+m.hex[:12])
mr=start(m,mp[1])
check("terminal-review case authorized",mr[0]=="OK",mr)
mt=mr[1]
check("terminal-review Phase A",phase(m,mt)[0]=="OK")
ma=lease(m,mt,'auth')
check("terminal-review Auth claim",ma[0]=="OK")
ml=uuid.UUID(ma[1]['lease_id'])
check("terminal-review pre-Auth fresh inventory",clear(m,"syn-astrict-mfresh-"+m.hex[:12])[0]=="OK")
check("terminal-review fence",fence(m,mt,ml)==("OK",True))
check("terminal-review Auth intent",q("postgres",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(m,mt,ml))==("OK",True))
db("DELETE FROM auth.users WHERE id=%s",(m,))
check("terminal-review Auth retirement observed",q("postgres",
  "SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(m,mt,ml))[0]=="OK")
mc=lease(m,mt,'complete')
check("terminal-review completion claimed",mc[0]=="OK")
mcl=uuid.UUID(mc[1]['lease_id'])
check("terminal-review holds account",q("service_role",
  "SELECT public.a_strict_hold(%s,%s,%s,%s)",
  (m,mt,mcl,'unknown_payment'))[0]=="OK")
md="p1-d2-terminal-"+m.hex[:12]
mf="p1-d4-terminal-"+m.hex[:12]
mid="p1-terminal-"+m.hex[:12]
check("service_role cannot adjudicate owner incident",q("service_role",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (m,"p1-"+m.hex[:12],None,mid,md,mf,"terminal_hold"))[0]=="ERR")
terminal=q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (m,"p1-"+m.hex[:12],None,mid,md,mf,"terminal_hold"))
check("owner-only terminal decision recorded without release",terminal==("OK","terminal_hold"),terminal)
check("terminal decision replay is idempotent",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (m,"p1-"+m.hex[:12],None,mid,md,mf,"terminal_hold"))==("OK","terminal_hold"))
check("terminal decision refuses changed remedy reference",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (m,"p1-"+m.hex[:12],None,mid,md,"p1-d4-changed-"+m.hex[:12],"terminal_hold"))[0]=="ERR")
check("terminal decision is append only",q("postgres",
  "UPDATE research_lifecycle_private.a_strict_owner_resolutions SET d2_privacy_ref=%s WHERE decision_ref=%s RETURNING decision_ref",
  ("p1-d2-changed-"+m.hex[:12],mid))[0]=="ERR")
check("terminal decision leaves financial incident open, privacy uncompleted and email blocked",
  inc(m)=="open" and privacy_open(m)>=1 and sendable(m)==0
  and db("SELECT reconciled_hold_at FROM research_lifecycle_private.a_strict_cases WHERE account_id=%s",(m,)) is None)

# Separate clean synthetic Auth-retired case: owner may resume only after
# independently attested post-HOLD provider inventory. No auto Auth reattempt.
n=new_account()
np=clear(n,"syn-astrict-npre-"+n.hex[:12])
nr=start(n,np[1])
check("resume-review case authorized",nr[0]=="OK",nr)
nt=nr[1]
check("resume-review Phase A",phase(n,nt)[0]=="OK")
na=lease(n,nt,'auth')
check("resume-review Auth claim",na[0]=="OK")
nl=uuid.UUID(na[1]['lease_id'])
check("resume-review pre-Auth fresh inventory",clear(n,"syn-astrict-nfresh-"+n.hex[:12])[0]=="OK")
check("resume-review fence",fence(n,nt,nl)==("OK",True))
check("resume-review Auth intent",q("postgres",
  "SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(n,nt,nl))==("OK",True))
db("DELETE FROM auth.users WHERE id=%s",(n,))
check("resume-review Auth retirement observed",q("postgres",
  "SELECT public.a_strict_record_auth_observed(%s,%s,%s)",(n,nt,nl))[0]=="OK")
nc=lease(n,nt,'complete')
check("resume-review completion claimed",nc[0]=="OK")
ncl=uuid.UUID(nc[1]['lease_id'])
check("resume-review financial HOLD persisted",q("service_role",
  "SELECT public.a_strict_hold(%s,%s,%s,%s)",
  (n,nt,ncl,'unknown_payment'))[0]=="OK" and inc(n)=="open")
nd="p1-d2-resume-"+n.hex[:12]
nf="p1-d4-resume-"+n.hex[:12]
nid="p1-resume-"+n.hex[:12]
ncase="p1-"+n.hex[:12]
check("owner cannot resume using old pre-HOLD clearance",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (n,ncase,np[1],nid,nd,nf,"resume"))[0]=="ERR")
newpost=clear(n,"syn-astrict-nposthold-"+n.hex[:12],"post_auth")
check("post-HOLD, post-Auth scoped provider receipt recorded",newpost[0]=="OK",newpost)
check("owner cannot resume without D4 reference",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (n,ncase,newpost[1],nid,nd,None,"resume"))[0]=="ERR")
check("B1 legacy resolver cannot bypass owner D2/D4 ledger under SQL owner",
  q("postgres","SELECT public.resolve_research_deletion_billing_incident(%s,%s,%s)",
    (n,newpost[1],nid))[0]=="ERR")
check("B1 bypass denial leaves incident and privacy held, with no decision row",
  inc(n)=="open" and privacy_open(n)>=1 and sendable(n)==0
  and db("SELECT count(*) FROM research_lifecycle_private.a_strict_owner_resolutions WHERE account_id=%s",
    (n,))==0)
resumed=q("postgres","SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (n,ncase,newpost[1],nid,nd,nf,"resume"))
check("owner reconciles signed-off financial hold after Auth confirmed",resumed==("OK","resume"),resumed)
check("resume closes incident and writes single reconciliation marker",
  inc(n)=="resolved" and db("SELECT reconciled_hold_at IS NOT NULL FROM research_lifecycle_private.a_strict_cases WHERE account_id=%s",(n,)) is True)
check("resume resets any earlier post-Auth clearance",
  db("SELECT post_clearance_id IS NULL FROM research_lifecycle_private.a_strict_cases WHERE account_id=%s",(n,)) is True)
check("resume exact owner decision replay is idempotent",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (n,ncase,newpost[1],nid,nd,nf,"resume"))==("OK","resume"))
check("conflicting second decision reference denied",q("postgres",
  "SELECT public.a_strict_owner_reconcile(%s,%s,%s,%s,%s,%s,%s)",
  (n,ncase,newpost[1],"p1-conflict-"+n.hex[:12],nd,nf,"resume"))[0]=="ERR")
check("new completion lease cannot release email before renewed post-Auth owner confirmation",
  sendable(n)==0 and privacy_open(n)>=1)
check("Auth remains retired and cannot be retried from SQL owner",
  db("SELECT count(*) FROM auth.users WHERE id=%s",(n,))==0
  and q("postgres","SELECT public.a_strict_mark_auth_attempt(%s,%s,%s)",(n,nt,ncl))[0]=="ERR")

print(f"[A-STRICT] {count} executable disposable PG17 checks PASS; NO hosted SQL, Auth or merchant IO.",flush=True)
