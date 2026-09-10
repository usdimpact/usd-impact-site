import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runIdentityRehearsal, createJsonTransport, tokenRequestUrl,
  DISCOVERY, CALLER, RUNNER_PATH, VERIFIER_SHA256 } from './run.mjs';
import { GITHUB_OIDC_ISSUER, GITHUB_OIDC_JWKS_URI } from './verifier.mjs';

const BASE = Date.parse('2026-09-10T12:00:00.000Z');
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrong = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = pair.publicKey.export({ format: 'jwk' });
const endpoint = 'https://run-actions.fixture.actions.githubusercontent.com/558/idtoken?api-version=2.0';
const SECRET = 'synthetic-request-bearer-never-print';
const context = () => ({ actions: 'true', repository: 'usdimpact/usd-impact-site',
  repositoryId: '1265351071', ownerId: '275107298', ref: 'refs/heads/main', refProtected: 'true',
  eventName: 'workflow_dispatch', runId: '558559', runAttempt: '1', callerSha: 'a'.repeat(40),
  runnerSha: 'b'.repeat(40), checkoutSha: 'b'.repeat(40), workflowRef: CALLER,
  approval: 'identity-only-558-v1' });
const discovery = () => ({ issuer: GITHUB_OIDC_ISSUER, jwks_uri: GITHUB_OIDC_JWKS_URI,
  id_token_signing_alg_values_supported: ['RS256'], claims_supported:
  ['aud','iss','sub','jti','nbf','iat','exp','repository','repository_id','repository_owner',
    'repository_owner_id','ref','ref_type','ref_protected','sha','run_id','run_attempt','workflow_ref','workflow_sha',
    'job_workflow_ref','job_workflow_sha','event_name','repository_visibility','runner_environment','check_run_id'] });
const jwks = () => ({ keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: 'fixture' }] });
function fixture(options = {}) {
  const calls = [], tokens = []; let i = 0;
  const c = { ...context(), ...options.context };
  async function getJson(url, bearer) {
    calls.push({ url, bearer });
    if (url === DISCOVERY) return options.discovery ?? discovery();
    if (url === GITHUB_OIDC_JWKS_URI) return options.jwks ?? jwks();
    i++;
    if (options.networkFailure) throw new Error(SECRET);
    const payload = { iss: GITHUB_OIDC_ISSUER, aud: new URL(url).searchParams.get('audience'),
      sub: 'repo:usdimpact/usd-impact-site:ref:refs/heads/main', jti: `fixture-token-jti-${i}`,
      nbf: BASE/1000-1, iat: BASE/1000-1, exp: BASE/1000+300, repository: c.repository,
      repository_id: c.repositoryId, repository_owner: 'usdimpact', repository_owner_id: c.ownerId,
      ref: c.ref, ref_type: 'branch', ref_protected: true, sha: c.callerSha,
      run_id: c.runId, run_attempt: c.runAttempt, check_run_id: '558123', workflow_ref: CALLER,
      workflow_sha: c.callerSha, job_workflow_ref: `${RUNNER_PATH}@${c.runnerSha}`, job_workflow_sha: c.runnerSha,
      event_name: 'workflow_dispatch', repository_visibility: 'public', runner_environment: 'github-hosted',
      ...options.tokenPatch?.(i) };
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture' })).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${h}.${p}`), (options.wrongKey ? wrong : pair).privateKey).toString('base64url');
    const token = `${h}.${p}.${signature}`; tokens.push(token);
    return options.tokenResponse ? options.tokenResponse(token) : { value: token };
  }
  return { calls, tokens, getJson, run: () => runIdentityRehearsal({ context: c,
    endpoint: options.endpoint ?? endpoint, requestBearer: options.bearer ?? SECRET, getJson,
    now: options.now ?? (() => BASE), nonce: options.nonce ?? (() => 'c'.repeat(64)) }) };
}
const tests = [];
async function test(name, work) {
  try { await work(); tests.push(name); }
  catch (error) { error.message = name + ': ' + error.message; throw error; }
}
function checkFlags(r) {
  assert.equal(r.rehearsalOnly, true);
  for (const k of ['publicationAuthorized','admissionRecorded','enforcementActive','publicResponseObserved']) assert.equal(r[k], false);
}
await test('copied verifier exactly matches reviewed source hash', async () => {
  const b = await readFile(new URL('./verifier.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(b).digest('hex'), VERIFIER_SHA256);
});
await test('two valid synthetic tokens verify without publication capability', async () => {
  const f = fixture(), r = await f.run();
  assert.equal(r.decision, 'PASS_IDENTITY_REHEARSAL_ONLY'); checkFlags(r);
  assert.equal(r.tokensRequested, 2); assert.equal(r.tokensVerified, 2); assert.equal(f.calls.length, 4);
  assert.equal(r.sameExecution, true); assert.equal(r.distinctTokens, true);
  const json = JSON.stringify(r);
  assert(!json.includes(SECRET)); for (const token of f.tokens) assert(!json.includes(token));
  assert(!json.includes('fixture-token-jti')); assert(!json.includes('actions.githubusercontent.com'));
  assert(f.calls.slice(0, 2).every(c => c.bearer === null));
  assert(f.calls.slice(2).every(c => c.bearer === SECRET));
  assert.notEqual(f.calls[2].url, f.calls[3].url);
});
for (const [key, value] of [ ['actions','false'], ['approval',''], ['repository','other/repo'],
  ['repositoryId','1'], ['ownerId','1'], ['ref','refs/heads/feature'], ['refProtected','false'],
  ['eventName','pull_request'], ['runId','bad'], ['runAttempt','2'], ['callerSha','main'],
  ['runnerSha','main'], ['checkoutSha','9'.repeat(40)], ['workflowRef','other'], ['extra','untrusted'] ]) {
  await test(`preflight ${key} drift stops before any request`, async () => {
    const f = fixture({ context: { [key]: value } }), r = await f.run();
    assert.match(r.decision, /^HOLD_/); assert.equal(f.calls.length, 0); checkFlags(r);
  });
}
await test('missing token permission stops before any network', async () => {
  const f = fixture({ bearer: '' }), r = await f.run();
  assert.equal(r.decision, 'HOLD_REHEARSAL_TOKEN_PERMISSION'); assert.equal(f.calls.length, 0);
});
await test('invalid nonce stops before any request', async () => {
  const f = fixture({ nonce: () => 'wrong' }); assert.match((await f.run()).decision, /^HOLD_/); assert.equal(f.calls.length,0);
});
await test('discovery drift stops before token requests', async () => {
  const f = fixture({ discovery: { ...discovery(), issuer:'https://other.example' } }), r = await f.run();
  assert.match(r.decision,/^HOLD_/); assert.equal(r.tokensRequested,0); assert.equal(f.calls.length,1);
});
await test('empty JWKS holds before requesting tokens', async () => {
  const f = fixture({ jwks: { keys: [] } }), r = await f.run(); assert.match(r.decision,/^HOLD_/); assert.equal(r.tokensRequested,0);
});
for (const [label, patch] of [['wrong audience', {aud:'wrong'}], ['wrong issuer', {iss:'wrong'}],
  ['wrong job pin',{job_workflow_sha:'9'.repeat(40)}], ['unprotected signed ref',{ref_protected:false}],
  ['different hosted execution',{run_id:'777'}], ['self-hosted',{runner_environment:'self-hosted'}]]) {
  await test(`challenge ${label} prevents second token request`, async () => {
    const f=fixture({tokenPatch:()=>patch}),r=await f.run();assert.match(r.decision,/^HOLD_/);assert.equal(r.tokensRequested,1);checkFlags(r);
  });
}
for (const [label, patch] of [['run',{run_id:'999'}],['job',{check_run_id:'999'}],['attempt',{run_attempt:'2'}],
  ['same jti',{jti:'fixture-token-jti-1'}],['reversed time',{iat:BASE/1000-2,nbf:BASE/1000-2}]]) {
  await test(`receipt continuity rejects ${label}`,async()=>{
    const f=fixture({tokenPatch:i=>i===2?patch:{}}),r=await f.run();assert.match(r.decision,/^HOLD_/);assert.equal(r.tokensRequested,2);assert.equal(r.tokensVerified,1);checkFlags(r);
  });
}
await test('bad signature never verifies a token',async()=>{const f=fixture({wrongKey:true}),r=await f.run();assert.equal(r.tokensVerified,0);assert.equal(r.tokensRequested,1);});
await test('network failure stops without retry or secret output',async()=>{const f=fixture({networkFailure:true}),r=await f.run();assert.match(r.decision,/^HOLD_/);assert.equal(r.tokensRequested,1);assert(!JSON.stringify(r).includes(SECRET));});
await test('unexpected token response fields rejected',async()=>{const f=fixture({tokenResponse:token=>({value:token,extra:SECRET})}),r=await f.run();assert.equal(r.decision,'HOLD_REHEARSAL_TOKEN_RESPONSE');assert(!JSON.stringify(r).includes(SECRET));});
for (const url of ['http://example.actions.githubusercontent.com/558/idtoken',
  'https://example.actions.githubusercontent.com.evil.test/558/idtoken',
  'https://example.actions.githubusercontent.com:444/558/idtoken',
  'https://user:password@example.actions.githubusercontent.com/558/idtoken',
  'https://example.actions.githubusercontent.com/558/idtoken#fragment',
  'https://127.0.0.1/558/idtoken', 'https://evil.test/558/idtoken']) {
  await test(`disallowed token endpoint ${tests.length}`,async()=>{
    const f=fixture({endpoint:url}),r=await f.run();assert.equal(r.decision,'HOLD_REHEARSAL_TOKEN_ENDPOINT');assert.equal(f.calls.length,0);
  });
}
await test('existing audience is replaced, not duplicated',()=>{
  const aud='urn:usd-impact:public-witness:challenge:sha256:'+'a'.repeat(64);
  const u=new URL(tokenRequestUrl(endpoint+'&audience=old&audience=other',aud));
  assert.deepEqual(u.searchParams.getAll('audience'),[aud]);assert.equal(u.searchParams.get('api-version'),'2.0');
});
function response(url, {status=200,type='application/json',body='{}',redirected=false,length=null}={}) {
  const h={'content-type':type};if(length!==null)h['content-length']=length;
  const r=new Response(body,{status,headers:h});Object.defineProperty(r,'url',{value:url});Object.defineProperty(r,'redirected',{value:redirected});return r;
}
await test('transport uses GET, no redirects, no cookies, and exact trusted destination',async()=>{
  let seen;const t=createJsonTransport({fetchImpl:async(u,o)=>{seen=o;return response(u);}});
  assert.deepEqual(await t(DISCOVERY),{});assert.equal(seen.method,'GET');assert.equal(seen.redirect,'error');assert.equal(seen.credentials,'omit');assert.equal(seen.cache,'no-store');assert(!seen.headers.Authorization);
});
await test('transport prevents arbitrary anonymous destination',async()=>{
  let n=0;const t=createJsonTransport({fetchImpl:async()=>{n++;}});await assert.rejects(()=>t('https://example.com'),e=>e.code==='HOLD_REHEARSAL_DESTINATION');assert.equal(n,0);
});
await test('transport prevents bearer delivery to non-token endpoint',async()=>{
  let n=0;const t=createJsonTransport({fetchImpl:async()=>{n++;}});await assert.rejects(()=>t(DISCOVERY,SECRET));assert.equal(n,0);
});
for (const [label,patch,code] of [['redirect',{redirected:true},'HOLD_REHEARSAL_HTTP'],
  ['non200',{status:403},'HOLD_REHEARSAL_HTTP'],['html',{type:'text/html'},'HOLD_REHEARSAL_CONTENT_TYPE'],
  ['oversized advertised',{length:'100001'},'HOLD_REHEARSAL_BODY_LIMIT'],
  ['oversized streamed',{body:'x'.repeat(70000)},'HOLD_REHEARSAL_BODY_LIMIT'],
  ['invalid JSON',{body:SECRET},'HOLD_REHEARSAL_JSON'],['non-object JSON',{body:'[]'},'HOLD_REHEARSAL_JSON'],
  ['length mismatch',{body:'{}',length:'5'},'HOLD_REHEARSAL_BODY']]) {
  await test(`bounded transport rejects ${label}`,async()=>{
    const t=createJsonTransport({fetchImpl:async u=>response(u,patch)});await assert.rejects(()=>t(DISCOVERY),e=>e.code===code);
  });
}
await test('transport deadline covers a stalled fetch',async()=>{
  const t=createJsonTransport({timeoutMs:20,fetchImpl:()=>new Promise(()=>{})});await assert.rejects(()=>t(DISCOVERY),e=>e.code==='HOLD_REHEARSAL_TIMEOUT');
});
await test('transport deadline covers a stalled body',async()=>{
  const t=createJsonTransport({timeoutMs:20,fetchImpl:async u=>response(u,{body:new ReadableStream({start(){}})})});await assert.rejects(()=>t(DISCOVERY),e=>e.code==='HOLD_REHEARSAL_TIMEOUT');
});
await test('transport errors do not echo remote exception data',async()=>{
  const t=createJsonTransport({fetchImpl:async()=>{throw new Error(SECRET);}});await assert.rejects(()=>t(DISCOVERY),e=>e.message==='HOLD_REHEARSAL_NETWORK');
});
await test('unapproved CLI run stops without token or network',()=>{
  const p=spawnSync(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'--live'],{encoding:'utf8',env:{PATH:process.env.PATH,GITHUB_ACTIONS:'false'}});
  assert.equal(p.status,2);const r=JSON.parse(p.stdout);assert.equal(r.decision,'HOLD_REHEARSAL_NOT_AUTHORIZED');assert.equal(r.requestsAttempted,0);assert.equal(r.tokensRequested,0);assert.equal(p.stderr,'');
});
// Endpoint paths below are deliberately synthetic. No historical runtime URL is known.
const audienceFor = (purpose = 'challenge') => `urn:usd-impact:public-witness:${purpose}:sha256:${'a'.repeat(64)}`;
const opaqueEndpoint = 'https://run-actions.fixture.actions.githubusercontent.com/opaque/runtime/issuance?api-version=2.0&request=synthetic';
for (const path of ['/anything', '/opaque/runtime/issuance', '/synthetic/IdToken/', '/v9/context%2Ffixture/token']) {
  await test(`runtime-owned synthetic path ${path} is not rewritten`, async () => {
    const base = `https://run-actions.fixture.actions.githubusercontent.com${path}?api-version=2.0`;
    const f = fixture({ endpoint: base }), r = await f.run();
    assert.equal(r.decision, 'PASS_IDENTITY_REHEARSAL_ONLY'); checkFlags(r);
    assert.equal(r.tokensRequested, 2); assert.equal(r.tokensVerified, 2);
    assert.equal(f.calls.length, 4);
    assert(f.calls.slice(2).every(c => new URL(c.url).pathname === new URL(base).pathname));
    assert(!JSON.stringify(r).includes(base));
  });
}
await test('opaque runtime path works through the actual bounded transport with synthetic signed responses', async () => {
  const f = fixture(), network = [];
  const transport = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async (url, options) => {
    network.push({ url, options });
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    const bearer = options.headers.Authorization === undefined ? null : options.headers.Authorization.slice('Bearer '.length);
    return response(url, { body: JSON.stringify(await f.getJson(url, bearer)) });
  }});
  const r = await runIdentityRehearsal({ context: context(), endpoint: opaqueEndpoint,
    requestBearer: SECRET, getJson: transport, now: () => BASE, nonce: () => 'c'.repeat(64) });
  assert.equal(r.decision, 'PASS_IDENTITY_REHEARSAL_ONLY'); checkFlags(r);
  assert.equal(r.requestsAttempted, 4); assert.equal(r.tokensRequested, 2); assert.equal(r.tokensVerified, 2);
  assert.equal(network.length, 4);
  assert(network.slice(0, 2).every(c => c.options.headers.Authorization === undefined));
  assert(network.slice(2).every(c => c.options.headers.Authorization === `Bearer ${SECRET}`));
  assert(network.slice(2).every(c => new URL(c.url).pathname === '/opaque/runtime/issuance'));
  assert(!JSON.stringify(r).includes(SECRET));
  assert(!JSON.stringify(r).includes('fixture-token-jti'));
  for (const token of f.tokens) assert(!JSON.stringify(r).includes(token));
});
await test('unbound transport refuses even a well-formed legacy token URL before fetch', async () => {
  let n = 0;
  const t = createJsonTransport({ fetchImpl: async () => { n++; return {}; } });
  await assert.rejects(() => t(tokenRequestUrl(endpoint, audienceFor()), SECRET),
    e => e.code === 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
  assert.equal(n, 0);
});
await test('bound endpoint does not expand anonymous destinations', async () => {
  let n = 0;
  const t = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async () => { n++; } });
  await assert.rejects(() => t(opaqueEndpoint), e => e.code === 'HOLD_REHEARSAL_DESTINATION');
  assert.equal(n, 0);
});
await test('the transport captures the endpoint once rather than reading mutable options again', async () => {
  let reads = 0, seen = null;
  const config = { get tokenEndpoint() { reads++; return reads === 1 ? opaqueEndpoint : endpoint; },
    fetchImpl: async (url) => { seen = url; return response(url); } };
  const t = createJsonTransport(config), url = tokenRequestUrl(opaqueEndpoint, audienceFor());
  await t(url, SECRET); assert.equal(reads, 1); assert.equal(seen, url);
});
for (const [name, mutate] of [
  ['path on same allowed host', u => { u.pathname = '/different/issuance'; }],
  ['legacy suffix on same allowed host', u => { u.pathname = '/558/idtoken'; }],
  ['different allowed host', u => { u.hostname = 'other.actions.githubusercontent.com'; }],
  ['non-audience query value', u => { u.searchParams.set('request', 'changed'); }],
  ['extra query parameter', u => { u.searchParams.set('callback', 'https://untrusted.invalid'); }],
  ['missing query parameter', u => { u.searchParams.delete('request'); }],
  ['fragment', u => { u.hash = 'fragment'; }],
  ['HTTP', u => { u.protocol = 'http:'; }],
  ['nondefault port', u => { u.port = '444'; }],
  ['user information', u => { u.username = 'someone'; }],
  ['foreign host', u => { u.hostname = 'untrusted.invalid'; }],
  ['IP address', u => { u.hostname = '127.0.0.1'; }],
  ['deceptive hostname suffix', u => { u.hostname += '.untrusted.invalid'; }],
  ['duplicate audience', u => { u.searchParams.append('audience', audienceFor()); }],
]) {
  await test(`bound bearer transport rejects ${name} without fetch`, async () => {
    let n = 0;
    const t = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async () => { n++; } });
    const url = new URL(tokenRequestUrl(opaqueEndpoint, audienceFor())); mutate(url);
    await assert.rejects(() => t(url.href, SECRET), e => e.code === 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
    assert.equal(n, 0);
  });
}
for (const [name, value] of [['empty', ''], ['invalid', 'not a URL'], ['null', null], ['object', {}]]) {
  await test(`malformed bearer destination ${name} is sanitized before fetch`, async () => {
    let n = 0;
    const t = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async () => { n++; } });
    await assert.rejects(() => t(value, SECRET), e => e.message === 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
    assert.equal(n, 0);
  });
}
await test('bound endpoint permits both validated audiences and only one audience parameter', async () => {
  let n = 0;
  const captured = `${opaqueEndpoint}&audience=old&audience=duplicate`;
  const t = createJsonTransport({ tokenEndpoint: captured, fetchImpl: async url => {
    n++; const u = new URL(url);
    assert.equal(u.pathname, '/opaque/runtime/issuance');
    assert.equal(u.searchParams.get('request'), 'synthetic');
    assert.equal(u.searchParams.getAll('audience').length, 1);
    return response(url);
  }});
  for (const phase of ['challenge', 'receipt']) await t(tokenRequestUrl(captured, audienceFor(phase)), SECRET);
  assert.equal(n, 2);
});
for (const name of ['missing', 'unrecognized']) {
  await test(`bound transport rejects ${name} audience before fetch`, async () => {
    let n = 0;
    const t = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async () => { n++; } });
    const url = new URL(opaqueEndpoint);
    if (name === 'unrecognized') url.searchParams.set('audience', 'arbitrary');
    await assert.rejects(() => t(url.href, SECRET), e => e.code === 'HOLD_REHEARSAL_AUDIENCE');
    assert.equal(n, 0);
  });
}
for (const [label, invalidEndpoint] of [
  ['HTTP', 'http://fixture.actions.githubusercontent.com/opaque'],
  ['foreign hostname', 'https://untrusted.invalid/opaque'],
  ['lookalike hostname', 'https://fixture.actions.githubusercontent.com.untrusted.invalid/opaque'],
  ['bare parent hostname', 'https://actions.githubusercontent.com/opaque'],
  ['userinfo', 'https://user:pass@fixture.actions.githubusercontent.com/opaque'],
  ['port', 'https://fixture.actions.githubusercontent.com:444/opaque'],
  ['fragment', 'https://fixture.actions.githubusercontent.com/opaque#fragment'],
  ['malformed', 'not-a-url'],
  ['oversize', `https://fixture.actions.githubusercontent.com/${'x'.repeat(4096)}`],
  ['control whitespace', 'https://fixture.actions.githubusercontent.com/opa\nque'],
]) {
  await test(`invalid captured endpoint ${label} cannot construct a bearer transport`, () => {
    let n = 0;
    assert.throws(() => createJsonTransport({ tokenEndpoint: invalidEndpoint, fetchImpl: async () => { n++; } }),
      e => e.code === 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
    assert.equal(n, 0);
  });
}
await test('mismatched harness and transport endpoints cannot send a bearer', async () => {
  const f = fixture(), seen = [];
  const t = createJsonTransport({ tokenEndpoint: opaqueEndpoint, fetchImpl: async (u, o) => {
    seen.push(o); return response(u, { body: JSON.stringify(await f.getJson(u, null)) });
  }});
  const r = await runIdentityRehearsal({ context: context(), endpoint,
    requestBearer: SECRET, getJson: t, now: () => BASE, nonce: () => 'c'.repeat(64) });
  assert.equal(r.decision, 'HOLD_REHEARSAL_TOKEN_ENDPOINT'); checkFlags(r);
  assert.equal(r.tokensVerified, 0); assert.equal(seen.length, 2);
  assert(seen.every(o => o.headers.Authorization === undefined));
  // Harness attempts increment before transport rejection; no provider issuance is claimed.
  assert.equal(r.tokensRequested, 1); assert.equal(r.requestsAttempted, 3);
});
await test('token response cannot redirect receipt traffic to another endpoint', async () => {
  const f = fixture({ tokenResponse: token => ({ value: token, endpoint: 'https://untrusted.invalid' }) });
  const r = await f.run();
  assert.equal(r.decision, 'HOLD_REHEARSAL_TOKEN_RESPONSE'); assert.equal(r.tokensRequested, 1);
  assert.equal(r.tokensVerified, 0); assert.equal(f.calls.length, 3); checkFlags(r);
});
await test('CLI refuses additional endpoint override arguments without any request', () => {
  const p = spawnSync(process.execPath, [new URL('./run.mjs', import.meta.url).pathname,
    '--live', '--endpoint=https://untrusted.invalid'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(p.status, 2); assert.equal(p.stderr, '');
  const r = JSON.parse(p.stdout);
  assert.equal(r.decision, 'HOLD_REHEARSAL_MODE'); assert.equal(r.requestsAttempted, 0);
});

await test('final audience-bearing URL retains the existing 4096-character request bound', async () => {
  let n = 0;
  const prefix = 'https://fixture.actions.githubusercontent.com/opaque?request=';
  const base = prefix + 'x'.repeat(4090 - prefix.length);
  const t = createJsonTransport({ tokenEndpoint: base, fetchImpl: async () => { n++; } });
  const outgoing = tokenRequestUrl(base, audienceFor());
  assert(outgoing.length > 4096);
  await assert.rejects(() => t(outgoing, SECRET), e => e.code === 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
  assert.equal(n, 0);
});

const report={decision:'PASS_OFFLINE_REHEARSAL_TESTS',engine:process.version,testsPassed:tests.length,tests,
  liveTokensRequested:0,network:'synthetic adapters only',managedDatabaseTouched:false,workflowInstalled:false};
if (process.env.OIDC_REHEARSAL_TEST_REPORT) await writeFile(process.env.OIDC_REHEARSAL_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(`OIDC rehearsal preparation: ${tests.length} offline groups passed; synthetic signatures and transport only; no real token or workflow.`);
