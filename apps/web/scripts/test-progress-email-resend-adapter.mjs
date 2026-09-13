import assert from 'node:assert/strict';
import {
  ProgressEmailResendConfigurationError,
  ProgressEmailResendRequestError,
  createProgressEmailResendAdapter,
} from '../src/lib/progress-email-resend-adapter.js';

const recipient = 'reader@example.com';
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  PROGRESS_EMAIL_DELIVERY_ENABLED: 'true',
  PROGRESS_EMAIL_QA_RECIPIENTS: `qa@example.com, ${recipient}`,
  RESEND_API_KEY: `re_${'a'.repeat(32)}`,
  RESEND_FROM_EMAIL: 'USD Impact <updates@updates.usd-impact.com>',
  RESEND_REPLY_TO: 'support@usd-impact.com',
});
const message = Object.freeze({
  provider: 'resend',
  to: [recipient],
  idempotencyKey: `progress-email/${'b'.repeat(64)}`,
  subject: 'USD Impact — your next learning step',
  text: 'Educational Learning Progress email.',
  html: '<!DOCTYPE html><html><body><p>Educational Learning Progress email.</p></body></html>',
  headers: {
    'List-Unsubscribe': '<https://preview.example/email/unsubscribe?token=mu1.test>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload == null ? '' : JSON.stringify(payload);
    },
  };
}

{
  let captured = null;
  const adapter = createProgressEmailResendAdapter({
    environment,
    now: () => new Date('2026-09-12T00:30:00.000Z'),
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ id: 'progress-provider-message-1' });
    },
  });
  const result = await adapter.send(message);
  assert.equal(result.state, 'accepted');
  assert.equal(result.messageRef, 'progress-provider-message-1');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.options.headers['Idempotency-Key'], message.idempotencyKey);
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.to, [recipient]);
  assert.equal(body.from, environment.RESEND_FROM_EMAIL);
  assert.equal(body.reply_to, environment.RESEND_REPLY_TO);
  assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(Object.hasOwn(body, 'cc'), false);
  assert.equal(Object.hasOwn(body, 'bcc'), false);
}

assert.throws(
  () => createProgressEmailResendAdapter({
    environment: { ...environment, VERCEL_ENV: 'production' },
  }),
  (error) => error instanceof ProgressEmailResendConfigurationError
    && error.code === 'PRODUCTION_PROGRESS_EMAIL_DELIVERY_BLOCKED',
);

assert.throws(
  () => createProgressEmailResendAdapter({
    environment: { ...environment, PROGRESS_EMAIL_DELIVERY_ENABLED: 'false' },
  }),
  (error) => error instanceof ProgressEmailResendConfigurationError
    && error.code === 'PROGRESS_EMAIL_DELIVERY_DISABLED',
);

{
  const adapter = createProgressEmailResendAdapter({
    environment: { ...environment, PROGRESS_EMAIL_QA_RECIPIENTS: 'qa@example.com' },
    fetchImpl: async () => assert.fail('Provider must not be called outside QA allowlist.'),
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof ProgressEmailResendRequestError
      && error.code === 'QA_RECIPIENT_NOT_ALLOWED',
  );
}

{
  const adapter = createProgressEmailResendAdapter({ environment });
  await assert.rejects(
    () => adapter.send({ ...message, headers: {} }),
    (error) => error instanceof ProgressEmailResendRequestError
      && error.code === 'RESEND_UNSUBSCRIBE_HEADERS_REQUIRED',
  );
}

{
  const adapter = createProgressEmailResendAdapter({
    environment,
    fetchImpl: async () => response({ name: 'rate_limit_exceeded' }, 429),
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof ProgressEmailResendRequestError
      && error.code === 'RESEND_RATE_LIMITED'
      && error.retryable === true,
  );
}

{
  const adapter = createProgressEmailResendAdapter({
    environment,
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof ProgressEmailResendRequestError
      && error.code === 'RESEND_REQUEST_AMBIGUOUS'
      && error.retryable === true,
  );
}

console.log('Learning Progress guarded Resend adapter contract passed.');
