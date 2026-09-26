import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreviewMetadata, collectPreviewMetadata, PREVIEW_TARGET,
  MAX_RESPONSE_BYTES } from './integrity-watchdog-capacity-preview.mjs';
import { health, fixPacket, assertSafeArtifact } from './integrity-watchdog-policy.mjs';

const NOW = '2026-09-24T14:00:00.000Z';
const createdAt = Date.parse('2026-09-24T13:00:00.000Z');
const env = () => ({
  USDIMPACT_WATCHDOG_VERCEL_TOKEN: 'synthetic-dedicated-test-credential',
  USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID: PREVIEW_TARGET.projectId,
  USDIMPACT_WATCHDOG_VERCEL_TEAM_ID: PREVIEW_TARGET.teamId,
});
const row = (changes = {}) => ({ id: 'env_synthetic01', key: 'SUPABASE_URL',
  target: ['preview'], gitBranch: PREVIEW_TARGET.branch, createdAt, updatedAt: createdAt, ...changes });
const payload = rows => ({ envs: rows ?? [row()] });
function response(url, value, { status = 200, headers = {}, raw = false, redirected = false } = {}) {
  const r = new Response(raw ? value : JSON.stringify(value), { status,
    headers: { 'Content-Type': 'application/json', ...headers } });
  Object.defineProperty(r, 'url', { value: url });
  Object.defineProperty(r, 'redirected', { value: redirected });
  return r;
}
async function collect(value = payload(), changes = {}, responseOptions = {}) {
  return collectPreviewMetadata({ activationApproved: true, env: env(), now: () => NOW,
    fetchImpl: async url => response(url, value, responseOptions), ...changes });
}
const deniedFetch = async () => { throw new Error('A network call was not authorized by this test.'); };

// Values are deliberately synthetic and must never appear in returned artifacts.
test('default disabled invocation does not read credentials or call a transport', async () => {
  let reads = 0, calls = 0;
  const guardEnv = new Proxy({}, { get() { reads++; throw new Error('must not read'); } });
  const r = await collectPreviewMetadata({ env: guardEnv, now: () => NOW, fetchImpl: async () => { calls++; } });
  assert.equal(r.normalized.code, 'ACTIVATION_NOT_APPROVED'); assert.equal(reads, 0); assert.equal(calls, 0);
});
test('truthy strings are not activation approval', async () => {
  const r = await collect(payload(), { activationApproved: 'true', fetchImpl: deniedFetch });
  assert.equal(r.normalized.code, 'ACTIVATION_NOT_APPROVED');
});
test('wrong project or team stops before requesting provider data', async () => {
  for (const key of ['USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID', 'USDIMPACT_WATCHDOG_VERCEL_TEAM_ID']) {
    const e = env(); e[key] = 'unapproved_scope';
    const r = await collect(payload(), { env: e, fetchImpl: deniedFetch });
    assert.equal(r.normalized.code, 'DEDICATED_SCOPE_NOT_VERIFIED');
  }
});
test('general credential cannot replace a missing dedicated credential', async () => {
  const e = env(); delete e.USDIMPACT_WATCHDOG_VERCEL_TOKEN;
  e.USDIMPACT_VERCEL_TOKEN = 'must-not-be-used'; e.VERCEL_TOKEN = 'must-not-be-used';
  const r = await collect(payload(), { env: e, fetchImpl: deniedFetch });
  assert.equal(r.normalized.code, 'DEDICATED_CREDENTIAL_UNAVAILABLE');
});
test('credential shape with whitespace or short length is rejected without echo', async () => {
  for (const credential of ['tiny', 'value-with\nnewline-abcdef', 'value with space abcdef']) {
    const r = await collect(payload(), { env: { ...env(), USDIMPACT_WATCHDOG_VERCEL_TOKEN: credential }, fetchImpl: deniedFetch });
    assert.equal(r.normalized.code, 'DEDICATED_CREDENTIAL_UNAVAILABLE'); assert.ok(!JSON.stringify(r).includes(credential));
  }
});
test('no ambient fetch fallback exists', async () => {
  const r = await collect(payload(), { fetchImpl: undefined });
  assert.equal(r.normalized.code, 'TRUSTED_TRANSPORT_UNAVAILABLE');
});
test('exact one-request native contract: correct project/team, GET and decrypt=false', async () => {
  const calls = [];
  const r = await collect(payload(), { fetchImpl: async (url, options) => {
    calls.push({url, options}); return response(url, payload());
  } });
  assert.equal(calls.length, 1); const { url, options } = calls[0]; const u = new URL(url);
  assert.equal(u.origin, 'https://api.vercel.com');
  assert.equal(u.pathname, `/v10/projects/${PREVIEW_TARGET.projectId}/env`);
  assert.deepEqual([...u.searchParams.entries()], [['decrypt','false'],['teamId',PREVIEW_TARGET.teamId]]);
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
  assert.equal(options.headers.Authorization, `Bearer ${env().USDIMPACT_WATCHDOG_VERCEL_TOKEN}`);
  assert.equal(options.body, undefined); assert.ok(options.signal.aborted);
  assert.equal(r.normalized.status, 'COLLECTED'); assert.equal(r.contracts[0].outcome, 'PASS');
  assert.equal(r.contracts[1].outcome, 'UNKNOWN'); assert.equal(health(r.contracts).status, 'AMBER');
});
test('valid metadata does not reconstruct prior save, values, or deployed binding', async () => {
  const r = await collect(); assert.equal(r.normalized.priorMutationReconciled, false);
  assert.equal(r.normalized.effectiveDeploymentBindingProved, false); assert.equal(r.capacityValidated, false);
  assert.equal(r.writesOrDeploymentsAuthorized, false); assert.equal(r.installed, false);
});
test('value getters on the selected URL and unrelated key are not read', () => {
  const selected = row(), other = { key: 'SUPABASE_SECRET_KEY' };
  for (const r of [selected, other]) Object.defineProperty(r, 'value', { enumerable: true, get() { throw new Error('must not read value'); } });
  const n = normalizePreviewMetadata(payload([selected, other]), NOW);
  assert.equal(n.status, 'COLLECTED'); assert.equal(n.records.length, 1);
});
test('NEXT_PUBLIC_SUPABASE_URL and similarly named fields are not exact matches', () => {
  const p = payload([row(), row({id:'env_other01', key:'NEXT_PUBLIC_SUPABASE_URL'}), { key:'SUPABASE_URL_OLD' }]);
  const n = normalizePreviewMetadata(p, NOW); assert.equal(n.exactKeyRecordCount, 1);
});
test('raw values, opaque ciphertext, comments, creator and hints are omitted', async () => {
  const marker = 'private-fixture-marker-not-for-output';
  const p = payload([row({ value:marker, vsmValue:marker, comment:marker, contentHint:marker,
    createdBy:marker, lastEditedBy:marker }), {key:'UNRELATED', value:marker}]);
  const r = await collect(p); assert.ok(!JSON.stringify(r).includes(marker)); assertSafeArtifact(r.contracts);
});
test('documented no-branch metadata is retained as general, never selected as override', async () => {
  const p = payload([row({gitBranch:null, target:['development','preview']})]);
  const r = await collect(p); assert.equal(r.normalized.records[0].branchRelation,'no_branch_restriction_returned');
  assert.equal(r.contracts[1].outcome,'UNKNOWN');
});
test('omitted gitBranch does not get the approved branch inserted', () => {
  const r = row(); delete r.gitBranch; const n = normalizePreviewMetadata(payload([r]), NOW);
  assert.equal(n.records[0].gitBranch, null);
});
test('previously reported short branch remains distinct', async () => {
  const r = await collect(payload([row({gitBranch:'video-progress-combined'})]));
  assert.equal(r.normalized.records[0].branchRelation,'previously_reported_short_branch');
  assert.equal(r.contracts[1].outcome,'UNKNOWN');
});
test('unrelated branch names are not exported', () => {
  const n = normalizePreviewMetadata(payload([row({gitBranch:'private-other-branch'})]),NOW);
  assert.equal(n.records[0].otherBranchNameOmitted,true); assert.ok(!JSON.stringify(n).includes('private-other-branch'));
});
test('widening the exact branch to Production is a configuration failure', async () => {
  const r = await collect(payload([row({target:['preview','production']})]));
  assert.equal(r.contracts[1].outcome,'FAIL'); const fix = fixPacket(r.contracts[1]);
  assert.equal(fix.status,'PROPOSED_ONLY'); assert.equal(fix.human_approval_required,true);
});
test('duplicate exact branch records remain unresolved, not last-record-wins', async () => {
  const r = await collect(payload([row(), row({id:'env_synthetic02'})]));
  assert.equal(r.contracts[1].outcome,'UNKNOWN'); assert.match(r.contracts[1].summary,/Multiple/);
});
test('duplicate native IDs invalidate the metadata set', () => {
  assert.equal(normalizePreviewMetadata(payload([row(),row()]),NOW).code,'NATIVE_ID_INVALID_OR_DUPLICATE');
});
test('empty list cannot prove no historic save occurred', async () => {
  const r = await collect(payload([])); assert.equal(r.normalized.records.length,0);
  assert.equal(r.contracts[1].outcome,'UNKNOWN'); assert.equal(r.normalized.exhaustiveHistoricalInventoryProved,false);
});
test('paginated, partial or error envelopes are not silently interpreted as a full list', () => {
  for (const extra of [{pagination:{next:123}},{error:'do-not-echo'},{partial:true}]) {
    const n = normalizePreviewMetadata({...payload(),...extra},NOW);
    assert.equal(n.code,'NATIVE_ENVELOPE_REQUIRES_REVIEW'); assert.ok(!JSON.stringify(n).includes('do-not-echo'));
  }
});
test('custom environment IDs cannot be dropped while declaring Preview-only', () => {
  assert.equal(normalizePreviewMetadata(payload([row({customEnvironmentIds:['env_custom']})]),NOW).code,'CUSTOM_ENVIRONMENT_REQUIRES_REVIEW');
});
test('malformed, duplicated and unknown target fields remain UNKNOWN', () => {
  for (const target of [null,'preview',[],['preview','preview'],['staging'],true]) {
    assert.equal(normalizePreviewMetadata(payload([row({target})]),NOW).status,'UNKNOWN');
  }
});
test('the text undefined or a search URL is not a branch', () => {
  for (const gitBranch of ['undefined','null','',true,'https://example.invalid']) {
    assert.equal(normalizePreviewMetadata(payload([row({gitBranch})]),NOW).status,'UNKNOWN');
  }
});
test('missing, future, reversed and nonnumeric native timestamps are not invented', () => {
  for (const changes of [{updatedAt:undefined},{createdAt:'yesterday'},{updatedAt:createdAt-1},{updatedAt:Date.parse(NOW)+1},{updatedAt:true}]) {
    assert.equal(normalizePreviewMetadata(payload([row(changes)]),NOW).status,'UNKNOWN');
  }
});
test('invalid observation timestamps fail closed', () => {
  for (const at of [null,'2026-02-30T00:00:00.000Z','today']) assert.equal(normalizePreviewMetadata(payload(),at).status,'UNKNOWN');
});
test('bounded number of provider variables and selected URL rows', () => {
  assert.equal(normalizePreviewMetadata(payload(Array(1001).fill({key:'OTHER'})),NOW).status,'UNKNOWN');
  const rows=Array.from({length:21},(_,i)=>row({id:`env_record_${i}`}));
  assert.equal(normalizePreviewMetadata(payload(rows),NOW).code,'URL_RECORD_LIMIT');
});
test('provider rows without usable key information cannot disappear from coverage', () => {
  assert.equal(normalizePreviewMetadata(payload([row(),{}]),NOW).status,'UNKNOWN');
});
test('non-200 HTTP responses do not export provider bodies or retry', async () => {
  for (const status of [401,403,429,500]) {
    let calls=0; const r=await collect(payload(),{fetchImpl:async url=>{calls++;return response(url,'private-marker',{status,raw:true});}});
    assert.equal(calls,1); assert.equal(r.normalized.status,'UNKNOWN'); assert.ok(!JSON.stringify(r).includes('private-marker'));
  }
});
test('redirects and final-URL mismatches are refused', async () => {
  const a=await collect(payload(),{}, {redirected:true}); assert.equal(a.normalized.status,'UNKNOWN');
  const b=await collect(payload(),{fetchImpl:async()=>response('https://example.invalid',payload())}); assert.equal(b.normalized.status,'UNKNOWN');
});
test('partial-response headers stop collection', async () => {
  for (const headers of [{'Content-Range':'0-1/4'},{Link:'<next>; rel="next"'}]) {
    const r=await collect(payload(),{}, {headers}); assert.equal(r.normalized.code,'NATIVE_PARTIAL_RESPONSE');
  }
});
test('HTML response, malformed JSON, and invalid UTF-8 cannot pass', async () => {
  const cases=[['<html/>',{raw:true,headers:{'Content-Type':'text/html'}}],['{broken',{raw:true}],
    [new Uint8Array([0xff,0xfe]),{raw:true}]];
  for (const [body,options] of cases) assert.equal((await collect(body,{},options)).normalized.status,'UNKNOWN');
});
test('content-length and actual streamed bytes are both bounded', async () => {
  const a=await collect(payload(),{}, {headers:{'Content-Length':String(MAX_RESPONSE_BYTES+1)}});
  assert.equal(a.normalized.code,'NATIVE_RESPONSE_TOO_LARGE');
  const b=await collect(' '.repeat(MAX_RESPONSE_BYTES+1),{}, {raw:true});
  assert.equal(b.normalized.code,'NATIVE_RESPONSE_TOO_LARGE');
});
test('transport exception details and credential-shaped strings stay private', async () => {
  const r=await collect(payload(),{fetchImpl:async()=>{throw new Error('Bearer private-sensitive-marker');}});
  assert.ok(!JSON.stringify(r).includes('private-sensitive-marker')); assert.equal(r.normalized.status,'UNKNOWN');
});
test('the full five-second budget includes stalled headers with no second request', async () => {
  let calls=0; const start=performance.now();
  const r=await collect(payload(),{fetchImpl:async()=>{calls++;return new Promise(()=>{});}});
  assert.equal(calls,1); assert.equal(r.normalized.code,'NATIVE_COLLECTION_FAILED_OR_TIMED_OUT');
  assert.ok(performance.now()-start>=4900); assert.ok(performance.now()-start<9000);
});
test('the same budget includes stalled response bodies and cancellation', async () => {
  let cancelled=false, signal;
  const r=await collect(payload(),{fetchImpl:async(url,options)=>{
    signal=options.signal;
    const s=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"envs":['));},cancel(){cancelled=true;}});
    return response(url,s,{raw:true});
  }});
  assert.equal(r.normalized.status,'UNKNOWN'); assert.ok(signal.aborted); assert.equal(cancelled,true);
});
test('watchdog report, artifact check and proposed fix packet preserve the hold', async () => {
  const r=await collect(); assertSafeArtifact(r.contracts);
  assert.equal(r.contracts[0].gold_eligible,false); assert.equal(r.contracts[1].classification,'E_UNKNOWN');
  const fix=fixPacket(r.contracts[1],NOW); assert.equal(fix.human_approval_required,true);
  assert.equal(health(r.contracts).status,'AMBER');
});
