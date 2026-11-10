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
print(f"[A-STRICT] {count} executable disposable PG17 checks PASS; NO hosted SQL, Auth or merchant IO.",flush=True)
