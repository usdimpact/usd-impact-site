import assert from 'node:assert/strict';
import handler, { resetTelemetryStateForTests } from '../api/telemetry.js';

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

async function request(body, method = 'POST') {
  const response = createResponse();
  await handler({ method, body, headers: { 'user-agent': 'excluded-test-agent' } }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

resetTelemetryStateForTests();
const logged = [];
const originalLog = console.log;
console.log = (value) => logged.push(value);

try {
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

  const checklistRecord = JSON.parse(logged.at(-1));
  assert.equal(checklistRecord.eventName, 'checklist_download');
  assert.equal(checklistRecord.utmSource, 'newsletter');
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

  const method = await request({}, 'GET');
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'POST');
} finally {
  console.log = originalLog;
}

console.log('Telemetry function tests passed.');
