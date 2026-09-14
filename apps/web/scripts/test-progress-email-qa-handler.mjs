import assert from 'node:assert/strict';
import { handleProgressEmailQaBatchRequest } from '../src/lib/progress-email-qa-handler.js';

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: null,
    body: '',
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    end(value = '') {
      this.body = String(value);
    },
  };
}

function request({
  method = 'POST',
  body = { weekEnding: '2026-09-04' },
  authorized = true,
  contentType = 'application/json',
} = {}) {
  return {
    method,
    body,
    headers: {
      authorization: authorized ? 'Bearer test-cron-token' : '',
      'content-type': contentType,
    },
  };
}

const environment = Object.freeze({ CRON_SECRET: 'x'.repeat(40) });
const sources = Object.freeze({
  weeklyReports: Object.freeze([{ periodEnd: '2026-09-04' }]),
  currentWeeklyReport: Object.freeze({ periodEnd: '2026-09-04' }),
});
const batchResult = Object.freeze({
  enabled: true,
  selected: 1,
  accepted: 1,
  skipped: 0,
  failed: 0,
  retryScheduled: 0,
  results: Object.freeze([
    Object.freeze({ recipientRef: 'abcdef123456', status: 'accepted', reason: null, outboxStatus: 'accepted' }),
  ]),
});

{
  const res = responseRecorder();
  let sourceWeek = null;
  let receivedSources = null;
  await handleProgressEmailQaBatchRequest(request(), res, {
    environment,
    authorize: () => true,
    resolveSources: async ({ weekEnding }) => {
      sourceWeek = weekEnding;
      return sources;
    },
    runBatch: async (args) => {
      receivedSources = args;
      return batchResult;
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(sourceWeek, '2026-09-04');
  assert.deepEqual(receivedSources.weeklyReports, sources.weeklyReports);
  assert.deepEqual(receivedSources.currentWeeklyReport, sources.currentWeeklyReport);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.weekEnding, '2026-09-04');
  assert.equal(payload.accepted, 1);
  assert.equal(payload.results[0].recipientRef, 'abcdef123456');
  assert(!res.body.includes('@'));
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request({ method: 'GET' }), res, {
    environment,
    authorize: () => true,
    resolveSources: async () => sources,
    runBatch: async () => batchResult,
  });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.get('allow'), 'POST');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request({ authorized: false }), res, {
    environment,
    authorize: () => false,
    resolveSources: async () => assert.fail('Unauthorized request must not resolve sources.'),
    runBatch: async () => assert.fail('Unauthorized request must not run batch.'),
  });
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).code, 'SCHEDULER_AUTHORIZATION_REQUIRED');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request({ contentType: 'text/plain' }), res, {
    environment,
    authorize: () => true,
    resolveSources: async () => assert.fail('Invalid content type must not resolve sources.'),
  });
  assert.equal(res.statusCode, 415);
  assert.equal(JSON.parse(res.body).code, 'INVALID_CONTENT_TYPE');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request({ body: { weekEnding: 'not-a-date' } }), res, {
    environment,
    authorize: () => true,
    resolveSources: async () => assert.fail('Invalid week must not resolve sources.'),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).code, 'INVALID_PROGRESS_EMAIL_QA_WEEK');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request(), res, {
    environment,
    authorize: () => true,
    resolveSources: null,
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, 'PROGRESS_EMAIL_QA_SOURCE_RESOLVER_MISSING');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request(), res, {
    environment,
    authorize: () => true,
    resolveSources: async () => ({
      weeklyReports: sources.weeklyReports,
      currentWeeklyReport: { periodEnd: '2026-08-28' },
    }),
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, 'PROGRESS_EMAIL_QA_SOURCE_MISMATCH');
}

{
  const res = responseRecorder();
  await handleProgressEmailQaBatchRequest(request(), res, {
    environment,
    authorize: () => true,
    resolveSources: async () => sources,
    runBatch: async () => ({ ...batchResult, accepted: 0, failed: 1 }),
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).ok, false);
}

console.log('Learning Progress scheduler-authorized QA handler contract passed.');
