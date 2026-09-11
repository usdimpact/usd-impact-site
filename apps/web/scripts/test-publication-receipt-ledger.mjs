import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { encodeReceiptPayload, receiptSigningBytes, SCOPE } from '../src/lib/publication-receipt-verifier.js';
import { createPublicationReceiptRecorder } from '../src/lib/publication-receipt-recorder.js';

const db = new PGlite();
const tests = [];
const digest = (s) => createHash('sha256').update(s).digest('hex');
const hash = (s) => s.repeat(64);
const time = (offset = 0) => new Date(Date.now() + offset).toISOString();
const pair = generateKeyPairSync('ed25519');
const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
const fingerprint = digest(pair.publicKey.export({ type: 'spki', format: 'der' }));
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const ROLE_SESSION_SQL = Object.freeze({
  fx558_controller: 'SET SESSION AUTHORIZATION fx558_controller',
  fx558_recorder: 'SET SESSION AUTHORIZATION fx558_recorder',
  fx558_reader: 'SET SESSION AUTHORIZATION fx558_reader',
  fx558_revoker: 'SET SESSION AUTHORIZATION fx558_revoker',
  anon: 'SET SESSION AUTHORIZATION anon',
  authenticated: 'SET SESSION AUTHORIZATION authenticated',
  service_role: 'SET SESSION AUTHORIZATION service_role',
});
const SQL_CONTRACT_URLS = Object.freeze([
  new URL('../docs/sql/publication-admission-contract-558.sql', import.meta.url),
  new URL('../docs/sql/publication-writer-api-contract-558.sql', import.meta.url),
  new URL('../docs/sql/publication-receipt-ledger-contract-558.sql', import.meta.url),
]);
async function as(role, work) {
  const statement = ROLE_SESSION_SQL[role];
  assert.equal(typeof statement, 'string');
  await db.exec(statement);
  try { return await work(); } finally { await db.exec('SET SESSION AUTHORIZATION postgres'); }
}
async function test(name, work) {
  try { await work(); tests.push(name); } catch (e) { console.error('Receipt ledger failed: ' + name); throw e; }
}
const denied = (work) => assert.rejects(work, (e) => e.code === '42501');
const held = (work, text) => assert.rejects(work, (e) => e.message.includes(text));
const revision = () => scalar('select revision::text from publication_guard.history_state');
const admission = (x) => scalar('select row_to_json(a) from publication_guard.publication_admissions a where path=$1',[x.binding.path]);
const lookup = (x, envelope) => as('fx558_recorder', () => scalar('select publication_guard_api.lookup_dispatch_receipt($1,$2)',[x.id,digest(envelope)]));
const consume = (x, receipt, deadline = time(8000)) => as('fx558_recorder', () => scalar('select publication_guard_api.consume_dispatch_receipt($1,$2,$3,$4)',[x.id,receipt.envelope,receipt.payload,deadline]));
const stage = (x) => as('fx558_controller', () => scalar('select publication_guard_api.stage_dispatch_attempt($1,$2,$3::jsonb,$4,$5)',[x.id,x.release,JSON.stringify(x.binding),x.keyId,x.keyFingerprint]));
async function fixture({ mode='preview', short=null }={}) {
  const id=randomBytes(16).toString('hex'), release=randomUUID();
  const checked=time(-1000), until=time(short ?? 60000), releaseAt=mode==='none'?null:mode==='outcome'?time(-2000):until;
  const path=mode==='none'?'/news/2026-09-10':`/news/catalysts/receipt-${id}`;
  const binding={...SCOPE,target:'production',exposure:'public-approved',deploymentId:'dpl_ReceiptLedgerFixture',commitSha:'a'.repeat(40),
    artifactSha256:hash('b'),manifestSha256:hash('c'),approvalSha256:hash('d'),path,sourceSha256:hash('e'),responseSha256:hash('f'),
    eventIdentity:mode==='none'?null:'BLS:CPI:2026-08:initial',phase:mode,releaseAt,checkedAt:checked,validUntil:until,
    attemptId:id,surface:'article',method:'GET',status:200,boundaryVersion:'publication-dispatch/v1'};
  const x={id,release,binding,keyId:'ephemeral-fixture-key',keyFingerprint:fingerprint};
  await as('fx558_controller', async () => {
    await scalar('select publication_guard_api.authorize_release($1,$2,$3,$4,$5,$6)',[release,binding.deploymentId,binding.commitSha,binding.artifactSha256,binding.approvalSha256,time(120000)]);
    await scalar('select publication_guard_api.prepare_admission($1,$2,$3,$4,$5,$6,$7,$8,$9)',[release,path,binding.sourceSha256,mode,hash('a'),checked,until,mode==='preview'?releaseAt:null,mode==='outcome'?releaseAt:null]);
  });
  await stage(x);
  await new Promise(r=>setTimeout(r,3));
  return x;
}
function signed(x,patch={}) {
 const p={schema:'first-public-dispatch/v1',keyId:x.keyId,audience:'publication-history-recorder',...x.binding,
   dispatchedAt:time(-1),finishedAt:time(),...patch};
 const payload=encodeReceiptPayload(p);
 return {payload,envelope:JSON.stringify({payload:Buffer.from(payload).toString('base64url'),signature:sign(null,receiptSigningBytes(payload),pair.privateKey).toString('base64url')})};
}
function adapters(x,changes={}) {
 let writes=0, reads=0;
 const attempt={attemptId:x.id,state:'pending',binding:x.binding,keyId:x.keyId,keyFingerprint:x.keyFingerprint,validUntil:x.binding.validUntil};
 const recorder=createPublicationReceiptRecorder({
  loadAttempt:async()=>attempt,
  loadKeySnapshot:async()=>({observedAt:time(-1),validUntil:time(10000),keys:[{keyId:x.keyId,publicKeyPem:pem,notBefore:time(-100000),notAfter:time(100000),revoked:false}]}),
  commitReceipt:async({attemptId,envelope,payload,verificationDeadline})=>{writes++;return as('fx558_recorder',()=>scalar('select publication_guard_api.consume_dispatch_receipt($1,$2,$3,$4)',[attemptId,envelope,payload,verificationDeadline]));},
  readReceipt:async({attemptId,receiptSha256})=>{reads++;return as('fx558_recorder',()=>scalar('select publication_guard_api.lookup_dispatch_receipt($1,$2)',[attemptId,receiptSha256]));},
  ...changes,
 });
 return {recorder,attempt,get writes(){return writes;},get reads(){return reads;}};
}
try {
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 for (const fileUrl of SQL_CONTRACT_URLS) await db.exec(await readFile(fileUrl,'utf8'));
 await test('new ledger tables use RLS', async()=>assert.equal(await scalar("select count(*) from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='publication_guard' and c.relkind='r' and c.relrowsecurity"),5));
 let x=await fixture(), receipt=signed(x);
 await test('staging creates no admission',async()=>assert.equal((await admission(x)).state,'pending'));
 await test('same staged attempt preserves revision',async()=>{const before=await revision();assert.equal(await stage(x),'ALREADY_STAGED');assert.equal(await revision(),before);});
 await test('attempt overwrite refused',()=>held(()=>stage({...x,keyFingerprint:hash('c')}),'HOLD_ATTEMPT_CONFLICT'));
 await test('another ID cannot replace prepared attempt',()=>held(()=>stage({...x,id:'9'.repeat(32),binding:{...x.binding,attemptId:'9'.repeat(32)}}),'HOLD_ATTEMPT_CONFLICT'));
 for (const [key,value] of [['exposure','private-preview'],['target','preview'],['method','HEAD'],['status',304],['sourceSha256',hash('d')],['phase','outcome'],['extra',true]])
  await test('binding rejects '+key,()=>assert.rejects(()=>stage({...x,binding:{...x.binding,[key]:value}})));
 for(const role of ['fx558_reader','fx558_recorder','fx558_controller','fx558_revoker','anon','authenticated','service_role']) {
  await test(role+' has no raw ledger access',async()=>{for(const sql of [
   'select * from publication_guard.dispatch_attempts','select * from publication_guard.dispatch_receipts',
   'delete from publication_guard.dispatch_attempts','update publication_guard.history_state set revision=0']) await as(role,()=>denied(()=>scalar(sql)));});
 }
 await test('digest-only recorder route revoked',()=>as('fx558_recorder',()=>denied(()=>scalar('select publication_guard_api.record_verified_receipt($1,$2,$3,$4)',[x.release,x.binding.path,x.binding.sourceSha256,hash('f')]))));
 await test('reader cannot consume receipt',()=>as('fx558_reader',()=>denied(()=>scalar('select publication_guard_api.consume_dispatch_receipt($1,$2,$3,$4)',[x.id,receipt.envelope,receipt.payload,time(8000)]))));
 await test('signed receipt chain writes admission and exact envelope',async()=>{
  const api=adapters(x), result=await api.recorder.record(x.id,receipt.envelope);
  assert.equal(result.decision,'RECORDED_SIGNER_ASSERTION');assert.equal(api.writes,1);
  assert.equal(result.publicationAuthorized,false);assert.equal(result.enforcementActive,false);
  assert.equal((await admission(x)).response_receipt_sha256,digest(receipt.envelope));
  assert.equal(await scalar('select envelope from publication_guard.dispatch_receipts where attempt_id=$1',[x.id]),receipt.envelope);
 });
 await test('identical SQL replay does not change time or revision',async()=>{const before=await revision(),a=await admission(x);assert.equal(await consume(x,receipt),'ALREADY_RECORDED');assert.equal(await revision(),before);assert.deepEqual(await admission(x),a);});
 await test('conflicting signed receipt cannot replace winner',()=>held(()=>consume(x,signed(x)),'HOLD_RECEIPT_CONFLICT'));
 await test('stored exact receipt can be reconciled without write',async()=>{const api=adapters(x);assert.equal((await api.recorder.reconcile(x.id,receipt.envelope)).admissionRecorded,true);assert.equal(api.writes,0);});
 await test('wrong receipt digest remains unresolved',async()=>assert.equal(await lookup(x,receipt.envelope+' '),null));
 await test('receipt evidence immutable',()=>held(()=>db.exec('update publication_guard.dispatch_receipts set payload=payload'),'HOLD_IMMUTABLE_DISPATCH_RECORD'));
 await test('attempt deletion immutable',()=>held(()=>db.exec('delete from publication_guard.dispatch_attempts'),'HOLD_IMMUTABLE_DISPATCH_RECORD'));
 await test('revocation changes read reconciliation state',async()=>{
  await as('fx558_revoker',()=>scalar('select publication_guard_api.revoke_release($1)',[x.release]));
  assert.equal((await adapters(x).recorder.reconcile(x.id,receipt.envelope)).decision,'RECORDED_BUT_REVOKED');
 });
 for(const [label,patch] of [['wrong key',{keyId:'other'}],['changed body',{responseSha256:hash('a')}],['HEAD',{method:'HEAD'}],['old finish',{dispatchedAt:time(-30000),finishedAt:time(-20000)}]]) {
  await test('verifier holds '+label+' without write',async()=>{const f=await fixture(),api=adapters(f);const result=await api.recorder.record(f.id,signed(f,patch).envelope);assert.match(result.decision,/^HOLD_/);assert.equal(api.writes,0);assert.equal((await admission(f)).state,'pending');});
 }
 await test('tampered signature never reaches SQL write',async()=>{const f=await fixture(),r=signed(f),e=JSON.parse(r.envelope);e.signature='a'.repeat(86);const api=adapters(f);assert.match((await api.recorder.record(f.id,JSON.stringify(e))).decision,/^HOLD_/);assert.equal(api.writes,0);});
 await test('prepared key fingerprint cannot be replaced',async()=>{const f=await fixture(),api=adapters({...f,keyFingerprint:hash('d')});assert.equal((await api.recorder.record(f.id,signed(f).envelope)).decision,'HOLD_KEY_BINDING');assert.equal(api.writes,0);});
 await test('unknown attempt holds',()=>held(async()=>{const f=await fixture();return consume({...f,id:'0'.repeat(32)},signed(f));},'HOLD_ATTEMPT_UNKNOWN'));
 await test('SQL envelope and payload must be same bytes',async()=>{const f=await fixture(),r=signed(f);await held(()=>consume(f,{...r,payload:r.payload+' '}),'HOLD_ENVELOPE_PAYLOAD_MISMATCH');assert.equal((await admission(f)).state,'pending');});
 await test('database rejects receipt predating preparation',async()=>{const f=await fixture();await held(()=>consume(f,signed(f,{dispatchedAt:time(-500),finishedAt:time(-400)})),'HOLD_RECEIPT_TIME');});
 await test('expired verification cannot finalize',async()=>{const f=await fixture();await held(()=>consume(f,signed(f),time(-1)),'HOLD_RECEIPT_TIME');assert.equal((await admission(f)).state,'pending');});
 await test('insert failure rolls back admission and revision',async()=>{
  const f=await fixture(),r=signed(f),before=await revision();
  await db.exec("create function publication_guard.reject_receipt_test() returns trigger language plpgsql as $$begin raise exception 'TEST_INSERT_FAILURE';end$$; create trigger reject_receipt_test before insert on publication_guard.dispatch_receipts for each row execute function publication_guard.reject_receipt_test();");
  try {await held(()=>consume(f,r),'TEST_INSERT_FAILURE');assert.equal((await admission(f)).state,'pending');assert.equal(await revision(),before);assert.equal(await lookup(f,r.envelope),null);}
  finally{await db.exec('drop trigger reject_receipt_test on publication_guard.dispatch_receipts; drop function publication_guard.reject_receipt_test();');}
 });
 await test('unknown write acknowledgement reconciles exact stored receipt',async()=>{
  const f=await fixture(),r=signed(f);let writes=0;
  const api=adapters(f,{commitReceipt:async p=>{writes++;await consume(f,{envelope:p.envelope,payload:p.payload},p.verificationDeadline);throw new Error('lost acknowledgement');}});
  assert.equal((await api.recorder.record(f.id,r.envelope)).decision,'RECORDED_SIGNER_ASSERTION');assert.equal(writes,1);
 });
 await test('failed write plus missing row stays unresolved without retry',async()=>{
  const f=await fixture(),r=signed(f);let writes=0;const api=adapters(f,{commitReceipt:async()=>{writes++;throw new Error('uncertain');}});
  assert.equal((await api.recorder.record(f.id,r.envelope)).decision,'HOLD_RECORDING_UNRESOLVED');assert.equal(writes,1);assert.equal((await admission(f)).state,'pending');
 });
 await test('adapter success flag cannot manufacture admission',async()=>{
  const f=await fixture(),api=adapters(f,{commitReceipt:async()=>true,readReceipt:async()=>({success:true})});
  assert.equal((await api.recorder.record(f.id,signed(f).envelope)).decision,'HOLD_RECORDING_UNRESOLVED');
 });
 await test('attempt drift before recording blocks write',async()=>{
  const f=await fixture();let n=0;const api=adapters(f);const api2=adapters(f,{loadAttempt:async()=>++n===1?api.attempt:{...api.attempt,state:'revoked'}});
  assert.equal((await api2.recorder.record(f.id,signed(f).envelope)).decision,'HOLD_ATTEMPT_DRIFT');assert.equal(api2.writes,0);
 });
 await test('callback exception cannot leak data into diagnostic',async()=>{const f=await fixture(),api=adapters(f,{loadAttempt:async()=>{throw Object.assign(new Error('PRIVATE'),{code:'HOLD_PRIVATE_SECRET'});}});assert.equal((await api.recorder.record(f.id,signed(f).envelope)).decision,'HOLD_RECEIPT_NOT_VERIFIED');});

 await test('post-insert expiry rolls back both records',async()=>{
  const f=await fixture(),r=signed(f),before=await revision();
  await db.exec("create function publication_guard.delay_receipt_test() returns trigger language plpgsql as $$begin perform pg_sleep(0.2);return NEW;end$$; create trigger delay_receipt_test before insert on publication_guard.dispatch_receipts for each row execute function publication_guard.delay_receipt_test();");
  try {await held(()=>consume(f,r,time(100)),'HOLD_RECEIPT_EXPIRED');assert.equal((await admission(f)).state,'pending');assert.equal(await revision(),before);assert.equal(await lookup(f,r.envelope),null);}
  finally{await db.exec('drop trigger delay_receipt_test on publication_guard.dispatch_receipts; drop function publication_guard.delay_receipt_test();');}
 });
 await test('final key revocation prevents write',async()=>{
  const f=await fixture();let n=0;const api=adapters(f,{loadKeySnapshot:async()=>({observedAt:time(-1),validUntil:time(10000),keys:[{keyId:f.keyId,publicKeyPem:pem,notBefore:time(-100000),notAfter:time(100000),revoked:++n===2}]})});
  assert.match((await api.recorder.record(f.id,signed(f).envelope)).decision,/^HOLD_/);assert.equal(api.writes,0);
 });
 await test('unavailable read after success does not retry read or write',async()=>{
  const f=await fixture();let reads=0;const api=adapters(f,{readReceipt:async()=>{reads++;throw new Error('unavailable');}});
  assert.equal((await api.recorder.record(f.id,signed(f).envelope)).decision,'HOLD_RECORDING_UNRESOLVED');assert.equal(api.writes,1);assert.equal(reads,1);
 });
 await test('timed-out prerequisite cannot write on later completion',async()=>{
  const f=await fixture();let aborted=false;const api=adapters(f,{timeoutMs:10,loadAttempt:async(_, {signal})=>{signal.addEventListener('abort',()=>{aborted=true;});await new Promise(r=>setTimeout(r,30));return {};}});
  assert.match((await api.recorder.record(f.id,signed(f).envelope)).decision,/^HOLD_/);await new Promise(r=>setTimeout(r,35));assert.equal(aborted,true);assert.equal(api.writes,0);
 });

 await test('timed-out write is never resubmitted and can later reconcile',async()=>{
  const f=await fixture(),r=signed(f);let writes=0,done;
  const completed=new Promise(resolve=>{done=resolve;});
  const api=adapters(f,{timeoutMs:10,commitReceipt:async p=>{writes++;await new Promise(resolve=>setTimeout(resolve,60));try{return await consume(f,{envelope:p.envelope,payload:p.payload},p.verificationDeadline);}finally{done();}}});
  assert.equal((await api.recorder.record(f.id,r.envelope)).decision,'HOLD_RECORDING_UNRESOLVED');assert.equal(writes,1);
  await completed;assert.equal((await api.recorder.reconcile(f.id,r.envelope)).decision,'RECORDED_SIGNER_ASSERTION');assert.equal(writes,1);
 });
 for(const mode of ['outcome','none']) await test('records '+mode+' with its own mode',async()=>{const f=await fixture({mode});assert.equal((await adapters(f).recorder.record(f.id,signed(f).envelope)).decision,'RECORDED_SIGNER_ASSERTION');});
 console.log(`Publication receipt ledger: ${tests.length} groups passed (real Ed25519 and embedded SQL; no live witness or provider).`);
} finally { await db.close(); }