import assert from 'node:assert/strict';
import { handleMarketingEmailPreferencesRequest } from '../src/lib/marketing-email-preferences-handler.js';
import { createMarketingEmailUnsubscribeToken } from '../src/lib/marketing-email-preference-token.js';

const secret = `moi_${'a'.repeat(43)}`;
const grant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174301',
  idempotency_key: `consent:v1:${'b'.repeat(64)}`,
  purpose: 'weekly_newsletter',
});
const token = createMarketingEmailUnsubscribeToken({
  consentIdempotencyKey: grant.idempotency_key,
  purpose: grant.purpose,
  secret,
});

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
  };
}

{
  const response = responseRecorder();
  await handleMarketingEmailPreferencesRequest(
    { method: 'GET', url: '/api/email-preferences', headers: {} },
    response,
    'marketing-email-preferences',
    {},
  );
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).code, 'AUTHENTICATION_REQUIRED');
}

{
  const response = responseRecorder();
  let readEmail = null;
  await handleMarketingEmailPreferencesRequest(
    {
      method: 'GET',
      url: '/api/email-preferences',
      headers: { authorization: `Bearer ${'x'.repeat(32)}` },
    },
    response,
    'marketing-email-preferences',
    {
      environment: {},
      getVerifiedUser: async () => ({
        id: '123e4567-e89b-42d3-a456-426614174302',
        email: 'reader@example.com',
      }),
      readPreferences: async ({ email }) => {
        readEmail = email;
        return {
          weeklyNewsletter: { active: true, grant: { id: 'private-grant-id' } },
          learningProgressUpdates: { active: false, grant: null },
        };
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(readEmail, 'reader@example.com');
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload.weeklyNewsletter, { subscribed: true });
  assert.deepEqual(payload.learningProgressUpdates, { subscribed: false });
  assert.equal(payload.locale, 'en');
  assert.equal(JSON.stringify(payload).includes('reader@example.com'), false);
  assert.equal(JSON.stringify(payload).includes('private-grant-id'), false);
}

{
  const response = responseRecorder();
  let inspectCount = 0;
  let withdrawCount = 0;
  await handleMarketingEmailPreferencesRequest(
    {
      method: 'GET',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
      headers: { accept: 'text/html' },
    },
    response,
    'marketing-email-unsubscribe',
    {
      environment: { MARKETING_OPT_IN_SECRET: secret },
      inspect: async () => {
        inspectCount += 1;
        return { purpose: 'weekly_newsletter', active: true, grant, withdrawal: null };
      },
      withdraw: async () => {
        withdrawCount += 1;
        assert.fail('GET must never withdraw consent.');
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(inspectCount, 1);
  assert.equal(withdrawCount, 0);
  assert.match(response.body, /Stop Weekly USD Impact email\?/);
  assert.match(response.body, /List-Unsubscribe/);
  assert.match(response.body, /Confirm unsubscribe/);
}

{
  const response = responseRecorder();
  let withdrawCount = 0;
  await handleMarketingEmailPreferencesRequest(
    {
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: 'List-Unsubscribe=One-Click',
    },
    response,
    'marketing-email-unsubscribe',
    {
      environment: { MARKETING_OPT_IN_SECRET: secret },
      withdraw: async ({ token: supplied }) => {
        withdrawCount += 1;
        assert.equal(supplied, token);
        return { created: true, purpose: 'weekly_newsletter', grant, withdrawal: { id: 'w1' } };
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '');
  assert.equal(withdrawCount, 1);
}

{
  const response = responseRecorder();
  let withdrawCount = 0;
  await handleMarketingEmailPreferencesRequest(
    {
      method: 'POST',
      url: `/email/unsubscribe?token=${encodeURIComponent(token)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'confirm=false',
    },
    response,
    'marketing-email-unsubscribe',
    {
      environment: { MARKETING_OPT_IN_SECRET: secret },
      withdraw: async () => { withdrawCount += 1; },
    },
  );
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).code, 'UNSUBSCRIBE_CONFIRMATION_REQUIRED');
  assert.equal(withdrawCount, 0);
}

{
  const response = responseRecorder();
  await handleMarketingEmailPreferencesRequest(
    { method: 'GET', url: '/email/unsubscribe?token=invalid', headers: { accept: 'text/html' } },
    response,
    'marketing-email-unsubscribe',
    { environment: { MARKETING_OPT_IN_SECRET: secret } },
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /Preference link unavailable/);
}

console.log('Marketing email preference HTTP handler contract passed.');
