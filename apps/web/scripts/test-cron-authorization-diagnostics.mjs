import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import {
  CRON_DIAGNOSTICS_EXPIRES_AT,
  createCronAuthorizationDiagnosticReporter,
} from '../src/lib/cron-authorization-diagnostics.js';

const START = Date.parse('2026-09-25T00:00:00Z');
const SECRET = 'synthetic-fixture-only-not-a-real-secret-631';
const source = readFileSync(new URL('../src/lib/account-deletion-finalizer.js', import.meta.url), 'utf8');
// Run the actual exported validator body without loading unrelated DB/email code.
// Full module regression remains covered by the existing finalizer tests in CI.
const validatorSource = source.slice(source.indexOf('export function validCronAuthorization(')).replace('export ', '');
assert.ok(validatorSource.startsWith('function validCronAuthorization('));
function validator(report) {
  return runInNewContext(`${validatorSource}; validCronAuthorization`, {
    Buffer, timingSafeEqual, process: { env: {} }, recordCronAuthorizationDiagnostic: report,
  });
}
function legacy(request, environment = {}) {
  const secret = String(environment.CRON_SECRET || '');
  const header = String(request?.headers?.authorization || request?.headers?.Authorization || '');
  if (secret.length < 32 || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function fixture({ now = () => START, write, env = {}, headers = {} } = {}) {
  const records = [];
  const report = createCronAuthorizationDiagnosticReporter({ now, write: write || ((r) => records.push(r)) });
  return {
    records, report, authorize: validator(report),
    environment: { VERCEL_ENV: 'production', CRON_SECRET: SECRET, ...env },
    request: { headers: { 'user-agent': 'vercel-cron/1.0', authorization: `Bearer ${SECRET}`, ...headers } },
  };
}

const cases = [
  ['authorized', {}, {}, true],
  ['secret_missing', { CRON_SECRET: '' }, {}, false],
  ['secret_below_minimum', { CRON_SECRET: 'x'.repeat(31) }, { authorization: `Bearer ${'x'.repeat(31)}` }, false],
  ['header_missing', {}, { authorization: '' }, false],
  ['bearer_prefix_invalid', {}, { authorization: `bearer ${SECRET}` }, false],
  ['byte_length_mismatch', {}, { authorization: `Bearer ${SECRET}x` }, false],
  ['value_mismatch', {}, { authorization: `Bearer ${'x'.repeat(SECRET.length)}` }, false],
];
for (const [reason, env, headers, expected] of cases) {
  test(`classifies ${reason} without changing authorization`, () => {
    const f = fixture({ env, headers });
    assert.equal(f.authorize(f.request, f.environment), expected);
    assert.equal(f.records.length, 1);
    assert.equal(f.records[0].reason, reason);
    assert.equal(f.records[0].authorized, expected);
  });
}

test('whitespace/control/Unicode facts never normalize or accept a different token', () => {
  for (const suffix of [' ', '\n', '\t', '\r\n', '\u00a0', '\u00e9']) {
    const f = fixture({ env: { CRON_SECRET: SECRET + suffix } });
    assert.equal(f.authorize(f.request, f.environment), false);
    assert.equal(f.records[0].edge_trimmed_equal, suffix !== '\u00e9');
    assert.equal(f.records[0].secret_control_character, /[\x00-\x1f\x7f]/.test(suffix));
    assert.equal(f.records[0].secret_non_ascii, /[^\x00-\x7f]/.test(suffix));
  }
});

test('Headers.get is diagnosed without changing legacy acceptance', () => {
  const f = fixture();
  const request = { headers: new Headers({ authorization: `Bearer ${SECRET}`, 'user-agent': 'vercel-cron/1.0' }) };
  assert.equal(f.authorize(request, f.environment), false);
  assert.equal(f.records[0].reason, 'header_missing');
  assert.equal(f.records[0].authorization_header_kind, 'missing');
  assert.equal(f.records[0].headers_get_authorization_present, true);
});

test('array header classification retains existing coercion behavior', () => {
  const f = fixture({ headers: { authorization: [`Bearer ${SECRET}`] } });
  assert.equal(f.authorize(f.request, f.environment), legacy(f.request, f.environment));
  assert.equal(f.records[0].authorization_header_kind, 'array');
});

test('Preview/Development/absent/malformed environment labels emit nothing', () => {
  for (const VERCEL_ENV of ['preview', 'development', '', undefined, ' production', 'PRODUCTION']) {
    const f = fixture({ env: { VERCEL_ENV } });
    assert.equal(f.authorize(f.request, f.environment), true);
    assert.equal(f.records.length, 0);
  }
});

test('only exact cron hint emits; spoofing it never grants access', () => {
  for (const ua of ['', undefined, ['vercel-cron/1.0'], 'vercel-cron/1.0 attacker', 'curl']) {
    const f = fixture({ headers: { 'user-agent': ua, authorization: 'Bearer wrong' } });
    assert.equal(f.authorize(f.request, f.environment), false);
    assert.equal(f.records.length, 0);
  }
  const f = fixture({ headers: { authorization: 'Bearer wrong' } });
  assert.equal(f.authorize(f.request, f.environment), false);
  assert.equal(f.records.length, 1);
});

test('exact output allowlist excludes secret/header/URL/identity/length/hash values', () => {
  const f = fixture({ headers: { authorization: `Bearer ${SECRET}different`, cookie: 'private-cookie', host: 'private-host' } });
  Object.defineProperty(f.request, 'url', { get() { throw new Error('must not read URL'); } });
  Object.defineProperty(f.request, 'query', { get() { throw new Error('must not read query'); } });
  assert.equal(f.authorize(f.request, f.environment), false);
  assert.equal(f.records.length, 1);
  const raw = JSON.stringify(f.records);
  for (const forbidden of [SECRET, 'different', 'private-cookie', 'private-host', 'Bearer ']) assert.equal(raw.includes(forbidden), false);
  const keys = ['event','authorized','authorization_header_kind','headers_get_available','headers_get_authorization_present',
    'reason','secret_minimum_length_met','header_present','bearer_prefix_valid','token_byte_length_equal',
    'secret_edge_whitespace','token_edge_whitespace','secret_control_character','token_control_character',
    'secret_non_ascii','token_non_ascii','edge_trimmed_equal','observed_at'];
  assert.deepEqual(Object.keys(f.records[0]).sort(), keys.sort());
  const stringKeys = new Set(['event', 'reason', 'authorization_header_kind', 'observed_at']);
  for (const [key, value] of Object.entries(f.records[0])) {
    assert.ok(stringKeys.has(key) ? typeof value === 'string' : typeof value === 'boolean' || value === null);
  }
  assert.equal(Object.isFrozen(f.records[0]), true);
});

test('rate bound is one per five minutes and at most eight per process', () => {
  let at = START;
  const f = fixture({ now: () => at });
  for (let i = 0; i < 100; i += 1) f.authorize(f.request, f.environment);
  assert.equal(f.records.length, 1);
  at += 299999;
  f.authorize(f.request, f.environment);
  assert.equal(f.records.length, 1);
  at += 1;
  f.authorize(f.request, f.environment);
  assert.equal(f.records.length, 2);
  for (let i = 0; i < 20; i += 1) { at += 300000; f.authorize(f.request, f.environment); }
  assert.equal(f.records.length, 8);
});

test('expiry/invalid clocks stop reporting, not authentication', () => {
  for (const at of [CRON_DIAGNOSTICS_EXPIRES_AT, CRON_DIAGNOSTICS_EXPIRES_AT + 1, NaN, Infinity, -1]) {
    const f = fixture({ now: () => at });
    assert.equal(f.authorize(f.request, f.environment), true);
    assert.equal(f.records.length, 0);
  }
  const f = fixture({ now: () => CRON_DIAGNOSTICS_EXPIRES_AT - 1 });
  f.authorize(f.request, f.environment);
  assert.equal(f.records.length, 1);
});

test('logging/accessor/clock exceptions cannot change computed decisions', () => {
  for (const expected of [true, false]) {
    const headers = { authorization: expected ? `Bearer ${SECRET}` : 'Bearer wrong' };
    const f = fixture({ headers, write: () => { throw new Error('writer unavailable'); } });
    assert.equal(f.authorize(f.request, f.environment), expected);
    const g = fixture({ headers, now: () => { throw new Error('clock unavailable'); } });
    assert.equal(g.authorize(g.request, g.environment), expected);
    const h = fixture({ headers: { ...headers, get() { throw new Error('accessor unavailable'); } } });
    assert.equal(h.authorize(h.request, h.environment), expected);
  }
});

test('oversize inputs emit bounded categories without comparing trimmed values', () => {
  const f = fixture({ headers: { authorization: `Bearer ${'z'.repeat(10000)}` } });
  assert.equal(f.authorize(f.request, f.environment), false);
  assert.equal(f.records[0].reason, 'diagnostic_input_oversize');
  assert.ok(JSON.stringify(f.records[0]).length < 400);
  assert.equal(Object.hasOwn(f.records[0], 'edge_trimmed_equal'), false);
});

test('malformed reporter input never emits or throws', () => {
  const f = fixture();
  for (const bad of [null, {}, { environment: { VERCEL_ENV: 'production' }, secret: [], header: {}, authorized: 'true' }]) {
    assert.doesNotThrow(() => f.report(bad));
  }
  assert.equal(f.records.length, 0);
});

test('actual validator preserves legacy outcomes over 187 deterministic cases', () => {
  const secrets = ['', 'a'.repeat(31), 'a'.repeat(32), SECRET, SECRET + ' ', SECRET + '\n', '\u00e9'.repeat(32), null, 123, ['a'.repeat(32)], false];
  let count = 0;
  for (const secret of secrets) {
    const token = String(secret || '');
    const headerValues = [undefined, '', `Bearer ${token}`, `Bearer ${token} `, `Bearer ${token.trim()}`, `bearer ${token}`, token, `Basic ${token}`, `Bearer ${'x'.repeat(token.length)}`, [`Bearer ${token}`], ['Bearer a', 'Bearer b'], 123, false, { toString: () => `Bearer ${token}` }];
    const f = fixture();
    for (const authorization of headerValues) {
      const request = { headers: { authorization, 'user-agent': 'vercel-cron/1.0' } };
      const env = { VERCEL_ENV: 'production', CRON_SECRET: secret };
      assert.equal(f.authorize(request, env), legacy(request, env));
      count += 1;
    }
    for (const request of [undefined, {}, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'vercel-cron/1.0' } }]) {
      assert.equal(f.authorize(request, { CRON_SECRET: secret }), legacy(request, { CRON_SECRET: secret }));
      count += 1;
    }
  }
  assert.equal(count, 187);
});
