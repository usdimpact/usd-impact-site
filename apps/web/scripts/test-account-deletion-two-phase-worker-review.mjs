import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import accountHandler from '../api/account.js';
import { handleDraftTwoPhaseWorker } from '../src/lib/account-deletion-two-phase-worker-review.js';

const cfg = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_EXECUTION_APPROVED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_SCHEMA_APPROVED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_LEGACY_DRAINED: 'true',
  ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'false',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  CRON_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
});
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal((vercel.crons || []).some(({ path }) => /two-phase/i.test(path)), false);
assert.equal((vercel.rewrites || []).some(({ source }) => /two-phase/i.test(source)), false);
assert.deepEqual(
  (vercel.rewrites || []).find(({ source }) => source === '/api/account-deletion-finalizer'),
  { source: '/api/account-deletion-finalizer', destination: '/api/account?action=deletion-finalizer' },
);
assert.deepEqual(
  (vercel.crons || []).filter(({ path }) => path === '/api/account-deletion-finalizer'),
  [{ path: '/api/account-deletion-finalizer', schedule: '20 4 * * *' }],
);
let passed = 0;
let remoteCalls = 0;
let invoked = 0;
const success = Object.freeze({
  dueScanned: 1, prepared: 1, held: 0,
  cleanupScanned: 1, cleanupCompleted: 1, cleanupHeld: 0, errors: [],
});
function response() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}
const noNetwork = async () => { remoteCalls += 1; throw Error('NO EXTERNAL IO ALLOWED IN TEST'); };
async function caseRun({
  env = cfg, method = 'GET',
  authorization = 'Bearer ' + cfg.CRON_SECRET,
  result = success, throws = false,
} = {}) {
  const res = response();
  const runImpl = async ({ config, batchSize, environment }) => {
    invoked += 1;
    assert.equal(batchSize, 1, 'one account per batch for Draft review');
    assert.equal(config.projectRef, 'ycstrcvshdluovtuasjc');
    assert.equal(config.production, false);
    assert.equal(environment, env);
    if (throws) throw Error('private account/customer data must not leak');
    return result;
  };
  await handleDraftTwoPhaseWorker(
    { method, headers: { authorization } }, res,
    { environment: env, runImpl, fetchImpl: noNetwork },
  );
  assert.equal(remoteCalls, 0, 'no real fetch was invoked');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(!JSON.stringify(res.body).includes(cfg.SUPABASE_SECRET_KEY));
  assert.ok(!JSON.stringify(res.body).includes('private account/customer'));
  passed += 1;
  return res;
}
let r = await caseRun({ env: {} });
assert.equal(r.statusCode, 404);
r = await caseRun({ env: { ...cfg, ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED: 'TRUE' } });
assert.equal(r.statusCode, 404);
r = await caseRun({ method: 'POST' });
assert.equal(r.statusCode, 405);
assert.equal(r.headers.allow, 'GET');
r = await caseRun({ authorization: 'Bearer wrong-secret' });
assert.equal(r.statusCode, 401);
for (const mode of ['production', 'development', '', 'preview-other']) {
  r = await caseRun({ env: { ...cfg, VERCEL_ENV: mode } });
  assert.equal(r.statusCode, 503, mode + ' must not run');
}
for (const legacyValue of ['true', undefined, 'TRUE']) {
  r = await caseRun({ env: { ...cfg, ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: legacyValue } });
  assert.equal(r.statusCode, 409, 'legacy must be explicitly off');
}
for (const flag of [
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_EXECUTION_APPROVED',
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_SCHEMA_APPROVED',
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_LEGACY_DRAINED',
]) {
  r = await caseRun({ env: { ...cfg, [flag]: undefined } });
  assert.equal(r.statusCode, 423, flag);
}
for (const bad of [
  { ACCOUNT_DELETION_FINALIZER_ENABLED: undefined },
  { EMAIL_READINESS_LEDGER_ENABLED: 'false' },
  { SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co' },
  { SUPABASE_URL: 'https://example.invalid' },
  { SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.attacker.invalid' },
]) {
  r = await caseRun({ env: { ...cfg, ...bad } });
  assert.equal(r.statusCode, 503, 'config not safe');
}
assert.equal(invoked, 0, 'no operation before all flags, old-off and Dev binding');
r = await caseRun();
assert.equal(r.statusCode, 200);
assert.equal(r.body.code, 'TWO_PHASE_REVIEW_DRAFT_CYCLE_OK');
assert.equal(r.body.releaseApproved, false);
assert.equal(r.body.cleanupCompleted, 1);
assert.equal(invoked, 1);
r = await caseRun({ result: { ...success, dueScanned: 1, prepared: 0, held: 1, errors: ['TWO_PHASE_BILLING_FENCE_REFUSED'] } });
assert.equal(r.statusCode, 503, 'held operation not healthy');
assert.equal(r.body.code, 'TWO_PHASE_REVIEW_HELD');
r = await caseRun({ result: { ...success, dueScanned: 4 } });
assert.equal(r.statusCode, 503, 'out-of-bounds result denied');
r = await caseRun({ result: { ...success, errors: ['PRIVATE_BILLING_EVENT'] } });
assert.equal(r.statusCode, 503, 'unknown error code denied');
r = await caseRun({ throws: true });
assert.equal(r.statusCode, 503, 'runner errors fail closed');
assert.equal(r.body.code, 'TWO_PHASE_REVIEW_UNAVAILABLE');
// Actual account API is routed to the extra action, but must be OFF absent
// an explicit setting. No connected service is ever called by this test.
const envKeys = Object.keys(cfg);
const previous = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
const origFetch = globalThis.fetch;
try {
  for (const key of envKeys) delete process.env[key];
  globalThis.fetch = noNetwork;
  const out = response();
  await accountHandler({
    method: 'GET', url: '/api/account?action=deletion-two-phase-review', headers: {},
  }, out);
  assert.equal(out.statusCode, 404);
  assert.equal(out.body.code, 'TWO_PHASE_REVIEW_ROUTE_DISABLED');
  assert.equal(remoteCalls, 0);
  passed += 1;
} finally {
  globalThis.fetch = origFetch;
  for (const key of envKeys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}
console.log('Research P1 two-phase worker route controls passed (' + passed + ' cases).');
