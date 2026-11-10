#!/usr/bin/env python3
"""Auth-absent financial split correction: original synthetic regressions.

Disposable PG17 only, synthetic accounts only. Never point this at a
connected Supabase project, a merchant account or a real identity.
Run AFTER owner_model_replay.py (and in CI after the other P1 suites).

Scope: the cross-service gap cannot be closed (no SQL lock spans the Auth
Admin HTTP call). These cases prove the fail-closed parts that CAN hold:
  - no Auth retirement step without fresh, post-Phase-A, per-account
    provider cessation evidence;
  - financial evidence before or during the fence refuses it;
  - evidence after the fence becomes a durable, classified hold that stops
    automatic retries and never completes privacy or email;
  - an ambiguous Auth outcome is never classified as "Auth intact";
  - recovery requires owner evidence recorded after the hold.
"""
import threading
import time
import uuid
import psycopg

RESULTS = []

def rec(label, condition, evidence=""):
    RESULTS.append(bool(condition))
    print(f"[P1-AUTH-SPLIT] {'PASS' if condition else 'FAIL'} {label} :: {str(evidence)[:220]}", flush=True)

def connect(autocommit=True):
    return psycopg.connect(dbname="ci_review", host="127.0.0.1", autocommit=autocommit)

def as_role(role, sql, args=(), connection=None):
    owned = connection is None
    c = connection or connect()
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
        if owned:
            c.close()

def db(sql, args=()):
    with connect() as c:
        cur = c.execute(sql, args)
        if not cur.description:
            return None
        found = cur.fetchone()
        return found[0] if found is not None else None

svc = lambda sql, args=(), connection=None: as_role("service_role", sql, args, connection)
owner = lambda sql, args=(): as_role("postgres", sql, args)

def new_due_account(tag):
    a = uuid.uuid4()
    db("INSERT INTO auth.users(id,email) VALUES(%s,%s)", (a, f"split-{tag}-{a.hex[:12]}@invalid.example"))
    with connect() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (str(a),))
        c.execute("SELECT public.request_account_deletion()")
        c.execute("RESET ROLE")
    db("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
          deletion_requested_at=now()-interval '31 days' WHERE account_id=%s""", (a,))
    return a

def phase_a(a):
    return svc("SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)", (a,))

def lease_for(a):
    result = svc("""SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb)
                    FROM public.claim_deletion_auth_cleanup_batch(25) q""")
    rows = result[1] if result[0] == "OK" else []
    chosen = next((r for r in rows if r["account_id"] == str(a)), None)
    return uuid.UUID(chosen["lease_id"]) if chosen else None

def fence(a, lease):
    return svc("SELECT public.check_deletion_auth_cleanup_billing_fence(%s,%s)", (a, lease))

def confirm(a, lease):
    return svc("SELECT public.confirm_deletion_auth_cleanup(%s,%s)", (a, lease))

def hold(a, lease, retired=False):
    return svc("SELECT public.hold_deletion_auth_cleanup(%s,%s,%s)", (a, lease, retired))

def clearance(a, ref, verified_sql="clock_timestamp()"):
    return owner(f"""SELECT public.record_research_billing_clearance(
        %s,'provider_api',%s,{verified_sql},'synthetic-owner')""", (a, ref))

def signed_paid(a, tag):
    return svc("""SELECT public.record_research_paid_binding_refusal(
        'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
        (f"syn-split-{tag}-{a.hex[:10]}", a, f"syn-split-ck-{a.hex[:14]}"))

def ledger(a):
    return db("SELECT to_jsonb(q) FROM research_lifecycle_private.deletion_auth_cleanup q WHERE account_id=%s", (a,))

def auth_rows(a):
    return db("SELECT count(*) FROM auth.users WHERE id=%s", (a,))

def privacy_pending(a):
    ids = [uuid.UUID(x) for x in (ledger(a) or {}).get("privacy_request_ids", [])]
    pending = db("""SELECT count(*) FROM public.privacy_requests WHERE id=ANY(%s::uuid[])
                    AND status='in_progress' AND completed_at IS NULL""", (ids,))
    return len(ids) >= 1 and pending == len(ids)

def sendable_email(a):
    return db("""SELECT count(*) FROM public.notification_outbox
                 WHERE message_id='account_deletion_completed' AND business_object_id=%s
                   AND status IN ('queued','sending','accepted','delivered')""", (str(a),))

def expire_lease(a):
    db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
          SET next_attempt_at=now()-interval '1 second' WHERE account_id=%s""", (a,))

# Post-finalization incident custody (owner-only resolution).
def incident(a):
    return db("""SELECT to_jsonb(i) FROM research_lifecycle_private.deletion_billing_incidents i
                 WHERE i.account_id=%s""", (a,))

def clearance_id(a, ref):
    return db("""SELECT id FROM public.research_billing_clearances
                 WHERE account_id=%s AND verification_reference=%s""", (a, ref))

def resolve(a, clearance_uuid, case_ref, role="postgres"):
    return as_role(role, "SELECT public.resolve_research_deletion_billing_incident(%s,%s,%s)",
                   (a, clearance_uuid, case_ref))

# Isolation: later claims must only ever pick up accounts created here.
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
      SET next_attempt_at=now()+interval '1 day'""")

# G - grant shape of the new classification RPC.
for role in ("anon", "authenticated"):
    r = as_role(role, "SELECT public.hold_deletion_auth_cleanup(%s,%s,false)", (uuid.uuid4(), uuid.uuid4()))
    rec(f"G {role} denied hold_deletion_auth_cleanup", r[0] == "ERR" and r[1].startswith("42501"), r)
rec("G service_role may classify holds but cannot record provider clearance",
    db("SELECT has_function_privilege('service_role','public.hold_deletion_auth_cleanup(uuid,uuid,boolean)','EXECUTE')")
    and not db("SELECT has_function_privilege('service_role','public.record_research_billing_clearance(uuid,text,text,timestamptz,text)','EXECUTE')"))

# 1 - No local footprint is not evidence: a zero-footprint account still
#     needs fresh provider cessation evidence before Auth retirement.
a1 = new_due_account("unverified")
rec("1 zero-footprint account completes database Phase A automatically",
    phase_a(a1)[0] == "OK" and auth_rows(a1) == 1)
l1 = lease_for(a1)
f1 = fence(a1, l1)
rec("1 fence refuses Auth retirement without fresh per-account provider evidence",
    l1 is not None and f1[0] == "ERR" and f1[1].startswith("55000")
    and "fresh per-account provider cessation" in f1[1]
    and ledger(a1)["financial_fence_passed_at"] is None and auth_rows(a1) == 1, f1)
h1 = hold(a1, l1)
rec("1 durable hold classified auth_intact_cessation_unverified",
    h1 == ("OK", "auth_intact_cessation_unverified")
    and ledger(a1)["financial_hold_class"] == "auth_intact_cessation_unverified"
    and ledger(a1)["lease_id"] is None, h1)
rec("1 held row is never re-leased automatically", lease_for(a1) is None)

# 2 - Stale or pre-finalization evidence never authorizes Auth retirement.
a2 = new_due_account("stale")
assert phase_a(a2)[0] == "OK"
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
      SET started_at=now()-interval '3 days' WHERE account_id=%s""", (a2,))
stale = clearance(a2, "syn-split-stale-0001", "clock_timestamp()-interval '25 hours'")
l2 = lease_for(a2)
f2 = fence(a2, l2)
rec("2 clearance older than 24 hours cannot authorize Auth retirement",
    stale[0] == "OK" and f2[0] == "ERR" and "fresh per-account provider cessation" in f2[1], f2)
# D3 regression: provider evidence can still be after Phase A but too old
# for a strict 15-minute Auth retirement fence. A fresh owner verification,
# not merely retrying the lease, is required to proceed.
a2c = new_due_account("fifteen-minute-boundary")
assert phase_a(a2c)[0] == "OK"
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
      SET started_at=now()-interval '2 hours' WHERE account_id=%s""", (a2c,))
old_16m = clearance(a2c, "syn-split-stale-16m", "clock_timestamp()-interval '16 minutes'")
l2c = lease_for(a2c)
f2c = fence(a2c, l2c)
rec("2 clearance 16 minutes old is rejected, with Auth intact",
    old_16m[0] == "OK" and l2c is not None
    and f2c[0] == "ERR" and "fresh per-account provider cessation" in f2c[1]
    and ledger(a2c)["financial_fence_passed_at"] is None and auth_rows(a2c) == 1, f2c)
assert clearance(a2c, "syn-split-fresh-after-16m")[0] == "OK"
rec("2 a fresh post-Phase-A owner clearance allows a clean current lease",
    fence(a2c, l2c) == ("OK", True)
    and ledger(a2c)["financial_fence_passed_at"] is not None
    and auth_rows(a2c) == 1)
a2b = new_due_account("prephasea")
assert clearance(a2b, "syn-split-pre-0001")[0] == "OK"
time.sleep(0.01)
assert phase_a(a2b)[0] == "OK"
l2b = lease_for(a2b)
f2b = fence(a2b, l2b)
rec("2 clearance verified before Phase A cannot authorize Auth retirement",
    f2b[0] == "ERR" and "fresh per-account provider cessation" in f2b[1], f2b)

# 3 - BEFORE the fence, two orderings.
# 3a: payment after Phase A but before any lease. Incident custody opens in
#     the payment's own transaction, so the row is never leased at all.
a3a = new_due_account("before-lease")
assert phase_a(a3a)[0] == "OK"
assert clearance(a3a, "syn-split-before-0000")[0] == "OK"
time.sleep(0.01)
p3a = signed_paid(a3a, "before-lease")
rec("3a payment before any lease opens incident custody; row is never leased",
    p3a[0] == "OK" and incident(a3a)["status"] == "open" and lease_for(a3a) is None
    and ledger(a3a)["financial_fence_passed_at"] is None and auth_rows(a3a) == 1, incident(a3a))
# 3b: a worker already holds the lease; the payment commits before its fence.
a3 = new_due_account("before")
assert phase_a(a3)[0] == "OK"
assert clearance(a3, "syn-split-before-0001")[0] == "OK"
time.sleep(0.01)
l3 = lease_for(a3)
p3 = signed_paid(a3, "before")
f3 = fence(a3, l3)
h3 = hold(a3, l3)
rec("3b payment after lease but before fence refuses it and leaves Auth intact",
    l3 is not None and p3[0] == "OK" and f3[0] == "ERR" and f3[1].startswith("55000")
    and ledger(a3)["financial_fence_passed_at"] is None and auth_rows(a3) == 1, f3)
rec("3b hold classified auth_intact_financial_evidence and stops retries",
    h3 == ("OK", "auth_intact_financial_evidence") and lease_for(a3) is None, h3)

# 4 - DURING the fence: a signed-payment writer holds the profile lock while
#     the fence runs. The fence must wait, then observe the payment.
a4 = new_due_account("during")
assert phase_a(a4)[0] == "OK"
assert clearance(a4, "syn-split-during-0001")[0] == "OK"
time.sleep(0.01)
l4 = lease_for(a4)
writer = connect(False)
writer.execute("SET ROLE service_role")
writer.execute("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
    (f"syn-split-during-{a4.hex[:10]}", a4, f"syn-split-ck-{a4.hex[:14]}"))
outcome = {}
def run_fence():
    outcome["fence"] = fence(a4, l4)
t = threading.Thread(target=run_fence)
t.start()
time.sleep(0.6)
blocked = t.is_alive()
writer.commit()
writer.close()
t.join(10)
f4 = outcome.get("fence")
rec("4 fence waits on the in-flight signed payment and then refuses",
    blocked and f4 is not None and f4[0] == "ERR" and f4[1].startswith("55000")
    and ledger(a4)["financial_fence_passed_at"] is None and auth_rows(a4) == 1,
    f"blocked={blocked} fence={f4}")

# 5 - AFTER the fence, before Auth DELETE: the unavoidable cross-service
#     window. The split is detected, durably classified and never completed.
a5 = new_due_account("after")
assert phase_a(a5)[0] == "OK"
assert clearance(a5, "syn-split-after-0001")[0] == "OK"
time.sleep(0.01)
l5 = lease_for(a5)
f5 = fence(a5, l5)
passed_at = ledger(a5)["financial_fence_passed_at"]
p5 = signed_paid(a5, "after")
db("DELETE FROM auth.users WHERE id=%s", (a5,))  # synthetic Auth Admin DELETE
c5 = confirm(a5, l5)
h5 = hold(a5, l5, True)
q5 = ledger(a5)
rec("5 fence pass is recorded durably before any Auth call",
    f5 == ("OK", True) and passed_at is not None, f5)
rec("5 KNOWN LIMIT: payment after fence can still precede Auth DELETE (not prevented)",
    p5[0] == "OK" and auth_rows(a5) == 0 and c5[0] == "ERR" and c5[1].startswith("55000"), c5)
rec("5 split classified auth_retired_financial_evidence; privacy and email held",
    h5 == ("OK", "auth_retired_financial_evidence")
    and q5["phase"] == "auth_pending" and q5["recipient_email"] is not None
    and privacy_pending(a5) and sendable_email(a5) == 0, h5)
rec("5 split is never retried automatically", lease_for(a5) is None)

# 5r - Recovery under post-finalization incident custody. A fresh clearance
#      and a quarantine resolution are each insufficient; only the owner-only
#      incident resolution, bound to a clearance newer than the incident and an
#      opaque case reference, lets the held row continue.
inc5 = incident(a5)
rec("5r the post-fence payment opened a durable financial incident",
    inc5 is not None and inc5["status"] == "open" and inc5["observation_count"] >= 1, inc5)
time.sleep(0.01)
assert clearance(a5, "syn-split-after-0002")[0] == "OK"
rec("5r fresh owner clearance alone does not re-admit the held row", lease_for(a5) is None)
db("""UPDATE public.research_paid_binding_quarantine SET resolved_at=now(),
      resolution_reference='syn-refunded-and-cancelled' WHERE claimed_account_id=%s""", (a5,))
rec("5r fresh clearance plus quarantine resolution still do not release the hold",
    lease_for(a5) is None and incident(a5)["status"] == "open")
pre_incident = resolve(a5, clearance_id(a5, "syn-split-after-0001"), "p1-syn-split-case-0001")
bad_ref = resolve(a5, clearance_id(a5, "syn-split-after-0002"), "not-a-case-reference")
by_service = resolve(a5, clearance_id(a5, "syn-split-after-0002"), "p1-syn-split-case-0001", "service_role")
rec("5r pre-incident clearance cannot resolve the incident",
    pre_incident[0] == "ERR" and pre_incident[1].startswith("55000"), pre_incident)
rec("5r malformed case reference is refused", bad_ref[0] == "ERR" and bad_ref[1].startswith("22023"), bad_ref)
rec("5r service_role cannot resolve an incident", by_service[0] == "ERR" and by_service[1].startswith("42501"), by_service)
rec("5r failed resolutions leave the incident open", incident(a5)["status"] == "open")
time.sleep(0.01)
assert clearance(a5, "syn-split-after-0003")[0] == "OK"
c5_id = clearance_id(a5, "syn-split-after-0003")
r5 = resolve(a5, c5_id, "p1-syn-split-case-0001")
inc5r = incident(a5)
rec("5r owner resolution with a post-incident clearance and case reference succeeds",
    r5 == ("OK", True) and inc5r["status"] == "resolved"
    and inc5r["resolution_clearance_id"] == str(c5_id)
    and inc5r["resolution_reference"] == "p1-syn-split-case-0001", r5)
l5d = lease_for(a5)
f5d = fence(a5, l5d)
c5d = confirm(a5, l5d)
rec("5r only after owner resolution does the retired-Auth row recover and confirm",
    l5d is not None and f5d == ("OK", True)
    and c5d[0] == "OK" and c5d[1]["phase"] == "auth_confirmed", c5d)

# 6 - Ambiguous Auth outcome: fence passed, DELETE may or may not have run,
#     the worker saw no answer and the lease expired.
# 6a: the payment lands before any retry lease. Incident custody keeps the
#     row from being re-leased; the durable fence-pass marker remains, so the
#     owner's incident review knows the Auth outcome must be established.
a6a = new_due_account("ambiguous-early")
assert phase_a(a6a)[0] == "OK"
assert clearance(a6a, "syn-split-ambig-0000")[0] == "OK"
time.sleep(0.01)
l6a = lease_for(a6a)
assert fence(a6a, l6a) == ("OK", True)
db("DELETE FROM auth.users WHERE id=%s", (a6a,))  # DELETE landed; response lost
expire_lease(a6a)
assert signed_paid(a6a, "ambiguous-early")[0] == "OK"
rec("6a payment before retry: never re-leased, fence-pass marker retained for review",
    lease_for(a6a) is None and incident(a6a)["status"] == "open"
    and ledger(a6a)["financial_fence_passed_at"] is not None, ledger(a6a)["financial_fence_passed_at"])
# 6b: a retry worker re-leases first; the payment commits before its fence.
a6 = new_due_account("ambiguous")
assert phase_a(a6)[0] == "OK"
assert clearance(a6, "syn-split-ambig-0001")[0] == "OK"
time.sleep(0.01)
l6 = lease_for(a6)
assert fence(a6, l6) == ("OK", True)
db("DELETE FROM auth.users WHERE id=%s", (a6,))  # DELETE landed; response lost
expire_lease(a6)
l6r = lease_for(a6)
assert signed_paid(a6, "ambiguous")[0] == "OK"
f6 = fence(a6, l6r)
h6 = hold(a6, l6r, False)
rec("6b retry after ambiguous Auth outcome refuses on new financial evidence",
    l6r is not None and l6r != l6 and f6[0] == "ERR" and f6[1].startswith("55000"), f6)
rec("6b never classified auth_intact: auth_outcome_unknown_financial_evidence",
    h6 == ("OK", "auth_outcome_unknown_financial_evidence") and lease_for(a6) is None, h6)

# 6c - Ambiguous outcome WITHOUT new evidence retries normally and completes.
a6b = new_due_account("ambiguous-clean")
assert phase_a(a6b)[0] == "OK"
assert clearance(a6b, "syn-split-ambig-0002")[0] == "OK"
time.sleep(0.01)
l6b = lease_for(a6b)
assert fence(a6b, l6b) == ("OK", True)
expire_lease(a6b)
l6b2 = lease_for(a6b)
f6b = fence(a6b, l6b2)
db("DELETE FROM auth.users WHERE id=%s", (a6b,))
c6b = confirm(a6b, l6b2)
rec("6c clean retry after ambiguous outcome re-fences and confirms once",
    f6b == ("OK", True) and c6b[0] == "OK" and ledger(a6b)["financial_hold_at"] is None, c6b)

# 7 - The classification RPC cannot be abused to clear or fabricate state.
a7 = new_due_account("abuse")
assert phase_a(a7)[0] == "OK"
assert clearance(a7, "syn-split-abuse-0001")[0] == "OK"
time.sleep(0.01)
l7 = lease_for(a7)
clean = hold(a7, l7)
rec("7 clean evidence records no hold (transient failure keeps normal retry)",
    clean == ("OK", None) and ledger(a7)["financial_hold_at"] is None, clean)
forged = hold(a7, uuid.uuid4())
rec("7 forged lease cannot record or alter a hold", forged[0] == "ERR" and forged[1].startswith("42501"), forged)
# Account 5 holds a VALID lease (l5d) and a recorded hold history. With clean
# evidence the classifier must return NULL and must not erase that history.
before = ledger(a5)
again = hold(a5, l5d)
after = ledger(a5)
rec("7 classifier with a valid lease and clean evidence cannot erase hold history",
    before["financial_hold_at"] is not None and again == ("OK", None)
    and after["financial_hold_at"] == before["financial_hold_at"]
    and after["financial_hold_class"] == before["financial_hold_class"], again)
direct = svc("""UPDATE research_lifecycle_private.deletion_auth_cleanup
                SET financial_hold_at=NULL, financial_hold_class=NULL WHERE account_id=%s""", (a1,))
rec("7 service_role cannot clear a hold directly", direct[0] == "ERR" and direct[1].startswith("42501"), direct)

def hold_state(a):
    return db("""SELECT jsonb_build_object('class',financial_hold_class,'at',financial_hold_at,
                 'first_at',financial_hold_first_at,'retired_at',auth_retired_observed_at)
                 FROM research_lifecycle_private.deletion_auth_cleanup WHERE account_id=%s""", (a,))

def hold_history(a):
    return db("""SELECT coalesce(jsonb_agg(jsonb_build_object('class',hold_class,
                 'computed',computed_class,'retired',auth_retired_observed) ORDER BY id),'[]'::jsonb)
                 FROM research_lifecycle_private.deletion_auth_financial_hold_events
                 WHERE account_id=%s""", (a,))

# 8 - Q-16 under incident custody: a verified Auth-retired incident must never
#     be downgraded through repeated holds and recovery. The original Q-16
#     path (re-admission while the quarantine is open) is now blocked one step
#     earlier by incident custody; the downgrade is then attempted the only
#     way left: after a valid owner resolution, a NEW signed payment arrives,
#     the fence refuses before any Auth call and the worker passes
#     retired=false.
def signed_paid_again(a, tag):
    return svc("""SELECT public.record_research_paid_binding_refusal(
        'lemon-squeezy',%s,%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
        (f"syn-split-{tag}-{a.hex[:10]}", a, f"syn-split-ck2-{a.hex[:13]}"))

def reconcile_and_resolve(a, ref, case_ref):
    db("""UPDATE public.research_paid_binding_quarantine SET resolved_at=now(),
          resolution_reference='syn-reconciled' WHERE claimed_account_id=%s
          AND resolved_at IS NULL""", (a,))
    time.sleep(0.01)
    assert clearance(a, ref)[0] == "OK"
    return resolve(a, clearance_id(a, ref), case_ref)

a8 = new_due_account("q16")
assert phase_a(a8)[0] == "OK"
assert clearance(a8, "syn-q16-0001")[0] == "OK"
time.sleep(0.01)
l8 = lease_for(a8)
assert fence(a8, l8) == ("OK", True)
assert signed_paid(a8, "q16")[0] == "OK"
db("DELETE FROM auth.users WHERE id=%s", (a8,))  # synthetic Auth DELETE, verified by GET
assert confirm(a8, l8)[0] == "ERR"
h8 = hold(a8, l8, True)
first = hold_state(a8)
time.sleep(0.01)
assert clearance(a8, "syn-q16-0002")[0] == "OK"  # quarantine deliberately unresolved
rec("8 Q-16 path: open incident blocks re-admission even with a newer clearance",
    h8 == ("OK", "auth_retired_financial_evidence") and lease_for(a8) is None
    and incident(a8)["status"] == "open", h8)
r8 = reconcile_and_resolve(a8, "syn-q16-0003", "p1-syn-q16-case-0001")
l8b = lease_for(a8)
assert r8 == ("OK", True) and l8b is not None, (r8, l8b)
assert signed_paid_again(a8, "q16-second")[0] == "OK"  # reopens custody
f8 = fence(a8, l8b)
h8b = hold(a8, l8b, False)  # the worker's real fence-refusal call
second = hold_state(a8)
rec("8 new payment after resolution reopens the incident and refuses the fence",
    incident(a8)["status"] == "open" and incident(a8)["observation_count"] >= 2
    and f8[0] == "ERR" and f8[1].startswith("55000"), f8)
rec("8 later retired=false observation cannot downgrade the verified Auth-retired class",
    h8b == ("OK", "auth_retired_financial_evidence")
    and second["class"] == "auth_retired_financial_evidence", h8b)
rec("8 first incident time and Auth-retirement fact are preserved across repeated holds",
    first["first_at"] is not None and second["first_at"] == first["first_at"]
    and first["retired_at"] is not None and second["retired_at"] == first["retired_at"]
    and second["at"] > first["at"], second)
r8b = reconcile_and_resolve(a8, "syn-q16-0004", "p1-syn-q16-case-0002")
l8c = lease_for(a8)
f8c = fence(a8, l8c)
c8c = confirm(a8, l8c)
third = hold_state(a8)
hist8 = hold_history(a8)
rec("8 second owner resolution recovers; retired Auth is confirmed",
    r8b == ("OK", True) and incident(a8)["resolution_reference"] == "p1-syn-q16-case-0002"
    and f8c == ("OK", True) and c8c[0] == "OK" and c8c[1]["phase"] == "auth_confirmed", c8c)
rec("8 recovery keeps the incident class, first time and Auth-retired fact",
    third["class"] == "auth_retired_financial_evidence"
    and third["first_at"] == first["first_at"] and third["retired_at"] == first["retired_at"], third)
rec("8 append-only history keeps both holds as Auth-retired, unchanged by recovery",
    len(hist8) == 2 and all(h["class"] == "auth_retired_financial_evidence" and h["retired"] for h in hist8),
    hist8)

# 9 - Unresolved financial incident vs cessation-only hold. While an incident
#     is open, the evidence is financial, never "cessation unverified". After
#     owner resolution, a remaining lack of fresh evidence IS cessation-only,
#     but the recorded incident class must not drop to that milder label.
def retirement_reasons(a):
    q = ledger(a)
    return db("""SELECT research_lifecycle_private.auth_retirement_hold_reasons(
                 %s,%s::timestamptz,%s::timestamptz)""", (a, q["started_at"], q["financial_hold_at"]))

a9 = new_due_account("rank")
assert phase_a(a9)[0] == "OK"
assert clearance(a9, "syn-rank-0001")[0] == "OK"
time.sleep(0.01)
l9 = lease_for(a9)  # lease first: payment lands between claim and fence
assert signed_paid(a9, "rank")[0] == "OK"
assert fence(a9, l9)[0] == "ERR"
h9 = hold(a9, l9)
db("""UPDATE public.research_paid_binding_quarantine SET resolved_at=now(),
      resolution_reference='syn-rank-reconciled' WHERE claimed_account_id=%s""", (a9,))
time.sleep(0.01)
assert clearance(a9, "syn-rank-0002")[0] == "OK"
open_reasons = retirement_reasons(a9)
rec("9 Auth-intact financial incident recorded before any Auth attempt",
    h9 == ("OK", "auth_intact_financial_evidence") and ledger(a9)["financial_fence_passed_at"] is None, h9)
rec("9 open incident is financial evidence, not cessation-only, after quarantine reconciliation",
    "research_post_finalization_incident" in open_reasons
    and open_reasons != ["provider_cessation_unverified"] and lease_for(a9) is None, open_reasons)
r9 = resolve(a9, clearance_id(a9, "syn-rank-0002"), "p1-syn-rank-case-0001")
l9b = lease_for(a9)
# Clearances are append-only and cannot be aged, so make the only post-hold
# clearance insufficient by moving this row's latest hold time past it
# (disposable fixture write). Only "cessation unverified" then remains.
db("""UPDATE research_lifecycle_private.deletion_auth_cleanup
      SET financial_hold_at=clock_timestamp() WHERE account_id=%s""", (a9,))
resolved_reasons = retirement_reasons(a9)
f9 = fence(a9, l9b)
h9b = hold(a9, l9b)
hist9 = hold_history(a9)
rec("9 after owner resolution the remaining evidence is cessation-only",
    r9 == ("OK", True) and l9b is not None
    and resolved_reasons == ["provider_cessation_unverified"]
    and f9[0] == "ERR" and "fresh per-account provider cessation" in f9[1], f"{r9} {resolved_reasons} {f9}")
rec("9 cessation-only observation cannot relabel the earlier financial incident",
    h9b == ("OK", "auth_intact_financial_evidence")
    and hist9[-1]["computed"] == "auth_intact_cessation_unverified"
    and hist9[-1]["class"] == "auth_intact_financial_evidence"
    and hist9[0]["computed"] == "auth_intact_financial_evidence", f"{h9b} {hist9}")

# 10 - Incident history is private and append-only, even for the table owner.
for role in ("service_role", "anon", "authenticated"):
    r = as_role(role, "SELECT count(*) FROM research_lifecycle_private.deletion_auth_financial_hold_events")
    rec(f"10 {role} cannot read incident history", r[0] == "ERR" and r[1].startswith("42501"), r)
for verb, sql in (
    ("UPDATE", "UPDATE research_lifecycle_private.deletion_auth_financial_hold_events SET hold_class='auth_intact_cessation_unverified' WHERE account_id=%s"),
    ("DELETE", "DELETE FROM research_lifecycle_private.deletion_auth_financial_hold_events WHERE account_id=%s"),
):
    r = owner(sql, (a8,))
    rec(f"10 owner {verb} of incident history is rejected", r[0] == "ERR" and r[1].startswith("42501"), r)
r = owner("TRUNCATE research_lifecycle_private.deletion_auth_financial_hold_events")
rec("10 owner TRUNCATE of incident history is rejected", r[0] == "ERR" and r[1].startswith("42501"), r)
rec("10 history unchanged after rejected owner writes", hold_history(a8) == hist8)

total = len(RESULTS)
passed = sum(RESULTS)
print(f"P1_AUTH_SPLIT_DONE total={total} pass={passed} fail={total - passed}", flush=True)
raise SystemExit(0 if passed == total else 1)
