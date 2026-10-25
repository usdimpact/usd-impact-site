import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestScoreHandoff, validScoreHandoffPayload } from '../src/lib/score-handoff-browser.js';

const TICKET = 'Q'.repeat(43);
const valid = { allowed: true, ticket: TICKET, path: '/en/', expiresAt: '2031-01-01T00:01:00.000Z' };
function response(status, payload = valid) {
  return { status, async json() { return payload; } };
}

test('browser requests a same-origin, credentialed JSON POST with no ticket or identity in URL', async () => {
  const calls = [];
  const result = await requestScoreHandoff('/en/', async (url, options) => {
    calls.push({ url, options });
    return response(200);
  });
  assert.deepEqual(result, { ok: true, ticket: TICKET, path: '/en/' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/score-handoff');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].options.body), { path: '/en/' });
  assert.equal(JSON.stringify(calls[0]).includes(TICKET), false);
});
test('all four fixed Score paths are supported; other destinations never contact backend', async () => {
  let calls = 0;
  for (const path of ['/en/', '/es/', '/archive/en/', '/archive/es/']) {
    assert.equal((await requestScoreHandoff(path, async () => {
      calls++;
      return response(200, { ...valid, path });
    })).ok, true);
  }
  for (const path of ['/','//evil.test','https://evil.test','/en/?token=x','/archive/2026-10-16/','/en/../']) {
    assert.deepEqual(await requestScoreHandoff(path, async () => { throw new Error('must not fetch'); }),
      { ok: false, code: 'INVALID_SCORE_PATH' });
  }
  assert.equal(calls, 4);
});
test('denies malformed server results, incorrect path and ticket, with no recovery redirect', async () => {
  for (const payload of [null, {}, { ...valid, allowed: false }, { ...valid, ticket: 'oops' },
    { ...valid, path: '/es/' }, { ...valid, expiresAt: 'not a date' },
    { ...valid, expiresAt: null }]) {
    assert.equal(validScoreHandoffPayload(payload, '/en/'), false);
    assert.deepEqual(await requestScoreHandoff('/en/', async () => response(200, payload)),
      { ok: false, code: 'INVALID_HANDOFF_RESPONSE' });
  }
});
test('anonymous, Library-only, disabled and network failure all fail closed', async () => {
  for (const [status, code] of [[401, 'AUTHENTICATION_REQUIRED'], [403, 'RESEARCH_MEMBERSHIP_REQUIRED'],
    [500, 'HANDOFF_UNAVAILABLE'], [503, 'HANDOFF_UNAVAILABLE']]) {
    assert.deepEqual(await requestScoreHandoff('/en/', async () => response(status)),
      { ok: false, code });
  }
  assert.deepEqual(await requestScoreHandoff('/en/', async () => { throw new Error('network'); }),
    { ok: false, code: 'HANDOFF_UNAVAILABLE' });
  assert.deepEqual(await requestScoreHandoff('/en/', async () => ({ status: 200, json: async () => {
    throw new Error('bad JSON');
  } })), { ok: false, code: 'INVALID_HANDOFF_RESPONSE' });
});

test('page uses standalone POST redemption on the Score origin, never iframe cookies, query tokens, or client-only unlocks', async () => {
  const html = await readFile(new URL('../src/pages/score.astro', import.meta.url), 'utf8');
  const csp = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  assert.match(html, /requestScoreHandoff/);
  assert.match(html, /method="POST"/);
  assert.match(html, /scoreHandoffOrigin.*score-redeem/);
  assert.match(html, /name="ticket"/);
  assert.match(html, /data-score-handoff/);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /data-score-target="(?:score-dashboard-frame|score-archive-frame)"/);
  assert.match(html, /data-score-target="_self"/);
  assert.match(html, /target !== '_self'/);
  assert.match(html, /type="hidden"/);
  assert.match(html, /standalone page after verifying/);
  assert.doesNotMatch(html, /location\.(?:href|assign|replace)\s*\(?.*ticket/);
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage|postMessage)\s*\(/);
  assert.match(csp, /resolveScoreStageEOrigin/);
  assert.match(csp, /const scoreFormActions = \["'self'", scorePipelineOrigin, stageEHandoffOrigin\]/);
  assert.match(csp, /form-action \$\{scoreFormActions\}/);
});
