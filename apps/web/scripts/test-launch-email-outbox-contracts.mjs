import assert from 'node:assert/strict';
import { buildNotificationOutboxRecord } from '../src/lib/email-readiness-contracts.js';

const occurredAt = '2026-08-20T12:00:00.000Z';
const recipientEmail = 'reader@example.com';
const consent = Object.freeze({
  id: '784475ae-faf8-4ed3-95f7-e29d5cba3283',
  status: 'granted',
  purpose: 'book_availability',
  emailNormalized: recipientEmail,
});

const requiredTemplates = Object.freeze({
  purchase_pending: 'transactional_operational',
  purchase_access_ready: 'transactional',
  purchase_failed: 'transactional_operational',
  refund_approved: 'transactional',
  dispute_warning: 'transactional_operational',
  chargeback_revoked: 'transactional',
  dispute_reversal_restored: 'transactional',
  privacy_export_acknowledgement: 'transactional_operational',
  account_deletion_requested: 'transactional_operational',
  account_deletion_completed: 'transactional_operational',
  support_case_received: 'operational',
});

function build({ templateId, classification, consentRecord = null, payload = {} }) {
  return buildNotificationOutboxRecord({
    eventId: `${templateId}.event:object_123:v1`,
    messageId: templateId,
    classification,
    businessObjectType: 'library_pass_event',
    businessObjectId: 'object_123',
    stateVersion: 1,
    recipientEmail,
    templateId,
    templateVersion: '2026-08-20.v1',
    provider: 'resend',
    ...(consentRecord
      ? { consent: consentRecord, consentCheckedAt: occurredAt }
      : {}),
    payload,
    nextAttemptAt: occurredAt,
  });
}

for (const [templateId, classification] of Object.entries(requiredTemplates)) {
  const row = build({ templateId, classification });
  assert.equal(row.template_id, templateId);
  assert.equal(row.classification, classification);
  assert.equal(row.consent_required, false);
  assert.equal(row.consent_record_id, null);
  assert.equal(row.consent_purpose, null);
  assert.equal(row.consent_checked_at, null);
  assert.deepEqual(row.payload, {});
  assert.equal(row.status, 'queued');
  assert.equal(row.attempt_count, 0);

  assert.throws(
    () => build({ templateId, classification, consentRecord: consent }),
    /Consent is not approved/,
  );
  assert.throws(
    () => build({ templateId, classification, payload: { token: 'not-allowed' } }),
    /not allowed/,
  );
}

for (const [templateId, classification] of [
  ['waitlist_confirmation', 'operational'],
  ['book_availability', 'marketing'],
]) {
  const row = build({ templateId, classification, consentRecord: consent });
  assert.equal(row.consent_required, true);
  assert.equal(row.consent_record_id, consent.id);
  assert.equal(row.consent_purpose, 'book_availability');
  assert.equal(row.consent_checked_at, occurredAt);
  assert.deepEqual(row.payload, {});

  assert.throws(
    () => build({ templateId, classification }),
    /consent must be a plain object/,
  );
  assert.throws(
    () => build({
      templateId,
      classification,
      consentRecord: { ...consent, purpose: 'market_updates' },
    }),
    /consent purpose is not approved/i,
  );
  assert.throws(
    () => build({ templateId, classification, consentRecord: consent, payload: { extra: true } }),
    /not allowed/,
  );
}

const marketUpdate = buildNotificationOutboxRecord({
  eventId: 'market_update.event:daily_2026_08_20:v1',
  messageId: 'market_update',
  classification: 'marketing',
  businessObjectType: 'daily_edition',
  businessObjectId: 'daily_2026_08_20',
  stateVersion: 1,
  recipientEmail,
  templateId: 'market_update',
  templateVersion: '2026-08-20.v1',
  provider: 'resend',
  consent,
  consentCheckedAt: occurredAt,
  payload: { editionId: 'daily_2026_08_20' },
  nextAttemptAt: occurredAt,
});
assert.equal(marketUpdate.consent_required, true);
assert.equal(marketUpdate.payload.editionId, 'daily_2026_08_20');

assert.throws(
  () => build({ templateId: 'auth_sign_in', classification: 'transactional_security' }),
  /approved payload contract/,
);
assert.throws(
  () => build({ templateId: 'purchase_access_ready', classification: 'marketing' }),
  /classification is not approved/,
);

console.log('Launch email outbox contract tests passed.');
