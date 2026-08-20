import assert from 'node:assert/strict';
import {
  EMAIL_MESSAGE_POLICIES,
  EMAIL_OPERATIONS_POLICY_VERSION,
  EMAIL_OWNER_ROLES,
  EMAIL_RETENTION_POLICIES,
  EMAIL_RETRY_POLICIES,
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_SUPPRESSION_POLICY,
  LAUNCH_CRITICAL_MESSAGE_IDS,
  decideEmailDeliveryAction,
  getEmailMessagePolicy,
  getRetryDelaySeconds,
  validateEmailOperationsPolicy,
} from '../src/lib/email-operations-policy.js';

assert.equal(EMAIL_OPERATIONS_POLICY_VERSION, '2026-08-20.v1');
assert.equal(EMAIL_SUPPORT_ADDRESS, 'support@usd-impact.com');
assert.equal(validateEmailOperationsPolicy(), true);
assert.equal(Object.keys(EMAIL_MESSAGE_POLICIES).length, LAUNCH_CRITICAL_MESSAGE_IDS.length);
assert.equal(new Set(LAUNCH_CRITICAL_MESSAGE_IDS).size, LAUNCH_CRITICAL_MESSAGE_IDS.length);

for (const messageId of LAUNCH_CRITICAL_MESSAGE_IDS) {
  const policy = getEmailMessagePolicy(messageId);
  assert.equal(policy.requiredAtLaunch, true);
  assert.equal(policy.customerFacing, true);
  assert.ok(EMAIL_OWNER_ROLES[policy.owner]);
  assert.ok(EMAIL_RETRY_POLICIES[policy.retryPolicy]);
  assert.ok(EMAIL_RETENTION_POLICIES[policy.retentionPolicy]);
  if (policy.supportEscalation) assert.equal(policy.supportAddress, EMAIL_SUPPORT_ADDRESS);
}

assert.deepEqual(getEmailMessagePolicy('auth_sign_in'), {
  classification: 'transactional_security',
  owner: 'authentication',
  providerBoundary: 'supabase_auth',
  retryPolicy: 'security_short_lived',
  retentionPolicy: 'security_ephemeral',
  consentPurpose: null,
  consentRequired: false,
  unsubscribeRequired: false,
  supportEscalation: true,
  securePayloadForbidden: false,
  requiredAtLaunch: true,
  customerFacing: true,
  productId: 'read_the_dollar_first_library_pass',
  supportAddress: 'support@usd-impact.com',
});

const marketing = getEmailMessagePolicy('book_availability');
assert.equal(marketing.classification, 'marketing');
assert.equal(marketing.consentPurpose, 'book_availability');
assert.equal(marketing.consentRequired, true);
assert.equal(marketing.unsubscribeRequired, true);
assert.equal(EMAIL_RETRY_POLICIES[marketing.retryPolicy].consentRecheckBeforeAttempt, true);

const waitlist = getEmailMessagePolicy('waitlist_confirmation');
assert.equal(waitlist.classification, 'operational');
assert.equal(waitlist.consentRequired, true);
assert.equal(waitlist.unsubscribeRequired, true);

for (const requiredMessage of [
  'auth_sign_in',
  'purchase_access_ready',
  'refund_approved',
  'privacy_export_acknowledgement',
  'account_deletion_completed',
]) {
  assert.notEqual(getEmailMessagePolicy(requiredMessage).classification, 'marketing');
}

assert.equal(EMAIL_SUPPRESSION_POLICY.global_unsubscribe.stopMarketing, true);
assert.equal(EMAIL_SUPPRESSION_POLICY.global_unsubscribe.stopTransactional, false);
assert.equal(EMAIL_SUPPRESSION_POLICY.purpose_withdrawal.stopOperational, false);
assert.equal(EMAIL_SUPPRESSION_POLICY.hard_bounce.requireManualEscalationForRequiredMail, true);
assert.equal(EMAIL_SUPPRESSION_POLICY.complaint.requireManualEscalationForRequiredMail, true);

assert.equal(getRetryDelaySeconds({ messageId: 'auth_sign_in', completedAttempts: 0 }), 0);
assert.equal(getRetryDelaySeconds({ messageId: 'auth_sign_in', completedAttempts: 1 }), 60);
assert.equal(getRetryDelaySeconds({ messageId: 'auth_sign_in', completedAttempts: 2 }), null);
assert.equal(getRetryDelaySeconds({ messageId: 'purchase_access_ready', completedAttempts: 1 }), 60);
assert.throws(
  () => getRetryDelaySeconds({ messageId: 'auth_sign_in', completedAttempts: -1 }),
  /non-negative integer/,
);
assert.throws(() => getEmailMessagePolicy('unknown'), /Unknown email message policy/);

assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'purchase_access_ready',
  completedAttempts: 1,
  elapsedSeconds: 120,
  providerState: 'failed',
}), { action: 'retry', delaySeconds: 60 });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'book_availability',
  completedAttempts: 0,
  elapsedSeconds: 0,
  providerState: 'failed',
  consentState: 'withdrawn',
}), { action: 'cancelled_consent' });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'book_availability',
  completedAttempts: 1,
  elapsedSeconds: 100,
  providerState: 'bounced',
  consentState: 'granted',
}), { action: 'terminal_suppressed', reason: 'bounced' });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'purchase_access_ready',
  completedAttempts: 1,
  elapsedSeconds: 100,
  providerState: 'bounced',
}), { action: 'manual_escalation', reason: 'bounced' });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'purchase_access_ready',
  completedAttempts: 1,
  elapsedSeconds: 100,
  providerState: 'accepted_ambiguous',
}), { action: 'manual_reconciliation', reason: 'provider_acceptance_ambiguous' });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'auth_sign_in',
  completedAttempts: 1,
  elapsedSeconds: 600,
  providerState: 'failed',
}), { action: 'manual_escalation', reason: 'stale' });
assert.deepEqual(decideEmailDeliveryAction({
  messageId: 'purchase_access_ready',
  completedAttempts: 0,
  elapsedSeconds: 0,
  providerState: 'delivered',
}), { action: 'delivered' });

for (const retention of Object.values(EMAIL_RETENTION_POLICIES)) {
  assert.ok(retention.payloadDays <= retention.deliveryMetadataDays);
  assert.ok(retention.deliveryMetadataDays <= 1095);
  assert.ok(retention.evidenceDays <= 1095);
}

console.log('Email operations policy tests passed.');