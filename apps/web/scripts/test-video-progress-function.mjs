import assert from 'node:assert/strict';
import { handleVideoProgressRequest } from '../src/lib/video-progress-handler.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const accessToken = 'eyJhbGciOiJIUzI1NiJ9.video-progress-test-token.signature';
const accountId = '11111111-1111-4111-8111-111111111111';

function request({ method = 'GET', url = '/api/video-progress', authenticated = false, body = null, json = false } = {}) {
  return {
    method,
    url,
    body,
    headers: {
      host: 'usd-impact-site-test-usd-impact.vercel.app',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
      ...(json ? { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' } : {}),
    },
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

const active = async () => ({ allowed: true, reason: 'active', user: { id: accountId } });

const anonymous = responseRecorder();
await handleVideoProgressRequest(request(), anonymous);
assert.equal(anonymous.statusCode, 401);

const unpaid = responseRecorder();
await handleVideoProgressRequest(request({ authenticated: true }), unpaid, {
  readAccessState: async () => ({ allowed: false, reason: 'missing', user: { id: accountId } }),
});
assert.equal(unpaid.statusCode, 403);

const getResponse = responseRecorder();
await handleVideoProgressRequest(
  request({ authenticated: true, url: '/api/video-progress?slug=dollar-yields-liquidity' }),
  getResponse,
  {
    readAccessState: active,
    readProgress: async (args) => {
      assert.equal(args.accountId, accountId);
      assert.equal(args.contentId, 'video:dollar-yields-liquidity');
      return [{ account_id: args.accountId, content_id: args.contentId, status: 'in_progress', progress_percent: 44, resume_position: '24.0' }];
    },
  },
);
assert.equal(getResponse.statusCode, 200);
assert.equal(JSON.parse(getResponse.body).progress.progress_percent, 44);

const contentType = responseRecorder();
await handleVideoProgressRequest(request({ method: 'POST', authenticated: true, body: {} }), contentType, {
  readAccessState: active,
});
assert.equal(contentType.statusCode, 415);

let upsertArgs = null;
const postResponse = responseRecorder();
await handleVideoProgressRequest(
  request({
    method: 'POST',
    authenticated: true,
    json: true,
    body: { slug: 'dollar-yields-liquidity', positionSeconds: 55.1, status: 'in_progress' },
  }),
  postResponse,
  {
    readAccessState: active,
    upsertProgress: async (args) => {
      upsertArgs = args;
      return { account_id: args.accountId, content_id: args.contentId, status: args.status, progress_percent: args.progressPercent, resume_position: args.resumePositionSeconds, data: { contentType: 'video', durationSeconds: args.durationSeconds } };
    },
  },
);
assert.equal(postResponse.statusCode, 200);
assert.equal(upsertArgs.contentId, 'video:dollar-yields-liquidity');
assert.equal(upsertArgs.status, 'completed');
assert.equal(upsertArgs.progressPercent, 100);

const invalid = responseRecorder();
await handleVideoProgressRequest(
  request({ method: 'POST', authenticated: true, json: true, body: { slug: 'missing-film', positionSeconds: 2 } }),
  invalid,
  { readAccessState: active },
);
assert.equal(invalid.statusCode, 404);

console.log('Video progress API tests passed.');

// Combined provider -> real handler response contracts; all I/O is injected.
const storage = await import('../src/lib/supabase-server.js');
const { getVideo } = await import('../src/data/video-library.js');
const testSlug = 'dollar-yields-liquidity';
const testDuration = Number(getVideo(testSlug).durationSeconds);
const apiChecks = [];
async function apiCheck(name, test) { await test(); apiChecks.push(name); }
function checkpoint(changes = {}) {
  return { account_id: accountId, content_id: `video:${testSlug}`, status: 'in_progress',
    progress_percent: 20, resume_position: '1.0',
    data: {contentType:'video',durationSeconds:testDuration},...changes };
}
const fixedConfig = { url:'https://offline.invalid',publishableKey:'synthetic-test-key',secretKey:null };
async function callRoute({ method='GET',rows=[],fetchImpl,slug=testSlug,rawBody,denied=false }={}) {
  const rec=responseRecorder();
  await handleVideoProgressRequest(request({method,authenticated:true,json:method==='POST',
    url:slug?`/api/video-progress?slug=${slug}`:'/api/video-progress',
    body:method==='POST'?(rawBody??{slug:testSlug,positionSeconds:1,status:'in_progress'}):null}),rec,{
    resolveSession:async()=>({accessToken,value:{allowed:!denied,user:{id:accountId}}}),
    readAccessState:async()=>{throw new Error('Real identity verification is not part of this fixture');},
    readProgress:fetchImpl?args=>storage.readOwnVideoProgress({...args,config:fixedConfig,fetchImpl}):async()=>rows,
    upsertProgress:fetchImpl?args=>storage.upsertOwnVideoProgress({...args,config:fixedConfig,fetchImpl}):async()=>rows[0],
  });
  assert.equal(rec.getHeader('cache-control'),'no-store');
  assert.equal(rec.getHeader('vary'),'Cookie, Authorization');
  assert.ok(!rec.body.includes('PRIVATE_DIAGNOSTIC'));
  return rec;
}
await apiCheck('single/list empty shape at actual HTTP boundary',async()=>{
  assert.deepEqual(JSON.parse((await callRoute()).body),{progress:null});
  assert.deepEqual(JSON.parse((await callRoute({slug:null})).body),{progress:[]});
});
for(const byteLimit of [16373,16384]) await apiCheck(`padded provider response ${byteLimit} accepted by compact API on save and reload`,async()=>{
  let saved;let writes=0;
  const fetchImpl=async(u,o)=>{
    if(o.method==='GET')return new Response(JSON.stringify(saved?[saved]:[]),{headers:{'content-type':'application/json'}});
    writes++;saved=JSON.parse(o.body);saved.data.padding='';
    saved.data.padding='x'.repeat(byteLimit-Buffer.byteLength(JSON.stringify([saved])));
    assert.equal(Buffer.byteLength(JSON.stringify([saved])),byteLimit);
    return new Response(JSON.stringify([saved]),{status:201,headers:{'content-type':'application/json'}});
  };
  const savedResponse=await callRoute({method:'POST',fetchImpl});
  assert.equal(savedResponse.statusCode,200); assert.ok(Buffer.byteLength(savedResponse.body)<1024);
  assert.equal(JSON.parse(savedResponse.body).progress.resume_position,1);
  assert.equal(Object.hasOwn(JSON.parse(savedResponse.body).progress.data,'padding'),false);
  const reloaded=await callRoute({fetchImpl});assert.equal(reloaded.statusCode,200);
  assert.deepEqual(JSON.parse(reloaded.body),JSON.parse(savedResponse.body));assert.equal(writes,1);
});
await apiCheck('provider overflow still rejects acknowledgement without a retry',async()=>{
  let writes=0;
  const fetchImpl=async(u,o)=>{
    const body=o.method==='GET'?[]:[{...JSON.parse(o.body),padding:'x'.repeat(16384)}];
    if(o.method==='POST')writes++;
    return new Response(JSON.stringify(body),{status:o.method==='GET'?200:201,headers:{'content-type':'application/json'}});
  };
  const rec=await callRoute({method:'POST',fetchImpl});assert.equal(rec.statusCode,409);
  assert.equal(JSON.parse(rec.body).code,'VIDEO_PROGRESS_SAVE_UNCONFIRMED');assert.equal(writes,1);
});
await apiCheck('all-video response retains Continue timestamp and completion fields',async()=>{
  const rec=await callRoute({slug:null,rows:[checkpoint({updated_at:'2026-09-23T22:00:00+02:00',data:{contentType:'video',durationSeconds:testDuration,privatePadding:'PRIVATE_DIAGNOSTIC'}})]});
  assert.equal(rec.statusCode,200);const row=JSON.parse(rec.body).progress[0];
  assert.equal(row.updated_at,'2026-09-23T20:00:00.000Z');assert.equal(row.content_id,`video:${testSlug}`);
  assert.equal(row.progress_percent,20);assert.equal(row.status,'in_progress');
});
for(const method of ['GET','POST'])for(const variant of ['foreign','missing','bad-updated'])await apiCheck(`${method} projection ${variant} fails safely`,async()=>{
  const value=variant==='foreign'?checkpoint({account_id:'other'}):variant==='missing'?checkpoint({resume_position:undefined}):checkpoint({updated_at:'not-a-date'});
  const rec=await callRoute({method,rows:[value]});assert.equal(rec.statusCode,method==='GET'?502:409);
  assert.equal(rec.getHeader('retry-after'),undefined);
});
for(const phase of ['initial-read','pre-write-read','write'])for(const raw of [null,'0','60','61','malformed'])await apiCheck(`actual handler ${phase} Retry-After ${raw}`,async()=>{
  let writes=0;
  const fetchImpl=async(u,o)=>{
    if(o.method==='POST')writes++;
    if(phase==='write'&&o.method==='GET')return new Response('[]',{headers:{'content-type':'application/json'}});
    return new Response('{"message":"PRIVATE_DIAGNOSTIC"}',{status:429,headers:{'content-type':'application/json',...(raw===null?{}:{'Retry-After':raw})}});
  };
  const rec=await callRoute({method:phase==='initial-read'?'GET':'POST',fetchImpl});
  const stopped=raw==='61'||raw==='malformed';
  assert.equal(rec.statusCode,stopped?409:429);
  assert.equal(rec.getHeader('retry-after'),stopped||raw===null?undefined:raw);
  assert.equal(writes,phase==='write'?1:0);
  assert.equal(JSON.parse(rec.body).code,stopped?'VIDEO_PROGRESS_RETRY_DEFERRED':'VIDEO_PROGRESS_REQUEST_REJECTED');
});
await apiCheck('denied access still makes zero storage requests',async()=>{
  let calls=0;const rec=await callRoute({method:'POST',denied:true,fetchImpl:async()=>{calls++;throw new Error('Forbidden');}});
  assert.equal(rec.statusCode,403);assert.equal(calls,0);
});
await apiCheck('invalid response on dispatched write never turns into retryable 502',async()=>{
  const rec=await callRoute({method:'POST',rows:[undefined]});
  assert.equal(rec.statusCode,409);assert.equal(JSON.parse(rec.body).code,'VIDEO_PROGRESS_SAVE_UNCONFIRMED');
});
console.log(JSON.stringify({suite:'video-progress-handler-g1g2',passed:apiChecks.length,checks:apiChecks}));
