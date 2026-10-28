import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSyntheticPrivateOriginAdapter,
  createSyntheticPrivateReportArtifact,
  SYNTHETIC_PRIVATE_ORIGIN,
} from './research-private-report-synthetic-origin.mjs';
import {
  simulateResearchPrivateReportDelivery as simulate,
  SYNTHETIC_REPORT_BODY_PREFIX,
} from './research-private-report-synthetic-contract.mjs';

const NOW = Date.parse('2026-10-28T12:00:00Z');
const RID = 'synthetic-identifier-no-real-user';
const BODY = SYNTHETIC_REPORT_BODY_PREFIX + '<!doctype html><h1>Fabricated weekly example</h1>';
const asset = (extra = {}) => createSyntheticPrivateReportArtifact({
  reportType: 'weekly',
  periodEnd: '2026-10-23',
  body: BODY,
  sourceCommit: 'a'.repeat(40),
  ...extra,
});
const monthly = () => createSyntheticPrivateReportArtifact({
  reportType: 'monthly',
  periodEnd: '2026-10-16',
  body: SYNTHETIC_REPORT_BODY_PREFIX + '<!doctype html><h1>Fabricated monthly example</h1>',
  sourceCommit: 'b'.repeat(40),
});

function fakeOrigin(rows = [asset()], { status = 200, mediaType = 'application/json; charset=utf-8',
  throwError = false, invalidJson = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (throwError) throw new Error('synthetic mock error not for user');
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: name => name.toLowerCase() === 'content-type' ? mediaType : null },
      json: async () => {
        if (invalidJson) throw new Error('invalid JSON from fake store');
        return rows;
      },
    };
  };
  return { calls, fetchImpl };
}
function setup({ records = [asset()], value = null, missingSession = false,
  failure = null, requestMethod = 'GET', pathname = '/research/member/reports/weekly/2026-10-23',
  overrideOrigin = {} } = {}) {
  const fake = fakeOrigin(records, overrideOrigin);
  const store = createSyntheticPrivateOriginAdapter({
    environment: { VERCEL_ENV: 'development' },
    mode: 'synthetic-rehearsal',
    fetchImpl: fake.fetchImpl,
  });
  const approved = value || {
    user: { id: RID },
    profile: { status: 'active' },
    allowed: true,
    entitlement: {
      accountId: RID,
      productId: 'research-membership',
      state: 'active',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-11-01T00:00:00Z',
    },
  };
  const request = { method: requestMethod, url: 'https://usd-impact.com' + pathname };
  const counters = { sessions: 0, access: 0 };
  const args = {
    request, environment: { VERCEL_ENV: 'development' },
    simulationMode: 'synthetic-rehearsal',
    nowMs: NOW,
    resolveSession: async ({ verifyAccessToken }) => {
      counters.sessions += 1;
      if (failure === 'session') throw new Error('secret-shall-never-appear');
      if (missingSession) return null;
      return { value: await verifyAccessToken('synthetic-injected-session-not-real') };
    },
    readAccess: async ({ productId }) => {
      counters.access += 1;
      assert.equal(productId, 'research-membership');
      if (failure === 'access') throw new Error('secret-shall-never-appear');
      return approved;
    },
    readPrivateAsset: store.read,
  };
  return { fake, store, args, counters };
}

test('artifact builder issues only marked, hashed, narrowly typed fabricated reports', () => {
  const weekly = asset();
  assert.equal(Object.isFrozen(weekly), true);
  assert.equal(weekly.body, BODY);
  assert.equal(weekly.bodySha256.length, 64);
  assert.equal(weekly.originPublic, false);
  assert.equal(weekly.syntheticFixture, true);
  assert.equal(weekly.approvedForMemberDelivery, true);
  assert.equal(weekly.rightsApproval, 'synthetic-test-only-not-legal-approval');
  assert.equal(weekly.privateObjectUrl, null);
  assert.equal(weekly.providerSourceUrl, null);
  assert.equal(monthly().reportType, 'monthly');
  for (const changes of [
    { reportType: 'daily' },
    { periodEnd: '2026-02-30' },
    { periodEnd: '2026-10-23/../2026-10-16' },
    { sourceCommit: 'wrong' },
    { body: '<h1>Unmarked</h1>' },
    { body: SYNTHETIC_REPORT_BODY_PREFIX + '<script>alert(1)</script>' },
    { body: SYNTHETIC_REPORT_BODY_PREFIX + '<a href="https://example.invalid">link</a>' },
    { body: SYNTHETIC_REPORT_BODY_PREFIX + 'A'.repeat(11000) },
  ]) {
    assert.throws(() => asset(changes), /synthetic/i);
  }
});

test('mock-only transport cannot be configured for Production, Preview or real fetch', () => {
  const fake = fakeOrigin();
  for (const settings of [
    { environment: { VERCEL_ENV: 'production' }, mode: 'synthetic-rehearsal', fetchImpl: fake.fetchImpl },
    { environment: { VERCEL_ENV: 'preview' }, mode: 'synthetic-rehearsal', fetchImpl: fake.fetchImpl },
    { environment: {}, mode: 'synthetic-rehearsal', fetchImpl: fake.fetchImpl },
    { environment: { VERCEL_ENV: 'development' }, fetchImpl: fake.fetchImpl },
    { environment: { VERCEL_ENV: 'development' }, mode: 'synthetic-rehearsal' },
    { environment: { VERCEL_ENV: 'development' }, mode: 'synthetic-rehearsal', fetchImpl: globalThis.fetch },
  ]) {
    assert.throws(() => createSyntheticPrivateOriginAdapter(settings), /synthetic/i);
  }
});

test('server-origin read is a scoped GET with no auth credential, redirect or cache', async () => {
  const s = setup();
  const found = await s.store.read({
    productId: 'research-membership', reportType: 'weekly', periodEnd: '2026-10-23',
  });
  assert.equal(found.body, BODY);
  assert.equal(Object.isFrozen(found), true);
  assert.equal(s.fake.calls.length, 1);
  const call = s.fake.calls[0];
  const url = new URL(call.url);
  assert.equal(url.origin, SYNTHETIC_PRIVATE_ORIGIN);
  assert.equal(url.pathname, '/rest/v1/research_private_report_assets');
  assert.equal(url.searchParams.get('report_type'), 'eq.weekly');
  assert.equal(url.searchParams.get('period_end'), 'eq.2026-10-23');
  assert.equal(url.searchParams.get('product_id'), 'eq.research-membership');
  assert.equal(url.searchParams.get('limit'), '2');
  assert.ok(url.searchParams.get('select').includes('bodySha256'));
  assert.doesNotMatch(url.searchParams.get('select'), /customer|account|email|providerEvent|secret/i);
  assert.equal(call.opts.method, 'GET');
  assert.equal(call.opts.redirect, 'error');
  assert.equal(call.opts.cache, 'no-store');
  assert.equal(call.opts.credentials, 'omit');
  assert.equal(call.opts.headers['Cache-Control'], 'no-store');
  assert.equal(call.opts.headers['X-Research-Synthetic-Only'], 'true');
  assert.equal(call.opts.headers.Authorization, undefined);
  assert.equal(call.opts.headers.apikey, undefined);
  assert.equal(call.opts.body, undefined);
});

test('anonymous and Library-only requests cannot reach the private origin', async () => {
  const anon = setup({ missingSession: true });
  const unauth = await simulate(anon.args);
  assert.equal(unauth.statusCode, 401);
  assert.equal(unauth.body, '');
  assert.equal(anon.fake.calls.length, 0);
  assert.equal(anon.counters.access, 0);
  const library = setup({ value: {
    user: { id: RID }, profile: { status: 'active' }, allowed: false,
    entitlement: { accountId: RID, productId: 'library-pass', state: 'active' },
  } });
  const denied = await simulate(library.args);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body, '');
  assert.equal(library.fake.calls.length, 0);
});

test('fabricated Research entitlement authorizes only matching weekly private report', async () => {
  const s = setup();
  const res = await simulate(s.args);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, BODY);
  assert.equal(res.syntheticRehearsal, true);
  assert.equal(res.releaseAuthorized, false);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(s.counters.access, 1);
  assert.equal(s.fake.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(res), /synthetic-injected-session-not-real|synthetic-identifier-no-real-user/);
});

test('synthetic monthly report and authorized HEAD are supported without public body', async () => {
  const stored = [monthly()];
  const get = setup({ records: stored, pathname: '/research/member/reports/monthly/2026-10-16' });
  const getRes = await simulate(get.args);
  assert.equal(getRes.statusCode, 200);
  assert.match(getRes.body, /Fabricated monthly example/);
  const head = setup({ records: stored, pathname: '/research/member/reports/monthly/2026-10-16', requestMethod: 'HEAD' });
  const res = await simulate(head.args);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(head.fake.calls.length, 1);
});

test('path traversal, public sample and forged membership query cannot reach or bypass origin', async () => {
  for (const badPath of [
    '/research/sample/',
    '/reports/weekly/2026-10-23',
    '/research/member/reports/weekly/2026-10-23/../2026-10-16',
    '/research/member/reports/monthly/2026-02-30',
  ]) {
    const s = setup({ pathname: badPath });
    const res = await simulate(s.args);
    assert.equal(res.statusCode, 404);
    assert.equal(s.fake.calls.length, 0);
  }
  const forged = setup({ pathname: '/research/member/reports/weekly/2026-10-23?entitlement=active',
    value: { user: { id: RID }, profile: { status: 'active' }, allowed: false, entitlement: null } });
  assert.equal((await simulate(forged.args)).statusCode, 403);
  assert.equal(forged.fake.calls.length, 0);
});

test('origin read refuses invalid product, date or traversal before mock transport call', async () => {
  const s = setup();
  for (const bad of [
    { productId: 'library-pass', reportType: 'weekly', periodEnd: '2026-10-23' },
    { productId: 'research-membership', reportType: 'daily', periodEnd: '2026-10-23' },
    { productId: 'research-membership', reportType: 'weekly', periodEnd: '2026-02-30' },
    { productId: 'research-membership', reportType: '../weekly', periodEnd: '2026-10-23' },
  ]) {
    await assert.rejects(s.store.read(bad), /synthetic/i);
  }
  assert.equal(s.fake.calls.length, 0);
});

test('missing and ambiguous private origin records never return synthetic 200', async () => {
  const absent = setup({ records: [] });
  assert.equal((await simulate(absent.args)).statusCode, 404);
  assert.equal(absent.fake.calls.length, 1);
  const duplicates = setup({ records: [asset(), asset()] });
  const denied = await simulate(duplicates.args);
  assert.equal(denied.statusCode, 503);
  assert.equal(denied.body, '');
  assert.equal(duplicates.fake.calls.length, 1);
});

test('malformed status, JSON, media type, provider URLs and extra customer fields fail closed', async () => {
  const invalidRows = [
    [{ ...asset(), body: BODY + ' altered' }],
    [{ ...asset(), bodySha256: '0'.repeat(64) }],
    [{ ...asset(), approvedForMemberDelivery: false }],
    [{ ...asset(), rightsApproval: 'real-provider-approved' }],
    [{ ...asset(), originPublic: true }],
    [{ ...asset(), reportType: 'monthly' }],
    [{ ...asset(), privateObjectUrl: 'https://example.invalid/blob' }],
    [{ ...asset(), providerSourceUrl: 'https://example.invalid/raw' }],
    [{ ...asset(), email: 'fake@invalid.example' }],
    [{ ...asset(), providerSubscriptionId: 'fabricated-id' }],
    [{ ...asset(), sourceCommit: 'invalid' }],
    [null],
    {},
  ];
  for (const rows of invalidRows) {
    const s = setup({ records: rows });
    const res = await simulate(s.args);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body, '');
    assert.equal(s.fake.calls.length, 1);
  }
  for (const conditions of [
    { status: 403 }, { status: 404 }, { status: 302 },
    { mediaType: 'text/html' }, { mediaType: '' },
    { invalidJson: true }, { throwError: true },
  ]) {
    const s = setup({ overrideOrigin: conditions });
    const res = await simulate(s.args);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body, '');
    assert.doesNotMatch(JSON.stringify(res), /synthetic mock error not for user|invalid JSON from fake store/);
  }
});

test('authorization and synthetic account failures do not trigger any asset lookup', async () => {
  for (const failure of ['session', 'access']) {
    const s = setup({ failure });
    const result = await simulate(s.args);
    assert.equal(result.statusCode, 503);
    assert.equal(result.body, '');
    assert.equal(s.fake.calls.length, 0);
  }
  for (const state of ['refunded', 'pending', 'past_due', 'cancelled']) {
    const s = setup({ value: {
      user: { id: RID }, profile: { status: 'active' }, allowed: false,
      entitlement: { accountId: RID, productId: 'research-membership', state },
    } });
    const result = await simulate(s.args);
    assert.equal(result.statusCode, 403);
    assert.equal(s.fake.calls.length, 0);
  }
});
