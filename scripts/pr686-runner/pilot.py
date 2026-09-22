"""Reduced-schema real-storage pilot, not the original 30-group acceptance suite."""
import base64, ctypes, hashlib, hmac, http.client, json, os, pathlib, selectors, socket, subprocess, time, uuid
P=pathlib.Path; ROOT=P('/work'); PID=None; rest=None; db=None; competitor=None; records=[]; active=[]
EMAIL='00000000-0000-4000-8000-000000000686'; ROW='00000000-0000-4000-8000-000000000001'
now_ms=int(time.time()*1000); secret=os.urandom(32).hex(); total_requests=0
report={'kind':'REDUCED_SCHEMA_REAL_STORAGE_PILOT','sourceHead':'78b3bc98f4abebc061a4e2a07c8f1881981ff858','original30GroupAcceptance':'NOT_COMPLETED','hostedCompatibility':'NOT_VERIFIED','releaseAuthorized':False,'cases':records,'cleanupVerified':False}
def need(value,why):
 if not value: raise RuntimeError(why)
def command(args,timeout=10):
 r=subprocess.run(args,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=timeout,env={'PATH':'/usr/local/bin:/usr/local/pgsql/bin:/usr/bin:/bin','LANG':'C','HOME':'/work'},close_fds=True)
 need(r.returncode==0,'COMMAND_FAILED:'+args[0]+':'+r.stderr[-1500:]);return r.stdout
lib=ctypes.CDLL('/usr/local/pgsql/lib/libpq.so.5')
for name,result,args in [('PQconnectdb',ctypes.c_void_p,[ctypes.c_char_p]),('PQstatus',ctypes.c_int,[ctypes.c_void_p]),('PQbackendPID',ctypes.c_int,[ctypes.c_void_p]),('PQexec',ctypes.c_void_p,[ctypes.c_void_p,ctypes.c_char_p]),('PQresultStatus',ctypes.c_int,[ctypes.c_void_p]),('PQntuples',ctypes.c_int,[ctypes.c_void_p]),('PQnfields',ctypes.c_int,[ctypes.c_void_p]),('PQgetvalue',ctypes.c_char_p,[ctypes.c_void_p,ctypes.c_int,ctypes.c_int]),('PQgetisnull',ctypes.c_int,[ctypes.c_void_p,ctypes.c_int,ctypes.c_int]),('PQresultErrorMessage',ctypes.c_char_p,[ctypes.c_void_p]),('PQclear',None,[ctypes.c_void_p]),('PQfinish',None,[ctypes.c_void_p])]:
 f=getattr(lib,name);f.restype=result;f.argtypes=args
class Pg:
 def __init__(self):
  self.c=lib.PQconnectdb(b'host=/work/sock dbname=postgres user=postgres connect_timeout=2');need(self.c and lib.PQstatus(self.c)==0,'LOCAL_DB_CONNECT');self.pid=lib.PQbackendPID(self.c)
 def query(self,sql):
  r=lib.PQexec(self.c,sql.encode());need(r,'PQEXEC_NULL')
  try:
   need(lib.PQresultStatus(r) in (1,2),'SQL_FAILED:'+lib.PQresultErrorMessage(r).decode())
   return [[None if lib.PQgetisnull(r,i,j) else lib.PQgetvalue(r,i,j).decode() for j in range(lib.PQnfields(r))] for i in range(lib.PQntuples(r))]
  finally:lib.PQclear(r)
 def close(self):lib.PQfinish(self.c)
def jwt(role):
 enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).decode().rstrip('=')
 p=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'exp':int(time.time())+600});return p+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),p.encode(),hashlib.sha256).digest()).decode().rstrip('=')
def fixture(status='accepted',duplicate=False,missing=False):
 db.query('TRUNCATE public.notification_outbox,public.webhook_receipts')
 if not missing:
  db.query(f"INSERT INTO notification_outbox(id,provider,provider_message_ref,status,state_version) VALUES ('{ROW}','resend','{EMAIL}','{status}',7)")
  if duplicate:db.query(f"INSERT INTO notification_outbox(provider,provider_message_ref,status,state_version) VALUES ('resend','{EMAIL}','{status}',7)")
def current():return db.query('SELECT status,error_code,state_version FROM notification_outbox ORDER BY id')
def invoke(kind='email.delivered',baseline=False,hook=None,event_id=None):
 global total_requests
 need(len(active)<2,'WORKER_CAP')
 err=open('/work/worker-error.log','ab')
 p=subprocess.Popen(['/usr/local/bin/node','/packet/worker.mjs'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1,close_fds=True,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work','LANG':'C','UV_USE_IO_URING':'0'})
 active.append(p); transcript=[];patches=0;selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ);deadline=time.monotonic()+30
 send=lambda d:(p.stdin.write(json.dumps(d)+'\n'),p.stdin.flush())
 send({'jwt':jwt('service_role'),'nowMs':now_ms,'type':kind,'eventId':event_id or 'msg_'+uuid.uuid4().hex,'emailId':EMAIL,'baseline':baseline})
 try:
  while True:
   need(time.monotonic()<deadline and selector.select(max(.01,deadline-time.monotonic())),'WORKER_DEADLINE')
   line=p.stdout.readline();need(line,'WORKER_EOF');e=json.loads(line)
   if e['phase']=='done':
    need(p.wait(timeout=2)==0,'WORKER_EXIT');total_requests+=e['requests'];need(total_requests<=500,'HTTP_CAP');return {'callback':e,'transcript':transcript,'patches':patches,'final':current()}
   need(e['phase'] in ('before','after'),'WORKER_ERROR');transcript.append(e)
   if e['phase']=='before' and e['path']=='/rest/v1/notification_outbox' and e['method']=='PATCH':patches+=1
   if hook:hook(e,patches,p,send)
   else:send({'action':'go'})
 finally:
  if p.poll() is None:p.kill();p.wait(timeout=2)
  active.remove(p);selector.close();p.stdin.close();p.stdout.close();err.close()
def case(name,fn):
 need(time.monotonic()-started<300,'PILOT_BATCH_CAP');value=fn();records.append({'name':name,'evidence':value});print(json.dumps({'case':name,'outcome':'RECORDED'}),flush=True)
def race(mode,baseline=False,kind='email.delivered',initial='accepted',winner='complained',error='RESEND_COMPLAINT'):
 fixture(initial);changed=False;wait=None
 def hook(e,patches,p,send):
  nonlocal changed,wait
  if e['phase']=='before' and e['path']=='/rest/v1/notification_outbox' and e['method']=='PATCH' and not changed:
   changed=True
   competitor.query(f"BEGIN; UPDATE notification_outbox SET status='{winner}',error_code={'NULL' if error is None else chr(39)+error+chr(39)} WHERE id='{ROW}'")
   if mode=='committed':competitor.query('COMMIT');send({'action':'go'})
   else:
    send({'action':'go'});end=time.monotonic()+1.5
    while time.monotonic()<end:
     rows=db.query(f"SELECT pid,wait_event_type,wait_event FROM pg_stat_activity WHERE {competitor.pid}=ANY(pg_blocking_pids(pid))")
     if rows:wait={'blocked':rows,'blocker':competitor.pid};break
     time.sleep(.01)
    need(wait,'LOCK_WAIT_NOT_OBSERVED');competitor.query('ROLLBACK' if mode=='rollback' else 'COMMIT')
  else:send({'action':'go'})
 result=invoke(kind,baseline,hook);result['wait']=wait
 expected='delivered' if baseline or mode=='rollback' else ('complained' if kind=='email.complained' else winner)
 need(result['callback']['status']==200,'UNEXPECTED_CALLBACK_STATUS');need(result['final'][0][0]==expected,'FINAL_STATE_MISMATCH');need(result['final'][0][2]=='7','BUSINESS_VERSION_CHANGED')
 if expected=='complained':need(result['final'][0][1]=='RESEND_COMPLAINT','COMPLAINT_ERROR_LOST')
 if baseline:result['baselineSafety']='FAILED_AS_EXPECTED'
 elif mode!='rollback':
  replies=[e for e in result['transcript'] if e['phase']=='after' and e['path']=='/rest/v1/notification_outbox' and e['method']=='PATCH'];need(replies[0]['result']==[],'REAL_EMPTY_CAS_RESPONSE_REQUIRED')
 return result
def error_case(duplicate):
 fixture(duplicate=duplicate,missing=not duplicate);r=invoke();need(r['callback']['status']==503,'CORRELATION_DID_NOT_FAIL_CLOSED');need(r['callback']['body']['code']==('AMBIGUOUS_OUTBOX_MATCH' if duplicate else 'OUTBOX_CORRELATION_PENDING'),'CORRELATION_CODE');return r
def permission():
 connection=http.client.HTTPConnection('127.0.0.1',3000,timeout=3);connection.request('GET','/notification_outbox?select=id',headers={'Authorization':'Bearer '+jwt('anon')});r=connection.getresponse();body=json.loads(r.read());connection.close();need(r.status in (401,403) and body.get('code')=='42501','ACTUAL_PERMISSION_DENIAL_REQUIRED');return {'httpStatus':r.status,'postgresCode':body['code']}
started=time.monotonic()
try:
 need(os.getuid()==65534,'NONROOT_REQUIRED');need('NoNewPrivs:\t1' in P('/proc/self/status').read_text(),'NNP_REQUIRED');need(len(P('/proc/net/route').read_text().strip().splitlines())==1,'EXTERNAL_ROUTE_PRESENT');need(os.statvfs('/').f_flag&os.ST_RDONLY,'ROOT_NOT_READONLY')
 (ROOT/'sock').mkdir(mode=0o700)
 command(['/usr/local/pgsql/bin/initdb','-D','/work/data','-U','postgres','--auth-local=trust','--auth-host=reject','--no-locale','-E','UTF8'])
 with open('/work/data/postgresql.conf','a') as f:f.write("\nlisten_addresses=''\nunix_socket_directories='/work/sock'\nunix_socket_permissions=0700\nmax_connections=10\nsuperuser_reserved_connections=1\nstatement_timeout='5s'\nlock_timeout='2s'\n")
 command(['/usr/local/pgsql/bin/pg_ctl','-D','/work/data','-l','/work/postgres.log','-w','start']);PID=True;db=Pg();competitor=Pg()
 db.query("""CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator LOGIN NOINHERIT;CREATE ROLE anon NOLOGIN;GRANT service_role,anon TO authenticator;
 CREATE TABLE notification_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider text NOT NULL,provider_message_ref text,status text NOT NULL,error_code text,state_version int NOT NULL DEFAULT 7,accepted_at timestamptz,delivered_at timestamptz,failed_at timestamptz,updated_at timestamptz DEFAULT now());
 CREATE TABLE webhook_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider text NOT NULL,provider_event_id text NOT NULL,event_type text NOT NULL,payload_sha256 text NOT NULL,status text NOT NULL DEFAULT 'received',attempt_count int NOT NULL DEFAULT 1,received_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz,last_error text,UNIQUE(provider,provider_event_id));
 ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;ALTER TABLE webhook_receipts ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA public TO authenticator,service_role,anon;REVOKE ALL ON notification_outbox,webhook_receipts FROM PUBLIC;GRANT SELECT,INSERT,UPDATE ON notification_outbox,webhook_receipts TO service_role;""")
 conf=P('/work/postgrest.conf');conf.write_text('db-uri = "postgresql://authenticator@/postgres?host=/work/sock"\ndb-schemas = "public"\ndb-anon-role = "anon"\ndb-pool = 3\nserver-host = "127.0.0.1"\nserver-port = 3000\njwt-secret = "'+secret+'"\n');conf.chmod(0o600)
 logfile=open('/work/postgrest.log','wb');rest=subprocess.Popen(['/usr/local/bin/postgrest',str(conf)],stdin=subprocess.DEVNULL,stdout=logfile,stderr=logfile,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work','LANG':'C'},close_fds=True)
 ready=False
 for _ in range(100):
  try:
   c=http.client.HTTPConnection('127.0.0.1',3000,timeout=.2);c.request('GET','/notification_outbox?select=id',headers={'Authorization':'Bearer '+jwt('service_role')});r=c.getresponse();r.read();ready=r.status==200;c.close()
   if ready:break
  except OSError:pass
  time.sleep(.05)
 need(ready,'POSTGREST_NOT_READY')
 report['databaseVersion']=db.query('SHOW server_version')[0][0];report['runtimeMeasurements']=json.loads(P('/opt/pr686/runtime-measurements.json').read_text());report['schemaBoundary']='Reduced two-table fixture; NOT full consent/schema equivalence';report['roles']=db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('service_role','authenticator','anon') ORDER BY rolname")
 for repeat in range(1,4):
  case(f'baseline_stale_delivery_{repeat}',lambda:race('committed',baseline=True))
  case(f'candidate_prior_commit_{repeat}',lambda:race('committed'))
  case(f'candidate_observed_lock_commit_{repeat}',lambda:race('inflight'))
  case(f'candidate_observed_lock_rollback_{repeat}',lambda:race('rollback'))
  case(f'candidate_reverse_order_{repeat}',lambda:race('committed',kind='email.complained',winner='delivered',error=None))
 case('anonymous_real_permission_denial',permission)
 case('missing_correlation',lambda:error_case(False));case('ambiguous_correlation',lambda:error_case(True))
 report['status']='REDUCED_SCHEMA_PILOT_PASS';report['casesExecuted']=len(records);report['httpRequests']=total_requests
except Exception as error:
 report['status']='PILOT_FAIL';report['error']=str(error);report['casesExecuted']=len(records)
finally:
 cleanup=[]
 for p in active:
  try:p.kill();p.wait(timeout=2)
  except Exception as e:cleanup.append(type(e).__name__)
 if rest:
  try:rest.terminate();rest.wait(timeout=5)
  except Exception as e:cleanup.append(type(e).__name__)
 for connection in [competitor,db]:
  if connection:
   try:connection.close()
   except Exception as e:cleanup.append(type(e).__name__)
 if PID:
  try:command(['/usr/local/pgsql/bin/pg_ctl','-D','/work/data','-m','fast','-w','stop'])
  except Exception as e:cleanup.append(str(e))
 report['cleanupVerified']=not cleanup;report['cleanupErrors']=cleanup;report['elapsedSeconds']=time.monotonic()-started
 print('PILOT_RESULT_JSON='+json.dumps(report,separators=(',',':')),flush=True)
 raise SystemExit(0 if report.get('status')=='REDUCED_SCHEMA_PILOT_PASS' and not cleanup else 1)
