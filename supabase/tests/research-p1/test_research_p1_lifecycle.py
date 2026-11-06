#!/usr/bin/env python3
"""Research P1 integrated candidate: PostgreSQL regression suite.
Disposable 127.0.0.1 PG17.6 only, synthetic identities only. Run owner_model.py
first (52 main migrations + the P1 migration, executed by non-superuser
`postgres`). Usage: p1_pg.py <label>"""
import sys, uuid, threading, time, json, psycopg
LABEL = sys.argv[1] if len(sys.argv) > 1 else "P1"
LP = "read-the-dollar-first-guided-interactive-edition"
R = []
def rec(area, name, ok, d=""):
    R.append(bool(ok)); print(f"[{LABEL}:{area}] {'PASS' if ok else 'FAIL'} {name} :: {d}", flush=True)
def conn(a=True): return psycopg.connect(dbname="ci_review", host="127.0.0.1", autocommit=a)
def err(e): return f"{e.sqlstate} {str(e).splitlines()[0][:120]}"
def as_role(role, sql, args=(), c=None):
    own = c is None; c = c or conn(); c.execute(f"SET ROLE {role}")
    try:
        cur = c.execute(sql, args); return ("OK", cur.fetchone()[0] if cur.description else None)
    except psycopg.Error as e: return ("ERR", err(e))
    finally:
        try: c.execute("RESET ROLE")
        except Exception: pass
        if own: c.close()
svc = lambda sql, args=(), c=None: as_role("service_role", sql, args, c)
own = lambda sql, args=(), c=None: as_role("postgres", sql, args, c)
def su(sql, args=()):
    with conn() as c:
        cur = c.execute(sql, args); return cur.fetchone()[0] if cur.description else None
N = [0]
def user():
    N[0] += 1; a = uuid.UUID(f"11111111-2222-4333-8444-{N[0]:012d}")
    su("INSERT INTO auth.users(id,email) VALUES(%s,%s)", (a, f"p1-{N[0]}@invalid.example")); return a
def request_del(a, c=None):
    o = c is None; c = c or conn()
    c.execute("SET ROLE authenticated"); c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (str(a),))
    try: c.execute("SELECT public.request_account_deletion()"); return "requested"
    except psycopg.Error as e: return "ERR " + err(e)
    finally:
        c.execute("RESET ROLE")
        if o: c.close()
def make_due(a):  # synthetic: deletion due now and Auth link detached (models a completed Auth step)
    su("UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute', deletion_requested_at=now()-interval '31 days', auth_user_id=null WHERE account_id=%s", (a,))
BIND = "SELECT public.bind_research_membership_subscription(%s,'lemon-squeezy',%s,%s,'313','monthly',now(),%s::jsonb)"
def signed_checkout_metadata(key):
    return json.dumps({"bindingSource":"signed-subscription-created","checkoutKey":key})
def attach_synthetic_checkout(a, key):
    issued=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",(a,key))
    assert issued[0]=="OK",issued
    attached=svc("SELECT public.attach_research_checkout_attempt(%s,%s,%s,now()+interval '30 minutes')",
                 (issued[1],a,"ck-synthetic-"+a.hex[-12:]))
    assert attached==("OK",True),attached
    # Model an EXPIRED checkout with independent provider reconciliation; this
    # test's billing clearance still must postdate its last financial footprint.
    su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '1 minute' WHERE id=%s",(issued[1],))
    return key
TR = """SELECT public.apply_research_membership_transition(%s,%s,%s,'lemon-squeezy',%s,%s::public.subscription_state,%s::public.subscription_state,
        now(),now()+interval '30 days',false,%s::public.entitlement_state,%s,null,'p1 synthetic',now(),'{}'::jsonb)"""
def research_member():
    a = user(); psub = f"p1-sub-{a.hex[-6:]}"
    key=attach_synthetic_checkout(a,"p1-binding-"+a.hex)
    b = svc(BIND, (a, psub, f"p1-cus-{a.hex[-6:]}", signed_checkout_metadata(key)))
    assert b[0]=="OK",b
    sid = b[1]["subscription_id"]
    t = svc(TR, (sid, f"p1-first-{psub}", f"evt-first-{psub}", psub, "pending", "active", "active", "2026-11-01T00:00:00Z"))
    assert t[0] == "OK", t
    return a, sid, psub
def ready(a): return svc("SELECT public.check_research_deletion_billing_readiness(%s)", (a,))
# SQL owner harness exercises the legacy inner function's billing invariants,
# while the live service_role must NEVER call that RPC directly after cutover.
# Real callers use only the atomic finalize_deletion_and_queue_auth_cleanup RPC.
def finalize(a): return own("SELECT count(*) FROM public.finalize_account_deletion(%s)", (a,))
def lp_purchase(a, n):
    r = svc("SELECT public.reserve_commerce_purchase_intent(%s,%s)", (a, f"p1-idem-{n:04d}-000000"))
    if r[0] != "OK": return r
    it = json.loads(json.dumps(su("SELECT row_to_json(i) FROM public.purchase_intents i WHERE account_id=%s ORDER BY created_at DESC LIMIT 1", (a,))))
    at = svc("SELECT public.attach_commerce_checkout(%s,%s,%s)", (it["id"], "paddle", f"chk_p1synthetic{n:016d}"))
    if at[0] != "OK": return at
    return svc("SELECT public.complete_commerce_purchase(%s,%s,now(),%s,%s,%s,%s,%s,%s,%s,%s,0,%s,'{}'::jsonb,now()+interval '1 day')",
               ("paddle", f"evt_p1synthetic{n:018d}", f"txn_p1synthetic{n:016d}", f"ctm_p1synthetic{n:015d}", it["id"], a, LP,
                f"pri_p1synthetic{n:015d}", it["currency"], it["amount_cents"], it["amount_cents"]))

# ---------------- G: grants and function hygiene ----------------
NEW_T = ["research_checkout_attempts", "research_paid_binding_quarantine", "research_billing_clearances",
         "research_deletion_billing_holds", "research_deletion_billing_hold_events"]
for t in NEW_T:
    privs = su("""SELECT coalesce(string_agg(grantee||':'||privilege_type, ','),'') FROM information_schema.role_table_grants
                  WHERE table_schema='public' AND table_name=%s AND grantee IN ('anon','authenticated','service_role','PUBLIC')""", (t,))
    rls = su("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid=%s::regclass", (f"public.{t}",))
    rec("G1", f"{t}: no API-role table privileges, RLS forced", privs == "" and rls, privs or "none")
for role in ("anon", "authenticated"):
    for t in NEW_T:
        r = as_role(role, f"SELECT count(*) FROM public.{t}")
        rec("G2", f"{role} cannot read {t}", r[0] == "ERR" and r[1].startswith("42501"), str(r))
    for f in ("check_research_deletion_billing_readiness(%s)", "create_research_checkout_attempt(%s,'k',null)"):
        r = as_role(role, f"SELECT public.{f}", (uuid.uuid4(),))
        rec("G2", f"{role} cannot execute {f.split('(')[0]}", r[0] == "ERR" and r[1].startswith("42501"), str(r))
for t in NEW_T:
    r = svc(f"SELECT count(*) FROM public.{t}")
    rec("G3", f"service_role has no direct read on {t} (RPC-only)", r[0] == "ERR" and r[1].startswith("42501"), str(r))
    r = svc(f"DELETE FROM public.{t}")
    rec("G3", f"service_role has no direct DELETE on {t}", r[0] == "ERR" and r[1].startswith("42501"), str(r))
r = svc("SELECT public.record_research_billing_clearance(%s,'provider_api','ref-forged-0001',now(),'web')", (uuid.uuid4(),))
rec("G4", "service_role cannot write a billing clearance (owner-only)", r[0] == "ERR" and r[1].startswith("42501"), str(r))
r = svc("SELECT research_lifecycle_private.billing_hold_reasons(%s)", (uuid.uuid4(),))
rec("G4", "service_role cannot call private readiness helper directly", r[0] == "ERR" and r[1].startswith("42501"), str(r))
bad = su("""SELECT coalesce(string_agg(p.oid::regprocedure::text, ','),'') FROM pg_proc p
            WHERE p.prosecdef AND (p.pronamespace='research_lifecycle_private'::regnamespace OR p.proname IN
              ('check_research_deletion_billing_readiness','mark_research_deletion_hold_escalated','record_research_billing_clearance',
               'create_research_checkout_attempt','attach_research_checkout_attempt','record_research_paid_binding_refusal','finalize_account_deletion'))
              AND NOT coalesce(p.proconfig @> ARRAY['search_path=""'], false)""")
rec("G5", "every new/replaced SECURITY DEFINER function pins search_path=''", bad == "", bad or "all pinned")
pub = su("""SELECT coalesce(string_agg(p.oid::regprocedure::text, ','),'') FROM pg_proc p
            WHERE p.pronamespace IN ('public'::regnamespace,'research_lifecycle_private'::regnamespace)
              AND p.proname IN ('check_research_deletion_billing_readiness','mark_research_deletion_hold_escalated','record_research_billing_clearance',
               'create_research_checkout_attempt','attach_research_checkout_attempt','record_research_paid_binding_refusal',
               'billing_hold_reasons','lock_account_profile','require_active_profile')
              AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))""")
rec("G5", "no new function executable by anon/authenticated", pub == "", pub or "none")

# ---------------- I: immutable ownership (D37-1, D38-3, D38-4) ----------------
a1, sid1, psub1 = research_member(); a2 = user()
for col, val in (("account_id", str(a2)), ("product_id", "'x'"), ("provider_subscription_id", "'p1-other'"), ("provider", "'paddle'")):
    v = f"'{val}'" if col == "account_id" else val
    r = svc(f"UPDATE public.subscriptions SET {col}={v} WHERE id=%s", (sid1,))
    rec("I1", f"service_role cannot re-key subscriptions.{col}", r[0] == "ERR" and r[1].startswith("42501") and "immutable" in r[1], str(r))
r = own("UPDATE public.subscriptions SET account_id=%s WHERE id=%s", (a2, sid1))
rec("I1", "even the table owner cannot re-key a subscription (trigger)", r[0] == "ERR" and "immutable" in r[1], str(r))
r = svc("UPDATE public.entitlements SET account_id=%s WHERE account_id=%s AND product_id='research-membership'", (a2, a1))
rec("I2", "service_role cannot re-key an entitlement", r[0] == "ERR" and "immutable" in r[1], str(r))
r = svc(TR, (sid1, f"p1-ref-{psub1}", f"evt-ref-{psub1}", psub1, "active", "refunded", "refunded", None))
rec("I3", "refund after a blocked re-key attempt is still recorded on the original owner (D38-3)", r[0] == "OK", str(r)[:160])
ready(a1)
r = own("UPDATE public.research_deletion_billing_holds SET account_id=%s WHERE account_id=%s", (a2, a1))
rec("I4", "hold-ledger row cannot be re-keyed even by owner (D37-6/D38-4)", r[0] == "ERR" and "immutable" in r[1], str(r))
r = own("UPDATE public.research_deletion_billing_hold_events SET reason_codes='{}' WHERE account_id=%s", (a1,))
rec("I4", "hold history is append-only", r[0] == "ERR" and "append-only" in r[1], str(r))

# ---------------- O1: signed provider event ordering under row lock ----------------
oa,osid,ops=research_member()
before_older=su("""SELECT s.state::text||':'||s.version||':'||e.state::text||':'||e.version
  FROM public.subscriptions s JOIN public.entitlements e ON e.subscription_id=s.id
  WHERE s.id=%s""",(osid,))
tr_old=TR.replace("'p1 synthetic',now(),'{}'::jsonb)",
                  "'p1 synthetic',now()-interval '7 days','{}'::jsonb)")
old_key="p1-older-"+ops
stale=svc(tr_old,(osid,old_key,"evt-older-"+ops,ops,"active","past_due","suspended",None))
after_older=su("""SELECT s.state::text||':'||s.version||':'||e.state::text||':'||e.version
  FROM public.subscriptions s JOIN public.entitlements e ON e.subscription_id=s.id
  WHERE s.id=%s""",(osid,))
stale_row=su("SELECT to_jsonb(e) FROM public.subscription_events e WHERE event_key=%s",(old_key,))
rec("O1","distinct older signed event is durably held, never changes paid state",
    stale[0]=="OK" and stale[1]["action"]=="held_stale"
    and before_older==after_older and stale_row is not None
    and stale_row["to_state"]==stale_row["from_state"]=="active"
    and stale_row["metadata"]["researchP1StaleHeld"] is True
    and stale_row["metadata"]["researchP1OriginalToState"]=="past_due",
    f"sql={stale}, state={before_older}->{after_older}")
same_stale=svc(tr_old,(osid,old_key,"evt-older-"+ops,ops,"active","past_due","suspended",None))
rec("O1","same signed stale event idempotently replays without another mutation",
    same_stale[0]=="OK" and same_stale[1]["action"]=="duplicate"
    and su("SELECT count(*) FROM public.subscription_events WHERE event_key=%s",(old_key,))==1,
    str(same_stale))
last_ts=su("""SELECT max(occurred_at) FROM public.subscription_events
    WHERE subscription_id=%s AND metadata ->> 'researchP1StaleHeld' IS DISTINCT FROM 'true'""",(osid,))
tr_equal=TR.replace("'p1 synthetic',now(),'{}'::jsonb)",
                    "'p1 synthetic',%s::timestamptz,'{}'::jsonb)")
equal=svc(tr_equal,(osid,"p1-equal-"+ops,"evt-equal-"+ops,ops,"active",
                    "past_due","suspended",None,last_ts))
rec("O1","distinct equal-timestamp signed event is held against ambiguous order",
    equal[0]=="OK" and equal[1]["action"]=="held_stale"
    and su("""SELECT state::text FROM public.subscriptions WHERE id=%s""",(osid,))=="active",
    str(equal))
fresh=svc(TR,(osid,"p1-fresh-"+ops,"evt-fresh-"+ops,ops,"active","past_due","suspended",None))
rec("O1","later genuine provider event still applies and suspends entitlement",
    fresh[0]=="OK" and fresh[1]["action"]=="applied"
    and su("SELECT state::text FROM public.subscriptions WHERE id=%s",(osid,))=="past_due"
    and su("""SELECT state::text FROM public.entitlements
              WHERE account_id=%s AND product_id='research-membership'""",(oa,))=="suspended",
    str(fresh))

# ---------------- C: checkout custody ----------------
a = user()
r1 = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a,))
r1b = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a,))
rec("C1", "active account gets a DB-issued attempt; retry with same key is idempotent", r1[0] == "OK" and r1 == r1b, f"{r1} {r1b}")
r = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a2,))
rec("C1", "checkout key cannot be replayed by another account", r[0] == "ERR" and r[1].startswith("23505"), str(r))
r = svc("SELECT public.attach_research_checkout_attempt(%s,%s,'chk-p1-0001',now()+interval '30 minutes')", (r1[1], a))
rec("C2", "attach while active -> true (URL may be issued)", r == ("OK", True), str(r))
misbound=svc(BIND,(a2,"p1-misbound-signed-sub","p1-misbound-cus",
                   signed_checkout_metadata("p1-checkout-key-00000001")))
rec("C2", "signed checkout key owned by A cannot bind paid subscription to B",
    misbound[0]=="ERR" and misbound[1].startswith("42501")
    and su("SELECT count(*) FROM public.subscriptions WHERE provider_subscription_id='p1-misbound-signed-sub'")==0,
    str(misbound))
missing_key=svc(BIND,(a2,"p1-missing-custody-sub","p1-missing-custody-cus",
                      signed_checkout_metadata("p1-key-not-issued-anywhere")))
rec("C2", "unissued key cannot create paid subscription",
    missing_key[0]=="ERR" and missing_key[1].startswith("42501"),str(missing_key))
no_signed_key=svc(BIND,(a2,"p1-no-signed-key-sub","p1-no-signed-key-cus","{}"))
rec("C2", "missing signed checkout metadata cannot bypass binding custody",
    no_signed_key[0]=="ERR" and no_signed_key[1].startswith("42501"),str(no_signed_key))
valid_bind=svc(BIND,(a,"p1-valid-attached-sub","p1-valid-attached-cus",
                     signed_checkout_metadata("p1-checkout-key-00000001")))
valid_repeat=svc(BIND,(a,"p1-valid-attached-sub","p1-valid-attached-cus",
                       signed_checkout_metadata("p1-checkout-key-00000001")))
rec("C2", "correct attached checkout owner binds once and duplicate is idempotent",
    valid_bind[0]=="OK" and valid_bind[1]["action"]=="created"
    and valid_repeat[0]=="OK" and valid_repeat[1]["action"]=="existing",
    f"first={valid_bind} replay={valid_repeat}")
r = svc("SELECT public.attach_research_checkout_attempt(%s,%s,'chk-p1-0002',now()+interval '30 minutes')", (r1[1], a))
rec("C2", "second attach of same attempt refused", r[0] == "ERR" and r[1].startswith("42501"), str(r))
r = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a,))
rec("C2", "attached attempt key cannot be reissued", r[0] == "ERR" and r[1].startswith("23505"), str(r))
b = user(); rb = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000002','annual')", (b,))
r = svc("SELECT public.attach_research_checkout_attempt(%s,%s,'chk-p1-0003',now()+interval '30 minutes')", (rb[1], a2))
rec("C2", "attach with a different account refused", r[0] == "ERR" and r[1].startswith("42501"), str(r))
request_del(b)
r = svc("SELECT public.attach_research_checkout_attempt(%s,%s,'chk-p1-0004',now()+interval '30 minutes')", (rb[1], b))
st = su("SELECT status FROM public.research_checkout_attempts WHERE id=%s", (rb[1],))
rec("C3", "deletion requested between attempt and attach -> attach false, attempt kept as attach_refused", r == ("OK", False) and st == "attach_refused", f"{r} {st}")
rr = ready(b)
rec("C3", "attach-refused attempt keeps deletion on hold (merchant checkout exists)", rr[0] == "OK" and "research_checkout_window_open" in rr[1]["reasons"], str(rr))
for status in ("deletion_pending", "suspended"):
    x = user()
    if status == "deletion_pending": request_del(x)
    else: su("UPDATE public.profiles SET status='suspended' WHERE account_id=%s", (x,))
    r = svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')", (x, f"p1-checkout-key-st-{status[:8]}"))
    rec("C4", f"{status} account cannot obtain a checkout attempt", r[0] == "ERR" and r[1].startswith("42501"), str(r))
r = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-missing01','monthly')", (uuid.uuid4(),))
rec("C4", "missing profile cannot obtain a checkout attempt", r[0] == "ERR" and r[1].startswith("42501"), str(r))
# two-connection race: attempt holds FOR SHARE; deletion request must wait, then hold applies
x = user(); ca = conn(False); ca.execute("SET ROLE service_role")
ca.execute("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-race0001','monthly')", (x,))
res = {}
def deleter():
    with conn() as cb:
        cb.execute("SET lock_timeout='5s'"); t0 = time.time(); res["r"] = request_del(x, cb); res["t"] = time.time() - t0
th = threading.Thread(target=deleter); th.start(); time.sleep(0.8)
blocked = th.is_alive(); ca.commit(); ca.close(); th.join()
rr = ready(x)
rec("C5", "race A: in-flight attempt blocks deletion request until commit; deletion then held", blocked and res["r"] == "requested" and "research_checkout_window_open" in rr[1]["reasons"], f"blocked={blocked} waited={res['t']:.2f}s {res['r']} {rr[1]['reasons']}")
x = user(); cb = conn(False); cb.execute("SET ROLE authenticated"); cb.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (str(x),))
cb.execute("SELECT public.request_account_deletion()")
res = {}
def attempter():
    res["r"] = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-race0002','monthly')", (x,))
th = threading.Thread(target=attempter); th.start(); time.sleep(0.8); blocked = th.is_alive(); cb.commit(); cb.close(); th.join()
rec("C5", "race B: uncommitted deletion request blocks attempt; attempt then refused", blocked and res["r"][0] == "ERR" and res["r"][1].startswith("42501"), f"blocked={blocked} {res['r']}")

# ---------------- Q: paid-but-unbound quarantine (D37-2, D38-2, D38-5) ----------------
q = user(); request_del(q)
bnd = svc(BIND, (q, "p1-unbound-sub-1", "p1-unbound-cus-1",
                 signed_checkout_metadata("p1-checkout-key-q1")))
rec("Q1", "binding refused for deletion_pending (existing RPC)", bnd[0] == "ERR", str(bnd))
r1 = svc("SELECT public.record_research_paid_binding_refusal('lemon-squeezy','p1-unbound-sub-1',%s,'p1-checkout-key-q1','RESEARCH_FIRST_PURCHASE_BINDING_FAILED')", (q,))
r2 = svc("SELECT public.record_research_paid_binding_refusal('lemon-squeezy','p1-unbound-sub-1',%s,'p1-checkout-key-q1','RESEARCH_FIRST_PURCHASE_BINDING_FAILED')", (q,))
cnt = su("SELECT count(*)||':'||max(delivery_count) FROM public.research_paid_binding_quarantine WHERE provider_subscription_id='p1-unbound-sub-1'")
rec("Q1", "refusal quarantined once; duplicate webhook only increments the counter", r1[0] == "OK" and r1 == r2 and cnt == "1:2", f"{r1} {cnt}")
rr = ready(q)
rec("Q2", "quarantine holds the claimed account's deletion (was CLEAR before)", "research_paid_binding_quarantined" in rr[1]["reasons"], str(rr[1]["reasons"]))
make_due(q); f = finalize(q)
rec("Q2", "SQL finalizer refuses with quarantine present", f[0] == "ERR" and f[1].startswith("55000"), str(f))
own("SELECT public.record_research_billing_clearance(%s,'provider_dashboard','ref-p1-q-clear-1',now(),'owner-synthetic')", (q,))
rr = ready(q)
rec("Q3", "an owner clearance cannot override an unresolved quarantine", rr[1]["clear"] is False, str(rr[1]["reasons"]))

# ---------------- R: readiness, forgery resistance, escalation, clearance ----------------
n = user(); rr = ready(n)
rec("R1", "no Research footprint -> clear", rr == ("OK", {"clear": True, "reasons": [], "escalate": False}), str(rr))
l = user(); lp = lp_purchase(l, 1); rr = ready(l)
rec("R1", "Library Pass (Paddle) purchase works and does not hold deletion", lp[0] == "OK" and rr[1]["clear"] is True, f"{str(lp)[:90]} {rr}")
forgeries = {
    "cancelled + provider_webhook event": ("cancelled", True), "refunded state": ("refunded", False),
    "charged_back state": ("charged_back", False), "cancelled, stale event id reused": ("cancelled", True),
}
for i, (label, (state, evt)) in enumerate(forgeries.items()):
    fa, fsid, fpsub = research_member()
    su("ALTER TABLE public.subscriptions DISABLE TRIGGER subscriptions_validate_state_transition")
    try:
        u = svc(f"UPDATE public.subscriptions SET state='{state}', cancelled_at=now(), ended_at=now() WHERE id=%s", (fsid,))
    finally:
        su("ALTER TABLE public.subscriptions ENABLE TRIGGER subscriptions_validate_state_transition")
    if evt:
        svc("""INSERT INTO public.subscription_events(event_key,subscription_id,account_id,product_id,provider,provider_event_id,from_state,to_state,reason,actor_type,metadata,occurred_at)
               VALUES(%s,%s,%s,'research-membership','lemon-squeezy',%s,'active','cancelled','forged','provider_webhook','{}',now())""",
            (f"forged-{i}-{fpsub}", fsid, fa, "evt-first-" + fpsub if "reused" in label else f"evt-forged-{i}"))
    su("UPDATE public.entitlements SET state='refunded' WHERE account_id=%s AND product_id='research-membership'", (fa,))
    request_del(fa); make_due(fa); rr = ready(fa); f = finalize(fa)
    rec("R2", f"forged local evidence ({label}) never clears the hold (D35-3)", rr[1]["clear"] is False and f[0] == "ERR" and f[1].startswith("55000"), f"update={u[0]} reasons={rr[1]['reasons']} finalize={f}")
m, msid, mpsub = research_member(); request_del(m)
e1 = ready(m); e2 = ready(m)
rec("R3", "escalation claimed once; immediate re-check does not re-escalate (D36-2)", e1[1]["escalate"] is True and e2[1]["escalate"] is False, f"{e1[1]['escalate']} {e2[1]['escalate']}")
su("UPDATE public.research_deletion_billing_holds SET escalation_claimed_at=now()-interval '2 hours' WHERE account_id=%s", (m,))
e3 = ready(m)
rec("R3", "unconfirmed claim expires after 1h and is re-claimed (lost escalation recovers)", e3[1]["escalate"] is True, str(e3[1]))
mk = svc("SELECT public.mark_research_deletion_hold_escalated(%s,'ui-0123456789abcdef')", (m,))
mk2 = svc("SELECT public.mark_research_deletion_hold_escalated(%s,'ui-0123456789abcdef')", (m,))
su("UPDATE public.research_deletion_billing_holds SET escalation_claimed_at=now()-interval '2 hours' WHERE account_id=%s", (m,))
e4 = ready(m)
rec("R3", "after escalation is confirmed, no further escalations", mk == ("OK", True) and mk2 == ("OK", False) and e4[1]["escalate"] is False, f"{mk} {mk2} {e4[1]['escalate']}")
bad = svc("SELECT public.mark_research_deletion_hold_escalated(%s,'alice@example.com')", (m,))
rec("R3", "escalation reference must be opaque (no PII)", bad[0] == "ERR" and bad[1].startswith("22023"), str(bad))
hist = su("SELECT string_agg(event_type, ',' ORDER BY id) FROM public.research_deletion_billing_hold_events WHERE account_id=%s", (m,))
rec("R4", "reason history preserved per check (D37-5)", hist.startswith("held,escalation_claimed,rechecked"), hist)
make_due(m); f = finalize(m)
rec("R5", "SQL finalizer refuses an uncleared Research member", f[0] == "ERR" and f[1].startswith("55000"), str(f))
cl = own("SELECT public.record_research_billing_clearance(%s,'provider_api','ref-p1-m-0001',now(),'owner-synthetic')", (m,))
rr = ready(m)
rec("R5", "owner clearance after the last footprint change -> clear", cl[0] == "OK" and rr[1]["clear"] is True, f"{cl[0]} {rr}")
st = su("SELECT status FROM public.research_deletion_billing_holds WHERE account_id=%s", (m,))
rec("R5", "hold marked cleared with history", st == "cleared", st)
time.sleep(0.05)
svc(TR, (msid, f"p1-cancel-{mpsub}", f"evt-cancel-{mpsub}", mpsub, "active", "cancelled", "revoked", None))
rr = ready(m)
rec("R6", "new provider activity after clearance re-opens the hold", rr[1]["clear"] is False, str(rr[1]["reasons"]))
own("SELECT public.record_research_billing_clearance(%s,'provider_api','ref-p1-m-0002',now(),'owner-synthetic')", (m,))
f = finalize(m)
ent = su("SELECT string_agg(state::text, ',') FROM public.entitlements WHERE account_id=%s", (m,))
rec("R7", "cleared Research member finalizes; entitlement becomes account_deleted", f == ("OK", 1) and ent == "account_deleted", f"{f} {ent}")
re_ = svc(TR, (msid, f"p1-reopen-{mpsub}", f"evt-reopen-{mpsub}", mpsub, "cancelled", "active", "active", "2026-11-01T00:00:00Z"))
ent = su("SELECT string_agg(state::text, ',') FROM public.entitlements WHERE account_id=%s", (m,))
rec("R7", "late positive event held durably without reopening deleted account (D33-1)",
    re_[0]=="OK" and re_[1]["action"]=="held_nonactive" and ent=="account_deleted"
    and su("SELECT count(*) FROM public.subscription_events WHERE event_key=%s",
           (f"p1-reopen-{mpsub}",))==1,
    f"{re_} {ent}")
cf = own("SELECT public.record_research_billing_clearance(%s,'provider_api','ref-future-01',now()+interval '1 day','owner')", (n,))
rec("R8", "clearance cannot be future-dated", cf[0] == "ERR" and cf[1].startswith("22023"), str(cf))

# ---------------- R9: proof time versus entry time / checkout expiry ----------------
# Expiration only ends the automatic checkout-window hold. It must NOT turn
# an issued provider checkout into evidence that no payment ever occurred.
expiry = user()
attempt = svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",
              (expiry, 'p1-proof-expired-checkout-001'))
rec("R9", "issued synthetic checkout was recorded", attempt[0] == "OK", str(attempt))
request_del(expiry)
make_due(expiry)
# Move only the synthetic timer; preserve the immutable issued checkout row.
su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '2 hours' WHERE account_id=%s", (expiry,))
preclear = ready(expiry)
rec("R9", "expired checkout remains billing evidence pending external clearance",
    preclear[0] == "OK" and preclear[1]["clear"] is False
    and "research_checkout_issued" in preclear[1]["reasons"]
    and "research_checkout_window_open" not in preclear[1]["reasons"],
    str(preclear))
oldproof = own("""SELECT public.record_research_billing_clearance(
    %s,'provider_api','synthetic-stale-checkout-proof-001',
    now()-interval '1 day','synthetic-owner')""",(expiry,))
still = ready(expiry)
rec("R9", "stale provider observation entered after checkout cannot clear it",
    oldproof[0] == "OK" and still[0] == "OK" and still[1]["clear"] is False,
    f"proof={oldproof[0]} ready={still}")
fresh = own("""SELECT public.record_research_billing_clearance(
    %s,'provider_api','synthetic-fresh-checkout-proof-001',
    now(),'synthetic-owner')""",(expiry,))
cleared = ready(expiry)
rec("R9", "owner-proven provider observation after expired checkout may clear it",
    fresh[0] == "OK" and cleared[0] == "OK" and cleared[1]["clear"] is True,
    f"proof={fresh[0]} ready={cleared}")
future_small = own("""SELECT public.record_research_billing_clearance(
    %s,'provider_api','synthetic-early-clock-proof-001',
    now()+interval '1 minute','synthetic-owner')""",(expiry,))
rec("R9", "even one minute of future-dated merchant observation is rejected",
    future_small[0] == "ERR" and future_small[1].startswith("22023"), str(future_small))

# ---------------- R10: signed paid binding with absent/wrong claimed account ----------------
# Checkout owner must be held even when the signed webhook's custom claimed
# account is unavailable or inconsistent with the DB-issued checkout key.
unclaimed_owner = user()
unclaimed_key = 'p1-unclaimed-checkout-key-000001'
issued = svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",
             (unclaimed_owner, unclaimed_key))
request_del(unclaimed_owner)
make_due(unclaimed_owner)
su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '2 hours' WHERE account_id=%s",
   (unclaimed_owner,))
owner_proof = own("""SELECT public.record_research_billing_clearance(
  %s,'provider_api','synthetic-owner-before-late-payment-01',now(),'owner-synthetic')""",
  (unclaimed_owner,))
cleared_before = ready(unclaimed_owner)
late = svc("""SELECT public.record_research_paid_binding_refusal(
  'lemon-squeezy','synthetic-unclaimed-paid-sub-01',NULL,%s,'SIGNED_PAID_BINDING_REFUSED')""",
  (unclaimed_key,))
blocked_after = ready(unclaimed_owner)
rec("R10", "unclaimed signed payment still holds canonical checkout owner",
    issued[0]=="OK" and owner_proof[0]=="OK"
    and cleared_before[1]["clear"] is True and late[0]=="OK"
    and blocked_after[1]["clear"] is False
    and "research_paid_binding_quarantined" in blocked_after[1]["reasons"],
    f"late={late} before={cleared_before} after={blocked_after}")
refused = finalize(unclaimed_owner)
rec("R10", "unclaimed signed paid event blocks SQL finalization after owner proof",
    refused[0]=="ERR" and refused[1].startswith("55000"),str(refused))

wrong_owner = user()
claimed_other = user()
wrong_key = 'p1-wrong-claim-checkout-key-001'
issued2 = svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",
              (wrong_owner,wrong_key))
request_del(wrong_owner)
make_due(wrong_owner)
su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '2 hours' WHERE account_id=%s",
   (wrong_owner,))
own("SELECT public.record_research_billing_clearance(%s,'provider_api','synthetic-other-proof-001',now(),'owner-synthetic')",
    (wrong_owner,))
clear2 = ready(wrong_owner)
wrong = svc("""SELECT public.record_research_paid_binding_refusal(
  'lemon-squeezy','synthetic-wrong-account-paid-sub-01',%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",
  (claimed_other,wrong_key))
actual_hold = ready(wrong_owner)
claimed_hold = ready(claimed_other)
rec("R10", "wrong-account signed event holds both claimed identity and checkout owner",
    issued2[0]=="OK" and clear2[1]["clear"] is True and wrong[0]=="OK"
    and "research_paid_binding_quarantined" in actual_hold[1]["reasons"]
    and "research_paid_binding_quarantined" in claimed_hold[1]["reasons"],
    f"actual={actual_hold} claimed={claimed_hold}")
# Independent transaction: an in-flight paid event for a checkout key, with
# no claimed ID, must lock the checkout OWNER before DB Phase A can commit.
race_owner = user()
race_key='p1-race-unclaimed-checkout-00001'
race_attempt=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",
                 (race_owner,race_key))
request_del(race_owner)
su("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
    deletion_requested_at=now()-interval '31 days' WHERE account_id=%s""",(race_owner,))
su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '2 hours' WHERE account_id=%s",
   (race_owner,))
race_proof=own("SELECT public.record_research_billing_clearance(%s,'provider_api','synthetic-race-proof-001',now(),'owner-synthetic')",(race_owner,))
race_conn=conn(False)
race_conn.execute("SET ROLE service_role")
race_pending=race_conn.execute("""SELECT public.record_research_paid_binding_refusal(
  'lemon-squeezy','synthetic-race-sub-01',NULL,%s,'SIGNED_PAID_BINDING_REFUSED')""",(race_key,)).fetchone()[0]
race_result={}
def finalize_during_unclaimed_payment():
    with conn(False) as cc:
        cc.execute("SET ROLE service_role")
        cc.execute("SET lock_timeout='5s'")
        started=time.time()
        try:
            cc.execute("SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)",(race_owner,))
            race_result["outcome"]="unexpected-success"
        except psycopg.Error as e:
            race_result["outcome"]=err(e)
            cc.rollback()
        race_result["wait"]=time.time()-started
race_thread=threading.Thread(target=finalize_during_unclaimed_payment)
race_thread.start()
time.sleep(0.4)
was_blocked=race_thread.is_alive()
race_conn.commit()
race_conn.close()
race_thread.join(timeout=6)
race_state=su("SELECT status::text FROM public.profiles WHERE account_id=%s",(race_owner,))
rec("R10", "unclaimed paid event serializes with Phase A and blocks irreversible deletion",
    race_attempt[0]=="OK" and race_proof[0]=="OK" and race_pending is not None
    and was_blocked and not race_thread.is_alive()
    and race_result.get("outcome","").startswith("55000")
    and race_state=="deletion_pending"
    and su("SELECT count(*) FROM auth.users WHERE id=%s",(race_owner,))==1,
    f"waiting={was_blocked} result={race_result} state={race_state}")

# ---------------- R11: conflicting signed replay never loses either owner ----------------
# One provider subscription ID can be reported with different claimed accounts
# and checkout keys. The first claimant is not an authority over later evidence.
claimed_a,claimed_b=user(),user()
key_a,key_b='p1-conflict-evidence-owner-A001','p1-conflict-evidence-owner-B001'
issued_a=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",(claimed_a,key_a))
issued_b=svc("SELECT public.create_research_checkout_attempt(%s,%s,'monthly')",(claimed_b,key_b))
for who in (claimed_a,claimed_b):
    request_del(who)
    make_due(who)
    su("UPDATE public.research_checkout_attempts SET hold_until=now()-interval '2 hours' WHERE account_id=%s",(who,))
    own("SELECT public.record_research_billing_clearance(%s,'provider_api','synthetic-conflicting-proof-001',now(),'owner-synthetic')",(who,))
before_a,before_b=ready(claimed_a),ready(claimed_b)
first=svc("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy','synthetic-conflict-paid-sub-01',%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",(claimed_a,key_a))
second=svc("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy','synthetic-conflict-paid-sub-01',%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",(claimed_b,key_b))
all_claims=su("""SELECT seen_claimed_account_ids @> ARRAY[%s,%s]::uuid[]
                AND seen_checkout_keys @> ARRAY[%s,%s]::text[]
                AND cardinality(seen_claimed_account_ids)=2
                AND cardinality(seen_checkout_keys)=2
                AND delivery_count=2
              FROM public.research_paid_binding_quarantine
              WHERE provider='lemon-squeezy' AND provider_subscription_id='synthetic-conflict-paid-sub-01'""",
              (claimed_a,claimed_b,key_a,key_b))
after_a,after_b=ready(claimed_a),ready(claimed_b)
rec("R11", "conflicting signed claim retains BOTH account and checkout associations",
    issued_a[0]=="OK" and issued_b[0]=="OK"
    and before_a[1]["clear"] is True and before_b[1]["clear"] is True
    and first[0]=="OK" and second[0]=="OK" and first[1]==second[1]
    and all_claims,
    f"first={first} second={second} associations={all_claims}")
rec("R11", "both owners remain billing-held despite the earlier merchant proof",
    "research_paid_binding_quarantined" in after_a[1]["reasons"]
    and "research_paid_binding_quarantined" in after_b[1]["reasons"],
    f"first={after_a} second={after_b}")
# An account-level reconciliation may set resolved_at only through accountable
# owner review, but ANY new signed provider delivery re-opens it.
su("""UPDATE public.research_paid_binding_quarantine
      SET resolved_at=now(),resolution_reference='synthetic-review'
      WHERE provider='lemon-squeezy' AND provider_subscription_id='synthetic-conflict-paid-sub-01'""")
after_resolve_a,after_resolve_b=ready(claimed_a),ready(claimed_b)
redelivery=svc("""SELECT public.record_research_paid_binding_refusal(
    'lemon-squeezy','synthetic-conflict-paid-sub-01',%s,%s,'SIGNED_PAID_BINDING_REFUSED')""",(claimed_b,key_b))
again_a,again_b=ready(claimed_a),ready(claimed_b)
state11=su("""SELECT resolved_at IS NULL
                 AND resolution_reference IS NULL
                 AND delivery_count=3
                 AND cardinality(seen_claimed_account_ids)=2
                 AND cardinality(seen_checkout_keys)=2
             FROM public.research_paid_binding_quarantine
             WHERE provider='lemon-squeezy' AND provider_subscription_id='synthetic-conflict-paid-sub-01'""")
rec("R11", "signed redelivery after resolution reopens all linked billing holds",
    after_resolve_a[1]["clear"] is True and after_resolve_b[1]["clear"] is True
    and redelivery[0]=="OK" and state11
    and "research_paid_binding_quarantined" in again_a[1]["reasons"]
    and "research_paid_binding_quarantined" in again_b[1]["reasons"],
    f"resolved={after_resolve_a[1]['clear']}/{after_resolve_b[1]['clear']} reopen={again_a[1]['clear']}/{again_b[1]['clear']} state={state11}")

# ---------------- D33 / D2-C live paths ----------------
p, psid, ppsub = research_member(); request_del(p)
g = svc(TR, (psid, f"p1-renew-{ppsub}", f"evt-renew-{ppsub}", ppsub, "active", "active", "active", "2026-11-01T00:00:00Z"))
rec("D33", "positive renewal on deletion_pending is non-applied, held financial evidence",
    g[0]=="OK" and g[1]["action"]=="held_nonactive"
    and su("SELECT metadata ->> 'researchP1NonactiveHeld' FROM public.subscription_events WHERE event_key=%s",
           (f"p1-renew-{ppsub}",))=="true"
    and su("SELECT state::text FROM public.entitlements WHERE account_id=%s AND product_id='research-membership'",(p,))=="active",
    str(g))
ng = svc(TR, (psid, f"p1-cxl-{ppsub}", f"evt-cxl-{ppsub}", ppsub, "active", "cancelled", "revoked", None))
rec("D33", "negative cancellation still recorded for deletion_pending profile", ng[0] == "OK", str(ng)[:120])
ok_a, _, _ = research_member()
rec("D33", "authorized live Research binding + activation for an active profile still works", su("SELECT state::text FROM public.entitlements WHERE account_id=%s AND product_id='research-membership'", (ok_a,)) == "active")
dl = user(); request_del(dl); lp2 = lp_purchase(dl, 2)
rec("D2C", "Library Pass payment for deletion_pending account refused", lp2[0] == "ERR", str(lp2))
lp3 = lp_purchase(user(), 3)
rec("D2C", "Library Pass payment for an active account still completes", lp3[0] == "OK", str(lp3)[:120])
done_ = user(); lp_purchase(done_, 4); request_del(done_); make_due(done_); f = finalize(done_)
rec("F1", "LP-only account still finalizes (no Research footprint)", f == ("OK", 1), str(f))

# ---------------- S: fair deletion scan (oldest-held starvation regression) ----------------
scan_fn = "SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.list_due_account_deletions_fair(%s,now()) t"
for role in ("anon", "authenticated"):
    denied = as_role(role, scan_fn, (10,))
    rec("S1", f"{role} cannot read privacy scan through RPC",
        denied[0] == "ERR" and denied[1].startswith("42501"), str(denied))
direct = svc("SELECT count(*) FROM research_lifecycle_private.deletion_scan_cursor")
rec("S1", "service_role cannot read the private scan cursor", direct[0] == "ERR" and direct[1].startswith("42501"), str(direct))
for bad_size in (0, 26, 1000):
    bad = svc(scan_fn, (bad_size,))
    rec("S1", f"scan size {bad_size} rejected", bad[0] == "ERR" and bad[1].startswith("22023"), str(bad))

# Create a cohort whose oldest 30 requests remain held by Research billing.
# The newer LP-free account must still be reached by later bounded 10-row
# scans, without a migration of any real database or bypass of billing checks.
held_accounts = []
for idx in range(30):
    held_account, _, _ = research_member()
    request_del(held_account)
    make_due(held_account)
    su("""UPDATE public.profiles
           SET deletion_requested_at=now()-interval '60 days',
               deletion_due_at=now()-interval '50 days'+(%s * interval '1 second')
           WHERE account_id=%s""", (idx, held_account))
    held_accounts.append(held_account)
newer_clear = user()
request_del(newer_clear)
make_due(newer_clear)
su("""UPDATE public.profiles
       SET deletion_requested_at=now()-interval '60 days',
           deletion_due_at=now()-interval '40 days'
       WHERE account_id=%s""", (newer_clear,))
proof_hold = ready(held_accounts[0])
proof_clear = ready(newer_clear)
rec("S2", "old cohort has real Research holds; later account remains clear",
    proof_hold[0] == "OK" and proof_hold[1]["clear"] is False
    and proof_clear[0] == "OK" and proof_clear[1]["clear"] is True,
    f"held={proof_hold[1]} clear={proof_clear[1]}")

su("""UPDATE research_lifecycle_private.deletion_scan_cursor
       SET last_due_at=NULL,last_account_id=NULL WHERE singleton_id=1""")
pages = []
for _ in range(4):
    pages.append(svc(scan_fn, (10,)))
ids = [[uuid.UUID(row["account_id"]) for row in result[1]] if result[0]=="OK" else []
       for result in pages]
flat = [u for page in ids for u in page]
rec("S3", "four bounded pages reach 31 distinct due accounts before wrap",
    all(result[0]=="OK" for result in pages)
    and all(len(page)==10 for page in ids[:3])
    and 1 <= len(ids[3]) <= 10
    and len(set(flat[:31]))==31,
    f"pages={list(map(len,ids))} distinct={len(set(flat))}")
rec("S3", "31st due account is visited despite 30 older Research billing holds",
    newer_clear in ids[3] and newer_clear not in flat[:30]
    and set(held_accounts).issubset(set(flat)),
    f"clear_page={next((i+1 for i,page in enumerate(ids) if newer_clear in page),None)}")
cursor = su("""SELECT last_account_id FROM research_lifecycle_private.deletion_scan_cursor
               WHERE singleton_id=1""")
rec("S3", "cursor durable at last emitted due profile", cursor==flat[-1], str(cursor))

# Two concurrent workers must acquire the cursor row lock, not both claim
# the same first page. Newer profiles can appear while one worker waits.
su("""UPDATE research_lifecycle_private.deletion_scan_cursor
       SET last_due_at=NULL,last_account_id=NULL WHERE singleton_id=1""")
scan_a=conn(False)
scan_a.execute("SET ROLE service_role")
first=scan_a.execute(scan_fn, (10,)).fetchone()[0]
out={}
def competing_scanner():
    with conn(False) as db:
        db.execute("SET ROLE service_role")
        db.execute("SET lock_timeout='5s'")
        started=time.time()
        out["rows"]=db.execute(scan_fn, (10,)).fetchone()[0]
        out["wait"]=time.time()-started
        db.commit()
worker=threading.Thread(target=competing_scanner)
worker.start()
time.sleep(0.4)
waiting=worker.is_alive()
scan_a.commit()
scan_a.close()
worker.join(timeout=6)
r1={uuid.UUID(row["account_id"]) for row in first}
r2={uuid.UUID(row["account_id"]) for row in out.get("rows",[])}
rec("S4", "concurrent cursor scans serialize and hand out disjoint pages",
    waiting and not worker.is_alive() and len(r1)==10 and len(r2)==10
    and not (r1 & r2), f"waited={out.get('wait')} overlap={len(r1 & r2)}")

print(f"P1_PG_DONE label={LABEL} total={len(R)} pass={sum(R)} fail={len(R)-sum(R)}")
sys.exit(0 if all(R) else 1)
