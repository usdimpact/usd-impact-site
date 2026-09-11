import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createGitHubOidcWitnessVerifier, githubOidcWitnessAudience,
  normalizeGitHubOidcDiscovery, normalizeGitHubOidcJwks,
  GITHUB_OIDC_ISSUER, GITHUB_OIDC_JWKS_URI } from '../src/lib/publication-github-oidc-witness.js';

const BASE = Date.parse('2026-09-10T02:30:00.000Z');
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = pair.publicKey.export({ format: 'jwk' });
const weakJwk = { ...publicJwk, n: 'A'.repeat(64) };
const KID = 'fixture-github-oidc-key';
const MAIN_SHA = 'a'.repeat(40);
const JOB_SHA = 'b'.repeat(40);
const CHALLENGE_HASH = 'c'.repeat(64);
const RECEIPT_HASH = 'd'.repeat(64);
const WORKFLOW_REF = 'usdimpact/usd-impact-site/.github/workflows/publication-witness-controller.yml@refs/heads/main';
const JOB_WORKFLOW_REF = `usdimpact/usd-impact-site/.github/workflows/publication-witness-runner.yml@${JOB_SHA}`;
const sec = (offsetMs = 0) => Math.floor((BASE + offsetMs) / 1000);
const tests = [];
function test(name, work) { tests.push([name, work]); }
function held(value, code) {
  assert.equal(value.decision, code);
  assert.equal(value.identityAuthenticated, false);
  assert.equal(value.publicationAuthorized, false);
}
function discovery(patch = {}) {
  return { issuer: GITHUB_OIDC_ISSUER, jwks_uri: GITHUB_OIDC_JWKS_URI,
    id_token_signing_alg_values_supported: ['RS256'],
    claims_supported: ['aud','iss','sub','jti','nbf','iat','exp','repository','repository_id','repository_owner',
      'repository_owner_id','ref','ref_type','ref_protected','sha','run_id','run_attempt','workflow_ref','workflow_sha',
      'job_workflow_ref','job_workflow_sha','event_name','repository_visibility','runner_environment','check_run_id'],
    ...patch };
}
function jwks(key = publicJwk, patch = {}) {
  return normalizeGitHubOidcJwks({ keys: [{ kty: 'RSA', alg: 'RS256', use: 'sig', kid: KID, n: key.n, e: key.e }] },
    { observedAt: new Date(BASE - 1000).toISOString(), validUntil: new Date(BASE + 60000).toISOString(), ...patch });
}
function expected(purpose = 'challenge', patch = {}) {
  return { purpose, evidenceSha256: purpose === 'challenge' ? CHALLENGE_HASH : RECEIPT_HASH,
    workflowRef: WORKFLOW_REF, workflowSha: MAIN_SHA, jobWorkflowRef: JOB_WORKFLOW_REF,
    jobWorkflowSha: JOB_SHA, eventName: 'workflow_dispatch', run: null, ...patch };
}
function claims(exp = expected(), patch = {}) {
  return { iss: GITHUB_OIDC_ISSUER, aud: githubOidcWitnessAudience(exp),
    sub: 'repo:usdimpact/usd-impact-site:ref:refs/heads/main', jti: 'fixture-jti-challenge-1234',
    nbf: sec(-1000), iat: sec(-1000), exp: sec(300000),
    repository: 'usdimpact/usd-impact-site', repository_id: '1265351071', repository_owner: 'usdimpact',
    repository_owner_id: '275107298', ref: 'refs/heads/main', ref_type: 'branch', ref_protected: true,
    sha: MAIN_SHA, run_id: '1234567890', run_attempt: '1', check_run_id: '987654321',
    workflow_ref: WORKFLOW_REF, workflow_sha: MAIN_SHA, job_workflow_ref: JOB_WORKFLOW_REF,
    job_workflow_sha: JOB_SHA, event_name: 'workflow_dispatch', repository_visibility: 'public',
    runner_environment: 'github-hosted', ...patch };
}
function token(exp = expected(), claimPatch = {}, headerPatch = {}, signingPair = pair) {
  const header = { alg: 'RS256', typ: 'JWT', kid: KID, ...headerPatch };
  const payload = claims(exp, claimPatch);
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = sign('RSA-SHA256', Buffer.from(`${h}.${p}`, 'ascii'), signingPair.privateKey).toString('base64url');
  return `${h}.${p}.${s}`;
}
const verify = createGitHubOidcWitnessVerifier({ now: () => BASE });

test('official discovery contract normalizes fixed issuer and JWKS', () => {
  const x = normalizeGitHubOidcDiscovery(discovery());
  assert.equal(x.issuer, GITHUB_OIDC_ISSUER); assert.equal(x.jwksUri, GITHUB_OIDC_JWKS_URI);
});
test('discovery rejects changed issuer', () => assert.throws(() => normalizeGitHubOidcDiscovery(discovery({ issuer: 'https://example.com' }))));
test('discovery rejects missing run identity claim', () => assert.throws(() => normalizeGitHubOidcDiscovery({ ...discovery(), claims_supported: discovery().claims_supported.filter((x) => x !== 'run_id') })));
test('JWKS normalization strips untrusted extra fields', () => {
  const x = normalizeGitHubOidcJwks({ keys: [{ kty:'RSA',alg:'RS256',use:'sig',kid:KID,n:publicJwk.n,e:publicJwk.e,x5c:['private-noise'] }] },
    { observedAt:new Date(BASE-1000).toISOString(),validUntil:new Date(BASE+1000).toISOString() });
  assert.deepEqual(Object.keys(x.keys[0]), ['kty','alg','use','kid','n','e']);
});
test('custom challenge audience is deterministic', () => assert.equal(githubOidcWitnessAudience(expected()),
  `urn:usd-impact:public-witness:challenge:sha256:${CHALLENGE_HASH}`));
test('valid protected-main GitHub OIDC challenge identity verifies', () => {
  const r = verify(token(), { jwksSnapshot: jwks(), expected: expected() });
  assert.equal(r.decision, 'VERIFIED_GITHUB_OIDC_WITNESS_IDENTITY'); assert.equal(r.identityAuthenticated, true);
  assert.equal(r.run.runId, '1234567890'); assert.equal(r.publicationAuthorized, false);
});
test('receipt token must continue same GitHub run with a fresh jti', () => {
  const first = verify(token(), { jwksSnapshot: jwks(), expected: expected() });
  const exp = expected('receipt', { run: first.run });
  const raw = token(exp, { aud: githubOidcWitnessAudience(exp), jti:'fixture-jti-receipt-5678', iat:sec(0), nbf:sec(-1000) });
  const second = verify(raw, { jwksSnapshot: jwks(), expected: exp });
  assert.equal(second.decision, 'VERIFIED_GITHUB_OIDC_WITNESS_IDENTITY'); assert.equal(second.purpose, 'receipt');
});
const mutations = [
  ['issuer', { iss:'https://example.com' }, 'HOLD_GITHUB_OIDC_AUDIENCE'],
  ['audience', { aud:'urn:other' }, 'HOLD_GITHUB_OIDC_AUDIENCE'],
  ['repository', { repository:'other/repo' }, 'HOLD_GITHUB_OIDC_REPOSITORY'],
  ['repository id', { repository_id:'1' }, 'HOLD_GITHUB_OIDC_REPOSITORY'],
  ['owner id', { repository_owner_id:'1' }, 'HOLD_GITHUB_OIDC_REPOSITORY'],
  ['unprotected ref', { ref_protected:false }, 'HOLD_GITHUB_OIDC_REF'],
  ['wrong ref', { ref:'refs/heads/feature' }, 'HOLD_GITHUB_OIDC_REF'],
  ['self-hosted runner', { runner_environment:'self-hosted' }, 'HOLD_GITHUB_OIDC_RUNNER'],
  ['private visibility', { repository_visibility:'private' }, 'HOLD_GITHUB_OIDC_RUNNER'],
  ['wrong event', { event_name:'pull_request' }, 'HOLD_GITHUB_OIDC_EVENT'],
  ['caller workflow ref', { workflow_ref:'usdimpact/usd-impact-site/.github/workflows/other.yml@refs/heads/main' }, 'HOLD_GITHUB_OIDC_WORKFLOW'],
  ['caller workflow sha', { workflow_sha:'9'.repeat(40) }, 'HOLD_GITHUB_OIDC_WORKFLOW'],
  ['event sha', { sha:'9'.repeat(40) }, 'HOLD_GITHUB_OIDC_WORKFLOW'],
  ['reusable workflow ref', { job_workflow_ref:`usdimpact/usd-impact-site/.github/workflows/other.yml@${JOB_SHA}` }, 'HOLD_GITHUB_OIDC_JOB_WORKFLOW'],
  ['reusable workflow sha', { job_workflow_sha:'9'.repeat(40) }, 'HOLD_GITHUB_OIDC_JOB_WORKFLOW'],
];
for (const [name, patch, code] of mutations) test(`identity rejects ${name}`, () => held(verify(token(expected(), patch), { jwksSnapshot:jwks(), expected:expected() }), code));
test('receipt rejects different run id', () => {
  const first = verify(token(), { jwksSnapshot:jwks(), expected:expected() });
  const exp = expected('receipt', { run:first.run });
  held(verify(token(exp, { aud:githubOidcWitnessAudience(exp),run_id:'999',jti:'receipt-jti-12345',iat:sec(0) }), { jwksSnapshot:jwks(), expected:exp }), 'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
});
test('receipt rejects different run attempt', () => {
  const first = verify(token(), { jwksSnapshot:jwks(), expected:expected() }); const exp=expected('receipt',{run:first.run});
  held(verify(token(exp,{aud:githubOidcWitnessAudience(exp),run_attempt:'2',jti:'receipt-jti-12345',iat:sec(0)}),{jwksSnapshot:jwks(),expected:exp}),'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
});
test('receipt rejects same jti as challenge', () => {
  const first=verify(token(),{jwksSnapshot:jwks(),expected:expected()}); const exp=expected('receipt',{run:first.run});
  held(verify(token(exp,{aud:githubOidcWitnessAudience(exp),jti:first.run.tokenJti,iat:sec(0)}),{jwksSnapshot:jwks(),expected:exp}),'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
});
test('expired token rejects', () => held(verify(token(expected(), { iat:sec(-700000), nbf:sec(-700000), exp:sec(-1000) }), { jwksSnapshot:jwks(), expected:expected() }), 'HOLD_GITHUB_OIDC_TIME'));
test('stale token rejects', () => held(verify(token(expected(), { iat:sec(-60000), nbf:sec(-60000), exp:sec(300000) }), { jwksSnapshot:jwks(), expected:expected() }), 'HOLD_GITHUB_OIDC_EXPIRED'));
test('future nbf rejects', () => held(verify(token(expected(), { nbf:sec(60000), iat:sec(60000), exp:sec(300000) }), { jwksSnapshot:jwks(), expected:expected() }), 'HOLD_GITHUB_OIDC_EXPIRED'));
test('unknown kid rejects', () => held(verify(token(expected(), {}, { kid:'other-kid' }), { jwksSnapshot:jwks(), expected:expected() }), 'HOLD_GITHUB_OIDC_KEY'));
test('wrong signature rejects', () => held(verify(token(expected(), {}, {}, other), { jwksSnapshot:jwks(), expected:expected() }), 'HOLD_GITHUB_OIDC_SIGNATURE'));
test('weak RSA key is rejected during JWKS normalization', () => {
  assert.throws(() => normalizeGitHubOidcJwks({keys:[{kty:'RSA',alg:'RS256',use:'sig',kid:KID,n:weakJwk.n,e:weakJwk.e}]},
    {observedAt:new Date(BASE-1000).toISOString(),validUntil:new Date(BASE+60000).toISOString()}),
  (error) => error.code === 'HOLD_GITHUB_OIDC_JWKS');
});
test('duplicate kid snapshot rejects', () => {
  const k={kty:'RSA',alg:'RS256',use:'sig',kid:KID,n:publicJwk.n,e:publicJwk.e};
  const snapshot={issuer:GITHUB_OIDC_ISSUER,observedAt:new Date(BASE-1000).toISOString(),validUntil:new Date(BASE+60000).toISOString(),keys:[k,{...k}]};
  held(verify(token(),{jwksSnapshot:snapshot,expected:expected()}),'HOLD_GITHUB_OIDC_JWKS');
});
test('stale JWKS snapshot rejects', () => {
  const snapshot=jwks(publicJwk,{observedAt:new Date(BASE-600000).toISOString(),validUntil:new Date(BASE+1000).toISOString()});
  held(verify(token(),{jwksSnapshot:snapshot,expected:expected()}),'HOLD_GITHUB_OIDC_JWKS_EXPIRED');
});
test('alg substitution rejects before signature validation', () => held(verify(token(expected(),{}, {alg:'none'}),{jwksSnapshot:jwks(),expected:expected()}),'HOLD_GITHUB_OIDC_HEADER'));
test('array audience is not accepted as the exact custom binding', () => held(verify(token(expected(),{aud:[githubOidcWitnessAudience(expected())]}),{jwksSnapshot:jwks(),expected:expected()}),'HOLD_GITHUB_OIDC_AUDIENCE'));
test('forward-compatible extra signed claims do not weaken required claims', () => {
  const r=verify(token(expected(),{future_claim:'signed-provider-value'}),{jwksSnapshot:jwks(),expected:expected()});
  assert.equal(r.decision,'VERIFIED_GITHUB_OIDC_WITNESS_IDENTITY');
});
test('malformed token fails closed', () => held(verify('not-a-jwt',{jwksSnapshot:jwks(),expected:expected()}),'HOLD_GITHUB_OIDC_TOKEN'));

test('receipt cannot establish identity without its original challenge run', () => {
  const exp = expected('receipt');
  held(verify(token(exp, { run_id: '999999', jti: 'detached-receipt-fixture' }),
    { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_RUN_REQUIRED');
});
test('receipt rejects empty challenge run context', () => {
  const exp = expected('receipt', { run: {} });
  held(verify(token(exp), { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_RUN');
});
test('receipt rejects omitted challenge run context', () => {
  const exp = expected('receipt'); delete exp.run;
  held(verify(token(exp), { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_EXPECTED');
});
test('receipt rejects another job in the same run', () => {
  const first = verify(token(), { jwksSnapshot: jwks(), expected: expected() });
  const exp = expected('receipt', { run: first.run });
  held(verify(token(exp, { check_run_id: '987654322', jti: 'receipt-other-job-12345', iat: sec(0) }),
    { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
});
test('receipt cannot predate its authenticated challenge token', () => {
  const first = verify(token(), { jwksSnapshot: jwks(), expected: expected() });
  const exp = expected('receipt', { run: first.run });
  held(verify(token(exp, { jti: 'receipt-earlier-token-12345', iat: sec(-2000), nbf: sec(-2000) }),
    { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
});
function advancingVerifier(finalOffset) {
  let calls = 0;
  return createGitHubOidcWitnessVerifier({ now: () => BASE + (++calls === 1 ? 999 : finalOffset) });
}
test('challenge freshness budget is enforced again at final clock', () => {
  held(advancingVerifier(1001)(token(expected(), { iat: sec(-29000), nbf: sec(-29000) }),
    { jwksSnapshot: jwks(), expected: expected() }), 'HOLD_GITHUB_OIDC_EXPIRED');
});
test('linked receipt freshness budget is enforced again at final clock', () => {
  const timing = { iat: sec(-29000), nbf: sec(-29000) };
  const first = verify(token(expected(), timing), { jwksSnapshot: jwks(), expected: expected() });
  const exp = expected('receipt', { run: first.run });
  held(advancingVerifier(1001)(token(exp, { ...timing, jti: 'receipt-crossing-age-12345' }),
    { jwksSnapshot: jwks(), expected: exp }), 'HOLD_GITHUB_OIDC_EXPIRED');
});
test('exact application age budget retains its documented inclusive boundary', () => {
  const r = advancingVerifier(1000)(token(expected(), { iat: sec(-29000), nbf: sec(-29000) }),
    { jwksSnapshot: jwks(), expected: expected() });
  assert.equal(r.identityAuthenticated, true);
  assert.equal(r.publicationAuthorized, false);
});
test('provider expiration during verification remains exclusive', () => {
  held(advancingVerifier(1000)(token(expected(), { exp: sec(1000) }),
    { jwksSnapshot: jwks(), expected: expected() }), 'HOLD_GITHUB_OIDC_EXPIRED');
});
test('JWKS expiration during verification remains exclusive', () => {
  held(advancingVerifier(1000)(token(),
    { jwksSnapshot: jwks(publicJwk, { validUntil: new Date(BASE + 1000).toISOString() }), expected: expected() }),
  'HOLD_GITHUB_OIDC_EXPIRED');
});

for (const [name, work] of tests) {
  try { await work(); } catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
console.log(`Publication GitHub OIDC witness identity: ${tests.length} groups passed (synthetic RS256/JWKS tokens; no id-token permission, workflow, live token, route or Production activation).`);