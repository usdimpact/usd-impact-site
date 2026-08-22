import assert from 'node:assert/strict';

const original = { ...process.env };
const { default: handler } = await import('../api/lifecycle-qa.js');

function response() {
  return {
    headers: {},
    statusCode: 0,
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body = String(value); },
  };
}

try {
  delete process.env.LIFECYCLE_QA_ROUTE_ENABLED;
  const disabled = response();
  await handler({ method: 'POST', headers: {} }, disabled);
  assert.equal(disabled.statusCode, 404);
  assert.equal(JSON.parse(disabled.body).code, 'LIFECYCLE_QA_ROUTE_DISABLED');

  Object.assign(process.env, {
    VERCEL_ENV: 'production',
    LIFECYCLE_QA_ROUTE_ENABLED: 'true',
    LIFECYCLE_QA_PRODUCTION_APPROVED: 'true',
    LIFECYCLE_QA_RECIPIENT_EMAIL: 'mircea.management+usdimpact-library-pass-qa@gmail.com',
    CRON_SECRET: 'a'.repeat(64),
  });
  const unauthorized = response();
  await handler({ method: 'POST', headers: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(JSON.parse(unauthorized.body).code, 'SCHEDULER_AUTHORIZATION_REQUIRED');

  process.env.LIFECYCLE_QA_RECIPIENT_EMAIL = 'someone@example.com';
  const wrongRecipient = response();
  await handler({
    method: 'POST',
    headers: { authorization: `Bearer ${'a'.repeat(64)}` },
  }, wrongRecipient);
  assert.equal(wrongRecipient.statusCode, 404);
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
}

console.log('Production lifecycle QA route fail-closed contracts passed.');
