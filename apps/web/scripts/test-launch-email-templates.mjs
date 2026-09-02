import assert from 'node:assert/strict';
import {
  LAUNCH_EMAIL_TEMPLATE_SPECS,
  LAUNCH_EMAIL_TEMPLATE_VERSION,
  getLaunchEmailTemplateSpec,
  renderLaunchEmail,
  validateLaunchEmailTemplateRegistry,
} from '../src/lib/launch-email-templates.js';
import {
  EMAIL_MESSAGE_POLICIES,
  LAUNCH_CRITICAL_MESSAGE_IDS,
} from '../src/lib/email-operations-policy.js';

const unsubscribeUrl = 'https://www.usd-impact.com/unsubscribe?token=test-token-123';

assert.equal(LAUNCH_EMAIL_TEMPLATE_VERSION, '2026-09-02.v2');
assert.equal(validateLaunchEmailTemplateRegistry(), true);
assert.deepEqual(
  Object.keys(LAUNCH_EMAIL_TEMPLATE_SPECS).sort(),
  [...LAUNCH_CRITICAL_MESSAGE_IDS].sort(),
);

for (const messageId of LAUNCH_CRITICAL_MESSAGE_IDS) {
  const spec = getLaunchEmailTemplateSpec(messageId);
  assert.equal(spec.classification, EMAIL_MESSAGE_POLICIES[messageId].classification);
  if (spec.providerManaged) continue;

  const input = {
    messageId,
    ...(spec.referenceLabel ? { reference: `ref_${messageId}` } : {}),
    ...(spec.requiresUnsubscribe ? { unsubscribeUrl } : {}),
  };
  const first = renderLaunchEmail(input);
  const second = renderLaunchEmail(input);
  assert.deepEqual(first, second, `${messageId} must render deterministically`);
  assert.equal(first.classification, spec.classification);
  assert.equal(first.templateVersion, LAUNCH_EMAIL_TEMPLATE_VERSION);
  assert.ok(first.subject.length > 5);
  assert.match(first.text, /USD Impact/);
  assert.match(first.text, /support@usd-impact\.com/);
  assert.match(first.html, /<meta name="viewport"/);
  assert.match(first.html, /support@usd-impact\.com/);
  assert.doesNotMatch(first.html, /<(script|form|input|iframe|video)\b/i);
  assert.doesNotMatch(`${first.subject}\n${first.text}\n${first.html}`, /\b(Paddle|FastSpring)\b/i);
  assert.doesNotMatch(`${first.subject}\n${first.text}`, /guaranteed (?:profit|return|outcome)|risk[- ]free|will pump/i);
  assert.ok(Buffer.byteLength(first.html, 'utf8') < 100_000);

  if (spec.requiresUnsubscribe) {
    assert.equal(first.headers['List-Unsubscribe'], `<${unsubscribeUrl}>`);
    assert.equal(first.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.match(first.text, /Unsubscribe/i);
  } else {
    assert.equal(first.headers, undefined);
    assert.doesNotMatch(first.text, /unsubscribe from book availability/i);
  }
}

assert.throws(
  () => renderLaunchEmail({ messageId: 'auth_sign_in' }),
  /provider-managed/,
);
assert.throws(
  () => renderLaunchEmail({ messageId: 'purchase_access_ready', reference: '<script>' }),
  /bounded opaque identifier/,
);
assert.throws(
  () => renderLaunchEmail({
    messageId: 'book_availability',
    reference: 'availability_1',
    unsubscribeUrl: 'https://evil.example/unsubscribe?token=x&next=y',
  }),
  /only a non-empty token/,
);
assert.throws(
  () => renderLaunchEmail({
    messageId: 'waitlist_confirmation',
    unsubscribeUrl: 'http://www.usd-impact.com/unsubscribe?token=x',
  }),
  /HTTPS/,
);
assert.throws(() => getLaunchEmailTemplateSpec('unknown'), /Unknown launch email template/);

const pending = renderLaunchEmail({ messageId: 'purchase_pending', reference: 'purchase_123' });
assert.match(pending.text, /has not granted Library Pass access/i);
assert.match(pending.text, /verified completed-payment event/i);

const ready = renderLaunchEmail({ messageId: 'purchase_access_ready', reference: 'purchase_123' });
assert.match(ready.text, /Library Pass is active/i);
assert.match(ready.text, /Start with the Guided Interactive Edition/i);
assert.match(ready.text, /audiobook/i);
assert.match(ready.text, /Video Library/i);
assert.match(ready.text, /only learning progress already saved/i);
assert.match(ready.text, /Open your learning path/i);

const refund = renderLaunchEmail({ messageId: 'refund_approved', reference: 'refund_123' });
assert.match(refund.text, /entitlement.*removed/is);

const privacy = renderLaunchEmail({
  messageId: 'privacy_export_acknowledgement',
  reference: 'privacy_123',
});
assert.match(privacy.text, /No export payload/i);
assert.doesNotMatch(privacy.text, /download your export at/i);

const deletion = renderLaunchEmail({
  messageId: 'account_deletion_requested',
  reference: 'delete_123',
});
assert.match(deletion.text, /did not request/i);

const availability = renderLaunchEmail({
  messageId: 'book_availability',
  reference: 'availability_123',
  unsubscribeUrl,
});
assert.match(availability.text, /current price, launch conditions/i);
assert.doesNotMatch(availability.text, /USD 39|USD 49|first 100/i);

console.log('Launch email template contract tests passed.');
