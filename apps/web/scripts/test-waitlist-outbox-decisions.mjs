import assert from 'node:assert/strict';
import { resolveWaitlistOutboxDecision } from '../src/lib/waitlist-readiness.js';

const nowMs = Date.parse('2026-08-20T12:00:00.000Z');
const freshCreatedAt = '2026-08-20T11:00:00.000Z';
const expiredCreatedAt = '2026-08-19T11:00:00.000Z';

function decision(overrides = {}) {
  return resolveWaitlistOutboxDecision({
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: '2026-08-20T12:00:00.000Z',
    provider_message_ref: null,
    accepted_at: null,
    created_at: freshCreatedAt,
    ...overrides,
  }, nowMs);
}

assert.deepEqual(decision(), { action: 'send', reason: 'queued' });
assert.deepEqual(
  decision({ attempt_count: 1 }),
  { action: 'reconcile', reason: 'queued-after-attempt' },
);
assert.deepEqual(
  decision({
    status: 'accepted',
    provider_message_ref: 'resend-message-id',
    accepted_at: '2026-08-20T11:01:00.000Z',
  }),
  { action: 'complete', reason: 'accepted' },
);
assert.deepEqual(
  decision({ status: 'accepted' }),
  { action: 'reconcile', reason: 'incomplete-provider-state' },
);
assert.deepEqual(
  decision({ status: 'sending', attempt_count: 1 }),
  { action: 'send', reason: 'idempotent-sending-retry' },
);
assert.deepEqual(
  decision({ status: 'sending', attempt_count: 1, created_at: expiredCreatedAt }),
  { action: 'reconcile', reason: 'expired-sending-window' },
);
assert.deepEqual(
  decision({
    status: 'retry_scheduled',
    attempt_count: 1,
    next_attempt_at: '2026-08-20T12:05:00.000Z',
  }),
  { action: 'wait', reason: 'retry-not-due' },
);
assert.deepEqual(
  decision({ status: 'retry_scheduled', attempt_count: 1 }),
  { action: 'send', reason: 'idempotent-scheduled-retry' },
);
assert.deepEqual(
  decision({
    status: 'retry_scheduled',
    attempt_count: 1,
    created_at: expiredCreatedAt,
  }),
  { action: 'reconcile', reason: 'expired-retry-window' },
);
assert.deepEqual(
  decision({
    status: 'retry_scheduled',
    attempt_count: 1,
    provider_message_ref: 'resend-message-id',
    accepted_at: '2026-08-20T11:01:00.000Z',
  }),
  { action: 'complete', reason: 'accepted-provider-state' },
);

for (const status of [
  'soft_bounced',
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]) {
  assert.deepEqual(decision({ status }), { action: 'blocked', reason: status });
}

assert.deepEqual(
  decision({ status: 'unknown' }),
  { action: 'reconcile', reason: 'unknown-status' },
);
assert.deepEqual(
  resolveWaitlistOutboxDecision(null, nowMs),
  { action: 'reconcile', reason: 'missing-outbox' },
);

console.log('Waitlist outbox decision tests passed.');
