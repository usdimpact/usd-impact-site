import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runCalendarProbe } from './probe-publication-calendar.mjs';
import { verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { BLS_CALENDAR_USER_AGENT, BLS_CPI_SCHEDULE, BLS_CPI_RELEASE, readOfficialBlsHtml } from '../src/lib/bls-cpi-calendar.js';
import { candidate, monthlyHtml, releaseHtml, scheduleHtml } from './fixtures/publication-calendar.js';

const NOW = Date.parse('2026-09-09T18:00:00Z');
const SECRET = 'private-canary-must-not-appear';
let tests = 0;
const test = async (name, fn) => { await fn(); tests += 1; };
const read = (fetchImpl) => readOfficialBlsHtml(BLS_CPI_SCHEDULE, { now: () => NOW, fetchImpl });
const failed = async (fetchImpl) => {
  let failure;
  await assert.rejects(() => read(fetchImpl), (error) => { failure = error; return error.name === 'CalendarHold'; });
  assert.ok(!JSON.stringify(failure.sourceDiagnostic).includes(SECRET));
  return failure;
};
await test('truthful robot identity is sent on a single direct request', async () => {
  let calls = 0;
  const source = await read(async (url, options) => {
    calls += 1;
    assert.equal(url, BLS_CPI_SCHEDULE);
    assert.equal(options.headers['User-Agent'], BLS_CALENDAR_USER_AGENT);
    assert.match(BLS_CALENDAR_USER_AGENT, /^USDImpact-CalendarValidator\//);
    assert.ok(!BLS_CALENDAR_USER_AGENT.includes('Mozilla'));
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    return new Response(scheduleHtml, { headers: { 'Content-Type': 'text/html' } });
  });
  assert.equal(calls, 1);
  assert.equal(source.diagnostic.httpStatus, 200);
  assert.equal(source.diagnostic.failureClass, null);
  assert.ok(Object.isFrozen(source.diagnostic));
});
for (const [status, failureClass] of [[401, 'access-denied'], [403, 'access-denied'], [429, 'rate-limited'], [500, 'server-error'], [503, 'server-error'], [404, 'http-error'], [302, 'redirect']]) {
  await test(`exact HTTP ${status} is observed without consuming its body`, async () => {
    let calls = 0;
    let options;
    const failure = await failed(async (_, config) => {
      calls += 1; options = config;
      return { status, redirected: false, url: BLS_CPI_SCHEDULE,
        headers: new Headers({ 'content-type': 'text/html', 'set-cookie': SECRET }),
        get body() { assert.fail('Denied response body must not be read.'); } };
    });
    assert.equal(calls, 1);
    assert.equal(failure.code, 'HOLD_SOURCE_UNAVAILABLE');
    assert.equal(failure.sourceDiagnostic.httpStatus, status);
    assert.equal(failure.sourceDiagnostic.failureClass, failureClass);
    assert.equal(failure.sourceDiagnostic.transportCode, null);
    assert.equal(options.signal.aborted, true);
  });
}
for (const [location, expected] of [
  [BLS_CPI_SCHEDULE, 'same-source'], [BLS_CPI_RELEASE, 'other-allowlisted-source'],
  [`/sso?token=${SECRET}`, 'other-same-origin'], [`https://external.example/?token=${SECRET}`, 'off-origin'],
  [`https://name:${SECRET}@www.bls.gov/`, 'credentials-present'], ['http://[', 'invalid'],
]) {
  await test(`redirect destination is classified as ${expected}, not emitted or followed`, async () => {
    const failure = await failed(async () => new Response(SECRET, { status: 302, headers: { Location: location } }));
    assert.equal(failure.sourceDiagnostic.redirectLocation, expected);
    assert.equal(failure.sourceDiagnostic.httpStatus, 302);
  });
}
for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'CERT_HAS_EXPIRED', SECRET]) {
  await test(`transport code uses a fixed diagnostic allowlist: ${code === SECRET ? 'unknown' : code}`, async () => {
    const failure = await failed(async () => { throw Object.assign(new Error(SECRET), { cause: { code } }); });
    assert.equal(failure.sourceDiagnostic.httpStatus, null);
    assert.equal(failure.sourceDiagnostic.transportCode, code === SECRET ? 'OTHER' : code);
    assert.equal(failure.sourceDiagnostic.failureClass, 'transport-error');
  });
}
await test('timeout is distinguished without a raw exception', async () => {
  await assert.rejects(() => readOfficialBlsHtml(BLS_CPI_SCHEDULE, { now: () => NOW, timeoutMs: 2,
    fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error(SECRET)), { once: true })),
  }), (error) => error.sourceDiagnostic.transportCode === 'TIMEOUT');
});
for (const value of ['120', '90001', SECRET, 'Wed, 09 Sep 2026 19:00:00 GMT']) {
  await test('Retry-After is numeric bounded metadata only', async () => {
    const failure = await failed(async () => new Response(null, { status: 429, headers: { 'Retry-After': value } }));
    assert.equal(failure.sourceDiagnostic.retryAfterSeconds, value === '120' ? 120 : null);
  });
}
await test('unknown media type is classified without echoing it', async () => {
  const failure = await failed(async () => new Response('x', { headers: { 'Content-Type': `application/${SECRET}` } }));
  assert.equal(failure.code, 'HOLD_SOURCE_SCHEMA');
  assert.equal(failure.sourceDiagnostic.contentType, 'other');
  assert.equal(failure.sourceDiagnostic.httpStatus, 200);
});
await test('held verifier retains safe failure details but no successful evidence', async () => {
  const result = await verifyPublicationCalendar(candidate, { now: () => NOW, fetchImpl: async () => new Response(null, { status: 403 }) });
  assert.equal(result.decision, 'HOLD_SOURCE_UNAVAILABLE');
  assert.equal(result.sourceDiagnostic.httpStatus, 403);
  assert.deepEqual(result.sources, []);
  assert.equal(result.publicationAuthorized, false);
});
await test('probe records denial and stops after one request', async () => {
  let calls = 0; let output;
  const code = await runCalendarProbe(['2026-08'], { write: (text) => { output = text; }, read: () => read(async () => { calls += 1; return new Response(null, { status: 403 }); }) });
  assert.equal(calls, 1);
  assert.equal(code, 2);
  assert.equal(JSON.parse(output).sourceDiagnostic.httpStatus, 403);
  assert.equal(JSON.parse(output).stage, 'schedule');
  assert.deepEqual(JSON.parse(output).sources, []);
  assert.equal(JSON.parse(output).publicationAttempted, false);
});
await test('all successful responses do not imply parser compatibility', async () => {
  let output;
  const code = await runCalendarProbe(['2026-08'], { write: (text) => { output = text; }, read: () => read(async () => new Response(`<h1>${SECRET}</h1>`, { headers: { 'Content-Type': 'text/html' } })) });
  assert.equal(code, 2);
  assert.equal(JSON.parse(output).responses[0].httpStatus, 200);
  assert.equal(JSON.parse(output).adapterProbe, 'HOLD_IDENTITY_MISMATCH');
  assert.ok(!output.includes(SECRET));
  assert.ok(!output.includes('publicMarkupExcerpt'));
});
await test('probe cross-checks three synthetic sources without authorizing publication', async () => {
  let output; let calls = 0;
  const code = await runCalendarProbe(['2026-08'], { write: (text) => { output = text; }, read: (url) => readOfficialBlsHtml(url, {
    now: () => NOW, fetchImpl: async () => { calls += 1; return new Response(url === BLS_CPI_SCHEDULE ? scheduleHtml : url === BLS_CPI_RELEASE ? releaseHtml() : monthlyHtml, { headers: { 'Content-Type': 'text/html' } }); },
  }) });
  assert.equal(code, 0); assert.equal(calls, 3);
  assert.equal(JSON.parse(output).adapterProbe, 'PASS');
  assert.equal(JSON.parse(output).responses.length, 3);
  assert.equal(JSON.parse(output).publicationAuthorized, false);
});
await test('probe rejects untrusted flags without making requests', async () => {
  for (const args of [[], ['2026-13'], ['2026-08', '--now=2020-01-01'], ['2026-08', '--url=https://evil.example/'], ['2026-08', '--publish']]) {
    assert.equal(await runCalendarProbe(args, { write: () => {}, read: () => assert.fail('Invalid input must not fetch.') }), 2);
  }
});
await test('no proxy, browser impersonation or raw markup log was added', async () => {
  const source = await readFile(new URL('../src/lib/bls-cpi-calendar.js', import.meta.url), 'utf8');
  const probe = await readFile(new URL('./probe-publication-calendar.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('Mozilla/'));
  assert.ok(!source.includes("redirect: 'follow'"));
  assert.ok(!probe.includes('publicMarkupExcerpt'));
});
console.log(`Publication calendar diagnostics: ${tests} regression groups passed (synthetic responses; no live-source certification).`);
