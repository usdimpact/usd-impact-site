import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleDailyLearningEmailRequest } from '../src/lib/daily-card-email-handler.js';

function mockResponse() {
  return {
    statusCode: null,
    headers: {},
    rawBody: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(body = '') {
      this.rawBody = body;
    },
  };
}

const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.deepEqual(
  vercelConfig.crons,
  [
    { path: '/api/daily-learning-dispatch', schedule: '10 6 * * *' },
    { path: '/api/daily-learning-dispatch', schedule: '40 6 * * *' },
  ],
);
assert.equal(
  vercelConfig.crons.some((entry) => entry.path === '/api/account-deletion-finalizer'),
  false,
);
assert.deepEqual(
  vercelConfig.rewrites.find((entry) => entry.source === '/api/daily-learning-dispatch'),
  { source: '/api/daily-learning-dispatch', destination: '/api/waitlist?action=daily-learning-dispatch' },
);
assert.deepEqual(
  vercelConfig.rewrites.find((entry) => entry.source === '/learn/email/unsubscribe'),
  { source: '/learn/email/unsubscribe', destination: '/api/waitlist?action=daily-learning-unsubscribe' },
);

const unauthorized = mockResponse();
await handleDailyLearningEmailRequest(
  { method: 'GET', url: '/api/waitlist?action=daily-learning-dispatch', headers: {} },
  unauthorized,
  'daily-learning-dispatch',
);
assert.equal(unauthorized.statusCode, 401);
assert.equal(JSON.parse(unauthorized.rawBody).code, 'SCHEDULER_AUTHORIZATION_REQUIRED');

const missingConsent = mockResponse();
await handleDailyLearningEmailRequest(
  {
    method: 'POST',
    url: '/api/waitlist?action=daily-learning',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: {
      email: 'learner@example.com',
      consent: false,
      submissionId: '11111111-1111-4111-8111-111111111111',
    },
  },
  missingConsent,
  'daily-learning',
);
assert.equal(missingConsent.statusCode, 400);
assert.equal(JSON.parse(missingConsent.rawBody).code, 'CONSENT_REQUIRED');

const invalidUnsubscribe = mockResponse();
await handleDailyLearningEmailRequest(
  {
    method: 'GET',
    url: '/api/waitlist?action=daily-learning-unsubscribe&token=invalid',
    headers: { accept: 'text/html' },
  },
  invalidUnsubscribe,
  'daily-learning-unsubscribe',
);
assert.equal(invalidUnsubscribe.statusCode, 400);
assert.match(invalidUnsubscribe.rawBody, /Unsubscribe link unavailable/);

const oldCronSecret = process.env.CRON_SECRET;
const oldDistribution = process.env.DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED;
try {
  process.env.CRON_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  delete process.env.DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED;
  const disabled = mockResponse();
  await handleDailyLearningEmailRequest(
    {
      method: 'GET',
      url: '/api/waitlist?action=daily-learning-dispatch',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    },
    disabled,
    'daily-learning-dispatch',
  );
  assert.equal(disabled.statusCode, 200);
  assert.deepEqual(JSON.parse(disabled.rawBody), {
    ok: true,
    enabled: false,
    publishDate: new Date().toISOString().slice(0, 10),
    attempted: 0,
    accepted: 0,
    skipped: 0,
    failed: 0,
  });
} finally {
  if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = oldCronSecret;
  if (oldDistribution === undefined) delete process.env.DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED;
  else process.env.DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED = oldDistribution;
}

console.log('Daily Card email route and scheduler guard contract: PASS');
