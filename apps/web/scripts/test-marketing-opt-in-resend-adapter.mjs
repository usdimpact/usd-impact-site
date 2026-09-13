import assert from 'node:assert/strict';
import {
  MarketingOptInResendConfigurationError,
  MarketingOptInResendRequestError,
  createMarketingOptInResendAdapter,
} from '../src/lib/marketing-opt-in-resend-adapter.js';

const recipient = 'reader@example.com';
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_OPT_IN_DELIVERY_ENABLED: 'true',
  EMAIL_OPT_IN_QA_RECIPIENTS: `other@example.com, ${recipient}`,
  RESEND_API_KEY: `re_${'a'.repeat(32)}`,
  RESEND_FROM_EMAIL: 'USD Impact <updates@updates.usd-impact.com>',
  RESEND_REPLY_TO: 'support@usd-impact.com',
});
const message = Object.freeze({
  to: recipient,
  idempotencyKey: `marketing-opt-in/${'b'.repeat(64)}`,
  subject: 'Confirm your Weekly USD Impact email',
  text: 'Review and explicitly confirm your request.',
  html: '<!DOCTYPE html><html><body><p>Confirm</p></body></html>',
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
  const adapter = createMarketingOptInResendAdapter({
    environment,
    now: () => new Date('2026-09-11T21:00:00.000Z'),
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ id: 'provider-message-1' }, 200);
    },
  });
  const result = await adapter.send(message);
  assert.equal(result.state, 'accepted');
  assert.equal(result.messageRef, 'provider-message-1');
  assert.equal(result.occurredAt, '2026-09-11T21:00:00.000Z');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['Idempotency-Key'], message.idempotencyKey);
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.to, [recipient]);
  assert.equal(body.from, environment.RESEND_FROM_EMAIL);
  assert.equal(body.reply_to, environment.RESEND_REPLY_TO);
  assert.equal(body.subject, message.subject);
  assert.equal(Object.hasOwn(body, 'cc'), false);
  assert.equal(Object.hasOwn(body, 'bcc'), false);
}

assert.throws(
  () => createMarketingOptInResendAdapter({
    environment: { ...environment, VERCEL_ENV: 'production' },
  }),
  (error) => error instanceof MarketingOptInResendConfigurationError
    && error.code === 'PRODUCTION_OPT_IN_DELIVERY_BLOCKED',
);

assert.throws(
  () => createMarketingOptInResendAdapter({
    environment: { ...environment, EMAIL_OPT_IN_DELIVERY_ENABLED: 'false' },
  }),
  (error) => error instanceof MarketingOptInResendConfigurationError
    && error.code === 'OPT_IN_DELIVERY_DISABLED',
);

{
  const adapter = createMarketingOptInResendAdapter({
    environment: { ...environment, EMAIL_OPT_IN_QA_RECIPIENTS: 'qa@example.com' },
    fetchImpl: async () => assert.fail('Provider must not be called for a non-allowlisted recipient.'),
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof MarketingOptInResendRequestError
      && error.code === 'QA_RECIPIENT_NOT_ALLOWED'
      && error.retryable === false,
  );
}

{
  const adapter = createMarketingOptInResendAdapter({
    environment,
    fetchImpl: async () => response({ name: 'rate_limit_exceeded' }, 429),
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof MarketingOptInResendRequestError
      && error.code === 'RESEND_RATE_LIMITED'
      && error.retryable === true,
  );
}

{
  const adapter = createMarketingOptInResendAdapter({
    environment,
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });
  await assert.rejects(
    () => adapter.send(message),
    (error) => error instanceof MarketingOptInResendRequestError
      && error.code === 'RESEND_REQUEST_AMBIGUOUS'
      && error.retryable === true
      && error.providerState === 'accepted_ambiguous',
  );
}

{
  const adapter = createMarketingOptInResendAdapter({ environment });
  await assert.rejects(
    () => adapter.send({ ...message, idempotencyKey: 'invalid' }),
    (error) => error instanceof MarketingOptInResendRequestError
      && error.code === 'RESEND_IDEMPOTENCY_KEY_INVALID',
  );
}

console.log('Marketing opt-in Development Resend adapter contract passed.');
