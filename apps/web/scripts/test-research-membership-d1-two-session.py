#!/usr/bin/env python3
"""D1: ONLY ephemeral Docker Postgres, synthetic data, two independent sessions."""
import concurrent.futures, json, os, queue, subprocess, threading, time, uuid
from pathlib import Path
IMAGE = "postgres:17"
NAME = "usd-impact-d1-" + uuid.uuid4().hex[:12]
SOURCE = Path(__file__).resolve().parents[3] / "docs/operations/research-b3-versioned-receipts-pglite-review-2026-11-04.sql"
PSQL = ["docker","exec","-i",NAME,"psql","-U","postgres","-d","research_d1","-X","-qAt","-v","ON_ERROR_STOP=1"]
V3, H1, H2 = "research-receipt-business-v3", "a"*64, "b"*64
clients = []
results = {}
def call(argv, sql=None, ok=True, timeout=80):
    p = subprocess.run(argv,input=sql,text=True,capture_output=True,timeout=timeout)
    if ok and p.returncode:
        raise AssertionError("Isolated command failed "+repr(argv[:4])+" "+p.stderr[-650:])
    return p
def query(sql,ok=True):
    return call(PSQL,sql+"\n",ok,35)
def sqljson(sql):
    r=query(sql).stdout.strip().splitlines()
    if not r: raise AssertionError("Empty SQL result")
    return json.loads(r[-1])
def begin(event,version=V3,sha=H1):
    return "select research_receipt_review.begin_review_receipt('"+event+"','subscription_created','"+version+"','"+sha+"');"
def finish(rec,status,reason=None):
    code="null" if reason is None else "'"+reason+"'"
    return "select research_receipt_review.finish_review_receipt('"+rec["receipt_id"]+"'::uuid,"+str(rec["attempt_count"])+",'"+rec["lease_token"]+"'::uuid,'"+status+"',"+code+");"
def equal(got,want,label):
    if got != want: raise AssertionError(label+" got="+repr(got)+" want="+repr(want))
class Session:
    def __init__(self,tag):
        self.tag=tag; self.n=0; self.lock=threading.Lock(); self.q=queue.Queue()
        self.p=subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
        threading.Thread(target=self.reader,daemon=True).start()
        clients.append(self)
    def reader(self):
        for line in self.p.stdout: self.q.put(line.strip())
        self.q.put(None)
    def run(self,sql,timeout=25):
        with self.lock:
            self.n+=1
            marker="__D1_END_"+self.tag+"_"+str(self.n)
            self.p.stdin.write(sql.strip()+"\n\\echo "+marker+"\n"); self.p.stdin.flush()
            data=[]; deadline=time.monotonic()+timeout
            while True:
                wait=deadline-time.monotonic()
                if wait<=0: raise AssertionError("Session "+self.tag+" timed out")
                line=self.q.get(timeout=wait)
                if line is None: raise AssertionError("Session "+self.tag+" exited")
                if line==marker: return "\n".join(data).strip()
                if line: data.append(line)
    def json(self,sql): return json.loads(self.run(sql).splitlines()[-1])
    def close(self):
        if self.p.poll() is None:
            try: self.p.stdin.write("\\q\n");self.p.stdin.flush();self.p.wait(timeout=2)
            except Exception: self.p.kill()
def waitblocked(future,label):
    time.sleep(0.3)
    if future.done(): raise AssertionError(label+" did not block")
try:
    if os.getenv("GITHUB_ACTIONS")!="true" or os.getenv("GITHUB_HEAD_REF")!="agent/1103-d1-two-session-postgres-20261104":
        raise AssertionError("D1 allowed only on pinned Draft GitHub runner")
    src=SOURCE.read_text()
    if "REVIEW / OFFLINE TEST ONLY" not in src or "create schema research_receipt_review;" not in src:
        raise AssertionError("Wrong review-only SQL source")
    print("D1 SOURCE pinned Draft #1114 SHA 987a504e2d8920db7b2a2cde3776138c38cdb761",flush=True)
    call(["docker","run","--rm","-d","--network","none","--name",NAME,
          "-e","POSTGRES_PASSWORD=synthetic_d1_only","-e","POSTGRES_DB=research_d1",IMAGE],timeout=150)
    for _ in range(55):
        if call(["docker","exec",NAME,"pg_isready","-U","postgres","-d","research_d1"],ok=False,timeout=5).returncode==0: break
        time.sleep(.3)
    else: raise AssertionError("Disposable PostgreSQL never healthy")
    version=query("show server_version;").stdout.strip()
    major=int(query("select current_setting('server_version_num')::int/10000;").stdout.strip())
    if major<15: raise AssertionError("Real PostgreSQL 15+ required")
    imageid=call(["docker","inspect","--format","{{.Image}}",NAME]).stdout.strip()
    query(src)
    equal(query("select count(*) from pg_namespace where nspname='research_receipt_review';").stdout.strip(),"1","isolation")
    a,b=Session("a"),Session("b")
    pid1,pid2=int(a.run("select pg_backend_pid();")),int(b.run("select pg_backend_pid();"))
    if pid1==pid2: raise AssertionError("Not two distinct real PG backends")
    # T17 committed contender: second client blocks on unique index until first commits.
    a.run("begin;"); first=a.json(begin("d1:commit")); equal(first["disposition"],"acquired","T17 first")
    b.run("begin;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending=pool.submit(b.json,begin("d1:commit"));waitblocked(pending,"T17")
        a.run("commit;");second=pending.result(timeout=20)
    equal(second["disposition"],"in_progress","T17 second");b.run("commit;")
    equal(query("select count(*) from research_receipt_review.receipts where provider_event_id='d1:commit';").stdout.strip(),"1","T17 one row")
    results["T17_committed_claim"]="PASS"
    # T17 rollback contender must acquire rather than silently disappear.
    a.run("begin;");initial=a.json(begin("d1:rollback"));equal(initial["disposition"],"acquired","T17 rollback first")
    b.run("begin;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending=pool.submit(b.json,begin("d1:rollback"));waitblocked(pending,"T17 rollback")
        a.run("rollback;");survivor=pending.result(timeout=20)
    equal(survivor["disposition"],"acquired","T17 rollback survivor");b.run("commit;")
    results["T17_rollback_claim"]="PASS"
    # T18 lease rollover: losing stale finish waits for current writer and may not overwrite.
    old=sqljson(begin("d1:stale"))
    query("update research_receipt_review.receipts set lease_expires_at=transaction_timestamp()-interval '1 second' where id='"+old["receipt_id"]+"'::uuid;")
    fresh=sqljson(begin("d1:stale"));equal(fresh["attempt_count"],2,"T18 attempt")
    a.run("begin;");equal(a.json(finish(fresh,"processed"))["disposition"],"applied","T18 current")
    b.run("begin;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending=pool.submit(b.json,finish(old,"failed","receipt_completion_conflict"))
        waitblocked(pending,"T18 stale finish")
        a.run("commit;");stale=pending.result(timeout=20)
    equal(stale["disposition"],"stale_attempt","T18 reject stale");b.run("commit;")
    equal(sqljson(finish(fresh,"processed"))["disposition"],"already_applied","T18 retry")
    equal(query("select status from research_receipt_review.receipts where id='"+old["receipt_id"]+"'::uuid;").stdout.strip(),"processed","T18 terminal")
    results["T18_stale_finish"]="PASS"
    # T19: failed-paid receipt journal survives retry, destructive statements rejected.
    failed=sqljson(begin("d1:paid"));equal(sqljson(finish(failed,"failed","duplicate_paid_subscription"))["disposition"],"applied","T19 fail")
    count=lambda: int(query("select count(*) from research_receipt_review.conflict_observations where provider_event_id='d1:paid';").stdout.strip())
    equal(count(),1,"T19 initial journal");retry=sqljson(begin("d1:paid"))
    equal(retry["attempt_count"],2,"T19 retry")
    equal(sqljson(finish(retry,"processed"))["disposition"],"applied","T19 process")
    equal(count(),1,"T19 retained")
    for stmt in ["update research_receipt_review.conflict_observations set conflict_code='foreign_invoice';",
                 "delete from research_receipt_review.conflict_observations;",
                 "truncate research_receipt_review.resolution_observations;"]:
        if query(stmt,ok=False).returncode==0: raise AssertionError("T19 mutation succeeded")
    results["T19_journal"]="PASS_PARTIAL_no_killed_worker"
    # V1: version, semantic and unknown-version conflicts leave terminal unchanged.
    done=sqljson(begin("d1:v1"));equal(sqljson(finish(done,"processed"))["disposition"],"applied","V1 settled")
    equal(sqljson(begin("d1:v1",V3,H2))["disposition"],"semantic_conflict","V1 hash")
    equal(sqljson(begin("d1:v1","research-receipt-business-v2",H2))["disposition"],"version_mismatch","V1 version")
    equal(sqljson(begin("d1:unknown","research-receipt-business-v99",H2))["disposition"],"unsupported_version","V1 unknown")
    conflict=set(query("select distinct conflict_code from research_receipt_review.conflict_observations where provider_event_id in ('d1:v1','d1:unknown');").stdout.strip().splitlines())
    if not {"semantic_payload_conflict","fingerprint_version_mismatch","fingerprint_version_unknown"}.issubset(conflict):
        raise AssertionError("V1 conflict journal incomplete "+repr(conflict))
    equal(query("select status from research_receipt_review.receipts where provider_event_id='d1:v1';").stdout.strip(),"processed","V1 terminal stable")
    results["V1_version_conflict"]="PASS"
    results.update({"server_version":version,"image_sha":imageid,"distinct_pids":[pid1,pid2],
                    "T13_payment_binding":"NOT_IMPLEMENTED","T20_signed_provider":"NOT_TESTED",
                    "T21_T22_library_pass":"NOT_TESTED","D2_writer_roles":"HOLD"})
    print("D1_REAL_TWO_SESSION_EVIDENCE "+json.dumps(results,sort_keys=True),flush=True)
finally:
    for c in clients: c.close()
    try:
        call(["docker","rm","-f",NAME],ok=False,timeout=25)
        print("D1_CONTAINER_REMOVED no persistent database and no network ports",flush=True)
    except Exception as err: print("D1_CLEANUP_WARNING "+str(err),flush=True)
