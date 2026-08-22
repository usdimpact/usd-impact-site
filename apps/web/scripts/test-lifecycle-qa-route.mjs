import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const original = { ...process.env };
const { handleLifecycleQaRequest: handler } = await import('../src/lib/lifecycle-qa-handler.js');

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
    LIFECYCLE_QA_SECRET: 'a'.repeat(64),
  });
  const unauthorized = response();
  await handler({ method: 'POST', headers: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(JSON.parse(unauthorized.body).code, 'LIFECYCLE_QA_AUTHORIZATION_REQUIRED');


  const unsupported = response();
  await handler({
    method: 'PUT',
    headers: { authorization: `Bearer ${'a'.repeat(64)}` },
  }, unsupported);
  assert.equal(unsupported.statusCode, 405);
  assert.equal(unsupported.headers.Allow, 'POST, DELETE');
  assert.equal(JSON.parse(unsupported.body).code, 'METHOD_NOT_ALLOWED');

  const routeSource = readFileSync(new URL('../src/lib/lifecycle-qa-handler.js', import.meta.url), 'utf8');
  assert.match(routeSource, /outboxRows\[0\]\.status !== 'delivered'/);
  assert.match(routeSource, /fixture_removed_delivery_evidence_retained/);
  assert.doesNotMatch(routeSource, /notification_outbox[^\n]*[\s\S]{0,160}method: 'DELETE'/);

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
