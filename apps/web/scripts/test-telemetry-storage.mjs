import assert from 'node:assert/strict';
import {
  buildTelemetryCounterPairs,
  readTelemetryAggregates,
  recordTelemetryEvent,
} from '../src/lib/telemetry-store.js';

const env = {
  KV_REST_API_URL: 'https://example.upstash.test',
  KV_REST_API_TOKEN: 'write-token',
  KV_REST_API_READ_ONLY_TOKEN: 'read-token',
  TELEMETRY_RATE_LIMIT_PER_MINUTE: '250',
};

const pairs = Object.fromEntries(buildTelemetryCounterPairs({
  eventName: 'quiz_complete',
  occurredAt: '2026-07-28T12:34:56.000Z',
  route: '/start-here/quiz',
  quizId: 'quiz-start-here',
  outcome: 'pass',
  score: 9,
  questionCount: 10,
  utmSource: 'newsletter',
}));
assert.equal(pairs['events:total'], 1);
assert.equal(pairs['events:quiz_complete'], 1);
assert.equal(pairs['quiz:quiz-start-here:completions'], 1);
assert.equal(pairs['quiz:quiz-start-here:pass'], 1);
assert.equal(pairs['quiz:quiz-start-here:score_sum'], 9);
assert.equal(pairs['utm_source:newsletter'], 1);

const checklistPairs = Object.fromEntries(buildTelemetryCounterPairs({
  eventName: 'checklist_download',
  occurredAt: '2026-07-28T12:34:56.000Z',
  route: '/lead-magnets/weekly-dollar-regime-checklist/',
  utmSource: 'newsletter',
  utmMedium: 'email',
  utmCampaign: 'july_launch',
}));
assert.equal(checklistPairs['checklist:downloads'], 1);
assert.equal(checklistPairs['checklist:route:/lead-magnets/weekly-dollar-regime-checklist/'], 1);
assert.equal(checklistPairs['checklist:utm_source:newsletter'], 1);
assert.equal(checklistPairs['checklist:utm_medium:email'], 1);
assert.equal(checklistPairs['checklist:utm_campaign:july_launch'], 1);

let capturedRequest;
const accepted = await recordTelemetryEvent({
  eventId: 'evt-storage-0001',
  record: {
    eventName: 'checklist_download',
    occurredAt: '2026-07-28T12:34:56.000Z',
    route: '/lead-magnets/weekly-dollar-regime-checklist/',
  },
}, {
  env,
  fetchImpl: async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ result: ['accepted', 1] }), { status: 200 });
  },
});
assert.equal(accepted.status, 'accepted');
assert.equal(accepted.durable, true);
assert.equal(capturedRequest.url, env.KV_REST_API_URL);
assert.equal(capturedRequest.options.headers.Authorization, 'Bearer write-token');
const command = JSON.parse(capturedRequest.options.body);
assert.equal(command[0], 'EVAL');
assert.match(command.join(' '), /dedup:evt-storage-0001/);
assert.match(command.join(' '), /daily:2026-07-28/);
assert.match(command.join(' '), /checklist:downloads/);
assert.match(command.join(' '), /checklist:route:\/lead-magnets\/weekly-dollar-regime-checklist\//);

const duplicate = await recordTelemetryEvent({
  eventId: 'evt-storage-0002',
  record: {
    eventName: 'quiz_start',
    occurredAt: '2026-07-28T12:34:56.000Z',
    route: '/start-here/quiz',
    quizId: 'quiz-start-here',
  },
}, {
  env,
  fetchImpl: async () => new Response(JSON.stringify({ result: ['duplicate', 2] }), { status: 200 }),
});
assert.equal(duplicate.duplicate, true);

const report = await readTelemetryAggregates(['2026-07-27', '2026-07-28'], {
  env,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${env.KV_REST_API_URL}/pipeline`);
    assert.equal(options.headers.Authorization, 'Bearer read-token');
    const commands = JSON.parse(options.body);
    assert.equal(commands.length, 3);
    return new Response(JSON.stringify([
      { result: ['events:total', '12', 'checklist:downloads', '4'] },
      { result: [] },
      { result: ['events:total', '3'] },
    ]), { status: 200 });
  },
});
assert.deepEqual(report.totals, { 'events:total': 12, 'checklist:downloads': 4 });
assert.deepEqual(report.days[0], { date: '2026-07-27', counters: {} });
assert.deepEqual(report.days[1], { date: '2026-07-28', counters: { 'events:total': 3 } });

await assert.rejects(
  recordTelemetryEvent({
    eventId: 'evt-storage-0003',
    record: {
      eventName: 'checklist_download',
      occurredAt: '2026-07-28T12:34:56.000Z',
      route: '/',
    },
  }, {
    env: {},
    fetchImpl: async () => new Response('{}'),
  }),
  /not configured/i,
);

console.log('Telemetry storage tests passed.');
