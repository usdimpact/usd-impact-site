import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreMemberContent } from './score-member-handler.js';

const config = {
  url: 'https://example.supabase.co',
  secretKey: 'sb_secret_' + 'a'.repeat(32),
};

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body = '') { this.body = body; },
  };
}

function environment(enabled = 'true') {
  return { SCORE_VERCEL_MEMBER_GATE_ENABLED: enabled };
}

function request(path = 'en', method = 'GET') {
  return {
    method,
    url: '/api/account?action=score-member-content&path=' + encodeURIComponent(path),
    headers: {},
  };
}

test('member gate is disabled by default', async () => {
  const res = response();
  await handleScoreMemberContent(request(), res, { environment: environment('false') });
  assert.equal(res.statusCode, 503);
});

test('anonymous request is denied before private asset read', async () => {
  const res = response();
  let read = false;
  await handleScoreMemberContent(request(), res, {
    environment: environment(),
    resolveSessionWithRefresh: async () => null,
    assetStore: { read: async () => { read = true; return null; } },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(read, false);
  assert.match(res.body, /Sign in to USD Impact/);
});

test('inactive Research Membership is denied before private asset read', async () => {
  const res = response();
  let read = false;
  await handleScoreMemberContent(request(), res, {
    environment: environment(),
    resolveSessionWithRefresh: async () => ({ value: { allowed: false } }),
    assetStore: { read: async () => { read = true; return null; } },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(read, false);
});

test('authorized site session receives private Score HTML with strict response policy', async () => {
  const res = response();
  let verified = false;
  await handleScoreMemberContent(request('archive/2026-10-16/en.html'), res, {
    environment: environment(),
    config,
    resolveSessionWithRefresh: async ({ verifyAccessToken }) => {
      const value = await verifyAccessToken('site-access-token');
      return { value, refreshed: false };
    },
    readAccountAccessState: async ({ accessToken, productId }) => {
      assert.equal(accessToken, 'site-access-token');
      assert.equal(typeof productId, 'string');
      verified = true;
      return { allowed: true, user: { id: '00000000-0000-4000-8000-000000000001' } };
    },
    assetStore: { read: async () => ({
      path: '/archive/2026-10-16/en.html',
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Member Score</title>',
      sourceCommit: 'd'.repeat(40),
    }) },
  });
  assert.equal(verified, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Member Score/);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.headers.vary, 'Cookie');
  assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.match(res.headers['content-security-policy'], /default-src 'none'/);
  assert.equal(res.headers['x-score-source-commit'], 'd'.repeat(40));
});

test('HEAD is authorized but returns no private body', async () => {
  const res = response();
  await handleScoreMemberContent(request('en', 'HEAD'), res, {
    environment: environment(),
    config,
    resolveSessionWithRefresh: async () => ({ value: { allowed: true } }),
    assetStore: { read: async () => ({
      path: '/en/',
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Member Score</title>',
      sourceCommit: 'e'.repeat(40),
    }) },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '');
});

test('invalid member path and unsupported methods fail closed', async () => {
  const invalid = response();
  await handleScoreMemberContent(request('../../secret'), invalid, { environment: environment() });
  assert.equal(invalid.statusCode, 404);

  const method = response();
  await handleScoreMemberContent(request('en', 'POST'), method, { environment: environment() });
  assert.equal(method.statusCode, 405);
});
