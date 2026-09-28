import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleWeeklyNewsletterCanary } from '../src/lib/weekly-newsletter-canary-handler.js';
import waitlistHandler from '../api/waitlist.js';
import { ENV, USER, NOW, harness } from './test-weekly-newsletter-canary.mjs';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => assert.fail('Canary contract tests must never contact a real service.');
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}
function request(body = undefined) {
  return { method: body === undefined ? 'GET' : 'POST', headers: { origin: 'https://www.usd-impact.com', 'content-type': 'application/json' }, body };
}
let checked = 0;
try {
  const h = harness();
  const options = { environment: ENV, ports: h.ports, getUser: async () => USER, readToken: () => 'mock-session', now: () => NOW };
  const mutations = h.calls.filter((call) => ['prepare', 'enqueue', 'weekly-send', 'confirmation-send'].includes(call));
  assert.equal(mutations.length, 0);
  for (const [req, override, status, code] of [
    [{ method: 'DELETE', headers: {} }, {}, 405, 'METHOD_NOT_ALLOWED'],
    [request(), { readToken: () => null }, 401, 'AUTHENTICATION_REQUIRED'],
    [request(), { getUser: async () => ({ ...USER, email: 'other@example.com' }) }, 403, 'CANARY_NOT_AUTHORIZED'],
    [request(), { getUser: async () => { throw { status: 401 }; } }, 401, 'AUTHENTICATION_REQUIRED'],
    [request(), { environment: { ...ENV, SUPABASE_URL: 'https://wrong.supabase.co' } }, 503, 'CANARY_DATABASE_MISMATCH'],
    [{ ...request({ operation: 'send-weekly', confirm: true }), headers: { origin: 'https://example.com' } }, {}, 403, 'CANARY_CROSS_SITE_REJECTED'],
    [{ ...request({ operation: 'send-weekly', confirm: true }), headers: { origin: 'https://www.usd-impact.com', 'content-type': 'text/plain' } }, {}, 415, 'CANARY_CONTENT_TYPE_INVALID'],
    [request({ operation: 'send-weekly', confirm: true, email: 'other@example.com' }), {}, 400, 'CANARY_BODY_INVALID'],
    [request({ operation: 'send-weekly', confirm: true, weekEnding: '2026-09-25' }), {}, 400, 'CANARY_BODY_INVALID'],
    [request({ operation: 'send-weekly', confirm: 'true' }), {}, 400, 'CANARY_BODY_INVALID'],
    [request({ operation: 'send-weekly', confirm: false }), {}, 400, 'CANARY_BODY_INVALID'],
    [request('x'.repeat(1025)), {}, 400, 'CANARY_BODY_INVALID'],
  ]) {
    const res = response();
    await handleWeeklyNewsletterCanary(req, res, { ...options, ...override });
    assert.equal(res.statusCode, status);
    assert.equal(res.body.code, code);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(JSON.stringify(res.body).includes(USER.email), false);
    assert.equal(JSON.stringify(res.body).includes(ENV.MARKETING_OPT_IN_SECRET), false);
    checked += 1;
  }
  const res = response();
  await handleWeeklyNewsletterCanary(request(), res, options);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.canRequestConfirmation, true);
  assert.equal(h.calls.some((call) => ['prepare', 'enqueue', 'weekly-send', 'confirmation-send'].includes(call)), false);
  checked += 1;
  const runtimeEnvironment = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  try {
    const routed = response();
    await waitlistHandler({ method: 'GET', url: '/api/waitlist?action=weekly-newsletter-canary', headers: {} }, routed);
    assert.equal(routed.statusCode, 404);
    assert.equal(routed.body.code, 'CANARY_NOT_AVAILABLE');
    checked += 1;
  } finally {
    if (runtimeEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = runtimeEnvironment;
  }
  const page = readFileSync(new URL('../src/pages/account/newsletter-canary.astro', import.meta.url), 'utf8');
  assert.ok(page.includes('noindex={true}'));
  assert.ok(page.includes("credentials: 'same-origin'"));
  assert.ok(page.includes('id="canary-opt-in" disabled'));
  assert.ok(page.includes('id="canary-send" disabled'));
  assert.equal(/setInterval|localStorage|sessionStorage/.test(page), false);
  checked += 1;
} finally { globalThis.fetch = originalFetch; }
console.log(`Weekly canary HTTP/UI binding: ${checked} scenarios passed; no external network allowed.`);
