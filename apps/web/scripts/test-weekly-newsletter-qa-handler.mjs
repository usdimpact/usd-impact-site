import assert from 'node:assert/strict';
import { handleWeeklyNewsletterQaBatchRequest } from '../src/lib/weekly-newsletter-qa-handler.js';

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
  let runCalls = 0;
  await handleWeeklyNewsletterQaBatchRequest(
    {
      method: 'POST',
      url: '/api/waitlist?action=weekly-newsletter-qa',
      headers: { 'content-type': 'application/json' },
      body: { weekEnding: '2026-09-04' },
    },
    response,
    {
      environment: { CRON_SECRET: 'test-cron-secret' },
      authorize: () => false,
      runBatch: async () => { runCalls += 1; },
    },
  );
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).code, 'SCHEDULER_AUTHORIZATION_REQUIRED');
  assert.equal(runCalls, 0);
}

{
  const response = responseRecorder();
  await handleWeeklyNewsletterQaBatchRequest(
    { method: 'GET', url: '/api/waitlist?action=weekly-newsletter-qa', headers: {} },
    response,
    { authorize: () => true },
  );
  assert.equal(response.statusCode, 405);
  assert.equal(response.getHeader('allow'), 'POST');
}

{
  const response = responseRecorder();
  await handleWeeklyNewsletterQaBatchRequest(
    {
      method: 'POST',
      url: '/api/waitlist?action=weekly-newsletter-qa',
      headers: { 'content-type': 'text/plain' },
      body: '2026-09-04',
    },
    response,
    { authorize: () => true },
  );
  assert.equal(response.statusCode, 415);
  assert.equal(JSON.parse(response.body).code, 'INVALID_CONTENT_TYPE');
}

{
  const response = responseRecorder();
  let received = null;
  await handleWeeklyNewsletterQaBatchRequest(
    {
      method: 'POST',
      url: '/api/waitlist?action=weekly-newsletter-qa',
      headers: {
        authorization: 'Bearer synthetic',
        'content-type': 'application/json',
      },
      body: { weekEnding: '2026-09-04' },
    },
    response,
    {
      authorize: () => true,
      environment: {},
      resolveOrigin: () => 'https://usd-impact-site-example.vercel.app',
      runBatch: async (input) => {
        received = input;
        return {
          enabled: true,
          weekEnding: '2026-09-04',
          artifactChecksum: 'a'.repeat(64),
          selected: 1,
          accepted: 1,
          skipped: 0,
          failed: 0,
          results: [{
            recipientRef: '123456789abc',
            status: 'accepted',
            reason: 'queued',
            outboxStatus: 'accepted',
          }],
        };
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader('cache-control'), 'private, no-store');
  assert.equal(response.getHeader('x-robots-tag'), 'noindex, nofollow');
  const payload = JSON.parse(response.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.accepted, 1);
  assert.equal(payload.results[0].recipientRef, '123456789abc');
  assert.equal(received.weekEnding, '2026-09-04');
  assert.equal(received.artifactBaseUrl, 'https://usd-impact-site-example.vercel.app');
  assert.equal(received.unsubscribeBaseUrl, 'https://usd-impact-site-example.vercel.app');
}

{
  const response = responseRecorder();
  await handleWeeklyNewsletterQaBatchRequest(
    {
      method: 'POST',
      url: '/api/waitlist?action=weekly-newsletter-qa',
      headers: { 'content-type': 'application/json' },
      body: { weekEnding: '2026-09-04' },
    },
    response,
    {
      authorize: () => true,
      resolveOrigin: () => 'https://usd-impact-site-example.vercel.app',
      runBatch: async () => {
        const error = new Error('synthetic failure');
        error.code = 'WEEKLY_NEWSLETTER_QA_BATCH_DISABLED';
        error.status = 404;
        throw error;
      },
    },
  );
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).code, 'WEEKLY_NEWSLETTER_QA_BATCH_DISABLED');
}

console.log('Weekly Newsletter scheduler-authorized QA handler contract passed.');
