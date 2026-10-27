import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleScoreMemberContent,
  handleScoreMemberRedeem,
} from './score-member-handler.js';

const token = 't'.repeat(43);
const config = {
  url: 'https://example.supabase.co',
  secretKey: 'sb_secret_' + 'a'.repeat(32),
};
function response() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = body; },
  };
}
function baseEnvironment(enabled = 'true') {
  return { SCORE_VERCEL_MEMBER_GATE_ENABLED: enabled };
}
function providers(active = true) {
  return {
    membership: { isActive: async () => active },
    sessions: {
      create: async () => ({ token, expiresAtMs: Date.now() + 120000 }),
      lookup: async (value) => value === token ? {
        accountId: '00000000-0000-4000-8000-000000000001',
        expiresAtMs: Date.now() + 120000,
      } : null,
    },
  };
}

test('member gate is disabled by default', async () => {
  const res = response();
  await handleScoreMemberContent({
    method: 'GET', url: '/api/score-member?action=content&path=en',
    headers: { cookie: `__Host-score_session=${token}` },
  }, res, { environment: baseEnvironment('false') });
  assert.equal(res.statusCode, 503);
});

test('same-origin ticket redemption creates secure Score session and redirects locally', async () => {
  const res = response();
  await handleScoreMemberRedeem({
    method: 'POST',
    url: '/api/score-member?action=redeem',
    body: { ticket: 'a'.repeat(43) },
    headers: {
      host: 'preview.example.test',
      origin: 'https://preview.example.test',
      'x-forwarded-proto': 'https',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-fetch-site': 'same-origin',
    },
  }, res, {
    environment: baseEnvironment(),
    config,
    ticketStore: {},
    providers: providers(),
    redeemScoreHandoff: async () => ({
      allowed: true, token, expiresAtMs: Date.now() + 120000, path: '/en/',
    }),
  });
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, '/score/member/en/');
  assert.match(res.headers['set-cookie'], /^__Host-score_session=/);
  assert.match(res.headers['set-cookie'], /Secure/);
  assert.match(res.headers['set-cookie'], /HttpOnly/);
  assert.match(res.headers['set-cookie'], /SameSite=Lax/);
});

test('cross-site redemption is denied before ticket use', async () => {
  const res = response();
  let called = false;
  await handleScoreMemberRedeem({
    method: 'POST', url: '/api/score-member?action=redeem',
    body: { ticket: 'a'.repeat(43) },
    headers: {
      host: 'preview.example.test',
      origin: 'https://attacker.test',
      'x-forwarded-proto': 'https',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-fetch-site': 'cross-site',
    },
  }, res, {
    environment: baseEnvironment(), config,
    redeemScoreHandoff: async () => { called = true; return null; },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test('missing session cookie denies private content', async () => {
  const res = response();
  await handleScoreMemberContent({
    method: 'GET', url: '/api/score-member?action=content&path=en',
    headers: {},
  }, res, { environment: baseEnvironment(), config });
  assert.equal(res.statusCode, 403);
});

test('authorized member receives private HTML with strict response policy', async () => {
  const res = response();
  await handleScoreMemberContent({
    method: 'GET', url: '/api/score-member?action=content&path=archive/2026-10-16/en.html',
    headers: { cookie: `__Host-score_session=${token}` },
  }, res, {
    environment: baseEnvironment(), config,
    providers: providers(),
    authorizeScoreSession: async () => true,
    assetStore: { read: async () => ({
      path: '/archive/2026-10-16/en.html',
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Member Score</title>',
      sourceCommit: 'd'.repeat(40),
    }) },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Member Score/);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.match(res.headers['content-security-policy'], /default-src 'none'/);
});

test('revoked membership denies immediately and clears Score session', async () => {
  const res = response();
  await handleScoreMemberContent({
    method: 'GET', url: '/api/score-member?action=content&path=en',
    headers: { cookie: `__Host-score_session=${token}` },
  }, res, {
    environment: baseEnvironment(), config,
    providers: providers(false),
    authorizeScoreSession: async () => false,
  });
  assert.equal(res.statusCode, 403);
  assert.match(res.headers['set-cookie'], /Max-Age=0/);
});

test('invalid member path and unsupported methods fail closed', async () => {
  const invalid = response();
  await handleScoreMemberContent({
    method: 'GET', url: '/api/score-member?action=content&path=../../secret',
    headers: { cookie: `__Host-score_session=${token}` },
  }, invalid, { environment: baseEnvironment(), config });
  assert.equal(invalid.statusCode, 404);

  const method = response();
  await handleScoreMemberContent({
    method: 'POST', url: '/api/score-member?action=content&path=en',
    headers: {},
  }, method, { environment: baseEnvironment(), config });
  assert.equal(method.statusCode, 405);
});
