"""Upgrade the pinned test pilot only; application modules are never rewritten."""
from pathlib import Path
import ast, hashlib, json

root = Path('packet')
source = (root / 'pilot.py').read_text()
original = source
module = ast.parse(source)
lines = source.splitlines(keepends=True)

fixture = '''def fixture(status='accepted',duplicate=False,missing=False):
 db.query('TRUNCATE public.notification_outbox,public.webhook_receipts')
 def insert(row_id):
  key=hashlib.sha256(row_id.encode()).hexdigest()
  db.query("INSERT INTO notification_outbox(id,idempotency_key,event_id,message_id,classification,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,template_version,provider,payload,status,provider_message_ref) VALUES ('"+row_id+"','notification:v1:"+key+"','fixture-event','fixture-message','operational','support_case','"+row_id+"',7,'reader@example.invalid','support_case_received','fixture-1','resend','{}','"+status+"','"+EMAIL+"')")
 if not missing:
  insert(ROW)
  if duplicate:insert(str(uuid.uuid4()))
'''

replacements=[]
for node in ast.walk(module):
 if isinstance(node,ast.FunctionDef) and node.name=='fixture':
  replacements.append((node.lineno-1,node.end_lineno,fixture))
 if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call):
  call=node.value
  if isinstance(call.func,ast.Attribute) and isinstance(call.func.value,ast.Name) and call.func.value.id=='db' and call.func.attr=='query' and call.args and isinstance(call.args[0],ast.Constant) and isinstance(call.args[0].value,str) and call.args[0].value.startswith('CREATE ROLE service_role'):
   replacements.append((node.lineno-1,node.end_lineno,' db.query(full_schema_sql())\n'))
if len(replacements)!=2:raise RuntimeError('PINNED_PILOT_STRUCTURE_CHANGED')
for start,end,replacement in sorted(replacements,reverse=True):lines[start:end]=[replacement]
source=''.join(lines)

extra=r'''
# The following definitions belong only to the local full-schema test harness.
def schema_files():
 import gzip
 obj=json.loads(P('/packet/full-schema-input.json').read_text())
 raw=gzip.decompress(base64.b64decode(obj['gzipBase64'],validate=True))
 need(len(raw)<100000 and hashlib.sha256(raw).hexdigest()==obj['schemaSha256'],'SCHEMA_INPUT_DIGEST')
 data=json.loads(raw)
 need(set(data)==set(obj['files']),'SCHEMA_FILE_SET')
 for name,text in data.items():
  b=text.encode();need(hashlib.sha256(b).hexdigest()==obj['files'][name]['sha256'],'SCHEMA_FILE_DIGEST')
 return obj,data

def full_schema_sql():
 obj,data=schema_files()
 order=['fixture-bootstrap','marketing_consent_events','notification_outbox','webhook_receipts','set_updated_at','validate_marketing_consent_event_reference','validate_notification_outbox_consent_reference','fixture-grants-triggers']
 report['schemaInputSha256']=obj['schemaSha256']
 return '\n'.join(data[name+'.sql'] for name in order)

def schema_audit():
 obj,data=schema_files()
 expected={name:obj['files'][name+'.sql']['md5'] for name in ['notification_outbox','webhook_receipts','marketing_consent_events']}
 observed=json.loads(db.query(data['catalog-reconstruction-query.sql'])[0][0])
 need(observed==expected,'PARSED_TABLE_SCHEMA_DRIFT')
 fns=db.query("SELECT p.proname,md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('set_updated_at','validate_marketing_consent_event_reference','validate_notification_outbox_consent_reference') ORDER BY p.proname")
 need(len(fns)==3 and all(obj['files'][name+'.sql']['md5']==md5 for name,md5 in fns),'PARSED_FUNCTION_DRIFT')
 structure=db.query("SELECT c.relname,c.relrowsecurity::text,c.relforcerowsecurity::text,(SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)::text,(SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('notification_outbox','webhook_receipts','marketing_consent_events') ORDER BY c.relname")
 need(structure==[['marketing_consent_events','true','false','0','1'],['notification_outbox','true','false','0','2'],['webhook_receipts','true','false','0','0']],'RLS_TRIGGER_DRIFT')
 privileges=db.query("SELECT has_table_privilege('service_role','notification_outbox','SELECT')::text,has_table_privilege('service_role','notification_outbox','UPDATE')::text,has_table_privilege('service_role','notification_outbox','DELETE')::text,has_table_privilege('service_role','webhook_receipts','DELETE')::text,has_table_privilege('service_role','webhook_receipts','TRUNCATE')::text")
 need(privileges==[['true','true','false','false','true']],'GRANT_CONTRACT_DRIFT')
 return {'parsedTableMd5':observed,'parsedFunctionMd5':dict(fns),'structure':structure,'privileges':privileges,'authDependency':'Declared empty id-only auth.users CHECK(false); NOT hosted Auth equivalence'}

def row_receipts():return db.query('SELECT status,last_error,processed_at FROM webhook_receipts ORDER BY id')

def full_case(name,fn):
 def checked():
  value=fn()
  counts=db.query('SELECT (SELECT count(*) FROM notification_outbox),(SELECT count(*) FROM webhook_receipts),(SELECT count(*) FROM marketing_consent_events),(SELECT count(*) FROM auth.users)')[0]
  need(int(counts[0])<=10 and int(counts[1])<=20 and counts[2:]==['0','0'],'FIXTURE_ROW_CAP_OR_USER_CONSENT_WRITE')
  connections=int(db.query("SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend'")[0][0]);need(connections<=10,'CONNECTION_CAP')
  return {'result':value,'rowCounts':counts,'connections':connections}
 case(name,checked)

def terminal_first(kind,status,code):
 r=race('committed',kind=kind,initial='sending',winner=status,error=code)
 need(r['final'][0]==[status,code,'7'],'TERMINAL_FIELDS_CHANGED')
 return r

def contention(name):
 from urllib.parse import parse_qs
 fixture();seen=0
 def hook(e,patches,p,send):
  nonlocal seen
  if e['phase']=='before' and e['path']=='/rest/v1/notification_outbox' and e['method']=='PATCH':
   seen+=1
   if name=='H06':db.query("UPDATE notification_outbox SET provider_message_ref='different-fixture-ref' WHERE id='"+ROW+"'")
   elif name=='H07':db.query("UPDATE notification_outbox SET id='00000000-0000-4000-8000-000000000002' WHERE id='"+ROW+"'")
   elif name=='H05' and seen==3:db.query("UPDATE notification_outbox SET status='complained',error_code='RESEND_COMPLAINT' WHERE id='"+ROW+"'")
   else:
    old=parse_qs(e['query'].lstrip('?'))['status'][0]
    new='sending' if old=='eq.accepted' else 'accepted'
    db.query("UPDATE notification_outbox SET status='"+new+"' WHERE id='"+ROW+"'")
  send({'action':'go'})
 r=invoke(hook=hook);report['pendingFailureEvidence']=r
 expected={'H04':(503,'OUTBOX_UPDATE_CONTENDED'),'H05':(200,None),'H06':(503,'OUTBOX_CORRELATION_PENDING'),'H07':(500,'OUTBOX_IDENTITY_CHANGED')}
 need(r['callback']['status']==expected[name][0] and r['callback']['body'].get('code')==expected[name][1],'CONTENTION_RESULT_'+name)
 receipts=row_receipts();r['receiptState']=receipts
 if name in ('H04','H05'):need(seen==3 and r['patches']==3,'THREE_ATTEMPT_CAP')
 if name=='H04':
  reads=sum(e['phase']=='before' and e['path']=='/rest/v1/notification_outbox' and e['method']=='GET' for e in r['transcript'])
  need(reads==4 and r['callback']['headers'].get('retry-after')=='5','FOUR_READS_RETRY_AFTER')
 if name!='H05':need(receipts==[['failed',expected[name][1],None]],'FAILURE_RECEIPT_NOT_RETAINED')
 else:need(r['final'][0]==['complained','RESEND_COMPLAINT','7'],'FINAL_REREAD_COMPLAINT_LOST')
 if name in ('H06','H07'):need(r['final']==[['accepted',None,'7']],'LOST_IDENTITY_MUTATED_STATE')
 del report['pendingFailureEvidence'];return r

def projection():
 fixture();before=db.query("SELECT payload::text,consent_required::text,state_version::text,updated_at::text FROM notification_outbox WHERE id='"+ROW+"'")[0]
 r=invoke();replies=[e for e in r['transcript'] if e['phase']=='after' and e['path']=='/rest/v1/notification_outbox' and e['method']=='PATCH']
 need(len(replies)==1 and replies[0]['status']==200 and replies[0]['result']==[{'id':ROW,'status':'delivered','provider_message_ref':EMAIL}],'REAL_PROJECTED_REPRESENTATION')
 need('return=representation' in (replies[0].get('preferenceApplied') or ''),'PREFERENCE_NOT_APPLIED')
 after=db.query("SELECT payload::text,consent_required::text,state_version::text,updated_at::text FROM notification_outbox WHERE id='"+ROW+"'")[0]
 need(before[:3]==after[:3] and before[3]!=after[3],'PRESERVATION_OR_TIMESTAMP_TRIGGER')
 r['preservedFieldsBefore']=before;r['preservedFieldsAfter']=after;return r

def sequential_duplicate():
 fixture();event='msg_duplicate_'+uuid.uuid4().hex
 first=invoke(event_id=event);second=invoke(event_id=event);conflict=invoke(kind='email.complained',event_id=event)
 need(first['callback']['status']==200 and second['callback']['status']==200 and second['callback']['body'].get('duplicate') is True,'SEQUENTIAL_DUPLICATE')
 need(second['patches']==0 and conflict['callback']['status']==409 and conflict['patches']==0 and current()==[['delivered',None,'7']],'DUPLICATE_OR_CONFLICT_MUTATED_OUTBOX')
 return {'first':first,'duplicate':second,'conflict':conflict,'receipts':row_receipts()}

def direct_role_denials():
 fixture();results=[]
 for role in ['anon','authenticated']:
  for table in ['notification_outbox','webhook_receipts']:
   for method in ['GET','PATCH']:
    conn=http.client.HTTPConnection('127.0.0.1',3000,timeout=3)
    body=None if method=='GET' else json.dumps({'status':'delivered' if table=='notification_outbox' else 'processed'})
    conn.request(method,'/'+table+'?id=eq.'+ROW+'&select=id',body=body,headers={'Authorization':'Bearer '+jwt(role),'Content-Type':'application/json','Prefer':'return=representation'})
    response=conn.getresponse();payload=json.loads(response.read());conn.close()
    need(response.status in (401,403) and payload.get('code')=='42501','ACTUAL_ROLE_DENIAL_REQUIRED')
    results.append({'role':role,'table':table,'method':method,'httpStatus':response.status,'postgresCode':payload['code']})
 need(current()==[['accepted',None,'7']],'DENIAL_MUTATED_OUTBOX');report['directPermissionRequests']=8;return results

def fault_role(role):
 fixture();r=invoke(role=role)
 need(r['callback']['status']==500 and r['callback']['body']['code']=='WEBHOOK_STATE_REQUEST_FAILED','MISSING_PRIVILEGE_ACKNOWLEDGED')
 need(r['final']==[['accepted',None,'7']] and row_receipts()==[['failed','WEBHOOK_STATE_REQUEST_FAILED',None]],'PRIVILEGE_FAILURE_EVIDENCE_LOST')
 r['role']=role;r['receiptState']=row_receipts();return r

def rejected_constraints():
 fixture();cases=[]
 changes=[('status',"status='not_a_status'"),('attempt_count','attempt_count=-1'),('state_version','state_version=0'),('payload',"payload='{\"unexpected\":true}'::jsonb"),('email',"recipient_email_normalized='UPPER@example.invalid'"),('marketing_consent',"classification='marketing'")]
 for name,assignment in changes:
  failed=False;message=None;db.query('BEGIN')
  try:db.query("UPDATE notification_outbox SET "+assignment+" WHERE id='"+ROW+"'")
  except RuntimeError as error:failed=True;message=str(error)[:300]
  finally:db.query('ROLLBACK')
  need(failed,'CONSTRAINT_ACCEPTED_'+name);cases.append({'constraint':name,'rejected':True,'databaseError':message})
 failed=False;db.query('BEGIN')
 try:db.query("INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000099')")
 except RuntimeError as error:failed=True;message=str(error)[:300]
 finally:db.query('ROLLBACK')
 need(failed,'AUTH_STUB_ACCEPTED_ROW');cases.append({'constraint':'auth_fixture_empty','rejected':True,'databaseError':message})
 need(current()==[['accepted',None,'7']],'REJECTED_CONSTRAINT_MUTATED_STATE');return cases

def reverse_terminal(kind):
 fixture('delivered');r=invoke(kind)
 need(r['callback']['status']==200 and r['patches']==0 and r['final']==[['delivered',None,'7']],'UNCHANGED_PLANNER_REVERSE_POLICY')
 return r
'''

def once(old,new):
 global source
 if source.count(old)!=1:raise RuntimeError('PINNED_REPLACEMENT_COUNT:'+old[:60])
 source=source.replace(old,new)

once('started=time.monotonic()\n',extra+'\nstarted=time.monotonic()\n')
once("def invoke(kind='email.delivered',baseline=False,hook=None,event_id=None):", "def invoke(kind='email.delivered',baseline=False,hook=None,event_id=None,role='service_role'):")
once("send({'jwt':jwt('service_role'),", "send({'jwt':jwt(role),")
once("need(total_requests<=500,'HTTP_CAP')", "need(total_requests<=2000,'HTTP_CAP')")
once(" for repeat in range(1,4):\n", " report['schemaAudit']=schema_audit()\n for repeat in range(1,4):\n")
more=r'''
 for repeat in range(1,4):
  for status,code in [('complained','RESEND_COMPLAINT'),('hard_bounced','RESEND_HARD_BOUNCE'),('suppressed','RESEND_SUPPRESSED'),('terminal_failed','RESEND_SEND_FAILED')]:
   for kind in ['email.sent','email.delivered','email.delivery_delayed']:
    full_case('E06_'+status+'_'+kind+'_'+str(repeat),lambda k=kind,s=status,c=code:terminal_first(k,s,c))
  for kind in ['email.sent','email.delivered','email.delivery_delayed']:
   full_case('E07_cancel_'+kind+'_'+str(repeat),lambda k=kind:terminal_first(k,'cancelled',None))
  for name in ['H04','H05','H06','H07']:full_case(name+'_'+str(repeat),lambda n=name:contention(n))
  full_case('H01_projection_'+str(repeat),projection)
  full_case('R01_duplicate_'+str(repeat),sequential_duplicate)
  for kind in ['email.bounced','email.failed','email.suppressed']:full_case('R05_reverse_'+kind+'_'+str(repeat),lambda k=kind:reverse_terminal(k))
 full_case('H09_actual_role_denials',direct_role_denials)
 for role in ['fault_no_select','fault_no_update']:full_case('H10_'+role,lambda r=role:fault_role(r))
 full_case('full_schema_constraint_rejections',rejected_constraints)
 need(len(records)==94,'EXACT_CASE_COUNT')
 report['remainingUntested']=['H03 two concurrent callback handlers','H06 auth-shaped variant','H11 backend timeout and transport fault/retry','H12 malformed representation faults','H13 lost reply after COMMIT','R02 receipt-finalization failure recovery','R03 concurrent duplicate/stale finisher','R04 timestamp ordering','complete original 30-group repetitions']
'''
once(" report['status']='REDUCED_SCHEMA_PILOT_PASS';",more+" report['status']='FULL_SCHEMA_BOUNDED_SUITE_PASS';")
once("report.get('status')=='REDUCED_SCHEMA_PILOT_PASS'", "report.get('status')=='FULL_SCHEMA_BOUNDED_SUITE_PASS'")
once("'kind':'REDUCED_SCHEMA_REAL_STORAGE_PILOT'", "'kind':'FULL_TABLE_CONTRACT_BOUNDED_REAL_STORAGE'")
once("'Reduced two-table fixture; NOT full consent/schema equivalence'", "'Three catalog-reconstructed public tables and three trigger functions; declared empty auth.users stub; NOT hosted Auth parity'")
ast.parse(source)
(root/'pilot.py').write_text(source)
worker=(root/'worker.mjs').read_text()
old='body:response.body,requests';new='body:response.body,headers:response.headers,requests'
if worker.count(old)!=1:raise RuntimeError('WORKER_DONE_SHAPE_CHANGED')
worker=worker.replace(old,new)
old='status:response.status,result:text?JSON.parse(text):null';new=old+",preferenceApplied:response.headers.get('preference-applied')"
if worker.count(old)!=1:raise RuntimeError('WORKER_RESPONSE_SHAPE_CHANGED')
worker=worker.replace(old,new);(root/'worker.mjs').write_text(worker)
Path('evidence/full-schema-harness-provenance.json').write_text(json.dumps({'basePilotSha256':hashlib.sha256(original.encode()).hexdigest(),'derivedPilotSha256':hashlib.sha256(source.encode()).hexdigest(),'derivedWorkerSha256':hashlib.sha256(worker.encode()).hexdigest(),'applicationModulesModified':False,'kind':'test-harness-only extension','expectedCaseCount':94,'original30GroupAcceptance':'NOT_COMPLETED'},indent=2)+'\n')
print('FULL_SCHEMA_TEST_HARNESS_PREPARED')
