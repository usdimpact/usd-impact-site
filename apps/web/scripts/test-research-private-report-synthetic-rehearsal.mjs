import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  parseSyntheticPrivateReportPath,
  simulateResearchPrivateReportDelivery as simulate,
  syntheticAccountAuthorized,
  isSyntheticApprovedReportAsset,
  SYNTHETIC_REPORT_BODY_PREFIX,
} from './research-private-report-synthetic-contract.mjs';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const REQUEST = { method: 'GET', url: 'https://usd-impact.com/research/member/reports/weekly/2026-10-23?utm_source=synthetic' };
const UID = 'synthetic-user-id-no-real-account';
const CONTENT = SYNTHETIC_REPORT_BODY_PREFIX + '<!doctype html><h1>Synthetic Research Report</h1>';
const allowedValue = () => ({
  user: { id: UID },
  profile: { status: 'active' },
  allowed: true,
  entitlement: {
    accountId: UID, productId: 'research-membership', state: 'active',
    startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z',
  },
});
const asset = () => ({
  syntheticFixture: true,
  reportType: 'weekly', periodEnd: '2026-10-23',
  productId: 'research-membership',
  rightsApproval: 'synthetic-test-only-not-legal-approval',
  approvedForMemberDelivery: true,
  rightsScope: 'member',
  originPublic: false,
  privateObjectUrl: null, providerSourceUrl: null,
  sourceCommit: 'a'.repeat(40),
  contentType: 'text/html; charset=utf-8',
  body: CONTENT,
  bodySha256: createHash('sha256').update(CONTENT, 'utf8').digest('hex'),
});
function setup({
  request = REQUEST, value = allowedValue(), fixture = asset(),
  session = 'present', error = null, environment = { VERCEL_ENV: 'development' },
  simulationMode = 'synthetic-rehearsal', nowMs = NOW,
} = {}) {
  const counts = { session: 0, access: 0, asset: 0 };
  const args = {
    request, environment, simulationMode, nowMs,
    resolveSession: async ({ verifyAccessToken }) => {
      counts.session += 1;
      if (error === 'session') throw new Error('secret-info-must-not-leak');
      if (session === 'absent') return null;
      return { value: await verifyAccessToken('synthetic-token-is-not-a-real-credential') };
    },
    readAccess: async ({ productId }) => {
      counts.access += 1;
      assert.equal(productId, 'research-membership');
      if (error === 'access') throw new Error('secret-info-must-not-leak');
      return value;
    },
    readPrivateAsset: async ({ reportType, periodEnd, productId }) => {
      counts.asset += 1;
      assert.equal(reportType, 'weekly');
      assert.equal(periodEnd, '2026-10-23');
      assert.equal(productId, 'research-membership');
      if (error === 'asset') throw new Error('secret-info-must-not-leak');
      return fixture;
    },
  };
  return { args, counts };
}

test('route parser is exact and does not accept public routes, traversal or bad dates', () => {
  assert.deepEqual(parseSyntheticPrivateReportPath(REQUEST.url),
    { reportType: 'weekly', periodEnd: '2026-10-23' });
  assert.deepEqual(parseSyntheticPrivateReportPath('/research/member/reports/monthly/2026-10-16/'),
    { reportType: 'monthly', periodEnd: '2026-10-16' });
  for (const path of [
    '/reports/weekly/2026-10-23', '/research/sample/',
    '/research/member/reports/daily/2026-10-23',
    '/research/member/reports/weekly/2026-02-30',
    '/research/member/reports/weekly/2026-10-23/../2026-10-16',
    '/research/member/reports/weekly/%32%30%32%36-10-23',
    '/research/member/reports/weekly/2026-10-23%2F',
    '/research/member/reports/weekly/2026-10-23//',
    '/research/member/reports/weekly/2026-10-23.txt',
    '/research/member/reports/weekly/2026-10-23\\foo',
  ]) assert.equal(parseSyntheticPrivateReportPath(path), null, path);
});

test('rehearsal cannot serve content in Production or without an explicit synthetic mode', async () => {
  for (const input of [
    { environment: { VERCEL_ENV: 'production' } },
    { environment: { VERCEL_ENV: 'preview' } },
    { environment: {} },
    { simulationMode: null },
  ]) {
    const s = setup(input);
    const out = await simulate(s.args);
    assert.equal(out.statusCode, 503);
    assert.equal(out.body, '');
    assert.equal(s.counts.session, 0);
    assert.equal(s.counts.asset, 0);
  }
});

test('unsupported methods and non-member routes never reach auth or asset store', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const s = setup({ request: { ...REQUEST, method } });
    const out = await simulate(s.args);
    assert.equal(out.statusCode, 405);
    assert.equal(out.headers.Allow, 'GET, HEAD');
    assert.equal(s.counts.session, 0);
  }
  for (const path of ['/research/sample/', '/reports/monthly/2026-10-16', '/account']) {
    const s = setup({ request: { ...REQUEST, url: path } });
    assert.equal((await simulate(s.args)).statusCode, 404);
    assert.equal(s.counts.session, 0);
    assert.equal(s.counts.asset, 0);
  }
});

test('anonymous and nonmember denial occurs before asset lookup', async () => {
  const anon = setup({ session: 'absent' });
  assert.equal((await simulate(anon.args)).statusCode, 401);
  assert.equal(anon.counts.asset, 0);
  const libraryOnly = setup({ value: { ...allowedValue(), allowed: false, entitlement: null } });
  assert.equal((await simulate(libraryOnly.args)).statusCode, 403);
  assert.equal(libraryOnly.counts.asset, 0);
});

test('invalid, expired, inactive and mismatched Research entitlements fail closed', async () => {
  const changes = [
    { allowed: false },
    { profile: { status: 'deleted' } },
    { entitlement: { ...allowedValue().entitlement, productId: 'library-pass' } },
    { entitlement: { ...allowedValue().entitlement, accountId: 'another-synthetic-id' } },
    { entitlement: { ...allowedValue().entitlement, state: 'pending' } },
    { entitlement: { ...allowedValue().entitlement, state: 'past_due' } },
    { entitlement: { ...allowedValue().entitlement, state: 'cancelled' } },
    { entitlement: { ...allowedValue().entitlement, state: 'refunded' } },
    { entitlement: { ...allowedValue().entitlement, state: 'disputed' } },
    { entitlement: { ...allowedValue().entitlement, state: 'charged_back' } },
    { entitlement: { ...allowedValue().entitlement, startsAt: '2026-10-29T00:00:00Z' } },
    { entitlement: { ...allowedValue().entitlement, endsAt: '2026-10-28T12:00:00Z' } },
    { entitlement: { ...allowedValue().entitlement, endsAt: 'not-a-timestamp' } },
    { user: { id: '' } },
  ];
  for (const patch of changes) {
    const s = setup({ value: { ...allowedValue(), ...patch } });
    assert.equal((await simulate(s.args)).statusCode, 403, JSON.stringify(patch));
    assert.equal(s.counts.asset, 0);
  }
});

test('cancel scheduled only allows the effective paid-through period', async () => {
  const good = setup({ value: { ...allowedValue(),
    entitlement: { ...allowedValue().entitlement, state: 'cancel_scheduled' } } });
  assert.equal((await simulate(good.args)).statusCode, 200);
  const ended = setup({ value: { ...allowedValue(),
    entitlement: { ...allowedValue().entitlement, state: 'cancel_scheduled', endsAt: '2026-10-01T00:00:00Z' } } });
  assert.equal((await simulate(ended.args)).statusCode, 403);
});

test('synthetic entitlement success is not proof of paid subscription; response is private and nonindexable', async () => {
  const s = setup();
  const out = await simulate(s.args);
  assert.equal(out.statusCode, 200);
  assert.equal(out.body, CONTENT);
  assert.equal(out.headers['Cache-Control'], 'private, no-store');
  assert.equal(out.headers.Vary, 'Cookie');
  assert.equal(out.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(out.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(out.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(out.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(out.headers['X-Frame-Options'], 'DENY');
  assert.equal(out.releaseAuthorized, false);
  assert.equal(out.syntheticRehearsal, true);
  assert.equal(s.counts.access, 1);
  assert.equal(s.counts.asset, 1);
  assert.doesNotMatch(JSON.stringify(out), /synthetic-token-is-not-a-real-credential|synthetic-user-id-no-real-account|Lemon Squeezy/i);
});

test('HEAD authorizes identically but never returns private report body', async () => {
  const s = setup({ request: { ...REQUEST, method: 'HEAD' } });
  const out = await simulate(s.args);
  assert.equal(out.statusCode, 200);
  assert.equal(out.body, '');
  assert.equal(out.headers['Cache-Control'], 'private, no-store');
  assert.equal(s.counts.asset, 1);
});

test('no query parameter, including a forged entitlement, can replace server authorization', async () => {
  const s = setup({
    request: { ...REQUEST, url: REQUEST.url + '&paid=true&entitlement=active' },
    value: { ...allowedValue(), allowed: false },
  });
  const out = await simulate(s.args);
  assert.equal(out.statusCode, 403);
  assert.equal(s.counts.asset, 0);
});

test('missing, unapproved and malformed synthetic artifacts never expose data', async () => {
  const variants = [
    null,
    { ...asset(), syntheticFixture: false },
    { ...asset(), approvedForMemberDelivery: false },
    { ...asset(), rightsApproval: 'approved' },
    { ...asset(), rightsScope: 'public' },
    { ...asset(), originPublic: true },
    { ...asset(), privateObjectUrl: 'https://example.invalid/object' },
    { ...asset(), providerSourceUrl: 'https://example.invalid/provider' },
    { ...asset(), sourceCommit: 'invalid' },
    { ...asset(), bodySha256: '0'.repeat(64) },
    { ...asset(), body: SYNTHETIC_REPORT_BODY_PREFIX + 'tampered-but-marked' },
    { ...asset(), contentType: 'application/json' },
    { ...asset(), reportType: 'monthly' },
    { ...asset(), productId: 'library-pass' },
    { ...asset(), body: '<script>Not synthetic</script>' },
    { ...asset(), body: SYNTHETIC_REPORT_BODY_PREFIX + 'a'.repeat(11_000) },
  ];
  for (const fixture of variants) {
    const s = setup({ fixture });
    const out = await simulate(s.args);
    assert.ok([404, 503].includes(out.statusCode));
    assert.equal(out.body, '');
    assert.equal(s.counts.asset, 1);
  }
});

test('auth, access and private asset failures return sanitized 503 with no public fallback', async () => {
  for (const error of ['session', 'access', 'asset']) {
    const s = setup({ error });
    const out = await simulate(s.args);
    assert.equal(out.statusCode, 503);
    assert.equal(out.body, '');
    assert.equal(out.headers['Cache-Control'], 'private, no-store');
    assert.doesNotMatch(JSON.stringify(out), /secret-info-must-not-leak/);
  }
  const missing = await simulate({
    request: REQUEST, environment: { VERCEL_ENV: 'development' },
    simulationMode: 'synthetic-rehearsal', nowMs: NOW,
  });
  assert.equal(missing.statusCode, 503);
});

test('pure account and artifact guards reject malformed input', () => {
  assert.equal(syntheticAccountAuthorized(allowedValue(), NOW), true);
  assert.equal(syntheticAccountAuthorized(allowedValue(), NaN), false);
  assert.equal(syntheticAccountAuthorized(null, NOW), false);
  assert.equal(isSyntheticApprovedReportAsset(asset(), 'weekly', '2026-10-23'), true);
  assert.equal(isSyntheticApprovedReportAsset(null, 'weekly', '2026-10-23'), false);
});
