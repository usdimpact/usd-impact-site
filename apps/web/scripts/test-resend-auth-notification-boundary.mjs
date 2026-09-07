import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleResendWebhook } from '../src/lib/resend-webhook-handler.js';

// Synthetic fixtures only. Never send a request, use a live key, or read email bodies.
const nowMs = Date.parse('2026-09-07T12:00:00Z');
const key = randomBytes(32);
const emailId = '00000000-0000-4000-8000-000000000001';
const environment = {
  RESEND_WEBHOOK_ENABLED: 'true',
  RESEND_WEBHOOK_SECRET: `whsec_${key.toString('base64')}`,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_offline_fixture_not_a_real_key',
  SUPABASE_SECRET_KEY: 'sb_secret_offline_fixture_not_a_real_key',
};
function fixture(type = 'email.delivered') {
  return { type, created_at: '2026-09-07T11:59:30Z', data: {
    email_id: emailId, from: '"USD Impact" <no-reply@updates.usd-impact.com>',
    to: ['reader@example.com'], subject: 'Your secure USD Impact sign-in link',
  } };
}
function responseMock() {
  return { statusCode: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); },
    end(value) { this.body = value; },
  };
}
function json(body, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}
function database({ rows = [], prior = null, readStatus = 200, invalidJson = false, failFinish = false } = {}) {
  const calls = [];
  let receipt = prior ? structuredClone(prior) : null;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://example.supabase.co', 'fixture must never reach another host');
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path: parsed.pathname, query: parsed.search, method, body });
    if (parsed.pathname === '/rest/v1/webhook_receipts') {
      if (method === 'POST') {
        if (receipt) return json([], 201);
        receipt = { id: 'receipt-offline', ...body };
        return json([receipt], 201);
      }
      if (method === 'GET') return json(receipt ? [receipt] : []);
      if (method === 'PATCH') {
        if (failFinish && body.status === 'ignored') return json({}, 503);
        receipt = { ...receipt, ...body };
        return options.headers.Prefer === 'return=representation' ? json([receipt]) : json(null, 204);
      }
    }
    if (parsed.pathname === '/rest/v1/notification_outbox') {
      if (method === 'GET') {
        assert.equal(parsed.searchParams.get('provider'), 'eq.resend');
        assert.equal(parsed.searchParams.get('provider_message_ref'), `eq.${emailId}`);
        assert.equal(parsed.searchParams.get('limit'), '2');
        return invalidJson ? new Response('{bad', { status: 200 }) : json(rows, readStatus);
      }
      if (method === 'PATCH') {
        assert.equal(rows.length, 1);
        assert.equal(parsed.searchParams.get('id'), `eq.${rows[0].id}`);
        Object.assign(rows[0], body);
        return json(null, 204);
      }
    }
    throw new Error(`Unexpected fixture operation: ${method} ${parsed.pathname}`);
  };
  return { calls, fetchImpl, receipt: () => receipt, rows };
}
async function invoke(event, options = {}) {
  const payload = options.payload ?? JSON.stringify(event);
  const svixId = options.svixId ?? 'msg_offline_auth_success';
  const timestamp = String(Math.floor(nowMs / 1000) + (options.offset ?? 0));
  const signature = createHmac('sha256', key).update(`${svixId}.${timestamp}.${payload}`).digest('base64');
  const request = Readable.from([payload]);
  request.method = options.method ?? 'POST';
  request.headers = { 'content-type': 'application/json', 'svix-id': svixId,
    'svix-timestamp': timestamp, 'svix-signature': `v1,${options.badSignature ? 'invalid' : signature}` };
  if (options.noHeaders) request.headers = { 'content-type': 'application/json' };
  const db = options.db ?? database(options);
  const response = responseMock();
  const logs = [];
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (...args) => logs.push(['info', ...args]);
  console.error = (...args) => logs.push(['error', ...args]);
  try {
    await handleResendWebhook(request, response, {
      environment: { ...environment, ...options.environment }, nowMs, fetchImpl: db.fetchImpl,
    });
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
  const parsed = JSON.parse(response.body);
  return { db, response, parsed, logs };
}
function noOutboxWrites(db) {
  assert.equal(db.calls.filter((c) => c.path === '/rest/v1/notification_outbox' && c.method !== 'GET').length, 0);
  assert.ok(db.calls.every((c) => ['/rest/v1/webhook_receipts', '/rest/v1/notification_outbox'].includes(c.path)));
}
for (const type of ['email.sent', 'email.delivered']) {
  test(`signed reserved auth ${type} finishes ignored, not in application outbox`, async () => {
    const { db, response, logs } = await invoke(fixture(type));
    assert.equal(response.statusCode, 200);
    assert.equal(db.receipt().status, 'ignored');
    assert.equal(db.receipt().processed_at, new Date(nowMs).toISOString());
    assert.equal(db.receipt().last_error, null);
    assert.equal(db.calls.length, 3);
    noOutboxWrites(db);
    assert.deepEqual(logs, [['info', 'Resend provider-managed authentication notification acknowledged.', {
      code: 'PROVIDER_MANAGED_AUTH_SUCCESS', eventType: type,
    }]]);
    assert.doesNotMatch(JSON.stringify(logs), /reader@example|email_id|payload_sha256|message_id|whsec_/);
  });
}
const unknownCases = [
  ['sender domain', (e) => { e.data.from = '"USD Impact" <no-reply@other.example>'; }],
  ['unquoted sender drift', (e) => { e.data.from = 'USD Impact <no-reply@updates.usd-impact.com>'; }],
  ['bare sender drift', (e) => { e.data.from = 'no-reply@updates.usd-impact.com'; }],
  ['sender suffix', (e) => { e.data.from += '.evil.example'; }],
  ['sender case drift', (e) => { e.data.from = e.data.from.toUpperCase(); }],
  ['sender newline', (e) => { e.data.from += '\n'; }],
  ['no sender', (e) => { delete e.data.from; }],
  ['subject only spoof', (e) => { e.data.from = 'Attacker <attacker@example.com>'; }],
  ['application subject', (e) => { e.data.subject = 'Your Library Pass access is ready'; }],
  ['subject suffix', (e) => { e.data.subject += ' extra'; }],
  ['subject newline', (e) => { e.data.subject += '\n'; }],
  ['subject case drift', (e) => { e.data.subject = e.data.subject.toLowerCase(); }],
  ['no subject', (e) => { delete e.data.subject; }],
  ['subject array', (e) => { e.data.subject = [e.data.subject]; }],
  ['no recipient', (e) => { e.data.to = []; }],
  ['multiple recipients', (e) => { e.data.to.push('second@example.com'); }],
  ['recipient string', (e) => { e.data.to = 'reader@example.com'; }],
  ['recipient object', (e) => { e.data.to = [{}]; }],
  ['recipient whitespace', (e) => { e.data.to = [' reader@example.com']; }],
  ['recipient newline', (e) => { e.data.to = ['reader@example.com\n']; }],
  ['recipient overlong', (e) => { e.data.to = ['a'.repeat(260) + '@example.com']; }],
  ['cc', (e) => { e.data.cc = ['copy@example.com']; }],
  ['bcc', (e) => { e.data.bcc = ['copy@example.com']; }],
  ['malformed cc', (e) => { e.data.cc = ''; }],
  ['broadcast', (e) => { e.data.broadcast_id = 'broadcast-fixture'; }],
  ['empty broadcast ID', (e) => { e.data.broadcast_id = ''; }],
  ['template', (e) => { e.data.template_id = 'template-fixture'; }],
  ['application tags', (e) => { e.data.tags = { category: 'purchase_access_ready' }; }],
  ['auth tags require explicit review', (e) => { e.data.tags = { category: 'auth_sign_in' }; }],
  ['malformed tags array', (e) => { e.data.tags = []; }],
  ['malformed tags string', (e) => { e.data.tags = ''; }],
  ['email ID padded', (e) => { e.data.email_id += ' '; }],
];
for (const [name, mutate] of unknownCases) {
  test(`ambiguous namespace stays retryable: ${name}`, async () => {
    const event = fixture(); mutate(event);
    const { response, parsed, db, logs } = await invoke(event);
    assert.equal(response.statusCode, 503);
    assert.equal(parsed.code, 'OUTBOX_CORRELATION_PENDING');
    assert.equal(response.headers['retry-after'], '5');
    assert.equal(db.receipt().status, 'failed');
    assert.ok(logs.every((l) => l[0] !== 'info'));
    noOutboxWrites(db);
  });
}
for (const data of [{ cc: null, bcc: null, tags: {} }, { cc: [], bcc: [], broadcast_id: null, template_id: null }]) {
  test('documented empty optional metadata is accepted', async () => {
    const event = fixture(); Object.assign(event.data, data);
    const result = await invoke(event);
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.db.receipt().status, 'ignored');
    noOutboxWrites(result.db);
  });
}
for (const type of ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed', 'email.delivery_delayed']) {
  test(`negative/auth attention event is never silently ignored: ${type}`, async () => {
    const { response, parsed, db } = await invoke(fixture(type));
    assert.equal(response.statusCode, 503);
    assert.equal(parsed.code, 'OUTBOX_CORRELATION_PENDING');
    assert.equal(db.receipt().last_error, 'OUTBOX_CORRELATION_PENDING');
    noOutboxWrites(db);
  });
}
for (const [type, initial, expected] of [
  ['email.sent', 'sending', 'accepted'], ['email.delivered', 'accepted', 'delivered'],
  ['email.bounced', 'accepted', 'hard_bounced'], ['email.complained', 'delivered', 'complained'],
  ['email.failed', 'accepted', 'terminal_failed'], ['email.suppressed', 'accepted', 'suppressed'],
  ['email.delivery_delayed', 'accepted', 'accepted'],
]) {
  test(`matched application row wins, even with auth-shaped metadata: ${type}`, async () => {
    const rows = [{ id: 'outbox-fixture', status: initial, provider_message_ref: emailId }];
    const { response, db, logs } = await invoke(fixture(type), { rows });
    assert.equal(response.statusCode, 200);
    assert.equal(db.rows[0].status, expected);
    assert.equal(db.receipt().status, 'processed');
    assert.equal(db.calls.filter((c) => c.path === '/rest/v1/notification_outbox' && c.method === 'PATCH').length, 1);
    assert.ok(logs.every((l) => l[0] !== 'info'));
  });
}
for (const status of ['cancelled', 'hard_bounced', 'complained', 'suppressed', 'terminal_failed', 'delivered']) {
  test(`late sent event cannot regress application status ${status}`, async () => {
    const rows = [{ id: 'outbox-fixture', status, provider_message_ref: emailId }];
    const { response, db } = await invoke(fixture('email.sent'), { rows });
    assert.equal(response.statusCode, 200);
    assert.equal(db.rows[0].status, status);
    assert.equal(db.receipt().status, 'processed');
    noOutboxWrites(db);
  });
}
for (const rows of [null, {}, '', false, [null], [[]], [{}],
  [{ id: '', status: 'accepted', provider_message_ref: emailId }],
  [{ id: 'outbox-fixture', status: '', provider_message_ref: emailId }],
  [{ id: 'outbox-fixture', status: 'accepted', provider_message_ref: 'other-id' }],
]) {
  test(`invalid outbox evidence cannot be converted into absence: ${JSON.stringify(rows)}`, async () => {
    const { response, parsed, db } = await invoke(fixture(), { rows });
    assert.equal(response.statusCode, 500);
    assert.equal(parsed.code, 'INVALID_OUTBOX_RESPONSE');
    assert.equal(db.receipt().status, 'failed');
    noOutboxWrites(db);
  });
}
test('two matching rows fail closed', async () => {
  const rows = [1, 2].map((n) => ({ id: `outbox-${n}`, status: 'accepted', provider_message_ref: emailId }));
  const result = await invoke(fixture(), { rows });
  assert.equal(result.response.statusCode, 500);
  assert.equal(result.parsed.code, 'AMBIGUOUS_OUTBOX_MATCH');
  noOutboxWrites(result.db);
});
for (const opts of [{ readStatus: 503 }, { invalidJson: true }, { failFinish: true }]) {
  test(`failed evidence or receipt persistence is not acknowledged: ${JSON.stringify(opts)}`, async () => {
    const result = await invoke(fixture(), opts);
    assert.equal(result.response.statusCode, 500);
    assert.equal(result.db.receipt().status, 'failed');
    assert.ok(result.logs.every((l) => l[0] !== 'info'));
    noOutboxWrites(result.db);
  });
}
for (const [opts, code, status] of [
  [{ badSignature: true }, 'INVALID_WEBHOOK_SIGNATURE', 400],
  [{ noHeaders: true }, 'MISSING_WEBHOOK_HEADERS', 400],
  [{ offset: -301 }, 'STALE_WEBHOOK', 400],
  [{ offset: 301 }, 'FUTURE_WEBHOOK', 400],
  [{ payload: '{bad' }, 'INVALID_WEBHOOK_PAYLOAD', 400],
  [{ payload: 'x'.repeat(256 * 1024 + 1) }, 'WEBHOOK_TOO_LARGE', 413],
  [{ method: 'GET' }, 'METHOD_NOT_ALLOWED', 405],
  [{ environment: { RESEND_WEBHOOK_ENABLED: 'false' } }, 'NOT_FOUND', 404],
]) {
  test(`rejection before receipt/database access: ${code}`, async () => {
    const result = await invoke(fixture(), opts);
    assert.equal(result.response.statusCode, status);
    assert.equal(result.parsed.code, code);
    assert.equal(result.db.calls.length, 0);
  });
}
test('identical duplicate of ignored auth receipt is acknowledged without another lookup or finish write', async () => {
  const db = database();
  const first = await invoke(fixture(), { db });
  assert.equal(first.response.statusCode, 200);
  const previousCalls = db.calls.length;
  const second = await invoke(fixture(), { db });
  assert.deepEqual(second.parsed, { ok: true, duplicate: true });
  assert.equal(db.calls.length - previousCalls, 2);
  assert.ok(db.calls.slice(previousCalls).every((c) => c.path === '/rest/v1/webhook_receipts'));
  assert.equal(db.receipt().attempt_count, 1);
});
test('same receipt ID with changed payload still conflicts', async () => {
  const db = database(); await invoke(fixture(), { db });
  const changed = fixture(); changed.data.subject = 'Purchase receipt';
  const result = await invoke(changed, { db });
  assert.equal(result.response.statusCode, 409);
  assert.equal(result.parsed.code, 'WEBHOOK_RECEIPT_CONFLICT');
  noOutboxWrites(db);
});
test('prior failed auth receipt can finish only when the same signed event arrives again', async () => {
  const event = fixture();
  const prior = { id: 'receipt-offline', provider: 'resend', provider_event_id: 'msg_offline_auth_success',
    event_type: event.type, payload_sha256: createHash('sha256').update(JSON.stringify(event)).digest('hex'),
    status: 'failed', attempt_count: 3, last_error: 'OUTBOX_CORRELATION_PENDING' };
  const result = await invoke(event, { prior });
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.parsed.duplicate, true);
  assert.equal(result.db.receipt().attempt_count, 4);
  assert.equal(result.db.receipt().status, 'ignored');
  noOutboxWrites(result.db);
});
test('unmatched application mail remains failed, then processes after correlation is persisted', async () => {
  const event = fixture(); event.data.subject = 'Your Library Pass access is ready';
  const db = database();
  const first = await invoke(event, { db });
  assert.equal(first.response.statusCode, 503);
  db.rows.push({ id: 'outbox-fixture', status: 'accepted', provider_message_ref: emailId });
  const second = await invoke(event, { db });
  assert.equal(second.response.statusCode, 200);
  assert.equal(db.rows[0].status, 'delivered');
  assert.equal(db.receipt().status, 'processed');
});
