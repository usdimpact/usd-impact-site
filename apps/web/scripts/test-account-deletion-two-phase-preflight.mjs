import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import preflight from '../api/account-deletion-two-phase-preflight.js';

const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_TWO_PHASE_PREFLIGHT_ROUTE_ENABLED: 'true',
  ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'false',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  CRON_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
});

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.deepEqual(
  (vercel.crons || []).filter(({ path }) => path === '/api/account-deletion-finalizer'),
  [{ path: '/api/account-deletion-finalizer', schedule: '20 4 * * *' }],
  'existing cron must remain unchanged',
);
assert.equal(
  (vercel.crons || []).some(({ path }) => path.includes('two-phase')),
  false, 'Draft-only preflight must not be scheduled',
);
assert.equal(
  (vercel.rewrites || []).some(({ source }) => source.includes('two-phase')),
  false, 'Draft-only preflight must not rewrite the live finalizer',
);
assert.deepEqual(
  (vercel.rewrites || []).find(({ source }) => source === '/api/account-deletion-finalizer'),
  { source: '/api/account-deletion-finalizer', destination: '/api/account?action=deletion-finalizer' },
  'legacy route remains unchanged (no cutover yet)',
);

let passed = 0;
const priorFetch = globalThis.fetch;
const api = async ({
  env = environment, method = 'GET',
  authorization = 'Bearer ' + environment.CRON_SECRET,
} = {}) => {
  const res = {
    statusCode: null, headers: {}, body: null,
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(payload) { this.body = JSON.parse(payload); },
  };
  const req = { method, headers: { authorization } };
  await preflight(req, res, { environment: env });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(!JSON.stringify(res.body).includes(environment.SUPABASE_SECRET_KEY));
  assert.ok(!JSON.stringify(res.body).includes(environment.CRON_SECRET));
  passed += 1;
  return res;
};
try {
  // Every test must make zero HTTP/SQL/Auth/merchant/email calls.
  globalThis.fetch = async () => { throw Error('PRE-FLIGHT MUST NOT MAKE NETWORK CALLS'); };
  let r = await api({ env: {} });
  assert.equal(r.statusCode, 404);
  assert.equal(r.body.code, 'TWO_PHASE_PREFLIGHT_ROUTE_DISABLED');

  r = await api({ env: { ...environment, ACCOUNT_DELETION_TWO_PHASE_PREFLIGHT_ROUTE_ENABLED: 'TRUE' } });
  assert.equal(r.statusCode, 404, 'only exact true opts in');

  r = await api({ method: 'POST' });
  assert.equal(r.statusCode, 405);
  assert.equal(r.headers.allow, 'GET');

  r = await api({ authorization: 'Bearer wrong' });
  assert.equal(r.statusCode, 401);

  r = await api({ env: { ...environment, VERCEL_ENV: 'production' } });
  assert.equal(r.statusCode, 503);
  assert.equal(r.body.code, 'TWO_PHASE_PREFLIGHT_PRODUCTION_HOLD');

  r = await api({ env: { ...environment, VERCEL_ENV: '' } });
  assert.equal(r.statusCode, 503, 'missing deployment context fails closed');

  r = await api({ env: { ...environment, ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'true' } });
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.code, 'LEGACY_FINALIZER_NOT_EXPLICITLY_DISABLED');

  r = await api({ env: { ...environment, ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: undefined } });
  assert.equal(r.statusCode, 409, 'ambiguous legacy route status cannot preflight');

  r = await api({ env: { ...environment, ACCOUNT_DELETION_FINALIZER_ENABLED: undefined } });
  assert.equal(r.statusCode, 503, 'disabled finalizer cannot be declared ready');

  r = await api({ env: { ...environment, SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co' } });
  assert.equal(r.statusCode, 503, 'Production ref never accepted from Preview');

  r = await api({ env: { ...environment, SUPABASE_URL: 'https://example.com' } });
  assert.equal(r.statusCode, 503, 'unrecognized Supabase binding rejected');

  r = await api({ env: { ...environment, EMAIL_READINESS_LEDGER_ENABLED: 'false' } });
  assert.equal(r.statusCode, 503, 'email outbox readiness required');

  r = await api();
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, {
    ok: true,
    code: 'TWO_PHASE_DRAFT_PREFLIGHT_ONLY',
    scope: 'canonical_development',
    legacyRouteDisabled: true,
    externalCalls: 0,
    deletionExecuted: false,
    releaseApproved: false,
  });
} finally {
  globalThis.fetch = priorFetch;
}
console.log('Research P1 isolated two-phase cutover preflight passed (' + passed + ' cases).');
