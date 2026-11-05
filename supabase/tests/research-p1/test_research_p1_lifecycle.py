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
BIND = "SELECT public.bind_research_membership_subscription(%s,'lemon-squeezy',%s,%s,'313','monthly',now(),'{}'::jsonb)"
TR = """SELECT public.apply_research_membership_transition(%s,%s,%s,'lemon-squeezy',%s,%s::public.subscription_state,%s::public.subscription_state,
        now(),now()+interval '30 days',false,%s::public.entitlement_state,%s,null,'p1 synthetic',now(),'{}'::jsonb)"""
def research_member():
    a = user(); psub = f"p1-sub-{a.hex[-6:]}"
    b = svc(BIND, (a, psub, f"p1-cus-{a.hex[-6:]}")); sid = b[1]["subscription_id"]
    t = svc(TR, (sid, f"p1-first-{psub}", f"evt-first-{psub}", psub, "pending", "active", "active", "2026-11-01T00:00:00Z"))
    assert t[0] == "OK", t
    return a, sid, psub
def ready(a): return svc("SELECT public.check_research_deletion_billing_readiness(%s)", (a,))
def finalize(a): return svc("SELECT count(*) FROM public.finalize_account_deletion(%s)", (a,))
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

# ---------------- C: checkout custody ----------------
a = user()
r1 = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a,))
r1b = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a,))
rec("C1", "active account gets a DB-issued attempt; retry with same key is idempotent", r1[0] == "OK" and r1 == r1b, f"{r1} {r1b}")
r = svc("SELECT public.create_research_checkout_attempt(%s,'p1-checkout-key-00000001','monthly')", (a2,))
rec("C1", "checkout key cannot be replayed by another account", r[0] == "ERR" and r[1].startswith("23505"), str(r))
r = svc("SELECT public.attach_research_checkout_attempt(%s,%s,'chk-p1-0001',now()+interval '30 minutes')", (r1[1], a))
rec("C2", "attach while active -> true (URL may be issued)", r == ("OK", True), str(r))
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
bnd = svc(BIND, (q, "p1-unbound-sub-1", "p1-unbound-cus-1"))
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
rec("R7", "late positive event cannot reopen a deleted account (D33-1)", re_[0] == "ERR" and ent == "account_deleted", f"{re_} {ent}")
cf = own("SELECT public.record_research_billing_clearance(%s,'provider_api','ref-future-01',now()+interval '1 day','owner')", (n,))
rec("R8", "clearance cannot be future-dated", cf[0] == "ERR" and cf[1].startswith("22023"), str(cf))

# ---------------- D33 / D2-C live paths ----------------
p, psid, ppsub = research_member(); request_del(p)
g = svc(TR, (psid, f"p1-renew-{ppsub}", f"evt-renew-{ppsub}", ppsub, "active", "active", "active", "2026-11-01T00:00:00Z"))
rec("D33", "positive renewal refused for deletion_pending profile", g[0] == "ERR" and "nonactive" in g[1], str(g))
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

print(f"P1_PG_DONE label={LABEL} total={len(R)} pass={sum(R)} fail={len(R)-sum(R)}")
sys.exit(0 if all(R) else 1)
