#!/usr/bin/env python3
"""D3 candidate: 20-minute-old provider evidence must not reopen a held
legacy Auth cleanup row. Disposable PostgreSQL only, BEFORE A-strict overlay.
This does not authorize the legacy worker or prove merchant cessation.
"""
import uuid
import psycopg

def conn():
    return psycopg.connect(dbname="ci_review",host="127.0.0.1",autocommit=True)

def q(sql,args=(),role="postgres"):
    with conn() as c:
        c.execute("SET ROLE "+role)
        x=c.execute(sql,args)
        return x.fetchall() if x.description else []

count=0
def check(msg,value,detail=None):
    global count
    count+=1
    print("[P1-D3] "+("PASS " if value else "FAIL ")+str(count)+" "+msg+
          (" "+str(detail)[:120] if detail is not None else ""),flush=True)
    if not value:raise AssertionError(msg)

a=uuid.uuid4()
q("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(a,"d3-"+a.hex[:12]+"@invalid.example"))
with conn() as c:
    c.execute("SET ROLE authenticated")
    c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(a),))
    c.execute("SELECT public.request_account_deletion()")
q("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
 deletion_requested_at=now()-interval '31 days' WHERE account_id=%s""",(a,))
r=q("SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)",(a,),role="service_role")
check("synthetic Phase A created held Auth queue",r and r[0][0]["phase"]=="auth_pending")
# Test-only synthetic time-warp of a single local row; no production records.
q("""UPDATE research_lifecycle_private.deletion_auth_cleanup
 SET started_at=clock_timestamp()-interval '25 minutes',
     next_attempt_at=clock_timestamp()-interval '5 years',
     financial_hold_first_at=clock_timestamp()-interval '21 minutes',
     financial_hold_at=clock_timestamp()-interval '21 minutes',
     financial_hold_class='auth_intact_cessation_unverified'
 WHERE account_id=%s""",(a,))
clear=q("""SELECT public.record_research_billing_clearance(
 %s,'provider_api',%s,clock_timestamp()-interval '20 minutes','synthetic-owner')""",
 (a,"p1-"+a.hex[:12]+"-age20"))
check("synthetic 20-minute evidence recorded but remains stale",bool(clear))
read=q("""SELECT research_lifecycle_private.auth_retirement_hold_reasons(
 %s,clock_timestamp()-interval '25 minutes',clock_timestamp()-interval '21 minutes')""",(a,))
check("retirement hold rejects evidence older than 15m",
 'provider_cessation_unverified' in read[0][0],read[0][0])
func=q("""SELECT pg_get_functiondef(
 'research_lifecycle_private.auth_retirement_hold_reasons(uuid,timestamptz,timestamptz)'::regprocedure),
 pg_get_functiondef('public.claim_deletion_auth_cleanup_batch(integer)'::regprocedure)""")[0]
check("both installed candidate routines contain no 24-hour cutoff",
 all("24 hours" not in str(x).lower() for x in func))
check("both installed candidate routines carry 15-minute rule",
 all("15 minutes" in str(x).lower() for x in func))
# An invalid batch is rejected before returning even one account.
for batch in (0,2,25):
    try:
        q("SELECT account_id FROM public.claim_deletion_auth_cleanup_batch(%s)",(batch,))
        rejected=False
    except psycopg.Error as exc:
        rejected=exc.sqlstate=="22023"
    check(f"legacy Auth-first claim requires exactly 1 (reject {batch})",rejected)
res=q("SELECT account_id,phase FROM public.claim_deletion_auth_cleanup_batch(1)")
check("20-minute-old clearance cannot re-admit financial hold in single-account claim",
 all(str(x[0])!=str(a) for x in res),res)
check("stale rejected lease leaves synthetic Auth identity intact",
 q("SELECT count(*) FROM auth.users WHERE id=%s",(a,))[0][0]==1)
check("stale rejected lease leaves Auth queue pending",
 q("SELECT phase FROM research_lifecycle_private.deletion_auth_cleanup WHERE account_id=%s",(a,))[0][0]=="auth_pending")
# Non-vacuous positive control: independently reviewed 14-minute evidence,
# newer than the 21-minute financial hold, MUST enable precisely this account's
# ONE legacy claim. Owner-only historical path still remains release NO-GO.
fresh=q("""SELECT public.record_research_billing_clearance(
 %s,'provider_api',%s,clock_timestamp()-interval '14 minutes','synthetic-owner')""",
 (a,"p1-"+a.hex[:12]+"-age14"))
check("14-minute owner receipt exists",bool(fresh))
now_clear=q("""SELECT research_lifecycle_private.auth_retirement_hold_reasons(
 %s,clock_timestamp()-interval '25 minutes',clock_timestamp()-interval '21 minutes')""",(a,))
check("14-minute clearance eliminates only provider cessation staleness",
 'provider_cessation_unverified' not in now_clear[0][0],now_clear[0][0])
claimed=q("SELECT account_id,phase FROM public.claim_deletion_auth_cleanup_batch(1)")
check("14-minute clearance admits exactly the single synthetic held account",
 len(claimed)==1 and str(claimed[0][0])==str(a),claimed)
check("single-account claim never retires Auth by itself",
 q("SELECT count(*) FROM auth.users WHERE id=%s",(a,))[0][0]==1)
print("[P1-D3] "+str(count)+" synthetic D3 legacy cutoff tests PASS; server_version="+str(q("SHOW server_version")[0][0]),flush=True)
