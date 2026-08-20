import assert from 'node:assert/strict';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  evaluateLaunchEmailEligibility,
  renderLaunchEmailDispatch,
  resolveLaunchEmailDispatchDecision,
  validateLaunchEmailDispatchContract,
} from '../src/lib/launch-email-dispatch.js';

const occurredAt = '2026-08-20T17:00:00.000Z';
const recipientEmail = 'reader@example.com';
const consent = Object.freeze({
  id: '784475ae-faf8-4ed3-95f7-e29d5cba3283',
  status: 'granted',
  purpose: 'book_availability',
  emailNormalized: recipientEmail,
});

function persistedOutbox(intent, overrides = {}) {
  return {
    id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
    ...intent.outboxRecord,
    status: 'queued',
    attempt_count: 0,
    provider_message_ref: null,
    error_code: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    created_at: occurredAt,
    updated_at: occurredAt,
    ...overrides,
  };
}

assert.equal(validateLaunchEmailDispatchContract(), true);

const accessIntent = createLaunchEmailDispatchIntent({
  messageId: 'purchase_access_ready',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_123',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
});
assert.equal(accessIntent.outboxRecord.classification, 'transactional');
assert.equal(accessIntent.outboxRecord.consent_required, false);
assert.deepEqual(accessIntent.outboxRecord.payload, {});
assert.match(accessIntent.customerReference, /^ui-[0-9a-f]{16}$/);
assert.match(accessIntent.providerIdempotencyKey, /^launch-email\/[0-9a-f]{64}$/);

const duplicateIntent = createLaunchEmailDispatchIntent({
  messageId: 'purchase_access_ready',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_123',
  stateVersion: 1,
  recipientEmail: 'Reader@Example.com',
  occurredAt,
});
assert.equal(duplicateIntent.outboxRecord.idempotency_key, accessIntent.outboxRecord.idempotency_key);
assert.equal(duplicateIntent.providerIdempotencyKey, accessIntent.providerIdempotencyKey);

const accessMessage = renderLaunchEmailDispatch({ intent: accessIntent });
assert.equal(accessMessage.to[0], recipientEmail);
assert.match(accessMessage.text, new RegExp(accessIntent.customerReference));
assert.doesNotMatch(accessMessage.text, /purchase_123/);

assert.throws(
  () => createLaunchEmailDispatchIntent({
    messageId: 'auth_sign_in',
    businessObjectType: 'account_session',
    businessObjectId: 'session_123',
    stateVersion: 1,
    recipientEmail,
    occurredAt,
  }),
  (error) => error instanceof LaunchEmailDispatchError && error.code === 'PROVIDER_MANAGED_MESSAGE',
);
assert.throws(
  () => createLaunchEmailDispatchIntent({
    messageId: 'purchase_pending',
    businessObjectType: 'purchase',
    businessObjectId: 'purchase_123',
    stateVersion: 1,
    recipientEmail,
    occurredAt,
  }),
  (error) => error instanceof LaunchEmailDispatchError
    && error.code === 'PROVIDER_RESPONSIBILITY_UNRESOLVED',
);
assert.equal(createLaunchEmailDispatchIntent({
  messageId: 'purchase_pending',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_123',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
  providerResponsibilityApproved: true,
}).outboxRecord.classification, 'transactional_operational');

assert.throws(
  () => createLaunchEmailDispatchIntent({
    messageId: 'book_availability',
    businessObjectType: 'availability_notice',
    businessObjectId: 'launch_window_1',
    stateVersion: 1,
    recipientEmail,
    occurredAt,
  }),
  /consent must be a plain object/i,
);
const availabilityIntent = createLaunchEmailDispatchIntent({
  messageId: 'book_availability',
  businessObjectType: 'availability_notice',
  businessObjectId: 'launch_window_1',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
  consent,
  consentCheckedAt: occurredAt,
});
assert.throws(() => renderLaunchEmailDispatch({ intent: availabilityIntent }), /unsubscribeUrl/i);
assert.equal(renderLaunchEmailDispatch({
  intent: availabilityIntent,
  unsubscribeUrl: 'https://www.usd-impact.com/unsubscribe?token=test-token',
}).headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

assert.deepEqual(evaluateLaunchEmailEligibility({
  messageId: 'book_availability',
  consentState: 'withdrawn',
}), { action: 'cancelled_consent', reason: 'withdrawn' });
assert.deepEqual(evaluateLaunchEmailEligibility({
  messageId: 'purchase_access_ready',
  consentState: 'withdrawn',
  suppressionState: 'purpose_withdrawal',
}), { action: 'eligible' });
assert.deepEqual(evaluateLaunchEmailEligibility({
  messageId: 'purchase_access_ready',
  suppressionState: 'hard_bounce',
}), { action: 'manual_escalation', reason: 'hard_bounce' });
assert.deepEqual(evaluateLaunchEmailEligibility({
  messageId: 'book_availability',
  consentState: 'granted',
  suppressionState: 'provider_suppressed',
}), { action: 'terminal_suppressed', reason: 'provider_suppresssed' });

assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: queued,
  nowMs: Date.parse(occurredAt),
}), {
  action: 'send',
  reason: 'attempt-due',
  providerIdempotencyKey: accessIntent.providerIdempotencyKey,
});
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: { ...queued, status: 'accepted', provider_message_ref: 'email_accepted_123' },
}), { action: 'await_callback', reason: 'accepted' });
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: { ...queued, status: 'delivered' },
}), { action: 'complete', reason: 'delivered' });
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: {
    ...queued,
    status: 'retry_scheduled',
    attempt_count: 1,
    next_attempt_at: '2026-08-20T17:05:00.000Z',
  },
  nowMs: Date.parse(occurredAt),
}), { action: 'wait', reason: 'retry-not-due' });
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: { ...queued, status: 'terminal_failed', attempt_count: 5 },
}), { action: 'manual_escalation', reason: 'terminal_failed' });
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: { ...queued, status: 'sending', attempt_count: 1 },
  nowMs: Date.parse(occurredAt) + 60_000,
}), {
  action: 'send',
  reason: 'provider-idempotent-retry',
  providerIdempotencyKey: accessIntent.providerIdempotencyKey,
});
assert.deepEqual(resolveLaunchEmailDispatchDecision({
  intent: accessIntent,
  outbox: { ...queued, status: 'sending', attempt_count: 1 },
  nowMs: Date.parse(occurredAt) + 24 * 60 * 60 * 1000,
}), { action: 'manual_reconciliation', reason: 'provider-window-expired' });
assert.throws(
  () => resolveLaunchEmailDispatchDecision({
    intent: accessIntent,
    outbox: { ...queued, business_object_id: 'different' },
  }),
  (error) => error instanceof LaunchEmailDispatchError && error.code === 'OUTBOX_IDENTITY_CONFLICT',
);

console.log('Launch email dispatch contract tests passed.');
