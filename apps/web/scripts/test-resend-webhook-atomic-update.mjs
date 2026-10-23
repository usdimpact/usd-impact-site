import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import { handleResendWebhook } from '../src/lib/resend-webhook-handler.js';

// Synthetic signed events and in-memory HTTP storage only. No live requests.
const nowMs = Date.parse('2026-09-22T10:00:00Z');
const key = randomBytes(32);
const emailId = '00000000-0000-4000-8000-000000000679';
const environment = {
  RESEND_WEBHOOK_ENABLED: 'true',
  RESEND_WEBHOOK_SECRET: `whsec_${key.toString('base64')}`,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_offline_fixture_not_a_real_key',
  SUPABASE_SECRET_KEY: 'sb_secret_offline_fixture_not_a_real_key',
};
const clone = (value) => structuredClone(value);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const json = (body, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });

function database(options = {}) {
  const db = {
    rows: [{ id: 'outbox-atomic', status: 'accepted', provider: 'resend', provider_message_ref: emailId,
      error_code: null, state_version: 7, ...options.row }],
    receipts: new Map(), calls: [], writes: [], readCount: 0, patchCount: 0,
    options,
  };
  db.fetchImpl = async (value, request = {}) => {
    const url = new URL(value);
    assert.equal(url.origin, 'https://example.supabase.co', 'only the in-memory fixture origin is allowed');
    const method = request.method || 'GET';
    const body = request.body ? JSON.parse(request.body) : null;
    db.calls.push({ path: url.pathname, query: url.searchParams, method, body, prefer: request.headers?.Prefer });
    if (url.pathname === '/rest/v1/webhook_receipts') {
      if (method === 'POST') {
        if (db.receipts.has(body.provider_event_id)) return json([], 201);
        const receipt = { id: `receipt-${db.receipts.size}`, ...body };
        db.receipts.set(body.provider_event_id, receipt);
        return json([clone(receipt)], 201);
      }
      if (method === 'GET') {
        const row = db.receipts.get(url.searchParams.get('provider_event_id')?.slice(3));
        return json(row ? [clone(row)] : []);
      }
      if (method === 'PATCH') {
        const row = [...db.receipts.values()].find((r) => `eq.${r.id}` === url.searchParams.get('id'));
        assert.ok(row, 'receipt must exist');
        if (body.status === 'processed' && db.options.failFinishOnce) {
          db.options.failFinishOnce = false;
          return json({}, 503);
        }
        Object.assign(row, body);
        return request.headers.Prefer === 'return=representation' ? json([clone(row)]) : json(null, 204);
      }
    }
    if (url.pathname === '/rest/v1/notification_outbox') {
      if (method === 'GET') {
        assert.equal(url.searchParams.get('provider'), 'eq.resend');
        assert.equal(url.searchParams.get('provider_message_ref'), `eq.${emailId}`);
        assert.equal(url.searchParams.get('limit'), '2');
        const snapshot = clone(db.rows.filter((r) => r.provider === 'resend' && r.provider_message_ref === emailId));
        db.readCount += 1;
        if (db.options.beforeRead) await db.options.beforeRead(db, snapshot, db.readCount);
        return json(snapshot);
      }
      if (method === 'PATCH') {
        db.patchCount += 1;
        if (db.options.beforePatch) await db.options.beforePatch(db, body, db.patchCount);
        if (db.options.rejectUpdates) return json([]);
        if (Object.hasOwn(db.options, 'updateResponse')) return json(db.options.updateResponse);
        if (db.options.updateHttpError) return json({}, db.options.updateHttpError);
        if (db.options.invalidUpdateJson) return new Response('{bad', { status: 200 });
        if (db.options.emptyUpdateBody) return json(null, 204);
        // Model actual filtered UPDATE semantics. The legacy id-only path is
        // deliberately allowed here so the regression reproduces its real loss.
        const matches = db.rows.filter((row) => ['id', 'provider', 'provider_message_ref', 'status']
          .every((field) => !url.searchParams.has(field) || url.searchParams.get(field) === `eq.${row[field]}`));
        for (const row of matches) {
          Object.assign(row, body);
          db.writes.push(clone(body));
        }
        if (db.options.afterPatch) await db.options.afterPatch(db, body, matches.length);
        return request.headers.Prefer === 'return=representation' ? json(clone(matches)) : json(null, 204);
      }
    }
    throw new Error(`Unexpected fixture operation: ${method} ${url.pathname}`);
  };
  return db;
}

async function invoke(db, type = 'email.delivered', id = `msg_atomic_${type}`, changes = {}) {
  const rawBody = JSON.stringify({ type, created_at: '2026-09-22T09:59:30Z', data: {
    email_id: emailId, from: 'Application <fixture@example.com>', to: ['reader@example.com'],
    subject: 'Synthetic lifecycle event', ...changes.data,
  } });
  const timestamp = String(nowMs / 1000);
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  const request = { method: 'POST', rawBody, headers: { 'content-type': 'application/json',
    'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` } };
  const response = { statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); },
    end(body) { this.body = body; },
  };
  await handleResendWebhook(request, response, { environment, fetchImpl: db.fetchImpl, nowMs });
  return { ...response, parsed: JSON.parse(response.body) };
}
function assertCasRequests(db) {
  for (const call of db.calls.filter((c) => c.path === '/rest/v1/notification_outbox' && c.method === 'PATCH')) {
    assert.equal(call.query.get('id'), 'eq.outbox-atomic');
    assert.equal(call.query.get('provider'), 'eq.resend');
    assert.equal(call.query.get('provider_message_ref'), `eq.${emailId}`);
    assert.match(call.query.get('status') || '', /^eq\.[a-z_]+$/);
    assert.equal(call.query.get('select'), 'id,status,provider_message_ref');
    assert.equal(call.prefer, 'return=representation');
    assert.equal(Object.hasOwn(call.body, 'state_version'), false);
  }
  assert.equal(db.rows[0]?.state_version ?? 7, 7, 'business-event state_version is not a lock revision');
}
function assertRetryable(result, db, code) {
  assert.equal(result.statusCode, 503);
  assert.equal(result.parsed.code, code);
  assert.equal(result.headers['retry-after'], '5');
  const receipt = [...db.receipts.values()][0];
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.processed_at, null);
  assert.equal(receipt.last_error, code);
}

async function race(firstType, secondType, initial = 'accepted') {
  const readsReady = deferred();
  const firstWritten = deferred();
  const db = database({ row: { status: initial },
    beforeRead: async (_db, _snapshot, count) => {
      if (count === 2) readsReady.resolve();
      if (count <= 2) await readsReady.promise;
    },
    beforePatch: async (_db, body) => {
      const isSecond = secondType === 'email.delivery_delayed'
        ? body.error_code === 'RESEND_DELIVERY_DELAYED'
        : body.status === ({ 'email.sent': 'accepted', 'email.delivered': 'delivered', 'email.complained': 'complained' })[secondType];
      if (isSecond) await firstWritten.promise;
    },
    afterPatch: async () => { firstWritten.resolve(); },
  });
  const results = await Promise.all([invoke(db, firstType), invoke(db, secondType)]);
  return { db, results };
}

test('complaint committed first cannot be overwritten by a stale delivery', { timeout: 2000 }, async () => {
  const { db, results } = await race('email.complained', 'email.delivered');
  assert.equal(db.rows[0].status, 'complained');
  assert.equal(db.rows[0].error_code, 'RESEND_COMPLAINT');
  assert.ok(results.every((r) => r.statusCode === 200));
  assert.equal(db.writes.length, 1);
  assertCasRequests(db);
});
test('delivery committed first is followed by a recalculated complaint', { timeout: 2000 }, async () => {
  const { db, results } = await race('email.delivered', 'email.complained');
  assert.equal(db.rows[0].status, 'complained');
  assert.equal(db.rows[0].error_code, 'RESEND_COMPLAINT');
  assert.ok(results.every((r) => r.statusCode === 200));
  assert.equal(db.patchCount, 3);
  assert.equal(db.writes.length, 2);
  assertCasRequests(db);
});
for (const [negative, expected] of [
  ['email.complained', 'complained'], ['email.bounced', 'hard_bounced'],
  ['email.failed', 'terminal_failed'], ['email.suppressed', 'suppressed'],
]) {
  for (const positive of ['email.sent', 'email.delivered', 'email.delivery_delayed']) {
    test(`committed ${negative} survives concurrent ${positive}`, { timeout: 2000 }, async () => {
      const { db, results } = await race(negative, positive, 'sending');
      assert.equal(db.rows[0].status, expected);
      assert.equal(db.writes.length, 1);
      assert.ok(results.every((r) => r.statusCode === 200));
      assertCasRequests(db);
    });
  }
}
test('concurrent cancellation cannot be overwritten', async () => {
  const db = database({ beforePatch: (store) => { store.rows[0].status = 'cancelled'; } });
  const result = await invoke(db);
  assert.equal(result.statusCode, 200);
  assert.equal(db.rows[0].status, 'cancelled');
  assert.equal(db.writes.length, 0);
  assertCasRequests(db);
});
test('zero-row updates are bounded, remain retryable, and a later callback can converge', async () => {
  const db = database({ rejectUpdates: true });
  const result = await invoke(db);
  assertRetryable(result, db, 'OUTBOX_UPDATE_CONTENDED');
  assert.equal(db.patchCount, 3);
  assert.equal(db.readCount, 4);
  assert.equal(db.writes.length, 0);
  db.options.rejectUpdates = false;
  const retry = await invoke(db);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.parsed.duplicate, true);
  assert.equal(db.rows[0].status, 'delivered');
  assert.equal([...db.receipts.values()][0].status, 'processed');
  assertCasRequests(db);
});
test('terminal state observed after the last failed comparison finishes without another PATCH', async () => {
  const db = database({ rejectUpdates: true, beforePatch: (store, _body, count) => {
    if (count === 3) store.rows[0].status = 'complained';
  } });
  const result = await invoke(db);
  assert.equal(result.statusCode, 200);
  assert.equal(db.patchCount, 3);
  assert.equal(db.rows[0].status, 'complained');
  assert.equal(db.writes.length, 0);
});
for (const authShape of [false, true]) {
  test(`lost correlation after a match never becomes an auth exception (${authShape})`, async () => {
    const db = database({ beforePatch: (store) => { store.rows = []; } });
    const changes = authShape ? { data: { from: '"USD Impact" <no-reply@updates.usd-impact.com>', subject: 'Your secure USD Impact sign-in link' } } : {};
    const result = await invoke(db, 'email.delivered', 'msg_lost_correlation', changes);
    assertRetryable(result, db, 'OUTBOX_CORRELATION_PENDING');
    assert.equal(db.writes.length, 0);
  });
}
test('replacement row identity is not adopted after a failed comparison', async () => {
  const db = database({ beforePatch: (store) => { store.rows[0].id = 'replacement'; } });
  const result = await invoke(db);
  assert.equal(result.statusCode, 500);
  assert.equal(result.parsed.code, 'OUTBOX_IDENTITY_CHANGED');
  assert.equal(db.writes.length, 0);
});
test('ambiguous re-read is not acknowledged', async () => {
  const db = database({ rejectUpdates: true, beforePatch: (store) => {
    store.rows.push({ ...store.rows[0], id: 'second-outbox' });
  } });
  const result = await invoke(db);
  assert.equal(result.statusCode, 500);
  assert.equal(result.parsed.code, 'AMBIGUOUS_OUTBOX_MATCH');
  assert.equal(db.writes.length, 0);
});
const validUpdated = { id: 'outbox-atomic', status: 'delivered', provider_message_ref: emailId };
for (const updateResponse of [null, {}, false, '', [null], [[]], [{}],
  [{ ...validUpdated, id: 'wrong' }], [{ ...validUpdated, provider_message_ref: 'wrong' }],
  [{ ...validUpdated, status: 'accepted' }], [validUpdated, validUpdated],
]) {
  test(`invalid update evidence cannot finish a receipt: ${JSON.stringify(updateResponse)}`, async () => {
    const db = database({ updateResponse });
    const result = await invoke(db);
    assert.equal(result.statusCode, 500);
    assert.equal(result.parsed.code, 'INVALID_OUTBOX_UPDATE_RESPONSE');
    assert.equal([...db.receipts.values()][0].status, 'failed');
    assert.equal(db.writes.length, 0);
  });
}
for (const options of [{ updateHttpError: 403 }, { updateHttpError: 503 }, { invalidUpdateJson: true }, { emptyUpdateBody: true }]) {
  test(`update failure stays unacknowledged: ${JSON.stringify(options)}`, async () => {
    const db = database(options);
    const result = await invoke(db);
    assert.equal(result.statusCode, 500);
    assert.equal([...db.receipts.values()][0].status, 'failed');
    assert.equal(db.writes.length, 0);
  });
}
test('processed duplicate does not repeat an outbox write', async () => {
  const db = database();
  assert.equal((await invoke(db)).statusCode, 200);
  const patches = db.patchCount;
  const result = await invoke(db);
  assert.equal(result.statusCode, 200);
  assert.equal(result.parsed.duplicate, true);
  assert.equal(db.patchCount, patches);
});
test('retry after receipt persistence failure preserves a later complaint', async () => {
  const db = database({ failFinishOnce: true });
  assert.equal((await invoke(db)).statusCode, 500);
  assert.equal(db.rows[0].status, 'delivered');
  assert.equal((await invoke(db, 'email.complained')).statusCode, 200);
  const patches = db.patchCount;
  const result = await invoke(db);
  assert.equal(result.statusCode, 200);
  assert.equal(db.rows[0].status, 'complained');
  assert.equal(db.rows[0].error_code, 'RESEND_COMPLAINT');
  assert.equal(db.patchCount, patches);
});
