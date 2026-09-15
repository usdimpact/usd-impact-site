import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createFirstPublicationWitnessHandler } from '../src/lib/publication-first-response-witness.js';
import { encodeWitnessChallengePayload, witnessChallengeSigningBytes, witnessManifestSha256,
  createWitnessChallengeVerifier } from '../src/lib/publication-witness-challenge.js';
import { createWitnessReceiptRecorder } from '../src/lib/publication-witness-receipt-recorder.js';
import { encodeWitnessReceiptPayload, witnessReceiptSigningBytes } from '../src/lib/publication-witness-receipt-verifier.js';
import { SCOPE } from '../src/lib/publication-receipt-verifier.js';

const pair = generateKeyPairSync('ed25519');
const other = generateKeyPairSync('ed25519');
const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
const fingerprint = createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const BASE = Date.parse('2026-09-11T12:29:50.000Z');
const iso = (offset = 0) => new Date(BASE + offset).toISOString();
const PATH = '/news/catalysts/fixture-cpi-preview';
const ORIGIN = 'https://www.usd-impact.com';
const ATTEMPT = '1'.repeat(32); const CHALLENGE = '2'.repeat(32); const KEY = 'public-witness-fixture';
const BODY = '<!doctype html><title>CPI preview</title><p>fixture only</p>';
function manifest(patch = {}) {
  return { schema: 'public-response-witness-manifest/v1', challengeId: CHALLENGE, canonicalOrigin: ORIGIN, ...SCOPE,
    deploymentId: 'dpl_WitnessFixtureOnly', path: PATH, attemptId: ATTEMPT, responseSha256: sha(BODY),
    method: 'GET', status: 200, boundaryVersion: 'publication-dispatch/v1', ...patch };
}
function binding(m = manifest(), patch = {}) {
  return { ...SCOPE, target: 'production', exposure: 'public-approved', deploymentId: m.deploymentId,
    commitSha: 'a'.repeat(40), artifactSha256: 'b'.repeat(64), manifestSha256: witnessManifestSha256(m), approvalSha256: 'c'.repeat(64),
    path: m.path, sourceSha256: 'd'.repeat(64), responseSha256: m.responseSha256, eventIdentity: 'BLS:CPI:2026-08:initial',
    phase: 'preview', releaseAt: iso(10000), checkedAt: iso(-10000), validUntil: iso(9000), attemptId: m.attemptId,
    surface: 'article', method: 'GET', status: 200, boundaryVersion: 'publication-dispatch/v1', ...patch };
}
function snapshot(patch = {}) {
  return { observedAt: iso(-1000), validUntil: iso(8000), keys: [{ keyId: KEY, purpose: 'public-response-witness', publicKeyPem: pem,
    notBefore: iso(-100000), notAfter: iso(100000), revoked: false, ...patch }] };
}
function challenge(m = manifest(), patch = {}, signingPair = pair) {
  const p = { schema: 'public-response-witness-challenge/v1', keyId: KEY, audience: 'publication-first-response-probe',
    manifest: m, manifestSha256: witnessManifestSha256(m), issuedAt: iso(-500), expiresAt: iso(6000), ...patch };
  const text = encodeWitnessChallengePayload(p);
  return JSON.stringify({ payload: Buffer.from(text).toString('base64url'),
    signature: sign(null, witnessChallengeSigningBytes(text), signingPair.privateKey).toString('base64url') });
}
function receipt(b, witnessContext, { dispatchedAt = iso(10), finishedAt = iso(100), keyId = KEY, signingPair = pair } = {}) {
  const p = { schema: 'first-public-dispatch/v2', keyId, audience: 'publication-history-recorder', ...b,
    canonicalOrigin: witnessContext.canonicalOrigin, challengeId: witnessContext.challengeId,
    challengeSha256: witnessContext.challengeSha256, witnessManifestSha256: witnessContext.manifestSha256,
    dispatchedAt, finishedAt };
  const text = encodeWitnessReceiptPayload(p);
  return JSON.stringify({ payload: Buffer.from(text).toString('base64url'),
    signature: sign(null, witnessReceiptSigningBytes(text), signingPair.privateKey).toString('base64url') });
}
function attempt(m = manifest(), patch = {}) {
  const b = binding(m); return { attemptId: ATTEMPT, state: 'pending', binding: b, keyId: KEY,
    keyFingerprint: fingerprint, validUntil: b.validUntil, ...patch };
}
function memoryRecorder({ current, clock, getClaim, keys = () => snapshot(), commitMode = 'ok' }) {
  let stored = null;
  const recorder = createWitnessReceiptRecorder({
    now: () => clock.value,
    loadAttempt: async () => current.value,
    loadWitnessKeySnapshot: async () => keys(),
    loadChallengeClaim: async () => getClaim(),
    commitWitnessReceipt: async ({ attemptId, envelope, payload, verificationDeadline, challengeId }) => {
      if (commitMode === 'throw') throw new Error('network');
      if (commitMode === 'none') return;
      const p = JSON.parse(payload);
      stored = { schema: 'stored-witness-dispatch-receipt/v2', attemptId, challengeId,
        challengeSha256: p.challengeSha256, canonicalOrigin: p.canonicalOrigin,
        receiptSha256: sha(envelope), payloadSha256: sha(payload), path: current.value.binding.path,
        sourceSha256: current.value.binding.sourceSha256, admittedAt: p.finishedAt,
        recordedAt: new Date(clock.value).toISOString(), verificationDeadline, state: 'admitted' };
    },
    readWitnessReceipt: async () => stored,
  });
  return { record: recorder.record.bind(recorder), getStored: () => stored };
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function held(result, pattern = /^HOLD_/) { assert.match(result.decision, pattern); assert.equal(result.publicationAuthorized, false); }

// Protocol-level challenge tests.
test('valid dedicated witness challenge verifies assertion only', async () => {
  const m = manifest(), b = binding(m); const r = createWitnessChallengeVerifier({ now: () => BASE })(challenge(m),
    { keySnapshot: snapshot(), expected: { attemptId: ATTEMPT, deploymentId: b.deploymentId, path: PATH,
      responseSha256: b.responseSha256, manifestSha256: b.manifestSha256, canonicalOrigin: ORIGIN } });
  assert.equal(r.decision, 'VERIFIED_PUBLIC_WITNESS_CHALLENGE'); assert.equal(r.publicationAuthorized, false);
});
for (const [name, mutate] of [
  ['preview origin', (m) => { m.canonicalOrigin = 'https://fixture.vercel.app'; }],
  ['wrong deployment', (m) => { m.deploymentId = 'dpl_OtherFixtureOnly'; }],
  ['wrong path', (m) => { m.path = '/news/catalysts/other'; }],
  ['wrong response hash', (m) => { m.responseSha256 = 'f'.repeat(64); }],
]) test('challenge binding rejects '+name, async () => {
  const good = manifest(), b = binding(good), altered = manifest(); mutate(altered);
  const r = createWitnessChallengeVerifier({ now: () => BASE })(challenge(altered), { keySnapshot: snapshot(), expected: {
    attemptId: ATTEMPT, deploymentId: b.deploymentId, path: PATH, responseSha256: b.responseSha256,
    manifestSha256: b.manifestSha256, canonicalOrigin: ORIGIN } }); held(r);
});
test('challenge signed by other key is rejected', async () => {
  const m = manifest(), b = binding(m); held(createWitnessChallengeVerifier({ now: () => BASE })(challenge(m, {}, other),
    { keySnapshot: snapshot(), expected: { attemptId: ATTEMPT, deploymentId: b.deploymentId, path: PATH,
      responseSha256: b.responseSha256, manifestSha256: b.manifestSha256, canonicalOrigin: ORIGIN } }), /^HOLD_WITNESS_SIGNATURE$/);
});
test('wrong key purpose is rejected', async () => {
  const m = manifest(), b = binding(m); held(createWitnessChallengeVerifier({ now: () => BASE })(challenge(m),
    { keySnapshot: snapshot({ purpose: 'deployment-signer' }), expected: { attemptId: ATTEMPT, deploymentId: b.deploymentId,
      path: PATH, responseSha256: b.responseSha256, manifestSha256: b.manifestSha256, canonicalOrigin: ORIGIN } }), /^HOLD_WITNESS_KEY$/);
});
test('revoked witness key is rejected', async () => {
  const m = manifest(), b = binding(m); held(createWitnessChallengeVerifier({ now: () => BASE })(challenge(m),
    { keySnapshot: snapshot({ revoked: true }), expected: { attemptId: ATTEMPT, deploymentId: b.deploymentId,
      path: PATH, responseSha256: b.responseSha256, manifestSha256: b.manifestSha256, canonicalOrigin: ORIGIN } }), /^HOLD_WITNESS_KEY$/);
});
test('expired witness challenge is rejected', async () => {
  const m = manifest(), b = binding(m); held(createWitnessChallengeVerifier({ now: () => BASE + 7000 })(challenge(m),
    { keySnapshot: { ...snapshot(), observedAt: iso(6500), validUntil: iso(12000) }, expected: { attemptId: ATTEMPT,
      deploymentId: b.deploymentId, path: PATH, responseSha256: b.responseSha256, manifestSha256: b.manifestSha256,
      canonicalOrigin: ORIGIN } }), /^HOLD_WITNESS_EXPIRED$/);
});

async function runHttp({ rawChallenge = challenge(), mutateAttempt, renderBody = BODY, claimDecision = 'CLAIMED_WITNESS_CHALLENGE',
  receiptMode = 'valid', host = 'fixture.vercel.app', forwardedHost = 'www.usd-impact.com', clockStart = BASE } = {}) {
  const clock = { value: clockStart }; const current = { value: attempt() }; if (mutateAttempt) mutateAttempt(current);
  let durableClaim = null;
  const recorder = memoryRecorder({ current, clock, getClaim: () => durableClaim }); let renders = 0, records = 0, claims = 0;
  let resolveReceipt;
  const receiptPromise = new Promise((resolve) => { resolveReceipt = resolve; });
  const recordWitnessReceipt = async (id, envelope, witnessContext) => { records++; return recorder.record(id, envelope, witnessContext); };
  const handler = createFirstPublicationWitnessHandler({ attemptId: ATTEMPT, path: PATH, canonicalOrigin: ORIGIN,
    now: () => clock.value, preparationTimeoutMs: 1000, witnessTimeoutMs: 1000,
    loadAttempt: async () => current.value, loadWitnessKeySnapshot: async () => snapshot(),
    claimChallenge: async (input) => {
      claims++;
      if (claimDecision !== 'CLAIMED_WITNESS_CHALLENGE') return { decision: claimDecision, attemptId: ATTEMPT, challengeId: input.challengeId };
      durableClaim = { schema: 'stored-witness-challenge-claim/v1', ...input, claimedAt: iso(0) };
      return { decision: claimDecision, attemptId: ATTEMPT, challengeId: input.challengeId, canonicalOrigin: input.canonicalOrigin };
    },
    render: async () => { renders++; return renderBody; }, awaitReceipt: async () => receiptPromise, recordWitnessReceipt });
  let serverResultResolve; const serverResult = new Promise((resolve) => { serverResultResolve = resolve; });
  const server = http.createServer((req, res) => { handler(req, res).then(serverResultResolve); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      const headers = { Host: host, 'X-Forwarded-Host': forwardedHost };
      if (rawChallenge !== null) headers['X-USD-Impact-Witness-Challenge'] = rawChallenge;
      const req = http.request({ host: '127.0.0.1', port: address.port, path: PATH, method: 'GET', headers }, (res) => {
        const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === 200) {
            clock.value = BASE + 100;
            const witnessContext = { canonicalOrigin: durableClaim.canonicalOrigin, challengeId: durableClaim.challengeId,
              challengeSha256: durableClaim.challengeSha256, manifestSha256: durableClaim.manifestSha256 };
            const raw = receipt(current.value.binding, witnessContext, receiptMode === 'wrong-signature' ? { signingPair: other }
              : receiptMode === 'wrong-key' ? { keyId: 'public-witness-other' } : {});
            resolveReceipt(receiptMode === 'timeout' ? new Promise(() => {}) : raw);
          } else resolveReceipt('');
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }); req.on('error', reject); req.end();
    });
    if (receiptMode === 'timeout') resolveReceipt = () => {};
    const result = await serverResult;
    return { response, result, renders, records, claims, stored: recorder.getStored(), durableClaim };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('authenticated canonical witness probe records exact receipt', async () => {
  const x = await runHttp(); assert.equal(x.response.status, 200); assert.equal(x.response.body, BODY);
  assert.equal(x.response.headers['cache-control'], 'private, no-store, max-age=0');
  assert.equal(x.result.decision, 'WITNESS_RECEIPT_RECORDED'); assert.equal(x.result.admissionRecorded, true);
  assert.equal(x.result.publicationAuthorized, false); assert.equal(x.renders, 1); assert.equal(x.records, 1); assert.ok(x.stored);
});
test('Host spoof without signed challenge cannot receive candidate', async () => {
  const x = await runHttp({ rawChallenge: null, host: 'www.usd-impact.com' }); assert.equal(x.response.status, 404);
  assert.notEqual(x.response.body, BODY); assert.equal(x.renders, 0); assert.equal(x.records, 0); held(x.result);
});
test('forwarded Host spoof without signed challenge cannot receive candidate', async () => {
  const x = await runHttp({ rawChallenge: null, forwardedHost: 'www.usd-impact.com' }); assert.equal(x.response.status, 404);
  assert.equal(x.renders, 0); assert.equal(x.records, 0);
});
test('invalid signed challenge cannot receive candidate', async () => {
  const m = manifest(); const x = await runHttp({ rawChallenge: challenge(m, {}, other) }); assert.equal(x.response.status, 404);
  assert.equal(x.renders, 0); assert.equal(x.records, 0);
});
test('Preview-origin challenge cannot mint history', async () => {
  const m = manifest({ canonicalOrigin: 'https://fixture.vercel.app' }); const x = await runHttp({ rawChallenge: challenge(m) });
  assert.equal(x.response.status, 404); assert.equal(x.records, 0); assert.equal(x.renders, 0);
});
test('single-use claim rejects challenge replay before body dispatch', async () => {
  const x = await runHttp({ claimDecision: 'ALREADY_CLAIMED' }); assert.equal(x.response.status, 404);
  assert.equal(x.renders, 0); assert.equal(x.records, 0); held(x.result, /^HOLD_WITNESS_CHALLENGE_REPLAY$/);
});
test('response hash mismatch fails before witness probe dispatch', async () => {
  const x = await runHttp({ renderBody: BODY + 'changed' }); assert.equal(x.response.status, 503);
  assert.equal(x.records, 0); held(x.result, /^HOLD_RESPONSE_BINDING$/);
});
test('attempt binding drift fails before probe dispatch', async () => {
  let calls = 0; const clock = { value: BASE }; const current = { value: attempt() };
  const handler = createFirstPublicationWitnessHandler({ attemptId: ATTEMPT, path: PATH, canonicalOrigin: ORIGIN,
    now: () => clock.value, preparationTimeoutMs: 1000, witnessTimeoutMs: 1000,
    loadAttempt: async () => { calls++; const x = structuredClone(current.value); if (calls > 1) x.binding.approvalSha256 = '9'.repeat(64); return x; },
    loadWitnessKeySnapshot: async () => snapshot(), claimChallenge: async ({ challengeId }) => ({ decision:'CLAIMED_WITNESS_CHALLENGE',attemptId:ATTEMPT,challengeId }),
    render: async () => BODY, awaitReceipt: async () => '', recordWitnessReceipt: async () => ({}) });
  const server = http.createServer((req,res)=>handler(req,res)); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const a=server.address();
  const r=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:a.port,path:PATH,headers:{'X-USD-Impact-Witness-Challenge':challenge()}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
  await new Promise(r=>server.close(r)); assert.equal(r,503);
});
test('wrong receipt signature cannot be recorded', async () => {
  const x = await runHttp({ receiptMode: 'wrong-signature' }); assert.equal(x.response.status, 200); assert.equal(x.records, 1);
  assert.equal(x.result.admissionRecorded, false); held(x.result, /^HOLD_WITNESS_RECORDING$/);
});
test('wrong receipt key cannot be recorded', async () => {
  const x = await runHttp({ receiptMode: 'wrong-key' }); assert.equal(x.response.status, 200); assert.equal(x.records, 1);
  assert.equal(x.result.admissionRecorded, false);
});
test('request Host and forwarded Host are not used as canonical proof', async () => {
  const x = await runHttp({ host: 'evil.example', forwardedHost: 'www.usd-impact.com' });
  assert.equal(x.response.status, 200); assert.equal(x.result.decision, 'WITNESS_RECEIPT_RECORDED');
  // Success is based on the signed canonical-origin manifest and receipt, not these headers.
});
test('private Preview activity without witness receipt never records history', async () => {
  const clock = { value: BASE }, current = { value: attempt() }; let records = 0;
  const handler = createFirstPublicationWitnessHandler({ attemptId: ATTEMPT, path: PATH, canonicalOrigin: ORIGIN,
    now: () => clock.value, preparationTimeoutMs: 1000, witnessTimeoutMs: 30,
    loadAttempt: async () => current.value, loadWitnessKeySnapshot: async () => snapshot(),
    claimChallenge: async ({challengeId}) => ({decision:'CLAIMED_WITNESS_CHALLENGE',attemptId:ATTEMPT,challengeId}),
    render: async () => BODY, awaitReceipt: async () => new Promise(() => {}), recordWitnessReceipt: async () => { records++; return {}; } });
  let out; const server=http.createServer((req,res)=>handler(req,res).then(r=>{out=r;})); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const a=server.address();
  const status=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:a.port,path:PATH,headers:{Host:'preview.vercel.app','X-USD-Impact-Witness-Challenge':challenge()}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
  await new Promise(r=>setTimeout(r,50)); await new Promise(r=>server.close(r)); assert.equal(status,200); assert.equal(records,0);
  assert.equal(out?.admissionRecorded,false); held(out, /^HOLD_WITNESS_TIMEOUT$/);
});
test('preflight-like caller claims are ignored without witness challenge', async () => {
  const x = await runHttp({ rawChallenge: null, host: 'www.usd-impact.com' }); assert.equal(x.records,0); assert.equal(x.claims,0);
});

for (const [name, fn] of tests) { try { await fn(); } catch (error) { error.message = name+': '+error.message; throw error; } }
console.log(`Publication first-response witness: ${tests.length} groups passed (real loopback HTTP and Ed25519; synthetic witness/provider state; no live route, database or Production activation).`);
