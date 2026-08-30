import assert from 'node:assert/strict';
import handler, {
  buildChecklistAnalytics,
  buildCheckoutFunnelAnalytics,
  resetTelemetryStateForTests,
  setTelemetryAggregateReaderForTests,
  setTelemetryRecorderForTests,
} from '../api/telemetry.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = '') {
      this.body = value;
    },
  };
}

async function request(body, method = 'POST', options = {}) {
  const response = createResponse();
  await handler({
    method,
    body,
    url: options.url ?? '/',
    headers: { 'user-agent': 'excluded-test-agent', ...(options.headers ?? {}) },
  }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

resetTelemetryStateForTests();
setTelemetryRecorderForTests(async () => ({
  durable: true,
  duplicate: false,
  rateLimited: false,
  status: 'accepted',
}));

const logged = [];
const errors = [];
const originalLog = console.log;
const originalError = console.error;
const originalReportToken = process.env.TELEMETRY_REPORT_TOKEN;
const originalVercelEnvironment = process.env.VERCEL_ENV;
console.log = (value) => logged.push(value);
console.error = (value) => errors.push(value);

try {
  process.env.VERCEL_ENV = 'production';
  const checklist = await request({
    eventId: 'evt-checklist-0001',
    eventName: 'checklist_download',
    route: '/lead-magnets/weekly-dollar-regime-checklist/',
    utmSource: 'newsletter',
    utmMedium: 'email',
    utmCampaign: 'july_launch',
    email: 'must-not-be-recorded@example.com',
    userAgent: 'must-not-be-recorded',
    answerChoices: ['A', 'B'],
  });
  assert.equal(checklist.status, 202);
  assert.equal(checklist.json.accepted, true);
  assert.equal(checklist.json.duplicate, false);
  assert.equal(checklist.json.durable, true);

  const checklistRecord = JSON.parse(logged.at(-1));
  assert.equal(checklistRecord.eventName, 'checklist_download');
  assert.equal(checklistRecord.utmSource, 'newsletter');
  assert.equal(checklistRecord.durable, true);
  assert.equal(checklistRecord.email, undefined);
  assert.equal(checklistRecord.userAgent, undefined);
  assert.equal(checklistRecord.answerChoices, undefined);

  const duplicate = await request({
    eventId: 'evt-checklist-0001',
    eventName: 'checklist_download',
    route: '/lead-magnets/weekly-dollar-regime-checklist/',
  });
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.json.duplicate, true);
  assert.equal(logged.length, 1);

  const completion = await request({
    eventId: 'evt-quiz-complete-0001',
    eventName: 'quiz_complete',
    route: '/start-here/quiz',
    quizId: 'quiz-start-here',
    outcome: 'pass',
    score: 9,
    questionCount: 10,
  });
  assert.equal(completion.status, 202);
  const completionRecord = JSON.parse(logged.at(-1));
  assert.equal(completionRecord.quizId, 'quiz-start-here');
  assert.equal(completionRecord.outcome, 'pass');
  assert.equal(completionRecord.score, 9);

  for (const eventName of [
    'checkout_view',
    'checkout_button_click',
    'checkout_sign_in_redirect',
  ]) {
    const checkoutEvent = await request({
      eventId: `evt-${eventName.replaceAll('_', '-')}-0001`,
      eventName,
      route: '/checkout/',
      utmSource: 'launch_email',
      email: 'must-not-be-recorded@example.com',
      accountId: 'must-not-be-recorded',
      paymentDetails: { card: 'must-not-be-recorded' },
    });
    assert.equal(checkoutEvent.status, 202);
    const checkoutRecord = JSON.parse(logged.at(-1));
    assert.equal(checkoutRecord.eventName, eventName);
    assert.equal(checkoutRecord.route, '/checkout/');
    assert.equal(checkoutRecord.utmSource, 'launch_email');
    assert.equal(checkoutRecord.email, undefined);
    assert.equal(checkoutRecord.accountId, undefined);
    assert.equal(checkoutRecord.paymentDetails, undefined);
  }

  const invalidCheckoutRoute = await request({
    eventId: 'evt-checkout-route-0001',
    eventName: 'checkout_view',
    route: '/account/',
  });
  assert.equal(invalidCheckoutRoute.status, 400);

  process.env.VERCEL_ENV = 'preview';
  setTelemetryRecorderForTests(async () => {
    throw new Error('Preview checkout telemetry must not reach durable storage.');
  });
  const isolatedPreviewEvent = await request({
    eventId: 'evt-checkout-preview-0001',
    eventName: 'checkout_view',
    route: '/checkout/',
  });
  assert.equal(isolatedPreviewEvent.status, 202);
  assert.equal(isolatedPreviewEvent.json.environmentIsolated, true);
  assert.equal(isolatedPreviewEvent.json.durable, false);
  process.env.VERCEL_ENV = 'production';
  setTelemetryRecorderForTests(async () => ({
    durable: true,
    duplicate: false,
    rateLimited: false,
    status: 'accepted',
  }));

  const invalidEvent = await request({
    eventId: 'evt-invalid-0001',
    eventName: 'page_view',
    route: '/',
  });
  assert.equal(invalidEvent.status, 400);

  const invalidQuiz = await request({
    eventId: 'evt-invalid-quiz-0001',
    eventName: 'quiz_start',
    route: '/start-here/quiz',
    quizId: '../private',
  });
  assert.equal(invalidQuiz.status, 400);

  const invalidScore = await request({
    eventId: 'evt-invalid-score-0001',
    eventName: 'quiz_complete',
    route: '/start-here/quiz',
    quizId: 'quiz-start-here',
    outcome: 'pass',
    score: 11,
    questionCount: 10,
  });
  assert.equal(invalidScore.status, 400);

  const invalidCampaign = await request({
    eventId: 'evt-invalid-campaign-0001',
    eventName: 'checklist_download',
    route: '/lead-magnets/weekly-dollar-regime-checklist/',
    utmSource: 'bad source with spaces',
  });
  assert.equal(invalidCampaign.status, 400);

  setTelemetryRecorderForTests(async () => {
    throw new Error('simulated storage outage');
  });
  const degraded = await request({
    eventId: 'evt-storage-failure-0001',
    eventName: 'quiz_start',
    route: '/start-here/quiz',
    quizId: 'quiz-start-here',
  });
  assert.equal(degraded.status, 202);
  assert.equal(degraded.json.accepted, true);
  assert.equal(degraded.json.durable, false);
  assert.match(errors.at(-1), /durable storage failed/i);
  assert.equal(JSON.parse(logged.at(-1)).durable, false);

  const aggregateFixture = {
    totals: {
      'checklist:downloads': 20,
      'checklist:route:/lead-magnets/weekly-dollar-regime-checklist/': 12,
      'checklist:utm_source:newsletter': 8,
      'checklist:utm_medium:email': 8,
      'checklist:utm_campaign:july_launch': 6,
    },
    days: [
      { date: '2026-07-27', counters: { 'checklist:downloads': 1 } },
      { date: '2026-07-28', counters: { 'checklist:downloads': 2 } },
      { date: '2026-07-29', counters: { 'checklist:downloads': 4 } },
      { date: '2026-07-30', counters: { 'checklist:downloads': 6 } },
    ],
  };
  const summary = buildChecklistAnalytics(aggregateFixture, 2);
  assert.equal(summary.lifetimeDownloads, 20);
  assert.equal(summary.rangeDownloads, 10);
  assert.equal(summary.previousRangeDownloads, 3);
  assert.equal(summary.changePercent, 233.3);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.averagePerDay, 5);
  assert.equal(summary.mostRecentDownloadDate, '2026-07-30');
  assert.deepEqual(summary.attribution.sources, [{ label: 'newsletter', value: 8 }]);

  const checkoutAggregateFixture = {
    totals: {
      'checkout:views': 40,
      'checkout:button_clicks': 12,
      'checkout:sign_in_redirects': 9,
      'checkout:utm_source:launch_email': 8,
    },
    days: [
      { date: '2026-07-29', counters: { 'checkout:views': 6, 'checkout:button_clicks': 2 } },
      {
        date: '2026-07-30',
        counters: {
          'checkout:views': 4,
          'checkout:button_clicks': 1,
          'checkout:sign_in_redirects': 1,
        },
      },
    ],
  };
  const checkoutSummary = buildCheckoutFunnelAnalytics(checkoutAggregateFixture, 2);
  assert.deepEqual(checkoutSummary.lifetime, { views: 40, buttonClicks: 12, signInRedirects: 9 });
  assert.equal(checkoutSummary.range.views, 10);
  assert.equal(checkoutSummary.range.buttonClicks, 3);
  assert.equal(checkoutSummary.range.signInRedirects, 1);
  assert.equal(checkoutSummary.range.buttonClickRatePercent, 30);
  assert.equal(checkoutSummary.range.signInRedirectRatePercent, 33.3);
  assert.deepEqual(checkoutSummary.attribution.sources, [{ label: 'launch_email', value: 8 }]);

  process.env.TELEMETRY_REPORT_TOKEN = 'report-token-for-tests';
  setTelemetryAggregateReaderForTests(async (dates) => {
    assert.deepEqual(dates, ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30']);
    return aggregateFixture;
  });
  const unauthorizedReport = await request(null, 'GET', {
    url: '/api/telemetry?action=checklist-report&end=2026-07-30&days=2',
  });
  assert.equal(unauthorizedReport.status, 401);
  assert.equal(unauthorizedReport.headers['www-authenticate'], 'Bearer');

  const checklistReport = await request(null, 'GET', {
    url: '/api/telemetry?action=checklist-report&end=2026-07-30&days=2',
    headers: { authorization: 'Bearer report-token-for-tests' },
  });
  assert.equal(checklistReport.status, 200);
  assert.deepEqual(checklistReport.json.range, { start: '2026-07-29', end: '2026-07-30', days: 2 });
  assert.deepEqual(checklistReport.json.comparisonRange, { start: '2026-07-27', end: '2026-07-28', days: 2 });
  assert.equal(checklistReport.json.checklist.rangeDownloads, 10);

  setTelemetryAggregateReaderForTests(async (dates) => {
    assert.deepEqual(dates, ['2026-07-29', '2026-07-30']);
    return checkoutAggregateFixture;
  });
  const checkoutReport = await request(null, 'GET', {
    url: '/api/telemetry?action=checkout-funnel-report&end=2026-07-30&days=2',
    headers: { authorization: 'Bearer report-token-for-tests' },
  });
  assert.equal(checkoutReport.status, 200);
  assert.deepEqual(checkoutReport.json.range, { start: '2026-07-29', end: '2026-07-30', days: 2 });
  assert.equal(checkoutReport.json.checkout.range.views, 10);
  assert.match(checkoutReport.json.checkout.eventSemantics, /not unique visitors/i);

  const invalidReportRange = await request(null, 'GET', {
    url: '/api/telemetry?action=checklist-report&end=2026-07-30&days=32',
    headers: { authorization: 'Bearer report-token-for-tests' },
  });
  assert.equal(invalidReportRange.status, 400);

  const method = await request({}, 'GET');
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'POST');
} finally {
  console.log = originalLog;
  console.error = originalError;
  if (originalReportToken === undefined) delete process.env.TELEMETRY_REPORT_TOKEN;
  else process.env.TELEMETRY_REPORT_TOKEN = originalReportToken;
  if (originalVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnvironment;
  resetTelemetryStateForTests();
}

console.log('Telemetry function tests passed.');
