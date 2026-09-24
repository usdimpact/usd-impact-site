import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleGuidedEditionRequest } from '../api/guided-edition.js';
import { buildBatchReadPlan, reconcileBatch, SELECT, LIMITS, readGuidedLearningProgressBatch, GUIDED_BATCH_TIMEOUT_MS } from '../src/lib/guided-progress-batch.js';
import { normalizeGuidedProgressRecord, canonicalGuidedReaderText } from '../src/lib/guided-edition.js';
const account = '11111111-1111-4111-8111-111111111111';
const otherAccount = '22222222-2222-4222-8222-222222222222';
const ids = Array.from({length:13}, (_,i) => 'guided-edition:chapter-' + (i+1));
const chapters = ids.map((id,i) => ({contentId:id,version:1,number:i+1,sections:[{id:'start'},{id:'end'}]}));
function row(id, n=40) { return {account_id:account, content_id:id, status:'in_progress', progress_percent:n, resume_position:'end', mastery_score:60, attempt_count:2, completed_at:null, data:{contentVersion:1}, updated_at:'2026-09-24T10:00:00Z'}; }
const plan = buildBatchReadPlan(account,ids);
function receipt(rows, overrides={}) { return {status:200,redirected:false,contentType:'application/json; charset=utf-8',preferenceApplied:'count=exact',contentRange: rows.length ? '0-'+(rows.length-1)+'/'+rows.length : '*/0',body:JSON.stringify(rows),...overrides}; }
function rejected(r, code) { const out=reconcileBatch(plan,r); assert.equal(out.status,'unavailable'); if(code)assert.equal(out.code,code); assert.equal(Object.hasOwn(out,'rowsByChapter'),false); return out; }

test('13 chapters use one GET plan with account and explicit catalogue filters',()=>{
 const q=new URL('https://offline.invalid'+plan.request.path).searchParams;
 assert.equal(plan.requestCount,1); assert.equal(plan.request.method,'GET');
 assert.equal(q.get('account_id'),'eq.'+account); assert.equal(q.get('content_id'),'in.('+ids.join(',')+')');
 assert.equal(q.get('select'),SELECT); assert.equal(q.get('limit'),'14'); assert.equal(q.get('offset'),'0');
});
test('plan has no secret, raw token, request body or ambient credential',()=>{
 assert.deepEqual(plan.request.headers,{Accept:'application/json',Prefer:'count=exact'});
 assert.equal(plan.request.credentialMode,'existing_publishable_key_and_verified_user_token');
 assert.equal(Object.hasOwn(plan.request,'body'),false); assert.equal(Object.hasOwn(plan.request.headers,'Authorization'),false);
});
test('empty catalogue makes no request',()=>assert.equal(buildBatchReadPlan(account,[]).requestCount,0));
test('invalid account rejects before planning',()=>assert.throws(()=>buildBatchReadPlan('bad',ids),/INVALID_ACCOUNT/));
test('filter injection in content identity rejected',()=>assert.throws(()=>buildBatchReadPlan(account,['guided-edition:ok),or=(x)']),/INVALID_CONTENT_ID/));
test('duplicate requested identities rejected',()=>assert.throws(()=>buildBatchReadPlan(account,[ids[0],ids[0]]),/DUPLICATE/));
test('non-array catalogue rejected',()=>assert.throws(()=>buildBatchReadPlan(account,{}),/CATALOGUE/));
test('more than 64 chapters rejected',()=>assert.throws(()=>buildBatchReadPlan(account,Array.from({length:65},(_,i)=>'guided-edition:c-'+i)),/CATALOGUE/));
test('overlong content ID rejected',()=>assert.throws(()=>buildBatchReadPlan(account,['guided-edition:'+ 'a'.repeat(130)]),/INVALID_CONTENT/));
test('query byte cap applies even below chapter cap',()=>assert.throws(()=>buildBatchReadPlan(account,Array.from({length:64},(_,i)=>'guided-edition:'+ 'a'.repeat(106)+'-'+i)),/QUERY_BOUND/));
test('uppercase UUID canonicalized',()=>assert.equal(buildBatchReadPlan('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',ids).accountId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
test('complete results preserve catalogue order, independent of response order',()=>{
 const out=reconcileBatch(plan,receipt(ids.slice().reverse().map(id=>row(id))));
 assert.equal(out.status,'complete'); assert.equal(out.visibleCount,13); assert.equal(out.missingVisibleCount,0);
 assert.deepEqual(out.rowsByChapter.map(x=>x.contentId),ids);
});
test('normalized results match the existing domain function for all 13 rows',()=>{
 const rows=ids.map((id,i)=>row(id,i*7)); const out=reconcileBatch(plan,receipt(rows));
 assert.deepEqual(out.rowsByChapter.map((x,i)=>normalizeGuidedProgressRecord(x.row,chapters[i])),rows.map((x,i)=>normalizeGuidedProgressRecord(x,chapters[i])));
});
test('sparse complete result distinguishes nine no-visible-row entries',()=>{
 const out=reconcileBatch(plan,receipt(ids.slice(0,4).map(id=>row(id))));
 assert.equal(out.status,'complete');assert.equal(out.missingVisibleCount,9);assert.equal(out.rowsByChapter[4].row,null);
});
test('empty visible result accepted only with exact zero range',()=>{
 const out=reconcileBatch(plan,receipt([])); assert.equal(out.status,'complete');assert.equal(out.visibleCount,0);
});
test('missing total is not interpreted as zero progress',()=>rejected(receipt([row(ids[0])],{contentRange:'0-0/*'}),'INVALID_RANGE'));
test('missing range is not interpreted as complete',()=>rejected(receipt([row(ids[0])],{contentRange:''}),'INVALID_RANGE'));
test('truncated successful response is rejected',()=>rejected(receipt([row(ids[0])],{contentRange:'0-0/13'}),'INCOMPLETE_RESULT'));
test('nonzero page offset rejected',()=>rejected(receipt([row(ids[0])],{contentRange:'1-1/2'}),'INVALID_RANGE'));
test('mismatched range length rejected',()=>rejected(receipt([row(ids[0])],{contentRange:'0-1/1'}),'INCOMPLETE_RESULT'));
test('unsafe-integer exact count rejected',()=>rejected(receipt([row(ids[0])],{contentRange:'0-0/9007199254740992'}),'INCOMPLETE_RESULT'));
test('empty result with positive total rejected',()=>rejected(receipt([],{contentRange:'*/13'}),'EMPTY_NOT_CONFIRMED'));
test('empty result with unspecified total rejected',()=>rejected(receipt([],{contentRange:'*/*'}),'EMPTY_NOT_CONFIRMED'));
for(const status of [401,403,429,500])test('HTTP '+status+' never produces fresh-progress rows',()=>rejected(receipt([],{status}),'HTTP_NOT_COMPLETE'));
test('redirected response rejected',()=>rejected(receipt([],{redirected:true}),'HTTP_NOT_COMPLETE'));
test('HTML login response rejected',()=>rejected(receipt([],{contentType:'text/html',body:'<html>sign in</html>'}),'NOT_JSON'));
test('malformed JSON rejected',()=>rejected(receipt([],{body:'['}),'INVALID_JSON'));
test('JSON object instead of array rejected',()=>rejected(receipt([],{body:'{}'}),'INVALID_ROW_COUNT'));
test('missing exact-count acknowledgement rejected',()=>rejected(receipt([],{preferenceApplied:''}),'EXACT_COUNT_UNCONFIRMED'));
test('planned-count acknowledgement rejected',()=>rejected(receipt([],{preferenceApplied:'count=planned'}),'EXACT_COUNT_UNCONFIRMED'));
test('conflicting count preferences rejected',()=>rejected(receipt([],{preferenceApplied:'count=exact, count=planned'}),'EXACT_COUNT_UNCONFIRMED'));
test('duplicate returned row rejected',()=>rejected(receipt([row(ids[0]),row(ids[0])]),'DUPLICATE_ROW'));
test('another account row rejected without returning payload',()=>rejected(receipt([{...row(ids[0]),account_id:otherAccount}]),'WRONG_ACCOUNT'));
test('unrequested chapter row rejected',()=>rejected(receipt([row('guided-edition:unrequested')]),'UNREQUESTED_CONTENT'));
test('missing identity field rejected',()=>{const x=row(ids[0]);delete x.content_id;rejected(receipt([x]),'INVALID_ROW');});
test('null row rejected',()=>rejected(receipt([null]),'INVALID_ROW'));
test('non-object progress data rejected',()=>rejected(receipt([{...row(ids[0]),data:[]}]),'INVALID_PROGRESS_DATA'));
test('additional upstream field not projected',()=>{
 const out=reconcileBatch(plan,receipt([{...row(ids[0]),unrelated:'excluded'}]));
 assert.equal(out.status,'complete');assert.equal(Object.hasOwn(out.rowsByChapter[0].row,'unrelated'),false);
});
test('version mismatch preserves existing reset semantics only for complete data',()=>{
 const x={...row(ids[0]),data:{contentVersion:2}};const out=reconcileBatch(plan,receipt([x]));
 assert.equal(normalizeGuidedProgressRecord(out.rowsByChapter[0].row,chapters[0]).progressPercent,0);
});
test('body limit is enforced in bytes for multibyte data',()=>rejected(receipt([],{body:'"'+'\u6f22'.repeat(LIMITS.bodyBytes/3+1)+'"'}),'BODY_BOUND'));
test('invalid UTF-8 rejected',()=>rejected(receipt([],{body:new Uint8Array([0xff,0xfe])}),'INVALID_JSON'));
test('too many returned rows rejected',()=>rejected(receipt(Array.from({length:14},()=>row(ids[0]))),'INVALID_ROW_COUNT'));
test('no-request plan cannot be passed off as database evidence',()=>assert.equal(reconcileBatch(buildBatchReadPlan(account,[]),receipt([])).status,'unavailable'));


// HTTP 206 is allowed only when the exact range/count still proves completeness.
test('complete 206 result accepted with matching exact total', () => {
  assert.equal(reconcileBatch(plan, receipt([row(ids[0])], {status:206})).status, 'complete');
});
test('partial 206 result remains unavailable', () => {
  rejected(receipt([row(ids[0])], {status:206, contentRange:'0-0/13'}), 'INCOMPLETE_RESULT');
});
for (const [field, value] of [
  ['progress_percent', 101], ['progress_percent', 2.3], ['status', 'unknown'],
  ['attempt_count', -1], ['attempt_count', 9007199254740992], ['mastery_score', 101],
  ['resume_position', 'x'.repeat(81)], ['updated_at', 'not-a-date'], ['completed_at', 99],
]) test('invalid stored '+field+' ('+String(value).slice(0,15)+') is unavailable', () => {
  rejected(receipt([{...row(ids[0]), [field]:value}]), 'INVALID_PROGRESS_FIELDS');
});

const token = 'eyJ.synthetic-verified-user-token.signature';
const pub = 'sb_publishable_0123456789abcdef0123456789';
const origin = 'https://fixture-only.invalid';
const config = {url:origin, publishableKey:pub};
function mockResponse(url, rows=[], opts={}) {
  const headers = {
    'content-type':'application/json; charset=utf-8', 'range-unit':'items',
    'content-range':rows.length ? `0-${rows.length-1}/${rows.length}` : '*/0',
    'preference-applied':'count=exact', ...opts.headers,
  };
  for (const [key,value] of Object.entries(headers)) if (value === null) delete headers[key];
  const response = new Response(opts.body === undefined ? JSON.stringify(rows) : opts.body,
    { status:opts.status || 200, headers });
  Object.defineProperty(response, 'url', {value:opts.url === undefined ? url : opts.url});
  Object.defineProperty(response, 'redirected', {value:opts.redirected || false});
  return response;
}
function runRead(fetchImpl, overrides={}) {
  return readGuidedLearningProgressBatch({accountId:account,contentIds:ids,accessToken:token,config,fetchImpl,...overrides});
}
function countedFetch(factory) {
  const calls=[];
  return {calls, fetchImpl:async (url,options) => { calls.push({url,options}); return factory(url,options); }};
}
test('transport sends one scoped GET with user bearer and never reads a secret key', async () => {
  const guarded={...config};Object.defineProperty(guarded,'secretKey',{get(){throw new Error('secret accessed');}});
  const probe=countedFetch((url)=>mockResponse(url,ids.map(id=>row(id))));
  const out=await runRead(probe.fetchImpl,{config:guarded});
  assert.equal(out.status,'complete');assert.equal(probe.calls.length,1);
  const {url,options}=probe.calls[0];assert.equal(new URL(url).origin,origin);
  assert.equal(new URL(url).searchParams.get('account_id'),'eq.'+account);
  assert.equal(options.headers.apikey,pub);assert.equal(options.headers.Authorization,'Bearer '+token);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.equal('body' in options,false);assert.equal(options.signal.aborted,true);
});
test('empty list sends no request and does not inspect credential config', async () => {
  const probe=countedFetch(()=>assert.fail('request'));
  const out=await runRead(probe.fetchImpl,{contentIds:[],config:new Proxy({}, {get(){assert.fail('config accessed');}})});
  assert.equal(out.status,'complete');assert.equal(probe.calls.length,0);
});
for (const invalidToken of ['', null, 'too-short', 'bad token '.repeat(4)]) test('invalid user token rejected '+String(invalidToken), async()=>{
  const probe=countedFetch(()=>assert.fail('request'));
  const out=await runRead(probe.fetchImpl,{accessToken:invalidToken});assert.equal(out.status,'unavailable');assert.equal(probe.calls.length,0);
});
for (const url of ['http://fixture-only.invalid','https://user:pass@fixture-only.invalid','https://fixture-only.invalid/path','https://fixture-only.invalid?x=1','https://fixture-only.invalid/#x']) test('unsafe configured origin rejected '+url,async()=>{
 const probe=countedFetch(()=>assert.fail('request'));const out=await runRead(probe.fetchImpl,{config:{...config,url}});
 assert.equal(out.status,'unavailable');assert.equal(probe.calls.length,0);
});
test('secret-only config has no fallback',async()=>{
 const probe=countedFetch(()=>assert.fail('request'));const out=await runRead(probe.fetchImpl,{config:{url:origin,secretKey:'sb_secret_fixture-only'}});
 assert.equal(out.status,'unavailable');assert.equal(probe.calls.length,0);
});
test('real unchanged environment config reader is used when config is omitted',async()=>{
 const probe=countedFetch(url=>mockResponse(url));
 const out=await runRead(probe.fetchImpl,{config:undefined,environment:{SUPABASE_URL:origin,SUPABASE_PUBLISHABLE_KEY:pub}});
 assert.equal(out.status,'complete');assert.equal(probe.calls.length,1);
});
for(const [name,opts] of [
 ['redirect',{redirected:true}],['final URL mismatch',{url:'https://elsewhere.invalid'}],
 ['missing final URL',{url:''}],['HTML',{headers:{'content-type':'text/html'}}],
 ['missing range unit',{headers:{'range-unit':null}}],['incomplete range',{headers:{'content-range':'*/13'}}],
 ['missing count acknowledgement',{headers:{'preference-applied':null}}],
 ['declared oversized body',{headers:{'content-length':String(LIMITS.bodyBytes+1)}}],
 ['invalid declared length',{headers:{'content-length':'NaN'}}],
 ['invalid JSON',{body:'['}],['invalid UTF8',{body:new Uint8Array([255,254])}],
 ['oversized body',{body:' '.repeat(LIMITS.bodyBytes+1)}],
]) test('transport rejects '+name+' without retry or fallback',async()=>{
 const probe=countedFetch(url=>mockResponse(url,[],opts));const out=await runRead(probe.fetchImpl);
 assert.equal(out.status,'unavailable');assert.equal(probe.calls.length,1);assert.equal('rowsByChapter' in out,false);
});
for (const status of [401,403,429,500])test('transport HTTP '+status+' uses exactly one call',async()=>{
 const probe=countedFetch(url=>mockResponse(url,[],{status}));assert.equal((await runRead(probe.fetchImpl)).status,'unavailable');assert.equal(probe.calls.length,1);
});
test('transport rejects provider failure without copying error payload',async()=>{
 const probe=countedFetch(()=>{throw new Error('secret-user-provider-payload');});const out=await runRead(probe.fetchImpl);
 assert.deepEqual(out,{status:'unavailable',code:'READ_FAILED'});assert.equal(probe.calls.length,1);
});
test('bounded streaming decode handles split UTF8',async()=>{
 const rows=[{...row(ids[0]),data:{contentVersion:1,note:'cafe\u00e9'}}];const bytes=new TextEncoder().encode(JSON.stringify(rows));
 const probe=countedFetch(url=>mockResponse(url,rows,{body:new ReadableStream({start(controller){
  for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();
 }})}));assert.equal((await runRead(probe.fetchImpl)).status,'complete');assert.equal(probe.calls.length,1);
});
test('stream read failure is unavailable',async()=>{
 const probe=countedFetch(url=>mockResponse(url,[],{body:new ReadableStream({start(controller){controller.error(new Error('private body failure'));}})}));
 assert.equal((await runRead(probe.fetchImpl)).status,'unavailable');assert.equal(probe.calls.length,1);
});
for(const kind of ['headers','body'])test('five-second budget bounds stalled '+kind,async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;let calls=0;let cancelled=0;
 const pending=runRead(async(url,options)=>{calls++;signal=options.signal;
  if(kind==='headers')return new Promise(()=>{});
  return mockResponse(url,[],{body:new ReadableStream({cancel(){cancelled++;}})});
 });
 await Promise.resolve();await Promise.resolve();
 t.mock.timers.tick(GUIDED_BATCH_TIMEOUT_MS);
 const out=await pending;assert.deepEqual(out,{status:'unavailable',code:'TIMEOUT'});assert.equal(calls,1);assert.equal(signal.aborted,true);
 if(kind==='body')assert.equal(cancelled,1);t.mock.timers.reset();
});
test('late provider response cannot turn expired read into success',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let complete;let calls=0;
 const pending=runRead((url)=>{calls++;return new Promise(resolve=>{complete=()=>resolve(mockResponse(url,ids.map(id=>row(id))));});});
 t.mock.timers.tick(GUIDED_BATCH_TIMEOUT_MS);const out=await pending;complete();await Promise.resolve();await Promise.resolve();
 assert.equal(out.code,'TIMEOUT');assert.equal(calls,1);t.mock.timers.reset();
});

// Actual candidate handler + actual domain validation; only external dependencies are injected.
function makeRelease(index=1){
 const contentId='guided-edition:chapter-'+index;
 const payload={contentId,version:1,number:index,slug:'chapter-'+index,title:'Synthetic chapter '+index,shortTitle:'Synthetic '+index,
  description:'Synthetic offline fixture.',part:'Test part',purpose:'Test library rendering.',fixture:false,
  source:{documentSha256:'a'.repeat(64),readerTextSha256:'',productionBuild:'test',edition:'test',printedPages:'1',pdfPages:'1'},
  sections:[{id:'start',title:'Start',progressPercent:20,paragraphs:['Synthetic paragraph.']},{id:'end',title:'End',progressPercent:98,paragraphs:['Synthetic ending.']}],
  mastery:{questions:Array.from({length:5},(_,i)=>({questionId:'q-'+i,prompt:'Synthetic question?',options:[{id:'yes',label:'Yes'},{id:'no',label:'No'}],correctOptionId:'yes',correctFeedback:'Correct.',incorrectFeedback:'Review.',reviewSectionId:'start'}))}};
 payload.source.readerTextSha256=createHash('sha256').update(canonicalGuidedReaderText(payload)).digest('hex');
 return {content_id:contentId,version:1,chapter_number:index,slug:payload.slug,status:'published',source_sha256:payload.source.documentSha256,reader_sha256:payload.source.readerTextSha256,payload};
}
const releases=Array.from({length:13},(_,i)=>makeRelease(i+1));
const host='fixture-only.invalid';
function req(overrides={}){return {method:'GET',url:'/api/guided-edition',headers:{host,'x-forwarded-host':host,'x-forwarded-proto':'https'},...overrides};}
function responseRecorder(){const headers=new Map();return {statusCode:200,body:'',setHeader(k,v){headers.set(k.toLowerCase(),v);},getHeader(k){return headers.get(k.toLowerCase());},end(value=''){this.body=value;}};}
async function libraryRun(overrides={},request=req()){
 let progressCalls=0,batchCalls=0;const response=responseRecorder();
 await handleGuidedEditionRequest(request,response,{
  resolveSession:async({verifyAccessToken})=>({accessToken:token,value:await verifyAccessToken(token)}),
  readAccessState:async()=>({allowed:true,reason:'active',user:{id:account}}),
  readCatalog:async()=>releases,readSupplementCatalog:async()=>[],
  readContent:async()=>releases[0],readSupplement:async()=>null,
  readProgress:async()=>{progressCalls++;return null;},recordProgress:async()=>assert.fail('unapproved write'),
  readProgressBatch:async(options)=>{batchCalls++;return readGuidedLearningProgressBatch({...options,config,fetchImpl:async(url)=>mockResponse(url,ids.map(id=>row(id)))});},
  ...overrides,
 });return {response,progressCalls,batchCalls};
}
test('integrated library uses one batch, no per-chapter reads, and preserves confirmed progress',async()=>{
 const {response,progressCalls,batchCalls}=await libraryRun();assert.equal(response.statusCode,200);assert.equal(progressCalls,0);assert.equal(batchCalls,1);
 assert.equal((response.body.match(/Resume chapter/g)||[]).length,13);assert.equal((response.body.match(/value="40"/g)||[]).length,13);
 assert.match(response.getHeader('cache-control'),/private, no-store/);assert.equal(response.getHeader('vary'),'Cookie, Authorization');assert.equal(response.getHeader('x-robots-tag'),'noindex, nofollow');
 assert.doesNotMatch(response.body,/Saved progress is temporarily unavailable|correctOptionId/);
});
for(const failure of ['unavailable','throw','partial-envelope'])test('library '+failure+' renders unavailable, never zero/completion/resume',async(t)=>{
 const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));
 const {response,progressCalls}=await libraryRun({readProgressBatch:async()=>{
  if(failure==='throw')throw new Error('private provider and account payload');
  if(failure==='partial-envelope')return {status:'complete',rowsByChapter:[]};
  return {status:'unavailable',code:'READ_FAILED'};
 }});
 assert.equal(response.statusCode,200);assert.equal(progressCalls,0);assert.match(response.body,/Saved progress is temporarily unavailable/);
 assert.equal((response.body.match(/>Open chapter</g)||[]).length,13);
 assert.doesNotMatch(response.body.slice(response.body.indexOf('<main')),/<progress|0%|Mastery complete|No mastery attempt|>Start chapter<|>Resume chapter<|private provider/);
 assert.deepEqual(logs,['Guided Edition library progress unavailable.']);
 assert.match(response.body,/role="status" aria-labelledby="library-progress-notice"/);
});
test('complete sparse result retains only genuinely no-visible-row start states',async()=>{
 const {response}=await libraryRun({readProgressBatch:async(options)=>readGuidedLearningProgressBatch({...options,config,fetchImpl:async(url)=>mockResponse(url,[row(ids[0])])})});
 assert.equal((response.body.match(/>Resume chapter</g)||[]).length,1);assert.equal((response.body.match(/>Start chapter</g)||[]).length,12);
 assert.doesNotMatch(response.body,/Progress unavailable/);
});
test('bad account returned by transport cannot enter rendered library',async(t)=>{
 t.mock.method(console,'error',()=>{});
 const {response}=await libraryRun({readProgressBatch:async(options)=>readGuidedLearningProgressBatch({...options,config,fetchImpl:async(url)=>mockResponse(url,[{...row(ids[0]),account_id:otherAccount}])})});
 assert.match(response.body,/Progress unavailable/);assert.doesNotMatch(response.body,/<progress|22222222|value="40"/);
});
test('anonymous branch never loads catalog or batch',async()=>{
 let calls=0;const {response}=await libraryRun({resolveSession:async()=>null,readCatalog:async()=>{calls++;},readProgressBatch:async()=>{calls++;}});
 assert.equal(response.statusCode,302);assert.equal(calls,0);
});
test('nonmember branch never loads catalog or batch',async()=>{
 let calls=0;const {response}=await libraryRun({readAccessState:async()=>({allowed:false,reason:'refunded'}),readCatalog:async()=>{calls++;},readProgressBatch:async()=>{calls++;}});
 assert.equal(response.statusCode,302);assert.equal(calls,0);
});
test('bad catalog stops before progress batch',async(t)=>{
 t.mock.method(console,'error',()=>{});let calls=0;
 const {response}=await libraryRun({readCatalog:async()=>[{bad:true}],readProgressBatch:async()=>{calls++;}});
 assert.equal(response.statusCode,503);assert.equal(calls,0);
});
test('catalog above batch bound remains readable with progress unavailable and no requests',async(t)=>{
 t.mock.method(console,'error',()=>{});const larger=Array.from({length:65},(_,i)=>makeRelease(i+1));let requests=0;
 const {response}=await libraryRun({readCatalog:async()=>larger,readProgressBatch:async(options)=>readGuidedLearningProgressBatch({...options,config,fetchImpl:async()=>{requests++;assert.fail('request');}})});
 assert.equal(response.statusCode,200);assert.equal(requests,0);assert.equal((response.body.match(/>Open chapter</g)||[]).length,65);
});
test('HEAD library keeps privacy headers and sends no response body',async()=>{
 const {response,batchCalls}=await libraryRun({},req({method:'HEAD'}));assert.equal(response.statusCode,200);assert.equal(response.body,'');assert.equal(batchCalls,1);assert.ok(Number(response.getHeader('content-length'))>1000);
});
test('individual chapter path retains old read behavior and never invokes batch',async()=>{
 let batches=0;const {response,progressCalls}=await libraryRun({readProgressBatch:async()=>{batches++;assert.fail('batch');}},req({url:'/api/guided-edition?__paid_path=chapter-1'}));
 assert.equal(response.statusCode,200);assert.equal(progressCalls,1);assert.equal(batches,0);assert.match(response.body,/mastery-form/);
});
test('progress API retains its existing individual read and no batch',async()=>{
 let batches=0;const {response,progressCalls}=await libraryRun({readProgressBatch:async()=>{batches++;assert.fail('batch');}},req({url:'/api/guided-edition?action=progress&contentId='+encodeURIComponent(ids[0])}));
 assert.equal(response.statusCode,200);assert.equal(progressCalls,1);assert.equal(batches,0);
});
