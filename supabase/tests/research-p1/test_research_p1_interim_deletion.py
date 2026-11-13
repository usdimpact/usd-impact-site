#!/usr/bin/env python3
"""Research P1 interim (non-destructive) deletion mode: original PG17 checks.

Disposable PostgreSQL 17 only, synthetic accounts only. Never point this at
a connected Supabase project or real customer data.

Builds its own database `ci_interim` from the LIVE schema only: every source
migration except the uninstalled Research P1 Draft migration, using the same
non-superuser `postgres` ownership bootstrap as owner_model_replay.py. It
does not touch the shared `ci_review` database used by the other suites.

Usage: test_research_p1_interim_deletion.py <repo>
"""
import re
import sys
import uuid
from pathlib import Path

import psycopg

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
DB = "ci_interim"
# Draft-only migration(s) that are NOT installed in Production or Development.
DRAFT_ONLY = {"20261105190000_research_p1_billing_safe_lifecycle.sql"}
QUEUE_SQL = REPO / "docs/operations/research-p1-two-phase/interim-deletion-review-queue.sql"
LIBRARY_PASS = "read-the-dollar-first-guided-interactive-edition"
RESEARCH = "research-membership"

RESULTS = []

def rec(label, condition, evidence=""):
    RESULTS.append(bool(condition))
    print(f"[P1-INTERIM] {'PASS' if condition else 'FAIL'} {label} :: {str(evidence)[:200]}", flush=True)

def admin(dbname="postgres"):
    return psycopg.connect(dbname=dbname, host="127.0.0.1", autocommit=True)

with admin() as c:
    c.execute(f"DROP DATABASE IF EXISTS {DB} WITH (FORCE)")
    c.execute(f"CREATE DATABASE {DB}")

BOOTSTRAP = f"""
do $$ begin
  if not exists (select 1 from pg_roles where rolname='postgres') then
    create role postgres login createrole bypassrls nosuperuser; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator nologin noinherit; end if;
end $$;
grant anon, authenticated, service_role to postgres;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,
  allowed_mime_types text[],owner uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema auth,extensions,storage to postgres,anon,authenticated,service_role;
grant all on auth.users to postgres; grant execute on all functions in schema auth,extensions to postgres;
grant select,insert,update on storage.buckets to postgres;
grant all on schema public to postgres; grant create on database {DB} to postgres;
"""

migrations = sorted((REPO / "supabase/migrations").glob("*.sql"))
live = [m for m in migrations if m.name not in DRAFT_ONLY]
with admin(DB) as c:
    c.execute(BOOTSTRAP)
    c.execute("SET ROLE postgres")
    replayed = 0
    for m in live:
        try:
            c.execute(m.read_text("utf8"))
            replayed += 1
        except psycopg.Error as e:
            print("REPLAY FAIL", m.name, e.sqlstate, str(e).splitlines()[0])
            break
    c.execute("RESET ROLE")
    c.execute("reset lock_timeout; reset statement_timeout")
rec("live schema replayed without the Draft migration",
    replayed == len(live) and len(migrations) - len(live) == len(DRAFT_ONLY),
    f"{replayed}/{len(live)} live of {len(migrations)} source")
if replayed != len(live):
    raise SystemExit(1)

def connect():
    return psycopg.connect(dbname=DB, host="127.0.0.1", autocommit=True)

def db(sql, args=()):
    with connect() as c:
        cur = c.execute(sql, args)
        if not cur.description:
            return None
        row = cur.fetchone()
        return row[0] if row is not None else None

def as_user(account, sql, args=()):
    """Run as `authenticated` with a still-valid JWT subject for `account`."""
    with connect() as c:
        c.execute("SET ROLE authenticated")
        c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (str(account),))
        try:
            cur = c.execute(sql, args)
            return ("OK", cur.fetchone()[0] if cur.description else None)
        except psycopg.Error as e:
            return ("ERR", f"{e.sqlstate} {str(e).splitlines()[0][:140]}")

def as_role(role, sql, args=()):
    with connect() as c:
        c.execute(f"SET ROLE {role}")
        try:
            cur = c.execute(sql, args)
            return ("OK", cur.fetchone()[0] if cur.description else None)
        except psycopg.Error as e:
            return ("ERR", f"{e.sqlstate} {str(e).splitlines()[0][:140]}")

def new_account(tag):
    a = uuid.uuid4()
    db("INSERT INTO auth.users(id,email) VALUES(%s,%s)", (a, f"interim-{tag}-{a.hex[:10]}@invalid.example"))
    if db("SELECT count(*) FROM public.profiles WHERE account_id=%s", (a,)) == 0:
        db("INSERT INTO public.profiles(account_id,email) VALUES(%s,%s)", (a, f"interim-{tag}-{a.hex[:10]}@invalid.example"))
    return a

def grant_library_pass(a):
    db("""INSERT INTO public.entitlements(account_id,product_id,state,starts_at)
          VALUES(%s,%s,'active',now()-interval '60 days')""", (a, LIBRARY_PASS))

def research_subscription(a, state):
    db("""INSERT INTO public.subscriptions(account_id,product_id,provider,provider_subscription_id,
            billing_interval,state,current_period_start,current_period_end,cancel_at_period_end)
          VALUES(%s,%s,'lemon-squeezy',%s,'monthly',%s,now()-interval '10 days',now()+interval '20 days',%s)""",
       (a, RESEARCH, f"syn-sub-{a.hex[:16]}-{state}", state, state == "cancel_scheduled"))

def snapshot(a):
    return db("""SELECT md5(coalesce((SELECT string_agg(t::text, '|' ORDER BY t::text) FROM (
                   SELECT e::text AS t FROM public.entitlements e WHERE e.account_id=%s
                   UNION ALL SELECT s::text FROM public.subscriptions s WHERE s.account_id=%s
                   UNION ALL SELECT u::text FROM public.purchases u WHERE u.account_id=%s) x), ''))""",
              (a, a, a))

def deletion_cases(a):
    return db("""SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'due',due_at,
                 'requested',requested_at,'completed_at',completed_at)), '[]'::jsonb)
                 FROM public.privacy_requests WHERE account_id=%s AND request_type='deletion'""", (a,))

# 1 - Intake: a valid request records a pending state and one open case.
a1 = new_account("intake")
grant_library_pass(a1)
research_subscription(a1, "active")
before = snapshot(a1)
r1 = as_user(a1, "SELECT to_jsonb(public.request_account_deletion())")
profile = db("SELECT to_jsonb(p) FROM public.profiles p WHERE account_id=%s", (a1,))
cases = deletion_cases(a1)
rec("1 request moves the profile to deletion_pending with a 7-day safety period",
    r1[0] == "OK" and profile["status"] == "deletion_pending"
    and db("SELECT deletion_due_at - deletion_requested_at FROM public.profiles WHERE account_id=%s", (a1,)).days == 7,
    r1)
rec("1 exactly one OPEN deletion privacy case, due one month out, not completed",
    len(cases) == 1 and cases[0]["status"] == "open" and cases[0]["completed_at"] is None
    and db("""SELECT due_at - requested_at BETWEEN interval '28 days' AND interval '31 days'
              FROM public.privacy_requests WHERE account_id=%s""", (a1,)), cases)
rec("1 Library Pass, Research subscription and purchases are byte-identical after the request",
    snapshot(a1) == before)

# 2 - Duplicate requests: refused, no second case.
r2 = as_user(a1, "SELECT to_jsonb(public.request_account_deletion())")
rec("2 duplicate request is refused and does not open a second case",
    r2[0] == "ERR" and len(deletion_cases(a1)) == 1 and snapshot(a1) == before, r2)
rec("2 anonymous caller cannot request deletion",
    as_role("anon", "SELECT public.request_account_deletion()")[0] == "ERR")

# 3 - Existing JWT after the request: the customer can still read their own
#     records (self-service visibility is intentional), but no other account's.
own = as_user(a1, "SELECT count(*) FROM public.entitlements WHERE product_id=%s", (LIBRARY_PASS,))
other = new_account("other")
grant_library_pass(other)
cross = as_user(a1, "SELECT count(*) FROM public.entitlements WHERE account_id=%s", (other,))
rec("3 pending account's JWT still sees its own Library Pass record (rights on record)",
    own == ("OK", 1), own)
rec("3 pending account's JWT cannot see another account's entitlements", cross == ("OK", 0), cross)
writes = [as_user(a1, sql, (a1,)) for sql in (
    "UPDATE public.entitlements SET state='active' WHERE account_id=%s RETURNING 1",
    "UPDATE public.profiles SET status='active' WHERE account_id=%s RETURNING 1",
    "UPDATE public.privacy_requests SET status='cancelled' WHERE account_id=%s RETURNING 1",
)]
rec("3 pending account cannot rewrite entitlements, its profile status or its privacy case",
    all(w[0] == "ERR" or w[1] is None for w in writes)
    and db("SELECT status::text FROM public.profiles WHERE account_id=%s", (a1,)) == "deletion_pending"
    and deletion_cases(a1)[0]["status"] == "open", writes)

# 4 - Accidental finalizer execution at the SQL layer (live schema).
for role in ("anon", "authenticated"):
    for fn in ("prepare_account_deletion_auth_removal(uuid)", "finalize_account_deletion(uuid)"):
        rec(f"4 {role} cannot execute legacy {fn.split('(')[0]}",
            not db("SELECT has_function_privilege(%s,%s,'EXECUTE')", (role, f"public.{fn}")))
early = as_role("service_role", "SELECT public.finalize_account_deletion(%s)", (a1,))
rec("4 legacy finalization refuses an account still inside its safety period / Auth-linked",
    early[0] == "ERR" and db("SELECT status::text FROM public.profiles WHERE account_id=%s", (a1,)) == "deletion_pending"
    and deletion_cases(a1)[0]["status"] == "open" and snapshot(a1) == before, early)
legacy_grants = [db("SELECT has_function_privilege('service_role',%s,'EXECUTE')", (f"public.{fn}",))
                 for fn in ("prepare_account_deletion_auth_removal(uuid)", "finalize_account_deletion(uuid)")]
rec("4 RESIDUAL (live schema): service_role still holds EXECUTE on both legacy helpers",
    all(legacy_grants), legacy_grants)

# 5 - Owner review queue: read-only, restricted identifiers, no email, and
#     nothing ever deletion-eligible. Combined conditions must all surface.
queue_text = QUEUE_SQL.read_text("utf8")
code_only = re.sub(r"--[^\n]*", "", queue_text)
rec("5 queue file is a single SELECT with no write or DDL keyword",
    not re.search(r"\b(insert|update|delete|merge|truncate|alter|create|drop|grant|revoke|call|copy|do)\b",
                  code_only, re.I)
    and code_only.count(";") == 1 and code_only.strip().lower().startswith("select"))
rec("5 queue header labels identifiers restricted and linkable, never anonymous",
    "linkable personal identifiers" in queue_text and "NOT anonymous" in queue_text)

def pending(tag, sub_state=None, library_pass=False, due_shift=None):
    a = new_account(tag)
    if library_pass:
        grant_library_pass(a)
    if sub_state:
        research_subscription(a, sub_state)
    assert as_user(a, "SELECT public.request_account_deletion()")[0] == "OK"
    if due_shift:
        db(f"UPDATE public.privacy_requests SET due_at=now()+interval '{due_shift}' WHERE account_id=%s", (a,))
    return a

a_fin = pending("fin", "past_due", library_pass=True)
a_disp = pending("dispute", "disputed")
a_due = pending("due", due_shift="-1 day")
a_routine = pending("routine", library_pass=True)
# Combined conditions: deadline pressure must never be masked by finance.
a_due_fin = pending("due-fin", "active", library_pass=True, due_shift="-2 days")
a_soon_disp = pending("soon-dispute", "disputed", due_shift="3 days")
# A flagged case due LATER than an unflagged one: proves priority, not due date alone, drives order.
a_late_fin = pending("late-fin", "past_due", due_shift="45 days")
a_done = pending("done")
db("UPDATE public.privacy_requests SET status='completed', completed_at=now() WHERE account_id=%s", (a_done,))
a_export = new_account("export")
db("""INSERT INTO public.privacy_requests(account_id,email,request_type,status)
      SELECT account_id,email,'export','open' FROM public.profiles WHERE account_id=%s""", (a_export,))
a_mismatch = new_account("mismatch")
db("""INSERT INTO public.privacy_requests(account_id,email,request_type,status,due_at)
      SELECT account_id,email,'deletion','open',now()-interval '5 days'
      FROM public.profiles WHERE account_id=%s""", (a_mismatch,))

with connect() as c:
    c.execute("SET ROLE postgres")
    c.execute("BEGIN TRANSACTION READ ONLY")
    cur = c.execute(queue_text)
    columns = [d.name for d in cur.description]
    rows = [dict(zip(columns, r)) for r in cur.fetchall()]
    c.execute("ROLLBACK")
by_ref = {str(r["account_ref"]): r for r in rows}
q = lambda a: by_ref.get(str(a), {})
flags = lambda a: set(q(a).get("review_flags") or [])

rec("5 queue runs inside a READ ONLY transaction as the owner role", len(rows) >= 8, len(rows))
rec("5 output has no email column and no '@' in any value (identifiers remain restricted)",
    not any("email" in col for col in columns)
    and not any("@" in str(v) for r in rows for v in r.values())
    and all(r["identifier_handling"] == "restricted_linkable_identifier" for r in rows), columns)
rec("5 nothing is ever deletion-eligible; merchant evidence always unknown; blind spots listed",
    all(r["automatic_finalization_allowed"] is False
        and r["deletion_eligibility"] == "not_determined"
        and r["merchant_cessation_evidence"] == "unknown"
        and "open_or_non_expiring_checkouts" in r["unchecked_financial_sources"]
        and "signed_late_or_out_of_order_webhooks" in r["unchecked_financial_sources"] for r in rows))
rec("5 no row is ever labelled routine, cleared, eligible or ready",
    not any(re.search(r"routine|clear|eligible|ready|safe", " ".join(map(str, r.get("review_flags") or [])), re.I)
            for r in rows)
    and "review_class" not in columns)
rec("5 overdue + open Research subscription: BOTH flags, top priority",
    flags(a_due_fin) == {"privacy_overdue", "financial_exception"} and q(a_due_fin).get("review_priority") == 1
    and q(a_due_fin).get("research_open_subscription_states") == ["active"]
    and q(a_due_fin).get("library_pass_entitlement_state") == "active", q(a_due_fin))
rec("5 due within 7 days + dispute: BOTH flags, priority 2",
    flags(a_soon_disp) == {"privacy_due_within_7_days", "financial_exception"}
    and q(a_soon_disp).get("review_priority") == 2
    and q(a_soon_disp).get("research_dispute_states") == ["disputed"], q(a_soon_disp))
rec("5 overdue + state mismatch: BOTH flags, top priority",
    flags(a_mismatch) == {"privacy_overdue", "state_mismatch"} and q(a_mismatch).get("review_priority") == 1
    and q(a_mismatch).get("profile_status") == "active", q(a_mismatch))
rec("5 overdue only: privacy_overdue, negative day count, top priority",
    flags(a_due) == {"privacy_overdue"} and q(a_due).get("review_priority") == 1
    and q(a_due).get("days_until_privacy_due", 0) < 0, q(a_due))
rec("5 past_due Research subscription alone: financial_exception, priority 3; Library Pass preserved",
    flags(a_fin) == {"financial_exception"} and q(a_fin).get("review_priority") == 3
    and q(a_fin).get("research_open_subscription_states") == ["past_due"]
    and q(a_fin).get("library_pass_entitlement_state") == "active", q(a_fin))
rec("5 disputed subscription alone: financial_exception",
    flags(a_disp) == {"financial_exception"}, q(a_disp))
rec("5 the step-1 account (active Research subscription) is a financial exception",
    "financial_exception" in flags(a1), q(a1))
rec("5 no local flag still means NOT eligible: empty flags, priority 4, merchant unknown",
    flags(a_routine) == set() and q(a_routine).get("review_priority") == 4
    and q(a_routine).get("deletion_eligibility") == "not_determined"
    and q(a_routine).get("merchant_cessation_evidence") == "unknown"
    and q(a_routine).get("library_pass_entitlement_state") == "active", q(a_routine))
rec("5 completed deletion cases and non-deletion requests are not listed",
    str(a_done) not in by_ref and str(a_export) not in by_ref)
order = [(r["review_priority"], r["privacy_due_at"]) for r in rows]
pos = {str(r["account_ref"]): i for i, r in enumerate(rows)}
rec("5 ordered by priority (overdue first, then due soon, then flags), then due date",
    order == sorted(order) and rows[0]["review_priority"] == 1
    and q(a_late_fin).get("review_priority") == 3
    and q(a_late_fin)["privacy_due_at"] > q(a_routine)["privacy_due_at"]
    and pos[str(a_late_fin)] < pos[str(a_routine)], [r["review_priority"] for r in rows])
rec("5 running the queue changed nothing (financial records byte-identical)", snapshot(a1) == before)

# 6 - KNOWN RESIDUAL WITNESS (live schema): after the safety period, the
#     legacy SQL path ignores Research billing. If the gated legacy route were
#     ever enabled, an account with an active Research subscription would be
#     finalized and its privacy case marked completed. Interim safety rests
#     on the Production route/approval flags and service_role key custody.
a_w = new_account("witness")
research_subscription(a_w, "active")
assert as_user(a_w, "SELECT public.request_account_deletion()")[0] == "OK"
db("""UPDATE public.profiles SET deletion_due_at=now()-interval '1 minute',
      deletion_requested_at=now()-interval '8 days' WHERE account_id=%s""", (a_w,))
w_case_id = db("SELECT id FROM public.privacy_requests WHERE account_id=%s AND request_type='deletion'", (a_w,))
prep = as_role("service_role", "SELECT public.prepare_account_deletion_auth_removal(%s)", (a_w,))
fin = as_role("service_role", "SELECT public.finalize_account_deletion(%s)", (a_w,))
# Finalization detaches the case from the account, so read it by its own id.
w_status = db("SELECT status::text FROM public.privacy_requests WHERE id=%s", (w_case_id,))
w_sub = db("SELECT state::text FROM public.subscriptions WHERE provider_subscription_id=%s",
           (f"syn-sub-{a_w.hex[:16]}-active",))
rec("6 WITNESS: legacy service_role path finalizes a due account despite an active Research subscription",
    prep[0] == "OK" and fin[0] == "OK" and w_status == "completed" and w_sub == "active",
    f"prepare={prep[0]} finalize={fin[0]} case={w_status} research_subscription={w_sub}")

with admin() as c:
    c.execute(f"DROP DATABASE IF EXISTS {DB} WITH (FORCE)")

total = len(RESULTS)
passed = sum(RESULTS)
print(f"P1_INTERIM_DONE total={total} pass={passed} fail={total - passed}", flush=True)
raise SystemExit(0 if passed == total else 1)
