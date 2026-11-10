#!/usr/bin/env python3
"""Issue #1103 / P1-C: no sendable completion-email identity rewrite.

Executable ONLY on the disposable CI PostgreSQL 17 model, following
test_a_strict_review.py which seeds a synthetic released completion row.
No hosted database, customer data, mail provider or credentials are used.
"""
import uuid
import psycopg

def connection(autocommit=True):
    return psycopg.connect(host="127.0.0.1",dbname="ci_review",autocommit=autocommit)

def fetch(sql,args=()):
    with connection() as c:
        cur=c.execute(sql,args)
        return cur.fetchone()

count=0
def check(label,condition,evidence=None):
    global count
    count+=1
    print(f"[A-STRICT-OUTBOX] {'PASS' if condition else 'FAIL'} #{count}: {label}"
          + (f" :: {str(evidence)[:180]}" if evidence is not None else ""),flush=True)
    if not condition: raise AssertionError(label)

target=fetch("""
 SELECT id, business_object_id,recipient_email_normalized,template_id,
        state_version, message_id, idempotency_key
 FROM public.notification_outbox
 WHERE message_id='account_deletion_completed' AND status='queued'
 ORDER BY created_at DESC LIMIT 1
""")
check("synthetic released completion email exists from previous matrix",target is not None)
oid,owner,recipient,template,version,msg,key=target

def mutation_denied(label,updates,args=()):
    # Roll back every attempt including accidentally-permitted writes.
    with connection(autocommit=False) as c:
        try:
            c.execute("SET ROLE service_role")
            c.execute(f"UPDATE public.notification_outbox SET {updates} WHERE id=%s RETURNING id",
                (*args,oid))
            attempted="PERMITTED"
        except psycopg.Error as e:
            attempted=e.sqlstate
        finally:
            c.rollback()
    check(label,attempted=="42501",attempted)

mutation_denied("queued completion recipient immutable",
  "recipient_email_normalized=%s",("redirected-synthetic@invalid.example",))
mutation_denied("queued completion message id cannot downgrade",
  "message_id=%s",("ordinary_notification",))
mutation_denied("queued completion case identity immutable",
  "business_object_id=%s",(str(uuid.uuid4()),))
mutation_denied("queued completion template immutable",
  "template_id=%s",("other-template",))
mutation_denied("queued completion state version immutable",
  "state_version=%s",(version+1,))
mutation_denied("queued completion idempotency key immutable",
  "idempotency_key=%s",("notification:v1:"+uuid.uuid4().hex+uuid.uuid4().hex,))
mutation_denied("queued completion payload immutable",
  "payload=%s::jsonb",('{"synthetic":"redirect"}',))
check("adversarial rollback did not change canonical recipient",
 fetch("SELECT recipient_email_normalized FROM public.notification_outbox WHERE id=%s",(oid,))[0]==recipient)

# The outbox is shared: status-only delivery transitions must continue to work.
with connection(autocommit=False) as c:
    try:
        c.execute("SET ROLE service_role")
        state=c.execute("""UPDATE public.notification_outbox
         SET status='sending',updated_at=clock_timestamp()
         WHERE id=%s AND status='queued' RETURNING status""",(oid,)).fetchone()
        check("legitimate status-only delivery transition still allowed",
            state==("sending",),state)
    finally:
        c.rollback()
check("rolled-back status transition leaves email queued",
    fetch("SELECT status FROM public.notification_outbox WHERE id=%s",(oid,))[0]=="queued")

# An ordinary queued notification may not be reclassified into a completed
# deletion email just to inherit its already-sendable status.
with connection() as c:
    spoof=c.execute("""
       INSERT INTO public.notification_outbox(
         idempotency_key,event_id,message_id,classification,
         business_object_type,business_object_id,state_version,
         recipient_email_normalized,template_id,template_version,
         provider,payload,status
       ) VALUES(
         %s,%s,'synthetic_ordinary_notification','operational',
         'account_deletion_request',%s,%s,
         'synthetic@invalid.example','support_case_received','v1',
         'resend','{}'::jsonb,'queued'
       ) RETURNING id
    """,("notification:v1:"+uuid.uuid4().hex+uuid.uuid4().hex,"synthetic-spoof-"+uuid.uuid4().hex,
         owner,version+1)).fetchone()[0]
check("ordinary queued synthetic notification created",spoof is not None)

with connection(autocommit=False) as c:
    try:
        c.execute("SET ROLE service_role")
        c.execute("""UPDATE public.notification_outbox
         SET message_id='account_deletion_completed',
             classification='transactional_operational',
             template_id='account_deletion_completed',
             recipient_email_normalized=%s
         WHERE id=%s RETURNING id""",(recipient,spoof))
        outcome="PERMITTED"
    except psycopg.Error as e:
        outcome=e.sqlstate
    finally:
        c.rollback()
check("cannot repurpose sendable ordinary row into deletion-complete",outcome=="42501",outcome)
check("ordinary row remains ordinary",
 fetch("SELECT message_id FROM public.notification_outbox WHERE id=%s",(spoof,))[0]
 =="synthetic_ordinary_notification")
print(f"[A-STRICT-OUTBOX] {count} SQL identity/recipient negative checks PASS (synthetic-only).",flush=True)
