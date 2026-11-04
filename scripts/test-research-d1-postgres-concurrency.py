#!/usr/bin/env python3
"""D1 isolated REAL PostgreSQL two-session proof for Research B-3 review schema.

This does NOT exercise live Supabase, real checkout, service_role privilege
grants, the actual Research binding RPC, or Production entitlement state.
No network outside local GitHub Actions ephemeral PostgreSQL is permitted.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import threading
import time

import psycopg

HOST = os.environ.get("PGHOST")
PORT = os.environ.get("PGPORT")
DB = os.environ.get("PGDATABASE")
USER = os.environ.get("PGUSER")
PASS = os.environ.get("PGPASSWORD")
SQL_FILE = (Path(__file__).resolve().parent.parent / "docs/operations" /
            "research-b3-versioned-receipts-pglite-review-2026-11-04.sql")

def require_safe_ci():
    assert os.environ.get("CI") == "true", "Must run in isolated CI"
    assert os.environ.get("GITHUB_ACTIONS") == "true", "GitHub Actions only"
    assert (HOST, PORT, DB, USER, PASS) == (
        "127.0.0.1", "5432", "ci_review", "ci_research", "ci_fixture_only_password"
    ), "Only pinned localhost synthetic database is authorized"
    text = SQL_FILE.read_text()
    assert "REVIEW / OFFLINE TEST ONLY" in text
    assert "create schema research_receipt_review;" in text
    assert "create schema research_private;" not in text
    assert "supabase_url" not in text.lower()
    return text

def conn():
    return psycopg.connect(host=HOST, port=int(PORT), dbname=DB, user=USER,
                           password=PASS, connect_timeout=5, autocommit=True)

def scalar(c, statement, args=()):
    with c.cursor() as cursor:
        cursor.execute(statement, args)
        record=cursor.fetchone()
        return record[0] if record else None

def receipt(c, event_id, version="research-receipt-business-v3", hash_value=None):
    digest = hash_value if hash_value is not None else "a"*64
    return scalar(c,
        "select research_receipt_review.begin_review_receipt(%s,%s,%s,%s)",
        (event_id, "subscription_created", version, digest))

def finish(c, row, status, error_code=None):
    return scalar(c,
        "select research_receipt_review.finish_review_receipt(%s::uuid,%s,%s::uuid,%s,%s)",
        (row["receipt_id"], row["attempt_count"], row["lease_token"],
         status, error_code))

def observations(c, event_id):
    with c.cursor() as cur:
        cur.execute("""select conflict_code, attempt_count, fingerprint_version
            from research_receipt_review.conflict_observations
            where provider_event_id=%s order by observed_at, id""",(event_id,))
        return cur.fetchall()

def assert_denied(operation, accepted):
    try:
        operation()
    except psycopg.Error as error:
        assert any(phrase in str(error).lower() for phrase in accepted), str(error)
        return
    raise AssertionError("Expected review journal mutation to be refused")

def test_t17_two_session_lock(a, b, watcher):
    event = "d1-t17-two-session"
    # A explicitly opens and holds its transaction containing an INSERT.
    # The second independent connection must block on the unique index until
    # A commits. This is an actual PostgreSQL lock wait, not a mock.
    a.execute("BEGIN")
    first = receipt(a,event)
    assert first["disposition"] == "acquired", first
    b_pid = scalar(b,"select pg_backend_pid()")
    started = threading.Event()

    def second_begin():
        started.set()
        return receipt(b,event)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(second_begin)
        assert started.wait(timeout=3)
        observed_lock=False
        until=time.monotonic()+7
        try:
            while time.monotonic()<until:
                wait=scalar(watcher,
                    "select wait_event_type from pg_stat_activity where pid=%s",
                    (b_pid,))
                if wait == "Lock":
                    observed_lock=True
                    break
                if future.done():
                    break
                time.sleep(0.08)
        finally:
            a.execute("COMMIT")
        second = future.result(timeout=8)

    assert observed_lock, "T17: expected actual competing PostgreSQL lock wait"
    assert second["disposition"] == "in_progress", second
    assert first["attempt_count"] == 1
    assert scalar(watcher,
        "select attempt_count from research_receipt_review.receipts where provider_event_id=%s",
        (event,)) == 1
    print("PASS T17: two separate PostgreSQL sessions; lock wait observed; only one lease")

def test_t18_stale_finish_race(a,b,c):
    event="d1-t18-competitor-finish"
    first=receipt(a,event)
    assert first["disposition"] == "acquired"
    # Time shift is a test-only direct SQL change in ephemeral review schema.
    c.execute("""update research_receipt_review.receipts
        set lease_expires_at=transaction_timestamp()-interval '1 second'
        where id=%s""",(first["receipt_id"],))
    second=receipt(b,event)
    assert second["disposition"]=="acquired" and second["attempt_count"]==2
    assert second["lease_token"]!=first["lease_token"]

    start=threading.Barrier(3)
    def finish_old():
        start.wait()
        return finish(a,first,"failed","receipt_completion_conflict")
    def finish_current():
        start.wait()
        return finish(b,second,"processed")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        old=pool.submit(finish_old)
        new=pool.submit(finish_current)
        start.wait(timeout=5)
        result_old=old.result(timeout=10)
        result_new=new.result(timeout=10)
    assert result_old["disposition"]=="stale_attempt", result_old
    assert result_new["disposition"]=="applied", result_new
    assert finish(b,second,"processed")["disposition"]=="already_applied"
    row=scalar(c,
        "select status from research_receipt_review.receipts where id=%s",
        (first["receipt_id"],))
    assert row=="processed", row
    print("PASS T18: competing PostgreSQL sessions; stale finish denied, exact finish idempotent")

def test_t19_crash_and_immutable_journal(b,c):
    event="d1-t19-crash-after-commit"
    crashed=conn()
    try:
        first=receipt(crashed,event)
        assert first["disposition"]=="acquired"
        # Commit append-only evidence in its own autocommit transaction.
        crashed.execute("""insert into research_receipt_review.conflict_observations(
          receipt_id,provider,provider_event_id,fingerprint_version,
          fingerprint_sha256,conflict_code,attempt_count)
          values (%s,'lemon-squeezy-research',%s,%s,%s,%s,%s)""",
          (first["receipt_id"],event,"research-receipt-business-v3",
           "a"*64,"duplicate_paid_subscription",1))
        before=observations(c,event)
        assert len(before)==1
        pid=scalar(crashed,"select pg_backend_pid()")
        assert scalar(c,"select pg_terminate_backend(%s)",(pid,)) is True
        # Reconnect via another session after simulated time expiry.
        c.execute("""update research_receipt_review.receipts
            set lease_expires_at=transaction_timestamp()-interval '1 second'
            where id=%s""",(first["receipt_id"],))
        second=receipt(b,event)
        assert second["disposition"]=="acquired" and second["attempt_count"]==2
        assert finish(b,second,"processed")["disposition"]=="applied"
        assert observations(c,event)==before, "Original failure evidence lost"

        assert_denied(
          lambda: c.execute("""update research_receipt_review.conflict_observations
                      set conflict_code='foreign_invoice'"""),
          ["append-only"])
        assert_denied(
          lambda: c.execute("delete from research_receipt_review.conflict_observations"),
          ["append-only"])
        assert_denied(
          lambda: c.execute("truncate research_receipt_review.conflict_observations"),
          ["append-only","cannot truncate a table referenced in a foreign key"])
        assert observations(c,event)==before
        print("PASS T19: independent PG session terminated, committed evidence survived; journal mutations refused")
    finally:
        try: crashed.close()
        except psycopg.Error: pass

def test_version_and_replay(a,b):
    event="d1-v1-version-lookup"
    row=receipt(a,event,version="research-receipt-business-v1",hash_value="b"*64)
    assert row["disposition"]=="acquired"
    assert receipt(b,event,version="research-receipt-business-v3",
                   hash_value="c"*64)["disposition"]=="version_mismatch"
    assert receipt(b,event,version="research-receipt-business-v1",
                   hash_value="d"*64)["disposition"]=="semantic_conflict"
    assert receipt(b,event,version="research-receipt-business-v1",
                   hash_value="b"*64)["disposition"]=="in_progress"
    assert finish(a,row,"processed")["disposition"]=="applied"
    assert receipt(b,event,version="research-receipt-business-v3",
                   hash_value="c"*64)["disposition"]=="version_mismatch"
    assert receipt(b,event,version="research-receipt-business-v1",
                   hash_value="d"*64)["disposition"]=="semantic_conflict"
    assert receipt(b,event,version="research-receipt-business-v1",
                   hash_value="b"*64)["disposition"]=="terminal_duplicate"
    assert receipt(b,"d1-unknown-version",version="research-receipt-business-v99",
                   hash_value="f"*64)["disposition"]=="unsupported_version"
    codes=[x[0] for x in observations(b,event)]
    assert "fingerprint_version_mismatch" in codes
    assert "semantic_payload_conflict" in codes
    print("PASS V1/T7-T8: stored v1 vs v3, terminal semantic mismatches, unknown version")

def test_t20_retry_with_business_identical_delivery(a,b):
    # This tests SQL receiving a repeat of the *same hash*. It does not prove
    # Lemon Squeezy actually rotates portal URLs. The JS suite covers that.
    event="d1-t20-same-business-hash"
    row=receipt(a,event)
    assert finish(a,row,"failed","provider_reconciliation_needed")["disposition"]=="applied"
    retry=receipt(b,event)
    assert retry["disposition"]=="acquired" and retry["attempt_count"]==2
    assert finish(b,retry,"processed")["disposition"]=="applied"
    assert any(x[0]=="provider_reconciliation_needed" for x in observations(b,event))
    print("PASS T20 contract: exact same business hash retried; no claim of provider signed-URL behavior")

def main():
    schema = require_safe_ci()
    with conn() as setup:
        setup.execute(schema)
    with conn() as a, conn() as b, conn() as watcher:
        assert scalar(a,"show transaction_isolation")=="read committed"
        assert scalar(b,"show transaction_isolation")=="read committed"
        assert scalar(watcher,"select current_database()")=="ci_review"
        assert scalar(watcher,"show server_version_num") is not None
        test_t17_two_session_lock(a,b,watcher)
        test_t18_stale_finish_race(a,b,watcher)
        test_t19_crash_and_immutable_journal(b,watcher)
        test_version_and_replay(a,b)
        test_t20_retry_with_business_identical_delivery(a,b)

    print("PASS D1 ephemeral REAL PostgreSQL two-connection prototype T17/T18/T19/V1/T20;")
    print("NOT VERIFIED: T13 actual paid binding, T21/T22 actual Library Pass,")
    print("D2 real Supabase roles/grants, Production migrations, provider charges, refunds.")

if __name__=="__main__":
    main()
