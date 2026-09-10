import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createPublicationOidcEvidenceBridge, publicationChallengeEvidenceSha256,
  publicationReceiptEvidenceSha256 } from '../src/lib/publication-oidc-evidence-bridge.js';
import { encodeWitnessChallengePayload, witnessManifestSha256,
  witnessChallengeSigningBytes } from '../src/lib/publication-witness-challenge.js';
import { encodeWitnessReceiptPayload, witnessReceiptSigningBytes } from '../src/lib/publication-witness-receipt-verifier.js';
import { normalizeGitHubOidcJwks, githubOidcWitnessAudience } from '../src/lib/publication-github-oidc-witness.js';
import { SCOPE } from '../src/lib/publication-receipt-verifier.js';

// Ephemeral local keys and synthetic inputs only. No token, issuer, article, database,
// server, workflow or provider access is used by this suite.
const B = Date.parse('2026-09-11T12:29:50.000Z');
const iso = (n) => new Date(n).toISOString();
const hash = (v) => createHash('sha256').update(v).digest('hex');
const copy = (v) => JSON.parse(JSON.stringify(v));
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ed = generateKeyPairSync('ed25519'), otherEd = generateKeyPairSync('ed25519');
const jwk = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'bridge-fixture', alg: 'RS256', use: 'sig' };
const pack = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signed = (payload, purpose, key = ed.privateKey) => {
  const text = purpose === 'challenge' ? encodeWitnessChallengePayload(payload) : encodeWitnessReceiptPayload(payload);
  const bytes = purpose === 'challenge' ? witnessChallengeSigningBytes(text) : witnessReceiptSigningBytes(text);
  return JSON.stringify({ payload: Buffer.from(text).toString('base64url'), signature: sign(null, bytes, key).toString('base64url') });
};
function fixture(phase = 'preview') {
  const path = phase === 'none' ? '/news/2026-09-11' : '/news/catalysts/synthetic-cpi-preview';
  const manifest = { schema: 'public-response-witness-manifest/v1', challengeId: 'c'.repeat(32),
    canonicalOrigin: 'https://www.usd-impact.com', ...SCOPE, deploymentId: 'dpl_SyntheticOnly12345',
    path, attemptId: 'a'.repeat(32), responseSha256: hash('<p>Synthetic response fixture.</p>'),
    method: 'GET', status: 200, boundaryVersion: 'publication-dispatch/v1' };
  const manifestSha256 = witnessManifestSha256(manifest);
  const binding = { ...SCOPE, target: 'production', exposure: 'public-approved', deploymentId: manifest.deploymentId,
    commitSha: 'b'.repeat(40), artifactSha256: '1'.repeat(64), manifestSha256, approvalSha256: '2'.repeat(64), path,
    sourceSha256: '3'.repeat(64), responseSha256: manifest.responseSha256,
    eventIdentity: phase === 'none' ? null : 'BLS:CPI:2026-08:initial', phase,
    releaseAt: phase === 'none' ? null : iso(phase === 'preview' ? B + 10000 : B - 6000),
    checkedAt: iso(B - 5000), validUntil: iso(B + 10000), attemptId: manifest.attemptId,
    surface: 'article', method: 'GET', status: 200, boundaryVersion: 'publication-dispatch/v1' };
  const challenge = { schema: 'public-response-witness-challenge/v1', keyId: 'public-witness-fixture',
    audience: 'publication-first-response-probe', manifest, manifestSha256,
    issuedAt: iso(B - 2000), expiresAt: iso(B + 10000) };
  const challengeEnvelope = signed(challenge, 'challenge');
  const claim = { schema: 'stored-witness-challenge-claim/v1', attemptId: manifest.attemptId,
    challengeId: manifest.challengeId, challengeSha256: hash(challengeEnvelope), manifestSha256,
    canonicalOrigin: manifest.canonicalOrigin, claimedAt: iso(B - 1500), validUntil: iso(B + 10000) };
  const receipt = { schema: 'first-public-dispatch/v2', keyId: challenge.keyId, audience: 'publication-history-recorder',
    ...binding, canonicalOrigin: manifest.canonicalOrigin, challengeId: manifest.challengeId,
    challengeSha256: hash(challengeEnvelope), witnessManifestSha256: manifestSha256,
    dispatchedAt: iso(B - 1000), finishedAt: iso(B - 500) };
  const policy = { schema: 'publication-oidc-evidence-policy/v1',
    workflowRef: `${SCOPE.repository}/.github/workflows/synthetic-witness.yml@refs/heads/main`,
    workflowSha: 'd'.repeat(40),
    jobWorkflowRef: `${SCOPE.repository}/.github/workflows/synthetic-witness-runner.yml@${'e'.repeat(40)}`,
    jobWorkflowSha: 'e'.repeat(40), eventName: 'workflow_dispatch', runId: '101', runAttempt: '1', checkRunId: '202',
    approvedAt: iso(B - 10000), validUntil: iso(B + 60000) };
  const context = { attempt: { attemptId: manifest.attemptId, state: 'pending', keyId: challenge.keyId,
    keyFingerprint: hash(ed.publicKey.export({ type: 'spki', format: 'der' })), validUntil: iso(B + 10000), binding },
    challengeClaim: claim,
    witnessKeySnapshot: { observedAt: iso(B - 1000), validUntil: iso(B + 10000), keys: [{ keyId: challenge.keyId,
      purpose: 'public-response-witness', publicKeyPem: ed.publicKey.export({ type: 'spki', format: 'pem' }),
      notBefore: iso(B - 10000), notAfter: iso(B + 60000), revoked: false }] },
    jwksSnapshot: normalizeGitHubOidcJwks({ keys: [jwk] }, { observedAt: iso(B - 1000), validUntil: iso(B + 60000) }) };
  const packet = { schema: 'publication-oidc-evidence/v1', challengeEnvelope, challengeToken: '',
    receiptEnvelope: signed(receipt, 'receipt'), receiptToken: '' };
  function token(purpose, evidence, delta = {}) {
    const claims = { iss: 'https://token.actions.githubusercontent.com',
      aud: githubOidcWitnessAudience({ purpose, evidenceSha256: evidence }), sub: 'synthetic-subject-not-live',
      jti: `synthetic-${purpose}-jti`, nbf: (B - 1000) / 1000, iat: (purpose === 'challenge' ? B - 1000 : B) / 1000,
      exp: (B + 60000) / 1000, repository: SCOPE.repository, repository_id: '1265351071',
      repository_owner: 'usdimpact', repository_owner_id: '275107298', ref: 'refs/heads/main', ref_type: 'branch',
      ref_protected: true, sha: policy.workflowSha, workflow_ref: policy.workflowRef, workflow_sha: policy.workflowSha,
      job_workflow_ref: policy.jobWorkflowRef, job_workflow_sha: policy.jobWorkflowSha, event_name: 'workflow_dispatch',
      repository_visibility: 'public', runner_environment: 'github-hosted',
      run_id: policy.runId, run_attempt: policy.runAttempt, check_run_id: policy.checkRunId, ...delta };
    const value = `${pack({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })}.${pack(claims)}`;
    return `${value}.${sign('RSA-SHA256', Buffer.from(value), rsa.privateKey).toString('base64url')}`;
  }
  function tokens(first = {}, second = {}) {
    packet.challengeToken = token('challenge', publicationChallengeEvidenceSha256(packet.challengeEnvelope), first);
    packet.receiptToken = token('receipt', publicationReceiptEvidenceSha256(packet.challengeEnvelope, packet.challengeToken, packet.receiptEnvelope), second);
  }
  tokens();
  return { policy, context: copy(context), packet, challenge, receipt, tokens, token,
    raw: () => JSON.stringify(packet) };
}
const groups = [];
function test(name, fn) {
  try { fn(); groups.push(name); } catch (error) { console.error(`FAILED: ${name}`); throw error; }
}
function verify(f, now = () => B, raw = f.raw()) {
  return createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy, now })(raw, f.context);
}
function flags(r) {
  for (const key of ['publicationAuthorized','admissionRecorded','enforcementActive','publicResponseObserved','replayConsumed']) assert.equal(r[key], false);
}
function held(r) {
  assert.match(r.decision, /^HOLD_OIDC_EVIDENCE_/); flags(r);
  for (const key of ['identityAuthenticated','witnessLinked','evidenceBound']) assert.equal(r[key], false);
}
const savedFetch = globalThis.fetch; let fetchCalls = 0;
globalThis.fetch = () => { fetchCalls++; throw new Error('Network forbidden in offline bridge tests'); };
try {
  for (const phase of ['preview','outcome','none']) test(`valid ${phase} dual proof binds evidence without admission`, () => {
    const f = fixture(phase), r = verify(f);
    assert.equal(r.decision, 'VERIFIED_IDENTITY_BOUND_WITNESS_EVIDENCE'); flags(r);
    assert.equal(r.schema, 'publication-oidc-evidence-result/v1');
    assert.equal(r.identityAuthenticated, true); assert.equal(r.witnessLinked, true); assert.equal(r.evidenceBound, true);
    assert.equal(r.receiptSha256, hash(f.packet.receiptEnvelope)); assert.equal(r.evidenceSha256, hash(f.raw()));
    assert.equal(r.runId, '101'); assert.equal(r.checkRunId, '202'); assert(Object.isFrozen(r));
  });
  test('audiences derive from independently reconstructed domain-separated exact bytes', () => {
    const f = fixture(), challenge = hash('usd-impact/publication-oidc-evidence/challenge/v1\n' + f.packet.challengeEnvelope);
    const receipt = hash('usd-impact/publication-oidc-evidence/receipt/v1\n' + JSON.stringify({
      challengeEvidenceSha256: challenge, challengeTokenSha256: hash(f.packet.challengeToken), receiptSha256: hash(f.packet.receiptEnvelope) }));
    assert.equal(publicationChallengeEvidenceSha256(f.packet.challengeEnvelope), challenge);
    assert.equal(publicationReceiptEvidenceSha256(f.packet.challengeEnvelope, f.packet.challengeToken, f.packet.receiptEnvelope), receipt);
    assert.notEqual(challenge, receipt);
  });
  for (const [name, mutate] of [
    ['unapproved run', f => { f.policy.runId = '999'; }],
    ['unapproved job', f => { f.policy.checkRunId = '999'; }],
    ['caller revision', f => { f.policy.workflowSha = 'f'.repeat(40); }],
    ['runner revision', f => { f.policy.jobWorkflowSha = 'f'.repeat(40); f.policy.jobWorkflowRef = f.policy.jobWorkflowRef.replace('e'.repeat(40), 'f'.repeat(40)); }],
    ['caller workflow', f => { f.policy.workflowRef = f.policy.workflowRef.replace('synthetic-witness.yml','different.yml'); }],
    ['runner workflow', f => { f.policy.jobWorkflowRef = f.policy.jobWorkflowRef.replace('synthetic-witness-runner.yml','different.yml'); }],
  ]) test(`approved policy rejects changed ${name}`, () => { const f = fixture(); mutate(f); held(verify(f)); });
  for (const [name, delta] of [
    ['run', { run_id: '999' }], ['attempt', { run_attempt: '2' }], ['job', { check_run_id: '999' }],
    ['reused jti', { jti: 'synthetic-challenge-jti' }], ['earlier iat', { iat: (B - 2000) / 1000, nbf: (B - 2000) / 1000 }],
    ['wrong audience', { aud: 'synthetic-rehearsal-audience' }], ['repository', { repository_id: '999' }],
    ['unprotected main', { ref_protected: false }], ['runner environment', { runner_environment: 'self-hosted' }],
    ['signature issuer', { iss: 'https://untrusted.invalid' }],
  ]) test(`receipt identity rejects ${name}`, () => { const f = fixture(); f.tokens({}, delta); held(verify(f)); });
  test('receipt token cannot detach from the exact authenticated challenge token', () => {
    const f = fixture(); f.packet.challengeToken = f.token('challenge', publicationChallengeEvidenceSha256(f.packet.challengeEnvelope), { jti: 'another-valid-challenge' });
    held(verify(f));
  });
  test('synthetic rehearsal digest cannot authenticate a publication challenge', () => {
    const f = fixture(); f.packet.challengeToken = f.token('challenge', hash('identity-rehearsal-only/558-v1'));
    f.packet.receiptToken = f.token('receipt', publicationReceiptEvidenceSha256(f.packet.challengeEnvelope, f.packet.challengeToken, f.packet.receiptEnvelope));
    held(verify(f));
  });
  for (const field of ['path','deploymentId','commitSha','artifactSha256','approvalSha256','sourceSha256','responseSha256','eventIdentity','phase','releaseAt','checkedAt','validUntil','attemptId']) {
    test(`a re-signed receipt cannot override trusted ${field}`, () => {
      const f = fixture();
      const replacements = { path: '/news/catalysts/another-event', deploymentId: 'dpl_OtherFixture123', commitSha: 'f'.repeat(40),
        artifactSha256: 'f'.repeat(64), approvalSha256: 'f'.repeat(64), sourceSha256: 'f'.repeat(64), responseSha256: 'f'.repeat(64),
        eventIdentity: 'BLS:CPI:2026-07:initial', phase: 'outcome', releaseAt: iso(B + 9000), checkedAt: iso(B - 6000),
        validUntil: iso(B + 9000), attemptId: 'f'.repeat(32) };
      f.receipt[field] = replacements[field]; f.packet.receiptEnvelope = signed(f.receipt, 'receipt'); f.tokens(); held(verify(f));
    });
  }
  test('receipt signature is mandatory even with valid OIDC assertions of its bytes', () => {
    const f = fixture(); f.packet.receiptEnvelope = signed(f.receipt, 'receipt', otherEd.privateKey); f.tokens(); held(verify(f));
  });
  test('challenge signature is mandatory even with valid OIDC assertions of its bytes', () => {
    const f = fixture(); f.packet.challengeEnvelope = signed(f.challenge, 'challenge', otherEd.privateKey);
    f.context.challengeClaim.challengeSha256 = hash(f.packet.challengeEnvelope); f.receipt.challengeSha256 = hash(f.packet.challengeEnvelope);
    f.packet.receiptEnvelope = signed(f.receipt, 'receipt'); f.tokens(); held(verify(f));
  });
  for (const [name, mutate] of [
    ['fingerprint', f => { f.context.attempt.keyFingerprint = 'f'.repeat(64); }],
    ['key identity', f => { f.context.attempt.keyId = 'public-witness-other'; }],
    ['revocation', f => { f.context.witnessKeySnapshot.keys[0].revoked = true; }],
    ['key purpose', f => { f.context.witnessKeySnapshot.keys[0].purpose = 'other-purpose'; }],
    ['key expiration', f => { f.context.witnessKeySnapshot.keys[0].notAfter = iso(B); }],
    ['key snapshot expiration', f => { f.context.witnessKeySnapshot.validUntil = iso(B); }],
    ['JWT signing key', f => { f.context.jwksSnapshot.keys[0].n = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'jwk' }).n; }],
    ['JWKS expiration', f => { f.context.jwksSnapshot.validUntil = iso(B); }],
    ['attempt state', f => { f.context.attempt.state = 'revoked'; }],
    ['attempt expiration', f => { f.context.attempt.validUntil = iso(B); }],
    ['claim identity', f => { f.context.challengeClaim.challengeId = 'f'.repeat(32); }],
    ['claim digest', f => { f.context.challengeClaim.challengeSha256 = 'f'.repeat(64); }],
    ['claim manifest', f => { f.context.challengeClaim.manifestSha256 = 'f'.repeat(64); }],
    ['claim origin', f => { f.context.challengeClaim.canonicalOrigin = 'https://preview.invalid'; }],
    ['claim expiration', f => { f.context.challengeClaim.validUntil = iso(B); }],
    ['claim before issued challenge', f => { f.context.challengeClaim.claimedAt = iso(B - 3000); }],
    ['claim extending challenge', f => { f.context.challengeClaim.validUntil = iso(B + 11000); }],
    ['missing claim', f => { f.context.challengeClaim = null; }],
  ]) test(`trusted state rejects ${name}`, () => { const f = fixture(); mutate(f); held(verify(f)); });
  for (const name of ['publication-oidc-rehearsal-558.yml','publication-oidc-endpoint-diagnostic-558.yml','publication-oidc-rehearsal-controller.yml']) {
    test(`rehearsal/diagnostic workload is not an evidence policy: ${name}`, () => {
      const f = fixture(); f.policy.workflowRef = `${SCOPE.repository}/.github/workflows/${name}@refs/heads/main`;
      assert.throws(() => createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy }), /HOLD_OIDC_EVIDENCE_POLICY/);
    });
  }
  for (const [name, mutate] of [
    ['extra assertion', p => { p.verified = true; }], ['nonmanual trigger', p => { p.eventName = 'push'; }],
    ['rerun attempt', p => { p.runAttempt = '2'; }], ['oversized approval window', p => { p.validUntil = iso(B + 900001); }],
    ['mutable runner ref', p => { p.jobWorkflowRef = p.jobWorkflowRef.replace('e'.repeat(40), 'main'); }],
    ['wrong owner', p => { p.workflowRef = p.workflowRef.replace('usdimpact/', 'another/'); }],
  ]) test(`policy rejects ${name}`, () => { const f = fixture(); mutate(f.policy); assert.throws(() => createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy }), /HOLD_OIDC_EVIDENCE_/); });
  test('approval has not started', () => { const f = fixture(); f.policy.approvedAt = iso(B + 1); held(verify(f)); });
  test('approval has expired', () => { const f = fixture(); f.policy.validUntil = iso(B); held(verify(f)); });
  test('original challenge identity freshness is checked again at the end', () => {
    const f = fixture(); f.tokens({ iat: (B - 29000) / 1000, nbf: (B - 29000) / 1000 });
    let count = 0; assert.equal(verify(f, () => { count++; return B; }).decision, 'VERIFIED_IDENTITY_BOUND_WITNESS_EVIDENCE');
    let at = 0; const r = verify(f, () => ++at === count ? B + 1000 : B);
    assert.equal(r.decision, 'HOLD_OIDC_EVIDENCE_EXPIRED'); held(r);
  });
  test('final policy deadline crossing is rejected', () => {
    const f = fixture(); f.policy.validUntil = iso(B + 1); let count = 0; verify(f, () => { count++; return B; });
    let at = 0; held(verify(f, () => ++at === count ? B + 1 : B));
  });
  test('exact preview release time is never accepted', () => { held(verify(fixture(), () => B + 10000)); });
  test('clock reversal is rejected across one verifier instance', () => {
    const f = fixture(); let n = B;
    const verifier = createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy, now: () => n });
    assert.equal(verifier(f.raw(), f.context).evidenceBound, true); n--; held(verifier(f.raw(), f.context));
  });
  test('stateless verification is not falsely reported as durable replay consumption', () => {
    const f = fixture(), v = createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy, now: () => B });
    const a = v(f.raw(), f.context), b = v(f.raw(), f.context); assert.deepEqual(a, b); assert.equal(b.replayConsumed, false);
  });
  test('policy changes after construction do not mutate the captured authorization', () => {
    const f = fixture(), v = createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy, now: () => B });
    f.policy.runId = '999'; assert.equal(v(f.raw(), f.context).evidenceBound, true);
  });
  test('new verification observes revocation in the newly supplied protected snapshot', () => {
    const f = fixture(), v = createPublicationOidcEvidenceBridge({ workflowPolicy: f.policy, now: () => B });
    assert.equal(v(f.raw(), f.context).evidenceBound, true); f.context.witnessKeySnapshot.keys[0].revoked = true; held(v(f.raw(), f.context));
  });
  for (const [name, transform] of [
    ['not JSON', () => 'secret-input-do-not-print'], ['null', () => 'null'], ['oversized', () => 'x'.repeat(100001)],
    ['leading whitespace', s => ' ' + s], ['extra verdict', s => s.replace('{', '{"verified":true,')],
    ['duplicate key', s => s.replace('{', '{"schema":"publication-oidc-evidence/v1",')],
    ['prototype member', s => s.replace('{', '{"__proto__":{},')], ['nontext input', () => ({ verified: true })],
  ]) test(`evidence packet rejects ${name}`, () => { const f = fixture(); held(verify(f, () => B, transform(f.raw()))); });
  test('canonical signed payload and envelope rules are retained', () => {
    const f = fixture(); f.packet.receiptEnvelope = ' ' + f.packet.receiptEnvelope; held(verify(f));
  });
  test('legacy signer-only v1 receipt cannot enter the bridge', () => {
    const f = fixture(), e = JSON.parse(f.packet.receiptEnvelope), p = JSON.parse(Buffer.from(e.payload, 'base64url'));
    p.schema = 'first-public-dispatch/v1'; e.payload = pack(p); f.packet.receiptEnvelope = JSON.stringify(e); held(verify(f));
  });
  test('precomputed verification flags cannot substitute for raw proofs', () => {
    const f = fixture(); f.packet.challengeToken = JSON.stringify({ identityAuthenticated: true }); held(verify(f));
  });
  for (const name of ['getter','toJSON','cycle','symbol','sparse array','custom prototype']) test(`unsafe trusted adapter shape fails closed: ${name}`, () => {
    const f = fixture(); let invoked = 0;
    if (name === 'getter') Object.defineProperty(f.context.attempt, 'state', { enumerable: true, get() { invoked++; return 'pending'; } });
    if (name === 'toJSON') f.context.toJSON = () => { invoked++; return {}; };
    if (name === 'cycle') f.context.loop = f.context;
    if (name === 'symbol') f.context[Symbol('hidden')] = true;
    if (name === 'sparse array') f.context.witnessKeySnapshot.keys = new Array(1);
    if (name === 'custom prototype') Object.setPrototypeOf(f.context, { inherited: true });
    held(verify(f)); assert.equal(invoked, 0);
  });
  test('success and failure reports do not contain tokens, claims, keys or signed payloads', () => {
    const f = fixture(), ok = JSON.stringify(verify(f)); f.packet.receiptToken += '-bad'; const no = JSON.stringify(verify(f));
    for (const secret of [f.packet.challengeToken, f.packet.receiptToken, f.packet.challengeEnvelope,
      f.packet.receiptEnvelope, 'synthetic-challenge-jti', 'synthetic-subject-not-live', f.context.witnessKeySnapshot.keys[0].publicKeyPem]) {
      assert(!ok.includes(secret)); assert(!no.includes(secret));
    }
  });
  test('digest helper errors expose only fixed codes, never raw malformed input', () => {
    const f = fixture(), secret = '{SECRET-NOT-FOR-LOGS';
    for (const call of [() => publicationChallengeEvidenceSha256(secret),
      () => publicationReceiptEvidenceSha256(f.packet.challengeEnvelope, f.packet.challengeToken, secret)]) {
      assert.throws(call, e => e.message === 'HOLD_OIDC_EVIDENCE_ENVELOPE' && !e.stack.includes(secret));
    }
  });
  test('signed but altered receipt bytes require a new matching OIDC receipt token', () => {
    const f = fixture(); f.receipt.finishedAt = iso(B - 400); f.packet.receiptEnvelope = signed(f.receipt, 'receipt');
    held(verify(f));
  });
  test('identical receipt/challenge tokens cannot satisfy both domain-separated audiences', () => {
    const f = fixture(); f.packet.receiptToken = f.packet.challengeToken; held(verify(f));
  });
  test('changed JWKS during supplied clock callbacks cannot mutate captured context', () => {
    const f = fixture(); let n = 0;
    const r = verify(f, () => { if (++n === 2) f.context.jwksSnapshot.keys[0].n = 'untrusted'; return B; });
    assert.equal(r.evidenceBound, true); held(verify(f));
  });
  test('a protected public-key snapshot cannot carry a private signing key', () => {
    const f = fixture(); f.context.witnessKeySnapshot.keys[0].publicKeyPem = ed.privateKey.export({ type: 'pkcs8', format: 'pem' });
    held(verify(f));
  });
  test('all operations remained offline', () => { assert.equal(fetchCalls, 0); });
} finally { globalThis.fetch = savedFetch; }
const report = { decision: 'PASS_OFFLINE_OIDC_EVIDENCE_BRIDGE', node: process.version, groupsPassed: groups.length, groups,
  networkRequests: fetchCalls, realTokensRequested: 0, fixtures: 'ephemeral RSA/Ed25519 signatures and synthetic snapshots only',
  publicationAuthorized: false, admissionRecorded: false, enforcementActive: false };
if (process.env.OIDC_EVIDENCE_TEST_REPORT) writeFileSync(process.env.OIDC_EVIDENCE_TEST_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(`OIDC evidence bridge: ${groups.length} offline groups passed; no requests, admission or publication.`);
