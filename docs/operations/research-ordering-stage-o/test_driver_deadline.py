#!/usr/bin/env python3
"""Stage O: external driver CANCEL despite session-overridden PG timeouts.

Only disposable loopback PostgreSQL 17.6. A successful CANCEL is NOT proof
of a hard timeout during a TCP partition or provider API atomicity.
"""
import concurrent.futures
import os
import threading
import time

import psycopg

LIVE_ENV=(
    "DATABASE_URL","SUPABASE_URL","SUPABASE_DB_URL","LEMON_SQUEEZY_API_KEY",
    "LEMON_SQUEEZY_WEBHOOK_SECRET","SUPABASE_SERVICE_ROLE_KEY",
    "LEMON_SQUEEZY_STORE_ID",
)
for key in LIVE_ENV:
    assert not os.getenv(key), f"connected DB or provider env forbidden: {key}"
assert (os.getenv("PGHOST"),os.getenv("PGDATABASE"),os.getenv("PGUSER"),os.getenv("PGPASSWORD")) == (
    "127.0.0.1","ci_review","ci_research","synthetic-stage-c-review-only"
)

def conn(role="ci_research",password=None,autocommit=True):
    return psycopg.connect(
        host="127.0.0.1",port=5432,dbname="ci_review",
        user=role,password=password or "synthetic-stage-c-review-only",
        connect_timeout=5,autocommit=autocommit
    )

def cancelled_external(c,sql,timeout=3):
    started=threading.Event()
    def run():
        started.set()
        try:
            c.execute(sql)
            return "unexpected_success"
        except psycopg.Error as exc:
            return exc.sqlstate
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(run)
        assert started.wait(timeout=2),"worker never began"
        time.sleep(0.30)
        assert not future.done(), "query completed before external cancellation"
        t=time.monotonic()
        # Real watchdog/controller action, NOT a login role default.
        c.cancel()
        result=future.result(timeout=timeout)
        elapsed=time.monotonic()-t
        assert result=="57014",(result,elapsed)
        assert elapsed<timeout,(result,elapsed)
    assert c.execute("SELECT 1").fetchone()[0]==1
    return elapsed

with conn() as admin:
    assert admin.execute("SHOW server_version_num").fetchone()[0]=="170006"
    admin.execute("""CREATE ROLE stage_o_deadline_guest LOGIN NOINHERIT
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION
        PASSWORD 'synthetic-stage-o-deadline-only';
        ALTER ROLE stage_o_deadline_guest SET statement_timeout='1s';
        ALTER ROLE stage_o_deadline_guest SET lock_timeout='1s';
        CREATE TABLE stage_o_guarded_row(id integer primary key, val integer not null);
        INSERT INTO stage_o_guarded_row VALUES (1,0);
        GRANT SELECT, UPDATE ON stage_o_guarded_row TO stage_o_deadline_guest;""")
    assert admin.execute("SELECT rolcanlogin,rolbypassrls FROM pg_roles "
       "WHERE rolname='stage_o_deadline_guest'").fetchone()==(True,False)

with conn("stage_o_deadline_guest","synthetic-stage-o-deadline-only") as guest:
    assert guest.execute("SHOW statement_timeout").fetchone()[0]=="1s"
    assert guest.execute("SHOW lock_timeout").fetchone()[0]=="1s"
    guest.execute("SET statement_timeout=0")
    guest.execute("SET lock_timeout=0")
    assert guest.execute("SHOW statement_timeout").fetchone()[0]=="0"
    assert guest.execute("SHOW lock_timeout").fetchone()[0]=="0"
    elapsed=cancelled_external(guest,"SELECT pg_sleep(8)")
    print("STAGE_O_K1_SESSION_OVERRIDE_AND_DRIVER_CANCEL_PASS "
          f"PG role timeout disabled; external CANCEL in {elapsed:.3f}s",flush=True)

with conn(autocommit=False) as holder:
    holder.execute("SELECT id FROM stage_o_guarded_row WHERE id=1 FOR UPDATE")
    with conn("stage_o_deadline_guest","synthetic-stage-o-deadline-only") as guest:
        guest.execute("SET statement_timeout=0")
        guest.execute("SET lock_timeout=0")
        elapsed=cancelled_external(
            guest,"SELECT id FROM stage_o_guarded_row WHERE id=1 FOR UPDATE")
        assert holder.execute("SELECT val FROM stage_o_guarded_row WHERE id=1").fetchone()[0]==0
        print("STAGE_O_K1_LOCK_CANCEL_PASS "
              f"held row lock interrupted in {elapsed:.3f}s without DML",flush=True)
    holder.rollback()

with conn() as admin:
    assert admin.execute("SELECT val FROM stage_o_guarded_row WHERE id=1").fetchone()[0]==0
    assert admin.execute("SELECT COUNT(*) FROM stage_o_guarded_row").fetchone()[0]==1
    # Simulated privileged-owner bypass remains possible; no false "hard bound".
    assert admin.execute("SELECT rolbypassrls FROM pg_roles WHERE "
       "rolname='stage_o_deadline_guest'").fetchone()[0] is False

print("RESEARCH_STAGE_O_EXTERNAL_CANCEL_SYNTHETIC_PASS; "
      "NOT a hard network-partition deadline, not a merchant or Production operation",flush=True)
