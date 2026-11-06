#!/usr/bin/env python3
"""Synthetic DRAFT P1 two-phase deletion review. Disposable PG17 only.
No Production/Development connections, merchant calls or real accounts.
Run AFTER owner_model_replay.py and test_research_p1_lifecycle.py.
"""
import hashlib
import json
import threading
import time
import uuid
import psycopg

R = []
def rec(label, condition, evidence=""):
    R.append(bool(condition))
    print(f"[P1-TWO-PHASE] {'PASS' if condition else 'FAIL'} {label} :: {str(evidence)[:220]}", flush=True)

def conn(autocommit=True):
    return psycopg.connect(dbname="ci_review", host="127.0.0.1", autocommit=autocommit)

def exec_role(role, sql, args=(), connection=None):
    own = connection is None
    c = connection or conn()
    c.execute(f"SET ROLE {role}")
    try:
        cur = c.execute(sql, args)
        return ("OK", cur.fetchone()[0] if cur.description else None)
    except psycopg.Error as ex:
        return ("ERR", f"{ex.sqlstate} {str(ex).splitlines()[0][:150]}")
    finally:
        try:
            c.execute("RESET ROLE")
        except Exception:
            pass
        if own:
            c.close()

def su(sql, args=()):
    with conn() as c:
        cur = c.execute(sql,args)
        if not cur.description:
            return None
        found = cur.fetchone()
        return found[0] if found is not None else None

svc = lambda sql, args=(), connection=None: exec_role("service_role",sql,args,connection)
own = lambda sql, args=(): exec_role("postgres",sql,args)

def synthetic_user():
    a = uuid.uuid4()
    su("INSERT INTO auth.users(id,email) VALUES(%s,%s)", (a, f"phase-{a.hex[:16]}@invalid.example"))
    return a

def request(a):
    with conn() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(a),))
        c.execute("SELECT public.request_account_deletion()")
        c.execute("RESET ROLE")

def make_due_keep_auth(a):
    su("""UPDATE public.profiles SET
       deletion_due_at=now()-interval '1 minute',
       deletion_requested_at=now()-interval '31 days'
       WHERE account_id=%s""",(a,))

def row(a):
    return su("SELECT to_jsonb(p) FROM public.profiles p WHERE account_id=%s",(a,))

def ledger(a):
    return su("SELECT to_jsonb(q) FROM research_lifecycle_private.deletion_auth_cleanup q WHERE account_id=%s",(a,))

def phase_a(a):
    return svc("SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)",(a,))

def claim(size=1,connection=None):
    return svc("""SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb)
      FROM public.claim_deletion_auth_cleanup_batch(%s) q""",(size,),connection)

def confirm(a,lease):
    return svc("SELECT public.confirm_deletion_auth_cleanup(%s,%s)",(a,lease))

def finish(a,lease):
    return svc("SELECT public.finish_deletion_auth_cleanup(%s,%s)",(a,lease))

# The old service_role REST RPCs must be unavailable after the migration;
# both helpers remain owner-internal to the SECURITY DEFINER Phase A transaction.
for legacy_name in ("prepare_account_deletion_auth_removal", "finalize_account_deletion"):
    for api_role in ("service_role", "anon", "authenticated"):
        old_result=exec_role(api_role,
           f"SELECT public.{legacy_name}(%s)", (uuid.uuid4(),))
        rec(f"G {api_role} denied legacy {legacy_name} direct call",
            old_result[0]=="ERR" and old_result[1].startswith("42501"),
            old_result)
    rec(f"G service_role lacks explicit legacy {legacy_name} EXECUTE grant",
        su("SELECT NOT has_function_privilege('service_role', %s::regprocedure, 'EXECUTE')",
           (f"public.{legacy_name}(uuid)",)))
# Independent synthetic integration below proves Phase A's owner calls still
# work despite this outer service_role revocation.

# G - grants/shape checks. No API role can read the private PII cleanup queue.
new_functions = [
    ("finalize_deletion_and_queue_auth_cleanup", "SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)", (uuid.uuid4(),)),
    ("claim_deletion_auth_cleanup_batch", "SELECT count(*) FROM public.claim_deletion_auth_cleanup_batch(1)", ()),
    ("check_deletion_auth_cleanup_billing_fence", "SELECT public.check_deletion_auth_cleanup_billing_fence(%s,%s)", (uuid.uuid4(), uuid.uuid4())),
    ("confirm_deletion_auth_cleanup", "SELECT public.confirm_deletion_auth_cleanup(%s,%s)", (uuid.uuid4(), uuid.uuid4())),
    ("finish_deletion_auth_cleanup", "SELECT public.finish_deletion_auth_cleanup(%s,%s)", (uuid.uuid4(), uuid.uuid4()))
]
for role in ("anon","authenticated"):
    for name,sql,args in new_functions:
        result=exec_role(role,sql,args)
        rec(f"G {role} denied {name}",result[0]=="ERR" and result[1].startswith("42501"),result)
for role in ("service_role","anon","authenticated"):
    result=exec_role(role,"SELECT count(*) FROM research_lifecycle_private.deletion_auth_cleanup")
    rec(f"G {role} denied private ledger SELECT",result[0]=="ERR" and result[1].startswith("42501"),result)
for n in (0,26):
    r=claim(n)
    rec(f"G invalid batch size {n} denied",r[0]=="ERR" and r[1].startswith("22023"),r)
    r=svc("SELECT public.finalize_deletion_and_queue_auth_cleanup(NULL)")
    rec("G NULL finalization ID denied",r[0]=="ERR" and r[1].startswith("22023"),r)

# A - one atomic DB step: no Auth DELETE, no completion email yet.
a=synthetic_user()
request(a)
make_due_keep_auth(a)
initial=row(a)
rec("A due profile retains Auth link before Phase A",
    initial["status"]=="deletion_pending" and initial["auth_user_id"]==str(a))
result=phase_a(a)
db=row(a)
q=ledger(a)
rec("A Phase A commits database deletion and durable Auth queue atomically",
    result[0]=="OK" and result[1]["phase"]=="auth_pending"
    and db["status"]=="deleted" and db["auth_user_id"] is None
    and q["phase"]=="auth_pending" and q["recipient_email"] is not None, result)
rec("A Auth identity still exists; Phase A never called Auth Admin",
    su("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)
rec("A privacy deletion request is IN_PROGRESS until Auth+email acknowledgement",
    su("SELECT status::text FROM public.privacy_requests WHERE request_type='deletion' AND email LIKE 'deleted+%%@privacy.invalid' AND requested_at <= now() ORDER BY requested_at DESC LIMIT 1") == "in_progress")
again=phase_a(a)
rec("A repeated Phase A is idempotent; only one queued row",
    again[0]=="OK" and again[1]["phase"]=="auth_pending"
    and su("SELECT count(*) FROM research_lifecycle_private.deletion_auth_cleanup WHERE account_id=%s",(a,))==1,again)

# B - lease, failed external Auth, later retry and durably stored proof of email.
c1=claim(1)
items=c1[1] if c1[0]=="OK" else []
chosen=next((z for z in items if z["account_id"]==str(a)),None)
rec("B private batch claim leases Auth cleanup without exposing email",
    bool(chosen) and "recipient_email" not in chosen,c1)
lease=uuid.UUID(chosen["lease_id"]) if chosen else uuid.uuid4()
bad=confirm(a,uuid.uuid4())
rec("B forged cleanup lease is rejected",bad[0]=="ERR" and bad[1].startswith("42501"),bad)
before=ledger(a)
rec("B failed/absent Auth response leaves a durable retryable queue",
    before["phase"]=="auth_pending" and before["recipient_email"] is not None
    and su("SELECT count(*) FROM auth.users WHERE id=%s",(a,))==1)
# Synthetic Auth Admin success occurs here only, AFTER database Phase A.
su("DELETE FROM auth.users WHERE id=%s",(a,))
confirmed=confirm(a,lease)
rec("B post-Auth confirmation produces original completion receipt",
    confirmed[0]=="OK" and confirmed[1].get("recipient_email")==q["recipient_email"]
    and confirmed[1].get("phase")=="auth_confirmed",confirmed)
no_email=finish(a,lease)
rec("B email cannot be acknowledged until real durable notification outbox exists",
    no_email[0]=="ERR" and no_email[1].startswith("55000"),no_email)

# Simulate an email-outbox commit (never send a live email).
receipt=confirmed[1] if confirmed[0]=="OK" else {}
if receipt:
    state_version=int(receipt["deleted_at"].timestamp()//60) if hasattr(receipt["deleted_at"],"timestamp") else int(__import__("datetime").datetime.fromisoformat(receipt["deleted_at"].replace("Z","+00:00")).timestamp()//60)
    key="notification:v1:"+hashlib.sha256(("synthetic-two-phase:"+str(a)).encode()).hexdigest()
    try:
        su("""INSERT INTO public.notification_outbox(
              idempotency_key,event_id,message_id,classification,
              business_object_type,business_object_id,state_version,
              recipient_email_normalized,template_id,template_version,
              provider,payload,status
             ) VALUES (
              %s,%s,'account_deletion_completed','transactional_operational',
              'account_deletion_request',%s,%s,%s,
              'account_deletion_completed','v1','resend','{}'::jsonb,'queued'
             )""",(key,"synthetic-two-phase-"+a.hex,str(a),state_version,q["recipient_email"].lower()))
    except psycopg.Error as e:
        print("synthetic outbox insert failed:",e.sqlstate,str(e).splitlines()[0])
# The outbox must remain NON-DISPATCHABLE until SQL finisher updates the
# queue and notification row atomically. Direct service-role PATCH must fail.
staged=su("""SELECT status FROM public.notification_outbox
  WHERE business_object_id=%s AND message_id='account_deletion_completed'""",(str(a),))
rec("B completion email is staged and cannot dispatch before SQL acknowledgement",
    staged=="deletion_staged",staged)
premature=svc("""UPDATE public.notification_outbox
    SET status='queued' WHERE business_object_id=%s
      AND message_id='account_deletion_completed'""",(str(a),))
rec("B service_role cannot release staged completion email without private phase",
    premature[0]=="ERR" and premature[1].startswith("42501"),premature)
yes=finish(a,lease)
rec("B outbox acknowledgement completes private ledger and scrubs duplicate recipient PII",
    yes==("OK",True) and ledger(a)["phase"]=="email_enqueued"
    and ledger(a)["recipient_email"] is None,yes)
released=su("""SELECT status FROM public.notification_outbox
  WHERE business_object_id=%s AND message_id='account_deletion_completed'""",(str(a),))
rec("B one SQL transaction releases staged email to queued after final ack",
    released=="queued",released)
rec("B privacy request is marked completed only after Auth+durable email",
    su("SELECT status::text FROM public.privacy_requests WHERE id=%s",(uuid.UUID(q["privacy_request_ids"][0]),))=="completed",q["privacy_request_ids"])
rec("B duplicate finish is idempotent and retains no email",
    finish(a,lease)==("OK",True) and ledger(a)["recipient_email"] is None)

# C - actual Research billing evidence holds before any DB irreversible work.
hold=synthetic_user()
hold_key="p1two-checkout-"+hold.hex
attempt=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",(hold,hold_key))
assert attempt[0]=="OK",attempt
attached=svc("SELECT public.attach_research_checkout_attempt(%s,%s,%s,now()+interval '30 minutes')",
             (attempt[1],hold,"ck-two-"+hold.hex[:12]))
assert attached==("OK",True),attached
su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '1 minute' WHERE id=%s",
   (attempt[1],))
binding=svc("""SELECT public.bind_research_membership_subscription(
    %s,'lemon-squeezy',%s,%s,'313','monthly',now(),%s::jsonb)""",
    (hold,"p1two-sub-"+hold.hex[:14],"p1two-cust-"+hold.hex[:14],
     json.dumps({"bindingSource":"signed-subscription-created","checkoutKey":hold_key})))
# A genuine retained Research event makes the stale-JWT RLS proof non-vacuous.
su("""INSERT INTO public.subscription_events
      (event_key,subscription_id,account_id,product_id,from_state,to_state,
       reason,actor_type,provider_event_id,occurred_at)
      SELECT %s,s.id,s.account_id,s.product_id,'pending','pending',
             'synthetic retention proof','provider_webhook',%s,now()
      FROM public.subscriptions s
      WHERE s.account_id=%s AND s.product_id='research-membership'""",
   ("syn-retained-"+hold.hex, "syn-event-"+hold.hex, hold))
request(hold)
make_due_keep_auth(hold)
# The preexisting JWT may still be accepted by PostgREST; use that *same*
# synthetic JWT claim before and after database Phase A.
def browser_billing_counts(account):
    with conn() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(account),))
        a=c.execute("SELECT count(*) FROM public.subscriptions WHERE account_id=%s",(account,)).fetchone()[0]
        b=c.execute("SELECT count(*) FROM public.subscription_events WHERE account_id=%s",(account,)).fetchone()[0]
        c.execute("RESET ROLE")
        return a,b
before_stale_jwt=browser_billing_counts(hold)
rec("C stale JWT can read own retained Research billing while deletion is pending",
    before_stale_jwt==(1,1),before_stale_jwt)
refusal=phase_a(hold)
rec("C Research footprint blocks Phase A and preserves Auth identity",
    binding[0]=="OK" and refusal[0]=="ERR" and refusal[1].startswith("55000")
    and row(hold)["status"]=="deletion_pending"
    and row(hold)["auth_user_id"]==str(hold)
    and ledger(hold) is None,refusal)

owner=own("""SELECT public.record_research_billing_clearance(
    %s,'provider_api','syn-external-verified-0001',now(),'synthetic-owner')""",(hold,))
success=phase_a(hold)
retained=su("""SELECT count(*) FROM public.subscriptions s WHERE s.account_id=%s""",(hold,))
retained_events=su("""SELECT count(*) FROM public.subscription_events e WHERE e.account_id=%s""",(hold,))
after_stale_jwt=browser_billing_counts(hold)
rec("C retired profile denies direct Research billing reads to unexpired JWT",
    retained==1 and retained_events==1 and after_stale_jwt==(0,0)
    and su("SELECT count(*) FROM auth.users WHERE id=%s",(hold,))==1,
    f"owner rows {retained},{retained_events} browser rows {after_stale_jwt}")
rec("C owner external-clearance model permits atomic DB finalization",
    owner[0]=="OK" and success[0]=="OK" and success[1]["phase"]=="auth_pending",success)
# New two-phase billing fence must allow the already cleared database
# deletion queue only before a later signed merchant conflict is recorded.
hold_claim=claim(25)
hold_claim_rows=hold_claim[1] if hold_claim[0]=="OK" else []
hold_selected=next((z for z in hold_claim_rows if z["account_id"]==str(hold)),None)
hold_lease=uuid.UUID(hold_selected["lease_id"]) if hold_selected else uuid.uuid4()
before_late=svc("SELECT public.check_deletion_auth_cleanup_billing_fence(%s,%s)",(hold,hold_lease))
rec("C billing fence permits owner-cleared Phase A before late merchant evidence",
    hold_selected is not None and before_late==("OK",True),before_late)
after=svc("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
    ("syn-late-"+hold.hex[:12],hold,"syn-checkout-"+hold.hex[:14]))
after_fence=svc("SELECT public.check_deletion_auth_cleanup_billing_fence(%s,%s)",(hold,hold_lease))
after_ack=confirm(hold,hold_lease)
rec("C post-Phase-A signed payment refuses pre-Auth fence and leaves Auth intact",
    after_fence[0]=="ERR" and after_fence[1].startswith("55000")
    and after_ack[0]=="ERR" and after_ack[1].startswith("55000")
    and su("SELECT count(*) FROM auth.users WHERE id=%s",(hold,))==1
    and ledger(hold)["phase"]=="auth_pending",
    f"fence={after_fence} confirm={after_ack}")

# A signed charge can arrive after Auth is already retired and confirmed.
# Final completion must still fail and leave the private recovery state open.
last=synthetic_user()
request(last)
make_due_keep_auth(last)
assert phase_a(last)[0]=="OK"
last_claim=claim(25)
last_rows=last_claim[1] if last_claim[0]=="OK" else []
last_selected=next((z for z in last_rows if z["account_id"]==str(last)),None)
last_lease=uuid.UUID(last_selected["lease_id"]) if last_selected else uuid.uuid4()
assert last_selected is not None, last_rows
assert svc("SELECT public.check_deletion_auth_cleanup_billing_fence(%s,%s)",(last,last_lease))==("OK",True)
su("DELETE FROM auth.users WHERE id=%s",(last,))
assert confirm(last,last_lease)[0]=="OK"
# Stage an actual durable completion outbox first; a subsequent late signed
# payment must still block release, leaving the staged row unsendable.
last_key="notification:v1:"+hashlib.sha256(("post-stage:"+str(last)).encode()).hexdigest()
staged_last=su("""INSERT INTO public.notification_outbox(
   idempotency_key,event_id,message_id,classification,business_object_type,
   business_object_id,state_version,recipient_email_normalized,
   template_id,template_version,provider,payload,status
 ) SELECT
   %s,%s,'account_deletion_completed','transactional_operational',
   'account_deletion_request',q.account_id::text,
   pg_catalog.floor(extract(epoch from q.deleted_at)/60)::integer,
   pg_catalog.lower(q.recipient_email),
   'account_deletion_completed','v1','resend','{}'::jsonb,'queued'
 FROM research_lifecycle_private.deletion_auth_cleanup q
 WHERE q.account_id=%s
 RETURNING status""",(last_key,"synthetic-post-stage-"+last.hex,last))
rec("C an Auth-confirmed email insert is force-staged by SQL trigger",
    staged_last=="deletion_staged",staged_last)
late2=svc("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
    ("syn-post-auth-"+last.hex[:10],last,"syn-checkout-"+last.hex[:14]))
held_finish=finish(last,last_lease)
rec("C late signed payment after Auth confirmation blocks privacy/email completion",
    late2[0]=="OK"
    and held_finish[0]=="ERR"
    and held_finish[1].startswith("55000")
    and "Research payment evidence" in held_finish[1]
    and ledger(last)["phase"]=="auth_confirmed"
    and ledger(last)["recipient_email"] is not None
    and su("""SELECT status FROM public.notification_outbox
      WHERE business_object_id=%s AND message_id='account_deletion_completed'""",
      (str(last),))=="deletion_staged",
    f"late={late2} finish={held_finish}")

rec("C late paid event after DB phase is durably quarantined, without reopening deleted profile",
    after[0]=="OK"
    and row(hold)["status"]=="deleted"
    and su("SELECT count(*) FROM public.research_paid_binding_quarantine WHERE claimed_account_id=%s AND resolved_at IS NULL",(hold,))==1,after)

# C2 - forged local cancellation or unresolved signed quarantine cannot give permission.
blocked=synthetic_user()
request(blocked)
make_due_keep_auth(blocked)
obs=svc("""SELECT public.record_research_paid_binding_refusal(
   'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
   ("syn-block-"+blocked.hex[:10],blocked,"syn-checkout-"+blocked.hex[:14]))
denied=phase_a(blocked)
rec("C unresolved paid-binding evidence prevents Phase A even with no subscription row",
    obs[0]=="OK" and denied[0]=="ERR" and denied[1].startswith("55000")
    and row(blocked)["auth_user_id"]==str(blocked)
    and ledger(blocked) is None,denied)

# D - concurrent leases are disjoint, and a crash leaves retryable durable state.
ready=[]
for _ in range(2):
    x=synthetic_user()
    request(x)
    make_due_keep_auth(x)
    assert phase_a(x)[0]=="OK"
    ready.append(x)
# Set previously claimed-but-unfinished rows outside the lease window for determinism.
su("""UPDATE research_lifecycle_private.deletion_auth_cleanup
       SET next_attempt_at=now()+interval '1 hour'
       WHERE account_id NOT IN (%s,%s)""",(ready[0],ready[1]))
tx1=conn(False)
tx1.execute("SET ROLE service_role")
r1=tx1.execute("""SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)
  FROM public.claim_deletion_auth_cleanup_batch(1) q""").fetchone()[0]
claimed={}
def worker():
    with conn(False) as tx:
        tx.execute("SET ROLE service_role")
        claimed["r"]=tx.execute("""SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)
          FROM public.claim_deletion_auth_cleanup_batch(1) q""").fetchone()[0]
        tx.commit()
other=threading.Thread(target=worker)
other.start()
other.join(timeout=5)
tx1.commit()
tx1.close()
aa={uuid.UUID(z["account_id"]) for z in r1}
bb={uuid.UUID(z["account_id"]) for z in claimed.get("r",[])}
rec("D two concurrent workers claim disjoint Auth identities",
    not other.is_alive() and len(aa)==len(bb)==1 and not aa.intersection(bb)
    and aa.union(bb)==set(ready),f"{aa} {bb}")
rec("D after claim, durable queue contains both identities for crash recovery",
    all(ledger(z)["phase"]=="auth_pending" and ledger(z)["attempt_count"]>=1 for z in ready))


# E - payment evidence that holds a profile lock must commit before DB phase A,
# or its state must be reconciled AFTER phase A. No signed receipt is discarded.
lock_account=synthetic_user()
request(lock_account)
make_due_keep_auth(lock_account)
writer=conn(False)
writer.execute("SET ROLE service_role")
writer.execute("""SELECT public.record_research_paid_binding_refusal(
  'lemon-squeezy',%s,%s,%s,'SIGNED_PAYMENT_UNBOUND')""",
  ("syn-race-"+lock_account.hex[:12],lock_account,"checkout-"+lock_account.hex[:12]))
outcome={}
def competing_phase_a():
    with conn(False) as db:
        db.execute("SET ROLE service_role")
        db.execute("SET lock_timeout='5s'")
        try:
            outcome["value"]=db.execute(
                "SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)",
                (lock_account,)).fetchone()[0]
            db.commit()
        except psycopg.Error as e:
            outcome["error"]=e.sqlstate
            db.rollback()
phase_worker=threading.Thread(target=competing_phase_a)
phase_worker.start()
time.sleep(0.3)
was_waiting=phase_worker.is_alive()
writer.commit()
writer.close()
phase_worker.join(timeout=6)
rec("E two-connection signed payment lock makes Phase A wait and then HOLD",
    was_waiting and not phase_worker.is_alive() and outcome.get("error")=="55000"
    and row(lock_account)["status"]=="deletion_pending"
    and row(lock_account)["auth_user_id"]==str(lock_account)
    and ledger(lock_account) is None,outcome)
rec("E signed payment evidence is retained after the refused Phase A",
    su("SELECT count(*) FROM public.research_paid_binding_quarantine WHERE claimed_account_id=%s",
       (lock_account,))==1)

# E2 - service_role cannot fabricate owner clearance, even after having
# quarantined a real paid event. Known Research billing remains on hold.
forged=svc("""SELECT public.record_research_billing_clearance(
    %s,'provider_api','fake-provider-cancellation-001',now(),'web')""",(lock_account,))
rec("E service_role cannot manufacture merchant cessation proof",
    forged[0]=="ERR" and forged[1].startswith("42501"),forged)
still_held=phase_a(lock_account)
rec("E a forged local event cannot clear signed quarantine",
    still_held[0]=="ERR" and still_held[1].startswith("55000"),still_held)


# F - lease expiry after a worker crash must permit a fresh worker and make
# the old worker's token permanently invalid. This is a DB-level synthetic
# timeout exercise, not a clock-based wait or a real Auth administration call.
lease_account=synthetic_user()
request(lease_account)
make_due_keep_auth(lease_account)
assert phase_a(lease_account)[0]=="OK"
su("""UPDATE research_lifecycle_private.deletion_auth_cleanup
       SET next_attempt_at=now()+interval '1 hour'
       WHERE account_id<>%s""",(lease_account,))
first_claim=claim(1)
first_rows=first_claim[1] if first_claim[0]=="OK" else []
old_lease=uuid.UUID(first_rows[0]["lease_id"]) if first_rows else uuid.uuid4()
rec("F first worker leases the selected identity",
    len(first_rows)==1 and first_rows[0]["account_id"]==str(lease_account))
su("""UPDATE research_lifecycle_private.deletion_auth_cleanup
       SET next_attempt_at=now()-interval '1 minute'
       WHERE account_id=%s""",(lease_account,))
# A lease must expire by time, not merely when another worker replaces it.
# Before any reclaim, the stale worker is already barred from acknowledgement.
expired_confirm=confirm(lease_account,old_lease)
rec("F expired lease cannot confirm Auth even without a replacement worker",
    expired_confirm[0]=="ERR" and expired_confirm[1].startswith("42501"),expired_confirm)
expired_finish=finish(lease_account,old_lease)
rec("F expired lease cannot finish email even without a replacement worker",
    expired_finish[0]=="ERR" and expired_finish[1].startswith("42501"),expired_finish)
next_claim=claim(1)
next_rows=next_claim[1] if next_claim[0]=="OK" else []
new_lease=uuid.UUID(next_rows[0]["lease_id"]) if next_rows else uuid.uuid4()
rec("F expired worker lease is replaced by a different idempotent retry lease",
    len(next_rows)==1 and next_rows[0]["account_id"]==str(lease_account)
    and new_lease!=old_lease)
old_ack=confirm(lease_account,old_lease)
rec("F stale worker cannot acknowledge after a competing recovery lease",
    old_ack[0]=="ERR" and old_ack[1].startswith("42501"),old_ack)
su("DELETE FROM auth.users WHERE id=%s",(lease_account,))
latest_ack=confirm(lease_account,new_lease)
rec("F fresh worker can finish the Auth-confirmed step",
    latest_ack[0]=="OK" and latest_ack[1]["phase"]=="auth_confirmed")

print(f"P1_TWO_PHASE_DONE total={len(R)} pass={sum(R)} fail={len(R)-sum(R)}",flush=True)
raise SystemExit(0 if all(R) else 1)
