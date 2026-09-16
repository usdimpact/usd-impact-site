import assert from 'node:assert/strict';
import test from 'node:test';
import { isProviderManagedAuthSuccess } from '../src/lib/resend-auth-notification-boundary.js';

const EMAIL_ID = '00000000-0000-4000-8000-000000000001';
const AUTH_FROM = '"USD Impact" <no-reply@updates.usd-impact.com>';

function event(type = 'email.delivered', subject = 'Confirm your email address') {
  return {
    type,
    trackedDeliveryEvent: true,
    emailId: EMAIL_ID,
    raw: {
      type,
      data: {
        email_id: EMAIL_ID,
        from: AUTH_FROM,
        to: ['reader@example.com'],
        subject,
      },
    },
  };
}

for (const type of ['email.sent', 'email.delivered']) {
  test(`signup confirmation ${type} is recognized as provider-managed auth success`, () => {
    assert.equal(isProviderManagedAuthSuccess(event(type)), true);
  });
}

test('existing sign-in-link subject remains recognized', () => {
  assert.equal(isProviderManagedAuthSuccess(event('email.delivered', 'Your secure USD Impact sign-in link')), true);
});

for (const type of ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed', 'email.delivery_delayed']) {
  test(`signup confirmation ${type} remains fail-closed`, () => {
    assert.equal(isProviderManagedAuthSuccess(event(type)), false);
  });
}

const driftCases = [
  ['unknown subject', (e) => { e.raw.data.subject = 'Confirm your account'; }],
  ['subject suffix', (e) => { e.raw.data.subject += ' now'; }],
  ['sender drift', (e) => { e.raw.data.from = '"USD Impact" <no-reply@example.com>'; }],
  ['multiple recipients', (e) => { e.raw.data.to.push('second@example.com'); }],
  ['cc', (e) => { e.raw.data.cc = ['copy@example.com']; }],
  ['bcc', (e) => { e.raw.data.bcc = ['copy@example.com']; }],
  ['broadcast', (e) => { e.raw.data.broadcast_id = 'broadcast-fixture'; }],
  ['template', (e) => { e.raw.data.template_id = 'template-fixture'; }],
  ['tags', (e) => { e.raw.data.tags = { category: 'auth' }; }],
  ['email id mismatch', (e) => { e.raw.data.email_id = '00000000-0000-4000-8000-000000000002'; }],
];

for (const [name, mutate] of driftCases) {
  test(`signup confirmation rejects ${name}`, () => {
    const candidate = event();
    mutate(candidate);
    assert.equal(isProviderManagedAuthSuccess(candidate), false);
  });
}
