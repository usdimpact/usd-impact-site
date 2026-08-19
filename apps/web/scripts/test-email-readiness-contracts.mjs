import assert from 'node:assert/strict';
import {
  buildNotificationOutboxRecord,
  createConsentEventIdempotencyKey,
  createConsentEventRecord,
  createNotificationIdempotencyKey,
  normalizeEmail,
} from '../src/lib/email-readiness-contracts.js';

const consentId = '784475ae-faf8-4ed3-95f7-e29d5cba3283';
const userId = '66143544-77e5-431f-90dd-2c6e9c488c1a';
const occurredAt = '2026-08-19T18:00:00.000Z';

assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
assert.throws(() => normalizeEmail('not-an-email'), /valid address/);

const consentIdentity = {
  sourceEventId: 'waitlist-submit-123',
  email: 'Reader@Example.com',
  purpose: 'product_updates',
  status: 'granted',
  consentTextVersion: 'waitlist-v2',
  privacyNoticeVersion: 'privacy-2026-08-19',
};
const consentKey = createConsentEventIdempotencyKey(consentIdentity);
assert.match(consentKey, /^consent:v1:[0-9a-f]{64}$/);
assert.equal(
  consentKey,
  createConsentEventIdempotencyKey({ ...consentIdentity, email: ' reader@example.com ' }),
);

const consent = createConsentEventRecord({
  ...consentIdentity,
  userId,
  source: 'waitlist_form',
  capturedAt: occurredAt,
  evidenceContext: { consentCheckbox: true, request: { country: 'US', locale: 'en' } },
});
assert.equal(consent.idempotency_key, consentKey);
assert.equal(consent.email_normalized, 'reader@example.com');
assert.match(consent.evidence_checksum, /^[0-9a-f]{64}$/);
assert.equal(consent.evidence.status, 'granted');
assert.equal(consent.evidence.captured_at, occurredAt);
assert.equal(Object.isFrozen(consent.evidence.context.request), true);
assert.throws(() => createConsentEventRecord({
  ...consentIdentity,
  source: 'waitlist_form',
  capturedAt: occurredAt,
  relatedGrantId: consentId,
}), /Withdrawal events require/);
assert.throws(() => createConsentEventRecord({
  ...consentIdentity,
  status: 'withdrawn',
  source: 'unsubscribe_link',
  capturedAt: occurredAt,
}), /Withdrawal events require/);
assert.throws(() => createConsentEventRecord({
  ...consentIdentity,
  source: 'waitlist_form',
  capturedAt: occurredAt,
  evidenceContext: { ipAddress: '192.0.2.1' },
}), /not allowed/);

const withdrawal = createConsentEventRecord({
  ...consentIdentity,
  sourceEventId: 'unsubscribe-456',
  status: 'withdrawn',
  source: 'waitlist_form',
  capturedAt: occurredAt,
  withdrawnAt: '2026-08-19T19:00:00.000Z',
  withdrawalSource: 'unsubscribe_link',
  relatedGrantId: consentId,
});
assert.equal(withdrawal.status, 'withdrawn');
assert.equal(withdrawal.related_grant_id, consentId);
assert.equal(withdrawal.evidence.withdrawal_source, 'unsubscribe_link');
assert.notEqual(withdrawal.idempotency_key, consent.idempotency_key);

const identity = {
  messageId: 'purchase_receipt',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_123',
  stateVersion: 1,
  recipientEmail: 'Reader@Example.com',
};
const notificationKey = createNotificationIdempotencyKey(identity);
assert.match(notificationKey, /^notification:v1:[0-9a-f]{64}$/);
assert.equal(
  notificationKey,
  createNotificationIdempotencyKey({ ...identity, recipientEmail: ' reader@example.COM ' }),
);
assert.notEqual(notificationKey, createNotificationIdempotencyKey({ ...identity, stateVersion: 2 }));
assert.notEqual(notificationKey, createNotificationIdempotencyKey({ ...identity, messageId: 'purchase_refund' }));
assert.notEqual(notificationKey, createNotificationIdempotencyKey({ ...identity, recipientEmail: 'other@example.com' }));

const outbox = buildNotificationOutboxRecord({
  eventId: 'purchase.completed:purchase_123:v1',
  ...identity,
  classification: 'transactional',
  templateId: 'purchase_receipt',
  templateVersion: '2026-08-19',
  provider: 'resend',
  payload: { amountCents: 3900, currency: 'USD', customer: { displayName: 'Reader' } },
  nextAttemptAt: occurredAt,
});
assert.equal(outbox.idempotency_key, notificationKey);
assert.equal(outbox.status, 'queued');
assert.equal(outbox.attempt_count, 0);
assert.equal(outbox.recipient_email_normalized, 'reader@example.com');
assert.equal(Object.isFrozen(outbox.payload.customer), true);

assert.throws(() => buildNotificationOutboxRecord({
  ...outbox,
  ...identity,
  eventId: 'marketing.send:campaign_123:v1',
  classification: 'marketing',
  templateId: 'market_update',
  templateVersion: '2026-08-19',
  provider: 'resend',
  payload: {},
  nextAttemptAt: occurredAt,
}), /consent must be a plain object/);

const marketing = buildNotificationOutboxRecord({
  ...identity,
  eventId: 'marketing.send:campaign_123:v1',
  messageId: 'market_update',
  classification: 'marketing',
  businessObjectType: 'campaign',
  businessObjectId: 'campaign_123',
  templateId: 'market_update',
  templateVersion: '2026-08-19',
  provider: 'resend',
  consent: {
    id: consentId,
    status: 'granted',
    purpose: 'book_availability',
    emailNormalized: 'reader@example.com',
  },
  consentCheckedAt: occurredAt,
  payload: { editionId: 'daily_2026_08_19' },
  nextAttemptAt: occurredAt,
});
assert.equal(marketing.consent_record_id, consentId);
assert.equal(marketing.consent_purpose, 'book_availability');
assert.equal(marketing.consent_required, true);
assert.throws(() => buildNotificationOutboxRecord({
  ...identity,
  eventId: 'marketing.send:campaign_123:v1',
  messageId: 'market_update',
  classification: 'marketing',
  businessObjectType: 'campaign',
  businessObjectId: 'campaign_123',
  templateId: 'market_update',
  templateVersion: '2026-08-19',
  provider: 'resend',
  consent: {
    id: consentId,
    status: 'granted',
    purpose: 'book_availability',
    emailNormalized: 'other@example.com',
  },
  consentCheckedAt: occurredAt,
  payload: {},
  nextAttemptAt: occurredAt,
}), /consent recipient must match/i);

const waitlistConfirmation = buildNotificationOutboxRecord({
  ...identity,
  eventId: 'waitlist.consent_recorded:waitlist_123:v1',
  messageId: 'waitlist_confirmation',
  classification: 'operational',
  businessObjectType: 'waitlist_request',
  businessObjectId: 'waitlist_123',
  templateId: 'waitlist_confirmation',
  templateVersion: '2026-08-19',
  provider: 'resend',
  consent: {
    id: consentId,
    status: 'granted',
    purpose: 'book_availability',
    emailNormalized: 'reader@example.com',
  },
  consentCheckedAt: occurredAt,
  payload: {},
  nextAttemptAt: occurredAt,
});
assert.equal(waitlistConfirmation.classification, 'operational');
assert.equal(waitlistConfirmation.consent_required, true);

for (const payload of [
  { apiKey: 'secret' },
  { nested: { authorization: 'Bearer secret' } },
  { customer: { cardNumber: '4111111111111111' } },
  { learning: { privateLearningInput: 'private answer' } },
]) {
  assert.throws(() => buildNotificationOutboxRecord({
    ...identity,
    eventId: 'purchase.completed:purchase_123:v1',
    classification: 'transactional',
    templateId: 'purchase_receipt',
    templateVersion: '2026-08-19',
    provider: 'resend',
    payload,
    nextAttemptAt: occurredAt,
  }), /not allowed/);
}

console.log('Email readiness core contract tests passed.');
