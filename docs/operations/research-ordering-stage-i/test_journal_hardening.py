#!/usr/bin/env python3
"""Stage I: red-to-green journal security probes on a disposable PG17 only."""
import concurrent.futures
import os
from pathlib import Path
import sys
import threading

import psycopg

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "docs" / "operations" / "research-ordering-stage-c"))
from test_real_schema_ordering import bootstrap, db, seed

for key in ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_DB_URL",
            "LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_WEBHOOK_SECRET"):
    assert not os.getenv(key), f"remote provider/database credential forbidden: {key}"
assert os.getenv("PGHOST") == "127.0.0.1"
assert os.getenv("PGDATABASE") == "ci_review"
assert os.getenv("PGUSER") == "ci_research"
assert os.getenv("PGPASSWORD") == "synthetic-stage-c-review-only"

H_SQL = ROOT / "docs" / "operations" / "research-ordering-stage-h" / "receipt_journal_review.sql"
I_SQL = HERE / "journal_hardening_review.sql"
CALL = "SELECT research_ordering_stage_h.hold_evidence(%s,%s,%s,%s,%s)"

def args(key, digest="1"*64):
    return (key, "a"*64, "2026-11-05T01:02:03.123456Z",
            "2026-11-05T01:02:04.123456Z", digest)

def snapshot(c, account):
    return (
        c.execute("SELECT row_to_json(s)::text FROM public.subscriptions s WHERE account_id=%s",
                  (account,)).fetchall(),
        c.execute("SELECT row_to_json(e)::text FROM public.entitlements e "
                  "WHERE account_id=%s ORDER BY product_id", (account,)).fetchall(),
        c.execute("SELECT count(*) FROM public.subscription_events").fetchone()[0],
        c.execute("SELECT count(*) FROM public.entitlement_events").fetchone()[0],
    )

def denied(c, sql, params=None, expected=("42501",)):
    try:
        c.execute(sql, params)
    except psycopg.Error as exc:
        assert exc.sqlstate in expected, (sql, exc.sqlstate, str(exc))
        return
    raise AssertionError(f"unauthorized operation unexpectedly succeeded: {sql}")

def receipt(c, key):
    return c.execute(
        "SELECT signed_delivery_hash,candidate_digest,disposition "
        "FROM research_ordering_stage_h.pending_receipts WHERE event_key=%s",
        (key,)).fetchone()

def audit_count(c, key):
    return c.execute(
        "SELECT count(*) FROM research_ordering_stage_h.receipt_audit WHERE event_key=%s",
        (key,)).fetchone()[0]

def assert_no_table_permissions(c, role):
    for table in ("pending_receipts", "receipt_audit"):
        for op in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES"):
            assert c.execute(
                "SELECT has_table_privilege(%s,%s,%s)",
                (role, "research_ordering_stage_h." + table, op)
            ).fetchone()[0] is False, (role, table, op)

with db() as c:
    assert c.execute("SHOW server_version_num").fetchone()[0] == "170006"
    bootstrap(c)
    account, _sid, _eid = seed(c, 35, library=True)
    original_public = snapshot(c, account)
    c.execute(H_SQL.read_text("utf8"))

    key = "payment_success:stage-i-baseline"
    assert c.execute(CALL, args(key)).fetchone()[0]["action"] == "candidate_held"
    assert c.execute(CALL, args(key, "2"*64)).fetchone()[0]["action"] == "conflict_quarantined"
    assert receipt(c, key)[2] == "quarantined_conflict"
    assert audit_count(c, key) == 2

    # RED evidence: demonstrate exact Stage H gaps in a rolled-back transaction.
    # This is a disposable CI database, never a connected project.
    c.execute("BEGIN")
    try:
        c.execute("UPDATE research_ordering_stage_h.pending_receipts "
                  "SET disposition='pending_reconciliation' WHERE event_key=%s", (key,))
        assert receipt(c, key)[2] == "pending_reconciliation", "Stage H downgrade gap not reproduced"
        c.execute("DELETE FROM research_ordering_stage_h.pending_receipts WHERE event_key=%s", (key,))
        assert receipt(c, key) is None, "Stage H receipt DELETE gap not reproduced"
        c.execute("TRUNCATE research_ordering_stage_h.receipt_audit")
        assert audit_count(c, key) == 0, "Stage H audit TRUNCATE gap not reproduced"
        c.execute("TRUNCATE research_ordering_stage_h.pending_receipts")
    finally:
        c.execute("ROLLBACK")
    assert receipt(c, key)[2] == "quarantined_conflict"
    assert audit_count(c, key) == 2
    assert snapshot(c, account) == original_public
    print("STAGE_I_RED_PASS original Stage H downgrade, DELETE and TRUNCATE gaps reproduced and rolled back", flush=True)

    c.execute(I_SQL.read_text("utf8"))
    assert receipt(c, key)[2] == "quarantined_conflict"
    assert audit_count(c, key) == 2
    assert c.execute("SELECT to_regclass('research_ordering_stage_h.receipt_audit')").fetchone()[0] is not None

    for role in ("anon", "authenticated", "service_role", "research_stage_i_observer"):
        assert c.execute("SELECT has_schema_privilege(%s,%s,'USAGE')",
                         (role, "research_ordering_stage_h")).fetchone()[0] is False
        assert_no_table_permissions(c, role)
    assert c.execute("SELECT has_schema_privilege('research_stage_i_writer',"
                     "'research_ordering_stage_h','USAGE')").fetchone()[0] is True
    assert_no_table_permissions(c, "research_stage_i_writer")
    assert c.execute(
        "SELECT has_function_privilege('research_stage_i_writer',"
        "'research_ordering_stage_h.hold_evidence(text,text,text,text,text)','EXECUTE')"
    ).fetchone()[0] is True
    assert c.execute(
        "SELECT has_function_privilege('service_role',"
        "'research_ordering_stage_h.hold_evidence(text,text,text,text,text)','EXECUTE')"
    ).fetchone()[0] is False
    assert c.execute(
        "SELECT rolcanlogin,rolbypassrls FROM pg_roles WHERE rolname='research_stage_i_owner'"
    ).fetchone() == (False, False)
    assert c.execute(
        "SELECT prosecdef FROM pg_proc WHERE oid="
        "'research_ordering_stage_h.hold_evidence(text,text,text,text,text)'::regprocedure"
    ).fetchone()[0] is True

with db() as writer:
    writer.execute("SET ROLE research_stage_i_writer")
    key2 = "payment_success:stage-i-writer"
    a = writer.execute(CALL, args(key2)).fetchone()[0]
    b = writer.execute(CALL, args(key2)).fetchone()[0]
    d = writer.execute(CALL, args(key2, "3"*64)).fetchone()[0]
    repeat = writer.execute(CALL, args(key2)).fetchone()[0]
    assert [a["action"], b["action"], d["action"], repeat["action"]] == [
        "candidate_held", "duplicate_held", "conflict_quarantined", "duplicate_held"
    ], (a, b, d, repeat)
    assert all(x["can_mutate"] is False for x in (a, b, d, repeat))
    assert d["disposition"] == repeat["disposition"] == "quarantined_conflict"
    for sql in (
        "UPDATE research_ordering_stage_h.pending_receipts "
        "SET disposition='pending_reconciliation' WHERE event_key='payment_success:stage-i-writer'",
        "UPDATE research_ordering_stage_h.pending_receipts "
        "SET disposition='quarantined_conflict' WHERE event_key='payment_success:stage-i-writer'",
        "DELETE FROM research_ordering_stage_h.pending_receipts",
        "TRUNCATE research_ordering_stage_h.pending_receipts",
        "DELETE FROM research_ordering_stage_h.receipt_audit",
        "TRUNCATE research_ordering_stage_h.receipt_audit",
        "INSERT INTO research_ordering_stage_h.receipt_audit(event_key,action,observed_digest) "
        "VALUES('payment_success:stage-i-writer','duplicate_held','" + "1"*64 + "')",
        "ALTER TABLE research_ordering_stage_h.pending_receipts DISABLE TRIGGER ALL",
    ):
        denied(writer, sql)
    print("STAGE_I_WRITER_PASS only non-mutating hold_evidence permitted, direct DML/DDL denied", flush=True)

with db() as legacy:
    legacy.execute("SET ROLE service_role")
    denied(legacy, CALL, args("payment_success:legacy"))
with db() as observer:
    observer.execute("SET ROLE research_stage_i_observer")
    denied(observer, CALL, args("payment_success:observer"))

with db() as owner:
    # Deliberately emulate the NOLOGIN table owner via CI superuser SET ROLE.
    # Trigger protections must still reject direct erasure/downgrade, but a
    # real table owner/superuser could disable triggers; that residual stays HOLD.
    owner.execute("SET ROLE research_stage_i_owner")
    for sql in (
        "UPDATE research_ordering_stage_h.pending_receipts "
        "SET disposition='pending_reconciliation' "
        "WHERE event_key='payment_success:stage-i-writer'",
        "DELETE FROM research_ordering_stage_h.pending_receipts",
        "DELETE FROM research_ordering_stage_h.receipt_audit",
        "TRUNCATE research_ordering_stage_h.receipt_audit",
    ):
        denied(owner, sql)
    # A single-table TRUNCATE can fail first on FK 0A000; prove the trigger
    # independently by naming both related tables in the same TRUNCATE.
    denied(owner, "TRUNCATE research_ordering_stage_h.pending_receipts", expected=("0A000", "42501"))
    denied(owner, "TRUNCATE research_ordering_stage_h.pending_receipts, research_ordering_stage_h.receipt_audit")
    denied(owner,
           "INSERT INTO research_ordering_stage_h.receipt_audit"
           "(event_key,action,observed_digest) VALUES(%s,%s,%s)",
           ("payment_success:orphan", "candidate_held", "1"*64),
           expected=("23503",))
    print("STAGE_I_OWNER_TRIGGERS_PASS DELETE/TRUNCATE/downgrade/orphan rejected", flush=True)

barrier = threading.Barrier(2)
def worker(_):
    with db() as c:
        c.execute("SET ROLE research_stage_i_writer")
        barrier.wait(timeout=10)
        return c.execute(CALL, args("payment_success:stage-i-two-backends")).fetchone()[0]

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(worker, (1, 2)))
assert sorted(x["action"] for x in results) == ["candidate_held", "duplicate_held"], results
assert all(x["can_mutate"] is False for x in results)

with db() as c:
    assert audit_count(c, "payment_success:stage-i-two-backends") == 2
    assert receipt(c, "payment_success:stage-i-two-backends")[2] == "pending_reconciliation"
    assert audit_count(c, "payment_success:stage-i-writer") == 4
    assert receipt(c, "payment_success:stage-i-writer")[2] == "quarantined_conflict"
    assert snapshot(c, account) == original_public, "Research or purchase-backed Library Pass changed"
    assert c.execute("SELECT has_table_privilege('service_role','public.entitlements','UPDATE')").fetchone()[0]
    assert c.execute("SELECT count(*) FROM public.entitlements WHERE account_id=%s",
                     (account,)).fetchone()[0] == 2
print("RESEARCH_STAGE_I_PG17_REVIEW_PASS isolated hardening+two-backend journal, public legacy service_role bypass still OPEN", flush=True)
