import assert from 'node:assert/strict';
import {
  readOwnVideoProgress, upsertOwnVideoProgress, readOwnLearningProgress,
  exportOwnAccount, requestOwnAccountDeletion, safeSupabaseError,
} from '../src/lib/supabase-server.js';
import {
  VIDEO_PROGRESS_STORAGE_TIMEOUT_MS, VIDEO_PROGRESS_ROW_BYTES, VIDEO_PROGRESS_LIST_BYTES,
  VideoProgressProviderError,
} from '../src/lib/video-progress-provider.js';

// Every provider response is injected. This suite never needs a real credential.
const common = {
  accessToken: 'synthetic-offline-token-not-a-real-credential',
  accountId: '00000000-0000-4000-8000-000000000001',
  contentId: 'video:offline-test', status: 'in_progress', progressPercent: 20,
  resumePositionSeconds: 24, durationSeconds: 120,
  config: { url: 'https://offline.invalid', publishableKey: 'synthetic-key', secretKey: null },
  now: new Date('2026-09-23T00:00:00Z'),
};
const row = (changes = {}) => ({
  account_id: common.accountId, content_id: common.contentId, status: 'in_progress',
  progress_percent: 20, resume_position: '24.0',
  data: { contentType: 'video', durationSeconds: 120 }, ...changes,
});
const reply = (body, status = 200, headers = {}) => new Response(body, {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const json = (body, status = 200, headers = {}) => reply(JSON.stringify(body), status, headers);
const tick = async () => { for (let n = 0; n < 16; n += 1) await Promise.resolve(); };
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
function errorIs(code, status) {
  return error => error instanceof VideoProgressProviderError && error.code === code && error.status === status;
}
function writeMock(respond = body => json([body]), initial = []) {
  const requests = [];
  return { requests, fetchImpl: async (url, options) => {
    assert.equal(new URL(url).origin, 'https://offline.invalid');
    requests.push({ url, ...options });
    if (options.method === 'GET') return json(initial);
    return respond(JSON.parse(options.body), options);
  } };
}
async function expectBadRead(body, extra = {}) {
  let requests = 0;
  await assert.rejects(upsertOwnVideoProgress({ ...common, ...extra, fetchImpl: async () => {
    requests += 1; return json(body);
  } }), errorIs('VIDEO_PROGRESS_RESPONSE_INVALID', 502));
  assert.equal(requests, 1);
}
function fakeClock() {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let now = 0; let id = 0;
  const timers = new Map();
  globalThis.setTimeout = (fn, ms) => { const key = ++id; timers.set(key, { fn, at: now + ms }); return key; };
  globalThis.clearTimeout = key => timers.delete(key);
  return {
    get count() { return timers.size; }, get created() { return id; },
    async advance(ms) {
      const until = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await tick();
      }
      now = until; await tick();
    },
    restore() { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; },
  };
}

await check('A valid empty read remains an empty result', async () => {
  assert.deepEqual(await readOwnVideoProgress({ ...common, fetchImpl: async () => json([]) }), []);
});
await check('A valid owner row remains frozen and keeps provider fields', async () => {
  const rows = await readOwnVideoProgress({ ...common, fetchImpl: async () => json([row({ updated_at: '2026-09-23T00:00:01Z' })]) });
  assert.equal(rows[0].updated_at, '2026-09-23T00:00:01Z'); assert.ok(Object.isFrozen(rows) && Object.isFrozen(rows[0]));
});
await check('A list of distinct owned video rows is accepted', async () => {
  const rows = await readOwnVideoProgress({ ...common, contentId: null, fetchImpl: async () => json([row(), row({ content_id: 'video:second' })]) });
  assert.equal(rows.length, 2);
});
await check('A matching acknowledgement returns the provider row, not request reconstruction', async () => {
  const mock = writeMock(body => json([{ ...body, updated_at: '2026-09-23T00:00:01Z' }], 201));
  const saved = await upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl });
  assert.equal(saved.updated_at, '2026-09-23T00:00:01Z'); assert.ok(Object.isFrozen(saved));
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.requests[1].headers.Prefer, 'resolution=merge-duplicates,return=representation');
});
await check('Owner token, publishable key and no-store/redirect policies remain explicit', async () => {
  const mock = writeMock(); await upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl });
  for (const req of mock.requests) {
    assert.equal(req.headers.apikey, common.config.publishableKey);
    assert.equal(req.headers.Authorization, `Bearer ${common.accessToken}`);
    assert.equal(req.redirect, 'error'); assert.equal(req.cache, 'no-store'); assert.ok(req.signal);
  }
  assert.equal(mock.requests[0].signal, mock.requests[1].signal);
});
await check('Completed status is preserved on a sequential backward seek', async () => {
  const completedAt = '2026-09-22T12:00:00Z';
  const mock = writeMock(body => json([body]), [row({ status: 'completed', progress_percent: 100, completed_at: completedAt })]);
  const saved = await upsertOwnVideoProgress({ ...common, resumePositionSeconds: 2, fetchImpl: mock.fetchImpl });
  assert.equal(saved.status, 'completed'); assert.equal(saved.progress_percent, 100);
  assert.equal(saved.resume_position, '2.0'); assert.equal(saved.completed_at, completedAt);
});
await check('New completion and its returned timestamp are verified', async () => {
  const mock = writeMock();
  const saved = await upsertOwnVideoProgress({ ...common, status: 'completed', resumePositionSeconds: 120, progressPercent: 100, fetchImpl: mock.fetchImpl });
  assert.equal(saved.completed_at, common.now.toISOString());
});
await check('Numeric provider position is accepted when it matches the rounded checkpoint', async () => {
  const mock = writeMock(body => json([{ ...body, resume_position: Number(body.resume_position) }]));
  assert.equal((await upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl })).resume_position, 24);
});

for (const [name, payload] of [
  ['object', {}], ['null', null], ['string', 'bad'], ['scalar row', [true]],
  ['foreign account', [row({ account_id: '00000000-0000-4000-8000-000000000002' })]],
  ['wrong content', [row({ content_id: 'video:other' })]], ['array content', [row({ content_id: ['video:offline-test'] })]],
  ['duplicate row', [row(), row()]], ['unknown status', [row({ status: 'playing' })]],
  ['null position', [row({ resume_position: null })]], ['boolean position', [row({ resume_position: true })]],
  ['blank position', [row({ resume_position: '' })]], ['negative position', [row({ resume_position: -1 })]],
  ['excessive position', [row({ resume_position: 86401 })]], ['exponent string', [row({ resume_position: '2.4e1' })]],
  ['percentage string', [row({ progress_percent: '20' })]], ['fractional percentage', [row({ progress_percent: 20.5 })]],
  ['excessive percentage', [row({ progress_percent: 101 })]],
  ['inconsistent completion', [row({ status: 'completed', progress_percent: 20 })]],
  ['inconsistent started position', [row({ status: 'started', progress_percent: 0 })]],
  ['invalid completed timestamp', [row({ completed_at: 'not-a-date' })]],
  ['invalid duration', [row({ data: { contentType: 'video', durationSeconds: 0 } })]],
  ['position exceeds stored duration', [row({ data: { contentType: 'video', durationSeconds: 10 } })]],
]) {
  await check(`Malformed initial read is rejected before any write: ${name}`, () => expectBadRead(payload));
}
await check('List duplicates fail rather than silently discarding one result', async () => {
  await assert.rejects(readOwnVideoProgress({ ...common, contentId: null, fetchImpl: async () => json([row(), row()]) }), errorIs('VIDEO_PROGRESS_RESPONSE_INVALID', 502));
});
for (const [name, responder] of [
  ['asynchronous 202 is not a committed representation', body => json([body], 202)],
  ['empty array', () => json([], 201)], ['204 no body', () => new Response(null, { status: 204 })],
  ['malformed JSON', () => reply('not-json')], ['object instead of array', body => json(body)],
  ['multiple rows', body => json([body, body])], ['foreign owner', body => json([{ ...body, account_id: 'foreign-owner' }])],
  ['wrong content', body => json([{ ...body, content_id: 'video:other' }])],
  ['wrong position', body => json([{ ...body, resume_position: 25 }])],
  ['wrong percentage', body => json([{ ...body, progress_percent: 21 }])],
  ['wrong status', body => json([{ ...body, status: 'started' }])],
  ['missing duration', body => json([{ ...body, data: {} }])],
  ['wrong duration', body => json([{ ...body, data: { contentType: 'video', durationSeconds: 121 } }])],
  ['provider failure', () => reply('private provider error secret-marker', 503)],
  ['provider request timeout', () => reply('request timed out', 408)],
  ['transport failure', () => { throw new Error('secret-marker'); }],
]) {
  await check(`Unconfirmed write has no fabricated ACK and no server retry: ${name}`, async () => {
    const mock = writeMock(responder);
    await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl }), error => {
      assert.ok(errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409)(error));
      const safe = safeSupabaseError(error);
      assert.equal(safe.status, 409); assert.equal(safe.payload.code, 'VIDEO_PROGRESS_SAVE_UNCONFIRMED');
      assert.ok(!JSON.stringify(safe).includes('secret-marker')); assert.equal(error.details, undefined);
      return true;
    });
    assert.equal(mock.requests.length, 2);
  });
}
await check('Completion downgrade in returned representation is unconfirmed', async () => {
  const mock = writeMock(body => json([{ ...body, status: 'in_progress', progress_percent: 99 }]));
  await assert.rejects(upsertOwnVideoProgress({ ...common, status: 'completed', progressPercent: 100, resumePositionSeconds: 120, fetchImpl: mock.fetchImpl }), errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
});
for (const status of [400, 401, 403, 404, 409, 422, 429]) {
  await check(`Provider HTTP ${status} denial is retained and sanitized`, async () => {
    const mock = writeMock(() => reply('secret-marker and internal details', status));
    await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl }), error => {
      assert.equal(error.status, status); assert.equal(error.code, 'VIDEO_PROGRESS_REQUEST_REJECTED');
      assert.ok(!JSON.stringify(safeSupabaseError(error)).includes('secret-marker')); return true;
    });
    assert.equal(mock.requests.length, 2);
  });
}
await check('503 during previous-row read stays 503 and no write is dispatched', async () => {
  let count = 0;
  await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: async () => { count += 1; return reply('private-provider-error', 503); } }), errorIs('VIDEO_PROGRESS_PROVIDER_FAILED', 503));
  assert.equal(count, 1);
});
for (const [name, res] of [
  ['unexpected 206 read status', () => reply('[]', 206)],
  ['wrong MIME', () => reply('[]', 200, { 'content-type': 'text/html' })],
  ['declared oversize', () => reply('[]', 200, { 'content-length': String(VIDEO_PROGRESS_ROW_BYTES + 1) })],
  ['malformed length', () => reply('[]', 200, { 'content-length': '12x' })],
  ['malformed JSON', () => reply('{')],
  ['invalid UTF8', () => reply(new Uint8Array([0xc3, 0x28]))],
  ['overflow without declared length', () => json([row({ padding: 'x'.repeat(VIDEO_PROGRESS_ROW_BYTES) })])],
  ['no readable body', () => ({ status: 200, headers: new Headers({ 'content-type': 'application/json' }), text: async () => '[]' })],
  ['redirect response', () => ({ status: 200, redirected: true, body: null })],
]) {
  await check(`Bounded read rejects ${name}`, async () => {
    await assert.rejects(readOwnVideoProgress({ ...common, fetchImpl: async () => res() }), error => error instanceof VideoProgressProviderError && error.status === 502);
  });
}
await check('The exact single-row byte boundary is accepted', async () => {
  const base = JSON.stringify([row({ padding: '' })]);
  const payload = base.replace('"padding":""', `"padding":"${'x'.repeat(VIDEO_PROGRESS_ROW_BYTES - Buffer.byteLength(base))}"`);
  assert.equal(Buffer.byteLength(payload), VIDEO_PROGRESS_ROW_BYTES);
  assert.equal((await readOwnVideoProgress({ ...common, fetchImpl: async () => reply(payload) })).length, 1);
});
await check('The all-video byte boundary is independently enforced', async () => {
  await assert.rejects(readOwnVideoProgress({ ...common, contentId: null, fetchImpl: async () => json([row({ padding: 'x'.repeat(VIDEO_PROGRESS_LIST_BYTES) })]) }), errorIs('VIDEO_PROGRESS_RESPONSE_INVALID', 502));
});
await check('Split UTF8 sequences are read correctly below the byte limit', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify([row({ extra: '\u00e9' })]));
  const offset = bytes.findIndex(b => b === 0xc3) + 1;
  const stream = new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, offset)); c.enqueue(bytes.slice(offset)); c.close(); } });
  const result = await readOwnVideoProgress({ ...common, fetchImpl: async () => reply(stream) });
  assert.equal(result[0].extra, '\u00e9');
});
await check('Overflow cancels the source stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(VIDEO_PROGRESS_ROW_BYTES + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(readOwnVideoProgress({ ...common, fetchImpl: async () => reply(stream) }));
  await tick(); assert.equal(cancelled, true);
});

await check('Stalled headers time out before writing and clear the timer', async () => {
  const clock = fakeClock(); let signal; let count = 0;
  try {
    const pending = upsertOwnVideoProgress({ ...common, fetchImpl: (_url, options) => { count += 1; signal = options.signal; return new Promise(() => {}); } });
    const rejected = assert.rejects(pending, errorIs('VIDEO_PROGRESS_TIMEOUT', 504));
    await tick(); await clock.advance(VIDEO_PROGRESS_STORAGE_TIMEOUT_MS - 1);
    assert.equal(signal.aborted, false); await clock.advance(1); await rejected;
    assert.equal(signal.aborted, true); assert.equal(count, 1); assert.equal(clock.count, 0);
  } finally { clock.restore(); }
});
await check('Stalled read body times out and is cancelled', async () => {
  const clock = fakeClock(); let cancelled = false;
  try {
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const pending = readOwnVideoProgress({ ...common, fetchImpl: async () => reply(stream) });
    const rejected = assert.rejects(pending, errorIs('VIDEO_PROGRESS_TIMEOUT', 504));
    await tick(); await clock.advance(VIDEO_PROGRESS_STORAGE_TIMEOUT_MS); await rejected;
    assert.equal(cancelled, true); assert.equal(clock.count, 0);
  } finally { clock.restore(); }
});
await check('A slow GET and POST share one budget, not two per-fetch deadlines', async () => {
  const clock = fakeClock(); let releaseRead; let count = 0; const signals = [];
  try {
    const pending = upsertOwnVideoProgress({ ...common, fetchImpl: (_url, options) => {
      count += 1; signals.push(options.signal);
      if (count === 1) return new Promise(resolve => { releaseRead = resolve; });
      return new Promise(() => {});
    } });
    const rejected = assert.rejects(pending, errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
    await tick(); await clock.advance(4_000); releaseRead(json([])); await tick();
    assert.equal(count, 2); assert.equal(signals[0], signals[1]); assert.equal(clock.created, 1);
    await clock.advance(1_000); await rejected; assert.equal(clock.count, 0);
  } finally { clock.restore(); }
});
await check('A late previous-row read cannot start a POST after timeout', async () => {
  const clock = fakeClock(); let releaseRead; let count = 0;
  try {
    const pending = upsertOwnVideoProgress({ ...common, fetchImpl: () => { count += 1; return new Promise(resolve => { releaseRead = resolve; }); } });
    const rejected = assert.rejects(pending, errorIs('VIDEO_PROGRESS_TIMEOUT', 504));
    await tick(); await clock.advance(VIDEO_PROGRESS_STORAGE_TIMEOUT_MS); await rejected;
    releaseRead(json([])); await tick(); assert.equal(count, 1); assert.equal(clock.count, 0);
  } finally { clock.restore(); }
});
await check('A stalled POST body is unconfirmed even after successful HTTP headers', async () => {
  const clock = fakeClock(); let cancelled = false;
  try {
    const mock = writeMock(() => reply(new ReadableStream({ cancel() { cancelled = true; } })));
    const pending = upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl });
    const rejected = assert.rejects(pending, errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
    await tick(); await clock.advance(VIDEO_PROGRESS_STORAGE_TIMEOUT_MS); await rejected;
    assert.equal(cancelled, true); assert.equal(mock.requests.length, 2); assert.equal(clock.count, 0);
  } finally { clock.restore(); }
});
await check('Monotonic elapsed time rejects a late ACK even before the timer callback runs', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let elapsed = 0;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => elapsed } });
  const clock = fakeClock();
  try {
    const mock = writeMock(body => { elapsed = VIDEO_PROGRESS_STORAGE_TIMEOUT_MS + 1; return json([body]); });
    await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl }), errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
    assert.equal(clock.count, 0); assert.equal(mock.requests.length, 2);
  } finally {
    clock.restore(); Object.defineProperty(globalThis, 'performance', descriptor);
  }
});
await check('Success also clears its single timer and abort listener', async () => {
  const clock = fakeClock();
  try {
    const mock = writeMock(); await upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl });
    assert.equal(clock.created, 1); assert.equal(clock.count, 0); assert.ok(mock.requests[0].signal.aborted);
  } finally { clock.restore(); }
});

await check('Invalid content ID still fails before the provider is called', async () => {
  let count = 0;
  await assert.rejects(upsertOwnVideoProgress({ ...common, contentId: 'video:../bad', fetchImpl: async () => { count += 1; return json([]); } }), /valid video content ID/);
  assert.equal(count, 0);
});
await check('Unrelated learning-summary reads keep their original behavior and transport', async () => {
  const result = await readOwnLearningProgress({ ...common, fetchImpl: async (_url, options) => {
    assert.equal(options.signal, undefined); assert.equal(options.redirect, undefined); return json({});
  } });
  assert.deepEqual(result, []);
});
await check('Unrelated account export retains its larger response contract', async () => {
  const payload = { notes: 'x'.repeat(VIDEO_PROGRESS_LIST_BYTES + 1) };
  const result = await exportOwnAccount({ ...common, fetchImpl: async (url, options) => {
    assert.equal(options.signal, undefined);
    if (url.endsWith('/auth/v1/user')) return json({ id: common.accountId, email: 'test@offline.invalid', email_confirmed_at: '2026-09-23T00:00:00Z' });
    return json(payload);
  } });
  assert.deepEqual(result.data, payload);
});
await check('Unrelated account-deletion RPC keeps its existing request contract', async () => {
  let called = false;
  const result = await requestOwnAccountDeletion({ ...common, fetchImpl: async (url, options) => {
    assert.equal(options.signal, undefined);
    if (url.endsWith('/auth/v1/user')) return json({ id: common.accountId, email: 'test@offline.invalid', email_confirmed_at: '2026-09-23T00:00:00Z' });
    assert.ok(url.endsWith('/rest/v1/rpc/request_account_deletion')); called = true;
    assert.equal(options.method, 'POST'); return json({ status: 'deletion_pending' });
  } });
  assert.equal(called, true); assert.equal(result.profile.status, 'deletion_pending');
});

// Negative transaction evidence takes precedence over a matching returned row.
for (const preference of [
  'tx=rollback',
  'return=representation, tx=rollback',
  'tx = rollback , return=representation',
  'TX="ROLLBACK"',
  'return=representation, tx=rollback; diagnostic=ignored',
  'tx=commit, tx=rollback',
]) {
  await check(`Explicit transaction rollback is not acknowledged: ${preference}`, async () => {
    const mock = writeMock(body => json([body], 201, { 'Preference-Applied': preference }));
    await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl }), errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
    assert.equal(mock.requests.length, 2, 'There is no additional read, retry or commit-forcing request.');
    assert.equal(mock.requests[1].headers.Prefer, 'resolution=merge-duplicates,return=representation');
  });
}
for (const preference of [null, 'return=representation', 'return=representation, tx=commit']) {
  await check(`Normal transaction preference remains compatible: ${preference ?? 'absent'}`, async () => {
    const headers = preference === null ? {} : { 'Preference-Applied': preference };
    const mock = writeMock(body => json([body], 201, headers));
    assert.equal((await upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl })).resume_position, '24.0');
    assert.equal(mock.requests.length, 2);
  });
}
await check('An empty GET remains valid when its transaction rolls back', async () => {
  assert.deepEqual(await readOwnVideoProgress({ ...common, fetchImpl: async () => json([], 200, { 'Preference-Applied': 'tx=rollback' }) }), []);
});
await check('Explicit rollback cancels the returned body without reading it', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const mock = writeMock(() => reply(stream, 201, { 'Preference-Applied': 'tx=rollback' }));
  await assert.rejects(upsertOwnVideoProgress({ ...common, fetchImpl: mock.fetchImpl }), errorIs('VIDEO_PROGRESS_SAVE_UNCONFIRMED', 409));
  await tick();
  assert.equal(cancelled, true);
  assert.equal(mock.requests.length, 2);
});

console.log(JSON.stringify({ suite: 'video-progress-provider', passed: checks.length, checks }));
