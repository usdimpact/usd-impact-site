#!/usr/bin/env python3
"""#1103 R1/R2 adversarial disposable-only SQL matrix.
Run after source, A-strict, owner recovery, their existing tests and the
uninstalled R1/R2 composite overlay. NO hosted SQL, Auth API, merchant, email.
"""
import uuid
import psycopg

def c(autocommit=True):
    return psycopg.connect(host="127.0.0.1",dbname="ci_review",autocommit=autocommit)

def call(sql,params=(),role="postgres"):
    with c() as d:
        d.execute("SET ROLE "+role)
        try:
            r=d.execute(sql,params)
            return ("OK",r.fetchall() if r.description else None)
        except psycopg.Error as e:
            return ("ERR",e.sqlstate)

def scalar(sql,params=(),role="postgres"):
    r=call(sql,params,role)
    if r[0]!="OK":
        raise AssertionError("fixture SQL refused "+repr(r))
    return r[1][0][0]

N=0
def check(msg,cond,detail=None):
    global N
    N+=1
    print(f"[R1-R2-COMPOSITE] {'PASS' if cond else 'FAIL'} #{N}: {msg}"
          +(f" {str(detail)[:170]}" if detail is not None else ""),flush=True)
    if not cond: raise AssertionError(msg)

# Own one disposable profile WITHOUT a_strict_cases to challenge global guard.
a=uuid.uuid4()
r=call("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(a,"r1caseless-"+a.hex[:9]+"@invalid.example"))
check("caseless fixture auth user created",r[0]=="OK",r)
check("caseless profile exists",scalar("SELECT count(*) FROM public.profiles WHERE account_id=%s",(a,))==1)
r=call("""INSERT INTO research_lifecycle_private.deletion_billing_incidents(
 account_id,status,reason_codes,first_observed_at,last_observed_at,observation_count)
 VALUES(%s,'open',ARRAY['unknown_payment'],clock_timestamp(),clock_timestamp(),1)""",(a,))
check("caseless financial incident created",r[0]=="OK",r)
check("new incident is journaled at full generation",
 scalar("""SELECT count(*) FROM research_lifecycle_private.a_strict_incident_observation_journal
 WHERE account_id=%s AND observation_count=1""",(a,))==1)
clear=scalar("SELECT id FROM public.research_billing_clearances LIMIT 1")
r=call("""UPDATE research_lifecycle_private.deletion_billing_incidents SET
 status='resolved',resolved_at=clock_timestamp(),
 resolution_reference='p1-caseless-resolution-001',
 resolution_clearance_id=%s WHERE account_id=%s""",(clear,a))
check("owner direct case-less incident resolve refused by global guard",r==("ERR","42501"),r)
check("caseless incident remains OPEN",scalar("SELECT status FROM research_lifecycle_private.deletion_billing_incidents WHERE account_id=%s",(a,))=="open")
r=call("DELETE FROM research_lifecycle_private.deletion_billing_incidents WHERE account_id=%s",(a,))
check("owner incident DELETE refused",r==("ERR","42501"),r)
r=call("TRUNCATE research_lifecycle_private.deletion_billing_incidents")
check("owner incident TRUNCATE refused",r==("ERR","42501"),r)
r=call("""UPDATE research_lifecycle_private.deletion_billing_incidents
 SET last_observed_at=last_observed_at-interval '1 second'
 WHERE account_id=%s""",(a,))
check("owner observation timestamp rewind refused",r==("ERR","42501"),r)
r=call("""UPDATE research_lifecycle_private.deletion_billing_incidents
 SET observation_count=observation_count-1 WHERE account_id=%s""",(a,))
check("owner observation-count rewind refused",r==("ERR","42501"),r)
r=call("""UPDATE research_lifecycle_private.deletion_billing_incidents
 SET reason_codes=ARRAY[]::text[] WHERE account_id=%s""",(a,))
check("owner financial reason erasure refused",r==("ERR","42501"),r)
r=call("""UPDATE research_lifecycle_private.a_strict_incident_observation_journal
 SET observation_count=99 WHERE account_id=%s""",(a,))
check("incident observation journal append-only",r[0]=="ERR",r)

# Use real owner-recovery synthetic cases created by the previous test suite.
resumes=scalar("SELECT count(*) FROM research_lifecycle_private.a_strict_owner_generation_decisions WHERE disposition='resume'")
check("existing owner recovery path created a full-generation decision",resumes>=2,resumes)
matched=scalar("""SELECT count(*) FROM research_lifecycle_private.a_strict_owner_generation_decisions d
 JOIN research_lifecycle_private.a_strict_financial_reconciliations f
  ON f.account_id=d.account_id AND f.case_ref=d.case_ref
  AND f.incident_last_observed_at=d.incident_last_observed_at
  AND f.incident_observation_count=d.incident_observation_count
  AND f.clearance_id=d.clearance_id AND f.resolution_ref=d.decision_ref
 WHERE d.disposition='resume'""")
check("every resume is bound to the exact account/case/timestamp/count ledger",matched==resumes,(matched,resumes))
resolved=scalar("""SELECT i.account_id FROM research_lifecycle_private.deletion_billing_incidents i
 WHERE i.status='resolved' AND EXISTS (
  SELECT 1 FROM research_lifecycle_private.a_strict_owner_generation_decisions d
  WHERE d.account_id=i.account_id AND d.incident_observation_count=i.observation_count
 ) LIMIT 1""")
same=call("""UPDATE research_lifecycle_private.deletion_billing_incidents
 SET status='open',resolved_at=NULL,resolution_reference=NULL,
 resolution_clearance_id=NULL WHERE account_id=%s RETURNING account_id""",(resolved,))
check("resolved incident cannot reopen without a new signed observation generation",
 same==("ERR","42501"),same)
newer=scalar("""SELECT count(*) FROM research_lifecycle_private.deletion_billing_incidents i
 WHERE i.status='open' AND EXISTS (
  SELECT 1 FROM research_lifecycle_private.a_strict_owner_generation_decisions d
  WHERE d.account_id=i.account_id
    AND d.incident_observation_count<i.observation_count
 )""")
check("late signed event reopened later generation beyond prior owner decision",newer>=1,newer)
b=scalar("""SELECT i.account_id FROM research_lifecycle_private.deletion_billing_incidents i
 WHERE i.status='open' AND EXISTS (
  SELECT 1 FROM research_lifecycle_private.a_strict_owner_generation_decisions d
  WHERE d.account_id=i.account_id AND d.incident_observation_count<i.observation_count
 ) LIMIT 1""")
old=call("""SELECT d.incident_last_observed_at,d.incident_observation_count
 FROM research_lifecycle_private.a_strict_owner_generation_decisions d
 WHERE d.account_id=%s ORDER BY d.incident_observation_count LIMIT 1""",(b,))
assert old[0]=="OK"
oldt,oldcount=old[1][0]
replay=call("""UPDATE research_lifecycle_private.deletion_billing_incidents
 SET last_observed_at=%s,observation_count=%s WHERE account_id=%s""",(oldt,oldcount,b))
check("old authorized timestamp/count cannot be replayed over new payment",replay==("ERR","42501"),replay)
r=call("DELETE FROM research_lifecycle_private.a_strict_owner_generation_decisions WHERE account_id=%s",(b,))
check("owner cannot remove old generation decision custody",r[0]=="ERR",r)
r=call("SELECT public.a_strict_owner_terminal_financial_hold(%s,%s,%s,%s,%s,%s)",
 (b,scalar("SELECT case_ref FROM research_lifecycle_private.a_strict_cases WHERE account_id=%s",(b,)),
  "p1-r1-terminal-hold-"+b.hex[:16],
  "p1-r1-privacy-"+b.hex[:16],"p1-r1-remedy-"+b.hex[:16],"owner"),role="service_role")
check("service role cannot forge terminal owner decision",r==("ERR","42501"),r)
r=call("SELECT public.a_strict_owner_terminal_financial_hold(%s,%s,%s,%s,%s,%s)",
 (b,scalar("SELECT case_ref FROM research_lifecycle_private.a_strict_cases WHERE account_id=%s",(b,)),
  "p1-r1-terminal-hold-"+b.hex[:16],
  "p1-r1-privacy-"+b.hex[:16],"p1-r1-remedy-"+b.hex[:16],"owner"))
check("owner may append terminal hold without clearing incident",r[0]=="OK",r)
check("terminal owner disposition does not resolve financial incident",
 scalar("SELECT status FROM research_lifecycle_private.deletion_billing_incidents WHERE account_id=%s",(b,))=="open")
check("no public-service execution on owner financial resolver",
 all(scalar("""SELECT has_function_privilege(%s,
 'public.a_strict_owner_reconcile_financial(uuid,text,uuid,text,text,text,text,text)',
 'EXECUTE')""",(x,)) is False for x in ("anon","authenticated","service_role")))

# Completion-email identity and forward-only terminal status: exercise the
# actual table with existing staged/queued synthetic outbox rows.
target=scalar("""SELECT id FROM public.notification_outbox
 WHERE message_id='account_deletion_completed' AND status='queued'
 ORDER BY created_at DESC LIMIT 1""")
check("previous positive A-strict suite left queued synthetic completion",target is not None)
# Provider-accepted means the external mail service took custody: requeue is
# also a duplicate-send hazard. Isolate the positive setup in a rolled-back
# transaction, preserving the queued fixture for the delivered path below.
accepted_rearm=None
with c(autocommit=False) as tx:
    tx.execute("SET ROLE service_role")
    state=tx.execute("""UPDATE public.notification_outbox
      SET status='accepted',accepted_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=%s RETURNING status""",(target,)).fetchone()
    check("queued completion may record legitimate provider acceptance",
          state==("accepted",),state)
    try:
        tx.execute("""UPDATE public.notification_outbox
          SET status='queued',updated_at=clock_timestamp()
          WHERE id=%s RETURNING status""",(target,))
        accepted_rearm="PERMITTED"
    except psycopg.Error as e:
        accepted_rearm=e.sqlstate
    finally:
        tx.rollback()
check("accepted completion cannot be requeued for duplicate send",accepted_rearm=="42501",accepted_rearm)
check("rolled-back acceptance fixture leaves original completion queued",
 scalar("SELECT status FROM public.notification_outbox WHERE id=%s",(target,))=="queued")
r=call("""UPDATE public.notification_outbox SET status='delivered',
 updated_at=clock_timestamp() WHERE id=%s RETURNING status""",(target,),role="service_role")
check("legitimate service_role queued-to-delivered transition",r==("OK",[("delivered",)]),r)
r=call("""UPDATE public.notification_outbox SET status='queued',
 updated_at=clock_timestamp() WHERE id=%s RETURNING id""",(target,),role="service_role")
check("service_role cannot rearm delivered completion to queued",r==("ERR","42501"),r)
r=call("""UPDATE public.notification_outbox SET status='sending',
 updated_at=clock_timestamp() WHERE id=%s RETURNING id""",(target,),role="service_role")
check("service_role cannot rearm delivered completion to sending",r==("ERR","42501"),r)
for outcome in ("hard_bounced","suppressed"):
    r=call("""UPDATE public.notification_outbox SET status=%s,
     updated_at=clock_timestamp() WHERE id=%s RETURNING status""",(outcome,target),role="service_role")
    check(f"delivered completion cannot jump to {outcome} outside Resend planner",r==("ERR","42501"),r)
r=call("""UPDATE public.notification_outbox SET status='complained',
 updated_at=clock_timestamp() WHERE id=%s RETURNING status""",(target,),role="service_role")
check("actual service_role delivered-to-complained provider transition allowed",
      r==("OK",[("complained",)]),r)
r=call("""UPDATE public.notification_outbox SET status='queued',
 updated_at=clock_timestamp() WHERE id=%s RETURNING id""",(target,),role="service_role")
check("complaint suppresses any later queued rearm",r==("ERR","42501"),r)
r=call("UPDATE public.notification_outbox SET created_at=now()-interval '30 days' WHERE id=%s RETURNING id",(target,))
check("SQL owner cannot backdate completion creation timestamp",r==("ERR","42501"),r)
r=call("UPDATE public.notification_outbox SET id=%s WHERE id=%s RETURNING id",(uuid.uuid4(),target))
check("SQL owner cannot change completion row identifier",r==("ERR","42501"),r)
r=call("""UPDATE public.notification_outbox SET recipient_email_normalized=%s
 WHERE id=%s RETURNING id""",("redirected@invalid.example",target),role="service_role")
check("service_role cannot redirect completion recipient",r==("ERR","42501"),r)
for column in ("id","recipient_email_normalized","created_at","consent_checked_at","payload"):
    p=scalar("SELECT has_column_privilege('service_role','public.notification_outbox',%s,'UPDATE')",(column,))
    check("least-privilege service_role cannot UPDATE completion "+column,p is False,p)
for column in ("status","attempt_count","next_attempt_at","provider_message_ref",
               "error_code","accepted_at","delivered_at","failed_at","updated_at"):
    p=scalar("SELECT has_column_privilege('service_role','public.notification_outbox',%s,'UPDATE')",(column,))
    check("service_role retains legitimate delivery PATCH field "+column,p is True,p)
check("staged-to-queued source release trigger still installed",
 scalar("""SELECT count(*) FROM pg_trigger WHERE tgrelid='public.notification_outbox'::regclass
 AND NOT tgisinternal AND tgname='research_p1_stage_deletion_completion_email'""")==1)
check("Research non-dispatchable privacy holds remain not auto-completed",
 scalar("""SELECT count(*) FROM research_lifecycle_private.deletion_auth_cleanup
 WHERE financial_hold_at IS NOT NULL AND phase<>'email_enqueued'""")>=1)
print(f"[R1-R2-COMPOSITE] {N} synthetic financial-generation and forward-only email assertions PASS.",flush=True)
